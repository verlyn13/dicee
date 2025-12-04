# Modern MCP server patterns and agentic CLI orchestration for 2025

Model Context Protocol has emerged as the universal standard for connecting AI systems to external tools and data, with **Streamable HTTP transport** replacing SSE as the recommended protocol since March 2025. All major cloud providers—Vercel, Cloudflare, and Supabase—now offer production-ready MCP deployment options, while every leading AI CLI tool supports MCP natively. The ecosystem has matured significantly: Cloudflare's **McpAgent** class provides stateful edge servers with automatic hibernation, Vercel's **mcp-handler** enables serverless deployment with OAuth support, and Supabase offers a **hosted MCP server at mcp.supabase.com** with 20+ tools. For human orchestration, Claude Code CLI achieves **72.7% on SWE-bench** and functions as both MCP client and server, while newer tools like GitHub's agentic Copilot CLI and Google's open-source Gemini CLI (with a generous 1,000 requests/day free tier) are reshaping terminal-based development workflows.

## Edge platform MCP deployment differs fundamentally between Vercel and Cloudflare

**Vercel** approaches MCP servers through serverless functions with the `mcp-handler` package. The architecture treats MCP endpoints as stateless HTTP routes, requiring external stores like Redis for SSE transport or session persistence. Configuration is straightforward—a single `api/[...mcp]/route.ts` file handles all MCP protocol messages:

```typescript
import { createMcpHandler } from 'mcp-handler';

const handler = createMcpHandler((server) => {
  server.tool('search_products', schema, async (args) => {
    return { content: [{ type: 'text', text: results }] };
  });
}, {}, { basePath: '/api' });

export { handler as GET, handler as POST, handler as DELETE };
```

Vercel's **Fluid Compute** optimizes for irregular MCP traffic patterns through instance sharing and dynamic scaling, reportedly achieving **50% CPU reduction** when using Streamable HTTP versus SSE. Production deployments from Zapier, Composio, and Solana validate this approach.

**Cloudflare** takes a fundamentally different architectural approach using **Durable Objects** via the `McpAgent` class. This provides native state management without external dependencies—each MCP server maintains persistent state, an embedded SQLite database, and automatic WebSocket hibernation:

```typescript
export class MyMCP extends McpAgent<Env, State, {}> {
  server = new McpServer({ name: 'Demo', version: '1.0.0' });
  initialState: State = { counter: 0 };

  async init() {
    this.server.tool('increment', schema, async (args) => {
      this.setState({ counter: this.state.counter + 1 });
      return { content: [{ type: 'text', text: `Count: ${this.state.counter}` }] };
    });
  }
}
```

For storage integration, Cloudflare's pattern maps cleanly: **Workers KV** for session data and API keys, **R2** for user uploads and media (with zero egress fees), **D1** for relational queries, and **Durable Objects** for per-user state and conversation history. The McpAgent class handles hibernation automatically—servers sleep during inactive periods and wake within ~100ms, paying only for actual compute time.

## Supabase provides the most comprehensive database-backed MCP solution

Supabase launched an **official hosted MCP server** at `https://mcp.supabase.com/mcp` in early 2025, offering **20+ tools** across five feature groups: database operations, development utilities, edge functions, debugging, and database branching. The recommended production configuration uses project scoping and read-only mode:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true&features=database,docs"
    }
  }
}
```

Key database tools include `execute_sql` for raw queries, `apply_migration` for tracked schema changes, `list_tables` for schema discovery, and `generate_typescript_types` for type-safe client code. The branching tools (`create_branch`, `merge_branch`, `reset_branch`) enable safe development workflows where AI agents can experiment on isolated database branches before merging to production.

Security recommendations from Supabase are explicit: don't connect to production databases, enable read-only mode by default, limit to single projects via scoping, and use feature groups to minimize attack surface. The server wraps SQL results with anti-prompt-injection instructions to discourage LLMs from following embedded malicious commands.

**PartyKit** lacks an official MCP server but shares infrastructure with Cloudflare's Durable Objects. The practical approach for real-time MCP is to use Cloudflare's McpAgent class directly, which provides the same stateful, hibernating server pattern. PartyKit's room-based architecture could theoretically coordinate multiple MCP clients in collaborative scenarios, but this remains an emerging pattern without established conventions.

## Claude Code CLI establishes the gold standard for agentic development

Claude Code, released February 2025, operates as a terminal-native agent with a **200,000 token context window** and the highest publicly reported benchmark score (**72.7% SWE-bench Verified**). The tool functions as both MCP server and client, providing native access to external tools while exposing its own capabilities.

Configuration centers on **CLAUDE.md** files—automatic context documents loaded at conversation start. The recommended structure places `CLAUDE.md` at the repository root for shared team context, `CLAUDE.local.md` for personal settings (gitignored), and `~/.claude/CLAUDE.md` for global preferences:

```markdown
# Build commands
- npm run build: Compile TypeScript
- npm run typecheck: Type validation

