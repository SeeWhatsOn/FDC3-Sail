# Sail Layout Requirements

## Overview
FDC3 workspace layout system built on Dockview, providing tabbed workspaces with app panels and FDC3 channel indicators.

## Core Functionality Requirements

### Essential Features
1. **Tabbing** - Multiple workspace tabs (One, Two, Three, etc.)
2. **Panel Management** - Open apps from App Directory in resizable panels
3. **Panel Operations** - Close apps, resize panels, move between tabs
4. **Group Management** - Close panel groups, create new groups
5. **FDC3 Integration** - Visual indicators showing which FDC3 channel each tab is connected to
6. **App Loading** - Load apps from app-directories into iframe panels

### Dockview Coverage
✅ **Covered by Dockview**: Tabbing, panel resizing, moving tabs, closing apps/groups, adding groups
🔧 **Custom Implementation Needed**: FDC3 channel visual indicators on tabs

## Architecture

### Package Responsibilities
- **sail-layout**: Complete workspace layout system with Dockview + FDC3 integration
- **sail-ui**: Shared UI components (buttons, forms, cards, drawers)
- **apps/sail-web**: Consumes sail-layout package
- **apps/sail-desktop**: Consumes sail-layout package

## Epic Breakdown

### Epic 1: Core Layout System ✅ COMPLETE
**Goal**: Build complete workspace layout system with Dockview + FDC3 integration

**User Stories**:
- As a user, I want tabbed workspaces so I can organize different trading contexts
- As a user, I want to open apps from App Directory in resizable panels
- As a user, I want to drag panels between tabs and resize them
- As a user, I want to close apps and panel groups as needed
- As a developer, I want FDC3 apps to load properly in iframe panels

**Technical Implementation**:
- [x] Dockview React integration with FDC3Panel component
- [x] App loading from app-directories via iframe rendering
- [x] Panel lifecycle management (add, remove, resize, move)
- [x] Cross-tab dragging and group management (built into Dockview)
- [x] Store integration patterns for consuming apps

### Epic 2: Component Library Separation
**Goal**: Clean separation between layout system and reusable components

**User Stories**:
- As a developer, I want shared UI components in sail-ui so that both web and desktop use consistent styling
- As a developer, I want layout logic in sail-layout so that I can maintain the layout system independently
- As a developer, I want clear package boundaries so that dependencies are manageable

**Technical Tasks**:
- [ ] Move reusable components to sail-ui (buttons, forms, cards)
- [ ] Keep layout-specific Tailwind utilities in sail-layout
- [ ] Establish clear package import boundaries

### Epic 3: FDC3 Channel Indicators
**Goal**: Add visual indicators showing which FDC3 channel each tab is connected to

**User Stories**:
- As a user, I want to see which FDC3 channel each tab is connected to so I know the context flow
- As a user, I want color-coded or icon indicators on tabs so I can quickly identify channel relationships  
- As a developer, I want channel info to update in real-time when channels change

**Technical Implementation**:
- [ ] Add channel indicator to custom tab header component
- [ ] Connect to FDC3 channel state from consuming app
- [ ] Add visual styling (color, icon) for different channels
- [ ] Update indicators when channel assignments change

### Epic 4: Drawer-based Navigation
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
- [ ] Implementation will be handled by consuming apps (sail-web)
- [ ] sail-layout provides the foundation and integration points

## Success Criteria

### Epic 1 Success
- [x] Panels can be created, resized, and moved using Dockview
- [x] FDC3 apps load correctly in Dockview panels (FDC3Panel component)
- [x] Cross-tab dragging works as before (enabled by default in Dockview)
- [x] No GridStack dependencies remain (sail-layout was clean)
- [x] Zustand store integration via props-based callback system

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

## Current Implementation Status

### ✅ Epic 1: Core Layout System - COMPLETE
- **Clean Dockview integration**: No unnecessary state management classes
- **Minimal FDC3Panel**: Just iframe + window registration, Dockview handles all UI
- **Direct Zustand integration**: Props-based callbacks (externalPanels, onPanelAdd/Remove/Update)
- **Full panel coverage**: Tabbing, resizing, moving, closing, group management all via Dockview
- **App loading**: From app-directories into iframe panels with proper sizing
- **Clean architecture**: No GridStack legacy, simplified AppPanel interface

### 📋 **COMPLETED TODAY** (2025-08-29):
- Removed unnecessary DockviewStateImpl class (Zustand handles state)
- Simplified FDC3Panel component (removed duplicate UI that Dockview provides)
- Fixed iframe sizing to fill entire panel space
- Clean props-based integration pattern for consuming apps
- All Epic 1 requirements fulfilled

### 🎯 Next Session Priorities:
**Epic 2**: Component Library Separation  
**Epic 3**: FDC3 Channel Indicators (the one missing Dockview feature)

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