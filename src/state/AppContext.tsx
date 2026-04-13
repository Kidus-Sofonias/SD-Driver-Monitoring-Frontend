import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from "../config/constants";
import type { LanguageMode } from "../i18n";
import * as api from "../lib/api";
import {
  loadDismissedPendingTripIds,
  loadApiBaseUrl,
  loadLanguageMode,
  loadSession,
  loadThemeMode,
  saveDismissedPendingTripIds,
  saveApiBaseUrl,
  saveLanguageMode,
  saveSession,
  saveThemeMode
} from "../lib/storage";
import { createPhoneSensorCollector, type SensorCaptureMode } from "../services/sensorCapture";
import type { AdminDriver, FinalizeTrip, ReviewDashboardItem, ReviewTrip, Session, Trip, TripDetail, TripRoute } from "../types/api";

type AppState = {
  booting: boolean;
  busy: boolean;
  error: string | null;
  apiBaseUrl: string;
  session: Session | null;
  activeTrip: Trip | null;
  pendingFinalizeTrip: Trip | null;
  trips: Trip[];
  latestResult: FinalizeTrip | null;
  reviewItems: ReviewDashboardItem[];
  selectedReview: ReviewTrip | null;
  selectedTripDetail: TripDetail | null;
  selectedTripRoute: TripRoute | null;
  adminDrivers: AdminDriver[];
  selectedAdminDriver: AdminDriver | null;
  selectedAdminDriverTrips: Trip[];
  healthLabel: string;
  captureMode: SensorCaptureMode;
  bufferedSampleCount: number;
  uploadedBurstCount: number;
  lastUploadAt: string | null;
  dismissedPendingTripIds: string[];
  themeMode: "light" | "dark";
  languageMode: LanguageMode;
};

