import { Router, Request, Response } from 'express';
import { store } from '../db/store';
import { AppError } from '../middleware/error-handler';
import { eventBus } from '../sse/event-bus';

const router = Router();

// GET /api/test-runs
router.get('/', (req: Request, res: Response) => {
  const { testCaseId, status } = req.query;
  const testRuns = store.getAllTestRuns({
    testCaseId: testCaseId as string | undefined,
    status: status as string | undefined,
  });

  // Include test case name for each run
  const enriched = testRuns.map(run => {
    const tc = store.getTestCase(run.testCaseId);
    return { ...run, testCaseName: tc?.name || 'Unknown' };
  });

  res.json({ data: enriched, total: enriched.length });
});

// GET /api/test-runs/:id
router.get('/:id', (req: Request, res: Response) => {
  const testRun = store.getTestRun(req.params.id as string);
  if (!testRun) {
    throw new AppError('Test run not found', 404);
  }

  const stepResults = store.getStepResultsForRun(testRun.id);
  const tc = store.getTestCase(testRun.testCaseId);

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
router.post('/', (req: Request, res: Response) => {
  const { testCaseId } = req.body;

  if (!testCaseId) {
    throw new AppError('testCaseId is required');
  }

  const testCase = store.getTestCase(testCaseId);
  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  const testRun = store.createTestRun({
    testCaseId,
    status: 'running',
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: 0,
  });

  const tc = store.getTestCase(testCaseId);
  eventBus.emit('test-runs', 'test-run:created', { ...testRun, testCaseName: tc?.name || 'Unknown' });

  res.status(201).json({ data: testRun });
});

// POST /api/test-runs/:id/steps — save a single step result in real time
router.post('/:id/steps', (req: Request, res: Response) => {
  const testRun = store.getTestRun(req.params.id as string);
  if (!testRun) {
    throw new AppError('Test run not found', 404);
  }

  const sr = req.body;
  const stepResult = store.createStepResult({
    testRunId: testRun.id,
    stepOrder: sr.stepOrder,
    blockId: sr.blockId || '',
    blockType: sr.blockType || '',
    description: sr.description || '',
    target: sr.target || '',
    expectedResult: sr.expectedResult || '',
    actualResult: sr.actualResult || '',
    status: sr.status || 'running',
    screenshotDataUrl: sr.screenshotDataUrl || '',
    errorMessage: sr.errorMessage || '',
    durationMs: sr.durationMs || 0,
    retry: sr.retry || false,
  });

  // Update running totals on the test run
  const allSteps = store.getStepResultsForRun(testRun.id);
  const passedSteps = allSteps.filter(s => s.status === 'passed').length;
  const failedSteps = allSteps.filter(s => s.status === 'failed').length;
  store.updateTestRun(testRun.id, {
    totalSteps: allSteps.length,
    passedSteps,
    failedSteps,
  });

  // Emit a granular SSE event so the frontend can update in real time
  const tc = store.getTestCase(testRun.testCaseId);
  eventBus.emit('test-runs', 'test-run:step', {
    id: testRun.id,
    testCaseName: tc?.name || 'Unknown',
    step: stepResult,
    totalSteps: allSteps.length,
    passedSteps,
    failedSteps,
  });

  res.status(201).json({ data: stepResult });
});

// PUT /api/test-runs/:id
router.put('/:id', (req: Request, res: Response) => {
  const existing = store.getTestRun(req.params.id as string);
  if (!existing) {
    throw new AppError('Test run not found', 404);
  }

  const { status, stepResults, completedAt, durationMs, totalSteps, passedSteps, failedSteps, environment } = req.body;

  // Save step results if provided
  if (stepResults && Array.isArray(stepResults)) {
    for (const sr of stepResults) {
      store.createStepResult({
        testRunId: existing.id,
        stepOrder: sr.stepOrder,
        blockId: sr.blockId,
        blockType: sr.blockType,
        description: sr.description,
        target: sr.target,
        expectedResult: sr.expectedResult,
        actualResult: sr.actualResult,
        status: sr.status,
        screenshotDataUrl: sr.screenshotDataUrl,
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

  const updated = store.updateTestRun(req.params.id as string, updates);

  const tc = store.getTestCase(existing.testCaseId);
  const savedStepResults = store.getStepResultsForRun(existing.id);
  eventBus.emit('test-runs', 'test-run:updated', {
    ...updated,
    testCaseName: tc?.name || 'Unknown',
    stepResults: savedStepResults,
  });

  res.json({ data: updated });
});

export default router;
