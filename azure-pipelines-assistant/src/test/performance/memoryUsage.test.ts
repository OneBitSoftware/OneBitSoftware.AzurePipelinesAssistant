import * as assert from 'assert';
import * as sinon from 'sinon';
import { CacheService } from '../../services/cacheService';
import { RealTimeUpdateService } from '../../services/realTimeUpdateService';
import { MockDataFactory } from '../fixtures/mockData';

suite('Memory Usage Performance Tests', () => {
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    clock.restore();
    sinon.restore();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  const getMemoryUsage = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
  };

  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  suite('Cache Service Memory Management', () => {
    test('should not leak memory with frequent cache operations', () => {
      const cacheService = new CacheService(5000, 1000); // 5 second TTL, max 1000 items
      const initialMemory = getMemoryUsage();

      // Perform many cache operations
      for (let i = 0; i < 10000; i++) {
        const key = `test-key-${i}`;
        const value = MockDataFactory.createProject({ id: `project-${i}` });
        cacheService.set(key, value);

        // Occasionally get and invalidate items
        if (i % 100 === 0) {
          cacheService.get(key);
          cacheService.invalidate(key);
        }
      }

      const afterOperationsMemory = getMemoryUsage();
      const memoryIncrease = afterOperationsMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase after 10k cache operations: ${formatBytes(memoryIncrease)}`);

      // Clear cache and force cleanup
      cacheService.clear();
      if (global.gc) {
        global.gc();
      }

      const afterCleanupMemory = getMemoryUsage();
      const finalMemoryIncrease = afterCleanupMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase after cleanup: ${formatBytes(finalMemoryIncrease)}`);

      // Memory increase should be reasonable (less than 50MB)
      assert.ok(memoryIncrease < 50 * 1024 * 1024,
        `Memory increase ${formatBytes(memoryIncrease)} exceeds 50MB limit`);

      // Memory should be mostly reclaimed after cleanup
      assert.ok(finalMemoryIncrease < memoryIncrease / 2,
        `Memory not properly reclaimed after cleanup`);
    });

    test('should handle cache expiration without memory leaks', () => {
      const cacheService = new CacheService(100, 1000); // 100ms TTL
      const initialMemory = getMemoryUsage();

      // Add many items to cache
      for (let i = 0; i < 1000; i++) {
        const key = `expiring-key-${i}`;
        const value = MockDataFactory.createPipelineRunDetails();
        cacheService.set(key, value);
      }

      const afterAddingMemory = getMemoryUsage();

      // Advance time to expire all items
      clock.tick(200);

      // Try to access expired items (should trigger cleanup)
      for (let i = 0; i < 1000; i++) {
        cacheService.get(`expiring-key-${i}`);
      }

      if (global.gc) {
        global.gc();
      }

      const afterExpirationMemory = getMemoryUsage();
      const memoryAfterExpiration = afterExpirationMemory.heapUsed - initialMemory.heapUsed;
      const memoryAfterAdding = afterAddingMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory after adding items: ${formatBytes(memoryAfterAdding)}`);
      console.log(`Memory after expiration: ${formatBytes(memoryAfterExpiration)}`);

      // Memory should be significantly reduced after expiration
      assert.ok(memoryAfterExpiration < memoryAfterAdding / 2,
        'Expired cache items not properly cleaned up');
    });

    test('should respect cache size limits', () => {
      const maxItems = 100;
      const cacheService = new CacheService(60000, maxItems); // 1 minute TTL, max 100 items
      const initialMemory = getMemoryUsage();

      // Add more items than the limit
      for (let i = 0; i < maxItems * 2; i++) {
        const key = `limited-key-${i}`;
        const value = MockDataFactory.createPipelineRunDetails();
        cacheService.set(key, value);
      }

      const stats = cacheService.getStats();
      assert.ok(stats.size <= maxItems,
        `Cache size ${stats.size} exceeds limit ${maxItems}`);

      const afterLimitMemory = getMemoryUsage();
      const memoryIncrease = afterLimitMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase with size limit: ${formatBytes(memoryIncrease)}`);

      // Memory increase should be bounded by the cache limit
      assert.ok(memoryIncrease < 100 * 1024 * 1024,
        `Memory increase ${formatBytes(memoryIncrease)} exceeds expected bounds`);
    });
  });

  suite('Real-Time Update Service Memory Management', () => {
    test('should not leak memory with many subscriptions', () => {
      const mockAzureDevOpsService = {
        getRunDetails: sinon.stub().resolves(MockDataFactory.createPipelineRunDetails())
      } as any;

      const mockConfigService = {
        getConfiguration: sinon.stub(),
        getOrganization: sinon.stub(),
        setOrganization: sinon.stub(),
        getPersonalAccessToken: sinon.stub(),
        setPersonalAccessToken: sinon.stub()
      } as any;
      const realTimeService = new RealTimeUpdateService(mockAzureDevOpsService, mockConfigService);
      const initialMemory = getMemoryUsage();

      // Create many subscriptions
      const subscriptions = [];
      for (let i = 0; i < 1000; i++) {
        const subscription = realTimeService.subscribeToRunUpdates(
          i,
          123,
          'test-project',
          sinon.stub()
        );
        subscriptions.push(subscription);
      }

      const afterSubscriptionsMemory = getMemoryUsage();
      const memoryIncrease = afterSubscriptionsMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase with 1000 subscriptions: ${formatBytes(memoryIncrease)}`);

      // Dispose all subscriptions
      subscriptions.forEach(sub => sub.dispose());
      realTimeService.dispose();

      if (global.gc) {
        global.gc();
      }

      const afterCleanupMemory = getMemoryUsage();
      const finalMemoryIncrease = afterCleanupMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase after cleanup: ${formatBytes(finalMemoryIncrease)}`);

      // Memory should be mostly reclaimed
      assert.ok(finalMemoryIncrease < memoryIncrease / 2,
        'Subscriptions not properly cleaned up');
    });

    test('should clean up completed run subscriptions automatically', () => {
      const completedRun = MockDataFactory.createPipelineRun({
        state: 'completed',
        result: 'succeeded'
      });

      const mockAzureDevOpsService = {
        getRunDetails: sinon.stub().resolves(completedRun)
      } as any;

      const mockConfigService = {
        getConfiguration: sinon.stub(),
        getOrganization: sinon.stub(),
        setOrganization: sinon.stub(),
        getPersonalAccessToken: sinon.stub(),
        setPersonalAccessToken: sinon.stub()
      } as any;
      const realTimeService = new RealTimeUpdateService(mockAzureDevOpsService, mockConfigService);
      const initialMemory = getMemoryUsage();

      // Create subscriptions for completed runs
      for (let i = 0; i < 100; i++) {
        realTimeService.subscribeToRunUpdates(i, 123, 'test-project', sinon.stub());
      }

      // Trigger updates (should auto-cleanup completed runs)
      clock.tick(30000);

      const activeSubscriptions = realTimeService.getActiveSubscriptionCount();
      assert.strictEqual(activeSubscriptions, 0,
        'Completed run subscriptions not automatically cleaned up');

      realTimeService.dispose();

      if (global.gc) {
        global.gc();
      }

      const afterCleanupMemory = getMemoryUsage();
      const memoryIncrease = afterCleanupMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase with auto-cleanup: ${formatBytes(memoryIncrease)}`);

      // Memory increase should be minimal
      assert.ok(memoryIncrease < 10 * 1024 * 1024,
        `Memory increase ${formatBytes(memoryIncrease)} too high for auto-cleanup`);
    });
  });

  suite('Large Dataset Memory Management', () => {
    test('should handle large project datasets efficiently', () => {
      const initialMemory = getMemoryUsage();

      // Create large dataset
      const projects = MockDataFactory.createProjects(1000);
      const pipelines = projects.flatMap(project =>
        MockDataFactory.createPipelines(50, project)
      );
      const runs = pipelines.flatMap(pipeline =>
        MockDataFactory.createPipelineRuns(20, pipeline)
      );

      const afterCreationMemory = getMemoryUsage();
      const creationMemoryIncrease = afterCreationMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory for large dataset: ${formatBytes(creationMemoryIncrease)}`);
      console.log(`Projects: ${projects.length}, Pipelines: ${pipelines.length}, Runs: ${runs.length}`);

      // Verify data integrity
      assert.strictEqual(projects.length, 1000);
      assert.strictEqual(pipelines.length, 50000);
      assert.strictEqual(runs.length, 1000000);

      // Clear references and force garbage collection
      projects.length = 0;
      pipelines.length = 0;
      runs.length = 0;

      if (global.gc) {
        global.gc();
      }

      const afterCleanupMemory = getMemoryUsage();
      const finalMemoryIncrease = afterCleanupMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory after cleanup: ${formatBytes(finalMemoryIncrease)}`);

      // Memory should be mostly reclaimed
      assert.ok(finalMemoryIncrease < creationMemoryIncrease / 2,
        'Large dataset memory not properly reclaimed');
    });

    test('should handle memory pressure gracefully', () => {
      const cacheService = new CacheService(300000, 10000); // 5 minute TTL, max 10k items
      const initialMemory = getMemoryUsage();

      try {
        // Gradually increase memory pressure
        let itemCount = 0;
        const maxMemoryIncrease = 200 * 1024 * 1024; // 200MB limit

        while (itemCount < 50000) {
          const key = `pressure-test-${itemCount}`;
          const value = MockDataFactory.createPipelineRunDetails();
          cacheService.set(key, value);
          itemCount++;

          // Check memory every 1000 items
          if (itemCount % 1000 === 0) {
            const currentMemory = getMemoryUsage();
            const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;

            if (memoryIncrease > maxMemoryIncrease) {
              console.log(`Memory pressure test stopped at ${itemCount} items, memory: ${formatBytes(memoryIncrease)}`);
              break;
            }
          }
        }

        const stats = cacheService.getStats();
        console.log(`Cache stats under pressure: size=${stats.size}, hits=${stats.hits}, misses=${stats.misses}`);

        // Cache should still be functional
        assert.ok(stats.size > 0, 'Cache became non-functional under memory pressure');

      } finally {
        cacheService.clear();
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = getMemoryUsage();
      const finalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Final memory after pressure test: ${formatBytes(finalMemoryIncrease)}`);
    });
  });

  suite('Memory Leak Detection', () => {
    test('should not leak memory in typical usage patterns', () => {
      const initialMemory = getMemoryUsage();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // Simulate typical usage pattern
        const cacheService = new CacheService();

        // Add some data
        for (let j = 0; j < 10; j++) {
          cacheService.set(`key-${i}-${j}`, MockDataFactory.createProject());
        }

        // Use the data
        for (let j = 0; j < 10; j++) {
          cacheService.get(`key-${i}-${j}`);
        }

        // Clear and dispose
        cacheService.clear();
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase after ${iterations} iterations: ${formatBytes(memoryIncrease)}`);

      // Memory increase should be minimal for typical usage
      assert.ok(memoryIncrease < 20 * 1024 * 1024,
        `Potential memory leak detected: ${formatBytes(memoryIncrease)} increase`);
    });

    test('should detect and prevent excessive memory growth', () => {
      const cacheService = new CacheService(60000, 1000); // 1 minute TTL, max 1000 items
      const initialMemory = getMemoryUsage();
      const memoryCheckpoints = [];

      // Monitor memory growth over time
      for (let i = 0; i < 10; i++) {
        // Add batch of items
        for (let j = 0; j < 500; j++) {
          const key = `growth-test-${i}-${j}`;
          const value = MockDataFactory.createPipelineRunDetails();
          cacheService.set(key, value);
        }

        // Record memory usage
        const currentMemory = getMemoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        memoryCheckpoints.push(memoryIncrease);

        console.log(`Checkpoint ${i}: ${formatBytes(memoryIncrease)}`);

        // Advance time to trigger some cleanup
        clock.tick(10000);
      }

      // Check that memory growth is bounded
      const maxMemory = Math.max(...memoryCheckpoints);
      const finalMemory = memoryCheckpoints[memoryCheckpoints.length - 1];

      console.log(`Max memory: ${formatBytes(maxMemory)}, Final memory: ${formatBytes(finalMemory)}`);

      // Memory should not grow unbounded
      assert.ok(maxMemory < 150 * 1024 * 1024,
        `Memory growth exceeded bounds: ${formatBytes(maxMemory)}`);

      // Final memory should not be significantly higher than earlier checkpoints
      const averageMemory = memoryCheckpoints.reduce((a, b) => a + b, 0) / memoryCheckpoints.length;
      assert.ok(finalMemory < averageMemory * 1.5,
        'Memory growth pattern suggests potential leak');
    });
  });
});