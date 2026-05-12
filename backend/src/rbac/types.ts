/**
 * RBAC types — bitmask-based permissions stored in the database.
 *
 * Each resource group (project, testcase, testrun, user, import, generate)
 * has an integer column on the Role table.  Each bit represents one action:
 *
 *   Bit 0 (1)   = create
 *   Bit 1 (2)   = read
 *   Bit 2 (4)   = update
 *   Bit 3 (8)   = delete
 *   Bit 4 (16)  = export
 *   Bit 5 (32)  = run / execute
 *   Bit 6 (64)  = grant_access
 *   Bit 7 (128) = manage
 *
 * The Role row also has `isAdmin: true` which bypasses all permission checks.
 */

// ── Bit flags ────────────────────────────────────────────────

export const P = {
  CREATE:       1 << 0,  // 1
  READ:         1 << 1,  // 2
  UPDATE:       1 << 2,  // 4
  DELETE:       1 << 3,  // 8
  EXPORT:       1 << 4,  // 16
  RUN:          1 << 5,  // 32
  GRANT_ACCESS: 1 << 6,  // 64
  MANAGE:       1 << 7,  // 128
} as const;

export const CRUD = P.CREATE | P.READ | P.UPDATE | P.DELETE; // 15
export const ALL = 0xFF; // 255

// ── Resource groups (columns on the Role table) ──────────────

export type ResourceGroup =
  | 'projectPerms'
  | 'testcasePerms'
  | 'testrunPerms'
  | 'userPerms'
  | 'importPerms'
  | 'generatePerms';

// ── Permission descriptor used by middleware ─────────────────

export interface PermissionCheck {
  resource: ResourceGroup;
  action: number;
}

/**
 * Map from string permission names (used in route guards)
 * to { resource, action } so middleware can check the bitmask.
 */
export const PERMISSION_MAP: Record<string, PermissionCheck> = {
  'project:create':       { resource: 'projectPerms',  action: P.CREATE },
  'project:read':         { resource: 'projectPerms',  action: P.READ },
  'project:update':       { resource: 'projectPerms',  action: P.UPDATE },
  'project:delete':       { resource: 'projectPerms',  action: P.DELETE },
  'project:grant_access': { resource: 'projectPerms',  action: P.GRANT_ACCESS },
  'testcase:create':      { resource: 'testcasePerms', action: P.CREATE },
  'testcase:read':        { resource: 'testcasePerms', action: P.READ },
  'testcase:update':      { resource: 'testcasePerms', action: P.UPDATE },
  'testcase:delete':      { resource: 'testcasePerms', action: P.DELETE },
  'testcase:export':      { resource: 'testcasePerms', action: P.EXPORT },
  'testrun:create':       { resource: 'testrunPerms',  action: P.CREATE },
  'testrun:read':         { resource: 'testrunPerms',  action: P.READ },
  'user:manage':          { resource: 'userPerms',     action: P.MANAGE },
  'import:create':        { resource: 'importPerms',   action: P.CREATE },
  'generate:create':      { resource: 'generatePerms', action: P.CREATE },
};

export type Permission = keyof typeof PERMISSION_MAP;

// ── Role shape (matches the DB Role model) ───────────────────

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  isSystem: boolean;
  projectPerms: number;
  testcasePerms: number;
  testrunPerms: number;
  userPerms: number;
  importPerms: number;
  generatePerms: number;
}

/** Check if a role record grants a specific permission. */
export function roleHasPermission(role: RoleRecord, permission: string): boolean {
  if (role.isAdmin) return true;
  const check = PERMISSION_MAP[permission];
  if (!check) return false;
  return (role[check.resource] & check.action) !== 0;
}

// ── Default roles for seeding ────────────────────────────────

export const DEFAULT_ROLES: Omit<RoleRecord, 'id'>[] = [
  {
    name: 'Admin',
    description: 'Full access to everything',
    isAdmin: true,
    isSystem: true,
    projectPerms: ALL,
    testcasePerms: ALL,
    testrunPerms: ALL,
    userPerms: ALL,
    importPerms: ALL,
    generatePerms: ALL,
  },
  {
    name: 'Project Manager',
    description: 'Full access within assigned projects; can grant access',
    isAdmin: false,
    isSystem: true,
    projectPerms: P.READ | P.UPDATE | P.GRANT_ACCESS,
    testcasePerms: CRUD | P.EXPORT,
    testrunPerms: P.CREATE | P.READ,
    userPerms: 0,
    importPerms: P.CREATE,
    generatePerms: P.CREATE,
  },
  {
    name: 'QA Tester',
    description: 'Read, run, export within assigned projects',
    isAdmin: false,
    isSystem: true,
    projectPerms: P.READ,
    testcasePerms: P.READ | P.EXPORT,
    testrunPerms: P.CREATE | P.READ,
    userPerms: 0,
    importPerms: 0,
    generatePerms: 0,
  },
  {
    name: 'Reader',
    description: 'Read-only within assigned projects',
    isAdmin: false,
    isSystem: true,
    projectPerms: P.READ,
    testcasePerms: P.READ,
    testrunPerms: P.READ,
    userPerms: 0,
    importPerms: 0,
    generatePerms: 0,
  },
];
