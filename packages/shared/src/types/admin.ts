/**
 * Admin Types
 *
 * RBAC (Role-Based Access Control) types for admin functionality.
 * Matches database schema in supabase/migrations/YYYYMMDD_admin_rbac.sql
 */

// =============================================================================
// Role Types
// =============================================================================

/**
 * Admin role hierarchy (ascending privileges):
 * - user: Regular user, no admin access
 * - moderator: Can view/close rooms, moderate chat
 * - admin: Full room management, user management
 * - super_admin: All permissions, can manage other admins
 */
export type AdminRole = 'user' | 'moderator' | 'admin' | 'super_admin';

/** Role hierarchy for permission checking */
export const ADMIN_ROLE_HIERARCHY: readonly AdminRole[] = [
	'user',
	'moderator',
	'admin',
	'super_admin',
] as const;

/**
 * Check if role A has at least the privileges of role B
 */
export function hasRolePrivilege(userRole: AdminRole, requiredRole: AdminRole): boolean {
	return ADMIN_ROLE_HIERARCHY.indexOf(userRole) >= ADMIN_ROLE_HIERARCHY.indexOf(requiredRole);
}

// =============================================================================
// Permission Types
// =============================================================================

/**
 * Granular permission strings
 */
export const ADMIN_PERMISSIONS = {
	// Room permissions
	ROOMS_VIEW: 'rooms:view',
	ROOMS_CLOSE: 'rooms:close',
	ROOMS_CLEAR_ALL: 'rooms:clear_all',

	// Chat permissions
	CHAT_MODERATE: 'chat:moderate',
	CHAT_DELETE: 'chat:delete',

	// User permissions
	USERS_VIEW: 'users:view',
	USERS_BAN: 'users:ban',
	USERS_MANAGE_ROLES: 'users:manage_roles',

	// System permissions
	AUDIT_VIEW: 'audit:view',
	SETTINGS_MANAGE: 'settings:manage',

	// Wildcard (super_admin only)
	ALL: '*',
} as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];
export type AdminPermissionKey = keyof typeof ADMIN_PERMISSIONS;

/**
 * Permission record from database
 */
export interface AdminPermissionRecord {
	id: string;
	role: AdminRole;
	permission: AdminPermission;
	createdAt: string;
}

/**
 * Default permissions per role (matches database seed)
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
	user: [],
	moderator: [
		ADMIN_PERMISSIONS.ROOMS_VIEW,
		ADMIN_PERMISSIONS.ROOMS_CLOSE,
		ADMIN_PERMISSIONS.CHAT_MODERATE,
	],
	admin: [
		ADMIN_PERMISSIONS.ROOMS_VIEW,
		ADMIN_PERMISSIONS.ROOMS_CLOSE,
		ADMIN_PERMISSIONS.ROOMS_CLEAR_ALL,
		ADMIN_PERMISSIONS.CHAT_MODERATE,
		ADMIN_PERMISSIONS.CHAT_DELETE,
		ADMIN_PERMISSIONS.USERS_VIEW,
		ADMIN_PERMISSIONS.USERS_BAN,
		ADMIN_PERMISSIONS.AUDIT_VIEW,
	],
	super_admin: [ADMIN_PERMISSIONS.ALL],
} as const;

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
	const rolePerms = DEFAULT_ROLE_PERMISSIONS[role];
	return rolePerms.includes(ADMIN_PERMISSIONS.ALL) || rolePerms.includes(permission);
}

// =============================================================================
// Audit Log Types
// =============================================================================

/**
 * Admin action types for audit logging
 */
export type AdminAction =
	| 'room_closed'
	| 'rooms_cleared'
	| 'chat_message_deleted'
	| 'user_banned'
	| 'user_unbanned'
	| 'user_role_changed'
	| 'settings_updated'
	| 'login'
	| 'logout';

/**
 * Audit log entry
 */
export interface AdminAuditEntry {
	/** Unique entry ID */
	id: string;
	/** Admin user ID who performed the action */
	adminId: string;
	/** Admin display name at time of action */
	adminName?: string;
	/** Action performed */
	action: AdminAction;
	/** Type of target (room, user, chat, etc.) */
	targetType?: string;
	/** Target identifier (room code, user ID, etc.) */
	targetId?: string;
	/** Additional context/details */
	metadata: Record<string, unknown>;
	/** When the action was performed */
	createdAt: string;
}

/**
 * Create an audit entry (helper for server use)
 */
export function createAuditEntry(
	adminId: string,
	action: AdminAction,
	target?: { type: string; id: string },
	metadata?: Record<string, unknown>
): Omit<AdminAuditEntry, 'id' | 'createdAt'> {
	return {
		adminId,
		action,
		targetType: target?.type,
		targetId: target?.id,
		metadata: metadata ?? {},
	};
}

// =============================================================================
// Admin Info Types
// =============================================================================

/**
 * Admin info extracted from verified JWT
 */
export interface AdminInfo {
	userId: string;
	email?: string;
	displayName?: string;
	role: AdminRole;
	permissions: AdminPermission[];
}

/**
 * Admin profile (extends user profile with admin fields)
 */
export interface AdminProfile {
	id: string;
	displayName: string;
	email?: string;
	avatarSeed: string;
	role: AdminRole;
	createdAt: string;
	updatedAt: string;
}

// =============================================================================
// Admin API Types
// =============================================================================

/**
 * Admin API error response
 */
export interface AdminErrorResponse {
	error: string;
	code: string;
	details?: Record<string, unknown>;
}

/**
 * Admin API success response
 */
export interface AdminSuccessResponse<T = unknown> {
	success: true;
	data?: T;
	message?: string;
}

/**
 * Admin room management response
 */
export interface AdminRoomsResponse {
	rooms: Array<{
		code: string;
		hostId: string;
		hostName: string;
		playerCount: number;
		maxPlayers: number;
		status: string;
		createdAt: number;
	}>;
	count: number;
	timestamp: string;
}

/**
 * Admin connections response
 */
export interface AdminConnectionsResponse {
	connections: Array<{
		userId: string;
		displayName: string;
		connectedAt: number;
		currentRoomCode: string | null;
		readyState: 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';
	}>;
	count: number;
	timestamp: string;
}

/**
 * Admin audit log response
 */
export interface AdminAuditLogResponse {
	entries: AdminAuditEntry[];
	total: number;
	page: number;
	pageSize: number;
}
