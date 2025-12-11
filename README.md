# Game Lobby

Family-friendly game platform for mobile browsers. No app install required.

**Live:** https://gamelobby.jefahnierocks.com

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit (Svelte 5) on Cloudflare Pages |
| Game Engine | Rust compiled to WebAssembly (45KB) |
| Realtime | Cloudflare Durable Objects with WebSocket hibernation |
| Auth & Data | Supabase (PostgreSQL, Row Level Security) |

## Features

- **Solo & Multiplayer** - Play against AI or friends in real-time
- **AI Opponents** - 5 difficulty profiles with distinct play styles
- **Mobile-First** - Touch controls, responsive layout, keyboard handling
- **Spectator Mode** - Watch games with live predictions
- **Global Lobby** - Chat, presence, room browser

## Project Structure

```
packages/
  engine/        # Rust probability engine
  web/           # SvelteKit frontend
  cloudflare-do/ # Durable Objects (game state, lobby)
```

## Development

```bash
pnpm install
pnpm dev:full     # Frontend + DO servers
pnpm test         # 1800+ tests
pnpm build
```

## License

MIT
