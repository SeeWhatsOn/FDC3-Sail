import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
// @ts-ignore - no types available
import { resolveRefs } from "json-refs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface SchemaInfo {
  name: string
  fileName: string
  schema: Record<string, unknown>
  zodCode?: string
}

interface PropertySchema {
  type?: string
  enum?: string[]
  const?: string | number | boolean
  properties?: Record<string, PropertySchema>
  items?: PropertySchema
  required?: string[]
  description?: string
  $ref?: string
  $id?: string
  oneOf?: PropertySchema[]
  anyOf?: PropertySchema[]
  additionalProperties?: boolean
  format?: string
}

async function generateZodSchemas() {
  const schemaDir = path.join(
    __dirname,
    "../../../node_modules/@finos/fdc3-schema/dist/schemas"
  )
  const apiSchemaDir = path.join(schemaDir, "api")
  const outputFile = path.join(__dirname, "../src/handlers/validation/dacp-schemas.ts")

  if (!fs.existsSync(apiSchemaDir)) {
    console.error(`Schema directory not found: ${apiSchemaDir}`)
    return
  }

  console.log(`Loading schemas from ${schemaDir}`)

  const apiSchemaFiles = fs.readdirSync(apiSchemaDir).filter(file => file.endsWith(".schema.json"))

  console.log(`Found ${apiSchemaFiles.length} schema files`)

  let output = `// Auto-generated DACP schemas from @finos/fdc3-schema\n`
  output += `// Generated on: ${new Date().toISOString()}\n`
  output += `// DO NOT EDIT MANUALLY - Run 'npm run generate:schemas' to regenerate\n\n`
  output += `import { z } from "zod"\n\n`

  output += generateCustomSchemas()

  const schemas: SchemaInfo[] = []

  console.log("\nResolving references and converting schemas to Zod...")

  for (const file of apiSchemaFiles) {
    try {
      const schemaPath = path.join(apiSchemaDir, file)
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as PropertySchema
      const name = file.replace(".schema.json", "")

      // Skip base schemas
      if (name === "api" || name === "common" || name === "appRequest" || name === "agentResponse" || name === "agentEvent") {
        console.log(`Skipping base schema: ${name}`)
        continue
      }

      console.log(`Processing: ${name}...`)

      const resolveOptions = {
        location: schemaPath,
        loaderOptions: {
          processContent: (res: { text: string }, callback: (err: Error | undefined, result: unknown) => void) => {
            callback(undefined, JSON.parse(res.text))
          }
        }
      }

      const { resolved } = await resolveRefs(schema, resolveOptions) as { resolved: PropertySchema }

      // Generate clean Zod schema from resolved FDC3 schema
      const zodCode = generateZodFromFDC3Schema(resolved, name)

      if (zodCode) {
        schemas.push({ name, fileName: file, schema: schema as Record<string, unknown>, zodCode })
        output += `// ${toPascalCase(name)} - ${schema.title || name}\n`
        output += `export const ${toPascalCase(name)}Schema = ${zodCode}\n\n`
        output += `export type ${toPascalCase(name)} = z.infer<typeof ${toPascalCase(name)}Schema>\n\n`
        console.log(`✓ Converted: ${name}`)
      }
    } catch (error) {
      console.error(`✗ Failed to convert schema ${file}:`, error)
    }
  }

  output += generateMessageTypeUnion(schemas)

  fs.writeFileSync(outputFile, output)
  console.log(`\n✓ Generated ${schemas.length} schemas to ${outputFile}`)
}