# Code style
- Use ES modules (import/export), not CommonJS
- Destructure imports when possible
- Run typecheck after code changes
```

Settings files follow a hierarchical JSON structure with user, project, and enterprise levels. Tool permissions can be configured granularly:

```json
{
  "permissions": {
    "allowedTools": ["Read", "Write", "Bash(git *)"],
    "deny": ["Read(./.env)", "Write(./production.config.*)"]
  }
}
```

**Extended thinking modes** trigger deeper reasoning through specific keywords: "think" for standard analysis, "think hard" for medium budget, "think harder" for high budget, and "ultrathink" for maximum (31,999 tokens).

MCP servers are added via HTTP or stdio transport:
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
claude mcp add airtable --env AIRTABLE_API_KEY=KEY -- npx -y airtable-mcp-server
```

The scope system (`--scope local|project|user`) controls sharing—local for personal testing, project for team collaboration via `.mcp.json`, and user for cross-project availability.

**OpenAI's Codex CLI**, an open-source Rust-based alternative released April 2025, achieves **69.1% on SWE-bench** with a focus on efficiency. Its three approval modes (Suggest, Auto Edit, Full Auto) provide graduated autonomy, and native sandboxing uses Apple Seatbelt on macOS or Landlock/seccomp on Linux. Configuration lives in `~/.codex/config.toml` with TOML syntax. Both tools support MCP, making protocol compatibility a non-issue when choosing between them.

## Secondary CLI tools offer distinct orchestration approaches

**GitHub Copilot CLI** (the new agentic version, not the deprecated `gh copilot` extension) launched in public preview September 2025. It provides native GitHub integration—authenticated access to repos, issues, and PRs without additional configuration. The `/delegate` command hands off complex tasks to GitHub's coding agent for asynchronous execution. Custom agents are defined via Markdown files in `~/.copilot/agents/` or `.github/agents/`, and tool permissions use `--allow-tool` and `--deny-tool` flags.

**Windsurf with Cascade** represents the IDE-integrated approach, functioning as a VS Code fork with agentic capabilities. Cascade maintains deep contextual awareness of the entire codebase, tracks real-time actions (edits, terminal commands, clipboard), and generates explicit Todo lists for complex tasks. The tool supports up to **20 tool calls per prompt** and **100 MCP tools maximum**. Configuration uses two memory mechanisms: auto-generated Memories that persist context and manually defined Rules at global or workspace levels (via `.windsurfrules`).

**Gemini CLI**, Google's open-source entry (Apache 2.0), offers the most generous free tier: **60 requests/minute, 1,000 requests/day** with Gemini 2.5 Pro and its **1M token context window**. Configuration uses `GEMINI.md` for project context and `~/.gemini/settings.json` for MCP servers. The tool supports headless mode (`-p` flag with `--output-format json`) for scripting and CI integration.

## MCP architecture patterns separate production systems from prototypes

The MCP specification defines a **client-host-server architecture** where hosts (like Claude Desktop or VS Code) coordinate MCP clients that maintain 1:1 connections to servers. The protocol uses JSON-RPC 2.0 over one of three transports: **stdio** for local processes (zero network overhead, process isolation for security), **Streamable HTTP** for remote deployment (single endpoint, optional SSE streaming, mandatory OAuth 2.1), or legacy SSE (deprecated, use only for backward compatibility).

Three core primitives structure all MCP interactions. **Tools** are executable functions the AI can invoke, defined with JSON schemas for validation. **Resources** are read-only data sources providing context. **Prompts** are reusable templates for structuring interactions. Well-designed servers expose fewer, more powerful tools that complete entire user tasks rather than mapping one-to-one to API endpoints.

