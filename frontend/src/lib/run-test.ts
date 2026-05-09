import { testCasesApi, testRunsApi } from "@/lib/api";
import { getExtensionId, connectToExtension, executeTestViaExtension } from "@/lib/extension";
import { toast } from "sonner";

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

  let flowData: any;
  try {
    flowData = typeof testCase.flowData === 'string' ? JSON.parse(testCase.flowData) : testCase.flowData;
  } catch {
    toast.error(`Invalid flow data for "${testCase.name}"`);
    return;
  }

  const runRes = await testRunsApi.create(testCaseId);
  const testRun = runRes.data;

  const startNode = (flowData.nodes || []).find((n: any) => n.data?.blockType === 'start');
  const baseUrl = startNode?.data?.baseUrl || 'http://localhost:3000';

  await new Promise<void>((resolve) => {
    const stepResults: any[] = [];
    const startTime = Date.now();

    const saveResults = async (status: string) => {
      const durationMs = Date.now() - startTime;
      const passedSteps = stepResults.filter(s => s.status === 'passed').length;
      const failedSteps = stepResults.filter(s => s.status === 'failed').length;

      try {
        await testRunsApi.update(testRun.id, {
          status,
          completedAt: new Date().toISOString(),
          durationMs,
          totalSteps: stepResults.length || undefined,
          passedSteps: stepResults.length ? passedSteps : undefined,
          failedSteps: stepResults.length ? failedSteps : undefined,
          stepResults: stepResults.length ? stepResults.map((sr, i) => ({
            stepOrder: i + 1,
            blockId: sr.blockId || '',
            blockType: sr.blockType || '',
            description: sr.description || '',
            target: sr.target || '',
            expectedResult: sr.expectedResult || '',
            actualResult: sr.actualResult || '',
            status: sr.status || 'passed',
            screenshotDataUrl: sr.screenshot || sr.screenshotDataUrl || '',
            errorMessage: sr.error || sr.errorMessage || '',
            durationMs: sr.durationMs || 0,
          })) : undefined,
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
      onStepComplete: (data) => {
        stepResults.push(data);
      },
      onStepError: (data) => {
        stepResults.push({ ...data, status: 'failed' });
      },
      onTestComplete: async () => {
        const failedSteps = stepResults.filter(s => s.status === 'failed').length;
        const status = failedSteps > 0 ? 'failed' : 'passed';
        await saveResults(status);
        toast.success(`"${testCase.name}" ${status}`);
        connection?.disconnect();
        resolve();
      },
      onDisconnect: async () => {
        const failedSteps = stepResults.filter(s => s.status === 'failed').length;
        const status = failedSteps > 0 ? 'failed' : (stepResults.length === 0 ? 'failed' : 'passed');
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
