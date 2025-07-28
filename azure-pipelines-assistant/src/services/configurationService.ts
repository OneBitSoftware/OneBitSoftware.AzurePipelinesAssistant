import * as vscode from 'vscode';
import { 
  ExtensionConfiguration, 
  FavoritePipeline, 
  ConfigurationValidationResult, 
  ConfigurationChangeEvent,
  DEFAULT_CONFIGURATION,
  CONFIGURATION_SCHEMA,
  LogLevel
} from '../models/configuration';

/**
 * Interface for managing extension configuration
 */
export interface IConfigurationService {
  /**
   * Get the complete configuration
   */
  getConfiguration(): ExtensionConfiguration;
  
  /**
   * Get the Azure DevOps organization name
   */
  getOrganization(): string | undefined;
  
  /**
   * Set the Azure DevOps organization name
   */
  setOrganization(organization: string): Promise<void>;
  
  /**
   * Get the Personal Access Token (from secure storage)
   */
  getPersonalAccessToken(): Promise<string | undefined>;
  
  /**
   * Set the Personal Access Token (to secure storage)
   */
  setPersonalAccessToken(token: string): Promise<void>;
  
  /**
   * Get the refresh interval in seconds
   */
  getRefreshInterval(): number;
  
  /**
   * Get the maximum number of runs to show per pipeline
   */
  getMaxRunsPerPipeline(): number;
  
  /**
   * Get whether to show timestamps
   */
  getShowTimestamps(): boolean;
  
  /**
   * Get whether auto-refresh is enabled
   */
  getAutoRefresh(): boolean;
  
  /**
   * Get the list of favorite project IDs
   */
  getFavoriteProjects(): string[];
  
  /**
   * Get the list of favorite pipelines
   */
  getFavoritePipelines(): FavoritePipeline[];
  
  /**
   * Get cache timeout in seconds
   */
  getCacheTimeout(): number;
  
  /**
   * Get log level
   */
  getLogLevel(): LogLevel;
  
  /**
   * Get whether to show welcome on startup
   */
  getShowWelcomeOnStartup(): boolean;
  
  /**
   * Get whether to use compact view
   */
  getCompactView(): boolean;
  
  /**
   * Add a project to favorites
   */
  addProjectToFavorites(projectId: string): Promise<void>;
  
  /**
   * Remove a project from favorites
   */
  removeProjectFromFavorites(projectId: string): Promise<void>;
  
  /**
   * Check if a project is in favorites
   */
  isProjectFavorite(projectId: string): boolean;
  
  /**
   * Add a pipeline to favorites
   */
  addPipelineToFavorites(pipeline: FavoritePipeline): Promise<void>;
  
  /**
   * Remove a pipeline from favorites
   */
  removePipelineFromFavorites(projectId: string, pipelineId: number): Promise<void>;
  
  /**
   * Check if a pipeline is in favorites
   */
  isPipelineFavorite(projectId: string, pipelineId: number): boolean;
  
  /**
   * Validate configuration
   */
  validateConfiguration(config?: Partial<ExtensionConfiguration>): ConfigurationValidationResult;
  
  /**
   * Check if the extension is properly configured
   */
  isConfigured(): Promise<boolean>;
  
  /**
   * Clear all configuration (for reset/logout)
   */
  clearConfiguration(): Promise<void>;
  
  /**
   * Subscribe to configuration changes
   */
  onConfigurationChanged(listener: (event: ConfigurationChangeEvent) => void): vscode.Disposable;
  
  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): Promise<void>;
  
  /**
   * Export configuration for backup
   */
  exportConfiguration(): Promise<string>;
  
  /**
   * Import configuration from backup
   */
  importConfiguration(configJson: string): Promise<void>;
}

/**
 * Implementation of configuration service
 */
export class ConfigurationService implements IConfigurationService {
  private static readonly EXTENSION_ID = 'azurePipelinesAssistant';
  private static readonly PAT_SECRET_KEY = 'azurePipelinesAssistant.personalAccessToken';
  
