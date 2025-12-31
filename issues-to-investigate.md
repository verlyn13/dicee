# Comprehensive iOS Viewport Fix Implementation

The strategy you've outlined is solid. Let me expand it into a production-ready implementation that handles edge cases, provides robust fallbacks, and integrates cleanly with Svelte/Astro.

## Understanding the Problem

The iOS viewport issue stems from Safari's dynamic UI—the address bar collapses on scroll, changing the actual viewport height. When you use `100vh`, iOS interprets this as the *largest* possible viewport (with collapsed chrome), causing content to be hidden behind the toolbar when it's visible.

## Complete Implementation

### 1. Global CSS with Progressive Enhancement

```css
/* app.css or global.postcss */

:root {
  /* 
   * Viewport height variables with fallback chain:
   * 1. dvh (dynamic) - changes as browser chrome appears/disappears
   * 2. svh (small) - viewport with all browser UI visible
   * 3. lvh (large) - viewport with minimal browser UI
   * 4. vh - legacy fallback
   */
  --viewport-height-dynamic: 100dvh;
  --viewport-height-small: 100svh;
  --viewport-height-large: 100lvh;
  
  /* Safe area insets for notch/home indicator */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  
  /* JavaScript-calculated fallback (set by viewport observer) */
  --vh-fallback: 1vh;
}

/* Feature query for browsers without dvh support */
@supports not (height: 100dvh) {
  :root {
    --viewport-height-dynamic: calc(var(--vh-fallback) * 100);
  }
}

/* Base mobile container */
.viewport-full {
  height: 100dvh;
  height: var(--viewport-height-dynamic); /* Fallback chain */
  width: 100%;
  overflow: hidden;
}

/* Safe area aware container */
.viewport-safe {
  height: 100dvh;
  height: var(--viewport-height-dynamic);
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
  box-sizing: border-box;
}

/* Flex column layout for app shells */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: var(--viewport-height-dynamic);
}

.app-shell__header {
  flex-shrink: 0;
  padding-top: var(--safe-top);
}

.app-shell__content {
  flex: 1 1 auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
}

.app-shell__footer {
  flex-shrink: 0;
  padding-bottom: var(--safe-bottom);
}
```

### 2. JavaScript Viewport Observer (Fallback)

Create a utility for browsers without `dvh` support:

```typescript
// lib/viewport.ts

type ViewportCallback = (height: number) => void;

class ViewportObserver {
  private callbacks: Set<ViewportCallback> = new Set();
  private rafId: number | null = null;
  private lastHeight: number = 0;
  
  constructor() {
    if (typeof window === 'undefined') return;
    
    this.updateViewport();
    this.setupListeners();
  }
  
  private setupListeners(): void {
    // Resize handles orientation changes and keyboard
    window.addEventListener('resize', this.handleResize);
    
    // Visual viewport API for more accurate measurements
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleResize);
      window.visualViewport.addEventListener('scroll', this.handleResize);
    }
    
    // Orientation change as backup
    window.addEventListener('orientationchange', () => {
      // Delay to allow browser to complete rotation
      setTimeout(() => this.updateViewport(), 100);
    });
  }
  
  private handleResize = (): void => {
    if (this.rafId !== null) return;
    
    this.rafId = requestAnimationFrame(() => {
      this.updateViewport();
      this.rafId = null;
    });
  };
  
  private updateViewport(): void {
    // Use visualViewport when available (more accurate on mobile)
    const height = window.visualViewport?.height ?? window.innerHeight;
    
    if (height === this.lastHeight) return;
    this.lastHeight = height;
    
    // Set CSS custom property
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh-fallback', `${vh}px`);
    
    // Notify subscribers
    this.callbacks.forEach(cb => cb(height));
  }
  
  subscribe(callback: ViewportCallback): () => void {
    this.callbacks.add(callback);
    callback(this.lastHeight); // Immediate call with current value
    
    return () => this.callbacks.delete(callback);
  }
  
  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.handleResize);
      window.visualViewport.removeEventListener('scroll', this.handleResize);
    }
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

// Singleton instance
let observer: ViewportObserver | null = null;

export function getViewportObserver(): ViewportObserver {
  if (!observer && typeof window !== 'undefined') {
    observer = new ViewportObserver();
  }
  return observer!;
}

export function initViewportFix(): void {
  getViewportObserver();
}
```

