import { DataTable, Then } from "@cucumber/cucumber"
import { CustomWorld } from "../world"
import expect from "expect"
import { matchData } from "../support/testing-utils"

Then("messaging will have outgoing posts", function (this: CustomWorld, dt: DataTable) {
  // Get messages from mock transport
  const allMessages = this.mockTransport.getPostedMessages()

  // Just take the last few posts and match those
  const matching = dt.rows().length
  let toUse = allMessages
  if (toUse.length > matching) {
    toUse = toUse.slice(toUse.length - matching, toUse.length)
  }

  matchData(this, toUse, dt)
})

Then("messaging will have {int} posts", function (this: CustomWorld, count: number) {
  const messages = this.mockTransport.getPostedMessages()
  expect(messages.length).toEqual(count)
})
