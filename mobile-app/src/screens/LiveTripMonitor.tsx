import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import * as api from "../lib/api";
import { formatTimeAgo, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";
import type { LiveAlertMessage, TripTelemetry, TripRoute, WeatherPayload } from "../types/api";
import { RoutePreview } from "./TripRoutePreview";

const TELEMETRY_POLL_MS = 3000;
const ROUTE_POLL_MS = 15000;
const WEATHER_POLL_MS = 60000;
const WEATHER_MOVE_THRESHOLD = 0.004; // ~440 m

type ViewMode = "glance" | "details";

type AlertLabelKey =
  | "alert_hard_brake"
  | "alert_emergency_brake"
  | "alert_hard_accel"
  | "alert_aggressive_turn"
  | "alert_overspeed"
  | "alert_severe_overspeed"
  | "alert_unstable_motion";

function alertLabelKey(eventType: string): AlertLabelKey {
  switch (eventType) {
    case "emergency_brake":
      return "alert_emergency_brake";
    case "hard_accel":
      return "alert_hard_accel";
    case "aggressive_turn":
      return "alert_aggressive_turn";
    case "overspeed":
      return "alert_overspeed";
    case "severe_overspeed":
      return "alert_severe_overspeed";
    case "unstable_motion":
      return "alert_unstable_motion";
    case "hard_brake":
    default:
      return "alert_hard_brake";
  }
}

function kmh(speedMps: number | null | undefined): string {
  if (speedMps === null || speedMps === undefined) {
    return "--";
  }
  return String(Math.max(0, Math.round(speedMps * 3.6)));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function routeDistanceKm(points: Array<{ lat: number; lon: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return total;
}

function riskTone(riskLevel: string | undefined): "good" | "warn" | "bad" {
  if (riskLevel === "low") {
    return "good";
  }
  if (riskLevel === "medium") {
    return "warn";
  }
  return "bad";
}

type Props = {
  onSync: () => void;
  onEndTrip: () => void;
  busy: boolean;
};

export function LiveTripMonitor({ onSync, onEndTrip, busy }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const {
    activeTrip,
    apiBaseUrl,
    bufferedSampleCount,
    captureMode,
    persistedQueuedCount,
    queueDroppedCount,
    session,
    uploadedBurstCount,
  } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>("glance");
  const [telemetry, setTelemetry] = useState<TripTelemetry | null>(null);
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const weatherLatRef = useRef<number | null>(null);
  const weatherLonRef = useRef<number | null>(null);
  const [, setNow] = useState(Date.now());

  const tripId = activeTrip?.id ?? null;
  const token = session?.token.access_token ?? null;

  // 1s clock for the elapsed timer / relative times.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Telemetry poll: drives both glance (speed) and details (full payload).
  useEffect(() => {
    if (!tripId || !token) {
      return;
    }
    const activeTripId: string = tripId;
    const accessToken: string = token;
    let active = true;
    async function poll() {
      try {
        const payload = await api.getTripTelemetry(apiBaseUrl, accessToken, activeTripId);
        if (active) {
          setTelemetry(payload);
        }
      } catch {
        // Keep the last good payload on transient failures.
      }
    }
    void poll();
    const timer = setInterval(poll, TELEMETRY_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tripId, token, apiBaseUrl, viewMode === "details"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route history poll (details only).
  useEffect(() => {
    if (!tripId || !token || viewMode !== "details") {
      return;
    }
    const activeTripId: string = tripId;
    const accessToken: string = token;
    let active = true;
    async function poll() {
      try {
        const payload = await api.getTripRoute(apiBaseUrl, accessToken, activeTripId);
        if (active) {
          setRoute(payload);
        }
      } catch {
        // Route history is best-effort.
      }
    }
    void poll();
    const timer = setInterval(poll, ROUTE_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tripId, token, apiBaseUrl, viewMode]);

  // Weather fetch (details only), throttled and gated on GPS movement.
  useEffect(() => {
    if (!token || viewMode !== "details") {
      return;
    }
    const accessToken: string = token;
    const lat = telemetry?.latest?.lat;
    const lon = telemetry?.latest?.lon;
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return;
    }
    const currentLat = lat;
    const currentLon = lon;
    const lastLat = weatherLatRef.current;
    const lastLon = weatherLonRef.current;
    const moved =
      lastLat === null ||
      lastLon === null ||
      Math.abs(currentLat - lastLat) > WEATHER_MOVE_THRESHOLD ||
      Math.abs(currentLon - lastLon) > WEATHER_MOVE_THRESHOLD;
    if (!moved && weather) {
      return;
    }
    let active = true;
    async function fetchWeather() {
      try {
        const payload = await api.getWeather(apiBaseUrl, accessToken, currentLat, currentLon);
        if (active) {
          weatherLatRef.current = currentLat;
          weatherLonRef.current = currentLon;
          setWeather(payload);
        }
      } catch {
        // Weather is optional; the card simply stays hidden.
      }
    }
    void fetchWeather();
    const timer = setInterval(fetchWeather, WEATHER_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [telemetry?.latest?.lat, telemetry?.latest?.lon, viewMode, token, apiBaseUrl, weather]); // eslint-disable-line react-hooks/exhaustive-deps

  const speedMps = telemetry?.latest?.speed_mps ?? null;
  const totalQueued = bufferedSampleCount + (persistedQueuedCount ?? 0);
  const hasUploadIssues = queueDroppedCount > 0;

  const timeline = useMemo(() => {
    const alerts = telemetry?.recent_alerts ?? [];
    return [...alerts].reverse();
  }, [telemetry?.recent_alerts]);

  const routePoints = useMemo(() => {
    const base = route?.points ?? [];
    const latest = telemetry?.latest;
    if (latest?.lat != null && latest?.lon != null) {
      const exists = base.some((p) => p.lat === latest.lat && p.lon === latest.lon);
      if (!exists) {
        return [...base, { ts: latest.ts ?? "", lat: latest.lat, lon: latest.lon, speed_mps: latest.speed_mps, accuracy_m: latest.accuracy_m }];
      }
    }
    return base;
  }, [route?.points, telemetry?.latest]);

  const distanceKm = useMemo(() => routeDistanceKm(routePoints), [routePoints]);

  const score = telemetry?.live_score?.score;
  const riskLevel = telemetry?.live_score?.risk_level;

  return (
    <View style={styles.root}>
      {/* Mode switch — glance for driving, details for full telemetry. */}
      <View style={[styles.modeSwitch, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
        {(["glance", "details"] as ViewMode[]).map((mode) => {
          const selected = viewMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={[styles.modeOption, selected ? { backgroundColor: colors.accent } : null]}
            >
              <Text style={[styles.modeLabel, { color: selected ? "#08111C" : colors.muted }]}>
                {mode === "glance" ? t("glance_mode") : t("details_mode")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {viewMode === "glance" ? (
        <GlanceView
          speedMps={speedMps}
          uploaded={uploadedBurstCount}
          queued={totalQueued}
          mode={captureMode}
          distanceKm={distanceKm}
          onSync={onSync}
          onEndTrip={onEndTrip}
          busy={busy}
          hasUploadIssues={hasUploadIssues}
        />
      ) : (
        <DetailsView
          telemetry={telemetry}
          routePoints={routePoints}
          timeline={timeline}
          weather={weather}
          score={score}
          riskLevel={riskLevel}
          totalQueued={totalQueued}
          uploaded={uploadedBurstCount}
          distanceKm={distanceKm}
          onSync={onSync}
          onEndTrip={onEndTrip}
          busy={busy}
        />
      )}
    </View>
  );
}

function GlanceView({
  speedMps,
  uploaded,
  queued,
  mode,
  distanceKm,
  onSync,
  onEndTrip,
  busy,
  hasUploadIssues,
}: {
  speedMps: number | null;
  uploaded: number;
  queued: number;
  mode: string;
  distanceKm: number;
  onSync: () => void;
  onEndTrip: () => void;
  busy: boolean;
  hasUploadIssues: boolean;
}) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();

  return (
    <>
      <Card>
        <StatusPill label={t("trip_in_progress")} tone="good" />
        <Text style={[styles.speedHero, { color: colors.heading }]}>{kmh(speedMps)}</Text>
        <Text style={[styles.speedUnit, { color: colors.muted }]}>{t("current_speed")} · km/h</Text>
        <View style={styles.compactRow}>
          {[
            <View key="s1" style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{uploaded}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{t("samples_uploaded")}</Text>
            </View>,
            <View key="d1" style={[styles.statDivider, { backgroundColor: colors.line }]} />,
            <View key="s2" style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{queued}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{t("samples_queued")}</Text>
            </View>,
            <View key="d2" style={[styles.statDivider, { backgroundColor: colors.line }]} />,
            <View key="s3" style={styles.stat}>
              <Text style={[styles.statValue, styles.statValueSmall, { color: colors.accentStrong }]}>
                {titleCase(mode)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{t("sync_status")}</Text>
            </View>,
          ]}
        </View>
        {distanceKm > 0.02 ? (
          <Text style={[styles.glanceMeta, { color: colors.muted }]}>
            {t("distance_km")}: {distanceKm.toFixed(1)} km · {translateDynamic(titleCase(mode))}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <PrimaryButton label={t("sync_sensor_batch")} onPress={onSync} loading={busy} variant="secondary" />
          <PrimaryButton label={t("end_trip")} onPress={onEndTrip} loading={busy} variant="danger" />
        </View>
      </Card>
    </>
  );
}

function DetailsView({
  telemetry,
  routePoints,
  timeline,
  weather,
  score,
  riskLevel,
  totalQueued,
  uploaded,
  distanceKm,
  onSync,
  onEndTrip,
  busy,
}: {
  telemetry: TripTelemetry | null;
  routePoints: Array<{ lat: number; lon: number; ts: string; speed_mps?: number | null; accuracy_m?: number | null }>;
  timeline: LiveAlertMessage[];
  weather: WeatherPayload | null;
  score: number | undefined;
  riskLevel: string | undefined;
  totalQueued: number;
  uploaded: number;
  distanceKm: number;
  onSync: () => void;
  onEndTrip: () => void;
  busy: boolean;
}) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const latest = telemetry?.latest;
  const lat = latest?.lat;
  const lon = latest?.lon;
  const hasFix = lat !== null && lat !== undefined && lon !== null && lon !== undefined;
  const accelMag = latest?.accel_mag_mps2;
  const longAccel = latest?.longitudinal_accel_mps2;
  const counts = telemetry?.event_counts ?? {};

  return (
    <>
      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("live_telemetry")}</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{t("trip_in_progress")}</Text>
          </View>
          <StatusPill label={`${t("distance_km")} ${distanceKm.toFixed(1)} km`} tone="neutral" />
        </View>
        <View style={styles.compactRow}>
          {[
            <View key="s1" style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.heading }]}>{kmh(latest?.speed_mps)}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>km/h</Text>
            </View>,
            <View key="d1" style={[styles.statDivider, { backgroundColor: colors.line }]} />,
            <View key="s2" style={styles.stat}>
              <Text
                style={[
                  styles.statValue,
                  styles.statValueSmall,
                  { color: longAccel !== null && longAccel !== undefined && longAccel < -2 ? colors.highRisk : colors.accentStrong },
                ]}
              >
                {longAccel !== null && longAccel !== undefined ? `${longAccel.toFixed(1)}` : "--"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>m/s²</Text>
            </View>,
            <View key="d2" style={[styles.statDivider, { backgroundColor: colors.line }]} />,
            <View key="s3" style={styles.stat}>
              <Text style={[styles.statValue, styles.statValueSmall, { color: colors.text }]}>
                {accelMag !== null && accelMag !== undefined ? accelMag.toFixed(1) : "--"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>m/s²</Text>
            </View>,
          ]}
        </View>
        <View style={styles.tileRow}>
          <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t("location")}</Text>
            <Text style={[styles.tileValue, { color: colors.heading }]} numberOfLines={1}>
              {hasFix ? `${lat!.toFixed(4)}, ${lon!.toFixed(4)}` : t("no_gps_fix")}
            </Text>
          </View>
          <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t("samples_uploaded")}</Text>
            <Text style={[styles.tileValue, { color: colors.heading }]}>{uploaded}</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t("samples_queued")}</Text>
            <Text style={[styles.tileValue, { color: colors.heading }]}>{totalQueued}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <PrimaryButton label={t("sync_sensor_batch")} onPress={onSync} loading={busy} variant="secondary" />
          <PrimaryButton label={t("end_trip")} onPress={onEndTrip} loading={busy} variant="danger" />
        </View>
      </Card>

      {/* Live score */}
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("live_score")}</Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreValue, { color: colors.heading }]}>{score !== undefined ? score : "--"}</Text>
          <StatusPill label={translateDynamic(riskLevel ?? "unknown")} tone={riskTone(riskLevel)} />
        </View>
        <Text style={[styles.caption, { color: colors.muted }]}>{t("provisional_score")}</Text>
      </Card>

      {/* Map + route */}
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("map_and_route")}</Text>
        {routePoints.length >= 2 ? (
          <RoutePreview points={routePoints} height={200} showLegend={false} />
        ) : (
          <Text style={[styles.caption, { color: colors.muted }]}>{t("no_gps_fix")}</Text>
        )}
      </Card>

      {/* Weather */}
      {weather ? (
        <Card>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("weather")}</Text>
              <Text style={[styles.title, { color: colors.heading }]}>
                {weather.current.weather_label ?? "--"} · {weather.current.temp_c != null ? `${Math.round(weather.current.temp_c)}°C` : "--"}
              </Text>
            </View>
            {weather.stale ? (
              <StatusPill label={t("stale_weather")} tone="warn" />
            ) : (
              <StatusPill label={t("live")} tone="good" />
            )}
          </View>
          <View style={styles.tileRow}>
            <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Humidity</Text>
              <Text style={[styles.tileValue, { color: colors.heading }]}>
                {weather.current.humidity_pct != null ? `${weather.current.humidity_pct}%` : "--"}
              </Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Wind</Text>
              <Text style={[styles.tileValue, { color: colors.heading }]}>
                {weather.current.wind_kph != null ? `${Math.round(weather.current.wind_kph)} km/h` : "--"}
              </Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.tileLabel, { color: colors.muted }]}>Rain</Text>
              <Text style={[styles.tileValue, { color: colors.heading }]}>
                {weather.current.precip_mm != null ? `${weather.current.precip_mm.toFixed(1)} mm` : "--"}
              </Text>
            </View>
          </View>
          {weather.forecast.length > 0 ? (
            <View style={styles.forecastRow}>
              {weather.forecast.map((day) => (
                <View key={day.date} style={styles.forecastDay}>
                  <Text style={[styles.forecastLabel, { color: colors.muted }]}>
                    {new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                  </Text>
                  <Text style={[styles.forecastValue, { color: colors.heading }]} numberOfLines={1}>
                    {day.t_max_c != null ? `${Math.round(day.t_max_c)}°` : "--"}
                  </Text>
                  <Text style={[styles.forecastSub, { color: colors.muted }]}>
                    {day.precip_prob_pct != null ? `${day.precip_prob_pct}%` : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Event counters */}
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("event_counters")}</Text>
        {Object.keys(counts).length > 0 ? (
          <View style={styles.counterRow}>
            {Object.entries(counts).map(([eventType, count]) => (
              <View key={eventType} style={[styles.counterChip, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                <Text style={[styles.counterValue, { color: colors.highRisk }]}>{count}</Text>
                <Text style={[styles.counterLabel, { color: colors.muted }]} numberOfLines={1}>
                  {translateDynamic(titleCase(eventType.replace(/_/g, " ")))}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.caption, { color: colors.muted }]}>{t("no_events_yet")}</Text>
        )}
      </Card>

      {/* Event timeline */}
      <Card>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("event_timeline")}</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{t("live_alerts")}</Text>
          </View>
          <StatusPill label={`${telemetry?.event_total ?? 0}`} tone={telemetry?.event_total ? "warn" : "neutral"} />
        </View>
        {timeline.length > 0 ? (
          <View style={styles.listStack}>
            {timeline.map((alert, index) => {
              const event = alert.event;
              const isEmergency = event?.event_type === "emergency_brake" || event?.event_type === "severe_overspeed";
              return (
                <View
                  key={`${event?.occurred_at ?? alert.sent_at}-${index}`}
                  style={[styles.timelineRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}
                >
                  <View style={[styles.alertDot, { backgroundColor: isEmergency ? colors.highRisk : colors.accentStrong }]} />
                  <View style={styles.timelineCopy}>
                    <Text style={[styles.timelineTitle, { color: colors.heading }]} numberOfLines={1}>
                      {t(alertLabelKey(event?.event_type || "hard_brake"))}
                    </Text>
                    <Text style={[styles.timelineMeta, { color: colors.muted }]}>
                      {formatTimeAgo(event?.occurred_at ?? alert.sent_at)}
                    </Text>
                  </View>
                  <Text style={[styles.timelineValue, { color: colors.muted }]}>
                    {event?.value != null ? `${Math.abs(event.value).toFixed(1)}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.caption, { color: colors.muted }]}>{t("no_events_yet")}</Text>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  modeSwitch: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  modeOption: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  modeLabel: {
    fontSize: type.caption,
    fontWeight: "800",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  speedHero: {
    fontSize: 76,
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -2,
    lineHeight: 84,
    marginTop: spacing.sm,
  },
  speedUnit: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    marginBottom: spacing.md,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
  statValueSmall: {
    fontSize: type.section,
  },
  statLabel: {
    fontSize: type.caption,
    fontWeight: "600",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: spacing.sm,
  },
  glanceMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.heading,
  },
  tileRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tileLabel: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tileValue: {
    fontSize: type.body,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  caption: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
  },
  forecastRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  forecastDay: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  forecastLabel: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  forecastValue: {
    fontSize: type.body,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
  forecastSub: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
  },
  counterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  counterChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  counterValue: {
    fontSize: type.body,
    fontWeight: "900",
    fontFamily: fontFamily.display,
  },
  counterLabel: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    maxWidth: 140,
  },
  listStack: {
    gap: spacing.sm,
  },
  timelineRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  timelineMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
  },
  timelineValue: {
    fontSize: type.section,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
});
