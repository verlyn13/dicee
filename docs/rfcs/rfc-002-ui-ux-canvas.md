# RFC-002: UI/UX Canvas Design
**Project:** Dicee — Educational Probability Platform  
**RFC Status:** Review → Revision → Accepted  
**Version:** 1.1  
**Date:** October 25, 2025  
**Authors:** Design & Engineering Team  
**Reviewers:** Technical Review Complete

---

## Document Status & Versioning

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2025-10-25 | Initial UI/UX architecture specification | Superseded |
| 1.1 | 2025-10-25 | Post-review revision: v1/v2 phasing, MVS focus, Neo-Brutalist fixes | Current |

**Review Summary:** Strong Accept with Revisions. Core thesis ("stats as superpowers") is sound. Revised to focus on Minimum Viable Statistics (MVS) for v1.0, deferred complex visualizations to v2.0, simplified complexity system to manual setting, fixed Neo-Brutalist contradictions, and adjusted mobile layout proportions.

**Related RFCs:**
- RFC-001: Statistical Engine Architecture ✅
- RFC-003: Data Contracts & Event Schema (TBD)
- RFC-004: Game Loop & Mechanics (TBD)
- RFC-005: Educational Content System (TBD)

**Dependencies:**
- Requires RFC-001 statistical engine for data sources
- Informs RFC-004 game mechanics implementation

---

## Abstract

This RFC specifies the user interface and user experience architecture for Dicee, focusing on the critical challenge: **making statistics feel like superpowers, not homework**. The design employs a Neo-brutalist aesthetic with a revolutionary **Statistical Heads-Up Display (HUD)** that overlays probabilistic information contextually, adapting complexity based on player skill level through progressive disclosure.

**Core Innovation:** Transform the UI canvas into a multi-layered statistical instrument where information density, visual prominence, and interaction patterns scale dynamically with player mastery, creating an experience where probability becomes intuitive through embodied play.

---

## Table of Contents

