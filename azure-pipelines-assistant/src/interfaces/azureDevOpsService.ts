import { Project, Pipeline, PipelineRun, PipelineRunDetails, RunParameters } from '../models';

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
     * @param projectId Project ID or name
     * @param artifactName Optional specific artifact name
     * @returns Promise resolving to artifact data
     */
    downloadArtifacts(runId: number, projectId: string, artifactName?: string): Promise<Blob>;

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
}

/**
 * Log entry interface for pipeline logs
 */
export interface LogEntry {
    id: number;
    timestamp: Date;
    level: 'debug' | 'info' | 'warning' | 'error';
    message: string;
    source?: string;
    lineNumber?: number;
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