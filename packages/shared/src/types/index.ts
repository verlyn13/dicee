/**
 * Type Exports
 *
 * Re-export all types from @dicee/shared/types
 */

// Dice types
export type { DiceArray, KeptMask, DiceValue, DiceIndex, RollNumber, RollsRemaining } from './dice.js';
export { DICE_COUNT, MAX_ROLLS_PER_TURN } from './dice.js';

// Category types
export type { Category } from './category.js';
export {
	UPPER_CATEGORIES,
	LOWER_CATEGORIES,
	ALL_CATEGORIES,
	CATEGORY_COUNT,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
	DICEE_BONUS_VALUE,
	FIXED_SCORES,
	isValidCategory,
	isUpperCategory,
	isLowerCategory,
} from './category.js';

// Scorecard types
export type { Scorecard } from './scorecard.js';
export {
	createEmptyScorecard,
	calculateUpperSum,
	calculateTotalScore,
	getRemainingCategories,
	isScorecardComplete,
	isCategoryScored,
	getScoredCategoryCount,
} from './scorecard.js';

// Player types
export type {
	ConnectionStatus,
	PlayerType,
	PlayerGameState,
	PlayerRanking,
	RoomPlayer,
	AIRoomPlayer,
} from './player.js';
export { createPlayerGameState } from './player.js';

// Game types
export type { GamePhase, GameConfig, GameState } from './game.js';
export {
	isValidTransition,
	isPlayingPhase,
	getCurrentPlayerId,
	getCurrentPlayer,
	isPlayerTurn,
	MAX_TURNS,
	MIN_PLAYERS,
	MAX_PLAYERS,
	STARTING_COUNTDOWN_SECONDS,
	AFK_WARNING_SECONDS,
	AFK_TIMEOUT_SECONDS,
} from './game.js';

// Room types
export type { RoomCode, RoomState, RoomConfig, GameRoom } from './room.js';
export {
	DEFAULT_ROOM_CONFIG,
	ROOM_CLEANUP_MS,
	ROOM_CODE_CHARS,
	ROOM_CODE_LENGTH,
} from './room.js';

// Chat types
export type {
	ReactionEmoji,
	QuickChatKey,
	MessageReactions,
	ChatMessage,
	TypingState,
	ChatErrorCode,
} from './chat.js';
export {
	REACTION_EMOJIS,
	QUICK_CHAT_MESSAGES,
	QUICK_CHAT_KEYS,
	CHAT_RATE_LIMITS,
	createEmptyReactions,
} from './chat.js';

// Lobby types
export type {
	LobbyUser,
	LobbyUserPresence,
	LobbyRoomInfo,
	LobbyChatMessage,
	GameInvite,
	JoinRequest,
} from './lobby.js';
export {
	LOBBY_CHAT_MAX_LENGTH,
	LOBBY_CHAT_HISTORY_SIZE,
	LOBBY_CHAT_RATE_LIMIT,
	INVITE_EXPIRATION_MS,
} from './lobby.js';

// Room identity types
export type { CartridgeColor, CartridgePattern, RoomIdentity } from './room-identity.js';
export { CARTRIDGE_COLORS, CARTRIDGE_PATTERNS, isCartridgeColor, isCartridgePattern } from './room-identity.js';

// Admin types
export type {
	AdminRole,
	AdminPermission,
	AdminPermissionKey,
	AdminPermissionRecord,
	AdminAction,
	AdminAuditEntry,
	AdminInfo,
	AdminProfile,
	AdminErrorResponse,
	AdminSuccessResponse,
	AdminRoomsResponse,
	AdminConnectionsResponse,
	AdminAuditLogResponse,
} from './admin.js';
export {
	ADMIN_ROLE_HIERARCHY,
	ADMIN_PERMISSIONS,
	DEFAULT_ROLE_PERMISSIONS,
	hasRolePrivilege,
	roleHasPermission,
	createAuditEntry,
} from './admin.js';
