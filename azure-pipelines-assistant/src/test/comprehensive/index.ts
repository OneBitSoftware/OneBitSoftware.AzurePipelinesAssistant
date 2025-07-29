/**
 * Comprehensive Test Suite Index
 * Orchestrates all test types: unit, integration, e2e, and performance tests
 */

import { glob } from 'glob';
import Mocha from 'mocha';
import * as path from 'path';
import { DEFAULT_TEST_CONFIG, PerformanceMonitor, TestConfig, TestEnvironment, TestReporter } from '../testConfig.js';

export class ComprehensiveTestRunner {
  private testEnvironment: TestEnvironment;
  private reporter: TestReporter;
  private performanceMonitor: PerformanceMonitor;
  private config: TestConfig;

  constructor(config: Partial<TestConfig> = {}) {
    this.config = { ...DEFAULT_TEST_CONFIG, ...config };
    this.testEnvironment = TestEnvironment.getInstance();
    this.reporter = new TestReporter();
    this.performanceMonitor = new PerformanceMonitor();
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite');
    console.log('=====================================');

    const overallStart = Date.now();
    let totalFailures = 0;

    try {
      // Run unit tests
      if (this.shouldRunTestType('unit')) {
        const unitFailures = await this.runUnitTests();
        totalFailures += unitFailures;
      }

      // Run integration tests
      if (this.shouldRunTestType('integration') && this.config.integration) {
        const integrationFailures = await this.runIntegrationTests();
        totalFailures += integrationFailures;
      }

      // Run end-to-end tests
      if (this.shouldRunTestType('e2e') && this.config.e2e) {
        const e2eFailures = await this.runE2ETests();
        totalFailures += e2eFailures;
      }

      // Run performance tests
      if (this.shouldRunTestType('performance') && this.config.performance) {
        const performanceFailures = await this.runPerformanceTests();
        totalFailures += performanceFailures;
      }

      // Generate final report
      await this.generateFinalReport(Date.now() - overallStart, totalFailures);

    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      throw error;
    } finally {
      this.cleanup();
    }

    if (totalFailures > 0) {
      throw new Error(`${totalFailures} test(s) failed`);
    }
  }

  private async runUnitTests(): Promise<number> {
    this.reporter.startSuite('Unit Tests');

    const mocha = this.createMochaInstance('Unit Tests');
    const testFiles = await this.findTestFiles([
      'src/test/unit/**/*.test.js',
      'src/test/suite/**/*.test.js'
    ]);

    testFiles.forEach(file => mocha.addFile(file));

    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          this.reporter.endSuite('Unit Tests');
          resolve(failures);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async runIntegrationTests(): Promise<number> {
    this.reporter.startSuite('Integration Tests');

    const mocha = this.createMochaInstance('Integration Tests');
    const testFiles = await this.findTestFiles([
      'src/test/integration/**/*.test.js'
    ]);

    testFiles.forEach(file => mocha.addFile(file));

    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          this.reporter.endSuite('Integration Tests');
          resolve(failures);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async runE2ETests(): Promise<number> {
    this.reporter.startSuite('End-to-End Tests');

    const mocha = this.createMochaInstance('E2E Tests');
    const testFiles = await this.findTestFiles([
      'src/test/e2e/**/*.test.js'
    ]);

    testFiles.forEach(file => mocha.addFile(file));

    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          this.reporter.endSuite('End-to-End Tests');
          resolve(failures);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async runPerformanceTests(): Promise<number> {
    this.reporter.startSuite('Performance Tests');

    const mocha = this.createMochaInstance('Performance Tests');
    mocha.timeout(30000); // Longer timeout for performance tests

    const testFiles = await this.findTestFiles([
      'src/test/performance/**/*.test.js'
    ]);

    testFiles.forEach(file => mocha.addFile(file));

    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          this.reporter.endSuite('Performance Tests');
          this.generatePerformanceReport();
          resolve(failures);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private createMochaInstance(suiteName: string): Mocha {
    const mocha = new Mocha({
      ui: 'tdd',
      color: true,
      timeout: this.config.timeout,
      retries: this.config.retries,
      reporter: 'spec'
    });

    // Add custom hooks
    mocha.suite.beforeEach(() => {
      this.testEnvironment.reset();
    });

    mocha.suite.afterEach(() => {
      // Cleanup after each test
    });

    return mocha;
  }

  private async findTestFiles(patterns: string[]): Promise<string[]> {
    const testsRoot = path.resolve(__dirname, '../..');
    const files: string[] = [];

    for (const pattern of patterns) {
      try {
        const globPattern = new glob.Glob(pattern, { cwd: testsRoot });
        const matchedFiles = [];
        for await (const file of globPattern) { matchedFiles.push(file); } // Array.fromAsync ES2023+

        matchedFiles.forEach((file: string) => {
          const fullPath = path.resolve(testsRoot, file);
          if (!files.includes(fullPath)) {
            files.push(fullPath);
          }
        });
      } catch (error) {
        console.warn(`Warning: Could not find test files for pattern ${pattern}:`, error);
      }
    }

    console.log(`Found ${files.length} test files`);
    return files;
  }

  private shouldRunTestType(testType: string): boolean {
    const envVar = process.env[`RUN_${testType.toUpperCase()}_TESTS`];
    if (envVar !== undefined) {
      return envVar.toLowerCase() === 'true';
    }
    return true; // Default to running all test types
  }

  private generatePerformanceReport(): void {
    const metrics = this.performanceMonitor.getAverageMetrics();

    console.log('\n📈 Performance Report');
    console.log('====================');

    Object.entries(metrics).forEach(([name, data]) => {
      console.log(`${name}:`);
      console.log(`  Average Duration: ${data.avgDuration.toFixed(2)}ms`);
      console.log(`  Average Memory Delta: ${(data.avgMemoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Sample Count: ${data.count}`);
      console.log('');
    });
  }

  private async generateFinalReport(totalDuration: number, totalFailures: number): Promise<void> {
    console.log('\n🏁 Final Test Report');
    console.log('===================');
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Total Failures: ${totalFailures}`);

    const results = this.reporter.getResults();
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    console.log(`Tests Passed: ${passed}`);
    console.log(`Tests Failed: ${failed}`);
    console.log(`Tests Skipped: ${skipped}`);
    console.log(`Total Tests: ${results.length}`);

    if (this.config.coverage) {
      await this.generateCoverageReport();
    }
  }

  private async generateCoverageReport(): Promise<void> {
    console.log('\n📊 Coverage Report');
    console.log('==================');
    console.log('Coverage report would be generated here by c8 or nyc');
    console.log('See package.json scripts for coverage configuration');
  }

  private cleanup(): void {
    this.testEnvironment.cleanup();
    this.reporter.clear();
    this.performanceMonitor.clear();
  }
}

// Export function for VS Code test runner
export function run(): Promise<void> {
  const config: Partial<TestConfig> = {
    timeout: parseInt(process.env.TEST_TIMEOUT || '10000'),
    retries: parseInt(process.env.TEST_RETRIES || '2'),
    parallel: process.env.TEST_PARALLEL !== 'false',
    coverage: process.env.TEST_COVERAGE !== 'false',
    performance: process.env.TEST_PERFORMANCE === 'true',
    integration: process.env.TEST_INTEGRATION !== 'false',
    e2e: process.env.TEST_E2E !== 'false'
  };

  const runner = new ComprehensiveTestRunner(config);
  return runner.runAllTests();
}

// CLI runner for standalone execution
if (require.main === module) {
  run().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}