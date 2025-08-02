import * as vscode from 'vscode';
import { AuthenticationError, NetworkError } from '../errors/errorTypes';
import { IAuthenticationService } from '../interfaces/authenticationService';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import {
  ErrorTreeItem,
  IAzurePipelinesTreeItem,
  JobTreeItem,
  PipelineRunTreeItem,
  PipelineTreeItem,
  ProjectTreeItem,
  StageTreeItem,
  TaskTreeItem
} from '../models/treeItems';

/**
 * Pipeline tree provider implementing vscode.TreeDataProvider interface
 * Provides hierarchical project → pipeline → run structure
 */
export class PipelineTreeProvider implements vscode.TreeDataProvider<IAzurePipelinesTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IAzurePipelinesTreeItem | undefined | null | void> =
    new vscode.EventEmitter<IAzurePipelinesTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IAzurePipelinesTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private _itemCache = new Map<string, IAzurePipelinesTreeItem>();
  private _childrenCache = new Map<string, IAzurePipelinesTreeItem[]>();

  constructor(
    private readonly azureDevOpsService: IAzureDevOpsService,
    private readonly authenticationService: IAuthenticationService
  ) {
    // Listen for authentication changes to refresh tree
    this.authenticationService.onAuthenticationChanged(() => {
      this.refresh();
    });
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: IAzurePipelinesTreeItem): vscode.TreeItem {
    // Cache the item for later reference
    this._itemCache.set(element.id, element);
    return element;
  }

  /**
   * Get children for a tree item with hierarchical project → pipeline → run structure
   */
  async getChildren(element?: IAzurePipelinesTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      // Root level - check authentication state first
      if (!element) {
        if (!this.authenticationService.isAuthenticated()) {
          // Return empty array when not configured - welcome view will be shown instead
          return [];
        }
        return await this.getProjects();
      }

      // Check cache first for performance
      const cached = this._childrenCache.get(element.id);
      if (cached) {
        return cached;
      }

      let children: IAzurePipelinesTreeItem[] = [];

      // Handle different tree item types
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
        case 'loading':
        case 'error':
          // These items don't have children
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
      console.error('Error getting children for tree item:', error);
      return this.handleError(error, element);
    }
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

    // Fire change event for this specific item
    this._onDidChangeTreeData.fire(item);
  }

  /**
   * Get projects from Azure DevOps
   */
  private async getProjects(): Promise<IAzurePipelinesTreeItem[]> {
    try {
      const projects = await this.azureDevOpsService.getProjects();

      if (projects.length === 0) {
        return [new ErrorTreeItem('No projects found. Check your permissions.', 'no-projects')];
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

      if (pipelines.length === 0) {
        return [new ErrorTreeItem('No pipelines found in this project.', `no-pipelines-${projectItem.data.id}`)];
      }

      return pipelines.map(pipeline => new PipelineTreeItem(pipeline));
    } catch (error) {
      console.error(`Error loading pipelines for project ${projectItem.data.id}:`, error);
      return this.handleError(error, projectItem);
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

      if (runs.length === 0) {
        return [new ErrorTreeItem('No runs found for this pipeline.', `no-runs-${pipelineItem.data.id}`)];
      }

      return runs.map(run => new PipelineRunTreeItem(run));
    } catch (error) {
      console.error(`Error loading runs for pipeline ${pipelineItem.data.id}:`, error);
      return this.handleError(error, pipelineItem);
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

      if (runDetails.stages.length === 0) {
        return [new ErrorTreeItem('No stages found for this run.', `no-stages-${runItem.data.id}`)];
      }

      return runDetails.stages.map(stage => new StageTreeItem(stage));
    } catch (error) {
      console.error(`Error loading stages for run ${runItem.data.id}:`, error);
      return this.handleError(error, runItem);
    }
  }

  /**
   * Get jobs for a stage
   */
  private async getJobs(stageItem: StageTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      if (stageItem.data.jobs.length === 0) {
        return [new ErrorTreeItem('No jobs found for this stage.', `no-jobs-${stageItem.data.id}`)];
      }

      return stageItem.data.jobs.map(job => new JobTreeItem(job));
    } catch (error) {
      console.error(`Error loading jobs for stage ${stageItem.data.id}:`, error);
      return this.handleError(error, stageItem);
    }
  }

  /**
   * Get tasks for a job
   */
  private async getTasks(jobItem: JobTreeItem): Promise<IAzurePipelinesTreeItem[]> {
    try {
      if (jobItem.data.tasks.length === 0) {
        return [new ErrorTreeItem('No tasks found for this job.', `no-tasks-${jobItem.data.id}`)];
      }

      return jobItem.data.tasks.map(task => new TaskTreeItem(task));
    } catch (error) {
      console.error(`Error loading tasks for job ${jobItem.data.id}:`, error);
      return this.handleError(error, jobItem);
    }
  }

  /**
   * Handle API failures with user-friendly error messages
   */
  private handleError(error: any, element?: IAzurePipelinesTreeItem): IAzurePipelinesTreeItem[] {
    let errorMessage = 'Unknown error occurred';
    let actionCommand: vscode.Command | undefined;
    let errorId = `error-${Date.now()}`;

    if (error instanceof AuthenticationError) {
      switch (error.authErrorCode) {
        case 'INVALID_PAT':
          errorMessage = 'Invalid Personal Access Token';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'Configure',
            arguments: []
          };
          errorId = 'auth-invalid-pat';
          break;
        case 'EXPIRED_PAT':
          errorMessage = 'Personal Access Token has expired';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'Update Token',
            arguments: []
          };
          errorId = 'auth-expired-pat';
          break;
        case 'INSUFFICIENT_PERMISSIONS':
          errorMessage = 'Insufficient permissions. Check your PAT scope.';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'View Required Permissions',
            arguments: []
          };
          errorId = 'auth-insufficient-permissions';
          break;
        case 'NETWORK_ERROR':
          errorMessage = 'Network error. Check your connection.';
          actionCommand = {
            command: 'azurePipelinesAssistant.refresh',
            title: 'Retry',
            arguments: [element]
          };
          errorId = 'network-error';
          break;
        case 'INVALID_ORGANIZATION':
          errorMessage = 'Invalid organization name';
          actionCommand = {
            command: 'azurePipelinesAssistant.configure',
            title: 'Configure',
            arguments: []
          };
          errorId = 'auth-invalid-org';
          break;
      }
    } else if (error instanceof NetworkError) {
      if (error.statusCode === 404) {
        errorMessage = 'Resource not found. Check your permissions.';
        errorId = 'resource-not-found';
      } else if (error.statusCode === 401) {
        errorMessage = 'Authentication failed. Check your credentials.';
        actionCommand = {
          command: 'azurePipelinesAssistant.configure',
          title: 'Configure',
          arguments: []
        };
        errorId = 'auth-failed';
      } else if (error.statusCode === 403) {
        errorMessage = 'Access denied. Check your permissions.';
        errorId = 'access-denied';
      } else {
        errorMessage = `Network error (${error.statusCode}). Try again.`;
        actionCommand = {
          command: 'azurePipelinesAssistant.refresh',
          title: 'Retry',
          arguments: [element]
        };
        errorId = `network-error-${error.statusCode}`;
      }
    } else if (error instanceof Error) {
      if (error.message.includes('404')) {
        errorMessage = 'Resource not found. Check your permissions.';
        errorId = 'resource-not-found';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Check your credentials.';
        actionCommand = {
          command: 'azurePipelinesAssistant.configure',
          title: 'Configure',
          arguments: []
        };
        errorId = 'auth-failed';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Check your permissions.';
        errorId = 'access-denied';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Try again.';
        actionCommand = {
          command: 'azurePipelinesAssistant.refresh',
          title: 'Retry',
          arguments: [element]
        };
        errorId = 'timeout-error';
      } else {
        errorMessage = `Error: ${error.message}`;
        errorId = 'generic-error';
      }
    }

    const errorItem = new ErrorTreeItem(errorMessage, errorId);
    if (actionCommand) {
      errorItem.command = actionCommand;
    }

    return [errorItem];
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
   * Find tree item by ID
   */
  findItem(id: string): IAzurePipelinesTreeItem | undefined {
    return this._itemCache.get(id);
  }

  /**
   * Get parent of a tree item
   */
  getParent(element: IAzurePipelinesTreeItem): IAzurePipelinesTreeItem | undefined {
    return element.parent;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this._itemCache.clear();
    this._childrenCache.clear();
  }
}