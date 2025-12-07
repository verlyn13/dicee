# Verify Task Workflow

**Command**: `/verify-task`
**Purpose**: Verify a completed task meets all quality requirements including AKG compliance

## Steps

1. **Read task verification requirements**
   - Check `.claude/state/current-phase.json` for task details
   - Identify acceptance criteria
   - Note any specific test requirements

2. **Run quality checks**
   ```bash
   # TypeScript + Svelte check
   pnpm check
   
   # Lint check
   pnpm biome:check
   
   # Run tests
   pnpm web:vitest
   
   # AKG architectural invariants
   pnpm akg:check
   ```

3. **Verify AKG compliance**
   - Use `akg_invariant_status` to check all invariants
   - If any invariants fail, identify the violation and fix
   - Common issues:
     - Component importing store (layer violation)
     - Circular dependencies
     - Wrong file naming convention

4. **Manual verification** (if applicable)
   - Check UI renders correctly
   - Test user interactions
   - Verify responsive behavior

5. **Update task status**
   - Mark task as `complete` in `.claude/state/current-phase.json`
   - Update `lastUpdated` timestamp
   - Clear any `retryCount` if present

6. **Report results**
   ```markdown
   ## Task Verification: [task-id]
   
   **Status**: ✅ Complete / ❌ Failed
   
   **Checks**:
   - [x] TypeScript: Pass
   - [x] Biome lint: Pass
   - [x] Tests: Pass (X passing)
   - [x] AKG invariants: Pass (6/6)
   
   **Notes**: [any observations]
   
   **Next task**: [if dependencies clear]
   ```

## AKG Invariant Check Details

When running `akg_invariant_status`, verify these pass:

| Invariant | What it checks |
|-----------|----------------|
| `wasm_single_entry` | Only engine.ts imports WASM |
| `store_no_circular_deps` | No circular store dependencies |
| `layer_component_isolation` | Components don't import stores |
| `service_layer_boundaries` | Services don't import UI |
| `store_file_naming` | Stores use .svelte.ts extension |
| `callback_prop_naming` | Callbacks use onVerb pattern |

## If Verification Fails

1. **Identify the specific failure**
2. **Check if it's a real issue or false positive**
3. **Fix the issue** (don't just suppress warnings)
4. **Re-run verification**
5. **If stuck after 3 attempts**: STOP and ask human

## Quick Verification Command

```bash
# All-in-one verification
pnpm check && pnpm biome:check && pnpm web:vitest && pnpm akg:check
```
