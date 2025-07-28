import * as vscode from 'vscode';
import { 
    IRealTimeUpdateService, 
    RunSubscription, 
    RealTimeUpdateConfig, 
    RunStatusChangeEvent,
    RealTimeUpdateStats
} from '../interfaces/realTimeUpdateService';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import { IConfigurationService } from './configurationService';
import { PipelineRun } from '../models/pipelineRun';

/**
 * Real-time update service implementation with background polling and smart refresh
 */
export class RealTimeUpdateService implements IRealTimeUpdateService {
    private subscriptions = new Map<string, RunSubscription>();
    private pipelineSubscriptions = new Map<string, Set<(runs: PipelineRun[]) => void>>();
    private backgroundTimer?: NodeJS.Timeout;
    private isDisposed = false;
    private stats: RealTimeUpdateStats;
    
    private readonly _onRunStatusChanged = new vscode.EventEmitter<RunStatusChangeEvent>();
    public readonly onRunStatusChanged = this._onRunStatusChanged.event;

    private config: RealTimeUpdateConfig = {
        pollingInterval: 30000, // 30 seconds default
        maxActiveSubscriptions: 50,
        enableIncrementalFetch: true,
        backgroundRefreshEnabled: true
    };

    constructor(
        private azureDevOpsService: IAzureDevOpsService,
        private configurationService: IConfigurationService
    ) {
        this.stats = {
            activeSubscriptions: 0,
            totalUpdatesReceived: 0,
            backgroundRefreshActive: false,
            pollingInterval: this.config.pollingInterval,
            averageResponseTime: 0,
            errorCount: 0
        };

        // Initialize configuration from settings
        this.initializeConfiguration();

        // Listen for configuration changes
        this.configurationService.onConfigurationChanged((event) => {
            if (event.field === 'refreshInterval' || event.field === 'autoRefresh') {
                this.updateConfigurationFromSettings();
            }
        });
    }

    /**
     * Subscribe to updates for a specific pipeline run
     */
    subscribeToRunUpdates(
        runId: number,
        pipelineId: number,
        projectId: string,
        callback: (run: PipelineRun) => void
    ): vscode.Disposable {
        if (this.isDisposed) {
            throw new Error('Service has been disposed');
        }

        if (this.subscriptions.size >= this.config.maxActiveSubscriptions) {
            throw new Error(`Maximum number of subscriptions (${this.config.maxActiveSubscriptions}) reached`);
        }

        const subscriptionKey = `${projectId}:${pipelineId}:${runId}`;
        
        // Check if subscription already exists
        if (this.subscriptions.has(subscriptionKey)) {
            // Update the callback for existing subscription
            const existing = this.subscriptions.get(subscriptionKey)!;
            existing.callback = callback;
            existing.lastUpdated = new Date();
            return new vscode.Disposable(() => this.unsubscribeFromRun(subscriptionKey));
        }

        const subscription: RunSubscription = {
            runId,
            pipelineId,
            projectId,
            callback,
            lastUpdated: new Date(),
            isActive: true
        };

        this.subscriptions.set(subscriptionKey, subscription);
        this.stats.activeSubscriptions = this.subscriptions.size;

        // Start background refresh if not already running and enabled
        if (this.config.backgroundRefreshEnabled && !this.backgroundTimer) {
            this.startBackgroundRefresh();
        }

        // Immediately fetch current status
        this.fetchRunUpdate(subscription).catch(error => {
            console.warn(`Failed to fetch initial run status for ${subscriptionKey}:`, error);
        });

        return new vscode.Disposable(() => this.unsubscribeFromRun(subscriptionKey));
    }

