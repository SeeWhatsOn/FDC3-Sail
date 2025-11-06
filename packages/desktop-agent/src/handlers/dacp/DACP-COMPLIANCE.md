# DACP Compliance Checklist

FDC3 Desktop Agent Communication Protocol v2.2 Specification Compliance

**Last Updated:** 2025-11-06

---

## Overview

This document tracks the implementation status of all DACP message types defined in the FDC3 specification.

### Implementation Status Summary

- ✅ **Implemented & Working:** 23 message types
- ⚠️ **Implemented but Not Registered:** 0 message types
- ❌ **Not Implemented:** 9+ message types

**Spec Coverage:** ~60% complete

---

## 1. Context Operations

### ✅ broadcastRequest / broadcastResponse
**Status:** Implemented & Working
**Location:** `context.handlers.ts:21`
**Issues:** None

**Spec Requirements:**
- ✅ Validates channelId and context
- ✅ Stores context in ChannelContextRegistry
- ✅ Notifies context listeners on the same channel
- ✅ Sends broadcastResponse back to sender
- ✅ Proper error handling

---

### ✅ addContextListenerRequest / addContextListenerResponse
**Status:** Implemented & Working
**Location:** `context.handlers.ts:72`
**Issues:** None

**Spec Requirements:**
- ✅ Registers listener with optional contextType filter
- ✅ Defaults to "*" (all types) when contextType not specified
- ✅ Returns listenerId for unsubscribe
- ✅ Proper error handling

---

### ✅ contextListenerUnsubscribeRequest / contextListenerUnsubscribeResponse
**Status:** Implemented & Working
**Location:** `context.handlers.ts:123`
**Issues:** None

**Spec Requirements:**
- ✅ Removes listener by listenerId
- ✅ Returns error if listener not found
- ✅ Proper error handling

---

### ✅ contextEvent
**Status:** Implemented & Working
**Location:** `context.handlers.ts:172` (sent from notifyContextListeners)
**Issues:** None

**Spec Requirements:**
- ✅ Sent to apps with matching context listeners
- ✅ Contains channelId and context
- ✅ Uses eventUuid in meta

---

## 2. Intent Operations

### ✅ raiseIntentRequest / raiseIntentResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:19`

**Spec Requirements:**
- ✅ Validates intent name and context
- ✅ Supports optional target app
- ✅ Sends intentEvent to target app after resolution
- ✅ Waits for intentResultRequest from target app
- ✅ Returns intentResult in response
- ✅ Proper error handling
- ✅ Tracks pending intents in IntentRegistry

---

### ✅ addIntentListenerRequest / addIntentListenerResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:69`
**Issues:** None

**Spec Requirements:**
- ✅ Registers intent listener
- ✅ Returns listenerId
- ✅ Stores in IntentRegistry
- ✅ Proper error handling

---

### ✅ intentListenerUnsubscribeRequest / intentListenerUnsubscribeResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:106`
**Issues:** None

**Spec Requirements:**
- ✅ Removes listener by listenerId
- ✅ Proper error handling

---

### ✅ findIntentRequest / findIntentResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:135`
**Issues:** None

**Spec Requirements:**
- ✅ Finds apps that can handle an intent
- ✅ Optional context type filtering
- ✅ Returns AppIntent structure
- ✅ Proper error handling

---

### ✅ findIntentsByContextRequest / findIntentsByContextResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:285`
**Registered:** `index.ts:91`

**Spec Requirements:**
- ✅ Find all intents that can handle a specific context type
- ✅ Returns array of AppIntents
- ✅ Used for discovery without knowing intent name
- ✅ Queries IntentRegistry by context type
- ✅ Proper error handling

---

### ✅ raiseIntentForContextRequest / raiseIntentForContextResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:330`
**Registered:** `index.ts:87`

**Spec Requirements:**
- ✅ Raise intent without specifying intent name
- ✅ Desktop Agent determines appropriate intent from context
- ✅ Similar to raiseIntent but context-first
- ✅ Uses IntentRegistry to find matching intents
- ✅ Proper error handling

---

### ✅ intentEvent
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:89` (sent from raiseIntentRequest)

**Spec Requirements:**
- ✅ Sent from Desktop Agent to target app when intent is raised
- ✅ Contains intent name, context, and source app metadata
- ✅ Target app handles intent and sends intentResultRequest back

---

### ✅ intentResultRequest / intentResultResponse
**Status:** Implemented & Working
**Location:** `intent.handlers.ts:219`
**Registered:** `index.ts:92`

**Spec Requirements:**
- ✅ Sent from target app back to Desktop Agent after handling intent
- ✅ Contains intentResult (void, context, or channel)
- ✅ Desktop Agent forwards result to source app
- ✅ Links back to pending intent via requestUuid
- ✅ Resolves or rejects intent promise

---

## 3. Channel Operations

### ✅ getCurrentChannelRequest / getCurrentChannelResponse
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:19`
**Issues:** None

