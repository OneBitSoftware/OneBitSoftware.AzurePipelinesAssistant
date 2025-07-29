/**
 * Unit tests for error types and error classification
 */

import { suite, test } from 'mocha';
import * as assert from 'assert';
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
  isExtensionError,
  isAzurePipelinesError
} from '../../errors/errorTypes';

suite('Error Types', () => {
  suite('AuthenticationError', () => {
    test('should create authentication error with correct properties', () => {
      const error = new AuthenticationError(
        'Invalid token',
        'INVALID_PAT',
        'Your token is invalid',
        { userId: 'test' }
      );

      assert.strictEqual(error.message, 'Invalid token');
      assert.strictEqual(error.authErrorCode, 'INVALID_PAT');
      assert.strictEqual(error.userMessage, 'Your token is invalid');
      assert.strictEqual(error.severity, 'high');
      assert.strictEqual(error.retryable, false);
      assert.strictEqual(error.context.userId, 'test');
      assert.ok(error.recoveryActions.length > 0);
      assert.ok(error.errorId);
      assert.ok(error.timestamp);
    });

    test('should have correct recovery actions for INVALID_PAT', () => {
      const error = new AuthenticationError('Invalid token', 'INVALID_PAT');
      
      assert.ok(error.recoveryActions.includes('Verify your Personal Access Token is correct'));
      assert.ok(error.recoveryActions.includes('Generate a new PAT from Azure DevOps'));
    });

    test('should have correct recovery actions for EXPIRED_PAT', () => {
      const error = new AuthenticationError('Token expired', 'EXPIRED_PAT');
      
      assert.ok(error.recoveryActions.includes('Generate a new Personal Access Token'));
      assert.ok(error.recoveryActions.includes('Update your extension configuration with the new token'));
    });

    test('should be retryable for NETWORK_ERROR', () => {
      const error = new AuthenticationError('Network error', 'NETWORK_ERROR');
      
      assert.strictEqual(error.retryable, true);
      assert.strictEqual(error.severity, 'medium');
    });

    test('should generate diagnostic info correctly', () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      const diagnostics = error.getDiagnosticInfo();

      assert.strictEqual(diagnostics.errorCode, 'AUTH_INVALID_PAT');
      assert.strictEqual(diagnostics.errorType, 'AuthenticationError');
      assert.strictEqual(diagnostics.message, 'Test error');
      assert.strictEqual(diagnostics.severity, 'high');
      assert.strictEqual(diagnostics.retryable, false);
      assert.ok(diagnostics.errorId);
      assert.ok(diagnostics.timestamp);
      assert.ok(Array.isArray(diagnostics.recoveryActions));
    });
  });

  suite('NetworkError', () => {
    test('should create network error with correct properties', () => {
      const error = new NetworkError(
        'Connection timeout',
        'TIMEOUT',
        408,
        { details: 'timeout' },
        'Request timed out',
        { operation: 'getPipelines' }
      );

      assert.strictEqual(error.message, 'Connection timeout');
      assert.strictEqual(error.networkErrorCode, 'TIMEOUT');
      assert.strictEqual(error.statusCode, 408);
      assert.strictEqual(error.userMessage, 'Request timed out');
      assert.strictEqual(error.retryable, true);
      assert.ok(error.recoveryActions.length > 0);
    });

    test('should determine retryability correctly', () => {
      const retryableError = new NetworkError('Timeout', 'TIMEOUT');
      const nonRetryableError = new NetworkError('DNS Error', 'DNS_ERROR');

      assert.strictEqual(retryableError.retryable, true);
      assert.strictEqual(nonRetryableError.retryable, false);
    });

    test('should set correct severity for different error types', () => {
      const rateLimitError = new NetworkError('Rate limited', 'RATE_LIMITED');
      const serviceError = new NetworkError('Service unavailable', 'SERVICE_UNAVAILABLE');
      const timeoutError = new NetworkError('Timeout', 'TIMEOUT');

      assert.strictEqual(rateLimitError.severity, 'medium');
      assert.strictEqual(serviceError.severity, 'high');
      assert.strictEqual(timeoutError.severity, 'medium');
    });

    test('should include status code in context', () => {
      const error = new NetworkError('Server error', 'SERVER_ERROR', 500);
      
      assert.strictEqual(error.context.statusCode, 500);
      assert.strictEqual(error.statusCode, 500);
    });
  });

  suite('DataValidationError', () => {
    test('should create data validation error with correct properties', () => {
      const error = new DataValidationError(
        'Invalid format',
        'INVALID_FORMAT',
        'email',
        'invalid-email',
        'user@domain.com',
        'Email format is invalid'
      );

      assert.strictEqual(error.message, 'Invalid format');
      assert.strictEqual(error.validationErrorCode, 'INVALID_FORMAT');
      assert.strictEqual(error.field, 'email');
      assert.strictEqual(error.receivedValue, 'invalid-email');
      assert.strictEqual(error.expectedFormat, 'user@domain.com');
      assert.strictEqual(error.userMessage, 'Email format is invalid');
      assert.strictEqual(error.severity, 'medium');
      assert.strictEqual(error.retryable, false);
    });

    test('should include field information in context', () => {
      const error = new DataValidationError('Missing field', 'MISSING_FIELD', 'name');
      
      assert.strictEqual(error.context.field, 'name');
      assert.strictEqual(error.field, 'name');
    });

    test('should have appropriate recovery actions for different validation errors', () => {
      const formatError = new DataValidationError('Invalid format', 'INVALID_FORMAT', 'date');
      const missingError = new DataValidationError('Missing field', 'MISSING_FIELD', 'name');

      assert.ok(formatError.recoveryActions.some(action => action.includes('format')));
      assert.ok(missingError.recoveryActions.some(action => action.includes('required field')));
    });
  });

  suite('ConfigurationError', () => {
    test('should create configuration error with correct properties', () => {
      const error = new ConfigurationError(
        'Missing config',
        'MISSING_CONFIG',
        'organization',
        'Please configure organization'
      );

      assert.strictEqual(error.message, 'Missing config');
      assert.strictEqual(error.configErrorCode, 'MISSING_CONFIG');
      assert.strictEqual(error.configField, 'organization');
      assert.strictEqual(error.userMessage, 'Please configure organization');
      assert.strictEqual(error.severity, 'high');
      assert.strictEqual(error.retryable, false);
    });

    test('should include config field in context', () => {
      const error = new ConfigurationError('Invalid config', 'INVALID_CONFIG', 'pat');
      
      assert.strictEqual(error.context.configField, 'pat');
      assert.strictEqual(error.configField, 'pat');
    });
  });

  suite('ResourceError', () => {
    test('should create resource error with correct properties', () => {
      const error = new ResourceError(
        'Pipeline not found',
        'NOT_FOUND',
        'pipeline',
        '123',
        'Pipeline 123 not found'
      );

      assert.strictEqual(error.message, 'Pipeline not found');
      assert.strictEqual(error.resourceErrorCode, 'NOT_FOUND');
      assert.strictEqual(error.resourceType, 'pipeline');
      assert.strictEqual(error.resourceId, '123');
      assert.strictEqual(error.userMessage, 'Pipeline 123 not found');
      assert.strictEqual(error.severity, 'medium');
      assert.strictEqual(error.retryable, false);
    });

    test('should be retryable for RESOURCE_BUSY', () => {
      const error = new ResourceError('Resource busy', 'RESOURCE_BUSY');
      
      assert.strictEqual(error.retryable, true);
    });

    test('should have high severity for ACCESS_DENIED', () => {
      const error = new ResourceError('Access denied', 'ACCESS_DENIED');
      
      assert.strictEqual(error.severity, 'high');
    });
  });

  suite('ExtensionError', () => {
    test('should create extension error with correct properties', () => {
      const error = new ExtensionError(
        'Activation failed',
        'ACTIVATION_FAILED',
        'Extension failed to start'
      );

      assert.strictEqual(error.message, 'Activation failed');
      assert.strictEqual(error.extensionErrorCode, 'ACTIVATION_FAILED');
      assert.strictEqual(error.userMessage, 'Extension failed to start');
      assert.strictEqual(error.severity, 'high');
      assert.strictEqual(error.retryable, false);
    });

    test('should have appropriate recovery actions', () => {
      const activationError = new ExtensionError('Activation failed', 'ACTIVATION_FAILED');
      const commandError = new ExtensionError('Command failed', 'COMMAND_ERROR');

      assert.ok(activationError.recoveryActions.some(action => action.includes('restarting VS Code')));
      assert.ok(commandError.recoveryActions.some(action => action.includes('running the command again')));
    });
  });

  suite('Type Guards', () => {
    test('should correctly identify AuthenticationError', () => {
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const networkError = new NetworkError('Network error', 'TIMEOUT');
      const regularError = new Error('Regular error');

      assert.strictEqual(isAuthenticationError(authError), true);
      assert.strictEqual(isAuthenticationError(networkError), false);
      assert.strictEqual(isAuthenticationError(regularError), false);
    });

    test('should correctly identify NetworkError', () => {
      const networkError = new NetworkError('Network error', 'TIMEOUT');
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const regularError = new Error('Regular error');

      assert.strictEqual(isNetworkError(networkError), true);
      assert.strictEqual(isNetworkError(authError), false);
      assert.strictEqual(isNetworkError(regularError), false);
    });

    test('should correctly identify DataValidationError', () => {
      const dataError = new DataValidationError('Data error', 'INVALID_FORMAT');
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const regularError = new Error('Regular error');

      assert.strictEqual(isDataValidationError(dataError), true);
      assert.strictEqual(isDataValidationError(authError), false);
      assert.strictEqual(isDataValidationError(regularError), false);
    });

    test('should correctly identify ConfigurationError', () => {
      const configError = new ConfigurationError('Config error', 'MISSING_CONFIG');
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const regularError = new Error('Regular error');

      assert.strictEqual(isConfigurationError(configError), true);
      assert.strictEqual(isConfigurationError(authError), false);
      assert.strictEqual(isConfigurationError(regularError), false);
    });

    test('should correctly identify ResourceError', () => {
      const resourceError = new ResourceError('Resource error', 'NOT_FOUND');
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const regularError = new Error('Regular error');

      assert.strictEqual(isResourceError(resourceError), true);
      assert.strictEqual(isResourceError(authError), false);
      assert.strictEqual(isResourceError(regularError), false);
    });

    test('should correctly identify ExtensionError', () => {
      const extensionError = new ExtensionError('Extension error', 'ACTIVATION_FAILED');
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const regularError = new Error('Regular error');

      assert.strictEqual(isExtensionError(extensionError), true);
      assert.strictEqual(isExtensionError(authError), false);
      assert.strictEqual(isExtensionError(regularError), false);
    });

    test('should correctly identify AzurePipelinesError', () => {
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const networkError = new NetworkError('Network error', 'TIMEOUT');
      const dataError = new DataValidationError('Data error', 'INVALID_FORMAT');
      const configError = new ConfigurationError('Config error', 'MISSING_CONFIG');
      const resourceError = new ResourceError('Resource error', 'NOT_FOUND');
      const extensionError = new ExtensionError('Extension error', 'ACTIVATION_FAILED');
      const regularError = new Error('Regular error');

      assert.strictEqual(isAzurePipelinesError(authError), true);
      assert.strictEqual(isAzurePipelinesError(networkError), true);
      assert.strictEqual(isAzurePipelinesError(dataError), true);
      assert.strictEqual(isAzurePipelinesError(configError), true);
      assert.strictEqual(isAzurePipelinesError(resourceError), true);
      assert.strictEqual(isAzurePipelinesError(extensionError), true);
      assert.strictEqual(isAzurePipelinesError(regularError), false);
    });
  });

  suite('Error ID Generation', () => {
    test('should generate unique error IDs', () => {
      const error1 = new AuthenticationError('Error 1', 'INVALID_PAT');
      const error2 = new AuthenticationError('Error 2', 'INVALID_PAT');

      assert.notStrictEqual(error1.errorId, error2.errorId);
      assert.ok(error1.errorId.startsWith('AUTH_INVALID_PAT-'));
      assert.ok(error2.errorId.startsWith('AUTH_INVALID_PAT-'));
    });

    test('should include error code in error ID', () => {
      const authError = new AuthenticationError('Auth error', 'EXPIRED_PAT');
      const networkError = new NetworkError('Network error', 'TIMEOUT');

      assert.ok(authError.errorId.includes('AUTH_EXPIRED_PAT'));
      assert.ok(networkError.errorId.includes('NETWORK_TIMEOUT'));
    });
  });

  suite('Error Context', () => {
    test('should preserve context information', () => {
      const context = {
        operation: 'getPipelines',
        projectId: 'test-project',
        userId: 'test-user'
      };

      const error = new AuthenticationError('Auth error', 'INVALID_PAT', undefined, context);

      assert.strictEqual(error.context.operation, 'getPipelines');
      assert.strictEqual(error.context.projectId, 'test-project');
      assert.strictEqual(error.context.userId, 'test-user');
    });

    test('should merge context with error-specific data', () => {
      const context = { operation: 'test' };
      const error = new NetworkError('Network error', 'TIMEOUT', 408, { details: 'timeout' }, undefined, context);

      assert.strictEqual(error.context.operation, 'test');
      assert.strictEqual(error.context.statusCode, 408);
      assert.deepStrictEqual(error.context.responseBody, { details: 'timeout' });
    });
  });

  suite('Error Timestamps', () => {
    test('should set timestamp when error is created', () => {
      const beforeCreation = new Date();
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      const afterCreation = new Date();

      assert.ok(error.timestamp >= beforeCreation);
      assert.ok(error.timestamp <= afterCreation);
    });

    test('should have consistent timestamp in diagnostic info', () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      const diagnostics = error.getDiagnosticInfo();

      assert.strictEqual(error.timestamp.getTime(), diagnostics.timestamp.getTime());
    });
  });
});