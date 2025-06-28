import axios from "axios";
import { describe, it, expect } from "bun:test";
import { BACKEND_URL } from "./config";

describe("Signup endpoints", () => {
  //incorrect case
  it("it isn't able to signup if body is incorrect", async () => {
    try {
      await axios.post(`${BACKEND_URL}/user/signup`, {
        email: "random username",
        password: "password",
      });
      expect(false, "COntrol shouldn;t reach here");
    } catch (e) {
      console.log(e);
      expect(e.status).toBe(403);
    }
  });

  //correct case
  it("it is able to signup if body is correct", async () => {
    const res = await axios.post(`${BACKEND_URL}/user/signup`, {
      email: "random username",
      password: "password",
    });
    expect(res.status).toBe(200);
  });
});

describe("Sign-in endpoints", () => {
  it("it isn't able to signin if body is incorrect", async () => {
    try {
      await axios.post(`${BACKEND_URL}/user/signin`, {
        email: "random username",
        password: "password",
      });
      expect(false, "Control shouldn't reach here");
    } catch (e) {
      console.log(e);
      expect(e.status).toBe(403);
    }
  });

  it("it is able to signin if body is incorrect", async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/user/signin`, {
        email: "random username",
        password: "password",
      });
      expect(res.status).toBe(200);
      expect(res.data.id).toBeDefined();
    } catch (e) {
      console.log(e);
    }
  });
});
