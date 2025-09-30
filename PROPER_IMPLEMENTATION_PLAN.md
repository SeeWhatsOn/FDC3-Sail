# Proper FDC3 Desktop Agent Integration Plan

## 🔍 **Analysis Complete - Now I Understand**

After analyzing the `@finos/fdc3-sail-desktop-agent` package, I now understand how it actually works:

### **Key Insights:**
1. **No single "DesktopAgent" class** - it's a collection of components
2. **Singleton registries** - `appInstanceRegistry` and `intentRegistry` are global singletons
3. **DACP handlers** - `processDACPMessage()` and `registerDACPHandlers()` for FDC3 messages
4. **Transport-agnostic** - Can handle both MessagePort (DACP) and Socket.IO

---

## 🏗️ **Proper Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    SAIL SERVER                          │
│  (apps/sail-server/src/main.ts)                        │
├─────────────────────────────────────────────────────────┤
│  Socket.IO Server                                      │
│  ├─ Authentication & Transport                         │
│  ├─ sail_event → SailServer API                       │
│  ├─ fdc3_event → DACP processors                      │
│  └─ dacp:init → MessagePort setup                     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│               BUSINESS LOGIC LAYER                      │
│  (@finos/sail-api)                                     │
├─────────────────────────────────────────────────────────┤
│  SailServer                                            │
│  ├─ handleSailMessage() → Route Sail UI messages      │
│  ├─ getDirectoryApps() → Query directoryManager       │
│  ├─ getConnectedApps() → Query appInstanceRegistry    │
│  └─ getChannelMap() → Query appInstanceRegistry       │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│          FDC3 DESKTOP AGENT COMPONENTS                  │
│  (@finos/fdc3-sail-desktop-agent)                     │
├─────────────────────────────────────────────────────────┤
│  Singleton Registries:                                │
│  ├─ appInstanceRegistry (global)                      │
│  ├─ intentRegistry (global)                           │
│  └─ directoryManager (needs initialization)           │
│                                                        │
│  Message Processors:                                  │
│  ├─ processDACPMessage() → Process FDC3 messages     │
│  ├─ registerDACPHandlers() → MessagePort setup      │
│  └─ DACP handlers (context, intent, channel)         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 **What main.ts Should Actually Do**

```typescript
import { Server } from "socket.io"
import {
  appInstanceRegistry,
  intentRegistry,
  AppDirectoryManager,
  registerDACPHandlers,
  processDACPMessage
} from "@finos/fdc3-sail-desktop-agent"
import { SailServer } from "@finos/sail-api"

// 1. Initialize directory manager (not singleton)
const appDirectoryManager = new AppDirectoryManager()
await appDirectoryManager.replace([
  "https://directory.example.com/apps.json"
])

// 2. Create server context for DACP handlers
const serverContext = {
  appInstanceRegistry,      // Global singleton
  intentRegistry,          // Global singleton
  directoryManager: appDirectoryManager,
  getTabs: () => [/* channel definitions */],
  // ... other methods
}

// 3. Create Sail server that queries the registries
const sailServer = new SailServer({
  appInstanceRegistry,      // Direct access to singleton
  directoryManager: appDirectoryManager,
  serverContext
})

// 4. Handle dual protocol
io.on("connection", (socket) => {

  // Sail UI messages → Sail API
  socket.on("sail_event", async (message, callback) => {
    const result = await sailServer.handleSailMessage(message, userId)
    callback(result)
  })

  // FDC3 messages via Socket.IO → DACP processors
  socket.on("fdc3_event", async (dacpMessage, sourceId) => {
    await processDACPMessage(dacpMessage, {
      instanceId: sourceId,
      serverContext,
      fdc3Server: null, // Not needed for new model
      appInstanceRegistry,
      intentRegistry
    }, (response) => {
      socket.emit("fdc3_event", response)
    })
  })

  // FDC3 messages via MessagePort → DACP processors
  socket.on("dacp:init", (instanceId, callback) => {
    const channel = new MessageChannel()

    registerDACPHandlers(channel.port1, serverContext, null, instanceId)

    callback(channel.port2)
  })
})
```

---

## 🎯 **SailServer Should Query Registries Directly**

```typescript
// packages/sail-api/src/server/SailServer.ts
import {
  type AppInstanceRegistry,
  type AppDirectoryManager,
  AppInstanceState
} from "@finos/fdc3-sail-desktop-agent"

export class SailServer {
  constructor(private components: {
    appInstanceRegistry: AppInstanceRegistry
    directoryManager: AppDirectoryManager
    serverContext: any
  }) {}

  getDirectoryApps() {
    return {
      apps: this.components.directoryManager.allApps
    }
  }

  getConnectedApps() {
    const instances = this.components.appInstanceRegistry.queryInstances({
      state: [AppInstanceState.CONNECTED, AppInstanceState.PENDING]
    })
    return { apps: instances }
  }

  getChannelMap(): Record<string, string[]> {
    // Query registry directly for channel mappings
    const channelMap: Record<string, string[]> = {}
    const allApps = this.getConnectedApps().apps

    allApps.forEach(app => {
      if (app.currentChannel) {
        if (!channelMap[app.currentChannel]) {
          channelMap[app.currentChannel] = []
        }
        channelMap[app.currentChannel].push(app.instanceId)
      }
    })

    return channelMap
  }

  async handleFDC3Message(message: any, sourceId: string): Promise<void> {
    // Use the transport-agnostic DACP processor
    await processDACPMessage(message, {
      instanceId: sourceId,
      serverContext: this.components.serverContext,
      fdc3Server: null,
      appInstanceRegistry: this.components.appInstanceRegistry,
      intentRegistry: this.components.intentRegistry
    }, (response) => {
      // Response handling - this would need to be passed in
      console.log("FDC3 response:", response)
    })
  }
}
```

---

## ✅ **Complete Implementation Checklist**

### **Phase 1: Core Integration**
- [ ] Update main.ts to initialize AppDirectoryManager
- [ ] Update main.ts to use singleton registries directly
- [ ] Update SailServer to accept registry components
- [ ] Add proper DACP message processing via processDACPMessage()

### **Phase 2: Dual Protocol Support**
- [ ] Add fdc3_event Socket.IO handler
- [ ] Add dacp:init MessagePort handler
- [ ] Integrate registerDACPHandlers for MessagePort connections
- [ ] Add proper response handling for FDC3 messages

### **Phase 3: Event Integration**
- [ ] Forward registry events to Sail UI
- [ ] Add real-time app connection/disconnection events
- [ ] Add real-time channel change events

---

## 🚀 **Why This Approach Works**

1. **Uses actual desktop-agent components** - No mocks or abstractions
2. **Leverages singleton registries** - Central state management
3. **Supports dual protocol** - Both DACP and Socket.IO for FDC3 messages
4. **Maintains KISS principle** - Direct usage of existing components
5. **Proper separation** - Transport vs business logic vs FDC3 processing

This is the **real integration** that uses the actual desktop-agent components properly!