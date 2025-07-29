import * as assert from 'assert';
import * as sinon from 'sinon';
import { AuthenticationError, NetworkError } from '../../errors';
import { AzureDevOpsApiClient } from '../../services/apiClient';
import { AuthenticationService } from '../../services/authenticationService';
import { AzureDevOpsService } from '../../services/azureDevOpsService';
import { CacheService } from '../../services/cacheService';
import { MockDataFactory } from '../fixtures/mockData';

suite('Azure DevOps API Integration Tests', () => {
  let azureDevOpsService: AzureDevOpsService;
  let apiClient: AzureDevOpsApiClient;
  let authService: AuthenticationService;
  let cacheService: CacheService;
  let mockContext: any;

  // Test configuration - these would normally come from environment variables
  const testConfig = {
    organization: 'test-org',
    pat: 'test-pat-token',
    projectId: 'test-project-id',
    pipelineId: 123
  };

  setup(() => {
    // Create mock VS Code context
    mockContext = {
      secrets: {
        get: sinon.stub(),
        store: sinon.stub(),
        delete: sinon.stub()
      },
      subscriptions: []
    };

    // Create real services for integration testing
    authService = new AuthenticationService(mockContext);
    cacheService = new CacheService();
    apiClient = new AzureDevOpsApiClient();
    const config = { organization: testConfig.organization, personalAccessToken: testConfig.pat };
    azureDevOpsService = new AzureDevOpsService(apiClient, cacheService, config);

    // Mock authentication
    sinon.stub(authService, 'isAuthenticated').returns(true);
    sinon.stub(authService, 'getCurrentOrganization').returns(testConfig.organization);
    sinon.stub(authService, 'getStoredCredentials').resolves({
      organization: testConfig.organization,
      personalAccessToken: testConfig.pat
    });
  });

  teardown(() => {
    sinon.restore();
    cacheService.clear();
  });

  suite('Projects API Integration', () => {
    test('should fetch projects from API and cache results', async () => {
      // Mock successful API response
      const mockProjects = MockDataFactory.createProjects(3);
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockProjects }, status: 200, statusText: 'OK', headers: {} });

      // First call should hit API
      const result1 = await azureDevOpsService.getProjects();
      assert.deepStrictEqual(result1, mockProjects);
      assert.ok(apiStub.calledOnce);

      // Second call should use cache
      const result2 = await azureDevOpsService.getProjects();
      assert.deepStrictEqual(result2, mockProjects);
      assert.ok(apiStub.calledOnce); // Still only called once
    });

    test('should handle API errors gracefully', async () => {
      const apiStub = sinon.stub(apiClient, 'get').rejects(new NetworkError('API Error', 'SERVER_ERROR', 500));

      try {
        await azureDevOpsService.getProjects();
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 500);
      }
    });

    test('should handle authentication errors', async () => {
      const apiStub = sinon.stub(apiClient, 'get').rejects(new AuthenticationError('Unauthorized', 'INVALID_PAT'));

      try {
        await azureDevOpsService.getProjects();
        assert.fail('Expected AuthenticationError');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'INVALID_PAT');
      }
    });
  });

  suite('Pipelines API Integration', () => {
    test('should fetch pipelines for project', async () => {
      const mockPipelines = MockDataFactory.createPipelines(5);
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockPipelines }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getPipelines(testConfig.projectId);

      assert.deepStrictEqual(result, mockPipelines);
      assert.ok(apiStub.calledWith(`/${testConfig.projectId}/_apis/build/definitions?api-version=7.0`));
    });

    test('should cache pipeline results per project', async () => {
      const mockPipelines1 = MockDataFactory.createPipelines(3);
      const mockPipelines2 = MockDataFactory.createPipelines(2);

      const apiStub = sinon.stub(apiClient, 'get');
      apiStub.onFirstCall().resolves({ data: { value: mockPipelines1 }, status: 200, statusText: 'OK', headers: {} });
      apiStub.onSecondCall().resolves({ data: { value: mockPipelines2 }, status: 200, statusText: 'OK', headers: {} });

      // Fetch pipelines for first project
      const result1 = await azureDevOpsService.getPipelines('project1');
      assert.deepStrictEqual(result1, mockPipelines1);

      // Fetch pipelines for second project
      const result2 = await azureDevOpsService.getPipelines('project2');
      assert.deepStrictEqual(result2, mockPipelines2);

      // Fetch pipelines for first project again (should use cache)
      const result3 = await azureDevOpsService.getPipelines('project1');
      assert.deepStrictEqual(result3, mockPipelines1);

      assert.strictEqual(apiStub.callCount, 2); // Only called twice, not three times
    });

    test('should handle empty pipeline results', async () => {
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: [] }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getPipelines(testConfig.projectId);

      assert.deepStrictEqual(result, []);
    });
  });

  suite('Pipeline Runs API Integration', () => {
    test('should fetch pipeline runs', async () => {
      const mockRuns = MockDataFactory.createPipelineRuns(10);
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockRuns }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getPipelineRuns(testConfig.pipelineId, testConfig.projectId);

      assert.deepStrictEqual(result, mockRuns);
      assert.ok(apiStub.calledWith(`/${testConfig.projectId}/_apis/build/builds?definitions=${testConfig.pipelineId}&api-version=7.0&$top=50`));
    });

    test('should respect maxRuns parameter', async () => {
      const mockRuns = MockDataFactory.createPipelineRuns(5);
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockRuns }, status: 200, statusText: 'OK', headers: {} });
      const maxRuns = 20;

      const result = await azureDevOpsService.getPipelineRuns(testConfig.pipelineId, testConfig.projectId, maxRuns);

      assert.deepStrictEqual(result, mockRuns);
      assert.ok(apiStub.calledWith(`/${testConfig.projectId}/_apis/build/builds?definitions=${testConfig.pipelineId}&api-version=7.0&$top=${maxRuns}`));
    });

    test('should handle runs with different states', async () => {
      const mockRuns = [
        MockDataFactory.createPipelineRun({ state: 'completed', result: 'succeeded' }),
        MockDataFactory.createInProgressPipelineRun(),
        MockDataFactory.createFailedPipelineRun(),
        MockDataFactory.createCancelledPipelineRun()
      ];

      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockRuns }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getPipelineRuns(testConfig.pipelineId, testConfig.projectId);

      assert.strictEqual(result.length, 4);
      assert.strictEqual(result[0].result, 'succeeded');
      assert.strictEqual(result[1].state, 'inProgress');
      assert.strictEqual(result[2].result, 'failed');
      assert.strictEqual(result[3].result, 'canceled');
    });
  });

  suite('Run Details API Integration', () => {
    test('should fetch detailed run information', async () => {
      const runId = 456;
      const mockRunDetails = MockDataFactory.createPipelineRunDetails({ id: runId });

      const apiStub = sinon.stub(apiClient, 'get');
      apiStub.onFirstCall().resolves({ data: mockRunDetails, status: 200, statusText: 'OK', headers: {} });
      apiStub.onSecondCall().resolves({ data: { records: mockRunDetails.timeline }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getRunDetails(runId, testConfig.pipelineId, testConfig.projectId);

      assert.strictEqual(result.id, runId);
      assert.ok(result.stages);
      assert.ok(result.timeline);
      assert.ok(apiStub.calledWith(`/${testConfig.projectId}/_apis/build/builds/${runId}?api-version=7.0`));
    });

    test('should handle run details with complex stage hierarchy', async () => {
      const runId = 456;
      const mockRunDetails = MockDataFactory.createPipelineRunDetails({
        id: runId,
        stages: [
          MockDataFactory.createStage({
            id: 'build',
            name: 'Build',
            jobs: [
              MockDataFactory.createJob({
                id: 'build-job',
                tasks: [
                  MockDataFactory.createTask({ id: 'task1', name: 'Checkout' }),
                  MockDataFactory.createTask({ id: 'task2', name: 'Build' }),
                  MockDataFactory.createTask({ id: 'task3', name: 'Test' })
                ]
              })
            ]
          }),
          MockDataFactory.createStage({
            id: 'deploy',
            name: 'Deploy',
            dependsOn: ['build'],
            jobs: [
              MockDataFactory.createJob({
                id: 'deploy-job',
                tasks: [
                  MockDataFactory.createTask({ id: 'task4', name: 'Deploy to Staging' }),
                  MockDataFactory.createTask({ id: 'task5', name: 'Deploy to Production' })
                ]
              })
            ]
          })
        ]
      });

      const apiStub = sinon.stub(apiClient, 'get');
      apiStub.onFirstCall().resolves({ data: mockRunDetails, status: 200, statusText: 'OK', headers: {} });
      apiStub.onSecondCall().resolves({ data: { records: mockRunDetails.timeline }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getRunDetails(runId, testConfig.pipelineId, testConfig.projectId);

      assert.strictEqual(result.stages.length, 2);
      assert.strictEqual(result.stages[0].jobs[0].tasks.length, 3);
      assert.strictEqual(result.stages[1].jobs[0].tasks.length, 2);
      assert.deepStrictEqual(result.stages[1].dependsOn, ['build']);
    });
  });

  suite('Pipeline Triggering Integration', () => {
    test('should trigger pipeline run successfully', async () => {
      const mockTriggeredRun = MockDataFactory.createInProgressPipelineRun();
      const apiStub = sinon.stub(apiClient, 'post').resolves({ data: mockTriggeredRun, status: 200, statusText: 'OK', headers: {} });

      const parameters = {
        sourceBranch: 'refs/heads/feature/test',
        variables: { BuildConfiguration: 'Release' }
      };

      const result = await azureDevOpsService.triggerPipelineRun(testConfig.pipelineId, testConfig.projectId, parameters);

      assert.deepStrictEqual(result, mockTriggeredRun);
      assert.ok(apiStub.calledWith(
        `/${testConfig.projectId}/_apis/build/builds?api-version=7.0`,
        {
          definition: { id: testConfig.pipelineId },
          sourceBranch: parameters.sourceBranch,
          parameters: JSON.stringify(parameters.variables)
        }
      ));
    });

    test('should handle trigger failures', async () => {
      const apiStub = sinon.stub(apiClient, 'post').rejects(new NetworkError('Pipeline not found', 'SERVER_ERROR', 404));

      const parameters = { sourceBranch: 'refs/heads/main' };

      try {
        await azureDevOpsService.triggerPipelineRun(testConfig.pipelineId, testConfig.projectId, parameters);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });
  });

  suite('Run Cancellation Integration', () => {
    test('should cancel running pipeline', async () => {
      const runId = 789;
      const apiStub = sinon.stub(apiClient, 'patch').resolves({ data: {}, status: 200, statusText: 'OK', headers: {} });

      await azureDevOpsService.cancelRun(runId, testConfig.pipelineId, testConfig.projectId);

      assert.ok(apiStub.calledWith(
        `/${testConfig.projectId}/_apis/build/builds/${runId}?api-version=7.0`,
        { status: 'Cancelling' }
      ));
    });

    test('should handle cancellation of completed runs', async () => {
      const runId = 789;
      const apiStub = sinon.stub(apiClient, 'patch').rejects(new NetworkError('Cannot cancel completed build', 'SERVER_ERROR', 400));

      try {
        await azureDevOpsService.cancelRun(runId, testConfig.pipelineId, testConfig.projectId);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 400);
      }
    });
  });

  suite('Logs API Integration', () => {
    test('should fetch run logs', async () => {
      const runId = 456;
      const mockLogs = MockDataFactory.createLogEntries(50);
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockLogs }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getRunLogs(runId, testConfig.projectId);

      assert.deepStrictEqual(result, mockLogs);
      assert.ok(apiStub.calledWith(`/${testConfig.projectId}/_apis/build/builds/${runId}/logs?api-version=7.0`));
    });

    test('should handle runs with no logs', async () => {
      const runId = 456;
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: [] }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getRunLogs(runId, testConfig.projectId);

      assert.deepStrictEqual(result, []);
    });
  });

  suite('Artifacts API Integration', () => {
    test('should download artifacts', async () => {
      const runId = 456;
      const pipelineId = testConfig.pipelineId;
      const downloadPath = '/tmp/artifacts';
      const mockArtifactData = new Blob(['test artifact content'], { type: 'application/zip' });
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: mockArtifactData, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.downloadArtifacts(runId, pipelineId, testConfig.projectId, downloadPath);

      assert.strictEqual(result, downloadPath);
      assert.ok(apiStub.calledWith(`https://dev.azure.com/${testConfig.organization}/${testConfig.projectId}/_apis/build/builds/${runId}/artifacts?api-version=7.0`));
    });

    test('should handle runs with no artifacts', async () => {
      const runId = 456;
      const pipelineId = testConfig.pipelineId;
      const downloadPath = '/tmp/artifacts';
      const apiStub = sinon.stub(apiClient, 'get').rejects(new NetworkError('No artifacts found', 'SERVER_ERROR', 404));

      try {
        await azureDevOpsService.downloadArtifacts(runId, pipelineId, testConfig.projectId, downloadPath);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });
  });

  suite('Cache Integration', () => {
    test('should invalidate cache on refresh operations', async () => {
      const mockProjects = MockDataFactory.createProjects(2);
      const mockPipelines = MockDataFactory.createPipelines(3);

      const apiStub = sinon.stub(apiClient, 'get');
      apiStub.onFirstCall().resolves({ data: { value: mockProjects }, status: 200, statusText: 'OK', headers: {} });
      apiStub.onSecondCall().resolves({ data: { value: mockPipelines }, status: 200, statusText: 'OK', headers: {} });
      apiStub.onThirdCall().resolves({ data: { value: mockPipelines }, status: 200, statusText: 'OK', headers: {} });

      // Initial fetch - should cache
      await azureDevOpsService.getProjects();
      await azureDevOpsService.getPipelines(testConfig.projectId);

      // Refresh project - should invalidate cache and refetch
      await azureDevOpsService.refreshProject(testConfig.projectId);

      // Verify API was called again
      assert.strictEqual(apiStub.callCount, 3);
    });

    test('should handle concurrent requests efficiently', async () => {
      const mockProjects = MockDataFactory.createProjects(3);
      const apiStub = sinon.stub(apiClient, 'get').resolves({ data: { value: mockProjects }, status: 200, statusText: 'OK', headers: {} });

      // Make multiple concurrent requests
      const promises = [
        azureDevOpsService.getProjects(),
        azureDevOpsService.getProjects(),
        azureDevOpsService.getProjects()
      ];

      const results = await Promise.all(promises);

      // All should return same data
      results.forEach(result => {
        assert.deepStrictEqual(result, mockProjects);
      });

      // But API should only be called once due to caching
      assert.strictEqual(apiStub.callCount, 1);
    });
  });

  suite('Error Recovery Integration', () => {
    test('should retry on transient failures', async () => {
      const mockProjects = MockDataFactory.createProjects(2);
      const apiStub = sinon.stub(apiClient, 'get');

      // First call fails with 429 (rate limit), second succeeds
      apiStub.onFirstCall().rejects(new NetworkError('Rate limit exceeded', 'RATE_LIMITED', 429));
      apiStub.onSecondCall().resolves({ data: { value: mockProjects }, status: 200, statusText: 'OK', headers: {} });

      const result = await azureDevOpsService.getProjects();

      assert.deepStrictEqual(result, mockProjects);
      assert.strictEqual(apiStub.callCount, 2);
    });

    test('should fail after max retries', async () => {
      const apiStub = sinon.stub(apiClient, 'get').rejects(new NetworkError('Server error', 'SERVER_ERROR', 500));

      try {
        await azureDevOpsService.getProjects();
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 500);
        // Should have retried multiple times
        assert.ok(apiStub.callCount > 1);
      }
    });
  });
});