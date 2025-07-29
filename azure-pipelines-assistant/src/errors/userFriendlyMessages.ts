/**
 * User-friendly error messages and recovery suggestions for Azure Pipelines Assistant
 */

import { 
  AzurePipelinesError, 
  AuthenticationError, 
  NetworkError, 
  DataValidationError,
  ConfigurationError,
  ResourceError,
  ExtensionError,
  isAuthenticationError,
  isNetworkError,
  isDataValidationError,
  isConfigurationError,
  isResourceError,
  isExtensionError
} from './errorTypes';

/**
 * User-friendly message configuration
 */
export interface MessageConfig {
  includeErrorCode: boolean;
  includeTechnicalDetails: boolean;
  includeRecoveryActions: boolean;
  maxMessageLength: number;
  useSimpleLanguage: boolean;
}

/**
 * Localized message templates
 */
export interface MessageTemplates {
  authentication: {
    invalidPat: string;
    expiredPat: string;
    insufficientPermissions: string;
    invalidOrganization: string;
    tokenRevoked: string;
    networkError: string;
  };
  network: {
    timeout: string;
    connectionRefused: string;
    dnsError: string;
    rateLimited: string;
    serverError: string;
    badGateway: string;
    serviceUnavailable: string;
  };
  dataValidation: {
    invalidFormat: string;
    missingField: string;
    invalidValue: string;
    schemaMismatch: string;
    parsingError: string;
  };
  configuration: {
    missingConfig: string;
    invalidConfig: string;
    configAccessError: string;
    workspaceError: string;
  };
  resource: {
    notFound: string;
    accessDenied: string;
    resourceBusy: string;
    quotaExceeded: string;
    operationFailed: string;
  };
  extension: {
    activationFailed: string;
    commandError: string;
    webviewError: string;
    storageError: string;
    disposalError: string;
  };
  generic: {
    unknownError: string;
    contactSupport: string;
    tryAgainLater: string;
  };
}

/**
 * User-friendly message generator
 */
export class UserFriendlyMessages {
  private readonly config: MessageConfig = {
    includeErrorCode: false,
    includeTechnicalDetails: false,
    includeRecoveryActions: true,
    maxMessageLength: 200,
    useSimpleLanguage: true
  };

  private readonly templates: MessageTemplates = {
    authentication: {
      invalidPat: "Your Personal Access Token appears to be invalid. Please check your token and try again.",
      expiredPat: "Your Personal Access Token has expired. Please generate a new token and update your configuration.",
      insufficientPermissions: "Your Personal Access Token doesn't have the required permissions. Please ensure it has Build, Code, Project, and Release read permissions.",
      invalidOrganization: "The Azure DevOps organization name appears to be incorrect. Please verify the organization name in your configuration.",
      tokenRevoked: "Your Personal Access Token has been revoked. Please generate a new token and update your configuration.",
      networkError: "Unable to connect to Azure DevOps. Please check your internet connection and try again."
    },
    network: {
      timeout: "The request timed out. Please check your internet connection and try again.",
      connectionRefused: "Unable to connect to Azure DevOps. Please check your internet connection and firewall settings.",
      dnsError: "Unable to resolve the Azure DevOps server address. Please check your DNS settings and organization name.",
      rateLimited: "Too many requests have been made. Please wait a moment before trying again.",
      serverError: "Azure DevOps is experiencing server issues. Please try again in a few minutes.",
      badGateway: "There's a temporary issue with the Azure DevOps gateway. Please try again shortly.",
      serviceUnavailable: "Azure DevOps service is temporarily unavailable. Please check the service status and try again later."
    },
    dataValidation: {
      invalidFormat: "The data received from Azure DevOps is in an unexpected format. This might be due to API changes.",
      missingField: "Some required information is missing from the Azure DevOps response.",
      invalidValue: "The data received from Azure DevOps contains invalid values.",
      schemaMismatch: "The Azure DevOps API response format has changed. Please check for extension updates.",
      parsingError: "Unable to process the response from Azure DevOps. The data might be corrupted."
    },
    configuration: {
      missingConfig: "Azure Pipelines Assistant is not configured. Please provide your organization name and Personal Access Token.",
      invalidConfig: "Your configuration appears to be invalid. Please check your settings and try again.",
      configAccessError: "Unable to access your configuration settings. Please check VS Code permissions.",
      workspaceError: "There's an issue with your workspace. Please ensure you have a valid workspace open."
    },
    resource: {
      notFound: "The requested resource could not be found. It might have been deleted or you might not have access to it.",
      accessDenied: "You don't have permission to access this resource. Please check with your Azure DevOps administrator.",
      resourceBusy: "The resource is currently busy with another operation. Please try again in a moment.",
      quotaExceeded: "You have exceeded your usage quota. Please check your Azure DevOps limits.",
      operationFailed: "The operation could not be completed. Please try again or contact support if the issue persists."
    },
    extension: {
      activationFailed: "The Azure Pipelines Assistant extension failed to start properly. Please try restarting VS Code.",
      commandError: "The command could not be executed. Please try again or restart VS Code if the issue persists.",
      webviewError: "There was an issue with the display panel. Please try closing and reopening it.",
      storageError: "Unable to save or retrieve data. Please check VS Code permissions and available disk space.",
      disposalError: "There was an issue cleaning up resources. Please restart VS Code to ensure proper cleanup."
    },
    generic: {
      unknownError: "An unexpected error occurred. Please try again or contact support if the issue persists.",
      contactSupport: "If this issue continues, please contact support with the error details.",
      tryAgainLater: "Please try again in a few minutes. If the issue persists, check the Azure DevOps service status."
    }
  };