function generateZodFromFDC3Schema(schema: PropertySchema, name: string): string | null {
  // FDC3 uses allOf pattern: [appRequest/agentResponse, specific payload]
  if (schema.allOf && Array.isArray(schema.allOf)) {
    // Extract the specific payload schema (second item in allOf)
    const specificSchema = schema.allOf[1]
    if (!specificSchema || !specificSchema.properties) {
      console.warn(`Could not extract payload from ${name}`)
      return null
    }

    const typeInfo = specificSchema.properties.type
    const payloadInfo = specificSchema.properties.payload
    const metaInfo = specificSchema.properties.meta

    // Determine message category (Request, Response, Event)
    let metaSchema = ""
    if (name.includes("Request") || name.endsWith("Request")) {
      metaSchema = "requestUuid: z.string(), timestamp: z.coerce.date()"
    } else if (name.includes("Response") || name.endsWith("Response")) {
      metaSchema = "responseUuid: z.string(), requestUuid: z.string(), timestamp: z.coerce.date()"
    } else if (name.includes("Event") || name.endsWith("Event")) {
      metaSchema = "eventUuid: z.string(), timestamp: z.coerce.date()"
    } else {
      // WCP or other messages
      metaSchema = "timestamp: z.coerce.date()"
    }

    // Generate type field
    let typeField = ""
    if (typeInfo) {
      if (typeInfo.const) {
        typeField = `type: z.literal("${typeInfo.const}")`
      } else if (typeInfo.enum) {
        const enumValues = typeInfo.enum.map((v: string) => `"${v}"`).join(", ")
        typeField = `type: z.enum([${enumValues}])`
      } else {
        typeField = `type: z.string()`
      }
    }

    // Generate payload field
    let payloadField = "payload: z.unknown().optional()"
    if (payloadInfo && payloadInfo.properties) {
      const payloadZod = generateZodForObject(payloadInfo)
      payloadField = `payload: ${payloadZod}`
    } else if (payloadInfo && payloadInfo.oneOf) {
      // Response payloads often have oneOf for success/error
      const variants = payloadInfo.oneOf.map(v => generateZodForObject(v as PropertySchema))
      payloadField = `payload: z.union([${variants.join(", ")}])`
    }

    return `z.object({\n  ${typeField},\n  ${payloadField},\n  meta: z.object({ ${metaSchema} })\n})`
  }

  // Simple schema without allOf
  return generateZodForObject(schema)
}

function generateZodForObject(schema: PropertySchema, depth = 0): string {
  if (depth > 5) {
    return "z.unknown()"
  }

  // Handle context schema - check $id or if it looks like a context
  if (schema.$id?.includes("context.schema.json")) {
    return "ContextSchema"
  }

  // Detect context pattern: object with required "type" string field
  if (schema.type === "object" &&
      schema.properties?.type?.type === "string" &&
      schema.required?.includes("type") &&
      !schema.properties.payload) { // Not a message
    return "ContextSchema"
  }

  // Handle oneOf
  if (schema.oneOf) {
    const variants = schema.oneOf.map(v => generateZodForObject(v, depth + 1))
    return `z.union([${variants.join(", ")}])`
  }

  // Handle anyOf (treat as union)
  if (schema.anyOf) {
    const variants = schema.anyOf.map(v => generateZodForObject(v, depth + 1))
    return `z.union([${variants.join(", ")}])`
  }

  if (schema.type === "object" && schema.properties) {
    const props: string[] = []
    const required = schema.required || []

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      // Skip properties that are just `true` (allows anything)
      if (propSchema === true || typeof propSchema !== "object") {
        props.push(`${key}: z.unknown().optional()`)
        continue
      }

      const isRequired = required.includes(key)
      let zodType = generateZodForProperty(propSchema, depth + 1)

      if (!isRequired && !zodType.includes(".optional()")) {
        zodType += ".optional()"
      }

      props.push(`${key}: ${zodType}`)
    }

    return `z.object({ ${props.join(", ")} })`
  }

  if (schema.type === "array" && schema.items) {
    const itemType = generateZodForObject(schema.items, depth + 1)
    return `z.array(${itemType})`
  }

  return generateZodForProperty(schema, depth)
}

