# Safe Driving Backend Codebase Guide

## 1. Big Picture

This backend does two jobs at once:

1. It runs a FastAPI API for trip tracking, sample upload, event storage, authentication, and trip review.
2. It runs an offline ML workflow that turns recorded trips into features, labels them, trains models, evaluates them, and promotes a production model.

The core lifecycle is:

1. A user starts a trip.
2. Mobile or client code uploads sensor samples for that trip.
3. The trip is ended.
4. `TripProcessingService` finalizes the trip:
   - loads raw samples,
   - preprocesses them,
   - computes per-sample and per-trip features,
   - scores the trip with rules,
   - uses the production ML model when confidence is high enough,
   - generates human-readable reasons and events,
   - saves all outputs back onto the `Trip` row.
5. Offline scripts build a training dataset from completed trips and produce or compare models.

Two important design ideas appear everywhere:

- The API path is thin. Routes mostly validate input and hand off to repositories or services.
- The ML path is shared. The same preprocessing and feature code is reused by finalization, dataset building, and tests.

## 2. Folder Structure

### `backend/`

Main backend project root. This folder contains the app code, migrations, scripts, tests, environment files, datasets, model artifacts, and the SQLite database.

Important top-level items:

- `README.md`
  - Short operator guide: setup, run commands, tests, and ML workflow commands.
- `environment.yml`
  - Conda environment definition for the project.
- `requirements.txt`
  - Package list for pip-based installs.
- `pyproject.toml`
  - Project tool configuration and metadata.
- `alembic.ini`
  - Alembic migration configuration.
- `sdbackend.db`, `sdbackend.db-wal`, `sdbackend.db-shm`
  - SQLite database and WAL side files.
- `CODEBASE_GUIDE.md`
  - This document.

Also present:

- Many short random-named files and pytest temp/cache directories.
  - These look like scratch/generated files, not core source files.
  - Skilled reviewers will usually ask whether they should be gitignored or cleaned up.

### `backend/app/`

Main application package.

Subfolders:

- `api/`: FastAPI dependencies, middleware, exception handlers, and versioned routes.
- `core/`: settings, logging, JWT, password security, and custom errors.
- `db/`: database base class, engine/session creation, initialization, ORM models.
- `ml/`: preprocessing, feature engineering, rule scoring, model loading, event generation.
- `repositories/`: data access layer.
- `schemas/`: Pydantic request/response models.
- `services/`: business logic layer.

### `backend/alembic/`

Database migration system.

- `env.py`
  - Alembic runtime entry that wires migrations to the app's SQLAlchemy metadata and DB URL.
- `script.py.mako`
  - Template used when generating new migration files.
- `versions/`
  - Versioned migration scripts.

### `backend/artifacts/`

Generated or semi-generated ML outputs.

- `datasets/`
  - CSV and JSON datasets used for training/testing.
- `models/`
  - Trained model binaries and metadata.
- `reports/`
  - Evaluation, dataset summary, threshold, and comparison reports.

### `backend/scripts/`

Offline operational and ML scripts. These are the project's batch jobs and analyst tools.

### `backend/tests/`

Pytest tests that cover API flow, ML timestamp handling, reporting utilities, and trip processing.

## 3. Architecture by Layer

### Request and API layer

`app/main.py` creates the FastAPI application, attaches middleware, includes the v1 router, registers exception handlers, and initializes the database on startup.

Main lines:

- `setup_logging()`
  - Ensures request-aware logging is configured before app work begins.
- `FastAPI(...)`
  - Pulls title, version, and debug mode from settings.
- `@app.on_event("startup")`
  - Calls `init_db()` so tables exist.
- `app.add_middleware(RequestIDMiddleware)`
  - Adds an `X-Request-ID` per request.
- `app.include_router(api_v1_router, prefix="/api/v1")`
  - Mounts all versioned routes.

Questions skilled engineers ask here:

- Why initialize tables at startup if Alembic also exists?
  - This is convenient for local SQLite use, but in larger environments migrations normally own schema changes.
- Are there startup side effects?
  - Yes, database initialization happens automatically.

### Business layer

The most important service is `app/services/trip_processing_service.py`.

It is the orchestration center for trip scoring. It:

