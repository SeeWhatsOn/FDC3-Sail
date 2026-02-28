# @finos/sail-ui

Shared React UI component library for FDC3 Sail. Provides reusable, accessible components built on [shadcn/ui](https://ui.shadcn.com/) and Tailwind CSS, used across `sail-web` and other Sail applications.

## Installation

This package is private and part of the FDC3-Sail monorepo. It is not published to npm.

```bash
# From the monorepo root
npm install
```

## Usage

Import components from the package root:

```typescript
import { Button, Sidebar, SidebarContent, SidebarProvider } from "@finos/sail-ui"
```

Import styles:

```typescript
import "@finos/sail-ui/styles"
```

## Available Components

### Layout

- `Sidebar`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupContent`, `SidebarGroupLabel`
- `SidebarHeader`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuItem`
- `SidebarProvider`, `SidebarTrigger`, `useSidebar`

### Navigation & Controls

- `Button`
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
- `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`

## Subpath Exports

| Export | Description |
|---|---|
| `@finos/sail-ui` | Component exports |
| `@finos/sail-ui/styles` | CSS stylesheet |
| `@finos/sail-ui/components/*` | Individual component modules |

## Development

### Building

```bash
npm run build --workspace=@finos/sail-ui
```

### Watching for Changes

```bash
npm run dev --workspace=@finos/sail-ui
```

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
