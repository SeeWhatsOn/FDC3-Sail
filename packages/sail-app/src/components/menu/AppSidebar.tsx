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
import { SailLogoButton } from "@/components/ui/sailLogoButton"
import { LogoSail } from "sail-ui"

import { ModeToggle } from "../theme/ModeToggle"

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
  const { state, open } = useSidebar()
  console.log("AppSidebar render - Sidebar state:", { state, open })

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
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
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
