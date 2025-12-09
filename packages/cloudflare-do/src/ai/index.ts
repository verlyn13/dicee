/**
 * AI Module
 *
 * Server-authoritative AI opponents for Dicee.
 * Runs entirely in Cloudflare Durable Objects.
 */

// Types
export type {
	BrainType,
	AITraits,
	AITiming,
	AIProfile,
	GameContext,
	TurnAction,
	TurnDecision,
	AIPlayerState,
	AIEvent,
	CreateAIPlayerOptions,
} from './types';

// Profiles
export {
	RILEY,
	CARMEN,
	LIAM,
	PROFESSOR,
	CHARLIE,
	AI_PROFILES,
	PROFILE_LIST,
	getProfile,
	getRandomProfile,
	getProfilesByDifficulty,
	getDefaultProfile,
} from './profiles';

// Brain types and factory
export type { AIBrain, BrainOptions, CategoryEV, KeepAnalysis } from './brain';
export {
	createBrain,
	registerBrain,
	initializeBrainFactory,
	checkWasmAvailability,
	getAvailableBrainTypes,
	isBrainTypeAvailable,
	isWasmEnabled,
	OptimalBrain,
	ProbabilisticBrain,
	PersonalityBrain,
	RandomBrain,
} from './brain';

// Engine (WASM/TypeScript probability calculations)
export type { DiceeEngine, TurnAnalysis } from './engine';
export { getEngine, resetEngine } from './engine';

// Controller (manages AI turns in game rooms)
export type { AICommand, CommandExecutor, EventEmitter, AIControllerConfig } from './controller';
export { AIController, getAIController, resetAIController } from './controller';

// GameRoom Integration
export type { GameCommandExecutor, EventBroadcaster } from './gameroom-integration';
export {
	AIRoomManager,
	createAIPlayerState,
	isAIPlayerState,
	getAIProfileForPlayer,
} from './gameroom-integration';

// Chat (AI chat responses)
export type { ChatTrigger, ChatContext } from './chat';
export {
	generateChatResponse,
	shouldReact,
	analyzeRollQuality,
	getScoreTriggers,
} from './chat';