- loads the trip and sample rows,
- turns samples into a payload,
- calls `run_trip_pipeline(...)`,
- decides whether ML inference should run,
- falls back to rules when confidence is low or model loading fails,
- computes final score, risk probability, and risk level,
- generates derived events and reasons,
- persists the result and can optionally delete raw samples.

Main variables:

- `ML_CONFIDENCE_THRESHOLD = 0.5`
  - Minimum confidence to allow model inference.
- `MEDIUM_CONFIDENCE_THRESHOLD = 0.8`
  - Threshold used for UI-facing confidence banding.
- `LOW_CONFIDENCE_REASON`
  - Human-readable explanation appended when rules are used because confidence is low.

Main methods:

- `_load_trip(...)`
  - Loads one trip and raises if missing.
- `_load_samples(...)`
  - Queries ordered `SensorSample` rows.
- `_samples_to_payload(...)`
  - Translates ORM rows into the ML pipeline input shape.
- `_compute_final_score(...)`
  - Converts either ML probability, ML label, or rule score into the final 0-100 score.
- `_risk_probability_from_score(...)`
  - Uses ML probability when available, otherwise derives it from score.
- `_risk_level_from_score(...)`
  - Maps score into `low`, `medium`, or `high` risk.
- `finalize_trip(...)`
  - The main business flow.
- `get_trip_review(...)`
  - Builds the review screen payload.
- `list_review_dashboard(...)`
  - Produces list-view review data for many trips.
- `set_trip_review_label(...)`
  - Saves a human review label and notes.
- `reprocess_trips(...)`
  - Re-runs finalization for many trips using filters.

Questions skilled engineers ask here:

- Why call `self.db.rollback()` before running the pipeline?
  - It clears pending transaction state before doing CPU work and reloading entities, which helps avoid stale transactional state.
- Why is the final score inverted from risk probability?
  - The product score is framed as "safe driving score", so higher score means lower risk.
- Why keep both `risk_probability` and `score`?
  - `risk_probability` is ML-facing; `score` is user-facing.
- Why persist `score_breakdown` as JSON text?
  - It makes review/debug payloads easy to store without normalizing many debugging columns, though it trades off queryability.

### Data layer

Repositories under `app/repositories/` wrap SQLAlchemy queries. The codebase uses them lightly; some routes still query directly.

Key pattern:

- routes and services own workflow,
- repositories own small reusable database operations.

### ML layer

The `app/ml/` package turns raw samples into model-ready features and scores.

Flow:

1. `preprocessing.py`
   - parse timestamps,
   - compute `dt`,
   - drop invalid timing rows,
   - convert speed to m/s,
   - smooth signals with EMA.
2. `features.py`
   - derive acceleration magnitude, gyro magnitude, jerk, speed delta, turn intensity,
   - aggregate trip features like brake count, accel count, turn count, speed stats, and confidence.
3. `scoring_rules.py`
   - compute a rule-based risk score.
4. `pipeline.py`
   - combines preprocessing, features, and rule scoring into one shared function.
5. `inference.py`
   - loads the production model and predicts.

Questions skilled engineers ask here:

- Why do both `inference.py` and `interference.py` exist?
  - `inference.py` is the canonical module. `interference.py` remains as a backward-compatible shim for older imports.
- Why is DB field `speed_mps` if input is currently treated as km/h?
  - The project notes explicitly acknowledge historical naming drift. This is important and worth cleaning up carefully.
- How is confidence computed?
  - Confidence is heuristic and based on sample count, duration, and sampling gaps, not model calibration.

## 4. File-by-File Guide

## `app/`

### `app/__init__.py`

- Package marker.
- No business logic.

### `app/main.py`

- Role: application entrypoint.
- Main symbols: `create_app`, `app`.
- What it does:
  - configures logging,
  - creates the FastAPI app,
  - initializes the DB on startup,
  - installs middleware and exception handlers,
  - mounts `/api/v1`.

### `app/api/deps.py`

- Role: shared FastAPI dependencies.
- Main symbols: `bearer_scheme`, `get_users_repo`, `get_current_user`.
- Important behavior:
  - reads bearer token,
  - decodes JWT,
  - extracts `sub` user id,
  - loads user via `SqlUserRepository`.
- Main question:
  - Why not cache the user repository?
  - Because it depends on per-request DB session injection.

### `app/api/exceptions/handlers.py`

- Role: central exception-to-response mapping.
- Main symbols:
  - `_get_request_id`
  - `app_error_handler`
  - `http_exception_handler`
  - `validation_exception_handler`
  - `unhandled_exception_handler`
