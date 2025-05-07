import { DesktopAgentConnectionArgs, TabDetail } from "@finos/fdc3-sail-common"
import {
  ChannelState,
  ChannelType,
  DefaultFDC3Server,
} from "@finos/fdc3-web-impl"
import { SailServerContext } from "./SailServerContext"

export const mapChannels = (channels: TabDetail[]): ChannelState[] =>
  channels.map(({ id, icon, background }) => ({
    id,
    type: ChannelType.user,
    displayMetadata: {
      name: id,
      glyph: icon,
      color: background,
    },
    context: [],
  }))

/**
 * Extends BasicFDC3Server to allow for more detailed (and changeable) user channel metadata
 * as well as user-configurable SailDirectory.
 */
export class SailFDC3Server extends DefaultFDC3Server {
  readonly serverContext: SailServerContext

  constructor(
    sailServerContext: SailServerContext,
    helloArgs: DesktopAgentConnectionArgs,
  ) {
    super(
      sailServerContext,
      sailServerContext.directory,
      mapChannels(helloArgs.channels),
      true,
      60000,
      20000,
    )
    sailServerContext.directory.replace(helloArgs.directories)
    this.serverContext = sailServerContext
  }

  getAppDirectory() {
    return this.serverContext.directory
  }

  getServerContext() {
    return this.serverContext
  }
}
