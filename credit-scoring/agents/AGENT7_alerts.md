# AGENT7 — Evidence-linked automatic alerts

## Assignment and execution gate

- Model: `claude-sonnet-5`.
- Project root: `/home/juan/hackspain/credit-scoring/`.
- PHASE 2: start only after AGENT6 passes its tests and hands off the actual v2 engine and isolated v2 result directory. Run alongside AGENT8; do not wait for its forecast implementation and do not touch its files.
- Extend the existing system. Never recalculate or rewrite scoring in the alert layer.

## Read before writing code

Read ALL current authored source: `src/__init__.py`, `src/data_pipeline.py`, `src/score_engine.py`, `src/config.yaml`, `src/explainer.py`, `run_scoring.py`, `explain.py`, `explain_all.py`, and any newly added source files. Read `requirements.txt`, all existing tests, `agents/AGENT6_parametric_scoring.md`, `agents/AGENT8_forecasting.md`, and AGENT6's handoff. Inspect scored, unscored, drift-positive and fallback v2 outputs before choosing field access paths.

The initial repository has 35 passing offline unittest tests. The user authorized AGENT6 to update only the version assertion and each agent to add a separate new test file. `src/traceability.py` was absent on inspection; the engine builds the JSON and `run_scoring.py` writes it. Do not invent that module or change upstream interfaces.

## Exclusive write scope

- New production files: `src/alerts.py`, project-root `alert_config.yaml`, project-root `run_alerts.py`.
- New tests: `tests/test_alerts.py` only.
- Runtime outputs within the explicitly selected results directory: `alerts_YYYYMMDD.json` and the `alerts` key of `companies/<company_id>.json`. Preserve every other company field and do not write `scores.json`, forecast files, or summaries belonging to other tools.
- Isolated temporary test fixtures/results are allowed. No edits to other existing source/tests, scoring config, dependencies, other agents' instructions or raw CSVs. No commits or launches of other agents.

Treat the phase-1 v2 directory as the integration destination; keep the original 1,286 archived v1 reports intact during development. AGENT8 reads observed scoring fields but never writes company JSON, so parallel execution is safe when your company writes use atomic replacement.

## Input and field contracts

Company reports live at `<results-dir>/companies/<company_id>.json`; use these as the source of truth, not the portfolio `scores.json`, whose company copies are not updated by this tool.

Use the real nested fields:

- `trajectory`, `persistence`, `final_score`, `scoring_date`, `rule_version`.
- `confidence.months_available` and `confidence.coverage_pct` (a `[0, 1]` fraction).
- `latest_observed_month` from v2; for legacy input only, derive the latest month from the maximum of `periods_compared.recent` when available and record that source.
- AGENT6's `drift_alert` is an object present only on an actual special drift flag. Its `delta` is negative for deterioration, in normalized score points. Validate a meaningful object, not key presence alone. `drift_detection.delta` and its periods provide supporting evidence.

Validate required scalar types, finite numbers, real ISO dates/months and IDs before writes. Never convert missing/null scores or coverage to zero. Handle malformed files as explicit input errors, not as safe companies. For legacy reports without drift metadata, evaluate supported rules and report that drift could not be evaluated; never invent a drift value or claim no drift was found. Legacy results remain legacy: do not relabel them v2.

## Configuration: no hardcoded alert thresholds

Create `alert_config.yaml` with its own `version`, rule severities, severity ordering, and every threshold or categorical trigger value. Suggested initial values are policy defaults, not empirically validated cutoffs:

| Alert type | Predicate sourced from company JSON | Default configuration | Severity |
|---|---|---|---|
| `DETERIORATION_CONFIRMED` | trajectory and persistence both match | `trajectory: deteriorating`, `persistence: confirmed` | HIGH |
| `DRIFT_DETECTED` | valid active `drift_alert` and its delta strictly below threshold | `delta_threshold: -2.0` | MEDIUM |
| `INSUFFICIENT_DATA` | `confidence.months_available` strictly below threshold | `min_months_threshold: 4` | INFO |
| `STALE_DATA` | scoring month minus latest observed month strictly greater than threshold | `max_age_months: 3` | MEDIUM |
| `LOW_COVERAGE` | non-null `confidence.coverage_pct` strictly below threshold | `coverage_threshold: 0.5` | LOW |
| `SCORE_FLOOR` | non-null `final_score` strictly below threshold | `score_threshold: 40` | HIGH |

The user did not set the drift or insufficient-history defaults numerically; the defaults above align with the current scoring materiality/four-month comparison gate. Make them visible and independently configurable. Alert insufficient-history is not the forecast twelve-month eligibility gate.

