# Multiplayer Dicee - Implementation Workflow

## 📥 Download Starter Files

All implementation files are ready to download:

### Architecture & Planning
- [MULTIPLAYER-ARCHITECTURE.md](computer:///mnt/user-data/outputs/MULTIPLAYER-ARCHITECTURE.md) - Complete architecture design
- [types.multiplayer.ts](computer:///mnt/user-data/outputs/types.multiplayer.ts) - TypeScript definitions

### Phase 0 (Visual Feedback)
- [DiceRollAnimation.svelte](computer:///mnt/user-data/outputs/DiceRollAnimation.svelte) - Enhanced roll animation

---

## 🎯 Implementation Roadmap

### Week 1: Foundation (Phase 1)

**Monday-Tuesday: Visual Feedback & Profiles**
```bash
# 1. Add dice roll animation
cp DiceRollAnimation.svelte packages/web/src/lib/components/dice/

# 2. Integrate with DiceTray
# (see integration guide below)

# 3. Create profile service
# (implementation in architecture doc)
```

**Wednesday-Thursday: PartyKit Setup**
```bash
# 1. Install PartyKit
pnpm add partykit partysocket

# 2. Create server directory
mkdir -p server
touch server/gameRoom.ts

# 3. Configure partykit.json
{
  "name": "dicee",
  "main": "server/gameRoom.ts"
}

# 4. Deploy to test
pnpx partykit dev
```

**Friday: Event Foundation**
```bash
# 1. Add multiplayer types
cp types.multiplayer.ts packages/web/src/lib/types/

# 2. Create event bus
# (implementation provided below)

# 3. Write tests
# (test templates provided)
```

---

## 🚀 Quick Integration Guide

### 1. Enhanced Dice Roll Animation

**Update DiceTray.svelte:**

```typescript
<script lang="ts">
  import DiceRollAnimation from './DiceRollAnimation.svelte';
  
  // ... existing props ...
  let { rolling } = $props();
  
  function handleRollComplete() {
    // Optional: Play sound effect
    // Optional: Analytics event
  }
</script>

<!-- Existing dice tray content -->
<div class="dice-tray">
  <!-- ... -->
</div>

<!-- Add animation overlay -->
<DiceRollAnimation 
  {rolling} 
  onComplete={handleRollComplete} 
/>
```

**Add sound effect (optional):**

```bash
pnpm add howler

# src/lib/utils/sounds.ts
import { Howl } from 'howler';

export const sounds = {
  roll: new Howl({
    src: ['/sounds/dice-roll.mp3'],
    volume: 0.5,
  }),
  score: new Howl({
    src: ['/sounds/score.mp3'],
    volume: 0.3,
  }),
};
```

---

### 2. User Profile Service

**Create profile service:**

```typescript
// packages/web/src/lib/services/profile.svelte.ts
import { browser } from '$app/environment';

class ProfileService {
  currentProfile = $state<UserProfile | null>(null);
  
  async initialize() {
    if (!browser) return;
    
    const stored = localStorage.getItem('dicee:profile');
    if (stored) {
      this.currentProfile = JSON.parse(stored);
    } else {
      await this.createProfile();
    }
  }
  
  private async createProfile() {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      username: `Player_${Date.now().toString(36)}`,
      avatar: {
        type: 'identicon',
        seed: crypto.randomUUID(),
        color: this.randomColor(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: this.emptyStats(),
      settings: this.defaultSettings(),
    };
    
    localStorage.setItem('dicee:profile', JSON.stringify(profile));
    this.currentProfile = profile;
  }
  
  async updateProfile(updates: Partial<UserProfile>) {
    if (!this.currentProfile) return;
    
    this.currentProfile = {
      ...this.currentProfile,
      ...updates,
      updatedAt: new Date(),
    };
    
    localStorage.setItem('dicee:profile', 
      JSON.stringify(this.currentProfile)
    );
  }
  
  private randomColor(): string {
    const colors = [
      '#FFD700', // Gold
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DFE6E9', // Gray
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  private emptyStats(): PlayerStatistics {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      averageScore: 0,
      highScore: 0,
      totalYahtzees: 0,
      averageTurnsToComplete: 0,
      favoriteCategory: null,
      winRate: 0,
      lastPlayedAt: null,
      totalPlayTimeMinutes: 0,
    };
  }
  
  private defaultSettings(): UserSettings {
    return {
      soundEnabled: true,
      animationsEnabled: true,
      statsProfile: 'beginner',
      autoRoll: false,
      confirmScoring: true,
    };
  }
}

export const profileService = new ProfileService();
```

**Initialize in +layout.svelte:**

```typescript
<script lang="ts">
  import { onMount } from 'svelte';
  import { profileService } from '$lib/services/profile.svelte';
  
  onMount(async () => {
    await profileService.initialize();
  });
</script>
```

---

### 3. PartyKit Server Template

**server/gameRoom.ts:**

```typescript
import type * as Party from "partykit/server";

export default class GameRoomServer implements Party.Server {
  constructor(public room: Party.Room) {}
  
  // In-memory game state
  gameState: GameRoom | null = null;
  players: Map<string, Player> = new Map();
  
  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connected: ${conn.id}`);
    
    // Send current state
    if (this.gameState) {
      conn.send(JSON.stringify({
        type: 'state.sync',
        data: this.gameState,
      }));
    }
  }
  
  async onMessage(message: string, sender: Party.Connection) {
    const command = JSON.parse(message);
    
    // Process command
    const event = this.processCommand(command, sender);
    
    if (event) {
      // Broadcast to all
      this.room.broadcast(JSON.stringify(event));
    }
  }
  
  async onClose(conn: Party.Connection) {
    console.log(`Player disconnected: ${conn.id}`);
  }
  
  private processCommand(command: Command, sender: Party.Connection): GameEvent | null {
    // TODO: Implement command handlers
    return null;
  }
}
```

**partykit.json:**

```json
{
  "name": "dicee",
  "main": "server/gameRoom.ts",
  "compatibilityDate": "2024-11-30"
}
```

**Start development server:**

```bash
pnpx partykit dev
# Server runs on http://localhost:1999
```

---

### 4. Event Bus Implementation

**src/lib/services/eventBus.ts:**

```typescript
type EventHandler<T = any> = (event: T) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  
  on<T extends GameEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }
  
  emit<T extends GameEvent>(event: T): void {
    const handlers = this.handlers.get(event.type);
    
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
    
    // Also emit to wildcard handlers
    const wildcards = this.handlers.get('*');
    if (wildcards) {
      wildcards.forEach(handler => handler(event));
    }
  }
  
  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
