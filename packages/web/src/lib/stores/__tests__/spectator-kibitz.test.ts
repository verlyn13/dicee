/**
 * Spectator Kibitz System Tests (D6)
 *
 * Tests for the kibitz feature where spectators can vote on
 * what they think the current player should do.
 */

import { beforeEach, describe, expect, it } from 'vitest';

// Mock types that match the spectator service
interface KibitzOption {
	optionId: string;
	label: string;
	voteCount: number;
	percentage: number;
	voterPreview: string[];
}

interface KibitzState {
	playerId: string;
	turnNumber: number;
	totalVotes: number;
	activeVoteType: 'category' | 'keep' | 'action';
	categoryOptions: KibitzOption[];
	keepOptions: KibitzOption[];
	actionOptions: KibitzOption[];
	votingOpen: boolean;
}

interface MyKibitzVote {
	voteType: 'category' | 'keep' | 'action';
	category?: string;
	keepPattern?: number;
	action?: 'roll' | 'score';
}

// Mock WebSocket
class MockWebSocket {
	sent: string[] = [];
	readyState: number = WebSocket.OPEN;

	send(message: string) {
		this.sent.push(message);
	}

	close() {
		this.readyState = WebSocket.CLOSED;
	}
}

// Simplified kibitz store for testing
function createKibitzStore() {
	let kibitzState: KibitzState | null = null;
	let myVote: MyKibitzVote | null = null;
	let currentTurn: { turnNumber: number; playerId: string } | null = null;
	const socket = new MockWebSocket();

	return {
		get kibitzState() {
			return kibitzState;
		},
		get myKibitzVote() {
			return myVote;
		},
		get canKibitz() {
			return socket.readyState === WebSocket.OPEN && currentTurn !== null;
		},
		get hasVoted() {
			return myVote !== null;
		},

		// Simulate receiving events
		setTurn(turnNumber: number, playerId: string) {
			currentTurn = { turnNumber, playerId };
			myVote = null;
			kibitzState = null;
		},

		clearTurn() {
			currentTurn = null;
			myVote = null;
			kibitzState = null;
		},

		// Simulate kibitz commands
		kibitzCategory(playerId: string, category: string) {
			if (!currentTurn) return;
			socket.send(
				JSON.stringify({
					type: 'KIBITZ',
					payload: { playerId, voteType: 'category', category },
				}),
			);
		},

		kibitzKeep(playerId: string, keepPattern: number) {
			if (!currentTurn) return;
			socket.send(
				JSON.stringify({
					type: 'KIBITZ',
					payload: { playerId, voteType: 'keep', keepPattern },
				}),
			);
		},

		kibitzAction(playerId: string, action: 'roll' | 'score') {
			if (!currentTurn) return;
			socket.send(
				JSON.stringify({
					type: 'KIBITZ',
					payload: { playerId, voteType: 'action', action },
				}),
			);
		},

		clearKibitz() {
			socket.send(JSON.stringify({ type: 'CLEAR_KIBITZ' }));
		},

		getKibitz() {
			socket.send(JSON.stringify({ type: 'GET_KIBITZ' }));
		},

		// Simulate receiving events
		handleEvent(event: { type: string; payload?: unknown }) {
			const payload = event.payload as Record<string, unknown>;

			switch (event.type) {
				case 'KIBITZ_CONFIRMED':
					myVote = {
						voteType: payload.voteType as 'category' | 'keep' | 'action',
						category: payload.category as string | undefined,
						keepPattern: payload.keepPattern as number | undefined,
						action: payload.action as 'roll' | 'score' | undefined,
					};
					break;

				case 'KIBITZ_CLEARED':
					myVote = null;
					break;

				case 'KIBITZ_STATE':
					kibitzState = payload as unknown as KibitzState;
					break;

				case 'KIBITZ_UPDATE':
					if (kibitzState) {
						const voteType = payload.voteType as 'category' | 'keep' | 'action';
						const options = payload.options as KibitzOption[];

						switch (voteType) {
							case 'category':
								kibitzState = { ...kibitzState, categoryOptions: options };
								break;
							case 'keep':
								kibitzState = { ...kibitzState, keepOptions: options };
								break;
							case 'action':
								kibitzState = { ...kibitzState, actionOptions: options };
								break;
						}
						kibitzState.totalVotes = payload.totalVotes as number;
					}
					break;
			}
		},

		// Access socket for assertions
		get sentMessages() {
			return socket.sent;
		},

		getLastMessage() {
			return socket.sent[socket.sent.length - 1];
		},

		clearMessages() {
			socket.sent = [];
		},
	};
}

