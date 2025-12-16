# Observability Query Patterns

> **Version**: 1.0.0  
> **Created**: 2025-01-XX  
> **Purpose**: Reusable query patterns for debugging and monitoring

---

## Overview

This document provides **reusable query patterns** for querying observability data via Cloudflare Observability MCP tools. All queries use the helpers from `packages/cloudflare-do/src/lib/observability/mcp-helpers.ts`.

---

## Quick Reference

### Import Query Helpers

```typescript
import {
  queryLifecycleEvents,
  queryStorageEvents,
  queryErrorEvents,
  queryByCorrelationId,
  queryStorageReadPerformance,
  querySeatEvents,
  queryGameEvents,
} from './lib/observability/mcp-helpers.js';
```

### Execute Query via MCP

```typescript
// Query is a TypeScript object - execute via MCP tool
mcp_cloudflare-observability_query_worker_observability({
  query: queryLifecycleEvents('TEST-ROOM', '-1h')
});
```

---

## Common Query Patterns

### 1. Lifecycle Events

**Purpose**: Track connection lifecycle (wake, connect, disconnect, reconnect)

```typescript
// Query lifecycle events for a room
const query = queryLifecycleEvents('TEST-ROOM', '-1h');

// Filter by specific event type
const wakeQuery = {
  ...query,
  parameters: {
    ...query.parameters,
    filters: [
      ...query.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"lifecycle.wake"',
      },
    ],
  },
};
```

**Use Cases**:
- Debug hibernation wake issues
- Track connection patterns
- Monitor reconnection rates

---

### 2. Storage Events

**Purpose**: Track storage operations (read, write, delete)

```typescript
// Query storage events
const query = queryStorageEvents('TEST-ROOM', '-1h');

// Filter by operation type
const readQuery = {
  ...query,
  parameters: {
    ...query.parameters,
    filters: [
      ...query.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"storage.read.end"',
      },
    ],
  },
};
```

**Use Cases**:
- Debug storage read/write failures
- Track storage performance
- Monitor storage operation frequency

---

### 3. Error Events

**Purpose**: Find and analyze errors

```typescript
// Query error events
const query = queryErrorEvents('TEST-ROOM', '-1h');

// Filter by error type
const handlerErrorQuery = {
  ...query,
  parameters: {
    ...query.parameters,
    filters: [
      ...query.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"error.handler.failed"',
      },
    ],
  },
};
```

**Use Cases**:
- Debug handler failures
- Track error rates
- Monitor error patterns

---

### 4. Correlation ID Tracing

**Purpose**: Trace a request end-to-end

```typescript
// Query by correlation ID
const query = queryByCorrelationId('req-abc123', '-1h');

// This returns ALL events for this request:
// - Message receipt
// - Storage operations
// - State transitions
// - Broadcasts
// - Errors
```

**Use Cases**:
- Debug specific user actions
- Trace request flow
- Find bottlenecks in request handling

---

### 5. Performance Metrics

**Purpose**: Calculate performance statistics

```typescript
// Query storage read performance
const query = queryStorageReadPerformance('TEST-ROOM', '-1h');

// Returns:
// - avgDuration: Average read duration
// - p99Duration: 99th percentile duration
```

**Use Cases**:
- Monitor storage performance
- Identify slow operations
- Track performance trends

---

### 6. Seat Management Events

**Purpose**: Track seat lifecycle

```typescript
// Query seat events
const query = querySeatEvents('TEST-ROOM', '-1h');

// Filter by specific seat operation
const reclaimQuery = {
  ...query,
  parameters: {
    ...query.parameters,
    filters: [
      ...query.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"seat.reclaim"',
      },
    ],
  },
};
```

**Use Cases**:
- Debug seat reservation issues
- Track seat expiration
- Monitor reconnection patterns

---

### 7. Game Events

**Purpose**: Track game state and flow

```typescript
// Query game events
const query = queryGameEvents('TEST-ROOM', '-1h');

// Filter by game phase
const rollQuery = {
  ...query,
  parameters: {
    ...query.parameters,
    filters: [
      ...query.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"game.roll"',
      },
    ],
  },
};
```

**Use Cases**:
- Debug game state issues
- Track game flow
- Monitor game performance

---

## Advanced Query Patterns

### Combining Filters

```typescript
// Query errors for a specific user
const query = {
  queryId: 'user-errors',
  view: 'events',
  parameters: {
    filters: [
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"roomCode":"TEST-ROOM"',
      },
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"userId":"user-123"',
      },
      {
        key: '$metadata.level',
        operation: 'eq',
        type: 'string',
        value: 'error',
      },
    ],
    filterCombination: 'and',
  },
  timeframe: {
    reference: new Date().toISOString(),
    offset: '-1h',
  },
  limit: 50,
};
```

### Performance Calculations

```typescript
// Calculate average broadcast success rate
const query = {
  queryId: 'broadcast-performance',
  view: 'calculations',
  parameters: {
    filters: [
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"broadcast.sent"',
      },
    ],
    calculations: [
      {
        key: 'sentCount',
        keyType: 'number',
        operator: 'avg',
        alias: 'avgSent',
      },
      {
        key: 'totalSockets',
        keyType: 'number',
        operator: 'avg',
        alias: 'avgTotal',
      },
    ],
  },
  timeframe: {
    reference: new Date().toISOString(),
    offset: '-1h',
  },
};
```

