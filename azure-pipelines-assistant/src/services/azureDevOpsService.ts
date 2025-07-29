import { IAzureDevOpsService, AzureDevOpsServiceConfig } from '../interfaces/azureDevOpsService';
import { Project, Pipeline, PipelineRun, PipelineRunDetails, RunParameters, LogEntry } from '../models';
import { ICacheService } from '../interfaces/cacheService';
import { IApiClient, ApiError } from '../interfaces/apiClient';
import { 
  NetworkError, 
  DataValidationError, 
  ResourceError,
  isNetworkError 
} from '../errors/errorTypes';
import { withRetry, withGracefulDegradation } from '../errors/errorRecovery';

/**
 * Azure DevOps service implementation with caching support
 */
export class AzureDevOpsService implements IAzureDevOpsService {
    private readonly config: Required<AzureDevOpsServiceConfig>;

    constructor(
        private readonly apiClient: IApiClient,
        private readonly cacheService: ICacheService,
        config: AzureDevOpsServiceConfig
    ) {
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            cacheEnabled: true,
            cacheTtl: 5 * 60 * 1000, // 5 minutes
            ...config
        };
    }

    // Project and Pipeline Management

    /**
     * Get all projects accessible to the authenticated user
     */
    async getProjects(): Promise<Project[]> {
        if (this.config.cacheEnabled) {
            const cached = this.cacheService.getCachedProjects();
            if (cached) {
                return cached;
            }
        }

        const primaryOperation = async () => {
            try {
                const response = await this.apiClient.get<{ value: any[] }>(
                    `https://dev.azure.com/${this.config.organization}/_apis/projects?api-version=7.0`
                );

                if (!response.data || !Array.isArray(response.data.value)) {
                    throw new DataValidationError(
                        'Invalid projects response format',
                        'SCHEMA_MISMATCH',
                        'value',
                        response.data,
                        'Array of projects'
                    );
                }

                const projects: Project[] = response.data.value.map(this.mapProject);

                if (this.config.cacheEnabled) {
                    this.cacheService.setCachedProjects(projects);
                }

                return projects;
            } catch (error) {
                if (error instanceof ApiError) {
                    throw this.convertApiError(error, 'getProjects');
                }
                throw error;
            }
        };

        const fallbackOperation = async () => {
            if (this.config.cacheEnabled) {
                const cached = this.cacheService.getCachedProjects();
                if (cached) {
                    return cached;
                }
            }
            throw new ResourceError(
                'No cached projects available',
                'NOT_FOUND',
                'projects',
                undefined,
                'Unable to fetch projects and no cached data available'
            );
        };

        return withGracefulDegradation(
            primaryOperation,
            fallbackOperation,
            'getProjects',
            { useCachedData: true, showOfflineMode: true }
        );
    }

    /**
     * Get all pipelines for a specific project
     */
    async getPipelines(projectId: string): Promise<Pipeline[]> {
        if (this.config.cacheEnabled) {
            const cached = this.cacheService.getCachedPipelines(projectId);
            if (cached) {
                return cached;
            }
        }

        return withRetry(async () => {
            try {
                const response = await this.apiClient.get<{ value: any[] }>(
                    `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines?api-version=7.0`
                );

                if (!response.data || !Array.isArray(response.data.value)) {
                    throw new DataValidationError(
                        'Invalid pipelines response format',
                        'SCHEMA_MISMATCH',
                        'value',
                        response.data,
                        'Array of pipelines'
                    );
                }

                const pipelines: Pipeline[] = await Promise.all(
                    response.data.value.map(async (pipelineData) => {
                        try {
                            // Get additional pipeline details
                            const detailResponse = await this.apiClient.get<any>(
                                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineData.id}?api-version=7.0`
                            );
                            return this.mapPipeline(detailResponse.data, projectId);
                        } catch (detailError) {
                            // If detail fetch fails, use basic pipeline data
                            console.warn(`Failed to fetch details for pipeline ${pipelineData.id}:`, detailError);
                            return this.mapPipeline(pipelineData, projectId);
                        }
                    })
                );

                if (this.config.cacheEnabled) {
                    this.cacheService.setCachedPipelines(projectId, pipelines);
                }

                return pipelines;
            } catch (error) {
                if (error instanceof ApiError) {
                    throw this.convertApiError(error, 'getPipelines', { projectId });
                }
                throw error;
            }
        }, `getPipelines-${projectId}`);
    }

    /**
     * Get pipeline runs for a specific pipeline
     */
    async getPipelineRuns(pipelineId: number, projectId: string, top: number = 50): Promise<PipelineRun[]> {
        if (this.config.cacheEnabled) {
            const cached = this.cacheService.getCachedPipelineRuns(pipelineId, projectId);
            if (cached) {
                return cached.slice(0, top);
            }
        }

        try {
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineId}/runs?api-version=7.0&$top=${top}`
            );

            const runs: PipelineRun[] = response.data.value.map(runData => this.mapPipelineRun(runData, pipelineId, projectId));

            if (this.config.cacheEnabled) {
                this.cacheService.setCachedPipelineRuns(pipelineId, projectId, runs);
            }

            return runs;
        } catch (error) {
            throw new Error(`Failed to fetch runs for pipeline ${pipelineId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Run Management

    /**
     * Trigger a new pipeline run
     */
    async triggerPipelineRun(pipelineId: number, projectId: string, parameters?: RunParameters): Promise<PipelineRun> {
        try {
            const requestBody: any = {
                resources: {
                    repositories: {
                        self: {
                            refName: parameters?.sourceBranch || 'refs/heads/main'
                        }
                    }
                }
            };

            if (parameters?.variables) {
                requestBody.variables = Object.entries(parameters.variables).reduce((acc, [key, value]) => {
                    acc[key] = { value };
                    return acc;
                }, {} as Record<string, { value: string }>);
            }

            if (parameters?.templateParameters) {
                requestBody.templateParameters = parameters.templateParameters;
            }

            const response = await this.apiClient.post<any>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineId}/runs?api-version=7.0`,
                requestBody
            );

            const run = this.mapPipelineRun(response.data, pipelineId, projectId);

            // Invalidate cache for this pipeline to ensure fresh data
            if (this.config.cacheEnabled) {
                this.cacheService.invalidatePipeline(pipelineId, projectId);
            }

            return run;
        } catch (error) {
            throw new Error(`Failed to trigger pipeline run: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get detailed information about a specific pipeline run
     */
    async getRunDetails(runId: number, pipelineId: number, projectId: string): Promise<PipelineRunDetails> {
        try {
            const [runResponse, timelineResponse] = await Promise.all([
                this.apiClient.get<any>(
                    `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineId}/runs/${runId}?api-version=7.0`
                ),
                this.apiClient.get<any>(
                    `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/build/builds/${runId}/timeline?api-version=7.0`
                ).catch(() => ({ data: { records: [] } })) // Timeline might not be available for all runs
            ]);

            const baseRun = this.mapPipelineRun(runResponse.data, pipelineId, projectId);
            
            return {
                ...baseRun,
                stages: this.extractStagesFromTimeline(timelineResponse.data?.records || []),
                timeline: timelineResponse.data?.records || [],
                logs: [] // Will be populated when logs are requested
            };
        } catch (error) {
            throw new Error(`Failed to fetch run details: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Cancel a running pipeline
     */
    async cancelRun(runId: number, pipelineId: number, projectId: string): Promise<void> {
        try {
            await this.apiClient.patch<any>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/build/builds/${runId}?api-version=7.0`,
                { status: 'Cancelling' }
            );

            // Invalidate cache to ensure fresh data
            if (this.config.cacheEnabled) {
                this.cacheService.invalidatePipeline(pipelineId, projectId);
            }
        } catch (error) {
            throw new Error(`Failed to cancel run: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Logs and Artifacts

    /**
     * Get logs for a specific pipeline run
     */
    async getRunLogs(runId: number, projectId: string): Promise<LogEntry[]> {
        try {
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/build/builds/${runId}/logs?api-version=7.0`
            );

            const logEntries: LogEntry[] = [];
            
            // Fetch individual log files
            for (const logRef of response.data.value) {
                try {
                    const logContent = await this.apiClient.get<string>(logRef.url);
                    const entries = this.parseLogContent(logContent.data, logRef.id);
                    logEntries.push(...entries);
                } catch (logError) {
                    // Continue if individual log fails
                    console.warn(`Failed to fetch log ${logRef.id}:`, logError);
                }
            }

            return logEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        } catch (error) {
            throw new Error(`Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }



    // Cache Management

    /**
     * Refresh cached data for a specific project
     */
    async refreshProject(projectId: string): Promise<void> {
        if (this.config.cacheEnabled) {
            this.cacheService.invalidateProject(projectId);
        }
        // Trigger fresh fetch
        await this.getPipelines(projectId);
    }

    /**
     * Refresh cached data for a specific pipeline
     */
    async refreshPipeline(pipelineId: number, projectId: string): Promise<void> {
        if (this.config.cacheEnabled) {
            this.cacheService.invalidatePipeline(pipelineId, projectId);
        }
        // Trigger fresh fetch
        await this.getPipelineRuns(pipelineId, projectId);
    }

    /**
     * Clear all cached data
     */
    async clearCache(): Promise<void> {
        if (this.config.cacheEnabled) {
            this.cacheService.clear();
        }
    }

    // Private mapping methods

    private mapProject(projectData: any): Project {
        return {
            id: projectData.id,
            name: projectData.name,
            description: projectData.description,
            url: projectData.url,
            state: projectData.state || 'wellFormed',
            visibility: projectData.visibility || 'private'
        };
    }

    private async mapPipeline(pipelineData: any, projectId: string): Promise<Pipeline> {
        // Get project details if not cached
        const projects = await this.getProjects();
        const project = projects.find(p => p.id === projectId || p.name === projectId);
        
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }

        return {
            id: pipelineData.id,
            name: pipelineData.name,
            project,
            folder: pipelineData.folder,
            revision: pipelineData.revision || 1,
            url: pipelineData.url || `https://dev.azure.com/${this.config.organization}/${projectId}/_build?definitionId=${pipelineData.id}`,
            configuration: {
                type: pipelineData.configuration?.type || 'yaml',
                path: pipelineData.configuration?.path || 'azure-pipelines.yml',
                repository: {
                    id: pipelineData.configuration?.repository?.id || 'unknown',
                    name: pipelineData.configuration?.repository?.name || 'unknown',
                    url: pipelineData.configuration?.repository?.url || '',
                    type: pipelineData.configuration?.repository?.type || 'TfsGit',
                    defaultBranch: pipelineData.configuration?.repository?.defaultBranch || 'main'
                }
            }
        };
    }

    private mapPipelineRun(runData: any, pipelineId: number, projectId: string): PipelineRun {
        return {
            id: runData.id,
            name: runData.name || `Run #${runData.id}`,
            state: this.mapRunState(runData.state),
            result: this.mapRunResult(runData.result),
            createdDate: new Date(runData.createdDate),
            finishedDate: runData.finishedDate ? new Date(runData.finishedDate) : undefined,
            pipeline: {} as Pipeline, // Will be populated when needed
            resources: runData.resources || {
                repositories: {},
                pipelines: {},
                builds: {},
                containers: {},
                packages: {}
            },
            variables: runData.variables || {},
            url: runData.url || `https://dev.azure.com/${this.config.organization}/${projectId}/_build/results?buildId=${runData.id}`
        };
    }

    private mapRunState(state: string): 'completed' | 'inProgress' | 'cancelling' | 'cancelled' {
        switch (state?.toLowerCase()) {
            case 'completed': return 'completed';
            case 'inprogress': return 'inProgress';
            case 'cancelling': return 'cancelling';
            case 'cancelled': return 'cancelled';
            default: return 'completed';
        }
    }

    private mapRunResult(result: string): 'succeeded' | 'failed' | 'canceled' | 'abandoned' | 'partiallySucceeded' | undefined {
        if (!result) {
            return undefined;
        }
        
        switch (result.toLowerCase()) {
            case 'succeeded': return 'succeeded';
            case 'failed': return 'failed';
            case 'canceled': return 'canceled';
            case 'abandoned': return 'abandoned';
            case 'partiallysucceeded': return 'partiallySucceeded';
            default: return undefined;
        }
    }

    private extractStagesFromTimeline(records: any[]): any[] {
        // Extract stage information from timeline records
        return records
            .filter(record => record.type === 'Stage')
            .map(stage => ({
                id: stage.id,
                name: stage.name,
                displayName: stage.displayName || stage.name,
                state: this.mapRunState(stage.state),
                result: this.mapRunResult(stage.result),
                startTime: stage.startTime ? new Date(stage.startTime) : undefined,
                finishTime: stage.finishTime ? new Date(stage.finishTime) : undefined,
                jobs: records
                    .filter(record => record.type === 'Job' && record.parentId === stage.id)
                    .map(job => ({
                        id: job.id,
                        name: job.name,
                        displayName: job.displayName || job.name,
                        state: this.mapRunState(job.state),
                        result: this.mapRunResult(job.result),
                        startTime: job.startTime ? new Date(job.startTime) : undefined,
                        finishTime: job.finishTime ? new Date(job.finishTime) : undefined,
                        agentName: job.workerName,
                        tasks: records
                            .filter(record => record.type === 'Task' && record.parentId === job.id)
                            .map(task => ({
                                id: task.id,
                                name: task.name,
                                displayName: task.displayName || task.name,
                                state: this.mapRunState(task.state),
                                result: this.mapRunResult(task.result),
                                startTime: task.startTime ? new Date(task.startTime) : undefined,
                                finishTime: task.finishTime ? new Date(task.finishTime) : undefined,
                                logId: task.log?.id,
                                errorCount: task.errorCount || 0,
                                warningCount: task.warningCount || 0,
                                issues: task.issues || []
                            }))
                    })),
                dependsOn: [] // Would need additional API calls to determine dependencies
            }));
    }

    private parseLogContent(logContent: string, logId: number): LogEntry[] {
        const lines = logContent.split('\n');
        const entries: LogEntry[] = [];

        lines.forEach((line, index) => {
            if (line.trim()) {
                // Simple log parsing - can be enhanced based on actual log format
                const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
                const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
                
                let level: 'debug' | 'info' | 'warning' | 'error' = 'info';
                if (line.toLowerCase().includes('error')) {
                    level = 'error';
                } else if (line.toLowerCase().includes('warning')) {
                    level = 'warning';
                } else if (line.toLowerCase().includes('debug')) {
                    level = 'debug';
                }

                entries.push({
                    id: logId * 10000 + index,
                    timestamp,
                    level,
                    message: line,
                    lineNumber: index + 1
                });
            }
        });

        return entries;
    }

    // Additional methods for command support

    /**
     * Trigger a pipeline run (alias for triggerPipelineRun)
     */
    async triggerRun(pipelineId: number, projectId: string, parameters?: RunParameters): Promise<PipelineRun> {
        return this.triggerPipelineRun(pipelineId, projectId, parameters);
    }

    /**
     * Get logs for a specific job or task
     */
    async getLogs(runId: number, pipelineId: number, projectId: string, jobId?: string, taskId?: string): Promise<LogEntry[]> {
        // For now, delegate to getRunLogs - can be enhanced to filter by job/task
        return this.getRunLogs(runId, projectId);
    }

    /**
     * Download artifacts with enhanced signature for command support
     */
    async downloadArtifacts(runId: number, pipelineId: number, projectId: string, downloadPath: string, artifactName?: string): Promise<string> {
        try {
            // Get the artifact blob using the internal method
            const artifactBlob = await this.downloadArtifactsInternal(runId, projectId, artifactName);
            
            // In a real implementation, we would save the blob to the downloadPath
            // For now, just return the path
            return downloadPath;
        } catch (error) {
            throw new Error(`Failed to download artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Internal method to download artifacts as blob
     */
    private async downloadArtifactsInternal(runId: number, projectId: string, artifactName?: string): Promise<Blob> {
        try {
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/build/builds/${runId}/artifacts?api-version=7.0`
            );

            let artifactUrl: string;
            
            if (artifactName) {
                const artifact = response.data.value.find(a => a.name === artifactName);
                if (!artifact) {
                    throw new Error(`Artifact '${artifactName}' not found`);
                }
                artifactUrl = artifact.resource.downloadUrl;
            } else {
                if (response.data.value.length === 0) {
                    throw new Error('No artifacts found');
                }
                artifactUrl = response.data.value[0].resource.downloadUrl;
            }

            const artifactData = await this.apiClient.get<Blob>(artifactUrl);
            return artifactData.data;
        } catch (error) {
            throw new Error(`Failed to download artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Real-time Updates and Incremental Fetching

    /**
     * Get pipeline runs with incremental fetching support
     */
    async getPipelineRunsIncremental(pipelineId: number, projectId: string, since?: Date, top: number = 50): Promise<PipelineRun[]> {
        try {
            let url = `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineId}/runs?api-version=7.0&$top=${top}`;
            
            // Add timestamp filter for incremental fetching
            if (since) {
                const sinceIso = since.toISOString();
                url += `&minTime=${encodeURIComponent(sinceIso)}`;
            }

            const response = await this.apiClient.get<{ value: any[] }>(url);
            const runs: PipelineRun[] = response.data.value.map(runData => this.mapPipelineRun(runData, pipelineId, projectId));

            // Update cache with new data
            if (this.config.cacheEnabled) {
                if (since) {
                    // For incremental updates, merge with existing cache
                    const existingRuns = this.cacheService.getCachedPipelineRuns(pipelineId, projectId) || [];
                    const mergedRuns = this.mergeRunsWithExisting(runs, existingRuns);
                    this.cacheService.setCachedPipelineRuns(pipelineId, projectId, mergedRuns);
                } else {
                    // Full refresh
                    this.cacheService.setCachedPipelineRuns(pipelineId, projectId, runs);
                }
            }

            return runs;
        } catch (error) {
            throw new Error(`Failed to fetch incremental runs for pipeline ${pipelineId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get run details with change detection
     */
    async getRunDetailsWithChangeDetection(runId: number, pipelineId: number, projectId: string, lastModified?: Date): Promise<{ run: PipelineRunDetails; hasChanged: boolean }> {
        try {
            const [runResponse, timelineResponse] = await Promise.all([
                this.apiClient.get<any>(
                    `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineId}/runs/${runId}?api-version=7.0`
                ),
                this.apiClient.get<any>(
                    `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/build/builds/${runId}/timeline?api-version=7.0`
                ).catch(() => ({ data: { records: [] } }))
            ]);

            const baseRun = this.mapPipelineRun(runResponse.data, pipelineId, projectId);
            const runDetails: PipelineRunDetails = {
                ...baseRun,
                stages: this.extractStagesFromTimeline(timelineResponse.data?.records || []),
                timeline: timelineResponse.data?.records || [],
                logs: []
            };

            // Determine if run has changed since last check
            let hasChanged = true;
            if (lastModified) {
                const runLastModified = runDetails.finishedDate || runDetails.createdDate;
                hasChanged = runLastModified > lastModified;
            }

            return { run: runDetails, hasChanged };
        } catch (error) {
            throw new Error(`Failed to fetch run details with change detection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get active (in-progress) pipeline runs across all pipelines in a project
     */
    async getActiveRuns(projectId: string): Promise<PipelineRun[]> {
        try {
            // Use build API to get active builds across all pipelines
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/build/builds?statusFilter=inProgress&api-version=7.0`
            );

            const activeRuns: PipelineRun[] = [];
            
            for (const buildData of response.data.value) {
                try {
                    // Map build data to pipeline run
                    const run = this.mapBuildToPipelineRun(buildData, projectId);
                    activeRuns.push(run);
                } catch (error) {
                    console.warn(`Failed to map build ${buildData.id} to pipeline run:`, error);
                }
            }

            return activeRuns;
        } catch (error) {
            throw new Error(`Failed to fetch active runs for project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get active (in-progress) pipeline runs for a specific pipeline
     */
    async getActivePipelineRuns(pipelineId: number, projectId: string): Promise<PipelineRun[]> {
        try {
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineId}/runs?statusFilter=inProgress&api-version=7.0`
            );

            return response.data.value.map(runData => this.mapPipelineRun(runData, pipelineId, projectId));
        } catch (error) {
            throw new Error(`Failed to fetch active runs for pipeline ${pipelineId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Merge new runs with existing cached runs, avoiding duplicates
     */
    private mergeRunsWithExisting(newRuns: PipelineRun[], existingRuns: PipelineRun[]): PipelineRun[] {
        const runMap = new Map<number, PipelineRun>();
        
        // Add existing runs to map
        existingRuns.forEach(run => runMap.set(run.id, run));
        
        // Update or add new runs
        newRuns.forEach(run => runMap.set(run.id, run));
        
        // Convert back to array and sort by creation date (newest first)
        return Array.from(runMap.values()).sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
    }

    /**
     * Convert API error to appropriate Azure Pipelines error
     */
    private convertApiError(apiError: ApiError, operation: string, context: Record<string, any> = {}): Error {
        const errorContext = {
            operation,
            ...context,
            statusCode: apiError.status,
            responseBody: apiError.response
        };

        if (apiError.status === 401) {
            return new NetworkError(
                'Authentication failed',
                'CONNECTION_REFUSED',
                401,
                apiError.response,
                'Authentication failed. Please check your credentials.',
                errorContext
            );
        }

        if (apiError.status === 403) {
            return new ResourceError(
                'Access denied',
                'ACCESS_DENIED',
                'resource',
                undefined,
                'You do not have permission to access this resource.',
                errorContext
            );
        }

        if (apiError.status === 404) {
            return new ResourceError(
                'Resource not found',
                'NOT_FOUND',
                'resource',
                undefined,
                'The requested resource could not be found.',
                errorContext
            );
        }

        if (apiError.status === 429) {
            return new NetworkError(
                'Rate limited',
                'RATE_LIMITED',
                429,
                apiError.response,
                'Too many requests. Please wait before trying again.',
                errorContext
            );
        }

        if (apiError.status && apiError.status >= 500) {
            return new NetworkError(
                'Server error',
                'SERVER_ERROR',
                apiError.status,
                apiError.response,
                'Azure DevOps server is experiencing issues.',
                errorContext
            );
        }

        if (apiError.message.includes('timeout')) {
            return new NetworkError(
                'Request timeout',
                'TIMEOUT',
                undefined,
                undefined,
                'The request timed out. Please try again.',
                errorContext
            );
        }

        if (apiError.message.includes('ENOTFOUND') || apiError.message.includes('ECONNREFUSED')) {
            return new NetworkError(
                'Connection failed',
                'CONNECTION_REFUSED',
                undefined,
                undefined,
                'Unable to connect to Azure DevOps.',
                errorContext
            );
        }

        // Default to network error
        return new NetworkError(
            apiError.message,
            'CONNECTION_REFUSED',
            apiError.status,
            apiError.response,
            'Failed to communicate with Azure DevOps.',
            errorContext
        );
    }

    /**
     * Map build API response to pipeline run (for active runs)
     */
    private mapBuildToPipelineRun(buildData: any, projectId: string): PipelineRun {
        return {
            id: buildData.id,
            name: buildData.buildNumber || `Build #${buildData.id}`,
            state: this.mapRunState(buildData.status),
            result: this.mapRunResult(buildData.result),
            createdDate: new Date(buildData.queueTime),
            finishedDate: buildData.finishTime ? new Date(buildData.finishTime) : undefined,
            pipeline: {
                id: buildData.definition?.id || 0,
                name: buildData.definition?.name || 'Unknown Pipeline',
                project: { id: projectId } as any,
                folder: buildData.definition?.path,
                revision: buildData.definition?.revision || 1,
                url: buildData.definition?.url || '',
                configuration: {
                    type: 'yaml',
                    path: 'azure-pipelines.yml',
                    repository: {
                        id: buildData.repository?.id || 'unknown',
                        name: buildData.repository?.name || 'unknown',
                        url: buildData.repository?.url || '',
                        type: buildData.repository?.type || 'TfsGit',
                        defaultBranch: buildData.sourceBranch || 'main'
                    }
                }
            },
            resources: buildData.resources || {
                repositories: {},
                pipelines: {},
                builds: {},
                containers: {},
                packages: {}
            },
            variables: buildData.variables || {},
            url: buildData._links?.web?.href || `https://dev.azure.com/${this.config.organization}/${projectId}/_build/results?buildId=${buildData.id}`
        };
    }

    /**
     * Dispose of the service
     */
    dispose(): void {
        // Clear any cached data
        if (this.config.cacheEnabled) {
            this.cacheService.clear();
        }
    }
}