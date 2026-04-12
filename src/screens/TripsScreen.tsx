import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { formatDayDateTime, formatPercent, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  onOpenTrip: (tripId: string) => Promise<void>;
  onStartTrip: () => Promise<void>;
};

export function TripsScreen({ onOpenTrip, onStartTrip }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { width } = useWindowDimensions();
  const { trips } = useApp();
  const historyTrips = trips.filter((trip) => trip.score !== null && trip.score !== undefined);
  const isCompact = width < 560;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("recent_trips")}</Text>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("trip_history")}</Text>
        </View>
        <PrimaryButton label={t("start_trip")} onPress={onStartTrip} />
      </View>
      {historyTrips.length === 0 ? (
        <Card>
          <Text style={[styles.placeholder, { color: colors.muted }]}>{t("finalized_trips_history_help")}</Text>
        </Card>
      ) : (
        historyTrips.map((trip) => (
          <Pressable key={trip.id} onPress={() => void onOpenTrip(trip.id)} style={({ pressed }) => (pressed ? styles.pressed : null)}>
            <Card>
              <View style={[styles.row, isCompact ? styles.rowCompact : null]}>
                <View style={styles.textBlock}>
                  <Text numberOfLines={1} style={[styles.tripId, { color: colors.heading }]}>{`TR-${trip.id.slice(0, 4).toUpperCase()}`}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>{formatDayDateTime(trip.started_at)}</Text>
                </View>
                <StatusPill
                  label={translateDynamic(titleCase(trip.risk_level || trip.status))}
                  tone={trip.risk_level === "high" ? "bad" : trip.risk_level === "medium" ? "warn" : "good"}
                />
              </View>
              <View style={styles.metrics}>
                <Text style={[styles.meta, { color: colors.muted }]}>{`${t("today_score")}: ${trip.score ?? "--"}`}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{`${t("risk")}: ${translateDynamic(titleCase(trip.risk_level || "unknown"))}`}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{`${t("confidence")}: ${formatPercent(trip.confidence)}`}</Text>
              </View>
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
    fontFamily: fontFamily.body
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  rowCompact: {
    flexDirection: "column",
    alignItems: "flex-start"
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs
  },
  tripId: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  meta: {
    fontSize: type.body,
    fontFamily: fontFamily.body
  },
  metrics: {
    gap: spacing.xs
  },
  pressed: {
    opacity: 0.92
  }
});
