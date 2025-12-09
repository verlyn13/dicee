# Dicee AI Players — Architecture Specification
## "The House Players"

AI players that feel like real opponents, with deterministic behavior now and LLM integration later.

---

## 1. Core Architecture Principles

### 1.1 Where AI Logic Lives

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DURABLE OBJECT (GameRoom)                       │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │   Game State    │    │   Turn Manager  │    │     AI Controller       │  │
│  │   Machine       │───▶│                 │───▶│                         │  │
│  │                 │    │  "Whose turn?"  │    │  "AI player? Execute."  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
│                                                          │                   │
│                                                          ▼                   │
│                                               ┌─────────────────────────┐   │
│                                               │      AI Brain           │   │
│                                               │  (Strategy Interface)   │   │
│                                               │                         │   │
│                                               │  ┌───────────────────┐  │   │
│                                               │  │ DeterministicBrain│  │   │  ← Phase 1
│                                               │  └───────────────────┘  │   │
│                                               │  ┌───────────────────┐  │   │
│                                               │  │    LLMBrain       │  │   │  ← Phase 2
│                                               │  └───────────────────┘  │   │
│                                               └─────────────────────────┘   │
│                                                          │                   │
│                                                          ▼                   │
│                                               ┌─────────────────────────┐   │
│                                               │    WASM Engine          │   │
│                                               │  (Probability/EV calc)  │   │
│                                               └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Decision: AI runs in the Durable Object, not client-side.**

Why:
- Server-authoritative (no cheating)
- Works even with zero human clients connected
- Can use WASM engine server-side (wasm32-unknown-unknown works in Workers)
- Centralized timing/coordination
- Future LLM calls are server-to-server (no CORS, can use secrets)

### 1.2 AI as First-Class Players

AI players go through the **exact same state machine** as humans:

```typescript
// NO special "AI turn" phase. AI players are just players.
interface Player {
  id: string;
  type: 'human' | 'ai';
  
  // Same for both
  name: string;
  avatarSeed: string;
  scorecard: Scorecard;
  currentDice: number[] | null;
  keptDice: boolean[];
  rollsRemaining: number;
  
  // AI-specific (ignored for humans)
  aiProfile?: AIProfile;
}
```

When it's an AI player's turn, the DO:
1. Detects `currentPlayer.type === 'ai'`
2. Schedules AI action (with realistic delay)
3. AI executes through normal command handlers
4. State machine transitions normally
5. Events broadcast to all clients (humans see AI playing)

---

## 2. AI Profile System

### 2.1 Profile Structure

```typescript
interface AIProfile {
  // Identity
  id: string;                    // 'ai_charlie', 'ai_statistician'
  name: string;                  // "Charlie", "The Professor"
  avatarSeed: string;            // For DiceBear generation
  tagline: string;               // "Plays it safe", "Risk taker"
  
  // Skill Configuration
  brain: BrainType;              // 'optimal' | 'probabilistic' | 'personality' | 'random'
  skillLevel: number;            // 0.0 - 1.0 (affects decision quality)
  
  // Behavioral Traits (for deterministic personality)
  traits: AITraits;
  
  // Timing (milliseconds)
  timing: AITiming;
  
  // Future: LLM Configuration
  llmConfig?: LLMConfig;
}

interface AITraits {
  // Risk tolerance (0 = conservative, 1 = gambler)
  riskTolerance: number;
  
  // Category biases (-1 to 1, 0 = neutral)
  yahtzeeChaser: number;         // Positive = always goes for Yahtzee
  upperSectionFocus: number;     // Positive = prioritizes upper bonus
  
  // Mistake patterns
  overvaluesFullHouse: boolean;  // Common human mistake
  avoidsEarlyZeros: boolean;     // Another common mistake
  
  // Play style
  alwaysUsesAllRolls: boolean;   // Some humans always roll 3 times
  
  // Reactions (for future chat)
  emotionalVolatility: number;   // How much they react to good/bad rolls
  chatFrequency: number;         // How often they comment
}

interface AITiming {
  // Base thinking time per decision type
  rollDecisionMs: [number, number];      // [min, max] uniform random
  keepDecisionMs: [number, number];
  scoreDecisionMs: [number, number];
  
  // Variance by game state
  fasterWhenWinning: boolean;
  slowerOnFinalRounds: boolean;
  
  // "Hesitation" for tough decisions
  hesitationThresholdEV: number;         // If EV difference < this, hesitate
  hesitationExtraMs: [number, number];
}
```

