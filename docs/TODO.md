# TODO: Transport Architecture Refactoring

This document tracks the implementation tasks for the transport architecture refactoring. For detailed implementation guidance, see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Status Legend

- ✅ **Completed**
- 🚧 **In Progress**
- ⏳ **Pending**
- ❌ **Blocked**

---

## Phase 1: Core Transport Changes (Breaking Changes)

### Task 1.1: Update Transport Interface ✅
**Status**: ✅ Completed

**Files**:
- `packages/desktop-agent/src/interfaces/transport.ts`

**Changes Made**:
- Removed `instanceId` parameter from `send()` method
- Removed `getInstanceId()` and `setInstanceId()` methods
- Updated documentation to reflect "one transport per Desktop Agent"

---

### Task 1.2: Update/Create MockTransport
**Status**: ⏳ Pending

**Files**:
- `packages/desktop-agent/src/__tests__/utils/mock-transport.ts`

**Requirements**:
- Update mock transport to match new interface
- Remove `instanceId` tracking
- Add test helpers for message inspection

**Implementation Checklist**:
- [ ] Verify file exists or create it
- [ ] Implement `send(message: unknown)` signature
- [ ] Remove `getInstanceId()` and `setInstanceId()` methods
- [ ] Add `simulateReceive()` test helper
- [ ] Add `simulateDisconnect()` test helper
- [ ] Add `getSent()` and `getLastSent()` helpers
- [ ] Add `clearSent()` helper

---

### Task 1.3: Update Desktop Agent Constructor
**Status**: ⏳ Pending

**Files**:
- `packages/desktop-agent/src/desktop-agent.ts`

**Requirements**:
- Accept single `Transport` in constructor
- Remove any per-app transport tracking
- Update message sending to use `transport.send(message)` without instanceId parameter
- Add `sendToInstance()` helper that adds destination metadata

**Implementation Checklist**:
- [ ] Update constructor signature to accept `Transport`
- [ ] Register transport message handler in constructor
- [ ] Register transport disconnect handler in constructor
- [ ] Implement `handleIncomingMessage()` method
- [ ] Implement `handleTransportDisconnect()` method
- [ ] Implement `sendToInstance()` helper method
- [ ] Remove any per-app transport storage

---

### Task 1.4: Update DACP Handlers
**Status**: ⏳ Pending

**Files**:
- `packages/desktop-agent/src/handlers/dacp/context.handlers.ts`
- `packages/desktop-agent/src/handlers/dacp/intent.handlers.ts`
- `packages/desktop-agent/src/handlers/dacp/channel.handlers.ts`
- `packages/desktop-agent/src/handlers/dacp/app-management/app.handlers.ts`
- All other DACP handler files

**Requirements**:
- Update all handlers to receive `transport` in context
- Update handlers to call `transport.send(message)` instead of `transport.send(instanceId, message)`
- Ensure all outgoing messages have `meta.destination.instanceId` set

**Implementation Checklist**:
- [ ] Update HandlerContext type to include transport
- [ ] Update broadcastHandler
- [ ] Update addContextListenerHandler
- [ ] Update raiseIntentHandler
- [ ] Update addIntentListenerHandler
- [ ] Update joinUserChannelHandler
- [ ] Update getCurrentChannelHandler
- [ ] Update getUserChannelsHandler
- [ ] Update getAppMetadataHandler
- [ ] Update findIntentHandler
- [ ] Update findIntentsByContextHandler
- [ ] Update all other handlers

---

### Task 1.5: Remove Transport from AppInstanceRegistry
**Status**: ⏳ Pending

**Files**:
- `packages/desktop-agent/src/state/app-instance-registry.ts`

**Requirements**:
- Remove `transport` field from app instance records
- Remove `setTransport()` and `getTransport()` methods
- Simplify to just track app metadata and state

**Implementation Checklist**:
- [ ] Update AppInstance interface to remove transport
- [ ] Remove setTransport() method
- [ ] Remove getTransport() method
- [ ] Update register() method signature
- [ ] Update all tests

---

## Phase 2: Create ConnectionManager (New Component)

### Task 2.1: Create ConnectionManager Class
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/browser/connection-manager.ts` (NEW)

**Requirements**:
- Combine WCP Gateway + Browser Proxy functionality
- Handle WCP1-3 handshake
- Manage MessagePort registry
- Route messages between apps and Desktop Agent

**Implementation Checklist**:
- [ ] Create ConnectionManager class
- [ ] Implement constructor(transport, options)
- [ ] Implement handleWCP1Hello()
- [ ] Implement registerPort()
- [ ] Implement routeToApp()
- [ ] Implement sendToDesktopAgent()
- [ ] Add EventEmitter for connection events
- [ ] Add error handling
- [ ] Add TypeScript types/interfaces

---

### Task 2.2: Move WCP Handling from use-fdc3-connection Hook
**Status**: ⏳ Pending

**Files**:
- `apps/sail/src/hooks/use-fdc3-connection.ts` (REFACTOR)

**Requirements**:
- Extract WCP handshake logic to ConnectionManager
- Update hook to instantiate and use ConnectionManager
- Remove manual MessagePort tracking from hook

**Implementation Checklist**:
- [ ] Refactor hook to use ConnectionManager
- [ ] Remove manual WCP message handling
- [ ] Remove manual MessagePort tracking
- [ ] Remove link() function (now in ConnectionManager)
- [ ] Update tests

---

### Task 2.3: Create Factory Functions
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/factory.ts` (NEW)

