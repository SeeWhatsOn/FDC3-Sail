
# FDC3-Sail Architecture Refactor - Technical Plan

## Overview

This plan restructures FDC3-Sail into a clean two-layer architecture:
1. **Pure FDC3 Desktop Agent** (`@finos/fdc3-desktop-agent`) - Reusable by anyone
2. **Sail Platform** - Custom implementation built on top

---

## Issue Breakdown

### Epic: FDC3-Sail Architecture Refactor

---

### Issue 1: Rename `apps/sail` to `apps/sail-web`

**Type:** Refactor  
**Priority:** High  
**Estimated effort:** Small

**Description:**
Rename the main web application from `sail` to `sail-web` for consistency with `sail-electron` and `sail-server`.

**Tasks:**
- [ ] Rename `apps/sail/` directory to `apps/sail-web/`
- [ ] Update `package.json` name from `@finos/fdc3-sail-app` to `@finos/fdc3-sail-web`
- [ ] Update root `package.json` workspaces array
- [ ] Update all import paths referencing `@finos/fdc3-sail-app`
- [ ] Update `tsconfig.json` references
- [ ] Update README documentation
- [ ] Update any CI/CD scripts

**Acceptance Criteria:**
- Project builds successfully
- All tests pass
- No broken imports

---

### Issue 2: Rename `sail-api` to `sail-platform-sdk`

**Type:** Refactor  
**Priority:** High  
**Estimated effort:** Medium

**Description:**
Rename and clarify the purpose of `sail-api` package. It's an SDK (tools/implementations), not just an API (interfaces).

**Tasks:**
- [ ] Rename `packages/sail-api/` to `packages/sail-platform-sdk/`
- [ ] Update `package.json` name to `@finos/sail-platform-sdk`
- [ ] Update root `package.json` workspaces
- [ ] Update all import statements across the codebase
- [ ] Update README to clarify purpose:
  - Wraps pure desktop-agent with Sail middleware
  - Provides transport implementations (Socket.IO)
  - Provides platform features (workspaces, layouts, config)
- [ ] Document the relationship: `desktop-agent` (pure) → `sail-platform-sdk` (Sail extensions)

**Acceptance Criteria:**
- Clear documentation of SDK purpose
- All imports updated
- Builds and tests pass

---

### Issue 3: Clean up `desktop-agent` package dependencies

**Type:** Refactor  
**Priority:** High  
**Estimated effort:** Medium

**Description:**
Remove Sail-specific and transport-specific dependencies from the pure desktop-agent package.

**Current dependencies to review:**
```json
{
  "@finos/fdc3": "^2.2.0",              // ✅ Keep - FDC3 types
  "@finos/fdc3-agent-proxy": "...",     // ⚠️ Review
  "@finos/fdc3-schema": "...",          // ✅ Keep - For validation
  "@finos/fdc3-web-impl": "...",        // ⚠️ Review - only using BasicDirectory
  "socket.io": "^4.8.1",                // ❌ Remove - Move to sail-platform-sdk
  "uuid": "^11.1.0",                    // ✅ Keep
  "zod": "^4.1.11"                      // ✅ Keep (or make optional via validator injection)
}
```

**Tasks:**
- [ ] Remove `socket.io` dependency - move `SocketIOTransport` to `sail-platform-sdk`
- [ ] Review `@finos/fdc3-agent-proxy` usage - remove if not essential
- [ ] Review `@finos/fdc3-web-impl` usage - only import what's needed
- [ ] Ensure no Sail-specific types leak into this package
- [ ] Document the "pure package" policy in README

**Acceptance Criteria:**
- `socket.io` not in desktop-agent dependencies
- Package can be used without Sail
- Clear dependency policy documented

---

### Issue 4: Implement validator injection for schema validation

**Type:** Feature  
**Priority:** Medium  
**Estimated effort:** Medium

**Description:**
Replace the brittle Zod schema generator with validator injection. Core stays pure, Sail provides validation.

