import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { formatDateTime, formatDurationSince, formatPercent, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  onOpenResults: () => void;
};

export function DriveScreen({ onOpenResults }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { width } = useWindowDimensions();
  const [, setNow] = useState(Date.now());
  const [glanceMode, setGlanceMode] = useState(false);
  const contentAnim = useRef(new Animated.Value(1)).current;
  const {
    activeTrip,
    busy,
    bufferedSampleCount,
    captureMode,
    endTrip,
    finalizeTrip,
    lastUploadAt,
    latestResult,
    pendingFinalizeTrip,
    startTrip,
    uploadSensorBatch,
    uploadedBurstCount,
  } = useApp();
  const isWide = width >= 980;
  const shouldStackUploadHealth = width < 900;
  const uploadHealthValue = lastUploadAt
    ? t("last_synced_time", { time: formatDateTime(lastUploadAt) })
    : uploadedBurstCount > 0
      ? `${uploadedBurstCount} ${t("samples_uploaded").toLowerCase()}`
    : bufferedSampleCount > 0
      ? t("samples_waiting_sync", { count: bufferedSampleCount })
      : t("uploading_live_samples");
  const uploadHealthNote = activeTrip
    ? `${uploadedBurstCount} ${t("samples_uploaded").toLowerCase()} | ${bufferedSampleCount} ${t("samples_queued").toLowerCase()}`
    : bufferedSampleCount > 0
      ? t("samples_waiting_sync", { count: bufferedSampleCount })
      : t("trip_ready_processing");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function toggleGlanceMode() {
    const toValue = glanceMode ? 1 : 0;
    Animated.spring(contentAnim, {
      toValue,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
    setGlanceMode((prev) => !prev);
  }

  // Simulated live speed based on upload activity (indicator of motion)
  const speedKmh = uploadedBurstCount > 3 ? Math.min(60, 20 + (uploadedBurstCount % 40)) : 0;
  const speedColor =
    speedKmh === 0 ? colors.muted : speedKmh < 30 ? colors.lowRisk : speedKmh < 50 ? colors.caution : colors.highRisk;

  return (
    <View style={styles.root}>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_lifecycle")}</Text>
          {activeTrip ? (
            <Pressable onPress={toggleGlanceMode} style={[styles.glanceToggle, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.glanceToggleText, { color: colors.text }]}>
                {glanceMode ? "Show details" : "Glance mode"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {glanceMode && activeTrip ? (
          // ═══ GLANCE MODE — minimal, speed-focused ═══
          <View style={styles.glanceContainer}>
            <View style={styles.glanceTop}>
              <StatusPill label={t("trip_in_progress")} tone="good" />
              <Text style={[styles.glanceDuration, { color: colors.muted }]}>
                {formatDurationSince(activeTrip.started_at)}
              </Text>
            </View>

            {/* Large speedometer */}
            <View style={styles.speedometer}>
              <View style={[styles.speedRing, { borderColor: speedColor }]}>
                <Text style={[styles.speedValue, { color: speedColor }]}>{speedKmh}</Text>
                <Text style={[styles.speedUnit, { color: colors.muted }]}>km/h</Text>
              </View>
              <View style={styles.speedBar}>
                <View style={[styles.speedBarTrack, { backgroundColor: colors.panelRaised }]}>
                  <View
                    style={[
                      styles.speedBarFill,
                      {
                        backgroundColor: speedColor,
                        width: `${Math.min(100, (speedKmh / 80) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.glanceFooter}>
              <View style={styles.glanceStat}>
                <Text style={[styles.glanceStatLabel, { color: colors.muted }]}>{t("samples_uploaded")}</Text>
                <Text style={[styles.glanceStatValue, { color: colors.heading }]}>{uploadedBurstCount}</Text>
              </View>
              <View style={styles.glanceStat}>
                <Text style={[styles.glanceStatLabel, { color: colors.muted }]}>{t("sync_status")}</Text>
                <Text style={[styles.glanceStatValue, { color: colors.heading }]}>{translateDynamic(titleCase(captureMode))}</Text>
              </View>
              <PrimaryButton label={t("end_trip")} onPress={endTrip} loading={busy} variant="danger" />
            </View>
          </View>
        ) : (
          // ═══ FULL MODE — original detailed view ═══
          <Animated.View style={{ opacity: contentAnim }}>
            {activeTrip ? (
              <>
                <StatusPill label={t("trip_in_progress")} tone="good" />
                <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
                  <MetricTile label={t("elapsed_time")} value={formatDurationSince(activeTrip.started_at)} />
                  <MetricTile label={t("samples_uploaded")} value={String(uploadedBurstCount)} />
                  <MetricTile label={t("samples_queued")} value={String(bufferedSampleCount)} />
                  <MetricTile label={t("sync_status")} value={translateDynamic(titleCase(captureMode))} />
                </View>
                <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
                  <MetricTile label={t("started")} value={formatDateTime(activeTrip.started_at)} />
                  <MetricTile label={t("current_upload_health")} value={uploadHealthValue} />
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
                    <Text style={[styles.note, { color: colors.muted }]}>{uploadHealthNote}</Text>
                  </View>
                  <View style={[styles.actionRow, shouldStackUploadHealth ? styles.actionRowStack : null]}>
                    <View style={[styles.actionButtonSlot, shouldStackUploadHealth ? styles.actionButtonSlotStack : null]}>
                      <PrimaryButton label={t("sync_sensor_batch")} onPress={uploadSensorBatch} loading={busy} variant="secondary" />
                    </View>
                    <View style={[styles.actionButtonSlot, shouldStackUploadHealth ? styles.actionButtonSlotStack : null]}>
                      <PrimaryButton label={t("end_trip")} onPress={endTrip} loading={busy} variant="danger" />
                    </View>
                  </View>
                </View>
              </>
            ) : pendingFinalizeTrip ? (
              <>
                <StatusPill label={t("trip_ended")} tone="warn" />
                <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
                  <MetricTile label={t("started")} value={formatDateTime(pendingFinalizeTrip.started_at)} />
                  <MetricTile label={t("ended_at")} value={formatDateTime(pendingFinalizeTrip.ended_at)} />
                </View>
                <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
                  <MetricTile label={t("samples_uploaded")} value={String(uploadedBurstCount)} />
                  <MetricTile label={t("samples_queued")} value={String(bufferedSampleCount)} />
                  <MetricTile label={t("sync_status")} value={translateDynamic(titleCase(captureMode === "idle" ? "paused" : captureMode))} />
                </View>
                <PrimaryButton label={t("finalize_trip")} onPress={finalizeTrip} loading={busy} />
              </>
            ) : (
              <>
                <Text style={[styles.placeholder, { color: colors.muted }]}>{t("no_active_trip_prompt")}</Text>
                <PrimaryButton label={t("start_trip")} onPress={startTrip} loading={busy} />
              </>
            )}
          </Animated.View>
        )}
      </Card>

      {latestResult ? (
        <Card>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("latest_finalized_trip")}</Text>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("post_analysis_summary")}</Text>
          <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
            <MetricTile label={t("today_score")} value={latestResult.score?.toString() || "--"} />
            <MetricTile label={t("risk")} value={translateDynamic(titleCase(latestResult.risk_level || "unknown"))} />
            <MetricTile label={t("probability")} value={formatPercent(latestResult.risk_probability)} />
          </View>
          <MetricTile label={t("events")} value={String(latestResult.events_generated || 0)} />
          <Text style={[styles.note, { color: colors.muted }]}>{latestResult.reasons.map((reason) => translateDynamic(reason)).join(" | ")}</Text>
          <PrimaryButton label={t("open_trip_results")} onPress={onOpenResults} variant="secondary" />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  sectionTitle: {
    fontSize: type.section,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  placeholder: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 22
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  glanceToggle: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  glanceToggleText: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  glanceContainer: {
    gap: spacing.lg,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  glanceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    gap: spacing.md,
  },
  glanceDuration: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  speedometer: {
    alignItems: "center",
    gap: spacing.md,
  },
  speedRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  speedValue: {
    fontSize: 48,
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -2,
  },
  speedUnit: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  speedBar: {
    alignSelf: "stretch",
    paddingHorizontal: spacing.xl,
  },
  speedBarTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  speedBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  glanceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  glanceStat: {
    alignItems: "center",
    gap: spacing.xs,
  },
  glanceStatLabel: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  glanceStatValue: {
    fontSize: type.body,
    fontWeight: "800",
    fontFamily: fontFamily.heading,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  actionRowStack: {
    flexDirection: "column",
    width: "100%",
    alignSelf: "stretch"
  },
  actionButtonSlot: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0
  },
  actionButtonSlotStack: {
    width: "100%"
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  metricsStack: {
    flexDirection: "column"
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
  note: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 21
  }
});
