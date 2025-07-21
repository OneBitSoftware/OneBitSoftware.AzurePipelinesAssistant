/**
 * URL building utilities for Azure DevOps API
 */

import { AZURE_DEVOPS, API_ENDPOINTS } from './constants';

export class UrlBuilder {
  constructor(private organization: string) {}

  /**
   * Build a complete URL for an Azure DevOps API endpoint
   */
  build(endpoint: string, apiVersion: string = AZURE_DEVOPS.API_VERSION): string {
    const baseUrl = `${AZURE_DEVOPS.BASE_URL}/${this.organization}`;
    const separator = endpoint.startsWith('/') ? '' : '/';
    const versionParam = endpoint.includes('api-version=') ? '' : 
      (endpoint.includes('?') ? `&api-version=${apiVersion}` : `?api-version=${apiVersion}`);
    
    return `${baseUrl}${separator}${endpoint}${versionParam}`;
  }

  /**
   * Build URL for projects endpoint
   */
  projects(): string {
    return this.build(API_ENDPOINTS.PROJECTS);
  }

  /**
   * Build URL for pipelines endpoint
   */
  pipelines(projectId: string): string {
    return this.build(API_ENDPOINTS.PIPELINES(projectId));
  }

  /**
   * Build URL for specific pipeline endpoint
   */
  pipeline(projectId: string, pipelineId: number): string {
    return this.build(API_ENDPOINTS.PIPELINE(projectId, pipelineId));
  }

  /**
   * Build URL for pipeline runs endpoint
   */
  pipelineRuns(projectId: string, pipelineId: number): string {
    return this.build(API_ENDPOINTS.RUNS(projectId, pipelineId));
  }

  /**
   * Build URL for specific pipeline run endpoint
   */
  pipelineRun(projectId: string, pipelineId: number, runId: number): string {
    return this.build(API_ENDPOINTS.RUN(projectId, pipelineId, runId));
  }

  /**
   * Build URL for run logs endpoint
   */
  runLogs(projectId: string, runId: number): string {
    return this.build(API_ENDPOINTS.RUN_LOGS(projectId, runId));
  }

  /**
   * Build URL for run artifacts endpoint
   */
  runArtifacts(projectId: string, runId: number): string {
    return this.build(API_ENDPOINTS.RUN_ARTIFACTS(projectId, runId));
  }

  /**
   * Build URL for build definitions endpoint
   */
  buildDefinitions(projectId: string): string {
    return this.build(API_ENDPOINTS.BUILD_DEFINITIONS(projectId));
  }

  /**
   * Build URL for specific build definition endpoint
   */
  buildDefinition(projectId: string, definitionId: number): string {
    return this.build(API_ENDPOINTS.BUILD_DEFINITION(projectId, definitionId));
  }

  /**
   * Build URL for builds endpoint
   */
  builds(projectId: string): string {
    return this.build(API_ENDPOINTS.BUILDS(projectId));
  }

  /**
   * Build URL for specific build endpoint
   */
  build_endpoint(projectId: string, buildId: number): string {
    return this.build(API_ENDPOINTS.BUILD(projectId, buildId));
  }

  /**
   * Build URL for build timeline endpoint
   */
  buildTimeline(projectId: string, buildId: number): string {
    return this.build(API_ENDPOINTS.BUILD_TIMELINE(projectId, buildId));
  }

  /**
   * Build URL for user profile endpoint
   */
  profile(): string {
    return this.build(API_ENDPOINTS.PROFILE);
  }

  /**
   * Build URL for connection data endpoint
   */
  connectionData(): string {
    return this.build(API_ENDPOINTS.CONNECTION_DATA);
  }

  /**
   * Add query parameters to a URL
   */
  static addQueryParams(url: string, params: Record<string, string | number | boolean>): string {
    const urlObj = new URL(url);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.set(key, value.toString());
      }
    });
    
    return urlObj.toString();
  }

  /**
   * Build URL with query parameters
   */
  buildWithParams(endpoint: string, params: Record<string, string | number | boolean>, apiVersion?: string): string {
    const baseUrl = this.build(endpoint, apiVersion);
    return UrlBuilder.addQueryParams(baseUrl, params);
  }
}