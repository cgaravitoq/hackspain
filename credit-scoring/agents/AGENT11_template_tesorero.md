# AGENT11 — Revision 2: Tesorero, explain what changed and what to watch

## Replacement brief and assignment

The user wants an understandable explanation, not the old two-page dashboard. This document REPLACES the former mandatory KPI row, large duplicate gauge, signal bars, alert-code list and scenario page. A single clear page is preferable.

- Model: `claude-opus-5`, or an explicitly approved substitute.
- Root: `credit-scoring/`.
- PHASE 2, AFTER AGENT10 freezes the human-v2 shared design/schema; parallel with AGENT12 and AGENT13.
- Revise existing `templates/template_tesorero.py` and its `tests/test_template_tesorero.py` only. Read the current implementation/tests and AGENT10's revised instructions first. Shared files, other templates, runner, input JSONs and financial rules are read-only.
- No agent launches, paid APIs, commits, pushes or final report publication. AGENT14 rewrites the nine narratives and renders after all template gates.

## Reader and main question

The Tesorero asks: `¿Qué está pasando con la tesorería, qué explica esta puntuación y qué merece mi atención ahora?`

Use direct, approachable Spanish about incoming/outgoing money, returns, bank fees and debt payments only to the extent supported by the actual data. Connect observed movement to the current score, then to a useful check. Never promise cash availability, claim customer late payments, or invent a repayment event from a component score.

Use AGENT10's validated data root/pair policy and new shared `human-v2` envelope. Preserve `render_report(data, narrative, output_path, report_date=None)` and compatible existing aliases. The required sections are `headline`, `summary`, `score_explanation`, `outlook`, `caveat`, `next_steps`. Narrative role must be `tesorero`. Do not require or inject old technical narrative fields.

## One-page editorial layout

Target roughly 220–300 words of user-facing prose, not a minimum to fill. Use fewer words when evidence is limited. Shared body typography and whitespace take priority over fitting extra metrics.

1. **Compact header and score**: company, source date, role TESORERO, `Salud de tesorería`, current score once as the visual anchor. Show the company-specific headline and brief summary beside/below it. A separate giant gauge or extra confidence KPI is unnecessary.
2. **Qué ha cambiado**: `score_explanation`, one or two short paragraphs. Name the actual recent and comparison periods naturally, such as `entre junio y agosto, frente a los tres meses anteriores` only when those months really match. Explain the dominant one or two dimensions and how they lift/weigh on the score. Include a significant longer-horizon counter-signal when it changes the reading.
3. **Qué podemos esperar**: `outlook`, a short conditional explanation of the coming months and what supports it. A forecast endpoint is optional if it adds clarity. No three-scenario numerical recital. By default use prose without a chart.
4. **Qué conviene revisar**: zero to two supplied `next_steps`. Specific evidence-backed checks, not generic advice. An action can say `Revisar qué movimientos explican la peor relación entre entradas y salidas`; it cannot assert the cause before that review. No action is needed for every tiny negative signal.
5. **Caution near the affected claim**: show `caveat` as a calm, visible one- or two-sentence note, not a technical limitations box. For very sparse data, put the warning beside the initial conclusion, not only in the footer.
6. **Footer**: shared confidentiality text, brief index-not-credit-evaluation disclosure and correct actual page total.

A second page is allowed only if materially useful content cannot fit at normal reading size. Never pad an unavailable-forecast case to two pages. No tables, normalized-point bars, raw alert badges, configuration versions, training or method terms, or dense exclusions inventory in the PDF.

## What the prose must and must not mean

- A deterioration in the balance of inflows/outflows may mean less favorable money-in versus money-out behavior; without raw amounts it does NOT establish that income fell, expenses rose, or cash is about to run out.
- Debt-related improvement is a more favorable debt-payment measure; do not claim total debt shrank or debt was repaid in full.
- Explain that a repeated improvement supports today's score, but do not label the current `trajectory_adjustment` as a historical score rise. Current base and current final are not two dates.
- Translate drift as `La mejora reciente todavía no compensa la debilidad que se observa al mirar un periodo más largo`, when supported. Do not print `DRIFT_DETECTED`, MEDIUM or threshold arithmetic.
- Important active alerts must be reflected in ordinary language; an alert-code panel is not required. An empty alert list does not justify `No hay riesgo`.
- For a valid unavailable forecast, say why there is not enough history; one useful count pair is enough. Do not repeat available/required/missing counts in three panels or forecast a date on which new data will arrive.
- Explain consequential unreliability honestly: `La actividad registrada es demasiado escasa para tomar esta lectura como una imagen completa de la empresa`. Do not downgrade a real warning to reassurance, or turn 0% complete-month coverage into a claim that there are no data at all.

## Demo narratives: required meaning, not strings to hardcode

Re-read the current coherent v2 artifacts. Production behavior must depend on data, not company-ID branches.

- **COMP_0216, 77.4**: improvement is driven mainly by the debt-payment dimension, with smaller support from the inflow/outflow relationship. The longer view still shows weakness. Do not elevate its negligible fee movement into a watch item. At the base forecast's final month, the current positive trend boost is absent while the underlying component level is broadly similar: explain why a lower projected score does not by itself predict a collapse in activity. Preserve that distinction in human wording, not an equation.
- **COMP_0874, 62.0**: the incoming/outgoing money relationship is less favorable and returns also weigh on the reading. The observed deterioration is corroborated, but the exact business cause is not known. No forecast: 11 months of eligible history versus 12 required. Suggest checking the movements behind the cash-flow relationship before assuming a cause.
- **COMP_0114, 56.7**: the available data show a weaker inflow/outflow relationship and worse fee-related behavior. Qualify that conclusion immediately: activity is sparse (19 transactions in the compared evidence window; none of its seven observed months meets the system's completeness criterion). It is not a firm diagnosis of the whole company. No forecast: seven eligible months versus twelve required. Prioritize completing/reviewing evidence rather than confident cash predictions.

AGENT14 may use shorter wording than these notes. Every fact still requires internal source pointers; no pointers or excess decimal precision appear in the report.

## Verification and handoff

Revise old tests that demanded two pages, technical bars or exact raw-alert strings; those presentation requirements are superseded. Keep data correctness and validation tests. Test the human-v2 schema, identity checks, one-page target, accurate flexible footer, no duplicated current score hero, readable wrapping, and absence of the old technical sections.

Test that the large driver is explained, small fee noise is not promoted, important drift/deterioration is not hidden, no past final score is invented, and unavailable forecasts remain absent rather than flat/zero curves. Sparse-data warnings must appear beside the conclusion. A report that only says `mejora/empeora` without a dimension and consequence fails editorial review.

Use grounded temporary narrative fixtures and temporary renders, not final files. Hand off module/API, revised tests, a preview showing the new reading hierarchy, and any blockers to AGENT14 after the shared gate and your own checks pass.
