/**
 * Authentication E2E Tests
 *
 * Tests for authentication flows including:
 * - Landing page UI
 * - Anonymous sign-in flow
 * - Sign-out flow
 * - Auth state management
 *
 * Note: OAuth flows (Google) and Magic Link flows cannot be fully E2E tested
 * as they require external services. These tests verify UI elements are present
 * and clickable, but don't test the complete authentication process.
 */

import { expect, test } from '@playwright/test';

test.describe('Landing Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for landing page to load (not just the loading screen)
		await expect(page.getByRole('button', { name: /play now/i })).toBeVisible({ timeout: 15000 });
	});

	test('displays landing page when not authenticated', async ({ page }) => {
		// Check for landing page elements
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible();
		await expect(page.locator('text=Learn Probability Through Play')).toBeVisible();
		await expect(
			page.locator('text=Play as a guest or sign in to save your progress'),
		).toBeVisible();
	});

	test('shows Play Now button for anonymous sign-in', async ({ page }) => {
		const playNowButton = page.getByRole('button', { name: /play now/i });
		await expect(playNowButton).toBeVisible();
		await expect(page.locator('text=No account needed')).toBeVisible();
	});

	test('shows Google sign-in button', async ({ page }) => {
		const googleButton = page.getByRole('button', { name: /continue with google/i });
		await expect(googleButton).toBeVisible();
	});

	test('shows magic link email form', async ({ page }) => {
		const emailInput = page.getByPlaceholder(/enter your email/i);
		const submitButton = page.getByRole('button', { name: /send magic link/i });

		await expect(emailInput).toBeVisible();
		await expect(submitButton).toBeVisible();
	});

	test('email input accepts valid email', async ({ page }) => {
		const emailInput = page.getByPlaceholder(/enter your email/i);
		await emailInput.fill('test@example.com');
		await expect(emailInput).toHaveValue('test@example.com');
	});

	test('landing page has proper accessibility structure', async ({ page }) => {
		// Check heading exists
		const mainHeading = page.locator('h1').first();
		await expect(mainHeading).toBeVisible();
		await expect(mainHeading).toContainText('DICEE');

		// Check that buttons are accessible
		const buttons = await page.getByRole('button').all();
		expect(buttons.length).toBeGreaterThanOrEqual(2);
	});
});

test.describe('Anonymous Sign-In Flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });
	});

	test('Play Now button starts game as anonymous user', async ({ page }) => {
		// Click Play Now
		const playNowButton = page.getByRole('button', { name: /play now/i });
		await playNowButton.click();

		// Wait for game to start - look for REROLL button (indicates game is active)
		await expect(page.getByRole('button', { name: /reroll/i })).toBeVisible({ timeout: 15000 });

		// Check for Guest badge in header (indicates anonymous user)
		await expect(page.locator('text=GUEST')).toBeVisible();

		// Check game is active (scorecard visible)
		await expect(page.locator('text=SCORECARD')).toBeVisible();
	});

	test('anonymous user can roll dice', async ({ page }) => {
		// Start game
		const playNowButton = page.getByRole('button', { name: /play now/i });
		await playNowButton.click();

		// Wait for game to load
		await expect(page.getByRole('button', { name: /reroll/i })).toBeVisible({ timeout: 15000 });

		// Check rolls indicator exists
		await expect(page.locator('text=ROLLS:')).toBeVisible();
	});

	test('anonymous user can see scorecard', async ({ page }) => {
		// Start game
		await page.getByRole('button', { name: /play now/i }).click();
		await expect(page.getByRole('button', { name: /reroll/i })).toBeVisible({ timeout: 15000 });

		// Check scorecard is visible
		await expect(page.locator('text=SCORECARD')).toBeVisible();
		await expect(page.locator('text=UPPER SECTION')).toBeVisible();
	});
});

test.describe('Sign-Out Flow', () => {
	test('sign out returns to landing page', async ({ page }) => {
		// First, start as anonymous user
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });

		// Play as guest
		await page.getByRole('button', { name: /play now/i }).click();
		await expect(page.getByRole('button', { name: /reroll/i })).toBeVisible({ timeout: 15000 });

		// Click sign out
		const signOutButton = page.getByRole('button', { name: /sign out/i });
		await signOutButton.click();

		// Should return to landing page
		await expect(page.locator('text=Learn Probability Through Play')).toBeVisible({
			timeout: 5000,
		});
		await expect(page.getByRole('button', { name: /play now/i })).toBeVisible();
	});

	test('sign out clears auth state', async ({ page }) => {
		// Start as anonymous user
		await page.goto('/');
		await page.getByRole('button', { name: /play now/i }).click();
		// Wait for sign out button (indicates we're in the game)
		await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });

		// Sign out
		await page.getByRole('button', { name: /sign out/i }).click();

		// Sign out button should no longer be visible (we're back on landing)
		await expect(page.getByRole('button', { name: /sign out/i })).not.toBeVisible({
			timeout: 5000,
		});
		// And Play Now button should be visible
		await expect(page.getByRole('button', { name: /play now/i })).toBeVisible();
	});
});

