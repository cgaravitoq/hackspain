# Treasury Health Credit Scoring

HackSpain 2026 — Embat challenge.

A deterministic, rule-based indicator of a company's recent treasury (cash-flow) behavior,
built from its transaction history. It is designed to be fully explainable: every number in
every output can be traced back to a specific rule and a specific set of transactions.

## What this is, and what it is NOT

**It is:**
- A **treasury health index**: a 0–100 score summarizing how a company's operational
  cash flow, refund rate, fee load and debt service behaved over its last three observed
  months, plus a bounded adjustment if that behavior is trending in a confirmed direction.
- **Deterministic and rule-based**. Every weight and threshold in `src/config.yaml` is a
  declared policy choice, not something fitted or trained on this data.
- **Fully traceable**. Every score ships with the periods compared, the transaction counts
  behind it, and the exact limitations that apply to that company.

**It is NOT:**
- **Not a bureau credit score** (no FICO/Experian-style methodology, no external credit
  bureau data, no comparison against a population of loan outcomes).
- **Not a calibrated probability of default.** Nothing here was validated against actual
  repayment or default outcomes. Treat the score as a relative health indicator, not a
  statistical estimate of risk.
- **Not a proven lending decision model** and **not financial advice**. It is a hackathon
  prototype meant to demonstrate explainable scoring on real transaction data.

## Prerequisites

- Python 3.12
- Dependencies in `requirements.txt` (`pandas`, `PyYAML`)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## How to run

### 1. Score every company

```bash
python run_scoring.py --data-dir /path/to/output --output-dir ./results
```

`--data-dir` must point at the extract folder containing `transactions.csv`,
`banking_products.csv` and `debt_products.csv` (e.g.
`/home/juan/Descargas/output_hackspain_data/output`).

This writes:
- `results/scores.json` — array of every company's report (same shape as one entry
  described below).
- `results/companies/<company_id>.json` — one report per company, e.g.
  `results/companies/COMP_0001.json`.

A one-line-per-metric summary is printed to stderr: transactions read, exclusions applied,
companies scored, mean score, trajectory counts, and confirmed-persistence count.

Useful flags:
- `--company COMP_0001` (repeatable) — score only the given company id(s).
- `--limit N` — score only the first N company ids (by sorted id), useful for smoke tests.
- `--scoring-date YYYY-MM-DD` — stamp a specific reporting date on every record and use it
  as the reference point for computing the observed-months cutoff. Defaults to today.
- `--config PATH` — use a different `config.yaml`. Defaults to `src/config.yaml`.
- `--quiet` — suppress the stderr summary.

Example — score one company and inspect a historical cutoff in a separate output
directory (does not touch the all-company run):

```bash
python run_scoring.py --data-dir /path/to/output --output-dir /tmp/one_company --company COMP_0216
python run_scoring.py --data-dir /path/to/output --output-dir /tmp/as_of_july --scoring-date 2026-07-01
```

### 2. Explain one company in plain language

```bash
python explain.py --company-id COMP_0001 --results-dir ./results
```

Reads `results/companies/COMP_0001.json` (written by `run_scoring.py`) and renders a
plain-text explanation: final score, base score, the trajectory adjustment applied on top,
which signals moved and by how much, the periods compared, confidence, evidence used, and
the limitations that apply to that specific company. Use `--output PATH` to write the
report to a file instead of stdout.

### 3. Build a portfolio-wide summary

```bash
python explain_all.py --results-dir ./results
```

Reads every `results/companies/*.json` and writes
`results/summary_YYYYMMDD.txt` (date from `--generated-on`, default today): score
distribution by decile, trajectory counts, confirmed-persistence count, top/bottom 10
scores, and the list of companies whose most recent evidence is stale (from 2025).

## What each output field means (plain English)

Each `results/companies/<company_id>.json` report has:

