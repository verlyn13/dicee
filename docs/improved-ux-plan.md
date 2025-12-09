# Dicee UX/UI Enhancement Specification
## "The Exchange" — Professional Multiplayer Experience

This document builds on the existing multiplayer UX plan, adding modern interaction patterns and integrating the Rust/WASM probability engine to create a premium game experience.

---

## 1. Statistical Engine Integration

### Philosophy: "Informed Play"

The probability engine transforms Dicee from a luck game into an **informed decision-making experience**. Players should feel like traders on a floor—seeing the odds, understanding the spread, making calculated moves.

### Core Statistical Displays

#### Expected Value (EV) Indicators

Every scoreable category shows real-time EV when dice are visible:

```
┌─────────────────────────────────────────┐
│  THREE OF A KIND                        │
│  ┌──────────────────────────────────┐   │
│  │ Current: 18    EV: 23.4  ▲ +5.4  │   │  ← Green when EV > current
│  │ ░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓   │   │  ← Bar shows EV potential
│  └──────────────────────────────────┘   │
│  P(improve): 42%  |  Best hold: ⚃⚃⚃    │
└─────────────────────────────────────────┘
```

**Data structure from engine:**
```typescript
interface CategoryAnalysis {
  category: Category;
  currentScore: number;          // What you'd score NOW
  expectedValue: number;         // EV if you re-roll optimally
  probabilityOfImprovement: number;
  optimalHold: boolean[];        // Which dice to keep
  confidence: 'low' | 'medium' | 'high';  // Based on rolls remaining
}
```

#### The Probability Ribbon

A persistent horizontal bar below the dice tray showing probability distribution for key outcomes:

```
┌─────────────────────────────────────────────────────────────────────┐
│  YAHTZEE: 2.3%  │  FULL HOUSE: 18%  │  STRAIGHT: 12%  │  3-KIND: 45%  │
│  ▓░░░░░░░░░░░░  │  ▓▓▓▓░░░░░░░░░░░  │  ▓▓▓░░░░░░░░░░  │  ▓▓▓▓▓▓▓▓▓░  │
└─────────────────────────────────────────────────────────────────────┘
```

**Updates in real-time** as dice are held/released. Uses CSS custom properties for dynamic bar widths.

#### Keep Suggestion System

When hovering over "Roll Again", show optimal hold pattern:

```
┌──────────────────────────────────────┐
│         SUGGESTED HOLD               │
│                                      │
│    [⚃]   [⚂]   [⚃]   [⚁]   [⚃]     │
│    KEEP  ROLL  KEEP  ROLL  KEEP     │
│     ▲           ▲           ▲       │
│                                      │
│  EV: 28.4 → 34.2 (+5.8)             │
│  "Hold the 4s for Three of a Kind"  │
└──────────────────────────────────────┘
```

**Configurable coach level:**
- **Off**: No suggestions
- **Hints**: Only shows EV, player figures out holds
- **Coach**: Full suggestions with explanation
- **Training**: Warns before suboptimal plays

### Post-Game Analysis

#### The Play-by-Play Review

After game completion, show a scrollable analysis:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ROUND 7 — Your Score: 25 (Full House)                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                      │
│  Roll 1: [2][3][3][5][6]                                            │
│  You held: [3][3]  ✓ Optimal                                        │
│                                                                      │
│  Roll 2: [3][3][2][2][4]                                            │
│  You held: [3][3][2][2]  ✓ Optimal                                  │
│                                                                      │
│  Roll 3: [3][3][2][2][5]                                            │
│  You scored: Full House (25)  ✓ Best choice                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Alternative: Large Straight had 23% chance with [2][3] hold   │ │
│  │  Your choice was +3.2 EV over gambling for straight            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

