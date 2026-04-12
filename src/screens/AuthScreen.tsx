import React, { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { useI18n } from "../i18n";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

export function AuthScreen() {
  const colors = useThemeColors();
  const { languageMode, t } = useI18n();
  const { width } = useWindowDimensions();
  const { busy, healthLabel, registerAndSignIn, setLanguageMode, setThemeMode, signIn, themeMode } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isWide = width >= 980;

  async function submit() {
    if (mode === "login") {
      await signIn(email.trim(), password);
      return;
    }
    await registerAndSignIn(email.trim(), password);
  }

  return (
    <View style={[styles.root, isWide ? styles.rootWide : null]}>
      <View style={[styles.hero, isWide ? styles.heroWide : null, { backgroundColor: colors.darkSurfaceDeep }]}>
        <View style={[styles.heroBadge, { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }]}>
          <Text style={styles.eyebrow}>Driver Monitoring System</Text>
        </View>
        <Text style={[styles.title, { color: colors.mist }]}>{t("sign_in_start")}</Text>
        <Text style={[styles.subtitle, { color: "#D3E2F3" }]}>{t("auth_intro")}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Live trips</Text>
            <Text style={styles.heroStatValue}>Realtime</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Safety review</Text>
            <Text style={styles.heroStatValue}>Centralized</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Backend health</Text>
            <Text style={styles.heroStatValue}>{healthLabel}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.formColumn, isWide ? styles.formColumnWide : null]}>
        <Card>
          <Text style={[styles.formEyebrow, { color: colors.muted }]}>Access</Text>
          <Text style={[styles.formTitle, { color: colors.heading }]}>Sign in to continue</Text>
          <View style={styles.modeRow}>
            <PrimaryButton
              label={t("login")}
              onPress={() => setMode("login")}
              variant={mode === "login" ? "primary" : "secondary"}
            />
            <PrimaryButton
              label={t("register")}
              onPress={() => setMode("register")}
              variant={mode === "register" ? "primary" : "secondary"}
            />
          </View>
          <TextField label={t("email")} value={email} onChangeText={setEmail} placeholder={t("driver_email_placeholder")} />
          <TextField
            label={t("password")}
            value={password}
            onChangeText={setPassword}
            placeholder={t("password_placeholder")}
            secureTextEntry
            allowPasswordToggle
          />
          <PrimaryButton
            label={mode === "login" ? t("login_to_app") : t("register_continue")}
            onPress={submit}
            loading={busy}
          />
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>Workspace</Text>
          <Text style={[styles.connectionMeta, { color: colors.muted }]}>Choose the display mode and language for this session.</Text>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t("theme")}</Text>
          <View style={styles.modeRow}>
            <PrimaryButton label={t("light")} onPress={() => setThemeMode("light")} variant={themeMode === "light" ? "primary" : "secondary"} />
            <PrimaryButton label={t("dark")} onPress={() => setThemeMode("dark")} variant={themeMode === "dark" ? "primary" : "secondary"} />
          </View>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t("language")}</Text>
          <View style={styles.modeRow}>
            <PrimaryButton label={t("english")} onPress={() => setLanguageMode("en")} variant={languageMode === "en" ? "primary" : "secondary"} />
            <PrimaryButton label={t("amharic")} onPress={() => setLanguageMode("am")} variant={languageMode === "am" ? "primary" : "secondary"} />
            <PrimaryButton label={t("oromo")} onPress={() => setLanguageMode("om")} variant={languageMode === "om" ? "primary" : "secondary"} />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>{t("backend_status")}</Text>
          <Text style={[styles.connectionMeta, { color: colors.muted }]}>{t("backend_hidden")}</Text>
          <View style={[styles.healthPanel, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
            <Text style={[styles.healthLabel, { color: colors.muted }]}>{t("current_backend")}</Text>
            <Text style={[styles.healthValue, { color: colors.heading }]}>{healthLabel}</Text>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md
  },
  rootWide: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  hero: {
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.xxl
  },
  heroWide: {
    minHeight: 0,
    justifyContent: "center",
    flex: 1
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  eyebrow: {
    color: "#9CC5F8",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: fontFamily.heading,
    fontWeight: "700"
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -1.1
  },
  subtitle: {
    fontSize: 17,
    fontFamily: fontFamily.body,
    lineHeight: 27,
    maxWidth: 520
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.sm
  },
  heroStat: {
    minWidth: 138,
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  heroStatLabel: {
    color: "#B8D1E7",
    fontSize: type.micro,
    fontFamily: fontFamily.body,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  heroStatValue: {
    color: "#F8FBFF",
    fontSize: type.section,
    fontWeight: "800",
    fontFamily: fontFamily.heading
  },
  formColumn: {
    flex: 1,
    gap: spacing.lg
  },
  formColumnWide: {
    maxWidth: 430
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  formEyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  formTitle: {
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.heading
  },
  sectionTitle: {
    fontSize: type.section,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  },
  sectionLabel: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: spacing.xs
  },
  connectionMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body
  },
  healthPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  healthLabel: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  healthValue: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading
  }
});
