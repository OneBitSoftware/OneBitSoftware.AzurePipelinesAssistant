import * as assert from 'assert';
import * as sinon from 'sinon';
import { AzureDevOpsService } from '../../services/azureDevOpsService';
import { CacheService } from '../../services/cacheService';
import { IApiClient, ApiResponse } from '../../interfaces/apiClient';
import { Project, Pipeline, PipelineRun } from '../../models';

describe('AzureDevOpsService', () => {
    let azureDevOpsService: AzureDevOpsService;
    let mockApiClient: sinon.SinonStubbedInstance<IApiClient>;
    let mockCacheService: sinon.SinonStubbedInstance<CacheService>;

    const mockConfig = {
        organization: 'test-org',
        personalAccessToken: 'test-pat',
        cacheEnabled: true
    };

    // Helper function to create mock API responses
    const createMockApiResponse = <T>(data: T): ApiResponse<T> => ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {}
    });

    beforeEach(() => {
        mockApiClient = {
            get: sinon.stub() as any,
            post: sinon.stub() as any,
            put: sinon.stub() as any,
            patch: sinon.stub() as any,
            delete: sinon.stub() as any,
            request: sinon.stub() as any,
            setAuthentication: sinon.stub(),
            getRateLimitInfo: sinon.stub(),
            setRetryOptions: sinon.stub()
        };

        mockCacheService = sinon.createStubInstance(CacheService);

        azureDevOpsService = new AzureDevOpsService(
            mockApiClient as any,
            mockCacheService as any,
            mockConfig
        );
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getProjects', () => {
        const mockProjectsResponse = {
            value: [
                {
                    id: 'project1',
                    name: 'Test Project 1',
                    description: 'Test Description 1',
                    url: 'https://dev.azure.com/test-org/project1',
                    state: 'wellFormed',
                    visibility: 'private'
                },
                {
                    id: 'project2',
                    name: 'Test Project 2',
                    url: 'https://dev.azure.com/test-org/project2',
                    state: 'wellFormed',
                    visibility: 'public'
                }
            ]
        };

        it('should return cached projects when available', async () => {
            const cachedProjects: Project[] = [
                {
                    id: 'project1',
                    name: 'Cached Project',
                    url: 'https://dev.azure.com/test-org/project1',
                    state: 'wellFormed',
                    visibility: 'private'
                }
            ];

            mockCacheService.getCachedProjects.returns(cachedProjects);

            const result = await azureDevOpsService.getProjects();

            assert.deepStrictEqual(result, cachedProjects);
            assert.ok(mockCacheService.getCachedProjects.calledOnce);
            assert.ok(mockApiClient.get.notCalled);
        });

        it('should fetch projects from API when not cached', async () => {
            mockCacheService.getCachedProjects.returns(null);
            mockApiClient.get.resolves(createMockApiResponse(mockProjectsResponse));

            const result = await azureDevOpsService.getProjects();

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].id, 'project1');
            assert.strictEqual(result[0].name, 'Test Project 1');
            assert.strictEqual(result[1].id, 'project2');
            assert.strictEqual(result[1].name, 'Test Project 2');

            assert.ok(mockApiClient.get.calledOnce);
            assert.ok(mockCacheService.setCachedProjects.calledOnce);
        });

        it('should handle API errors gracefully', async () => {
            mockCacheService.getCachedProjects.returns(null);
            mockApiClient.get.rejects(new Error('Network error'));

            await assert.rejects(
                azureDevOpsService.getProjects(),
                /Failed to fetch projects: Network error/
            );
        });
    });

    describe('getPipelines', () => {
        const mockPipelinesResponse = {
            value: [
                { id: 1, name: 'Pipeline 1' }
            ]
        };

        const mockPipelineDetailResponse = {
            id: 1,
            name: 'Pipeline 1',
            revision: 1,
            url: 'https://dev.azure.com/test-org/project1/_build?definitionId=1',
            configuration: {
                type: 'yaml',
                path: 'azure-pipelines.yml',
                repository: {
                    id: 'repo1',
                    name: 'test-repo',
                    url: 'https://dev.azure.com/test-org/project1/_git/test-repo',
                    type: 'TfsGit',
                    defaultBranch: 'main'
                }
            }
        };

        beforeEach(() => {
            // Mock getProjects to return a project
            const mockProject: Project = {
                id: 'project1',
                name: 'Test Project',
                url: 'https://dev.azure.com/test-org/project1',
                state: 'wellFormed',
                visibility: 'private'
            };
            mockCacheService.getCachedProjects.returns([mockProject]);
        });

        it('should return cached pipelines when available', async () => {
            const cachedPipelines: Pipeline[] = [
                {
                    id: 1,
                    name: 'Cached Pipeline',
                    project: {} as Project,
                    revision: 1,
                    url: 'https://dev.azure.com/test-org/project1/_build?definitionId=1',
                    configuration: {
                        type: 'yaml',
                        path: 'azure-pipelines.yml',
                        repository: {
                            id: 'repo1',
                            name: 'test-repo',
                            url: 'https://dev.azure.com/test-org/project1/_git/test-repo',
                            type: 'TfsGit',
                            defaultBranch: 'main'
                        }
                    }
                }
            ];

            mockCacheService.getCachedPipelines.returns(cachedPipelines);

            const result = await azureDevOpsService.getPipelines('project1');

            assert.deepStrictEqual(result, cachedPipelines);
            assert.ok(mockCacheService.getCachedPipelines.calledWith('project1'));
            assert.ok(mockApiClient.get.notCalled);
        });

        it('should fetch pipelines from API when not cached', async () => {
            mockCacheService.getCachedPipelines.returns(null);
            mockApiClient.get.onFirstCall().resolves(createMockApiResponse(mockPipelinesResponse));
            mockApiClient.get.onSecondCall().resolves(createMockApiResponse(mockPipelineDetailResponse));

            const result = await azureDevOpsService.getPipelines('project1');

            assert.strictEqual(result.length, 1); // Only one pipeline detail response
            assert.strictEqual(result[0].id, 1);
            assert.strictEqual(result[0].name, 'Pipeline 1');

            assert.ok(mockApiClient.get.calledTwice); // Once for list, once for details
            assert.ok(mockCacheService.setCachedPipelines.calledWith('project1', result));
        });
    });

    describe('getPipelineRuns', () => {
        const mockRunsResponse = {
            value: [
                {
                    id: 1,
                    name: 'Run 1',
                    state: 'completed',
                    result: 'succeeded',
                    createdDate: '2023-01-01T00:00:00Z',
                    finishedDate: '2023-01-01T00:05:00Z',
                    url: 'https://dev.azure.com/test-org/project1/_build/results?buildId=1'
                }
            ]
        };

        it('should return cached pipeline runs when available', async () => {
            const cachedRuns: PipelineRun[] = [
                {
                    id: 1,
                    name: 'Cached Run',
                    state: 'completed',
                    result: 'succeeded',
                    createdDate: new Date('2023-01-01T00:00:00Z'),
                    finishedDate: new Date('2023-01-01T00:05:00Z'),
                    pipeline: {} as Pipeline,
                    resources: {
                        repositories: {},
                        pipelines: {},
                        builds: {},
                        containers: {},
                        packages: {}
                    },
                    variables: {},
                    url: 'https://dev.azure.com/test-org/project1/_build/results?buildId=1'
                }
            ];

            mockCacheService.getCachedPipelineRuns.returns(cachedRuns);

            const result = await azureDevOpsService.getPipelineRuns(1, 'project1');

            assert.deepStrictEqual(result, cachedRuns);
            assert.ok(mockCacheService.getCachedPipelineRuns.calledWith(1, 'project1'));
            assert.ok(mockApiClient.get.notCalled);
        });

        it('should fetch pipeline runs from API when not cached', async () => {
            mockCacheService.getCachedPipelineRuns.returns(null);
            mockApiClient.get.resolves(createMockApiResponse(mockRunsResponse));

            const result = await azureDevOpsService.getPipelineRuns(1, 'project1');

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 1);
            assert.strictEqual(result[0].name, 'Run 1');
            assert.strictEqual(result[0].state, 'completed');
            assert.strictEqual(result[0].result, 'succeeded');

            assert.ok(mockApiClient.get.calledOnce);
            assert.ok(mockCacheService.setCachedPipelineRuns.calledWith(1, 'project1', result));
        });
    });

    describe('triggerPipelineRun', () => {
        const mockTriggerResponse = {
            id: 1,
            name: 'Run 1',
            state: 'inProgress',
            createdDate: '2023-01-01T00:00:00Z',
            url: 'https://dev.azure.com/test-org/project1/_build/results?buildId=1'
        };

        it('should trigger a pipeline run successfully', async () => {
            mockApiClient.post.resolves(createMockApiResponse(mockTriggerResponse));

            const result = await azureDevOpsService.triggerPipelineRun(1, 'project1');

            assert.strictEqual(result.id, 1);
            assert.strictEqual(result.name, 'Run 1');
            assert.strictEqual(result.state, 'inProgress');

            assert.ok(mockApiClient.post.calledWith(
                'https://dev.azure.com/test-org/project1/_apis/pipelines/1/runs?api-version=7.0',
                sinon.match.object
            ));
            assert.ok(mockCacheService.invalidatePipeline.calledWith(1, 'project1'));
        });

        it('should trigger a pipeline run with parameters', async () => {
            mockApiClient.post.resolves(createMockApiResponse(mockTriggerResponse));

            const parameters = {
                sourceBranch: 'refs/heads/feature',
                variables: { key1: 'value1' },
                templateParameters: { param1: 'value1' }
            };

            const result = await azureDevOpsService.triggerPipelineRun(1, 'project1', parameters);

            assert.strictEqual(result.id, 1);

            assert.ok(mockApiClient.post.calledWith(
                'https://dev.azure.com/test-org/project1/_apis/pipelines/1/runs?api-version=7.0',
                sinon.match.object
            ));
        });
    });

    describe('cache management', () => {
        it('should refresh project data', async () => {
            mockApiClient.get.resolves(createMockApiResponse({ value: [] }));

            await azureDevOpsService.refreshProject('project1');

            assert.ok(mockCacheService.invalidateProject.calledWith('project1'));
            assert.ok(mockApiClient.get.calledOnce);
        });

        it('should refresh pipeline data', async () => {
            mockApiClient.get.resolves(createMockApiResponse({ value: [] }));

            await azureDevOpsService.refreshPipeline(1, 'project1');

            assert.ok(mockCacheService.invalidatePipeline.calledWith(1, 'project1'));
            assert.ok(mockApiClient.get.calledOnce);
        });

        it('should clear all cache', async () => {
            await azureDevOpsService.clearCache();

            assert.ok(mockCacheService.clear.calledOnce);
        });
    });
});