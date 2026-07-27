import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatusPill } from "../components/StatusPill";
import { useI18n } from "../i18n";
import { dateValueOf, formatDayDateTime, formatPercent, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";
import type { Trip } from "../types/api";

type Props = {
  onOpenTrip: (tripId: string) => Promise<void>;
  onStartTrip: () => Promise<void>;
};

type SortKey = "date" | "score" | "risk";
type FilterKey = "all" | "low" | "medium" | "high";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "score", label: "Score" },
  { key: "risk", label: "Risk" },
];

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "low", label: "Low risk" },
  { key: "medium", label: "Medium risk" },
  { key: "high", label: "High risk" },
];

export function TripsScreen({ onOpenTrip, onStartTrip }: Props) {
  const colors = useThemeColors();
  const { t, translateDynamic } = useI18n();
  const { width } = useWindowDimensions();
  const { allTrips, session, trips } = useApp();
  const isAdmin = Boolean(session?.user.is_admin);
  const isCompact = width < 560;
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [sortAsc, setSortAsc] = useState(false);

  // For admin, use allTrips; for regular users, use their own trips
  const sourceTrips = isAdmin ? allTrips : trips;
  const historyTrips = useMemo(
    () => sourceTrips.filter((trip) => trip.score !== null && trip.score !== undefined),
    [sourceTrips]
  );

  const filteredAndSortedTrips = useMemo(() => {
    let result = [...historyTrips];

    // Apply filter
    if (filterKey !== "all") {
      result = result.filter((trip) => trip.risk_level === filterKey);
    }

    // Apply sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = dateValueOf(a.started_at) - dateValueOf(b.started_at);
          break;
        case "score":
          cmp = (a.score ?? 0) - (b.score ?? 0);
          break;
        case "risk": {
          const riskOrder = { high: 3, medium: 2, low: 1 };
          cmp = (riskOrder[a.risk_level as keyof typeof riskOrder] || 0) - (riskOrder[b.risk_level as keyof typeof riskOrder] || 0);
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [historyTrips, sortKey, sortAsc, filterKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("recent_trips")}</Text>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>
            {isAdmin ? t("all_trips_history") : t("trip_history")}
          </Text>
        </View>
        {!isAdmin ? (
          <PrimaryButton label={t("start_trip")} onPress={onStartTrip} />
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <View style={styles.filterChips}>
          {FILTER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setFilterKey(opt.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filterKey === opt.key ? colors.accent : colors.panelRaised,
                  borderColor: filterKey === opt.key ? colors.accentStrong : colors.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  { color: filterKey === opt.key ? colors.accentStrong : colors.text },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Sort chips */}
      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: colors.muted }]}>Sort by:</Text>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => toggleSort(opt.key)}
            style={[
              styles.sortChip,
              {
                backgroundColor: sortKey === opt.key ? colors.accent : colors.panelRaised,
                borderColor: sortKey === opt.key ? colors.accentStrong : colors.line,
              },
            ]}
          >
            <Text
              style={[
                styles.sortChipLabel,
                { color: sortKey === opt.key ? colors.accentStrong : colors.text },
              ]}
            >
              {opt.label} {sortKey === opt.key ? (sortAsc ? "↑" : "↓") : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.resultCount, { color: colors.muted }]}>
        {filteredAndSortedTrips.length} trip{filteredAndSortedTrips.length !== 1 ? "s" : ""}
        {filterKey !== "all" ? ` (${filterKey} risk)` : ""}
      </Text>

      {filteredAndSortedTrips.length === 0 ? (
        <Card>
          <Text style={[styles.placeholder, { color: colors.muted }]}>{t("finalized_trips_history_help")}</Text>
        </Card>
      ) : (
        filteredAndSortedTrips.map((trip) => (
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
  filterRow: {
    flexDirection: "row",
  },
  filterChips: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipLabel: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  sortLabel: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  sortChipLabel: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  resultCount: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
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
