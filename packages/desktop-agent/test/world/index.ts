import { World, setWorldConstructor, type IWorldOptions } from "@cucumber/cucumber"
import { DesktopAgent } from "../../src/core/desktop-agent"
import { AppInstanceRegistry } from "../../src/core/state/app-instance-registry"
import { IntentRegistry } from "../../src/core/state/intent-registry"
import { ChannelContextRegistry } from "../../src/core/state/channel-context-registry"
import { AppChannelRegistry } from "../../src/core/state/app-channel-registry"
import { UserChannelRegistry } from "../../src/core/state/user-channel-registry"
import { MockTransport } from "../support/MockTransport"
import { MockAppLauncher } from "../support/MockAppLauncher"
import { MockIntentResolver } from "../support/MockIntentResolver"
import type { DisplayMetadata, BrowserTypes } from "@finos/fdc3"
import type { DirectoryApp } from "../../src/core/app-directory/types"
import { AppDirectoryManager } from "../../src/core/app-directory/app-directory-manager"

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
 * - REAL registries (internal state - no mocking needed)
 * - MOCK external dependencies (transport, app launcher, intent resolver)
 * - Direct access to all components for assertions
 */
export class CustomWorld extends World {
  // The actual DesktopAgent instance being tested
  desktopAgent!: DesktopAgent

  // REAL registries (internal state - test the real thing!)
  appInstanceRegistry!: AppInstanceRegistry
  intentRegistry!: IntentRegistry
  channelContextRegistry!: ChannelContextRegistry
  appChannelRegistry!: AppChannelRegistry
  userChannelRegistry!: UserChannelRegistry
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
   * Uses dependency injection: create registries in tests and pass them to DesktopAgent.
   * This allows tests to access registries directly without exposing them via getters.
   */
  initializeDesktopAgent(apps: DirectoryApp[], channels: UserChannelConfig[]): void {
    // Create MOCK external dependencies - avoid side effects
    this.mockTransport = new MockTransport()
    this.mockAppLauncher = new MockAppLauncher()
    this.mockIntentResolver = new MockIntentResolver()

    // Create REAL registries (internal state - test the real thing!)
    // We create them here so we can access them directly for assertions
    this.appInstanceRegistry = new AppInstanceRegistry()
    this.intentRegistry = new IntentRegistry()
    this.channelContextRegistry = new ChannelContextRegistry()
    this.appChannelRegistry = new AppChannelRegistry()
    this.userChannelRegistry = new UserChannelRegistry(channels as BrowserTypes.Channel[])
    this.appDirectoryManager = new AppDirectoryManager()

    // Create DesktopAgent with dependency injection - pass in our registries
    this.desktopAgent = new DesktopAgent({
      // External dependencies (mocked)
      transport: this.mockTransport,
      appLauncher: this.mockAppLauncher,
      requestIntentResolution: this.mockIntentResolver.createCallback(),
      // Internal state (injected - we own these instances)
      appInstanceRegistry: this.appInstanceRegistry,
      intentRegistry: this.intentRegistry,
      channelContextRegistry: this.channelContextRegistry,
      appChannelRegistry: this.appChannelRegistry,
      userChannelRegistry: this.userChannelRegistry,
      appDirectoryManager: this.appDirectoryManager,
    })

    // Add apps to directory and sync to intent registry
    this.appDirectoryManager.addApplications(apps)
    this.desktopAgent.syncAppDirectoryToIntentRegistry()

    // Start the agent
    this.desktopAgent.start()
  }

  /**
   * Helper to create unique UUIDs for test messages
   */
  createUUID(): string {
    return crypto.randomUUID()
  }
}

setWorldConstructor(CustomWorld)
