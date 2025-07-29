#!/usr/bin/env node

/**
 * Comprehensive build script for Azure Pipelines Assistant
 * Handles development, production, and watch builds with optimization
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { BUILD_CONFIG, getBuildTarget, validatePlatformCompatibility } = require('../build-config');

/**
 * Execute command with error handling
 */
function executeCommand(command, description, options = {}) {
  console.log(`\n🔨 ${description}...`);
  console.log(`Command: ${command}`);

  try {
    const output = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      ...options
    });
    console.log(`✅ ${description} completed successfully`);
    return { success: true, output };
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clean build directories
 */
function cleanBuildDirectories() {
  console.log('\n🧹 Cleaning build directories...');

  const dirsToClean = ['dist', 'out'];

  dirsToClean.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`   Cleaned: ${dir}/`);
    }
  });

  // Recreate directories
  dirsToClean.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    fs.mkdirSync(dirPath, { recursive: true });
  });

  console.log('✅ Build directories cleaned');
}

/**
 * Run TypeScript type checking
 */
function runTypeChecking() {
  console.log('\n🔍 Running TypeScript type checking...');

  const result = executeCommand('npx tsc --noEmit', 'TypeScript type checking');
  return result.success;
}

/**
 * Run ESLint
 */
function runLinting() {
  console.log('\n🔍 Running ESLint...');

  const result = executeCommand('npm run lint', 'ESLint');
  return result.success;
}

/**
 * Build extension with esbuild
 */
function buildExtension(target = 'development') {
  console.log(`\n📦 Building extension for ${target}...`);

  const buildConfig = getBuildTarget(target);
  let command = 'node esbuild.js';

  if (target === 'production') {
    command += ' --production';
  } else if (target === 'watch') {
    command += ' --watch';
  }

  const result = executeCommand(command, `Extension build (${target})`);
  return result.success;
}

/**
 * Compile tests
 */
function compileTests() {
  console.log('\n🧪 Compiling tests...');

  const result = executeCommand('npm run compile-tests', 'Test compilation');
  return result.success;
}

/**
 * Run tests
 */
function runTests(testType = 'unit') {
  console.log(`\n🧪 Running ${testType} tests...`);

  let command;
  switch (testType) {
    case 'unit':
      command = 'npm run test:unit';
      break;
    case 'integration':
      command = 'npm run test:integration';
      break;
    case 'e2e':
      command = 'npm run test:e2e';
      break;
    case 'all':
      command = 'npm run test:comprehensive';
      break;
    default:
      command = 'npm test';
  }

  const result = executeCommand(command, `${testType} tests`);
  return result.success;
}

/**
 * Generate build report
 */
