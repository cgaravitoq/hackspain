# AGENT3 — Deterministic score engine

## Role, gate, and ownership

Run in PHASE 2 only after AGENT1_data_audit and AGENT2_research have both finished. Read, in this order:

1. `/home/juan/hackspain/credit-scoring/audit/data_audit.md`, especially `SCORING ASSUMPTIONS`.
2. `/home/juan/hackspain/credit-scoring/research/github_references.md`, especially `RECOMMENDED PATTERNS`.

Missing or unresolved essential inputs are a blocker: ask the coordinator rather than inventing schemas. Do not assume any input field names. Source data at `/home/juan/Descargas/output_hackspain_data/output/` is read-only.

Implement these owned files:

- `/home/juan/hackspain/credit-scoring/src/score_engine.py`
- `/home/juan/hackspain/credit-scoring/src/config.yaml`

Do not implement traceability, CLI, or README. Keep the design Python-only, deterministic, and compact, with no ML, external scoring services, or unneeded frameworks. Choose an explicit YAML parsing dependency if necessary and communicate its exact compatible version and installation requirement to AGENT5; never silently treat YAML as another format.

## Boundary and handoff contract

Provide importable functions for loading/validating config, loading the audited dataset, normalizing transactions, building monthly observations, and scoring one company as of a date. This keeps the CLI from reimplementing classification or scoring. Preserve company identifiers as strings. Validate boundary schemas and reject ambiguous critical inputs clearly.

Expose an engine result containing every final-report field plus internal evidence needed by AGENT4: component metrics and scores, normalized weights, missingness, raw/effective signal contributions, seasonal flags, comparison windows/endpoints, monthly observations, and stable source-record locators. Retain lineage back to original file/table and record ID or reproducible row position. Return audit-summary metadata and applied assumptions for the CLI. Communicate the concrete function signatures and result structure in your completion message.

Use a reproducible scoring-date cutoff with no future transactions. Default to the latest valid transaction date in the dataset rather than the machine clock; an explicit date overrides this. Select the last closed calendar month as the endpoint unless the audit proves another completion rule. Use consecutive calendar months, not the last six nonempty buckets. Distinguish financial coverage as a score component from observation completeness in confidence.

## Scoring layers

### Layer 1 — Base score

Compute a weighted scorecard from operational inflow/outflow ratio, chargeback rate, fee/interest load, and financial coverage, using the actual audited data. Normalize each component to 0–100 with documented directionality and deterministic threshold mappings. Derive financial definitions, units, numerator/denominator, classification, and window from the audit. Weights belong in config only; validate nonnegative weights and their declared normalization convention.

Define explicit behavior for unavailable components, zero denominators, and companies without eligible EUR observations. Never manufacture observed values, equate missingness with poor health, or let data completeness become a disguised penalty. If a neutral policy fallback is needed to satisfy numeric outputs, make it explicit in config and limitations, label the result insufficient, and do not present the fallback as measured health. Block when no defensible policy can be established from the audit. Keep every base score finite and within 0–100.

### Layer 2 — Trajectory

Compare the last three complete calendar months with the preceding three months, per component, using the same component mapping and fixed weights. Config controls windows and materiality thresholds. Return exactly `improving`, `deteriorating`, `stable`, or `insufficient_data`. Do not bridge observation gaps, use future data, or treat unavailable metrics as unchanged. Expose recent and baseline month labels as `YYYY-MM` arrays and directional changes in normalized component-score points.

### Layer 3 — Persistence

Confirm a directional trajectory only if it holds for at least two consecutive monthly comparison endpoints. At each endpoint, independently apply the same recent-three-versus-previous-three calculation. Two such rolling comparisons normally need seven contiguous usable months; six months can support trajectory but not this persistence confirmation. Reusing a single comparison twice does not count. Missing endpoints, direction reversals, stable results, or insufficient evidence yield `unconfirmed`; only supported improving/deteriorating trends yield `confirmed`. Configure the required count, never count overlapping windows as statistically independent evidence, and disclose this limitation.

### Layer 4 — Confidence

Return `months_available`, `months_complete`, `coverage_pct`, and `currency_scope`. Define counting horizons and the coverage denominator explicitly; keep coverage within 0–100. `currency_scope` is exactly `EUR_only`, `multi_excluded`, or `insufficient`. Confidence describes evidence reliability and must never be subtracted from the score. A change to confidence alone must not change base score or adjustment.

### Final score and signals

Only a confirmed directional trajectory may change the base score. Calculate a signed raw adjustment from weighted component changes, cap its magnitude at the configured maximum (no greater than 10), and bound the resulting final score to 0–100. `trajectory_adjustment` is the effective applied difference after all caps, gating, and boundary clipping: `final_score - base_score`. Otherwise it is zero.

Each signal includes `component`, `change`, and `contribution`. `change` is the normalized component-score delta; `contribution` is its effective contribution to the final adjustment, not its base-score weight. Apply the same proportional scaling to contributions whenever caps or bounds reduce the raw adjustment. Zero all contributions when the adjustment is gated off; handle zero totals explicitly without division by zero. Retain raw values internally. The sum of exported contributions must equal the effective adjustment within a small configured numerical tolerance. Avoid independently rounding values so reconciliation breaks.

## Configuration

Put all weights, score thresholds, materiality cutoffs, window sizes, persistence requirements, adjustment magnitude/cap, currency policy, missing-component policy, seasonal months/policy, numerical tolerance, and rule version in `config.yaml`. Set a defensible v1 policy once, with inline YAML reasoning as requested. Do not tune it repeatedly to make real companies look good. Reject invalid/nonfinite values and incompatible settings. Use `rule_version: v1.0.0`; subsequent intentional rule changes require explicit versioning.

## Safeguards that must execute in code

- Never sum currencies together. Default to EUR-only scope; exclude and flag other or unknown currencies before aggregation. No implicit FX conversion.
- Represent months without observations as `None`/NULL, never zero. Preserve real, observed zero totals. Keep evidence/completeness distinct from amount.
- Exclude current invoice/debt status from historical reconstruction unless auditable point-in-time history is available and cutoff-safe. Prefer an audited allowlist of usable historical fields.
- Never use platform registration date as company founding date or a proxy for age.
- Flag August and December as potentially seasonal before deciding deterioration. Emit limitations and use an explicit conservative confirmation policy when seasonal ambiguity is unresolved; do not claim a seasonal correction without evidence.
- Exclude financing and internal transfers from operational cash-flow metrics according to the audit, and handle reversal/deduplication rules consistently.
- Restrict every layer, confidence metric, and evidence record to the scoring-date cutoff.

## Verification and handoff

Run offline synthetic checks for currency exclusion, future/snapshot leakage, missing versus observed zero months, zero denominators, fewer than six months, six-month trajectory with unconfirmed persistence, confirmed trends across two endpoints, seasonal flags, negative/positive caps, score-bound clipping, config validation, and deterministic reruns. Use existing test infrastructure if present; temporary validation scripts need not become extra deliverables. Verify adjustment/contribution invariants and confidence independence.

Return the two output paths, API/result contract, dependency requirements, assumptions, verification results, and unresolved blockers to the coordinator. AGENT4 starts only after this phase finishes successfully. Do not launch it yourself.
