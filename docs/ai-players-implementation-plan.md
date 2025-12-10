# AI Players Implementation Plan
## Architectural Integration with Existing Framework

**Created**: 2025-12-08  
**Status**: Planning  
**Spec Reference**: `docs/ai-players.md`

---

## Executive Summary

This document maps the AI Players spec to the existing Dicee architecture, identifying integration points, reusable components, and implementation phases. The goal is to add AI opponents that feel like real players while leveraging the robust infrastructure already in place.

---

## 1. Existing Infrastructure Inventory

### 1.1 What We Have

| Component | Location | Relevance to AI |
|-----------|----------|-----------------|
| **WASM Engine** | `packages/engine/` | ✅ Core AI brain - provides `analyzeTurn()` for optimal decisions |
| **Engine Service** | `packages/web/src/lib/services/engine.ts` | ✅ Lazy-loading pattern - can be adapted for DO |
| **GameRoom DO** | `packages/cloudflare-do/src/GameRoom.ts` | ✅ Where AI logic will live |
| **Game State Machine** | `packages/cloudflare-do/src/game/machine.ts` | ✅ AI uses same validators as humans |
| **Game Types** | `packages/cloudflare-do/src/game/types.ts` | ✅ `PlayerGameState` needs `type: 'human' | 'ai'` |
| **Scoring** | `packages/cloudflare-do/src/game/scoring.ts` | ✅ AI uses same scoring functions |
| **Chat System** | `packages/cloudflare-do/src/chat/` | ✅ AI can send chat messages |
| **Alarm System** | `GameRoom.alarm()` | ✅ Can schedule AI turn execution |
| **Spectator System** | D1-D9 Gallery features | ✅ Spectators can watch AI games |

### 1.2 WASM in Cloudflare Workers

**Critical Finding**: The Rust/WASM engine (`dicee-engine`) compiles to `wasm32-unknown-unknown`, which is compatible with Cloudflare Workers. This means:

- AI can use the **exact same probability engine** as the client
- No need for a separate "server-side" AI implementation
- `analyzeTurn()` returns `TurnAnalysis` with optimal strategy

```typescript
// From packages/engine - available in Workers
interface TurnAnalysis {
  action: 'score' | 'reroll';
  recommendedCategory?: Category;
  categoryScore?: number;
  expectedValue: number;
  keepRecommendation?: {
    keepMask: boolean[];
    explanation: string;
    expectedValue: number;
  };
}
```

---

## 2. Architecture Mapping

### 2.1 AI Controller Location

```
packages/cloudflare-do/
├── src/
│   ├── GameRoom.ts          # Main DO - orchestrates AI turns
│   ├── ai/                  # NEW: AI subsystem
│   │   ├── index.ts         # Exports
│   │   ├── types.ts         # AIProfile, AITraits, AITiming
│   │   ├── profiles.ts      # Pre-built AI profiles (Riley, Carmen, etc.)
│   │   ├── controller.ts    # AIController class
│   │   ├── brain/           # Brain implementations
│   │   │   ├── types.ts     # AIBrain interface, GameContext
│   │   │   ├── optimal.ts   # OptimalBrain (pure EV)
│   │   │   ├── deterministic.ts  # DeterministicBrain (personality + noise)
│   │   │   ├── random.ts    # RandomBrain (chaos)
│   │   │   └── factory.ts   # createBrain()
│   │   └── chat.ts          # Deterministic chat responses
│   ├── game/                # Existing game logic
│   └── chat/                # Existing chat system
```

### 2.2 Type Extensions

