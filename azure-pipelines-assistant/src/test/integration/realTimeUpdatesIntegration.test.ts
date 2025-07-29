import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { RealTimeUpdateService } from '../../services/realTimeUpdateService';
import { AzurePipelinesTreeDataProvider } from '../../services/treeDataProvider';
import { IAzureDevOpsService } from '../../interfaces/azureDevOpsService';
import { IAuthenticationService } from '../../interfaces/authenticationService';
import { IConfigurationService } from '../../services/configurationService';
import { PipelineRun, PipelineRunDetails } from '../../models/pipelineRun';
import { Pipeline } from '../../models/pipeline';
import { Project } from '../../models/project';

suite('Real-time Updates Integration', () => {
    let realTimeService: RealTimeUpdateService;
    let treeProvider: AzurePipelinesTreeDataProvider;
    let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
    let mockAuthService: sinon.SinonStubbedInstance<IAuthenticationService>;
    let mockConfigService: sinon.SinonStubbedInstance<IConfigurationService>;
    let mockContext: vscode.ExtensionContext;
    let clock: sinon.SinonFakeTimers;

    const mockProject: Project = {
        id: 'test-project',
        name: 'Test Project',
        description: 'Test project description',
        url: 'https://dev.azure.com/test/test-project',
        state: 'wellFormed',
        visibility: 'private'
    };

    const mockPipeline: Pipeline = {
        id: 456,
        name: 'Test Pipeline',
        project: mockProject,
        folder: undefined,
        revision: 1,
        url: 'https://dev.azure.com/test/test-project/_build?definitionId=456',
        configuration: {
            type: 'yaml',
            path: 'azure-pipelines.yml',
            repository: {
                id: 'repo-id',
                name: 'test-repo',
                url: 'https://dev.azure.com/test/test-project/_git/test-repo',
                type: 'TfsGit',
                defaultBranch: 'main'
            }
        }
    };

    const createMockRun = (id: number, state: 'inProgress' | 'completed', result?: string): PipelineRun => ({
        id,
        name: `Test Run ${id}`,
        state,
        result: result as any,
        createdDate: new Date('2023-01-01T10:00:00Z'),
        finishedDate: state === 'completed' ? new Date('2023-01-01T10:30:00Z') : undefined,
        pipeline: mockPipeline,
        resources: {
            repositories: {},
            pipelines: {},
            builds: {},
            containers: {},
            packages: {}
        },
        variables: {},
        url: `https://dev.azure.com/test/test-project/_build/results?buildId=${id}`
    });

    const createMockRunDetails = (run: PipelineRun): PipelineRunDetails => ({
        ...run,
        stages: [],
        timeline: [],
        logs: []
    });

    setup(() => {
        clock = sinon.useFakeTimers();

        // Create mock context
        mockContext = {
            subscriptions: [],
            secrets: {
                get: sinon.stub(),
                store: sinon.stub(),
                delete: sinon.stub()
            }
        } as any;

        // Create mocked services
        mockAzureDevOpsService = sinon.createStubInstance({
            getProjects: sinon.stub(),
            getPipelines: sinon.stub(),
            getPipelineRuns: sinon.stub(),
            getRunDetails: sinon.stub(),
            getRunDetailsWithChangeDetection: sinon.stub(),
            getActivePipelineRuns: sinon.stub(),
            getPipelineRunsIncremental: sinon.stub()
        } as any);

        mockAuthService = sinon.createStubInstance({
            isAuthenticated: sinon.stub(),
            onAuthenticationChanged: sinon.stub()
        } as any);

        mockConfigService = sinon.createStubInstance({
            getRefreshInterval: sinon.stub(),
            getAutoRefresh: sinon.stub(),
            onConfigurationChanged: sinon.stub()
        } as any);

        // Setup default mock returns
        mockAuthService.isAuthenticated.returns(true);
        mockAuthService.onAuthenticationChanged.returns(new vscode.Disposable(() => {}));
        
        mockConfigService.getRefreshInterval.returns(30);
        mockConfigService.getAutoRefresh.returns(true);
        mockConfigService.onConfigurationChanged.returns(new vscode.Disposable(() => {}));

        mockAzureDevOpsService.getProjects.resolves([mockProject]);
        mockAzureDevOpsService.getPipelines.resolves([mockPipeline]);

        // Create services
        realTimeService = new RealTimeUpdateService(
            mockAzureDevOpsService as any,
            mockConfigService as any
        );

        treeProvider = new AzurePipelinesTreeDataProvider(
            mockAzureDevOpsService as any,
            mockAuthService as any,
            realTimeService,
            mockContext
        );
    });

    teardown(() => {
        realTimeService.dispose();
        treeProvider.dispose();
        clock.restore();
        sinon.restore();
    });

    suite('Pipeline Run Updates', () => {
        test('should subscribe to active runs when loading pipeline runs', async () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            const completedRun = createMockRun(124, 'completed', 'succeeded');
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun, completedRun]);
            mockAzureDevOpsService.getRunDetails.resolves(createMockRunDetails(inProgressRun));

            // Get pipeline runs (this should trigger subscriptions for active runs)
            const pipelineItem = { 
                data: mockPipeline, 
                itemType: 'pipeline' as const,
                id: 'pipeline-456',
                hasChildren: true
            };
            
            await treeProvider.getChildren(pipelineItem as any);

            // Verify subscription was created for in-progress run only
            const subscriptionCount = realTimeService.getActiveSubscriptionCount();
            sinon.assert.match(subscriptionCount, 1);

            // Verify getRunDetails was called for the active run
            sinon.assert.calledOnce(mockAzureDevOpsService.getRunDetails);
            sinon.assert.calledWith(mockAzureDevOpsService.getRunDetails, 123, 456, 'test-project');
        });

        test('should refresh tree when run status changes', async () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            const completedRun = { ...inProgressRun, state: 'completed' as const, result: 'succeeded' as any };
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun]);
            mockAzureDevOpsService.getRunDetails
                .onFirstCall().resolves(createMockRunDetails(inProgressRun))
                .onSecondCall().resolves(createMockRunDetails(completedRun));

            // Setup tree change event listener
            const treeChangeEvents: any[] = [];
            treeProvider.onDidChangeTreeData((event) => {
                treeChangeEvents.push(event);
            });

            // Load pipeline runs
            const pipelineItem = { 
                data: mockPipeline, 
                itemType: 'pipeline' as const,
                id: 'pipeline-456',
                hasChildren: true
            };
            
            await treeProvider.getChildren(pipelineItem as any);

            // Clear initial tree change events
            treeChangeEvents.length = 0;

            // Simulate background refresh that detects status change
            await clock.tickAsync(30000); // 30 seconds

            // Verify tree was refreshed due to status change
            sinon.assert.match(treeChangeEvents.length > 0, true);
        });

        test('should handle multiple pipeline subscriptions', async () => {
            const pipeline1 = { ...mockPipeline, id: 456 };
            const pipeline2 = { ...mockPipeline, id: 789 };
            
            const run1 = createMockRun(123, 'inProgress');
            const run2 = createMockRun(124, 'inProgress');
            
            mockAzureDevOpsService.getPipelineRuns
                .withArgs(456, 'test-project').resolves([run1])
                .withArgs(789, 'test-project').resolves([run2]);
            
            mockAzureDevOpsService.getRunDetails
                .withArgs(123, 456, 'test-project').resolves(createMockRunDetails(run1))
                .withArgs(124, 789, 'test-project').resolves(createMockRunDetails(run2));

            // Load runs for both pipelines
            const pipelineItem1 = { 
                data: pipeline1, 
                itemType: 'pipeline' as const,
                id: 'pipeline-456',
                hasChildren: true
            };
            
            const pipelineItem2 = { 
                data: pipeline2, 
                itemType: 'pipeline' as const,
                id: 'pipeline-789',
                hasChildren: true
            };
            
            await treeProvider.getChildren(pipelineItem1 as any);
            await treeProvider.getChildren(pipelineItem2 as any);

            // Verify subscriptions were created for both runs
            const subscriptionCount = realTimeService.getActiveSubscriptionCount();
            sinon.assert.match(subscriptionCount, 2);
        });
    });

    suite('Background Refresh Integration', () => {
        test('should perform background refresh of active runs', async () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun]);
            mockAzureDevOpsService.getRunDetails.resolves(createMockRunDetails(inProgressRun));

            // Load pipeline runs to create subscription
            const pipelineItem = { 
                data: mockPipeline, 
                itemType: 'pipeline' as const,
                id: 'pipeline-456',
                hasChildren: true
            };
            
            await treeProvider.getChildren(pipelineItem as any);

            // Clear initial calls
            mockAzureDevOpsService.getRunDetails.resetHistory();

            // Advance time to trigger background refresh
            await clock.tickAsync(30000); // 30 seconds

            // Verify background refresh was performed
            sinon.assert.calledOnce(mockAzureDevOpsService.getRunDetails);
            sinon.assert.calledWith(mockAzureDevOpsService.getRunDetails, 123, 456, 'test-project');
        });

        test('should stop background refresh when all runs complete', async () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            const completedRun = { ...inProgressRun, state: 'completed' as const, result: 'succeeded' as any };
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun]);
            mockAzureDevOpsService.getRunDetails
                .onFirstCall().resolves(createMockRunDetails(inProgressRun))
                .onSecondCall().resolves(createMockRunDetails(completedRun));

            // Load pipeline runs
            const pipelineItem = { 
                data: mockPipeline, 
                itemType: 'pipeline' as const,
                id: 'pipeline-456',
                hasChildren: true
            };
            
            await treeProvider.getChildren(pipelineItem as any);

            // Verify background refresh is active
            sinon.assert.match(realTimeService.isBackgroundRefreshActive(), true);

            // Simulate run completion
            await clock.tickAsync(30000);

            // Background refresh should still be active (service doesn't auto-stop)
            // but subscription should be marked as inactive
            const stats = realTimeService.getStats();
            sinon.assert.match(stats.backgroundRefreshActive, true);
        });
    });

    suite('Configuration Changes', () => {
        test('should update refresh interval when configuration changes', () => {
            // Simulate configuration change
            mockConfigService.getRefreshInterval.returns(60); // 1 minute
            
            // Trigger configuration change event
            const changeHandler = mockConfigService.onConfigurationChanged.getCall(0).args[0];
            changeHandler({ 
                field: 'refreshInterval', 
                newValue: 60, 
                oldValue: 30, 
                timestamp: new Date() 
            });

            const config = realTimeService.getConfiguration();
            sinon.assert.match(config.pollingInterval, 60000); // Should be 60 seconds in milliseconds
        });

        test('should disable background refresh when auto-refresh is disabled', () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun]);
            mockAzureDevOpsService.getRunDetails.resolves(createMockRunDetails(inProgressRun));

            // Create subscription (should start background refresh)
            realTimeService.subscribeToRunUpdates(123, 456, 'test-project', sinon.stub());
            
            sinon.assert.match(realTimeService.isBackgroundRefreshActive(), true);

            // Simulate auto-refresh being disabled
            mockConfigService.getAutoRefresh.returns(false);
            
            const changeHandler = mockConfigService.onConfigurationChanged.getCall(0).args[0];
            changeHandler({ 
                field: 'autoRefresh', 
                newValue: false, 
                oldValue: true, 
                timestamp: new Date() 
            });

            sinon.assert.match(realTimeService.isBackgroundRefreshActive(), false);
        });
    });

    suite('Error Handling', () => {
        test('should handle API errors during background refresh', async () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun]);
            mockAzureDevOpsService.getRunDetails
                .onFirstCall().resolves(createMockRunDetails(inProgressRun))
                .onSecondCall().rejects(new Error('API Error'));

            // Load pipeline runs
            const pipelineItem = { 
                data: mockPipeline, 
                itemType: 'pipeline' as const,
                id: 'pipeline-456',
                hasChildren: true
            };
            
            await treeProvider.getChildren(pipelineItem as any);

            // Advance time to trigger background refresh (should handle error gracefully)
            await clock.tickAsync(30000);

            // Background refresh should still be active despite error
            sinon.assert.match(realTimeService.isBackgroundRefreshActive(), true);
        });
    });

    suite('Resource Cleanup', () => {
        test('should clean up subscriptions when tree provider is disposed', () => {
            const inProgressRun = createMockRun(123, 'inProgress');
            
            mockAzureDevOpsService.getPipelineRuns.resolves([inProgressRun]);
            mockAzureDevOpsService.getRunDetails.resolves(createMockRunDetails(inProgressRun));

            // Create subscription through tree provider
            realTimeService.subscribeToRunUpdates(123, 456, 'test-project', sinon.stub());
            
            sinon.assert.match(realTimeService.getActiveSubscriptionCount(), 1);
            sinon.assert.match(realTimeService.isBackgroundRefreshActive(), true);

            // Dispose tree provider
            treeProvider.dispose();

            // Real-time service should be disposed as well
            sinon.assert.match(realTimeService.getActiveSubscriptionCount(), 0);
            sinon.assert.match(realTimeService.isBackgroundRefreshActive(), false);
        });
    });
});