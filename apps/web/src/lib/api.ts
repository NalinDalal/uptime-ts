/** Base URL for the backend API. Overridable via `NEXT_PUBLIC_API_URL` at build time. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Possible health statuses a website tick can report.
 *
 * @typedef {"Up" | "Down" | "Unknown"} TickStatus
 */

/**
 * A single uptime check record (website tick).
 *
 * @typedef {Object} Tick
 * @property {string} id - Internal UUID of the tick.
 * @property {number} response_time_ms - HTTP round-trip time in milliseconds.
 * @property {TickStatus} status - Determined health status for this check.
 * @property {number | null} http_status - Raw HTTP status code returned by the server.
 * @property {string} created_at - ISO timestamp when the tick was recorded.
 * @property {string} region_id - The region from which the check was performed.
 * @property {string} website_id - The internal UUID of the website this tick belongs to.
 */

/**
 * A registered website being monitored.
 *
 * @typedef {Object} Website
 * @property {string} id - Internal UUID of the website.
 * @property {string} url - The URL being monitored.
 * @property {string} user_id - Internal UUID of the owning user.
 * @property {string} time_added - ISO timestamp when the website was added.
 * @property {Tick[]} [ticks] - Optional array of recent ticks (included on demand via API).
 */

/**
 * A website record with its associated ticks eagerly loaded.
 *
 * @typedef {Website & { ticks: Tick[] }} WebsiteWithTicks
 */

/**
 * An incident record representing a period of downtime.
 *
 * @typedef {Object} Incident
 * @property {string} id - Internal UUID of the incident.
 * @property {string} website_id - Internal UUID of the affected website.
 * @property {string} region_id - Region where the incident was detected.
 * @property {string} started_at - ISO timestamp when the incident began.
 * @property {string | null} ended_at - ISO timestamp when the incident resolved, or `null` if still ongoing.
 * @property {{ url: string }} website - Minimal website reference included by the API.
 */

/**
 * A scheduled or in-progress maintenance window.
 *
 * @typedef {Object} Maintenance
 * @property {string} id - Internal UUID of the maintenance record.
 * @property {string} website_id - Internal UUID of the affected website.
 * @property {string} title - Human-readable title for the maintenance.
 * @property {string} description - Detailed description of the maintenance work.
 * @property {string} starts_at - ISO timestamp when the maintenance begins.
 * @property {string | null} ends_at - ISO timestamp when the maintenance ends, or `null` if not yet scheduled.
 * @property {string} status - Current status of the maintenance (`"scheduled"`, `"in_progress"`, etc.).
 * @property {{ url: string }} website - Minimal website reference included by the API.
 */

/**
 * Uptime percentages across three standard time periods.
 *
 * @typedef {Object} Periods
 * @property {number | null} d1 - Uptime percentage over the last 24 hours.
 * @property {number | null} d7 - Uptime percentage over the last 7 days.
 * @property {number | null} d30 - Uptime percentage over the last 30 days.
 */

/**
 * Aggregated uptime statistics for a single website.
 *
 * @typedef {Object} WebsiteStat
 * @property {string} website_id - Internal UUID of the website.
 * @property {Periods} periods - Uptime percentages across time periods.
 */

/**
 * A status component grouping websites together with their aggregate stats.
 *
 * @typedef {Object} ComponentStatus
 * @property {string} name - The component name (or `"Uncategorized"`).
 * @property {WebsiteWithTicks[]} websites - Websites belonging to this component.
 * @property {Periods} stats - Aggregated uptime statistics for the component.
 * @property {"Up" | "Down" | "Unknown"} status - Overall status derived from the most recent tick.
 */

/**
 * The top-level response for the public status page endpoint.
 *
 * @typedef {Object} PublicStatusResponse
 * @property {ComponentStatus[]} components - Websites grouped by component.
 * @property {Incident[]} incidents - Recent incidents (up to 10).
 * @property {Maintenance[]} maintenances - Active/upcoming maintenances (up to 20).
 * @property {WebsiteWithTicks[]} websites - All monitored websites with their latest ticks.
 * @property {WebsiteStat[]} stats - Per-website uptime statistics.
 */

/**
 * A single entry in the status history timeline.
 *
 * @typedef {({ type: "incident" } & Incident) | { type: "maintenance"; id: string; website_url: string; started_at: string; ended_at: string | null; title: string; status: string }} HistoryItem
 */

/**
 * The top-level response for the public status history endpoint.
 *
 * @typedef {Object} HistoryResponse
 * @property {HistoryItem[]} history - Combined and sorted incident/maintenance timeline entries.
 */

/** @type {string} LocalStorage key used to persist the user's JWT token. */
const TOKEN_KEY = "uptime_token";

/**
 * Reads the stored JWT from the browser's LocalStorage.
 *
 * Returns `null` when running on the server (SSR) to avoid `ReferenceError`.
 *
 * @returns {string | null} The raw JWT string, or `null` if not found or running server-side.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Persists a JWT token into the browser's LocalStorage.
 *
 * @param {string} token - The JWT string to store.
 */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Removes the stored JWT from LocalStorage (e.g. on sign-out).
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Internal helper that performs a raw HTTP request to the backend API.
 *
 * Automatically attaches the `Authorization` header from LocalStorage when a token is present.
 * Clears the stored token if the server responds with a 403.
 * Throws on any non-2xx response.
 *
 * @template T
 * @param {string} path - API path (e.g. `"/user/signup"`).
 * @param {RequestInit} [options={}] - Additional fetch options (method, body, extra headers, etc.).
 * @returns {Promise<T>} Parsed JSON response body.
 * @throws {Error} If the response status is not `ok` (2xx).
 */
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

/**
 * Typed collection of all API methods available to the frontend.
 *
 * Each method returns a `Promise` that resolves to the parsed JSON response body.
 *
 * @type {{
 *   signup: (username: string, password: string) => Promise<{ id: string }>;
 *   signin: (username: string, password: string) => Promise<{ jwt: string }>;
 *   createWebsite: (url: string) => Promise<{ id: string }>;
 *   getWebsites: () => Promise<{ websites: Website[] }>;
 *   getWebsiteStatus: (id: string) => Promise<{ website: WebsiteWithTicks }>;
 *   getPublicStatus: (userId: string) => Promise<PublicStatusResponse>;
 *   getHistory: (userId: string) => Promise<HistoryResponse>;
 *   getMaintenances: () => Promise<{ maintenances: Maintenance[] }>;
 *   getWebhook: () => Promise<{ url: string | null }>;
 *   setWebhook: (url: string) => Promise<{ ok: true }>;
 *   getIncidents: () => Promise<{ incidents: Incident[] }>;
 * }}
 */
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
  getHistory: (userId: string) =>
    request<HistoryResponse>(`/public/status/${userId}/history`),
  getMaintenances: () =>
    request<{ maintenances: Maintenance[] }>("/maintenance"),
  getWebhook: () => request<{ url: string | null }>("/user/webhook"),
  setWebhook: (url: string) =>
    request<{ ok: true }>("/user/webhook", {
      method: "PATCH",
      body: JSON.stringify({ url }),
    }),
  getIncidents: () => request<{ incidents: Incident[] }>("/incidents"),
};
