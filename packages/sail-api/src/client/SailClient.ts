import type { Socket } from "socket.io-client"
import {
  type SailMessage,
  SailMessages,
  type DesktopAgentHelloPayload,
  type SailClientStatePayload,
  type DesktopAgentRegisterAppLaunchPayload,
  type DesktopAgentDirectoryListingPayload,
  type DirectoryApp,
} from ".."
import { MiddlewarePipeline, type Middleware } from "../middleware"

/**
 * A typed client for interacting with the Sail server via Socket.IO.
 * This class wraps the proprietary 'sail_event' messages into a clean, async/await API.
 */
export class SailClient {
  private socket: Socket
  private pipeline: MiddlewarePipeline<unknown>

  /**
   * Creates an instance of SailClient.
   * @param socket The connected socket.io-client instance.
   */
  constructor(socket: Socket) {
    if (!socket) {
      throw new Error("Socket instance is required for SailClient.")
    }
    this.socket = socket
    this.pipeline = new MiddlewarePipeline()
  }

  /**
   * Add middleware to the message processing pipeline.
   * @param middleware The middleware function to add
   */
  use(middleware: Middleware<unknown>): this {
    this.pipeline.use(middleware)
    return this
  }

  /**
   * A private helper to emit a message and await an acknowledgment.
   * @param type The specific Sail message type.
   * @param payload The data to send.
   * @returns A promise that resolves with the server's response.
   */
  private async emitWithAck<T>(
    type: keyof typeof SailMessages | string,
    payload: unknown
  ): Promise<T> {
    const message: Partial<SailMessage> = {
      type: type as any,
      payload: payload as any,
    }

    let result: T | undefined

    // Execute middleware pipeline
    await this.pipeline.execute({ message }, async ctx => {
      // Final step: Emit message
      const msg = ctx.message as Partial<SailMessage>
      result = await this.socket.emitWithAck(SailMessages.SAIL_EVENT, msg)
    })

    if (result === undefined) {
      throw new Error("Message processing failed or no response received")
    }

    return result
  }

  /**
   * Sends the initial hello message from the desktop agent UI shell.
   * @param payload The hello payload containing directories, channels, etc.
   * @returns A promise that resolves to true on success.
   */
  public desktopAgentHello(payload: DesktopAgentHelloPayload): Promise<boolean> {
    return this.emitWithAck<boolean>(SailMessages.DA_HELLO, payload)
  }

  /**
   * Sends a full client state update to the server.
   * @param payload The client state payload.
   * @returns A promise that resolves to true on success.
   */
  public updateClientState(payload: SailClientStatePayload): Promise<boolean> {
    return this.emitWithAck<boolean>(SailMessages.SAIL_CLIENT_STATE, payload)
  }

  /**
   * Requests the server to register an app for future launching.
   * @param payload The details of the app to register.
   * @returns A promise that resolves with the new instanceId for the app.
   */
  public registerAppLaunch(payload: DesktopAgentRegisterAppLaunchPayload): Promise<string> {
    return this.emitWithAck<string>(SailMessages.DA_REGISTER_APP_LAUNCH, payload)
  }

  /**
   * Fetches the list of all applications from the app directory.
   * @returns A promise that resolves with an array of DirectoryApp objects.
   */
  public getDirectoryListing(): Promise<DirectoryApp[]> {
    const payload: Partial<DesktopAgentDirectoryListingPayload> = {
      type: SailMessages.DA_DIRECTORY_LISTING as any,
    }
    return this.emitWithAck<DirectoryApp[]>(SailMessages.DA_DIRECTORY_LISTING, payload)
  }
}
