# Domain Migration Plan: jefahnierocks.com → dicee.games

## Executive Summary

This report documents all changes required to migrate from `gamelobby.jefahnierocks.com` to the new domain `dicee.games`. The migration includes:
- **Domain change**: `gamelobby.jefahnierocks.com` → `dicee.games`
- **Worker rename**: `gamelobby` → `dicee`
- **Legacy handling**: Delete old DNS records (no redirects needed - family-only usage)
- **WWW**: Redirect `www.dicee.games` → `dicee.games` (clean apex-only)

**Risk Level**: Low (family-only app, fresh DO data is acceptable)

### Critical Sequencing
1. **Complete Phase 1 (OAuth/Supabase) BEFORE deploying code** - callbacks will fail otherwise
2. **Wait 5-10 min for DNS propagation** before testing
3. **Triple-check all 3 service binding updates** in `packages/web/wrangler.toml` (lines 21, 40, 49)
4. **Migrate when no one is mid-game** - DO fresh start loses in-progress games

---

## Target State

| Component | Current | Target |
|-----------|---------|--------|
| Production URL | `gamelobby.jefahnierocks.com` | `dicee.games` |
| Worker Name | `gamelobby` | `dicee` |
| Pages Project | `dicee` | `dicee` (unchanged) |
| Service Binding | `GAME_WORKER` → `gamelobby` | `GAME_WORKER` → `dicee` |

---

## Current State

| Component | Current Value |
|-----------|---------------|
| Production URL | `https://gamelobby.jefahnierocks.com` |
| Legacy URL | `https://dicee.jefahnierocks.com` (redirects) |
| Pages Project | `dicee` |
| Worker Name | `gamelobby` |
| Zone | `jefahnierocks.com` (Zone ID: `8d5f44e67ab4b37e47b034ff48b03099`) |
| Cloudflare Account | `13eb584192d9cefb730fde0cfd271328` |

---

## Phase 1: Pre-Migration (External Services)

### 1.1 Cloudflare DNS for dicee.games

**Action**: Configure DNS in Cloudflare (new zone)

```
dicee.games → CNAME → dicee.pages.dev
www.dicee.games → CNAME → dicee.pages.dev
```

**Location**: Cloudflare Dashboard → dicee.games zone → DNS

### 1.2 Cloudflare Pages Custom Domain

**Action**: Add `dicee.games` as custom domain to Pages project

**Location**: Cloudflare Dashboard → Pages → dicee → Custom domains → Add domain

**Steps**:
1. Add `dicee.games`
2. Add `www.dicee.games`
3. SSL/TLS auto-provisioned by Cloudflare

### 1.3 Supabase Auth Configuration

**Action**: Add new domain to authorized redirect URLs

**Location**: [Supabase Dashboard](https://supabase.com/dashboard/project/duhsbuyxyppgbkwbbtqg/auth/url-configuration)

**Current Redirect URLs**:
```
https://gamelobby.jefahnierocks.com/auth/callback
http://localhost:5173/auth/callback
http://localhost:8788/auth/callback
```

**Add**:
```
https://dicee.games/auth/callback
https://www.dicee.games/auth/callback
```

**Site URL**: Update to `https://dicee.games`

### 1.4 Google OAuth Configuration

**Action**: Add new domain to OAuth client

**Location**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=dicee-480100)

**OAuth 2.0 Client IDs → Web client**:

**Authorized JavaScript origins** - Add:
```
https://dicee.games
https://www.dicee.games
```

**Authorized redirect URIs** - No change needed (uses Supabase callback):
```
https://duhsbuyxyppgbkwbbtqg.supabase.co/auth/v1/callback
```

**OAuth consent screen → Authorized domains** - Add:
```
dicee.games
```

---

## Phase 2: Code Changes

### 2.1 Worker Rename (Required)

**File**: `packages/cloudflare-do/wrangler.toml:4`

**Current**:
```toml
name = "gamelobby"
```

**Change to**:
```toml
name = "dicee"
```

### 2.2 Service Binding Update (Required)

**File**: `packages/web/wrangler.toml` (lines 21, 40, 49)

**Current**:
```toml
[[services]]
binding = "GAME_WORKER"
service = "gamelobby"
```

**Change to**:
```toml
[[services]]
binding = "GAME_WORKER"
service = "dicee"
```

**Note**: Update in all 3 environment sections (default, preview, production)

### 2.3 Worker Frontend URL (Required)

**File**: `packages/cloudflare-do/src/worker.ts:33`

**Current**:
```typescript
frontend: 'https://gamelobby.jefahnierocks.com',
```

**Change to**:
```typescript
frontend: 'https://dicee.games',
```

### 2.4 Test File Updates

**File**: `packages/cloudflare-do/src/__tests__/worker.integration.test.ts:163`

**Current**:
```typescript
Origin: 'https://dicee.jefahnierocks.com'
```

**Change to**:
```typescript
Origin: 'https://dicee.games'
```

