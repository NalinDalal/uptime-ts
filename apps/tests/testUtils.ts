import axios from "axios";
import { BACKEND_URL } from "./config";

/** @type {string} Fixed username prefix; a random suffix is appended per call to avoid collisions. */
const USER_NAME = Math.random().toString();

/**
 * Creates a new test user via the signup endpoint and authenticates them.
 *
 * Useful for integration tests that require an authenticated user context.
 *
 * @returns {Promise<{ id: string; jwt: string }>} The newly created user's ID and a valid JWT.
 */
export async function createUser(): Promise<{
  id: string; //returns user id
  jwt: string;
}> {
  const username = USER_NAME + Math.random();
  const res = await axios.post(`${BACKEND_URL}/user/signup`, {
    username,
    password: "123123123",
  });
  const signinRes = await axios.post(`${BACKEND_URL}/user/signin`, {
    username,
    password: "123123123",
  });
  return {
    id: res.data.id,
    jwt: signinRes.data.jwt,
  };
}
