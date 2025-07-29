/**
 * Comprehensive error handling system for Azure Pipelines Assistant
 * 
 * This module provides:
 * - Specific error classes for different error types
 * - User-friendly error messages and recovery suggestions
 * - Error logging and diagnostic information collection
 * - Graceful degradation mechanisms
 * - Error recovery and retry logic
 */

export * from './errorTypes';
export * from './errorHandler';
export * from './errorRecovery';
export * from './diagnostics';
export * from './userFriendlyMessages';