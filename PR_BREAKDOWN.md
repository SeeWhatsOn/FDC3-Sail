# FDC3 Sail Monorepo Refactoring - PR Categorization

This document categorizes 170 commits from the monorepo refactoring effort into 12 logical PR groups, following the journey of transforming FDC3 Sail into a structured monorepo architecture.

---

## Phase 1: Foundation & Tooling

**PR Title:** `chore: establish monorepo foundation with workspace configuration and tooling`

**Commits:**
- `0b6bee26` - Refactor package structure and update configurations for socket integration
- `1e01e462` - Update configuration files and improve code formatting
- `15c843b1` - Refactor and optimize code across multiple packages - linting fixes
- `97cf3b52` - Enhance ESLint configuration and improve error handling across packages - linting fixes
- `04800b4a` - Update TypeScript configuration across multiple packages
- `9e459557` - Update configuration files for Prettier and ESLint integration
- `142d76af` - Refactor code for improved readability and consistency - formatting (Prettier)
- `20d36e5d` - Update .gitignore and TypeScript configuration files
- `6fbc6078` - ignore linting test files for now
- `1529e713` - removing bun
- `89aa59b7` - Update package dependencies and testing setup
- `82df2035` - refactor updated
- `6a816d64` - Enhance TypeScript support and improve callback handling
- `ff768449` - #180 Split socket server into dedicated package (#188)
- `581f9e0d` - Update package dependencies and configuration for improved compatibility

**Total Files Changed:** 330
**Total Line Changes:** +14,654 / -10,816

**Description:**
Reviewers will see the foundational setup for a modern monorepo. This includes workspace configuration (npm workspaces), comprehensive linting setup (ESLint), code formatting (Prettier), TypeScript configurations across packages, .gitignore updates, testing infrastructure (Vitest), and dependency management. No functional code changes - purely tooling and configuration to support the monorepo structure.

---

## Phase 2: Example Apps Reorganization

**PR Title:** `refactor: reorganize example applications into apps/example-fdc3-apps`

