import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ConfigurationService } from '../../../services/configurationService';
import { DEFAULT_CONFIGURATION, FavoritePipeline } from '../../../models/configuration';

suite('ConfigurationService', () => {
  let configService: ConfigurationService;
  let mockContext: sinon.SinonStubbedInstance<vscode.ExtensionContext>;
  let mockSecrets: sinon.SinonStubbedInstance<vscode.SecretStorage>;
  let mockWorkspaceConfig: sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;
  let getConfigurationStub: sinon.SinonStub;
  let onDidChangeConfigurationStub: sinon.SinonStub;

  setup(() => {
    // Create mock secrets
    mockSecrets = {
      get: sinon.stub(),
      store: sinon.stub(),
      delete: sinon.stub(),
      onDidChange: sinon.stub()
    } as any;

    // Create mock context
    mockContext = {
      secrets: mockSecrets,
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: vscode.Uri.file('/test'),
      extensionPath: '/test',
      asAbsolutePath: sinon.stub(),
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/global'),
      logUri: vscode.Uri.file('/test/log'),
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      environmentVariableCollection: {} as any,
      storagePath: '/test/storage',
      globalStoragePath: '/test/global',
      logPath: '/test/log',
      languageModelAccessInformation: {} as any
    };

    // Create mock workspace configuration
    mockWorkspaceConfig = {
      get: sinon.stub(),
      has: sinon.stub(),
      inspect: sinon.stub(),
      update: sinon.stub().resolves()
    } as any;

    // Stub vscode.workspace.getConfiguration
    getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns(mockWorkspaceConfig);
    
    // Stub vscode.workspace.onDidChangeConfiguration
    onDidChangeConfigurationStub = sinon.stub(vscode.workspace, 'onDidChangeConfiguration').returns({
      dispose: sinon.stub()
    } as any);

    configService = new ConfigurationService(mockContext);
  });

  teardown(() => {
    sinon.restore();
    configService.dispose();
  });

  suite('getConfiguration', () => {
    test('should return configuration with default values', () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('organization').returns('');
      mockWorkspaceConfig.get.withArgs('refreshInterval').returns(undefined);
      mockWorkspaceConfig.get.withArgs('maxRunsPerPipeline').returns(undefined);
      mockWorkspaceConfig.get.withArgs('showTimestamps').returns(undefined);
      mockWorkspaceConfig.get.withArgs('autoRefresh').returns(undefined);
      mockWorkspaceConfig.get.withArgs('favoriteProjects').returns(undefined);
      mockWorkspaceConfig.get.withArgs('favoritePipelines').returns(undefined);
      mockWorkspaceConfig.get.withArgs('cacheTimeout').returns(undefined);
      mockWorkspaceConfig.get.withArgs('logLevel').returns(undefined);
      mockWorkspaceConfig.get.withArgs('showWelcomeOnStartup').returns(undefined);
      mockWorkspaceConfig.get.withArgs('compactView').returns(undefined);

      // Act
      const config = configService.getConfiguration();

      // Assert
      assert.strictEqual(config.organization, '');
      assert.strictEqual(config.refreshInterval, DEFAULT_CONFIGURATION.refreshInterval);
      assert.strictEqual(config.maxRunsPerPipeline, DEFAULT_CONFIGURATION.maxRunsPerPipeline);
      assert.strictEqual(config.showTimestamps, DEFAULT_CONFIGURATION.showTimestamps);
      assert.strictEqual(config.autoRefresh, DEFAULT_CONFIGURATION.autoRefresh);
      assert.deepStrictEqual(config.favoriteProjects, DEFAULT_CONFIGURATION.favoriteProjects);
      assert.deepStrictEqual(config.favoritePipelines, DEFAULT_CONFIGURATION.favoritePipelines);
      assert.strictEqual(config.cacheTimeout, DEFAULT_CONFIGURATION.cacheTimeout);
      assert.strictEqual(config.logLevel, DEFAULT_CONFIGURATION.logLevel);
      assert.strictEqual(config.showWelcomeOnStartup, DEFAULT_CONFIGURATION.showWelcomeOnStartup);
      assert.strictEqual(config.compactView, DEFAULT_CONFIGURATION.compactView);
    });

    test('should return configuration with custom values', () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('organization').returns('myorg');
      mockWorkspaceConfig.get.withArgs('refreshInterval').returns(60);
      mockWorkspaceConfig.get.withArgs('maxRunsPerPipeline').returns(20);
      mockWorkspaceConfig.get.withArgs('showTimestamps').returns(false);
      mockWorkspaceConfig.get.withArgs('autoRefresh').returns(false);
      mockWorkspaceConfig.get.withArgs('favoriteProjects').returns(['proj1', 'proj2']);
      mockWorkspaceConfig.get.withArgs('favoritePipelines').returns([]);
      mockWorkspaceConfig.get.withArgs('cacheTimeout').returns(600);
      mockWorkspaceConfig.get.withArgs('logLevel').returns('debug');
      mockWorkspaceConfig.get.withArgs('showWelcomeOnStartup').returns(false);
      mockWorkspaceConfig.get.withArgs('compactView').returns(true);

      // Act
      const config = configService.getConfiguration();

      // Assert
      assert.strictEqual(config.organization, 'myorg');
      assert.strictEqual(config.refreshInterval, 60);
      assert.strictEqual(config.maxRunsPerPipeline, 20);
      assert.strictEqual(config.showTimestamps, false);
      assert.strictEqual(config.autoRefresh, false);
      assert.deepStrictEqual(config.favoriteProjects, ['proj1', 'proj2']);
      assert.deepStrictEqual(config.favoritePipelines, []);
      assert.strictEqual(config.cacheTimeout, 600);
      assert.strictEqual(config.logLevel, 'debug');
      assert.strictEqual(config.showWelcomeOnStartup, false);
      assert.strictEqual(config.compactView, true);
    });
  });

  suite('setOrganization', () => {
    test('should update organization configuration', async () => {
      // Act
      await configService.setOrganization('testorg');

      // Assert
      assert.ok(mockWorkspaceConfig.update.calledWith('organization', 'testorg', vscode.ConfigurationTarget.Global));
    });
  });

  suite('Personal Access Token', () => {
    test('should get PAT from secure storage', async () => {
      // Arrange
      mockSecrets.get.withArgs('azurePipelinesAssistant.personalAccessToken').resolves('test-pat');

      // Act
      const pat = await configService.getPersonalAccessToken();

      // Assert
      assert.strictEqual(pat, 'test-pat');
    });

    test('should store PAT in secure storage', async () => {
      // Act
      await configService.setPersonalAccessToken('new-pat');

      // Assert
      assert.ok(mockSecrets.store.calledWith('azurePipelinesAssistant.personalAccessToken', 'new-pat'));
    });
  });

  suite('Favorites Management', () => {
    test('should add project to favorites', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('favoriteProjects').returns(['existing-proj']);

      // Act
      await configService.addProjectToFavorites('new-proj');

      // Assert
      assert.ok(mockWorkspaceConfig.update.calledWith('favoriteProjects', ['existing-proj', 'new-proj'], vscode.ConfigurationTarget.Global));
    });

    test('should not add duplicate project to favorites', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('favoriteProjects').returns(['existing-proj']);

      // Act
      await configService.addProjectToFavorites('existing-proj');

      // Assert
      assert.ok(mockWorkspaceConfig.update.notCalled);
    });

    test('should remove project from favorites', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('favoriteProjects').returns(['proj1', 'proj2', 'proj3']);

      // Act
      await configService.removeProjectFromFavorites('proj2');

      // Assert
      assert.ok(mockWorkspaceConfig.update.calledWith('favoriteProjects', ['proj1', 'proj3'], vscode.ConfigurationTarget.Global));
    });

    test('should check if project is favorite', () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('favoriteProjects').returns(['proj1', 'proj2']);

      // Act & Assert
      assert.strictEqual(configService.isProjectFavorite('proj1'), true);
      assert.strictEqual(configService.isProjectFavorite('proj3'), false);
    });

    test('should add pipeline to favorites', async () => {
      // Arrange
      const existingPipeline: FavoritePipeline = { projectId: 'proj1', pipelineId: 1, name: 'Pipeline 1' };
      const newPipeline: FavoritePipeline = { projectId: 'proj2', pipelineId: 2, name: 'Pipeline 2' };
      mockWorkspaceConfig.get.withArgs('favoritePipelines').returns([existingPipeline]);

      // Act
      await configService.addPipelineToFavorites(newPipeline);

      // Assert
      assert.ok(mockWorkspaceConfig.update.calledWith('favoritePipelines', [existingPipeline, newPipeline], vscode.ConfigurationTarget.Global));
    });

    test('should not add duplicate pipeline to favorites', async () => {
      // Arrange
      const pipeline: FavoritePipeline = { projectId: 'proj1', pipelineId: 1, name: 'Pipeline 1' };
      mockWorkspaceConfig.get.withArgs('favoritePipelines').returns([pipeline]);

      // Act
      await configService.addPipelineToFavorites(pipeline);

      // Assert
      assert.ok(mockWorkspaceConfig.update.notCalled);
    });

    test('should remove pipeline from favorites', async () => {
      // Arrange
      const pipelines: FavoritePipeline[] = [
        { projectId: 'proj1', pipelineId: 1, name: 'Pipeline 1' },
        { projectId: 'proj2', pipelineId: 2, name: 'Pipeline 2' },
        { projectId: 'proj1', pipelineId: 3, name: 'Pipeline 3' }
      ];
      mockWorkspaceConfig.get.withArgs('favoritePipelines').returns(pipelines);

      // Act
      await configService.removePipelineFromFavorites('proj1', 1);

      // Assert
      const expectedPipelines = [
        { projectId: 'proj2', pipelineId: 2, name: 'Pipeline 2' },
        { projectId: 'proj1', pipelineId: 3, name: 'Pipeline 3' }
      ];
      assert.ok(mockWorkspaceConfig.update.calledWith('favoritePipelines', expectedPipelines, vscode.ConfigurationTarget.Global));
    });

    test('should check if pipeline is favorite', () => {
      // Arrange
      const pipelines: FavoritePipeline[] = [
        { projectId: 'proj1', pipelineId: 1, name: 'Pipeline 1' },
        { projectId: 'proj2', pipelineId: 2, name: 'Pipeline 2' }
      ];
      mockWorkspaceConfig.get.withArgs('favoritePipelines').returns(pipelines);

      // Act & Assert
      assert.strictEqual(configService.isPipelineFavorite('proj1', 1), true);
      assert.strictEqual(configService.isPipelineFavorite('proj1', 2), false);
      assert.strictEqual(configService.isPipelineFavorite('proj3', 1), false);
    });
  });

  suite('validateConfiguration', () => {
    test('should validate valid configuration', () => {
      // Arrange
      const config = {
        organization: 'myorg',
        refreshInterval: 30,
        maxRunsPerPipeline: 10,
        showTimestamps: true,
        autoRefresh: true,
        favoriteProjects: [],
        favoritePipelines: [],
        cacheTimeout: 300,
        logLevel: 'info' as const,
        showWelcomeOnStartup: true,
        compactView: false
      };

      // Act
      const result = configService.validateConfiguration(config);

      // Assert
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should detect invalid organization format', () => {
      // Arrange
      const config = {
        organization: '-invalid-org-',
        refreshInterval: 30,
        maxRunsPerPipeline: 10,
        showTimestamps: true,
        autoRefresh: true,
        favoriteProjects: [],
        favoritePipelines: [],
        cacheTimeout: 300,
        logLevel: 'info' as const,
        showWelcomeOnStartup: true,
        compactView: false
      };

      // Act
      const result = configService.validateConfiguration(config);

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].field, 'organization');
    });

    test('should detect out-of-range values', () => {
      // Arrange
      const config = {
        organization: 'myorg',
        refreshInterval: 5, // Too low
        maxRunsPerPipeline: 100, // Too high
        showTimestamps: true,
        autoRefresh: true,
        favoriteProjects: [],
        favoritePipelines: [],
        cacheTimeout: 30, // Too low
        logLevel: 'info' as const,
        showWelcomeOnStartup: true,
        compactView: false
      };

      // Act
      const result = configService.validateConfiguration(config);

      // Assert
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 3);
      assert.ok(result.errors.some(e => e.field === 'refreshInterval'));
      assert.ok(result.errors.some(e => e.field === 'maxRunsPerPipeline'));
      assert.ok(result.errors.some(e => e.field === 'cacheTimeout'));
    });
  });

  suite('isConfigured', () => {
    test('should return true when organization and PAT are set', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('organization').returns('myorg');
      mockSecrets.get.withArgs('azurePipelinesAssistant.personalAccessToken').resolves('test-pat');

      // Act
      const isConfigured = await configService.isConfigured();

      // Assert
      assert.strictEqual(isConfigured, true);
    });

    test('should return false when organization is missing', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('organization').returns('');
      mockSecrets.get.withArgs('azurePipelinesAssistant.personalAccessToken').resolves('test-pat');

      // Act
      const isConfigured = await configService.isConfigured();

      // Assert
      assert.strictEqual(isConfigured, false);
    });

    test('should return false when PAT is missing', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('organization').returns('myorg');
      mockSecrets.get.withArgs('azurePipelinesAssistant.personalAccessToken').resolves(undefined);

      // Act
      const isConfigured = await configService.isConfigured();

      // Assert
      assert.strictEqual(isConfigured, false);
    });
  });

  suite('clearConfiguration', () => {
    test('should clear PAT and reset configuration', async () => {
      // Act
      await configService.clearConfiguration();

      // Assert
      assert.ok(mockSecrets.delete.calledWith('azurePipelinesAssistant.personalAccessToken'));
      assert.ok(mockWorkspaceConfig.update.calledWith('organization', undefined, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('favoriteProjects', DEFAULT_CONFIGURATION.favoriteProjects, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('favoritePipelines', DEFAULT_CONFIGURATION.favoritePipelines, vscode.ConfigurationTarget.Global));
    });
  });

  suite('exportConfiguration', () => {
    test('should export configuration as JSON', async () => {
      // Arrange
      mockWorkspaceConfig.get.withArgs('organization').returns('myorg');
      mockWorkspaceConfig.get.withArgs('refreshInterval').returns(60);
      mockSecrets.get.withArgs('azurePipelinesAssistant.personalAccessToken').resolves('test-pat');

      // Act
      const exportedConfig = await configService.exportConfiguration();

      // Assert
      const parsed = JSON.parse(exportedConfig);
      assert.strictEqual(parsed.organization, 'myorg');
      assert.strictEqual(parsed.refreshInterval, 60);
      assert.strictEqual(parsed.personalAccessToken, '***REDACTED***');
      assert.ok(parsed.exportedAt);
      assert.strictEqual(parsed.version, '1.0');
    });
  });

  suite('importConfiguration', () => {
    test('should import valid configuration', async () => {
      // Arrange
      const configToImport = {
        organization: 'imported-org',
        refreshInterval: 45,
        maxRunsPerPipeline: 15,
        showTimestamps: false,
        autoRefresh: false,
        favoriteProjects: ['proj1'],
        favoritePipelines: [],
        cacheTimeout: 400,
        logLevel: 'debug',
        showWelcomeOnStartup: false,
        compactView: true
      };

      // Act
      await configService.importConfiguration(JSON.stringify(configToImport));

      // Assert
      assert.ok(mockWorkspaceConfig.update.calledWith('organization', 'imported-org', vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('refreshInterval', 45, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('maxRunsPerPipeline', 15, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('showTimestamps', false, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('autoRefresh', false, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('favoriteProjects', ['proj1'], vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('cacheTimeout', 400, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('logLevel', 'debug', vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('showWelcomeOnStartup', false, vscode.ConfigurationTarget.Global));
      assert.ok(mockWorkspaceConfig.update.calledWith('compactView', true, vscode.ConfigurationTarget.Global));
    });

    test('should reject invalid configuration', async () => {
      // Arrange
      const invalidConfig = {
        organization: '-invalid-',
        refreshInterval: 5 // Too low
      };

      // Act & Assert
      await assert.rejects(
        () => configService.importConfiguration(JSON.stringify(invalidConfig)),
        /Invalid configuration/
      );
    });

    test('should reject malformed JSON', async () => {
      // Act & Assert
      await assert.rejects(
        () => configService.importConfiguration('invalid json'),
        /Failed to import configuration/
      );
    });
  });
});