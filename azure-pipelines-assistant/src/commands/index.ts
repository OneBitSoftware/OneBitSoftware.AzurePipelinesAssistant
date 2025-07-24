import * as vscode from 'vscode';
import { IAzureDevOpsService, IAuthenticationService } from '../interfaces';
import { AzurePipelinesTreeDataProvider } from '../services/treeDataProvider';
import { 
  ProjectTreeItem, 
  PipelineTreeItem, 
  PipelineRunTreeItem, 
  StageTreeItem, 
  JobTreeItem, 
  TaskTreeItem,
  isProjectTreeItem,
  isPipelineTreeItem,
  isPipelineRunTreeItem,
  isStageTreeItem,
  isJobTreeItem,
  isTaskTreeItem
} from '../models/treeItems';

/**
 * Command handler class for Azure Pipelines Assistant
 */
export class CommandHandler {
  constructor(
    private azureDevOpsService: IAzureDevOpsService,
    private authService: IAuthenticationService,
    private treeDataProvider: AzurePipelinesTreeDataProvider,
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Register all extension commands
   */
  registerCommands(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Basic commands
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.refresh', () => this.refresh()),
      vscode.commands.registerCommand('azurePipelinesAssistant.configure', () => this.configure())
    );

    // Pipeline commands
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.runPipeline', (item) => this.runPipeline(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.viewInBrowser', (item) => this.viewInBrowser(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.addToFavorites', (item) => this.addToFavorites(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.removeFromFavorites', (item) => this.removeFromFavorites(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.viewRecentRuns', (item) => this.viewRecentRuns(item))
    );

    // Run commands
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.viewRunDetails', (item) => this.viewRunDetails(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.viewLogs', (item) => this.viewLogs(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.downloadArtifacts', (item) => this.downloadArtifacts(item)),
      vscode.commands.registerCommand('azurePipelinesAssistant.cancelRun', (item) => this.cancelRun(item))
    );

    // Search and filter commands
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.searchPipelines', () => this.searchPipelines()),
      vscode.commands.registerCommand('azurePipelinesAssistant.filterByProject', () => this.filterByProject()),
      vscode.commands.registerCommand('azurePipelinesAssistant.filterByStatus', () => this.filterByStatus())
    );

    return disposables;
  }

  // Basic Commands

  private refresh(): void {
    this.treeDataProvider.refresh();
    vscode.window.showInformationMessage('Azure Pipelines refreshed');
  }

