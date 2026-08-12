export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type TickStatus = "Up" | "Down" | "Unknown";

export type Tick = {
  id: string;
  response_time_ms: number;
  status: TickStatus;
  created_at: string;
  region_id: string;
  website_id: string;
};

export type Website = {
  id: string;
  url: string;
  user_id: string;
  time_added: string;
  ticks?: Tick[];
};

export type WebsiteWithTicks = Website & { ticks: Tick[] };

const TOKEN_KEY = "uptime_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = token;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 403 && token) {
    clearToken();
  }

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  signup: (username: string, password: string) =>
    request<{ id: string }>("/user/signup", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  signin: (username: string, password: string) =>
    request<{ jwt: string }>("/user/signin", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  createWebsite: (url: string) =>
    request<{ id: string }>("/website", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  getWebsites: () => request<{ websites: Website[] }>("/websites"),
  getWebsiteStatus: (id: string) =>
    request<{ website: WebsiteWithTicks }>(`/status/${id}`),
  getPublicStatus: (userId: string) =>
    request<{ websites: WebsiteWithTicks[] }>(`/public/status/${userId}`),
};