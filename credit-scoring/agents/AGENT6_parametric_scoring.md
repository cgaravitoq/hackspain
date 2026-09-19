# AGENT6 — Parametric scoring windows

## Assignment and execution gate

- Model: `claude-opus-5`.
- Project root: `/home/juan/hackspain/credit-scoring/` (not the Cloudflare repository in the orchestrator's workspace).
- PHASE 1: implement this agent alone. AGENT7, AGENT8 and AGENT9 must wait.
- Extend the working Python system. Never replace it with a new scoring implementation.
- Read this entire instruction and the downstream AGENT7–9 instructions before implementing the shared contracts.

## Mandatory reading and verified baseline

Before writing code, read ALL current authored source files: `src/__init__.py`, `src/data_pipeline.py`, `src/score_engine.py`, `src/config.yaml`, `src/explainer.py`, `run_scoring.py`, `explain.py`, and `explain_all.py`. Also read `requirements.txt`, `tests/test_score_engine.py`, and representative scored/unscored company JSONs. Re-inventory the source tree and read any source files added since these instructions were written.

The orchestrator read all these source files and ran `.venv/bin/python -B -m unittest discover -s tests`: **35 tests passed** before any implementation changes.

Actual integration facts:

- `src/traceability.py` does NOT currently exist. Traceability dictionaries are built in `score_engine.py` and serialized by `run_scoring.py`. Do not create or import a nonexistent traceability layer. If the file appears later, read it and keep it unchanged.
- `Config`, `load_config`, `monthly_component_scores`, `score_company`, `score_dataset`, and `run` already exist. Preserve existing public call compatibility.
- `WINDOW = 3` currently controls base, trajectory and persistence. Primary comparisons use the last three observed months versus up to three preceding observed months; four observations permit a 3-versus-1 comparison.
- Persistence compares the preceding window with the window before that, requires a full preceding recent window, and permits a partial preceding baseline. Preserve this behavior with the default window.
- Coverage is a fraction in `[0, 1]`, not a percentage in `[0, 100]`.
- `signals[*].contribution` explains the trajectory adjustment, NOT the base score.
- The old explainer contains fixed three-month/quarter wording. It remains read-only; disclose this compatibility limitation for nondefault windows rather than editing it.
- `--scoring-date` in the existing scoring CLI stamps results; it does not control `build_dataset`'s cutoff. Trust the code rather than the README's conflicting description.

## Exclusive write scope

Production source: **only** `src/config.yaml` and `src/score_engine.py`.

User-approved test exception: update **only the expected version literal** in `Confidence.test_reports_the_configured_rule_version_and_disclosed_limitations` in `tests/test_score_engine.py`, from `v1.0.0` to `v2.0.0-w3-h9`. All other existing assertions and all 35 tests must remain intact. Add new tests only in `tests/test_parametric_scoring.py`.

Do not modify `data_pipeline.py`, `explainer.py`, `traceability.py` if present, the existing CLIs, dependencies, other agent instructions, or existing `results/` artifacts. Tests and smoke runs may create isolated temporary fixtures/results. No commits, pushes, production-result replacement, or other agents' execution.

## Data invariants

Read-only source: `/home/juan/Descargas/output_hackspain_data/output/`.

Audited reference: 2,556,437 transactions; 1,635,919 retained by the current pipeline; 1,167 scored companies out of 1,286 reports; September 2024–August 2026 after the exclusive `2026-09-01` cutoff. These are reference counts, never values to hardcode into logic.

Use booking `date`, never `value_date`. Product currency comes from the banking/debt product union; EUR only, known product, usable categories, no FX conversion. Preserve the existing additional category exclusions and signed-amount handling. Missing months stay absent; genuine observed zeroes remain observations. Do not modify normalization constants, component weights, trajectory thresholds, adjustment caps or confidence effects.

## Configuration

Bump `version` to `v2.0.0` and add these settings without removing existing policy:

```yaml
windows:
  short: 3
  medium: 6
  long: 9
comparison_horizons:
  primary: short
  drift_detection: long
evaluation_frequency: monthly
min_months_for_window: 4
```

Resolve horizon names through `windows`; do not assume primary always means 3 or drift always means 9. Validate positive integer window sizes (reject booleans), known horizon references, a minimum comparison gate of at least two observations, and the supported frequency `monthly`. Preserve existing config validation. Legacy configuration without these new settings must retain default 3/6/9 windows, short/long horizons and the four-observation comparison gate. Unsupported frequencies must fail clearly, not silently do something else. Monthly frequency describes evaluation cadence; no scheduler is requested.

## Window semantics and fallback

1. Sort the observed monthly index. Both horizons compare adjacent, nonoverlapping **observed-month** windows, not zero-filled calendar ranges.
2. At a configured size `w`, with enough history, use last `w` observations versus preceding `w`. Only primary drives base, trajectory, persistence and adjustment.
3. Preserve the default 3-versus-1 behavior at four observations and the 3-versus-2 behavior at five.
4. If total observations meet `min_months_for_window` but cannot supply a baseline after allocating `w` recent observations, reserve at least one preceding observation: recent size is `min(w, n - 1)` and baseline uses up to `w` earlier observations. This is an explicit asymmetric short-history fallback, never a fabricated full comparison.
5. Below `min_months_for_window`, compute a base score from up to `w` available observations, but report insufficient trajectory, unconfirmed persistence, zero adjustment, and no drift alert. Zero observations still produce null base/final scores.
6. Record the exact observed periods and actual recent/baseline counts for both horizons. Add limitations whenever either side is shorter than configured, a comparison is unavailable, or observations span calendar gaps. A fallback for the long horizon must not be described as nine real months per side.
7. Parameterize persistence with the configured primary size, preserving its existing confirmation gate and default results. Shortened comparisons must not manufacture persistence confirmation. Preserve the limitation that consecutive persistence endpoints share observations.
8. Maintain finite 0–100 scores, cap/clipping behavior, zero unconfirmed adjustment, and contribution reconciliation using existing rounding/tolerance conventions.

## Drift contract shared with AGENT7 and AGENT9

Evaluate the long horizon independently of the primary direction, including when the recent primary trajectory is stable or improving. Use the same normalized components, weights and directional thresholds. Define delta as weighted recent average minus weighted baseline average, in normalized score points. Negative means deterioration.

Add `drift_detection` on every result, including insufficient results, with:

- `status`: `ok` or `insufficient_data`.
- `window_months`: configured drift size.
- `delta`: finite number, or null if unavailable.
- `trajectory`: the existing direction enum.
- `periods_compared`: recent/baseline lists of `YYYY-MM`.
- `actual_window_months`: recent/baseline integer counts.
- `fallback_used`: boolean.

Add `drift_alert` as an object **only** when primary is `stable` or `improving` and available drift is `deteriorating`. The object contains `delta`, `threshold_used`, `window_months`, `periods_compared`, and `fallback_used`, all copied from calculated/configured evidence. Otherwise omit `drift_alert`; consumers must never treat key presence with a false/null value as an alert. Drift detection and its flag do not change the final score.

## Version and explanatory evidence contract

- Every result, including zero-history results, records `rule_version` as `<config.version>-w<configured primary>-h<configured drift>`, default `v2.0.0-w3-h9`.
- This suffix identifies the requested policy, not a claim that complete windows existed. Add `window_usage` with `primary` and `drift_detection`, each containing `configured_months`, `recent_months`, `baseline_months`, and `fallback_used`. Exact periods plus actual sizes must always expose shortened windows.
- Preserve all existing JSON keys and semantics. Add `component_summary`, keyed by all four entries of `COMPONENTS`, with `weight`, `recent_average`, and `base_contribution` (weight times recent average). Use null averages/contributions for no observations. This gives AGENT9 calculated base-score attribution without mistaking trajectory contributions for base contributions. Contributions reconcile to the unrounded base, within declared export-rounding precision.
- Export `primary_delta` (null if unavailable) and `latest_observed_month` (null if absent) as simple calculated provenance for downstream use. The observed `score_company` wrapper also exports `data_cutoff` as the dataset's exclusive ISO cutoff date, including on unscored reports, so downstream code never has to parse prose limitations to validate the snapshot.
- Keep primary transaction evidence counting compatible with the existing result. Drift period provenance is separate; never claim the old primary evidence count includes newly inspected drift-only months.

## Shared engine entry point needed by AGENT8

Within `src/score_engine.py`, extract the existing score arithmetic into one public, deterministic entry point named `score_component_history(component_scores, config)`.

Input is a period-indexed DataFrame containing exactly the four normalized 0–100 component columns. Validate finite numeric scores, monthly unique periods and expected columns. Sort the index. Return the score-only calculation: base/final scores, trajectory, persistence, adjustment, signals, primary periods/delta, component summary, window usage, rule version, drift fields, and calculation-related limitations.

`score_company` must call this same entry point after `monthly_component_scores(features)` and add the existing observed-only confidence, exclusions and transaction evidence. AGENT8 will call the entry point on observed normalized components plus explicitly projected normalized components. Do not create an alternative forecast formula, inverse-normalize projected components into invented euro amounts, or create fake transaction counts. Confidence/evidence aggregation belongs outside this score-only entry point. Preserve all observed results other than intentional new metadata/version.

## Verification

Use existing `unittest`; no new dependencies or network. Add targeted tests before implementation where practical:

- Default numeric parity against pre-change fixtures, all 35 existing tests retained, only the authorized version expectation updated.
- Primary 3/6/9 and changed drift sizes; a horizon switch affects the actual periods rather than just labels.
- 0/1/3/4/5 observations; partial recent/baseline and long-window fallback; min gate; gaps remain absent.
- Invalid settings, legacy config defaults, version suffix on scored/unscored/fallback outputs.
- Synthetic slow deterioration with stable/improving primary causes drift alert; stable long comparison, unavailable comparison and primary deterioration do not produce this special flag.
- Drift-only changes cannot alter base/final/adjustment or primary persistence.
- Shared component entry point equals the existing observed wrapper's score math; reject nonfinite components.
- Base component attribution reconciles; trajectory contribution invariants still hold.

Run `.venv/bin/python -B -m unittest discover -s tests` and smoke-test existing CLIs against temporary results. If the real data is available, invoke the existing scoring CLI with a **new isolated output directory**, fixed scoring date `2026-09-19` and the unchanged source CSVs. Never regenerate over the 1,286 existing company JSONs. Treat the isolated v2 results directory as the phase handoff; report its absolute path. Running the existing CLI does not authorize source changes outside your scope.

## Handoff and release gate

Return changed paths, tests/results, confirmed scorer signature, representative new fields, and the isolated v2 results path. Note that existing `./results` remains v1 until the owner explicitly replaces it; it cannot supply drift retrospectively. All 35 original tests plus new tests must pass before PHASE 2.

Execution order:

- PHASE 1 (parallel): AGENT6 only.
- PHASE 2 (parallel, after successful AGENT6): AGENT7 and AGENT8, both reading the actual phase-1 source and v2 result contracts before coding.
- PHASE 3 (after successful AGENT7 + AGENT8): AGENT9.

Do not launch downstream agents yourself. If a contract cannot be satisfied inside the scope, report the exact blocker to the coordinator; do not widen scope or silently omit requirements.
