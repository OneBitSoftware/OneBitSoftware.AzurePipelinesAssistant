/**
 * Configuration models for the Azure Pipelines Assistant extension
 */

/**
 * Extension configuration interface
 */
export interface ExtensionConfiguration {
  organization: string;
  refreshInterval: number;
  maxRunsPerPipeline: number;
  showTimestamps: boolean;
  autoRefresh: boolean;
  favoriteProjects: string[];
  favoritePipelines: FavoritePipeline[];
  cacheTimeout: number;
  logLevel: LogLevel;
  showWelcomeOnStartup: boolean;
  compactView: boolean;
}

/**
 * Favorite pipeline structure
 */
export interface FavoritePipeline {
  projectId: string;
  pipelineId: number;
  name: string;
}

/**
 * Log levels for extension diagnostics
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Configuration validation result
 */
export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: ConfigurationWarning[];
}

/**
 * Configuration error details
 */
export interface ConfigurationError {
  field: keyof ExtensionConfiguration;
  message: string;
  value?: any;
}

/**
 * Configuration warning details
 */
export interface ConfigurationWarning {
  field: keyof ExtensionConfiguration;
  message: string;
  value?: any;
}

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
  field: keyof ExtensionConfiguration;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIGURATION: Partial<ExtensionConfiguration> = {
  refreshInterval: 30,
  maxRunsPerPipeline: 10,
  showTimestamps: true,
  autoRefresh: true,
  favoriteProjects: [],
  favoritePipelines: [],
  cacheTimeout: 300,
  logLevel: 'info',
  showWelcomeOnStartup: true,
  compactView: false,
};

/**
 * Configuration field metadata for validation and UI
 */
export interface ConfigurationFieldMetadata {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  description: string;
  defaultValue?: any;
}

/**
 * Configuration schema for validation
 */
export const CONFIGURATION_SCHEMA: Record<keyof ExtensionConfiguration, ConfigurationFieldMetadata> = {
  organization: {
    type: 'string',
    required: true,
    pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/,
    description: 'Azure DevOps organization name',
  },
  refreshInterval: {
    type: 'number',
    required: false,
    min: 10,
    max: 300,
    description: 'Auto-refresh interval in seconds',
    defaultValue: 30,
  },
  maxRunsPerPipeline: {
    type: 'number',
    required: false,
    min: 1,
    max: 50,
    description: 'Maximum number of runs to show per pipeline',
    defaultValue: 10,
  },
  showTimestamps: {
    type: 'boolean',
    required: false,
    description: 'Show timestamps in logs and run details',
    defaultValue: true,
  },
  autoRefresh: {
    type: 'boolean',
    required: false,
    description: 'Enable automatic refresh of pipeline data',
    defaultValue: true,
  },
  favoriteProjects: {
    type: 'array',
    required: false,
    description: 'List of favorite project IDs',
    defaultValue: [],
  },
  favoritePipelines: {
    type: 'array',
    required: false,
    description: 'List of favorite pipelines',
    defaultValue: [],
  },
  cacheTimeout: {
    type: 'number',
    required: false,
    min: 60,
    max: 3600,
    description: 'Cache timeout in seconds',
    defaultValue: 300,
  },
  logLevel: {
    type: 'string',
    required: false,
    description: 'Logging level for extension diagnostics',
    defaultValue: 'info',
  },
  showWelcomeOnStartup: {
    type: 'boolean',
    required: false,
    description: 'Show welcome message on startup',
    defaultValue: true,
  },
  compactView: {
    type: 'boolean',
    required: false,
    description: 'Use compact view in pipeline tree',
    defaultValue: false,
  },
};