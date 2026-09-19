# AGENT12 — Revision 2: Financiero, explain the score without exposing the model

## Replacement brief and assignment

This replaces the earlier analyst/technical-audit specification. The Financiero wants to understand and explain the company's score, not inspect regression, naive methods, MAE, hyperparameters or scoring code. More financial interpretation does NOT mean more model documentation.

- Model: `claude-opus-5`, or an explicitly approved substitute.
- Root: `credit-scoring/`.
- PHASE 2, AFTER AGENT10's human-v2 contract/style gate; parallel with AGENT11 and AGENT13.
- Revise `templates/template_financiero.py` and `tests/test_template_financiero.py`. Read their existing implementation and AGENT10's revised brief first. Other modules, runner, financial engine/config and source artifacts are read-only.
- Do not launch agents, call paid APIs, commit/push, or publish final reports. AGENT14 owns final narrative authoring and rendering.

## Reader and main question

`¿Por qué tenemos esta puntuación, qué parte de la evolución es favorable o preocupante y qué conclusiones puedo defender con los datos disponibles?`

Use human financial language and concise reasoning. Name the concrete dimensions responsible, distinguish recent change from current strength/weakness, and explain any contradiction between observed improvement and a lower projected score. A formula with more decimals is not a substitute for that explanation.

Reuse the existing validated loader and source-pair policy. Preserve `render_report(data, narrative, output_path, report_date=None)` and compatible aliases. Require the common `human-v2` envelope, role `financiero`, and sections `headline`, `summary`, `score_explanation`, `outlook`, `caveat`, `next_steps`. Traceability stays in `evidence`/the audit sidecar, not in a new PDF appendix.

## One-page layout and editorial budget

Aim for approximately 260–350 words, fewer if sufficient. This is a narrative page with a few useful figures, not a dashboard. Respect AGENT10's readable body font and spacing.

1. **Current reading**: compact company/date/FINANCIERO header, one current score display, headline and brief summary. Do not show separate base, adjustment and final KPI blocks by default.
2. **Por qué tiene esta puntuación**: `score_explanation`, normally two short paragraphs:
   - What in the actual observed comparison improved or deteriorated; identify the dominant one or two drivers and their effect on the rating.
   - What materially limits or supports the CURRENT level and whether the trend has corroborating evidence. A dimension can have improved but still be weak. A material opposing longer-horizon signal must qualify an otherwise optimistic conclusion.
   - Mention the comparison dates once in natural Spanish, not three tables of windows.
3. **Cómo interpretar los próximos meses**: `outlook`. Explain expected direction and its supporting component/score-mechanism evidence, not just an endpoint. If the projected decline is largely the loss of today's improvement boost, say so in normal language. If component conditions really deteriorate in the scenario, identify the supported dimensions. If the source cannot distinguish those causes, acknowledge that instead of inventing one.
4. **Hasta dónde llega esta lectura**: `caveat`, the one or two substantive constraints needed to interpret this company's results. Connect each to a consequence. Technical limitations that do not alter the reader's conclusion stay in the audit, not the PDF.
5. **Qué comprobar antes de decidir**: zero to two `next_steps`, directed at explaining the dominant change or resolving the material uncertainty. No generic checklist.
6. **Footer**: shared confidentiality and brief treasury-index disclosure, with actual page count.

No tables by default. No obligatory chart. If a simple graphic genuinely helps explain the outlook, use one small main-scenario chart only when it does not crowd the narrative. Do not append a second page to preserve old traceability tables; one page is the target, two only when necessary for useful explanation at normal type size.

## Explicitly remove from the reader-facing PDF

The following old sections are no longer acceptance requirements and must not be rendered by either the template or injected narrative:

- Component weights/contribution matrices and four-decimal changes.
- Base/adjustment arithmetic tables, alert thresholds and raw severity/type codes.
- Training, held-out period, model-method, MAE, naive/regression and winner tables.
- Forecast clipping, historical standard deviations, ddof and configuration parameters.
- Rule-version/versioning paragraphs and full data-exclusion inventories.
- Exhaustive limitation catalogues, repeated conditional scenario caveats and internal source pointers.