### 2.2 Pre-Built Profiles (The Roster)

```typescript
const AI_PROFILES: Record<string, AIProfile> = {
  
  // ═══════════════════════════════════════════════════════════════
  // BEGINNER-FRIENDLY
  // ═══════════════════════════════════════════════════════════════
  
  'rookie_riley': {
    id: 'rookie_riley',
    name: 'Riley',
    avatarSeed: 'riley-rookie-dice',
    tagline: 'Still learning the ropes',
    brain: 'probabilistic',
    skillLevel: 0.4,
    traits: {
      riskTolerance: 0.3,
      yahtzeeChaser: 0.2,
      upperSectionFocus: -0.3,      // Undervalues upper section
      overvaluesFullHouse: true,
      avoidsEarlyZeros: true,       // Classic beginner mistake
      alwaysUsesAllRolls: true,
      emotionalVolatility: 0.8,
      chatFrequency: 0.6,
    },
    timing: {
      rollDecisionMs: [800, 2000],
      keepDecisionMs: [1000, 2500],
      scoreDecisionMs: [1500, 3500],
      fasterWhenWinning: false,
      slowerOnFinalRounds: true,
      hesitationThresholdEV: 5,
      hesitationExtraMs: [500, 1500],
    },
  },
  
  // ═══════════════════════════════════════════════════════════════
  // INTERMEDIATE
  // ═══════════════════════════════════════════════════════════════
  
  'calculated_carmen': {
    id: 'calculated_carmen',
    name: 'Carmen',
    avatarSeed: 'carmen-calculated-dice',
    tagline: 'Plays the percentages',
    brain: 'probabilistic',
    skillLevel: 0.75,
    traits: {
      riskTolerance: 0.4,
      yahtzeeChaser: -0.2,          // Avoids low-probability gambles
      upperSectionFocus: 0.3,
      overvaluesFullHouse: false,
      avoidsEarlyZeros: false,      // Knows when to take the zero
      alwaysUsesAllRolls: false,
      emotionalVolatility: 0.3,
      chatFrequency: 0.4,
    },
    timing: {
      rollDecisionMs: [500, 1200],
      keepDecisionMs: [600, 1500],
      scoreDecisionMs: [800, 2000],
      fasterWhenWinning: true,
      slowerOnFinalRounds: true,
      hesitationThresholdEV: 3,
      hesitationExtraMs: [300, 800],
    },
  },
  
  'lucky_liam': {
    id: 'lucky_liam',
    name: 'Liam',
    avatarSeed: 'liam-lucky-dice',
    tagline: 'Fortune favors the bold',
    brain: 'personality',
    skillLevel: 0.6,
    traits: {
      riskTolerance: 0.9,           // YOLO energy
      yahtzeeChaser: 0.8,           // Always chasing
      upperSectionFocus: -0.2,
      overvaluesFullHouse: false,
      avoidsEarlyZeros: false,
      alwaysUsesAllRolls: true,     // Always pushes luck
      emotionalVolatility: 0.9,
      chatFrequency: 0.8,
    },
    timing: {
      rollDecisionMs: [300, 800],   // Quick decisions
      keepDecisionMs: [400, 1000],
      scoreDecisionMs: [500, 1200],
      fasterWhenWinning: true,
      slowerOnFinalRounds: false,   // Doesn't slow down
      hesitationThresholdEV: 1,     // Rarely hesitates
      hesitationExtraMs: [100, 300],
    },
  },
  
  // ═══════════════════════════════════════════════════════════════
  // EXPERT
  // ═══════════════════════════════════════════════════════════════
  
  'the_professor': {
    id: 'the_professor',
    name: 'The Professor',
    avatarSeed: 'professor-optimal-dice',
    tagline: 'Statistically speaking...',
    brain: 'optimal',
    skillLevel: 0.95,
    traits: {
      riskTolerance: 0.5,           // EV-neutral
      yahtzeeChaser: 0,             // Pure EV
      upperSectionFocus: 0,
      overvaluesFullHouse: false,
      avoidsEarlyZeros: false,
      alwaysUsesAllRolls: false,
      emotionalVolatility: 0.1,     // Stoic
      chatFrequency: 0.2,
    },
    timing: {
      rollDecisionMs: [1000, 2000], // "Calculating..."
      keepDecisionMs: [800, 1500],
      scoreDecisionMs: [1200, 2500],
      fasterWhenWinning: false,
      slowerOnFinalRounds: true,
      hesitationThresholdEV: 0.5,   // Even tiny differences matter
      hesitationExtraMs: [500, 1200],
    },
  },
  
  // ═══════════════════════════════════════════════════════════════
  // SPECIAL / FUN
  // ═══════════════════════════════════════════════════════════════
  
  'chaotic_charlie': {
    id: 'chaotic_charlie',
    name: 'Charlie',
    avatarSeed: 'charlie-chaos-dice',
    tagline: 'Embrace the chaos',
    brain: 'random',
    skillLevel: 0.2,
    traits: {
      riskTolerance: 0.5,
      yahtzeeChaser: 0,
      upperSectionFocus: 0,
      overvaluesFullHouse: false,
      avoidsEarlyZeros: false,
      alwaysUsesAllRolls: false,
      emotionalVolatility: 1.0,
      chatFrequency: 0.9,
    },
    timing: {
      rollDecisionMs: [200, 3000],  // Wildly variable
      keepDecisionMs: [200, 3000],
      scoreDecisionMs: [200, 3000],
      fasterWhenWinning: false,
      slowerOnFinalRounds: false,
      hesitationThresholdEV: 10,
      hesitationExtraMs: [0, 2000],
    },
  },
};
```

