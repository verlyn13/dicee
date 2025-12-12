<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Store Dependencies

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: 7a8e61cecc43a3b3b21d6183cffb3ab79ca2a966
> Generated: 2025-12-12T03:12:20.958Z

## Store Dependency Diagram

Shows how Svelte stores depend on each other.

```mermaid
flowchart LR
    store__game_svelte__tores_game_svelte_ts[("game.svelte")]
    store__lobby_svelte__ores_lobby_svelte_t[("lobby.svelte")]
    store__room_svelte__tores_room_svelte_ts[("room.svelte")]
    store__multiplayerGame_svelte__playerGam[("multiplayerGame.svelte")]
    store__scorecard_svelte___scorecard_svel[("scorecard.svelte")]
    store__dice_svelte__tores_dice_svelte_ts[("dice.svelte")]
    store__auth_svelte__tores_auth_svelte_ts[("auth.svelte")]
    store__spectator_svelte___spectator_svel[("spectator.svelte")]
    store__flags_svelte__ores_flags_svelte_t[("flags.svelte")]
    store__coach_svelte__ores_coach_svelte_t[("coach.svelte")]
    store__index___lib_stores_index_ts[("index")]
    store__chat_svelte__tores_chat_svelte_ts[("chat.svelte")]
    store__audio_svelte__ores_audio_svelte_t[("audio.svelte")]
    store__useKeyboardNavigation_svelte__Nav[("useKeyboardNavigation.svelte")]
    store__preferences_svelte__references_sv[("preferences.svelte")]
    store__spectatorService_svelte__torServi[("spectatorService.svelte")]
    store__roomService_svelte__oomService_sv[("roomService.svelte")]

    store__game_svelte__tores_game_svelte_ts --> store__dice_svelte__tores_dice_svelte_ts
    store__game_svelte__tores_game_svelte_ts --> store__scorecard_svelte___scorecard_svel
    store__game_svelte__tores_game_svelte_ts --> store__dice_svelte__tores_dice_svelte_ts
    store__game_svelte__tores_game_svelte_ts --> store__scorecard_svelte___scorecard_svel
    store__room_svelte__tores_room_svelte_ts --> store__roomService_svelte__oomService_sv
    store__room_svelte__tores_room_svelte_ts --> store__roomService_svelte__oomService_sv
    store__room_svelte__tores_room_svelte_ts --> store__roomService_svelte__oomService_sv
    store__multiplayerGame_svelte__playerGam --> store__preferences_svelte__references_sv
    store__multiplayerGame_svelte__playerGam --> store__roomService_svelte__oomService_sv
    store__multiplayerGame_svelte__playerGam --> store__preferences_svelte__references_sv
    store__multiplayerGame_svelte__playerGam --> store__roomService_svelte__oomService_sv
    store__multiplayerGame_svelte__playerGam --> store__preferences_svelte__references_sv
    store__multiplayerGame_svelte__playerGam --> store__roomService_svelte__oomService_sv
    store__spectator_svelte___spectator_svel --> store__spectatorService_svelte__torServi
    store__spectator_svelte___spectator_svel --> store__spectatorService_svelte__torServi
    store__spectator_svelte___spectator_svel --> store__spectatorService_svelte__torServi
    store__chat_svelte__tores_chat_svelte_ts --> store__roomService_svelte__oomService_sv
    store__chat_svelte__tores_chat_svelte_ts --> store__roomService_svelte__oomService_sv
    store__chat_svelte__tores_chat_svelte_ts --> store__roomService_svelte__oomService_sv
```

## Store List

- **game.svelte**: `packages/web/src/lib/stores/game.svelte.ts`
- **lobby.svelte**: `packages/web/src/lib/stores/lobby.svelte.ts`
- **room.svelte**: `packages/web/src/lib/stores/room.svelte.ts`
- **multiplayerGame.svelte**: `packages/web/src/lib/stores/multiplayerGame.svelte.ts`
- **scorecard.svelte**: `packages/web/src/lib/stores/scorecard.svelte.ts`
- **dice.svelte**: `packages/web/src/lib/stores/dice.svelte.ts`
- **auth.svelte**: `packages/web/src/lib/stores/auth.svelte.ts`
- **spectator.svelte**: `packages/web/src/lib/stores/spectator.svelte.ts`
- **flags.svelte**: `packages/web/src/lib/stores/flags.svelte.ts`
- **coach.svelte**: `packages/web/src/lib/stores/coach.svelte.ts`
- **index**: `packages/web/src/lib/stores/index.ts`
- **chat.svelte**: `packages/web/src/lib/stores/chat.svelte.ts`
- **audio.svelte**: `packages/web/src/lib/stores/audio.svelte.ts`
- **useKeyboardNavigation.svelte**: `packages/web/src/lib/hooks/useKeyboardNavigation.svelte.ts`
- **preferences.svelte**: `packages/web/src/lib/services/preferences.svelte.ts`
- **spectatorService.svelte**: `packages/web/src/lib/services/spectatorService.svelte.ts`
- **roomService.svelte**: `packages/web/src/lib/services/roomService.svelte.ts`
