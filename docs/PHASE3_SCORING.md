# Drive Pulse — Phase 3: Driving Event Detection & Scoring Methodology (v2)

**Date:** 2026-08-07
**Scope:** `backend/app/ml/` (config, features, event_generation, scoring_rules, pipeline) +
`backend/app/services/trip_processing_service.py` (risk bands, event taxonomy)
**Tests:** 65 passed.

---

## 1. Why the redesign was needed

The Phase 1 review (see [CODEBASE_REVIEW_PHASE1.md](./CODEBASE_REVIEW_PHASE1.md)) and Phase 2 probes
proved the old pipeline systematically under-reported risk:

- Events were detected on the **EMA-smoothed** speed stream (α = 0.3), which attenuates real braking
  peaks by ~50–70%. A genuine −11.1 m/s² hard brake appeared as −3.4 m/s² — below every threshold.
- The **0.25 s wall-clock duration floor** discarded single-sample events, which is exactly how real
  braking looks at 1–2 Hz GPS sampling → "0 event counts despite clear events".
- **Emergency brakes were never penalized**, so trips full of emergency stops scored ~79/100 (medium).
- **`speed_variation` double-counted** every brake and acceleration event; `unstable_motion` fired
  20+ times per trip on ordinary road noise (0.12 m/s³ floor on smoothed jerk).
- Turns were detected from raw phone-axis `|gz| ≥ 2.0 rad/s` — a physically meaningless threshold that
  essentially never fired on real trips.
- There was **no overspeeding** component at all.

---

## 2. Event detection (v2)

