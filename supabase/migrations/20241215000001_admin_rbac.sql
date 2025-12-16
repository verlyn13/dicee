-- Admin RBAC (Role-Based Access Control) System
-- Migration: 20241215000001_admin_rbac.sql
-- Created: 2025-12-15
--
-- Implements:
-- 1. Admin role enum and profiles.role column
-- 2. Granular permissions table
-- 3. Audit log for admin actions
-- 4. RLS policies for admin access
-- 5. Permission checking function

-- =============================================================================
-- Admin Role Enum
-- =============================================================================

-- Create admin role enum (ascending privilege order)
CREATE TYPE admin_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');

COMMENT ON TYPE admin_role IS 'Admin role hierarchy: user (no admin access) < moderator (chat/rooms) < admin (full mgmt) < super_admin (all)';

-- =============================================================================
-- Add Role to Profiles
-- =============================================================================

-- Add role column to profiles table
ALTER TABLE profiles
ADD COLUMN role admin_role NOT NULL DEFAULT 'user';

COMMENT ON COLUMN profiles.role IS 'User admin role for RBAC';

-- Create index for role lookups
CREATE INDEX idx_profiles_role ON profiles(role) WHERE role != 'user';

-- =============================================================================
-- Admin Permissions Table
-- =============================================================================

-- Granular permissions per role
CREATE TABLE admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role admin_role NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each role can have each permission only once
  UNIQUE(role, permission)
);

COMMENT ON TABLE admin_permissions IS 'Granular permission assignments per admin role';

-- Insert default permissions for each role
INSERT INTO admin_permissions (role, permission) VALUES
  -- Moderator permissions
  ('moderator', 'rooms:view'),
  ('moderator', 'rooms:close'),
  ('moderator', 'chat:moderate'),

  -- Admin permissions (includes moderator + more)
  ('admin', 'rooms:view'),
  ('admin', 'rooms:close'),
  ('admin', 'rooms:clear_all'),
  ('admin', 'chat:moderate'),
  ('admin', 'chat:delete'),
  ('admin', 'users:view'),
  ('admin', 'users:ban'),
  ('admin', 'audit:view'),

  -- Super admin has wildcard (all permissions)
  ('super_admin', '*');

-- =============================================================================
-- Admin Audit Log
-- =============================================================================

-- Audit log for all admin actions
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE admin_audit_log IS 'Audit log for all admin actions';

-- Indexes for efficient querying
CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_target ON admin_audit_log(target_type, target_id);

-- =============================================================================
-- Permission Check Function
-- =============================================================================

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION has_admin_permission(user_id UUID, perm TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles p
    JOIN admin_permissions ap ON ap.role = p.role
    WHERE p.id = user_id
    AND (ap.permission = perm OR ap.permission = '*')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_admin_permission IS 'Check if a user has a specific permission (supports wildcard)';

-- Function to get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS TABLE(permission TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ap.permission
  FROM profiles p
  JOIN admin_permissions ap ON ap.role = p.role
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for a user based on their role';

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS admin_role AS $$
DECLARE
  user_role admin_role;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  RETURN COALESCE(user_role, 'user'::admin_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_role IS 'Get the admin role for a user';

-- =============================================================================
-- RLS Policies for Admin Tables
-- =============================================================================

-- Enable RLS on audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view audit log (with audit:view permission)
CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (has_admin_permission(auth.uid(), 'audit:view'));

-- No direct insert/update/delete - only through functions
CREATE POLICY "No direct audit log writes"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Function to insert audit log (for server use via service role)
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata, ip_address, user_agent)
  VALUES (p_admin_id, p_action, p_target_type, p_target_id, p_metadata, p_ip_address, p_user_agent)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_admin_action IS 'Log an admin action to the audit log (service role only)';

-- =============================================================================
-- RLS for Admin Permissions (Read Only for All)
-- =============================================================================

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone can read permissions (needed for client-side checks)
CREATE POLICY "Permissions are readable"
  ON admin_permissions FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- Update Profiles RLS for Admin Access
-- =============================================================================

-- Drop existing SELECT policy and replace with admin-aware version
DROP POLICY IF EXISTS "Public profiles readable" ON profiles;

-- New policy: users can see public profiles, their own, or admins can see all
CREATE POLICY "Profiles readable by owner or admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR id = auth.uid()
    OR has_admin_permission(auth.uid(), 'users:view')
  );

-- Drop existing UPDATE policy and replace with admin-aware version
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- New policy: users can update own, super_admins can update any
CREATE POLICY "Profiles updatable by owner or super admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR has_admin_permission(auth.uid(), '*')
  )
  WITH CHECK (
    id = auth.uid()
    OR has_admin_permission(auth.uid(), '*')
  );

-- =============================================================================
-- Seed Initial Super Admin (Optional - Update with your user ID)
-- =============================================================================

-- To make a user super_admin, run:
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
-- OR
-- UPDATE profiles SET role = 'super_admin' WHERE id = 'your-user-uuid';

-- Create a function to promote to admin (callable by super_admins)
CREATE OR REPLACE FUNCTION promote_to_admin(target_user_id UUID, new_role admin_role)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only super_admin can promote
  IF NOT has_admin_permission(auth.uid(), '*') THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can change roles';
  END IF;

  -- Cannot demote yourself from super_admin
  IF target_user_id = auth.uid() AND new_role != 'super_admin' THEN
    RAISE EXCEPTION 'Cannot demote yourself from super_admin';
  END IF;

  UPDATE profiles SET role = new_role WHERE id = target_user_id;

  -- Log the action
  PERFORM log_admin_action(
    auth.uid(),
    'user_role_changed',
    'user',
    target_user_id::TEXT,
    jsonb_build_object('new_role', new_role::TEXT)
  );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION promote_to_admin IS 'Promote a user to an admin role (super_admin only)';