### 3. Svelte Layout Component

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { initViewportFix } from '$lib/viewport';
  
  let { children } = $props();
  
  // Feature detection
  let supportsDvh = $state(true);
  
  onMount(() => {
    // Check for dvh support
    supportsDvh = CSS.supports('height', '100dvh');
    
    // Initialize fallback if needed
    if (!supportsDvh) {
      initViewportFix();
    }
    
    // Prevent pull-to-refresh on the app shell (optional)
    document.body.style.overscrollBehavior = 'none';
  });
</script>

<div 
  class="app-shell"
  class:no-dvh={!supportsDvh}
>
  {@render children()}
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    overflow: hidden;
    
    /* Safe area handling */
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }
  
  /* Fallback for browsers without dvh */
  .app-shell.no-dvh {
    height: calc(var(--vh-fallback, 1vh) * 100);
  }
  
  /* Ensure proper stacking context */
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
  }
</style>
```

### 4. Reusable Viewport Component

For specific mobile containers like your Dicee UI:

```svelte
<!-- components/MobileViewport.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    class?: string;
    safeArea?: boolean;
    scrollable?: boolean;
    children: Snippet;
  }
  
  let { 
    class: className = '',
    safeArea = true,
    scrollable = false,
    children 
  }: Props = $props();
</script>

<div 
  class="mobile-viewport {className}"
  class:safe-area={safeArea}
  class:scrollable
>
  {@render children()}
</div>

