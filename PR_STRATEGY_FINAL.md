# Final PR Strategy - Monorepo Migration

## Current State Analysis

### What's on `main` branch NOW:
```
packages/
├── common/        (old package - to be deleted)
├── electron/      (old package - to be deleted)
├── preload/       (old package - to be deleted)
└── web/           (old package - to be deleted)

directory/         (FDC3 app manifests - needs reorganization)
```

### What's on `silly-chandrasekhar` branch:
```
packages/
├── desktop-agent/     (NEW - FDC3 2.2 implementation)
├── sail-api/          (NEW - transport layer)
├── sail-ui/           (NEW - UI components)
└── app-directories/   (NEW - reorganized manifests)

apps/
├── sail/              (NEW - main UI app)
├── sail-electron/     (ADAPTED - modernized electron)
├── sail-server/       (NEW - but incomplete)
└── example-fdc3-apps/ (MOVED - reorganized examples)
```

---

## 🎯 Revised PR Strategy (Start with Re-org)

### **PR 0: Monorepo Re-organization & Foundation** ⭐ NEW
**Purpose:** Prepare the ground before planting new seeds

**Size:** ~30-40 files changed
**Review Time:** 45 min - 1 hour per reviewer

**What's included:**

1. **Update workspace structure:**
   ```json
   // package.json
   "workspaces": [
     "packages/*",
     "apps/*"
   ]
   ```

2. **Create `apps/` directory structure** (empty, ready for new apps)

3. **Move existing code to proper locations:**
   - `packages/electron/` → `apps/sail-electron-legacy/` (temporary)
   - Keep `packages/common/`, `packages/web/`, `packages/preload/` in place
   - Add deprecation notices to old packages

4. **Add/update tooling:**
   - Modern ESLint config (flat config)
   - Prettier config
   - TypeScript configs (root + per-package)
   - `.gitignore` updates
   - Vitest setup (if not present)

5. **Update root README.md:**
   - Document new monorepo structure
   - Explain migration plan
   - List what's coming in subsequent PRs

6. **Add DEVELOPMENT.md:**
   - How to build the monorepo
   - How to run tests
   - Package vs apps distinction

**What reviewers see:**
- Structural preparation for monorepo
- No breaking changes (old code still works)
- Clear documentation of the plan
- Modern tooling setup

**Status:** ✅ Safe, non-breaking, sets foundation

**Post-merge state:**
- Old packages still work
- New structure ready
- Tooling modernized

---

### **PR 1: Core FDC3 Engine (desktop-agent + sail-api)**
**Purpose:** Add the heart of the system - FDC3 2.2 implementation

**Size:** 62 files, ~14.4k lines
**Review Time:** 2-3 hours per reviewer

**What's included:**
- `packages/desktop-agent/` - Complete FDC3 2.2 Desktop Agent
  - All registries (AppInstance, Intent, PrivateChannel, UserChannel)
  - 23 DACP handlers (~70% spec coverage)
  - Schema generation & validation
  - Comprehensive tests
- `packages/sail-api/` - Transport abstraction layer
  - SailClient for client-side
  - SailDesktopAgent wrapper
  - Socket.IO & MessagePort adapters
  - Integration tests

**What reviewers see:**
- Production-ready FDC3 implementation
- Can test locally with example usage
- Well documented with architecture docs

**Status:** ✅ Complete, production-ready

**Dependencies:** Requires PR 0

---

### **PR 2: UI Component Library (sail-ui)**
**Purpose:** Add reusable UI components

**Size:** 40 files, ~10.7k lines
**Review Time:** 1.5-2 hours per reviewer

**What's included:**
- `packages/sail-ui/` - Complete UI package
  - Shadcn/ui component library
  - Radix UI primitives
  - Tailwind theme system
  - Logo components (SailLogoButton, LogoSail)
  - DM Sans fonts
  - Dark/light mode support
  - Sidebar, header, button components

**What reviewers see:**
- Standalone component library
- Can run Storybook/demo locally
- Design system documentation

**Status:** ✅ Complete, production-ready

**Dependencies:** Requires PR 0

**Can run in parallel with PR 1** ✅

---

### **PR 3: Sail Application (sail app)**
**Purpose:** Add the main Sail desktop application

