import { World, setWorldConstructor } from '@cucumber/cucumber';
import { DesktopAgent } from '../../src/core/desktop-agent';
import { AppInstanceRegistry } from '../../src/core/state/app-instance-registry';
import { IntentRegistry } from '../../src/core/state/intent-registry';
import { ChannelContextRegistry } from '../../src/core/state/channel-context-registry';
import { AppChannelRegistry } from '../../src/core/state/app-channel-registry';
import { UserChannelRegistry } from '../../src/core/state/user-channel-registry';
import { MockTransport } from '../support/MockTransport';
import { MockAppLauncher } from '../support/MockAppLauncher';
import { MockIntentResolver } from '../support/MockIntentResolver';
import type { DisplayMetadata } from '@finos/fdc3';
import { BasicDirectory } from '@finos/fdc3-web-impl/dist/src/directory/BasicDirectory';
import type { DirectoryApp } from '../../src/core/app-directory/types';

/**
 * User channel configuration for tests
 */
export interface UserChannelConfig {
  id: string;
  type: 'user';
  displayMetadata?: DisplayMetadata;
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
  desktopAgent!: DesktopAgent;
  
  // REAL registries (internal state - test the real thing!)
  appInstanceRegistry!: AppInstanceRegistry;
  intentRegistry!: IntentRegistry;
  channelContextRegistry!: ChannelContextRegistry;
  appChannelRegistry!: AppChannelRegistry;
  userChannelRegistry!: UserChannelRegistry;
  appDirectory!: BasicDirectory;
  
  // MOCK external dependencies (to avoid side effects)
  mockTransport!: MockTransport;
  mockAppLauncher!: MockAppLauncher;
  mockIntentResolver!: MockIntentResolver;
  
  // Test data storage (for sharing data between steps)
  props: Record<string, any> = {};

  constructor(options: any) {
    super(options);
  }

  /**
   * Initialize the DesktopAgent for a test scenario.
   * Called by setup steps (e.g., "Given a newly instantiated FDC3 Server")
   */
  initializeDesktopAgent(
    apps: DirectoryApp[], 
    channels: UserChannelConfig[],
    options?: {
      intentTimeoutMs?: number;
      appLaunchTimeoutMs?: number;
    }
  ): void {
    // Create REAL registries - we want to test actual behavior
    this.appInstanceRegistry = new AppInstanceRegistry();
    this.intentRegistry = new IntentRegistry();
    this.channelContextRegistry = new ChannelContextRegistry();
    this.appChannelRegistry = new AppChannelRegistry();
    this.userChannelRegistry = new UserChannelRegistry(channels as any);
    this.appDirectory = new BasicDirectory(apps);
    
    // Create MOCK external dependencies - avoid side effects
    this.mockTransport = new MockTransport();
    this.mockAppLauncher = new MockAppLauncher();
    this.mockIntentResolver = new MockIntentResolver();
    
    // Create and configure DesktopAgent
    this.desktopAgent = new DesktopAgent({
      // External dependencies (mocked)
      transport: this.mockTransport,
      appLauncher: this.mockAppLauncher,
      requestIntentResolution: this.mockIntentResolver.createCallback(),
      
      // Internal state (real instances)
      appInstanceRegistry: this.appInstanceRegistry,
      intentRegistry: this.intentRegistry,
      channelContextRegistry: this.channelContextRegistry,
      appChannelRegistry: this.appChannelRegistry,
      userChannelRegistry: this.userChannelRegistry,
      appDirectoryManager: this.appDirectory as any,
    });
    
    // Sync apps from directory to intent registry
    this.desktopAgent.syncAppDirectoryToIntentRegistry();
    
    // Start the agent
    this.desktopAgent.start();
  }

  /**
   * Helper to create unique UUIDs for test messages
   */
  createUUID(): string {
    return crypto.randomUUID();
  }
}

setWorldConstructor(CustomWorld);
