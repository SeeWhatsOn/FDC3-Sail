import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
// @ts-ignore
import { resolveRefs } from "json-refs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function test() {
  const schemaPath = path.join(
    __dirname,
    "../../../node_modules/@finos/fdc3-schema/dist/schemas/api/broadcastRequest.schema.json"
  )

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"))

  console.log("Original schema:")
  console.log(JSON.stringify(schema, null, 2))

  const resolveOptions = {
    location: schemaPath,
    loaderOptions: {
      processContent: (res: { text: string }, callback: (err: Error | undefined, result: unknown) => void) => {
        callback(undefined, JSON.parse(res.text))
      }
    }
  }

  const { resolved } = await resolveRefs(schema, resolveOptions)

  console.log("\n\nResolved schema:")
  console.log(JSON.stringify(resolved, null, 2).substring(0, 2000))
}

test().catch(console.error)
