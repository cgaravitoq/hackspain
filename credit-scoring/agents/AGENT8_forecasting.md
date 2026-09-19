# AGENT8 — Guarded three-month component forecasts

## Assignment and execution gate

- Model: `claude-opus-5`.
- Project root: `/home/juan/hackspain/credit-scoring/`.
- PHASE 2: start only after AGENT6 completes, publishes its actual component-scoring interface and v2 result directory, and passes all tests. Run in parallel with AGENT7; neither agent depends on the other's implementation.
- Extend the existing data pipeline and scoring engine by importing them. Never replace their filtering, normalization, weights or adjustment rules.

## Mandatory reading

Before coding, read ALL current authored source: `src/__init__.py`, `src/data_pipeline.py`, `src/score_engine.py`, `src/config.yaml`, `src/explainer.py`, `run_scoring.py`, `explain.py`, `explain_all.py`, and any newly added source files. Read `requirements.txt`, existing tests, AGENT6/AGENT7 instructions, AGENT6's handoff, and actual v2 scored/unscored/fallback JSONs.

The initial 35 unittest tests passed. `src/traceability.py` was absent: the existing engine constructs report dictionaries, and `run_scoring.py` serializes them. Do not introduce a dependency on a nonexistent module.

## Exclusive write scope

- New production files: `src/forecaster.py` and project-root `run_forecast.py`.
- New tests: `tests/test_forecaster.py` only.
- Runtime outputs: `<results-dir>/forecasts/<company_id>.json` only, plus temporary fixtures/results. No updates to `<results-dir>/companies/`, `scores.json` or AGENT7's alert artifacts.
- No changes to existing engine, pipeline, config, explainer, CLIs, dependency manifest, other tests or agent instructions. If AGENT6's shared interface is inadequate, report the exact gap and wait for its owner; do not copy score math into forecasting.
- Use the existing Python environment, pandas, NumPy already used by the pipeline, and standard library. No new ML framework, network calls, commits, or downstream-agent launches.

## Audited data and operational-month eligibility

Read-only source: `/home/juan/Descargas/output_hackspain_data/output/`. Audited reference: 2,556,437 transactions, 1,635,919 pipeline-retained transactions, 1,167 scored out of 1,286 companies, September 2024–August 2026 after exclusive `2026-09-01` cutoff. Determine runtime counts; never hardcode these totals.

Reuse `build_dataset`, which joins banking/debt product currencies, uses booking `date` (NOT `value_date`), filters unknown products/non-EUR/invalid categories and does no FX conversion. Do not modify any raw CSV. Missing months must never become zero observations.

IMPORTANT: `confidence.months_available` and rows of `Dataset.features` can include fee-only, settlement-only or investment-only months. They are NOT proof of twelve observed operational months. Enforce eligibility using actual operational observation membership:

- Reuse the existing transaction/currency loaders and `OPERATIONAL_CATEGORIES` to identify distinct company/month observations with a valid date and amount, resolved EUR product, booking date before the dataset cutoff, and an operational category.
- This additional membership check only determines forecasting eligibility/training rows; it must not alter upstream aggregation or company scores.
- Preserve genuine zero-amount/zero-net operational observations; do not use `inflow > 0` as a proxy for observed data. Exclude nonoperational-only months from the eligibility count.
- Load reusable tables once per CLI run, not once per company. Use synthetic fixtures in tests, not the real extract.

## Non-negotiable data gate

Gate BEFORE regression, baseline projection or scenario generation:

- Fewer than 12 distinct observed EUR operational months: `forecast_status: insufficient_data`, `forecast: null`, `confidence: null`, no projected values. `reason` must give exact observed and required counts and months missing.
- 12–17 eligible months: produce a forecast with `forecast_status: low_confidence`, `confidence: low`, and an explicit short-history limitation.
- At least 18 eligible months: `forecast_status: ok`, `confidence: medium`. NEVER output high confidence.
- `--min-months` defaults to 12 and may raise the required count, but reject values below 12. CLI flags/configuration cannot bypass the hard floor. Apply this effective gate before assigning the confidence/status bands above: a company with at least twelve observations but fewer than a raised requirement still returns `insufficient_data`, null forecast and exact missing counts.

Add `observed_operational_months`, `min_months_required`, `months_missing`, and `reason` to every output so AGENT9 can explain refusals without guessing. `months_missing` is zero for eligible companies. Do not silently discard ineligible or unscored companies from a portfolio run.

## Component time series and method selection

