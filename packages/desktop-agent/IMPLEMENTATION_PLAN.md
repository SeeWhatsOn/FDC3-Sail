> _**Note:** This document contains the detailed implementation plan for the Desktop Agent. For a comprehensive overview of the entire system architecture and how this component fits in, please see [**SYSTEM_ARCHITECTURE.md**](../../docs/SYSTEM_ARCHITECTURE.md)._

# FDC3 Desktop Agent Implementation Plan

## Overview

This plan outlines the implementation of a fully compliant FDC3 Desktop Agent that supports the complete Desktop Agent Communication Protocol (DACP) specification. The desktop agent will manage state for app directories, applications, channels, intents, and provide transport-agnostic message handling.

**Key Goals:**
- ✅ **Complete FDC3 Compliance**: Implement all mandatory FDC3 Desktop Agent APIs
- ✅ **DACP Protocol Support**: Handle all DACP message types with proper validation
- ✅ **Transport Agnostic**: Decouple from Socket.IO, support MessagePort, WebSocket, etc.
- ✅ **Separation of Concerns**: Keep FDC3 logic separate from Sail-specific features
- ✅ **State Management**: Proper app directory, channel, and intent registry management

---

## Prerequisites

### Required Knowledge
- FDC3 2.2 specification and DACP protocol
- TypeScript/Node.js development
- Zod validation and schema generation
- MessagePort vs Socket.IO communication
- State management patterns

### Dependencies
```bash
npm install zod @finos/fdc3 @types/uuid uuid
# Note: Use official @finos/fdc3 package for standard FDC3 types
```

### Use Sail Platform Types
**✅ Import Sail-specific types from `@apps/sail-socket`:**

The sail-socket package provides Sail platform types:
- `AppRegistration` - App instance state management
- `ChannelState` - Channel information and context
- `DirectoryApp` - FDC3 app directory structure
- `InstanceID` - Unique instance identification
- `State` enum - App lifecycle states
- Official FDC3 types from `@finos/fdc3@2.2.0`

**Import instead of defining:**
```typescript
import {
  AppRegistration,
  ChannelState,
  DirectoryApp,
  InstanceID,
  State
} from '@apps/sail-socket'
```

---

## Phase 1: Core State Management & Missing Components (Week 1)

### Step 1.1: Create Missing Core State Management Components

The desktop agent needs proper state management for FDC3 entities:

**Create Core State Managers:**

```bash
mkdir -p packages/desktop-agent/src/state
mkdir -p packages/desktop-agent/src/handlers/dacp/app-management
mkdir -p packages/desktop-agent/src/handlers/dacp/private-channels
```

**Files to create:**

**File**: `packages/desktop-agent/src/state/AppInstanceRegistry.ts`
```typescript
import { AppMetadata } from '@finos/fdc3'
import { AppRegistration, InstanceID, State } from '@apps/sail-socket'

export interface AppInstance extends AppRegistration {
  title?: string
  started: Date
  metaData: AppMetadata
  messagePort?: MessagePort
  currentChannel?: string
  contextListeners: Set<string>
  intentListeners: Map<string, string[]> // intent -> listenerIds
}

export class AppInstanceRegistry {
  private instances = new Map<InstanceID, AppInstance>()

  register(instance: AppInstance): void { /* Implementation */ }
  unregister(instanceId: InstanceID): void { /* Implementation */ }
  getInstance(instanceId: InstanceID): AppInstance | undefined { /* Implementation */ }
  getInstancesByApp(appId: string): AppInstance[] { /* Implementation */ }
  getAllInstances(): AppInstance[] { /* Implementation */ }
  updateChannel(instanceId: InstanceID, channelId: string | null): void { /* Implementation */ }
  updateState(instanceId: InstanceID, state: State): void { /* Implementation */ }
}
```