**Commits:**
- `596157ae` - Moved examples into their own package Moved from web to examples - Benzinga, Polygon, TradingView, and Training. Cleaned up unused components and styles across the training and Yahoo news applications.
- `b52e8158` - small changes to readme
- `2d8a03bc` - add the training apps and restructure to work.
- `3250c864` - Add a run script at the top level package.json for the example apps server
- `2c556a51` - Merge branch 'main' into socket-split
- `ef79f620` - Merge branch '#181' of https://github.com/Elgin-White/fdc3-sail into dev-cw
- `d13a4d6a` - 181- Reorganize example applications (#189)
- `cb3add0d` - Rename example applications and server folders

**Total Files Changed:** 118
**Total Line Changes:** +8,005 / -67

**Description:**
Reviewers will see the migration of all example FDC3 applications from `packages/web` to a new `apps/example-fdc3-apps` structure. This includes Benzinga, Polygon, TradingView, Yahoo News, and Training applications. Directory structure is reorganized for better clarity, unused components are removed, and npm scripts are updated to work with the new locations.

---

## Phase 3: Electron App Refactoring

**PR Title:** `refactor(electron): modernize electron app with preload integration and window management`

**Commits:**
- `c44979a3` - Refactor Electron package structure and update dependencies. Removed preload package, integrated its functionality into the Electron app, and updated scripts for development. Enhanced loading screen with improved UI and preload status checks. Updated package versions for Electron and related dependencies.
- `b155241d` - Enhance Electron window configuration by hiding the default title bar and exposing window controls for Windows/Linux platforms.
- `1fdbe19b` - Refactor Electron main window to utilize BaseWindow and WebContentsView for enhanced title bar and content management. Update loading screen structure for improved UI. Remove obsolete tsconfig.tsbuildinfo file.
- `ecb6c66f` - Merge pull request #183 from SeeWhatsOn/#178

**Total Files Changed:** 23
**Total Line Changes:** +1,306 / -4,341

**Description:**
Reviewers will see significant modernization of the Electron app. The separate `preload` package is removed and integrated directly into the Electron app. Window management is enhanced with BaseWindow and WebContentsView APIs, custom title bar implementation for Windows/Linux, and an improved loading screen with preload status checks. Dependencies are updated to latest Electron versions.

---

## Phase 4: Server & Socket Refactoring

**PR Title:** `refactor(socket): separate socket server and enhance service architecture`

**Commits:**
- `170bba21` - Update socket package and refactor service integration
- `1895d5f4` - Refactor tests to use async/await, enhance error handling in SailDirectory, and update application data structures in test files
- `90282215` - Add end-to-end integration tests for Desktop Agent workflows and error handling
- `05c7fd27` - Refactor SailFDC3Server to improve code readability and structure
- `5a98a08a` - Refactor initSocketService to improve readability and maintainability
- `f22b37d8` - feat: Implement socket handlers for channel management, desktop agent, and electron integration
- `13ea4d27` - Refactor socket handlers and improve error handling
- `fa98aa89` - feat: Refactor socket handlers and introduce centralized configuration constants
- `b678f345` - feat(socket): refactor and enhance socket handling and directory management
- `b6c0963d` - feat: Replace SailDirectory with AppDirectoryManager and refactor related tests
- `b75afe01` - Renaming Classes and Methods
- `57203709` - Fixing linting, types and formatting
- `c017000d` - type issues in tests
- `01d814da` - removed file
- `69f8b608` - feat: refactor shared package structure and consolidate message types
- `046ed811` - fix formatting
- `caffd951` - Refactor import paths for SailFDC3Server across socket package tests and implementation files
- `489be93f` - Remove outdated testing setup and utility files; update Vitest configuration for improved test organization and coverage reporting
- `c16c4347` - Refactor testing setup and improve component structure

**Total Files Changed:** 132
**Total Line Changes:** +9,021 / -6,573

**Description:**
Reviewers will see the separation of socket server logic into a dedicated package, comprehensive handler refactoring (channel management, desktop agent, electron integration), introduction of centralized configuration constants, renaming of SailDirectory to AppDirectoryManager, enhanced error handling, end-to-end integration tests, and improved code organization with async/await patterns throughout.

---

## Phase 5: New Desktop Agent Package

**PR Title:** `feat(desktop-agent): create @finos/desktop-agent with FDC3 2.2 core state management`

**Commits:**
- `0f8c14f0` - Reorganize codebase following KISS principles
- `050ab61a` - Remove shared package references from desktop-agent
- `5f405af0` - Fix FDC3 channel handlers compilation errors
- `11efd2e5` - Implement unified Socket.IO protocol convention
- `0c1d8fec` - Implement AppInstanceRegistry for FDC3 state management
- `cada2d6c` - Implement IntentRegistry for FDC3 intent management
- `ac2d68bf` - Export state management registries and update build configuration
- `83a1b93b` - Add comprehensive unified protocol documentation
- `53f3c91a` - Update type definitions and app directory integration
- `351204e3` - Refactor package structure and update type checking
- `b97beca9` - refactor(agent): Decouple FDC3 engine from transport layer
- `b9738251` - feat(desktop-agent): implement complete intent event flow with intentEvent and intentResultRequest
- `29edb126` - fix(desktop-agent): register and fix app management handlers
- `b224c570` - feat(desktop-agent): implement findIntentsByContextRequest handler
- `f2651c07` - feat(desktop-agent): implement getCurrentContextRequest handler
- `beb67e87` - feat(desktop-agent): implement raiseIntentForContextRequest handler
- `41a06330` - feat(desktop-agent): implement DA-level event listeners with channelChanged broadcasting
- `f3bc1dca` - feat(desktop-agent): create PrivateChannelRegistry infrastructure
- `4015bf3e` - feat(desktop-agent): implement private channel handlers
- `de6ad9f8` - refactor(desktop-agent): introduce dependency injection architecture
- `5b0bc25a` - feat(desktop-agent): implement channel context storage and app channels
- `c0101829` - feat(desktop-agent): replace mock channel data with UserChannelRegistry
- `a5d62956` - feat(desktop-agent): implement heartbeat mechanism for health monitoring
- `e1323749` - feat(desktop-agent): implement FDC3-spec-compliant schema generator
- `afc4eea3` - fix(desktop-agent): update handlers for new schema types
- `728f2a6d` - fix(desktop-agent): fix all handler TypeScript errors per FDC3 spec
- `e5be6075` - fix(desktop-agent): update enum handling in schema generator for Zod v4 compliance
- `3030f7c8` - refactor(desktop-agent): remove deprecated DACP handlers and reorganize imports
- `12efd1fa` - refactor(desktop-agent): streamline app launch request and result types
- `e0dea712` - refactor(desktop-agent): remove obsolete transport layer and streamline exports
- `29258717` - restore(desktop-agent): update DACP handler context and streamline type definitions
- `0bbb92f3` - refactor(dacp): standardize string quotes and enhance error handling in handlers
- `d35394d9` - refactor(desktop-agent): remove obsolete transport and entry point files

**Total Files Changed:** 229
**Total Line Changes:** +16,147 / -7,464

**Description:**
Reviewers will see the creation of a new `packages/desktop-agent` package implementing FDC3 2.2 Desktop Agent Protocol (DACP) compliance. This includes core state management (AppInstanceRegistry, IntentRegistry, PrivateChannelRegistry, UserChannelRegistry), comprehensive DACP handler implementations (23 handlers covering 70% of spec), schema generation from FDC3 JSON schemas, dependency injection architecture, transport layer decoupling, heartbeat health monitoring, and complete intent workflow with event broadcasting.

---

## Phase 6: New Sail API Package

**PR Title:** `feat(sail-api): create @finos/sail-api with transport abstractions and client/server architecture`

**Commits:**
- `5748fa5c` - feat(arch): introduce @sail-api and refactor server handlers
- `3936dd12` - feat(api): add @finos/sail-api package and update workspace configuration
- `da48aa9f` - feat(api): expand Sail API with server exports and refactor SailClient
- `0c9159e8` - feat(sail-api): add Sail-specific Desktop Agent adapters and wrapper
- `bbbf471b` - feat(transport): introduce @finos/fdc3-dacp-transport package with Socket.IO and MessagePort adapters

**Total Files Changed:** 50
**Total Line Changes:** +3,012 / -1,392

**Description:**
Reviewers will see the creation of a new `packages/sail-api` package that provides transport abstractions and client/server architecture. This includes the SailClient for client-side integration, SailDesktopAgent wrapper combining FDC3 Desktop Agent with Sail-specific transports, Socket.IO and MessagePort transport adapters, and clean separation between transport layer and business logic.

---

## Phase 7: New Sail UI Package

**PR Title:** `feat(sail-ui): create @finos/sail-ui with shadcn components and theme system`

**Commits:**
- `4adbce2d` - Adding ui packge with Shadcn UI
- `c56998c7` - Update sail-ui and example-fdc3-apps with various enhancements
- `401e03ce` - Refactor App component and update imports for improved clarity
- `0f81bff7` - Integrate Tailwind CSS and enhance layout structure
- `9ef1c4ef` - Refactor AppSidebar and update CSS imports for improved functionality
- `82498ced` - Update package dependencies and clean up CSS imports
- `528a10df` - Enhance CSS imports for development and organization
- `83083fde` - Integrate new Radix UI components and enhance project structure
- `fb202e62` - Refactor HeaderBar and AppSidebar to use SailLogoButton component
- `d7539942` - Remove FDC3Panel export from fdc3-iframe and update import path in dockViewSail component
- `cea66cde` - Refactor AppSidebar and ModeToggle imports for improved organization
- `55503e97` - Update dependencies and enhance testing configuration
- `95a09506` - Enhance AppSidebar with new Workspaces feature and Logo component
- `1a785523` - add a sail logo component
- `e1cac7db` - Enhance AppSidebar and introduce sail-theme CSS
- `12a9ce63` - Refactor HeaderBar and AppSidebar to use Logo component
- `99c2e59a` - Add DefaultTabComponent for improved layout in dockViewSail
- `f268f787` - Add LogoSail component and update styles
- `7aeaa7fd` - Refactor components to use LogoSail for improved branding
- `eee7cff1` - Add DM Sans font files and update sail-theme styles

**Total Files Changed:** 160
**Total Line Changes:** +25,979 / -3,422

**Description:**
Reviewers will see the creation of a new `packages/sail-ui` package built on shadcn/ui component library. This includes Radix UI primitives integration, Tailwind CSS theme system with sail-theme CSS variables, Logo components (SailLogoButton, LogoSail), sidebar and header components, DM Sans font integration, dark/light mode toggle, and comprehensive component library setup with testing infrastructure.

---

## Phase 8: New Sail App

**PR Title:** `feat(sail-app): create apps/sail with modern react architecture and workspace management`

**Commits:**
- `5f43d3a0` - Added a sail-layout package to house all the HUD
- `a6906a1a` - Update sail-layout package and clean up App component
- `04a4d8a3` - Enhance sail-layout package with testing setup and Dockview integration
- `54ee6c68` - Complete Dockview migration with clean FDC3 integration
- `2171601a` - Remove sail-layout package and associated files
- `33a19ec4` - Refactor sail-app structure and update imports
- `225b2994` - Refactor DockviewSail and App components to utilize Zustand store
- `b0d10ce7` - Remove unused FDC3Panel, layout grid components, and related configurations
- `d7e4bd00` - Refactor App component and remove DockviewSail
- `0720e0ae` - Enhance sail-app with new features and improvements
- `865289fc` - Fix TypeScript and ESLint error detection issues
- `8bf819e6` - linting & formatting fixes
- `2e58f099` - Add full-screen app directory overlay feature
- `a7033a5f` - Enhance app launching logic in AppDirectory component
- `f6e30537` - Add QuickAccessPanel with workspace directory and refactor overlay system
- `fe3a077f` - Refactor sail-app configuration and enhance functionality
- `fb9ed322` - Add WCP Test Component with HTML, CSS, and TypeScript files

**Total Files Changed:** 195
**Total Line Changes:** +24,831 / -19,569

**Description:**
Reviewers will see the creation of a new `apps/sail` application built with modern React architecture. This includes Dockview integration for layout management, Zustand store for state management, full-screen app directory overlay, QuickAccessPanel with workspace directory, enhanced app launching logic, React components for sidebar/header/panels, hooks for FDC3 integration, theme support, WCP test component, and comprehensive cleanup of deprecated layout code.

---

## Phase 9: New Sail Server

**PR Title:** `feat(sail-server): create apps/sail-server with streamlined initialization`

**Commits:**
- `9b9d2986` - refactor(server): remove deprecated files and streamline server initialization
- `a810f523` - feat(dacp): implement getInfoRequest handler for FDC3 implementation metadata
- `a44f2f2c` - refactor(server): streamline Sail Server initialization and enhance transport handling
- `52372596` - refactor(sail-server): migrate to new SailDesktopAgent architecture
- `59c8123f` - Implement authentication middleware and refactor socket service
- `ec1d5551` - Refactor authentication handling and improve error management in desktop agent
- `b65126f5` - Remove duplicate Electron integration handlers and unify FDC3 flow
- `baa3cc2b` - Refactor socket handling to improve type safety and consistency
- `a7135b6a` - Refactor sail-socket structure and update dependencies
- `234f0d13` - refactor(socket): Restructure core logic and remove deprecated files
- `6fd5141e` - Add development scripts and enhance socket service logging

**Total Files Changed:** 88
**Total Line Changes:** +4,414 / -2,619

**Description:**
Reviewers will see the creation of a new `apps/sail-server` application with streamlined server initialization. This includes migration to SailDesktopAgent architecture, authentication middleware implementation, enhanced transport handling, getInfoRequest DACP handler, removal of duplicate Electron handlers, improved type safety in socket handling, development scripts, and comprehensive cleanup of deprecated server files.

---

## Phase 10: Delete Old Packages

**PR Title:** `chore: remove obsolete packages/common, packages/web, and deprecated transport`

**Commits:**
- `5d33172d` - Common-cleanup (#191)
- `03557915` - Merge branch 'sail3' of https://github.com/finos/FDC3-Sail into web-cleanup
- `8bd0a10c` - Remove deprecated files and clean up project structure
- `2dd0d850` - Update project structure and dependencies for improved organization and functionality
- `e1d215fd` - cleaning up sail web in order to use sail-app
- `87c78522` - Simplify npm scripts in package.json
- `7c2e9731` - delete: remove obsolete FDC3 iframe component and test files
- `96a8a0c9` - delete: remove obsolete architecture analysis and implementation plan documents
- `c1cbd329` - chore: remove obsolete fdc3-dacp-transport package

**Total Files Changed:** 457
**Total Line Changes:** +5,571 / -17,945

**Description:**
Reviewers will see comprehensive cleanup of the old package structure. This includes complete removal of `packages/common`, `packages/web`, and obsolete `fdc3-dacp-transport` package. Deprecated FDC3 iframe components are removed, old architecture documents are deleted, npm scripts are simplified, and the project structure is streamlined to reflect the new monorepo organization.

---

## Phase 11: File Naming Standardization

**PR Title:** `refactor: standardize file naming to kebab-case across monorepo`

**Commits:**
- `a586b27d` - refactor(desktop-agent): standardize file naming to kebab-case
- `db931a9d` - chore: add eslint-plugin-unicorn for filename case enforcement
- `4e226332` - refactor: standardize file naming conventions across monorepo

**Total Files Changed:** 42
**Total Line Changes:** +397 / -100

**Description:**
Reviewers will see systematic renaming of files from PascalCase/camelCase to kebab-case across the entire monorepo. This includes addition of eslint-plugin-unicorn with filename-case rules to enforce consistency, renaming of registry files, handler files, component files, and utility files. All imports are updated to reflect new naming conventions.

---

## Phase 12: Documentation

**PR Title:** `docs: comprehensive documentation updates for FDC3 2.2 and monorepo architecture`

**Commits:**
- `82ca2222` - Add developer documentation section to README.md
- `e3f8669d` - Add comprehensive developer guide to DEVELOPMENT.md
- `4326723c` - fix head tag
- `3a68a773` - linting issues
- `ed32560e` - Update package dependencies and add module type declarations
- `c138e6e6` - Update package dependencies and improve component initialization
- `f88f1477` - Update package dependencies and improve code organization
- `2def134a` - Migrate FDC3 types from broken npm package to shared workspace package
- `55858b72` - Fix socket server module resolution by migrating to Vite
- `d6254961` - Remove tsx dependency and update start script to use vite-node in sail-socket
- `77bfd9ca` - Update TypeScript dependency to version 5.9.2 in sail-ui and package-lock.json
- `916b1dac` - Refactor sail-web structure and enhance functionality
- `729d96e5` - Add vitest configuration and schema generation scripts
- `28ca8710` - Update package dependencies and scripts
- `ff66b126` - Update ESLint configuration and dependencies
- `96a785e0` - Refactor TypeScript configuration for sail-socket and sail-web
- `3a4dcf93` - Enhance ESLint configuration for Tailwind CSS support
- `97e1f0a2` - docs(SYSTEM_ARCHITECTURE): update transport section to reflect FDC3 transport abstraction and implementation details
- `c5a0e86f` - docs(desktop-agent): update DACP compliance doc with completed implementations
- `2541a54c` - docs(desktop-agent): update compliance doc - 60% coverage, 23 handlers implemented
- `ed71f93d` - docs(desktop-agent): update compliance doc - private channels fully implemented (70% coverage)
- `e8169dab` - docs: add schema generation instructions to README
- `de37b791` - refactor(desktop-agent): enhance architecture documentation and clarify design principles
- `7b1f04a2` - refactor(docs): update SYSTEM_ARCHITECTURE.md to reflect FDC3 2.2 compliance and enhance architectural clarity
- `7ce776f3` - refactor(docs): enhance SYSTEM_ARCHITECTURE.md for clarity and FDC3 2.2 compliance
- `5d37cee3` - chore: update .gitignore and refactor Sail app configurations
- `98fc1623` - refactor: Complete monorepo restructure with improved naming

**Total Files Changed:** 502
**Total Line Changes:** +13,430 / -14,654

**Description:**
Reviewers will see comprehensive documentation updates including: developer documentation in README.md and DEVELOPMENT.md, SYSTEM_ARCHITECTURE.md updates reflecting FDC3 2.2 compliance, DACP compliance documentation with coverage metrics (70%), desktop-agent architecture documentation with design principles, transport abstraction documentation, schema generation instructions, FDC3 types migration documentation, Vite migration notes, ESLint/TypeScript configuration documentation, and .gitignore updates for the new monorepo structure.

---

## Summary Statistics

| Phase | PRs | Commits | Files Changed | Insertions | Deletions |
|-------|-----|---------|---------------|------------|-----------|
| Phase 1: Foundation & Tooling | 1 | 15 | 330 | 14,654 | 10,816 |
| Phase 2: Example Apps Reorganization | 1 | 8 | 118 | 8,005 | 67 |
| Phase 3: Electron App Refactoring | 1 | 4 | 23 | 1,306 | 4,341 |
| Phase 4: Server & Socket Refactoring | 1 | 18 | 132 | 9,021 | 6,573 |
| Phase 5: New Desktop Agent Package | 1 | 33 | 229 | 16,147 | 7,464 |
| Phase 6: New Sail API Package | 1 | 5 | 50 | 3,012 | 1,392 |
| Phase 7: New Sail UI Package | 1 | 20 | 160 | 25,979 | 3,422 |
| Phase 8: New Sail App | 1 | 17 | 195 | 24,831 | 19,569 |
| Phase 9: New Sail Server | 1 | 11 | 88 | 4,414 | 2,619 |
| Phase 10: Delete Old Packages | 1 | 9 | 457 | 5,571 | 17,945 |
| Phase 11: File Naming Standardization | 1 | 3 | 42 | 397 | 100 |
| Phase 12: Documentation | 1 | 27 | 502 | 13,430 | 14,654 |
| **TOTAL** | **12** | **170** | **2,326** | **126,767** | **88,962** |

---

## PR Dependency Chain

The PRs should be merged in the following order to maintain clean dependencies:

1. **Phase 1** (Foundation & Tooling) - Must be first
2. **Phase 2** (Example Apps) - Can run parallel with Phase 3-4
3. **Phase 3** (Electron) - Can run parallel with Phase 2, 4
4. **Phase 4** (Socket Refactoring) - Depends on Phase 1
5. **Phase 5** (Desktop Agent) - Depends on Phase 1, 4
6. **Phase 6** (Sail API) - Depends on Phase 5
7. **Phase 7** (Sail UI) - Depends on Phase 1
8. **Phase 8** (Sail App) - Depends on Phase 7
9. **Phase 9** (Sail Server) - Depends on Phase 5, 6
10. **Phase 10** (Delete Old Packages) - Depends on Phase 2, 5-9
11. **Phase 11** (File Naming) - Depends on all previous phases
12. **Phase 12** (Documentation) - Can be integrated throughout or at the end

---

## Recommendations for Further Splitting

Based on the analysis, here are recommendations if any phases are still too large:

### Phase 5 (Desktop Agent) - COULD BE SPLIT INTO 3 PRs:
- **5A: Core State Management** (10 commits, ~100 files, ~8k lines)
  - AppInstanceRegistry, IntentRegistry, PrivateChannelRegistry, UserChannelRegistry
- **5B: DACP Handlers** (15 commits, ~80 files, ~6k lines)
  - Intent handlers, channel handlers, context handlers, event handlers
- **5C: Schema Generation & Cleanup** (8 commits, ~50 files, ~2k lines)
  - FDC3 schema generator, Zod integration, handler fixes

### Phase 7 (Sail UI) - COULD BE SPLIT INTO 2 PRs:
- **7A: Core UI Package & Components** (12 commits, ~100 files, ~15k lines)
  - Shadcn setup, Radix UI, Tailwind, basic components
- **7B: Logo System & Theme** (8 commits, ~60 files, ~10k lines)
  - Logo components, DM Sans fonts, sail-theme CSS

### Phase 8 (Sail App) - COULD BE SPLIT INTO 2 PRs:
- **8A: Core App Structure & Stores** (10 commits, ~120 files, ~15k lines)
  - App setup, Zustand stores, basic components, hooks
- **8B: Layout System & Features** (7 commits, ~75 files, ~9k lines)
  - Dockview integration, QuickAccessPanel, AppDirectory overlay

### Phase 12 (Documentation) - COULD BE SPLIT INTO 2 PRs:
- **12A: Core Documentation** (10 commits, ~50 files)
  - README, DEVELOPMENT.md, SYSTEM_ARCHITECTURE.md
- **12B: Package Documentation & Config Updates** (17 commits, ~450 files)
  - Desktop Agent docs, compliance docs, config file updates

---

## Notes for Reviewers

### High-Risk Areas
- **Phase 5 (Desktop Agent)**: Largest functional change - 16k+ insertions implementing FDC3 2.2 spec
- **Phase 8 (Sail App)**: Complex React architecture with 24k+ insertions
- **Phase 10 (Delete Old Packages)**: 17k+ deletions - ensure no breaking dependencies

### Testing Strategy
- Phase 1, 4, 5, 9: Verify test suites pass
- Phase 2, 8: Manual testing of UI/UX
- Phase 3: Electron app smoke testing
- Phase 6, 7: Integration testing with dependent packages

### Breaking Changes
- Phase 5: Desktop Agent API changes may affect consumers
- Phase 6: Transport abstraction changes API surface
- Phase 10: Removes old packages entirely - coordinate with consumers

### Performance Considerations
- Phase 8: Dockview and Zustand state management - monitor bundle size
- Phase 9: Authentication middleware - review for security implications
