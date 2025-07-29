/**
 * Mock data and test fixtures for consistent testing across all test suites
 */

import { Credentials, ValidationResult } from '../../interfaces/authenticationService';
import {
  Issue,
  Job,
  LogEntry,
  Pipeline,
  PipelineRun,
  PipelineRunDetails,
  Project,
  Repository,
  RunResources,
  Stage,
  Task,
  TimelineRecord,
  Variable
} from '../../models';
import { ExtensionConfiguration } from '../../models/configuration';

export class MockDataFactory {
  static createProject(overrides: Partial<Project> = {}): Project {
    return {
      id: 'test-project-id',
      name: 'Test Project',
      description: 'A test project for unit testing',
      url: 'https://dev.azure.com/testorg/test-project',
      state: 'wellFormed',
      visibility: 'private',
      ...overrides
    };
  }

  static createRepository(overrides: Partial<Repository> = {}): Repository {
    return {
      id: 'test-repo-id',
      name: 'test-repository',
      url: 'https://dev.azure.com/testorg/test-project/_git/test-repository',
      type: 'TfsGit',
      defaultBranch: 'refs/heads/main',
      ...overrides
    };
  }

  static createPipeline(overrides: Partial<Pipeline> = {}): Pipeline {
    return {
      id: 123,
      name: 'Test Pipeline',
      project: this.createProject(),
      folder: 'test-folder',
      revision: 1,
      url: 'https://dev.azure.com/testorg/test-project/_build?definitionId=123',
      configuration: {
        type: 'yaml',
        path: 'azure-pipelines.yml',
        repository: this.createRepository()
      },
      ...overrides
    };
  }

  static createRunResources(overrides: Partial<RunResources> = {}): RunResources {
    return {
      repositories: {
        'self': this.createRepository()
      },
      pipelines: {},
      builds: {},
      containers: {},
      packages: {},
      ...overrides
    };
  }

  static createVariable(name: string, value: string, isSecret: boolean = false): Variable {
    return {
      value,
      isSecret
    };
  }

