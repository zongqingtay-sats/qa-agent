/**
 * RBAC middleware for Express routes.
 *
 * Provides:
 *  - loadUserRole           – loads role record into req.roleRecord from DB
 *  - requirePermission(p)   – checks app-level bitmask permission
 *  - requireProjectAccess(p)– checks project-scoped bitmask permission
 */

import { Request, Response, NextFunction } from 'express';
import { RoleRecord, roleHasPermission, ALL, DEFAULT_ROLES } from './types';
import { getPrismaClient } from '../db/prisma';
import { appConfig } from '../config';

/** A full-access role used in dev mode (no DB / anonymous user). */
const DEV_ADMIN_ROLE: RoleRecord = {
  id: 'dev-admin',
  name: 'Dev Admin',
  description: 'Dev mode — full access',
  isAdmin: true,
  isSystem: true,
  projectPerms: ALL,
  testcasePerms: ALL,
  testrunPerms: ALL,
  userPerms: ALL,
  importPerms: ALL,
  generatePerms: ALL,
};

/** Minimal reader role used as fallback. */
const FALLBACK_READER: RoleRecord = {
  id: 'fallback-reader',
  name: 'Reader',
  description: 'Fallback read-only',
  isAdmin: false,
  isSystem: true,
  projectPerms: 2, testcasePerms: 2, testrunPerms: 2,
  userPerms: 0, importPerms: 0, generatePerms: 0,
};

// Extend Express Request with RBAC fields
declare global {
  namespace Express {
    interface Request {
      /** The full role record loaded from the DB. */
      roleRecord?: RoleRecord;
      /** Project IDs the user has access to. undefined = unrestricted (admin). */
      accessibleProjectIds?: string[];
    }
  }
}

/**
 * Middleware: loads the user's Role record and accessible project IDs.
 */
export async function loadUserRole(req: Request, _res: Response, next: NextFunction) {
  if (!appConfig.databaseUrl || !req.user?.id || req.user.id === 'anonymous') {
    req.roleRecord = DEV_ADMIN_ROLE;
    req.accessibleProjectIds = undefined;
    return next();
  }

  try {
    const prisma = getPrismaClient();
    const userRole = await prisma.userRole.findUnique({
      where: { userId: req.user.id },
      include: { role: true },
    });

    if (userRole?.role) {
      req.roleRecord = userRole.role as RoleRecord;
    } else {
      req.roleRecord = FALLBACK_READER;
    }

    if (req.roleRecord.isAdmin) {
      req.accessibleProjectIds = undefined;
    } else {
      const access = await prisma.projectAccess.findMany({
        where: { userId: req.user.id },
        select: { projectId: true },
      });
      req.accessibleProjectIds = access.map(a => a.projectId);
    }
  } catch {
    req.roleRecord = FALLBACK_READER;
    req.accessibleProjectIds = [];
  }
  next();
}

/**
 * Require an app-level permission (bitmask check).
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.roleRecord || FALLBACK_READER;
    if (roleHasPermission(role, permission)) {
      return next();
    }
    res.status(403).json({ error: 'Forbidden', message: `Missing permission: ${permission}` });
  };
}

/**
 * Require a project-scoped permission.
 * isAdmin roles bypass the project-access check.
 */
export function requireProjectAccess(
  permission: string,
  resolveProjectId?: (req: Request) => Promise<string | undefined> | string | undefined,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const role = req.roleRecord || FALLBACK_READER;

    if (!roleHasPermission(role, permission)) {
      res.status(403).json({ error: 'Forbidden', message: `Missing permission: ${permission}` });
      return;
    }

    if (role.isAdmin) return next();

    let projectId: string | undefined;
    if (resolveProjectId) {
      projectId = await resolveProjectId(req);
    } else {
      projectId = (req.params.projectId || req.params.id || req.body?.projectId) as string | undefined;
    }

    if (!projectId || !appConfig.databaseUrl || !req.user?.id) {
      return next();
    }

    try {
      const prisma = getPrismaClient();
      const access = await prisma.projectAccess.findUnique({
        where: { userId_projectId: { userId: req.user.id, projectId } },
      });
      if (!access) {
        res.status(403).json({ error: 'Forbidden', message: 'No access to this project' });
        return;
      }
      return next();
    } catch {
      res.status(500).json({ error: 'Failed to check project access' });
    }
  };
}

/**
 * Seed default roles into the DB if they don't exist.
 */
export async function seedDefaultRoles() {
  if (!appConfig.databaseUrl) return;
  try {
    const prisma = getPrismaClient();
    for (const def of DEFAULT_ROLES) {
      await prisma.role.upsert({
        where: { name: def.name },
        update: {},  // don't overwrite if already customized
        create: def,
      });
    }
    console.log('Default roles seeded');
  } catch (err) {
    console.error('Failed to seed default roles:', err);
  }
}

// ── Helpers ──────────────────────────────────────────────────

export async function resolveProjectFromTestCase(req: Request): Promise<string | undefined> {
  if (!appConfig.databaseUrl) return undefined;
  const testCaseId = req.params.id as string;
  if (!testCaseId) return undefined;
  try {
    const prisma = getPrismaClient();
    const tc = await prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: { projectId: true },
    });
    return tc?.projectId || undefined;
  } catch { return undefined; }
}

export async function resolveProjectFromTestRun(req: Request): Promise<string | undefined> {
  if (!appConfig.databaseUrl) return undefined;
  const testRunId = req.params.id as string;
  if (!testRunId) return undefined;
  try {
    const prisma = getPrismaClient();
    const run = await prisma.testRun.findUnique({
      where: { id: testRunId },
      select: { testCase: { select: { projectId: true } } },
    });
    return run?.testCase?.projectId || undefined;
  } catch { return undefined; }
}
