# Diagnosis report in the Informe panel and TellMe as the single agent

Date: 2026-09-19. Status: approved in chat, pending spec review.

## Goal

1. The diagnosis stops being a chat mode. Opening a company shows its diagnosis report directly in the **Informe** panel, written in natural language for the selected role, in the `human-v2` format of PR #28 (HSP-59).
2. The chat becomes one agent, **TellMe**. Evaluating a new commitment becomes one of its tools; the capability switch disappears.

## Non-goals

- Running PR #28's Python/ReportLab templates inside the Worker (they cannot run there and depend on PR #17).
- A forecast engine. The X Ray pipeline has no projection; the outlook is conditional prose or an explicit "not enough basis".
- Authentication. The role tab stands in for the authenticated user's role.
- Reservation, payment, credit or signature tools.

## Part A: human-v2 diagnosis report

### Contract (`packages/shared`)

A `humanReportSchema` mirroring PR #28's shared envelope:

| Field | Type | Rule |
|---|---|---|
| `schema_version` | literal `human-v2` | |
| `role` | `tesorero` \| `financiero` \| `ventas` | Role tab; maps to PR #28's `sales` for ventas |
| `company_id`, `month` | string | |
| `score` | number \| null | Shown once, as the visual anchor |
| `state_label` | string | Short status phrase next to the score |
| `headline` | string | One company-specific conclusion, about 8–14 words |
| `summary` | string | One or two sentences |
| `score_explanation` | string | One or two short paragraphs |
| `outlook` | string | Conditional direction, or why there is no basis |
| `caveat` | string | May be empty; hidden when empty |
| `next_steps` | string[] | Zero to two items; hidden when empty |
| `source` | `llm` \| `template` | Internal; not rendered |
| `export_url` | string | PDF link |

`reportSchema` is replaced by this contract on `/companies/:id/report`. The `decision` section from a commitment simulation stays a separate `ReportSection` appended by the web panel.

### Headings and word budget per role

| Role | `score_explanation` | `outlook` | `caveat` | `next_steps` | Words |
|---|---|---|---|---|---|
| tesorero | Qué ha cambiado | Qué podemos esperar | (note beside the conclusion) | Qué conviene revisar | 220–300 |
| financiero | Por qué tiene esta puntuación | Cómo interpretar los próximos meses | Hasta dónde llega esta lectura | Qué comprobar antes de decidir | 260–350 |
| ventas | Qué explica su situación | Qué podemos esperar | (note beside the conclusion) | Cómo abordar la conversación | 180–260 |

The ranges are ceilings, not quotas: the validator rejects above the upper bound only.

### Generation (`apps/agent/src/xray/report.ts`, `report-policy.ts`)

- Sources: the existing `reportSources` plus `explain(...).diagnosis`, with each amount pre-formatted in Spanish (for example `181.356 €`) and the comparison periods as month names.
- The LLM writes the envelope through structured output with role-specific instructions taken from AGENT11–13: name the one or two dominant dimensions and their consequence; hypotheses, never demonstrated causes; no solvency, credit, default or fraud claims; ventas never pitches or uses internal risk language; sparse data or low confidence puts the warning beside the conclusion.
- Validator, all of which must pass or the template fallback is used:
  - schema and role match;
  - word count within the role ceiling; at most two `next_steps`;
  - forbidden vocabulary absent (case-insensitive, whole words): `momentum`, `driver`, `contribución`, `puntos`, `regla`, `rule_version`, `confianza`, `held-out`, `modelo`, alert codes `E1`–`E4` and the component codes (`balance`, `fees`, `refunds`, `inflow_vs_prev6`, `debt_repayment_break`, `withdrawals`);
  - every number in the prose appears in the sources after normalising Spanish formatting, apart from months and years.
