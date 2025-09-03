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
import { Logo } from "sail-ui"

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
      <div className="flex items-center justify-end p-2">
        <ModeToggle />
      </div>

      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          {/* <SailLogoButton variant="ghost" style={{ height: "44px", width: "44px" }} /> */}
          <div className="flex items-center gap-2 px-2 py-1 border-2 border-red-500 rounded-3xl h-10 w-10">
            <Logo />
          </div>
        </div>
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
