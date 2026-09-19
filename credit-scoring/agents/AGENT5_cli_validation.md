# AGENT5 — CLI, documentation, and end-to-end validation

## Role, execution gate, and ownership

Run LAST, in PHASE 4, only after AGENT3_score_engine and AGENT4_traceability finish successfully. Do not skip the audit/research prerequisite phases. Read:

- `/home/juan/hackspain/credit-scoring/audit/data_audit.md`
- `/home/juan/hackspain/credit-scoring/research/github_references.md`
- `/home/juan/hackspain/credit-scoring/src/score_engine.py`
- `/home/juan/hackspain/credit-scoring/src/config.yaml`
- `/home/juan/hackspain/credit-scoring/src/traceability.py`

Implement `/home/juan/hackspain/credit-scoring/run_scoring.py` and replace the placeholder `/home/juan/hackspain/credit-scoring/README.md` with the final usage documentation. Own generated results under the selected output directory. Do not reimplement scoring rules in the CLI or silently edit upstream modules to hide contract failures; escalate engine/traceability issues to the coordinator for correction and rerun validation afterward. Source banking data remains read-only.

## CLI contract

```text
python run_scoring.py --data-dir PATH --output-dir PATH [--company-id ID] [--scoring-date DATE]
```

Use Python argument parsing, validate paths and ISO `YYYY-MM-DD` dates, and preserve company IDs as strings. Resolve the default config relative to the entrypoint, not the caller's working directory. Use the engine's dataset-derived default scoring date consistently when the flag is omitted. Unknown company IDs, invalid inputs, missing dependencies, or contract failures must produce useful errors and a nonzero exit code, not empty successful output.

On startup, before scores are displayed, print a section titled exactly `DATA AUDIT SUMMARY`. Include actual runtime tables/columns found and schema validation against the audit, company/date/currency coverage, scoring cutoff, excluded records, missingness policy, and the applied scoring assumptions. Do not just echo a stale report as though it were a fresh inspection. Report schema drift; fail for missing/ambiguous critical fields. Do not print sensitive raw banking records.

Load data and config through the engine API. Score all companies, or only the supplied company ID, and build each report through the traceability API. Every company must be accounted for; do not silently skip unscorable companies. Use the engine's explicit insufficient-data policy, or report a blocker if it cannot produce a valid result.

## Outputs

Write under `--output-dir` (create it if absent):

- `scores_YYYYMMDD.json`: a JSON array containing one complete AGENT4 report per selected company.
- `scores_YYYYMMDD.csv`: one row per company, with scalar fields and flattened confidence columns; encode arrays/objects consistently as JSON strings in CSV cells. Include all mandatory report information or explicitly document its JSON representation.
- `evidence_YYYYMMDD.json`: companion lineage/details from AGENT4, linked by company ID and scoring date, sufficient to audit source locators and component calculations without duplicating unnecessary sensitive data.

`YYYYMMDD` is the effective scoring date, not the wall-clock execution date. Keep output ordering stable and use UTF-8, strict JSON without NaN/Infinity, and the standard CSV writer with correct quoting. Validate the full selected batch before publishing final artifacts so a failed run does not masquerade as complete. Do not overwrite unrelated existing artifacts without approval; use a fresh output directory for validation reruns when needed.

Print the summary table:

```text
company_id | base_score | trajectory | persistence | final_score | confidence_pct
```

`confidence_pct` is the report's `confidence.coverage_pct`, not a probability that the score is correct. Only table display values may be rounded; persisted values must reconcile at full precision.

## Required validation

Validate every company and fail clearly on invariant violations:

1. Signal contributions reconcile with trajectory adjustment and `final_score - base_score` using the shared configured tolerance; surface `ReconciliationError` with company context.
2. Base and final scores are finite and in 0–100; adjustment magnitude is at most 10, and unconfirmed persistence has zero adjustment.
3. No month without observations has been represented as numeric zero instead of NULL. Inspect engine monthly evidence, not only final reports. Genuine observed zero amounts are valid and must not be flagged.
4. EUR-only aggregation excludes other currencies before sums; exclusions and insufficient data are disclosed in confidence/limitations.
5. Periods and evidence honor the scoring-date cutoff, required calendar windows, persistence endpoints, and seasonal flags.
6. JSON and CSV contain the same selected company set, scores, and effective date, with no duplicate company records.
7. Two runs with identical input, config, and scoring date produce the same semantic output.

Use offline synthetic checks for invalid dates, unknown IDs, missing months versus observed zeros, reconciliation failures, and score bounds. Tests must not reach the network. Do not claim synthetic checks substitute for the required real-data run.

## README

Document prerequisites and exact dependency installation steps for the actual implementation, commands for all-company and filtered/historical runs, data layout/schema and mappings, default date semantics, each output field, the evidence sidecar, all config parameters and their reasoning, null/zero behavior, currency exclusions, trajectory and persistence rules, seasonality treatment, confidence semantics, assumptions, errors, and known limitations. Explain that this deterministic hackathon score is not a calibrated default probability, a proven lending decision model, or financial advice. Document rule version and how to reproduce validation. If runtime dependencies require a manifest, ask the coordinator to authorize the additional artifact rather than leaving undocumented imports.

## Mandatory real-data run

From `/home/juan/hackspain/credit-scoring/`, run:

```text
python run_scoring.py --data-dir /home/juan/Descargas/output_hackspain_data/output --output-dir ./results
```

Then inspect generated JSON/CSV/evidence, verify company counts against the audited data, and check all invariants. Also verify a real company filter and an explicit historical cutoff in separate fresh output directories so the all-company outputs remain intact. Report the exact commands, exit statuses, effective dates, processed/failed company counts, generated paths, and validation outcomes. Confirm completion without errors only after the real run actually succeeds. If data, dependencies, permissions, or upstream artifacts prevent it, report the blocker immediately; do not fabricate a successful run or remove this requirement.

Return results to the coordinator. Do not commit, push, or create a PR unless explicitly requested.
