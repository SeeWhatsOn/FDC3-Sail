import chalk from "chalk"

/**
 * Handler categories for logging
 */
export enum LogCategory {
  CHANNEL = "ChannelHandler",
  DESKTOP_AGENT = "DesktopAgentHandler",
  INTENT = "IntentHandler",
  MESSAGE = "MessageHandler",
  APP = "AppHandler",
  LIFECYCLE = "LifecycleHandler",
  ELECTRON = "ElectronHandler",
  CLIENT_STATE = "ClientStateHandler",
}

// Define color functions for each category
type ColorFunction = (text: string) => string

/**
 * Map categories to chalk color functions
 */
const CATEGORY_COLORS: Record<LogCategory, ColorFunction> = {
  [LogCategory.CHANNEL]: chalk.cyan,
  [LogCategory.DESKTOP_AGENT]: chalk.green,
  [LogCategory.INTENT]: chalk.yellow,
  [LogCategory.MESSAGE]: chalk.white,
  [LogCategory.APP]: chalk.blue,
  [LogCategory.LIFECYCLE]: chalk.magenta,
  [LogCategory.ELECTRON]: chalk.green,
  [LogCategory.CLIENT_STATE]: chalk.cyan,
}

/**
 * Configuration for handler event logging
 */
export interface HandlerLogOptions {
  /** The handler category */
  category: LogCategory

  /** The event name or action description */
  event: string

  /** Object containing context data to include in the log */
  context: Record<string, unknown>

  /** Optional sub-category (e.g., "Register") */
  subCategory?: string

  /** Optional override for the default category color */
  color?: ColorFunction

  /** Whether to disable colors in output (useful for non-TTY output) */
  noColor?: boolean
}

/**
 * Formats a value for logging, stringifying objects and arrays properly
 */
function formatValue(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"

  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

/**
 * Logs a handler event with standardized formatting and coloring
 */
export function logHandlerEvent(options: HandlerLogOptions): void {
  const {
    category,
    event,
    context,
    subCategory,
    color = CATEGORY_COLORS[category],
    noColor = false,
  } = options

  // Identity function for when colors are disabled
  const noColorFn = (text: string): string => text

  // Use either the color function or the identity function
  const colorFn = noColor ? noColorFn : color
  const boldFn = noColor ? noColorFn : chalk.bold
  const whiteFn = noColor ? noColorFn : chalk.white

  // Format category with optional sub-category
  const categoryText = subCategory
    ? `[${category} ${subCategory}]`
    : `[${category}]`

  const coloredCategory = colorFn(categoryText)
  const coloredEvent = whiteFn(event)

  // Format context data
  const contextPairs = Object.entries(context)
    .map(([key, value]) => {
      const coloredKey = boldFn(key)
      return `${coloredKey}=${formatValue(value)}`
    })
    .join(", ")

  console.log(`${coloredCategory} ${coloredEvent} (${contextPairs})`)
}

/**
 * Creates a pre-configured logger for a specific category
 */
export function createCategoryLogger(
  category: LogCategory,
  defaultOptions: Partial<HandlerLogOptions> = {},
) {
  return (options: Omit<HandlerLogOptions, "category">) => {
    logHandlerEvent({
      category,
      ...defaultOptions,
      ...options,
    })
  }
}
