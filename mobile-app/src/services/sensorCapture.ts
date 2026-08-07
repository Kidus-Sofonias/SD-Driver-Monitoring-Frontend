import * as Location from "expo-location";
import { Accelerometer, Gyroscope, type AccelerometerMeasurement, type GyroscopeMeasurement } from "expo-sensors";
import { Platform } from "react-native";

import { SAMPLE_BURST_SECONDS, SAMPLE_BURST_SIZE, SENSOR_GPS_INTERVAL_MS, SENSOR_MOTION_INTERVAL_MS, SENSOR_DISTANCE_INTERVAL_M } from "../config/constants";
import type { SensorSample } from "../types/api";
import { saveSensorBuffer, loadSensorBuffer, clearSensorBuffer } from "../lib/storage";

export type SensorCaptureMode = "idle" | "live" | "demo";

export type SensorCaptureSnapshot = {
  mode: SensorCaptureMode;
  collecting: boolean;
  bufferedCount: number;
  lastSampleAt: string | null;
};

type Removable = {
  remove: () => void;
};

type RoutePoint = {
  lat: number;
  lon: number;
  altitude: number;
};

type DemoTripProfile = "safe" | "normal" | "risky";
type DemoScenario = {
  route: RoutePoint[];
  profile: DemoTripProfile;
  progress: number;
};

