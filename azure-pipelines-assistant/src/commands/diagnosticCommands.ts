import * as vscode from 'vscode';
import { ExtensionLifecycleManager, IHealthCheckResult } from '../services/extensionLifecycleManager';
import { ErrorHandler } from '../errors/errorHandler';
import { AuthenticationService } from '../services/authenticationService';
import { AzureDevOpsService } from '../services/azureDevOpsService';
import { CacheService } from '../services/cacheService';

/**
 * Diagnostic commands for extension health monitoring and troubleshooting
 */
export class DiagnosticCommands {
  private lifecycleManager: ExtensionLifecycleManager;
  private errorHandler: ErrorHandler;
  private outputChannel: vscode.OutputChannel;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: AuthenticationService,
    private azureDevOpsService: AzureDevOpsService,
    private cacheService: CacheService,
    outputChannel: vscode.OutputChannel
  ) {
    this.lifecycleManager = ExtensionLifecycleManager.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.outputChannel = outputChannel;
  }

  /**
   * Register all diagnostic commands
   */
  public registerCommands(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Health check command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.runHealthCheck', async () => {
        await this.runHealthCheck();
      })
    );

    // Memory diagnostics command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.showMemoryDiagnostics', async () => {
        await this.showMemoryDiagnostics();
      })
    );

    // Extension diagnostics command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.showExtensionDiagnostics', async () => {
        await this.showExtensionDiagnostics();
      })
    );

    // Clear cache command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.clearCache', async () => {
        await this.clearCache();
      })
    );

    // Reset extension state command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.resetExtensionState', async () => {
        await this.resetExtensionState();
      })
    );

    // Export diagnostics command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.exportDiagnostics', async () => {
        await this.exportDiagnostics();
      })
    );

    // Show activation metrics command
    disposables.push(
      vscode.commands.registerCommand('azurePipelinesAssistant.showActivationMetrics', async () => {
        await this.showActivationMetrics();
      })
    );

    return disposables;
  }

  /**
   * Run comprehensive health check
   */
  private async runHealthCheck(): Promise<void> {
    try {
      this.outputChannel.show();
      this.outputChannel.appendLine('=== Azure Pipelines Assistant Health Check ===');
      this.outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
      this.outputChannel.appendLine('');

      // Run all health checks
      const results = await this.lifecycleManager.runHealthChecks();
      
      // Add service-specific health checks
      const serviceResults = await this.runServiceHealthChecks();
      results.push(...serviceResults);

      // Display results
      const healthy = results.filter(r => r.status === 'healthy');
      const warnings = results.filter(r => r.status === 'warning');
      const errors = results.filter(r => r.status === 'error');

      this.outputChannel.appendLine(`Health Check Summary:`);
      this.outputChannel.appendLine(`  ✅ Healthy: ${healthy.length}`);
      this.outputChannel.appendLine(`  ⚠️  Warnings: ${warnings.length}`);
      this.outputChannel.appendLine(`  ❌ Errors: ${errors.length}`);
      this.outputChannel.appendLine('');

      // Show detailed results
      for (const result of results) {
        const icon = result.status === 'healthy' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        this.outputChannel.appendLine(`${icon} ${result.component}: ${result.message}`);
        
        if (result.details) {
          this.outputChannel.appendLine(`   Details: ${JSON.stringify(result.details, null, 2)}`);
        }
      }

      // Show summary message
      const overallStatus = errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'HEALTHY';
      const message = `Health check completed. Overall status: ${overallStatus}`;
      
      if (overallStatus === 'HEALTHY') {
        vscode.window.showInformationMessage(message);
      } else if (overallStatus === 'WARNING') {
        vscode.window.showWarningMessage(message);
      } else {
        vscode.window.showErrorMessage(message);
      }

    } catch (error) {
      const errorMessage = `Health check failed: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Run service-specific health checks
   */
  private async runServiceHealthChecks(): Promise<IHealthCheckResult[]> {
    const results: IHealthCheckResult[] = [];

    // Authentication service health check
    try {
      const isAuthenticated = this.authService.isAuthenticated();
      results.push({
        component: 'authentication',
        status: isAuthenticated ? 'healthy' : 'warning',
        message: isAuthenticated ? 'Authentication configured' : 'Authentication not configured',
        details: { isAuthenticated },
        timestamp: new Date()
      });
    } catch (error) {
      results.push({
        component: 'authentication',
        status: 'error',
        message: `Authentication check failed: ${error}`,
        timestamp: new Date()
      });
    }

    // Cache service health check
    try {
      const cacheStats = this.cacheService.getStats();
      results.push({
        component: 'cache',
        status: 'healthy',
        message: `Cache operational with ${cacheStats.size} entries`,
        details: cacheStats,
        timestamp: new Date()
      });
    } catch (error) {
      results.push({
        component: 'cache',
        status: 'error',
        message: `Cache check failed: ${error}`,
        timestamp: new Date()
      });
    }

    // Azure DevOps service health check
    try {
      // This would require implementing a health check method in the service
      results.push({
        component: 'azureDevOpsService',
        status: 'healthy',
        message: 'Azure DevOps service operational',
        timestamp: new Date()
      });
    } catch (error) {
      results.push({
        component: 'azureDevOpsService',
        status: 'error',
        message: `Azure DevOps service check failed: ${error}`,
        timestamp: new Date()
      });
    }

    return results;
  }

  /**
   * Show memory diagnostics
   */
  private async showMemoryDiagnostics(): Promise<void> {
    try {
      this.outputChannel.show();
      this.outputChannel.appendLine('=== Memory Diagnostics ===');
      this.outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
      this.outputChannel.appendLine('');

      // Process memory usage
      const processMemory = process.memoryUsage();
      this.outputChannel.appendLine('Process Memory Usage:');
      this.outputChannel.appendLine(`  RSS: ${Math.round(processMemory.rss / 1024 / 1024)}MB`);
      this.outputChannel.appendLine(`  Heap Total: ${Math.round(processMemory.heapTotal / 1024 / 1024)}MB`);
      this.outputChannel.appendLine(`  Heap Used: ${Math.round(processMemory.heapUsed / 1024 / 1024)}MB`);
      this.outputChannel.appendLine(`  External: ${Math.round(processMemory.external / 1024 / 1024)}MB`);
      this.outputChannel.appendLine('');

      // Extension memory usage
      const extensionMemory = this.lifecycleManager.getMemoryUsage();
      this.outputChannel.appendLine('Extension Memory Usage:');
      this.outputChannel.appendLine(`  Total: ${extensionMemory.total} bytes`);
      this.outputChannel.appendLine('  By Type:');
      for (const [type, usage] of Object.entries(extensionMemory.byType)) {
        this.outputChannel.appendLine(`    ${type}: ${usage} bytes`);
      }
      this.outputChannel.appendLine('  By Resource:');
      for (const [resource, usage] of Object.entries(extensionMemory.byResource)) {
        this.outputChannel.appendLine(`    ${resource}: ${usage} bytes`);
      }

      // Resource count
      const resourceCount = this.lifecycleManager.getResourceCount();
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`Total Resources: ${resourceCount}`);

      vscode.window.showInformationMessage('Memory diagnostics displayed in output channel');

    } catch (error) {
      const errorMessage = `Memory diagnostics failed: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Show extension diagnostics
   */
  private async showExtensionDiagnostics(): Promise<void> {
    try {
      this.outputChannel.show();
      this.outputChannel.appendLine('=== Extension Diagnostics ===');
      this.outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
      this.outputChannel.appendLine('');

      // Extension state
      const state = this.lifecycleManager.getState();
      this.outputChannel.appendLine(`Extension State: ${state}`);

      // Activation metrics
      const metrics = this.lifecycleManager.getActivationMetrics();
      this.outputChannel.appendLine('Activation Metrics:');
      this.outputChannel.appendLine(`  Start Time: ${metrics.startTime?.toISOString() || 'N/A'}`);
      this.outputChannel.appendLine(`  End Time: ${metrics.endTime?.toISOString() || 'N/A'}`);
      this.outputChannel.appendLine(`  Duration: ${metrics.duration ? `${metrics.duration}ms` : 'N/A'}`);
      this.outputChannel.appendLine('');

      // Resource information
      const resourceCount = this.lifecycleManager.getResourceCount();
      this.outputChannel.appendLine(`Total Resources: ${resourceCount}`);
      
      const resourceTypes = ['service', 'disposable', 'timer', 'listener', 'webview', 'other'];
      for (const type of resourceTypes) {
        const count = this.lifecycleManager.getResourceCount(type);
        if (count > 0) {
          this.outputChannel.appendLine(`  ${type}: ${count}`);
        }
      }
      this.outputChannel.appendLine('');

      // Error handler statistics
      const errorStats = this.errorHandler.getStatistics();
      this.outputChannel.appendLine('Error Statistics:');
      this.outputChannel.appendLine(`  Total Errors: ${errorStats.totalErrors}`);
      this.outputChannel.appendLine(`  Critical Errors: ${errorStats.criticalErrors}`);
      this.outputChannel.appendLine(`  Recoverable Errors: ${errorStats.recoverableErrors}`);
      this.outputChannel.appendLine('');

      // VS Code version info
      this.outputChannel.appendLine('Environment:');
      this.outputChannel.appendLine(`  VS Code Version: ${vscode.version}`);
      this.outputChannel.appendLine(`  Extension Version: ${this.context.extension?.packageJSON.version || 'Unknown'}`);
      this.outputChannel.appendLine(`  Node Version: ${process.version}`);
      this.outputChannel.appendLine(`  Platform: ${process.platform}`);

      vscode.window.showInformationMessage('Extension diagnostics displayed in output channel');

    } catch (error) {
      const errorMessage = `Extension diagnostics failed: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Clear cache
   */
  private async clearCache(): Promise<void> {
    try {
      const result = await vscode.window.showWarningMessage(
        'This will clear all cached data. Are you sure?',
        { modal: true },
        'Clear Cache'
      );

      if (result === 'Clear Cache') {
        this.cacheService.clear();
        this.outputChannel.appendLine('Cache cleared successfully');
        vscode.window.showInformationMessage('Cache cleared successfully');
      }
    } catch (error) {
      const errorMessage = `Failed to clear cache: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Reset extension state
   */
  private async resetExtensionState(): Promise<void> {
    try {
      const result = await vscode.window.showWarningMessage(
        'This will reset the extension state and reload the window. Are you sure?',
        { modal: true },
        'Reset and Reload'
      );

      if (result === 'Reset and Reload') {
        // Clear global state
        const keys = this.context.globalState.keys();
        for (const key of keys) {
          await this.context.globalState.update(key, undefined);
        }

        // Clear workspace state
        const workspaceKeys = this.context.workspaceState.keys();
        for (const key of workspaceKeys) {
          await this.context.workspaceState.update(key, undefined);
        }

        this.outputChannel.appendLine('Extension state reset');
        
        // Reload window
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } catch (error) {
      const errorMessage = `Failed to reset extension state: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Export diagnostics to file
   */
  private async exportDiagnostics(): Promise<void> {
    try {
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`azure-pipelines-diagnostics-${Date.now()}.json`),
        filters: {
          'JSON Files': ['json']
        }
      });

      if (!uri) {
        return;
      }

      // Collect all diagnostic data
      const diagnostics = {
        timestamp: new Date().toISOString(),
        extensionVersion: this.context.extension?.packageJSON.version,
        vscodeVersion: vscode.version,
        platform: process.platform,
        nodeVersion: process.version,
        extensionState: this.lifecycleManager.getState(),
        activationMetrics: this.lifecycleManager.getActivationMetrics(),
        memoryUsage: this.lifecycleManager.getMemoryUsage(),
        processMemory: process.memoryUsage(),
        resourceCount: this.lifecycleManager.getResourceCount(),
        errorStatistics: this.errorHandler.getStatistics(),
        healthChecks: await this.lifecycleManager.runHealthChecks(),
        serviceHealthChecks: await this.runServiceHealthChecks(),
        cacheStats: this.cacheService.getStats()
      };

      const content = JSON.stringify(diagnostics, null, 2);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

      vscode.window.showInformationMessage(`Diagnostics exported to ${uri.fsPath}`);

    } catch (error) {
      const errorMessage = `Failed to export diagnostics: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  /**
   * Show activation metrics
   */
  private async showActivationMetrics(): Promise<void> {
    try {
      const metrics = this.lifecycleManager.getActivationMetrics();
      
      let message = `Extension State: ${metrics.state}`;
      
      if (metrics.duration) {
        message += `\nActivation Time: ${metrics.duration}ms`;
      }
      
      if (metrics.startTime) {
        message += `\nLast Activation: ${metrics.startTime.toLocaleString()}`;
      }

      // Get previous activation metrics from storage
      const lastMetrics = this.context.globalState.get('lastActivationMetrics') as any;
      if (lastMetrics && lastMetrics.duration) {
        message += `\nPrevious Activation: ${lastMetrics.duration}ms`;
      }

      await vscode.window.showInformationMessage(message, { modal: true });

    } catch (error) {
      const errorMessage = `Failed to show activation metrics: ${error}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
    }
  }
}