```typescript
// packages/cloudflare-do/src/game/types.ts - EXTEND

/** Player type discriminator */
export type PlayerType = 'human' | 'ai';

/** Extended player state with AI support */
export interface PlayerGameState {
  // ... existing fields ...
  
  /** Player type - human or AI */
  type: PlayerType;
  
  /** AI profile (only for AI players) */
  aiProfile?: AIProfile;
}

// packages/cloudflare-do/src/ai/types.ts - NEW

export interface AIProfile {
  id: string;
  name: string;
  avatarSeed: string;
  tagline: string;
  brain: BrainType;
  skillLevel: number;
  traits: AITraits;
  timing: AITiming;
}

export interface AITraits {
  riskTolerance: number;
  diceeChaser: number;
  upperSectionFocus: number;
  overvaluesFullHouse: boolean;
  avoidsEarlyZeros: boolean;
  alwaysUsesAllRolls: boolean;
  emotionalVolatility: number;
  chatFrequency: number;
}

export interface AITiming {
  rollDecisionMs: [number, number];
  keepDecisionMs: [number, number];
  scoreDecisionMs: [number, number];
  fasterWhenWinning: boolean;
  slowerOnFinalRounds: boolean;
  hesitationThresholdEV: number;
  hesitationExtraMs: [number, number];
}

export type BrainType = 'optimal' | 'probabilistic' | 'personality' | 'random';
```

### 2.3 GameRoom Integration Points

```typescript
// GameRoom.ts - Key integration points

class GameRoom extends DurableObject<Env> {
  private aiController: AIController;  // NEW
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.aiController = new AIController(ctx, env, this);  // NEW
  }
  
  // MODIFY: After turn transition, check if next player is AI
  private async advanceToNextPlayer(): Promise<void> {
    // ... existing logic ...
    
    const nextPlayer = this.getNextPlayer();
    if (nextPlayer.type === 'ai') {
      // Schedule AI turn via alarm (for timing simulation)
      await this.scheduleAITurn(nextPlayer);
    }
    
    this.broadcast({ type: 'TURN_STARTED', payload: { playerId: nextPlayer.id } });
  }
  
  // NEW: Schedule AI turn with realistic delay
  private async scheduleAITurn(player: PlayerGameState): Promise<void> {
    const profile = player.aiProfile!;
    const delay = this.aiController.calculateInitialDelay(profile);
    
    await this.ctx.storage.put('ai_turn_data', {
      playerId: player.id,
      phase: 'initial_roll',
    });
    
    await this.ctx.storage.setAlarm(Date.now() + delay);
  }
  
  // MODIFY: Handle AI turn in alarm
  async alarm(): Promise<void> {
    const aiTurnData = await this.ctx.storage.get('ai_turn_data');
    if (aiTurnData) {
      await this.aiController.executeTurnStep(aiTurnData);
      return;
    }
    
    // ... existing alarm handling ...
  }
}
```

---

## 3. WASM Engine Integration in Workers

### 3.1 Challenge: WASM Loading in Durable Objects

Cloudflare Workers support WASM, but loading requires special handling:

```typescript
// packages/cloudflare-do/src/ai/engine.ts

import wasmModule from '../../../../engine/pkg/dicee_engine_bg.wasm';
import init, { analyze_turn } from '../../../../engine/pkg/dicee_engine';

let initialized = false;

export async function initWasmEngine(): Promise<void> {
  if (initialized) return;
  
  // In Workers, we pass the WASM module directly
  await init(wasmModule);
  initialized = true;
}

export async function analyzePosition(
  dice: number[],
  rollsRemaining: number,
  availableCategories: string[]
): Promise<TurnAnalysis> {
  await initWasmEngine();
  
  // Call Rust function
  const result = analyze_turn(
    new Uint8Array(dice),
    rollsRemaining,
    availableCategories
  );
  
  return JSON.parse(result);
}
```

### 3.2 wrangler.toml Configuration

```toml
# packages/cloudflare-do/wrangler.toml

[wasm_modules]
DICEE_ENGINE = "../engine/pkg/dicee_engine_bg.wasm"
```

### 3.3 Alternative: Pure TypeScript Fallback

If WASM loading proves problematic, implement a TypeScript fallback:

```typescript
// packages/cloudflare-do/src/ai/engine-fallback.ts

import { scoreCategory } from '../game/scoring';

/**
 * Simplified EV calculation without full DP solver.
 * Less accurate but works without WASM.
 */
export function estimateEV(
  dice: number[],
  category: string,
  rollsRemaining: number
): number {
  const currentScore = scoreCategory(dice, category);
  
  if (rollsRemaining === 0) {
    return currentScore;
  }
  
  // Heuristic: estimate improvement potential
  // This is less accurate than the full solver but functional
  const improvementFactor = 1 + (rollsRemaining * 0.15);
  return currentScore * improvementFactor;
}
```

---

## 4. AI Controller Implementation

### 4.1 Core Controller

```typescript
// packages/cloudflare-do/src/ai/controller.ts

import { AIBrain, createBrain } from './brain/factory';
import { analyzePosition } from './engine';
import type { AIProfile, GameContext, TurnDecision } from './types';

export class AIController {
  private ctx: DurableObjectState;
  private gameRoom: GameRoom;
  private brains: Map<string, AIBrain> = new Map();
  
  constructor(ctx: DurableObjectState, env: Env, gameRoom: GameRoom) {
    this.ctx = ctx;
    this.gameRoom = gameRoom;
  }
  
  /**
   * Execute one step of an AI turn.
   * Called from alarm handler for timing simulation.
   */
  async executeTurnStep(turnData: AITurnData): Promise<void> {
    const gameState = await this.ctx.storage.get<MultiplayerGameState>('game');
    const player = gameState.players[turnData.playerId];
    const profile = player.aiProfile!;
    
    const brain = this.getBrain(profile.brain);
    const context = this.buildContext(player, gameState);
    
    switch (turnData.phase) {
      case 'initial_roll':
        await this.executeInitialRoll(player, gameState);
        await this.scheduleNextStep(player, 'decide');
        break;
        
      case 'decide':
        const decision = await brain.decide(context, profile);
        await this.executeDecision(player, decision, gameState);
        
        if (decision.action === 'roll') {
          await this.scheduleNextStep(player, 'decide');
        }
        // If scored, turn ends - no more scheduling
        break;
    }
  }
  
  private async executeInitialRoll(player: PlayerGameState, state: MultiplayerGameState): Promise<void> {
    // Use existing game command handler
    await this.gameRoom.handleCommand({
      type: 'dice.roll',
      playerId: player.id,
      keepMask: [false, false, false, false, false],
    });
  }
  
  private async executeDecision(
    player: PlayerGameState,
    decision: TurnDecision,
    state: MultiplayerGameState
  ): Promise<void> {
    if (decision.action === 'roll') {
      await this.gameRoom.handleCommand({
        type: 'dice.roll',
        playerId: player.id,
        keepMask: decision.keepMask!,
      });
    } else {
      await this.gameRoom.handleCommand({
        type: 'category.score',
        playerId: player.id,
        category: decision.category!,
      });
      
      // Optionally send chat
      await this.maybeSendChat(player, 'scored', { category: decision.category });
    }
  }
  
  private async scheduleNextStep(player: PlayerGameState, phase: string): Promise<void> {
    const profile = player.aiProfile!;
    const delay = this.calculateDelay(profile, phase);
    
    await this.ctx.storage.put('ai_turn_data', {
      playerId: player.id,
      phase,
    });
    
    await this.ctx.storage.setAlarm(Date.now() + delay);
  }
  
  private calculateDelay(profile: AIProfile, phase: string): number {
    const timing = profile.timing;
    const range = phase === 'decide' 
      ? timing.keepDecisionMs 
      : timing.rollDecisionMs;
    
    return this.randomInRange(range);
  }
  
  private randomInRange([min, max]: [number, number]): number {
    return Math.floor(min + Math.random() * (max - min));
  }
  
  private getBrain(type: string): AIBrain {
    if (!this.brains.has(type)) {
      this.brains.set(type, createBrain(type as BrainType));
    }
    return this.brains.get(type)!;
  }
  
  private buildContext(player: PlayerGameState, state: MultiplayerGameState): GameContext {
    return {
      dice: player.currentDice!,
      keptDice: player.keptDice ?? [false, false, false, false, false],
      rollsRemaining: player.rollsRemaining,
      scorecard: player.scorecard,
      usedCategories: ALL_CATEGORIES.filter(c => player.scorecard[c] !== null),
      currentUpperScore: calculateUpperSum(player.scorecard),
      bonusAchieved: player.scorecard.upperBonus > 0,
      roundNumber: state.roundNumber,
      isLastRound: state.roundNumber === 13,
      opponents: Object.values(state.players)
        .filter(p => p.id !== player.id)
        .map(p => ({
          id: p.id,
          totalScore: p.totalScore,
          usedCategories: ALL_CATEGORIES.filter(c => p.scorecard[c] !== null),
        })),
    };
  }
}
```