  private readonly _onConfigurationChanged = new vscode.EventEmitter<ConfigurationChangeEvent>();
  private readonly configurationWatcher: vscode.Disposable;
  
  constructor(
    private readonly context: vscode.ExtensionContext
  ) {
    // Watch for configuration changes
    this.configurationWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(ConfigurationService.EXTENSION_ID)) {
        this.handleConfigurationChange(event);
      }
    });
  }
  
  getConfiguration(): ExtensionConfiguration {
    const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
    
    return {
      organization: config.get<string>('organization') || '',
      refreshInterval: config.get<number>('refreshInterval') || DEFAULT_CONFIGURATION.refreshInterval!,
      maxRunsPerPipeline: config.get<number>('maxRunsPerPipeline') || DEFAULT_CONFIGURATION.maxRunsPerPipeline!,
      showTimestamps: config.get<boolean>('showTimestamps') ?? DEFAULT_CONFIGURATION.showTimestamps!,
      autoRefresh: config.get<boolean>('autoRefresh') ?? DEFAULT_CONFIGURATION.autoRefresh!,
      favoriteProjects: config.get<string[]>('favoriteProjects') || DEFAULT_CONFIGURATION.favoriteProjects!,
      favoritePipelines: config.get<FavoritePipeline[]>('favoritePipelines') || DEFAULT_CONFIGURATION.favoritePipelines!,
      cacheTimeout: config.get<number>('cacheTimeout') || DEFAULT_CONFIGURATION.cacheTimeout!,
      logLevel: config.get<LogLevel>('logLevel') || DEFAULT_CONFIGURATION.logLevel!,
      showWelcomeOnStartup: config.get<boolean>('showWelcomeOnStartup') ?? DEFAULT_CONFIGURATION.showWelcomeOnStartup!,
      compactView: config.get<boolean>('compactView') ?? DEFAULT_CONFIGURATION.compactView!,
    };
  }
  
  getOrganization(): string | undefined {
    const org = this.getConfiguration().organization;
    return org || undefined;
  }
  
  async setOrganization(organization: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
    await config.update('organization', organization, vscode.ConfigurationTarget.Global);
  }
  
  async getPersonalAccessToken(): Promise<string | undefined> {
    return await this.context.secrets.get(ConfigurationService.PAT_SECRET_KEY);
  }
  
  async setPersonalAccessToken(token: string): Promise<void> {
    await this.context.secrets.store(ConfigurationService.PAT_SECRET_KEY, token);
  }
  
  getRefreshInterval(): number {
    return this.getConfiguration().refreshInterval;
  }
  
  getMaxRunsPerPipeline(): number {
    return this.getConfiguration().maxRunsPerPipeline;
  }
  
  getShowTimestamps(): boolean {
    return this.getConfiguration().showTimestamps;
  }
  
  getAutoRefresh(): boolean {
    return this.getConfiguration().autoRefresh;
  }
  
  getFavoriteProjects(): string[] {
    return this.getConfiguration().favoriteProjects;
  }
  
  getFavoritePipelines(): FavoritePipeline[] {
    return this.getConfiguration().favoritePipelines;
  }
  
  getCacheTimeout(): number {
    return this.getConfiguration().cacheTimeout;
  }
  
  getLogLevel(): LogLevel {
    return this.getConfiguration().logLevel;
  }
  
  getShowWelcomeOnStartup(): boolean {
    return this.getConfiguration().showWelcomeOnStartup;
  }
  
  getCompactView(): boolean {
    return this.getConfiguration().compactView;
  }
  
  async addProjectToFavorites(projectId: string): Promise<void> {
    const favorites = this.getFavoriteProjects();
    if (!favorites.includes(projectId)) {
      const newFavorites = [...favorites, projectId];
      const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
      await config.update('favoriteProjects', newFavorites, vscode.ConfigurationTarget.Global);
    }
  }
  
  async removeProjectFromFavorites(projectId: string): Promise<void> {
    const favorites = this.getFavoriteProjects();
    const newFavorites = favorites.filter(id => id !== projectId);
    const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
    await config.update('favoriteProjects', newFavorites, vscode.ConfigurationTarget.Global);
  }
  
  isProjectFavorite(projectId: string): boolean {
    return this.getFavoriteProjects().includes(projectId);
  }
  
  async addPipelineToFavorites(pipeline: FavoritePipeline): Promise<void> {
    const favorites = this.getFavoritePipelines();
    const exists = favorites.some(p => p.projectId === pipeline.projectId && p.pipelineId === pipeline.pipelineId);
    
    if (!exists) {
      const newFavorites = [...favorites, pipeline];
      const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
      await config.update('favoritePipelines', newFavorites, vscode.ConfigurationTarget.Global);
    }
  }
  
  async removePipelineFromFavorites(projectId: string, pipelineId: number): Promise<void> {
    const favorites = this.getFavoritePipelines();
    const newFavorites = favorites.filter(p => !(p.projectId === projectId && p.pipelineId === pipelineId));
    const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
    await config.update('favoritePipelines', newFavorites, vscode.ConfigurationTarget.Global);
  }
  
  isPipelineFavorite(projectId: string, pipelineId: number): boolean {
    return this.getFavoritePipelines().some(p => p.projectId === projectId && p.pipelineId === pipelineId);
  }
  
  validateConfiguration(config?: Partial<ExtensionConfiguration>): ConfigurationValidationResult {
    const configToValidate = config || this.getConfiguration();
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Validate each field according to schema
    for (const [field, metadata] of Object.entries(CONFIGURATION_SCHEMA)) {
      const value = (configToValidate as any)[field];
      
      // Check required fields
      if (metadata.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${field} is required`,
          value
        });
        continue;
      }
      
      // Skip validation if value is undefined and field is not required
      if (value === undefined && !metadata.required) {
        continue;
      }
      
      // Type validation
      if (metadata.type === 'number' && typeof value !== 'number') {
        errors.push({
          field,
          message: `${field} must be a number`,
          value
        });
        continue;
      }
      
      if (metadata.type === 'string' && typeof value !== 'string') {
        errors.push({
          field,
          message: `${field} must be a string`,
          value
        });
        continue;
      }
      
      if (metadata.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          value
        });
        continue;
      }
      
      if (metadata.type === 'array' && !Array.isArray(value)) {
        errors.push({
          field,
          message: `${field} must be an array`,
          value
        });
        continue;
      }
      
      // Range validation for numbers
      if (metadata.type === 'number' && typeof value === 'number') {
        if (metadata.min !== undefined && value < metadata.min) {
          errors.push({
            field,
            message: `${field} must be at least ${metadata.min}`,
            value
          });
        }
        
        if (metadata.max !== undefined && value > metadata.max) {
          errors.push({
            field,
            message: `${field} must be at most ${metadata.max}`,
            value
          });
        }
      }
      
      // Pattern validation for strings
      if (metadata.type === 'string' && typeof value === 'string' && metadata.pattern) {
        if (!metadata.pattern.test(value)) {
          errors.push({
            field,
            message: `${field} format is invalid`,
            value
          });
        }
      }
    }
    
    // Special validation for organization
    if (configToValidate.organization && configToValidate.organization.length > 0) {
      if (configToValidate.organization.length < 2) {
        warnings.push({
          field: 'organization',
          message: 'Organization name seems very short',
          value: configToValidate.organization
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  async isConfigured(): Promise<boolean> {
    const organization = this.getOrganization();
    const pat = await this.getPersonalAccessToken();
    
    return !!(organization && pat);
  }
  
  async clearConfiguration(): Promise<void> {
    // Clear secure storage
    await this.context.secrets.delete(ConfigurationService.PAT_SECRET_KEY);
    
    // Reset all configuration to defaults
    const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
    
    await Promise.all([
      config.update('organization', undefined, vscode.ConfigurationTarget.Global),
      config.update('favoriteProjects', DEFAULT_CONFIGURATION.favoriteProjects, vscode.ConfigurationTarget.Global),
      config.update('favoritePipelines', DEFAULT_CONFIGURATION.favoritePipelines, vscode.ConfigurationTarget.Global),
    ]);
  }
  
  onConfigurationChanged(listener: (event: ConfigurationChangeEvent) => void): vscode.Disposable {
    return this._onConfigurationChanged.event(listener);
  }
  
  async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
    
    await Promise.all([
      config.update('refreshInterval', DEFAULT_CONFIGURATION.refreshInterval, vscode.ConfigurationTarget.Global),
      config.update('maxRunsPerPipeline', DEFAULT_CONFIGURATION.maxRunsPerPipeline, vscode.ConfigurationTarget.Global),
      config.update('showTimestamps', DEFAULT_CONFIGURATION.showTimestamps, vscode.ConfigurationTarget.Global),
      config.update('autoRefresh', DEFAULT_CONFIGURATION.autoRefresh, vscode.ConfigurationTarget.Global),
      config.update('cacheTimeout', DEFAULT_CONFIGURATION.cacheTimeout, vscode.ConfigurationTarget.Global),
      config.update('logLevel', DEFAULT_CONFIGURATION.logLevel, vscode.ConfigurationTarget.Global),
      config.update('showWelcomeOnStartup', DEFAULT_CONFIGURATION.showWelcomeOnStartup, vscode.ConfigurationTarget.Global),
      config.update('compactView', DEFAULT_CONFIGURATION.compactView, vscode.ConfigurationTarget.Global),
    ]);
  }
  
  async exportConfiguration(): Promise<string> {
    const config = this.getConfiguration();
    const pat = await this.getPersonalAccessToken();
    
    const exportData = {
      ...config,
      personalAccessToken: pat ? '***REDACTED***' : undefined,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  async importConfiguration(configJson: string): Promise<void> {
    try {
      const importData = JSON.parse(configJson);
      const config = vscode.workspace.getConfiguration(ConfigurationService.EXTENSION_ID);
      
      // Validate imported data
      const validation = this.validateConfiguration(importData);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      // Import settings (excluding PAT for security)
      await Promise.all([
        config.update('organization', importData.organization, vscode.ConfigurationTarget.Global),
        config.update('refreshInterval', importData.refreshInterval, vscode.ConfigurationTarget.Global),
        config.update('maxRunsPerPipeline', importData.maxRunsPerPipeline, vscode.ConfigurationTarget.Global),
        config.update('showTimestamps', importData.showTimestamps, vscode.ConfigurationTarget.Global),
        config.update('autoRefresh', importData.autoRefresh, vscode.ConfigurationTarget.Global),
        config.update('favoriteProjects', importData.favoriteProjects, vscode.ConfigurationTarget.Global),
        config.update('favoritePipelines', importData.favoritePipelines, vscode.ConfigurationTarget.Global),
        config.update('cacheTimeout', importData.cacheTimeout, vscode.ConfigurationTarget.Global),
        config.update('logLevel', importData.logLevel, vscode.ConfigurationTarget.Global),
        config.update('showWelcomeOnStartup', importData.showWelcomeOnStartup, vscode.ConfigurationTarget.Global),
        config.update('compactView', importData.compactView, vscode.ConfigurationTarget.Global),
      ]);
      
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
    // Get current configuration
    const currentConfig = this.getConfiguration();
    
    // Emit change events for affected fields
    for (const field of Object.keys(CONFIGURATION_SCHEMA) as Array<keyof ExtensionConfiguration>) {
      if (event.affectsConfiguration(`${ConfigurationService.EXTENSION_ID}.${field}`)) {
        this._onConfigurationChanged.fire({
          field,
          oldValue: undefined, // We don't track old values currently
          newValue: (currentConfig as any)[field],
          timestamp: new Date()
        });
      }
    }
  }
  
  dispose(): void {
    this.configurationWatcher.dispose();
    this._onConfigurationChanged.dispose();
  }
}