Do not merely hide these in 8 pt footnotes or compress them into a giant paragraph. Retain the technical source data and any complete limitation accounting in an internal audit JSON managed by AGENT14. The visible PDF is intentionally selective, while its assertions remain fully traceable.

## Explaining the score correctly

Use `component_summary` to understand current level, `signals.change` and appropriate weights to understand movements, and `signals.contribution` for their share of the applied trend adjustment. Do not rank change by base contribution alone. When the adjustment is zero, there may still be important underlying movements; do not call everything unchanged just because all applied contributions are zero.

Current `base_score` is not the previous final score. A sentence such as `Ha pasado de 67.4 a 77.4` is false unless two dated observed snapshots prove that transition. Prefer `La mejora reciente refuerza la puntuación actual` with its concrete supporting drivers. Only show an exact past-score change if actual historical final-score evidence exists; otherwise explain the observed direction without inventing a numeric before/after.

Use the business meaning supported by the normalized data, not a fictional cause. `La relación entre entradas y salidas es menos favorable` does not mean `los clientes están pagando tarde`. Relative fee/debt-payment measures are not absolute euro movements or debt principal. Do not invert clipped/averaged indices into made-up raw ratios.

## Forecast realism, in normal language

- Read the actual per-month `score_details` and component summaries, not just the scenario score array. Distinguish changing financial dimensions from an expiring/non-continuing trend adjustment. Inspect this internally; print its understandable implication, not the derivation table.
- For COMP_0216, the observed base is 67.4 with a +10.0 trend adjustment, while the terminal base scenario is 67.4 with no such adjustment. Component levels are broadly similar. The useful explanation is that the lower future score largely reflects no longer rewarding a fresh improvement, not that the forecast necessarily expects worsening underlying activity. Do not claim exact unrounded component equality or describe the non-monotonic forecast as a steady decline.
- Short history: explain that recent movements may not represent a stable pattern. Sparse activity: explain that the company may not be well represented by the observations. Do not label a forecast mathematically impossible simply because confidence is limited.
- If a limitation says seasonality is not accounted for, describe the implication (`No sabemos si este comportamiento se repite en otros momentos del año`) when relevant, not an invented seasonal explanation of the movement.
- COMP_0874 and COMP_0114 have genuine forecast refusals, not forecasts to discount. State that the history is insufficient; do not add placeholder model rows or an empty chart.

## Specific regression cases

- COMP_0216: emphasize the debt-payment measure as the main recent support, preserve the longer-view caution, omit negligible fee noise, and explain the projected loss of the current trend boost.
- COMP_0874: explain weaker incoming/outgoing money balance and less favorable returns behavior. A confirmed negative signal does not establish its business cause. No prediction is available from eleven eligible months when twelve are required.
- COMP_0114: include the negative incoming/outgoing money and fee signals, but attach the sparse-data warning to the conclusion itself. Zero complete months is not zero history; the 19 transactions belong to the compared evidence window, not necessarily the entire lifetime. No projection from seven eligible months.

Re-read the artifacts; these are regression expectations, not production branches by company ID.

## Verification and handoff

Replace tests that enforce the old spreadsheet/report structure, two pages or every limitation printed. Keep strong source-validation tests and distinguish base attribution from adjustment attribution internally. Assert that every visible conclusion is supported, the main driver and forecast mechanism are understandable, uncertainty is specific, and there is no invented historical score series.

Editorial checks must reject model jargon and technical tables in extracted PDF text, but must NOT reject internal audit evidence for containing those source fields. Verify readable one-page target, correct optional second-page handling, true footer total, accents, wrapping and no crowding. A nontechnical business reader must be able to explain the principal reason for the score after reading it; a parser PASS alone is insufficient.

Use temporary grounded fixtures/renders only. Hand off the revised module/API, tests, preview and unresolved blockers to AGENT14. Do not generate the nine final reports yourself.
