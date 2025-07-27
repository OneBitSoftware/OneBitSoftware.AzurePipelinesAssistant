import * as vscode from 'vscode';
import * as path from 'path';
import { IAzureDevOpsService } from '../interfaces';
import { PipelineRunDetails } from '../models';
import { RunComparison, ExportFormat, ExportConfig, RunSelectionCriteria } from '../models/runComparison';
import { RunComparisonService } from '../services/runComparisonService';

/**
 * Webview provider for comparing pipeline runs
 */
export class RunComparisonWebviewProvider {
  private static readonly viewType = 'azurePipelinesAssistant.runComparison';
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private comparisonService: RunComparisonService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly azureDevOpsService: IAzureDevOpsService
  ) {
    this.comparisonService = new RunComparisonService();
  }

  /**
   * Show run comparison UI for selecting runs to compare
   */
  public async showRunSelection(pipelineId: number, projectId: string): Promise<void> {
    try {
      // Get recent runs for the pipeline
      const runs = await this.azureDevOpsService.getPipelineRuns(pipelineId, projectId, 20);
      
      if (runs.length < 2) {
        vscode.window.showWarningMessage('At least 2 runs are required for comparison');
        return;
      }

      // Create or show the webview panel
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.One);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          RunComparisonWebviewProvider.viewType,
          'Compare Pipeline Runs',
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

      // Update the webview content with run selection
      this.panel.webview.html = this.getRunSelectionHtml(runs, pipelineId, projectId);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load runs for comparison: ${error}`);
    }
  }

  /**
   * Show comparison results for two specific runs
   */
  public async showComparison(run1Id: number, run2Id: number, pipelineId: number, projectId: string): Promise<void> {
    try {
      // Get detailed run information
      const [run1Details, run2Details] = await Promise.all([
        this.azureDevOpsService.getRunDetails(run1Id, pipelineId, projectId),
        this.azureDevOpsService.getRunDetails(run2Id, pipelineId, projectId)
      ]);

      // Perform comparison
      const comparison = this.comparisonService.compareRuns(run1Details, run2Details);

      // Create or show the webview panel
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.One);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          RunComparisonWebviewProvider.viewType,
          `Compare Runs #${run1Id} vs #${run2Id}`,
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

      // Update the webview content with comparison results
      this.panel.webview.html = this.getComparisonHtml(comparison);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to compare runs: ${error}`);
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'compareRuns':
        if (message.run1Id && message.run2Id && message.pipelineId && message.projectId) {
          await this.showComparison(
            message.run1Id,
            message.run2Id,
            message.pipelineId,
            message.projectId
          );
        }
        break;

      case 'exportComparison':
        if (message.comparison && message.format) {
          await this.exportComparison(message.comparison, message.format, message.config);
        }
        break;

      case 'refreshRuns':
        if (message.pipelineId && message.projectId) {
          await this.showRunSelection(message.pipelineId, message.projectId);
        }
        break;

      case 'openRunDetails':
        if (message.runId && message.pipelineId && message.projectId) {
          // Import and use the run details viewer
          const { RunDetailsWebviewProvider } = await import('./runDetailsWebview.js');
          const runDetailsViewer = new RunDetailsWebviewProvider(this.context, this.azureDevOpsService);
          
          // Create a mock run item for the run details viewer
          const mockRunItem = {
            data: {
              id: message.runId,
              pipeline: {
                id: message.pipelineId,
                project: {
                  id: message.projectId
                }
              }
            }
          };
          
          await runDetailsViewer.showRunDetails(mockRunItem);
        }
        break;

      case 'openInBrowser':
        if (message.url) {
          vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        break;
    }
  }

  /**
   * Export comparison results
   */
  private async exportComparison(comparison: RunComparison, format: ExportFormat, config: any): Promise<void> {
    try {
      const exportConfig: ExportConfig = {
        format,
        includeTaskDetails: config?.includeTaskDetails ?? true,
        includeCharts: config?.includeCharts ?? false,
        summaryOnly: config?.summaryOnly ?? false,
        title: config?.title
      };

      const exportData = this.comparisonService.exportComparison(comparison, exportConfig);
      
      // Show save dialog
      const fileExtension = format === ExportFormat.JSON ? 'json' : 
                           format === ExportFormat.CSV ? 'csv' :
                           format === ExportFormat.HTML ? 'html' : 'md';
      
      const defaultFileName = `pipeline-comparison-${comparison.runs[0].id}-vs-${comparison.runs[1].id}.${fileExtension}`;
      
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFileName),
        filters: {
          [format.toUpperCase()]: [fileExtension]
        }
      });

      if (saveUri) {
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(exportData, 'utf8'));
        
        const action = await vscode.window.showInformationMessage(
          'Comparison exported successfully',
          'Open File',
          'Open Folder'
        );

        if (action === 'Open File') {
          await vscode.window.showTextDocument(saveUri);
        } else if (action === 'Open Folder') {
          const folderUri = vscode.Uri.file(path.dirname(saveUri.fsPath));
          await vscode.env.openExternal(folderUri);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export comparison: ${error}`);
    }
  }

  /**
   * Generate HTML for run selection
   */
  private getRunSelectionHtml(runs: any[], pipelineId: number, projectId: string): string {
    const webview = this.panel!.webview;
    
    // Get URIs for CSS and JS files
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'runComparison.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'runComparison.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Compare Pipeline Runs</title>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Compare Pipeline Runs</h1>
            <p>Select two runs to compare their performance, results, and execution details.</p>
        </div>

        <div class="selection-section">
            <div class="selection-instructions">
                <p>Select exactly 2 runs to compare:</p>
                <div class="selection-status">
                    <span id="selection-count">0</span> of 2 runs selected
                </div>
            </div>

            <div class="actions">
                <button id="compare-btn" class="btn btn-primary" disabled onclick="compareSelectedRuns()">
                    Compare Selected Runs
                </button>
                <button class="btn btn-secondary" onclick="refreshRuns()">
                    <span class="icon refresh"></span> Refresh
                </button>
            </div>
        </div>

        <div class="runs-list">
            ${runs.map(run => this.generateRunSelectionItemHtml(run)).join('')}
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const pipelineId = ${pipelineId};
        const projectId = '${projectId}';
        let selectedRuns = [];
        
        function toggleRunSelection(runId, runElement) {
            const index = selectedRuns.indexOf(runId);
            
            if (index > -1) {
                // Deselect
                selectedRuns.splice(index, 1);
                runElement.classList.remove('selected');
            } else if (selectedRuns.length < 2) {
                // Select
                selectedRuns.push(runId);
                runElement.classList.add('selected');
            } else {
                // Already have 2 selected, show message
                alert('You can only select 2 runs for comparison. Deselect one first.');
                return;
            }
            
            updateSelectionStatus();
        }
        
        function updateSelectionStatus() {
            const countElement = document.getElementById('selection-count');
            const compareBtn = document.getElementById('compare-btn');
            
            countElement.textContent = selectedRuns.length;
            compareBtn.disabled = selectedRuns.length !== 2;
        }
        
        function compareSelectedRuns() {
            if (selectedRuns.length === 2) {
                vscode.postMessage({
                    command: 'compareRuns',
                    run1Id: selectedRuns[0],
                    run2Id: selectedRuns[1],
                    pipelineId: pipelineId,
                    projectId: projectId
                });
            }
        }
        
        function refreshRuns() {
            vscode.postMessage({
                command: 'refreshRuns',
                pipelineId: pipelineId,
                projectId: projectId
            });
        }
        
        function openRunDetails(runId) {
            vscode.postMessage({
                command: 'openRunDetails',
                runId: runId,
                pipelineId: pipelineId,
                projectId: projectId
            });
        }
        
        function openInBrowser(url) {
            vscode.postMessage({
                command: 'openInBrowser',
                url: url
            });
        }
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate HTML for a single run selection item
   */
  private generateRunSelectionItemHtml(run: any): string {
    const statusIcon = this.getStatusIcon(run.state, run.result);
    const duration = this.formatDuration(run.createdDate, run.finishedDate);
    
    return `
      <div class="run-item" onclick="toggleRunSelection(${run.id}, this)">
        <div class="run-header">
          <div class="run-info">
            <span class="icon ${statusIcon}"></span>
            <span class="run-id">#${run.id}</span>
            <span class="run-name">${run.name}</span>
          </div>
          <div class="run-meta">
            <span class="status ${run.state} ${run.result || ''}">${this.getStatusText(run.state, run.result)}</span>
            <span class="duration">${duration}</span>
          </div>
        </div>
        <div class="run-details">
          <div class="detail-item">
            <label>Created:</label>
            <span>${this.formatDate(run.createdDate)}</span>
          </div>
          ${run.finishedDate ? `
          <div class="detail-item">
            <label>Finished:</label>
            <span>${this.formatDate(run.finishedDate)}</span>
          </div>
          ` : ''}
          <div class="detail-item">
            <label>Branch:</label>
            <span>${this.getBranchName(run.resources)}</span>
          </div>
        </div>
        <div class="run-actions">
          <button class="btn btn-sm" onclick="event.stopPropagation(); openRunDetails(${run.id})">
            <span class="icon info"></span> Details
          </button>
          <button class="btn btn-sm" onclick="event.stopPropagation(); openInBrowser('${run.url}')">
            <span class="icon external"></span> Browser
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for comparison results
   */
  private getComparisonHtml(comparison: RunComparison): string {
    const webview = this.panel!.webview;
    
    // Get URIs for CSS and JS files
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'runComparison.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'runComparison.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Pipeline Run Comparison</title>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>Pipeline Run Comparison</h1>
            <div class="comparison-header">
                <div class="run-summary">
                    <div class="run-info">
                        <h3>Run #${comparison.runs[0].id}</h3>
                        <div class="run-meta">
                            <span class="status ${comparison.runs[0].state} ${comparison.runs[0].result || ''}">${this.getStatusText(comparison.runs[0].state, comparison.runs[0].result)}</span>
                            <span class="date">${this.formatDate(comparison.runs[0].createdDate)}</span>
                        </div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="run-info">
                        <h3>Run #${comparison.runs[1].id}</h3>
                        <div class="run-meta">
                            <span class="status ${comparison.runs[1].state} ${comparison.runs[1].result || ''}">${this.getStatusText(comparison.runs[1].state, comparison.runs[1].result)}</span>
                            <span class="date">${this.formatDate(comparison.runs[1].createdDate)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="actions">
            <div class="export-actions">
                <button class="btn btn-secondary" onclick="exportComparison('json')">
                    <span class="icon download"></span> Export JSON
                </button>
                <button class="btn btn-secondary" onclick="exportComparison('csv')">
                    <span class="icon download"></span> Export CSV
                </button>
                <button class="btn btn-secondary" onclick="exportComparison('html')">
                    <span class="icon download"></span> Export HTML
                </button>
                <button class="btn btn-secondary" onclick="exportComparison('markdown')">
                    <span class="icon download"></span> Export Markdown
                </button>
            </div>
        </div>

        <!-- Summary -->
        <div class="section">
            <h2>Summary</h2>
            <div class="summary-card ${comparison.summary.overallChange}">
                <div class="summary-header">
                    <span class="summary-icon ${comparison.summary.overallChange}"></span>
                    <span class="summary-text">Overall Change: ${comparison.summary.overallChange.toUpperCase()}</span>
                </div>
                
                ${comparison.summary.improvements.length > 0 ? `
                <div class="summary-section improvements">
                    <h4>Improvements</h4>
                    <ul>
                        ${comparison.summary.improvements.map(improvement => `<li class="improvement">${improvement}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${comparison.summary.regressions.length > 0 ? `
                <div class="summary-section regressions">
                    <h4>Regressions</h4>
                    <ul>
                        ${comparison.summary.regressions.map(regression => `<li class="regression">${regression}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Metrics -->
        <div class="section">
            <h2>Metrics Comparison</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Duration</span>
                        <span class="metric-change ${comparison.metrics.duration.percentageChange < 0 ? 'improvement' : comparison.metrics.duration.percentageChange > 0 ? 'regression' : 'neutral'}">
                            ${comparison.metrics.duration.percentageChange.toFixed(1)}%
                        </span>
                    </div>
                    <div class="metric-values">
                        <div class="metric-value">
                            <label>Run 1:</label>
                            <span>${this.formatDuration(comparison.metrics.duration.run1)}</span>
                        </div>
                        <div class="metric-value">
                            <label>Run 2:</label>
                            <span>${this.formatDuration(comparison.metrics.duration.run2)}</span>
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Success Rate</span>
                        <span class="metric-change ${comparison.metrics.successRate.difference > 0 ? 'improvement' : comparison.metrics.successRate.difference < 0 ? 'regression' : 'neutral'}">
                            ${comparison.metrics.successRate.difference > 0 ? '+' : ''}${comparison.metrics.successRate.difference.toFixed(1)}%
                        </span>
                    </div>
                    <div class="metric-values">
                        <div class="metric-value">
                            <label>Run 1:</label>
                            <span>${comparison.metrics.successRate.run1.toFixed(1)}%</span>
                        </div>
                        <div class="metric-value">
                            <label>Run 2:</label>
                            <span>${comparison.metrics.successRate.run2.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Errors</span>
                        <span class="metric-change ${comparison.metrics.issues.errorDifference < 0 ? 'improvement' : comparison.metrics.issues.errorDifference > 0 ? 'regression' : 'neutral'}">
                            ${comparison.metrics.issues.errorDifference > 0 ? '+' : ''}${comparison.metrics.issues.errorDifference}
                        </span>
                    </div>
                    <div class="metric-values">
                        <div class="metric-value">
                            <label>Run 1:</label>
                            <span>${comparison.metrics.issues.run1.errors}</span>
                        </div>
                        <div class="metric-value">
                            <label>Run 2:</label>
                            <span>${comparison.metrics.issues.run2.errors}</span>
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Warnings</span>
                        <span class="metric-change ${comparison.metrics.issues.warningDifference < 0 ? 'improvement' : comparison.metrics.issues.warningDifference > 0 ? 'regression' : 'neutral'}">
                            ${comparison.metrics.issues.warningDifference > 0 ? '+' : ''}${comparison.metrics.issues.warningDifference}
                        </span>
                    </div>
                    <div class="metric-values">
                        <div class="metric-value">
                            <label>Run 1:</label>
                            <span>${comparison.metrics.issues.run1.warnings}</span>
                        </div>
                        <div class="metric-value">
                            <label>Run 2:</label>
                            <span>${comparison.metrics.issues.run2.warnings}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Stage Comparison -->
        <div class="section">
            <h2>Stage Comparison</h2>
            <div class="comparison-table">
                <table>
                    <thead>
                        <tr>
                            <th>Stage</th>
                            <th>Status</th>
                            <th>Run 1 Result</th>
                            <th>Run 2 Result</th>
                            <th>Run 1 Duration</th>
                            <th>Run 2 Duration</th>
                            <th>Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparison.stageComparisons.map(stage => this.generateStageComparisonRowHtml(stage)).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Job Comparison -->
        <div class="section">
            <h2>Job Comparison</h2>
            <div class="comparison-table">
                <table>
                    <thead>
                        <tr>
                            <th>Job</th>
                            <th>Stage</th>
                            <th>Status</th>
                            <th>Run 1 Result</th>
                            <th>Run 2 Result</th>
                            <th>Run 1 Duration</th>
                            <th>Run 2 Duration</th>
                            <th>Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparison.jobComparisons.map(job => this.generateJobComparisonRowHtml(job)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const comparisonData = ${JSON.stringify(comparison)};
        
        function exportComparison(format) {
            vscode.postMessage({
                command: 'exportComparison',
                comparison: comparisonData,
                format: format,
                config: {
                    includeTaskDetails: true,
                    includeCharts: false,
                    summaryOnly: false,
                    title: 'Pipeline Run Comparison: #' + comparisonData.runs[0].id + ' vs #' + comparisonData.runs[1].id
                }
            });
        }
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate HTML for stage comparison row
   */
  private generateStageComparisonRowHtml(stage: any): string {
    const statusClass = stage.status.replace('_', '-');
    const changeClass = stage.duration.percentageChange !== null ? 
      (stage.duration.percentageChange < -5 ? 'improvement' : 
       stage.duration.percentageChange > 5 ? 'regression' : 'neutral') : 'neutral';
    
    return `
      <tr class="status-${statusClass}">
        <td>${stage.stageName}</td>
        <td><span class="status-badge ${statusClass}">${stage.status.replace('_', ' ')}</span></td>
        <td>${stage.result.run1 || 'N/A'}</td>
        <td>${stage.result.run2 || 'N/A'}</td>
        <td>${stage.duration.run1 !== null ? this.formatDuration(stage.duration.run1) : 'N/A'}</td>
        <td>${stage.duration.run2 !== null ? this.formatDuration(stage.duration.run2) : 'N/A'}</td>
        <td class="${changeClass}">
          ${stage.duration.percentageChange !== null ? 
            (stage.duration.percentageChange > 0 ? '+' : '') + stage.duration.percentageChange.toFixed(1) + '%' : 
            'N/A'}
        </td>
      </tr>
    `;
  }

  /**
   * Generate HTML for job comparison row
   */
  private generateJobComparisonRowHtml(job: any): string {
    const statusClass = job.status.replace('_', '-');
    const changeClass = job.duration.percentageChange !== null ? 
      (job.duration.percentageChange < -5 ? 'improvement' : 
       job.duration.percentageChange > 5 ? 'regression' : 'neutral') : 'neutral';
    
    return `
      <tr class="status-${statusClass}">
        <td>${job.jobName}</td>
        <td>${job.stageId}</td>
        <td><span class="status-badge ${statusClass}">${job.status.replace('_', ' ')}</span></td>
        <td>${job.result.run1 || 'N/A'}</td>
        <td>${job.result.run2 || 'N/A'}</td>
        <td>${job.duration.run1 !== null ? this.formatDuration(job.duration.run1) : 'N/A'}</td>
        <td>${job.duration.run2 !== null ? this.formatDuration(job.duration.run2) : 'N/A'}</td>
        <td class="${changeClass}">
          ${job.duration.percentageChange !== null ? 
            (job.duration.percentageChange > 0 ? '+' : '') + job.duration.percentageChange.toFixed(1) + '%' : 
            'N/A'}
        </td>
      </tr>
    `;
  }

  // Helper methods (similar to RunDetailsWebviewProvider)
  
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

  private formatDuration(startTime?: Date | number, finishTime?: Date): string {
    let duration: number;
    
    if (typeof startTime === 'number') {
      duration = startTime; // Already in milliseconds
    } else if (startTime instanceof Date) {
      const end = finishTime || new Date();
      duration = end.getTime() - startTime.getTime();
    } else {
      return 'N/A';
    }
    
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

  private formatDate(date: Date): string {
    return date.toLocaleString();
  }

  private getBranchName(resources: any): string {
    if (resources?.repositories) {
      const repo = Object.values(resources.repositories)[0] as any;
      if (repo?.refName) {
        return repo.refName.replace('refs/heads/', '');
      }
    }
    return 'N/A';
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}