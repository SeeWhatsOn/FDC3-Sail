import { SailDesktopAgent, type SailDesktopAgentOptions } from "../../src/agent/sail-desktop-agent"
import { DacpTestAppConnection } from "./dacp-test-app-connection"

export function createDesktopAgentWithTestConnection(
  options: Omit<SailDesktopAgentOptions<DacpTestAppConnection>, "appConnection"> = {},
): {
  agent: SailDesktopAgent<DacpTestAppConnection>
  connection: DacpTestAppConnection
} {
  const connection = new DacpTestAppConnection()
  const agent = new SailDesktopAgent<DacpTestAppConnection>({
    ...options,
    appConnection: connection,
  })
  agent.start()
  return { agent, connection }
}
