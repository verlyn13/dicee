/**
 * Viewport Observer
 *
 * Handles iOS Safari viewport issues including:
 * - Dynamic viewport height changes (address bar collapse/expand)
 * - Pinch-to-zoom corruption detection and repair
 * - Safe area inset management
 * - Fallback for browsers without dvh support
 *
 * The iOS viewport issue stems from Safari's dynamic UI - the address bar
 * collapses on scroll, changing the actual viewport height. When using `100vh`,
 * iOS interprets this as the *largest* possible viewport (with collapsed chrome),
 * causing content to be hidden behind the toolbar when it's visible.
 *
 * @module utils/viewport
 */

import { browser } from '$app/environment';

// =============================================================================
// Types
// =============================================================================

type ViewportCallback = (height: number) => void;

interface ViewportState {
	width: number;
	height: number;
	scale: number;
}

// =============================================================================
// ViewportObserver Class
// =============================================================================

class ViewportObserver {
	private callbacks: Set<ViewportCallback> = new Set();
	private rafId: number | null = null;
	private lastHeight = 0;
	private lastValidState: ViewportState | null = null;
	private corruptionDetected = false;

	constructor() {
		if (!browser) return;

		this.updateViewport();
		this.setupListeners();
		this.saveValidState();
	}

	private setupListeners(): void {
		// Resize handles orientation changes and keyboard
		window.addEventListener('resize', this.handleResize);

		// Visual viewport API for more accurate measurements
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', this.handleResize);
			window.visualViewport.addEventListener('scroll', this.handleViewportScroll);
		}

		// Orientation change as backup
		window.addEventListener('orientationchange', () => {
			// Delay to allow browser to complete rotation
			setTimeout(() => {
				this.updateViewport();
				this.saveValidState();
			}, 100);
		});

		// Detect pinch-zoom start via touch events
		document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
		document.addEventListener('touchend', this.handleTouchEnd, { passive: true });
	}

	private handleResize = (): void => {
		if (this.rafId !== null) return;

		this.rafId = requestAnimationFrame(() => {
			this.updateViewport();
			this.checkForCorruption();
			this.rafId = null;
		});
	};

	private handleViewportScroll = (): void => {
		// Visual viewport scroll happens during pinch-zoom
		this.checkForCorruption();
	};

	private handleTouchStart = (e: TouchEvent): void => {
		// Multi-touch indicates potential pinch
		if (e.touches.length >= 2) {
			this.saveValidState();
		}
	};

	private handleTouchEnd = (): void => {
		// After touch ends, check if viewport was corrupted
		setTimeout(() => {
			this.checkForCorruption();
		}, 100);
	};

	private updateViewport(): void {
		// Use visualViewport when available (more accurate on mobile)
		const height = window.visualViewport?.height ?? window.innerHeight;

		if (height === this.lastHeight) return;
		this.lastHeight = height;

		// Set CSS custom property for fallback
		const vh = height * 0.01;
		document.documentElement.style.setProperty('--vh-fallback', `${vh}px`);
		document.documentElement.style.setProperty('--viewport-height', `${height}px`);

		// Notify subscribers
		for (const cb of this.callbacks) {
			cb(height);
		}
	}

	private saveValidState(): void {
		if (!browser) return;

		const vv = window.visualViewport;
		this.lastValidState = {
			width: vv?.width ?? window.innerWidth,
			height: vv?.height ?? window.innerHeight,
			scale: vv?.scale ?? 1,
		};
	}

	private checkForCorruption(): void {
		if (!browser || !this.lastValidState) return;

		const vv = window.visualViewport;
		const currentScale = vv?.scale ?? 1;

		// Corruption indicators:
		// 1. Scale is not 1 (zoomed in/out)
		// 2. Visual viewport is much smaller than layout viewport
		const isZoomed = Math.abs(currentScale - 1) > 0.01;
		const viewportMismatch =
			vv && Math.abs(vv.height - window.innerHeight) > 50 && currentScale > 1;

		if (isZoomed || viewportMismatch) {
			if (!this.corruptionDetected) {
				this.corruptionDetected = true;
				// Add class for CSS-based recovery
				document.documentElement.classList.add('viewport-corrupted');
			}
		} else if (this.corruptionDetected) {
			this.corruptionDetected = false;
			document.documentElement.classList.remove('viewport-corrupted');
			this.saveValidState();
		}
	}

	/**
	 * Attempt to repair corrupted viewport by resetting zoom
	 */
	repair(): void {
		if (!browser) return;

		// Force a reflow by toggling a class
		document.documentElement.classList.add('viewport-repair');

		// Reset viewport meta to force scale reset
		const viewportMeta = document.querySelector('meta[name="viewport"]');
		if (viewportMeta) {
			const content = viewportMeta.getAttribute('content') || '';
			// Temporarily set to non-scalable, then restore
			viewportMeta.setAttribute(
				'content',
				'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
			);

			requestAnimationFrame(() => {
				viewportMeta.setAttribute('content', content);
				document.documentElement.classList.remove('viewport-repair');
				this.corruptionDetected = false;
				document.documentElement.classList.remove('viewport-corrupted');
				this.updateViewport();
				this.saveValidState();
			});
		}
	}

	/**
	 * Check if viewport appears corrupted
	 */
	isCorrupted(): boolean {
		return this.corruptionDetected;
	}

	/**
	 * Subscribe to viewport height changes
	 */
	subscribe(callback: ViewportCallback): () => void {
		this.callbacks.add(callback);
		callback(this.lastHeight); // Immediate call with current value

		return () => this.callbacks.delete(callback);
	}

	/**
	 * Cleanup listeners
	 */
	destroy(): void {
		window.removeEventListener('resize', this.handleResize);

		if (window.visualViewport) {
			window.visualViewport.removeEventListener('resize', this.handleResize);
			window.visualViewport.removeEventListener('scroll', this.handleViewportScroll);
		}

		document.removeEventListener('touchstart', this.handleTouchStart);
		document.removeEventListener('touchend', this.handleTouchEnd);

		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
		}
	}
}

// =============================================================================
// Singleton & Exports
// =============================================================================

let observer: ViewportObserver | null = null;

/**
 * Get or create the viewport observer singleton
 */
export function getViewportObserver(): ViewportObserver | null {
	if (!observer && browser) {
		observer = new ViewportObserver();
	}
	return observer;
}

/**
 * Initialize viewport fix (call from layout)
 */
export function initViewportFix(): () => void {
	const obs = getViewportObserver();

	// Set initial CSS custom properties
	if (browser) {
		// Check for dvh support
		const supportsDvh = CSS.supports('height', '100dvh');
		if (!supportsDvh) {
			document.documentElement.classList.add('no-dvh');
		}

		// Prevent pull-to-refresh on app shell
		document.body.style.overscrollBehavior = 'none';
	}

	return () => {
		obs?.destroy();
		observer = null;
	};
}

/**
 * Check if current browser supports dynamic viewport units
 */
export function supportsDynamicViewport(): boolean {
	if (!browser) return true;
	return CSS.supports('height', '100dvh');
}

/**
 * Attempt to repair viewport if corrupted
 */
export function repairViewport(): void {
	observer?.repair();
}

/**
 * Check if viewport appears corrupted
 */
export function isViewportCorrupted(): boolean {
	return observer?.isCorrupted() ?? false;
}
