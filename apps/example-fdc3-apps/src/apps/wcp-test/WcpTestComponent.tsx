import { useEffect, useState } from "react"
import { getAgent } from "@finos/fdc3-get-agent"
import { type DesktopAgent, type Listener, type Context } from "@finos/fdc3"
import { createRoot } from "react-dom/client"

import styles from "./wcp-test.module.css"

interface WcpMessage {
  id: string
  type: "send" | "receive"
  timestamp: Date
  payload: any
  success: boolean
  error?: string
}

export const WcpTestComponent = () => {
  const [fdc3, setFdc3] = useState<DesktopAgent | null>(null)
  const [currentChannel, setCurrentChannel] = useState<string | null>(null)
  const [messages, setMessages] = useState<WcpMessage[]>([])
  const [listener, setListener] = useState<Promise<Listener> | null>(null)
  const [testMessage, setTestMessage] = useState("")
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    console.log("WCP Test Component: Starting...")
    getAgent()
      .then(agent => {
        console.log("WCP Test Component: Got FDC3 agent")
        setFdc3(agent)
        setIsConnected(true)
        handleChannelChanged(agent)
        agent.addEventListener("userChannelChanged", () => handleChannelChanged(agent))

        addMessage({
          id: generateId(),
          type: "receive",
          timestamp: new Date(),
          payload: { message: "FDC3 Agent Connected" },
          success: true,
        })
      })
      .catch(error => {
        console.error("WCP Test Component: Failed to get FDC3 agent", error)
        setIsConnected(false)
        addMessage({
          id: generateId(),
          type: "receive",
          timestamp: new Date(),
          payload: { message: "Failed to connect to FDC3 Agent" },
          success: false,
          error: error.message,
        })
      })
  }, [])

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const addMessage = (message: WcpMessage) => {
    setMessages(prev => [...prev, message])
    console.log("WCP Test Component: Message logged", message)
  }

  const handleChannelChanged = async (fdc3: DesktopAgent) => {
    try {
      const channel = await fdc3.getCurrentChannel()
      console.log("WCP Test Component: Channel changed to", channel?.id || "none")
      setCurrentChannel(channel?.id || null)

      if (listener) {
        const listenerInstance = await listener
        listenerInstance.unsubscribe()
        setListener(null)
      }

      if (channel) {
        const newListener = fdc3.addContextListener(null, (context: Context) => {
          console.log("WCP Test Component: Context received", context)
          addMessage({
            id: generateId(),
            type: "receive",
            timestamp: new Date(),
            payload: context,
            success: true,
          })
        })
        setListener(newListener)
      }
    } catch (error) {
      console.error("WCP Test Component: Error handling channel change", error)
      addMessage({
        id: generateId(),
        type: "receive",
        timestamp: new Date(),
        payload: { message: "Channel change error" },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const sendTestMessage = async () => {
    if (!fdc3 || !testMessage.trim()) return

    try {
      const context: Context = {
        type: "fdc3.wcp-test",
        id: {
          message: testMessage,
          timestamp: new Date().toISOString(),
          sender: "wcp-test-component",
        },
      }

      const channel = await fdc3.getCurrentChannel()
      if (channel) {
        await channel.broadcast(context)
        console.log("WCP Test Component: Message sent", context)
        addMessage({
          id: generateId(),
          type: "send",
          timestamp: new Date(),
          payload: context,
          success: true,
        })
        setTestMessage("")
      } else {
        throw new Error("No active channel")
      }
    } catch (error) {
      console.error("WCP Test Component: Error sending message", error)
      addMessage({
        id: generateId(),
        type: "send",
        timestamp: new Date(),
        payload: { message: testMessage },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const sendWcpHandshake = async () => {
    if (!fdc3) return

    try {
      const handshakeContext: Context = {
        type: "fdc3.wcp-handshake",
        id: {
          requestId: generateId(),
          timestamp: new Date().toISOString(),
          version: "2.0",
        },
      }

      const channel = await fdc3.getCurrentChannel()
      if (channel) {
        await channel.broadcast(handshakeContext)
        console.log("WCP Test Component: Handshake sent", handshakeContext)
        addMessage({
          id: generateId(),
          type: "send",
          timestamp: new Date(),
          payload: handshakeContext,
          success: true,
        })
      }
    } catch (error) {
      console.error("WCP Test Component: Error sending handshake", error)
      addMessage({
        id: generateId(),
        type: "send",
        timestamp: new Date(),
        payload: { message: "WCP Handshake" },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const clearMessages = () => {
    setMessages([])
    console.log("WCP Test Component: Messages cleared")
  }

  return (
    <div className={styles.wcpTestComponent}>
      <h2>FDC3 WCP Test Component</h2>

      <div className={styles.statusSection}>
        <div className={styles.connectionStatus}>
          Status:{" "}
          <span className={isConnected ? styles.connected : styles.disconnected}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className={styles.channelInfo}>
          Current Channel: <span className={styles.channelName}>{currentChannel || "None"}</span>
        </div>
      </div>

      <div className={styles.controlsSection}>
        <div className={styles.messageInput}>
          <input
            type="text"
            value={testMessage}
            onChange={e => setTestMessage(e.target.value)}
            placeholder="Enter test message..."
            className={styles.input}
          />
          <button onClick={sendTestMessage} disabled={!fdc3 || !testMessage.trim()}>
            Send Message
          </button>
        </div>

        <div className={styles.buttons}>
          <button onClick={sendWcpHandshake} disabled={!fdc3}>
            Send WCP Handshake
          </button>
          <button onClick={clearMessages}>Clear Messages</button>
        </div>
      </div>

      <div className={styles.messagesSection}>
        <h3>Message Log ({messages.length})</h3>
        <div className={styles.messageList}>
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`${styles.message} ${styles[msg.type]} ${msg.success ? styles.success : styles.error}`}
            >
              <div className={styles.messageHeader}>
                <span className={styles.messageType}>{msg.type.toUpperCase()}</span>
                <span className={styles.timestamp}>{msg.timestamp.toLocaleTimeString()}</span>
                <span className={styles.status}>{msg.success ? "✓" : "✗"}</span>
              </div>
              <div className={styles.messagePayload}>{JSON.stringify(msg.payload, null, 2)}</div>
              {msg.error && <div className={styles.messageError}>Error: {msg.error}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const container = document.getElementById("app")
const root = createRoot(container!)

root.render(<WcpTestComponent />)
