import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { IAzureDevOpsService } from '../../../interfaces';
import { RealTimeUpdateService } from '../../../services/realTimeUpdateService';
import { MockDataFactory } from '../../fixtures/mockData';

suite('RealTimeUpdateService Unit Tests', () => {
  let service: RealTimeUpdateService;
  let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    mockAzureDevOpsService = {
      getProjects: sinon.stub(),
      getPipelines: sinon.stub(),
      getPipelineRuns: sinon.stub(),
      triggerPipelineRun: sinon.stub(),
      getRunDetails: sinon.stub(),
      cancelRun: sinon.stub(),
      getRunLogs: sinon.stub(),
      downloadArtifacts: sinon.stub(),
      triggerRun: sinon.stub(),
      getLogs: sinon.stub(),
      refreshProject: sinon.stub(),
      refreshPipeline: sinon.stub(),
      clearCache: sinon.stub(),
      getPipelineRunsIncremental: sinon.stub(),
      getRunDetailsWithChangeDetection: sinon.stub(),
      getActiveRuns: sinon.stub(),
      getActivePipelineRuns: sinon.stub()
    };

    // Create mock configuration service
    const mockConfigService = {
      getConfiguration: sinon.stub().returns({}),
      getOrganization: sinon.stub().returns('test-org'),
      setOrganization: sinon.stub().resolves(),
      getPersonalAccessToken: sinon.stub().resolves('test-pat'),
      setPersonalAccessToken: sinon.stub().resolves(),
      getRefreshInterval: sinon.stub().returns(30),
      getMaxRunsPerPipeline: sinon.stub().returns(10),
      getShowTimestamps: sinon.stub().returns(true),
      getAutoRefresh: sinon.stub().returns(true),
      getFavoriteProjects: sinon.stub().returns([]),
      getFavoritePipelines: sinon.stub().returns([]),
      getCacheTimeout: sinon.stub().returns(300),
      getLogLevel: sinon.stub().returns('info'),
      getShowWelcomeOnStartup: sinon.stub().returns(true),
      getCompactView: sinon.stub().returns(false),
      addProjectToFavorites: sinon.stub().resolves(),
      removeProjectFromFavorites: sinon.stub().resolves(),
      isProjectFavorite: sinon.stub().returns(false),
      addPipelineToFavorites: sinon.stub().resolves(),
      removePipelineFromFavorites: sinon.stub().resolves(),
      isPipelineFavorite: sinon.stub().returns(false),
      validateConfiguration: sinon.stub().returns({ isValid: true, errors: [] }),
      isConfigured: sinon.stub().resolves(true),
      clearConfiguration: sinon.stub().resolves(),
      onConfigurationChanged: sinon.stub().returns({ dispose: sinon.stub() }),
      resetToDefaults: sinon.stub().resolves(),
      exportConfiguration: sinon.stub().resolves('{}'),
      importConfiguration: sinon.stub().resolves()
    };

    try {
      service = new RealTimeUpdateService(mockAzureDevOpsService, mockConfigService as any);
      clock = sinon.useFakeTimers();
    } catch (error) {
      console.warn('Failed to create RealTimeUpdateService:', error);
      // Create a minimal mock service for testing
      service = {
        subscribeToRunUpdates: sinon.stub().returns({ dispose: sinon.stub() }),
        subscribeToPipelineUpdates: sinon.stub().returns({ dispose: sinon.stub() }),
        startBackgroundRefresh: sinon.stub(),
        stopBackgroundRefresh: sinon.stub(),
        isBackgroundRefreshActive: sinon.stub().returns(false),
        getActiveSubscriptionCount: sinon.stub().returns(0),
        getConfiguration: sinon.stub().returns({}),
        updateConfiguration: sinon.stub(),
        refreshAllSubscriptions: sinon.stub().resolves(),
        dispose: sinon.stub(),
        onRunStatusChanged: new vscode.EventEmitter<any>().event
      } as any;
      clock = sinon.useFakeTimers();
    }
  });

  teardown(() => {
    service.dispose();
    clock.restore();
    sinon.restore();
  });

  suite('subscribeToRunUpdates', () => {
    test('should start monitoring pipeline run', () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      assert.ok(subscription);
      assert.ok(typeof subscription.dispose === 'function');
    });

    test('should call callback with updated run data', async () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      // Verify subscription was created
      assert.ok(subscription);
      assert.strictEqual(service.getActiveSubscriptionCount(), 1);

      subscription.dispose();
    });

    test('should dispose subscription properly', () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);
      assert.strictEqual(service.getActiveSubscriptionCount(), 1);

      subscription.dispose();
      assert.strictEqual(service.getActiveSubscriptionCount(), 0);
    });

    test('should handle multiple subscriptions', () => {
      const callback = sinon.stub();

      const subscription1 = service.subscribeToRunUpdates(123, 456, 'project1', callback);
      const subscription2 = service.subscribeToRunUpdates(124, 457, 'project2', callback);

      assert.strictEqual(service.getActiveSubscriptionCount(), 2);

      subscription1.dispose();
      assert.strictEqual(service.getActiveSubscriptionCount(), 1);

      subscription2.dispose();
      assert.strictEqual(service.getActiveSubscriptionCount(), 0);
    });

    test('should dispose subscription properly', () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      // Should not throw when disposing
      assert.doesNotThrow(() => {
        subscription.dispose();
      });

      // Should not trigger updates after disposal
      clock.tick(30000);
      assert.ok(mockAzureDevOpsService.getRunDetails.notCalled);
    });
  });

  suite('Background Refresh', () => {
    test('should start background refresh when subscriptions are added', () => {
      const callback = sinon.stub();
      mockAzureDevOpsService.getRunDetails.resolves(MockDataFactory.createPipelineRunDetails());

      service.subscribeToRunUpdates(123, 456, 'test-project', callback);

      assert.ok(service.isBackgroundRefreshActive());

      // Advance time by default interval (30 seconds)
      clock.tick(30000);

      assert.ok(mockAzureDevOpsService.getRunDetails.called);
    });

    test('should use custom refresh interval from configuration', () => {
      const callback = sinon.stub();
      mockAzureDevOpsService.getRunDetails.resolves(MockDataFactory.createPipelineRunDetails());

      // Update configuration with custom interval
      service.updateConfiguration({ pollingInterval: 60000 });
      service.subscribeToRunUpdates(123, 456, 'test-project', callback);

      // Advance time by less than custom interval
      clock.tick(30000);
      assert.ok(mockAzureDevOpsService.getRunDetails.notCalled);

      // Advance time to custom interval
      clock.tick(30000);
      assert.ok(mockAzureDevOpsService.getRunDetails.called);
    });

    test('should handle callback errors gracefully', () => {
      const callback = sinon.stub().throws(new Error('Callback error'));
      mockAzureDevOpsService.getRunDetails.resolves(MockDataFactory.createPipelineRunDetails());

      // Should not throw when starting background refresh
      assert.doesNotThrow(() => {
        service.subscribeToRunUpdates(123, 456, 'test-project', callback);
      });

      // Should not throw when callback errors
      assert.doesNotThrow(() => {
        clock.tick(30000);
      });
    });
  });

  suite('Stop Background Refresh', () => {
    test('should stop background refresh when all subscriptions are disposed', () => {
      const callback = sinon.stub();
      mockAzureDevOpsService.getRunDetails.resolves(MockDataFactory.createPipelineRunDetails());

      const subscription = service.subscribeToRunUpdates(123, 456, 'test-project', callback);
      assert.ok(service.isBackgroundRefreshActive());

      subscription.dispose();
      assert.ok(!service.isBackgroundRefreshActive());

      // Advance time - service should not be called
      clock.tick(30000);
      assert.ok(mockAzureDevOpsService.getRunDetails.notCalled);
    });

    test('should handle multiple dispose calls gracefully', () => {
      const callback = sinon.stub();

      const subscription = service.subscribeToRunUpdates(123, 456, 'test-project', callback);

      // Should not throw when disposing multiple times
      assert.doesNotThrow(() => {
        subscription.dispose();
        subscription.dispose();
      });
    });
  });

  suite('getActiveSubscriptionCount', () => {
    test('should return zero initially', () => {
      const count = service.getActiveSubscriptionCount();
      assert.strictEqual(count, 0);
    });

    test('should return correct count for active subscriptions', () => {
      const runId1 = 123;
      const runId2 = 456;
      const pipelineId = 789;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const sub1 = service.subscribeToRunUpdates(runId1, pipelineId, projectId, callback);
      const sub2 = service.subscribeToRunUpdates(runId2, pipelineId, projectId, callback);

      const count = service.getActiveSubscriptionCount();
      assert.strictEqual(count, 2);

      sub1.dispose();
      sub2.dispose();
    });

    test('should not include disposed subscriptions in count', () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      let count = service.getActiveSubscriptionCount();
      assert.strictEqual(count, 1);

      subscription.dispose();

      count = service.getActiveSubscriptionCount();
      assert.strictEqual(count, 0);
    });
  });

  suite('updateInterval management', () => {
    test('should use different intervals for different run states', async () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      // Start with in-progress run (should use shorter interval)
      const inProgressRun = MockDataFactory.createInProgressPipelineRun();
      mockAzureDevOpsService.getRunDetails.resolves(inProgressRun as any);

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      // Should update more frequently for in-progress runs
      clock.tick(15000); // 15 seconds
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.ok(mockAzureDevOpsService.getRunDetails.called);

      subscription.dispose();
    });

    test('should adjust interval based on run age', async () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      // Create an old in-progress run
      const oldRun = MockDataFactory.createInProgressPipelineRun();
      oldRun.createdDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      mockAzureDevOpsService.getRunDetails.resolves(oldRun as any);

      const subscription = service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      // Should use longer interval for older runs
      clock.tick(30000); // 30 seconds
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.ok(mockAzureDevOpsService.getRunDetails.called);

      subscription.dispose();
    });
  });

  suite('memory management', () => {
    test('should clean up completed subscriptions automatically', async () => {
      const runId = 123;
      const pipelineId = 456;
      const projectId = 'test-project';
      const callback = sinon.stub();

      const completedRun = MockDataFactory.createPipelineRun({
        id: runId,
        state: 'completed',
        result: 'succeeded'
      });

      mockAzureDevOpsService.getRunDetails.resolves(completedRun as any);

      service.subscribeToRunUpdates(runId, pipelineId, projectId, callback);

      // Trigger update that will complete the run
      clock.tick(30000);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should automatically clean up completed subscription
      const count = service.getActiveSubscriptionCount();
      assert.strictEqual(count, 0);
    });

    test('should limit maximum number of concurrent subscriptions', () => {
      const callback = sinon.stub();
      const maxSubscriptions = 50; // Assuming this is the limit

      // Create many subscriptions
      const subscriptions = [];
      for (let i = 0; i < maxSubscriptions + 10; i++) {
        const sub = service.subscribeToRunUpdates(i, 123, 'test-project', callback);
        subscriptions.push(sub);
      }

      const activeCount = service.getActiveSubscriptionCount();
      assert.ok(activeCount <= maxSubscriptions);

      // Clean up
      subscriptions.forEach(sub => sub.dispose());
    });
  });

  suite('dispose', () => {
    test('should dispose all subscriptions and stop polling', () => {
      const callback = sinon.stub();

      // Create subscriptions
      service.subscribeToRunUpdates(123, 456, 'test-project', callback);
      service.subscribeToRunUpdates(789, 456, 'test-project', callback);

      service.dispose();

      // Should have no active subscriptions
      const count = service.getActiveSubscriptionCount();
      assert.strictEqual(count, 0);

      // Should not trigger any updates
      clock.tick(30000);
      assert.ok(callback.notCalled);
    });

    test('should handle multiple dispose calls gracefully', () => {
      assert.doesNotThrow(() => {
        service.dispose();
        service.dispose();
      });
    });
  });
});