The four series are those returned by the existing `monthly_component_scores`: `inflow_outflow_ratio`, `chargeback_score`, `fee_score`, `debt_score`. They are normalized 0–100 scores, even though one name contains the word ratio. Forecasts and their `metrics` must explicitly use these units, not euros or raw financial ratios.

1. Produce historical normalized component series with the existing function; select observed operational months for fitting and model comparison. Retain the unchanged full observed component history separately for the shared scoring engine.
2. Fit an ordinary least-squares line independently to each component against calendar-month ordinals. Real calendar gaps affect time distance; never compress years of missing history into adjacent fictitious months or impute missing observations.
3. Hold out the last three eligible observed months, with all earlier eligible observations as training. Export exact training/test periods.
4. Fit regression using training data only. The naive comparator is the average of the LAST THREE TRAINING observations, held constant for all test months. Never use the held-out months to compute the naive baseline, regression fit or preprocessing.
5. Evaluate both on the same three held-out months using MAE in normalized score points. Apply the same 0–100 clipping policy when evaluating and deploying predictions.
6. Regression wins only if its MAE is strictly lower; ties select naive. Reject corrupt nonfinite input or an unevaluable numerical fit with a clear error rather than inventing finite MAEs or serializing Infinity. A method-selection fallback to naive must be backed by the reported held-out comparison.
7. After selection, refit the winning regression on all eligible observations, or recompute the chosen naive average from the final three eligible observations for future use. The held-out MAEs remain the pre-refit measurements.
8. `months_used_for_training` means the final fit observation count; add `backtest_training_months` to expose the smaller holdout training count. For a blocked forecast both are zero.
9. Declare that linear regression is a candidate method, not an externally validated predictor; selection on three test observations is limited evidence, not validation.

## Dates, horizons and provenance

Use each matching company report's `scoring_date` as the forecast as-of date, not wall-clock time or the last observed month. Target the three complete calendar months immediately after its scoring month. For scoring date `2026-09-19`, output `2026-10`, `2026-11`, `2026-12`.

The audited last observation is August, not September. Extrapolate to the actual target calendar ordinals and disclose this gap. Do not label a one-step September projection October or fabricate September as an observation. For older company data, state the longer extrapolation gap explicitly. Do not append hidden bridge months to the scoring history; score the supplied observed history plus the explicit target projections and disclose the observed-month window convention.

Validate company identity, scoring date, `data_cutoff` and active scoring-rule version against the input reports. Compare dataset cutoff to the persisted `data_cutoff`, and verify effective weights/windows against AGENT6's component/window metadata. Use the existing observed scoring entry point to check that current data reproduces the persisted observed score/evidence fields, excluding downstream additions such as alerts. Reject future observations or mismatched source/config snapshots; do not silently re-date or relabel v1 company reports as v2. The existing scoring CLI's date flag is only a stamp, so it does not by itself establish historical as-of filtering. The phase-1 v2 snapshot is the intended source.

## Scenarios and the SAME scoring engine

For each component and target month:

- `base`: the selected regression/naive point prediction.
- `favorable`: base plus one sample standard deviation (`ddof=1`) of the component's eligible historical observations.
- `adverse`: base minus that same standard deviation.
- Constrain every scenario component to `[0, 100]`; expose the standard deviations and any clipping in limitations/provenance. All four normalized component scales point upward for better score behavior, so no hidden sign inversion is needed.

Use `score_engine.score_component_history(component_scores, config)` delivered by AGENT6 for EACH scenario endpoint. Start from the same original full observed component history and append only that scenario's projected target months through the endpoint being scored. No later projected month may affect an earlier endpoint. Do not contaminate scenarios with each other.

Use exactly the same config/weights/window/persistence/cap logic as observed scoring. Never build a weighted-sum-only substitute, change weights, inverse-normalize into invented cash flows, or pass fabricated transaction counts to `score_company`. The score-only API must not classify projected rows as actual observation evidence or boost observed confidence.

Return the actual engine final scores, not sorted/reordered scenario scores. Nonlinear persistence/adjustment can produce surprising scenario ordering; report and test it rather than silently relabeling scenarios. These are input perturbations, not calibrated probability bounds or causal forecasts.

## Stable forecast artifact contract for AGENT9

Write one JSON object to `<results-dir>/forecasts/<company_id>.json`. The CLI's required `--results-dir` is both the observed-report source and the forecast output root. Keep outputs separate from the company JSONs so AGENT7 can operate concurrently.

Required fields for every result:

