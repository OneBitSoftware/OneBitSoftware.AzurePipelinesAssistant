import * as assert from 'assert';
import { RunComparisonService } from '../services/runComparisonService';
import { PipelineRunDetails } from '../models';
import { ExportFormat } from '../models/runComparison';

suite('RunComparisonService Simple Tests', () => {
  let comparisonService: RunComparisonService;

  setup(() => {
    comparisonService = new RunComparisonService();
  });

  test('should create comparison service', () => {
    assert.ok(comparisonService);
  });

  test('should compare two basic runs', () => {
    const run1: PipelineRunDetails = {
      id: 1,
      name: 'Run 1',
      state: 'completed' as any,
      result: 'succeeded' as any,
      createdDate: new Date('2023-01-01T10:00:00Z'),
      finishedDate: new Date('2023-01-01T10:05:00Z'),
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
      url: 'https://dev.azure.com/test/run/1',
      stages: []
    };

    const run2: PipelineRunDetails = {
      ...run1,
      id: 2,
      name: 'Run 2',
      createdDate: new Date('2023-01-01T11:00:00Z'),
      finishedDate: new Date('2023-01-01T11:05:00Z'),
      url: 'https://dev.azure.com/test/run/2'
    };

    const comparison = comparisonService.compareRuns(run1, run2);

    assert.strictEqual(comparison.runs[0], run1);
    assert.strictEqual(comparison.runs[1], run2);
    assert.ok(comparison.metrics);
    assert.ok(comparison.summary);
  });

  test('should export to JSON format', () => {
    const run1: PipelineRunDetails = {
      id: 1,
      name: 'Run 1',
      state: 'completed' as any,
      result: 'succeeded' as any,
      createdDate: new Date('2023-01-01T10:00:00Z'),
      finishedDate: new Date('2023-01-01T10:05:00Z'),
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
      url: 'https://dev.azure.com/test/run/1',
      stages: []
    };

    const run2: PipelineRunDetails = {
      ...run1,
      id: 2,
      name: 'Run 2',
      url: 'https://dev.azure.com/test/run/2'
    };

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
});