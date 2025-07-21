import * as assert from 'assert';
import { AzureDevOpsService } from '../../services/azureDevOpsService';

describe('AzureDevOpsService - Simple Tests', () => {
    it('should be instantiable', () => {
        // Create mock dependencies
        const mockApiClient = {
            get: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            post: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            put: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            patch: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            delete: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            request: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            setAuthentication: () => {},
            getRateLimitInfo: () => null,
            setRetryOptions: () => {}
        };

        const mockCacheService = {
            get: () => null,
            set: () => {},
            invalidate: () => {},
            clear: () => {},
            getStats: () => ({ size: 0, hits: 0, misses: 0, hitRate: 0 }),
            getCachedProjects: () => null,
            setCachedProjects: () => {},
            getCachedPipelines: () => null,
            setCachedPipelines: () => {},
            getCachedPipelineRuns: () => null,
            setCachedPipelineRuns: () => {},
            invalidateProject: () => {},
            invalidatePipeline: () => {},
            cleanup: () => {}
        };

        const config = {
            organization: 'test-org',
            personalAccessToken: 'test-pat'
        };

        const service = new AzureDevOpsService(
            mockApiClient as any,
            mockCacheService as any,
            config
        );

        assert.ok(service);
        assert.strictEqual(typeof service.getProjects, 'function');
        assert.strictEqual(typeof service.getPipelines, 'function');
        assert.strictEqual(typeof service.getPipelineRuns, 'function');
        assert.strictEqual(typeof service.triggerPipelineRun, 'function');
        assert.strictEqual(typeof service.getRunDetails, 'function');
        assert.strictEqual(typeof service.cancelRun, 'function');
        assert.strictEqual(typeof service.getRunLogs, 'function');
        assert.strictEqual(typeof service.downloadArtifacts, 'function');
        assert.strictEqual(typeof service.refreshProject, 'function');
        assert.strictEqual(typeof service.refreshPipeline, 'function');
        assert.strictEqual(typeof service.clearCache, 'function');
    });

    it('should handle configuration correctly', () => {
        const mockApiClient = {
            get: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            post: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            put: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            patch: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            delete: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            request: async () => ({ data: null, status: 200, statusText: 'OK', headers: {} }),
            setAuthentication: () => {},
            getRateLimitInfo: () => null,
            setRetryOptions: () => {}
        };

        const mockCacheService = {
            get: () => null,
            set: () => {},
            invalidate: () => {},
            clear: () => {},
            getStats: () => ({ size: 0, hits: 0, misses: 0, hitRate: 0 }),
            getCachedProjects: () => null,
            setCachedProjects: () => {},
            getCachedPipelines: () => null,
            setCachedPipelines: () => {},
            getCachedPipelineRuns: () => null,
            setCachedPipelineRuns: () => {},
            invalidateProject: () => {},
            invalidatePipeline: () => {},
            cleanup: () => {}
        };

        // Test with minimal config
        const minimalConfig = {
            organization: 'test-org',
            personalAccessToken: 'test-pat'
        };

        const service1 = new AzureDevOpsService(
            mockApiClient as any,
            mockCacheService as any,
            minimalConfig
        );

        assert.ok(service1);

        // Test with full config
        const fullConfig = {
            organization: 'test-org',
            personalAccessToken: 'test-pat',
            maxRetries: 5,
            retryDelay: 2000,
            cacheEnabled: false,
            cacheTtl: 10 * 60 * 1000
        };

        const service2 = new AzureDevOpsService(
            mockApiClient as any,
            mockCacheService as any,
            fullConfig
        );

        assert.ok(service2);
    });
});