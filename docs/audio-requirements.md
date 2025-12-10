# Audio Requirements Analysis

> **Purpose**: Maps actual code integration points to audio assets, documenting exact timing, UX context, and generation parameters for each sound.

## Current Integration Status

### Audio Infrastructure

| Component | Location | Status |
|-----------|----------|--------|
| `AudioManager` | `src/lib/services/audio.ts` | ✅ Complete |
| `audioStore` | `src/lib/stores/audio.svelte.ts` | ✅ Complete |
| `playSound` action | `src/lib/actions/playSound.ts` | ✅ Complete |
| Audio files | `static/audio/` | ❌ Placeholder only |

### Sound IDs Defined in Code

```typescript
// From src/lib/services/audio.ts
type SoundId =
  | 'diceRoll'      // Dice rolling
  | 'diceLand'      // Dice landing (with variants)
  | 'diceKeep'      // Keep/hold a die
  | 'diceUnkeep'    // Release a die
  | 'scoreConfirm'  // Score a category
  | 'bonusAchieved' // Upper section bonus
  | 'dicee'         // Five of a kind!
  | 'buttonClick'   // Generic UI click
  | 'turnChange'    // Turn changed to another player
  | 'timerWarning'  // AFK timer warning
  | 'chatMessage'   // New chat message
  | 'playerJoin'    // Player joined room
  | 'playerLeave'   // Player left room
  | 'gameStart'     // Game starting
  | 'gameEnd';      // Game finished
```

---

## Detailed Sound Requirements

### 1. Dice Sounds (Category: `dice`)

#### `diceRoll` - Dice Rolling
**Trigger Point**: `DiceTray.svelte` line 124
```typescript
function handleRoll() {
  if (canRoll) {
    haptic('roll');
    audioStore.playDiceRoll();  // ← HERE
    onRoll();
  }
}
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Player clicks "ROLL DICE" or "START YOUR TURN" button |
| **Timing** | Immediate on button press (before animation starts) |
| **Duration** | 1.0-1.5s | Must include initial shake + release |
| **Preload** | Yes | Critical for low latency |
| **Volume** | 0.7 | Prominent but not overwhelming |
| **Variants** | No | Single sound (variations via pitch shift) |

**Generation Prompt**: "wooden dice rolling on felt table, satisfying clatter, warm tone, 5 dice, leather cup spill, settling sound"

---

#### `diceLand` - Dice Landing
**Trigger Point**: `DiceTray.svelte` lines 105-119
```typescript
$effect(() => {
  if (wasRolling && !rolling) {
    landing = true;
    haptic('medium');
    const unkeptCount = kept.filter((k) => !k).length;
    audioStore.playDiceLand(unkeptCount || 5);  // ← HERE
    // ...
  }
});
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Roll animation completes, dice settle |
| **Timing** | When `rolling` transitions from `true` to `false` |
| **Duration** | 0.2-0.4s per die | Staggered playback |
| **Preload** | No | Lazy loaded |
| **Volume** | 0.5 | Softer than roll |
| **Variants** | 3 | `dice-land_1.mp3`, `dice-land_2.mp3`, `dice-land_3.mp3` |

**Playback Logic** (from `audioStore.playDiceLand`):
```typescript
async playDiceLand(count: number = 5): Promise<void> {
  const sounds = Array.from({ length: count }, (_, i) => ({
    id: 'diceLand' as SoundId,
    delay: i * 30 + Math.random() * 20,  // Staggered 30-50ms apart
    options: {
      pitch: 0.9 + Math.random() * 0.2,  // ±10% pitch variation
      pan: (i - 2) * 0.3,                // Spread across stereo field
    },
  }));
  await audioManager.playSequence(sounds);
}
```

**Generation Prompt**: "single wooden die landing on felt, soft thud, brief settle, warm tone"

---

#### `diceKeep` / `diceUnkeep` - Die Selection
**Trigger Point**: `Die.svelte` lines 63-70
```typescript
function handleClick() {
  if (!disabled && onclick) {
    haptic('light');
    audioStore.playDieToggle(!kept);  // ← HERE (plays opposite state)
    onclick();
  }
}
```

| Parameter | `diceKeep` | `diceUnkeep` |
|-----------|------------|--------------|
| **UX Context** | Player clicks die to hold it | Player clicks die to release it |
| **Timing** | Immediate on click | Immediate on click |
| **Duration** | 100-150ms | 100-150ms |
| **Volume** | 0.3 | 0.25 |
| **Character** | Satisfying "thock" | Slightly higher pitch, lighter |

**Generation Prompts**:
- Keep: "soft wooden tap, satisfying click, muted, mechanical keyboard feel"
- Unkeep: "light wooden release, higher pitch click, soft"

---

### 2. Score Sounds (Category: `score`)

