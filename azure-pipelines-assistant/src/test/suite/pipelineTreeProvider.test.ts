import * as assert from 'assert';
import * as sinon from 'sinon';
import { AuthenticationError } from '../../errors/errorTypes';
import { Pipeline, Project } from '../../models';
import { ErrorTreeItem, PipelineTreeItem, ProjectTreeItem } from '../../models/treeItems';
import { PipelineTreeProvider } from '../../providers/pipelineTreeProvider';

suite('PipelineTreeProvider', () => {
  let provider: PipelineTreeProvider;
  let mockAzureDevOpsService: any;
  let mockAuthService: any;

  const mockProject: Project = {
    id: 'project1',
    name: 'Test Project',
    description: 'Test project description',
    url: 'https://dev.azure.com/org/project1',
    state: 'wellFormed',
    visibility: 'private'
  };

  const mockPipeline: Pipeline = {
    id: 123,
    name: 'Test Pipeline',
    project: mockProject,
    folder: 'test-folder',
    revision: 1,
    url: 'https://dev.azure.com/org/project1/_build?definitionId=123',
    configuration: {
      type: 'yaml',
      path: 'azure-pipelines.yml',
      repository: {
        id: 'repo1',
        name: 'test-repo',
        url: 'https://dev.azure.com/org/project1/_git/test-repo',
        type: 'TfsGit',
        defaultBranch: 'main'
      }
    }
  };

  setup(() => {
    // Create mock services
    mockAzureDevOpsService = {
      getProjects: sinon.stub(),
      getPipelines: sinon.stub(),
      getPipelineRuns: sinon.stub(),
      getRunDetails: sinon.stub()
    };

    mockAuthService = {
      isAuthenticated: sinon.stub(),
      onAuthenticationChanged: sinon.stub().returns({ dispose: sinon.stub() })
    };

    // Create provider
    provider = new PipelineTreeProvider(mockAzureDevOpsService, mockAuthService);
  });

  teardown(() => {
    sinon.restore();
    provider.dispose();
  });

  suite('getChildren', () => {
    test('should return empty array when not authenticated', async () => {
      // Arrange
      mockAuthService.isAuthenticated.returns(false);

      // Act
      const children = await provider.getChildren();

      // Assert
      assert.strictEqual(children.length, 0);
    });

    test('should return projects when authenticated', async () => {
      // Arrange
      mockAuthService.isAuthenticated.returns(true);
      mockAzureDevOpsService.getProjects.resolves([mockProject]);

      // Act
      const children = await provider.getChildren();

      // Assert
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof ProjectTreeItem);
    });

    test('should return error when no projects found', async () => {
      // Arrange
      mockAuthService.isAuthenticated.returns(true);
      mockAzureDevOpsService.getProjects.resolves([]);

      // Act
      const children = await provider.getChildren();

      // Assert
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof ErrorTreeItem);
    });

    test('should return pipelines for project', async () => {
      // Arrange
      const projectItem = new ProjectTreeItem(mockProject);
      mockAzureDevOpsService.getPipelines.resolves([mockPipeline]);

      // Act
      const children = await provider.getChildren(projectItem);

      // Assert
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof PipelineTreeItem);
    });
  });

  suite('error handling', () => {
    test('should handle authentication errors', async () => {
      // Arrange
      mockAuthService.isAuthenticated.returns(true);
      const authError = new AuthenticationError('Invalid PAT', 'INVALID_PAT');
      mockAzureDevOpsService.getProjects.rejects(authError);

      // Act
      const children = await provider.getChildren();

      // Assert
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof ErrorTreeItem);
      assert.strictEqual(children[0].label, 'Invalid Personal Access Token');
    });

    test('should handle network errors', async () => {
      // Arrange
      mockAuthService.isAuthenticated.returns(true);
      const error = new Error('Network error');
      mockAzureDevOpsService.getProjects.rejects(error);

      // Act
      const children = await provider.getChildren();

      // Assert
      assert.strictEqual(children.length, 1);
      assert.ok(children[0] instanceof ErrorTreeItem);
    });
  });

  suite('refresh functionality', () => {
    test('should refresh tree', () => {
      // Act & Assert - should not throw
      assert.doesNotThrow(() => provider.refresh());
    });

    test('should refresh specific item', () => {
      // Arrange
      const projectItem = new ProjectTreeItem(mockProject);

      // Act & Assert - should not throw
      assert.doesNotThrow(() => provider.refreshItem(projectItem));
    });
  });

  suite('getTreeItem', () => {
    test('should return tree item', () => {
      // Arrange
      const projectItem = new ProjectTreeItem(mockProject);

      // Act
      const result = provider.getTreeItem(projectItem);

      // Assert
      assert.strictEqual(result, projectItem);
    });
  });
});