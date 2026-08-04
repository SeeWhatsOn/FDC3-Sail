// ============================================================================
// @finos/sail-platform
// ============================================================================
//
// Workspaces, layouts, and where they are stored.
//
// UI-agnostic and FDC3-agnostic — this package has no dependencies. It answers
// two questions for a host application:
//
//   Workspace — what is loaded
//   Layout    — how it looks
//
// FDC3 itself lives in @finos/sail-desktop-agent. Import that package directly;
// nothing is re-exported from it here.
//
// ============================================================================

// Workspaces and layouts
export type { Geometry, Layout, Panel, Rect, Tab, Workspace, WorkspaceSummary } from "./workspace"

export {
  createWorkspaceStore,
  type CreateWorkspaceOptions,
  type PanelInput,
  type WorkspaceState,
  type WorkspaceStore,
  type WorkspaceStoreOptions,
} from "./workspace"

// Storage
export {
  createLocalStorage,
  createMemoryStorage,
  type LocalStorageOptions,
  type SailStorage,
} from "./storage"
