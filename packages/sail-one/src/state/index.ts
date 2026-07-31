import { AppState, DefaultAppState } from "./DefaultAppState"
import { ClientState, LocalStorageClientState } from "./ClientState"
import { SailHost, ServerState } from "./SailHost"

export { AppHosting } from "./DefaultAppState"
export type {
  AppPanel,
  ClientState,
  Directory,
  SailClientStateArgs,
  TabDetail,
} from "./ClientState"
export type { AppState, AppOpenDetails } from "./DefaultAppState"
export type { ServerState } from "./SailHost"
export type {
  AugmentedAppIntent,
  AugmentedAppMetadata,
  IntentResolution,
} from "../resolver/types"

let theServerState: SailHost | null = null
let theClientState: LocalStorageClientState | null = null
let theAppState: DefaultAppState | null = null

function ensureSetup() {
  theServerState = theServerState ?? new SailHost()
  theAppState = theAppState ?? new DefaultAppState()
  theClientState = theClientState ?? new LocalStorageClientState()
}

export function getServerState(): ServerState {
  ensureSetup()
  return theServerState!
}

export function getAppState(): AppState {
  ensureSetup()
  return theAppState!
}

export function getClientState(): ClientState {
  ensureSetup()
  return theClientState!
}

export function bindClientStateToHost(): void {
  ensureSetup()
  theClientState!.init(theServerState!)
}
