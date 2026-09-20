# Cargar datos: additive CSV uploads from the dashboard

Date: 2026-09-20. Status: approved in chat, pending spec review.

## Goal

A user of the Embat team (roles `financiero` and `ventas`) uploads new Embat CSV extracts from the dashboard. Uploads are additive: every batch is kept next to the previous ones, nothing is deleted or replaced. The screen shows the upload history and whether the loaded score already reflects the latest upload. An operator command turns the accumulated batches into the seven CSV files the pipeline reads, so the existing `uv run xray score` → `load` flow stays the only way scores are computed.

## Non-goals

- Computing scores inside the Worker. The scorer is Python (polars) and does not run in workerd; a port is out of scope.
- Row-level validation, deduplication across batches, deleting or editing batches.
- Authentication. The role of the `/app/<role>` route decides who sees the entry, as it does for the graph.
- The treasurer (`tesorero`) role: it sees one company and does not load data.

## Storage

A new R2 binding `BUCKET` in `apps/agent/wrangler.jsonc`, declared in the top-level block (`hackspain-uploads`) and again under `env.staging` (`hackspain-uploads-staging`). `worker-configuration.d.ts` is regenerated with `bun --filter @hackspain/agent types`. The account owner creates both buckets once with `wrangler r2 bucket create`.

Object layout, one prefix per batch:

```
uploads/<batch_id>/manifest.json
uploads/<batch_id>/<file>.csv
```

`batch_id` is the upload instant as `YYYYMMDDTHHmmssSSSZ` so a prefix listing is chronological without a database. `<file>` is one of the seven pipeline inputs: `companies`, `groups`, `banking_products`, `transactions`, `invoices`, `debt_products`, `balances`.

## Contract (`packages/shared/src/uploads.ts`)

| Export | Shape | Rule |
|---|---|---|
| `uploadFileSchema` | enum of the seven names | The only accepted part names |
| `UPLOAD_COLUMNS` | `Record<UploadFile, string[]>` | Columns `pipeline/src/xray/load.py`, `relations.py` and `treasury.py` read; the header must contain all of them, extra columns pass |
| `uploadBatchSchema` | `{ batch_id, uploaded_at (ISO datetime), files: [{ name, rows, bytes }] }` | `rows` excludes the header |
| `uploadsSchema` | `{ batches: UploadBatch[], scored_at: ISO datetime \| null, pending: boolean }` | `batches` newest first; `scored_at` is `meta.generated_at` or `null` when no dataset is loaded; `pending` is true when the newest batch is later than `scored_at` or `scored_at` is null and there is at least one batch |

`UPLOAD_COLUMNS`:

| File | Columns |
|---|---|
| `companies` | `company_id`, `group_id`, `currency` |
| `groups` | `group_id`, `erp` |
| `banking_products` | `product_id`, `company_id`, `type`, `currency` |
| `transactions` | `transaction_id`, `company_id`, `product_id`, `date`, `amount`, `status`, `category`, `description`, `counterparty_id` |
| `invoices` | `operation_id`, `company_id`, `document_type`, `issuance_date`, `due_date`, `payment_date`, `amount`, `pending_amount`, `status`, `concept`, `counterparty_id`, `currency` |
| `debt_products` | `product_id`, `company_id`, `type`, `bank_name`, `outstanding`, `granted`, `currency`, `created_at` |
| `balances` | `product_id`, `company_id`, `balance` |

Union of the `columns=`/`usecols=` selections in `load.py`, `relations.py` and the `DictReader` keys in `treasury.py`; a column the pipeline does not read is not required. Company names are derived by the pipeline (`names.py`), not read from a CSV.

## Routes (`apps/agent/src/app.ts`, logic in `apps/agent/src/xray/uploads.ts`)

