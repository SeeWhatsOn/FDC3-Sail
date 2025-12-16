import { useState, useEffect } from "react"
import { getAgent } from "@finos/fdc3"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { SheetDemo } from "./components/ac"
import "./App.css"

function App() {
  const [count, setCount] = useState(0)
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentInstrument, setCurrentInstrument] = useState<string | null>(null)

  useEffect(() => {
    // Get FDC3 agent and listen for instrument context
    getAgent()
      .then(fdc3 => {
        console.log("FDC3 agent connected in Portfolio app")

        // Listen for instrument context changes
        fdc3.addContextListener("fdc3.instrument", context => {
          if (context.id?.ticker) {
            const ticker = context.id.ticker
            console.log("Received instrument context:", ticker)
            setCurrentInstrument(ticker)
          }
        })
      })
      .catch(error => {
        console.error("Failed to get FDC3 agent:", error)
      })
  }, [])

  return (
    <div className="flex flex-col items-center">
      <h1>Portfolio</h1>
      {currentInstrument && (
        <div className="mb-4 text-sm text-gray-600">
          Current Instrument: <strong>{currentInstrument}</strong>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
      </Card>

      <Button onClick={() => setCount(count => count + 1)}>Click me {count}</Button>

      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
      <SheetDemo />
    </div>
  )
}

export default App
