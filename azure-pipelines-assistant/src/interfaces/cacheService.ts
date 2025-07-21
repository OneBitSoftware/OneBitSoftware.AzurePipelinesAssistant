import { Project } from '../models/project';
import { Pipeline } from '../models/pipeline';
import { PipelineRun } from '../models/pipelineRun';

/**
 * Cache entry with expiration time
 */
export interface CacheEntry<T> {
    value: T;
    expiry: number;
}

/**
 * Interface for caching service with TTL-based caching
 */
export interface ICacheService {
    /**
     * Get a cached value by key
     * @param key Cache key
     * @returns Cached value or null if not found or expired
     */
    get<T>(key: string): T | null;

    /**
     * Set a cached value with optional TTL
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time to live in milliseconds (optional, uses default if not provided)
     */
    set<T>(key: string, value: T, ttl?: number): void;

    /**
     * Invalidate a specific cache entry
     * @param key Cache key to invalidate
     */
    invalidate(key: string): void;

    /**
     * Clear all cached entries
     */
    clear(): void;

    /**
     * Get cache statistics
     * @returns Object containing cache hit/miss statistics and size
     */
    getStats(): CacheStats;

    // Specialized cache methods for Azure DevOps entities

    /**
     * Get cached projects
     * @returns Cached projects or null if not found or expired
     */
    getCachedProjects(): Project[] | null;

    /**
     * Set cached projects
     * @param projects Projects to cache
     */
    setCachedProjects(projects: Project[]): void;

    /**
     * Get cached pipelines for a project
     * @param projectId Project ID
     * @returns Cached pipelines or null if not found or expired
     */
    getCachedPipelines(projectId: string): Pipeline[] | null;

    /**
     * Set cached pipelines for a project
     * @param projectId Project ID
     * @param pipelines Pipelines to cache
     */
    setCachedPipelines(projectId: string, pipelines: Pipeline[]): void;

    /**
     * Get cached pipeline runs
     * @param pipelineId Pipeline ID
     * @param projectId Project ID
     * @returns Cached pipeline runs or null if not found or expired
     */
    getCachedPipelineRuns(pipelineId: number, projectId: string): PipelineRun[] | null;

    /**
     * Set cached pipeline runs
     * @param pipelineId Pipeline ID
     * @param projectId Project ID
     * @param runs Pipeline runs to cache
     */
    setCachedPipelineRuns(pipelineId: number, projectId: string, runs: PipelineRun[]): void;

    /**
     * Invalidate all cache entries for a specific project
     * @param projectId Project ID
     */
    invalidateProject(projectId: string): void;

    /**
     * Invalidate all cache entries for a specific pipeline
     * @param pipelineId Pipeline ID
     * @param projectId Project ID
     */
    invalidatePipeline(pipelineId: number, projectId: string): void;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
}