type AppContextValue = AppState & {
  signIn: (email: string, password: string) => Promise<void>;
  registerAndSignIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  startTrip: () => Promise<void>;
  uploadSensorBatch: () => Promise<void>;
  endTrip: () => Promise<void>;
  finalizeTrip: () => Promise<void>;
  loadReview: (tripId: string) => Promise<void>;
  loadTripDetail: (tripId: string) => Promise<void>;
  submitReview: (reviewedLabel: number | null, notes: string) => Promise<void>;
  loadAdminDriver: (driver: AdminDriver) => Promise<void>;
  saveAdminDriverCredentials: (driverId: string, updates: { email?: string; password?: string }) => Promise<void>;
  deleteAdminDriver: (driverId: string) => Promise<void>;
  clearSelectedReview: () => void;
  clearSelectedTripDetail: () => void;
  clearSelectedAdminDriver: () => void;
  setThemeMode: (mode: "light" | "dark") => Promise<void>;
  setLanguageMode: (mode: LanguageMode) => Promise<void>;
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const EMPTY_TRIP_FINALIZE_MESSAGE = "Not enough samples collected. Trip can't be finalized.";

function pickPendingFinalizeTrip(trips: Trip[], dismissedPendingTripIds: string[]) {
  return (
    [...trips]
      .filter(
        (trip) =>
          trip.status !== "active" &&
          (trip.score === null || trip.score === undefined) &&
          !dismissedPendingTripIds.includes(trip.id)
      )
      .sort((left, right) => {
        const leftTime = new Date(left.ended_at || left.started_at).getTime();
        const rightTime = new Date(right.ended_at || right.started_at).getTime();
        return rightTime - leftTime;
      })[0] ?? null
  );
}

function hasNotEnoughSamplesError(payload: { breakdown?: Record<string, unknown> } | null | undefined) {
  if (!payload?.breakdown || typeof payload.breakdown !== "object") {
    return false;
  }

  const directError = (payload.breakdown as { error?: unknown }).error;
  if (directError === "not_enough_samples") {
    return true;
  }

  const ruleBreakdown = (payload.breakdown as { rule_breakdown?: unknown }).rule_breakdown;
  if (!ruleBreakdown || typeof ruleBreakdown !== "object") {
    return false;
  }

  return (ruleBreakdown as { error?: unknown }).error === "not_enough_samples";
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return message.includes("not_enough_samples") ? EMPTY_TRIP_FINALIZE_MESSAGE : message;
}

export function AppProvider({ children }: PropsWithChildren) {
  const collectorRef = useRef(createPhoneSensorCollector());
  const [state, setState] = useState<AppState>({
    booting: true,
    busy: false,
    error: null,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    session: null,
    activeTrip: null,
    pendingFinalizeTrip: null,
    trips: [],
    latestResult: null,
    reviewItems: [],
    selectedReview: null,
    selectedTripDetail: null,
    selectedTripRoute: null,
    adminDrivers: [],
    selectedAdminDriver: null,
    selectedAdminDriverTrips: [],
    healthLabel: "Backend not checked",
    captureMode: "idle",
    bufferedSampleCount: 0,
    uploadedBurstCount: 0,
    lastUploadAt: null,
    dismissedPendingTripIds: [],
    themeMode: "light",
    languageMode: "en"
  });

  function dismissPendingTrip(tripId: string) {
    setState((current) => {
      const dismissedPendingTripIds = current.dismissedPendingTripIds.includes(tripId)
        ? current.dismissedPendingTripIds
        : [...current.dismissedPendingTripIds, tripId];

      void saveDismissedPendingTripIds(dismissedPendingTripIds);

      return {
        ...current,
        pendingFinalizeTrip: null,
        uploadedBurstCount: 0,
        lastUploadAt: null,
        dismissedPendingTripIds
      };
    });
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  async function hydrateRemoteState(apiBaseUrl: string, initialSession: Session | null) {
    const initialToken = initialSession?.token.access_token || null;
    let nextSession = initialSession;
    let nextHealthLabel = "Backend unavailable";

    try {
      const health = await api.getHealth(apiBaseUrl);
      nextHealthLabel = `${health.data.service} ${health.data.version}`;
    } catch {
      nextHealthLabel = "Backend unavailable";
    }

    if (nextSession) {
      try {
        await api.me(apiBaseUrl, nextSession);
      } catch {
        nextSession = null;
        await saveSession(null);
      }
    }

    setState((current) => {
      const currentToken = current.session?.token.access_token || null;
      const sessionChangedSinceBootstrap = currentToken !== initialToken;

      return {
        ...current,
        healthLabel: nextHealthLabel,
        session: sessionChangedSinceBootstrap ? current.session : nextSession
      };
    });

    if (nextSession) {
      try {
        await refreshAllInternal(apiBaseUrl, nextSession);
      } catch (error) {
        setState((current) => ({
          ...current,
          error: getErrorMessage(error)
        }));
      }
    }
  }

  async function bootstrap() {
    try {
      const [rawStoredSession, storedApiBaseUrl, storedThemeMode, storedLanguageMode, dismissedPendingTripIds] = await Promise.all([
        loadSession(),
        loadApiBaseUrl(),
        loadThemeMode(),
        loadLanguageMode(),
        loadDismissedPendingTripIds()
      ]);
      const apiBaseUrl = normalizeApiBaseUrl(storedApiBaseUrl || DEFAULT_API_BASE_URL);
      const themeMode = storedThemeMode || "light";
      const languageMode = storedLanguageMode || "en";
      const session = rawStoredSession;

      setState((current) => ({
        ...current,
        booting: false,
        apiBaseUrl,
        session,
        healthLabel: "Checking backend...",
        captureMode: collectorRef.current.snapshot().mode,
        bufferedSampleCount: collectorRef.current.snapshot().bufferedCount,
        dismissedPendingTripIds,
        themeMode,
        languageMode
      }));

      void hydrateRemoteState(apiBaseUrl, session);
    } catch (error) {
      setState((current) => ({
        ...current,
        booting: false,
        error: getErrorMessage(error)
      }));
    }
  }

  async function refreshAllInternal(apiBaseUrl: string, session: Session) {
    const [activeTrip, trips, reviewItems, adminDrivers] = await Promise.all([
      api.getActiveTrip(apiBaseUrl, session.token.access_token),
      api.listTrips(apiBaseUrl, session.token.access_token),
      session.user.is_admin ? api.getReviewDashboard(apiBaseUrl, session.token.access_token) : Promise.resolve([]),
      session.user.is_admin ? api.getAdminDrivers(apiBaseUrl, session.token.access_token) : Promise.resolve([])
    ]);
    if (activeTrip) {
      await collectorRef.current.start();
    } else {
      await collectorRef.current.stop();
    }
    const collectorSnapshot = collectorRef.current.snapshot();
    const unresolvedTrip =
      activeTrip ??
      [...trips]
        .filter((trip) => trip.status !== "active" && (trip.score === null || trip.score === undefined))
        .sort((left, right) => {
          const leftTime = new Date(left.ended_at || left.started_at).getTime();
          const rightTime = new Date(right.ended_at || right.started_at).getTime();
          return rightTime - leftTime;
        })[0] ??
      null;
    const uploadedBurstCount = unresolvedTrip
      ? (await api.getTripSampleCount(apiBaseUrl, session.token.access_token, unresolvedTrip.id)).count
      : 0;

    setState((current) => {
      const pendingFinalizeTrip = pickPendingFinalizeTrip(trips, current.dismissedPendingTripIds);

      return {
        ...current,
        activeTrip,
        pendingFinalizeTrip,
        trips,
        reviewItems,
        adminDrivers,
        captureMode: collectorSnapshot.mode,
        bufferedSampleCount: collectorSnapshot.bufferedCount,
        uploadedBurstCount,
        lastUploadAt: uploadedBurstCount > 0 ? current.lastUploadAt : null
      };
    });
  }

  async function runBusy<T>(task: () => Promise<T>) {
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      return await task();
    } catch (error) {
      setState((current) => ({ ...current, error: getErrorMessage(error) }));
      throw error;
    } finally {
      setState((current) => ({ ...current, busy: false }));
    }
  }

  async function signIn(email: string, password: string) {
    await runBusy(async () => {
      const response = await api.login(state.apiBaseUrl, email, password);
      const session: Session = {
        user: response.data.user,
        token: response.data.token
      };
      await saveSession(session);
      setState((current) => ({ ...current, session }));
      await refreshAllInternal(state.apiBaseUrl, session);
    });
  }

  async function registerAndSignIn(email: string, password: string) {
    await runBusy(async () => {
      await api.register(state.apiBaseUrl, email, password);
      const response = await api.login(state.apiBaseUrl, email, password);
      const session: Session = {
        user: response.data.user,
        token: response.data.token
      };
      await saveSession(session);
      setState((current) => ({ ...current, session }));
      await refreshAllInternal(state.apiBaseUrl, session);
    });
  }

  async function signOut() {
    await collectorRef.current.stop();
    await saveSession(null);
    setState((current) => ({
      ...current,
      session: null,
      activeTrip: null,
      pendingFinalizeTrip: null,
      trips: [],
      latestResult: null,
      reviewItems: [],
      selectedReview: null,
      selectedTripDetail: null,
      selectedTripRoute: null,
      adminDrivers: [],
      selectedAdminDriver: null,
      selectedAdminDriverTrips: [],
      captureMode: "idle",
      bufferedSampleCount: 0,
      uploadedBurstCount: 0,
      lastUploadAt: null
    }));
  }

  async function setApiUrl(url: string) {
    const normalized = normalizeApiBaseUrl(url);
    await saveApiBaseUrl(normalized);
    setState((current) => ({ ...current, apiBaseUrl: normalized }));
  }

  async function setThemeMode(mode: "light" | "dark") {
    await saveThemeMode(mode);
    setState((current) => ({ ...current, themeMode: mode }));
  }

  async function setLanguageMode(mode: LanguageMode) {
    await saveLanguageMode(mode);
    setState((current) => ({ ...current, languageMode: mode }));
  }

  async function refreshAll() {
    if (!state.session) {
      return;
    }
    await runBusy(async () => {
      const health = await api.getHealth(state.apiBaseUrl);
      setState((current) => ({
        ...current,
        healthLabel: `${health.data.service} ${health.data.version}`
      }));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  async function startTrip() {
    if (!state.session) {
      return;
    }
    if (state.activeTrip) {
      return;
    }
    await runBusy(async () => {
      let collectorSnapshot = collectorRef.current.snapshot();
      try {
        collectorSnapshot = await collectorRef.current.start();
        const trip = await api.startTrip(state.apiBaseUrl, state.session!.token.access_token);
        setState((current) => ({
          ...current,
          activeTrip: trip,
          pendingFinalizeTrip: null,
          latestResult: null,
          selectedReview: null,
          selectedTripDetail: null,
          selectedTripRoute: null,
          dismissedPendingTripIds: current.dismissedPendingTripIds.filter((id) => id !== trip.id),
          captureMode: collectorSnapshot.mode,
          bufferedSampleCount: collectorSnapshot.bufferedCount,
          uploadedBurstCount: 0,
          lastUploadAt: null
        }));
        void saveDismissedPendingTripIds(state.dismissedPendingTripIds.filter((id) => id !== trip.id));
        await refreshAllInternal(state.apiBaseUrl, state.session as Session);
      } catch (error) {
        await collectorRef.current.stop();
        throw error;
      }
    });
  }

  async function uploadSensorBatch() {
    if (!state.session || !state.activeTrip) {
      return;
    }
    await runBusy(async () => {
      const samples = collectorRef.current.drainSamples();
      if (!samples.length) {
        throw new Error("Waiting for the first live sensor samples.");
      }
      const uploadResult = await api.uploadSamples(
        state.apiBaseUrl,
        state.session!.token.access_token,
        state.activeTrip!.id,
        samples
      );
      const collectorSnapshot = collectorRef.current.snapshot();
      setState((current) => ({
        ...current,
        captureMode: collectorSnapshot.mode,
        bufferedSampleCount: collectorSnapshot.bufferedCount,
        uploadedBurstCount: current.uploadedBurstCount + uploadResult.inserted,
        lastUploadAt: new Date().toISOString()
      }));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  async function endTrip() {
    if (!state.session || !state.activeTrip) {
      return;
    }
    await runBusy(async () => {
      const pendingSamples = collectorRef.current.drainSamples({ fallbackToDemo: false });
      if (pendingSamples.length) {
        const uploadResult = await api.uploadSamples(
          state.apiBaseUrl,
          state.session!.token.access_token,
          state.activeTrip!.id,
          pendingSamples
        );
        setState((current) => ({
          ...current,
          uploadedBurstCount: current.uploadedBurstCount + uploadResult.inserted,
          lastUploadAt: new Date().toISOString()
        }));
      }
      const trip = await api.endTrip(
        state.apiBaseUrl,
        state.session!.token.access_token,
        state.activeTrip!.id
      );
      const collectorSnapshot = await collectorRef.current.stop();
      setState((current) => ({
        ...current,
        activeTrip: trip.status === "active" ? trip : null,
        pendingFinalizeTrip: trip.status === "active" ? current.pendingFinalizeTrip : trip,
        captureMode: collectorSnapshot.mode,
        bufferedSampleCount: collectorSnapshot.bufferedCount,
        uploadedBurstCount: current.uploadedBurstCount,
        lastUploadAt: current.lastUploadAt
      }));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  async function finalizeTrip() {
    if (!state.session || (!state.activeTrip && !state.pendingFinalizeTrip)) {
      return;
    }
    await runBusy(async () => {
      const tripToFinalize = state.pendingFinalizeTrip || state.activeTrip;
      const serverSampleCount = (await api.getTripSampleCount(
        state.apiBaseUrl,
        state.session!.token.access_token,
        tripToFinalize!.id
      )).count;
      const hasKnownUploadedSamples = serverSampleCount > 0 || state.uploadedBurstCount > 0;
      if (!hasKnownUploadedSamples) {
        dismissPendingTrip(tripToFinalize!.id);
        throw new Error(EMPTY_TRIP_FINALIZE_MESSAGE);
      }
      const result = await api.finalizeTrip(
        state.apiBaseUrl,
        state.session!.token.access_token,
        tripToFinalize!.id
      );
      if (result.score === null && hasNotEnoughSamplesError(result)) {
        dismissPendingTrip(tripToFinalize!.id);
        throw new Error(EMPTY_TRIP_FINALIZE_MESSAGE);
      }
      setState((current) => ({
        ...current,
        latestResult: result,
        activeTrip: null,
        pendingFinalizeTrip: null,
        dismissedPendingTripIds: current.dismissedPendingTripIds.filter((id) => id !== tripToFinalize!.id)
      }));
      void saveDismissedPendingTripIds(state.dismissedPendingTripIds.filter((id) => id !== tripToFinalize!.id));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  async function loadReview(tripId: string) {
    if (!state.session || !state.session.user.is_admin) {
      return;
    }
    await runBusy(async () => {
      const review = await api.getTripReview(state.apiBaseUrl, state.session!.token.access_token, tripId);
      const route = review.driver_user_id
        ? await api.getAdminDriverTripRoute(
            state.apiBaseUrl,
            state.session!.token.access_token,
            review.driver_user_id,
            tripId
          )
        : null;
      setState((current) => ({
        ...current,
        selectedReview: review,
        selectedTripDetail: null,
        selectedTripRoute: route
      }));
    });
  }

  function clearSelectedReview() {
    setState((current) => ({ ...current, selectedReview: null, selectedTripRoute: null }));
  }

  async function loadTripDetail(tripId: string) {
    if (!state.session) {
      return;
    }
    await runBusy(async () => {
      const tripDetail = await api.getTripDetail(state.apiBaseUrl, state.session!.token.access_token, tripId);
      const tripRoute = await api.getTripRoute(state.apiBaseUrl, state.session!.token.access_token, tripId).catch(() => null);
      setState((current) => ({
        ...current,
        selectedTripDetail: tripDetail,
        selectedReview: null,
        selectedTripRoute: tripRoute
      }));
    });
  }

  function clearSelectedTripDetail() {
    setState((current) => ({ ...current, selectedTripDetail: null, selectedTripRoute: null }));
  }

  async function loadAdminDriver(driver: AdminDriver) {
    if (!state.session) {
      return;
    }
    await runBusy(async () => {
      const trips = await api.getAdminDriverTrips(state.apiBaseUrl, state.session!.token.access_token, driver.id);
      setState((current) => ({
        ...current,
        selectedAdminDriver: driver,
        selectedAdminDriverTrips: trips
      }));
    });
  }

  function clearSelectedAdminDriver() {
    setState((current) => ({
      ...current,
      selectedAdminDriver: null,
      selectedAdminDriverTrips: [],
      selectedTripRoute: null
    }));
  }

  async function saveAdminDriverCredentials(driverId: string, updates: { email?: string; password?: string }) {
    if (!state.session) {
      return;
    }
    await runBusy(async () => {
      const updatedDriver = await api.updateAdminDriver(
        state.apiBaseUrl,
        state.session!.token.access_token,
        driverId,
        updates
      );
      setState((current) => ({
        ...current,
        adminDrivers: current.adminDrivers.map((driver) => (driver.id === driverId ? updatedDriver : driver)),
        selectedAdminDriver: current.selectedAdminDriver?.id === driverId ? updatedDriver : current.selectedAdminDriver
      }));
      const trips = await api.getAdminDriverTrips(state.apiBaseUrl, state.session!.token.access_token, driverId);
      setState((current) => ({
        ...current,
        selectedAdminDriverTrips: current.selectedAdminDriver?.id === driverId ? trips : current.selectedAdminDriverTrips
      }));
    });
  }

  async function deleteAdminDriver(driverId: string) {
    if (!state.session) {
      return;
    }
    await runBusy(async () => {
      await api.deleteAdminDriver(state.apiBaseUrl, state.session!.token.access_token, driverId);
      setState((current) => ({
        ...current,
        adminDrivers: current.adminDrivers.filter((driver) => driver.id !== driverId),
        selectedAdminDriver: current.selectedAdminDriver?.id === driverId ? null : current.selectedAdminDriver,
        selectedAdminDriverTrips: current.selectedAdminDriver?.id === driverId ? [] : current.selectedAdminDriverTrips
      }));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  async function submitReview(reviewedLabel: number | null, notes: string) {
    if (!state.session || !state.session.user.is_admin || !state.selectedReview) {
      return;
    }
    await runBusy(async () => {
      const updated = await api.submitReviewLabel(
        state.apiBaseUrl,
        state.session!.token.access_token,
        state.selectedReview!.trip_id,
        reviewedLabel,
        notes
      );
      setState((current) => ({ ...current, selectedReview: updated }));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  function clearError() {
    setState((current) => ({ ...current, error: null }));
  }

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      signIn,
      registerAndSignIn,
      signOut,
      setApiUrl,
      refreshAll,
      startTrip,
      uploadSensorBatch,
      endTrip,
      finalizeTrip,
      loadReview,
      loadTripDetail,
      submitReview,
      loadAdminDriver,
      saveAdminDriverCredentials,
      deleteAdminDriver,
      clearSelectedReview,
      clearSelectedTripDetail,
      clearSelectedAdminDriver,
      setThemeMode,
      setLanguageMode,
      clearError
    }),
    [state]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}
