/**
 * Audio Transcription API
 * 
 * HTTP endpoint for transcribing audio using Cloudflare Workers AI.
 * Uses Whisper model for speech-to-text conversion.
 */

import type { Env } from '../types';

export interface TranscriptionRequest {
	audio: string; // Base64-encoded audio data
	mimeType: string; // e.g., 'audio/webm;codecs=opus'
}

export interface TranscriptionResponse {
	text: string;
	confidence?: number;
	duration?: number;
	error?: string;
}

/**
 * Handle transcription requests
 */
export async function handleTranscribe(
	request: Request,
	env: Env
): Promise<Response> {
	// Only accept POST requests
	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	try {
		const body = await request.json() as TranscriptionRequest;

		if (!body.audio || !body.mimeType) {
			return Response.json({
				error: 'Missing audio data or mimeType'
			}, { status: 400 });
		}

		// Decode base64 audio
		const audioBuffer = base64ToArrayBuffer(body.audio);
		
		// Transcribe using Workers AI
		const transcription = await transcribeAudio(audioBuffer, env);

		return Response.json(transcription);

	} catch (error) {
		console.error('Transcription error:', error);
		
		return Response.json({
			error: 'Transcription failed',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}

/**
 * Transcribe audio using Cloudflare Workers AI Whisper model
 */
async function transcribeAudio(
	audioBuffer: ArrayBuffer,
	env: Env
): Promise<TranscriptionResponse> {
	try {
		const ai = env.AI;

		// @ts-ignore - Workers AI types may not be up to date
		const response = await ai.run('@cf/openai/whisper-tiny-en', {
			audio: [...new Uint8Array(audioBuffer)],
		});

		// Extract text from response
		const text = response.text || '';
		
		// Note: Whisper model doesn't provide confidence scores
		// We'll return undefined for confidence as it's not available

		return {
			text,
		};

	} catch (error) {
		console.error('Workers AI transcription error:', error);
		
		return {
			text: '',
			error: error instanceof Error ? error.message : 'Transcription failed'
		};
	}
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
	// Remove data URL prefix if present
	const base64Data = base64.replace(/^data:audio\/[^;]+;base64,/, '');
	
	const binaryString = atob(base64Data);
	const bytes = new Uint8Array(binaryString.length);
	
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	
	return bytes.buffer;
}

/**
 * Validate audio file size (max 25MB for Whisper model)
 */
export function validateAudioSize(audioBuffer: ArrayBuffer): boolean {
	const maxSizeBytes = 25 * 1024 * 1024; // 25MB
	return audioBuffer.byteLength <= maxSizeBytes;
}

/**
 * Get audio duration from buffer (approximate)
 * This is a rough estimate - for accurate duration you'd need to parse the audio file
 */
export function estimateAudioDuration(audioBuffer: ArrayBuffer, mimeType: string): number {
	// Rough estimate: 16kbps audio = 2KB per second
	const bytesPerSecond = 2000;
	return Math.round(audioBuffer.byteLength / bytesPerSecond);
}
