import { IAzureDevOpsService, LogEntry, AzureDevOpsServiceConfig } from '../interfaces/azureDevOpsService';
import { Project, Pipeline, PipelineRun, PipelineRunDetails, RunParameters } from '../models';
import { ICacheService } from '../interfaces/cacheService';
import { IApiClient } from '../interfaces/apiClient';

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

        try {
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/_apis/projects?api-version=7.0`
            );

            const projects: Project[] = response.data.value.map(this.mapProject);

            if (this.config.cacheEnabled) {
                this.cacheService.setCachedProjects(projects);
            }

            return projects;
        } catch (error) {
            throw new Error(`Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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

        try {
            const response = await this.apiClient.get<{ value: any[] }>(
                `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines?api-version=7.0`
            );

            const pipelines: Pipeline[] = await Promise.all(
                response.data.value.map(async (pipelineData) => {
                    // Get additional pipeline details
                    const detailResponse = await this.apiClient.get<any>(
                        `https://dev.azure.com/${this.config.organization}/${projectId}/_apis/pipelines/${pipelineData.id}?api-version=7.0`
                    );
                    return this.mapPipeline(detailResponse.data, projectId);
                })
            );

            if (this.config.cacheEnabled) {
                this.cacheService.setCachedPipelines(projectId, pipelines);
            }

            return pipelines;
        } catch (error) {
            throw new Error(`Failed to fetch pipelines for project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
}