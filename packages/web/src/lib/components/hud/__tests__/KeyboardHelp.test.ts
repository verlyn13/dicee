/**
 * KeyboardHelp Component Tests
 */

import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import KeyboardHelp from '../KeyboardHelp.svelte';

describe('KeyboardHelp', () => {
	it('renders help toggle button', () => {
		render(KeyboardHelp);
		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('title', 'Keyboard shortcuts');
	});

	it('shows question mark icon', () => {
		render(KeyboardHelp);
		expect(screen.getByText('?')).toBeInTheDocument();
	});

	it('starts collapsed', () => {
		render(KeyboardHelp);
		expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
	});

	it('expands on click', async () => {
		render(KeyboardHelp);
		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
	});

	it('collapses on second click', async () => {
		render(KeyboardHelp);
		const button = screen.getByRole('button');

		// Expand
		await fireEvent.click(button);
		expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

		// Collapse
		await fireEvent.click(button);
		expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
	});

	it('displays all key bindings when expanded', async () => {
		render(KeyboardHelp);
		await fireEvent.click(screen.getByRole('button'));

		expect(screen.getByText('Roll dice')).toBeInTheDocument();
		expect(screen.getByText('Toggle keep for dice')).toBeInTheDocument();
		expect(screen.getByText('Keep all dice')).toBeInTheDocument();
		expect(screen.getByText('Release all dice')).toBeInTheDocument();
	});

	it('displays key codes', async () => {
		render(KeyboardHelp);
		await fireEvent.click(screen.getByRole('button'));

		expect(screen.getByText('R / Space')).toBeInTheDocument();
		expect(screen.getByText('1-5')).toBeInTheDocument();
		expect(screen.getByText('A')).toBeInTheDocument();
		expect(screen.getByText('Z')).toBeInTheDocument();
	});

	it('has correct accessibility attributes', () => {
		render(KeyboardHelp);
		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(button).toHaveAttribute('aria-controls', 'keyboard-shortcuts');
	});

	it('updates aria-expanded when toggled', async () => {
		render(KeyboardHelp);
		const button = screen.getByRole('button');

		expect(button).toHaveAttribute('aria-expanded', 'false');

		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
	});
});
