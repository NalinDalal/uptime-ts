import { describe, it, expect, beforeAll } from "bun:test";
import axios from "axios";
import { createUser } from "./testUtils.ts";
import { BACKEND_URL } from "./config.ts";

/**
 * Test suite covering the website creation endpoint (`POST /website`).
 *
 * Verifies:
 * - A website is rejected when the URL body field is missing.
 * - A website is created successfully when a valid URL is provided.
 * - A website is rejected when the `Authorization` header is absent.
 */
describe("Website gets created", () => {
  /** @type {string} JWT for the authenticated test user. */
  let jwt: string, token: string;

  /**
   * Creates a fresh test user and stores its JWT for use across tests in this suite.
   */
  beforeAll(async () => {
    const data = await createUser();
    jwt = data.jwt;
    token = data.jwt;
  });

  /**
   * A website creation request without a `url` field in the body must be rejected.
   */
  it("Website not created if url is not present", async () => {
    try {
      await axios.post(
        `${BACKEND_URL}/website`,
        {},
        {
          headers: {
            Authorization: token,
          },
        },
      );
      expect(false, "Website created when it shouldnt");
    } catch (e) {}
  });

  /**
   * A website creation request with a valid `url` must succeed and return an `id`.
   */
  it("Website is created if url is present", async () => {
    console.log(token);
    const response = await axios.post(
      `${BACKEND_URL}/website`,
      {
        url: "https://google.com",
      },
      {
        headers: {
          Authorization: token,
        },
      },
    );
    expect(response.data.id).not.toBeNull();
  });

  /**
   * A website creation request without an `Authorization` header must be rejected.
   */
  it("Website is not created if header not is present", async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/website`, {
        url: "https://google.com",
      });
      expect(false, "Website shouldn't be created if no auth header");
    } catch (e) {}
  });
});

/**
 * Test suite covering the `GET /status/:websiteId` endpoint.
 *
 * Verifies:
 * - An authenticated user can fetch their own website and that ownership matches.
 * - A user cannot fetch a website owned by a different user.
 */
describe("Can fetch website", () => {
  /** @type {string} JWT for the first authenticated test user. */
  let token1: string, userId1: string;
  /** @type {string} JWT for the second authenticated test user. */
  let token2: string, userId2: string;

  /**
   * Creates two independent test users and stores their credentials.
   */
  beforeAll(async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    token1 = user1.jwt;
    userId1 = user1.id;
    token2 = user2.jwt;
    userId2 = user2.id;
  });

  /**
   * A user can retrieve a website they created, and the returned owner matches their own ID.
   */
  it("is able is retch a website that user created", async () => {
    const websiteResponse = await axios.post(
      `${BACKEND_URL}/website`,
      {
        url: "https://google.com",
      },
      {
        headers: {
          Authorization: token1,
        },
      },
    );
    const getWebsiteResponse = await axios.get(
      `${BACKEND_URL}/status/${websiteResponse.data.id}`,
      {
        headers: {
          Authorization: token1,
        },
      },
    );
    expect(getWebsiteResponse.data.website.id).toBe(websiteResponse.data.id);
    expect(getWebsiteResponse.data.website.user_id).toBe(userId1);
  });

  /**
   * A user must NOT be able to fetch a website that was created by a different user.
   */
  it("cant access website created by other user", async () => {
    //create with token 1, fetch with token2
    const websiteResponse = await axios.post(
      `${BACKEND_URL}/website`,
      {
        url: "https://google.com",
      },
      {
        headers: {
          Authorization: token1,
        },
      },
    );
    try {
      const getWebsiteResponse = await axios.get(
        `${BACKEND_URL}/status/${websiteResponse.data.id}`,
        {
          headers: {
            Authorization: token1,
          },
        },
      );
      expect(
        false,
        "shouldn't be able to access website created by different user",
      );
    } catch (e) {}
  });
});

/**
 * Test suite covering the `GET /websites` endpoint.
 *
 * Verifies that an authenticated user can retrieve the full set of websites they own.
 */
describe("should be able to get all websites", () => {
  /** @type {string} JWT for the authenticated test user. */
  let token: string, userId: string;

  /**
   * Creates a fresh test user and stores their credentials.
   */
  beforeAll(async () => {
    const user1 = await createUser();
    token = user1.jwt;
    userId = user1.id;
  });

  /**
   * After creating two websites, fetching all websites returns exactly those two entries.
   */
  it("can fetch its own set of websites", async () => {
    await axios.post(`${BACKEND_URL}/website`, {
      url: "https://google.com",
    }, {
      headers: {
        Authorization: token
      }
    });
    await axios.post(`${BACKEND_URL}/website`, {
      url: "https://facebook.com",
    }, {
      headers: {
        Authorization: token
      }
    });
    const response = await axios.get(`${BACKEND_URL}/websites`, {
      headers: {
        Authorization: token
      }
    });
    expect(response.data.websites.length == 2, "Incorrect no of website created");
  });
});
