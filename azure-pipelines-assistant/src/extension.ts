import * as vscode from 'vscode';
import { IExtensionContext } from './interfaces';
import { AzurePipelinesTreeDataProvider } from './services/treeDataProvider';
import { AuthenticationService } from './services/authenticationService';
import { AzureDevOpsService } from './services/azureDevOpsService';
import { CacheService } from './services/cacheService';
import { ConfigurationService } from './services/configurationService';
import { ConfigurationChangeHandler } from './services/configurationChangeHandler';
import { StatusBarService } from './services/statusBarService';
import { CommandHandler } from './commands';

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	console.log('Azure Pipelines Assistant is activating...');

	try {
		// Initialize services
		const authService = new AuthenticationService(context);
		const cacheService = new CacheService();
		const configService = new ConfigurationService(context);
		const configChangeHandler = new ConfigurationChangeHandler(configService, context);
		
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
		
		// Create status bar service
		const statusBarService = new StatusBarService(
			authService,
			azureDevOpsService,
			context
		);
		statusBarService.initialize();

		// Create tree data provider
		const treeDataProvider = new AzurePipelinesTreeDataProvider(
			azureDevOpsService,
			authService,
			context
		);
		
		// Register tree view
		const treeView = vscode.window.createTreeView('azurePipelinesExplorer', {
			treeDataProvider,
			showCollapseAll: true,
			canSelectMany: false
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
		
		// Initialize configuration contexts
		await configChangeHandler.initializeContexts();

		// Add disposables to context
		context.subscriptions.push(
			treeView, 
			...commandDisposables,
			configService,
			configChangeHandler,
			statusBarService,
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
		
		console.log('Azure Pipelines Assistant activated successfully');
	} catch (error) {
		console.error('Failed to activate Azure Pipelines Assistant:', error);
		vscode.window.showErrorMessage(`Failed to activate Azure Pipelines Assistant: ${error}`);
	}
}

/**
 * Extension deactivation function
 */
export function deactivate(): void {
	console.log('Azure Pipelines Assistant is deactivating...');
}
