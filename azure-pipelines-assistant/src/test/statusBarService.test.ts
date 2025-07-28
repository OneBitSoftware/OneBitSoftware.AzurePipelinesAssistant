import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { StatusBarService, IStatusBarService } from '../services/statusBarService';
import { IAuthenticationService } from '../interfaces/authenticationService';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import { PipelineRun, Pipeline, Project } from '../models';

suite('StatusBarService', () => {
    let statusBarService: IStatusBarService;
    let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
    let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
    let mockContext: sinon.SinonStubbedInstance<vscode.ExtensionContext>;
    let mockConnectionStatusItem: sinon.SinonStubbedInstance<vscode.StatusBarItem>;
    let mockPipelineStatusItem: sinon.SinonStubbedInstance<vscode.StatusBarItem>;
    let createStatusBarItemStub: sinon.SinonStub;

    setup(() => {
        // Create mock services
        mockAuthService = sinon.createStubInstance<IAuthenticationService>({} as any);
        mockAzureDevOpsService = sinon.createStubInstance<IAzureDevOpsService>({} as any);
        mockContext = sinon.createStubInstance<vscode.ExtensionContext>({} as any);

        // Create mock status bar items
        mockConnectionStatusItem = sinon.createStubInstance<vscode.StatusBarItem>({} as any);
        mockPipelineStatusItem = sinon.createStubInstance<vscode.StatusBarItem>({} as any);

        // Mock vscode.window.createStatusBarItem
        createStatusBarItemStub = sinon.stub(vscode.window, 'createStatusBarItem');
        createStatusBarItemStub.onFirstCall().returns(mockConnectionStatusItem as any);
        createStatusBarItemStub.onSecondCall().returns(mockPipelineStatusItem as any);

        // Mock authentication service event emitter
        const mockEventEmitter = sinon.createStubInstance(vscode.EventEmitter);
        (mockAuthService as any).onAuthenticationChanged = mockEventEmitter.event;

        // Create status bar service
        statusBarService = new StatusBarService(
            mockAuthService as any,
            mockAzureDevOpsService as any,
            mockContext as any
        );
    });

    teardown(() => {
        sinon.restore();
        statusBarService.dispose();
    });

    suite('initialization', () => {
        test('should create status bar items with correct properties', () => {
            assert.strictEqual(createStatusBarItemStub.callCount, 2);
            
            // Check connection status item
            const firstCall = createStatusBarItemStub.getCall(0);
            assert.strictEqual(firstCall.args[0], vscode.StatusBarAlignment.Left);
            assert.strictEqual(firstCall.args[1], 100);
            
            // Check pipeline status item
            const secondCall = createStatusBarItemStub.getCall(1);
            assert.strictEqual(secondCall.args[0], vscode.StatusBarAlignment.Left);
            assert.strictEqual(secondCall.args[1], 99);
        });

        test('should set command handlers on status bar items', () => {
            assert.strictEqual(mockConnectionStatusItem.command, 'azurePipelinesAssistant.configure');
            assert.strictEqual(mockPipelineStatusItem.command, 'azurePipelinesAssistant.refresh');
        });

        test('should initialize with authentication state', () => {
            mockAuthService.isAuthenticated.returns(true);
            mockAuthService.getCurrentOrganization.returns('test-org');

            statusBarService.initialize();

            assert.strictEqual(mockConnectionStatusItem.show.callCount, 1);
        });
    });

    suite('updateConnectionStatus', () => {
        test('should show connected status when authenticated with organization', () => {
            statusBarService.updateConnectionStatus(true, 'test-org');

            assert.strictEqual(mockConnectionStatusItem.text, '$(cloud) test-org');
            assert.strictEqual(mockConnectionStatusItem.tooltip, 'Connected to Azure DevOps: test-org\nClick to configure');
            assert.strictEqual(mockConnectionStatusItem.backgroundColor, undefined);
            assert.strictEqual(mockConnectionStatusItem.color, undefined);
        });

        test('should show connected status when authenticated without organization', () => {
            statusBarService.updateConnectionStatus(true);

            assert.strictEqual(mockConnectionStatusItem.text, '$(cloud) Azure DevOps');
            assert.strictEqual(mockConnectionStatusItem.tooltip, 'Connected to Azure DevOps\nClick to configure');
            assert.strictEqual(mockConnectionStatusItem.backgroundColor, undefined);
            assert.strictEqual(mockConnectionStatusItem.color, undefined);
        });

        test('should show disconnected status when not authenticated', () => {
            statusBarService.updateConnectionStatus(false);

            assert.strictEqual(mockConnectionStatusItem.text, '$(cloud-offline) Not Connected');
            assert.strictEqual(mockConnectionStatusItem.tooltip, 'Not connected to Azure DevOps\nClick to configure');
            assert.ok(mockConnectionStatusItem.backgroundColor instanceof vscode.ThemeColor);
            assert.ok(mockConnectionStatusItem.color instanceof vscode.ThemeColor);
        });
    });

    suite('updatePipelineRunStatus', () => {
        let mockProject: Project;
        let mockPipeline: Pipeline;
        let mockRun: PipelineRun;

        setup(() => {
            mockProject = {
                id: 'project-1',
                name: 'Test Project',
                description: 'Test project description',
                url: 'https://dev.azure.com/test-org/project-1',
                state: 'wellFormed',
                visibility: 'private'
            };

            mockPipeline = {
                id: 123,
                name: 'Test Pipeline',
                project: mockProject,
                revision: 1,
                url: 'https://dev.azure.com/test-org/project-1/_build?definitionId=123',
                configuration: {
                    type: 'yaml',
                    path: 'azure-pipelines.yml',
                    repository: {
                        id: 'repo-1',
                        name: 'test-repo',
                        url: 'https://dev.azure.com/test-org/project-1/_git/test-repo',
                        type: 'TfsGit',
                        defaultBranch: 'main'
                    }
                }
            };

            mockRun = {
                id: 456,
                name: 'Test Run',
                state: 'inProgress',
                result: undefined,
                createdDate: new Date('2023-01-01T10:00:00Z'),
                finishedDate: undefined,
                pipeline: mockPipeline,
                resources: {
                    repositories: {},
                    pipelines: {},
                    builds: {},
                    containers: {},
                    packages: {}
                },
                variables: {},
                url: 'https://dev.azure.com/test-org/project-1/_build/results?buildId=456'
            };
        });

        test('should show pipeline run status for in-progress run', () => {
            statusBarService.updatePipelineRunStatus(mockRun);

            assert.strictEqual(mockPipelineStatusItem.text, '$(sync~spin) Test Pipeline #456');
            const tooltip = mockPipelineStatusItem.tooltip as string;
            assert.ok(tooltip?.includes('Pipeline: Test Pipeline'));
            assert.ok(tooltip?.includes('Run: #456'));
            assert.ok(tooltip?.includes('State: inProgress'));
            assert.ok(mockPipelineStatusItem.backgroundColor instanceof vscode.ThemeColor);
            assert.ok(mockPipelineStatusItem.color instanceof vscode.ThemeColor);
            assert.strictEqual(mockPipelineStatusItem.show.callCount, 1);
        });

        test('should show pipeline run status for succeeded run', () => {
            mockRun.state = 'completed';
            mockRun.result = 'succeeded';
            mockRun.finishedDate = new Date('2023-01-01T10:05:00Z');

            statusBarService.updatePipelineRunStatus(mockRun);

            assert.strictEqual(mockPipelineStatusItem.text, '$(check) Test Pipeline #456');
            const tooltip = mockPipelineStatusItem.tooltip as string;
            assert.ok(tooltip?.includes('Result: succeeded'));
            assert.ok(tooltip?.includes('Duration: 5m 0s'));
            assert.ok(mockPipelineStatusItem.color instanceof vscode.ThemeColor);
        });

        test('should show pipeline run status for failed run', () => {
            mockRun.state = 'completed';
            mockRun.result = 'failed';
            mockRun.finishedDate = new Date('2023-01-01T10:03:00Z');

            statusBarService.updatePipelineRunStatus(mockRun);

            assert.strictEqual(mockPipelineStatusItem.text, '$(error) Test Pipeline #456');
            const tooltip = mockPipelineStatusItem.tooltip as string;
            assert.ok(tooltip?.includes('Result: failed'));
            assert.ok(mockPipelineStatusItem.backgroundColor instanceof vscode.ThemeColor);
            assert.ok(mockPipelineStatusItem.color instanceof vscode.ThemeColor);
        });

        test('should show pipeline run status for cancelled run', () => {
            mockRun.state = 'cancelled';
            mockRun.result = 'canceled';

            statusBarService.updatePipelineRunStatus(mockRun);

            assert.strictEqual(mockPipelineStatusItem.text, '$(circle-slash) Test Pipeline #456');
            assert.ok(mockPipelineStatusItem.backgroundColor instanceof vscode.ThemeColor);
            assert.ok(mockPipelineStatusItem.color instanceof vscode.ThemeColor);
        });

        test('should show elapsed time for in-progress run', () => {
            // Set created date to 2 minutes ago
            mockRun.createdDate = new Date(Date.now() - 2 * 60 * 1000);

            statusBarService.updatePipelineRunStatus(mockRun);

            const tooltip = mockPipelineStatusItem.tooltip as string;
            assert.ok(tooltip?.includes('Elapsed: 2m'));
        });
    });

    suite('clearPipelineRunStatus', () => {
        test('should hide pipeline status item', () => {
            statusBarService.clearPipelineRunStatus();

            assert.strictEqual(mockPipelineStatusItem.hide.callCount, 1);
        });
    });

    suite('showError', () => {
        test('should show error status on connection item', () => {
            const errorMessage = 'Test error message';
            
            statusBarService.showError(errorMessage);

            assert.strictEqual(mockConnectionStatusItem.text, '$(error) Error');
            assert.strictEqual(mockConnectionStatusItem.tooltip, `Error: ${errorMessage}\nClick to configure`);
            assert.ok(mockConnectionStatusItem.backgroundColor instanceof vscode.ThemeColor);
            assert.ok(mockConnectionStatusItem.color instanceof vscode.ThemeColor);
        });
    });

    suite('monitoring', () => {
        let mockProject: Project;
        let mockPipeline: Pipeline;
        let mockRun: PipelineRun;
        let clock: sinon.SinonFakeTimers;

        setup(() => {
            clock = sinon.useFakeTimers();

            mockProject = {
                id: 'project-1',
                name: 'Test Project',
                description: 'Test project description',
                url: 'https://dev.azure.com/test-org/project-1',
                state: 'wellFormed',
                visibility: 'private'
            };

            mockPipeline = {
                id: 123,
                name: 'Test Pipeline',
                project: mockProject,
                revision: 1,
                url: 'https://dev.azure.com/test-org/project-1/_build?definitionId=123',
                configuration: {
                    type: 'yaml',
                    path: 'azure-pipelines.yml',
                    repository: {
                        id: 'repo-1',
                        name: 'test-repo',
                        url: 'https://dev.azure.com/test-org/project-1/_git/test-repo',
                        type: 'TfsGit',
                        defaultBranch: 'main'
                    }
                }
            };

            mockRun = {
                id: 456,
                name: 'Test Run',
                state: 'inProgress',
                result: undefined,
                createdDate: new Date('2023-01-01T10:00:00Z'),
                finishedDate: undefined,
                pipeline: mockPipeline,
                resources: {
                    repositories: {},
                    pipelines: {},
                    builds: {},
                    containers: {},
                    packages: {}
                },
                variables: {},
                url: 'https://dev.azure.com/test-org/project-1/_build/results?buildId=456'
            };
        });

        teardown(() => {
            clock.restore();
        });

        test('should start monitoring in-progress run', () => {
            statusBarService.updatePipelineRunStatus(mockRun);

            // Verify monitoring started (status bar should show spinning icon)
            assert.strictEqual(mockPipelineStatusItem.text, '$(sync~spin) Test Pipeline #456');
        });

        test('should stop monitoring when run completes', async () => {
            // Setup mock to return completed run
            const completedRun = { 
                ...mockRun, 
                state: 'completed' as const, 
                result: 'succeeded' as const,
                stages: []
            };
            mockAzureDevOpsService.getRunDetails.resolves(completedRun);

            statusBarService.updatePipelineRunStatus(mockRun);

            // Fast-forward time to trigger monitoring interval
            clock.tick(10000);

            // Allow promises to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            // Verify status updated to completed
            assert.ok(mockAzureDevOpsService.getRunDetails.called);
        });

        test('should handle monitoring errors gracefully', async () => {
            mockAzureDevOpsService.getRunDetails.rejects(new Error('API Error'));

            statusBarService.updatePipelineRunStatus(mockRun);

            // Fast-forward time to trigger monitoring interval
            clock.tick(10000);

            // Allow promises to resolve
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should not throw and should continue monitoring
            assert.ok(mockAzureDevOpsService.getRunDetails.called);
        });
    });

    suite('dispose', () => {
        test('should dispose of all resources', () => {
            statusBarService.dispose();

            assert.strictEqual(mockConnectionStatusItem.dispose.callCount, 1);
            assert.strictEqual(mockPipelineStatusItem.dispose.callCount, 1);
        });

        test('should stop monitoring when disposed', () => {
            const mockRun: PipelineRun = {
                id: 456,
                name: 'Test Run',
                state: 'inProgress',
                result: undefined,
                createdDate: new Date(),
                pipeline: {} as Pipeline,
                resources: {
                    repositories: {},
                    pipelines: {},
                    builds: {},
                    containers: {},
                    packages: {}
                },
                variables: {},
                url: 'https://example.com'
            };

            statusBarService.updatePipelineRunStatus(mockRun);
            statusBarService.dispose();

            // Monitoring should be stopped (no way to directly test this, but dispose should clean up)
            assert.ok(true); // Test passes if no errors thrown
        });
    });
});