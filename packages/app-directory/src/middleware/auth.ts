import { expressjwt } from "express-jwt"
import { Request, Response, NextFunction } from "express"

// JWT authentication middleware
export const jwtAuth = expressjwt({
  secret: process.env.JWT_SECRET || "your-secret-key",
  algorithms: ["HS256"],
  credentialsRequired: false, // Set to true to require authentication
})
// Add this middleware to routes that require authentication
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.auth) {
    return res.status(403).json({
      code: 403,
      message: "Authentication required",
    })
  }
  next()
  return
}
