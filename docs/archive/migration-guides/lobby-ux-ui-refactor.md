# Migration Guide Addendum: Lobby UI/UX Implementation

> **Extends**: MIGRATION-CLOUDFLARE.md Phase 4  
> **Design System**: Neo-Brutalist "The Exchange"  
> **Framework**: Svelte 5 + Tailwind CSS

---

## Design System Extension

### A. Signal Color Palette

Add to your existing CSS custom properties:

```css
/* src/app.css - Signal Colors Extension */
:root {
  /* Existing Neo-Brutalist base */
  --color-ink: #000000;
  --color-paper: #FFFFFF;
  --color-gold: #FFD700;
  
  /* NEW: Signal Colors for Lobby */
  --color-signal-live: #00FF94;      /* Online, Open, Success */
  --color-signal-busy: #FF4D00;      /* Full, Error, Warning */
  --color-signal-sys: #D946EF;       /* System messages */
  --color-signal-muted: #6B7280;     /* Timestamps, secondary */
  
  /* Lobby-specific surfaces */
  --lobby-ticker-bg: var(--color-ink);
  --lobby-ticker-fg: var(--color-gold);
  --lobby-card-shadow: 4px 4px 0px 0px var(--color-ink);
  --lobby-card-shadow-hover: 6px 6px 0px 0px var(--color-ink);
}

/* Dark mode overrides if needed */
@media (prefers-color-scheme: dark) {
  :root {
    --color-paper: #0A0A0A;
    --color-ink: #FFFFFF;
    --lobby-card-shadow: 4px 4px 0px 0px var(--color-gold);
  }
}
```

### B. Typography Rules

```css
/* Monospace for data-dense elements */
.font-data {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-variant-numeric: tabular-nums slashed-zero;
}

/* Room codes - always uppercase, tracked */
.room-code {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Chat usernames - lowercase for raw terminal feel */
.chat-username {
  font-weight: 700;
  text-transform: lowercase;
}
```

---

## Core Components

### 1. Lobby State Store (Svelte 5 Runes)

Create `src/lib/stores/lobby.svelte.ts`:

