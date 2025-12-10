# Audio Generation Tool

CLI tool for generating audio assets using the ElevenLabs Sound Effects API.

## Overview

This tool provides a structured framework for generating, tracking, and managing audio assets for the Dicee game. It integrates with:

- **ElevenLabs Sound Effects API** for AI-powered audio generation
- **gopass/Infisical** for secure API key management
- **Asset registry** with all audio definitions from `docs/references/audio-plan.md`
- **Generation manifest** for tracking status and avoiding duplicate work

## Quick Start

```bash
# 1. Set up ElevenLabs API key (one-time)
gopass insert dicee/elevenlabs/api-key

# 2. Export the key for this session
export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)

# 3. List all defined assets
pnpm audio:list

# 4. Generate MVP assets (dry run first)
pnpm audio:gen -- --phase mvp --dry-run

# 5. Generate for real
pnpm audio:gen -- --phase mvp
```

## Commands

### List Assets

```bash
pnpm audio:list
```

Shows all defined audio assets organized by production phase.

### Check Status

```bash
pnpm audio:status
```

Shows generation status from the manifest file, including:
- Assets generated vs pending
- Failed assets with error messages
- Total credits used

### Generate Assets

```bash
# Generate a specific asset
pnpm audio:gen -- --asset MVP-01

# Generate all MVP assets
pnpm audio:gen -- --phase mvp

# Generate by category
pnpm audio:gen -- --category dice

# Dry run (no API calls)
pnpm audio:gen -- --phase mvp --dry-run

# Verbose output
pnpm audio:gen -- --asset MVP-01 --verbose
```

## Asset Registry

Assets are defined in `config/assets.ts` following the structure from `docs/references/audio-plan.md`:

### Phases

| Phase | Budget | Description |
|-------|--------|-------------|
| `mvp` | $20 | Essential audio for launch (8 assets) |
| `complete` | $30 | Full audio experience (18 assets) |
| `future` | TBD | Deferred features |

### Categories

| Category | Directory | Description |
|----------|-----------|-------------|
| `dice` | `sfx/dice/` | Dice rolling, selecting, deselecting |
| `ui` | `sfx/ui/` | Button clicks, hovers, errors |
| `score` | `sfx/score/` | Score feedback, bonuses, fanfares |
| `music` | `music/` | Layered background music |
| `ambient` | `ambient/` | Room tone, atmosphere |

### Output Structure

Generated files are placed in `packages/web/static/audio/`:

```
audio/
├── sfx/
│   ├── dice/
│   │   ├── dice_roll_heavy.ogg
│   │   ├── dice_roll_light.ogg
│   │   └── dice_select.ogg
│   ├── ui/
│   │   ├── btn_click.ogg
│   │   └── turn_start.ogg
│   └── score/
│       ├── score_positive.ogg
│       ├── dicee_fanfare.ogg
│       └── game_win.ogg
├── music/
│   ├── music_layer_calm.ogg
│   ├── music_layer_activity.ogg
│   └── music_layer_tension.ogg
├── ambient/
│   └── ambient_base.ogg
└── generation-manifest.json
```

## API Key Setup

### Using gopass (recommended)

```bash
# Store the key
gopass insert dicee/elevenlabs/api-key

# Export for current session
export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)

# Or add to your shell profile
echo 'export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)' >> ~/.zshrc
```

### Using Infisical

```bash
# After storing in gopass, sync to Infisical
dicee-env dev
infisical secrets set ELEVENLABS_API_KEY="$(gopass show -o dicee/elevenlabs/api-key)" --env=dev
```

## Architecture

```
audio-gen/
├── cli/
│   └── generate.ts      # Main CLI entry point
├── client/
│   ├── elevenlabs.ts    # ElevenLabs API client
│   └── index.ts
├── config/
│   ├── assets.ts        # Asset registry (all definitions)
│   └── index.ts
├── schema/
│   ├── assets.schema.ts # Zod schemas for assets
│   ├── elevenlabs.schema.ts # Zod schemas for API
│   └── index.ts
├── index.ts             # Main exports
└── README.md
```

### Key Types

