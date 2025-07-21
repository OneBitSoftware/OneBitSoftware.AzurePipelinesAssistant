/**
 * Common types and interfaces used across Azure DevOps models
 */

export interface Repository {
  id: string;
  name: string;
  url: string;
  type: 'TfsGit' | 'GitHub' | 'Bitbucket' | 'Subversion';
  defaultBranch: string;
}

export interface Variable {
  value: string;
  isSecret: boolean;
  allowOverride?: boolean;
}

export interface RunResources {
  repositories: Record<string, Repository>;
  pipelines: Record<string, any>;
  builds: Record<string, any>;
  containers: Record<string, any>;
  packages: Record<string, any>;
}

export interface LogReference {
  id: number;
  type: string;
  url: string;
}

export interface Issue {
  type: 'error' | 'warning';
  category: string;
  message: string;
  data?: Record<string, any>;
}

export interface TimelineRecord {
  id: string;
  parentId?: string;
  type: string;
  name: string;
  startTime?: Date;
  finishTime?: Date;
  currentOperation?: string;
  percentComplete?: number;
  state: 'pending' | 'inProgress' | 'completed';
  result?: 'succeeded' | 'failed' | 'canceled' | 'skipped' | 'abandoned';
  resultCode?: string;
  changeId: number;
  lastModified: Date;
  workerName?: string;
  queueId?: number;
  order?: number;
  details?: TimelineReference;
  errorCount: number;
  warningCount: number;
  url?: string;
  log?: LogReference;
  task?: TaskReference;
  attempt: number;
  identifier?: string;
}

export interface TimelineReference {
  id: string;
  changeId: number;
  url: string;
}

export interface TaskReference {
  id: string;
  name: string;
  version: string;
}

export type PipelineState = 'completed' | 'inProgress' | 'cancelling' | 'cancelled';
export type PipelineResult = 'succeeded' | 'failed' | 'canceled' | 'abandoned' | 'partiallySucceeded';
export type ProjectVisibility = 'private' | 'public';
export type ProjectState = 'wellFormed' | 'createPending' | 'deleting' | 'new';