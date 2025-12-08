# Mobile virtual keyboard handling for web chat interfaces

The fundamental challenge with mobile keyboard handling in web apps is that **iOS Safari and Android Chrome now both default to keeping the layout viewport unchanged when the keyboard opens**, making traditional `position: fixed` approaches ineffective. iOS Safari lacks support for modern keyboard APIs entirely, while Android Chrome 108+ offers the `interactive-widget` meta tag and VirtualKeyboard API—but cross-platform solutions require the Visual Viewport API as a fallback. For SvelteKit chat apps, the recommended approach combines `interactive-widget=resizes-content` for Android, Visual Viewport API listeners for iOS, and flex-based layouts that avoid fixed positioning.

## Platform viewport behavior diverges significantly

The core difference between platforms lies in how they handle viewport resizing. On both iOS Safari and Android Chrome 108+, **only the Visual Viewport shrinks when the keyboard opens—the Layout Viewport remains unchanged**. This means viewport units (`vh`, `svh`, `dvh`) don't respond to keyboard appearance, and `position: fixed; bottom: 0` elements get hidden behind the keyboard.

| Behavior | iOS Safari | Android Chrome 108+ |
|----------|------------|-------------------|
| Layout Viewport on keyboard | No resize | No resize (default) |
| Visual Viewport on keyboard | Shrinks | Shrinks |
| `window.resize` fires | No | No |
| `visualViewport.resize` fires | Yes | Yes |
| VirtualKeyboard API | ❌ Not supported | ✅ Chrome 94+ |
| `interactive-widget` meta | ❌ Not supported | ✅ Chrome 108+ |
| `keyboard-inset-*` CSS env | ❌ Not supported | ✅ Chrome 94+ |

**iOS Safari quirks** deserve special attention. When the keyboard opens, Safari offsets the entire Layout Viewport upward to keep the focused input visible, which can push headers off-screen. The `position: fixed` behavior effectively becomes `position: absolute` relative to the scrolled document. Additionally, `env(safe-area-inset-bottom)` does **not** update when the keyboard appears—it only accounts for the home indicator.

Android Chrome 108 introduced a major breaking change in January 2023, switching from `resizes-content` (where layout viewport resized with keyboard) to `resizes-visual` (matching iOS behavior). This broke many existing chat implementations that relied on the viewport naturally shrinking.

## The interactive-widget meta tag provides Android control

For Android Chrome and Firefox 132+, the `interactive-widget` viewport meta tag restores control over keyboard behavior:

```html
<!-- Recommended for chat apps: both viewports resize -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">

<!-- Default: only visual viewport resizes (iOS-like) -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-visual">

<!-- Full manual control: neither resizes -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=overlays-content">
```

Using `resizes-content` makes Android behavior match the pre-Chrome 108 model where your flex-based chat layout naturally adjusts. However, **Safari ignores this completely**, requiring JavaScript fallbacks.

## Visual Viewport API enables cross-browser keyboard detection

The Visual Viewport API (`window.visualViewport`) provides the only reliable cross-browser method for detecting keyboard state on iOS:

```javascript
class MobileKeyboardHandler {
  constructor() {
    this.keyboardHeight = 0;
    this.isOpen = false;
    this.baseline = 0;
    
    if (window.visualViewport) {
      this.baseline = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', this.update.bind(this));
      window.visualViewport.addEventListener('scroll', this.update.bind(this));
    }
  }
  
  update() {
    const vv = window.visualViewport;
    const heightDiff = this.baseline - vv.height;
    
    // Threshold accounts for browser chrome changes
    this.isOpen = heightDiff > 150;
    this.keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    
    // Update CSS custom property for layout
    document.documentElement.style.setProperty(
      '--keyboard-height', 
      `${this.keyboardHeight}px`
    );
  }
}
```

The **150px threshold** distinguishes keyboard appearance from browser UI changes (address bar collapsing). Note that `visualViewport.offsetTop` represents how much the visual viewport has scrolled relative to the layout viewport—critical for positioning fixed elements correctly on iOS.

## VirtualKeyboard API offers superior control on Chromium

Chrome 94+ supports the VirtualKeyboard API, which provides **explicit keyboard geometry** and CSS environment variables:

```javascript
if ('virtualKeyboard' in navigator) {
  // Opt-in to overlay behavior
  navigator.virtualKeyboard.overlaysContent = true;
  
  navigator.virtualKeyboard.addEventListener('geometrychange', (e) => {
    const { height, width } = e.target.boundingRect;
    console.log(`Keyboard: ${width}x${height}`);
  });
}
```