```typescript
import { browser } from '$app/environment';

// Types
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  type: 'user' | 'system';
}

export interface RoomInfo {
  code: string;
  game: 'dicee';
  mode: 'classic' | 'blitz' | 'hardcore';
  host: string;
  playerCount: number;
  maxPlayers: number;
  isPublic: boolean;
  status: 'open' | 'playing' | 'full';
  createdAt: number;
}

export interface TickerEvent {
  id: string;
  type: 'join' | 'room_created' | 'game_won' | 'jackpot';
  message: string;
  timestamp: number;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Reactive state with Svelte 5 runes
class LobbyState {
  // Connection
  connectionState = $state<ConnectionState>('disconnected');
  reconnectAttempts = $state(0);
  
  // Data
  onlineCount = $state(0);
  rooms = $state<RoomInfo[]>([]);
  messages = $state<ChatMessage[]>([]);
  ticker = $state<TickerEvent[]>([]);
  unreadCount = $state(0);
  
  // UI state
  activeTab = $state<'games' | 'chat'>('games');
  isCreateDrawerOpen = $state(false);
  
  // Derived
  openRooms = $derived(this.rooms.filter(r => r.status === 'open'));
  playingRooms = $derived(this.rooms.filter(r => r.status === 'playing'));
  
  // Show online count only if meaningful
  onlineDisplay = $derived(
    this.onlineCount >= 5 
      ? `${this.onlineCount} online` 
      : 'Lobby Open'
  );

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_MESSAGES = 100;
  private readonly MAX_TICKER = 10;
  private readonly RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

  connect() {
    if (!browser || this.ws?.readyState === WebSocket.OPEN) return;
    
    this.connectionState = 'connecting';
    
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws/lobby`);

    this.ws.onopen = () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Failed to parse lobby message:', e);
      }
    };

    this.ws.onclose = (event) => {
      this.connectionState = 'disconnected';
      if (!event.wasClean) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Error will trigger close, which handles reconnect
    };
  }

  disconnect() {
    this.clearReconnectTimer();
    this.ws?.close(1000, 'User disconnect');
    this.ws = null;
    this.connectionState = 'disconnected';
  }

  private handleMessage(data: { type: string; payload: unknown; timestamp: number }) {
    switch (data.type) {
      case 'chat': {
        const msg = data.payload as ChatMessage;
        this.messages = [...this.messages.slice(-(this.MAX_MESSAGES - 1)), msg];
        if (this.activeTab !== 'chat') {
          this.unreadCount++;
        }
        break;
      }
      
      case 'presence': {
        const p = data.payload as { action: string; onlineCount: number; username?: string };
        this.onlineCount = p.onlineCount;
        
        // Add to ticker
        if (p.action === 'join' && p.username) {
          this.addTickerEvent({
            type: 'join',
            message: `${p.username} joined`
          });
        }
        break;
      }
      
      case 'room_update': {
        const update = data.payload as { action: string; room?: RoomInfo; code?: string };
        if (update.action === 'created' && update.room) {
          this.rooms = [update.room, ...this.rooms];
          this.addTickerEvent({
            type: 'room_created',
            message: `Room #${update.room.code} created`
          });
        } else if (update.action === 'closed' && update.code) {
          this.rooms = this.rooms.filter(r => r.code !== update.code);
        } else if (update.action === 'updated' && update.room) {
          this.rooms = this.rooms.map(r => 
            r.code === update.room!.code ? update.room! : r
          );
        }
        break;
      }
      
      case 'pong':
        // Heartbeat acknowledged
        break;
    }
  }

  private addTickerEvent(event: Omit<TickerEvent, 'id' | 'timestamp'>) {
    const full: TickerEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    this.ticker = [full, ...this.ticker.slice(0, this.MAX_TICKER - 1)];
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    const delay = this.RECONNECT_DELAYS[
      Math.min(this.reconnectAttempts, this.RECONNECT_DELAYS.length - 1)
    ];
    
    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Actions
  sendChat(content: string) {
    if (!content.trim() || this.ws?.readyState !== WebSocket.OPEN) return;
    
    // Optimistic update
    const optimisticMsg: ChatMessage = {
      id: `pending-${Date.now()}`,
      userId: 'self',
      username: 'you',
      content: content.trim(),
      timestamp: Date.now(),
      type: 'user'
    };
    this.messages = [...this.messages.slice(-(this.MAX_MESSAGES - 1)), optimisticMsg];
    
    this.ws.send(JSON.stringify({ type: 'chat', content: content.trim() }));
  }

  markChatRead() {
    this.unreadCount = 0;
  }

  setActiveTab(tab: 'games' | 'chat') {
    this.activeTab = tab;
    if (tab === 'chat') {
      this.markChatRead();
    }
  }
}

export const lobby = new LobbyState();
```

### 2. Connection Overlay

Create `src/lib/components/lobby/ConnectionOverlay.svelte`:

```svelte
<script lang="ts">
  import { lobby } from '$lib/stores/lobby.svelte';
  import { onMount } from 'svelte';
  
  let dismissed = $state(false);
  let mounted = $state(false);
  
  onMount(() => {
    mounted = true;
  });
  
  // Auto-dismiss when connected
  $effect(() => {
    if (lobby.connectionState === 'connected') {
      // Small delay for the animation
      setTimeout(() => {
        dismissed = true;
      }, 300);
    }
  });
  
  const isVisible = $derived(
    mounted && 
    !dismissed && 
    lobby.connectionState !== 'connected'
  );
  
  const statusText = $derived(() => {
    switch (lobby.connectionState) {
      case 'connecting': return 'CONNECTING';
      case 'reconnecting': return `RECONNECTING (${lobby.reconnectAttempts})`;
      case 'disconnected': return 'DISCONNECTED';
      default: return 'ENTERING';
    }
  });
</script>

{#if isVisible}
  <div 
    class="connection-overlay"
    class:split={lobby.connectionState === 'connected'}
    role="status"
    aria-live="polite"
  >
    <div class="overlay-top">
      <span class="status-text">{statusText()}</span>
    </div>
    <div class="overlay-bottom">
      <div class="loading-bar"></div>
    </div>
  </div>
{/if}

<style>
  .connection-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    background: var(--color-ink);
    color: var(--color-paper);
  }
  
  .overlay-top,
  .overlay-bottom {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .split .overlay-top {
    transform: translateY(-100%);
  }
  
  .split .overlay-bottom {
    transform: translateY(100%);
  }
  
  .status-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 0.2em;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  .loading-bar {
    width: 200px;
    height: 4px;
    background: var(--color-signal-muted);
    position: relative;
    overflow: hidden;
  }
  
  .loading-bar::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 50%;
    background: var(--color-gold);
    animation: loading 1s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes loading {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(300%); }
  }
