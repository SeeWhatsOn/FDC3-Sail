import request from "supertest"
import app from "../app"

describe("App Directory API", () => {
  // Test the health check endpoint
  describe("GET /health", () => {
    it("should return 200 OK", async () => {
      const response = await request(app).get("/health")
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ status: "ok" })
    })
  })

  // Test getting all applications
  describe("GET /appd/v2/apps", () => {
    it("should return all applications", async () => {
      const response = await request(app).get("/appd/v2/apps")
      expect(response.status).toBe(200)
      expect(response.body.applications).toBeDefined()
      expect(Array.isArray(response.body.applications)).toBe(true)
    })
  })

  // Test getting application by ID
  describe("GET /appd/v2/apps/:appId", () => {
    it("should return a specific application", async () => {
      const response = await request(app).get("/appd/v2/apps/fdc3-workbench")
      expect(response.status).toBe(200)
      expect(response.body.appId).toBe("fdc3-workbench")
    })

    it("should return 404 for non-existent application", async () => {
      const response = await request(app).get("/appd/v2/apps/non-existent-app")
      expect(response.status).toBe(404)
    })
  })
})