**File**: `packages/desktop-agent/src/state/IntentRegistry.ts`
```typescript
import { Intent, AppMetadata } from '@finos/fdc3'
import { InstanceID, DirectoryApp } from '@apps/sail-socket'

export interface IntentHandler {
  appId: string
  instanceId?: InstanceID
  intent: string
  contexts: string[]
  metadata: AppMetadata | DirectoryApp
}

export class IntentRegistry {
  private handlers = new Map<string, IntentHandler[]>() // intent -> handlers

  registerHandler(handler: IntentHandler): void { /* Implementation */ }
  unregisterHandler(instanceId: InstanceID, intent: string): void { /* Implementation */ }
  findHandlers(intent: string, contextType?: string): IntentHandler[] { /* Implementation */ }
  getIntentsByContext(contextType: string): string[] { /* Implementation */ }
  cleanup(instanceId: InstanceID): void { /* Implementation */ }
}
```

**File**: `packages/desktop-agent/src/state/PrivateChannelRegistry.ts`
```typescript
import { PrivateChannel } from '@finos/fdc3'
import { InstanceID } from '@apps/sail-socket'

export interface PrivateChannelInstance {
  id: string
  participants: Set<InstanceID> // instanceIds
  eventListeners: Map<string, string[]> // eventType -> listenerIds
  created: Date
}

export class PrivateChannelRegistry {
  private channels = new Map<string, PrivateChannelInstance>()

  create(creatorInstanceId: InstanceID): PrivateChannelInstance { /* Implementation */ }
  addParticipant(channelId: string, instanceId: InstanceID): void { /* Implementation */ }
  removeParticipant(channelId: string, instanceId: InstanceID): void { /* Implementation */ }
  getChannel(channelId: string): PrivateChannelInstance | undefined { /* Implementation */ }
  cleanup(instanceId: InstanceID): void { /* Implementation */ }
}
```

### Step 1.2: Implement Missing DACP Message Handlers

Based on the DACP specification, we need to implement handlers for these missing message types:

**Create App Management Handlers:**

**File**: `packages/desktop-agent/src/handlers/dacp/app-management/app.handlers.ts`
```typescript
// Handle these message types:
// - getInfoRequest/getInfoResponse
// - findInstancesRequest/findInstancesResponse
// - openRequest/openResponse
// - getAppMetadataRequest/getAppMetadataResponse

export async function handleGetInfoRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Return desktop agent implementation info
}

export async function handleFindInstancesRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Find running instances of specified app
}

export async function handleOpenRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Launch application with optional context
}

export async function handleGetAppMetadataRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Get metadata for specified app
}
```

**Create Private Channel Handlers:**

**File**: `packages/desktop-agent/src/handlers/dacp/private-channels/private-channel.handlers.ts`
```typescript
// Handle these message types:
// - createPrivateChannelRequest/createPrivateChannelResponse
// - privateChannelAddEventListenerRequest/privateChannelAddEventListenerResponse
// - privateChannelDisconnectRequest/privateChannelDisconnectResponse
// - privateChannelUnsubscribeEventListenerRequest/privateChannelUnsubscribeEventListenerResponse

export async function handleCreatePrivateChannelRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Create new private channel and return PrivateChannel object
}

export async function handlePrivateChannelDisconnectRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Remove participant from private channel
}
```

**Update Intent Handlers with Missing Features:**

**File**: `packages/desktop-agent/src/handlers/dacp/intent.handlers.ts` (additions)
```typescript
// Add these missing handlers:

export async function handleFindIntentsByContextRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Find all intents that can handle given context type
}

export async function handleRaiseIntentForContextRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Raise intent using context type to resolve intent
}

export async function handleIntentResultRequest(message: unknown, context: DACPHandlerContext): Promise<void> {
  // Handle intent result from target application
}
```

**Add Event Broadcasting Support:**

**File**: `packages/desktop-agent/src/handlers/dacp/events/event.handlers.ts`
```typescript
// Handle DACP event messages:
// - contextEvent (broadcast context to listeners)
// - intentEvent (send intent to handler)
// - listenerEvent (notify about listener changes)

export function broadcastContextEvent(context: Context, channelId: string, sourceInstanceId: string): void {
  // Send contextEvent to all listeners on channel except source
}

export function sendIntentEvent(intent: string, context: Context, targetInstanceId: string): void {
  // Send intentEvent to specific application instance
}
```

### Step 1.3: Update DACP Router with Complete Handler Registry

**File**: `packages/desktop-agent/src/handlers/dacp/index.ts` (update)

Add all missing message types to the handler registry:

