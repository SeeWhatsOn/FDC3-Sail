import { DesktopAgent, type DesktopAgentOptions } from "../../src/agent/desktop-agent"
import { DacpTestAppConnection } from "./dacp-test-app-connection"

/** Attach a DACP oracle app edge and start the agent for Vitest/Cucumber. */
export function wireDacpTestAppConnection(
  agent: DesktopAgent,
  connection: DacpTestAppConnection = new DacpTestAppConnection(),
): DacpTestAppConnection {
  agent.attachAppConnection(connection)
  agent.start()
  return connection
}

export function createDesktopAgentWithTestConnection(options: DesktopAgentOptions = {}): {
  agent: DesktopAgent
  connection: DacpTestAppConnection
} {
  const agent = new DesktopAgent(options)
  const connection = wireDacpTestAppConnection(agent)
  return { agent, connection }
}
