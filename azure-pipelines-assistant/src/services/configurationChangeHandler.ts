import * as vscode from 'vscode';
import { IConfigurationService } from './configurationService';
import { ConfigurationChangeEvent } from '../models/configuration';

/**
 * Handles configuration changes and triggers appropriate actions
 */
export class ConfigurationChangeHandler {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly configService: IConfigurationService,
    private readonly context: vscode.ExtensionContext
  ) {
    this.setupConfigurationWatching();
  }

  /**
   * Setup configuration change watching
   */
  private setupConfigurationWatching(): void {
    // Listen to configuration changes from the service
    const configChangeDisposable = this.configService.onConfigurationChanged(
      (event) => this.handleConfigurationChange(event)
    );
    
    this.disposables.push(configChangeDisposable);
  }

  /**
   * Handle configuration change events
   */
  private async handleConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
    try {
      switch (event.field) {
        case 'organization':
          await this.handleOrganizationChange(event);
          break;
        case 'refreshInterval':
          await this.handleRefreshIntervalChange(event);
          break;
        case 'autoRefresh':
          await this.handleAutoRefreshChange(event);
          break;
        case 'favoriteProjects':
        case 'favoritePipelines':
          await this.handleFavoritesChange(event);
          break;
        case 'maxRunsPerPipeline':
          await this.handleMaxRunsChange(event);
          break;
        case 'showTimestamps':
          await this.handleTimestampDisplayChange(event);
          break;
        case 'compactView':
          await this.handleViewModeChange(event);
          break;
        case 'logLevel':
          await this.handleLogLevelChange(event);
          break;
        case 'cacheTimeout':
          await this.handleCacheTimeoutChange(event);
          break;
        case 'showWelcomeOnStartup':
          // No immediate action needed
          break;
      }
    } catch (error) {
      console.error(`Error handling configuration change for ${event.field}:`, error);
    }
  }

  /**
   * Handle organization change
   */
  private async handleOrganizationChange(event: ConfigurationChangeEvent): Promise<void> {
    // Clear cache when organization changes
    await vscode.commands.executeCommand('azurePipelinesAssistant.clearCache');
    
    // Refresh tree view
    await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');
    
    // Update context for conditional UI elements
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.hasOrganization', !!event.newValue);
    
    // Show notification
    if (event.newValue) {
      vscode.window.showInformationMessage(`Azure DevOps organization changed to: ${event.newValue}`);
    }
  }

  /**
   * Handle refresh interval change
   */
  private async handleRefreshIntervalChange(event: ConfigurationChangeEvent): Promise<void> {
    // Restart auto-refresh with new interval
    await vscode.commands.executeCommand('azurePipelinesAssistant.restartAutoRefresh');
    
    vscode.window.showInformationMessage(`Auto-refresh interval changed to ${event.newValue} seconds`);
  }

  /**
   * Handle auto-refresh toggle
   */
  private async handleAutoRefreshChange(event: ConfigurationChangeEvent): Promise<void> {
    if (event.newValue) {
      await vscode.commands.executeCommand('azurePipelinesAssistant.startAutoRefresh');
      vscode.window.showInformationMessage('Auto-refresh enabled');
    } else {
      await vscode.commands.executeCommand('azurePipelinesAssistant.stopAutoRefresh');
      vscode.window.showInformationMessage('Auto-refresh disabled');
    }
  }

  /**
   * Handle favorites change
   */
  private async handleFavoritesChange(event: ConfigurationChangeEvent): Promise<void> {
    // Refresh tree view to update favorite indicators
    await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');
    
    // Update context for conditional menu items
    await this.updateFavoriteContexts();
  }

  /**
   * Handle max runs per pipeline change
   */
  private async handleMaxRunsChange(event: ConfigurationChangeEvent): Promise<void> {
    // Clear cache to force reload with new limit
    await vscode.commands.executeCommand('azurePipelinesAssistant.clearCache');
    
    // Refresh tree view
    await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');
    
    vscode.window.showInformationMessage(`Maximum runs per pipeline changed to ${event.newValue}`);
  }

  /**
   * Handle timestamp display change
   */
  private async handleTimestampDisplayChange(event: ConfigurationChangeEvent): Promise<void> {
    // Refresh any open log viewers or run details
    await vscode.commands.executeCommand('azurePipelinesAssistant.refreshWebviews');
    
    const message = event.newValue ? 'Timestamps will now be shown' : 'Timestamps will now be hidden';
    vscode.window.showInformationMessage(message);
  }

  /**
   * Handle view mode change
   */
  private async handleViewModeChange(event: ConfigurationChangeEvent): Promise<void> {
    // Refresh tree view with new display mode
    await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');
    
    const mode = event.newValue ? 'compact' : 'normal';
    vscode.window.showInformationMessage(`View mode changed to ${mode}`);
  }

  /**
   * Handle log level change
   */
  private async handleLogLevelChange(event: ConfigurationChangeEvent): Promise<void> {
    // Update logger configuration
    await vscode.commands.executeCommand('azurePipelinesAssistant.updateLogLevel', event.newValue);
    
    vscode.window.showInformationMessage(`Log level changed to ${event.newValue}`);
  }

  /**
   * Handle cache timeout change
   */
  private async handleCacheTimeoutChange(event: ConfigurationChangeEvent): Promise<void> {
    // Update cache service configuration
    await vscode.commands.executeCommand('azurePipelinesAssistant.updateCacheTimeout', event.newValue);
    
    vscode.window.showInformationMessage(`Cache timeout changed to ${event.newValue} seconds`);
  }

  /**
   * Update favorite contexts for conditional UI
   */
  private async updateFavoriteContexts(): Promise<void> {
    const favoriteProjects = this.configService.getFavoriteProjects();
    const favoritePipelines = this.configService.getFavoritePipelines();
    
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.hasFavoriteProjects', favoriteProjects.length > 0);
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.hasFavoritePipelines', favoritePipelines.length > 0);
  }

  /**
   * Initialize contexts on startup
   */
  public async initializeContexts(): Promise<void> {
    const isConfigured = await this.configService.isConfigured();
    const organization = this.configService.getOrganization();
    
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.configured', isConfigured);
    await vscode.commands.executeCommand('setContext', 'azurePipelinesAssistant.hasOrganization', !!organization);
    
    await this.updateFavoriteContexts();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
  }
}