// -----------------------------------------------------------------------
// Expanded route data: 12 diverse Ethiopian routes with altitude
// -----------------------------------------------------------------------
const DEMO_ROUTES: RoutePoint[][] = [
  // Route 1: Addis Ababa centre - Bole (urban)
  [
    { lat: 9.0300, lon: 38.7400, altitude: 2355 },
    { lat: 9.0230, lon: 38.7450, altitude: 2348 },
    { lat: 9.0160, lon: 38.7510, altitude: 2342 },
    { lat: 9.0090, lon: 38.7570, altitude: 2335 },
    { lat: 9.0020, lon: 38.7630, altitude: 2328 },
    { lat: 8.9950, lon: 38.7690, altitude: 2322 },
    { lat: 8.9880, lon: 38.7750, altitude: 2315 },
    { lat: 8.9810, lon: 38.7810, altitude: 2308 },
  ],
  // Route 2: Bole - Airport area (descending)
  [
    { lat: 8.9900, lon: 38.7990, altitude: 2320 },
    { lat: 8.9850, lon: 38.7930, altitude: 2315 },
    { lat: 8.9800, lon: 38.7870, altitude: 2310 },
    { lat: 8.9750, lon: 38.7810, altitude: 2304 },
    { lat: 8.9700, lon: 38.7750, altitude: 2298 },
    { lat: 8.9650, lon: 38.7690, altitude: 2292 },
    { lat: 8.9600, lon: 38.7630, altitude: 2286 },
    { lat: 8.9550, lon: 38.7570, altitude: 2280 },
  ],
  // Route 3: Summit area (higher elevation, winding)
  [
    { lat: 9.0200, lon: 38.6900, altitude: 2380 },
    { lat: 9.0150, lon: 38.6950, altitude: 2385 },
    { lat: 9.0100, lon: 38.7000, altitude: 2390 },
    { lat: 9.0050, lon: 38.7040, altitude: 2392 },
    { lat: 9.0000, lon: 38.7080, altitude: 2394 },
    { lat: 8.9950, lon: 38.7120, altitude: 2395 },
    { lat: 8.9900, lon: 38.7160, altitude: 2396 },
    { lat: 8.9850, lon: 38.7200, altitude: 2395 },
  ],
  // Route 4: Addis north (flat-ish urban)
  [
    { lat: 9.0500, lon: 38.7600, altitude: 2340 },
    { lat: 9.0470, lon: 38.7550, altitude: 2338 },
    { lat: 9.0440, lon: 38.7500, altitude: 2336 },
    { lat: 9.0410, lon: 38.7450, altitude: 2334 },
    { lat: 9.0380, lon: 38.7400, altitude: 2332 },
    { lat: 9.0350, lon: 38.7350, altitude: 2330 },
    { lat: 9.0320, lon: 38.7300, altitude: 2328 },
    { lat: 9.0290, lon: 38.7250, altitude: 2326 },
  ],
  // Route 5: Adama (Nazret) - lower elevation
  [
    { lat: 8.5400, lon: 39.2700, altitude: 1720 },
    { lat: 8.5460, lon: 39.2740, altitude: 1718 },
    { lat: 8.5520, lon: 39.2780, altitude: 1715 },
    { lat: 8.5580, lon: 39.2820, altitude: 1712 },
    { lat: 8.5640, lon: 39.2860, altitude: 1709 },
    { lat: 8.5700, lon: 39.2900, altitude: 1706 },
    { lat: 8.5760, lon: 39.2940, altitude: 1703 },
    { lat: 8.5820, lon: 39.2980, altitude: 1700 },
  ],
  // Route 6: Hawassa area
  [
    { lat: 7.0500, lon: 38.5000, altitude: 1750 },
    { lat: 7.0560, lon: 38.5030, altitude: 1748 },
    { lat: 7.0620, lon: 38.5060, altitude: 1745 },
    { lat: 7.0680, lon: 38.5090, altitude: 1742 },
    { lat: 7.0740, lon: 38.5120, altitude: 1739 },
    { lat: 7.0800, lon: 38.5150, altitude: 1736 },
    { lat: 7.0860, lon: 38.5180, altitude: 1733 },
    { lat: 7.0920, lon: 38.5210, altitude: 1730 },
  ],
  // Route 7: Bahir Dar (lake area)
  [
    { lat: 11.5700, lon: 37.3900, altitude: 2130 },
    { lat: 11.5650, lon: 37.3840, altitude: 2128 },
    { lat: 11.5600, lon: 37.3780, altitude: 2125 },
    { lat: 11.5550, lon: 37.3720, altitude: 2122 },
    { lat: 11.5500, lon: 37.3660, altitude: 2119 },
    { lat: 11.5450, lon: 37.3600, altitude: 2116 },
    { lat: 11.5400, lon: 37.3540, altitude: 2113 },
    { lat: 11.5350, lon: 37.3480, altitude: 2110 },
  ],
  // Route 8: Dire Dawa
  [
    { lat: 9.6000, lon: 41.8600, altitude: 2430 },
    { lat: 9.5950, lon: 41.8540, altitude: 2425 },
    { lat: 9.5900, lon: 41.8480, altitude: 2420 },
    { lat: 9.5850, lon: 41.8420, altitude: 2415 },
    { lat: 9.5800, lon: 41.8360, altitude: 2410 },
    { lat: 9.5750, lon: 41.8300, altitude: 2405 },
    { lat: 9.5700, lon: 41.8240, altitude: 2400 },
    { lat: 9.5650, lon: 41.8180, altitude: 2395 },
  ],
  // Route 9: Addis winding (more turns)
  [
    { lat: 9.0100, lon: 38.7200, altitude: 2370 },
    { lat: 9.0050, lon: 38.7270, altitude: 2374 },
    { lat: 9.0000, lon: 38.7230, altitude: 2378 },
    { lat: 8.9950, lon: 38.7300, altitude: 2382 },
    { lat: 8.9900, lon: 38.7260, altitude: 2385 },
    { lat: 8.9850, lon: 38.7330, altitude: 2388 },
    { lat: 8.9800, lon: 38.7290, altitude: 2390 },
    { lat: 8.9750, lon: 38.7360, altitude: 2392 },
  ],
  // Route 10: Arat Kilo - Sidist Kilo (Addis)
  [
    { lat: 9.0380, lon: 38.7530, altitude: 2350 },
    { lat: 9.0340, lon: 38.7480, altitude: 2348 },
    { lat: 9.0300, lon: 38.7430, altitude: 2345 },
    { lat: 9.0260, lon: 38.7380, altitude: 2343 },
    { lat: 9.0220, lon: 38.7330, altitude: 2340 },
    { lat: 9.0180, lon: 38.7280, altitude: 2338 },
    { lat: 9.0140, lon: 38.7230, altitude: 2335 },
    { lat: 9.0100, lon: 38.7180, altitude: 2332 },
  ],
  // Route 11: Suburban twisty road
  [
    { lat: 8.9600, lon: 38.7100, altitude: 2320 },
    { lat: 8.9550, lon: 38.7150, altitude: 2325 },
    { lat: 8.9500, lon: 38.7090, altitude: 2330 },
    { lat: 8.9450, lon: 38.7140, altitude: 2335 },
    { lat: 8.9400, lon: 38.7080, altitude: 2340 },
    { lat: 8.9350, lon: 38.7130, altitude: 2345 },
    { lat: 8.9300, lon: 38.7070, altitude: 2350 },
    { lat: 8.9250, lon: 38.7120, altitude: 2355 },
  ],
  // Route 12: Long straight highway
  [
    { lat: 9.0000, lon: 38.8000, altitude: 2310 },
    { lat: 8.9950, lon: 38.7950, altitude: 2308 },
    { lat: 8.9900, lon: 38.7900, altitude: 2306 },
    { lat: 8.9850, lon: 38.7850, altitude: 2304 },
    { lat: 8.9800, lon: 38.7800, altitude: 2302 },
    { lat: 8.9750, lon: 38.7750, altitude: 2300 },
    { lat: 8.9700, lon: 38.7700, altitude: 2298 },
    { lat: 8.9650, lon: 38.7650, altitude: 2296 },
  ],
];

