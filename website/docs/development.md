---
sidebar_position: 3
---

# Development Guide

This guide provides detailed instructions for developers contributing to FDC3-Sail.

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
