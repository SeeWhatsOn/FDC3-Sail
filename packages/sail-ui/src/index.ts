// Export styles (automatically loaded via sideEffects)
import "./index.css"

// Export specific components (named exports for tree-shaking)
export { 
  Sidebar,
  SidebarContent,
  SidebarFooter, 
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from "./components/ui/sidebar"

export { Button } from "./components/ui/button"
export { Input } from "./components/ui/input"
export { Separator } from "./components/ui/separator"
export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./components/ui/sheet"
export { Skeleton } from "./components/ui/skeleton"
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip"

export { useIsMobile } from "./hooks/use-mobile"
export { cn } from "./lib/utils"
