import { PipelineRunDetails, Stage, Job, Task } from '../models';
import {
  RunComparison,
  ComparisonMetrics,
  StageComparison,
  JobComparison,
  TaskComparison,
  ComparisonStatus,
  ComparisonSummary,
  ExportFormat,
  ExportConfig
} from '../models/runComparison';

/**
 * Service for comparing pipeline runs
 */
export class RunComparisonService {

  /**
   * Compare two pipeline runs
   */
  public compareRuns(run1: PipelineRunDetails, run2: PipelineRunDetails): RunComparison {
    const metrics = this.calculateMetrics(run1, run2);
    const stageComparisons = this.compareStages(run1.stages, run2.stages);
    const jobComparisons = this.compareJobs(run1.stages, run2.stages);
    const taskComparisons = this.compareTasks(run1.stages, run2.stages);
    const summary = this.generateSummary(metrics, stageComparisons, jobComparisons, taskComparisons);

    return {
      runs: [run1, run2],
      metrics,
      stageComparisons,
      jobComparisons,
      taskComparisons,
      summary
    };
  }

  /**
   * Calculate overall comparison metrics
   */
  private calculateMetrics(run1: PipelineRunDetails, run2: PipelineRunDetails): ComparisonMetrics {
    const duration1 = this.calculateRunDuration(run1);
    const duration2 = this.calculateRunDuration(run2);
    const durationDiff = duration2 - duration1;
    const durationPercentChange = duration1 > 0 ? (durationDiff / duration1) * 100 : 0;

    const successRate1 = this.calculateSuccessRate(run1.stages);
    const successRate2 = this.calculateSuccessRate(run2.stages);

    const stageCount1 = run1.stages.length;
    const stageCount2 = run2.stages.length;

    const jobCount1 = this.countJobs(run1.stages);
    const jobCount2 = this.countJobs(run2.stages);

    const taskCount1 = this.countTasks(run1.stages);
    const taskCount2 = this.countTasks(run2.stages);

    const issues1 = this.countIssues(run1.stages);
    const issues2 = this.countIssues(run2.stages);

    return {
      duration: {
        run1: duration1,
        run2: duration2,
        difference: durationDiff,
        percentageChange: durationPercentChange
      },
      successRate: {
        run1: successRate1,
        run2: successRate2,
        difference: successRate2 - successRate1
      },
      stageCount: {
        run1: stageCount1,
        run2: stageCount2,
        difference: stageCount2 - stageCount1
      },
      jobCount: {
        run1: jobCount1,
        run2: jobCount2,
        difference: jobCount2 - jobCount1
      },
      taskCount: {
        run1: taskCount1,
        run2: taskCount2,
        difference: taskCount2 - taskCount1
      },
      issues: {
        run1: issues1,
        run2: issues2,
        errorDifference: issues2.errors - issues1.errors,
        warningDifference: issues2.warnings - issues1.warnings
      }
    };
  }

  /**
   * Compare stages between two runs
   */
  private compareStages(stages1: Stage[], stages2: Stage[]): StageComparison[] {
    const stageMap1 = new Map(stages1.map(s => [s.name, s]));
    const stageMap2 = new Map(stages2.map(s => [s.name, s]));

    const allStageNames = new Set([...stageMap1.keys(), ...stageMap2.keys()]);
    const comparisons: StageComparison[] = [];

    for (const stageName of allStageNames) {
      const stage1 = stageMap1.get(stageName) || null;
      const stage2 = stageMap2.get(stageName) || null;

      const status = this.getComparisonStatus(stage1, stage2);
      const duration1 = stage1 ? this.calculateStageDuration(stage1) : null;
      const duration2 = stage2 ? this.calculateStageDuration(stage2) : null;
      const durationDiff = duration1 !== null && duration2 !== null ? duration2 - duration1 : null;
      const durationPercentChange = duration1 && duration2 && duration1 > 0 ? (durationDiff! / duration1) * 100 : null;

      const result1 = stage1?.result || null;
      const result2 = stage2?.result || null;
      const resultChanged = result1 !== result2;

      const jobComparisons = this.compareJobsInStage(stage1?.jobs || [], stage2?.jobs || [], stageName);

      comparisons.push({
        stageId: stage1?.id || stage2?.id || stageName,
        stageName,
        stage1,
        stage2,
        status,
        duration: {
          run1: duration1,
          run2: duration2,
          difference: durationDiff,
          percentageChange: durationPercentChange
        },
        result: {
          run1: result1,
          run2: result2,
          changed: resultChanged
        },
        jobComparisons
      });
    }

    return comparisons.sort((a, b) => a.stageName.localeCompare(b.stageName));
  }

