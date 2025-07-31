const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
  console.log('Starting authentication test runner...');

  try {
    const extensionDevelopmentPath = path.resolve(__dirname);
    const extensionTestsPath = path.resolve(__dirname, './out/test/auth-suite');

    const result = await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox'
      ],
      version: 'stable',
      extensionTestsEnv: {
        'NODE_OPTIONS': '--max-old-space-size=2048',
        'TEST_TIMEOUT': '10000'
      }
    });

    console.log('Authentication tests completed successfully');

  } catch (err) {
    console.error('Authentication test execution failed:', err);
    process.exit(1);
  }
}

main();