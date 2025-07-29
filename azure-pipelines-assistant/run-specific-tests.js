const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname);
    const extensionTestsPath = path.resolve(__dirname, './out/test/suite/index');

    // Run only our specific tests with optimized settings
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      // Add timeout and resource limits
      version: 'stable',
      extensionTestsEnv: {
        'NODE_OPTIONS': '--max-old-space-size=4096',
        'RUN_COMPREHENSIVE_TESTS': 'false',
        'TEST_TIMEOUT': '5000'
      }
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();