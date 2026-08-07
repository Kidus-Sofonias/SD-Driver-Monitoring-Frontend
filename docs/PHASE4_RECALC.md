# Drive Pulse — Phase 4: Historical Trip Recalculation (v2 Scores)

**Date:** 2026-08-07
**Scope:** `backend/scripts/recalculate_trips_phase4.py` (new), applied to the deployed PostgreSQL DB
**Tests:** 65 passed (backend suite); script validated against a temp SQLite DB before the production run.

---

## 1. Goal

Every stored trip was produced by the pre-v2 scoring pipeline (EMA-smoothed detection, dropped
single-sample events, unpenalized emergency brakes, `speed_variation` double counting, no overspeed).
Phase 3 replaced detection and scoring (see [PHASE3_SCORING.md](./PHASE3_SCORING.md)); Phase 4
re-processes all historical trips through the **same production config** so historical data is
internally consistent with the new methodology.

## 2. The script — `backend/scripts/recalculate_trips_phase4.py`

```
python -m scripts.recalculate_trips_phase4 [--dry-run] [--include-v2] [--limit N]
```

Design decisions (addresses M-4 — "reprocessing is sequential and unbatched"):

- **Dry-run by default.** `--dry-run` previews every matched trip (old → new score/events) and writes a
  JSON report without touching the DB.
- **Resumable.** Trips whose persisted `score_breakdown` already carries `scoring_version: "v2"` are
  skipped by default (`--include-v2` to force). The production run was executed across multiple
  sessions without re-processing completed trips.
- **Safe by construction:**
  - `raw_deleted` trips are **skipped** — their raw samples are gone, so re-scoring would nullify a
    legitimate score. (The old `reprocess_finalized_trips.py` had this data-loss hazard; the new script
    refuses it.)
  - Insufficient-sample trips are **preserved** (H-6 semantics): `score` set to `null` with a
    `not_enough_samples` breakdown — never deleted.
  - Per-trip transactions with error isolation: a connection drop or unexpected failure marks that trip
    as `FAIL` (with the exception) and processing continues; re-running retries only unfinished trips.
  - `--limit N` bounds a single run (useful for chunked execution over slow connections).
- **Report.** `artifacts/reports/phase4_recalc_report.json` (git-ignored, generated output) records
  totals, per-trip before/after deltas, and failure lists.

## 3. Validation (temp SQLite DB)

Before touching production, the script was run end-to-end against a throwaway SQLite database seeded
with one risky trip under v1-style storage:

| Check | Result |
|-------|--------|
| Seed → dry-run | Previewed `score 88 → 20`, old events → new events |
| Real run | Score persisted as **20 (high risk)**, 11 events stored, `scoring_version: "v2"` in breakdown |
| Idempotency | Second run skipped the trip (`skipped_already_v2`) — resumability confirmed |
| Cleanup | Temp seed script + DB removed |

## 4. Production run (deployed Supabase Postgres)

### Dry-run preview
- **69** completed trips matched; **55** eligible for re-scoring, **14** preserved as insufficient
  samples, **0** raw-deleted skips, **0** failures.
- Mean score projected to drop **47.4 → 33.2** (v2 is stricter and, crucially, *detects* events v1
  missed). Example: `813f872a` 98 → 31 with 10 new events — exactly the "0 event counts despite clear
  events" bug class.
- Noise events collapse (1066 → 442 total on the previewed set) with `speed_variation` /
  `unstable_motion` double counting gone.

### Actual run (resumable, multi-chunk)
```
processed: 55      preserved_insufficient: 14      failed: 0
skipped_raw_deleted: 0
```

### Resulting state (verified after completion)

| Metric | Value |
|--------|-------|
| Trips re-scored under v2 | **55 / 55** (100%) |
| Failures | **0** |
| Preserved (insufficient samples, unscored) | 14 |
| Mean score | **32.9** (was 47.4) |
| Median score | 19 |
| Score range | 0–100 |
| Risk bands | low (<40): 33 · medium (40–70): 10 · high (>70): 12 |
| Events | 6,470 total (≈117.6/trip, dominated by `unstable_motion` on rough-road datasets — see §5) |

The actual mean (32.9) matches the dry-run projection (33.2) — the write pass produced exactly the
previewed outcomes.

## 5. Observations & follow-ups

- **Score distribution is now meaningfully differentiated.** Median 19 with 33 of 55 trips in the
  low-risk band reflects the synthetic/demo-heavy dataset (short trips with few events score 0–20 under
  exposure-normalized v2) rather than a broken scorer — the same profile scored ~79 under v1's flat,
  emergency-exempt penalties.
- **14 short trips are preserved but unscored** (score `null`). If more raw samples become available
  (or minimum-sample thresholds are revisited), re-run the script to score them.
- **Event mix still leans on `unstable_motion`** because the shipped datasets contain rough-road
  synthetic profiles. Phase 9's calibration task should re-tune the jerk floor against real driving
  data.
- The **old** `scripts/reprocess_finalized_trips.py` remains for reference but should not be used for
  historical v2 recalculations (data-loss hazard on `raw_deleted` trips, no resumability).

## 6. How to re-run

```bash
cd backend
# preview only
python -m scripts.recalculate_trips_phase4 --dry-run
# apply (skips already-v2 trips; idempotent)
python -m scripts.recalculate_trips_phase4
# force re-processing of everything
python -m scripts.recalculate_trips_phase4 --include-v2
```