---

## 3. The Brain Interface

### 3.1 Abstract Strategy Interface

```typescript
// brain/types.ts

interface GameContext {
  // Current state
  dice: number[];
  keptDice: boolean[];
  rollsRemaining: number;
  
  // Scorecard state
  scorecard: Scorecard;
  usedCategories: Category[];
  currentUpperScore: number;
  bonusAchieved: boolean;
  
  // Game context
  roundNumber: number;
  isLastRound: boolean;
  
  // Opponent awareness (for future strategy)
  opponents: {
    id: string;
    totalScore: number;
    usedCategories: Category[];
  }[];
}

interface TurnDecision {
  action: 'roll' | 'score';
  
  // If rolling
  keepMask?: boolean[];
  
  // If scoring
  category?: Category;
  
  // Metadata (for debugging/display)
  reasoning?: string;
  confidence?: number;
  alternativesConsidered?: number;
}

interface AIBrain {
  // Core decision method
  decide(context: GameContext, profile: AIProfile): Promise<TurnDecision>;
  
  // Optional: Generate chat message for game event
  react?(event: GameEvent, profile: AIProfile): Promise<string | null>;
  
  // Optional: Pre-turn commentary
  commentary?(context: GameContext, profile: AIProfile): Promise<string | null>;
}
```

### 3.2 Deterministic Brain Implementation

