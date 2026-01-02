# Dicee Deployment Checklist

## Overview

Dicee uses a two-part deployment:
1. **Cloudflare Workers** (Durable Objects) - Game state, WebSockets
2. **Cloudflare Pages** (SvelteKit) - Frontend with Service Binding to Worker

## Prerequisites

### GitHub Secrets Required

| Secret | Description | Where to Get |
|--------|-------------|--------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers/Pages permissions | Cloudflare Dashboard → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard → Overview |
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (for Worker) | Supabase Dashboard → Settings → API |
| `PUBLIC_SUPABASE_ANON_KEY` | Same as above (for Pages build) | Same as above |

### Cloudflare API Token Permissions

Create a custom token with:
- **Account** → Workers Scripts → Edit
- **Account** → Workers KV Storage → Edit
- **Account** → Workers R2 Storage → Edit (if using R2)
- **Account** → Cloudflare Pages → Edit
- **Zone** → Workers Routes → Edit (if using custom domains)

## Deployment Order

The CI/CD pipeline deploys in this order:

```
1. rust (tests)
2. wasm (build)
3. web (tests) ──────────┐
4. cloudflare-do (tests) │
5. akg (architecture) ───┤
                         ▼
6. deploy-worker (DO to Cloudflare)
                         │
                         ▼
7. deploy-pages (SvelteKit to Pages)
```

**Important**: Worker must deploy before Pages because Pages uses Service Binding to the Worker.

## Manual Deployment

### Deploy Worker (Durable Objects)

```bash
cd packages/cloudflare-do

# Set secrets (first time only)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY

# Deploy to production
wrangler deploy --env production
```

### Deploy Pages (SvelteKit)

```bash
cd packages/web

# Build
pnpm build

# Deploy to production
wrangler pages deploy .svelte-kit/cloudflare --project-name=dicee
```

## Environment Configuration

### Worker Environments

| Environment | Command | Notes |
|-------------|---------|-------|
| Development | `wrangler dev` | Local with hot reload |
| Staging | `wrangler deploy --env staging` | Preview environment |
| Production | `wrangler deploy --env production` | Live site |

### Pages Environments

| Environment | Trigger | Notes |
|-------------|---------|-------|
| Preview | PR branches | Auto-deployed |
| Production | `main` branch | Auto-deployed via CI |

## Domain Configuration

### Current Setup

| Domain | Target |
|--------|--------|
| `dicee.games` | Cloudflare Pages (main site) |

### Custom Domain Setup

1. Go to Cloudflare Dashboard → Pages → dicee
2. Click "Custom domains"
3. Add `dicee.games`
4. DNS will be auto-configured

## Verification Steps

After deployment, verify:

### 1. Worker Health
```bash
# Check worker is responding
curl https://dicee.games/api/health
```

### 2. WebSocket Connection
- Open browser to `https://dicee.games`
- Open DevTools → Network → WS
- Create/join a room
- Verify WebSocket connects to Worker

### 3. Game Flow
- [ ] Can create a room
- [ ] Can join a room with code
- [ ] Can start game (host)
- [ ] Dice roll works
- [ ] Keep/release dice works
- [ ] Scoring works
- [ ] Turn advancement works
- [ ] Game over shows rankings

### 4. AI Players (Phase 12)
- [ ] AI opponent selector appears
- [ ] Can select AI profile
- [ ] AI takes turns correctly
- [ ] AI chat messages appear

## Rollback

### Rollback Worker
```bash
# List deployments
wrangler deployments list

# Rollback to previous
wrangler rollback
```

### Rollback Pages
- Go to Cloudflare Dashboard → Pages → dicee → Deployments
- Click on previous deployment
- Click "Rollback to this deployment"

## Monitoring

### Cloudflare Analytics
- Workers → Analytics → dicee
- Pages → Analytics → dicee

### Logs
```bash
# Stream worker logs
wrangler tail --env production
```

## Troubleshooting

### Service Binding Not Working
- Ensure Worker deployed before Pages
- Check `wrangler.toml` service binding name matches
- Verify Worker is in same Cloudflare account

### WebSocket Disconnects
- Check Durable Object hibernation settings
- Verify `webSocketClose` handler in GameRoom
- Check client reconnection logic

### Supabase Auth Failing
- Verify `SUPABASE_URL` secret is set
- Verify `SUPABASE_ANON_KEY` secret is set
- Check JWT verification in Worker

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) handles:

1. **Rust Tests** - Engine unit tests, property tests (uses `dtolnay/rust-toolchain@stable`)
2. **WASM Build** - Build and size check (150KB limit) - adds `wasm32-unknown-unknown` target
3. **Web Tests** - TypeScript, Svelte, Vitest
4. **DO Tests** - Cloudflare DO unit tests
5. **AKG Checks** - Architecture validation
6. **Deploy Worker** - Durable Objects to Cloudflare
7. **Deploy Pages** - SvelteKit to Cloudflare Pages

All jobs must pass before deployment proceeds.
