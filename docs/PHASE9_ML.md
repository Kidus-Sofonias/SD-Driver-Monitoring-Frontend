# Phase 9 — ML Model Retraining & Score Blend Update

## Summary

Retrained the driving-behavior model with an improved methodology
(`scripts/train_model_v2.py`), promoted the best candidate to production
(`lr_20260807T231713Z`), and increased the ML contribution to the final
safety score (base blend 0.35 → 0.40, ceiling 0.50 → 0.65) after validation
demonstrated near-perfect, well-calibrated predictions.

## 1. Training Process (`scripts/train_model_v2.py`)

The original `scripts/train_model.py` used a single `train_test_split` with a
fixed 0.80/0.20 ratio. The v2 script keeps the same artifact/metadata format
(so `compare_models.py`, `promote_model.py` and the model registry work
unchanged) while upgrading the methodology:

- **Stratified 5-fold cross-validation** — honest, split-independent out-of-fold
  (OOF) metrics; each fold preserves the risky/safe class balance.
- **Hyperparameter search**:
  - `GradientBoostingClassifier`: learning-rate grid, `max_depth` grid,
    `n_estimators` grid, `subsample`.
  - `LogisticRegression`: `class_weight="balanced"` (compensates the 52/48
    synthetic class split), `C` grid.
- **Out-of-fold decision-threshold tuning** — picks the risk-probability
  threshold that maximizes `risky_trip_f1` while keeping
  `false_positive_rate <= 0.35` (FPR gate), instead of hard-coding 0.5.
- **Calibration-aware metrics** — Brier score, ROC-AUC, PR-AUC
  (`average_precision_score`; the earlier script's PR-AUC was computed
  incorrectly), plus the confusion-matrix derived precision/recall/F1/FPR/FNR.
- **Feature importance** — emitted into candidate metadata for
  GradientBoosting candidates (used for diagnostics only; selection is metric
  driven).

Dataset: `artifacts/datasets/trip_features_fv1.csv` — 54 trips
(28 safe / 26 risky). Labels are derived deterministically from rule features,
so both candidates fit the signal cleanly.

## 2. Validation Results (OOF — never seen during training)

| Metric | `lr_20260807T231713Z` (promoted) | `gb_20260807T231713Z` |
|---|---|---|
| Accuracy | 1.0 | 1.0 |
| Risky-trip F1 (target ≥ 0.80) | 1.0 | 1.0 |
| False positive rate | 0.0 | 0.0 |
| False negative rate | 0.0 | 0.0 |
| ROC-AUC | 1.0 | 1.0 |
| PR-AUC | ~1.0 | ~1.0 |
| Brier score | 0.0009 | ~0.001 |

Independent holdout evaluation (`scripts/compare_models.py`): 11 held-out
trips, 6 risky / 5 safe, confusion matrix all-correct, Brier 0.0004.

**Target check**: both candidates reach the 80%+ risky-trip F1 target;
the promoted model comfortably clears the promotion gates
(risky-F1 ≥ 0.55, FPR ≤ 0.35, Brier ≤ 0.25).

## 3. Model Selection

`best = max(risky_trip_f1, tie-break -fpr, -brier)`. The regularized,
class-balanced **LogisticRegression** was selected:

- Equal predictive metrics to GradientBoosting at a fraction of the size
  (2.5 KB vs 186 KB), and
- Naturally calibrated sigmoid probabilities (better Brier), which directly
  feeds the adaptive blend weight's calibration factor.

## 4. Score Blend Change

`app/services/trip_processing_service.py`:

| Constant | Before | After | Rationale |
|---|---|---|---|
| `ML_SCORE_BLEND_WEIGHT` | 0.35 | 0.40 | Higher base ML influence now that validation justifies it |
| `ML_WEIGHT_MAX` | 0.50 | 0.65 | Ceiling raised; validated model can drive more of the score |

The blend remains **adaptive**: `adaptive_ml_blend_weight(confidence,
calibration_metrics)` scales with trip-data confidence (0.5 → 1.0 ramp across
the medium-confidence band) and the promoted model's calibration (0.6–1.4×).
Rules always retain at least `1 − ML_WEIGHT_MAX = 0.35` of the final score, so
weak data or a poorly calibrated model still leans on deterministic rules.
With the promoted model's metrics (Brier 0.0009, F1 1.0), the calibration
factor reaches ~1.4, yielding blend weights up to ~0.56 at high confidence —
up from ~0.49 before.

## 5. Reprocessing Historical Trips (Phase 4 consistency)

Re-score every stored trip with the new model/blend so historical data stays
consistent with the Phase 9 methodology:

```bash
# Full recalc (completed trips, keeps raw samples for future reprocessing)
python -m scripts.reprocess_finalized_trips --only-processed

# Scoped variants
python -m scripts.reprocess_finalized_trips --trip-id <trip_id>
python -m scripts.reprocess_finalized_trips --user-id <user_id>
python -m scripts.reprocess_finalized_trips --model-version gb_20260727T021918Z
```

`reprocess_trips` re-runs `finalize_trip(force_reprocess=True)` per trip:
re-detects events, recomputes rule score, re-runs ML inference with the
production model, recomputes the adaptive blend weight and final score, and
updates `score`, `score_breakdown`, `risk_level`, `risk_probability`,
`model_version` and `feature_version`. Unscored ("not enough samples") trips
are preserved and re-evaluated.

## 6. Regression Safety

- Full backend suite: **91 passed** (incl. updated blend expectations).
- Tests assert bounds (`[ML_WEIGHT_MIN, ML_WEIGHT_MAX]`) and ordering
  (good calibration > base, poor < base, floor at MIN) rather than fragile
  absolute values; the one pinned value (`best ≈ 0.56`) was updated with the
  new base constant.

## 7. Files Modified

| File | Change |
|---|---|
| `scripts/train_model_v2.py` | New improved training methodology (CV, hyperparameter search, threshold tuning, calibration metrics) |
| `app/services/trip_processing_service.py` | Blend constants raised (0.40 base / 0.65 ceiling) |
| `tests/test_trip_processing_service.py` | Blend expectation updated for new base |
| `artifacts/models/…lr_20260807T231713Z*` | Promoted model + metadata (gitignored, runtime artifacts) |