This enables CSS-only keyboard-aware layouts on supported browsers:

```css
.chat-input-bar {
  position: fixed;
  bottom: 0;
  /* Reserve space for keyboard */
  margin-bottom: env(keyboard-inset-height, 0px);
  /* Plus safe area for home indicator */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

The `virtualkeyboardpolicy="manual"` HTML attribute allows suppressing automatic keyboard appearance on focus—useful for contenteditable elements where you want explicit control.

## Dynamic viewport units don't solve the keyboard problem

The new CSS viewport units (`svh`, `lvh`, `dvh`) added in Safari 15.4+ and Chrome 108+ respond only to **browser chrome changes** (address bar, toolbars), not to the virtual keyboard:

| Unit | Responds to keyboard | Responds to browser UI |
|------|---------------------|----------------------|
| `100vh` | No | No (uses largest viewport) |
| `100svh` | No | Yes (smallest/expanded UI) |
| `100lvh` | No | Yes (largest/collapsed UI) |
| `100dvh` | No | Yes (dynamically) |

**Use `100svh` as your default** for stable layouts that account for browser UI without layout thrashing. Reserve `100dvh` for elements that must adapt to URL bar collapse/expansion. None of these units help with keyboard handling—you still need JavaScript.

Browser support for these units is now **~92.6%** globally, with iOS Safari 15.4+, Chrome 108+, and Firefox 101+ all supporting them.

## Flex-based layouts outperform fixed positioning

The recommended layout pattern for chat interfaces avoids `position: fixed` entirely:

```html
<div class="chat-app">
  <header class="chat-header">...</header>
  <main class="message-list">...</main>
  <footer class="input-bar">...</footer>
</div>
```

```css
.chat-app {
  display: flex;
  flex-direction: column;
  height: 100svh;
  /* JavaScript fallback for keyboard */
  height: calc(100svh - var(--keyboard-height, 0px));
}

