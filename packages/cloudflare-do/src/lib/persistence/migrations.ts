/**
 * DO SQLite Migrations for Persistence
 *
 * Initialize persistence tables in Durable Object SQLite storage.
 * Called once during DO initialization (idempotent).
 */

/**
 * Initialize persistence tables in DO SQLite.
 * Called once during DO initialization.
 */
export function initPersistenceTables(ctx: DurableObjectState): void {
	// Pending domain events (cleared after successful batch persist)
	ctx.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS pending_domain_events (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_version TEXT NOT NULL DEFAULT '1.0',
      sequence_number INTEGER NOT NULL,
      turn_number INTEGER,
      roll_number INTEGER,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)
    )
  `);

	ctx.storage.sql.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_events_game
    ON pending_domain_events(game_id, sequence_number)
  `);

	// Persistence queue (for retry on failure)
	ctx.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS persistence_queue (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL,
      game_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      scheduled_for INTEGER NOT NULL
    )
  `);

	ctx.storage.sql.exec(`
    CREATE INDEX IF NOT EXISTS idx_queue_scheduled
    ON persistence_queue(scheduled_for)
  `);

	// Game metadata (for tracking Supabase game ID across hibernation)
	ctx.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS game_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

/**
 * Clear all pending domain events (after successful persistence).
 */
export function clearPendingEvents(ctx: DurableObjectState, gameId: string): void {
	ctx.storage.sql.exec(`DELETE FROM pending_domain_events WHERE game_id = ?`, gameId);
}

/**
 * Clear game metadata (after game completion).
 */
export function clearGameMetadata(ctx: DurableObjectState): void {
	ctx.storage.sql.exec(`DELETE FROM game_metadata`);
}

/**
 * Get stored Supabase game ID (for recovery after hibernation).
 */
export function getSupabaseGameId(ctx: DurableObjectState): string | null {
	const cursor = ctx.storage.sql.exec(
		`SELECT value FROM game_metadata WHERE key = 'supabase_game_id'`,
	);
	const rows = [...cursor];
	return rows[0]?.value as string | null;
}

/**
 * Store Supabase game ID (for recovery after hibernation).
 */
export function setSupabaseGameId(ctx: DurableObjectState, gameId: string): void {
	ctx.storage.sql.exec(
		`INSERT OR REPLACE INTO game_metadata (key, value) VALUES ('supabase_game_id', ?)`,
		gameId,
	);
}

/**
 * Get stored event sequence number (for recovery after hibernation).
 */
export function getEventSequence(ctx: DurableObjectState): number {
	const cursor = ctx.storage.sql.exec(
		`SELECT value FROM game_metadata WHERE key = 'event_sequence'`,
	);
	const rows = [...cursor];
	if (rows[0]?.value) {
		return parseInt(rows[0].value as string, 10);
	}
	return 0;
}

/**
 * Store event sequence number (for recovery after hibernation).
 */
export function setEventSequence(ctx: DurableObjectState, sequence: number): void {
	ctx.storage.sql.exec(
		`INSERT OR REPLACE INTO game_metadata (key, value) VALUES ('event_sequence', ?)`,
		sequence.toString(),
	);
}

/**
 * Get all pending domain events for a game.
 */
export function getPendingEvents(
	ctx: DurableObjectState,
	gameId: string,
): Array<{
	id: string;
	game_id: string;
	player_id: string;
	event_type: string;
	event_version: string;
	sequence_number: number;
	turn_number: number | null;
	roll_number: number | null;
	payload: Record<string, unknown>;
	timestamp: number;
}> {
	const cursor = ctx.storage.sql.exec(
		`SELECT * FROM pending_domain_events WHERE game_id = ? ORDER BY sequence_number ASC`,
		gameId,
	);

	return [...cursor].map((row) => ({
		id: row.id as string,
		game_id: row.game_id as string,
		player_id: row.player_id as string,
		event_type: row.event_type as string,
		event_version: (row.event_version as string) || '1.0',
		sequence_number: row.sequence_number as number,
		turn_number: row.turn_number as number | null,
		roll_number: row.roll_number as number | null,
		payload: JSON.parse(row.payload as string),
		timestamp: row.timestamp as number,
	}));
}
