import * as vscode from 'vscode';
import { 
  IAzurePipelinesTreeItem,
  ProjectTreeItem,
  PipelineTreeItem,
  PipelineRunTreeItem,
  StageTreeItem,
  JobTreeItem,
  TaskTreeItem,
  ErrorTreeItem,
  TreeItemType
} from '../models';
import { IAzureDevOpsService, IAuthenticationService, AuthenticationError } from '../interfaces';
import { IRealTimeUpdateService } from '../interfaces/realTimeUpdateService';
import { PipelineRun } from '../models/pipelineRun';

/**
 * Interface for the tree data provider
 */
export interface IAzurePipelinesTreeDataProvider extends vscode.TreeDataProvider<IAzurePipelinesTreeItem> {
  /**
   * Refresh the tree view
   */
  refresh(): void;
  
  /**
   * Refresh a specific item
   */
  refreshItem(item: IAzurePipelinesTreeItem): void;
  
  /**
   * Get tree item for a specific data object
   */
  getTreeItem(element: IAzurePipelinesTreeItem): vscode.TreeItem;
  
  /**
   * Get children for a tree item
   */
  getChildren(element?: IAzurePipelinesTreeItem): Promise<IAzurePipelinesTreeItem[]>;
  
  /**
   * Get parent of a tree item
   */
  getParent(element: IAzurePipelinesTreeItem): IAzurePipelinesTreeItem | undefined;
  
  /**
   * Reveal and select a specific item
   */
  reveal(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Find tree item by ID
   */
  findItem(id: string): IAzurePipelinesTreeItem | undefined;
  
  /**
   * Get all items of a specific type
   */
  getItemsByType(type: TreeItemType): IAzurePipelinesTreeItem[];
}

/**
 * Welcome tree item for unauthenticated state
 */
export class WelcomeTreeItem implements IAzurePipelinesTreeItem {
  readonly itemType: TreeItemType = 'loading';
  readonly id: string = 'welcome';
  readonly label: string = 'Welcome to Azure Pipelines Assistant';
  readonly hasChildren: boolean = false;
  readonly contextValue: string = 'welcome';
  readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;
  
  parent?: IAzurePipelinesTreeItem;
  tooltip?: string | vscode.MarkdownString;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  resourceUri?: vscode.Uri;
  
  constructor() {
    this.iconPath = new vscode.ThemeIcon('info');
    this.tooltip = new vscode.MarkdownString(
      '**Welcome to Azure Pipelines Assistant**\n\n' +
      'To get started, please configure your Azure DevOps organization and Personal Access Token.\n\n' +
      'Click here to configure your settings.'
    );
    this.description = 'Click to configure';
    this.command = {
      command: 'azurePipelinesAssistant.configure',
      title: 'Configure Azure Pipelines',
      arguments: []
    };
  }
}

/**
 * Azure Pipelines tree data provider implementation
 */
export class AzurePipelinesTreeDataProvider implements IAzurePipelinesTreeDataProvider {
  private _onDidChangeTreeData: vscode.EventEmitter<IAzurePipelinesTreeItem | undefined | null | void> = new vscode.EventEmitter<IAzurePipelinesTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IAzurePipelinesTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private _treeView?: vscode.TreeView<IAzurePipelinesTreeItem>;
  private _itemCache = new Map<string, IAzurePipelinesTreeItem>();
  private _childrenCache = new Map<string, IAzurePipelinesTreeItem[]>();
  private _isAuthenticated: boolean = false;
  
  constructor(
    private azureDevOpsService: IAzureDevOpsService,
    private authenticationService: IAuthenticationService,
    private realTimeUpdateService: IRealTimeUpdateService,
    context: vscode.ExtensionContext
  ) {
    // Initialize authentication state
    this._isAuthenticated = this.authenticationService.isAuthenticated();
    
    // Listen for authentication changes
    this.authenticationService.onAuthenticationChanged((isAuthenticated) => {
      this._isAuthenticated = isAuthenticated;
      this.refresh();
    });

    // Listen for real-time run status changes
    this.realTimeUpdateService.onRunStatusChanged((event) => {
      this.handleRunStatusChange(event);
    });
  }
  
  /**
   * Set the tree view instance
   */
  setTreeView(treeView: vscode.TreeView<IAzurePipelinesTreeItem>): void {
    this._treeView = treeView;
  }
  
  /**
   * Refresh the entire tree view
   */
  refresh(): void {
    this._itemCache.clear();
    this._childrenCache.clear();
    this._onDidChangeTreeData.fire();
  }
  
