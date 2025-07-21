/**
 * Extension constants
 */
export const EXTENSION_ID = 'azure-pipelines-assistant';
export const EXTENSION_NAME = 'Azure Pipelines Assistant';

/**
 * Command IDs
 */
export const COMMANDS = {
  CONFIGURE: 'azurePipelinesAssistant.configure',
  REFRESH: 'azurePipelinesAssistant.refresh',
  RUN_PIPELINE: 'azurePipelinesAssistant.runPipeline',
  VIEW_IN_BROWSER: 'azurePipelinesAssistant.viewInBrowser',
  VIEW_RUN_DETAILS: 'azurePipelinesAssistant.viewRunDetails',
  VIEW_LOGS: 'azurePipelinesAssistant.viewLogs',
  DOWNLOAD_ARTIFACTS: 'azurePipelinesAssistant.downloadArtifacts',
  ADD_TO_FAVORITES: 'azurePipelinesAssistant.addToFavorites',
  REMOVE_FROM_FAVORITES: 'azurePipelinesAssistant.removeFromFavorites',
  VIEW_RECENT_RUNS: 'azurePipelinesAssistant.viewRecentRuns',
  CANCEL_RUN: 'azurePipelinesAssistant.cancelRun'
} as const;

/**
 * Configuration keys
 */
export const CONFIG_KEYS = {
  ORGANIZATION: 'azurePipelinesAssistant.organization',
  PERSONAL_ACCESS_TOKEN: 'azurePipelinesAssistant.personalAccessToken',
  REFRESH_INTERVAL: 'azurePipelinesAssistant.refreshInterval',
  MAX_RUNS_PER_PIPELINE: 'azurePipelinesAssistant.maxRunsPerPipeline',
  SHOW_TIMESTAMPS: 'azurePipelinesAssistant.showTimestamps',
  AUTO_REFRESH: 'azurePipelinesAssistant.autoRefresh',
  FAVORITE_PROJECTS: 'azurePipelinesAssistant.favoriteProjects'
} as const;

/**
 * Context keys for when clause evaluation
 */
export const CONTEXT_KEYS = {
  CONFIGURED: 'azurePipelinesAssistant.configured',
  IS_FAVORITE: 'azurePipelinesAssistant.isFavorite',
  CAN_CANCEL: 'azurePipelinesAssistant.canCancel'
} as const;

/**
 * Tree view IDs
 */
export const TREE_VIEW_IDS = {
  AZURE_PIPELINES_EXPLORER: 'azurePipelinesExplorer'
} as const;

/**
 * Azure DevOps API constants
 */
export const AZURE_DEVOPS = {
  API_VERSION: '7.0',
  BASE_URL: 'https://dev.azure.com',
  VISUAL_STUDIO_URL: 'https://visualstudio.com'
} as const;

/**
 * Azure DevOps API endpoints
 */
export const API_ENDPOINTS = {
  // Core resources
  PROJECTS: '/_apis/projects',
  PIPELINES: (projectId: string) => `/${projectId}/_apis/pipelines`,
  PIPELINE: (projectId: string, pipelineId: number) => `/${projectId}/_apis/pipelines/${pipelineId}`,
  
  // Pipeline runs
  RUNS: (projectId: string, pipelineId: number) => `/${projectId}/_apis/pipelines/${pipelineId}/runs`,
  RUN: (projectId: string, pipelineId: number, runId: number) => `/${projectId}/_apis/pipelines/${pipelineId}/runs/${runId}`,
  RUN_LOGS: (projectId: string, runId: number) => `/${projectId}/_apis/build/builds/${runId}/logs`,
  RUN_ARTIFACTS: (projectId: string, runId: number) => `/${projectId}/_apis/build/builds/${runId}/artifacts`,
  
  // Build definitions (legacy API for some operations)
  BUILD_DEFINITIONS: (projectId: string) => `/${projectId}/_apis/build/definitions`,
  BUILD_DEFINITION: (projectId: string, definitionId: number) => `/${projectId}/_apis/build/definitions/${definitionId}`,
  
  // Builds
  BUILDS: (projectId: string) => `/${projectId}/_apis/build/builds`,
  BUILD: (projectId: string, buildId: number) => `/${projectId}/_apis/build/builds/${buildId}`,
  BUILD_TIMELINE: (projectId: string, buildId: number) => `/${projectId}/_apis/build/builds/${buildId}/timeline`,
  
  // User profile (for validation)
  PROFILE: '/_apis/profile/profiles/me',
  
  // Connection data (for validation)
  CONNECTION_DATA: '/_apis/connectionData'
} as const;

/**
 * HTTP request defaults
 */
export const HTTP_DEFAULTS = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  RATE_LIMIT_DELAY: 60000 // 1 minute
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  REFRESH_INTERVAL: 30,
  MAX_RUNS_PER_PIPELINE: 10,
  SHOW_TIMESTAMPS: true,
  AUTO_REFRESH: true
} as const;