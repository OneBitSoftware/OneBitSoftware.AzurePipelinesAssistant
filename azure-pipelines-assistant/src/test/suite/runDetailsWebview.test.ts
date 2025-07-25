import { suite, test } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { RunDetailsWebviewProvider } from '../../webviews/runDetailsWebview';
import { IAzureDevOpsService } from '../../interfaces';
import { PipelineRunDetails, Stage, Job, Task, RunResources } from '../../models';

suite('Run Details Webview Test Suite', () => {
  let webviewProvider: RunDetailsWebviewProvider;
  let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    // Create mock context
    mockContext = {
      extensionUri: vscode.Uri.file('/test/extension'),
      subscriptions: []
    } as any;

    // Create mock Azure DevOps service
    mockAzureDevOpsService = {
      getRunDetails: sinon.stub(),
      cancelRun: sinon.stub(),
      getProjects: sinon.stub(),
      getPipelines: sinon.stub(),
      getPipelineRuns: sinon.stub(),
      triggerPipelineRun: sinon.stub(),
      getRunLogs: sinon.stub(),
      downloadArtifacts: sinon.stub(),
      triggerRun: sinon.stub(),
      getLogs: sinon.stub(),
      refreshProject: sinon.stub(),
      refreshPipeline: sinon.stub(),
      clearCache: sinon.stub()
    } as any;

    // Create webview provider
    webviewProvider = new RunDetailsWebviewProvider(mockContext, mockAzureDevOpsService);
  });

  teardown(() => {
    sinon.restore();
    webviewProvider.dispose();
  });

  const createMockRunDetails = (overrides: Partial<PipelineRunDetails> = {}): PipelineRunDetails => ({
    id: 123,
    name: 'Test Run',
    state: 'completed',
    result: 'succeeded',
    createdDate: new Date(),
    pipeline: {
      id: 456,
      name: 'Test Pipeline',
      project: { id: 'test-project', name: 'Test Project' }
    } as any,
    resources: {
      repositories: {},
      pipelines: {},
      builds: {},
      containers: {},
      packages: {}
    } as RunResources,
    variables: {},
    url: 'https://test.com/run/123',
    stages: [],
    ...overrides
  });

  test('should create webview provider', () => {
    assert.ok(webviewProvider);
  });

  test('should reject invalid run items', async () => {
    const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
    
    const invalidItem = {
      data: { type: 'invalid' }
    };

    await webviewProvider.showRunDetails(invalidItem);
    
    assert.ok(showErrorMessageStub.calledWith('Invalid run item provided'));
  });

  test('should handle run details loading error', async () => {
    const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
    
    const runItem = {
      data: {
        id: 123,
        pipeline: {
          id: 456,
          project: { id: 'test-project' }
        }
      }
    };

    // Mock the type guard to return true
    sinon.stub(require('../../models/treeItems'), 'isPipelineRunTreeItem').returns(true);

    // Mock service to throw error
    mockAzureDevOpsService.getRunDetails.rejects(new Error('API Error'));

    await webviewProvider.showRunDetails(runItem);
    
    assert.ok(showErrorMessageStub.calledWith('Failed to load run details: Error: API Error'));
  });

  test('should create webview panel for valid run item', async () => {
    const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: sinon.stub().returns(vscode.Uri.file('/test/uri')),
        cspSource: 'test-csp',
        postMessage: sinon.stub(),
        onDidReceiveMessage: sinon.stub()
      },
      onDidDispose: sinon.stub(),
      reveal: sinon.stub()
    };
    createWebviewPanelStub.returns(mockPanel as any);

    const runItem = {
      data: {
        id: 123,
        name: 'Test Run',
        pipeline: {
          id: 456,
          name: 'Test Pipeline',
          project: { 
            id: 'test-project',
            name: 'Test Project'
          }
        }
      }
    };

    // Mock the type guard to return true
    sinon.stub(require('../../models/treeItems'), 'isPipelineRunTreeItem').returns(true);

    // Mock successful run details response
    const mockRunDetails = createMockRunDetails({
      finishedDate: new Date(),
      stages: [
        {
          id: 'stage1',
          name: 'build',
          displayName: 'Build',
          state: 'completed',
          result: 'succeeded',
          startTime: new Date(),
          finishTime: new Date(),
          jobs: [
            {
              id: 'job1',
              name: 'build-job',
              displayName: 'Build Job',
              state: 'completed',
              result: 'succeeded',
              startTime: new Date(),
              finishTime: new Date(),
              agentName: 'test-agent',
              tasks: [
                {
                  id: 'task1',
                  name: 'build-task',
                  displayName: 'Build Task',
                  state: 'completed',
                  result: 'succeeded',
                  startTime: new Date(),
                  finishTime: new Date()
                } as Task
              ]
            } as Job
          ],
          dependsOn: []
        } as Stage
      ]
    });

    mockAzureDevOpsService.getRunDetails.resolves(mockRunDetails);

    await webviewProvider.showRunDetails(runItem);

    assert.ok(createWebviewPanelStub.calledOnce);
    assert.ok(createWebviewPanelStub.calledWith(
      'azurePipelinesAssistant.runDetails',
      'Run #123 - Test Pipeline',
      vscode.ViewColumn.One
    ));
  });

  test('should handle refresh message', async () => {
    const runItem = {
      data: {
        id: 123,
        pipeline: {
          id: 456,
          project: { id: 'test-project' }
        }
      }
    };

    // Mock the type guard to return true
    sinon.stub(require('../../models/treeItems'), 'isPipelineRunTreeItem').returns(true);

    const mockRunDetails = createMockRunDetails();
    mockAzureDevOpsService.getRunDetails.resolves(mockRunDetails);

    const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: sinon.stub().returns(vscode.Uri.file('/test/uri')),
        cspSource: 'test-csp',
        postMessage: sinon.stub(),
        onDidReceiveMessage: sinon.stub()
      },
      onDidDispose: sinon.stub(),
      reveal: sinon.stub()
    };
    createWebviewPanelStub.returns(mockPanel as any);

    await webviewProvider.showRunDetails(runItem);

    // Simulate refresh message
    const messageHandler = mockPanel.webview.onDidReceiveMessage.getCall(0).args[0];
    await messageHandler({
      command: 'refresh',
      runId: 123,
      pipelineId: 456,
      projectId: 'test-project'
    });

    assert.ok(mockAzureDevOpsService.getRunDetails.calledTwice);
    assert.ok(mockPanel.webview.postMessage.calledWith({
      command: 'updateRunDetails',
      data: mockRunDetails
    }));
  });

  test('should handle cancel run message', async () => {
    const runItem = {
      data: {
        id: 123,
        pipeline: {
          id: 456,
          project: { id: 'test-project' }
        }
      }
    };

    // Mock the type guard to return true
    sinon.stub(require('../../models/treeItems'), 'isPipelineRunTreeItem').returns(true);

    const mockRunDetails = createMockRunDetails({ state: 'inProgress' });
    mockAzureDevOpsService.getRunDetails.resolves(mockRunDetails);
    mockAzureDevOpsService.cancelRun.resolves();

    const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
    
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: sinon.stub().returns(vscode.Uri.file('/test/uri')),
        cspSource: 'test-csp',
        postMessage: sinon.stub(),
        onDidReceiveMessage: sinon.stub()
      },
      onDidDispose: sinon.stub(),
      reveal: sinon.stub()
    };
    createWebviewPanelStub.returns(mockPanel as any);

    await webviewProvider.showRunDetails(runItem);

    // Simulate cancel run message
    const messageHandler = mockPanel.webview.onDidReceiveMessage.getCall(0).args[0];
    await messageHandler({
      command: 'cancelRun',
      runId: 123,
      pipelineId: 456,
      projectId: 'test-project'
    });

    assert.ok(mockAzureDevOpsService.cancelRun.calledWith(123, 456, 'test-project'));
    assert.ok(showInformationMessageStub.calledWith('Run #123 has been cancelled'));
  });

  test('should handle open in browser message', async () => {
    const runItem = {
      data: {
        id: 123,
        pipeline: {
          id: 456,
          project: { id: 'test-project' }
        }
      }
    };

    // Mock the type guard to return true
    sinon.stub(require('../../models/treeItems'), 'isPipelineRunTreeItem').returns(true);

    const mockRunDetails = createMockRunDetails();
    mockAzureDevOpsService.getRunDetails.resolves(mockRunDetails);

    const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
    const openExternalStub = sinon.stub(vscode.env, 'openExternal');
    
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: sinon.stub().returns(vscode.Uri.file('/test/uri')),
        cspSource: 'test-csp',
        postMessage: sinon.stub(),
        onDidReceiveMessage: sinon.stub()
      },
      onDidDispose: sinon.stub(),
      reveal: sinon.stub()
    };
    createWebviewPanelStub.returns(mockPanel as any);

    await webviewProvider.showRunDetails(runItem);

    // Simulate open in browser message
    const messageHandler = mockPanel.webview.onDidReceiveMessage.getCall(0).args[0];
    await messageHandler({
      command: 'openInBrowser',
      url: 'https://test.com/run/123'
    });

    assert.ok(openExternalStub.calledWith(vscode.Uri.parse('https://test.com/run/123')));
  });
});