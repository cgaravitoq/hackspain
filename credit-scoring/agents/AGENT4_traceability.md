# AGENT4 — Traceability and reconciliation

## Role, execution gate, and ownership

Run in PHASE 3 only after AGENT3_score_engine finishes successfully. First read `/home/juan/hackspain/credit-scoring/src/score_engine.py` to understand its actual result structure, then `src/config.yaml`, `audit/data_audit.md`, and `research/github_references.md` under the same project root.

Implement only `/home/juan/hackspain/credit-scoring/src/traceability.py`. Do not silently alter engine mathematics, weights, config, or upstream artifacts. If required provenance is missing, report the exact engine contract gap to the coordinator and wait for resolution. Treat original data as read-only. Use Python and deterministic serialization/validation only.

## Required public report

Produce one JSON-serializable report per scored company with this exact field contract (type notation below is illustrative, not literal JSON):

```text
{
  "company_id": str,
  "scoring_date": "YYYY-MM-DD",
  "base_score": float,
  "trajectory": "improving|deteriorating|stable|insufficient_data",
  "persistence": "confirmed|unconfirmed",
  "trajectory_adjustment": float,
  "final_score": float,
  "confidence": {
    "months_available": int,
    "months_complete": int,
    "coverage_pct": float,
    "currency_scope": "EUR_only|multi_excluded|insufficient"
  },
  "signals": [{"component": str, "change": float, "contribution": float}],
  "periods_compared": {"recent": [str], "baseline": [str]},
  "evidence_records": {"count": int, "date_range": str},
  "rule_version": "v1.0.0",
  "limitations": [str]
}
```

Pipe-separated strings above are enums: emit one value, not the whole list. Use ordered `YYYY-MM` labels for periods. Define evidence count as the number of distinct eligible source records actually used across the base, trajectory, and persistence calculations, deduplicating reuse across windows. Derive the date range from those same records, using `YYYY-MM-DD/YYYY-MM-DD`, or an empty string with an explicit limitation if the evidence set is empty. Do not count excluded currencies or unused snapshot rows as scoring evidence.

The required summary fields do not alone provide record-level lineage. Preserve the engine's stable record locators, component intermediates, windows, applied gates, raw contributions, cap/bound scaling, and effective contributions in a separate importable evidence-detail structure. Let AGENT5 export it as a companion artifact without changing the required report shape or copying unnecessary sensitive transaction details. A reviewer must be able to reproduce a score from retained source data and fixed rules.

## Reconciliation

Define and export `ReconciliationError`. Validate against the engine result; never silently repair a mismatch or recompute a different scoring policy.

- `sum(signal.contribution) == trajectory_adjustment` within the configured tight tolerance.
- `final_score - base_score == trajectory_adjustment` within that tolerance.
- `abs(trajectory_adjustment) <= 10` and within the configured cap.
- If persistence is not `confirmed`, adjustment and all effective contributions are zero.
- Stable/insufficient trajectory cannot receive a directional adjustment.
- Base and final scores are finite and in 0–100. Coverage is finite and in 0–100; month counts are nonnegative integers with complete months no greater than available months under the engine's stated counting contract.
- Validate enum values, scoring date, required keys, rule version, missing-month representation, evidence cutoff, and calendar-window ordering.

Raise `ReconciliationError` for contribution/adjustment/final-score inconsistencies, including nonfinite arithmetic; use clear validation errors for malformed reports. Capping and score-bound clipping must already be reflected in effective contributions. Keep full numerical precision through reconciliation and serialization; round only human-facing display values. JSON must contain no NaN or Infinity; missing values in evidence details must serialize as `null`.

Limitations must faithfully carry forward excluded currencies, gaps, short history, missing components or policy fallbacks, partial months, seasonal ambiguity, unavailable historical snapshots, and persistence overlap limitations. Do not convert confidence into a score penalty or invent evidence.

## Verification and handoff

Run offline checks for a reconciled positive/negative adjustment, unconfirmed zero adjustment, capped adjustment, clipping at both 0 and 100, deliberately tampered contributions, tampered final scores, nonfinite values, empty evidence, and JSON round trips. Tampered adjustments must raise `ReconciliationError`; do not catch and suppress it in the report builder.

Return the module path, report-builder and evidence-export function signatures, evidence serialization format, checks run, and any blockers to the coordinator. AGENT5 may start only after this module and AGENT3's engine are complete. Do not implement or launch the CLI phase yourself.