**Tasks:**
- [ ] Define `MessageValidator` interface in core:
  ```typescript
  interface MessageValidator {
    validate(messageType: string, message: unknown): ValidationResult
  }
  interface ValidationResult {
    valid: boolean
    errors?: string[]
  }
  ```
- [ ] Add optional `validator` to `DesktopAgentConfig`
- [ ] Create default no-op validator (logs warning in dev)
- [ ] Move Zod-based validation to `sail-platform-sdk`
- [ ] Remove/archive `scripts/generate-schemas.ts`
- [ ] Update handlers to use injected validator
- [ ] Use official `@finos/fdc3` types instead of generated Zod types

**Discussion:**
- Is validation required for FDC3 conformance? (Nice-to-have, not required)
- Keep generated schemas as reference but don't use in core

**Acceptance Criteria:**
- Core works without validator (no-op default)
- Sail can inject Zod/AJV validator
- Generated schema code removed or archived

---

### Issue 5: Reorganize `browser/` folder structure

**Type:** Refactor  
**Priority:** Medium  
**Estimated effort:** Small

**Description:**
Clarify the browser Desktop Agent structure by organizing WCP-specific code.

**Proposed structure:**
```
src/
├── core/                           # Pure FDC3 engine
├── transports/
│   └── in-memory-transport.ts      # Generic transport
│
├── browser/                        # Browser Desktop Agent
│   ├── index.ts                    # Exports createBrowserDesktopAgent
│   ├── browser-desktop-agent.ts    # Main factory
│   │
│   └── wcp/                        # WCP internals (coupled)
│       ├── index.ts
│       ├── wcp-connector.ts
│       └── message-port-transport.ts
```

**Tasks:**
- [ ] Create `browser/wcp/` subfolder
- [ ] Move `wcp-connector.ts` to `browser/wcp/`
- [ ] Move `message-port-transport.ts` to `browser/wcp/`
- [ ] Update imports
- [ ] Update package.json exports:
  ```json
  {
    ".": "./dist/src/index.js",
    "./browser": "./dist/src/browser/index.js",
    "./transports": "./dist/src/transports/index.js"
  }
  ```
- [ ] Update documentation

**Discussion item:** 
MessagePortTransport is tightly coupled to WCPConnector by design (WCP spec uses MessagePort). Keeping them together is correct.

**Acceptance Criteria:**
- Clear separation: browser DA is the product, WCP is the mechanism
- All imports work
- Subpath exports work correctly

---

### Issue 6: Move Socket.IO transport to sail-platform-sdk

**Type:** Refactor  
**Priority:** High  
**Estimated effort:** Small

**Description:**
`SocketIOTransport` is Sail-specific (server architecture). Move it to the SDK.

**Tasks:**
- [ ] Create `sail-platform-sdk/src/transports/` folder
- [ ] Move/recreate Socket.IO transport implementation
- [ ] Export from `@finos/sail-platform-sdk/transports`
- [ ] Update `sail-server` imports
- [ ] Remove any socket.io references from desktop-agent

**Acceptance Criteria:**
- `socket.io` not imported by desktop-agent
- sail-server works with SDK transport
- Clean separation maintained

---

### Issue 7: Implement Transport Wrapper for middleware

**Type:** Feature  
**Priority:** Medium  
**Estimated effort:** Medium

**Description:**
Create a transport wrapper pattern in sail-platform-sdk for middleware (auth, logging, metrics) without modifying core desktop-agent.

**Tasks:**
- [ ] Create `MiddlewareTransport` class in sail-platform-sdk:
  ```typescript
  class MiddlewareTransport implements Transport {
    constructor(inner: Transport, middlewares: Middleware[])
    // Intercepts send() and onMessage() to run middleware
  }
  ```
- [ ] Define `Middleware` interface:
  ```typescript
  interface Middleware {
    beforeSend?: (message: unknown) => unknown
    beforeHandle?: (message: unknown) => Promise<unknown>
    afterHandle?: (message: unknown) => Promise<void>
  }
  ```
- [ ] Create example middlewares:
  - [ ] `LoggingMiddleware`
  - [ ] `AuthMiddleware` (placeholder)
  - [ ] `MetricsMiddleware` (placeholder)
