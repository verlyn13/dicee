# UX Development Audit Workflow

## The Problem This Solves

The debugging session revealed a recurring pattern: **features that "worked" according to the code failed to deliver the expected user experience**. Each bug required multiple deploy-test-debug cycles to discover, then trace through layers of abstraction to fix.

| Bug | Root Cause | Layer Gap |
|-----|------------|-----------|
| AI scores without rolling | Brain received fake dice `[1,1,1,1,1]` as default | Functionality → Codebase |
| Waiting room flash | Client routing didn't know about Quick Play mode | Architecture → Functionality |
| Button unresponsive | `canRoll` was false because `rollsRemaining` wasn't sent | Functionality → Codebase |
| Stuck at "ROLLING..." | Server validation failed silently | Architecture → Functionality |

**Common thread**: No single source of truth defined what should happen at each step.

---

## The Four-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│  1. Expected UX                                             │
│     "What the user should experience"                       │
│     - User stories, acceptance criteria, screen flows       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. UX Architecture                                         │
│     "How the system delivers that experience"               │
│     - State machines, event flows, component responsibilities│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. UX Functionality                                        │
│     "What the code must do"                                 │
│     - Function contracts, data shapes, validation rules     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Codebase                                                │
│     "The actual implementation"                             │
│     - Source files, tests, deployed artifacts               │
└─────────────────────────────────────────────────────────────┘
```

---

## Pre-Development Audit Checklist

### Before writing any code, answer these questions:

#### Layer 1: Expected UX
- [ ] What does the user see at each step?
- [ ] What can the user do at each step?
- [ ] What feedback does the user receive for each action?
- [ ] What happens if something goes wrong?
- [ ] How long should each step take?

**Document format**: User flow diagram or step-by-step narrative

```markdown
## Quick Play Flow - Expected UX

1. User clicks "Quick Play" button
   - Sees: Loading indicator
   - Duration: < 500ms
   
2. Game screen appears
   - Sees: Game board, their turn indicator, START YOUR TURN button
   - NOT sees: Waiting room (even briefly)
   
3. User clicks START YOUR TURN
   - Sees: Dice animate and roll
   - Duration: 1-2 seconds
   
4. Dice results appear
   - Sees: Five dice with values, KEEP buttons, ROLL AGAIN button
```

#### Layer 2: UX Architecture
- [ ] What components own what state?
- [ ] What events trigger state transitions?
- [ ] What are the valid state combinations?
- [ ] What component talks to what other component?

**Document format**: State machine + event flow diagram

```markdown
## Quick Play Flow - Architecture

### State Machine
```
[lobby] --QUICK_PLAY_START--> [playing:turn_roll]
                                    |
                              (no waiting state)
```

### Event Flow
```
Client                          Server
   |                               |
   |---QUICK_PLAY_START----------->|
   |                               |--create AI players
   |                               |--set phase=playing
   |                               |--set currentPlayer=human
   |<--QUICK_PLAY_STARTED----------|
   |                               |
   |---DICE_ROLL------------------>|
   |                               |--validate turn
   |                               |--generate dice
   |<--DICE_ROLLED-----------------|
```

### Component Responsibilities
- **LobbyLanding**: Initiates Quick Play, passes AI profile
- **RoomService**: WebSocket connection, event normalization
- **MultiplayerGameView**: Routing between views (must know about Quick Play)
- **GameRoom (server)**: Game state, validation, broadcasts
```

#### Layer 3: UX Functionality
- [ ] What data shape does each event carry?
- [ ] What validation happens at each step?
- [ ] What are the error cases and how are they surfaced?
- [ ] What defaults are applied and when?

**Document format**: Contract specifications

```markdown
## Quick Play Flow - Functionality Contracts

### QUICK_PLAY_START Command
```typescript
// Client sends:
{
  type: 'QUICK_PLAY_START',
  aiProfiles: ['carmen']  // Array of AI profile IDs
}

// Server validates:
- Room is in 'waiting' phase
- Sender is room host
- AI profiles are valid
- Room not full after adding AIs
```