```typescript
// brain/deterministic.ts

import { calculate_ev, optimal_hold, score_category } from 'dicee-engine';

export class DeterministicBrain implements AIBrain {
  
  async decide(context: GameContext, profile: AIProfile): Promise<TurnDecision> {
    const { dice, keptDice, rollsRemaining, usedCategories, scorecard } = context;
    const { traits, skillLevel } = profile;
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Calculate all options with EV
    // ═══════════════════════════════════════════════════════════════
    
    const availableCategories = ALL_CATEGORIES.filter(c => !usedCategories.includes(c));
    
    const scoringOptions = availableCategories.map(category => ({
      category,
      currentScore: score_category(dice, category),
      ev: rollsRemaining > 0 
        ? calculate_ev(dice, keptDice, rollsRemaining, category)
        : score_category(dice, category),
    }));
    
    // Best immediate score
    const bestImmediateScore = Math.max(...scoringOptions.map(o => o.currentScore));
    
    // Best EV if we roll again
    const bestRollEV = rollsRemaining > 0
      ? Math.max(...scoringOptions.map(o => o.ev))
      : 0;
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Apply personality biases
    // ═══════════════════════════════════════════════════════════════
    
    // Modify EVs based on personality
    const biasedOptions = scoringOptions.map(option => {
      let biasedEV = option.ev;
      
      // Yahtzee chaser bias
      if (option.category === 'yahtzee') {
        biasedEV *= (1 + traits.yahtzeeChaser * 0.5);
      }
      
      // Upper section focus
      if (isUpperSection(option.category)) {
        biasedEV *= (1 + traits.upperSectionFocus * 0.3);
      }
      
      // Full house overvaluation
      if (option.category === 'fullHouse' && traits.overvaluesFullHouse) {
        biasedEV *= 1.3;
      }
      
      // Zero avoidance (early game)
      if (option.currentScore === 0 && traits.avoidsEarlyZeros && context.roundNumber < 8) {
        biasedEV *= 0.5;  // Artificially lower EV of zeros
      }
      
      return { ...option, biasedEV };
    });
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Decision with skill-based noise
    // ═══════════════════════════════════════════════════════════════
    
    // Sort by biased EV
    const sortedOptions = biasedOptions.sort((a, b) => b.biasedEV - a.biasedEV);
    
    // Skill-based selection (higher skill = more likely to pick optimal)
    const selectedOption = this.skillBasedSelect(sortedOptions, skillLevel);
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Roll vs Score decision
    // ═══════════════════════════════════════════════════════════════
    
    if (rollsRemaining === 0) {
      // Must score
      return {
        action: 'score',
        category: selectedOption.category,
        reasoning: `No rolls left, scoring ${selectedOption.category}`,
      };
    }
    
    // Risk tolerance affects roll vs score decision
    const evGain = selectedOption.ev - selectedOption.currentScore;
    const riskThreshold = 3 * (1 - traits.riskTolerance);  // Higher tolerance = lower threshold
    
    // Special case: always use all rolls if trait says so
    if (traits.alwaysUsesAllRolls && rollsRemaining > 0 && selectedOption.currentScore < 40) {
      const optimalHold = optimal_hold(dice, rollsRemaining, selectedOption.category);
      return {
        action: 'roll',
        keepMask: optimalHold,
        reasoning: `Rolling again (always uses all rolls)`,
      };
    }
    
    // Normal decision: roll if EV gain exceeds risk threshold
    if (evGain > riskThreshold) {
      const optimalHold = optimal_hold(dice, rollsRemaining, selectedOption.category);
      
      // Apply skill noise to hold decision
      const noisyHold = this.applyHoldNoise(optimalHold, dice, skillLevel);
      
      return {
        action: 'roll',
        keepMask: noisyHold,
        reasoning: `Rolling for ${selectedOption.category} (EV gain: ${evGain.toFixed(1)})`,
      };
    }
    
    // Score now
    return {
      action: 'score',
      category: selectedOption.category,
      reasoning: `Scoring ${selectedOption.category} (${selectedOption.currentScore} pts)`,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // HELPER: Skill-based option selection
  // ═══════════════════════════════════════════════════════════════
  
  private skillBasedSelect(
    sortedOptions: ScoringOption[], 
    skillLevel: number
  ): ScoringOption {
    // At skill 1.0: always pick best
    // At skill 0.5: 75% best, 20% second, 5% random
    // At skill 0.0: uniform random
    
    const r = Math.random();
    
    if (r < skillLevel) {
      // Optimal choice
      return sortedOptions[0];
    } else if (r < skillLevel + (1 - skillLevel) * 0.6 && sortedOptions.length > 1) {
      // Second best
      return sortedOptions[1];
    } else if (sortedOptions.length > 2) {
      // Random from remaining
      const idx = Math.floor(Math.random() * (sortedOptions.length - 2)) + 2;
      return sortedOptions[idx];
    }
    
    return sortedOptions[0];
  }
  
  // ═══════════════════════════════════════════════════════════════
  // HELPER: Add noise to hold decisions
  // ═══════════════════════════════════════════════════════════════
  
  private applyHoldNoise(
    optimalHold: boolean[], 
    dice: number[], 
    skillLevel: number
  ): boolean[] {
    // At skill 1.0: perfect holds
    // At lower skill: occasionally flip a hold decision
    
    const noisy = [...optimalHold];
    
    for (let i = 0; i < 5; i++) {
      if (Math.random() > skillLevel) {
        // 10% chance to flip (scaled by skill)
        if (Math.random() < 0.1) {
          noisy[i] = !noisy[i];
        }
      }
    }
    
    return noisy;
  }
}
```