</style>
```

### 3. Room Card Component

Create `src/lib/components/lobby/RoomCard.svelte`:

```svelte
<script lang="ts">
  import type { RoomInfo } from '$lib/stores/lobby.svelte';
  import { goto } from '$app/navigation';
  
  interface Props {
    room: RoomInfo;
  }
  
  let { room }: Props = $props();
  let isShaking = $state(false);
  let isFlashing = $state(false);
  
  const statusConfig = $derived(() => {
    switch (room.status) {
      case 'open':
        return { bg: 'bg-[#00FF94]', text: 'OPEN', canJoin: true };
      case 'playing':
        return { bg: 'bg-[#FFD700]', text: 'LIVE', canJoin: false };
      case 'full':
        return { bg: 'bg-gray-300', text: 'FULL', canJoin: false };
    }
  });
  
  const modeEmoji = $derived(() => {
    switch (room.mode) {
      case 'classic': return '⚡';
      case 'blitz': return '🔥';
      case 'hardcore': return '💀';
    }
  });
  
  async function handleJoin() {
    if (!statusConfig().canJoin) {
      // Trigger error animation
      isFlashing = true;
      isShaking = true;
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50]);
      }
      
      setTimeout(() => {
        isFlashing = false;
        isShaking = false;
      }, 300);
      return;
    }
    
    // Success haptic
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
    
    goto(`/games/dicee/room/${room.code}`);
  }
</script>

<article 
  class="room-card"
  class:shake={isShaking}
  class:flash-error={isFlashing}
>
  <div class="card-header">
    <span class="room-code">#{room.code}</span>
    <span class="status-badge {statusConfig().bg}">
      {statusConfig().text}
    </span>
  </div>
  
  <div class="card-meta">
    <span class="mode">{modeEmoji()} {room.mode.toUpperCase()}</span>
    <span class="players">{room.playerCount}/{room.maxPlayers} Players</span>
  </div>
  
  <button 
    class="join-button"
    onclick={handleJoin}
    disabled={!statusConfig().canJoin}
  >
    {statusConfig().canJoin ? 'Join Game' : room.status === 'playing' ? 'Spectate' : 'Full'}
  </button>
</article>