---

## Phase 3: Documentation Updates

### 3.1 Project Documentation (50+ files)

| File | Lines | Type |
|------|-------|------|
| `README.md` | 5 | Production URL |
| `CLAUDE.md` | 50, 230, 243, 264, 523+ | Multiple references |
| `CODEX.md` | 9 | Production URL |
| `WINDSURF.md` | 36, 267 | Production URL |
| `.windsurfrules` | 6 | Production URL |

### 3.2 Configuration Documentation

| File | Lines |
|------|-------|
| `.claude/environment-strategy.yaml` | 4, 49, 162, 192, 213, 214 |
| `.claude/auth-strategy.yaml` | 54, 65-66, 259-263 |
| `.claude/cli-reference.yaml` | 20-22 |
| `.claude/gopass-structure.yaml` | 189-191 |

### 3.3 Architecture Documentation

| File | Lines |
|------|-------|
| `docs/deployment-checklist.md` | 99-120 |
| `docs/testing/ANDROID-TESTING-WORKFLOW.md` | 156, 159 |
| `docs/archive/migration-guides/*.md` | Multiple |
| `docs/planning/observability-plan.md` | Multiple |

### 3.4 AKG Diagram JSON Schema URLs

| File | Change |
|------|--------|
| `docs/architecture/akg/diagrams/DATAFLOW.json` | `$schema` URL |
| `docs/architecture/akg/diagrams/LAYER_ARCHITECTURE.json` | `$schema` URL |
| `docs/architecture/akg/diagrams/COMPONENT_DEPENDENCIES.json` | `$schema` URL |
| `docs/architecture/akg/diagrams/STORE_DEPENDENCIES.json` | `$schema` URL |

### 3.5 Scripts

| File | Lines |
|------|-------|
| `scripts/setup-gopass-credentials.sh` | 58-59 |
| `scripts/quality-gate.sh` | 115 (Infisical domain unchanged) |
| `packages/web/scripts/cdp-console-monitor.mjs` | 49, 51, 316 |

### 3.6 Type Definitions

| File | Lines |
|------|-------|
| `packages/web/src/lib/types/device-testing.schema.ts` | 918 |

---

## Phase 4: Deployment

### 4.1 Deployment Order (Critical - Follow Exactly)

**⚠️ Worker rename requires coordinated deployment to avoid downtime**

1. **Step 1**: Update external services (Supabase, Google OAuth)
2. **Step 2**: Add `dicee.games` custom domain to Cloudflare Pages
3. **Step 3**: Deploy **new worker** with name `dicee` first
   ```bash
   cd packages/cloudflare-do
   wrangler deploy  # Deploys as 'dicee' (after wrangler.toml rename)
   ```
4. **Step 4**: Deploy Pages with updated service binding
   ```bash
   pnpm build
   wrangler pages deploy .svelte-kit/cloudflare --project-name=dicee
   ```
5. **Step 5**: Delete old `gamelobby` worker (optional, after verification)
   ```bash
   wrangler delete gamelobby
   ```
6. **Step 6**: Set up 301 redirects (see Phase 5)
7. **Step 7**: Update documentation (can be batched)

### 4.2 Verification Commands

```bash
# Verify new domain
curl https://dicee.games/health
wscat -c wss://dicee.games/ws/lobby

# Verify worker info endpoint
curl https://dicee.games/ | jq .frontend
# Should return: "https://dicee.games"
```

### 4.3 Durable Object Data Migration

**Note**: Renaming the worker creates a NEW worker with fresh DO storage.

**Existing Data**:
- Game rooms and lobby state in `gamelobby` worker's DO storage
- Will need to be manually migrated OR users create new rooms

**Options**:
1. **Fresh start** (recommended for non-production): Accept data loss
2. **Keep old worker read-only**: Point new domain to new worker, keep old for data export
3. **Migrate storage**: Export/import DO SQLite data (complex)

---

## Phase 5: Post-Migration Cleanup

### 5.1 WWW Redirect (dicee.games zone)

**Location**: Cloudflare Dashboard → dicee.games → Rules → Redirect Rules

**Create Rule**:
```
Name: www to apex
When: Hostname equals "www.dicee.games"
Then: Dynamic redirect to "https://dicee.games${http.request.uri.path}"
Status code: 301 (Permanent)
```

### 5.2 Delete Old Resources (No Redirects Needed)

**Family-only usage** - no external bookmarks to preserve.

1. **Delete old worker immediately after verification**:
   ```bash
   wrangler delete gamelobby
   ```

2. **Remove old domains from Pages**:
   - Cloudflare Dashboard → Pages → dicee → Custom domains
   - Remove `gamelobby.jefahnierocks.com`
   - Remove `dicee.jefahnierocks.com`

3. **Delete DNS records** (jefahnierocks.com zone):
   - Remove CNAME for `gamelobby`
   - Remove CNAME for `dicee`

### 5.3 Local Credential Updates

