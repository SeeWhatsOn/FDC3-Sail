/**
 * Default FDC3 implementation metadata for the Desktop Agent.
 *
 * Single source of truth for DesktopAgent config defaults and DACP handler
 * fallbacks when host context omits implementationMetadata.
 */

import type { BrowserTypes } from "@finos/fdc3"

export const DEFAULT_IMPLEMENTATION_METADATA = {
  fdc3Version: "2.2",
  provider: "FDC3-Sail",
  providerVersion: "3.0.0",
  optionalFeatures: {
    DesktopAgentBridging: false,
    OriginatingAppMetadata: true,
    UserChannelMembershipAPIs: true,
  },
} satisfies Pick<
  BrowserTypes.ImplementationMetadata,
  "fdc3Version" | "provider" | "providerVersion"
> &
  Partial<Pick<BrowserTypes.ImplementationMetadata, "optionalFeatures">>
