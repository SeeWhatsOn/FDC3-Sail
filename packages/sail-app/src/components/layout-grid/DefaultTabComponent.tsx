import { LogoSail } from "sail-ui"

export const DefaultTabComponent = () => {
  return (
    <div className="w-full h-full flex items-center justify-center flex-col">
      <div className="flex items-center gap-2 px-2 py-1 flex-col">
        <LogoSail className="w-60 h-60" />
        {/* <p className="text-6xl font-sail-logo">FDC3 Sail</p> */}
      </div>
      {/* <hr className="w-60 border-1 border-sail-secondary/30 m-2" /> */}
    </div>
  )
}
