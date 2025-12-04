/**
 * Avatar Component Unit Tests
 *
 * Tests for Avatar.svelte - DiceBear avatar generation
 */

import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Avatar from '../Avatar.svelte';

describe('Avatar', () => {
	it('renders with default props', () => {
		const { container } = render(Avatar, {
			props: { seed: 'test-seed-123' },
		});

		const avatar = container.querySelector('.avatar');
		expect(avatar).toBeInTheDocument();
		expect(avatar).toHaveClass('avatar--md'); // default size
	});

	it('renders with custom seed', () => {
		const { container } = render(Avatar, {
			props: { seed: 'unique-user-id' },
		});

		const img = container.querySelector('img');
		expect(img).toBeInTheDocument();
		expect(img?.src).toContain('data:image/svg+xml');
	});

	it('generates consistent avatars for same seed', () => {
		const { container: container1 } = render(Avatar, {
			props: { seed: 'consistent-seed' },
		});

		const { container: container2 } = render(Avatar, {
			props: { seed: 'consistent-seed' },
		});

		const img1 = container1.querySelector('img');
		const img2 = container2.querySelector('img');

		expect(img1?.src).toBe(img2?.src);
	});

	it('generates different avatars for different seeds', () => {
		const { container: container1 } = render(Avatar, {
			props: { seed: 'seed-one' },
		});

		const { container: container2 } = render(Avatar, {
			props: { seed: 'seed-two' },
		});

		const img1 = container1.querySelector('img');
		const img2 = container2.querySelector('img');

		expect(img1?.src).not.toBe(img2?.src);
	});

	describe('size variants', () => {
		it('renders small size', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test', size: 'sm' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveClass('avatar--sm');

			const img = container.querySelector('img');
			expect(img?.width).toBe(40);
			expect(img?.height).toBe(40);
		});

		it('renders medium size (default)', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test', size: 'md' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveClass('avatar--md');

			const img = container.querySelector('img');
			expect(img?.width).toBe(64);
			expect(img?.height).toBe(64);
		});

		it('renders large size', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test', size: 'lg' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveClass('avatar--lg');

			const img = container.querySelector('img');
			expect(img?.width).toBe(128);
			expect(img?.height).toBe(128);
		});

		it('renders extra large size', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test', size: 'xl' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveClass('avatar--xl');

			const img = container.querySelector('img');
			expect(img?.width).toBe(256);
			expect(img?.height).toBe(256);
		});
	});

	describe('accessibility', () => {
		it('has role="img"', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveAttribute('role', 'img');
		});

		it('uses default alt text', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveAttribute('aria-label', 'Avatar');

			const img = container.querySelector('img');
			expect(img).toHaveAttribute('alt', 'Avatar');
		});

		it('uses custom alt text', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test', alt: 'User profile picture' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveAttribute('aria-label', 'User profile picture');

			const img = container.querySelector('img');
			expect(img).toHaveAttribute('alt', 'User profile picture');
		});
	});

	describe('custom styling', () => {
		it('accepts custom CSS classes', () => {
			const { container } = render(Avatar, {
				props: { seed: 'test', class: 'custom-class' },
			});

			const avatar = container.querySelector('.avatar');
			expect(avatar).toHaveClass('custom-class');
			expect(avatar).toHaveClass('avatar'); // still has base class
		});
	});

	describe('edge cases', () => {
		it('handles empty seed', () => {
			const { container } = render(Avatar, {
				props: { seed: '' },
			});

			const img = container.querySelector('img');
			expect(img).toBeInTheDocument();
			expect(img?.src).toContain('data:image/svg+xml');
		});

		it('handles special characters in seed', () => {
			const { container } = render(Avatar, {
				props: { seed: 'user@example.com!#$%' },
			});

			const img = container.querySelector('img');
			expect(img).toBeInTheDocument();
			expect(img?.src).toContain('data:image/svg+xml');
		});

		it('handles very long seed', () => {
			const longSeed = 'a'.repeat(1000);
			const { container } = render(Avatar, {
				props: { seed: longSeed },
			});

			const img = container.querySelector('img');
			expect(img).toBeInTheDocument();
		});
	});
});
