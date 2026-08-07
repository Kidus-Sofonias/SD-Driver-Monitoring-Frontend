# Drive Pulse — Phase 2: Critical & High-Severity Fixes

**Date:** 2026-08-07
**Scope:** Backend (ML pipeline, services, routes, tests) + mobile app (sensor capture, types)
**Tests:** 54 passed (was 42) — see [CODEBASE_REVIEW_PHASE1.md](./CODEBASE_REVIEW_PHASE1.md) for the issue catalog this phase resolves.

---

## Summary of changes

### CRIT-1 — Single-sample driving events are now counted (the "0 event counts" bug)
**Files:** `backend/app/ml/event_utils.py`, `backend/app/ml/features.py`
The duration floor in `event_segments` was a fixed wall-clock value (`0.25 s`). At GPS sample rates
(0.5–2 Hz) real braking/acceleration events span only 1–2 samples and were silently discarded. The
floor is now **interpreted relative to the median sampling interval** (a segment must cover
`round(min_duration_s / median_dt)` samples, minimum 1). At 1 Hz a single-sample hard brake is now a
counted event; at 10 Hz the 0.25 s semantic is preserved (~3 samples). Verified: a −11.1 m/s²
one-sample brake previously produced 0 events; it now produces a `hard_brake` event and a count of 1.

### CRIT-2 — Missing GPS speed no longer crashes trip finalization
**Files:** `backend/app/ml/preprocessing.py`, `backend/app/ml/features.py`,
`backend/app/ml/scoring_rules.py`, `backend/app/services/trip_processing_service.py`
- Preprocessing now coerces IMU columns to finite floats (missing → 0) and **drops samples with
  missing/invalid GPS speed** before feature extraction (with a warning log). Empty results are handled
  gracefully.
- Aggregations use NaN-safe statistics (`nanmean`, `nanvar`, `nanpercentile`, `nanmax`).
- `_normalize` and `_compute_final_score` reject non-finite inputs instead of crashing with
  `ValueError: cannot convert float NaN to integer`.
- Verified: a trip with 4 of 30 samples missing GPS speed finalizes with a score; a trip whose samples
  all lack speed is preserved as unscored rather than crashing.

### CRIT-3 — Mobile no longer fabricates false hard-brake events
**Files:** `mobile-app/src/services/sensorCapture.ts`, `mobile-app/src/types/api.ts`
`coords.speed ?? 0` was writing a fake `0 m/s` whenever GPS reported no speed (common on many devices),
which the backend read as a sudden 50→0→50 km/h stop → a phantom `hard_brake` event. The phone now sends
`speed: null`; the backend drops such samples from scoring (CRIT-2). Type updated to `number | null`.

### CRIT-4 — Persisted events no longer double-count brakes as "speed_variation"
**Files:** `backend/app/ml/event_generation.py`, `backend/app/services/trip_processing_service.py`
The `speed_variation` category (|dv| ≥ 2.25 m/s²) overlapped the brake/accel thresholds (2.5 m/s²), so
every hard brake and hard acceleration appeared **twice** in the persisted event list (e.g. 5 duplicate
events per 2-minute risky trip). The category is no longer generated; speed variability remains captured
by the `speed_variance` trip feature used in scoring. `speed_variation` stays in
`GENERATED_EVENT_TYPES` so reprocessing cleans stale rows. Phase 3 will reintroduce a dedicated,
non-overlapping overspeed category. (The `unstable_motion` noise floor is deliberately left to the Phase 3
threshold redesign.)

