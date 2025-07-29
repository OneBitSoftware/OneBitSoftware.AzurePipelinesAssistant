import { glob } from 'glob';
import Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
  console.log('Running unit test suite...');

  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
    retries: 1,
    bail: false
  });

  return new Promise((resolve, reject) => {
    try {
      const testsRoot = path.resolve(__dirname, '../..');

      // Find all test files in the unit directory
      const unitTestPattern = 'unit/**/*.test.js';
      const files = glob.sync(unitTestPattern, { cwd: testsRoot });

      let addedFiles = 0;
      files.forEach((file) => {
        const fullPath = path.resolve(testsRoot, file);
        console.log(`Adding unit test file: ${path.basename(file)}`);
        mocha.addFile(fullPath);
        addedFiles++;
      });

      console.log(`Total unit test files added: ${addedFiles}`);

      if (addedFiles === 0) {
        console.log('No unit test files found, completing successfully');
        resolve();
        return;
      }

      // Add cleanup hooks
      mocha.suite.beforeEach(() => {
        if (global.gc) {
          global.gc();
        }
      });

      const runner = mocha.run((failures: number) => {
        console.log(`Unit test run completed with ${failures} failures`);
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });

      // Add timeout for the entire test run
      const testTimeout = setTimeout(() => {
        console.error('Unit test run timed out');
        runner.abort();
        reject(new Error('Test run timed out'));
      }, 120000); // 2 minute timeout

      runner.on('end', () => {
        clearTimeout(testTimeout);
      });

    } catch (err) {
      console.error('Error in unit test setup:', err);
      reject(err);
    }
  });
}