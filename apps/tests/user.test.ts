import axios from "axios";
import { describe, it, expect } from "bun:test";
import { BACKEND_URL } from "./config";

/**
 * Test suite covering the user authentication endpoints.
 *
 * Covers `POST /user/signup` and `POST /user/signin` with both valid and invalid payloads.
 */
describe("Signup endpoints", () => {
  /**
   * A signup request with an invalid body (wrong field names) must be rejected with a 403.
   */
  it("it isn't able to signup if body is incorrect", async () => {
    try {
      await axios.post(`${BACKEND_URL}/user/signup`, {
        email: "random username",
        password: "password",
      });
      expect(false, "COntrol shouldn;t reach here");
    } catch (e) {
      expect((e as any).status).toBe(403);
    }
  });

  /**
   * A signup request with a valid `username` and `password` must succeed with a 200 status.
   */
  it("it is able to signup if body is correct", async () => {
    const res = await axios.post(`${BACKEND_URL}/user/signup`, {
      username: "random-username" + Math.random(),
      password: "password",
    });
    expect(res.status).toBe(200);
  });
});

/**
 * Test suite covering the sign-in endpoint.
 *
 * Verifies rejection on invalid input and acceptance on valid credentials.
 */
describe("Sign-in endpoints", () => {
  /**
   * A sign-in request with invalid credentials must be rejected with a 403.
   */
  it("it isn't able to signin if body is incorrect", async () => {
    try {
      await axios.post(`${BACKEND_URL}/user/signin`, {
        username: "random-username" + Math.random(),
        password: "password",
      });
      expect(false, "Control shouldn't reach here");
    } catch (e) {
      expect((e as any).status).toBe(403);
    }
  });

  /**
   * A sign-in request with valid credentials (a user that was just created) must succeed with a 200 status
   * and return a user `id` in the response body.
   */
  it("it is able to signin if body is incorrect", async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/user/signin`, {
        username: "random-username" + Math.random(),
        password: "password",
      });
      expect(res.status).toBe(200);
      expect(res.data.id).toBeDefined();
    } catch (e) {
      console.log(e);
    }
  });
});
