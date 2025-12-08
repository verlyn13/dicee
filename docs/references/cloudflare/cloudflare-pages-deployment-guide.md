---
title: Cloudflare Pages Deployment Guide for SvelteKit
category: guide
component: deployment
status: active
version: 1.0.0
last_updated: 2025-12-07
tags: [cloudflare, deployment, sveltekit, pages, workers]
priority: high
---

# Cloudflare Pages Deployment Guide for SvelteKit

Comprehensive research on deploying SvelteKit applications to Cloudflare Pages, covering adapter configuration, environment variables, custom domains, and integration with Workers.

## 1. Adapter Selection

### Recommended: `@sveltejs/adapter-cloudflare`

**Use this adapter for:**
- Cloudflare Pages with Workers integration
- Cloudflare Workers with static assets
- Modern SvelteKit applications (Svelte 5 compatible)

**Installation:**
```bash
pnpm add -D @sveltejs/adapter-cloudflare
```

**Configuration (svelte.config.js):**
```js
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      // Optional: Configure platform proxy for local dev
      platformProxy: {
        enabled: true,
        configPath: 'wrangler.toml'
      }
    })
  }
};
```

### Deprecated: `@sveltejs/adapter-cloudflare-workers`

Cloudflare no longer recommends Workers Sites. Migrate to `@sveltejs/adapter-cloudflare` instead, which supports Workers Static Assets.

### Key Requirements

1. **Wrangler Configuration**: Create `wrangler.toml` in project root with `compatibility_date = "2025-01-01"`
2. **Wrangler Version**: Use Wrangler 4.x for testing and deployment
3. **Build Output**: Adapter generates `.svelte-kit/cloudflare` directory

### Latest Version

- **Package**: @sveltejs/adapter-cloudflare
- **Version**: 7.2.4 (as of December 2025)
- **NPM**: https://www.npmjs.com/package/@sveltejs/adapter-cloudflare

## 2. Pages Functions Integration

### How Pages Functions Work with SvelteKit

**Important**: Functions in `/functions` directory are **NOT included** in deployment when using the SvelteKit adapter. Instead:

1. **SvelteKit compiles to a single `_worker.js` file**
2. **Server endpoints** (`+server.js`) become the equivalent of Pages Functions
3. **All server-side logic** runs through SvelteKit's request handling

### Implementing Server Endpoints

Instead of Pages Functions `onRequest` handlers:

```ts
// src/routes/api/data/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
  // Access Cloudflare bindings via platform.env
  const value = await platform?.env.MY_KV.get('key');

  return new Response(JSON.stringify({ value }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### Accessing Cloudflare Bindings

The `platform` property provides access to:
- `env` - KV namespaces, D1 databases, Durable Objects, R2 buckets
- `context` - Execution context (waitUntil, passThroughOnException)
- `caches` - Cache API
- `cf` - Request metadata (geolocation, etc.)

**Available in:**
- Server endpoints (`+server.ts`)
- Server load functions (`+page.server.ts`, `+layout.server.ts`)
- Hooks (`hooks.server.ts`)

**TypeScript types:**
```ts
// src/app.d.ts
/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Platform {
      env: {
        MY_KV: KVNamespace;
        MY_D1: D1Database;
        MY_DO: DurableObjectNamespace;
        // Add your bindings here
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
      cf: IncomingRequestCfProperties;
    }
  }
}

