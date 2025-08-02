import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { IAuthenticationService } from '../../interfaces/authenticationService';
import { ActivityBarViewManager } from '../../providers/activityBarViewManager';
import { ConfigurationWelcomeProvider } from '../../providers/configurationWelcomeProvider';
import { PipelineTreeProvider } from '../../providers/pipelineTreeProvider';

suite('ActivityBarViewManager', () => {
  let viewManager: ActivityBarViewManager;
  let mockContext: vscode.ExtensionContext;
  let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
  let mockPipelineTreeProvider: sinon.SinonStubbedInstance<PipelineTreeProvider>;
  let mockConfigWelcomeProvider: sinon.SinonStubbedInstance<ConfigurationWelcomeProvider>;
  let executeCommandStub: sinon.SinonStub;
  let registerWebviewViewProviderStub: sinon.SinonStub;
  let createTreeViewStub: sinon.SinonStub;

  setup(() => {
    // Create mock context
    mockContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: vscode.Uri.file('/test'),
      extensionPath: '/test',
      asAbsolutePath: (relativePath: string) => `/test/${relativePath}`,
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/global-storage'),
      logUri: vscode.Uri.file('/test/log'),
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/log',
      secrets: {} as any,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      languageModelAccessInformation: {} as any
    };

    // Create mock services
    mockAuthService = {
      isAuthenticated: sinon.stub(),
      onAuthenticationChanged: sinon.stub(),
      validateCredentials: sinon.stub(),
      getStoredCredentials: sinon.stub(),
      storeCredentials: sinon.stub(),
      clearCredentials: sinon.stub(),
      dispose: sinon.stub()
    } as any;

    mockPipelineTreeProvider = {
      refresh: sinon.stub(),
      getTreeItem: sinon.stub(),
      getChildren: sinon.stub(),
      onDidChangeTreeData: {} as any,
      dispose: sinon.stub()
    } as any;

    mockConfigWelcomeProvider = {
      resolveWebviewView: sinon.stub(),
      dispose: sinon.stub()
    } as any;

    // Stub VS Code APIs
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    registerWebviewViewProviderStub = sinon.stub(vscode.window, 'registerWebviewViewProvider');
    createTreeViewStub = sinon.stub(vscode.window, 'createTreeView');

    // Setup default return values
    registerWebviewViewProviderStub.returns({ dispose: sinon.stub() });
    createTreeViewStub.returns({ dispose: sinon.stub() });
    mockAuthService.onAuthenticationChanged.returns({ dispose: sinon.stub() });

    // Create view manager
    viewManager = new ActivityBarViewManager(
      mockContext,
      mockAuthService,
      mockPipelineTreeProvider,
      mockConfigWelcomeProvider
    );
  });

  teardown(() => {
    sinon.restore();
    viewManager.dispose();
  });

  suite('initialize', () => {
    test('should register webview view provider', async () => {
      mockAuthService.isAuthenticated.returns(false);

      await viewManager.initialize();

      assert.ok(registerWebviewViewProviderStub.calledOnce);
      assert.ok(registerWebviewViewProviderStub.calledWith('azurePipelinesView', mockConfigWelcomeProvider));
    });

    test('should set up authentication change listener', async () => {
      mockAuthService.isAuthenticated.returns(false);

      await viewManager.initialize();

      assert.ok(mockAuthService.onAuthenticationChanged.calledOnce);
      assert.strictEqual(mockContext.subscriptions.length, 2); // webview provider + auth listener
    });

    test('should initialize with welcome view when not authenticated', async () => {
      mockAuthService.isAuthenticated.returns(false);

      await viewManager.initialize();

      assert.strictEqual(viewManager.getCurrentView(), 'welcome');
      assert.ok(executeCommandStub.calledWith('setContext', 'azurePipelinesAssistant.configured', false));
    });

    test('should initialize with pipelines view when authenticated', async () => {
      mockAuthService.isAuthenticated.returns(true);

      await viewManager.initialize();

      assert.strictEqual(viewManager.getCurrentView(), 'pipelines');
      assert.ok(executeCommandStub.calledWith('setContext', 'azurePipelinesAssistant.configured', true));
      assert.ok(createTreeViewStub.calledOnce);
      assert.ok(mockPipelineTreeProvider.refresh.calledOnce);
    });
  });

  suite('authentication state changes', () => {
    test('should switch to pipelines view when authentication succeeds', async () => {
      mockAuthService.isAuthenticated.returns(false);
      await viewManager.initialize();

      // Simulate authentication change
      const authChangeCallback = mockAuthService.onAuthenticationChanged.getCall(0).args[0];
      mockAuthService.isAuthenticated.returns(true);

      await authChangeCallback(true);

      assert.strictEqual(viewManager.getCurrentView(), 'pipelines');
      assert.ok(executeCommandStub.calledWith('setContext', 'azurePipelinesAssistant.configured', true));
      assert.ok(createTreeViewStub.calledOnce);
      assert.ok(mockPipelineTreeProvider.refresh.calledOnce);
    });

    test('should switch to welcome view when authentication is lost', async () => {
      mockAuthService.isAuthenticated.returns(true);
      await viewManager.initialize();

      // Simulate authentication change
      const authChangeCallback = mockAuthService.onAuthenticationChanged.getCall(0).args[0];
      mockAuthService.isAuthenticated.returns(false);

      await authChangeCallback(false);

      assert.strictEqual(viewManager.getCurrentView(), 'welcome');
      assert.ok(executeCommandStub.calledWith('setContext', 'azurePipelinesAssistant.configured', false));
    });

    test('should not switch views if already in correct state', async () => {
      mockAuthService.isAuthenticated.returns(true);
      await viewManager.initialize();

      const initialCallCount = executeCommandStub.callCount;

      // Simulate authentication change with same state
      const authChangeCallback = mockAuthService.onAuthenticationChanged.getCall(0).args[0];
      await authChangeCallback(true);

      // Should not have made additional context calls
      assert.strictEqual(executeCommandStub.callCount, initialCallCount);
    });
  });

  suite('tree view management', () => {
    test('should create tree view only once', async () => {
      mockAuthService.isAuthenticated.returns(true);
      await viewManager.initialize();

      // Simulate multiple authentication changes
      const authChangeCallback = mockAuthService.onAuthenticationChanged.getCall(0).args[0];
      await authChangeCallback(true);
      await authChangeCallback(true);

      assert.strictEqual(createTreeViewStub.callCount, 1);
    });

    test('should return tree view instance when available', async () => {
      mockAuthService.isAuthenticated.returns(true);
      const mockTreeView = { dispose: sinon.stub() };
      createTreeViewStub.returns(mockTreeView);

      await viewManager.initialize();

      const treeView = viewManager.getTreeView();
      assert.strictEqual(treeView, mockTreeView);
    });

    test('should return undefined when tree view not created', () => {
      const treeView = viewManager.getTreeView();
      assert.strictEqual(treeView, undefined);
    });
  });

  suite('refresh', () => {
    test('should refresh pipeline tree provider when in pipelines view', async () => {
      mockAuthService.isAuthenticated.returns(true);
      await viewManager.initialize();

      mockPipelineTreeProvider.refresh.resetHistory();

      await viewManager.refresh();

      assert.ok(mockPipelineTreeProvider.refresh.calledOnce);
    });

    test('should not refresh when in welcome view', async () => {
      mockAuthService.isAuthenticated.returns(false);
      await viewManager.initialize();

      await viewManager.refresh();

      assert.ok(mockPipelineTreeProvider.refresh.notCalled);
    });
  });

  suite('getCurrentView', () => {
    test('should return current view state', async () => {
      mockAuthService.isAuthenticated.returns(false);
      await viewManager.initialize();

      assert.strictEqual(viewManager.getCurrentView(), 'welcome');

      // Switch to pipelines view
      const authChangeCallback = mockAuthService.onAuthenticationChanged.getCall(0).args[0];
      mockAuthService.isAuthenticated.returns(true);
      await authChangeCallback(true);

      assert.strictEqual(viewManager.getCurrentView(), 'pipelines');
    });
  });

  suite('dispose', () => {
    test('should dispose of authentication change listener', async () => {
      const mockDisposable = { dispose: sinon.stub() };
      mockAuthService.onAuthenticationChanged.returns(mockDisposable);

      await viewManager.initialize();
      viewManager.dispose();

      assert.ok(mockDisposable.dispose.calledOnce);
    });

    test('should dispose of tree view if created', async () => {
      mockAuthService.isAuthenticated.returns(true);
      const mockTreeView = { dispose: sinon.stub() };
      createTreeViewStub.returns(mockTreeView);

      await viewManager.initialize();
      viewManager.dispose();

      assert.ok(mockTreeView.dispose.calledOnce);
    });

    test('should handle disposal when tree view not created', () => {
      // Should not throw
      assert.doesNotThrow(() => {
        viewManager.dispose();
      });
    });
  });

  suite('error handling', () => {
    test('should handle errors during view switching gracefully', async () => {
      mockAuthService.isAuthenticated.returns(false);
      executeCommandStub.rejects(new Error('Context command failed'));

      // Should not throw
      await assert.doesNotReject(async () => {
        await viewManager.initialize();
      });
    });

    test('should handle tree view creation errors', async () => {
      mockAuthService.isAuthenticated.returns(true);
      createTreeViewStub.throws(new Error('Tree view creation failed'));

      // Should not throw
      await assert.doesNotReject(async () => {
        await viewManager.initialize();
      });
    });
  });
});