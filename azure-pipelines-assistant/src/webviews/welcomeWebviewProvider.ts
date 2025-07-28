import * as vscode from 'vscode';
import { IConfigurationService } from '../services/configurationService';

/**
 * Welcome webview provider for initial setup
 */
export class WelcomeWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly configService: IConfigurationService
  ) {}

  /**
   * Show the welcome setup wizard
   */
  public async showWelcome(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'azurePipelinesWelcome',
      'Azure Pipelines Assistant - Welcome',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );

    this.panel.webview.html = this.getWebviewContent();
    this.setupWebviewMessageHandling();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  /**
   * Generate the welcome webview HTML content
   */
  private getWebviewContent(): string {
    const nonce = this.getNonce();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Azure Pipelines Assistant - Welcome</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }
        
        .title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }
        
        .subtitle {
            font-size: 16px;
            color: var(--vscode-descriptionForeground);
        }
        
        .setup-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 30px;
            margin: 30px 0;
        }
        
        .setup-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: var(--vscode-textLink-foreground);
        }
        
        .setup-steps {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .setup-step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border-radius: 6px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        
        .step-number {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            margin-right: 15px;
            flex-shrink: 0;
        }
        
        .step-content {
            flex: 1;
        }
        
        .step-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .step-description {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin: 10px 5px;
            transition: background-color 0.2s;
        }
        
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .actions {
            text-align: center;
            margin: 40px 0;
        }
        
        .requirements {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 20px;
            margin: 30px 0;
        }
        
        .requirements-title {
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
        }
        
        .requirements-list {
            list-style: disc;
            margin-left: 20px;
        }
        
        .requirements-list li {
            margin-bottom: 8px;
        }
        
        .help-links {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .help-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            margin: 0 15px;
        }
        
        .help-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀</div>
            <div class="title">Welcome to Azure Pipelines Assistant</div>
            <div class="subtitle">Manage your Azure DevOps pipelines directly from VS Code</div>
        </div>
        
        <div class="setup-section">
            <div class="setup-title">Quick Setup</div>
            <ol class="setup-steps">
                <li class="setup-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <div class="step-title">Create a Personal Access Token</div>
                        <div class="step-description">
                            Go to your Azure DevOps organization and create a PAT with the following permissions:
                            Build (Read), Code (Read), Project and Team (Read), Release (Read)
                        </div>
                    </div>
                </li>
                <li class="setup-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <div class="step-title">Configure the Extension</div>
                        <div class="step-description">
                            Click the "Start Configuration" button below to enter your organization name and PAT
                        </div>
                    </div>
                </li>
                <li class="setup-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <div class="step-title">Start Managing Pipelines</div>
                        <div class="step-description">
                            Once configured, you'll see your pipelines in the Azure Pipelines view
                        </div>
                    </div>
                </li>
            </ol>
        </div>
        
        <div class="requirements">
            <div class="requirements-title">Requirements</div>
            <ul class="requirements-list">
                <li>Azure DevOps organization with pipelines</li>
                <li>Personal Access Token with appropriate permissions</li>
                <li>Network access to dev.azure.com</li>
            </ul>
        </div>
        
        <div class="actions">
            <button class="button" onclick="startConfiguration()">Start Configuration</button>
            <button class="button secondary" onclick="openDocumentation()">View Documentation</button>
            <button class="button secondary" onclick="openSettings()">Open Settings</button>
        </div>
        
        <div class="help-links">
            <a href="#" class="help-link" onclick="openDocumentation()">Documentation</a>
            <a href="#" class="help-link" onclick="createPAT()">Create PAT</a>
            <a href="#" class="help-link" onclick="openSettings()">Settings</a>
        </div>
    </div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        function startConfiguration() {
            vscode.postMessage({ command: 'configure' });
        }
        
        function openDocumentation() {
            vscode.postMessage({ command: 'openDocumentation' });
        }
        
        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
        
        function createPAT() {
            vscode.postMessage({ command: 'createPAT' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Setup message handling for the webview
   */
  private setupWebviewMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'configure':
          await vscode.commands.executeCommand('azurePipelinesAssistant.configure');
          break;
        case 'openDocumentation':
          await vscode.env.openExternal(
            vscode.Uri.parse('https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats')
          );
          break;
        case 'openSettings':
          await vscode.commands.executeCommand('azurePipelinesAssistant.openSettings');
          break;
        case 'createPAT':
          // Try to determine the organization URL
          const org = this.configService.getOrganization();
          const patUrl = org 
            ? `https://dev.azure.com/${org}/_usersSettings/tokens`
            : 'https://dev.azure.com/_usersSettings/tokens';
          await vscode.env.openExternal(vscode.Uri.parse(patUrl));
          break;
      }
    });
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
   * Dispose of the webview
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}