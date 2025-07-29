/**
 * Test configuration and utilities for the comprehensive testing suite
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';

export interface TestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  coverage: boolean;
  performance: boolean;
  integration: boolean;
  e2e: boolean;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  timeout: 10000, // 10 seconds
  retries: 2,
  parallel: true,
  coverage: true,
  performance: false, // Disabled by default due to time requirements
  integration: true,
  e2e: true
};

export class TestEnvironment {
  private static instance: TestEnvironment;
  private mockContext!: vscode.ExtensionContext;
  private stubs: sinon.SinonStub[] = [];

  private constructor() {
    this.setupMockContext();
    this.setupGlobalMocks();
  }

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  private setupMockContext(): void {
    this.mockContext = {
      subscriptions: [],
      workspaceState: {
        get: sinon.stub(),
        update: sinon.stub().resolves(),
        keys: sinon.stub().returns([])
      },
      globalState: {
        get: sinon.stub(),
        update: sinon.stub().resolves(),
        keys: sinon.stub().returns([]),
        setKeysForSync: sinon.stub()
      },
      secrets: {
        get: sinon.stub().resolves(undefined),
        store: sinon.stub().resolves(),
        delete: sinon.stub().resolves(),
        onDidChange: sinon.stub()
      },
      extensionUri: vscode.Uri.file('/test/extension'),
      extensionPath: '/test/extension',
      asAbsolutePath: sinon.stub().callsFake((path: string) => `/test/extension/${path}`),
      storageUri: vscode.Uri.file('/test/storage'),
      storagePath: '/test/storage',
      globalStorageUri: vscode.Uri.file('/test/global-storage'),
      globalStoragePath: '/test/global-storage',
      logUri: vscode.Uri.file('/test/logs'),
      logPath: '/test/logs',
      extensionMode: vscode.ExtensionMode.Test,
      extension: {
        id: 'test.azure-pipelines-assistant',
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension',
        isActive: true,
        packageJSON: {},
        exports: undefined,
        activate: sinon.stub(),
        extensionKind: vscode.ExtensionKind.Workspace
      },
      environmentVariableCollection: {
        persistent: true,
        description: 'Test environment variables',
        get: sinon.stub(),
        forEach: sinon.stub(),
        replace: sinon.stub(),
        append: sinon.stub(),
        prepend: sinon.stub(),
        delete: sinon.stub(),
        clear: sinon.stub(),
        [Symbol.iterator]: function* () { yield* []; }
      },
      languageModelAccessInformation: {
        onDidChange: sinon.stub(),
        canSendRequest: sinon.stub().returns(false)
      }
    } as any;
  }

  private setupGlobalMocks(): void {
    // Mock VS Code window APIs
    this.stubs.push(sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'showInputBox').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'showQuickPick').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'showOpenDialog').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'showSaveDialog').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.window, 'withProgress').callsFake(async (options, callback) => {
      const progress = { report: sinon.stub() };
      const token = { isCancellationRequested: false, onCancellationRequested: sinon.stub() };
      return await callback(progress, token);
    }));

    // Mock webview panel creation
    this.stubs.push(sinon.stub(vscode.window, 'createWebviewPanel').callsFake((viewType, title, showOptions, options) => {
      return {
        viewType,
        title,
        webview: {
          html: '',
          options: options || {}, // this was: options: options?.webviewOptions || {},
          asWebviewUri: sinon.stub().callsFake((uri: vscode.Uri) => uri),
          cspSource: 'vscode-webview:',
          postMessage: sinon.stub().resolves(true),
          onDidReceiveMessage: sinon.stub()
        },
        options: options || {},
        viewColumn: typeof showOptions === 'object' && showOptions !== null && 'viewColumn' in showOptions
          ? showOptions.viewColumn
          : showOptions,
        active: true,
        visible: true,
        onDidDispose: sinon.stub(),
        onDidChangeViewState: sinon.stub(),
        reveal: sinon.stub(),
        dispose: sinon.stub()
      };
    }));

    // Mock workspace APIs
    this.stubs.push(sinon.stub(vscode.workspace, 'getConfiguration').callsFake((_section?: string, _scope?: any) => {
      return {
        get: <T>(section: string, defaultValue?: T): T | undefined => defaultValue,
        update: sinon.stub().resolves(),
        inspect: sinon.stub(),
        has: sinon.stub().returns(false)
      };
    }));

    // Mock commands API
    this.stubs.push(sinon.stub(vscode.commands, 'executeCommand').resolves(undefined));
    this.stubs.push(sinon.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
      return { dispose: sinon.stub() };
    }));

    // Mock environment APIs
    this.stubs.push(sinon.stub(vscode.env, 'openExternal').resolves(true));
    this.stubs.push(sinon.stub(vscode.env, 'clipboard').value({
      readText: sinon.stub().resolves(''),
      writeText: sinon.stub().resolves()
    }));
  }

  getMockContext(): vscode.ExtensionContext {
    return this.mockContext;
  }

  cleanup(): void {
    this.stubs.forEach(stub => stub.restore());
    this.stubs = [];
    sinon.restore();
  }

  reset(): void {
    this.stubs.forEach(stub => stub.reset());
    // Reset mock context state
    (this.mockContext.workspaceState.get as sinon.SinonStub).reset();
    (this.mockContext.globalState.get as sinon.SinonStub).reset();
    (this.mockContext.secrets.get as sinon.SinonStub).reset();
  }
}

export class TestReporter {
  private results: TestResult[] = [];
  private startTime: number = 0;

  startSuite(suiteName: string): void {
    this.startTime = Date.now();
    console.log(`\n🧪 Starting test suite: ${suiteName}`);
  }

  endSuite(suiteName: string): void {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    console.log(`\n📊 Test suite completed: ${suiteName}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${this.results.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }
  }

  recordResult(result: TestResult): void {
    this.results.push(result);

    const icon = result.status === 'passed' ? '✅' :
      result.status === 'failed' ? '❌' : '⏭️';

    console.log(`${icon} ${result.name} (${result.duration}ms)`);

    if (result.status === 'failed' && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  getResults(): TestResult[] {
    return [...this.results];
  }

  clear(): void {
    this.results = [];
  }
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  startMeasurement(name: string): PerformanceMeasurement {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    return {
      name,
      startTime,
      startMemory,
      end: () => {
        const endTime = Date.now();
        const endMemory = this.getMemoryUsage();

        const metric: PerformanceMetric = {
          name,
          duration: endTime - startTime,
          memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
          timestamp: new Date()
        };

        this.metrics.push(metric);
        return metric;
      }
    };
  }

  private getMemoryUsage(): NodeJS.MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 };
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getAverageMetrics(): { [key: string]: { avgDuration: number; avgMemoryDelta: number; count: number } } {
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = { totalDuration: 0, totalMemoryDelta: 0, count: 0 };
      }
      acc[metric.name].totalDuration += metric.duration;
      acc[metric.name].totalMemoryDelta += metric.memoryDelta;
      acc[metric.name].count++;
      return acc;
    }, {} as { [key: string]: { totalDuration: number; totalMemoryDelta: number; count: number } });

    return Object.entries(grouped).reduce((acc, [name, data]) => {
      acc[name] = {
        avgDuration: data.totalDuration / data.count,
        avgMemoryDelta: data.totalMemoryDelta / data.count,
        count: data.count
      };
      return acc;
    }, {} as { [key: string]: { avgDuration: number; avgMemoryDelta: number; count: number } });
  }

  clear(): void {
    this.metrics = [];
  }
}

export interface PerformanceMetric {
  name: string;
  duration: number;
  memoryDelta: number;
  timestamp: Date;
}

export interface PerformanceMeasurement {
  name: string;
  startTime: number;
  startMemory: NodeJS.MemoryUsage;
  end(): PerformanceMetric;
}

export class TestDataGenerator {
  static generateTestScenarios(count: number): TestScenario[] {
    const scenarios: TestScenario[] = [];

    for (let i = 0; i < count; i++) {
      scenarios.push({
        id: `scenario-${i}`,
        name: `Test Scenario ${i + 1}`,
        description: `Generated test scenario for comprehensive testing`,
        steps: [
          'Initialize test environment',
          'Execute test operations',
          'Verify results',
          'Cleanup resources'
        ],
        expectedResults: {
          success: true,
          duration: Math.random() * 1000 + 100, // 100-1100ms
          memoryUsage: Math.random() * 50 * 1024 * 1024 // 0-50MB
        }
      });
    }

    return scenarios;
  }

  static generateStressTestData(size: 'small' | 'medium' | 'large' | 'xlarge'): any {
    const sizes = {
      small: { projects: 5, pipelines: 10, runs: 20 },
      medium: { projects: 20, pipelines: 50, runs: 100 },
      large: { projects: 100, pipelines: 500, runs: 1000 },
      xlarge: { projects: 500, pipelines: 2000, runs: 5000 }
    };

    const config = sizes[size];

    return {
      projects: Array.from({ length: config.projects }, (_, i) => ({
        id: `stress-project-${i}`,
        name: `Stress Test Project ${i}`,
        description: `Generated project for stress testing`
      })),
      pipelines: Array.from({ length: config.pipelines }, (_, i) => ({
        id: i + 1,
        name: `Stress Test Pipeline ${i}`,
        projectId: `stress-project-${i % config.projects}`
      })),
      runs: Array.from({ length: config.runs }, (_, i) => ({
        id: i + 1,
        name: `Stress Test Run ${i}`,
        pipelineId: (i % config.pipelines) + 1,
        status: ['completed', 'inProgress', 'failed', 'canceled'][i % 4]
      }))
    };
  }
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: string[];
  expectedResults: {
    success: boolean;
    duration: number;
    memoryUsage: number;
  };
}

export class TestUtilities {
  static async waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (!condition() && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }

  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError!;
  }

  static createMockTimer(): MockTimer {
    let currentTime = 0;
    const timers: Array<{ callback: () => void; time: number; interval?: number }> = [];

    return {
      setTimeout: (callback: () => void, delay: number) => {
        const id = timers.length;
        timers.push({ callback, time: currentTime + delay });
        return id;
      },
      setInterval: (callback: () => void, interval: number) => {
        const id = timers.length;
        timers.push({ callback, time: currentTime + interval, interval });
        return id;
      },
      clearTimeout: (id: number) => {
        if (timers[id]) {
          timers[id] = null as any;
        }
      },
      clearInterval: (id: number) => {
        if (timers[id]) {
          timers[id] = null as any;
        }
      },
      tick: (ms: number) => {
        currentTime += ms;

        timers.forEach((timer, id) => {
          if (!timer) { return; }

          if (timer.time <= currentTime) {
            timer.callback();

            if (timer.interval) {
              timer.time = currentTime + timer.interval;
            } else {
              timers[id] = null as any;
            }
          }
        });
      },
      getCurrentTime: () => currentTime
    };
  }
}

export interface MockTimer {
  setTimeout(callback: () => void, delay: number): number;
  setInterval(callback: () => void, interval: number): number;
  clearTimeout(id: number): void;
  clearInterval(id: number): void;
  tick(ms: number): void;
  getCurrentTime(): number;
}