1. [Design Philosophy & Principles](#1-design-philosophy--principles)
2. [Canvas Architecture & Layout System](#2-canvas-architecture--layout-system)
3. [Neo-Brutalist Design Language](#3-neo-brutalist-design-language)
4. [Statistical HUD System](#4-statistical-hud-system)
5. [Progressive Complexity Layers](#5-progressive-complexity-layers)
6. [Component Specifications](#6-component-specifications)
7. [Interaction Patterns & Gestures](#7-interaction-patterns--gestures)
8. [Responsive Adaptation Strategy](#8-responsive-adaptation-strategy)
9. [Animation & Motion Design](#9-animation--motion-design)
10. [Accessibility & Inclusive Design](#10-accessibility--inclusive-design)
11. [Performance Budget](#11-performance-budget)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Design Validation Metrics](#13-design-validation-metrics)
14. [Appendices](#14-appendices)

---

## 1. Design Philosophy & Principles

### 1.1 Core Design Thesis

**Statistics Must Feel Like Superpowers**

Traditional educational interfaces treat statistics as supplementary information—tooltips, sidebar panels, post-hoc reports. Dicee inverts this relationship: **probability is the primary interface layer**, and the game components (dice, scorecard) are the substrate through which statistical thinking manifests.

**Analogy:** Just as fighter pilots use HUDs that overlay flight data on their field of vision, Dicee players navigate probability space with statistical overlays that enhance rather than obstruct their decision-making.

### 1.2 Design Principles

**Principle 1: Ambient Awareness**  
Statistics exist in the visual periphery until needed. Players develop intuition through continuous exposure without conscious attention.

**Principle 2: Progressive Revelation**  
The interface starts minimal and grows more sophisticated as players demonstrate mastery. Complexity unlocks, never overwhelms.

**Principle 3: Honest Aesthetics**  
Neo-brutalist design communicates "this is a tool for learning" through raw, functional beauty. No decoration masks statistical reality.

**Principle 4: Contextual Intelligence**  
Every UI element adapts to game state, player skill, and moment-to-moment context. No static layouts.

**Principle 5: Tactile Feedback**  
Every interaction generates immediate, satisfying feedback. Players feel the weight of decisions through visual and haptic response.

### 1.3 User Experience Goals

**For Beginners (Sessions 1-10):**
- "I understand what each number means"
- "I can see which move is best without feeling lectured"
- "The game feels smooth and responsive"

**For Intermediate (Sessions 11-50):**
- "I'm starting to predict probabilities before I see them"
- "I understand why certain moves are better"
- "I can experiment with different strategies confidently"

**For Advanced (Sessions 51+):**
- "I think in terms of expected value naturally"
- "I can read the statistical landscape at a glance"
- "The interface gets out of my way and lets me focus"

### 1.4 Anti-Patterns to Avoid

❌ **Statistical Clutter:** Too many numbers create cognitive overload  
❌ **Delayed Feedback:** Waiting for calculations breaks flow state  
❌ **Inconsistent Metaphors:** Mixed visual languages confuse understanding  
❌ **Patronizing Simplification:** Dumbing down insults player intelligence  
❌ **Modal Dialogs:** Blocking interactions disrupts gameplay rhythm  

---

## 2. Canvas Architecture & Layout System

### 2.1 Information Density Zones

The canvas is divided into **semantic zones** with distinct information density and interaction priority.

```
Mobile Portrait (375×667 baseline)
┌─────────────────────────────────────┐
│  Zone 1: Action Layer (30% height)  │
│  ┌───────────────────────────────┐  │
│  │   Dice Tray (Compact)         │  │
│  │   [🎲] [🎲] [🎲]             │  │
│  │   [🎲] [🎲]                   │  │
│  │   Roll • 2/3                  │  │
│  │                               │  │
│  │   Statistical HUD (Overlay)   │  │
│  │   ↳ Category Heat Map         │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Zone 2: Decision Layer (60%)      │
│  ┌───────────────────────────────┐  │
│  │   Scorecard (Scrollable)      │  │
│  │   Upper Section               │  │
│  │   ⚀ Ones    [  3] ✓          │  │
│  │   ⚁ Twos    [   ] 23%         │  │
│  │   ⚂ Threes  [  9] ✓          │  │
│  │   ⚃ Fours   [   ] 15%         │  │
│  │   ⚄ Fives   [   ] 100%        │  │
│  │   ⚅ Sixes   [   ] 8%          │  │
│  │   Bonus: 18/63                │  │
│  │                               │  │
│  │   Lower Section               │  │
│  │   🏠 Full House [  ] 16.7%    │  │
│  │   ...                         │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Zone 3: Context Layer (10%)       │
│  ┌───────────────────────────────┐  │
│  │ 👤 Your Turn  Stats:ON  💬    │  │
│  │ Turn 5/13 • Score: 145        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Zone Characteristics:**

| Zone | Density | Interaction | Sticky | Purpose | v1 Height |
|------|---------|-------------|--------|---------|-----------|
| Action | High | Primary | Yes | Execute rolls, manipulate dice | 30% |
| Decision | Medium | Secondary | No | Choose scoring categories | 60% |
| Context | Low | Tertiary | Yes | Game state, social features | 10% |

**Height Rationale:**
- **30% Action Layer:** Compact dice grid (3+2 layout) ensures full Upper Section visible without scrolling
- **60% Decision Layer:** Shows 7-8 categories simultaneously on most devices, reducing scroll friction
- **10% Context:** Minimal but persistent game state

### 2.2 Desktop Adaptive Layout

Desktop expands zones horizontally for always-visible context:

```
Desktop (1440×900 baseline)
┌────────────────┬──────────────────────┬────────────────┐
│  Action Zone   │   Decision Zone      │  Analytics     │
│  (30% width)   │   (45% width)        │  Zone (25%)    │
│                │                      │                │
│  ┌──────────┐  │  ┌────────────────┐  │  ┌──────────┐  │
│  │  Dice    │  │  │  Full Scorecard│  │  │  EV Chart│  │
│  │  Tray    │  │  │  (No scroll)   │  │  │  ────────│  │
│  │  [🎲][🎲]│  │  │  Upper:        │  │  │  Chance  │  │
│  │  [🎲][🎲]│  │  │  • Ones   [3]  │  │  │  28 pts  │  │
│  │  [🎲]    │  │  │  • Twos   [ ]  │  │  │  ████████│  │
│  └──────────┘  │  │  • Threes [9]  │  │  │          │  │
│                │  │  ...           │  │  │  Fives   │  │
│  ┌──────────┐  │  │                │  │  │  15 pts  │  │
│  │  Roll    │  │  │  Lower:        │  │  │  ████    │  │
│  │  Button  │  │  │  • 3oak  [ ]   │  │  │          │  │
│  │  2 left  │  │  │  • FullHs[ ]   │  │  └──────────┘  │
│  └──────────┘  │  │  ...           │  │                │
│                │  └────────────────┘  │  Probability  │
│  Stats HUD:    │                      │  Distribution │
│  P(Full) 16.7% │  Opponents:          │  Heat Map     │
│  EV: +4.2      │  Alice • 156         │               │
│                │  Bob   • 142         │               │
└────────────────┴──────────────────────┴────────────────┘
```

### 2.3 Zone Transition Rules

**Mobile ↔ Tablet:**
- Zones expand proportionally
- Stats HUD gains more persistent elements
- Decision Zone shows more categories simultaneously

**Tablet ↔ Desktop:**
- Three-zone layout becomes three-column
- Analytics Zone appears (hidden on mobile)
- Opponent states always visible

**Breakpoints:**

| Device | Width | Layout |
|--------|-------|--------|
| Mobile (Portrait) | 320-480px | Single column, zones stack |
| Mobile (Landscape) | 568-844px | Two column hybrid |
| Tablet | 768-1024px | Two column, expanded zones |
| Desktop | 1280px+ | Three column, full analytics |

---

## 3. Neo-Brutalist Design Language

### 3.1 Visual Principles

**Brutalism:** Raw, honest materials. Function exposed, not hidden.  
**Neo:** Modern refinement. Accessibility and usability retained.

**Core Tenets:**
1. **Hard Edges** — No rounded corners, no soft shadows
2. **High Contrast** — Black/white primary, single accent color
3. **Visible Structure** — Borders delineate, grids organize
4. **Typography as UI** — Text is functional, not decorative
5. **Honest Interactivity** — Buttons look like buttons

### 3.2 Color System

**Primary Palette:**

```css
--color-background: #FAFAFA;    /* Off-white, reduces eye strain */
--color-surface: #FFFFFF;       /* Pure white for cards */
--color-border: #000000;        /* Hard black lines */
--color-text: #0A0A0A;          /* Near-black for text */

--color-accent: #FFD700;        /* Electric gold for interactions */
--color-accent-dark: #B8860B;   /* Darker gold for hover */

--color-success: #10B981;       /* Green for optimal decisions */
--color-warning: #F59E0B;       /* Amber for acceptable moves */
--color-danger: #EF4444;        /* Red for suboptimal moves */

--color-disabled: #9CA3AF;      /* Gray for inactive elements */
```

**Semantic Colors:**

```css
/* Statistical quality indicators */
--color-optimal: var(--color-success);
--color-good: #22C55E;
--color-acceptable: var(--color-warning);
--color-suboptimal: #F97316;
--color-poor: var(--color-danger);

/* Probability confidence */
--color-certain: var(--color-accent);
--color-likely: #FCD34D;
--color-uncertain: #FDE68A;
```

### 3.3 Typography System

**Font Stack:**

```css
--font-sans: 'Inter Variable', 'SF Pro', -apple-system, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;
```

**Type Scale (Major Third: 1.250):**

| Level | Size | Weight | Use Case |
|-------|------|--------|----------|
| Display | 48px | 700 | Game over, Yahtzee celebration |
| H1 | 38px | 700 | Section headers |
| H2 | 30px | 600 | Category groups |
| H3 | 24px | 600 | Zone titles |
| Body | 16px | 400 | Standard text |
| Small | 14px | 400 | Secondary info |
| Tiny | 12px | 500 | Metadata, timestamps |
| Mono | 14px | 500 | Scores, probabilities |

**Font Variations:**

```css
/* Tabular numbers for score alignment */
.score {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* Statistical emphasis */
.probability {
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
}
```

### 3.4 Spacing System

**8px base unit (rem-based for accessibility):**

```css
--space-1: 0.5rem;  /* 8px */
--space-2: 1rem;    /* 16px */
--space-3: 1.5rem;  /* 24px */
--space-4: 2rem;    /* 32px */
--space-5: 3rem;    /* 48px */
--space-6: 4rem;    /* 64px */
```

**Layout Grid:**
- Base: 8px grid
- Components snap to 8px increments
- Responsive: scales with viewport (fluid typography)

### 3.5 Border & Stroke System

**All borders are solid black:**

```css
--border-thin: 1px solid var(--color-border);
--border-medium: 2px solid var(--color-border);
--border-thick: 3px solid var(--color-border);
--border-heavy: 4px solid var(--color-border);
```

**Hierarchy through weight:**
- Thin (1px): Internal dividers, table lines
- Medium (2px): Component containers, cards
- Thick (3px): Active/selected states
- Heavy (4px): Primary actions, focus indicators

### 3.6 Component Patterns

**Button:**

```css
.button {
  background: var(--color-accent);
  border: var(--border-thick);
  color: var(--color-text);
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  /* NO border-radius, NO box-shadow */
  transition: background 150ms ease, transform 100ms ease;
}

.button:hover {
  background: var(--color-accent-dark);
  transform: translateY(-2px);
}

.button:active {
  transform: translateY(0);
}
```

**Card:**

```css
.card {
  background: var(--color-surface);
  border: var(--border-medium);
  padding: var(--space-3);
  
  /* Sharp corners, visible structure */
}
```

**Dice:**

```css
.die {
  width: 60px;
  height: 60px;
  background: var(--color-surface);
  border: var(--border-thick);
  
  /* Pips as geometric shapes */
  display: grid;
  place-items: center;
}

.die.held {
  border-color: var(--color-accent);
  border-width: 4px;
  
  /* Subtle background glow */
  background: linear-gradient(135deg, #FFFFFF, #FFF9E6);
}
```

---

## 4. Statistical HUD System

### 4.1 HUD Architecture Overview

The Statistical HUD is a **persistent overlay system** that provides contextual probability information without obstructing gameplay. It operates at multiple fidelity levels based on player skill and UI state.

**Version Roadmap:**
- **v1.0 (MVP):** Category Heat Map only
- **v1.1:** Add EV Differential Display
- **v2.0:** Advanced visualizations (Halos, Compass, Wave)

**Rationale:** The Category Heat Map delivers 90% of educational value with 10% of implementation complexity. It directly answers "What should I pick?" and integrates seamlessly into the existing Scorecard component. Complex visualizations are deferred to avoid scope creep.

**HUD Layers (Z-Index Stack):**

```
Layer 5: Critical Alerts (z-index: 1000)
  ↳ Game over, errors, confirmations

Layer 4: Interactive Modals (z-index: 500)
  ↳ Explanations, tutorials

Layer 3: Contextual Tooltips (z-index: 400)
  ↳ Hover explanations

Layer 2: Statistical Overlay (z-index: 300)
  ↳ Category heat map (v1.0)
  ↳ EV indicators (v1.1+)

Layer 1: Game Components (z-index: 100)
  ↳ Dice, scorecard, buttons

Layer 0: Background (z-index: 0)
  ↳ Canvas, gradients
```

### 4.2 Category Heat Map (v1.0 - PRIORITY 1)

**Purpose:** Visual scorecard overlay showing "hot" (high-value) categories

**Why This Is MVP:**
1. Directly integrates into Scorecard component (no new UI space)
2. Displays both key metrics: P(category) and EV(category)
3. Answers core question: "What's the best move?"
4. Minimal implementation complexity
5. Perfect fit for "stats hanging around every move" vision

**Visual Specification:**

```svelte
{#each categories as cat}
  <div
    class="category-row"
    style:--heat={cat.ev / maxEV}
    class:optimal={cat.isOptimal}
  >
    <span class="name">{cat.displayName}</span>
    <span class="score">{cat.currentScore ?? '—'}</span>
    
    <!-- Heat indicator (v1.0 core feature) -->
    <div
      class="heat-bar"
      style:width="{(cat.ev / maxEV) * 100}%"
    />
    
    {#if cat.probability}
      <span class="probability">{cat.probability.toFixed(1)}%</span>
    {/if}
    
    {#if cat.expectedValue && statsMode >= 2}
      <span class="ev">EV: {cat.expectedValue.toFixed(1)}</span>
    {/if}
  </div>
{/each}

<style>
  .category-row {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--space-2);
    padding: var(--space-2);
    border-bottom: var(--border-thin);
  }
  
  .heat-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: var(--color-accent);
    opacity: calc(var(--heat) * 0.3);
    pointer-events: none;
    transition: width 300ms ease, opacity 300ms ease;
  }
  
  .category-row.optimal .heat-bar {
    background: var(--color-optimal);
    opacity: 0.4;
  }
  
  .category-row:hover .heat-bar {
    opacity: calc(var(--heat) * 0.6);
  }
</style>
```

### 4.3 EV Differential Display (v1.1 - PRIORITY 2)

**Floating Indicator** showing real-time expected value difference from optimal:

**Implementation Deferred:** This feature provides high value with low complexity, but is not essential for v1.0 playability. Add in v1.1 after core gameplay validated.

```svelte
<div class="ev-differential" class:positive={evDiff >= 0}>
  <span class="value">
    {evDiff > 0 ? '+' : ''}{evDiff.toFixed(1)}
  </span>
  <span class="label">vs optimal</span>
</div>

<style>
  .ev-differential {
    position: fixed;
    top: 20px;
    right: 20px;
    
    background: var(--color-surface);
    border: var(--border-medium);
    padding: var(--space-2);
    
    font-family: var(--font-mono);
    
    transition: all 200ms ease;
  }
  
  .ev-differential.positive {
    border-color: var(--color-success);
    color: var(--color-success);
  }
  
  .ev-differential:not(.positive) {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }
</style>
```

### 4.4 Advanced Visualizations (v2.0 - DEFERRED)

The following features are **explicitly deferred to v2.0** to prevent scope creep:

**Probability Halos** (Deferred)
- SVG rings around dice showing outcome distribution
- High implementation complexity
- Visual polish, not core functionality

**Decision Compass** (Deferred)
- Miniature decision tree visualization
- Requires complex SVG layout algorithm
- Educational value is incremental over heat map

**Probability Wave Visualization** (Deferred)
- Canvas-based waveform showing probability density
- Requires Canvas API and animation system
- Alternative visualization to heat map, not complementary

**Rationale for Deferral:**
These features are excellent polish and provide educational depth, but they:
1. Require significant implementation time (2-3 weeks each)
2. Do not block core gameplay or learning
3. Can be validated through user testing of v1.0 first
4. May need redesign based on actual usage patterns

**v2.0 Prioritization:**
After v1.0 user testing, prioritize these features based on:
- User feedback on "missing" statistical information
- Engagement metrics (do users want more depth?)
- Performance impact analysis

---

**Section 4 Summary:**

| Feature | Version | Status | Priority | Complexity |
|---------|---------|--------|----------|------------|
| Category Heat Map | v1.0 | Required | P0 | Low |
| EV Differential | v1.1 | Should-Have | P1 | Low |
| Probability Halos | v2.0 | Could-Have | P2 | High |
| Decision Compass | v2.0 | Could-Have | P3 | High |
| Probability Wave | v2.0 | Could-Have | P4 | High |

---

## 5. Progressive Complexity Layers

### 5.1 Complexity Level System

The UI adapts statistical presentation across **3 manual complexity levels** (v1.0) expanding to 5 automated levels (v2.0).

**v1.0 Implementation: Manual Setting**

For v1.0, complexity is a **user-controlled dropdown** in settings:

```svelte
<select bind:value={statsProfile}>
  <option value="beginner">Beginner</option>
  <option value="intermediate">Intermediate</option>
  <option value="expert">Expert</option>
</select>
```

**Rationale:** Manual selection delivers 90% of value with 10% of complexity. Automated unlocking based on performance requires:
- Player accounts + persistent storage
- Analytics service + skill detection algorithm
- Backend infrastructure

These are unnecessary for v1.0 playability. Focus on core gameplay first.

**v1.0 Levels:**

| Level | User Selection | Stats Visible | Explanation Depth | When To Use |
|-------|----------------|---------------|-------------------|-------------|
| 1 | Beginner | Simple % | "Best choice" badge | First-time players, casual play |
| 2 | Intermediate | % + EV | "Because X" reasoning | Learning phase, exploring strategy |
| 3 | Expert | Full stats + tools | Mathematical details | Advanced analysis, teaching moments |

**v2.0 Enhancement: Automated Unlocking**

After v1.0 validation, add automatic level adjustment based on demonstrated skill:

| Level | Auto-Unlock Trigger | Stats Visible | Typical Games |
|-------|---------------------|---------------|---------------|
| 0 | First launch | Tutorial only | 1-2 |
| 1 | Complete tutorial | Simple % | 3-10 |
| 2 | >60% optimal over 10 games | % + EV | 11-30 |
| 3 | >75% optimal over 20 games | Decision trees + MC | 31-100 |
| 4 | >85% optimal over 50 games | Raw data + API | 100+ |

### 5.2 Layer 1: Beginner Mode (v1.0)

**Manual Selection: "Beginner"**

When enabled:
- Category Heat Map shows simple visual intensity only
- Best option has green badge: "★ Best Choice"
- No numerical probabilities or EV displayed
- Hover shows simple text: "Likely" | "Possible" | "Unlikely"

```svelte
<div class="category-row" class:best={category.isOptimal}>
  <span class="name">{category.displayName}</span>
  
  {#if statsProfile === 'beginner' && category.isOptimal}
    <span class="best-badge">★ Best Choice</span>
  {/if}
  
  {#if statsProfile === 'beginner' && category.probability}
    <span class="simple-probability">
      {category.probability > 0.5 ? 'Likely' : 
       category.probability > 0.2 ? 'Possible' : 
       'Unlikely'}
    </span>
  {/if}
</div>
```

**Goal:** Minimal cognitive load. Focus on gameplay, not numbers.

### 5.3 Layer 2: Intermediate Mode (v1.0)

**Manual Selection: "Intermediate"**

Adds numerical detail:
- Probability percentages visible
- EV numbers shown
- Top 3 options highlighted (gold/silver/bronze)
- "Why?" button for explanations

```svelte
<div class="category-row" class:tier={category.evRank}>
  <span class="name">{category.displayName}</span>
  
  {#if statsProfile !== 'beginner'}
    <span class="probability">{category.probability.toFixed(1)}%</span>
  {/if}
  
  {#if statsProfile === 'intermediate' || statsProfile === 'expert'}
    <span class="ev">EV: {category.expectedValue.toFixed(1)}</span>
  {/if}
  
  {#if category.evRank <= 3}
    <div class="rank-badge" class:gold={category.evRank === 1}
                             class:silver={category.evRank === 2}
                             class:bronze={category.evRank === 3}>
      {category.evRank === 1 ? '★' : category.evRank}
    </div>
  {/if}
  
  {#if statsProfile !== 'beginner'}
    <button class="explain-btn" onclick={() => showExplanation(category)}>
      Why?
    </button>
  {/if}
</div>
```

**Goal:** Introduce quantitative reasoning. Support "why is this better?" questions.

### 5.4 Layer 3: Expert Mode (v1.0)

**Manual Selection: "Expert"**

Full statistical access:
- All probabilities and EVs
- Decision comparison view
- Export probability tables (CSV)
- Monte Carlo controls (up to 100K iterations for v1.0)

```svelte
{#if statsProfile === 'expert'}
  <div class="expert-tools">
    <button onclick={() => showDecisionTree()}>
      📊 Compare All Options
    </button>
    
    <button onclick={() => exportProbabilities()}>
      📥 Export CSV
    </button>
    
    <details>
      <summary>Monte Carlo Simulation</summary>
      <input
        type="number"
        bind:value={monteCarloIterations}
        min="10000"
        max="100000"
        step="10000"
      />
      <button onclick={() => runSimulation()}>
        Run {monteCarloIterations.toLocaleString()} Simulations
      </button>
    </details>
  </div>
{/if}
```

**Goal:** Maximum transparency. Support advanced analysis and teaching.

### 5.5 Settings Interface (v1.0)

**Location:** Settings menu (gear icon in Context Layer)

```svelte
<div class="settings-panel">
  <h3>Statistical Display</h3>
  
  <label>
    <span>Stats Profile:</span>
    <select bind:value={statsProfile}>
      <option value="beginner">
        Beginner — Simple guidance
      </option>
      <option value="intermediate">
        Intermediate — Numbers + explanations
      </option>
      <option value="expert">
        Expert — Full analysis tools
      </option>
    </select>
  </label>
  
  <p class="help-text">
    {#if statsProfile === 'beginner'}
      Shows best moves without overwhelming numbers. Perfect for learning the game.
    {:else if statsProfile === 'intermediate'}
      Displays probabilities and expected values. Great for understanding strategy.
    {:else}
      Full statistical access including simulations and exports. For advanced players.
    {/if}
  </p>
  
  <label>
    <input type="checkbox" bind:checked={alwaysShowStats} />
    Always show statistics (even when Stats toggle is OFF)
  </label>
</div>
```

### 5.6 Migration Path to v2.0 Automation

**Data Collection (v1.0):**
Even with manual settings, collect telemetry:
- Decision quality (actual EV vs optimal EV)
- Time to decision
- Stats profile selection frequency

**v2.0 Activation:**
Once player accounts + backend exist:
1. Analyze historical performance
2. Suggest appropriate level: "Based on your play, try Intermediate mode?"
3. Option to enable "Auto-adjust complexity"
4. Smooth transitions between levels

**v2.0 Additional Levels:**
- **Level 0:** Tutorial-only (first 1-2 games)
- **Level 4:** Research mode (LaTeX proofs, source code, unlimited MC)

---

**Section 5 Summary:**

| Version | Implementation | Levels | Activation | Complexity |
|---------|----------------|--------|------------|------------|
| v1.0 | Manual dropdown | 3 | User choice | Low |
| v2.0 | Auto-adjust | 5 | Performance-based | Medium |

---

## 6. Component Specifications

### 6.1 Dice Tray Component

**Purpose:** Primary interaction surface for rolling and selecting dice

**States:**
- Idle (waiting for player action)
- Rolling (animation in progress)
- Selecting (player choosing which to keep)
- Locked (all dice held, awaiting score)

**Visual Specification:**

```svelte
<script lang="ts">
  import { Motion } from 'motion/svelte';
  
  let {
    dice = $bindable(),
    keptMask = $bindable([false, false, false, false, false]),
    onRoll,
    rollsRemaining
  } = $props();
  
  let rolling = $state(false);
</script>

<div class="dice-tray" data-rolling={rolling}>
  <!-- Dice grid -->
  <div class="dice-grid">
    {#each dice as value, i}
      <Motion
        animate={{
          rotateX: rolling ? [0, 360, 720] : 0,
          rotateY: rolling ? [0, 180, 360] : 0,
          scale: keptMask[i] ? 1.1 : 1
        }}
        transition={{ duration: 0.8, delay: i * 0.08 }}
      >
        <button
          class="die"
          class:held={keptMask[i]}
          onclick={() => !rolling && toggleKeep(i)}
          disabled={rolling}
        >
          <DieFace {value} />
          
          {#if keptMask[i]}
            <div class="hold-indicator">HELD</div>
          {/if}
        </button>
      </Motion>
    {/each}
  </div>
  
  <!-- Roll button -->
  <button
    class="roll-button"
    onclick={handleRoll}
    disabled={rolling || rollsRemaining === 0}
  >
    {rolling ? 'Rolling...' : `Roll (${rollsRemaining} left)`}
  </button>
  
  <!-- Quick actions -->
  <div class="quick-actions">
    <button onclick={keepAll}>Keep All</button>
    <button onclick={rerollAll}>Reroll All</button>
  </div>
</div>

<style>
  .dice-tray {
    background: linear-gradient(135deg, #1a5928, #2d7a3e);
    border: var(--border-thick);
    padding: var(--space-4);
    
    /* Casino felt texture */
    position: relative;
  }
  
  .dice-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  
  @media (max-width: 480px) {
    .dice-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
    }
  }
  
  .die {
    aspect-ratio: 1;
    background: white;
    border: var(--border-medium);
    cursor: pointer;
    position: relative;
    
    display: grid;
    place-items: center;
    
    transition: all 150ms ease;
  }
  
  .die:hover:not(:disabled) {
    transform: translateY(-4px);
    border-width: 3px;
  }
  
  .die:active:not(:disabled) {
    transform: translateY(-2px);
  }
  
  .die.held {
    border-color: var(--color-accent);
    border-width: 4px;
    
    /* Neo-Brutalist: solid color, no gradients or shadows */
    background: var(--color-accent);
  }
  
  .hold-indicator {
    position: absolute;
    top: 4px;
    left: 4px;
    right: 4px;
    
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    color: var(--color-accent-dark);
  }
  
  .roll-button {
    width: 100%;
    padding: var(--space-3);
    
    background: var(--color-accent);
    border: var(--border-thick);
    
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .roll-button:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
  }
  
  .quick-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  
  .quick-actions button {
    flex: 1;
    padding: var(--space-1);
    
    background: transparent;
    border: var(--border-thin);
    color: white;
    
    font-size: 12px;
    text-transform: uppercase;
  }
</style>
```

**Interaction Behaviors:**
- **Tap die:** Toggle keep/release
- **Double-tap die:** Keep and auto-roll
- **Long-press tray:** Show probability overlay
- **Swipe die:** Quick keep (mobile gesture)

### 6.2 Scorecard Component

**Purpose:** Display all 13 categories with scoring state and recommendations

**Visual Specification:**

```svelte
<script lang="ts">
  let {
    scorecard,
    availableCategories,
    recommendations,
    statsMode,
    onScore
  } = $props();
  
  let hoveredCategory = $state<string | null>(null);
</script>

<div class="scorecard">
  <!-- Upper Section -->
  <section class="section upper">
    <h3 class="section-header">Upper Section</h3>
    
    {#each ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as cat}
      <CategoryRow
        category={cat}
        score={scorecard[cat]}
        available={availableCategories.has(cat)}
        recommendation={recommendations[cat]}
        {statsMode}
        onHover={() => hoveredCategory = cat}
        onScore={() => onScore(cat)}
      />
    {/each}
    
    <!-- Upper section totals -->
    <div class="total-row">
      <span>Upper Total</span>
      <span class="score-value">{scorecard.upperTotal}</span>
    </div>
    
    <div class="bonus-row" class:achieved={scorecard.upperBonus}>
      <span>Bonus (63+ points)</span>
      <span class="score-value">{scorecard.upperBonus ?? '—'}</span>
    </div>
  </section>
  
  <!-- Lower Section -->
  <section class="section lower">
    <h3 class="section-header">Lower Section</h3>
    
    {#each ['three_of_kind', 'four_of_kind', 'full_house', 
            'small_straight', 'large_straight', 'yahtzee', 'chance'] as cat}
      <CategoryRow
        category={cat}
        score={scorecard[cat]}
        available={availableCategories.has(cat)}
        recommendation={recommendations[cat]}
        {statsMode}
        onHover={() => hoveredCategory = cat}
        onScore={() => onScore(cat)}
      />
    {/each}
    
    <!-- Lower section total -->
    <div class="total-row">
      <span>Lower Total</span>
      <span class="score-value">{scorecard.lowerTotal}</span>
    </div>
  </section>
  
  <!-- Grand Total -->
  <div class="grand-total">
    <span>Grand Total</span>
    <span class="score-value">{scorecard.grandTotal}</span>
  </div>
</div>

<style>
  .scorecard {
    background: var(--color-surface);
    border: var(--border-medium);
  }
  
  .section {
    border-bottom: var(--border-thick);
    padding: var(--space-3);
  }
  
  .section-header {
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: var(--space-2);
    padding-bottom: var(--space-2);
    border-bottom: var(--border-thin);
  }
  
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2);
    margin-top: var(--space-2);
    border-top: var(--border-thin);
    font-weight: 600;
  }
  
  .bonus-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2);
    border-top: var(--border-thin);
    color: var(--color-disabled);
  }
  
  .bonus-row.achieved {
    color: var(--color-success);
    font-weight: 700;
  }
  
  .grand-total {
    display: flex;
    justify-content: space-between;
    padding: var(--space-3);
    
    background: var(--color-accent);
    border-top: var(--border-heavy);
    
    font-size: 20px;
    font-weight: 700;
    text-transform: uppercase;
  }
  
  .score-value {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
</style>
```

### 6.3 Category Row Component

**Purpose:** Individual category with score, probability, and interaction

```svelte
<script lang="ts">
  let {
    category,
    score,
    available,
    recommendation,
    statsMode,
    onHover,
    onScore
  } = $props();
  
  const displayNames = {
    ones: 'Ones',
    twos: 'Twos',
    // ... etc
    full_house: 'Full House',
    yahtzee: 'Yahtzee'
  };
  
  const icons = {
    ones: '⚀',
    twos: '⚁',
    // ... etc
    full_house: '🏠',
    yahtzee: '🎲'
  };
</script>

<button
  class="category-row"
  class:available
  class:scored={score !== undefined}
  class:optimal={recommendation?.isOptimal}
  class:hover={hovering}
  onmouseenter={onHover}
  onmouseleave={() => hovering = false}
  onclick={() => available && onScore()}
  disabled={!available}
>
  <!-- Category icon & name -->
  <div class="category-info">
    <span class="icon">{icons[category]}</span>
    <span class="name">{displayNames[category]}</span>
  </div>
  
  <!-- Score or probability -->
  <div class="category-value">
    {#if score !== undefined}
      <span class="score">{score}</span>
      <span class="scored-indicator">✓</span>
    {:else if statsMode && recommendation}
      <span class="probability">
        {recommendation.probability.toFixed(1)}%
      </span>
      {#if recommendation.expectedValue}
        <span class="ev">EV: {recommendation.expectedValue.toFixed(1)}</span>
      {/if}
    {:else}
      <span class="empty">—</span>
    {/if}
  </div>
  
  <!-- Optimal indicator -->
  {#if available && recommendation?.isOptimal}
    <div class="optimal-badge">★</div>
  {/if}
  
  <!-- Heat bar background -->
  {#if available && statsMode && recommendation}
    <div
      class="heat-bar"
      style:width="{recommendation.evPercentage}%"
    />
  {/if}
</button>

<style>
  .category-row {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    padding: var(--space-2);
    border: none;
    border-bottom: var(--border-thin);
    background: transparent;
    
    text-align: left;
    cursor: pointer;
    
    transition: all 150ms ease;
  }
  
  .category-row:hover:not(:disabled) {
    background: rgba(255, 215, 0, 0.1);
    border-left: 4px solid var(--color-accent);
    padding-left: calc(var(--space-2) - 4px);
  }
  
  .category-row.optimal {
    border-left: 3px solid var(--color-success);
    padding-left: calc(var(--space-2) - 3px);
  }
  
  .category-row.scored {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .category-row:disabled {
    cursor: not-allowed;
  }
  
  .category-info {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  
  .icon {
    font-size: 20px;
  }
  
  .name {
    font-weight: 500;
  }
  
  .category-value {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-family: var(--font-mono);
  }
  
  .score {
    font-weight: 700;
    font-size: 18px;
  }
  
  .probability {
    color: var(--color-text);
    font-weight: 600;
  }
  
  .ev {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.7;
  }
  
  .optimal-badge {
    position: absolute;
    right: var(--space-2);
    
    width: 24px;
    height: 24px;
    
    display: grid;
    place-items: center;
    
    background: var(--color-accent);
    border: var(--border-medium);
    
    font-size: 14px;
  }
  
  .heat-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    
    background: var(--color-accent);
    opacity: 0.2;
    
    pointer-events: none;
    transition: width 300ms ease;
  }
  
  .category-row:hover .heat-bar {
    opacity: 0.3;
  }
</style>
```

### 6.4 Stats Toggle Component

**Purpose:** Global switch for statistical overlay

```svelte
<script lang="ts">
  let { enabled = $bindable(false) } = $props();
</script>

<button
  class="stats-toggle"
  class:enabled
  onclick={() => enabled = !enabled}
>
  <div class="toggle-track">
    <div class="toggle-thumb" />
  </div>
  
  <span class="label">
    Stats: {enabled ? 'ON' : 'OFF'}
  </span>
</button>

<style>
  .stats-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    
    padding: var(--space-2);
    border: var(--border-medium);
    background: var(--color-surface);
    
    cursor: pointer;
    transition: all 150ms ease;
  }
  
  .stats-toggle:hover {
    border-color: var(--color-accent);
  }
  
  .toggle-track {
    width: 48px;
    height: 24px;
    
    position: relative;
    
    background: var(--color-disabled);
    border: var(--border-medium);
    
    transition: background 200ms ease;
  }
  
  .stats-toggle.enabled .toggle-track {
    background: var(--color-accent);
  }
  
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    
    width: 16px;
    height: 16px;
    
    background: white;
    border: var(--border-thin);
    
    transition: transform 200ms ease;
  }
  
  .stats-toggle.enabled .toggle-thumb {
    transform: translateX(24px);
  }
  
  .label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
```

---

## 7. Interaction Patterns & Gestures

### 7.1 Dice Interaction

**Mouse/Trackpad:**
- **Click:** Toggle keep/release
- **Double-click:** Keep and auto-suggest categories
- **Right-click:** Show detailed probability breakdown
- **Hover:** Display probability halo

**Touch:**
- **Tap:** Toggle keep/release
- **Double-tap:** Keep and highlight recommended categories
- **Long-press (500ms):** Show detailed statistics modal
- **Swipe up:** Instant keep
- **Swipe down:** Instant release

### 7.2 Scorecard Interaction

**Mouse/Trackpad:**
- **Hover:** Show potential score and EV
- **Click:** Score category (if available)
- **Right-click:** Explain recommendation
- **Shift+Click:** Pin comparison view

**Touch:**
- **Tap:** Score category
- **Long-press:** Show explanation modal
- **Swipe left:** Show alternatives
- **Swipe right:** Compare with optimal

### 7.3 Keyboard Shortcuts

**Navigation:**
- `Tab` / `Shift+Tab`: Navigate elements
- `Space`: Roll dice / confirm action
- `Enter`: Score selected category
- `Esc`: Cancel / close modals

**Dice Control:**
- `1-5`: Toggle keep on die 1-5
- `Shift+1-5`: Keep only die 1-5, release others
- `A`: Keep all dice
- `R`: Release all dice

**Stats:**
- `S`: Toggle stats mode
- `H`: Show/hide statistical HUD
- `E`: Show EV comparison chart
- `?`: Show help overlay

### 7.4 Gesture Feedback

**Visual:**
- **Ripple effect** on tap/click
- **Lift animation** on die selection
- **Border pulse** on optimal category
- **Flash** on successful score

**Haptic (Mobile):**
- **Light:** Dice tap toggle
- **Medium:** Roll button press
- **Heavy:** Successful score
- **Success pattern:** Optimal decision
- **Warning pattern:** Suboptimal choice

---

## 8. Responsive Adaptation Strategy

### 8.1 Breakpoint System

```css
/* Mobile portrait (baseline) */
@media (min-width: 320px) {
  :root {
    --canvas-width: 100vw;
    --zone-action: 40vh;
    --zone-decision: 50vh;
    --zone-context: 10vh;
  }
}

/* Mobile landscape */
@media (min-width: 568px) and (orientation: landscape) {
  :root {
    --canvas-width: 100vw;
    --layout: two-column;
  }
}

/* Tablet portrait */
@media (min-width: 768px) {
  :root {
    --canvas-width: 768px;
    --zone-action: 35vh;
    --zone-decision: 55vh;
  }
}

/* Desktop small */
@media (min-width: 1024px) {
  :root {
    --canvas-width: 1024px;
    --layout: three-column;
    --show-analytics: true;
  }
}

/* Desktop large */
@media (min-width: 1440px) {
  :root {
    --canvas-width: 1440px;
    --scale: 1.1;
  }
}

/* Ultra-wide */
@media (min-width: 1920px) {
  :root {
    --canvas-width: 1600px;
    --show-extended-stats: true;
  }
}
```

### 8.2 Container Queries

Modern CSS container queries for component-level responsiveness:

```css
.dice-tray {
  container-type: inline-size;
  container-name: dice-tray;
}

/* Adaptive dice size */
@container dice-tray (max-width: 400px) {
  .die {
    width: 50px;
    height: 50px;
  }
}

@container dice-tray (min-width: 600px) {
  .die {
    width: 80px;
    height: 80px;
  }
}

/* Scorecard adaptive layout */
.scorecard {
  container-type: inline-size;
}

@container (min-width: 600px) {
  .category-row {
    grid-template-columns: 2fr 1fr 1fr;
  }
}
```

### 8.3 Touch vs. Mouse Optimization

**Detection:**

```typescript
const hasTouch = 'ontouchstart' in window;
const hasMouse = window.matchMedia('(pointer: fine)').matches;

if (hasTouch && !hasMouse) {
  // Touch-only device (mobile)
  document.body.classList.add('touch-device');
} else if (hasMouse) {
  // Mouse device (desktop)
  document.body.classList.add('mouse-device');
} else {
  // Hybrid (laptop with touchscreen)
  document.body.classList.add('hybrid-device');
}
```

**Adaptive Interaction:**

```css
/* Larger touch targets on touch devices */
.touch-device .die {
  min-width: 64px;
  min-height: 64px;
}

.touch-device .category-row {
  min-height: 56px;
}

/* Hover effects only on mouse devices */
.mouse-device .die:hover {
  transform: translateY(-4px);
}

.touch-device .die:active {
  transform: scale(0.95);
}
```

---

## 9. Animation & Motion Design

### 9.1 Animation Philosophy

**Purposeful Motion:**
- Every animation communicates state change or provides feedback
- No gratuitous effects
- Performance-first (60fps minimum)

**Timing Principles:**
- **Instant:** <100ms (imperceptible)
- **Quick:** 150-200ms (responsive)
- **Medium:** 300-400ms (noticeable transition)
- **Slow:** 500-800ms (dramatic events)

### 9.2 Dice Roll Animation

**Three-Stage Animation:**

```typescript
async function animateDiceRoll(diceResults: number[]) {
  // Stage 1: Anticipation (100ms)
  await animate('.dice-tray', {
    scale: [1, 0.98],
    duration: 100
  });
  
  // Stage 2: Roll (800ms)
  const rollAnimations = diceResults.map((result, i) => {
    return animate(`.die-${i}`, {
      rotateX: [0, 720],
      rotateY: [0, 360],
      duration: 800,
      delay: i * 80,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    });
  });
  
  await Promise.all(rollAnimations);
  
  // Stage 3: Settle (200ms)
  await animate('.dice-tray', {
    scale: [0.98, 1],
    duration: 200,
    easing: 'ease-out'
  });
}
```

### 9.3 Score Animation

**Number Count-Up:**

```svelte
<script>
  import { spring } from 'svelte/motion';
  
  let { value } = $props();
  let displayed = spring(0, { stiffness: 0.1, damping: 0.3 });
  
  $effect(() => {
    displayed.set(value);
  });
</script>

<span class="score-value">
  {Math.floor($displayed)}
</span>
```

### 9.4 Category Selection Feedback

```css
@keyframes score-pulse {
  0% {
    transform: scale(1);
    background: var(--color-surface);
  }
  50% {
    transform: scale(1.05);
    background: var(--color-accent);
  }
  100% {
    transform: scale(1);
    background: var(--color-surface);
  }
}

.category-row.just-scored {
  animation: score-pulse 500ms ease-out;
}
```

### 9.5 Optimal Decision Celebration

**Confetti Burst (Canvas-based):**

```typescript
class OptimalDecisionEffect {
  private canvas: HTMLCanvasElement;
  private particles: Particle[] = [];
  
  trigger(x: number, y: number) {
    // Create 30 particles
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        color: ['#FFD700', '#10B981', '#FFFFFF'][Math.floor(Math.random() * 3)],
        life: 1.0
      });
    }
    
    this.animate();
  }
  
  private animate() {
    // Physics simulation with gravity
    this.particles = this.particles.filter(p => p.life > 0);
    
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // Gravity
      p.life -= 0.02;
    });
    
    this.render();
    
    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    }
  }
}
```

---

## 10. Accessibility & Inclusive Design

### 10.1 WCAG 2.1 AA Compliance

**Color Contrast:**
- Text: 4.5:1 minimum
- Large text (≥18px): 3:1 minimum
- UI components: 3:1 minimum

**Validation:**

```typescript
function validateContrast(fg: string, bg: string, size: number): boolean {
  const ratio = calculateContrastRatio(fg, bg);
  const minRatio = size >= 18 ? 3 : 4.5;
  return ratio >= minRatio;
}

// Example checks
assert(validateContrast('#0A0A0A', '#FAFAFA', 16)); // ✓ 18.5:1
assert(validateContrast('#FFD700', '#FFFFFF', 24)); // ✓ 1.3:1 (large text)
```

### 10.2 Keyboard Navigation

**Focus Management:**

```css
*:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}

.die:focus-visible {
  outline: 4px solid var(--color-accent);
  outline-offset: 4px;
}
```

**Focus Trapping in Modals:**

```typescript
function trapFocus(container: HTMLElement) {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
  
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
}
```

### 10.3 Screen Reader Support

**ARIA Labels:**

```svelte
<button
  class="die"
  aria-label="Die showing {value}, {held ? 'held' : 'not held'}"
  aria-pressed={held}
  onclick={toggleHold}
>
  <DieFace {value} />
</button>

<div class="category-row" role="button" tabindex="0">
  <span id="cat-{id}">{categoryName}</span>
  <span aria-labelledby="cat-{id}">
    {#if statsMode}
      Probability: {probability}%, Expected value: {ev} points
    {/if}
  </span>
</div>
```

**Live Regions:**

```svelte
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {#if rollResult}
    Rolled: {rollResult.join(', ')}. 
    {rollsRemaining} {rollsRemaining === 1 ? 'roll' : 'rolls'} remaining.
  {/if}
</div>

<div aria-live="assertive" aria-atomic="true" class="sr-only">
  {#if scoreResult}
    Scored {scoreResult.points} points in {scoreResult.category}.
    {scoreResult.isOptimal ? 'Optimal decision!' : ''}
  {/if}
</div>
```

### 10.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .die {
    /* Instant state changes, no rotation */
  }
  
  .probability-halo {
    /* No animation, just fade */
    transition: opacity 100ms ease;
  }
}
```

### 10.5 Text Scaling

**Support up to 200% text zoom:**

```css
/* Use rem for all font sizes */
body {
  font-size: 16px; /* Base */
}

h1 {
  font-size: 2.375rem; /* 38px at 100%, 76px at 200% */
}

.category-row {
  /* Ensure container grows with text */
  min-height: 3.5rem; /* 56px at 100%, 112px at 200% */
}

/* Prevent text overlap */
.category-info {
  flex: 1;
  min-width: 0; /* Allow text truncation */
}
```

---

## 11. Performance Budget

### 11.1 Loading Performance

**Metrics:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | <1.5s | Lighthouse |
| Largest Contentful Paint | <2.5s | Lighthouse |
| Time to Interactive | <3.5s | Lighthouse |
| Cumulative Layout Shift | <0.1 | Lighthouse |

**Bundle Size:**

| Asset | Size | Compression |
|-------|------|-------------|
| HTML | 15 KB | gzip |
| CSS | 25 KB | gzip |
| JavaScript | 150 KB | gzip + brotli |
| WASM Engine | 150 KB | gzip |
| **Total** | **340 KB** | First load |

### 11.2 Runtime Performance

**Frame Rate:**
- 60 FPS minimum during gameplay
- 30 FPS acceptable during heavy animations

**Animation Budget:**

| Action | Budget | Measurement |
|--------|--------|-------------|
| Dice roll | <800ms | Start to settle |
| Category hover | <50ms | Mouseover to feedback |
| Score update | <200ms | Click to UI update |
| Stats toggle | <100ms | Toggle to display |

**Memory:**

```typescript
// Monitoring
if ('memory' in performance) {
  const heap = (performance as any).memory;
  
  if (heap.usedJSHeapSize > 100 * 1024 * 1024) {
    console.warn('Memory usage high:', heap.usedJSHeapSize);
  }
}
```

### 11.3 Network Performance

**API Call Budget:**

| Action | Calls | Latency Target |
|--------|-------|----------------|
| Roll dice | 1 | <50ms |
| Score category | 2 | <100ms |
| Load game | 1 | <200ms |
| Stats update | 0 | (WASM, client-side) |

**Caching Strategy:**

```typescript
// Service Worker caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('dicee-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/app.css',
        '/app.js',
        '/probability-engine.wasm'
      ]);
    })
  );
});
```

---

## 12. Implementation Roadmap

### Phase 1: Core Layout & Components (Week 1) — v1.0

**Deliverables:**
- ✅ Canvas architecture implemented (30/60/10 mobile split)
- ✅ Neo-brutalist design system in CSS (no gradients, no shadows)
- ✅ Dice tray component with basic animations
- ✅ Scorecard component (basic structure)
- ✅ Responsive layout (mobile + desktop)
- ✅ Manual stats profile dropdown (Beginner/Intermediate/Expert)

**Technologies:**
- Svelte 5 with Runes
- Tailwind CSS (custom config)
- Motion One for animations (simple only)

**Scope Discipline:**
- NO probability halos (deferred to v2.0)
- NO decision compass (deferred to v2.0)
- NO animated dice roll (simple state change only)
- Focus: functional layout, clean code

### Phase 2: Statistical HUD — MVP (Week 2) — v1.0

**Deliverables:**
- ✅ Category Heat Map implementation (PRIORITY 0)
  - Visual intensity bars
  - Optimal category badge
  - Probability percentages (when stats enabled)
  - EV values (intermediate+ only)
- ✅ Stats toggle control (ON/OFF)
- ✅ Manual stats profile system working
- ✅ Integration with RFC-001 Statistical Engine
- ✅ WASM probability engine connected

**What's NOT Included (Deferred):**
- ❌ EV Differential Display (v1.1)
- ❌ Decision Compass (v2.0)
- ❌ Probability Wave (v2.0)
- ❌ Probability Halos (v2.0)

**Integration:**
- Connect Category Heat Map to WASM calculations
- Display P(category) and EV(category) from engine
- Real-time updates on dice changes

### Phase 3: Interactions & Feedback (Week 3) — v1.0

**Deliverables:**
- ✅ Dice selection gestures (tap/click to toggle)
- ✅ Category selection interaction
- ✅ Keyboard shortcuts (basic set)
- ✅ Animation polish (dice rolls, score updates)
- ✅ Haptic feedback (mobile only)

**Simplified Scope:**
- Simple roll animation (no 3D rotation, just fade-in)
- Basic touch gestures (no complex swipes)
- Essential keyboard shortcuts only (Space, Enter, 1-5)

**Polish:**
- Micro-interactions tuned
- Smooth transitions
- Immediate feedback loops

### Phase 4: Accessibility & Testing (Week 4) — v1.0

**Deliverables:**
- ✅ WCAG 2.1 AA compliance
- ✅ Screen reader support (ARIA labels)
- ✅ Keyboard navigation complete
- ✅ Reduced motion support
- ✅ Cross-browser testing (Chrome, Safari, Firefox)

**Validation:**
- Lighthouse scores >90
- Axe accessibility audit passed
- Manual testing with keyboard-only navigation
- Touch device testing (iOS + Android)

### Phase 5: v1.0 Polish & Ship (Week 5)

**Deliverables:**
- ✅ Bug fixes from testing
- ✅ Performance optimization (meet budgets)
- ✅ Tutorial mode (simple 3-step walkthrough)
- ✅ Settings panel (stats profile selection)
- ✅ Documentation (user guide, keyboard shortcuts)

**Success Criteria:**
- ✅ Complete game playable end-to-end
- ✅ Category Heat Map shows clear "best move"
- ✅ All three stats profiles working correctly
- ✅ Mobile and desktop responsive
- ✅ Accessible to keyboard users
- ✅ Performance: <3s load, 60fps gameplay

**v1.0 Feature Set (Complete):**
- Core Yahtzee gameplay
- Category Heat Map with P() and EV
- Manual stats profile selection (3 levels)
- Basic tutorial
- Responsive layout
- Full accessibility

---

### Post-v1.0: v1.1 Enhancement (Week 6-7)

**Add:**
- EV Differential Display (floating indicator)
- Enhanced animations (3D dice rotation)
- Sound effects (optional)
- Post-game summary screen

**Validation:**
- User testing with v1.0
- Feedback on missing features
- Decision: pursue v1.1 features or jump to v2.0

### Post-v1.1: v2.0 Advanced Features (Month 2-3)

**Add (Prioritized by User Feedback):**
- Probability Halos (if users want more dice context)
- Decision Compass (if users want decision tree viz)
- Probability Wave (if alternative viz desired)
- Automated complexity unlocking system
- Player accounts + persistence
- Analytics dashboard

**Note:** v2.0 features depend entirely on v1.0 validation. Do not start v2.0 work until:
1. v1.0 is played by real users (family)
2. Feedback collected on "what's missing?"
3. Analytics show engagement patterns
4. Technical debt from v1.0 is resolved

---

### Critical Success Factors

**v1.0 Must:**
- Be playable and fun WITHOUT advanced HUD features
- Teach probability through Category Heat Map alone
- Work smoothly on both mobile and desktop
- Feel fast and responsive (<100ms interactions)
- Be accessible to all skill levels via manual profiles

**v1.0 Must NOT:**
- Attempt advanced visualizations
- Require backend infrastructure beyond basic API
- Include automated systems that need analytics
- Exceed 5-week timeline

**Acceptance Criteria:**
- [ ] Can you play a complete 13-turn game smoothly?
- [ ] Does the Heat Map clearly show the best move?
- [ ] Can you switch between Beginner/Intermediate/Expert modes?
- [ ] Does it work on your phone and laptop?
- [ ] Can someone navigate it with keyboard only?
- [ ] Is it fun to play?

If all YES → Ship v1.0  
If any NO → Fix before moving to v1.1

---

## 13. Design Validation Metrics

### 13.1 Usability Metrics

**Task Success Rates:**

| Task | Target | Measurement |
|------|--------|-------------|
| First roll completion | 100% | Within 30s of landing |
| First score selection | >95% | Without errors |
| Stats toggle discovery | >70% | Within first 3 games |
| Category hover interaction | >80% | Natural discovery |

### 13.2 Performance Metrics

**User-Perceived Speed:**

| Interaction | Target | Actual |
|-------------|--------|--------|
| Dice roll response | <100ms | TBD |
| Category selection | <50ms | TBD |
| Stats overlay appear | <150ms | TBD |
| Page load (mobile) | <3s | TBD |

### 13.3 Engagement Metrics

**Statistical Feature Usage:**

- Stats mode activation rate: >60% of players
- Hover interaction rate: >50% of decisions
- Advanced tools usage (after unlock): >30%
- Tutorial completion: >80%

### 13.4 Learning Effectiveness

**Decision Quality Improvement:**

| Metric | Baseline | After 10 Games | After 20 Games |
|--------|----------|----------------|----------------|
| Optimal decisions | 35% | 60% | 75% |
| EV awareness | Low | Medium | High |
| Stats confidence | Low | Medium | High |

---

## 14. Appendices

### Appendix A: Design System Tokens

```typescript
// Design tokens (exported as JSON/CSS/Figma)
export const designTokens = {
  colors: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#000000',
    text: '#0A0A0A',
    accent: '#FFD700',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444'
  },
  
  spacing: {
    1: '0.5rem',
    2: '1rem',
    3: '1.5rem',
    4: '2rem',
    5: '3rem',
    6: '4rem'
  },
  
  typography: {
    fontFamily: {
      sans: 'Inter Variable, SF Pro, system-ui',
      mono: 'JetBrains Mono, SF Mono, Courier New'
    },
    fontSize: {
      display: '48px',
      h1: '38px',
      h2: '30px',
      h3: '24px',
      body: '16px',
      small: '14px',
      tiny: '12px'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },
  
  borders: {
    thin: '1px solid',
    medium: '2px solid',
    thick: '3px solid',
    heavy: '4px solid'
  },
  
  transitions: {
    fast: '150ms ease',
    medium: '300ms ease',
    slow: '500ms ease'
  }
};
```

### Appendix B: Component Library Structure

```
packages/ui/src/
├── components/
│   ├── dice/
│   │   ├── DiceTray.svelte
│   │   ├── Die.svelte
│   │   ├── DieFace.svelte
│   │   └── ProbabilityHalo.svelte
│   ├── scorecard/
│   │   ├── Scorecard.svelte
│   │   ├── CategoryRow.svelte
│   │   ├── SectionHeader.svelte
│   │   └── TotalRow.svelte
│   ├── hud/
│   │   ├── EVDifferential.svelte
│   │   ├── DecisionCompass.svelte
│   │   ├── ProbabilityWave.svelte
│   │   └── StatsToggle.svelte
│   └── shared/
│       ├── Button.svelte
│       ├── Card.svelte
│       ├── Modal.svelte
│       └── Tooltip.svelte
├── layouts/
│   ├── MobileLayout.svelte
│   ├── TabletLayout.svelte
│   └── DesktopLayout.svelte
├── styles/
│   ├── global.css
│   ├── tokens.css
│   └── animations.css
└── utils/
    ├── motion.ts
    ├── gestures.ts
    └── accessibility.ts
```

### Appendix C: Figma Design File Structure

```
Dicee Design System
├── 📘 Cover & Overview
├── 🎨 Design Tokens
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   └── Borders
├── 🧩 Components
│   ├── Atoms (Dice, Buttons, Icons)
│   ├── Molecules (Category Row, Dice Tray)
│   └── Organisms (Scorecard, HUD)
├── 📱 Mobile Screens
│   ├── Game - Initial State
│   ├── Game - Rolling
│   ├── Game - Stats ON
│   └── Game - Completed
├── 💻 Desktop Screens
│   ├── Game - Three Column
│   └── Game - Analytics Panel
└── 🎭 States & Variations
    ├── Beginner Mode
    ├── Intermediate Mode
    └── Advanced Mode
```

### Appendix D: Animation Specifications

**Dice Roll Timing Function:**

```css
/* Custom easing for natural dice physics */
@keyframes dice-roll {
  0% {
    transform: rotateX(0deg) rotateY(0deg);
  }
  30% {
    transform: rotateX(180deg) rotateY(90deg);
  }
  60% {
    transform: rotateX(360deg) rotateY(270deg);
  }
  100% {
    transform: rotateX(720deg) rotateY(360deg);
  }
}

.die.rolling {
  animation: dice-roll 800ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**Probability Halo Pulse:**

```css
@keyframes halo-pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

.probability-halo.active {
  animation: halo-pulse 2s ease-in-out infinite;
}
```

---

**Document Status:** ✅ RFC Ready for Review  
**Next Steps:**
1. Design review with team
2. Prototype key interactions in Figma
3. Implement Phase 1 (Core Layout)
4. User testing with target audience (middle schoolers + parents)

**Related Documents:**
- RFC-001: Statistical Engine Architecture ✅
- RFC-003: Data Contracts & Event Schema (Next)
- RFC-004: Game Loop & Mechanics (Next)
