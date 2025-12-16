/**
 * Join Request State Machine
 *
 * Pure functions for managing join request lifecycle.
 * Join requests allow users to request entry to a room, requiring host approval.
 *
 * Design principles:
 * - Pure functions for testability
 * - Explicit state transitions
 * - Result pattern for error handling
 * - Repository pattern for storage abstraction
 *
 * Flow:
 * 1. User sends REQUEST_JOIN from lobby
 * 2. GlobalLobby routes to GameRoom via RPC
 * 3. GameRoom creates request, notifies host
 * 4. Host approves/declines via JOIN_REQUEST_RESPONSE
 * 5. GameRoom notifies GlobalLobby to deliver result to requester
 */

import { err, ok, type Result } from '@dicee/shared';

// =============================================================================
// Constants
// =============================================================================

/** Time-to-live for join requests (2 minutes) */
export const JOIN_REQUEST_TTL_MS = 2 * 60 * 1000;

/** Maximum pending requests per user (across all rooms) */
export const MAX_PENDING_REQUESTS_PER_USER = 1;

/** Maximum pending requests per room (waiting for host) */
export const MAX_PENDING_REQUESTS_PER_ROOM = 10;

// =============================================================================
// Types
// =============================================================================

/**
 * Join request status values
 */
export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'expired' | 'cancelled';

/**
 * Join request entity
 */
export interface JoinRequest {
	/** Unique request ID */
	readonly id: string;
	/** Room code being requested to join */
	readonly roomCode: string;
	/** User ID of the requester */
	readonly requesterId: string;
	/** Requester's display name at time of request */
	readonly requesterDisplayName: string;
	/** Requester's avatar seed */
	readonly requesterAvatarSeed: string;
	/** When the request was created (Unix ms) */
	readonly createdAt: number;
	/** When the request expires (Unix ms) */
	readonly expiresAt: number;
	/** Current status of the request */
	readonly status: JoinRequestStatus;
}

/**
 * Input for creating a join request (without generated fields)
 */
export interface JoinRequestInput {
	readonly roomCode: string;
	readonly requesterId: string;
	readonly requesterDisplayName: string;
	readonly requesterAvatarSeed: string;
}

/**
 * Error codes for join request operations
 */
export type JoinRequestErrorCode =
	| 'DUPLICATE_REQUEST'
	| 'REQUEST_NOT_FOUND'
	| 'INVALID_STATUS_TRANSITION'
	| 'REQUEST_EXPIRED'
	| 'NOT_REQUESTER'
	| 'ROOM_FULL'
	| 'ROOM_NOT_ACCEPTING'
	| 'MAX_REQUESTS_EXCEEDED';

/**
 * Result of checking if request has expired
 */
export interface ExpirationCheckResult {
	readonly expired: boolean;
	readonly remainingMs: number;
}

// =============================================================================
// Pure Functions - Validation
// =============================================================================

/**
 * Check if a join request has expired
 *
 * @param request - The request to check
 * @param now - Current timestamp (injectable for testing)
 * @returns Expiration check result
 */
export function isExpired(request: JoinRequest, now: number = Date.now()): ExpirationCheckResult {
	if (now >= request.expiresAt) {
		return { expired: true, remainingMs: 0 };
	}
	return { expired: false, remainingMs: request.expiresAt - now };
}

/**
 * Check if a status transition is valid
 *
 * Valid transitions:
 * - pending → approved
 * - pending → declined
 * - pending → expired
 * - pending → cancelled
 *
 * @param currentStatus - Current status
 * @param newStatus - Proposed new status
 * @returns Whether the transition is valid
 */
export function isValidTransition(
	currentStatus: JoinRequestStatus,
	newStatus: JoinRequestStatus,
): boolean {
	// Only pending requests can transition
	if (currentStatus !== 'pending') {
		return false;
	}

	// Valid target states from pending
	const validTargets: JoinRequestStatus[] = ['approved', 'declined', 'expired', 'cancelled'];
	return validTargets.includes(newStatus);
}

/**
 * Check if a user already has a pending request
 *
 * @param requests - All requests to check
 * @param requesterId - User ID to check for
 * @returns The existing pending request, or undefined
 */
