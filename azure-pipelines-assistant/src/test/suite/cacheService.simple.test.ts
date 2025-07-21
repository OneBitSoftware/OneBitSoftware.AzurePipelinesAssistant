import * as assert from 'assert';
import { CacheService } from '../../services/cacheService';

describe('CacheService - Simple Tests', () => {
    let cacheService: CacheService;

    beforeEach(() => {
        cacheService = new CacheService(5000, 10); // 5 second TTL, max 10 items for testing
    });

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
        assert.strictEqual(stats.hitRate, 2/3);
        assert.strictEqual(stats.size, 1);
    });
});