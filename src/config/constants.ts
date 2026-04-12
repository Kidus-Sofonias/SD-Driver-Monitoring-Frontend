import { Platform } from "react-native";

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
  const envValue = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envValue) {
    return envValue.replace(/\/+$/, "");
  }

  const lanHost = inferLanHostFromExpoConfig();
  if (lanHost) {
    return `http://${lanHost}:8000/api/v1`;
  }

  if (Platform.OS === "android") {
    return "http://127.0.0.1:8000/api/v1";
  }

  return "http://127.0.0.1:8000/api/v1";
}

export const DEFAULT_API_BASE_URL = buildDefaultApiBaseUrl();
export const SAMPLE_BURST_SIZE = 36;
export const SAMPLE_BURST_SECONDS = 18;