- Big picture:
  - converts internal exceptions into consistent API error payloads.

### `app/api/middleware/request_id.py`

- Role: attaches a request id to each request/response.
- Main symbols: `REQUEST_ID_HEADER`, `RequestIDMiddleware`.
- Why it matters:
  - makes logs and API debugging correlatable across layers.

### `app/api/v1/router.py`

- Role: top-level v1 router assembly.
- Main symbol: `api_v1_router`.
- What it does:
  - includes `health`, `auth`, `trips`, `sensor_samples`, and `events` routes.

### `app/api/v1/routes/health.py`

- Role: health endpoint.
- Main symbol: `health_check`.
- Returns:
  - a standard success payload, usually used for API liveness.

### `app/api/v1/routes/auth.py`

- Role: registration/login/current-user endpoints.
- Main functions:
  - `register`
  - `login`
  - `me`
- Depends on:
  - auth service,
  - JWT creation,
  - user repository.
- Reviewer question:
  - Is this stateless auth?
  - Yes, session identity is driven by bearer JWTs.

### `app/api/v1/routes/sensor_samples.py`

- Role: upload and list trip samples.
- Main functions:
  - `upload_samples`
  - `list_samples`
- Big picture:
  - this is how raw telemetry enters the backend.

### `app/api/v1/routes/events.py`

- Role: manual or derived driving-event endpoints.
- Main functions:
  - `_service`
  - `add_event`
  - `list_trip_events`
  - `events_history`
- Big picture:
  - exposes event creation/history separately from trip finalization.

### `app/api/v1/routes/trips.py`

- Role: primary trip lifecycle and review API.
- Main variables: `router`.
- Main functions:
  - `active_trip`
  - `start_trip`
  - `end_trip`
  - `list_trips`
  - `review_dashboard`
  - `get_trip_details`
  - `trip_summary`
  - `finalize_trip`
  - `reprocess_trip`
  - `reprocess_trips`
  - `trip_review`
  - `set_trip_review_label`
- Most important lines:
  - `repo.get_active_trip(...)` prevents starting multiple active trips.
  - `service.finalize_trip(...)` hands scoring to the business layer.
  - `trip_summary(...)` contains an older/manual penalty formula separate from ML finalization.
- Reviewer question:
  - Why does `trip_summary` compute score separately from `finalize_trip`?
  - It looks like a lightweight legacy summary path and may not match finalized ML-backed scoring.

### `app/core/config.py`

- Role: environment-backed settings object.
- Main symbols: `Settings`, `settings`.
- Main variables:
  - app metadata,
  - host/port,
  - `log_level`,
  - `secret_key`,
  - `access_token_expire_minutes`,
  - `database_url`.
- Important line:
  - `model_config = SettingsConfigDict(env_file=".env", ...)`
  - This makes `.env` the main local configuration source.
- Reviewer question:
  - Why normalize `debug` values like `production` and `development`?
  - It allows looser env inputs while still producing a boolean.

### `app/core/errors.py`

- Role: typed application exceptions.
- Main classes:
  - `AppError`
  - `NotFoundError`
  - `UnauthorizedError`
  - `ForbiddenError`
- Big picture:
  - keeps domain-ish errors separate from raw HTTP exceptions.

### `app/core/jwt.py`

- Role: JWT create/decode helpers.
- Main variable: `ALGORITHM = "HS256"`.
- Main functions:
  - `create_access_token`
  - `decode_token`

### `app/core/logging.py`

- Role: request-aware logging setup.
- Main symbols:
  - `RequestIdFilter`
  - `setup_logging`
- Big picture:
  - injects request id context into log records.

### `app/core/security.py`

- Role: password hashing and verification.
- Main variables: `BCRYPT_MAX_BYTES = 72`.
- Main functions:
  - `_bytes_len`
  - `hash_password`
  - `verify_password`
- Reviewer question:
  - Why cap bytes?
  - Bcrypt ignores bytes past its input limit, so this protects correctness.

### `app/db/base.py`

- Role: declarative ORM base.
- Main class: `Base`.

### `app/db/init_db.py`

- Role: table creation bootstrapping.
- Main function: `init_db`.
- Big picture:
  - imports models and runs `Base.metadata.create_all`.

### `app/db/session.py`

