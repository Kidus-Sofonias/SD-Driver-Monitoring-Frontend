import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { formatDateTime, formatTimeAgo, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";
import { LiveTripMonitor } from "./LiveTripMonitor";

type Props = {
  onOpenResults: () => void;
};

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

export function DriveScreen({ onOpenResults }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const [, setNow] = useState(Date.now());
  const {
    activeTrip,
    busy,
    bufferedSampleCount,
    dismissLiveAlert,
    endTrip,
    finalizeTrip,
    latestResult,
    liveAlerts,
    pendingFinalizeTrip,
    startTrip,
    uploadSensorBatch,
    uploadedBurstCount,
  } = useApp();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const divider1 = <View key="d1" style={[styles.statDivider, { backgroundColor: colors.line }]} />;
  const divider2 = <View key="d2" style={[styles.statDivider, { backgroundColor: colors.line }]} />;

  const visibleAlerts = activeTrip ? liveAlerts : [];

  return (
    <View style={styles.root}>
      {visibleAlerts.length > 0 ? (
        <View style={styles.alertStack}>
          <Text style={[styles.alertEyebrow, { color: colors.muted }]}>{t("live_alerts")}</Text>
          {visibleAlerts.map((item) => {
            const event = item.message.event;
            const isEmergency = event?.event_type === "emergency_brake" || event?.event_type === "severe_overspeed";
            return (
              <Pressable
                key={item.id}
                onPress={() => dismissLiveAlert(item.id)}
                style={[
                  styles.alertBanner,
                  {
                    backgroundColor: isEmergency ? "#3D1418" : colors.panelRaised,
                    borderColor: isEmergency ? "#8A2B31" : colors.line,
                  },
                ]}
              >
                <View style={[styles.alertDot, { backgroundColor: isEmergency ? colors.highRisk : colors.accentStrong }]} />
                <View style={styles.alertCopy}>
                  <Text
                    style={[
                      styles.alertTitle,
                      { color: isEmergency ? "#FFE3E5" : colors.heading },
                    ]}
                    numberOfLines={2}
                  >
                    {t(alertLabelKey(event?.event_type || "hard_brake"))}
                  </Text>
                  <Text style={[styles.alertMeta, { color: colors.muted }]}>{"\u00b7"} {formatTimeAgo(item.message.sent_at)}</Text>
                </View>
                <Text style={[styles.alertValue, { color: colors.muted }]}>
                  {event ? `${Math.abs(event.value).toFixed(1)}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {activeTrip ? (
        <LiveTripMonitor onSync={uploadSensorBatch} onEndTrip={endTrip} busy={busy} />
      ) : (
        <Card>
          {pendingFinalizeTrip ? (
          <>
            <StatusPill label={t("trip_ended")} tone="warn" />
            <View style={styles.compactRow}>
              {[
                <View key="s1" style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{uploadedBurstCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("samples_uploaded")}</Text>
                </View>,
                divider1,
                <View key="s2" style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{bufferedSampleCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{t("samples_queued")}</Text>
                </View>,
              ]}
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {formatDateTime(pendingFinalizeTrip.started_at)} {'\u2192'} {formatDateTime(pendingFinalizeTrip.ended_at)}
              </Text>
            </View>
            <PrimaryButton label={t("finalize_trip")} onPress={finalizeTrip} loading={busy} />
          </>
        ) : (
          <>
            <Text style={[styles.prompt, { color: colors.muted }]}>{t("no_active_trip_prompt")}</Text>
            <PrimaryButton label={t("start_trip")} onPress={startTrip} loading={busy} />
          </>
        )}
        </Card>
      )}
      {latestResult ? (
        <Card>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("latest_finalized_trip")}</Text>
          <View style={styles.compactRow}>
            {[
              <View key="s1" style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.heading }]}>
                  {latestResult.score?.toString() || "--"}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{t("today_score")}</Text>
              </View>,
              divider1,
              <View key="s2" style={styles.stat}>
                <Text style={[styles.statValue, styles.statValueSmall, { color: colors.accentStrong }]}>
                  {translateDynamic(titleCase(latestResult.risk_level || "unknown"))}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{t("risk")}</Text>
              </View>,
              divider2,
              <View key="s3" style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {String(latestResult.events_generated || 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{t("events")}</Text>
              </View>,
            ]}
          </View>
          {latestResult.reasons.length > 0 ? (
            <Text style={[styles.reasonText, { color: colors.muted }]}>
              {latestResult.reasons.map((reason) => translateDynamic(reason)).join(" \u00b7 ")}
            </Text>
          ) : null}
          <PrimaryButton
            label={t("open_trip_results")}
            onPress={onOpenResults}
            variant="secondary"
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  alertStack: {
    gap: spacing.xs,
  },
  alertEyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  alertTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    flexShrink: 1,
  },
  alertMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
  },
  alertValue: {
    fontSize: type.section,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  elapsed: {
    fontSize: type.hero,
    fontWeight: "800",
    fontFamily: fontFamily.display,
    letterSpacing: -0.5,
    lineHeight: type.hero * 1.15,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metaText: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
  },
  metaBullet: {
    fontSize: type.caption,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  prompt: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  reasonText: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
});