function generateZodForProperty(schema: PropertySchema, depth = 0): string {
  if (depth > 5) {
    return "z.unknown()"
  }

  // Skip if schema is just `true` (allows anything)
  if (schema === true || typeof schema !== "object") {
    return "z.unknown()"
  }

  // Handle context schema references
  if (schema.$ref?.includes("context.schema.json") || schema.$id?.includes("context.schema.json")) {
    return "ContextSchema"
  }

  // Handle const
  if ("const" in schema && schema.const !== undefined) {
    if (typeof schema.const === "string") {
      return `z.literal("${schema.const}")`
    }
    return `z.literal(${schema.const})`
  }

  // Handle enum
  if (schema.enum) {
    const values = schema.enum.map(v => `"${v}"`).join(", ")
    return `z.enum([${values}])`
  }

  // Handle type
  if (schema.type) {
    switch (schema.type) {
      case "string":
        if (schema.format === "date-time") {
          return "z.coerce.date()"
        }
        if (schema.format === "url" || schema.format === "uri") {
          return "z.string().url()"
        }
        return "z.string()"
      case "number":
      case "integer":
        return "z.number()"
      case "boolean":
        return "z.boolean()"
      case "null":
        return "z.null()"
      case "object":
        if (schema.properties) {
          return generateZodForObject(schema, depth + 1)
        }
        return "z.record(z.unknown())"
      case "array":
        if (schema.items) {
          const itemType = generateZodForObject(schema.items, depth + 1)
          return `z.array(${itemType})`
        }
        return "z.array(z.unknown())"
    }
  }

  // Handle context references
  if (schema.$id?.includes("context.schema.json")) {
    return "ContextSchema"
  }

  // Handle AppIdentifier
  if (schema.$id?.includes("AppIdentifier")) {
    return "AppIdentifierSchema"
  }

  // Handle nested objects
  if (schema.properties) {
    return generateZodForObject(schema, depth)
  }

  // Handle oneOf
  if (schema.oneOf) {
    const variants = schema.oneOf.map(v => generateZodForObject(v, depth + 1))
    return `z.union([${variants.join(", ")}])`
  }

  return "z.unknown()"
}

function toPascalCase(str: string): string {
  if (str.match(/^WCP\d/)) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}

function generateCustomSchemas(): string {
  return `// Custom base schemas and helpers

// Base DACP message structure
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

// Context schema - FDC3 contexts are extensible objects with a type field
// Using passthrough() to allow additional context-specific properties
export const ContextSchema = z.object({
  type: z.string(),
  id: z.record(z.string(), z.unknown()).optional(),
  name: z.string().optional()
}).passthrough()

export type Context = z.infer<typeof ContextSchema>

// AppIdentifier schema - properly typed from FDC3 spec
export const AppIdentifierSchema = z.object({
  appId: z.string(),
  instanceId: z.string().optional(),
  desktopAgent: z.string().optional()
})

export type AppIdentifier = z.infer<typeof AppIdentifierSchema>

// Icon schema
export const IconSchema = z.object({
  src: z.string(),
  size: z.string().optional(),
  type: z.string().optional()
})

// DisplayMetadata schema
export const DisplayMetadataSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  glyph: z.string().optional()
})

`
}

function generateMessageTypeUnion(schemas: SchemaInfo[]): string {
  const schemaNames = schemas
    .filter(s => s.zodCode)
    .map(s => `${toPascalCase(s.name)}Schema`)

  return `// Union of all DACP message schemas
export const DACPMessageSchema = z.union([
  ${schemaNames.join(",\n  ")}
])

export type DACPMessage = z.infer<typeof DACPMessageSchema>

// Message type guards
export function isDACPRequest(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return result.success && typeof message === "object" && message !== null &&
         "type" in message && typeof message.type === "string" &&
         message.type.endsWith("Request")
}

export function isDACPResponse(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return result.success && typeof message === "object" && message !== null &&
         "type" in message && typeof message.type === "string" &&
         message.type.endsWith("Response")
}

export function isDACPEvent(message: unknown): message is BaseDACPMessage {
  const result = BaseDACPMessageSchema.safeParse(message)
  return result.success && typeof message === "object" && message !== null &&
         "type" in message && typeof message.type === "string" &&
         message.type.endsWith("Event")
}
`
}

generateZodSchemas().catch(console.error)