  /**
   * Refresh a specific item and its children
   */
  refreshItem(item: IAzurePipelinesTreeItem): void {
    // Clear cached children for this item
    this._childrenCache.delete(item.id);
    
    // Clear cached children for all descendants
    this.clearDescendantCache(item);
    
    this._onDidChangeTreeData.fire(item);
  }
  
  /**
   * Get tree item representation
   */
  getTreeItem(element: IAzurePipelinesTreeItem): vscode.TreeItem {
    // Cache the item
    this._itemCache.set(element.id, element);
    return element;
  }
  
  /**
   * Get children for a tree item
   */
  async getChildren(element?: IAzurePipelinesTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      // Root level - check authentication first
      if (!element) {
        if (!this._isAuthenticated) {
          return [new WelcomeTreeItem()];
        }
        return await this.getProjects();
      }
      
      // Check cache first
      const cached = this._childrenCache.get(element.id);
      if (cached) {
        return cached;
      }
      
      let children: IAzurePipelinesTreeItem[] = [];
      
      switch (element.itemType) {
        case 'project':
          children = await this.getPipelines(element as ProjectTreeItem);
          break;
        case 'pipeline':
          children = await this.getPipelineRuns(element as PipelineTreeItem);
          break;
        case 'run':
          children = await this.getStages(element as PipelineRunTreeItem);
          break;
        case 'stage':
          children = await this.getJobs(element as StageTreeItem);
          break;
        case 'job':
          children = await this.getTasks(element as JobTreeItem);
          break;
        case 'task':
          // Tasks don't have children
          children = [];
          break;
        default:
          children = [];
      }
      
      // Set parent references
      children.forEach(child => {
        child.parent = element;
      });
      
      // Cache the results
      this._childrenCache.set(element.id, children);
      
      return children;
    } catch (error) {
      console.error('Error getting children:', error);
      return this.handleError(error, element);
    }
  }
  
  /**
   * Get parent of a tree item
   */
  getParent(element: IAzurePipelinesTreeItem): IAzurePipelinesTreeItem | undefined {
    return element.parent;
  }
  
  /**
   * Reveal and select a specific item
   */
  async reveal(item: IAzurePipelinesTreeItem): Promise<void> {
    if (this._treeView) {
      await this._treeView.reveal(item, { select: true, focus: true, expand: true });
    }
  }
  
  /**
   * Find tree item by ID
   */
  findItem(id: string): IAzurePipelinesTreeItem | undefined {
    return this._itemCache.get(id);
  }
  
  /**
   * Get all items of a specific type
   */
  getItemsByType(type: TreeItemType): IAzurePipelinesTreeItem[] {
    return Array.from(this._itemCache.values()).filter(item => item.itemType === type);
  }
  
