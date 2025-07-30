import { Request, Response } from "express"
import logger from "../utils/logger"

export const errorHandler = (
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  // _next: NextFunction,
) => {
  // Log the error
  logger.error(`Error: ${err.message}`, { error: err })

  // Handle JWT errors
  if (err.name === "UnauthorizedError") {
    return res.status(403).json({
      code: 403,
      message: "Certificate authentication failed for the requested user.",
    })
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      code: 400,
      message: err.message,
    })
  }

  // Default error response
  const statusCode = err.statusCode || 500
  const message = err.message || "Internal Server Error"

  return res.status(statusCode).json({
    code: statusCode,
    message: message,
  })
}