- The deterministic template builds the same envelope from `explain` and `diagnosis` (headline from state and dominant finding, explanation from the top two findings' observed text, outlook from trajectory state, caveat from the first limitation, next steps from the findings' actions). It never fails and is used when the model errors, times out or fails validation.
- Caching: the D1 `reports` table is keyed by company, month, role and rule version. A new migration clears it and the PDF cache, because stored bodies use the old schema; a cached body that fails the new schema is treated as a miss. Only `source: "llm"` reports are cached, so a transient model failure does not pin the template.

### Web (`ReportPanel.vue`, `Radiography.vue`)

- ReportPanel renders the compact header (score once, state phrase, headline, summary), the role's section headings, the caveat as a calm note, and the next steps list; empty caveat or steps render nothing. "Exportar PDF" stays.
- The diagnosis block added to Radiography is removed; Radiography keeps score, series, drivers and changes.

### PDF (`report-html.ts`, `report-pdf.ts`)

One-page HTML following AGENT10's layout: header with company, date and role; score once; headline and summary; the role's sections; caveat note; steps; footer with confidentiality and "Índice orientativo de salud de tesorería; no constituye una evaluación crediticia." The index, quantitative annex and methodology pages are removed. Browser Rendering prints it as today.

## Part B: TellMe with commitment tools

### Agent (`apps/agent/src/xray/chat.ts`)

- One chat for every request; `capability` is removed from `chatRequestSchema`. `confirmed_commitment` stays optional and requires `company_id`.
- System prompt names the agent TellMe and adds: to evaluate an operation, call `draft_commitment` with what the user stated; never guess missing fields; only call `simulate_commitment` when a confirmed operation is present, with it unchanged; lead the explanation with which alternative keeps the reserve floor and the minimum cash.
- `draft_commitment`: input is a partial opportunity (`title`, `revenue_minor`, dates, `permitted_advance_bps`, `costs`, `horizon_months`, `reserve_floor_minor`), all optional; output echoes the draft plus the list of missing fields. No calculation.
- `simulate_commitment`: registered only when the request carries `confirmed_commitment`; executes Devin's guard (same company, byte-identical request) and returns the deterministic evaluation; a mismatch returns the existing refusal.
- `commitment-chat.ts` is deleted; its guard moves into `chat.ts`. MCP's `simulate_commitment` is unchanged; `draft_commitment` is chat-only.
- The deterministic `report_section` body for a commitment leads with the outcome: which advance option is compatible (or none) and the minimum cash in euros, then the assumptions list.

### Web

- `App.vue`: the capability switch is removed. Center column: Radiography, then CommitmentPanel only while a draft or result exists (with a close button), then ReportPanel.
- `ChatPanel.vue`: title "TellMe · X Ray"; handles `tool-draft_commitment` by emitting `draft`; `tool-simulate_commitment` keeps emitting `commitment`. Suggestions per role add one commitment example.
- `CommitmentPanel.vue`: accepts an optional `draft` prop that pre-fills the form; missing fields stay empty and block confirmation. On confirm it evaluates through the REST route as today and App sends TellMe a message ("He confirmado la operación") carrying `confirmed_commitment`, so TellMe explains the result.

## Error handling

- Report: model error, timeout or validation failure falls back to the template; the web panel never shows an empty report.
- Draft with missing fields: the form shows them empty and cannot be confirmed.
- Simulation requested without confirmation or with altered data: refusal text, no evaluation.

## Testing

- Shared: human-v2 schema accepts both role shapes and rejects more than two steps.
- Agent: validator rejects jargon, over-budget text and unsourced numbers; fallback used on model failure; `/report` returns human-v2 for each role; `draft_commitment` never evaluates; `simulate_commitment` absent without confirmation and blocked on mismatch; the commitment section leads with the outcome.
- Web: no capability switch; draft opens a pre-filled form; ReportPanel shows each role's headings and hides empty caveat/steps; PDF HTML has no annex or methodology headings.
- End-to-end on the Embat CSVs: `/report` for COMP_0391 and COMP_0176 in the three roles, the PDF route, and a TellMe conversation drafting, confirming and explaining an operation (gpt-oss-120b on the free account, DeepSeek where the paid plan is available).

## Order

Part A, then Part B; each leaves `bun run verify` green.
