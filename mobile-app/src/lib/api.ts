import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from "../config/constants";
import { NativeModules, Platform } from "react-native";
import type {
  AdminDriver,
  DriverInsights,
  ApiEnvelope,
  AuthPayload,
  FinalizeTrip,
  HealthPayload,
  ReviewDashboardItem,
  TripRoute,
  TripDetail,
  ReviewTrip,
  SensorSample,
  Session,
  TripSampleCount,
  Trip,
  User,
  LiveAlertMessage,
  WeatherPayload,
  TripTelemetry,
  AdminLiveTrip
} from "../types/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /**
   * Skip the multi-candidate base-URL fallback and try only the configured
   * URL. Used for high-frequency uploads on flaky connections (rural areas)
   * where probing every candidate would block the queue for minutes.
   */
  singleCandidate?: boolean;
};

const REQUEST_TIMEOUT_MS = 30000;
const CONNECTIVITY_TIMEOUT_MS = 5000;
const LOCALHOST_HOSTS = new Set(["127.0.0.1", "localhost"]);
let lastSuccessfulBaseUrl: string | null = null;

function normalizeBaseUrl(url: string) {
  return normalizeApiBaseUrl(url);
}

function extractHost(url: string) {
  const match = url.match(/^[a-z]+:\/\/([^/:]+)/i);
  return match?.[1]?.toLowerCase() || null;
}

function inferBundlerHost() {
  const sourceCode = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode;
  const scriptUrl = sourceCode?.scriptURL;
  if (!scriptUrl) {
    return null;
  }
  const match = scriptUrl.match(/^[a-z]+:\/\/([^/:]+)/i);
  return match?.[1]?.toLowerCase() || null;
}

function buildBaseUrl(host: string) {
  return `http://${host}:8000/api/v1`;
}

