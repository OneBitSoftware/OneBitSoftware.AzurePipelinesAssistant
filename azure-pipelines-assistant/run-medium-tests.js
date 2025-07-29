const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
  console.log('Starting medium test runner (more comprehensive tests)...');

  try {
    const extensionDevelopmentPath = path.resolve(__dirname);
    const extensionTestsPath = path.resolve(__dirname, './out/test/medium-suite');

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
        'TEST_TIMEOUT': '8000'
      }
    });

    console.log('Medium tests completed successfully');

  } catch (err) {
    console.error('Medium test execution failed:', err);
    process.exit(1);
  }
}

main();