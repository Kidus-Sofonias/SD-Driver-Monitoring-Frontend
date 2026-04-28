import * as Location from "expo-location";
import { Accelerometer, Gyroscope, type AccelerometerMeasurement, type GyroscopeMeasurement } from "expo-sensors";
import { Platform } from "react-native";

import { SAMPLE_BURST_SECONDS, SAMPLE_BURST_SIZE } from "../config/constants";
import type { SensorSample } from "../types/api";

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
};

const ADDIS_DEMO_ROUTES: RoutePoint[][] = [
  [
    { lat: 8.9058, lon: 38.8859 },
    { lat: 8.9064, lon: 38.8855 },
    { lat: 8.9071, lon: 38.8851 },
    { lat: 8.9079, lon: 38.8847 },
    { lat: 8.9088, lon: 38.8843 },
    { lat: 8.9098, lon: 38.8838 }
  ],
  [
    { lat: 9.0401, lon: 38.8506 },
    { lat: 9.0408, lon: 38.8509 },
    { lat: 9.0415, lon: 38.8513 },
    { lat: 9.0421, lon: 38.8518 },
    { lat: 9.0427, lon: 38.8523 },
    { lat: 9.0434, lon: 38.8528 }
  ],
  [
    { lat: 8.9797, lon: 38.7956 },
    { lat: 8.9804, lon: 38.7951 },
    { lat: 8.9810, lon: 38.7945 },
    { lat: 8.9817, lon: 38.7939 },
    { lat: 8.9824, lon: 38.7934 },
    { lat: 8.9830, lon: 38.7928 }
  ],
  [
    { lat: 9.0179, lon: 38.7619 },
    { lat: 9.0184, lon: 38.7611 },
    { lat: 9.0188, lon: 38.7604 },
    { lat: 9.0192, lon: 38.7595 },
    { lat: 9.0194, lon: 38.7587 },
    { lat: 9.0196, lon: 38.7579 }
  ]
];

function wobble(center: number, amplitude: number) {
  return center + (Math.random() * 2 - 1) * amplitude;
}

function interpolateRoutePoint(route: RoutePoint[], progress: number) {
  if (route.length <= 1) {
    return route[0] ?? { lat: 0, lon: 0 };
  }

  const capped = Math.max(0, Math.min(0.999999, progress));
  const scaled = capped * (route.length - 1);
  const index = Math.floor(scaled);
  const localProgress = scaled - index;
  const start = route[index] ?? route[0];
  const end = route[index + 1] ?? route[route.length - 1];

  return {
    lat: start.lat + (end.lat - start.lat) * localProgress,
    lon: start.lon + (end.lon - start.lon) * localProgress
  };
}

function demoSpeedKmh(progress: number) {
  if (progress < 0.25) {
    return 8 + progress * 28;
  }
  if (progress < 0.78) {
    return 14 + Math.sin(progress * Math.PI) * 7;
  }
  return 14 - (progress - 0.78) * 22;
}

export function generateMockSensorBurst(): SensorSample[] {
  const now = Date.now();
  const start = now - SAMPLE_BURST_SECONDS * 1000;
  const route = ADDIS_DEMO_ROUTES[Math.floor(Math.random() * ADDIS_DEMO_ROUTES.length)] ?? ADDIS_DEMO_ROUTES[0];

  return Array.from({ length: SAMPLE_BURST_SIZE }, (_, index) => {
    const progress = index / Math.max(1, SAMPLE_BURST_SIZE - 1);
    const point = interpolateRoutePoint(route, progress);
    const speed = Math.max(6, wobble(demoSpeedKmh(progress), 1.1));

    return {
      timestamp: new Date(start + index * 500).toISOString(),
      speed,
      lat: point.lat + wobble(0, 0.00001),
      lon: point.lon + wobble(0, 0.00001),
      accuracy_m: Math.max(4, wobble(6, 1.0)),
      ax: wobble(0.01, 0.16),
      ay: wobble(0.02, 0.18),
      az: wobble(9.8, 0.12),
      gx: wobble(0.0, 0.05),
      gy: wobble(0.0, 0.05),
      gz: wobble(0.0, 0.05)
    };
  });
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

    if (Platform.OS === "web") {
      this.mode = "demo";
      return this.snapshot();
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!permission.granted || !servicesEnabled) {
      this.mode = "demo";
      return this.snapshot();
    }

    const [accelerometerAvailable, gyroscopeAvailable] = await Promise.all([
      Accelerometer.isAvailableAsync().catch(() => false),
      Gyroscope.isAvailableAsync().catch(() => false),
    ]);

    if (accelerometerAvailable) {
      Accelerometer.setUpdateInterval(400);
      this.accelerometerSubscription = Accelerometer.addListener((reading) => {
        this.lastAccelerometer = reading;
      });
    }

    if (gyroscopeAvailable) {
      Gyroscope.setUpdateInterval(400);
      this.gyroscopeSubscription = Gyroscope.addListener((reading) => {
        this.lastGyroscope = reading;
      });
    }

    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        (location) => {
          const timestamp = new Date(location.timestamp).toISOString();
          this.samples.push({
            timestamp,
            speed: location.coords.speed ?? 0,
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            accuracy_m: location.coords.accuracy ?? 0,
            ax: this.lastAccelerometer?.x ?? 0,
            ay: this.lastAccelerometer?.y ?? 0,
            az: this.lastAccelerometer?.z ?? 0,
            gx: this.lastGyroscope?.x ?? 0,
            gy: this.lastGyroscope?.y ?? 0,
            gz: this.lastGyroscope?.z ?? 0,
          });
          this.lastSampleAt = timestamp;
        }
      );
      this.mode = "live";
    } catch {
      await this.stopSubscriptions();
      this.mode = "demo";
    }

    return this.snapshot();
  }

  drainSamples(options?: { fallbackToDemo?: boolean }): SensorSample[] {
    const fallbackToDemo = options?.fallbackToDemo ?? true;
    const drained = [...this.samples];
    this.samples = [];

    if (drained.length > 0) {
      return drained;
    }

    if (this.mode === "demo" && fallbackToDemo) {
      const demoSamples = generateMockSensorBurst();
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
    return this.snapshot();
  }

  async stop(): Promise<SensorCaptureSnapshot> {
    await this.stopSubscriptions();
    this.collecting = false;
    this.mode = "idle";
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
  "On Android and iOS the app now attempts live foreground GPS, accelerometer, and gyroscope capture.",
  "Expo web preview still falls back to demo batches because browser preview cannot behave like a real driving phone.",
  "Demo batches now follow fixed Addis Ababa route presets with more realistic speed ranges for safer map previews."
];
