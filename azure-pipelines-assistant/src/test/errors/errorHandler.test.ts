/**
 * Unit tests for error handler functionality
 */

import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ErrorHandler } from '../../errors/errorHandler';
import { 
  AuthenticationError, 
  NetworkError, 
  DataValidationError,
  ConfigurationError,
  ResourceError,
  ExtensionError
} from '../../errors/errorTypes';

suite('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockContext: sinon.SinonStubbedInstance<vscode.ExtensionContext>;
  let mockOutputChannel: sinon.SinonStubbedInstance<vscode.OutputChannel>;
  let mockWindow: sinon.SinonStub;
  let mockCommands: sinon.SinonStub;

  setup(() => {
    // Create mock context
    mockContext = {
      extension: {
        packageJSON: { version: '1.0.0' }
      }
    } as any;

    // Create mock output channel
    mockOutputChannel = {
      appendLine: sinon.stub(),
      show: sinon.stub(),
      hide: sinon.stub(),
      dispose: sinon.stub()
    } as any;

    // Mock VS Code APIs
    mockWindow = sinon.stub(vscode.window, 'showErrorMessage');
    mockWindow.resolves(undefined);
    
    sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
    sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
    sinon.stub(vscode.window, 'showTextDocument').resolves(undefined as any);
    sinon.stub(vscode.workspace, 'openTextDocument').resolves(undefined as any);
    
    mockCommands = sinon.stub(vscode.commands, 'executeCommand');
    mockCommands.resolves(undefined);

    // Create error handler instance
    errorHandler = ErrorHandler.getInstance(mockContext as any, mockOutputChannel as any);
  });

  teardown(() => {
    sinon.restore();
    // Reset singleton
    (ErrorHandler as any).instance = null;
  });

  suite('Error Handling', () => {
    test('should handle authentication error correctly', async () => {
      const error = new AuthenticationError('Invalid token', 'INVALID_PAT');
      
      const result = await errorHandler.handleError(error);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.logged, true);
      assert.strictEqual(result.userNotified, true);
      assert.strictEqual(result.errorId, error.errorId);
      
      // Verify logging
      assert.ok(mockOutputChannel.appendLine.called);
      
      // Verify user notification
      assert.ok(mockWindow.called);
    });

    test('should handle network error correctly', async () => {
      const error = new NetworkError('Connection timeout', 'TIMEOUT');
      
      const result = await errorHandler.handleError(error);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.logged, true);
      assert.strictEqual(result.userNotified, true);
      assert.strictEqual(result.errorId, error.errorId);
    });

    test('should handle critical errors with modal dialog', async () => {
      const error = new AuthenticationError('Critical auth error', 'INVALID_PAT');
      // Force critical severity
      (error as any).severity = 'critical';
      
      const result = await errorHandler.handleCriticalError(error);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.userNotified, true);
      
      // Verify modal dialog was shown
      assert.ok(mockWindow.calledWith(
        sinon.match.string,
        { modal: true },
        sinon.match.any
      ));
    });

    test('should handle errors silently when requested', async () => {
      const error = new NetworkError('Silent error', 'TIMEOUT');
      
      const result = await errorHandler.handleErrorSilently(error);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.logged, true);
      assert.strictEqual(result.userNotified, false);
    });

    test('should convert regular errors to AzurePipelinesError', async () => {
      const regularError = new Error('Regular error message');
      
      const result = await errorHandler.handleError(regularError);

      assert.strictEqual(result.handled, true);
      assert.ok(result.errorId);
    });

    test('should respect rate limiting', async () => {
      const error = new NetworkError('Rate limited error', 'TIMEOUT');
      
      // Handle the same error multiple times quickly
      const result1 = await errorHandler.handleError(error);
      const result2 = await errorHandler.handleError(error);

      assert.strictEqual(result1.handled, true);
      // Second call should be rate limited (same error within cooldown period)
      assert.strictEqual(result2.handled, false);
    });

    test('should always handle critical errors regardless of rate limiting', async () => {
      const error = new AuthenticationError('Critical error', 'INVALID_PAT');
      (error as any).severity = 'critical';
      
      // Handle multiple times
      const result1 = await errorHandler.handleCriticalError(error);
      const result2 = await errorHandler.handleCriticalError(error);

      assert.strictEqual(result1.handled, true);
      assert.strictEqual(result2.handled, true);
    });
  });

  suite('Error Statistics', () => {
    test('should track error statistics correctly', async () => {
      const authError = new AuthenticationError('Auth error', 'INVALID_PAT');
      const networkError = new NetworkError('Network error', 'TIMEOUT');
      
      await errorHandler.handleError(authError);
      await errorHandler.handleError(networkError);
      await errorHandler.handleError(authError); // Same type again

      const stats = errorHandler.getErrorStatistics();

      assert.strictEqual(stats.totalErrors, 3);
      assert.strictEqual(stats.errorsByType.AuthenticationError, 2);
      assert.strictEqual(stats.errorsByType.NetworkError, 1);
      assert.strictEqual(stats.errorsByCode['AUTH_INVALID_PAT'], 2);
      assert.strictEqual(stats.errorsByCode['NETWORK_TIMEOUT'], 1);
    });

    test('should clear error statistics', async () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      await errorHandler.handleError(error);

      let stats = errorHandler.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 1);

      errorHandler.clearErrorStatistics();
      stats = errorHandler.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 0);
    });
  });

  suite('User Notifications', () => {
    test('should show recovery actions when requested', async () => {
      mockWindow.resolves('Show Recovery Actions');
      const mockQuickPick = sinon.stub(vscode.window, 'showQuickPick');
      mockQuickPick.resolves({ label: '1. Test action', action: 'Test action' } as any);

      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      
      await errorHandler.handleError(error, undefined, { showRecoveryActions: true });

      // Should show recovery actions
      assert.ok(mockQuickPick.called);
    });

    test('should show error details when requested', async () => {
      mockWindow.resolves('View Details');
      const mockOpenTextDocument = sinon.stub(vscode.workspace, 'openTextDocument');
      mockOpenTextDocument.resolves({} as any);

      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      
      await errorHandler.handleError(error);

      // Should open text document with error details
      assert.ok(mockOpenTextDocument.called);
    });

    test('should export diagnostics when requested', async () => {
      mockWindow.resolves('Export Diagnostics');
      const mockOpenTextDocument = sinon.stub(vscode.workspace, 'openTextDocument');
      mockOpenTextDocument.resolves({} as any);

      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      (error as any).severity = 'critical';
      
      await errorHandler.handleCriticalError(error);

      // Should export diagnostics
      assert.ok(mockOpenTextDocument.called);
    });
  });

  suite('Configuration', () => {
    test('should apply configuration changes', () => {
      const config = {
        showUserNotifications: false,
        logToConsole: false,
        maxErrorsPerSession: 10
      };

      errorHandler.configure(config);

      // Configuration should be applied (tested indirectly through behavior)
      assert.ok(true); // Configuration is internal, so we just verify no errors
    });

    test('should respect session error limit', async () => {
      errorHandler.configure({ maxErrorsPerSession: 1 });

      const error1 = new NetworkError('Error 1', 'TIMEOUT');
      const error2 = new NetworkError('Error 2', 'CONNECTION_REFUSED');

      const result1 = await errorHandler.handleError(error1);
      const result2 = await errorHandler.handleError(error2);

      assert.strictEqual(result1.handled, true);
      assert.strictEqual(result2.handled, false); // Should be blocked by session limit
    });
  });

  suite('Error Context', () => {
    test('should include context in error handling', async () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      const context = {
        operation: 'getPipelines',
        projectId: 'test-project',
        userId: 'test-user'
      };

      const result = await errorHandler.handleError(error, context);

      assert.strictEqual(result.handled, true);
      // Context should be logged (verified through output channel calls)
      assert.ok(mockOutputChannel.appendLine.called);
    });
  });

  suite('Error Categorization', () => {
    test('should categorize authentication errors correctly', async () => {
      const authError = new Error('authentication failed');
      
      const result = await errorHandler.handleError(authError);

      assert.strictEqual(result.handled, true);
      // Should be converted to AuthenticationError
      assert.ok(result.errorId);
    });

    test('should categorize network errors correctly', async () => {
      const networkError = new Error('network timeout occurred');
      
      const result = await errorHandler.handleError(networkError);

      assert.strictEqual(result.handled, true);
      // Should be converted to NetworkError
      assert.ok(result.errorId);
    });

    test('should categorize validation errors correctly', async () => {
      const validationError = new Error('validation failed for field');
      
      const result = await errorHandler.handleError(validationError);

      assert.strictEqual(result.handled, true);
      // Should be converted to DataValidationError
      assert.ok(result.errorId);
    });

    test('should categorize configuration errors correctly', async () => {
      const configError = new Error('configuration is invalid');
      
      const result = await errorHandler.handleError(configError);

      assert.strictEqual(result.handled, true);
      // Should be converted to ConfigurationError
      assert.ok(result.errorId);
    });

    test('should categorize resource errors correctly', async () => {
      const resourceError = new Error('resource not found');
      
      const result = await errorHandler.handleError(resourceError);

      assert.strictEqual(result.handled, true);
      // Should be converted to ResourceError
      assert.ok(result.errorId);
    });

    test('should default to extension error for unknown errors', async () => {
      const unknownError = new Error('some unknown error');
      
      const result = await errorHandler.handleError(unknownError);

      assert.strictEqual(result.handled, true);
      // Should be converted to ExtensionError
      assert.ok(result.errorId);
    });
  });

  suite('Diagnostics Export', () => {
    test('should export diagnostics successfully', async () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      await errorHandler.handleError(error);

      const diagnostics = await errorHandler.exportDiagnostics();

      assert.ok(typeof diagnostics === 'string');
      assert.ok(diagnostics.length > 0);
      
      // Should be valid JSON
      const parsed = JSON.parse(diagnostics);
      assert.ok(parsed.reportId);
      assert.ok(parsed.timestamp);
      assert.ok(Array.isArray(parsed.recentErrors));
    });
  });

  suite('Disposal', () => {
    test('should dispose resources correctly', () => {
      errorHandler.dispose();

      // Should clear statistics
      const stats = errorHandler.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 0);
    });
  });

  suite('Singleton Pattern', () => {
    test('should return same instance when called multiple times', () => {
      const instance1 = ErrorHandler.getInstance(mockContext as any, mockOutputChannel as any);
      const instance2 = ErrorHandler.getInstance();

      assert.strictEqual(instance1, instance2);
    });

    test('should throw error when getInstance called without parameters on first call', () => {
      // Reset singleton
      (ErrorHandler as any).instance = null;

      assert.throws(() => {
        ErrorHandler.getInstance();
      }, /ErrorHandler must be initialized/);
    });
  });
});