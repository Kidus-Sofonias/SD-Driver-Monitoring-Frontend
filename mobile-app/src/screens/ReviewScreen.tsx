import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { formatConfidence, formatDateTime, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  onOpenTripDetail: (tripId: string) => Promise<void>;
};

export function ReviewScreen({ onOpenTripDetail }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { reviewItems } = useApp();
  const safeReviewItems = Array.isArray(reviewItems) ? reviewItems : [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("finalized_trip_review")}</Text>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("review_dashboard")}</Text>
        </View>
        <StatusPill
          label={t("items_need_review", {
            count: safeReviewItems.filter((item) => item.review_label === null || item.review_label === undefined).length
          })}
          tone="warn"
        />
      </View>
      {safeReviewItems.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.text }]}>{t("review_empty")}</Text>
        </Card>
      ) : (
        safeReviewItems.map((item) => (
          <Pressable key={item.trip_id} onPress={() => void onOpenTripDetail(item.trip_id)}>
            <Card>
              <View style={styles.row}>
                <View style={styles.textBlock}>
                  <Text style={[styles.tripId, { color: colors.heading }]}>
                    {`TR-${item.trip_id.slice(0, 4).toUpperCase()}`}
                  </Text>
                  <Text style={[styles.meta, { color: colors.text }]}>{item.driver_email || formatDateTime(item.processed_at)}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>{formatDateTime(item.processed_at)}</Text>
                </View>
                <View style={styles.pillStack}>
                  <StatusPill
                    label={translateDynamic(titleCase(item.risk_level || "unknown"))}
                    tone={item.risk_level === "low" ? "good" : item.risk_level === "medium" ? "warn" : "bad"}
                  />
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: colors.text }]}>
                  {`${t("today_score")} ${item.score ?? "--"} | ${t("confidence")} ${formatConfidence(item.confidence)}`}
                </Text>
                <PrimaryButton label={t("open_trip_results")} onPress={() => void onOpenTripDetail(item.trip_id)} variant="secondary" />
              </View>
              <Text style={[styles.reasonLine, { color: colors.text }]}>
                {(Array.isArray(item.reasons) ? item.reasons : []).map((reason) => translateDynamic(reason)).join(" | ") ||
                  translateDynamic("No reasons generated.")}
              </Text>
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap"
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  sectionTitle: {
    fontSize: type.section,
    fontWeight: "700"
  },
  emptyText: {
    fontSize: type.body
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs
  },
  pillStack: {
    flexShrink: 0,
  },
  tripId: {
    fontSize: type.body,
    fontWeight: "700"
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  meta: {
    fontSize: type.body,
    lineHeight: 20
  },
  reasonLine: {
    fontSize: type.body,
    lineHeight: 21
  },
});