export function findPendingRequestByUser(
	requests: readonly JoinRequest[],
	requesterId: string,
): JoinRequest | undefined {
	return requests.find((r) => r.requesterId === requesterId && r.status === 'pending');
}

/**
 * Count pending requests for a room
 *
 * @param requests - All requests
 * @returns Number of pending requests
 */
export function countPendingRequests(requests: readonly JoinRequest[]): number {
	return requests.filter((r) => r.status === 'pending').length;
}

// =============================================================================
// Pure Functions - State Transitions
// =============================================================================

/**
 * Create a new join request
 *
 * @param input - Request input data
 * @param now - Current timestamp (injectable for testing)
 * @returns New join request entity
 */
export function createJoinRequest(input: JoinRequestInput, now: number = Date.now()): JoinRequest {
	return {
		id: crypto.randomUUID(),
		roomCode: input.roomCode,
		requesterId: input.requesterId,
		requesterDisplayName: input.requesterDisplayName,
		requesterAvatarSeed: input.requesterAvatarSeed,
		createdAt: now,
		expiresAt: now + JOIN_REQUEST_TTL_MS,
		status: 'pending',
	};
}

/**
 * Transition a request to a new status
 *
 * @param request - Current request
 * @param newStatus - Target status
 * @param now - Current timestamp (injectable for testing)
 * @returns Result with updated request or error
 */
export function transitionRequest(
	request: JoinRequest,
	newStatus: JoinRequestStatus,
	now: number = Date.now(),
): Result<JoinRequest, JoinRequestErrorCode> {
	// Check if already expired (unless we're marking it as expired)
	if (newStatus !== 'expired') {
		const expirationCheck = isExpired(request, now);
		if (expirationCheck.expired) {
			return err('REQUEST_EXPIRED', 'Request has expired');
		}
	}

	// Check valid transition
	if (!isValidTransition(request.status, newStatus)) {
		return err(
			'INVALID_STATUS_TRANSITION',
			`Cannot transition from '${request.status}' to '${newStatus}'`,
		);
	}

	return ok({
		...request,
		status: newStatus,
	});
}

/**
 * Process an approval for a join request
 *
 * @param request - Request to approve
 * @param now - Current timestamp
 * @returns Result with approved request or error
 */
export function approveRequest(
	request: JoinRequest,
	now: number = Date.now(),
): Result<JoinRequest, JoinRequestErrorCode> {
	return transitionRequest(request, 'approved', now);
}

/**
 * Process a decline for a join request
 *
 * @param request - Request to decline
 * @param now - Current timestamp
 * @returns Result with declined request or error
 */
export function declineRequest(
	request: JoinRequest,
	now: number = Date.now(),
): Result<JoinRequest, JoinRequestErrorCode> {
	return transitionRequest(request, 'declined', now);
}

/**
 * Process a cancellation by the requester
 *
 * @param request - Request to cancel
 * @param requesterId - ID of user attempting to cancel
 * @param now - Current timestamp
 * @returns Result with cancelled request or error
 */
export function cancelRequest(
	request: JoinRequest,
	requesterId: string,
	now: number = Date.now(),
): Result<JoinRequest, JoinRequestErrorCode> {
	// Verify ownership
	if (request.requesterId !== requesterId) {
		return err('NOT_REQUESTER', 'Only the requester can cancel their request');
	}

	return transitionRequest(request, 'cancelled', now);
}

/**
 * Mark a request as expired
 *
 * @param request - Request to expire
 * @returns Result with expired request or error
 */
export function expireRequest(request: JoinRequest): Result<JoinRequest, JoinRequestErrorCode> {
	// For expiration, we allow transition even if already "technically" expired
	// since we want to update the status
	if (!isValidTransition(request.status, 'expired')) {
		return err(
			'INVALID_STATUS_TRANSITION',
			`Cannot expire request with status '${request.status}'`,
		);
	}

	return ok({
		...request,
		status: 'expired',
	});
}

// =============================================================================
// Manager (In-Memory State Container)
// =============================================================================

/**
 * Create a join request manager for use in GameRoom
 * Manages in-memory state for pending requests
 */
