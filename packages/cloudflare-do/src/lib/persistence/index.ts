/**
 * Persistence Module Exports
 *
 * DO→Supabase persistence bridge for game data.
 */

// Schemas and types
export {
	GameRecordSchema,
	GamePlayerRecordSchema,
	DomainEventSchema,
	PersistenceResultSchema,
	AggregationRequestSchema,
	GAME_STATUSES,
	GAME_MODES,
	DOMAIN_EVENT_TYPES,
	type GameRecord,
	type GamePlayerRecord,
	type DomainEvent,
	type PersistenceResult,
	type AggregationRequest,
	type GameStatus,
	type GameMode,
	type DomainEventType,
} from './schemas';

// Services
export { GamePersistenceService } from './game-persistence.service';

// Queue
export {
	PersistenceQueue,
	PERSISTENCE_TASK_TYPES,
	type PersistenceTask,
	type PersistenceTaskType,
} from './persistence-queue';

// Migrations and helpers
export {
	initPersistenceTables,
	clearPendingEvents,
	clearGameMetadata,
	getSupabaseGameId,
	setSupabaseGameId,
	getEventSequence,
	setEventSequence,
	getPendingEvents,
} from './migrations';

// Schema validation (compile-time only, ensures no schema drift)
export { SCHEMA_MAPPINGS } from './schema-validation';
