import type { Context } from "@finos/fdc3"
import type { WCPConnector } from "@finos/sail-desktop-agent/browser"
import { selectIntentHandler } from "./intent-resolution"
import type { IntentHandlerOption } from "./types"

/**
 * Subscribe to WCP intent resolution requests and resolve programmatically.
 *
 * The desktop agent forwards multi-handler intents to {@link WCPConnector.requestIntentResolution};
 * this wiring listens for `intentResolverNeeded` and replies via
 * {@link WCPConnector.resolveIntentSelection} without modal UI.
 */
export function wireIntentResolver(wcpConnector: WCPConnector, debug = false): void {
  wcpConnector.on("intentResolverNeeded", payload => {
    const request = {
      requestId: payload.requestId,
      intent: payload.intent,
      context: payload.context as Context,
      handlers: payload.handlers as IntentHandlerOption[],
    }

    const selectedHandler = selectIntentHandler(request)

    if (debug) {
      console.log("[ConformanceHarness] Intent resolution", {
        intent: payload.intent,
        handlerCount: payload.handlers.length,
        selectedHandler,
      })
    } else {
      console.log("[ConformanceHarness] Intent resolution selected:", selectedHandler)
    }

    wcpConnector.resolveIntentSelection({
      requestId: payload.requestId,
      selectedHandler,
    })
  })
}
