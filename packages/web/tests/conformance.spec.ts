import { test, expect } from "@playwright/test"

const SAIL_URL = "http://localhost:8090/html/index.html"
const CONFORMANCE_APP_URL_PATTERN = /\/v2\.0\/app\/index\.html/
const CONFORMANCE_MESSAGE_START = "fdc3-conformance-tests-start"
const CONFORMANCE_MESSAGE_COMPLETE = "fdc3-conformance-tests-complete"

test("runs conformance tests and waits for completion", async ({ page }) => {
  test.setTimeout(10 * 60 * 1000)

  // E2E mode preloads the conformance app, so navigation can happen very early.
  // Start waiting before page.goto to avoid missing the frame event.
  const conformanceFrameNavigation = page.waitForEvent("framenavigated", {
    predicate: (frame) => CONFORMANCE_APP_URL_PATTERN.test(frame.url()),
  })

  await page.goto(SAIL_URL)

  const conformanceFrame =
    page.frames().find((frame) => CONFORMANCE_APP_URL_PATTERN.test(frame.url())) ??
    (await conformanceFrameNavigation)

  await conformanceFrame.waitForLoadState("domcontentloaded")

  // Conformance app posts to window.parent via postMessage. We listen on the
  // parent (main page) with two separate handlers so start and complete are
  // observed at their own times.
  const startMessagePromise = page.evaluate(
    (startType) =>
      new Promise<unknown>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === startType) {
            window.removeEventListener("message", handler)
            resolve(event.data?.detail)
          }
        }
        window.addEventListener("message", handler)
      }),
    CONFORMANCE_MESSAGE_START,
  )

  const completeMessagePromise = page.evaluate(
    (completeType) =>
      new Promise<unknown>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === completeType) {
            window.removeEventListener("message", handler)
            resolve(event.data?.detail)
          }
        }
        window.addEventListener("message", handler)
      }),
    CONFORMANCE_MESSAGE_COMPLETE,
  )

  const runButton = conformanceFrame.getByRole("button", { name: /run/i }).first()
  await runButton.click()

  await test.step("receives conformance tests started message", async () => {
    const startDetail = await startMessagePromise
    expect(startDetail).toBeDefined()
  })

  await test.step("receives conformance tests completed message", async () => {
    const completeDetail = await completeMessagePromise
    expect(completeDetail).toBeTruthy()
  })
})