```

**Usage in components:**

```typescript
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { eventBus } from '$lib/services/eventBus';
  
  let unsubscribe: (() => void) | null = null;
  
  onMount(() => {
    unsubscribe = eventBus.on('dice.rolled', (event) => {
      console.log('Dice rolled:', event.data.dice);
      // Update UI
    });
  });
  
  onDestroy(() => {
    unsubscribe?.();
  });
</script>
```

---

## 🧪 Testing Templates

### Unit Test Template

```typescript
// src/lib/services/__tests__/profile.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { profileService } from '../profile.svelte';

describe('ProfileService', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('creates new profile on first use', async () => {
    await profileService.initialize();
    
    expect(profileService.currentProfile).not.toBeNull();
    expect(profileService.currentProfile?.username).toMatch(/^Player_/);
  });
  
  it('loads existing profile from localStorage', async () => {
    const existingProfile = {
      id: 'test-123',
      username: 'TestUser',
      // ... other fields
    };
    
    localStorage.setItem('dicee:profile', JSON.stringify(existingProfile));
    
    await profileService.initialize();
    
    expect(profileService.currentProfile?.id).toBe('test-123');
    expect(profileService.currentProfile?.username).toBe('TestUser');
  });
  
  it('updates profile and persists to localStorage', async () => {
    await profileService.initialize();
    
    await profileService.updateProfile({
      username: 'NewName',
    });
    
    expect(profileService.currentProfile?.username).toBe('NewName');
    
    const stored = localStorage.getItem('dicee:profile');
    const parsed = JSON.parse(stored!);
    expect(parsed.username).toBe('NewName');
  });
});
```

### Integration Test Template

```typescript
// tests/multiplayer/profile.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and edit profile', async ({ page }) => {
  await page.goto('/');
  
  // Should auto-create profile
  await expect(page.locator('.profile-avatar')).toBeVisible();
  
  // Open profile editor
  await page.click('.profile-avatar');
  
  // Edit username
  await page.fill('input[name="username"]', 'ProGamer');
  await page.click('button:has-text("Save")');
  
  // Verify saved
  await expect(page.locator('.profile-username')).toHaveText('ProGamer');
  
  // Reload page
  await page.reload();
  
  // Profile persisted
  await expect(page.locator('.profile-username')).toHaveText('ProGamer');
});
```

---

## 📊 Progress Checklist

### Phase 1: Foundation (Week 1)

- [ ] Visual feedback
  - [ ] DiceRollAnimation component created
  - [ ] Integrated with DiceTray
  - [ ] Sound effects added (optional)
  - [ ] Visual polish complete

- [ ] User profiles
  - [ ] Profile data model defined
  - [ ] ProfileService implemented
  - [ ] localStorage persistence working
  - [ ] Avatar generation (identicon)
  - [ ] Profile creation wizard UI
  - [ ] Profile editor UI
  - [ ] Statistics tracking structure

- [ ] PartyKit setup
  - [ ] PartyKit installed
  - [ ] Basic server created
  - [ ] Client connection working
  - [ ] Test room operational
  - [ ] Development workflow established

- [ ] Event foundation
  - [ ] Event types defined
  - [ ] EventBus implemented
  - [ ] Event replay system designed
  - [ ] Unit tests passing (10+)

### Phase 2: Core Multiplayer (Week 2)

- [ ] Game rooms
- [ ] Turn management
- [ ] Real-time sync
- [ ] 2-player games working

### Phase 3: Spectator & Polish (Week 3)

- [ ] 3-4 player support
- [ ] Spectator mode
- [ ] Game statistics
- [ ] UI polish

### Phase 4: Testing & Deployment (Week 4)

- [ ] Integration testing
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Production deployment

---

## 🚨 Common Pitfalls

### 1. LocalStorage Limits

**Problem**: localStorage has 5-10MB limit
**Solution**: Only store essential profile data, use IndexedDB for history

```typescript
// Good: Minimal profile
{ id, username, avatar, stats, settings }

