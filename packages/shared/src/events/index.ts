/**
 * Event Exports
 *
 * Re-export all command and event types from @dicee/shared/events
 */

// Commands (Client → Server)
export type {
	CreateRoomCommand,
	JoinRoomCommand,
	LeaveRoomCommand,
	AddAIPlayerCommand,
	RemoveAIPlayerCommand,
	StartGameCommand,
	RematchCommand,
	RollDiceCommand,
	KeepDiceCommand,
	ScoreCategoryCommand,
	ChatCommand,
	QuickChatCommand,
	ReactionCommand,
	TypingStartCommand,
	TypingStopCommand,
	RoomCommand,
	GameCommand,
	ChatCommandType,
	Command,
	CommandType,
	GetCommand,
} from './commands.js';
export { COMMAND_TYPES, isCommand, isValidCommandType } from './commands.js';

// Server Events (Server → Client)
export type {
	RoomCreatedEvent,
	RoomStateEvent,
	PlayerJoinedEvent,
	PlayerLeftEvent,
	AIPlayerJoinedEvent,
	PlayerConnectionEvent,
	GameStartingEvent,
	GameStartedEvent,
	TurnStartedEvent,
	TurnEndedEvent,
	TurnSkippedEvent,
	AfkWarningEvent,
	GameCompletedEvent,
	DiceRolledEvent,
	DiceKeptEvent,
	CategoryScoredEvent,
	GameStateSyncEvent,
	GameErrorEvent,
	ErrorEvent,
	ChatMessageEvent,
	ChatHistoryEvent,
	ReactionUpdateEvent,
	TypingUpdateEvent,
	ChatErrorEvent,
	RoomEvent,
	GameFlowEvent,
	DiceEvent,
	ScoringEvent,
	SyncEvent,
	ErrorEventType,
	ChatEvent,
	ServerEvent,
	ServerEventType,
	GetServerEvent,
} from './server-events.js';
export {
	SERVER_EVENT_TYPES,
	isValidServerEventType,
	isChatEvent,
	isGameFlowEvent,
	isDiceEvent,
	isRoomEvent,
} from './server-events.js';
