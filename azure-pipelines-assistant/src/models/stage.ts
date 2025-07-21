import { PipelineState, PipelineResult } from './common';
import { Job } from './job';

/**
 * Represents a stage in a pipeline run
 */
export interface Stage {
  /** Unique identifier for the stage */
  id: string;
  
  /** Internal name of the stage */
  name: string;
  
  /** Display name of the stage */
  displayName: string;
  
  /** Current state of the stage */
  state: PipelineState;
  
  /** Result of the stage (if completed) */
  result?: PipelineResult;
  
  /** When the stage started */
  startTime?: Date;
  
  /** When the stage finished */
  finishTime?: Date;
  
  /** Jobs within this stage */
  jobs: Job[];
  
  /** Stages this stage depends on */
  dependsOn: string[];
  
  /** Condition for running this stage */
  condition?: string;
  
  /** Variables defined at stage level */
  variables?: Record<string, {
    value: string;
    isSecret?: boolean;
  }>;
  
  /** Environment this stage deploys to */
  environment?: {
    id: number;
    name: string;
    description?: string;
  };
  
  /** Approval information */
  approvals?: Array<{
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'skipped';
    approver: {
      id: string;
      displayName: string;
      uniqueName: string;
    };
    approvedDate?: Date;
    comment?: string;
  }>;
  
  /** Checks that must pass before stage runs */
  checks?: Array<{
    id: string;
    name: string;
    status: 'pending' | 'inProgress' | 'completed';
    result?: 'succeeded' | 'failed' | 'canceled';
    message?: string;
  }>;
  
  /** Stage attempt number */
  attempt?: number;
  
  /** Identifier for the stage in the pipeline definition */
  identifier?: string;
  
  /** Order of execution */
  order?: number;
  
  /** Parent stage ID (for nested stages) */
  parentStageId?: string;
  
  /** Type of stage */
  type?: 'build' | 'deployment' | 'approval' | 'agentless';
  
  /** Agent pool information */
  pool?: {
    id: number;
    name: string;
    isHosted: boolean;
  };
  
  /** Demands for agent capabilities */
  demands?: string[];
  
  /** Timeout in minutes */
  timeoutInMinutes?: number;
  
  /** Cancel timeout in minutes */
  cancelTimeoutInMinutes?: number;
  
  /** Strategy information */
  strategy?: {
    runOnce?: any;
    rolling?: any;
    canary?: any;
  };
}