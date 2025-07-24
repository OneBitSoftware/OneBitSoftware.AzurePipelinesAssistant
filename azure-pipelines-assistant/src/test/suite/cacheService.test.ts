import * as assert from 'assert';
import * as sinon from 'sinon';
import { CacheService } from '../../services/cacheService';

suite('CacheService', () => {
    let cacheService: CacheService;
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        cacheService = new CacheService(5000, 10); // 5 second TTL, max 10 items for testing
        clock = sinon.useFakeTimers();
    });

    teardown(() => {
        clock.restore();
    });

    suite('Basic Cache Operations', () => {
        test('should store and retrieve values', () => {
            const testValue = { id: 1, name: 'test' };
            cacheService.set('test-key', testValue);

            const retrieved = cacheService.get('test-key');
            assert.deepStrictEqual(retrieved, testValue);
        });

        test('should return null for non-existent keys', () => {
            const result = cacheService.get('non-existent');
            assert.strictEqual(result, null);
        });

        test('should return null for expired entries', () => {
            const testValue = { id: 1, name: 'test' };
            cacheService.set('test-key', testValue, 1000); // 1 second TTL

            // Advance time beyond TTL
            clock.tick(1001);

            const result = cacheService.get('test-key');
            assert.strictEqual(result, null);
        });

        test('should use default TTL when not specified', () => {
            const testValue = { id: 1, name: 'test' };
            cacheService.set('test-key', testValue);

            // Advance time to just before default TTL (5 seconds)
            clock.tick(4999);
            assert.deepStrictEqual(cacheService.get('test-key'), testValue);

            // Advance past TTL
            clock.tick(2);
            assert.strictEqual(cacheService.get('test-key'), null);
        });
    });

    suite('Cache Management', () => {
        test('should clear all entries', () => {
            cacheService.set('key1', 'value1');
            cacheService.set('key2', 'value2');

            cacheService.clear();

            assert.strictEqual(cacheService.get('key1'), null);
            assert.strictEqual(cacheService.get('key2'), null);
        });

        test('should invalidate specific entries', () => {
            cacheService.set('key1', 'value1');
            cacheService.set('key2', 'value2');

            cacheService.invalidate('key1');

            assert.strictEqual(cacheService.get('key1'), null);
            assert.strictEqual(cacheService.get('key2'), 'value2');
        });

        test('should get cache statistics', () => {
            cacheService.set('key1', 'value1');
            cacheService.get('key1'); // hit
            cacheService.get('non-existent'); // miss

            const stats = cacheService.getStats();
            assert.strictEqual(stats.hits, 1);
            assert.strictEqual(stats.misses, 1);
            assert.strictEqual(stats.size, 1);
        });
    });
});