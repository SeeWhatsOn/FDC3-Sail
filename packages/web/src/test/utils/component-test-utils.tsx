import { ReactElement } from "react"
import { render, RenderOptions, RenderResult } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Custom render function that can be extended with providers later
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult & { user: ReturnType<typeof userEvent.setup> } => {
  const user = userEvent.setup()

  return {
    user,
    ...render(ui, options),
  }
}

export * from "@testing-library/react"
export { customRender as render }
export { userEvent }
