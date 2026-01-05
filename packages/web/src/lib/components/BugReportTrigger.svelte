<!-- Bug Report Trigger Button -->
<script lang="ts">
import BugReporter from './BugReporter.svelte';

// Props
interface Props {
	size?: 'sm' | 'default' | 'lg';
	variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
	class?: string;
}
let { size = 'default', variant = 'outline', class: className = '' }: Props = $props();

// State
let showReporter = $state(false);

// Size classes
const sizeClasses = {
	sm: 'px-3 py-1 text-sm',
	default: 'px-4 py-2 text-base',
	lg: 'px-6 py-3 text-lg',
} as const;

// Variant classes
const variantClasses = {
	default: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
	outline: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
	secondary: 'bg-gray-100 text-gray-900 border-gray-200 hover:bg-gray-200',
	ghost: 'bg-transparent text-gray-700 border-transparent hover:bg-gray-100',
	link: 'bg-transparent text-blue-600 border-transparent hover:text-blue-700 underline',
	destructive: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
} as const;
</script>

<button
	class="{sizeClasses[size]} {variantClasses[variant]} border rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {className}"
	onclick={() => (showReporter = true)}
>
	<span class="mr-2">⚠️</span>
	Report Bug
</button>

{#if showReporter}
	<BugReporter open={showReporter} onClose={() => (showReporter = false)} />
{/if}
