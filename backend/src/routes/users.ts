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

export default router;
