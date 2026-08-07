import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { Reveal } from "../components/Motion";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonCard } from "../components/SkeletonShimmer";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import * as api from "../lib/api";
import { formatPercent, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";
import type { AdminLiveTrip } from "../types/api";

const LIVE_FLEET_POLL_MS = 5000;

type Props = {
  onOpenReview: () => void;
  onOpenTrip: (tripId: string) => Promise<void>;
};

type DriverAggregate = {
  email: string;
  tripCount: number;
  avgScore: number;
  highRiskTrips: number;
  mediumRiskTrips: number;
  pendingReviews: number;
  confidenceAvg: number;
  latestTripId: string;
};

export function AdminDashboardScreen({ onOpenReview, onOpenTrip }: Props) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { t, translateDynamic } = useI18n();
  const { apiBaseUrl, busy, healthLabel, liveAlerts, reviewItems, session } = useApp();
  const safeReviewItems = Array.isArray(reviewItems) ? reviewItems : [];
  const isWide = width >= 1080;
  const loading = safeReviewItems.length === 0 && (healthLabel === "Checking backend..." || healthLabel === "Backend unavailable" || busy);

  const [liveTrips, setLiveTrips] = useState<AdminLiveTrip[]>([]);
  const token = session?.token.access_token ?? null;

  // Phase 7: fleet-wide live monitoring. Poll active trips every few seconds.
  useEffect(() => {
    if (!token) {
      return;
    }
    const accessToken: string = token;
    let active = true;
    async function poll() {
      try {
        const payload = await api.getAdminLiveTrips(apiBaseUrl, accessToken);
        if (active) {
          setLiveTrips(Array.isArray(payload) ? payload : []);
        }
      } catch {
        // Keep the last good snapshot on transient failures.
      }
    }
    void poll();
    const timer = setInterval(poll, LIVE_FLEET_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, apiBaseUrl]);

  // NOTE: loading check must come AFTER all hooks to avoid React hook-order violations.
  // analytics is null when loading, falling through to a skeleton render below.
  const analytics = useMemo(() => {
    if (loading) return null;
    const totalTrips = safeReviewItems.length;
    const pendingReviews = safeReviewItems.filter((item) => item.review_label === null || item.review_label === undefined).length;
    const riskCounts = {
      low: safeReviewItems.filter((item) => item.risk_level === "low").length,
      medium: safeReviewItems.filter((item) => item.risk_level === "medium").length,
      high: safeReviewItems.filter((item) => item.risk_level === "high").length,
    };

    const scoreBuckets = [
      { label: "0-39", count: safeReviewItems.filter((item) => (item.score ?? -1) >= 0 && (item.score ?? -1) < 40).length },
      { label: "40-59", count: safeReviewItems.filter((item) => (item.score ?? -1) >= 40 && (item.score ?? -1) < 60).length },
      { label: "60-79", count: safeReviewItems.filter((item) => (item.score ?? -1) >= 60 && (item.score ?? -1) < 80).length },
      { label: "80-100", count: safeReviewItems.filter((item) => (item.score ?? -1) >= 80).length },
    ];

    const driverMap = new Map<string, DriverAggregate>();
    for (const item of safeReviewItems) {
      const email = item.driver_email || translateDynamic("unknown");
      const current = driverMap.get(email) || {
        email,
        tripCount: 0,
        avgScore: 0,
        highRiskTrips: 0,
        mediumRiskTrips: 0,
        pendingReviews: 0,
        confidenceAvg: 0,
        latestTripId: item.trip_id,
      };

      const nextTripCount = current.tripCount + 1;
      const score = item.score ?? 0;
      const confidence = item.confidence ?? 0;
      driverMap.set(email, {
        email,
        tripCount: nextTripCount,
        avgScore: (current.avgScore * current.tripCount + score) / nextTripCount,
        confidenceAvg: (current.confidenceAvg * current.tripCount + confidence) / nextTripCount,
        highRiskTrips: current.highRiskTrips + (item.risk_level === "high" ? 1 : 0),
        mediumRiskTrips: current.mediumRiskTrips + (item.risk_level === "medium" ? 1 : 0),
        pendingReviews: current.pendingReviews + (item.review_label === null || item.review_label === undefined ? 1 : 0),
        latestTripId: item.trip_id,
      });
    }

    const eligibleTopDrivers = [...driverMap.values()]
      .filter((driver) => driver.tripCount >= 5)
      .sort((left, right) => right.avgScore - left.avgScore);
    const bestDriver = eligibleTopDrivers[0] || null;
    const watchDrivers = [...driverMap.values()]
      .sort((left, right) => {
        const leftPressure = left.highRiskTrips * 3 + left.pendingReviews * 2 + (100 - left.avgScore);
        const rightPressure = right.highRiskTrips * 3 + right.pendingReviews * 2 + (100 - right.avgScore);
        return rightPressure - leftPressure;
      })
      .slice(0, 3);

    const recentTrips = [...safeReviewItems].slice(0, 6);
    const avgScore =
      totalTrips > 0
        ? Math.round(safeReviewItems.reduce((sum, item) => sum + (item.score ?? 0), 0) / totalTrips)
        : 0;
    const avgConfidence =
      totalTrips > 0
        ? safeReviewItems.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / totalTrips
        : 0;

    return {
      totalTrips,
      pendingReviews,
      riskCounts,
      scoreBuckets,
      bestDriver,
      watchDrivers,
      recentTrips,
      avgScore,
      avgConfidence,
    };
  }, [safeReviewItems, translateDynamic]);

  // Early return AFTER all hooks — safe for React's rules of hooks
  if (loading || !analytics) {
    return (
      <View style={styles.root}>
        <View style={[styles.hero, { backgroundColor: colors.darkSurfaceDeep }]}>
          <View style={styles.heroCopy}>
            <SkeletonCard lines={2} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" }} />
            <SkeletonCard lines={2} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" }} />
          </View>
        </View>
        <SkeletonCard lines={6} />
        <SkeletonCard lines={3} />
      </View>
    );
  }

  const riskSegments = [
    { label: translateDynamic("low"), value: analytics.riskCounts.low, color: colors.lowRisk },
    { label: translateDynamic("medium"), value: analytics.riskCounts.medium, color: colors.caution },
    { label: translateDynamic("high"), value: analytics.riskCounts.high, color: colors.highRisk },
  ];
  const maxBucket = Math.max(1, ...analytics.scoreBuckets.map((bucket) => bucket.count));

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { backgroundColor: colors.darkSurfaceDeep }]}>
        <View style={styles.heroCopy}>
          <Reveal delay={30}>
            <Text style={styles.heroEyebrow}>{t("admin_ops")}</Text>
          </Reveal>
          <Reveal delay={95}>
            <Text style={[styles.heroTitle, { color: colors.mist }]}>{t("driver_safety_command")}</Text>
          </Reveal>
          <Reveal delay={160}>
            <Text style={styles.heroText}>{t("admin_dashboard_intro")}</Text>
          </Reveal>
        </View>
        <View style={[styles.heroStats, !isWide ? styles.heroStatsStack : null]}>
          {[
            { label: t("trips_tracked"), value: String(analytics.totalTrips) },
            { label: t("need_review"), value: String(analytics.pendingReviews) },
            { label: t("average_score"), value: analytics.avgScore ? String(analytics.avgScore) : "--" },
            { label: t("average_confidence"), value: formatPercent(analytics.avgConfidence) },
          ].map((item, index) => (
            <Reveal key={item.label} delay={230 + index * 70} style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{item.label}</Text>
              <Text style={styles.heroStatValue}>{item.value}</Text>
            </Reveal>
          ))}
        </View>
      </View>

      {/* Phase 7: live fleet monitoring */}
      <Card delay={90}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("live_fleet")}</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{t("trip_in_progress")}</Text>
          </View>
          <StatusPill
            label={`${liveTrips.length} ${t("active_now")}`}
            tone={liveTrips.length ? "good" : "neutral"}
          />
        </View>

        {liveTrips.length > 0 ? (
          <View style={styles.listStack}>
            {liveTrips.map((trip) => {
              const speedKmh =
                trip.latest.speed_mps != null ? `${Math.max(0, Math.round(trip.latest.speed_mps * 3.6))} km/h` : "--";
              const tone =
                trip.connection_status === "live" ? "good" : trip.connection_status === "stale" ? "warn" : "bad";
              const connectionLabel =
                trip.connection_status === "live"
                  ? t("connection_live")
                  : trip.connection_status === "stale"
                    ? t("connection_stale")
                    : t("connection_disconnected");
              return (
                <Pressable key={trip.trip_id} onPress={() => void onOpenTrip(trip.trip_id)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                  <View style={[styles.recentRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                    <View style={styles.driverMeta}>
                      <Text style={[styles.driverLabel, { color: colors.heading }]} numberOfLines={1}>
                        {trip.driver_email || trip.trip_id.slice(0, 8)}
                      </Text>
                      <Text style={[styles.driverSubtle, { color: colors.muted }]} numberOfLines={1}>
                        {speedKmh} · {t("samples_uploaded").toLowerCase()}: {trip.samples_uploaded} · {t("events").toLowerCase()}: {trip.event_total}
                      </Text>
                    </View>
                    <View style={styles.statRow}>
                      <StatusPill label={`${trip.live_score.score}`} tone={trip.live_score.score >= 85 ? "good" : trip.live_score.score >= 65 ? "warn" : "bad"} />
                      <StatusPill label={connectionLabel} tone={tone} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.body, { color: colors.muted }]}>{t("no_active_fleet_trips")}</Text>
        )}

        {liveAlerts.length > 0 ? (
          <View style={[styles.listStack, styles.alertStack]}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("fleet_alerts")}</Text>
            {liveAlerts.slice(0, 4).map((item) => {
              const event = item.message.event;
              const isAccident = item.message.type === "accident_alert";
              const label = isAccident
                ? t("alert_accident")
                : event
                  ? event.event_type.replace(/_/g, " ")
                  : "alert";
              return (
                <View key={item.id} style={[styles.alertRow, { backgroundColor: isAccident ? "#3D1418" : colors.panelRaised, borderColor: isAccident ? "#8A2B31" : colors.line }]}>
                  <View style={[styles.alertDot, { backgroundColor: isAccident || event?.event_type === "emergency_brake" ? colors.highRisk : colors.accentStrong }]} />
                  <Text style={[styles.driverSubtle, { color: isAccident ? "#FFE3E5" : colors.heading }]} numberOfLines={1}>
                    {(item.message.trip_id ?? "").slice(0, 8)} · {label}
                    {isAccident && item.message.confidence != null ? ` · ${Math.round(item.message.confidence * 100)}%` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </Card>

      <View style={[styles.grid, isWide ? styles.gridWide : null]}>
        <Card style={styles.flexCard} delay={120}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("best_driver")}</Text>
              <Text style={[styles.title, { color: colors.heading }]}>{t("top_performer")}</Text>
            </View>
            <StatusPill label={analytics.bestDriver ? `${Math.round(analytics.bestDriver.avgScore)}` : "--"} tone="good" />
          </View>
          {analytics.bestDriver ? (
            <>
              <Text style={[styles.driverName, { color: colors.heading }]}>{analytics.bestDriver.email}</Text>
              <View style={styles.statRow}>
                <StatusPill label={`${analytics.bestDriver.tripCount} ${t("trips_word")}`} tone="neutral" />
                <StatusPill label={`${formatPercent(analytics.bestDriver.confidenceAvg)} ${t("confidence").toLowerCase()}`} tone="neutral" />
                <StatusPill label={`${analytics.bestDriver.highRiskTrips} ${t("high_risk")}`} tone={analytics.bestDriver.highRiskTrips ? "warn" : "good"} />
              </View>
              <PrimaryButton label={t("open_latest_trip")} onPress={() => void onOpenTrip(analytics.bestDriver!.latestTripId)} variant="secondary" />
            </>
          ) : (
            <Text style={[styles.body, { color: colors.muted }]}>{t("top_performer_help")}</Text>
          )}
        </Card>

        <Card style={styles.flexCard} delay={200}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("drivers_to_watch")}</Text>
              <Text style={[styles.title, { color: colors.heading }]}>{t("attention_queue")}</Text>
            </View>
            <PrimaryButton label={t("open_review")} onPress={onOpenReview} variant="secondary" />
          </View>
          <View style={styles.listStack}>
            {analytics.watchDrivers.length ? (
              analytics.watchDrivers.map((driver) => (
                <View key={driver.email} style={[styles.watchRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                  <View style={styles.driverMeta}>
                    <Text style={[styles.driverLabel, { color: colors.heading }]}>{driver.email}</Text>
                    <Text style={[styles.driverSubtle, { color: colors.muted }]}>
                      {t("pending_reviews_high_risk", { pending: driver.pendingReviews, highRisk: driver.highRiskTrips })}
                    </Text>
                  </View>
                  <StatusPill label={`${Math.round(driver.avgScore)}`} tone={driver.avgScore >= 80 ? "good" : driver.avgScore >= 55 ? "warn" : "bad"} />
                </View>
              ))
            ) : (
              <Text style={[styles.body, { color: colors.muted }]}>{t("no_watchlist_pressure")}</Text>
            )}
          </View>
        </Card>
      </View>

      <View style={[styles.grid, isWide ? styles.gridWide : null]}>
        <Card style={styles.flexCard} delay={280}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("risk_mix")}</Text>
          <Text style={[styles.title, { color: colors.heading }]}>{t("fleet_risk_breakdown")}</Text>
          <View style={[styles.stackedBar, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
            {riskSegments.map((segment) => {
              const total = Math.max(1, analytics.totalTrips);
              return <View key={segment.label} style={{ flex: segment.value / total || 0.01, backgroundColor: segment.color }} />;
            })}
          </View>
          <View style={styles.legendRow}>
            {riskSegments.map((segment) => (
              <View key={segment.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                <Text style={[styles.driverSubtle, { color: colors.text }]}>{segment.label} {segment.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.flexCard} delay={340}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("score_distribution")}</Text>
          <Text style={[styles.title, { color: colors.heading }]}>{t("trips_by_score_band")}</Text>
          <View style={styles.chartRow}>
            {analytics.scoreBuckets.map((bucket) => (
              <View key={bucket.label} style={styles.chartBarWrap}>
                <View style={[styles.chartBarTrack, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        backgroundColor: colors.accentStrong,
                        height: `${Math.max(10, (bucket.count / maxBucket) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartValue, { color: colors.heading }]}>{bucket.count}</Text>
                <Text style={[styles.chartLabel, { color: colors.muted }]}>{bucket.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      <Card delay={420}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("recent_activity")}</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{t("trips_that_just_landed")}</Text>
          </View>
          <StatusPill label={t("waiting", { count: analytics.pendingReviews })} tone={analytics.pendingReviews ? "warn" : "good"} />
        </View>
        <View style={styles.listStack}>
          {analytics.recentTrips.length ? (
            analytics.recentTrips.map((trip) => (
              <Pressable key={trip.trip_id} onPress={() => void onOpenTrip(trip.trip_id)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                <View style={[styles.recentRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                  <View style={styles.driverMeta}>
                    <Text style={[styles.driverLabel, { color: colors.heading }]}>{trip.driver_email || trip.trip_id}</Text>
                    <Text style={[styles.driverSubtle, { color: colors.muted }]}>
                      {trip.trip_id.slice(0, 8)}... {"|"} {trip.generated_event_count} {t("events").toLowerCase()}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <StatusPill label={`${trip.score ?? "--"}`} tone="neutral" />
                    <StatusPill label={titleCase(trip.risk_level || "unknown")} tone={trip.risk_level === "low" ? "good" : trip.risk_level === "medium" ? "warn" : "bad"} />
                    <StatusPill label={`${t("model_influence")} ${formatPercent(trip.ml_blend_weight)}`} tone="neutral" />
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={[styles.body, { color: colors.muted }]}>{t("no_finalized_trips_yet")}</Text>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    gap: spacing.xl,
    overflow: "hidden",
    position: "relative",
  },
  heroCopy: {
    gap: spacing.md,
  },
  heroEyebrow: {
    color: "#7DD3FC",
    fontSize: type.micro,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    letterSpacing: -1,
  },
  heroText: {
    color: "#D7E7F6",
    fontSize: type.body,
    lineHeight: 24,
    maxWidth: 620,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  heroStatsStack: {
    flexDirection: "column",
  },
  heroStat: {
    minWidth: 150,
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroStatLabel: {
    color: "#A7BED6",
    fontSize: type.micro,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroStatValue: {
    color: "#F8FBFF",
    fontSize: type.title,
    fontWeight: "800",
  },

  grid: {
    gap: spacing.lg,
  },
  gridWide: {
    flexDirection: "row",
  },
  flexCard: {
    flex: 1,
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
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: type.title,
    fontWeight: "800",
  },
  body: {
    fontSize: type.body,
    lineHeight: 22,
  },
  driverName: {
    fontSize: 26,
    fontWeight: "800",
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  listStack: {
    gap: spacing.sm,
  },
  watchRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  driverMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  driverLabel: {
    fontSize: type.body,
    fontWeight: "700",
  },
  driverSubtle: {
    fontSize: type.caption,
    lineHeight: 18,
  },
  stackedBar: {
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  chartRow: {
    minHeight: 180,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  chartBarWrap: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  chartBarTrack: {
    width: "100%",
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "flex-end",
    padding: spacing.xs,
  },
  chartBarFill: {
    width: "100%",
    borderRadius: radius.sm,
    minHeight: 10,
  },
  chartValue: {
    fontSize: type.body,
    fontWeight: "700",
  },
  chartLabel: {
    fontSize: type.caption,
  },
  recentRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  alertStack: {
    marginTop: spacing.md,
  },
  alertRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.88,
  },
});
