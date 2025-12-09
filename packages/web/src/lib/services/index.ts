/**
 * Services Module
 *
 * External service integrations and platform APIs.
 */

export {
	type AudioState,
	audio,
	getAudioState,
	initAudio,
	isAudioSupported,
	playSound,
	SOUND_BANK,
	type SoundCategory,
	type SoundId,
} from './audio';
export {
	analyzeTurnOptimal,
	EngineInitError,
	getEngineState,
	initializeEngine,
	isEngineReady,
	isNewEngineEnabled,
	preloadEngine,
	resetEngine,
} from './engine';
export {
	getTelemetryState,
	hasConsent,
	initializeTelemetry,
	resetTelemetry,
	setConsent,
	setUserId,
	shutdownTelemetry,
	TelemetryEventType,
	track,
	trackPageView,
} from './telemetry';
