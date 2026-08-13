/**
 * Extends the Express `Request` interface to include a custom `userId` property.
 *
 * This property is populated by `authMiddleware` after a JWT has been verified.
 * Declaring it here allows TypeScript to recognize `req.userId` throughout the application
 * without implicit-any or type errors.
 */
declare namespace Express {
  export interface Request {
    /** The internal UUID of the authenticated user, populated by `authMiddleware`. */
    userId?: string;
  }
}
