# Drive Pulse — Phase 1: Comprehensive Codebase Review Report

**Date:** 2026-08-07
**Scope:** `backend/` (FastAPI + ML), `mobile-app/` (React Native / Expo), `website/` (Vite marketing site)
**Status:** Phase 1 complete — analysis only, no production code changed.

---

## 1. Executive Summary

Drive Pulse is a driving-analytics platform with three working surfaces: a FastAPI backend with a
rule+ML trip-scoring pipeline, an Expo React Native mobile app that captures GPS/IMU sensor data, and a
marketing website with live-trip demo widgets. The architecture is cleanly layered (routes → services →
repositories → ORM models), and there is a genuinely mature offline ML workflow (dataset building,
training, evaluation, comparison, promotion, auto-retrain).

However, the core measurement loop — turning raw sensor samples into **driving events and a safety
score** — is producing incorrect results today. Empirical verification against the project's own shipped
"risky trip" datasets confirms:

| # | Symptom | Root cause (verified) |
|---|---------|------------------------|
| 1 | Real hard-braking trips produce **0 events / 0 counts** | Single-sample events are dropped (`min_event_duration_s = 0.25s` at 1–2 Hz GPS), compounded by EMA smoothing (`α = 0.3`) that attenuates the peak `dv` signal by ~50–70% |
| 2 | Trip finalization crashes (`500`) on trips with any missing GPS speed | `float(np.mean(speed))` → `NaN` → `int()` raises `ValueError: cannot convert float NaN to integer` |
| 3 | **False** hard-brake events are generated when the phone loses GPS speed | Mobile writes `coords.speed ?? 0`; the 50→0→50 km/h sequence looks like a 4.2 m/s² brake |
| 4 | "Risky" trips score **79/72 (medium)** and event lists are dominated by noise | Emergency brakes are never penalized; `unstable_motion` produces 21–27 events per 2-minute trip; `speed_variation` double-counts every brake/accel |
| 5 | Aggressive turns almost never detected in real trips | Turn proxy is raw phone-axis `\|gz\| ≥ 2.0 rad/s` — orientation-dependent and effectively never sustained long enough |

The Phase 1 report below documents the architecture, data flow, and a prioritized issue list. It is the
basis for Phases 2–9.

---

## 2. Project Structure & Repository Topology

**Important:** the project is split across two git repositories:

| Repo | Contents | Remote |
|------|----------|--------|
| Outer repo (`SD-Driver-Monitoring-Frontend`) | `mobile-app/` (Expo RN app), `website/` (Vite marketing site), `scripts/` (judges PDF/presentation generators), repo-root `docs/` | `github.com/Kidus-Sofonias/SD-Driver-Monitoring-Frontend.git` |
| Embedded repo (`backend/`) | FastAPI app, ML pipeline, alembic migrations, tests, artifacts | `github.com/Kidus-Sofonias/SD-backend-and-model.git` |

`backend/` is an **embedded git repository** (tracked as a gitlink by the outer repo, with no
`.gitmodules` entry). Commits for backend changes must go to the backend repo; commits for the app/site
go to the outer repo. **Both repos currently have substantial uncommitted work** (see §12).

```
backend/
  app/
    api/            # FastAPI: deps (auth), middleware (request_id), exceptions, v1 routers
    core/           # config (pydantic-settings), jwt, security (bcrypt), errors, logging, utils
    db/             # SQLAlchemy models (user, trip, driving_event, sensor_sample), session, init_db
    ml/             # preprocessing → features → scoring_rules → event_generation → inference (+ model_registry, auto_retrain)
    repositories/   # thin data-access layer (trip, sensor_sample, driving_event, user)
    schemas/        # Pydantic request/response contracts
    services/       # business logic (auth, trip, trip_processing, sensor_sample, driving_event, admin, route_snap)
  alembic/          # schema migrations
  scripts/          # offline ML workflow (build dataset, train, evaluate, compare, promote, reprocess, refresh cycle, drift)
  tests/            # 42 passing tests (pytest)
  artifacts/        # datasets (risky_batch/*, trip_features_fv1.csv), models (GB + LR joblibs), reports
mobile-app/
  src/
    components/     # Card, PrimaryButton, StatusPill, MetricTile, AnimatedScoreRing, Motion, TextField, SkeletonShimmer
    screens/        # Auth, Dashboard, Drive, Results, Trips, TripDetail, Settings, Review, AdminDashboard/Drivers/DriverDetail
    services/       # sensorCapture.ts (PhoneSensorCollector + demo simulator)
    state/          # AppContext.tsx (global state, auto-upload loop)
    lib/            # api.ts (API client w/ base-URL fallback), route.ts (map tools), storage.ts, format.ts
    config/, theme/, i18n/, types/
website/
  src/              # marketing site: PhoneScene, DashboardScene, LiveTripDemo (simulated live trip)
```

