/**
 * Error diagnostics collection and analysis for Azure Pipelines Assistant
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { AzurePipelinesError, ErrorDiagnosticInfo, ErrorContext } from './errorTypes';

/**
 * System information for diagnostics
 */
export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  vsCodeVersion: string;
  extensionVersion: string;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  timestamp: Date;
}

/**
 * Network diagnostics information
 */
export interface NetworkDiagnostics {
  userAgent: string;
  connectionType?: string;
  dnsResolutionTime?: number;
  connectTime?: number;
  tlsHandshakeTime?: number;
  responseTime?: number;
  lastSuccessfulRequest?: Date;
  consecutiveFailures: number;
}

/**
 * Extension diagnostics information
 */
export interface ExtensionDiagnostics {
  activationTime: Date;
  commandsRegistered: string[];
  activeWebviews: number;
  cacheSize: number;
  memoryUsage: NodeJS.MemoryUsage;
  eventListenerCount: number;
  lastConfigurationChange?: Date;
  configurationValid: boolean;
}

/**
 * Complete diagnostic report
 */
export interface DiagnosticReport {
  reportId: string;
  timestamp: Date;
  systemInfo: SystemInfo;
  networkDiagnostics: NetworkDiagnostics;
  extensionDiagnostics: ExtensionDiagnostics;
  recentErrors: ErrorDiagnosticInfo[];
  errorStatistics: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByCode: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  };
  performanceMetrics: {
    averageApiResponseTime: number;
    cacheHitRate: number;
    memoryUsageTrend: number[];
  };
}

/**
 * Error diagnostics collector
 */