Detection now runs on **raw** signals (the EMA stream is retained only for trip-level model features),
with rate-relative duration floors (see Phase 2's `event_segments`).

| Category | Signal | Threshold (international telematics norms) | Sustained |
|----------|--------|--------------------------------------------|-----------|
| `emergency_brake` | longitudinal decel `dv` (raw speed) | ≤ −6.5 m/s² (**0.66 g**) at ≥ 8 m/s | ≥ 1 sample |
| `hard_brake` | longitudinal decel `dv` | ≤ −3.2 m/s² (**0.33 g**) | ≥ 1 sample |
| `hard_accel` | longitudinal accel `dv` | ≥ 3.2 m/s² (**0.33 g**) | ≥ 1 sample |
| `aggressive_turn` | lateral accel `v × ω_z` | ≥ 4.4 m/s² (**0.45 g**) | ≥ 1.0 s |
| `overspeed` | speed (raw) | ≥ 100 km/h | ≥ 10 s |
| `severe_overspeed` | speed (raw) | ≥ 130 km/h | ≥ 5 s |
| `unstable_motion` | jerk magnitude (raw IMU) | ≥ 2.5 m/s³ (rough-road) | ≥ 1 sample |

Notes on the signal design:

- **Braking/acceleration** use `dv` from raw GPS speed divided by the true sampling interval. GPS
  speed quantization noise (~0.3 m/s²) is an order of magnitude below the 3.2 m/s² threshold.
  `dv` is clipped to ±11.8 m/s² (≈1.2 g) — larger values are measurement artifacts, not vehicle motion.
- **Zero-speed guard:** isolated `0 m/s` samples (a GPS speed-loss artifact on many phones) are treated
  as invalid unless they form a contiguous run of ≥ 3 samples (a genuine stop). This prevents the
  classic "50 → 0 → 50" phantom emergency-brake event. Phase 2's mobile change (`speed: null`) is the
  first line of defense; this guard covers legacy data.
- **Turns** use the lateral-acceleration proxy `speed × |yaw-rate|`, the standard kinematic definition
  of cornering. Because the yaw-rate is EMA-smoothed (which asymptotes slightly below the raw value),
  the *effective* floor is a touch above 0.45 g. Single-sample gyro spikes are excluded by the 1.0 s
  sustained floor — this removes the old turn "flood" without needing an orientation sensor.
- **Overspeed** uses raw speed (the EMA stream lags behind the limit and would undercount) with
  sustained-duration floors that map to ~1 km of continuous high-speed driving.
- **Phone distraction** is not detectable from the current sensor set (no screen/usage signal); it is a
  documented future category for Phase 5+.

---

## 3. Scoring model (v2)

```
score = 100
      - Σ per-event penalties
      - jerk percentile penalty
      - speed variance penalty
      - event-density penalty
clamped to [0, 100]
```

| Component | Weight | Notes |
|-----------|--------|-------|
| emergency brake | 8 pts/event | Chargeable: a risk indicator (following distance / approach speed) |
| hard brake | 6 pts/event | Non-emergency hard braking |
| hard acceleration | 5 pts/event | |
| aggressive turn | 5 pts/event | |
| overspeed | 4 pts/event | ≥ 100 km/h sustained |
| severe overspeed | 8 pts/event | ≥ 130 km/h sustained |
| unstable motion | 2 pts/event | Rough road (low per-event weight — partially environmental) |
| jerk (p95) | 10 × norm(p95_jerk, 1.0, 8.0) | Bounded smoothness penalty |
| speed variance | 6 × norm(var, 0, 30) | Bounded |
| **event density** | 10 × norm(events/h, 0, 24) | **Exposure normalization** |

Design rationale:

- **Exposure normalization (density term):** per-event penalties alone treat a 2-minute trip with two
  hard brakes the same as a two-hour trip with two. The density term (chargeable events per hour, with
  duration floored at 1 minute) makes scores consistent across trip lengths: the same driving behavior
  produces similar scores regardless of how long the trip lasts.
- **Bounded components:** jerk/variance/density penalties are normalized 0–1 before scaling, so noisy
  phone data can never dominate the score.
- **Emergency braking is chargeable** — a deliberate, documented change from v1. The old "emergency
  response" exemption turned risky trips into ~medium scores; the new model reflects the reality that
  emergency stops usually indicate poor following distance or excess approach speed.

### Risk bands

| Band | Score | Decision source |
|------|-------|-----------------|
| `low` | ≥ 85 | |
| `medium` | 65–84 | |
| `high` | < 65 | `risk_level` field on the trip |

### ML blend (unchanged from Phase 2)

The final trip score still blends the rule score with the ML model
(`_compute_final_score`): rules × (1 − w) + ML-risk-probability score × w, with the adaptive blend
weight (0.15–0.50) scaled by data confidence and model calibration. Phase 9 will validate and increase
the ML contribution after retraining.

---

## 4. Persistence & aggregation

- Persisted `driving_events` now carry the v2 category set. `speed_variation` remains in
  `GENERATED_EVENT_TYPES` only so reprocessing cleans pre-v2 rows.
- `trip_features` gains `unstable_motion_count`, `overspeed_count`, `severe_overspeed_count`,
  `total_chargeable_events`, and `events_per_hour` (plus all prior features, unchanged keys — so the
  existing fv1 model contract is preserved until Phase 9 defines fv2).
- `score_breakdown` records `scoring_version: "v2"` and the full penalty breakdown for auditability.
- Human-readable reasons (`build_human_reasons`) now mention overspeed and rough-road categories.

---

## 5. Validation evidence (empirical, shipped datasets)

| Scenario | v1 (old) | v2 (new) |
|----------|----------|----------|
| Clean cruise 54 km/h, 2 min | 100 / 0 events | **100 / 0 events** |
| Single-sample hard brake (60→20 km/h at 1 Hz) | **0 events**, no penalty | **emergency_brake detected**, score 77 |
| Isolated 0-speed artifact (50→0→50) | false hard_brake event | **no events** (guard) |
| Genuine stop (≥ 3 zero samples) | — | **emergency_brake + recovery accel**, score 74 |
| Overspeed 120 km/h × 12 s | not detected (no category) | **overspeed event**, score 67 |
| Sustained corner 0.32 rad/s @ 54 km/h | 0 turns | **1 aggressive_turn** |
| `risky_trip_240_samples_1..3` (synthetic, 3 emergency stops) | 79 / 79 / 72 (medium) | **20 / 0 / 15 (high)** |

The synthetic risky trips now land firmly in the **high-risk band** (they contain repeated
emergency-grade stops), clean trips stay at 100/low, and real-world single-event patterns are no longer
invisible. The exact turn/overspeed thresholds remain a calibration item to be tuned against real
driving data in Phase 9 (the synthetic gyro model over-produces cornering events).

---

## 6. Configuration surface

All thresholds and weights live in `backend/app/ml/config.py` (`FeatureConfigV2`) so calibration can be
adjusted without code changes. Phase 4's recalculation script consumes the same config, guaranteeing
historical trips are re-scored with exactly the production settings.
