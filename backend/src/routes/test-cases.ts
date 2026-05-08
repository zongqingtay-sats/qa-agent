import { Router, Request, Response } from 'express';
import { store } from '../db/store';
import { AppError } from '../middleware/error-handler';

const router = Router();

// GET /api/test-cases
router.get('/', (req: Request, res: Response) => {
  const { status, search } = req.query;
  const testCases = store.getAllTestCases({
    status: status as string | undefined,
    search: search as string | undefined,
  });
  res.json({ data: testCases, total: testCases.length });
});

// GET /api/test-cases/:id
router.get('/:id', (req: Request, res: Response) => {
  const testCase = store.getTestCase(req.params.id as string);
  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }
  res.json({ data: testCase });
});

// POST /api/test-cases
router.post('/', (req: Request, res: Response) => {
  const { name, description, preconditions, passingCriteria, tags, flowData } = req.body;

  if (!name || !flowData) {
    throw new AppError('Name and flowData are required');
  }

  const testCase = store.createTestCase({
    name,
    description: description || '',
    preconditions,
    passingCriteria,
    tags: tags || [],
    flowData: typeof flowData === 'string' ? flowData : JSON.stringify(flowData),
    status: 'draft',
  });

  res.status(201).json({ data: testCase });
});

// PUT /api/test-cases/:id
router.put('/:id', (req: Request, res: Response) => {
  const existing = store.getTestCase(req.params.id as string);
  if (!existing) {
    throw new AppError('Test case not found', 404);
  }

  const { name, description, preconditions, passingCriteria, tags, flowData, status } = req.body;
  const updates: Record<string, any> = {};

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (preconditions !== undefined) updates.preconditions = preconditions;
  if (passingCriteria !== undefined) updates.passingCriteria = passingCriteria;
  if (tags !== undefined) updates.tags = tags;
  if (flowData !== undefined) updates.flowData = typeof flowData === 'string' ? flowData : JSON.stringify(flowData);
  if (status !== undefined) updates.status = status;

  const updated = store.updateTestCase(req.params.id as string, updates);
  res.json({ data: updated });
});

// DELETE /api/test-cases/:id
router.delete('/:id', (req: Request, res: Response) => {
  const existed = store.deleteTestCase(req.params.id as string);
  if (!existed) {
    throw new AppError('Test case not found', 404);
  }
  res.json({ message: 'Deleted' });
});

export default router;
