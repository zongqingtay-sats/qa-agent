/**
 * Admin routes for managing roles, user-role assignments, and project access.
 */
import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../db/prisma';
import { appConfig } from '../config';
import { requirePermission, requireProjectAccess } from '../rbac/middleware';
import { P, PERMISSION_MAP, RoleRecord } from '../rbac/types';
import { AppError } from '../middleware/error-handler';

const router = Router();

// ── Role CRUD ────────────────────────────────────────────────

// GET /api/admin/roles — list all roles with bitmask values
router.get('/roles', async (_req: Request, res: Response) => {
  if (!appConfig.databaseUrl) {
    res.json({ data: [] });
    return;
  }
  const prisma = getPrismaClient();
  const roles = await (prisma as any).role.findMany({ orderBy: { name: 'asc' } });
  res.json({ data: roles });
});

// GET /api/admin/roles/permissions — list all permission bits for reference
router.get('/roles/permissions', (_req: Request, res: Response) => {
  res.json({
    data: {
      bits: P,
      permissions: Object.entries(PERMISSION_MAP).map(([name, { resource, action }]) => ({
        name, resource, bit: action,
      })),
    },
  });
});

// GET /api/admin/roles/:id
router.get('/roles/:id', requirePermission('user:manage'), async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
  const prisma = getPrismaClient();
  const role = await (prisma as any).role.findUnique({ where: { id: req.params.id as string } });
  if (!role) throw new AppError('Role not found', 404);
  res.json({ data: role });
});

// POST /api/admin/roles — create a custom role
router.post('/roles', requirePermission('user:manage'), async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
  const { name, description, isAdmin, projectPerms, testcasePerms, testrunPerms, userPerms, importPerms, generatePerms } = req.body;
  if (!name) throw new AppError('name is required');

  const prisma = getPrismaClient();
  const role = await (prisma as any).role.create({
    data: {
      name,
      description: description || null,
      isAdmin: isAdmin || false,
      isSystem: false,
      projectPerms: projectPerms ?? 0,
      testcasePerms: testcasePerms ?? 0,
      testrunPerms: testrunPerms ?? 0,
      userPerms: userPerms ?? 0,
      importPerms: importPerms ?? 0,
      generatePerms: generatePerms ?? 0,
    },
  });
  res.status(201).json({ data: role });
});

// PUT /api/admin/roles/:id — update a role's permissions
router.put('/roles/:id', requirePermission('user:manage'), async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
  const prisma = getPrismaClient();

  const existing = await (prisma as any).role.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw new AppError('Role not found', 404);

  const { name, description, isAdmin, projectPerms, testcasePerms, testrunPerms, userPerms, importPerms, generatePerms } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;
  if (projectPerms !== undefined) updates.projectPerms = projectPerms;
  if (testcasePerms !== undefined) updates.testcasePerms = testcasePerms;
  if (testrunPerms !== undefined) updates.testrunPerms = testrunPerms;
  if (userPerms !== undefined) updates.userPerms = userPerms;
  if (importPerms !== undefined) updates.importPerms = importPerms;
  if (generatePerms !== undefined) updates.generatePerms = generatePerms;

  const role = await (prisma as any).role.update({
    where: { id: req.params.id as string },
    data: updates,
  });
  res.json({ data: role });
});

// DELETE /api/admin/roles/:id — delete a custom role (not system roles)
router.delete('/roles/:id', requirePermission('user:manage'), async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
  const prisma = getPrismaClient();

  const existing = await (prisma as any).role.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw new AppError('Role not found', 404);
  if (existing.isSystem) throw new AppError('Cannot delete a system role', 400);

  await (prisma as any).role.delete({ where: { id: req.params.id as string } });
  res.json({ message: 'Deleted' });
});

// ── User Role Assignment ─────────────────────────────────────

