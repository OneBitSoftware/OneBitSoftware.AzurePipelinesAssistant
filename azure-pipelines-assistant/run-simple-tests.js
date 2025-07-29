const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
  try {
    console.log('Starting simple test runner...');

    const extensionDevelopmentPath = path.resolve(__dirname);
    const extensionTestsPath = path.resolve(__dirname, './out/test/suite/index');

    // Minimal configuration to prevent hanging
    const result = await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ],
      version: 'stable',
      extensionTestsEnv: {
        'NODE_OPTIONS': '--max-old-space-size=2048',
        'RUN_COMPREHENSIVE_TESTS': 'false',
        'TEST_TIMEOUT': '5000',
        'MOCHA_TIMEOUT': '5000'
      }
    });

    console.log('Tests completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

// Add process cleanup
process.on('SIGINT', () => {
  console.log('Received SIGINT, exiting...');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, exiting...');
  process.exit(1);
});

main();