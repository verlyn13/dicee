<script lang="ts">
/**
 * Profile Page
 *
 * Allows authenticated users to view and edit their profile.
 * Displays ProfileForm component with current user data.
 */
import { invalidate } from '$app/navigation';
import ProfileForm from '$lib/components/profile/ProfileForm.svelte';
import type { Profile } from '$lib/supabase/profiles';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// Handle profile update - refresh the page data
function handleProfileUpdate(updatedProfile: Profile) {
	// Invalidate the page data to trigger a reload
	invalidate('supabase:auth');
}
</script>

<svelte:head>
	<title>Profile | Dicee</title>
	<meta name="description" content="Edit your Dicee profile" />
</svelte:head>

<div class="profile-page">
	<div class="container">
		<header class="page-header">
			<h1 class="page-title">Your Profile</h1>
			<p class="page-description">
				Manage your display name, avatar, and bio. Your profile is visible to other players.
			</p>
		</header>

		<main class="page-content">
			<ProfileForm profile={data.profile} onUpdate={handleProfileUpdate} />
		</main>
	</div>
</div>

<style>
	.profile-page {
		min-height: 100vh;
		background: var(--color-background);
		padding: var(--space-4) var(--space-2);
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	/* Page Header */
	.page-header {
		margin-bottom: var(--space-4);
		text-align: center;
	}

	.page-title {
		font-size: var(--text-h1);
		font-weight: var(--weight-bold);
		color: var(--color-text);
		margin-bottom: var(--space-2);
	}

	.page-description {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		max-width: 600px;
		margin: 0 auto;
	}

	/* Page Content */
	.page-content {
		display: flex;
		justify-content: center;
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-medium);
	}

	/* Mobile adjustments */
	@media (max-width: 767px) {
		.profile-page {
			padding: var(--space-3) var(--space-1);
		}

		.page-title {
			font-size: var(--text-h2);
		}

		.page-content {
			padding: var(--space-2);
		}
	}
</style>