### 3.3 Brain Type Implementations

```typescript
// brain/factory.ts

type BrainType = 'optimal' | 'probabilistic' | 'personality' | 'random' | 'llm';

export function createBrain(type: BrainType): AIBrain {
  switch (type) {
    case 'optimal':
      // Always picks mathematically optimal play
      return new OptimalBrain();
      
    case 'probabilistic':
      // Optimal with skill-based noise
      return new DeterministicBrain();
      
    case 'personality':
      // Heavy trait influence
      return new PersonalityBrain();
      
    case 'random':
      // Chaos mode
      return new RandomBrain();
      
    case 'llm':
      // Future: LLM-based decisions
      return new LLMBrain();
      
    default:
      return new DeterministicBrain();
  }
}

// ═══════════════════════════════════════════════════════════════
// OPTIMAL: Pure EV maximization
// ═══════════════════════════════════════════════════════════════

class OptimalBrain implements AIBrain {
  async decide(context: GameContext): Promise<TurnDecision> {
    // Always pick highest EV option
    // No personality, no noise
    const bestPlay = findOptimalPlay(context);
    return bestPlay;
  }
}

// ═══════════════════════════════════════════════════════════════
// RANDOM: Chaos agent
// ═══════════════════════════════════════════════════════════════

class RandomBrain implements AIBrain {
  async decide(context: GameContext): Promise<TurnDecision> {
    const { rollsRemaining, usedCategories } = context;
    
    // Random roll vs score
    if (rollsRemaining > 0 && Math.random() > 0.3) {
      return {
        action: 'roll',
        keepMask: Array(5).fill(false).map(() => Math.random() > 0.5),
        reasoning: '🎲 Chaos!',
      };
    }
    
    // Random category
    const available = ALL_CATEGORIES.filter(c => !usedCategories.includes(c));
    const category = available[Math.floor(Math.random() * available.length)];
    
    return {
      action: 'score',
      category,
      reasoning: '🎲 Why not?',
    };
  }
}
```

---

## 4. AI Controller (Durable Object Integration)

### 4.1 Turn Execution Flow

