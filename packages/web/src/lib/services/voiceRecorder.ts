/**
 * Voice Recorder Service
 *
 * Records audio from the user's microphone for bug reports.
 * Uses MediaRecorder API with WebM/Opus format.
 */

export interface VoiceRecording {
	blob: Blob;
	duration: number; // in milliseconds
	timestamp: string;
}

export class VoiceRecorder {
	private mediaRecorder: MediaRecorder | null = null;
	private audioChunks: Blob[] = [];
	private startTime: number = 0;
	private endTime: number = 0;

	/**
	 * Request microphone permission and initialize recorder
	 */
	async initialize(): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			// Prefer WebM with Opus codec for better compression
			const mimeType = this.getSupportedMimeType();
			this.mediaRecorder = new MediaRecorder(stream, { mimeType });

			// Set up event handlers
			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.audioChunks.push(event.data);
				}
			};

			this.mediaRecorder.onstop = () => {
				this.endTime = Date.now();
			};
		} catch (error) {
			throw new Error(`Failed to initialize voice recorder: ${error}`);
		}
	}

	/**
	 * Start recording audio
	 */
	startRecording(): void {
		if (!this.mediaRecorder) {
			throw new Error('Voice recorder not initialized');
		}

		if (this.mediaRecorder.state === 'recording') {
			return; // Already recording
		}

		this.audioChunks = [];
		this.startTime = Date.now();
		this.mediaRecorder.start(100); // Collect data every 100ms
	}

	/**
	 * Stop recording and return the audio blob
	 */
	async stopRecording(): Promise<VoiceRecording> {
		if (!this.mediaRecorder) {
			throw new Error('Voice recorder not initialized');
		}

		if (this.mediaRecorder.state !== 'recording') {
			throw new Error('Not currently recording');
		}

		return new Promise((resolve) => {
			if (!this.mediaRecorder) {
				throw new Error('Voice recorder not initialized');
			}

			this.mediaRecorder.onstop = () => {
				this.endTime = Date.now();

				const audioBlob = new Blob(this.audioChunks, {
					type: this.mediaRecorder?.mimeType,
				});

				const duration = this.endTime - this.startTime;
				const timestamp = new Date().toISOString();

				resolve({
					blob: audioBlob,
					duration,
					timestamp,
				});
			};

			this.mediaRecorder?.stop();
		});
	}

	/**
	 * Get current recording state
	 */
	get state(): 'inactive' | 'recording' | 'paused' {
		if (!this.mediaRecorder) return 'inactive';
		return this.mediaRecorder.state as 'inactive' | 'recording' | 'paused';
	}

	/**
	 * Clean up resources and release microphone
	 */
	dispose(): void {
		if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
			this.mediaRecorder.stop();
		}

		if (this.mediaRecorder) {
			const stream = this.mediaRecorder.stream;
			stream.getTracks().forEach((track) => {
				track.stop();
			});
		}

		this.mediaRecorder = null;
		this.audioChunks = [];
	}

	/**
	 * Get the best supported MIME type for audio recording
	 */
	private getSupportedMimeType(): string {
		const types = [
			'audio/webm;codecs=opus',
			'audio/webm',
			'audio/ogg;codecs=opus',
			'audio/mp4',
			'audio/webm;codecs=vp8,opus',
		];

		for (const type of types) {
			if (MediaRecorder.isTypeSupported(type)) {
				return type;
			}
		}

		// Fallback - browser should support this
		return 'audio/webm';
	}
}

// Singleton instance
export const voiceRecorder = new VoiceRecorder();