### H-6 — Insufficient-sample trips are preserved, not deleted
**Files:** `backend/app/services/trip_processing_service.py`, `backend/app/services/admin_service.py`,
`backend/app/api/v1/routes/trips.py`
- `finalize_trip` no longer deletes trips with < 10 usable samples. They are marked unscored
  (`score = null`, breakdown `error: "not_enough_samples"`, `trip_preserved: true`, `processed_at` set so
  the pipeline doesn't re-run on every call). Raw samples are kept for future reprocessing (Phase 4).
- Removed the destructive `_cleanup_failed_insufficient_trips` calls (and dead imports) from admin GET
  handlers — GETs no longer have write side effects.
- The mobile app already handled this state: it shows the friendly "not enough samples" message and
  dismisses the pending trip.

### H-4 — Event creation now enforces trip ownership
**Files:** `backend/app/services/driving_event_service.py`
`add_event` performed an ownership lookup but discarded the result, so a driver could attach events to
another driver's trip. It now raises `NotFoundError` (`trip.not_found`) when the trip does not belong to
the caller.

### H-7 — Uploads restricted to active trips + rate limiting
**Files:** `backend/app/services/sensor_sample_service.py`, `backend/app/core/rate_limit.py`,
`backend/app/api/v1/routes/sensor_samples.py`, `backend/app/api/v1/routes/auth.py`
- Sensor samples are only accepted while a trip is `active` (409 otherwise).
- New lightweight in-memory sliding-window rate limiter (`app/core/rate_limit.py`): 10
  login/register attempts per minute per IP; 120 upload batches per minute per user. 429s map to the
  existing `error.rate_limited` handler.
- `AppError` exceptions now propagate to the global handler instead of being masked as 500s by route
  catch-all blocks.

### H-5 — Paginated list endpoints
**Files:** `backend/app/api/v1/routes/trips.py`, `backend/app/api/v1/routes/admin.py`,
`backend/app/services/admin_service.py`
`GET /trips` and `GET /admin/trips` accept `limit` (default 200, max 1000) and `offset`. Backward
compatible — existing clients without params get the most recent 200.

---

## Files modified

| Area | Files |
|------|-------|
| ML pipeline | `app/ml/preprocessing.py`, `app/ml/features.py`, `app/ml/scoring_rules.py`, `app/ml/event_utils.py`, `app/ml/event_generation.py` |
| Services | `app/services/trip_processing_service.py`, `app/services/driving_event_service.py`, `app/services/sensor_sample_service.py`, `app/services/admin_service.py` |
| API | `app/api/v1/routes/trips.py`, `app/api/v1/routes/admin.py`, `app/api/v1/routes/sensor_samples.py`, `app/api/v1/routes/auth.py` |
| Core | `app/core/rate_limit.py` (new) |
| Tests | `tests/test_trip_processing_service.py`, `tests/test_api_trip_flow.py`, `tests/test_phase2_fixes.py` (new) |
| Mobile | `mobile-app/src/services/sensorCapture.ts`, `mobile-app/src/types/api.ts` |
| Docs | `docs/PHASE2_FIXES.md` (this file), `docs/CODEBASE_REVIEW_PHASE1.md` (status table) |

## API changes
- `GET /trips?limit=&offset=`, `GET /admin/trips?limit=&offset=` (new params, defaults preserve behavior).
- `POST /trips/{id}/samples` → `409` if the trip is not active; `429` on rate limit.
- `POST /trips/{id}/events` → `404` for trips not owned by the caller.
- `POST /auth/login|register` → `429` on rate limit.
- `finalize` response: `breakdown.trip_preserved: true` (was `trip_deleted: true`) and
  `raw_deleted: false` for insufficient-sample trips.

## Verification
- Backend: `python -m pytest tests/ -q` → **54 passed** (12 new/updated tests cover single-sample event
  counting, missing-speed survival, speed_variation removal, ownership enforcement, active-only uploads,
  rate limiter, pagination).
- Mobile: `tsc --noEmit` → clean.

## Remaining known issues (carried forward)
- Event **thresholds** (2.5 m/s² brake/accel, gyro-based turns, jerk noise floor), exposure-normalized
  scoring, and overspeeding → Phase 3 redesign.
- Historical trip recalculation → Phase 4.
- No real-time transport, alerts, or accident detection → Phases 5–8.
- Rate limiter is in-memory (per-process) — move to a shared store for multi-worker deployments.
- `unstable_motion` events still dominate persisted lists until Phase 3 tunes the jerk threshold.