describe('Kibitz System', () => {
	let store: ReturnType<typeof createKibitzStore>;

	beforeEach(() => {
		store = createKibitzStore();
	});

	describe('State Management', () => {
		it('should start with no kibitz state', () => {
			expect(store.kibitzState).toBeNull();
			expect(store.myKibitzVote).toBeNull();
			expect(store.hasVoted).toBe(false);
		});

		it('should not allow kibitz without active turn', () => {
			expect(store.canKibitz).toBe(false);
		});

		it('should allow kibitz with active turn', () => {
			store.setTurn(1, 'player-1');
			expect(store.canKibitz).toBe(true);
		});

		it('should clear vote when turn changes', () => {
			store.setTurn(1, 'player-1');
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'category', category: 'full_house' },
			});
			expect(store.hasVoted).toBe(true);

			store.setTurn(2, 'player-2');
			expect(store.hasVoted).toBe(false);
			expect(store.myKibitzVote).toBeNull();
		});

		it('should clear state when turn ends', () => {
			store.setTurn(1, 'player-1');
			store.handleEvent({
				type: 'KIBITZ_STATE',
				payload: {
					playerId: 'player-1',
					turnNumber: 1,
					totalVotes: 5,
					activeVoteType: 'category',
					categoryOptions: [],
					keepOptions: [],
					actionOptions: [],
					votingOpen: true,
				},
			});
			expect(store.kibitzState).not.toBeNull();

			store.clearTurn();
			expect(store.kibitzState).toBeNull();
			expect(store.canKibitz).toBe(false);
		});
	});

	describe('Category Voting', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
		});

		it('should send category vote message', () => {
			store.kibitzCategory('player-1', 'full_house');

			const message = JSON.parse(store.getLastMessage());
			expect(message.type).toBe('KIBITZ');
			expect(message.payload.voteType).toBe('category');
			expect(message.payload.category).toBe('full_house');
			expect(message.payload.playerId).toBe('player-1');
		});

		it('should update my vote on confirmation', () => {
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'category', category: 'full_house' },
			});

			expect(store.myKibitzVote).toEqual({
				voteType: 'category',
				category: 'full_house',
				keepPattern: undefined,
				action: undefined,
			});
			expect(store.hasVoted).toBe(true);
		});

		it('should handle category options update', () => {
			store.handleEvent({
				type: 'KIBITZ_STATE',
				payload: {
					playerId: 'player-1',
					turnNumber: 1,
					totalVotes: 0,
					activeVoteType: 'category',
					categoryOptions: [],
					keepOptions: [],
					actionOptions: [],
					votingOpen: true,
				},
			});

			store.handleEvent({
				type: 'KIBITZ_UPDATE',
				payload: {
					voteType: 'category',
					options: [
						{
							optionId: 'full_house',
							label: 'Full House',
							voteCount: 3,
							percentage: 60,
							voterPreview: ['Alice', 'Bob', 'Carol'],
						},
						{
							optionId: 'large_straight',
							label: 'Large Straight',
							voteCount: 2,
							percentage: 40,
							voterPreview: ['Dave', 'Eve'],
						},
					],
					totalVotes: 5,
				},
			});

			expect(store.kibitzState?.categoryOptions).toHaveLength(2);
			expect(store.kibitzState?.categoryOptions[0].voteCount).toBe(3);
			expect(store.kibitzState?.totalVotes).toBe(5);
		});
	});

	describe('Keep Pattern Voting', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
		});

		it('should send keep pattern vote message', () => {
			store.kibitzKeep('player-1', 0b11100); // Keep dice 3, 4, 5

			const message = JSON.parse(store.getLastMessage());
			expect(message.type).toBe('KIBITZ');
			expect(message.payload.voteType).toBe('keep');
			expect(message.payload.keepPattern).toBe(28);
		});

		it('should update my vote on keep confirmation', () => {
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'keep', keepPattern: 31 },
			});

			expect(store.myKibitzVote).toEqual({
				voteType: 'keep',
				category: undefined,
				keepPattern: 31,
				action: undefined,
			});
		});

		it('should handle keep all (31) and keep none (0)', () => {
			store.kibitzKeep('player-1', 31);
			let message = JSON.parse(store.getLastMessage());
			expect(message.payload.keepPattern).toBe(31);

			store.kibitzKeep('player-1', 0);
			message = JSON.parse(store.getLastMessage());
			expect(message.payload.keepPattern).toBe(0);
		});
	});

	describe('Action Voting', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
		});

		it('should send roll action vote', () => {
			store.kibitzAction('player-1', 'roll');

			const message = JSON.parse(store.getLastMessage());
			expect(message.type).toBe('KIBITZ');
			expect(message.payload.voteType).toBe('action');
			expect(message.payload.action).toBe('roll');
		});

		it('should send score action vote', () => {
			store.kibitzAction('player-1', 'score');

			const message = JSON.parse(store.getLastMessage());
			expect(message.payload.action).toBe('score');
		});

		it('should update my vote on action confirmation', () => {
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'action', action: 'roll' },
			});

			expect(store.myKibitzVote).toEqual({
				voteType: 'action',
				category: undefined,
				keepPattern: undefined,
				action: 'roll',
			});
		});
	});

	describe('Vote Clearing', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'category', category: 'dicee' },
			});
		});

		it('should send clear kibitz message', () => {
			store.clearKibitz();

			const message = JSON.parse(store.getLastMessage());
			expect(message.type).toBe('CLEAR_KIBITZ');
		});

		it('should clear my vote on cleared event', () => {
			expect(store.hasVoted).toBe(true);

			store.handleEvent({
				type: 'KIBITZ_CLEARED',
				payload: { voteType: 'category' },
			});

			expect(store.hasVoted).toBe(false);
			expect(store.myKibitzVote).toBeNull();
		});
	});

	describe('State Request', () => {
		it('should send get kibitz message', () => {
			store.getKibitz();

			const message = JSON.parse(store.getLastMessage());
			expect(message.type).toBe('GET_KIBITZ');
		});

		it('should handle kibitz state response', () => {
			const statePayload: KibitzState = {
				playerId: 'player-1',
				turnNumber: 3,
				totalVotes: 7,
				activeVoteType: 'category',
				categoryOptions: [
					{
						optionId: 'dicee',
						label: 'Dicee',
						voteCount: 4,
						percentage: 57,
						voterPreview: ['Alice', 'Bob', 'Carol'],
					},
				],
				keepOptions: [],
				actionOptions: [
					{
						optionId: 'score',
						label: 'Score Now!',
						voteCount: 3,
						percentage: 43,
						voterPreview: ['Dave', 'Eve', 'Frank'],
					},
				],
				votingOpen: true,
			};

			store.handleEvent({
				type: 'KIBITZ_STATE',
				payload: statePayload,
			});

			expect(store.kibitzState).not.toBeNull();
			expect(store.kibitzState?.turnNumber).toBe(3);
			expect(store.kibitzState?.totalVotes).toBe(7);
			expect(store.kibitzState?.categoryOptions).toHaveLength(1);
			expect(store.kibitzState?.actionOptions).toHaveLength(1);
		});
	});

	describe('Vote Replacement', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
		});

		it('should allow changing vote type', () => {
			// First vote for category
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'category', category: 'full_house' },
			});
			expect(store.myKibitzVote?.voteType).toBe('category');

			// Change to action vote
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'action', action: 'roll' },
			});
			expect(store.myKibitzVote?.voteType).toBe('action');
			expect(store.myKibitzVote?.action).toBe('roll');
		});

		it('should allow changing within same vote type', () => {
			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'category', category: 'full_house' },
			});
			expect(store.myKibitzVote?.category).toBe('full_house');

			store.handleEvent({
				type: 'KIBITZ_CONFIRMED',
				payload: { voteType: 'category', category: 'large_straight' },
			});
			expect(store.myKibitzVote?.category).toBe('large_straight');
		});
	});

	describe('Voter Preview', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
			store.handleEvent({
				type: 'KIBITZ_STATE',
				payload: {
					playerId: 'player-1',
					turnNumber: 1,
					totalVotes: 0,
					activeVoteType: 'category',
					categoryOptions: [],
					keepOptions: [],
					actionOptions: [],
					votingOpen: true,
				},
			});
		});

		it('should show up to 3 voters in preview', () => {
			store.handleEvent({
				type: 'KIBITZ_UPDATE',
				payload: {
					voteType: 'category',
					options: [
						{
							optionId: 'dicee',
							label: 'Dicee',
							voteCount: 5,
							percentage: 100,
							voterPreview: ['Alice', 'Bob', 'Carol'],
						},
					],
					totalVotes: 5,
				},
			});

			expect(store.kibitzState?.categoryOptions[0].voterPreview).toHaveLength(3);
			expect(store.kibitzState?.categoryOptions[0].voteCount).toBe(5);
		});

		it('should handle single voter', () => {
			store.handleEvent({
				type: 'KIBITZ_UPDATE',
				payload: {
					voteType: 'action',
					options: [
						{
							optionId: 'roll',
							label: 'Roll',
							voteCount: 1,
							percentage: 100,
							voterPreview: ['Alice'],
						},
					],
					totalVotes: 1,
				},
			});

			expect(store.kibitzState?.actionOptions[0].voterPreview).toEqual(['Alice']);
		});

		it('should handle empty voters', () => {
			store.handleEvent({
				type: 'KIBITZ_UPDATE',
				payload: {
					voteType: 'keep',
					options: [
						{
							optionId: '31',
							label: 'Keep All',
							voteCount: 0,
							percentage: 0,
							voterPreview: [],
						},
					],
					totalVotes: 0,
				},
			});

			expect(store.kibitzState?.keepOptions[0].voterPreview).toEqual([]);
		});
	});

	describe('Percentage Calculation', () => {
		beforeEach(() => {
			store.setTurn(1, 'player-1');
			store.handleEvent({
				type: 'KIBITZ_STATE',
				payload: {
					playerId: 'player-1',
					turnNumber: 1,
					totalVotes: 0,
					activeVoteType: 'category',
					categoryOptions: [],
					keepOptions: [],
					actionOptions: [],
					votingOpen: true,
				},
			});
		});

		it('should calculate percentages correctly', () => {
			store.handleEvent({
				type: 'KIBITZ_UPDATE',
				payload: {
					voteType: 'category',
					options: [
						{
							optionId: 'dicee',
							label: 'Dicee',
							voteCount: 3,
							percentage: 50,
							voterPreview: [],
						},
						{
							optionId: 'full_house',
							label: 'Full House',
							voteCount: 2,
							percentage: 33,
							voterPreview: [],
						},
						{
							optionId: 'chance',
							label: 'Chance',
							voteCount: 1,
							percentage: 17,
							voterPreview: [],
						},
					],
					totalVotes: 6,
				},
			});

			expect(store.kibitzState?.categoryOptions[0].percentage).toBe(50);
			expect(store.kibitzState?.categoryOptions[1].percentage).toBe(33);
			expect(store.kibitzState?.categoryOptions[2].percentage).toBe(17);
		});

		it('should handle 100% for single option', () => {
			store.handleEvent({
				type: 'KIBITZ_UPDATE',
				payload: {
					voteType: 'action',
					options: [
						{
							optionId: 'score',
							label: 'Score',
							voteCount: 4,
							percentage: 100,
							voterPreview: [],
						},
					],
					totalVotes: 4,
				},
			});

			expect(store.kibitzState?.actionOptions[0].percentage).toBe(100);
		});
	});
});

describe('Kibitz Edge Cases', () => {
	let store: ReturnType<typeof createKibitzStore>;

	beforeEach(() => {
		store = createKibitzStore();
	});

	it('should not send vote without active turn', () => {
		store.kibitzCategory('player-1', 'dicee');
		expect(store.sentMessages).toHaveLength(0);
	});

	it('should handle rapid vote changes', () => {
		store.setTurn(1, 'player-1');
		store.clearMessages();

		store.kibitzCategory('player-1', 'ones');
		store.kibitzCategory('player-1', 'twos');
		store.kibitzCategory('player-1', 'threes');

		expect(store.sentMessages).toHaveLength(3);
	});

	it('should handle null kibitz state in update', () => {
		// KIBITZ_UPDATE without prior KIBITZ_STATE should be handled gracefully
		store.handleEvent({
			type: 'KIBITZ_UPDATE',
			payload: {
				voteType: 'category',
				options: [],
				totalVotes: 0,
			},
		});

		// Should not throw, state remains null
		expect(store.kibitzState).toBeNull();
	});
});