.message-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.input-bar {
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

This pattern works because:
- The flex container naturally shrinks when you update `--keyboard-height` via JavaScript
- The message list maintains scroll position relative to its content
- The input bar stays visible without fighting `position: fixed` bugs
- Safe area insets handle the home indicator on notched devices

For browsers supporting `interactive-widget=resizes-content`, no JavaScript is needed—the layout viewport naturally resizes.

## PWA standalone mode introduces additional complexity

PWAs with `display: standalone` or `display: fullscreen` behave differently:

**iOS PWA considerations:**
- No Safari browser chrome, so `svh` and `lvh` are equivalent
- Safe area insets become critical (notch, home indicator, Dynamic Island)
- Keyboard behavior matches Safari—Visual Viewport API required
- Known bug in iOS 15-16 where multiple open PWAs can prevent keyboard from appearing

**Android PWA fullscreen bug:** PWAs using `display: fullscreen` have keyboards that **always overlay content** without any viewport adjustment. The workaround requires explicit VirtualKeyboard API handling:

```javascript
// In fullscreen PWA
if ('virtualKeyboard' in navigator) {
  navigator.virtualKeyboard.overlaysContent = true;
  // Handle positioning manually via geometrychange event
}
```

Use `display: standalone` for chat PWAs to avoid this issue.

## Message list scroll behavior requires careful management

Native chat apps like iMessage implement sophisticated scroll behavior that web apps should emulate:

```javascript
class ChatScrollManager {
  constructor(container) {
    this.container = container;
    this.threshold = 100; // px from bottom
  }
  
  isNearBottom() {
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    return scrollHeight - scrollTop - clientHeight < this.threshold;
  }
  
  scrollToBottom(smooth = true) {
    this.container.scrollTo({
      top: this.container.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant'
    });
  }
  
  onNewMessage() {
    // Only auto-scroll if user was already at bottom
    if (this.isNearBottom()) {
      this.scrollToBottom();
    } else {
      this.showScrollToBottomButton();
    }
  }
}
```

**Key behaviors:** Auto-scroll when receiving messages only if user is near bottom. Preserve scroll position when user has scrolled up to read history. Show a "scroll to bottom" button when new messages arrive while scrolled up.

## Touch targets and input sizing prevent usability issues

Following platform guidelines for touch targets:

| Platform | Minimum touch target |
|----------|---------------------|
| iOS HIG | 44×44 pt |
| Material Design | 48×48 dp |
| WCAG 2.2 AAA | 44×44 CSS px |

**Critical iOS input requirement:** Use `font-size: 16px` or larger on input elements to prevent Safari from auto-zooming when the input receives focus:

```css
.message-input {
  font-size: 16px; /* Prevents iOS zoom */
  min-height: 44px;
  padding: 12px 16px;
}

.send-button {
  min-width: 48px;
  min-height: 48px;
}
```

## SvelteKit implementation with Svelte 5 runes

For SvelteKit applications, create a reusable keyboard handler using Svelte 5's `$state` and `$effect`:

```svelte
<!-- lib/components/ChatInterface.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  
  let keyboardHeight = $state(0);
  let messagesEl: HTMLElement;
  
  onMount(() => {
    // Enable VirtualKeyboard API on Chromium
    if ('virtualKeyboard' in navigator) {
      (navigator as any).virtualKeyboard.overlaysContent = true;
    }
    
    // Visual Viewport fallback for Safari
    if (window.visualViewport) {
      const baseline = window.visualViewport.height;
      
      const update = () => {
        const vv = window.visualViewport!;
        keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      };
      
      window.visualViewport.addEventListener('resize', update);
      window.visualViewport.addEventListener('scroll', update);
      
      return () => {
        window.visualViewport?.removeEventListener('resize', update);
        window.visualViewport?.removeEventListener('scroll', update);
      };
    }
  });
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">
</svelte:head>

<div class="chat" style:--kb-height="{keyboardHeight}px">
  <header class="header">Chat</header>
  <main class="messages" bind:this={messagesEl}>
    <!-- messages -->
  </main>
  <footer class="input-bar">
    <textarea placeholder="Message" rows="1"></textarea>
    <button>Send</button>
  </footer>
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    height: 100svh;
    height: calc(100svh - var(--kb-height, 0px));
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .input-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  }
  
  textarea {
    flex: 1;
    font-size: 16px;
    padding: 0.75rem;
    border-radius: 1.5rem;
    border: 1px solid #ddd;
    resize: none;
  }
</style>
```

For SSR compatibility, wrap viewport-dependent code in `browser` checks or `onMount`. Consider disabling SSR for chat routes with `export const ssr = false` in `+page.ts`.

## Common pitfalls cause production failures

**Anti-pattern 1: Using `100vh` for full-height containers**
```css
/* ❌ Breaks with mobile browser UI */
.chat { height: 100vh; }

/* ✅ Use small viewport height */
.chat { height: 100svh; }
```

**Anti-pattern 2: Relying on `position: fixed` for inputs**
```css
/* ❌ Hidden behind keyboard on iOS */
.input { position: fixed; bottom: 0; }

/* ✅ Flex layout with JavaScript keyboard compensation */
.chat { display: flex; flex-direction: column; }
.input { flex-shrink: 0; }
```

**Anti-pattern 3: Assuming simulators match real devices**
iOS Simulator and Android Emulator have significant differences from physical devices in keyboard behavior, touch timing, and performance. **Always test on real devices** before shipping.

**Anti-pattern 4: Unthrottled resize listeners**
```javascript
// ❌ Causes layout thrashing
visualViewport.addEventListener('resize', () => {
  element.style.height = `${visualViewport.height}px`;
});

// ✅ Use requestAnimationFrame
let pending = false;
visualViewport.addEventListener('resize', () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    element.style.height = `${visualViewport.height}px`;
  });
});
```

## Browser support summary for December 2025

| Feature | Chrome | Firefox | Safari iOS |
|---------|--------|---------|------------|
| Visual Viewport API | 61+ ✅ | 91+ ✅ | 13+ ✅ |
| VirtualKeyboard API | 94+ ✅ | ❌ | ❌ |
| `keyboard-inset-*` | 94+ ✅ | ❌ | ❌ |
| `interactive-widget` | 108+ ✅ | 132+ ✅ | ❌ |
| `svh`/`dvh`/`lvh` | 108+ ✅ | 101+ ✅ | 15.4+ ✅ |

The practical implication: **build for the lowest common denominator (iOS Safari)** using Visual Viewport API and flex layouts, then enhance for Chromium with VirtualKeyboard API and `interactive-widget`.

## Conclusion

Building robust mobile keyboard handling for web chat interfaces requires a multi-layered approach. Start with the `interactive-widget=resizes-content` meta tag to fix Android Chrome's default behavior. Implement Visual Viewport API listeners for iOS Safari keyboard detection. Use flex-based layouts instead of fixed positioning. Apply dynamic viewport units (`svh`) for browser chrome adaptation, but rely on JavaScript CSS custom properties for keyboard height compensation. Always test on real iOS and Android devices—simulator behavior diverges significantly from production. The combination of these techniques produces chat interfaces that work harmoniously with native keyboard behaviors rather than fighting against them.