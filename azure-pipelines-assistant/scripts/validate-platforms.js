#!/usr/bin/env node

/**
 * Platform validation script for Azure Pipelines Assistant
 * Validates extension functionality across different platforms
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { BUILD_CONFIG, validatePlatformCompatibility } = require('../build-config');

/**
 * Get system information
 */
function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    nodeVersion: process.version,
    npmVersion: execSync('npm --version', { encoding: 'utf8' }).trim()
  };
}

/**
 * Test file system operations
 */
function testFileSystemOperations() {
  console.log('\n📁 Testing file system operations...');
  
  const testDir = path.join(__dirname, '..', 'temp-test');
  const testFile = path.join(testDir, 'test.txt');
  
  try {
    // Create directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(testFile, 'Test content');
    
    // Read file
    const content = fs.readFileSync(testFile, 'utf8');
    
    // Verify content
    if (content === 'Test content') {
      console.log('✅ File system operations work correctly');
      
      // Cleanup
      fs.unlinkSync(testFile);
      fs.rmdirSync(testDir);
      
      return true;
    } else {
      console.log('❌ File content mismatch');
      return false;
    }
  } catch (error) {
    console.log(`❌ File system operations failed: ${error.message}`);
    return false;
  }
}

/**
 * Test path operations
 */
function testPathOperations() {
  console.log('\n🛤️  Testing path operations...');
  
  const testPaths = [
    path.join('src', 'extension.ts'),
    path.join('dist', 'extension.js'),
    path.join('node_modules', '.bin'),
    path.resolve(__dirname, '..', 'package.json')
  ];
  
  let pathTestsPassed = 0;
  
  for (const testPath of testPaths) {
    try {
      const normalized = path.normalize(testPath);
      const parsed = path.parse(normalized);
      
      console.log(`  Testing path: ${testPath}`);
      console.log(`    Normalized: ${normalized}`);
      console.log(`    Directory: ${parsed.dir}`);
      console.log(`    Base: ${parsed.base}`);
      
      pathTestsPassed++;
    } catch (error) {
      console.log(`❌ Path operation failed for ${testPath}: ${error.message}`);
    }
  }
  
  const allPathsWork = pathTestsPassed === testPaths.length;
  console.log(`${allPathsWork ? '✅' : '❌'} Path operations: ${pathTestsPassed}/${testPaths.length} passed`);
  
  return allPathsWork;
}

/**
 * Test command execution
 */
function testCommandExecution() {
  console.log('\n⚡ Testing command execution...');
  
  const commands = [
    { cmd: 'node --version', desc: 'Node.js version' },
    { cmd: 'npm --version', desc: 'npm version' },
    { cmd: 'npx --version', desc: 'npx version' }
  ];
  
  let commandTestsPassed = 0;
  
  for (const { cmd, desc } of commands) {
    try {
      const output = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
      console.log(`✅ ${desc}: ${output.trim()}`);
      commandTestsPassed++;
    } catch (error) {
      console.log(`❌ ${desc} failed: ${error.message}`);
    }
  }
  
  const allCommandsWork = commandTestsPassed === commands.length;
  console.log(`${allCommandsWork ? '✅' : '❌'} Command execution: ${commandTestsPassed}/${commands.length} passed`);
  
  return allCommandsWork;
}

/**
 * Test environment variables
 */
