import * as vscode from 'vscode';
import { Project, Pipeline, PipelineRun, Stage, Job, Task } from './index';

/**
 * Tree item types for the Azure Pipelines explorer
 */
export type TreeItemType = 'project' | 'pipeline' | 'run' | 'stage' | 'job' | 'task' | 'loading' | 'error';

/**
 * Base interface for all tree items in the Azure Pipelines explorer
 */
export interface IAzurePipelinesTreeItem extends vscode.TreeItem {
  /** Type of tree item */
  readonly itemType: TreeItemType;
  
  /** Unique identifier for the tree item */
  readonly id: string;
  
  /** Parent item reference */
  parent?: IAzurePipelinesTreeItem;
  
  /** Whether this item has children */
  hasChildren: boolean;
  
  /** Context value for commands */
  contextValue: string;
  
  /** Tooltip text */
  tooltip?: string | vscode.MarkdownString;
  
  /** Description text */
  description?: string;
  
  /** Icon path or theme icon */
  iconPath?: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon;
  
  /** Command to execute when item is clicked */
  command?: vscode.Command;
  
  /** Resource URI */
  resourceUri?: vscode.Uri;
}

/**
 * Project tree item
 */
export class ProjectTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'project';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = true;
  readonly contextValue: string = 'project';
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(public readonly data: Project) {
    this.id = `project-${data.id}`;
    this.label = data.name;
    this.tooltip = new vscode.MarkdownString(`**${data.name}**\n\nProject ID: ${data.id}\nURL: ${data.url}`);
    this.description = data.description || '';
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

/**
 * Pipeline tree item
 */
export class PipelineTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'pipeline';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = true;
  readonly contextValue: string = 'pipeline';
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(public readonly data: Pipeline) {
    this.id = `pipeline-${data.id}`;
    this.label = data.name;
    this.tooltip = new vscode.MarkdownString(
      `**${data.name}**\n\n` +
      `Pipeline ID: ${data.id}\n` +
      `Type: ${data.configuration.type}\n` +
      `Path: ${data.configuration.path}\n` +
      `Repository: ${data.configuration.repository.name}`
    );
    this.description = data.folder || '';
    this.iconPath = new vscode.ThemeIcon('symbol-method');
    this.command = {
      command: 'azurePipelinesAssistant.viewInBrowser',
      title: 'Open Pipeline',
      arguments: [this]
    };
  }
}

/**
 * Pipeline run tree item
 */
export class PipelineRunTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'run';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = true;
  readonly contextValue: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(public readonly data: PipelineRun) {
    this.id = `run-${data.id}`;
    this.label = `#${data.id} - ${data.name}`;
    this.contextValue = `run-${data.state}`;
    
    // Set icon based on state and result
    this.iconPath = this.getRunIcon(data.state, data.result);
    
    // Format dates
    const createdDate = data.createdDate.toLocaleString();
    const finishedDate = data.finishedDate?.toLocaleString() || 'In progress';
    
    this.tooltip = new vscode.MarkdownString(
      `**Run #${data.id}**\n\n` +
      `State: ${data.state}\n` +
      `Result: ${data.result || 'N/A'}\n` +
      `Created: ${createdDate}\n` +
      `Finished: ${finishedDate}`
    );
    
    this.description = `${data.state} - ${createdDate}`;
    
    this.command = {
      command: 'azurePipelinesAssistant.viewRunDetails',
      title: 'Open Run',
      arguments: [this]
    };
  }
  
  private getRunIcon(state: string, result?: string): vscode.ThemeIcon {
    if (state === 'completed') {
      switch (result) {
        case 'succeeded':
          return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        case 'failed':
          return new vscode.ThemeIcon('x', new vscode.ThemeColor('testing.iconFailed'));
        case 'canceled':
          return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('testing.iconSkipped'));
        case 'partiallySucceeded':
          return new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconQueued'));
        default:
          return new vscode.ThemeIcon('question');
      }
    } else if (state === 'inProgress') {
      return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
    } else {
      return new vscode.ThemeIcon('clock');
    }
  }
}

/**
 * Stage tree item
 */
