/**
 * Cross-platform build configuration for Azure Pipelines Assistant
 * Supports VS Code, Cursor, and Windsurf IDEs
 */

const os = require('os');
const path = require('path');

const BUILD_CONFIG = {
  // Target platforms
  platforms: ['win32', 'darwin', 'linux'],
  
  // Target IDEs
  ides: ['vscode', 'cursor', 'windsurf'],
  
  // VS Code API compatibility
  minVSCodeVersion: '1.74.0',
  
  // Build targets
  targets: {
    development: {
      minify: false,
      sourcemap: true,
      watch: false
    },
    production: {
      minify: true,
      sourcemap: false,
      watch: false
    },
    watch: {
      minify: false,
      sourcemap: true,
      watch: true
    }
  },
  
  // Platform-specific configurations
  platformConfig: {
    win32: {
      shell: 'cmd',
      pathSeparator: '\\',
      executable: '.exe'
    },
    darwin: {
      shell: 'bash',
      pathSeparator: '/',
      executable: ''
    },
    linux: {
      shell: 'bash',
      pathSeparator: '/',
      executable: ''
    }
  },
  
  // IDE-specific configurations
  ideConfig: {
    vscode: {
      name: 'Visual Studio Code',
      marketplaces: ['vscode-marketplace', 'open-vsx'],
      apiVersion: '^1.74.0'
    },
    cursor: {
      name: 'Cursor',
      marketplaces: ['open-vsx'],
      apiVersion: '^1.74.0'
    },
    windsurf: {
      name: 'Windsurf',
      marketplaces: ['open-vsx'],
      apiVersion: '^1.74.0'
    }
  },
  
  // Output directories
  outputDirs: {
    dist: 'dist',
    packages: 'packages',
    tests: 'out'
  }
};

/**
 * Get current platform configuration
 */
function getCurrentPlatformConfig() {
  const platform = os.platform();
  return BUILD_CONFIG.platformConfig[platform] || BUILD_CONFIG.platformConfig.linux;
}

/**
 * Get build target configuration
 */
function getBuildTarget(target = 'development') {
  return BUILD_CONFIG.targets[target] || BUILD_CONFIG.targets.development;
}

/**
 * Get IDE configuration
 */
function getIdeConfig(ide = 'vscode') {
  return BUILD_CONFIG.ideConfig[ide] || BUILD_CONFIG.ideConfig.vscode;
}

/**
 * Validate platform compatibility
 */
function validatePlatformCompatibility() {
  const platform = os.platform();
  const isSupported = BUILD_CONFIG.platforms.includes(platform);
  
  if (!isSupported) {
    console.warn(`Platform ${platform} is not officially supported. Falling back to Linux configuration.`);
  }
  
  return {
    platform,
    isSupported,
    config: getCurrentPlatformConfig()
  };
}

/**
 * Get package output path for specific IDE and platform
 */
function getPackageOutputPath(ide, platform, version) {
  const ideConfig = getIdeConfig(ide);
  const platformConfig = BUILD_CONFIG.platformConfig[platform] || BUILD_CONFIG.platformConfig.linux;
  
  return path.join(
    BUILD_CONFIG.outputDirs.packages,
    `azure-pipelines-assistant-${version}-${ide}-${platform}.vsix`
  );
}

module.exports = {
  BUILD_CONFIG,
  getCurrentPlatformConfig,
  getBuildTarget,
  getIdeConfig,
  validatePlatformCompatibility,
  getPackageOutputPath
};