function wobble(center: number, amplitude: number) {
  return center + (Math.random() * 2 - 1) * amplitude;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function interpolateRoutePoint(route: RoutePoint[], progress: number) {
  if (route.length <= 1) {
    return route[0] ?? { lat: 0, lon: 0, altitude: 0 };
  }

  const capped = Math.max(0, Math.min(0.999999, progress));
  const scaled = capped * (route.length - 1);
  const index = Math.floor(scaled);
  const localProgress = scaled - index;
  const start = route[index] ?? route[0];
  const end = route[index + 1] ?? route[route.length - 1];

  return {
    lat: start.lat + (end.lat - start.lat) * localProgress,
    lon: start.lon + (end.lon - start.lon) * localProgress,
    altitude: start.altitude + (end.altitude - start.altitude) * localProgress,
  };
}

function pickDemoTripProfile(): DemoTripProfile {
  const roll = Math.random();
  if (roll < 0.40) {
    return "safe";
  }
  if (roll < 0.75) {
    return "normal";
  }
  return "risky";
}

function routeBearing(route: RoutePoint[], progress: number) {
  const lead = interpolateRoutePoint(route, Math.min(0.999999, progress + 0.02));
  const tail = interpolateRoutePoint(route, Math.max(0, progress - 0.02));
  const dLat = lead.lat - tail.lat;
  const dLon = lead.lon - tail.lon;
  const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
  return { lat: dLat / length, lon: dLon / length };
}

function applyLaneJitter(route: RoutePoint[], progress: number, profile: DemoTripProfile) {
  const bearing = routeBearing(route, progress);
  const perpendicular = { lat: -bearing.lon, lon: bearing.lat };
  const along = { lat: bearing.lat, lon: bearing.lon };

  const baseLaneMeters = profile === "safe" ? 1.2 : profile === "normal" ? 2.5 : 4.2;
  const laneOffsetMeters = wobble(0, baseLaneMeters);
  const alongOffsetMeters = wobble(0, profile === "risky" ? 2.8 : 1.4);
  const latMeters = 111_320;
  const lonMeters = 111_320 * Math.cos((interpolateRoutePoint(route, progress).lat * Math.PI) / 180);
  const safeLonMeters = Math.max(1, Math.abs(lonMeters));

  return {
    latOffset: (perpendicular.lat * laneOffsetMeters + along.lat * alongOffsetMeters) / latMeters,
    lonOffset: (perpendicular.lon * laneOffsetMeters + along.lon * alongOffsetMeters) / safeLonMeters,
  };
}

function demoSpeedMps(progress: number, profile: DemoTripProfile) {
  const wave = Math.sin(progress * Math.PI * 1.6);
  if (profile === "safe") {
    const cruising = 7.5 + wave * 1.0;
    if (progress < 0.2) return 3.5 + progress * 18;
    if (progress > 0.85) return Math.max(2.8, cruising - (progress - 0.85) * 14);
    return cruising;
  }
  if (profile === "normal") {
    const cruising = 10.5 + wave * 2.0;
    if (progress < 0.18) return 4.0 + progress * 25;
    if (progress > 0.86) return Math.max(3.0, cruising - (progress - 0.86) * 16);
    return cruising;
  }
  const aggressivePulse = Math.sin(progress * Math.PI * 4) * 2.5;
  const riskyCruise = 14.5 + wave * 2.8 + aggressivePulse;
  if (progress < 0.15) return 4.5 + progress * 42;
  if (progress > 0.9) return Math.max(3.5, riskyCruise - (progress - 0.9) * 18);
  return riskyCruise;
}

function demoAccuracyMeters(progress: number, profile: DemoTripProfile) {
  const baseline = profile === "safe" ? 4.5 : profile === "normal" ? 6.0 : 8.0;
  const signalDip =
    profile === "risky" && progress > 0.25 && progress < 0.42
      ? randomBetween(7, 15)
      : profile === "normal" && progress > 0.52 && progress < 0.64
        ? randomBetween(2, 6)
        : 0;
  return Math.max(3.0, wobble(baseline, 1.5) + signalDip);
}

function demoAltitudeMeters(baseAltitude: number, progress: number, profile: DemoTripProfile) {
  // Simulate road undulations based on the base altitude and driving profile
  const roughness = profile === "risky" ? 8.0 : profile === "normal" ? 5.0 : 3.0;
  const wave1 = Math.sin(progress * Math.PI * 0.7) * roughness;
  const wave2 = Math.cos(progress * Math.PI * 2.3) * roughness * 0.4;
  const wave3 = Math.sin(progress * Math.PI * 5.1) * roughness * 0.15;
  return baseAltitude + wave1 + wave2 + wave3 + wobble(0, 1.0);
}

function tripMotionNoise(speedMps: number, profile: DemoTripProfile) {
  const accelScale = profile === "safe" ? 0.08 : profile === "normal" ? 0.14 : 0.30;
  const turnScale = profile === "safe" ? 0.03 : profile === "normal" ? 0.06 : 0.16;
  const surge = profile === "risky" && Math.random() < 0.12 ? randomBetween(0.25, 0.55) : 0;
  return {
    ax: wobble(0.01 + speedMps * 0.002, accelScale + surge),
    ay: wobble(0.01, accelScale + surge * 1.2),
    az: wobble(9.8, 0.1 + accelScale * 0.45),
    gx: wobble(0.0, turnScale + surge * 0.25),
    gy: wobble(0.0, turnScale + surge * 0.25),
    gz: wobble(0.0, turnScale * 1.2 + surge * 0.4),
  };
}

function createDemoScenario(): DemoScenario {
  const routeIndex = Math.floor(Math.random() * DEMO_ROUTES.length);
  return {
    route: DEMO_ROUTES[routeIndex] ?? DEMO_ROUTES[0],
    profile: pickDemoTripProfile(),
    progress: randomBetween(0.02, 0.12),
  };
}

function advanceProgress(progress: number, profile: DemoTripProfile) {
  const baseStep = profile === "safe" ? 0.006 : profile === "normal" ? 0.008 : 0.011;
  return Math.min(0.995, progress + randomBetween(baseStep * 0.8, baseStep * 1.25));
}

function generateMockSensorBurstForScenario(scenario: DemoScenario): {
  samples: SensorSample[];
  nextScenario: DemoScenario;
} {
  const now = Date.now();
  const durationSeconds = randomBetween(SAMPLE_BURST_SECONDS * 0.8, SAMPLE_BURST_SECONDS * 1.35);
  const stepMs = Math.max(250, Math.round((durationSeconds * 1000) / Math.max(1, SAMPLE_BURST_SIZE - 1)));
  const start = now - durationSeconds * 1000;
  const { route, profile } = scenario;
  let progressCursor = scenario.progress;

  const samples = Array.from({ length: SAMPLE_BURST_SIZE }, (_, index) => {
    progressCursor = advanceProgress(progressCursor, profile);
    const point = interpolateRoutePoint(route, progressCursor);
    const jitter = applyLaneJitter(route, progressCursor, profile);
    const speed = Math.max(2.0, wobble(demoSpeedMps(progressCursor, profile), profile === "risky" ? 1.5 : 0.8));
    const motion = tripMotionNoise(speed, profile);

    // Simulate variable altitude with road undulations
    const alt = demoAltitudeMeters(point.altitude, progressCursor, profile);

    return {
      timestamp: new Date(start + index * stepMs).toISOString(),
      speed,
      lat: point.lat + jitter.latOffset,
      lon: point.lon + jitter.lonOffset,
      accuracy_m: demoAccuracyMeters(progressCursor, profile),
      altitude_m: alt,
      ax: motion.ax,
      ay: motion.ay,
      az: motion.az,
      gx: motion.gx,
      gy: motion.gy,
      gz: motion.gz,
    };
  });

  return {
    samples,
    nextScenario: {
      route,
      profile,
      progress: progressCursor,
    },
  };
}

export function generateMockSensorBurst(): SensorSample[] {
  return generateMockSensorBurstForScenario(createDemoScenario()).samples;
}

export class PhoneSensorCollector {
  private samples: SensorSample[] = [];
  private mode: SensorCaptureMode = "idle";
  private collecting = false;
  private lastSampleAt: string | null = null;
  private lastAccelerometer: AccelerometerMeasurement | null = null;
  private lastGyroscope: GyroscopeMeasurement | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private accelerometerSubscription: Removable | null = null;
  private gyroscopeSubscription: Removable | null = null;
  private demoScenario: DemoScenario | null = null;
  // Track sample sequence for GPS timestamp interpolation
  private sampleSequence = 0;

  snapshot(): SensorCaptureSnapshot {
    return {
      mode: this.mode,
      collecting: this.collecting,
      bufferedCount: this.samples.length,
      lastSampleAt: this.lastSampleAt,
    };
  }

  async start(): Promise<SensorCaptureSnapshot> {
    if (this.collecting) {
      return this.snapshot();
    }

    this.collecting = true;
    this.sampleSequence = 0;

    // Restore any previously buffered samples that weren't uploaded
    try {
      const savedSamples = await loadSensorBuffer();
      if (savedSamples.length > 0) {
        this.samples = savedSamples;
        this.lastSampleAt = savedSamples[savedSamples.length - 1]?.timestamp ?? null;
      }
    } catch {
      // Ignore buffer load errors
    }

    if (Platform.OS === "web") {
      this.mode = "demo";
      this.demoScenario = createDemoScenario();
      return this.snapshot();
    }

    let permissionsOk = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      permissionsOk = permission.granted && servicesEnabled;
    } catch {
      permissionsOk = false;
    }

    if (!permissionsOk) {
      this.mode = "demo";
      this.demoScenario = createDemoScenario();
      return this.snapshot();
    }

    // Subscribe to sensors - with fallback for phones that lack specific sensors
    const [accelerometerAvailable, gyroscopeAvailable] = await Promise.all([
      Accelerometer.isAvailableAsync().catch(() => false),
      Gyroscope.isAvailableAsync().catch(() => false),
    ]);

    if (accelerometerAvailable) {
      try {
        Accelerometer.setUpdateInterval(SENSOR_MOTION_INTERVAL_MS);
        this.accelerometerSubscription = Accelerometer.addListener((reading) => {
          this.lastAccelerometer = reading;
        });
      } catch {
        // Accelerometer failed to subscribe; continue without it
      }
    }

    if (gyroscopeAvailable) {
      try {
        Gyroscope.setUpdateInterval(SENSOR_MOTION_INTERVAL_MS);
        this.gyroscopeSubscription = Gyroscope.addListener((reading) => {
          this.lastGyroscope = reading;
        });
      } catch {
        // Gyroscope failed to subscribe; continue without it
      }
    }

    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: SENSOR_GPS_INTERVAL_MS,
          distanceInterval: SENSOR_DISTANCE_INTERVAL_M,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          const coords = location.coords;
          const timestamp = new Date(location.timestamp).toISOString();
          this.sampleSequence += 1;

          this.samples.push({
            timestamp,
            // CRIT-3 fix: when GPS reports no speed (coords.speed can be null on
            // many devices), send null instead of fabricating 0 m/s. A fake 0
            // made the backend detect a false hard-brake event (e.g. 50->0->50).
            speed: coords.speed ?? null,
            lat: coords.latitude,
            lon: coords.longitude,
            accuracy_m: coords.accuracy ?? 0,
            altitude_m: coords.altitude ?? null,
            ax: this.lastAccelerometer?.x ?? 0,
            ay: this.lastAccelerometer?.y ?? 0,
            az: this.lastAccelerometer?.z ?? 0,
            gx: this.lastGyroscope?.x ?? 0,
            gy: this.lastGyroscope?.y ?? 0,
            gz: this.lastGyroscope?.z ?? 0,
          });

          this.lastSampleAt = timestamp;

          // Persist buffer to storage every 10 samples for crash recovery
          if (this.sampleSequence % 10 === 0) {
            saveSensorBuffer(this.samples).catch(() => {});
          }
        }
      );
      this.mode = "live";
    } catch {
      await this.stopSubscriptions();
      this.mode = "demo";
      this.demoScenario = createDemoScenario();
    }

    return this.snapshot();
  }

  drainSamples(options?: { fallbackToDemo?: boolean }): SensorSample[] {
    const fallbackToDemo = options?.fallbackToDemo ?? true;
    const drained = [...this.samples];
    this.samples = [];

    // Clear persisted buffer
    if (drained.length > 0) {
      clearSensorBuffer().catch(() => {});
      return drained;
    }

    // Also fall back to demo when mode is "idle" — this handles the case where
    // the collector was stopped after a previous trip but we still want to
    // generate demo samples on web for the current active trip.
    if ((this.mode === "demo" || this.mode === "idle") && fallbackToDemo) {
      if (!this.demoScenario || this.demoScenario.progress >= 0.995) {
        this.demoScenario = createDemoScenario();
      }
      const { samples: demoSamples, nextScenario } = generateMockSensorBurstForScenario(this.demoScenario);
      this.demoScenario = nextScenario;
      this.lastSampleAt = demoSamples[demoSamples.length - 1]?.timestamp ?? this.lastSampleAt;
      return demoSamples;
    }

    return [];
  }

  restoreSamples(samples: SensorSample[]) {
    if (!samples.length) {
      return this.snapshot();
    }

    this.samples = [...samples, ...this.samples];
    this.lastSampleAt = this.samples[this.samples.length - 1]?.timestamp ?? this.lastSampleAt;

    // Persist restored samples to storage
    saveSensorBuffer(this.samples).catch(() => {});

    return this.snapshot();
  }

  async stop(): Promise<SensorCaptureSnapshot> {
    // Save any in-flight samples before stopping
    if (this.samples.length > 0) {
      await saveSensorBuffer(this.samples);
    }

    await this.stopSubscriptions();
    this.collecting = false;
    this.mode = "idle";
    this.demoScenario = null;
    this.sampleSequence = 0;
    return this.snapshot();
  }

  private async stopSubscriptions() {
    this.locationSubscription?.remove();
    this.locationSubscription = null;
    this.accelerometerSubscription?.remove();
    this.accelerometerSubscription = null;
    this.gyroscopeSubscription?.remove();
    this.gyroscopeSubscription = null;
  }
}

export function createPhoneSensorCollector() {
  return new PhoneSensorCollector();
}

export const sensorCaptureNotes = [
  "V2: Higher frequency GPS (500ms), accelerometer/gyro (200ms) for richer data.",
  "Altitude captured from GPS when available. Falls back to demo on unsupported phones.",
  "Buffer is persisted to AsyncStorage every 10 samples to prevent data loss on crash.",
  "12 diverse Ethiopian routes for demo mode instead of previous 4.",
  "Demo altitude simulation now matches real Ethiopian geography.",
  "Sensors gracefully fall back on phones that lack accelerometer/gyroscope.",
  "Accuracy: High GPS mode for better positioning.",
];
