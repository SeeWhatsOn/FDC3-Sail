# @finos/sail-platform

Platform SDK for FDC3 Sail. Wraps [`@finos/sail-desktop-agent`](../sail-desktop-agent/README.md) with `SailPlatform` (lifecycle and host channel APIs) and `SailPlatformClient` (a small typed config-persistence helper backed by `localStorage`).

## Documentation

| Topic | Link |
|-------|------|
| Package overview | [finos.github.io/FDC3-Sail/docs/packages/platform-api/overview](https://finos.github.io/FDC3-Sail/docs/packages/platform-api/overview) |
| Sail Platform SDK architecture | [finos.github.io/FDC3-Sail/docs/architecture/sail-platform-sdk](https://finos.github.io/FDC3-Sail/docs/architecture/sail-platform-sdk) |
| Channel selection | [finos.github.io/FDC3-Sail/docs/architecture/channel-selection](https://finos.github.io/FDC3-Sail/docs/architecture/channel-selection) |
| Desktop Agent integrator guide | [finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide](https://finos.github.io/FDC3-Sail/docs/packages/desktop-agent/integrator-guide) |

## Install

```bash
npm install @finos/sail-platform
```

## Quick start

```typescript
import { SailPlatform } from "@finos/sail-platform"

const platform = new SailPlatform({ appLauncher: myAppLauncher })
platform.start()
```

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
