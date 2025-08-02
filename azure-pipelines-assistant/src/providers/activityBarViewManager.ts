import * as vscode from 'vscode';
import { IAuthenticationService } from '../interfaces/authenticationService';
import { ConfigurationWelcomeProvider } from './configurationWelcomeProvider';
import { PipelineTreeProvider } from './pipelineTreeProvider';

/**
 * Manages the Activity Bar view, coordinating between welcome and tree views
 * based on authentication state
 */
export class ActivityBarViewManager {
  private currentView: 'welcome' | 'pipelines' = 'welcome';
  private authChangeDisposable: vscode.Disposable | undefined;
  private treeView: vscode.TreeView<any> | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: IAuthenticationService,
    private pipelineTreeProvider: PipelineTreeProvider,
    private configWelcomeProvider: ConfigurationWelcomeProvider
  ) { }

  /**
   * Initialize the Activity Bar view manager
   */
  public async initialize(): Promise<void> {
    // Register the webview view provider for welcome screen
    const webviewDisposable = vscode.window.registerWebviewViewProvider(
      'azurePipelinesView',
      this.configWelcomeProvider
    );
    this.context.subscriptions.push(webviewDisposable);

    // Check authentication status and set initial view
    await this.updateView();

    // Listen for authentication changes
    this.authChangeDisposable = this.authService.onAuthenticationChanged(async (authenticated) => {
      await this.updateView();
    });
    this.context.subscriptions.push(this.authChangeDisposable);
  }

  /**
   * Update the view based on current authentication state
   */
  private async updateView(): Promise<void> {
    const isAuthenticated = this.authService.isAuthenticated();

    if (isAuthenticated && this.currentView === 'welcome') {
      // Switch to tree view
      this.currentView = 'pipelines';
      await this.switchToTreeView();
    } else if (!isAuthenticated && this.currentView === 'pipelines') {
      // Switch to welcome view
      this.currentView = 'welcome';
      await this.switchToWelcomeView();
    }
  }

  /**
   * Switch to the pipeline tree view
   */
  private async switchToTreeView(): Promise<void> {
    // Set context for when clauses to show tree view
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.configured', true);

    // Create tree view if it doesn't exist
    if (!this.treeView) {
      this.treeView = vscode.window.createTreeView('azurePipelinesView', {
        treeDataProvider: this.pipelineTreeProvider,
        showCollapseAll: true,
        canSelectMany: false
      });
      this.context.subscriptions.push(this.treeView);
    }

    // Refresh the tree to show current data
    this.pipelineTreeProvider.refresh();
  }

  /**
   * Switch to the welcome configuration view
   */
  private async switchToWelcomeView(): Promise<void> {
    // Set context for when clauses to show welcome view
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.configured', false);

    // The welcome view is handled by the webview provider
    // No additional action needed as the webview provider is already registered
  }

  /**
   * Get the current view type
   */
  public getCurrentView(): 'welcome' | 'pipelines' {
    return this.currentView;
  }

  /**
   * Force refresh the current view
   */
  public async refresh(): Promise<void> {
    if (this.currentView === 'pipelines') {
      this.pipelineTreeProvider.refresh();
    }
    // Welcome view doesn't need explicit refresh as it's static
  }

  /**
   * Get the tree view instance (if available)
   */
  public getTreeView(): vscode.TreeView<any> | undefined {
    return this.treeView;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.authChangeDisposable) {
      this.authChangeDisposable.dispose();
    }
    if (this.treeView) {
      this.treeView.dispose();
    }
  }
}