#### `scoreConfirm` - Score Category Selected
**Trigger Point**: `CategoryRow.svelte` lines 41-59
```typescript
$effect(() => {
  if (score !== null && previousScore === null) {
    showScoreAnimation = true;
    haptic('success');
    if (category === 'Dicee' && score === 50) {
      audioStore.playDicee();  // ← Special case
    } else {
      audioStore.playScoreConfirm();  // ← HERE
    }
    // ...
  }
});
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Player selects a scoring category |
| **Timing** | When score transitions from `null` to a value |
| **Duration** | 0.3-0.5s | Clean, quick confirmation |
| **Preload** | Yes | Critical for responsiveness |
| **Volume** | 0.4 | Clear but not dominant |

**Score Sound Logic** (from audio-plan.md):
| Score Range | Sound | Notes |
|-------------|-------|-------|
| 0 points | `score_zero.ogg` | Scratch/forced zero |
| 1-15 points | `score_negative.ogg` | Low/disappointing |
| 16-29 points | `score_positive.ogg` | Decent/neutral-good |
| 30+ points | `score_good.ogg` | High score |
| 50 (Dicee) | `dicee_fanfare.ogg` | Five of a kind |

**Current Implementation Gap**: Code only distinguishes `scoreConfirm` vs `dicee`. The score-range logic from audio-plan.md is NOT implemented yet.

**Generation Prompt**: "marimba two notes ascending, gentle, warm, confirmation sound"

---

#### `dicee` - Five of a Kind Celebration
**Trigger Point**: `CategoryRow.svelte` line 48 (see above)

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Player scores a Dicee (five of a kind, 50 points) |
| **Timing** | When Dicee category scored with value 50 |
| **Duration** | 2.0-3.0s | THE HERO SOUND |
| **Volume** | 0.8 | Must cut through everything |
| **Special** | Triggers audio ducking | Other sounds -6dB to -9dB |

**Generation Prompt**: "triumphant fanfare, harp glissando, magical shimmer, celebration, 2-3 seconds"

**Implementation Note**: Audio ducking is specified in audio-plan.md but NOT implemented in code yet.

---

#### `bonusAchieved` - Upper Section Bonus
**Trigger Point**: `audioStore.playBonusAchieved()` - **NOT CURRENTLY CALLED**

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Player achieves upper section bonus (63+ points) |
| **Timing** | When upper section total reaches 63+ |
| **Duration** | 0.5-0.8s | Warm, enveloping |
| **Volume** | 0.6 | Celebratory but not as big as Dicee |

**Implementation Gap**: This sound is defined but no component currently triggers it. Need to add trigger in scorecard when upper bonus is achieved.

---

### 3. UI Sounds (Category: `ui`)

#### `turnChange` - Turn Changed
**Trigger Point**: `TurnIndicator.svelte` lines 33-48
```typescript
$effect(() => {
  const currentId = currentPlayer?.id ?? null;
  if (currentId && currentId !== previousPlayerId) {
    showTurnTransition = true;
    if (isMyTurn) {
      haptic('medium');
    }
    audioStore.playTurnChange();  // ← HERE
    // ...
  }
});
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Turn changes to any player (including self) |
| **Timing** | When `currentPlayer.id` changes |
| **Duration** | 1.5-2.0s | Long resonant tail |
| **Volume** | 0.3 | Gentle notification |

**Generation Prompt**: "gentle bell chime, tibetan bowl, warm resonance, inviting, not alarming"

---

#### `buttonClick` - Generic Button Click
**Trigger Point**: Via `use:playSound` action (declarative)
```svelte
<button use:playSound={'buttonClick'}>Click Me</button>
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Generic UI button interactions |
| **Timing** | On click event |
| **Duration** | 50-100ms | Instant feedback |
| **Volume** | 0.2 | Subtle, not fatiguing |

**Current Usage**: The `playSound` action exists but is NOT currently used on any buttons in the codebase.

---

#### `timerWarning` - AFK Timer Warning
**Trigger Point**: `TurnIndicator.svelte` lines 50-55
```typescript
$effect(() => {
  if (afkWarning !== null && afkWarning <= 10 && isMyTurn) {
    haptic('error');
    // NOTE: No audio trigger here currently!
  }
});
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | Player is running out of time (AFK warning) |
| **Timing** | When `afkWarning <= 10` and it's player's turn |
| **Duration** | 100ms | Quick tick |
| **Volume** | 0.4 | Attention-getting |

**Implementation Gap**: Haptic feedback exists but audio is NOT triggered. Need to add `audioStore.play('timerWarning')`.

---

### 4. System Sounds (Category: `system`)

#### `chatMessage` - New Chat Message
**Trigger Point**: `audioStore.playChatMessage()` - called from chat store

| Parameter | Value | Notes |
|-----------|-------|-------|
| **UX Context** | New chat message received (not from self) |
| **Timing** | On message receipt |
| **Duration** | 100-150ms | Quick pop |
| **Volume** | 0.2 | Subtle notification |

---

#### `playerJoin` / `playerLeave` - Player Connection Events
**Trigger Points**: `audioStore.playPlayerJoin()`, `audioStore.playPlayerLeave()`

