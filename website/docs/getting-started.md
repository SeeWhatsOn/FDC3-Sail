---
sidebar_position: 2
---

# Getting Started

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
npm install
```

## Running Sail

### Browser Mode (Recommended for Development)

```bash
npm run dev:web
```

This starts multiple processes:
- Desktop Agent (watch mode)
- Platform SDK (watch mode)
- Sail Server
- Sail Web UI
- Example FDC3 Apps

Access Sail at **http://localhost:8090**

### Desktop Mode (Electron)

```bash
npm run dev:desktop
```

## Project Structure

```
FDC3-Sail/
├── packages/
│   ├── desktop-agent/       # Pure FDC3 Desktop Agent (@finos/sail-desktop-agent)
│   ├── sail-platform-sdk/   # Platform services & wrappers (@finos/sail-platform-sdk)
│   └── sail-ui/             # Shared UI components
├── apps/
│   ├── sail-web/            # Sail UI (React frontend)
│   ├── sail-server/         # Server runtime (Node.js backend)
│   └── sail-electron/       # Electron desktop wrapper
└── website/                 # Documentation (you are here)
```

## Key Concepts

### What is FDC3?

FDC3 (Financial Desktop Connectivity and Collaboration Consortium) is a standard for desktop application interoperability in financial services. It enables applications to:

- **Share context** - Pass data between apps (instruments, contacts, etc.)
- **Raise intents** - Request actions from other apps (view chart, start chat)
- **Join channels** - Synchronize context across multiple apps

### What is a Desktop Agent?

A Desktop Agent is the runtime that implements the FDC3 standard. It:

- Manages app connections and lifecycle
- Routes context and intent messages
- Provides channel management
- Handles app directory lookups

FDC3 Sail provides a complete Desktop Agent implementation that runs in the browser or as a desktop application.

## Next Steps

- Read the [Architecture Overview](./architecture/overview) to understand how Sail works
- Check out the [Development Guide](./development) for contributing
