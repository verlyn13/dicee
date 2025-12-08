# Dicee Agent Guardrails

> **Version**: 1.1.0
> **Date**: 2025-12-07
> **Purpose**: Mandatory rules for ALL agents working on this project
> **Architecture**: Unified Cloudflare stack (Pages + Workers via Service Bindings)

---

## The Three Strikes Rule (MANDATORY)

**If you fail at the same operation 3 times, you MUST STOP and ask the human.**

This applies to:
- Command failures (build, test, lint, etc.)
- File operations that error
- API calls that fail
- Any repeated unsuccessful attempt at the same goal

### How to Count Attempts

An "attempt" is trying to accomplish a specific goal. Examples:

| Goal | Attempt 1 | Attempt 2 | Attempt 3 | Action |
|------|-----------|-----------|-----------|--------|
| Fix test failure | Edit code | Edit code again | Same test still fails | **STOP - Ask human** |
| Run build | Build fails | Fix error, build fails | Same or new error | **STOP - Ask human** |
| Create file | Permission error | Try different path | Still fails | **STOP - Ask human** |

### What to Do on Strike 3

```markdown
## I Need Human Help

**Goal**: [what you were trying to do]

**What I tried**:
1. [First attempt and result]
2. [Second attempt and result]
3. [Third attempt and result]

**My analysis**: [what you think is wrong]

**Options I see**:
- [Option A]
- [Option B]
- [Or: I'm stuck and don't know how to proceed]

Please advise on how to proceed.
```

---

## Before Starting ANY Task

### 1. Verify You Understand the Task

Ask yourself:
- What is the expected outcome?
- What files will I need to read/modify?
- What tests/checks will verify success?

If unclear on ANY of these → **Ask the human first**

### 2. Check Current State

```bash
# Run /status command or read state files
cat .claude/state/current-phase.json
cat .claude/state/session-handoff.md
```

### 3. Verify Prerequisites

- Is this task assigned to me?
- Are dependencies complete?
- Do I have the context I need?

---

## Agent Competency Boundaries

### Claude Code (Opus 4.5) - Can Do

- Architecture decisions
- Complex debugging
- Multi-file refactoring
- Database/API design
- Test infrastructure
- Integration work
- **Break down tasks for other agents**

### Claude Code (Sonnet/Haiku) - Can Do

- Single-file edits with clear instructions
- Running pre-defined commands
- Following explicit step-by-step guides
- Simple bug fixes with clear reproduction
- **Ask for clarification when unsure**

### Windsurf/Cascade - Can Do

- UI component implementation
- CSS/styling work
- Svelte component development
- Visual polish

### What Lesser Agents Should NOT Attempt

- Architecture decisions (escalate to Opus or human)
- Complex multi-file refactoring without explicit instructions
- Database schema changes without explicit approval
- Security-sensitive code changes
- Anything involving secrets or credentials

---

## Task Execution Protocol

### Step 1: Read Before Edit

**NEVER edit a file you haven't read in this session.**

```typescript
// WRONG - editing blind
Edit file X without reading it first

// RIGHT - read then edit
Read file X
Understand the code
Edit file X
```

### Step 2: One Change at a Time

Make the smallest possible change, then verify:

```bash
# After each edit:
pnpm typecheck   # Types still pass?
pnpm lint        # Lint still clean?
pnpm test        # Tests still pass?
```

### Step 3: Verify Before Moving On

Before marking a task complete:

1. Run relevant tests
2. Check for TypeScript errors
3. Verify the feature works as expected
4. Update state files

---

## Error Recovery Protocol

### Build Failure

```
1. Read the FULL error message
2. Identify the specific file and line
3. Read that file around the error
4. Make ONE targeted fix
5. Run build again
6. If same error after 3 attempts → STOP, ask human
```

### Test Failure

```
1. Run the specific failing test with verbose output
2. Read the test file to understand expected behavior
3. Read the source file being tested
4. Make ONE targeted fix
5. Run test again
6. If same failure after 3 attempts → STOP, ask human
```

### Unknown Error

```
1. Copy the EXACT error message
2. Search codebase for similar patterns
3. Check documentation
4. If still unclear → STOP, ask human (don't guess)
```

---

## Communication Protocol

### When to Report Progress

- After completing each task
- When hitting a blocker
- Before making architectural decisions
- When uncertain about approach

### How to Report

