import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { useI18n } from "../i18n";
import { useApp } from "../state/AppContext";
import { fontFamily, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

export function SettingsScreen() {
  const colors = useThemeColors();
  const { languageMode, t } = useI18n();
  const { healthLabel, refreshAll, setLanguageMode, setThemeMode, signOut, themeMode } = useApp();

  return (
    <View style={styles.root}>
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("connection")}</Text>
        <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("backend_settings")}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{t("backend_hidden_settings")}</Text>
        <PrimaryButton label={t("refresh_data")} onPress={refreshAll} variant="secondary" />
        <Text style={[styles.meta, { color: colors.muted }]}>{`${t("connected_health")}: ${healthLabel}`}</Text>
      </Card>

      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{t("account")}</Text>
        <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("session_theme")}</Text>
        <View style={styles.themeRow}>
          <PrimaryButton label={t("light")} onPress={() => setThemeMode("light")} variant={themeMode === "light" ? "primary" : "secondary"} />
          <PrimaryButton label={t("dark")} onPress={() => setThemeMode("dark")} variant={themeMode === "dark" ? "primary" : "secondary"} />
        </View>
        <View style={styles.themeRow}>
          <PrimaryButton label={t("english")} onPress={() => setLanguageMode("en")} variant={languageMode === "en" ? "primary" : "secondary"} />
          <PrimaryButton label={t("amharic")} onPress={() => setLanguageMode("am")} variant={languageMode === "am" ? "primary" : "secondary"} />
          <PrimaryButton label={t("oromo")} onPress={() => setLanguageMode("om")} variant={languageMode === "om" ? "primary" : "secondary"} />
        </View>
        <Text style={[styles.meta, { color: colors.muted }]}>{t("session_theme_help")}</Text>
        <PrimaryButton label={t("sign_out")} onPress={signOut} variant="danger" />
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
  sectionTitle: {
    fontSize: type.section,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  meta: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
    lineHeight: 21
  },
  themeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  }
});