#### Summary Statistics

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GAME SUMMARY                                  │
├──────────────────────────────────────────────────────────────────────┤
│  Final Score: 287          Optimal Possible: 312                     │
│  Efficiency: 92%           Rank: 1st of 4                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  SKILL vs LUCK BREAKDOWN                                        ││
│  │                                                                 ││
│  │  Your Decisions    ████████████████████░░░░░  82% optimal       ││
│  │  Dice Luck         ██████████████░░░░░░░░░░░  56% (below avg)   ││
│  │  Net Performance   ████████████████████████░  +24 over expected ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  Key Insight: "You outperformed expectations by making              │
│  excellent use of suboptimal rolls."                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Personal Statistics Dashboard

Persistent player stats (stored in Supabase):

```typescript
interface PlayerStats {
  gamesPlayed: number;
  averageScore: number;
  highScore: number;
  averageEfficiency: number;      // % of optimal decisions
  luckFactor: number;             // Actual vs expected dice outcomes
  yahtzeeCount: number;
  perfectGames: number;           // 100% optimal decisions
  currentStreak: number;
  bestStreak: number;
  categoryMastery: Record<Category, {
    averageScore: number;
    optimalScore: number;         // What optimal play would average
    timesScored: number;
  }>;
}
```

---

## 2. Enhanced Micro-Interactions

### Dice Physics System

Replace simple CSS animations with physics-based motion:

```typescript
// DicePhysics.ts - Uses spring dynamics
interface DiceSpring {
  stiffness: 400;
  damping: 28;
  mass: 1;
}

const rollAnimation = {
  // Initial velocity based on "throw" gesture
  initialVelocity: { x: random(-200, 200), y: random(-150, -50), rotation: random(-720, 720) },
  
  // Bounce off tray boundaries
  boundaries: { left: 0, right: trayWidth, top: 0, bottom: trayHeight },
  
  // Settle into final position
  settlePositions: calculateGridPositions(5),
  
  // Duration varies by initial energy
  duration: random(800, 1200),
};
```

**Visual phases:**
1. **Launch** (0-100ms): Dice lift and spin rapidly
2. **Flight** (100-400ms): Tumble with decreasing rotation
3. **Settle** (400-800ms): Spring into grid positions
4. **Reveal** (800-1000ms): Final value "locks in" with subtle flash

### Haptic Choreography

Coordinated haptic patterns for immersive feedback:

```typescript
const hapticPatterns = {
  roll: {
    launch: { pattern: [10, 20, 10, 20, 10], intensity: 'heavy' },
    tumble: { pattern: [5, 50, 5, 50, 5, 50], intensity: 'light' },
    settle: { pattern: [30], intensity: 'medium' },
  },
  
  yahtzee: {
    pattern: [100, 50, 100, 50, 200],
    intensity: 'heavy',
  },
  
  turnStart: {
    pattern: [50, 30, 100],
    intensity: 'medium',
  },
  
  optimalPlay: {
    pattern: [20, 20, 20],
    intensity: 'light',  // Subtle confirmation
  },
  
  suboptimalWarning: {
    pattern: [10, 10, 10, 10, 50],
    intensity: 'medium',
  },
};
```

### Audio Design System

Spatial audio cues reinforce the "Exchange" trading floor theme:

```typescript
const audioBank = {
  // Dice sounds
  diceRoll: { src: '/audio/dice-roll.mp3', volume: 0.7 },
  diceLand: { src: '/audio/dice-land.mp3', volume: 0.5, variants: 5 },
  diceKeep: { src: '/audio/chip-click.mp3', volume: 0.3 },      // Like casino chips
  
  // Scoring sounds
  scoreConfirm: { src: '/audio/register-ding.mp3', volume: 0.4 },
  bonusAchieved: { src: '/audio/bell-triple.mp3', volume: 0.6 },
  yahtzee: { src: '/audio/jackpot.mp3', volume: 0.8 },
  
  // Ambient/system
  turnChange: { src: '/audio/soft-chime.mp3', volume: 0.3 },
  chatMessage: { src: '/audio/pop.mp3', volume: 0.2 },
  playerJoin: { src: '/audio/door-open.mp3', volume: 0.3 },
  countdown: { src: '/audio/tick.mp3', volume: 0.4 },
  
  // Ticker tape ambient (optional loop)
  tickerAmbient: { src: '/audio/ticker-loop.mp3', volume: 0.1, loop: true },
};
```

