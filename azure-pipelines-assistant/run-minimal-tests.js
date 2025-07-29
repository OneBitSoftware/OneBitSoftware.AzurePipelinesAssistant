const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
  console.log('Starting minimal test runner (basic tests only)...');

  try {
    const extensionDevelopmentPath = path.resolve(__dirname);

    // Create a custom test entry point that only runs basic tests
    const extensionTestsPath = path.resolve(__dirname, './out/test/minimal-suite');

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
        'NODE_OPTIONS': '--max-old-space-size=1024',
        'TEST_TIMEOUT': '3000'
      }
    });

    console.log('Minimal tests completed successfully');

  } catch (err) {
    console.error('Minimal test execution failed:', err);
    process.exit(1);
  }
}

main();