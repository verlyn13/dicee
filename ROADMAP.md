# Dicee Roadmap

## Current Phase: Documentation-First

Establishing architectural contracts before implementation.

## Canonical RFCs

| RFC | Title | Status |
|-----|-------|--------|
| 001 | Statistical Engine Architecture | Draft |
| 002 | UI/UX Canvas & Design System | Draft |
| 003 | Data Contracts & Event Schema | Draft |

## Deferred RFCs

These will be specified when implementation approaches:

| RFC | Title | Scope |
|-----|-------|-------|
| 004 | Decision Engine | Strategy recommendation, Bellman optimization |
| 005 | Adaptive Learning Model | Player skill assessment, difficulty scaling |
| 006 | Telemetry Implementation | Metrics, observability, analytics |
| 007 | API Integration | External services, authentication |

## Implementation Phases

### Phase 1: Core Engine
- RFC-001 implementation (Rust/WASM probability engine)
- RFC-003 event schema foundation
- Basic validation suite

### Phase 2: Decision Layer
- RFC-004 specification and implementation
- Strategy recommendation system
- Expected value optimization

### Phase 3: User Interface
- RFC-002 design system implementation
- Svelte 5 application scaffold
- Accessibility compliance

### Phase 4: Learning & Telemetry
- RFC-005 adaptive learning
- RFC-006 telemetry pipeline
- Analytics dashboard

## Governance

- RFCs are architectural contracts
- No implementation before RFC acceptance
- One fact lives in one place
