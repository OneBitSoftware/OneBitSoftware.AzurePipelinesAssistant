#!/usr/bin/env node

/**
 * Release configuration script for Azure Pipelines Assistant
 * Handles different release scenarios and marketplace configurations
 */

const fs = require('fs');
const path = require('path');

/**
 * Release configuration
 */
const RELEASE_CONFIG = {
  // Marketplace configurations
  marketplaces: {
    vscode: {
      name: 'VS Code Marketplace',
      url: 'https://marketplace.visualstudio.com',
      packageTool: '@vscode/vsce',
      publishCommand: 'vsce publish',
      packageCommand: 'vsce package',
      requiredFields: ['name', 'version', 'publisher', 'engines', 'main', 'contributes'],
      maxSize: '50MB',
      supportedPlatforms: ['win32', 'darwin', 'linux']
    },
    ovsx: {
      name: 'Open VSX Registry',
      url: 'https://open-vsx.org',
      packageTool: 'ovsx',
      publishCommand: 'ovsx publish',
      packageCommand: 'ovsx package',
      requiredFields: ['name', 'version', 'publisher', 'engines', 'main', 'contributes', 'license', 'repository'],
      maxSize: '100MB',
      supportedPlatforms: ['win32', 'darwin', 'linux'],
      compatibleIDEs: ['vscode', 'cursor', 'windsurf', 'theia', 'gitpod']
    }
  },

  // Release types
  releaseTypes: {
    patch: {
      description: 'Bug fixes and minor improvements',
      versionBump: 'patch',
      requiresApproval: false,
      runTests: true,
      createTag: true,
      publishToMarketplaces: true
    },
    minor: {
      description: 'New features and enhancements',
      versionBump: 'minor',
      requiresApproval: false,
      runTests: true,
      createTag: true,
      publishToMarketplaces: true
    },
    major: {
      description: 'Breaking changes and major updates',
      versionBump: 'major',
      requiresApproval: true,
      runTests: true,
      createTag: true,
      publishToMarketplaces: true
    },
    prerelease: {
      description: 'Pre-release versions for testing',
      versionBump: 'prerelease',
      requiresApproval: false,
      runTests: true,
      createTag: true,
      publishToMarketplaces: false
    },
    hotfix: {
      description: 'Critical bug fixes',
      versionBump: 'patch',
      requiresApproval: false,
      runTests: true,
      createTag: true,
      publishToMarketplaces: true,
      skipCI: false
    }
  },

  // Build configurations
  buildConfigs: {
    development: {
      minify: false,
      sourcemap: true,
      dropConsole: false,
      bundleAnalysis: false,
      target: 'development'
    },
    staging: {
      minify: true,
      sourcemap: true,
      dropConsole: false,
      bundleAnalysis: true,
      target: 'staging'
    },
    production: {
      minify: true,
      sourcemap: false,
      dropConsole: true,
      bundleAnalysis: true,
      target: 'production'
    }
  },

  // Quality gates
  qualityGates: {
    codeQuality: {
      eslintMaxWarnings: 0,
      eslintMaxErrors: 0,
      typescriptStrict: true,
      circularDependencies: false
    },
    testing: {
      unitTestCoverage: 80,
      integrationTestCoverage: 70,
      e2eTestCoverage: 60,
      performanceThreshold: 1000 // ms
    },
    security: {
      vulnerabilityAudit: true,
      dependencyCheck: true,
      secretScan: true
    },
    compatibility: {
      vscodeMinVersion: '1.74.0',
      nodeMinVersion: '18.0.0',
      crossPlatform: ['win32', 'darwin', 'linux'],
      crossIDE: ['vscode', 'cursor', 'windsurf']
    }
  }
};

/**
 * Get release configuration for a specific type
 */
function getReleaseConfig(releaseType) {
  const config = RELEASE_CONFIG.releaseTypes[releaseType];
  if (!config) {
    throw new Error(`Unknown release type: ${releaseType}`);
  }
  return config;
}

/**
 * Get marketplace configuration
 */
function getMarketplaceConfig(marketplace) {
  const config = RELEASE_CONFIG.marketplaces[marketplace];
  if (!config) {
    throw new Error(`Unknown marketplace: ${marketplace}`);
  }
  return config;
}

/**
 * Get build configuration
 */
function getBuildConfig(environment) {
  const config = RELEASE_CONFIG.buildConfigs[environment];
  if (!config) {
    throw new Error(`Unknown build environment: ${environment}`);
  }
  return config;
}