**Requirements**:
- Create `createBrowserDesktopAgent()` factory
- Support browser, server, and worker modes
- Bundle Desktop Agent + ConnectionManager together

**Implementation Checklist**:
- [ ] Create BrowserDesktopAgentConfig interface
- [ ] Implement createBrowserDesktopAgent() function
- [ ] Add browser mode support
- [ ] Add server mode support
- [ ] Add worker mode support
- [ ] Add configuration validation
- [ ] Export from sail-api index

---

## Phase 3: Update Transport Implementations

### Task 3.1: Create/Update SocketIOTransport
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/transports/socket-io-transport.ts`

**Requirements**:
- Implement Transport interface for Socket.IO client
- Handle message send/receive via Socket.IO events
- Handle disconnect events

**Implementation Checklist**:
- [ ] Create SocketIOTransport class
- [ ] Implement send(message) method
- [ ] Implement onMessage() method
- [ ] Implement onDisconnect() method
- [ ] Implement isConnected() method
- [ ] Implement disconnect() method
- [ ] Add error handling
- [ ] Add tests

---

### Task 3.2: Create/Update MessagePortTransport
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/transports/message-port-transport.ts`

**Requirements**:
- Implement Transport interface for MessagePort
- Handle message send/receive via MessagePort
- Handle port closure

**Implementation Checklist**:
- [ ] Create MessagePortTransport class
- [ ] Implement send(message) method
- [ ] Implement onMessage() method
- [ ] Implement onDisconnect() method
- [ ] Implement isConnected() method
- [ ] Implement disconnect() method
- [ ] Add error handling
- [ ] Add tests

---

### Task 3.3: Create InMemoryTransport
**Status**: ⏳ Pending

**Files**:
- `packages/desktop-agent/src/transports/in-memory-transport.ts` (NEW)

**Requirements**:
- Implement Transport interface for same-process communication
- Create helper for linked transport pairs
- Support synchronous message delivery

**Implementation Checklist**:
- [ ] Create InMemoryTransport class
- [ ] Implement send(message) method
- [ ] Implement onMessage() method
- [ ] Implement onDisconnect() method
- [ ] Implement isConnected() method
- [ ] Implement disconnect() method
- [ ] Implement setPeer() method
- [ ] Create createInMemoryTransportPair() helper
- [ ] Add tests

---

## Phase 4: Update Server-Side Code

### Task 4.1: Update sail-server
**Status**: ⏳ Pending

**Files**:
- `apps/sail-server/src/main.ts`

**Requirements**:
- Create transport per Socket.IO connection
- Pass transport to Desktop Agent
- Remove per-app connection logic

**Implementation Checklist**:
- [ ] Update Socket.IO connection handler
- [ ] Create SocketIOServerTransport per connection
- [ ] Create Desktop Agent with transport
- [ ] Remove old per-app logic
- [ ] Update disconnect handling
- [ ] Test with multiple connections

---

### Task 4.2: Create SocketIOServerTransport
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/server/socket-io-server-transport.ts` (NEW)

**Requirements**:
- Implement Transport interface for Socket.IO server
- Handle message send/receive via Socket.IO socket
- Handle socket disconnect events

**Implementation Checklist**:
- [ ] Create SocketIOServerTransport class
- [ ] Implement send(message) method
- [ ] Implement onMessage() method
- [ ] Implement onDisconnect() method
- [ ] Implement isConnected() method
- [ ] Implement disconnect() method
- [ ] Add error handling
- [ ] Add tests

---

## Phase 5: Update Sail UI

### Task 5.1: Refactor use-fdc3-connection Hook
**Status**: ⏳ Pending (Partially covered in Task 2.2)

**Files**:
- `apps/sail/src/hooks/use-fdc3-connection.ts`

**Requirements**:
- Remove manual WCP message handling
- Remove manual MessagePort tracking
- Delegate entirely to ConnectionManager

**Implementation Checklist**:
- [ ] Ensure all WCP logic moved to ConnectionManager
- [ ] Simplify hook to just instantiate ConnectionManager
- [ ] Update hook return value
- [ ] Update all hook consumers
- [ ] Update tests

---

### Task 5.2: Update use-desktop-agent Hook
**Status**: ⏳ Pending

**Files**:
- `apps/sail/src/hooks/use-desktop-agent.ts`

**Requirements**:
- Remove any EventEmitter code if present
- Keep only Socket.IO connection management
- Simplify to just provide socket instance

**Implementation Checklist**:
- [ ] Review current implementation
- [ ] Remove any EventEmitter logic
- [ ] Keep Socket.IO connection management
- [ ] Update tests

---

### Task 5.3: Create EventEmitter Wrapper (Optional)
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/desktop-agent-wrapper.ts` (NEW, if needed)

