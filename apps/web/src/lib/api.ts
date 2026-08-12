export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type TickStatus = "Up" | "Down" | "Unknown";

export type Tick = {
  id: string;
  response_time_ms: number;
  status: TickStatus;
  http_status: number | null;
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

export type Incident = {
  id: string;
  website_id: string;
  region_id: string;
  started_at: string;
  ended_at: string | null;
  website: { url: string };
};

export type Periods = { d1: number | null; d7: number | null; d30: number | null };

export type WebsiteStat = {
  website_id: string;
  periods: Periods;
};

export type ComponentStatus = {
  name: string;
  websites: WebsiteWithTicks[];
  stats: Periods;
  status: "Up" | "Down" | "Unknown";
};

export type PublicStatusResponse = {
  components: ComponentStatus[];
  incidents: Incident[];
  websites: WebsiteWithTicks[];
  stats: WebsiteStat[];
};

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
    request<PublicStatusResponse>(`/public/status/${userId}`),
  getWebhook: () => request<{ url: string | null }>("/user/webhook"),
  setWebhook: (url: string) =>
    request<{ ok: true }>("/user/webhook", {
      method: "PATCH",
      body: JSON.stringify({ url }),
    }),
  getIncidents: () => request<{ incidents: Incident[] }>("/incidents"),
};