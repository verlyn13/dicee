<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Dicee Layer Architecture

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: d7d5b12cd4784131cfc30bbbc46d8d633f9664d9
> Generated: 2025-12-11T04:36:38.405Z

## Overview

The Dicee architecture enforces a strict layered dependency model with 9 layers
and 261 code nodes.

## Layer Dependency Diagram

```mermaid
flowchart TB
    subgraph "Dicee Architecture"
        shared["📦 shared (15)"]
        cloudflare_do["📦 cloudflare-do (28)"]
        routes["🛣️ routes (24)"]
        components["🧩 components (93)"]
        stores["🗄️ stores (13)"]
        services["⚙️ services (7)"]
        types["📝 types (10)"]
        supabase["🔌 supabase (7)"]
        wasm["🦀 wasm (3)"]
    end

    cloudflare_do --> shared
    routes --> components
    routes --> stores
    routes --> services
    routes --> types
    routes --> wasm
    routes --> shared
    components --> components
    components --> types
    components --> shared
    stores --> services
    stores --> types
    stores --> supabase
    stores --> shared
    services --> types
    services --> supabase
    services --> wasm
    services --> shared
    types --> types
    types --> shared
    supabase --> types
    supabase --> shared
    wasm --> types
    wasm --> shared
```

## Forbidden Dependencies

| From | May NOT Import | Invariant |
|------|---------------|-----------|
| components | stores, services | layer isolation |
| stores | components, routes | layer isolation |
| services | components, routes, stores | layer isolation |
| supabase | components, routes, stores, services | layer isolation |

## Invariant Status

See `pnpm akg:check` for current invariant status.
