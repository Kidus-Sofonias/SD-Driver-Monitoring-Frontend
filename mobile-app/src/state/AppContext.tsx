import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";

import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl, normalizeConfiguredApiBaseUrl } from "../config/constants";
import type { LanguageMode } from "../i18n";
import * as api from "../lib/api";
import {
  clearSensorBuffer,
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
import { createPhoneSensorCollector, generateMockSensorBurst, type SensorCaptureMode } from "../services/sensorCapture";
import {
  clearTripQueue,
  dequeueSamples,
  enqueueSamples,
  listQueuedTripIds,
  peekSamples,
  queueDepth,
  clearAllQueued
} from "../lib/uploadQueue";
import type { AdminDriver, DriverInsights, FinalizeTrip, LiveAlertMessage, ReviewDashboardItem, ReviewTrip, Session, Trip, TripDetail, TripRoute } from "../types/api";

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
  allTrips: Trip[];
  adminDrivers: AdminDriver[];
  selectedAdminDriver: AdminDriver | null;
  selectedAdminDriverTrips: Trip[];
  selectedAdminDriverInsights: DriverInsights | null;
  healthLabel: string;
  captureMode: SensorCaptureMode;
  bufferedSampleCount: number;
  /** Samples sitting in the durable outbox (drained but not yet on the server). */
  persistedQueuedCount: number;
  /** Samples dropped from the outbox because it hit its cap (oldest-first). */
  queueDroppedCount: number;
  uploadedBurstCount: number;
  lastUploadAt: string | null;
  dismissedPendingTripIds: string[];
  liveAlerts: Array<{ id: string; message: LiveAlertMessage }>;
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
  retryFinalizeTrip: (tripId: string) => Promise<void>;
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
  dismissLiveAlert: (id: string) => void;
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const EMPTY_TRIP_FINALIZE_MESSAGE = "Not enough samples collected. Trip can't be finalized.";
const COLLECTOR_SNAPSHOT_INTERVAL_MS = 1000;
const AUTO_UPLOAD_INTERVAL_MS = 4000;
const AUTO_UPLOAD_MIN_BUFFERED_SAMPLES = 4;
const UPLOAD_BACKOFF_INITIAL_MS = 4000;
const UPLOAD_BACKOFF_MAX_MS = 120000;
const UPLOAD_BATCH_MAX = 200;
const UPLOAD_FAILURE_ERROR_THRESHOLD = 2;
const ALERT_SOCKET_RECONNECT_MS = 6000;
const LIVE_ALERT_DISPLAY_MS = 6000;
const LIVE_ALERT_MAX = 4;

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

function pickLatestScoredTrip(trips: Trip[]) {
  return (
    [...trips]
      .filter((trip) => trip.score !== null && trip.score !== undefined)
      .sort((left, right) => {
        const leftTime = new Date(left.processed_at || left.ended_at || left.started_at).getTime();
        const rightTime = new Date(right.processed_at || right.ended_at || right.started_at).getTime();
        return rightTime - leftTime;
      })[0] ?? null
  );
}

function mapTripDetailToFinalizeTrip(tripDetail: TripDetail): FinalizeTrip {
  return {
    trip_id: tripDetail.id,
    score: tripDetail.score ?? null,
    risk_level: tripDetail.risk_level ?? null,
    risk_probability: tripDetail.risk_probability ?? null,
    confidence: tripDetail.confidence ?? null,
    confidence_band: tripDetail.confidence_band ?? null,
    confidence_display: tripDetail.confidence_display ?? null,
    model_version: tripDetail.model_version ?? null,
    feature_version: tripDetail.feature_version ?? null,
    decision_source: tripDetail.decision_source ?? null,
    processing_timestamp: tripDetail.processed_at ?? null,
    raw_deleted: tripDetail.raw_deleted ?? null,
    already_processed: tripDetail.already_processed ?? null,
    reasons: tripDetail.reasons,
    events: tripDetail.events,
    breakdown: tripDetail.breakdown,
    trip_features: tripDetail.trip_features,
    events_generated: tripDetail.events_generated ?? tripDetail.events.length,
  };
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

function isLocalApiUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  return /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?(\/|$)/i.test(url.trim());
}

function resolveBootstrapApiBaseUrl(storedApiBaseUrl: string | null, defaultApiBaseUrl: string) {
  const normalizedDefault = normalizeApiBaseUrl(defaultApiBaseUrl);
  const normalizedStored = normalizeConfiguredApiBaseUrl(storedApiBaseUrl);

  if (!normalizedStored) {
    return normalizedDefault;
  }

  if (!__DEV__ && !isLocalApiUrl(normalizedDefault)) {
    return normalizedDefault;
  }

  if (isLocalApiUrl(normalizedStored) && !isLocalApiUrl(normalizedDefault)) {
    return normalizedDefault;
  }

  return normalizedStored;
}

export function AppProvider({ children }: PropsWithChildren) {
  const collectorRef = useRef(createPhoneSensorCollector());
  const autoUploadInFlightRef = useRef(false);
  const lastAutoUploadAttemptAtRef = useRef(0);
  const consecutiveUploadFailuresRef = useRef(0);
  const nextUploadRetryAtRef = useRef(0);
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
    allTrips: [],
    adminDrivers: [],
    selectedAdminDriver: null,
    selectedAdminDriverTrips: [],
    selectedAdminDriverInsights: null,
    healthLabel: "Backend not checked",
    captureMode: "idle",
    bufferedSampleCount: 0,
    persistedQueuedCount: 0,
    queueDroppedCount: 0,
    uploadedBurstCount: 0,
    lastUploadAt: null,
    dismissedPendingTripIds: [],
    liveAlerts: [],
    themeMode: "dark",
    languageMode: "en"
  });
  const stateRef = useRef(state);
  const alertSocketRef = useRef<ReturnType<typeof api.openAlertSocket> | null>(null);
  const alertReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertDismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const liveAlertSeqRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clean up any pending alert dismiss timers and the alert socket on unmount.
  useEffect(() => {
    return () => {
      if (alertReconnectTimerRef.current) {
        clearTimeout(alertReconnectTimerRef.current);
        alertReconnectTimerRef.current = null;
      }
      alertSocketRef.current?.close();
      alertSocketRef.current = null;
      alertDismissTimersRef.current.forEach((timer) => clearTimeout(timer));
      alertDismissTimersRef.current.clear();
    };
  }, []);

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
  }, []);      // Lightweight interval: only do minimal work when no trip is active.
      // Heavier upload logic only fires when an active trip exists.
      useEffect(() => {
        let tickCount = 0;
        const timer = setInterval(() => {
          const current = stateRef.current;

          // No session at all — skip everything
          if (!current.session) {
            return;
          }

          tickCount++;

          if (!current.activeTrip) {
            // Only check snapshot every 3 ticks to reduce load
            if (tickCount % 3 !== 0) {
              return;
            }
            const snapshot = collectorRef.current.snapshot();
            setState((prev) => {
              if (prev.captureMode === snapshot.mode && prev.bufferedSampleCount === snapshot.bufferedCount) {
                return prev;
              }
              return { ...prev, captureMode: snapshot.mode, bufferedSampleCount: snapshot.bufferedCount };
            });
            return;
          }

          if (autoUploadInFlightRef.current) {
            return;
          }

          const snapshot = collectorRef.current.snapshot();

          setState((current) => {
            if (current.captureMode === snapshot.mode && current.bufferedSampleCount === snapshot.bufferedCount) {
              return current;
            }
            return {
              ...current,
              captureMode: snapshot.mode,
              bufferedSampleCount: snapshot.bufferedCount,
            };
          });

          // Keep the durable-outbox count in sync with reality a few times a
          // minute even when no upload attempt fires.
          if (tickCount % 5 === 0) {
            void refreshPersistedQueueCounts(current.activeTrip.id);
          }

          const now = Date.now();

      // Respect upload backoff: if we've been failing, don't retry until cooldown expires
      if (now < nextUploadRetryAtRef.current) {
        return;
      }

      const shouldUpload =
        snapshot.bufferedCount >= AUTO_UPLOAD_MIN_BUFFERED_SAMPLES ||
        now - lastAutoUploadAttemptAtRef.current >= AUTO_UPLOAD_INTERVAL_MS;

      if (!shouldUpload) {
        return;
      }

      lastAutoUploadAttemptAtRef.current = now;
      void uploadPendingSamples({ background: true, suppressEmptyError: true });
    }, COLLECTOR_SNAPSHOT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  // Phase 5: live driver alerts over WebSocket. The socket is only open while
  // a session exists AND a trip is actively in progress; it reconnects with a
  // backoff if the connection drops mid-trip.
  useEffect(() => {
    const current = stateRef.current;
    const token = current.session?.token.access_token;
    const trip = current.activeTrip;
    // Drivers connect while their trip is active; admins keep the socket open
    // at all times to receive the fleet-wide alert stream (Phase 7).
    const isAdmin = Boolean(current.session?.user.is_admin);
    const shouldConnect = Boolean(token) && (isAdmin || (Boolean(trip) && trip?.status === "active"));

    function closeSocket() {
      if (alertReconnectTimerRef.current) {
        clearTimeout(alertReconnectTimerRef.current);
        alertReconnectTimerRef.current = null;
      }
      alertSocketRef.current?.close();
      alertSocketRef.current = null;
    }

    if (!shouldConnect) {
      closeSocket();
      return () => closeSocket();
    }

    const baseUrl = current.apiBaseUrl;
    const accessToken = token as string;
    let disposed = false;

    function open() {
      if (disposed) {
        return;
      }
      closeSocket();
      const handle = api.openAlertSocket(
        baseUrl,
        accessToken,
        (message) => {
          if (message.type !== "event_alert" || !message.event) {
            return;
          }
          const seq = ++liveAlertSeqRef.current;
          const id = `${Date.now()}-${seq}`;
          setState((prev) => ({
            ...prev,
            liveAlerts: [{ id, message }, ...prev.liveAlerts].slice(0, LIVE_ALERT_MAX)
          }));
          const timer = setTimeout(() => dismissLiveAlert(id), LIVE_ALERT_DISPLAY_MS);
          alertDismissTimersRef.current.set(id, timer);
        },
        undefined,
        () => {
          // onClose: if we should still be connected, retry with a backoff.
          if (disposed) {
            return;
          }
          const stillActive =
            stateRef.current.session?.user.is_admin || stateRef.current.activeTrip?.status === "active";
          if (stillActive && !alertReconnectTimerRef.current) {
            alertReconnectTimerRef.current = setTimeout(() => {
              alertReconnectTimerRef.current = null;
              open();
            }, ALERT_SOCKET_RECONNECT_MS);
          }
        }
      );
      alertSocketRef.current = handle;
    }

    open();
    return () => {
      disposed = true;
      closeSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session?.token.access_token, state.session?.user.is_admin, state.activeTrip?.id, state.activeTrip?.status]);

  // Remote-area resilience: when the app returns to the foreground mid-trip,
  // flush the outbox immediately instead of waiting for the next tick (the
  // backoff gate still applies so we don't hammer a still-dead link).
  useEffect(() => {
    const subscription = RNAppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }
      const current = stateRef.current;
      if (!current.session || !current.activeTrip || autoUploadInFlightRef.current) {
        return;
      }
      if (Date.now() >= nextUploadRetryAtRef.current) {
        void uploadPendingSamples({ background: true, suppressEmptyError: true });
      }
    });
    return () => subscription.remove();
  }, []);

  function dismissLiveAlert(id: string) {
    const timer = alertDismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      alertDismissTimersRef.current.delete(id);
    }
    setState((prev) => ({
      ...prev,
      liveAlerts: prev.liveAlerts.filter((item) => item.id !== id)
    }));
  }

  async function hydrateRemoteState(apiBaseUrl: string, initialSession: Session | null) {
    const initialToken = initialSession?.token.access_token || null;
    let nextSession = initialSession;
    let nextHealthLabel = "Backend unavailable";

    try {
      const health = await api.getHealth(apiBaseUrl);
      nextHealthLabel = `${health.data.service} ${health.data.version}`;
    } catch (error) {
      const message = getErrorMessage(error).toLowerCase();
      nextHealthLabel =
        message.includes("timed out") || message.includes("could not reach backend")
          ? "Waking backend..."
          : "Backend unavailable";
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
      const apiBaseUrl = resolveBootstrapApiBaseUrl(storedApiBaseUrl, DEFAULT_API_BASE_URL);
      const themeMode = storedThemeMode || "dark";
      const languageMode = storedLanguageMode || "en";
      const session = rawStoredSession;

      if (apiBaseUrl !== normalizeApiBaseUrl(storedApiBaseUrl || "")) {
        await saveApiBaseUrl(apiBaseUrl);
      }

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
    const [activeTrip, trips, reviewItems, adminDrivers, allTrips] = await Promise.all([
      api.getActiveTrip(apiBaseUrl, session.token.access_token),
      api.listTrips(apiBaseUrl, session.token.access_token),
      session.user.is_admin ? api.getReviewDashboard(apiBaseUrl, session.token.access_token) : Promise.resolve([]),
      session.user.is_admin ? api.getAdminDrivers(apiBaseUrl, session.token.access_token) : Promise.resolve([]),
      session.user.is_admin ? api.listAllTrips(apiBaseUrl, session.token.access_token) : Promise.resolve([])
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
      const latestScoredTrip = session.user.is_admin ? null : pickLatestScoredTrip(trips);
      const latestResult =
        current.latestResult && latestScoredTrip && current.latestResult.trip_id === latestScoredTrip.id
          ? current.latestResult
          : latestScoredTrip
            ? mapTripDetailToFinalizeTrip({
                id: latestScoredTrip.id,
                user_id: latestScoredTrip.user_id,
                started_at: latestScoredTrip.started_at,
                ended_at: latestScoredTrip.ended_at,
                status: latestScoredTrip.status,
                score: latestScoredTrip.score ?? null,
                risk_level: latestScoredTrip.risk_level ?? null,
                risk_probability: latestScoredTrip.risk_probability ?? null,
                confidence: latestScoredTrip.confidence ?? null,
                confidence_band: latestScoredTrip.confidence_band ?? null,
                confidence_display: latestScoredTrip.confidence_display ?? null,
                feature_version: latestScoredTrip.feature_version ?? null,
                model_version: latestScoredTrip.model_version ?? null,
                processed_at: latestScoredTrip.processed_at ?? null,
                decision_source: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.decision_source ?? null : null,
                raw_deleted: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.raw_deleted ?? null : null,
                already_processed: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.already_processed ?? null : null,
                reasons: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.reasons : [],
                events: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.events : [],
                breakdown: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.breakdown : {},
                trip_features: current.latestResult?.trip_id === latestScoredTrip.id ? current.latestResult.trip_features : {},
                events_generated:
                  current.latestResult?.trip_id === latestScoredTrip.id
                    ? current.latestResult.events_generated ?? current.latestResult.events.length
                    : 0,
              })
            : null;

      return {
        ...current,
        activeTrip,
        pendingFinalizeTrip,
        trips,
        allTrips: session.user.is_admin ? allTrips : [],
        latestResult,
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
    // Never let queued samples cross accounts.
    await clearAllQueued();
    await saveSession(null);
    setState((current) => ({
      ...current,
      session: null,
      activeTrip: null,
      pendingFinalizeTrip: null,
      trips: [],
      allTrips: [],
      latestResult: null,
      reviewItems: [],
      selectedReview: null,
      selectedTripDetail: null,
      selectedTripRoute: null,
      adminDrivers: [],
      selectedAdminDriver: null,
      selectedAdminDriverTrips: [],
      selectedAdminDriverInsights: null,
      captureMode: "idle",
      bufferedSampleCount: 0,
      persistedQueuedCount: 0,
      queueDroppedCount: 0,
      uploadedBurstCount: 0,
      lastUploadAt: null,
      liveAlerts: []
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
        // Clear any stale sensor buffer from a previous interrupted session
        await clearSensorBuffer();
        collectorSnapshot = await collectorRef.current.start();
        const trip = await api.startTrip(state.apiBaseUrl, state.session!.token.access_token);
        setState((current) => ({
          ...current,
          activeTrip: trip,
          pendingFinalizeTrip: null,
          latestResult: null,
          liveAlerts: [],
          selectedReview: null,
          selectedTripDetail: null,
          selectedTripRoute: null,
          dismissedPendingTripIds: current.dismissedPendingTripIds.filter((id) => id !== trip.id),
          captureMode: collectorSnapshot.mode,
          bufferedSampleCount: collectorSnapshot.bufferedCount,
          persistedQueuedCount: 0,
          queueDroppedCount: 0,
          uploadedBurstCount: 0,
          lastUploadAt: null
        }));
        lastAutoUploadAttemptAtRef.current = 0;
        consecutiveUploadFailuresRef.current = 0;
        nextUploadRetryAtRef.current = 0;
        void saveDismissedPendingTripIds(state.dismissedPendingTripIds.filter((id) => id !== trip.id));
        await refreshAllInternal(state.apiBaseUrl, state.session as Session);
      } catch (error) {
        await collectorRef.current.stop();
        throw error;
      }
    });
  }

  async function refreshPersistedQueueCounts(tripId: string | null) {
    const depth = tripId ? await queueDepth(tripId) : 0;
    const snapshot = collectorRef.current.snapshot();
    setState((prev) => {
      if (prev.persistedQueuedCount === depth && prev.bufferedSampleCount === snapshot.bufferedCount && prev.captureMode === snapshot.mode) {
        return prev;
      }
      return {
        ...prev,
        captureMode: snapshot.mode,
        bufferedSampleCount: snapshot.bufferedCount,
        persistedQueuedCount: depth,
      };
    });
  }

  function applyUploadBackoff() {
    consecutiveUploadFailuresRef.current += 1;
    const exponent = Math.max(0, consecutiveUploadFailuresRef.current - 1);
    const base = Math.min(UPLOAD_BACKOFF_INITIAL_MS * Math.pow(2, exponent), UPLOAD_BACKOFF_MAX_MS);
    // Jitter ±25% so many devices regaining signal don't stampede the server.
    const jitter = 0.75 + Math.random() * 0.5;
    nextUploadRetryAtRef.current = Date.now() + Math.max(base * jitter, UPLOAD_BACKOFF_INITIAL_MS);
  }

  async function uploadPendingSamples(options?: {
    background?: boolean;
    suppressEmptyError?: boolean;
    /** When set, flushes this trip's outbox even if it is no longer the active trip. */
    tripId?: string;
  }) {
    const current = stateRef.current;
    const token = current.session?.token.access_token;
    if (!token || autoUploadInFlightRef.current) {
      return 0;
    }
    const tripId = options?.tripId ?? current.activeTrip?.id;
    if (!tripId) {
      return 0;
    }

    autoUploadInFlightRef.current = true;
    try {
      const preDrainSnapshot = collectorRef.current.snapshot();
      const isActiveTrip = current.activeTrip?.id === tripId;

      // Durability first: move anything the collector has into the persistent
      // outbox BEFORE touching the network, so a killed app or dropped signal
      // never loses drained samples (rural/remote areas).
      if (isActiveTrip) {
        const allowDemoFallback = preDrainSnapshot.mode === "demo" || preDrainSnapshot.mode === "idle";
        const drained = collectorRef.current.drainSamples({ fallbackToDemo: allowDemoFallback });
        if (drained.length > 0) {
          const { dropped } = await enqueueSamples(tripId, drained);
          if (dropped > 0) {
            setState((prev) => ({ ...prev, queueDroppedCount: prev.queueDroppedCount + dropped }));
          }
        }
      }

      // Pull a bounded batch from the outbox and try to send it.
      const batch = await peekSamples(tripId, UPLOAD_BATCH_MAX);
      if (!batch.length) {
        const snapshot = collectorRef.current.snapshot();
        setState((prev) => ({
          ...prev,
          captureMode: snapshot.mode,
          bufferedSampleCount: snapshot.bufferedCount,
          persistedQueuedCount: 0,
        }));
        if (!options?.suppressEmptyError) {
          throw new Error(
            preDrainSnapshot.mode === "demo" || preDrainSnapshot.mode === "idle"
              ? "No demo samples available yet. Try syncing again."
              : "Waiting for the first live sensor samples."
          );
        }
        return 0;
      }

      const uploadResult = await api.uploadSamples(
        current.apiBaseUrl,
        token,
        tripId,
        batch
      );
      await dequeueSamples(tripId, batch.length);

      // Success — reset failure tracking so backoff clears.
      consecutiveUploadFailuresRef.current = 0;
      nextUploadRetryAtRef.current = 0;

      const collectorSnapshot = collectorRef.current.snapshot();
      const depth = await queueDepth(tripId);
      setState((prev) => ({
        ...prev,
        captureMode: collectorSnapshot.mode,
        bufferedSampleCount: collectorSnapshot.bufferedCount,
        persistedQueuedCount: depth,
        uploadedBurstCount: prev.uploadedBurstCount + uploadResult.inserted,
        lastUploadAt: new Date().toISOString(),
        error: null, // Clear stale error on successful upload
      }));
      return uploadResult.inserted;
    } catch (error) {
      // Samples stay safely in the outbox; the loop retries with backoff.
      applyUploadBackoff();
      const snapshot = collectorRef.current.snapshot();
      const depth = await queueDepth(tripId);
      setState((prev) => ({
        ...prev,
        captureMode: snapshot.mode,
        bufferedSampleCount: snapshot.bufferedCount,
        persistedQueuedCount: depth,
        // After N consecutive background failures, surface the error so the user can diagnose
        error: options?.background && consecutiveUploadFailuresRef.current < UPLOAD_FAILURE_ERROR_THRESHOLD
          ? prev.error
          : getErrorMessage(error),
      }));

      if (!options?.background) {
        throw error;
      }

      return 0;
    } finally {
      autoUploadInFlightRef.current = false;
    }
  }

  async function flushQueuedForTrip(tripId: string) {
    // Best-effort flush of a specific trip's outbox (used by finalize so an
    // offline-ended trip still delivers its last samples before scoring).
    const token = stateRef.current.session?.token.access_token;
    if (!token) {
      return;
    }
    const depth = await queueDepth(tripId);
    if (depth <= 0) {
      return;
    }
    const batch = await peekSamples(tripId, depth);
    const result = await api.uploadSamples(stateRef.current.apiBaseUrl, token, tripId, batch);
    await dequeueSamples(tripId, batch.length);
    const remaining = await queueDepth(tripId);
    setState((prev) => ({
      ...prev,
      persistedQueuedCount: remaining,
      uploadedBurstCount: prev.uploadedBurstCount + result.inserted,
    }));
  }

  async function uploadSensorBatch() {
    if (!state.session || !state.activeTrip) {
      return;
    }
    await runBusy(async () => {
      const snapshot = collectorRef.current.snapshot();
      // If no live sensor data has arrived yet (live with no data, or idle from browser),
      // inject a demo batch so the user gets immediate feedback instead of the
      // "Waiting for the first live sensor samples" error.
      // Check mode in addition to lastSampleAt because drainSamples can set lastSampleAt
      // before a stop() call transitions mode to "idle", causing the guard to fail.
      if (snapshot.bufferedCount < 1 && (snapshot.lastSampleAt === null || snapshot.mode !== "live")) {
        const demoSamples = generateMockSensorBurst();
        const uploadResult = await api.uploadSamples(
          state.apiBaseUrl,
          state.session!.token.access_token,
          state.activeTrip!.id,
          demoSamples
        );
        setState((prev) => ({
          ...prev,
          uploadedBurstCount: prev.uploadedBurstCount + uploadResult.inserted,
          lastUploadAt: new Date().toISOString(),
        }));
        return;
      }
      await uploadPendingSamples();
    });
  }

  async function endTrip() {
    if (!state.session || !state.activeTrip) {
      return;
    }
    await runBusy(async () => {
      await uploadPendingSamples({ suppressEmptyError: true });
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
      await uploadPendingSamples({ suppressEmptyError: true });
      // Remote-area resilience: deliver anything still in this trip's durable
      // outbox (e.g. an offline-ended trip) before we score it. The backend
      // accepts uploads for completed-but-unfinalized trips.
      await flushQueuedForTrip(tripToFinalize!.id);
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

  async function retryFinalizeTrip(tripId: string) {
    if (!state.session) {
      return;
    }
    await runBusy(async () => {
      const result = await api.reprocessTrip(
        state.apiBaseUrl,
        state.session!.token.access_token,
        tripId
      );
      setState((current) => ({
        ...current,
        latestResult: result,
        selectedTripDetail:
          current.selectedTripDetail && current.selectedTripDetail.id === tripId
            ? {
                ...current.selectedTripDetail,
                score: result.score,
                risk_level: result.risk_level ?? null,
                risk_probability: result.risk_probability ?? null,
                confidence: result.confidence ?? null,
                confidence_band: result.confidence_band ?? null,
                confidence_display: result.confidence_display ?? null,
                feature_version: result.feature_version ?? null,
                model_version: result.model_version ?? null,
                processed_at: result.processing_timestamp ?? null,
                decision_source: result.decision_source ?? null,
                raw_deleted: result.raw_deleted ?? null,
                already_processed: result.already_processed ?? null,
                reasons: result.reasons,
                events: result.events,
                breakdown: result.breakdown,
                trip_features: result.trip_features,
                events_generated: result.events_generated ?? null,
              }
            : current.selectedTripDetail,
      }));
      await refreshAllInternal(state.apiBaseUrl, state.session as Session);
    });
  }

  async function loadReview(tripId: string) {
    if (!state.session || !state.session.user.is_admin) {
      return;
    }
    await runBusy(async () => {
      const [review, tripRoute] = await Promise.all([
        api.getTripReview(state.apiBaseUrl, state.session!.token.access_token, tripId),
        // Admin must use the admin route endpoint because the regular one filters by user_id
        api.getAdminTripRoute(state.apiBaseUrl, state.session!.token.access_token, tripId).catch(() => null),
      ]);
      setState((current) => ({
        ...current,
        selectedReview: review,
        selectedTripDetail: null,
        selectedTripRoute: tripRoute
      }));
    });
  }

  function clearSelectedReview() {
    setState((current) => ({ ...current, selectedReview: null, selectedTripRoute: null }));
  }

  async function loadTripDetail(tripId: string) {
    const currentSession = state.session;
    if (!currentSession) {
      return;
    }
    const token = currentSession.token.access_token;
    const isAdmin = currentSession.user.is_admin;
    await runBusy(async () => {
      const tripDetail = await api.getTripDetail(state.apiBaseUrl, token, tripId);
      // Admin users need admin route endpoint; regular users use the regular one
      const tripRoute = await (isAdmin
        ? api.getAdminTripRoute(state.apiBaseUrl, token, tripId)
        : api.getTripRoute(state.apiBaseUrl, token, tripId)
      ).catch(() => null);
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
      const [trips, insights] = await Promise.all([
        api.getAdminDriverTrips(state.apiBaseUrl, state.session!.token.access_token, driver.id),
        api.getAdminDriverInsights(state.apiBaseUrl, state.session!.token.access_token, driver.id),
      ]);
      setState((current) => ({
        ...current,
        selectedAdminDriver: driver,
        selectedAdminDriverTrips: trips,
        selectedAdminDriverInsights: insights,
      }));
    });
  }

  function clearSelectedAdminDriver() {
    setState((current) => ({
      ...current,
      selectedAdminDriver: null,
      selectedAdminDriverTrips: [],
      selectedAdminDriverInsights: null,
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
      const [trips, insights] = await Promise.all([
        api.getAdminDriverTrips(state.apiBaseUrl, state.session!.token.access_token, driverId),
        api.getAdminDriverInsights(state.apiBaseUrl, state.session!.token.access_token, driverId),
      ]);
      setState((current) => ({
        ...current,
        selectedAdminDriverTrips: current.selectedAdminDriver?.id === driverId ? trips : current.selectedAdminDriverTrips,
        selectedAdminDriverInsights: current.selectedAdminDriver?.id === driverId ? insights : current.selectedAdminDriverInsights,
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
        selectedAdminDriverTrips: current.selectedAdminDriver?.id === driverId ? [] : current.selectedAdminDriverTrips,
        selectedAdminDriverInsights: current.selectedAdminDriver?.id === driverId ? null : current.selectedAdminDriverInsights,
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
      retryFinalizeTrip,
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
      dismissLiveAlert,
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
