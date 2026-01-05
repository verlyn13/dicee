/**
 * Action Breadcrumb Buffer
 *
 * Tracks recent user actions for bug report context.
 * Limited to 20 most recent actions to manage memory.
 */

interface ActionBreadcrumb {
	action: string; // 'click:roll_button', 'toggle:keep_die_3'
	target: string; // Component name or CSS selector
	timestamp: number;
	metadata?: Record<string, unknown>;
}

const BUFFER_SIZE = 20;
let buffer: ActionBreadcrumb[] = [];

export function recordAction(
	action: string,
	target: string,
	metadata?: Record<string, unknown>,
): void {
	buffer.push({
		action,
		target,
		timestamp: Date.now(),
		metadata,
	});

	if (buffer.length > BUFFER_SIZE) {
		buffer.shift();
	}
}

export function getBreadcrumbs(): ActionBreadcrumb[] {
	return [...buffer];
}

export function clearBreadcrumbs(): void {
	buffer = [];
}
