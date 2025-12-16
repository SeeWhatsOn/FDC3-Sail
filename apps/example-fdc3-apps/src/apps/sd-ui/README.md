# ShadCn-ui

A React components library built with ShadcnUI.

## Important: Package Installation Note ⚠️

If you encounter dependency errors, update your package.json workspace references:

```json
// Change this:
"@repo/typescript-config": "workspace:*"

// To this:
"@repo/typescript-config": "*"
```

## Adding to Other Packages in the Repo

### 1. Add Dependencies

Add to your package's `package.json`:
```json
{
  "dependencies": {
    "sd-ui": "workspace:*"
  }
}
```

### 2. Setup Tailwind

1. [Install tailwind](https://tailwindcss.com/docs/installation/using-vite)

2. ~~You may not need to add anyything to your tailwind.config.js~~
3. Add globals.css to your main css file e.g. index.css
```

2. Import the required styles in your main CSS file (e.g., `index.css`):
```css
@import "tailwindcss";
@import "@/globals.css";  /* This file is provided by sd-ui */
```

### 3. Configure Vite

Update your `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/sd-ui/src"),
    }
  }
})
```

### 4. Add Theme Provider

Wrap your application with the ThemeProvider:
```tsx
import { ThemeProvider } from 'sd-ui'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {children}
    </ThemeProvider>
  )
}
```

## Available Components

[Add a section describing the available components and how to use them]