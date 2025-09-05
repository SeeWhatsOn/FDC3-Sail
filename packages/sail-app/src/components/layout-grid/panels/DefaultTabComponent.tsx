import { LogoSail } from "sail-ui"

export const DefaultTabComponent = () => {
  return (
    <div className="w-full h-full flex items-center justify-center flex-col">
      <div className="flex items-center gap-2 px-2 py-1 flex-col">
        <LogoSail className="w-60 h-60" />
      </div>
    </div>
  )
}
