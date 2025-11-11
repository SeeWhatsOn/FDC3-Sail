# Developer Guide

This guide provides detailed instructions for developers contributing to FDC3-Sail.

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm 8+

### Setup
```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
npm install
```

### Development Workflow
```bash
# Run all quality checks before submitting
npm run check-all

# Individual commands
npm run lint          # Check code style
npm run lint:fix      # Auto-fix style issues
npm run type-check    # TypeScript type checking
npm run format        # Check code formatting
npm run format:fix    # Auto-fix formatting
npm run build         # Build all packages
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
- ✅ All ESLint rules must pass (`npm run lint`)
- ✅ All TypeScript type checks must pass (`npm run type-check`)  
- ✅ Code must be formatted with Prettier (`npm run format`)
- ✅ All builds must succeed (`npm run build`)

**Testing:**
- Add tests for new functionality
- Ensure existing tests still pass
- Test your changes in the actual application

#### 3. Code Style Guidelines

**TypeScript/JavaScript:**
- Use double quotes for strings
- No semicolons (Prettier enforces this)
- Arrow functions: avoid parentheses for single parameters (`x => x * 2`)
- Use proper TypeScript types (no `any`)

**React:**
- Functional components with hooks
- Use proper key props in lists
- Follow React Hooks rules (ESLint enforces this)

**Imports:**
- Organize imports automatically (ESLint handles this)
- Use absolute imports where configured

### 4. Commit Your Changes

**Commit Message Format:**
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
- `style:` - Code formatting (no functional changes)
- `refactor:` - Code restructuring (no functional changes)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 5. Quality Check Before Submission
```bash
# Run this before every commit
npm run check-all

# If any step fails:
npm run lint:fix      # Fix linting issues
npm run format:fix    # Fix formatting
# Fix any type errors manually
npm run build         # Verify build works
```

### 6. Submit Pull Request

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub with:
   - Clear title describing the change
   - Description explaining what and why
   - Link to related issue(s)
   - Screenshots/demos if UI changes

3. **PR Requirements:**
   - All CI checks must pass
   - Code review approval from maintainer
   - CLA signed (see CONTRIBUTING.md)

## Project Structure

```
FDC3-Sail/
├── packages/
│   ├── shared/         # Common types and utilities
│   ├── socket/         # Backend Socket.IO server  
│   ├── web/           # Frontend React application
│   ├── electron/      # Electron desktop wrapper
│   └── example-apps/  # Demo applications
├── docs/              # Documentation
├── directory/         # App directory JSON files
├── eslint.config.mjs  # ESLint configuration
├── .prettierrc        # Prettier configuration
├── tsconfig.json      # Root TypeScript config
└── tsconfig.root.json # Shared TypeScript settings
```

## TypeScript Configuration

### Adding New Workspace Packages
When creating a new package in `packages/`:

1. Create `packages/new-package/tsconfig.json`
2. Add reference to root `tsconfig.json`:
   ```json
   {
     "references": [
       { "path": "./packages/new-package" }
     ]
   }
   ```

### Package Dependencies
- `shared` - Base types and utilities (no dependencies)
- `socket` - Node.js backend (depends on `shared`)
- `web` - React frontend (depends on `shared`)
- `electron` - Desktop wrapper (minimal dependencies)
- `example-apps` - Demo apps (minimal dependencies)

## Common Issues

### Build Failures
- **TypeScript errors**: Run `npm run type-check` for detailed errors
- **Import issues**: Check that imports reference existing files
- **Cross-package types**: Ensure dependent packages are built first

### ESLint Errors  
- **Import ordering**: Auto-fixed by `npm run lint:fix`
- **React hooks**: Follow hooks rules, use ESLint plugin suggestions
- **TypeScript strict**: Fix type issues, avoid `any`

### Formatting Issues
- **Code style**: Run `npm run format:fix` to auto-format
- **Prettier conflicts**: ESLint config includes prettier integration

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion  
- **FINOS Community**: See CONTRIBUTING.md for community channels

## Development Tips

### Recommended VS Code Extensions
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Auto Rename Tag (for React)

### Useful Commands
```bash
# Clean all build artifacts
npm run clean

# Build specific package
npm run build --workspace=packages/web

# Run specific package in dev mode  
npm run dev --workspace=packages/socket

# Check specific package
npm run lint --workspace=packages/shared
```

### Performance Tips
- Use `npm run check-all` before committing (catches issues early)
- TypeScript incremental compilation speeds up subsequent builds
- ESLint cache improves repeat runs