### QUICK_PLAY_STARTED Event
```typescript
// Server broadcasts:
{
  type: 'QUICK_PLAY_STARTED',
  payload: {
    phase: 'playing',           // NOT 'waiting'
    currentPlayerId: string,    // Human player ID
    players: {                  // Full player state
      [id]: {
        id, displayName, avatarSeed, isAI,
        rollsRemaining: 3,      // MUST be included
        currentDice: null,      // MUST be null, not [1,1,1,1,1]
        scorecard: {...}
      }
    },
    turnOrder: string[],        // Human first
    roundNumber: 1
  }
}
```

### Validation Rules
```typescript
// canRollDice() returns true when:
- phase === 'playing'
- gameState.phase === 'turn_roll' OR rollsRemaining > 0
- currentPlayerId === requestingPlayerId
- player.rollsRemaining > 0

// If validation fails:
- Server sends ERROR event with reason
- Client shows error toast
- Client does NOT get stuck in "ROLLING..." state
```

#### Layer 4: Codebase Mapping
- [ ] Which files implement which functionality?
- [ ] Where are the validation rules implemented?
- [ ] Where are the defaults applied?
- [ ] What tests verify the contracts?

**Document format**: File-to-function mapping

```markdown
## Quick Play Flow - Codebase Mapping

### Server (packages/cloudflare-do)
| Function | File | Line | Contract |
|----------|------|------|----------|
| handleQuickPlayStart | GameRoom.ts | 892 | QUICK_PLAY_START command |
| canRollDice | GameRoom.ts | 680 | Dice roll validation |
| broadcast | GameRoom.ts | 425 | Event distribution |

### Client (packages/web)
| Function | File | Contract |
|----------|------|----------|
| sendQuickPlayStart | roomService.svelte.ts | Send command |
| normalizeServerEvent | roomService.svelte.ts | Event translation |
| handleGameStarted | multiplayerGame.svelte.ts | State initialization |

### Critical Defaults (AUDIT THESE)
| Location | Default | Risk |
|----------|---------|------|
| controller.ts:351 | `dice: player.currentDice ?? [1,1,1,1,1]` | AI thinks it has dice |
| state.ts:184 | `shuffle(playerOrder)` | Human might not go first |
```

---

## During Development: Trace Logging Strategy

### The "Breadcrumb Trail" Pattern

For any feature involving client-server communication, add logging at each boundary:

```typescript
// 1. Client initiates action
console.log(`[Client] Sending ${command.type}`, command);

// 2. Server receives
console.log(`[Server] Received ${command.type} from ${playerId}`);

// 3. Server validates
console.log(`[Server] Validation for ${command.type}:`, {
  phase, currentPlayer, rollsRemaining, result: 'pass' | 'fail'
});

// 4. Server broadcasts
console.log(`[Broadcast] ${event.type} → ${socketCount} sockets`);

// 5. Client receives
console.log(`[Client] Received ${event.type}`, event.payload);

// 6. Client updates state
console.log(`[Client] State after ${event.type}:`, relevantState);
```

### Boundary Logging Template

```typescript
// Add to every command handler:
private async handleXxx(ws: WebSocket, data: any, state: ConnectionState): Promise<void> {
  const playerId = state.playerId;
  console.log(`[GameRoom] handle${Xxx} called for player: ${playerId}`);
  console.log(`[GameRoom] Current state:`, {
    phase: this.gameState?.phase,
    currentPlayer: this.gameState?.currentPlayerId,
    // ... relevant state
  });
  
  // ... validation ...
  
  if (!isValid) {
    console.log(`[GameRoom] handle${Xxx} validation FAILED:`, reason);
    this.sendError(ws, 'XXX_FAILED', reason);
    return;
  }
  
  console.log(`[GameRoom] handle${Xxx} validation PASSED`);
  
  // ... action ...
  
  console.log(`[GameRoom] handle${Xxx} complete, broadcasting`);
  this.broadcast({ type: 'XXX_RESULT', payload });
}
```

---

## Post-Development Audit Checklist

### Before deploying, verify:

#### Layer Alignment Check
- [ ] Expected UX document exists and is current
- [ ] Architecture diagram matches implementation
- [ ] All events in architecture are implemented
- [ ] All validation rules in contracts are implemented
- [ ] All defaults in codebase are documented and intentional

#### Boundary Test
For each user action in the flow:
- [ ] Send the command with valid data → receive expected response
- [ ] Send the command with invalid data → receive error (not silence)
- [ ] Verify no state gets stuck (timeouts, loading states)

