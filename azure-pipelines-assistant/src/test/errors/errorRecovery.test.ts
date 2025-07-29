/**
 * Unit tests for error recovery mechanisms and retry logic
 */

import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ErrorRecovery, withRetry, withGracefulDegradation } from '../../errors/errorRecovery';
import { 
  AuthenticationError, 
  NetworkError, 
  ResourceError 
} from '../../errors/errorTypes';

suite('ErrorRecovery', () => {
  let errorRecovery: ErrorRecovery;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    errorRecovery = ErrorRecovery.getInstance();
    clock = sinon.useFakeTimers();
    
    // Mock VS Code APIs
    sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
    sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);
  });

  teardown(() => {
    clock.restore();
    sinon.restore();
    errorRecovery.dispose();
    // Reset singleton
    (ErrorRecovery as any).instance = null;
  });

  suite('Retry Logic', () => {
    test('should succeed on first attempt', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'success';
      };

      const result = await errorRecovery.withRetry(operation, 'testOperation');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'success');
      assert.strictEqual(result.attemptsUsed, 1);
      assert.strictEqual(callCount, 1);
    });

    test('should retry on retryable errors', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new NetworkError('Timeout', 'TIMEOUT');
        }
        return 'success';
      };

      const result = await errorRecovery.withRetry(operation, 'testOperation');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'success');
      assert.strictEqual(result.attemptsUsed, 3);
      assert.strictEqual(callCount, 3);
    });

    test('should not retry on non-retryable errors', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new AuthenticationError('Invalid token', 'INVALID_PAT');
      };

      const result = await errorRecovery.withRetry(operation, 'testOperation');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attemptsUsed, 1);
      assert.strictEqual(callCount, 1);
      assert.ok(result.error);
    });

    test('should respect max retry limit', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new NetworkError('Timeout', 'TIMEOUT');
      };

      const result = await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 2 });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attemptsUsed, 3); // Initial attempt + 2 retries
      assert.strictEqual(callCount, 3);
    });

    test('should apply exponential backoff', async () => {
      let callCount = 0;
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      // Mock setTimeout to capture delays
      global.setTimeout = ((callback: any, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      }) as any;

      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new NetworkError('Timeout', 'TIMEOUT');
        }
        return 'success';
      };

      await errorRecovery.withRetry(operation, 'testOperation', {
        baseDelay: 1000,
        backoffMultiplier: 2,
        jitterEnabled: false
      });

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;

      assert.strictEqual(delays.length, 2); // Two delays for two retries
      assert.strictEqual(delays[0], 1000); // First retry: 1000ms
      assert.strictEqual(delays[1], 2000); // Second retry: 2000ms
    });

    test('should apply jitter when enabled', async () => {
      let callCount = 0;
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = ((callback: any, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new NetworkError('Timeout', 'TIMEOUT');
        }
        return 'success';
      };

      await errorRecovery.withRetry(operation, 'testOperation', {
        baseDelay: 1000,
        backoffMultiplier: 2,
        jitterEnabled: true
      });

      global.setTimeout = originalSetTimeout;

      assert.strictEqual(delays.length, 2);
      // With jitter, delays should be different from exact exponential values
      assert.notStrictEqual(delays[0], 1000);
      assert.notStrictEqual(delays[1], 2000);
      // But should be within reasonable range
      assert.ok(delays[0] >= 750 && delays[0] <= 1250);
      assert.ok(delays[1] >= 1500 && delays[1] <= 2500);
    });

    test('should use custom retry condition', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new Error('Custom error');
      };

      const customRetryCondition = (error: Error, attempt: number) => {
        return attempt < 2; // Only retry twice
      };

      const result = await errorRecovery.withRetry(operation, 'testOperation', {
        maxRetries: 5,
        retryCondition: customRetryCondition
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attemptsUsed, 3); // Initial + 2 retries
      assert.strictEqual(callCount, 3);
    });
  });

  suite('Circuit Breaker', () => {
    test('should open circuit breaker after failure threshold', async () => {
      const operation = async () => {
        throw new NetworkError('Server error', 'SERVER_ERROR');
      };

      // Fail 5 times to trigger circuit breaker (default threshold)
      for (let i = 0; i < 5; i++) {
        await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });
      }

      // Next call should be blocked by circuit breaker
      const result = await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attemptsUsed, 0);
      assert.ok(result.error?.message.includes('Circuit breaker is open'));
    });

    test('should reset circuit breaker on success', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount <= 5) {
          throw new NetworkError('Server error', 'SERVER_ERROR');
        }
        return 'success';
      };

      // Fail 5 times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });
      }

      // Wait for recovery timeout
      clock.tick(60000); // 1 minute

      // Next call should succeed and reset circuit breaker
      const result = await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'success');
    });

    test('should get circuit breaker status', async () => {
      const operation = async () => {
        throw new NetworkError('Server error', 'SERVER_ERROR');
      };

      // Initially closed
      let status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.isOpen, false);
      assert.strictEqual(status.failureCount, 0);

      // Fail a few times
      for (let i = 0; i < 3; i++) {
        await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });
      }

      status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.isOpen, false); // Not open yet
      assert.strictEqual(status.failureCount, 3);

      // Fail 2 more times to open circuit
      for (let i = 0; i < 2; i++) {
        await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });
      }

      status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.isOpen, true);
      assert.strictEqual(status.failureCount, 5);
      assert.ok(status.lastFailureTime);
      assert.ok(status.nextRetryTime);
    });

    test('should reset circuit breaker manually', async () => {
      const operation = async () => {
        throw new NetworkError('Server error', 'SERVER_ERROR');
      };

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });
      }

      let status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.isOpen, true);

      // Reset manually
      errorRecovery.resetCircuitBreaker('testOperation');

      status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.isOpen, false);
      assert.strictEqual(status.failureCount, 0);
    });
  });

  suite('Graceful Degradation', () => {
    test('should use primary operation when it succeeds', async () => {
      const primaryOperation = async () => 'primary result';
      const fallbackOperation = async () => 'fallback result';

      const result = await errorRecovery.withGracefulDegradation(
        primaryOperation,
        fallbackOperation,
        'testOperation'
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'primary result');
      assert.strictEqual(result.attemptsUsed, 1);
    });

    test('should use fallback operation when primary fails', async () => {
      const primaryOperation = async () => {
        throw new NetworkError('Primary failed', 'TIMEOUT');
      };
      const fallbackOperation = async () => 'fallback result';

      const result = await errorRecovery.withGracefulDegradation(
        primaryOperation,
        fallbackOperation,
        'testOperation'
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'fallback result');
      assert.strictEqual(result.attemptsUsed, 2);
      assert.ok(result.recoveryActions?.includes('Using cached data'));
    });

    test('should fail when both operations fail', async () => {
      const primaryOperation = async () => {
        throw new NetworkError('Primary failed', 'TIMEOUT');
      };
      const fallbackOperation = async () => {
        throw new Error('Fallback failed');
      };

      const result = await errorRecovery.withGracefulDegradation(
        primaryOperation,
        fallbackOperation,
        'testOperation'
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attemptsUsed, 2);
      assert.ok(result.error);
    });

    test('should show degradation notification when configured', async () => {
      const mockShowWarning = sinon.stub(vscode.window, 'showWarningMessage');
      mockShowWarning.resolves(undefined);

      const primaryOperation = async () => {
        throw new NetworkError('Primary failed', 'TIMEOUT');
      };
      const fallbackOperation = async () => 'fallback result';

      await errorRecovery.withGracefulDegradation(
        primaryOperation,
        fallbackOperation,
        'testOperation',
        { showOfflineMode: true }
      );

      assert.ok(mockShowWarning.called);
      assert.ok(mockShowWarning.firstCall.args[0].includes('limited mode'));
    });
  });

  suite('Auto Recovery', () => {
    test('should attempt authentication recovery for network auth errors', async () => {
      const error = new AuthenticationError('Network error', 'NETWORK_ERROR');
      
      const recovered = await errorRecovery.attemptAutoRecovery(error);

      assert.strictEqual(recovered, true);
    });

    test('should not auto-recover invalid PAT errors', async () => {
      const error = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      
      const recovered = await errorRecovery.attemptAutoRecovery(error);

      assert.strictEqual(recovered, false);
    });

    test('should attempt network recovery for retryable network errors', async () => {
      const error = new NetworkError('Timeout', 'TIMEOUT');
      
      const recovered = await errorRecovery.attemptAutoRecovery(error);

      assert.strictEqual(recovered, true);
    });

    test('should attempt resource recovery for busy resources', async () => {
      const error = new ResourceError('Resource busy', 'RESOURCE_BUSY');
      
      const recovered = await errorRecovery.attemptAutoRecovery(error);

      assert.strictEqual(recovered, true);
    });

    test('should not auto-recover resource not found errors', async () => {
      const error = new ResourceError('Not found', 'NOT_FOUND');
      
      const recovered = await errorRecovery.attemptAutoRecovery(error);

      assert.strictEqual(recovered, false);
    });
  });

  suite('Recovery Suggestions', () => {
    test('should provide network recovery suggestions', () => {
      const error = new NetworkError('Timeout', 'TIMEOUT');
      
      const suggestions = errorRecovery.getRecoverySuggestions(error);

      assert.ok(suggestions.includes('Check your internet connection'));
      assert.ok(suggestions.includes('Verify Azure DevOps service status'));
    });

    test('should provide authentication recovery suggestions', () => {
      const error = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      
      const suggestions = errorRecovery.getRecoverySuggestions(error);

      assert.ok(suggestions.includes('Check your Personal Access Token'));
      assert.ok(suggestions.includes('Verify your Azure DevOps organization name'));
    });

    test('should provide resource recovery suggestions', () => {
      const error = new ResourceError('Not found', 'NOT_FOUND');
      
      const suggestions = errorRecovery.getRecoverySuggestions(error);

      assert.ok(suggestions.includes('Verify the resource exists'));
      assert.ok(suggestions.includes('Check your permissions'));
    });

    test('should provide generic suggestions for unknown errors', () => {
      const error = new Error('Unknown error');
      
      const suggestions = errorRecovery.getRecoverySuggestions(error);

      assert.ok(suggestions.includes('Try the operation again'));
      assert.ok(suggestions.includes('Check your configuration'));
    });
  });

  suite('Utility Functions', () => {
    test('withRetry utility should work correctly', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 2) {
          throw new NetworkError('Timeout', 'TIMEOUT');
        }
        return 'success';
      };

      const result = await withRetry(operation, 'testOperation');

      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 2);
    });

    test('withRetry utility should throw on failure', async () => {
      const operation = async () => {
        throw new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      };

      try {
        await withRetry(operation, 'testOperation');
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
      }
    });

    test('withGracefulDegradation utility should work correctly', async () => {
      const primaryOperation = async () => {
        throw new NetworkError('Primary failed', 'TIMEOUT');
      };
      const fallbackOperation = async () => 'fallback result';

      const result = await withGracefulDegradation(
        primaryOperation,
        fallbackOperation,
        'testOperation'
      );

      assert.strictEqual(result, 'fallback result');
    });

    test('withGracefulDegradation utility should throw when both fail', async () => {
      const primaryOperation = async () => {
        throw new NetworkError('Primary failed', 'TIMEOUT');
      };
      const fallbackOperation = async () => {
        throw new Error('Fallback failed');
      };

      try {
        await withGracefulDegradation(
          primaryOperation,
          fallbackOperation,
          'testOperation'
        );
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('State Management', () => {
    test('should clear recovery state', async () => {
      const operation = async () => {
        throw new NetworkError('Server error', 'SERVER_ERROR');
      };

      // Create some state
      await errorRecovery.withRetry(operation, 'testOperation', { maxRetries: 0 });

      let status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.failureCount, 1);

      // Clear state
      errorRecovery.clearRecoveryState();

      status = errorRecovery.getCircuitBreakerStatus('testOperation');
      assert.strictEqual(status.failureCount, 0);
    });
  });

  suite('Singleton Pattern', () => {
    test('should return same instance when called multiple times', () => {
      const instance1 = ErrorRecovery.getInstance();
      const instance2 = ErrorRecovery.getInstance();

      assert.strictEqual(instance1, instance2);
    });
  });
});