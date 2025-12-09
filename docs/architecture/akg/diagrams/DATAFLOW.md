<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Dataflow Architecture

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: 5a1ab09
> Generated: 2025-12-09T06:35:17.515Z

## Data Flow Diagram

Shows how data flows through the application layers:
- **Routes** → Entry points (pages)
- **Components** → UI elements
- **Stores** → Reactive state
- **Services** → Business logic
- **External** → WASM engine, Supabase

```mermaid
flowchart TB
    subgraph routes["🛣️ ROUTES"]
        module___layout__rc_routes__layout_ts["layout"]
        module___server___callback__server_ts["+server"]
        module___page_server__obby__page_server_["+page.server"]
        module___page_server___id___page_server_["+page.server"]
        module___page_server__ode___page_server_["+page.server"]
    end

    subgraph components["🧩 COMPONENTS"]
        module__index__mponents_ui_index_ts["index"]
        module__index__onents_chat_index_ts["index"]
        module__index__onents_auth_index_ts["index"]
        module__index__ts_skeleton_index_ts["index"]
        module__index__nts_gallery_index_ts["index"]
    end

    subgraph stores["🗄️ STORES"]
        store__game_svelte__tores_game_svelte_ts[("game")]
        store__lobby_svelte__ores_lobby_svelte_t[("lobby")]
        store__room_svelte__tores_room_svelte_ts[("room")]
        store__multiplayerGame_svelte__playerGam[("multiplayerGame")]
        store__scorecard_svelte___scorecard_svel[("scorecard")]
    end

    subgraph services["⚙️ SERVICES"]
        service__audio__ib_services_audio_ts{{"audio"}}
        service__engine__b_services_engine_ts{{"engine"}}
        store__spectatorService_svelte__torServi{{"spectatorService"}}
        service__telemetry__ervices_telemetry_ts{{"telemetry"}}
        service__index__ib_services_index_ts{{"index"}}
    end

    subgraph supabase["🔌 SUPABASE"]
        supabasemodule__profiles__supabase_profi[("profiles")]
        supabasemodule__stats__ib_supabase_stats[("stats")]
        supabasemodule__client__b_supabase_clien[("client")]
        supabasemodule__flags__ib_supabase_flags[("flags")]
        supabasemodule__index__ib_supabase_index[("index")]
    end

    subgraph wasm["🦀 WASM"]
        wasmbridge__dicee_engine_d__sm_dicee_eng(["dicee_engine.d"])
        wasmbridge__dicee_engine_bg_wasm_d___eng(["dicee_engine_bg.wasm.d"])
        wasmbridge__engine__eb_src_lib_engine_ts(["engine"])
    end

    store__game_svelte__tores_game_svelte_ts --> service__engine__b_services_engine_ts
    store__game_svelte__tores_game_svelte_ts --> store__scorecard_svelte___scorecard_svel
    store__game_svelte__tores_game_svelte_ts --> service__engine__b_services_engine_ts
    store__game_svelte__tores_game_svelte_ts --> service__engine__b_services_engine_ts
    service__engine__b_services_engine_ts --> wasmbridge__engine__eb_src_lib_engine_ts
    service__engine__b_services_engine_ts --> wasmbridge__engine__eb_src_lib_engine_ts
    service__engine__b_services_engine_ts --> wasmbridge__engine__eb_src_lib_engine_ts

    %% Layer styling
    style routes fill:#e1f5fe,stroke:#0288d1
    style components fill:#f3e5f5,stroke:#7b1fa2
    style stores fill:#fff3e0,stroke:#f57c00
    style services fill:#e8f5e9,stroke:#388e3c
    style supabase fill:#fce4ec,stroke:#c2185b
    style wasm fill:#ffebee,stroke:#d32f2f
```

## Layer Summary

| Layer | Nodes | Description |
|-------|-------|-------------|
| routes | 5 | SvelteKit page routes |
| components | 5 | Reusable UI components |
| stores | 5 | Svelte reactive stores |
| services | 5 | Business logic services |
| supabase | 5 | Database & auth integration |
| wasm | 3 | Rust/WASM probability engine |

## Key Data Paths

1. **Game State Flow**: Routes → Game Components → Game Store → Engine Service → WASM
2. **Auth Flow**: Routes → Auth Components → Auth Store → Supabase
3. **Multiplayer Flow**: Components → Room Store → PartyKit Service
