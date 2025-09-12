import { AppIdentifier, AppIntent } from "@finos/fdc3"
import { Context } from "@finos/fdc3"
import { DefaultFDC3Server } from "@finos/fdc3-web-impl/dist/src/index.js"

export { DefaultFDC3Server }

/**
 * App instance state enumeration
 */
export enum State {
  Pending = 0, // App has started, but not completed FDC3 Handshake
  Connected = 1, // App has completed FDC3 handshake
  NotResponding = 2, // App has not responded to a heartbeat
  Terminated = 3, // App has sent a termination message
}

/**
 * This is a unique, long, unguessable string that identifies a particular instance of an app.
 * All messages arriving at the desktop agent will have this UUID attached to them.
 * It is important that this is unguessable as it is a shared secret used to identify the app
 * when reconnecting after navigation or refresh.
 */
export type InstanceID = string

/**
 * App registration with state and instance information
 */
export type AppRegistration = {
  state: State
  appId: string
  instanceId: InstanceID
}

/**
 * Properties used to launch apps with type: web
 */
export interface WebAppDetails {
  /**
   * Application start URL
   */
  url: string
}

/**
 * Channel types
 */
export enum ChannelType {
  user = 0,
  app = 1,
  private = 2,
}

/**
 * Display metadata for channels
 */
export interface DisplayMetadata {
  name?: string
  glyph?: string
  color?: string
}

/**
 * Channel state containing channel information and context
 */
export interface ChannelState {
  id: string
  type: ChannelType
  context: Context[]
  displayMetadata: DisplayMetadata
}

/**
 * Directory app definition for FDC3 application directory
 */
export interface DirectoryApp {
  /** The unique application identifier */
  appId: string
  /** Title for the application */
  title?: string
  /** Application name (may be deprecated) */
  name?: string
  /** Version of the application */
  version?: string
  /** Optional tooltip description */
  tooltip?: string
  /** Description of the application */
  description?: string
  /** Application type (web, native, etc.) */
  type?: "web" | "native" | "citrix" | "onlineNative" | "other"
  /** Launch details specific to the application type */
  details?: {
    url?: string
    [key: string]: unknown
  }
  /** Host-specific manifests */
  hostManifests?: {
    [key: string]: unknown
  }
  /** Array of icons */
  icons?: Array<{
    src: string
    size?: string
    type?: string
  }>
  /** Array of intents */
  intents?: Array<{
    name: string
    displayName?: string
    contexts: string[]
  }>
  /** Contact information */
  contactEmail?: string
  supportEmail?: string
  publisher?: string
  moreInfo?: string
  /** Categories */
  categories?: string[]
  /** Language tag */
  lang?: string
  /** Screenshots */
  screenshots?: Array<{
    src: string
    label?: string
  }>
  /** Localized versions */
  localizedVersions?: {
    [key: string]: Partial<DirectoryApp>
  }
  /** Interoperability configuration for intents and contexts */
  interop?: {
    intents?: {
      listensFor?: {
        [intentName: string]: {
          displayName?: string
          contexts: string[]
          resultType?: string
          customConfig?: Record<string, unknown>
        }
      }
      raises?: {
        [intentName: string]:
          | string[]
          | {
              contexts?: string[]
              resultType?: string
            }
      }
    }
    userChannels?: {
      [channelId: string]: unknown
    }
    appChannels?: Array<{
      id: string
      [key: string]: unknown
    }>
  }
}

/**
 * Directory intent type
 */
export interface DirectoryIntent {
  intentName: string
  appId: string
  name: string
  displayName?: string
  contexts: string[]
}

/**
 * FDC3 Directory interface for application directory
 */
export interface FDC3Directory {
  retrieveAllApps(): DirectoryApp[]
  retrieveApps(
    contextType: string | undefined,
    intentName: string | undefined,
    resultType: string | undefined
  ): DirectoryApp[]
  retrieveAllIntents(): DirectoryIntent[]
  retrieveIntents(
    contextType: string | undefined,
    intentName?: string,
    resultType?: string
  ): DirectoryIntent[]
  retrieveAppsById(appId: string): DirectoryApp[]
}

/**
 * FDC3 Server interface for handling messages and cleanup
 */
export interface FDC3Server {
  /**
   * Receive an incoming message
   */
  receive(message: object, from: InstanceID): Promise<void>
  /**
   * Cleanup state relating to an instance that has disconnected
   */
  cleanup(instanceId: InstanceID): void
}

/**
 * Handles messaging to apps and opening apps
 */
export interface ServerContext<X extends AppRegistration> {
  /**
   * UUID for outgoing message
   */
  createUUID(): string
  /**
   * Post an outgoing message to a particular app
   */
  post(message: object, instanceId: InstanceID): Promise<void>
  /**
   * Opens a new instance of an application.
   * Promise completes once the application window is opened
   */
  open(appId: string): Promise<InstanceID>
  /** Set the FDC3Server instance associated with this context. This reference is
   *  used to notify the server to cleanup state for apps that have been terminated.
   *  The FDC3Server is passed a ServerContext when created and should call this fn
   *  in its constructor.
   */
  setFDC3Server(server: FDC3Server): void
  /**
   * Registers a particular instance id with a given app id
   */
  setInstanceDetails(uuid: InstanceID, details: X): void
  /**
   * Returns the connection details for a particular instance of an app.
   * Used in a variety of MessageHandler classes to retrieve details for
   * an app and when validating an app's identity when connecting.
   */
  getInstanceDetails(uuid: InstanceID): X | undefined
  /**
   * Registers an app as connected to the desktop agent.
   */
  setAppState(app: InstanceID, state: State): Promise<void>
  /**
   * Returns the list of apps open and connected to FDC3 at the current time.
   * Note, it is the implementor's job to ensure this list is
   * up-to-date in the event of app crashes or disconnections.
   */
  getConnectedApps(): Promise<AppRegistration[]>
  /**
   * Return the list of all apps that have ever been registered with the ServerContext.
   */
  getAllApps(): Promise<AppRegistration[]>
  /**
   * Helper function for determining if an app is currently open and connected to the da
   */
  isAppConnected(app: InstanceID): Promise<boolean>
  /**
   * Allows you to write a log message somewhere
   */
  log(message: string): void
  /**
   * Name of the provider of this desktop agent server
   */
  provider(): string
  /**
   * Version of the provider of this desktop agent server
   */
  providerVersion(): string
  /**
   * Supported version of the FDC3 API of the desktop agent server.
   */
  fdc3Version(): string
  /**
   * This is called prior to returning intents to the client.  It is a
   * an opportunity for the server to either present an intent resolver
   * or otherwise mess with the available intents, or do nothing.
   */
  narrowIntents(
    raiser: AppIdentifier,
    appIntents: AppIntent[],
    context: Context
  ): Promise<AppIntent[]>
}
