import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AnimatedScoreRing } from "../components/AnimatedScoreRing";
import { Card } from "../components/Card";
import { MetricTile } from "../components/MetricTile";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { formatConfidence, formatDateTime, formatPercent, titleCase } from "../lib/format";
import { cleanRoutePoints, haversineKm } from "../lib/route";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";
import { RoutePreview } from "./TripRoutePreview";
import type { TripRoutePoint } from "../types/api";

type Props = {
  onBack: () => void;
};

export function TripDetailScreen({ onBack }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { width } = useWindowDimensions();
  const { selectedReview, selectedTripDetail, selectedTripRoute } = useApp();
  const [mapOpen, setMapOpen] = useState(false);
  const isWide = width >= 980;
  const detail = selectedReview ?? selectedTripDetail;
  const cleanedRoutePoints = selectedTripRoute ? cleanRoutePoints(selectedTripRoute.points) : [];

  if (!detail) {
    return (
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("trip_details")}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{t("choose_trip_details")}</Text>
        <PrimaryButton label={t("back_to_history")} onPress={onBack} variant="secondary" />
      </Card>
    );
  }

  const tripId = "trip_id" in detail ? detail.trip_id : detail.id;
  const processedAt = detail.processed_at ?? ("ended_at" in detail ? detail.ended_at : null);

  return (
    <View style={styles.root}>
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_details")}</Text>
        <View style={[styles.summaryRow, isWide ? styles.summaryRowWide : null]}>
          <AnimatedScoreRing score={detail.score ?? null} size={168} />
          <View style={styles.summaryBody}>
            <View style={styles.header}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.heading }]}>{`TR-${tripId.slice(0, 4).toUpperCase()}`}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{formatDateTime(processedAt)}</Text>
              </View>
              <PrimaryButton label={t("back_to_history")} onPress={onBack} variant="secondary" />
            </View>

            <View style={styles.badgeRow}>
              <StatusPill
                label={translateDynamic(titleCase(detail.risk_level || "unknown"))}
                tone={detail.risk_level === "high" ? "bad" : detail.risk_level === "medium" ? "warn" : "good"}
              />
              <StatusPill label={`${t("confidence")} ${formatPercent(detail.confidence)}`} tone="neutral" />
            </View>

            <Text style={[styles.copy, { color: colors.muted }]}>
              {detail.reasons.length
                ? translateDynamic(detail.reasons[0])
                : t("no_reasons_for_trip")}
            </Text>
          </View>
        </View>

        <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
          <MetricTile label={t("probability")} value={formatPercent(detail.risk_probability)} />
          <MetricTile label={t("confidence")} value={formatConfidence(detail.confidence)} />
          <MetricTile label={t("processed")} value={formatDateTime(processedAt)} />
        </View>
      </Card>

      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("top_reasons")}</Text>
        {detail.reasons.length ? (
          detail.reasons.map((reason) => (
            <View key={reason} style={[styles.reasonRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.reasonText, { color: colors.text }]}>{translateDynamic(reason)}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.meta, { color: colors.muted }]}>{t("no_reasons_for_trip")}</Text>
        )}
      </Card>

      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("generated_events")}</Text>
        {detail.events.length ? (
          detail.events.map((event) => (
            <View key={`${event.id}-${event.event_type}`} style={[styles.eventRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <View style={styles.eventText}>
                <Text style={[styles.eventTitle, { color: colors.heading }]}>{translateDynamic(titleCase(event.event_type))}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{formatDateTime(event.created_at)}</Text>
              </View>
              <StatusPill label={`${Math.round(event.value)}`} tone={event.value > 7 ? "bad" : event.value > 4 ? "warn" : "good"} />
            </View>
          ))
        ) : (
          <Text style={[styles.meta, { color: colors.muted }]}>{t("no_events_for_trip")}</Text>
        )}
      </Card>

      {selectedTripRoute?.points.length ? (
        <Card>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>Historical route</Text>
          <View style={styles.routeSection}>
            <RoutePreview points={selectedTripRoute.points} snappedPoints={selectedTripRoute.snapped_points ?? []} events={detail.events} />
            <View style={[styles.routeActions, !isWide ? styles.routeActionsStack : null]}>
              <View style={styles.routeActionButton}>
                <PrimaryButton label="Open full screen map" onPress={() => setMapOpen(true)} />
              </View>
            </View>
            <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
              <MetricTile label="GPS points" value={selectedTripRoute.point_count.toString()} />
              <MetricTile label="Distance" value={formatDistanceKm(cleanedRoutePoints)} />
              <MetricTile label="Avg speed" value={formatAverageSpeedKph(cleanedRoutePoints)} />
            </View>
            <View style={[styles.routeMetaRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.routeMetaText, { color: colors.text }]}>
                Start: {formatDateTime(cleanedRoutePoints[0]?.ts || selectedTripRoute.points[0]?.ts)}
              </Text>
              <Text style={[styles.routeMetaText, { color: colors.text }]}>
                End: {formatDateTime(cleanedRoutePoints[cleanedRoutePoints.length - 1]?.ts || selectedTripRoute.points[selectedTripRoute.points.length - 1]?.ts)}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {"rule_score" in detail || "predicted_label" in detail ? (
        <Card>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_review_detail")}</Text>
          <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
            <MetricTile label={t("rule_score")} value={"rule_score" in detail ? detail.rule_score?.toString() || "--" : "--"} />
            <MetricTile label={t("predicted_label")} value={"predicted_label" in detail ? detail.predicted_label?.toString() || "--" : "--"} />
            <MetricTile label={t("events_label")} value={detail.events.length.toString()} />
          </View>
        </Card>
      ) : null}

      <Modal visible={mapOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setMapOpen(false)}>
        <View style={[styles.fullscreenMapShell, { backgroundColor: colors.canvas }]}>
          <View style={[styles.fullscreenHeader, { backgroundColor: colors.panel, borderColor: colors.line }]}>
            <View style={styles.fullscreenCopy}>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>Historical route</Text>
              <Text style={[styles.sectionTitle, { color: colors.heading }]}>Full screen map</Text>
            </View>
            <Pressable onPress={() => setMapOpen(false)} style={[styles.closeButton, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.closeButtonText, { color: colors.heading }]}>Close</Text>
            </Pressable>
          </View>
          {selectedTripRoute?.points.length ? (
            <View style={styles.fullscreenMapCard}>
              <RoutePreview
                points={selectedTripRoute.points}
                snappedPoints={selectedTripRoute.snapped_points ?? []}
                events={detail.events}
                height={Math.max(420, width * 1.2)}
                showLegend={false}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function formatDistanceKm(points: TripRoutePoint[]) {
  if (points.length < 2) {
    return "--";
  }

  let distanceKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceKm += haversineKm(points[index - 1], points[index]);
  }
  return `${distanceKm.toFixed(distanceKm >= 10 ? 1 : 2)} km`;
}

function formatAverageSpeedKph(points: TripRoutePoint[]) {
  const speeds = points.filter((point) => typeof point.speed_mps === "number").map((point) => Number(point.speed_mps) * 3.6);
  if (!speeds.length) {
    return "--";
  }
  const average = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
  return `${Math.round(average)} km/h`;
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  summaryRow: {
    gap: spacing.lg,
    alignItems: "center",
  },
  summaryRowWide: {
    flexDirection: "row",
  },
  summaryBody: {
    flex: 1,
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: type.section,
    fontWeight: "800",
    fontFamily: fontFamily.heading,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricsStack: {
    flexDirection: "column",
  },
  meta: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 21,
  },
  copy: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 22,
  },
  reasonRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  reasonText: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 21,
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  eventText: {
    flex: 1,
    gap: spacing.xs,
  },
  eventTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  routeSection: {
    gap: spacing.md,
  },
  routeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  routeActionsStack: {
    width: "100%",
  },
  routeActionButton: {
    minWidth: 220,
  },
  routeMetaRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  routeMetaText: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    lineHeight: 18,
  },
  fullscreenMapShell: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  fullscreenHeader: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  fullscreenCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  fullscreenMapCard: {
    flex: 1,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
});
