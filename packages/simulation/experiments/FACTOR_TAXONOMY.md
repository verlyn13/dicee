# Factor Taxonomy for Dicee Simulation Experiments

This document defines all experimental factors, their levels, and the rationale for inclusion.

## Overview

Our experimental framework uses a **factorial design** approach where we systematically vary factors to understand their effects on game outcomes. This enables:

- Main effect analysis (how does factor X affect scores?)
- Interaction effects (does strategy A perform differently against different opponents?)
- Comparative analysis (which strategy is best under which conditions?)

---

## Factor 1: Strategy Type (Primary Factor)

The decision-making approach used by a player. This is our main independent variable.

### Core Strategies (Implemented)

| Level | ID | Description | Expected Score Range |
|-------|-----|-------------|---------------------|
| Optimal | `optimal` | Pure expected value maximization | 180-220 mean |
| Probabilistic | `probabilistic` | Weighted random based on EV | 150-190 mean |
| Personality | `personality` | Profile-based decision making | 140-200 mean (varies) |
| Random | `random` | Uniform random (baseline control) | 100-140 mean |

### Heuristic Strategies (To Be Implemented)

| Level | ID | Description | Hypothesis |
|-------|-----|-------------|------------|
| Upper Priority | `heuristic-upper-priority` | Prioritize 6s→5s→4s for bonus | +10-15 over random |
| Yahtzee Chaser | `heuristic-yahtzee-chaser` | Go all-in on 3-of-kind for Yahtzee | High variance, occasional spikes |
| Straight Keeper | `heuristic-straight-keeper` | Always keep partial straights | More consistent straights |
| Chance Saver | `heuristic-chance-saver` | Save Chance until end | Better endgame flexibility |
| Low Dump | `heuristic-low-dump` | Use 1s/2s for garbage rolls | Preserves bonus path |
| Two Roll | `heuristic-two-roll` | Max 2 rolls for upper section | Reduces blown categories |
| Backwards | `heuristic-backwards` | Lower section first | Tests conventional wisdom |

### Implementation Priority

1. **Phase 1**: `heuristic-upper-priority`, `heuristic-chance-saver`, `heuristic-low-dump`
2. **Phase 2**: `heuristic-yahtzee-chaser`, `heuristic-straight-keeper`
3. **Phase 3**: `heuristic-two-roll`, `heuristic-backwards`

---

## Factor 2: Personality Profile (Nested Factor)

When strategy = `personality`, this determines the specific behavioral profile.

| Level | ID | Risk Tolerance | Adaptability | Decision Style |
|-------|-----|---------------|--------------|----------------|
| Professor | `professor` | Low | High | Analytical, near-optimal |
| Carmen | `carmen` | High | Medium | Aggressive, risk-seeking |
| Riley | `riley` | Medium | High | Balanced, adaptive |
| Liam | `liam` | Low | Low | Conservative, safe |
| Charlie | `charlie` | Variable | Low | Chaotic, unpredictable |

### Expected Performance Hierarchy

```
professor > riley > liam > carmen > charlie
```

Note: Carmen may outperform in high-variance situations due to risk-seeking.

---

## Factor 3: Matchup Type (Design Factor)

The competitive structure of the game.

| Level | ID | Players | Use Case |
|-------|-----|---------|----------|
| Solo | `solo` | 1 | Baseline performance measurement |
| Mirror | `mirror` | 2 (same) | Control for strategy-vs-strategy effects |
| Head-to-Head | `head-to-head` | 2 (different) | Direct strategy comparison |
| Four Player | `four-player` | 4 | Full table dynamics |
| Tournament | `tournament` | Variable | Round-robin comparative analysis |

### Design Considerations

- **Solo**: Pure strategy evaluation without opponent effects
- **Mirror**: Tests consistency (should be ~50% win rate)
- **Head-to-Head**: Primary competitive analysis
- **Four Player**: Tests multiplayer dynamics (winner-take-all vs cumulative)

---

## Factor 4: Game Phase (Analysis Factor)

For turn-level analysis, categorize decisions by game state.

| Level | ID | Rounds | Key Decisions |
|-------|-----|--------|---------------|
| Early | `early` | 1-4 | Category selection strategy |
| Mid | `mid` | 5-9 | Adaptation to scorecard state |
| Late | `late` | 10-13 | Forced choices, endgame pressure |

### Analysis Questions

- Do strategies differ in early vs late game performance?
- Which strategies handle endgame pressure better?
- Are there interaction effects (strategy × phase)?

---

## Factor 5: Opponent Strength (Contextual Factor)

When testing competitive performance, opponent type matters.

| Level | Description | Use Case |
|-------|-------------|----------|
| Same | Same strategy as focal player | Mirror match baseline |
| Weaker | Random or low-skill opponent | Performance ceiling |
| Stronger | Optimal opponent | Performance under pressure |
| Mixed | Variety of opponents | Realistic tournament conditions |

---

## Dependent Variables (Outcomes)

### Primary Metrics

| Metric | ID | Level | Description |
|--------|-----|-------|-------------|
| Total Score | `total_score` | Game | Final game score |
| Win Rate | `win_rate` | Condition | Proportion of games won |
| Score Variance | `score_variance` | Condition | Consistency measure |

### Secondary Metrics

| Metric | ID | Level | Description |
|--------|-----|-------|-------------|
| Upper Section | `upper_section_score` | Game | Sum of upper categories |
| Upper Bonus Rate | `upper_bonus_rate` | Condition | % achieving 63+ upper |
| Yahtzee Rate | `yahtzee_rate` | Condition | % scoring Yahtzee |
| Decision Optimality | `decision_optimality` | Turn | % of optimal decisions |
| EV Loss | `ev_loss_per_game` | Game | Expected value left on table |

---

## Statistical Considerations

### Sample Size Requirements

Based on power analysis (α=0.05, power=0.80):

| Effect Size (d) | N per group | Total for 2-group |
|-----------------|-------------|-------------------|
| Large (0.8) | 26 | 52 |
| Medium (0.5) | 64 | 128 |
| Small (0.2) | 394 | 788 |

**Recommendation**: Minimum 100 games per condition for robust estimates, 1000+ for detecting small effects.

### Assumptions to Verify

1. **Independence**: Each game is independent (ensured by fresh seeds)
2. **Normality**: Score distributions should be approximately normal (verify with histograms)
3. **Homogeneity of Variance**: Similar variance across conditions (Levene's test)

### Multiple Comparison Corrections

When testing multiple hypotheses:
- **Bonferroni**: Conservative, controls FWER (α/k)
- **Holm**: Step-down procedure, less conservative
- **FDR-BH**: Controls false discovery rate, recommended for exploratory

---

## Experiment Naming Convention

```
EXP-YYYY-NNN[a-z]
```

- `YYYY`: Year
- `NNN`: Sequential number within year
- `[a-z]`: Optional suffix for related sub-experiments

Examples:
- `EXP-2024-001`: First experiment of 2024
- `EXP-2024-001a`: Follow-up to first experiment
- `EXP-2024-002`: Second experiment of 2024

---

## Lineage Tracking

Each experiment should document:

1. **Prior experiments it builds on** (extends, replicates, refutes, refines)
2. **Key findings from priors** that informed this design
3. **How this experiment advances knowledge**

This creates a traceable chain of scientific inquiry.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-10 | Initial taxonomy |
