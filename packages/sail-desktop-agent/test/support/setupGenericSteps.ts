import { DataTable, Given, Then, When } from "@cucumber/cucumber"
import Ajv2019 from "ajv/dist/2019"
import * as draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json"
import addFormats from "ajv-formats"
import expect from "expect"
import fs from "fs"
import path from "path"
import { CustomWorld } from "../world"
import { doesRowMatch, handleResolve, matchData } from "./matching"

function findPackageDir(packageName: string): string {
  const candidates = [
    path.resolve(__dirname, "../../node_modules", packageName),
    path.resolve(__dirname, "../../../../node_modules", packageName),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir
    }
  }
  throw new Error(`Package not found: ${packageName}`)
}

/**
 * Registers shared Cucumber steps used by the FDC3 web-impl style feature files.
 * Local stand-in for the unpublished `@finos/testing` package.
 */
export function setupGenericSteps() {
  Then(
    "the promise {string} should resolve",
    async function (this: CustomWorld, field: string) {
      try {
        const promise = handleResolve(field, this)
        const object = await promise
        this.props["result"] = object
      } catch (error) {
        this.props["result"] = error
      }
    },
  )

  Then(
    "the promise {string} should resolve within 10 seconds",
    { timeout: 10 * 1000 },
    async function (this: CustomWorld, field: string) {
      try {
        const promise = handleResolve(field, this)
        const object = await promise
        this.props["result"] = object
      } catch (error) {
        this.props["result"] = error
      }
    },
  )

  When(
    "I call {string} with {string}",
    async function (this: CustomWorld, field: string, fnName: string) {
      try {
        const object = handleResolve(field, this)
        const fn = object[fnName]
        const result = await fn.call(object)
        this.props["result"] = result
      } catch (error) {
        this.props["result"] = error
      }
    },
  )

  When(
    "I call {string} with {string} with parameter {string}",
    async function (
      this: CustomWorld,
      field: string,
      fnName: string,
      param: string,
    ) {
      try {
        const object = handleResolve(field, this)
        const fn = object[fnName]
        const result = await fn.call(object, handleResolve(param, this))
        this.props["result"] = result
      } catch (error) {
        this.props["result"] = error
      }
    },
  )

  When(
    "I call {string} with {string} with parameters {string} and {string}",
    async function (
      this: CustomWorld,
      field: string,
      fnName: string,
      param1: string,
      param2: string,
    ) {
      try {
        const object = handleResolve(field, this)
        const fn = object[fnName]
        const result = await fn.call(
          object,
          handleResolve(param1, this),
          handleResolve(param2, this),
        )
        this.props["result"] = result
      } catch (error) {
        this.props["result"] = error
      }
    },
  )

  When(
    "I call {string} with {string} with parameters {string} and {string} and {string}",
    async function (
      this: CustomWorld,
      field: string,
      fnName: string,
      param1: string,
      param2: string,
      param3: string,
    ) {
      try {
        const object = handleResolve(field, this)
        const fn = object[fnName]
        const result = await fn.call(
          object,
          handleResolve(param1, this),
          handleResolve(param2, this),
          handleResolve(param3, this),
        )
        this.props["result"] = result
      } catch (error) {
        this.props["result"] = error
      }
    },
  )

  When(
    "I refer to {string} as {string}",
    function (this: CustomWorld, from: string, to: string) {
      this.props[to] = handleResolve(from, this)
    },
  )

  Then(
    "{string} is an array of objects with the following contents",
    function (this: CustomWorld, field: string, dt: DataTable) {
      matchData(this, handleResolve(field, this), dt)
    },
  )

  Then(
    "{string} is an array of objects with length {string}",
    function (this: CustomWorld, field: string, field2: string) {
      expect(handleResolve(field, this).length).toEqual(
        Number.parseInt(handleResolve(field2, this)),
      )
    },
  )

  Then(
    "{string} is an array of strings with the following values",
    function (this: CustomWorld, field: string, dt: DataTable) {
      const values = handleResolve(field, this).map((s: string) => {
        return { value: s }
      })
      matchData(this, values, dt)
    },
  )

  Then(
    "{string} is an object with the following contents",
    function (this: CustomWorld, field: string, params: DataTable) {
      const table = params.hashes()
      expect(
        doesRowMatch(this, table[0], handleResolve(field, this)),
      ).toBeTruthy()
    },
  )

  Then("{string} is null", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toBeNull()
  })

  Then("{string} is not null", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toBeDefined()
  })

  Then("{string} is true", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toBeTruthy()
  })

  Then("{string} is false", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toBeFalsy()
  })

  Then("{string} is undefined", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toBeUndefined()
  })

  Then("{string} is empty", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toHaveLength(0)
  })

  Then(
    "{string} is {string}",
    function (this: CustomWorld, field: string, expected: string) {
      const fVal = handleResolve(field, this)
      const eVal = handleResolve(expected, this)
      expect("" + fVal).toEqual("" + eVal)
    },
  )

  Then(
    "{string} is an error with message {string}",
    function (this: CustomWorld, field: string, errorType: string) {
      expect(handleResolve(field, this)["message"]).toBe(errorType)
    },
  )

  Then("{string} is an error", function (this: CustomWorld, field: string) {
    expect(handleResolve(field, this)).toBeInstanceOf(Error)
  })

  Given(
    "{string} is a invocation counter into {string}",
    function (this: CustomWorld, handlerName: string, field: string) {
      this.props[handlerName] = () => {
        let amount: number = this.props[field]
        amount++
        this.props[field] = amount
      }
      this.props[field] = 0
    },
  )

  Given(
    "{string} is a function which returns a promise of {string}",
    function (this: CustomWorld, fnName: string, field: string) {
      const value = handleResolve(field, this)
      this.props[fnName] = async () => {
        return value
      }
    },
  )

  Given(
    "we wait for a period of {string} ms",
    function (this: CustomWorld, ms: string) {
      return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), parseInt(ms))
      })
    },
  )

  Given("schemas loaded", async function (this: CustomWorld) {
    const ajv = new Ajv2019()
    ajv.addMetaSchema(draft7MetaSchema)
    addFormats(ajv)

    const schemaPkg = findPackageDir("@finos/fdc3-schema")
    const abspath = path.join(schemaPkg, "dist", "schemas", "api")

    try {
      fs.readdirSync(abspath).forEach((file) => {
        if (file.endsWith(".json")) {
          const filePath = path.join(abspath, file)
          const contents = fs.readFileSync(filePath, "utf8")
          const schema = JSON.parse(contents)
          ajv.addSchema(schema)
        }
      })
    } catch (error) {
      console.log(error)
    }

    const contextPkg = findPackageDir("@finos/fdc3-context")
    const contextPath = path.join(
      contextPkg,
      "dist",
      "schemas",
      "context",
      "context.schema.json",
    )
    const contents = fs.readFileSync(contextPath, "utf8")
    const schema = JSON.parse(contents)
    ajv.addSchema(schema)

    this.props["ajv"] = ajv
  })
}
