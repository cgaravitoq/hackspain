# AGENT10 — Revision 2: a human explanation, not a model report

## Repository packaging status

This reporting change is tracked by HSP-59 and depends on the scoring engine from HSP-45 / PR #17. The engine, its base requirements and its `test_copilot` fixture helper are not duplicated here. The checked-in Python modules are the original two-page implementation; AGENT10–14 describe the pending human-v2 revision, not functionality already delivered.

`credit-scoring/` means the directory inside the current repository checkout. Other paths in these instructions are relative to that project directory unless they start with `credit-scoring/`. Do not edit a separate personal working copy by accident.

After the engine dependency is available, install `requirements-reports.txt` into the existing Python environment; it includes the engine requirements plus the exact PDF dependencies. PDF checks also require the Poppler commands `pdfinfo`, `pdftotext`, `pdffonts` and `pdftoppm`. Run the focused suite from `credit-scoring/`: `.venv/bin/python -m pytest -q tests/test_pdf_design_system.py tests/test_template_tesorero.py tests/test_template_financiero.py tests/test_template_sales.py`.

The existing real-company integration tests require local score/forecast pairs for COMP_0216, COMP_0874 and COMP_0114 in `results-v2-agent6-20260919/`; those private/generated inputs are deliberately not committed. The current demo runner is tied to that snapshot and its recorded hashes. Supply the inputs locally to reproduce it; do not claim a clean checkout contains them, remove assertions to hide their absence, or commit the generated files to make tests pass. Old report images/manifests referenced below are optional local review material, not tracked prerequisites for understanding this brief.

## This revision replaces the previous brief

The user reviewed the generated PDFs and rejected their information overload. The product is a concise, attractive explanation of a company's score and outlook, adapted to the reader. It is NOT a technical model-validation report, including for the Financiero.

This brief supersedes the former mandatory two-page layout, KPI dashboard, component/method/configuration tables, exhaustive in-PDF limitations, long numerical alert triggers, and mandatory scenario charts. Keep mathematical accuracy and auditability internally; do not force the reader to audit the system. One page is the default. A second page is permitted only for genuinely useful explanation that cannot fit comfortably, never to preserve the old technical appendix.

## Assignment and ownership

- Model: `claude-opus-5`, or an explicitly approved substitute; no silent substitution.
- Root: `credit-scoring/`.
- PHASE 1, FIRST: revise the existing shared design/utilities and freeze the new narrative contract. AGENT11/12/13 then revise their templates in parallel; AGENT14 rewrites the narratives and renders LAST.
- Own `templates/design_system.py`, `templates/pdf_utils.py` and their existing focused tests, particularly `tests/test_pdf_design_system.py`.
- Edit the existing implementation, do not build a second PDF framework. Do not modify engine/configuration/input JSONs, other agents' modules, old reports or unrelated tests. No agent launches, commits, pushes or live paid API calls.
- Read the current five instruction files, implemented templates/runner, related tests, and the existing narrative/manifest files under `results/reports/` before changes. Inspect the actual report images if available. Existing successful checks prove the old specification, not the new editorial quality.

## Product acceptance: the reader can answer four questions

1. How is this company doing now?
2. What changed in the observed months, and why does that support or weaken its score?
3. What might happen next, and what supports that expectation?
4. What should I pay attention to, and how much can I rely on this reading?

A generic sentence such as `El score mejora por una evolución favorable de los indicadores` fails: it names neither the underlying business dimension nor its effect. A list of component points also fails. Use concrete, grounded Spanish: a change in the balance of incoming/outgoing money, the relative burden of debt payments, returns, or bank fees, followed by its consequence for the score.

## Shared editorial rules — apply to every role