function generateBuildReport(results, buildTarget, startTime) {
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n📊 Build Report');
  console.log('='.repeat(50));
  console.log(`Build Target: ${buildTarget}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Node.js: ${process.version}`);

  console.log('\n🧪 Build Steps:');
  const steps = [
    { name: 'Clean', key: 'clean' },
    { name: 'Type Checking', key: 'typeChecking' },
    { name: 'Linting', key: 'linting' },
    { name: 'Extension Build', key: 'extensionBuild' },
    { name: 'Test Compilation', key: 'testCompilation' },
    { name: 'Tests', key: 'tests' }
  ];

  steps.forEach(step => {
    if (results.hasOwnProperty(step.key)) {
      const status = results[step.key] ? '✅' : '❌';
      console.log(`${status} ${step.name}: ${results[step.key] ? 'PASS' : 'FAIL'}`);
    }
  });

  // Show bundle information
  const bundlePath = path.join(__dirname, '..', 'dist', 'extension.js');
  if (fs.existsSync(bundlePath)) {
    const stats = fs.statSync(bundlePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`\n📦 Bundle Information:`);
    console.log(`Size: ${sizeKB} KB`);
    console.log(`Path: ${bundlePath}`);
  }

  const totalSteps = Object.keys(results).length;
  const passedSteps = Object.values(results).filter(Boolean).length;

  console.log(`\n📈 Overall Score: ${passedSteps}/${totalSteps} steps passed`);

  return passedSteps === totalSteps;
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);

  const options = {
    target: 'development',
    clean: true,
    typeCheck: true,
    lint: true,
    tests: false,
    testType: 'unit',
    skipValidation: false
  };

  args.forEach(arg => {
    switch (arg) {
      case '--production':
        options.target = 'production';
        break;
      case '--development':
        options.target = 'development';
        break;
      case '--watch':
        options.target = 'watch';
        break;
      case '--no-clean':
        options.clean = false;
        break;
      case '--no-type-check':
        options.typeCheck = false;
        break;
      case '--no-lint':
        options.lint = false;
        break;
      case '--with-tests':
        options.tests = true;
        break;
      case '--test-unit':
        options.tests = true;
        options.testType = 'unit';
        break;
      case '--test-integration':
        options.tests = true;
        options.testType = 'integration';
        break;
      case '--test-e2e':
        options.tests = true;
        options.testType = 'e2e';
        break;
      case '--test-all':
        options.tests = true;
        options.testType = 'all';
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  });

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🚀 Azure Pipelines Assistant Build Script

Usage: node scripts/build.js [options]

Build Targets:
  --development     Build for development (default)
  --production      Build for production with optimizations
  --watch           Build and watch for changes

Build Options:
  --no-clean        Skip cleaning build directories
  --no-type-check   Skip TypeScript type checking
  --no-lint         Skip ESLint
  --with-tests      Run tests after build
  --test-unit       Run unit tests only
  --test-integration Run integration tests only
  --test-e2e        Run end-to-end tests only
  --test-all        Run all tests
  --skip-validation Skip platform validation

Other:
  --help            Show this help message

Examples:
  node scripts/build.js --production
  node scripts/build.js --development --with-tests
  node scripts/build.js --watch
  node scripts/build.js --production --test-all
`);
}

/**
 * Main build function
 */
async function main() {
  const startTime = Date.now();
  const options = parseArguments();

  console.log('🚀 Starting Azure Pipelines Assistant build process');
  console.log(`Target: ${options.target}`);
  console.log(`Options:`, JSON.stringify(options, null, 2));

  // Validate platform compatibility
  if (!options.skipValidation) {
    const platformInfo = validatePlatformCompatibility();
    console.log(`\n🖥️  Platform: ${platformInfo.platform} (${platformInfo.isSupported ? 'supported' : 'fallback'})`);
  }

  const results = {};

  try {
    // Clean build directories
    if (options.clean) {
      cleanBuildDirectories();
      results.clean = true;
    }

    // Type checking
    if (options.typeCheck) {
      results.typeChecking = runTypeChecking();
      if (!results.typeChecking && options.target === 'production') {
        console.error('❌ Type checking failed. Cannot proceed with production build.');
        process.exit(1);
      }
    }

    // Linting
    if (options.lint) {
      results.linting = runLinting();
      if (!results.linting && options.target === 'production') {
        console.error('❌ Linting failed. Cannot proceed with production build.');
        process.exit(1);
      }
    }

    // Build extension
    results.extensionBuild = buildExtension(options.target);
    if (!results.extensionBuild) {
      console.error('❌ Extension build failed.');
      process.exit(1);
    }

    // For watch mode, keep the process running
    if (options.target === 'watch') {
      console.log('\n👀 Watch mode started. Press Ctrl+C to stop.');

      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping build process...');
        process.exit(0);
      });

      // Don't exit in watch mode
      return;
    }

    // Compile tests
    if (options.tests) {
      results.testCompilation = compileTests();
      if (results.testCompilation) {
        results.tests = runTests(options.testType);
      }
    }

    // Generate build report
    const buildSuccessful = generateBuildReport(results, options.target, startTime);

    if (buildSuccessful) {
      console.log('\n🎉 Build completed successfully!');

      if (options.target === 'production') {
        console.log('\n📦 Production build is ready for packaging.');
        console.log('Run "npm run package:all" to create distribution packages.');
      }
    } else {
      console.log('\n⚠️  Build completed with some failures.');
      console.log('Please review the results and fix any issues.');
    }

    process.exit(buildSuccessful ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Build process failed:', error);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('❌ Build script failed:', error);
  process.exit(1);
});