```typescript
function getHandlerForMessageType(messageType: string): DACPHandlerFunction | null {
  const handlerMap: Record<string, DACPHandlerFunction> = {
    // Context handlers (✅ implemented)
    'broadcastRequest': contextHandlers.handleBroadcastRequest,
    'addContextListenerRequest': contextHandlers.handleAddContextListener,
    'contextListenerUnsubscribeRequest': contextHandlers.handleContextListenerUnsubscribe,

    // Intent handlers (✅ partially implemented, ❌ need additions)
    'raiseIntentRequest': intentHandlers.handleRaiseIntentRequest,
    'addIntentListenerRequest': intentHandlers.handleAddIntentListener,
    'intentListenerUnsubscribeRequest': intentHandlers.handleIntentListenerUnsubscribe,
    'findIntentRequest': intentHandlers.handleFindIntentRequest,
    'findIntentsByContextRequest': intentHandlers.handleFindIntentsByContextRequest, // ❌ ADD
    'raiseIntentForContextRequest': intentHandlers.handleRaiseIntentForContextRequest, // ❌ ADD
    'intentResultRequest': intentHandlers.handleIntentResultRequest, // ❌ ADD

    // Channel handlers (✅ implemented)
    'getCurrentChannelRequest': channelHandlers.handleGetCurrentChannelRequest,
    'joinUserChannelRequest': channelHandlers.handleJoinUserChannelRequest,
    'leaveCurrentChannelRequest': channelHandlers.handleLeaveCurrentChannelRequest,
    'getUserChannelsRequest': channelHandlers.handleGetUserChannelsRequest,

    // App management handlers (❌ NOT IMPLEMENTED)
    'getInfoRequest': appHandlers.handleGetInfoRequest,
    'findInstancesRequest': appHandlers.handleFindInstancesRequest,
    'openRequest': appHandlers.handleOpenRequest,
    'getAppMetadataRequest': appHandlers.handleGetAppMetadataRequest,

    // Private channel handlers (❌ NOT IMPLEMENTED)
    'createPrivateChannelRequest': privateChannelHandlers.handleCreatePrivateChannelRequest,
    'privateChannelAddEventListenerRequest': privateChannelHandlers.handlePrivateChannelAddEventListener,
    'privateChannelDisconnectRequest': privateChannelHandlers.handlePrivateChannelDisconnectRequest,
    'privateChannelUnsubscribeEventListenerRequest': privateChannelHandlers.handlePrivateChannelUnsubscribeEventListener,

    // Additional context handlers
    'getCurrentContextRequest': contextHandlers.handleGetCurrentContextRequest, // ❌ ADD
    'getOrCreateChannelRequest': channelHandlers.handleGetOrCreateChannelRequest, // ❌ ADD

    // Event listener management
    'addEventListenerRequest': eventHandlers.handleAddEventListenerRequest, // ❌ ADD
    'eventListenerUnsubscribeRequest': eventHandlers.handleEventListenerUnsubscribeRequest, // ❌ ADD

    // Heartbeat (for connection health)
    'heartbeatAcknowledgmentRequest': heartbeatHandlers.handleHeartbeatAcknowledgmentRequest, // ❌ ADD
  }

  return handlerMap[messageType] || null
}
```

### Step 1.4: Integration with Existing SailAppInstanceManager

The desktop agent integrates with the existing `SailAppInstanceManager` which already provides key methods:

**Available Integration Points:**
```typescript
// From SailAppInstanceManager class:
async open(appId: string): Promise<InstanceID>                    // ✅ For openRequest handler
async getAllApps(): Promise<AppRegistration[]>                    // ✅ For findInstancesRequest handler
async isAppConnected(instanceId: InstanceID): Promise<boolean>    // ✅ For instance checking
async setAppState(instanceId: InstanceID, state: State): Promise<void> // ✅ For lifecycle management
public readonly directory: AppDirectoryManager                   // ✅ For app metadata access
```

**Context Structure:**
```typescript
export interface DACPHandlerContext {
  messagePort: MessagePort
  serverContext: SailAppInstanceManager  // ✅ Existing integration point
  fdc3Server: {
    appInstanceRegistry: AppInstanceRegistry     // ❌ Need to implement
    intentRegistry: IntentRegistry              // ❌ Need to implement
    privateChannelRegistry: PrivateChannelRegistry // ❌ Need to implement
    directory: AppDirectoryManager              // ✅ From serverContext.directory
  }
  connectionState: {
    authenticated: boolean
    userId: string
    socketType: string | undefined
  }
  instanceId: InstanceID  // ✅ From connection context
}
```

