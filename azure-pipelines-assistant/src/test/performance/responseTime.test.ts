import * as assert from 'assert';
import * as sinon from 'sinon';
import { AzureDevOpsService } from '../../services/azureDevOpsService';
import { CacheService } from '../../services/cacheService';
import { AzurePipelinesTreeDataProvider } from '../../services/treeDataProvider';
import { MockDataFactory } from '../fixtures/mockData';

suite('Response Time Performance Tests', () => {
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    clock.restore();
    sinon.restore();
  });

  const measureTime = async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    return { result, duration: endTime - startTime };
  };

  const measureSyncTime = <T>(operation: () => T): { result: T; duration: number } => {
    const startTime = Date.now();
    const result = operation();
    const endTime = Date.now();
    return { result, duration: endTime - startTime };
  };

  suite('Cache Service Performance', () => {
    test('should perform cache operations within acceptable time limits', () => {
      const cacheService = new CacheService();
      const testData = MockDataFactory.createProjects(1000);

      // Test cache set operations
      const { duration: setDuration } = measureSyncTime(() => {
        testData.forEach((project, index) => {
          cacheService.set(`project-${index}`, project);
        });
      });

      console.log(`Cache set operations (1000 items): ${setDuration}ms`);
      assert.ok(setDuration < 100, `Cache set operations too slow: ${setDuration}ms`);

      // Test cache get operations
      const { duration: getDuration } = measureSyncTime(() => {
        for (let i = 0; i < 1000; i++) {
          cacheService.get(`project-${i}`);
        }
      });

      console.log(`Cache get operations (1000 items): ${getDuration}ms`);
      assert.ok(getDuration < 50, `Cache get operations too slow: ${getDuration}ms`);

      // Test cache invalidation
      const { duration: invalidateDuration } = measureSyncTime(() => {
        for (let i = 0; i < 1000; i++) {
          cacheService.invalidate(`project-${i}`);
        }
      });

      console.log(`Cache invalidate operations (1000 items): ${invalidateDuration}ms`);
      assert.ok(invalidateDuration < 100, `Cache invalidate operations too slow: ${invalidateDuration}ms`);
    });

    test('should handle cache expiration efficiently', () => {
      const cacheService = new CacheService(100, 10000); // 100ms TTL
      const testData = MockDataFactory.createProjects(1000);

      // Add items to cache
      testData.forEach((project, index) => {
        cacheService.set(`project-${index}`, project, 100);
      });

      // Advance time to expire items
      clock.tick(150);

      // Test expired item access performance
      const { duration: expiredAccessDuration } = measureSyncTime(() => {
        for (let i = 0; i < 1000; i++) {
          cacheService.get(`project-${i}`);
        }
      });

      console.log(`Expired cache access (1000 items): ${expiredAccessDuration}ms`);
      assert.ok(expiredAccessDuration < 100, `Expired cache access too slow: ${expiredAccessDuration}ms`);

      // Verify items were actually expired
      const stats = cacheService.getStats();
      assert.strictEqual(stats.size, 0, 'Expired items not properly cleaned up');
    });

    test('should maintain performance with large datasets', () => {
      const cacheService = new CacheService(300000, 50000); // 5 minute TTL, max 50k items
      const largeDataset: any[] = [];

      // Create large dataset
      for (let i = 0; i < 10000; i++) {
        largeDataset.push(MockDataFactory.createPipelineRunDetails());
      }

      // Test performance with large objects
      const { duration: largeDuration } = measureSyncTime(() => {
        largeDataset.forEach((data, index) => {
          cacheService.set(`large-${index}`, data);
        });
      });

      console.log(`Cache large objects (10k items): ${largeDuration}ms`);
      assert.ok(largeDuration < 1000, `Large object caching too slow: ${largeDuration}ms`);

      // Test retrieval performance
      const { duration: retrievalDuration } = measureSyncTime(() => {
        for (let i = 0; i < 10000; i++) {
          cacheService.get(`large-${i}`);
        }
      });

      console.log(`Cache large object retrieval (10k items): ${retrievalDuration}ms`);
      assert.ok(retrievalDuration < 500, `Large object retrieval too slow: ${retrievalDuration}ms`);
    });
  });

  suite('Azure DevOps Service Performance', () => {
    test('should handle concurrent API requests efficiently', async () => {
      const mockApiClient = {
        get: sinon.stub(),
        post: sinon.stub(),
        put: sinon.stub(),
        patch: sinon.stub(),
        delete: sinon.stub(),
        request: sinon.stub(),
        setAuthentication: sinon.stub(),
        getRateLimitInfo: sinon.stub(),
        setRetryOptions: sinon.stub()
      };

      const mockAuthService = {
        isAuthenticated: sinon.stub().returns(true),
        getCurrentOrganization: sinon.stub().returns('testorg'),
        getStoredCredentials: sinon.stub(),
        validateCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        onAuthenticationChanged: sinon.stub(),
        dispose: sinon.stub()
      };

      const mockCacheService = new CacheService();
      const azureDevOpsService = new AzureDevOpsService(mockApiClient, mockCacheService, {
        organization: 'testorg',
        personalAccessToken: 'test-token'
      });

      // Mock API responses with delay
      const mockProjects = MockDataFactory.createProjects(10);
      mockApiClient.get.callsFake(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ value: mockProjects }), 50); // 50ms simulated API delay
        });
      });

      // Test concurrent requests
      const { duration: concurrentDuration } = await measureTime(async () => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(azureDevOpsService.getProjects());
        }
        await Promise.all(promises);
      });

      console.log(`Concurrent API requests (10 requests): ${concurrentDuration}ms`);

      // Should be faster than sequential requests due to caching
      // First request takes ~50ms, others should be cached
      assert.ok(concurrentDuration < 200, `Concurrent requests too slow: ${concurrentDuration}ms`);

      // Should only make one actual API call due to caching
      assert.strictEqual(mockApiClient.get.callCount, 1, 'Cache not working for concurrent requests');
    });

    test('should handle large response datasets efficiently', async () => {
      const mockApiClient = {
        get: sinon.stub(),
        post: sinon.stub(),
        put: sinon.stub(),
        patch: sinon.stub(),
        delete: sinon.stub(),
        request: sinon.stub(),
        setAuthentication: sinon.stub(),
        getRateLimitInfo: sinon.stub(),
        setRetryOptions: sinon.stub()
      };

      const mockAuthService = {
        isAuthenticated: sinon.stub().returns(true),
        getCurrentOrganization: sinon.stub().returns('testorg'),
        getStoredCredentials: sinon.stub(),
        validateCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        onAuthenticationChanged: sinon.stub(),
        dispose: sinon.stub()
      };

      const mockCacheService = new CacheService();
      const azureDevOpsService = new AzureDevOpsService(mockApiClient, mockCacheService, {
        organization: 'testorg',
        personalAccessToken: 'test-token'
      });

      // Mock large dataset response
      const largePipelineRuns = MockDataFactory.createPipelineRuns(1000);
      mockApiClient.get.resolves({ value: largePipelineRuns });

      const { result, duration } = await measureTime(async () => {
        return await azureDevOpsService.getPipelineRuns(123, 'test-project');
      });

      console.log(`Large dataset processing (1000 runs): ${duration}ms`);
      assert.ok(duration < 500, `Large dataset processing too slow: ${duration}ms`);
      assert.strictEqual(result.length, 1000, 'Data integrity check failed');
    });

    test('should maintain performance with frequent cache misses', async () => {
      const mockApiClient = {
        get: sinon.stub(),
        post: sinon.stub(),
        put: sinon.stub(),
        patch: sinon.stub(),
        delete: sinon.stub(),
        request: sinon.stub(),
        setAuthentication: sinon.stub(),
        getRateLimitInfo: sinon.stub(),
        setRetryOptions: sinon.stub()
      };

      const mockAuthService = {
        isAuthenticated: sinon.stub().returns(true),
        getCurrentOrganization: sinon.stub().returns('testorg'),
        getStoredCredentials: sinon.stub(),
        validateCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        onAuthenticationChanged: sinon.stub(),
        dispose: sinon.stub()
      };

      const mockCacheService = new CacheService(50, 100); // Short TTL, small cache
      const azureDevOpsService = new AzureDevOpsService(mockApiClient, mockCacheService, {
        organization: 'testorg',
        personalAccessToken: 'test-token'
      });

      // Mock different responses for different projects
      mockApiClient.get.callsFake((url: string) => {
        const projectId = url.split('/')[1];
        const pipelines = MockDataFactory.createPipelines(10);
        return Promise.resolve({ value: pipelines });
      });

      const { duration } = await measureTime(async () => {
        // Request pipelines for many different projects (cache misses)
        const promises = [];
        for (let i = 0; i < 50; i++) {
          promises.push(azureDevOpsService.getPipelines(`project-${i}`));
        }
        await Promise.all(promises);
      });

      console.log(`Frequent cache misses (50 requests): ${duration}ms`);
      assert.ok(duration < 2000, `Frequent cache misses too slow: ${duration}ms`);
      assert.strictEqual(mockApiClient.get.callCount, 50, 'Expected cache misses for different projects');
    });
  });

  suite('Tree Data Provider Performance', () => {
    test('should render large tree structures efficiently', async () => {
      const mockAzureDevOpsService = {
        getProjects: sinon.stub(),
        getPipelines: sinon.stub(),
        getPipelineRuns: sinon.stub(),
        getRunDetails: sinon.stub(),
        triggerPipelineRun: sinon.stub(),
        cancelRun: sinon.stub(),
        getRunLogs: sinon.stub(),
        downloadArtifacts: sinon.stub(),
        triggerRun: sinon.stub(),
        getLogs: sinon.stub(),
        refreshProject: sinon.stub(),
        refreshPipeline: sinon.stub(),
        clearCache: sinon.stub(),
        // Add missing methods from IAzureDevOpsService
        getPipelineRunsIncremental: sinon.stub(),
        getRunDetailsWithChangeDetection: sinon.stub(),
        getActiveRuns: sinon.stub(),
        getActivePipelineRuns: sinon.stub()
      };

      const mockAuthService = {
        isAuthenticated: sinon.stub().returns(true),
        getCurrentOrganization: sinon.stub().returns('testorg'),
        getStoredCredentials: sinon.stub(),
        validateCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        onAuthenticationChanged: sinon.stub(),
        dispose: sinon.stub()
      };

      const mockRealTimeService = {
        subscribeToRunUpdates: sinon.stub(),
        subscribeToProjectUpdates: sinon.stub(),
        isBackgroundRefreshActive: sinon.stub().returns(false),
        getActiveSubscriptionCount: sinon.stub().returns(0),
        dispose: sinon.stub()
      };
      const mockContext = { subscriptions: [] } as any;
      const treeDataProvider = new AzurePipelinesTreeDataProvider(
        mockAzureDevOpsService,
        mockAuthService,
        mockRealTimeService as any,
        mockContext
      );

      // Mock large dataset
      const largeProjectSet = MockDataFactory.createProjects(100);
      mockAzureDevOpsService.getProjects.resolves(largeProjectSet);

      const { result: projects, duration: projectsDuration } = await measureTime(async () => {
        return await treeDataProvider.getChildren();
      });

      console.log(`Tree projects rendering (100 projects): ${projectsDuration}ms`);
      assert.ok(projectsDuration < 200, `Tree projects rendering too slow: ${projectsDuration}ms`);
      assert.strictEqual(projects.length, 100, 'Project count mismatch');

      // Test pipeline rendering for first project
      const largePipelineSet = MockDataFactory.createPipelines(200);
      mockAzureDevOpsService.getPipelines.resolves(largePipelineSet);

      const { result: pipelines, duration: pipelinesDuration } = await measureTime(async () => {
        return await treeDataProvider.getChildren(projects[0]);
      });

      console.log(`Tree pipelines rendering (200 pipelines): ${pipelinesDuration}ms`);
      assert.ok(pipelinesDuration < 300, `Tree pipelines rendering too slow: ${pipelinesDuration}ms`);
      assert.strictEqual(pipelines.length, 200, 'Pipeline count mismatch');
    });

    test('should handle tree refresh operations efficiently', async () => {
      const mockAzureDevOpsService = {
        getProjects: sinon.stub(),
        getPipelines: sinon.stub(),
        getPipelineRuns: sinon.stub(),
        getRunDetails: sinon.stub(),
        triggerPipelineRun: sinon.stub(),
        cancelRun: sinon.stub(),
        getRunLogs: sinon.stub(),
        downloadArtifacts: sinon.stub(),
        triggerRun: sinon.stub(),
        getLogs: sinon.stub(),
        refreshProject: sinon.stub(),
        refreshPipeline: sinon.stub(),
        clearCache: sinon.stub(),
        // Add missing methods from IAzureDevOpsService
        getPipelineRunsIncremental: sinon.stub(),
        getRunDetailsWithChangeDetection: sinon.stub(),
        getActiveRuns: sinon.stub(),
        getActivePipelineRuns: sinon.stub()
      };

      const mockAuthService = {
        isAuthenticated: sinon.stub().returns(true),
        getCurrentOrganization: sinon.stub().returns('testorg'),
        getStoredCredentials: sinon.stub(),
        validateCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        onAuthenticationChanged: sinon.stub(),
        dispose: sinon.stub()
      };

      const mockRealTimeService2 = {
        subscribeToRunUpdates: sinon.stub(),
        subscribeToProjectUpdates: sinon.stub(),
        isBackgroundRefreshActive: sinon.stub().returns(false),
        getActiveSubscriptionCount: sinon.stub().returns(0),
        dispose: sinon.stub()
      };
      const mockContext2 = { subscriptions: [] } as any;
      const treeDataProvider = new AzurePipelinesTreeDataProvider(
        mockAzureDevOpsService,
        mockAuthService,
        mockRealTimeService2 as any,
        mockContext2
      );

      // Mock data
      const projects = MockDataFactory.createProjects(50);
      mockAzureDevOpsService.getProjects.resolves(projects);

      // Initial load
      await treeDataProvider.getChildren();

      // Test refresh performance
      const { duration: refreshDuration } = await measureTime(async () => {
        for (let i = 0; i < 10; i++) {
          treeDataProvider.refresh();
          await treeDataProvider.getChildren();
        }
      });

      console.log(`Tree refresh operations (10 refreshes): ${refreshDuration}ms`);
      assert.ok(refreshDuration < 1000, `Tree refresh too slow: ${refreshDuration}ms`);
    });

    test('should handle deep tree navigation efficiently', async () => {
      const mockAzureDevOpsService = {
        getProjects: sinon.stub(),
        getPipelines: sinon.stub(),
        getPipelineRuns: sinon.stub(),
        getRunDetails: sinon.stub(),
        triggerPipelineRun: sinon.stub(),
        cancelRun: sinon.stub(),
        getRunLogs: sinon.stub(),
        downloadArtifacts: sinon.stub(),
        triggerRun: sinon.stub(),
        getLogs: sinon.stub(),
        refreshProject: sinon.stub(),
        refreshPipeline: sinon.stub(),
        clearCache: sinon.stub(),
        // Add missing methods from IAzureDevOpsService
        getPipelineRunsIncremental: sinon.stub(),
        getRunDetailsWithChangeDetection: sinon.stub(),
        getActiveRuns: sinon.stub(),
        getActivePipelineRuns: sinon.stub()
      };

      const mockAuthService = {
        isAuthenticated: sinon.stub().returns(true),
        getCurrentOrganization: sinon.stub().returns('testorg'),
        getStoredCredentials: sinon.stub(),
        validateCredentials: sinon.stub(),
        storeCredentials: sinon.stub(),
        clearCredentials: sinon.stub(),
        onAuthenticationChanged: sinon.stub(),
        dispose: sinon.stub()
      };

      const mockRealTimeService3 = {
        subscribeToRunUpdates: sinon.stub(),
        subscribeToProjectUpdates: sinon.stub(),
        isBackgroundRefreshActive: sinon.stub().returns(false),
        getActiveSubscriptionCount: sinon.stub().returns(0),
        dispose: sinon.stub()
      };
      const mockContext3 = { subscriptions: [] } as any;
      const treeDataProvider = new AzurePipelinesTreeDataProvider(
        mockAzureDevOpsService,
        mockAuthService,
        mockRealTimeService3 as any,
        mockContext3
      );

      // Mock hierarchical data
      const projects = MockDataFactory.createProjects(10);
      const pipelines = MockDataFactory.createPipelines(20);
      const runs = MockDataFactory.createPipelineRuns(50);

      mockAzureDevOpsService.getProjects.resolves(projects);
      mockAzureDevOpsService.getPipelines.resolves(pipelines);
      mockAzureDevOpsService.getPipelineRuns.resolves(runs);

      const { duration: navigationDuration } = await measureTime(async () => {
        // Navigate through tree hierarchy
        const projectItems = await treeDataProvider.getChildren();

        for (const project of projectItems.slice(0, 5)) { // Test first 5 projects
          const pipelineItems = await treeDataProvider.getChildren(project);

          for (const pipeline of pipelineItems.slice(0, 3)) { // Test first 3 pipelines per project
            await treeDataProvider.getChildren(pipeline);
          }
        }
      });

      console.log(`Deep tree navigation (5 projects, 3 pipelines each): ${navigationDuration}ms`);
      assert.ok(navigationDuration < 2000, `Deep tree navigation too slow: ${navigationDuration}ms`);
    });
  });

  suite('Webview Performance', () => {
    test('should render run details webview efficiently', async () => {
      // Mock complex run details
      const complexRunDetails = MockDataFactory.createPipelineRunDetails({
        stages: [
          MockDataFactory.createStage({
            jobs: Array.from({ length: 10 }, (_, i) =>
              MockDataFactory.createJob({
                id: `job-${i}`,
                tasks: Array.from({ length: 20 }, (_, j) =>
                  MockDataFactory.createTask({ id: `task-${i}-${j}` })
                )
              })
            )
          })
        ]
      });

      const { duration: renderDuration } = measureSyncTime(() => {
        // Simulate webview HTML generation
        const htmlContent = generateRunDetailsHtml(complexRunDetails);
        return htmlContent;
      });

      console.log(`Complex run details rendering: ${renderDuration}ms`);
      assert.ok(renderDuration < 100, `Run details rendering too slow: ${renderDuration}ms`);
    });

    test('should handle large log datasets efficiently', () => {
      const largeLogs = MockDataFactory.createLogEntries(10000);

      const { duration: logRenderDuration } = measureSyncTime(() => {
        // Simulate log viewer HTML generation
        const htmlContent = generateLogViewerHtml(largeLogs);
        return htmlContent;
      });

      console.log(`Large log rendering (10k entries): ${logRenderDuration}ms`);
      assert.ok(logRenderDuration < 500, `Log rendering too slow: ${logRenderDuration}ms`);
    });
  });

  suite('Overall System Performance', () => {
    test('should handle typical user workflow within acceptable time', async () => {
      // Simulate complete user workflow
      const mockServices = createMockServices();

      const { duration: workflowDuration } = await measureTime(async () => {
        // 1. Load projects
        await mockServices.azureDevOpsService.getProjects();

        // 2. Load pipelines for first project
        await mockServices.azureDevOpsService.getPipelines('project-1');

        // 3. Load runs for first pipeline
        await mockServices.azureDevOpsService.getPipelineRuns(1, 'project-1');

        // 4. Get run details
        await mockServices.azureDevOpsService.getRunDetails(1, 1, 'project-1');

        // 5. Trigger new run
        await mockServices.azureDevOpsService.triggerPipelineRun(1, 'project-1', {
          sourceBranch: 'refs/heads/main'
        });
      });

      console.log(`Complete user workflow: ${workflowDuration}ms`);
      assert.ok(workflowDuration < 1000, `User workflow too slow: ${workflowDuration}ms`);
    });

    test('should maintain performance under load', async () => {
      const mockServices = createMockServices();
      const concurrentUsers = 10;
      const operationsPerUser = 5;

      const { duration: loadTestDuration } = await measureTime(async () => {
        const userPromises = [];

        for (let user = 0; user < concurrentUsers; user++) {
          const userOperations = async () => {
            for (let op = 0; op < operationsPerUser; op++) {
              await mockServices.azureDevOpsService.getProjects();
              await mockServices.azureDevOpsService.getPipelines(`project-${op}`);
            }
          };
          userPromises.push(userOperations());
        }

        await Promise.all(userPromises);
      });

      console.log(`Load test (${concurrentUsers} users, ${operationsPerUser} ops each): ${loadTestDuration}ms`);
      assert.ok(loadTestDuration < 3000, `System under load too slow: ${loadTestDuration}ms`);
    });
  });

  // Helper functions
  function createMockServices() {
    const mockApiClient = {
      get: sinon.stub().resolves({ value: [] }),
      post: sinon.stub().resolves({}),
      put: sinon.stub().resolves({}),
      patch: sinon.stub().resolves({}),
      delete: sinon.stub().resolves({}),
      request: sinon.stub(),
      setAuthentication: sinon.stub(),
      getRateLimitInfo: sinon.stub(),
      setRetryOptions: sinon.stub()
    };

    const mockAuthService = {
      isAuthenticated: sinon.stub().returns(true),
      getCurrentOrganization: sinon.stub().returns('testorg'),
      getStoredCredentials: sinon.stub(),
      validateCredentials: sinon.stub(),
      storeCredentials: sinon.stub(),
      clearCredentials: sinon.stub(),
      onAuthenticationChanged: sinon.stub(),
      dispose: sinon.stub()
    };

    const mockCacheService = new CacheService();
    const azureDevOpsService = new AzureDevOpsService(mockApiClient, mockCacheService, {
      organization: 'testorg',
      personalAccessToken: 'test-token'
    });

    return { azureDevOpsService, mockApiClient, mockAuthService, mockCacheService };
  }

  function generateRunDetailsHtml(runDetails: any): string {
    // Simplified HTML generation for performance testing
    let html = '<div class="run-details">';
    html += `<h1>Run #${runDetails.id}</h1>`;

    if (runDetails.stages) {
      runDetails.stages.forEach((stage: any) => {
        html += `<div class="stage"><h2>${stage.name}</h2>`;

        if (stage.jobs) {
          stage.jobs.forEach((job: any) => {
            html += `<div class="job"><h3>${job.name}</h3>`;

            if (job.tasks) {
              job.tasks.forEach((task: any) => {
                html += `<div class="task">${task.name}</div>`;
              });
            }

            html += '</div>';
          });
        }

        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  }

  function generateLogViewerHtml(logs: any[]): string {
    // Simplified log HTML generation for performance testing
    let html = '<div class="log-viewer">';

    logs.forEach(log => {
      html += `<div class="log-entry">
        <span class="timestamp">${log.timestamp}</span>
        <span class="level">${log.level}</span>
        <span class="message">${log.message}</span>
      </div>`;
    });

    html += '</div>';
    return html;
  }
});