```typescript
// Asset definition
interface AudioAsset {
  id: string;           // e.g., "MVP-01"
  filename: string;     // e.g., "dice_roll_heavy"
  category: 'dice' | 'ui' | 'score' | 'music' | 'ambient';
  phase: 'mvp' | 'complete' | 'future';
  description: string;
  prompt: string;       // ElevenLabs generation prompt
  durationSeconds?: number;
  looping?: boolean;
  promptInfluence?: 'high' | 'low';
  channels?: 'mono' | 'stereo';
  preload?: boolean;
  defaultVolume?: number;
  variants?: number;
  postProcessing?: string;
}

// Generation tracking
interface GenerationResult {
  assetId: string;
  status: 'pending' | 'generating' | 'generated' | 'processed' | 'verified' | 'failed';
  timestamp: string;
  files?: string[];
  error?: string;
  requestId?: string;
  creditsUsed?: number;
}
```

## Post-Processing

After generation, assets may need manual post-processing in Audacity:

1. **Normalize**: SFX to -3dB peak, music to -6dB peak
2. **Trim**: Remove silence, add 10ms fade in/out
3. **Loop test**: Verify seamless loops for ambient/music
4. **EQ**: Roll off harsh 2-5kHz if present
5. **Convert**: Export as OGG Vorbis quality 5
6. **Mobile test**: Verify on phone speakers

## Integration with Audio Service

The generated assets integrate with `packages/web/src/lib/services/audio.ts`:

```typescript
// SOUND_BANK in audio.ts references these files
export const SOUND_BANK: Record<SoundId, SoundConfig> = {
  diceRoll: { src: '/audio/sfx/dice/dice_roll_heavy.ogg', ... },
  dicee: { src: '/audio/sfx/score/dicee_fanfare.ogg', ... },
  // etc.
};
```

After generating new assets, update `SOUND_BANK` to reference them.

## Troubleshooting

### "ELEVENLABS_API_KEY environment variable is not set"

```bash
export ELEVENLABS_API_KEY=$(gopass show -o dicee/elevenlabs/api-key)
```

### "API error 401: Unauthorized"

Your API key is invalid or expired. Get a new one from the ElevenLabs dashboard.

### "API error 429: Too Many Requests"

You've hit the rate limit. Wait a few minutes and try again, or use `--asset` to generate one at a time.

### Generation failed but no error message

Check the manifest file for details:
```bash
cat packages/web/static/audio/generation-manifest.json | jq '.results | to_entries[] | select(.value.status == "failed")'
```

## Production Deployment

### How Audio Assets Reach Players

1. **Generated files** are placed in `packages/web/static/audio/`
2. **SvelteKit build** copies `static/` to `.svelte-kit/cloudflare/`
3. **Cloudflare Pages** deploys the build output
4. **Players request** `/audio/sfx/dice/dice_roll_heavy.ogg`
5. **Cloudflare serves** the file directly from edge cache (no Worker invocation)

### Cloudflare Static Asset Behavior

From `wrangler.toml`:
```toml
pages_build_output_dir = ".svelte-kit/cloudflare"
```

- Static assets in `static/` are served directly by Cloudflare
- No Worker code is invoked for these requests
- Cloudflare's tiered caching ensures fast global delivery
- First request: fetched from storage, cached at nearest edge
- Subsequent requests: served from edge cache

### File Paths

| Development | Production URL |
|-------------|----------------|
| `static/audio/sfx/dice/dice_roll_heavy.ogg` | `/audio/sfx/dice/dice_roll_heavy.ogg` |
| `static/audio/sfx/ui/btn_click.ogg` | `/audio/sfx/ui/btn_click.ogg` |
| `static/audio/music/music_layer_calm.ogg` | `/audio/music/music_layer_calm.ogg` |

### Important Notes

- **Audio files are committed to the repository** - they're part of the static assets
- **ElevenLabs API key is NOT needed in production** - only for generation
- **No runtime API calls** - all audio is pre-generated and served as static files
- **Browser caching** - standard HTTP caching headers apply

## References

- [Audio Generation System](../../../../../docs/audio-generation.md) - Full architecture documentation
- [Audio Plan](../../../../../docs/references/audio-plan.md) - Creative direction
- [ElevenLabs API Docs](../../../../../docs/references/elevenlabs/) - API reference
- [Audio Service](../../lib/services/audio.ts) - Runtime audio manager
- [Cloudflare Static Assets](../../../../../docs/references/cloudflare/cloudflare-workers-assets.md) - Cloudflare docs