```typescript
// In GameRoom Durable Object

class GameRoom extends DurableObject {
  private aiController: AIController;
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.aiController = new AIController(ctx, env);
  }
  
  // Called when turn changes
  private async onTurnStart(playerId: string) {
    const player = this.state.players[playerId];
    
    if (player.type === 'ai') {
      // Schedule AI turn execution
      await this.aiController.scheduleTurn(player, this.state);
    }
    
    // Broadcast turn start to all clients
    this.broadcast({ type: 'turn.started', playerId });
  }
}

// ai/controller.ts

class AIController {
  private ctx: DurableObjectState;
  private brains: Map<BrainType, AIBrain> = new Map();
  
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    
    // Pre-initialize brains
    this.brains.set('optimal', new OptimalBrain());
    this.brains.set('probabilistic', new DeterministicBrain());
    this.brains.set('personality', new PersonalityBrain());
    this.brains.set('random', new RandomBrain());
  }
  
  async scheduleTurn(player: Player, gameState: GameState) {
    const profile = player.aiProfile!;
    const brain = this.brains.get(profile.brain)!;
    
    // Build context
    const context = this.buildContext(player, gameState);
    
    // Execute turn with realistic timing
    await this.executeTurnWithTiming(player, profile, brain, context, gameState);
  }
  
  private async executeTurnWithTiming(
    player: Player,
    profile: AIProfile,
    brain: AIBrain,
    context: GameContext,
    gameState: GameState
  ) {
    const { timing } = profile;
    
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: Initial roll (if needed)
    // ═══════════════════════════════════════════════════════════════
    
    if (context.rollsRemaining === 3 && !context.dice.length) {
      await this.delay(this.randomInRange(timing.rollDecisionMs));
      await this.executeRoll(player.id, [false, false, false, false, false], gameState);
      
      // Update context after roll
      context.dice = gameState.players[player.id].currentDice!;
      context.rollsRemaining = 2;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: Decision loop (roll or score)
    // ═══════════════════════════════════════════════════════════════
    
    while (true) {
      // Get brain's decision
      const decision = await brain.decide(context, profile);
      
      // Calculate delay based on decision type
      let delay: number;
      if (decision.action === 'roll') {
        delay = this.randomInRange(timing.keepDecisionMs);
      } else {
        delay = this.randomInRange(timing.scoreDecisionMs);
      }
      
      // Add hesitation for close decisions
      if (decision.confidence && decision.confidence < 0.7) {
        delay += this.randomInRange(timing.hesitationExtraMs);
      }
      
      // Timing adjustments
      if (timing.slowerOnFinalRounds && context.roundNumber >= 11) {
        delay *= 1.3;
      }
      if (timing.fasterWhenWinning && this.isWinning(player.id, gameState)) {
        delay *= 0.7;
      }
      
      await this.delay(delay);
      
      // Execute decision
      if (decision.action === 'roll') {
        await this.executeRoll(player.id, decision.keepMask!, gameState);
        
        // Update context
        context.dice = gameState.players[player.id].currentDice!;
        context.keptDice = decision.keepMask!;
        context.rollsRemaining--;
        
        if (context.rollsRemaining === 0) {
          // Must score on next iteration
          continue;
        }
      } else {
        await this.executeScore(player.id, decision.category!, gameState);
        break;  // Turn complete
      }
    }
  }
  
  private async executeRoll(playerId: string, keepMask: boolean[], gameState: GameState) {
    // Goes through normal game state machine
    // This ensures all validation and events fire correctly
    await this.gameRoom.handleCommand({
      type: 'dice.roll',
      playerId,
      keepMask,
    });
  }
  
  private async executeScore(playerId: string, category: Category, gameState: GameState) {
    await this.gameRoom.handleCommand({
      type: 'category.score',
      playerId,
      category,
    });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private randomInRange([min, max]: [number, number]): number {
    return min + Math.random() * (max - min);
  }
}
```

### 4.2 AI Player Creation

```typescript
// ai/factory.ts

export function createAIPlayer(profileId: string, seat: number): Player {
  const profile = AI_PROFILES[profileId];
  
  if (!profile) {
    throw new Error(`Unknown AI profile: ${profileId}`);
  }
  
  return {
    id: `ai_${profileId}_${Date.now()}`,
    type: 'ai',
    name: profile.name,
    avatarSeed: profile.avatarSeed,
    scorecard: createEmptyScorecard(),
    currentDice: null,
    keptDice: [false, false, false, false, false],
    rollsRemaining: 3,
    connectionStatus: 'connected',  // AI never disconnects
    aiProfile: profile,
  };
}

// Room creation with AI players
interface CreateRoomOptions {
  hostPlayerId: string;
  maxPlayers: number;
  fillWithAI: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

export function selectAIProfiles(difficulty: string, count: number): string[] {
  const pools = {
    easy: ['rookie_riley', 'chaotic_charlie'],
    medium: ['calculated_carmen', 'lucky_liam'],
    hard: ['the_professor'],
    mixed: ['rookie_riley', 'calculated_carmen', 'lucky_liam', 'the_professor'],
  };
  
  const pool = pools[difficulty] || pools.mixed;
  const selected: string[] = [];
  
  for (let i = 0; i < count; i++) {
    selected.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  
  return selected;
}
```

---

## 5. Future LLM Integration Points

### 5.1 LLM Brain Interface

