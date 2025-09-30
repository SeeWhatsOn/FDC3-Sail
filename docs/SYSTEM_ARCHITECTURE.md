# FDC3-Sail System Architecture

## 1. Overview

This document provides a comprehensive architectural overview of the FDC3-Sail platform. Its purpose is to serve as a central source of truth for developers, explaining how the various components, packages, and applications interact to provide a cohesive FDC3-enabled desktop experience.

## 2. Core Principles

The system is designed around several core principles:

-   **FDC3 Compliance**: Strictly adhere to the FDC3 2.0+ standards, particularly the Desktop Agent Communication Protocol (DACP).
-   **Separation of Concerns**: A clear division between the FDC3-standard "Desktop Agent" engine and the proprietary "Sail" platform services (UI, layouts, workspaces).
-   **Transport Agnosticism**: The core desktop agent is decoupled from the underlying transport layer, allowing it to communicate over Socket.IO, MessagePorts, or other mechanisms.
-   **Extensibility**: The architecture is designed to be modular, allowing for the addition of new apps, services, and features with minimal friction.

## 3. Architecture Diagram

The following diagram illustrates the high-level system architecture, from client applications down to the FDC3 Desktop Agent layer.

```mermaid
flowchart TD
    subgraph "CLIENT APPLICATIONS"
        A1["Sail UI Client"]
        A2["FDC3 App 1 (e.g., via DACP)"]
        A3["FDC3 App 2 (e.g., via Socket.IO)"]
    end

    subgraph "SAIL SERVER (apps/sail-server)"
        B1["Socket.IO Server"]
        B2["Message Routers"]
        B3["Authentication & Transport"]
    end

    subgraph "BUSINESS LOGIC (packages/sail-api)"
        C1["SailServer API"]
    end

    subgraph "FDC3 DESKTOP AGENT (packages/desktop-agent)"
        D1["DACP Message Processors"]
        D2["State Management Registries"]
        D3["App Directory & Channel Managers"]
    end

    A1 -- "sail_event / fdc3_event" --> B1
    A3 -- "sail_event / fdc3_event" --> B1
    A2 -- "DACP (MessagePort)" --> D1

    B1 --> B2
    B2 -- "sail_event" --> C1
    B2 -- "fdc3_event" --> D1

    C1 -- "Queries/Commands" --> D3
```

## 4. Component Breakdown

The platform is a monorepo composed of several `apps` and `packages`.

-   **`apps/sail-server`**: The central NodeJS backend that orchestrates the entire system. It hosts the Socket.IO server, manages client connections, and initializes the FDC3 Desktop Agent.
-   **`apps/sail`**: The primary frontend application, built with React. It provides the main Sail shell interface, including workspace management, layouts, and the app launcher. It communicates with `sail-server` using the protocols defined below.
-   **`apps/sail-electron`**: An Electron wrapper that packages the `sail` frontend application into a distributable desktop application.
-   **`packages/desktop-agent`**: The heart of FDC3 compliance. This package implements the FDC3 Desktop Agent specification. It is transport-agnostic and responsible for all FDC3 state management (apps, intents, channels) and message processing.
-   **`packages/sail-api`**: Defines the programmatic API for the Sail server. It provides a clear interface for proprietary Sail functionality, separating it from the core FDC3 logic.
-   **`packages/sail-ui`**: A shared React component library that provides a consistent look and feel across all Sail applications.
-   **`packages/app-directories`**: Contains JSON-based app directories that define the applications available to be launched by the desktop agent.

## 5. Communication Protocols

Communication is handled via a unified convention that supports multiple transports.

### 5.1. The Two-Channel Convention (Socket.IO)

For clients connecting via Socket.IO, the system uses exactly two event channels to route all messages, as defined in `@packages/desktop-agent/PROTOCOL.md`.

-   **`fdc3_event`**: Used for all FDC3-standard DACP (Desktop Agent Communication Protocol) messages.
-   **`sail_event`**: Used for all proprietary Sail platform messages (e.g., layout changes, workspace management).

This separation ensures that FDC3-standard logic is cleanly isolated from proprietary features.

### 5.2. Supported Transports

The architecture supports two primary transport mechanisms for FDC3 communication.

```mermaid
flowchart LR
    subgraph "Web-Based Clients"
        WB["Sail UI / FDC3 Web App"]
    end
    subgraph "Desktop-Based Clients"
        DB["Native / Sandboxed FDC3 App"]
    end
    subgraph "Sail Server"
        SS["Socket.IO Server"]
        DA["Desktop Agent"]
    end

    WB -- "fdc3_event (DACP over Socket.IO)" --> SS
    SS --> DA
    DB -- "DACP over MessagePort" --> DA
```

