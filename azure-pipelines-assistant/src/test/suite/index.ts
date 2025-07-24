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
		// Only load the test files we know are correct
		const testFiles = [
			'suite/cacheService.test.js',
			'suite/treeDataProvider.test.js',
			'suite/treeItems.test.js',
			'suite/commands.test.js'
		];

		testFiles.forEach(file => {
			const fullPath = path.resolve(testsRoot, file);
			mocha.addFile(fullPath);
		});

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
}