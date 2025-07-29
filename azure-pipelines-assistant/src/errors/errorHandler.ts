/**
 * Central error handler for the Azure Pipelines Assistant
 * 
 * Provides centralized error handling, logging, and user notification
 */

import * as vscode from 'vscode';
import { 
  AzurePipelinesError, 
  AuthenticationError, 
  NetworkError, 
  DataValidationError,
  ConfigurationError,
  ResourceError,
  ExtensionError,
  ErrorDiagnosticInfo,
  ErrorContext,
  isAzurePipelinesError
} from './errorTypes';
import { ErrorDiagnostics } from './diagnostics';
import { UserFriendlyMessages } from './userFriendlyMessages';

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlerConfig {
  showUserNotifications: boolean;
  logToConsole: boolean;
  logToFile: boolean;
  collectDiagnostics: boolean;
  enableTelemetry: boolean;
  maxErrorsPerSession: number;
  errorCooldownMs: number;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  handled: boolean;
  userNotified: boolean;
  logged: boolean;
  diagnosticsCollected: boolean;
  recoveryActionsShown: boolean;
  errorId: string;
}

/**
 * Central error handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private readonly diagnostics: ErrorDiagnostics;
  private readonly userMessages: UserFriendlyMessages;
  private readonly errorCounts = new Map<string, number>();
  private readonly lastErrorTimes = new Map<string, number>();
  private sessionErrorCount = 0;

  private readonly config: ErrorHandlerConfig = {
    showUserNotifications: true,
    logToConsole: true,
    logToFile: false,
    collectDiagnostics: true,
    enableTelemetry: false,
    maxErrorsPerSession: 50,
    errorCooldownMs: 5000 // 5 seconds
  };

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    this.diagnostics = new ErrorDiagnostics(context);
    this.userMessages = new UserFriendlyMessages();
  }

  /**
   * Get or create the singleton error handler instance
   */
  public static getInstance(
    context?: vscode.ExtensionContext,
    outputChannel?: vscode.OutputChannel
  ): ErrorHandler {
    if (!ErrorHandler.instance) {
      if (!context || !outputChannel) {
        throw new Error('ErrorHandler must be initialized with context and outputChannel');
      }
      ErrorHandler.instance = new ErrorHandler(context, outputChannel);
    }
    return ErrorHandler.instance;
  }

  /**
   * Configure error handling behavior
   */
  public configure(config: Partial<ErrorHandlerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Handle an error with full processing
   */
  public async handleError(
    error: Error | AzurePipelinesError,
    context?: ErrorContext,
    options?: {
      showNotification?: boolean;
      logError?: boolean;
      collectDiagnostics?: boolean;
      showRecoveryActions?: boolean;
    }
  ): Promise<ErrorHandlingResult> {
    const startTime = Date.now();
    
    // Convert to AzurePipelinesError if needed
    const azureError = this.ensureAzurePipelinesError(error, context);
    
    // Check if we should handle this error (rate limiting)
    if (!this.shouldHandleError(azureError)) {
      return {
        handled: false,
        userNotified: false,
        logged: false,
        diagnosticsCollected: false,
        recoveryActionsShown: false,
        errorId: azureError.errorId
      };
    }

    const result: ErrorHandlingResult = {
      handled: true,
      userNotified: false,
      logged: false,
      diagnosticsCollected: false,
      recoveryActionsShown: false,
      errorId: azureError.errorId
    };

    try {
      // Log the error
      if (options?.logError !== false && this.config.logToConsole) {
        this.logError(azureError, context);
        result.logged = true;
      }

      // Collect diagnostics
      if (options?.collectDiagnostics !== false && this.config.collectDiagnostics) {
        await this.diagnostics.collectErrorDiagnostics(azureError, context);
        result.diagnosticsCollected = true;
      }

      // Show user notification
      if (options?.showNotification !== false && this.config.showUserNotifications) {
        const notificationResult = await this.showUserNotification(azureError, options?.showRecoveryActions);
        result.userNotified = notificationResult.shown;
        result.recoveryActionsShown = notificationResult.recoveryActionsShown;
      }

      // Update error tracking
      this.updateErrorTracking(azureError);

    } catch (handlingError) {
      // Error in error handling - log but don't recurse
      console.error('Error in error handling:', handlingError);
      this.outputChannel.appendLine(`Error in error handling: ${handlingError}`);
    }

    const duration = Date.now() - startTime;
    this.outputChannel.appendLine(`Error handling completed in ${duration}ms for error ${azureError.errorId}`);

    return result;
  }

  /**
   * Handle an error silently (no user notification)
   */
  public async handleErrorSilently(
    error: Error | AzurePipelinesError,
    context?: ErrorContext
  ): Promise<ErrorHandlingResult> {
    return this.handleError(error, context, {
      showNotification: false,
      showRecoveryActions: false
    });
  }

  /**
   * Handle a critical error that requires immediate user attention
   */
  public async handleCriticalError(
    error: Error | AzurePipelinesError,
    context?: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const azureError = this.ensureAzurePipelinesError(error, context);
    
    // Force show notification for critical errors
    return this.handleError(azureError, context, {
      showNotification: true,
      showRecoveryActions: true,
      logError: true,
      collectDiagnostics: true
    });
  }

  /**
   * Get error statistics for the current session
   */
  public getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByCode: Record<string, number>;
    lastErrors: ErrorDiagnosticInfo[];
  } {
    const errorsByType: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};

    this.errorCounts.forEach((count, key) => {
      if (key.startsWith('type:')) {
        errorsByType[key.substring(5)] = count;
      } else if (key.startsWith('code:')) {
        errorsByCode[key.substring(5)] = count;
      }
    });

    return {
      totalErrors: this.sessionErrorCount,
      errorsByType,
      errorsByCode,
      lastErrors: this.diagnostics.getRecentErrors(10)
    };
  }

  /**
   * Clear error statistics and reset counters
   */
  public clearErrorStatistics(): void {
    this.errorCounts.clear();
    this.lastErrorTimes.clear();
    this.sessionErrorCount = 0;
    this.diagnostics.clearErrorHistory();
  }

  /**
   * Export error diagnostics for support
   */
  public async exportDiagnostics(): Promise<string> {
    return this.diagnostics.exportDiagnostics();
  }

  /**
   * Convert any error to AzurePipelinesError
   */
  private ensureAzurePipelinesError(error: Error | AzurePipelinesError, context?: ErrorContext): AzurePipelinesError {
    if (isAzurePipelinesError(error)) {
      return error;
    }

    // Try to categorize the error based on its properties
    if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      return new AuthenticationError(
        error.message,
        'NETWORK_ERROR',
        undefined,
        context
      );
    }

    if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      return new NetworkError(
        error.message,
        'CONNECTION_REFUSED',
        undefined,
        undefined,
        undefined,
        context
      );
    }

    if (error.message.includes('validation') || error.message.includes('invalid') || error.message.includes('parse')) {
      return new DataValidationError(
        error.message,
        'PARSING_ERROR',
        undefined,
        undefined,
        undefined,
        undefined,
        context
      );
    }

    if (error.message.includes('configuration') || error.message.includes('config')) {
      return new ConfigurationError(
        error.message,
        'INVALID_CONFIG',
        undefined,
        undefined,
        context
      );
    }

    if (error.message.includes('not found') || error.message.includes('404')) {
      return new ResourceError(
        error.message,
        'NOT_FOUND',
        undefined,
        undefined,
        undefined,
        context
      );
    }

    // Default to extension error for unknown errors
    return new ExtensionError(
      error.message,
      'COMMAND_ERROR',
      undefined,
      context
    );
  }

  /**
   * Check if we should handle this error (rate limiting)
   */
  private shouldHandleError(error: AzurePipelinesError): boolean {
    // Always handle critical errors
    if (error.severity === 'critical') {
      return true;
    }

    // Check session limit
    if (this.sessionErrorCount >= this.config.maxErrorsPerSession) {
      return false;
    }

    // Check cooldown for this specific error type
    const errorKey = `${error.errorCode}:${error.message}`;
    const lastTime = this.lastErrorTimes.get(errorKey);
    const now = Date.now();
    
    if (lastTime && (now - lastTime) < this.config.errorCooldownMs) {
      return false;
    }

    return true;
  }

  /**
   * Log error to console and output channel
   */
  private logError(error: AzurePipelinesError, context?: ErrorContext): void {
    const logMessage = this.formatErrorForLogging(error, context);
    
    if (this.config.logToConsole) {
      console.error(logMessage);
    }

    this.outputChannel.appendLine(logMessage);
    
    // Also log the stack trace if available
    if (error.stack) {
      this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
    }
  }

  /**
   * Format error for logging
   */
  private formatErrorForLogging(error: AzurePipelinesError, context?: ErrorContext): string {
    const contextStr = context ? JSON.stringify(context, null, 2) : 'No context';
    
    return `[${error.timestamp.toISOString()}] ${error.severity.toUpperCase()} - ${error.errorCode}
Error ID: ${error.errorId}
Message: ${error.message}
User Message: ${error.userMessage}
Retryable: ${error.retryable}
Context: ${contextStr}
Recovery Actions: ${error.recoveryActions.join(', ')}`;
  }

  /**
   * Show user notification for error
   */
  private async showUserNotification(
    error: AzurePipelinesError,
    showRecoveryActions: boolean = true
  ): Promise<{ shown: boolean; recoveryActionsShown: boolean }> {
    const userMessage = this.userMessages.getUserFriendlyMessage(error);
    
    let result = { shown: false, recoveryActionsShown: false };

    try {
      switch (error.severity) {
        case 'critical':
          await this.showCriticalErrorNotification(error, userMessage, showRecoveryActions);
          result = { shown: true, recoveryActionsShown: showRecoveryActions };
          break;
          
        case 'high':
          await this.showHighSeverityNotification(error, userMessage, showRecoveryActions);
          result = { shown: true, recoveryActionsShown: showRecoveryActions };
          break;
          
        case 'medium':
          await this.showMediumSeverityNotification(error, userMessage, showRecoveryActions);
          result = { shown: true, recoveryActionsShown: showRecoveryActions };
          break;
          
        case 'low':
          // Only show low severity errors in status bar or output channel
          this.outputChannel.appendLine(`Info: ${userMessage}`);
          result = { shown: true, recoveryActionsShown: false };
          break;
      }
    } catch (notificationError) {
      console.error('Failed to show user notification:', notificationError);
    }

    return result;
  }

  /**
   * Show critical error notification
   */
  private async showCriticalErrorNotification(
    error: AzurePipelinesError,
    userMessage: string,
    showRecoveryActions: boolean
  ): Promise<void> {
    const actions = ['View Details', 'Export Diagnostics'];
    if (showRecoveryActions && error.recoveryActions.length > 0) {
      actions.unshift('Show Recovery Actions');
    }

    const selection = await vscode.window.showErrorMessage(
      `Critical Error: ${userMessage}`,
      { modal: true },
      ...actions
    );

    await this.handleNotificationSelection(selection, error, showRecoveryActions);
  }

  /**
   * Show high severity notification
   */
  private async showHighSeverityNotification(
    error: AzurePipelinesError,
    userMessage: string,
    showRecoveryActions: boolean
  ): Promise<void> {
    const actions = ['View Details'];
    if (showRecoveryActions && error.recoveryActions.length > 0) {
      actions.unshift('Show Recovery Actions');
    }

    const selection = await vscode.window.showErrorMessage(
      userMessage,
      ...actions
    );

    await this.handleNotificationSelection(selection, error, showRecoveryActions);
  }

  /**
   * Show medium severity notification
   */
  private async showMediumSeverityNotification(
    error: AzurePipelinesError,
    userMessage: string,
    showRecoveryActions: boolean
  ): Promise<void> {
    const actions = [];
    if (showRecoveryActions && error.recoveryActions.length > 0) {
      actions.push('Show Recovery Actions');
    }
    actions.push('View Details');

    const selection = await vscode.window.showWarningMessage(
      userMessage,
      ...actions
    );

    await this.handleNotificationSelection(selection, error, showRecoveryActions);
  }

  /**
   * Handle user selection from notification
   */
  private async handleNotificationSelection(
    selection: string | undefined,
    error: AzurePipelinesError,
    showRecoveryActions: boolean
  ): Promise<void> {
    if (!selection) {
      return;
    }

    switch (selection) {
      case 'Show Recovery Actions':
        await this.showRecoveryActions(error);
        break;
        
      case 'View Details':
        await this.showErrorDetails(error);
        break;
        
      case 'Export Diagnostics':
        await this.exportAndShowDiagnostics();
        break;
    }
  }

  /**
   * Show recovery actions to user
   */
  private async showRecoveryActions(error: AzurePipelinesError): Promise<void> {
    if (error.recoveryActions.length === 0) {
      await vscode.window.showInformationMessage('No specific recovery actions available for this error.');
      return;
    }

    const actionItems = error.recoveryActions.map((action, index) => ({
      label: `${index + 1}. ${action}`,
      action
    }));

    const selection = await vscode.window.showQuickPick(
      actionItems,
      {
        placeHolder: 'Select a recovery action to learn more',
        title: 'Recovery Actions'
      }
    );

    if (selection) {
      await vscode.window.showInformationMessage(
        `Recovery Action: ${selection.action}`,
        'Got it'
      );
    }
  }

  /**
   * Show detailed error information
   */
  private async showErrorDetails(error: AzurePipelinesError): Promise<void> {
    const diagnosticInfo = error.getDiagnosticInfo();
    const details = `
Error Details:
- Error ID: ${diagnosticInfo.errorId}
- Error Code: ${diagnosticInfo.errorCode}
- Type: ${diagnosticInfo.errorType}
- Severity: ${diagnosticInfo.severity}
- Time: ${diagnosticInfo.timestamp.toLocaleString()}
- Retryable: ${diagnosticInfo.retryable}

Message: ${diagnosticInfo.message}

Context: ${JSON.stringify(diagnosticInfo.context, null, 2)}
    `.trim();

    // Show in a new document
    const doc = await vscode.workspace.openTextDocument({
      content: details,
      language: 'plaintext'
    });
    
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Export and show diagnostics
   */
  private async exportAndShowDiagnostics(): Promise<void> {
    try {
      const diagnostics = await this.exportDiagnostics();
      
      const doc = await vscode.workspace.openTextDocument({
        content: diagnostics,
        language: 'json'
      });
      
      await vscode.window.showTextDocument(doc);
      
      await vscode.window.showInformationMessage(
        'Diagnostics exported. You can save this file and share it with support.',
        'Got it'
      );
    } catch (error) {
      await vscode.window.showErrorMessage(
        'Failed to export diagnostics. Please check the output channel for more information.'
      );
    }
  }

  /**
   * Update error tracking statistics
   */
  private updateErrorTracking(error: AzurePipelinesError): void {
    this.sessionErrorCount++;
    
    // Track by error type
    const typeKey = `type:${error.constructor.name}`;
    this.errorCounts.set(typeKey, (this.errorCounts.get(typeKey) || 0) + 1);
    
    // Track by error code
    const codeKey = `code:${error.errorCode}`;
    this.errorCounts.set(codeKey, (this.errorCounts.get(codeKey) || 0) + 1);
    
    // Update last error time
    const errorKey = `${error.errorCode}:${error.message}`;
    this.lastErrorTimes.set(errorKey, Date.now());
  }

  /**
   * Get error statistics
   */
  public getStatistics(): {
    totalErrors: number;
    criticalErrors: number;
    recoverableErrors: number;
    sessionErrorCount: number;
    errorsByType: Record<string, number>;
    errorsByCode: Record<string, number>;
  } {
    const errorsByType: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};

    for (const [key, count] of this.errorCounts.entries()) {
      if (key.startsWith('type:')) {
        errorsByType[key.substring(5)] = count;
      } else if (key.startsWith('code:')) {
        errorsByCode[key.substring(5)] = count;
      }
    }

    return {
      totalErrors: this.sessionErrorCount,
      criticalErrors: this.errorCounts.get('critical') || 0,
      recoverableErrors: this.errorCounts.get('recoverable') || 0,
      sessionErrorCount: this.sessionErrorCount,
      errorsByType,
      errorsByCode
    };
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.diagnostics.dispose();
    this.clearErrorStatistics();
    ErrorHandler.instance = null;
  }
}