import { Socket } from "socket.io"
import { v4 as uuidv4 } from "uuid"
import {
  State,
  type AppRegistration,
  type InstanceID,
  type ServerContext,
  type FDC3Server,
  type ChannelState,
  type DirectoryApp
} from "@finos/fdc3-web-impl"
import { AppIdentifier } from "@finos/fdc3"
import { AppDirectoryManager } from "@finos/fdc3-sail-desktop-agent"
import { AppIntent, Context } from "@finos/fdc3"
import {
  AppManagementMessages,
  ChannelMessages,
  IntentMessages,
  ContextMessages,
  SailAppOpenArgs,
  AppHosting,
  SailIntentResolveResponse,
  AugmentedAppIntent,
  AugmentedAppMetadata,
  SailAppOpenResponse,
  TabDetail,
  ContextHistory,
} from "@finos/fdc3-web-impl"
import {
  BroadcastRequest,
  ChannelChangedEvent,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { mapChannels } from "./SailFDC3Server"
import { APP_CONFIG } from "../constants"

/**
 * Retrieves the icon URL for an application directory entry
 * @param appDirectory - The directory app entry to get icon for
 * @returns The icon source URL or default icon if none found
 */
function getIcon(appDirectory: DirectoryApp | undefined): string {
  if (appDirectory) {
    const icons = appDirectory.icons ?? []
    if (icons.length > 0) {
      return icons[0].src
    }
  }

  return APP_CONFIG.DEFAULT_ICON
}

/** Type for FDC3Server handlers to safely access channel state */
interface FDC3ServerWithHandlers {
  handlers: Array<{
    state: ChannelState[]
  }>
  cleanup: (instanceId: InstanceID) => void
}

/**
 * Represents the state of a Sail app.
 * - Pending: App has a window, but isn't connected to FDC3
 * - Connected: App is connected to FDC3
 * - NotResponding: App is not responding to heartbeats
 * - Terminated: App window has been closed
 */
export interface SailData extends AppRegistration {
  readonly socket?: Socket
  readonly channelSockets: readonly Socket[]
  readonly url?: string
  readonly hosting: AppHosting
  channel: string | null
  readonly instanceTitle: string
}

/**
 * App instance manager implementation for FDC3 Sail desktop agent.
 * Manages app instances, channels, and communication between client apps and the desktop agent.
 */
export class SailAppInstanceManager implements ServerContext<SailData> {
  public readonly directory: AppDirectoryManager
  private readonly instances: SailData[] = []
  private fdc3Server: FDC3ServerWithHandlers | undefined
  private readonly socket: Socket
  private readonly appStartDestinations = new Map<string, string | null>()

  /**
   * Creates a new SailServerContext
   * @param directory - The application directory service
   * @param socket - Socket.io socket for communication with the client
   */
  constructor(directory: AppDirectoryManager, socket: Socket) {
    this.directory = directory
    this.socket = socket
  }

  /**
   * Posts a message to a specific app instance
   * @param message - The message object to send
   * @param instanceId - The ID of the target app instance
   */
  async post(message: object, instanceId: InstanceID): Promise<void> {
    const instance = this.findInstanceById(instanceId)
    if (instance) {
      const messageWithType = message as { type?: string }
      if (!messageWithType?.type?.startsWith("heartbeat")) {
        this.log(`Posting message to app: ${JSON.stringify(message)}`)
      }
      // Use single fdc3_event for all DACP messages (Socket.IO best practice)
      instance.socket?.emit('fdc3_event', message)
      return Promise.resolve()
    } else {
      this.log(`Cannot find app with instanceId: ${JSON.stringify(instanceId)}`)
    }
  }

  /**
   * Notifies the client about a context broadcast event
   */
  notifyBroadcastContext(broadcastEvent: any): void {
    const { channelId, context } = broadcastEvent.payload
    this.socket.emit(ContextMessages.SAIL_BROADCAST_CONTEXT, {
      channelId,
      context,
    })
  }

  /**
   * Opens an app and returns its instance ID
   */
  async open(appId: string): Promise<InstanceID> {
    const destination = this.appStartDestinations.get(appId)
    this.appStartDestinations.delete(appId)
    return this.openAppInSail(appId, destination ?? null)
  }

  /**
   * Opens a Sail app in the specified channel
   */
  async openAppInSail(appId: string, channel: string | null): Promise<InstanceID> {
    const applications = this.directory.retrieveAppsById(appId)

    if (applications.length === 0) {
      throw new Error("AppNotFound")
    }

    const [firstApp] = applications
    const url = (firstApp.details as { url?: string })?.url

    if (!url) {
      throw new Error("AppNotFound")
    }

    const forceNewWindow = (firstApp.hostManifests as { sail?: { forceNewWindow?: boolean } })?.sail
      ?.forceNewWindow
    const hosting = forceNewWindow || channel === null ? AppHosting.Tab : AppHosting.Frame

    const openResponse = (await this.socket.emitWithAck(AppManagementMessages.SAIL_APP_OPEN, {
      appDRecord: firstApp,
      approach: hosting,
      channel,
    } as SailAppOpenArgs)) as SailAppOpenResponse

    // The app instance is now created and managed in the desktop-agent's AppInstanceRegistry
    // This class no longer holds the instance state.

    return openResponse.instanceId
  }

  // All other state management methods have been removed as they are now
  // handled by the @finos/fdc3-sail-desktop-agent package.
}
