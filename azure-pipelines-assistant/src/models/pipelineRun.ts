import { Pipeline } from './pipeline';
import { Variable, RunResources, PipelineState, PipelineResult } from './common';

/**
 * Azure DevOps Pipeline Run model
 */
export interface PipelineRun {
    id: number;
    name: string;
    state: PipelineState;
    result?: PipelineResult;
    createdDate: Date;
    finishedDate?: Date;
    pipeline: Pipeline;
    resources: RunResources;
    variables: Record<string, Variable>;
    url: string;
}

/**
 * Extended pipeline run details with additional information
 */
export interface PipelineRunDetails extends PipelineRun {
    stages: any[]; // Will be properly typed when Stage model is implemented
    timeline: any[]; // Will be properly typed when TimelineRecord is implemented
    logs: any[]; // Will be properly typed when LogReference is implemented
}

/**
 * Parameters for triggering a pipeline run
 */
export interface RunParameters {
    sourceBranch?: string;
    variables?: Record<string, string>;
    templateParameters?: Record<string, any>;
}