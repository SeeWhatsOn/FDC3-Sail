import {
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
  useSidebar,
} from "sail-ui"
import { Home, Zap, Settings, ChevronUp, User2, LayoutGrid } from "lucide-react"
import { LogoSail } from "sail-ui"

import { ModeToggle } from "../theme/ModeToggle"
import { useUIStore } from "../../stores/uiStore"

const items = [
  {
    title: "Dashboard",
    url: "#",
    icon: Home,
  },
  {
    title: "Apps",
    url: "#",
    icon: Zap,
  },
  {
    title: "Workspaces",
    url: "#",
    icon: LayoutGrid,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
]

export function AppSidebar() {
  const { openAppDirectory } = useUIStore()
  const { setOpen } = useSidebar()

  const handleAppsClick = () => {
    openAppDirectory()
    setOpen(false) // Close sidebar when opening app directory
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <ModeToggle />
        <LogoSail className="w-30 h-30" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={item.title === "Apps" ? handleAppsClick : undefined}
                    asChild={item.title !== "Apps"}
                  >
                    {item.title === "Apps" ? (
                      <>
                        <item.icon />
                        <span>{item.title}</span>
                      </>
                    ) : (
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <User2 />
              <span>User</span>
              <ChevronUp className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
