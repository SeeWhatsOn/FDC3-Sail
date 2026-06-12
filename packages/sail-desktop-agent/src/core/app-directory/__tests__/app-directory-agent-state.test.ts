import { describe, expect, it, vi } from "vitest"
import { DesktopAgent } from "../../desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import { createInitialState } from "../../state/initial-state"
import {
  expectAppDirectoryOnState,
  mockApp1,
  mockApp2,
  mockApp3,
} from "./app-directory-test-fixtures"

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
    expect(agent.getAppDirectory().retrieveAllApps()).toEqual(appDirectory.apps)
  })

  it("AppDirectoryManager.add updates state.appDirectory.apps through DesktopAgent", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    agent.getAppDirectory().add(mockApp1)

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toContainEqual(mockApp1)
    expect(agent.getAppDirectory().retrieveAppsById("app-1")).toEqual([mockApp1])
  })

  it("AppDirectoryManager.addApplications updates state.appDirectory.apps", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    agent.getAppDirectory().addApplications([mockApp1, mockApp2])

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("preserves addApplications duplicate appId policy on state.appDirectory.apps", () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1],
    })

    agent.getAppDirectory().addApplications([mockApp1, mockApp2])

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.apps.filter(app => app.appId === "app-1")).toHaveLength(1)
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-1", "app-2"])
  })

  it("addDirectoryUrl updates state.appDirectory.directoryUrls", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })
    const url = "https://example.com/v2/apps"

    agent.getAppDirectory().addDirectoryUrl(url)

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.directoryUrls).toEqual([url])
    expect(agent.getAppDirectory().getDirectoryUrls()).toEqual(appDirectory.directoryUrls)
  })

  it("loadDirectory updates state.appDirectory apps and directoryUrls", async () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })
    const url = "https://example.com/v2/apps"
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([mockApp1, mockApp2]),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await agent.getAppDirectory().loadDirectory(url)

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps).toHaveLength(2)
    expect(appDirectory.directoryUrls).toContain(url)
    expect(agent.getAppDirectory().retrieveAllApps()).toEqual(appDirectory.apps)
  })

  it("replace clears and reloads state.appDirectory apps and directoryUrls", async () => {
    const agent = new DesktopAgent({
      userChannels: DEFAULT_FDC3_USER_CHANNELS,
      apps: [mockApp1],
    })
    const url = "https://example.com/v2/apps"
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([mockApp2, mockApp3]),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await agent.getAppDirectory().replace([url])

    const appDirectory = expectAppDirectoryOnState(agent.getState())
    expect(appDirectory.apps.map(app => app.appId).sort()).toEqual(["app-2", "app-3"])
    expect(appDirectory.apps.map(app => app.appId)).not.toContain("app-1")
    expect(appDirectory.directoryUrls).toEqual([url])
  })

  it("AppDirectoryManager queries reflect state.appDirectory as the single source of truth", () => {
    const agent = new DesktopAgent({ userChannels: DEFAULT_FDC3_USER_CHANNELS })

    agent.getAppDirectory().addApplications([mockApp1, mockApp2, mockApp3])

    const fromState = expectAppDirectoryOnState(agent.getState()).apps
    const manager = agent.getAppDirectory()

    expect(manager.retrieveAllApps()).toEqual(fromState)
    expect(manager.allApps).toEqual(fromState)
    expect(
      manager.retrieveApps("fdc3.contact", "ViewContact", undefined).map(app => app.appId)
    ).toEqual(["app-1", "app-3"])
  })
})