<style>
  .mobile-viewport {
    height: 100dvh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .mobile-viewport.safe-area {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  
  .mobile-viewport.scrollable {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  /* Fallback */
  @supports not (height: 100dvh) {
    .mobile-viewport {
      height: calc(var(--vh-fallback, 1vh) * 100);
    }
  }
</style>
```

### 5. Tailwind Configuration (if using)

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      height: {
        'dvh': '100dvh',
        'svh': '100svh',
        'lvh': '100lvh',
        'screen-safe': 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      minHeight: {
        'dvh': '100dvh',
        'svh': '100svh',
        'lvh': '100lvh',
      },
      padding: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
      },
    },
  },
};
```

### 6. HTML Meta Tags

Ensure your `app.html` or Astro layout includes:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

The `viewport-fit=cover` is critical—it tells iOS to extend content into the safe areas, allowing your CSS to handle the insets.

## Testing Checklist

| Scenario | What to verify |
|----------|----------------|
| iOS Safari (address bar visible) | Content fits without scrolling |
| iOS Safari (address bar hidden) | Content expands smoothly |
| iPhone with notch | Content not obscured by notch or home indicator |
| Orientation change | Layout recalculates correctly |
| Keyboard open | Input fields remain accessible |
| iPad split view | Viewport adjusts to split dimensions |
| Android Chrome | Consistent behavior with iOS |
| Desktop browsers | Graceful fallback to standard vh |

## Common Gotchas

1. **Position fixed elements**: These ignore dvh; use `inset-*` properties with safe area insets instead
2. **Nested scroll containers**: Only one element should scroll; others need `overflow: hidden`
3. **Virtual keyboard**: The VisualViewport API handles this, but you may need additional logic for form-heavy UIs
4. **CSS-in-JS**: Ensure your CSS custom properties are set before first paint

This approach provides a robust foundation that handles the iOS viewport issue while maintaining compatibility across browsers and providing clean integration with your Svelte/Astro stack.

---

# Comprehensive Mobile-First Responsive Design System

This builds on the viewport fix to create an intelligent, space-aware responsive system that adapts not just to width, but to the actual usable vertical space—critical for mobile UX.

## Core Philosophy

Traditional responsive design focuses on width breakpoints. Mobile UX requires considering:
- **Vertical space scarcity** (especially with keyboard open)
- **Thumb reach zones** (bottom of screen is prime real estate)
- **Content density adaptation** (not just scaling, but restructuring)
- **Interaction patterns** (tap targets, gesture areas)

## 1. Space-Aware CSS Architecture

```css
/* responsive.css - Core responsive system */

:root {
  /* ===== Viewport Units ===== */
  --vh-dynamic: 1dvh;
  --vw: 1vw;
  
  /* ===== Breakpoint Tokens ===== */
  /* Width breakpoints */
  --bp-xs: 320px;
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  
  /* Height breakpoints - often overlooked */
  --bp-h-xs: 480px;   /* Very short - landscape phones */
  --bp-h-sm: 600px;   /* Short - older phones, keyboard open */
  --bp-h-md: 700px;   /* Medium - most phones */
  --bp-h-lg: 800px;   /* Tall - modern phones */
  --bp-h-xl: 900px;   /* Very tall - tablets portrait */
  
  /* ===== Spacing Scale (fluid) ===== */
  --space-3xs: clamp(0.125rem, 0.5dvh, 0.25rem);
  --space-2xs: clamp(0.25rem, 1dvh, 0.5rem);
  --space-xs: clamp(0.5rem, 1.5dvh, 0.75rem);
  --space-sm: clamp(0.75rem, 2dvh, 1rem);
  --space-md: clamp(1rem, 3dvh, 1.5rem);
  --space-lg: clamp(1.5rem, 4dvh, 2rem);
  --space-xl: clamp(2rem, 5dvh, 3rem);
  
  /* ===== Typography Scale (fluid) ===== */
  --text-xs: clamp(0.625rem, 1.5dvh, 0.75rem);
  --text-sm: clamp(0.75rem, 2dvh, 0.875rem);
  --text-base: clamp(0.875rem, 2.5dvh, 1rem);
  --text-lg: clamp(1rem, 3dvh, 1.25rem);
  --text-xl: clamp(1.25rem, 4dvh, 1.5rem);
  --text-2xl: clamp(1.5rem, 5dvh, 2rem);
  --text-3xl: clamp(2rem, 6dvh, 2.5rem);
  
  /* ===== Touch Targets ===== */
  --touch-min: 44px;  /* Apple HIG minimum */
  --touch-comfortable: 48px;  /* Material Design */
  --touch-spacious: 56px;
  
  /* ===== Layout Tokens ===== */
  --header-height: clamp(48px, 8dvh, 64px);
  --footer-height: clamp(56px, 10dvh, 72px);
  --content-max-width: min(100%, 600px);
  
  /* ===== Safe Areas ===== */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  
  /* ===== Calculated Values ===== */
  --content-height: calc(100dvh - var(--header-height) - var(--footer-height) - var(--safe-top) - var(--safe-bottom));
}

/* ===== Height-Based Adaptations ===== */

/* Very short screens (landscape phones, keyboard visible) */
@media (max-height: 480px) {
  :root {
    --header-height: 40px;
    --footer-height: 48px;
    --space-md: 0.5rem;
    --space-lg: 0.75rem;
  }
}

/* Short screens */
@media (max-height: 600px) {
  :root {
    --header-height: 44px;
    --footer-height: 52px;
  }
}

/* Tall screens - can breathe */
@media (min-height: 800px) {
  :root {
    --header-height: 64px;
    --footer-height: 72px;
    --space-lg: 2rem;
    --space-xl: 3rem;
  }
}

/* ===== Aspect Ratio Queries ===== */

/* Portrait orientation - maximize vertical content */
@media (orientation: portrait) {
  :root {
    --layout-direction: column;
    --content-priority: vertical;
  }
}

/* Landscape - horizontal layout preferred */
@media (orientation: landscape) {
  :root {
    --layout-direction: row;
    --content-priority: horizontal;
    --header-height: 40px;
    --footer-height: 44px;
  }
}

/* Square-ish screens (iPad, some Android tablets) */
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  :root {
    --content-max-width: min(90%, 800px);
  }
}
```

## 2. Svelte Responsive Context

```typescript
// lib/responsive/context.ts

export type ScreenCategory = 'compact' | 'medium' | 'expanded';
export type HeightCategory = 'cramped' | 'comfortable' | 'spacious';
export type Orientation = 'portrait' | 'landscape';

export interface ResponsiveState {
  // Dimensions
  width: number;
  height: number;
  availableHeight: number; // After header/footer/safe areas
  
  // Categories
  screen: ScreenCategory;
  heightCategory: HeightCategory;
  orientation: Orientation;
  
  // Flags
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isKeyboardVisible: boolean;
  hasNotch: boolean;
  
  // Touch
  isTouchDevice: boolean;
  
  // Computed helpers
  canShowSecondaryContent: boolean;
  shouldCollapseNavigation: boolean;
  optimalColumnCount: number;
}

export interface ResponsiveBreakpoints {
  width: { xs: number; sm: number; md: number; lg: number; xl: number };
  height: { xs: number; sm: number; md: number; lg: number; xl: number };
}

export const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
  width: { xs: 320, sm: 480, md: 768, lg: 1024, xl: 1280 },
  height: { xs: 480, sm: 600, md: 700, lg: 800, xl: 900 },
};
```

```typescript
// lib/responsive/store.svelte.ts

import { getContext, setContext } from 'svelte';
import type { ResponsiveState, ResponsiveBreakpoints } from './context';
import { DEFAULT_BREAKPOINTS } from './context';

const RESPONSIVE_KEY = Symbol('responsive');

function createResponsiveState(breakpoints: ResponsiveBreakpoints = DEFAULT_BREAKPOINTS) {
  // Core measurements
  let width = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
  let height = $state(typeof window !== 'undefined' ? window.innerHeight : 768);
  let visualHeight = $state(height);
  let initialHeight = $state(height);
  
  // Derived: Screen category
  const screen = $derived.by((): 'compact' | 'medium' | 'expanded' => {
    if (width < breakpoints.width.sm) return 'compact';
    if (width < breakpoints.width.lg) return 'medium';
    return 'expanded';
  });
  
  // Derived: Height category
  const heightCategory = $derived.by((): 'cramped' | 'comfortable' | 'spacious' => {
    if (visualHeight < breakpoints.height.sm) return 'cramped';
    if (visualHeight < breakpoints.height.lg) return 'comfortable';
    return 'spacious';
  });
  
  // Derived: Orientation
  const orientation = $derived.by((): 'portrait' | 'landscape' => {
    return height > width ? 'portrait' : 'landscape';
  });
  
  // Derived: Device type
  const isMobile = $derived(width < breakpoints.width.md);
  const isTablet = $derived(width >= breakpoints.width.md && width < breakpoints.width.lg);
  const isDesktop = $derived(width >= breakpoints.width.lg);
  
  // Derived: Keyboard detection (heuristic)
  const isKeyboardVisible = $derived.by(() => {
    if (!isMobile) return false;
    // If visual viewport is significantly smaller than initial, keyboard is likely open
    const reduction = initialHeight - visualHeight;
    return reduction > 150; // Typical mobile keyboard is 200-300px
  });
  
  // Derived: Notch detection
  const hasNotch = $derived.by(() => {
    if (typeof window === 'undefined') return false;
    const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top') || '0');
    return safeTop > 20;
  });
  
  // Derived: Touch device
  const isTouchDevice = $derived.by(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });
  
  // Derived: Available content height
  const availableHeight = $derived.by(() => {
    const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '56');
    const footerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--footer-height') || '56');
    const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top') || '0');
    const safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '0');
    return visualHeight - headerHeight - footerHeight - safeTop - safeBottom;
  });
  
  // Derived: Layout decisions
  const canShowSecondaryContent = $derived(heightCategory !== 'cramped' && !isKeyboardVisible);
  const shouldCollapseNavigation = $derived(isMobile || heightCategory === 'cramped');
  
  const optimalColumnCount = $derived.by(() => {
    if (screen === 'compact') return 1;
    if (screen === 'medium') return 2;
    if (orientation === 'landscape') return 3;
    return 2;
  });
  
  // Setup listeners
  function initialize() {
    if (typeof window === 'undefined') return () => {};
    
    initialHeight = window.innerHeight;
    
    const updateDimensions = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      visualHeight = window.visualViewport?.height ?? window.innerHeight;
    };
    
    window.addEventListener('resize', updateDimensions);
    window.visualViewport?.addEventListener('resize', updateDimensions);
    
    // Initial update
    updateDimensions();
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.visualViewport?.removeEventListener('resize', updateDimensions);
    };
  }
  
  return {
    // Raw values
    get width() { return width; },
    get height() { return height; },
    get visualHeight() { return visualHeight; },
    get availableHeight() { return availableHeight; },
    
    // Categories
    get screen() { return screen; },
    get heightCategory() { return heightCategory; },
    get orientation() { return orientation; },
    
    // Flags
    get isMobile() { return isMobile; },
    get isTablet() { return isTablet; },
    get isDesktop() { return isDesktop; },
    get isKeyboardVisible() { return isKeyboardVisible; },
    get hasNotch() { return hasNotch; },
    get isTouchDevice() { return isTouchDevice; },
    
    // Layout helpers
    get canShowSecondaryContent() { return canShowSecondaryContent; },
    get shouldCollapseNavigation() { return shouldCollapseNavigation; },
    get optimalColumnCount() { return optimalColumnCount; },
    
    initialize,
  };
}

export type ResponsiveStore = ReturnType<typeof createResponsiveState>;

export function setResponsiveContext(breakpoints?: ResponsiveBreakpoints): ResponsiveStore {
  const store = createResponsiveState(breakpoints);
  setContext(RESPONSIVE_KEY, store);
  return store;
}

export function getResponsive(): ResponsiveStore {
  return getContext<ResponsiveStore>(RESPONSIVE_KEY);
}
```

## 3. Root Layout with Responsive Provider

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setResponsiveContext } from '$lib/responsive/store.svelte';
  import '../styles/responsive.css';
  
  let { children } = $props();
  
  const responsive = setResponsiveContext();
  
  onMount(() => {
    return responsive.initialize();
  });
</script>

<div 
  class="app-root"
  class:compact={responsive.screen === 'compact'}
  class:medium={responsive.screen === 'medium'}
  class:expanded={responsive.screen === 'expanded'}
  class:cramped={responsive.heightCategory === 'cramped'}
  class:comfortable={responsive.heightCategory === 'comfortable'}
  class:spacious={responsive.heightCategory === 'spacious'}
  class:landscape={responsive.orientation === 'landscape'}
  class:keyboard-visible={responsive.isKeyboardVisible}
  data-screen={responsive.screen}
  data-height={responsive.heightCategory}
>
  {@render children()}
</div>

<style>
  .app-root {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    overflow: hidden;
    
    /* Safe areas */
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
    padding-left: var(--safe-left);
    padding-right: var(--safe-right);
  }
  
  /* Cramped height - minimize chrome */
  .app-root.cramped {
    --header-height: 40px;
    --footer-height: 44px;
    --space-md: 0.5rem;
  }
  
  /* Keyboard visible - collapse non-essential */
  .app-root.keyboard-visible {
    --header-height: 0px;
    --footer-height: 48px;
  }
  
  /* Landscape - side-by-side layout possible */
  .app-root.landscape {
    --layout-direction: row;
  }
  
  @supports not (height: 100dvh) {
    .app-root {
      height: calc(var(--vh-fallback, 1vh) * 100);
    }
  }
</style>
```

## 4. Adaptive Components

### Adaptive Header

```svelte
<!-- components/AdaptiveHeader.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getResponsive } from '$lib/responsive/store.svelte';
  
  interface Props {
    title?: string;
    leftAction?: Snippet;
    rightAction?: Snippet;
    children?: Snippet;
  }
  
  let { title, leftAction, rightAction, children }: Props = $props();
  
  const responsive = getResponsive();
  
  // Hide completely when keyboard is visible to maximize input space
  const isVisible = $derived(!responsive.isKeyboardVisible);
  
  // Compact mode for cramped heights
  const isCompact = $derived(responsive.heightCategory === 'cramped');
</script>

{#if isVisible}
  <header class="adaptive-header" class:compact={isCompact}>
    <div class="header-left">
      {#if leftAction}
        {@render leftAction()}
      {/if}
    </div>
    
    <div class="header-center">
      {#if children}
        {@render children()}
      {:else if title}
        <h1 class="header-title">{title}</h1>
      {/if}
    </div>
    
    <div class="header-right">
      {#if rightAction}
        {@render rightAction()}
      {/if}
    </div>
  </header>
{/if}

<style>
  .adaptive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height);
    padding-inline: var(--space-sm);
    background: var(--surface-primary, #fff);
    border-bottom: 1px solid var(--border-subtle, #e5e5e5);
    flex-shrink: 0;
    gap: var(--space-xs);
  }
  
  .adaptive-header.compact {
    padding-inline: var(--space-xs);
  }
  
  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    min-width: var(--touch-min);
  }
  
  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
    overflow: hidden;
  }
  
  .header-title {
    font-size: var(--text-lg);
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .compact .header-title {
    font-size: var(--text-base);
  }
</style>
```

### Adaptive Content Area

```svelte
<!-- components/AdaptiveContent.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getResponsive } from '$lib/responsive/store.svelte';
  
  interface Props {
    scrollable?: boolean;
    centered?: boolean;
    padded?: boolean;
    children: Snippet;
  }
  
  let { 
    scrollable = true, 
    centered = false,
    padded = true,
    children 
  }: Props = $props();
  
  const responsive = getResponsive();
</script>

<main 
  class="adaptive-content"
  class:scrollable
  class:centered
  class:padded
  class:cramped={responsive.heightCategory === 'cramped'}
  style:--available-height="{responsive.availableHeight}px"
>
  <div class="content-inner">
    {@render children()}
  </div>
</main>

<style>
  .adaptive-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Critical for flex scroll containers */
    overflow: hidden;
  }
  
  .adaptive-content.scrollable {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
  
  .content-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .adaptive-content.centered .content-inner {
    align-items: center;
    justify-content: center;
  }
  
  .adaptive-content.padded .content-inner {
    padding: var(--space-md);
  }
  
  .adaptive-content.cramped.padded .content-inner {
    padding: var(--space-xs);
  }
  
  /* Scroll shadows for visual depth */
  .adaptive-content.scrollable {
    background: 
      linear-gradient(var(--surface-primary, #fff) 30%, transparent),
      linear-gradient(transparent, var(--surface-primary, #fff) 70%) 0 100%,
      radial-gradient(farthest-side at 50% 0, rgba(0,0,0,.1), transparent),
      radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,.1), transparent) 0 100%;
    background-repeat: no-repeat;
    background-size: 100% 40px, 100% 40px, 100% 14px, 100% 14px;
    background-attachment: local, local, scroll, scroll;
  }
</style>
```

### Adaptive Footer / Bottom Navigation

```svelte
<!-- components/AdaptiveFooter.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getResponsive } from '$lib/responsive/store.svelte';
  
  interface NavItem {
    icon: string;
    label: string;
    href: string;
    active?: boolean;
  }
  
  interface Props {
    items?: NavItem[];
    children?: Snippet;
  }
  
  let { items = [], children }: Props = $props();
  
  const responsive = getResponsive();
  
  // Simplified footer when cramped
  const showLabels = $derived(responsive.heightCategory !== 'cramped');
</script>

<footer class="adaptive-footer" class:cramped={!showLabels}>
  {#if children}
    {@render children()}
  {:else}
    <nav class="footer-nav">
      {#each items as item}
        <a 
          href={item.href} 
          class="nav-item"
          class:active={item.active}
          aria-current={item.active ? 'page' : undefined}
        >
          <span class="nav-icon">{item.icon}</span>
          {#if showLabels}
            <span class="nav-label">{item.label}</span>
          {/if}
        </a>
      {/each}
    </nav>
  {/if}
</footer>

<style>
  .adaptive-footer {
    flex-shrink: 0;
    height: var(--footer-height);
    background: var(--surface-primary, #fff);
    border-top: 1px solid var(--border-subtle, #e5e5e5);
    padding-bottom: var(--safe-bottom);
  }
  
  .footer-nav {
    display: flex;
    justify-content: space-around;
    align-items: center;
    height: 100%;
    max-width: 500px;
    margin: 0 auto;
  }
  
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    padding: var(--space-2xs);
    color: var(--text-secondary, #666);
    text-decoration: none;
    border-radius: 8px;
    transition: all 0.15s ease;
  }
  
  .nav-item:active {
    background: var(--surface-active, rgba(0,0,0,0.05));
    transform: scale(0.95);
  }
  
  .nav-item.active {
    color: var(--color-primary, #0066cc);
  }
  
  .nav-icon {
    font-size: 1.5rem;
  }
  
  .nav-label {
    font-size: var(--text-xs);
    font-weight: 500;
  }
  
  /* Cramped mode - icons only */
  .adaptive-footer.cramped .nav-item {
    gap: 0;
  }
</style>
```

## 5. Space-Optimized Card Components

```svelte
<!-- components/AdaptiveCard.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getResponsive } from '$lib/responsive/store.svelte';
  
  interface Props {
    variant?: 'default' | 'compact' | 'hero';
    interactive?: boolean;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }
  
  let { 
    variant = 'default',
    interactive = false,
    children,
    header,
    footer
  }: Props = $props();
  
  const responsive = getResponsive();
  
  // Auto-compact when height is cramped
  const effectiveVariant = $derived(
    responsive.heightCategory === 'cramped' && variant === 'default' 
      ? 'compact' 
      : variant
  );
</script>

<article 
  class="adaptive-card {effectiveVariant}"
  class:interactive
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
>
  {#if header}
    <div class="card-header">
      {@render header()}
    </div>
  {/if}
  
  <div class="card-body">
    {@render children()}
  </div>
  
  {#if footer && responsive.canShowSecondaryContent}
    <div class="card-footer">
      {@render footer()}
    </div>
  {/if}
</article>

<style>
  .adaptive-card {
    background: var(--surface-card, #fff);
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    overflow: hidden;
  }
  
  .adaptive-card.interactive {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  
  .adaptive-card.interactive:active {
    transform: scale(0.98);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  
  /* Default variant */
  .adaptive-card.default .card-body {
    padding: var(--space-md);
  }
  
  .adaptive-card.default .card-header,
  .adaptive-card.default .card-footer {
    padding: var(--space-sm) var(--space-md);
  }
  
  /* Compact variant */
  .adaptive-card.compact {
    border-radius: 8px;
  }
  
  .adaptive-card.compact .card-body {
    padding: var(--space-sm);
  }
  
  .adaptive-card.compact .card-header,
  .adaptive-card.compact .card-footer {
    padding: var(--space-xs) var(--space-sm);
  }
  
  /* Hero variant - for featured content */
  .adaptive-card.hero .card-body {
    padding: var(--space-lg);
  }
  
  .card-header {
    border-bottom: 1px solid var(--border-subtle, #e5e5e5);
  }
  
  .card-footer {
    border-top: 1px solid var(--border-subtle, #e5e5e5);
    background: var(--surface-muted, #f9f9f9);
  }
</style>
```

## 6. Responsive Grid System

```svelte
<!-- components/ResponsiveGrid.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getResponsive } from '$lib/responsive/store.svelte';
  
  interface Props {
    minItemWidth?: number;
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
    children: Snippet;
  }
  
  let { 
    minItemWidth = 280,
    gap = 'md',
    children 
  }: Props = $props();
  
  const responsive = getResponsive();
  
  // Adjust minimum width based on screen
  const effectiveMinWidth = $derived(
    responsive.screen === 'compact' ? Math.min(minItemWidth, responsive.width - 32) : minItemWidth
  );
</script>

<div 
  class="responsive-grid gap-{gap}"
  style:--min-item-width="{effectiveMinWidth}px"
>
  {@render children()}
</div>

<style>
  .responsive-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--min-item-width), 1fr));
    width: 100%;
  }
  
  .gap-none { gap: 0; }
  .gap-xs { gap: var(--space-xs); }
  .gap-sm { gap: var(--space-sm); }
  .gap-md { gap: var(--space-md); }
  .gap-lg { gap: var(--space-lg); }
  
  /* Single column on very narrow screens */
  @media (max-width: 320px) {
    .responsive-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
```

## 7. Conditional Content Rendering

```svelte
<!-- components/ShowWhen.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getResponsive } from '$lib/responsive/store.svelte';
  
  interface Props {
    screen?: 'compact' | 'medium' | 'expanded' | ('compact' | 'medium' | 'expanded')[];
    height?: 'cramped' | 'comfortable' | 'spacious' | ('cramped' | 'comfortable' | 'spacious')[];
    orientation?: 'portrait' | 'landscape';
    not?: boolean;
    children: Snippet;
    fallback?: Snippet;
  }
  
  let { 
    screen,
    height,
    orientation,
    not = false,
    children,
    fallback
  }: Props = $props();
  
  const responsive = getResponsive();
  
  const shouldShow = $derived.by(() => {
    let matches = true;
    
    if (screen) {
      const screens = Array.isArray(screen) ? screen : [screen];
      matches = matches && screens.includes(responsive.screen);
    }
    
    if (height) {
      const heights = Array.isArray(height) ? height : [height];
      matches = matches && heights.includes(responsive.heightCategory);
    }
    
    if (orientation) {
      matches = matches && responsive.orientation === orientation;
    }
    
    return not ? !matches : matches;
  });
</script>

{#if shouldShow}
  {@render children()}
{:else if fallback}
  {@render fallback()}
{/if}
```

**Usage:**

```svelte
<ShowWhen height={['comfortable', 'spacious']}>
  <DetailedStats />
</ShowWhen>

<ShowWhen screen="compact">
  <MobileNav />
</ShowWhen>

<ShowWhen screen="compact" not>
  <DesktopSidebar />
</ShowWhen>
```

## 8. Example: Complete Mobile App Shell

```svelte
<!-- routes/+page.svelte -->
<script lang="ts">
  import { getResponsive } from '$lib/responsive/store.svelte';
  import AdaptiveHeader from '$lib/components/AdaptiveHeader.svelte';
  import AdaptiveContent from '$lib/components/AdaptiveContent.svelte';
  import AdaptiveFooter from '$lib/components/AdaptiveFooter.svelte';
  import AdaptiveCard from '$lib/components/AdaptiveCard.svelte';
  import ShowWhen from '$lib/components/ShowWhen.svelte';
  
  const responsive = getResponsive();
  
  const navItems = [
    { icon: '🏠', label: 'Home', href: '/', active: true },
    { icon: '🔍', label: 'Search', href: '/search' },
    { icon: '➕', label: 'Create', href: '/create' },
    { icon: '👤', label: 'Profile', href: '/profile' },
  ];
</script>

<AdaptiveHeader title="My App">
  {#snippet leftAction()}
    <button class="icon-btn">☰</button>
  {/snippet}
  
  {#snippet rightAction()}
    <button class="icon-btn">🔔</button>
  {/snippet}
</AdaptiveHeader>

<AdaptiveContent scrollable padded>
  <!-- Hero section - hidden when cramped -->
  <ShowWhen height={['comfortable', 'spacious']}>
    <section class="hero">
      <h1>Welcome back!</h1>
      <p>Here's what's happening today.</p>
    </section>
  </ShowWhen>
  
  <!-- Main content - always visible -->
  <section class="cards">
    <AdaptiveCard>
      <h2>Quick Stats</h2>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">42</span>
          <span class="stat-label">Tasks</span>
        </div>
        <div class="stat">
          <span class="stat-value">7</span>
          <span class="stat-label">Due Today</span>
        </div>
      </div>
    </AdaptiveCard>
    
    <AdaptiveCard variant="compact" interactive>
      <div class="action-item">
        <span>📝</span>
        <span>New Task</span>
        <span class="chevron">›</span>
      </div>
    </AdaptiveCard>
  </section>
  
  <!-- Debug info - dev only -->
  <ShowWhen screen="expanded">
    <aside class="debug">
      <pre>{JSON.stringify({
        screen: responsive.screen,
        height: responsive.heightCategory,
        available: responsive.availableHeight
      }, null, 2)}</pre>
    </aside>
  </ShowWhen>
</AdaptiveContent>

<AdaptiveFooter items={navItems} />

<style>
  .hero {
    text-align: center;
    padding: var(--space-lg) 0;
  }
  
  .hero h1 {
    font-size: var(--text-2xl);
    margin: 0 0 var(--space-xs);
  }
  
  .hero p {
    color: var(--text-secondary, #666);
    margin: 0;
  }
  
  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
    text-align: center;
  }
  
  .stat-value {
    display: block;
    font-size: var(--text-2xl);
    font-weight: 700;
  }
  
  .stat-label {
    font-size: var(--text-sm);
    color: var(--text-secondary, #666);
  }
  
  .action-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .chevron {
    margin-left: auto;
    color: var(--text-tertiary, #999);
  }
  
  .icon-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    padding: var(--space-xs);
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 8px;
  }
  
  .icon-btn:active {
    background: var(--surface-active, rgba(0,0,0,0.05));
  }
  
  .debug {
    margin-top: var(--space-lg);
    padding: var(--space-sm);
    background: var(--surface-muted, #f5f5f5);
    border-radius: 8px;
    font-size: var(--text-xs);
  }
</style>
```

## Summary

This system provides:

| Feature | Benefit |
|---------|---------|
| Height-aware breakpoints | UI adapts to actual usable space, not just width |
| Reactive stores | Components automatically respond to viewport changes |
| Keyboard detection | Critical UI remains accessible during text input |
| Progressive disclosure | Secondary content hidden when space is limited |
| Fluid typography/spacing | Scales proportionally to viewport |
| Safe area handling | Notch and home indicator accounted for |
| Touch-optimized targets | Minimum 44px tap targets throughout |
| Scroll shadows | Visual affordance for scrollable content |
| Component composition | Build complex layouts from simple primitives |

The architecture integrates cleanly with Svelte 5's runes and provides the foundation for building genuinely responsive mobile experiences that respect the user's actual screen real estate.