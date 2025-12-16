import { useEffect, useState } from "react"
import "./App.css"
import FinnhubNewsFeed from "./finnhub-news"
import { getAgent } from "@finos/fdc3"
import { TradingViewNews } from "./tradingview-news"

function App() {
  const searchParams = new URLSearchParams(window.location.search)
  const symbolParam = searchParams.get("symbol") ?? "AAPL"

  const [symbol, setSymbol] = useState<string>(symbolParam)

  useEffect(() => {
    // Get FDC3 agent and listen for instrument context
    getAgent()
      .then(fdc3 => {
        console.log("FDC3 agent connected")

        // Listen for instrument context changes
        fdc3.addContextListener("fdc3.instrument", context => {
          if (context.id?.ticker) {
            console.log("Received instrument context:", context.id.ticker)
            setSymbol(context.id.ticker)
          }
        })
      })
      .catch(error => {
        console.error("Failed to get FDC3 agent:", error)
      })
  }, [])

  // check if the view is tradingview via query param in the url
  const showTradingView = searchParams.get("view") === "tradingview"

  return (
    <>
      {showTradingView ? <TradingViewNews symbol={symbol} /> : <FinnhubNewsFeed symbol={symbol} />}
    </>
  )
}

export default App
