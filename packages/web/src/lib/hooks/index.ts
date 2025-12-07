/**
 * Svelte Hooks
 * Reusable composable logic for components
 */

export {
	KEY_BINDINGS,
	type KeyboardNavigationOptions,
	type KeyboardNavigationState,
	useKeyboardNavigation,
} from './useKeyboardNavigation.svelte.js';

export {
	trackCategoryHover,
	trackCategoryScore,
	trackDecisionQuality,
	trackError,
	trackGameComplete,
	trackGameStart,
	trackHintRequested,
	trackRoll,
} from './useTelemetryGameHooks.js';
