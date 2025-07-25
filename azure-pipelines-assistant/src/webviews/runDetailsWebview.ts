import * as vscode from 'vscode';
import { IAzureDevOpsService } from '../interfaces';
import { PipelineRunDetails, Stage, Job, Task } from '../models';
import { isPipelineRunTreeItem } from '../models/treeItems';

/**
 * Webview provider for displaying detailed pipeline run information
 */
export class RunDetailsWebviewProvider {
  private static readonly viewType = 'azurePipelinesAssistant.runDetails';
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly azureDevOpsService: IAzureDevOpsService
  ) {}

  /**
   * Show run details for a specific pipeline run
   */
  public async showRunDetails(runItem: any): Promise<void> {
    if (!isPipelineRunTreeItem(runItem)) {
      vscode.window.showErrorMessage('Invalid run item provided');
      return;
    }

    try {
      // Get detailed run information
      const runDetails = await this.azureDevOpsService.getRunDetails(
        runItem.data.id,
        runItem.data.pipeline.id,
        runItem.data.pipeline.project.id
      );

      // Create or show the webview panel
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.One);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          RunDetailsWebviewProvider.viewType,
          `Run #${runItem.data.id} - ${runItem.data.pipeline.name}`,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.joinPath(this.context.extensionUri, 'media'),
              vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webviews')
            ]
          }
        );

        // Handle panel disposal
        this.panel.onDidDispose(() => {
          this.panel = undefined;
          this.dispose();
        }, null, this.disposables);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
          message => this.handleMessage(message),
          undefined,
          this.disposables
        );
      }

      // Update the webview content
      this.panel.webview.html = this.getWebviewContent(runDetails);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load run details: ${error}`);
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'refresh':
        // Refresh the run details
        if (message.runId && message.pipelineId && message.projectId) {
          try {
            const runDetails = await this.azureDevOpsService.getRunDetails(
              message.runId,
              message.pipelineId,
              message.projectId
            );
            this.panel?.webview.postMessage({
              command: 'updateRunDetails',
              data: runDetails
            });
          } catch (error) {
            this.panel?.webview.postMessage({
              command: 'error',
              message: `Failed to refresh: ${error}`
            });
          }
        }
        break;

      case 'openInBrowser':
        if (message.url) {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        break;

      case 'viewLogs':
        if (message.runId) {
          // Import and use the log viewer
          const { LogViewerWebviewProvider } = await import('./logViewerWebview.js');
          const logViewer = new LogViewerWebviewProvider(this.context, this.azureDevOpsService);
          await logViewer.showLogs(
            message.runId, 
            message.projectId, 
            message.pipelineId, 
            message.jobId, 
            message.taskId
          );
        }
        break;

      case 'cancelRun':
        if (message.runId && message.pipelineId && message.projectId) {
          try {
            await this.azureDevOpsService.cancelRun(
              message.runId,
              message.pipelineId,
              message.projectId
            );
            vscode.window.showInformationMessage(`Run #${message.runId} has been cancelled`);
            // Refresh the view
            this.handleMessage({ command: 'refresh', ...message });
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to cancel run: ${error}`);
          }
        }
        break;
    }
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(runDetails: PipelineRunDetails): string {
    const webview = this.panel!.webview;
    
    // Get URIs for CSS and JS files
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'runDetails.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'runDetails.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Run Details</title>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="run-info">
                <h1>
                    <span class="run-icon ${this.getStatusIcon(runDetails.state, runDetails.result)}"></span>
                    Run #${runDetails.id} - ${runDetails.name}
                </h1>
                <div class="run-meta">
                    <span class="status ${runDetails.state} ${runDetails.result || ''}">
                        ${this.getStatusText(runDetails.state, runDetails.result)}
                    </span>
                    <span class="duration">${this.formatDuration(runDetails.createdDate, runDetails.finishedDate)}</span>
                    <span class="created">Created: ${this.formatDate(runDetails.createdDate)}</span>
                </div>
            </div>
            <div class="actions">
                <button class="btn btn-secondary" onclick="refreshRun()">
                    <span class="icon refresh"></span> Refresh
                </button>
                <button class="btn btn-secondary" onclick="openInBrowser('${runDetails.url}')">
                    <span class="icon external"></span> Open in Browser
                </button>
                ${runDetails.state === 'inProgress' ? `
                <button class="btn btn-danger" onclick="cancelRun()">
                    <span class="icon stop"></span> Cancel Run
                </button>
                ` : ''}
            </div>
        </div>

        <!-- Pipeline Info -->
        <div class="section">
            <h2>Pipeline Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <label>Pipeline:</label>
                    <span>${runDetails.pipeline.name}</span>
                </div>
                <div class="info-item">
                    <label>Project:</label>
                    <span>${runDetails.pipeline.project.name}</span>
                </div>
                <div class="info-item">
                    <label>Repository:</label>
                    <span>${runDetails.pipeline.configuration?.repository?.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Branch:</label>
                    <span>${this.getBranchName(runDetails.resources)}</span>
                </div>
            </div>
        </div>

        <!-- Timeline -->
        <div class="section">
            <h2>Timeline</h2>
            <div class="timeline">
                ${this.generateTimelineHtml(runDetails.stages)}
            </div>
        </div>

        <!-- Stages -->
        <div class="section">
            <h2>Stages</h2>
            <div class="stages">
                ${runDetails.stages.map(stage => this.generateStageHtml(stage)).join('')}
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const runData = ${JSON.stringify(runDetails)};
        
        function refreshRun() {
            vscode.postMessage({
                command: 'refresh',
                runId: runData.id,
                pipelineId: runData.pipeline.id,
                projectId: runData.pipeline.project.id
            });
        }
        
        function openInBrowser(url) {
            vscode.postMessage({
                command: 'openInBrowser',
                url: url
            });
        }
        
        function cancelRun() {
            if (confirm('Are you sure you want to cancel this run?')) {
                vscode.postMessage({
                    command: 'cancelRun',
                    runId: runData.id,
                    pipelineId: runData.pipeline.id,
                    projectId: runData.pipeline.project.id
                });
            }
        }
        
        function viewLogs(runId, jobId) {
            vscode.postMessage({
                command: 'viewLogs',
                runId: runId,
                jobId: jobId
            });
        }
        
        function toggleStage(stageId) {
            const stage = document.getElementById('stage-' + stageId);
            const jobs = stage.querySelector('.jobs');
            const toggle = stage.querySelector('.toggle');
            
            if (jobs.style.display === 'none') {
                jobs.style.display = 'block';
                toggle.textContent = '▼';
            } else {
                jobs.style.display = 'none';
                toggle.textContent = '▶';
            }
        }
        
        function toggleJob(jobId) {
            const job = document.getElementById('job-' + jobId);
            const tasks = job.querySelector('.tasks');
            const toggle = job.querySelector('.toggle');
            
            if (tasks.style.display === 'none') {
                tasks.style.display = 'block';
                toggle.textContent = '▼';
            } else {
                tasks.style.display = 'none';
                toggle.textContent = '▶';
            }
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateRunDetails':
                    // Reload the page with new data
                    location.reload();
                    break;
                case 'error':
                    alert('Error: ' + message.message);
                    break;
            }
        });
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate HTML for the timeline visualization
   */
  private generateTimelineHtml(stages: Stage[]): string {
    return stages.map((stage, index) => {
      const status = this.getStatusIcon(stage.state, stage.result);
      const duration = this.formatDuration(stage.startTime, stage.finishTime);
      
      return `
        <div class="timeline-item ${stage.state} ${stage.result || ''}">
          <div class="timeline-marker ${status}"></div>
          <div class="timeline-content">
            <div class="timeline-title">${stage.displayName}</div>
            <div class="timeline-meta">
              <span class="status">${this.getStatusText(stage.state, stage.result)}</span>
              <span class="duration">${duration}</span>
            </div>
          </div>
          ${index < stages.length - 1 ? '<div class="timeline-connector"></div>' : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Generate HTML for a stage
   */
  private generateStageHtml(stage: Stage): string {
    const status = this.getStatusIcon(stage.state, stage.result);
    const duration = this.formatDuration(stage.startTime, stage.finishTime);
    
    return `
      <div class="stage ${stage.state} ${stage.result || ''}" id="stage-${stage.id}">
        <div class="stage-header" onclick="toggleStage('${stage.id}')">
          <span class="toggle">▼</span>
          <span class="icon ${status}"></span>
          <span class="name">${stage.displayName}</span>
          <span class="status">${this.getStatusText(stage.state, stage.result)}</span>
          <span class="duration">${duration}</span>
        </div>
        <div class="jobs">
          ${stage.jobs.map(job => this.generateJobHtml(job)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for a job
   */
  private generateJobHtml(job: Job): string {
    const status = this.getStatusIcon(job.state, job.result);
    const duration = this.formatDuration(job.startTime, job.finishTime);
    
    return `
      <div class="job ${job.state} ${job.result || ''}" id="job-${job.id}">
        <div class="job-header" onclick="toggleJob('${job.id}')">
          <span class="toggle">▼</span>
          <span class="icon ${status}"></span>
          <span class="name">${job.displayName}</span>
          <span class="agent">${job.agentName || 'N/A'}</span>
          <span class="status">${this.getStatusText(job.state, job.result)}</span>
          <span class="duration">${duration}</span>
          <button class="btn btn-sm" onclick="viewLogs(${job.id}, '${job.id}')">
            <span class="icon logs"></span> Logs
          </button>
        </div>
        <div class="tasks">
          ${job.tasks.map(task => this.generateTaskHtml(task)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for a task
   */
  private generateTaskHtml(task: Task): string {
    const status = this.getStatusIcon(task.state, task.result);
    const duration = this.formatDuration(task.startTime, task.finishTime);
    
    return `
      <div class="task ${task.state} ${task.result || ''}">
        <span class="icon ${status}"></span>
        <span class="name">${task.displayName}</span>
        <span class="status">${this.getStatusText(task.state, task.result)}</span>
        <span class="duration">${duration}</span>
        <button class="btn btn-sm" onclick="viewLogs(${task.id}, '${task.id}')">
          <span class="icon logs"></span> Logs
        </button>
      </div>
    `;
  }

  /**
   * Get status icon class based on state and result
   */
  private getStatusIcon(state: string, result?: string): string {
    if (state === 'completed') {
      switch (result) {
        case 'succeeded': return 'success';
        case 'failed': return 'error';
        case 'canceled': return 'canceled';
        case 'skipped': return 'skipped';
        default: return 'unknown';
      }
    } else if (state === 'inProgress') {
      return 'running';
    } else if (state === 'pending') {
      return 'pending';
    }
    return 'unknown';
  }

  /**
   * Get human-readable status text
   */
  private getStatusText(state: string, result?: string): string {
    if (state === 'completed') {
      switch (result) {
        case 'succeeded': return 'Succeeded';
        case 'failed': return 'Failed';
        case 'canceled': return 'Canceled';
        case 'skipped': return 'Skipped';
        default: return 'Completed';
      }
    } else if (state === 'inProgress') {
      return 'Running';
    } else if (state === 'pending') {
      return 'Pending';
    }
    return 'Unknown';
  }

  /**
   * Format duration between two dates
   */
  private formatDuration(startTime?: Date, finishTime?: Date): string {
    if (!startTime) {
      return 'N/A';
    }
    
    const end = finishTime || new Date();
    const duration = end.getTime() - startTime.getTime();
    
    const seconds = Math.floor(duration / 1000);
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

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleString();
  }

  /**
   * Get branch name from resources
   */
  private getBranchName(resources: any): string {
    if (resources?.repositories) {
      const repo = Object.values(resources.repositories)[0] as any;
      if (repo?.refName) {
        return repo.refName.replace('refs/heads/', '');
      }
    }
    return 'N/A';
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose of the webview and clean up resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}