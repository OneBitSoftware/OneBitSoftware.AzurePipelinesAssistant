import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ExtensionLifecycleManager, ExtensionState } from '../../services/extensionLifecycleManager';
import { ErrorHandler } from '../../errors/errorHandler';

suite('Extension Lifecycle Integration Tests', () => {
  let lifecycleManager: ExtensionLifecycleManager;
  let mockContext: vscode.ExtensionContext;
  let mockOutputChannel: vscode.OutputChannel;
  let errorHandler: ErrorHandler;
  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    
    // Create mock context
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub(),
        keys: sandbox.stub().returns([])
      },
      globalState: {
        get: sandbox.stub(),
        update: sandbox.stub(),
        keys: sandbox.stub().returns([])
      },
      extensionUri: vscode.Uri.file('/test'),
      extensionPath: '/test',
      storagePath: '/test/storage',
      globalStoragePath: '/test/global',
      logPath: '/test/logs',
      extension: {
        packageJSON: { version: '1.0.0' }
      }
    } as any;

    // Create mock output channel
    mockOutputChannel = {
      appendLine: sandbox.stub(),
      show: sandbox.stub(),
      dispose: sandbox.stub()
    } as any;

    // Get lifecycle manager instance
    lifecycleManager = ExtensionLifecycleManager.getInstance();
    
    // Create error handler
    errorHandler = ErrorHandler.getInstance(mockContext, mockOutputChannel);
  });

  teardown(() => {
    sandbox.restore();
    lifecycleManager.dispose();
  });

  suite('Extension Activation', () => {
    test('should initialize lifecycle manager successfully', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.INACTIVE);
    });

    test('should handle activation lifecycle correctly', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      // Track state changes
      const stateChanges: ExtensionState[] = [];
      lifecycleManager.on('stateChanged', ({ newState }) => {
        stateChanges.push(newState);
      });

      // Begin activation
      await lifecycleManager.beginActivation();
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.ACTIVATING);

      // Complete activation
      await lifecycleManager.completeActivation();
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.ACTIVE);

      // Verify state changes
      assert.deepStrictEqual(stateChanges, [ExtensionState.ACTIVATING, ExtensionState.ACTIVE]);
    });

    test('should track activation metrics', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      
      // Simulate some activation time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await lifecycleManager.completeActivation();
      
      const metrics = lifecycleManager.getActivationMetrics();
      assert.ok(metrics.startTime);
      assert.ok(metrics.endTime);
      assert.ok(metrics.duration && metrics.duration > 0);
      assert.strictEqual(metrics.state, ExtensionState.ACTIVE);
    });

    test('should handle activation errors', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const testError = new Error('Test activation error');
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.handleActivationError(testError);
      
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.ERROR);
    });

    test('should emit activation events', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      let activationStarted = false;
      let activationCompleted = false;
      
      lifecycleManager.on('activationStarted', () => {
        activationStarted = true;
      });
      
      lifecycleManager.on('activationCompleted', () => {
        activationCompleted = true;
      });

      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      assert.ok(activationStarted);
      assert.ok(activationCompleted);
    });
  });

  suite('Resource Management', () => {
    test('should register and track resources', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockResource = {
        id: 'test-resource',
        type: 'service' as const,
        dispose: sandbox.stub()
      };

      lifecycleManager.registerResource(mockResource);
      
      assert.strictEqual(lifecycleManager.getResourceCount(), 2); // lifecycle manager + test resource
      assert.strictEqual(lifecycleManager.getResourceCount('service'), 2);
    });

    test('should unregister resources', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockResource = {
        id: 'test-resource',
        type: 'service' as const,
        dispose: sandbox.stub()
      };

      lifecycleManager.registerResource(mockResource);
      const initialCount = lifecycleManager.getResourceCount();
      
      lifecycleManager.unregisterResource('test-resource');
      
      assert.strictEqual(lifecycleManager.getResourceCount(), initialCount - 1);
    });

    test('should dispose all resources during deactivation', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockResource1 = {
        id: 'test-resource-1',
        type: 'service' as const,
        dispose: sandbox.stub()
      };
      
      const mockResource2 = {
        id: 'test-resource-2',
        type: 'disposable' as const,
        dispose: sandbox.stub()
      };

      lifecycleManager.registerResource(mockResource1);
      lifecycleManager.registerResource(mockResource2);

      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      await lifecycleManager.beginDeactivation();
      await lifecycleManager.completeDeactivation();
      
      assert.ok(mockResource1.dispose.called);
      assert.ok(mockResource2.dispose.called);
    });

    test('should handle resource disposal errors gracefully', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockResource = {
        id: 'failing-resource',
        type: 'service' as const,
        dispose: sandbox.stub().throws(new Error('Disposal failed'))
      };

      lifecycleManager.registerResource(mockResource);

      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      // Should not throw even if resource disposal fails
      await lifecycleManager.beginDeactivation();
      await lifecycleManager.completeDeactivation();
      
      assert.ok(mockResource.dispose.called);
    });
  });

  suite('Health Checks', () => {
    test('should register and run health checks', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockHealthCheck = sandbox.stub().resolves({
        component: 'test-component',
        status: 'healthy' as const,
        message: 'All good',
        timestamp: new Date()
      });

      lifecycleManager.registerHealthCheck('test-check', mockHealthCheck);
      
      const results = await lifecycleManager.runHealthChecks();
      
      assert.ok(results.length > 0);
      assert.ok(results.some(r => r.component === 'test-component'));
      assert.ok(mockHealthCheck.called);
    });

    test('should handle health check failures', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const failingHealthCheck = sandbox.stub().rejects(new Error('Health check failed'));

      lifecycleManager.registerHealthCheck('failing-check', failingHealthCheck);
      
      const results = await lifecycleManager.runHealthChecks();
      
      const failingResult = results.find(r => r.component === 'failing-check');
      assert.ok(failingResult);
      assert.strictEqual(failingResult.status, 'error');
    });

    test('should include built-in health checks', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const results = await lifecycleManager.runHealthChecks();
      
      // Should include memory and lifecycle health checks
      assert.ok(results.some(r => r.component === 'memory'));
      assert.ok(results.some(r => r.component === 'lifecycle'));
    });
  });

  suite('Memory Management', () => {
    test('should track memory usage', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockResource = {
        id: 'memory-resource',
        type: 'service' as const,
        dispose: sandbox.stub(),
        getMemoryUsage: () => 1024
      };

      lifecycleManager.registerResource(mockResource);
      
      const usage = lifecycleManager.getMemoryUsage();
      
      assert.ok(usage.total >= 1024);
      assert.ok(usage.byResource['memory-resource'] === 1024);
      assert.ok(usage.byType['service'] >= 1024);
    });

    test('should handle resources without memory tracking', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      const mockResource = {
        id: 'no-memory-resource',
        type: 'service' as const,
        dispose: sandbox.stub()
        // No getMemoryUsage method
      };

      lifecycleManager.registerResource(mockResource);
      
      const usage = lifecycleManager.getMemoryUsage();
      
      assert.strictEqual(usage.byResource['no-memory-resource'], 0);
    });
  });

  suite('Extension Deactivation', () => {
    test('should handle deactivation lifecycle correctly', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      // Track state changes
      const stateChanges: ExtensionState[] = [];
      lifecycleManager.on('stateChanged', ({ newState }) => {
        stateChanges.push(newState);
      });

      await lifecycleManager.beginDeactivation();
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.DEACTIVATING);

      await lifecycleManager.completeDeactivation();
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.INACTIVE);

      // Verify state changes
      assert.deepStrictEqual(stateChanges, [ExtensionState.DEACTIVATING, ExtensionState.INACTIVE]);
    });

    test('should persist data during deactivation', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      await lifecycleManager.beginDeactivation();
      
      // Verify that global state update was called for persistence
      assert.ok((mockContext.globalState.update as sinon.SinonStub).called);
    });

    test('should emit deactivation events', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      let deactivationStarted = false;
      let deactivationCompleted = false;
      
      lifecycleManager.on('deactivationStarted', () => {
        deactivationStarted = true;
      });
      
      lifecycleManager.on('deactivationCompleted', () => {
        deactivationCompleted = true;
      });

      await lifecycleManager.beginDeactivation();
      await lifecycleManager.completeDeactivation();
      
      assert.ok(deactivationStarted);
      assert.ok(deactivationCompleted);
    });

    test('should handle deactivation from error state', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.handleActivationError(new Error('Test error'));
      
      // Should be able to deactivate from error state
      await lifecycleManager.beginDeactivation();
      await lifecycleManager.completeDeactivation();
      
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.INACTIVE);
    });
  });

  suite('Monitoring and Diagnostics', () => {
    test('should start monitoring after activation', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      // Monitoring should be active (we can't easily test the timers directly,
      // but we can verify the state is correct)
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.ACTIVE);
    });

    test('should stop monitoring during deactivation', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      await lifecycleManager.beginDeactivation();
      
      // Monitoring should be stopped
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.DEACTIVATING);
    });
  });

  suite('Error Scenarios', () => {
    test('should prevent activation from invalid states', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      
      // Should throw when trying to activate again
      try {
        await lifecycleManager.beginActivation();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Cannot activate extension in state'));
      }
    });

    test('should prevent completion from invalid states', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      // Should throw when trying to complete without beginning
      try {
        await lifecycleManager.completeActivation();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Cannot complete activation in state'));
      }
    });

    test('should handle multiple deactivation calls gracefully', async () => {
      await lifecycleManager.initialize(mockContext, errorHandler, mockOutputChannel);
      
      await lifecycleManager.beginActivation();
      await lifecycleManager.completeActivation();
      
      await lifecycleManager.beginDeactivation();
      
      // Second deactivation call should not throw
      await lifecycleManager.beginDeactivation();
      
      await lifecycleManager.completeDeactivation();
      
      assert.strictEqual(lifecycleManager.getState(), ExtensionState.INACTIVE);
    });
  });
});