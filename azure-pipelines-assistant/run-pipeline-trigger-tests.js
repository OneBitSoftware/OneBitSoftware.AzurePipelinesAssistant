const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname);
        const extensionTestsPath = path.resolve(__dirname, './out/test/pipelineTriggerIndex.js');

        console.log('Running Pipeline Trigger Integration Tests...');
        
        // Run pipeline trigger tests specifically
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions',
                '--disable-workspace-trust'
            ]
        });
        
        console.log('Pipeline Trigger tests completed successfully');
    } catch (err) {
        console.error('Failed to run pipeline trigger tests:', err);
        process.exit(1);
    }
}

main();