# Architecture Knowledge Graph Query

Query the project's Architectural Knowledge Graph for architecture-aware development.

## Usage

```
/akg [subcommand] [args]
```

## Subcommands

### Check Architecture (default)
Validate architectural invariants:
```
/akg check
```

Runs `pnpm akg:check` and reports any violations.

### Layer Rules
Get import rules for a layer:
```
/akg layer [layer-name]
```

Examples:
- `/akg layer components` - What can components import?
- `/akg layer stores` - What can stores import?

### Node Info
Get information about a specific node:
```
/akg node [file-path-or-name]
```

Examples:
- `/akg node game.svelte` - Info about the game store
- `/akg node DiceDisplay` - Info about DiceDisplay component

### Check Import
Validate a proposed import before writing code:
```
/akg import [from-file] [to-file]
```

Examples:
- `/akg import DiceDisplay.svelte game.svelte` - Can DiceDisplay import game store?

### Diagram
Generate architecture diagram:
```
/akg diagram [type]
```

Types: `layer-overview`, `component-dependencies`, `store-relationships`, `dataflow`

### Cache Status
Check graph cache status:
```
/akg cache
```

## Instructions for Claude

Based on the subcommand, use the appropriate AKG MCP tool:

1. **check** (default): Run `pnpm akg:check` via Bash
2. **layer**: Call `mcp__akg__akg_layer_rules` with `layer` parameter
3. **node**: Call `mcp__akg__akg_node_info` with `nodeId` parameter
4. **import**: Call `mcp__akg__akg_check_import` with `fromFile` and `toFile`
5. **diagram**: Call `mcp__akg__akg_diagram` with `name` parameter
6. **cache**: Call `mcp__akg__akg_cache_status`

Parse the user's input to determine which subcommand and arguments they want, then execute the appropriate action.

### Response Format

Format responses clearly:

```
## AKG: [Subcommand Result]

[Formatted output from the tool]

### Recommendations (if applicable)
- [Any actionable recommendations]
```

Execute the query now based on the user's input.