**Size:** 57 files, ~4.2k lines
**Review Time:** 2 hours per reviewer

**What's included:**
- `apps/sail/` - Complete React application
  - Dockview layout system
  - Zustand state management
  - FDC3 integration hooks
  - AppDirectory overlay
  - WorkspaceDirectory
  - QuickAccessPanel
  - Channel selector
  - Theme integration

**What reviewers see:**
- Working desktop application
- Can launch and test locally
- Integrates FDC3 engine + UI components

**Status:** ✅ Complete, production-ready

**Dependencies:** Requires PR 1 (FDC3 engine), PR 2 (UI components)

---

### **PR 4: Electron Modernization (sail-electron)**
**Purpose:** Update Electron wrapper with modern APIs

**Size:** 11 files, ~2.2k lines
**Review Time:** 45 min - 1 hour per reviewer

**What's included:**
- `apps/sail-electron/` - Modernized Electron app
  - BaseWindow + WebContentsView APIs
  - Integrated preload (no separate package)
  - Custom title bar (Windows/Linux)
  - Enhanced loading screen
  - Updated to latest Electron version

**What reviewers see:**
- Adaptation of existing electron package
- Modern Electron patterns
- Can build and run Electron app

**Status:** ✅ Complete

**Dependencies:** Requires PR 3 (needs Sail app to wrap)

---

### **PR 5: Cleanup - Remove Legacy Packages**
**Purpose:** Delete old code now that migration is complete

**Size:** 195 files deleted, ~13.5k lines removed
**Review Time:** 30-45 minutes per reviewer

**What's included:**
- Delete `packages/common/`
- Delete `packages/web/`
- Delete `packages/preload/`
- Delete `apps/sail-electron-legacy/`
- Update all references
- Clean up old scripts in root package.json

**What reviewers see:**
- Verification that nothing references old packages
- Clean removal of legacy code
- Smaller, cleaner monorepo

**Status:** ✅ Essential cleanup

**Dependencies:** Requires ALL previous PRs (must migrate everything first)

---

## ❌ What to EXCLUDE

### **Exclude: sail-server**
**Reason:** Only 270 lines, has TODOs, not production-ready
**Plan:** Add later in separate PR when complete

### **Exclude: example-fdc3-apps**
**Reason:** Your observation - these are just cleaned up examples
**Plan:** Can add later, not essential for monorepo migration
**Benefit:** Keeps PRs focused on NEW functionality

### **Exclude: app-directories**
**Reason:** Just 10 JSON files, not essential
**Plan:** Can add later or bundle with examples
**Alternative:** Could add in PR 0 (foundation) as example of manifest format

---

## 📊 Final PR Structure

| PR | Name | Files | Lines | Review Time | Can Parallel? |
|----|------|-------|-------|-------------|---------------|
| **PR 0** | Monorepo Foundation | 30-40 | +1k / -200 | 1 hour | - |
| **PR 1** | FDC3 Engine | 62 | +14.4k | 2-3 hours | With PR 2 |
| **PR 2** | UI Components | 40 | +10.7k | 1.5-2 hours | With PR 1 |
| **PR 3** | Sail App | 57 | +4.2k | 2 hours | - |
| **PR 4** | Electron | 11 | +2.2k | 1 hour | - |
| **PR 5** | Cleanup | 195 | -13.5k | 45 min | - |
| **TOTAL** | | **395** | **+31.5k / -13.7k** | **9-12 hours** | |

**Excluded:** sail-server (incomplete), example-fdc3-apps (not essential), app-directories (can add later)

---

## 🎯 Why This Approach Works

### **1. Clear Story Arc:**
- **PR 0:** "Prepare the foundation"
- **PR 1:** "Add the engine"
- **PR 2:** "Add the UI toolkit"
- **PR 3:** "Add the application"
- **PR 4:** "Add the desktop wrapper"
- **PR 5:** "Clean up the old"

### **2. Non-Breaking Migration:**
- PR 0 doesn't break existing code
- Each subsequent PR adds new packages
- PR 5 removes old code only after everything migrated

### **3. Testable at Each Step:**
- After PR 0: Old code still works
- After PR 1: Can test FDC3 engine standalone
- After PR 2: Can test UI components standalone
- After PR 3: Can run full Sail app
- After PR 4: Can run in Electron
- After PR 5: Clean, modern monorepo

