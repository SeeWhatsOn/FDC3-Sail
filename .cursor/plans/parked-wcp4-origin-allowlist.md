# Parked: WCP4 origin allowlist (deployment origin blocking)

Status: parked feature — removed from code, not planned, not scheduled
Raised: implemented in `sail-platform`, removed 2026-08-04 during the `sail-platform` cull

## The idea

A deployment declares which `MessageEvent.origin` values are permitted to complete FDC3 identity
validation. A connection attempt from any other origin is rejected during **WCP4** — after
`WCP3Handshake`, before the app is admitted — by replying with
`WCP5ValidateAppIdentityFailedResponse`. That is the FDC3-sanctioned rejection path, so a blocked app
sees a standard failure rather than a hang or a bespoke error.

This is **deployment policy, not protocol**. FDC3 deliberately leaves it open: the standard's own WCP4
checks (origin consistency plus an App Directory match) say nothing about which origins an operator
trusts.

## Why it is parked

It was never used. `allowedOrigins` was referenced only inside `sail-platform` itself and its own
tests — no shell ever passed it, so the check never ran in any running Sail deployment. Verified
2026-08-04 by grep across every package: the only production references were the option's own
declaration and the wiring that consumed it.

Two further reasons it should not have lived where it did:

- **It was in the wrong package.** Origin trust is enforced on the wire, and after the cull
  `sail-platform` has no dependency on `sail-desktop-agent` at all. A policy that must run inside the
  DACP/WCP path cannot be owned by a package that cannot see that path.
- **It attached by monkey-patch.** The agent exposes no sanctioned seam for admission policy, so the
  implementation reassigned `handleMessage` through a cast into private internals
  (`desktopAgent as unknown as DesktopAgentInternals`). That is a signal the seam is missing, not that
  the feature is wrong.

## Why it is worth writing down now

The capability is genuine and this was the only security control in the repo. Removing it is a
deliberate scope decision, not a judgement that origin blocking is unnecessary. If it comes back it
should return as **agent configuration**, not as a wrapper:

- It belongs in `sail-desktop-agent` beside the existing WCP4 admission check
  (`wcp-identity-validation.ts` — directory lookup, rejects if absent), as an `allowedOrigins` option
  on the agent's own config.
- It is a **trust boundary**, so it must fail closed. An allowlist that throws, or that cannot resolve
  the connection attempt, must reject rather than admit.
- The rejection must stay on the FDC3 path (`WCP5ValidateAppIdentityFailedResponse`). Dropping the
  message silently produces a hung handshake and an unexplainable app.
- Reconstructing the `connectionAttemptUuid` mattered: it arrives on `meta.connectionAttemptUuid`, but
  during early handshake the instance is still `temp-<uuid>`, so the uuid had to be recovered from the
  instance id when the meta field was absent. Any reimplementation needs that fallback or it will fail
  to reply to exactly the connections it is meant to reject.

## The removed implementation

Deleted files, recoverable from git history before 2026-08-04:

- `packages/sail-platform/src/wcp4-origin-allowlist.ts`
- `packages/sail-platform/src/__tests__/wcp4-origin-allowlist.test.ts`
- `packages/sail-platform/src/__tests__/wcp4-origin-allowlist-interception.test.ts`

The shape it had:

```ts
export function wireWcp4OriginAllowlist(
  desktopAgent: SailDesktopAgent,
  allowedOrigins: readonly string[],
  debug?: boolean,
): void {
  const agent = desktopAgent as unknown as { handleMessage: (m: unknown) => Promise<void> }
  const originalHandleMessage = agent.handleMessage.bind(desktopAgent)

  agent.handleMessage = async (message: unknown) => {
    if (isWcp4ValidateAppIdentity(message)) {
      const { instanceId, messageOrigin, connectionAttemptUuid } = extract(message)

      if (messageOrigin !== undefined && !allowedOrigins.includes(messageOrigin)) {
        // temp-<uuid> fallback: during handshake the instance id carries the attempt uuid
        const uuid =
          connectionAttemptUuid ??
          (instanceId?.startsWith("temp-") ? instanceId.slice("temp-".length) : undefined)

        if (instanceId !== undefined && uuid !== undefined) {
          desktopAgent.connector.connectionRegistry.sendToAppInstance({
            type: "WCP5ValidateAppIdentityFailedResponse",
            payload: { message: `Origin "${messageOrigin}" is not allowed` },
            meta: { timestamp: new Date().toISOString(), connectionAttemptUuid: uuid,
                    destination: { instanceId } },
          })
          return
        }
      }
    }
    await originalHandleMessage(message)
  }
}
```

## Trigger to revisit

A deployment that needs to restrict which origins may connect — a named adopter with a real
untrusted-origin concern, not a hypothetical one. At that point implement it as agent config, with the
fail-closed and `connectionAttemptUuid` notes above as the acceptance criteria.

## Related

- `.cursor/plans/parked-context-interception.md` — the other parked wire-level capability
- `.cursor/plans/sail-platform-extensibility.md` — "build nothing extensible until a written
  requirement needs to block or reliably record a wire decision the existing host contracts cannot
  express". Origin blocking is exactly such a decision, which is why it belongs in the agent.