Critical anti-patterns to avoid include token passthrough (explicitly forbidden—servers must validate tokens were issued for them), monolithic mega-servers bundling unrelated functionality, making servers "too smart" (they should provide data, not compete with LLM reasoning), and writing to stdout (which corrupts JSON-RPC messages—always use stderr for logging).

## Multi-agent coordination follows established orchestration patterns

The primary coordination patterns have stabilized around four approaches. The **Handoff pattern** (OpenAI Swarm-style) routes requests to specialized agents based on context—a router agent delegates to sales, support, or technical specialists. The **Pipeline pattern** processes tasks sequentially through drafting, review, and optimization stages. The **Manager pattern** uses a planner agent maintaining a task ledger that assigns subtasks to specialists. The **Blackboard pattern** provides shared context through an MCP "hub" where agents post and retrieve knowledge.

Human-in-the-loop integration manifests through tool approval gates (agents pause before execution), progressive disclosure (safe operations auto-approved, sensitive ones escalated), and MCP's `elicitation/request` capability where servers can request user input directly. All major CLI tools implement tiered autonomy—Claude Code's extended thinking, Codex's approval modes, Gemini's trusted folders—giving users control over the automation/oversight balance.

## Project structure conventions have standardized across the ecosystem

A well-structured TypeScript MCP server follows this layout:

```
my-mcp-server/
├── package.json         # bin entry for npx execution
├── tsconfig.json        # ES2022 target, Node16 modules
├── src/
│   ├── index.ts         # Entry point with shebang
│   ├── server.ts        # Transport handling
│   ├── tools.ts         # Tool implementations
│   └── resources.ts     # Resource handlers
├── build/               # Compiled output
└── tests/
```

The `package.json` must include a `bin` entry pointing to the compiled entrypoint, and the build process should `chmod 755` the output for direct execution. Testing should span five layers: unit tests for individual components, integration tests for interactions, contract tests for MCP protocol compliance, load tests for concurrent request handling, and chaos tests for resilience under failure conditions.

The **MCP Inspector** (`npx @modelcontextprotocol/inspector build/index.js`) provides essential debugging for protocol message inspection during development.

## Practical implementation guidance for production systems

For new MCP server projects in 2025, start with **Streamable HTTP transport** unless building local CLI tools (use stdio). Choose Cloudflare's McpAgent for stateful servers requiring persistence across requests, Vercel's mcp-handler for stateless serverless deployments, or the official Supabase MCP server for database-centric applications.

Security requires defense in depth: network isolation (bind to localhost for local servers), OAuth 2.1 authentication for HTTP transports, Resource Indicators (RFC 8707) to prevent token misuse, strict schema validation for inputs, and output sanitization. Never implement token passthrough—validate that every token was issued specifically for your MCP server.

For AI CLI orchestration, Claude Code provides the deepest reasoning capabilities at higher token cost, Codex CLI offers open-source efficiency for straightforward tasks, and Gemini CLI's free tier makes it ideal for high-volume development workflows. The hybrid approach—Claude Code for architecture and investigation, Codex or Gemini for focused implementation—optimizes both capability and cost.

## Conclusion

The MCP ecosystem in 2025 has achieved critical mass across cloud platforms and AI tools. The shift from SSE to Streamable HTTP, the emergence of stateful edge servers via Cloudflare's McpAgent, and universal MCP support across Claude Code, Codex CLI, Copilot CLI, Windsurf, and Gemini CLI create a stable foundation for production agentic systems.

Key patterns that distinguish production deployments: single-responsibility servers with task-oriented tools, defense-in-depth security with mandatory OAuth for remote servers, human-in-the-loop gates for sensitive operations, and multi-agent coordination through handoff or manager patterns. The CLAUDE.md/GEMINI.md context file convention has emerged as the standard for providing project-specific guidance to AI agents, dramatically improving task completion quality.

The practical path forward: use Cloudflare McpAgent or Vercel mcp-handler for custom MCP servers, integrate Supabase's hosted server for database operations, configure your preferred AI CLI with appropriate thinking modes and approval gates, and structure multi-agent workflows around explicit handoffs with human checkpoints at trust boundaries.❯