---

## 3. Architecture & Data Flow

### 3.1 Backend request flow
```
HTTP → FastAPI (main.py: CORS, RequestIDMiddleware, exception handlers)
     → /api/v1 routers (auth, trips, sensor_samples, events, admin, health)
     → services (business rules)
     → repositories (SQLAlchemy)
     → SQLite (local) or PostgreSQL (production/Render)
```

### 3.2 Mobile app flow (driver)
```
PhoneSensorCollector (GPS @500ms + IMU @200ms, merged per GPS fix)
  → in-memory buffer + AsyncStorage crash-recovery buffer
  → AppContext auto-upload loop (every ~4s, ≥4 samples, exp backoff)
  → POST /trips/{id}/samples (batches ≤ 5000)
Trip lifecycle: POST /trips/start → uploads → POST /trips/end → POST /trips/finalize
  → pipeline runs → score, risk, events persisted → DriveScreen/ResultsScreen show result
```

### 3.3 ML / scoring pipeline (trip finalization)
```
samples (DB, m/s) → _samples_to_payload (×3.6 → km/h)
  → preprocess_samples (parse ts, sort, dt filter ≤10s, speed ÷3.6 → m/s, EMA α=0.3 on accel/gyro/speed)
  → compute_per_sample_features (a_mag, g_mag, jerk, dv, turn_intensity=|gz_s|)
  → aggregate_trip_features (event counts via event_segments, jerk entropy, confidence heuristic)
  → score_trip_rules_v1 (score = 100 − Σ penalties; per-event flat weights)
  → generate_trip_events (persisted event instances w/ lat/lon/timestamp)
  → ModelScorer.predict (sklearn GB/LR on 15 fv1 features) — only if confidence ≥ 0.5
  → _compute_final_score (weighted blend: rules × (1−w) + ML×(100×(1−p)); adaptive ML weight 0.15–0.50;
      confidence pull toward neutral 60)
  → persist trip.score / risk_probability / risk_level / score_breakdown (JSON) / events
```

### 3.4 Database schema
- `users` — id (uuid str), email (unique), password_hash (bcrypt), role (`driver`|`admin`).
- `trips` — id, user_id (FK, idx), started_at, ended_at, status (`active`/`completed`), score,
  score_breakdown (JSON text), feature_version, model_version, confidence, risk_probability,
  risk_level, reviewed_label/source/notes/at, processed_at, raw_deleted.
- `driving_events` — id (serial), user_id (FK, idx), trip_id (FK, idx), event_type, value, occurred_at
  (idx), lat, lon, created_at.
- `sensor_samples` — id (serial), user_id (FK, idx), trip_id (FK, idx), ts (idx), speed_mps, lat, lon,
  accuracy_m, altitude_m, ax/ay/az, gx/gy/gz. Composite indexes `(trip_id, ts)`, `(user_id, trip_id)`.

**Schema-management smell:** schema is managed in **three** places simultaneously — alembic migrations,
`init_db()` runtime `ALTER TABLE` helpers (`_ensure_user_role_column`, `_ensure_driving_event_columns`,
`ensure_sensor_sample_columns`), and **request-path self-healing** in `routes/sensor_samples.py` /
`routes/trips.py` (column adds + Postgres sequence resync + retry). The sequence-resync-on-insert path is
a symptom of `migrate_to_supabase.py` re-inserting rows with explicit IDs (Postgres sequences don't
advance), which caused production `UniqueViolation` incidents.

### 3.5 Event detection pipeline (current)
```
dv = d(speed_s)/dt            ← from GPS speed only, EMA-smoothed
turn_intensity = |gz_s|       ← raw phone z-gyro, no vehicle-frame rotation
jerk_mag = |d(a_mag)/dt|      ← from IMU magnitude, EMA-smoothed
segments = event_segments(mask, min_duration_s=0.25, merge_gap_s=0.15)
events persisted: hard_brake / emergency_brake / hard_accel / aggressive_turn / unstable_motion / speed_variation
```

