import * as vscode from 'vscode';
import { IAuthenticationService } from '../interfaces/authenticationService';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import { PipelineRun, PipelineState, PipelineResult } from '../models';

/**
 * Interface for status bar service
 */
export interface IStatusBarService {
    /**
     * Initialize the status bar items
     */
    initialize(): void;

    /**
     * Update connection status
     */
    updateConnectionStatus(isConnected: boolean, organization?: string): void;

    /**
     * Update pipeline run status
     */
    updatePipelineRunStatus(run?: PipelineRun): void;

    /**
     * Clear pipeline run status
     */
    clearPipelineRunStatus(): void;

    /**
     * Show error status
     */
    showError(message: string): void;

    /**
     * Dispose of resources
     */
    dispose(): void;
}

/**
 * Status bar service implementation
 */
export class StatusBarService implements IStatusBarService {
    private connectionStatusItem: vscode.StatusBarItem;
    private pipelineStatusItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    private currentMonitoredRun: PipelineRun | undefined;
    private monitoringInterval: NodeJS.Timeout | undefined;

    constructor(
        private readonly authService: IAuthenticationService,
        private readonly azureDevOpsService: IAzureDevOpsService,
        private readonly context: vscode.ExtensionContext
    ) {
        // Create status bar items
        this.connectionStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.pipelineStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );

        // Set up click handlers
        this.connectionStatusItem.command = 'azurePipelinesAssistant.configure';
        this.pipelineStatusItem.command = 'azurePipelinesAssistant.refresh';