### 4.2 Brain Interface

```typescript
// packages/cloudflare-do/src/ai/brain/types.ts

export interface GameContext {
  dice: number[];
  keptDice: boolean[];
  rollsRemaining: number;
  scorecard: Scorecard;
  usedCategories: Category[];
  currentUpperScore: number;
  bonusAchieved: boolean;
  roundNumber: number;
  isLastRound: boolean;
  opponents: {
    id: string;
    totalScore: number;
    usedCategories: Category[];
  }[];
}

export interface TurnDecision {
  action: 'roll' | 'score';
  keepMask?: boolean[];
  category?: Category;
  reasoning?: string;
  confidence?: number;
}

export interface AIBrain {
  decide(context: GameContext, profile: AIProfile): Promise<TurnDecision>;
}
```

### 4.3 Deterministic Brain (Uses WASM Engine)

```typescript
// packages/cloudflare-do/src/ai/brain/deterministic.ts

import { analyzePosition } from '../engine';
import { scoreCategory } from '../../game/scoring';
import type { AIBrain, GameContext, TurnDecision } from './types';
import type { AIProfile, Category } from '../types';

export class DeterministicBrain implements AIBrain {
  
  async decide(context: GameContext, profile: AIProfile): Promise<TurnDecision> {
    const { dice, rollsRemaining, usedCategories, scorecard } = context;
    const { traits, skillLevel } = profile;
    
    // Get optimal analysis from WASM engine
    const availableCategories = ALL_CATEGORIES.filter(c => !usedCategories.includes(c));
    const analysis = await analyzePosition(dice, rollsRemaining, availableCategories);
    
    // Apply personality biases
    const biasedDecision = this.applyPersonalityBias(analysis, context, traits);
    
    // Apply skill-based noise
    const noisyDecision = this.applySkillNoise(biasedDecision, skillLevel);
    
    return noisyDecision;
  }
  
  private applyPersonalityBias(
    analysis: TurnAnalysis,
    context: GameContext,
    traits: AITraits
  ): TurnDecision {
    // If engine says score, check if personality would override
    if (analysis.action === 'score') {
      // Risk-taker might reroll even when engine says score
      if (traits.riskTolerance > 0.7 && context.rollsRemaining > 0) {
        const evGain = analysis.expectedValue - (analysis.categoryScore ?? 0);
        if (evGain > 0 && Math.random() < traits.riskTolerance * 0.3) {
          return {
            action: 'roll',
            keepMask: analysis.keepRecommendation?.keepMask ?? [false, false, false, false, false],
            reasoning: 'Feeling lucky!',
          };
        }
      }
      
      return {
        action: 'score',
        category: analysis.recommendedCategory,
        reasoning: `Scoring ${analysis.recommendedCategory}`,
        confidence: 0.9,
      };
    }
    
    // Engine says reroll
    return {
      action: 'roll',
      keepMask: analysis.keepRecommendation?.keepMask ?? [false, false, false, false, false],
      reasoning: analysis.keepRecommendation?.explanation ?? 'Rerolling',
      confidence: 0.8,
    };
  }
  
  private applySkillNoise(decision: TurnDecision, skillLevel: number): TurnDecision {
    // At skill 1.0: no noise
    // At skill 0.5: occasional suboptimal plays
    
    if (decision.action === 'roll' && decision.keepMask) {
      // Occasionally flip a keep decision
      const noisyMask = decision.keepMask.map(keep => {
        if (Math.random() > skillLevel && Math.random() < 0.1) {
          return !keep;
        }
        return keep;
      });
      
      return { ...decision, keepMask: noisyMask as [boolean, boolean, boolean, boolean, boolean] };
    }
    
    return decision;
  }
}
```

