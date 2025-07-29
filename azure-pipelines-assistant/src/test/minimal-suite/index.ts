import Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
  console.log('Running minimal test suite...');

  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 3000,
    retries: 0,
    bail: true // Stop on first failure to prevent hanging
  });

  return new Promise((resolve, reject) => {
    try {
      // Only add the most basic test file that we know works
      const basicTestPath = path.resolve(__dirname, '../suite/treeItems.test.js');

      console.log(`Adding test file: ${basicTestPath}`);
      mocha.addFile(basicTestPath);

      const runner = mocha.run((failures: number) => {
        console.log(`Minimal test run completed with ${failures} failures`);
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });

      // Force timeout after 10 seconds
      setTimeout(() => {
        console.error('Minimal test run timed out');
        runner.abort();
        reject(new Error('Test run timed out'));
      }, 10000);

    } catch (err) {
      console.error('Error in minimal test setup:', err);
      reject(err);
    }
  });
}