| Parameter | `playerJoin` | `playerLeave` |
|-----------|--------------|---------------|
| **UX Context** | Player joins lobby | Player leaves lobby |
| **Duration** | 300ms | 200ms |
| **Volume** | 0.3 | 0.25 |
| **Character** | Welcoming | Neutral departure |

---

#### `gameStart` / `gameEnd` - Game Lifecycle
**Trigger Points**: `audioStore.playGameStart()`, `audioStore.playGameEnd()`

| Parameter | `gameStart` | `gameEnd` |
|-----------|-------------|-----------|
| **UX Context** | Game begins | Game finished |
| **Duration** | 500ms | 500-600ms |
| **Volume** | 0.5 | 0.5 |
| **Character** | Exciting, anticipatory | Conclusive, satisfying |

---

## Implementation Status

### ✅ Completed Audio Triggers

| Sound | Status | Location |
|-------|--------|----------|
| `timerWarning` | ✅ Implemented | `TurnIndicator.svelte` - triggers every second when ≤10s remaining |
| `bonusAchieved` | ✅ Implemented | `Scorecard.svelte` - triggers when upper bonus achieved |
| `buttonClick` | ✅ Implemented | `DiceTray.svelte` - Keep All / Release All buttons |
| Score range sounds | ✅ Implemented | `CategoryRow.svelte` + `audioStore.playScoreSound()` |

### Score Range Sound Logic (Implemented)

| Score Range | Sound ID | Description |
|-------------|----------|-------------|
| 0 points | `scoreZero` | Scratch/forced zero |
| 1-15 points | `scoreNegative` | Low/disappointing |
| 16-29 points | `scorePositive` | Decent/neutral-good |
| 30+ points | `scoreGood` | High score |
| 50 (Dicee) | `dicee` | Five of a kind fanfare |

### Pending Audio Features (Future Enhancement)

| Feature | Description | Priority |
|---------|-------------|----------|
| Audio ducking | Dicee fanfare should duck other sounds | Medium |
| Music layers | Layered background music based on round | Low |

---

## Asset Registry Mapping

| SoundId (Code) | Asset ID (Registry) | Path | Status |
|----------------|---------------------|------|--------|
| `diceRoll` | MVP-01 | `/audio/sfx/dice/dice_roll_heavy.ogg` | Ready |
| `diceLand` | MVP-02 | `/audio/sfx/dice/dice_roll_light.ogg` | Ready |
| `diceKeep` | MVP-03 | `/audio/sfx/dice/dice_select.ogg` | Ready |
| `diceUnkeep` | PHY-05 | `/audio/sfx/dice/dice_deselect.ogg` | Ready |
| `scoreZero` | SCR-02 | `/audio/sfx/score/score_zero.ogg` | Ready |
| `scoreNegative` | MVP-05 | `/audio/sfx/score/score_negative.ogg` | Ready |
| `scorePositive` | MVP-04 | `/audio/sfx/score/score_positive.ogg` | Ready |
| `scoreGood` | SCR-01 | `/audio/sfx/score/score_good.ogg` | Ready |
| `bonusAchieved` | SCR-03 | `/audio/sfx/score/upper_bonus.ogg` | Ready |
| `dicee` | MVP-06 | `/audio/sfx/score/dicee_fanfare.ogg` | Ready |
| `buttonClick` | UI-02 | `/audio/sfx/ui/btn_click.ogg` | Ready |
| `turnChange` | MVP-07 | `/audio/sfx/ui/turn_start.ogg` | Ready |
| `timerWarning` | UI-04 | `/audio/sfx/ui/timer_tick.ogg` | Ready |
| `chatMessage` | — | `/audio/sfx/ui/chat_pop.ogg` | Needs gen |
| `playerJoin` | — | `/audio/sfx/ui/player_join.ogg` | Needs gen |
| `playerLeave` | — | `/audio/sfx/ui/player_leave.ogg` | Needs gen |
| `gameStart` | — | `/audio/sfx/score/game_start.ogg` | Needs gen |
| `gameEnd` | EVT-01/02 | `/audio/sfx/score/game_end.ogg` | Needs gen |

---

## Path Structure

**SOUND_BANK paths are now configured** to use the structured format matching audio-gen output:

```
/audio/sfx/dice/     → Dice sounds (roll, land, select, deselect)
/audio/sfx/score/    → Score feedback (zero, negative, positive, good, dicee, bonus)
/audio/sfx/ui/       → UI sounds (button, turn, timer, chat, player events)
/audio/music/        → Background music layers (future)
/audio/ambient/      → Ambient loops (future)
```

---

## Next Steps

1. **Generate MVP assets** (8 sounds) using `pnpm audio:gen -- --phase mvp`
2. **Test with playtesters** per MVP validation criteria in audio-plan.md
3. **Generate remaining assets** for system sounds (chat, player join/leave, game start/end)
