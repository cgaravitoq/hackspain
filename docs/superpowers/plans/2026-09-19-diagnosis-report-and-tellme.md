# Diagnosis report and TellMe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Informe panel shows a role-specific, natural-language diagnosis report in PR #28's `human-v2` format, and the chat becomes one agent (TellMe) whose commitment evaluation is a draft-then-confirm tool pair.

**Architecture:** `reportSchema` in `@hackspain/shared` is replaced by the `human-v2` envelope. The agent builds it with the LLM under a validator (budget, forbidden vocabulary, sourced numbers) and falls back to a deterministic template built from `explain` and `diagnosis`. The PDF becomes one page rendered from the same envelope. The chat merges `commitment-chat.ts` into `chat.ts`, adds `draft_commitment`, and registers `simulate_commitment` only for a confirmed request.

**Tech Stack:** Bun, TypeScript, Hono on Workers, Vercel AI SDK 7 with `workers-ai-provider`, D1, Zod 4, Vue 3, Vitest (workerd pool for the agent, jsdom for the web).

**Spec:** `docs/superpowers/specs/2026-09-19-diagnosis-report-and-tellme-design.md`

## Global Constraints

- `bun run verify` green after every task; Biome, oxlint anti-slop preset (`--deny-warnings`), `tsc`/`vue-tsc`.
- Tests never reach the network; the model is a `MockLanguageModelV4`.
- Code, tests and identifiers in English; user-facing copy in Spanish.
- No commits unless the user asks (AGENTS.md). Commit steps below are replaced by "leave the working tree green".
- Word ceilings: tesorero 300, financiero 350, ventas 260. At most two `next_steps`.
- Forbidden visible words (case-insensitive, whole word): `momentum`, `driver`, `contribución`, `puntos`, `regla`, `rule_version`, `confianza`, `held-out`, `modelo`, `E1`–`E4`, `balance`, `fees`, `refunds`, `inflow_vs_prev6`, `debt_repayment_break`, `withdrawals`.
- PDF footer text: `Índice orientativo de salud de tesorería; no constituye una evaluación crediticia.`

---

### Task 1: human-v2 contract in shared

**Files:**
- Modify: `packages/shared/src/xray.ts` (replace `reportSchema`), `packages/shared/src/index.ts`
- Test: `packages/shared/src/xray.test.ts` (replace the `reportSchema` block)

**Interfaces:**
- Produces: `reportSchema` with fields `schema_version: "human-v2"`, `company_id`, `month`, `role`, `rule_version`, `generated_at`, `score: number | null`, `state_label`, `headline`, `summary`, `score_explanation`, `outlook`, `caveat`, `next_steps: string[] (max 2)`, `source: "llm" | "template"`, `export_url`; `type Report`; `REPORT_HEADINGS: Record<Role, { score_explanation; outlook; caveat; next_steps }>`; `REPORT_WORD_LIMITS: Record<Role, number>`.
- `reportSectionSchema`, `ReportSection`, `reportSectionCodeSchema` stay (used by the commitment decision section).

- [ ] Replace the old `reportSchema` tests with: parses a valid tesorero report; rejects three `next_steps`; rejects an unknown role; rejects `schema_version` other than `human-v2`; accepts an empty `caveat`.
- [ ] Run `bun --filter @hackspain/shared test`, expect failures.
- [ ] Implement the schema and constants; headings copied from the spec table (tesorero caveat heading `Ten en cuenta`, ventas caveat heading `Ten en cuenta`).
- [ ] Run the shared tests, expect pass.

### Task 2: report generation, validator and template fallback

**Files:**
- Create: `apps/agent/src/xray/report-narrative.ts` (validator + template), `apps/agent/migrations/0004_reports_human_v2.sql` (`DELETE FROM reports;`)
- Modify: `apps/agent/src/xray/report.ts` (`narrate`, `loadReport`), `apps/agent/src/xray/report-policy.ts` (role instructions; drop `ROLE_SECTIONS`)
- Test: `apps/agent/src/__tests__/report-narrative.test.ts` (new), `apps/agent/src/__tests__/report.test.ts` (rewrite the `/report` block)

**Interfaces:**
- Produces `validateNarrative(narrative: Narrative, role: Role, sources: ReportSources): string[]` (list of violations, empty when valid); `templateNarrative(role: Role, sources: ReportSources): Narrative`; `type Narrative = Pick<Report, "headline" | "summary" | "score_explanation" | "outlook" | "caveat" | "next_steps">`; `loadReport(db, model, companyId, role): Promise<Report>` unchanged signature.
- Numbers rule: every numeric token in the prose (Spanish formats `181.356`, `2,77`, `7 %`, `2,77 M`) must be within 1 % (or 0.5 absolute) of a number present in the sources, after ISO months, Spanish month-years and four-digit years are removed. Ratios in sources also count ×100.

- [ ] Tests in `report-narrative.test.ts`: template passes the validator for every role on the `falling`, `healthy` and a `not_evaluable` fixture; validator flags `momentum`, flags a 301-word tesorero text, flags an invented `999.999 €`, accepts `181.356 €` when the source has `181356`, accepts `junio y agosto de 2026`; template for ventas contains no `riesgo`.
- [ ] Tests in `report.test.ts`: `/report?role=financiero` returns `schema_version: "human-v2"` with the model narrative and `source: "llm"`; a model reply containing `momentum` falls back to `source: "template"` and is not cached; a model error falls back to the template with status 200; the valid LLM report is cached (one model call for two requests).
- [ ] Run agent tests, expect failures.
- [ ] Implement; the LLM prompt passes `explanation`, `diagnosis`, formatted amounts, month names, role headings and ceilings, and retries once with the violation list.
- [ ] Run agent tests, expect pass.