### 3.6 Scoring algorithm (current)
```
score = 100 − [w_brake(10)×chargeable_hard_brakes + w_accel(7)×hard_accels + w_turn(7)×turns
               + 12×normalize(p95_jerk, 0.5, 6) + 7×normalize(speed_variance, 0, 25)]
ML blend: 0.35 base weight, adaptive 0.15–0.50 by confidence & calibration
confidence pull: score → 60 + (score−60)×min(1, confidence/0.8)
risk_level: ≥80 low, ≥55 medium, else high
```

### 3.7 Auth & authorization
- Register/login (bcrypt), HS256 JWT (`sub` = user id), 24h expiry, no refresh/revocation.
- Role checks: admin-only endpoints call `_require_admin`; driver routes scope by `user_id`.
- **One broken check:** `DrivingEventService.add_event` performs a trip-ownership lookup but discards the
  result (`_trip` unused) — the "prevents cheating" guard is not actually enforced.

### 3.8 Live data flow & notifications
- **There is no real-time channel.** No WebSockets, no SSE, no push. The mobile app polls REST
  (`GET /trips/active`, samples count); the website LiveTripDemo is a locally simulated trip.
- **No notification system exists** (no driver alerts, no admin alerts, no accident detection).
  Phases 5–8 are net-new functionality, not fixes of existing behavior.

---

## 4. Verified Bugs (with evidence)

All "verified" items were reproduced by running the actual shipped pipeline
(`run_trip_pipeline`) against the project's own `artifacts/datasets/risky_batch/*.json` and synthetic
trip profiles (Python 3.10, numpy 2.2.1, pandas 2.2.3, sklearn 1.6.0).

### CRIT-1 — Real braking events produce zero events/counts *(the headline bug)*
A brake of −11.1 m/s² (60→20 km/h over one 1 s GPS interval — a genuine hard/emergency stop) yields
`harsh_brake_count = 0`, `emergency_brake_count = 0`, and an empty persisted event list.
Contributing chain:
1. `dv` is computed from GPS speed at 1–2 Hz (one GPS fix per sample).
2. EMA smoothing (`α = 0.3`, `preprocessing.ema`) attenuates the raw −11.1 m/s² to **−3.4 m/s²**,
   dropping it below `emergency_brake_dv = −5.0`.
3. `event_segments` drops any segment shorter than `min_event_duration_s = 0.25 s`; a 1-sample event has
   duration 0 → **deleted**. At 1 Hz, most real braking events span 1–2 samples.