function getCandidateBaseUrls(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  const prioritized: string[] = [];

  if (lastSuccessfulBaseUrl) {
    prioritized.push(lastSuccessfulBaseUrl);
  }

  if (!__DEV__) {
    prioritized.push(normalized);
    return [...new Set(prioritized.map(normalizeBaseUrl))];
  }

  const host = extractHost(normalized);
  const bundlerHost = inferBundlerHost();
  const candidates: string[] = [...prioritized, normalized];

  if (bundlerHost && !LOCALHOST_HOSTS.has(bundlerHost)) {
    candidates.push(buildBaseUrl(bundlerHost));
  }

  if (Platform.OS === "android") {
    candidates.push("http://127.0.0.1:8000/api/v1");
    candidates.push("http://10.0.2.2:8000/api/v1");
  }

  if (host && !LOCALHOST_HOSTS.has(host)) {
    candidates.push("http://127.0.0.1:8000/api/v1");
  }

  return [...new Set(candidates.map(normalizeBaseUrl))];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      fetch(url, init),
      new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, baseUrl = DEFAULT_API_BASE_URL, timeoutMs = REQUEST_TIMEOUT_MS, singleCandidate = false } = options;
  const candidateBaseUrls = singleCandidate ? [getCandidateBaseUrls(baseUrl)[0]] : getCandidateBaseUrls(baseUrl);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  let response: Response | null = null;
  const networkErrors: string[] = [];

  for (const candidateBaseUrl of candidateBaseUrls) {
    try {
      response = await fetchWithTimeout(`${candidateBaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      }, timeoutMs);
      lastSuccessfulBaseUrl = candidateBaseUrl;
      break;
    } catch (error) {
      if (error instanceof Error && error.message === "Request timed out") {
        networkErrors.push(`timeout on ${candidateBaseUrl}`);
        continue;
      }
      if (error instanceof Error) {
        networkErrors.push(`${candidateBaseUrl}: ${error.message}`);
        continue;
      }
      networkErrors.push(`${candidateBaseUrl}: unknown network error`);
    }
  }

  if (!response) {
    const detail = networkErrors.length ? ` Tried ${networkErrors.join(" | ")}.` : "";
    throw new Error(`Could not reach backend. Check backend URL/network and try again.${detail}`);
  }

  if (!response.ok) {
    const fallback = `Request failed: ${response.status}`;
    const rawError = await response.text();
    let message = rawError || fallback;

    try {
      const errorData = rawError ? JSON.parse(rawError) : null;
      // Backend returns custom ErrorResponse: { ok: false, error: { message_key, details }, request_id }
      // FastAPI's HTTPException: { detail: string | object }
      const nestedError = errorData?.error;
      if (typeof errorData?.detail === "string") {
        message = errorData.detail;
      } else if (typeof nestedError?.message_key === "string") {
        message = nestedError.details
          ? `${nestedError.message_key} — ${JSON.stringify(nestedError.details)}`
          : nestedError.message_key;
      } else if (typeof errorData?.detail === "object" && errorData.detail !== null) {
        message = errorData.detail.message || JSON.stringify(errorData.detail);
      } else if (errorData?.request_id) {
        message = `Server error (${errorData.request_id.slice(0, 8)}…)`;
      } else {
        message = rawError || fallback;
      }
    } catch {
      message = rawError || fallback;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  if (!raw) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
}

export async function getHealth(baseUrl: string) {
  return request<ApiEnvelope<HealthPayload>>("/health", { baseUrl, timeoutMs: CONNECTIVITY_TIMEOUT_MS });
}

export async function login(baseUrl: string, email: string, password: string) {
  return request<ApiEnvelope<AuthPayload>>("/auth/login", {
    method: "POST",
    body: { email, password },
    baseUrl
  });
}

export async function register(baseUrl: string, email: string, password: string) {
  return request<ApiEnvelope<{ user: User }>>("/auth/register", {
    method: "POST",
    body: { email, password },
    baseUrl
  });
}

export async function me(baseUrl: string, session: Session) {
  return request<ApiEnvelope<{ user: User }>>("/auth/me", {
    token: session.token.access_token,
    baseUrl,
    timeoutMs: CONNECTIVITY_TIMEOUT_MS
  });
}

export async function getActiveTrip(baseUrl: string, token: string) {
  return request<Trip | null>("/trips/active", { token, baseUrl });
}

export async function listTrips(baseUrl: string, token: string) {
  return request<Trip[]>("/trips", { token, baseUrl });
}

export async function startTrip(baseUrl: string, token: string) {
  return request<Trip>("/trips/start", { method: "POST", token, baseUrl });
}

export async function endTrip(baseUrl: string, token: string, tripId: string) {
  return request<Trip>(`/trips/${tripId}/end`, { method: "POST", token, baseUrl });
}

export const UPLOAD_TIMEOUT_MS = 12000;

export async function uploadSamples(
  baseUrl: string,
  token: string,
  tripId: string,
  samples: unknown[]
) {
  return request<{ inserted: number }>(`/trips/${tripId}/samples`, {
    method: "POST",
    body: { samples },
    token,
    baseUrl,
    // Fast-fail on rural connections: a short timeout plus a single candidate
    // lets the outbox retry quickly instead of blocking on slow probes.
    timeoutMs: UPLOAD_TIMEOUT_MS,
    singleCandidate: true
  });
}

export async function listTripSamples(baseUrl: string, token: string, tripId: string, limit = 1) {
  return request<SensorSample[]>(`/trips/${tripId}/samples?limit=${limit}`, {
    token,
    baseUrl
  });
}

export async function getTripSampleCount(baseUrl: string, token: string, tripId: string) {
  return request<TripSampleCount>(`/trips/${tripId}/samples/count`, {
    token,
    baseUrl
  });
}

export async function getWeather(baseUrl: string, token: string, lat: number, lon: number) {
  return request<WeatherPayload>(`/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
    token,
    baseUrl,
    timeoutMs: 12000
  });
}

export async function getTripTelemetry(baseUrl: string, token: string, tripId: string) {
  return request<TripTelemetry>(`/trips/${tripId}/telemetry`, {
    token,
    baseUrl,
    timeoutMs: 12000
  });
}

export async function finalizeTrip(baseUrl: string, token: string, tripId: string) {
  return request<FinalizeTrip>(`/trips/${tripId}/finalize`, {
    method: "POST",
    token,
    baseUrl
  });
}

export async function reprocessTrip(baseUrl: string, token: string, tripId: string) {
  return request<FinalizeTrip>(`/trips/${tripId}/reprocess`, {
    method: "POST",
    token,
    baseUrl
  });
}

export async function getReviewDashboard(baseUrl: string, token: string) {
  return request<ReviewDashboardItem[]>("/trips/review-dashboard", { token, baseUrl });
}

