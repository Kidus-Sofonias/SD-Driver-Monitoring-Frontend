import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthScreen } from "./AuthScreen";
import { AdminDashboardScreen } from "./AdminDashboardScreen";
import { AdminDriverDetailScreen } from "./AdminDriverDetailScreen";
import { AdminDriversScreen } from "./AdminDriversScreen";
import { DashboardScreen } from "./DashboardScreen";
import { DriveScreen } from "./DriveScreen";
import { ResultsScreen } from "./ResultsScreen";
import { TripDetailScreen } from "./TripDetailScreen";
import { ReviewScreen } from "./ReviewScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TripsScreen } from "./TripsScreen";
import { Card } from "../components/Card";
import { Reveal } from "../components/Motion";
import { PrimaryButton } from "../components/PrimaryButton";
import { useI18n } from "../i18n";
import { displayNameFromEmail } from "../lib/format";
import type { AdminDriver } from "../types/api";
import { useApp } from "../state/AppContext";
import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type TabKey = "dashboard" | "drive" | "results" | "trips" | "tripDetail" | "review" | "settings" | "drivers" | "driverDetail";

export function SafeDrivingApp() {
  const colors = useThemeColors();
  const { t, languageMode, translateDynamic } = useI18n();
  const {
    booting,
    clearError,
    clearSelectedAdminDriver,
    clearSelectedReview,
    clearSelectedTripDetail,
    error,
    healthLabel,
    loadAdminDriver,
    loadReview,
    loadTripDetail,
    selectedAdminDriver,
    session,
    setLanguageMode,
    setThemeMode,
    signOut,
    startTrip,
    themeMode,
  } = useApp();
  const isAdmin = Boolean(session?.user.is_admin);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [adminReturnTab, setAdminReturnTab] = useState<"review" | "drivers" | "dashboard" | "driverDetail" | "trips">("review");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageErrorSource, setPageErrorSource] = useState<string | null>(null);
  const drawerTranslate = useRef(new Animated.Value(-320)).current;
  const drawerScrollRef = useRef<ScrollView | null>(null);
  const pageScrollRef = useRef<ScrollView | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePageKey = session ? tab : "auth";
  const tabs: Array<{ key: TabKey; label: string }> = isAdmin
    ? [
        { key: "dashboard", label: t("home") },
        { key: "trips", label: t("trip_history") },
        { key: "drivers", label: t("drivers") },
        { key: "review", label: t("review_dashboard") },
        { key: "settings", label: t("settings") }
      ]
    : [
        { key: "dashboard", label: t("home") },
        { key: "drive", label: t("active_trip") },
        { key: "results", label: t("trip_results") },
        { key: "trips", label: t("trip_history") },
        { key: "settings", label: t("settings") }
      ];

  useEffect(() => {
    if (isAdmin && tab !== "dashboard" && tab !== "review" && tab !== "settings" && tab !== "tripDetail" && tab !== "drivers" && tab !== "driverDetail" && tab !== "trips") {
      setTab("dashboard");
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    if (!isAdmin && (tab === "review" || tab === "drivers" || tab === "driverDetail")) {
      setTab("dashboard");
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    if (tab === "driverDetail" && !selectedAdminDriver) {
      setTab("drivers");
    }
  }, [selectedAdminDriver, tab]);

  useEffect(() => {
    const currentUserId = session?.user.id || null;
    if (previousUserIdRef.current !== currentUserId) {
      setTab("dashboard");
      setAdminReturnTab("review");
      setMenuOpen(false);
      clearSelectedReview();
      clearSelectedTripDetail();
      clearSelectedAdminDriver();
      previousUserIdRef.current = currentUserId;
    }
  }, [clearSelectedAdminDriver, clearSelectedReview, clearSelectedTripDetail, session?.user.id]);

  useEffect(() => {
    Animated.timing(drawerTranslate, {
      toValue: menuOpen ? 0 : -320,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [drawerTranslate, menuOpen]);

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    if (!menuOpen) {
      drawerScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }
  }, [activePageKey, menuOpen]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }
    setPageError(error);
    setPageErrorSource(activePageKey);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => {
      setPageError(null);
      setPageErrorSource(null);
      clearError();
      errorTimerRef.current = null;
    }, 5000);
  }, [activePageKey, clearError, error]);

  useEffect(() => {
    if (!pageError || !pageErrorSource || pageErrorSource === activePageKey) {
      return;
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setPageError(null);
    setPageErrorSource(null);
    clearError();
  }, [activePageKey, clearError, pageError, pageErrorSource]);

  async function handleStartTrip() {
    await startTrip();
    setTab("drive");
    setMenuOpen(false);
  }

  async function handleOpenTripDetail(tripId: string) {
    // Clear stale data so the detail screen shows loading state instead of old data
    clearSelectedTripDetail();
    clearSelectedReview();
    // Navigate immediately for instant feedback, then load data in background
    setAdminReturnTab(tab === "driverDetail" ? "driverDetail" : tab === "review" ? "review" : "trips");
    setTab("tripDetail");
    setMenuOpen(false);

    if (isAdmin) {
      if (tab === "driverDetail") {
        await loadTripDetail(tripId);
      } else {
        await loadReview(tripId);
      }
    } else {
      await loadTripDetail(tripId);
    }
  }

  async function handleAdminOpenTripDetail(tripId: string) {
    // For admin viewing a review - load with review data
    clearSelectedTripDetail();
    clearSelectedReview();
    setAdminReturnTab("review");
    setTab("tripDetail");
    setMenuOpen(false);
    await loadReview(tripId);
  }

  async function handleOpenAdminDriver(driver: AdminDriver) {
    // Navigate immediately for instant feedback
    setTab("driverDetail");
    setMenuOpen(false);
    // Don't clear selectedAdminDriver here — a useEffect auto-navigates away when it's null.
    // Keep old driver visible while loading new data (loadAdminDriver overwrites it).
    await loadAdminDriver(driver);
  }

  function navigate(nextTab: TabKey) {
    setTab(nextTab);
    if (nextTab !== "tripDetail") {
      clearSelectedReview();
      clearSelectedTripDetail();
    }
    if (nextTab !== "drivers" && nextTab !== "driverDetail") {
      clearSelectedAdminDriver();
    }
    setMenuOpen(false);
  }

  const pageTitle = useMemo(() => {
    if (tab === "tripDetail") {
      return t("trip_details");
    }
    if (tab === "driverDetail") {
      return t("driver_record");
    }
    return tabs.find((item) => item.key === tab)?.label || t("safe_driving");
  }, [tab, tabs, t]);

  let content = isAdmin
    ? <AdminDashboardScreen onOpenReview={() => setTab("review")} onOpenTrip={handleOpenTripDetail} />
    : <DashboardScreen onOpenDrive={() => setTab("drive")} onOpenResults={() => setTab("results")} onOpenTrip={handleOpenTripDetail} onStartTrip={handleStartTrip} />;
  if (tab === "drive") {
    content = <DriveScreen onOpenResults={() => setTab("results")} />;
  } else if (tab === "results") {
    content = <ResultsScreen />;
  } else if (tab === "trips") {
    content = <TripsScreen onOpenTrip={handleOpenTripDetail} onStartTrip={handleStartTrip} />;
  } else if (tab === "tripDetail") {
    content = <TripDetailScreen onBack={() => setTab(isAdmin ? adminReturnTab : "trips")} />;
  } else if (tab === "review") {
    content = <ReviewScreen onOpenTripDetail={handleAdminOpenTripDetail} />;
  } else if (tab === "drivers") {
    content = <AdminDriversScreen onOpenDriver={handleOpenAdminDriver} />;
  } else if (tab === "driverDetail") {
    content = <AdminDriverDetailScreen onBack={() => setTab("drivers")} onOpenTrip={handleOpenTripDetail} />;
  } else if (tab === "settings") {
    content = <SettingsScreen />;
  } else if (tab === "dashboard" && isAdmin) {
    content = <AdminDashboardScreen onOpenReview={() => setTab("review")} onOpenTrip={handleOpenTripDetail} />;
  }

  if (booting) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accentStrong} size="large" />
        <Text style={[styles.bootText, { color: colors.text }]}>{t("loading_app")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      {menuOpen ? <Pressable style={styles.drawerScrim} onPress={() => setMenuOpen(false)} /> : null}

      {session ? (
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.canvas,
              transform: [{ translateX: drawerTranslate }],
            },
          ]}
        >
          <Card style={styles.drawerCard}>
            <ScrollView
              ref={drawerScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.drawerScrollContent}
              style={styles.drawerScroll}
            >
            <View style={[styles.profilePanel, { backgroundColor: colors.darkSurface }]}>
              <Text style={styles.profileEyebrow}>{t("signed_in_as")}</Text>
              <Text style={styles.profileName}>{displayNameFromEmail(session.user.email)}</Text>
              <Text style={styles.profileRole}>{translateDynamic(session.user.role)}</Text>
              <Text style={styles.profileRole}>{session.user.email}</Text>
              <View style={styles.healthPill}>
                <Text style={styles.healthPillText}>{healthLabel}</Text>
              </View>
            </View>
            <View style={[styles.brandPanel, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
              <Text style={[styles.brandLabel, { color: colors.muted }]}>{t("workspace")}</Text>
              <Text style={[styles.brandTitle, { color: colors.heading }]}>{t("safe_driving")}</Text>
              <Text style={[styles.brandMeta, { color: colors.muted }]}>{t("app_tagline")}</Text>
            </View>

            <View style={styles.navList}>
              {tabs.filter((item) => item.key !== "tripDetail" && item.key !== "driverDetail").map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => navigate(item.key)}
                  style={[
                    styles.sideNavButton,
                    {
                      backgroundColor: tab === item.key ? colors.accent : colors.panelRaised,
                      borderColor: tab === item.key ? colors.accentStrong : colors.line,
                    },
                  ]}
                >
                  <Text style={[styles.sideNavLabel, { color: tab === item.key ? colors.accentStrong : colors.text }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.drawerFooter}>
              <Text style={[styles.drawerSectionLabel, { color: colors.muted }]}>{t("theme")}</Text>
              <View style={styles.themeRow}>
                <PrimaryButton label={t("light")} onPress={() => setThemeMode("light")} variant={themeMode === "light" ? "primary" : "secondary"} />
                <PrimaryButton label={t("dark")} onPress={() => setThemeMode("dark")} variant={themeMode === "dark" ? "primary" : "secondary"} />
              </View>
              <Text style={[styles.drawerSectionLabel, { color: colors.muted }]}>{t("language")}</Text>
              <View style={styles.themeRow}>
                <PrimaryButton label={t("english")} onPress={() => setLanguageMode("en")} variant={languageMode === "en" ? "primary" : "secondary"} />
                <PrimaryButton label={t("amharic")} onPress={() => setLanguageMode("am")} variant={languageMode === "am" ? "primary" : "secondary"} />
                <PrimaryButton label={t("oromo")} onPress={() => setLanguageMode("om")} variant={languageMode === "om" ? "primary" : "secondary"} />
              </View>
              <PrimaryButton label={t("sign_out")} onPress={signOut} variant="danger" />
            </View>
            </ScrollView>
          </Card>
        </Animated.View>
      ) : null}

      <ScrollView
        ref={pageScrollRef}
        style={styles.pageScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageContainer}>
          {pageError ? (
            <Pressable
              style={[
                styles.errorBanner,
                { backgroundColor: "#FCE7E9", borderColor: "#F4C7CB" },
              ]}
              onPress={() => {
                if (errorTimerRef.current) {
                  clearTimeout(errorTimerRef.current);
                  errorTimerRef.current = null;
                }
                setPageError(null);
                setPageErrorSource(null);
                clearError();
              }}
            >
              <Text
                style={[styles.errorText, { color: colors.highRisk }]}
                numberOfLines={4}
                ellipsizeMode="tail"
              >
                {pageError}
              </Text>
            </Pressable>
          ) : null}

          {!session ? (
            <AuthScreen />
          ) : (
            <View style={styles.shell}>
              <Reveal delay={40}>
                <View style={[styles.topBar, { backgroundColor: colors.panel, borderColor: colors.line }]}>
                  <Pressable onPress={() => setMenuOpen(true)} style={[styles.burgerButton, { borderColor: colors.line, backgroundColor: colors.panelRaised }]}>
                    <View style={[styles.burgerLine, { backgroundColor: colors.heading }]} />
                    <View style={[styles.burgerLine, { backgroundColor: colors.heading }]} />
                    <View style={[styles.burgerLine, { backgroundColor: colors.heading }]} />
                  </Pressable>
                  <View style={styles.topBarCopy}>
                    <Text style={[styles.topBarEyebrow, { color: colors.muted }]}>{t("safe_driving")}</Text>
                    <Text style={[styles.topBarTitle, { color: colors.heading }]}>{pageTitle}</Text>
                    <Text style={[styles.topBarMeta, { color: colors.muted }]}>{session.user.email}</Text>
                  </View>
                </View>
              </Reveal>
              <View style={styles.mainContent}>{content}</View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },

  pageScroll: {
    flex: 1,
  },
  drawerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 17, 30, 0.24)",
    zIndex: 15,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 312,
    padding: spacing.md,
    zIndex: 20,
  },
  drawerCard: {
    flex: 1,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  pageContainer: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "stretch",
    marginHorizontal: "auto",
    gap: spacing.lg,
  },
  shell: {
    gap: spacing.lg,
  },
  mainContent: {
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  bootText: {
    fontSize: type.body,
    fontFamily: fontFamily.body,
  },
  profilePanel: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  profileEyebrow: {
    color: "#BFD5EB",
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  profileName: {
    color: "#F8FBFF",
    fontSize: type.title,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
  profileRole: {
    color: "#BFD5EB",
    fontSize: type.caption,
    fontFamily: fontFamily.body,
  },
  healthPill: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  healthPillText: {
    color: "#F8FBFF",
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  navList: {
    gap: spacing.xs,
  },
  brandPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  brandLabel: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  brandTitle: {
    fontSize: type.section,
    fontWeight: "800",
    fontFamily: fontFamily.heading,
  },
  brandMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
    lineHeight: 20,
  },
  sideNavButton: {
    minHeight: 48,
    borderRadius: radius.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  sideNavLabel: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
  },
  drawerFooter: {
    marginTop: "auto",
    gap: spacing.sm,
  },
  drawerSectionLabel: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  themeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  burgerButton: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  burgerLine: {
    width: 18,
    height: 2,
    borderRadius: 999,
    marginVertical: 2,
  },
  topBarCopy: {
    flex: 1,
    gap: 2,
  },
  topBarEyebrow: {
    fontSize: type.micro,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  topBarTitle: {
    fontSize: type.section,
    fontWeight: "800",
    fontFamily: fontFamily.display,
  },
  topBarMeta: {
    fontSize: type.caption,
    fontFamily: fontFamily.body,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    lineHeight: 16,
    flexShrink: 1,
  },
  // pageContainer already has alignSelf: "stretch" ensuring full width
});