/**
 * Validate package.json for marketplace requirements
 */
function validatePackageJson(marketplace) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const marketplaceConfig = getMarketplaceConfig(marketplace);
  const missingFields = [];
  
  for (const field of marketplaceConfig.requiredFields) {
    if (!packageJson[field]) {
      missingFields.push(field);
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields,
    packageJson
  };
}

/**
 * Generate release checklist
 */
function generateReleaseChecklist(releaseType, marketplaces = ['vscode', 'ovsx']) {
  const releaseConfig = getReleaseConfig(releaseType);
  
  const checklist = [
    '# Release Checklist',
    '',
    `## Release Type: ${releaseType}`,
    `**Description:** ${releaseConfig.description}`,
    '',
    '## Pre-Release Checks',
    '- [ ] All tests passing',
    '- [ ] Code quality checks passed',
    '- [ ] Security audit completed',
    '- [ ] Cross-platform compatibility verified',
    '- [ ] Cross-IDE compatibility verified',
    '- [ ] Documentation updated',
    '- [ ] Changelog updated',
    '',
    '## Build and Package',
    '- [ ] Clean build completed',
    '- [ ] Bundle analysis reviewed',
    '- [ ] Package size within limits',
    '- [ ] All required files included',
    '- [ ] No sensitive data in package',
    '',
    '## Testing',
    '- [ ] Unit tests passed',
    '- [ ] Integration tests passed',
    '- [ ] End-to-end tests passed',
    '- [ ] Performance tests passed',
    '- [ ] Manual testing completed',
    '',
    '## Version Management',
    `- [ ] Version bumped (${releaseConfig.versionBump})`,
    '- [ ] Git tag created',
    '- [ ] Release notes generated',
    '',
    '## Marketplace Publishing'
  ];
  
  marketplaces.forEach(marketplace => {
    const config = getMarketplaceConfig(marketplace);
    checklist.push(`- [ ] Published to ${config.name}`);
    checklist.push(`- [ ] ${config.name} listing verified`);
  });
  
  checklist.push(
    '',
    '## Post-Release',
    '- [ ] Release announcement prepared',
    '- [ ] Documentation updated',
    '- [ ] Social media posts scheduled',
    '- [ ] Monitoring alerts configured',
    '- [ ] Next release planning started',
    '',
    '## Rollback Plan',
    '- [ ] Rollback procedure documented',
    '- [ ] Previous version backup available',
    '- [ ] Emergency contact list updated'
  );
  
  return checklist.join('\n');
}

/**
 * Validate release readiness
 */
function validateReleaseReadiness(releaseType, marketplaces = ['vscode', 'ovsx']) {
  console.log(`🔍 Validating release readiness for ${releaseType}...`);
  
  const results = {
    overall: true,
    checks: {}
  };
  
  // Validate package.json for each marketplace
  marketplaces.forEach(marketplace => {
    const validation = validatePackageJson(marketplace);
    results.checks[`packageJson_${marketplace}`] = {
      name: `Package.json validation for ${marketplace}`,
      passed: validation.valid,
      details: validation.missingFields.length > 0 
        ? `Missing fields: ${validation.missingFields.join(', ')}`
        : 'All required fields present'
    };
    
    if (!validation.valid) {
      results.overall = false;
    }
  });
  
  // Check if required files exist
  const requiredFiles = [
    'dist/extension.js',
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);
    
    results.checks[`file_${file.replace(/[/.]/g, '_')}`] = {
      name: `Required file: ${file}`,
      passed: exists,
      details: exists ? 'File exists' : 'File missing'
    };
    
    if (!exists) {
      results.overall = false;
    }
  });
  
  // Check build output
  const distPath = path.join(__dirname, '..', 'dist', 'extension.js');
  if (fs.existsSync(distPath)) {
    const stats = fs.statSync(distPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    results.checks.bundleSize = {
      name: 'Bundle size check',
      passed: stats.size > 0,
      details: `Bundle size: ${sizeKB} KB`
    };
  } else {
    results.checks.bundleSize = {
      name: 'Bundle size check',
      passed: false,
      details: 'Bundle not found - run build first'
    };
    results.overall = false;
  }
  
  return results;
}

/**
 * Generate release report
 */
