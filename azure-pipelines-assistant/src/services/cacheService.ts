import { ICacheService, CacheEntry, CacheStats } from '../interfaces/cacheService';
import { Project } from '../models/project';
import { Pipeline } from '../models/pipeline';
import { PipelineRun } from '../models/pipelineRun';

/**
 * LRU Cache node for doubly linked list
 */
class LRUNode<T> {
    constructor(
        public key: string,
        public value: CacheEntry<T>,
        public prev: LRUNode<T> | null = null,
        public next: LRUNode<T> | null = null
    ) {}
}

/**
 * In-memory cache service with TTL and LRU eviction
 */
export class CacheService implements ICacheService {
    private cache = new Map<string, LRUNode<any>>();
    private head: LRUNode<any> | null = null;
    private tail: LRUNode<any> | null = null;
    private hits = 0;
    private misses = 0;

    private readonly DEFAULT_TTL: number;
    private readonly MAX_SIZE: number;

    constructor(
        defaultTtl: number = 5 * 60 * 1000,
        maxSize: number = 1000
    ) {
        this.DEFAULT_TTL = defaultTtl;
        this.MAX_SIZE = maxSize;
    }

    /**
     * Get a cached value by key
     */
    get<T>(key: string): T | null {
        const node = this.cache.get(key);
        
        if (!node) {
            this.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() > node.value.expiry) {
            this.removeNode(node);
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        // Move to front (most recently used)
        this.moveToFront(node);
        this.hits++;
        return node.value.value as T;
    }

    /**
     * Set a cached value with optional TTL
     */
    set<T>(key: string, value: T, ttl?: number): void {
        const actualTtl = ttl ?? this.DEFAULT_TTL;
        const expiry = Date.now() + actualTtl;
        const cacheEntry: CacheEntry<T> = { value, expiry };

        const existingNode = this.cache.get(key);
        
        if (existingNode) {
            // Update existing node
            existingNode.value = cacheEntry;
            this.moveToFront(existingNode);
        } else {
            // Create new node
            const newNode = new LRUNode(key, cacheEntry);
            this.cache.set(key, newNode);
            this.addToFront(newNode);

            // Check if we need to evict
            if (this.cache.size > this.MAX_SIZE) {
                this.evictLRU();
            }
        }
    }

    /**
     * Invalidate a specific cache entry
     */
    invalidate(key: string): void {
        const node = this.cache.get(key);
        if (node) {
            this.removeNode(node);
            this.cache.delete(key);
        }
    }

    /**
     * Clear all cached entries
     */
    clear(): void {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0
        };
    }

    // Specialized cache methods for Azure DevOps entities

    /**
     * Get cached projects
     */
    getCachedProjects(): Project[] | null {
        return this.get<Project[]>('projects');
    }

    /**
     * Set cached projects
     */
    setCachedProjects(projects: Project[]): void {
        this.set('projects', projects);
    }

    /**
     * Get cached pipelines for a project
     */
    getCachedPipelines(projectId: string): Pipeline[] | null {
        return this.get<Pipeline[]>(`pipelines:${projectId}`);
    }

    /**
     * Set cached pipelines for a project
     */
    setCachedPipelines(projectId: string, pipelines: Pipeline[]): void {
        this.set(`pipelines:${projectId}`, pipelines);
    }

    /**
     * Get cached pipeline runs
     */
    getCachedPipelineRuns(pipelineId: number, projectId: string): PipelineRun[] | null {
        return this.get<PipelineRun[]>(`runs:${projectId}:${pipelineId}`);
    }

    /**
     * Set cached pipeline runs
     */
    setCachedPipelineRuns(pipelineId: number, projectId: string, runs: PipelineRun[]): void {
        this.set(`runs:${projectId}:${pipelineId}`, runs);
    }

    /**
     * Invalidate all cache entries for a specific project
     */
    invalidateProject(projectId: string): void {
        const keysToInvalidate: string[] = [];
        
        for (const key of this.cache.keys()) {
            if (key.startsWith(`pipelines:${projectId}`) || 
                key.startsWith(`runs:${projectId}`)) {
                keysToInvalidate.push(key);
            }
        }

        keysToInvalidate.forEach(key => this.invalidate(key));
    }

    /**
     * Invalidate all cache entries for a specific pipeline
     */
    invalidatePipeline(pipelineId: number, projectId: string): void {
        this.invalidate(`runs:${projectId}:${pipelineId}`);
    }

    /**
     * Get the last update timestamp for cached pipeline runs
     */
    getLastUpdateTimestamp(pipelineId: number, projectId: string): Date | null {
        const timestamp = this.get<Date>(`timestamp:${projectId}:${pipelineId}`);
        return timestamp;
    }

    /**
     * Set the last update timestamp for cached pipeline runs
     */
    setLastUpdateTimestamp(pipelineId: number, projectId: string, timestamp: Date): void {
        this.set(`timestamp:${projectId}:${pipelineId}`, timestamp);
    }

    /**
     * Check if cache entry is expired
     */
    isExpired(key: string): boolean {
        const node = this.cache.get(key);
        if (!node) {
            return true;
        }
        return Date.now() > node.value.expiry;
    }

    /**
     * Get cache entry with metadata
     */
    getCacheEntry<T>(key: string): CacheEntry<T> | null {
        const node = this.cache.get(key);
        if (!node) {
            return null;
        }

        // Check if expired
        if (Date.now() > node.value.expiry) {
            this.removeNode(node);
            this.cache.delete(key);
            return null;
        }

        return node.value as CacheEntry<T>;
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): void {
        const now = Date.now();
        const keysToRemove: string[] = [];

        for (const [key, node] of this.cache.entries()) {
            if (now > node.value.expiry) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            const node = this.cache.get(key);
            if (node) {
                this.removeNode(node);
                this.cache.delete(key);
            }
        });
    }

    /**
     * Dispose of the cache service
     */
    dispose(): void {
        this.clear();
    }

    // Private LRU implementation methods

    private addToFront(node: LRUNode<any>): void {
        if (!this.head) {
            this.head = node;
            this.tail = node;
        } else {
            node.next = this.head;
            this.head.prev = node;
            this.head = node;
        }
    }

    private removeNode(node: LRUNode<any>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }

        node.prev = null;
        node.next = null;
    }

    private moveToFront(node: LRUNode<any>): void {
        if (node === this.head) {
            return;
        }

        this.removeNode(node);
        this.addToFront(node);
    }

    private evictLRU(): void {
        if (this.tail) {
            const keyToRemove = this.tail.key;
            this.removeNode(this.tail);
            this.cache.delete(keyToRemove);
        }
    }
}