    /**
     * Subscribe to updates for all active runs in a pipeline
     */
    subscribeToPipelineUpdates(
        pipelineId: number,
        projectId: string,
        callback: (runs: PipelineRun[]) => void
    ): vscode.Disposable {
        if (this.isDisposed) {
            throw new Error('Service has been disposed');
        }

        const subscriptionKey = `${projectId}:${pipelineId}`;
        
        if (!this.pipelineSubscriptions.has(subscriptionKey)) {
            this.pipelineSubscriptions.set(subscriptionKey, new Set());
        }

        this.pipelineSubscriptions.get(subscriptionKey)!.add(callback);

        // Start background refresh if not already running and enabled
        if (this.config.backgroundRefreshEnabled && !this.backgroundTimer) {
            this.startBackgroundRefresh();
        }

        // Immediately fetch current pipeline runs
        this.fetchPipelineUpdates(pipelineId, projectId).catch(error => {
            console.warn(`Failed to fetch initial pipeline runs for ${subscriptionKey}:`, error);
        });

        return new vscode.Disposable(() => {
            const callbacks = this.pipelineSubscriptions.get(subscriptionKey);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.pipelineSubscriptions.delete(subscriptionKey);
                }
            }
        });
    }

    /**
     * Start background polling for active pipeline runs
     */
    startBackgroundRefresh(): void {
        if (this.isDisposed || this.backgroundTimer) {
            return;
        }

        this.stats.backgroundRefreshActive = true;
        this.backgroundTimer = setInterval(async () => {
            await this.performBackgroundRefresh();
        }, this.config.pollingInterval);
    }

    /**
     * Stop background polling
     */
    stopBackgroundRefresh(): void {
        if (this.backgroundTimer) {
            clearInterval(this.backgroundTimer);
            this.backgroundTimer = undefined;
            this.stats.backgroundRefreshActive = false;
        }
    }

    /**
     * Check if background refresh is currently running
     */
    isBackgroundRefreshActive(): boolean {
        return !!this.backgroundTimer;
    }

    /**
     * Get current subscription count
     */
    getActiveSubscriptionCount(): number {
        return this.subscriptions.size + this.pipelineSubscriptions.size;
    }

    /**
     * Get configuration
     */
    getConfiguration(): RealTimeUpdateConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfiguration(config: Partial<RealTimeUpdateConfig>): void {
        const oldInterval = this.config.pollingInterval;
        this.config = { ...this.config, ...config };
        this.stats.pollingInterval = this.config.pollingInterval;

        // Restart background refresh if interval changed
        if (config.pollingInterval && config.pollingInterval !== oldInterval && this.backgroundTimer) {
            this.stopBackgroundRefresh();
            if (this.config.backgroundRefreshEnabled) {
                this.startBackgroundRefresh();
            }
        }

        // Start or stop background refresh based on enabled flag
        if (config.backgroundRefreshEnabled !== undefined) {
            if (config.backgroundRefreshEnabled && !this.backgroundTimer) {
                this.startBackgroundRefresh();
            } else if (!config.backgroundRefreshEnabled && this.backgroundTimer) {
                this.stopBackgroundRefresh();
            }
        }
    }

    /**
     * Force refresh of all active subscriptions
     */
    async refreshAllSubscriptions(): Promise<void> {
        if (this.isDisposed) {
            return;
        }

        const refreshPromises: Promise<void>[] = [];

        // Refresh individual run subscriptions
        for (const subscription of this.subscriptions.values()) {
            if (subscription.isActive) {
                refreshPromises.push(this.fetchRunUpdate(subscription));
            }
        }

        // Refresh pipeline subscriptions
        for (const [key] of this.pipelineSubscriptions) {
            const [projectId, pipelineId] = key.split(':');
            refreshPromises.push(this.fetchPipelineUpdates(parseInt(pipelineId), projectId));
        }

        await Promise.allSettled(refreshPromises);
    }

    /**
     * Clear all subscriptions and stop background refresh
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }

        this.isDisposed = true;
        this.stopBackgroundRefresh();
        this.subscriptions.clear();
        this.pipelineSubscriptions.clear();
        this._onRunStatusChanged.dispose();
        
        this.stats.activeSubscriptions = 0;
        this.stats.backgroundRefreshActive = false;
    }

    /**
     * Get current statistics
     */
    getStats(): RealTimeUpdateStats {
        return { ...this.stats };
    }

    /**
     * Initialize configuration from VS Code settings
     */
    private initializeConfiguration(): void {
        this.updateConfigurationFromSettings();
    }

    /**
     * Update configuration from VS Code settings
     */
    private updateConfigurationFromSettings(): void {
        const refreshInterval = this.configurationService.getRefreshInterval() * 1000; // Convert to milliseconds
        const autoRefresh = this.configurationService.getAutoRefresh();

        this.updateConfiguration({
            pollingInterval: refreshInterval,
            backgroundRefreshEnabled: autoRefresh
        });
    }

    /**
     * Perform background refresh of all active subscriptions
     */
    private async performBackgroundRefresh(): Promise<void> {
        if (this.isDisposed) {
            return;
        }

        const startTime = Date.now();
        let errorCount = 0;

        try {
            // Refresh run subscriptions - only active runs
            const activeRunPromises: Promise<void>[] = [];
            for (const subscription of this.subscriptions.values()) {
                if (subscription.isActive) {
                    activeRunPromises.push(
                        this.fetchRunUpdate(subscription).catch(error => {
                            errorCount++;
                            console.warn(`Background refresh failed for run ${subscription.runId}:`, error);
                        })
                    );
                }
            }

            // Refresh pipeline subscriptions
            const pipelinePromises: Promise<void>[] = [];
            for (const [key] of this.pipelineSubscriptions) {
                const [projectId, pipelineId] = key.split(':');
                pipelinePromises.push(
                    this.fetchPipelineUpdates(parseInt(pipelineId), projectId).catch(error => {
                        errorCount++;
                        console.warn(`Background refresh failed for pipeline ${pipelineId}:`, error);
                    })
                );
            }

            await Promise.allSettled([...activeRunPromises, ...pipelinePromises]);

            // Update statistics
            const responseTime = Date.now() - startTime;
            this.stats.averageResponseTime = this.stats.averageResponseTime === 0 
                ? responseTime 
                : (this.stats.averageResponseTime + responseTime) / 2;
            this.stats.errorCount += errorCount;
            this.stats.lastUpdateTime = new Date();

        } catch (error) {
            console.error('Background refresh failed:', error);
            this.stats.errorCount++;
        }
    }

    /**
     * Fetch update for a specific run subscription
     */
    private async fetchRunUpdate(subscription: RunSubscription): Promise<void> {
        try {
            const runDetails = await this.azureDevOpsService.getRunDetails(
                subscription.runId,
                subscription.pipelineId,
                subscription.projectId
            );

            // Check if run state has changed
            const previousState = this.getPreviousRunState(subscription);
            const hasStateChanged = this.hasRunStateChanged(runDetails, previousState);

            if (hasStateChanged) {
                // Emit status change event
                this._onRunStatusChanged.fire({
                    runId: subscription.runId,
                    pipelineId: subscription.pipelineId,
                    projectId: subscription.projectId,
                    previousState: previousState?.state,
                    currentState: runDetails.state,
                    previousResult: previousState?.result,
                    currentResult: runDetails.result,
                    timestamp: new Date()
                });

                this.stats.totalUpdatesReceived++;
            }

            // Always call callback to allow UI updates
            subscription.callback(runDetails);
            subscription.lastUpdated = new Date();

            // Deactivate subscription if run is completed
            if (runDetails.state === 'completed') {
                subscription.isActive = false;
            }

        } catch (error) {
            console.warn(`Failed to fetch run update for ${subscription.runId}:`, error);
            throw error;
        }
    }

    /**
     * Fetch updates for all runs in a pipeline
     */
    private async fetchPipelineUpdates(pipelineId: number, projectId: string): Promise<void> {
        try {
            const runs = await this.azureDevOpsService.getPipelineRuns(pipelineId, projectId);
            
            const subscriptionKey = `${projectId}:${pipelineId}`;
            const callbacks = this.pipelineSubscriptions.get(subscriptionKey);
            
            if (callbacks) {
                callbacks.forEach(callback => callback(runs));
            }

            this.stats.totalUpdatesReceived++;

        } catch (error) {
            console.warn(`Failed to fetch pipeline updates for ${pipelineId}:`, error);
            throw error;
        }
    }

    /**
     * Unsubscribe from a specific run
     */
    private unsubscribeFromRun(subscriptionKey: string): void {
        this.subscriptions.delete(subscriptionKey);
        this.stats.activeSubscriptions = this.subscriptions.size;

        // Stop background refresh if no active subscriptions
        if (this.subscriptions.size === 0 && this.pipelineSubscriptions.size === 0) {
            this.stopBackgroundRefresh();
        }
    }

    /**
     * Get previous run state for comparison
     */
    private getPreviousRunState(subscription: RunSubscription): { state: string; result?: string } | null {
        // In a real implementation, we would store previous states
        // For now, we'll return null to indicate no previous state
        return null;
    }

    /**
     * Check if run state has changed
     */
    private hasRunStateChanged(
        currentRun: PipelineRun, 
        previousState: { state: string; result?: string } | null
    ): boolean {
        if (!previousState) {
            return true; // First time seeing this run
        }

        return currentRun.state !== previousState.state || 
               currentRun.result !== previousState.result;
    }
}