```markdown
## Task Update

**Task**: [task ID or description]
**Status**: [completed/in-progress/blocked]

**What I did**:
- [Action 1]
- [Action 2]

**Verification**:
- [x] Tests pass
- [x] Build succeeds
- [x] Lint clean

**Next step**: [what comes next]
```

### When to Ask Permission

Always ask before:
- Deleting files
- Changing database schema
- Modifying auth/security code
- Making breaking API changes
- Installing new dependencies

---

## Cloudflare Deployment Safety

### Production URL: gamelobby.jefahnierocks.com

The project uses a unified Cloudflare stack:
- **CF Pages**: SvelteKit frontend
- **CF Workers**: Durable Objects (GlobalLobby, GameRoom)
- **Service Bindings**: Zero-latency RPC between Pages and Workers

### Deployment Commands - Safety Matrix

| Command | Environment | Risk | Requires |
|---------|-------------|------|----------|
| `wrangler pages dev` | Local | Safe | — |
| `wrangler dev` | Local | Safe | — |
| `wrangler pages deploy` (PR) | Preview | Safe | — |
| `wrangler pages deploy --branch main` | **Production** | **High** | Human approval |
| `wrangler deploy` | **Production** | **High** | Human approval |
| `wrangler deploy --env staging` | Staging | Medium | Caution |

### Before Any Production Deployment

1. **Verify tests pass**: `pnpm test && pnpm test:e2e`
2. **Verify build succeeds**: `pnpm build`
3. **Run quality gate**: `./scripts/quality-gate.sh`
4. **Get human approval**

### Wrangler Safety Rules

```bash
# ✅ SAFE: Local development
wrangler pages dev .svelte-kit/cloudflare --compatibility-flags=nodejs_compat
wrangler dev                               # Local DO development

# ✅ SAFE: Preview deployments (PR branches)
wrangler pages deploy .svelte-kit/cloudflare --project-name gamelobby-pages

# ⚠️ CAUTION: Staging
wrangler deploy --env staging

# ❌ REQUIRES APPROVAL: Production
# Do NOT run these without human approval:
wrangler pages deploy .svelte-kit/cloudflare --project-name gamelobby-pages --branch main
wrangler deploy                            # Production workers
```

### Service Binding Safety

When modifying service binding code in SvelteKit:

1. **Test locally first** with `wrangler pages dev`
2. **Verify binding access** works in `platform.env.GAME_WORKER`
3. **Handle missing binding gracefully** (required for Vite dev mode)

```typescript
// Always check for binding availability
const stub = platform?.env.GAME_WORKER;
if (!stub) {
    // Return mock data or error - don't crash
    return new Response('Service unavailable', { status: 503 });
}
```

### Durable Object Migration Safety

When adding new Durable Object classes:

1. **Never rename existing DO classes** in production (data loss)
2. **Always add migrations** in wrangler.toml before deploy
3. **Test migration locally** first with `wrangler dev --remote`
4. **Verify DO has correct [[durable_objects.bindings]]** entry

---

## State Management

### After Completing a Task

1. Update `current-phase.json` task status to "complete"
2. Add verification notes
3. Update handoff notes if relevant

### Before Ending Session

1. Update all state files
2. Write clear handoff notes
3. Commit any completed work

### State File Locations

```
.claude/state/
├── current-phase.json    # Task tracking
├── session-handoff.md    # Handoff notes
├── blockers.json         # Current blockers
└── decisions.json        # Decisions made
```

---

## Quality Checklist (Before Any Commit)