This integration ensures the desktop agent leverages existing functionality while adding the missing FDC3 state management layer.

---

## Phase 2: Complete Missing Handler Implementations (Week 2)

### Step 2.1: Implement App Management Handlers

**Priority: HIGH** - These are mandatory FDC3 features currently missing.

**File**: `packages/desktop-agent/src/handlers/dacp/app-management/app.handlers.ts`

```typescript
import { validateDACPMessage, createDACPSuccessResponse, createDACPErrorResponse } from '../../validation/dacp-validator'
import {
  GetinforequestSchema,
  FindinstancesrequestSchema,
  OpenrequestSchema,
  GetappmetadatarequestSchema
} from '../../validation/dacp-schemas'
import { DACPHandlerContext } from '../../types'

export async function handleGetInfoRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  try {
    const request = validateDACPMessage(message, GetinforequestSchema)

    // Return desktop agent implementation metadata
    const implementationMetadata = {
      fdc3Version: '2.2',
      provider: 'SAIL',
      providerVersion: '1.0.0',
      optionalFeatures: {
        OriginatingAppMetadata: true,
        UserChannelMembershipAPIs: true,
        PrivateChannels: true
      }
    }

    const response = createDACPSuccessResponse(request, 'getInfoResponse', implementationMetadata)
    context.messagePort.postMessage(response)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(message as any, 'AgentError', 'getInfoResponse')
    context.messagePort.postMessage(errorResponse)
  }
}

export async function handleFindInstancesRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  try {
    const request = validateDACPMessage(message, FindinstancesrequestSchema)
    const { app } = request.payload

    // Use AppInstanceRegistry to find running instances
    const instances = context.fdc3Server.appInstanceRegistry.getInstancesByApp(app.appId)

    const instanceIdentifiers = instances.map(instance => ({
      appId: instance.appId,
      instanceId: instance.instanceId,
      title: instance.title
    }))

    const response = createDACPSuccessResponse(request, 'findInstancesResponse', { instances: instanceIdentifiers })
    context.messagePort.postMessage(response)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(message as any, 'AppNotFound', 'findInstancesResponse')
    context.messagePort.postMessage(errorResponse)
  }
}

export async function handleOpenRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  try {
    const request = validateDACPMessage(message, OpenrequestSchema)
    const { app, context: appContext } = request.payload

    // Launch application using app directory
    const appMetadata = await context.fdc3Server.directory.getAppById(app.appId)
    if (!appMetadata) {
      throw new Error(`App ${app.appId} not found in directory`)
    }

    // Delegate to SailAppInstanceManager for actual app launching
    const instanceId = await context.serverContext.open(app.appId)

    const response = createDACPSuccessResponse(request, 'openResponse', {
      appIdentifier: { appId: app.appId, instanceId }
    })
    context.messagePort.postMessage(response)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(message as any, 'AppNotFound', 'openResponse')
    context.messagePort.postMessage(errorResponse)
  }
}
```

### Step 2.2: Implement Private Channel Handlers

**File**: `packages/desktop-agent/src/handlers/dacp/private-channels/private-channel.handlers.ts`

```typescript
import { validateDACPMessage, createDACPSuccessResponse, createDACPErrorResponse } from '../../validation/dacp-validator'
import {
  CreateprivatechannelrequestSchema,
  PrivatechanneldisconnectrequestSchema
} from '../../validation/dacp-schemas'
import { DACPHandlerContext } from '../../types'

export async function handleCreatePrivateChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  try {
    const request = validateDACPMessage(message, CreateprivatechannelrequestSchema)

    // Create private channel using PrivateChannelRegistry
    const channelInstance = context.fdc3Server.privateChannelRegistry.create(context.instanceId)

    // Return private channel object
    const privateChannel = {
      id: channelInstance.id,
      type: 'private',
      displayMetadata: {
        name: `Private Channel ${channelInstance.id}`,
        color: 'blue'
      }
    }

    const response = createDACPSuccessResponse(request, 'createPrivateChannelResponse', { channel: privateChannel })
    context.messagePort.postMessage(response)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(message as any, 'CreationFailed', 'createPrivateChannelResponse')
    context.messagePort.postMessage(errorResponse)
  }
}

export async function handlePrivateChannelDisconnectRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  try {
    const request = validateDACPMessage(message, PrivatechanneldisconnectrequestSchema)
    const { channelId } = request.payload

    // Remove participant from private channel
    context.fdc3Server.privateChannelRegistry.removeParticipant(channelId, context.instanceId)

    const response = createDACPSuccessResponse(request, 'privateChannelDisconnectResponse', {})
    context.messagePort.postMessage(response)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(message as any, 'ChannelError', 'privateChannelDisconnectResponse')
    context.messagePort.postMessage(errorResponse)
  }
}
```

