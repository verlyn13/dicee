<!-- Bug Reporter Component -->
<script lang="ts">
import { onMount } from 'svelte';
import { type BugReportSubmission, bugReportService } from '$lib/services/bugReport';
import { initializeConsoleCapture } from '$lib/services/consoleCapture';
import { type VoiceRecording, voiceRecorder } from '$lib/services/voiceRecorder';

// Props
interface Props {
	open: boolean;
	onClose: () => void;
}
let { open, onClose }: Props = $props();

// State
let isSubmitting = $state(false);
let isRecording = $state(false);
let recordingTime = $state(0);
let recording: VoiceRecording | null = $state(null);
let transcription = $state('');
let isTranscribing = $state(false);

// Form data
let severity = $state<'blocking' | 'annoying' | 'noticed'>('annoying');
let title = $state('');
let description = $state('');

// UI state
let error = $state('');
let success = $state(false);
let recordingInterval: number | null = null;

// Initialize console capture when component mounts
onMount(() => {
	initializeConsoleCapture();
});

// Start voice recording
async function startRecording() {
	try {
		await voiceRecorder.initialize();
		voiceRecorder.startRecording();
		isRecording = true;
		error = '';

		// Start timer
		recordingInterval = setInterval(() => {
			recordingTime++;
		}, 1000) as unknown as number;
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to start recording';
	}
}

// Stop voice recording
async function stopRecording() {
	try {
		recording = await voiceRecorder.stopRecording();
		isRecording = false;

		// Clear timer
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}

		// Start transcription
		await transcribeAudio();
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to stop recording';
		isRecording = false;
	}
}

// Transcribe audio using Cloudflare Workers AI
async function transcribeAudio() {
	if (!recording) return;

	isTranscribing = true;
	error = '';

	try {
		// Convert audio blob to base64
		const reader = new FileReader();
		const base64Promise = new Promise<string>((resolve) => {
			reader.onload = () => resolve(reader.result as string);
			reader.readAsDataURL(recording!.blob);
		});

		const base64Audio = await base64Promise;

		// Send to transcription endpoint
		const response = await fetch('/api/transcribe', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				audio: base64Audio,
				mimeType: recording.blob.type,
			}),
		});

		if (!response.ok) {
			throw new Error('Transcription failed');
		}

		const result = await response.json();
		transcription = result.text || '';
	} catch (err) {
		error = err instanceof Error ? err.message : 'Transcription failed';
	} finally {
		isTranscribing = false;
	}
}

// Submit bug report
async function submitBugReport() {
	if (!title.trim()) {
		error = 'Please enter a title for the bug report';
		return;
	}

	isSubmitting = true;
	error = '';

	try {
		const submission: BugReportSubmission = {
			severity,
			title: title.trim(),
			description: description.trim() || undefined,
			audioBlob: recording?.blob,
			audioTranscription: transcription || undefined,
		};

		await bugReportService.submitBugReport(submission);

		success = true;

		// Reset form after delay
		setTimeout(() => {
			resetForm();
			onClose();
		}, 2000);
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to submit bug report';
	} finally {
		isSubmitting = false;
	}
}

// Reset form
function resetForm() {
	title = '';
	description = '';
	severity = 'annoying';
	recording = null;
	transcription = '';
	recordingTime = 0;
	error = '';
	success = false;

	// Clean up voice recorder
	voiceRecorder.dispose();
}

// Format recording time
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Severity options
const severityOptions = [
	{ value: 'blocking', label: 'Blocking' },
	{ value: 'annoying', label: 'Annoying' },
	{ value: 'noticed', label: 'Noticed' },
] as const;