- [ ] Document the middleware pattern

**Acceptance Criteria:**
- Middleware works without modifying core desktop-agent
- Auth/logging can be added at Sail layer
- Pattern documented with examples

---

### Issue 8: Set up Docusaurus documentation site

**Type:** Documentation  
**Priority:** Low  
**Estimated effort:** Medium

**Description:**
Create a Docusaurus documentation site in `docs/` folder.

**Tasks:**
- [ ] Initialize Docusaurus in `docs/`
- [ ] Create documentation structure:
  ```
  docs/
  ├── docs/
  │   ├── getting-started/
  │   ├── architecture/
  │   ├── packages/
  │   │   ├── desktop-agent.md
  │   │   ├── sail-platform-sdk.md
  │   │   └── sail-ui.md
  │   └── guides/
  └── docusaurus.config.js
  ```
- [ ] Migrate relevant README content
- [ ] Add architecture diagrams
- [ ] Update package READMEs to link to docs site
- [ ] Configure for GitHub Pages deployment

**Acceptance Criteria:**
- Docs site builds and deploys
- Key concepts documented
- Package docs available

---

### Issue 9: Port desktop-agent tests to Cucumber/Gherkin

**Type:** Testing  
**Priority:** Medium  
**Estimated effort:** Large

**Description:**
Add BDD-style tests using Cucumber/Gherkin that align with FDC3 specification language.

**Tasks:**
- [ ] Add Cucumber dependencies to desktop-agent
- [ ] Create test structure:
  ```
  packages/desktop-agent/
  ├── test/
  │   ├── features/
  │   │   ├── channels.feature
  │   │   ├── context.feature
  │   │   └── intents.feature
  │   └── steps/
  │       ├── channel-steps.ts
  │       ├── context-steps.ts
  │       └── intent-steps.ts
  ```
- [ ] Port/adapt tests from `@finos/fdc3-web-impl`
- [ ] Align feature files with FDC3 spec language
- [ ] Add to CI pipeline
- [ ] Track compliance percentage

**Acceptance Criteria:**
- Cucumber tests running in CI
- Tests match FDC3 spec language
- Clear compliance tracking

---

### Issue 10: Update all README files

**Type:** Documentation  
**Priority:** Medium  
**Estimated effort:** Small

**Description:**
Update README files across all packages to reflect new architecture.

**Tasks:**
- [ ] Root README - Architecture overview, quick start
- [ ] desktop-agent README:
  - [ ] Clarify "pure FDC3" positioning
  - [ ] Document subpath exports (./browser, ./transports)
  - [ ] Add usage examples for different environments
- [ ] sail-platform-sdk README:
  - [ ] Document relationship to desktop-agent
  - [ ] Middleware documentation
  - [ ] Transport implementations
- [ ] sail-web README - Application setup
- [ ] sail-ui README - Component library docs

**Acceptance Criteria:**
- All READMEs accurate and helpful
- Clear architecture explanation
- Working code examples

---

## Dependency Order

```
1. Issue 1: Rename sail → sail-web (no deps)
2. Issue 2: Rename sail-api → sail-platform-sdk (no deps)
3. Issue 3: Clean desktop-agent deps (depends on 2)
4. Issue 6: Move Socket.IO transport (depends on 2, 3)
5. Issue 5: Reorganize browser/ folder (no deps)
6. Issue 4: Validator injection (depends on 3)
7. Issue 7: Transport wrapper middleware (depends on 2, 6)
8. Issue 9: Cucumber tests (depends on 3, 4)
9. Issue 8: Docusaurus (no deps, can run parallel)
10. Issue 10: Update READMEs (depends on all above)
```

---

## Out of Scope (Future)

- Full FDC3 conformance test suite (tests currently broken upstream)
- Moving dockview layout to sail-ui (stays in sail-web)
- Zero-dependency core (Zod acceptable)
- Separate desktop-agent-browser package (subpaths work fine)

---

**Ready to copy to GitHub?** Let me know if you want any adjustments to the issues or priority ordering.