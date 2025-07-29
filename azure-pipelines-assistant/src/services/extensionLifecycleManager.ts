import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ErrorHandler } from '../errors/errorHandler';
import { ExtensionError } from '../errors/errorTypes';

/**
 * Extension lifecycle states
 */
export enum ExtensionState {
  INACTIVE = 'inactive',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  ERROR = 'error'
}

/**
 * Resource tracking interface
 */
export interface IResource {
  id: string;
  type: 'service' | 'disposable' | 'timer' | 'listener' | 'webview' | 'other';
  dispose(): void | Promise<void>;
  getMemoryUsage?(): number;
}

/**
 * Health check result
 */
export interface IHealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * Extension lifecycle manager handles activation, deactivation, and resource management
 */
export class ExtensionLifecycleManager extends EventEmitter {
  private static instance: ExtensionLifecycleManager;
  private state: ExtensionState = ExtensionState.INACTIVE;
  private resources: Map<string, IResource> = new Map();
  private healthChecks: Map<string, () => Promise<IHealthCheckResult>> = new Map();
  private memoryMonitorTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private activationStartTime?: Date;
  private activationEndTime?: Date;
  private errorHandler?: ErrorHandler;
  private outputChannel?: vscode.OutputChannel;
  private context?: vscode.ExtensionContext;