Use `HIGH`, `MEDIUM`, `LOW`, `INFO` severity order. Validate configuration and enforce the required type-to-severity mapping; in particular reject attempts to escalate `INSUFFICIENT_DATA` to HIGH or MEDIUM. An insufficient-data company may independently have other evidence-backed alerts; the insufficient-data alert itself is always INFO.

Strict inequalities matter: exactly -2, four months, three months stale, 0.5 coverage or score 40 do not trigger the corresponding numeric rule. Use integer calendar-month arithmetic across year boundaries, not `days / 30`. No latest month means stale age is unknown, not infinity; report the rule as unevaluable. Future evidence relative to scoring date is an input inconsistency, not a negative-age alert.

## Alert records and provenance

Every alert contains:

- `company_id`, `alert_type`, `severity`.
- `trigger_value` and `threshold_used`, supporting structured objects for the two-field confirmed-deterioration rule.
- `scoring_date` copied from the source report and `rule_version` copied verbatim from its scoring engine version.
- `evidence`: explicit JSON Pointer/value pairs to the exact company fields used. For example, pointers to `/trajectory` and `/persistence`, or `/confidence/coverage_pct`. Record both raw dates plus the computed age for staleness; do not cite a nonexistent precomputed age field.
- Add `alert_rule_version` from alert config and `final_score` for auditability/sorting without overwriting the required scoring `rule_version` meaning.

Do not emit financial diagnoses, probability of default, causal claims or invented transaction evidence. A flag means a declared predicate matched calculated data.

## CLI and persistence

Required invocation: `python run_alerts.py --results-dir ./results`.

Also support `--config PATH` with a default path relative to the project/script, not the caller's working directory. A reproducible optional `--generated-on YYYY-MM-DD` may control the aggregate filename; default to today's date. This generation date must not replace company `scoring_date` or affect staleness.

1. Load and validate the batch/config before mutating reports.
2. Evaluate all independent rules; a company may have several alerts.
3. Sort alerts by severity rank, then numeric final score ascending. Null scores sort after measured scores within a severity. Break ties by company ID and alert type for deterministic output.
4. Save the sorted list as `<results-dir>/alerts_YYYYMMDD.json`.
5. Embed each company's own list under `alerts` in its company JSON. Re-running replaces that tool-owned list rather than appending duplicates. Companies with no matches get `alerts: []`; preserve unrelated unknown keys exactly in meaning. An absent `alerts` key means not evaluated, not an empty list.
6. Use same-directory temporary files and atomic replacements; do not expose partially written JSON to AGENT8 or AGENT9. Avoid writes if validation fails before the batch. Report partial write failures clearly; do not claim the whole batch succeeded.
7. Print the sorted alert list to stdout; print counts by type and severity to stderr so stdout remains machine-readable JSON. Report unevaluable-rule diagnostics separately. All serialization must reject NaN/Infinity.

Implement separate pure evaluation functions so rules can be tested without disk writes. Do not automatically rescore input or invoke forecasting. Re-running `run_scoring.py` would remove embedded alerts; the operational order must be scoring first, alerts second.

## Verification

Use offline unittest fixtures, temporary directories and no real network. Add `tests/test_alerts.py` covering:

- Positive, negative and exact-boundary cases for all six rules.
- Both categorical fields required for confirmed deterioration; missing/false/malformed drift flags never count as active flags.
- A real AGENT6 slow-drift fixture exercises the new producer/consumer path.
- Fractional coverage, zero-history/null final score, null coverage, unavailable dates, and legacy drift not evaluated.
- Staleness across December/January, exactly three months versus four, and use of source scoring date rather than today's date.
- Configuration changes affect results; all numerical policy thresholds come from YAML; INFO severity cannot be escalated.
- Evidence pointers resolve to the values that triggered the predicate; scoring and alert-policy versions remain distinct.
- Deterministic severity/score sorting, multiple simultaneous alerts, empty portfolios and tie handling.
- Idempotent reruns and preservation of every non-alert field; aggregate list agrees with embedded lists.
- CLI counts match persisted results; malformed input produces an explicit error rather than a misleading success.

Run `.venv/bin/python -B -m unittest discover -s tests`; all 35 original tests (with AGENT6's authorized version expectation) and all new tests must pass. Do not alter another agent's failing tests; report any upstream blocker.

## Handoff

Return changed paths, config schema/defaults, public alert functions, evidence format, commands/test outcomes, and actual paths to sample per-company and aggregate alerts in the integration directory. Supply examples with HIGH and INFO alerts and a drift alert, using clearly labeled synthetic fixtures for any case absent from the real portfolio. Explain any unevaluable rules.

PHASE 3 may start only after both AGENT7 and AGENT8 have completed and the combined offline suite is green. AGENT9 must read both actual outputs before writing code. Do not start it yourself.