```bash
echo "dicee.games" | gopass insert -f dicee/cloudflare/domain
gopass rm dicee/cloudflare/subdomain
```

### 5.4 Android Device Cleanup

**If testing on Android**: Clear app data or reinstall after migration. Cached URLs/tokens pointing to old domain will cause issues.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| OAuth fails on new domain | Low | Add new domain BEFORE code deployment |
| WebSocket connections fail | Very Low | Uses `location.host` (dynamic) |
| CORS errors | Very Low | Cloudflare handles automatically |
| SSL/TLS issues | Very Low | Auto-provisioned by Cloudflare |
| Cookie domain mismatch | None | Supabase SDK handles automatically |

---

## Rollback Plan

If issues occur:
1. Remove new domain from Pages custom domains
2. Old domain remains active (no downtime)
3. Revert code change in `worker.ts`
4. Auth continues working on old domain

---

## Verification Checklist

### Pre-Cutover
- [ ] DNS propagated: `dig dicee.games +short` shows Cloudflare IPs
- [ ] SSL certificate active (Cloudflare auto-provisions)
- [ ] Supabase redirect URLs updated (wait a few minutes)
- [ ] Google OAuth origins updated

### Post-Cutover (Test in This Order)

**Test order is diagnostic**: If OAuth fails but 1-2 pass, issue is external config, not code.

1. [ ] **Health endpoint**: `curl https://dicee.games/health` returns 200
2. [ ] **WebSocket**: `wscat -c wss://dicee.games/ws/lobby` connects
3. [ ] **OAuth login**: Google sign-in completes without redirect errors
4. [ ] Game room creation/joining works
5. [ ] Chat messages persist across refresh

---

## Files Modified (Summary)

### Code (Required)
| File | Lines | Change |
|------|-------|--------|
| `packages/cloudflare-do/wrangler.toml` | 4 | Worker name: `gamelobby` → `dicee` |
| `packages/web/wrangler.toml` | 21, 40, 49 | Service binding: `gamelobby` → `dicee` |
| `packages/cloudflare-do/src/worker.ts` | 33 | Frontend URL |
| `packages/cloudflare-do/src/__tests__/worker.integration.test.ts` | 163 | Test origin |

### Documentation (Batch Update)
~50 files with domain references (see Phase 3)

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Worker name | Rename to `dicee` | Clean naming, matches domain |
| Legacy domains | Delete DNS records (no redirects) | Family-only usage, no external bookmarks |
| Old worker | Delete immediately after verification | No reason to keep it around |
| WWW subdomain | Redirect to apex | Simple, modern, no cookie issues |
| DO data | Fresh start | Non-production, acceptable data loss |
| Infisical domain | Keep `infisical.jefahnierocks.com` | Infrastructure unchanged |

---

## Implementation Checklist

### Phase 1: External Services (Do First - Wait Before Deploying)
- [ ] Supabase: Add `https://dicee.games/auth/callback` to redirect URLs
- [ ] Supabase: Update Site URL to `https://dicee.games`
- [ ] Google OAuth: Add `dicee.games` to authorized domains
- [ ] Google OAuth: Add `https://dicee.games` to authorized origins
- [ ] **Wait a few minutes for changes to propagate**

### Phase 1b: Cloudflare DNS & Pages
- [ ] dicee.games zone: Add DNS record (CNAME `@` → `dicee.pages.dev`)
- [ ] dicee.games zone: Add DNS record (CNAME `www` → `dicee.pages.dev`)
- [ ] Pages project: Add `dicee.games` custom domain
- [ ] Verify: `dig dicee.games +short` returns Cloudflare IPs

### Phase 2: Code Changes
- [ ] `packages/cloudflare-do/wrangler.toml`: name = "dicee"
- [ ] `packages/web/wrangler.toml`: service = "dicee" (**3 places: lines 21, 40, 49**)
- [ ] `packages/cloudflare-do/src/worker.ts`: frontend URL
- [ ] `packages/cloudflare-do/src/__tests__/`: test origins

### Phase 4: Deployment (Coordinate Timing)
- [ ] Deploy worker: `cd packages/cloudflare-do && wrangler deploy`
- [ ] Deploy Pages: `pnpm build && wrangler pages deploy .svelte-kit/cloudflare --project-name=dicee`
- [ ] Verify health: `curl https://dicee.games/health`
- [ ] Verify WebSocket: `wscat -c wss://dicee.games/ws/lobby`
- [ ] Verify OAuth: Sign in with Google succeeds

### Phase 5: Cleanup
- [ ] Delete old worker: `wrangler delete gamelobby`
- [ ] Remove old domains from Pages (gamelobby.jefahnierocks.com, dicee.jefahnierocks.com)
- [ ] Delete old DNS records from jefahnierocks.com zone
- [ ] dicee.games zone: Create www→apex redirect rule
- [ ] Update gopass credentials
- [ ] Update documentation files (batch later)
- [ ] Clear Android app data if testing on Android
