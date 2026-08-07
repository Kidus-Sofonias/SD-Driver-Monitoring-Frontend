# Drive Pulse — Phase 5: Real-Time Driver Alerts

**Date:** 2026-08-07
**Scope:** Backend (`app/realtime/`, `routes/realtime.py`, `routes/sensor_samples.py`, `routes/trips.py`) + mobile app (`api.ts`, `AppContext.tsx`, `DriveScreen.tsx`, i18n)
**Tests:** 71 passed (6 new — hub pub/sub, live detector, WebSocket auth + delivery).
**Transport:** WebSocket (`/api/v1/ws/alerts`) — the first real-time channel in the platform.

---

## 1. What was built

Drivers now receive **immediate, non-intrusive alerts** whenever a driving event is detected
*while a trip is in progress* (not just at finalize). Alerts cover every v2 event category:
hard braking, emergency braking, harsh acceleration, aggressive cornering, overspeed,
severe overspeed, and unstable motion. Phone distraction is not detectable from the current
sensor set (documented future category).

## 2. Backend architecture

### 2.1 `app/realtime/hub.py` — AlertHub (pub/sub)
A thread-safe per-user fan-out. Sample-upload handlers run on FastAPI's threadpool (sync
`def`), while WebSocket coroutines run on the event loop, so `publish()` uses
`loop.call_soon_threadsafe(queue.put_nowait, ...)` to cross that boundary. Slow consumers
(> 100 buffered frames) have alerts dropped rather than blocking the upload path.

### 2.2 `app/realtime/live_detector.py` — incremental event detection
On every sample upload, the detector:
1. Appends the new batch to a **per-trip rolling window** (≤ 240 samples) — bounded work per
   upload (a few ms), independent of trip length.
2. Runs the **same v2 detection pipeline** used at finalize (`preprocess_samples` →
   `compute_per_sample_features` → `generate_trip_events` with `FeatureConfigV2`), so live
   alerts and the final persisted events agree by construction.
3. **Deduplicates** by a canonical `(event_type, occurred_at)` key, and **seeds that set from
   already-persisted events** on first touch — a server restart never replays stale alerts.
4. Publishes only the new events over the hub, and keeps a bounded per-trip replay buffer
   (`RECENT_ALERTS_CAP = 50`) for the `GET /trips/{id}/alerts/recent` reconnect-backfill
   endpoint.

Live alerts are **transient** — nothing is written to `driving_events` during the trip.
Finalize remains the single authority for persisted events, so there is no double counting
and no state to reconcile.

### 2.3 `app/api/v1/routes/realtime.py` — WebSocket stream
- `GET /api/v1/ws/alerts?token=<JWT>` authenticates via the existing HS256 token (query
  param, because React Native's WebSocket cannot reliably send Authorization headers on all
  platforms). Invalid/missing tokens are rejected with close code **4401**.
- Frame shape: `connected` on open, `event_alert` per detection, `ping` every 20 s to keep
  proxies from dropping idle connections (the receive/alert race uses a 20 s timeout so the
  keepalive actually fires while idle).
- On disconnect the subscriber is removed from the hub; the mobile client reconnects with a
  6 s backoff while the trip is still active.
