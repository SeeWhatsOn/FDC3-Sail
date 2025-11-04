import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface SchemaInfo {
  name: string
  fileName: string
  schema: unknown
}

function generateZodSchemas() {
  // Find all DACP schema files
  const schemaDir = path.join(
    __dirname,
    "../../../node_modules/@finos/fdc3-schema/dist/schemas/api"
  )
  const outputFile = path.join(__dirname, "../src/handlers/validation/dacp-schemas.ts")

  if (!fs.existsSync(schemaDir)) {
    console.error(`Schema directory not found: ${schemaDir}`)
    console.log("Available paths:")
    const nodeModulesPath = path.join(__dirname, "../../../node_modules/@finos")
    if (fs.existsSync(nodeModulesPath)) {
      fs.readdirSync(nodeModulesPath).forEach(dir => {
        console.log(`  ${dir}`)
      })
    }
    return
  }

  const schemaFiles = fs.readdirSync(schemaDir).filter(file => file.endsWith(".schema.json"))

  console.log(`Found ${schemaFiles.length} schema files in ${schemaDir}`)

  let output = `// Auto-generated DACP schemas from @finos/fdc3-schema\n`
  output += `// Generated on: ${new Date().toISOString()}\n`
  output += `import { z } from 'zod'\n\n`

  const schemas: SchemaInfo[] = []

  // Load all schemas
  for (const file of schemaFiles) {
    try {
      const schemaPath = path.join(schemaDir, file)
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"))
      const name = file.replace(".schema.json", "")
      schemas.push({ name, fileName: file, schema })
      console.log(`Loaded schema: ${name}`)
    } catch (error) {
      console.warn(`Failed to load schema ${file}:`, error)
    }
  }

  // Generate base message schema first
  output += generateBaseMessageSchema()

  // Generate individual schemas
  for (const { name, schema } of schemas) {
    const schemaName = toPascalCase(name)
    output += generateZodFromJsonSchema(schemaName, schema, name)
  }

  // Generate message type union
  output += generateMessageTypeUnion(schemas)

  // Write output file
  fs.writeFileSync(outputFile, output)
  console.log(`Generated ${schemas.length} schemas to ${outputFile}`)
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("")
}

function generateBaseMessageSchema(): string {
  return `// Base DACP message structure
export const BaseDACPMessageSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type BaseDACPMessage = z.infer<typeof BaseDACPMessageSchema>

// Context schema (simplified for now)
export const ContextSchema = z.object({
  type: z.string(),
  id: z.record(z.unknown()).optional(),
  name: z.string().optional()
}).passthrough() // Allow additional properties

`
}

function generateZodFromJsonSchema(
  schemaName: string,
  _schema: unknown,
  originalName: string
): string {
  console.log(`Generating schema for: ${schemaName}`)

  // For now, we'll create simplified schemas based on common DACP patterns
  // This can be enhanced later with full JSON Schema to Zod conversion

  if (originalName.includes("Request")) {
    return generateRequestSchema(schemaName, originalName)
  } else if (originalName.includes("Response")) {
    return generateResponseSchema(schemaName, originalName)
  } else if (originalName.includes("Event")) {
    return generateEventSchema(schemaName, originalName)
  }

  // Generic schema
  return `// ${schemaName} (generic)
export const ${schemaName}Schema = z.object({
  type: z.literal('${originalName}'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>

`
}

function generateRequestSchema(schemaName: string, originalName: string): string {
  const payloadSchema = getPayloadSchemaForRequest(originalName)

  return `// ${schemaName}
export const ${schemaName}Schema = z.object({
  type: z.literal('${originalName}'),
  payload: ${payloadSchema},
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>

`
}

function generateResponseSchema(schemaName: string, originalName: string): string {
  const payloadSchema = getPayloadSchemaForResponse(originalName)

  return `// ${schemaName}
export const ${schemaName}Schema = z.object({
  type: z.literal('${originalName}'),
  payload: ${payloadSchema},
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>

`
}

function generateEventSchema(schemaName: string, originalName: string): string {
  return `// ${schemaName}
export const ${schemaName}Schema = z.object({
  type: z.literal('${originalName}'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>

`
}

function getPayloadSchemaForRequest(requestType: string): string {
  switch (requestType) {
    case "broadcastRequest":
      return `z.object({
        channelId: z.string(),
        context: ContextSchema
      })`

    case "addContextListenerRequest":
      return `z.object({
        channelId: z.string().optional(),
        contextType: z.string().optional()
      })`

    case "raiseIntentRequest":
      return `z.object({
        intent: z.string(),
        context: ContextSchema,
        app: z.string().optional()
      })`

    case "addIntentListenerRequest":
      return `z.object({
        intent: z.string()
      })`

    case "getCurrentChannelRequest":
      return `z.object({}).optional()`

    case "joinUserChannelRequest":
      return `z.object({
        channelId: z.string()
      })`

    case "findInstancesRequest":
      return `z.object({
        app: z.string()
      })`

    case "getInfoRequest":
      return `z.object({}).optional()`

    default:
      return `z.unknown().optional()`
  }
}

function getPayloadSchemaForResponse(responseType: string): string {
  switch (responseType) {
    case "broadcastResponse":
      return `z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ])`

    case "addContextListenerResponse":
      return `z.union([
        z.object({ listenerId: z.string() }), // Success
        z.object({ error: z.string() }) // Error
      ])`

    case "raiseIntentResponse":
      return `z.union([
        z.object({
          intentResult: z.unknown().optional(),
          source: z.string().optional()
        }), // Success
        z.object({ error: z.string() }) // Error
      ])`

    case "getCurrentChannelResponse":
      return `z.union([
        z.object({ channel: z.string().nullable() }), // Success
        z.object({ error: z.string() }) // Error
      ])`

    default:
      return `z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ])`
  }
}

function generateMessageTypeUnion(schemas: SchemaInfo[]): string {
  const schemaNames = schemas.map(s => `${toPascalCase(s.name)}Schema`)

  return `// Union of all DACP message schemas
export const DACPMessageSchema = z.union([
  ${schemaNames.join(",\n  ")}
])

export type DACPMessage = z.infer<typeof DACPMessageSchema>

// Message type guards
export function isDACPRequest(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return result.success && typeof message === 'object' && message !== null &&
         'type' in message && typeof message.type === 'string' &&
         message.type.endsWith('Request')
}

export function isDACPResponse(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return result.success && typeof message === 'object' && message !== null &&
         'type' in message && typeof message.type === 'string' &&
         message.type.endsWith('Response')
}

export function isDACPEvent(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return result.success && typeof message === 'object' && message !== null &&
         'type' in message && typeof message.type === 'string' &&
         message.type.endsWith('Event')
}
`
}

// Run the generator
generateZodSchemas()
