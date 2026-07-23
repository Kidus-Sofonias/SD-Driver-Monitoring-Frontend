import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { AnimatedScoreRing } from "../components/AnimatedScoreRing";
import { MetricTile } from "../components/MetricTile";
import { Reveal } from "../components/Motion";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { formatConfidence, formatDateTime, formatPercent, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

export function ResultsScreen() {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { width } = useWindowDimensions();
  const { busy, latestResult, reviewItems, retryFinalizeTrip } = useApp();
  const isWide = width >= 980;
  const reviewFallback = reviewItems[0];
  const resultTripId = latestResult?.trip_id ?? reviewFallback?.trip_id ?? null;
  const reasons = latestResult?.reasons?.length ? latestResult.reasons : reviewFallback?.reasons || [];
  const events = latestResult?.events?.length ? latestResult.events : reviewFallback?.generated_events || [];

  return (
    <View style={styles.root}>
      <Card delay={100}>
        <Reveal delay={20}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_result")}</Text>
        </Reveal>
        <View style={[styles.summaryRow, isWide ? styles.summaryRowWide : null]}>
          <Reveal delay={90}>
            <AnimatedScoreRing score={latestResult?.score ?? reviewFallback?.score ?? null} size={168} />
          </Reveal>
          <Reveal delay={150} style={styles.summaryBody}>
            <Text style={[styles.heading, { color: colors.heading }]}>{latestResult || reviewFallback ? t("latest_trip_result") : t("awaiting_finalized_trip")}</Text>
            <View style={styles.badgeRow}>
              <StatusPill
                label={translateDynamic(titleCase(latestResult?.risk_level || reviewFallback?.risk_level || "not available"))}
                tone={
                  (latestResult?.risk_level || reviewFallback?.risk_level) === "high"
                    ? "bad"
                    : (latestResult?.risk_level || reviewFallback?.risk_level) === "medium"
                      ? "warn"
                      : "good"
                }
              />
              <StatusPill label={`${t("confidence")} ${formatPercent(latestResult?.confidence ?? reviewFallback?.confidence)}`} tone="neutral" />
            </View>
            <Text style={[styles.copy, { color: colors.muted }]}>
              {latestResult
                ? t("results_page_live")
                : reviewFallback
                  ? t("results_page_fallback")
                  : t("results_page_empty")}
            </Text>
            {resultTripId ? (
              <PrimaryButton
                label={t("finalize_again")}
                onPress={() => void retryFinalizeTrip(resultTripId)}
                loading={busy}
                variant="secondary"
              />
            ) : null}
          </Reveal>
        </View>

        <View style={[styles.metricsRow, !isWide ? styles.metricsStack : null]}>
          <MetricTile label={t("probability")} value={formatPercent(latestResult?.risk_probability ?? reviewFallback?.risk_probability)} />
          <MetricTile label={t("confidence")} value={formatConfidence(latestResult?.confidence ?? reviewFallback?.confidence)} />
          <MetricTile label={t("processed")} value={latestResult?.processing_timestamp ? formatDateTime(latestResult.processing_timestamp) : reviewFallback?.processed_at ? formatDateTime(reviewFallback.processed_at) : "--"} />
        </View>
      </Card>

      <Card delay={180}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("top_reasons")}</Text>
        {reasons.map((reason) => (
          <View key={reason} style={[styles.reasonRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
            <Text style={[styles.reasonText, { color: colors.text }]}>{translateDynamic(reason)}</Text>
          </View>
        ))}
        {!reasons.length ? <Text style={[styles.copy, { color: colors.muted }]}>{t("no_reasons_yet")}</Text> : null}
      </Card>

      <Card delay={260}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("generated_events")}</Text>
        {events.length ? (
          events.slice(0, 5).map((event) => (
            <View key={`${event.id}-${event.event_type}`} style={[styles.eventRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <View style={styles.eventText}>
                <Text style={[styles.eventTitle, { color: colors.heading }]}>{translateDynamic(titleCase(event.event_type))}</Text>
                <Text style={[styles.eventMeta, { color: colors.muted }]}>{formatDateTime(event.created_at)}</Text>
              </View>
              <StatusPill label={`${Math.round(event.value)}`} tone={event.value > 7 ? "bad" : event.value > 4 ? "warn" : "good"} />
            </View>
          ))
        ) : (
          <Text style={[styles.copy, { color: colors.muted }]}>{t("events_empty_after_finalize")}</Text>
        )}
      </Card>
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
  summaryRow: {
    gap: spacing.lg,
    alignItems: "center"
  },
  summaryRowWide: {
    flexDirection: "row"
  },
  summaryBody: {
    flex: 1,
    gap: spacing.md
  },
  heading: {
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.heading
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  copy: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 22
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricsStack: {
    flexDirection: "column"
  },
  reasonRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  reasonText: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 22
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  eventText: {
    flex: 1,
    gap: spacing.xs
  },
  eventTitle: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  eventMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body
  }
});
