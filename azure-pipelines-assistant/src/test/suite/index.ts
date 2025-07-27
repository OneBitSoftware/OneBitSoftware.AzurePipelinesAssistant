import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd', // Use TDD interface for suite/test syntax
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((c, e) => {
		// Use glob to find test files, but filter to only include the ones we want
		const testFiles = new glob.Glob('**/**.test.js', { cwd: testsRoot });
		const testFileStream = testFiles.stream();

		const allowedFiles = [
			'cacheService.test.js',
			'treeDataProvider.test.js', 
			'treeItems.test.js',
			'commands.test.js',
			'runDetailsWebview.test.js',
			'runComparisonSimple.test.js',
			'runComparisonWebview.test.js'
		];

		testFileStream.on('data', (file) => {
			const fileName = path.basename(file);
			// Only add files that are in our allowed list
			if (allowedFiles.includes(fileName)) {
				mocha.addFile(path.resolve(testsRoot, file));
			}
		});
		testFileStream.on('error', (err) => {
			e(err);
		});
		testFileStream.on('end', () => {
			try {
				// Run the mocha test
				mocha.run((failures: number) => {
					if (failures > 0) {
						e(new Error(`${failures} tests failed.`));
					} else {
						c();
					}
				});
			} catch (err) {
				console.error(err);
				e(err);
			}
		});
	});
}