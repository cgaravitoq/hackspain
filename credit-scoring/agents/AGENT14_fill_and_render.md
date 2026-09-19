# AGENT14 — Revision 2: write the human explanation first, then render

## Replacement brief and assignment

The user rejected the first report set for excessive model detail and insufficient human explanation. Reauthor the narratives; do not merely shorten the old prose, rename MAE/naive, or fit the same technical content into one page.

The new product explains what happened in the company, why that matters for the score, what the forecast suggests and why, and what limits that reading. Financial-model diagnostics stay internal. One page is the default; a second page is acceptable only for genuinely useful content, not an audit appendix.

- Model: `claude-opus-5`, or an explicitly approved substitute. Act as the reasoning LLM; no external paid model call is needed for this assignment.
- Root: `credit-scoring/`.
- PHASE 3, LAST, after AGENT10's human-v2 shared gate and all three revised role templates pass.
- Own the existing `templates/fill_and_render.py`, its dedicated new/relevant integration tests, and the revised final reports/narrative/audit artifacts in `results/reports/human-v2/`.
- Do not edit shared/role template modules owned by the other agents, engine/config or input JSONs. Route template defects to the owner through the coordinator. No agent launches, commits/pushes or paid API calls.
- Preserve the first report set, `AGENT14_narratives_20260919.json` and `AGENT14_manifest_20260919.json` under `results/reports/`. Use the separate revision directory, do not overwrite/delete them. Do not create a second rendering framework.

## STEP 1 — Understand the problem and the revised contract

Read all five revised instruction files and the current implemented modules:

- `templates/design_system.py`
- `templates/pdf_utils.py`
- `templates/template_tesorero.py`
- `templates/template_financiero.py`
- `templates/template_sales.py`
- `templates/fill_and_render.py`

Read the original nine narrative payloads and manifest in `results/reports/` as evidence of what NOT to repeat. The first Tesorero narrative promoted a fee contribution of -0.0036 into a review action and printed a long drift threshold; the Financiero printed methods/MAEs/configuration and a dense limitations catalogue. Their presence in validated source data does not make them useful to the reader.

Confirm all three renderers accept AGENT10's `schema_version: human-v2` envelope, using unchanged entry-point signature `render_report(data, narrative, output_path, report_date=None)`. The required `sections` are `headline`, `summary`, `score_explanation`, `outlook`, `caveat`, `next_steps`; every nonempty factual field has internal evidence. Stop if prerequisites still implement the old schema/layout; do not work around them by passing old technical fields.

## STEP 2 — Load actual matched artifacts, not narrative constants

Use the existing loader for COMP_0216, COMP_0874 and COMP_0114. The first run used `credit-scoring/results-v2-agent6-20260919/`, containing `companies/{company_id}.json` and `forecasts/{company_id}.json`. Revalidate all six files, identity/dates/versions and source consistency. Do not mix legacy v1 `results/companies/` files into these pairs.

A missing/mismatched artifact blocks the report. A validated `insufficient_data` forecast is a valid case that gets a clear explanation and no fabricated prediction. No financial pipeline rerun or data enrichment is part of this task.

Build an internal explanation record BEFORE writing sentences. This is not displayed as a table in the PDF:

1. **Current reading**: final score, observed trajectory and actual recent/baseline months. Is there an earlier dated final-score snapshot? If not, record that an exact historical score change is unavailable.
2. **Reasons for current level**: inspect recent component averages and base contributions. Identify meaningful support/weakness, not automatically every component. A weak but improving dimension can both limit the current level and explain improvement.
3. **Reasons for observed movement**: inspect signal changes, their corresponding weights and applied contributions. Rank consequential movements, preserve signs and join by component name. An unconfirmed trend can have real component movements even when applied contributions are zero.
4. **Material opposing evidence**: active deterioration/longer-horizon drift, sparse/stale observations or another source-backed qualifier that changes the conclusion.
5. **Outlook and explanation**: inspect forecast status, target months, base scores AND each month's `score_details`, component summaries, base score and trajectory adjustment. Determine whether the apparent change comes from changing component conditions, a changing trend boost/penalty, or both. Do not interpret projected-window signals as changes from today's component levels without checking their comparison periods.
6. **What is unknown**: unavailable raw amounts/causes/history; reliability limits relevant to this particular reading. Do not fill these with financial intuition.