```typescript
// brain/llm.ts (Phase 2)

interface LLMConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  temperature: number;
  maxTokens: number;
  
  // Personality prompt
  systemPrompt: string;
  
  // Context window management
  includeGameHistory: boolean;
  maxHistoryTurns: number;
}

class LLMBrain implements AIBrain {
  private config: LLMConfig;
  private fallbackBrain: DeterministicBrain;
  
  constructor(config: LLMConfig) {
    this.config = config;
    this.fallbackBrain = new DeterministicBrain();
  }
  
  async decide(context: GameContext, profile: AIProfile): Promise<TurnDecision> {
    try {
      // Build prompt with game state
      const prompt = this.buildDecisionPrompt(context, profile);
      
      // Call LLM
      const response = await this.callLLM(prompt);
      
      // Parse structured response
      const decision = this.parseDecision(response);
      
      // Validate decision is legal
      if (this.isLegalDecision(decision, context)) {
        return decision;
      }
      
      // Fallback to deterministic
      console.warn('LLM made illegal decision, falling back');
      return this.fallbackBrain.decide(context, profile);
      
    } catch (error) {
      // Always have fallback
      console.error('LLM error, falling back:', error);
      return this.fallbackBrain.decide(context, profile);
    }
  }
  
  async react(event: GameEvent, profile: AIProfile): Promise<string | null> {
    // Generate chat message for game event
    const prompt = this.buildReactionPrompt(event, profile);
    
    try {
      const response = await this.callLLM(prompt);
      return this.sanitizeChat(response);
    } catch {
      return null;  // Silent failure for chat
    }
  }
  
  private buildDecisionPrompt(context: GameContext, profile: AIProfile): string {
    return `
You are ${profile.name}, a Yahtzee player. ${profile.tagline}.

Your personality traits:
- Risk tolerance: ${profile.traits.riskTolerance}/1.0
- ${profile.traits.yahtzeeChaser > 0 ? 'You love chasing Yahtzee' : 'You play conservatively'}

Current game state:
- Round: ${context.roundNumber}/13
- Your dice: [${context.dice.join(', ')}]
- Rolls remaining: ${context.rollsRemaining}
- Your score: ${calculateTotalScore(context.scorecard)}

Available categories and current scores:
${this.formatAvailableCategories(context)}

Respond with a JSON object:
{
  "action": "roll" | "score",
  "keepMask": [true/false, ...] // if rolling
  "category": "..." // if scoring
  "reasoning": "..." // brief explanation
}
`.trim();
  }
}
```

### 5.2 Chat Integration Points

```typescript
// Events that can trigger AI chat
type ChatTrigger = 
  | { type: 'game_start' }
  | { type: 'my_turn_start' }
  | { type: 'my_roll'; dice: number[]; isGood: boolean }
  | { type: 'my_score'; category: Category; score: number }
  | { type: 'opponent_roll'; playerId: string; dice: number[] }
  | { type: 'opponent_score'; playerId: string; category: Category; score: number }
  | { type: 'yahtzee'; playerId: string }
  | { type: 'game_end'; myRank: number; winner: string };

// Deterministic chat responses (Phase 1)
const DETERMINISTIC_CHAT: Record<string, string[]> = {
  'my_yahtzee': [
    "YAHTZEE! 🎲🎲🎲🎲🎲",
    "Now THAT'S what I'm talking about!",
    "Did that just happen?!",
  ],
  'opponent_yahtzee': [
    "Nice roll! 👏",
    "Wow, impressive!",
    "Well played!",
  ],
  'bad_roll': [
    "Oof.",
    "That's... not great.",
    "The dice gods are cruel today.",
  ],
  'game_start': [
    "Good luck everyone!",
    "Let's roll! 🎲",
    "May the best player win!",
  ],
  // ... more
};

// AI can optionally send chat based on triggers
class AIController {
  private async maybeSendChat(
    player: Player, 
    trigger: ChatTrigger,
    gameState: GameState
  ) {
    const profile = player.aiProfile!;
    
    // Check chat frequency
    if (Math.random() > profile.traits.chatFrequency) {
      return;  // Skip this chat opportunity
    }
    
    let message: string | null = null;
    
    if (profile.llmConfig) {
      // Use LLM for chat
      const brain = this.brains.get('llm') as LLMBrain;
      message = await brain.react(trigger, profile);
    } else {
      // Use deterministic chat
      message = this.getDeterministicChat(trigger, profile);
    }
    
    if (message) {
      this.gameRoom.broadcastChat({
        playerId: player.id,
        message,
        timestamp: Date.now(),
      });
    }
  }
}
```

