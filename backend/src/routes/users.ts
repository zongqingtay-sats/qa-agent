import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../db/prisma';
import { appConfig } from '../config';
import { requirePermission } from '../rbac/middleware';

const router = Router();

// GET /api/users?search=...
router.get('/', requirePermission('user:manage'), async (req: Request, res: Response) => {
  // Only available when SQL database is configured
  if (!appConfig.databaseUrl) {
    res.json({ data: [] });
    return;
  }

  const search = (req.query.search as string || '').trim();
  const prisma = getPrismaClient();

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : undefined,
    select: { id: true, name: true, email: true, image: true },
    take: 20,
  });

  res.json({ data: users });
});

// GET /api/users/me/profile — get current user's full profile with roles and projects
router.get('/me/profile', async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl || !req.user?.id || req.user.id === 'anonymous') {
    res.json({ data: { id: 'anonymous', name: 'Dev User', email: null, avatarBg: null, avatarText: null, globalRole: null, projectRoles: [] } });
    return;
  }

  const prisma = getPrismaClient();
  const user = await (prisma as any).user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, name: true, email: true, image: true, avatarBg: true, avatarText: true,
      userRole: { select: { role: { select: { id: true, name: true, isAdmin: true } } } },
      projectAccess: {
        select: {
          projectId: true,
          role: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      avatarBg: user.avatarBg,
      avatarText: user.avatarText,
      globalRole: user.userRole?.role || null,
      projectRoles: user.projectAccess.map((pa: any) => ({
        projectId: pa.projectId,
        projectName: pa.project?.name || pa.projectId,
        role: pa.role || null,
      })),
    },
  });
});

// PUT /api/users/me/profile — update current user's name and avatar preferences
router.put('/me/profile', async (req: Request, res: Response) => {
  if (!appConfig.databaseUrl || !req.user?.id || req.user.id === 'anonymous') {
    res.json({ data: { success: true } });
    return;
  }

  const { name, avatarBg, avatarText } = req.body;
  const prisma = getPrismaClient();

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name || null;
  if (avatarBg !== undefined) updates.avatarBg = avatarBg || null;
  if (avatarText !== undefined) updates.avatarText = avatarText || null;

  const user = await (prisma as any).user.update({
    where: { id: req.user.id },
    data: updates,
    select: { id: true, name: true, email: true, avatarBg: true, avatarText: true },
  });

  res.json({ data: user });
});

export default router;