export class StageTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'stage';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = true;
  readonly contextValue: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(public readonly data: Stage) {
    this.id = `stage-${data.id}`;
    this.label = data.displayName || data.name;
    this.contextValue = `stage-${data.state}`;
    
    // Set icon based on state and result
    this.iconPath = this.getStageIcon(data.state, data.result);
    
    // Format times
    const startTime = data.startTime?.toLocaleString() || 'Not started';
    const finishTime = data.finishTime?.toLocaleString() || 'In progress';
    
    this.tooltip = new vscode.MarkdownString(
      `**${data.displayName || data.name}**\n\n` +
      `State: ${data.state}\n` +
      `Result: ${data.result || 'N/A'}\n` +
      `Started: ${startTime}\n` +
      `Finished: ${finishTime}\n` +
      `Jobs: ${data.jobs.length}`
    );
    
    this.description = `${data.state} - ${data.jobs.length} jobs`;
    
    this.command = {
      command: 'azurePipelinesAssistant.viewRunDetails',
      title: 'Open Stage',
      arguments: [this]
    };
  }
  
  private getStageIcon(state: string, result?: string): vscode.ThemeIcon {
    if (state === 'completed') {
      switch (result) {
        case 'succeeded':
          return new vscode.ThemeIcon('layers', new vscode.ThemeColor('testing.iconPassed'));
        case 'failed':
          return new vscode.ThemeIcon('layers', new vscode.ThemeColor('testing.iconFailed'));
        case 'canceled':
          return new vscode.ThemeIcon('layers', new vscode.ThemeColor('testing.iconSkipped'));
        case 'partiallySucceeded':
          return new vscode.ThemeIcon('layers', new vscode.ThemeColor('testing.iconQueued'));
        default:
          return new vscode.ThemeIcon('layers');
      }
    } else if (state === 'inProgress') {
      return new vscode.ThemeIcon('layers', new vscode.ThemeColor('testing.iconQueued'));
    } else {
      return new vscode.ThemeIcon('layers');
    }
  }
}/**

 * Job tree item
 */
export class JobTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'job';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = true;
  readonly contextValue: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(public readonly data: Job) {
    this.id = `job-${data.id}`;
    this.label = data.displayName || data.name;
    this.contextValue = `job-${data.state}`;
    
    // Set icon based on state and result
    this.iconPath = this.getJobIcon(data.state, data.result);
    
    // Format times
    const startTime = data.startTime?.toLocaleString() || 'Not started';
    const finishTime = data.finishTime?.toLocaleString() || 'In progress';
    const duration = this.calculateDuration(data.startTime, data.finishTime);
    
    this.tooltip = new vscode.MarkdownString(
      `**${data.displayName || data.name}**\n\n` +
      `State: ${data.state}\n` +
      `Result: ${data.result || 'N/A'}\n` +
      `Agent: ${data.agentName || 'N/A'}\n` +
      `Started: ${startTime}\n` +
      `Finished: ${finishTime}\n` +
      `Duration: ${duration}\n` +
      `Tasks: ${data.tasks.length}\n` +
      `Errors: ${data.errorCount || 0}\n` +
      `Warnings: ${data.warningCount || 0}`
    );
    
    this.description = `${data.state} - ${data.tasks.length} tasks`;
    
    this.command = {
      command: 'azurePipelinesAssistant.viewLogs',
      title: 'Open Job',
      arguments: [this]
    };
  }
  
  private getJobIcon(state: string, result?: string): vscode.ThemeIcon {
    if (state === 'completed') {
      switch (result) {
        case 'succeeded':
          return new vscode.ThemeIcon('gear', new vscode.ThemeColor('testing.iconPassed'));
        case 'failed':
          return new vscode.ThemeIcon('gear', new vscode.ThemeColor('testing.iconFailed'));
        case 'canceled':
          return new vscode.ThemeIcon('gear', new vscode.ThemeColor('testing.iconSkipped'));
        case 'partiallySucceeded':
          return new vscode.ThemeIcon('gear', new vscode.ThemeColor('testing.iconQueued'));
        default:
          return new vscode.ThemeIcon('gear');
      }
    } else if (state === 'inProgress') {
      return new vscode.ThemeIcon('gear', new vscode.ThemeColor('testing.iconQueued'));
    } else {
      return new vscode.ThemeIcon('gear');
    }
  }
  
  private calculateDuration(startTime?: Date, finishTime?: Date): string {
    if (!startTime) {
      return 'N/A';
    }
    
    const end = finishTime || new Date();
    const durationMs = end.getTime() - startTime.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Task tree item
 */
export class TaskTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'task';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = false;
  readonly contextValue: string;
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(public readonly data: Task) {
    this.id = `task-${data.id}`;
    this.label = data.displayName || data.name;
    this.contextValue = `task-${data.state}`;
    
    // Set icon based on state and result
    this.iconPath = this.getTaskIcon(data.state, data.result);
    
    // Format times
    const startTime = data.startTime?.toLocaleString() || 'Not started';
    const finishTime = data.finishTime?.toLocaleString() || 'In progress';
    const duration = this.calculateDuration(data.startTime, data.finishTime);
    
    this.tooltip = new vscode.MarkdownString(
      `**${data.displayName || data.name}**\n\n` +
      `Task: ${data.task.name}@${data.task.version}\n` +
      `State: ${data.state}\n` +
      `Result: ${data.result || 'N/A'}\n` +
      `Started: ${startTime}\n` +
      `Finished: ${finishTime}\n` +
      `Duration: ${duration}\n` +
      `Errors: ${data.errorCount || 0}\n` +
      `Warnings: ${data.warningCount || 0}\n` +
      `Enabled: ${data.enabled !== false ? 'Yes' : 'No'}\n` +
      `Continue on Error: ${data.continueOnError ? 'Yes' : 'No'}`
    );
    
    this.description = `${data.state} - ${duration}`;
    
    this.command = {
      command: 'azurePipelinesAssistant.viewLogs',
      title: 'Open Task',
      arguments: [this]
    };
  }
  
  private getTaskIcon(state: string, result?: string): vscode.ThemeIcon {
    if (state === 'completed') {
      switch (result) {
        case 'succeeded':
          return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        case 'failed':
          return new vscode.ThemeIcon('x', new vscode.ThemeColor('testing.iconFailed'));
        case 'canceled':
          return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('testing.iconSkipped'));
        case 'partiallySucceeded':
          return new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconQueued'));
        case 'skipped':
          return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('testing.iconSkipped'));
        default:
          return new vscode.ThemeIcon('question');
      }
    } else if (state === 'inProgress') {
      return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
    } else {
      return new vscode.ThemeIcon('clock');
    }
  }
  
  private calculateDuration(startTime?: Date, finishTime?: Date): string {
    if (!startTime) {
      return 'N/A';
    }
    
    const end = finishTime || new Date();
    const durationMs = end.getTime() - startTime.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Loading tree item for async operations
 */
export class LoadingTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'loading';
  readonly id: string;
  readonly label: string = 'Loading...';
  readonly hasChildren: boolean = false;
  readonly contextValue: string = 'loading';
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(id: string = 'loading') {
    this.id = id;
    this.iconPath = new vscode.ThemeIcon('sync~spin');
    this.tooltip = 'Loading data...';
  }
}

