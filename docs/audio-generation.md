# Audio Generation System

> **For Agents**: This document explains the audio generation framework, its purpose, usage, and how generated assets flow through to production.

**Related Documents**:
- [Audio Requirements](audio-requirements.md) - Detailed UX trigger points, timing, and generation parameters
- [Audio Plan](references/audio-plan.md) - Creative direction and asset specifications
- [Audio-Gen README](../packages/web/src/tools/audio-gen/README.md) - CLI tool documentation

## Overview

The Dicee project uses AI-generated audio via the **ElevenLabs Sound Effects API**. The `audio-gen` tool in `packages/web/src/tools/audio-gen/` provides a CLI for generating, tracking, and managing audio assets.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUDIO GENERATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. GENERATION (Developer Machine)                                      │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│     │ audio-gen    │───▶│ ElevenLabs   │───▶│ static/audio/        │   │
│     │ CLI tool     │    │ API          │    │ *.ogg files          │   │
│     └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                         │
│  2. BUILD (CI/CD or Local)                                              │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│     │ pnpm build   │───▶│ SvelteKit    │───▶│ .svelte-kit/         │   │
│     │              │    │ adapter-cf   │    │ cloudflare/          │   │
│     └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                         │
│  3. DEPLOYMENT (Cloudflare Pages)                                       │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│     │ wrangler     │───▶│ Cloudflare   │───▶│ Edge CDN             │   │
│     │ pages deploy │    │ Pages        │    │ (global cache)       │   │
│     └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                         │
│  4. RUNTIME (Player's Browser)                                          │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│     │ AudioManager │───▶│ fetch()      │───▶│ /audio/sfx/dice/     │   │
│     │ (Web Audio)  │    │ from CDN     │    │ dice_roll_heavy.ogg  │   │
│     └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Audio Generation Tool (`audio-gen`)

**Location**: `packages/web/src/tools/audio-gen/`

**Purpose**: CLI tool that calls ElevenLabs API to generate audio files based on text prompts defined in the asset registry.

**NOT a runtime component**: This tool runs on developer machines during asset creation, not in production.

### 2. Static Assets Directory

**Location**: `packages/web/static/audio/`

**Structure**:
```
static/audio/
├── sfx/
│   ├── dice/           # Dice rolling, selecting sounds
│   ├── ui/             # Button clicks, turn notifications
│   └── score/          # Score feedback, fanfares
├── music/              # Background music layers
├── ambient/            # Ambient loops
└── generation-manifest.json  # Tracks generation status
```

**Key Point**: Files in `static/` are copied verbatim to the build output. They are NOT processed by Vite/SvelteKit bundler.

### 3. Audio Service (Runtime)

**Location**: `packages/web/src/lib/services/audio.ts`

**Purpose**: Web Audio API manager that loads and plays sounds during gameplay.

**How it accesses files**: Uses `fetch('/audio/sfx/dice/dice_roll_heavy.ogg')` - paths are relative to the site root.

### 4. Cloudflare Pages Deployment

**Build output**: `.svelte-kit/cloudflare/`

**Static assets**: Automatically included in the Cloudflare Pages deployment.

**Caching**: Cloudflare automatically caches static assets at edge locations globally.

## Production Asset Flow

When a player loads the game:

1. **Initial Load**: SvelteKit app loads from Cloudflare Pages
2. **Audio Preload**: `AudioManager.preloadEssentials()` fetches critical sounds
3. **Request Path**: `GET /audio/sfx/dice/dice_roll_heavy.ogg`
4. **Cloudflare Routing**: 
   - Request hits Cloudflare edge
   - If asset exists in static directory → served directly (no Worker invocation)
   - Cloudflare's tiered caching ensures fast delivery globally
5. **Browser Caching**: Standard HTTP caching headers apply

### Cloudflare Static Asset Behavior

From `wrangler.toml`:
```toml
pages_build_output_dir = ".svelte-kit/cloudflare"
```

The SvelteKit adapter-cloudflare:
- Copies `static/` contents to build output
- Cloudflare Pages serves these as static assets
- No Worker code is invoked for static asset requests
- Assets are cached at Cloudflare edge locations

## API Key Management

### ElevenLabs API Key

**Storage**: gopass (`dicee/elevenlabs/api-key`)

**Setup**:
```bash
# One-time: Store the key
gopass insert dicee/elevenlabs/api-key

# Per-session: Export for use
export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)
```

**Security**:
- Never commit API keys to the repository
- The key is only needed during asset generation (developer machine)
- Production deployment does NOT need the ElevenLabs key
- Generated audio files are committed to the repository

## CLI Commands

```bash
# List all defined assets
pnpm audio:list

# Show generation status
pnpm audio:status

# Generate assets (requires ELEVENLABS_API_KEY)
pnpm audio:gen -- --phase mvp --dry-run    # Preview
pnpm audio:gen -- --phase mvp              # Generate MVP assets
pnpm audio:gen -- --asset MVP-01           # Single asset
pnpm audio:gen -- --category dice          # By category
```

## Asset Registry

**Location**: `packages/web/src/tools/audio-gen/config/assets.ts`

**Phases**:
| Phase | Assets | Budget | Description |
|-------|--------|--------|-------------|
| `mvp` | 8 | $20 | Essential sounds for launch |
| `complete` | 17 | $30 | Full audio experience |
| `future` | TBD | TBD | Deferred features |

**Categories**:
| Category | Directory | Examples |
|----------|-----------|----------|
| `dice` | `sfx/dice/` | Roll, select, deselect |
| `ui` | `sfx/ui/` | Clicks, turn notifications |
| `score` | `sfx/score/` | Score feedback, fanfares |
| `music` | `music/` | Background layers |
| `ambient` | `ambient/` | Room tone |

## Workflow for Adding New Sounds

1. **Define Asset**: Add entry to `config/assets.ts` with:
   - Unique ID (e.g., `MVP-09`)
   - Filename (snake_case, no extension)
   - Category, phase, description
   - ElevenLabs prompt
   - Duration, volume, etc.

2. **Generate**: 
   ```bash
   export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)
   pnpm audio:gen -- --asset MVP-09 --dry-run  # Preview
   pnpm audio:gen -- --asset MVP-09            # Generate
   ```

3. **Post-Process** (if needed):
   - Normalize levels
   - Trim silence
   - Convert to OGG Vorbis
   - Test on mobile speakers

4. **Update Audio Service**: Add to `SOUND_BANK` in `audio.ts`:
   ```typescript
   newSound: { src: '/audio/sfx/category/filename.ogg', ... }
   ```

5. **Commit**: Audio files are committed to the repository

6. **Deploy**: Normal deployment includes the new assets

## File Format Considerations

**Generated Format**: MP3 (ElevenLabs default)

**Recommended Format**: OGG Vorbis (quality 5)
- Better compression than MP3
- Broad browser support
- Seamless looping support

**Conversion** (post-generation):
```bash
ffmpeg -i input.mp3 -c:a libvorbis -q:a 5 output.ogg
```

## Troubleshooting

### "ELEVENLABS_API_KEY environment variable is not set"
```bash
export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)
```

### Audio not playing in production
1. Check browser console for 404 errors
2. Verify file exists in `static/audio/` with correct path
3. Check `SOUND_BANK` in `audio.ts` has correct `src` path
4. Ensure file was included in the build

### Generation failed
```bash
# Check manifest for error details
cat packages/web/static/audio/generation-manifest.json | jq '.results | to_entries[] | select(.value.status == "failed")'
```

## References

- [Audio Plan](references/audio-plan.md) - Creative direction and asset definitions
- [ElevenLabs API Docs](references/elevenlabs/) - API documentation
- [Cloudflare Static Assets](references/cloudflare/cloudflare-workers-assets.md) - How Cloudflare serves static files
- [Audio Service](../packages/web/src/lib/services/audio.ts) - Runtime audio manager
- [Audio-Gen README](../packages/web/src/tools/audio-gen/README.md) - Tool-specific documentation
