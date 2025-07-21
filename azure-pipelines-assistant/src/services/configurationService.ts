/**
 * Interface for managing extension configuration
 */
export interface IConfigurationService {
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
   * Add a project to favorites
   */
  addToFavorites(projectId: string): Promise<void>;
  
  /**
   * Remove a project from favorites
   */
  removeFromFavorites(projectId: string): Promise<void>;
  
  /**
   * Check if the extension is properly configured
   */
  isConfigured(): Promise<boolean>;
  
  /**
   * Clear all configuration (for reset/logout)
   */
  clearConfiguration(): Promise<void>;
}