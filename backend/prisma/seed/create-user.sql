-- ============================================================
-- Seed script: Create an admin user
-- Run AFTER seed-roles.sql
-- ============================================================

DECLARE @userId NVARCHAR(255) = 'admin-user-001'
DECLARE @email NVARCHAR(255) = 'admin@sats.com.sg'
DECLARE @name NVARCHAR(255) = 'Admin User'

-- Create the user if not exists
IF NOT EXISTS (SELECT 1 FROM [users] WHERE [email] = @email)
  INSERT INTO [users] (id, name, email, emailVerified, image, status)
  VALUES (@userId, @name, @email, GETUTCDATE(), NULL, N'active')
ELSE
  SET @userId = (SELECT id FROM [users] WHERE [email] = @email)
  
-- Assign the Admin role
DECLARE @adminRoleId NVARCHAR(36)
SET @adminRoleId = (SELECT id FROM [roles] WHERE [name] = N'Admin')

IF @adminRoleId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM [user_roles] WHERE [userId] = @userId)
    INSERT INTO [user_roles] (id, userId, roleId)
    VALUES (NEWID(), @userId, @adminRoleId)
  ELSE
    UPDATE [user_roles] SET roleId = @adminRoleId WHERE userId = @userId
END
