import { GridStack, type GridItemHTMLElement } from "gridstack"

export function setupTabDropTargets(
  onTargetChange: (tabId: string | null) => void,
): () => void {
  const dd = GridStack.getDD()
  const tabs = Array.from(document.querySelectorAll<HTMLElement>(".drop-tab"))

  tabs.forEach((tab) => {
    dd.off(tab as GridItemHTMLElement, "dropover")
    dd.off(tab as GridItemHTMLElement, "dropout")
    dd.droppable(tab as GridItemHTMLElement, {
      accept: () => true,
    })
    dd.on(tab as GridItemHTMLElement, "dropover", () => {
      onTargetChange(tab.id)
    })
    dd.on(tab as GridItemHTMLElement, "dropout", () => {
      onTargetChange(null)
    })
  })

  return () => {
    tabs.forEach((tab) => {
      dd.off(tab as GridItemHTMLElement, "dropover")
      dd.off(tab as GridItemHTMLElement, "dropout")
    })
  }
}
