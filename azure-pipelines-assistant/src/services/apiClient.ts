/**
 * Azure DevOps API client implementation
 */

import { 
  IApiClient, 
  ApiRequestOptions, 
  ApiResponse, 
  ApiError, 
  RetryOptions, 
  RateLimitInfo 
} from '../interfaces/apiClient';
import { AZURE_DEVOPS, HTTP_DEFAULTS } from '../utils/constants';
import { UrlBuilder } from '../utils/urlBuilder';

export class AzureDevOpsApiClient implements IApiClient {
  private organization: string = '';
  private personalAccessToken: string = '';
  private urlBuilder: UrlBuilder | null = null;
  private rateLimitInfo: RateLimitInfo | null = null;
  private retryOptions: RetryOptions = {
    maxRetries: HTTP_DEFAULTS.MAX_RETRIES,
    baseDelay: HTTP_DEFAULTS.BASE_DELAY,
    maxDelay: HTTP_DEFAULTS.MAX_DELAY,
    retryCondition: (error: ApiError) => {
      // Retry on network errors, rate limits, and 5xx server errors
      return error.retryable || 
             (error.status !== undefined && (error.status >= 500 || error.status === 429));
    }
  };

  constructor() {}

  setAuthentication(organization: string, personalAccessToken: string): void {
    this.organization = organization;
    this.personalAccessToken = personalAccessToken;
    this.urlBuilder = new UrlBuilder(organization);
  }

  /**
   * Get the URL builder instance for constructing API URLs
   */
  getUrlBuilder(): UrlBuilder {
    if (!this.urlBuilder) {
      throw new ApiError('Authentication not configured', undefined, undefined, undefined, false);
    }
    return this.urlBuilder;
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  setRetryOptions(options: Partial<RetryOptions>): void {
    this.retryOptions = { ...this.retryOptions, ...options };
  }

  async request<T = any>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    if (!this.organization || !this.personalAccessToken) {
      throw new ApiError('Authentication not configured', undefined, undefined, undefined, false);
    }

    const fullUrl = this.buildUrl(url);
    const requestOptions = this.buildRequestOptions(options);

    return this.executeWithRetry(() => this.executeRequest<T>(fullUrl, requestOptions));
  }

  async get<T = any>(url: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body: data });
  }

  async put<T = any>(url: string, data?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body: data });
  }

  async delete<T = any>(url: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async patch<T = any>(url: string, data?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body: data });
  }

  private buildUrl(endpoint: string): string {
    if (!this.urlBuilder) {
      throw new ApiError('Authentication not configured', undefined, undefined, undefined, false);
    }
    return this.urlBuilder.build(endpoint);
  }

  private buildRequestOptions(options: ApiRequestOptions): RequestInit {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`:${this.personalAccessToken}`).toString('base64')}`,
      'User-Agent': 'Azure-Pipelines-Assistant-VSCode-Extension',
      ...options.headers
    };

    const requestInit: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: AbortSignal.timeout(options.timeout || HTTP_DEFAULTS.TIMEOUT)
    };

    if (options.body && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
      requestInit.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    return requestInit;
  }

  private async executeRequest<T>(url: string, options: RequestInit): Promise<ApiResponse<T>> {
    let response: Response;

    try {
      this.logRequest(url, options);
      response = await fetch(url, options);
      this.updateRateLimitInfo(response);
    } catch (error) {
      this.logError(url, error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new ApiError('Request timeout', undefined, undefined, undefined, true);
        }
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          throw new ApiError('Network error', undefined, undefined, undefined, true);
        }
      }
      
      throw new ApiError('Request failed', undefined, undefined, undefined, true);
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : HTTP_DEFAULTS.RATE_LIMIT_DELAY;
      throw new ApiError(`Rate limited. Retry after ${delay}ms`, 429, response.statusText, undefined, true);
    }

    let responseData: any;
    const contentType = response.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (error) {
      this.logError(url, error);
      throw new ApiError('Failed to parse response', response.status, response.statusText, error, false);
    }

    this.logResponse(url, response, responseData);

    if (!response.ok) {
      const errorMessage = this.extractErrorMessage(responseData) || response.statusText || 'Request failed';
      const retryable = response.status >= 500 || response.status === 429;
      throw new ApiError(errorMessage, response.status, response.statusText, responseData, retryable);
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: this.extractHeaders(response)
    };
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: ApiError = new ApiError('Unknown error');
    
    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof ApiError ? error : new ApiError('Unknown error', undefined, undefined, error, false);
        
        // Don't retry on the last attempt or if error is not retryable
        if (attempt === this.retryOptions.maxRetries || 
            !this.retryOptions.retryCondition?.(lastError)) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryOptions.baseDelay * Math.pow(2, attempt),
          this.retryOptions.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;
        
        console.log(`API request failed (attempt ${attempt + 1}/${this.retryOptions.maxRetries + 1}). Retrying in ${jitteredDelay}ms...`, lastError.message);
        await this.sleep(jitteredDelay);
      }
    }

    throw lastError;
  }

  private updateRateLimitInfo(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        resetTime: new Date(parseInt(reset) * 1000)
      };
    }
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private extractErrorMessage(responseData: any): string | null {
    if (typeof responseData === 'string') {
      return responseData;
    }

    if (responseData && typeof responseData === 'object') {
      // Azure DevOps API error format
      if (responseData.message) {
        return responseData.message;
      }
      
      // Alternative error formats
      if (responseData.error?.message) {
        return responseData.error.message;
      }
      
      if (responseData.errorDescription) {
        return responseData.errorDescription;
      }

      // If there's a details array, extract the first message
      if (Array.isArray(responseData.details) && responseData.details.length > 0) {
        return responseData.details[0].message || responseData.details[0];
      }
    }

    return null;
  }

  private logRequest(url: string, options: RequestInit): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${options.method} ${url}`, {
        headers: options.headers,
        body: options.body
      });
    }
  }

  private logResponse(url: string, response: Response, data: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${response.status} ${response.statusText} - ${url}`, {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: typeof data === 'string' && data.length > 1000 ? `${data.substring(0, 1000)}...` : data
      });
    }
  }

  private logError(url: string, error: any): void {
    console.error(`[API] Error for ${url}:`, error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}