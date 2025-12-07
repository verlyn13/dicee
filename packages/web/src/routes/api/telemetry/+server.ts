/**
 * Telemetry API Endpoint
 *
 * Receives batched telemetry events from the client and stores them in Supabase.
 * Supports both authenticated and anonymous event collection.
 *
 * POST /api/telemetry
 * Body: { events: TelemetryEvent[] }
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import type { Json } from '$lib/types/database';
import type { TelemetryEvent } from '$lib/types/telemetry';

/**
 * Maximum events per request (prevent abuse)
 */
const MAX_EVENTS_PER_REQUEST = 50;

/**
 * Validate a single telemetry event
 */
function validateEvent(event: unknown): event is TelemetryEvent {
	if (typeof event !== 'object' || event === null) {
		return false;
	}

	const e = event as Record<string, unknown>;

	// Required fields
	if (typeof e.session_id !== 'string' || e.session_id.length < 1) {
		return false;
	}

	if (typeof e.event_type !== 'string' || e.event_type.length < 1) {
		return false;
	}

	if (typeof e.payload !== 'object' || e.payload === null) {
		return false;
	}

	if (typeof e.timestamp !== 'string') {
		return false;
	}

	return true;
}

/**
 * Handle POST requests with batched telemetry events
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();

		// Validate request body
		if (!body.events || !Array.isArray(body.events)) {
			return json({ error: 'Missing events array' }, { status: 400 });
		}

		if (body.events.length === 0) {
			return json({ success: true, count: 0 });
		}

		if (body.events.length > MAX_EVENTS_PER_REQUEST) {
			return json({ error: `Too many events (max ${MAX_EVENTS_PER_REQUEST})` }, { status: 400 });
		}

		// Validate each event
		const validEvents: TelemetryEvent[] = [];
		for (const event of body.events) {
			if (validateEvent(event)) {
				validEvents.push(event);
			}
		}

		if (validEvents.length === 0) {
			return json({ error: 'No valid events' }, { status: 400 });
		}

		// Get current user (if authenticated)
		const { user } = await locals.safeGetSession();

		// Prepare events for insertion
		const eventsToInsert = validEvents.map((event) => ({
			session_id: event.session_id,
			user_id: user?.id ?? event.user_id ?? null,
			event_type: event.event_type,
			payload: event.payload as unknown as Json,
			page_url: event.page_url ?? null,
			referrer: event.referrer ?? null,
			user_agent: event.user_agent ?? null,
			timestamp: event.timestamp,
		}));

		// Insert events into Supabase
		const { error } = await locals.supabase.from('telemetry_events').insert(eventsToInsert);

		if (error) {
			console.error('Telemetry insert error:', error);
			return json({ error: 'Failed to store events' }, { status: 500 });
		}

		return json({ success: true, count: eventsToInsert.length });
	} catch (err) {
		console.error('Telemetry API error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
