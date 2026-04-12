# Backend Sample Collection Process

This document explains how the backend receives, validates, stores, and uses trip sensor samples.

## Overview

The backend sample flow has 4 stages:

1. Client uploads a batch to `POST /api/v1/trips/{trip_id}/samples`.
2. Request payload is validated by Pydantic schemas.
3. Valid samples are inserted into the `sensor_samples` table.
4. Trip finalization loads stored samples and runs the ML/rules pipeline.

## 1. Upload Endpoint

Route: `POST /api/v1/trips/{trip_id}/samples`

Implemented in:

- `app/api/v1/routes/sensor_samples.py` (`upload_samples`)

Behavior:

- Requires authenticated user.
- Builds `SensorSampleService`.
- Converts validated Pydantic models to dicts.
- Inserts rows via repository.
- Returns:

```json
{ "inserted": <count> }
```

## 2. Validation Rules

Schemas are defined in:

- `app/schemas/sensor_samples.py`

Key rules:

- Batch model: `SensorSamplesBatchIn`
- `samples` length must be between `1` and `5000`.
- Timestamp accepts both `ts` and `timestamp`.
- Speed accepts both `speed_mps` and `speed`.

Each sample can include:

- `ts`/`timestamp`
- `speed_mps`/`speed`
- `lat`, `lon`, `accuracy_m`
- `ax`, `ay`, `az`
- `gx`, `gy`, `gz`

## 3. Service + Repository

Service:

- `app/services/sensor_sample_service.py`

Repository:

- `app/repositories/sensor_sample_repository.py`

Flow:

1. Service verifies the trip exists for the authenticated user.
2. Service calls repository `create_many(...)`.
3. Repository creates ORM `SensorSample` objects and commits them.

Important safety check:

- If trip does not exist (or does not belong to the user), backend raises `NotFoundError("Trip not found")`.

## 4. How Samples Are Used During Finalization

Finalization logic:

- `app/services/trip_processing_service.py` (`finalize_trip`)

What happens:

1. Loads all trip samples ordered by timestamp (`_load_samples`).
2. Maps DB rows to pipeline payload format (`_samples_to_payload`).
3. Runs `run_trip_pipeline(...)`.
4. Saves score, breakdown, confidence, risk, model/version metadata.
5. Optionally deletes raw samples when `delete_raw=True`.

Pipeline minimum-data rule:

- In `app/ml/pipeline.py`, if cleaned sample count is less than `5`, result returns:
  - `score: null`
  - `breakdown.error: "not_enough_samples"`

## Read Endpoint (Debug/Verification)

Route: `GET /api/v1/trips/{trip_id}/samples`

Implemented in:

- `app/api/v1/routes/sensor_samples.py` (`list_samples`)

Query params:

- `limit` (default `500`, max `5000`)
- `after_ts` (optional timestamp cursor)

Use this endpoint to verify whether sample upload succeeded before finalization.

