/**
 * Desktop Agent Interfaces
 *
 * Injectable contracts the Desktop Agent depends on rather than implementing
 * itself. Currently just logging — the agent is browser-resident and does not
 * abstract its environment.
 */

export * from "./logger"