  private async configure(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'azurePipelinesAssistant');
  }

  // Pipeline Commands

  private async runPipeline(item: any): Promise<void> {
    if (!isPipelineTreeItem(item)) {
      vscode.window.showErrorMessage('Please select a pipeline to run');
      return;
    }

    try {
      // Show input for branch selection
      const branch = await vscode.window.showInputBox({
        prompt: 'Enter branch name (optional)',
        placeHolder: 'main',
        value: 'main'
      });

      if (branch === undefined) {
        return; // User cancelled
      }

      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Running pipeline: ${item.data.name}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Triggering pipeline...' });
        
        const runResult = await this.azureDevOpsService.triggerRun(
          item.data.id,
          item.data.project.id,
          { sourceBranch: branch }
        );

        progress.report({ increment: 100, message: 'Pipeline started successfully' });
        
        const action = await vscode.window.showInformationMessage(
          `Pipeline run #${runResult.id} started successfully`,
          'View Run',
          'View in Browser'
        );

        if (action === 'View Run') {
          // Refresh tree to show new run
          this.treeDataProvider.refresh();
        } else if (action === 'View in Browser') {
          vscode.env.openExternal(vscode.Uri.parse(runResult.url));
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run pipeline: ${error}`);
    }
  }

  private async viewInBrowser(item: any): Promise<void> {
    let url: string | undefined;

    if (isProjectTreeItem(item)) {
      url = item.data.url;
    } else if (isPipelineTreeItem(item)) {
      url = item.data.url;
    } else if (isPipelineRunTreeItem(item)) {
      url = item.data.url;
    } else {
      vscode.window.showErrorMessage('Cannot open this item in browser');
      return;
    }

    if (url) {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }

  private async addToFavorites(item: any): Promise<void> {
    if (!isProjectTreeItem(item) && !isPipelineTreeItem(item)) {
      vscode.window.showErrorMessage('Only projects and pipelines can be added to favorites');
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
      const favorites = config.get<string[]>('favoriteProjects', []);
      
      const itemId = isProjectTreeItem(item) ? item.data.id : item.data.project.id;
      
      if (!favorites.includes(itemId)) {
        favorites.push(itemId);
        await config.update('favoriteProjects', favorites, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`Added ${item.data.name} to favorites`);
        
        // Update context for when clauses
        await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.isFavorite', true);
      } else {
        vscode.window.showInformationMessage(`${item.data.name} is already in favorites`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add to favorites: ${error}`);
    }
  }

  private async removeFromFavorites(item: any): Promise<void> {
    if (!isProjectTreeItem(item) && !isPipelineTreeItem(item)) {
      vscode.window.showErrorMessage('Only projects and pipelines can be removed from favorites');
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
      const favorites = config.get<string[]>('favoriteProjects', []);
      
      const itemId = isProjectTreeItem(item) ? item.data.id : item.data.project.id;
      const index = favorites.indexOf(itemId);
      
      if (index > -1) {
        favorites.splice(index, 1);
        await config.update('favoriteProjects', favorites, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`Removed ${item.data.name} from favorites`);
        
        // Update context for when clauses
        await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.isFavorite', false);
      } else {
        vscode.window.showInformationMessage(`${item.data.name} is not in favorites`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to remove from favorites: ${error}`);
    }
  }

  private async viewRecentRuns(item: any): Promise<void> {
    if (!isPipelineTreeItem(item)) {
      vscode.window.showErrorMessage('Please select a pipeline to view recent runs');
      return;
    }

    try {
      const runs = await this.azureDevOpsService.getPipelineRuns(
        item.data.id,
        item.data.project.id
      );

      if (runs.length === 0) {
        vscode.window.showInformationMessage('No recent runs found for this pipeline');
        return;
      }

      // Show quick pick with recent runs
      const runItems = runs.slice(0, 10).map(run => ({
        label: `#${run.id} - ${run.name}`,
        description: `${run.state} - ${run.result || 'In Progress'}`,
        detail: `Created: ${run.createdDate.toLocaleString()}`,
        run: run
      }));

      const selectedRun = await vscode.window.showQuickPick(runItems, {
        placeHolder: 'Select a run to view details'
      });

      if (selectedRun) {
        // Find the run item in tree and reveal it
        this.treeDataProvider.refresh();
        // Note: In a full implementation, we would navigate to the specific run
        vscode.window.showInformationMessage(`Selected run #${selectedRun.run.id}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load recent runs: ${error}`);
    }
  }

  // Run Commands

  private async viewRunDetails(item: any): Promise<void> {
    if (!isPipelineRunTreeItem(item) && !isStageTreeItem(item) && !isJobTreeItem(item)) {
      vscode.window.showErrorMessage('Please select a run, stage, or job to view details');
      return;
    }

    try {
      let runId: number;
      let pipelineId: number;
      let projectId: string;

      if (isPipelineRunTreeItem(item)) {
        runId = item.data.id;
        pipelineId = item.data.pipeline.id;
        projectId = item.data.pipeline.project.id;
      } else {
        // For stages and jobs, we need to traverse up to find the run
        vscode.window.showInformationMessage('Run details view will be implemented in the next task');
        return;
      }

      // This will be implemented in Task 9 (Build run details webview)
      vscode.window.showInformationMessage(`Run details for #${runId} will be shown in webview (Task 9)`);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load run details: ${error}`);
    }
  }

  private async viewLogs(item: any): Promise<void> {
    if (!isPipelineRunTreeItem(item) && !isJobTreeItem(item) && !isTaskTreeItem(item)) {
      vscode.window.showErrorMessage('Please select a run, job, or task to view logs');
      return;
    }

    try {
      // This will be implemented in Task 10 (Implement log viewer webview)
      vscode.window.showInformationMessage('Log viewer will be implemented in Task 10');
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load logs: ${error}`);
    }
  }

  private async downloadArtifacts(item: any): Promise<void> {
    if (!isPipelineRunTreeItem(item)) {
      vscode.window.showErrorMessage('Please select a run to download artifacts');
      return;
    }

    try {
      // Show folder selection dialog
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Download Folder'
      });

      if (!folderUri || folderUri.length === 0) {
        return; // User cancelled
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading artifacts for run #${item.data.id}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Fetching artifact list...' });
        
        const downloadPath = await this.azureDevOpsService.downloadArtifacts(
          item.data.id,
          item.data.pipeline.id,
          item.data.pipeline.project.id,
          folderUri[0].fsPath
        );

        progress.report({ increment: 100, message: 'Download completed' });
        
        const action = await vscode.window.showInformationMessage(
          'Artifacts downloaded successfully',
          'Open Folder'
        );

        if (action === 'Open Folder') {
          vscode.env.openExternal(folderUri[0]);
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to download artifacts: ${error}`);
    }
  }

  private async cancelRun(item: any): Promise<void> {
    if (!isPipelineRunTreeItem(item)) {
      vscode.window.showErrorMessage('Please select a run to cancel');
      return;
    }

    if (item.data.state !== 'inProgress') {
      vscode.window.showErrorMessage('Only running pipelines can be cancelled');
      return;
    }

    try {
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to cancel run #${item.data.id}?`,
        { modal: true },
        'Cancel Run'
      );

      if (confirmation === 'Cancel Run') {
        await this.azureDevOpsService.cancelRun(
          item.data.id,
          item.data.pipeline.id,
          item.data.pipeline.project.id
        );

        vscode.window.showInformationMessage(`Run #${item.data.id} has been cancelled`);
        
        // Refresh tree to show updated status
        this.treeDataProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to cancel run: ${error}`);
    }
  }

  // Search and Filter Commands

  private async searchPipelines(): Promise<void> {
    try {
      const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter pipeline name to search',
        placeHolder: 'Pipeline name...'
      });

      if (!searchTerm) {
        return; // User cancelled
      }

      // Get all projects first
      const projects = await this.azureDevOpsService.getProjects();
      const allPipelines: any[] = [];

      // Collect all pipelines from all projects
      for (const project of projects) {
        try {
          const pipelines = await this.azureDevOpsService.getPipelines(project.id);
          allPipelines.push(...pipelines.map(p => ({ ...p, project })));
        } catch (error) {
          console.warn(`Failed to load pipelines for project ${project.name}:`, error);
        }
      }

      // Filter pipelines by search term
      const filteredPipelines = allPipelines.filter(pipeline =>
        pipeline.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filteredPipelines.length === 0) {
        vscode.window.showInformationMessage(`No pipelines found matching "${searchTerm}"`);
        return;
      }

      // Show quick pick with filtered results
      const pipelineItems = filteredPipelines.map(pipeline => ({
        label: pipeline.name,
        description: pipeline.project.name,
        detail: pipeline.folder || 'Root',
        pipeline: pipeline
      }));

      const selectedPipeline = await vscode.window.showQuickPick(pipelineItems, {
        placeHolder: `Found ${filteredPipelines.length} pipelines matching "${searchTerm}"`
      });

      if (selectedPipeline) {
        // Navigate to the selected pipeline in tree view
        vscode.window.showInformationMessage(`Selected: ${selectedPipeline.pipeline.name}`);
        // Note: In a full implementation, we would expand the tree to show the selected pipeline
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Search failed: ${error}`);
    }
  }

  private async filterByProject(): Promise<void> {
    try {
      const projects = await this.azureDevOpsService.getProjects();
      
      const projectItems = projects.map(project => ({
        label: project.name,
        description: project.description || '',
        project: project
      }));

      const selectedProject = await vscode.window.showQuickPick(projectItems, {
        placeHolder: 'Select a project to filter by'
      });

      if (selectedProject) {
        // This would ideally filter the tree view, but for now just show a message
        vscode.window.showInformationMessage(`Filtering by project: ${selectedProject.project.name}`);
        // Note: Full implementation would require tree view filtering capabilities
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load projects: ${error}`);
    }
  }

  private async filterByStatus(): Promise<void> {
    const statusOptions = [
      { label: 'All', description: 'Show all pipelines' },
      { label: 'Running', description: 'Show only running pipelines' },
      { label: 'Succeeded', description: 'Show only successful runs' },
      { label: 'Failed', description: 'Show only failed runs' },
      { label: 'Cancelled', description: 'Show only cancelled runs' }
    ];

    const selectedStatus = await vscode.window.showQuickPick(statusOptions, {
      placeHolder: 'Select status to filter by'
    });

    if (selectedStatus) {
      vscode.window.showInformationMessage(`Filtering by status: ${selectedStatus.label}`);
      // Note: Full implementation would require tree view filtering capabilities
    }
  }
}