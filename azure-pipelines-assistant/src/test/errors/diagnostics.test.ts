/**
 * Unit tests for error diagnostics collection and analysis
 */

import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ErrorDiagnostics } from '../../errors/diagnostics';
import { 
  AuthenticationError, 
  NetworkError, 
  DataValidationError 
} from '../../errors/errorTypes';

suite('ErrorDiagnostics', () => {
  let diagnostics: ErrorDiagnostics;
  let mockContext: sinon.SinonStubbedInstance<vscode.ExtensionContext>;

  setup(() => {
    // Create mock context
    mockContext = {
      extension: {
        packageJSON: { version: '1.0.0' }
      }
    } as any;

    // Mock VS Code APIs
    sinon.stub(vscode, 'version').value('1.74.0');
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: sinon.stub().returns('test-value')
    } as any);

    diagnostics = new ErrorDiagnostics(mockContext as any);
  });

  teardown(() => {
    sinon.restore();
    diagnostics.dispose();
  });

  suite('Error Collection', () => {
    test('should collect error diagnostics correctly', async () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      const context = {
        operation: 'getPipelines',
        projectId: 'test-project'
      };

      await diagnostics.collectErrorDiagnostics(error, context);

      const recentErrors = diagnostics.getRecentErrors(1);
      assert.strictEqual(recentErrors.length, 1);
      
      const errorDiagnostic = recentErrors[0];
      assert.strictEqual(errorDiagnostic.errorCode, 'AUTH_INVALID_PAT');
      assert.strictEqual(errorDiagnostic.errorType, 'AuthenticationError');
      assert.strictEqual(errorDiagnostic.message, 'Test error');
      assert.strictEqual(errorDiagnostic.severity, 'high');
      assert.ok(errorDiagnostic.context.operation);
      assert.ok(errorDiagnostic.context.systemInfo);
    });

    test('should maintain error history with size limit', async () => {
      // Add more errors than the limit (100)
      for (let i = 0; i < 105; i++) {
        const error = new NetworkError(`Error ${i}`, 'TIMEOUT');
        await diagnostics.collectErrorDiagnostics(error);
      }

      const recentErrors = diagnostics.getRecentErrors(200);
      assert.strictEqual(recentErrors.length, 100); // Should be capped at 100
      
      // Should have the most recent errors
      assert.strictEqual(recentErrors[0].message, 'Error 104');
      assert.strictEqual(recentErrors[99].message, 'Error 5');
    });

    test('should collect system information', async () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      await diagnostics.collectErrorDiagnostics(error);

      const recentErrors = diagnostics.getRecentErrors(1);
      const systemInfo = recentErrors[0].context.systemInfo;

      assert.ok(systemInfo.platform);
      assert.ok(systemInfo.arch);
      assert.ok(systemInfo.nodeVersion);
      assert.strictEqual(systemInfo.vsCodeVersion, '1.74.0');
      assert.strictEqual(systemInfo.extensionVersion, '1.0.0');
      assert.ok(typeof systemInfo.totalMemory === 'number');
      assert.ok(typeof systemInfo.freeMemory === 'number');
      assert.ok(systemInfo.timestamp instanceof Date);
    });

    test('should collect network diagnostics', async () => {
      const error = new NetworkError('Network error', 'TIMEOUT');
      await diagnostics.collectErrorDiagnostics(error);

      const recentErrors = diagnostics.getRecentErrors(1);
      const networkDiagnostics = recentErrors[0].context.networkDiagnostics;

      assert.ok(networkDiagnostics.userAgent.includes('Azure-Pipelines-Assistant-VSCode'));
      assert.strictEqual(typeof networkDiagnostics.consecutiveFailures, 'number');
    });

    test('should collect extension diagnostics', async () => {
      const error = new AuthenticationError('Test error', 'INVALID_PAT');
      await diagnostics.collectErrorDiagnostics(error);

      const recentErrors = diagnostics.getRecentErrors(1);
      const extensionDiagnostics = recentErrors[0].context.extensionDiagnostics;

      assert.ok(extensionDiagnostics.activationTime instanceof Date);
      assert.ok(Array.isArray(extensionDiagnostics.commandsRegistered));
      assert.ok(extensionDiagnostics.commandsRegistered.length > 0);
      assert.ok(typeof extensionDiagnostics.configurationValid === 'boolean');
      assert.ok(extensionDiagnostics.memoryUsage);
      assert.ok(typeof extensionDiagnostics.memoryUsage.heapUsed === 'number');
    });
  });

  suite('Error Statistics', () => {
    test('should calculate error statistics correctly', async () => {
      // Add various types of errors
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error 1', 'INVALID_PAT'));
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error 2', 'EXPIRED_PAT'));
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error 1', 'TIMEOUT'));
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error 2', 'TIMEOUT'));
      await diagnostics.collectErrorDiagnostics(new DataValidationError('Data error', 'INVALID_FORMAT'));

      const stats = diagnostics.getErrorStatistics();

      assert.strictEqual(stats.totalErrors, 5);
      assert.strictEqual(stats.errorsByType.AuthenticationError, 2);
      assert.strictEqual(stats.errorsByType.NetworkError, 2);
      assert.strictEqual(stats.errorsByType.DataValidationError, 1);
      assert.strictEqual(stats.errorsByCode['AUTH_INVALID_PAT'], 1);
      assert.strictEqual(stats.errorsByCode['AUTH_EXPIRED_PAT'], 1);
      assert.strictEqual(stats.errorsByCode['NETWORK_TIMEOUT'], 2);
      assert.strictEqual(stats.errorsByCode['DATA_INVALID_FORMAT'], 1);
      assert.strictEqual(stats.errorsBySeverity.high, 2); // Auth errors
      assert.strictEqual(stats.errorsBySeverity.medium, 3); // Network + Data errors
    });

    test('should return empty statistics when no errors', () => {
      const stats = diagnostics.getErrorStatistics();

      assert.strictEqual(stats.totalErrors, 0);
      assert.deepStrictEqual(stats.errorsByType, {});
      assert.deepStrictEqual(stats.errorsByCode, {});
      assert.deepStrictEqual(stats.errorsBySeverity, {});
    });
  });

  suite('Diagnostic Report Generation', () => {
    test('should generate comprehensive diagnostic report', async () => {
      // Add some errors
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error', 'INVALID_PAT'));
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error', 'TIMEOUT'));

      // Record some metrics
      diagnostics.recordNetworkMetric('getPipelines', 1500);
      diagnostics.recordNetworkMetric('getPipelines', 2000);
      diagnostics.recordPerformanceMetric(100);

      const report = await diagnostics.generateDiagnosticReport();

      assert.ok(report.reportId);
      assert.ok(report.timestamp instanceof Date);
      assert.ok(report.systemInfo);
      assert.ok(report.networkDiagnostics);
      assert.ok(report.extensionDiagnostics);
      assert.strictEqual(report.recentErrors.length, 2);
      assert.strictEqual(report.errorStatistics.totalErrors, 2);
      assert.ok(report.performanceMetrics);
      assert.ok(typeof report.performanceMetrics.averageApiResponseTime === 'number');
    });

    test('should export diagnostics as JSON string', async () => {
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Test error', 'INVALID_PAT'));

      const exported = await diagnostics.exportDiagnostics();

      assert.ok(typeof exported === 'string');
      assert.ok(exported.length > 0);

      // Should be valid JSON
      const parsed = JSON.parse(exported);
      assert.ok(parsed.reportId);
      assert.ok(parsed.timestamp);
      assert.ok(parsed.systemInfo);
      assert.ok(Array.isArray(parsed.recentErrors));
    });
  });

  suite('Metrics Recording', () => {
    test('should record network metrics correctly', () => {
      diagnostics.recordNetworkMetric('getPipelines', 1000);
      diagnostics.recordNetworkMetric('getPipelines', 1500);
      diagnostics.recordNetworkMetric('triggerPipeline', 2000);

      // Generate report to check metrics
      const performanceMetrics = (diagnostics as any).collectPerformanceMetrics();
      
      // Average should be calculated correctly
      const expectedAverage = (1000 + 1500 + 2000) / 3;
      assert.strictEqual(performanceMetrics.averageApiResponseTime, expectedAverage);
    });

    test('should limit network metrics history', () => {
      // Add more than 50 metrics for one operation
      for (let i = 0; i < 55; i++) {
        diagnostics.recordNetworkMetric('testOperation', i * 100);
      }

      // Check that only last 50 are kept
      const networkMetrics = (diagnostics as any).networkMetrics.get('testOperation');
      assert.strictEqual(networkMetrics.length, 50);
      assert.strictEqual(networkMetrics[0], 500); // Should start from 5th measurement (5 * 100)
      assert.strictEqual(networkMetrics[49], 5400); // Should end at 54th measurement (54 * 100)
    });

    test('should record performance metrics correctly', () => {
      diagnostics.recordPerformanceMetric(100);
      diagnostics.recordPerformanceMetric(200);
      diagnostics.recordPerformanceMetric(300);

      const performanceMetrics = (diagnostics as any).collectPerformanceMetrics();
      assert.deepStrictEqual(performanceMetrics.memoryUsageTrend, [100, 200, 300]);
    });

    test('should limit performance metrics history', () => {
      // Add more than 100 metrics
      for (let i = 0; i < 105; i++) {
        diagnostics.recordPerformanceMetric(i);
      }

      const performanceMetrics = (diagnostics as any).collectPerformanceMetrics();
      assert.strictEqual(performanceMetrics.memoryUsageTrend.length, 10); // Last 10 only
      assert.deepStrictEqual(performanceMetrics.memoryUsageTrend, [95, 96, 97, 98, 99, 100, 101, 102, 103, 104]);
    });

    test('should record configuration changes', () => {
      const beforeChange = new Date();
      diagnostics.recordConfigurationChange();
      const afterChange = new Date();

      // Check that timestamp was recorded (indirectly through extension diagnostics)
      const extensionDiagnostics = (diagnostics as any).collectExtensionDiagnostics();
      assert.ok(extensionDiagnostics.lastConfigurationChange);
      assert.ok(extensionDiagnostics.lastConfigurationChange >= beforeChange);
      assert.ok(extensionDiagnostics.lastConfigurationChange <= afterChange);
    });
  });

  suite('Error Pattern Analysis', () => {
    test('should detect error spike', async () => {
      // Add multiple errors quickly (simulating spike)
      for (let i = 0; i < 6; i++) {
        await diagnostics.collectErrorDiagnostics(new NetworkError(`Error ${i}`, 'TIMEOUT'));
      }

      const analysis = diagnostics.analyzeErrorPatterns();

      assert.strictEqual(analysis.isErrorSpike, true);
      assert.ok(analysis.suggestedActions.some(action => action.includes('error spike')));
    });

    test('should identify dominant error type', async () => {
      // Add more network errors than other types
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error 1', 'TIMEOUT'));
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error 2', 'TIMEOUT'));
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error 3', 'TIMEOUT'));
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error', 'INVALID_PAT'));

      const analysis = diagnostics.analyzeErrorPatterns();

      assert.strictEqual(analysis.dominantErrorType, 'NetworkError');
      assert.ok(analysis.suggestedActions.some(action => action.includes('internet connection')));
    });

    test('should provide appropriate suggestions for authentication errors', async () => {
      // Add multiple authentication errors
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error 1', 'INVALID_PAT'));
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error 2', 'EXPIRED_PAT'));
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error 3', 'INVALID_PAT'));

      const analysis = diagnostics.analyzeErrorPatterns();

      assert.strictEqual(analysis.dominantErrorType, 'AuthenticationError');
      assert.ok(analysis.suggestedActions.some(action => action.includes('Personal Access Token')));
    });

    test('should provide default suggestions when no patterns detected', async () => {
      // Add just one error (no spike, no dominant type)
      await diagnostics.collectErrorDiagnostics(new DataValidationError('Data error', 'INVALID_FORMAT'));

      const analysis = diagnostics.analyzeErrorPatterns();

      assert.strictEqual(analysis.isErrorSpike, false);
      assert.strictEqual(analysis.dominantErrorType, 'DataValidationError');
      assert.ok(analysis.suggestedActions.includes('Monitor for recurring patterns'));
    });
  });

  suite('Data Management', () => {
    test('should clear error history', async () => {
      // Add some errors
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Auth error', 'INVALID_PAT'));
      await diagnostics.collectErrorDiagnostics(new NetworkError('Network error', 'TIMEOUT'));

      let stats = diagnostics.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 2);

      // Clear history
      diagnostics.clearErrorHistory();

      stats = diagnostics.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 0);

      const recentErrors = diagnostics.getRecentErrors();
      assert.strictEqual(recentErrors.length, 0);
    });

    test('should get recent errors with limit', async () => {
      // Add 10 errors
      for (let i = 0; i < 10; i++) {
        await diagnostics.collectErrorDiagnostics(new NetworkError(`Error ${i}`, 'TIMEOUT'));
      }

      const recent5 = diagnostics.getRecentErrors(5);
      const recent3 = diagnostics.getRecentErrors(3);

      assert.strictEqual(recent5.length, 5);
      assert.strictEqual(recent3.length, 3);

      // Should return most recent first
      assert.strictEqual(recent5[0].message, 'Error 9');
      assert.strictEqual(recent3[0].message, 'Error 9');
      assert.strictEqual(recent3[2].message, 'Error 7');
    });
  });

  suite('Resource Management', () => {
    test('should dispose resources correctly', async () => {
      // Add some data
      await diagnostics.collectErrorDiagnostics(new AuthenticationError('Test error', 'INVALID_PAT'));
      diagnostics.recordNetworkMetric('test', 1000);

      let stats = diagnostics.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 1);

      // Dispose
      diagnostics.dispose();

      // Should clear all data
      stats = diagnostics.getErrorStatistics();
      assert.strictEqual(stats.totalErrors, 0);
    });
  });
});