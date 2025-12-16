Let me search for the current state of the art on presence management with Cloudflare Durable Objects and WebSocket Hibernation, which has evolved significantly in 2025.Based on my research, here's the December 2025 canonical approach for presence management in Cloudflare Durable Objects with WebSocket Hibernation:

## The Core Architecture Pattern

For your Dicee `GlobalLobby.ts`, the modern approach uses **three complementary mechanisms** that work together:

### 1. **Tags for User Identity Grouping**

The `acceptWebSocket` tags parameter is the proper way to implement `UserId → Set<ConnectionId>`:

```typescript
// When accepting the connection
this.ctx.acceptWebSocket(server, [
  `user:${userId}`,    // Group all connections by user
  `conn:${connId}`,    // Unique connection identifier
]);

// Later, to get all connections for a specific user:
const userConnections = this.ctx.getWebSockets(`user:${userId}`);

// Or to target a specific connection:
const [specificConn] = this.ctx.getWebSockets(`conn:${connId}`);
```

This replaces maintaining your own `Map<UserId, Set<ConnectionId>>` because:
- Tags persist through hibernation automatically
- `getWebSockets(tag)` is the hibernation-safe way to query connections
- Maximum 10 tags per connection, 256 chars each

### 2. **Attachments for Per-Connection Metadata**

The 2048-byte `serializeAttachment` is for *per-connection* state that needs to survive hibernation:

```typescript
// On connection
server.serializeAttachment({
  userId,
  displayName,
  connectionId: crypto.randomUUID(),
  joinedAt: Date.now(),
  // ... any metadata needed when waking from hibernation
});

// In webSocketMessage/constructor
const meta = ws.deserializeAttachment();
```

### 3. **Constructor State Reconstruction**

The constructor MUST rebuild in-memory indexes from hibernating WebSockets:

```typescript
export class GlobalLobby extends DurableObject {
  private presenceByUser: Map<string, Set<WebSocket>> = new Map();
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Rebuild presence index from surviving connections
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (meta?.userId) {
        if (!this.presenceByUser.has(meta.userId)) {
          this.presenceByUser.set(meta.userId, new Set());
        }
        this.presenceByUser.get(meta.userId)!.add(ws);
      }
    }
    
    // Auto ping/pong without waking DO
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }
}
```

## Presence List Broadcasting

The key insight for the Multiple Tabs Problem: **presence is about users, not connections**.

```typescript
// Get unique online users (deduped across tabs)
getOnlineUsers(): UserPresence[] {
  const seen = new Set<string>();
  const users: UserPresence[] = [];
  
  for (const ws of this.ctx.getWebSockets()) {
    const meta = ws.deserializeAttachment();
    if (meta?.userId && !seen.has(meta.userId)) {
      seen.add(meta.userId);
      users.push({
        userId: meta.userId,
        displayName: meta.displayName,
        // Take latest connection's status if multiple tabs
      });
    }
  }
  return users;
}

// Broadcast to all connections, but dedupe user-facing events
async webSocketClose(ws: WebSocket, code: number, reason: string) {
  const meta = ws.deserializeAttachment();
  
  // Only broadcast "user left" if this was their LAST connection
  const remainingConns = this.ctx.getWebSockets(`user:${meta.userId}`);
  if (remainingConns.length === 0) {
    this.broadcast({ type: 'user_left', userId: meta.userId });
  }
  // Otherwise user still has other tabs open - no presence change
}
```

## The Tag Strategy for Your Game Lobby

For Dicee specifically, I'd recommend these tag categories:

```typescript
this.ctx.acceptWebSocket(server, [
  `user:${userId}`,           // Presence grouping
  `room:${roomCode}`,         // For room-scoped broadcasts (when in game)
  `role:${isSpectator ? 'spectator' : 'player'}`,  // Filter by role
]);
```

This lets you efficiently:
- `getWebSockets('user:xyz')` — all of xyz's tabs
- `getWebSockets('room:ABC123')` — everyone in that game room
- `getWebSockets('role:player')` — only active players (skip spectators)

## Key 2025 Best Practices

1. **Never maintain manual WebSocket collections** that won't survive hibernation. Use `getWebSockets()` with tags.

2. **Use `getTags(ws)`** (added late 2024) to retrieve tags from a WebSocket if you need to inspect them.

3. **SQLite storage** for anything that needs durability beyond the current session (game history, user stats). The attachment is ephemeral to the connection.

4. **No `setTimeout`/`setInterval`** in the DO — they prevent hibernation. Use alarms for delayed work.

This architecture means your `GlobalLobby` can hibernate indefinitely while hundreds of users have the tab open, and you only pay for compute when someone actually sends a message.