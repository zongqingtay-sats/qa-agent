import { Router, Request, Response } from 'express';
import { dataStore as store } from '../db';
import { AppError } from '../middleware/error-handler';
import { eventBus } from '../sse/event-bus';
import { uploadScreenshot } from '../services/blob-storage';

const router = Router();

// GET /api/test-runs
router.get('/', async (req: Request, res: Response) => {
  const { testCaseId, status } = req.query;
  const testRuns = await store.getAllTestRuns({
    testCaseId: testCaseId as string | undefined,
    status: status as string | undefined,
  });

  // Include test case name for each run
  const enriched = await Promise.all(testRuns.map(async run => {
    const tc = await store.getTestCase(run.testCaseId);
    return { ...run, testCaseName: tc?.name || 'Unknown' };
  }));

  res.json({ data: enriched, total: enriched.length });
});

// GET /api/test-runs/:id
router.get('/:id', async (req: Request, res: Response) => {
  const testRun = await store.getTestRun(req.params.id as string);
  if (!testRun) {
    throw new AppError('Test run not found', 404);
  }

  const stepResults = await store.getStepResultsForRun(testRun.id);
  const tc = await store.getTestCase(testRun.testCaseId);

  res.json({
    data: {
      ...testRun,
      testCaseName: tc?.name || 'Unknown',
      testCaseDescription: tc?.description,
      testCasePreconditions: tc?.preconditions,
      testCasePassingCriteria: tc?.passingCriteria,
      flowData: tc?.flowData,
      stepResults,
    },
  });
});

// POST /api/test-runs
router.post('/', async (req: Request, res: Response) => {
  const { testCaseId } = req.body;

  if (!testCaseId) {
    throw new AppError('testCaseId is required');
  }

  const testCase = await store.getTestCase(testCaseId);
  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  const testRun = await store.createTestRun({
    testCaseId,
    status: 'running',
    runBy: req.user?.id || undefined,
    runByName: req.user?.name || undefined,
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: 0,
  });

  eventBus.emit('test-runs', 'test-run:created', { ...testRun, testCaseName: testCase.name });

  res.status(201).json({ data: testRun });
});

// POST /api/test-runs/:id/steps — save a single step result in real time
router.post('/:id/steps', async (req: Request, res: Response) => {
  const testRun = await store.getTestRun(req.params.id as string);
  if (!testRun) {
    throw new AppError('Test run not found', 404);
  }

  const sr = req.body;

  // Upload screenshot to blob storage if configured
  const screenshotUrl = sr.screenshotDataUrl
    ? await uploadScreenshot(sr.screenshotDataUrl, testRun.id, sr.stepOrder)
    : '';

  const stepResult = await store.createStepResult({
    testRunId: testRun.id,
    stepOrder: sr.stepOrder,
    blockId: sr.blockId || '',
    blockType: sr.blockType || '',
    description: sr.description || '',
    target: sr.target || '',
    expectedResult: sr.expectedResult || '',
    actualResult: sr.actualResult || '',
    status: sr.status || 'running',
    screenshotDataUrl: screenshotUrl,
    errorMessage: sr.errorMessage || '',
    durationMs: sr.durationMs || 0,
    retry: sr.retry || false,
  });

  // Update running totals on the test run
  const allSteps = await store.getStepResultsForRun(testRun.id);
  const uniqueStepOrders = new Set(allSteps.map(s => s.stepOrder));
  const passedSteps = allSteps.filter(s => s.status === 'passed' && !s.retry).length;
  const failedSteps = allSteps.filter(s => s.status === 'failed' && !s.retry).length;
  await store.updateTestRun(testRun.id, {
    totalSteps: uniqueStepOrders.size,
    passedSteps,
    failedSteps,
  });

  // Emit a granular SSE event so the frontend can update in real time
  const tc = await store.getTestCase(testRun.testCaseId);
  eventBus.emit('test-runs', 'test-run:step', {
    id: testRun.id,
    testCaseName: tc?.name || 'Unknown',
    step: stepResult,
    totalSteps: uniqueStepOrders.size,
    passedSteps,
    failedSteps,
  });

  res.status(201).json({ data: stepResult });
});

// PUT /api/test-runs/:id
router.put('/:id', async (req: Request, res: Response) => {
  const existing = await store.getTestRun(req.params.id as string);
  if (!existing) {
    throw new AppError('Test run not found', 404);
  }

  const { status, stepResults, completedAt, durationMs, totalSteps, passedSteps, failedSteps, environment } = req.body;

  // Save step results if provided
  if (stepResults && Array.isArray(stepResults)) {
    for (const sr of stepResults) {
      const screenshotUrl = sr.screenshotDataUrl
        ? await uploadScreenshot(sr.screenshotDataUrl, existing.id, sr.stepOrder)
        : sr.screenshotDataUrl;
      await store.createStepResult({
        testRunId: existing.id,
        stepOrder: sr.stepOrder,
        blockId: sr.blockId,
        blockType: sr.blockType,
        description: sr.description,
        target: sr.target,
        expectedResult: sr.expectedResult,
        actualResult: sr.actualResult,
        status: sr.status,
        screenshotDataUrl: screenshotUrl,
        errorMessage: sr.errorMessage,
        durationMs: sr.durationMs,
      });
    }
  }

  const updates: Record<string, any> = {};
  if (status !== undefined) updates.status = status;
  if (completedAt !== undefined) updates.completedAt = completedAt;
  if (durationMs !== undefined) updates.durationMs = durationMs;
  if (totalSteps !== undefined) updates.totalSteps = totalSteps;
  if (passedSteps !== undefined) updates.passedSteps = passedSteps;
  if (failedSteps !== undefined) updates.failedSteps = failedSteps;
  if (environment !== undefined) updates.environment = typeof environment === 'string' ? environment : JSON.stringify(environment);

  const updated = await store.updateTestRun(req.params.id as string, updates);

  const tc = await store.getTestCase(existing.testCaseId);
  const savedStepResults = await store.getStepResultsForRun(existing.id);
  eventBus.emit('test-runs', 'test-run:updated', {
    ...updated,
    testCaseName: tc?.name || 'Unknown',
    stepResults: savedStepResults,
  });

  res.json({ data: updated });
});

export default router;
