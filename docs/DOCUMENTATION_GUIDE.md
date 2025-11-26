# Documentation Guide

## For Contributors: Where to Find/Add Documentation

This guide helps you navigate the FDC3 Sail documentation structure and know where to add new docs.

---

## Documentation Structure

```
docs/
├── README.md                          # Main entry point - START HERE
├── DEVELOPMENT.md                     # Developer setup and contribution guide
├── DOCUMENTATION_GUIDE.md             # This file
└── architecture/
    ├── OVERVIEW.md                    # System architecture overview
    └── packages/
        ├── DESKTOP_AGENT.md           # Desktop Agent package deep dive
        └── SAIL_API.md                # Sail API package deep dive

packages/
├── desktop-agent/
│   └── README.md                      # Package README with usage examples
├── sail-api/
│   └── README.md                      # Package README with usage examples
└── sail-ui/
    └── README.md                      # Package README
```

---

## When to Update What

### You're Adding a New Feature

**If it's FDC3-related (context, intents, channels)**:
1. Update [docs/architecture/packages/DESKTOP_AGENT.md](./architecture/packages/DESKTOP_AGENT.md)
2. Add usage example to [packages/desktop-agent/README.md](../packages/desktop-agent/README.md)
3. Consider updating [docs/architecture/OVERVIEW.md](./architecture/OVERVIEW.md) if architecture changes

**If it's Sail platform-related (workspaces, layouts, middleware)**:
1. Update [docs/architecture/packages/SAIL_API.md](./architecture/packages/SAIL_API.md)
2. Add usage example to [packages/sail-api/README.md](../packages/sail-api/README.md)

**If it's UI-related**:
1. Update [packages/sail-ui/README.md](../packages/sail-ui/README.md)

### You're Fixing a Bug

**If the bug reveals a design decision**:
1. Add brief explanation to relevant architecture doc
2. Update package README if usage pattern changes

**If it's just a bug fix**:
- No doc updates needed (unless behavior changes)

### You're Changing Architecture

**If you're changing how components communicate**:
1. Update [docs/architecture/OVERVIEW.md](./architecture/OVERVIEW.md)
2. Update relevant package docs

**If you're adding a new package**:
1. Create `docs/architecture/packages/YOUR_PACKAGE.md`
2. Add package README with usage examples
3. Update [docs/README.md](./README.md) to link to new package

### You're Writing a Tutorial

Add to [docs/README.md](./README.md) under "Common Use Cases" section

---

## Documentation Tiers

### Tier 1: Quick Start (docs/README.md)

**Audience**: First-time users, developers evaluating the project

**Content**:
- Installation instructions
- Quick start example
- Links to deeper docs
- Common use cases with code snippets

**Length**: Aim for 5-minute read

### Tier 2: Architecture Overview (docs/architecture/OVERVIEW.md)

**Audience**: Developers who want to understand the system design

**Content**:
- High-level architecture diagrams
- Design principles and decisions
- Component interactions
- Why things are the way they are

**Length**: 15-20 minute read

**Key Principle**: Focus on **understanding**, not exhaustive details

### Tier 3: Package Deep Dives (docs/architecture/packages/*.md)

**Audience**: Developers contributing to specific packages

**Content**:
- Package structure in detail
- Design decisions specific to the package
- Internal component architecture
- Testing strategies
- Extension points

**Length**: 20-30 minute read per package

**Key Principle**: Focus on **implementation details** and **developer needs**

### Tier 4: Package READMEs (packages/*/README.md)

**Audience**: Developers using the package as a library

**Content**:
- Installation
- API reference
- Usage examples
- Configuration options
- Common patterns

**Length**: 10-15 minute read

**Key Principle**: **Practical usage** over theory

---

## Writing Guidelines

### Use Code Examples

**Good**:
```markdown
Create a Desktop Agent:

\`\`\`typescript
import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'

const agent = new DesktopAgent({ transport })
agent.start()
\`\`\`
```

**Bad**:
```markdown
To create a Desktop Agent, import the DesktopAgent class and instantiate it.
```

### Explain Design Decisions Briefly

**Good**:
```markdown
### Why No EventEmitter in Core?

Desktop Agent core has no EventEmitter because:
- Keeps it pure and dependency-free
- Events are environment-specific

Wrappers add EventEmitter where needed.
```

**Bad** (too detailed for architecture doc):
```markdown
We considered using EventEmitter in the core but decided against it after
evaluating performance implications and discovering that Node.js EventEmitter
doesn't work in browsers without polyfills...
[3 more paragraphs]
```

**Also Bad** (no explanation):
```markdown
Desktop Agent has no EventEmitter.
```

### Use Diagrams Sparingly

**When to use diagrams**:
- Message flows between components
- System architecture overview
- State transitions

**When NOT to use diagrams**:
- Simple object hierarchies (use code instead)
- Lists (use bullet points)
- Linear processes (use numbered lists)

### Link Liberally

**Do link**:
- To related architecture docs
- To package READMEs
- To external specs (FDC3, etc.)
- To code files for examples

**Don't link**:
- To every occurrence of a term
- To obvious things (npm install)

---

## Maintaining Documentation

### Before Each Release

1. ✅ Check all code examples still work
2. ✅ Update version numbers in examples
3. ✅ Review Quick Start guide
4. ✅ Ensure API changes are documented

### Monthly Review

1. ✅ Check for outdated information
2. ✅ Review issues for documentation requests
3. ✅ Update based on common questions

### After Major Architecture Changes

1. ✅ Update [docs/architecture/OVERVIEW.md](./architecture/OVERVIEW.md)
2. ✅ Update affected package docs
3. ✅ Add migration guide if breaking changes
4. ✅ Update all related code examples

---

## Documentation Checklist

When adding new documentation, ensure:

- [ ] Code examples are complete and runnable
- [ ] Links to related docs are included
- [ ] Design decisions are briefly explained
- [ ] Tier is appropriate for audience
- [ ] Examples use latest API patterns
- [ ] Spelling and grammar checked
- [ ] Markdown formatting is consistent

---

## Questions?

If you're unsure where documentation belongs:

1. **Is it usage?** → Package README
2. **Is it design?** → Architecture doc
3. **Is it onboarding?** → docs/README.md
4. **Is it setup?** → DEVELOPMENT.md

Still unsure? Ask in GitHub issues or discussions!
