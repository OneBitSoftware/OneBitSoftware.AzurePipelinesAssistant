import * as assert from 'assert';
import * as sinon from 'sinon';
import { AuthenticationError, NetworkError } from '../../../errors';
import { IApiClient, IAuthenticationService, ICacheService } from '../../../interfaces';
import { AzureDevOpsService } from '../../../services/azureDevOpsService';
import { MockDataFactory } from '../../fixtures/mockData';

suite('AzureDevOpsService Unit Tests', () => {
  let service: AzureDevOpsService;
  let mockApiClient: sinon.SinonStubbedInstance<IApiClient>;
  let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
  let mockCacheService: sinon.SinonStubbedInstance<ICacheService>;

  setup(() => {
    mockApiClient = {
      get: sinon.stub(),
      post: sinon.stub(),
      put: sinon.stub(),
      delete: sinon.stub(),
      patch: sinon.stub(),
      request: sinon.stub(),
      setAuthentication: sinon.stub(),
      getRateLimitInfo: sinon.stub(),
      setRetryOptions: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<IApiClient>;

    mockAuthService = {
      isAuthenticated: sinon.stub().returns(true) as sinon.SinonStub<[], boolean>,
      getCurrentOrganization: sinon.stub().returns('testorg') as sinon.SinonStub<[], string | null>,
      getStoredCredentials: sinon.stub(),
      validateCredentials: sinon.stub(),
      storeCredentials: sinon.stub(),
      clearCredentials: sinon.stub(),
      onAuthenticationChanged: sinon.stub()
    };

    mockCacheService = {
      get: sinon.stub(),
      set: sinon.stub(),
      invalidate: sinon.stub(),
      clear: sinon.stub(),
      getCachedProjects: sinon.stub(),
      setCachedProjects: sinon.stub(),
      getCachedPipelines: sinon.stub(),
      setCachedPipelines: sinon.stub(),
      getStats: sinon.stub(),
      getCachedPipelineRuns: sinon.stub(),
      setCachedPipelineRuns: sinon.stub(),
      invalidateProject: sinon.stub(),
      invalidatePipeline: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<ICacheService>;

    const config = { organization: 'testorg', personalAccessToken: 'testpat' };
    service = new AzureDevOpsService(mockApiClient, mockCacheService, config);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('getProjects', () => {
    test('should return cached projects when available', async () => {
      const mockProjects = MockDataFactory.createProjects(3);
      mockCacheService.getCachedProjects.returns(mockProjects);

      const result = await service.getProjects();

      assert.deepStrictEqual(result, mockProjects);
      assert.ok(mockCacheService.getCachedProjects.called);
      assert.ok(mockApiClient.get.notCalled);
    });

    test('should fetch from API when cache is empty', async () => {
      const mockProjects = MockDataFactory.createProjects(2);
      mockCacheService.getCachedProjects.returns(null);
      mockApiClient.get.resolves({ data: mockProjects, status: 200, statusText: 'OK', headers: {} });

      const result = await service.getProjects();

      assert.deepStrictEqual(result, mockProjects);
      assert.ok(mockApiClient.get.calledWith('/_apis/projects?api-version=7.0'));
      assert.ok(mockCacheService.setCachedProjects.calledWith(mockProjects));
    });

    test('should throw AuthenticationError when not authenticated', async () => {
      mockAuthService.isAuthenticated.returns(false);

      try {
        await service.getProjects();
        assert.fail('Expected AuthenticationError');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.message, 'Not authenticated');
      }
    });

    test('should handle API errors gracefully', async () => {
      mockCacheService.getCachedProjects.returns(null);
      mockApiClient.get.rejects(new NetworkError('API Error', 'SERVER_ERROR', 500));

      try {
        await service.getProjects();
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.message, 'API Error');
      }
    });
  });

  suite('getPipelines', () => {
    test('should return cached pipelines when available', async () => {
      const projectId = 'test-project';
      const mockPipelines = MockDataFactory.createPipelines(3);
      mockCacheService.getCachedPipelines.withArgs(projectId).returns(mockPipelines);

      const result = await service.getPipelines(projectId);

      assert.deepStrictEqual(result, mockPipelines);
      assert.ok(mockCacheService.getCachedPipelines.calledWith(projectId));
      assert.ok(mockApiClient.get.notCalled);
    });

    test('should fetch from API when cache is empty', async () => {
      const projectId = 'test-project';
      const mockPipelines = MockDataFactory.createPipelines(2);
      mockCacheService.getCachedPipelines.withArgs(projectId).returns(null);
      mockApiClient.get.resolves({ data: mockPipelines, status: 200, statusText: 'OK', headers: {} });

      const result = await service.getPipelines(projectId);

      assert.deepStrictEqual(result, mockPipelines);
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/definitions?api-version=7.0`));
      assert.ok(mockCacheService.setCachedPipelines.calledWith(projectId, mockPipelines));
    });

    test('should throw error for empty project ID', async () => {
      try {
        await service.getPipelines('');
        assert.fail('Expected error for empty project ID');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Project ID is required');
      }
    });
  });

  suite('getPipelineRuns', () => {
    test('should fetch pipeline runs from API', async () => {
      const pipelineId = 123;
      const projectId = 'test-project';
      const mockRuns = MockDataFactory.createPipelineRuns(5);
      mockApiClient.get.resolves({ data: mockRuns, status: 200, statusText: 'OK', headers: {} });

      const result = await service.getPipelineRuns(pipelineId, projectId);

      assert.deepStrictEqual(result, mockRuns);
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/builds?definitions=${pipelineId}&api-version=7.0&$top=50`));
    });

    test('should limit results based on configuration', async () => {
      const pipelineId = 123;
      const projectId = 'test-project';
      const maxRuns = 10;
      const mockRuns = MockDataFactory.createPipelineRuns(5);
      mockApiClient.get.resolves({ data: mockRuns, status: 200, statusText: 'OK', headers: {} });

      const result = await service.getPipelineRuns(pipelineId, projectId, maxRuns);

      assert.deepStrictEqual(result, mockRuns);
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/builds?definitions=${pipelineId}&api-version=7.0&$top=${maxRuns}`));
    });

    test('should handle invalid pipeline ID', async () => {
      try {
        await service.getPipelineRuns(0, 'test-project');
        assert.fail('Expected error for invalid pipeline ID');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Pipeline ID must be greater than 0');
      }
    });
  });

  suite('getRunDetails', () => {
    test('should fetch run details from API', async () => {
      const runId = 456;
      const pipelineId = 123;
      const projectId = 'test-project';
      const mockRunDetails = MockDataFactory.createPipelineRunDetails();

      // Mock multiple API calls for run details
      mockApiClient.get.onFirstCall().resolves({ data: mockRunDetails, status: 200, statusText: 'OK', headers: {} });
      mockApiClient.get.onSecondCall().resolves({ data: { records: mockRunDetails.timeline }, status: 200, statusText: 'OK', headers: {} });

      const result = await service.getRunDetails(runId, pipelineId, projectId);

      assert.deepStrictEqual(result.id, mockRunDetails.id);
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/builds/${runId}?api-version=7.0`));
    });

    test('should handle API errors for run details', async () => {
      const runId = 456;
      const pipelineId = 123;
      const projectId = 'test-project';

      mockApiClient.get.rejects(new NetworkError('Run not found', 'SERVER_ERROR', 404));

      try {
        await service.getRunDetails(runId, pipelineId, projectId);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });
  });

  suite('triggerPipelineRun', () => {
    test('should trigger pipeline run successfully', async () => {
      const pipelineId = 123;
      const projectId = 'test-project';
      const parameters = { sourceBranch: 'refs/heads/main' };
      const mockRun = MockDataFactory.createPipelineRun();

      mockApiClient.post.resolves({ data: mockRun, status: 200, statusText: 'OK', headers: {} });

      const result = await service.triggerPipelineRun(pipelineId, projectId, parameters);

      assert.deepStrictEqual(result, mockRun);
      assert.ok(mockApiClient.post.calledWith(
        `/${projectId}/_apis/build/builds?api-version=7.0`,
        {
          definition: { id: pipelineId },
          sourceBranch: parameters.sourceBranch
        }
      ));
    });

    test('should handle trigger errors', async () => {
      const pipelineId = 123;
      const projectId = 'test-project';
      const parameters = { sourceBranch: 'refs/heads/main' };

      mockApiClient.post.rejects(new NetworkError('Pipeline not found', 'SERVER_ERROR', 404));

      try {
        await service.triggerPipelineRun(pipelineId, projectId, parameters);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });
  });

  suite('cancelRun', () => {
    test('should cancel run successfully', async () => {
      const runId = 456;
      const pipelineId = 123;
      const projectId = 'test-project';

      mockApiClient.patch.resolves({ data: {}, status: 200, statusText: 'OK', headers: {} });

      await service.cancelRun(runId, pipelineId, projectId);

      assert.ok(mockApiClient.patch.calledWith(
        `/${projectId}/_apis/build/builds/${runId}?api-version=7.0`,
        { status: 'Cancelling' }
      ));
    });

    test('should handle cancel errors', async () => {
      const runId = 456;
      const pipelineId = 123;
      const projectId = 'test-project';

      mockApiClient.patch.rejects(new NetworkError('Cannot cancel completed run', 'SERVER_ERROR', 400));

      try {
        await service.cancelRun(runId, pipelineId, projectId);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 400);
      }
    });
  });

  suite('getRunLogs', () => {
    test('should fetch run logs successfully', async () => {
      const runId = 456;
      const projectId = 'test-project';
      const mockLogs = MockDataFactory.createLogEntries(10);

      mockApiClient.get.resolves({ data: mockLogs, status: 200, statusText: 'OK', headers: {} });

      const result = await service.getRunLogs(runId, projectId);

      assert.deepStrictEqual(result, mockLogs);
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/builds/${runId}/logs?api-version=7.0`));
    });

    test('should handle empty logs', async () => {
      const runId = 456;
      const projectId = 'test-project';

      mockApiClient.get.resolves({ data: [], status: 200, statusText: 'OK', headers: {} });

      const result = await service.getRunLogs(runId, projectId);

      assert.deepStrictEqual(result, []);
    });
  });

  suite('downloadArtifacts', () => {
    test('should download artifacts successfully', async () => {
      const runId = 456;
      const projectId = 'test-project';
      const pipelineId = 123;
      const downloadPath = '/tmp/artifacts';
      const mockBlob = new Blob(['test artifact data']);

      mockApiClient.get.resolves({ data: mockBlob, status: 200, statusText: 'OK', headers: {} });

      const result = await service.downloadArtifacts(runId, pipelineId, projectId, downloadPath);

      assert.strictEqual(result, mockBlob);
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/builds/${runId}/artifacts?api-version=7.0`));
    });

    test('should handle no artifacts available', async () => {
      const runId = 456;
      const projectId = 'test-project';
      const pipelineId = 123;
      const downloadPath = '/tmp/artifacts';

      mockApiClient.get.rejects(new NetworkError('No artifacts found', 'SERVER_ERROR', 404));

      try {
        await service.downloadArtifacts(runId, pipelineId, projectId, downloadPath);
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });
  });

  suite('clearCache', () => {
    test('should clear all caches', () => {
      service.clearCache();

      assert.ok(mockCacheService.clear.called);
    });
  });

  suite('refreshProject', () => {
    test('should invalidate project cache and refetch', async () => {
      const projectId = 'test-project';
      const mockPipelines = MockDataFactory.createPipelines(2);

      mockApiClient.get.resolves({ data: mockPipelines, status: 200, statusText: 'OK', headers: {} });

      await service.refreshProject(projectId);

      assert.ok(mockCacheService.invalidate.calledWith(`pipelines:${projectId}`));
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/definitions?api-version=7.0`));
    });
  });

  suite('refreshPipeline', () => {
    test('should invalidate pipeline cache and refetch runs', async () => {
      const pipelineId = 123;
      const projectId = 'test-project';
      const mockRuns = MockDataFactory.createPipelineRuns(3);

      mockApiClient.get.resolves({ data: mockRuns, status: 200, statusText: 'OK', headers: {} });

      await service.refreshPipeline(pipelineId, projectId);

      assert.ok(mockCacheService.invalidate.calledWith(`runs:${projectId}:${pipelineId}`));
      assert.ok(mockApiClient.get.calledWith(`/${projectId}/_apis/build/builds?definitions=${pipelineId}&api-version=7.0&$top=50`));
    });
  });
});