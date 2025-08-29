# Sail Layout Migration Plan

## Overview
Migration from GridStack to Dockview with component library separation and popup-to-page conversion.

## Architecture Decisions

### Package Responsibilities
- **sail-layout**: Dockview integration, layout-specific Tailwind utilities (margins, positioning, flex, grid)
- **sail-ui**: Shared UI components, component-specific styling (buttons, forms, cards)
- **sail-web/sail-desktop**: Thin wrappers consuming sail-layout

### UI Strategy
- Convert popups to slide-out drawers for better UX and performance
- Maintain Zustand state management with Dockview event integration
- Keep FDC3 iframe management but adapt for Dockview panels

## Epic Breakdown

### Epic 1: Core Layout Migration
**Goal**: Replace GridStack with Dockview for better layout management

**User Stories**:
- As a developer, I want to replace GridStack with Dockview so that I have better layout management and zero dependencies
- As a user, I want to drag panels between tabs so that I can organize my workspace efficiently  
- As a user, I want panels to resize and position correctly so that I can customize my layout
- As a developer, I want FDC3 iframe management to work with Dockview so that apps load properly in panels

**Technical Tasks**:
- [x] ~~Remove GridStack dependencies from sail-layout~~ (N/A - sail-layout never had GridStack)
- [x] Add Dockview dependency and CSS imports
- [x] Port GridsStateImpl to DockviewStateImpl
- [x] Adapt iframe rendering for Dockview panels (FDC3Panel component created)
- [x] Update panel positioning logic for Dockview API
- [ ] Test cross-tab panel dragging
- [ ] Integrate with existing Zustand stores
- [ ] Replace example panels with FDC3 integration

### Epic 2: Component Library Separation
**Goal**: Clean separation between layout system and reusable components

**User Stories**:
- As a developer, I want shared UI components in sail-ui so that both web and desktop use consistent styling
- As a developer, I want layout logic in sail-layout so that I can maintain the layout system independently
- As a developer, I want clear package boundaries so that dependencies are manageable

**Technical Tasks**:
- [ ] Move reusable components from sail-web to sail-ui
- [ ] Keep Tailwind utilities in sail-layout for layout-specific styling
- [ ] Move component-specific styles to sail-ui
- [ ] Update import paths across packages
- [ ] Add sail-layout to workspace dependencies

### Epic 3: Drawer-based Navigation
**Goal**: Convert modal popups to slide-out drawers for better UX and performance

**User Stories**:
- As a user, I want AppD as a slide-out drawer so that I can browse apps without losing my workspace context
- As a user, I want Config as a drawer so that I have more space for settings while keeping my layout visible
- As a user, I want Context History as a drawer so that I can analyze FDC3 data flows without interrupting my workflow
- As a user, I want Intent Resolver as a drawer so that I can make choices while seeing the context

**Technical Tasks**:
- [ ] Add Shadcn Sheet/Drawer component to sail-ui
- [ ] Convert AppDPanel to AppDDrawer with slide-from-right animation
- [ ] Convert ConfigPanel to ConfigDrawer with slide-from-left animation
- [ ] Convert ContextHistoryPanel to ContextHistoryDrawer
- [ ] Convert ResolverPanel to ResolverDrawer  
- [ ] Update Frame component to manage drawer state instead of popup state
- [ ] Ensure main layout never unmounts during drawer interactions

### Epic 4: State Integration
**Goal**: Seamless Zustand and Dockview state synchronization

**User Stories**:
- As a developer, I want Zustand to work seamlessly with Dockview events so that state stays synchronized
- As a user, I want my layout changes to persist across sessions so that my workspace is preserved
- As a developer, I want clean event handling so that layout changes update application state

**Technical Tasks**:
- [ ] Integrate Dockview layout events with useClientStore
- [ ] Update panel state management for Dockview data structures
- [ ] Implement layout persistence using Dockview serialization
- [ ] Handle tab/group changes in Zustand stores
- [ ] Update server state sync for new layout model

## Success Criteria

### Epic 1 Success
- [x] Panels can be created, resized, and moved using Dockview
- [x] FDC3 apps load correctly in Dockview panels (FDC3Panel component)
- [ ] Cross-tab dragging works as before (TODO: test and verify)
- [x] No GridStack dependencies remain (sail-layout was clean)

### Epic 2 Success  
- [ ] sail-ui contains all reusable components
- [ ] sail-layout contains only layout logic
- [ ] Both sail-web and sail-desktop can import and use sail-layout
- [ ] Clear dependency boundaries maintained

### Epic 3 Success
- [ ] All popups converted to drawers with better UX
- [ ] Drawer animations are smooth and responsive
- [ ] Drawer approach provides more space while preserving workspace context
- [ ] No performance hits from re-rendering main layout

### Epic 4 Success
- [ ] Layout changes persist across sessions
- [ ] Zustand state stays synchronized with Dockview
- [ ] Performance equals or exceeds GridStack implementation

## Current State (Updated 2025-08-29)
- ✅ Basic Dockview integration exists with example panels
- ✅ Vitest and React Testing Library setup complete
- ✅ Package structure with components/grid/dockViewSail.tsx
- ⚠️ Example code uses Material Icons (needs Lucide migration)
- ⚠️ localStorage persistence already implemented but needs FDC3 integration
- ⚠️ Controls have panel creation/management but need FDC3 app loading

## Key Findings
- Dockview 4.7.0 already installed and working
- Basic panel management (add, remove, maximize, popout) implemented
- Theme support via className prop
- State persistence via localStorage (dv-demo-state)
- Custom header controls system in place
- **GridStack Architecture Analysis**:
  - GridsStateImpl manages panel lifecycle with shadow DOM
  - AppPanel extends GridStackPosition (x,y,w,h) 
  - FDC3 iframes rendered in panels with app window registration
  - Zustand store manages tabs/panels with AppPanel type
  - Cross-tab dragging implemented via GridStack drag/drop API
  - Panel content includes title bar with close/state icons

## Next Steps
1. ✅ Start with Epic 1: Core Layout Migration  
2. ✅ Set up basic Dockview integration in sail-layout
3. Clean up example code and replace with FDC3-specific components
4. Port essential components from sail-web
5. Iterate through remaining epics