### Task 3: one-page PDF and HTML

**Files:**
- Modify: `apps/agent/src/xray/report-html.ts` (rewrite `renderReportHtml(report)`; delete appendix/methodology), `apps/agent/src/xray/report-pdf.ts` (`renderReportHtml(report)` without sources), `apps/agent/src/app.ts` (`/report.html` no longer loads sources)
- Test: `apps/agent/src/__tests__/report.test.ts` (PDF block)

**Interfaces:** `renderReportHtml(report: Report): string`.

- [ ] Update PDF tests: HTML contains headline, the role headings, next steps, the footer disclosure; does not contain `Anexo`, `Metodología`, `Glosario`, `momentum`; escaping test adapted to `headline`/`summary`; PDF bytes cached once.
- [ ] Implement a single-column page: brand line, company name, month label, role label, score with state phrase, headline, summary, sections with role headings, caveat note, steps list, footer disclosure. Paragraph breaks in `score_explanation` become `<p>`. No Markdown.
- [ ] Run agent tests and `bun run verify`.

### Task 4: web Informe panel and Radiography

**Files:**
- Modify: `apps/web/src/components/ReportPanel.vue`, `apps/web/src/components/Radiography.vue` (remove diagnosis block and its styles/computeds), `apps/web/src/__tests__/fixtures.ts` (`report` fixture), `apps/web/src/__tests__/report-panel.test.ts`, delete `apps/web/src/__tests__/radiography.test.ts`
- Interfaces: ReportPanel props unchanged (`companyId`, `role`, `decisionSection?`).

- [ ] Tests: renders headline, summary, the financiero headings in order; hides the caveat block when empty and the steps block when empty; appends the decision section after the steps; loading and error states unchanged.
- [ ] Implement with `REPORT_HEADINGS[report.role]`; the decision section keeps the existing Markdown-lite `blocks()` rendering.
- [ ] Run web tests and `bun run verify`.

### Task 5: TellMe chat with draft and simulate tools

**Files:**
- Modify: `packages/shared/src/xray.ts` (`chatRequestSchema` drops `capability`), `packages/shared/src/commitment.ts` (`commitmentDraftSchema`), `apps/agent/src/xray/chat.ts`, `apps/agent/src/xray/tools.ts` (`draft_commitment` input/description), `apps/agent/src/xray/commitment.ts` (`section()` leads with the outcome figures)
- Delete: `apps/agent/src/xray/commitment-chat.ts`
- Test: `apps/agent/src/__tests__/commitment-chat.test.ts` (rewrite against the single chat), `apps/agent/src/__tests__/commitment.test.ts` (section text)

**Interfaces:**
- Produces `commitmentDraftSchema` = every `commitmentRequestSchema` field optional, opportunity fields optional, plus output `{ draft, missing: string[] }` via `draftCommitment(input): { draft: CommitmentDraft; missing: string[] }`.
- Chat tool names: `draft_commitment` (always), `simulate_commitment` (only with `confirmed_commitment`).

- [ ] Tests: without confirmation the model sees no `simulate_commitment` tool and a `draft_commitment` call returns the draft with `missing` fields and no `evaluation`; with confirmation an identical call returns the evaluation; an altered call returns the refusal; `capability` in the body is rejected by the schema (400); the decision section's first paragraph names the compatible advance and minimum cash in euros, or says none keeps the floor.
- [ ] Implement; system prompt names TellMe and the draft/confirm rule.
- [ ] Run agent and shared tests, then `bun run verify`.

### Task 6: web TellMe, draft pre-fill and confirmation hand-off

**Files:**
- Modify: `apps/web/src/App.vue` (remove capability switch; center shows CommitmentPanel while a draft or result exists), `apps/web/src/components/ChatPanel.vue` (title `TellMe · X Ray`, emits `draft`, `sendConfirmation()` exposed), `apps/web/src/components/CommitmentPanel.vue` (`draft` prop pre-fills; close button emits `closed`), tests `app.test.ts`, `chat-panel.test.ts`, `commitment-panel.test.ts`

**Interfaces:** ChatPanel emits `draft: [draft: CommitmentDraft]`, keeps `commitment`; props `companyId`, `alerts`, `role`, `confirmedCommitment`. CommitmentPanel props `companyId`, `draft?: CommitmentDraft | null`.

- [ ] Tests: App has no "Evaluar una operación" switch; a `tool-draft_commitment` output opens the pre-filled form; confirming the form sends a chat request whose body carries `confirmed_commitment`; ChatPanel title is `TellMe · X Ray`.
- [ ] Implement.
- [ ] Run web tests and `bun run verify`.

### Task 7: end-to-end on real data

- [ ] `bun --filter @hackspain/agent load -- --local` (applies migration 0004).
- [ ] With `wrangler dev` (remote AI) and vite: `/api/companies/COMP_0391/report?role=…` for the three roles and COMP_0176 tesorero; check `source`, word counts and absence of forbidden words; `/report.html` renders one page.
- [ ] Chat: draft → confirm → explanation for COMP_0176 and COMP_0391, using `@cf/openai/gpt-oss-120b` temporarily on the free account and reverting `CHAT_MODEL` afterwards.
- [ ] Record the outputs for the PR body.
