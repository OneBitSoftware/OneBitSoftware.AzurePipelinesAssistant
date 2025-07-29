import * as vscode from 'vscode';
import { PipelineRun } from '../models/pipelineRun';

/**
 * Subscription for pipeline run updates
 */
export interface RunSubscription {
    runId: number;
    pipelineId: number;
    projectId: string;
    callback: (run: PipelineRun) => void;
    lastUpdated: Date;
    isActive: boolean;
}

/**
 * Configuration for real-time updates
 */
export interface RealTimeUpdateConfig {
    pollingInterval: number; // in milliseconds
    maxActiveSubscriptions: number;
    enableIncrementalFetch: boolean;
    backgroundRefreshEnabled: boolean;
}

/**
 * Interface for real-time update service
 */
export interface IRealTimeUpdateService {
    /**
     * Subscribe to updates for a specific pipeline run
     * @param runId Run ID to monitor
     * @param pipelineId Pipeline ID
     * @param projectId Project ID
     * @param callback Callback function to invoke when run updates
     * @returns Disposable to unsubscribe
     */
    subscribeToRunUpdates(
        runId: number,
        pipelineId: number,
        projectId: string,
        callback: (run: PipelineRun) => void
    ): vscode.Disposable;

    /**
     * Subscribe to updates for all active runs in a pipeline
     * @param pipelineId Pipeline ID
     * @param projectId Project ID
     * @param callback Callback function to invoke when any run updates
     * @returns Disposable to unsubscribe
     */
    subscribeToPipelineUpdates(
        pipelineId: number,
        projectId: string,
        callback: (runs: PipelineRun[]) => void
    ): vscode.Disposable;

    /**
     * Start background polling for active pipeline runs
     */
    startBackgroundRefresh(): void;

    /**
     * Stop background polling
     */
    stopBackgroundRefresh(): void;

    /**
     * Check if background refresh is currently running
     */
    isBackgroundRefreshActive(): boolean;

    /**
     * Get current subscription count
     */
    getActiveSubscriptionCount(): number;

    /**
     * Get configuration
     */
    getConfiguration(): RealTimeUpdateConfig;

    /**
     * Update configuration
     */
    updateConfiguration(config: Partial<RealTimeUpdateConfig>): void;

    /**
     * Force refresh of all active subscriptions
     */
    refreshAllSubscriptions(): Promise<void>;

    /**
     * Clear all subscriptions and stop background refresh
     */
    dispose(): void;

    /**
     * Event emitted when run status changes
     */
    readonly onRunStatusChanged: vscode.Event<RunStatusChangeEvent>;
}

/**
 * Event emitted when run status changes
 */
export interface RunStatusChangeEvent {
    runId: number;
    pipelineId: number;
    projectId: string;
    previousState?: string;
    currentState: string;
    previousResult?: string;
    currentResult?: string;
    timestamp: Date;
}

/**
 * Statistics about real-time updates
 */
export interface RealTimeUpdateStats {
    activeSubscriptions: number;
    totalUpdatesReceived: number;
    lastUpdateTime?: Date;
    backgroundRefreshActive: boolean;
    pollingInterval: number;
    averageResponseTime: number;
    errorCount: number;
}