import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AuthenticationError } from '../../errors/errorTypes';
import { IAuthenticationService, IAzureDevOpsService, IRealTimeUpdateService } from '../../interfaces';
import { Job, Pipeline, PipelineRun, Project, Stage, Task } from '../../models';
import { IConfigurationService } from '../../services/configurationService';
import {
  AzurePipelinesTreeDataProvider,
  WelcomeTreeItem
} from '../../services/treeDataProvider';

suite('Tree Data Provider Test Suite', () => {
  let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
  let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
  let mockRealTimeService: sinon.SinonStubbedInstance<IRealTimeUpdateService>;
  let mockConfigService: sinon.SinonStubbedInstance<IConfigurationService>;
  let mockContext: vscode.ExtensionContext;
  let authChangeEmitter: vscode.EventEmitter<boolean>;

  // Mock data
  const mockProject: Project = {
    id: 'test-project-id',
    name: 'Test Project',
    description: 'A test project',
    url: 'https://dev.azure.com/org/test-project',
    state: 'wellFormed',
    visibility: 'private'
  };

  const mockPipeline: Pipeline = {
    id: 123,
    name: 'Test Pipeline',
    project: mockProject,
    folder: 'test-folder',
    revision: 1,
    url: 'https://dev.azure.com/org/test-project/_build?definitionId=123',
    configuration: {
      type: 'yaml',
      path: 'azure-pipelines.yml',
      repository: {
        id: 'repo-id',
        name: 'test-repo',
        url: 'https://dev.azure.com/org/test-project/_git/test-repo',
        type: 'TfsGit',
        defaultBranch: 'refs/heads/main'
      }
    }
  };

  const mockPipelineRun: PipelineRun = {
    id: 456,
    name: 'Test Run',
    state: 'completed',
    result: 'succeeded',
    createdDate: new Date('2023-01-01T10:00:00Z'),
    finishedDate: new Date('2023-01-01T10:30:00Z'),
    pipeline: mockPipeline,
    resources: {
      repositories: {},
      pipelines: {},
      builds: {},
      containers: {},
      packages: {}
    },
    variables: {},
    url: 'https://dev.azure.com/org/test-project/_build/results?buildId=456'
  };

  const mockTask: Task = {
    id: 'task-1',
    name: 'TestTask',
    displayName: 'Test Task',
    state: 'completed',
    result: 'succeeded',
    startTime: new Date('2023-01-01T10:00:00Z'),
    finishTime: new Date('2023-01-01T10:05:00Z'),
    task: {
      id: 'task-def-id',
      name: 'TestTaskDefinition',
      version: '1.0.0'
    },
    inputs: {},
    enabled: true,
    continueOnError: false,
    order: 1
  };

  const mockJob: Job = {
    id: 'job-1',
    name: 'TestJob',
    displayName: 'Test Job',
    state: 'completed',
    result: 'succeeded',
    startTime: new Date('2023-01-01T10:00:00Z'),
    finishTime: new Date('2023-01-01T10:10:00Z'),
    tasks: [mockTask],
    agentName: 'test-agent',
    order: 1
  };

  const mockStage: Stage = {
    id: 'stage-1',
    name: 'TestStage',
    displayName: 'Test Stage',
    state: 'completed',
    result: 'succeeded',
    startTime: new Date('2023-01-01T10:00:00Z'),
    finishTime: new Date('2023-01-01T10:15:00Z'),
    jobs: [mockJob],
    dependsOn: [],
    order: 1
  };



  setup(() => {
    try {
      // Create mock services with proper interfaces
      mockAzureDevOpsService = {
        getProjects: sinon.stub(),
        getPipelines: sinon.stub(),
        getPipelineRuns: sinon.stub(),
        getPipelineRunsIncremental: sinon.stub(),
        getRunDetails: sinon.stub(),
        getRunDetailsWithChangeDetection: sinon.stub(),
        getActiveRuns: sinon.stub(),
        getActivePipelineRuns: sinon.stub(),
        triggerRun: sinon.stub(),
        cancelRun: sinon.stub(),
        getRunLogs: sinon.stub(),
        downloadArtifacts: sinon.stub(),
        searchPipelines: sinon.stub(),
        comparePipelineRuns: sinon.stub(),
        clearCache: sinon.stub()
      } as any;

      mockAuthService = {
        isAuthenticated: sinon.stub().returns(false), // Default to false
        onAuthenticationChanged: sinon.stub(),
        validateCredentials: sinon.stub(),
        getStoredCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        getCurrentOrganization: sinon.stub(),
        dispose: sinon.stub()
      } as any;

      // Create auth change emitter
      authChangeEmitter = new vscode.EventEmitter<boolean>();
      (mockAuthService.onAuthenticationChanged as any) = authChangeEmitter.event;

      // Create mock real-time service
      mockRealTimeService = {
        subscribeToRunUpdates: sinon.stub(),
        subscribeToPipelineUpdates: sinon.stub(),
        startBackgroundRefresh: sinon.stub(),
        stopBackgroundRefresh: sinon.stub(),
        isBackgroundRefreshActive: sinon.stub().returns(false),
        getActiveSubscriptionCount: sinon.stub().returns(0),
        getConfiguration: sinon.stub(),
        updateConfiguration: sinon.stub(),
        refreshAllSubscriptions: sinon.stub(),
        dispose: sinon.stub(),
        onRunStatusChanged: new vscode.EventEmitter<any>().event
      } as any;

      // Create mock configuration service
      mockConfigService = {
        get: sinon.stub(),
        update: sinon.stub(),
        getRefreshInterval: sinon.stub().returns(30),
        getMaxRunsPerPipeline: sinon.stub().returns(10),
        getFavoritePipelines: sinon.stub().returns([]),
        addFavoritePipeline: sinon.stub(),
        removeFavoritePipeline: sinon.stub(),
        dispose: sinon.stub()
      } as any;

      // Create mock context
      mockContext = {
        subscriptions: [],
        workspaceState: {
          get: sinon.stub(),
          update: sinon.stub()
        },
        globalState: {
          get: sinon.stub(),
          update: sinon.stub()
        },
        secrets: {
          get: sinon.stub(),
          store: sinon.stub(),
          delete: sinon.stub()
        },
        extensionUri: vscode.Uri.file('/test'),
        extensionPath: '/test'
      } as any;
    } catch (error) {
      console.error('Error in tree data provider test setup:', error);
      throw error;
    }
  });

  teardown(() => {
    try {
      // Clean up specific resources instead of global restore
      if (authChangeEmitter) {
        authChangeEmitter.dispose();
      }
      // Don't call sinon.restore() as it affects other tests
    } catch (error) {
      console.error('Error in tree data provider test teardown:', error);
      // Don't re-throw to avoid masking the actual test failure
    }
  });

  test('should show welcome item when not authenticated', async () => {
    mockAuthService.isAuthenticated.returns(false);

    // Create tree provider with unauthenticated state
    const provider = new AzurePipelinesTreeDataProvider(
      mockAzureDevOpsService as any,
      mockAuthService as any,
      mockRealTimeService as any,
      mockConfigService as any
    );

    const children = await provider.getChildren();

    assert.strictEqual(children.length, 1);
    assert.strictEqual(children[0].itemType, 'loading');
    assert.strictEqual(children[0].label, 'Welcome to Azure Pipelines Assistant');
  });

  test('should load projects when authenticated', async () => {
    mockAuthService.isAuthenticated.returns(true);
    mockAzureDevOpsService.getProjects.resolves([mockProject]);

    // Create tree provider with authenticated state
    const provider = new AzurePipelinesTreeDataProvider(
      mockAzureDevOpsService as any,
      mockAuthService as any,
      mockRealTimeService as any,
      mockConfigService as any
    );

    const children = await provider.getChildren();

    assert.strictEqual(children.length, 1);
    assert.strictEqual(children[0].itemType, 'project');
    assert.strictEqual(children[0].label, mockProject.name);
  });

  test('should handle authentication errors', async () => {
    mockAuthService.isAuthenticated.returns(true);
    const authError = new AuthenticationError('Invalid token', 'INVALID_PAT');
    mockAzureDevOpsService.getProjects.rejects(authError);

    // Create tree provider with authenticated state
    const provider = new AzurePipelinesTreeDataProvider(
      mockAzureDevOpsService as any,
      mockAuthService as any,
      mockRealTimeService as any,
      mockConfigService as any
    );

    const children = await provider.getChildren();

    assert.strictEqual(children.length, 1);
    assert.strictEqual(children[0].itemType, 'error');
    assert.strictEqual(children[0].label, 'Invalid Personal Access Token');
    assert.ok(children[0].command);
    assert.strictEqual(children[0].command!.command, 'azurePipelinesAssistant.configure');
  });

  test('should refresh tree view', () => {
    // Create tree provider for this test
    const provider = new AzurePipelinesTreeDataProvider(
      mockAzureDevOpsService as any,
      mockAuthService as any,
      mockRealTimeService as any,
      mockConfigService as any
    );

    const fireStub = sinon.stub(provider['_onDidChangeTreeData'], 'fire');

    provider.refresh();

    assert.ok(fireStub.calledOnce);
    assert.ok(fireStub.calledWith());
  });

  test('WelcomeTreeItem should have correct properties', () => {
    const welcomeItem = new WelcomeTreeItem();

    assert.strictEqual(welcomeItem.itemType, 'loading');
    assert.strictEqual(welcomeItem.id, 'welcome');
    assert.strictEqual(welcomeItem.label, 'Welcome to Azure Pipelines Assistant');
    assert.strictEqual(welcomeItem.hasChildren, false);
    assert.strictEqual(welcomeItem.contextValue, 'welcome');
    assert.strictEqual(welcomeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.ok(welcomeItem.iconPath);
    assert.ok(welcomeItem.tooltip);
    assert.ok(welcomeItem.command);
    assert.strictEqual(welcomeItem.command.command, 'azurePipelinesAssistant.configure');
  });
});