### Loading & Skeleton States

Professional skeleton loading for async content:

```svelte
<!-- ScoreCardSkeleton.svelte -->
<div class="scorecard-skeleton">
  {#each Array(13) as _, i}
    <div class="row-skeleton" style="animation-delay: {i * 50}ms">
      <div class="category-skeleton shimmer" />
      <div class="score-skeleton shimmer" />
    </div>
  {/each}
</div>

<style>
  .shimmer {
    background: linear-gradient(
      90deg,
      var(--color-surface) 0%,
      var(--color-surface-elevated) 50%,
      var(--color-surface) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
```

---

## 3. "The Exchange" Visual Enhancements

### Event Ticker Tape

A scrolling LED-matrix style ticker for lobby events:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ▶ YAHTZEE! @player_jane scored 50 in Room ABC  •  @mike joined lobby  •  
   Room XYZ full (4/4)  •  @sarah won with 312 points  •  12 players online
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Implementation:**
```svelte
<div class="ticker-container">
  <div class="ticker-track" style="--duration: {events.length * 3}s">
    {#each [...events, ...events] as event}
      <span class="ticker-item {event.type}">
        {#if event.type === 'yahtzee'}
          <span class="icon">🎲</span>
        {:else if event.type === 'win'}
          <span class="icon">🏆</span>
        {/if}
        {event.message}
      </span>
      <span class="ticker-separator">•</span>
    {/each}
  </div>
</div>

<style>
  .ticker-container {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--color-ink);
    color: var(--color-signal-live);
    overflow: hidden;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .ticker-track {
    display: flex;
    animation: scroll var(--duration) linear infinite;
    white-space: nowrap;
  }
  
  @keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  
  .ticker-item.yahtzee {
    color: var(--color-accent);
    font-weight: bold;
  }
</style>
```

### Market-Style EV Display

EV indicators use trading floor visual language:

```
┌─────────────────────────────────────┐
│  FULL HOUSE                         │
│                                     │
│        25        EV 18.4            │
│       ████       ▼ -6.6             │  ← Red downward when EV < current
│      CURRENT     REROLL             │
│                                     │
│  [SCORE NOW]  vs  [GAMBLE]          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  LARGE STRAIGHT                     │
│                                     │
│         0       EV 24.2             │
│        ---      ▲ +24.2             │  ← Green upward when EV > current
│      CURRENT    REROLL              │
│                                     │
│  [ZERO NOW]  vs  [CHASE IT]         │
└─────────────────────────────────────┘
```

### Probability Bars as "Spread Indicators"

Use trading spread visualization for probability:

```svelte
<div class="spread-bar">
  <div class="spread-fill" style="--probability: {probability}%">
    <span class="spread-value">{(probability).toFixed(1)}%</span>
  </div>
  <div class="spread-threshold" style="--threshold: 50%" />
</div>

<style>
  .spread-bar {
    height: 24px;
    background: var(--color-surface);
    border: 2px solid var(--color-ink);
    position: relative;
  }
  
  .spread-fill {
    height: 100%;
    width: calc(var(--probability) * 1%);
    background: linear-gradient(
      90deg,
      var(--color-danger) 0%,
      var(--color-warning) 33%,
      var(--color-signal-live) 66%
    );
    transition: width 300ms ease-out;
  }
  
  .spread-threshold {
    position: absolute;
    left: calc(var(--threshold) * 1%);
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-ink);
  }
</style>
```

---

## 4. Multiplayer Enhancements

### Reactions System

Quick emoji reactions during gameplay:

