import { Platform } from "react-native";

const API_V1_PATH = "/api/v1";
export const DEPLOYED_API_BASE_URL = "https://sd-backend-and-model.onrender.com/api/v1";

export function isPlaceholderApiBaseUrl(rawUrl: string | null | undefined) {
  const value = rawUrl?.trim();
  if (!value) {
    return false;
  }

  return /your-backend|example\.com|<[^>]+>/i.test(value);
}

export function normalizeConfiguredApiBaseUrl(rawUrl: string | null | undefined) {
  const value = rawUrl?.trim();
  if (!value || isPlaceholderApiBaseUrl(value)) {
    return "";
  }

  return normalizeApiBaseUrl(value);
}

function stripPort(host: string) {
  const trimmed = host.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("[")) {
    const closingBracket = trimmed.indexOf("]");
    return closingBracket >= 0 ? trimmed.slice(0, closingBracket + 1) : trimmed;
  }
  return trimmed.split(":")[0] || trimmed;
}

function inferLanHostFromExpoConfig() {
  const hostCandidates = [
    process.env.EXPO_PACKAGER_HOSTNAME,
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME,
    process.env.EXPO_DEV_SERVER_ORIGIN
  ];

  for (const candidate of hostCandidates) {
    if (!candidate) {
      continue;
    }
    const host = stripPort(candidate.replace(/^https?:\/\//, ""));
    if (host) {
      return host;
    }
  }

  return "";
}

function buildDefaultApiBaseUrl() {
  const envValue = normalizeConfiguredApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (envValue) {
    return envValue;
  }

  const lanHost = inferLanHostFromExpoConfig();
  if (__DEV__ && lanHost) {
    return `http://${lanHost}:8000/api/v1`;
  }

  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:8000/api/v1";
    }

    return "http://127.0.0.1:8000/api/v1";
  }

  return DEPLOYED_API_BASE_URL;
}

export function normalizeApiBaseUrl(rawUrl: string) {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }

  const hasScheme = /^[a-z]+:\/\//i.test(trimmed);
  const isLocalHost = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?(\/|$)/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `${isLocalHost ? "http" : "https"}://${trimmed}`;

  try {
    const url = new URL(candidate);
    const path = url.pathname.replace(/\/+$/, "");

    if (!path || path === "/") {
      url.pathname = API_V1_PATH;
    } else if (path === "/api") {
      url.pathname = API_V1_PATH;
    } else {
      url.pathname = path;
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

export const DEFAULT_API_BASE_URL = buildDefaultApiBaseUrl();
export const SAMPLE_BURST_SIZE = 36;
export const SAMPLE_BURST_SECONDS = 18;
