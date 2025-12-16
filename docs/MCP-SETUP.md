# MCP Server Configuration for Dicee

This document describes the Model Context Protocol (MCP) servers configured for the Dicee project.

## Configuration Files

- **`.cursor/mcp.json`** - Primary Cursor IDE configuration (project-specific)
- **`.mcp.json`** - Root configuration (backward compatibility)

Both files contain the same server definitions. Cursor uses `.cursor/mcp.json` for project-specific tools.

## Configured Servers

### 1. Memory Server (`memory`)

Persistent knowledge graph for the Dicee project.

- **Type**: Local (stdio)
- **Command**: `node`
- **Purpose**: Stores project context and agent memories
- **Data Location**: `.claude/state/memory.jsonl`

### 2. Supabase MCP (`supabase`)

Database, migrations, and edge functions access.

- **Type**: HTTP (remote)
- **URL**: `https://mcp.supabase.com/mcp`
- **Features**: `database`, `docs`, `functions`
- **Authentication**: Bearer token via `SUPABASE_MCP_TOKEN` environment variable

### 3. AKG Server (`akg`)

Architecture Knowledge Graph - custom MCP server for layer validation and architectural queries.

- **Type**: Local (stdio)
- **Command**: `bun run`
- **Script**: `packages/web/src/tools/akg/mcp/server.ts`
- **Purpose**: 
  - Validate import rules between layers
  - Query architectural graph
  - Generate architecture diagrams
  - Check architectural invariants

### 4. Cloudflare Documentation (`cloudflare-docs`)

Search Cloudflare's official documentation.

- **Type**: Remote (via `mcp-remote`)
- **URL**: `https://docs.mcp.cloudflare.com/mcp`
- **Tools**: `search_cloudflare_documentation`
- **Authentication**: OAuth (browser-based)

### 5. Cloudflare Bindings (`cloudflare-bindings`)

Manage Workers bindings: KV namespaces, R2 buckets, D1 databases, Hyperdrive configs.

- **Type**: Remote (via `mcp-remote`)
- **URL**: `https://bindings.mcp.cloudflare.com/mcp`
- **Tools**: 
  - Account management
  - KV namespace operations
  - R2 bucket management
  - D1 database operations
  - Hyperdrive configuration
  - Workers listing and code retrieval
- **Authentication**: OAuth (browser-based)

### 6. Cloudflare Observability (`cloudflare-observability`)

Query Workers logs, analytics, and metrics.

- **Type**: Remote (via `mcp-remote`)
- **URL**: `https://observability.mcp.cloudflare.com/mcp`
- **Tools**:
  - `query_worker_observability` - Query logs and metrics
  - `observability_keys` - Discover available log fields
  - `observability_values` - Find values for specific fields
- **Authentication**: OAuth (browser-based)

### 7. Cloudflare Builds (`cloudflare-builds`)

Manage and monitor Workers builds.

- **Type**: Remote (via `mcp-remote`)
- **URL**: `https://builds.mcp.cloudflare.com/mcp`
- **Tools**:
  - `workers_builds_set_active_worker` - Set active worker
  - `workers_builds_list_builds` - List builds
  - `workers_builds_get_build` - Get build details
  - `workers_builds_get_build_logs` - Get build logs
- **Authentication**: OAuth (browser-based)

### 8. Cloudflare Logpush (`cloudflare-logpush`)

Monitor Logpush job health and status.

- **Type**: Remote (via `mcp-remote`)
- **URL**: `https://logs.mcp.cloudflare.com/mcp`
- **Tools**:
  - `logpush_jobs_by_account_id` - List and check Logpush jobs
- **Authentication**: OAuth (browser-based)

### 9. Cloudflare GraphQL (`cloudflare-graphql`)

Query Cloudflare's GraphQL API for analytics and insights.

- **Type**: Remote (via `mcp-remote`)
- **URL**: `https://graphql.mcp.cloudflare.com/mcp`
- **Tools**:
  - `graphql_schema_search` - Search GraphQL schema
  - `graphql_schema_overview` - Get schema overview
  - `graphql_type_details` - Get type details
  - `graphql_complete_schema` - Get complete schema
  - `graphql_query` - Execute GraphQL queries
  - `graphql_api_explorer` - Generate API Explorer links
- **Authentication**: OAuth (browser-based)

## Authentication

### Environment Variables

Set these in your shell or `.envrc`:

```bash
export SUPABASE_MCP_TOKEN="your-token-here"
```

### OAuth (Cloudflare Servers)

Cloudflare MCP servers use OAuth authentication. On first use:

1. Cursor will attempt to connect to the server
2. A browser window will open for Cloudflare OAuth
3. Grant permissions to the MCP client
4. Tools become available after authentication

**Note**: OAuth tokens are managed by `mcp-remote` and stored locally.

## Usage Examples

### Using Cloudflare Documentation

```
Search Cloudflare documentation for Workers WebSocket hibernation
```

### Using Cloudflare Bindings

```
List my KV namespaces
Create a new R2 bucket named 'game-assets'
Show me my D1 databases
```

### Using Cloudflare Observability

```
What were the top 5 countries by request count for my worker yesterday?
Show me CPU time usage for worker 'api-gateway' over the last 24 hours
```

### Using AKG Server

```
Check if there are any layer rule violations in the codebase
Show me the dependency graph for the web package
Validate all architectural invariants
```

## Troubleshooting

### Server Not Connecting

1. **Check server is running**: For local servers (AKG, memory), ensure dependencies are installed
2. **Check authentication**: For remote servers, ensure OAuth flow completed
3. **Check environment variables**: Verify `SUPABASE_MCP_TOKEN` is set
4. **Restart Cursor**: MCP servers are loaded on Cursor startup

### OAuth Issues

If Cloudflare OAuth fails:

1. Check internet connection
2. Verify Cloudflare account access
3. Try disconnecting and reconnecting the server
4. Check browser console for OAuth errors

### Path Issues

If local servers fail with path errors:

1. Ensure you're in the project root
2. Verify `${workspaceFolder}` is resolving correctly
3. Check that `bun` is installed for AKG server
4. Verify `node_modules/@modelcontextprotocol/server-memory` exists

## Reference Documentation

- [Cursor MCP Configuration](docs/references/cursor-mcp.md)
- [Cloudflare MCP Servers](docs/references/cloudflare/MCP/README.md)
- [AKG MCP Server](../packages/web/src/tools/akg/mcp/server.ts)
- [MCP Protocol Specification](https://modelcontextprotocol.io/introduction)

## Related Files

- `.cursor/mcp.json` - Cursor project configuration
- `.mcp.json` - Root configuration (backward compatibility)
- `packages/web/src/tools/akg/mcp/server.ts` - AKG MCP server implementation
- `.claude/workflow-orchestration.md` - Workflow documentation with MCP details