- Role: engine and session factory.
- Main symbols:
  - `connect_args`
  - `engine`
  - `SessionLocal`
  - `get_db`
- Important lines:
  - SQLite-specific `PRAGMA` setup enables WAL, foreign keys, and better busy timeout behavior.
- Reviewer question:
  - Why special handling for SQLite?
  - SQLite has different concurrency and connection behavior than server DBs.

### `app/db/models/user.py`

- Role: ORM user table.
- Main class: `User`.
- Stores:
  - `id`, `email`, `password_hash`.

### `app/db/models/trip.py`

- Role: ORM trip table.
- Main class: `Trip`.
- Main columns:
  - lifecycle: `started_at`, `ended_at`, `status`
  - scoring: `score`, `score_breakdown`, `feature_version`, `model_version`, `confidence`, `risk_probability`, `risk_level`
  - review: `reviewed_label`, `reviewed_label_source`, `review_notes`, `reviewed_at`
  - processing state: `processed_at`, `raw_deleted`
- Most important design decision:
  - one row stores both operational trip data and ML/review metadata.

### `app/db/models/sensor_sample.py`

- Role: ORM raw telemetry table.
- Main class: `SensorSample`.
- Stores:
  - timestamp, speed, GPS, accelerometer, gyroscope.
- Important note:
  - `speed_mps` name does not currently match the pipeline's km/h expectation.

### `app/db/models/driving_event.py`

- Role: ORM event table.
- Main class: `DrivingEvent`.
- Stores:
  - `event_type`, `value`, timestamps, trip/user ownership.

### `app/db/models/__init__.py`

- Role: imports all ORM models so metadata discovery works reliably.

### `app/ml/config.py`

- Role: feature/rule configuration object.
- Main class: `FeatureConfigV1`.
- Contains:
  - smoothing alpha,
  - speed unit,
  - event thresholds,
  - gap handling,
  - rule weights.

### `app/ml/preprocessing.py`

- Role: sample cleaning and normalization.
- Main functions:
  - `ema`
  - `_to_epoch_seconds`
  - `preprocess_samples`
- Important lines:
  - timestamp parsing with `utc=True`
  - `dt` filtering keeps only rows with positive, bounded gaps
  - speed conversion from km/h to m/s
  - EMA smoothing of all motion fields
- Reviewer question:
  - Why use explicit epoch seconds conversion?
  - To avoid silent timestamp scale mistakes leaking into `dt`.

### `app/ml/features.py`

- Role: derived signal and aggregate feature generation.
- Main functions:
  - `compute_per_sample_features`
  - `_count_events`
  - `aggregate_trip_features`
- Important outputs:
  - `duration_s`
  - `n_samples`
  - `max_gap_s`
  - `median_dt_s`
  - `mean_speed_mps`
  - `max_speed_mps`
  - `speed_variance`
  - `p95_jerk`
  - `max_jerk`
  - event counts
  - `confidence`
- Reviewer question:
  - Is confidence model confidence?
  - No. It is data-quality confidence.

### `app/ml/scoring_rules.py`

- Role: rule-based trip scoring.
- Main functions:
  - `_normalize`
  - `score_trip_rules_v1`
- Big picture:
  - turns engineered features into a rules score and breakdown.

### `app/ml/pipeline.py`

- Role: shared one-call trip processing pipeline.
- Main variables:
  - `FEATURE_VERSION = "fv1"`
  - `MODEL_VERSION = "rules_v1"`
- Main function:
  - `run_trip_pipeline`
- Important lines:
  - returns early for too-few samples,
  - runs preprocessing,
  - computes features,
  - runs rules,
  - returns a consistent result dictionary.

### `app/ml/event_generation.py`

- Role: derive event records and human-readable reasons from trip features and ML outputs.
- Main functions:
  - `generate_trip_events`
  - `build_human_reasons`
- Big picture:
  - converts model/feature numbers into explainable artifacts for UI and analysis.

### `app/ml/schemas.py`

- Role: feature column registry for dataset/model alignment.
- Main variables:
  - `FEATURE_VERSION`
  - `FEATURE_COLUMNS_FV1`
- Reviewer question:
  - Why centralize feature columns?
  - To keep training and inference using the same feature order.

### `app/ml/model_registry.py`

