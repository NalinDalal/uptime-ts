import axios from "axios";
import { BACKEND_URL } from "./config";

const USER_NAME = Math.random().toString();
export async function createUser(): Promise<{
  id: string; //returns user id
  jwt: string;
}> {
  const res = await axios.post(`${BACKEND_URL}/user/signup`, {
    username: USER_NAME,
    password: "123123123",
  });
  const signinRes = await axios.post(`${BACKEND_URL}/user/signup`, {
    username: USER_NAME,
    password: "123123123",
  });
  return {
    id: res.data.id,
    jwt: signinRes.data.jwt,
  };
}
