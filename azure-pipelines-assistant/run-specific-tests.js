const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname);
        const extensionTestsPath = path.resolve(__dirname, './out/test/suite/index');

        // Run only our specific tests
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs: ['--disable-extensions']
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();