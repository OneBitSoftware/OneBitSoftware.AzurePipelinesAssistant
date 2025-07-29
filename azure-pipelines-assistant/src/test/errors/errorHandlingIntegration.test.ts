/**
 * Integration tests for comprehensive error handling system
 */

import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ErrorHandler } from '../../errors/errorHandler';
import { ErrorRecovery } from '../../errors/errorRecovery';
import { ErrorDiagnostics } from '../../errors/diagnostics';
import { UserFriendlyMessages } from '../../errors/userFriendlyMessages';
import { 
  AuthenticationError, 
  NetworkError, 
  DataValidationError,
  ConfigurationError,
  ResourceError,
  ExtensionError
} from '../../errors/errorTypes';

suite('Error Handling Integration', () => {
  let errorHandler: ErrorHandler;
  let errorRecovery: ErrorRecovery;
  let mockContext: sinon.SinonStubbedInstance<vscode.ExtensionContext>;
  let mockOutputChannel: sinon.SinonStubbedInstance<vscode.OutputChannel>;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    // Create mock context
    mockContext = {
      extension: {
        packageJSON: { version: '1.0.0' }
      },
      secrets: {
        get: sinon.stub(),
        store: sinon.stub(),
        delete: sinon.stub()
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
    sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
    sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
    sinon.stub(vscode.window, 'showTextDocument').resolves(undefined as any);
    sinon.stub(vscode.workspace, 'openTextDocument').resolves(undefined as any);
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: sinon.stub().returns('test-value')
    } as any);
    sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);
    sinon.stub(vscode, 'version').value('1.74.0');

    // Use fake timers
    clock = sinon.useFakeTimers();

    // Initialize services
    errorHandler = ErrorHandler.getInstance(mockContext as any, mockOutputChannel as any);
    errorRecovery = ErrorRecovery.getInstance();
  });

  teardown(() => {
    clock.restore();
    sinon.restore();
    
    // Reset singletons
    (ErrorHandler as any).instance = null;
    (ErrorRecovery as any).instance = null;
    
    errorHandler?.dispose();
    errorRecovery?.dispose();
  });

  suite('End-to-End Error Handling', () => {
    test('should handle authentication error with full workflow', async () => {
      const error = new AuthenticationError(
        'Invalid Personal Access Token',
        'INVALID_PAT',
        undefined,
        { operation: 'validateCredentials', userId: 'test-user' }
      );

      const result = await errorHandler.handleError(error);

      // Verify error was handled
      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.logged, true);
      assert.strictEqual(result.userNotified, true);
      assert.strictEqual(result.diagnosticsCollected, true);

      // Verify logging occurred
      assert.ok(mockOutputChannel.appendLine.called);
      const logCall = mockOutputChannel.appendLine.firstCall;
      assert.ok(logCall.args[0].includes('AUTH_INVALID_PAT'));
      assert.ok(logCall.args[0].includes('Invalid Personal Access Token'));

      // Verify user notification
      const showErrorMessage = vscode.window.showErrorMessage as sinon.SinonStub;
      assert.ok(showErrorMessage.called);
      const notificationCall = showErrorMessage.firstCall;
      assert.ok(notificationCall.args[0].includes('Personal Access Token appears to be invalid'));

      // Verify statistics were updated
      const stats = errorHandler.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 1);
      assert.strictEqual(stats.errorsByType.AuthenticationError, 1);
      assert.strictEqual(stats.errorsByCode['AUTH_INVALID_PAT'], 1);
    });

    test('should handle network error with retry and recovery', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new NetworkError('Connection timeout', 'TIMEOUT');
        }
        return 'success';
      };

      const result = await errorRecovery.withRetry(operation, 'testNetworkOperation');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'success');
      assert.strictEqual(result.attemptsUsed, 3);
      assert.strictEqual(attemptCount, 3);
    });

    test('should handle graceful degradation scenario', async () => {
      const primaryOperation = async () => {
        throw new NetworkError('Service unavailable', 'SERVICE_UNAVAILABLE');
      };

      const fallbackOperation = async () => {
        return 'cached-data';
      };

      const result = await errorRecovery.withGracefulDegradation(
        primaryOperation,
        fallbackOperation,
        'testDegradation',
        { useCachedData: true, showOfflineMode: true }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'cached-data');
      assert.strictEqual(result.attemptsUsed, 2);
      assert.ok(result.recoveryActions?.includes('Using cached data'));

      // Verify degradation notification was shown
      const showWarningMessage = vscode.window.showWarningMessage as sinon.SinonStub;
      assert.ok(showWarningMessage.called);
      assert.ok(showWarningMessage.firstCall.args[0].includes('limited mode'));
    });

    test('should collect comprehensive diagnostics', async () => {
      const error = new NetworkError(
        'Connection failed',
        'CONNECTION_REFUSED',
        undefined,
        undefined,
        undefined,
        { operation: 'getPipelines', projectId: 'test-project' }
      );

      await errorHandler.handleError(error);

      const diagnostics = await errorHandler.exportDiagnostics();
      const parsed = JSON.parse(diagnostics);

      // Verify diagnostic report structure
      assert.ok(parsed.reportId);
      assert.ok(parsed.timestamp);
      assert.ok(parsed.systemInfo);
      assert.ok(parsed.networkDiagnostics);
      assert.ok(parsed.extensionDiagnostics);
      assert.ok(Array.isArray(parsed.recentErrors));
      assert.strictEqual(parsed.recentErrors.length, 1);

      // Verify error details in diagnostics
      const errorDiagnostic = parsed.recentErrors[0];
      assert.strictEqual(errorDiagnostic.errorCode, 'NETWORK_CONNECTION_REFUSED');
      assert.strictEqual(errorDiagnostic.errorType, 'NetworkError');
      assert.strictEqual(errorDiagnostic.message, 'Connection failed');
      assert.ok(errorDiagnostic.context.operation);
      assert.ok(errorDiagnostic.context.systemInfo);
    });

    test('should provide user-friendly messages and recovery actions', async () => {
      const userMessages = new UserFriendlyMessages();
      const error = new ConfigurationError(
        'Missing organization configuration',
        'MISSING_CONFIG',
        'organization'
      );

      const completeMessage = userMessages.getCompleteUserMessage(error);
      const contextualHelp = userMessages.getContextualHelp(error);

      // Verify user-friendly message
      assert.ok(completeMessage.message.includes('Azure Pipelines Assistant is not configured'));
      assert.strictEqual(completeMessage.severity, 'error');
      assert.ok(completeMessage.suggestions.length > 0);

      // Verify contextual help
      assert.strictEqual(contextualHelp.title, 'Configuration Problem');
      assert.ok(contextualHelp.actions.some(a => a.label === 'Open Settings' && a.primary));
      assert.ok(contextualHelp.actions.some(a => a.label === 'View Details'));
    });

    test('should handle circuit breaker activation and recovery', async () => {
      let callCount = 0;
      const failingOperation = async () => {
        callCount++;
        throw new NetworkError('Server error', 'SERVER_ERROR');
      };

      // Trigger circuit breaker by failing multiple times
      for (let i = 0; i < 5; i++) {
        await errorRecovery.withRetry(failingOperation, 'circuitBreakerTest', { maxRetries: 0 });
      }

      // Verify circuit breaker is open
      const status = errorRecovery.getCircuitBreakerStatus('circuitBreakerTest');
      assert.strictEqual(status.isOpen, true);
      assert.strictEqual(status.failureCount, 5);

      // Next call should be blocked
      const blockedResult = await errorRecovery.withRetry(failingOperation, 'circuitBreakerTest', { maxRetries: 0 });
      assert.strictEqual(blockedResult.success, false);
      assert.strictEqual(blockedResult.attemptsUsed, 0);
      assert.ok(blockedResult.error?.message.includes('Circuit breaker is open'));

      // Reset circuit breaker
      errorRecovery.resetCircuitBreaker('circuitBreakerTest');

      // Verify circuit breaker is reset
      const resetStatus = errorRecovery.getCircuitBreakerStatus('circuitBreakerTest');
      assert.strictEqual(resetStatus.isOpen, false);
      assert.strictEqual(resetStatus.failureCount, 0);
    });

    test('should handle error pattern analysis', async () => {
      const diagnostics = new ErrorDiagnostics(mockContext as any);

      // Create error spike pattern
      for (let i = 0; i < 6; i++) {
        await diagnostics.collectErrorDiagnostics(
          new NetworkError(`Network error ${i}`, 'TIMEOUT')
        );
      }

      const analysis = diagnostics.analyzeErrorPatterns();

      assert.strictEqual(analysis.isErrorSpike, true);
      assert.strictEqual(analysis.dominantErrorType, 'NetworkError');
      assert.ok(analysis.suggestedActions.some(action => action.includes('error spike')));
      assert.ok(analysis.suggestedActions.some(action => action.includes('internet connection')));

      diagnostics.dispose();
    });

    test('should handle rate limiting correctly', async () => {
      const error = new NetworkError('Rate limited', 'RATE_LIMITED');

      // Handle the same error multiple times quickly
      const result1 = await errorHandler.handleError(error);
      const result2 = await errorHandler.handleError(error);

      assert.strictEqual(result1.handled, true);
      assert.strictEqual(result2.handled, false); // Should be rate limited
    });

    test('should handle critical errors with priority', async () => {
      const criticalError = new ExtensionError(
        'Extension activation failed',
        'ACTIVATION_FAILED'
      );
      (criticalError as any).severity = 'critical';

      const result = await errorHandler.handleCriticalError(criticalError);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.userNotified, true);

      // Verify modal dialog was shown for critical error
      const showErrorMessage = vscode.window.showErrorMessage as sinon.SinonStub;
      assert.ok(showErrorMessage.called);
      const call = showErrorMessage.firstCall;
      assert.ok(call.args[1]?.modal === true); // Modal option
    });

    test('should handle auto-recovery attempts', async () => {
      const networkAuthError = new AuthenticationError(
        'Network authentication error',
        'NETWORK_ERROR'
      );

      const recovered = await errorRecovery.attemptAutoRecovery(networkAuthError);
      assert.strictEqual(recovered, true);

      const invalidPatError = new AuthenticationError(
        'Invalid PAT',
        'INVALID_PAT'
      );

      const notRecovered = await errorRecovery.attemptAutoRecovery(invalidPatError);
      assert.strictEqual(notRecovered, false);
    });

    test('should maintain error statistics across multiple errors', async () => {
      // Handle various types of errors
      await errorHandler.handleError(new AuthenticationError('Auth error 1', 'INVALID_PAT'));
      await errorHandler.handleError(new AuthenticationError('Auth error 2', 'EXPIRED_PAT'));
      await errorHandler.handleError(new NetworkError('Network error 1', 'TIMEOUT'));
      await errorHandler.handleError(new NetworkError('Network error 2', 'TIMEOUT'));
      await errorHandler.handleError(new DataValidationError('Data error', 'INVALID_FORMAT'));

      const stats = errorHandler.getErrorStatistics();

      assert.strictEqual(stats.totalErrors, 5);
      assert.strictEqual(stats.errorsByType.AuthenticationError, 2);
      assert.strictEqual(stats.errorsByType.NetworkError, 2);
      assert.strictEqual(stats.errorsByType.DataValidationError, 1);
      assert.strictEqual(stats.errorsByCode['AUTH_INVALID_PAT'], 1);
      assert.strictEqual(stats.errorsByCode['AUTH_EXPIRED_PAT'], 1);
      assert.strictEqual(stats.errorsByCode['NETWORK_TIMEOUT'], 2);
      assert.strictEqual(stats.errorsByCode['DATA_INVALID_FORMAT'], 1);
    });
  });

  suite('Error Handler Configuration', () => {
    test('should respect configuration changes', async () => {
      // Disable user notifications
      errorHandler.configure({ showUserNotifications: false });

      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      const result = await errorHandler.handleError(error);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.logged, true);
      assert.strictEqual(result.userNotified, false); // Should be disabled

      // Re-enable notifications
      errorHandler.configure({ showUserNotifications: true });

      const result2 = await errorHandler.handleError(
        new AuthenticationError('Test error 2', 'EXPIRED_PAT')
      );

      assert.strictEqual(result2.userNotified, true); // Should be enabled again
    });

    test('should respect session error limits', async () => {
      errorHandler.configure({ maxErrorsPerSession: 2 });

      const error1 = new NetworkError('Error 1', 'TIMEOUT');
      const error2 = new NetworkError('Error 2', 'CONNECTION_REFUSED');
      const error3 = new NetworkError('Error 3', 'DNS_ERROR');

      const result1 = await errorHandler.handleError(error1);
      const result2 = await errorHandler.handleError(error2);
      const result3 = await errorHandler.handleError(error3);

      assert.strictEqual(result1.handled, true);
      assert.strictEqual(result2.handled, true);
      assert.strictEqual(result3.handled, false); // Should be blocked by session limit
    });
  });

  suite('Resource Management', () => {
    test('should properly dispose of all resources', () => {
      // Create some state
      errorHandler.handleError(new AuthenticationError('Test error', 'INVALID_PAT'));
      errorRecovery.withRetry(async () => { throw new Error('test'); }, 'test', { maxRetries: 0 });

      // Verify state exists
      let stats = errorHandler.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 1);

      let circuitStatus = errorRecovery.getCircuitBreakerStatus('test');
      assert.strictEqual(circuitStatus.failureCount, 1);

      // Dispose
      errorHandler.dispose();
      errorRecovery.dispose();

      // Verify state is cleared
      stats = errorHandler.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 0);

      circuitStatus = errorRecovery.getCircuitBreakerStatus('test');
      assert.strictEqual(circuitStatus.failureCount, 0);
    });
  });
});