  static createPipelineRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
    return {
      id: 456,
      name: 'Test Run #456',
      state: 'completed',
      result: 'succeeded',
      createdDate: new Date('2023-01-01T10:00:00Z'),
      finishedDate: new Date('2023-01-01T10:30:00Z'),
      pipeline: this.createPipeline(),
      resources: this.createRunResources(),
      variables: {
        'BuildConfiguration': this.createVariable('BuildConfiguration', 'Release'),
        'System.Debug': this.createVariable('System.Debug', 'false')
      },
      url: 'https://dev.azure.com/testorg/test-project/_build/results?buildId=456',
      ...overrides
    };
  }

  static createTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'task-1',
      name: 'test-task',
      displayName: 'Test Task',
      state: 'completed',
      result: 'succeeded',
      startTime: new Date('2023-01-01T10:05:00Z'),
      finishTime: new Date('2023-01-01T10:10:00Z'),
      task: {
        id: 'task-def-1',
        name: 'TestTask',
        version: '1.0.0'
      },
      log: {
        id: 1,
        type: 'Container',
        url: 'https://dev.azure.com/test/_apis/build/builds/1/logs/1'
      },
      issues: [],
      ...overrides
    };
  }

  static createJob(overrides: Partial<Job> = {}): Job {
    return {
      id: 'job-1',
      name: 'test-job',
      displayName: 'Test Job',
      state: 'completed',
      result: 'succeeded',
      startTime: new Date('2023-01-01T10:02:00Z'),
      finishTime: new Date('2023-01-01T10:15:00Z'),
      agentName: 'test-agent-1',
      tasks: [
        this.createTask(),
        this.createTask({
          id: 'task-2',
          name: 'test-task-2',
          displayName: 'Test Task 2',
          startTime: new Date('2023-01-01T10:10:00Z'),
          finishTime: new Date('2023-01-01T10:15:00Z')
        })
      ],
      ...overrides
    };
  }

  static createStage(overrides: Partial<Stage> = {}): Stage {
    return {
      id: 'stage-1',
      name: 'build',
      displayName: 'Build Stage',
      state: 'completed',
      result: 'succeeded',
      startTime: new Date('2023-01-01T10:01:00Z'),
      finishTime: new Date('2023-01-01T10:20:00Z'),
      jobs: [
        this.createJob(),
        this.createJob({
          id: 'job-2',
          name: 'test-job-2',
          displayName: 'Test Job 2',
          startTime: new Date('2023-01-01T10:15:00Z'),
          finishTime: new Date('2023-01-01T10:20:00Z')
        })
      ],
      dependsOn: [],
      ...overrides
    };
  }

  static createTimelineRecord(overrides: Partial<TimelineRecord> = {}): TimelineRecord {
    return {
      id: 'timeline-1',
      type: 'Stage',
      name: 'Build',
      startTime: new Date('2023-01-01T10:01:00Z'),
      finishTime: new Date('2023-01-01T10:20:00Z'),
      percentComplete: 100,
      state: 'completed',
      result: 'succeeded',
      changeId: 1,
      lastModified: new Date('2023-01-01T10:20:00Z'),
      workerName: 'test-worker',
      order: 1,
      errorCount: 0,
      warningCount: 0,
      attempt: 1,
      identifier: 'stage-1',
      ...overrides
    };
  }

  static createPipelineRunDetails(overrides: Partial<PipelineRunDetails> = {}): PipelineRunDetails {
    const baseRun = this.createPipelineRun();
    return {
      ...baseRun,
      stages: [
        this.createStage(),
        this.createStage({
          id: 'stage-2',
          name: 'deploy',
          displayName: 'Deploy Stage',
          dependsOn: ['stage-1'],
          startTime: new Date('2023-01-01T10:20:00Z'),
          finishTime: new Date('2023-01-01T10:30:00Z')
        })
      ],
      timeline: [
        this.createTimelineRecord(),
        this.createTimelineRecord({
          id: 'timeline-2',
          name: 'Deploy',
          startTime: new Date('2023-01-01T10:20:00Z'),
          finishTime: new Date('2023-01-01T10:30:00Z')
        })
      ],
      logs: [
        {
          id: 1,
          type: 'Container',
          url: 'https://dev.azure.com/testorg/test-project/_apis/build/builds/456/logs/1'
        },
        {
          id: 2,
          type: 'Container',
          url: 'https://dev.azure.com/testorg/test-project/_apis/build/builds/456/logs/2'
        }
      ],
      ...overrides
    };
  }

  static createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
    return {
      id: 1,
      timestamp: new Date('2023-01-01T10:05:00Z'),
      level: 'info',
      message: 'Test log message',
      source: 'test-task',
      ...overrides
    };
  }

  static createIssue(overrides: Partial<Issue> = {}): Issue {
    return {
      type: 'error',
      category: 'General',
      message: 'Test error message',
      data: {},
      ...overrides
    };
  }

  static createCredentials(overrides: Partial<Credentials> = {}): Credentials {
    return {
      organization: 'testorg',
      personalAccessToken: 'test-pat-token-12345',
      ...overrides
    };
  }

  static createValidationResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
    return {
      isValid: true,
      permissions: [
        { name: 'Build', displayName: 'Build (read)', required: true },
        { name: 'Code', displayName: 'Code (read)', required: true },
        { name: 'Project', displayName: 'Project and team (read)', required: true },
        { name: 'Release', displayName: 'Release (read)', required: true }
      ],
      missingPermissions: [],
      userInfo: {
        displayName: 'Test User',
        emailAddress: 'test.user@example.com',
        id: 'test-user-id'
      },
      ...overrides
    };
  }

  static createExtensionConfiguration(overrides: Partial<ExtensionConfiguration> = {}): ExtensionConfiguration {
    return {
      organization: 'testorg',
      refreshInterval: 30,
      maxRunsPerPipeline: 10,
      showTimestamps: true,
      favoriteProjects: ['test-project-id'],
      favoritePipelines: [],
      autoRefresh: true,
      cacheTimeout: 300,
      logLevel: 'info',
      showWelcomeOnStartup: true,
      compactView: false,
      ...overrides
    };
  }

  // Helper methods for creating arrays of mock data
  static createProjects(count: number): Project[] {
    return Array.from({ length: count }, (_, i) =>
      this.createProject({
        id: `project-${i + 1}`,
        name: `Project ${i + 1}`
      })
    );
  }

  static createPipelines(count: number, project?: Project): Pipeline[] {
    const testProject = project || this.createProject();
    return Array.from({ length: count }, (_, i) =>
      this.createPipeline({
        id: i + 1,
        name: `Pipeline ${i + 1}`,
        project: testProject
      })
    );
  }

  static createPipelineRuns(count: number, pipeline?: Pipeline): PipelineRun[] {
    const testPipeline = pipeline || this.createPipeline();
    return Array.from({ length: count }, (_, i) =>
      this.createPipelineRun({
        id: i + 1,
        name: `Run #${i + 1}`,
        pipeline: testPipeline,
        createdDate: new Date(Date.now() - (i * 60 * 60 * 1000)) // Each run 1 hour apart
      })
    );
  }

  static createLogEntries(count: number): LogEntry[] {
    return Array.from({ length: count }, (_, i) =>
      this.createLogEntry({
        id: i + 1,
        message: `Log message ${i + 1}`,
        timestamp: new Date(Date.now() - ((count - i) * 1000)) // Each log 1 second apart
      })
    );
  }

  // Error scenarios for testing error handling
  static createFailedPipelineRun(): PipelineRun {
    return this.createPipelineRun({
      state: 'completed',
      result: 'failed',
      finishedDate: new Date('2023-01-01T10:15:00Z') // Failed after 15 minutes
    });
  }

  static createInProgressPipelineRun(): PipelineRun {
    return this.createPipelineRun({
      state: 'inProgress',
      result: undefined,
      finishedDate: undefined
    });
  }

  static createCancelledPipelineRun(): PipelineRun {
    return this.createPipelineRun({
      state: 'completed',
      result: 'canceled',
      finishedDate: new Date('2023-01-01T10:10:00Z') // Cancelled after 10 minutes
    });
  }

  static createFailedStage(): Stage {
    return this.createStage({
      state: 'completed',
      result: 'failed',
      jobs: [
        this.createJob({
          state: 'completed',
          result: 'failed',
          tasks: [
            this.createTask({
              state: 'completed',
              result: 'failed',
              errorCount: 1,
              issues: [this.createIssue()]
            })
          ]
        })
      ]
    });
  }

  static createInvalidValidationResult(): ValidationResult {
    return this.createValidationResult({
      isValid: false,
      permissions: [{ name: 'Build', displayName: 'Build (read)', required: true }],
      missingPermissions: [
        { name: 'Code', displayName: 'Code (read)', required: true },
        { name: 'Project', displayName: 'Project and team (read)', required: true },
        { name: 'Release', displayName: 'Release (read)', required: true }
      ],
      errorMessage: 'Insufficient permissions'
    });
  }
}

// Export commonly used mock data instances
export const mockProject = MockDataFactory.createProject();
export const mockPipeline = MockDataFactory.createPipeline();
export const mockPipelineRun = MockDataFactory.createPipelineRun();
export const mockPipelineRunDetails = MockDataFactory.createPipelineRunDetails();
export const mockCredentials = MockDataFactory.createCredentials();
export const mockValidationResult = MockDataFactory.createValidationResult();
export const mockConfiguration = MockDataFactory.createExtensionConfiguration();