import { io, Socket } from 'socket.io-client'

export const createTestClient = (port: number): Socket => {
  return io(`http://localhost:${port}`, {
    autoConnect: false
  })
}

export const connectClient = (client: Socket): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'))
    }, 5000)
    
    client.once('connect', () => {
      clearTimeout(timeout)
      resolve()
    })
    
    client.once('connect_error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    
    client.connect()
  })
}

export const disconnectClient = (client: Socket): Promise<void> => {
  return new Promise((resolve) => {
    client.once('disconnect', () => resolve())
    client.disconnect()
  })
}

export const waitForEvent = <T = any>(
  client: Socket, 
  eventName: string, 
  timeout = 5000
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`))
    }, timeout)
    
    client.once(eventName, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}