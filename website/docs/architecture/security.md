---
sidebar_position: 3
---

# WCP4 origin allowlist

`@finos/sail-platform` ships one Sail-specific security control on top of the FDC3 WCP protocol: an
optional origin allowlist enforced during WCP4 identity validation. This page states what it does, how
to turn it on, and — honestly — that it does nothing unless a host configures it.

## What it does `[implemented]`

`createSailBrowserDesktopAgent`'s `allowedOrigins` option (`sail-browser-desktop-agent.ts:26`) wraps the
agent's inbound message handler (`wireWcp4OriginAllowlist`, `wcp4-origin-allowlist.ts:63-102`). When a
`WCP4ValidateAppIdentity` message arrives, the wrapper reads `meta.messageOrigin` off the message and,
if it is not in the configured `allowedOrigins` list, responds with
`WCP5ValidateAppIdentityFailedResponse` (`wcp4-origin-allowlist.ts:89-95`) instead of letting the
message reach the Desktop Agent's own handlers — a spec-compliant rejection path, not a protocol
extension. Standard FDC3 WCP4 checks (origin consistency between `WCP1Hello` and `WCP4`, App Directory
identity match) still apply independently of this allowlist.

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-platform"

const desktopAgent = createSailBrowserDesktopAgent({
  appLauncher,
  allowedOrigins: ["https://my-host.example"],
})
```

## It fails open by default

The option is `readonly string[] | undefined`, and the source comment is explicit about the
undefined case (`sail-browser-desktop-agent.ts:23-25`): *"When **undefined** (default), no additional
origin allowlist is applied — only standard FDC3 WCP4 checks... apply."* There is no default allowlist
and no warning when it is omitted. A host that never sets `allowedOrigins` gets exactly the same WCP4
behaviour with or without this feature existing.

## It ships unwired in both example shells

Neither shell in this repository sets `allowedOrigins` today (verified: no reference to it anywhere
under `packages/sail-finance/src` or `packages/sail-one/src`). So as shipped, neither example UI
applies this control — a reader copying either shell's construction call gets the fail-open default,
not a worked example of the allowlist in use.

## It only exists on the low entry point

`wireWcp4OriginAllowlist` is called from `createSailBrowserDesktopAgent` only
(`sail-browser-desktop-agent.ts:76-78`). `SailPlatform`'s constructor config has no equivalent option —
see [Architecture Overview — Two entry points](./overview#two-entry-points). A host built on the high
entry point (`SailPlatform`, what `sail-one` uses) has no way to configure this allowlist today; it
would need to be added to `SailPlatform` or applied by the host directly against the agent it
constructs.

## Using it

Set `allowedOrigins` to the list of origins your deployment expects app iframes/windows to be served
from. Debug logging for rejected connections is available via the existing `debug` flag
(`wcp4-origin-allowlist.ts:82-87`), not a separate switch.

This control is a deployment policy, not a substitute for standard web security practice (HTTPS,
Content-Security-Policy, and vetting app directory entries) — it only narrows *which origins* may
complete WCP4 identity validation.

## Related

- [Architecture Overview — Two entry points](./overview#two-entry-points) — the two ways to construct a
  Desktop Agent, and why this control lives on only one of them.
- [@finos/sail-platform](../packages/platform/overview) — the package this control ships in.
