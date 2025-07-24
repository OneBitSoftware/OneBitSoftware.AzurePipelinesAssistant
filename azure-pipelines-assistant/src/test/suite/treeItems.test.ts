import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  ProjectTreeItem,
  PipelineTreeItem,
  PipelineRunTreeItem,
  StageTreeItem,
  JobTreeItem,
  TaskTreeItem,
  LoadingTreeItem,
  ErrorTreeItem,
  createTreeItem,
  isProjectTreeItem,
  isPipelineTreeItem,
  isPipelineRunTreeItem,
  isStageTreeItem,
  isJobTreeItem,
  isTaskTreeItem,
  isLoadingTreeItem,
  isErrorTreeItem
} from '../../models/treeItems';
import { Project, Pipeline, PipelineRun, Stage, Job, Task } from '../../models';

suite('Tree Items Test Suite', () => {
  
  // Mock data
  const mockProject: Project = {
    id: 'test-project-id',
    name: 'Test Project',
    description: 'A test project',
    url: 'https://dev.azure.com/org/test-project',
    state: 'wellFormed',
    visibility: 'private'
  };

  const mockPipeline: Pipeline = {
    id: 123,
    name: 'Test Pipeline',
    project: mockProject,
    folder: 'test-folder',
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
        defaultBranch: 'refs/heads/main'
      }
    }
  };

  const mockPipelineRun: PipelineRun = {
    id: 456,
    name: 'Test Run',
    state: 'completed',
    result: 'succeeded',
    createdDate: new Date('2023-01-01T10:00:00Z'),
    finishedDate: new Date('2023-01-01T10:30:00Z'),
    pipeline: mockPipeline,
    resources: {
      repositories: {},
      pipelines: {},
      builds: {},
      containers: {},
      packages: {}
    },
    variables: {},
    url: 'https://dev.azure.com/org/test-project/_build/results?buildId=456'
  };

  const mockTask: Task = {
    id: 'task-1',
    name: 'TestTask',
    displayName: 'Test Task',
    state: 'completed',
    result: 'succeeded',
    startTime: new Date('2023-01-01T10:00:00Z'),
    finishTime: new Date('2023-01-01T10:05:00Z'),
    task: {
      id: 'task-def-id',
      name: 'TestTaskDefinition',
      version: '1.0.0'
    },
    inputs: {},
    enabled: true,
    continueOnError: false,
    order: 1
  };

  const mockJob: Job = {
    id: 'job-1',
    name: 'TestJob',
    displayName: 'Test Job',
    state: 'completed',
    result: 'succeeded',
    startTime: new Date('2023-01-01T10:00:00Z'),
    finishTime: new Date('2023-01-01T10:10:00Z'),
    tasks: [mockTask],
    agentName: 'test-agent',
    order: 1
  };

  const mockStage: Stage = {
    id: 'stage-1',
    name: 'TestStage',
    displayName: 'Test Stage',
    state: 'completed',
    result: 'succeeded',
    startTime: new Date('2023-01-01T10:00:00Z'),
    finishTime: new Date('2023-01-01T10:15:00Z'),
    jobs: [mockJob],
    dependsOn: [],
    order: 1
  };

  test('should create ProjectTreeItem with correct properties', () => {
    const item = new ProjectTreeItem(mockProject);
    
    assert.strictEqual(item.itemType, 'project');
    assert.strictEqual(item.id, 'project-test-project-id');
    assert.strictEqual(item.label, 'Test Project');
    assert.strictEqual(item.hasChildren, true);
    assert.strictEqual(item.contextValue, 'project');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.data, mockProject);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon);
    assert.ok(item.tooltip instanceof vscode.MarkdownString);
  });

  test('should create PipelineTreeItem with correct properties', () => {
    const item = new PipelineTreeItem(mockPipeline);
    
    assert.strictEqual(item.itemType, 'pipeline');
    assert.strictEqual(item.id, 'pipeline-123');
    assert.strictEqual(item.label, 'Test Pipeline');
    assert.strictEqual(item.hasChildren, true);
    assert.strictEqual(item.contextValue, 'pipeline');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.data, mockPipeline);
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'azurePipelinesAssistant.viewInBrowser');
  });

  test('should create PipelineRunTreeItem with correct properties', () => {
    const item = new PipelineRunTreeItem(mockPipelineRun);
    
    assert.strictEqual(item.itemType, 'run');
    assert.strictEqual(item.id, 'run-456');
    assert.strictEqual(item.label, '#456 - Test Run');
    assert.strictEqual(item.hasChildren, true);
    assert.strictEqual(item.contextValue, 'run-completed');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.data, mockPipelineRun);
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'azurePipelinesAssistant.viewRunDetails');
  });

  test('should create StageTreeItem with correct properties', () => {
    const item = new StageTreeItem(mockStage);
    
    assert.strictEqual(item.itemType, 'stage');
    assert.strictEqual(item.id, 'stage-stage-1');
    assert.strictEqual(item.label, 'Test Stage');
    assert.strictEqual(item.hasChildren, true);
    assert.strictEqual(item.contextValue, 'stage-completed');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.data, mockStage);
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'azurePipelinesAssistant.viewRunDetails');
  });

  test('should create JobTreeItem with correct properties', () => {
    const item = new JobTreeItem(mockJob);
    
    assert.strictEqual(item.itemType, 'job');
    assert.strictEqual(item.id, 'job-job-1');
    assert.strictEqual(item.label, 'Test Job');
    assert.strictEqual(item.hasChildren, true);
    assert.strictEqual(item.contextValue, 'job-completed');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.data, mockJob);
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'azurePipelinesAssistant.viewLogs');
  });

  test('should create TaskTreeItem with correct properties', () => {
    const item = new TaskTreeItem(mockTask);
    
    assert.strictEqual(item.itemType, 'task');
    assert.strictEqual(item.id, 'task-task-1');
    assert.strictEqual(item.label, 'Test Task');
    assert.strictEqual(item.hasChildren, false);
    assert.strictEqual(item.contextValue, 'task-completed');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.strictEqual(item.data, mockTask);
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'azurePipelinesAssistant.viewLogs');
  });

  test('should create LoadingTreeItem with correct properties', () => {
    const item = new LoadingTreeItem('test-loading');
    
    assert.strictEqual(item.itemType, 'loading');
    assert.strictEqual(item.id, 'test-loading');
    assert.strictEqual(item.label, 'Loading...');
    assert.strictEqual(item.hasChildren, false);
    assert.strictEqual(item.contextValue, 'loading');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.ok(item.iconPath instanceof vscode.ThemeIcon);
  });

  test('should create ErrorTreeItem with correct properties', () => {
    const errorMessage = 'Test error message';
    const item = new ErrorTreeItem(errorMessage, 'test-error');
    
    assert.strictEqual(item.itemType, 'error');
    assert.strictEqual(item.id, 'test-error');
    assert.strictEqual(item.label, errorMessage);
    assert.strictEqual(item.hasChildren, false);
    assert.strictEqual(item.contextValue, 'error');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'azurePipelinesAssistant.refresh');
  });

  test('should have working type guard functions', () => {
    const projectItem = new ProjectTreeItem(mockProject);
    const pipelineItem = new PipelineTreeItem(mockPipeline);
    const runItem = new PipelineRunTreeItem(mockPipelineRun);
    const stageItem = new StageTreeItem(mockStage);
    const jobItem = new JobTreeItem(mockJob);
    const taskItem = new TaskTreeItem(mockTask);
    const loadingItem = new LoadingTreeItem();
    const errorItem = new ErrorTreeItem('Error');
    
    // Test positive cases
    assert.ok(isProjectTreeItem(projectItem));
    assert.ok(isPipelineTreeItem(pipelineItem));
    assert.ok(isPipelineRunTreeItem(runItem));
    assert.ok(isStageTreeItem(stageItem));
    assert.ok(isJobTreeItem(jobItem));
    assert.ok(isTaskTreeItem(taskItem));
    assert.ok(isLoadingTreeItem(loadingItem));
    assert.ok(isErrorTreeItem(errorItem));
    
    // Test negative cases
    assert.ok(!isProjectTreeItem(pipelineItem));
    assert.ok(!isPipelineTreeItem(projectItem));
  });
});