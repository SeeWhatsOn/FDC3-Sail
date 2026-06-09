---
sidebar_position: 4
---

# Development Guide

This guide is for **contributors** who clone the FDC3-Sail monorepo and work on Sail packages, tests, and documentation.

If you want to **run the Sail platform** without contributing, see [Run Sail](./run-sail). If you want to **embed a Desktop Agent in your own web app**, see [Getting Started](./getting-started).

## Prerequisites

- Node.js **24+**
- npm **11+**

```bash
nvm use 24
```

## Clone and install

```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
npm install
```

### Run the full stack locally

```bash
npm run dev
```

Starts Desktop Agent (watch), platform API (watch), server stub, and Sail web UI on **http://localhost:3000**.

```bash
npm run dev:desktop   # Electron desktop mode
npm run docs:dev      # Documentation site (use --port 3002 if web app is running)
```

## Project Structure

FDC3 Sail is an npm workspace monorepo:

```
FDC3-Sail/
├── packages/          
│   ├── sail-desktop-agent/  # Pure FDC3 2.2 Desktop Agent (@finos/sail-desktop-agent)
│   ├── sail-platform-api/  # Platform services & transports (@finos/sail-platform-api)
│   ├── sail-ui/        # Shared React components
│   ├── sail-web/       # Browser-based Sail UI (@finos/sail-web)
│   ├── sail-server/    # Node.js backend server (@finos/sail-server)
│   └── sail-electron/  # Electron desktop wrapper (@finos/sail-electron)
└── website/            # Documentation (Docusaurus)
```

## Internal and Development Packages

The main package docs focus on packages adopters are likely to use directly. These package docs are most useful when working inside the monorepo:

- [@finos/sail-ui](./packages/sail-ui/overview) - shared React components used by Sail apps.
- [@finos/sail-conformance-harness](./packages/conformance-harness/overview) - clean-room FDC3 toolbox host for conformance debugging.

## Common Commands

### Development

```bash
# Start browser-based development (most common)
npm run dev:web

# Start Electron desktop development
npm run dev:desktop

# Start documentation site
npm run docs:dev
```

### Code Quality

```bash
# Run all quality checks (recommended before commits)
npm run validate

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:fix
```

### Testing

```bash
# Unit tests (Vitest) - watch mode
npm run test

# Run tests once
npm run test:run

# Desktop Agent tests
npm run test --workspace=@finos/sail-desktop-agent

# FDC3 Compliance tests (Cucumber BDD)
npm run test:cucumber --workspace=@finos/sail-desktop-agent
```

### Building

```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build --workspace=@finos/sail-platform-api

# Clean build artifacts
npm run clean
```

## Code Submission Process

### Before You Start

1. **Check for existing issues** - Search GitHub issues for related work
2. **Create an issue** - Describe your proposed changes and get feedback
3. **Fork the repository** - Create your own copy to work in

### Making Changes

#### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

#### 2. Development Standards

**Code Quality Requirements:**
- All ESLint rules must pass (`npm run lint`)
- All TypeScript type checks must pass (`npm run typecheck`)
- Code must be formatted with Prettier (`npm run format`)
- All builds must succeed (`npm run build`)

#### 3. Quality Check Before Submission

```bash
# Run this before every commit
npm run validate

# If any step fails:
npm run lint:fix      # Fix linting issues
npm run format:fix    # Fix formatting
# Fix any type errors manually
npm run build         # Verify build works
```

### Commit Message Format

```bash
type: brief description

- More detailed explanation if needed
- Use bullet points for multiple changes
- Reference issue numbers: Fixes #123
```

**Common types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code restructuring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Key Technologies

- **TypeScript** - Type-safe JavaScript
- **React 19** - UI framework
- **Socket.IO** - Real-time communication
- **Zustand** - State management
- **Dockview** - Workspace layout management
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Vitest** - Testing framework
- **Cucumber** - BDD testing for FDC3 compliance

## Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
