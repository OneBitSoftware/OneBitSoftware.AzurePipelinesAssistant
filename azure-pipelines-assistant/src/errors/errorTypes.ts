/**
 * Specific error classes for different types of errors in the Azure Pipelines Assistant
 */

import * as vscode from 'vscode';

/**
 * Base error class for all Azure Pipelines Assistant errors
 */
export abstract class AzurePipelinesError extends Error {
  public readonly timestamp: Date;
  public readonly errorId: string;
  public readonly context: Record<string, any>;
  public readonly userMessage: string;
  public readonly recoveryActions: string[];
  public readonly retryable: boolean;

  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical',
    userMessage?: string,
    recoveryActions: string[] = [],
    retryable: boolean = false,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.errorId = this.generateErrorId();
    this.userMessage = userMessage || message;
    this.recoveryActions = recoveryActions;
    this.retryable = retryable;
    this.context = context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private generateErrorId(): string {
    return `${this.errorCode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get diagnostic information for this error
   */
  getDiagnosticInfo(): ErrorDiagnosticInfo {
    return {
      errorId: this.errorId,
      errorCode: this.errorCode,
      errorType: this.name,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      timestamp: this.timestamp,
      stack: this.stack,
      context: this.context,
      recoveryActions: this.recoveryActions,
      retryable: this.retryable
    };
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends AzurePipelinesError {
  constructor(
    message: string,
    public readonly authErrorCode: 'INVALID_PAT' | 'EXPIRED_PAT' | 'INSUFFICIENT_PERMISSIONS' | 'INVALID_ORGANIZATION' | 'TOKEN_REVOKED' | 'NETWORK_ERROR',
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    const recoveryActions = AuthenticationError.getRecoveryActions(authErrorCode);
    const retryable = authErrorCode === 'NETWORK_ERROR';
    
    super(
      message,
      `AUTH_${authErrorCode}`,
      authErrorCode === 'NETWORK_ERROR' ? 'medium' : 'high',
      userMessage,
      recoveryActions,
      retryable,
      context
    );
  }

  private static getRecoveryActions(errorCode: string): string[] {
    switch (errorCode) {
      case 'INVALID_PAT':
        return [
          'Verify your Personal Access Token is correct',
          'Generate a new PAT from Azure DevOps',
          'Check that the PAT has not been revoked',
          'Update your extension configuration'
        ];
      case 'EXPIRED_PAT':
        return [
          'Generate a new Personal Access Token',
          'Update your extension configuration with the new token',
          'Consider setting up token expiration reminders'
        ];
      case 'INSUFFICIENT_PERMISSIONS':
        return [
          'Check that your PAT has the required permissions',
          'Ensure Build (read), Code (read), Project and team (read), and Release (read) permissions are granted',
          'Contact your Azure DevOps administrator if needed',
          'Generate a new PAT with correct permissions'
        ];
      case 'INVALID_ORGANIZATION':
        return [
          'Verify the organization name is correct',
          'Check that the organization exists and is accessible',
          'Ensure you have access to the organization'
        ];
      case 'TOKEN_REVOKED':
        return [
          'Generate a new Personal Access Token',
          'Update your extension configuration',
          'Check with your administrator about token policies'
        ];
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Verify Azure DevOps is accessible',
          'Try again in a few moments',
          'Check if you are behind a corporate firewall'
        ];
      default:
        return ['Check your authentication configuration'];
    }
  }
}

/**
 * Network and API communication errors
 */
export class NetworkError extends AzurePipelinesError {
  constructor(
    message: string,
    public readonly networkErrorCode: 'TIMEOUT' | 'CONNECTION_REFUSED' | 'DNS_ERROR' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'BAD_GATEWAY' | 'SERVICE_UNAVAILABLE',
    public readonly statusCode?: number,
    public readonly responseBody?: any,
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    const recoveryActions = NetworkError.getRecoveryActions(networkErrorCode, statusCode);
    const retryable = NetworkError.isRetryable(networkErrorCode, statusCode);
    const severity = NetworkError.getSeverity(networkErrorCode, statusCode);
    
    super(
      message,
      `NETWORK_${networkErrorCode}`,
      severity,
      userMessage,
      recoveryActions,
      retryable,
      { ...context, statusCode, responseBody }
    );
  }

  private static getRecoveryActions(errorCode: string, statusCode?: number): string[] {
    switch (errorCode) {
      case 'TIMEOUT':
        return [
          'Check your internet connection',
          'Try again with a longer timeout',
          'Verify Azure DevOps service status'
        ];
      case 'CONNECTION_REFUSED':
        return [
          'Check your internet connection',
          'Verify the Azure DevOps URL is correct',
          'Check if you are behind a firewall'
        ];
      case 'DNS_ERROR':
        return [
          'Check your DNS settings',
          'Try using a different DNS server',
          'Verify the organization name is correct'
        ];
      case 'RATE_LIMITED':
        return [
          'Wait before making more requests',
          'Reduce the frequency of API calls',
          'Check if other applications are using the same token'
        ];
      case 'SERVER_ERROR':
        return [
          'Try again in a few moments',
          'Check Azure DevOps service status',
          'Contact support if the issue persists'
        ];
      case 'BAD_GATEWAY':
        return [
          'Try again in a few moments',
          'Check Azure DevOps service status',
          'Verify your network connection'
        ];
      case 'SERVICE_UNAVAILABLE':
        return [
          'Azure DevOps service may be temporarily unavailable',
          'Check the Azure DevOps status page',
          'Try again later'
        ];
      default:
        return statusCode && statusCode >= 500 
          ? ['Server error - try again later', 'Check Azure DevOps service status']
          : ['Check your network connection', 'Verify your configuration'];
    }
  }

  private static isRetryable(errorCode: string, statusCode?: number): boolean {
    const retryableErrorCodes = ['TIMEOUT', 'CONNECTION_REFUSED', 'RATE_LIMITED', 'SERVER_ERROR', 'BAD_GATEWAY', 'SERVICE_UNAVAILABLE'];
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    
    return retryableErrorCodes.includes(errorCode) || 
           (statusCode !== undefined && retryableStatusCodes.includes(statusCode));
  }

  private static getSeverity(errorCode: string, statusCode?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (errorCode === 'RATE_LIMITED') {
      return 'medium';
    }
    if (errorCode === 'SERVICE_UNAVAILABLE') {
      return 'high';
    }
    if (statusCode && statusCode >= 500) {
      return 'high';
    }
    return 'medium';
  }
}

/**
 * Data validation and parsing errors
 */
export class DataValidationError extends AzurePipelinesError {
  constructor(
    message: string,
    public readonly validationErrorCode: 'INVALID_FORMAT' | 'MISSING_FIELD' | 'INVALID_VALUE' | 'SCHEMA_MISMATCH' | 'PARSING_ERROR',
    public readonly field?: string,
    public readonly receivedValue?: any,
    public readonly expectedFormat?: string,
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    const recoveryActions = DataValidationError.getRecoveryActions(validationErrorCode, field);
    
    super(
      message,
      `DATA_${validationErrorCode}`,
      'medium',
      userMessage,
      recoveryActions,
      false, // Data validation errors are typically not retryable
      { ...context, field, receivedValue, expectedFormat }
    );
  }

  private static getRecoveryActions(errorCode: string, field?: string): string[] {
    switch (errorCode) {
      case 'INVALID_FORMAT':
        return [
          `Check the format of ${field || 'the data'}`,
          'Verify the data matches expected format',
          'Contact support if the issue persists'
        ];
      case 'MISSING_FIELD':
        return [
          `Ensure ${field || 'required field'} is provided`,
          'Check the API documentation for required fields',
          'Verify your request is complete'
        ];
      case 'INVALID_VALUE':
        return [
          `Check the value for ${field || 'the field'}`,
          'Ensure the value is within acceptable range',
          'Verify the data type is correct'
        ];
      case 'SCHEMA_MISMATCH':
        return [
          'The API response format may have changed',
          'Check for extension updates',
          'Contact support if the issue persists'
        ];
      case 'PARSING_ERROR':
        return [
          'The response could not be parsed',
          'Check if the API is returning valid data',
          'Try refreshing the data'
        ];
      default:
        return ['Verify your data is correct', 'Check the expected format'];
    }
  }
}

/**
 * Configuration and setup errors
 */
export class ConfigurationError extends AzurePipelinesError {
  constructor(
    message: string,
    public readonly configErrorCode: 'MISSING_CONFIG' | 'INVALID_CONFIG' | 'CONFIG_ACCESS_ERROR' | 'WORKSPACE_ERROR',
    public readonly configField?: string,
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    const recoveryActions = ConfigurationError.getRecoveryActions(configErrorCode, configField);
    
    super(
      message,
      `CONFIG_${configErrorCode}`,
      'high',
      userMessage,
      recoveryActions,
      false,
      { ...context, configField }
    );
  }

  private static getRecoveryActions(errorCode: string, field?: string): string[] {
    switch (errorCode) {
      case 'MISSING_CONFIG':
        return [
          'Configure the Azure Pipelines Assistant extension',
          'Provide your Azure DevOps organization and Personal Access Token',
          'Use the command palette: "Azure Pipelines: Configure"'
        ];
      case 'INVALID_CONFIG':
        return [
          `Check your ${field || 'configuration'} setting`,
          'Verify all required fields are filled',
          'Reset configuration if needed'
        ];
      case 'CONFIG_ACCESS_ERROR':
        return [
          'Check VS Code settings permissions',
          'Try restarting VS Code',
          'Reset the extension configuration'
        ];
      case 'WORKSPACE_ERROR':
        return [
          'Ensure you have a workspace open',
          'Check workspace permissions',
          'Try opening a different workspace'
        ];
      default:
        return ['Check your extension configuration'];
    }
  }
}

/**
 * Resource and operation errors
 */
export class ResourceError extends AzurePipelinesError {
  constructor(
    message: string,
    public readonly resourceErrorCode: 'NOT_FOUND' | 'ACCESS_DENIED' | 'RESOURCE_BUSY' | 'QUOTA_EXCEEDED' | 'OPERATION_FAILED',
    public readonly resourceType?: string,
    public readonly resourceId?: string,
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    const recoveryActions = ResourceError.getRecoveryActions(resourceErrorCode, resourceType);
    const retryable = resourceErrorCode === 'RESOURCE_BUSY';
    
    super(
      message,
      `RESOURCE_${resourceErrorCode}`,
      resourceErrorCode === 'ACCESS_DENIED' ? 'high' : 'medium',
      userMessage,
      recoveryActions,
      retryable,
      { ...context, resourceType, resourceId }
    );
  }

  private static getRecoveryActions(errorCode: string, resourceType?: string): string[] {
    switch (errorCode) {
      case 'NOT_FOUND':
        return [
          `Verify the ${resourceType || 'resource'} exists`,
          'Check the ID or name is correct',
          'Ensure you have access to the resource',
          'Refresh the data to get the latest information'
        ];
      case 'ACCESS_DENIED':
        return [
          `Check your permissions for ${resourceType || 'this resource'}`,
          'Contact your Azure DevOps administrator',
          'Verify your PAT has the required permissions'
        ];
      case 'RESOURCE_BUSY':
        return [
          'The resource is currently busy',
          'Try again in a few moments',
          'Check if another operation is in progress'
        ];
      case 'QUOTA_EXCEEDED':
        return [
          'You have exceeded your quota limits',
          'Check your Azure DevOps usage',
          'Contact your administrator about increasing limits'
        ];
      case 'OPERATION_FAILED':
        return [
          'The operation could not be completed',
          'Check the resource status',
          'Try the operation again',
          'Contact support if the issue persists'
        ];
      default:
        return ['Check the resource status', 'Verify your permissions'];
    }
  }
}

/**
 * Extension lifecycle and VS Code integration errors
 */
export class ExtensionError extends AzurePipelinesError {
  constructor(
    message: string,
    public readonly extensionErrorCode: 'ACTIVATION_FAILED' | 'COMMAND_ERROR' | 'WEBVIEW_ERROR' | 'STORAGE_ERROR' | 'DISPOSAL_ERROR',
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    const recoveryActions = ExtensionError.getRecoveryActions(extensionErrorCode);
    
    super(
      message,
      `EXTENSION_${extensionErrorCode}`,
      'high',
      userMessage,
      recoveryActions,
      false,
      context
    );
  }

  private static getRecoveryActions(errorCode: string): string[] {
    switch (errorCode) {
      case 'ACTIVATION_FAILED':
        return [
          'Try restarting VS Code',
          'Check if the extension is properly installed',
          'Look for conflicting extensions',
          'Reinstall the extension if needed'
        ];
      case 'COMMAND_ERROR':
        return [
          'Try running the command again',
          'Check if all prerequisites are met',
          'Restart VS Code if the issue persists'
        ];
      case 'WEBVIEW_ERROR':
        return [
          'Close and reopen the webview',
          'Check your VS Code version compatibility',
          'Try refreshing the data'
        ];
      case 'STORAGE_ERROR':
        return [
          'Check VS Code storage permissions',
          'Try clearing extension data',
          'Restart VS Code'
        ];
      case 'DISPOSAL_ERROR':
        return [
          'Restart VS Code to clean up resources',
          'Check for memory issues',
          'Report the issue if it persists'
        ];
      default:
        return ['Try restarting VS Code', 'Check extension logs'];
    }
  }
}

/**
 * Diagnostic information interface
 */
export interface ErrorDiagnosticInfo {
  errorId: string;
  errorCode: string;
  errorType: string;
  message: string;
  userMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  stack?: string;
  context: Record<string, any>;
  recoveryActions: string[];
  retryable: boolean;
}

/**
 * Error context for enhanced debugging
 */
export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  organizationId?: string;
  projectId?: string;
  pipelineId?: number;
  runId?: number;
  requestId?: string;
  userAgent?: string;
  vsCodeVersion?: string;
  extensionVersion?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

/**
 * Type guard functions for error types
 */
export function isAuthenticationError(error: any): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError;
}

export function isDataValidationError(error: any): error is DataValidationError {
  return error instanceof DataValidationError;
}

export function isConfigurationError(error: any): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isResourceError(error: any): error is ResourceError {
  return error instanceof ResourceError;
}

export function isExtensionError(error: any): error is ExtensionError {
  return error instanceof ExtensionError;
}

export function isAzurePipelinesError(error: any): error is AzurePipelinesError {
  return error instanceof AzurePipelinesError;
}