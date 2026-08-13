import { beforeEach, describe, expect, it, vi } from "vite-plus/test"
import type { DirectoryApp } from "@finos/sail-desktop-agent"
import { getServerState } from "../../state"
import { installLocalStorage } from "../../state/__tests__/local-storage-mock"
import { getAllIntentNames } from "../custom-apps"

describe("getAllIntentNames", () => {
  beforeEach(() => {
    installLocalStorage()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("unexpected fetch in getAllIntentNames test"))),
    )
  })

  it("unions app-declared listensFor/raises intents with the static list, deduped", async () => {
    const apps: DirectoryApp[] = [
      {
        appId: "app-listener",
        name: "app-listener",
        title: "app-listener",
        type: "web",
        details: { url: "https://app-listener.example/" },
        interop: {
          intents: {
            listensFor: {
              // Declared only by this app - must appear in the result.
              CustomListenIntent: { contexts: ["fdc3.instrument"] },
              // Also a static `intentTypes` title - must not produce a duplicate.
              ViewChart: { contexts: ["fdc3.instrument"] },
            },
          },
        },
      },
      {
        appId: "app-raiser",
        name: "app-raiser",
        title: "app-raiser",
        type: "web",
        details: { url: "https://app-raiser.example/" },
        interop: {
          intents: {
            raises: {
              // Declared only by this app - must appear in the result.
              CustomRaiseIntent: ["fdc3.instrument"],
              // Also declared by app-listener's listensFor - must not duplicate.
              CustomListenIntent: ["fdc3.contact"],
            },
          },
        },
      },
      {
        // No `interop` at all - must not throw, and must contribute nothing.
        appId: "app-no-interop",
        name: "app-no-interop",
        title: "app-no-interop",
        type: "web",
        details: { url: "https://app-no-interop.example/" },
      },
    ]

    await getServerState().registerDesktopAgent({
      userSessionId: "user-test",
      directories: [],
      channels: [
        {
          id: "One",
          icon: "/icons/tabs/noun-airplane-3707662.svg",
          background: "#0061F2",
        },
      ],
      panels: [],
      customApps: apps,
    })

    const names = getAllIntentNames()

    expect(names).toContain("CustomListenIntent")
    expect(names).toContain("CustomRaiseIntent")
    expect(names).toContain("ViewChart")
    // Named by both intentTypes and app-listener's listensFor - exactly one entry.
    expect(names.filter(n => n === "ViewChart")).toHaveLength(1)
    // Named by both app-listener's listensFor and app-raiser's raises - exactly one entry.
    expect(names.filter(n => n === "CustomListenIntent")).toHaveLength(1)
  })
})