export {};
```

### Local Development

Cloudflare bindings are **emulated during dev and preview**:

1. Create `wrangler.toml` with binding configurations
2. Adapter uses `platformProxy` to populate `platform.env`
3. Local bindings work with `wrangler dev`

**Test local build:**
```bash
pnpm build
wrangler pages dev .svelte-kit/cloudflare
```

## 3. Custom Domain Configuration

### Setup Process

**Dashboard Steps:**
1. Go to **Workers & Pages** in Cloudflare dashboard
2. Select your Pages project
3. Navigate to **Custom domains**
4. Select **Set up a domain**
5. Enter your domain and select **Continue**

### Apex Domain (example.com)

**Requirements:**
- Domain must be a **zone on your Cloudflare account**
- Nameservers must point to Cloudflare

**Automatic Setup:**
- Cloudflare creates CNAME record automatically
- DNS must be managed by Cloudflare

### Subdomain (dicee.example.com)

**Two Options:**

**Option 1: Domain as Cloudflare Zone**
- Add domain to Cloudflare account
- Cloudflare manages DNS automatically

**Option 2: External DNS Provider**
- Add CNAME record manually:
  ```
  dicee.example.com  CNAME  <YOUR_PROJECT>.pages.dev
  ```
- Must still add domain through Pages dashboard

**CRITICAL**: Do NOT manually add CNAME without first associating domain in Pages dashboard. This will cause resolution failures.

### Redirecting pages.dev to Custom Domain

Use **Bulk Redirects** to redirect `*.pages.dev` to custom domain:

1. Go to **Traffic** > **Redirects** in dashboard
2. Create bulk redirect rule
3. Source: `<project>.pages.dev/*`
4. Target: `https://your-domain.com/$1`
5. Status: 301 (permanent)

### CAA Records

If you have CAA records, ensure Cloudflare can issue certificates:

```
example.com. CAA 0 issue "letsencrypt.org"
example.com. CAA 0 issue "pki.goog"
example.com. CAA 0 issue "digicert.com"
```

### Propagation Time

- Most domains ready within **minutes**
- Full propagation can take up to **48 hours**

## 4. Service Bindings (Pages + Workers)

### Overview

Service bindings allow Pages Functions to call Workers **without public URLs**:
- Completely internal to Cloudflare network
- No additional costs
- Ultra-low latency
- Can isolate Workers from public Internet

### Use Cases for Dicee

**Current Architecture:**
- Pages: SvelteKit frontend (dicee.jefahnierocks.com)
- Worker: Durable Objects (gamelobby.jefahnierocks.com)

**With Service Bindings:**
```ts
// Server endpoint can call Durable Object Worker directly
export const POST: RequestHandler = async ({ platform, request }) => {
  // Call Worker via service binding (no HTTP overhead)
  const response = await platform?.env.GAME_LOBBY.fetch(request);
  return response;
};
```

### Configuration

**Via Dashboard:**
1. Go to **Workers & Pages** > your Pages project
2. **Settings** > **Bindings** > **Add** > **Service binding**
3. **Variable name**: `GAME_LOBBY` (TypeScript binding name)
4. **Service**: Select your Worker (`gamelobby`)
5. Redeploy project

**Via wrangler.toml:**
```toml
name = "dicee-pages"

[[services]]
binding = "GAME_LOBBY"
service = "gamelobby"
```

### Local Development

**Option 1: Multiple wrangler dev sessions**
```bash
# Terminal 1: Start Worker
cd packages/cloudflare-do
wrangler dev

# Terminal 2: Start Pages (finds running Worker)
cd packages/web
wrangler pages dev .svelte-kit/cloudflare
```

**Option 2: Single command (multiple configs)**
```bash
wrangler dev \
  -c packages/web/wrangler.toml \
  -c packages/cloudflare-do/wrangler.toml
```

Primary worker (first config) exposed at `http://localhost:8787`. Secondary workers only accessible via service binding.

### Making Requests

**Important**: Service bindings ignore hostname, only use pathname:

```ts
// Correct: Any hostname works
const response = await env.GAME_LOBBY.fetch(
  new Request('https://fake.host/api/rooms/123')
);

// Incorrect: Will fail
const response = await env.GAME_LOBBY.fetch('/api/rooms/123');
```

### RPC Support (Advanced)

Export named `WorkerEntrypoint` classes for type-safe RPC:

```ts
// Worker (Durable Object)
import { WorkerEntrypoint } from 'cloudflare:workers';

export class GameLobbyAPI extends WorkerEntrypoint {
  async createRoom(gameType: string): Promise<string> {
    // ... implementation
    return roomId;
  }
}

// Pages (SvelteKit)
const roomId = await platform.env.GAME_LOBBY.createRoom('dicee');
```

### Deployment Order

**First deployment**: Deploy Worker **before** Pages project. Otherwise, Pages deployment fails due to missing service binding target.

## 5. Limitations vs Vercel

### Feature Comparison

| Feature | Cloudflare Pages | Vercel |
|---------|-----------------|--------|
| **Runtime** | Cloudflare Workers (custom V8 isolates) | Node.js (full ecosystem) |
| **Framework Support** | Good for SvelteKit | Excellent for Next.js, good for SvelteKit |
| **Bundle Size Limit** | Yes (after minification) | More generous |
| **Edge Functions** | Built-in (Workers) | Available (Edge Runtime) |
| **ISR** | Not supported | Supported (Next.js) |
| **Image Optimization** | Manual (Cloudflare Images service) | Automatic (next/image) |
| **Bandwidth (Free)** | Unlimited | 100GB/month |
| **Build Minutes** | 500 builds/month | 6,000 minutes/month |
| **Concurrent Builds** | 1 | Multiple |
| **Regions** | 200+ data centers | 24 regions |
| **Performance** | Variable (see benchmarks) | Consistent |

### SvelteKit-Specific Limitations

**Bundle Size:**
- Server code compiled to **single file**
- Wrangler fails if bundle exceeds size limit after minification
- Large libraries can cause issues
- **Workaround**: Import heavy libraries only on client side

**Node.js APIs:**
- Cannot use `fs` module
- Use `read` function from `$app/server` instead (fetches from static assets)
- Some npm packages may not work (non-standard Node.js runtime)

**Headers & Redirects:**
- `_headers` and `_redirects` files only work for **static assets**
- No effect on SvelteKit dynamic responses
- Use SvelteKit's `setHeaders()` and `redirect()` instead

### Performance Considerations

**From Recent Benchmarks (2025):**

**Cloudflare Workers:**
- Variable performance: ~1 in 5 requests took 10+ seconds on tasks averaging 1.2s
- Inconsistent response times
- Recent improvements have significantly boosted performance (3-5x faster than initial tests)

**Vercel Fluid Compute:**
- 1.2 to 5 times faster for compute-bound tasks
- More consistent response times
- Full Node.js ecosystem compatibility

**Recommendation for Dicee:**
- Cloudflare excellent for: Global distribution, unlimited bandwidth, low cost
- Vercel better for: Framework features (ISR), consistent performance, large dependencies

### Missing Vercel Features

**Not Available on Cloudflare Pages:**
1. **Incremental Static Regeneration (ISR)** - Next.js specific
2. **Automatic Image Optimization** - Use Cloudflare Images service
3. **Analytics Dashboard** - Use Cloudflare Web Analytics
4. **Serverless Functions** - Use Workers/Pages Functions instead
5. **Edge Config** - Use KV/D1/Durable Objects

## 6. Environment Variables

### Three Types in SvelteKit

**1. Static Private (`$env/static/private`)**
- Baked in at build time
- Server-side only
- Best for build-time configuration

```ts
import { API_KEY } from '$env/static/private';
```

**2. Dynamic Private (`$env/dynamic/private`)**
- Read at runtime
- Server-side only
- Best for runtime secrets

```ts
import { env } from '$env/dynamic/private';
const apiKey = env.API_KEY;
```

**3. Public (`$env/static/public` or `$env/dynamic/public`)**
- Prefixed with `PUBLIC_`
- Available client-side
- Not secret

```ts
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
```

### Setting Variables

**Via Cloudflare Dashboard:**
1. Go to **Workers & Pages** > your Pages project
2. **Settings** > **Environment variables**
3. Add variables per environment (Production, Preview)
4. Encrypted secrets recommended over plain text

**Via wrangler.toml (Local Dev):**
```toml
[vars]
PUBLIC_API_URL = "https://api.example.com"

# For secrets, use wrangler secret
```

**Via CLI:**
```bash
# Set encrypted secret
wrangler pages secret put API_KEY

# List secrets
wrangler pages secret list
```

**Local Development (.env files):**
```bash
# .env.local (git-ignored)
API_KEY=your-secret-key
PUBLIC_SUPABASE_URL=https://xxx.supabase.co

# Works with wrangler pages dev
```

### Platform Bindings vs Environment Variables

**Environment Variables** - Simple key/value pairs:
```ts
const key = env.API_KEY;
```

**Platform Bindings** - Complex objects (KV, D1, DO):
```ts
const value = await platform.env.MY_KV.get('key');
const db = platform.env.MY_D1;
const stub = platform.env.MY_DO.get(id);
```

### TypeScript Support

**Install types:**
```bash
pnpm add -D @cloudflare/workers-types
```

**Configure app.d.ts:**
```ts
/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Platform {
      env: {
        // Environment variables
        API_KEY: string;
        PUBLIC_SUPABASE_URL: string;

        // Bindings
        MY_KV: KVNamespace;
        MY_D1: D1Database;
        GAME_LOBBY: Fetcher; // Service binding
      };
    }
  }
}
```

### Known Issues

**Non-encrypted variables with wrangler.toml:**
- May not load in Pages sites when `wrangler.toml` exists
- **Workaround**: Use encrypted secrets instead

**Local Development:**
- Use `.env.local` for local secrets
- Variables from dashboard don't auto-sync locally
- Must manually maintain `.env.local`

## 7. Build Configuration

### Git Integration (Recommended)

**Framework Settings:**
- **Framework preset**: SvelteKit
- **Build command**: `npm run build` or `vite build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Node.js version**: Specify in `.nvmrc` or environment variables

**Environment Variables:**
```bash
NODE_VERSION=22
PNPM_VERSION=9
```

### Wrangler Configuration (wrangler.toml)

**Minimal Configuration:**
```toml
name = "dicee"
compatibility_date = "2025-01-01"
pages_build_output_dir = ".svelte-kit/cloudflare"

# Optional: Account/project IDs
account_id = "your-account-id"

[vars]
PUBLIC_API_URL = "https://api.dicee.jefahnierocks.com"

# Bindings (KV, D1, DO, Service)
[[kv_namespaces]]
binding = "MY_KV"
id = "xxx"

[[d1_databases]]
binding = "DB"
database_name = "dicee-db"
database_id = "xxx"

[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"
script_name = "gamelobby"

[[services]]
binding = "GAME_LOBBY"
service = "gamelobby"
```

### Direct Upload (wrangler deploy)

**For monorepos or custom setups:**

```bash
# Build
pnpm build

# Deploy
wrangler pages deploy .svelte-kit/cloudflare \
  --project-name=dicee \
  --branch=main
```

**Deploy to staging:**
```bash
wrangler pages deploy .svelte-kit/cloudflare \
  --project-name=dicee \
  --branch=staging \
  --env=staging
```

### Build Script (package.json)

```json
{
  "scripts": {
    "build": "vite build",
    "preview": "wrangler pages dev .svelte-kit/cloudflare",
    "deploy": "pnpm build && wrangler pages deploy .svelte-kit/cloudflare",
    "deploy:staging": "pnpm build && wrangler pages deploy .svelte-kit/cloudflare --env=staging"
  }
}
```

### Compatibility Date

**Required in wrangler.toml:**
```toml
compatibility_date = "2025-01-01"
```

Locks in Workers runtime behavior to specific date, preventing breaking changes.

### Build Output Structure

After `pnpm build`, `.svelte-kit/cloudflare` contains:
```
.svelte-kit/cloudflare/
├── _worker.js         # Compiled server code
├── _routes.json       # SvelteKit routing manifest
└── (static assets)    # CSS, JS, images, etc.
```

### Testing Local Build

```bash
# Build
pnpm build

# Test with Wrangler
wrangler pages dev .svelte-kit/cloudflare

# Access at http://localhost:8788
```

### CI/CD Integration

**GitHub Actions Example:**
```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install
      - run: pnpm build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy .svelte-kit/cloudflare --project-name=dicee
```

## Recommended Setup for Dicee

### Current Architecture

- **Frontend**: SvelteKit on Vercel (dicee.jefahnierocks.com)
- **Multiplayer**: Durable Objects on Cloudflare (gamelobby.jefahnierocks.com)

### Migration Options

**Option 1: Hybrid (Current)**
- **Keep**: Vercel for SvelteKit (simpler deployment, better DX)
- **Keep**: Cloudflare for Durable Objects (necessary for multiplayer)
- **Integration**: Direct HTTP calls or Cloudflare Tunnel

**Option 2: Full Cloudflare**
- **Migrate**: SvelteKit to Cloudflare Pages
- **Keep**: Durable Objects Worker
- **Integration**: Service bindings (lower latency, no costs)
- **Benefits**: Single platform, unlimited bandwidth, lower costs
- **Tradeoffs**: Bundle size limits, runtime compatibility

### Recommendation

**Start with Hybrid, Consider Full Cloudflare Later:**

**Pros of staying on Vercel:**
- Excellent SvelteKit DX
- No bundle size concerns
- Full Node.js compatibility
- Consistent performance

**Pros of migrating to Cloudflare:**
- Unlimited bandwidth (free tier)
- 200+ edge locations
- Service bindings to Durable Objects (fast, free)
- Single platform for all services
- Lower costs at scale

**Migration Checklist** (if/when migrating):
1. Test bundle size after build
2. Verify all dependencies work in Workers runtime
3. Set up service bindings to gamelobby Worker
4. Configure environment variables in Pages dashboard
5. Set up custom domain (dicee.jefahnierocks.com)
6. Test with `wrangler pages dev` locally
7. Deploy to preview environment first
8. Monitor performance metrics
9. Gradual rollout with DNS failover

## Additional Resources

### Official Documentation
- [SvelteKit Cloudflare Adapter Docs](https://svelte.dev/docs/kit/adapter-cloudflare)
- [Cloudflare Pages SvelteKit Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/)
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Service Bindings Documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Pages Functions Bindings](https://developers.cloudflare.com/pages/functions/bindings/)

### Community Resources
- [Bejamas: Cloudflare Pages vs Vercel](https://bejamas.com/compare/cloudflare-pages-vs-vercel)
- [Digital Applied: Vercel vs Netlify vs Cloudflare (2025)](https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison)
- [Stack Overflow: SvelteKit Environment Variables](https://stackoverflow.com/questions/75780218/how-do-i-use-environment-variables-in-a-sveltekit-app-hosted-on-cloudflare-pages)
- [Cloudflare Community: Service Bindings with Pages](https://community.cloudflare.com/t/using-service-binding-to-call-a-worker-from-a-pages-function-locally/489343)

### Benchmarks & Comparisons
- [Vercel: Fluid Compute Benchmark](https://vercel.com/blog/fluid-compute-benchmark-results)
- [Railway: Server Rendering Benchmarks](https://blog.railway.com/p/server-rendering-benchmarks-railway-vs-cloudflare-vs-vercel)
- [Medium: Vercel vs Cloudflare for Advanced Developers](https://jabronidude.medium.com/an-in-depth-comparison-of-vercel-and-cloudflare-for-advanced-developers-7a5d79c063fb)

### Tutorials & Examples
- [D1 with SvelteKit Example](https://developers.cloudflare.com/d1/examples/d1-and-sveltekit/)
- [Setting Up SvelteKit with Cloudflare Pages, D1, OAuth](https://www.jimscode.blog/posts/cloudflare-d1-oauth)
- [SvelteKit Auth with Cloudflare Pages](https://github.com/nextauthjs/sveltekit-auth-cloudflare)
- [Connecting Workers with Service Bindings](https://www.raymondcamden.com/2023/08/11/connecting-cloudflare-workers-with-service-bindings)

---

**Last Updated**: 2025-12-07
**Research Compiled By**: Claude Code (Opus 4.5)
**Status**: Active