#### Log Audit
With logging enabled, trace through the complete flow:
- [ ] Every step produces expected log entry
- [ ] No gaps in the trail
- [ ] No unexpected branches

---

## Agentic Development Guidelines

When an AI agent is implementing features, it should:

### 1. Request the Expected UX First
Before writing code, the agent should ask:
> "What should the user see and experience at each step of this feature?"

### 2. Produce Architecture Before Implementation
The agent should produce:
- State machine diagram
- Event flow diagram
- Component responsibility list

And get human approval before coding.

### 3. Document Contracts Before Functions
For each function that will be written:
- Input shape
- Output shape
- Validation rules
- Error cases

### 4. Map to Codebase
Before editing files, produce:
- Which files will be modified
- Which functions will be added/changed
- Which existing behaviors might be affected

### 5. Add Boundary Logging
Every command handler and event processor gets logging that shows:
- What was received
- What was validated
- What was decided
- What was sent

### 6. Test the Trail
After implementation, trace through with logging enabled and verify no gaps.

---

## Template: Feature Specification Document

```markdown
# Feature: [Name]

## 1. Expected UX

### User Story
As a [user type], I want to [action], so that [outcome].

### Step-by-Step Experience
1. User does X
   - Sees: [what appears]
   - Duration: [time expectation]
   - Error case: [what happens if it fails]

2. User does Y
   - ...

## 2. Architecture

### State Machine
[diagram]

### Event Flow
[sequence diagram]

### Component Responsibilities
| Component | Responsibility |
|-----------|----------------|
| ... | ... |

## 3. Functionality Contracts

### Command: [NAME]
```typescript
// Shape
// Validation
// Response
```

### Event: [NAME]
```typescript
// Shape
// When sent
// How client handles
```

### Defaults (EXPLICIT)
| Location | Default | Rationale |
|----------|---------|-----------|

## 4. Codebase Mapping

### Files to Modify
| File | Changes |
|------|---------|
| ... | ... |

### Tests to Add
| Test | Verifies |
|------|----------|
| ... | ... |

## 5. Logging Points
| Location | Log Entry |
|----------|-----------|
| ... | ... |
```

---

## Applying This to Dicee: Lessons Learned

### Bug: AI Scores Without Rolling

**Layer gap**: Functionality → Codebase

**What was missing**: No contract specified what `context.dice` should be when player hasn't rolled. The default `[1,1,1,1,1]` was added for convenience but violated the implicit contract that "null dice means must roll."

**Prevention**: Explicit contract:
```typescript
// context.dice
// - null: Player has not rolled this turn, MUST return action='roll'
// - DiceArray: Player has rolled, can keep or score
```

### Bug: Waiting Room Flash

**Layer gap**: Architecture → Functionality

**What was missing**: Architecture said "Quick Play skips waiting room" but no component was told this. The routing logic in MultiplayerGameView didn't know about Quick Play mode.

**Prevention**: Component responsibility matrix:
```
| Component | Quick Play Behavior |
|-----------|---------------------|
| MultiplayerGameView | Show loading, not waiting room |
```

### Bug: Button Unresponsive

**Layer gap**: Functionality → Codebase

**What was missing**: Contract for QUICK_PLAY_STARTED didn't specify that `rollsRemaining` must be included. The mapped payload omitted it.

**Prevention**: Explicit payload contract with all required fields marked.

### Bug: Stuck at ROLLING...

**Layer gap**: Architecture → Functionality

**What was missing**: Error handling contract. When validation fails, what happens? The server sent nothing, client waited forever.

**Prevention**: 
1. Contract: "Every command gets a response or error within 5s"
2. Logging: "Validation failed" log entry
3. Client: Timeout that shows error after 5s

---

## Summary

The audit workflow ensures alignment between:

1. **What users expect** (Expected UX)
2. **How the system is designed** (Architecture)
3. **What the code promises** (Functionality Contracts)
4. **What the code does** (Codebase)

By documenting each layer and verifying alignment before, during, and after development, bugs that would otherwise require painful debugging cycles are caught at design time.

The key insight: **Every implicit assumption is a bug waiting to happen.** Make everything explicit.