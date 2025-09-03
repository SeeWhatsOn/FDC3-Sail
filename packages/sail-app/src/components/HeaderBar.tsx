import { Logo, SidebarTrigger } from "sail-ui"

export const HeaderBar = () => {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-sidebar">
      <SidebarTrigger />
      <div className="flex items-center gap-2 px-2 py-1 absolute right-0">
        <div className="flex items-center justify-center w-10">
          <Logo />
        </div>
        <p className="text-2xl font-sail-logo">FDC3 Sail</p>
      </div>
    </header>
  )
}
