> _**Note:** This document captures the initial analysis that led to the current architecture. For a comprehensive and up-to-date overview of the entire system, please see [**SYSTEM_ARCHITECTURE.md**](docs/SYSTEM_ARCHITECTURE.md)._

# Architecture Analysis - Proper FDC3 Desktop Agent Integration

## 🤔 **Current Problem: I'm Muddled**

You're absolutely right. Let me step back and analyze what's actually missing and how this should work properly.

---

## 📊 **Proper Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATIONS                     │
├─────────────────────────────────────────────────────────────┤
│  Sail UI Client          │  FDC3 App 1  │  FDC3 App 2      │
│  ├─ Socket.IO Client     │  ├─ FDC3 API  │  ├─ FDC3 API     │
│  ├─ SailClient SDK       │  └─ DACP      │  └─ DACP         │
│  └─ sail_event msgs      │               │                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SAIL SERVER (main.ts)                    │
├─────────────────────────────────────────────────────────────┤
│  Socket.IO Server                                          │
│  ├─ sail_event handler → SailServer API                    │
│  ├─ fdc3_event handler → FDC3 Desktop Agent                │
│  └─ Authentication & Transport                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                     │
├─────────────────────────────────────────────────────────────┤
│  @finos/sail-api                                           │
│  └─ SailServer                                             │
│     ├─ handleSailMessage() → Sail UI operations           │
│     ├─ getDirectoryApps() → Query desktop agent           │
│     ├─ getConnectedApps() → Query desktop agent           │
│     └─ getChannelMap() → Query desktop agent              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               FDC3 DESKTOP AGENT LAYER                      │
├─────────────────────────────────────────────────────────────┤
│  @finos/fdc3-sail-desktop-agent                            │
│  ├─ AppInstanceRegistry → Connected app tracking           │
│  ├─ AppDirectoryManager → App directory management         │
│  ├─ IntentRegistry → Intent resolution                     │
│  ├─ ChannelManager → Channel management                    │
│  └─ DACP Message Processing → FDC3 standard compliance     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 **What's Actually Missing**

### **1. Desktop Agent Initialization**
The `main.ts` should initialize the actual desktop agent, not use a mock:

```typescript
// ❌ CURRENT: Mock
const mockFDC3Server = { /* fake methods */ }

// ✅ NEEDED: Real desktop agent initialization
import { createDesktopAgent } from "@finos/fdc3-sail-desktop-agent"

const desktopAgent = await createDesktopAgent({
  directories: ["https://directory.example.com/apps.json"],
  channels: [...],
  port: 8080
})
```

### **2. Missing DACP Support**
The original architecture had dual protocol support (DACP + Socket.IO). Current version is missing:
- MessagePort handling for DACP
- Integration with the desktop agent's DACP processors

### **3. Missing FDC3 Message Processing**
The `handleFDC3Message` is a stub. It should:
- Route FDC3 messages to the desktop agent's message processors
- Handle DACP protocol messages
- Process FDC3 standard requests (intents, channels, contexts)

### **4. Missing Event Integration**
The desktop agent has event systems that should forward to Sail UI:
- App connection/disconnection events
- Channel change events
- Context broadcast events

---

## 🎯 **Proper Message Flow**

### **Sail UI Messages Flow:**
```
Sail UI Client
  → sail_event via Socket.IO
  → main.ts routes to SailServer.handleSailMessage()
  → SailServer queries/commands desktop agent
  → Response back to Sail UI
```

### **FDC3 App Messages Flow:**
```
FDC3 App
  → DACP message via MessagePort OR fdc3_event via Socket.IO
  → main.ts routes to desktop agent message processors
  → Desktop agent processes FDC3 standard operations
  → Events forwarded to Sail UI for visual updates
```

---

## 🔧 **What main.ts Should Actually Do**

```typescript
// 1. Initialize the FDC3 Desktop Agent
const desktopAgent = await createDesktopAgent(config)

// 2. Initialize Sail API with real desktop agent
const sailServer = new SailServer({
  fdc3ServerInstance: desktopAgent
})

// 3. Handle dual protocol
io.on("connection", (socket) => {
  // Sail protocol → Sail API
  socket.on("sail_event", (message, callback) => {
    sailServer.handleSailMessage(message, userId)
  })

  // FDC3 protocol → Desktop Agent
  socket.on("fdc3_event", (message, sourceId) => {
    desktopAgent.processMessage(message, sourceId)
  })

  // DACP protocol → Desktop Agent
  socket.on("dacp:init", (instanceId, callback) => {
    desktopAgent.initializeDACP(instanceId, callback)
  })
})
```

---

## 🤯 **Why I'm Muddled**

1. **Missing actual desktop agent initialization code**
2. **Don't have clear picture of how `@finos/fdc3-sail-desktop-agent` exports work**
3. **Missing the DACP protocol integration**
4. **Unclear on event forwarding between desktop agent and Sail UI**
5. **Haven't properly integrated the dual protocol handler logic**

---

## 💡 **What I Need to Do**

1. **Study the existing `@finos/fdc3-sail-desktop-agent` package** to understand:
   - How to create/initialize a desktop agent
   - What methods are available for integration
   - How DACP protocol works
   - What events are available

2. **Look at the original working architecture** in the existing handlers to understand:
   - How dual protocol was implemented
   - How FDC3 messages were routed
   - How events were forwarded

3. **Create proper integration code** that:
   - Initializes real desktop agent
   - Properly routes both protocols
   - Maintains the KISS principle while being complete

Should I dive deeper into the existing `@finos/fdc3-sail-desktop-agent` package and create a proper implementation based on what's actually available?