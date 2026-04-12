import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Session } from "../types/api";

const SESSION_KEY = "safe-driving/session";
const API_URL_KEY = "safe-driving/api-url";
const THEME_KEY = "safe-driving/theme-mode";
const LANGUAGE_KEY = "safe-driving/language-mode";
const DISMISSED_PENDING_TRIPS_KEY = "safe-driving/dismissed-pending-trips";

export async function saveSession(session: Session | null) {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function saveApiBaseUrl(url: string) {
  await AsyncStorage.setItem(API_URL_KEY, url);
}

export async function loadApiBaseUrl(): Promise<string | null> {
  return AsyncStorage.getItem(API_URL_KEY);
}

export async function saveThemeMode(mode: "light" | "dark") {
  await AsyncStorage.setItem(THEME_KEY, mode);
}

export async function loadThemeMode(): Promise<"light" | "dark" | null> {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

export async function saveLanguageMode(mode: "en" | "am" | "om") {
  await AsyncStorage.setItem(LANGUAGE_KEY, mode);
}

export async function loadLanguageMode(): Promise<"en" | "am" | "om" | null> {
  const raw = await AsyncStorage.getItem(LANGUAGE_KEY);
  return raw === "en" || raw === "am" || raw === "om" ? raw : null;
}

export async function saveDismissedPendingTripIds(tripIds: string[]) {
  await AsyncStorage.setItem(DISMISSED_PENDING_TRIPS_KEY, JSON.stringify(tripIds));
}

export async function loadDismissedPendingTripIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(DISMISSED_PENDING_TRIPS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}
