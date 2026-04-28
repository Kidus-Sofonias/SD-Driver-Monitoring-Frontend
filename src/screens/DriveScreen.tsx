import React, { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

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

  return (
    <View style={styles.root}>
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_lifecycle")}</Text>
        <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("active_trip_monitor")}</Text>
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
