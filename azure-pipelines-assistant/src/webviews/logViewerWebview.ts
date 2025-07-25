import * as vscode from 'vscode';
import { IAzureDevOpsService } from '../interfaces';
import { LogEntry } from '../models';

/**
 * Webview provider for displaying pipeline logs with filtering and search capabilities
 */
export class LogViewerWebviewProvider {
  private static readonly viewType = 'azurePipelinesAssistant.logViewer';
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private currentLogs: LogEntry[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly azureDevOpsService: IAzureDevOpsService
  ) {}

  /**
   * Show logs for a specific pipeline run
   */
  public async showLogs(runId: number, projectId: string, pipelineId?: number, jobId?: string, taskId?: string): Promise<void> {
    try {
      // Fetch logs from the service
      let logs: LogEntry[];
      if (pipelineId && (jobId || taskId)) {
        logs = await this.azureDevOpsService.getLogs(runId, pipelineId, projectId, jobId, taskId);
      } else {
        logs = await this.azureDevOpsService.getRunLogs(runId, projectId);
      }

      this.currentLogs = logs;

      // Create or show the webview panel
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Two);
      } else {
        const title = jobId ? `Logs - Job ${jobId}` : taskId ? `Logs - Task ${taskId}` : `Logs - Run #${runId}`;
        
        this.panel = vscode.window.createWebviewPanel(
          LogViewerWebviewProvider.viewType,
          title,
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            enableFindWidget: true,
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
          message => this.handleMessage(message, runId, projectId, pipelineId, jobId, taskId),
          undefined,
          this.disposables
        );
      }

