export interface ErrorDTO {
  code: number
  message: string
}

export interface NameValuePair {
  name: string
  value: string
}

export interface Icon {
  src: string
  size?: string
  type?: string
}

export interface Screenshot {
  src: string
  size?: string
  type?: string
  label?: string
}

export type Type = "web" | "native" | "citrix" | "onlineNative" | "other"

export interface WebAppDetails {
  url: string
}

export interface NativeAppDetails {
  path: string
  arguments?: string
}

export interface CitrixAppDetails {
  alias: string
  arguments?: string
}

export interface OnlineNativeAppDetails {
  url: string
}

export interface OtherAppDetails {
  // Empty by definition
}

export type LaunchDetails =
  | WebAppDetails
  | NativeAppDetails
  | CitrixAppDetails
  | OnlineNativeAppDetails
  | OtherAppDetails

export interface HostManifest {
  [key: string]: any
}

export interface HostManifests {
  [hostName: string]: string | HostManifest
}

export interface Intent {
  displayName?: string
  contexts: string[]
  resultType?: string
  customConfig?: Record<string, any>
}

export interface AppChannel {
  id: string
  description?: string
  broadcasts?: string[]
  listensFor?: string[]
}

export interface Interop {
  intents?: {
    listensFor?: Record<string, Intent>
    raises?: Record<string, string[]>
  }
  userChannels?: {
    broadcasts?: string[]
    listensFor?: string[]
  }
  appChannels?: AppChannel[]
}

export interface BaseApplication {
  appId: string
  title: string
  type: Type
  details: LaunchDetails
  name?: string
  version?: string
  tooltip?: string
  lang?: string
  description?: string
  categories?: string[]
  icons?: Icon[]
  screenshots?: Screenshot[]
  contactEmail?: string
  supportEmail?: string
  moreInfo?: string
  publisher?: string
  customConfig?: NameValuePair[]
  hostManifests?: HostManifests
  interop?: Interop
}

export interface Application extends BaseApplication {
  localizedVersions?: {
    [langTag: string]: BaseApplication
  }
}

export interface AllApplicationsResponse {
  applications: Application[]
  message: string
}
