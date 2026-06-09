---
sidebar_position: 2
---

# Getting Started

## Prerequisites

- Node.js **24+**
- npm **11+**

```bash
nvm use 24
```

## Installation

```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
npm install
```

## Running Sail

### Browser mode (recommended)

```bash
npm run dev
```

This starts:

- Desktop Agent (watch)
- Platform API (watch)
- Sail Server
- Sail Web UI

Open **http://localhost:3000**

### Documentation site

```bash
npm run docs:dev
```

Runs Docusaurus on port 3000 by default — use a different port if the web app is already running:

```bash
npm run start -w @finos/sail-docs -- --port 3002
```

### Electron desktop mode

```bash
npm run dev:desktop
```

## Project structure

```text
FDC3-Sail/
├── packages/
│   ├── sail-desktop-agent/   # Pure FDC3 Desktop Agent
│   ├── sail-platform-api/    # Platform services & SailPlatform
│   ├── sail-ui/              # Shared UI components
│   ├── sail-web/             # React host application
│   ├── sail-server/          # Server runtime (stub/WIP)
│   ├── sail-electron/        # Electron wrapper
│   └── sail-conformance-harness/  # FINOS toolbox clean room
└── website/                  # Documentation (Docusaurus)
```

## Key concepts

**FDC3** enables desktop app interoperability — context sharing, intents, and channels.

**Desktop Agent** manages app connections, routes messages, and implements the FDC3 2.2 APIs.

## Next steps

- [Architecture overview](./architecture/overview)
- [@finos/sail-desktop-agent integrator guide](./packages/desktop-agent/integrator-guide) — how to build a browser FDC3 host
- [Development guide](./development)
