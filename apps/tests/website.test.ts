import { describe, it, expect } from "bun:test";
import axios from "axios";
import { createUser } from "./testUtils.ts";

let BASE_URL = "http://localhost:3001";

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
        `${BASE_URL}/website`,
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
        console.log(token)
    const response = await axios.post(
      `${BASE_URL}/website`,
      {
        url: "https://google.com",
      },
      {
        headers: {
          Authorization: token,
        },
      }
    );
    expect(response.data.id).not.toBeNull();
  });

     it("Website is not created if header not is present", async () => {
    try{const response = await axios.post(
      `${BASE_URL}/website`,
      {
        url: "https://google.com",
      }
    );
    expect(false,"Website shouldn't be created if no auth header");
  }catch(e){

        }};


});
