/**
 * Unit tests for Azure DevOps API client
 */

import * as sinon from 'sinon';
import { strict as assert } from 'assert';
import { AzureDevOpsApiClient } from '../../services/apiClient';
import { ApiError } from '../../interfaces/apiClient';

// Mock fetch globally
const mockFetch = sinon.stub();
(global as any).fetch = mockFetch;

describe('AzureDevOpsApiClient', () => {
  let apiClient: AzureDevOpsApiClient;
  let consoleLogStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    apiClient = new AzureDevOpsApiClient();
    apiClient.setAuthentication('test-org', 'test-pat');

    // Disable retries for faster tests
    apiClient.setRetryOptions({ maxRetries: 0 });

    // Stub console methods to avoid noise in tests
    consoleLogStub = sinon.stub(console, 'log');
    consoleErrorStub = sinon.stub(console, 'error');

    // Reset fetch mock
    mockFetch.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Authentication', () => {
    it('should set authentication credentials', () => {
      const client = new AzureDevOpsApiClient();
      client.setAuthentication('my-org', 'my-pat');

      // Authentication is set internally, we can verify by making a request
      assert.doesNotThrow(() => {
        client.setAuthentication('my-org', 'my-pat');
      });
    });

    it('should throw error when making request without authentication', async () => {
      const client = new AzureDevOpsApiClient();

      try {
        await client.get('/_apis/projects');
        assert.fail('Should have thrown authentication error');
      } catch (error) {
        assert.ok(error instanceof ApiError);
        assert.strictEqual((error as ApiError).message, 'Authentication not configured');
        assert.strictEqual((error as ApiError).retryable, false);
      }
    });
  });

  describe('URL Building', () => {
    it('should build correct URL with API version', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects');

      const expectedUrl = 'https://dev.azure.com/test-org/_apis/projects?api-version=7.0';
      assert.ok(mockFetch.calledWith(expectedUrl));
    });

    it('should handle URLs that already have query parameters', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects?$top=10');

      const expectedUrl = 'https://dev.azure.com/test-org/_apis/projects?$top=10&api-version=7.0';
      assert.ok(mockFetch.calledWith(expectedUrl));
    });

    it('should handle URLs that already have api-version', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects?api-version=6.0');

      const expectedUrl = 'https://dev.azure.com/test-org/_apis/projects?api-version=6.0';
      assert.ok(mockFetch.calledWith(expectedUrl));
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET request', async () => {
      const responseData = { value: [{ id: '1', name: 'Project 1' }] };
      mockFetch.resolves(createMockResponse(responseData));

      const response = await apiClient.get('/_apis/projects');

      assert.deepStrictEqual(response.data, responseData);
      assert.strictEqual(response.status, 200);
      assert.ok(mockFetch.calledOnce);

      const [url, options] = mockFetch.firstCall.args;
      assert.strictEqual(options.method, 'GET');
    });

    it('should make POST request with data', async () => {
      const requestData = { name: 'New Pipeline' };
      const responseData = { id: 123, name: 'New Pipeline' };
      mockFetch.resolves(createMockResponse(responseData));

      const response = await apiClient.post('/project/_apis/pipelines', requestData);

      assert.deepStrictEqual(response.data, responseData);

      const [url, options] = mockFetch.firstCall.args;
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.body, JSON.stringify(requestData));
    });

    it('should make PUT request with data', async () => {
      const requestData = { name: 'Updated Pipeline' };
      const responseData = { id: 123, name: 'Updated Pipeline' };
      mockFetch.resolves(createMockResponse(responseData));

      const response = await apiClient.put('/project/_apis/pipelines/123', requestData);

      assert.deepStrictEqual(response.data, responseData);

      const [url, options] = mockFetch.firstCall.args;
      assert.strictEqual(options.method, 'PUT');
      assert.strictEqual(options.body, JSON.stringify(requestData));
    });

    it('should make DELETE request', async () => {
      // Create a proper 204 response without body
      const mockResponse = new Response(null, {
        status: 204,
        statusText: 'No Content'
      });
      mockFetch.resolves(mockResponse);

      const response = await apiClient.delete('/project/_apis/pipelines/123');

      assert.strictEqual(response.status, 204);

      const [url, options] = mockFetch.firstCall.args;
      assert.strictEqual(options.method, 'DELETE');
    });

    it('should make PATCH request with data', async () => {
      const requestData = { name: 'Patched Pipeline' };
      const responseData = { id: 123, name: 'Patched Pipeline' };
      mockFetch.resolves(createMockResponse(responseData));

      const response = await apiClient.patch('/project/_apis/pipelines/123', requestData);

      assert.deepStrictEqual(response.data, responseData);

      const [url, options] = mockFetch.firstCall.args;
      assert.strictEqual(options.method, 'PATCH');
      assert.strictEqual(options.body, JSON.stringify(requestData));
    });
  });

  describe('Request Headers', () => {
    it('should set correct default headers', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects');

      const [url, options] = mockFetch.firstCall.args;
      const headers = options.headers;

      assert.strictEqual(headers['Accept'], 'application/json');
      assert.strictEqual(headers['Content-Type'], 'application/json');
      assert.strictEqual(headers['User-Agent'], 'Azure-Pipelines-Assistant-VSCode-Extension');
      assert.ok(headers['Authorization'].startsWith('Basic '));
    });

    it('should merge custom headers', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects', {
        headers: { 'Custom-Header': 'custom-value' }
      });

      const [url, options] = mockFetch.firstCall.args;
      const headers = options.headers;

      assert.strictEqual(headers['Custom-Header'], 'custom-value');
      assert.strictEqual(headers['Accept'], 'application/json'); // Default headers still present
    });

    it('should encode PAT correctly in Authorization header', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects');

      const [url, options] = mockFetch.firstCall.args;
      const authHeader = options.headers['Authorization'];

      // PAT should be base64 encoded with colon prefix
      const expectedAuth = `Basic ${Buffer.from(':test-pat').toString('base64')}`;
      assert.strictEqual(authHeader, expectedAuth);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.rejects(new Error('ENOTFOUND'));

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown network error');
      } catch (error) {
        assert.ok(error instanceof ApiError);
        assert.strictEqual((error as ApiError).message, 'Network error');
        assert.strictEqual((error as ApiError).retryable, true);
      }
    });

    it('should handle timeout errors', async () => {
      mockFetch.rejects(new DOMException('The operation was aborted.', 'AbortError'));

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown timeout error');
      } catch (error) {
        assert(error instanceof ApiError);
        assert.strictEqual(error.message, 'Request timeout');
        assert.strictEqual(error.retryable, true);
      }
    });

    it('should handle HTTP error responses', async () => {
      const errorResponse = {
        message: 'Project not found',
        typeKey: 'ProjectDoesNotExistException'
      };
      mockFetch.resolves(createMockResponse(errorResponse, 404, 'Not Found', false));

      try {
        await apiClient.get('/_apis/projects/nonexistent');
        assert.fail('Should have thrown API error');
      } catch (error) {
        assert(error instanceof ApiError);
        assert.strictEqual(error.message, 'Project not found');
        assert.strictEqual(error.status, 404);
        assert.strictEqual(error.statusText, 'Not Found');
        assert.strictEqual(error.retryable, false);
      }
    });

    it('should handle rate limiting (429)', async () => {
      const mockResponse = createMockResponse(
        { message: 'Rate limit exceeded' },
        429,
        'Too Many Requests',
        false
      );
      mockResponse.headers.set('Retry-After', '60');
      mockFetch.resolves(mockResponse);

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown rate limit error');
      } catch (error) {
        assert(error instanceof ApiError);
        assert(error.message.includes('Rate limited'));
        assert.strictEqual(error.status, 429);
        assert.strictEqual(error.retryable, true);
      }
    });

    it('should handle malformed JSON responses', async () => {
      const mockResponse = new Response('invalid json', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
      mockFetch.resolves(mockResponse);

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown parse error');
      } catch (error) {
        assert(error instanceof ApiError);
        assert.strictEqual(error.message, 'Failed to parse response');
        assert.strictEqual(error.retryable, false);
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry on retryable errors', async () => {
      // Enable retries for this specific test
      apiClient.setRetryOptions({ maxRetries: 1 });

      // First call fails with network error, second succeeds
      mockFetch.onFirstCall().rejects(new Error('ECONNREFUSED'));
      mockFetch.onSecondCall().resolves(createMockResponse({ data: 'success' }));

      const response = await apiClient.get('/_apis/projects');

      assert.strictEqual(response.data.data, 'success');
      assert.strictEqual(mockFetch.callCount, 2);
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.resolves(createMockResponse(
        { message: 'Unauthorized' },
        401,
        'Unauthorized',
        false
      ));

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown unauthorized error');
      } catch (error) {
        assert(error instanceof ApiError);
        assert.strictEqual(error.status, 401);
        assert.strictEqual(mockFetch.callCount, 1); // No retry
      }
    });

    it('should respect max retry attempts', async () => {
      // Enable retries for this specific test with fast delays
      apiClient.setRetryOptions({ maxRetries: 3, baseDelay: 1, maxDelay: 10 });
      mockFetch.rejects(new Error('ECONNREFUSED'));

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown error after max retries');
      } catch (error) {
        assert(error instanceof ApiError);
        // Should be called 4 times (initial + 3 retries)
        assert.strictEqual(mockFetch.callCount, 4);
      }
    });

    it('should allow configuring retry options', async () => {
      apiClient.setRetryOptions({ maxRetries: 1, baseDelay: 1, maxDelay: 10 });
      mockFetch.rejects(new Error('ECONNREFUSED'));

      try {
        await apiClient.get('/_apis/projects');
        assert.fail('Should have thrown error after max retries');
      } catch (error) {
        assert(error instanceof ApiError);
        // Should be called 2 times (initial + 1 retry)
        assert.strictEqual(mockFetch.callCount, 2);
      }
    });
  });

  describe('Rate Limit Tracking', () => {
    it('should track rate limit information from headers', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockResponse.headers.set('X-RateLimit-Limit', '5000');
      mockResponse.headers.set('X-RateLimit-Remaining', '4999');
      mockResponse.headers.set('X-RateLimit-Reset', '1640995200'); // Unix timestamp
      mockFetch.resolves(mockResponse);

      await apiClient.get('/_apis/projects');

      const rateLimitInfo = apiClient.getRateLimitInfo();
      assert(rateLimitInfo);
      assert.strictEqual(rateLimitInfo.limit, 5000);
      assert.strictEqual(rateLimitInfo.remaining, 4999);
      assert.strictEqual(rateLimitInfo.resetTime.getTime(), 1640995200000);
    });

    it('should return null when no rate limit headers present', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects');

      const rateLimitInfo = apiClient.getRateLimitInfo();
      assert.strictEqual(rateLimitInfo, null);
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON responses', async () => {
      const responseData = { value: [{ id: '1', name: 'Test' }] };
      mockFetch.resolves(createMockResponse(responseData));

      const response = await apiClient.get('/_apis/projects');

      assert.deepStrictEqual(response.data, responseData);
    });

    it('should handle text responses', async () => {
      const mockResponse = new Response('plain text response', {
        status: 200,
        headers: { 'content-type': 'text/plain' }
      });
      mockFetch.resolves(mockResponse);

      const response = await apiClient.get('/_apis/projects');

      assert.strictEqual(response.data, 'plain text response');
    });

    it('should extract response headers', async () => {
      const mockResponse = createMockResponse({ data: 'test' });
      mockResponse.headers.set('X-Custom-Header', 'custom-value');
      mockFetch.resolves(mockResponse);

      const response = await apiClient.get('/_apis/projects');

      assert.strictEqual(response.headers['x-custom-header'], 'custom-value');
    });
  });

  describe('Request Timeout', () => {
    it('should use default timeout', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects');

      const [url, options] = mockFetch.firstCall.args;
      assert(options.signal);
      // AbortSignal.timeout is used, we can't easily test the exact timeout value
    });

    it('should use custom timeout', async () => {
      mockFetch.resolves(createMockResponse({ data: 'test' }));

      await apiClient.get('/_apis/projects', { timeout: 5000 });

      const [url, options] = mockFetch.firstCall.args;
      assert(options.signal);
      // Custom timeout is applied through AbortSignal.timeout
    });
  });
});

// Helper function to create mock Response objects
function createMockResponse(
  data: any,
  status: number = 200,
  statusText: string = 'OK',
  ok: boolean = true
): Response {
  const headers = new Headers({
    'content-type': 'application/json'
  });

  // Handle empty responses for DELETE and other operations
  let body: string | null = null;
  if (data !== null && data !== undefined) {
    body = typeof data === 'string' ? data : JSON.stringify(data);
  }

  const response = new Response(body, {
    status,
    statusText,
    headers
  });

  // Override the ok property since it's readonly
  Object.defineProperty(response, 'ok', {
    value: ok,
    writable: false
  });

  return response;
}