  /**
   * Handle errors with user-friendly messages
   */
  private handleError(error: any, element?: IAzurePipelinesTreeItem): IAzurePipelinesTreeItem[] {
    let errorMessage = 'Unknown error occurred';
    let actionCommand: vscode.Command | undefined;
    
    if (error instanceof AuthenticationError) {
      switch (error.errorCode) {
        case 'INVALID_PAT':
          errorMessage = 'Invalid Personal Access Token';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'Configure',
            arguments: []
          };
          break;
        case 'EXPIRED_PAT':
          errorMessage = 'Personal Access Token has expired';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'Update Token',
            arguments: []
          };
          break;
        case 'INSUFFICIENT_PERMISSIONS':
          errorMessage = 'Insufficient permissions. Check your PAT scope.';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'View Required Permissions',
            arguments: []
          };
          break;
        case 'NETWORK_ERROR':
          errorMessage = 'Network error. Check your connection.';
          actionCommand = {
            command: 'azurePipelinesAssistant.refresh',
            title: 'Retry',
            arguments: [element]
          };
          break;
        case 'INVALID_ORGANIZATION':
          errorMessage = 'Invalid organization name';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'Configure',
            arguments: []
          };
          break;
      }
    } else if (error instanceof Error) {
      if (error.message.includes('404')) {
        errorMessage = 'Resource not found. Check your permissions.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Check your credentials.';
        actionCommand = {
          command: 'azurePipelinesAssistant.configure',
          title: 'Configure',
          arguments: []
        };
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Check your permissions.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Try again.';
        actionCommand = {
          command: 'azurePipelinesAssistant.refresh',
          title: 'Retry',
          arguments: [element]
        };
      } else {
        errorMessage = `Error: ${error.message}`;
      }
    }
    
    const errorItem = new ErrorTreeItem(errorMessage);
    if (actionCommand) {
      errorItem.command = actionCommand;
    }
    
    return [errorItem];
  }

  /**
   * Get projects from Azure DevOps
   */
  private async getProjects(): Promise<IAzurePipelinesTreeItem[]> {
    try {
      const projects = await this.azureDevOpsService.getProjects();
      if (projects.length === 0) {
        return [new ErrorTreeItem('No projects found. Check your permissions.')];
      }
      return projects.map(project => new ProjectTreeItem(project));
    } catch (error) {
      console.error('Error loading projects:', error);
      return this.handleError(error);
    }
  }
  
  /**
   * Get pipelines for a project
   */
  private async getPipelines(projectItem: ProjectTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      const pipelines = await this.azureDevOpsService.getPipelines(projectItem.data.id);
      return pipelines.map(pipeline => new PipelineTreeItem(pipeline));
    } catch (error) {
      console.error('Error loading pipelines:', error);
      return [new ErrorTreeItem('Failed to load pipelines')];
    }
  }
  
  /**
   * Get pipeline runs for a pipeline
   */
  private async getPipelineRuns(pipelineItem: PipelineTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      const runs = await this.azureDevOpsService.getPipelineRuns(
        pipelineItem.data.id,
        pipelineItem.data.project.id
      );

      // Subscribe to real-time updates for active runs
      runs.forEach(run => {
        if (run.state === 'inProgress') {
          this.realTimeUpdateService.subscribeToRunUpdates(
            run.id,
            run.pipeline.id,
            run.pipeline.project.id,
            (updatedRun) => {
              this.handleRunUpdate(updatedRun);
            }
          );
        }
      });

      return runs.map(run => new PipelineRunTreeItem(run));
    } catch (error) {
      console.error('Error loading pipeline runs:', error);
      return [new ErrorTreeItem('Failed to load pipeline runs')];
    }
  }
  
  /**
   * Get stages for a pipeline run
   */
  private async getStages(runItem: PipelineRunTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      const runDetails = await this.azureDevOpsService.getRunDetails(
        runItem.data.id,
        runItem.data.pipeline.id,
        runItem.data.pipeline.project.id
      );
      return runDetails.stages.map((stage: any) => new StageTreeItem(stage));
    } catch (error) {
      console.error('Error loading stages:', error);
      return [new ErrorTreeItem('Failed to load stages')];
    }
  }
  
  /**
   * Get jobs for a stage
   */
  private async getJobs(stageItem: StageTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      // Jobs are already part of the stage data
      return stageItem.data.jobs.map(job => new JobTreeItem(job));
    } catch (error) {
      console.error('Error loading jobs:', error);
      return [new ErrorTreeItem('Failed to load jobs')];
    }
  }
  
  /**
   * Get tasks for a job
   */
  private async getTasks(jobItem: JobTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      // Tasks are already part of the job data
      return jobItem.data.tasks.map(task => new TaskTreeItem(task));
    } catch (error) {
      console.error('Error loading tasks:', error);
      return [new ErrorTreeItem('Failed to load tasks')];
    }
  }
  
  /**
   * Handle real-time run status changes
   */
  private handleRunStatusChange(event: any): void {
    // Find the run item in cache and refresh it
    const runItem = this.findRunItem(event.runId, event.pipelineId, event.projectId);
    if (runItem) {
      this.refreshItem(runItem);
    }
  }

  /**
   * Handle individual run updates from real-time service
   */
  private handleRunUpdate(updatedRun: PipelineRun): void {
    // Find the run item and refresh its parent pipeline
    const runItem = this.findRunItem(updatedRun.id, updatedRun.pipeline.id, updatedRun.pipeline.project.id);
    if (runItem && runItem.parent) {
      this.refreshItem(runItem.parent);
    }
  }

  /**
   * Find a run item in the cache
   */
  private findRunItem(runId: number, pipelineId: number, projectId: string): IAzurePipelinesTreeItem | undefined {
    for (const [key, item] of this._itemCache.entries()) {
      if (item.itemType === 'run') {
        const runItem = item as PipelineRunTreeItem;
        if (runItem.data.id === runId && 
            runItem.data.pipeline.id === pipelineId && 
            runItem.data.pipeline.project.id === projectId) {
          return runItem;
        }
      }
    }
    return undefined;
  }

  /**
   * Clear cached children for all descendants of an item
   */
  private clearDescendantCache(item: IAzurePipelinesTreeItem): void {
    const children = this._childrenCache.get(item.id);
    if (children) {
      children.forEach(child => {
        this._childrenCache.delete(child.id);
        this.clearDescendantCache(child);
      });
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.realTimeUpdateService.dispose();
  }
}