- `POST /uploads`, `multipart/form-data`. Every part must be a file whose field name is in `uploadFileSchema`; at least one part. For each part the Worker reads the first line, splits on `,`, trims quotes, and checks every `UPLOAD_COLUMNS[name]` entry is present. Any failure answers `400 { error }` naming the file and the missing column or the unknown part name, and nothing is written. On success it writes each CSV to `uploads/<batch_id>/<name>.csv`, counts rows (newline count minus the header, ignoring a trailing newline), writes `manifest.json`, and answers `201` with the `UploadBatch`.
- `GET /uploads` lists `uploads/` with `delimiter: "/"`, reads every manifest, sorts newest first, reads `meta` from D1 and answers `Uploads`.
- `GET /uploads/:batch_id/:file` streams the stored CSV (`text/csv`), `404` when missing. Used by the operator command.

The web Worker already forwards `/api/*` to the agent, so the browser posts to `/api/uploads`.

## Operator command (`apps/agent/scripts/pull-uploads.ts`, script `pull`)

```
bun --filter @hackspain/agent pull -- --url http://localhost:8787 --out ../../pipeline/data
```

Calls `GET /uploads`, then for every batch oldest first and every file `GET /uploads/:batch_id/:file`, and appends to `<out>/<file>.csv`, writing the header once from the first batch that carries the file. Prints per file the number of batches and rows merged. The pipeline then runs unchanged: `uv run xray score --data data --out artifacts`, `uv run xray relations --data data --out artifacts`, `bun --filter @hackspain/agent load -- --local`. After `load`, `meta.generated_at` is newer than the last batch and `pending` turns false on its own.

## Web

- `App.vue`: `View` gains `"uploads"`, hash `#uploads`, guarded like the graph so `tesorero` is redirected to the radiography. The topbar title reads `Cargar datos`; the company selector is hidden on this view.
- `AppSidebar.vue`: after the `Analítica` group, one enabled entry `Cargar datos` (icon `Upload`), rendered when `role !== "tesorero"`, active when `view === "uploads"`.
- `UploadPanel.vue`:
  - A status banner: `Pendiente de recalcular: hay datos subidos el <fecha> posteriores al último cálculo (<fecha>)` when `pending`, `Score al día: calculado el <fecha> con todos los datos subidos` otherwise, `Aún no se han subido datos` with an empty history.
  - One sentence explaining additivity: `Cada subida se suma a las anteriores; nada se borra ni se sustituye.`
  - A drop zone plus `<input type="file" multiple accept=".csv">`. Each chosen file is matched to one of the seven names by filename (`transactions.csv`, `transactions-2026-09.csv` and `2026-09_transactions.csv` all map to `transactions`); unmatched files are listed with `Nombre no reconocido` and block the upload until removed.
  - `Subir` button, disabled while empty or in flight; shows `Subiendo…`, then the result (`Lote <fecha>: 3 ficheros, 12.480 filas`) or the server error verbatim.
  - History table: date, files with row counts, total bytes.
- `api.ts`: `uploads(): Promise<Uploads>` and `upload(form: FormData): Promise<UploadBatch>`; the latter is the first non-GET helper, so `api.ts` gains a small `send` for `POST` with the same error handling as `get`.

## Tests

Agent (`apps/agent/src/__tests__/uploads.test.ts`, inside workerd, R2 is local under miniflare):

- `stores a batch and lists it newest first` — two `POST /uploads`, `GET /uploads` returns both with the later one first and correct `rows`.
- `rejects a part whose name is not one of the seven files` — `400`, error names the part, bucket stays empty.
- `rejects a file whose header lacks a required column` — `400`, error names file and column, bucket stays empty.
- `reports pending when the newest batch is later than the loaded score` — with the fixture `meta`, an upload makes `pending` true; with no batches it is false.
- `serves a stored file back` — `GET /uploads/:batch_id/transactions` returns the same bytes.

Web (`apps/web/src/__tests__/upload-panel.test.ts`, jsdom, faked `fetch`):

- `maps chosen filenames to the seven inputs and flags the rest`.
- `posts the files under their input names and shows the created batch`.
- `shows the pending banner when the score predates the newest upload`.
- `app.test.ts`: `hides Cargar datos from the treasurer` and `opens the upload view from the sidebar`.

## Risks

- A large `transactions.csv` is read into memory to find the header and count rows. Acceptable for the hackathon; if it becomes a problem the header and count move to a streaming reader.
- Filename matching is by substring; a file named `invoices_and_transactions.csv` is ambiguous and is flagged as unrecognised rather than guessed.
