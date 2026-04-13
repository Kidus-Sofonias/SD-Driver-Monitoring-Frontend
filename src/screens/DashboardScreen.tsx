import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { FloatingOrb, Reveal } from "../components/Motion";
import { AnimatedScoreRing } from "../components/AnimatedScoreRing";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { dateValueOf, formatDayDateTime, formatDurationSince, formatPercent, formatWholeNumber, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  onOpenDrive: () => void;
  onOpenResults: () => void;
  onOpenTrip: (tripId: string) => Promise<void>;
  onStartTrip: () => Promise<void>;
};

export function DashboardScreen({ onOpenDrive, onOpenResults, onOpenTrip, onStartTrip }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { width } = useWindowDimensions();
  const [, setNow] = useState(Date.now());
  const {
    activeTrip,
    captureMode,
    endTrip,
    latestResult,
    pendingFinalizeTrip,
    reviewItems,
    trips,
    uploadedBurstCount,
  } = useApp();
  const isWide = width >= 1120;
  const shouldStackUploadHealth = width < 900;
  const isCompact = width < 560;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const scoredTrips = useMemo(
    () =>
      [...trips]
        .filter((trip) => trip.score !== null && trip.score !== undefined)
        .sort((left, right) => {
          const leftTime = dateValueOf(left.processed_at || left.ended_at || left.started_at);
          const rightTime = dateValueOf(right.processed_at || right.ended_at || right.started_at);
          return rightTime - leftTime;
        }),
    [trips]
  );
  const latestCompletedTrip = scoredTrips[0] ?? null;
  const latestReview = latestCompletedTrip ? reviewItems.find((item) => item.trip_id === latestCompletedTrip.id) : reviewItems[0];
  const reasons = latestResult?.reasons?.slice(0, 3) || latestReview?.reasons?.slice(0, 3) || [];
  const generatedEvents = latestResult?.events?.length ? latestResult.events : latestReview?.generated_events || [];
  const tripStateLabel = activeTrip ? t("trip_in_progress") : pendingFinalizeTrip ? t("ready_to_finalize") : t("no_active_trip");
  const tripStateTone = activeTrip ? "good" : pendingFinalizeTrip ? "warn" : "neutral";
  const primaryActionLabel = activeTrip ? "Open live trip" : pendingFinalizeTrip ? "Finalize workflow" : "Start monitoring";
  const primaryActionHandler = activeTrip ? onOpenDrive : pendingFinalizeTrip ? onOpenDrive : onStartTrip;

  return (
    <View style={styles.root}>
      <View style={[styles.hero, isWide ? styles.heroWide : null, { backgroundColor: colors.darkSurfaceDeep }]}>
        <FloatingOrb style={styles.heroOrbPrimary} duration={8600} xRange={[-10, 12]} yRange={[-10, 16]} />
        <FloatingOrb style={styles.heroOrbSecondary} duration={11200} xRange={[-12, 8]} yRange={[-6, 12]} />
        <View style={[styles.heroCopy, isWide ? styles.heroCopyWide : null]}>
          <Reveal delay={30}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroEyebrow}>Driver Monitoring System</Text>
            </View>
          </Reveal>
          <Reveal delay={100}>
            <Text style={[styles.heroTitle, { color: colors.mist }]}>Calm visibility for every trip</Text>
          </Reveal>
          <Reveal delay={160}>
            <Text style={styles.heroText}>{t("dashboard_intro")}</Text>
          </Reveal>
          <Reveal delay={230}>
            <View style={styles.heroActionRow}>
              <View style={styles.heroActionButton}>
                <PrimaryButton label={primaryActionLabel} onPress={primaryActionHandler} />
              </View>
              <StatusPill label={tripStateLabel} tone={tripStateTone} />
            </View>
          </Reveal>
        </View>
        <View style={[styles.heroStatsGrid, isWide ? styles.heroStatsGridWide : styles.heroStatsGridStack]}>
          {[
            [t("today_score"), latestResult?.score?.toString() || latestCompletedTrip?.score?.toString() || "--"],
            [t("risk"), translateDynamic(titleCase(latestResult?.risk_level || latestCompletedTrip?.risk_level || "not available"))],
            [t("confidence"), formatPercent(latestResult?.confidence ?? latestCompletedTrip?.confidence)],
            [t("events"), String(latestResult?.events_generated || latestResult?.events?.length || latestReview?.generated_event_count || 0)],
          ].map(([label, value], index) => (
            <Reveal key={label} delay={280 + index * 70} style={[styles.heroStat, !isWide ? styles.heroStatStack : null]}>
              <Text style={styles.heroStatLabel}>{label}</Text>
              <Text style={styles.heroStatValue}>{value}</Text>
            </Reveal>
          ))}
        </View>
      </View>

      <View style={[styles.row, isWide ? styles.rowWide : null]}>
        <Card style={isWide ? styles.flexCard : null} delay={120}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_lifecycle")}</Text>
              <Text style={[styles.cardTitle, { color: colors.heading }]}>{t("active_trip_monitor")}</Text>
            </View>
            <StatusPill label={tripStateLabel} tone={tripStateTone} />
          </View>

          <View style={styles.metricStrip}>
            <MetricTile
              label={activeTrip ? t("elapsed_time") : pendingFinalizeTrip ? t("ended_at") : t("elapsed_time")}
              value={
                activeTrip
                  ? formatDurationSince(activeTrip.started_at)
                  : pendingFinalizeTrip?.ended_at
                    ? formatDayDateTime(pendingFinalizeTrip.ended_at)
                    : "00:00:00"
              }
            />
            <MetricTile label={t("samples_uploaded")} value={formatWholeNumber(uploadedBurstCount)} />
            <MetricTile
              label={t("sync_status")}
              value={activeTrip ? translateDynamic(titleCase(captureMode)) : pendingFinalizeTrip ? t("paused") : t("idle")}
            />
          </View>

          <View
            style={[
              styles.uploadHealth,
              shouldStackUploadHealth ? styles.uploadHealthStack : null,
              { borderColor: colors.line, backgroundColor: colors.panelRaised },
            ]}
          >
            <View style={[styles.uploadText, shouldStackUploadHealth ? styles.uploadTextStack : null]}>
              <Text style={[styles.uploadTitle, { color: colors.heading }]}>{t("current_upload_health")}</Text>
              <Text style={[styles.uploadMeta, { color: colors.muted }]}>
                {activeTrip ? "Sensors are streaming and batches are syncing to the backend." : pendingFinalizeTrip ? "Trip capture has stopped and is waiting for final processing." : "Start a trip to begin collecting data."}
              </Text>
            </View>
            {activeTrip ? (
              <View style={[styles.inlineActions, shouldStackUploadHealth ? styles.inlineActionsStack : null]}>
                <View style={[styles.inlineActionSlot, shouldStackUploadHealth ? styles.inlineActionSlotStack : null]}>
                  <PrimaryButton label={t("open_trip")} onPress={onOpenDrive} variant="secondary" />
                </View>
                <View style={[styles.inlineActionSlot, shouldStackUploadHealth ? styles.inlineActionSlotStack : null]}>
                  <PrimaryButton label={t("end_trip")} onPress={endTrip} variant="danger" />
                </View>
              </View>
            ) : pendingFinalizeTrip ? (
              <PrimaryButton label={t("open_active_trip_page")} onPress={onOpenDrive} />
            ) : (
              <PrimaryButton label={t("start_trip")} onPress={onStartTrip} />
            )}
          </View>
        </Card>

        <Card style={isWide ? styles.flexCard : null} delay={200}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("previous_finalized_trip")}</Text>
              <Text style={[styles.cardTitle, { color: colors.heading }]}>{t("trip_result")}</Text>
            </View>
            <PrimaryButton label={t("open_results")} onPress={onOpenResults} variant="secondary" />
          </View>
          <View style={[styles.resultRow, !isWide ? styles.resultRowStack : null]}>
            <AnimatedScoreRing score={latestResult?.score ?? latestCompletedTrip?.score ?? null} size={152} />
            <View style={styles.resultSummary}>
              <Text style={[styles.cardTitle, { color: colors.heading }]}>
                {latestCompletedTrip ? translateDynamic(titleCase(latestCompletedTrip.risk_level || "trip result")) : t("no_finalized_trip")}
              </Text>
              <View style={styles.badgeRow}>
                <StatusPill
                  label={translateDynamic(titleCase(latestResult?.risk_level || latestCompletedTrip?.risk_level || "not available"))}
                  tone={
                    (latestResult?.risk_level || latestCompletedTrip?.risk_level) === "high"
                      ? "bad"
                      : (latestResult?.risk_level || latestCompletedTrip?.risk_level) === "medium"
                        ? "warn"
                      : "good"
                  }
                />
                <StatusPill label={`${t("confidence")} ${formatPercent(latestResult?.confidence ?? latestCompletedTrip?.confidence)}`} tone="neutral" />
              </View>
              <Text style={[styles.metaCopy, { color: colors.muted }]}>
                {latestCompletedTrip
                  ? formatDayDateTime(latestCompletedTrip.processed_at || latestCompletedTrip.ended_at || latestCompletedTrip.started_at)
                  : t("finalize_trip_help")}
              </Text>
            </View>
          </View>

          {reasons.length ? (
            <>
              <Text style={[styles.subsectionTitle, { color: colors.heading }]}>{t("top_reasons")}</Text>
              {reasons.map((reason) => (
                <View key={reason} style={[styles.reasonChip, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                  <Text style={[styles.reasonText, { color: colors.text }]}>{translateDynamic(reason)}</Text>
                </View>
              ))}
            </>
          ) : null}
        </Card>
      </View>

      <View style={[styles.row, isWide ? styles.rowWide : null]}>
        <Card style={isWide ? styles.flexCard : null} delay={260}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("recent_trips")}</Text>
              <Text style={[styles.cardTitle, { color: colors.heading }]}>{t("trip_history")}</Text>
            </View>
            <PrimaryButton label={t("start_trip")} onPress={onStartTrip} />
          </View>

          <View style={styles.listStack}>
            {scoredTrips.length ? (
              scoredTrips.slice(0, 4).map((trip) => (
                <Pressable key={trip.id} onPress={() => void onOpenTrip(trip.id)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                  <View style={[styles.historyRow, isCompact ? styles.historyRowCompact : null, { borderColor: colors.line, backgroundColor: colors.panelRaised }]}>
                    <View style={styles.historyText}>
                      <Text numberOfLines={1} style={[styles.historyTitle, { color: colors.heading }]}>{`TR-${trip.id.slice(0, 4).toUpperCase()}`}</Text>
                      <Text style={[styles.historyMeta, { color: colors.muted }]}>{formatDayDateTime(trip.started_at)}</Text>
                    </View>
                    <View style={[styles.historyBadges, isCompact ? styles.historyBadgesCompact : null]}>
                      <StatusPill label={`${t("today_score")} ${trip.score ?? "--"}`} tone="neutral" />
                      <StatusPill
                        label={translateDynamic(titleCase(trip.risk_level || "unknown"))}
                        tone={trip.risk_level === "high" ? "bad" : trip.risk_level === "medium" ? "warn" : "good"}
                      />
                      <StatusPill label={`${t("confidence")} ${formatPercent(trip.confidence)}`} tone="neutral" />
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={[styles.emptyCard, { borderColor: colors.line, backgroundColor: colors.panelRaised }]}>
                <Text style={[styles.historyTitle, { color: colors.heading }]}>{t("no_finalized_trips_yet")}</Text>
                <Text style={[styles.historyMeta, { color: colors.muted }]}>{t("finalized_trips_history_help")}</Text>
              </View>
            )}
          </View>
        </Card>

        <Card style={isWide ? styles.flexCard : null} delay={320}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("generated_events")}</Text>
          <Text style={[styles.cardTitle, { color: colors.heading }]}>{t("latest_event_summary")}</Text>
          <View style={styles.listStack}>
            {generatedEvents.length ? (
              generatedEvents.slice(0, 4).map((event) => {
                const severity = event.value > 7 ? "High" : event.value > 4 ? "Medium" : "Low";
                return (
                  <View key={`${event.id}-${event.event_type}`} style={[styles.eventRow, isCompact ? styles.eventRowCompact : null, { borderColor: colors.line, backgroundColor: colors.panelRaised }]}>
                    <View style={styles.historyText}>
                      <Text style={[styles.historyTitle, { color: colors.heading }]}>{translateDynamic(titleCase(event.event_type))}</Text>
                      <Text style={[styles.historyMeta, { color: colors.muted }]}>{formatDayDateTime(event.created_at)}</Text>
                    </View>
                    <StatusPill label={translateDynamic(severity)} tone={severity === "High" ? "bad" : severity === "Medium" ? "warn" : "good"} />
                  </View>
                );
              })
            ) : (
              <View style={[styles.emptyCard, { borderColor: colors.line, backgroundColor: colors.panelRaised }]}>
                <Text style={[styles.historyMeta, { color: colors.muted }]}>{t("generated_events_empty")}</Text>
              </View>
            )}
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    gap: spacing.xl,
    overflow: "hidden",
    position: "relative",
  },
  heroWide: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  heroCopy: {
    gap: spacing.md
  },
  heroCopyWide: {
    flex: 1
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)"
  },
  heroEyebrow: {
    color: "#9CC5F8",
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -1.2
  },
  heroText: {
    color: "#D4E1EF",
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 24,
    maxWidth: 520
  },
  heroActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    alignItems: "center"
  },
  heroActionButton: {
    minWidth: 210
  },
  heroStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    alignContent: "flex-start"
  },
  heroStatsGridWide: {
    flex: 1
  },
  heroStatsGridStack: {
    alignSelf: "stretch"
  },
  heroStat: {
    minWidth: 150,
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.md,
    padding: spacing.md
  },
  heroStatStack: {
    width: "100%"
  },
  heroStatLabel: {
    color: "#C1D6EE",
    fontSize: type.micro,
    fontFamily: fontFamily.body,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  heroStatValue: {
    color: "#F8FBFF",
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.display,
    marginTop: spacing.xs
  },
  heroOrbPrimary: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -56,
    right: -42,
    backgroundColor: "rgba(80, 162, 196, 0.18)",
  },
  heroOrbSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    bottom: -38,
    left: -28,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  row: {
    gap: spacing.lg
  },
  rowWide: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  flexCard: {
    flex: 1
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap"
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  cardTitle: {
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.heading,
    marginTop: spacing.xs
  },
  metricStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  uploadHealth: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.md,
    flexWrap: "wrap"
  },
  uploadHealthStack: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start"
  },
  uploadText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    flexShrink: 1
  },
  uploadTextStack: {
    width: "100%",
    minWidth: 0
  },
  uploadTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  uploadMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    lineHeight: 20
  },
  inlineActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  inlineActionsStack: {
    flexDirection: "column",
    width: "100%",
    alignSelf: "stretch"
  },
  inlineActionSlot: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0
  },
  inlineActionSlotStack: {
    width: "100%"
  },
  resultRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center"
  },
  resultRowStack: {
    flexDirection: "column",
    alignItems: "flex-start"
  },
  resultSummary: {
    flex: 1,
    gap: spacing.md
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  metaCopy: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 22
  },
  subsectionTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  reasonChip: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  reasonText: {
    fontSize: type.body,
    fontFamily: fontFamily.body
  },
  listStack: {
    gap: spacing.sm
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    flexWrap: "wrap"
  },
  historyText: {
    flex: 1,
    gap: spacing.xs
  },
  historyTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  historyMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body
  },
  emptyCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md
  },
  historyBadges: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap"
  },
  historyRowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  historyBadgesCompact: {
    width: "100%",
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  eventRowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  pressed: {
    opacity: 0.9
  }
});
