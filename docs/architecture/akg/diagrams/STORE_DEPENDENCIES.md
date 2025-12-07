<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Store Dependencies

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: c36807e
> Generated: 2025-12-07T21:05:46.358Z

## Store Dependency Diagram

Shows how Svelte stores depend on each other.

```mermaid
flowchart LR
    store__game_svelte__tores_game_svelte_ts[("game.svelte")]
    store__room_svelte__tores_room_svelte_ts[("room.svelte")]
    store__multiplayerGame_svelte__playerGam[("multiplayerGame.svelte")]
    store__scorecard_svelte___scorecard_svel[("scorecard.svelte")]
    store__dice_svelte__tores_dice_svelte_ts[("dice.svelte")]
    store__auth_svelte__tores_auth_svelte_ts[("auth.svelte")]
    store__index___lib_stores_index_ts[("index")]
    store__useKeyboardNavigation_svelte__Nav[("useKeyboardNavigation.svelte")]
    store__roomService_svelte__oomService_sv[("roomService.svelte")]

    store__game_svelte__tores_game_svelte_ts --> store__dice_svelte__tores_dice_svelte_ts
    store__game_svelte__tores_game_svelte_ts --> store__scorecard_svelte___scorecard_svel
    store__game_svelte__tores_game_svelte_ts --> store__dice_svelte__tores_dice_svelte_ts
    store__game_svelte__tores_game_svelte_ts --> store__scorecard_svelte___scorecard_svel
    store__room_svelte__tores_room_svelte_ts --> store__roomService_svelte__oomService_sv
    store__room_svelte__tores_room_svelte_ts --> store__roomService_svelte__oomService_sv
    store__room_svelte__tores_room_svelte_ts --> store__roomService_svelte__oomService_sv
    store__multiplayerGame_svelte__playerGam --> store__roomService_svelte__oomService_sv
    store__multiplayerGame_svelte__playerGam --> store__roomService_svelte__oomService_sv
    store__multiplayerGame_svelte__playerGam --> store__roomService_svelte__oomService_sv
```

## Store List

- **game.svelte**: `packages/web/src/lib/stores/game.svelte.ts`
- **room.svelte**: `packages/web/src/lib/stores/room.svelte.ts`
- **multiplayerGame.svelte**: `packages/web/src/lib/stores/multiplayerGame.svelte.ts`
- **scorecard.svelte**: `packages/web/src/lib/stores/scorecard.svelte.ts`
- **dice.svelte**: `packages/web/src/lib/stores/dice.svelte.ts`
- **auth.svelte**: `packages/web/src/lib/stores/auth.svelte.ts`
- **index**: `packages/web/src/lib/stores/index.ts`
- **useKeyboardNavigation.svelte**: `packages/web/src/lib/hooks/useKeyboardNavigation.svelte.ts`
- **roomService.svelte**: `packages/web/src/lib/services/roomService.svelte.ts`
