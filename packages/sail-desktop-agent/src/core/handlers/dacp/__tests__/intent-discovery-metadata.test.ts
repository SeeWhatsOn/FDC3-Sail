import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"
import { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import type { DirectoryApp } from "../../../app-directory/types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { connectInstance, updateInstanceState } from "../../../state/mutators"
import { registerIntentListener } from "../../../state/mutators/intent"
import { createInitialState } from "../../../state/initial-state"
import { AppInstanceState } from "../../../state/types"
import { createDACPTestContext } from "./test-context"
import {
  createAppIntents,
  findIntentsByContext,
} from "../intent-handlers/intent-helpers"
import {
  handleFindIntentRequest,
  handleFindIntentsByContextRequest,
} from "../intent-handlers/intent-discovery-handlers"

const INTENT_APP_A_DISPLAY_NAME = "A Testing Intent"
const INTENT_APP_A_INTENT_NAME = "aTestingIntent"
const TEST_CONTEXT_X = "testContextX"
const TEST_CONTEXT_Y = "testContextY"

/** Mirrors intent-a / IntentAppAId from conformance-appd.json */
const intentAppA: DirectoryApp = {
  appId: "IntentAppAId",
  name: "IntentAppA",
  title: "Intent App A",
  description: "Part of the FDC3 Conformance Tests",
  type: "web",
  details: {
    url: "https://fdc3.finos.org/toolbox/fdc3-conformance/apps/intent-a/index.html",
  },
  version: "1.0.0",
  interop: {
    intents: {
      listensFor: {
        [INTENT_APP_A_INTENT_NAME]: {
          displayName: INTENT_APP_A_DISPLAY_NAME,
          contexts: [TEST_CONTEXT_X, "testContextZ"],
        },
        sharedTestingIntent1: {
          displayName: "Shared Testing Intent 1",
          contexts: [TEST_CONTEXT_X],
        },
      },
    },
  },
}

function loadConformanceIntentAppA(): DirectoryApp {
  const raw = readFileSync(
    new URL("../../../../../../../conformance-appd.json", import.meta.url),
    "utf-8"
  )
  const data = JSON.parse(raw) as { applications: DirectoryApp[] }
  const app = data.applications.find(entry => entry.appId === "IntentAppAId")
  if (!app) {
    throw new Error("IntentAppAId not found in conformance-appd.json")
  }
  return app
}

function createAppDirectory(apps: DirectoryApp[]): AppDirectoryManager {
  const directory = new AppDirectoryManager()
  directory.addApplications(apps)
  return directory
}

function createRequestMeta(requestUuid: string): BrowserTypes.RequestMessage["meta"] {
  return {
    requestUuid,
    timestamp: new Date(),
    source: { appId: "TestApp", instanceId: "a1" },
  }
}

type FindIntentSuccessResponse = {
  type: "findIntentResponse"
  payload: {
    appIntent: {
      intent: { name: string; displayName?: string }
      apps: Array<{ appId: string; instanceId?: string }>
    }
  }
}

type FindIntentsByContextSuccessResponse = {
  type: "findIntentsByContextResponse"
  payload: {
    appIntents: Array<{
      intent: { name: string; displayName?: string }
      apps: Array<{ appId: string; instanceId?: string }>
    }>
  }
}

function getFindIntentResponse(transport: MockTransport): FindIntentSuccessResponse {
  const last = transport.getLastMessage() as FindIntentSuccessResponse
  expect(last.type).toBe("findIntentResponse")
  return last
}

function getFindIntentsByContextResponse(
  transport: MockTransport
): FindIntentsByContextSuccessResponse {
  const last = transport.getLastMessage() as FindIntentsByContextSuccessResponse
  expect(last.type).toBe("findIntentsByContextResponse")
  return last
}

describe("intent discovery metadata from app directory", () => {
  describe("createAppIntents", () => {
    const displayNameCases = [
      {
        name: "inline conformance-style intent-a fixture",
        app: intentAppA,
      },
      {
        name: "IntentAppAId from conformance-appd.json",
        app: loadConformanceIntentAppA(),
      },
    ] as const

    it.each(displayNameCases)(
      "maps directory displayName for aTestingIntent ($name)",
      ({ app }) => {
        const directory = createAppDirectory([app])
        const state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)

        const appIntents = createAppIntents(
          state,
          directory,
          INTENT_APP_A_INTENT_NAME,
          TEST_CONTEXT_X
        )

        expect(appIntents).toHaveLength(1)
        expect(appIntents[0].intent.name).toBe(INTENT_APP_A_INTENT_NAME)
        expect(appIntents[0].intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
      }
    )
  })

  describe("findIntentsByContext", () => {
    it("returns directory displayName for intents matching the context", () => {
      const directory = createAppDirectory([intentAppA])
      const state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)

      const intents = findIntentsByContext(state, directory, TEST_CONTEXT_X)
      const testingIntent = intents.find(entry => entry.name === INTENT_APP_A_INTENT_NAME)

      expect(testingIntent).toBeDefined()
      expect(testingIntent?.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
    })
  })

  describe("handleFindIntentRequest", () => {
    it("responds with directory displayName for aTestingIntent", () => {
      let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
      state = connectInstance(state, {
        instanceId: "a1",
        appId: "TestApp",
        metadata: { appId: "TestApp", name: "TestApp" },
      })
      state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

      const transport = new MockTransport()
      const directory = createAppDirectory([intentAppA])
      const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

      handleFindIntentRequest(
        {
          type: "findIntentRequest",
          meta: createRequestMeta("find-intent-display-name"),
          payload: {
            intent: INTENT_APP_A_INTENT_NAME,
            context: { type: TEST_CONTEXT_X },
          },
        },
        { ...context, transport, appDirectory: directory }
      )

      const response = getFindIntentResponse(transport)
      expect(response.payload.appIntent.intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
    })
  })

  describe("handleFindIntentsByContextRequest", () => {
    it("returns each matching intent once when directory and running listener both handle the context", () => {
      let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
      state = connectInstance(state, {
        instanceId: "instance-a",
        appId: "IntentAppAId",
        metadata: { appId: "IntentAppAId", name: "IntentAppA" },
      })
      state = updateInstanceState(state, "instance-a", AppInstanceState.CONNECTED)
      state = registerIntentListener(state, {
        listenerId: "listener-a",
        intentName: INTENT_APP_A_INTENT_NAME,
        instanceId: "instance-a",
        appId: "IntentAppAId",
        contextTypes: [],
      })
      state = connectInstance(state, {
        instanceId: "a1",
        appId: "TestApp",
        metadata: { appId: "TestApp", name: "TestApp" },
      })
      state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

      const transport = new MockTransport()
      const directory = createAppDirectory([intentAppA])
      const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

      handleFindIntentsByContextRequest(
        {
          type: "findIntentsByContextRequest",
          meta: createRequestMeta("find-intents-by-context-dedupe"),
          payload: {
            context: { type: TEST_CONTEXT_X },
          },
        },
        { ...context, transport, appDirectory: directory }
      )

      const response = getFindIntentsByContextResponse(transport)
      const intentNames = response.payload.appIntents.map(entry => entry.intent.name)

      expect(intentNames).toEqual(
        expect.arrayContaining([INTENT_APP_A_INTENT_NAME, "sharedTestingIntent1"])
      )
      expect(new Set(intentNames).size).toBe(intentNames.length)
      expect(response.payload.appIntents).toHaveLength(2)

      const testingIntent = response.payload.appIntents.find(
        entry => entry.intent.name === INTENT_APP_A_INTENT_NAME
      )
      expect(testingIntent?.intent.displayName).toBe(INTENT_APP_A_DISPLAY_NAME)
      expect(testingIntent?.apps).toHaveLength(2)
      expect(testingIntent?.apps.filter(app => app.instanceId === "instance-a")).toHaveLength(1)
    })

    it("does not add intents from running listeners when directory excludes the context type", () => {
      const contextYOnlyApp: DirectoryApp = {
        appId: "ContextYOnlyApp",
        title: "Context Y Only App",
        type: "web",
        details: { url: "https://example.com/context-y-only" },
        interop: {
          intents: {
            listensFor: {
              contextYOnlyIntent: {
                displayName: "Context Y Only Intent",
                contexts: [TEST_CONTEXT_Y],
              },
            },
          },
        },
      }

      let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
      state = connectInstance(state, {
        instanceId: "listener-instance",
        appId: "ContextYOnlyApp",
        metadata: { appId: "ContextYOnlyApp", name: "ContextYOnlyApp" },
      })
      state = updateInstanceState(state, "listener-instance", AppInstanceState.CONNECTED)
      state = registerIntentListener(state, {
        listenerId: "listener-y-only",
        intentName: "contextYOnlyIntent",
        instanceId: "listener-instance",
        appId: "ContextYOnlyApp",
        contextTypes: [],
      })
      state = connectInstance(state, {
        instanceId: "a1",
        appId: "TestApp",
        metadata: { appId: "TestApp", name: "TestApp" },
      })
      state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

      const transport = new MockTransport()
      const directory = createAppDirectory([intentAppA, contextYOnlyApp])
      const { context } = createDACPTestContext({ instanceId: "a1", initialState: state })

      handleFindIntentsByContextRequest(
        {
          type: "findIntentsByContextRequest",
          meta: createRequestMeta("find-intents-by-context-no-listener-inflation"),
          payload: {
            context: { type: TEST_CONTEXT_X },
          },
        },
        { ...context, transport, appDirectory: directory }
      )

      const response = getFindIntentsByContextResponse(transport)
      const intentNames = response.payload.appIntents.map(entry => entry.intent.name)

      expect(intentNames).not.toContain("contextYOnlyIntent")
      expect(response.payload.appIntents).toHaveLength(2)
    })
  })
})
