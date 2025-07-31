import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ValidationResult } from '../../interfaces/authenticationService';
import { ConfigurationWelcomeProvider } from '../../providers/configurationWelcomeProvider';

suite('ConfigurationWelcomeProvider', () => {
  let provider: ConfigurationWelcomeProvider;
  let mockAuthService: any;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewView: vscode.WebviewView;
  let mockWebview: vscode.Webview;

  const validValidationResult: ValidationResult = {
    isValid: true,
    permissions: [
      { name: 'Build', displayName: 'Build (read)', required: true }
    ],
    missingPermissions: []
  };

  const invalidValidationResult: ValidationResult = {
    isValid: false,
    permissions: [],
    missingPermissions: [
      { name: 'Build', displayName: 'Build (read)', required: true }
    ],
    errorMessage: 'Invalid credentials'
  };

  setup(() => {
    // Create mock services
    mockAuthService = {
      validateCredentials: sinon.stub(),
      storeCredentials: sinon.stub(),
      onAuthenticationChanged: sinon.stub().returns({ dispose: sinon.stub() })
    };

    mockContext = {
      extensionUri: vscode.Uri.file('/test/extension')
    } as any;

    mockWebview = {
      options: {},
      html: '',
      postMessage: sinon.stub(),
      onDidReceiveMessage: sinon.stub().returns({ dispose: sinon.stub() }),
      asWebviewUri: sinon.stub().returns(vscode.Uri.file('/test/media/welcome.css')),
      cspSource: 'vscode-webview:'
    } as any;

    mockWebviewView = {
      webview: mockWebview
    } as any;

    provider = new ConfigurationWelcomeProvider(mockContext, mockAuthService);
  });

  teardown(() => {
    sinon.restore();
    provider.dispose();
  });

  suite('resolveWebviewView', () => {
    test('should set webview options and HTML', () => {
      // Act
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Assert
      assert.ok(mockWebview.options.enableScripts);
      assert.ok(mockWebview.html.includes('Azure Pipelines Configuration'));
    });

    test('should setup message handling', () => {
      // Act
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Assert
      assert.ok((mockWebview.onDidReceiveMessage as sinon.SinonStub).called);
    });
  });

  suite('HTML generation', () => {
    test('should generate valid HTML with form elements', () => {
      // Act
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Assert
      const html = mockWebview.html;
      assert.ok(html.includes('id="organization"'));
      assert.ok(html.includes('id="pat"'));
      assert.ok(html.includes('id="configForm"'));
    });

    test('should include CSP nonce', () => {
      // Act
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Assert
      const html = mockWebview.html;
      assert.ok(html.includes('nonce='));
    });
  });

  suite('input validation', () => {
    test('should validate empty inputs', () => {
      // This test verifies the validation logic exists
      // The actual validation happens in the webview JavaScript
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Assert HTML contains validation logic
      const html = mockWebview.html;
      assert.ok(html.includes('validateOrganization'));
      assert.ok(html.includes('validatePAT'));
    });
  });

  suite('dispose', () => {
    test('should dispose cleanly', () => {
      // Act & Assert - should not throw
      assert.doesNotThrow(() => provider.dispose());
    });
  });
});