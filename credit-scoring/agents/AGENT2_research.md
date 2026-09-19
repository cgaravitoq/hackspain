# AGENT2 — Public implementation research

## Role and execution gate

Run in PHASE 1, in parallel with AGENT1_data_audit. No upstream artifact is required. Research only; do not implement code or edit the audit, engine, configuration, traceability module, or CLI.

Project root: `/home/juan/hackspain/credit-scoring/`
Required output: `/home/juan/hackspain/credit-scoring/research/github_references.md`

We need a Python-only, deterministic, configuration-driven treasury health credit score for SMEs, not an ML model or a claim of calibrated default probability. The target has a 0–100 base score, six-month trajectory comparisons, persistence-gated adjustments capped at ±10, a separate confidence object, and reconcilable evidence.

## Work

Search GitHub for public Python implementations of deterministic credit scorecards, treasury health metrics, and SME cash-flow scoring. Use `gh` for GitHub operations, inspecting public repository metadata and relevant source files rather than relying only on search snippets. Suggested search queries:

- `credit scorecard python deterministic`
- `treasury health score fintech python`
- `cash flow scoring sme python`
- `scorecard weights config yaml`

Broaden or split queries when exact wording returns no useful matches. Record queries and exclusions. If network access, rate limits, or authentication block verification, disclose the issue and request assistance; never fabricate repository URLs or findings. Do not upload local banking data, execute downloaded code, or install repositories just to inspect them.

For each relevant repository found, record:

- Verified URL, repository name, inspection date, license, and maintenance signals.
- What it actually implements and which inspected files support that description.
- What it does well.
- Concrete patterns to adapt to our deterministic Python system.
- What to avoid: training/model dependence, opaque scoring, hard-coded weights, data leakage, cross-currency aggregation, missing-month zero filling, unlicensed copying, or dependencies inappropriate for a small CLI.
- Whether it is a direct fit or merely an adjacent example. ML/WOE scorecard projects may inform structure but are not acceptable as our scoring method.

Prefer a small set of genuinely relevant, verified sources to a long speculative list. If no direct treasury-health implementation is found, state that and distinguish adjacent examples from exact matches. This is pattern research, not a request to copy code.

## Required recommendations

Evaluate configuration-driven weights and threshold validation, pure scoring functions, boundary schema validation, explicit missingness, calendar windows, monotonic component scoring, deterministic output ordering, evidence lineage, versioned rules, and invariant tests.

End with a section titled exactly `RECOMMENDED PATTERNS`. Provide concrete, implementable patterns for AGENT3, AGENT4, and AGENT5, linked to inspected references where applicable. Clearly label your own design recommendations. Keep the implementation Python-only with deterministic rules, no ML, separate confidence, and immutable input data. Explain that score trajectories are operational indicators, not validated credit-risk probabilities.

## Completion and handoff

Check every cited repository URL and ensure each recommendation has a rationale and compatibility assessment. Return the report path and any research limitations to the coordinator. Do not launch another phase. AGENT3 must wait for both this report and AGENT1's audit; missing references must not be disguised as successful research.
