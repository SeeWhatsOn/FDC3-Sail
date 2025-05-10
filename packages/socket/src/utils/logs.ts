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

/**
 * ANSI color codes for terminal coloring
 */
export enum LogColor {
  RESET = "\x1b[0m",
  BRIGHT = "\x1b[1m",
  DIM = "\x1b[2m",

  // Foreground colors
  FG_BLACK = "\x1b[30m",
  FG_RED = "\x1b[31m",
  FG_GREEN = "\x1b[32m",
  FG_YELLOW = "\x1b[33m",
  FG_BLUE = "\x1b[34m",
  FG_MAGENTA = "\x1b[35m",
  FG_CYAN = "\x1b[36m",
  FG_WHITE = "\x1b[37m",
  FG_GRAY = "\x1b[90m",

  // Background colors
  BG_BLACK = "\x1b[40m",
  BG_RED = "\x1b[41m",
  BG_GREEN = "\x1b[42m",
  BG_YELLOW = "\x1b[43m",
  BG_BLUE = "\x1b[44m",
  BG_MAGENTA = "\x1b[45m",
  BG_CYAN = "\x1b[46m",
  BG_WHITE = "\x1b[47m",
}

/**
 * Map categories to colors for consistent coloring
 */
const CATEGORY_COLORS: Record<LogCategory, LogColor> = {
  [LogCategory.CHANNEL]: LogColor.FG_CYAN,
  [LogCategory.DESKTOP_AGENT]: LogColor.FG_GREEN,
  [LogCategory.INTENT]: LogColor.FG_YELLOW,
  [LogCategory.MESSAGE]: LogColor.FG_WHITE,
  [LogCategory.APP]: LogColor.FG_BLUE,
  [LogCategory.LIFECYCLE]: LogColor.FG_MAGENTA,
  [LogCategory.ELECTRON]: LogColor.FG_GREEN,
  [LogCategory.CLIENT_STATE]: LogColor.FG_CYAN,
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
  color?: LogColor

  /** Whether to disable colors in output (useful for non-TTY output) */
  noColor?: boolean
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

  // Check if we should use colors (disable for non-TTY environments)
  const useColors = !noColor && process.stdout.isTTY

  // Color formatting functions
  const colorize = (text: string, colorCode: LogColor): string => {
    return useColors ? `${colorCode}${text}${LogColor.RESET}` : text
  }

  // Format category with optional sub-category
  const categoryText = subCategory
    ? `[${category} ${subCategory}]`
    : `[${category}]`

  const coloredCategory = colorize(categoryText, color)

  // Format context data
  const contextPairs = Object.entries(context)
    .map(([key, value]) => {
      const coloredKey = colorize(key, LogColor.BRIGHT)
      return useColors ? `${coloredKey}=${value}` : `${key}=${value}`
    })
    .join(", ")

  // Format the event name
  const coloredEvent = colorize(event, LogColor.FG_WHITE)

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
