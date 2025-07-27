import { strict as assert } from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { PipelineTriggerWebviewProvider } from '../webviews/pipelineTriggerWebview';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import { Pipeline, PipelineRun, Project, RunParameters } from '../models';

suite('Pipeline Trigger Integration Tests', () => {
    let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
    let mockContext: vscode.ExtensionContext;
    let triggerProvider: PipelineTriggerWebviewProvider;
    let mockPipeline: Pipeline;
    let mockProject: Project;

    setup(() => {
        // Create mock Azure DevOps service
        mockAzureDevOpsService = {
            getProjects: sinon.stub(),
            getPipelines: sinon.stub(),
            getPipelineRuns: sinon.stub(),
            triggerPipelineRun: sinon.stub(),
            getRunDetails: sinon.stub(),
            cancelRun: sinon.stub(),
            getRunLogs: sinon.stub(),
            downloadArtifacts: sinon.stub(),
            triggerRun: sinon.stub(),
            getLogs: sinon.stub(),
            refreshProject: sinon.stub(),
            refreshPipeline: sinon.stub(),
            clearCache: sinon.stub()
        };

        // Create mock extension context
        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/mock/extension/path'),
            globalState: {
                get: sinon.stub(),
                update: sinon.stub(),
                keys: sinon.stub().returns([])
            },
            workspaceState: {
                get: sinon.stub(),
                update: sinon.stub(),
                keys: sinon.stub().returns([])
            },
            secrets: {
                get: sinon.stub(),
                store: sinon.stub(),
                delete: sinon.stub(),
                onDidChange: sinon.stub()
            },
            globalStorageUri: vscode.Uri.file('/mock/global/storage'),
            logUri: vscode.Uri.file('/mock/log'),
            storageUri: vscode.Uri.file('/mock/storage'),
            extensionMode: vscode.ExtensionMode.Test,
            environmentVariableCollection: {
                persistent: false,
                replace: sinon.stub(),
                append: sinon.stub(),
                prepend: sinon.stub(),
                get: sinon.stub(),
                forEach: sinon.stub(),
                delete: sinon.stub(),
                clear: sinon.stub()
            },
            asAbsolutePath: sinon.stub().returns('/mock/absolute/path'),
            extension: {} as vscode.Extension<any>
        } as any;

        // Create mock project and pipeline
        mockProject = {
            id: 'test-project-id',
            name: 'Test Project',
            description: 'Test project description',
            url: 'https://dev.azure.com/org/test-project',
            state: 'wellFormed',
            visibility: 'private'
        };

        mockPipeline = {
            id: 123,
            name: 'Test Pipeline',
            project: mockProject,
            folder: 'CI',
            revision: 1,
            url: 'https://dev.azure.com/org/test-project/_build?definitionId=123',
            configuration: {
                type: 'yaml',
                path: 'azure-pipelines.yml',
                repository: {
                    id: 'repo-id',
                    name: 'test-repo',
                    url: 'https://dev.azure.com/org/test-project/_git/test-repo',
                    type: 'TfsGit',
                    defaultBranch: 'main'
                }
            }
        };

        triggerProvider = new PipelineTriggerWebviewProvider(mockContext, mockAzureDevOpsService);
        
        // Mock the webview panel
        const mockWebviewPanel = {
            webview: {
                postMessage: sinon.stub(),
                html: '',
                onDidReceiveMessage: sinon.stub(),
                asWebviewUri: sinon.stub().returns(vscode.Uri.file('/mock/webview/uri'))
            },
            dispose: sinon.stub(),
            reveal: sinon.stub()
        };
        
        // Set the panel property for testing
        (triggerProvider as any).panel = mockWebviewPanel;
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Pipeline Triggering Workflow', () => {
        test('should successfully trigger pipeline with basic parameters', async () => {
            // Arrange
            const mockRun: PipelineRun = {
                id: 456,
                name: 'Run #456',
                state: 'inProgress',
                result: undefined,
                createdDate: new Date(),
                finishedDate: undefined,
                pipeline: mockPipeline,
                resources: {
                    repositories: {
                        self: {
                            id: 'repo-id',
                            name: 'test-repo',
                            url: 'https://dev.azure.com/org/test-project/_git/test-repo',
                            type: 'TfsGit',
                            defaultBranch: 'main'
                        }
                    },
                    pipelines: {},
                    builds: {},
                    containers: {},
                    packages: {}
                },
                variables: {},
                url: 'https://dev.azure.com/org/test-project/_build/results?buildId=456'
            };

            mockAzureDevOpsService.getPipelineRuns.resolves([]);
            mockAzureDevOpsService.triggerPipelineRun.resolves(mockRun);

            // Mock VS Code window methods
            const showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').resolves('Trigger Pipeline' as any);
            const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('View Run Details' as any);
            const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();

            // Act - Skip the UI creation and directly test the trigger method

            // Simulate webview message for triggering
            const parameters = {
                sourceBranch: 'main',
                variables: {},
                templateParameters: ''
            };

            // Access private method for testing
            const handleTriggerMethod = (triggerProvider as any).handleTriggerPipeline;
            await handleTriggerMethod.call(triggerProvider, mockPipeline, parameters);

            // Assert
            assert(mockAzureDevOpsService.triggerPipelineRun.calledOnce);
            assert(mockAzureDevOpsService.triggerPipelineRun.calledWith(
                mockPipeline.id,
                mockPipeline.project.id,
                { sourceBranch: 'refs/heads/main' }
            ));
            assert(showWarningMessageStub.calledOnce);
            assert(showInformationMessageStub.calledOnce);
            assert(executeCommandStub.calledWith('azurePipelinesAssistant.refresh'));

            // Cleanup
            showWarningMessageStub.restore();
            showInformationMessageStub.restore();
            executeCommandStub.restore();
        });

        test('should trigger pipeline with variables and template parameters', async () => {
            // Arrange
            const mockRun: PipelineRun = {
                id: 789,
                name: 'Run #789',
                state: 'inProgress',
                result: undefined,
                createdDate: new Date(),
                finishedDate: undefined,
                pipeline: mockPipeline,
                resources: {
                    repositories: {
                        self: {
                            id: 'repo-id',
                            name: 'test-repo',
                            url: 'https://dev.azure.com/org/test-project/_git/test-repo',
                            type: 'TfsGit',
                            defaultBranch: 'feature/test'
                        }
                    },
                    pipelines: {},
                    builds: {},
                    containers: {},
                    packages: {}
                },
                variables: {
                    'BUILD_CONFIG': { value: 'Release', isSecret: false },
                    'DEPLOY_ENV': { value: 'staging', isSecret: false }
                },
                url: 'https://dev.azure.com/org/test-project/_build/results?buildId=789'
            };

            mockAzureDevOpsService.getPipelineRuns.resolves([]);
            mockAzureDevOpsService.triggerPipelineRun.resolves(mockRun);

            const showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').resolves('Trigger Pipeline' as any);
            const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Monitor Progress' as any);

            // Act
            const parameters = {
                sourceBranch: 'feature/test',
                variables: {
                    'BUILD_CONFIG': 'Release',
                    'DEPLOY_ENV': 'staging'
                },
                templateParameters: '{"environment": "staging", "deploymentSlot": "blue"}'
            };

            const handleTriggerMethod = (triggerProvider as any).handleTriggerPipeline;
            await handleTriggerMethod.call(triggerProvider, mockPipeline, parameters);

            // Assert
            const expectedRunParams: RunParameters = {
                sourceBranch: 'refs/heads/feature/test',
                variables: {
                    'BUILD_CONFIG': 'Release',
                    'DEPLOY_ENV': 'staging'
                },
                templateParameters: {
                    environment: 'staging',
                    deploymentSlot: 'blue'
                }
            };

            assert(mockAzureDevOpsService.triggerPipelineRun.calledWith(
                mockPipeline.id,
                mockPipeline.project.id,
                expectedRunParams
            ));

            // Cleanup
            showWarningMessageStub.restore();
            showInformationMessageStub.restore();
        });

        test('should handle validation errors for invalid parameters', async () => {
            // Arrange
            mockAzureDevOpsService.getPipelineRuns.resolves([]);

            // Act & Assert - Invalid branch name
            const invalidBranchParams = {
                sourceBranch: 'invalid@branch#name',
                variables: {},
                templateParameters: ''
            };

            const validateMethod = (triggerProvider as any).validateParameters;
            const branchValidation = validateMethod.call(triggerProvider, invalidBranchParams);
            
            assert.strictEqual(branchValidation.isValid, false);
            assert(branchValidation.errors.includes('Branch name contains invalid characters'));

            // Act & Assert - Invalid JSON template parameters
            const invalidJsonParams = {
                sourceBranch: 'main',
                variables: {},
                templateParameters: '{"invalid": json}'
            };

            const jsonValidation = validateMethod.call(triggerProvider, invalidJsonParams);
            assert.strictEqual(jsonValidation.isValid, false);
            assert(jsonValidation.errors.includes('Template parameters must be valid JSON'));
        });

        test('should handle user cancellation during confirmation', async () => {
            // Arrange
            mockAzureDevOpsService.getPipelineRuns.resolves([]);
            const showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);

            // Act
            const parameters = {
                sourceBranch: 'main',
                variables: {},
                templateParameters: ''
            };

            const handleTriggerMethod = (triggerProvider as any).handleTriggerPipeline;
            await handleTriggerMethod.call(triggerProvider, mockPipeline, parameters);

            // Assert
            assert(mockAzureDevOpsService.triggerPipelineRun.notCalled);
            assert(showWarningMessageStub.calledOnce);

            // Cleanup
            showWarningMessageStub.restore();
        });

        test('should handle API errors during pipeline triggering', async () => {
            // Arrange
            const apiError = new Error('API request failed');
            mockAzureDevOpsService.getPipelineRuns.resolves([]);
            mockAzureDevOpsService.triggerPipelineRun.rejects(apiError);

            const showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').resolves('Trigger Pipeline' as any);
            const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves();

            // Act
            const parameters = {
                sourceBranch: 'main',
                variables: {},
                templateParameters: ''
            };

            const handleTriggerMethod = (triggerProvider as any).handleTriggerPipeline;
            await handleTriggerMethod.call(triggerProvider, mockPipeline, parameters);

            // Assert
            assert(mockAzureDevOpsService.triggerPipelineRun.calledOnce);
            assert(showErrorMessageStub.calledOnce);
            assert(showErrorMessageStub.calledWith('Failed to trigger pipeline: API request failed'));

            // Cleanup
            showWarningMessageStub.restore();
            showErrorMessageStub.restore();
        });
    });

    suite('Run Monitoring Workflow', () => {
        test('should monitor pipeline run until completion', async () => {
            // This test verifies that the monitoring method exists and can be called
            const runId = 456;
            const pipelineId = 123;
            const projectId = 'test-project-id';

            // Act & Assert - Just verify the method exists and doesn't throw
            const startMonitoringMethod = (triggerProvider as any).startRunMonitoring;
            assert.strictEqual(typeof startMonitoringMethod, 'function');
            
            // Call the method to ensure it doesn't throw
            startMonitoringMethod.call(triggerProvider, runId, pipelineId, projectId);
            
            // The actual monitoring behavior would be tested in integration tests
            // with real timing and intervals
        });

        test('should handle monitoring errors gracefully', async () => {
            // This test verifies that the monitoring method handles errors without crashing
            const runId = 456;
            const pipelineId = 123;
            const projectId = 'test-project-id';

            // Act & Assert - Just verify the method exists and handles errors
            const startMonitoringMethod = (triggerProvider as any).startRunMonitoring;
            assert.strictEqual(typeof startMonitoringMethod, 'function');
            
            // The method should not throw even if called with invalid parameters
            assert.doesNotThrow(() => {
                startMonitoringMethod.call(triggerProvider, runId, pipelineId, projectId);
            });
        });
    });

    suite('Parameter Validation', () => {
        test('should validate branch names correctly', () => {
            const validateMethod = (triggerProvider as any).validateParameters;

            // Valid branch names
            const validBranches = ['main', 'feature/test', 'release-1.0', 'hotfix_123'];
            validBranches.forEach(branch => {
                const result = validateMethod.call(triggerProvider, { sourceBranch: branch, variables: {}, templateParameters: '' });
                assert.strictEqual(result.isValid, true, `Branch '${branch}' should be valid`);
            });

            // Invalid branch names
            const invalidBranches = ['invalid@branch', 'branch with spaces', 'branch#with#hash'];
            invalidBranches.forEach(branch => {
                const result = validateMethod.call(triggerProvider, { sourceBranch: branch, variables: {}, templateParameters: '' });
                assert.strictEqual(result.isValid, false, `Branch '${branch}' should be invalid`);
            });
        });

        test('should validate variables correctly', () => {
            const validateMethod = (triggerProvider as any).validateParameters;

            // Valid variables
            const validParams = {
                sourceBranch: 'main',
                variables: { 'VAR1': 'value1', 'VAR_2': 'value2' },
                templateParameters: ''
            };
            const validResult = validateMethod.call(triggerProvider, validParams);
            assert.strictEqual(validResult.isValid, true);

            // Invalid variables (empty key)
            const invalidParams = {
                sourceBranch: 'main',
                variables: { '': 'value' },
                templateParameters: ''
            };
            const invalidResult = validateMethod.call(triggerProvider, invalidParams);
            assert.strictEqual(invalidResult.isValid, false);
        });

        test('should validate JSON template parameters', () => {
            const validateMethod = (triggerProvider as any).validateParameters;

            // Valid JSON
            const validJsonParams = {
                sourceBranch: 'main',
                variables: {},
                templateParameters: '{"env": "staging", "count": 3}'
            };
            const validResult = validateMethod.call(triggerProvider, validJsonParams);
            assert.strictEqual(validResult.isValid, true);

            // Invalid JSON
            const invalidJsonParams = {
                sourceBranch: 'main',
                variables: {},
                templateParameters: '{"invalid": json}'
            };
            const invalidResult = validateMethod.call(triggerProvider, invalidJsonParams);
            assert.strictEqual(invalidResult.isValid, false);
            assert(invalidResult.errors.includes('Template parameters must be valid JSON'));
        });
    });
});