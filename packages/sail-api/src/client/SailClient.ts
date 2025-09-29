import type { Socket } from "socket.io-client";
import {
    SailMessage,
    SailMessages,
    DesktopAgentHelloPayload,
    SailClientStatePayload,
    DesktopAgentRegisterAppLaunchPayload,
    DesktopAgentDirectoryListingPayload,
    DirectoryApp,
} from "..";

/**
 * A typed client for interacting with the Sail server via Socket.IO.
 * This class wraps the proprietary 'sail_event' messages into a clean, async/await API.
 */
export class SailClient {
    private socket: Socket;

    /**
     * Creates an instance of SailClient.
     * @param socket The connected socket.io-client instance.
     */
    constructor(socket: Socket) {
        if (!socket) {
            throw new Error("Socket instance is required for SailClient.");
        }
        this.socket = socket;
    }

    /**
     * A private helper to emit a message and await an acknowledgment.
     * @param type The specific Sail message type.
     * @param payload The data to send.
     * @returns A promise that resolves with the server's response.
     */
    private async emitWithAck<T>(
        type: keyof typeof SailMessages,
        payload: unknown
    ): Promise<T> {
        const message: Partial<SailMessage> = {
            type,
            payload,
        };
        return this.socket.emitWithAck(SailMessages.SAIL_EVENT, message);
    }

    /**
     * Sends the initial hello message from the desktop agent UI shell.
     * @param payload The hello payload containing directories, channels, etc.
     * @returns A promise that resolves to true on success.
     */
    public desktopAgentHello(payload: DesktopAgentHelloPayload): Promise<boolean> {
        return this.emitWithAck<boolean>("daHello", payload);
    }

    /**
     * Sends a full client state update to the server.
     * @param payload The client state payload.
     * @returns A promise that resolves to true on success.
     */
    public updateClientState(payload: SailClientStatePayload): Promise<boolean> {
        return this.emitWithAck<boolean>("sailClientState", payload);
    }

    /**
     * Requests the server to register an app for future launching.
     * @param payload The details of the app to register.
     * @returns A promise that resolves with the new instanceId for the app.
     */
    public registerAppLaunch(payload: DesktopAgentRegisterAppLaunchPayload): Promise<string> {
        return this.emitWithAck<string>("daRegisterAppLaunch", payload);
    }

    /**
     * Fetches the list of all applications from the app directory.
     * @returns A promise that resolves with an array of DirectoryApp objects.
     */
    public getDirectoryListing(): Promise<DirectoryApp[]> {
        const payload: Partial<DesktopAgentDirectoryListingPayload> = { type: "daDirectoryListing" };
        return this.emitWithAck<DirectoryApp[]>("daDirectoryListing", payload);
    }
}
