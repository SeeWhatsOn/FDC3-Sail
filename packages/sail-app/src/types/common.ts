// Placeholder definitions for custom types that were previously in @finos/fdc3-sail-shared

export interface TabDetail {
  [key: string]: unknown
}

// This is used as both a value and a type, so we define it as a const
// and export a type from it.
export const AppHosting = {
  Tab: "Tab",
} as const
export type AppHosting = (typeof AppHosting)[keyof typeof AppHosting]

export interface DirectoryApp {
  [key: string]: unknown
}

// This was used as a value, so we define it as a const object (like an enum)
export const AppManagementMessages = {
  DA_DIRECTORY_LISTING: "DA_DIRECTORY_LISTING",
  FDC3_DA_EVENT: "FDC3_DA_EVENT",
  FDC3_APP_EVENT: "FDC3_APP_EVENT",
}

export interface DesktopAgentDirectoryListingArgs {
  [key: string]: unknown
}

export type InstanceID = string

// This was used as a value, so we define it as a const object (like an enum)
export const HandshakeMessages = {
  APP_HELLO: "APP_HELLO",
}

export interface AppHelloArgs {
  [key: string]: unknown
}
