# Documentation Archive

> **Status**: Historical documentation (completed work, past migrations, research)
> **Created**: 2025-12-16
> **Purpose**: Preserve historical context while keeping active docs focused on current state

This directory contains documentation from completed work, past migrations, and exploratory research. These documents provide valuable historical context but should **not** be used as current implementation guides.

---

## Directory Structure

```
archive/
├── migration-guides/    # Completed migration plans (CF Pages, DOs, etc.)
├── milestone-1/         # M1 planning docs (now superseded by current state)
├── ux-design/           # Past UX research and design iterations
├── feature-plans/       # Feature implementation plans (completed or superseded)
├── research/            # Exploratory research and investigations
└── debug-reports/       # Session-specific debugging investigations
```

---

## For Current Documentation

See the main `/docs` directory for:
- **Architecture**: `/docs/architecture/` - Current production architecture
- **References**: `/docs/references/` - Cloudflare, MCP, Zod 4 references
- **RFCs/ADRs**: `/docs/rfcs/` - Architectural Decision Records
- **Testing**: `/docs/testing/` - Current testing workflows
- **Planning**: `/docs/planning/` - Active planning documents

---

## Usage Guidelines

### When to Archive a Document

Archive a document when:
1. The migration/refactor is **complete** and merged to production
2. The feature plan has been **fully implemented**
3. The research led to a decision (documented in RFCs) and is no longer exploratory
4. The document describes a **past state** that no longer reflects reality

### When to Keep a Document Active

Keep a document active when:
1. It describes **current production architecture** (e.g., `MULTIPLAYER_PERSISTENCE_ARCHITECTURE.md`)
2. It's an **operational guide** (debugging, deployment checklists)
3. It's a **reference document** (API docs, MCP guides)
4. It's an **active plan** for in-progress work

### Labeling Archived Documents

When moving docs to the archive, add a header:

```markdown
> **ARCHIVED**: [Date]
> **Reason**: [Migration complete | Feature implemented | Superseded by X]
> **Current Documentation**: See `/docs/path/to/current/doc.md`
```

---

## Archive Contents Summary

### Migration Guides
- **unified-cloudflare-stack.md**: Vercel → Cloudflare Pages migration (COMPLETED 2024-12)
- **dicee-do-migration-guide.md**: PartyKit → Durable Objects migration (COMPLETED 2024-12)
- **lobby-ux-ui-refactor.md**: Lobby UX refactor implementation (COMPLETED 2024-12)

### Milestone 1 (M1)
- Multiplayer implementation guides (superseded by `MULTIPLAYER_PERSISTENCE_ARCHITECTURE.md`)
- Auth implementation plans
- Project management checklists

### UX Design
- **UI-UX-MAKEOVER.md**: Past UX redesign iterations
- **UI-UX-DESIGN-REPORT.md**: Design research reports
- **improved-ux-plan.md**: UX improvement plans (implemented)
- **ux-audit-workflow.md**: UX audit methodologies

### Feature Plans
- **game-lobby-chat.md**: Chat implementation plan (IMPLEMENTED)
- **spectator-in-and-out.md**: Spectator mode exploration (NOT IMPLEMENTED)
- **settings-preferences-plan.md**: Settings feature plan (PARTIAL)
- **the-gallery.md**: Gallery feature plan (NOT IMPLEMENTED)
- **haptic-audio.md**: Haptic feedback plan (PARTIAL)

### Research
- **ANIMATION-RESEARCH-REPORT.md**: Animation research
- **session-handling-research.md**: Session handling investigation
- **ai-players*.md**: AI player research and planning
- **chat-mobile-ux-investigation.md**: Mobile chat UX investigation

### Debug Reports
- **quick-play-debug-report.md**: Quick Play AI integration debugging (2024-12-09)

---

## Maintenance

This archive should be reviewed periodically (quarterly) to:
1. Ensure recent completions are archived
2. Remove truly obsolete docs that no longer provide value
3. Update cross-references to current documentation
