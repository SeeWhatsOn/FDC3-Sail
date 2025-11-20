import { describe, it, expect, vi } from "vitest"
import { SocketIOServerTransport } from "../socket-io-server-transport"
import { Server, Socket } from "socket.io"

describe("SocketIOServerTransport", () => {
  it("should route messages to correct socket based on instanceId", () => {
    const mockIo = {
      on: vi.fn(),
      sockets: {
        sockets: new Map(),
      },
    } as unknown as Server

    const mockSocket = {
      id: "socket-1",
      emit: vi.fn(),
    } as unknown as Socket

    // @ts-ignore
    mockIo.sockets.sockets.set("socket-1", mockSocket)

    const transport = new SocketIOServerTransport(mockIo)

    const message = {
      meta: {
        destination: {
          instanceId: "socket-1",
        },
      },
      payload: "test",
    }

    transport.send(message)

    expect(mockSocket.emit).toHaveBeenCalledWith("fdc3_message", message)
  })

  it("should return null for getInstanceId", () => {
    const mockIo = {
      on: vi.fn(),
    } as unknown as Server
    const transport = new SocketIOServerTransport(mockIo)
    expect(transport.getInstanceId()).toBeNull()
  })
})
