# Phase 6: Telemetry System

> **Version**: 1.0.0
> **Created**: 2025-12-06
> **Completed**: 2025-12-07
> **Status**: Complete
> **Prerequisites**: Phase 5 complete, Supabase schema exists

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Existing Infrastructure](#2-existing-infrastructure)
3. [Architecture](#3-architecture)
4. [Implementation Plan](#4-implementation-plan)
5. [Event Types](#5-event-types)
6. [Privacy Considerations](#6-privacy-considerations)
7. [Success Criteria](#7-success-criteria)

---

## 1. Executive Summary

### 1.1 Scope

Phase 6 implements a privacy-respecting telemetry system for UX metrics and learning analytics, following RFC-003's three-stream architecture.

| Component | Purpose | Priority |
|-----------|---------|----------|
| Telemetry Service | Client-side event collection | High |
| Session Management | Anonymous session tracking | High |
| Event Batching | Efficient network usage | Medium |
| Game Flow Integration | Automatic event capture | Medium |
| RLS Policies | Data access security | High |

### 1.2 Out of Scope

- Real-time analytics dashboard (future)
- A/B testing framework (future)
- Custom event definitions (users can extend later)

---

## 2. Existing Infrastructure

### 2.1 Database Schema

The `telemetry_events` table already exists in Supabase:

```sql
CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_telemetry_timestamp ON telemetry_events(timestamp);
CREATE INDEX idx_telemetry_session ON telemetry_events(session_id);
CREATE INDEX idx_telemetry_type ON telemetry_events(event_type);
CREATE INDEX idx_telemetry_user ON telemetry_events(user_id) WHERE user_id IS NOT NULL;

-- 30-day retention cleanup
CREATE OR REPLACE FUNCTION cleanup_old_telemetry() RETURNS void AS $$
BEGIN
  DELETE FROM telemetry_events WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

### 2.2 TypeScript Types (Auto-generated)

```typescript
// From packages/web/src/lib/types/database.ts
telemetry_events: {
  Row: {
    id: string;
    session_id: string;
    user_id: string | null;
    event_type: string;
    payload: Json;
    page_url: string | null;
    referrer: string | null;
    user_agent: string | null;
    timestamp: string;
  };
  Insert: { /* ... */ };
  Update: { /* ... */ };
}
```

---

## 3. Architecture

### 3.1 Three-Stream Model (RFC-003)

| Stream | Retention | Purpose | Storage |
|--------|-----------|---------|---------|
| Domain | Permanent | Game state reconstruction | `games`, `rooms` |
| Analysis | 90 days | Computational results | `analysis_events` |
| Telemetry | 30 days | UX metrics, learning | `telemetry_events` |

### 3.2 Service Architecture

```
Browser
├── TelemetryService (singleton)
│   ├── Session manager (UUID, browser fingerprint)
│   ├── Event queue (batching)
│   ├── Network adapter (Supabase client)
│   └── Privacy controls (consent, anonymization)
│
├── Game Components
│   ├── Auto-track: page views, session start/end
│   ├── Manual track: game events, user actions
│   └── Svelte lifecycle integration
│
└── Supabase
    └── telemetry_events table
```

### 3.3 Data Flow

```
User Action → TelemetryService.track()
                    ↓
              Event Queue (batch)
                    ↓
              Flush (every 5s or 10 events)
                    ↓
              Supabase Insert
```

---

## 4. Implementation Plan

### Day 1: Core Telemetry Service

- [x] Create `TelemetryService` class
- [x] Implement session ID management (localStorage + crypto)
- [x] Add event batching with configurable flush interval
- [x] Handle offline/online transitions

### Day 2: Event Types & RLS

- [x] Define event type constants (RFC-003 aligned)
- [x] Create typed payload interfaces
- [x] Add RLS policies for telemetry_events
- [x] Add privacy helper (anonymize user data)

### Day 3: Game Flow Integration

- [x] Add telemetry hooks to game lifecycle
- [x] Track key user actions (roll, score, hint)
- [x] Track page navigation
- [x] Add opt-out mechanism

### Day 4: Testing & Commit

- [x] Write unit tests for TelemetryService
- [x] Integration test with Supabase
- [x] Verify RLS policies
- [x] Update documentation
- [x] Commit and push

---

## 5. Event Types

### 5.1 Session Events

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `session_start` | Page load | `{ entry_page, referrer }` |
| `session_end` | Page unload | `{ duration_ms, page_count }` |
| `page_view` | Route change | `{ page, previous_page }` |

### 5.2 Game Events (RFC-003 Telemetry Stream)

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `game_start` | Game begins | `{ mode, player_count }` |
| `roll` | Dice rolled | `{ turn, roll_number, time_since_last }` |
| `category_hover` | Hover over category | `{ category, duration_ms }` |
| `category_score` | Category selected | `{ category, points, was_optimal }` |
| `hint_requested` | User asks for hint | `{ context }` |
| `game_complete` | Game ends | `{ final_score, duration_ms }` |

### 5.3 Learning Events

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `decision_quality` | After scoring | `{ quality, ev_difference }` |
| `prediction` | User predicts outcome | `{ predicted, actual, accuracy }` |

---

## 6. Privacy Considerations

### 6.1 Data Minimization

- No PII in payloads (no names, emails)
- Session IDs are random UUIDs (not fingerprints)
- User IDs only stored if authenticated
- IP addresses NOT stored

### 6.2 Consent

- Telemetry enabled by default for anonymous sessions
- Clear opt-out in settings
- Consent stored in localStorage

### 6.3 RLS Policies

```sql
-- Users can only read their own telemetry
CREATE POLICY "Users can read own telemetry"
ON telemetry_events FOR SELECT
USING (auth.uid() = user_id);

-- Authenticated users can insert their own events
CREATE POLICY "Users can insert own telemetry"
ON telemetry_events FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Anonymous users can insert events (no user_id)
CREATE POLICY "Anonymous can insert telemetry"
ON telemetry_events FOR INSERT
WITH CHECK (user_id IS NULL);
```

### 6.4 Data Retention

- Automatic 30-day cleanup via `cleanup_old_telemetry()`
- Scheduled via Supabase pg_cron (future)

---

## 7. Success Criteria

### Phase 6 Exit Criteria

| Criterion | Metric |
|-----------|--------|
| Service Functional | Events stored in Supabase |
| Batching Works | Events batched before send |
| Session Tracking | Session ID persists across page loads |
| Privacy Compliant | No PII in telemetry, opt-out works |
| RLS Configured | Policies block unauthorized access |
| Tests Pass | Unit and integration tests |

### Verification Commands

```bash
# Run tests
pnpm test

# Check TypeScript
pnpm --filter @dicee/web check

# Verify database
supabase db reset && supabase gen types --local
```

---

**Document Status**: Complete

**Completed**: 2025-12-07

**Key Commits**:
- `5c74276` - feat(telemetry): add Phase 6 telemetry system
- `57c5cfb` - feat(telemetry): add game flow tracking and scheduled cleanup