---

## Phase 3: Sail-Specific Service Separation (Week 3)

### Step 3.1: Move Sail Services to @apps/sail-socket

**The Goal**: Move all Sail-specific functionality out of the desktop-agent package into sail-socket's sail-services.

**Create Sail Service Structure:**

```bash
mkdir -p apps/sail-socket/src/sail-services/auth
mkdir -p apps/sail-socket/src/sail-services/config
mkdir -p apps/sail-socket/src/sail-services/layouts
mkdir -p apps/sail-socket/src/sail-services/workspaces
mkdir -p apps/sail-socket/src/sail-services/logging
mkdir -p apps/sail-socket/src/sail-services/entitlements
```

**File**: `apps/sail-socket/src/sail-services/auth/auth.handlers.ts`
```typescript
import { Socket } from 'socket.io'
import { SailHandlerContext } from '../types'

export function handleSailAuth(
  authData: unknown,
  callback: (success: boolean, message?: string) => void,
  context: SailHandlerContext
): void {
  // Sail-specific authentication logic
  // NOT FDC3 related - purely Sail platform functionality
}

export function handleSailLogin(
  loginData: unknown,
  callback: (success: boolean, token?: string) => void,
  context: SailHandlerContext
): void {
  // Sail login system
}

export function registerSailAuthHandlers(socket: Socket, context: SailHandlerContext) {
  socket.on('sail-auth', (data, callback) => handleSailAuth(data, callback, context))
  socket.on('sail-login', (data, callback) => handleSailLogin(data, callback, context))
}
```

**File**: `apps/sail-socket/src/sail-services/layouts/layout.handlers.ts`
```typescript
import { Socket } from 'socket.io'
import { SailHandlerContext } from '../types'

export function handleSailLayoutChange(
  layoutData: unknown,
  callback: (success: boolean) => void,
  context: SailHandlerContext
): void {
  // Sail workspace layout management
  // NOT FDC3 - purely Sail UI functionality
}

export function handleSailWorkspaceUpdate(
  workspaceData: unknown,
  callback: (success: boolean) => void,
  context: SailHandlerContext
): void {
  // Sail workspace configuration
}

export function registerSailLayoutHandlers(socket: Socket, context: SailHandlerContext) {
  socket.on('sail-layout-change', (data, callback) => handleSailLayoutChange(data, callback, context))
  socket.on('sail-workspace-update', (data, callback) => handleSailWorkspaceUpdate(data, callback, context))
}
```

### Step 3.2: Update sail-socket Main Entry Point

**File**: `apps/sail-socket/src/main.ts` (update)

```typescript
import { Server } from "socket.io"
import { createServer } from "http"
import { initSocketService } from "@finos/fdc3-sail-desktop-agent"
import { initSailServices } from "./sail-services"
import { APP_CONFIG } from "./constants"
import { authMiddleware } from "./middleware/auth"
import dotenv from "dotenv"

dotenv.config()

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

io.use(authMiddleware)

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT

httpServer.listen(port, () => {
  console.log(`🚀 SAIL Socket Server is listening on port ${port}`)
  console.log(`📋 Initializing FDC3 Desktop Agent...`)
  console.log(`🎨 Initializing Sail Platform Services...`)
})

// Initialize FDC3 Desktop Agent (transport-agnostic)
initSocketService(io)

// Initialize Sail-specific services (Socket.IO based)
initSailServices(io)

console.log(`✅ SAIL Platform ready with FDC3 Desktop Agent`)
```

