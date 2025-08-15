import { describe, it, expect, vi } from "vitest"

import { render, screen } from "@/__test__/utils/component-test-utils"

import { Controls, NewPanel, Bin } from "./controls"

describe("Controls Component", () => {
  it("renders children correctly", () => {
    render(
      <Controls>
        <div>Test Child</div>
      </Controls>
    )

    expect(screen.getByText("Test Child")).toBeInTheDocument()
  })

  it("applies correct CSS class", () => {
    render(
      <Controls>
        <div>Test</div>
      </Controls>
    )

    const controlsElement = screen.getByText("Test").parentElement
    expect(controlsElement?.className).toContain("controls")
  })
})

describe("NewPanel Component", () => {
  it("renders add button with correct attributes", () => {
    render(<NewPanel onClick={() => {}} />)

    const button = screen.getByRole("img")
    expect(button).toHaveAttribute("src", "/icons/control/add.svg")
    expect(button).toHaveAttribute("title", "Add Tab")
  })

  it("calls onClick when clicked", async () => {
    const mockOnClick = vi.fn()
    const { user } = render(<NewPanel onClick={mockOnClick} />)

    const button = screen.getByRole("img")
    await user.click(button)

    expect(mockOnClick).toHaveBeenCalledOnce()
  })

  it("applies correct CSS classes", () => {
    render(<NewPanel onClick={() => {}} />)

    const container = screen.getByRole("img").parentElement
    expect(container?.className).toContain("control")

    const image = screen.getByRole("img")
    expect(image.className).toContain("controlImage")
  })
})

describe("Bin Component", () => {
  it("renders bin icon with correct attributes", () => {
    render(<Bin />)

    const binIcon = screen.getByRole("img")
    expect(binIcon).toHaveAttribute("src", "/icons/control/bin.svg")
    expect(binIcon).toHaveAttribute("title", "Remove App")
  })

  it("has correct id attribute", () => {
    render(<Bin />)

    const container = screen.getByRole("img").parentElement
    expect(container).toHaveAttribute("id", "trash")
  })

  it("applies correct CSS classes", () => {
    render(<Bin />)

    const container = screen.getByRole("img").parentElement
    expect(container?.className).toContain("control")

    const image = screen.getByRole("img")
    expect(image.className).toContain("controlImage")
  })
})
