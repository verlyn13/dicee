# Dicee AI Strategy Knowledge Base

**Purpose:** Reference document for AI brain decision-making, derived from empirical simulation data.
**Last Updated:** December 11, 2024
**Evidence Base:** 55,000+ simulated games

---

## Core Strategic Principles

### Principle 1: Category Mastery > Dicee Chasing

**Evidence:** Liam achieves 33.7% Dicee rate but scores 6 points less than Professor (14.5% Dicee rate).

**Rule:** Only pursue Dicee (5-of-a-kind) when:
- Already have 4-of-a-kind after roll 1 or 2
- No category would score 15+ points with current dice
- Dicee category is still open

**Anti-pattern:** Committing to Dicee pursuit with only 3-of-a-kind sacrifices too many alternative scoring opportunities.

---

### Principle 2: Upper Section Discipline

**Evidence:** Upper bonus (35 points for 63+) achieved in only ~10% of games, but adds 46-62 total points when achieved.

**Rule:** Prioritize upper section scoring when:
- Can score face value × 3 or better (e.g., 12+ for fours)
- Upper section deficit is recoverable (need ≤ 15 points in remaining categories)
- No lower section category would score 20+ points

**Target:** Average 52+ in upper section for bonus contention.

| Category | Target Score | Minimum Accept |
|----------|--------------|----------------|
| Ones | 3+ | 2 |
| Twos | 6+ | 4 |
| Threes | 9+ | 6 |
| Fours | 12+ | 8 |
| Fives | 15+ | 10 |
| Sixes | 18+ | 12 |

---

### Principle 3: Straight Completion Priority

**Evidence:** Professor achieves 95% small straight, 46% large straight vs 85%/34% for others.

**Rule:** When holding partial straight (e.g., 1-2-3-4 or 3-4-5-6):
- Keep ALL straight components
- Only reroll non-straight dice
- Accept small straight if large straight unlikely after roll 2

**Decision Matrix:**
| After Roll | Have | Action |
|------------|------|--------|
| 1 | 4 sequential | Keep all 4, roll 1 for large |
| 2 | 4 sequential | Take small straight (30 pts) |
| 1-2 | 3 sequential | Keep 3, roll 2 for completion |
| 3 | 3 sequential | Evaluate alternatives, may need to pivot |

---

### Principle 4: Full House Opportunism

**Evidence:** Professor achieves 78% full house vs 57% for others.

**Rule:** Full house (25 points) is reliable but not to be forced.

**When to pursue:**
- Have 3-of-a-kind + pair after roll 1
- Have 3-of-a-kind after roll 1, pair likely with 2 rerolls
- Have 2 pairs after roll 1-2

**When to abandon:**
- After roll 2 with only 3-of-a-kind (take 3-of-a-kind category instead)
- Better scoring opportunity in other category

---

### Principle 5: Chance as Strategic Reserve

**Evidence:** Professor averages 22.3 in Chance with 18.6% low (<20) usage vs 30%+ for others.

**Rule:** Treat Chance as late-game insurance, not early-game dump.

**Optimal Chance timing:**
- Rounds 10-13 when forced into bad position
- When dice total 22+ but no category fits well
- NEVER before round 8 unless scoring 25+

**Anti-pattern:** Using Chance in rounds 1-7 removes crucial endgame flexibility.

---

## Phase-Based Strategy Framework

### Early Game (Rounds 1-4): Opportunistic Scoring

**Goals:**
- Complete 1-2 "easy" lower section categories (small straight, 3-of-a-kind)
- Bank solid upper section scores when available
- Avoid committing to difficult categories

**Decision Priority:**
1. Take any 25+ point score
2. Take face value × 3 or better in upper section
3. Take small straight if available
4. Keep best dice, continue rolling

### Mid Game (Rounds 5-9): Strategic Positioning

**Goals:**
- Assess upper bonus viability (need 63+ total)
- Complete Full House if opportunity arises
- Preserve Dicee and Large Straight for good rolls

**Decision Priority:**
1. Evaluate remaining category mix
2. If upper bonus viable: prioritize upper section
3. If upper bonus unlikely: maximize lower section
4. Consider opponent scores in competitive play

### Late Game (Rounds 10-13): Forced Optimization

**Goals:**
- Fill remaining categories with minimal damage
- Use Chance strategically as dump
- Zero out impossible categories early (not last)

