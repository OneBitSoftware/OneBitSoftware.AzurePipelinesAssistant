#!/usr/bin/env node

/**
 * Cross-platform packaging script for Azure Pipelines Assistant
 * Packages the extension for multiple IDEs and platforms
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { BUILD_CONFIG, validatePlatformCompatibility, getPackageOutputPath } = require('../build-config');

// Ensure packages directory exists
const packagesDir = path.join(__dirname, '..', BUILD_CONFIG.outputDirs.packages);
if (!fs.existsSync(packagesDir)) {
  fs.mkdirSync(packagesDir, { recursive: true });
}

/**
 * Execute command with error handling
 */
function executeCommand(command, description) {
  console.log(`\n📦 ${description}...`);
  console.log(`Command: ${command}`);
  
  try {
    const output = execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

/**
 * Package for VS Code Marketplace
 */
function packageForVSCode() {
  const success = executeCommand(
    'npx @vscode/vsce package --out packages/',
    'Packaging for VS Code Marketplace'
  );
  
  if (success) {
    console.log('📦 VS Code package created in packages/ directory');
  }
  
  return success;
}

/**
 * Package for Open VSX Registry
 */
function packageForOpenVSX() {
  const success = executeCommand(
    'npx ovsx package -o packages/',
    'Packaging for Open VSX Registry'
  );
  
  if (success) {
    console.log('📦 Open VSX package created in packages/ directory');
  }
  
  return success;
}

/**
 * Validate package integrity
 */
function validatePackage(packagePath) {
  if (!fs.existsSync(packagePath)) {
    console.error(`❌ Package not found: ${packagePath}`);
    return false;
  }
  
  const stats = fs.statSync(packagePath);
  if (stats.size === 0) {
    console.error(`❌ Package is empty: ${packagePath}`);
    return false;
  }
  
  console.log(`✅ Package validated: ${packagePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  return true;
}

/**
 * Main packaging function
 */
async function main() {
  console.log('🚀 Starting cross-platform packaging for Azure Pipelines Assistant');
  
  // Validate platform compatibility
  const platformInfo = validatePlatformCompatibility();
  console.log(`\n🖥️  Platform: ${platformInfo.platform} (${platformInfo.isSupported ? 'supported' : 'fallback'})`);
  
  // Clean previous packages
  if (fs.existsSync(packagesDir)) {
    console.log('\n🧹 Cleaning previous packages...');
    fs.readdirSync(packagesDir).forEach(file => {
      if (file.endsWith('.vsix')) {
        fs.unlinkSync(path.join(packagesDir, file));
        console.log(`   Removed: ${file}`);
      }
    });
  }
  
  // Build the extension first
  console.log('\n🔨 Building extension...');
  const buildSuccess = executeCommand('node scripts/build.js --production --no-type-check --no-lint', 'Building extension');
  
  if (!buildSuccess) {
    console.error('❌ Build failed. Cannot proceed with packaging.');
    process.exit(1);
  }
  
  let packagingResults = [];
  
  // Package for VS Code Marketplace
  console.log('\n📦 Packaging for VS Code Marketplace...');
  const vsCodeSuccess = packageForVSCode();
  packagingResults.push({ target: 'VS Code Marketplace', success: vsCodeSuccess });
  
  // Package for Open VSX Registry (compatible with Cursor and Windsurf)
  console.log('\n📦 Packaging for Open VSX Registry...');
  const openVSXSuccess = packageForOpenVSX();
  packagingResults.push({ target: 'Open VSX Registry', success: openVSXSuccess });
  
  // Validate created packages
  console.log('\n🔍 Validating packages...');
  const packageFiles = fs.readdirSync(packagesDir).filter(file => file.endsWith('.vsix'));
  
  let validationResults = [];
  for (const packageFile of packageFiles) {
    const packagePath = path.join(packagesDir, packageFile);
    const isValid = validatePackage(packagePath);
    validationResults.push({ file: packageFile, valid: isValid });
  }
  
  // Summary
  console.log('\n📊 Packaging Summary:');
  console.log('='.repeat(50));
  
  packagingResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.target}: ${result.success ? 'Success' : 'Failed'}`);
  });
  
  console.log('\n📦 Package Validation:');
  validationResults.forEach(result => {
    const status = result.valid ? '✅' : '❌';
    console.log(`${status} ${result.file}: ${result.valid ? 'Valid' : 'Invalid'}`);
  });
  
  // IDE Compatibility Information
  console.log('\n🖥️  IDE Compatibility:');
  console.log('VS Code: Use VS Code Marketplace package (.vsix)');
  console.log('Cursor: Use Open VSX Registry package (.vsix)');
  console.log('Windsurf: Use Open VSX Registry package (.vsix)');
  
  console.log('\n📁 Packages created in:', packagesDir);
  
  // Exit with appropriate code
  const allSuccessful = packagingResults.every(r => r.success) && validationResults.every(r => r.valid);
  process.exit(allSuccessful ? 0 : 1);
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('❌ Packaging failed:', error);
  process.exit(1);
});