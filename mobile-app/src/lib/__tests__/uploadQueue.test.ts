import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SensorSample } from "../../types/api";
import {
  QUEUE_CAP_PER_TRIP,
  clearAllQueued,
  clearTripQueue,
  dequeueSamples,
  enqueueSamples,
  listQueuedTripIds,
  peekSamples,
  queueDepth,
  totalQueuedSamples,
} from "../uploadQueue";

const TRIP_A = "trip-a";
const TRIP_B = "trip-b";

function sample(n: number): SensorSample {
  return {
    timestamp: new Date(2026, 0, 1, 0, 0, n).toISOString(),
    speed: n,
    lat: 9.0,
    lon: 38.7,
    accuracy_m: 5,
    ax: 0.1,
    ay: 0.1,
    az: 9.8,
    gx: 0.01,
    gy: 0.01,
    gz: 0.01,
  };
}

describe("uploadQueue (durable trip-scoped outbox)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("persists samples across read/write round-trips via AsyncStorage", async () => {
    await enqueueSamples(TRIP_A, [sample(1), sample(2)]);

    const raw = await AsyncStorage.getItem("safe-driving/upload-queue");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveProperty(TRIP_A);
  });

  it("enqueues and peeks FIFO without removing", async () => {
    await enqueueSamples(TRIP_A, [sample(1), sample(2), sample(3)]);

    expect(await queueDepth(TRIP_A)).toBe(3);
    const peeked = await peekSamples(TRIP_A, 2);
    expect(peeked.map((s) => s.speed)).toEqual([1, 2]);
    // Peek must not consume.
    expect(await queueDepth(TRIP_A)).toBe(3);
  });

  it("dequeues from the front in FIFO order", async () => {
    await enqueueSamples(TRIP_A, [sample(1), sample(2), sample(3)]);
    await dequeueSamples(TRIP_A, 2);

    expect(await queueDepth(TRIP_A)).toBe(1);
    const rest = await peekSamples(TRIP_A, 10);
    expect(rest[0].speed).toBe(3);
  });

  it("drops the trip key entirely when the queue empties", async () => {
    await enqueueSamples(TRIP_A, [sample(1)]);
    await dequeueSamples(TRIP_A, 1);

    expect(await queueDepth(TRIP_A)).toBe(0);
    expect(await listQueuedTripIds()).not.toContain(TRIP_A);
  });

  it("enforces the per-trip cap and reports dropped oldest samples", async () => {
    const batch: SensorSample[] = [];
    for (let i = 0; i < QUEUE_CAP_PER_TRIP + 25; i += 1) {
      batch.push(sample(i));
    }

    const { dropped } = await enqueueSamples(TRIP_A, batch);

    expect(dropped).toBe(25);
    expect(await queueDepth(TRIP_A)).toBe(QUEUE_CAP_PER_TRIP);
    // Oldest dropped: the first retained sample is #25.
    const head = await peekSamples(TRIP_A, 1);
    expect(head[0].speed).toBe(25);
  });

  it("keeps trips isolated from each other", async () => {
    await enqueueSamples(TRIP_A, [sample(1)]);
    await enqueueSamples(TRIP_B, [sample(2)]);

    expect(await queueDepth(TRIP_A)).toBe(1);
    expect(await queueDepth(TRIP_B)).toBe(1);
    expect(await totalQueuedSamples()).toBe(2);
    expect(await listQueuedTripIds()).toEqual(expect.arrayContaining([TRIP_A, TRIP_B]));
  });

  it("clearTripQueue removes only the given trip", async () => {
    await enqueueSamples(TRIP_A, [sample(1)]);
    await enqueueSamples(TRIP_B, [sample(2)]);

    await clearTripQueue(TRIP_A);

    expect(await queueDepth(TRIP_A)).toBe(0);
    expect(await queueDepth(TRIP_B)).toBe(1);
  });

  it("clearAllQueued wipes every trip (sign-out safety)", async () => {
    await enqueueSamples(TRIP_A, [sample(1)]);
    await enqueueSamples(TRIP_B, [sample(2)]);

    await clearAllQueued();

    expect(await totalQueuedSamples()).toBe(0);
    expect(await listQueuedTripIds()).toEqual([]);
  });

  it("enqueue with an empty array is a no-op", async () => {
    const { dropped } = await enqueueSamples(TRIP_A, []);
    expect(dropped).toBe(0);
    expect(await queueDepth(TRIP_A)).toBe(0);
  });

  it("survives corrupt stored JSON (falls back to empty queue)", async () => {
    await AsyncStorage.setItem("safe-driving/upload-queue", "{not-json");
    await enqueueSamples(TRIP_A, [sample(1)]);
    expect(await queueDepth(TRIP_A)).toBe(1);
  });
});
