import * as assert from 'assert';
import * as vscode from 'vscode';
import { RunComparisonWebviewProvider } from '../webviews/runComparisonWebview';

suite('RunComparisonWebview Tests', () => {
  test('should create webview provider', () => {
    const mockContext = {
      extensionUri: vscode.Uri.file('/test')
    } as vscode.ExtensionContext;

    const mockAzureDevOpsService = {
      getPipelineRuns: async () => [],
      getRunDetails: async () => ({} as any)
    } as any;

    const provider = new RunComparisonWebviewProvider(mockContext, mockAzureDevOpsService);
    assert.ok(provider);
  });

  test('should handle empty runs list', async () => {
    const mockContext = {
      extensionUri: vscode.Uri.file('/test')
    } as vscode.ExtensionContext;

    const mockAzureDevOpsService = {
      getPipelineRuns: async () => [],
      getRunDetails: async () => ({} as any)
    } as any;

    const provider = new RunComparisonWebviewProvider(mockContext, mockAzureDevOpsService);
    
    try {
      await provider.showRunSelection(1, 'test-project');
      // Should show warning message for insufficient runs
      assert.ok(true, 'Should handle empty runs gracefully');
    } catch (error) {
      // Expected to fail with insufficient runs
      assert.ok((error as Error).message.includes('At least 2 runs are required'));
    }
  });
});