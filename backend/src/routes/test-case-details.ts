import { Router, Request, Response } from 'express';
import { dataStore as store } from '../db';
import { AppError } from '../middleware/error-handler';

const router = Router();

// GET /api/test-cases/:id/comments
router.get('/:id/comments', async (req: Request, res: Response) => {
  const testCase = await store.getTestCase(req.params.id as string);
  if (!testCase) throw new AppError('Test case not found', 404);
  const comments = await store.getCommentsForTestCase(testCase.id);
  res.json({ data: comments });
});

// POST /api/test-cases/:id/comments
router.post('/:id/comments', async (req: Request, res: Response) => {
  const testCase = await store.getTestCase(req.params.id as string);
  if (!testCase) throw new AppError('Test case not found', 404);
  const { body, parentId } = req.body;
  if (!body) throw new AppError('Comment body is required');
  const comment = await store.createComment({
    testCaseId: testCase.id,
    parentId: parentId || undefined,
    authorId: req.user?.id || req.user?.email || '',
    authorName: req.user?.name || undefined,
    body,
  });
  res.status(201).json({ data: comment });
});

// PUT /api/test-cases/comments/:commentId
router.put('/comments/:commentId', async (req: Request, res: Response) => {
  const { body } = req.body;
  if (!body) throw new AppError('Comment body is required');
  const updated = await store.updateComment(req.params.commentId as string, { body });
  if (!updated) throw new AppError('Comment not found', 404);
  res.json({ data: updated });
});

// DELETE /api/test-cases/comments/:commentId
router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  const existed = await store.deleteComment(req.params.commentId as string);
  if (!existed) throw new AppError('Comment not found', 404);
  res.json({ message: 'Deleted' });
});

// --- Assignments ---

// GET /api/test-cases/:id/assignees
router.get('/:id/assignees', async (req: Request, res: Response) => {
  const testCase = await store.getTestCase(req.params.id as string);
  if (!testCase) throw new AppError('Test case not found', 404);
  const assignments = await store.getAssignmentsForTestCase(testCase.id);
  res.json({ data: assignments });
});

// POST /api/test-cases/:id/assignees
router.post('/:id/assignees', async (req: Request, res: Response) => {
  const testCase = await store.getTestCase(req.params.id as string);
  if (!testCase) throw new AppError('Test case not found', 404);
  const { userIds, userNames } = req.body;
  if (!userIds || !Array.isArray(userIds)) throw new AppError('userIds array is required');
  const results = await Promise.all(
    userIds.map((userId: string, i: number) =>
      store.createAssignment({
        testCaseId: testCase.id,
        userId,
        userName: userNames?.[i] || undefined,
        assignedBy: req.user?.email,
      })
    )
  );
  res.status(201).json({ data: results });
});

// DELETE /api/test-cases/:id/assignees/:userId
router.delete('/:id/assignees/:userId', async (req: Request, res: Response) => {
  const existed = await store.deleteAssignment(req.params.id as string, req.params.userId as string);
  if (!existed) throw new AppError('Assignment not found', 404);
  res.json({ message: 'Deleted' });
});

// POST /api/test-cases/bulk-assign
router.post('/bulk-assign', async (req: Request, res: Response) => {
  const { testCaseIds, userIds, userNames } = req.body;
  if (!testCaseIds || !Array.isArray(testCaseIds)) throw new AppError('testCaseIds array is required');
  if (!userIds || !Array.isArray(userIds)) throw new AppError('userIds array is required');

  const results = await Promise.all(
    testCaseIds.flatMap((tcId: string) =>
      userIds.map((userId: string, i: number) =>
        store.createAssignment({
          testCaseId: tcId,
          userId,
          userName: userNames?.[i] || undefined,
          assignedBy: req.user?.email,
        })
      )
    )
  );
  res.status(201).json({ data: results });
});

export default router;
