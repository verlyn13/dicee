/**
 * Multiplayer Type Definitions
 * 
 * Core types for multiplayer Dicee game.
 */

import type { Category, DiceArray, KeptMask, Scorecard } from './base';

// ============================================================================
// User Profile
// ============================================================================

export interface UserProfile {
  id: string;
  username: string;
  avatar: AvatarConfig;
  createdAt: Date;
  updatedAt: Date;
  stats: PlayerStatistics;
  settings: UserSettings;
}

export interface AvatarConfig {
  type: 'identicon' | 'emoji' | 'custom';
  seed: string;
  color: string;
}

export interface PlayerStatistics {
  gamesPlayed: number;
  gamesWon: number;
  averageScore: number;
  highScore: number;
  totalYahtzees: number;
  averageTurnsToComplete: number;
  favoriteCategory: Category | null;
  winRate: number;
  lastPlayedAt: Date | null;
  totalPlayTimeMinutes: number;
}

export interface UserSettings {
  soundEnabled: boolean;
  animationsEnabled: boolean;
  statsProfile: 'beginner' | 'intermediate' | 'expert';
  autoRoll: boolean;
  confirmScoring: boolean;
}

// ============================================================================
// Game Room
// ============================================================================

export interface GameRoom {
  id: string;
  createdAt: Date;
  createdBy: string;
  config: RoomConfig;
  players: Player[];
  maxPlayers: 4;
  state: GameRoomState;
  currentTurnPlayerId: string | null;
  turnNumber: number;
  events: GameEvent[];
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface RoomConfig {
  isPublic: boolean;
  allowSpectators: boolean;
  turnTimeoutSeconds: number;
  autoKickInactivePlayers: boolean;
}

export type GameRoomState =
  | 'waiting'
  | 'starting'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'abandoned';

export interface Player {
  id: string;
  profile: UserProfile;
  connected: boolean;
  isHost: boolean;
  joinedAt: Date;
  scorecard: Scorecard;
  currentScore: number;
  currentDice?: DiceArray;
  keptDice?: KeptMask;
  rollsRemaining?: number;
}

// ============================================================================
// Events (Event Sourcing)
// ============================================================================

export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  playerId: string;
  roomId: string;
  metadata?: {
    optimistic?: boolean;
    [key: string]: unknown;
  };
}

export interface PlayerJoinedEvent extends BaseEvent {
  type: 'player.joined';
  data: {
    player: Player;
  };
}

export interface PlayerLeftEvent extends BaseEvent {
  type: 'player.left';
  data: {
    graceful: boolean;
  };
}

export interface GameStartedEvent extends BaseEvent {
  type: 'game.started';
  data: {
    playerOrder: string[];
  };
}

export interface TurnStartedEvent extends BaseEvent {
  type: 'turn.started';
  data: {
    turnNumber: number;
  };
}

export interface DiceRolledEvent extends BaseEvent {
  type: 'dice.rolled';
  data: {
    dice: DiceArray;
    rollNumber: number;
    kept: KeptMask;
  };
}

export interface DiceKeptEvent extends BaseEvent {
  type: 'dice.kept';
  data: {
    index: number;
    kept: boolean;
  };
}

export interface CategoryScoredEvent extends BaseEvent {
  type: 'category.scored';
  data: {
    category: Category;
    score: number;
    dice: DiceArray;
    alternativeScores: Record<Category, number>;
    expectedValue: number;
    optimalPlay: boolean;
  };
}

export interface TurnEndedEvent extends BaseEvent {
  type: 'turn.ended';
  data: {
    nextPlayerId: string;
  };
}

export interface GameCompletedEvent extends BaseEvent {
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
    duration: number;
    totalTurns: number;
  };
}

export type GameEvent =
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | GameStartedEvent
  | TurnStartedEvent
  | DiceRolledEvent
  | DiceKeptEvent
  | CategoryScoredEvent
  | TurnEndedEvent
  | GameCompletedEvent;

// ============================================================================
// Commands
// ============================================================================

export interface BaseCommand {
  type: string;
  playerId: string;
}

export interface RollDiceCommand extends BaseCommand {
  type: 'dice.roll';
}

export interface KeepDiceCommand extends BaseCommand {
  type: 'dice.keep';
  index: number;
}

export interface ScoreCategoryCommand extends BaseCommand {
  type: 'category.score';
  category: Category;
}

export type Command =
  | RollDiceCommand
  | KeepDiceCommand
  | ScoreCategoryCommand;

// ============================================================================
// Sync Messages
// ============================================================================

export interface StateSyncMessage {
  type: 'state.sync';
  data: GameRoom;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | GameEvent
  | StateSyncMessage
  | ErrorMessage;
