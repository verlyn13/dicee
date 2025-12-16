# Multiplayer Dicee - Architecture & Implementation Plan
**Version**: 1.0  
**Date**: November 30, 2025  
**Author**: Claude (Sonnet 4.5)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Data Models](#data-models)
4. [Real-time Communication](#real-time-communication)
5. [Game Flow State Machine](#game-flow-state-machine)
6. [User Profiles](#user-profiles)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Security Considerations](#security-considerations)
10. [Performance & Scalability](#performance--scalability)

---

## Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (Svelte 5)                  │
├─────────────────────────────────────────────────────────────┤
│  UI Components          │  Game State (Runes)               │
│  - DiceTray            │  - Reactive stores                 │
│  - Scorecard           │  - Optimistic updates              │
│  - PlayerList          │  - Local-first                     │
│  - TurnIndicator       │                                    │
├─────────────────────────────────────────────────────────────┤
│               Event Bus (Command/Query)                      │
├─────────────────────────────────────────────────────────────┤
│  Services Layer         │  State Management                 │
│  - GameRoomService     │  - XState v5 (Turn FSM)           │
│  - PlayerService       │  - Event Sourcing                  │
│  - SyncService         │  - CRDT (Conflict Resolution)      │
│  - AnalyticsService    │                                    │
└─────────────────────────────────────────────────────────────┘
                              ↕ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                  Server Layer (PartyKit)                     │
├─────────────────────────────────────────────────────────────┤
│  Game Room Coordinator  │  Player Manager                   │
│  - Room lifecycle      │  - Authentication                  │
│  - State sync          │  - Presence tracking               │
│  - Event broadcast     │  - Profile storage                 │
├─────────────────────────────────────────────────────────────┤
│              Event Store (Durable Objects)                   │
│  - Immutable event log                                      │
│  - Replay capabilities                                      │
│  - Analytics source                                         │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│                 Persistence Layer (Optional)                 │
│  - User profiles (localStorage → Supabase)                  │
│  - Game history (IndexedDB)                                 │
│  - Statistics (Time-series DB)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Technologies (November 2025 Best Practices)

| Layer | Technology | Purpose | Why This Choice |
|-------|-----------|---------|-----------------|
| **Real-time** | PartyKit | WebSocket coordination | Simplest multiplayer infra, Cloudflare Workers-based |
| **State Machine** | XState v5 | Turn management | Deterministic, visualizable, testable |
| **Events** | Custom Event Bus | Command/Query separation | CQRS pattern, replay capability |
| **Sync** | CRDT-lite | Conflict resolution | Optimistic UI, eventual consistency |
| **Profiles** | localStorage → Supabase | User data | MVP: local, v1.1: cloud sync |
| **Analytics** | Custom collector | Game statistics | Event sourcing enables rich analytics |

### Why PartyKit Over Alternatives?

**Evaluated:**
- ✅ **PartyKit**: Winner - Built for multiplayer, Cloudflare Workers, simple API
- ❌ **Supabase Realtime**: Good for CRUD, overkill for ephemeral game state
- ❌ **Ably/Pusher**: Commercial, not optimized for game state
- ❌ **Socket.io**: Requires custom server, more infrastructure
- ❌ **WebRTC**: P2P complexity, NAT traversal issues

**PartyKit Advantages:**
```typescript
// Single file, auto-scaling, distributed
export default class GameRoomServer implements Party.Server {
  constructor(public room: Party.Room) {}
  
  async onConnect(conn: Party.Connection) {
    // Player joined
  }
  
  async onMessage(message: string, sender: Party.Connection) {
    // Broadcast game action
    this.room.broadcast(message, [sender.id]);
  }
}
```

---

## Data Models

### Core Domain Entities

#### 1. User Profile

```typescript
/**
 * User Profile - Persistent identity across games
 */
interface UserProfile {
  id: string;                    // UUID v4
  username: string;              // Display name (3-20 chars)
  avatar: AvatarConfig;          // Customizable avatar
  createdAt: Date;
  updatedAt: Date;
  
  // Statistics (aggregated from games)
  stats: PlayerStatistics;
  
  // Preferences
  settings: UserSettings;
}

interface AvatarConfig {
  type: 'identicon' | 'emoji' | 'custom';
  seed: string;                  // For deterministic generation
  color: string;                 // Primary color (#hex)
}

interface PlayerStatistics {
  gamesPlayed: number;
  gamesWon: number;
  averageScore: number;
  highScore: number;
  totalDicees: number;
  
  // Advanced stats
  averageTurnsToComplete: number;
  favoriteCategory: Category;    // Most scored
  winRate: number;               // games won / games played
  
  // Time-based
  lastPlayedAt: Date;
  totalPlayTimeMinutes: number;
}

interface UserSettings {
  soundEnabled: boolean;
  animationsEnabled: boolean;
  statsProfile: 'beginner' | 'intermediate' | 'expert';
  autoRoll: boolean;             // Auto-roll on turn start
  confirmScoring: boolean;       // Require confirmation before scoring
}
```

#### 2. Game Room

```typescript
/**
 * Game Room - Ephemeral multiplayer session
 */
interface GameRoom {
  id: string;                    // Room code (6-char alphanumeric)
  createdAt: Date;
  createdBy: string;             // User ID
  
  // Room configuration
  config: RoomConfig;
  
  // Player management
  players: Player[];             // 2-4 players
  maxPlayers: 4;
  
  // Game state
  state: GameRoomState;
  currentTurnPlayerId: string;
  turnNumber: number;            // 1-13
  
  // Event log (Event Sourcing)
  events: GameEvent[];
  
  // Metadata
  startedAt: Date | null;
  completedAt: Date | null;
}

interface RoomConfig {
  isPublic: boolean;             // Listed in lobby?
  allowSpectators: boolean;
  turnTimeoutSeconds: number;    // 0 = no timeout
  autoKickInactivePlayers: boolean;
}

type GameRoomState = 
  | 'waiting'    // Waiting for players
  | 'starting'   // Countdown to game start
  | 'playing'    // Active game
  | 'paused'     // Temporarily paused
  | 'completed'  // Game finished
  | 'abandoned'; // All players left

interface Player {
  id: string;                    // User ID
  profile: UserProfile;
  
  // In-game state
  connected: boolean;
  isHost: boolean;
  joinedAt: Date;
  
  // Game progress
  scorecard: Scorecard;
  currentScore: number;
  
  // Current turn state (if active)
  currentDice?: DiceArray;
  keptDice?: KeptMask;
  rollsRemaining?: number;
}
```

#### 3. Game Events (Event Sourcing)

```typescript
/**
 * Domain Events - Immutable event log
 */
type GameEvent = 
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | GameStartedEvent
  | TurnStartedEvent
  | DiceRolledEvent
  | DiceKeptEvent
  | CategoryScoredEvent
  | TurnEndedEvent
  | GameCompletedEvent;

interface BaseEvent {
  id: string;                    // Event UUID
  type: string;                  // Discriminator
  timestamp: Date;
  playerId: string;
  roomId: string;
}

interface DiceRolledEvent extends BaseEvent {
  type: 'dice.rolled';
  data: {
    dice: DiceArray;
    rollNumber: number;          // 1, 2, or 3
    kept: KeptMask;
  };
}

interface CategoryScoredEvent extends BaseEvent {
  type: 'category.scored';
  data: {
    category: Category;
    score: number;
    
    // Context for analytics
    dice: DiceArray;
    alternativeScores: Record<Category, number>;
    expectedValue: number;       // From WASM engine
    optimalPlay: boolean;        // Did they choose best EV?
  };
}

interface GameCompletedEvent extends BaseEvent {
  type: 'game.completed';
  data: {
    winner: {
      playerId: string;
      finalScore: number;
    };
    rankings: Array<{
      playerId: string;
      rank: number;
      score: number;
    }>;
    duration: number;            // Game duration in seconds
    totalTurns: number;
  };
}
```

---

## Real-time Communication

### PartyKit Server Implementation

```typescript
// server/gameRoom.ts
import type * as Party from "partykit/server";

export default class GameRoomServer implements Party.Server {
  constructor(public room: Party.Room) {}
  
  // Player connections
  players: Map<string, PlayerConnection> = new Map();
  
  // Game state (in-memory, ephemeral)
  gameState: GameRoom | null = null;
  
  /**
   * Player connects to room
   */
  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const userId = await this.authenticatePlayer(ctx);
    
    // Load player profile
    const profile = await this.loadProfile(userId);
    
    // Add to room
    const player: Player = {
      id: userId,
      profile,
      connected: true,
      isHost: this.players.size === 0, // First player is host
      joinedAt: new Date(),
      scorecard: this.createEmptyScorecard(),
      currentScore: 0,
    };
    
    this.players.set(conn.id, { connection: conn, player });
    
    // Initialize game state if first player
    if (!this.gameState) {
      this.gameState = this.createGameRoom(player);
    } else {
      // Add to existing game
      this.gameState.players.push(player);
    }
    
    // Emit event
    const event: PlayerJoinedEvent = {
      id: crypto.randomUUID(),
      type: 'player.joined',
      timestamp: new Date(),
      playerId: userId,
      roomId: this.room.id,
      data: { player },
    };
    
    this.gameState.events.push(event);
    
    // Broadcast to all players
    this.broadcast(event);
    
    // Send current state to new player
    conn.send(JSON.stringify({
      type: 'state.sync',
      data: this.gameState,
    }));
  }
  
  /**
   * Player sends action
   */
  async onMessage(message: string, sender: Party.Connection) {
    const command = JSON.parse(message);
    
    // Command validation
    if (!this.isValidCommand(command, sender)) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Invalid command',
      }));
      return;
    }
    
    // Process command → Event
    const event = await this.processCommand(command, sender);
    
    if (event) {
      // Append to event log
      this.gameState!.events.push(event);
      
      // Update game state
      this.applyEvent(event);
      
      // Broadcast to all players
      this.broadcast(event);
      
      // Persist (optional)
      await this.room.storage.put('events', this.gameState!.events);
    }
  }
  
  /**
   * Command handlers
   */
  private async processCommand(
    command: Command,
    sender: Party.Connection
  ): Promise<GameEvent | null> {
    switch (command.type) {
      case 'dice.roll':
        return this.handleRollDice(command, sender);
      
      case 'dice.keep':
        return this.handleKeepDice(command, sender);
      
      case 'category.score':
        return this.handleScoreCategory(command, sender);
      
      default:
        return null;
    }
  }
  
  /**
   * Event application (update state)
   */
  private applyEvent(event: GameEvent): void {
    switch (event.type) {
      case 'dice.rolled':
        const player = this.findPlayer(event.playerId);
        player.currentDice = event.data.dice;
        player.rollsRemaining = 3 - event.data.rollNumber;
        break;
      
      case 'category.scored':
        const scorer = this.findPlayer(event.playerId);
        scorer.scorecard[event.data.category] = event.data.score;
        scorer.currentScore += event.data.score;
        
        // Advance turn
        this.advanceTurn();
        break;
      
      case 'game.completed':
        this.gameState!.state = 'completed';
        this.gameState!.completedAt = new Date();
        break;
    }
  }
  
  /**
   * Turn management
   */
  private advanceTurn(): void {
    const currentIndex = this.gameState!.players.findIndex(
      p => p.id === this.gameState!.currentTurnPlayerId
    );
    
    const nextIndex = (currentIndex + 1) % this.gameState!.players.length;
    const nextPlayer = this.gameState!.players[nextIndex];
    
    // Check if round complete (all players scored)
    const allScored = this.gameState!.players.every(p => 
      Object.values(p.scorecard).filter(s => s !== null).length ===
      this.gameState!.turnNumber
    );
    
    if (allScored) {
      this.gameState!.turnNumber++;
      
      // Check game completion
      if (this.gameState!.turnNumber > 13) {
        this.completeGame();
        return;
      }
    }
    
    // Start next player's turn
    this.gameState!.currentTurnPlayerId = nextPlayer.id;
    
    const event: TurnStartedEvent = {
      id: crypto.randomUUID(),
      type: 'turn.started',
      timestamp: new Date(),
      playerId: nextPlayer.id,
      roomId: this.room.id,
      data: {
        turnNumber: this.gameState!.turnNumber,
      },
    };
    
    this.broadcast(event);
  }
  
  /**
   * Broadcast to all connected players
   */
  private broadcast(event: GameEvent): void {
    const message = JSON.stringify(event);
    this.room.broadcast(message);
  }
  
  /**
   * Player disconnects
   */
  async onClose(conn: Party.Connection) {
    const playerConn = this.players.get(conn.id);
    
    if (playerConn) {
      playerConn.player.connected = false;
      
      const event: PlayerLeftEvent = {
        id: crypto.randomUUID(),
        type: 'player.left',
        timestamp: new Date(),
        playerId: playerConn.player.id,
        roomId: this.room.id,
      };
      
      this.broadcast(event);
      this.players.delete(conn.id);
      
      // Check if game should be abandoned
      const connectedCount = Array.from(this.players.values())
        .filter(p => p.player.connected).length;
      
      if (connectedCount === 0) {
        this.gameState!.state = 'abandoned';
        // Auto-cleanup after 5 minutes
        setTimeout(() => {
          this.room.storage.deleteAll();
        }, 5 * 60 * 1000);
      }
    }
  }
}

interface PlayerConnection {
  connection: Party.Connection;
  player: Player;
}
```

### Client-Side Sync Service

```typescript
// src/lib/services/sync.ts
import PartySocket from "partysocket";
import { gameRoomState, currentPlayer } from '$lib/stores/multiplayer.svelte';
import type { GameEvent, Command } from '$lib/types';

/**
 * Real-time sync service using PartyKit
 */
class SyncService {
  private socket: PartySocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  /**
   * Connect to game room
   */
  async connect(roomId: string, userId: string): Promise<void> {
    this.socket = new PartySocket({
      host: import.meta.env.VITE_PARTYKIT_HOST,
      room: roomId,
      
      // Auth token
      query: {
        userId,
        token: await this.getAuthToken(userId),
      },
    });
    
    // Event handlers
    this.socket.addEventListener('message', this.handleMessage.bind(this));
    this.socket.addEventListener('open', this.handleOpen.bind(this));
    this.socket.addEventListener('close', this.handleClose.bind(this));
    this.socket.addEventListener('error', this.handleError.bind(this));
  }
  
  /**
   * Handle incoming events
   */
  private handleMessage(event: MessageEvent): void {
    const data = JSON.parse(event.data);
    
    if (data.type === 'state.sync') {
      // Full state sync
      gameRoomState.value = data.data;
    } else {
      // Apply event
      this.applyEvent(data as GameEvent);
    }
  }
  
  /**
   * Send command to server
   */
  async sendCommand(command: Command): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to game room');
    }
    
    // Optimistic update (apply locally first)
    const optimisticEvent = this.commandToEvent(command);
    this.applyEventOptimistically(optimisticEvent);
    
    // Send to server
    this.socket.send(JSON.stringify(command));
  }
  
  /**
   * Apply event to local state
   */
  private applyEvent(event: GameEvent): void {
    // Update game room state
    gameRoomState.value = {
      ...gameRoomState.value!,
      events: [...gameRoomState.value!.events, event],
    };
    
    // Emit to local event bus for components
    eventBus.emit(event);
  }
  
  /**
   * Optimistic update (revert if server rejects)
   */
  private applyEventOptimistically(event: GameEvent): void {
    // Mark as pending
    event.metadata = { optimistic: true };
    
    // Apply to local state
    this.applyEvent(event);
    
    // Wait for server confirmation (or timeout)
    const timeout = setTimeout(() => {
      this.revertOptimisticEvent(event);
    }, 5000);
    
    // Clean up on confirmation
    this.socket!.addEventListener('message', (msg) => {
      const serverEvent = JSON.parse(msg.data);
      if (serverEvent.id === event.id) {
        clearTimeout(timeout);
        event.metadata = { optimistic: false };
      }
    }, { once: true });
  }
  
  /**
   * Disconnect from room
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const syncService = new SyncService();
```

---

## Game Flow State Machine

### XState v5 Turn Management

```typescript
// src/lib/machines/multiplayer.machine.ts
import { setup, assign } from 'xstate';
import type { GameRoom, Player } from '$lib/types';

/**
 * Multiplayer game state machine
 */
export const multiplayerGameMachine = setup({
  types: {} as {
    context: {
      room: GameRoom;
      localPlayerId: string;
    };
    events:
      | { type: 'PLAYER_JOINED'; player: Player }
      | { type: 'GAME_START' }
      | { type: 'DICE_ROLL'; dice: DiceArray }
      | { type: 'DICE_KEEP'; index: number }
      | { type: 'CATEGORY_SCORE'; category: Category }
      | { type: 'TURN_TIMEOUT' }
      | { type: 'PLAYER_LEFT'; playerId: string };
  },
}).createMachine({
  id: 'multiplayerGame',
  initial: 'lobby',
  
  states: {
    /**
     * Lobby - Waiting for players
     */
    lobby: {
      on: {
        PLAYER_JOINED: {
          actions: assign({
            room: ({ context, event }) => ({
              ...context.room,
              players: [...context.room.players, event.player],
            }),
          }),
        },
        
        GAME_START: {
          target: 'playing',
          guard: ({ context }) => context.room.players.length >= 2,
        },
      },
    },
    
    /**
     * Active game
     */
    playing: {
      initial: 'waitingForRoll',
      
      states: {
        /**
         * Waiting for current player to roll
         */
        waitingForRoll: {
          entry: 'notifyTurnStart',
          
          on: {
            DICE_ROLL: {
              target: 'rolled',
              actions: 'recordRoll',
            },
            
            TURN_TIMEOUT: {
              target: 'timeoutPenalty',
            },
          },
        },
        
        /**
         * Dice rolled, can keep or roll again
         */
        rolled: {
          on: {
            DICE_KEEP: {
              actions: 'toggleKeep',
            },
            
            DICE_ROLL: {
              target: 'rolled',
              actions: 'recordRoll',
              guard: 'hasRollsRemaining',
            },
            
            CATEGORY_SCORE: {
              target: 'scoring',
            },
          },
        },
        
        /**
         * Scoring category
         */
        scoring: {
          entry: 'calculateScore',
          
          always: [
            {
              target: '#multiplayerGame.gameOver',
              guard: 'isGameComplete',
            },
            {
              target: 'waitingForRoll',
              actions: 'advanceTurn',
            },
          ],
        },
        
        /**
         * Turn timeout penalty
         */
        timeoutPenalty: {
          entry: 'applyTimeoutPenalty',
          
          always: {
            target: 'waitingForRoll',
            actions: 'advanceTurn',
          },
        },
      },
      
      on: {
        PLAYER_LEFT: {
          actions: 'markPlayerDisconnected',
          guard: 'hasEnoughPlayers',
        },
      },
    },
    
    /**
     * Game completed
     */
    gameOver: {
      entry: 'calculateRankings',
      type: 'final',
    },
  },
});
```

---

## User Profiles

### Profile Storage Strategy

**MVP (Phase 1)**: localStorage
- Fast implementation
- No server required
- Works offline
- Profiles per-browser

**v1.1 (Phase 2)**: Supabase sync
- Cross-device profiles
- Cloud backup
- Social features

```typescript
// src/lib/services/profile.ts
import { browser } from '$app/environment';
import type { UserProfile } from '$lib/types';

const PROFILE_KEY = 'dicee:user:profile';

/**
 * User Profile Service (localStorage MVP)
 */
class ProfileService {
  /**
   * Get or create profile
   */
  async getProfile(): Promise<UserProfile> {
    if (!browser) return this.createGuestProfile();
    
    const stored = localStorage.getItem(PROFILE_KEY);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    // First time - create profile
    return this.createProfile();
  }
  
  /**
   * Create new profile with wizard
   */
  private async createProfile(): Promise<UserProfile> {
    // Generate unique ID
    const id = crypto.randomUUID();
    
    // Default username (can change later)
    const username = `Player_${id.slice(0, 6)}`;
    
    const profile: UserProfile = {
      id,
      username,
      avatar: {
        type: 'identicon',
        seed: id,
        color: this.randomColor(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: this.emptyStats(),
      settings: this.defaultSettings(),
    };
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    
    return profile;
  }
  
  /**
   * Update profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await this.getProfile();
    
    const updated = {
      ...profile,
      ...updates,
      updatedAt: new Date(),
    };
    
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    
    return updated;
  }
  
  /**
   * Update statistics after game
   */
  async updateStats(gameResult: GameResult): Promise<void> {
    const profile = await this.getProfile();
    
    const stats = {
      ...profile.stats,
      gamesPlayed: profile.stats.gamesPlayed + 1,
      gamesWon: profile.stats.gamesWon + (gameResult.won ? 1 : 0),
      averageScore: this.calculateNewAverage(
        profile.stats.averageScore,
        profile.stats.gamesPlayed,
        gameResult.score
      ),
      highScore: Math.max(profile.stats.highScore, gameResult.score),
      totalDicees: profile.stats.totalDicees + gameResult.dicees,
      lastPlayedAt: new Date(),
    };
    
    await this.updateProfile({ stats });
  }
  
  /**
   * Generate identicon avatar
   */
  generateAvatar(seed: string): string {
    // Use jdenticon or similar library
    return `data:image/svg+xml,${encodeURIComponent(
      this.generateIdenticonSVG(seed)
    )}`;
  }
}

export const profileService = new ProfileService();
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1, 20-25 hours)

**Goal**: Core multiplayer infrastructure

#### Tasks

1. **Enhanced Dice Roll Animation** (2h)
   - Visual feedback component
   - Sound effects (optional)
   - Integration with DiceTray

2. **User Profile System** (6h)
   - Profile data model
   - localStorage service
   - Profile creation wizard
   - Avatar generation (identicon)
   - Settings UI

3. **PartyKit Setup** (4h)
   - Install PartyKit
   - Basic room server
   - Client connection
   - Test harness

4. **Event Sourcing Foundation** (8h)
   - Event types definition
   - Event bus implementation
   - Event replay system
   - Testing framework

**Deliverables**:
- ✅ Visual feedback working
- ✅ Profiles created and stored
- ✅ PartyKit connected
- ✅ Events recorded

---

### Phase 2: Core Multiplayer (Week 2, 25-30 hours)

**Goal**: 2-player games work end-to-end

#### Tasks

1. **Game Room System** (10h)
   - Room creation
   - Room joining (code-based)
   - Player management
   - Room lobby UI

2. **Turn Management** (8h)
   - XState machine implementation
   - Turn indicator UI
   - Turn timeout handling
   - Action validation

3. **Real-time Sync** (7h)
   - Optimistic updates
   - Conflict resolution
   - Reconnection handling
   - State reconciliation

**Deliverables**:
- ✅ Can create/join rooms
- ✅ 2 players can play complete game
- ✅ Turn management works
- ✅ No desyncs

---

### Phase 3: Spectator & Polish (Week 3, 20-25 hours)

**Goal**: 3-4 player support, spectator view

#### Tasks

1. **Multi-player Support** (8h)
   - 3-4 player support
   - Player order management
   - Round-robin turns
   - Score comparison UI

2. **Spectator Mode** (6h)
   - View-only connection
   - Real-time updates
   - Current player highlight
   - Dice/choice visibility

3. **Game Statistics** (6h)
   - Per-game analytics
   - Round recap
   - Winner celebration
   - Historical stats

**Deliverables**:
- ✅ 4-player games work
- ✅ Spectators can watch
- ✅ Rich game statistics
- ✅ Celebration animations

---

### Phase 4: Testing & Deployment (Week 4, 15-20 hours)

**Goal**: Production-ready multiplayer

#### Tasks

1. **Integration Testing** (8h)
   - Multi-client tests
   - Network failure scenarios
   - Reconnection tests
   - Load testing

2. **Security Hardening** (4h)
   - Input validation
   - Rate limiting
   - Anti-cheat basics
   - Secure room codes

3. **Performance Optimization** (3h)
   - Bundle size reduction
   - WebSocket compression
   - State diff updates
   - Lazy loading

**Deliverables**:
- ✅ Test coverage >80%
- ✅ Security audit passed
- ✅ Performance benchmarks met
- ✅ Production deployment

---

## Testing Strategy

### Test Pyramid

```
        E2E (Multiplayer)
       ▲ 10 tests
      ▲▲
     ▲  ▲ Integration (Sync)
    ▲    ▲ 30 tests
   ▲      ▲
  ▲▲▲▲▲▲▲▲▲ Unit (Events, State)
            100 tests
```

### Key Test Scenarios

#### Unit Tests

```typescript
// src/lib/services/__tests__/sync.test.ts
describe('SyncService', () => {
  it('applies optimistic updates immediately', () => {
    const event = syncService.sendCommand({ type: 'dice.roll' });
    
    // State updated before server confirms
    expect(gameState.dice).toBeDefined();
  });
  
  it('reverts optimistic update on server rejection', async () => {
    mockServer.reject('dice.roll');
    
    syncService.sendCommand({ type: 'dice.roll' });
    
    await vi.waitFor(() => {
      expect(gameState.dice).toBeNull();
    });
  });
});
```

#### Integration Tests

```typescript
// tests/multiplayer/sync.spec.ts
test('two players can complete a game', async ({ page, context }) => {
  // Player 1
  await page.goto('/');
  await page.click('button:has-text("Create Room")');
  const roomCode = await page.textContent('.room-code');
  
  // Player 2
  const page2 = await context.newPage();
  await page2.goto('/');
  await page2.click('button:has-text("Join Room")');
  await page2.fill('input[name="code"]', roomCode);
  await page2.click('button:has-text("Join")');
  
  // Play game
  for (let turn = 0; turn < 13; turn++) {
    // Player 1 turn
    await page.click('button:has-text("Roll")');
    await page.click('.category:first-child');
    
    // Player 2 turn
    await page2.click('button:has-text("Roll")');
    await page2.click('.category:first-child');
  }
  
  // Verify both see same winner
  const winner1 = await page.textContent('.winner');
  const winner2 = await page2.textContent('.winner');
  expect(winner1).toBe(winner2);
});
```

---

## Security Considerations

### Authentication

**MVP**: Anonymous with ID
```typescript
// Generate secure client ID
const clientId = crypto.randomUUID();
localStorage.setItem('dicee:clientId', clientId);

// Include in all requests
headers: {
  'X-Client-ID': clientId
}
```

**v1.1**: Email/OAuth
```typescript
// Supabase auth
const { user } = await supabase.auth.signInWithOAuth({
  provider: 'google'
});
```

### Anti-Cheat Measures

1. **Server Authority**: All dice rolls on server
2. **Move Validation**: Server validates all actions
3. **Rate Limiting**: Max 10 actions/second per player
4. **Replay Detection**: Prevent duplicate events

```typescript
// Server-side validation
function validateCommand(command: Command, player: Player): boolean {
  // Is it player's turn?
  if (gameState.currentTurnPlayerId !== player.id) {
    return false;
  }
  
  // Has rolls remaining?
  if (command.type === 'dice.roll' && player.rollsRemaining === 0) {
    return false;
  }
  
  // Category available?
  if (command.type === 'category.score') {
    if (player.scorecard[command.category] !== null) {
      return false;
    }
  }
  
  return true;
}
```

---

## Performance & Scalability

### Optimization Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| WebSocket Latency | <50ms | ping/pong |
| State Sync | <100ms | event → UI update |
| Bundle Size | <50KB | Multiplayer code |
| Concurrent Rooms | 1000+ | PartyKit capacity |
| Players per Room | 4 max | Design constraint |

### Scaling Strategy

**Current (MVP)**:
- PartyKit auto-scales
- 1 room = 1 Durable Object
- Ephemeral state (no database)

**Future (v1.1+)**:
- PostgreSQL for profiles
- Redis for room discovery
- Time-series DB for analytics

---

## Summary & Next Steps

### What We're Building

✅ **Enhanced Visual Feedback** - Dice roll animations  
✅ **User Profiles** - Persistent identity, stats, settings  
✅ **Multiplayer Rooms** - 2-4 players, code-based join  
✅ **Turn-based Play** - State machine-driven turns  
✅ **Spectator Mode** - Watch others play  
✅ **Game Statistics** - Analytics, recaps, rankings  

### Modern Patterns Applied

✅ **Event Sourcing** - Immutable event log, replay capability  
✅ **CQRS** - Command/query separation  
✅ **Optimistic UI** - Instant feedback, background sync  
✅ **State Machines** - XState v5 for deterministic turns  
✅ **Real-time Sync** - PartyKit WebSockets  
✅ **Local-first** - Works offline, syncs when online  

### Immediate Next Steps

1. **Review this document** - Validate architecture decisions
2. **Download Phase 1 starter files** - See next response
3. **Set up PartyKit account** - https://partykit.io
4. **Begin Phase 1 implementation** - Week 1 tasks
5. **Weekly checkpoints** - Review progress, adjust plan

---

**Questions? Concerns? Let's discuss before starting implementation.**
