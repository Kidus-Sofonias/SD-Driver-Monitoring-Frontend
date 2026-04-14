import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from "../config/constants";
import { NativeModules, Platform } from "react-native";
import type {
  AdminDriver,
  ApiEnvelope,
  AuthPayload,
  FinalizeTrip,
  HealthPayload,
  ReviewDashboardItem,
  TripRoute,
  TripDetail,
  ReviewTrip,
  Session,
  TripSampleCount,
  Trip,
  User
} from "../types/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  baseUrl?: string;
};

const REQUEST_TIMEOUT_MS = 30000;
const LOCALHOST_HOSTS = new Set(["127.0.0.1", "localhost"]);

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
  if (!__DEV__) {
    return [normalized];
  }

  const host = extractHost(normalized);
  const bundlerHost = inferBundlerHost();
  const candidates: string[] = [normalized];

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

async function fetchWithTimeout(url: string, init: RequestInit) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      fetch(url, init),
      new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Request timed out")), REQUEST_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, baseUrl = DEFAULT_API_BASE_URL } = options;
  const candidateBaseUrls = getCandidateBaseUrls(baseUrl);
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
      });
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
      message =
        (typeof errorData?.detail === "string" && errorData.detail) ||
        (typeof errorData?.message_key === "string" && errorData.message_key) ||
        rawError ||
        fallback;
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
  return request<ApiEnvelope<HealthPayload>>("/health", { baseUrl });
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
    baseUrl
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
    baseUrl
  });
}

export async function listTripSamples(baseUrl: string, token: string, tripId: string, limit = 1) {
  return request<import("../types/api").SensorSample[]>(`/trips/${tripId}/samples?limit=${limit}`, {
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

export async function finalizeTrip(baseUrl: string, token: string, tripId: string) {
  return request<FinalizeTrip>(`/trips/${tripId}/finalize`, {
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

export async function getAdminDrivers(baseUrl: string, token: string) {
  return request<AdminDriver[]>("/admin/drivers", { token, baseUrl });
}

export async function getAdminDriverTrips(baseUrl: string, token: string, driverId: string) {
  return request<Trip[]>(`/admin/drivers/${driverId}/trips`, { token, baseUrl });
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