        // Add to disposables
        this.disposables.push(this.connectionStatusItem, this.pipelineStatusItem);
    }

    /**
     * Initialize the status bar items
     */
    public initialize(): void {
        // Listen for authentication changes
        const authChangeDisposable = this.authService.onAuthenticationChanged((isAuthenticated) => {
            if (isAuthenticated) {
                const organization = this.authService.getCurrentOrganization();
                this.updateConnectionStatus(true, organization || undefined);
            } else {
                this.updateConnectionStatus(false);
                this.clearPipelineRunStatus();
            }
        });
        this.disposables.push(authChangeDisposable);

        // Set initial connection status
        const isAuthenticated = this.authService.isAuthenticated();
        const organization = this.authService.getCurrentOrganization();
        this.updateConnectionStatus(isAuthenticated, organization || undefined);

        // Show status bar items
        this.connectionStatusItem.show();
    }

    /**
     * Update connection status
     */
    public updateConnectionStatus(isConnected: boolean, organization?: string): void {
        if (isConnected && organization) {
            this.connectionStatusItem.text = `$(cloud) ${organization}`;
            this.connectionStatusItem.tooltip = `Connected to Azure DevOps: ${organization}\nClick to configure`;
            this.connectionStatusItem.backgroundColor = undefined;
            this.connectionStatusItem.color = undefined;
        } else if (isConnected) {
            this.connectionStatusItem.text = `$(cloud) Azure DevOps`;
            this.connectionStatusItem.tooltip = 'Connected to Azure DevOps\nClick to configure';
            this.connectionStatusItem.backgroundColor = undefined;
            this.connectionStatusItem.color = undefined;
        } else {
            this.connectionStatusItem.text = `$(cloud-offline) Not Connected`;
            this.connectionStatusItem.tooltip = 'Not connected to Azure DevOps\nClick to configure';
            this.connectionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.connectionStatusItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        }
    }

    /**
     * Update pipeline run status
     */
    public updatePipelineRunStatus(run?: PipelineRun): void {
        if (!run) {
            this.clearPipelineRunStatus();
            return;
        }

        this.currentMonitoredRun = run;
        const statusInfo = this.getRunStatusInfo(run);
        
        this.pipelineStatusItem.text = `${statusInfo.icon} ${run.pipeline.name} #${run.id}`;
        this.pipelineStatusItem.tooltip = this.buildRunTooltip(run, statusInfo);
        this.pipelineStatusItem.backgroundColor = statusInfo.backgroundColor;
        this.pipelineStatusItem.color = statusInfo.color;
        this.pipelineStatusItem.show();

        // Start monitoring if run is in progress
        if (run.state === 'inProgress') {
            this.startMonitoring(run);
        } else {
            this.stopMonitoring();
        }
    }

    /**
     * Clear pipeline run status
     */
    public clearPipelineRunStatus(): void {
        this.pipelineStatusItem.hide();
        this.currentMonitoredRun = undefined;
        this.stopMonitoring();
    }

    /**
     * Show error status
     */
    public showError(message: string): void {
        this.connectionStatusItem.text = `$(error) Error`;
        this.connectionStatusItem.tooltip = `Error: ${message}\nClick to configure`;
        this.connectionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.connectionStatusItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
    }

    /**
     * Start monitoring a pipeline run for updates
     */
    private startMonitoring(run: PipelineRun): void {
        this.stopMonitoring(); // Clear any existing monitoring

        this.monitoringInterval = setInterval(async () => {
            try {
                const updatedRun = await this.azureDevOpsService.getRunDetails(
                    run.id,
                    run.pipeline.id,
                    run.pipeline.project.id
                );
                
                // Update status if run has changed
                if (updatedRun.state !== this.currentMonitoredRun?.state || 
                    updatedRun.result !== this.currentMonitoredRun?.result) {
                    this.updatePipelineRunStatus(updatedRun);
                }

                // Stop monitoring if run is complete
                if (updatedRun.state === 'completed') {
                    this.stopMonitoring();
                }
            } catch (error) {
                console.error('Failed to update pipeline run status:', error);
                // Continue monitoring despite errors
            }
        }, 10000); // Update every 10 seconds
    }

    /**
     * Stop monitoring pipeline runs
     */
    private stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }

    /**
     * Get status information for a pipeline run
     */
    private getRunStatusInfo(run: PipelineRun): {
        icon: string;
        backgroundColor?: vscode.ThemeColor;
        color?: vscode.ThemeColor;
    } {
        if (run.state === 'inProgress') {
            return {
                icon: '$(sync~spin)',
                backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground'),
                color: new vscode.ThemeColor('statusBarItem.prominentForeground')
            };
        }

        if (run.state === 'cancelling') {
            return {
                icon: '$(loading~spin)',
                backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
                color: new vscode.ThemeColor('statusBarItem.warningForeground')
            };
        }

        if (run.state === 'cancelled') {
            return {
                icon: '$(circle-slash)',
                backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
                color: new vscode.ThemeColor('statusBarItem.warningForeground')
            };
        }

        // Completed state - check result
        switch (run.result) {
            case 'succeeded':
                return {
                    icon: '$(check)',
                    color: new vscode.ThemeColor('testing.iconPassed')
                };
            case 'failed':
                return {
                    icon: '$(error)',
                    backgroundColor: new vscode.ThemeColor('statusBarItem.errorBackground'),
                    color: new vscode.ThemeColor('statusBarItem.errorForeground')
                };
            case 'partiallySucceeded':
                return {
                    icon: '$(warning)',
                    backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
                    color: new vscode.ThemeColor('statusBarItem.warningForeground')
                };
            case 'canceled':
                return {
                    icon: '$(circle-slash)',
                    backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
                    color: new vscode.ThemeColor('statusBarItem.warningForeground')
                };
            case 'abandoned':
                return {
                    icon: '$(circle-slash)',
                    color: new vscode.ThemeColor('descriptionForeground')
                };
            default:
                return {
                    icon: '$(question)',
                    color: new vscode.ThemeColor('descriptionForeground')
                };
        }
    }

    /**
     * Build tooltip text for a pipeline run
     */
    private buildRunTooltip(run: PipelineRun, statusInfo: { icon: string }): string {
        const lines: string[] = [];
        
        lines.push(`Pipeline: ${run.pipeline.name}`);
        lines.push(`Run: #${run.id}`);
        lines.push(`State: ${run.state}`);
        
        if (run.result) {
            lines.push(`Result: ${run.result}`);
        }
        
        lines.push(`Started: ${run.createdDate.toLocaleString()}`);
        
        if (run.finishedDate) {
            lines.push(`Finished: ${run.finishedDate.toLocaleString()}`);
            const duration = run.finishedDate.getTime() - run.createdDate.getTime();
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            lines.push(`Duration: ${minutes}m ${seconds}s`);
        } else if (run.state === 'inProgress') {
            const elapsed = Date.now() - run.createdDate.getTime();
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            lines.push(`Elapsed: ${minutes}m ${seconds}s`);
        }
        
        lines.push('');
        lines.push('Click to refresh pipeline data');
        
        return lines.join('\n');
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.stopMonitoring();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}