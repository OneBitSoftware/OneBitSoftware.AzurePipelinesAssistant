import { suite, test } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

suite('Cross-IDE Compatibility Tests', () => {
  
  test('VS Code API version compatibility', () => {
    // Read package.json to check engine requirements
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredVersion = packageJson.engines.vscode;
    assert.ok(requiredVersion, 'VS Code engine version should be specified');
    
    // Check if the required version is 1.74.0 or higher
    const versionMatch = requiredVersion.match(/\^?(\d+\.\d+\.\d+)/);
    assert.ok(versionMatch, 'Version should be in valid format');
    
    const version = versionMatch[1];
    const [major, minor, patch] = version.split('.').map(Number);
    
    // Ensure minimum version is 1.74.0
    assert.ok(major >= 1, 'Major version should be at least 1');
    if (major === 1) {
      assert.ok(minor >= 74, 'Minor version should be at least 74 for VS Code 1.74.0+');
    }
  });

  test('Extension manifest has required fields for Open VSX', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check required fields for Open VSX Registry
    const requiredFields = ['name', 'version', 'publisher', 'engines', 'license', 'repository'];
    
    for (const field of requiredFields) {
      assert.ok(packageJson[field], `Package.json should have ${field} field for Open VSX compatibility`);
    }
  });

  test('Extension activation events are properly configured', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    assert.ok(packageJson.activationEvents, 'Activation events should be defined');
    assert.ok(Array.isArray(packageJson.activationEvents), 'Activation events should be an array');
    assert.ok(packageJson.activationEvents.length > 0, 'Should have at least one activation event');
  });

  test('Extension contributes are properly configured', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    assert.ok(packageJson.contributes, 'Contributes section should be defined');
    assert.ok(packageJson.contributes.views, 'Views should be contributed');
    assert.ok(packageJson.contributes.commands, 'Commands should be contributed');
    assert.ok(packageJson.contributes.configuration, 'Configuration should be contributed');
  });

  test('Main entry point exists', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    assert.ok(packageJson.main, 'Main entry point should be defined');
    
    const mainPath = path.join(__dirname, '..', '..', packageJson.main);
    assert.ok(fs.existsSync(mainPath), 'Main entry point file should exist');
  });

  test('Cross-platform path handling', () => {
    // Test that path operations work correctly across platforms
    const testPaths = [
      path.join('src', 'extension.ts'),
      path.join('dist', 'extension.js'),
      path.resolve(__dirname, '..', '..', 'package.json')
    ];
    
    for (const testPath of testPaths) {
      const normalized = path.normalize(testPath);
      const parsed = path.parse(normalized);
      
      assert.ok(parsed.dir, 'Path should have directory component');
      assert.ok(parsed.base, 'Path should have base component');
    }
  });

  test('Build configuration supports cross-platform', () => {
    // Check if build configuration files exist
    const buildConfigPath = path.join(__dirname, '..', '..', 'build-config.js');
    assert.ok(fs.existsSync(buildConfigPath), 'Build configuration should exist');
    
    const esbuildPath = path.join(__dirname, '..', '..', 'esbuild.js');
    assert.ok(fs.existsSync(esbuildPath), 'ESBuild configuration should exist');
  });

  test('IDE compatibility documentation exists', () => {
    const compatibilityDocPath = path.join(__dirname, '..', '..', 'IDE-COMPATIBILITY.md');
    assert.ok(fs.existsSync(compatibilityDocPath), 'IDE compatibility documentation should exist');
  });

  test('Cross-platform scripts exist', () => {
    const scriptsDir = path.join(__dirname, '..', '..', 'scripts');
    assert.ok(fs.existsSync(scriptsDir), 'Scripts directory should exist');
    
    const expectedScripts = [
      'package-cross-platform.js',
      'test-compatibility.js',
      'validate-platforms.js'
    ];
    
    for (const script of expectedScripts) {
      const scriptPath = path.join(scriptsDir, script);
      assert.ok(fs.existsSync(scriptPath), `Script ${script} should exist`);
    }
  });
});