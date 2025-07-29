/**
 * Error recovery mechanisms and retry logic for Azure Pipelines Assistant
 */

import * as vscode from 'vscode';
import { 
  AzurePipelinesError, 
  NetworkError, 
  AuthenticationError,
  ResourceError,
  isNetworkError,
  isAuthenticationError,
  isResourceError
} from './errorTypes';

/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryCondition?: (error: Error, attempt: number) => boolean;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

/**
 * Recovery operation result
 */
export interface RecoveryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attemptsUsed: number;
  totalDuration: number;
  recoveryActions?: string[];
}

/**
 * Graceful degradation options
 */
export interface DegradationOptions {
  useCachedData: boolean;
  showOfflineMode: boolean;
  disableRealTimeUpdates: boolean;
  limitedFunctionality: boolean;
}

/**
 * Error recovery service
 */
export class ErrorRecovery {
  private static instance: ErrorRecovery | null = null;
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly retryAttempts = new Map<string, number>();

  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterEnabled: true,
    retryCondition: (error: Error, attempt: number) => {
      if (isNetworkError(error)) {
        return error.retryable && attempt < 5;
      }
      if (isResourceError(error)) {
        return error.resourceErrorCode === 'RESOURCE_BUSY' && attempt < 3;
      }
      return false;
    }
  };

  private readonly defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000 // 5 minutes
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ErrorRecovery {
    if (!ErrorRecovery.instance) {
      ErrorRecovery.instance = new ErrorRecovery();
    }
    return ErrorRecovery.instance;
  }

  /**
   * Execute operation with retry logic
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config?: Partial<RetryConfig>
  ): Promise<RecoveryResult<T>> {
    const finalConfig = { ...this.defaultRetryConfig, ...config };
    const startTime = Date.now();
    let lastError: Error = new Error('Unknown error');
    let attemptsUsed = 0;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(operationName)) {
      return {
        success: false,
        error: new Error(`Circuit breaker is open for operation: ${operationName}`),
        attemptsUsed: 0,
        totalDuration: Date.now() - startTime,
        recoveryActions: ['Wait for circuit breaker to reset', 'Check service status']
      };
    }

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      attemptsUsed = attempt + 1;

      try {
        const result = await operation();
        
        // Success - reset circuit breaker
        this.recordSuccess(operationName);
        
        return {
          success: true,
          result,
          attemptsUsed,
          totalDuration: Date.now() - startTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Record failure for circuit breaker
        this.recordFailure(operationName);

        // Check if we should retry
        const shouldRetry = attempt < finalConfig.maxRetries && 
                           (finalConfig.retryCondition?.(lastError, attempt) ?? this.defaultShouldRetry(lastError, attempt));

        if (!shouldRetry) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, finalConfig);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attemptsUsed,
      totalDuration: Date.now() - startTime,
      recoveryActions: this.getRecoveryActions(lastError)
    };
  }

  /**
   * Execute operation with graceful degradation
   */
  public async withGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName: string,
    degradationOptions?: Partial<DegradationOptions>
  ): Promise<RecoveryResult<T>> {
    const options: DegradationOptions = {
      useCachedData: true,
      showOfflineMode: false,
      disableRealTimeUpdates: false,
      limitedFunctionality: false,
      ...degradationOptions
    };

    const startTime = Date.now();

    try {
      // Try primary operation first
      const result = await primaryOperation();
      return {
        success: true,
        result,
        attemptsUsed: 1,
        totalDuration: Date.now() - startTime
      };

    } catch (primaryError) {
      console.warn(`Primary operation failed for ${operationName}, attempting graceful degradation:`, primaryError);

      try {
        // Try fallback operation
        const fallbackResult = await fallbackOperation();
        
        // Notify user about degraded mode if configured
        if (options.showOfflineMode) {
          const errorToShow = primaryError instanceof Error ? primaryError : new Error(String(primaryError));
          await this.showDegradationNotification(operationName, errorToShow);
        }

        return {
          success: true,
          result: fallbackResult,
          attemptsUsed: 2,
          totalDuration: Date.now() - startTime,
          recoveryActions: ['Using cached data', 'Limited functionality available']
        };

      } catch (fallbackError) {
        return {
          success: false,
          error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
          attemptsUsed: 2,
          totalDuration: Date.now() - startTime,
          recoveryActions: this.getRecoveryActions(primaryError instanceof Error ? primaryError : new Error(String(primaryError)))
        };
      }
    }
  }

  /**
   * Attempt automatic recovery for specific error types
   */
  public async attemptAutoRecovery(error: AzurePipelinesError): Promise<boolean> {
    if (isAuthenticationError(error)) {
      return this.attemptAuthenticationRecovery(error);
    }

    if (isNetworkError(error)) {
      return this.attemptNetworkRecovery(error);
    }

    if (isResourceError(error)) {
      return this.attemptResourceRecovery(error);
    }

    return false;
  }

  /**
   * Get recovery suggestions for an error
   */
  public getRecoverySuggestions(error: Error): string[] {
    if (isNetworkError(error)) {
      return [
        'Check your internet connection',
        'Verify Azure DevOps service status',
        'Try again in a few moments',
        'Check if you are behind a firewall'
      ];
    }

    if (isAuthenticationError(error)) {
      return [
        'Check your Personal Access Token',
        'Verify your Azure DevOps organization name',
        'Ensure your token has the required permissions',
        'Try re-authenticating'
      ];
    }

    if (isResourceError(error)) {
      return [
        'Verify the resource exists',
        'Check your permissions',
        'Refresh the data',
        'Try again later'
      ];
    }

    return [
      'Try the operation again',
      'Check your configuration',
      'Restart VS Code if the issue persists'
    ];
  }

  /**
   * Reset circuit breaker for an operation
   */
  public resetCircuitBreaker(operationName: string): void {
    this.circuitBreakers.delete(operationName);
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(operationName: string): {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime?: Date;
    nextRetryTime?: Date;
  } {
    const state = this.circuitBreakers.get(operationName);
    
    if (!state) {
      return { isOpen: false, failureCount: 0 };
    }

    const isOpen = this.isCircuitBreakerOpen(operationName);
    const nextRetryTime = isOpen ? new Date(state.lastFailureTime + this.defaultCircuitBreakerConfig.recoveryTimeout) : undefined;

    return {
      isOpen,
      failureCount: state.failureCount,
      lastFailureTime: new Date(state.lastFailureTime),
      nextRetryTime
    };
  }

  /**
   * Clear all retry attempts and circuit breaker states
   */
  public clearRecoveryState(): void {
    this.circuitBreakers.clear();
    this.retryAttempts.clear();
  }

  /**
   * Default retry condition
   */
  private defaultShouldRetry(error: Error, attempt: number): boolean {
    // Don't retry authentication errors (except network-related ones)
    if (isAuthenticationError(error) && error.authErrorCode !== 'NETWORK_ERROR') {
      return false;
    }

    // Retry network errors
    if (isNetworkError(error)) {
      return error.retryable;
    }

    // Retry resource busy errors
    if (isResourceError(error)) {
      return error.resourceErrorCode === 'RESOURCE_BUSY';
    }

    // Don't retry other errors by default
    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    if (config.jitterEnabled) {
      // Add random jitter (±25%)
      const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(operationName: string): boolean {
    const state = this.circuitBreakers.get(operationName);
    
    if (!state) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastFailure = now - state.lastFailureTime;
    
    // If enough time has passed, allow one test request
    if (timeSinceLastFailure >= this.defaultCircuitBreakerConfig.recoveryTimeout) {
      return false;
    }

    // Circuit is open if failure threshold is exceeded
    return state.failureCount >= this.defaultCircuitBreakerConfig.failureThreshold;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationName: string): void {
    // Reset circuit breaker on success
    this.circuitBreakers.delete(operationName);
  }

  /**
   * Record failed operation
   */
  private recordFailure(operationName: string): void {
    const state = this.circuitBreakers.get(operationName) || {
      failureCount: 0,
      lastFailureTime: 0
    };

    state.failureCount++;
    state.lastFailureTime = Date.now();
    
    this.circuitBreakers.set(operationName, state);
  }

  /**
   * Attempt authentication recovery
   */
  private async attemptAuthenticationRecovery(error: AuthenticationError): Promise<boolean> {
    switch (error.authErrorCode) {
      case 'EXPIRED_PAT':
        // Could potentially prompt user to update token
        await vscode.window.showWarningMessage(
          'Your Personal Access Token has expired. Please update your configuration.',
          'Update Token'
        ).then(selection => {
          if (selection === 'Update Token') {
            vscode.commands.executeCommand('azurePipelinesAssistant.configure');
          }
        });
        return false; // User action required

      case 'NETWORK_ERROR':
        // Wait a bit and return true to indicate retry is possible
        await this.sleep(2000);
        return true;

      default:
        return false; // Cannot auto-recover from other auth errors
    }
  }

  /**
   * Attempt network recovery
   */
  private async attemptNetworkRecovery(error: NetworkError): Promise<boolean> {
    switch (error.networkErrorCode) {
      case 'TIMEOUT':
      case 'CONNECTION_REFUSED':
        // Wait and retry
        await this.sleep(5000);
        return true;

      case 'RATE_LIMITED':
        // Wait for rate limit to reset
        const retryAfter = error.context?.retryAfter || 60000; // Default 1 minute
        await this.sleep(Math.min(retryAfter, 300000)); // Max 5 minutes
        return true;

      case 'SERVER_ERROR':
      case 'BAD_GATEWAY':
      case 'SERVICE_UNAVAILABLE':
        // Wait and retry for server errors
        await this.sleep(10000);
        return true;

      default:
        return false;
    }
  }

  /**
   * Attempt resource recovery
   */
  private async attemptResourceRecovery(error: ResourceError): Promise<boolean> {
    switch (error.resourceErrorCode) {
      case 'RESOURCE_BUSY':
        // Wait for resource to become available
        await this.sleep(5000);
        return true;

      case 'NOT_FOUND':
        // Could potentially refresh data to see if resource exists now
        return false; // Usually requires user action

      default:
        return false;
    }
  }

  /**
   * Show degradation notification to user
   */
  private async showDegradationNotification(operationName: string, error: Error): Promise<void> {
    await vscode.window.showWarningMessage(
      `${operationName} is running in limited mode due to connectivity issues. Some features may not be available.`,
      'Got it'
    );
  }

  /**
   * Get recovery actions for an error
   */
  private getRecoveryActions(error: Error): string[] {
    if (error instanceof AzurePipelinesError) {
      return error.recoveryActions;
    }

    return this.getRecoverySuggestions(error);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.clearRecoveryState();
    ErrorRecovery.instance = null;
  }
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
}

/**
 * Utility function to wrap any async operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config?: Partial<RetryConfig>
): Promise<T> {
  const recovery = ErrorRecovery.getInstance();
  const result = await recovery.withRetry(operation, operationName, config);
  
  if (result.success && result.result !== undefined) {
    return result.result;
  }
  
  throw result.error || new Error(`Operation ${operationName} failed after ${result.attemptsUsed} attempts`);
}

/**
 * Utility function to wrap any async operation with graceful degradation
 */
export async function withGracefulDegradation<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  operationName: string,
  options?: Partial<DegradationOptions>
): Promise<T> {
  const recovery = ErrorRecovery.getInstance();
  const result = await recovery.withGracefulDegradation(primaryOperation, fallbackOperation, operationName, options);
  
  if (result.success && result.result !== undefined) {
    return result.result;
  }
  
  throw result.error || new Error(`Both primary and fallback operations failed for ${operationName}`);
}