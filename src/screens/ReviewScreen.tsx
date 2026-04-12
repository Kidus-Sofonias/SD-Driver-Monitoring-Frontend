import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { formatConfidence, formatDateTime, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

export function ReviewScreen() {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { busy, loadReview, reviewItems, selectedReview, submitReview } = useApp();
  const [notes, setNotes] = useState("");

  async function loadTrip(tripId: string) {
    await loadReview(tripId);
    setNotes("");
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("finalized_trip_review")}</Text>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("review_dashboard")}</Text>
        </View>
        <StatusPill
          label={t("items_need_review", { count: reviewItems.filter((item) => item.review_label === null || item.review_label === undefined).length })}
          tone="warn"
        />
      </View>
      {reviewItems.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.text }]}>{t("review_empty")}</Text>
        </Card>
      ) : (
        reviewItems.map((item) => (
          <Pressable key={item.trip_id} onPress={() => loadTrip(item.trip_id)}>
            <Card>
              <View style={styles.row}>
                <View style={styles.textBlock}>
                  <Text style={[styles.tripId, { color: colors.heading }]}>{item.trip_id.slice(0, 8)}...</Text>
                  <Text style={[styles.meta, { color: colors.text }]}>{item.driver_email || formatDateTime(item.processed_at)}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>{formatDateTime(item.processed_at)}</Text>
                </View>
                <StatusPill
                  label={translateDynamic(titleCase(item.risk_level || "unknown"))}
                  tone={
                    item.risk_level === "low"
                      ? "good"
                      : item.risk_level === "medium"
                        ? "warn"
                        : "bad"
                  }
                />
              </View>
              <Text style={[styles.meta, { color: colors.text }]}>{`${t("today_score")} ${item.score ?? "--"} | ${t("confidence")} ${formatConfidence(item.confidence)}`}</Text>
              <Text style={[styles.reasonLine, { color: colors.text }]}>{item.reasons.map((reason) => translateDynamic(reason)).join(" | ") || translateDynamic("No reasons generated.")}</Text>
            </Card>
          </Pressable>
        ))
      )}

      {selectedReview ? (
        <Card>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("selected_trip")}</Text>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("trip_review_detail")}</Text>
          <Text style={[styles.meta, { color: colors.text }]}>{`${t("trip_id")}: ${selectedReview.trip_id}`}</Text>
          {selectedReview.driver_email ? <Text style={[styles.meta, { color: colors.text }]}>{selectedReview.driver_email}</Text> : null}
          <Text style={[styles.meta, { color: colors.text }]}>{`${t("predicted_label")}: ${selectedReview.predicted_label ?? "--"}`}</Text>
          <Text style={[styles.meta, { color: colors.text }]}>{`${t("rule_score")}: ${selectedReview.rule_score ?? "--"}`}</Text>
          <Text style={[styles.reasonLine, { color: colors.text }]}>{selectedReview.reasons.map((reason) => translateDynamic(reason)).join(" | ")}</Text>
          <Text style={[styles.meta, { color: colors.text }]}>
            {`${t("events_label")}: ${selectedReview.events.map((event) => translateDynamic(titleCase(event.event_type))).join(", ") || t("no_events")}`}
          </Text>
          <TextField
            label={t("review_notes")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("review_notes_placeholder")}
            multiline
            autoCapitalize="sentences"
          />
          <View style={styles.actionRow}>
            <PrimaryButton label={t("mark_safe")} onPress={() => submitReview(0, notes)} loading={busy} variant="secondary" />
            <PrimaryButton label={t("mark_risky")} onPress={() => submitReview(1, notes)} loading={busy} />
          </View>
          <PrimaryButton label={t("clear_label")} onPress={() => submitReview(null, notes)} loading={busy} variant="danger" />
        </Card>
      ) : null}
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
  tripId: {
    fontSize: type.body,
    fontWeight: "700"
  },
  meta: {
    fontSize: type.body,
    lineHeight: 20
  },
  reasonLine: {
    fontSize: type.body,
    lineHeight: 21
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  }
});