---

## 5. Room Creation Flow

### 5.1 Solo Mode with AI

```typescript
// packages/cloudflare-do/src/GameRoom.ts

interface CreateRoomOptions {
  hostPlayerId: string;
  hostDisplayName: string;
  hostAvatarSeed: string;
  mode: 'multiplayer' | 'solo' | 'practice';
  aiDifficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  aiCount?: number;
}

async handleCreateRoom(options: CreateRoomOptions): Promise<void> {
  const roomState = createInitialRoomState(this.getRoomCode(), options.hostPlayerId);
  
  // Add host as human player
  const hostPlayer = createPlayerGameState(
    options.hostPlayerId,
    options.hostDisplayName,
    options.hostAvatarSeed,
    true,  // isHost
    'host-connection'
  );
  hostPlayer.type = 'human';
  
  // For solo/practice mode, add AI players
  if (options.mode === 'solo' || options.mode === 'practice') {
    const aiProfiles = selectAIProfiles(
      options.aiDifficulty ?? 'medium',
      options.aiCount ?? 1
    );
    
    for (const profileId of aiProfiles) {
      const aiPlayer = createAIPlayer(profileId, this.getNextSeat());
      this.gameState.players[aiPlayer.id] = aiPlayer;
    }
  }
  
  await this.ctx.storage.put('game', this.gameState);
}
```

### 5.2 Fill Empty Seats with AI

```typescript
// When host starts game with empty seats
async handleStartGame(hostId: string): Promise<void> {
  const validation = canStartGame(this.gameState, hostId);
  if (!validation.success) {
    // Check if we should fill with AI
    if (validation.error === 'NOT_ENOUGH_PLAYERS') {
      const humanCount = Object.values(this.gameState.players)
        .filter(p => p.type === 'human' && p.isConnected).length;
      
      if (humanCount === 1 && this.gameState.config.fillWithAI) {
        // Add AI to fill seats
        const aiProfile = selectAIProfiles('medium', 1)[0];
        const aiPlayer = createAIPlayer(aiProfile, 2);
        this.gameState.players[aiPlayer.id] = aiPlayer;
        
        // Re-validate
        const revalidation = canStartGame(this.gameState, hostId);
        if (!revalidation.success) {
          this.sendError(ws, revalidation.error, revalidation.message);
          return;
        }
      }
    }
  }
  
  // ... proceed with game start ...
}
```

---

## 6. Client-Side Changes

### 6.1 Player Display

```svelte
<!-- packages/web/src/lib/components/game/PlayerCard.svelte -->

<script lang="ts">
  interface Props {
    player: PlayerInfo;
    isCurrentTurn: boolean;
  }
  
  let { player, isCurrentTurn }: Props = $props();
  
  const isAI = $derived(player.type === 'ai');
</script>

<div class="player-card" class:current-turn={isCurrentTurn}>
  <Avatar seed={player.avatarSeed} size="md" />
  <span class="player-name">
    {player.displayName}
    {#if isAI}
      <span class="ai-badge" title={player.aiProfile?.tagline}>🤖</span>
    {/if}
  </span>
  <span class="player-score">{player.totalScore}</span>
</div>
```

