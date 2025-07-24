import { IAzurePipelinesTreeItem } from '../models/treeItems';

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
  runPipeline(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View item in browser
   */
  viewInBrowser(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View run details
   */
  viewRunDetails(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View logs for a run
   */
  viewLogs(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Download artifacts from a run
   */
  downloadArtifacts(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Add item to favorites
   */
  addToFavorites(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Remove item from favorites
   */
  removeFromFavorites(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * View recent runs for a pipeline
   */
  viewRecentRuns(item: IAzurePipelinesTreeItem): Promise<void>;
  
  /**
   * Cancel a running pipeline
   */
  cancelRun(item: IAzurePipelinesTreeItem): Promise<void>;
}