function generateReleaseReport(releaseType, version, marketplaces, validationResults) {
  const report = [
    '# Release Report',
    '',
    `**Version:** ${version}`,
    `**Release Type:** ${releaseType}`,
    `**Date:** ${new Date().toISOString().split('T')[0]}`,
    `**Marketplaces:** ${marketplaces.join(', ')}`,
    '',
    '## Validation Results',
    ''
  ];
  
  Object.entries(validationResults.checks).forEach(([key, check]) => {
    const status = check.passed ? '✅' : '❌';
    report.push(`${status} **${check.name}:** ${check.details}`);
  });
  
  report.push(
    '',
    `## Overall Status: ${validationResults.overall ? '✅ READY' : '❌ NOT READY'}`,
    ''
  );
  
  if (!validationResults.overall) {
    report.push(
      '## Action Required',
      'Please fix the failing checks before proceeding with the release.',
      ''
    );
  }
  
  // Add marketplace information
  report.push('## Marketplace Information');
  marketplaces.forEach(marketplace => {
    const config = getMarketplaceConfig(marketplace);
    report.push(`### ${config.name}`);
    report.push(`- URL: ${config.url}`);
    report.push(`- Compatible IDEs: ${config.compatibleIDEs ? config.compatibleIDEs.join(', ') : 'VS Code'}`);
    report.push(`- Max Size: ${config.maxSize}`);
    report.push('');
  });
  
  return report.join('\n');
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  const options = {
    action: 'validate',
    releaseType: 'patch',
    marketplaces: ['vscode', 'ovsx'],
    version: null,
    output: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case 'validate':
      case 'checklist':
      case 'report':
        options.action = arg;
        break;
      case '--release-type':
        options.releaseType = args[++i];
        break;
      case '--marketplaces':
        options.marketplaces = args[++i].split(',');
        break;
      case '--version':
        options.version = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🚀 Azure Pipelines Assistant Release Configuration

Usage: node scripts/release-config.js [action] [options]

Actions:
  validate              Validate release readiness (default)
  checklist             Generate release checklist
  report                Generate release report

Options:
  --release-type <type> Release type (patch, minor, major, prerelease, hotfix)
  --marketplaces <list> Comma-separated list of marketplaces (vscode,ovsx)
  --version <version>   Specific version for report
  --output <file>       Output file for checklist/report

Examples:
  node scripts/release-config.js validate --release-type minor
  node scripts/release-config.js checklist --release-type major --output release-checklist.md
  node scripts/release-config.js report --version 1.2.3 --marketplaces vscode,ovsx
`);
}

/**
 * Main function
 */
async function main() {
  const options = parseArguments();
  
  console.log('🚀 Azure Pipelines Assistant Release Configuration');
  console.log(`Action: ${options.action}`);
  console.log(`Release Type: ${options.releaseType}`);
  console.log(`Marketplaces: ${options.marketplaces.join(', ')}`);
  
  try {
    switch (options.action) {
      case 'validate':
        const validationResults = validateReleaseReadiness(options.releaseType, options.marketplaces);
        
        console.log('\n📊 Validation Results:');
        Object.entries(validationResults.checks).forEach(([key, check]) => {
          const status = check.passed ? '✅' : '❌';
          console.log(`${status} ${check.name}: ${check.details}`);
        });
        
        console.log(`\n🎯 Overall Status: ${validationResults.overall ? '✅ READY FOR RELEASE' : '❌ NOT READY'}`);
        
        if (!validationResults.overall) {
          console.log('\n⚠️  Please fix the failing checks before proceeding with the release.');
          process.exit(1);
        }
        break;
        
      case 'checklist':
        const checklist = generateReleaseChecklist(options.releaseType, options.marketplaces);
        
        if (options.output) {
          fs.writeFileSync(options.output, checklist);
          console.log(`✅ Release checklist written to: ${options.output}`);
        } else {
          console.log('\n📋 Release Checklist:');
          console.log(checklist);
        }
        break;
        
      case 'report':
        const version = options.version || require('../package.json').version;
        const validation = validateReleaseReadiness(options.releaseType, options.marketplaces);
        const report = generateReleaseReport(options.releaseType, version, options.marketplaces, validation);
        
        if (options.output) {
          fs.writeFileSync(options.output, report);
          console.log(`✅ Release report written to: ${options.output}`);
        } else {
          console.log('\n📊 Release Report:');
          console.log(report);
        }
        break;
        
      default:
        console.error(`❌ Unknown action: ${options.action}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Release configuration failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = {
  RELEASE_CONFIG,
  getReleaseConfig,
  getMarketplaceConfig,
  getBuildConfig,
  validatePackageJson,
  validateReleaseReadiness,
  generateReleaseChecklist,
  generateReleaseReport
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Release configuration script failed:', error);
    process.exit(1);
  });
}