import { z } from "zod";

/**
 * Zod schema for validating authentication-related request bodies.
 *
 * Used by both the signup and signin endpoints to enforce shape and type constraints
 * before processing credentials.
 *
 * @typedef {Object} AuthInputSchema
 * @property {string} username - The user's desired/existing username.
 * @property {string} password - The user's plain-text password.
 */
export const AuthInput = z.object({
  username: z.string(),
  password: z.string(),
});