**Spec Requirements:**
- ✅ Returns current channel or null
- ✅ Proper error handling

---

### ✅ joinUserChannelRequest / joinUserChannelResponse
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:52`
**Issues:** None

**Spec Requirements:**
- ✅ Validates channel exists
- ✅ Updates instance channel
- ✅ Sends channelChangedEvent
- ✅ Proper error handling

---

### ✅ leaveCurrentChannelRequest / leaveCurrentChannelResponse
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:90`
**Issues:** None

**Spec Requirements:**
- ✅ Sets channel to null
- ✅ Sends channelChangedEvent
- ✅ Proper error handling

---

### ✅ getUserChannelsRequest / getUserChannelsResponse
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:124`

**Spec Requirements:**
- ✅ Returns array of user channels
- ✅ Uses UserChannelRegistry for channel configuration
- ✅ Supports default FDC3 channels (red, blue, green, yellow, orange, purple)
- ✅ Configurable via constructor injection

---

### ✅ getCurrentContextRequest / getCurrentContextResponse
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:152`
**Registered:** `index.ts:96`

**Spec Requirements:**
- ✅ Returns last broadcast context for specified channel
- ✅ Filters by contextType if specified
- ✅ Returns null if no context available
- ✅ Uses ChannelContextRegistry for storage
- ✅ Proper error handling

---