### **4. Manageable Review Burden:**
- Largest PR: 62 files, 3 hours review
- Can parallelize PR 1 + PR 2 (both independent of each other)
- Total time: 9-12 hours per reviewer across 6 PRs

### **5. Focus on NEW Functionality:**
- Excludes examples (can add later)
- Excludes incomplete server (can add later)
- Shows production-ready work only

---

## 🚀 Dependency Graph

```
PR 0 (Foundation)
  ├─→ PR 1 (FDC3 Engine) ────┐
  │                           ├─→ PR 3 (Sail App) ─→ PR 4 (Electron) ─→ PR 5 (Cleanup)
  └─→ PR 2 (UI Components) ──┘
```

**Merge order:**
1. PR 0 (must be first)
2. PR 1 + PR 2 (can be parallel)
3. PR 3 (needs both PR 1 and PR 2)
4. PR 4 (needs PR 3)
5. PR 5 (must be last)

**Timeline estimate:**
- Week 1: Merge PR 0
- Week 2: Review/merge PR 1 + PR 2 (parallel)
- Week 3: Review/merge PR 3
- Week 4: Review/merge PR 4 + PR 5 (quick)

**Total:** 4 weeks

---

## 📝 What Goes in PR 0 (Foundation)?

### **Concrete changes:**

1. **package.json:**
```json
{
  "name": "fdc3-sail-monorepo",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "turbo build",  // or npm run build --workspaces
    "test": "turbo test",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

2. **Create directory structure:**
```bash
mkdir -p apps/.gitkeep
# Keep apps/ in git but empty for now
```

3. **Update tsconfig.root.json:**
```json
{
  "files": [],
  "references": [
    { "path": "./packages/desktop-agent" },
    { "path": "./packages/sail-api" },
    { "path": "./packages/sail-ui" },
    { "path": "./apps/sail" },
    { "path": "./apps/sail-electron" }
  ]
}
```

4. **Add eslint.config.mjs** (modern flat config)

5. **Add .prettierrc** (if not present)

6. **Update .gitignore:**
```
# Build outputs
dist/
build/
*.tsbuildinfo

# Dependencies
node_modules/

# Environment
.env
.env.local

# OS
.DS_Store
```

7. **Add README.md section:**
```markdown
## Monorepo Structure

This repository uses npm workspaces:

- `packages/` - Reusable libraries (desktop-agent, sail-api, sail-ui)
- `apps/` - Deployable applications (sail, sail-electron)

### Getting Started

\`\`\`bash
npm install
npm run build
npm run test
\`\`\`
```

8. **Add DEVELOPMENT.md** with build instructions

**Crucially - what NOT to include in PR 0:**
- ❌ No new packages yet
- ❌ No deletion of old packages yet
- ❌ Just structure + tooling

---

## ✅ Decision Points for You

### **Question 1: Include app-directories in PR 0?**
- **Option A:** Add in PR 0 (just 10 JSON files, shows manifest format)
- **Option B:** Exclude entirely (not essential)
- **Option C:** Add later with example-fdc3-apps

**My recommendation:** Option A (small, good example)

### **Question 2: Keep old electron as sail-electron-legacy temporarily?**
- **Option A:** Keep temporarily in PR 0, delete in PR 5
- **Option B:** Delete immediately in PR 0
- **Option C:** Don't touch it until PR 5

**My recommendation:** Option C (don't touch until PR 5)

### **Question 3: Include any existing typing/formatting cleanup in PR 0?**
- If `main` has linting errors, should we fix them in PR 0?
- Or leave old code as-is and only lint new packages?

**My recommendation:** Leave old code as-is, only lint new packages

---

## 🎯 Next Steps

Once you confirm this approach, I can:

1. **Generate exact git commands** for each PR branch
2. **Create commit message templates** for each PR
3. **Write PR descriptions** with testing instructions
4. **Create a migration checklist** to track progress

**Confirm:**
- ✅ Start with PR 0 (foundation)?
- ✅ Exclude example-fdc3-apps?
- ✅ Exclude sail-server?
- ✅ Include app-directories in PR 0 or later?