function testEnvironmentVariables() {
  console.log('\n🌍 Testing environment variables...');
  
  const requiredEnvVars = ['PATH', 'HOME', 'USER'];
  const optionalEnvVars = ['VSCODE_EXTENSIONS', 'CURSOR_EXTENSIONS', 'WINDSURF_EXTENSIONS'];
  
  let envTestsPassed = 0;
  
  // Test required environment variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
      envTestsPassed++;
    } else {
      console.log(`❌ ${envVar}: Not set`);
    }
  }
  
  // Test optional environment variables
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`ℹ️  ${envVar}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
    } else {
      console.log(`ℹ️  ${envVar}: Not set (optional)`);
    }
  }
  
  const allRequiredEnvVarsSet = envTestsPassed === requiredEnvVars.length;
  console.log(`${allRequiredEnvVarsSet ? '✅' : '❌'} Environment variables: ${envTestsPassed}/${requiredEnvVars.length} required vars set`);
  
  return allRequiredEnvVarsSet;
}

/**
 * Test platform-specific features
 */
function testPlatformSpecificFeatures() {
  console.log('\n🖥️  Testing platform-specific features...');
  
  const platform = os.platform();
  const platformConfig = BUILD_CONFIG.platformConfig[platform] || BUILD_CONFIG.platformConfig.linux;
  
  console.log(`Platform: ${platform}`);
  console.log(`Shell: ${platformConfig.shell}`);
  console.log(`Path separator: ${platformConfig.pathSeparator}`);
  console.log(`Executable suffix: ${platformConfig.executable || '(none)'}`);
  
  // Test platform-specific path separator
  const testPath = ['src', 'extension.ts'].join(platformConfig.pathSeparator);
  const normalizedPath = path.normalize(testPath);
  
  console.log(`Test path: ${testPath}`);
  console.log(`Normalized: ${normalizedPath}`);
  
  // Test shell command execution
  try {
    const shellCommand = platform === 'win32' ? 'echo %OS%' : 'echo $SHELL';
    const output = execSync(shellCommand, { encoding: 'utf8', shell: platformConfig.shell });
    console.log(`✅ Shell command executed: ${output.trim()}`);
    return true;
  } catch (error) {
    console.log(`❌ Shell command failed: ${error.message}`);
    return false;
  }
}

/**
 * Generate platform validation report
 */
function generatePlatformReport(results, systemInfo) {
  console.log('\n📊 Platform Validation Report');
  console.log('='.repeat(50));
  
  console.log('\n🖥️  System Information:');
  console.log(`Platform: ${systemInfo.platform}`);
  console.log(`Architecture: ${systemInfo.arch}`);
  console.log(`OS Release: ${systemInfo.release}`);
  console.log(`Node.js: ${systemInfo.nodeVersion}`);
  console.log(`npm: ${systemInfo.npmVersion}`);
  
  console.log('\n🧪 Test Results:');
  const tests = [
    { name: 'File System Operations', key: 'fileSystem' },
    { name: 'Path Operations', key: 'pathOperations' },
    { name: 'Command Execution', key: 'commandExecution' },
    { name: 'Environment Variables', key: 'environmentVariables' },
    { name: 'Platform-Specific Features', key: 'platformSpecific' }
  ];
  
  tests.forEach(test => {
    const status = results[test.key] ? '✅' : '❌';
    console.log(`${status} ${test.name}: ${results[test.key] ? 'PASS' : 'FAIL'}`);
  });
  
  const totalTests = tests.length;
  const passedTests = tests.filter(test => results[test.key]).length;
  
  console.log(`\n📈 Overall Score: ${passedTests}/${totalTests} tests passed`);
  
  return passedTests === totalTests;
}

/**
 * Main validation function
 */
async function main() {
  console.log('🚀 Starting platform validation for Azure Pipelines Assistant');
  
  // Get system information
  const systemInfo = getSystemInfo();
  console.log(`\n🖥️  Running on: ${systemInfo.platform} ${systemInfo.arch}`);
  
  // Validate platform compatibility
  const platformInfo = validatePlatformCompatibility();
  console.log(`Platform supported: ${platformInfo.isSupported ? 'Yes' : 'No (using fallback)'}`);
  
  // Run validation tests
  const results = {
    fileSystem: testFileSystemOperations(),
    pathOperations: testPathOperations(),
    commandExecution: testCommandExecution(),
    environmentVariables: testEnvironmentVariables(),
    platformSpecific: testPlatformSpecificFeatures()
  };
  
  // Generate report
  const allTestsPassed = generatePlatformReport(results, systemInfo);
  
  if (allTestsPassed) {
    console.log('\n🎉 All platform validation tests passed!');
    console.log('The extension is compatible with this platform.');
  } else {
    console.log('\n⚠️  Some platform validation tests failed.');
    console.log('The extension may not work correctly on this platform.');
  }
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('❌ Platform validation failed:', error);
  process.exit(1);
});