---

## Phase 4: Testing & Compliance Verification (Week 4)

### Step 4.1: FDC3 Compliance Test Suite

**File**: `packages/desktop-agent/src/__tests__/fdc3-compliance.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { registerDACPHandlers } from '../handlers/dacp'

describe('FDC3 Compliance Test Suite', () => {
  // Test all mandatory FDC3 APIs are implemented
  const mandatoryAPIs = [
    'getInfoRequest',
    'broadcastRequest',
    'addContextListenerRequest',
    'getCurrentChannelRequest',
    'joinUserChannelRequest',
    'getUserChannelsRequest',
    'raiseIntentRequest',
    'findIntentRequest',
    'addIntentListenerRequest',
    'openRequest',
    'findInstancesRequest',
    'createPrivateChannelRequest'
  ]

  it('should support all mandatory FDC3 message types', () => {
    const stats = getDACPHandlerStats()

    mandatoryAPIs.forEach(api => {
      expect(stats.supportedMessageTypes).toContain(api)
    })
  })

  it('should handle getInfo request correctly', async () => {
    // Test implementation info response
  })

  it('should handle intent resolution flow', async () => {
    // Test complete intent workflow
  })

  it('should handle private channel lifecycle', async () => {
    // Test private channel creation, usage, cleanup
  })
})
```

### Step 4.2: Performance & Load Testing

**File**: `packages/desktop-agent/src/__tests__/dacp-performance.test.ts`

```typescript
describe('DACP Performance Tests', () => {
  it('should handle 1000 concurrent broadcast requests', async () => {
    // Test message throughput
  })

  it('should maintain <100ms response time for intent resolution', async () => {
    // Test response times
  })

  it('should handle 100 apps with 10 listeners each', async () => {
    // Test scale limits
  })
})
```

---

## Success Criteria & Verification

**✅ Complete FDC3 Compliance Checklist:**

**Mandatory Desktop Agent APIs:**
- [ ] `getInfo()` - Returns implementation metadata
- [ ] `open()` - Launch applications
- [ ] `findInstances()` - Find running app instances
- [ ] `getAppMetadata()` - Get app metadata from directory

**Context Management:**
- [ ] `broadcast()` - Broadcast context to channel
- [ ] `addContextListener()` - Listen for context on channels
- [ ] `getCurrentContext()` - Get current context for channel

**Channel Management:**
- [ ] `getCurrentChannel()` - Get current user channel
- [ ] `joinUserChannel()` - Join user channel
- [ ] `leaveCurrentChannel()` - Leave current channel
- [ ] `getUserChannels()` - Get available user channels
- [ ] `getOrCreateChannel()` - Get or create app channel

**Intent Management:**
- [ ] `raiseIntent()` - Raise intent with optional target
- [ ] `raiseIntentForContext()` - Raise intent by context type
- [ ] `addIntentListener()` - Listen for specific intents
- [ ] `findIntent()` - Find handlers for intent
- [ ] `findIntentsByContext()` - Find intents for context type

**Private Channels:**
- [ ] `createPrivateChannel()` - Create private channel
- [ ] Private channel event listeners
- [ ] Private channel disconnect handling

**State Management:**
- [ ] App Instance Registry with lifecycle management
- [ ] Intent Registry with handler registration
- [ ] Private Channel Registry with participant tracking
- [ ] Channel membership tracking
- [ ] Context listener management

**DACP Protocol:**
- [ ] All request/response message types supported
- [ ] Event message broadcasting (contextEvent, intentEvent)
- [ ] Proper error handling with standard error types
- [ ] Timeout handling (10s default, 100s app launch)
- [ ] Message validation with Zod schemas

**Separation of Concerns:**
- [ ] FDC3 logic isolated in @packages/desktop-agent
- [ ] Sail services isolated in @apps/sail-socket/sail-services
- [ ] Transport-agnostic DACP handling
- [ ] Clear API boundaries between FDC3 and Sail features

This updated plan focuses on implementing the **complete FDC3 specification** rather than just basic DACP compliance, ensures proper **state management** for all FDC3 entities, and maintains **clear separation** between FDC3 standard functionality and Sail-specific features.