### ✅ channelChangedEvent
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:250` (notifyChannelChanged)

**Spec Requirements:**
- ✅ Sent when app joins/leaves channel
- ✅ Contains channelId and app identity
- ✅ Broadcast to all apps subscribed via addEventListener
- ✅ Sent to the app that changed channels
- ✅ Uses getEventListeners to find subscribers

---

### ✅ getOrCreateChannelRequest / getOrCreateChannelResponse
**Status:** Implemented & Working
**Location:** `channel.handlers.ts:199`
**Registered:** `index.ts:100`

**Spec Requirements:**
- ✅ Get or create app channel by ID
- ✅ Returns Channel interface (id, type: "app", displayMetadata)
- ✅ Different from user channels
- ✅ Uses AppChannelRegistry for tracking
- ✅ Proper error handling

---

## 4. Application Management

### ✅ getInfoRequest / getInfoResponse
**Status:** Implemented & Working
**Location:** `app-management/app.handlers.ts:31`
**Issues:** None

**Spec Requirements:**
- ✅ Returns implementation metadata
- ✅ Includes fdc3Version, provider, providerVersion
- ✅ Includes optionalFeatures support

---

### ⚠️ openRequest / openResponse
**Status:** Implemented but NOT REGISTERED
**Location:** `app-management/app.handlers.ts:53`
**Issues:**
- ❌ **Not in handler map at `index.ts:76`**
- ❌ Returns wrong response type ("getInfoResponse" instead of "openResponse")
- ❌ Wrong error type (API_TIMEOUT)
- ⚠️ Handler is incomplete (TODO comment)

**Spec Requirements:**
- ⚠️ Open an application by appId
- ⚠️ Returns AppIdentifier with instanceId
- ⚠️ Uses 100s timeout for app launch

**Fix Priority:** 🔴 HIGH - Core FDC3 functionality

**Fix Plan:**
1. Add to handler map with correct message type
2. Fix response/error types
3. Implement actual app launching logic
4. Add to app launch timeout list at `index.ts:117`

---

### ⚠️ findInstancesRequest / findInstancesResponse
**Status:** Implemented but NOT REGISTERED
**Location:** `app-management/app.handlers.ts:82`
**Issues:**
- ❌ **Not in handler map at `index.ts:76`**
- ❌ Returns wrong response type ("getInfoResponse")
- ❌ Wrong error type (API_TIMEOUT)
- 🐛 Logic issue: `getInstance(appId)` should be `queryInstances({ appId })`

**Spec Requirements:**
- ⚠️ Find all instances of an app
- ⚠️ Returns array of AppIdentifiers

**Fix Priority:** 🟡 MEDIUM

**Fix Plan:**
1. Add to handler map
2. Fix response/error types
3. Fix logic to use `queryInstances` instead of `getInstance`
4. Add to app launch timeout list

---

### ⚠️ getAppMetadataRequest / getAppMetadataResponse
**Status:** Implemented but NOT REGISTERED
**Location:** `app-management/app.handlers.ts:112`
**Issues:**
- ❌ **Not in handler map at `index.ts:76`**
- ❌ Returns wrong response type ("getInfoResponse")
- ❌ Returns IMPLEMENTATION_METADATA instead of app metadata
- ❌ Wrong error type (API_TIMEOUT)
- ⚠️ Handler is incomplete (TODO comment)

**Spec Requirements:**
- ⚠️ Get metadata for specific app
- ⚠️ Returns AppMetadata

**Fix Priority:** 🟡 MEDIUM

**Fix Plan:**
1. Add to handler map
2. Fix response/error types
3. Implement actual app metadata lookup from AppDirectory
4. Return correct payload

---

## 5. Desktop Agent Events

### ✅ addEventListenerRequest / addEventListenerResponse
**Status:** Implemented & Working
**Location:** `event.handlers.ts:97`
**Registered:** `index.ts:108`

**Spec Requirements:**
- ✅ Register listener for DA-level events (not context/intent)
- ✅ Supports event type: "channelChanged"
- ✅ Returns listenerId
- ✅ Uses EventListenerRegistry singleton
- ✅ Validates event types
- ✅ Proper error handling

---

### ✅ eventListenerUnsubscribeRequest / eventListenerUnsubscribeResponse
**Status:** Implemented & Working
**Location:** `event.handlers.ts:146`
**Registered:** `index.ts:109`

**Spec Requirements:**
- ✅ Unsubscribe from DA-level events
- ✅ Takes listenerId
- ✅ Removes from EventListenerRegistry
- ✅ Returns error if listener not found
- ✅ Proper error handling

---

## 6. Private Channels

### ❌ createPrivateChannelRequest / createPrivateChannelResponse
**Status:** Not Implemented
**Priority:** 🟢 LOW (unless needed for your use case)

**Spec Requirements:**
- ❌ Create a private channel
- ❌ Returns private channel ID
- ❌ Only accessible to apps with ID

**Implementation Plan:**
1. Create PrivateChannelRegistry
2. Add schemas in `dacp-schemas.ts`
3. Add handler in new `private-channel.handlers.ts`
4. Track private channel membership in AppInstanceRegistry
5. Register in handler map

**Note:** Commented TODO at `index.ts:101`

---

### ❌ privateChannelDisconnectRequest / privateChannelDisconnectResponse
**Status:** Not Implemented
**Priority:** 🟢 LOW

**Spec Requirements:**
- ❌ Disconnect from private channel
- ❌ Cleanup channel if no more members

---

### ❌ Private Channel Events
**Status:** Not Implemented
**Priority:** 🟢 LOW

**Events:**
- ❌ onAddContextListener - Notifies when listener added to private channel
- ❌ onUnsubscribe - Notifies when listener removed
- ❌ onDisconnect - Notifies when app disconnects from private channel

---

## 7. Web Connection Protocol (WCP)

### ✅ WCP4ValidateAppIdentity / WCP5ValidateAppIdentityResponse
**Status:** Implemented & Working
**Location:** `wcp.handlers.ts:72`
**Issues:**
- ⚠️ TODO comment about validating MessageEvent.origin at line 103

**Spec Requirements:**
- ✅ Validates identityUrl and actualUrl origins match
- ✅ Looks up app in directory
- ✅ Creates or reconnects to instance
- ✅ Returns instanceId and implementationMetadata
- ⚠️ Should also validate MessageEvent.origin

**Fix Priority:** 🟢 LOW - Core works, origin validation is additional security

---

## 8. Health & Monitoring

### ❌ heartbeatEvent
**Status:** Not Implemented
**Priority:** 🟢 LOW (nice to have)

**Spec Requirements:**
- ❌ Sent periodically from DA to app
- ❌ App responds with heartbeatAcknowledgmentRequest
- ❌ Used to detect disconnected apps

**Implementation Plan:**
1. Add heartbeat interval timer per instance
2. Send heartbeatEvent periodically
3. Track acknowledgments
4. Mark instances as disconnected if no ack

**Note:** Commented TODO at `index.ts:105`

---

### ❌ heartbeatAcknowledgmentRequest / Response
**Status:** Not Implemented
**Priority:** 🟢 LOW

**Spec Requirements:**
- ❌ App sends to acknowledge heartbeat
- ❌ Resets timeout counter

---

## 9. UI Control Messages (Optional)

### ❌ Fdc3UserInterface* Messages
**Status:** Not Implemented
**Priority:** 🟢 LOW (only if using injected UI pattern)

**Messages:**
- ❌ Fdc3UserInterfaceHandshake
- ❌ Fdc3UserInterfaceChannels
- ❌ Fdc3UserInterfaceChannelSelected
- ❌ Fdc3UserInterfaceResolve
- ❌ Fdc3UserInterfaceResolveAction
- ❌ Fdc3UserInterfaceDrag / Restyle

**Note:** Only needed if implementing injected UI for channel selector and intent resolver

---

## Implementation Plan - Prioritized

### Phase 1: Critical Fixes (Required for Core FDC3)

#### ✅ 1.1 Fix Intent Event Flow - COMPLETED
**Status:** Verified complete in existing implementation
- ✅ intentEvent schema exists in dacp-schemas.ts
- ✅ raiseIntentRequest sends intentEvent to target app (line 89)
- ✅ intentResultRequest handler implemented (line 219)
- ✅ Pending intent tracking in IntentRegistry
- ✅ Handler registered in index.ts:92
- ✅ Timeout handling implemented

---

#### 1.2 Register Missing App Management Handlers 🔴 HIGH
**Estimated Effort:** 30 minutes
**Files to Modify:**
- `index.ts:76` - Add openRequest, findInstancesRequest, getAppMetadataRequest to handler map
- `index.ts:117` - Add openRequest and findInstancesRequest to app launch timeout list
- `app.handlers.ts` - Fix error response types and logic

**Steps:**
1. Add entries to handler map
2. Fix copy-paste errors in response types
3. Fix findInstancesRequest logic to use queryInstances
4. Fix getAppMetadataRequest to return actual metadata

---

### Phase 2: Important Missing Features 🟡 MEDIUM

#### ✅ 2.1 Implement findIntentsByContext - COMPLETED
**Status:** Verified complete in existing implementation
- ✅ Handler implemented (intent.handlers.ts:285)
- ✅ Registered in index.ts:91
- ✅ Queries IntentRegistry by context type
- ✅ Returns array of AppIntents

#### ✅ 2.2 Implement Desktop Agent Event Listeners (addEventListener) - COMPLETED
**Status:** Verified complete in existing implementation
- ✅ EventListenerRegistry tracks subscribers
- ✅ addEventListenerRequest handler (event.handlers.ts:97)
- ✅ eventListenerUnsubscribeRequest handler (event.handlers.ts:146)
- ✅ Both registered in index.ts:108-109
- ✅ channelChanged events broadcast to all subscribers

#### ✅ 2.3 Implement getOrCreateChannel - COMPLETED
**Status:** Fully implemented
- ✅ AppChannelRegistry created for managing app channels
- ✅ getOrCreateChannelRequest handler implemented (channel.handlers.ts:199)
- ✅ Handler registered in index.ts:100
- ✅ Schema updated with proper payload structure
- ✅ Returns Channel interface with type: "app"

#### ✅ 2.4 Implement Channel Context Storage - COMPLETED
**Status:** Fully implemented
- ✅ ChannelContextRegistry created for storing contexts
- ✅ broadcastRequest stores context per channel (context.handlers.ts:39)
- ✅ getCurrentContextRequest retrieves stored context (channel.handlers.ts:167)
- ✅ Supports filtering by contextType
- ✅ Returns most recent context or null

#### ✅ 2.5 Replace Mock Channel Data - COMPLETED
**Status:** Fully implemented
- ✅ UserChannelRegistry created for managing user channels
- ✅ Supports default FDC3 channels (red, blue, green, yellow, orange, purple)
- ✅ getUserChannelsRequest uses registry (channel.handlers.ts:124)
- ✅ joinUserChannelRequest validates against registry (channel.handlers.ts:54)
- ✅ Configurable via DesktopAgent constructor
- ✅ Includes display metadata (name, color, glyph)

---

### Phase 3: Optional Enhancements 🟢 LOW

#### 3.1 Private Channels
**Estimated Effort:** 4-6 hours
**Only if needed for your use case**

#### 3.2 Heartbeat Mechanism
**Estimated Effort:** 2 hours
**Benefit:** Detect and cleanup disconnected apps

#### 3.3 raiseIntentForContext
**Estimated Effort:** 1-2 hours
**Benefit:** Context-first intent raising (convenience API)

---

## Testing Recommendations

### 1. Integration Tests
Test full message flows end-to-end:
- ✅ Schema validation (already tested)
- ✅ Service logic (already tested)
- ❌ Full DACP message routing (add minimal smoke tests)

### 2. Manual Testing Checklist
Create test scenarios for:
- [ ] Broadcast and receive context
- [ ] Raise intent and receive intentEvent
- [ ] Return intent result
- [ ] Join/leave channels
- [ ] Open apps
- [ ] Find intents

### 3. Compliance Testing
- [ ] Test with FDC3 conformance suite (if available)
- [ ] Test with real FDC3 apps

---

## Quick Win Summary

**Fastest path to working FDC3:**

1. **Register missing handlers** (30 min) - Get openRequest, findInstancesRequest working
2. **Fix intent event flow** (2-3 hours) - Get raiseIntent working properly
3. **Add findIntentsByContext** (1 hour) - Complete intent discovery
4. **Test with real apps** - Validate everything works

**Total estimated effort for core compliance:** 4-5 hours

---

## Notes

- Handler registry mismatch is causing valid handlers to be ignored
- Copy-paste errors in error responses need fixing
- Intent event flow is the biggest gap in current implementation
- Most service layer (registries) is solid - issues are in handler wiring
- No need for extensive handler unit tests - integration tests are sufficient
