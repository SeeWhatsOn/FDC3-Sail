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

  const resolveOptions = {
    location: schemaPath,
    loaderOptions: {
      processContent: (res: { text: string }, callback: (err: Error | undefined, result: unknown) => void) => {
        callback(undefined, JSON.parse(res.text))
      }
    }
  }

  const { resolved } = await resolveRefs(schema, resolveOptions)

  // Navigate to the context field
  const contextField = resolved.allOf[1].properties.payload.properties.context

  console.log("Context field:")
  console.log(JSON.stringify(contextField, null, 2))
}

test().catch(console.error)