// Bad: Storing entire game history
{ ..., gameHistory: [...1000s of games...] }
```

### 2. WebSocket Reconnection

**Problem**: Players lose connection, state desyncs
**Solution**: Implement reconnection with state reconciliation

```typescript
class SyncService {
  private reconnectAttempts = 0;
  
  private handleClose() {
    if (this.reconnectAttempts < 5) {
      setTimeout(() => {
        this.reconnect();
        this.reconnectAttempts++;
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    }
  }
  
  private async reconnect() {
    await this.connect(this.roomId, this.userId);
    // Request full state sync
    this.socket.send(JSON.stringify({ type: 'sync.request' }));
  }
}
```

### 3. Optimistic Updates

**Problem**: Optimistic update conflicts with server state
**Solution**: Server is source of truth, revert on conflict

```typescript
// Apply optimistically
const optimisticEvent = this.createEvent(command);
this.applyEvent(optimisticEvent, { optimistic: true });

// Listen for server confirmation
this.socket.addEventListener('message', (msg) => {
  const serverEvent = JSON.parse(msg.data);
  
  // If different from optimistic, revert and apply server version
  if (serverEvent.id !== optimisticEvent.id) {
    this.revertEvent(optimisticEvent);
    this.applyEvent(serverEvent);
  }
});
```

---

## 🎯 Next Steps

1. **Review architecture document** thoroughly
2. **Download starter files** (links at top)
3. **Set up development environment**:
   ```bash
   # Install PartyKit
   pnpm add partykit partysocket
   
   # Create server directory
   mkdir -p server
   ```
4. **Start with Phase 1, Task 1**: Enhanced dice roll animation
5. **Weekly checkpoint**: Review progress, adjust timeline

---

## 📚 Resources

### PartyKit Documentation
- [Getting Started](https://docs.partykit.io/getting-started)
- [API Reference](https://docs.partykit.io/reference/partykit-server)
- [Examples](https://github.com/partykit/partykit/tree/main/examples)

### XState v5
- [Documentation](https://stately.ai/docs/xstate)
- [Visualizer](https://stately.ai/viz)
- [Examples](https://stately.ai/docs/examples)

### Identicon Libraries
- [jdenticon](https://jdenticon.com/) - SVG identicons
- [dicebear](https://www.dicebear.com/) - Avatar library

---

**Ready to build multiplayer Dicee!** 🎲🎮

Questions? Start with the architecture doc, then dive into Phase 1 implementation.