```typescript
const reactions = [
  { emoji: '👏', label: 'Nice!', duration: 2000 },
  { emoji: '😱', label: 'Wow!', duration: 2000 },
  { emoji: '😅', label: 'Oof', duration: 2000 },
  { emoji: '🎯', label: 'Calculated', duration: 2000 },
  { emoji: '🍀', label: 'Lucky!', duration: 2000 },
  { emoji: '⏰', label: 'Hurry!', duration: 2000 },
];
```

**Display:** Reactions float up from the sender's avatar in the turn indicator/opponent panel.

**Rate limiting:** Max 3 reactions per player per turn (server-enforced).

### Spectator Mode

Non-players can watch ongoing games:

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔴 LIVE  |  Room ABC123  |  Round 7/13  |  👁 12 watching          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Full game view - spectators see all scorecards]                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  SPECTATOR CHAT                                                │ │
│  │  ────────────────                                              │ │
│  │  @viewer1: That was a risky play!                              │ │
│  │  @viewer2: Should've kept the 5s                               │ │
│  │  [Spectator chat input - separate from player chat]            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Spectator features:**
- See all players' scorecards (but not their EV analysis)
- Separate spectator chat channel
- Can react but reactions only visible to other spectators
- No game state influence

### Skill Rating System

ELO-style rating for competitive play:

```typescript
interface SkillRating {
  rating: number;            // Starting at 1000
  confidence: number;        // Increases with games played
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  peakRating: number;
  recentForm: ('W' | 'L')[];  // Last 10 games
}

// Rating calculation considers:
// 1. Win/loss (primary factor)
// 2. Efficiency differential (secondary)
// 3. Opponent strength (tertiary)
```

**Display in lobby:**
```
┌──────────────────────────────┐
│  @player_jane                │
│  ████ Gold III (1842)        │
│  Form: W W L W W W L W W W   │
│  Win Rate: 68%               │
└──────────────────────────────┘
```

### Match History

Persistent game records:

```typescript
interface MatchRecord {
  matchId: string;
  timestamp: Date;
  players: {
    id: string;
    name: string;
    rating: number;
    finalScore: number;
    efficiency: number;
    placement: number;
  }[];
  duration: number;
  roomCode: string;
  isRanked: boolean;
}
```

**History view:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  MATCH HISTORY                                          [Filters ▼] │
├──────────────────────────────────────────────────────────────────────┤
│  Dec 7, 2025 • 2:34 PM                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  🥇 You: 287 (92% eff)    +18 rating                           │ │
│  │  🥈 @mike: 265 (85% eff)                                       │ │
│  │  🥉 @sarah: 241 (78% eff)                                      │ │
│  │                                              [View Replay →]    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Dec 7, 2025 • 1:12 PM                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  🥈 You: 298 (95% eff)    -12 rating                           │ │
│  │  🥇 @jane: 312 (98% eff)                                       │ │
│  │                                              [View Replay →]    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Solo Mode Enhancements

### Training Mode

Dedicated practice with full statistical feedback:

```
┌──────────────────────────────────────────────────────────────────────┐
│  TRAINING MODE                                    [Exit to Menu]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Current Roll: [4][4][2][5][6]       Rolls Left: 2                  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  COACH ANALYSIS                                                 ││
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ││
│  │                                                                 ││
│  │  OPTIMAL HOLD: [4][4]                                           ││
│  │  EV: 18.4 → 26.7 (+8.3)                                        ││
│  │                                                                 ││
│  │  Why: Keeping the pair of 4s gives you:                        ││
│  │  • 42% chance of Three of a Kind (avg 22)                      ││
│  │  • 11% chance of Full House (25)                               ││
│  │  • 2.8% chance of Four of a Kind (avg 21)                      ││
│  │  • 0.08% chance of Yahtzee (50)                                ││
│  │                                                                 ││
│  │  Alternative: Keeping [4][5][6] for straight                   ││
│  │  EV: 12.1 — Not recommended (worse by 14.6)                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  [Roll Again]    [Show Me Optimal]    [Score Now]                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Challenge Modes

Pre-configured scenarios for skill development:

```typescript
const challenges = [
  {
    id: 'forced-yahtzee',
    name: 'Yahtzee Hunter',
    description: 'Start with [3][3][3][1][2]. Can you get the Yahtzee?',
    initialDice: [3, 3, 3, 1, 2],
    rollsRemaining: 2,
    target: 'yahtzee',
    parScore: 50,  // Optimal play achieves this 1.2% of the time
  },
  {
    id: 'full-house-or-bust',
    name: 'Full House Gambit',
    description: 'You need Full House to win. One roll left.',
    initialDice: [2, 2, 5, 5, 3],
    rollsRemaining: 1,
    target: 'fullHouse',
    parScore: 25,
  },
  {
    id: 'efficiency-run',
    name: 'Perfect Game',
    description: 'Play a full game. Target: 95% efficiency.',
    type: 'full-game',
    targetEfficiency: 0.95,
  },
];
```

### Leaderboards

Solo high score tracking:

```
┌──────────────────────────────────────────────────────────────────────┐
│  LEADERBOARDS                                                        │
├──────────────────────────────────────────────────────────────────────┤
│  [All Time]  [This Week]  [Today]  [Friends]                        │
│                                                                      │
│   #   PLAYER          SCORE    EFFICIENCY    DATE                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│   1   @dice_master    387      98%          Dec 3                   │
│   2   @lucky_roll     374      96%          Dec 5                   │
│   3   @you            362      94%          Dec 7                   │  ← Highlighted
│   4   @yahtzee_king   358      91%          Dec 1                   │
│   5   @probability    351      99%          Nov 28                  │
│                                                                      │
│  Your Best: 362 (Rank #3)    Avg: 287    Games: 47                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Accessibility Enhancements

### Motion Preferences

```typescript
// Respect user's motion preferences
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const animationConfig = prefersReducedMotion ? {
  diceRoll: { duration: 0, bounce: false },
  transitions: { duration: 100 },
  ticker: { enabled: false },
} : {
  diceRoll: { duration: 1000, bounce: true },
  transitions: { duration: 300 },
  ticker: { enabled: true },
};
```

### Screen Reader Support

```svelte
<!-- Dice announce their values -->
<div 
  role="img" 
  aria-label="Die showing {value}" 
  aria-live="polite"
  class="die"
>
  {value}
</div>

<!-- Turn announcements -->
<div class="visually-hidden" aria-live="assertive">
  {#if isMyTurn}
    It's your turn. Round {round} of 13. You have {rollsRemaining} rolls remaining.
  {:else}
    {currentPlayer.name}'s turn. Round {round} of 13.
  {/if}
</div>

<!-- EV can be read aloud -->
<button aria-describedby="ev-{category}">
  {categoryName}
</button>
<div id="ev-{category}" class="visually-hidden">
  Current score {currentScore}. Expected value if you reroll: {ev}.
</div>
```

### Color Blind Safe Palette

```css
:root {
  /* Signal colors with pattern/shape alternatives */
  --color-signal-live: #00FF94;      /* Also uses ● shape */
  --color-signal-busy: #FF4D00;      /* Also uses ■ shape */
  --color-positive: #00FF94;         /* Also uses ▲ arrow */
  --color-negative: #FF4D00;         /* Also uses ▼ arrow */
  
  /* High contrast mode overrides */
  @media (prefers-contrast: high) {
    --color-signal-live: #00FF00;
    --color-signal-busy: #FF0000;
    --color-ink: #000000;
    --color-paper: #FFFFFF;
  }
}
```

---

## 7. Technical Implementation Notes

### Engine Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Svelte)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │  Game Store     │    │  Analysis Store │    │  UI Components │  │
│  │  (multiplayer   │───▶│  (WASM bridge)  │───▶│  (display)     │  │
│  │   game.svelte.ts)    │                 │    │                │  │
│  └─────────────────┘    └─────────────────┘    └────────────────┘  │
│          │                      │                                   │
│          │                      ▼                                   │
│          │              ┌─────────────────┐                        │
│          │              │  WASM Engine    │                        │
│          │              │  (dicee_engine) │                        │
│          │              │                 │                        │
│          │              │  - probability  │                        │
│          │              │  - ev_calc      │                        │
│          │              │  - optimal_hold │                        │
│          │              └─────────────────┘                        │
│          │                                                          │
│          ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    WebSocket (Durable Objects)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Analysis Store Pattern

```typescript
// analysisStore.svelte.ts
import init, { calculate_ev, optimal_hold, category_probabilities } from 'dicee-engine';

class AnalysisStore {
  private engineReady = $state(false);
  private currentAnalysis = $state<CategoryAnalysis[] | null>(null);
  
  async initialize() {
    await init();
    this.engineReady = true;
  }
  
  analyzePosition(dice: number[], kept: boolean[], rollsRemaining: number, usedCategories: Category[]) {
    if (!this.engineReady) return null;
    
    // Batch all category calculations
    const analyses = CATEGORIES
      .filter(cat => !usedCategories.includes(cat))
      .map(category => ({
        category,
        currentScore: calculateScore(dice, category),
        expectedValue: calculate_ev(dice, kept, rollsRemaining, category),
        optimalHold: optimal_hold(dice, rollsRemaining, category),
        probabilityOfImprovement: /* derived from ev comparison */,
      }));
    
    this.currentAnalysis = analyses;
    return analyses;
  }
  
  // Debounced analysis updates (expensive WASM calls)
  analyzeDebounced = debounce(this.analyzePosition, 100);
}
```

### Performance Considerations

1. **WASM calls are synchronous** — run analysis on state change, not every frame
2. **Memoize probability calculations** — same dice + kept = same result
3. **Lazy load engine** — only init when entering game, not on lobby
4. **Background analysis** — use `requestIdleCallback` for non-critical stats

```typescript
// Only calculate what's visible
const visibleCategories = $derived(
  isMobile ? categories.slice(scrollPosition, scrollPosition + 6) : categories
);

// Memoize expensive calculations
const analysisCache = new Map<string, CategoryAnalysis>();

function getCachedAnalysis(dice: number[], kept: boolean[], category: Category) {
  const key = `${dice.join(',')}-${kept.join(',')}-${category}`;
  if (!analysisCache.has(key)) {
    analysisCache.set(key, computeAnalysis(dice, kept, category));
  }
  return analysisCache.get(key)!;
}
```

---

## 8. Feature Flags & Progressive Rollout

```typescript
const features = {
  // Core features (always on)
  multiplayer: true,
  basicStats: true,
  
  // Statistical engine features
  evDisplay: { enabled: true, rollout: 100 },
  coachMode: { enabled: true, rollout: 100 },
  postGameAnalysis: { enabled: true, rollout: 100 },
  
  // Social features
  reactions: { enabled: true, rollout: 50 },
  spectatorMode: { enabled: false, rollout: 0 },
  skillRating: { enabled: false, rollout: 0 },
  
  // Premium features (future)
  advancedStats: { enabled: false, premium: true },
  replayExport: { enabled: false, premium: true },
};
```

---

## 9. Summary: The "Pro" Experience

| Feature | Before | After |
|---------|--------|-------|
| **Decision Making** | Gut feeling | EV-informed choices |
| **Feedback** | Win/lose | Skill vs luck breakdown |
| **Learning** | Trial and error | Coached optimal play |
| **Social** | Basic chat | Reactions, spectating, ratings |
| **Aesthetics** | Functional | Trading floor immersion |
| **Feel** | Game | Premium experience |

The key insight: **Dicee isn't just a dice game—it's a decision-making trainer wrapped in a social experience.** The statistical engine provides the depth, the Exchange theme provides the personality, and the modern micro-interactions provide the polish.
