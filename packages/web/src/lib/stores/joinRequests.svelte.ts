/**
 * Join Requests Store (Host Side)
 *
 * Manages join requests received by the room host.
 * Integrates with roomService to handle server events.
 */

import { roomService } from '$lib/services/roomService.svelte';
import type { ServerEvent } from '$lib/types/multiplayer';

// =============================================================================
// Types
// =============================================================================

/**
 * Status of a join request.
 */
export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'expired' | 'cancelled';

/**
 * Join request received by the host.
 */
export interface JoinRequest {
	id: string;
	roomCode: string;
	requesterId: string;
	requesterDisplayName: string;
	requesterAvatarSeed: string;
	createdAt: number;
	expiresAt: number;
	status: JoinRequestStatus;
}

// =============================================================================
// Store Class
// =============================================================================

/**
 * Join Requests Store - manages pending join requests for room hosts.
 */
class JoinRequestsStore {
	/** Pending join requests awaiting host decision */
	pendingRequests = $state<JoinRequest[]>([]);

	/** Whether the store is currently listening to events */
	private isListening = false;

	/** Bound event handler (stored for removal) */
	private boundHandler: ((event: ServerEvent) => void) | null = null;

	// =========================================================================
	// Derived
	// =========================================================================

	/** Number of pending requests */
	pendingCount = $derived(this.pendingRequests.length);

	/** Whether there are any pending requests */
	hasPendingRequests = $derived(this.pendingRequests.length > 0);

	/** Get the oldest pending request (for priority display) */
	oldestRequest = $derived(
		this.pendingRequests.length > 0
			? this.pendingRequests.reduce((oldest, req) =>
					req.createdAt < oldest.createdAt ? req : oldest,
				)
			: null,
	);

	// =========================================================================
	// Lifecycle
	// =========================================================================

	/**
	 * Start listening for join request events from roomService.
	 * Call this when user becomes host.
	 */
	startListening(): void {
		if (this.isListening) return;

		this.boundHandler = this.handleServerEvent.bind(this);
		roomService.addEventHandler(this.boundHandler);
		this.isListening = true;
		console.log('[JoinRequestsStore] Started listening for join request events');
	}

	/**
	 * Stop listening for events and clear state.
	 * Call this when user leaves room or stops being host.
	 */
	stopListening(): void {
		if (!this.isListening || !this.boundHandler) return;

		roomService.removeEventHandler(this.boundHandler);
		this.boundHandler = null;
		this.isListening = false;
		this.pendingRequests = [];
		console.log('[JoinRequestsStore] Stopped listening and cleared state');
	}

	/**
	 * Reset the store state without removing listener.
	 * Call this when game starts (clears pending requests).
	 */
	reset(): void {
		this.pendingRequests = [];
	}

	// =========================================================================
	// Event Handler
	// =========================================================================

	private handleServerEvent(event: ServerEvent): void {
		const eventType = event.type as string;

		switch (eventType) {
			case 'JOIN_REQUEST_RECEIVED': {
				const payload = event.payload as { request: JoinRequest };
				this.handleJoinRequestReceived(payload.request);
				break;
			}

			case 'JOIN_REQUEST_CANCELLED': {
				const payload = event.payload as { requestId: string; requesterDisplayName: string };
				this.handleJoinRequestCancelled(payload.requestId);
				break;
			}

			case 'JOIN_REQUEST_EXPIRED': {
				const payload = event.payload as { requestId: string };
				this.handleJoinRequestExpired(payload.requestId);
				break;
			}
		}
	}

	private handleJoinRequestReceived(request: JoinRequest): void {
		// Add to pending list if not already present
		const exists = this.pendingRequests.some((r) => r.id === request.id);
		if (!exists) {
			this.pendingRequests = [...this.pendingRequests, request];
		}
	}

	private handleJoinRequestCancelled(requestId: string): void {
		this.pendingRequests = this.pendingRequests.filter((r) => r.id !== requestId);
	}

	private handleJoinRequestExpired(requestId: string): void {
		this.pendingRequests = this.pendingRequests.filter((r) => r.id !== requestId);
	}

	// =========================================================================
	// Actions
	// =========================================================================

	/**
	 * Approve a join request.
	 * Sends approval to server and removes from pending list.
	 */
	approve(requestId: string): void {
		const request = this.pendingRequests.find((r) => r.id === requestId);
		if (!request) {
			console.warn('[JoinRequestsStore] Cannot approve - request not found:', requestId);
			return;
		}

		// Send to server via roomService
		roomService.send({
			type: 'JOIN_REQUEST_RESPONSE',
			payload: {
				requestId,
				approved: true,
			},
		});

		// Remove from pending list optimistically
		this.pendingRequests = this.pendingRequests.filter((r) => r.id !== requestId);
	}

	/**
	 * Decline a join request.
	 * Sends decline to server and removes from pending list.
	 */
	decline(requestId: string): void {
		const request = this.pendingRequests.find((r) => r.id === requestId);
		if (!request) {
			console.warn('[JoinRequestsStore] Cannot decline - request not found:', requestId);
			return;
		}

		// Send to server via roomService
		roomService.send({
			type: 'JOIN_REQUEST_RESPONSE',
			payload: {
				requestId,
				approved: false,
			},
		});

		// Remove from pending list optimistically
		this.pendingRequests = this.pendingRequests.filter((r) => r.id !== requestId);
	}

	/**
	 * Get a request by ID.
	 */
	getRequest(requestId: string): JoinRequest | undefined {
		return this.pendingRequests.find((r) => r.id === requestId);
	}

	/**
	 * Get seconds remaining until a request expires.
	 * Returns null if request not found.
	 */
	getSecondsRemaining(requestId: string): number | null {
		const request = this.pendingRequests.find((r) => r.id === requestId);
		if (!request) return null;
		return Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000));
	}
}

// =============================================================================
// Export Singleton
// =============================================================================

export const joinRequestsStore = new JoinRequestsStore();