- Role: model metadata and production manifest utilities.
- Main functions:
  - `metadata_path_for`
  - `model_path_for`
  - `load_metadata`
  - `load_production_manifest`
  - `save_production_manifest`
  - `get_production_model_version`

### `app/ml/inference.py`

- Role: production model loader and predictor.
- Main symbols:
  - `MODELS_DIR`
  - `ModelScorer`
- Main methods:
  - `load_latest`
  - `predict`
- Important lines:
  - uses production manifest to find current version,
  - loads joblib model,
  - builds a one-row DataFrame in the canonical feature order,
  - returns both label and probability.

### `app/repositories/user_repository.py`

- Role: user data access and read model.
- Main symbols:
  - `UserRecord`
  - `SqlUserRepository`
- Big picture:
  - isolates auth-related user lookup/create behavior.

### `app/repositories/trip_repository.py`

- Role: small trip CRUD/query repository.
- Main class: `SqlTripRepository`.
- Main methods:
  - `get_by_id`
  - `create_trip`
  - `get_active_trip`
  - `end_trip`
- Important lines:
  - `create_trip` uses UTC `datetime.now(timezone.utc)`.

### `app/repositories/sensor_sample_repository.py`

- Role: batch insert and lookup operations for trip samples.
- Big picture:
  - keeps route/service code cleaner when handling many sensor rows.

### `app/repositories/driving_event_repository.py`

- Role: event persistence and query helper.
- Main class: `DrivingEventRepository`.

### `app/schemas/common.py`

- Role: common API response envelope.
- Main class: `APIResponse`.

### `app/schemas/error.py`

- Role: typed error response schema.
- Main classes:
  - `ErrorDetail`
  - `ErrorResponse`

### `app/schemas/health.py`

- Role: health endpoint schema.
- Main class: `HealthData`.

### `app/schemas/auth.py`

- Role: auth request/response models.
- Main classes:
  - `RegisterRequest`
  - `LoginRequest`
  - `TokenData`
  - `UserPublic`
  - `RegisterResponse`
  - `LoginResponse`

### `app/schemas/sensor_samples.py`

- Role: upload/list schemas for sensor rows.
- Main classes:
  - `SensorSampleIn`
  - `SensorSamplesBatchIn`
  - `SensorSampleOut`

### `app/schemas/events.py`

- Role: event API schemas.
- Main classes:
  - `DrivingEventCreate`
  - `DrivingEventOut`
  - `DrivingEventListResponse`
  - `DrivingEventHistoryResponse`

### `app/schemas/driving_event.py`

- Role: older/minimal event schema module.
- Main class: `DrivingEventCreate`.
- Reviewer question:
  - Why do both `events.py` and `driving_event.py` exist?
  - Likely historical duplication; worth consolidating if only one is used.

### `app/schemas/trip.py`

- Role: trip API schemas.
- Main classes:
  - `TripStartRequest`
  - `TripEndRequest`
  - `TripOut`
  - `TripDetailOut`
  - `TripSummaryOut`
  - `FinalizeTripOut`
  - `TripReviewOut`
  - `TripReviewLabelIn`
  - `ReprocessTripsOut`
  - `TripReviewDashboardItemOut`
- Big picture:
  - this file defines almost every trip-facing response shape in the API.

### `app/services/auth_service.py`

- Role: register and login business logic.
- Main class: `AuthService`.
- Big picture:
  - coordinates repositories, hashing, and JWT creation.

### `app/services/sensor_sample_service.py`

- Role: handles sample insertion and retrieval.
- Main class: `SensorSampleService`.

### `app/services/driving_event_service.py`

- Role: event creation/list/history business logic.
- Main class: `DrivingEventService`.

### `app/services/trip_service.py`

- Role: minimal trip service wrapper.
- Main class: `TripService`.
- Reviewer question:
  - Why does this file exist if most trip logic lives in routes or `TripProcessingService`?
  - It may be an incomplete service layer extraction.

### `app/services/trip_processing_service.py`

- Role: main trip finalization engine.
- Main class: `TripProcessingService`.
- Most important file in the project.

### `app/services/trip_processing_serivce.py`

- Role: backward-compatible shim for the typo-named import path.
- Reviewer question:
  - Why keep it?
  - So any old imports keep working while the canonical code lives in `trip_processing_service.py`.

## `scripts/`

These files matter because they are the offline side of the system.

### `scripts/generate_synthetic_trips.py`

