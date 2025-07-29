import { Project, Pipeline, PipelineRun, PipelineRunDetails, RunParameters, LogEntry } from '../models';

/**
 * Interface for Azure DevOps service operations
 */
export interface IAzureDevOpsService {
    // Project and Pipeline Management
    
    /**
     * Get all projects accessible to the authenticated user
     * @returns Promise resolving to array of projects
     */
    getProjects(): Promise<Project[]>;

    /**
     * Get all pipelines for a specific project
     * @param projectId Project ID or name
     * @returns Promise resolving to array of pipelines
     */
    getPipelines(projectId: string): Promise<Pipeline[]>;

    /**
     * Get pipeline runs for a specific pipeline
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param top Maximum number of runs to return (optional)
     * @returns Promise resolving to array of pipeline runs
     */
    getPipelineRuns(pipelineId: number, projectId: string, top?: number): Promise<PipelineRun[]>;

    // Run Management
    
    /**
     * Trigger a new pipeline run
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param parameters Run parameters (branch, variables, etc.)
     * @returns Promise resolving to the created pipeline run
     */
    triggerPipelineRun(pipelineId: number, projectId: string, parameters?: RunParameters): Promise<PipelineRun>;

    /**
     * Get detailed information about a specific pipeline run
     * @param runId Run ID
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @returns Promise resolving to detailed run information
     */
    getRunDetails(runId: number, pipelineId: number, projectId: string): Promise<PipelineRunDetails>;

    /**
     * Cancel a running pipeline
     * @param runId Run ID
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @returns Promise resolving when cancellation is complete
     */
    cancelRun(runId: number, pipelineId: number, projectId: string): Promise<void>;

    // Logs and Artifacts
    
    /**
     * Get logs for a specific pipeline run
     * @param runId Run ID
     * @param projectId Project ID or name
     * @returns Promise resolving to log entries
     */
    getRunLogs(runId: number, projectId: string): Promise<LogEntry[]>;

    /**
     * Download artifacts from a pipeline run
     * @param runId Run ID
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param downloadPath Local path to download artifacts
     * @param artifactName Optional specific artifact name
     * @returns Promise resolving to download path
     */
    downloadArtifacts(runId: number, pipelineId: number, projectId: string, downloadPath: string, artifactName?: string): Promise<string>;

    /**
     * Trigger a pipeline run (alias for triggerPipelineRun)
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param parameters Optional run parameters
     * @returns Promise resolving to the created pipeline run
     */
    triggerRun(pipelineId: number, projectId: string, parameters?: RunParameters): Promise<PipelineRun>;

    /**
     * Get logs for a specific job or task
     * @param runId Run ID
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param jobId Optional job ID
     * @param taskId Optional task ID
     * @returns Promise resolving to log entries
     */
    getLogs(runId: number, pipelineId: number, projectId: string, jobId?: string, taskId?: string): Promise<LogEntry[]>;

    // Cache Management
    
    /**
     * Refresh cached data for a specific project
     * @param projectId Project ID or name
     * @returns Promise resolving when refresh is complete
     */
    refreshProject(projectId: string): Promise<void>;

    /**
     * Refresh cached data for a specific pipeline
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @returns Promise resolving when refresh is complete
     */
    refreshPipeline(pipelineId: number, projectId: string): Promise<void>;

    /**
     * Clear all cached data
     * @returns Promise resolving when cache is cleared
     */
    clearCache(): Promise<void>;

    // Real-time Updates and Incremental Fetching

    /**
     * Get pipeline runs with incremental fetching support
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param since Optional timestamp to fetch only runs modified since this time
     * @param top Maximum number of runs to return (optional)
     * @returns Promise resolving to array of pipeline runs
     */
    getPipelineRunsIncremental(pipelineId: number, projectId: string, since?: Date, top?: number): Promise<PipelineRun[]>;

    /**
     * Get run details with change detection
     * @param runId Run ID
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @param lastModified Optional timestamp for change detection
     * @returns Promise resolving to detailed run information with change indicator
     */
    getRunDetailsWithChangeDetection(runId: number, pipelineId: number, projectId: string, lastModified?: Date): Promise<{ run: PipelineRunDetails; hasChanged: boolean }>;

    /**
     * Get active (in-progress) pipeline runs across all pipelines in a project
     * @param projectId Project ID or name
     * @returns Promise resolving to array of active pipeline runs
     */
    getActiveRuns(projectId: string): Promise<PipelineRun[]>;

    /**
     * Get active (in-progress) pipeline runs for a specific pipeline
     * @param pipelineId Pipeline ID
     * @param projectId Project ID or name
     * @returns Promise resolving to array of active pipeline runs
     */
    getActivePipelineRuns(pipelineId: number, projectId: string): Promise<PipelineRun[]>;
}



/**
 * Service configuration interface
 */
export interface AzureDevOpsServiceConfig {
    organization: string;
    personalAccessToken: string;
    maxRetries?: number;
    retryDelay?: number;
    cacheEnabled?: boolean;
    cacheTtl?: number;
}