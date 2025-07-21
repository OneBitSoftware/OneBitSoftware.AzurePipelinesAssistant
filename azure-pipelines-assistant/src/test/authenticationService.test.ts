import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { AuthenticationService } from '../services/authenticationService';
import { AuthenticationError, Credentials, ValidationResult } from '../interfaces/authenticationService';

suite('AuthenticationService Test Suite', () => {
  let authService: AuthenticationService;
  let mockContext: vscode.ExtensionContext;
  let mockSecrets: sinon.SinonStubbedInstance<vscode.SecretStorage>;
  let httpRequestStub: sinon.SinonStub;

  setup(() => {
    // Create mock secrets storage
    mockSecrets = {
      get: sinon.stub(),
      store: sinon.stub(),
      delete: sinon.stub(),
      onDidChange: sinon.stub()
    };

    // Create mock extension context
    mockContext = {
      secrets: mockSecrets,
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: {} as any,
      extensionPath: '',
      environmentVariableCollection: {} as any,
      asAbsolutePath: sinon.stub(),
      storageUri: {} as any,
      storagePath: '',
      globalStorageUri: {} as any,
      globalStoragePath: '',
      logUri: {} as any,
      logPath: '',
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      languageModelAccessInformation: {} as any
    };

    authService = new AuthenticationService(mockContext);

    // Stub the private makeHttpRequest method
    httpRequestStub = sinon.stub(authService as any, 'makeHttpRequest');
  });

  teardown(() => {
    sinon.restore();
  });

  suite('validateCredentials', () => {
    test('should throw AuthenticationError when organization is empty', async () => {
      try {
        await authService.validateCredentials('', 'valid-pat');
        assert.fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'INVALID_PAT');
        assert.strictEqual(error.message, 'Organization and Personal Access Token are required');
      }
    });

    test('should throw AuthenticationError when PAT is empty', async () => {
      try {
        await authService.validateCredentials('myorg', '');
        assert.fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'INVALID_PAT');
        assert.strictEqual(error.message, 'Organization and Personal Access Token are required');
      }
    });

    test('should return valid result when credentials are correct and have all permissions', async () => {
      const mockUserProfile = {
        displayName: 'John Doe',
        emailAddress: 'john.doe@example.com',
        id: '12345'
      };

      // Mock successful API calls
      httpRequestStub.onFirstCall().resolves(JSON.stringify(mockUserProfile));
      httpRequestStub.onSecondCall().resolves('{}'); // Build permission
      httpRequestStub.onThirdCall().resolves('{}'); // Code permission
      httpRequestStub.onCall(3).resolves('{}'); // Project permission
      httpRequestStub.onCall(4).resolves('{}'); // Release permission

      const result = await authService.validateCredentials('myorg', 'valid-pat');

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.permissions.length, 4);
      assert.strictEqual(result.missingPermissions.length, 0);
      assert.deepStrictEqual(result.userInfo, mockUserProfile);
      assert.strictEqual(result.errorMessage, undefined);
    });

    test('should return invalid result when PAT is invalid (401)', async () => {
      httpRequestStub.rejects(new Error('HTTP 401: Unauthorized'));

      const result = await authService.validateCredentials('myorg', 'invalid-pat');

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.permissions.length, 0);
      assert.strictEqual(result.missingPermissions.length, 4);
      assert.strictEqual(result.errorMessage, 'Invalid Personal Access Token');
    });

    test('should return invalid result when organization is invalid (404)', async () => {
      httpRequestStub.rejects(new Error('HTTP 404: Not Found'));

      const result = await authService.validateCredentials('invalidorg', 'valid-pat');

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.permissions.length, 0);
      assert.strictEqual(result.missingPermissions.length, 4);
      assert.strictEqual(result.errorMessage, 'Invalid organization name');
    });

    test('should return invalid result when some permissions are missing', async () => {
      const mockUserProfile = {
        displayName: 'John Doe',
        emailAddress: 'john.doe@example.com',
        id: '12345'
      };

      // Mock successful user profile call but failed permission checks
      httpRequestStub.onFirstCall().resolves(JSON.stringify(mockUserProfile));
      httpRequestStub.onSecondCall().resolves('{}'); // Build permission - success
      httpRequestStub.onThirdCall().rejects(new Error('HTTP 403: Forbidden')); // Code permission - fail
      httpRequestStub.onCall(3).resolves('{}'); // Project permission - success
      httpRequestStub.onCall(4).rejects(new Error('HTTP 403: Forbidden')); // Release permission - fail

      const result = await authService.validateCredentials('myorg', 'limited-pat');

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.permissions.length, 2); // Build and Project
      assert.strictEqual(result.missingPermissions.length, 2); // Code and Release
      assert.deepStrictEqual(result.userInfo, mockUserProfile);
    });

    test('should return invalid result for network errors', async () => {
      httpRequestStub.rejects(new Error('Network error'));

      const result = await authService.validateCredentials('myorg', 'valid-pat');

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.permissions.length, 0);
      assert.strictEqual(result.missingPermissions.length, 4);
      assert.strictEqual(result.errorMessage, 'Failed to get user profile');
    });
  });

  suite('getStoredCredentials', () => {
    test('should return null when no credentials are stored', async () => {
      mockSecrets.get.resolves(undefined);

      const result = await authService.getStoredCredentials();

      assert.strictEqual(result, null);
      assert.ok(mockSecrets.get.calledWith('azurePipelinesAssistant.credentials'));
    });

    test('should return credentials when valid credentials are stored', async () => {
      const storedCredentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.get.resolves(JSON.stringify(storedCredentials));

      const result = await authService.getStoredCredentials();

      assert.deepStrictEqual(result, storedCredentials);
    });

    test('should clear and return null when invalid credentials structure is found', async () => {
      const invalidCredentials = { organization: 'myorg' }; // Missing PAT
      mockSecrets.get.resolves(JSON.stringify(invalidCredentials));
      mockSecrets.delete.resolves();

      const result = await authService.getStoredCredentials();

      assert.strictEqual(result, null);
      assert.ok(mockSecrets.delete.calledWith('azurePipelinesAssistant.credentials'));
    });

    test('should return null when JSON parsing fails', async () => {
      mockSecrets.get.resolves('invalid-json');

      const result = await authService.getStoredCredentials();

      assert.strictEqual(result, null);
    });

    test('should return null when secrets.get throws an error', async () => {
      mockSecrets.get.rejects(new Error('Storage error'));

      const result = await authService.getStoredCredentials();

      assert.strictEqual(result, null);
    });
  });

  suite('storeCredentials', () => {
    test('should store valid credentials successfully', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();

      await authService.storeCredentials(credentials);

      assert.ok(mockSecrets.store.calledWith('azurePipelinesAssistant.credentials', JSON.stringify(credentials)));
      assert.strictEqual(authService.isAuthenticated(), true);
      assert.strictEqual(authService.getCurrentOrganization(), 'myorg');
    });

    test('should throw AuthenticationError when organization is missing', async () => {
      const invalidCredentials = {
        organization: '',
        personalAccessToken: 'my-pat'
      } as Credentials;

      try {
        await authService.storeCredentials(invalidCredentials);
        assert.fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'INVALID_PAT');
        assert.strictEqual(error.message, 'Invalid credentials: organization and PAT are required');
      }
    });

    test('should throw AuthenticationError when PAT is missing', async () => {
      const invalidCredentials = {
        organization: 'myorg',
        personalAccessToken: ''
      } as Credentials;

      try {
        await authService.storeCredentials(invalidCredentials);
        assert.fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'INVALID_PAT');
        assert.strictEqual(error.message, 'Invalid credentials: organization and PAT are required');
      }
    });

    test('should throw AuthenticationError when storage fails', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.rejects(new Error('Storage error'));

      try {
        await authService.storeCredentials(credentials);
        assert.fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'NETWORK_ERROR');
        assert.strictEqual(error.message, 'Failed to store credentials securely');
      }
    });
  });

  suite('clearCredentials', () => {
    test('should clear credentials successfully', async () => {
      mockSecrets.delete.resolves();

      await authService.clearCredentials();

      assert.ok(mockSecrets.delete.calledWith('azurePipelinesAssistant.credentials'));
      assert.strictEqual(authService.isAuthenticated(), false);
      assert.strictEqual(authService.getCurrentOrganization(), null);
    });

    test('should throw AuthenticationError when clearing fails', async () => {
      mockSecrets.delete.rejects(new Error('Storage error'));

      try {
        await authService.clearCredentials();
        assert.fail('Expected AuthenticationError to be thrown');
      } catch (error) {
        assert.ok(error instanceof AuthenticationError);
        assert.strictEqual(error.errorCode, 'NETWORK_ERROR');
        assert.strictEqual(error.message, 'Failed to clear credentials');
      }
    });
  });

  suite('isAuthenticated', () => {
    test('should return false initially', () => {
      assert.strictEqual(authService.isAuthenticated(), false);
    });

    test('should return true after storing credentials', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();

      await authService.storeCredentials(credentials);

      assert.strictEqual(authService.isAuthenticated(), true);
    });

    test('should return false after clearing credentials', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();
      mockSecrets.delete.resolves();

      await authService.storeCredentials(credentials);
      assert.strictEqual(authService.isAuthenticated(), true);

      await authService.clearCredentials();
      assert.strictEqual(authService.isAuthenticated(), false);
    });
  });

  suite('getCurrentOrganization', () => {
    test('should return null initially', () => {
      assert.strictEqual(authService.getCurrentOrganization(), null);
    });

    test('should return organization after storing credentials', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();

      await authService.storeCredentials(credentials);

      assert.strictEqual(authService.getCurrentOrganization(), 'myorg');
    });

    test('should return null after clearing credentials', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();
      mockSecrets.delete.resolves();

      await authService.storeCredentials(credentials);
      await authService.clearCredentials();

      assert.strictEqual(authService.getCurrentOrganization(), null);
    });
  });

  suite('onAuthenticationChanged event', () => {
    test('should fire event when credentials are stored', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();

      let eventFired = false;
      let eventValue: boolean | undefined;

      const disposable = authService.onAuthenticationChanged((authenticated) => {
        eventFired = true;
        eventValue = authenticated;
      });

      await authService.storeCredentials(credentials);

      assert.strictEqual(eventFired, true);
      assert.strictEqual(eventValue, true);

      disposable.dispose();
    });

    test('should fire event when credentials are cleared', async () => {
      const credentials: Credentials = {
        organization: 'myorg',
        personalAccessToken: 'my-pat'
      };
      mockSecrets.store.resolves();
      mockSecrets.delete.resolves();

      await authService.storeCredentials(credentials);

      let eventFired = false;
      let eventValue: boolean | undefined;

      const disposable = authService.onAuthenticationChanged((authenticated) => {
        eventFired = true;
        eventValue = authenticated;
      });

      await authService.clearCredentials();

      assert.strictEqual(eventFired, true);
      assert.strictEqual(eventValue, false);

      disposable.dispose();
    });
  });

  suite('dispose', () => {
    test('should dispose event emitter', () => {
      // This test ensures the dispose method exists and can be called
      assert.doesNotThrow(() => {
        authService.dispose();
      });
    });
  });
});