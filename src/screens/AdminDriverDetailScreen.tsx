import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { formatDateTime, titleCase } from "../lib/format";
import { useApp } from "../state/AppContext";
import { radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  onBack: () => void;
  onOpenTrip: (tripId: string) => Promise<void>;
};

export function AdminDriverDetailScreen({ onBack, onOpenTrip }: Props) {
  const colors = useThemeColors();
  const {
    busy,
    deleteAdminDriver,
    saveAdminDriverCredentials,
    selectedAdminDriver,
    selectedAdminDriverTrips,
  } = useApp();
  const [email, setEmail] = useState(selectedAdminDriver?.email || "");
  const [password, setPassword] = useState("");
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setEmail(selectedAdminDriver?.email || "");
    setPassword("");
  }, [selectedAdminDriver]);

  if (!selectedAdminDriver) {
    return (
      <Card>
        <Text style={[styles.emptyText, { color: colors.muted }]}>Choose a driver from the directory to manage their account.</Text>
      </Card>
    );
  }

  const driver = selectedAdminDriver;
  const scoredTrips = selectedAdminDriverTrips.filter((trip) => trip.score !== null && trip.score !== undefined);
  const overallScore = useMemo(() => {
    if (!scoredTrips.length) {
      return null;
    }
    return Math.round(scoredTrips.reduce((sum, trip) => sum + (trip.score || 0), 0) / scoredTrips.length);
  }, [scoredTrips]);

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
            <Text style={styles.heroEyebrow}>DRIVER RECORD</Text>
            <Text style={styles.heroTitle}>{driver.email}</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit driver credentials"
              onPress={() => setEditingCredentials(true)}
              style={[styles.iconButton, { borderColor: "#4F90D9", backgroundColor: "rgba(79,144,217,0.16)" }]}
            >
              <Text style={styles.iconButtonLabel}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete driver"
              onPress={() => setConfirmingDelete(true)}
              style={[styles.iconButton, { borderColor: "#D3505D", backgroundColor: "rgba(211,80,93,0.16)" }]}
            >
              <Text style={styles.iconDangerLabel}>X</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Overall score</Text>
            <Text style={styles.summaryValue}>{overallScore ?? "--"}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Trips recorded</Text>
            <Text style={styles.summaryValue}>{driver.trip_count}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Last trip</Text>
            <Text style={styles.summaryMeta}>{formatDateTime(driver.latest_trip_at)}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>Trip history</Text>
            <Text style={[styles.title, { color: colors.heading }]}>All driver trips</Text>
          </View>
          <PrimaryButton label="Back to drivers" onPress={onBack} variant="secondary" />
        </View>

        <View style={styles.tripList}>
          {scoredTrips.length ? (
            scoredTrips.map((trip) => (
              <Pressable key={trip.id} onPress={() => void onOpenTrip(trip.id)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                <View style={[styles.tripRow, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
                  <View style={styles.tripMeta}>
                    <Text style={[styles.tripLabel, { color: colors.heading }]}>{trip.id.slice(0, 8)}...</Text>
                    <Text style={[styles.tripSubtle, { color: colors.muted }]}>
                      Started {formatDateTime(trip.started_at)}
                    </Text>
                    <Text style={[styles.tripSubtle, { color: colors.muted }]}>
                      Finished {formatDateTime(trip.ended_at)}
                    </Text>
                  </View>
                  <View style={styles.tripStats}>
                    <Text style={[styles.tripBadge, { color: colors.heading }]}>
                      Score {trip.score ?? "--"}
                    </Text>
                    <Text style={[styles.tripSubtle, { color: colors.text }]}>
                      {titleCase(trip.risk_level || trip.status)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>This driver has no scored trips yet.</Text>
          )}
        </View>
      </Card>

      <Modal visible={editingCredentials} animationType="fade" transparent onRequestClose={() => setEditingCredentials(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setEditingCredentials(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>Edit driver credentials</Text>
            <TextField label="Email" value={email} onChangeText={setEmail} placeholder="driver@example.com" />
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="Leave blank to keep current password"
              secureTextEntry
              allowPasswordToggle
            />
            <View style={styles.actionRow}>
              <PrimaryButton label="Cancel" onPress={() => setEditingCredentials(false)} variant="secondary" />
              <PrimaryButton label="Save" onPress={() => void handleSave()} loading={busy} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={confirmingDelete} animationType="fade" transparent onRequestClose={() => setConfirmingDelete(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setConfirmingDelete(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.panel, borderColor: colors.line }]} onPress={() => undefined}>
            <Text style={[styles.title, { color: colors.heading }]}>Delete driver</Text>
            <Text style={[styles.modalText, { color: colors.muted }]}>
              Delete {driver.email} and all their trips? This action cannot be undone.
            </Text>
            <View style={styles.actionRow}>
              <PrimaryButton label="Cancel" onPress={() => setConfirmingDelete(false)} variant="secondary" />
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
  modalText: {
    fontSize: type.body,
    lineHeight: 22,
  },
});
