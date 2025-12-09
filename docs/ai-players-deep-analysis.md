# AI Players: Deep Consequential Analysis
## Framework Integration, AKG Constraints, MCP Capabilities, and DO Workloads

**Created**: 2025-12-08  
**Status**: Architectural Analysis  
**Related**: `docs/ai-players.md`, `docs/ai-players-implementation-plan.md`

---

## Executive Summary

This document provides a deep consequential analysis of implementing AI Players within the existing Dicee architecture. It examines:

1. **Framework Integration** - How AI fits with current patterns
2. **AKG Constraints** - Architectural rules AI must follow
3. **MCP Capabilities** - How MCP servers support AI development
4. **DO Workloads** - Remaining Durable Object work and AI dependencies

**Critical Finding**: The GameRoom DO has **incomplete game state management** (marked `TODO (do-4)`). AI Players **cannot be implemented** until the core game loop is complete.

---

## 1. Current State Analysis

### 1.1 GameRoom DO: What's Complete vs Incomplete

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GameRoom.ts (2778 lines)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ COMPLETE                          │ ❌ INCOMPLETE (TODO do-4)            │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • WebSocket connection lifecycle     │ • Turn timeout handling              │
│ • Hibernatable WebSocket support     │ • AFK check logic                    │
│ • Tag-based broadcast filtering      │ • Room cleanup                       │
│ • Chat system (ChatManager)          │ • Full game state initialization     │
│ • Spectator mode (D1-D9)             │ • Dice rolling command               │
│ • Gallery predictions (D4)           │ • Keep dice command                  │
│ • Rooting system (D5)                │ • Score category command             │
│ • Kibitz voting (D6)                 │ • Turn advancement                   │
│ • Spectator reactions (D7)           │ • Game over detection                │
│ • Join queue (D8)                    │ • Rankings calculation               │
│ • Gallery points (D9)                │ • Rematch flow                       │
│ • GlobalLobby RPC integration        │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 1.2 TODO Items in GameRoom.ts

```typescript
// Line 247-256: Alarm handler stubs
case 'TURN_TIMEOUT':
    // TODO (do-4): Handle turn timeout
case 'AFK_CHECK':
    // TODO (do-4): Handle AFK check
case 'ROOM_CLEANUP':
    // TODO: Implement room cleanup

// Line 368: Player score not connected
score: 0, // TODO: Get actual score from game state

// Line 387: Round number not connected
roundNumber: 0, // TODO: Get from game state

// Line 752: Game start incomplete
// TODO (do-4): Initialize full game state
```

### 1.3 Dependency Chain

```
AI Players (Phase 12)
    │
    ├── Requires: Full game state machine in DO
    │       │
    │       ├── dice.roll command handler
    │       ├── dice.keep command handler
    │       ├── category.score command handler
    │       ├── Turn advancement logic
    │       └── Game over detection
    │
    ├── Requires: Alarm-based turn execution
    │       │
    │       ├── TURN_TIMEOUT handler (for AI timing)
    │       └── Scheduled alarm chaining
    │
    └── Requires: WASM engine in Workers
            │
            ├── wasm32-unknown-unknown build
            └── Module loading in DO context
```

---

## 2. AKG Constraints Analysis

### 2.1 Current AKG Status

```
✓ PASS  wasm_single_entry (0.1ms)
✓ PASS  store_no_circular_deps (0.4ms)
✓ PASS  layer_component_isolation (0.1ms)
✓ PASS  service_layer_boundaries (0.0ms)
✓ PASS  store_file_naming (0.1ms)

Graph: 165 nodes, 279 edges
```

### 2.2 Layer Architecture Rules

| Layer | Can Import | Cannot Import |
|-------|------------|---------------|
| **routes** | everything | - |
| **components** | components, types | stores, services |
| **stores** | services, types, supabase | components, routes |
| **services** | types, supabase, wasm | components, routes, stores |
| **types** | types only | everything else |

### 2.3 AI Impact on AKG

**New Files and Their Layers**:

