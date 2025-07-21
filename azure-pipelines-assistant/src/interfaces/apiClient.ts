/**
 * Azure DevOps API client interface
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: ApiError) => boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly response?: any,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface IApiClient {
  /**
   * Make an HTTP request to the Azure DevOps API
   */
  request<T = any>(url: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  /**
   * GET request
   */
  get<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<T>>;

  /**
   * POST request
   */
  post<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;

  /**
   * PUT request
   */
  put<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;

  /**
   * DELETE request
   */
  delete<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<T>>;

  /**
   * PATCH request
   */
  patch<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>>;

  /**
   * Set authentication credentials
   */
  setAuthentication(organization: string, personalAccessToken: string): void;

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): RateLimitInfo | null;

  /**
   * Configure retry behavior
   */
  setRetryOptions(options: Partial<RetryOptions>): void;
}