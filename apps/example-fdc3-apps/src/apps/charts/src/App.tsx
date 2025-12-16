import { useState, useEffect, useRef } from "react"
import { getAgent } from "@finos/fdc3"
import "./App.css"

function App() {
  const [symbol, setSymbol] = useState<string>("NASDAQ:AAPL")
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const widgetContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Get FDC3 agent and listen for instrument context
    getAgent()
      .then(fdc3 => {
        console.log("FDC3 agent connected in Charts app")

        // Listen for instrument context changes
        fdc3.addContextListener("fdc3.instrument", context => {
          if (context.id?.ticker) {
            const ticker = context.id.ticker
            console.log("Received instrument context:", ticker)
            // Format as NASDAQ:TICKER or use ticker directly
            setSymbol(ticker.includes(":") ? ticker : `NASDAQ:${ticker}`)
          }
        })
      })
      .catch(error => {
        console.error("Failed to get FDC3 agent:", error)
      })
  }, [])

  useEffect(() => {
    // Remove existing script if any
    if (scriptRef.current && widgetContainerRef.current) {
      widgetContainerRef.current.removeChild(scriptRef.current)
      scriptRef.current = null
    }

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
    script.type = "text/javascript"
    script.async = true
    script.innerHTML = JSON.stringify({
      feedMode: "symbol",
      symbol: symbol,
      isTransparent: false,
      displayMode: "regular",
      width: "100%",
      height: "100%",
      colorTheme: "dark",
      locale: "en",
    })

    const widgetContainer = document.querySelector(".tradingview-widget-container__widget")
    if (widgetContainer) {
      widgetContainer.appendChild(script)
      scriptRef.current = script
      widgetContainerRef.current = widgetContainer as HTMLDivElement
    }

    return () => {
      if (widgetContainer && scriptRef.current) {
        try {
          widgetContainer.removeChild(scriptRef.current)
        } catch (e) {
          // Script may have already been removed
        }
        scriptRef.current = null
      }
    }
  }, [symbol])

  return (
    <div className="tradingview-widget-container w-screen h-screen">
      <div
        className="tradingview-widget-container__widget w-screen h-screen"
        ref={widgetContainerRef}
      ></div>
    </div>
  )
}

export default App