export class ErrorDiagnostics {
  private readonly errorHistory: ErrorDiagnosticInfo[] = [];
  private readonly maxErrorHistory = 100;
  private readonly networkMetrics = new Map<string, number[]>();
  private readonly performanceMetrics: number[] = [];
  private activationTime: Date = new Date();
  private lastConfigurationChange?: Date;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.activationTime = new Date();
  }

  /**
   * Collect comprehensive diagnostics for an error
   */
  public async collectErrorDiagnostics(
    error: AzurePipelinesError,
    context?: ErrorContext
  ): Promise<void> {
    const diagnosticInfo = error.getDiagnosticInfo();
    
    // Add additional context
    const enhancedDiagnostic: ErrorDiagnosticInfo = {
      ...diagnosticInfo,
      context: {
        ...diagnosticInfo.context,
        ...context,
        systemInfo: await this.collectSystemInfo(),
        networkDiagnostics: this.collectNetworkDiagnostics(),
        extensionDiagnostics: await this.collectExtensionDiagnostics()
      }
    };

    // Add to history
    this.errorHistory.unshift(enhancedDiagnostic);
    
    // Maintain history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.splice(this.maxErrorHistory);
    }

    // Update metrics
    this.updateErrorMetrics(enhancedDiagnostic);
  }

  /**
   * Get recent errors
   */
  public getRecentErrors(count: number = 10): ErrorDiagnosticInfo[] {
    return this.errorHistory.slice(0, count);
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByCode: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  } {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByType: {} as Record<string, number>,
      errorsByCode: {} as Record<string, number>,
      errorsBySeverity: {} as Record<string, number>
    };

    this.errorHistory.forEach(error => {
      // Count by type
      stats.errorsByType[error.errorType] = (stats.errorsByType[error.errorType] || 0) + 1;
      
      // Count by code
      stats.errorsByCode[error.errorCode] = (stats.errorsByCode[error.errorCode] || 0) + 1;
      
      // Count by severity
      stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Generate comprehensive diagnostic report
   */
  public async generateDiagnosticReport(): Promise<DiagnosticReport> {
    const reportId = `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      reportId,
      timestamp: new Date(),
      systemInfo: await this.collectSystemInfo(),
      networkDiagnostics: this.collectNetworkDiagnostics(),
      extensionDiagnostics: await this.collectExtensionDiagnostics(),
      recentErrors: this.getRecentErrors(20),
      errorStatistics: this.getErrorStatistics(),
      performanceMetrics: this.collectPerformanceMetrics()
    };
  }

  /**
   * Export diagnostics as JSON string
   */
  public async exportDiagnostics(): Promise<string> {
    const report = await this.generateDiagnosticReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    this.errorHistory.length = 0;
    this.networkMetrics.clear();
    this.performanceMetrics.length = 0;
  }

  /**
   * Record network metric
   */
  public recordNetworkMetric(operation: string, responseTime: number): void {
    if (!this.networkMetrics.has(operation)) {
      this.networkMetrics.set(operation, []);
    }
    
    const metrics = this.networkMetrics.get(operation)!;
    metrics.push(responseTime);
    
    // Keep only last 50 measurements
    if (metrics.length > 50) {
      metrics.splice(0, metrics.length - 50);
    }
  }

  /**
   * Record performance metric
   */
  public recordPerformanceMetric(value: number): void {
    this.performanceMetrics.push(value);
    
    // Keep only last 100 measurements
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.splice(0, this.performanceMetrics.length - 100);
    }
  }

  /**
   * Set configuration change timestamp
   */
  public recordConfigurationChange(): void {
    this.lastConfigurationChange = new Date();
  }

  /**
   * Collect system information
   */
  private async collectSystemInfo(): Promise<SystemInfo> {
    const extensionVersion = this.context.extension?.packageJSON?.version || 'unknown';
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      vsCodeVersion: vscode.version,
      extensionVersion,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Collect network diagnostics
   */
  private collectNetworkDiagnostics(): NetworkDiagnostics {
    const userAgent = `Azure-Pipelines-Assistant-VSCode/${this.context.extension?.packageJSON?.version || 'unknown'}`;
    
    // Calculate consecutive failures (simplified)
    let consecutiveFailures = 0;
    for (const error of this.errorHistory) {
      if (error.errorCode.startsWith('NETWORK_')) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return {
      userAgent,
      consecutiveFailures,
      lastSuccessfulRequest: this.getLastSuccessfulRequestTime()
    };
  }

  /**
   * Collect extension diagnostics
   */
  private async collectExtensionDiagnostics(): Promise<ExtensionDiagnostics> {
    const memoryUsage = process.memoryUsage();
    
    // Get registered commands (simplified)
    const commandsRegistered = [
      'azurePipelinesAssistant.configure',
      'azurePipelinesAssistant.refresh',
      'azurePipelinesAssistant.viewInBrowser',
      'azurePipelinesAssistant.triggerPipeline',
      'azurePipelinesAssistant.viewRunDetails',
      'azurePipelinesAssistant.viewLogs'
    ];

    // Check configuration validity
    const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
    const organization = config.get<string>('organization');
    const pat = config.get<string>('personalAccessToken');
    const configurationValid = !!(organization && pat);

    return {
      activationTime: this.activationTime,
      commandsRegistered,
      activeWebviews: 0, // Would need to track this in actual implementation
      cacheSize: 0, // Would need to get from cache service
      memoryUsage,
      eventListenerCount: 0, // Would need to track this
      lastConfigurationChange: this.lastConfigurationChange,
      configurationValid
    };
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(): {
    averageApiResponseTime: number;
    cacheHitRate: number;
    memoryUsageTrend: number[];
  } {
    // Calculate average API response time
    let totalResponseTime = 0;
    let responseCount = 0;
    
    this.networkMetrics.forEach(metrics => {
      totalResponseTime += metrics.reduce((sum, time) => sum + time, 0);
      responseCount += metrics.length;
    });
    
    const averageApiResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    // Cache hit rate would need to be calculated from cache service
    const cacheHitRate = 0.85; // Placeholder

    // Memory usage trend (last 10 measurements)
    const memoryUsageTrend = this.performanceMetrics.slice(-10);

    return {
      averageApiResponseTime,
      cacheHitRate,
      memoryUsageTrend
    };
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(error: ErrorDiagnosticInfo): void {
    // Record error timing for analysis
    this.recordPerformanceMetric(Date.now());
    
    // Could add more sophisticated error pattern analysis here
  }

  /**
   * Get last successful request time
   */
  private getLastSuccessfulRequestTime(): Date | undefined {
    // Look through error history for the last non-error timestamp
    // This is a simplified implementation
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // If we have recent errors, assume last success was before them
    if (this.errorHistory.length > 0) {
      const oldestError = this.errorHistory[this.errorHistory.length - 1];
      return new Date(oldestError.timestamp.getTime() - 60000); // 1 minute before oldest error
    }
    
    // If no errors, assume recent success
    return oneHourAgo;
  }

  /**
   * Analyze error patterns
   */
  public analyzeErrorPatterns(): {
    isErrorSpike: boolean;
    dominantErrorType?: string;
    suggestedActions: string[];
  } {
    const recentErrors = this.getRecentErrors(10);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Check for error spike (more than 5 errors in last 5 minutes)
    const recentErrorCount = recentErrors.filter(error => 
      error.timestamp > fiveMinutesAgo
    ).length;
    
    const isErrorSpike = recentErrorCount > 5;
    
    // Find dominant error type
    const errorTypeCounts: Record<string, number> = {};
    recentErrors.forEach(error => {
      errorTypeCounts[error.errorType] = (errorTypeCounts[error.errorType] || 0) + 1;
    });
    
    const dominantErrorType = Object.entries(errorTypeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    
    // Generate suggested actions
    const suggestedActions: string[] = [];
    
    if (isErrorSpike) {
      suggestedActions.push('Consider restarting VS Code due to error spike');
      suggestedActions.push('Check Azure DevOps service status');
    }
    
    if (dominantErrorType === 'NetworkError') {
      suggestedActions.push('Check your internet connection');
      suggestedActions.push('Verify Azure DevOps accessibility');
    } else if (dominantErrorType === 'AuthenticationError') {
      suggestedActions.push('Verify your Personal Access Token');
      suggestedActions.push('Check token permissions');
    }
    
    if (suggestedActions.length === 0) {
      suggestedActions.push('Monitor for recurring patterns');
    }
    
    return {
      isErrorSpike,
      dominantErrorType,
      suggestedActions
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.clearErrorHistory();
  }
}