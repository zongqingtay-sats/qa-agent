import { testCasesApi, testRunsApi } from "@/lib/api";
import type { FlowData, FlowNode } from "@/types/api";
import { getExtensionId, connectToExtension, executeTestViaExtension } from "@/lib/extension";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Push a single step result to the backend so the test-run detail page
 * can update in real time via SSE.
 */
async function saveStepResult(testRunId: string, stepOrder: number, data: Record<string, unknown>) {
  try {
    await fetch(`${API_BASE}/test-runs/${encodeURIComponent(testRunId)}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepOrder,
        blockId: data.blockId || '',
        blockType: data.blockType || '',
        description: data.description || '',
        target: data.target || '',
        expectedResult: data.expectedResult || '',
        actualResult: data.actualResult || '',
        status: data.status || 'running',
        screenshotDataUrl: data.screenshot || data.screenshotDataUrl || '',
        errorMessage: data.error || data.errorMessage || '',
        durationMs: data.durationMs || 0,
        retry: data.retry || false,
      }),
    });
  } catch {
    // Non-critical — the final save will capture everything
  }
}

/**
 * Run a single test case via the browser extension.
 * Creates a test run, connects to the extension, executes, and saves results.
 * Returns a promise that resolves when the run completes.
 */
export async function runTestCase(testCaseId: string): Promise<void> {
  const extensionId = getExtensionId();
  if (!extensionId) {
    toast.error("No extension ID configured. Go to Settings to set it up.");
    return;
  }

  const tcRes = await testCasesApi.get(testCaseId);
  const testCase = tcRes.data;

  let flowData: FlowData;
  try {
    flowData = typeof testCase.flowData === 'string' ? JSON.parse(testCase.flowData) : testCase.flowData;
  } catch {
    toast.error(`Invalid flow data for "${testCase.name}"`);
    return;
  }

  const runRes = await testRunsApi.create(testCaseId);
  const testRun = runRes.data;

  // The first Navigate block in the flow handles the target URL navigation.
  // We pass a placeholder baseUrl for relative URL resolution in the extension.
  const startNode = (flowData.nodes || []).find((n: FlowNode) => n.data?.blockType === 'start');
  const firstNav = (flowData.nodes || []).find((n: FlowNode) => n.data?.blockType === 'navigate');
  const baseUrl = firstNav?.data?.url || startNode?.data?.baseUrl || 'about:blank';

  await new Promise<void>((resolve) => {
    const stepResults: Record<string, unknown>[] = [];
    const startTime = Date.now();
    let stepCounter = 0;

    const saveResults = async (status: 'passed' | 'failed' | 'stopped') => {
      const durationMs = Date.now() - startTime;
      const nonRetrySteps = stepResults.filter(s => !s.retry);
      const passedSteps = nonRetrySteps.filter(s => s.status === 'passed').length;
      const failedSteps = nonRetrySteps.filter(s => s.status === 'failed').length;

      try {
        // Final update — save status, duration, and totals.
        // Step results were already pushed individually via /steps endpoint,
        // so we skip sending them again to avoid duplicates.
        // Use unique step count (excluding retries) for totalSteps.
        await testRunsApi.update(testRun.id, {
          status,
          completedAt: new Date().toISOString(),
          durationMs,
          totalSteps: nonRetrySteps.length || undefined,
          passedSteps: nonRetrySteps.length ? passedSteps : undefined,
          failedSteps: nonRetrySteps.length ? failedSteps : undefined,
          environment: JSON.stringify({
            browser: navigator.userAgent.includes('Edg/') ? 'Edge' : 'Chrome',
            url: baseUrl,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        toast.error(`Failed to save results for "${testCase.name}"`);
      }
    };

    const connection = connectToExtension(extensionId, {
      onConnected: () => {
        toast.info(`Running "${testCase.name}"...`);
        executeTestViaExtension(connection!.port, flowData, testCaseId, baseUrl, testCase.name, testRun.id);
      },
      onStepStart: (data) => {
        // Only increment for new steps, not retries
        if (!data.retry) stepCounter++;
        // Push a "running" step so the detail page shows the step in progress
        saveStepResult(testRun.id, stepCounter, {
          ...data,
          status: 'running',
          retry: data.retry || false,
        });
      },
      onStepComplete: (data) => {
        stepResults.push(data);
        // Overwrite the "running" step with the final result
        saveStepResult(testRun.id, stepCounter, {
          ...data,
          status: 'passed',
          retry: data.retry || false,
        });
      },
      onStepError: (data) => {
        stepResults.push({ ...data, status: 'failed' });
        // Overwrite the "running" step with the failure
        saveStepResult(testRun.id, stepCounter, {
          ...data,
          status: 'failed',
          retry: data.retry || false,
        });
      },
      onTestComplete: async (data) => {
        const status = data.status || (stepResults.filter(s => s.status === 'failed').length > 0 ? 'failed' : 'passed');
        await saveResults(status);
        if (status === 'passed') {
          toast.success(`"${testCase.name}" passed`);
        } else if (status === 'stopped') {
          toast.warning(`"${testCase.name}" aborted`);
        } else {
          toast.error(`"${testCase.name}" failed`);
        }
        connection?.disconnect();
        resolve();
      },
      onTestResumed: async () => {
        // User clicked retry in the popup — test is back to running
        await testRunsApi.update(testRun.id, { status: 'running', completedAt: undefined as any });
      },
      onDisconnect: async () => {
        // If we get disconnected, save whatever state we have
        const failedSteps = stepResults.filter(s => s.status === 'failed').length;
        const status = failedSteps > 0 ? 'failed' : (stepResults.length === 0 ? 'stopped' : 'passed');
        await saveResults(status);
        resolve();
      },
    });

    if (!connection) {
      toast.error("Could not connect to extension. Is it installed and enabled?");
      testRunsApi.update(testRun.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      }).catch(() => {});
      resolve();
    }
  });
}
