import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MockDataFactory } from '../fixtures/mockData';

// Import extension components
import { CommandHandler } from '../../commands';
import { AuthenticationService } from '../../services/authenticationService';
import { AzureDevOpsService } from '../../services/azureDevOpsService';
import { ConfigurationService } from '../../services/configurationService';
import { AzurePipelinesTreeDataProvider } from '../../services/treeDataProvider';
import { RunDetailsWebviewProvider } from '../../webviews/runDetailsWebview';

suite('End-to-End User Workflow Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let authService: AuthenticationService;
  let configService: ConfigurationService;
  let azureDevOpsService: AzureDevOpsService;
  let treeDataProvider: AzurePipelinesTreeDataProvider;
  let commandHandler: CommandHandler;
  let webviewProvider: RunDetailsWebviewProvider;

  // Mock VS Code APIs
  let showInformationMessageStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let showQuickPickStub: sinon.SinonStub;
  let withProgressStub: sinon.SinonStub;
  let createWebviewPanelStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;

  setup(() => {
    // Create mock VS Code context
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
      extensionUri: vscode.Uri.file('/test/extension'),
      extensionPath: '/test/extension'
    } as any;

    // Mock VS Code APIs
    showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
    showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    withProgressStub = sinon.stub(vscode.window, 'withProgress');
    createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    // Mock workspace configuration
    const mockWorkspaceConfig = {
      get: sinon.stub(),
      update: sinon.stub(),
      inspect: sinon.stub(),
      has: sinon.stub()
    };
    sinon.stub(vscode.workspace, 'getConfiguration').returns(mockWorkspaceConfig as any);

    // Initialize services
    authService = new AuthenticationService(mockContext);
    configService = new ConfigurationService(mockContext);

    // Mock services for E2E testing
    azureDevOpsService = {
      getProjects: sinon.stub(),
      getPipelines: sinon.stub(),
      getPipelineRuns: sinon.stub(),
      triggerPipelineRun: sinon.stub(),
      downloadArtifacts: sinon.stub(),
      triggerRun: sinon.stub(),
      getLogs: sinon.stub(),
      refreshProject: sinon.stub(),
      refreshPipeline: sinon.stub(),
      clearCache: sinon.stub(),
      addToFavorites: sinon.stub(),
      removeFromFavorites: sinon.stub(),
      getActiveSubscriptionCount: sinon.stub(),
      dispose: sinon.stub()
    } as any;

    const mockRealTimeService = {
      subscribeToRunUpdates: sinon.stub(),
      subscribeToProjectUpdates: sinon.stub(),
      isBackgroundRefreshActive: sinon.stub().returns(false),
      getActiveSubscriptionCount: sinon.stub().returns(0),
      dispose: sinon.stub()
    };
    treeDataProvider = new AzurePipelinesTreeDataProvider(azureDevOpsService, authService, mockRealTimeService as any, mockContext);
    commandHandler = new CommandHandler(azureDevOpsService, authService, configService, treeDataProvider, mockContext);
    webviewProvider = new RunDetailsWebviewProvider(mockContext, azureDevOpsService);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('Initial Extension Setup Workflow', () => {
    test('should guide user through initial configuration', async () => {
      // Simulate unconfigured state
      sinon.stub(authService, 'isAuthenticated').returns(false);
      sinon.stub(mockContext.secrets, 'get').resolves(undefined);

      // Mock user input for configuration
      showInputBoxStub.onFirstCall().resolves('testorg'); // Organization
      showInputBoxStub.onSecondCall().resolves('test-pat-token'); // PAT

      // Mock successful validation
      sinon.stub(authService, 'validateCredentials').resolves({
        isValid: true,
        permissions: [
          { name: 'Build', displayName: 'Build (read)', required: true },
          { name: 'Code', displayName: 'Code (read)', required: true },
          { name: 'Project', displayName: 'Project and team (read)', required: true },
          { name: 'Release', displayName: 'Release (read)', required: true }
        ],
        missingPermissions: [],
        userInfo: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
          id: 'test-user-id'
        }
      });

      // Mock successful credential storage
      sinon.stub(mockContext.secrets, 'store').resolves();

      // Execute configuration command
      await (commandHandler as any).configure();

      // Verify user was prompted for credentials
      assert.ok(showInputBoxStub.calledTwice);
      assert.ok(showInputBoxStub.firstCall.args[0].prompt.includes('organization'));
      assert.ok(showInputBoxStub.secondCall.args[0].prompt.includes('Personal Access Token'));

      // Verify credentials were validated and stored
      assert.ok((authService.validateCredentials as sinon.SinonStub).called);
      assert.ok((mockContext.secrets.store as sinon.SinonStub).called);

      // Verify success message
      assert.ok(showInformationMessageStub.calledWith(sinon.match(/successfully configured/i)));
    });

    test('should handle invalid credentials gracefully', async () => {
      // Simulate unconfigured state
      sinon.stub(authService, 'isAuthenticated').returns(false);

      // Mock user input
      showInputBoxStub.onFirstCall().resolves('testorg');
      showInputBoxStub.onSecondCall().resolves('invalid-token');

      // Mock failed validation
      sinon.stub(authService, 'validateCredentials').resolves({
        isValid: false,
        permissions: [],
        missingPermissions: [
          { name: 'Build', displayName: 'Build (read)', required: true },
          { name: 'Code', displayName: 'Code (read)', required: true },
          { name: 'Project', displayName: 'Project and team (read)', required: true },
          { name: 'Release', displayName: 'Release (read)', required: true }
        ],
        errorMessage: 'Invalid Personal Access Token'
      });

      // Execute configuration command
      await (commandHandler as any).configure();

      // Verify error message was shown
      assert.ok(showErrorMessageStub.calledWith(sinon.match(/Invalid Personal Access Token/i)));

      // Verify credentials were not stored
      assert.ok((mockContext.secrets.store as sinon.SinonStub).notCalled);
    });
  });

  suite('Project and Pipeline Discovery Workflow', () => {
    test('should load and display projects and pipelines', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock data
      const mockProjects = MockDataFactory.createProjects(3);
      const mockPipelines = MockDataFactory.createPipelines(5, mockProjects[0]);

      sinon.stub(azureDevOpsService, 'getProjects').resolves(mockProjects);
      sinon.stub(azureDevOpsService, 'getPipelines').resolves(mockPipelines);

      // Get tree children (projects)
      const projectItems = await treeDataProvider.getChildren();

      assert.strictEqual(projectItems.length, 3);
      assert.ok((azureDevOpsService.getProjects as sinon.SinonStub).called);

      // Get pipelines for first project
      const pipelineItems = await treeDataProvider.getChildren(projectItems[0]);

      assert.strictEqual(pipelineItems.length, 5);
      assert.ok((azureDevOpsService.getPipelines as sinon.SinonStub).calledWith(mockProjects[0].id));
    });

    test('should handle empty projects gracefully', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock empty projects
      sinon.stub(azureDevOpsService, 'getProjects').resolves([]);

      // getChildren may expect arguments: element, token, context, etc. Pass undefined for optional ones.
      const projectItems = await treeDataProvider.getChildren();

      assert.strictEqual(projectItems.length, 1); // Should show "No projects found" item
      assert.strictEqual(projectItems[0].label, 'No projects found');
    });

    test('should show authentication prompt when not authenticated', async () => {
      // Mock unauthenticated state
      sinon.stub(authService, 'isAuthenticated').returns(false);

      const items = await treeDataProvider.getChildren();

      assert.strictEqual(items.length, 1);
      assert.ok(typeof items[0].label === 'string' && items[0].label.includes('Configure'));
    });
  });

  suite('Pipeline Execution Workflow', () => {
    test('should trigger pipeline run with user input', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock data
      const mockPipeline = MockDataFactory.createPipeline();
      const mockTriggeredRun = MockDataFactory.createInProgressPipelineRun();

      // Mock user inputs
      showInputBoxStub.onFirstCall().resolves('refs/heads/feature/test'); // Branch
      showInputBoxStub.onSecondCall().resolves('BuildConfiguration=Release'); // Variables

      // Mock progress dialog
      withProgressStub.callsFake(async (options, callback) => {
        const progress = { report: sinon.stub() };
        const token = { isCancellationRequested: false, onCancellationRequested: sinon.stub() };
        return await callback(progress, token);
      });

      // Mock successful trigger
      sinon.stub(azureDevOpsService, 'triggerRun').resolves(mockTriggeredRun);

      // Create pipeline tree item
      const pipelineItem = {
        data: mockPipeline,
        contextValue: 'pipeline'
      };

      // Execute run pipeline command
      await (commandHandler as any).runPipeline(pipelineItem);

      // Verify user was prompted for inputs
      assert.ok(showInputBoxStub.calledTwice);

      // Verify pipeline was triggered
      assert.ok((azureDevOpsService.triggerRun as sinon.SinonStub).calledWith(
        mockPipeline.id,
        mockPipeline.project.id,
        {
          sourceBranch: 'refs/heads/feature/test',
          variables: { BuildConfiguration: 'Release' }
        }
      ));

      // Verify success message
      assert.ok(showInformationMessageStub.calledWith(sinon.match(/successfully triggered/i)));
    });

    test('should handle pipeline trigger cancellation', async () => {
      // Mock user cancelling input
      showInputBoxStub.resolves(undefined);

      const mockPipeline = MockDataFactory.createPipeline();
      const pipelineItem = {
        data: mockPipeline,
        contextValue: 'pipeline'
      };

      await (commandHandler as any).runPipeline(pipelineItem);

      // Verify pipeline was not triggered
      assert.ok((azureDevOpsService.triggerRun as sinon.SinonStub).notCalled);

      // Verify no success message
      assert.ok(showInformationMessageStub.notCalled);
    });

    test('should handle pipeline trigger errors', async () => {
      // Mock user inputs
      showInputBoxStub.onFirstCall().resolves('refs/heads/main');
      showInputBoxStub.onSecondCall().resolves('');

      // Mock progress dialog
      withProgressStub.callsFake(async (options, callback) => {
        const progress = { report: sinon.stub() };
        const token = { isCancellationRequested: false, onCancellationRequested: sinon.stub() };
        return await callback(progress, token);
      });

      // Mock trigger failure
      sinon.stub(azureDevOpsService, 'triggerRun').rejects(new Error('Pipeline not found'));

      const mockPipeline = MockDataFactory.createPipeline();
      const pipelineItem = {
        data: mockPipeline,
        contextValue: 'pipeline'
      };

      await (commandHandler as any).runPipeline(pipelineItem);

      // Verify error message was shown
      assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to run pipeline/i)));
    });
  });

  suite('Run Monitoring Workflow', () => {
    test('should display run details in webview', async () => {
      // Mock webview panel
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

      // Mock run details
      const mockRunDetails = MockDataFactory.createPipelineRunDetails();
      sinon.stub(azureDevOpsService, 'getRunDetails').resolves(mockRunDetails);

      // Create run tree item
      const runItem = {
        data: mockRunDetails,
        contextValue: 'run'
      };

      // Show run details
      await webviewProvider.showRunDetails(runItem);

      // Verify webview was created
      assert.ok(createWebviewPanelStub.calledOnce);
      assert.ok(createWebviewPanelStub.calledWith(
        'azurePipelinesAssistant.runDetails',
        sinon.match(/Run #\d+/),
        vscode.ViewColumn.One
      ));

      // Verify run details were fetched
      assert.ok((azureDevOpsService.getRunDetails as sinon.SinonStub).called);

      // Verify HTML content was set
      assert.ok(mockPanel.webview.html.length > 0);
    });

    test('should handle run cancellation from webview', async () => {
      // Mock webview panel
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

      // Mock in-progress run
      const mockRunDetails = MockDataFactory.createInProgressPipelineRun();
      sinon.stub(azureDevOpsService, 'getRunDetails').resolves(mockRunDetails as any);
      sinon.stub(azureDevOpsService, 'cancelRun').resolves();

      const runItem = {
        data: mockRunDetails,
        contextValue: 'run'
      };

      await webviewProvider.showRunDetails(runItem);

      // Simulate cancel run message from webview
      const messageHandler = mockPanel.webview.onDidReceiveMessage.getCall(0).args[0];
      await messageHandler({
        command: 'cancelRun',
        runId: mockRunDetails.id,
        pipelineId: mockRunDetails.pipeline.id,
        projectId: mockRunDetails.pipeline.project.id
      });

      // Verify run was cancelled
      assert.ok((azureDevOpsService.cancelRun as sinon.SinonStub).calledWith(
        mockRunDetails.id,
        mockRunDetails.pipeline.id,
        mockRunDetails.pipeline.project.id
      ));

      // Verify success message
      assert.ok(showInformationMessageStub.calledWith(sinon.match(/cancelled/i)));
    });
  });

  suite('Search and Navigation Workflow', () => {
    test('should search across all pipelines', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock data
      const mockProjects = MockDataFactory.createProjects(2);
      const mockPipelines1 = MockDataFactory.createPipelines(3, mockProjects[0]);
      const mockPipelines2 = MockDataFactory.createPipelines(2, mockProjects[1]);

      sinon.stub(azureDevOpsService, 'getProjects').resolves(mockProjects);
      const getPipelinesStub = sinon.stub(azureDevOpsService, 'getPipelines');
      getPipelinesStub.onFirstCall().resolves(mockPipelines1);
      getPipelinesStub.onSecondCall().resolves(mockPipelines2);

      // Mock user search input
      showInputBoxStub.resolves('test');

      // Mock user selection
      showQuickPickStub.resolves({
        label: mockPipelines1[0].name,
        description: mockProjects[0].name,
        pipeline: mockPipelines1[0]
      });

      // Execute search command
      await (commandHandler as any).searchPipelines();

      // Verify search input was requested
      assert.ok(showInputBoxStub.calledWith(sinon.match({
        prompt: sinon.match(/search/i)
      })));

      // Verify all projects and pipelines were fetched
      assert.ok((azureDevOpsService.getProjects as sinon.SinonStub).called);
      assert.ok((azureDevOpsService.getPipelines as sinon.SinonStub).calledTwice);

      // Verify quick pick was shown with results
      assert.ok(showQuickPickStub.called);
      const quickPickItems = showQuickPickStub.getCall(0).args[0];
      assert.strictEqual(quickPickItems.length, 5); // 3 + 2 pipelines
    });

    test('should handle empty search results', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock empty data
      sinon.stub(azureDevOpsService, 'getProjects').resolves([]);

      // Mock user search input
      showInputBoxStub.resolves('nonexistent');

      await (commandHandler as any).searchPipelines();

      // Verify message about no results
      assert.ok(showInformationMessageStub.calledWith(sinon.match((val: string) => typeof val === 'string' && val.toLowerCase().includes('no pipelines found'))));
    });
  });

  suite('Favorites Management Workflow', () => {
    test('should add and remove pipeline from favorites', async () => {
      // Mock workspace configuration
      const mockConfig = {
        get: sinon.stub(),
        update: sinon.stub().resolves()
      };
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(mockConfig as any);

      // Mock current favorites
      (mockConfig.get as sinon.SinonStub).withArgs('favoritePipelines', []).returns([]);

      const mockPipeline = MockDataFactory.createPipeline();
      const pipelineItem = {
        data: mockPipeline,
        contextValue: 'pipeline'
      };

      // Add to favorites
      await (commandHandler as any).addToFavorites(pipelineItem);

      // Verify favorite was added
      assert.ok(mockConfig.update.calledWith('favoritePipelines', sinon.match.array));
      const updatedFavorites = mockConfig.update.getCall(0).args[1];
      assert.ok(updatedFavorites.some((fav: any) => fav.pipelineId === mockPipeline.id));

      // Mock updated favorites list
      (mockConfig.get as sinon.SinonStub).withArgs('favoritePipelines', []).returns(updatedFavorites);

      // Remove from favorites
      await (commandHandler as any).removeFromFavorites(pipelineItem);

      // Verify favorite was removed
      assert.ok(mockConfig.update.calledTwice);
      const finalFavorites = mockConfig.update.getCall(1).args[1];
      assert.ok(!finalFavorites.some((fav: any) => fav.pipelineId === mockPipeline.id));
    });
  });

  suite('Error Recovery Workflow', () => {
    test('should recover from authentication errors', async () => {
      // Mock initial authentication failure
      sinon.stub(authService, 'isAuthenticated').returns(false);

      // Try to load projects (should fail)
      const items = await treeDataProvider.getChildren();

      // Should show configuration prompt
      assert.ok(typeof items[0].label === 'string' && items[0].label.includes('Configure'));

      // Simulate user configuring authentication
      showInputBoxStub.onFirstCall().resolves('testorg');
      showInputBoxStub.onSecondCall().resolves('valid-token');

      sinon.stub(authService, 'validateCredentials').resolves({
        isValid: true,
        permissions: [
          { name: 'Build', displayName: 'Build (read)', required: true },
          { name: 'Code', displayName: 'Code (read)', required: true },
          { name: 'Project', displayName: 'Project and team (read)', required: true },
          { name: 'Release', displayName: 'Release (read)', required: true }
        ],
        missingPermissions: [],
        userInfo: { displayName: 'Test User', emailAddress: 'test@example.com', id: 'test-user-id' }
      });

      (mockContext.secrets.store as sinon.SinonStub).resolves();

      // Execute configuration
      await (commandHandler as any).configure();

      // Mock authenticated state after configuration
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock successful data loading
      const mockProjects = MockDataFactory.createProjects(2);
      sinon.stub(azureDevOpsService, 'getProjects').resolves(mockProjects);

      // Try loading projects again (should succeed)
      const newItems = await treeDataProvider.getChildren();

      assert.strictEqual(newItems.length, 2);
      assert.ok((azureDevOpsService.getProjects as sinon.SinonStub).called);
    });

    test('should handle network errors with retry option', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock network error
      sinon.stub(azureDevOpsService, 'getProjects').rejects(new Error('Network error'));

      // Try to load projects
      const items = await treeDataProvider.getChildren();

      // Should show error item with retry option
      assert.strictEqual(items.length, 1);
      const label = typeof items[0].label === 'string' ? items[0].label : items[0].label?.label || '';
      assert.ok(label.includes('Error'));
      assert.ok(items[0].command);
      assert.strictEqual(items[0].command.command, 'azurePipelinesAssistant.refresh');
    });
  });

  suite('Performance and Memory Management', () => {
    test('should handle large datasets efficiently', async () => {
      // Mock authenticated state
      sinon.stub(authService, 'isAuthenticated').returns(true);

      // Mock large dataset
      const mockProjects = MockDataFactory.createProjects(50);
      const mockPipelines = MockDataFactory.createPipelines(100);

      sinon.stub(azureDevOpsService, 'getProjects').resolves(mockProjects);
      sinon.stub(azureDevOpsService, 'getPipelines').resolves(mockPipelines);

      const startTime = Date.now();

      // Load projects
      const projectItems = await treeDataProvider.getChildren();

      // Load pipelines for first project
      const pipelineItems = await treeDataProvider.getChildren(projectItems[0]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      assert.ok(duration < 1000, `Operation took ${duration}ms, expected < 1000ms`);

      // Should return correct number of items
      assert.strictEqual(projectItems.length, 50);
      assert.strictEqual(pipelineItems.length, 100);
    });

    test('should dispose resources properly', () => {
      // Create disposables
      const disposables = commandHandler.registerCommands();

      // Should not throw when disposing
      assert.doesNotThrow(() => {
        disposables.forEach(disposable => disposable.dispose());
      });

      // Should not throw when disposing webview provider
      assert.doesNotThrow(() => {
        webviewProvider.dispose();
      });

      // Should not throw when disposing tree data provider
      assert.doesNotThrow(() => {
        treeDataProvider.dispose();
      });
    });
  });
});