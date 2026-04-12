import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
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
  const { adminDrivers, reviewItems, busy, deleteAdminDriver, saveAdminDriverCredentials } = useApp();
  const [editingDriver, setEditingDriver] = useState<AdminDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<AdminDriver | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const driverPressure = useMemo(() => {
    const byDriverId = new Map<string, { pendingReviews: number; highRiskTrips: number; averageScore: number; scoreCount: number }>();
    for (const item of reviewItems) {
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
  }, [reviewItems]);

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
        <Text style={styles.heroEyebrow}>DRIVER DIRECTORY</Text>
        <Text style={styles.heroTitle}>Manage fleet access</Text>
        <Text style={styles.heroText}>
          Open any driver record to inspect their trips, rotate credentials, or remove access.
        </Text>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>All drivers</Text>
            <Text style={[styles.title, { color: colors.heading }]}>{formatWholeNumber(adminDrivers.length)} active accounts</Text>
          </View>
        </View>

        <View style={styles.list}>
          {adminDrivers.length ? (
            adminDrivers.map((driver) => {
              const pressure = driverPressure.get(driver.id);
              return (
                <View key={driver.id} style={[styles.driverRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                  <View style={styles.driverMeta}>
                    <Pressable onPress={() => void onOpenDriver(driver)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                      <Text style={[styles.driverEmail, { color: colors.heading }]}>{driver.email}</Text>
                    </Pressable>
                    <Text style={[styles.driverSubtle, { color: colors.muted }]}>
                      {driver.trip_count} trips recorded
                    </Text>
                    <Text style={[styles.driverSubtle, { color: colors.muted }]}>
                      Last trip: {formatDateTime(driver.latest_trip_at)}
                    </Text>
                    <Text style={[styles.driverSubtle, { color: colors.text }]}>
                      {pressure?.pendingReviews ?? 0} pending reviews, {pressure?.highRiskTrips ?? 0} high-risk trips
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Text style={[styles.scoreLabel, { color: colors.heading }]}>
                      {pressure?.scoreCount ? `${Math.round(pressure.averageScore)}` : "--"}
                    </Text>
                    <View style={styles.iconRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${driver.email}`}
                        onPress={() => openEdit(driver)}
                        style={[styles.iconButton, { borderColor: colors.accentStrong, backgroundColor: colors.accent }]}
                      >
                        <Text style={[styles.iconLabel, { color: colors.accentStrong }]}>✎</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${driver.email}`}
                        onPress={() => setDeletingDriver(driver)}
                        style={[styles.iconButton, { borderColor: "#D3505D", backgroundColor: "rgba(211,80,93,0.14)" }]}
                      >
                        <Text style={[styles.iconLabel, { color: "#C23A48" }]}>🗑</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>No driver accounts have been created yet.</Text>
          )}
        </View>
      </Card>

      <Modal visible={Boolean(editingDriver)} animationType="fade" transparent onRequestClose={() => setEditingDriver(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setEditingDriver(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>Edit credentials</Text>
            <Text style={[styles.modalText, { color: colors.muted }]}>
              {editingDriver?.email}
            </Text>
            <TextField label="Email" value={email} onChangeText={setEmail} placeholder="driver@example.com" />
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="Leave blank to keep current password"
              secureTextEntry
              allowPasswordToggle
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" onPress={() => setEditingDriver(null)} variant="secondary" />
              <PrimaryButton label="Save" onPress={() => void handleSaveEdit()} loading={busy} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(deletingDriver)} animationType="fade" transparent onRequestClose={() => setDeletingDriver(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setDeletingDriver(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>Delete driver</Text>
            <Text style={[styles.modalText, { color: colors.muted }]}>
              Delete {deletingDriver?.email} and all their trips? This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <PrimaryButton label="Cancel" onPress={() => setDeletingDriver(null)} variant="secondary" />
              <PrimaryButton label="Delete" onPress={() => void handleDelete()} loading={busy} variant="danger" />
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
  },
  headerCopy: {
    gap: spacing.xs,
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
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconLabel: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
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
