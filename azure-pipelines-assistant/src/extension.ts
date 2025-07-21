import * as vscode from 'vscode';
import { IExtensionContext } from './interfaces';

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	console.log('Azure Pipelines Assistant is activating...');

	try {
		// Create extension context (will be implemented in next task)
		// const extensionContext = await createExtensionContext(context);
		
		// Register commands (will be implemented in next task)
		// registerCommands(context, extensionContext);
		
		// Initialize tree view (will be implemented in next task)
		// initializeTreeView(context, extensionContext);
		
		// Set context for when clause evaluation
		await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.configured', false);
		
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