### Time Range Queries

```typescript
// Query specific time range
const query = {
  queryId: 'time-range',
  view: 'events',
  parameters: {
    filters: [
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"roomCode":"TEST-ROOM"',
      },
    ],
  },
  timeframe: {
    from: '2025-01-15T10:00:00Z',
    to: '2025-01-15T11:00:00Z',
  },
  limit: 100,
};
```

---

## Debugging Workflows

### Debugging Connection Issues

```typescript
// 1. Query lifecycle events
const lifecycleQuery = queryLifecycleEvents('TEST-ROOM', '-1h');

// 2. Look for disconnect patterns
const disconnectQuery = {
  ...lifecycleQuery,
  parameters: {
    ...lifecycleQuery.parameters,
    filters: [
      ...lifecycleQuery.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"lifecycle.disconnect"',
      },
    ],
  },
};

// 3. Check close codes
// Filter by codeCategory in results
```

### Debugging Storage Issues

```typescript
// 1. Query storage events
const storageQuery = queryStorageEvents('TEST-ROOM', '-1h');

// 2. Check for failures
const failureQuery = {
  ...storageQuery,
  parameters: {
    ...storageQuery.parameters,
    filters: [
      ...storageQuery.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"success":false',
      },
    ],
  },
};

// 3. Check performance
const perfQuery = queryStorageReadPerformance('TEST-ROOM', '-1h');
```

### Debugging Game State Issues

```typescript
// 1. Query game events
const gameQuery = queryGameEvents('TEST-ROOM', '-1h');

// 2. Trace a specific game action
const correlationQuery = queryByCorrelationId('req-abc123', '-1h');

// 3. Check for state transitions
const transitionQuery = {
  ...gameQuery,
  parameters: {
    ...gameQuery.parameters,
    filters: [
      ...gameQuery.parameters.filters,
      {
        key: '$metadata.message',
        operation: 'includes',
        type: 'string',
        value: '"state.transition"',
      },
    ],
  },
};
```

---

## MCP Tool Integration

### Using Cloudflare Observability MCP

```typescript
// Execute query via MCP
const result = await mcp_cloudflare-observability_query_worker_observability({
  query: queryLifecycleEvents('TEST-ROOM', '-1h'),
});

// Process results
if (result.success) {
  const events = result.data.events;
  // Analyze events...
}
```

### Using Context7 for Documentation

```typescript
// Get Cloudflare Workers logging patterns
const docs = await mcp_Context7_get-library-docs({
  context7CompatibleLibraryID: '/websites/developers_cloudflare_workers',
  topic: 'structured logging observability',
  mode: 'code',
});
```

---

## Best Practices

### 1. Use Correlation IDs

Always include `correlationId` in client messages for end-to-end tracing:

```typescript
// Client-side
const message = {
  type: 'DICE_ROLL',
  payload: { kept: [true, false, true, false, false] },
  correlationId: crypto.randomUUID(),
};
```

### 2. Narrow Time Ranges

Use specific time ranges for faster queries:

```typescript
// Good: Specific time range
timeframe: { reference: new Date().toISOString(), offset: '-30m' }

// Avoid: Very wide ranges
timeframe: { reference: new Date().toISOString(), offset: '-7d' }
```

### 3. Filter Early

Add filters to reduce result set:

```typescript
// Good: Filtered query
filters: [
  { key: '$metadata.message', operation: 'includes', type: 'string', value: '"roomCode":"TEST-ROOM"' },
  { key: '$metadata.level', operation: 'eq', type: 'string', value: 'error' },
]

// Avoid: Unfiltered queries (may be slow)
```

### 4. Use Calculations for Metrics

Use `view: 'calculations'` for performance metrics:

```typescript
// Good: Calculate metrics
view: 'calculations',
calculations: [
  { key: 'durationMs', keyType: 'number', operator: 'avg', alias: 'avgDuration' },
]

// Avoid: Calculating in application code
```

---

## Troubleshooting

### No Results Returned

**Possible Causes**:
- Time range too narrow
- Filters too restrictive
- No events in time range
- Wrong room code

**Solutions**:
- Widen time range
- Relax filters
- Check event emission
- Verify room code

### Slow Queries

**Possible Causes**:
- Time range too wide
- Too many unfiltered events
- Complex calculations

**Solutions**:
- Narrow time range
- Add more filters
- Use calculations view
- Limit result count

### Invalid Query Format

**Possible Causes**:
- Wrong filter key names
- Invalid operation types
- Type mismatches

**Solutions**:
- Use `observability_keys` MCP tool to find valid keys
- Check query helper examples
- Verify filter types match data types

---

## References

- **MCP Helpers**: `packages/cloudflare-do/src/lib/observability/mcp-helpers.ts`
- **Event Schemas**: `packages/cloudflare-do/src/lib/observability/events.schema.ts`
- **Cloudflare Observability Docs**: [MCP/workers-observability.md](../../references/cloudflare/MCP/workers-observability.md)
- **Master Workflow**: [observability-workflow.md](observability-workflow.md)

