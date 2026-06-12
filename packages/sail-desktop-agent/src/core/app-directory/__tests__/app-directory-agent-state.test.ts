import { describe, expect, it, vi } from "vitest"
import { DesktopAgent } from "../../desktop-agent"
import type { AgentState } from "../../state/types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import { createInitialState } from "../../state/initial-state"
import { addApplication, addApplications, addDirectoryUrl } from "../../state/mutators"
import {
  retrieveAllApps,
  retrieveApps,
  retrieveAppsById,
  getDirectoryUrls,
} from "../app-directory-queries"
import {
  expectAppDirectoryOnState,
  mockApp1,
  mockApp2,
  mockApp3,
} from "./app-directory-test-fixtures"

function applyDesktopAgentStateUpdate(
  agent: DesktopAgent,
  callback: (state: AgentState) => AgentState
): void {
  const internal = agent as unknown as { state: AgentState }
  internal.state = callback(internal.state)
}

describe("AgentState.appDirectory ownership contract", () => {
  it("createInitialState includes empty appDirectory with apps and directoryUrls", () => {
    const state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    const appDirectory = expectAppDirectoryOnState(state)

    expect(appDirectory.apps).toEqual([])
    expect(appDirectory.directoryUrls).toEqual([])
  })

  it("DesktopAgent seeds config.apps into state.appDirectory.apps", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1, mockApp2],
    })

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toEqual(expect.arrayContaining([mockApp1, mockApp2]))
    expect(retrieveAllApps(appDirectory)).toEqual(appDirectory.apps)
  })

  it("addApplication mutator updates state.appDirectory.apps through DesktopAgent", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    applyDesktopAgentStateUpdate(agent, state => addApplication(state, mockApp1))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toContainEqual(mockApp1)
    expect(retrieveAppsById(appDirectory, "app-1")).toEqual([mockApp1])
  })

  it("addApplications mutator updates state.appDirectory.apps", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    applyDesktopAgentStateUpdate(agent, state => addApplications(state, [mockApp1, mockApp2]))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("preserves addApplications duplicate appId policy on state.appDirectory.apps", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1],
    })

    applyDesktopAgentStateUpdate(agent, state => addApplications(state, [mockApp1, mockApp2]))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.apps.filter(app => app.appId === "app-1")).toHaveLength(1)
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("addDirectoryUrl updates state.appDirectory.directoryUrls", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })
    const url = "https://example.com/v2/apps"

    applyDesktopAgentStateUpdate(agent, state => addDirectoryUrl(state, url))

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.directoryUrls).toEqual([url])
    expect(getDirectoryUrls(appDirectory)).toEqual(appDirectory.directoryUrls)
  })

  it("loadDirectory updates state.appDirectory apps and directoryUrls", async () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })
    const url = "https://example.com/v2/apps"
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([mockApp1, mockApp2]),
    })

    await agent.loadDirectory(url)

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.directoryUrls).toContain(url)
    expect(retrieveAllApps(appDirectory)).toEqual(appDirectory.apps)
  })

  it("replaceDirectoryUrls clears and reloads state.appDirectory apps and directoryUrls", async () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1],
    })
    const url = "https://example.com/v2/apps"
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([mockApp2, mockApp3]),
    })

    await agent.replaceDirectoryUrls([url])

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-2", "app-3"])
    expect(appDirectory.apps.map(app => app.appId)).not.toContain("app-1")
    expect(appDirectory.directoryUrls).toEqual([url])
  })

  it("query helpers reflect state.appDirectory as the single source of truth", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    applyDesktopAgentStateUpdate(agent, state =>
      addApplications(state, [mockApp1, mockApp2, mockApp3])
    )

    const catalog = expectAppDirectoryOnState(agent.getState())

    expect(retrieveAllApps(catalog)).toEqual(catalog.apps)
    expect(
      retrieveApps(catalog, "fdc3.contact", "ViewContact", undefined).map(app => app.appId)
    ).toEqual(["app-1", "app-3"])
  })
})
