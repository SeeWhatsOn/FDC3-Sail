import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SheetDemo } from './components/ac'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
      <div className="flex flex-col items-center">
        <h1>Portfolio</h1>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>

        <Button onClick={() => setCount((count) => count + 1)}>Click me  {count}</Button>

        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md border"
        />
        <SheetDemo />
      </div>
  )
}

export default App
