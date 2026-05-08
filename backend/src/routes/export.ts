import { Router, Request, Response } from 'express';
import { store } from '../db/store';
import { AppError } from '../middleware/error-handler';
import {
  exportTestCaseToJson, exportTestCaseToDocx, exportTestCaseToPdf,
  exportTestRunToJson, exportTestRunToDocx, exportTestRunToPdf,
} from '../services/export-service';

const router = Router();

// POST /api/export/test-case/:id
router.post('/test-case/:id', async (req: Request, res: Response) => {
  const { format } = req.body;
  if (!format || !['json', 'docx', 'pdf'].includes(format)) {
    throw new AppError('Format must be one of: json, docx, pdf');
  }

  const testCase = store.getTestCase(req.params.id as string);
  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  let flowData;
  try { flowData = JSON.parse(testCase.flowData); } catch { flowData = { nodes: [], edges: [] }; }

  // Convert flow nodes to steps for export
  const steps = (flowData.nodes || [])
    .filter((n: any) => n.data?.blockType && n.data.blockType !== 'start' && n.data.blockType !== 'end')
    .map((n: any, i: number) => ({
      order: i + 1,
      action: n.data.blockType,
      target: n.data.selector || n.data.url,
      value: n.data.value || n.data.expectedValue,
      description: n.data.label || n.data.description || n.data.blockType,
    }));

  const exportData = {
    name: testCase.name,
    description: testCase.description,
    preconditions: testCase.preconditions,
    passingCriteria: testCase.passingCriteria,
    tags: testCase.tags,
    steps,
  };

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${testCase.name}.json"`);
    res.send(exportTestCaseToJson(exportData));
  } else if (format === 'docx') {
    const buffer = await exportTestCaseToDocx(exportData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${testCase.name}.docx"`);
    res.send(buffer);
  } else if (format === 'pdf') {
    const buffer = await exportTestCaseToPdf(exportData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${testCase.name}.pdf"`);
    res.send(buffer);
  }
});

// POST /api/export/test-run/:id
router.post('/test-run/:id', async (req: Request, res: Response) => {
  const { format } = req.body;
  if (!format || !['json', 'docx', 'pdf'].includes(format)) {
    throw new AppError('Format must be one of: json, docx, pdf');
  }

  const testRun = store.getTestRun(req.params.id as string);
  if (!testRun) {
    throw new AppError('Test run not found', 404);
  }

  const testCase = store.getTestCase(testRun.testCaseId);
  const stepResults = store.getStepResultsForRun(testRun.id);

  const exportData = {
    testCaseName: testCase?.name || 'Unknown',
    description: testCase?.description || '',
    preconditions: testCase?.preconditions,
    passingCriteria: testCase?.passingCriteria,
    status: testRun.status,
    startedAt: testRun.startedAt,
    completedAt: testRun.completedAt,
    durationMs: testRun.durationMs,
    totalSteps: testRun.totalSteps,
    passedSteps: testRun.passedSteps,
    failedSteps: testRun.failedSteps,
    stepResults: stepResults.map(sr => ({
      stepOrder: sr.stepOrder,
      blockType: sr.blockType,
      description: sr.description,
      target: sr.target,
      expectedResult: sr.expectedResult,
      actualResult: sr.actualResult,
      status: sr.status,
      screenshotDataUrl: sr.screenshotDataUrl,
      errorMessage: sr.errorMessage,
      durationMs: sr.durationMs,
    })),
  };

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="test-run-${testRun.id}.json"`);
    res.send(exportTestRunToJson(exportData));
  } else if (format === 'docx') {
    const buffer = await exportTestRunToDocx(exportData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="test-run-${testRun.id}.docx"`);
    res.send(buffer);
  } else if (format === 'pdf') {
    const buffer = await exportTestRunToPdf(exportData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test-run-${testRun.id}.pdf"`);
    res.send(buffer);
  }
});

export default router;
