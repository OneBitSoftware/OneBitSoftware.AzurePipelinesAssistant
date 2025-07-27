import { PipelineRunDetails, Stage, Job, Task } from './index';

/**
 * Comparison data for two pipeline runs
 */
export interface RunComparison {
  /** The two runs being compared */
  runs: [PipelineRunDetails, PipelineRunDetails];
  
  /** Overall comparison metrics */
  metrics: ComparisonMetrics;
  
  /** Stage-by-stage comparison */
  stageComparisons: StageComparison[];
  
  /** Job-by-job comparison */
  jobComparisons: JobComparison[];
  
  /** Task-by-task comparison */
  taskComparisons: TaskComparison[];
  
  /** Summary of differences */
  summary: ComparisonSummary;
}

/**
 * Overall metrics comparing two runs
 */
export interface ComparisonMetrics {
  /** Duration comparison */
  duration: {
    run1: number; // milliseconds
    run2: number; // milliseconds
    difference: number; // positive means run2 was longer
    percentageChange: number; // percentage change from run1 to run2
  };
  
  /** Success rate comparison */
  successRate: {
    run1: number; // percentage of successful stages/jobs/tasks
    run2: number;
    difference: number;
  };
  
  /** Stage count comparison */
  stageCount: {
    run1: number;
    run2: number;
    difference: number;
  };
  
  /** Job count comparison */
  jobCount: {
    run1: number;
    run2: number;
    difference: number;
  };
  
  /** Task count comparison */
  taskCount: {
    run1: number;
    run2: number;
    difference: number;
  };
  
  /** Error and warning counts */
  issues: {
    run1: { errors: number; warnings: number };
    run2: { errors: number; warnings: number };
    errorDifference: number;
    warningDifference: number;
  };
}

/**
 * Comparison between two stages
 */
export interface StageComparison {
  /** Stage identifier */
  stageId: string;
  
  /** Stage name */
  stageName: string;
  
  /** Stage data from both runs (null if stage doesn't exist in that run) */
  stage1: Stage | null;
  stage2: Stage | null;
  
  /** Comparison status */
  status: ComparisonStatus;
  
  /** Duration comparison */
  duration: {
    run1: number | null;
    run2: number | null;
    difference: number | null;
    percentageChange: number | null;
  };
  
  /** Result comparison */
  result: {
    run1: string | null;
    run2: string | null;
    changed: boolean;
  };
  
  /** Job comparisons within this stage */
  jobComparisons: JobComparison[];
}

/**
 * Comparison between two jobs
 */
export interface JobComparison {
  /** Job identifier */
  jobId: string;
  
  /** Job name */
  jobName: string;
  
  /** Stage this job belongs to */
  stageId: string;
  
  /** Job data from both runs */
  job1: Job | null;
  job2: Job | null;
  
  /** Comparison status */
  status: ComparisonStatus;
  
  /** Duration comparison */
  duration: {
    run1: number | null;
    run2: number | null;
    difference: number | null;
    percentageChange: number | null;
  };
  
  /** Result comparison */
  result: {
    run1: string | null;
    run2: string | null;
    changed: boolean;
  };
  
  /** Agent comparison */
  agent: {
    run1: string | null;
    run2: string | null;
    changed: boolean;
  };
  
  /** Task comparisons within this job */
  taskComparisons: TaskComparison[];
}

/**
 * Comparison between two tasks
 */
export interface TaskComparison {
  /** Task identifier */
  taskId: string;
  
  /** Task name */
  taskName: string;
  
  /** Job this task belongs to */
  jobId: string;
  
  /** Stage this task belongs to */
  stageId: string;
  
  /** Task data from both runs */
  task1: Task | null;
  task2: Task | null;
  
  /** Comparison status */
  status: ComparisonStatus;
  
  /** Duration comparison */
  duration: {
    run1: number | null;
    run2: number | null;
    difference: number | null;
    percentageChange: number | null;
  };
  
  /** Result comparison */
  result: {
    run1: string | null;
    run2: string | null;
    changed: boolean;
  };
  
  /** Error and warning count comparison */
  issues: {
    run1: { errors: number; warnings: number };
    run2: { errors: number; warnings: number };
    errorDifference: number;
    warningDifference: number;
  };
}

/**
 * Status of a comparison item
 */
export enum ComparisonStatus {
  /** Item exists in both runs */
  BOTH = 'both',
  
  /** Item only exists in first run */
  ONLY_FIRST = 'only_first',
  
  /** Item only exists in second run */
  ONLY_SECOND = 'only_second',
  
  /** Item exists in both but has differences */
  DIFFERENT = 'different',
  
  /** Item exists in both and is identical */
  IDENTICAL = 'identical'
}

/**
 * Summary of comparison results
 */
export interface ComparisonSummary {
  /** Overall assessment */
  overallChange: 'improved' | 'degraded' | 'mixed' | 'identical';
  
  /** Key improvements */
  improvements: string[];
  
  /** Key regressions */
  regressions: string[];
  
  /** New items in second run */
  newItems: {
    stages: string[];
    jobs: string[];
    tasks: string[];
  };
  
  /** Removed items from first run */
  removedItems: {
    stages: string[];
    jobs: string[];
    tasks: string[];
  };
  
  /** Performance changes */
  performanceChanges: {
    fasterStages: string[];
    slowerStages: string[];
    fasterJobs: string[];
    slowerJobs: string[];
  };
  
  /** Quality changes */
  qualityChanges: {
    fewerErrors: string[];
    moreErrors: string[];
    fewerWarnings: string[];
    moreWarnings: string[];
  };
}

/**
 * Export format options for comparison reports
 */
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  HTML = 'html',
  MARKDOWN = 'markdown'
}

/**
 * Export configuration for comparison reports
 */
export interface ExportConfig {
  /** Export format */
  format: ExportFormat;
  
  /** Include detailed task comparisons */
  includeTaskDetails: boolean;
  
  /** Include timing charts */
  includeCharts: boolean;
  
  /** Include summary only */
  summaryOnly: boolean;
  
  /** Custom title for the report */
  title?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Selection criteria for runs to compare
 */
export interface RunSelectionCriteria {
  /** Pipeline ID */
  pipelineId: number;
  
  /** Project ID */
  projectId: string;
  
  /** Maximum number of runs to show for selection */
  maxRuns?: number;
  
  /** Filter by result */
  resultFilter?: ('succeeded' | 'failed' | 'canceled' | 'abandoned')[];
  
  /** Filter by date range */
  dateRange?: {
    from: Date;
    to: Date;
  };
  
  /** Filter by branch */
  branchFilter?: string;
}