| Field | Meaning |
|---|---|
| `company_id` | The company being scored. |
| `scoring_date` | The date stamped on this report (from `--scoring-date` or today). |
| `base_score` | 0–100 average of four component scores over the last 3 observed months. `null` if the company has no eligible EUR operational month before the cutoff. |
| `trajectory` | Whether the last 3 months look better (`improving`), worse (`deteriorating`), about the same (`stable`) than the 3 months before them, or there isn't enough history to say (`insufficient_data`, fewer than 4 observed months). |
| `persistence` | `confirmed` if the same direction also showed up one quarter earlier (so it's not a one-off blip); otherwise `unconfirmed`. Only a confirmed trend can move the score. |
| `trajectory_adjustment` | Points added to (or subtracted from) the base score because of a **confirmed** trend. Always `0.0` when persistence is `unconfirmed`, capped at ±`max_adjustment` (10 by default). |
| `final_score` | `base_score + trajectory_adjustment`, clipped to [0, 100]. This is the headline number. |
| `confidence.months_available` | How many calendar months of transaction history this company has before the cutoff. |
| `confidence.months_complete` | How many of those months had at least `complete_month` transactions (a data-richness signal only; it never changes the score). |
| `confidence.coverage_pct` | `months_complete / months_available`. |
| `confidence.currency_scope` | Always `EUR_only`: only EUR-denominated activity is scored. |
| `signals` | Per-component breakdown: how much each of the four components (inflow/outflow ratio, chargeback score, fee score, debt score) changed between the baseline and recent windows, and how many points of the trajectory adjustment it contributed. |
| `periods_compared.recent` / `.baseline` | The two 3-month windows compared to compute the trajectory: the last 3 observed months vs. the 3 months before them. |
| `evidence_records` | How many transactions fed this score, the date range they cover, and how many of this company's transactions were excluded and why (unknown product currency, non-EUR, no usable category). |
| `rule_version` | The `config.yaml` version that produced this report; see "Reproducing a result" below. |
| `limitations` | Plain-language caveats that apply to this specific company (see "Known limitations"). |

### The four score components

- **Inflow/outflow ratio** — operational money coming in vs. going out. Capped at a 2:1
  ratio so a single very cash-rich month cannot dominate the score.
- **Chargeback score** — how much of the company's activity is refunds (`collection_refund`,
  `payment_refund`). Fewer refunds is better.
- **Fee score** — how much of operational volume is eaten by bank fees. Lower is better.
- **Debt score** — how much of operational volume goes to debt repayment and interest.
  Lower is better (this measures debt service load, not creditworthiness).

Each is normalized to 0–100 per month, then averaged over the 3-month window, then combined
with the configured weights into `base_score`.

## config.yaml — what each parameter does and how to change it safely

```yaml
version: "v1.0.0"          # bump this whenever you change any policy value below

weights:                   # must sum to 1.0; how much each component counts in base_score
  inflow_outflow_ratio: 0.40
  chargeback_score: 0.25
  fee_score: 0.20
  debt_score: 0.15

thresholds:
  improving: 2.0            # delta (in score points) above which trajectory = "improving"
  deteriorating: -2.0        # delta below which trajectory = "deteriorating" (must be negative)
  complete_month: 10         # min. transactions for a month to count as "complete" (confidence only)
  max_adjustment: 10          # cap on |trajectory_adjustment|, must be in (0, 10]

categories:                 # documentation of which raw categories feed which component
  ...
```

Rules for changing it safely:
- **Always bump `version`** when you change a value; every report records the version that
  produced it, so old and new reports stay distinguishable.
- `weights` must sum to 1.0 and be non-negative — `load_config` raises `ValueError`
  otherwise, so a bad edit fails immediately instead of silently producing wrong scores.
- `improving` must stay positive and `deteriorating` negative; `max_adjustment` must stay in
  `(0, 10]`; `complete_month` must stay ≥ 1. These are enforced at load time.
- Changing `categories` changes what counts as "operational" activity, which changes
  `base_score` for every company — treat it as a scoring-policy change, not a cosmetic one,
  and re-run the full batch afterward.
- None of these numbers were fitted to this dataset. They're declared policy choices
  documented inline in `config.yaml`; changing them is a policy decision, not a bug fix.

## Known limitations

These are disclosed per-company in each report's `limitations` field, and apply
system-wide:

1. **`transfer` category is excluded.** The extract does not distinguish internal transfers
   from external ones, so counting a transfer as revenue could inflate the inflow side. All
   transfers are dropped rather than guessed at.