  /**
   * Configure message generation
   */
  public configure(config: Partial<MessageConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get user-friendly message for an error
   */
  public getUserFriendlyMessage(error: AzurePipelinesError): string {
    let baseMessage = this.getBaseMessage(error);
    
    // Apply configuration options
    if (this.config.includeErrorCode) {
      baseMessage = `[${error.errorCode}] ${baseMessage}`;
    }
    
    if (this.config.includeTechnicalDetails && error.context && Object.keys(error.context).length > 0) {
      const technicalDetails = this.formatTechnicalDetails(error.context);
      if (technicalDetails) {
        baseMessage += ` (${technicalDetails})`;
      }
    }
    
    // Truncate if too long
    if (baseMessage.length > this.config.maxMessageLength) {
      baseMessage = baseMessage.substring(0, this.config.maxMessageLength - 3) + '...';
    }
    
    return baseMessage;
  }

  /**
   * Get recovery suggestions for an error
   */
  public getRecoverySuggestions(error: AzurePipelinesError): string[] {
    if (!this.config.includeRecoveryActions) {
      return [];
    }
    
    return error.recoveryActions.map(action => this.simplifyRecoveryAction(action));
  }

  /**
   * Get a complete user message with recovery suggestions
   */
  public getCompleteUserMessage(error: AzurePipelinesError): {
    message: string;
    suggestions: string[];
    severity: 'info' | 'warning' | 'error';
  } {
    const message = this.getUserFriendlyMessage(error);
    const suggestions = this.getRecoverySuggestions(error);
    const severity = this.mapSeverityToUserLevel(error.severity);
    
    return {
      message,
      suggestions,
      severity
    };
  }

  /**
   * Get contextual help for an error
   */
  public getContextualHelp(error: AzurePipelinesError): {
    title: string;
    description: string;
    actions: Array<{ label: string; action: string; primary?: boolean }>;
  } {
    const title = this.getErrorTitle(error);
    const description = this.getUserFriendlyMessage(error);
    const actions = this.getContextualActions(error);
    
    return {
      title,
      description,
      actions
    };
  }

  /**
   * Format error for status bar display
   */
  public getStatusBarMessage(error: AzurePipelinesError): string {
    const baseMessage = this.getBaseMessage(error);
    
    // Keep status bar messages very short
    const maxLength = 50;
    if (baseMessage.length <= maxLength) {
      return baseMessage;
    }
    
    // Try to find a good truncation point
    const truncated = baseMessage.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Get base message for error type
   */
  private getBaseMessage(error: AzurePipelinesError): string {
    if (isAuthenticationError(error)) {
      return this.getAuthenticationMessage(error);
    }
    
    if (isNetworkError(error)) {
      return this.getNetworkMessage(error);
    }
    
    if (isDataValidationError(error)) {
      return this.getDataValidationMessage(error);
    }
    
    if (isConfigurationError(error)) {
      return this.getConfigurationMessage(error);
    }
    
    if (isResourceError(error)) {
      return this.getResourceMessage(error);
    }
    
    if (isExtensionError(error)) {
      return this.getExtensionMessage(error);
    }
    
    return this.templates.generic.unknownError;
  }

  /**
   * Get authentication error message
   */
  private getAuthenticationMessage(error: AuthenticationError): string {
    switch (error.authErrorCode) {
      case 'INVALID_PAT':
        return this.templates.authentication.invalidPat;
      case 'EXPIRED_PAT':
        return this.templates.authentication.expiredPat;
      case 'INSUFFICIENT_PERMISSIONS':
        return this.templates.authentication.insufficientPermissions;
      case 'INVALID_ORGANIZATION':
        return this.templates.authentication.invalidOrganization;
      case 'TOKEN_REVOKED':
        return this.templates.authentication.tokenRevoked;
      case 'NETWORK_ERROR':
        return this.templates.authentication.networkError;
      default:
        return this.templates.generic.unknownError;
    }
  }

  /**
   * Get network error message
   */
  private getNetworkMessage(error: NetworkError): string {
    switch (error.networkErrorCode) {
      case 'TIMEOUT':
        return this.templates.network.timeout;
      case 'CONNECTION_REFUSED':
        return this.templates.network.connectionRefused;
      case 'DNS_ERROR':
        return this.templates.network.dnsError;
      case 'RATE_LIMITED':
        return this.templates.network.rateLimited;
      case 'SERVER_ERROR':
        return this.templates.network.serverError;
      case 'BAD_GATEWAY':
        return this.templates.network.badGateway;
      case 'SERVICE_UNAVAILABLE':
        return this.templates.network.serviceUnavailable;
      default:
        return this.templates.generic.unknownError;
    }
  }

  /**
   * Get data validation error message
   */
  private getDataValidationMessage(error: DataValidationError): string {
    switch (error.validationErrorCode) {
      case 'INVALID_FORMAT':
        return this.templates.dataValidation.invalidFormat;
      case 'MISSING_FIELD':
        return this.templates.dataValidation.missingField;
      case 'INVALID_VALUE':
        return this.templates.dataValidation.invalidValue;
      case 'SCHEMA_MISMATCH':
        return this.templates.dataValidation.schemaMismatch;
      case 'PARSING_ERROR':
        return this.templates.dataValidation.parsingError;
      default:
        return this.templates.generic.unknownError;
    }
  }

  /**
   * Get configuration error message
   */
  private getConfigurationMessage(error: ConfigurationError): string {
    switch (error.configErrorCode) {
      case 'MISSING_CONFIG':
        return this.templates.configuration.missingConfig;
      case 'INVALID_CONFIG':
        return this.templates.configuration.invalidConfig;
      case 'CONFIG_ACCESS_ERROR':
        return this.templates.configuration.configAccessError;
      case 'WORKSPACE_ERROR':
        return this.templates.configuration.workspaceError;
      default:
        return this.templates.generic.unknownError;
    }
  }

  /**
   * Get resource error message
   */
  private getResourceMessage(error: ResourceError): string {
    switch (error.resourceErrorCode) {
      case 'NOT_FOUND':
        return this.templates.resource.notFound;
      case 'ACCESS_DENIED':
        return this.templates.resource.accessDenied;
      case 'RESOURCE_BUSY':
        return this.templates.resource.resourceBusy;
      case 'QUOTA_EXCEEDED':
        return this.templates.resource.quotaExceeded;
      case 'OPERATION_FAILED':
        return this.templates.resource.operationFailed;
      default:
        return this.templates.generic.unknownError;
    }
  }

  /**
   * Get extension error message
   */
  private getExtensionMessage(error: ExtensionError): string {
    switch (error.extensionErrorCode) {
      case 'ACTIVATION_FAILED':
        return this.templates.extension.activationFailed;
      case 'COMMAND_ERROR':
        return this.templates.extension.commandError;
      case 'WEBVIEW_ERROR':
        return this.templates.extension.webviewError;
      case 'STORAGE_ERROR':
        return this.templates.extension.storageError;
      case 'DISPOSAL_ERROR':
        return this.templates.extension.disposalError;
      default:
        return this.templates.generic.unknownError;
    }
  }

  /**
   * Get error title for dialogs
   */
  private getErrorTitle(error: AzurePipelinesError): string {
    if (isAuthenticationError(error)) {
      return 'Authentication Issue';
    }
    
    if (isNetworkError(error)) {
      return 'Connection Problem';
    }
    
    if (isDataValidationError(error)) {
      return 'Data Issue';
    }
    
    if (isConfigurationError(error)) {
      return 'Configuration Problem';
    }
    
    if (isResourceError(error)) {
      return 'Resource Issue';
    }
    
    if (isExtensionError(error)) {
      return 'Extension Problem';
    }
    
    return 'Unexpected Error';
  }

  /**
   * Get contextual actions for error
   */
  private getContextualActions(error: AzurePipelinesError): Array<{ label: string; action: string; primary?: boolean }> {
    const actions: Array<{ label: string; action: string; primary?: boolean }> = [];
    
    if (isAuthenticationError(error)) {
      actions.push({ label: 'Configure Extension', action: 'configure', primary: true });
      actions.push({ label: 'Check Token', action: 'checkToken' });
    } else if (isNetworkError(error)) {
      actions.push({ label: 'Retry', action: 'retry', primary: true });
      actions.push({ label: 'Check Connection', action: 'checkConnection' });
    } else if (isConfigurationError(error)) {
      actions.push({ label: 'Open Settings', action: 'openSettings', primary: true });
      actions.push({ label: 'Reset Configuration', action: 'resetConfig' });
    } else {
      actions.push({ label: 'Try Again', action: 'retry', primary: true });
    }
    
    actions.push({ label: 'View Details', action: 'viewDetails' });
    
    return actions;
  }

  /**
   * Simplify recovery action for user display
   */
  private simplifyRecoveryAction(action: string): string {
    if (!this.config.useSimpleLanguage) {
      return action;
    }
    
    // Simplify technical language
    return action
      .replace(/Personal Access Token/g, 'access token')
      .replace(/Azure DevOps/g, 'Azure DevOps')
      .replace(/VS Code/g, 'VS Code')
      .replace(/API/g, 'service')
      .replace(/configuration/g, 'settings');
  }

  /**
   * Format technical details for display
   */
  private formatTechnicalDetails(context: Record<string, any>): string {
    if (!this.config.includeTechnicalDetails) {
      return '';
    }
    
    const relevantDetails: string[] = [];
    
    if (context.statusCode) {
      relevantDetails.push(`Status: ${context.statusCode}`);
    }
    
    if (context.field) {
      relevantDetails.push(`Field: ${context.field}`);
    }
    
    if (context.resourceType) {
      relevantDetails.push(`Resource: ${context.resourceType}`);
    }
    
    return relevantDetails.join(', ');
  }

  /**
   * Map error severity to user-friendly level
   */
  private mapSeverityToUserLevel(severity: 'low' | 'medium' | 'high' | 'critical'): 'info' | 'warning' | 'error' {
    switch (severity) {
      case 'low':
        return 'info';
      case 'medium':
        return 'warning';
      case 'high':
      case 'critical':
        return 'error';
      default:
        return 'warning';
    }
  }
}