Record source pointers and deterministic derivations, with full precision internally. Preserve the original limitations/parameters and any audit coverage mapping in the sidecar rather than requiring all of them to appear in narrative sections.

## STEP 3 — Select what matters; do not serialize the JSON into prose

Choose the one or two strongest relevant observed drivers and, when needed, a meaningful counterpoint. Ask of each sentence: `Does this help the reader understand why this score or forecast looks this way, or what to review?` If not, omit it from the PDF.

- Do not promote a tiny negative signal merely to have an alert/action. For COMP_0216 the fee movement is negligible next to the debt-payment signal and longer-view caution.
- Do not turn `base_score + trajectory_adjustment = final_score` into a historical story. In the inspected snapshot 67.4 is the current base for COMP_0216, NOT its former score; 72.0 is the current base for COMP_0874, NOT its former score. `Ha subido de 67.4 a 77.4` or `ha caído de 72 a 62` would invent a time series.
- Without historical final-score evidence, write about the observed improvement/deterioration and why it strengthens/weakens the current score. A true dated before/after score is allowed only if actually provided and validated, never reconstructed from the adjustment.
- Describe the relationship measured, not an invented underlying event. Worse inflow/outflow behavior does not distinguish lower collections from higher payments. Fee/debt indices do not directly establish absolute euro changes or total debt. No assumptions about customer defaults, repayment events, revenue growth, business sector or product fit.
- Verify interpretations of components against the real system definitions. Normalized/clipped scores can support a direction without supporting a numeric raw-ratio reconstruction. Do not invert averaged/clipped indices into invented amounts.
- Be concrete without becoming technical: `La relación entre el dinero que entra y el que sale es menos favorable` is understandable and supported; `ha bajado la facturación` may not be.
- Include period context once, in natural Spanish. Do not claim a continuous number of worsening quarters from `confirmed`, or pretend an average comparison gives the monthly event sequence.

## STEP 4 — Explain the outlook, including when not to take it literally

A forecast paragraph must have three parts in ordinary language: what the available projection suggests; the source-backed reason for that pattern; and a material reason to interpret it cautiously. No method names, MAEs, confidence percentages or training tables. Avoid generic boilerplate duplicated in every report.

### Critical verified case: COMP_0216

Re-read the source; these are explanatory anchors, not hardcoded production values:

- Observed score: 77.4; underlying base: 67.4; current positive trend adjustment: 10.0.
- Base forecast October/November/December: 69.4, 80.2, 67.4. It is NOT a monotonic fall.
- At `forecast:/scenarios/base/score_details/2`, base is 67.4, adjustment 0.0, direction stable, and component levels broadly resemble the observed recent levels.
- Therefore the lower December score largely reflects the absence of today's improvement boost, NOT a forecast of sharply worsening underlying activity. Small component changes and rounding mean you should not assert exact unrounded equality.

Human wording to emulate, after grounding:

> La estimación para diciembre queda por debajo de la puntuación actual, pero no porque anticipe un empeoramiento claro de los indicadores. La puntuación de hoy reconoce la mejora reciente; esa aportación deja de sumarse cuando la evolución prevista se estabiliza. Conviene leer esta bajada como una cautela sobre la continuidad de la mejora, no como una caída segura de la actividad.

This is an explanation of how the score changes, not permission to show an adjustment formula/model table. Do not replace it with `base terminal -10.0, confianza media`. Cite current/terminal component levels, base and adjustment in the internal evidence. If an adverse scenario is mentioned, present it as a conditional possibility, not a likely outcome or calibrated lower bound; it is optional unless material to the role's conclusion.

