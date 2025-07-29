import * as assert from 'assert';
import * as https from 'https';
import * as sinon from 'sinon';
import { AuthenticationError, NetworkError } from '../../../errors';
import { IAuthenticationService } from '../../../interfaces';
import { AzureDevOpsApiClient } from '../../../services/apiClient';
import { MockDataFactory } from '../../fixtures/mockData';

suite('ApiClient Unit Tests', () => {
  let apiClient: AzureDevOpsApiClient;
  let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
  let httpsRequestStub: sinon.SinonStub;

  setup(async () => {
    mockAuthService = {
      isAuthenticated: sinon.stub().returns(true) as sinon.SinonStub<[], boolean>,
      getCurrentOrganization: sinon.stub().returns('testorg') as sinon.SinonStub<[], string | null>,
      getStoredCredentials: sinon.stub(),
      validateCredentials: sinon.stub(),
      storeCredentials: sinon.stub(),
      clearCredentials: sinon.stub(),
      onAuthenticationChanged: sinon.stub()
    };

    // Mock credentials
    const mockCredentials = MockDataFactory.createCredentials();
    mockAuthService.getStoredCredentials.resolves(mockCredentials);

    apiClient = new AzureDevOpsApiClient();
    await apiClient.setAuthentication(mockCredentials.organization, mockCredentials.personalAccessToken);

    // Stub https.request
    httpsRequestStub = sinon.stub(https, 'request');
  });

  teardown(() => {
    sinon.restore();
  });

  const createMockResponse = (statusCode: number, data: any) => {
    const mockResponse = {
      statusCode,
      headers: { 'content-type': 'application/json' },
      on: sinon.stub(),
      setEncoding: sinon.stub()
    };

    // Simulate response data
    mockResponse.on.withArgs('data').callsArgWith(1, JSON.stringify(data));
    mockResponse.on.withArgs('end').callsArg(1);

    return mockResponse;
  };

  const createMockRequest = (response: any) => {
    const mockRequest = {
      on: sinon.stub(),
      write: sinon.stub(),
      end: sinon.stub(),
      setTimeout: sinon.stub()
    };

    // Simulate successful request
    httpsRequestStub.callsArgWith(1, response).returns(mockRequest);

    return mockRequest;
  };

  suite('get', () => {
    test('should make successful GET request', async () => {
      const testData = { value: [{ id: 1, name: 'test' }] };
      const mockResponse = createMockResponse(200, testData);
      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.get('/test-endpoint');

      assert.deepStrictEqual(result, testData);
      assert.ok(httpsRequestStub.calledOnce);

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.strictEqual(requestOptions.method, 'GET');
      assert.strictEqual(requestOptions.hostname, 'dev.azure.com');
      assert.strictEqual(requestOptions.path, '/testorg/test-endpoint');
      assert.ok(requestOptions.headers.Authorization.includes('Basic'));
    });

    test('should handle 401 authentication error', async () => {
      const mockResponse = createMockResponse(401, { message: 'Unauthorized' });
      const mockRequest = createMockRequest(mockResponse);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected AuthenticationError');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'INVALID_PAT');
      }
    });

    test('should handle 404 not found error', async () => {
      const mockResponse = createMockResponse(404, { message: 'Not Found' });
      const mockRequest = createMockRequest(mockResponse);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });

    test('should handle network timeout', async () => {
      const mockRequest = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        setTimeout: sinon.stub()
      };

      httpsRequestStub.returns(mockRequest);

      // Simulate timeout
      mockRequest.on.withArgs('timeout').callsArg(1);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.ok(error.message.includes('timeout'));
      }
    });

    test('should handle request error', async () => {
      const mockRequest = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        setTimeout: sinon.stub()
      };

      httpsRequestStub.returns(mockRequest);

      // Simulate request error
      const testError = new Error('Connection refused');
      mockRequest.on.withArgs('error').callsArgWith(1, testError);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.message, 'Connection refused');
      }
    });

    test('should throw error when not authenticated', async () => {
      mockAuthService.isAuthenticated.returns(false);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected AuthenticationError');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.message, 'Not authenticated');
      }
    });
  });

  suite('post', () => {
    test('should make successful POST request', async () => {
      const requestData = { name: 'test', value: 123 };
      const responseData = { id: 1, ...requestData };
      const mockResponse = createMockResponse(201, responseData);
      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.post('/test-endpoint', requestData);

      assert.deepStrictEqual(result, responseData);
      assert.ok(httpsRequestStub.calledOnce);

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.strictEqual(requestOptions.method, 'POST');
      assert.strictEqual(requestOptions.headers['Content-Type'], 'application/json');
      assert.ok(mockRequest.write.calledWith(JSON.stringify(requestData)));
    });

    test('should handle POST with empty body', async () => {
      const responseData = { success: true };
      const mockResponse = createMockResponse(200, responseData);
      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.post('/test-endpoint');

      assert.deepStrictEqual(result, responseData);
      assert.ok(mockRequest.write.notCalled);
    });

    test('should handle 400 bad request error', async () => {
      const mockResponse = createMockResponse(400, { message: 'Bad Request' });
      const mockRequest = createMockRequest(mockResponse);

      try {
        await apiClient.post('/test-endpoint', { invalid: 'data' });
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 400);
      }
    });
  });

  suite('put', () => {
    test('should make successful PUT request', async () => {
      const requestData = { id: 1, name: 'updated' };
      const responseData = { ...requestData, lastModified: new Date() };
      const mockResponse = createMockResponse(200, responseData);
      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.put('/test-endpoint/1', requestData);

      assert.deepStrictEqual(result, responseData);
      assert.ok(httpsRequestStub.calledOnce);

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.strictEqual(requestOptions.method, 'PUT');
    });
  });

  suite('patch', () => {
    test('should make successful PATCH request', async () => {
      const requestData = { status: 'Cancelling' };
      const responseData = { id: 1, status: 'Cancelling' };
      const mockResponse = createMockResponse(200, responseData);
      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.patch('/test-endpoint/1', requestData);

      assert.deepStrictEqual(result, responseData);
      assert.ok(httpsRequestStub.calledOnce);

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.strictEqual(requestOptions.method, 'PATCH');
    });
  });

  suite('delete', () => {
    test('should make successful DELETE request', async () => {
      const mockResponse = createMockResponse(204, null);
      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.delete('/test-endpoint/1');

      assert.strictEqual(result, null);
      assert.ok(httpsRequestStub.calledOnce);

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.strictEqual(requestOptions.method, 'DELETE');
    });

    test('should handle 404 for delete request', async () => {
      const mockResponse = createMockResponse(404, { message: 'Not Found' });
      const mockRequest = createMockRequest(mockResponse);

      try {
        await apiClient.delete('/test-endpoint/999');
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 404);
      }
    });
  });

  suite('retry logic', () => {
    test('should retry on 429 rate limit error', async () => {
      const testData = { value: 'success' };

      // First call returns 429, second call succeeds
      const mockResponse429 = createMockResponse(429, { message: 'Rate limit exceeded' });
      const mockResponse200 = createMockResponse(200, testData);

      httpsRequestStub.onFirstCall().callsArgWith(1, mockResponse429).returns({
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        setTimeout: sinon.stub()
      });

      httpsRequestStub.onSecondCall().callsArgWith(1, mockResponse200).returns({
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        setTimeout: sinon.stub()
      });

      const result = await apiClient.get('/test-endpoint');

      assert.deepStrictEqual(result, testData);
      assert.strictEqual(httpsRequestStub.callCount, 2);
    });

    test('should fail after max retries', async () => {
      const mockResponse = createMockResponse(500, { message: 'Internal Server Error' });
      const mockRequest = {
        on: sinon.stub(),
        write: sinon.stub(),
        end: sinon.stub(),
        setTimeout: sinon.stub()
      };

      httpsRequestStub.returns(mockRequest);
      httpsRequestStub.callsArgWith(1, mockResponse);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.strictEqual(error.statusCode, 500);
        // Should have tried multiple times
        assert.ok(httpsRequestStub.callCount > 1);
      }
    });
  });

  suite('request headers', () => {
    test('should include proper authentication headers', async () => {
      const testData = { value: 'test' };
      const mockResponse = createMockResponse(200, testData);
      const mockRequest = createMockRequest(mockResponse);

      await apiClient.get('/test-endpoint');

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.ok(requestOptions.headers.Authorization);
      assert.ok(requestOptions.headers.Authorization.startsWith('Basic '));
      assert.strictEqual(requestOptions.headers['User-Agent'], 'Azure-Pipelines-Assistant/1.0');
      assert.strictEqual(requestOptions.headers['Accept'], 'application/json');
    });

    test('should include content-type for POST requests', async () => {
      const testData = { success: true };
      const mockResponse = createMockResponse(200, testData);
      const mockRequest = createMockRequest(mockResponse);

      await apiClient.post('/test-endpoint', { data: 'test' });

      const requestOptions = httpsRequestStub.getCall(0).args[0];
      assert.strictEqual(requestOptions.headers['Content-Type'], 'application/json');
    });
  });

  suite('response parsing', () => {
    test('should handle non-JSON responses', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        on: sinon.stub(),
        setEncoding: sinon.stub()
      };

      mockResponse.on.withArgs('data').callsArgWith(1, 'plain text response');
      mockResponse.on.withArgs('end').callsArg(1);

      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.get('/test-endpoint');

      assert.strictEqual(result, 'plain text response');
    });

    test('should handle empty responses', async () => {
      const mockResponse = {
        statusCode: 204,
        headers: { 'content-type': 'application/json' },
        on: sinon.stub(),
        setEncoding: sinon.stub()
      };

      mockResponse.on.withArgs('data').callsArgWith(1, '');
      mockResponse.on.withArgs('end').callsArg(1);

      const mockRequest = createMockRequest(mockResponse);

      const result = await apiClient.get('/test-endpoint');

      assert.strictEqual(result, null);
    });

    test('should handle malformed JSON responses', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        on: sinon.stub(),
        setEncoding: sinon.stub()
      };

      mockResponse.on.withArgs('data').callsArgWith(1, '{ invalid json }');
      mockResponse.on.withArgs('end').callsArg(1);

      const mockRequest = createMockRequest(mockResponse);

      try {
        await apiClient.get('/test-endpoint');
        assert.fail('Expected NetworkError');
      } catch (error) {
        assert.ok(error instanceof NetworkError);
        assert.ok(error.message.includes('Invalid JSON'));
      }
    });
  });
});