  /**
   * Compare jobs between two runs
   */
  private compareJobs(stages1: Stage[], stages2: Stage[]): JobComparison[] {
    const allJobs: JobComparison[] = [];

    // Get all unique stage names
    const stageNames = new Set([
      ...stages1.map(s => s.name),
      ...stages2.map(s => s.name)
    ]);

    for (const stageName of stageNames) {
      const stage1 = stages1.find(s => s.name === stageName);
      const stage2 = stages2.find(s => s.name === stageName);

      const jobs1 = stage1?.jobs || [];
      const jobs2 = stage2?.jobs || [];

      const jobComparisons = this.compareJobsInStage(jobs1, jobs2, stageName);
      allJobs.push(...jobComparisons);
    }

    return allJobs;
  }

  /**
   * Compare jobs within a specific stage
   */
  private compareJobsInStage(jobs1: Job[], jobs2: Job[], stageId: string): JobComparison[] {
    const jobMap1 = new Map(jobs1.map(j => [j.name, j]));
    const jobMap2 = new Map(jobs2.map(j => [j.name, j]));

    const allJobNames = new Set([...jobMap1.keys(), ...jobMap2.keys()]);
    const comparisons: JobComparison[] = [];

    for (const jobName of allJobNames) {
      const job1 = jobMap1.get(jobName) || null;
      const job2 = jobMap2.get(jobName) || null;

      const status = this.getComparisonStatus(job1, job2);
      const duration1 = job1 ? this.calculateJobDuration(job1) : null;
      const duration2 = job2 ? this.calculateJobDuration(job2) : null;
      const durationDiff = duration1 !== null && duration2 !== null ? duration2 - duration1 : null;
      const durationPercentChange = duration1 && duration2 && duration1 > 0 ? (durationDiff! / duration1) * 100 : null;

      const result1 = job1?.result || null;
      const result2 = job2?.result || null;
      const resultChanged = result1 !== result2;

      const agent1 = job1?.agentName || null;
      const agent2 = job2?.agentName || null;
      const agentChanged = agent1 !== agent2;

      const taskComparisons = this.compareTasksInJob(job1?.tasks || [], job2?.tasks || [], jobName, stageId);

      comparisons.push({
        jobId: job1?.id || job2?.id || jobName,
        jobName,
        stageId,
        job1,
        job2,
        status,
        duration: {
          run1: duration1,
          run2: duration2,
          difference: durationDiff,
          percentageChange: durationPercentChange
        },
        result: {
          run1: result1,
          run2: result2,
          changed: resultChanged
        },
        agent: {
          run1: agent1,
          run2: agent2,
          changed: agentChanged
        },
        taskComparisons
      });
    }

    return comparisons.sort((a, b) => a.jobName.localeCompare(b.jobName));
  }

  /**
   * Compare tasks between two runs
   */
  private compareTasks(stages1: Stage[], stages2: Stage[]): TaskComparison[] {
    const allTasks: TaskComparison[] = [];

    // Get all unique stage names
    const stageNames = new Set([
      ...stages1.map(s => s.name),
      ...stages2.map(s => s.name)
    ]);

    for (const stageName of stageNames) {
      const stage1 = stages1.find(s => s.name === stageName);
      const stage2 = stages2.find(s => s.name === stageName);

      const jobs1 = stage1?.jobs || [];
      const jobs2 = stage2?.jobs || [];

      const jobNames = new Set([
        ...jobs1.map(j => j.name),
        ...jobs2.map(j => j.name)
      ]);

      for (const jobName of jobNames) {
        const job1 = jobs1.find(j => j.name === jobName);
        const job2 = jobs2.find(j => j.name === jobName);

        const tasks1 = job1?.tasks || [];
        const tasks2 = job2?.tasks || [];

        const taskComparisons = this.compareTasksInJob(tasks1, tasks2, jobName, stageName);
        allTasks.push(...taskComparisons);
      }
    }

    return allTasks;
  }

