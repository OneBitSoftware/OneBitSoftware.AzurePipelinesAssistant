import { AzurePipelinesTreeItem } from '../services/treeDataProvider';

/**
 * Interface for command handlers
 */
export interface ICommandHandlers {
  /**
   * Configure the extension (organization and PAT)
   */
  configure(): Promise<void>;
  
  /**
   * Refresh the tree view
   */
  refresh(): Promise<void>;
  
  /**
   * Run a pipeline
   */
  runPipeline(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View item in browser
   */
  viewInBrowser(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View run details
   */
  viewRunDetails(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View logs for a run
   */
  viewLogs(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Download artifacts from a run
   */
  downloadArtifacts(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Add item to favorites
   */
  addToFavorites(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Remove item from favorites
   */
  removeFromFavorites(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View recent runs for a pipeline
   */
  viewRecentRuns(item: AzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Cancel a running pipeline
   */
  cancelRun(item: AzurePipelinesTreeItem): Promise<void>;
}