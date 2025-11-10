// Main App component
export { default as SailApp } from "./App"

// Layout components
export { default as DockviewSail } from "./components/layout-grid/Layout"
export { default as Layout } from "./components/layout-grid/Layout"
export { Panels } from "./components/layout-grid/Panels"

// FDC3 components
export { FDC3Panel } from "./components/fdc3-iframe"

// UI components
export { AppSidebar } from "./components/sidebar/AppSidebar"
export { IconButton } from "./components/IconButton"
export { ThemeProvider } from "./components/theme/theme-provider"
export { ModeToggle } from "./components/theme/ModeToggle"
export { Workspace } from "./components/workspace/Workspace"
export { QuickAccessPanel } from "./components/quick-access-panel"

// Stores
export * from "./stores/app-directory-store"

// Hooks
export * from "./hooks/use-app-directory-socket"
export * from "./hooks/use-desktop-agent"
export * from "./hooks/use-fdc3-connection"

// Types
export type { AppPanel } from "./components/layout-grid/Layout"
export type { FDC3AppPanel } from "./components/fdc3-iframe"

// CSS
import "./index.css"