### CRIT-2 — Null GPS speed crashes trip finalization
Inserting three `speed: null` samples into an otherwise clean trip reproduces
`ValueError: cannot convert float NaN to integer` inside the rule scorer. Any trip with a missing GPS
speed (common at trip start / in tunnels / on phones that don't report `coords.speed`) **fails to
finalize** — no score, no events, and the mobile app shows a 500. The route handler's `_run_finalize_with_recovery`
converts this into a structured 500, but the trip is left unscored.

### CRIT-3 — Mobile `coords.speed ?? 0` fabricates false hard-brake events
The phone writes `speed: 0` whenever GPS speed is unavailable while still moving. The resulting
50→0→50 km/h sequence produces a false `hard_brake` (4.2 m/s²) plus a duplicate `speed_variation`
event. On devices that frequently report speed 0 this systematically poisons both event counts and scores.

### CRIT-4 — Persisted event counts don't reflect risk (semantics mismatch)
On the shipped "risky" trips (240 samples, 2 min):
- `harsh_brake_count = 3`, all classified `emergency_brake` → **brake penalty = 0**; score = 79/79/72.
- Persisted events: **21–27 `unstable_motion`**, 5 `speed_variation` (exactly 3 brakes + 2 accels —
  **`speed_variation` double-counts every brake and accel event**), 2–3 meaningful events.
- `aggressive_turn_count = 0` in 2 of 3 risky trips.

So a driver can see "34 events" that are mostly IMU noise, while the genuine risk events are few; and
the score barely differentiates an emergency-braking trip from a clean cruise.

### CRIT-5 — No `try` boundary around per-event JSON features feeding the model
`ModelScorer.predict` builds a DataFrame from `FEATURE_COLUMNS_FV1` — if a stored feature set is missing
a column (older trips), inference raises `KeyError` and silently falls back to rules (that part is safe);
the risk is silent version drift rather than a crash.

---

## 5. High-severity findings

- **H-1 Scoring isn't normalized by exposure.** Flat per-event penalties (`w_brake = 10` per event)
  mean a 22-second trip and a 10-minute trip pay the same penalty for the same single event; verified
  identical brake penalty regardless of duration. Industry telematics normalizes by distance/duration.
- **H-2 No overspeeding component.** Speed enters only via `speed_variance` (raw variance, sensitive to
  outliers); there is no speed-limit-relative or high-speed exposure term despite overspeeding being one
  of the headline alert categories.
- **H-3 Turn detection is orientation-dependent.** `turn_intensity = |gz_s| ≥ 2.0 rad/s` uses the raw
  phone z-axis, not vehicle yaw (no rotation into the vehicle frame). Loose mounts / portrait vs
  landscape / vertical phones make this signal unreliable → near-zero aggressive-turn detection in the
  wild.
- **H-4 `DrivingEventService.add_event` ignores its trip-ownership check** — `_trip` is computed and
  discarded; a driver can post events against any trip id (including other drivers' trips), polluting
  review dashboards and trip details.
- **H-5 Unpaginated list endpoints.** `GET /trips` (all of a driver's trips), `GET /admin/trips` (all
  trips of all drivers), and `GET /admin/drivers/{id}/trips` have no limit/offset. The mobile admin
  `refreshAllInternal` fetches all of these on every refresh.
- **H-6 Destructive finalization.** Trips with < 10 usable samples after preprocessing are **deleted**
  (trip + samples + events) during `finalize_trip`; the same happens silently inside `admin_service`
  GET handlers (`_cleanup_failed_insufficient_trips`). Short/legit trips (e.g. a 20-second parking
  maneuver) are permanently lost, and GET requests have write-side effects.
- **H-7 No rate limiting / abuse controls.** Login and sample upload are unthrottled; batch uploads allow
  5000 samples per request with no size or interval checks, and uploads to `completed` trips are accepted.
- **H-8 OSRM route snapping is a synchronous external dependency** (up to 12 s timeout × 3 attempts,
  ~2.4 s average) called from `GET /trips/{id}/route` on every view; no caching or offline fallback
  beyond "unavailable".

---

## 6. Medium findings

- **M-1 Tokens live 24 h** with no refresh mechanism; "logout" is client-side deletion only.
- **M-2 `score_breakdown` / `trip_features` stored as JSON text** — review dashboard parses JSON per row
  and re-loads full event lists per trip (N+1); no ability to query by feature.
- **M-3 Schema drift managed at runtime** — three sources of truth (alembic, `init_db` ALTERs, route
  retry/self-heal). On multi-worker deployments, concurrent `ALTER TABLE` at startup is a race.
- **M-4 Reprocessing is sequential and unbatched** — `reprocess_trips` finalizes trip-by-trip with
  per-trip transactions; no dry-run, no progress, O(n) HTTP/db round trips. Phase 4 will need a
  batched script with progress reporting.
- **M-5 Mobile code-quality baseline is thin** — no `typecheck`/`lint`/`test` scripts; `AppContext.tsx`
  is a ~1,000-line monolith; `sensorCapture.ts` mixes live capture with an elaborate demo simulator
  (12 routes) in one file; error surfaces are English strings baked into callers.
- **M-6 Demo mode biases training-like feedback** — `pickDemoTripProfile` is 40/35/25
  safe/normal/risky, and demo uploads flow through the same API as real trips, so synthetic demo trips
  pollute the training dataset (`build_training_dataset` labels them as synthetic, which is at least
  auditable, but they still shape the model).
- **M-7 `model_version = "rules_v1"` fallback** is stored in the same column as real model versions,
  making per-version queries ambiguous.
- **M-8 No composite uniqueness or event-dedup** — repeated `POST /events` or re-finalization can create
  duplicate events (finalization does delete-and-replace generated events, which is good).
- **M-9 Health endpoint / public surface** — no request-body size limits, no structured logging of
  sample-upload payload sizes; `debug=True` CORS is `*` with `allow_credentials=True` (invalid per spec,
  harmless locally).

---

## 7. Low findings / dead code

- **L-1** `app/services/trip_service.py` imports `TripRecord` which does not exist in
  `trip_repository.py` → `ImportError` if ever imported; the class is unused (routes call the repository
  directly). Remove or fix.
- **L-2** Unused schemas: `TripStartRequest`, `TripEndRequest`, `TripSummaryOut`; unused
  `sensorCaptureNotes`; `_ensure_sensor_sample_columns = ensure_sensor_sample_columns` alias.
- **L-3** `list_review_dashboard` computes both `generated_events` and `trip_events` (full lists) per
  trip for every dashboard refresh.
- **L-4** `auto_retrain` state machine is solid but untested against the `refresh_model_cycle` subprocess
  path (only the direct-function path is used).
- **L-5** `Trip.raw_deleted` is a boolean with no audit timestamp; no `deleted_at` on trips.
- **L-6** Website marketing site duplicates brand claims ("live monitoring") that do not yet exist —
  Phase 7 must deliver to make the site honest.

---

## 8. Security concerns

1. Broken ownership check on event creation (H-4).
2. No brute-force protection on `/auth/login` (H-7).
3. 24 h bearer tokens, no revocation (M-1).
4. Unauthenticated informational surface is minimal (health only) — good.
5. `backend/.env` exists locally with secrets; ensure it is git-ignored in **both** repos (the outer repo
   tracks a gitlink; the backend repo's `.gitignore` must exclude it — verify before any push).
6. JWT uses HS256 with a strong-required `SECRET_KEY` in production (enforced by `@model_validator`) —
   good.
7. No CSRF concern (bearer tokens, no cookies) — good.

---

## 9. Scalability concerns

- Unbounded list queries (H-5) are the top risk as trip counts grow.
- JSON breakdown parsing per dashboard row (M-2).
- Startup DDL races (M-3).
- Synchronous external OSRM (H-8).
- Auto-retrain triggers a full dataset rebuild + training inside the API process via a daemon thread
  (memory/CPU spikes on Render free tier).
- SQLite default in local; production uses PostgreSQL — the sequence desync incidents (CRIT-level past
  outages) should be fixed structurally (use server-generated IDs from the start of migrations).

---

## 10. UI/UX observations

- DriveScreen is already close to a "glance mode" (elapsed, samples uploaded/queued, sync status) but
  lacks live speed/acceleration, live events, and any glance-friendly alert surface.
- ResultsScreen/ReviewScreen display event lists and reasons well; there is no live event timeline.
- Admin screens (AdminDashboard/Drivers/DriverDetail) are static snapshots; no live trip view, no
  "drivers needing attention" grouping, no connection status.
- No notifications infrastructure in the app (no Expo push, no in-app toast system for events).
- i18n exists (en + at least one more language) — new real-time strings must be added through it.
- The website's LiveTripDemo is simulated and disconnected from the backend; Phase 7/8 could wire the
  real API.

---

## 11. Prioritized Issue List

### Critical (block correctness — fix in Phase 2)
1. **CRIT-1** Single-sample event suppression → 0 event counts (duration filter + EMA attenuation).
2. **CRIT-2** NaN/None GPS speed crashes finalization (`int(NaN)`).
3. **CRIT-3** `coords.speed ?? 0` fabricates false hard-brake events.
4. **CRIT-4** Event semantics mismatch: `unstable_motion` noise + `speed_variation` double counting +
   unpenalized emergency brakes → scores/event counts don't reflect risk.

### High (fix in Phase 2 / redesign in Phase 3)
5. **H-1** Flat per-event penalties not normalized by duration/distance.
6. **H-2** No overspeeding detection/penalty.
7. **H-3** Turn detection orientation-dependent and near-dead in practice.
8. **H-4** `add_event` ownership check unused.
9. **H-5** Unpaginated trip/admin list endpoints.
10. **H-6** Destructive deletion of short trips + side-effectful GETs.
11. **H-7** No rate limiting on auth/uploads; uploads accepted on completed trips.
12. **H-8** Synchronous OSRM blocking trip routes; no caching.

### Medium
13. **M-1** 24 h tokens, no refresh. 14. **M-2** JSON breakdown N+1 & non-queryable.
15. **M-3** Three-way schema management / startup DDL race. 16. **M-4** Sequential reprocessing.
17. **M-5** Mobile lacks typecheck/lint/test scripts; AppContext monolith.
18. **M-6** Demo trips flow into training data. 19. **M-7** `rules_v1` conflated with model versions.
20. **M-8** Event dedup. 21. **M-9** Debug CORS wildcard + credentials.

### Low
22. **L-1** Dead `TripService`/`TripRecord`. 23. **L-2** Unused schemas/aliases.
24. **L-3** Review-dashboard per-trip event reload. 25. **L-4–L-6** Minor.

---

## 12. Repository hygiene (must resolve before committing)

- **Backend repo** (`git -C backend`): `main` has uncommitted modifications to `app/ml/features.py`,
  `app/ml/inference.py`, `app/ml/schemas.py`, `app/services/trip_processing_service.py` (the sequence-feature
  work — `jerk_entropy`, etc.). Tests pass (42/42), but the work is not committed.
- **Outer repo**: `main` has a large uncommitted restructure — root-level Expo files moved into
  `mobile-app/` (deletions at root, modifications under `mobile-app/`), plus `website` gitlink changes.
- A stale branch `agents/codebase-analysis-and-improvement-plan` contains only a previous
  "clean repository" restructure commit — no prior analysis exists on it.
- `backend/.env` exists locally; confirm it is ignored by the backend repo before any push.

**Recommendation:** before starting Phase 2, snapshot the existing uncommitted work in each repo with a
descriptive conventional commit (e.g. `chore: commit pending sequence-feature work` / `chore: track
mobile-app restructure`), then commit each phase on top.

---

## 13. Verification performed (Phase 1)

- Read the full backend (routers, services, repositories, models, ML modules, tests, migrations).
- Read the mobile sensor-capture service, AppContext, API client, constants, and DriveScreen.
- Read website package/site content and LiveTripDemo.
- Ran the full backend test suite: **42 passed** (baseline).
- Ran empirical probes against shipped risky datasets and synthetic profiles confirming CRIT-1…CRIT-4,
  H-1 (see §4 evidence).

---

## 14. Recommended phase sequence (maps to the requested phases)

1. **Phase 2 — Fix Critical/High bugs** (CRIT-1…4, H-4, H-6, H-7 sanitization): NaN-safe features,
   event detection that keeps 1-sample events, remove zero-speed fabrication, de-dup `speed_variation`,
   sanity-check event durations, guard `add_event`, non-destructive insufficient-sample handling.
2. **Phase 3 — Redesign event detection & scoring** (industry thresholds, exposure-normalized weights,
   overspeeding, vehicle-frame turn detection where feasible, consistent aggregation, score bands).
3. **Phase 4 — Recalculate historical trips** (batched reprocess script + report of before/after).
4. **Phase 5–7 — Real-time driver alerts + driver monitoring (glance/details) + admin live dashboard**
   (WebSocket/SSE transport on the backend, live endpoints, mobile + admin UIs, i18n strings).
5. **Phase 8 — Accident detection** (impact/spike detection + confirmation heuristics, admin alerts).
6. **Phase 9 — ML retraining** (dataset rebuild on new features, hyperparameter tuning, calibration
   gates, blend-weight validation, ≥80% target, documented evaluation).

---

## 15. Phase 2 resolution status (added 2026-08-07)

Phase 2 (see [PHASE2_FIXES.md](./PHASE2_FIXES.md)) resolved: **CRIT-1** (single-sample events now
counted), **CRIT-2** (NaN-safe finalization), **CRIT-3** (no fabricated zero-speed events), **CRIT-4**
(speed_variation double counting removed), **H-4** (event ownership enforced), **H-5** (pagination),
**H-6** (insufficient-sample trips preserved, no GET side effects), and **H-7** (active-only uploads +
rate limiting). Open items are tagged for Phases 3–9 in the issue list above.

## 16. Phase 3 resolution status (added 2026-08-07)

Phase 3 (see [PHASE3_SCORING.md](./PHASE3_SCORING.md)) replaced the detection and scoring model:
raw-signal event detection with industry-standard thresholds (brake/accel ≥ 0.33 g, emergency ≥ 0.66 g,
cornering ≥ 0.45 g lateral), new overspeed + severe-overspeed categories, chargeable emergency brakes,
exposure-normalized scoring (events/hour density term), bounded smoothness penalties, and new risk bands
(≥85 low / 65–84 medium / <65 high). Resolves **H-1** (flat penalties), **H-2** (no overspeeding), and
**H-3** (orientation-dead turn detection); the `unstable_motion` noise floor (part of **CRIT-4**) is
fixed via the 2.5 m/s³ raw-jerk threshold. Threshold calibration against real driving data is deferred
to Phase 9.

## 17. Phase 4 resolution status (added 2026-08-07)

Phase 4 (see [PHASE4_RECALC.md](./PHASE4_RECALC.md)) recalculated all historical trips on the deployed
PostgreSQL DB through the v2 scoring pipeline via a new batched, resumable, dry-run-capable script
(`backend/scripts/recalculate_trips_phase4.py`). Result: **55/55** eligible trips re-scored under
`scoring_version: "v2"`, 14 insufficient-sample trips preserved (not deleted), **0 failures**, mean
score 47.4 → 32.9, and persisted event counts now match v2 semantics. Resolves the historical-data
inconsistency left open at the end of Phase 3 and **M-4** (sequential, unbatched reprocessing).
