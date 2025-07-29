import * as assert from 'assert';
import { Job, PipelineRunDetails, Stage, Task } from '../models';
import { ComparisonStatus, ExportFormat } from '../models/runComparison';
import { RunComparisonService } from '../services/runComparisonService';

suite('RunComparisonService Tests', () => {
  let comparisonService: RunComparisonService;

  setup(() => {
    comparisonService = new RunComparisonService();
  });

  suite('compareRuns', () => {
    test('should compare two identical runs', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:05:00Z'));
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z'));

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.runs[0], run1);
      assert.strictEqual(comparison.runs[1], run2);
      assert.strictEqual(comparison.summary.overallChange, 'identical');
      assert.strictEqual(comparison.metrics.duration.difference, 0);
    });

    test('should detect performance improvements', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:10:00Z')); // 10 minutes
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z')); // 5 minutes

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.summary.overallChange, 'improved');
      assert.ok(comparison.metrics.duration.percentageChange < 0, 'Duration should have improved');
      assert.ok(comparison.summary.improvements.length > 0, 'Should have improvements');
    });

    test('should detect performance regressions', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:05:00Z')); // 5 minutes
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:10:00Z')); // 10 minutes

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.summary.overallChange, 'degraded');
      assert.ok(comparison.metrics.duration.percentageChange > 0, 'Duration should have degraded');
      assert.ok(comparison.summary.regressions.length > 0, 'Should have regressions');
    });

    test('should handle runs with different results', () => {
      const run1 = createMockRunWithStages(1, [
        createMockStage('build', 'succeeded', 60000),
        createMockStage('test', 'succeeded', 120000)
      ]); // 100% success rate

      const run2 = createMockRunWithStages(2, [
        createMockStage('build', 'succeeded', 60000),
        createMockStage('test', 'failed', 120000)
      ]); // 50% success rate

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.summary.overallChange, 'degraded');
      assert.ok(comparison.metrics.successRate.difference < 0, 'Success rate should have decreased');
    });

    test('should compare stages correctly', () => {
      const run1 = createMockRunWithStages(1, [
        createMockStage('build', 'succeeded', 60000), // 1 minute
        createMockStage('test', 'succeeded', 120000)   // 2 minutes
      ]);
      const run2 = createMockRunWithStages(2, [
        createMockStage('build', 'succeeded', 30000),  // 30 seconds (improved)
        createMockStage('test', 'failed', 180000)      // 3 minutes (degraded)
      ]);

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.stageComparisons.length, 2);

      const buildComparison = comparison.stageComparisons.find(s => s.stageName === 'build');
      assert.ok(buildComparison);
      assert.strictEqual(buildComparison.status, ComparisonStatus.DIFFERENT);
      assert.ok(buildComparison.duration.percentageChange! < 0, 'Build should be faster');

      const testComparison = comparison.stageComparisons.find(s => s.stageName === 'test');
      assert.ok(testComparison);
      assert.strictEqual(testComparison.status, ComparisonStatus.DIFFERENT);
      assert.ok(testComparison.duration.percentageChange! > 0, 'Test should be slower');
      assert.ok(testComparison.result.changed, 'Test result should have changed');
    });

    test('should handle missing stages', () => {
      const run1 = createMockRunWithStages(1, [
        createMockStage('build', 'succeeded', 60000),
        createMockStage('test', 'succeeded', 120000)
      ]);
      const run2 = createMockRunWithStages(2, [
        createMockStage('build', 'succeeded', 60000),
        createMockStage('deploy', 'succeeded', 90000) // New stage
      ]);

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.stageComparisons.length, 3);

      const testComparison = comparison.stageComparisons.find(s => s.stageName === 'test');
      assert.ok(testComparison);
      assert.strictEqual(testComparison.status, ComparisonStatus.ONLY_FIRST);

      const deployComparison = comparison.stageComparisons.find(s => s.stageName === 'deploy');
      assert.ok(deployComparison);
      assert.strictEqual(deployComparison.status, ComparisonStatus.ONLY_SECOND);

      assert.ok(comparison.summary.removedItems.stages.includes('test'));
      assert.ok(comparison.summary.newItems.stages.includes('deploy'));
    });
  });

  suite('exportComparison', () => {
    test('should export to JSON format', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:05:00Z'));
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z'));
      const comparison = comparisonService.compareRuns(run1, run2);

      const exported = comparisonService.exportComparison(comparison, {
        format: ExportFormat.JSON,
        includeTaskDetails: true,
        includeCharts: false,
        summaryOnly: false
      });

      assert.ok(exported.length > 0);
      const parsed = JSON.parse(exported);
      assert.ok(parsed.runs);
      assert.ok(parsed.metrics);
      assert.ok(parsed.summary);
    });

    test('should export to CSV format', () => {
      const run1 = createMockRunWithStages(1, [createMockStage('build', 'succeeded', 60000)]);
      const run2 = createMockRunWithStages(2, [createMockStage('build', 'failed', 90000)]);
      const comparison = comparisonService.compareRuns(run1, run2);

      const exported = comparisonService.exportComparison(comparison, {
        format: ExportFormat.CSV,
        includeTaskDetails: false,
        includeCharts: false,
        summaryOnly: false
      });

      assert.ok(exported.includes('Type,Name,Run1_Result,Run2_Result'));
      assert.ok(exported.includes('Stage,build,succeeded,failed'));
    });

    test('should export to HTML format', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:05:00Z'));
      const run2 = createMockRun(2, 'failed', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z'));
      const comparison = comparisonService.compareRuns(run1, run2);

      const exported = comparisonService.exportComparison(comparison, {
        format: ExportFormat.HTML,
        includeTaskDetails: true,
        includeCharts: false,
        summaryOnly: false,
        title: 'Test Comparison'
      });

      assert.ok(exported.includes('<!DOCTYPE html>'));
      assert.ok(exported.includes('Test Comparison'));
      assert.ok(exported.includes('Run #1'));
      assert.ok(exported.includes('Run #2'));
    });

    test('should export to Markdown format', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:05:00Z'));
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z'));
      const comparison = comparisonService.compareRuns(run1, run2);

      const exported = comparisonService.exportComparison(comparison, {
        format: ExportFormat.MARKDOWN,
        includeTaskDetails: true,
        includeCharts: false,
        summaryOnly: false
      });

      assert.ok(exported.includes('# Pipeline Run Comparison'));
      assert.ok(exported.includes('## Summary'));
      assert.ok(exported.includes('## Metrics'));
      assert.ok(exported.includes('| Metric | Run 1 | Run 2 | Change |'));
    });

    test('should handle summary-only export', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:05:00Z'));
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z'));
      const comparison = comparisonService.compareRuns(run1, run2);

      const exported = comparisonService.exportComparison(comparison, {
        format: ExportFormat.JSON,
        includeTaskDetails: false,
        includeCharts: false,
        summaryOnly: true
      });

      const parsed = JSON.parse(exported);
      assert.ok(parsed.summary);
      assert.ok(parsed.metrics);
      assert.ok(parsed.runs);
      assert.ok(!parsed.stageComparisons);
      assert.ok(!parsed.jobComparisons);
      assert.ok(!parsed.taskComparisons);
    });
  });

  suite('metrics calculation', () => {
    test('should calculate duration metrics correctly', () => {
      const run1 = createMockRun(1, 'succeeded', new Date('2023-01-01T10:00:00Z'), new Date('2023-01-01T10:10:00Z')); // 10 minutes
      const run2 = createMockRun(2, 'succeeded', new Date('2023-01-01T11:00:00Z'), new Date('2023-01-01T11:05:00Z')); // 5 minutes

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.metrics.duration.run1, 10 * 60 * 1000); // 10 minutes in ms
      assert.strictEqual(comparison.metrics.duration.run2, 5 * 60 * 1000);  // 5 minutes in ms
      assert.strictEqual(comparison.metrics.duration.difference, -5 * 60 * 1000); // 5 minutes faster
      assert.strictEqual(comparison.metrics.duration.percentageChange, -50); // 50% improvement
    });

    test('should calculate success rate correctly', () => {
      const run1 = createMockRunWithStages(1, [
        createMockStage('build', 'succeeded', 60000),
        createMockStage('test', 'succeeded', 120000)
      ]); // 100% success rate

      const run2 = createMockRunWithStages(2, [
        createMockStage('build', 'succeeded', 60000),
        createMockStage('test', 'failed', 120000)
      ]); // 50% success rate

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.metrics.successRate.run1, 100);
      assert.strictEqual(comparison.metrics.successRate.run2, 50);
      assert.strictEqual(comparison.metrics.successRate.difference, -50);
    });

    test('should count stages, jobs, and tasks correctly', () => {
      const run1 = createMockRunWithStages(1, [
        createMockStageWithJobs('build', 'succeeded', [
          createMockJobWithTasks('compile', 'succeeded', [
            createMockTask('setup', 'succeeded', 0, 0),
            createMockTask('build', 'succeeded', 0, 0)
          ])
        ])
      ]);

      const run2 = createMockRunWithStages(2, [
        createMockStageWithJobs('build', 'succeeded', [
          createMockJobWithTasks('compile', 'succeeded', [
            createMockTask('setup', 'succeeded', 0, 0),
            createMockTask('build', 'succeeded', 0, 0),
            createMockTask('package', 'succeeded', 0, 0) // New task
          ])
        ]),
        createMockStage('deploy', 'succeeded', 60000) // New stage
      ]);

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.metrics.stageCount.run1, 1);
      assert.strictEqual(comparison.metrics.stageCount.run2, 2);
      assert.strictEqual(comparison.metrics.stageCount.difference, 1);

      assert.strictEqual(comparison.metrics.jobCount.run1, 1);
      assert.strictEqual(comparison.metrics.jobCount.run2, 1);
      assert.strictEqual(comparison.metrics.jobCount.difference, 0);

      assert.strictEqual(comparison.metrics.taskCount.run1, 2);
      assert.strictEqual(comparison.metrics.taskCount.run2, 3);
      assert.strictEqual(comparison.metrics.taskCount.difference, 1);
    });

    test('should count errors and warnings correctly', () => {
      const run1 = createMockRunWithStages(1, [
        createMockStageWithJobs('build', 'succeeded', [
          createMockJobWithTasks('compile', 'succeeded', [
            createMockTask('build', 'succeeded', 1, 2) // 1 error, 2 warnings
          ])
        ])
      ]);

      const run2 = createMockRunWithStages(2, [
        createMockStageWithJobs('build', 'succeeded', [
          createMockJobWithTasks('compile', 'succeeded', [
            createMockTask('build', 'succeeded', 0, 1) // 0 errors, 1 warning
          ])
        ])
      ]);

      const comparison = comparisonService.compareRuns(run1, run2);

      assert.strictEqual(comparison.metrics.issues.run1.errors, 1);
      assert.strictEqual(comparison.metrics.issues.run1.warnings, 2);
      assert.strictEqual(comparison.metrics.issues.run2.errors, 0);
      assert.strictEqual(comparison.metrics.issues.run2.warnings, 1);
      assert.strictEqual(comparison.metrics.issues.errorDifference, -1);
      assert.strictEqual(comparison.metrics.issues.warningDifference, -1);
    });
  });

  // Helper functions for creating mock data
  function createMockRun(id: number, result: string, createdDate: Date, finishedDate: Date): PipelineRunDetails {
    return {
      id,
      name: `Run ${id}`,
      state: 'completed' as any,
      result: result as any,
      createdDate,
      finishedDate,
      pipeline: {
        id: 1,
        name: 'Test Pipeline',
        project: { id: 'test-project', name: 'Test Project' } as any,
        revision: 1,
        url: 'https://dev.azure.com/test',
        configuration: {
          type: 'yaml' as any,
          path: 'azure-pipelines.yml',
          repository: {} as any
        }
      } as any,
      resources: {} as any,
      variables: {},
      url: `https://dev.azure.com/test/run/${id}`,
      stages: []
    };
  }

  function createMockRunWithStages(id: number, stages: Stage[]): PipelineRunDetails {
    const run = createMockRun(id, 'succeeded', new Date(), new Date());
    run.stages = stages;
    return run;
  }

  function createMockStage(name: string, result: string, durationMs: number): Stage {
    const startTime = new Date('2023-01-01T10:00:00Z');
    const finishTime = new Date(startTime.getTime() + durationMs);

    return {
      id: name,
      name,
      displayName: name,
      state: 'completed' as any,
      result: result as any,
      startTime,
      finishTime,
      jobs: [],
      dependsOn: []
    };
  }

  function createMockStageWithJobs(name: string, result: string, jobs: Job[]): Stage {
    const stage = createMockStage(name, result, 60000);
    stage.jobs = jobs;
    return stage;
  }

  function createMockJobWithTasks(name: string, result: string, tasks: Task[]): Job {
    const startTime = new Date('2023-01-01T10:00:00Z');
    const finishTime = new Date(startTime.getTime() + 30000);

    return {
      id: name,
      name,
      displayName: name,
      state: 'completed' as any,
      result: result as any,
      startTime,
      finishTime,
      agentName: 'test-agent',
      tasks
    };
  }

  function createMockTask(name: string, result: string, errorCount: number, warningCount: number): Task {
    const startTime = new Date('2023-01-01T10:00:00Z');
    const finishTime = new Date(startTime.getTime() + 10000);

    return {
      id: name,
      name,
      displayName: name,
      state: 'completed' as any,
      result: result as any,
      startTime,
      finishTime,
      errorCount,
      warningCount,
      issues: [],
      task: {
        id: `task-${name}`,
        name,
        version: '1.0.0',
        displayName: name
      }
    };
  }
});