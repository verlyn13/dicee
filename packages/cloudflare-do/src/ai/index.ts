/**
 * AI Module
 *
 * Server-authoritative AI opponents for Dicee.
 * Runs entirely in Cloudflare Durable Objects.
 */

// Brain types and factory
export type { AIBrain, BrainOptions, CategoryEV, KeepAnalysis } from './brain';
export {
	checkWasmAvailability,
	createBrain,
	getAvailableBrainTypes,
	initializeBrainFactory,
	isBrainTypeAvailable,
	isWasmEnabled,
	OptimalBrain,
	PersonalityBrain,
	ProbabilisticBrain,
	RandomBrain,
	registerBrain,
} from './brain';
// Chat (AI chat responses)
export type { ChatContext, ChatTrigger } from './chat';
export {
	analyzeRollQuality,
	generateChatResponse,
	getScoreTriggers,
	shouldReact,
} from './chat';
// Controller (manages AI turns in game rooms)
export type { AICommand, AIControllerConfig, CommandExecutor, EventEmitter } from './controller';
export { AIController, getAIController, resetAIController } from './controller';
// Engine (WASM/TypeScript probability calculations)
export type { DiceeEngine, TurnAnalysis } from './engine';
export { getEngine, resetEngine } from './engine';

// GameRoom Integration
export type { EventBroadcaster, GameCommandExecutor } from './gameroom-integration';
export {
	AIRoomManager,
	createAIPlayerState,
	getAIProfileForPlayer,
	isAIPlayerState,
} from './gameroom-integration';
// Profiles
export {
	AI_PROFILES,
	CARMEN,
	CHARLIE,
	getDefaultProfile,
	getProfile,
	getProfilesByDifficulty,
	getRandomProfile,
	LIAM,
	PROFESSOR,
	PROFILE_LIST,
	RILEY,
} from './profiles';
// Types
export type {
	AIEvent,
	AIPlayerState,
	AIProfile,
	AITiming,
	AITraits,
	BrainType,
	CreateAIPlayerOptions,
	GameContext,
	TurnAction,
	TurnDecision,
} from './types';
