import * as vscode from 'vscode';
import { AuthenticationError } from '../errors/errorTypes';
import { IAuthenticationService } from '../interfaces/authenticationService';

/**
 * Configuration welcome view provider implementing vscode.WebviewViewProvider interface
 * Provides configuration form with organization and PAT input fields
 */
export class ConfigurationWelcomeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'azurePipelinesWelcome';

  private _view?: vscode.WebviewView;
  private _isConfiguring = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly authService: IAuthenticationService
  ) { }

  /**
   * Resolve webview view when it becomes visible
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getWelcomeHtml();
    this.setupMessageHandling(webviewView.webview);

    // Listen for authentication changes to update view
    this.authService.onAuthenticationChanged((authenticated) => {
      if (authenticated && this._view) {
        this.showSuccessMessage('Configuration successful! You can now view your pipelines.');
      }
    });
  }

  /**
   * Generate HTML template for configuration form
   */
  private getWelcomeHtml(): string {
    const nonce = this.getNonce();
    const styleUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'welcome.css')
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._view?.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
          <title>Azure Pipelines Configuration</title>
          <style>
            body {
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              font-weight: var(--vscode-font-weight);
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
              padding: 20px;
              margin: 0;
              line-height: 1.5;
            }

            .welcome-container {
              max-width: 500px;
              margin: 0 auto;
            }

            .welcome-header {
              text-align: center;
              margin-bottom: 30px;
            }

            .welcome-header h1 {
              color: var(--vscode-foreground);
              font-size: 24px;
              font-weight: 600;
              margin: 0 0 10px 0;
            }

            .welcome-header p {
              color: var(--vscode-descriptionForeground);
              margin: 0;
            }

            .config-form {
              display: flex;
              flex-direction: column;
              gap: 20px;
            }

            .form-group {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .form-group label {
              font-weight: 600;
              color: var(--vscode-input-foreground);
              font-size: 13px;
            }

            .form-group input {
              padding: 8px 12px;
              border: 1px solid var(--vscode-input-border);
              background: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
              border-radius: 2px;
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              outline: none;
              transition: border-color 0.2s;
            }

            .form-group input:focus {
              border-color: var(--vscode-focusBorder);
            }

            .form-group input::placeholder {
              color: var(--vscode-input-placeholderForeground);
            }

            .form-group .help-text {
              font-size: 12px;
              color: var(--vscode-descriptionForeground);
              margin-top: 4px;
            }

            .form-group .help-link {
              color: var(--vscode-textLink-foreground);
              text-decoration: none;
              cursor: pointer;
            }

            .form-group .help-link:hover {
              color: var(--vscode-textLink-activeForeground);
              text-decoration: underline;
            }

            .form-actions {
              display: flex;
              flex-direction: column;
              gap: 12px;
              margin-top: 10px;
            }

            .btn {
              padding: 10px 20px;
              border: none;
              border-radius: 2px;
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              font-weight: 500;
              cursor: pointer;
              transition: background-color 0.2s;
              outline: none;
            }

            .btn-primary {
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
            }

            .btn-primary:hover:not(:disabled) {
              background: var(--vscode-button-hoverBackground);
            }

            .btn-primary:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }

            .btn-secondary {
              background: var(--vscode-button-secondaryBackground);
              color: var(--vscode-button-secondaryForeground);
            }

            .btn-secondary:hover:not(:disabled) {
              background: var(--vscode-button-secondaryHoverBackground);
            }

            .message {
              padding: 12px;
              border-radius: 4px;
              margin-bottom: 20px;
              font-size: 13px;
              display: none;
            }

            .message.show {
              display: block;
            }

            .message-error {
              background: var(--vscode-inputValidation-errorBackground);
              border: 1px solid var(--vscode-inputValidation-errorBorder);
              color: var(--vscode-inputValidation-errorForeground);
            }

            .message-success {
              background: var(--vscode-terminal-ansiGreen);
              color: var(--vscode-terminal-background);
              border: 1px solid var(--vscode-terminal-ansiGreen);
            }

            .message-warning {
              background: var(--vscode-inputValidation-warningBackground);
              border: 1px solid var(--vscode-inputValidation-warningBorder);
              color: var(--vscode-inputValidation-warningForeground);
            }

            .field-error {
              border-color: var(--vscode-inputValidation-errorBorder) !important;
            }

            .field-error-message {
              color: var(--vscode-inputValidation-errorForeground);
              font-size: 12px;
              margin-top: 4px;
              display: none;
            }

            .field-error-message.show {
              display: block;
            }

            .loading-spinner {
              display: none;
              width: 16px;
              height: 16px;
              border: 2px solid var(--vscode-progressBar-background);
              border-top: 2px solid var(--vscode-button-foreground);
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-right: 8px;
            }

            .loading-spinner.show {
              display: inline-block;
            }

            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            .requirements {
              background: var(--vscode-textBlockQuote-background);
              border-left: 4px solid var(--vscode-textBlockQuote-border);
              padding: 16px;
              margin: 20px 0;
              border-radius: 0 4px 4px 0;
            }

            .requirements h3 {
              margin: 0 0 12px 0;
              color: var(--vscode-foreground);
              font-size: 14px;
              font-weight: 600;
            }

            .requirements ul {
              margin: 0;
              padding-left: 20px;
              color: var(--vscode-descriptionForeground);
            }

            .requirements li {
              margin-bottom: 4px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="welcome-container">
            <div class="welcome-header">
              <h1>Welcome to Azure Pipelines Assistant</h1>
              <p>Configure your Azure DevOps connection to get started</p>
            </div>

            <div id="generalMessage" class="message"></div>

            <form class="config-form" id="configForm">
              <div class="form-group">
                <label for="organization">Organization Name *</label>
                <input 
                  type="text" 
                  id="organization" 
                  name="organization"
                  placeholder="e.g., mycompany (from https://dev.azure.com/mycompany)"
                  required
                  autocomplete="off"
                />
                <div class="field-error-message" id="orgError"></div>
                <div class="help-text">
                  Enter your Azure DevOps organization name (the part after dev.azure.com/)
                </div>
              </div>
              
              <div class="form-group">
                <label for="pat">Personal Access Token *</label>
                <input 
                  type="password" 
                  id="pat" 
                  name="pat"
                  placeholder="Enter your Azure DevOps PAT"
                  required
                  autocomplete="off"
                />
                <div class="field-error-message" id="patError"></div>
                <div class="help-text">
                  Need a PAT? 
                  <a href="#" class="help-link" id="patHelpLink">
                    Learn how to create one →
                  </a>
                </div>
              </div>

              <div class="requirements">
                <h3>Required PAT Permissions</h3>
                <ul>
                  <li>Build (read)</li>
                  <li>Code (read)</li>
                  <li>Project and team (read)</li>
                  <li>Release (read)</li>
                </ul>
              </div>
              
              <div class="form-actions">
                <button type="submit" class="btn btn-primary" id="configureBtn">
                  <span class="loading-spinner" id="loadingSpinner"></span>
                  <span id="buttonText">Configure Extension</span>
                </button>
                <button type="button" class="btn btn-secondary" id="testConnectionBtn">
                  Test Connection
                </button>
              </div>
            </form>
          </div>
          
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            // Form elements
            const form = document.getElementById('configForm');
            const orgInput = document.getElementById('organization');
            const patInput = document.getElementById('pat');
            const configureBtn = document.getElementById('configureBtn');
            const testConnectionBtn = document.getElementById('testConnectionBtn');
            const generalMessage = document.getElementById('generalMessage');
            const orgError = document.getElementById('orgError');
            const patError = document.getElementById('patError');
            const loadingSpinner = document.getElementById('loadingSpinner');
            const buttonText = document.getElementById('buttonText');
            const patHelpLink = document.getElementById('patHelpLink');

            // Real-time form validation
            orgInput.addEventListener('input', validateOrganization);
            patInput.addEventListener('input', validatePAT);
            
            function validateOrganization() {
              const value = orgInput.value.trim();
              clearFieldError('organization');
              
              if (!value) {
                showFieldError('organization', 'Organization name is required');
                return false;
              }
              
              // Basic validation for organization name format
              if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(value) && value.length > 1) {
                showFieldError('organization', 'Invalid organization name format');
                return false;
              }
              
              return true;
            }
            
            function validatePAT() {
              const value = patInput.value.trim();
              clearFieldError('pat');
              
              if (!value) {
                showFieldError('pat', 'Personal Access Token is required');
                return false;
              }
              
              // Basic PAT format validation (Azure DevOps PATs are typically 52 characters)
              if (value.length < 20) {
                showFieldError('pat', 'PAT appears to be too short');
                return false;
              }
              
              return true;
            }
            
            function showFieldError(fieldName, message) {
              const input = document.getElementById(fieldName);
              const errorElement = document.getElementById(fieldName + 'Error');
              
              input.classList.add('field-error');
              errorElement.textContent = message;
              errorElement.classList.add('show');
            }
            
            function clearFieldError(fieldName) {
              const input = document.getElementById(fieldName);
              const errorElement = document.getElementById(fieldName + 'Error');
              
              input.classList.remove('field-error');
              errorElement.classList.remove('show');
              errorElement.textContent = '';
            }
            
            function showMessage(message, type = 'error') {
              generalMessage.textContent = message;
              generalMessage.className = 'message message-' + type + ' show';
            }
            
            function hideMessage() {
              generalMessage.classList.remove('show');
            }
            
            function setLoading(loading) {
              if (loading) {
                loadingSpinner.classList.add('show');
                buttonText.textContent = 'Configuring...';
                configureBtn.disabled = true;
                testConnectionBtn.disabled = true;
              } else {
                loadingSpinner.classList.remove('show');
                buttonText.textContent = 'Configure Extension';
                configureBtn.disabled = false;
                testConnectionBtn.disabled = false;
              }
            }

            // Form submission
            form.addEventListener('submit', (e) => {
              e.preventDefault();
              
              const organization = orgInput.value.trim();
              const pat = patInput.value.trim();
              
              // Clear previous messages
              hideMessage();
              clearFieldError('organization');
              clearFieldError('pat');
              
              // Validate form
              const isOrgValid = validateOrganization();
              const isPATValid = validatePAT();
              
              if (!isOrgValid || !isPATValid) {
                showMessage('Please fix the errors above', 'error');
                return;
              }
              
              setLoading(true);
              
              vscode.postMessage({
                command: 'configure',
                organization,
                pat
              });
            });
            
            // Test connection button
            testConnectionBtn.addEventListener('click', () => {
              const organization = orgInput.value.trim();
              const pat = patInput.value.trim();
              
              // Clear previous messages
              hideMessage();
              clearFieldError('organization');
              clearFieldError('pat');
              
              // Validate form
              const isOrgValid = validateOrganization();
              const isPATValid = validatePAT();
              
              if (!isOrgValid || !isPATValid) {
                showMessage('Please fix the errors above', 'error');
                return;
              }
              
              setLoading(true);
              
              vscode.postMessage({
                command: 'testConnection',
                organization,
                pat
              });
            });
            
            // PAT help link
            patHelpLink.addEventListener('click', (e) => {
              e.preventDefault();
              vscode.postMessage({
                command: 'openPatHelp'
              });
            });
            
            // Handle messages from extension
            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.command) {
                case 'configurationResult':
                  setLoading(false);
                  if (message.success) {
                    showMessage('Configuration successful! You can now view your pipelines.', 'success');
                    // Clear form after successful configuration
                    setTimeout(() => {
                      orgInput.value = '';
                      patInput.value = '';
                    }, 2000);
                  } else {
                    showMessage(message.error || 'Configuration failed', 'error');
                    
                    // Handle specific field errors
                    if (message.fieldErrors) {
                      if (message.fieldErrors.organization) {
                        showFieldError('organization', message.fieldErrors.organization);
                      }
                      if (message.fieldErrors.pat) {
                        showFieldError('pat', message.fieldErrors.pat);
                      }
                    }
                  }
                  break;
                  
                case 'testConnectionResult':
                  setLoading(false);
                  if (message.success) {
                    showMessage('Connection test successful! Your credentials are valid.', 'success');
                  } else {
                    showMessage(message.error || 'Connection test failed', 'error');
                  }
                  break;
                  
                case 'validationError':
                  setLoading(false);
                  showMessage(message.error, 'error');
                  if (message.field) {
                    showFieldError(message.field, message.error);
                  }
                  break;
              }
            });
            
            // Focus on organization input when view loads
            setTimeout(() => {
              orgInput.focus();
            }, 100);
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Setup message handling for configuration submission and PAT help links
   */
  private setupMessageHandling(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'configure':
          await this.handleConfiguration(webview, message.organization, message.pat);
          break;
        case 'testConnection':
          await this.handleTestConnection(webview, message.organization, message.pat);
          break;
        case 'openPatHelp':
          await this.openPatHelp();
          break;
      }
    });
  }

  /**
   * Handle configuration submission with real-time validation
   */
  private async handleConfiguration(webview: vscode.Webview, organization: string, pat: string): Promise<void> {
    if (this._isConfiguring) {
      return; // Prevent multiple simultaneous configuration attempts
    }

    this._isConfiguring = true;

    try {
      // Validate inputs
      const validationResult = this.validateInputs(organization, pat);
      if (!validationResult.isValid) {
        webview.postMessage({
          command: 'configurationResult',
          success: false,
          error: validationResult.error,
          fieldErrors: validationResult.fieldErrors
        });
        return;
      }

      // Validate credentials with Azure DevOps
      const result = await this.authService.validateCredentials(organization, pat);

      if (result.isValid) {
        // Store credentials
        await this.authService.storeCredentials({
          organization,
          personalAccessToken: pat
        });

        // Send success response
        webview.postMessage({
          command: 'configurationResult',
          success: true
        });

        // Show success notification
        vscode.window.showInformationMessage(
          'Azure Pipelines Assistant configured successfully!',
          'View Pipelines'
        ).then(selection => {
          if (selection === 'View Pipelines') {
            vscode.commands.executeCommand('azurePipelinesAssistant.focus');
          }
        });

      } else {
        // Handle validation failure
        let errorMessage = result.errorMessage || 'Invalid credentials';
        let fieldErrors: any = {};

        if (result.missingPermissions && result.missingPermissions.length > 0) {
          errorMessage = `Missing required permissions: ${result.missingPermissions.map(p => p.displayName).join(', ')}`;
          fieldErrors.pat = 'PAT does not have required permissions';
        }

        webview.postMessage({
          command: 'configurationResult',
          success: false,
          error: errorMessage,
          fieldErrors
        });
      }
    } catch (error) {
      console.error('Configuration error:', error);

      let errorMessage = 'Configuration failed. Please check your credentials and try again.';
      let fieldErrors: any = {};

      if (error instanceof AuthenticationError) {
        switch (error.errorCode) {
          case 'INVALID_PAT':
            errorMessage = 'Invalid Personal Access Token';
            fieldErrors.pat = 'Invalid PAT format or value';
            break;
          case 'INVALID_ORGANIZATION':
            errorMessage = 'Invalid organization name';
            fieldErrors.organization = 'Organization not found';
            break;
          case 'NETWORK_ERROR':
            errorMessage = 'Network error. Please check your internet connection.';
            break;
          default:
            errorMessage = error.message;
        }
      }

      webview.postMessage({
        command: 'configurationResult',
        success: false,
        error: errorMessage,
        fieldErrors
      });
    } finally {
      this._isConfiguring = false;
    }
  }

  /**
   * Handle test connection request
   */
  private async handleTestConnection(webview: vscode.Webview, organization: string, pat: string): Promise<void> {
    try {
      // Validate inputs
      const validationResult = this.validateInputs(organization, pat);
      if (!validationResult.isValid) {
        webview.postMessage({
          command: 'testConnectionResult',
          success: false,
          error: validationResult.error
        });
        return;
      }

      // Test connection without storing credentials
      const result = await this.authService.validateCredentials(organization, pat);

      if (result.isValid) {
        webview.postMessage({
          command: 'testConnectionResult',
          success: true
        });
      } else {
        webview.postMessage({
          command: 'testConnectionResult',
          success: false,
          error: result.errorMessage || 'Connection test failed'
        });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      webview.postMessage({
        command: 'testConnectionResult',
        success: false,
        error: 'Connection test failed. Please check your credentials.'
      });
    }
  }

  /**
   * Validate input fields with error display
   */
  private validateInputs(organization: string, pat: string): {
    isValid: boolean;
    error?: string;
    fieldErrors?: { organization?: string; pat?: string }
  } {
    const fieldErrors: { organization?: string; pat?: string } = {};
    let hasErrors = false;

    // Validate organization
    if (!organization || organization.trim().length === 0) {
      fieldErrors.organization = 'Organization name is required';
      hasErrors = true;
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(organization.trim()) && organization.trim().length > 1) {
      fieldErrors.organization = 'Invalid organization name format';
      hasErrors = true;
    }

    // Validate PAT
    if (!pat || pat.trim().length === 0) {
      fieldErrors.pat = 'Personal Access Token is required';
      hasErrors = true;
    } else if (pat.trim().length < 20) {
      fieldErrors.pat = 'PAT appears to be too short';
      hasErrors = true;
    }

    if (hasErrors) {
      return {
        isValid: false,
        error: 'Please fix the validation errors',
        fieldErrors
      };
    }

    return { isValid: true };
  }

  /**
   * Open PAT help documentation
   */
  private async openPatHelp(): Promise<void> {
    const patHelpUrl = 'https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate';
    await vscode.env.openExternal(vscode.Uri.parse(patHelpUrl));
  }

  /**
   * Show success message in the webview
   */
  private showSuccessMessage(message: string): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'configurationResult',
        success: true,
        message
      });
    }
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._view = undefined;
  }
}