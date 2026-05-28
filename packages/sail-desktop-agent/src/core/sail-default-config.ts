/**
 * FDC3-Sail product defaults for Desktop Agent configuration.
 *
 * Single source of truth for implementation metadata, user channels, and timing
 * defaults. Factory entry points (SailPlatform, createBrowserDesktopAgent) merge
 * these defaults with caller overrides before constructing DesktopAgent.
 */

import type { BrowserTypes } from "@finos/fdc3"
import pkg from "../../package.json"
import { DACP_TIMEOUTS } from "./dacp-protocol/dacp-constants"
import type { DesktopAgentConfig } from "./desktop-agent"
import { DEFAULT_FDC3_USER_CHANNELS } from "./default-user-channels"

export type SailImplementationMetadata = Pick<
  BrowserTypes.ImplementationMetadata,
  "fdc3Version" | "provider" | "providerVersion"
> &
  Pick<Required<BrowserTypes.ImplementationMetadata>, "optionalFeatures">

export const DEFAULT_SAIL_IMPLEMENTATION_METADATA: SailImplementationMetadata = {
  fdc3Version: "2.2",
  provider: "FDC3-Sail",
  providerVersion: pkg.version,
  optionalFeatures: {
    DesktopAgentBridging: false,
    OriginatingAppMetadata: true,
    UserChannelMembershipAPIs: true,
  },
}

/** Product defaults excluding transport (always supplied by the caller). */
export const DEFAULT_SAIL_DESKTOP_AGENT_CONFIG = {
  implementationMetadata: DEFAULT_SAIL_IMPLEMENTATION_METADATA,
  userChannels: DEFAULT_FDC3_USER_CHANNELS,
  openContextListenerTimeoutMs: DACP_TIMEOUTS.MINIMUM_APP_LAUNCH,
  heartbeatIntervalMs: 30_000,
  heartbeatTimeoutMs: 60_000,
} satisfies Omit<
  DesktopAgentConfig,
  "transport" | "implementationMetadata"
> & {
  implementationMetadata: SailImplementationMetadata
}

function mergeImplementationMetadata(
  base: SailImplementationMetadata,
  override?: Partial<SailImplementationMetadata>
): SailImplementationMetadata {
  if (!override) {
    return base
  }

  return {
    ...base,
    ...override,
    optionalFeatures: {
      ...base.optionalFeatures,
      ...override.optionalFeatures,
    },
  }
}

/**
 * Merge FDC3-Sail product defaults with caller overrides and return a complete
 * DesktopAgentConfig (including required implementationMetadata).
 */
export function resolveDesktopAgentConfig(
  overrides: Omit<DesktopAgentConfig, "implementationMetadata"> & {
    implementationMetadata?: Partial<SailImplementationMetadata>
  }
): DesktopAgentConfig {
  const { implementationMetadata, ...rest } = overrides

  return {
    ...DEFAULT_SAIL_DESKTOP_AGENT_CONFIG,
    ...rest,
    implementationMetadata: mergeImplementationMetadata(
      DEFAULT_SAIL_IMPLEMENTATION_METADATA,
      implementationMetadata
    ),
  }
}
