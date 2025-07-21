import { PipelineState, PipelineResult, LogReference, Issue } from './common';

/**
 * Represents a task within a pipeline job
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;
  
  /** Internal name of the task */
  name: string;
  
  /** Display name of the task */
  displayName: string;
  
  /** Current state of the task */
  state: PipelineState;
  
  /** Result of the task (if completed) */
  result?: PipelineResult;
  
  /** When the task started */
  startTime?: Date;
  
  /** When the task finished */
  finishTime?: Date;
  
  /** Task definition information */
  task: TaskDefinition;
  
  /** Input parameters for the task */
  inputs?: Record<string, string>;
  
  /** Environment variables */
  environment?: Record<string, string>;
  
  /** Condition for running this task */
  condition?: string;
  
  /** Continue on error flag */
  continueOnError?: boolean;
  
  /** Task is enabled */
  enabled?: boolean;
  
  /** Timeout in minutes */
  timeoutInMinutes?: number;
  
  /** Retry count on failure */
  retryCountOnTaskFailure?: number;
  
  /** Task attempt number */
  attempt?: number;
  
  /** Order of execution within the job */
  order?: number;
  
  /** Log reference for task output */
  log?: LogReference;
  
  /** Issues encountered during task execution */
  issues?: Issue[];
  
  /** Task execution details */
  details?: {
    /** Percentage complete */
    percentComplete?: number;
    
    /** Current operation */
    currentOperation?: string;
    
    /** Worker name */
    workerName?: string;
    
    /** Queue ID */
    queueId?: number;
  };
  
  /** Error count */
  errorCount?: number;
  
  /** Warning count */
  warningCount?: number;
  
  /** URL to the task details */
  url?: string;
  
  /** Reference to parent timeline record */
  parentId?: string;
  
  /** Task type */
  type?: string;
  
  /** Result code */
  resultCode?: string;
  
  /** Change ID for tracking modifications */
  changeId?: number;
  
  /** Last modified timestamp */
  lastModified?: Date;
}

/**
 * Task definition information
 */
export interface TaskDefinition {
  /** Task definition ID */
  id: string;
  
  /** Task name */
  name: string;
  
  /** Task version */
  version: string;
  
  /** Task display name */
  displayName?: string;
  
  /** Task description */
  description?: string;
  
  /** Task category */
  category?: string;
  
  /** Task author */
  author?: string;
  
  /** Task icon URL */
  iconUrl?: string;
  
  /** Task help URL */
  helpUrl?: string;
  
  /** Task visibility */
  visibility?: string[];
  
  /** Task demands */
  demands?: string[];
  
  /** Task groups */
  groups?: Array<{
    name: string;
    displayName: string;
    isExpanded?: boolean;
  }>;
  
  /** Task inputs definition */
  inputs?: Array<{
    name: string;
    label: string;
    type: string;
    defaultValue?: string;
    required?: boolean;
    helpMarkDown?: string;
    groupName?: string;
    visibleRule?: string;
    properties?: Record<string, any>;
    options?: Record<string, string>;
  }>;
  
  /** Task output variables */
  outputVariables?: Array<{
    name: string;
    description: string;
  }>;
  
  /** Execution information */
  execution?: Record<string, any>;
  
  /** Pre-job execution */
  prejobExecution?: Record<string, any>;
  
  /** Post-job execution */
  postjobExecution?: Record<string, any>;
}