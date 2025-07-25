import { Pipeline } from './pipeline';
import { Stage } from './stage';
import { Variable, RunResources, PipelineState, PipelineResult, TimelineRecord, LogReference } from './common';

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
    stages: Stage[];
    timeline?: TimelineRecord[];
    logs?: LogReference[];
}

/**
 * Parameters for triggering a pipeline run
 */
export interface RunParameters {
    sourceBranch?: string;
    variables?: Record<string, string>;
    templateParameters?: Record<string, any>;
}