import { createServer } from "http"
import { Server as SocketServer } from "socket.io"
import getPort from "get-port"
import { initSocketService } from "@finos/fdc3-sail-socket/src/desktop-agent/initSocketService"
import { SailFDC3Server } from "@finos/fdc3-sail-socket/src/desktop-agent/SailFDC3Server"

export const createTestServer = async () => {
  const httpServer = createServer()
  const io = new SocketServer(httpServer, {
    cors: { origin: "*" },
  })

  // Create sessions map (same as real server)
  const sessions = new Map<string, SailFDC3Server>()

  // Use the actual server socket setup
  initSocketService(io, sessions)

  const port = await getPort()

  return new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    httpServer.listen(port, (err?: Error) => {
      if (err) {
        reject(err)
      } else {
        console.log(`Test server started on port ${port}`)
        resolve({
          port,
          close: () =>
            new Promise(resolveClose => {
              httpServer.close(() => {
                console.log(`Test server on port ${port} closed`)
                resolveClose()
              })
            }),
        })
      }
    })
  })
}