  /**
   * Compare tasks within a specific job
   */
  private compareTasksInJob(tasks1: Task[], tasks2: Task[], jobId: string, stageId: string): TaskComparison[] {
    const taskMap1 = new Map(tasks1.map(t => [t.name, t]));
    const taskMap2 = new Map(tasks2.map(t => [t.name, t]));

    const allTaskNames = new Set([...taskMap1.keys(), ...taskMap2.keys()]);
    const comparisons: TaskComparison[] = [];

    for (const taskName of allTaskNames) {
      const task1 = taskMap1.get(taskName) || null;
      const task2 = taskMap2.get(taskName) || null;

      const status = this.getComparisonStatus(task1, task2);
      const duration1 = task1 ? this.calculateTaskDuration(task1) : null;
      const duration2 = task2 ? this.calculateTaskDuration(task2) : null;
      const durationDiff = duration1 !== null && duration2 !== null ? duration2 - duration1 : null;
      const durationPercentChange = duration1 && duration2 && duration1 > 0 ? (durationDiff! / duration1) * 100 : null;

      const result1 = task1?.result || null;
      const result2 = task2?.result || null;
      const resultChanged = result1 !== result2;

      const issues1 = { errors: task1?.errorCount || 0, warnings: task1?.warningCount || 0 };
      const issues2 = { errors: task2?.errorCount || 0, warnings: task2?.warningCount || 0 };

      comparisons.push({
        taskId: task1?.id || task2?.id || taskName,
        taskName,
        jobId,
        stageId,
        task1,
        task2,
        status,
        duration: {
          run1: duration1,
          run2: duration2,
          difference: durationDiff,
          percentageChange: durationPercentChange
        },
        result: {
          run1: result1,
          run2: result2,
          changed: resultChanged
        },
        issues: {
          run1: issues1,
          run2: issues2,
          errorDifference: issues2.errors - issues1.errors,
          warningDifference: issues2.warnings - issues1.warnings
        }
      });
    }

    return comparisons.sort((a, b) => a.taskName.localeCompare(b.taskName));
  }

  /**
   * Generate comparison summary
   */
  private generateSummary(
    metrics: ComparisonMetrics,
    stageComparisons: StageComparison[],
    jobComparisons: JobComparison[],
    taskComparisons: TaskComparison[]
  ): ComparisonSummary {
    const improvements: string[] = [];
    const regressions: string[] = [];

    // Duration improvements/regressions
    if (metrics.duration.percentageChange < -5) {
      improvements.push(`Overall duration improved by ${Math.abs(metrics.duration.percentageChange).toFixed(1)}%`);
    } else if (metrics.duration.percentageChange > 5) {
      regressions.push(`Overall duration degraded by ${metrics.duration.percentageChange.toFixed(1)}%`);
    }

    // Success rate changes
    if (metrics.successRate.difference > 0) {
      improvements.push(`Success rate improved by ${metrics.successRate.difference.toFixed(1)}%`);
    } else if (metrics.successRate.difference < 0) {
      regressions.push(`Success rate decreased by ${Math.abs(metrics.successRate.difference).toFixed(1)}%`);
    }

    // Error/warning changes
    if (metrics.issues.errorDifference < 0) {
      improvements.push(`${Math.abs(metrics.issues.errorDifference)} fewer errors`);
    } else if (metrics.issues.errorDifference > 0) {
      regressions.push(`${metrics.issues.errorDifference} more errors`);
    }

    if (metrics.issues.warningDifference < 0) {
      improvements.push(`${Math.abs(metrics.issues.warningDifference)} fewer warnings`);
    } else if (metrics.issues.warningDifference > 0) {
      regressions.push(`${metrics.issues.warningDifference} more warnings`);
    }

    // New and removed items
    const newStages = stageComparisons.filter(s => s.status === ComparisonStatus.ONLY_SECOND).map(s => s.stageName);
    const removedStages = stageComparisons.filter(s => s.status === ComparisonStatus.ONLY_FIRST).map(s => s.stageName);
    const newJobs = jobComparisons.filter(j => j.status === ComparisonStatus.ONLY_SECOND).map(j => j.jobName);
    const removedJobs = jobComparisons.filter(j => j.status === ComparisonStatus.ONLY_FIRST).map(j => j.jobName);
    const newTasks = taskComparisons.filter(t => t.status === ComparisonStatus.ONLY_SECOND).map(t => t.taskName);
    const removedTasks = taskComparisons.filter(t => t.status === ComparisonStatus.ONLY_FIRST).map(t => t.taskName);

    // Performance changes
    const fasterStages = stageComparisons
      .filter(s => s.duration.percentageChange !== null && s.duration.percentageChange < -5)
      .map(s => s.stageName);
    const slowerStages = stageComparisons
      .filter(s => s.duration.percentageChange !== null && s.duration.percentageChange > 5)
      .map(s => s.stageName);
    const fasterJobs = jobComparisons
      .filter(j => j.duration.percentageChange !== null && j.duration.percentageChange < -5)
      .map(j => j.jobName);
    const slowerJobs = jobComparisons
      .filter(j => j.duration.percentageChange !== null && j.duration.percentageChange > 5)
      .map(j => j.jobName);

    // Quality changes
    const fewerErrors = taskComparisons
      .filter(t => t.issues.errorDifference < 0)
      .map(t => t.taskName);
    const moreErrors = taskComparisons
      .filter(t => t.issues.errorDifference > 0)
      .map(t => t.taskName);
    const fewerWarnings = taskComparisons
      .filter(t => t.issues.warningDifference < 0)
      .map(t => t.taskName);
    const moreWarnings = taskComparisons
      .filter(t => t.issues.warningDifference > 0)
      .map(t => t.taskName);

    // Determine overall change
    let overallChange: 'improved' | 'degraded' | 'mixed' | 'identical';
    if (improvements.length > 0 && regressions.length === 0) {
      overallChange = 'improved';
    } else if (regressions.length > 0 && improvements.length === 0) {
      overallChange = 'degraded';
    } else if (improvements.length > 0 && regressions.length > 0) {
      overallChange = 'mixed';
    } else {
      overallChange = 'identical';
    }

    return {
      overallChange,
      improvements,
      regressions,
      newItems: {
        stages: newStages,
        jobs: newJobs,
        tasks: newTasks
      },
      removedItems: {
        stages: removedStages,
        jobs: removedJobs,
        tasks: removedTasks
      },
      performanceChanges: {
        fasterStages,
        slowerStages,
        fasterJobs,
        slowerJobs
      },
      qualityChanges: {
        fewerErrors,
        moreErrors,
        fewerWarnings,
        moreWarnings
      }
    };
  }

