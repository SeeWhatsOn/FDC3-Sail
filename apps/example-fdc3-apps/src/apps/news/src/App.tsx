import { useEffect, useState } from 'react'
import './App.css'
import FinnhubNewsFeed from './finnhub-news'
import '@finos/fdc3'
import { TradingViewNews } from './tradingview-news'

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const symbolParam = searchParams.get("symbol") ?? "AAPL"

  const [symbol, setSymbol] = useState<string>(symbolParam)


  useEffect(() => {
    // check if fdc3 is available if not set a timeout to try again
    if (!window.fdc3) {
      setTimeout(() => {
        if (!window.fdc3) {
          console.log("FDC3 not available, retrying...")
        }
      }, 5000)
    } else {
      console.log("FDC3 is available")
    }
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