- Role: creates synthetic safe and risky trips directly in the DB.
- Main variables:
  - `DEFAULT_TOTAL_TRIPS`
  - `DEFAULT_SAMPLES_PER_TRIP`
  - `DEFAULT_DT_SECONDS`
  - `SYNTHETIC_LABELS_PATH`
- Main functions:
  - `clamp`
  - `resolve_user_id`
  - `base_location`
  - `generate_safe_profile`
  - `generate_risky_profile`
  - `create_trip_with_samples`
  - `load_existing_synthetic_labels`
  - `save_synthetic_labels`
  - `main`
- Important code ideas:
  - safe trips use small speed and motion drift,
  - risky trips inject bursts of accel, brake, and turning behavior,
  - created trip ids are stored in a synthetic label registry.
- Reviewer question:
  - Why write synthetic labels to a sidecar JSON?
  - So the dataset builder can distinguish synthetic bootstrap labels from real reviewed ones.

### `scripts/build_training_dataset.py`

- Role: builds the training CSV from completed trips.
- Main variables:
  - `OUTPUT_PATH`
  - `SYNTHETIC_LABELS_PATH`
  - `REVIEWED_LABELS_PATH`
  - `REPORT_PATH`
- Main functions:
  - `load_synthetic_labels`
  - `load_reviewed_labels`
  - `make_weak_label`
  - `choose_label`
  - `_class_counts`
  - `select_rows_for_training`
  - `main`
- Important code ideas:
  - reviewed real labels have highest priority,
  - weak rule labels are a fallback,
  - synthetic labels are used last,
  - selected rows are balanced by class as much as possible.
- Most skilled-person question:
  - What is the label provenance order?
  - `reviewed_real` -> `reviewed_synthetic` -> `weak_label` -> `synthetic_bootstrap`.

### `scripts/train_model.py`

- Role: trains multiple candidate models and persists the best/candidate outputs.
- Main functions:
  - `_build_version`
  - `evaluate`
  - `train_candidates`
  - `_persist_candidate`
  - `run_training`
  - `main`
- Big picture:
  - turns the feature CSV into saved sklearn artifacts and metadata.

### `scripts/evaluate_model.py`

- Role: evaluates a saved model against the dataset and writes a report.

### `scripts/compare_models.py`

- Role: compares current production model vs candidate model.
- Main functions:
  - `_load_model`
  - `_metrics`
  - `_subset_metrics`
  - `_promotion_decision`
  - `run_compare`
  - `main`
- Big question:
  - Is promotion based only on one metric?
  - No, the script prepares a decision summary rather than blindly swapping models.

### `scripts/promote_model.py`

- Role: updates production-manifest style metadata when a candidate is approved.
- Main functions:
  - `_bootstrap_threshold_check`
  - `promote_from_report`
  - `bootstrap_promote_model`
  - `main`

### `scripts/refresh_model_cycle.py`

- Role: orchestration script for compare/promote/regression flow.
- Main variables:
  - `REPORTS_DIR`
  - `PYTEST_TEMP_DIR`
  - `PYTEST_CACHE_DIR`
- Main question:
  - Does it also run tests?
  - Yes, it includes regression test execution.

### `scripts/reprocess_finalized_trips.py`

- Role: batch re-finalize trips against the latest logic/model.

### `scripts/reviewed_model_analysis.py`

- Role: analyze reviewed trips against model predictions and export mistake reports.
- Main functions:
  - `load_reviewed_trip_rows`
  - `score_reviewed_trip_rows`
  - `build_reviewed_model_analysis`
  - `export_reviewed_model_analysis`

### `scripts/tune_risk_thresholds.py`

- Role: sweep probability thresholds and report tradeoffs.
- Main function:
  - `run_threshold_tuning`

### `scripts/reporting_utils.py`

- Role: shared reporting helpers used across scripts and tests.
- Main functions:
  - `build_dataset_summary`
  - `prediction_from_probability`
  - `confidence_band`
  - `build_model_mistake_log`
  - `build_threshold_report`
  - `build_confidence_bucket_report`

### `scripts/analyze_drift.py`

- Role: compare recent dataset distribution with baseline dataset distribution.
- Main variable:
  - `DATASET_PATH`

## `tests/`

### `tests/test_api_trip_flow.py`

- Role: end-to-end API critical-path test.
- What it proves:
  - trip start/upload/end/finalize works,
  - review endpoints return useful fields,
  - generated events persist,
  - rules fallback works when model prediction fails.
