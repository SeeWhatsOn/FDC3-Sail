import { AppIdentifier, AppIntent, OpenError } from "@finos/fdc3-standard"
import type { Context } from "@finos/fdc3-context"
import { AbstractDacpRuntime } from "../AbstractDacpRuntime"
import {
  type AppRegistration,
  type InstanceID,
  State,
} from "../AppRegistration"
import type {
  Directory,
  DirectoryApp,
} from "../app-directory/DirectoryInterface"
import type { ChannelState } from "../DacpRuntime"
import type { MessageHandler } from "../handlers/MessageHandler"
import { BroadcastHandler } from "../handlers/BroadcastHandler"
import { IntentHandler } from "../handlers/IntentHandler"
import { OpenHandler } from "../handlers/OpenHandler"

export type BrowserInstanceDetails = AppRegistration & {
  instanceTitle?: string
  channel?: string | null
}

export type BrowserDacpRuntimeOptions = {
  directory: Directory
  channels: ChannelState[]
  sendToApp: (instanceId: string, message: unknown) => void
  /** Host opens an app surface and returns the instance id (iframe/tab). */
  openApp: (
    app: DirectoryApp,
    channel: string | null,
  ) => Promise<{
    instanceId: string
    instanceTitle?: string
  }>
  /** Optional Sail-style intent resolver; default returns intents unchanged. */
  narrowIntents?: (
    raiser: AppIdentifier,
    appIntents: AppIntent[],
    context: Context,
  ) => Promise<AppIntent[]>
  provider?: string
  providerVersion?: string
  fdc3Version?: string
  log?: (message: string) => void
  /** Called when an instance becomes Connected (e.g. assign initial user channel). */
  onInstanceConnected?: (instanceId: string) => void
}

/**
 * In-browser DacpRuntime: MessagePort egress + host openApp callbacks.
 */
export class BrowserDacpRuntime extends AbstractDacpRuntime {
  private instances: BrowserInstanceDetails[] = []
  private directory: Directory
  private readonly options: Omit<BrowserDacpRuntimeOptions, "directory">
  private appStartDestinations = new Map<string, string>()

  constructor(options: BrowserDacpRuntimeOptions) {
    const handlers: MessageHandler[] = [
      new BroadcastHandler(),
      new IntentHandler(20000),
      new OpenHandler(10000),
    ]
    super(handlers, options.channels)
    const { directory, ...rest } = options
    this.directory = directory
    this.options = rest
  }

  getDirectory(): Directory {
    return this.directory
  }

  replaceDirectory(directory: Directory): void {
    this.directory = directory
  }

  createUUID(): string {
    return crypto.randomUUID()
  }

  provider(): string {
    return this.options.provider ?? "sail-desktop-agent"
  }

  providerVersion(): string {
    return this.options.providerVersion ?? "0.0.0"
  }

  fdc3Version(): string {
    return this.options.fdc3Version ?? "2.2"
  }

  log(message: string): void {
    this.options.log?.(message)
  }

  async narrowIntents(
    raiser: AppIdentifier,
    appIntents: AppIntent[],
    context: Context,
  ): Promise<AppIntent[]> {
    if (this.options.narrowIntents) {
      return this.options.narrowIntents(raiser, appIntents, context)
    }
    return appIntents
  }

  getInstanceDetails(uuid: string): BrowserInstanceDetails | undefined {
    return this.instances.find((ca) => ca.instanceId === uuid)
  }

  setInstanceDetails(uuid: InstanceID, details: BrowserInstanceDetails): void {
    if (uuid !== details.instanceId) {
      throw new Error("UUID mismatch")
    }
    this.instances = this.instances.filter((ca) => ca.instanceId !== uuid)
    this.instances.push(details)
  }

  async open(appId: string): Promise<InstanceID> {
    const destination = this.appStartDestinations.get(appId) ?? null
    this.appStartDestinations.delete(appId)

    const apps = this.directory.retrieveAppsById(appId)
    if (apps.length === 0) {
      throw new Error(OpenError.AppNotFound)
    }

    const opened = await this.options.openApp(apps[0], destination)
    this.setInstanceDetails(opened.instanceId, {
      appId,
      instanceId: opened.instanceId,
      state: State.Pending,
      instanceTitle: opened.instanceTitle,
      channel: destination,
    })
    return opened.instanceId
  }

  /** Used by Sail host when assigning channel before open. */
  setOpenDestination(appId: string, channel: string): void {
    this.appStartDestinations.set(appId, channel)
  }

  async setAppState(app: InstanceID, newState: State): Promise<void> {
    const found = this.instances.find((a) => a.instanceId === app)
    if (!found) {
      return
    }
    const wasPending = found.state === State.Pending
    if (found.state !== State.Terminated && newState === State.Terminated) {
      await this.cleanupApp(app)
    }
    found.state = newState
    if (wasPending && newState === State.Connected) {
      this.options.onInstanceConnected?.(app)
    }
  }

  async getConnectedApps(): Promise<AppRegistration[]> {
    return (await this.getAllApps()).filter((a) => a.state === State.Connected)
  }

  async getAllApps(): Promise<AppRegistration[]> {
    return this.instances.map((x) => ({
      appId: x.appId,
      instanceId: x.instanceId,
      state: x.state,
    }))
  }

  async isAppConnected(app: InstanceID): Promise<boolean> {
    const found = this.instances.find(
      (a) => a.instanceId === app && a.state === State.Connected,
    )
    return found != null
  }

  async post(msg: object, to: InstanceID): Promise<void> {
    if (to == null) {
      return
    }
    this.options.sendToApp(to, msg)
  }

  /** Pre-register a host-launched instance before the app completes WCP. */
  registerPendingLaunch(
    appId: string,
    instanceId: string,
    extras?: { instanceTitle?: string; channel?: string | null },
  ): void {
    this.setInstanceDetails(instanceId, {
      appId,
      instanceId,
      state: State.Pending,
      instanceTitle: extras?.instanceTitle,
      channel: extras?.channel ?? null,
    })
  }
}