-   **Socket.IO**: The primary transport for web applications running inside the Sail environment or connecting remotely. DACP messages are wrapped within the `fdc3_event` channel.
-   **DACP over `MessagePort`**: The standard FDC3 mechanism for non-web clients. The desktop agent can establish direct communication with other desktop applications using the browser `MessagePort` API, allowing for true interoperability.

## 6. Message & Data Flow

### Sequence Diagram: Sail UI Opening an App

This diagram shows the flow for a proprietary Sail action.

```mermaid
sequenceDiagram
    participant User
    participant SailUI as "Sail UI (apps/sail)"
    participant SailServer as "Sail Server (apps/sail-server)"
    participant DesktopAgent as "Desktop Agent (packages/desktop-agent)"

    User->>SailUI: Clicks 'Open App'
    SailUI->>SailServer: emit('sail_event', {type: 'sailAppOpen', payload: {appId: 'my-app'}})
    SailServer->>DesktopAgent: Calls open('my-app')
    DesktopAgent-->>SailServer: Returns instanceId
    SailServer-->>SailUI: Acknowledges with {success: true, instanceId: '...'}
```

### Sequence Diagram: FDC3 Context Broadcast

This diagram shows the flow for a standard FDC3 action initiated by a client connected via Socket.IO.

```mermaid
sequenceDiagram
    participant AppA as "FDC3 App A"
    participant SailServer as "Sail Server"
    participant DesktopAgent as "Desktop Agent"
    participant AppB as "FDC3 App B"

    AppA->>SailServer: emit('fdc3_event', {type: 'broadcastRequest', payload: {context: ...}})
    SailServer->>DesktopAgent: processMessage(message, sourceId)
    DesktopAgent->>DesktopAgent: Find listeners on the current channel
    DesktopAgent-->>SailServer: Identify AppB as a listener
    SailServer->>AppB: emit('fdc3_event', {type: 'contextEvent', payload: {context: ...}})
```

### Class Diagram: Core State Management

This diagram shows the planned state management registries within the Desktop Agent.

```mermaid
classDiagram
    class AppInstanceRegistry {
        -instances: Map<InstanceID, AppInstance>
        +register(instance: AppInstance): void
        +unregister(instanceId: InstanceID): void
        +getInstance(instanceId: InstanceID): AppInstance
        +getAllInstances(): AppInstance[]
    }

    class IntentRegistry {
        -handlers: Map<string, IntentHandler[]>
        +registerHandler(handler: IntentHandler): void
        +findHandlers(intent: string): IntentHandler[]
        +cleanup(instanceId: InstanceID): void
    }

    class PrivateChannelRegistry {
        -channels: Map<string, PrivateChannelInstance>
        +create(creatorId: InstanceID): PrivateChannelInstance
        +addParticipant(channelId: string, instanceId: InstanceID): void
        +getChannel(channelId: string): PrivateChannelInstance
    }

    AppInstanceRegistry ..> IntentRegistry : Notifies on unregister
    AppInstanceRegistry ..> PrivateChannelRegistry : Notifies on unregister
```

## 7. Implementation Status

This architecture is partially implemented. Based on the analysis of `@packages/desktop-agent/IMPLEMENTATION_PLAN.md`, the current status is as follows:

-   **Complete**:
    -   Initial state management for `AppInstanceRegistry` and `IntentRegistry`.
    -   Basic project structure for all apps and packages.

-   **In Progress / To-Do**:
    -   Full implementation of all DACP message handlers (e.g., App Management, Private Channels).
    -   Creation of the `PrivateChannelRegistry`.
    -   Formal separation of Sail-specific services from the core server logic.
    -   Comprehensive FDC3 compliance and performance testing suites.

## 8. Related Documents

For more granular details on specific aspects of the architecture and implementation, please refer to the original documents:

-   [**Implementation Plan (`@packages/desktop-agent/IMPLEMENTATION_PLAN.md`)**](../packages/desktop-agent/IMPLEMENTATION_PLAN.md): A detailed, phased plan for implementing the FDC3 Desktop Agent, including specific code structures and handler logic.
-   [**Protocol Convention (`@packages/desktop-agent/PROTOCOL.md`)**](../packages/desktop-agent/PROTOCOL.md): A focused look at the two-channel (`fdc3_event` and `sail_event`) Socket.IO messaging protocol.
-   [**Initial Architecture Analysis (`ARCHITECTURE_ANALYSIS.md`)**](../ARCHITECTURE_ANALYSIS.md): The original analysis document that identified architectural gaps and proposed the foundational changes.
