import * as assert from 'assert';
import * as sinon from 'sinon';
import { CacheService } from '../../services/cacheService';
import { Project, Pipeline, PipelineRun } from '../../models';

describe('CacheService', () => {
    let cacheService: CacheService;
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        cacheService = new CacheService(5000, 10); // 5 second TTL, max 10 items for testing
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    describe('Basic Cache Operations', () => {
        it('should store and retrieve values', () => {
            const testValue = { id: 1, name: 'test' };
            cacheService.set('test-key', testValue);

            const retrieved = cacheService.get('test-key');
            assert.deepStrictEqual(retrieved, testValue);
        });

        it('should return null for non-existent keys', () => {
            const result = cacheService.get('non-existent');
            assert.strictEqual(result, null);
        });

        it('should return null for expired entries', () => {
            const testValue = { id: 1, name: 'test' };
            cacheService.set('test-key', testValue, 1000); // 1 second TTL

            // Advance time beyond TTL
            clock.tick(1001);

            const result = cacheService.get('test-key');
            assert.strictEqual(result, null);
        });

        it('should use default TTL when not specified', () => {
            const testValue = { id: 1, name: 'test' };
            cacheService.set('test-key', testValue);

            // Advance time to just before default TTL (5 seconds)
            clock.tick(4999);
            assert.deepStrictEqual(cacheService.get('test-key'), testValue);

            // Advance past default TTL
            clock.tick(2);
            assert.strictEqual(cacheService.get('test-key'), null);
        });

        it('should update existing entries', () => {
            const originalValue = { id: 1, name: 'original' };
            const updatedValue = { id: 1, name: 'updated' };

            cacheService.set('test-key', originalValue);
            cacheService.set('test-key', updatedValue);

            const result = cacheService.get('test-key');
            assert.deepStrictEqual(result, updatedValue);
        });
    });

    describe('Cache Invalidation', () => {
        it('should invalidate specific entries', () => {
            cacheService.set('key1', 'value1');
            cacheService.set('key2', 'value2');

            cacheService.invalidate('key1');

            assert.strictEqual(cacheService.get('key1'), null);
            assert.strictEqual(cacheService.get('key2'), 'value2');
        });

        it('should clear all entries', () => {
            cacheService.set('key1', 'value1');
            cacheService.set('key2', 'value2');

            cacheService.clear();

            assert.strictEqual(cacheService.get('key1'), null);
            assert.strictEqual(cacheService.get('key2'), null);
            assert.strictEqual(cacheService.getStats().size, 0);
        });
    });

    describe('LRU Eviction', () => {
        it('should evict least recently used items when cache is full', () => {
            // Fill cache to capacity
            for (let i = 0; i < 10; i++) {
                cacheService.set(`key${i}`, `value${i}`);
            }

            // Add one more item to trigger eviction
            cacheService.set('key10', 'value10');

            // First item should be evicted
            assert.strictEqual(cacheService.get('key0'), null);
            assert.strictEqual(cacheService.get('key10'), 'value10');
            assert.strictEqual(cacheService.getStats().size, 10);
        });

        it('should move accessed items to front', () => {
            // Fill cache
            for (let i = 0; i < 10; i++) {
                cacheService.set(`key${i}`, `value${i}`);
            }

            // Access first item to move it to front
            cacheService.get('key0');

            // Add new item to trigger eviction
            cacheService.set('key10', 'value10');

            // key0 should still exist (moved to front), key1 should be evicted
            assert.strictEqual(cacheService.get('key0'), 'value0');
            assert.strictEqual(cacheService.get('key1'), null);
        });
    });

    describe('Cache Statistics', () => {
        it('should track hits and misses', () => {
            cacheService.set('key1', 'value1');

            // Hit
            cacheService.get('key1');
            // Miss
            cacheService.get('key2');
            // Another hit
            cacheService.get('key1');

            const stats = cacheService.getStats();
            assert.strictEqual(stats.hits, 2);
            assert.strictEqual(stats.misses, 1);
            assert.strictEqual(stats.hitRate, 2 / 3);
            assert.strictEqual(stats.size, 1);
        });

        it('should handle zero operations gracefully', () => {
            const stats = cacheService.getStats();
            assert.strictEqual(stats.hits, 0);
            assert.strictEqual(stats.misses, 0);
            assert.strictEqual(stats.hitRate, 0);
            assert.strictEqual(stats.size, 0);
        });
    });

    describe('Specialized Azure DevOps Methods', () => {
        const mockProject: Project = {
            id: 'project1',
            name: 'Test Project',
            description: 'Test Description',
            url: 'https://dev.azure.com/org/project1',
            state: 'wellFormed',
            visibility: 'private'
        };

        const mockPipeline: Pipeline = {
            id: 123,
            name: 'Test Pipeline',
            project: mockProject,
            revision: 1,
            url: 'https://dev.azure.com/org/project1/_build?definitionId=123',
            configuration: {
                type: 'yaml',
                path: 'azure-pipelines.yml',
                repository: {
                    id: 'repo1',
                    name: 'test-repo',
                    url: 'https://dev.azure.com/org/project1/_git/test-repo',
                    type: 'TfsGit',
                    defaultBranch: 'main'
                }
            }
        };

        const mockRun: PipelineRun = {
            id: 456,
            name: 'Test Run',
            state: 'completed',
            result: 'succeeded',
            createdDate: new Date(),
            pipeline: mockPipeline,
            resources: {
                repositories: {},
                pipelines: {},
                builds: {},
                containers: {},
                packages: {}
            },
            variables: {},
            url: 'https://dev.azure.com/org/project1/_build/results?buildId=456'
        };

        it('should cache and retrieve projects', () => {
            const projects = [mockProject];

            cacheService.setCachedProjects(projects);
            const retrieved = cacheService.getCachedProjects();

            assert.deepStrictEqual(retrieved, projects);
        });

        it('should cache and retrieve pipelines by project', () => {
            const pipelines = [mockPipeline];

            cacheService.setCachedPipelines('project1', pipelines);
            const retrieved = cacheService.getCachedPipelines('project1');

            assert.deepStrictEqual(retrieved, pipelines);
        });

        it('should cache and retrieve pipeline runs', () => {
            const runs = [mockRun];

            cacheService.setCachedPipelineRuns(123, 'project1', runs);
            const retrieved = cacheService.getCachedPipelineRuns(123, 'project1');

            assert.deepStrictEqual(retrieved, runs);
        });

        it('should invalidate project-related entries', () => {
            cacheService.setCachedPipelines('project1', [mockPipeline]);
            cacheService.setCachedPipelineRuns(123, 'project1', [mockRun]);
            cacheService.setCachedPipelines('project2', [mockPipeline]);

            cacheService.invalidateProject('project1');

            assert.strictEqual(cacheService.getCachedPipelines('project1'), null);
            assert.strictEqual(cacheService.getCachedPipelineRuns(123, 'project1'), null);
            assert.deepStrictEqual(cacheService.getCachedPipelines('project2'), [mockPipeline]);
        });

        it('should invalidate pipeline-specific entries', () => {
            cacheService.setCachedPipelineRuns(123, 'project1', [mockRun]);
            cacheService.setCachedPipelineRuns(456, 'project1', [mockRun]);

            cacheService.invalidatePipeline(123, 'project1');

            assert.strictEqual(cacheService.getCachedPipelineRuns(123, 'project1'), null);
            assert.deepStrictEqual(cacheService.getCachedPipelineRuns(456, 'project1'), [mockRun]);
        });
    });

    describe('Cleanup Operations', () => {
        it('should remove expired entries during cleanup', () => {
            cacheService.set('key1', 'value1', 1000); // 1 second TTL
            cacheService.set('key2', 'value2', 3000); // 3 second TTL

            // Advance time to expire first entry
            clock.tick(1500);

            cacheService.cleanup();

            assert.strictEqual(cacheService.get('key1'), null);
            assert.strictEqual(cacheService.get('key2'), 'value2');
        });

        it('should not affect non-expired entries during cleanup', () => {
            cacheService.set('key1', 'value1', 5000);
            cacheService.set('key2', 'value2', 5000);

            clock.tick(1000);
            cacheService.cleanup();

            assert.strictEqual(cacheService.get('key1'), 'value1');
            assert.strictEqual(cacheService.get('key2'), 'value2');
        });
    });
});