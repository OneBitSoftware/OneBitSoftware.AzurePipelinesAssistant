import * as vscode from 'vscode';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import { Pipeline, RunParameters } from '../models';

/**
 * Webview provider for pipeline triggering with parameter input
 */
export class PipelineTriggerWebviewProvider {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private azureDevOpsService: IAzureDevOpsService
    ) {}

    /**
     * Show the pipeline trigger UI
     */
    public async showTriggerUI(pipeline: Pipeline): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'pipelineTrigger',
                `Trigger Pipeline: ${pipeline.name}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'media')
                    ]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        this.panel.webview.html = await this.getWebviewContent(pipeline);
        this.setupWebviewMessageHandling(pipeline);
    }

    /**
     * Generate HTML content for the trigger UI
     */
    private async getWebviewContent(pipeline: Pipeline): Promise<string> {
        const webview = this.panel!.webview;
        
        // Get CSS and JS URIs
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'pipelineTrigger.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'pipelineTrigger.js')
        );

        // Get recent runs to suggest branch names
        let recentBranches: string[] = [];
        try {
            const recentRuns = await this.azureDevOpsService.getPipelineRuns(pipeline.id, pipeline.project.id, 10);
            // Extract branch names from recent runs - this would need to be implemented based on actual API response structure
            recentBranches = ['main', 'develop', 'feature/latest'].slice(0, 5);
        } catch (error) {
            console.warn('Failed to fetch recent branches:', error);
        }

        const defaultBranch = pipeline.configuration.repository.defaultBranch || 'main';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trigger Pipeline</title>
    <link href="${styleUri}" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header>
            <h1>Trigger Pipeline</h1>
            <div class="pipeline-info">
                <h2>${pipeline.name}</h2>
                <p class="project-name">Project: ${pipeline.project.name}</p>
                <p class="pipeline-path">${pipeline.configuration.path}</p>
            </div>
        </header>

        <form id="triggerForm">
            <div class="form-section">
                <h3>Source Branch</h3>
                <div class="input-group">
                    <label for="sourceBranch">Branch:</label>
                    <input type="text" id="sourceBranch" name="sourceBranch" 
                           value="${defaultBranch}" 
                           placeholder="Enter branch name"
                           list="branchSuggestions">
                    <datalist id="branchSuggestions">
                        ${recentBranches.map(branch => `<option value="${branch}">`).join('')}
                    </datalist>
                </div>
            </div>

            <div class="form-section">
                <h3>Variables</h3>
                <div class="variables-container">
                    <div class="variable-row">
                        <input type="text" placeholder="Variable name" class="variable-name">
                        <input type="text" placeholder="Variable value" class="variable-value">
                        <button type="button" class="remove-variable" title="Remove variable">×</button>
                    </div>
                </div>
                <button type="button" id="addVariable" class="add-button">+ Add Variable</button>
            </div>

            <div class="form-section">
                <h3>Template Parameters</h3>
                <div class="template-params-container">
                    <textarea id="templateParams" 
                              placeholder="Enter template parameters as JSON (optional)&#10;Example:&#10;{&#10;  &quot;environment&quot;: &quot;staging&quot;,&#10;  &quot;deploymentSlot&quot;: &quot;blue&quot;&#10;}"
                              rows="6"></textarea>
                </div>
            </div>

            <div class="form-actions">
                <button type="button" id="cancelButton" class="cancel-button">Cancel</button>
                <button type="submit" id="triggerButton" class="trigger-button">
                    <span class="button-text">Trigger Pipeline</span>
                    <span class="loading-spinner" style="display: none;">⟳</span>
                </button>
            </div>
        </form>

        <div id="validationErrors" class="validation-errors" style="display: none;"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const pipelineData = ${JSON.stringify(pipeline)};
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Set up message handling between webview and extension
     */
    private setupWebviewMessageHandling(pipeline: Pipeline): void {
        this.panel!.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'trigger':
                        await this.handleTriggerPipeline(pipeline, message.parameters);
                        break;
                    case 'cancel':
                        this.panel?.dispose();
                        break;
                    case 'validate':
                        await this.handleValidateParameters(message.parameters);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Handle pipeline triggering
     */
    private async handleTriggerPipeline(pipeline: Pipeline, parameters: any): Promise<void> {
        try {
            // Validate parameters
            const validationResult = this.validateParameters(parameters);
            if (!validationResult.isValid) {
                this.panel!.webview.postMessage({
                    type: 'validationError',
                    errors: validationResult.errors
                });
                return;
            }

            // Prepare run parameters
            const runParams: RunParameters = {
                sourceBranch: parameters.sourceBranch ? `refs/heads/${parameters.sourceBranch}` : undefined
            };

            // Add variables if provided
            if (parameters.variables && Object.keys(parameters.variables).length > 0) {
                runParams.variables = parameters.variables;
            }

            // Add template parameters if provided
            if (parameters.templateParameters) {
                try {
                    runParams.templateParameters = JSON.parse(parameters.templateParameters);
                } catch (error) {
                    this.panel!.webview.postMessage({
                        type: 'validationError',
                        errors: ['Invalid JSON format in template parameters']
                    });
                    return;
                }
            }

            // Show confirmation dialog
            const confirmation = await vscode.window.showWarningMessage(
                `Are you sure you want to trigger pipeline "${pipeline.name}"?`,
                { modal: true },
                'Trigger Pipeline'
            );

            if (confirmation !== 'Trigger Pipeline') {
                this.panel!.webview.postMessage({
                    type: 'cancelled'
                });
                return;
            }

            // Trigger the pipeline
            this.panel!.webview.postMessage({
                type: 'triggering'
            });

            const runResult = await this.azureDevOpsService.triggerPipelineRun(
                pipeline.id,
                pipeline.project.id,
                runParams
            );

            // Show success notification
            const action = await vscode.window.showInformationMessage(
                `Pipeline run #${runResult.id} started successfully`,
                'View Run Details',
                'View in Browser',
                'Monitor Progress'
            );

            // Handle user action
            if (action === 'View Run Details') {
                await vscode.commands.executeCommand('azurePipelinesAssistant.viewRunDetails', {
                    data: runResult
                });
            } else if (action === 'View in Browser') {
                await vscode.env.openExternal(vscode.Uri.parse(runResult.url));
            } else if (action === 'Monitor Progress') {
                // Start monitoring the run
                this.startRunMonitoring(runResult.id, pipeline.id, pipeline.project.id);
            }

            // Close the trigger panel
            this.panel?.dispose();

            // Refresh the tree view to show the new run
            await vscode.commands.executeCommand('azurePipelinesAssistant.refresh');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            this.panel!.webview.postMessage({
                type: 'error',
                message: errorMessage
            });

            vscode.window.showErrorMessage(`Failed to trigger pipeline: ${errorMessage}`);
        }
    }

    /**
     * Handle parameter validation
     */
    private async handleValidateParameters(parameters: any): Promise<void> {
        const validationResult = this.validateParameters(parameters);
        
        this.panel!.webview.postMessage({
            type: 'validationResult',
            isValid: validationResult.isValid,
            errors: validationResult.errors
        });
    }

    /**
     * Validate trigger parameters
     */
    private validateParameters(parameters: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate branch name
        if (parameters.sourceBranch) {
            const branchPattern = /^[a-zA-Z0-9._/-]+$/;
            if (!branchPattern.test(parameters.sourceBranch)) {
                errors.push('Branch name contains invalid characters');
            }
        }

        // Validate variables
        if (parameters.variables) {
            for (const [key, value] of Object.entries(parameters.variables)) {
                if (!key || typeof key !== 'string') {
                    errors.push('Variable names cannot be empty');
                    break;
                }
                if (typeof value !== 'string') {
                    errors.push('Variable values must be strings');
                    break;
                }
            }
        }

        // Validate template parameters JSON
        if (parameters.templateParameters) {
            try {
                JSON.parse(parameters.templateParameters);
            } catch (error) {
                errors.push('Template parameters must be valid JSON');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Start monitoring a pipeline run for progress updates
     */
    private startRunMonitoring(runId: number, pipelineId: number, projectId: string): void {
        const monitoringInterval = setInterval(async () => {
            try {
                const runDetails = await this.azureDevOpsService.getRunDetails(runId, pipelineId, projectId);
                
                if (runDetails.state === 'completed') {
                    clearInterval(monitoringInterval);
                    
                    const resultMessage = runDetails.result === 'succeeded' 
                        ? `Pipeline run #${runId} completed successfully`
                        : `Pipeline run #${runId} ${runDetails.result}`;
                    
                    const action = await vscode.window.showInformationMessage(
                        resultMessage,
                        'View Details',
                        'View in Browser'
                    );

                    if (action === 'View Details') {
                        await vscode.commands.executeCommand('azurePipelinesAssistant.viewRunDetails', {
                            data: runDetails
                        });
                    } else if (action === 'View in Browser') {
                        await vscode.env.openExternal(vscode.Uri.parse(runDetails.url));
                    }
                }
            } catch (error) {
                console.warn('Failed to monitor run progress:', error);
                clearInterval(monitoringInterval);
            }
        }, 30000); // Check every 30 seconds

        // Stop monitoring after 2 hours
        setTimeout(() => {
            clearInterval(monitoringInterval);
        }, 2 * 60 * 60 * 1000);
    }
}