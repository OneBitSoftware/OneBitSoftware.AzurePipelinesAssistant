import { PipelineState, PipelineResult } from './common';
import { Task } from './task';

/**
 * Represents a job within a pipeline stage
 */
export interface Job {
    /** Unique identifier for the job */
    id: string;

    /** Internal name of the job */
    name: string;

    /** Display name of the job */
    displayName: string;

    /** Current state of the job */
    state: PipelineState;

    /** Result of the job (if completed) */
    result?: PipelineResult;

    /** When the job started */
    startTime?: Date;

    /** When the job finished */
    finishTime?: Date;

    /** Name of the agent that ran the job */
    agentName?: string;

    /** Tasks within this job */
    tasks: Task[];

    /** Jobs this job depends on */
    dependsOn?: string[];

    /** Condition for running this job */
    condition?: string;

    /** Continue on error flag */
    continueOnError?: boolean;

    /** Variables defined at job level */
    variables?: Record<string, {
        value: string;
        isSecret?: boolean;
    }>;

    /** Strategy for the job */
    strategy?: {
        matrix?: Record<string, Record<string, string>>;
        maxParallel?: number;
        parallel?: number;
    };

    /** Agent pool information */
    pool?: {
        id: number;
        name: string;
        isHosted: boolean;
        vmImage?: string;
    };

    /** Container information */
    container?: {
        image: string;
        options?: string;
        endpoint?: string;
        env?: Record<string, string>;
        ports?: string[];
        volumes?: string[];
    };

    /** Services (sidecar containers) */
    services?: Record<string, {
        image: string;
        options?: string;
        endpoint?: string;
        env?: Record<string, string>;
        ports?: string[];
        volumes?: string[];
    }>;

    /** Workspace settings */
    workspace?: {
        clean: 'outputs' | 'resources' | 'all';
    };

    /** Demands for agent capabilities */
    demands?: string[];

    /** Timeout in minutes */
    timeoutInMinutes?: number;

    /** Cancel timeout in minutes */
    cancelTimeoutInMinutes?: number;

    /** Job attempt number */
    attempt?: number;

    /** Identifier for the job in the pipeline definition */
    identifier?: string;

    /** Order of execution within the stage */
    order?: number;

    /** Type of job */
    type?: 'job' | 'deployment';

    /** Queue time */
    queueTime?: Date;

    /** Agent request information */
    agentSpecification?: {
        identifier: string;
    };

    /** Error count */
    errorCount?: number;

    /** Warning count */
    warningCount?: number;

    /** URL to the job details */
    url?: string;
}