---

## 6. Testing & Debugging

### 6.1 AI Replay System

```typescript
// For debugging AI decisions

interface AIDecisionLog {
  turnNumber: number;
  playerId: string;
  context: GameContext;
  decision: TurnDecision;
  timing: {
    thinkTimeMs: number;
    totalTurnMs: number;
  };
  evAnalysis: {
    optimalPlay: TurnDecision;
    optimalEV: number;
    chosenEV: number;
    evLoss: number;
  };
}

// Store decision history
class AIController {
  private decisionLog: AIDecisionLog[] = [];
  
  async executeTurnWithTiming(...) {
    const startTime = Date.now();
    
    // ... decision logic ...
    
    // Log decision
    this.decisionLog.push({
      turnNumber: context.roundNumber,
      playerId: player.id,
      context: { ...context },
      decision,
      timing: {
        thinkTimeMs: decision.thinkTime,
        totalTurnMs: Date.now() - startTime,
      },
      evAnalysis: {
        optimalPlay: findOptimalPlay(context),
        optimalEV: calculateOptimalEV(context),
        chosenEV: calculateEV(context, decision),
        evLoss: calculateOptimalEV(context) - calculateEV(context, decision),
      },
    });
  }
  
  // Dump log for debugging
  getDecisionLog(): AIDecisionLog[] {
    return this.decisionLog;
  }
}
```

### 6.2 AI Skill Calibration Tests

```typescript
// test/ai-calibration.test.ts

describe('AI Skill Calibration', () => {
  it('optimal brain achieves ~310 average score', async () => {
    const scores = await playGames('optimal', 1000);
    expect(average(scores)).toBeCloseTo(310, 5);
  });
  
  it('skill 0.5 achieves ~260 average score', async () => {
    const scores = await playGames('probabilistic', 1000, { skillLevel: 0.5 });
    expect(average(scores)).toBeCloseTo(260, 10);
  });
  
  it('random brain achieves ~150 average score', async () => {
    const scores = await playGames('random', 1000);
    expect(average(scores)).toBeCloseTo(150, 20);
  });
  
  it('rookie_riley beats chaotic_charlie 70% of time', async () => {
    const results = await playHeadToHead('rookie_riley', 'chaotic_charlie', 500);
    expect(results.rookie_riley_wins / 500).toBeGreaterThan(0.65);
  });
});
```

---

## 7. Implementation Phases

### Phase 1: Deterministic AI (Week 1-2)
- [ ] `AIProfile` type and pre-built profiles
- [ ] `DeterministicBrain` with WASM engine integration
- [ ] `AIController` in Durable Object
- [ ] Turn timing simulation
- [ ] Basic "AI fills empty seats" flow
- [ ] Solo mode against AI

### Phase 2: Polish & Chat (Week 3)
- [ ] Deterministic chat triggers
- [ ] AI reaction to game events
- [ ] Profile selection UI
- [ ] Difficulty presets
- [ ] AI decision logging/replay

### Phase 3: LLM Integration (Future)
- [ ] `LLMBrain` implementation
- [ ] Anthropic API integration in Workers
- [ ] Chat personality system
- [ ] Fallback chain (LLM → Deterministic)
- [ ] Cost monitoring/rate limiting

---

## 8. Open Questions

1. **Should AI players count toward leaderboards?** 
   - Probably no for ranked, yes for "games played" stats
   
2. **Can spectators tell who's AI?**
   - Yes, display 🤖 badge. No deception.
   
3. **AI in rated games?**
   - Probably no. AI for practice/casual only.
   
4. **AI timing in fast-paced games?**
   - Consider "speed AI" profiles with shorter delays
   
5. **Multi-AI games for testing?**
   - Yes, useful for balance testing and demos