- Important helper functions:
  - `_make_session_factory`
  - `_load_samples`
  - `_client_with_overrides`

### `tests/test_trip_processing_service.py`

- Role: service-level tests for finalization behavior.
- What it checks:
  - score breakdown persistence,
  - generated events,
  - raw sample deletion,
  - cached return path,
  - rules fallback when model fails.

### `tests/test_ml_timestamp_scale.py`

- Role: regression tests for timestamp unit correctness.
- Why it matters:
  - protects against milliseconds/seconds bugs in `dt` and duration calculations.

### `tests/test_phase8_reporting.py`

- Role: tests reporting utilities and label-priority rules.
- What it checks:
  - label source precedence,
  - mistake logging,
  - threshold sweeps,
  - confidence bucket reporting.

## `alembic/versions/`

### `905c113c790f_init.py`

- Initial schema migration.

### `5e2ece5421a1_add_ml_fields_to_trips.py`

- Adds ML tracking fields to `trips`.

### `20260321_add_trip_scoring_fields.py`

- Adds trip scoring-related fields.

### `20260328_add_trip_review_fields.py`

- Adds human review labeling fields.

These migration names tell the story of the project:

- first basic trip data,
- then persisted scoring outputs,
- then review workflow.

## `artifacts/`

### `artifacts/datasets/`

- `trip_features_fv1.csv`
  - main training dataset.
- `synthetic_trip_labels.json`
  - mapping of synthetic trip ids to safe/risky labels.
- `risky_trip_240_samples_seed123.json`
  - raw sample fixture.
- `risky_batch/*.json`
  - multiple risky sample fixtures used by testing or analysis.

### `artifacts/models/`

- `model_fv1_lr_v1.joblib`
  - trained sklearn model artifact.
- `metadata_fv1_lr_v1.json`
  - training/evaluation metadata for that model.
- `feature_columns_fv1.json`
  - saved feature column order.

### `artifacts/reports/`

- `eval_fv1_lr_v1.json`
  - saved evaluation output for a specific model/version.

## 5. Answers to the Questions Skilled Reviewers Usually Ask

### Where does the truth of trip risk come from?

From `TripProcessingService.finalize_trip(...)`. That function owns the final persisted outputs. Rule scoring runs first, ML augments or overrides it when confidence is high enough.

### What is the single shared feature path?

`preprocess_samples(...)` -> `compute_per_sample_features(...)` -> `aggregate_trip_features(...)` -> `score_trip_rules_v1(...)`.

This is reused in:

- API trip finalization,
- dataset building,
- tests.

That reuse is one of the strongest parts of the codebase.

### What are the most important variables to understand first?

- `settings` in `app/core/config.py`
- `SessionLocal` and `get_db` in `app/db/session.py`
- `FEATURE_VERSION` and feature columns in `app/ml/schemas.py`
- `ML_CONFIDENCE_THRESHOLD` in `app/services/trip_processing_service.py`
- `SYNTHETIC_LABELS_PATH` and `REVIEWED_LABELS_PATH` in the scripts

### Where are the likely sources of bugs or maintenance cost?

- Historical naming mismatch: `speed_mps` vs current km/h assumption.
- Possible duplicate/typo files:
  - both `events.py` and `driving_event.py` schema modules
- Backward-compatibility shims:
  - `trip_processing_serivce.py`
  - `interference.py`
- Mixed responsibility:
  - some routes use repositories,
  - some query SQLAlchemy directly,
  - some business logic still appears in route files like `trip_summary`.
- Startup schema creation plus Alembic together:
  - convenient locally,
  - can become confusing in stricter deployment environments.

### What is the strongest design choice here?

The project has a clear reusable ML pipeline and a very readable central trip-finalization service. That gives the backend one obvious place where trip intelligence happens.

## 6. Suggested Reading Order for a New Engineer

1. `README.md`
2. `app/main.py`
3. `app/api/v1/routes/trips.py`
4. `app/services/trip_processing_service.py`
5. `app/ml/pipeline.py`
6. `app/ml/preprocessing.py`
7. `app/ml/features.py`
8. `app/db/models/trip.py`
9. `scripts/build_training_dataset.py`
10. `tests/test_api_trip_flow.py`

If you understand those files, you understand most of the project.
