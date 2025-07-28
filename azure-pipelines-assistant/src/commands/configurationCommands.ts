import * as vscode from 'vscode';
import { IConfigurationService } from '../services/configurationService';
import { IAuthenticationService } from '../interfaces/authenticationService';
import { WelcomeWebviewProvider } from '../webviews/welcomeWebviewProvider';

/**
 * Configuration command handlers
 */
export class ConfigurationCommands {
  private welcomeWebviewProvider: WelcomeWebviewProvider;

  constructor(
    private readonly configService: IConfigurationService,
    private readonly authService: IAuthenticationService,
    private readonly context: vscode.ExtensionContext
  ) {
    this.welcomeWebviewProvider = new WelcomeWebviewProvider(context, configService);
  }

  /**
   * Register all configuration commands
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      vscode.commands.registerCommand('azurePipelinesAssistant.configure', () => this.showConfigurationWizard()),
      vscode.commands.registerCommand('azurePipelinesAssistant.resetConfiguration', () => this.resetConfiguration()),
      vscode.commands.registerCommand('azurePipelinesAssistant.exportConfiguration', () => this.exportConfiguration()),
      vscode.commands.registerCommand('azurePipelinesAssistant.importConfiguration', () => this.importConfiguration()),
      vscode.commands.registerCommand('azurePipelinesAssistant.openSettings', () => this.openSettings()),
      vscode.commands.registerCommand('azurePipelinesAssistant.validateConfiguration', () => this.validateConfiguration()),
      vscode.commands.registerCommand('azurePipelinesAssistant.showWelcome', () => this.showWelcome()),
    ];

    commands.forEach(command => context.subscriptions.push(command));
  }

  /**
   * Show the configuration wizard
   */
  async showConfigurationWizard(): Promise<void> {
    try {
      // Step 1: Get organization
      const organization = await this.promptForOrganization();
      if (!organization) {
        return; // User cancelled
      }

      // Step 2: Get Personal Access Token
      const pat = await this.promptForPersonalAccessToken();
      if (!pat) {
        return; // User cancelled
      }

      // Step 3: Validate credentials
      const validationResult = await this.authService.validateCredentials(organization, pat);
      if (!validationResult.isValid) {
        await vscode.window.showErrorMessage(
          `Authentication failed: ${validationResult.errorMessage || 'Invalid credentials'}`,
          'Try Again'
        );
        return;
      }

      // Step 4: Save configuration
      await this.configService.setOrganization(organization);
      await this.configService.setPersonalAccessToken(pat);

      // Step 5: Show success and offer additional configuration
      const result = await vscode.window.showInformationMessage(
        'Azure DevOps configuration completed successfully!',
        'Configure Additional Settings',
        'Done'
      );

      if (result === 'Configure Additional Settings') {
        await this.showAdditionalSettings();
      }

      // Refresh the tree view
      await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');

    } catch (error) {
      await vscode.window.showErrorMessage(
        `Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Prompt for organization name
   */
  private async promptForOrganization(): Promise<string | undefined> {
    const currentOrg = this.configService.getOrganization();
    
    return await vscode.window.showInputBox({
      title: 'Azure DevOps Configuration - Organization',
      prompt: 'Enter your Azure DevOps organization name (e.g., "myorg" for https://dev.azure.com/myorg)',
      value: currentOrg,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Organization name is required';
        }
        
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(value.trim())) {
          return 'Organization name must contain only letters, numbers, and hyphens, and cannot start or end with a hyphen';
        }
        
        return null;
      }
    });
  }

  /**
   * Prompt for Personal Access Token
   */
  private async promptForPersonalAccessToken(): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      title: 'Azure DevOps Configuration - Personal Access Token',
      prompt: 'Enter your Personal Access Token (PAT)',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Personal Access Token is required';
        }
        
        if (value.trim().length < 10) {
          return 'Personal Access Token seems too short';
        }
        
        return null;
      }
    });
  }

  /**
   * Show additional settings configuration
   */
  private async showAdditionalSettings(): Promise<void> {
    const options = [
      'Refresh Interval',
      'Maximum Runs Per Pipeline',
      'Cache Timeout',
      'Log Level',
      'View Settings'
    ];

    const selection = await vscode.window.showQuickPick(options, {
      title: 'Additional Configuration',
      placeHolder: 'Select a setting to configure'
    });

    switch (selection) {
      case 'Refresh Interval':
        await this.configureRefreshInterval();
        break;
      case 'Maximum Runs Per Pipeline':
        await this.configureMaxRuns();
        break;
      case 'Cache Timeout':
        await this.configureCacheTimeout();
        break;
      case 'Log Level':
        await this.configureLogLevel();
        break;
      case 'View Settings':
        await this.openSettings();
        break;
    }
  }

  /**
   * Configure refresh interval
   */
  private async configureRefreshInterval(): Promise<void> {
    const current = this.configService.getRefreshInterval();
    const input = await vscode.window.showInputBox({
      title: 'Configure Refresh Interval',
      prompt: 'Enter refresh interval in seconds (10-300)',
      value: current.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 10 || num > 300) {
          return 'Refresh interval must be between 10 and 300 seconds';
        }
        return null;
      }
    });

    if (input) {
      const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
      await config.update('refreshInterval', parseInt(input), vscode.ConfigurationTarget.Global);
      await vscode.window.showInformationMessage(`Refresh interval set to ${input} seconds`);
    }
  }

  /**
   * Configure maximum runs per pipeline
   */
  private async configureMaxRuns(): Promise<void> {
    const current = this.configService.getMaxRunsPerPipeline();
    const input = await vscode.window.showInputBox({
      title: 'Configure Maximum Runs',
      prompt: 'Enter maximum number of runs to show per pipeline (1-50)',
      value: current.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 50) {
          return 'Maximum runs must be between 1 and 50';
        }
        return null;
      }
    });

    if (input) {
      const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
      await config.update('maxRunsPerPipeline', parseInt(input), vscode.ConfigurationTarget.Global);
      await vscode.window.showInformationMessage(`Maximum runs per pipeline set to ${input}`);
    }
  }

  /**
   * Configure cache timeout
   */
  private async configureCacheTimeout(): Promise<void> {
    const current = this.configService.getCacheTimeout();
    const input = await vscode.window.showInputBox({
      title: 'Configure Cache Timeout',
      prompt: 'Enter cache timeout in seconds (60-3600)',
      value: current.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 60 || num > 3600) {
          return 'Cache timeout must be between 60 and 3600 seconds';
        }
        return null;
      }
    });

    if (input) {
      const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
      await config.update('cacheTimeout', parseInt(input), vscode.ConfigurationTarget.Global);
      await vscode.window.showInformationMessage(`Cache timeout set to ${input} seconds`);
    }
  }

  /**
   * Configure log level
   */
  private async configureLogLevel(): Promise<void> {
    const levels = [
      { label: 'error', description: 'Show only error messages' },
      { label: 'warn', description: 'Show warnings and errors' },
      { label: 'info', description: 'Show informational messages' },
      { label: 'debug', description: 'Show all debug information' }
    ];
    const current = this.configService.getLogLevel();
    
    const selection = await vscode.window.showQuickPick(levels, {
      title: 'Configure Log Level',
      placeHolder: 'Select log level'
    });

    if (selection) {
      const config = vscode.workspace.getConfiguration('azurePipelinesAssistant');
      await config.update('logLevel', selection.label, vscode.ConfigurationTarget.Global);
      await vscode.window.showInformationMessage(`Log level set to ${selection.label}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  private async resetConfiguration(): Promise<void> {
    const result = await vscode.window.showWarningMessage(
      'This will reset all configuration to defaults and clear your Personal Access Token. Continue?',
      { modal: true },
      'Reset',
      'Cancel'
    );

    if (result === 'Reset') {
      try {
        await this.configService.clearConfiguration();
        await this.configService.resetToDefaults();
        await vscode.window.showInformationMessage('Configuration has been reset to defaults');
        
        // Refresh the tree view
        await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Export configuration
   */
  private async exportConfiguration(): Promise<void> {
    try {
      const configJson = await this.configService.exportConfiguration();
      
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('azure-pipelines-config.json'),
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(configJson, 'utf8'));
        await vscode.window.showInformationMessage(`Configuration exported to ${uri.fsPath}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to export configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Import configuration
   */
  private async importConfiguration(): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        }
      });

      if (uris && uris.length > 0) {
        const content = await vscode.workspace.fs.readFile(uris[0]);
        const configJson = Buffer.from(content).toString('utf8');
        
        await this.configService.importConfiguration(configJson);
        await vscode.window.showInformationMessage('Configuration imported successfully');
        
        // Refresh the tree view
        await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Open VS Code settings for the extension
   */
  private async openSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'azurePipelinesAssistant');
  }

  /**
   * Validate current configuration
   */
  private async validateConfiguration(): Promise<void> {
    try {
      const validation = this.configService.validateConfiguration();
      
      if (validation.isValid) {
        const isConfigured = await this.configService.isConfigured();
        if (isConfigured) {
          await vscode.window.showInformationMessage('Configuration is valid and complete');
        } else {
          await vscode.window.showWarningMessage('Configuration is valid but incomplete (missing organization or PAT)');
        }
      } else {
        const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('\n');
        await vscode.window.showErrorMessage(`Configuration validation failed:\n${errorMessages}`);
      }
      
      if (validation.warnings.length > 0) {
        const warningMessages = validation.warnings.map(w => `${w.field}: ${w.message}`).join('\n');
        await vscode.window.showWarningMessage(`Configuration warnings:\n${warningMessages}`);
      }
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to validate configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Show the welcome webview
   */
  private async showWelcome(): Promise<void> {
    await this.welcomeWebviewProvider.showWelcome();
  }
}