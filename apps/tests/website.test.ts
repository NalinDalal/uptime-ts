import { describe, it, expect } from "bun:test";
import axios from "axios";
import { createUser } from "./testUtils.ts";
import { BACKEND_URL } from "./config.ts";

describe("Website gets created", () => {
  let jwt: string, token: string;

  beforeAll(async () => {
    const data = await createUser();
    jwt = data.jwt;
    token = data.jwt;
  });

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

  it("Website is not created if header not is present", async () => {
    try {
      const response = await axios.post(`${BASE_URL}/website`, {
        url: "https://google.com",
      });
      expect(false, "Website shouldn't be created if no auth header");
    } catch (e) {}
  });
});

describe("Can fetch website", () => {
  let token1: string, userId1: string;
  let token2: string, userId2: string;
  beforeAll(async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    token1 = user1.jwt;
    userId1 = user1.id;
    token2 = user2.jwt;
    userId2 = user2.id;
  });

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
      `${BASE_URL}/status/${websiteResponse.data.id}`,
      {
        headers: {
          Authorization: token1,
        },
      },
    );
    expect(getWebsiteResponse.data.website.id).toBe(websiteResponse.data.id);
    expect(getWebsiteResponse.data.website.user_id).toBe(userId1);
  });

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