// GET /api/admin/users — list all users with their role
router.get('/users', requirePermission('user:manage'), async (_req: Request, res: Response) => {
  if (!appConfig.databaseUrl) { res.json({ data: [] }); return; }
  const prisma = getPrismaClient();
  const users = await (prisma as any).user.findMany({
    select: {
      id: true, name: true, email: true, image: true,
      userRole: { select: { roleId: true, role: { select: { id: true, name: true, isAdmin: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const data = users.map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.userRole?.role
      ? { id: u.userRole.role.id, name: u.userRole.role.name, isAdmin: u.userRole.role.isAdmin }
      : null,
  }));

  res.json({ data });
});

// PUT /api/admin/users/:userId/role — assign a role to a user by roleId
router.put('/users/:userId/role', requirePermission('user:manage'), async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
  const userId = req.params.userId as string;
  const { roleId } = req.body;
  if (!roleId) throw new AppError('roleId is required');

  const prisma = getPrismaClient();
  const [user, role] = await Promise.all([
    (prisma as any).user.findUnique({ where: { id: userId } }),
    (prisma as any).role.findUnique({ where: { id: roleId } }),
  ]);
  if (!user) throw new AppError('User not found', 404);
  if (!role) throw new AppError('Role not found', 404);

  await (prisma as any).userRole.upsert({
    where: { userId },
    update: { roleId },
    create: { userId, roleId },
  });

  res.json({ data: { userId, role: { id: role.id, name: role.name } } });
});

// DELETE /api/admin/users/:userId/role — remove a user's role assignment
router.delete('/users/:userId/role', requirePermission('user:manage'), async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
  const prisma = getPrismaClient();
  await (prisma as any).userRole.deleteMany({ where: { userId: req.params.userId as string } });
  res.json({ data: { userId: req.params.userId, role: null } });
});

// ── Project Access ───────────────────────────────────────────

// GET /api/admin/projects/:projectId/access
router.get(
  '/projects/:projectId/access',
  requireProjectAccess('project:grant_access', (req) => req.params.projectId as string),
  async (req: Request, res: Response) => {
    if (!appConfig.databaseUrl) { res.json({ data: [] }); return; }
    const prisma = getPrismaClient();
    const accessList = await (prisma as any).projectAccess.findMany({
      where: { projectId: req.params.projectId as string },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { grantedAt: 'desc' },
    });
    res.json({
      data: accessList.map((a: any) => ({
        userId: a.userId,
        name: a.user.name,
        email: a.user.email,
        image: a.user.image,
        grantedBy: a.grantedBy,
        grantedAt: a.grantedAt.toISOString(),
      })),
    });
  }
);

// POST /api/admin/projects/:projectId/access
router.post(
  '/projects/:projectId/access',
  requireProjectAccess('project:grant_access', (req) => req.params.projectId as string),
  async (req: Request, res: Response) => {
    if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
    const projectId = req.params.projectId as string;
    const { userId } = req.body;
    if (!userId) throw new AppError('userId is required');

    const prisma = getPrismaClient();
    const [user, project] = await Promise.all([
      (prisma as any).user.findUnique({ where: { id: userId } }),
      (prisma as any).project.findUnique({ where: { id: projectId } }),
    ]);
    if (!user) throw new AppError('User not found', 404);
    if (!project) throw new AppError('Project not found', 404);

    const access = await (prisma as any).projectAccess.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: { grantedBy: req.user?.email || req.user?.id },
      create: { userId, projectId, grantedBy: req.user?.email || req.user?.id },
    });
    res.status(201).json({ data: { userId, projectId, grantedAt: access.grantedAt.toISOString() } });
  }
);

// DELETE /api/admin/projects/:projectId/access/:userId
router.delete(
  '/projects/:projectId/access/:userId',
  requireProjectAccess('project:grant_access', (req) => req.params.projectId as string),
  async (req: Request, res: Response) => {
    if (!appConfig.databaseUrl) throw new AppError('Database not configured', 500);
    const prisma = getPrismaClient();
    await (prisma as any).projectAccess.deleteMany({
      where: { userId: req.params.userId as string, projectId: req.params.projectId as string },
    });
    res.json({ message: 'Access revoked' });
  }
);

// ── Current User ─────────────────────────────────────────────

// GET /api/admin/me — get current user's role record and project access
router.get('/me', async (req: Request, res: Response) => {
  const roleRecord = req.roleRecord;

  if (!appConfig.databaseUrl || !req.user?.id || req.user.id === 'anonymous') {
    res.json({ data: { role: roleRecord, projectIds: [] } });
    return;
  }

  const prisma = getPrismaClient();
  const access = await (prisma as any).projectAccess.findMany({
    where: { userId: req.user.id },
    select: { projectId: true },
  });

  res.json({
    data: {
      role: roleRecord,
      projectIds: access.map((a: any) => a.projectId),
    },
  });
});

export default router;
