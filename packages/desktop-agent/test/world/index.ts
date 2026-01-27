import { World, setWorldConstructor, type IWorldOptions } from "@cucumber/cucumber"
import { DesktopAgent } from "../../src/core/desktop-agent"
import { MockTransport } from "../support/MockTransport"
import { MockAppLauncher } from "../support/MockAppLauncher"
import { MockIntentResolver } from "../support/MockIntentResolver"
import type { DisplayMetadata, BrowserTypes } from "@finos/fdc3"
import type { DirectoryApp } from "../../src/core/app-directory/types"
import { AppDirectoryManager } from "../../src/core/app-directory/app-directory-manager"
import type { AgentState } from "../../src/core/state/types"
import { connectInstance } from "../../src/core/state/mutators"

/**
 * User channel configuration for tests
 */
export interface UserChannelConfig {
  id: string
  type: "user"
  displayMetadata?: DisplayMetadata
}

/**
 * Test properties stored in World for sharing data between Cucumber steps.
 *
 * Known properties:
 * - `instances`: Maps app identifier strings to instance IDs
 * - `apps`: Array of DirectoryApp definitions for test setup
 * - `result`: Test results stored for later assertions
 *
 * Additional arbitrary properties can be stored for variable substitution
 * (e.g., from "I refer to {string} as {string}" step).
 */
export interface TestProps {
  /** Maps app identifier strings (e.g., "App1", "appId: App1, instanceId: a1") to instance IDs */
  instances?: Record<string, string>
  /** Array of DirectoryApp definitions used to initialize the DesktopAgent */
  apps?: DirectoryApp[]
  /** Test results stored for later assertions */
  result?: unknown
  /** Arbitrary properties for variable substitution and test data sharing */
  [key: string]: unknown
}

/**
 * Cucumber World for FDC3 Desktop Agent tests
 *
 * Clean architecture that uses:
 * - REAL state (internal state - no mocking needed)
 * - MOCK external dependencies (transport, app launcher, intent resolver)
 * - Direct access to state via getState() for assertions
 */
export class CustomWorld extends World {
  // The actual DesktopAgent instance being tested
  desktopAgent!: DesktopAgent

  // App directory manager (for test setup and assertions)
  appDirectoryManager!: AppDirectoryManager

  // MOCK external dependencies (to avoid side effects)
  mockTransport!: MockTransport
  mockAppLauncher!: MockAppLauncher
  mockIntentResolver!: MockIntentResolver

  // Test data storage (for sharing data between steps)
  props: TestProps = {}

  constructor(options: IWorldOptions<unknown>) {
    super(options)
  }

  /**
   * Initialize the DesktopAgent for a test scenario.
   * Called by setup steps (e.g., "Given a desktop agent")
   * 
   * Uses the new functional state management pattern.
   * Access state via desktopAgent.getState() for assertions.
   */
  initializeDesktopAgent(apps: DirectoryApp[], channels: UserChannelConfig[]): void {

    // Create MOCK external dependencies - avoid side effects
    this.mockTransport = new MockTransport()
    this.mockAppLauncher = new MockAppLauncher()
    this.mockIntentResolver = new MockIntentResolver()

    // Create app directory manager for test setup
    this.appDirectoryManager = new AppDirectoryManager()
    this.appDirectoryManager.addApplications(apps)

    // Create DesktopAgent with new state-based API
    this.desktopAgent = new DesktopAgent({
      // External dependencies (mocked)
      transport: this.mockTransport,
      appLauncher: this.mockAppLauncher,
      requestIntentResolution: this.mockIntentResolver.createCallback(),
      // App directory and apps
      appDirectoryManager: this.appDirectoryManager,
      apps: apps,
      // User channels
      userChannels: channels as BrowserTypes.Channel[],
      implementationMetadata: {
        fdc3Version: "2.2",
        provider: "cucumber-provider",
        providerVersion: "1.0.0",
        optionalFeatures: {
          DesktopAgentBridging: false,
          OriginatingAppMetadata: true,
          UserChannelMembershipAPIs: true,
        }
      },
      openContextListenerTimeoutMs: 2000,
    })

    // Wire up MockAppLauncher callback to register instances in state
    this.mockAppLauncher.onInstanceCreated = (instanceId, appId) => {
      this.updateState(state =>
        connectInstance(state, {
          instanceId,
          appId,
          metadata: { appId, name: appId },
        })
      )
    }

    // Start the agent
    this.desktopAgent.start()
  }

  /**
   * Get current agent state for assertions.
   * Use this instead of accessing registries directly.
   */
  getState(): AgentState {
    return this.desktopAgent.getState()
  }

  /**
   * Update agent state (for test fixture setup).
   * This uses DesktopAgent's test helper method.
   */
  updateState(fn: (state: AgentState) => AgentState): void {
    this.desktopAgent.updateStateForTesting(fn)
  }

  /**
   * Helper to create unique UUIDs for test messages
   */
  createUUID(): string {
    return crypto.randomUUID()
  }
}

setWorldConstructor(CustomWorld)
