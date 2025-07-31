import { glob } from 'glob';
import Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
  console.log('Running authentication test suite...');

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

      // Only authentication test
      const authTestFiles = [
        'authenticationService.test.js'
      ];

      // Use synchronous glob to find test files
      const files = glob.sync('**/**.test.js', { cwd: testsRoot });

      let addedFiles = 0;
      files.forEach((file) => {
        const fileName = path.basename(file);

        if (authTestFiles.includes(fileName)) {
          const fullPath = path.resolve(testsRoot, file);
          console.log(`Adding auth test file: ${fileName}`);
          mocha.addFile(fullPath);
          addedFiles++;
        }
      });

      console.log(`Total auth test files added: ${addedFiles}`);

      if (addedFiles === 0) {
        console.log('No auth test files found, completing successfully');
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
        console.log(`Auth test run completed with ${failures} failures`);
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });

      // Add timeout for the entire test run
      const testTimeout = setTimeout(() => {
        console.error('Auth test run timed out');
        runner.abort();
        reject(new Error('Test run timed out'));
      }, 120000); // 2 minute timeout

      runner.on('end', () => {
        clearTimeout(testTimeout);
      });

    } catch (err) {
      console.error('Error in auth test setup:', err);
      reject(err);
    }
  });
}