// Close handler
function handleClose() {
	if (isRecording) {
		stopRecording();
	}
	resetForm();
	onClose();
}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
					<span class="text-red-500">⚠️</span>
					Report a Bug
				</h2>
				<p class="text-gray-600 mt-1">
					Help us improve Dicee by reporting issues with detailed information.
				</p>
			</div>
			
			<div class="p-6 space-y-6">
				{#if error}
					<div class="bg-red-50 border border-red-200 rounded-md p-4">
						<div class="flex">
							<span class="text-red-500">❌</span>
							<p class="ml-3 text-red-700">{error}</p>
						</div>
					</div>
				{/if}
				
				{#if success}
					<div class="bg-green-50 border border-green-200 rounded-md p-4">
						<div class="flex">
							<span class="text-green-500">✅</span>
							<p class="ml-3 text-green-700">
								Bug report submitted successfully! Thank you for helping improve Dicee.
							</p>
						</div>
					</div>
				{:else}
					<!-- Severity Selection -->
					<div class="space-y-2">
						<span class="block text-sm font-medium text-gray-700">Severity</span>
						<div class="flex gap-2">
							{#each severityOptions as option}
								<button
									type="button"
									class="px-3 py-2 text-sm font-medium rounded-md border transition-colors"
									class:border-gray-300={severity !== option.value}
									class:bg-white={severity !== option.value}
									class:text-gray-700={severity !== option.value}
									class:bg-blue-600={severity === option.value}
									class:text-white={severity === option.value}
									class:border-blue-600={severity === option.value}
									onclick={() => (severity = option.value)}
									disabled={isSubmitting}
								>
									{option.label}
								</button>
							{/each}
						</div>
					</div>
					
					<!-- Title -->
					<div class="space-y-2">
						<label class="block text-sm font-medium text-gray-700" for="title">Title *</label>
						<input
							id="title"
							type="text"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="Brief description of the issue"
							bind:value={title}
							disabled={isSubmitting}
						/>
					</div>
					
					<!-- Description -->
					<div class="space-y-2">
						<label class="block text-sm font-medium text-gray-700" for="description">Description</label>
						<textarea
							id="description"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder="More details about what happened..."
							bind:value={description}
							rows={3}
							disabled={isSubmitting}
						></textarea>
					</div>
					
					<!-- Voice Recording -->
					<div class="space-y-3">
						<span class="block text-sm font-medium text-gray-700">Voice Recording</span>
						
						{#if !recording}
							<div class="flex items-center gap-3">
								<button
									type="button"
									class="px-4 py-2 text-sm font-medium rounded-md border transition-colors flex items-center gap-2"
									class:bg-red-600={isRecording}
									class:text-white={isRecording}
									class:border-red-600={isRecording}
									class:bg-white={!isRecording}
									class:text-gray-700={!isRecording}
									class:border-gray-300={!isRecording}
									onclick={isRecording ? stopRecording : startRecording}
									disabled={isTranscribing || isSubmitting}
								>
									{#if isRecording}
										<span>🔴</span>
										Stop Recording
									{:else}
										<span>🎤</span>
										Start Recording
									{/if}
								</button>
								
								{#if isRecording}
									<span class="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded-full">
										{formatTime(recordingTime)}
									</span>
								{/if}
							</div>
						{/if}
						
						{#if isTranscribing}
							<div class="flex items-center gap-2 text-sm text-gray-600">
								<span class="animate-spin">⏳</span>
								Transcribing audio...
							</div>
						{/if}
						
						{#if transcription}
							<div class="space-y-2">
								<span class="block text-sm font-medium text-gray-700">Transcription</span>
								<div class="p-3 bg-gray-50 rounded-md text-sm text-gray-700">
									{transcription}
								</div>
							</div>
						{/if}
					</div>
					
					<!-- Actions -->
					<div class="flex justify-between pt-4 border-t border-gray-200">
						<button
							type="button"
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							onclick={handleClose}
							disabled={isSubmitting}
						>
							Cancel
						</button>
						
						<button
							type="button"
							class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center gap-2"
							onclick={submitBugReport}
							disabled={isSubmitting || !title.trim()}
						>
							{#if isSubmitting}
								<span class="animate-spin">⏳</span>
								Submitting...
							{:else}
								<span>📤</span>
								Submit Report
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}