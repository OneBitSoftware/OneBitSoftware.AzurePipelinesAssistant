import * as vscode from 'vscode';
import { IAzureDevOpsService } from './azureDevOpsService';
import { IConfigurationService, IAzurePipelinesTreeDataProvider } from '../services';

/**
 * Extension context interface that provides access to all services
 */
export interface IExtensionContext {
  /** VS Code extension context */
  context: vscode.ExtensionContext;

  /** Azure DevOps API service */
  azureDevOpsService: IAzureDevOpsService;

  /** Configuration service */
  configurationService: IConfigurationService;

  /** Tree data provider */
  treeDataProvider: IAzurePipelinesTreeDataProvider;

  /** Output channel for logging */
  outputChannel: vscode.OutputChannel;

  /** Status bar item */
  statusBarItem: vscode.StatusBarItem;

  /** Auto-refresh timer */
  refreshTimer?: NodeJS.Timeout;

  /** Initialize all services */
  initialize(): Promise<void>;

  /** Dispose all resources */
  dispose(): void;
}