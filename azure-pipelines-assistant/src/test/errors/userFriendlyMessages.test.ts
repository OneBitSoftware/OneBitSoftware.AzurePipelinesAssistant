/**
 * Unit tests for user-friendly error messages and recovery suggestions
 */

import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import { UserFriendlyMessages } from '../../errors/userFriendlyMessages';
import { 
  AuthenticationError, 
  NetworkError, 
  DataValidationError,
  ConfigurationError,
  ResourceError,
  ExtensionError
} from '../../errors/errorTypes';

suite('UserFriendlyMessages', () => {
  let userMessages: UserFriendlyMessages;

  setup(() => {
    userMessages = new UserFriendlyMessages();
  });

  suite('Authentication Error Messages', () => {
    test('should provide user-friendly message for INVALID_PAT', () => {
      const error = new AuthenticationError('Technical error message', 'INVALID_PAT');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Personal Access Token appears to be invalid'));
      assert.ok(!message.includes('Technical error message')); // Should not include technical message
    });

    test('should provide user-friendly message for EXPIRED_PAT', () => {
      const error = new AuthenticationError('Token expired', 'EXPIRED_PAT');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Personal Access Token has expired'));
      assert.ok(message.includes('generate a new token'));
    });

    test('should provide user-friendly message for INSUFFICIENT_PERMISSIONS', () => {
      const error = new AuthenticationError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('required permissions'));
      assert.ok(message.includes('Build, Code, Project, and Release'));
    });

    test('should provide user-friendly message for INVALID_ORGANIZATION', () => {
      const error = new AuthenticationError('Invalid org', 'INVALID_ORGANIZATION');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('organization name appears to be incorrect'));
      assert.ok(message.includes('verify the organization name'));
    });

    test('should provide user-friendly message for TOKEN_REVOKED', () => {
      const error = new AuthenticationError('Token revoked', 'TOKEN_REVOKED');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Personal Access Token has been revoked'));
      assert.ok(message.includes('generate a new token'));
    });

    test('should provide user-friendly message for NETWORK_ERROR', () => {
      const error = new AuthenticationError('Network error', 'NETWORK_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Unable to connect to Azure DevOps'));
      assert.ok(message.includes('check your internet connection'));
    });
  });

  suite('Network Error Messages', () => {
    test('should provide user-friendly message for TIMEOUT', () => {
      const error = new NetworkError('Request timeout', 'TIMEOUT');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('request timed out'));
      assert.ok(message.includes('check your internet connection'));
    });

    test('should provide user-friendly message for CONNECTION_REFUSED', () => {
      const error = new NetworkError('Connection refused', 'CONNECTION_REFUSED');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Unable to connect to Azure DevOps'));
      assert.ok(message.includes('firewall settings'));
    });

    test('should provide user-friendly message for DNS_ERROR', () => {
      const error = new NetworkError('DNS resolution failed', 'DNS_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('resolve the Azure DevOps server address'));
      assert.ok(message.includes('DNS settings'));
    });

    test('should provide user-friendly message for RATE_LIMITED', () => {
      const error = new NetworkError('Rate limited', 'RATE_LIMITED');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Too many requests'));
      assert.ok(message.includes('wait a moment'));
    });

    test('should provide user-friendly message for SERVER_ERROR', () => {
      const error = new NetworkError('Server error', 'SERVER_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Azure DevOps is experiencing server issues'));
      assert.ok(message.includes('try again in a few minutes'));
    });

    test('should provide user-friendly message for SERVICE_UNAVAILABLE', () => {
      const error = new NetworkError('Service unavailable', 'SERVICE_UNAVAILABLE');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Azure DevOps service is temporarily unavailable'));
      assert.ok(message.includes('service status'));
    });
  });

  suite('Data Validation Error Messages', () => {
    test('should provide user-friendly message for INVALID_FORMAT', () => {
      const error = new DataValidationError('Invalid format', 'INVALID_FORMAT');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('data received from Azure DevOps is in an unexpected format'));
      assert.ok(message.includes('API changes'));
    });

    test('should provide user-friendly message for MISSING_FIELD', () => {
      const error = new DataValidationError('Missing field', 'MISSING_FIELD');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('required information is missing'));
      assert.ok(message.includes('Azure DevOps response'));
    });

    test('should provide user-friendly message for SCHEMA_MISMATCH', () => {
      const error = new DataValidationError('Schema mismatch', 'SCHEMA_MISMATCH');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('API response format has changed'));
      assert.ok(message.includes('extension updates'));
    });

    test('should provide user-friendly message for PARSING_ERROR', () => {
      const error = new DataValidationError('Parsing error', 'PARSING_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Unable to process the response'));
      assert.ok(message.includes('data might be corrupted'));
    });
  });

  suite('Configuration Error Messages', () => {
    test('should provide user-friendly message for MISSING_CONFIG', () => {
      const error = new ConfigurationError('Missing config', 'MISSING_CONFIG');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Azure Pipelines Assistant is not configured'));
      assert.ok(message.includes('organization name and Personal Access Token'));
    });

    test('should provide user-friendly message for INVALID_CONFIG', () => {
      const error = new ConfigurationError('Invalid config', 'INVALID_CONFIG');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('configuration appears to be invalid'));
      assert.ok(message.includes('check your settings'));
    });

    test('should provide user-friendly message for CONFIG_ACCESS_ERROR', () => {
      const error = new ConfigurationError('Config access error', 'CONFIG_ACCESS_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Unable to access your configuration settings'));
      assert.ok(message.includes('VS Code permissions'));
    });

    test('should provide user-friendly message for WORKSPACE_ERROR', () => {
      const error = new ConfigurationError('Workspace error', 'WORKSPACE_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('issue with your workspace'));
      assert.ok(message.includes('valid workspace open'));
    });
  });

  suite('Resource Error Messages', () => {
    test('should provide user-friendly message for NOT_FOUND', () => {
      const error = new ResourceError('Not found', 'NOT_FOUND');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('requested resource could not be found'));
      assert.ok(message.includes('deleted or you might not have access'));
    });

    test('should provide user-friendly message for ACCESS_DENIED', () => {
      const error = new ResourceError('Access denied', 'ACCESS_DENIED');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('don\'t have permission to access this resource'));
      assert.ok(message.includes('Azure DevOps administrator'));
    });

    test('should provide user-friendly message for RESOURCE_BUSY', () => {
      const error = new ResourceError('Resource busy', 'RESOURCE_BUSY');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('resource is currently busy'));
      assert.ok(message.includes('try again in a moment'));
    });

    test('should provide user-friendly message for QUOTA_EXCEEDED', () => {
      const error = new ResourceError('Quota exceeded', 'QUOTA_EXCEEDED');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('exceeded your usage quota'));
      assert.ok(message.includes('Azure DevOps limits'));
    });
  });

  suite('Extension Error Messages', () => {
    test('should provide user-friendly message for ACTIVATION_FAILED', () => {
      const error = new ExtensionError('Activation failed', 'ACTIVATION_FAILED');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Azure Pipelines Assistant extension failed to start'));
      assert.ok(message.includes('restarting VS Code'));
    });

    test('should provide user-friendly message for COMMAND_ERROR', () => {
      const error = new ExtensionError('Command error', 'COMMAND_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('command could not be executed'));
      assert.ok(message.includes('try again or restart VS Code'));
    });

    test('should provide user-friendly message for WEBVIEW_ERROR', () => {
      const error = new ExtensionError('Webview error', 'WEBVIEW_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('issue with the display panel'));
      assert.ok(message.includes('closing and reopening'));
    });

    test('should provide user-friendly message for STORAGE_ERROR', () => {
      const error = new ExtensionError('Storage error', 'STORAGE_ERROR');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('Unable to save or retrieve data'));
      assert.ok(message.includes('VS Code permissions'));
    });
  });

  suite('Recovery Suggestions', () => {
    test('should provide recovery suggestions for authentication errors', () => {
      const error = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      
      const suggestions = userMessages.getRecoverySuggestions(error);

      assert.ok(suggestions.length > 0);
      assert.ok(suggestions.some(s => s.includes('access token'))); // Simplified language
    });

    test('should provide recovery suggestions for network errors', () => {
      const error = new NetworkError('Timeout', 'TIMEOUT');
      
      const suggestions = userMessages.getRecoverySuggestions(error);

      assert.ok(suggestions.length > 0);
      assert.ok(suggestions.some(s => s.includes('internet connection')));
    });

    test('should return empty array when recovery actions disabled', () => {
      userMessages.configure({ includeRecoveryActions: false });
      const error = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      
      const suggestions = userMessages.getRecoverySuggestions(error);

      assert.strictEqual(suggestions.length, 0);
    });
  });

  suite('Complete User Messages', () => {
    test('should provide complete user message with suggestions', () => {
      const error = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      
      const complete = userMessages.getCompleteUserMessage(error);

      assert.ok(complete.message);
      assert.ok(Array.isArray(complete.suggestions));
      assert.strictEqual(complete.severity, 'error'); // High severity maps to error
      assert.ok(complete.suggestions.length > 0);
    });

    test('should map severity correctly', () => {
      const lowError = new NetworkError('Low error', 'TIMEOUT');
      (lowError as any).severity = 'low';
      
      const mediumError = new NetworkError('Medium error', 'TIMEOUT');
      (mediumError as any).severity = 'medium';
      
      const highError = new AuthenticationError('High error', 'INVALID_PAT');
      // High severity by default
      
      const criticalError = new AuthenticationError('Critical error', 'INVALID_PAT');
      (criticalError as any).severity = 'critical';

      assert.strictEqual(userMessages.getCompleteUserMessage(lowError).severity, 'info');
      assert.strictEqual(userMessages.getCompleteUserMessage(mediumError).severity, 'warning');
      assert.strictEqual(userMessages.getCompleteUserMessage(highError).severity, 'error');
      assert.strictEqual(userMessages.getCompleteUserMessage(criticalError).severity, 'error');
    });
  });

  suite('Contextual Help', () => {
    test('should provide contextual help for authentication errors', () => {
      const error = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      
      const help = userMessages.getContextualHelp(error);

      assert.strictEqual(help.title, 'Authentication Issue');
      assert.ok(help.description);
      assert.ok(Array.isArray(help.actions));
      assert.ok(help.actions.some(a => a.label === 'Configure Extension' && a.primary));
    });

    test('should provide contextual help for network errors', () => {
      const error = new NetworkError('Timeout', 'TIMEOUT');
      
      const help = userMessages.getContextualHelp(error);

      assert.strictEqual(help.title, 'Connection Problem');
      assert.ok(help.actions.some(a => a.label === 'Retry' && a.primary));
    });

    test('should provide contextual help for configuration errors', () => {
      const error = new ConfigurationError('Missing config', 'MISSING_CONFIG');
      
      const help = userMessages.getContextualHelp(error);

      assert.strictEqual(help.title, 'Configuration Problem');
      assert.ok(help.actions.some(a => a.label === 'Open Settings' && a.primary));
    });

    test('should always include View Details action', () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      
      const help = userMessages.getContextualHelp(error);

      assert.ok(help.actions.some(a => a.label === 'View Details'));
    });
  });

  suite('Status Bar Messages', () => {
    test('should create short status bar message', () => {
      const error = new AuthenticationError('Your Personal Access Token appears to be invalid. Please check your token and try again.', 'INVALID_PAT');
      
      const statusMessage = userMessages.getStatusBarMessage(error);

      assert.ok(statusMessage.length <= 50);
      assert.ok(statusMessage.includes('Personal Access Token'));
    });

    test('should truncate long messages appropriately', () => {
      const longMessage = 'This is a very long error message that should be truncated for the status bar display because it exceeds the maximum length';
      const error = new NetworkError(longMessage, 'TIMEOUT');
      
      const statusMessage = userMessages.getStatusBarMessage(error);

      assert.ok(statusMessage.length <= 50);
      assert.ok(statusMessage.endsWith('...'));
    });

    test('should preserve short messages', () => {
      const shortMessage = 'Short error';
      const error = new NetworkError(shortMessage, 'TIMEOUT');
      
      const statusMessage = userMessages.getStatusBarMessage(error);

      assert.strictEqual(statusMessage, shortMessage);
    });
  });

  suite('Configuration Options', () => {
    test('should include error code when configured', () => {
      userMessages.configure({ includeErrorCode: true });
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.startsWith('[AUTH_INVALID_PAT]'));
    });

    test('should include technical details when configured', () => {
      userMessages.configure({ includeTechnicalDetails: true });
      const error = new NetworkError('Network error', 'TIMEOUT', 408, undefined, undefined, { statusCode: 408 });
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.includes('(Status: 408)'));
    });

    test('should truncate messages to max length', () => {
      userMessages.configure({ maxMessageLength: 50 });
      const error = new AuthenticationError('This is a very long error message that should be truncated', 'INVALID_PAT');
      
      const message = userMessages.getUserFriendlyMessage(error);

      assert.ok(message.length <= 50);
      assert.ok(message.endsWith('...'));
    });

    test('should use simple language when configured', () => {
      userMessages.configure({ useSimpleLanguage: true });
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      
      const suggestions = userMessages.getRecoverySuggestions(error);

      // Should replace technical terms
      const hasSimplifiedTerms = suggestions.some(s => 
        s.includes('access token') && !s.includes('Personal Access Token')
      );
      assert.ok(hasSimplifiedTerms);
    });

    test('should not use simple language when disabled', () => {
      userMessages.configure({ useSimpleLanguage: false });
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      
      const suggestions = userMessages.getRecoverySuggestions(error);

      // Should keep technical terms
      const hasTechnicalTerms = suggestions.some(s => 
        s.includes('Personal Access Token')
      );
      assert.ok(hasTechnicalTerms);
    });
  });

  suite('Error Title Generation', () => {
    test('should generate appropriate titles for different error types', () => {
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const networkError = new NetworkError('Network error', 'TIMEOUT');
      const dataError = new DataValidationError('Data error', 'INVALID_FORMAT');
      const configError = new ConfigurationError('Config error', 'MISSING_CONFIG');
      const resourceError = new ResourceError('Resource error', 'NOT_FOUND');
      const extensionError = new ExtensionError('Extension error', 'ACTIVATION_FAILED');

      const authHelp = userMessages.getContextualHelp(authError);
      const networkHelp = userMessages.getContextualHelp(networkError);
      const dataHelp = userMessages.getContextualHelp(dataError);
      const configHelp = userMessages.getContextualHelp(configError);
      const resourceHelp = userMessages.getContextualHelp(resourceError);
      const extensionHelp = userMessages.getContextualHelp(extensionError);

      assert.strictEqual(authHelp.title, 'Authentication Issue');
      assert.strictEqual(networkHelp.title, 'Connection Problem');
      assert.strictEqual(dataHelp.title, 'Data Issue');
      assert.strictEqual(configHelp.title, 'Configuration Problem');
      assert.strictEqual(resourceHelp.title, 'Resource Issue');
      assert.strictEqual(extensionHelp.title, 'Extension Problem');
    });
  });
});