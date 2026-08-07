import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonCard } from "../components/SkeletonShimmer";
import { TextField } from "../components/TextField";
import { formatDateTime, formatWholeNumber, titleCase } from "../lib/format";
import { useI18n } from "../i18n";
import { useApp } from "../state/AppContext";
import { radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";
import type { DriverTrendWindow } from "../types/api";

type Props = {
  onBack: () => void;
  onOpenTrip: (tripId: string) => Promise<void>;
};

function renderDelta(value: number | null) {
  if (value === null || value === undefined) {
    return "--";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function AdminDriverDetailScreen({ onBack, onOpenTrip }: Props) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const {
    busy,
    deleteAdminDriver,
    saveAdminDriverCredentials,
    selectedAdminDriver,
    selectedAdminDriverInsights,
    selectedAdminDriverTrips,
  } = useApp();
  const [email, setEmail] = useState(selectedAdminDriver?.email || "");
  const [password, setPassword] = useState("");
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selectedTrendView, setSelectedTrendView] = useState<"weekly" | "monthly">("weekly");
  const [chartExpanded, setChartExpanded] = useState(false);

  useEffect(() => {
    setEmail(selectedAdminDriver?.email || "");
    setPassword("");
  }, [selectedAdminDriver]);

  // ALL hooks must be called BEFORE any early return — React rules of hooks.
  const driver = selectedAdminDriver!;
  const scoredTrips = useMemo(
    () => selectedAdminDriverTrips.filter((trip) => trip.score !== null && trip.score !== undefined),
    [selectedAdminDriverTrips]
  );
  const overallScore = useMemo(() => {
    if (!scoredTrips.length) {
      return null;
    }
    return Math.round(scoredTrips.reduce((sum, trip) => sum + (trip.score || 0), 0) / scoredTrips.length);
  }, [scoredTrips]);
  const displayedOverallScore = useMemo(
    () =>
      selectedAdminDriverInsights?.overall_average_score !== null && selectedAdminDriverInsights?.overall_average_score !== undefined
        ? Math.round(selectedAdminDriverInsights.overall_average_score)
        : overallScore,
    [selectedAdminDriverInsights?.overall_average_score, overallScore]
  );
  const activeTrendWindow = selectedAdminDriverInsights?.[selectedTrendView] ?? null;

  if (busy) {
    return (
      <View style={styles.root}>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
        <SkeletonCard lines={3} />
      </View>
    );
  }

  if (!selectedAdminDriver) {
    return (
      <Card>
        <Text style={[styles.emptyText, { color: colors.muted }]}>{t("choose_driver_from_directory")}</Text>
      </Card>
    );
  }

  function renderTrendChart(window: DriverTrendWindow, options?: { expanded?: boolean }) {
    const points = window.points;
    const maxTripCount = Math.max(1, ...points.map((point) => point.trip_count));
    const graphHeight = options?.expanded ? 240 : 170;
    const graphWidth = options?.expanded ? 860 : 620;
    const paddingX = 18;
    const paddingTop = 18;
    const paddingBottom = 28;
    const innerHeight = graphHeight - paddingTop - paddingBottom;
    const usableWidth = Math.max(1, graphWidth - paddingX * 2);
    const scorePoints = points.map((point, index) => {
      const x = points.length <= 1 ? graphWidth / 2 : paddingX + (index * usableWidth) / (points.length - 1);
      const normalizedScore = point.average_score === null ? 0.5 : Math.max(0, Math.min(1, point.average_score / 100));
      const y = paddingTop + (1 - normalizedScore) * innerHeight;
      return {
        ...point,
        x,
        y,
        hasScore: point.average_score !== null,
        tripBarHeight: Math.max(10, (point.trip_count / maxTripCount) * innerHeight),
      };
    });
    const chartTitle = selectedTrendView === "weekly" ? t("weekly_trend") : t("monthly_trend");
    const chartSubtitle = selectedTrendView === "weekly" ? t("last_8_weeks") : t("last_6_months");

    return (
      <View style={[styles.trendCard, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
        <View style={styles.trendHeader}>
          <View style={styles.trendCopy}>
            <Text style={[styles.trendTitle, { color: colors.heading }]}>{chartTitle}</Text>
            <Text style={[styles.tripSubtle, { color: colors.muted }]}>{chartSubtitle}</Text>
          </View>
          <View
            style={[
              styles.deltaBadge,
              {
                backgroundColor: window.direction === "up" ? "rgba(54,179,126,0.14)" : window.direction === "down" ? "rgba(211,80,93,0.14)" : "rgba(120,136,160,0.16)",
                borderColor: window.direction === "up" ? "rgba(54,179,126,0.28)" : window.direction === "down" ? "rgba(211,80,93,0.28)" : "rgba(120,136,160,0.28)",
              },
            ]}
          >
            <Text
              style={[
                styles.deltaBadgeText,
                {
                  color: window.direction === "up" ? "#2E8E66" : window.direction === "down" ? colors.highRisk : colors.muted,
                },
              ]}
            >
              {renderDelta(window.delta_score)}
            </Text>
          </View>
        </View>

        <View style={styles.trendMetrics}>
          <View style={styles.trendMetric}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("current_avg")}</Text>
            <Text style={[styles.trendMetricValue, { color: colors.heading }]}>
              {window.current.average_score !== null ? Math.round(window.current.average_score) : "--"}
            </Text>
          </View>
          <View style={styles.trendMetric}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("previous_avg")}</Text>
            <Text style={[styles.trendMetricValue, { color: colors.heading }]}>
              {window.previous.average_score !== null ? Math.round(window.previous.average_score) : "--"}
            </Text>
          </View>
          <View style={styles.trendMetric}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("trips_in_period")}</Text>
            <Text style={[styles.trendMetricValue, { color: colors.heading }]}>{formatWholeNumber(window.current.trip_count)}</Text>
          </View>
        </View>

        <View style={[styles.graphShell, { backgroundColor: colors.canvas, borderColor: colors.line }]}>
          <View style={[styles.graphCanvas, { height: graphHeight }]}>
            {[0, 1, 2, 3, 4].map((step) => (
              <View
                key={`grid-${step}`}
                style={[
                  styles.gridLine,
                  {
                    top: paddingTop + (innerHeight / 4) * step,
                    borderColor: colors.line,
                  },
                ]}
              />
            ))}

            {scorePoints.map((point) => (
              <View
                key={`bar-${point.period_start}`}
                style={[
                  styles.tripVolumeBar,
                  {
                    left: point.x - 10,
                    bottom: paddingBottom,
                    height: point.tripBarHeight,
                    backgroundColor: "rgba(120,136,160,0.18)",
                  },
                ]}
              />
            ))}

            {scorePoints.slice(0, -1).map((point, index) => {
              const next = scorePoints[index + 1];
              const deltaX = next.x - point.x;
              const deltaY = next.y - point.y;
              const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              const angle = Math.atan2(deltaY, deltaX);
              return (
                <View
                  key={`segment-${point.period_start}`}
                  style={[
                    styles.graphSegment,
                    {
                      left: point.x,
                      top: point.y,
                      width: length,
                      backgroundColor: colors.accentStrong,
                      transform: [{ rotateZ: `${angle}rad` }],
                    },
                  ]}
                />
              );
            })}

            {scorePoints.map((point) => (
              <View key={`dot-${point.period_start}`}>
                <View
                  style={[
                    styles.graphDot,
                    {
                      left: point.x - 6,
                      top: point.y - 6,
                      backgroundColor:
                        point.average_score === null ? "rgba(120,136,160,0.55)" : point.average_score >= 80 ? colors.lowRisk : point.average_score >= 55 ? colors.caution : colors.highRisk,
                      borderColor: colors.panel,
                    },
                  ]}
                />
                <Text style={[styles.graphValue, { left: point.x - 14, top: point.y - 28, color: colors.heading }]}>
                  {point.average_score !== null ? Math.round(point.average_score) : "--"}
                </Text>
                <Text style={[styles.graphLabel, { left: point.x - 28, bottom: 4, color: colors.muted }]} numberOfLines={1}>
                  {point.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.graphLegendRow}>
            <View style={styles.graphLegendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.accentStrong }]} />
              <Text style={[styles.tripSubtle, { color: colors.muted }]}>{t("average_safety_score")}</Text>
            </View>
            <View style={styles.graphLegendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: "rgba(120,136,160,0.24)" }]} />
              <Text style={[styles.tripSubtle, { color: colors.muted }]}>{t("trips_in_each_period")}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  async function handleSave() {
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail && !normalizedPassword) {
      return;
    }
    await saveAdminDriverCredentials(driver.id, {
      email: normalizedEmail && normalizedEmail !== driver.email ? normalizedEmail : undefined,
      password: normalizedPassword || undefined,
    });
    setPassword("");
    setEditingCredentials(false);
  }

  async function handleDelete() {
    await deleteAdminDriver(driver.id);
    setConfirmingDelete(false);
    onBack();
  }

  return (
    <View style={styles.root}>
      <Card style={[styles.hero, { backgroundColor: colors.darkSurfaceDeep }]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{t("driver_record").toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{driver.email}</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("edit_credentials")}
              onPress={() => setEditingCredentials(true)}
              style={[styles.iconButton, { borderColor: "#4F90D9", backgroundColor: "rgba(79,144,217,0.16)" }]}
            >
              <Text style={styles.iconButtonLabel}>{t("edit")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("delete_driver")}
              onPress={() => setConfirmingDelete(true)}
              style={[styles.iconButton, { borderColor: "#D3505D", backgroundColor: "rgba(211,80,93,0.16)" }]}
            >
              <Text style={styles.iconDangerLabel}>X</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>{t("overall_score")}</Text>
            <Text style={styles.summaryValue}>{displayedOverallScore ?? "--"}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>{t("scored_trips")}</Text>
            <Text style={styles.summaryValue}>{selectedAdminDriverInsights?.scored_trip_count ?? driver.trip_count}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>{t("last_trip_label")}</Text>
            <Text style={styles.summaryMeta}>{formatDateTime(driver.latest_trip_at)}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>{t("high_risk_trips")}</Text>
            <Text style={styles.summaryValue}>{selectedAdminDriverInsights?.high_risk_trip_count ?? 0}</Text>
          </View>
        </View>
      </Card>

      {selectedAdminDriverInsights ? (
        <Card>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("improvement_tracking")}</Text>
              <Text style={[styles.title, { color: colors.heading }]}>{t("driver_trend_graph")}</Text>
            </View>
            <View style={styles.chartActions}>
              <Pressable
                onPress={() => setSelectedTrendView("weekly")}
                style={[
                  styles.toggleChip,
                  {
                    backgroundColor: selectedTrendView === "weekly" ? colors.accent : colors.panelRaised,
                    borderColor: selectedTrendView === "weekly" ? colors.accentStrong : colors.line,
                  },
                ]}
              >
                <Text style={[styles.toggleChipText, { color: selectedTrendView === "weekly" ? colors.accentStrong : colors.text }]}>{t("weekly")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTrendView("monthly")}
                style={[
                  styles.toggleChip,
                  {
                    backgroundColor: selectedTrendView === "monthly" ? colors.accent : colors.panelRaised,
                    borderColor: selectedTrendView === "monthly" ? colors.accentStrong : colors.line,
                  },
                ]}
              >
                <Text style={[styles.toggleChipText, { color: selectedTrendView === "monthly" ? colors.accentStrong : colors.text }]}>{t("monthly")}</Text>
              </Pressable>
              <PrimaryButton label={t("maximize_graph")} onPress={() => setChartExpanded(true)} variant="secondary" />
            </View>
          </View>
          <Text style={[styles.chartHint, { color: colors.muted }]}>{t("trend_chart_hint")}</Text>
          {activeTrendWindow ? renderTrendChart(activeTrendWindow) : null}
        </Card>
      ) : null}

      <Card>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("trip_history")}</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{t("all_driver_trips")}</Text>
          </View>
          <PrimaryButton label={t("back_to_drivers")} onPress={onBack} variant="secondary" />
        </View>

        <View style={styles.tripList}>
          {scoredTrips.length ? (
            scoredTrips.map((trip) => (
              <Pressable key={trip.id} onPress={() => void onOpenTrip(trip.id)} style={({ pressed }) => [styles.tripRow, { backgroundColor: pressed ? colors.accent : colors.panelRaised, borderColor: pressed ? colors.accentStrong : colors.line }]}>
                  <View style={styles.tripMeta}>
                    <Text style={[styles.tripLabel, { color: colors.heading }]}>{trip.id.slice(0, 8)}...</Text>
                    <Text style={[styles.tripSubtle, { color: colors.muted }]}>
                      {t("started_time", { time: formatDateTime(trip.started_at) })}
                    </Text>
                    <Text style={[styles.tripSubtle, { color: colors.muted }]}>
                      {t("finished_time", { time: formatDateTime(trip.ended_at) })}
                    </Text>
                  </View>
                  <View style={styles.tripStats}>
                    <Text style={[styles.tripBadge, { color: colors.heading }]}>
                      {t("score_badge", { score: trip.score ?? "--" })}
                    </Text>
                    <Text style={[styles.tripSubtle, { color: colors.text }]}>
                      {titleCase(trip.risk_level || trip.status)}
                    </Text>
                  </View>
              </Pressable>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>{t("no_scored_trips_for_driver")}</Text>
          )}
        </View>
      </Card>

      <Modal visible={editingCredentials} animationType="fade" transparent onRequestClose={() => setEditingCredentials(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setEditingCredentials(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>{t("edit_credentials")}</Text>
            <TextField label={t("email")} value={email} onChangeText={setEmail} placeholder={t("driver_email_placeholder")} />
            <TextField
              label={t("new_password")}
              value={password}
              onChangeText={setPassword}
              placeholder={t("leave_blank_keep_password")}
              secureTextEntry
              allowPasswordToggle
            />
            <View style={styles.actionRow}>
              <PrimaryButton label={t("cancel")} onPress={() => setEditingCredentials(false)} variant="secondary" />
              <PrimaryButton label={t("save")} onPress={() => void handleSave()} loading={busy} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={confirmingDelete} animationType="fade" transparent onRequestClose={() => setConfirmingDelete(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setConfirmingDelete(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>{t("delete_driver")}</Text>
            <Text style={[styles.modalText, { color: colors.muted }]}>
              {t("delete_driver_confirm", { email: driver.email })}
            </Text>
            <View style={styles.actionRow}>
              <PrimaryButton label={t("cancel")} onPress={() => setConfirmingDelete(false)} variant="secondary" />
              <PrimaryButton label={t("delete")} onPress={() => void handleDelete()} loading={busy} variant="danger" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={chartExpanded} animationType="fade" transparent onRequestClose={() => setChartExpanded(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setChartExpanded(false)}>
          <Pressable style={[styles.chartModalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("expanded_analysis")}</Text>
                <Text style={[styles.title, { color: colors.heading }]}>
                  {selectedTrendView === "weekly" ? t("weekly_graph") : t("monthly_graph")}
                </Text>
              </View>
              <PrimaryButton label={t("close")} onPress={() => setChartExpanded(false)} variant="secondary" />
            </View>
            {activeTrendWindow ? renderTrendChart(activeTrendWindow, { expanded: true }) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  heroCopy: {
    gap: spacing.sm,
    flex: 1,
  },
  heroEyebrow: {
    color: "#9CC5F8",
    fontSize: type.micro,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#F8FBFF",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroText: {
    color: "#D4E1EF",
    fontSize: type.body,
    lineHeight: 24,
    maxWidth: 720,
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  iconButton: {
    borderWidth: 1,
    minWidth: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  iconButtonLabel: {
    color: "#E5F2FF",
    fontSize: type.caption,
    fontWeight: "800",
  },
  iconDangerLabel: {
    color: "#FFD7DB",
    fontSize: type.section,
    fontWeight: "900",
    lineHeight: type.section,
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  summaryTile: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
    minWidth: 150,
    flexGrow: 1,
    gap: spacing.xs,
  },
  summaryLabel: {
    color: "#C4D9F1",
    fontSize: type.micro,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  summaryValue: {
    color: "#F8FBFF",
    fontSize: type.title,
    fontWeight: "900",
  },
  summaryMeta: {
    color: "#E4EEF8",
    fontSize: type.caption,
    lineHeight: 18,
  },
  eyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: type.title,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  chartActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  trendCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    overflow: "hidden",
  },
  chartHint: {
    fontSize: type.caption,
    lineHeight: 20,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  trendCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  trendTitle: {
    fontSize: type.body,
    fontWeight: "800",
  },
  deltaBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deltaBadgeText: {
    fontSize: type.caption,
    fontWeight: "800",
  },
  trendMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  trendMetric: {
    minWidth: 110,
    flexGrow: 1,
    gap: spacing.xs,
  },
  trendMetricValue: {
    fontSize: type.section,
    fontWeight: "800",
  },
  toggleChip: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleChipText: {
    fontSize: type.caption,
    fontWeight: "800",
  },
  graphShell: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  graphCanvas: {
    minHeight: 170,
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  tripVolumeBar: {
    position: "absolute",
    width: 20,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  graphSegment: {
    position: "absolute",
    height: 3,
    borderRadius: radius.pill,
    transformOrigin: "left center",
  },
  graphDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  graphValue: {
    position: "absolute",
    width: 28,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
  },
  graphLabel: {
    position: "absolute",
    width: 56,
    textAlign: "center",
    fontSize: 11,
  },
  graphLegendRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  graphLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 18,
    height: 10,
    borderRadius: radius.sm,
  },
  tripList: {
    gap: spacing.sm,
  },
  tripRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  tripMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  tripStats: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  tripLabel: {
    fontSize: type.body,
    fontWeight: "800",
  },
  tripSubtle: {
    fontSize: type.caption,
    lineHeight: 18,
  },
  tripBadge: {
    fontSize: type.body,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: type.body,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.88,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(5, 12, 22, 0.42)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  chartModalCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: "100%",
    maxWidth: 1100,
    maxHeight: "88%",
    alignSelf: "center",
  },
  modalText: {
    fontSize: type.body,
    lineHeight: 22,
  },
});