| File | Layer | Imports | AKG Impact |
|------|-------|---------|------------|
| `cloudflare-do/src/ai/types.ts` | types | types only | ✅ No violation |
| `cloudflare-do/src/ai/profiles.ts` | types | types only | ✅ No violation |
| `cloudflare-do/src/ai/controller.ts` | service | types, game | ✅ No violation |
| `cloudflare-do/src/ai/brain/*.ts` | service | types, engine | ✅ No violation |
| `cloudflare-do/src/ai/engine.ts` | service | wasm | ✅ No violation |
| `web/src/lib/types/ai.ts` | types | types only | ✅ No violation |
| `web/src/lib/components/lobby/AIOpponentSelector.svelte` | component | types | ✅ No violation |

**Key Constraint**: AI components in `packages/web` **cannot import** from `packages/cloudflare-do`. Types must be duplicated or shared via a common package.

### 2.4 AKG Invariants to Add

Consider adding these invariants for AI:

```typescript
// ai-brain-isolation: AI brains cannot import GameRoom directly
{
  id: 'ai_brain_isolation',
  description: 'AI brains must use GameContext interface, not GameRoom',
  check: (graph) => {
    const brains = graph.nodes.filter(n => n.path.includes('/ai/brain/'));
    const violations = brains.filter(b => 
      graph.edges.some(e => e.from === b.id && e.to.includes('GameRoom'))
    );
    return { passed: violations.length === 0, violations };
  }
}

// ai-no-client-imports: AI code cannot import client-side code
{
  id: 'ai_no_client_imports',
  description: 'AI code in cloudflare-do cannot import from packages/web',
  check: (graph) => {
    const aiNodes = graph.nodes.filter(n => n.path.includes('cloudflare-do/src/ai'));
    const violations = aiNodes.filter(n =>
      graph.edges.some(e => e.from === n.id && e.to.includes('packages/web'))
    );
    return { passed: violations.length === 0, violations };
  }
}
```

---

## 3. MCP Server Capabilities

### 3.1 Available MCP Servers

| Server | Purpose | AI Development Use |
|--------|---------|-------------------|
| **dicee-memory** | Knowledge graph persistence | Store AI profile definitions, track implementation progress |
| **supabase** | Database, migrations, docs | AI stats tables, leaderboard queries |
| **akg** | Architecture validation | Validate AI imports before writing |

### 3.2 MCP Tools for AI Development

**Memory MCP**:
```typescript
// Track AI implementation progress
mcp0_create_entities([{
  name: "AIBrainOptimal",
  entityType: "Component",
  observations: ["Implements pure EV maximization", "Uses WASM engine"]
}]);

// Link to existing entities
mcp0_create_relations([{
  from: "AIPlayersFeature",
  to: "AIBrainOptimal",
  relationType: "contains"
}]);
```

**Supabase MCP**:
```typescript
// Create AI stats migration
mcp1_apply_migration({
  name: "ai_game_stats",
  query: `
    CREATE TABLE ai_game_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id TEXT NOT NULL,
      games_played INTEGER DEFAULT 0,
      average_score DECIMAL(5,2),
      win_rate DECIMAL(3,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
});

// Query AI performance
mcp1_execute_sql({
  query: "SELECT profile_id, AVG(score) FROM ai_game_stats GROUP BY profile_id"
});
```

**AKG MCP**:
```typescript
// Before writing AI imports, validate
akg_check_import({
  fromPath: "packages/cloudflare-do/src/ai/controller.ts",
  toPath: "packages/cloudflare-do/src/game/types.ts"
});
// Returns: { allowed: true, reason: "service → types is valid" }

// Check AI doesn't violate layer rules
akg_invariant_status();
// Returns: { passed: 5, failed: 0 }
```

### 3.3 MCP-Assisted Development Workflow

```
1. Design Phase
   └── mcp0_create_entities() - Document AI architecture in knowledge graph

2. Schema Phase
   └── mcp1_apply_migration() - Create AI stats tables

3. Implementation Phase
   └── akg_check_import() - Validate every import before writing
   └── akg_invariant_status() - Verify no violations after changes

4. Testing Phase
   └── mcp1_execute_sql() - Verify AI stats persistence

5. Documentation Phase
   └── mcp0_add_observations() - Update knowledge graph with learnings
```

---

## 4. Durable Object Workloads Analysis

### 4.1 DO-4: Core Game Loop (BLOCKING)

**Status**: Not implemented  
**Priority**: CRITICAL - Blocks AI Players

**Required Work**:

```typescript
// GameRoom.ts needs these handlers:

// 1. Dice rolling
case 'DICE_ROLL':
  const validation = canRollDice(this.gameState, playerId);
  if (!validation.success) {
    this.sendError(ws, validation.error, validation.message);
    return;
  }
  const newDice = this.rollDice(keepMask);
  this.updatePlayerDice(playerId, newDice);
  this.broadcast({ type: 'DICE_ROLLED', payload: { playerId, dice: newDice } });
  break;

// 2. Keep dice
case 'DICE_KEEP':
  const keepValidation = canKeepDice(this.gameState, playerId);
  if (!keepValidation.success) {
    this.sendError(ws, keepValidation.error, keepValidation.message);
    return;
  }
  this.updateKeptDice(playerId, keepMask);
  this.broadcast({ type: 'DICE_KEPT', payload: { playerId, keepMask } });
  break;

// 3. Score category
case 'CATEGORY_SCORE':
  const scoreValidation = canScoreCategory(this.gameState, playerId, category);
  if (!scoreValidation.success) {
    this.sendError(ws, scoreValidation.error, scoreValidation.message);
    return;
  }
  const score = scoreCategory(dice, category);
  this.updateScorecard(playerId, category, score);
  this.advanceToNextPlayer();
  break;

// 4. Turn advancement
private advanceToNextPlayer(): void {
  this.gameState.currentPlayerIndex = 
    (this.gameState.currentPlayerIndex + 1) % this.gameState.playerOrder.length;
  
  if (this.gameState.currentPlayerIndex === 0) {
    this.gameState.roundNumber++;
  }
  
  if (this.gameState.roundNumber > 13) {
    this.endGame();
    return;
  }
  
  this.resetPlayerTurn(this.getCurrentPlayerId());
  this.broadcast({ type: 'TURN_STARTED', payload: { playerId: this.getCurrentPlayerId() } });
  
  // AI INTEGRATION POINT
  const currentPlayer = this.getCurrentPlayer();
  if (currentPlayer.type === 'ai') {
    this.scheduleAITurn(currentPlayer);
  }
}
```

### 4.2 DO-4 Effort Estimate

| Task | Effort | Dependencies |
|------|--------|--------------|
| Dice roll handler | 2h | game/scoring.ts |
| Keep dice handler | 1h | game/types.ts |
| Score category handler | 3h | game/scoring.ts, game/machine.ts |
| Turn advancement | 2h | game/types.ts |
| Game over detection | 2h | game/types.ts |
| Rankings calculation | 1h | game/types.ts |
| Turn timeout alarm | 2h | alarm handler |
| AFK check alarm | 2h | alarm handler |
| **Total** | **15h** | |

### 4.3 AI-Specific DO Work

| Task | Effort | Dependencies |
|------|--------|--------------|
| AI turn scheduling via alarm | 3h | DO-4 complete |
| WASM engine loading in Workers | 4h | engine package |
| AI controller integration | 4h | DO-4 complete |
| AI profile storage | 2h | types |
| AI chat integration | 2h | ChatManager |
| **Total** | **15h** | |

### 4.4 Combined Timeline

```
Week 1: DO-4 Core Game Loop
├── Day 1-2: Dice roll/keep handlers
├── Day 3-4: Score category + turn advancement
└── Day 5: Game over + rankings

Week 2: DO-4 Alarms + AI Foundation
├── Day 1-2: Turn timeout + AFK alarms
├── Day 3: WASM engine in Workers spike
└── Day 4-5: AI types + profiles

Week 3: AI Implementation
├── Day 1-2: AI controller + scheduling
├── Day 3-4: Brain implementations
└── Day 5: Integration testing

