import * as vscode from 'vscode';
import { CommandHandler } from './commands';
import { DiagnosticCommands } from './commands/diagnosticCommands';
import { ErrorHandler } from './errors/errorHandler';
import { ExtensionError } from './errors/errorTypes';
import { ActivityBarViewManager } from './providers/activityBarViewManager';
import { ConfigurationWelcomeProvider } from './providers/configurationWelcomeProvider';
import { PipelineTreeProvider } from './providers/pipelineTreeProvider';
import { AuthenticationService } from './services/authenticationService';
import { AzureDevOpsService } from './services/azureDevOpsService';
import { CacheService } from './services/cacheService';
import { ConfigurationChangeHandler } from './services/configurationChangeHandler';
import { ConfigurationService } from './services/configurationService';
import { ExtensionLifecycleManager } from './services/extensionLifecycleManager';
import { RealTimeUpdateService } from './services/realTimeUpdateService';
import { StatusBarService } from './services/statusBarService';
import { AzurePipelinesTreeDataProvider } from './services/treeDataProvider';

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Azure Pipelines Assistant is activating...');

  // Create output channel for error logging
  const outputChannel = vscode.window.createOutputChannel('Azure Pipelines Assistant');

  // Get lifecycle manager instance
  const lifecycleManager = ExtensionLifecycleManager.getInstance();

  try {
    // Begin activation
    await lifecycleManager.beginActivation();

    // Initialize error handler first
    const errorHandler = ErrorHandler.getInstance(context, outputChannel);

    // Configure error handler
    errorHandler.configure({
      showUserNotifications: true,
      logToConsole: true,
      collectDiagnostics: true,
      maxErrorsPerSession: 50
    });

    // Initialize lifecycle manager
    await lifecycleManager.initialize(context, errorHandler, outputChannel);

    // Initialize services and register them with lifecycle manager
    const authService = new AuthenticationService(context, errorHandler);
    lifecycleManager.registerResource({
      id: 'auth-service',
      type: 'service',
      dispose: () => authService.dispose()
    });

    const cacheService = new CacheService();
    lifecycleManager.registerResource({
      id: 'cache-service',
      type: 'service',
      dispose: () => cacheService.dispose()
    });

    const configService = new ConfigurationService(context);
    lifecycleManager.registerResource({
      id: 'config-service',
      type: 'service',
      dispose: () => configService.dispose()
    });

    const configChangeHandler = new ConfigurationChangeHandler(configService, context);
    lifecycleManager.registerResource({
      id: 'config-change-handler',
      type: 'service',
      dispose: () => configChangeHandler.dispose()
    });

    // Create API client (will be implemented in next task)
    // For now, we'll pass authService as a placeholder
    const azureDevOpsService = new AzureDevOpsService(
      authService as any, // Placeholder until API client is implemented
      cacheService,
      {
        organization: 'placeholder', // Will be configured by user
        personalAccessToken: 'placeholder', // Will be configured by user
        maxRetries: 3,
        retryDelay: 1000,
        cacheEnabled: true,
        cacheTtl: 5 * 60 * 1000
      }
    );
    lifecycleManager.registerResource({
      id: 'azure-devops-service',
      type: 'service',
      dispose: () => azureDevOpsService.dispose()
    });

    // Create real-time update service
    const realTimeUpdateService = new RealTimeUpdateService(
      azureDevOpsService,
      configService
    );
    lifecycleManager.registerResource({
      id: 'realtime-update-service',
      type: 'service',
      dispose: () => realTimeUpdateService.dispose()
    });

    // Create status bar service
    const statusBarService = new StatusBarService(
      authService,
      azureDevOpsService,
      context
    );
    statusBarService.initialize();
    lifecycleManager.registerResource({
      id: 'status-bar-service',
      type: 'service',
      dispose: () => statusBarService.dispose()
    });

    // Create tree data provider
    const treeDataProvider = new AzurePipelinesTreeDataProvider(
      azureDevOpsService,
      authService,
      realTimeUpdateService,
      context
    );
    lifecycleManager.registerResource({
      id: 'tree-data-provider',
      type: 'service',
      dispose: () => treeDataProvider.dispose()
    });

    // Create pipeline tree provider (for Activity Bar view manager)
    const pipelineTreeProvider = new PipelineTreeProvider(
      azureDevOpsService,
      authService
    );
    lifecycleManager.registerResource({
      id: 'pipeline-tree-provider',
      type: 'service',
      dispose: () => pipelineTreeProvider.dispose()
    });

    // Create configuration welcome provider
    const configWelcomeProvider = new ConfigurationWelcomeProvider(
      context,
      authService
    );
    lifecycleManager.registerResource({
      id: 'config-welcome-provider',
      type: 'service',
      dispose: () => configWelcomeProvider.dispose()
    });

    // Create Activity Bar view manager
    const activityBarViewManager = new ActivityBarViewManager(
      context,
      authService,
      pipelineTreeProvider,
      configWelcomeProvider
    );
    await activityBarViewManager.initialize();
    lifecycleManager.registerResource({
      id: 'activity-bar-view-manager',
      type: 'service',
      dispose: () => activityBarViewManager.dispose()
    });

    // Register tree view (fallback for compatibility)
    const treeView = vscode.window.createTreeView('azurePipelinesViewFallback', {
      treeDataProvider,
      showCollapseAll: true,
      canSelectMany: false
    });
    lifecycleManager.registerResource({
      id: 'tree-view-fallback',
      type: 'disposable',
      dispose: () => treeView.dispose()
    });

    // Set tree view reference in provider
    treeDataProvider.setTreeView(treeView);

    // Create command handler and register all commands
    const commandHandler = new CommandHandler(
      azureDevOpsService,
      authService,
      configService,
      treeDataProvider,
      context,
      statusBarService
    );

    const commandDisposables = commandHandler.registerCommands();
    lifecycleManager.registerResource({
      id: 'command-handler',
      type: 'service',
      dispose: () => commandHandler.dispose()
    });

    // Create diagnostic commands
    const diagnosticCommands = new DiagnosticCommands(
      context,
      authService,
      azureDevOpsService,
      cacheService,
      outputChannel
    );

    const diagnosticDisposables = diagnosticCommands.registerCommands();
    lifecycleManager.registerResource({
      id: 'diagnostic-commands',
      type: 'service',
      dispose: () => {
        diagnosticDisposables.forEach(d => d.dispose());
      }
    });

    // Initialize configuration contexts
    await configChangeHandler.initializeContexts();

    // Register output channel with lifecycle manager
    lifecycleManager.registerResource({
      id: 'output-channel',
      type: 'disposable',
      dispose: () => outputChannel.dispose()
    });

    // Add disposables to context (lifecycle manager will handle cleanup)
    context.subscriptions.push(
      outputChannel,
      treeView,
      ...commandDisposables,
      ...diagnosticDisposables,
      configService,
      configChangeHandler,
      statusBarService,
      realTimeUpdateService,
      treeDataProvider,
      errorHandler,
      // Add command handler disposal
      { dispose: () => commandHandler.dispose() }
    );

    // Set initial context for when clause evaluation
    const isConfigured = authService.isAuthenticated();
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.configured', isConfigured);

    // Listen for authentication changes to update context
    const authChangeDisposable = authService.onAuthenticationChanged(async (authenticated) => {
      await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.configured', authenticated);
    });
    context.subscriptions.push(authChangeDisposable);
    lifecycleManager.registerResource({
      id: 'auth-change-listener',
      type: 'listener',
      dispose: () => authChangeDisposable.dispose()
    });

    // Register health checks
    lifecycleManager.registerHealthCheck('extension-activation', async () => ({
      component: 'extension-activation',
      status: 'healthy',
      message: 'Extension activated successfully',
      details: {
        activationTime: lifecycleManager.getActivationMetrics().duration,
        resourceCount: lifecycleManager.getResourceCount()
      },
      timestamp: new Date()
    }));

    // Complete activation
    await lifecycleManager.completeActivation();
    console.log('Azure Pipelines Assistant activated successfully');
  } catch (error) {
    // Handle activation error through lifecycle manager
    await lifecycleManager.handleActivationError(error as Error);

    const activationError = new ExtensionError(
      `Failed to activate Azure Pipelines Assistant: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ACTIVATION_FAILED',
      'The extension failed to start properly. Please try restarting VS Code.'
    );

    // Try to get error handler if it was created
    try {
      const errorHandler = ErrorHandler.getInstance();
      await errorHandler.handleCriticalError(activationError);
    } catch {
      // Fallback to basic error display
      console.error('Failed to activate Azure Pipelines Assistant:', error);
      vscode.window.showErrorMessage(`Failed to activate Azure Pipelines Assistant: ${error}`);
    }
  }
}

/**
 * Extension deactivation function
 */
export async function deactivate(): Promise<void> {
  console.log('Azure Pipelines Assistant is deactivating...');

  const lifecycleManager = ExtensionLifecycleManager.getInstance();

  try {
    // Begin deactivation through lifecycle manager
    await lifecycleManager.beginDeactivation();

    // Complete deactivation (this will dispose all resources)
    await lifecycleManager.completeDeactivation();

    // Clean up error handler
    const errorHandler = ErrorHandler.getInstance();
    errorHandler.dispose();

    console.log('Azure Pipelines Assistant deactivated successfully');
  } catch (error) {
    console.warn('Error during deactivation:', error);
  }
}
