import { describe, it, expect, beforeEach } from "vitest"
import { createInitialState } from "../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import {
  retrieveAllApps,
  retrieveApps,
  retrieveAppsById,
  retrieveAppsByUrl,
  retrieveAllIntents,
  retrieveIntents,
} from "../app-directory-queries"
import { mockApp1, mockApp2, mockApp3 } from "./app-directory-test-fixtures"
import { addApplication, addApplications } from "../../state/mutators"

function emptyCatalog() {
  return createInitialState(DEFAULT_FDC3_USER_CHANNELS).appDirectory
}

describe("app-directory-queries", () => {
  describe("retrieveAllApps()", () => {
    it("should return all apps", () => {
      let catalog = emptyCatalog()
      catalog = addApplications(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [
        mockApp1,
        mockApp2,
      ]).appDirectory
      const apps = retrieveAllApps(catalog)
      expect(apps).toHaveLength(2)
      expect(apps).toContainEqual(mockApp1)
      expect(apps).toContainEqual(mockApp2)
    })

    it("should return a copy of the array", () => {
      const catalog = addApplication(
        createInitialState(DEFAULT_FDC3_USER_CHANNELS),
        mockApp1
      ).appDirectory
      const apps = retrieveAllApps(catalog)
      apps.push(mockApp2)
      expect(catalog.apps).toHaveLength(1)
    })
  })

  describe("retrieveAppsById()", () => {
    let catalog = emptyCatalog()

    beforeEach(() => {
      catalog = addApplications(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [
        mockApp1,
        mockApp2,
      ]).appDirectory
    })

    it("should return apps with matching appId", () => {
      const apps = retrieveAppsById(catalog, "app-1")
      expect(apps).toHaveLength(1)
      expect(apps[0]).toEqual(mockApp1)
    })

    it("should return empty array for non-existent appId", () => {
      expect(retrieveAppsById(catalog, "non-existent")).toHaveLength(0)
    })
  })

  describe("retrieveApps()", () => {
    let catalog = emptyCatalog()

    beforeEach(() => {
      catalog = addApplications(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [
        mockApp1,
        mockApp2,
        mockApp3,
      ]).appDirectory
    })

    it("should return all apps when no filters provided", () => {
      expect(retrieveApps(catalog, undefined, undefined, undefined)).toHaveLength(3)
    })

    it("should filter by contextType", () => {
      const apps = retrieveApps(catalog, "fdc3.contact", undefined, undefined)
      expect(apps).toHaveLength(2)
      expect(apps.map(a => a.appId)).toContain("app-1")
      expect(apps.map(a => a.appId)).toContain("app-3")
    })

    it("should filter by intentName", () => {
      const apps = retrieveApps(catalog, undefined, "ViewContact", undefined)
      expect(apps).toHaveLength(2)
    })

    it("should filter by resultType", () => {
      expect(retrieveApps(catalog, undefined, undefined, "fdc3.contact")).toHaveLength(2)
    })

    it("should filter by multiple criteria", () => {
      expect(retrieveApps(catalog, "fdc3.contact", "ViewContact", "fdc3.contact")).toHaveLength(2)
    })

    it("should return empty array when no apps match", () => {
      expect(retrieveApps(catalog, "fdc3.nonexistent", undefined, undefined)).toHaveLength(0)
    })
  })

  describe("retrieveAllIntents()", () => {
    const catalog = addApplications(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [
      mockApp1,
      mockApp2,
      mockApp3,
    ]).appDirectory

    it("should return all intents from all apps", () => {
      const intents = retrieveAllIntents(catalog)
      expect(intents.length).toBeGreaterThan(0)
      expect(intents.some(i => i.intentName === "ViewContact")).toBe(true)
      expect(intents.some(i => i.intentName === "ViewChart")).toBe(true)
    })

    it("should include appId in each intent", () => {
      retrieveAllIntents(catalog).forEach(intent => {
        expect(intent.appId).toBeDefined()
        expect(intent.intentName).toBeDefined()
        expect(intent.contexts).toBeDefined()
      })
    })
  })

  describe("retrieveIntents()", () => {
    const catalog = addApplications(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [
      mockApp1,
      mockApp2,
      mockApp3,
    ]).appDirectory

    it("should return all intents when no filters provided", () => {
      expect(retrieveIntents(catalog, undefined, undefined, undefined).length).toBeGreaterThan(0)
    })

    it("should filter by contextType", () => {
      retrieveIntents(catalog, "fdc3.contact", undefined, undefined).forEach(intent => {
        expect(intent.contexts).toContain("fdc3.contact")
      })
    })

    it("should filter by intentName", () => {
      const intents = retrieveIntents(catalog, undefined, "ViewContact", undefined)
      expect(intents).toHaveLength(2)
      intents.forEach(intent => expect(intent.intentName).toBe("ViewContact"))
    })

    it("should filter by resultType", () => {
      const intents = retrieveIntents(catalog, undefined, undefined, "fdc3.contact")
      expect(intents).toHaveLength(2)
      intents.forEach(intent => expect(intent.resultType).toBe("fdc3.contact"))
    })

    it("should filter by multiple criteria", () => {
      const intents = retrieveIntents(catalog, "fdc3.contact", "ViewContact", "fdc3.contact")
      expect(intents).toHaveLength(2)
    })
  })

  describe("retrieveAppsByUrl()", () => {
    const catalog = addApplications(createInitialState(DEFAULT_FDC3_USER_CHANNELS), [
      mockApp1,
      mockApp2,
      mockApp3,
    ]).appDirectory

    it("should return web apps matching URL", () => {
      const apps = retrieveAppsByUrl(catalog, "https://example.com/app1")
      expect(apps).toHaveLength(1)
      expect(apps[0].appId).toBe("app-1")
    })

    it("should return empty array for non-matching URL", () => {
      expect(retrieveAppsByUrl(catalog, "https://example.com/nonexistent")).toHaveLength(0)
    })

    it("should return empty array for invalid input", () => {
      expect(retrieveAppsByUrl(catalog, "")).toHaveLength(0)
      expect(retrieveAppsByUrl(catalog, null as unknown as string)).toHaveLength(0)
    })
  })
})