<style>
  .room-card {
    position: relative;
    border: 3px solid var(--color-ink);
    background: var(--color-paper);
    padding: 1rem;
    box-shadow: var(--lobby-card-shadow);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  
  .room-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--lobby-card-shadow-hover);
  }
  
  .room-card:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
  
  .shake {
    animation: shake 0.3s ease-in-out;
  }
  
  .flash-error {
    background: var(--color-signal-busy) !important;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-6px); }
    80% { transform: translateX(6px); }
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .room-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: 0.05em;
  }
  
  .status-badge {
    padding: 0.125rem 0.5rem;
    border: 2px solid var(--color-ink);
    font-size: 0.75rem;
    font-weight: 700;
  }
  
  .card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 1rem;
    color: var(--color-signal-muted);
  }
  
  .mode {
    color: var(--color-ink);
  }
  
  .join-button {
    width: 100%;
    padding: 0.75rem;
    background: var(--color-ink);
    color: var(--color-paper);
    border: none;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  
  .join-button:hover:not(:disabled) {
    background: var(--color-gold);
    color: var(--color-ink);
  }
  
  .join-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

### 4. Mobile Tab Toggle

Create `src/lib/components/lobby/MobileTabToggle.svelte`:

```svelte
<script lang="ts">
  import { lobby } from '$lib/stores/lobby.svelte';
  
  interface Props {
    gamesCount: number;
  }
  
  let { gamesCount }: Props = $props();
</script>

<div class="tab-toggle" role="tablist">
  <button 
    role="tab"
    aria-selected={lobby.activeTab === 'games'}
    class="tab"
    class:active={lobby.activeTab === 'games'}
    onclick={() => lobby.setActiveTab('games')}
  >
    GAMES ({gamesCount})
  </button>
  
  <button 
    role="tab"
    aria-selected={lobby.activeTab === 'chat'}
    class="tab"
    class:active={lobby.activeTab === 'chat'}
    onclick={() => lobby.setActiveTab('chat')}
  >
    CHAT
    {#if lobby.unreadCount > 0}
      <span class="unread-badge">{lobby.unreadCount > 99 ? '99+' : lobby.unreadCount}</span>
    {/if}
  </button>
</div>

<style>
  .tab-toggle {
    display: flex;
    border: 3px solid var(--color-ink);
    background: var(--color-paper);
  }
  
  .tab {
    flex: 1;
    padding: 0.75rem 1rem;
    font-weight: 700;
    text-transform: uppercase;
    border: none;
    cursor: pointer;
    position: relative;
    background: var(--color-paper);
    color: var(--color-ink);
    transition: none; /* Hard cuts, no transitions */
  }
  
  /* Inactive: hatch pattern overlay */
  .tab:not(.active)::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      var(--color-ink) 2px,
      var(--color-ink) 3px
    );
    opacity: 0.1;
    pointer-events: none;
  }
  
  .tab.active {
    background: var(--color-ink);
    color: var(--color-paper);
  }
  
  .unread-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    margin-left: 0.5rem;
    background: var(--color-signal-busy);
    color: white;
    font-size: 0.75rem;
    font-weight: 800;
    border-radius: 2px;
  }
</style>
```

### 5. Empty State

Create `src/lib/components/lobby/EmptyRooms.svelte`:

```svelte
<script lang="ts">
  import { lobby } from '$lib/stores/lobby.svelte';
</script>

<div class="empty-state">
  <div class="icon">◇</div>
  <h3>No Open Rooms</h3>
  <p>Be the first to create a game.</p>
  <button 
    class="create-cta"
    onclick={() => lobby.isCreateDrawerOpen = true}
  >
    Create Room +
  </button>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    border: 3px dashed var(--color-ink);
    background: repeating-linear-gradient(
      45deg,
      var(--color-paper),
      var(--color-paper) 10px,
      #f5f5f5 10px,
      #f5f5f5 20px
    );
  }
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    animation: rotate 4s linear infinite;
  }
  
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  h3 {
    font-weight: 800;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  
  p {
    color: var(--color-signal-muted);
    margin-bottom: 1.5rem;
  }
  
  .create-cta {
    padding: 1rem 2rem;
    background: var(--color-ink);
    color: var(--color-paper);
    border: none;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: var(--lobby-card-shadow);
  }
  
  .create-cta:hover {
    background: var(--color-gold);
    color: var(--color-ink);
  }
</style>
```

### 6. Ticker Component

Create `src/lib/components/lobby/Ticker.svelte`:

```svelte
<script lang="ts">
  import { lobby } from '$lib/stores/lobby.svelte';
  
  let isPaused = $state(false);
  
  // Format ticker events into display string
  const tickerText = $derived(
    lobby.ticker.length > 0
      ? lobby.ticker.map(e => e.message.toUpperCase()).join(' • ')
      : 'WELCOME TO THE LOBBY • CREATE OR JOIN A GAME'
  );
</script>

<div 
  class="ticker"
  role="marquee"
  aria-live="polite"
  onmouseenter={() => isPaused = true}
  onmouseleave={() => isPaused = false}
  ontouchstart={() => isPaused = true}
  ontouchend={() => isPaused = false}
>
  <div class="ticker-content" class:paused={isPaused}>
    <!-- Duplicate for seamless loop -->
    <span>{tickerText} •&nbsp;</span>
    <span aria-hidden="true">{tickerText} •&nbsp;</span>
  </div>
</div>

<style>
  .ticker {
    height: 2rem;
    background: var(--lobby-ticker-bg);
    color: var(--lobby-ticker-fg);
    overflow: hidden;
    border-bottom: 2px solid var(--color-ink);
  }
  
  .ticker-content {
    display: flex;
    white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 2rem;
    animation: scroll 20s linear infinite;
  }
  
  .ticker-content.paused {
    animation-play-state: paused;
  }
  
  @keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
</style>
```

---

## Layout Integration

### Main Lobby Layout

Update `src/routes/+layout.svelte` to include lobby chrome:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { lobby } from '$lib/stores/lobby.svelte';
  import { onMount, onDestroy } from 'svelte';
  import ConnectionOverlay from '$lib/components/lobby/ConnectionOverlay.svelte';
  import Ticker from '$lib/components/lobby/Ticker.svelte';
  
  let { children } = $props();
  
  // Only show lobby chrome on lobby routes
  const isLobbyRoute = $derived($page.url.pathname === '/' || $page.url.pathname.startsWith('/lobby'));
  
  onMount(() => {
    if (isLobbyRoute) {
      lobby.connect();
    }
  });
  
  onDestroy(() => {
    lobby.disconnect();
  });
  
  // Reconnect when navigating to lobby routes
  $effect(() => {
    if (isLobbyRoute && lobby.connectionState === 'disconnected') {
      lobby.connect();
    }
  });
</script>

<ConnectionOverlay />

{#if isLobbyRoute}
  <Ticker />
{/if}

<header class="main-header">
  <a href="/" class="logo">DICEE</a>
  <div class="header-right">
    <span class="online-indicator">{lobby.onlineDisplay}</span>
    <!-- Auth status, etc. -->
  </div>
</header>

<main>
  {@render children()}
</main>

<style>
  .main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 3px solid var(--color-ink);
    background: var(--color-paper);
  }
  
  .logo {
    font-weight: 900;
    font-size: 1.5rem;
    text-decoration: none;
    color: var(--color-ink);
  }
  
  .online-indicator {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: var(--color-signal-live);
  }
</style>
```

---

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Focus management | Tab toggle uses `role="tablist"` and `aria-selected` |
| Live regions | Connection overlay uses `aria-live="polite"` |
| Motion preference | Add `@media (prefers-reduced-motion)` to disable animations |
| Color contrast | Signal colors tested against both light/dark backgrounds |
| Keyboard navigation | All interactive elements are focusable |
| Screen reader | Room cards use semantic `<article>`, status announced |

Add reduced motion support:

```css
@media (prefers-reduced-motion: reduce) {
  .ticker-content,
  .room-card,
  .loading-bar::after,
  .icon {
    animation: none !important;
  }
  
  .connection-overlay .overlay-top,
  .connection-overlay .overlay-bottom {
    transition: none !important;
  }
}
```

---

## Performance Considerations

### 1. Virtual List for Rooms

If expecting 50+ concurrent rooms, use `svelte-virtual-list`:

```bash
pnpm add svelte-virtual-list
```

```svelte
<script>
  import VirtualList from 'svelte-virtual-list';
  import RoomCard from './RoomCard.svelte';
  import { lobby } from '$lib/stores/lobby.svelte';
</script>

<VirtualList items={lobby.rooms} let:item>
  <RoomCard room={item} />
</VirtualList>
```

### 2. Chat Message Batching

For high-traffic chat, batch DOM updates:

```typescript
// In lobby.svelte.ts
private pendingMessages: ChatMessage[] = [];
private batchTimeout: ReturnType<typeof setTimeout> | null = null;

private queueMessage(msg: ChatMessage) {
  this.pendingMessages.push(msg);
  
  if (!this.batchTimeout) {
    this.batchTimeout = setTimeout(() => {
      this.messages = [
        ...this.messages.slice(-(this.MAX_MESSAGES - this.pendingMessages.length)),
        ...this.pendingMessages
      ];
      this.pendingMessages = [];
      this.batchTimeout = null;
    }, 100); // Batch every 100ms
  }
}
```

### 3. Ticker Event Throttling

Prevent ticker overload:

```typescript
private lastTickerUpdate = 0;
private readonly TICKER_THROTTLE = 500; // ms

private addTickerEvent(event: Omit<TickerEvent, 'id' | 'timestamp'>) {
  const now = Date.now();
  if (now - this.lastTickerUpdate < this.TICKER_THROTTLE) return;
  
  this.lastTickerUpdate = now;
  // ... rest of implementation
}
```

---

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Page load with no rooms | Empty state shown with "Create Room" CTA |
| Page load, slow connection | Overlay shows "CONNECTING...", progress bar animates |
| Connection drops | Overlay reappears with "RECONNECTING (1)" |
| Join full room | Card shakes, flashes red, no navigation |
| Tab to Chat with unread | Badge shows count, clears on switch |
| 100+ rooms | Virtual list renders smoothly at 60fps |
| Chat spam (10 msg/sec) | Messages batched, UI remains responsive |

---

## Summary

This addendum provides production-ready implementations for:

1. **State management** via Svelte 5 runes with optimistic updates
2. **Connection UX** with split-screen handshake animation
3. **Room cards** with brutalist styling and error states
4. **Mobile-first** tab toggle with unread badges
5. **Empty states** that encourage room creation
6. **Event ticker** with pause-on-hover
7. **Accessibility** and reduced motion support
8. **Performance** patterns for scale

Integrate these components during Phase 4 of the main migration guide.
