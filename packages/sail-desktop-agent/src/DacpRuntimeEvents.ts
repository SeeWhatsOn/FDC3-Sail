import { InstanceID } from "./AppRegistration"

/**
 * These are events not coming from another FDC3 application, but from the
 * DacpRuntime itself.
 */
export interface DacpRuntimeEvent {
  type: string
}

/**
 * Used when the DacpRuntime wants to notify the handler that the private channel has been disconnected.
 */
export class PrivateChannelDisconnectDacpRuntimeEvent
  implements DacpRuntimeEvent
{
  public type: string

  constructor(
    public instanceId: InstanceID,
    public channelId: string,
  ) {
    this.type = "privateChannelDisconnect"
  }
}

/**
 * Used when the DacpRuntime wants to notify the handler that the current channel has changed.
 */
export class ChannelChangedDacpRuntimeEvent implements DacpRuntimeEvent {
  public type: string

  constructor(
    public instanceId: InstanceID,
    public channelId: string | null,
  ) {
    this.type = "channelChanged"
  }
}

/**
 * Used when the DacpRuntime is shutting down
 */
export class ShutdownDacpRuntimeEvent implements DacpRuntimeEvent {
  public type: string

  constructor() {
    this.type = "shutdown"
  }
}
