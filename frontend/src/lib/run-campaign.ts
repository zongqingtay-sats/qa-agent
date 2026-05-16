/**
 * Campaign execution orchestrator.
 *
 * Runs all test cases in a campaign sequentially, optionally overriding the
 * base URL of the first navigation step. Reports progress via the
 * campaign-run record and SSE events.
 *
 * @module run-campaign
 */

import { campaignsApi, testCasesApi, testRunsApi } from '@/lib/api';
import type { FlowData, FlowNode } from '@/types/api';
import { getExtensionId, connectToExtension, executeTestViaExtension } from '@/lib/extension';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Push a single step result to the backend.
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
    // Non-critical
  }
}

/**
 * Replace the origin of a URL while keeping the path, query, and hash.
 * e.g. replaceOrigin('https://app-dev.com/some-page?x=1', 'https://app-uat.com')
 *   => 'https://app-uat.com/some-page?x=1'
 */
function replaceOrigin(originalUrl: string, newBaseUrl: string): string {
  try {
    const original = new URL(originalUrl);
    const newBase = new URL(newBaseUrl);
    return `${newBase.origin}${original.pathname}${original.search}${original.hash}`;
  } catch {
    return originalUrl;
  }
}

/**
 * Run a single test case as part of a campaign.
 * If campaignBaseUrl is provided, replaces the origin of the first navigate step.
 */
async function runSingleTestCase(
  testCaseId: string,
  campaignBaseUrl?: string,
): Promise<{ testRunId: string; status: 'passed' | 'failed' | 'stopped' }> {
  const extensionId = getExtensionId();
  if (!extensionId) {
    throw new Error('No extension ID configured');
  }

  const tcRes = await testCasesApi.get(testCaseId);
  const testCase = tcRes.data;

  let flowData: FlowData;
  try {
    flowData = typeof testCase.flowData === 'string' ? JSON.parse(testCase.flowData) : testCase.flowData;
  } catch {
    throw new Error(`Invalid flow data for "${testCase.name}"`);
  }

  // Apply base URL override to the first navigate node
  if (campaignBaseUrl) {
    const firstNav = (flowData.nodes || []).find((n: FlowNode) => n.data?.blockType === 'navigate');
    if (firstNav?.data?.url) {
      firstNav.data.url = replaceOrigin(firstNav.data.url, campaignBaseUrl);
    }
  }

  const runRes = await testRunsApi.create(testCaseId);
  const testRun = runRes.data;

  const firstNav = (flowData.nodes || []).find((n: FlowNode) => n.data?.blockType === 'navigate');
  const baseUrl = firstNav?.data?.url || 'about:blank';

  return new Promise((resolve) => {
    const stepResults: Record<string, unknown>[] = [];
    const startTime = Date.now();
    let stepCounter = 0;

    const saveResults = async (status: 'passed' | 'failed' | 'stopped') => {
      const durationMs = Date.now() - startTime;
      const nonRetrySteps = stepResults.filter(s => !s.retry);
      const passedSteps = nonRetrySteps.filter(s => s.status === 'passed').length;
      const failedSteps = nonRetrySteps.filter(s => s.status === 'failed').length;

      try {
        await testRunsApi.update(testRun.id, {
          status,
          completedAt: new Date().toISOString(),
          durationMs,
          totalSteps: nonRetrySteps.length || undefined,
          passedSteps: nonRetrySteps.length ? passedSteps : undefined,
          failedSteps: nonRetrySteps.length ? failedSteps : undefined,
        });
      } catch { /* non-critical */ }
    };

    const connection = connectToExtension(extensionId, {
      onConnected: () => {
        executeTestViaExtension(connection!.port, flowData, testCaseId, baseUrl, testCase.name, testRun.id);
      },
      onStepStart: (data) => {
        if (!data.retry) stepCounter++;
        saveStepResult(testRun.id, stepCounter, { ...data, status: 'running', retry: data.retry || false });
      },
      onStepComplete: (data) => {
        stepResults.push(data);
        saveStepResult(testRun.id, stepCounter, { ...data, status: 'passed', retry: data.retry || false });
      },
      onStepError: (data) => {
        stepResults.push({ ...data, status: 'failed' });
        saveStepResult(testRun.id, stepCounter, { ...data, status: 'failed', retry: data.retry || false });
      },
      onTestComplete: async (data) => {
        const status = data.status || (stepResults.filter(s => s.status === 'failed').length > 0 ? 'failed' : 'passed');
        await saveResults(status);
        connection?.disconnect();
        resolve({ testRunId: testRun.id, status });
      },
      onTestResumed: async () => {
        await testRunsApi.update(testRun.id, { status: 'running', completedAt: undefined as unknown as string });
      },
      onDisconnect: async () => {
        const failedSteps = stepResults.filter(s => s.status === 'failed').length;
        const status = failedSteps > 0 ? 'failed' : (stepResults.length === 0 ? 'stopped' : 'passed');
        await saveResults(status);
        resolve({ testRunId: testRun.id, status });
      },
    });

    if (!connection) {
      testRunsApi.update(testRun.id, { status: 'failed', completedAt: new Date().toISOString() }).catch(() => {});
      resolve({ testRunId: testRun.id, status: 'failed' });
    }
  });
}

/**
 * Run an entire campaign. Creates a campaign run, executes each test case
 * sequentially, and updates the campaign run record after each test.
 *
 * @returns The campaign run ID for navigation to the monitoring page.
 */
export async function runCampaign(campaignId: string, baseUrlOverride?: string): Promise<string> {
  const extensionId = getExtensionId();
  if (!extensionId) {
    toast.error('No extension ID configured. Go to Settings to set it up.');
    throw new Error('No extension ID');
  }

  // Start a campaign run
  const { data: campaignRun } = await campaignsApi.run(campaignId, baseUrlOverride);
  const { data: campaign } = await campaignsApi.get(campaignId);

  const effectiveBaseUrl = baseUrlOverride || campaign.baseUrl;

  toast.info(`Starting campaign "${campaign.name}" (${campaign.testCaseIds.length} test cases)...`);

  let passedCases = 0;
  let failedCases = 0;
  const testRunIds: Record<string, string> = {};

  for (const testCaseId of campaign.testCaseIds) {
    try {
      const result = await runSingleTestCase(testCaseId, effectiveBaseUrl);
      testRunIds[testCaseId] = result.testRunId;

      if (result.status === 'passed') {
        passedCases++;
      } else {
        failedCases++;
      }

      // Update campaign run progress
      await campaignsApi.updateRun(campaignRun.id, {
        passedCases,
        failedCases,
        testRunIds,
      });
    } catch (err: unknown) {
      failedCases++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Test case ${testCaseId} failed: ${msg}`);

      await campaignsApi.updateRun(campaignRun.id, {
        passedCases,
        failedCases,
        testRunIds,
      });
    }
  }

  // Finalise campaign run
  const finalStatus = failedCases > 0 ? 'failed' : 'passed';
  await campaignsApi.updateRun(campaignRun.id, {
    status: finalStatus,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(campaignRun.startedAt).getTime(),
    passedCases,
    failedCases,
    testRunIds,
  });

  if (finalStatus === 'passed') {
    toast.success(`Campaign "${campaign.name}" passed (${passedCases}/${campaign.testCaseIds.length})`);
  } else {
    toast.error(`Campaign "${campaign.name}" completed with ${failedCases} failure(s)`);
  }

  return campaignRun.id;
}