### Insufficient or weak evidence

- COMP_0874: eleven eligible operational months versus twelve required. Explain no projection was produced; do not invent a recovery forecast or claim it will be available exactly next month.
- COMP_0114: seven eligible months versus twelve required; sparse recorded activity also limits interpretation of the observed deterioration. Zero months meeting a completeness rule is not zero history. Its 19 evidence transactions belong to the compared window, not necessarily all company activity.
- When a produced forecast has limited support, say what is missing and what it means: it is an orientation, not a dependable promise. Do not label it inherently impossible/false without evidence.
- If staleness, unrepresented seasonal patterns, missing categories or scenario spread matter, translate the actual implication into one concrete caveat. Do not assert that a generic seasonal warning proves seasonality caused the change.
- Separate low observed coverage from forecast confidence; neither is a probability that the conclusion is true. A confirmed trend can coexist with very sparse data.

## STEP 5 — Author nine genuinely role-specific Spanish payloads

Use the common human-v2 schema; the facts agree across roles but emphasis/actions differ. Do not create the final narratives by three company-ID switches containing frozen scores. Reason from the freshly validated data, save those authored payloads with source hashes, and make the runner consume/validate them. Demo examples guide editorial checks, not general business logic.

### Tesorero: practical, calm, operational

Rough target 220–300 words. Explain the current money-flow/debt-payment/fee/returns picture, what supports or weighs on the score, and what to review now. Limit `next_steps` to zero–two concrete checks tied to dominant signals or missing evidence. No invented balance, debt due date or instruction to obtain financing.

For COMP_0216 emphasize the debt-payment dimension and longer-view caution, not trivial fee noise. For COMP_0874 explain the less favorable incoming/outgoing money relationship and returns. For COMP_0114 qualify the negative signals immediately because the available activity is sparse; completing/reviewing data is more useful than a confident cash prediction.

### Financiero: defensible explanation, not model documentation

Rough target 260–350 words. Distinguish why today's level is what it is from why recent behavior helps/hurts it. Explain the actual period comparison and the outlook mechanism. A useful number is allowed; a table of four weights and four MAEs is not. In COMP_0216 make the non-continuing trend boost understandable and preserve longer-horizon weakness. Limit caveats to those changing the interpretation, with full traceability left in the audit.

### Sales: context before a commercial conversation

Rough target 180–260 words. Explain the business dimensions behind the score and what to bear in mind when speaking to the company. Do not replace reasons with traffic lights or an upsell slogan. Preserve the existing commercial disposition policy internally if retained by the template, but qualify it with the actual outlook and material concerns.

For COMP_0216 a GREEN policy class is not a promise of continued improvement or a positive forecast; a qualified conversation is appropriate. For COMP_0874/COMP_0114 confirmed deterioration supports caution, while the latter additionally needs better context/data. No invented product need or review-in-X-months date.

### Writing requirements for all nine

- A short company-specific headline, not `Resumen ejecutivo` as the entire conclusion.
- One understandable reason tied to the score at minimum; normally the two dominant drivers.
- A forecast explanation or a truthful refusal, not just three future numbers.
- One or two material cautions, placed beside the claim they qualify. Severe sparse-data caveats appear near the initial conclusion.
- Short paragraphs; zero–two relevant actions, no forced lists. No repeated copy of the score, the same alert or the same disclaimer in multiple sections.
- Numeric precision supports reading: current score to one decimal, other numbers only when useful. Exact precision remains in evidence. No model jargon, raw keys, versions or English severity codes in visible prose.
- Every factual field, including headline and action, cites internal source pointers. Record derivation operands; preserve text escaping and treat input strings as untrusted data, never instructions.

## STEP 6 — Migrate runner/verification and render separately

The current runner contains static READ_SNAPSHOT hashes, old role payload builders, mandatory financial limitation-section coverage, exact two-page/page-index checks, raw HIGH assertions and hardcoded 18-page visual-review language. Update these coherently for the NEW product; otherwise it will either block the new templates or reinsert old text.

