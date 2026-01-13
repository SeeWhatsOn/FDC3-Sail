import { BrowserTypes } from "@finos/fdc3-schema"

/**
 * DirectoryApp represents a full application definition in the FDC3 App Directory.
 * It is specifically designed to be compatible with the BasicDirectory implementation
 * from @finos/fdc3-web-impl by overriding problematic fields from the base FDC3 schema.
 */
export type DirectoryApp = Omit<
  BrowserTypes.AppDefinition,
  "appId" | "title" | "type" | "details" | "hostManifests"
> & {
  /** The unique application identifier (Required) */
  appId: string
  /** Title for the application (Required) */
  title: string
  /** Application type (Required) */
  type: "web" | "native" | "citrix" | "onlineNative" | "other"
  /** Launch details specific to the application type (Required) */
  details:
    | { url: string }
    | { path: string; arguments?: string }
    | { alias: string; arguments?: string }
    | Record<string, never>
  /** Host-specific manifests with strict type matching for BasicDirectory */
  hostManifests?: { [key: string]: string | Record<string, never> }
}

/** Expected structure of directory data from remote sources or local files */
export interface DirectoryData {
  applications: DirectoryApp[]
}