2. **24.87% of system-wide transactions have no usable category** (`"-"` or empty), and are
   excluded from every component. They still count as data quality evidence
   (`no_category_system` in the run summary) but do not affect any score.
3. **The "complete month" threshold (10 transactions) is a declared convention, not a
   validated one.** The audit found no verified ground-truth complete company-month to
   calibrate it against. It only feeds `confidence.coverage_pct`; it never changes the score.
4. **28 companies have no 2026 evidence at all** — their most recent observed month is from
   2025. Their score describes stale historical activity, not current health. These are
   listed by name in `results/summary_YYYYMMDD.txt` under "OBSOLESCENCE".
5. **Persistence windows are not independent samples.** Confirming a trend repeats the same
   comparison one quarter back, but the two 3-month windows share their middle quarter (the
   "recent" window of the earlier comparison overlaps the "baseline" window of the later
   one). A confirmed trend is corroborating evidence, not two statistically independent
   observations.
6. **Settlement and investment categories count as observed evidence but feed no component**
   — the audit could not establish whether they are operational or already the cash leg of
   a booked collection, so they are conservatively excluded from every score.
7. **No FX conversion.** Only EUR-denominated activity (by product currency) is scored;
   non-EUR activity is excluded entirely, not converted.
8. **The trailing partial calendar month is dropped, not scored as a short month.** The
   extract ends mid-month; that stub is excluded from the "observed months" used for scoring
   so it cannot outweigh a full month.
9. **Seasonal months are flagged, not adjusted.** August and December are known lower-activity
   months in this population; a deterioration that lands on them is disclosed in
   `limitations` but the score is not seasonally corrected.

## Null vs. zero

A company-month with **no observed transactions never appears** in the underlying feature
table — it is not written as a row of zeros. A company-month with observed transactions that
happen to net to zero (e.g. equal inflow and outflow) **is kept as a genuine zero**. This
distinction matters because a missing month is a data gap, while an observed zero is a real
result; the two are never confused in the scoring pipeline (`src/data_pipeline.py`).

## Reproducing a result

Every report records `rule_version`. To reproduce a report exactly:
1. Check out the `config.yaml` matching that `rule_version`.
2. Run `run_scoring.py` with the same `--data-dir`, `--scoring-date`, and `--config`.
3. Two runs with identical inputs, config and scoring date produce identical output —
   scoring has no randomness or hidden state.

## Errors

- Unknown data directory / missing CSVs: the run fails with a Python traceback pointing at
  the missing file; there is no silent partial run.
- A company with no eligible EUR operational month before the cutoff is still included in
  the output, with `base_score`/`final_score` set to `null`, `trajectory` set to
  `"insufficient_data"`, and a limitation explaining why. It is never silently dropped.

## Demo cases

Three worked examples, generated with `explain.py`, live under
[`results/demo/`](results/demo/):

- **`COMP_0216_explained.txt`** — clearest improving case with a **confirmed** trend: base
  score 67.4, trajectory adjustment +10.0 (capped), final score 77.4. The debt score
  improved 64.7 points and repeated the same direction one quarter earlier.
- **`COMP_0874_explained.txt`** — clearest deteriorating case with a **confirmed** trend:
  base score 72.0, trajectory adjustment -10.0 (capped), final score 62.0, driven mainly by
  a 29.9-point drop in the inflow/outflow ratio. Flagged as touching a seasonal month
  (August).
- **`COMP_0611_explained.txt`** — `insufficient_data` case: only 2 observed months, so no
  trajectory can be computed (4 months are required). The base score (99.9) is still
  reported from those 2 months, but no trend or adjustment is possible.

## Validation

Run the test suite (35 tests, no network access, runs inside the repo's own fixtures):

```bash
python -m pytest tests/ -q
```

To re-validate against the real extract end to end:

```bash
python run_scoring.py --data-dir /path/to/output --output-dir ./results
python explain_all.py --results-dir ./results
```

Then confirm: every `final_score` is `null` or in `[0, 100]`; every
`trajectory_adjustment` has `abs(value) <= 10`; `trajectory_adjustment` is `0.0` whenever
`persistence` is `unconfirmed`; and no company-month in the underlying feature table has
`total_transactions == 0` (an unobserved month is absent, not zero).