  /**
   * Export comparison to specified format
   */
  public exportComparison(comparison: RunComparison, config: ExportConfig): string {
    switch (config.format) {
      case ExportFormat.JSON:
        return this.exportToJson(comparison, config);
      case ExportFormat.CSV:
        return this.exportToCsv(comparison, config);
      case ExportFormat.HTML:
        return this.exportToHtml(comparison, config);
      case ExportFormat.MARKDOWN:
        return this.exportToMarkdown(comparison, config);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  // Helper methods

  private getComparisonStatus(item1: any, item2: any): ComparisonStatus {
    if (item1 && item2) {
      // Check if items are different
      if (this.areItemsDifferent(item1, item2)) {
        return ComparisonStatus.DIFFERENT;
      } else {
        return ComparisonStatus.IDENTICAL;
      }
    } else if (item1 && !item2) {
      return ComparisonStatus.ONLY_FIRST;
    } else if (!item1 && item2) {
      return ComparisonStatus.ONLY_SECOND;
    } else {
      return ComparisonStatus.IDENTICAL; // Both null
    }
  }

  private areItemsDifferent(item1: any, item2: any): boolean {
    // Simple comparison - in a full implementation, this would be more sophisticated
    return item1.result !== item2.result ||
      item1.state !== item2.state ||
      this.calculateItemDuration(item1) !== this.calculateItemDuration(item2);
  }

  private calculateRunDuration(run: PipelineRunDetails): number {
    if (!run.createdDate) {
      return 0;
    }
    const endTime = run.finishedDate || new Date();
    return endTime.getTime() - run.createdDate.getTime();
  }

  private calculateStageDuration(stage: Stage): number {
    if (!stage.startTime) {
      return 0;
    }
    const endTime = stage.finishTime || new Date();
    return endTime.getTime() - stage.startTime.getTime();
  }

  private calculateJobDuration(job: Job): number {
    if (!job.startTime) {
      return 0;
    }
    const endTime = job.finishTime || new Date();
    return endTime.getTime() - job.startTime.getTime();
  }

  private calculateTaskDuration(task: Task): number {
    if (!task.startTime) {
      return 0;
    }
    const endTime = task.finishTime || new Date();
    return endTime.getTime() - task.startTime.getTime();
  }

  private calculateItemDuration(item: any): number {
    if (!item.startTime) {
      return 0;
    }
    const endTime = item.finishTime || new Date();
    return endTime.getTime() - item.startTime.getTime();
  }

  private calculateSuccessRate(stages: Stage[]): number {
    if (stages.length === 0) {
      return 100;
    }
    const successfulStages = stages.filter(s => s.result === 'succeeded').length;
    return (successfulStages / stages.length) * 100;
  }

  private countJobs(stages: Stage[]): number {
    return stages.reduce((count, stage) => count + stage.jobs.length, 0);
  }

  private countTasks(stages: Stage[]): number {
    return stages.reduce((count, stage) =>
      count + stage.jobs.reduce((jobCount, job) => jobCount + job.tasks.length, 0), 0);
  }

  private countIssues(stages: Stage[]): { errors: number; warnings: number } {
    let errors = 0;
    let warnings = 0;

    for (const stage of stages) {
      for (const job of stage.jobs) {
        for (const task of job.tasks) {
          errors += task.errorCount || 0;
          warnings += task.warningCount || 0;
        }
      }
    }

    return { errors, warnings };
  }

  // Export methods

  private exportToJson(comparison: RunComparison, config: ExportConfig): string {
    const data = config.summaryOnly ? {
      summary: comparison.summary,
      metrics: comparison.metrics,
      runs: comparison.runs.map(r => ({
        id: r.id,
        name: r.name,
        createdDate: r.createdDate,
        finishedDate: r.finishedDate,
        result: r.result,
        state: r.state
      }))
    } : comparison;

    return JSON.stringify(data, null, 2);
  }

  private exportToCsv(comparison: RunComparison, config: ExportConfig): string {
    const lines: string[] = [];

    // Header
    lines.push('Type,Name,Run1_Result,Run2_Result,Run1_Duration,Run2_Duration,Duration_Change_%,Status');

    // Stages
    for (const stage of comparison.stageComparisons) {
      lines.push([
        'Stage',
        stage.stageName,
        stage.result.run1 || 'N/A',
        stage.result.run2 || 'N/A',
        stage.duration.run1?.toString() || 'N/A',
        stage.duration.run2?.toString() || 'N/A',
        stage.duration.percentageChange?.toFixed(2) || 'N/A',
        stage.status
      ].join(','));
    }

    // Jobs (if detailed)
    if (!config.summaryOnly) {
      for (const job of comparison.jobComparisons) {
        lines.push([
          'Job',
          job.jobName,
          job.result.run1 || 'N/A',
          job.result.run2 || 'N/A',
          job.duration.run1?.toString() || 'N/A',
          job.duration.run2?.toString() || 'N/A',
          job.duration.percentageChange?.toFixed(2) || 'N/A',
          job.status
        ].join(','));
      }
    }

    return lines.join('\n');
  }

  private exportToHtml(comparison: RunComparison, config: ExportConfig): string {
    const title = config.title || `Pipeline Run Comparison: #${comparison.runs[0].id} vs #${comparison.runs[1].id}`;

    return `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
        .metric-value { font-size: 1.2em; font-weight: bold; }
        .improvement { color: green; }
        .regression { color: red; }
        .neutral { color: #666; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .status-both { background-color: #e8f5e8; }
        .status-different { background-color: #fff3cd; }
        .status-only-first { background-color: #f8d7da; }
        .status-only-second { background-color: #d1ecf1; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>Run #${comparison.runs[0].id}: ${comparison.runs[0].name} (${comparison.runs[0].result})</p>
        <p>Run #${comparison.runs[1].id}: ${comparison.runs[1].name} (${comparison.runs[1].result})</p>
    </div>
    
    <h2>Summary</h2>
    <p><strong>Overall Change:</strong> ${comparison.summary.overallChange}</p>
    ${comparison.summary.improvements.length > 0 ? `
    <h3>Improvements</h3>
    <ul>${comparison.summary.improvements.map(i => `<li class="improvement">${i}</li>`).join('')}</ul>
    ` : ''}
    ${comparison.summary.regressions.length > 0 ? `
    <h3>Regressions</h3>
    <ul>${comparison.summary.regressions.map(r => `<li class="regression">${r}</li>`).join('')}</ul>
    ` : ''}
    
    <h2>Metrics</h2>
    <div class="metrics">
        <div class="metric">
            <div>Duration</div>
            <div class="metric-value ${comparison.metrics.duration.percentageChange < 0 ? 'improvement' : comparison.metrics.duration.percentageChange > 0 ? 'regression' : 'neutral'}">
                ${comparison.metrics.duration.percentageChange.toFixed(1)}%
            </div>
        </div>
        <div class="metric">
            <div>Success Rate</div>
            <div class="metric-value ${comparison.metrics.successRate.difference > 0 ? 'improvement' : comparison.metrics.successRate.difference < 0 ? 'regression' : 'neutral'}">
                ${comparison.metrics.successRate.difference.toFixed(1)}%
            </div>
        </div>
        <div class="metric">
            <div>Error Difference</div>
            <div class="metric-value ${comparison.metrics.issues.errorDifference < 0 ? 'improvement' : comparison.metrics.issues.errorDifference > 0 ? 'regression' : 'neutral'}">
                ${comparison.metrics.issues.errorDifference > 0 ? '+' : ''}${comparison.metrics.issues.errorDifference}
            </div>
        </div>
    </div>
    
    <h2>Stage Comparison</h2>
    <table>
        <thead>
            <tr>
                <th>Stage</th>
                <th>Status</th>
                <th>Run 1 Result</th>
                <th>Run 2 Result</th>
                <th>Duration Change</th>
            </tr>
        </thead>
        <tbody>
            ${comparison.stageComparisons.map(stage => `
            <tr class="status-${stage.status.replace('_', '-')}">
                <td>${stage.stageName}</td>
                <td>${stage.status}</td>
                <td>${stage.result.run1 || 'N/A'}</td>
                <td>${stage.result.run2 || 'N/A'}</td>
                <td>${stage.duration.percentageChange ? stage.duration.percentageChange.toFixed(1) + '%' : 'N/A'}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
  }

  private exportToMarkdown(comparison: RunComparison, config: ExportConfig): string {
    const title = config.title || `Pipeline Run Comparison: #${comparison.runs[0].id} vs #${comparison.runs[1].id}`;

    let markdown = `# ${title}\n\n`;

    markdown += `**Run #${comparison.runs[0].id}:** ${comparison.runs[0].name} (${comparison.runs[0].result})\n`;
    markdown += `**Run #${comparison.runs[1].id}:** ${comparison.runs[1].name} (${comparison.runs[1].result})\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `**Overall Change:** ${comparison.summary.overallChange}\n\n`;

    if (comparison.summary.improvements.length > 0) {
      markdown += `### Improvements\n\n`;
      comparison.summary.improvements.forEach(improvement => {
        markdown += `- ✅ ${improvement}\n`;
      });
      markdown += '\n';
    }

    if (comparison.summary.regressions.length > 0) {
      markdown += `### Regressions\n\n`;
      comparison.summary.regressions.forEach(regression => {
        markdown += `- ❌ ${regression}\n`;
      });
      markdown += '\n';
    }

    markdown += `## Metrics\n\n`;
    markdown += `| Metric | Run 1 | Run 2 | Change |\n`;
    markdown += `|--------|-------|-------|--------|\n`;
    markdown += `| Duration | ${this.formatDuration(comparison.metrics.duration.run1)} | ${this.formatDuration(comparison.metrics.duration.run2)} | ${comparison.metrics.duration.percentageChange.toFixed(1)}% |\n`;
    markdown += `| Success Rate | ${comparison.metrics.successRate.run1.toFixed(1)}% | ${comparison.metrics.successRate.run2.toFixed(1)}% | ${comparison.metrics.successRate.difference.toFixed(1)}% |\n`;
    markdown += `| Errors | ${comparison.metrics.issues.run1.errors} | ${comparison.metrics.issues.run2.errors} | ${comparison.metrics.issues.errorDifference > 0 ? '+' : ''}${comparison.metrics.issues.errorDifference} |\n`;
    markdown += `| Warnings | ${comparison.metrics.issues.run1.warnings} | ${comparison.metrics.issues.run2.warnings} | ${comparison.metrics.issues.warningDifference > 0 ? '+' : ''}${comparison.metrics.issues.warningDifference} |\n\n`;

    markdown += `## Stage Comparison\n\n`;
    markdown += `| Stage | Status | Run 1 Result | Run 2 Result | Duration Change |\n`;
    markdown += `|-------|--------|--------------|--------------|----------------|\n`;

    comparison.stageComparisons.forEach(stage => {
      markdown += `| ${stage.stageName} | ${stage.status} | ${stage.result.run1 || 'N/A'} | ${stage.result.run2 || 'N/A'} | ${stage.duration.percentageChange ? stage.duration.percentageChange.toFixed(1) + '%' : 'N/A'} |\n`;
    });

    return markdown;
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}