export async function getTripReview(baseUrl: string, token: string, tripId: string) {
  return request<ReviewTrip>(`/trips/${tripId}/review`, { token, baseUrl });
}

export async function getTripDetail(baseUrl: string, token: string, tripId: string) {
  return request<TripDetail>(`/trips/${tripId}`, { token, baseUrl });
}

export async function getTripRoute(baseUrl: string, token: string, tripId: string) {
  return request<TripRoute>(`/trips/${tripId}/route`, { token, baseUrl });
}

export async function submitReviewLabel(
  baseUrl: string,
  token: string,
  tripId: string,
  reviewedLabel: number | null,
  reviewNotes: string
) {
  return request<ReviewTrip>(`/trips/${tripId}/review-label`, {
    method: "POST",
    token,
    baseUrl,
    body: {
      reviewed_label: reviewedLabel,
      reviewed_label_source: "human_review",
      review_notes: reviewNotes || null
    }
  });
}

export async function listAllTrips(baseUrl: string, token: string) {
  return request<Trip[]>("/admin/trips", { token, baseUrl });
}

export async function getAdminLiveTrips(baseUrl: string, token: string) {
  return request<AdminLiveTrip[]>("/admin/trips/live", { token, baseUrl, timeoutMs: 12000 });
}


export async function getAdminTripRoute(baseUrl: string, token: string, tripId: string) {
  return request<TripRoute>(`/admin/trips/${tripId}/route`, { token, baseUrl });
}


export async function getAdminDrivers(baseUrl: string, token: string) {
  return request<AdminDriver[]>("/admin/drivers", { token, baseUrl });
}

export async function getAdminDriverTrips(baseUrl: string, token: string, driverId: string) {
  return request<Trip[]>(`/admin/drivers/${driverId}/trips`, { token, baseUrl });
}

export async function getAdminDriverInsights(baseUrl: string, token: string, driverId: string) {
  return request<DriverInsights>(`/admin/drivers/${driverId}/insights`, { token, baseUrl });
}

export async function getAdminDriverTripRoute(baseUrl: string, token: string, driverId: string, tripId: string) {
  return request<TripRoute>(`/admin/drivers/${driverId}/trips/${tripId}/route`, { token, baseUrl });
}

export async function updateAdminDriver(
  baseUrl: string,
  token: string,
  driverId: string,
  updates: { email?: string; password?: string }
) {
  return request<AdminDriver>(`/admin/drivers/${driverId}`, {
    method: "PATCH",
    token,
    baseUrl,
    body: updates
  });
}

export async function deleteAdminDriver(baseUrl: string, token: string, driverId: string) {
  return request<void>(`/admin/drivers/${driverId}`, {
    method: "DELETE",
    token,
    baseUrl
  });
}

/**
 * Convert an http(s) API base URL into the equivalent ws(s) alert-stream URL.
 */
function toAlertSocketUrl(baseUrl: string, token: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  const wsScheme = normalized.startsWith("https") ? "wss" : "ws";
  return `${wsScheme}://${normalized.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/ws/alerts?token=${encodeURIComponent(token)}`;
}

export type AlertSocketHandle = {
  close: () => void;
  readyState: () => number;
};

export function openAlertSocket(
  baseUrl: string,
  token: string,
  onMessage: (message: LiveAlertMessage) => void,
  onOpen?: () => void,
  onClose?: () => void
): AlertSocketHandle {
  let socket: WebSocket | null = null;
  try {
    socket = new WebSocket(toAlertSocketUrl(baseUrl, token));
  } catch {
    // Invalid URL — surface a closed socket so callers can retry.
    return { close: () => undefined, readyState: () => 3 };
  }

  socket.onopen = () => {
    onOpen?.();
  };
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(String((event as { data: string }).data)) as LiveAlertMessage;
      onMessage(data);
    } catch {
      // Ignore malformed frames.
    }
  };
  socket.onclose = () => {
    onClose?.();
  };
  socket.onerror = () => {
    // onclose fires after onerror in RN; nothing else needed here.
  };

  return {
    close: () => {
      try {
        socket?.close();
      } catch {
        // already closed
      }
    },
    readyState: () => socket?.readyState ?? 3
  };
}