**Decision Priority:**
1. Take best available score for remaining categories
2. Zero out lowest-impact impossible category
3. Use Chance only when truly optimal
4. In competitive: consider risk for win vs safe for place

---

## Anti-Patterns to Avoid

### 1. Phase-Locking Fallacy (Phase-Shifting Pattern)
**Problem:** Committing to a strategy for multiple rounds limits adaptability.
**Evidence:** All phase-shifting variants underperform Professor by 17-67 points (see ANALYSIS-2024-002).
**Correction:** Evaluate each decision independently. Don't lock into "greedy mode" or "strategic mode" - just make optimal decisions.

### 2. Risk-Seeking Fallacy (Carmen Pattern)
**Problem:** Chasing big scores consistently underperforms safe plays.
**Evidence:** Carmen averages 145 vs Professor's 182 (-37 points).
**Correction:** Accept "good enough" scores, don't chase perfect.

### 3. Dicee Tunnel Vision (Liam Pattern)
**Problem:** Over-committing to Dicee pursuit sacrifices other categories.
**Evidence:** High Dicee rate (34%) but lower overall average.
**Correction:** Evaluate opportunity cost of each reroll decision.

### 4. Early Chance Dump
**Problem:** Using Chance before round 8 removes endgame options.
**Evidence:** Professor's strategic Chance usage correlates with higher scores.
**Correction:** Accept a zero in low-impact category rather than burning Chance.

### 5. Upper Section Neglect
**Problem:** Only 0.9% bonus rate for Carmen (vs 10-11% for others).
**Evidence:** Upper bonus worth ~50 total points when achieved.
**Correction:** Track upper section running total, prioritize when on pace.

### 6. Section Specialization (Phase-Upper/Lower Pattern)
**Problem:** Over-focusing on one section (upper OR lower) severely underperforms.
**Evidence:**
- Upper-first: 115 avg (-67 vs Professor)
- Lower-first: 125 avg (-57 vs Professor)
**Correction:** Pursue the best available opportunity each turn, regardless of section.

---

## Competitive Adjustments

### Head-to-Head Play
- **When ahead:** Play conservative, deny opponent big swings
- **When behind:** Increase risk tolerance in late rounds
- **Close game:** Category selection timing matters (deny opponent)

### Four-Player Games
- **Win rate drops to 25% expected** - adjust expectations
- **Position matters less** - focus on maximizing own score
- **Last place avoidance:** Carmen finishes last 51% of time

---

## Strategy Shifting Framework

### Adaptive Strategy (Experimental)

**Concept:** Start with one strategy, shift based on game state.

**Greedy-to-Strategic Shift:**
```
Rounds 1-4: Greedy (take best immediate score)
Round 5: Evaluate position
  - If upper total >= 35: Shift to bonus-focused
  - If upper total < 25: Shift to lower-section focus
  - If on pace: Continue balanced play
Rounds 10-13: Endgame optimization regardless of earlier strategy
```

**Trailing Recovery Shift:**
```
If behind by 30+ points at round 8:
  - Increase Dicee pursuit threshold
  - Take more risks on large straight
  - Accept lower probability high-reward plays
```

---

## Calibrated Expectations

### Score Distribution Benchmarks

| Percentile | Professor | Target for New Brain |
|------------|-----------|---------------------|
| 10th (floor) | 140 | 135+ |
| 25th | 156 | 150+ |
| 50th (median) | 181 | 175+ |
| 75th | 203 | 195+ |
| 90th (ceiling) | 228 | 220+ |

### Win Rate Expectations

| Matchup | Expected Win Rate |
|---------|-------------------|
| vs Random | 95%+ |
| vs Carmen | 75-80% |
| vs Riley | 55-60% |
| vs Liam | 50-55% |
| vs Professor | 50% (mirror) |

---

## Implementation Checklist for New Brains

- [ ] Upper section tracking (running total toward 63)
- [ ] Category completion tracking (what's still available)
- [ ] Phase detection (early/mid/late game)
- [ ] Opportunity cost calculation (what am I giving up?)
- [ ] Straight detection (partial sequences)
- [ ] Dicee pursuit threshold (4-of-a-kind minimum)
- [ ] Chance reservation (avoid before round 8)
- [ ] Competitive awareness (opponent score tracking)

---

*This knowledge base is continuously updated based on simulation findings. See `/experiments/results/` for detailed analysis reports.*