  private constructor() {
    super();
    this.setupMemoryMonitoring();
    this.setupHealthChecking();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ExtensionLifecycleManager {
    if (!ExtensionLifecycleManager.instance) {
      ExtensionLifecycleManager.instance = new ExtensionLifecycleManager();
    }
    return ExtensionLifecycleManager.instance;
  }

  /**
   * Initialize the lifecycle manager
   */
  public async initialize(
    context: vscode.ExtensionContext,
    errorHandler: ErrorHandler,
    outputChannel: vscode.OutputChannel
  ): Promise<void> {
    this.context = context;
    this.errorHandler = errorHandler;
    this.outputChannel = outputChannel;

    // Register lifecycle manager as a resource
    this.registerResource({
      id: 'lifecycle-manager',
      type: 'service',
      dispose: () => this.dispose()
    });

    // Add to context subscriptions
    context.subscriptions.push({
      dispose: () => this.dispose()
    });

    this.log('Lifecycle manager initialized');
  }

  /**
   * Begin extension activation
   */
  public async beginActivation(): Promise<void> {
    if (this.state !== ExtensionState.INACTIVE) {
      throw new ExtensionError(
        `Cannot activate extension in state: ${this.state}`,
        'ACTIVATION_FAILED',
        'Extension is not in inactive state'
      );
    }

    this.setState(ExtensionState.ACTIVATING);
    this.activationStartTime = new Date();
    this.log('Extension activation started');
    this.emit('activationStarted');
  }

  /**
   * Complete extension activation
   */
  public async completeActivation(): Promise<void> {
    if (this.state !== ExtensionState.ACTIVATING) {
      throw new ExtensionError(
        `Cannot complete activation in state: ${this.state}`,
        'ACTIVATION_FAILED',
        'Extension is not in activating state'
      );
    }

    this.activationEndTime = new Date();
    this.setState(ExtensionState.ACTIVE);
    
    const activationTime = this.activationEndTime.getTime() - (this.activationStartTime?.getTime() || 0);
    this.log(`Extension activation completed in ${activationTime}ms`);
    
    this.emit('activationCompleted', { activationTime });

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Handle activation error
   */
  public async handleActivationError(error: Error): Promise<void> {
    this.setState(ExtensionState.ERROR);
    this.log(`Extension activation failed: ${error.message}`, 'error');
    this.emit('activationFailed', error);

    if (this.errorHandler) {
      await this.errorHandler.handleCriticalError(
        new ExtensionError(
          `Extension activation failed: ${error.message}`,
          'ACTIVATION_FAILED',
          'The extension failed to start properly'
        )
      );
    }
  }

  /**
   * Begin extension deactivation
   */
  public async beginDeactivation(): Promise<void> {
    if (this.state === ExtensionState.DEACTIVATING || this.state === ExtensionState.INACTIVE) {
      return;
    }

    this.setState(ExtensionState.DEACTIVATING);
    this.log('Extension deactivation started');
    this.emit('deactivationStarted');

    // Stop monitoring
    this.stopMonitoring();

    // Persist data before cleanup
    await this.persistData();
  }

  /**
   * Complete extension deactivation
   */
  public async completeDeactivation(): Promise<void> {
    try {
      // Dispose all resources
      await this.disposeAllResources();
      
      this.setState(ExtensionState.INACTIVE);
      this.log('Extension deactivation completed');
      this.emit('deactivationCompleted');
    } catch (error) {
      this.log(`Error during deactivation: ${error}`, 'error');
      this.emit('deactivationError', error);
    }
  }

  /**
   * Register a resource for lifecycle management
   */
  public registerResource(resource: IResource): void {
    if (this.resources.has(resource.id)) {
      this.log(`Resource ${resource.id} already registered, replacing`, 'warn');
    }

    this.resources.set(resource.id, resource);
    this.log(`Registered resource: ${resource.id} (${resource.type})`);
    this.emit('resourceRegistered', resource);
  }

  /**
   * Unregister a resource
   */
  public unregisterResource(resourceId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      this.resources.delete(resourceId);
      this.log(`Unregistered resource: ${resourceId}`);
      this.emit('resourceUnregistered', resource);
    }
  }

  /**
   * Register a health check
   */
  public registerHealthCheck(
    name: string,
    check: () => Promise<IHealthCheckResult>
  ): void {
    this.healthChecks.set(name, check);
    this.log(`Registered health check: ${name}`);
  }

  /**
   * Run all health checks
   */
  public async runHealthChecks(): Promise<IHealthCheckResult[]> {
    const results: IHealthCheckResult[] = [];

    for (const [name, check] of this.healthChecks) {
      try {
        const result = await check();
        results.push(result);
      } catch (error) {
        results.push({
          component: name,
          status: 'error',
          message: `Health check failed: ${error}`,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  /**
   * Get extension state
   */
  public getState(): ExtensionState {
    return this.state;
  }

  /**
   * Get resource count by type
   */
  public getResourceCount(type?: string): number {
    if (!type) {
      return this.resources.size;
    }
    return Array.from(this.resources.values()).filter(r => r.type === type).length;
  }

  /**
   * Get memory usage information
   */
  public getMemoryUsage(): {
    total: number;
    byType: Record<string, number>;
    byResource: Record<string, number>;
  } {
    const usage = {
      total: 0,
      byType: {} as Record<string, number>,
      byResource: {} as Record<string, number>
    };

    for (const [id, resource] of this.resources) {
      const resourceUsage = resource.getMemoryUsage?.() || 0;
      usage.total += resourceUsage;
      usage.byResource[id] = resourceUsage;
      usage.byType[resource.type] = (usage.byType[resource.type] || 0) + resourceUsage;
    }

    return usage;
  }

  /**
   * Get activation metrics
   */
  public getActivationMetrics(): {
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    state: ExtensionState;
  } {
    return {
      startTime: this.activationStartTime,
      endTime: this.activationEndTime,
      duration: this.activationStartTime && this.activationEndTime
        ? this.activationEndTime.getTime() - this.activationStartTime.getTime()
        : undefined,
      state: this.state
    };
  }

  /**
   * Dispose all resources
   */
  private async disposeAllResources(): Promise<void> {
    const disposalPromises: Promise<void>[] = [];

    for (const [id, resource] of this.resources) {
      disposalPromises.push(
        Promise.resolve(resource.dispose()).catch(error => {
          this.log(`Error disposing resource ${id}: ${error}`, 'error');
        })
      );
    }

    await Promise.all(disposalPromises);
    this.resources.clear();
    this.log('All resources disposed');
  }

  /**
   * Set extension state and emit event
   */
  private setState(newState: ExtensionState): void {
    const oldState = this.state;
    this.state = newState;
    this.log(`State changed: ${oldState} -> ${newState}`);
    this.emit('stateChanged', { oldState, newState });
  }

  /**
   * Setup memory monitoring
   */
  private setupMemoryMonitoring(): void {
    // Register memory monitoring health check
    this.registerHealthCheck('memory', async () => {
      const usage = this.getMemoryUsage();
      const processMemory = process.memoryUsage();
      
      return {
        component: 'memory',
        status: processMemory.heapUsed > 100 * 1024 * 1024 ? 'warning' : 'healthy', // 100MB threshold
        message: `Heap used: ${Math.round(processMemory.heapUsed / 1024 / 1024)}MB, Extension resources: ${usage.total}`,
        details: {
          process: processMemory,
          extension: usage
        },
        timestamp: new Date()
      };
    });
  }

  /**
   * Setup health checking
   */
  private setupHealthChecking(): void {
    // Register basic health checks
    this.registerHealthCheck('lifecycle', async () => ({
      component: 'lifecycle',
      status: this.state === ExtensionState.ACTIVE ? 'healthy' : 'warning',
      message: `Extension state: ${this.state}`,
      details: {
        state: this.state,
        resourceCount: this.resources.size,
        activationMetrics: this.getActivationMetrics()
      },
      timestamp: new Date()
    }));
  }

  /**
   * Start monitoring timers
   */
  private startMonitoring(): void {
    // Memory monitoring every 30 seconds
    this.memoryMonitorTimer = setInterval(async () => {
      try {
        const memoryCheck = await this.healthChecks.get('memory')?.();
        if (memoryCheck?.status === 'warning') {
          this.log(`Memory warning: ${memoryCheck.message}`, 'warn');
          this.emit('memoryWarning', memoryCheck);
        }
      } catch (error) {
        this.log(`Memory monitoring error: ${error}`, 'error');
      }
    }, 30000);

    // Health check every 60 seconds
    this.healthCheckTimer = setInterval(async () => {
      try {
        const results = await this.runHealthChecks();
        const errors = results.filter(r => r.status === 'error');
        const warnings = results.filter(r => r.status === 'warning');

        if (errors.length > 0) {
          this.log(`Health check errors: ${errors.map(e => e.component).join(', ')}`, 'error');
          this.emit('healthCheckErrors', errors);
        }

        if (warnings.length > 0) {
          this.log(`Health check warnings: ${warnings.map(w => w.component).join(', ')}`, 'warn');
          this.emit('healthCheckWarnings', warnings);
        }
      } catch (error) {
        this.log(`Health check monitoring error: ${error}`, 'error');
      }
    }, 60000);

    this.log('Monitoring started');
  }

  /**
   * Stop monitoring timers
   */
  private stopMonitoring(): void {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = undefined;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.log('Monitoring stopped');
  }

  /**
   * Persist important data before deactivation
   */
  private async persistData(): Promise<void> {
    if (!this.context) {
      return;
    }

    try {
      // Persist activation metrics
      const metrics = this.getActivationMetrics();
      await this.context.globalState.update('lastActivationMetrics', metrics);

      // Persist resource statistics
      const resourceStats = {
        totalResources: this.resources.size,
        resourcesByType: Array.from(this.resources.values()).reduce((acc, resource) => {
          acc[resource.type] = (acc[resource.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        timestamp: new Date()
      };
      await this.context.globalState.update('lastResourceStats', resourceStats);

      this.log('Data persisted successfully');
    } catch (error) {
      this.log(`Error persisting data: ${error}`, 'error');
    }
  }

  /**
   * Log message with optional level
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [LifecycleManager] ${message}`;

    if (this.outputChannel) {
      this.outputChannel.appendLine(logMessage);
    }

    switch (level) {
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * Dispose the lifecycle manager
   */
  public dispose(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.resources.clear();
    this.healthChecks.clear();
    this.log('Lifecycle manager disposed');
  }
}