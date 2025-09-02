import { SailLogoButton } from "@/components/ui/sailLogoButton"
import { SidebarTrigger } from "sail-ui"

export const HeaderBar = () => {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <div className="h-4 w-px bg-border" />
      <h1 className="text-lg font-semibold">
        <SailLogoButton />
        FDC3 Sail
      </h1>
    </header>
  )
}