- `company_id`, `scoring_date`, `rule_version` matching the observed source, and a separate `forecast_rule_version`.
- `forecast_status`: `ok`, `insufficient_data`, or `low_confidence`.
- `observed_operational_months`, `min_months_required`, `months_missing`, `reason`.
- `months_used_for_training`, `backtest_training_months`, `confidence`: `low`, `medium`, or null.
- `method_per_component`: each of the four component names mapped to `regression` or `naive` for eligible forecasts.
- `forecast_months`: three `YYYY-MM` target months for eligible forecasts.
- `scenarios`: `base`, `favorable`, `adverse`; each has `scores` (three finite numbers) and `metrics` (three objects, each holding all four projected normalized component scores).
- `baseline_vs_regression`: keyed by component, each with `regression_mae`, `naive_mae`, and `winner` equal to its selected method.
- `limitations`: all inherited company limitations plus forecasting-specific caveats, without silently dropping any.

Add `metric_units: normalized_score_points_0_100`, `training_periods`, `backtest_periods`, `historical_std_per_component`, `latest_observed_month`, and effective weights/window provenance. Include per-endpoint engine evidence under `scenarios.<name>.score_details` so projected scores can be reconciled to the shared engine's base/adjustment/signals/window behavior.

For insufficient data: `forecast: null`, `scenarios: null`, empty `forecast_months`, empty `method_per_component` and `baseline_vs_regression`, no numeric projected scores or MAEs, and zero training counts. For eligible data, `forecast` need not duplicate the top-level scenario structure; consumers use the top-level fields above.

Required forecasting limitations include:

- `Method not externally validated`.
- `Projected scores use same weights as observed — no recalibration`.
- `Favorable/adverse scenarios based on historical std, not causal model`.
- Only three held-out observations are used for method selection.
- The outputs project normalized components, not cash balances or default probabilities.
- Any short history, calendar gaps, stale history, baseline fallback, clipping, window fallback and unsupported seasonality evident in the calculations.

Serialize without NaN/Infinity. Validate before publishing; write atomically. Do not destroy an existing valid forecast on failed fitting or serialization.

## CLI

Required interface: `python run_forecast.py --data-dir PATH --results-dir PATH [--company-id ID] [--min-months 12]`.

At startup, before fitting forecasts, print to stderr how many companies qualify versus total scored companies, as well as total reports and unscored companies. Qualification is the operational-data gate, not the existing confidence count. With `--company-id`, still report the portfolio counts and separately the selected company's eligibility. Do not divide eligible selected companies by an unrelated portfolio denominator.

Missing selected company/report or invalid arguments must give actionable nonzero errors. A valid insufficient-data result is a normal recorded outcome, not an exception. Emit a concise output summary identifying artifact paths; do not call Anthropic or any remote model.

## Verification and handoff

Add only `tests/test_forecaster.py`; use synthetic fixtures and mocks, no network. Cover:

- 0, 11, 12, 17 and 18 eligible months; higher CLI requirement; rejection below 12; patch model fitting to prove it is NOT called below the gate.
- Settlement/fee/investment-only months, non-EUR and unknown products never satisfy the operational gate; genuine observed zeroes do; missing calendar months are not invented.
- Training/test split, calendar ordinals, no leakage, naive training-only baseline, regression win, naive win, ties and constant series. Assert the mechanism, not just labels.
- Final refit counts versus backtest counts, sample standard deviation, all scenario component bounds, explicit clipping.
- September as-of creates October–December targets from August data, year rollover, stale-company gaps and deterministic reruns.
- Spy on the shared engine to prove identical config and independent per-scenario histories; reconcile all projected scores to direct engine calls. No duplicated scoring formula or fabricated observation confidence.
- Blocked output carries null forecast and exact months missing; all three successful arrays have matching lengths and component keys.
- Source/version/identity mismatch errors, nonfinite rejection, atomic publication, CLI portfolio counts and preservation of company/alert files.

Run `.venv/bin/python -B -m unittest discover -s tests`; all 35 original tests, with AGENT6's authorized version assertion, and all new tests must pass. Use the isolated v2 integration directory for any real-data smoke run.

Return paths, public signatures, exact JSON schema, sample outputs for insufficient/low/medium confidence, actual qualifying count, baseline-selection results and commands/test outcomes. AGENT9 may start only when BOTH AGENT7 and AGENT8 are complete and the combined suite passes. It must read these actual artifacts first. Report blockers rather than crossing ownership boundaries.