- Human Spanish, short paragraphs, active voice, meaningful headings. Explain a fact and its significance together. Do not simply replace English method names with Spanish jargon.
- Make the business story the largest part of the page. Current score is the visual anchor, not repeated in a KPI, a large gauge, a table and the conclusion.
- Focus on the one or two dominant movements and one material counter-signal when needed. Small nonzero movements are not automatically important. For COMP_0216, a -0.0036 contribution from fees must NOT become an urgent operational concern.
- Explain both level and direction where relevant: a dimension can be improving while still holding the score back. Use component levels and changes internally instead of confusing the largest base contribution with the reason for a recent change.
- Usually show only the current score and, if useful, one forecast endpoint or meaningful comparison. Extra figures must answer a reader question. Use at most one decimal for score/point values in visible prose; keep full precision internally. Do not impose a rigid numerical quota that hides a critical fact.
- The reader-facing report must NOT contain MAE, naive, regression comparisons, training/backtest counts, model winners, weights/threshold matrices, component-normalization points, YAML keys, rule-version strings, clipping/ddof details, JSON pointers, HIGH/MEDIUM alert codes or a catalogue of system limitations. These belong in the audit sidecar.
- Do not print automatic success reassurance (`sin riesgo`, `100% de confianza`) from empty alerts or complete coverage. Express relevant concerns as sentences, not alarm-code badges.
- Relevant uncertainty stays visible: too little history, sparse activity, stale data, a material omitted-data issue, seasonal uncertainty, divergent recent/longer history, or forecasts strongly affected by score calculation. State the concrete consequence, not a disclaimer wall. Do not invent an issue just because it appears in a generic checklist.
- No tables in the default report. At most one small optional chart if it adds understanding beyond the prose. No chart is a valid, often better choice. No forced empty blocks or second page when a forecast is unavailable.
- Use a brief footer disclosure: `Índice orientativo de salud de tesorería; no constituye una evaluación crediticia.` Keep `Generado por Embat · Confidencial`.

## Data truth: simplify language, not evidence

Use the existing validated `load_company_data(company_id, results_dir)` and its `company`, `forecast`, `source_paths` result. Keep identity/version/date/cutoff/weight/window checks, path containment, null semantics and finite-number checks. Missing files are errors; a real `insufficient_data` forecast is a valid state to explain.

The previous run explicitly used `credit-scoring/results-v2-agent6-20260919/`, with `companies/{company_id}.json` and `forecasts/{company_id}.json`. Recheck that source and retain matched pairs. Do not silently mix legacy `results/companies/` v1 objects with v2 forecasts or copy narrative values instead of reading source JSON. No regeneration or financial-model changes are part of this revision.

Crucial distinctions:

- `trajectory_adjustment` is a contribution to TODAY'S score, NOT the difference from a previously observed final score. `base_score` is NOT last month's score. Do not write `ha subido 10 puntos` by subtracting the current base from the current final. Without historical final-score snapshots, describe the observed improvement/deterioration and its effect on today's score; do not invent the historical numeric movement.
- `signals.change` is a change in a normalized component. `signals.contribution` explains the trajectory adjustment. `component_summary.base_contribution` explains the current level. Do not confuse these with EUR, absolute business volumes or percentages.
- Explain direction at the resolution the data permits. A worsening inflow/outflow relationship does not establish whether collections fell or payments rose. A better debt-payment measure does not prove debt principal fell or a loan was repaid. A returns score is not proof of customer defaults. Describe the observed relationship, not an invented business cause.
- Verify component meaning against `SISTEMA.md` and the actual engine. Where normalization/capping prevents a stronger interpretation, use `la evolución de ... es más/menos favorable` rather than reverse-engineering nonexistent raw amounts. Never infer a specific event or a month-by-month sequence from period averages alone.
- `confirmed` means corroborated direction, not a known run-length, independent evidence or high-quality coverage. Sparse data remain sparse despite confirmed deterioration.
- The score is not a cash balance or default probability. Forecasts are possibilities, not promised outcomes; no invented probability or guarantee.

## Shared rendering and narrative contract: human-v2

Keep the existing entry point in each role module: `render_report(data, narrative, output_path, report_date=None)`, returning the absolute generated path string. Preserve existing compatible aliases/imports where practical. A supplied report date is ISO `YYYY-MM-DD`; default remains the actual `scoring_date`. No file writes on import.

Replace the old role-specific narrative requirements with ONE small common envelope:

- `schema_version`: exactly `human-v2`.
- `company_id`: must match the loaded company.
- `role`: `tesorero`, `financiero` or `sales`, matching the renderer.
- `sections`: fields below, all Spanish, no markup instructions.
- `evidence`: the existing field-path mapping, now pointing to the new section names.

Required sections:

| Key | Content |
|---|---|
| `headline` | One short, company-specific conclusion, preferably 8–14 words |
| `summary` | One or two sentences giving the current reading, not repeating a table |
| `score_explanation` | One or two short paragraphs: important observed movements, actual comparison periods, impact on the current score, material counterpoint |
| `outlook` | Expected direction plus a supported explanation; or why no forecast is available |
| `caveat` | The material interpretation/forecast caution in one or two plain sentences; may be empty only when already fully integrated elsewhere |
| `next_steps` | A list of zero to two evidence-backed, role-specific review actions; never fill a quota |

All section values are plain strings except `next_steps`, which is a list of strings. Paragraph breaks in `score_explanation` are permitted. Omit the visual heading/block for an empty `caveat` or empty `next_steps`; never render an empty placeholder. Do not introduce role-specific mandatory fields without coordinating the shared contract.

Evidence keys are exact paths such as `sections.score_explanation` or `sections.next_steps[0]`. Each entry has `sources` (nonempty resolvable company:/ or forecast:/ pointers), `operation` (translation/transparent derivation), and optional `policy`. Cover every nonempty factual field, including headlines. All operands must be traceable. Evidence is NOT rendered. Static headings and footer disclosures are template text, not fabricated company facts.

A complete internal audit may retain all original limitations and technical values separately from `sections`. Those need not be narrated or printed. No automatic converter may resurrect `method_explanation`, `parameter_note` or a full limitations list inside the PDF. Validate/reject old payloads with an actionable message rather than silently mixing schemas. AGENT14 owns migration of the runner and final payloads; role agents own their own contract validators/tests.

## Visual revision

Reuse ReportLab, built-in Helvetica, the existing navy/teal palette and nominal A4 595 × 842 pt. No new dependencies unless essential and approved.

- Navy `#0B1F4B`, teal `#00C9B1`, white `#FFFFFF`, surface `#F8FAFC`, primary text `#111827`, secondary `#6B7280`. Keep green/red/amber tokens for restrained status accents, not a wall of competing badges.
- Preserve 48 pt horizontal margins, 499 pt content width and a footer-safe content frame. Existing helpers can remain available without all being used.
- One compact score display and a short status phrase near the headline. Remove the triple KPI row plus duplicate oversized gauge combination. A small gauge is optional, not compulsory.
- Main body 10.5–11 pt with comfortable 14–15 pt leading; section headings 12–14 pt; title 20–24 pt; score can be larger. Tiny type is not a compression strategy. Only footer/metadata may use 8–9 pt.
- Prefer a single reading column, approximately three prose sections and one restrained caveat/action area. Whitespace is intentional. No long yellow technical-text block and no multi-column audit spreadsheet.
- Measure real text before drawing; wrap without clipping or silent truncation. Dynamic page count and correct footer totals replace every assumption of `1 / 2` and `2 / 2`. Aim for one page for all nine demo reports. If truly necessary use two readable pages and document why, never shrink or hide a material warning.
- Keep Spanish accents and escaping of untrusted paragraph text. Use vector icons if necessary, no font substitutions or emoji dependency.
- Optional chart: one main scenario at most by default; dates and labels in plain Spanish, score axis clearly labeled, future values unmistakably projected. Do not fabricate a historical series from current base/final scores. If chart removal creates room for the explanation, remove it.

Freeze any shared helper/style changes before parallel template work. Maintain old helper APIs where practical; do not make each role rebuild the drawing system. No speculative layout framework.

## Migration checks and handoff

Update only shared tests whose intended presentation behavior has changed. Keep correctness/security/provenance tests. Check the new schema, body typography, long/short Spanish prose, empty optional caveat/actions, dynamic page totals, absence of duplicate hero scores, missing-data handling and no import-time rendering. Shared drawing helpers may still have technical capabilities; they must not force them onto a user-facing report.

The previous report manifest records an approved natural-size policy; do not reintroduce the 50 KB minimum. Retain valid PDF/parsing checks and a sensible maximum of 2 MB, with no padding.

Hand off the frozen human-v2 schema, style/helper interfaces, revised shared tests and blockers. PHASE 2 can start only after this handoff. Only AGENT14 publishes the revised nine reports, in `results/reports/human-v2/`; preserve the old PDFs and audit artifacts for comparison.
