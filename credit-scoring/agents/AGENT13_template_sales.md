# AGENT13 — Revision 2: Sales, a clear company story before a conversation

## Replacement brief and assignment

Replace the old two-page commercial dashboard with a concise explanation of this company's score and outlook, adapted to an Embat Sales reader. A three-color panel is not a substitute for explaining why the business looks stronger or weaker.

- Model: `claude-sonnet-5`, or an explicitly approved substitute.
- Root: `credit-scoring/`.
- PHASE 2, AFTER AGENT10 freezes human-v2 styles/schema; parallel with AGENT11 and AGENT12.
- Revise existing `templates/template_sales.py` and `tests/test_template_sales.py` only. Read their implementation and the revised AGENT10 brief before editing. Shared modules, runner, other templates, financial rules and source artifacts are read-only.
- No agent launches, paid API calls, commits/pushes or final report publication. AGENT14 writes final narratives and renders.

## Reader and purpose

`¿Qué le está pasando a esta empresa, por qué tiene ese score y qué debería tener presente antes de hablar con ella?`

Use accessible commercial language, not a sales pitch detached from the evidence. Explain one or two underlying business dimensions before making an interaction recommendation. No invented product fit, purchase intent, portfolio ranking, customer sector, guaranteed upsell or creditworthiness claim.

Preserve the existing validated data loading and `render_report(data, narrative, output_path, report_date=None)` interface, with compatible aliases. Require role `sales` and the common `human-v2` sections: `headline`, `summary`, `score_explanation`, `outlook`, `caveat`, `next_steps`. Keep evidence internal. The former `summary_lines`, signal-column and recommendation-text schema is superseded; do not convert old technical prose and call it a new narrative.

## One-page layout

Target about 180–260 words, not a quota. Fewer is better when the key story is complete.

1. **Ficha de empresa**: company/date and `SALES · USO INTERNO EMBAT`; one current score display. A descriptive headline, not merely `OPORTUNIDAD VERDE`.
2. **Qué explica su situación**: summary plus `score_explanation`, a compact narrative about the dominant positive/negative movements and their effect on the score. No obligatory positive and negative columns; do not invent a positive point to balance a negative company.
3. **Qué podemos esperar**: short `outlook`, giving the supported future direction, why it differs from current improvement/deterioration if relevant, or why forecasting is unavailable. Prose normally replaces the chart.
4. **Cómo abordar la conversación**: zero to two supplied `next_steps`, framed as evidence-backed review/conversation guidance, not investment or lending advice. A short restrained callout can express commercial disposition, but must not dominate the company explanation.
5. **Important qualifier**: place `caveat` next to the conclusion it qualifies, especially for sparse data or a positive recent direction that contrasts with the longer view/outlook.
6. **Footer**: confidentiality, actual page total and `Índice orientativo de salud de tesorería; no constituye una evaluación crediticia.`

Remove the three traffic-light boxes, duplicate score/gauge/support strip, automatic HIGH-only alert panel and mandatory forecast chart. Communicate material alerts in plain sentences. Do not hide an important MEDIUM drift warning just because it was excluded from the old HIGH-only panel. Never say no commercial risk merely because no HIGH alert was emitted.

Use shared readable typography and whitespace. No tables, raw alert codes, model vocabulary, configuration versions, confidence percentages, four-decimal point contributions or technical appendix. One page by default; two only if necessary for useful content, never to preserve the old structure.

## Commercial disposition: keep policy separate from explanation

If retaining a commercial-disposition label/helper, preserve the existing requested deterministic rule rather than letting the LLM redefine business policy:

- RED first: score <45 OR confirmed deterioration OR an active HIGH DETERIORATION_CONFIRMED/SCORE_FLOOR alert.
- GREEN: score >65, observed trajectory improving/stable, confirmed persistence, no HIGH alerts, and no RED condition.
- AMBER: other valid cases. Missing required inputs never qualify as GREEN.

The formula belongs in code/tests/audit, NOT the PDF. You may render the conclusion as a natural sentence rather than the old uppercase slogan. A GREEN rule result does not justify calling the outlook positive or the company risk-free. Explain reservations visibly and do not add an unrequested score/forecast threshold. If displaying a green badge would misleadingly overpower the caveat, omit the badge and use qualified prose while recording the original class internally.

Do not invent `Revisar en X meses`; prefer reviewing when new information is available. `months_missing` is an evidence gap, not a promise of future data arrival.

## Role-specific explanation standards

- Name the concrete dimension: incoming/outgoing money balance, debt-payment behavior, returns or fees. Avoid empty phrases such as `sus indicadores son buenos` or `se observa una evolución positiva` without a reason.
- Do not claim the historical score rose/fell by the current trajectory adjustment. Without a previous dated final score, describe observed improvement/deterioration and why it supports today's score.
- A changing normalized measure does not prove revenue growth, customer nonpayment, a loan payoff or changed absolute debt. Stay with the supported relationship in ordinary words.
- Explain the difference between the current business story and a score-mechanism effect in the forecast. For COMP_0216 a lower terminal score mainly reflects no longer adding the current improvement boost; do not turn that into a claim that the company is heading into distress.
- Scarce records justify a cautious conversation and gathering context, not a confident diagnosis or a product pitch. A forecast refusal is information, not an empty chart to fill.

## Expected demo meaning — validate against current artifacts

- **COMP_0216**: debt-payment behavior is the principal support for recent improvement, with a longer-view caution. Existing commercial policy classifies it GREEN, but the base projection ends lower; explain both without a contradictory positive-forecast pitch. A suitable conversation focuses on understanding whether the recent improvement can be maintained, not on a presumed financing need.
- **COMP_0874**: incoming/outgoing money balance and returns weigh on the reading. Confirmed deterioration leads to a cautious approach before a proposal. There is insufficient history for a forecast (11 of 12 eligible months).
- **COMP_0114**: negative inflow/outflow and fee-related signals exist, but the recorded activity is too sparse for a complete picture. Acknowledge the negative flag without selling it as certainty. There is no forecast from seven eligible months. The useful next step is clarifying the available information, not assuming distress or an upsell opportunity.

These are meaning checks, never a license to hardcode narrative branches by company ID. The nine final narratives come from AGENT14 using real data and internal evidence pointers.

## Verification and handoff

Revise presentation tests that demanded the old traffic lights, exact two pages, raw HIGH labels or `summary_lines`. Keep policy-boundary and precedence tests if the disposition helper remains, including 45/65 boundaries and unknown-data behavior. Never change input-validation/security tests to make the layout pass.

Check the human-v2 payload, clear dominant driver, material caveat, honest forecast explanation/refusal, no invented before/after scores, no model jargon or redundant technical blocks in the extracted PDF. Check actual page totals, readable text, accents and absence of clipping. Confirm Sales differs in recommended next step and tone from Tesorero/Financiero, not merely in header text.

Use temporary grounded fixtures/renders, not final reports. Hand off module/API, tests, a preview and blockers. AGENT14 starts only after all three role gates pass.
