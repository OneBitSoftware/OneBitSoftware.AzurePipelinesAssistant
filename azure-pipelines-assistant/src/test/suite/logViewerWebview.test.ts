import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { LogViewerWebviewProvider } from '../../webviews/logViewerWebview';
import { IAzureDevOpsService } from '../../interfaces';
import { LogEntry } from '../../models';

suite('LogViewerWebviewProvider', () => {
  let logViewerProvider: LogViewerWebviewProvider;
  let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
  let mockContext: vscode.ExtensionContext;
  let mockPanel: sinon.SinonStubbedInstance<vscode.WebviewPanel>;
  let mockWebview: sinon.SinonStubbedInstance<vscode.Webview>;

  const sampleLogEntries: LogEntry[] = [
    {
      id: 1,
      timestamp: new Date('2023-01-01T10:00:00Z'),
      level: 'info',
      message: 'Pipeline started',
      source: 'System',
      lineNumber: 1
    },
    {
      id: 2,
      timestamp: new Date('2023-01-01T10:01:00Z'),
      level: 'debug',
      message: 'Initializing build environment',
      source: 'Build',
      lineNumber: 2
    },
    {
      id: 3,
      timestamp: new Date('2023-01-01T10:02:00Z'),
      level: 'warning',
      message: 'Deprecated package detected',
      source: 'Package Manager',
      lineNumber: 3
    },
    {
      id: 4,
      timestamp: new Date('2023-01-01T10:03:00Z'),
      level: 'error',
      message: 'Build failed with exit code 1',
      source: 'Build',
      lineNumber: 4
    }
  ];

  setup(() => {
    // Create mock Azure DevOps service
    mockAzureDevOpsService = {
      getRunLogs: sinon.stub().resolves(sampleLogEntries),
      getLogs: sinon.stub().resolves(sampleLogEntries)
    } as any;

    // Create mock extension context
    mockContext = {
      extensionUri: vscode.Uri.file('/mock/extension/path'),
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      secrets: {} as any,
      extensionPath: '/mock/extension/path',
      storagePath: '/mock/storage/path',
      globalStoragePath: '/mock/global/storage/path',
      logPath: '/mock/log/path',
      extensionMode: vscode.ExtensionMode.Test,
      asAbsolutePath: sinon.stub().returns('/mock/absolute/path')
    } as any;

    // Create mock webview and panel
    mockWebview = {
      html: '',
      options: {},
      cspSource: 'vscode-webview:',
      asWebviewUri: sinon.stub().returns(vscode.Uri.file('/mock/webview/uri')),
      postMessage: sinon.stub().resolves(true),
      onDidReceiveMessage: sinon.stub().returns({ dispose: sinon.stub() })
    } as any;

    mockPanel = {
      webview: mockWebview,
      title: 'Test Log Viewer',
      viewType: 'azurePipelinesAssistant.logViewer',
      viewColumn: vscode.ViewColumn.Two,
      active: true,
      visible: true,
      reveal: sinon.stub(),
      dispose: sinon.stub(),
      onDidDispose: sinon.stub().returns({ dispose: sinon.stub() }),
      onDidChangeViewState: sinon.stub().returns({ dispose: sinon.stub() })
    } as any;

    // Stub vscode.window.createWebviewPanel
    sinon.stub(vscode.window, 'createWebviewPanel').returns(mockPanel);

    // Create log viewer provider
    logViewerProvider = new LogViewerWebviewProvider(mockContext, mockAzureDevOpsService);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('showLogs', () => {
    test('should create webview panel for run logs', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      assert.ok((vscode.window.createWebviewPanel as any).calledOnce);
      assert.ok((mockAzureDevOpsService.getRunLogs as any).calledWith(runId, projectId));
      assert.strictEqual(mockPanel.webview.html.length > 0, true);
    });

    test('should create webview panel for job logs', async () => {
      const runId = 123;
      const projectId = 'test-project';
      const pipelineId = 456;
      const jobId = 'job-1';

      await logViewerProvider.showLogs(runId, projectId, pipelineId, jobId);

      assert.ok((vscode.window.createWebviewPanel as any).calledOnce);
      assert.ok((mockAzureDevOpsService.getLogs as any).calledWith(runId, pipelineId, projectId, jobId, undefined));
      assert.strictEqual(mockPanel.webview.html.length > 0, true);
    });

    test('should create webview panel for task logs', async () => {
      const runId = 123;
      const projectId = 'test-project';
      const pipelineId = 456;
      const jobId = 'job-1';
      const taskId = 'task-1';

      await logViewerProvider.showLogs(runId, projectId, pipelineId, jobId, taskId);

      assert.ok((vscode.window.createWebviewPanel as any).calledOnce);
      assert.ok((mockAzureDevOpsService.getLogs as any).calledWith(runId, pipelineId, projectId, jobId, taskId));
      assert.strictEqual(mockPanel.webview.html.length > 0, true);
    });

    test('should reuse existing panel if available', async () => {
      const runId = 123;
      const projectId = 'test-project';

      // First call creates panel
      await logViewerProvider.showLogs(runId, projectId);
      assert.ok((vscode.window.createWebviewPanel as any).calledOnce);

      // Second call should reuse panel
      await logViewerProvider.showLogs(runId, projectId);
      assert.ok((vscode.window.createWebviewPanel as any).calledOnce); // Still only called once
      assert.ok((mockPanel.reveal as any).calledOnce);
    });

    test('should handle service errors gracefully', async () => {
      const runId = 123;
      const projectId = 'test-project';
      const error = new Error('Service error');

      mockAzureDevOpsService.getRunLogs.rejects(error);
      
      const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');

      await logViewerProvider.showLogs(runId, projectId);

      assert.ok(showErrorMessageStub.calledWith(`Failed to load logs: ${error}`));
    });
  });

  suite('HTML Generation', () => {
    test('should generate valid HTML content', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const html = mockPanel.webview.html;
      
      // Check for essential HTML structure
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('<html lang="en">'));
      assert.ok(html.includes('<head>'));
      assert.ok(html.includes('<body>'));
      assert.ok(html.includes('Pipeline Logs'));
      assert.ok(html.includes('log-entries'));
    });

    test('should include log entries in HTML', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const html = mockPanel.webview.html;
      
      // Check for log entry content
      assert.ok(html.includes('Pipeline started'));
      assert.ok(html.includes('Build failed with exit code 1'));
      assert.ok(html.includes('level info'));
      assert.ok(html.includes('level error'));
    });

    test('should include search and filter controls', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const html = mockPanel.webview.html;
      
      // Check for search and filter elements
      assert.ok(html.includes('searchInput'));
      assert.ok(html.includes('keywordFilter'));
      assert.ok(html.includes('level-filters'));
      assert.ok(html.includes('startTime'));
      assert.ok(html.includes('endTime'));
    });

    test('should include action buttons', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const html = mockPanel.webview.html;
      
      // Check for action buttons
      assert.ok(html.includes('refreshLogs()'));
      assert.ok(html.includes('downloadLogs()'));
      assert.ok(html.includes('searchLogs()'));
      assert.ok(html.includes('clearSearch()'));
    });
  });

  suite('Message Handling', () => {
    test('should handle refresh message', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      // Get the message handler
      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Simulate refresh message
      await messageHandler({ command: 'refresh' });

      // Should call service again
      assert.ok((mockAzureDevOpsService.getRunLogs as any).calledTwice);
    });

    test('should handle downloadLogs message', async () => {
      const runId = 123;
      const projectId = 'test-project';

      // Stub file dialog
      const mockUri = vscode.Uri.file('/mock/save/path.txt');
      sinon.stub(vscode.window, 'showSaveDialog').resolves(mockUri);
      sinon.stub(vscode.workspace.fs, 'writeFile').resolves();
      const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage');

      await logViewerProvider.showLogs(runId, projectId);

      // Get the message handler
      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Simulate download message
      await messageHandler({ command: 'downloadLogs' });

      assert.ok(showInfoStub.calledWith(`Logs saved to ${mockUri.fsPath}`));
    });

    test('should handle filterLogs message', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      // Get the message handler
      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Simulate filter message
      await messageHandler({
        command: 'filterLogs',
        filters: {
          levels: ['error', 'warning'],
          keyword: 'build',
          startTime: '2023-01-01T10:00:00Z',
          endTime: '2023-01-01T10:05:00Z'
        }
      });

      // Should post filtered results back
      assert.ok((mockWebview.postMessage as any).calledWith({
        command: 'updateFilteredLogs',
        data: sinon.match.array
      }));
    });

    test('should handle searchLogs message', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      // Get the message handler
      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Simulate search message
      await messageHandler({
        command: 'searchLogs',
        searchTerm: 'build'
      });

      // Should post search results back
      assert.ok((mockWebview.postMessage as any).calledWith({
        command: 'updateSearchResults',
        data: sinon.match.object
      }));
    });
  });

  suite('Log Filtering', () => {
    test('should filter logs by level', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      // Get the message handler to access private methods through message handling
      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Filter for only error logs
      await messageHandler({
        command: 'filterLogs',
        filters: {
          levels: ['error']
        }
      });

      // Check that postMessage was called with filtered data
      const postMessageCall = (mockWebview.postMessage as any).getCall(0);
      assert.strictEqual(postMessageCall.args[0].command, 'updateFilteredLogs');
      
      const filteredLogs = postMessageCall.args[0].data;
      assert.strictEqual(filteredLogs.length, 1);
      assert.strictEqual(filteredLogs[0].level, 'error');
    });

    test('should filter logs by keyword', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Filter for logs containing 'build'
      await messageHandler({
        command: 'filterLogs',
        filters: {
          keyword: 'build'
        }
      });

      const postMessageCall = (mockWebview.postMessage as any).getCall(0);
      const filteredLogs = postMessageCall.args[0].data;
      
      // Should find logs with 'build' in message or source
      assert.ok(filteredLogs.length > 0);
      filteredLogs.forEach((log: LogEntry) => {
        assert.ok(
          log.message.toLowerCase().includes('build') || 
          (log.source && log.source.toLowerCase().includes('build'))
        );
      });
    });

    test('should filter logs by time range', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Filter for logs in a specific time range
      await messageHandler({
        command: 'filterLogs',
        filters: {
          startTime: '2023-01-01T10:01:00Z',
          endTime: '2023-01-01T10:02:30Z'
        }
      });

      const postMessageCall = (mockWebview.postMessage as any).getCall(0);
      const filteredLogs = postMessageCall.args[0].data;
      
      // Should only include logs within the time range
      filteredLogs.forEach((log: LogEntry) => {
        assert.ok(log.timestamp >= new Date('2023-01-01T10:01:00Z'));
        assert.ok(log.timestamp <= new Date('2023-01-01T10:02:30Z'));
      });
    });
  });

  suite('Log Search', () => {
    test('should search logs and return matches', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Search for 'build'
      await messageHandler({
        command: 'searchLogs',
        searchTerm: 'build'
      });

      const postMessageCall = (mockWebview.postMessage as any).getCall(0);
      assert.strictEqual(postMessageCall.args[0].command, 'updateSearchResults');
      
      const searchResults = postMessageCall.args[0].data;
      assert.ok(searchResults.logs);
      assert.ok(searchResults.matches);
      assert.ok(Array.isArray(searchResults.matches));
      assert.ok(searchResults.matches.length > 0);
    });

    test('should handle empty search term', async () => {
      const runId = 123;
      const projectId = 'test-project';

      await logViewerProvider.showLogs(runId, projectId);

      const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];

      // Search with empty term
      await messageHandler({
        command: 'searchLogs',
        searchTerm: ''
      });

      const postMessageCall = (mockWebview.postMessage as any).getCall(0);
      const searchResults = postMessageCall.args[0].data;
      
      // Should return all logs with no matches
      assert.strictEqual(searchResults.logs.length, sampleLogEntries.length);
      assert.strictEqual(searchResults.matches.length, 0);
    });
  });

  suite('Disposal', () => {
    test('should dispose resources properly', () => {
      const disposeSpy = sinon.spy();
      
      // Mock disposable
      const mockDisposable = { dispose: disposeSpy };
      
      // Simulate adding disposables
      (logViewerProvider as any).disposables = [mockDisposable];
      
      logViewerProvider.dispose();
      
      assert.ok(disposeSpy.calledOnce);
    });
  });
});