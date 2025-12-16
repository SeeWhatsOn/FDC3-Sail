import { useState, useEffect } from 'react'

import './App.css'

function App() {

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "feedMode": "symbol",
      "symbol": "NASDAQ:AAPL",
      "isTransparent": false,
      "displayMode": "regular",
      "width": "100%",
      "height": "100%",
      "colorTheme": "dark",
      "locale": "en"
    });

    const widgetContainer = document.querySelector('.tradingview-widget-container__widget');
    if (widgetContainer) {
      widgetContainer.appendChild(script);
    }

    return () => {
      if (widgetContainer && script) {
        widgetContainer.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="tradingview-widget-container w-screen h-screen">
      <div className="tradingview-widget-container__widget w-screen h-screen"></div>

    </div>
  )
}

export default App