export function createJoinRequestManager() {
	const requests = new Map<string, JoinRequest>();

	return {
		/**
		 * Get a request by ID
		 */
		getRequest(requestId: string): JoinRequest | undefined {
			return requests.get(requestId);
		},

		/**
		 * Get all requests
		 */
		getAllRequests(): JoinRequest[] {
			return Array.from(requests.values());
		},

		/**
		 * Get all pending requests
		 */
		getPendingRequests(): JoinRequest[] {
			return Array.from(requests.values()).filter((r) => r.status === 'pending');
		},

		/**
		 * Find pending request by requester ID
		 */
		findPendingByRequester(requesterId: string): JoinRequest | undefined {
			return findPendingRequestByUser(Array.from(requests.values()), requesterId);
		},

		/**
		 * Add a new join request
		 *
		 * @param input - Request input data
		 * @param now - Current timestamp
		 * @returns Result with created request or error
		 */
		addRequest(
			input: JoinRequestInput,
			now: number = Date.now(),
		): Result<JoinRequest, JoinRequestErrorCode> {
			// Check for duplicate pending request from this user
			const existing = this.findPendingByRequester(input.requesterId);
			if (existing) {
				return err('DUPLICATE_REQUEST', 'User already has a pending join request');
			}

			// Check room capacity
			const pendingCount = countPendingRequests(Array.from(requests.values()));
			if (pendingCount >= MAX_PENDING_REQUESTS_PER_ROOM) {
				return err('MAX_REQUESTS_EXCEEDED', 'Room has too many pending requests');
			}

			const request = createJoinRequest(input, now);
			requests.set(request.id, request);
			return ok(request);
		},

		/**
		 * Approve a join request
		 */
		approve(
			requestId: string,
			now: number = Date.now(),
		): Result<JoinRequest, JoinRequestErrorCode> {
			const request = requests.get(requestId);
			if (!request) {
				return err('REQUEST_NOT_FOUND', 'Join request not found');
			}

			const result = approveRequest(request, now);
			if (result.success) {
				requests.set(requestId, result.value);
			}
			return result;
		},

		/**
		 * Decline a join request
		 */
		decline(
			requestId: string,
			now: number = Date.now(),
		): Result<JoinRequest, JoinRequestErrorCode> {
			const request = requests.get(requestId);
			if (!request) {
				return err('REQUEST_NOT_FOUND', 'Join request not found');
			}

			const result = declineRequest(request, now);
			if (result.success) {
				requests.set(requestId, result.value);
			}
			return result;
		},

		/**
		 * Cancel a join request (by requester)
		 */
		cancel(
			requestId: string,
			requesterId: string,
			now: number = Date.now(),
		): Result<JoinRequest, JoinRequestErrorCode> {
			const request = requests.get(requestId);
			if (!request) {
				return err('REQUEST_NOT_FOUND', 'Join request not found');
			}

			const result = cancelRequest(request, requesterId, now);
			if (result.success) {
				requests.set(requestId, result.value);
			}
			return result;
		},

		/**
		 * Expire a join request
		 */
		expire(requestId: string): Result<JoinRequest, JoinRequestErrorCode> {
			const request = requests.get(requestId);
			if (!request) {
				return err('REQUEST_NOT_FOUND', 'Join request not found');
			}

			const result = expireRequest(request);
			if (result.success) {
				requests.set(requestId, result.value);
			}
			return result;
		},

		/**
		 * Find and expire all requests that have passed their TTL
		 *
		 * @param now - Current timestamp
		 * @returns Array of expired request IDs
		 */
		expireStale(now: number = Date.now()): string[] {
			const expiredIds: string[] = [];

			for (const request of requests.values()) {
				if (request.status === 'pending' && isExpired(request, now).expired) {
					const result = expireRequest(request);
					if (result.success) {
						requests.set(request.id, result.value);
						expiredIds.push(request.id);
					}
				}
			}

			return expiredIds;
		},

		/**
		 * Remove a request from the manager (cleanup after processing)
		 */
		remove(requestId: string): boolean {
			return requests.delete(requestId);
		},

		/**
		 * Clear all requests (for testing)
		 */
		clear(): void {
			requests.clear();
		},

		/**
		 * Get total request count (for testing/debugging)
		 */
		get size(): number {
			return requests.size;
		},
	};
}

export type JoinRequestManager = ReturnType<typeof createJoinRequestManager>;