      // Update the webview content
      this.panel.webview.html = this.getWebviewContent(logs, runId, projectId, pipelineId, jobId, taskId);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load logs: ${error}`);
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(
    message: any, 
    runId: number, 
    projectId: string, 
    pipelineId?: number, 
    jobId?: string, 
    taskId?: string
  ): Promise<void> {
    switch (message.command) {
      case 'refresh':
        // Refresh the logs
        try {
          let logs: LogEntry[];
          if (pipelineId && (jobId || taskId)) {
            logs = await this.azureDevOpsService.getLogs(runId, pipelineId, projectId, jobId, taskId);
          } else {
            logs = await this.azureDevOpsService.getRunLogs(runId, projectId);
          }
          
          this.currentLogs = logs;
          this.panel?.webview.postMessage({
            command: 'updateLogs',
            data: logs
          });
        } catch (error) {
          this.panel?.webview.postMessage({
            command: 'error',
            message: `Failed to refresh logs: ${error}`
          });
        }
        break;

      case 'downloadLogs':
        await this.downloadLogs(runId, projectId, pipelineId, jobId, taskId);
        break;

      case 'filterLogs':
        const filteredLogs = this.filterLogs(this.currentLogs, message.filters);
        this.panel?.webview.postMessage({
          command: 'updateFilteredLogs',
          data: filteredLogs
        });
        break;

      case 'searchLogs':
        const searchResults = this.searchLogs(this.currentLogs, message.searchTerm);
        this.panel?.webview.postMessage({
          command: 'updateSearchResults',
          data: searchResults
        });
        break;
    }
  }

  /**
   * Filter logs based on criteria
   */
  private filterLogs(logs: LogEntry[], filters: any): LogEntry[] {
    return logs.filter(log => {
      // Filter by severity level
      if (filters.levels && filters.levels.length > 0) {
        if (!filters.levels.includes(log.level)) {
          return false;
        }
      }

      // Filter by keyword
      if (filters.keyword && filters.keyword.trim()) {
        const keyword = filters.keyword.toLowerCase();
        if (!log.message.toLowerCase().includes(keyword) && 
            !(log.source && log.source.toLowerCase().includes(keyword))) {
          return false;
        }
      }

      // Filter by time range
      if (filters.startTime && log.timestamp < new Date(filters.startTime)) {
        return false;
      }
      if (filters.endTime && log.timestamp > new Date(filters.endTime)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Search logs for specific terms
   */
  private searchLogs(logs: LogEntry[], searchTerm: string): { logs: LogEntry[], matches: number[] } {
    if (!searchTerm || !searchTerm.trim()) {
      return { logs, matches: [] };
    }

    const term = searchTerm.toLowerCase();
    const matches: number[] = [];
    
    logs.forEach((log, index) => {
      if (log.message.toLowerCase().includes(term) || 
          (log.source && log.source.toLowerCase().includes(term))) {
        matches.push(index);
      }
    });

    return { logs, matches };
  }

  /**
   * Download logs to a file
   */
  private async downloadLogs(runId: number, projectId: string, pipelineId?: number, jobId?: string, taskId?: string): Promise<void> {
    try {
      const defaultFileName = `pipeline-logs-run-${runId}${jobId ? `-job-${jobId}` : ''}${taskId ? `-task-${taskId}` : ''}.txt`;
      
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFileName),
        filters: {
          'Text Files': ['txt'],
          'All Files': ['*']
        }
      });

      if (saveUri) {
        const logContent = this.currentLogs
          .map(log => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`)
          .join('\n');

        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(logContent, 'utf8'));
        vscode.window.showInformationMessage(`Logs saved to ${saveUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to download logs: ${error}`);
    }
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(
    logs: LogEntry[], 
    runId: number, 
    projectId: string, 
    pipelineId?: number, 
    jobId?: string, 
    taskId?: string
  ): string {
    const webview = this.panel!.webview;
    
    // Get URIs for CSS and JS files
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'logViewer.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'logViewer.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Pipeline Logs</title>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="log-info">
                <h1>
                    <span class="log-icon"></span>
                    Pipeline Logs - Run #${runId}
                    ${jobId ? ` - Job ${jobId}` : ''}
                    ${taskId ? ` - Task ${taskId}` : ''}
                </h1>
                <div class="log-meta">
                    <span class="count">${logs.length} log entries</span>
                    <span class="levels">
                        ${this.getLogLevelCounts(logs)}
                    </span>
                </div>
            </div>
            <div class="actions">
                <button class="btn btn-secondary" onclick="refreshLogs()">
                    <span class="icon refresh"></span> Refresh
                </button>
                <button class="btn btn-secondary" onclick="downloadLogs()">
                    <span class="icon download"></span> Download
                </button>
            </div>
        </div>

        <!-- Filters and Search -->
        <div class="controls">
            <div class="search-section">
                <div class="search-box">
                    <input type="text" id="searchInput" placeholder="Search logs..." onkeyup="handleSearch(event)">
                    <button class="btn btn-sm" onclick="searchLogs()">
                        <span class="icon search"></span>
                    </button>
                    <button class="btn btn-sm" onclick="clearSearch()">
                        <span class="icon clear"></span>
                    </button>
                </div>
                <div class="search-navigation" id="searchNavigation" style="display: none;">
                    <span id="searchResults">0 matches</span>
                    <button class="btn btn-sm" onclick="previousMatch()">
                        <span class="icon up"></span>
                    </button>
                    <button class="btn btn-sm" onclick="nextMatch()">
                        <span class="icon down"></span>
                    </button>
                </div>
            </div>
            
            <div class="filter-section">
                <div class="filter-group">
                    <label>Levels:</label>
                    <div class="level-filters">
                        <label><input type="checkbox" value="debug" onchange="updateFilters()" checked> Debug</label>
                        <label><input type="checkbox" value="info" onchange="updateFilters()" checked> Info</label>
                        <label><input type="checkbox" value="warning" onchange="updateFilters()" checked> Warning</label>
                        <label><input type="checkbox" value="error" onchange="updateFilters()" checked> Error</label>
                    </div>
                </div>
                
                <div class="filter-group">
                    <label>Keyword:</label>
                    <input type="text" id="keywordFilter" placeholder="Filter by keyword..." onkeyup="updateFilters()">
                </div>
                
                <div class="filter-group">
                    <label>Time Range:</label>
                    <input type="datetime-local" id="startTime" onchange="updateFilters()">
                    <span>to</span>
                    <input type="datetime-local" id="endTime" onchange="updateFilters()">
                </div>
                
                <button class="btn btn-sm" onclick="clearFilters()">Clear Filters</button>
            </div>
        </div>

        <!-- Log Content -->
        <div class="log-content">
            <div class="log-entries" id="logEntries">
                ${this.generateLogEntriesHtml(logs)}
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const logData = ${JSON.stringify(logs)};
        let currentMatches = [];
        let currentMatchIndex = -1;
        
        function refreshLogs() {
            vscode.postMessage({
                command: 'refresh'
            });
        }
        
        function downloadLogs() {
            vscode.postMessage({
                command: 'downloadLogs'
            });
        }
        
        function updateFilters() {
            const levels = Array.from(document.querySelectorAll('.level-filters input:checked'))
                .map(input => input.value);
            const keyword = document.getElementById('keywordFilter').value;
            const startTime = document.getElementById('startTime').value;
            const endTime = document.getElementById('endTime').value;
            
            vscode.postMessage({
                command: 'filterLogs',
                filters: {
                    levels: levels,
                    keyword: keyword,
                    startTime: startTime,
                    endTime: endTime
                }
            });
        }
        
        function clearFilters() {
            document.querySelectorAll('.level-filters input').forEach(input => input.checked = true);
            document.getElementById('keywordFilter').value = '';
            document.getElementById('startTime').value = '';
            document.getElementById('endTime').value = '';
            updateFilters();
        }
        
        function handleSearch(event) {
            if (event.key === 'Enter') {
                searchLogs();
            }
        }
        
        function searchLogs() {
            const searchTerm = document.getElementById('searchInput').value;
            vscode.postMessage({
                command: 'searchLogs',
                searchTerm: searchTerm
            });
        }
        
        function clearSearch() {
            document.getElementById('searchInput').value = '';
            document.getElementById('searchNavigation').style.display = 'none';
            clearHighlights();
        }
        
        function previousMatch() {
            if (currentMatches.length > 0) {
                currentMatchIndex = (currentMatchIndex - 1 + currentMatches.length) % currentMatches.length;
                scrollToMatch(currentMatchIndex);
            }
        }
        
        function nextMatch() {
            if (currentMatches.length > 0) {
                currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
                scrollToMatch(currentMatchIndex);
            }
        }
        
        function scrollToMatch(index) {
            const matchElement = document.querySelector(\`.log-entry[data-index="\${currentMatches[index]}"]\`);
            if (matchElement) {
                matchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Update current match indicator
                document.querySelectorAll('.current-match').forEach(el => el.classList.remove('current-match'));
                matchElement.classList.add('current-match');
            }
        }
        
        function clearHighlights() {
            document.querySelectorAll('.highlight').forEach(el => {
                el.outerHTML = el.innerHTML;
            });
            document.querySelectorAll('.current-match').forEach(el => el.classList.remove('current-match'));
            currentMatches = [];
            currentMatchIndex = -1;
        }
        
        function highlightSearchTerm(text, term) {
            if (!term) return text;
            // This function is implemented in logViewer.js
            return window.highlightSearchTermImpl ? window.highlightSearchTermImpl(text, term) : text;
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateLogs':
                    updateLogEntries(message.data);
                    break;
                case 'updateFilteredLogs':
                    updateLogEntries(message.data);
                    break;
                case 'updateSearchResults':
                    handleSearchResults(message.data);
                    break;
                case 'error':
                    alert('Error: ' + message.message);
                    break;
            }
        });
        
        function updateLogEntries(logs) {
            const container = document.getElementById('logEntries');
            container.innerHTML = generateLogEntriesHtml(logs);
            
            // Update count
            document.querySelector('.count').textContent = \`\${logs.length} log entries\`;
        }
        
        function handleSearchResults(data) {
            const { logs, matches } = data;
            currentMatches = matches;
            currentMatchIndex = matches.length > 0 ? 0 : -1;
            
            // Update search navigation
            const navigation = document.getElementById('searchNavigation');
            const results = document.getElementById('searchResults');
            
            if (matches.length > 0) {
                navigation.style.display = 'flex';
                results.textContent = \`\${matches.length} matches\`;
                
                // Highlight matches and scroll to first
                const searchTerm = document.getElementById('searchInput').value;
                highlightMatches(logs, searchTerm, matches);
                scrollToMatch(0);
            } else {
                navigation.style.display = 'none';
                clearHighlights();
            }
        }
        
        function highlightMatches(logs, searchTerm, matches) {
            clearHighlights();
            
            matches.forEach(matchIndex => {
                const logEntry = document.querySelector(\`.log-entry[data-index="\${matchIndex}"]\`);
                if (logEntry) {
                    const messageElement = logEntry.querySelector('.message');
                    const sourceElement = logEntry.querySelector('.source');
                    
                    if (messageElement) {
                        messageElement.innerHTML = highlightSearchTerm(messageElement.textContent, searchTerm);
                    }
                    if (sourceElement) {
                        sourceElement.innerHTML = highlightSearchTerm(sourceElement.textContent, searchTerm);
                    }
                }
            });
        }
        
        function generateLogEntriesHtml(logs) {
            return logs.map((log, index) => \`
                <div class="log-entry \${log.level}" data-index="\${index}">
                    <div class="log-header">
                        <span class="timestamp">\${new Date(log.timestamp).toLocaleString()}</span>
                        <span class="level \${log.level}">\${log.level.toUpperCase()}</span>
                        \${log.source ? \`<span class="source">\${log.source}</span>\` : ''}
                        \${log.lineNumber ? \`<span class="line-number">Line \${log.lineNumber}</span>\` : ''}
                    </div>
                    <div class="message">\${log.message}</div>
                </div>
            \`).join('');
        }
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate HTML for log entries
   */
  private generateLogEntriesHtml(logs: LogEntry[]): string {
    return logs.map((log, index) => `
      <div class="log-entry ${log.level}" data-index="${index}">
        <div class="log-header">
          <span class="timestamp">${log.timestamp.toLocaleString()}</span>
          <span class="level ${log.level}">${log.level.toUpperCase()}</span>
          ${log.source ? `<span class="source">${log.source}</span>` : ''}
          ${log.lineNumber ? `<span class="line-number">Line ${log.lineNumber}</span>` : ''}
        </div>
        <div class="message">${this.escapeHtml(log.message)}</div>
      </div>
    `).join('');
  }

  /**
   * Get log level counts for display
   */
  private getLogLevelCounts(logs: LogEntry[]): string {
    const counts = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([level, count]) => `<span class="level-count ${level}">${level}: ${count}</span>`)
      .join(' ');
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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