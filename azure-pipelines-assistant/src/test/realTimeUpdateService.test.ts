import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { RealTimeUpdateService } from '../services/realTimeUpdateService';
import { IAzureDevOpsService } from '../interfaces/azureDevOpsService';
import { IConfigurationService } from '../services/configurationService';
import { PipelineRun, PipelineRunDetails } from '../models/pipelineRun';

suite('RealTimeUpdateService', () => {
    let service: RealTimeUpdateService;
    let mockAzureDevOpsService: sinon.SinonStubbedInstance<IAzureDevOpsService>;
    let mockConfigService: sinon.SinonStubbedInstance<IConfigurationService>;
    let clock: sinon.SinonFakeTimers;

    const mockPipelineRun: PipelineRun = {
        id: 123,
        name: 'Test Run',
        state: 'inProgress',
        result: undefined,
        createdDate: new Date('2023-01-01T10:00:00Z'),
        finishedDate: undefined,
        pipeline: {
            id: 456,
            name: 'Test Pipeline',
            project: { id: 'test-project' } as any,
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
        },
        resources: {
            repositories: {},
            pipelines: {},
            builds: {},
            containers: {},
            packages: {}
        },
        variables: {},
        url: 'https://dev.azure.com/test/test-project/_build/results?buildId=123'
    };

    const mockRunDetails: PipelineRunDetails = {
        ...mockPipelineRun,
        stages: [],
        timeline: [],
        logs: []
    };

    setup(() => {
        // Create fake timers to control time-based operations
        clock = sinon.useFakeTimers();

        // Create mocked services
        mockAzureDevOpsService = sinon.createStubInstance({
            getRunDetails: sinon.stub(),
            getPipelineRuns: sinon.stub(),
            getRunDetailsWithChangeDetection: sinon.stub(),
            getActivePipelineRuns: sinon.stub()
        } as any);

        mockConfigService = sinon.createStubInstance({
            getRefreshInterval: sinon.stub(),
            getAutoRefresh: sinon.stub(),
            onConfigurationChanged: sinon.stub()
        } as any);

        // Setup default mock returns
        mockConfigService.getRefreshInterval.returns(30); // 30 seconds
        mockConfigService.getAutoRefresh.returns(true);
        mockConfigService.onConfigurationChanged.returns(new vscode.Disposable(() => {}));

        mockAzureDevOpsService.getRunDetails.resolves(mockRunDetails);
        mockAzureDevOpsService.getPipelineRuns.resolves([mockPipelineRun]);

        // Create service instance
        service = new RealTimeUpdateService(
            mockAzureDevOpsService as any,
            mockConfigService as any
        );
    });

    teardown(() => {
        service.dispose();
        clock.restore();
        sinon.restore();
    });

    suite('subscribeToRunUpdates', () => {
        test('should create subscription and start background refresh', async () => {
            const callback = sinon.stub();
            
            const disposable = service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            // Verify subscription was created
            const count = service.getActiveSubscriptionCount();
            sinon.assert.match(count, 1);
            
            // Verify background refresh started
            sinon.assert.match(service.isBackgroundRefreshActive(), true);
            
            // Verify initial fetch was called
            sinon.assert.calledOnce(mockAzureDevOpsService.getRunDetails);
            sinon.assert.calledWith(mockAzureDevOpsService.getRunDetails, 123, 456, 'test-project');
            
            disposable.dispose();
        });

        test('should call callback when run updates', async () => {
            const callback = sinon.stub();
            
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            // Wait for initial fetch
            await clock.tickAsync(100);
            
            // Verify callback was called with run details
            sinon.assert.calledOnce(callback);
            sinon.assert.calledWith(callback, mockRunDetails);
        });

        test('should handle subscription disposal', () => {
            const callback = sinon.stub();
            
            const disposable = service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            sinon.assert.match(service.getActiveSubscriptionCount(), 1);
            
            disposable.dispose();
            
            sinon.assert.match(service.getActiveSubscriptionCount(), 0);
        });

        test('should throw error when max subscriptions reached', () => {
            const callback = sinon.stub();
            
            // Update config to have low max subscriptions
            service.updateConfiguration({ maxActiveSubscriptions: 1 });
            
            // First subscription should work
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            // Second subscription should throw
            try {
                service.subscribeToRunUpdates(124, 456, 'test-project', callback);
                sinon.assert.fail('Expected error to be thrown');
            } catch (error) {
                sinon.assert.match((error as Error).message, /Maximum number of subscriptions/);
            }
        });
    });

    suite('subscribeToPipelineUpdates', () => {
        test('should create pipeline subscription', async () => {
            const callback = sinon.stub();
            
            const disposable = service.subscribeToPipelineUpdates(456, 'test-project', callback);
            
            // Verify subscription was created
            const count = service.getActiveSubscriptionCount();
            sinon.assert.match(count, 1);
            
            // Verify initial fetch was called
            sinon.assert.calledOnce(mockAzureDevOpsService.getPipelineRuns);
            sinon.assert.calledWith(mockAzureDevOpsService.getPipelineRuns, 456, 'test-project');
            
            disposable.dispose();
        });

        test('should call callback with pipeline runs', async () => {
            const callback = sinon.stub();
            
            service.subscribeToPipelineUpdates(456, 'test-project', callback);
            
            // Wait for initial fetch
            await clock.tickAsync(100);
            
            // Verify callback was called
            sinon.assert.calledOnce(callback);
            sinon.assert.calledWith(callback, [mockPipelineRun]);
        });
    });

    suite('background refresh', () => {
        test('should start background refresh when enabled', () => {
            service.updateConfiguration({ backgroundRefreshEnabled: true });
            
            const callback = sinon.stub();
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            sinon.assert.match(service.isBackgroundRefreshActive(), true);
        });

        test('should not start background refresh when disabled', () => {
            service.updateConfiguration({ backgroundRefreshEnabled: false });
            
            const callback = sinon.stub();
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            sinon.assert.match(service.isBackgroundRefreshActive(), false);
        });

        test('should perform periodic updates', async () => {
            const callback = sinon.stub();
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            // Clear initial call
            mockAzureDevOpsService.getRunDetails.resetHistory();
            
            // Advance time by polling interval
            await clock.tickAsync(30000); // 30 seconds
            
            // Verify background refresh was called
            sinon.assert.calledOnce(mockAzureDevOpsService.getRunDetails);
        });

        test('should stop background refresh when no subscriptions', () => {
            const callback = sinon.stub();
            const disposable = service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            sinon.assert.match(service.isBackgroundRefreshActive(), true);
            
            disposable.dispose();
            
            sinon.assert.match(service.isBackgroundRefreshActive(), false);
        });
    });

    suite('configuration updates', () => {
        test('should update polling interval', () => {
            service.updateConfiguration({ pollingInterval: 60000 }); // 1 minute
            
            const config = service.getConfiguration();
            sinon.assert.match(config.pollingInterval, 60000);
        });

        test('should restart background refresh when interval changes', () => {
            const callback = sinon.stub();
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            const wasActive = service.isBackgroundRefreshActive();
            
            service.updateConfiguration({ pollingInterval: 60000 });
            
            // Should still be active but with new interval
            sinon.assert.match(service.isBackgroundRefreshActive(), wasActive);
        });

        test('should respond to configuration service changes', () => {
            // Simulate configuration change
            mockConfigService.getRefreshInterval.returns(60); // 1 minute
            mockConfigService.getAutoRefresh.returns(false);
            
            // Trigger configuration change event
            const changeHandler = mockConfigService.onConfigurationChanged.getCall(0).args[0];
            changeHandler({ field: 'refreshInterval', newValue: 60, oldValue: 30, timestamp: new Date() });
            
            const config = service.getConfiguration();
            sinon.assert.match(config.pollingInterval, 60000); // Should be converted to milliseconds
        });
    });

    suite('refreshAllSubscriptions', () => {
        test('should refresh all active subscriptions', async () => {
            const callback1 = sinon.stub();
            const callback2 = sinon.stub();
            
            service.subscribeToRunUpdates(123, 456, 'test-project', callback1);
            service.subscribeToPipelineUpdates(456, 'test-project', callback2);
            
            // Clear initial calls
            mockAzureDevOpsService.getRunDetails.resetHistory();
            mockAzureDevOpsService.getPipelineRuns.resetHistory();
            
            await service.refreshAllSubscriptions();
            
            // Verify both subscriptions were refreshed
            sinon.assert.calledOnce(mockAzureDevOpsService.getRunDetails);
            sinon.assert.calledOnce(mockAzureDevOpsService.getPipelineRuns);
        });
    });

    suite('statistics', () => {
        test('should track subscription count', () => {
            const callback = sinon.stub();
            
            let stats = service.getStats();
            sinon.assert.match(stats.activeSubscriptions, 0);
            
            const disposable = service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            stats = service.getStats();
            sinon.assert.match(stats.activeSubscriptions, 1);
            
            disposable.dispose();
            
            stats = service.getStats();
            sinon.assert.match(stats.activeSubscriptions, 0);
        });

        test('should track background refresh status', () => {
            let stats = service.getStats();
            sinon.assert.match(stats.backgroundRefreshActive, false);
            
            const callback = sinon.stub();
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            stats = service.getStats();
            sinon.assert.match(stats.backgroundRefreshActive, true);
        });
    });

    suite('error handling', () => {
        test('should handle API errors gracefully', async () => {
            const callback = sinon.stub();
            const error = new Error('API Error');
            
            mockAzureDevOpsService.getRunDetails.rejects(error);
            
            // Should not throw
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            await clock.tickAsync(100);
            
            // Callback should not be called on error
            sinon.assert.notCalled(callback);
        });

        test('should continue background refresh after errors', async () => {
            const callback = sinon.stub();
            
            // First call fails, second succeeds
            mockAzureDevOpsService.getRunDetails
                .onFirstCall().rejects(new Error('API Error'))
                .onSecondCall().resolves(mockRunDetails);
            
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            
            // Wait for first call (should fail)
            await clock.tickAsync(100);
            
            // Wait for background refresh
            await clock.tickAsync(30000);
            
            // Second call should succeed
            sinon.assert.calledTwice(mockAzureDevOpsService.getRunDetails);
        });
    });

    suite('disposal', () => {
        test('should clean up all resources on dispose', () => {
            const callback = sinon.stub();
            
            service.subscribeToRunUpdates(123, 456, 'test-project', callback);
            service.subscribeToPipelineUpdates(456, 'test-project', callback);
            
            sinon.assert.match(service.getActiveSubscriptionCount(), 2);
            sinon.assert.match(service.isBackgroundRefreshActive(), true);
            
            service.dispose();
            
            sinon.assert.match(service.getActiveSubscriptionCount(), 0);
            sinon.assert.match(service.isBackgroundRefreshActive(), false);
        });

        test('should throw error when used after disposal', () => {
            service.dispose();
            
            try {
                service.subscribeToRunUpdates(123, 456, 'test-project', sinon.stub());
                sinon.assert.fail('Expected error to be thrown');
            } catch (error) {
                sinon.assert.match((error as Error).message, /Service has been disposed/);
            }
        });
    });
});