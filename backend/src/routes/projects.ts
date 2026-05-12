import { Router, Request, Response } from 'express';
import { dataStore as store } from '../db';
import { AppError } from '../middleware/error-handler';

const router = Router();

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  const { search } = req.query;
  const projects = await store.getAllProjects({
    search: search as string | undefined,
  });
  res.json({ data: projects, total: projects.length });
});

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  const project = await store.getProject(req.params.id as string);
  if (!project) throw new AppError('Project not found', 404);

  const [features, phases] = await Promise.all([
    store.getFeaturesForProject(project.id),
    store.getPhasesForProject(project.id),
  ]);

  res.json({ data: { ...project, features, phases } });
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) throw new AppError('Name is required');
  const project = await store.createProject({
    name,
    description: description || undefined,
    createdBy: req.user?.email,
  });
  res.status(201).json({ data: project });
});

// PUT /api/projects/:id
router.put('/:id', async (req: Request, res: Response) => {
  const existing = await store.getProject(req.params.id as string);
  if (!existing) throw new AppError('Project not found', 404);
  const { name, description } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  const updated = await store.updateProject(req.params.id as string, updates);
  res.json({ data: updated });
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const existed = await store.deleteProject(req.params.id as string);
  if (!existed) throw new AppError('Project not found', 404);
  res.json({ message: 'Deleted' });
});

// GET /api/projects/:id/test-cases
router.get('/:id/test-cases', async (req: Request, res: Response) => {
  const project = await store.getProject(req.params.id as string);
  if (!project) throw new AppError('Project not found', 404);

  const { search, status } = req.query;
  const testCases = await store.getAllTestCases({
    projectId: project.id,
    search: search as string | undefined,
    status: status as string | undefined,
  });

  // Enrich with assignments
  const enriched = await Promise.all(
    testCases.map(async (tc) => {
      const assignments = await store.getAssignmentsForTestCase(tc.id);
      return { ...tc, assignments };
    })
  );

  res.json({ data: enriched, total: enriched.length });
});

// --- Features ---

// GET /api/projects/:id/features
router.get('/:id/features', async (req: Request, res: Response) => {
  const features = await store.getFeaturesForProject(req.params.id as string);
  res.json({ data: features });
});

// POST /api/projects/:id/features
router.post('/:id/features', async (req: Request, res: Response) => {
  const project = await store.getProject(req.params.id as string);
  if (!project) throw new AppError('Project not found', 404);
  const { name, sortOrder } = req.body;
  if (!name) throw new AppError('Name is required');
  const feature = await store.createFeature({
    projectId: project.id,
    name,
    sortOrder: sortOrder ?? 0,
  });
  res.status(201).json({ data: feature });
});

// PUT /api/features/:id
router.put('/features/:id', async (req: Request, res: Response) => {
  const { name, sortOrder } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  const updated = await store.updateFeature(req.params.id as string, updates);
  if (!updated) throw new AppError('Feature not found', 404);
  res.json({ data: updated });
});

// DELETE /api/features/:id
router.delete('/features/:id', async (req: Request, res: Response) => {
  const existed = await store.deleteFeature(req.params.id as string);
  if (!existed) throw new AppError('Feature not found', 404);
  res.json({ message: 'Deleted' });
});

// --- Phases ---

// GET /api/projects/:id/phases
router.get('/:id/phases', async (req: Request, res: Response) => {
  const phases = await store.getPhasesForProject(req.params.id as string);
  res.json({ data: phases });
});

// POST /api/projects/:id/phases
router.post('/:id/phases', async (req: Request, res: Response) => {
  const project = await store.getProject(req.params.id as string);
  if (!project) throw new AppError('Project not found', 404);
  const { name, sortOrder } = req.body;
  if (!name) throw new AppError('Name is required');
  const phase = await store.createPhase({
    projectId: project.id,
    name,
    sortOrder: sortOrder ?? 0,
  });
  res.status(201).json({ data: phase });
});

// PUT /api/phases/:id
router.put('/phases/:id', async (req: Request, res: Response) => {
  const { name, sortOrder } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  const updated = await store.updatePhase(req.params.id as string, updates);
  if (!updated) throw new AppError('Phase not found', 404);
  res.json({ data: updated });
});

// DELETE /api/phases/:id
router.delete('/phases/:id', async (req: Request, res: Response) => {
  const existed = await store.deletePhase(req.params.id as string);
  if (!existed) throw new AppError('Phase not found', 404);
  res.json({ message: 'Deleted' });
});

// --- Group Visibility ---

// GET /api/projects/:id/visibility
router.get('/:id/visibility', async (req: Request, res: Response) => {
  const userId = req.user?.id || req.user?.email || '';
  const records = await store.getGroupVisibility(userId, req.params.id as string);
  res.json({ data: records });
});

// PUT /api/projects/:id/visibility
router.put('/:id/visibility', async (req: Request, res: Response) => {
  const { groupType, groupId, isHidden } = req.body;
  if (!groupType || !groupId || isHidden === undefined) {
    throw new AppError('groupType, groupId, and isHidden are required');
  }
  const userId = req.user?.id || req.user?.email || '';
  const record = await store.setGroupVisibility({
    userId,
    projectId: req.params.id as string,
    groupType,
    groupId,
    isHidden,
  });
  res.json({ data: record });
});

export default router;
