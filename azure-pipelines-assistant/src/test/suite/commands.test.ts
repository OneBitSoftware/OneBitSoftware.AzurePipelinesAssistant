import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { CommandHandler } from '../../commands';
import { 
  ProjectTreeItem,
  PipelineTreeItem,
  PipelineRunTreeItem
} from '../../models/treeItems';
import { Project, Pipeline, PipelineRun } from '../../models';
import { IAzureDevOpsService, IAuthenticationService } from '../../interfaces';
import { AzurePipelinesTreeDataProvider } from '../../services/treeDataProvider';

suite('Command Handler Test Suite', () => {
  let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
  let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
  let mockTreeDataProvider: sinon.SinonStubbedInstance<AzurePipelinesTreeDataProvider>;
  let mockContext: vscode.ExtensionContext;
  let commandHandler: CommandHandler;

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

  setup(() => {
    // Create mock services
    mockAzureDevOpsService = {
      getProjects: sinon.stub(),
      getPipelines: sinon.stub(),
      getPipelineRuns: sinon.stub(),
      getRunDetails: sinon.stub(),
      triggerRun: sinon.stub(),
      triggerPipelineRun: sinon.stub(),
      cancelRun: sinon.stub(),
      getLogs: sinon.stub(),
      getRunLogs: sinon.stub(),
      downloadArtifacts: sinon.stub(),
      refreshProject: sinon.stub(),
      refreshPipeline: sinon.stub(),
      clearCache: sinon.stub()
    } as any;

    mockAuthService = {
      isAuthenticated: sinon.stub().returns(true),
      onAuthenticationChanged: sinon.stub(),
      authenticate: sinon.stub(),
      getCredentials: sinon.stub(),
      clearCredentials: sinon.stub()
    } as any;

    mockTreeDataProvider = {
      refresh: sinon.stub(),
      refreshItem: sinon.stub(),
      getChildren: sinon.stub(),
      getTreeItem: sinon.stub(),
      getParent: sinon.stub(),
      reveal: sinon.stub(),
      findItem: sinon.stub(),
      getItemsByType: sinon.stub(),
      setTreeView: sinon.stub()
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
      }
    } as any;

    // Create command handler
    commandHandler = new CommandHandler(
      mockAzureDevOpsService as any,
      mockAuthService as any,
      mockTreeDataProvider as any,
      mockContext
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite('Command Registration', () => {
    test('should register all commands', () => {
      const disposables = commandHandler.registerCommands();
      
      // Should return array of disposables
      assert.ok(Array.isArray(disposables));
      assert.ok(disposables.length > 0);
      
      // Each item should be a disposable
      disposables.forEach(disposable => {
        assert.ok(typeof disposable.dispose === 'function');
      });
    });
  });

  suite('Basic Commands', () => {
    test('refresh command should call tree provider refresh', async () => {
      // Test the refresh method directly
      (commandHandler as any).refresh();
      
      // Verify tree provider refresh was called
      assert.ok(mockTreeDataProvider.refresh.called);
    });

    test('configure command should open settings', async () => {
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
      
      try {
        // Test the configure method directly
        await (commandHandler as any).configure();
        
        // Verify settings were opened
        assert.ok(executeCommandStub.calledWith('workbench.action.openSettings', 'azurePipelinesAssistant'));
      } finally {
        executeCommandStub.restore();
      }
    });
  });

  suite('Pipeline Commands', () => {
    test('viewInBrowser should open project URL', async () => {
      const openExternalStub = sinon.stub(vscode.env, 'openExternal');
      const projectItem = new ProjectTreeItem(mockProject);
      
      try {
        // Test the viewInBrowser method directly
        await (commandHandler as any).viewInBrowser(projectItem);
        
        // Verify external URL was opened
        assert.ok(openExternalStub.called);
        const calledUri = openExternalStub.getCall(0).args[0];
        assert.strictEqual(calledUri.toString(), mockProject.url);
      } finally {
        openExternalStub.restore();
      }
    });

    test('viewInBrowser should open pipeline URL', async () => {
      const openExternalStub = sinon.stub(vscode.env, 'openExternal');
      const pipelineItem = new PipelineTreeItem(mockPipeline);
      
      try {
        // Test the viewInBrowser method directly
        await (commandHandler as any).viewInBrowser(pipelineItem);
        
        // Verify external URL was opened
        assert.ok(openExternalStub.called);
        const calledUri = openExternalStub.getCall(0).args[0];
        // URL encoding may change the format, so check the decoded version
        assert.ok(decodeURIComponent(calledUri.toString()).includes('definitionId=123'));
      } finally {
        openExternalStub.restore();
      }
    });

    test('runPipeline should trigger pipeline run', async () => {
      const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('main');
      const withProgressStub = sinon.stub(vscode.window, 'withProgress');
      const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
      const pipelineItem = new PipelineTreeItem(mockPipeline);
      
      // Mock the progress callback to resolve immediately
      withProgressStub.callsFake(async (options, callback) => {
        const progress = { report: sinon.stub() };
        const token = { isCancellationRequested: false, onCancellationRequested: sinon.stub() };
        return await callback(progress, token);
      });
      
      mockAzureDevOpsService.triggerRun.resolves({
        ...mockPipelineRun,
        id: 789
      });
      
      try {
        // Test the runPipeline method directly
        await (commandHandler as any).runPipeline(pipelineItem);
        
        // Verify input was requested
        assert.ok(showInputBoxStub.called);
        
        // Verify pipeline run was triggered
        assert.ok(mockAzureDevOpsService.triggerRun.called);
        assert.ok(mockAzureDevOpsService.triggerRun.calledWith(
          mockPipeline.id,
          mockPipeline.project.id,
          { sourceBranch: 'main' }
        ));
      } finally {
        showInputBoxStub.restore();
        withProgressStub.restore();
        showInformationMessageStub.restore();
      }
    });
  });

  suite('Favorites Commands', () => {
    test('addToFavorites should add project to favorites', async () => {
      const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
      const mockConfig = {
        get: sinon.stub().returns([]),
        update: sinon.stub().resolves()
      };
      getConfigurationStub.returns(mockConfig as any);
      
      const projectItem = new ProjectTreeItem(mockProject);
      
      try {
        // Test the addToFavorites method directly
        await (commandHandler as any).addToFavorites(projectItem);
        
        // Verify configuration was updated
        assert.ok(mockConfig.get.calledWith('favoriteProjects', []));
        assert.ok(mockConfig.update.called);
        
        const updateCall = mockConfig.update.getCall(0);
        assert.strictEqual(updateCall.args[0], 'favoriteProjects');
        assert.ok(updateCall.args[1].includes(mockProject.id));
      } finally {
        getConfigurationStub.restore();
      }
    });

    test('removeFromFavorites should remove project from favorites', async () => {
      const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
      const mockConfig = {
        get: sinon.stub().returns([mockProject.id]),
        update: sinon.stub().resolves()
      };
      getConfigurationStub.returns(mockConfig as any);
      
      const projectItem = new ProjectTreeItem(mockProject);
      
      try {
        // Test the removeFromFavorites method directly
        await (commandHandler as any).removeFromFavorites(projectItem);
        
        // Verify configuration was updated
        assert.ok(mockConfig.update.called);
        
        const updateCall = mockConfig.update.getCall(0);
        assert.strictEqual(updateCall.args[0], 'favoriteProjects');
        assert.ok(!updateCall.args[1].includes(mockProject.id));
      } finally {
        getConfigurationStub.restore();
      }
    });
  });

  suite('Search Commands', () => {
    test('searchPipelines should search across all projects', async () => {
      const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('test');
      const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
      
      mockAzureDevOpsService.getProjects.resolves([mockProject]);
      mockAzureDevOpsService.getPipelines.resolves([mockPipeline]);
      
      try {
        // Test the searchPipelines method directly
        await (commandHandler as any).searchPipelines();
        
        // Verify search input was requested
        assert.ok(showInputBoxStub.called);
        
        // Verify projects and pipelines were fetched
        assert.ok(mockAzureDevOpsService.getProjects.called);
        assert.ok(mockAzureDevOpsService.getPipelines.called);
        
        // Verify quick pick was shown with results
        assert.ok(showQuickPickStub.called);
      } finally {
        showInputBoxStub.restore();
        showQuickPickStub.restore();
      }
    });
  });

  suite('Error Handling', () => {
    test('should handle errors gracefully in runPipeline', async () => {
      const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('main');
      const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
      const pipelineItem = new PipelineTreeItem(mockPipeline);
      
      mockAzureDevOpsService.triggerRun.rejects(new Error('API Error'));
      
      try {
        // Test the runPipeline method directly
        await (commandHandler as any).runPipeline(pipelineItem);
        
        // Verify error message was shown
        assert.ok(showErrorMessageStub.called);
        assert.ok(showErrorMessageStub.getCall(0).args[0].includes('Failed to run pipeline'));
      } finally {
        showInputBoxStub.restore();
        showErrorMessageStub.restore();
      }
    });

    test('should handle invalid item types gracefully', async () => {
      const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
      
      try {
        // Test the runPipeline method directly with invalid item
        await (commandHandler as any).runPipeline({ invalid: 'item' });
        
        // Verify error message was shown
        assert.ok(showErrorMessageStub.called);
        assert.ok(showErrorMessageStub.getCall(0).args[0].includes('Please select a pipeline'));
      } finally {
        showErrorMessageStub.restore();
      }
    });
  });
});