import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { formatDateTime, formatWholeNumber } from "../lib/format";
import { useApp } from "../state/AppContext";
import type { AdminDriver } from "../types/api";
import { radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  onOpenDriver: (driver: AdminDriver) => Promise<void>;
};

export function AdminDriversScreen({ onOpenDriver }: Props) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const { adminDrivers, reviewItems, busy, deleteAdminDriver, saveAdminDriverCredentials } = useApp();
  const safeAdminDrivers = Array.isArray(adminDrivers) ? adminDrivers : [];
  const safeReviewItems = Array.isArray(reviewItems) ? reviewItems : [];
  const [editingDriver, setEditingDriver] = useState<AdminDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<AdminDriver | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isCompact = width < 720;

  const driverPressure = useMemo(() => {
    const byDriverId = new Map<string, { pendingReviews: number; highRiskTrips: number; averageScore: number; scoreCount: number }>();
    for (const item of safeReviewItems) {
      if (!item.driver_user_id) {
        continue;
      }
      const current = byDriverId.get(item.driver_user_id) || {
        pendingReviews: 0,
        highRiskTrips: 0,
        averageScore: 0,
        scoreCount: 0,
      };
      const nextScoreCount = current.scoreCount + (item.score === null || item.score === undefined ? 0 : 1);
      const nextAverageScore =
        item.score === null || item.score === undefined
          ? current.averageScore
          : (current.averageScore * current.scoreCount + item.score) / nextScoreCount;

      byDriverId.set(item.driver_user_id, {
        pendingReviews: current.pendingReviews + (item.review_label === null || item.review_label === undefined ? 1 : 0),
        highRiskTrips: current.highRiskTrips + (item.risk_level === "high" ? 1 : 0),
        averageScore: nextAverageScore,
        scoreCount: nextScoreCount,
      });
    }
    return byDriverId;
  }, [safeReviewItems]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleDrivers = useMemo(() => {
    if (!normalizedSearch) {
      return safeAdminDrivers;
    }
    return safeAdminDrivers.filter((driver) => (driver.email || "").toLowerCase().includes(normalizedSearch));
  }, [safeAdminDrivers, normalizedSearch]);

  function openEdit(driver: AdminDriver) {
    setEditingDriver(driver);
    setEmail(driver.email);
    setPassword("");
  }

  async function handleSaveEdit() {
    if (!editingDriver) {
      return;
    }
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail && !normalizedPassword) {
      return;
    }
    await saveAdminDriverCredentials(editingDriver.id, {
      email: normalizedEmail && normalizedEmail !== editingDriver.email ? normalizedEmail : undefined,
      password: normalizedPassword || undefined,
    });
    setEditingDriver(null);
  }

  async function handleDelete() {
    if (!deletingDriver) {
      return;
    }
    await deleteAdminDriver(deletingDriver.id);
    setDeletingDriver(null);
  }

  return (
    <View style={styles.root}>
      <Card style={[styles.hero, { backgroundColor: colors.darkSurfaceDeep }]}>
        <Text style={styles.heroEyebrow}>{t("driver_directory")}</Text>
        <Text style={styles.heroTitle}>{t("manage_fleet_access")}</Text>
        <Text style={styles.heroText}>{t("driver_directory_intro")}</Text>
      </Card>

      <Card>
        <View style={[styles.headerRow, isCompact ? styles.headerRowStack : null]}>
          <View style={[styles.headerCopy, isCompact ? styles.headerCopyStack : null]}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("all_drivers")}</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{t("active_accounts", { count: formatWholeNumber(safeAdminDrivers.length) })}</Text>
          </View>
          <View style={[styles.searchWrap, isCompact ? styles.searchWrapStack : null]}>
            <TextField
              label={t("search_drivers")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("search_driver_placeholder")}
            />
          </View>
        </View>
        <Text style={[styles.resultsMeta, { color: colors.muted }]}>
          {t("drivers_matching", { count: formatWholeNumber(visibleDrivers.length) })}
        </Text>

        <View style={styles.list}>
          {visibleDrivers.length ? (
            visibleDrivers.map((driver) => {
              const pressure = driverPressure.get(driver.id);
              return (
                <Pressable key={driver.id} onPress={() => void onOpenDriver(driver)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                  <View style={[styles.driverRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                    <View style={styles.driverMeta}>
                      <Text style={[styles.driverEmail, { color: colors.heading }]}>{driver.email}</Text>
                      <Text style={[styles.driverSubtle, { color: colors.muted }]}>
                        {t("trips_recorded", { count: driver.trip_count })}
                      </Text>
                      <Text style={[styles.driverSubtle, { color: colors.muted }]}>
                        {t("last_trip", { time: formatDateTime(driver.latest_trip_at) })}
                      </Text>
                      <Text style={[styles.driverSubtle, { color: colors.text }]}>
                        {t("pending_reviews_high_risk", {
                          pending: pressure?.pendingReviews ?? 0,
                          highRisk: pressure?.highRiskTrips ?? 0,
                        })}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Text style={[styles.scoreLabel, { color: colors.heading }]}>
                        {pressure?.scoreCount ? `${Math.round(pressure.averageScore)}` : "--"}
                      </Text>
                      <View style={styles.iconRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${t("edit")} ${driver.email}`}
                          onPress={(e) => { e.stopPropagation(); openEdit(driver); }}
                          style={[styles.iconButton, { borderColor: colors.accentStrong, backgroundColor: colors.accent }]}
                        >
                          <Text style={[styles.iconLabel, { color: colors.accentStrong }]}>{t("edit")}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${t("delete")} ${driver.email}`}
                          onPress={(e) => { e.stopPropagation(); setDeletingDriver(driver); }}
                          style={[styles.iconButton, { borderColor: "#D3505D", backgroundColor: "rgba(211,80,93,0.14)" }]}
                        >
                          <Text style={[styles.iconLabel, { color: "#C23A48" }]}>{t("delete")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {safeAdminDrivers.length ? t("no_drivers_match_search") : t("no_driver_accounts")}
            </Text>
          )}
        </View>
      </Card>

      <Modal visible={Boolean(editingDriver)} animationType="fade" transparent onRequestClose={() => setEditingDriver(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setEditingDriver(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>{t("edit_credentials")}</Text>
            <Text style={[styles.modalText, { color: colors.muted }]}>
              {editingDriver?.email}
            </Text>
            <TextField label={t("email")} value={email} onChangeText={setEmail} placeholder={t("driver_email_placeholder")} />
            <TextField
              label={t("new_password")}
              value={password}
              onChangeText={setPassword}
              placeholder={t("leave_blank_keep_password")}
              secureTextEntry
              allowPasswordToggle
            />
            <View style={styles.modalActions}>
              <PrimaryButton label={t("cancel")} onPress={() => setEditingDriver(null)} variant="secondary" />
              <PrimaryButton label={t("save")} onPress={() => void handleSaveEdit()} loading={busy} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(deletingDriver)} animationType="fade" transparent onRequestClose={() => setDeletingDriver(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setDeletingDriver(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>{t("delete_driver")}</Text>
            <Text style={[styles.modalText, { color: colors.muted }]}>
              {t("delete_driver_confirm", { email: deletingDriver?.email || "" })}
            </Text>
            <View style={styles.modalActions}>
              <PrimaryButton label={t("cancel")} onPress={() => setDeletingDriver(null)} variant="secondary" />
              <PrimaryButton label={t("delete")} onPress={() => void handleDelete()} loading={busy} variant="danger" />
            </View>
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
  heroEyebrow: {
    color: "#9CC5F8",
    fontSize: type.micro,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#F8FBFF",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroText: {
    color: "#D4E1EF",
    fontSize: type.body,
    lineHeight: 24,
    maxWidth: 620,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  headerRowStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  headerCopy: {
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  headerCopyStack: {
    width: "100%",
  },
  searchWrap: {
    width: "100%",
    maxWidth: 320,
    minWidth: 220,
  },
  searchWrapStack: {
    maxWidth: "100%",
    minWidth: 0,
  },
  resultsMeta: {
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
  list: {
    gap: spacing.sm,
  },
  driverRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  driverMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  driverEmail: {
    fontSize: type.body,
    fontWeight: "800",
  },
  driverSubtle: {
    fontSize: type.caption,
    lineHeight: 18,
  },
  rowActions: {
    minWidth: 96,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  iconRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconButton: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  iconLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  scoreLabel: {
    fontSize: type.title,
    fontWeight: "900",
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
  modalText: {
    fontSize: type.body,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