- `GET /api/v1/trips/{id}/alerts/recent` returns the replay buffer, **owner-scoped** (404 for
  trips that don't belong to the caller).

### 2.4 Upload hook (`routes/sensor_samples.py`)
The upload handler inserts samples (with the existing SQLAlchemy self-heal + retry path) and
then runs live detection **best-effort** — an alerting failure is logged but never fails the
upload. Trip end (`routes/trips.py`) releases the detector's in-memory window for the trip to
prevent unbounded per-trip growth.

## 3. Mobile app

- **`lib/api.ts`** — `openAlertSocket()` builds the `ws(s)://` URL from the configured base URL
  and returns a closeable handle.
- **`state/AppContext.tsx`** — socket lifecycle is tied to *signed in + active trip*: it opens
  when a trip starts, closes on end/sign-out, and reconnects with a 6 s backoff if the
  connection drops mid-trip. Incoming `event_alert` frames push into `liveAlerts` (max 4 shown)
  and auto-dismiss after 6 s. Dismiss timers and the socket are cleaned up on unmount.
- **`screens/DriveScreen.tsx`** — a compact alert stack above the trip card, designed for
  glanceability while driving: colored dot (red for emergency/severe), translated category
  label, relative time, peak value, and tap-to-dismiss.
- **i18n** — all alert labels added in English, Amharic, and Afaan Oromoo.

## 3.5 Live telemetry endpoint (Phase 6 prep)

`GET /api/v1/trips/{trip_id}/telemetry` (owner-scoped, 404 otherwise) returns the payload the
Phase 6 glance/details modes poll alongside the alert stream:

```json
{
  "trip_id": "…", "status": "active", "started_at": "…", "elapsed_s": 123.4,
  "samples_uploaded": 456,
  "latest": {
    "ts": "…", "speed_mps": 23.5, "lat": …, "lon": …, "accuracy_m": 6.0,
    "accel_mag_mps2": 9.81, "longitudinal_accel_mps2": -2.1
  },
  "event_counts": {"hard_brake": 2}, "event_total": 2,
  "recent_alerts": [ … ]
}
```

Implemented by `app/services/live_monitor_service.py` (`LiveMonitorService`), which combines the
latest stored sensor samples (new `SensorSampleRepository.list_latest_by_trip`) with the live
detector's in-memory `event_counts`/`recent_alerts`. Event counters are live-transient (reset on
server restart); finalize remains the source of truth for stored events.

## 4. Alert message contract

```json
{
  "type": "event_alert",
  "trip_id": "…",
  "event": { "event_type": "hard_brake", "value": 4.2, "occurred_at": "…Z", "lat": …, "lon": … },
  "sent_at": "…Z"
}
```

## 5. Design decisions & trade-offs

| Decision | Rationale |
|----------|-----------|
| WebSocket over SSE/polling | RN has native WebSocket; full-duplex without polling overhead |
| Detection reuses the v2 pipeline | Guarantees live alerts match finalize; no second detection model to drift |
| Rolling window, not full-trip | Bounded per-upload cost; consistent with finalize since finalize re-detects everything from stored samples |
| Alerts are transient (not persisted) | No double counting with finalize's delete-and-replace; replay buffer covers reconnect misses |
| Token in query string | RN WebSocket header support is unreliable; trade-off is that tokens can appear in access logs — acceptable at current scale, flagged for a `Sec-WebSocket-Protocol` upgrade |
| In-memory hub/detector (per process) | Same limitation as the Phase 2 rate limiter: multi-worker deployments need a shared broker (Redis) — see recommendations |

## 6. Verification

- Backend: **71 passed** (`tests/test_phase5_alerts.py` adds 6: hub pub/sub, no-subscriber
  no-op, detector detects + dedupes, DB-seeded dedupe, WS rejects invalid token, WS delivers
  a live brake alert end-to-end).
- Mobile: `tsc --noEmit` clean.
- Code review (deepseek-flash) findings fixed: keepalive ping unreachable while idle (timeout
  added), `clear_trip` never called (leak) — now released on trip end, typed alert-label keys
  instead of `as never`, dismiss timers cleaned on unmount.

## 7. Remaining known issues / follow-ups

- Hub + detector are **in-memory per process** — a multi-worker deployment needs a shared
  broker (Redis pub/sub) for cross-worker delivery.
- Token-in-URL: move to a short-lived WS token or `Sec-WebSocket-Protocol` for stricter
  log hygiene.
- Alerts are app-internal; native push notifications (Expo notifications) are a natural
  follow-up for when the app is backgrounded.
- Phone distraction detection still requires a sensor/app-usage signal that the current
  capture does not provide.
