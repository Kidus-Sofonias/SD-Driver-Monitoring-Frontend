import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SensorSample } from "../types/api";

/**
 * Durable, trip-scoped upload outbox.
 *
 * Every sample drained from the sensor collector is appended here *before* the
 * upload attempt, so nothing is lost when the app is killed mid-flight or the
 * network drops (rural/remote Ethiopian roads). Failed batches stay queued and
 * are retried by the auto-upload loop with jittered backoff.
 *
 * Storage layout: single JSON object keyed by trip_id:
 *   { [tripId]: SensorSample[] }
 */
const QUEUE_KEY = "safe-driving/upload-queue";

export const QUEUE_CAP_PER_TRIP = 2000;

type QueueMap = Record<string, SensorSample[]>;

async function readAll(): Promise<QueueMap> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as QueueMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(map: QueueMap): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(map));
}

/**
 * Append samples to a trip's outbox. Drops the oldest samples beyond the
 * per-trip cap and returns how many were dropped (so the UI can warn).
 */
export async function enqueueSamples(tripId: string, samples: SensorSample[]): Promise<{ dropped: number }> {
  if (!samples.length) {
    return { dropped: 0 };
  }
  const map = await readAll();
  const existing = map[tripId] ?? [];
  const combined = [...existing, ...samples];
  const dropped = Math.max(0, combined.length - QUEUE_CAP_PER_TRIP);
  const kept = dropped > 0 ? combined.slice(dropped) : combined;
  map[tripId] = kept;
  await writeAll(map);
  return { dropped };
}

/** Take up to `limit` samples from the front of a trip's outbox. */
export async function peekSamples(tripId: string, limit: number): Promise<SensorSample[]> {
  const map = await readAll();
  const existing = map[tripId] ?? [];
  return existing.slice(0, limit);
}

/** Remove the first `count` samples from a trip's outbox (after upload). */
export async function dequeueSamples(tripId: string, count: number): Promise<void> {
  if (count <= 0) {
    return;
  }
  const map = await readAll();
  const existing = map[tripId] ?? [];
  const kept = existing.slice(count);
  if (kept.length > 0) {
    map[tripId] = kept;
    await writeAll(map);
  } else {
    delete map[tripId];
    await writeAll(map);
  }
}

export async function clearTripQueue(tripId: string): Promise<void> {
  const map = await readAll();
  if (map[tripId]) {
    delete map[tripId];
    await writeAll(map);
  }
}

/** Drop every trip's outbox (used on sign-out so queued data never crosses accounts). */
export async function clearAllQueued(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function queueDepth(tripId: string): Promise<number> {
  const map = await readAll();
  return (map[tripId] ?? []).length;
}

export async function totalQueuedSamples(): Promise<number> {
  const map = await readAll();
  return Object.values(map).reduce((sum, samples) => sum + samples.length, 0);
}

/** Trip ids that still have unsent samples (e.g. a prior trip not yet finalized). */
export async function listQueuedTripIds(): Promise<string[]> {
  const map = await readAll();
  return Object.keys(map).filter((tripId) => (map[tripId] ?? []).length > 0);
}
