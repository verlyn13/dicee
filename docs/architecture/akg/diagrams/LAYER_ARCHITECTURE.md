<!-- Auto-generated from AKG Graph. Edit source, not this file. -->
# Dicee Layer Architecture

> Auto-generated from AKG Graph
> Source: docs/architecture/akg/graph/current.json
> Commit: 5bce86f
> Generated: 2025-12-16T06:46:49.734Z

## Overview

The Dicee architecture enforces a strict layered dependency model with 9 layers
and 299 code nodes.

## Layer Dependency Diagram

```mermaid
flowchart TB
    subgraph "Dicee Architecture"
        shared["📦 shared (25)"]
        cloudflare_do["📦 cloudflare-do (34)"]
        routes["🛣️ routes (29)"]
        components["🧩 components (103)"]
        stores["🗄️ stores (15)"]
        services["⚙️ services (7)"]
        types["📝 types (11)"]
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