**Requirements**:
- Create wrapper for Desktop Agent with EventEmitter
- Proxy methods that need event emission
- Provide events for UI synchronization

**Implementation Checklist**:
- [ ] Determine if EventEmitter wrapper is needed
- [ ] Create DesktopAgentWrapper class (if needed)
- [ ] Define DesktopAgentEvents interface
- [ ] Implement event emission for key operations
- [ ] Add tests

---

## Phase 6: Testing

### Task 6.1: Update Unit Tests
**Status**: ⏳ Pending

**Files**:
- All test files in `packages/desktop-agent/src/__tests__/`

**Requirements**:
- Update to use MockTransport
- Update assertions for new `send()` signature
- Test message routing via metadata

**Implementation Checklist**:
- [ ] Update all handler tests
- [ ] Update Desktop Agent tests
- [ ] Update registry tests
- [ ] Verify all tests pass
- [ ] Add new tests for routing logic

---

### Task 6.2: Add Integration Tests
**Status**: ⏳ Pending

**Files**:
- `packages/desktop-agent/src/__tests__/integration/` (NEW)

**Requirements**:
- Test complete WCP handshake flow
- Test multi-app message routing
- Test DACP heartbeat and disconnect
- Test context broadcast across apps
- Test intent resolution across apps

**Implementation Checklist**:
- [ ] Create integration test directory
- [ ] Add WCP handshake test
- [ ] Add multi-app routing test
- [ ] Add heartbeat/disconnect test
- [ ] Add context broadcast test
- [ ] Add intent resolution test

---

### Task 6.3: Add ConnectionManager Tests
**Status**: ⏳ Pending

**Files**:
- `packages/sail-api/src/browser/__tests__/connection-manager.test.ts` (NEW)

**Requirements**:
- Test WCP1Hello handling
- Test MessagePort registration
- Test message routing to apps
- Test message routing to Desktop Agent
- Test disconnect cleanup

**Implementation Checklist**:
- [ ] Create test file
- [ ] Add WCP1Hello test
- [ ] Add MessagePort registration test
- [ ] Add app routing test
- [ ] Add Desktop Agent routing test
- [ ] Add disconnect cleanup test

---

## Phase 7: Final Documentation

### Task 7.1: Update Package READMEs
**Status**: ✅ Completed

**Files**:
- `packages/sail-api/CONNECTION_MANAGER.md` ✅
- `packages/desktop-agent/WCP_INTEGRATION.md` ✅
- `packages/desktop-agent/TRANSPORT.md` ✅

---

### Task 7.2: Update Root CLAUDE.md
**Status**: ⏳ Pending

**Files**:
- `CLAUDE.md`

**Requirements**:
- Update architecture section
- Update common workflows
- Add troubleshooting for new architecture

**Implementation Checklist**:
- [ ] Update architecture section
- [ ] Update common workflows
- [ ] Add troubleshooting section
- [ ] Update commands/examples
- [ ] Review for accuracy

---

### Task 7.3: Create Migration Guide
**Status**: ⏳ Pending

**Files**:
- `docs/MIGRATION_GUIDE.md` (NEW)

**Requirements**:
- Breaking changes summary
- Before/after code examples
- Step-by-step migration instructions
- Common pitfalls and solutions

**Implementation Checklist**:
- [ ] Document breaking changes
- [ ] Add before/after examples
- [ ] Write migration steps
- [ ] Document common pitfalls
- [ ] Add troubleshooting tips

---

## Progress Summary

### Overall Progress
- **Phase 1**: 1/5 tasks completed (20%)
- **Phase 2**: 0/3 tasks completed (0%)
- **Phase 3**: 0/3 tasks completed (0%)
- **Phase 4**: 0/2 tasks completed (0%)
- **Phase 5**: 0/3 tasks completed (0%)
- **Phase 6**: 0/3 tasks completed (0%)
- **Phase 7**: 1/3 tasks completed (33%)

**Total**: 2/22 tasks completed (9%)

---

## Next Steps

The recommended next step is to **start Phase 1** by:

1. Verifying/creating the MockTransport (Task 1.2)
2. Updating the Desktop Agent constructor (Task 1.3)
3. Updating all DACP handlers (Task 1.4)
4. Removing transport from AppInstanceRegistry (Task 1.5)

Once Phase 1 is complete, the core architecture will be in place for implementing ConnectionManager and transport implementations.

---

## Related Documents

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed implementation guidance
- [Transport Architecture Planning](./TRANSPORT_ARCHITECTURE_PLANNING.md) - Architectural decisions
- [Architecture Summary](./ARCHITECTURE_SUMMARY.md) - Full architecture overview
- [Connection Manager](../packages/sail-api/CONNECTION_MANAGER.md) - ConnectionManager specification
- [WCP Integration](../packages/desktop-agent/WCP_INTEGRATION.md) - WCP integration guide
- [Transport](../packages/desktop-agent/TRANSPORT.md) - Transport interface documentation