/**
 * Error tree item for error states
 */
export class ErrorTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'error';
  readonly id: string;
  readonly label: string;
  readonly hasChildren: boolean = false;
  readonly contextValue: string = 'error';
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor(message: string, id: string = 'error') {
    this.id = id;
    this.label = message;
    this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    this.tooltip = message;
    this.command = {
      command: 'azurePipelinesAssistant.refresh',
      title: 'Retry',
      arguments: [this]
    };
  }
}

/**
 * Factory function to create appropriate tree item based on data type
 */
export function createTreeItem(
  data: Project | Pipeline | PipelineRun | Stage | Job | Task,
  parent?: IAzurePipelinesTreeItem
): IAzurePipelinesTreeItem {
  let item: IAzurePipelinesTreeItem;
  
  if ('project' in data && 'configuration' in data) {
    // Pipeline
    item = new PipelineTreeItem(data as Pipeline);
  } else if ('pipeline' in data && 'resources' in data) {
    // PipelineRun
    item = new PipelineRunTreeItem(data as PipelineRun);
  } else if ('jobs' in data && 'dependsOn' in data) {
    // Stage
    item = new StageTreeItem(data as Stage);
  } else if ('tasks' in data && 'agentName' in data) {
    // Job
    item = new JobTreeItem(data as Job);
  } else if ('task' in data && 'inputs' in data) {
    // Task
    item = new TaskTreeItem(data as Task);
  } else {
    // Project
    item = new ProjectTreeItem(data as Project);
  }
  
  if (parent) {
    item.parent = parent;
  }
  
  return item;
}

/**
 * Type guard functions
 */
export function isProjectTreeItem(item: IAzurePipelinesTreeItem): item is ProjectTreeItem {
  return item.itemType === 'project';
}

export function isPipelineTreeItem(item: IAzurePipelinesTreeItem): item is PipelineTreeItem {
  return item.itemType === 'pipeline';
}

export function isPipelineRunTreeItem(item: IAzurePipelinesTreeItem): item is PipelineRunTreeItem {
  return item.itemType === 'run';
}

export function isStageTreeItem(item: IAzurePipelinesTreeItem): item is StageTreeItem {
  return item.itemType === 'stage';
}

export function isJobTreeItem(item: IAzurePipelinesTreeItem): item is JobTreeItem {
  return item.itemType === 'job';
}

export function isTaskTreeItem(item: IAzurePipelinesTreeItem): item is TaskTreeItem {
  return item.itemType === 'task';
}

export function isLoadingTreeItem(item: IAzurePipelinesTreeItem): item is LoadingTreeItem {
  return item.itemType === 'loading';
}

export function isErrorTreeItem(item: IAzurePipelinesTreeItem): item is ErrorTreeItem {
  return item.itemType === 'error';
}