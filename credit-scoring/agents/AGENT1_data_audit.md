# AGENT1 — Data audit

## Role and execution gate

Run in PHASE 1, in parallel with AGENT2_research. No upstream artifact is required. Do not implement the scoring engine, research, CLI, or traceability module. Work only on the audit artifact; treat source data as read-only.

Project root: `/home/juan/hackspain/credit-scoring/`
Data root: `/home/juan/Descargas/output_hackspain_data/output/`
Required output: `/home/juan/hackspain/credit-scoring/audit/data_audit.md`

The product is a Python-only, deterministic, config-driven treasury health score for the HackSpain 2026 Embat challenge. It scores companies from 0 to 100 using banking transactions, with trajectory, persistence, confidence, and traceability. This audit is the authority for downstream schema mapping; never invent field names or infer undocumented semantics as facts.

## Work

1. Explore the entire data directory, including nested directories, hidden files, and every file/table in containers. Print the full directory tree and complete file list, and include them in the report. Use a filesystem inventory API rather than omitting files through a glob. Record file formats and any unreadable or unsupported files. Do not silently skip them or execute embedded content.
2. For every file/table, report:
   - Relative path, format, schema, physical types, inferred logical types, and exact row count.
   - Date range for every meaningful date column, parse failures, timezone behavior, and which date is appropriate for transaction history.
   - Null count and null rate for every column, including empty-string/sentinel conventions; keep genuine numeric zeros separate from missing data.
   - Unique company IDs and count, identifier types, join keys, duplicate rows/keys, and referential-integrity problems. Preserve leading zeros in IDs.
   - Currencies present, counts per currency, missing/unknown currencies, and whether currency is explicit or inherited through an account join.
3. Identify the actual fields and observed values supporting operational inflows, operational outflows, chargebacks, fees, interest, financing flows, and internal transfers. Explain amount signs, status filters, reversals, duplicate handling, and classification ambiguities. Do not assume every credit is revenue or every debit is operating cost.
4. Identify multi-currency companies, accounts, and records. Recommend EUR-only scoring with other currencies excluded and disclosed; do not sum monetary values across currencies or infer an undocumented FX conversion.
5. Build a per-company calendar-month coverage matrix across its observed span, plus the common scoring horizon. Distinguish observed months, gaps, partial months, and verified complete months. A month without observations is NULL/unknown, never a zero cash-flow month. State what evidence, if any, proves that a month with no transactions is genuinely complete.
6. Explicitly list gaps in monthly coverage and companies with fewer than six observed months. Separate months available from months complete. Describe limits on six-month trajectory analysis and on confirming persistence with consecutive comparison endpoints.
7. Flag invoice status, current outstanding debt, current balances, mutable account status, or other snapshot fields as dangerous for historical reconstruction unless timestamped historical versions exist. Also flag registration/onboarding dates: they are not company founding dates.
8. Identify August and December observations as potential seasonal effects, without assuming every decline in those months is seasonal.
9. Recommend feasible definitions for the four base components: operational inflow/outflow ratio, chargeback rate, fee/interest load, and coverage. For each, list exact source columns, joins, eligible transaction classes, units, denominator, zero-denominator behavior, missing-data limitations, and evidence needed. Distinguish financial coverage from data completeness; flag unavailable financial coverage inputs rather than silently substituting confidence.

## Report structure

Include inventory, per-table profiles, join/classification map, company/month/currency coverage, historical-leakage hazards, feasible component definitions, data-quality limitations, and blockers. Aggregates must be derived from the full data, not an undocumented sample. Do not print personal banking details or unrelated sensitive raw records. Record stable source-row identifiers or reproducible row locators suitable for later evidence tracking without exposing unnecessary data.

End with a section titled exactly `SCORING ASSUMPTIONS`. List every assumption needed to compute a score from the observed data. For each assumption include its evidence, uncertainty, downstream impact, and whether it is supported, provisional, or blocked. Cover scoring-date cutoff, date semantics, transaction classification, EUR filtering, coverage/completeness, missing components, zero denominators, seasonality, and historical snapshot exclusions. Distinguish observed facts from proposed policy.

## Completion and handoff

Verify the inventory covers every discovered file and that row counts, null rates, company IDs, and month counts reconcile. Report inaccessible inputs and unresolved schema issues honestly; request assistance if blocked. Completion means the required report exists and the final assumptions section is usable by AGENT3. Return the artifact path and blockers to the coordinator. Do not launch another phase. AGENT3 must wait for both this audit and AGENT2's research report.
