import * as vscode from 'vscode';
import { Project, Pipeline, PipelineRun } from '../models';

/**
 * Tree item types for the Azure Pipelines explorer
 */
export type TreeItemType = 'project' | 'pipeline' | 'run' | 'stage' | 'job' | 'task';

/**
 * Base tree item for the Azure Pipelines explorer
 */
export interface AzurePipelinesTreeItem extends vscode.TreeItem {
  /** Type of tree item */
  itemType: TreeItemType;
  
  /** Associated data object */
  data: Project | Pipeline | PipelineRun | any;
  
  /** Parent item reference */
  parent?: AzurePipelinesTreeItem;
  
  /** Child items */
  children?: AzurePipelinesTreeItem[];
}

/**
 * Interface for the tree data provider
 */
export interface IAzurePipelinesTreeDataProvider extends vscode.TreeDataProvider<AzurePipelinesTreeItem> {
  /**
   * Refresh the tree view
   */
  refresh(): void;
  
  /**
   * Refresh a specific item
   */
  refreshItem(item: AzurePipelinesTreeItem): void;
  
  /**
   * Get tree item for a specific data object
   */
  getTreeItem(element: AzurePipelinesTreeItem): vscode.TreeItem;
  
  /**
   * Get children for a tree item
   */
  getChildren(element?: AzurePipelinesTreeItem): Promise<AzurePipelinesTreeItem[]>;
  
  /**
   * Get parent of a tree item
   */
  getParent(element: AzurePipelinesTreeItem): AzurePipelinesTreeItem | undefined;
  
  /**
   * Reveal and select a specific item
   */
  reveal(item: AzurePipelinesTreeItem): Promise<void>;
}