### 6.2 AI Profile Selection UI

```svelte
<!-- packages/web/src/lib/components/lobby/AIOpponentSelector.svelte -->

<script lang="ts">
  import { AI_PROFILES } from '$lib/types/ai';
  
  interface Props {
    onSelect: (profileId: string) => void;
    difficulty?: 'easy' | 'medium' | 'hard';
  }
  
  let { onSelect, difficulty = 'medium' }: Props = $props();
  
  const filteredProfiles = $derived(
    Object.values(AI_PROFILES).filter(p => {
      if (difficulty === 'easy') return p.skillLevel < 0.5;
      if (difficulty === 'hard') return p.skillLevel > 0.8;
      return p.skillLevel >= 0.5 && p.skillLevel <= 0.8;
    })
  );
</script>

<div class="ai-selector">
  <h3>Choose Your Opponent</h3>
  <div class="profiles-grid">
    {#each filteredProfiles as profile}
      <button class="profile-card" onclick={() => onSelect(profile.id)}>
        <Avatar seed={profile.avatarSeed} size="lg" />
        <span class="name">{profile.name}</span>
        <span class="tagline">{profile.tagline}</span>
        <div class="skill-bar" style:width="{profile.skillLevel * 100}%" />
      </button>
    {/each}
  </div>
</div>
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: AI can play a complete game with optimal strategy

| Task | Files | Effort |
|------|-------|--------|
| Add `type` field to `PlayerGameState` | `game/types.ts` | S |
| Create `ai/` directory structure | New files | S |
| Define `AIProfile`, `AITraits`, `AITiming` types | `ai/types.ts` | M |
| Create 5 pre-built profiles | `ai/profiles.ts` | M |
| Implement `OptimalBrain` (pure WASM) | `ai/brain/optimal.ts` | M |
| Implement `AIController` core | `ai/controller.ts` | L |
| Integrate with `GameRoom.alarm()` | `GameRoom.ts` | M |
| Add WASM loading in Workers | `ai/engine.ts`, `wrangler.toml` | M |
| Solo mode room creation | `GameRoom.ts` | M |

**Tests**:
- AI completes a full game
- AI uses correct timing delays
- AI decisions are valid (pass state machine)

### Phase 2: Personality (Week 2)

**Goal**: AI players have distinct play styles

| Task | Files | Effort |
|------|-------|--------|
| Implement `DeterministicBrain` | `ai/brain/deterministic.ts` | L |
| Implement `PersonalityBrain` | `ai/brain/personality.ts` | M |
| Implement `RandomBrain` | `ai/brain/random.ts` | S |
| Add skill-based noise | `DeterministicBrain` | M |
| Add trait-based biases | `DeterministicBrain` | M |
| Timing adjustments (winning/losing) | `AIController` | S |

**Tests**:
- Skill 0.5 AI scores lower than skill 1.0
- Risk-tolerant AI rerolls more often
- Random AI makes unpredictable plays

### Phase 3: Polish (Week 3)

**Goal**: AI feels like a real player

| Task | Files | Effort |
|------|-------|--------|
| Deterministic chat responses | `ai/chat.ts` | M |
| Chat triggers (Dicee, good roll, etc.) | `AIController` | M |
| AI badge in player list | `PlayerCard.svelte` | S |
| AI profile selector UI | `AIOpponentSelector.svelte` | M |
| "Fill with AI" option in room creation | `CreateRoomModal.svelte` | M |
| AI decision logging (debug) | `AIController` | S |

**Tests**:
- AI sends chat at appropriate times
- UI correctly shows AI badge
- Room creation with AI works

### Phase 4: Integration (Week 4)

**Goal**: AI works in all game modes

| Task | Files | Effort |
|------|-------|--------|
| Solo leaderboard (AI games marked) | Database migration | M |
| Spectator mode with AI games | Gallery components | S |
| AI in practice mode | Room creation flow | M |
| AI difficulty presets | UI + profiles | S |
| Performance testing | Load tests | M |

---

## 8. Risk Mitigation

### 8.1 WASM Loading in Workers

**Risk**: WASM may not load correctly in Durable Objects.

**Mitigation**:
1. Test WASM loading early in Phase 1
2. Have TypeScript fallback ready (`engine-fallback.ts`)
3. Fallback uses heuristic EV estimation (less accurate but functional)

### 8.2 Timing Coordination

**Risk**: Alarm scheduling may have edge cases (hibernation, concurrent alarms).

**Mitigation**:
1. Store AI turn state in durable storage
2. Validate state on alarm wake
3. Handle "stale" alarms gracefully

### 8.3 State Machine Integrity

**Risk**: AI could make invalid moves if not properly validated.

**Mitigation**:
1. AI uses **same command handlers** as humans
2. All moves go through `canRollDice()`, `canScoreCategory()`, etc.
3. Invalid AI moves logged and fallback to random valid move

---

## 9. Open Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| AI in ranked games? | Yes / No / Separate queue | **No** - AI for practice only |
| AI visible to spectators? | Show AI badge / Hide | **Show badge** - no deception |
| AI chat frequency | Always / Sometimes / Never | **Sometimes** - based on profile |
| AI decision logging | Always / Debug only | **Debug only** - storage cost |
| WASM vs TypeScript fallback | WASM only / Fallback | **Fallback ready** - resilience |

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| AI game completion rate | 100% (no crashes) |
| Optimal AI average score | ~310 (matches engine tests) |
| Skill 0.5 AI average score | ~260 |
| Random AI average score | ~150 |
| AI turn latency (p99) | < 5s |
| Solo mode adoption | 20% of games |

---

## 11. Next Steps

1. **Create ADR** for AI architecture decisions
2. **Spike**: Test WASM loading in Cloudflare Workers
3. **Phase 1 kickoff**: Create `ai/` directory and types
4. **Update `current-phase.json`** with AI implementation phase

---

## Appendix: File Checklist

### New Files
- [ ] `packages/cloudflare-do/src/ai/index.ts`
- [ ] `packages/cloudflare-do/src/ai/types.ts`
- [ ] `packages/cloudflare-do/src/ai/profiles.ts`
- [ ] `packages/cloudflare-do/src/ai/controller.ts`
- [ ] `packages/cloudflare-do/src/ai/engine.ts`
- [ ] `packages/cloudflare-do/src/ai/engine-fallback.ts`
- [ ] `packages/cloudflare-do/src/ai/chat.ts`
- [ ] `packages/cloudflare-do/src/ai/brain/types.ts`
- [ ] `packages/cloudflare-do/src/ai/brain/factory.ts`
- [ ] `packages/cloudflare-do/src/ai/brain/optimal.ts`
- [ ] `packages/cloudflare-do/src/ai/brain/deterministic.ts`
- [ ] `packages/cloudflare-do/src/ai/brain/personality.ts`
- [ ] `packages/cloudflare-do/src/ai/brain/random.ts`
- [ ] `packages/web/src/lib/components/lobby/AIOpponentSelector.svelte`
- [ ] `packages/web/src/lib/types/ai.ts`

### Modified Files
- [ ] `packages/cloudflare-do/src/game/types.ts` - Add `type` field
- [ ] `packages/cloudflare-do/src/GameRoom.ts` - AI controller integration
- [ ] `packages/cloudflare-do/wrangler.toml` - WASM module binding
- [ ] `packages/web/src/lib/components/game/PlayerCard.svelte` - AI badge
- [ ] `packages/web/src/lib/components/lobby/CreateRoomModal.svelte` - AI options