Week 4: AI Polish
├── Day 1-2: AI chat + personality
├── Day 3-4: UI components
└── Day 5: E2E testing
```

---

## 5. Consequential Analysis

### 5.1 What Happens If We Build AI Before DO-4?

**Scenario**: Implement AI brains without complete game loop.

**Consequences**:
1. ❌ AI cannot execute moves (no command handlers)
2. ❌ AI cannot observe game state (incomplete state machine)
3. ❌ AI timing simulation impossible (no alarm integration)
4. ❌ Tests cannot verify AI behavior (no game to play)
5. ❌ Wasted effort - would need rewrite when DO-4 completes

**Verdict**: **DO NOT PROCEED** with AI until DO-4 is complete.

### 5.2 What Can Be Done in Parallel?

**Safe to implement now**:
- ✅ AI type definitions (`AIProfile`, `AITraits`, `AITiming`)
- ✅ Pre-built profile data (`profiles.ts`)
- ✅ Brain interface design (`AIBrain` interface)
- ✅ WASM loading spike in Workers
- ✅ UI components (profile selector, AI badge)
- ✅ Database migrations (AI stats tables)

**Must wait for DO-4**:
- ❌ AI controller integration
- ❌ Brain implementations (need game context)
- ❌ Turn scheduling via alarms
- ❌ Integration tests

### 5.3 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WASM doesn't load in Workers | Medium | High | TypeScript fallback ready |
| AI timing feels unnatural | Low | Medium | Tune timing parameters |
| AI too strong/weak | Medium | Medium | Skill calibration tests |
| DO-4 takes longer than expected | Medium | High | Parallelize safe work |
| AKG violations from AI code | Low | Low | Validate imports before writing |

### 5.4 Decision Tree

```
Is DO-4 (core game loop) complete?
├── NO → Focus on DO-4 first
│         ├── Can do: AI types, profiles, UI, migrations
│         └── Cannot do: AI controller, brains, integration
│
└── YES → Proceed with AI implementation
          ├── Phase 1: Foundation (Week 1)
          ├── Phase 2: Personality (Week 2)
          ├── Phase 3: Polish (Week 3)
          └── Phase 4: Integration (Week 4)
```

---

## 6. Recommendations

### 6.1 Immediate Actions

1. **Complete DO-4** before any AI controller work
2. **Create AI types now** - no dependencies, safe to parallelize
3. **Spike WASM in Workers** - validate critical assumption early
4. **Add AKG invariants** for AI code isolation

### 6.2 Phase Sequencing

```
Phase 11 (Current): UX Enhancement
├── Track A: Coach Mode ✅
├── Track B: Audio ✅
├── Track C: Feature Flags ✅
└── Track D: Gallery ✅

Phase 11.5 (NEW): DO-4 Core Game Loop
├── Dice/Keep/Score handlers
├── Turn advancement
├── Game over detection
└── Alarm handlers

Phase 12: AI Players
├── Foundation (types, profiles, WASM)
├── Personality (brains, traits)
├── Polish (chat, UI)
└── Integration (testing, calibration)
```

### 6.3 Success Criteria

| Milestone | Criteria |
|-----------|----------|
| DO-4 Complete | Human players can complete a full game via WebSocket |
| AI Foundation | WASM loads in Workers, types compile, profiles defined |
| AI Playable | AI can complete a game with optimal strategy |
| AI Polished | AI has personality, timing feels natural, chat works |
| AI Shipped | Solo mode available in production, 20% adoption |

---

## 7. Appendix: Current Knowledge Graph State

```
Entities:
├── DiceeProject (Project)
├── AIPlayersFeature (Feature) ← NEW
├── DiceePhase11 (project-phase)
├── DurableObjectsInfra (Infrastructure)
├── CloudflareDoPackage (Package)
├── EnginePackage (Package)
└── ... (30+ more entities)

Relations:
├── DiceeProject → plannedFeature → AIPlayersFeature
├── AIPlayersFeature → uses → EnginePackage
├── AIPlayersFeature → runsIn → DurableObjectsInfra
└── ... (50+ more relations)
```

---

## 8. Conclusion

**AI Players is a well-designed feature that integrates cleanly with the existing architecture**, but it has a **hard dependency on DO-4 (core game loop)** which is currently incomplete.

**Recommended Path Forward**:
1. Complete DO-4 (15h effort)
2. Parallelize safe AI work (types, profiles, UI, migrations)
3. Spike WASM in Workers early
4. Implement AI in 4 phases over 4 weeks
5. Use MCP servers throughout for validation and persistence

**Total Estimated Effort**: 30h (15h DO-4 + 15h AI)  
**Calendar Time**: 4-6 weeks depending on parallelization
