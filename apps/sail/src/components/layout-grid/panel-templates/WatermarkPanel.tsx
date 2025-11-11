import { LogoSail } from "sail-ui"

export const WatermarkPanel = () => {
  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-2 px-2 py-1">
        <LogoSail className="size-60" />
      </div>
    </div>
  )
}
