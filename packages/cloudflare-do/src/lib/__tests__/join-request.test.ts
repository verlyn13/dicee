/**
 * Join Request State Machine Tests
 *
 * Comprehensive tests for join request lifecycle management.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	approveRequest,
	cancelRequest,
	countPendingRequests,
	createJoinRequest,
	// Manager
	createJoinRequestManager,
	declineRequest,
	expireRequest,
	findPendingRequestByUser,
	// Pure functions
	isExpired,
	isValidTransition,
	// Constants
	JOIN_REQUEST_TTL_MS,
	// Types
	type JoinRequest,
	type JoinRequestInput,
	type JoinRequestStatus,
	MAX_PENDING_REQUESTS_PER_ROOM,
	MAX_PENDING_REQUESTS_PER_USER,
	transitionRequest,
} from '../join-request';

// =============================================================================
// Test Fixtures
// =============================================================================

const NOW = 1700000000000; // Fixed timestamp for deterministic tests

function createTestInput(overrides: Partial<JoinRequestInput> = {}): JoinRequestInput {
	return {
		roomCode: 'ABC123',
		requesterId: 'user-123',
		requesterDisplayName: 'TestPlayer',
		requesterAvatarSeed: 'seed-123',
		...overrides,
	};
}

function createTestRequest(overrides: Partial<JoinRequest> = {}): JoinRequest {
	return {
		id: 'request-123',
		roomCode: 'ABC123',
		requesterId: 'user-123',
		requesterDisplayName: 'TestPlayer',
		requesterAvatarSeed: 'seed-123',
		createdAt: NOW,
		expiresAt: NOW + JOIN_REQUEST_TTL_MS,
		status: 'pending',
		...overrides,
	};
}

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
	it('should have correct TTL (2 minutes)', () => {
		expect(JOIN_REQUEST_TTL_MS).toBe(2 * 60 * 1000);
	});

	it('should limit to 1 pending request per user', () => {
		expect(MAX_PENDING_REQUESTS_PER_USER).toBe(1);
	});

	it('should limit pending requests per room', () => {
		expect(MAX_PENDING_REQUESTS_PER_ROOM).toBe(10);
	});
});

// =============================================================================
// isExpired Tests
// =============================================================================

describe('isExpired', () => {
	it('should return not expired for fresh request', () => {
		const request = createTestRequest({ expiresAt: NOW + 60000 });
		const result = isExpired(request, NOW);

		expect(result.expired).toBe(false);
		expect(result.remainingMs).toBe(60000);
	});

	it('should return expired at exact expiration time', () => {
		const request = createTestRequest({ expiresAt: NOW });
		const result = isExpired(request, NOW);

		expect(result.expired).toBe(true);
		expect(result.remainingMs).toBe(0);
	});

	it('should return expired after expiration time', () => {
		const request = createTestRequest({ expiresAt: NOW - 1000 });
		const result = isExpired(request, NOW);

		expect(result.expired).toBe(true);
		expect(result.remainingMs).toBe(0);
	});

	it('should calculate correct remaining time', () => {
		const request = createTestRequest({ expiresAt: NOW + 30000 });
		const result = isExpired(request, NOW);

		expect(result.expired).toBe(false);
		expect(result.remainingMs).toBe(30000);
	});

	it('should use Date.now() when no timestamp provided', () => {
		const futureExpiry = Date.now() + 60000;
		const request = createTestRequest({ expiresAt: futureExpiry });
		const result = isExpired(request);

		expect(result.expired).toBe(false);
		expect(result.remainingMs).toBeGreaterThan(0);
		expect(result.remainingMs).toBeLessThanOrEqual(60000);
	});
});

// =============================================================================
// isValidTransition Tests
// =============================================================================

describe('isValidTransition', () => {
	describe('from pending', () => {
		it('should allow transition to approved', () => {
			expect(isValidTransition('pending', 'approved')).toBe(true);
		});

		it('should allow transition to declined', () => {
			expect(isValidTransition('pending', 'declined')).toBe(true);
		});

		it('should allow transition to expired', () => {
			expect(isValidTransition('pending', 'expired')).toBe(true);
		});

		it('should allow transition to cancelled', () => {
			expect(isValidTransition('pending', 'cancelled')).toBe(true);
		});

		it('should not allow transition to pending', () => {
			expect(isValidTransition('pending', 'pending')).toBe(false);
		});
	});

	describe('from terminal states', () => {
		const terminalStates: JoinRequestStatus[] = ['approved', 'declined', 'expired', 'cancelled'];
		const allStatuses: JoinRequestStatus[] = ['pending', ...terminalStates];

		terminalStates.forEach((fromStatus) => {
			allStatuses.forEach((toStatus) => {
				it(`should not allow transition from ${fromStatus} to ${toStatus}`, () => {
					expect(isValidTransition(fromStatus, toStatus)).toBe(false);
				});
			});
		});
	});
});

// =============================================================================
// findPendingRequestByUser Tests
// =============================================================================

describe('findPendingRequestByUser', () => {
	it('should return undefined for empty array', () => {
		const result = findPendingRequestByUser([], 'user-123');
		expect(result).toBeUndefined();
	});

	it('should find pending request by user', () => {
		const requests = [
			createTestRequest({ id: 'req-1', requesterId: 'user-123', status: 'pending' }),
			createTestRequest({ id: 'req-2', requesterId: 'user-456', status: 'pending' }),
		];

		const result = findPendingRequestByUser(requests, 'user-123');
		expect(result?.id).toBe('req-1');
	});

	it('should not find non-pending requests', () => {
		const requests = [
			createTestRequest({ id: 'req-1', requesterId: 'user-123', status: 'approved' }),
			createTestRequest({ id: 'req-2', requesterId: 'user-123', status: 'declined' }),
		];

		const result = findPendingRequestByUser(requests, 'user-123');
		expect(result).toBeUndefined();
	});

	it('should not find requests from other users', () => {
		const requests = [
			createTestRequest({ id: 'req-1', requesterId: 'user-456', status: 'pending' }),
		];

		const result = findPendingRequestByUser(requests, 'user-123');
		expect(result).toBeUndefined();
	});

	it('should return first pending request if multiple exist', () => {
		const requests = [
			createTestRequest({ id: 'req-1', requesterId: 'user-123', status: 'expired' }),
			createTestRequest({ id: 'req-2', requesterId: 'user-123', status: 'pending' }),
			createTestRequest({ id: 'req-3', requesterId: 'user-123', status: 'pending' }),
		];

		const result = findPendingRequestByUser(requests, 'user-123');
		expect(result?.id).toBe('req-2');
	});
});

// =============================================================================
// countPendingRequests Tests
// =============================================================================

describe('countPendingRequests', () => {
	it('should return 0 for empty array', () => {
		expect(countPendingRequests([])).toBe(0);
	});

	it('should count only pending requests', () => {
		const requests = [
			createTestRequest({ id: 'req-1', status: 'pending' }),
			createTestRequest({ id: 'req-2', status: 'pending' }),
			createTestRequest({ id: 'req-3', status: 'approved' }),
			createTestRequest({ id: 'req-4', status: 'declined' }),
			createTestRequest({ id: 'req-5', status: 'expired' }),
		];

		expect(countPendingRequests(requests)).toBe(2);
	});

	it('should return 0 when no pending requests', () => {
		const requests = [
			createTestRequest({ status: 'approved' }),
			createTestRequest({ status: 'declined' }),
		];

		expect(countPendingRequests(requests)).toBe(0);
	});
});

// =============================================================================
// createJoinRequest Tests
// =============================================================================

describe('createJoinRequest', () => {
	it('should create request with all input fields', () => {
		const input = createTestInput();
		const request = createJoinRequest(input, NOW);

		expect(request.roomCode).toBe(input.roomCode);
		expect(request.requesterId).toBe(input.requesterId);
		expect(request.requesterDisplayName).toBe(input.requesterDisplayName);
		expect(request.requesterAvatarSeed).toBe(input.requesterAvatarSeed);
	});

	it('should generate unique ID', () => {
		const input = createTestInput();
		const request1 = createJoinRequest(input, NOW);
		const request2 = createJoinRequest(input, NOW);

		expect(request1.id).not.toBe(request2.id);
		expect(request1.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('should set createdAt to provided timestamp', () => {
		const input = createTestInput();
		const request = createJoinRequest(input, NOW);

		expect(request.createdAt).toBe(NOW);
	});

	it('should set expiresAt with correct TTL', () => {
		const input = createTestInput();
		const request = createJoinRequest(input, NOW);

		expect(request.expiresAt).toBe(NOW + JOIN_REQUEST_TTL_MS);
	});

	it('should initialize status as pending', () => {
		const input = createTestInput();
		const request = createJoinRequest(input, NOW);

		expect(request.status).toBe('pending');
	});

	it('should use Date.now() when no timestamp provided', () => {
		const before = Date.now();
		const input = createTestInput();
		const request = createJoinRequest(input);
		const after = Date.now();

		expect(request.createdAt).toBeGreaterThanOrEqual(before);
		expect(request.createdAt).toBeLessThanOrEqual(after);
	});
});

// =============================================================================
// transitionRequest Tests
// =============================================================================

describe('transitionRequest', () => {
	it('should successfully transition pending to approved', () => {
		const request = createTestRequest({ status: 'pending' });
		const result = transitionRequest(request, 'approved', NOW);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.status).toBe('approved');
			expect(result.value.id).toBe(request.id);
		}
	});

	it('should fail when request is expired', () => {
		const request = createTestRequest({
			status: 'pending',
			expiresAt: NOW - 1000,
		});
		const result = transitionRequest(request, 'approved', NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('REQUEST_EXPIRED');
		}
	});

	it('should allow expiring an already-expired request', () => {
		const request = createTestRequest({
			status: 'pending',
			expiresAt: NOW - 1000,
		});
		const result = transitionRequest(request, 'expired', NOW);

		expect(result.success).toBe(true);
	});

	it('should fail for invalid transition', () => {
		const request = createTestRequest({ status: 'approved' });
		const result = transitionRequest(request, 'declined', NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('INVALID_STATUS_TRANSITION');
		}
	});

	it('should preserve all other fields', () => {
		const request = createTestRequest();
		const result = transitionRequest(request, 'approved', NOW);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.id).toBe(request.id);
			expect(result.value.roomCode).toBe(request.roomCode);
			expect(result.value.requesterId).toBe(request.requesterId);
			expect(result.value.requesterDisplayName).toBe(request.requesterDisplayName);
			expect(result.value.requesterAvatarSeed).toBe(request.requesterAvatarSeed);
			expect(result.value.createdAt).toBe(request.createdAt);
			expect(result.value.expiresAt).toBe(request.expiresAt);
		}
	});
});

// =============================================================================
// approveRequest Tests
// =============================================================================

describe('approveRequest', () => {
	it('should approve pending request', () => {
		const request = createTestRequest({ status: 'pending' });
		const result = approveRequest(request, NOW);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.status).toBe('approved');
		}
	});

	it('should fail for expired request', () => {
		const request = createTestRequest({
			status: 'pending',
			expiresAt: NOW - 1000,
		});
		const result = approveRequest(request, NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('REQUEST_EXPIRED');
		}
	});

	it('should fail for already approved request', () => {
		const request = createTestRequest({ status: 'approved' });
		const result = approveRequest(request, NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('INVALID_STATUS_TRANSITION');
		}
	});
});

// =============================================================================
// declineRequest Tests
// =============================================================================

describe('declineRequest', () => {
	it('should decline pending request', () => {
		const request = createTestRequest({ status: 'pending' });
		const result = declineRequest(request, NOW);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.status).toBe('declined');
		}
	});

	it('should fail for expired request', () => {
		const request = createTestRequest({
			status: 'pending',
			expiresAt: NOW - 1000,
		});
		const result = declineRequest(request, NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('REQUEST_EXPIRED');
		}
	});

	it('should fail for already declined request', () => {
		const request = createTestRequest({ status: 'declined' });
		const result = declineRequest(request, NOW);

		expect(result.success).toBe(false);
	});
});

// =============================================================================
// cancelRequest Tests
// =============================================================================

describe('cancelRequest', () => {
	it('should cancel pending request by owner', () => {
		const request = createTestRequest({
			status: 'pending',
			requesterId: 'user-123',
		});
		const result = cancelRequest(request, 'user-123', NOW);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.status).toBe('cancelled');
		}
	});

	it('should fail if not the requester', () => {
		const request = createTestRequest({
			status: 'pending',
			requesterId: 'user-123',
		});
		const result = cancelRequest(request, 'user-456', NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('NOT_REQUESTER');
		}
	});

	it('should fail for expired request', () => {
		const request = createTestRequest({
			status: 'pending',
			requesterId: 'user-123',
			expiresAt: NOW - 1000,
		});
		const result = cancelRequest(request, 'user-123', NOW);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('REQUEST_EXPIRED');
		}
	});

	it('should fail for already cancelled request', () => {
		const request = createTestRequest({
			status: 'cancelled',
			requesterId: 'user-123',
		});
		const result = cancelRequest(request, 'user-123', NOW);

		expect(result.success).toBe(false);
	});
});

// =============================================================================
// expireRequest Tests
// =============================================================================

describe('expireRequest', () => {
	it('should expire pending request', () => {
		const request = createTestRequest({ status: 'pending' });
		const result = expireRequest(request);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.status).toBe('expired');
		}
	});

	it('should fail for already expired request', () => {
		const request = createTestRequest({ status: 'expired' });
		const result = expireRequest(request);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe('INVALID_STATUS_TRANSITION');
		}
	});

	it('should fail for approved request', () => {
		const request = createTestRequest({ status: 'approved' });
		const result = expireRequest(request);

		expect(result.success).toBe(false);
	});
});

// =============================================================================
// JoinRequestManager Tests
// =============================================================================

describe('createJoinRequestManager', () => {
	let manager: ReturnType<typeof createJoinRequestManager>;

	beforeEach(() => {
		manager = createJoinRequestManager();
	});

	describe('initial state', () => {
		it('should start empty', () => {
			expect(manager.size).toBe(0);
			expect(manager.getAllRequests()).toEqual([]);
			expect(manager.getPendingRequests()).toEqual([]);
		});
	});

	describe('addRequest', () => {
		it('should add a new request', () => {
			const input = createTestInput();
			const result = manager.addRequest(input, NOW);

			expect(result.success).toBe(true);
			expect(manager.size).toBe(1);
		});

		it('should return the created request', () => {
			const input = createTestInput();
			const result = manager.addRequest(input, NOW);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.roomCode).toBe(input.roomCode);
				expect(result.value.requesterId).toBe(input.requesterId);
				expect(result.value.status).toBe('pending');
			}
		});

		it('should reject duplicate pending request from same user', () => {
			const input = createTestInput({ requesterId: 'user-123' });

			const first = manager.addRequest(input, NOW);
			expect(first.success).toBe(true);

			const second = manager.addRequest(input, NOW);
			expect(second.success).toBe(false);
			if (!second.success) {
				expect(second.error.code).toBe('DUPLICATE_REQUEST');
			}
		});

		it('should allow request after previous is resolved', () => {
			const input = createTestInput({ requesterId: 'user-123' });

			const first = manager.addRequest(input, NOW);
			expect(first.success).toBe(true);
			if (first.success) {
				manager.approve(first.value.id, NOW);
			}

			const second = manager.addRequest(input, NOW + 1000);
			expect(second.success).toBe(true);
		});

		it('should reject when room has max pending requests', () => {
			// Fill up to max
			for (let i = 0; i < MAX_PENDING_REQUESTS_PER_ROOM; i++) {
				const input = createTestInput({ requesterId: `user-${i}` });
				const result = manager.addRequest(input, NOW);
				expect(result.success).toBe(true);
			}

			// Try to add one more
			const overflow = createTestInput({ requesterId: 'user-overflow' });
			const result = manager.addRequest(overflow, NOW);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('MAX_REQUESTS_EXCEEDED');
			}
		});
	});

	describe('getRequest', () => {
		it('should return request by ID', () => {
			const input = createTestInput();
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const request = manager.getRequest(addResult.value.id);
				expect(request).toBeDefined();
				expect(request?.id).toBe(addResult.value.id);
			}
		});

		it('should return undefined for unknown ID', () => {
			const request = manager.getRequest('unknown-id');
			expect(request).toBeUndefined();
		});
	});

	describe('findPendingByRequester', () => {
		it('should find pending request by requester', () => {
			const input = createTestInput({ requesterId: 'user-123' });
			manager.addRequest(input, NOW);

			const found = manager.findPendingByRequester('user-123');
			expect(found).toBeDefined();
			expect(found?.requesterId).toBe('user-123');
		});

		it('should not find resolved requests', () => {
			const input = createTestInput({ requesterId: 'user-123' });
			const result = manager.addRequest(input, NOW);

			if (result.success) {
				manager.approve(result.value.id, NOW);
			}

			const found = manager.findPendingByRequester('user-123');
			expect(found).toBeUndefined();
		});
	});

	describe('approve', () => {
		it('should approve pending request', () => {
			const input = createTestInput();
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const approveResult = manager.approve(addResult.value.id, NOW);

				expect(approveResult.success).toBe(true);
				if (approveResult.success) {
					expect(approveResult.value.status).toBe('approved');
				}

				// Verify state was updated
				const request = manager.getRequest(addResult.value.id);
				expect(request?.status).toBe('approved');
			}
		});

		it('should fail for unknown request', () => {
			const result = manager.approve('unknown-id', NOW);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('REQUEST_NOT_FOUND');
			}
		});
	});

	describe('decline', () => {
		it('should decline pending request', () => {
			const input = createTestInput();
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const declineResult = manager.decline(addResult.value.id, NOW);

				expect(declineResult.success).toBe(true);
				if (declineResult.success) {
					expect(declineResult.value.status).toBe('declined');
				}
			}
		});

		it('should fail for unknown request', () => {
			const result = manager.decline('unknown-id', NOW);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('REQUEST_NOT_FOUND');
			}
		});
	});

	describe('cancel', () => {
		it('should cancel request by owner', () => {
			const input = createTestInput({ requesterId: 'user-123' });
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const cancelResult = manager.cancel(addResult.value.id, 'user-123', NOW);

				expect(cancelResult.success).toBe(true);
				if (cancelResult.success) {
					expect(cancelResult.value.status).toBe('cancelled');
				}
			}
		});

		it('should fail if not owner', () => {
			const input = createTestInput({ requesterId: 'user-123' });
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const cancelResult = manager.cancel(addResult.value.id, 'user-456', NOW);

				expect(cancelResult.success).toBe(false);
				if (!cancelResult.success) {
					expect(cancelResult.error.code).toBe('NOT_REQUESTER');
				}
			}
		});
	});

	describe('expire', () => {
		it('should expire pending request', () => {
			const input = createTestInput();
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const expireResult = manager.expire(addResult.value.id);

				expect(expireResult.success).toBe(true);
				if (expireResult.success) {
					expect(expireResult.value.status).toBe('expired');
				}
			}
		});
	});

	describe('expireStale', () => {
		it('should expire requests past their TTL', () => {
			const input1 = createTestInput({ requesterId: 'user-1' });
			const input2 = createTestInput({ requesterId: 'user-2' });

			manager.addRequest(input1, NOW);
			manager.addRequest(input2, NOW);

			// Move time forward past TTL
			const futureTime = NOW + JOIN_REQUEST_TTL_MS + 1000;
			const expiredIds = manager.expireStale(futureTime);

			expect(expiredIds.length).toBe(2);
			expect(manager.getPendingRequests().length).toBe(0);
		});

		it('should not expire requests still within TTL', () => {
			const input = createTestInput();
			manager.addRequest(input, NOW);

			// Move time forward but not past TTL
			const futureTime = NOW + JOIN_REQUEST_TTL_MS / 2;
			const expiredIds = manager.expireStale(futureTime);

			expect(expiredIds.length).toBe(0);
			expect(manager.getPendingRequests().length).toBe(1);
		});

		it('should only expire pending requests', () => {
			const input1 = createTestInput({ requesterId: 'user-1' });
			const input2 = createTestInput({ requesterId: 'user-2' });

			const result1 = manager.addRequest(input1, NOW);
			manager.addRequest(input2, NOW);

			// Approve first request
			if (result1.success) {
				manager.approve(result1.value.id, NOW);
			}

			// Move time forward past TTL
			const futureTime = NOW + JOIN_REQUEST_TTL_MS + 1000;
			const expiredIds = manager.expireStale(futureTime);

			// Only the second (still pending) should be expired
			expect(expiredIds.length).toBe(1);
		});

		it('should return array of expired request IDs', () => {
			const input = createTestInput();
			const addResult = manager.addRequest(input, NOW);

			const futureTime = NOW + JOIN_REQUEST_TTL_MS + 1000;
			const expiredIds = manager.expireStale(futureTime);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				expect(expiredIds).toContain(addResult.value.id);
			}
		});
	});

	describe('remove', () => {
		it('should remove request from manager', () => {
			const input = createTestInput();
			const addResult = manager.addRequest(input, NOW);

			expect(addResult.success).toBe(true);
			if (addResult.success) {
				const removed = manager.remove(addResult.value.id);
				expect(removed).toBe(true);
				expect(manager.size).toBe(0);
				expect(manager.getRequest(addResult.value.id)).toBeUndefined();
			}
		});

		it('should return false for unknown ID', () => {
			const removed = manager.remove('unknown-id');
			expect(removed).toBe(false);
		});
	});

	describe('clear', () => {
		it('should remove all requests', () => {
			manager.addRequest(createTestInput({ requesterId: 'user-1' }), NOW);
			manager.addRequest(createTestInput({ requesterId: 'user-2' }), NOW);

			expect(manager.size).toBe(2);

			manager.clear();

			expect(manager.size).toBe(0);
			expect(manager.getAllRequests()).toEqual([]);
		});
	});

	describe('getPendingRequests', () => {
		it('should return only pending requests', () => {
			const input1 = createTestInput({ requesterId: 'user-1' });
			const input2 = createTestInput({ requesterId: 'user-2' });
			const input3 = createTestInput({ requesterId: 'user-3' });

			const result1 = manager.addRequest(input1, NOW);
			const result2 = manager.addRequest(input2, NOW);
			manager.addRequest(input3, NOW);

			if (result1.success) manager.approve(result1.value.id, NOW);
			if (result2.success) manager.decline(result2.value.id, NOW);

			const pending = manager.getPendingRequests();
			expect(pending.length).toBe(1);
			expect(pending[0].requesterId).toBe('user-3');
		});
	});

	describe('getAllRequests', () => {
		it('should return all requests regardless of status', () => {
			const input1 = createTestInput({ requesterId: 'user-1' });
			const input2 = createTestInput({ requesterId: 'user-2' });

			const result1 = manager.addRequest(input1, NOW);
			manager.addRequest(input2, NOW);

			if (result1.success) manager.approve(result1.value.id, NOW);

			const all = manager.getAllRequests();
			expect(all.length).toBe(2);
		});
	});
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Join Request Flow Integration', () => {
	let manager: ReturnType<typeof createJoinRequestManager>;

	beforeEach(() => {
		manager = createJoinRequestManager();
	});

	it('should handle complete approval flow', () => {
		// User requests to join
		const input = createTestInput({
			requesterId: 'requester-123',
			requesterDisplayName: 'Player1',
		});
		const createResult = manager.addRequest(input, NOW);
		expect(createResult.success).toBe(true);

		if (createResult.success) {
			const requestId = createResult.value.id;

			// Verify request appears in pending list
			expect(manager.getPendingRequests().length).toBe(1);

			// Host approves
			const approveResult = manager.approve(requestId, NOW + 5000);
			expect(approveResult.success).toBe(true);

			// Verify no longer pending
			expect(manager.getPendingRequests().length).toBe(0);
			expect(manager.getRequest(requestId)?.status).toBe('approved');
		}
	});

	it('should handle complete decline flow', () => {
		const input = createTestInput({ requesterId: 'requester-123' });
		const createResult = manager.addRequest(input, NOW);

		if (createResult.success) {
			const declineResult = manager.decline(createResult.value.id, NOW + 5000);
			expect(declineResult.success).toBe(true);

			expect(manager.getPendingRequests().length).toBe(0);
			expect(manager.getRequest(createResult.value.id)?.status).toBe('declined');
		}
	});

	it('should handle cancellation by requester', () => {
		const input = createTestInput({ requesterId: 'requester-123' });
		const createResult = manager.addRequest(input, NOW);

		if (createResult.success) {
			const cancelResult = manager.cancel(createResult.value.id, 'requester-123', NOW + 5000);
			expect(cancelResult.success).toBe(true);

			expect(manager.getPendingRequests().length).toBe(0);
			expect(manager.getRequest(createResult.value.id)?.status).toBe('cancelled');
		}
	});

	it('should handle expiration flow', () => {
		const input = createTestInput({ requesterId: 'requester-123' });
		const createResult = manager.addRequest(input, NOW);

		if (createResult.success) {
			// Time passes past TTL
			const expiredTime = NOW + JOIN_REQUEST_TTL_MS + 1;

			// Try to approve after expiration - should fail
			const approveResult = manager.approve(createResult.value.id, expiredTime);
			expect(approveResult.success).toBe(false);

			// Run stale cleanup
			const expiredIds = manager.expireStale(expiredTime);
			expect(expiredIds).toContain(createResult.value.id);
			expect(manager.getRequest(createResult.value.id)?.status).toBe('expired');
		}
	});

	it('should enforce single pending request per user', () => {
		const user = 'user-123';

		// First request
		const first = manager.addRequest(
			createTestInput({ requesterId: user, roomCode: 'ROOM1' }),
			NOW,
		);
		expect(first.success).toBe(true);

		// Second request to different room - should fail
		const second = manager.addRequest(
			createTestInput({ requesterId: user, roomCode: 'ROOM2' }),
			NOW,
		);
		expect(second.success).toBe(false);
		if (!second.success) {
			expect(second.error.code).toBe('DUPLICATE_REQUEST');
		}

		// After first is resolved, can request again
		if (first.success) {
			manager.decline(first.value.id, NOW);
		}

		const third = manager.addRequest(
			createTestInput({ requesterId: user, roomCode: 'ROOM2' }),
			NOW,
		);
		expect(third.success).toBe(true);
	});
});