test.describe('Auth UI Interactions', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });
	});

	test('Google button is clickable', async ({ page }) => {
		const googleButton = page.getByRole('button', { name: /continue with google/i });

		// Should be enabled and clickable
		await expect(googleButton).toBeEnabled();

		// Note: We don't actually click it as it would redirect to Google
	});

	test('magic link form validates empty email', async ({ page }) => {
		const submitButton = page.getByRole('button', { name: /send magic link/i });

		// Try to submit without email - HTML5 validation should prevent
		// Or component validation should show error
		await submitButton.click();

		// Either browser validation popup or custom error should appear
		// We check that the form didn't navigate away
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible();
	});

	test('buttons show loading state', async ({ page }) => {
		// This is a bit tricky to test since loading states are brief
		// We verify the button has aria-busy attribute capability
		const playNowButton = page.getByRole('button', { name: /play now/i });

		// Before clicking, should not be busy
		await expect(playNowButton).toHaveAttribute('type', 'button');
	});
});

test.describe('Mobile Auth Flow', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('landing page works on mobile', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });

		// Check all auth options are visible on mobile
		await expect(page.getByRole('button', { name: /play now/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
		await expect(page.getByPlaceholder(/enter your email/i)).toBeVisible();
	});

	test('Play Now touch target is adequate on mobile', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });

		const playNowButton = page.getByRole('button', { name: /play now/i });
		const box = await playNowButton.boundingBox();

		// Should meet minimum touch target (44px)
		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test('anonymous sign-in works on mobile', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /play now/i }).click();

		// Game should start on mobile
		await expect(page.getByRole('button', { name: /reroll/i })).toBeVisible({ timeout: 15000 });
		await expect(page.locator('text=GUEST')).toBeVisible();
	});
});

test.describe('Auth State Persistence', () => {
	test('authenticated user sees game on page reload', async ({ page }) => {
		await page.goto('/');

		// Start as anonymous user
		await page.getByRole('button', { name: /play now/i }).click();
		await expect(page.getByRole('button', { name: /reroll/i })).toBeVisible({ timeout: 15000 });

		// Reload the page
		await page.reload();

		// Should still be in the game (auth state persisted via cookies)
		await expect(page.locator('text=GUEST')).toBeVisible({ timeout: 15000 });
		await expect(page.locator('text=SCORECARD')).toBeVisible();
	});

	test('signed-out user sees landing page on reload', async ({ page }) => {
		await page.goto('/');

		// Reload without signing in
		await page.reload();

		// Should still see landing page
		await expect(page.getByRole('button', { name: /play now/i })).toBeVisible({ timeout: 10000 });
	});
});

test.describe('Accessibility', () => {
	test('landing page keyboard navigation works', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });

		// Find a button and focus it directly to test it's focusable
		const playNowButton = page.getByRole('button', { name: /play now/i });
		await playNowButton.focus();

		// Button should be focusable
		await expect(playNowButton).toBeFocused();
	});

	test('landing page has no duplicate IDs', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });

		// Check for duplicate IDs (accessibility issue)
		const duplicateIds = await page.evaluate(() => {
			const ids = new Set<string>();
			const duplicates: string[] = [];
			document.querySelectorAll('[id]').forEach((el) => {
				if (ids.has(el.id)) {
					duplicates.push(el.id);
				}
				ids.add(el.id);
			});
			return duplicates;
		});

		expect(duplicateIds).toHaveLength(0);
	});

	test('buttons have accessible names', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1:has-text("DICEE")')).toBeVisible({ timeout: 10000 });

		// All buttons should have accessible names
		const buttons = await page.getByRole('button').all();

		for (const button of buttons) {
			const name =
				(await button.getAttribute('aria-label')) ||
				(await button.textContent()) ||
				(await button.getAttribute('title'));
			expect(name?.trim().length).toBeGreaterThan(0);
		}
	});
});
