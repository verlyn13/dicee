<!-- Bug Report Admin Panel -->
<script lang="ts">
import BugReportDashboard from './BugReportDashboard.svelte';
import BugReportTrigger from './BugReportTrigger.svelte';

// Props
interface Props {
	class?: string;
}
let { class: className = '' }: Props = $props();

// State
let showDashboard = $state(false);
</script>

<div class="flex items-center gap-4 {className}">
	<!-- Bug Report Trigger -->
	<BugReportTrigger />
	
	<!-- Dashboard Button -->
	<button
		type="button"
		class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center gap-2"
		onclick={() => (showDashboard = true)}
	>
		<span>📊</span>
		View Reports
	</button>
</div>

<!-- Dashboard Modal -->
<BugReportDashboard open={showDashboard} onClose={() => (showDashboard = false)} />