- Replace old payload generation/validation with human-v2 consumption/validation. Do not monkey-patch the old template into looking compliant while its technical content survives.
- Refresh reviewed template/input hashes for the new run and keep source immutability/provenance checks. Do not disable validation to bypass a changed template hash. Record actual source paths, dates and revisions.
- Retain all original technical limitations in internal audit where useful. Validate evidence for all visible claims, but no longer require every limitation source to be printed in `sections.limitations` (that section no longer exists).
- Replace fixed page-number assertions with actual count and footer checks. Aim for one page per demo; allow two only with a documented useful-content reason. No check should require an unavailable forecast or a caution to be on a nonexistent page 2.
- Replace raw model/alert-code presence checks with semantic business-warning checks. Keep identity, scores, financial arithmetic, forecast availability, path safety and PDF integrity tests.
- The previous manifest records an operator-approved natural-size policy. Keep it: no artificial minimum, no padding, maximum 2,000,000 bytes. Small clean PDFs are valid.

Render only after the nine narratives pass an editorial/evidence review, not before. Use role templates rather than recreating pages in the runner. Output under `credit-scoring/results/reports/human-v2/`; create the directory when this agent executes. Keep names `{company_id}_{role}_{YYYYMMDD}.pdf`, matching actual explicit report date/default source scoring date. For the inspected snapshot this is 20260919. There must be nine distinct company/role outputs, regardless of forecast availability. Write new narrative/audit/manifest files in the revision directory, preserving old reports and sidecars.

## STEP 7 — Verify meaning and visual quality, not just PDF syntax

For each expected file, record the real checks, not inherited PASS values:

1. Independent PDF parsing and successful rasterization; correct identity/date/current score; actual page count and footer total; correct media box; nonzero natural size within maximum.
2. Read the extracted text as a reader. Can you identify what changed, why it affects the score, why the outlook looks as it does or is unavailable, and the material caution? Does the role change the next step rather than only the heading? If not, rewrite before publishing.
3. Reject visible technical leakage: naive, MAE, regression comparisons, training/held-out terminology, rule-version/YAML strings, JSON keys/pointers, raw HIGH/MEDIUM codes, long decimal outputs, or tables disguising the old report. This restriction applies to visible text, NOT internal audit source references.
4. Validate every visible financial assertion and number against its pointers. No invented earlier final score or bank-balance history, no raw-amount claim from a normalized index, no claim of a repayment/default event without evidence.
5. Specific demo checks: COMP_0216's dominant debt-payment support and longer-horizon caution survive; negligible fee noise is not an action; December's lower score is explained by the non-continuing boost rather than falsely forecast business collapse. COMP_0874/COMP_0114 have no fabricated predictions. COMP_0114's caveat qualifies its negative reading visibly.
6. Inspect each actual page image for readable body size, whitespace, hierarchy, clipping, footer collisions, accents and overcrowding. Check that the important explanation is not dwarfed by decoration, charts or disclaimers. Do not claim visual review if only text was extracted.
7. Check all 3 × 3 outputs and cross-role consistency. A previously generated PDF in the old directory does not count as a revised output. Preserve source inputs and first-version reports.

Print `filename | pages | size | editorial check | factual check | visual check | status`, with failures/blockers explicit. Mention any two-page exceptions and why. Completion is nine readable, grounded, role-appropriate reports, not nine files that merely open successfully. If a template cannot achieve this without changes, report the defect to its owner; never fix crowding by reducing body text to microprint or removing a material warning.

## Re-execution order

PHASE 1: AGENT10_design_system — shared human-v2 design and contract

PHASE 2 (parallel): AGENT11_template_tesorero, AGENT12_template_financiero, AGENT13_template_sales — revise existing templates

PHASE 3: AGENT14_fill_and_render — reauthor narratives, migrate runner, render and inspect all nine revised reports