```markdown
- [ ] All tests pass: `pnpm test`
- [ ] No lint errors: `pnpm lint`
- [ ] TypeScript clean: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`
- [ ] No hardcoded secrets
- [ ] Changes match task requirements
- [ ] State files updated
```

### Lint Quick Fixes (Biome 2.3)

| Error | Cause | Fix |
|-------|-------|-----|
| `noExplicitAny` in test | Mock typing | Already "warn" for test files - ignore |
| `noUnusedVariables` for Promise resolver | `let resolve; new Promise(r => resolve = r)` | Simplify to `new Promise(() => {})` if unused |
| `useIterableCallbackReturn` | `forEach(x => fn(x))` returns value | Add braces: `forEach(x => { fn(x); })` |
| `suppressions/unused` | biome-ignore for disabled rule | Remove the biome-ignore comment |
| `noUnusedImports` after edit | Removed code, import remains | Remove unused import |

**Pro tip**: Run `pnpm biome:check` standalone before commit to debug - lefthook output has color codes that obscure errors.

---

## Escalation Matrix

| Situation | Action |
|-----------|--------|
| 3 failed attempts at same goal | **STOP** - Ask human |
| Unsure about approach | Ask human before proceeding |
| Need architecture decision | Escalate to Opus or human |
| Security/auth changes | Always get human approval |
| Conflicting requirements | Ask human for clarification |
| Missing prerequisites | Report blocker, wait for human |
| Test suite timing out | Report issue, don't retry infinitely |
| **Production deployment** | **Always get human approval** |
| Wrangler deploy failure | Check wrangler.toml config, ask if unclear |
| Service binding errors | Test locally first, escalate if persistent |
| DO migration changes | Always get human approval |

---

## Example: Good Agent Behavior

```
Session Start:
1. Read current-phase.json → "Phase 3, task profile-1"
2. Read session-handoff.md → Understand context
3. Read task details → Create Profile API functions
4. Read existing code patterns → packages/web/src/lib/supabase/
5. Implement following patterns
6. Run tests → Pass
7. Update state files
8. Write handoff notes

If test fails:
- Attempt 1: Fix the obvious issue
- Attempt 2: Read test more carefully, fix
- Attempt 3: Still failing → STOP

"I've tried 3 times to fix this test. Here's what I tried..."
```

---

## TypeScript & Type Safety Guardrails

> See `.claude/typescript-biome-strategy.md` for full documentation

### Absolute Rules

1. **Never use `any`** - Use `unknown` and type guards instead
2. **Never use `// @ts-ignore`** - Fix the underlying type issue
3. **Never use `as unknown as X`** - This indicates a design problem
4. **Always run `pnpm check` after edits** - TypeScript errors must be fixed immediately

### Type Patterns to Follow

```typescript
// ✅ GOOD: Const arrays with derived types
export const CATEGORIES = ['A', 'B', 'C'] as const;
export type Category = (typeof CATEGORIES)[number];

// ✅ GOOD: Supabase table types
import type { Tables } from '$lib/types/database';
type Profile = Tables<'profiles'>;

// ✅ GOOD: Result pattern for API calls
type Result<T> = { data: T | null; error: Error | null };

// ✅ GOOD: Type guard for narrowing
function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}
```

### Anti-Patterns to Reject

```typescript
// ❌ BAD: any type
(auth as any).__setLoading(true);

// ❌ BAD: Double assertion
players as unknown as SomeType[];

// ❌ BAD: Non-null assertion in logic
user!.id  // What if user is null?

// ❌ BAD: Implicit any
data.map(item => item.name);  // item is any
```

### When Type Errors Occur

1. **Read the full error** - Understand what TypeScript is telling you
2. **Check if the type is correct** - Maybe the code is wrong, not the type
3. **Add proper type guards** - Narrow types at runtime
4. **Ask for help** if:
   - Error requires `as unknown as X`
   - Generic types have 3+ levels of nesting
   - You don't understand why the type is wrong

### Biome Rules (Active)

| Rule | Level | Meaning |
|------|-------|---------|
| `noExplicitAny` | error | No `any` types in production code |
| `noImplicitAnyLet` | error | Uninitialized `let` must have types |
| `noDoubleEquals` | error | Use `===` not `==` |
| `noNonNullAssertion` | warn | Avoid `!` operator |
| `useConst` | error | Use `const` by default |

### Verification Commands

```bash
# After every TypeScript edit:
pnpm check          # TypeScript + Svelte check
pnpm biome:check    # Lint check
pnpm test           # Run tests

# Quick quality gate:
pnpm check && pnpm biome:check && pnpm test
```

---

## Remember

1. **Three strikes = STOP and ask**
2. **Read before edit**
3. **Verify after every change**
4. **When in doubt, ask**
5. **Update state files**
6. **Write clear handoff notes**
7. **Never use `any` - use `unknown` instead**
8. **Run type checks after every edit**
9. **Never deploy to production without human approval**
10. **Test service bindings locally before deploying**

The human prefers to be interrupted early rather than have an agent spin in circles or make things worse.

---

## References

- [Unified Cloudflare Stack](../docs/unified-cloudflare-stack.md) - Architecture migration guide
- [Lobby UX/UI Refactor](../docs/lobby-ux-ui-refactor.md) - UI implementation
- [TypeScript/Biome Strategy](./typescript-biome-strategy.md) - Code patterns
- [CLI Reference](./cli-reference.yaml) - Wrangler commands
