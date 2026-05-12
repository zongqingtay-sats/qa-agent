-- ============================================================
-- Seed script for default RBAC roles
-- Target: Azure SQL Server (qa-agent)
--
-- Permission bitmask reference:
--   Bit 0 (1)   = CREATE
--   Bit 1 (2)   = READ
--   Bit 2 (4)   = UPDATE
--   Bit 3 (8)   = DELETE
--   Bit 4 (16)  = EXPORT
--   Bit 5 (32)  = RUN
--   Bit 6 (64)  = GRANT_ACCESS
--   Bit 7 (128) = MANAGE
--
-- Common combinations:
--   CRUD = 1+2+4+8       = 15
--   ALL  = 255
-- ============================================================

-- Admin: full access, isAdmin bypasses all checks
IF NOT EXISTS (SELECT 1 FROM [roles] WHERE [name] = N'Admin')
  INSERT INTO [roles] (id, name, description, isAdmin, isSystem,
    projectPerms, testcasePerms, testrunPerms, userPerms, importPerms, generatePerms,
    createdAt, updatedAt)
  VALUES (NEWID(), N'Admin', N'Full access to everything', 1, 1,
    255, 255, 255, 255, 255, 255,
    GETUTCDATE(), GETUTCDATE());

-- Project Manager: CRUD+export on test cases, read+update+grant on projects
IF NOT EXISTS (SELECT 1 FROM [roles] WHERE [name] = N'Project Manager')
  INSERT INTO [roles] (id, name, description, isAdmin, isSystem,
    projectPerms, testcasePerms, testrunPerms, userPerms, importPerms, generatePerms,
    createdAt, updatedAt)
  VALUES (NEWID(), N'Project Manager', N'Full access within assigned projects; can grant access', 0, 1,
    70,   -- projectPerms:  READ(2) + UPDATE(4) + GRANT_ACCESS(64)
    31,   -- testcasePerms: CREATE(1) + READ(2) + UPDATE(4) + DELETE(8) + EXPORT(16)
    3,    -- testrunPerms:  CREATE(1) + READ(2)
    0, 1, 1,
    GETUTCDATE(), GETUTCDATE());

-- QA Tester: read + run + export
IF NOT EXISTS (SELECT 1 FROM [roles] WHERE [name] = N'QA Tester')
  INSERT INTO [roles] (id, name, description, isAdmin, isSystem,
    projectPerms, testcasePerms, testrunPerms, userPerms, importPerms, generatePerms,
    createdAt, updatedAt)
  VALUES (NEWID(), N'QA Tester', N'Read, run, export within assigned projects', 0, 1,
    2,    -- projectPerms:  READ(2)
    18,   -- testcasePerms: READ(2) + EXPORT(16)
    3,    -- testrunPerms:  CREATE(1) + READ(2)
    0, 0, 0,
    GETUTCDATE(), GETUTCDATE());

-- Reader: read-only
IF NOT EXISTS (SELECT 1 FROM [roles] WHERE [name] = N'Reader')
  INSERT INTO [roles] (id, name, description, isAdmin, isSystem,
    projectPerms, testcasePerms, testrunPerms, userPerms, importPerms, generatePerms,
    createdAt, updatedAt)
  VALUES (NEWID(), N'Reader', N'Read-only within assigned projects', 0, 1,
    2,    -- projectPerms:  READ(2)
    2,    -- testcasePerms: READ(2)
    2,    -- testrunPerms:  READ(2)
    0, 0, 0,
    GETUTCDATE(), GETUTCDATE());