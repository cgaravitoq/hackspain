# Data audit — AGENT1, PHASE 1

Audit date: 2026-09-19. Scope: the complete, read-only source directory `/home/juan/Descargas/output_hackspain_data/output/`. Required handoff artifact: `/home/juan/hackspain/credit-scoring/audit/data_audit.md`.

This is an audit, not a scoring engine, research report, CLI, or traceability implementation. The source dictionary describes synthetic entities; no personal banking narratives or unrelated raw records are reproduced here. All counts derive from complete CSV scans, not samples. Proposed policies are explicitly separated from observed facts.

## Executive findings and handoff

- Nine files: eight CSV tables and one Markdown dictionary; all readable. No nested directories, hidden entries, links, archives, databases, workbooks, or other containers were discovered by the filesystem inventory API.
- 1,286 companies, 250 groups, 2,556,437 transactions, and 897,894 invoice/document records. All dictionary table row counts reconcile exactly. CSV logical records, not physical text lines, are counted.
- Booking history is 2024-09-01 through 2026-09-01 inclusive: 25 observed calendar labels, of which September 2026 is a one-day partial month. Proposed common comparison horizon: 2024-09 through 2026-08; proposed latest closed calendar cutoff: booking `date < 2026-09-01 00:00:00`, with reporting/as-of date 2026-09-01. Calendar closure does **not** prove complete ingestion.
- There is **no verified complete company-month** and no common observed interval shared by every company. Empty months are NULL/unknown, never zero cash flow. Six months available is not six months complete.
- 183,627 transactions join debt products; 1,314 transactions across 29 product IDs join neither product table. A banking-only join silently loses both groups. Use the product union for currency and diagnostics, then an explicit, disclosed economic-scope policy.
- 635,530 transaction categories are literal `-`, another 330 empty; 29,839 transaction statuses are empty. Operational revenue, internal transfers, chargebacks, and financing cannot be identified perfectly from this extract.
- Actual transaction currency is not an explicit column. Inherited product currency identifies 2,306,077 EUR records, 249,046 known non-EUR records, and 1,314 unresolved-currency records. No FX conversion is justified. EUR-account amount units remain a policy assumption requiring provider confirmation.
- Financial coverage is blocked as a general historical component: balances and debt figures are snapshots, schedules cover only 87 of 2,239 debt products, and scheduled period-by-period amounts are absent. Data completeness must not replace financial coverage under the same name.
- Syntactically valid but implausible dates and monetary extremes require quarantine/quality flags, not blind coercion. Historical versions of statuses, balances, account metadata, and debt terms are absent.

**Handoff:** audit work is complete when the verification section reconciles. Downstream scoring remains conditional on the decisions and evidence in `SCORING ASSUMPTIONS`. AGENT3 must also wait for AGENT2's research report; this audit does not assert that research is ready and does not launch another phase.

## 1. Complete inventory and reproducibility

Inventory used recursive, sorted `os.scandir`, including dotfiles and nested directories, with `follow_symlinks=False`; an independent `os.walk` inventory reconciled. File signatures, strict UTF-8 decoding, full CSV parsing, and the complete dictionary were inspected without executing embedded content. All discovered files are plain text, not containers. Inaccessible inputs: none. Unsupported inputs: none.

```text
/home/juan/Descargas/output_hackspain_data/output/
  balances.csv
  banking_products.csv
  companies.csv
  data_dictionary.md
  debt_products.csv
  debt_schedule_config.csv
  groups.csv
  invoices.csv
  transactions.csv
```

| Complete relative file list | Format / contents | Bytes | SHA-256 |
| --- | --- | --- | --- |
| balances.csv | UTF-8 CSV; one table | 480,768 | 86664c229cf52554d75d7efb864fc07a94a1bebcd61a3ac85abc344f3ba2a30c |
| banking_products.csv | UTF-8 CSV; one table | 596,360 | 0fc5aa20fea32981a962cc08251720ece3f2afad8495910111d2fd8b16514d3c |
| companies.csv | UTF-8 CSV; one table | 70,591 | 5496ad00a1e9228f7e756a55c71c512fd06a73ad45a09ce3f103a620a5ad72ae |
| data_dictionary.md | UTF-8 Markdown; documentation | 5,883 | c1ce02c42c797f3ec16f5b1e1fca6e7887fbf2efabe385dbb5a1f07d113807f9 |
| debt_products.csv | UTF-8 CSV; one table | 268,287 | bf38430ccd15f6a9ca8769113c5f47d4aeee8fe55c425687731481cd002f05d8 |
| debt_schedule_config.csv | UTF-8 CSV; one table | 12,922 | b0d6cc3e6810e31d526eb7f4be3c2abe31496f74f5ddd58163876d60de168ea2 |
| groups.csv | UTF-8 CSV; one table | 5,243 | fa18d3f42cd24d7640bff22d7a9504293574c2338ce85d425e3134f18f169a8c |
| invoices.csv | UTF-8 CSV; one table | 172,547,599 | 6686bd878244881bac78348a108852f3f30713ef244267f1fa3754b9be619c53 |
| transactions.csv | UTF-8 CSV; one table | 472,353,364 | 000a6820a7500c66aa70a17b3e813d0c57a8270b3c58f6f2f006708a20228f2b |

Total source size: 646,341,017 bytes. CSV data records total: 3,472,176.

### Audit method and stable evidence locators

Python 3.12 standard library only: `csv.DictReader(..., encoding="utf-8", newline="")`, exact string IDs, `Decimal` numeric parsing, `datetime.fromisoformat` date parsing, counters over every record, and SHA-256 source checksums. CSVs have comma delimiters and headers; quoted fields can contain newlines. No datetime timezone is attached or converted. The entire source dictionary is documentation, not an executed program.

A reproducible row locator is `(source relative path, source SHA-256, logical data-record ordinal)` where ordinal 1 is the first CSV record after the header. For example, `transactions.csv#record=269` means `enumerate(csv.DictReader(file), start=1)` and **not physical line 270**. Additionally retain the original primary key: `transaction_id`, `operation_id`, `company_id`, `group_id`, or `product_id` as applicable. Preserve source values before normalization. Every reported primary key is unique in its table; balances can use `(product_id,date)` for future multi-snapshot extracts. File hashes bind locators to this exact extract.

Complete-row duplicate screening hashes the ordered, parsed field values using SHA-256; any matching hashes are compared against original parsed rows. No duplicate candidates occurred. Primary-key uniqueness uses exact strings. Economic duplicates with different IDs, pending/booked lifecycle aliases, refund pairing, and cash/card double representation cannot be ruled out by these checks.

Null profile convention: an empty CSV cell is missing (quoted/unquoted emptiness is not distinguished by CSV semantics). Literal sentinel candidates are counted separately, not silently converted: case-insensitive `null`, `none`, `nan`, `na`, `n/a`, `nat`, `undefined`, `-`, `unknown`. Whitespace-only and leading/trailing whitespace are separate checks. The combined missing-candidate column adds empty cells, whitespace-only cells, and literal sentinel candidates (disjoint in this extract); it is a normalization diagnostic, not proof that every sentinel-looking text is missing. No numeric zero is treated as missing. Large or repeating-9 monetary values are quality candidates, not proven missing-value codes. Percentages are exact counts divided by the table's exact record count, rounded to six decimal places.

## 2. Per-table profiles

| File / table | Exact records | Columns | Unique company IDs | Candidate primary key | Distinct key values | Duplicate key excess / full-row excess |
| --- | --- | --- | --- | --- | --- | --- |
| balances.csv | 7,996 | 8 | 1273 | product_id | 7996 | 0 / 0 |
| banking_products.csv | 5,987 | 8 | 1283 | product_id | 5987 | 0 / 0 |
| companies.csv | 1,286 | 6 | 1286 | company_id | 1286 | 0 / 0 |
| debt_products.csv | 2,239 | 11 | 378 | product_id | 2239 | 0 / 0 |
| debt_schedule_config.csv | 87 | 14 | 40 | product_id | 87 | 0 / 0 |
| groups.csv | 250 | 3 | N/A (no company column) | group_id | 250 | 0 / 0 |
| invoices.csv | 897,894 | 14 | 785 | operation_id | 897894 | 0 / 0 |
| transactions.csv | 2,556,437 | 12 | 1286 | transaction_id | 2556437 | 0 / 0 |

The complete company ID sets, including exact table membership, are listed in Section 7. All tables with `company_id` use strings, never integers. Company IDs are the exact zero-padded range `COMP_0001`–`COMP_1286`; Section 7 enumerates each individually. `groups.csv` has 250 group IDs and no direct company field; its indirect company set through `companies.group_id` is all 1,286 companies. There is no counterparty master table.

### 2.1. `balances.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **7,996**. Unique direct companies: **1273**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| product_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| date | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| balance | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 2236 | 0 / 0 |
| available | all empty; monetary role documented, type not empirically inferable | 7,996 (100.000000%) | 0 (0.000000%) | 7,996 (100.000000%) | 0 | 0 / 0 |
| granted | decimal monetary amount in source units | 5,348 (66.883442%) | 0 (0.000000%) | 5,348 (66.883442%) | 18 | 0 / 0 |
| liquidity | decimal monetary amount in source units | 6,100 (76.288144%) | 0 (0.000000%) | 6,100 (76.288144%) | 218 | 0 / 0 |
| countable | decimal monetary amount in source units | 7,332 (91.695848%) | 0 (0.000000%) | 7,332 (91.695848%) | 93 | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| date | 2026-08-25T00:00:00 | 2026-09-01T00:00:00 | 0 | 0 | `naive`: 7,996 | `DDDD-DD-DD DD:DD:DD`: 7,996 |

Numeric ranges below are scalar quality diagnostics in original units, **not monetary totals or comparable cross-currency quantities**. Negative counts and numeric zeros remain separate from nulls. `abs >= 1e9` is only a disclosed diagnostic threshold, not a rejection rule.

| Numeric column | Minimum | Maximum | Nonempty parse failures | Negative | Noninteger | abs >= 1e9 |
| --- | --- | --- | --- | --- | --- | --- |
| balance | -999999999 | 99999990850 | 0 | 1718 | 5220 | 4 |
| available | N/A | N/A | 0 | 0 | 0 | 0 |
| granted | -300000000 | 2000000 | 0 | 2623 | 710 | 0 |
| liquidity | -23638.71 | 1000207616.82 | 0 | 10 | 988 | 1 |
| countable | -23439448.15 | 1001000207615.82 | 0 | 115 | 493 | 3 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| product_id | `PRODUCT_DDDDD`: 7,996 |
| company_id | `COMP_DDDD`: 7,996 |

Currency origin: inherited through product union on `product_id`, checked against `company_id`. Counts: `<unknown>`: 29; `AED`: 6; `AOA`: 13; `ARS`: 6; `AUD`: 16; `BAM`: 4; `BRL`: 15; `CAD`: 21; `CHF`: 17; `CLP`: 6; `COP`: 8; `CZK`: 8; `DKK`: 13; `EUR`: 6,966; `GBP`: 183; `GHS`: 4; `HKD`: 3; `HUF`: 5; `ILS`: 1; `INR`: 1; `JPY`: 6; `MXN`: 24; `MYR`: 1; `MZN`: 1; `NAD`: 1; `NOK`: 21; `NZD`: 7; `PEN`: 7; `PHP`: 2; `PLN`: 15; `RON`: 3; `RUB`: 1; `SEK`: 14; `SGD`: 8; `THB`: 1; `TRY`: 1; `USD`: 554; `VND`: 1; `XOF`: 2; `ZAR`: 1.

Primary company/product/group join-check anomalies: `unknown_product`: 29. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.2. `banking_products.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **5,987**. Unique direct companies: **1283**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| product_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| label | text | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| type | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| bank_name | text | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 5 |
| service | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| currency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| created_at | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| created_at | 2021-11-18T15:54:13 | 2026-09-15T13:36:10 | 0 | 0 | `naive`: 5,987 | `DDDD-DD-DD DD:DD:DD`: 5,987 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| product_id | `PRODUCT_DDDDD`: 5,987 |
| company_id | `COMP_DDDD`: 5,987 |

Currency origin: explicit `currency`. Counts: `AED`: 6; `AOA`: 13; `ARS`: 6; `AUD`: 17; `BAM`: 4; `BRL`: 15; `CAD`: 21; `CHF`: 17; `CLP`: 6; `COP`: 10; `CZK`: 9; `DKK`: 15; `EUR`: 4,919; `GBP`: 197; `GHS`: 15; `HKD`: 3; `HUF`: 5; `ILS`: 1; `INR`: 1; `JPY`: 7; `MXN`: 25; `MYR`: 1; `MZN`: 1; `NAD`: 1; `NOK`: 21; `NZD`: 7; `PEN`: 7; `PHP`: 2; `PLN`: 18; `RON`: 3; `RUB`: 1; `SEK`: 15; `SGD`: 8; `THB`: 1; `TRY`: 1; `USD`: 582; `VND`: 1; `XOF`: 4; `ZAR`: 1.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| type | `card`: 796; `checking`: 4,854; `expensesPlatform`: 23; `investment`: 201; `lineofcomex`: 19; `risk`: 25; `saving`: 10; `tpv`: 25; `wallet`: 34 |
| service | `_citibank`: 1; `_city_nb`: 3; `_fab`: 1; `_payhawk`: 2; `_pnc_pinacle`: 2; `_sabadell_miami`: 3; `_vietcom`: 4; `abanca`: 4; `abanca_emp`: 131; `abn-amro-nl`: 11; `adyen`: 2; `alphabank`: 5; `amex`: 3; `andbank`: 5; `arkea-corporate`: 2; `arquia`: 4; `b_de_bogota_co`: 2; `banca_bnl_corporate`: 2; `bancamarch`: 186; `bancapueyo`: 1; `bancasella_it`: 1; `banco-bic-portugues-sa`: 1; `banco-bpi-sa`: 5; `banco-comercial-portugues-sa`: 1; `banco-santander-totta-sa`: 11; `banco_bpm_corporate`: 5; `bancocaminos`: 1; `bancogalicia_emp_ar`: 2; `banconacion_emp_pe`: 2; `bankinter`: 9; `bankinter-sa-sucursal-em-portugal`: 2; `bankinter_emp`: 377; `barclays_business`: 11; `barclays_corporate`: 59; `bbpi`: 5; `bbva`: 6; `bbva_co`: 1; `bbva_corporate`: 1; `bbva_emp`: 523; `bbva_emp_co`: 4; `bbva_emp_pe`: 6; `bc`: 60; `berliner-sparkasse`: 1; `bmps_business`: 4; `bp-grand-ouest`: 1; `bper`: 1; `bw-bank`: 7; `ca_cariparma_spa-business`: 1; `ca_centrefrance`: 3; `ca_des_savoie`: 1; `ca_valdefrance`: 1; `caisse-d-epargne-bretagne-pays-de-loire`: 1; `caisse-d-epargne-hauts-de-france`: 1; `caisse-d-epargne-provence-alpes-corse`: 1; `caixa`: 60; `caixa-geral-de-depositos`: 8; `caixa_emp`: 991; `caixa_multi`: 2; `caixaguissona`: 5; `caixaruralalmenara`: 4; `cajaalmendralejo`: 3; `cajaingenieros`: 6; `cajalaboral_emp`: 20; `cajalaboral_res`: 1; `cajamar`: 65; `cajasur`: 2; `cajasur_emp`: 2; `cbc_belgium`: 1; `cic`: 6; `cic_fr`: 3; `citi`: 36; `citibank_emp_co`: 1; `commerzbank`: 16; `coutts`: 2; `credit-du-nord`: 1; `credit_agricole_paris`: 2; `creditlyonnais-business`: 2; `creditmutuel`: 2; `custom`: 347; `danskebankbusiness_dk`: 4; `danskebankbusiness_uk`: 2; `davivienda_co`: 2; `deutschebank`: 2; `deutschebank-pfb_de`: 9; `deutschebank_emp`: 54; `dnb`: 22; `ebury`: 16; `embat`: 32; `embatpayments`: 4; `erstebank_at`: 1; `eurobank`: 4; `eurocajarural_emp`: 6; `evobanco`: 1; `fortis-corporate_be`: 8; `gca`: 4; `hamburger-sparkasse`: 6; `hsbc`: 7; `hsbccorporate`: 63; `hsbccorporate_eu`: 20; `ibercaja`: 82; `iberiacards_emp`: 6; `ing`: 35; `ingdirect`: 1; `ins_10`: 7; `ins_110439`: 2; `ins_111890`: 3; `ins_116728`: 4; `ins_116794`: 2; `ins_117133`: 1; `ins_123029`: 1; `ins_125271`: 3; `ins_126338`: 1; `ins_127317`: 13; `ins_127888`: 3; `ins_127989`: 7; `ins_127991`: 4; `ins_130209`: 2; `ins_130888`: 1; `ins_131932`: 2; `ins_133019`: 2; `ins_133676`: 2; `ins_136937`: 7; `ins_137272`: 1; `ins_42`: 3; `ins_5`: 2; `ins_53`: 4; `ins_56`: 5; `intesa_sanpaolo`: 1; `intesa_sanpaolo_corporate`: 9; `kbc_belgium`: 1; `kbcbrussels_belgium`: 9; `kutxabank_emp`: 43; `labanquepostale`: 1; `lloydscommercial_eu`: 3; `lloydscommercial_uk`: 5; `mabanque`: 1; `mabanque-corporate`: 12; `millenniumbcp`: 8; `morabanc`: 1; `nbg`: 1; `nordea-business_dk`: 6; `novo-banco-sa`: 17; `payhawk`: 43; `payoneer`: 10; `paypal`: 89; `pichincha`: 4; `piraeus`: 1; `popolaresondrio_it`: 6; `qonto`: 14; `rabobank`: 6; `rbs`: 2; `redsys`: 26; `renta4`: 2; `revolut`: 92; `revolut_eu`: 6; `revolut_gb`: 34; `ruralvia`: 4; `ruralvia_caixapopular`: 1; `ruralvia_cajaruralaragon`: 5; `ruralvia_cajaruralsur`: 4; `ruralvia_cajasiete`: 1; `ruralvia_cajaviva`: 1; `ruralvia_emp`: 76; `ruralvia_globalcaja`: 21; `ruralvia_navarra`: 1; `ruralvia_soria`: 1; `ruralvia_teruel`: 1; `sabadell`: 6; `sabadell_emp`: 427; `sabadell_emp_sec`: 170; `sanpaolo_it`: 4; `santander`: 13; `santander-coporate_uk`: 15; `santander-corporate_uk`: 2; `santander_emp`: 1,054; `santander_emp_cl`: 3; `santander_emp_mx`: 4; `santander_emp_pt`: 5; `santander_rio_emp_ar`: 3; `santander_uk`: 4; `scotiabank_emp_cl`: 3; `soc-gen-business`: 2; `soc-gen-corporate`: 8; `ssk-muenchen`: 8; `stripe`: 27; `swedbank_se`: 4; `transferwise`: 24; `transferwise_es`: 6; `unicaja_emp`: 28; `unicredit`: 10; `unicredit_at`: 1; `unicreditbusiness_de`: 9; `unitplus`: 3; `vb-hohenlimburg`: 1; `volksbank-hunsrueck-nahe`: 13; `volkswagenbank`: 2; `vrmeinebank`: 4; `wellsfargo`: 4 |
| currency | `AED`: 6; `AOA`: 13; `ARS`: 6; `AUD`: 17; `BAM`: 4; `BRL`: 15; `CAD`: 21; `CHF`: 17; `CLP`: 6; `COP`: 10; `CZK`: 9; `DKK`: 15; `EUR`: 4,919; `GBP`: 197; `GHS`: 15; `HKD`: 3; `HUF`: 5; `ILS`: 1; `INR`: 1; `JPY`: 7; `MXN`: 25; `MYR`: 1; `MZN`: 1; `NAD`: 1; `NOK`: 21; `NZD`: 7; `PEN`: 7; `PHP`: 2; `PLN`: 18; `RON`: 3; `RUB`: 1; `SEK`: 15; `SGD`: 8; `THB`: 1; `TRY`: 1; `USD`: 582; `VND`: 1; `XOF`: 4; `ZAR`: 1 |

Primary company/product/group join-check anomalies: none. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.3. `companies.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **1,286**. Unique direct companies: **1286**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| group_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| country | categorical string | 1,056 (82.115086%) | 0 (0.000000%) | 1,056 (82.115086%) | N/A | 0 / 1 |
| currency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| erp | categorical string | 541 (42.068429%) | 0 (0.000000%) | 541 (42.068429%) | N/A | 0 / 0 |
| created_at | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| created_at | 2021-11-17T10:55:30 | 2026-07-16T06:51:09 | 0 | 0 | `naive`: 1,286 | `DDDD-DD-DD DD:DD:DD`: 1,286 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| company_id | `COMP_DDDD`: 1,286 |
| group_id | `GROUP_DDDD`: 1,286 |

Currency origin: explicit `currency`. Counts: `AED`: 2; `AOA`: 2; `ARS`: 1; `AUD`: 5; `BAM`: 1; `BRL`: 3; `CAD`: 3; `CHF`: 3; `CLP`: 3; `COP`: 5; `CZK`: 1; `DKK`: 6; `EUR`: 1,149; `GBP`: 42; `GHS`: 1; `INR`: 1; `JPY`: 1; `MXN`: 7; `MYR`: 1; `NAD`: 1; `NOK`: 1; `NZD`: 2; `PEN`: 2; `PLN`: 4; `SEK`: 1; `USD`: 36; `VND`: 1; `XOF`: 1.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| currency | `AED`: 2; `AOA`: 2; `ARS`: 1; `AUD`: 5; `BAM`: 1; `BRL`: 3; `CAD`: 3; `CHF`: 3; `CLP`: 3; `COP`: 5; `CZK`: 1; `DKK`: 6; `EUR`: 1,149; `GBP`: 42; `GHS`: 1; `INR`: 1; `JPY`: 1; `MXN`: 7; `MYR`: 1; `NAD`: 1; `NOK`: 1; `NZD`: 2; `PEN`: 2; `PLN`: 4; `SEK`: 1; `USD`: 36; `VND`: 1; `XOF`: 1 |
| country | `AT`: 1; `Alemania`: 1; `BE`: 3; `DE`: 11; `ES`: 142; `ESPANYA`: 2; `ESPAÑA`: 14; `Espanya`: 1; `España`: 9; `España `: 1; `FR`: 6; `GB`: 4; `IT`: 3; `Italia`: 1; `Malaysia`: 1; `NL`: 14; `PL`: 1; `PT`: 3; `Portugal`: 5; `SE`: 1; `Spain`: 1; `US`: 5 |
| erp | `a3`: 14; `businessCentral`: 322; `businessOne`: 47; `datev`: 1; `distritoK`: 20; `dynamicsAx`: 42; `ekon`: 3; `etendo`: 11; `fo`: 2; `holded`: 1; `libra`: 7; `m3Rosetta`: 21; `navision`: 18; `netsuite`: 143; `r3`: 10; `sage200`: 47; `sage50`: 1; `sageIntacct`: 4; `sageX3`: 30; `sapByd`: 1 |

Primary company/product/group join-check anomalies: none. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.4. `debt_products.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **2,239**. Unique direct companies: **378**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| product_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| label | text | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| type | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| bank_name | text | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| service | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| currency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| created_at | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| granted | decimal monetary amount in source units | 169 (7.548013%) | 0 (0.000000%) | 169 (7.548013%) | 22 | 0 / 0 |
| outstanding | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 743 | 0 / 0 |
| liquidity | decimal monetary amount in source units | 1,435 (64.091112%) | 0 (0.000000%) | 1,435 (64.091112%) | 1 | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| created_at | 2022-04-06T07:26:09 | 2026-09-15T20:50:53 | 0 | 0 | `naive`: 2,239 | `DDDD-DD-DD DD:DD:DD`: 2,239 |

Numeric ranges below are scalar quality diagnostics in original units, **not monetary totals or comparable cross-currency quantities**. Negative counts and numeric zeros remain separate from nulls. `abs >= 1e9` is only a disclosed diagnostic threshold, not a rejection rule.

| Numeric column | Minimum | Maximum | Nonempty parse failures | Negative | Noninteger | abs >= 1e9 |
| --- | --- | --- | --- | --- | --- | --- |
| granted | -300000000 | 2000000 | 0 | 2043 | 711 | 0 |
| outstanding | -300000000 | 21350000 | 0 | 1351 | 1256 | 0 |
| liquidity | 0 | 42700000 | 0 | 0 | 572 | 0 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| product_id | `PRODUCT_DDDDD`: 2,239 |
| company_id | `COMP_DDDD`: 2,239 |

Currency origin: explicit `currency`. Counts: `EUR`: 2,221; `GBP`: 2; `MXN`: 1; `USD`: 15.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| type | `confirming`: 229; `factoring`: 24; `guarantee`: 155; `leasing`: 179; `lineofcredit`: 536; `loan`: 1,022; `mortgage`: 60; `renting`: 34 |
| service | `_bbt`: 1; `_others`: 3; `abanca`: 2; `abanca_emp`: 56; `alphabank`: 1; `arkea-corporate`: 2; `arquia`: 1; `bancamarch`: 41; `banco-santander-totta-sa`: 1; `bankinter_emp`: 258; `bbva`: 2; `bbva_emp`: 269; `bmps_business`: 1; `caisse-d-epargne-bretagne-pays-de-loire`: 1; `caisse-d-epargne-hauts-de-france`: 19; `caixa`: 8; `caixa_emp`: 392; `cajaalmendralejo`: 2; `cajaingenieros`: 3; `cajalaboral_emp`: 24; `cajamar`: 24; `cajasur`: 4; `credit-du-nord`: 3; `creditlyonnais-business`: 1; `creditmutuel`: 2; `custom`: 200; `deutschebank`: 1; `deutschebank_emp`: 18; `dnb`: 1; `eurocajarural_emp`: 13; `hsbccorporate_eu`: 4; `ibercaja`: 25; `iberiacards`: 1; `inhousebanking`: 36; `ins_127317`: 2; `ins_130209`: 6; `ins_131862`: 3; `intesa_sanpaolo_corporate`: 1; `kutxabank_emp`: 11; `labanquepostale`: 1; `mabanque`: 8; `mabanque-corporate`: 5; `millenniumbcp`: 1; `pichincha`: 2; `popolaresondrio_it`: 1; `ruralvia`: 5; `ruralvia_cajaruralaragon`: 2; `ruralvia_emp`: 41; `ruralvia_navarra`: 6; `ruralvia_soria`: 1; `sabadell`: 1; `sabadell_emp`: 163; `sabadell_emp_sec`: 40; `sanpaolo_it`: 2; `santander`: 3; `santander_emp`: 499; `soc-gen-corporate`: 4; `unicaja_emp`: 8; `unicredit`: 1; `volkswagenbank`: 2 |
| currency | `EUR`: 2,221; `GBP`: 2; `MXN`: 1; `USD`: 15 |

Primary company/product/group join-check anomalies: none. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.5. `debt_schedule_config.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **87**. Unique direct companies: **40**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| product_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| settlement_product_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| currency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| amortization_type | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| interest_calc_method | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| amortising_frequency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| granted_balance | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 4 | 0 / 0 |
| outstanding_balance | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 0 | 0 / 0 |
| total_periods | integer count | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 0 | 0 / 0 |
| next_payment_date | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| last_payment_date | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| annual_interest_rate_or_spread | decimal rate; base/quote or percent convention not fully documented | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 3 | 0 / 0 |
| interest_type | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| next_payment_date | 2024-03-19T00:00:00 | 2027-01-22T00:00:00 | 0 | 0 | `naive`: 87 | `DDDD-DD-DD DD:DD:DD`: 87 |
| last_payment_date | 2024-02-27T15:09:49 | 2026-09-15T17:34:50 | 0 | 0 | `naive`: 87 | `DDDD-DD-DD DD:DD:DD`: 87 |

Numeric ranges below are scalar quality diagnostics in original units, **not monetary totals or comparable cross-currency quantities**. Negative counts and numeric zeros remain separate from nulls. `abs >= 1e9` is only a disclosed diagnostic threshold, not a rejection rule.

| Numeric column | Minimum | Maximum | Nonempty parse failures | Negative | Noninteger | abs >= 1e9 |
| --- | --- | --- | --- | --- | --- | --- |
| granted_balance | 0 | 300000000 | 0 | 0 | 16 | 0 |
| outstanding_balance | 2.43 | 300000000 | 0 | 0 | 65 | 0 |
| total_periods | 1 | 180 | 0 | 0 | 0 | 0 |
| annual_interest_rate_or_spread | 0 | 0.11 | 0 | 0 | 84 | 0 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| product_id | `PRODUCT_DDDDD`: 87 |
| company_id | `COMP_DDDD`: 87 |
| settlement_product_id | `PRODUCT_DDDDD`: 87 |

Currency origin: explicit `currency`. Counts: `EUR`: 87.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| currency | `EUR`: 87 |
| amortization_type | `constant quote`: 87 |
| interest_calc_method | `30/360`: 81; `Actual/Actual ISDA`: 6 |
| amortising_frequency | `monthly`: 79; `quarterly`: 5; `semiannually`: 3 |
| interest_type | `fixed`: 58; `variable`: 29 |

Primary company/product/group join-check anomalies: none. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

Secondary settlement join: 10 settlement_product_id values do not resolve in banking_products; 8 of these resolve in debt_products and 2 resolve in neither table. This secondary-join issue is not included in the primary-key join counters above.

### 2.6. `groups.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **250**. Unique direct companies: **0** (not applicable: no company_id column). Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| group_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| erp | categorical string | 161 (64.400000%) | 0 (0.000000%) | 161 (64.400000%) | N/A | 0 / 1 |
| n_companies_in_sample | integer count | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 0 | 0 / 0 |

Date columns: none; date range and timezone are not applicable.

Numeric ranges below are scalar quality diagnostics in original units, **not monetary totals or comparable cross-currency quantities**. Negative counts and numeric zeros remain separate from nulls. `abs >= 1e9` is only a disclosed diagnostic threshold, not a rejection rule.

| Numeric column | Minimum | Maximum | Nonempty parse failures | Negative | Noninteger | abs >= 1e9 |
| --- | --- | --- | --- | --- | --- | --- |
| n_companies_in_sample | 1 | 22 | 0 | 0 | 0 | 0 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| group_id | `GROUP_DDDD`: 250 |

Currency origin: not applicable. Counts: `<not applicable>`: 250.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| erp | `A3 ERP`: 2; `Desarrollo propio`: 1; `Distrito K`: 1; `Etendo`: 1; `Holded`: 1; `Infor M3 `: 1; `LIBRA`: 1; `MOVEX`: 1; `Microsoft Business Central`: 28; `Microsoft Dynamics - AX 2009`: 1; `Microsoft Dynamics - AX 2012`: 2; `Microsoft Dynamics - F&O`: 2; `Microsoft Navision`: 6; `Netsuite`: 19; `Odoo`: 1; `Oracle Cloud`: 1; `SAP Business One`: 6; `SAP R3 / S4`: 2; `Sage 200`: 5; `Sage 50`: 3; `Sage X3`: 4 |

Primary company/product/group join-check anomalies: none. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.7. `invoices.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **897,894**. Unique direct companies: **785**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| operation_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| document_type | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| issuance_date | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| due_date | ISO-like naive datetime; timezone unspecified | 8 (0.000891%) | 0 (0.000000%) | 8 (0.000891%) | N/A | 0 / 0 |
| payment_date | ISO-like naive datetime; timezone unspecified | 6 (0.000668%) | 0 (0.000000%) | 6 (0.000668%) | N/A | 0 / 0 |
| amount | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 1183 | 0 / 0 |
| pending_amount | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 673101 | 0 / 0 |
| currency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| accounting_currency | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| exchange_rate | decimal rate; base/quote or percent convention not fully documented | 261 (0.029068%) | 0 (0.000000%) | 261 (0.029068%) | 3389 | 0 / 0 |
| status | categorical string | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| concept | text | 3,967 (0.441812%) | 6 (0.000668%); `-`: 4; `N/A`: 2 | 3,973 (0.442480%) | N/A | 0 / 7716 |
| counterparty_id | opaque string identifier; preserve prefix and zero padding | 11,457 (1.275986%) | 0 (0.000000%) | 11,457 (1.275986%) | N/A | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| issuance_date | 2024-09-01T00:00:00 | 2026-09-01T22:00:00 | 0 | 0 | `naive`: 897,894 | `DDDD-DD-DD DD:DD:DD`: 897,894 |
| due_date | 2000-03-01T00:00:00 | 7025-07-31T00:00:00 | 8 | 0 | `naive`: 897,886 | `DDDD-DD-DD DD:DD:DD`: 897,886 |
| payment_date | 2000-10-31T00:00:00 | 6913-11-20T00:00:00 | 6 | 0 | `naive`: 897,888 | `DDDD-DD-DD DD:DD:DD`: 897,888 |

Numeric ranges below are scalar quality diagnostics in original units, **not monetary totals or comparable cross-currency quantities**. Negative counts and numeric zeros remain separate from nulls. `abs >= 1e9` is only a disclosed diagnostic threshold, not a rejection rule.

| Numeric column | Minimum | Maximum | Nonempty parse failures | Negative | Noninteger | abs >= 1e9 |
| --- | --- | --- | --- | --- | --- | --- |
| amount | -62442200699.61 | 62442200699.61 | 0 | 530045 | 685207 | 10 |
| pending_amount | -1613461892.11 | 1272103835.8 | 0 | 110465 | 177077 | 2 |
| exchange_rate | 0 | 20303.01 | 0 | 0 | 44435 | 0 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| operation_id | `length 32`: 897,894; opaque high-cardinality strings, not printed individually |
| company_id | `COMP_DDDD`: 897,894 |
| counterparty_id | `COUNTERPARTY_DDDDD`: 826,581; `COUNTERPARTY_DDDDDD`: 59,856 |

Currency origin: explicit `currency`. Counts: `AED`: 131; `AOA`: 4; `ARS`: 1,987; `AUD`: 2,551; `BRL`: 5,265; `CAD`: 6,593; `CHF`: 400; `CLP`: 8,247; `CNY`: 29; `COP`: 6,102; `CZK`: 29; `DKK`: 4,351; `EUR`: 767,795; `GBP`: 21,048; `HKD`: 266; `HUF`: 4; `IDR`: 3; `ILS`: 66; `INR`: 185; `ISK`: 10; `JPY`: 67; `MAD`: 60; `MXN`: 6,527; `MYR`: 100; `MZN`: 2,078; `NAD`: 3,375; `NOK`: 499; `NZD`: 728; `PEN`: 1,855; `PHP`: 1; `PLN`: 451; `SAR`: 2; `SEK`: 656; `SGD`: 560; `THB`: 4; `TRY`: 209; `USD`: 55,608; `VND`: 9; `ZAR`: 39.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| document_type | `cheque`: 12; `deliveryNote`: 6,380; `deposit`: 21,390; `invoice`: 760,406; `invoiceGroup`: 13,775; `note`: 38,154; `other`: 739; `paymentDocument`: 53,761; `purchaseOrder`: 1,259; `refund`: 2,018 |
| currency | `AED`: 131; `AOA`: 4; `ARS`: 1,987; `AUD`: 2,551; `BRL`: 5,265; `CAD`: 6,593; `CHF`: 400; `CLP`: 8,247; `CNY`: 29; `COP`: 6,102; `CZK`: 29; `DKK`: 4,351; `EUR`: 767,795; `GBP`: 21,048; `HKD`: 266; `HUF`: 4; `IDR`: 3; `ILS`: 66; `INR`: 185; `ISK`: 10; `JPY`: 67; `MAD`: 60; `MXN`: 6,527; `MYR`: 100; `MZN`: 2,078; `NAD`: 3,375; `NOK`: 499; `NZD`: 728; `PEN`: 1,855; `PHP`: 1; `PLN`: 451; `SAR`: 2; `SEK`: 656; `SGD`: 560; `THB`: 4; `TRY`: 209; `USD`: 55,608; `VND`: 9; `ZAR`: 39 |
| accounting_currency | `AED`: 1,731; `ARS`: 2,230; `AUD`: 3,323; `BRL`: 5,241; `CAD`: 5,933; `CHF`: 1; `CLP`: 8,368; `COP`: 6,266; `DKK`: 5,280; `EUR`: 779,839; `GBP`: 24,770; `INR`: 228; `MAD`: 55; `MXN`: 6,912; `MYR`: 2,162; `MZN`: 2,700; `NAD`: 3,804; `NZD`: 615; `PEN`: 2,658; `PLN`: 10; `SGD`: 739; `USD`: 35,020; `VND`: 9 |
| status | `cancel`: 13,699; `overdue`: 192,556; `paid`: 660,299; `paymentOrder`: 406; `payment_in_progress`: 1,216; `pending`: 29,717; `shipped`: 1 |

Primary company/product/group join-check anomalies: none. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.8. `transactions.csv`

Physical type for **every column**: UTF-8 CSV text cells; there are no native typed columns. Exact data records: **2,556,437**. Unique direct companies: **1286**. Field names below are in source order.

| Column | Inferred logical type | Empty count / rate | Literal sentinel count / rate | Combined missing-candidate count / rate | Numeric zeros (not null) | Whitespace-only / trimmed count |
| --- | --- | --- | --- | --- | --- | --- |
| transaction_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| company_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| product_id | opaque string identifier; preserve prefix and zero padding | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| date | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| value_date | ISO-like naive datetime; timezone unspecified | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | N/A | 0 / 0 |
| amount | decimal monetary amount in source units | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 369 | 0 / 0 |
| exchange_rate | decimal rate; base/quote or percent convention not fully documented | 0 (0.000000%) | 0 (0.000000%) | 0 (0.000000%) | 77 | 0 / 0 |
| status | categorical string | 29,839 (1.167210%) | 0 (0.000000%) | 29,839 (1.167210%) | N/A | 0 / 0 |
| accounting_status | categorical string | 1,573,869 (61.564944%) | 0 (0.000000%) | 1,573,869 (61.564944%) | N/A | 0 / 0 |
| category | categorical string | 330 (0.012909%) | 635,530 (24.859991%); `-`: 635,530 | 635,860 (24.872899%) | N/A | 0 / 0 |
| description | text | 456 (0.017837%) | 1 (0.000039%); `-`: 1 | 466 (0.018228%) | N/A | 9 / 25756 |
| counterparty_id | opaque string identifier; preserve prefix and zero padding | 2,305,659 (90.190331%) | 0 (0.000000%) | 2,305,659 (90.190331%) | N/A | 0 / 0 |

| Date column | Minimum parsed datetime | Maximum parsed datetime | Empty | Nonempty parse failures | Timezone behavior | Observed physical shapes (D=digit) |
| --- | --- | --- | --- | --- | --- | --- |
| date | 2024-09-01T00:00:00 | 2026-09-01T23:37:04 | 0 | 0 | `naive`: 2,556,437 | `DDDD-DD-DD DD:DD:DD`: 2,556,437 |
| value_date | 2022-07-01T00:00:00 | 2099-12-31T01:00:00 | 0 | 0 | `naive`: 2,556,437 | `DDDD-DD-DD DD:DD:DD`: 2,556,437 |

Numeric ranges below are scalar quality diagnostics in original units, **not monetary totals or comparable cross-currency quantities**. Negative counts and numeric zeros remain separate from nulls. `abs >= 1e9` is only a disclosed diagnostic threshold, not a rejection rule.

| Numeric column | Minimum | Maximum | Nonempty parse failures | Negative | Noninteger | abs >= 1e9 |
| --- | --- | --- | --- | --- | --- | --- |
| amount | -3069784469.83 | 3100000000 | 0 | 1505288 | 1974972 | 24 |
| exchange_rate | 0 | 6500 | 0 | 0 | 100589 | 0 |

| Identifier column | Observed structural shapes (D=digit) or full-data length distribution, counts |
| --- | --- |
| transaction_id | `length 17`: 16,126; `length 21`: 9,848; `length 24`: 53; `length 26`: 1,462; `length 28`: 16,793; `length 31`: 1; `length 32`: 2,305,953; `length 34`: 137,706; `length 35`: 50; `length 36`: 26,106; `length 37`: 16,751; `length 38`: 1,787; `length 41`: 941; `length 42`: 26; `length 45`: 649; `length 48`: 6,695; `length 64`: 15,490; opaque high-cardinality strings, not printed individually |
| company_id | `COMP_DDDD`: 2,556,437 |
| product_id | `PRODUCT_DDDDD`: 2,556,437 |
| counterparty_id | `COUNTERPARTY_DDDDD`: 250,778 |

Currency origin: inherited through product union on `product_id`, checked against `company_id`. Counts: `<unknown>`: 1,314; `AED`: 1,746; `AOA`: 2,671; `ARS`: 3,440; `AUD`: 18,377; `BAM`: 3,987; `BRL`: 16,950; `CAD`: 4,569; `CHF`: 3,893; `CLP`: 7,766; `COP`: 9,196; `CZK`: 1,675; `DKK`: 6,715; `EUR`: 2,306,077; `GBP`: 42,183; `GHS`: 1,145; `HKD`: 171; `HUF`: 76; `ILS`: 388; `INR`: 301; `JPY`: 204; `MXN`: 13,227; `MYR`: 143; `MZN`: 1,087; `NAD`: 1,425; `NOK`: 896; `NZD`: 3,873; `PEN`: 2,468; `PLN`: 947; `SEK`: 934; `SGD`: 510; `USD`: 97,574; `VND`: 254; `XOF`: 255.

| Categorical column | Every nonempty observed value and exact count |
| --- | --- |
| status | `booked`: 2,520,019; `pending`: 6,579 |
| accounting_status | `ACCOUNTING_COMPLETED`: 30,995; `ACCOUNTING_RECOMMENDATION`: 18,064; `DISCARDED`: 308,568; `PENDING`: 95,281; `RECONCILIATION_COMPLETED`: 528,034; `RECONCILIATION_RECOMMENDATION`: 1,626 |
| category | `-`: 635,530; `bulk_collection`: 65,492; `bulk_payment`: 41,469; `cash_settlement`: 48,280; `cash_settlements`: 90; `cash_withdrawal`: 14,096; `collection`: 567,417; `collection_refund`: 11,848; `debt_repayment`: 23,044; `fee`: 179,500; `interest_charge`: 7,822; `investment_deployment`: 3,923; `investment_return`: 3,458; `payment`: 362,276; `payment_refund`: 3,222; `pos_settlement`: 47,315; `pos_withdrawal`: 7,506; `salary`: 42,223; `social_security`: 24,158; `tax`: 55,904; `tax_refund`: 2; `transfer`: 152,102; `utility`: 259,430 |

Primary company/product/group join-check anomalies: `not_banking_product`: 184,941; `unknown_product`: 1,314. Known primary-product-to-company ownership mismatches and unknown company IDs: zero. Settlement-account references, counterparties, and missing product snapshots are separately assessed in Section 3.

### 2.9. `data_dictionary.md` (documentation)

The complete file has 119 physical text lines and 8 descriptive Markdown tables. Data-record count, company ID set, date ranges, null rates, and currency counts are N/A for this documentation file. Its descriptive tables were read in full; their exact body-row counts are:

| Descriptive table section | Body rows (not financial records) |
| --- | --- |
| groups.csv (250 rows) | 3 |
| companies.csv (1,286 rows) | 6 |
| banking_products.csv (5,987 rows) / debt_products.csv (2,239 rows) | 9 |
| debt_schedule_config.csv (87 rows) | 8 |
| transactions.csv (2,556,437 rows) | 10 |
| invoices.csv (897,894 rows) | 11 |
| balances.csv (7,996 rows) | 4 |
| Placeholders | 7 |

Dictionary mismatches: `debt_schedule_config.currency` exists but is omitted from its documented schema; banking types additionally include `wallet`, `lineofcomex`, and `risk`; observed largest group size is 22, not the dictionary upper bound 24; company country contains non-ISO names and trailing whitespace; invoice document/status vocabularies and category values extend the examples. The advertised 24 months includes a 25th partial calendar label at 2026-09. Snapshot date claims do not explain product connections and loan last-payment dates after 2026-09-01. Treat this report as observed schema authority and the dictionary as partial semantic evidence.

## 3. Join map, currency resolution, and referential integrity

| From | Join | Cardinality / observed result | Required handling |
| --- | --- | --- | --- |
| companies | companies.group_id = groups.group_id | 1,286 → 250; zero orphan groups; all group counts reconcile | Group ownership is not a proven mapping from counterparty to an internal company. |
| banking_products / debt_products | company_id = companies.company_id | 5,987 banking + 2,239 debt products; no key overlap; zero orphan companies | Union is unique on product_id; retain source table and type. |
| transactions | product_id = product_union.product_id AND matching company_id | 2,371,496 banking; 183,627 debt; 1,314 unresolved; zero known ownership mismatches | Do not inner-join only banking and silently discard debt/orphans. Resolve first, filter with reason later. |
| balances | product_id = product_union.product_id AND matching company_id | 7,967 resolved, 29 unresolved; 259 known products lack balance | Exclude unresolved currency. One row per product is not a historical balance series. |
| debt_schedule_config | product_id = debt_products.product_id AND company_id | 87 unique schedules / 2,239 products; 40 / 378 debt-owning companies | Schedule presence is sparse, not proof all obligations are represented. |
| debt_schedule_config | settlement_product_id = product_union.product_id | 77 banking; 8 debt; 2 unresolved | Dictionary calls it a bank account; debt matches require semantic validation, not silent failure of banking-only join. |
| invoices | company_id = companies.company_id | 897,894 records; 785 companies; zero orphans | Explicit invoice.currency, not company default or accounting currency, governs source units. |
| transactions ↔ invoices | company_id + counterparty_id (candidate linkage only) | 42,125 counterparties shared; no document-to-transaction foreign key | Many-to-many, not an invoice settlement join; do not fan out monetary totals. |

| Integrity / linkage statistic | Exact value |
| --- | --- |
| balance_ids_outside_products | 29 |
| bank_accounts_without_transactions | 1080 |
| bank_debt_key_overlap | 0 |
| bank_products_without_balance | 227 |
| debt_products_without_balance | 32 |
| group_company_count_mismatches | 0 |
| invoice_counterparties | 124030 |
| invoices_only_counterparties | 81905 |
| products_without_balance | 259 |
| shared_counterparties | 42125 |
| transaction_counterparties | 47796 |
| transactions_only_counterparties | 5671 |

Counterparty IDs are opaque strings: blank transaction counterparties are 2,305,659 (90.190331%). Counterparty overlap proves shared identifiers only, not that two records are one payment or that a counterparty is internal. No `reversal_of`, original-transaction reference, transaction-to-invoice ID, counterparty-to-company mapping, ingestion ledger, or explicit posted-version timestamp exists.

### Unresolved product references: complete affected product-ID list

| balances.product_id | company_id | Affected records | Currency resolution |
| --- | --- | --- | --- |
| PRODUCT_08230 | COMP_0046 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08258 | COMP_0007 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08259 | COMP_0046 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08260 | COMP_0185 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08261 | COMP_0289 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08262 | COMP_0321 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08263 | COMP_0477 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08264 | COMP_0626 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08265 | COMP_0626 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08266 | COMP_0743 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08267 | COMP_0769 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08268 | COMP_0836 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08269 | COMP_0993 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08270 | COMP_0993 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08271 | COMP_0993 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08272 | COMP_1007 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08273 | COMP_1020 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08274 | COMP_1036 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08275 | COMP_1036 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08276 | COMP_1036 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08277 | COMP_1064 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08278 | COMP_1097 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08279 | COMP_1097 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08280 | COMP_1106 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08281 | COMP_1106 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08282 | COMP_1106 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08283 | COMP_1123 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08284 | COMP_1123 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08285 | COMP_1254 | 1 | UNKNOWN; do not use company currency as fallback |

| transactions.product_id | company_id | Affected records | Currency resolution |
| --- | --- | --- | --- |
| PRODUCT_08229 | COMP_1115 | 573 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08230 | COMP_0046 | 123 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08231 | COMP_0964 | 14 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08232 | COMP_0795 | 26 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08233 | COMP_0007 | 88 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08234 | COMP_0477 | 84 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08235 | COMP_0361 | 27 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08236 | COMP_0964 | 19 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08237 | COMP_0795 | 30 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08238 | COMP_0964 | 4 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08239 | COMP_0795 | 48 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08240 | COMP_0651 | 93 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08241 | COMP_0795 | 22 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08242 | COMP_0964 | 12 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08243 | COMP_0964 | 15 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08244 | COMP_0131 | 22 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08245 | COMP_1043 | 20 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08246 | COMP_0795 | 17 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08247 | COMP_0795 | 7 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08248 | COMP_0964 | 5 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08249 | COMP_0964 | 10 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08250 | COMP_0964 | 15 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08251 | COMP_0795 | 8 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08252 | COMP_0964 | 7 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08253 | COMP_0742 | 8 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08254 | COMP_0536 | 10 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08255 | COMP_0795 | 4 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08256 | COMP_1259 | 1 | UNKNOWN; do not use company currency as fallback |
| PRODUCT_08257 | COMP_0586 | 2 | UNKNOWN; do not use company currency as fallback |

| Schedule settlement_product_id absent from banking table | company_id | Resolves in debt_products? | Ownership matches if resolved |
| --- | --- | --- | --- |
| PRODUCT_06629 | COMP_0906 | yes | yes |
| PRODUCT_00662 | COMP_0965 | yes | yes |
| PRODUCT_00662 | COMP_0965 | yes | yes |
| PRODUCT_00662 | COMP_0965 | yes | yes |
| PRODUCT_08227 | COMP_1072 | no | unknown |
| PRODUCT_03534 | COMP_0471 | yes | yes |
| PRODUCT_05632 | COMP_0965 | yes | yes |
| PRODUCT_08228 | COMP_0770 | no | unknown |
| PRODUCT_05632 | COMP_0965 | yes | yes |
| PRODUCT_00662 | COMP_0965 | yes | yes |

### Currency policy and multi-currency identification

242 companies have transactions across multiple known product currencies; 261 have invoice documents across multiple explicit currencies; 393 have more than one known currency across products/transactions/invoices combined. Section 7 lists every company, every observed currency, counts, and multi-currency flags. A record has at most one inherited transaction currency, but 44,899 invoice records explicitly have different transaction and accounting currencies. 106,624 transaction records have an inherited currency unequal to company currency (including unresolved currency); 56,085 invoice currencies differ from company currency.

Each product row contains exactly one nonempty currency and each product_id is unique across the product union. Zero resolved product IDs have multiple observed assigned currencies in this extract; this does not prove that an account cannot be multi-currency in reality. There is no transaction-currency field to detect a foreign-currency leg within an account. The non-EUR account list in Section 8 identifies every excluded known product, with affected transaction counts; unresolved records are listed above. Do not infer an account currency from narrative, company currency, or a numeric exchange rate.

`transactions.exchange_rate` is non-unit on 10,312 EUR-product records and zero on 77 records overall; its direction, source currency, target currency, unit convention, and whether `amount` is already converted are unspecified. `invoices.exchange_rate` has 261 blanks and 3,389 zeros. Therefore do not multiply/divide any amount by exchange_rate. Recommend EUR-product-only transaction scoring, with the native-account-unit assumption explicitly provisional, and disclose excluded known non-EUR and unresolved records. Do not sum across currencies. Confidence must reflect material exclusions, not imply that an EUR slice represents the whole multi-currency company.

## 4. Actual transaction classifications and observed signs

The dictionary explicitly documents `amount < 0` as outgoing and `amount > 0` as incoming. Sign alone is not revenue/cost classification. `date` is booking date; `value_date` is value date. Proposed history is grouped by booking date. Categories are auto-assigned, not validated accounting labels; free text supplies fallible corroboration only.

| Exact category | All records | Positive | Negative | Zero | booked | pending | status empty | EUR booked banking, closed horizon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <empty> | 330 | 6 | 324 | 0 | 330 | 0 | 0 | 5 |
| - | 635530 | 224671 | 410614 | 245 | 613611 | 2659 | 19260 | 464120 |
| bulk_collection | 65492 | 65492 | 0 | 0 | 65488 | 4 | 0 | 60285 |
| bulk_payment | 41469 | 0 | 41469 | 0 | 41366 | 103 | 0 | 35442 |
| cash_settlement | 48280 | 48279 | 0 | 1 | 48145 | 28 | 107 | 43019 |
| cash_settlements | 90 | 90 | 0 | 0 | 90 | 0 | 0 | 90 |
| cash_withdrawal | 14096 | 0 | 14096 | 0 | 13910 | 5 | 181 | 11500 |
| collection | 567417 | 567376 | 29 | 12 | 561814 | 653 | 4950 | 479634 |
| collection_refund | 11848 | 277 | 11571 | 0 | 11836 | 12 | 0 | 11456 |
| debt_repayment | 23044 | 0 | 23044 | 0 | 22996 | 40 | 8 | 18291 |
| fee | 179500 | 71 | 179429 | 0 | 178114 | 29 | 1357 | 146796 |
| interest_charge | 7822 | 0 | 7822 | 0 | 7803 | 14 | 5 | 5193 |
| investment_deployment | 3923 | 0 | 3923 | 0 | 3917 | 6 | 0 | 3654 |
| investment_return | 3458 | 3458 | 0 | 0 | 3451 | 0 | 7 | 3081 |
| payment | 362276 | 0 | 362276 | 0 | 360394 | 867 | 1015 | 314262 |
| payment_refund | 3222 | 2232 | 990 | 0 | 3204 | 12 | 6 | 2932 |
| pos_settlement | 47315 | 47204 | 0 | 111 | 47256 | 59 | 0 | 43471 |
| pos_withdrawal | 7506 | 0 | 7506 | 0 | 7505 | 0 | 1 | 6806 |
| salary | 42223 | 0 | 42223 | 0 | 42063 | 48 | 112 | 34889 |
| social_security | 24158 | 0 | 24158 | 0 | 24122 | 36 | 0 | 21839 |
| tax | 55904 | 899 | 55005 | 0 | 55243 | 157 | 504 | 46125 |
| tax_refund | 2 | 2 | 0 | 0 | 2 | 0 | 0 | 2 |
| transfer | 152102 | 90723 | 61379 | 0 | 152077 | 24 | 1 | 124869 |
| utility | 259430 | 0 | 259430 | 0 | 255282 | 1823 | 2325 | 227507 |

| Economic class | Exact supporting fields / values | Proposed interpretation and ambiguity |
| --- | --- | --- |
| Operational receipt candidates | category in {collection, bulk_collection, pos_settlement}; amount > 0 | Provisional only: loans and own-account transfers occur in narratives even under collection. POS settlements can duplicate receipts in other accounts. No blanket all-credit revenue rule. |
| Operational payment candidates | category in {payment, bulk_payment, utility, salary, social_security, tax}; amount < 0 | Provisional: payment can contain capex, financing, transfers. Tax treatment is a stated cash-operating policy, not EBITDA accounting. |
| Collection returns / chargeback proxy | category = collection_refund AND amount < 0 | 11,571 all-source negative candidates; 277 positive records excluded/flagged as possible corrections. Category includes returns, not necessarily card chargebacks; no link to original collection. |
| Payment refunds | category = payment_refund | 2,232 positive, 990 negative. Do not mix them into chargebacks on customer receipts; original payment/reversal not linked. |
| Fees | category = fee AND amount < 0 | 179,429 negative; 71 positive possible refunds. Gross outgoing fee load can be observed as a proxy; netting positive fees requires linked evidence. |
| Interest | category = interest_charge AND amount < 0 | 7,822 negative; no positive observations. No principal/interest split within debt_repayment; fee narratives also contain interest. |
| Financing | category = debt_repayment; product.type in debt vocabulary; description loan/credit terms | Debt_repayment is 23,044 negative records; investment_deployment and investment_return are separate investing classes. No explicit loan-disbursement category. Debt-product origin alone does not prove financing: credit-line ledgers can contain operating payments. |
| Internal transfer candidates | category = transfer; description internal/traspaso terms; company_id/product_id for a potential two-leg check | 152,102 transfer records, both signs; not all transfers internal and internal-like narratives occur in collection/payment/salary. No own-account counterparty map, transfer-group ID, or reliable cross-account pair reference. Exclude transfer from operating proxies unless proven external. |
| Ambiguous cash/investment | cash_settlement, cash_settlements, cash_withdrawal, pos_withdrawal, investment_deployment, investment_return | Cash withdrawal/deposit may move money between own cash/accounts; investing returns need not be revenue. Exclude by default, not automatically operating. |
| Unclassified | category empty or literal - | 635,860 records total; preserve separate reasons. Do not derive financial income/cost from sign to fill the gap. |
| Reversals / sign anomalies | collection < 0; tax > 0; fee > 0; collection_refund > 0; payment_refund < 0 | Keep and flag. No explicit reversal linkage or reversal status; do not heuristically cancel equal amounts or turn all refunds into operating receipts. |

### Status and product scope

| Transaction status | Count | Proposed history filter |
| --- | --- | --- |
| booked | 2520019 | Include only after currency/scope/classification gates |
| pending | 6579 | Exclude as nonfinal; do not subtract from booked as if a linked reversal |
| <empty> | 29839 | Exclude/unknown, never assume booked |

| status | accounting_status | Records |
| --- | --- | --- |
| <empty> | <empty> | 24410 |
| <empty> | ACCOUNTING_COMPLETED | 32 |
| <empty> | ACCOUNTING_RECOMMENDATION | 48 |
| <empty> | DISCARDED | 2122 |
| <empty> | PENDING | 2508 |
| <empty> | RECONCILIATION_COMPLETED | 712 |
| <empty> | RECONCILIATION_RECOMMENDATION | 7 |
| booked | <empty> | 1544059 |
| booked | ACCOUNTING_COMPLETED | 30963 |
| booked | ACCOUNTING_RECOMMENDATION | 18016 |
| booked | DISCARDED | 306161 |
| booked | PENDING | 91892 |
| booked | RECONCILIATION_COMPLETED | 527309 |
| booked | RECONCILIATION_RECOMMENDATION | 1619 |
| pending | <empty> | 5400 |
| pending | DISCARDED | 285 |
| pending | PENDING | 881 |
| pending | RECONCILIATION_COMPLETED | 13 |

`accounting_status=DISCARDED` is an accounting/reconciliation state, not documented as a canceled cash posting. Do not use it instead of `status` or silently delete these 308,568 records. Current status is not an as-of status history. Recommended provisional cash scope: start with booked EUR checking-account records (`banking_products.type=checking`); widen to saving/cards/TPV/wallet/expensesPlatform or credit-line products only with explicit duplicate and funding-flow treatment. This is conservative but incomplete, not proof excluded records are nonoperating. The EUR booked banking coverage below is an **upper bound** before this checking-only/category policy, not a count of usable score observations.

| Banking product type | EUR booked records before 2026-09-01 |
| --- | --- |
| card | 70496 |
| checking | 2011422 |
| expensesPlatform | 5070 |
| lineofcomex | 26 |
| tpv | 17963 |
| wallet | 291 |

### Full-data narrative corroboration (diagnostic, not an implemented classifier)

Patterns are case-insensitive Python regexes over every `transactions.description`. Counts below are exact matches to those patterns, not validated economic labels; overlapping patterns are intentional. Word boundaries and accents are as written. This exposes ambiguity without reproducing bank narratives.

**chargeback** — 22,517 matching records. Pattern: `\b(chargebacks?|devoluci[oó]n|devoluciones|devuelto|devuelta|retrocesi[oó]n|retroceso|impagado|impagados|returned|return|refund|reversal|reversed|rechazado|rechazo)\b`. Exact category distribution: `-`: 3,215; `bulk_collection`: 196; `bulk_payment`: 27; `cash_settlement`: 121; `cash_withdrawal`: 33; `collection`: 3,415; `collection_refund`: 10,041; `debt_repayment`: 13; `fee`: 696; `interest_charge`: 390; `investment_deployment`: 7; `investment_return`: 23; `payment`: 855; `payment_refund`: 2,593; `pos_withdrawal`: 1; `salary`: 8; `tax`: 194; `tax_refund`: 2; `transfer`: 189; `utility`: 498.

**fee** — 146,174 matching records. Pattern: `\b(comisi[oó]n|comisiones|commission|commissions|fees?|gastos)\b`. Exact category distribution: `<empty>`: 316; `-`: 6,281; `bulk_collection`: 105; `bulk_payment`: 2,466; `cash_settlement`: 39; `cash_withdrawal`: 183; `collection`: 3,269; `collection_refund`: 33; `debt_repayment`: 3; `fee`: 115,404; `interest_charge`: 1,216; `investment_deployment`: 334; `investment_return`: 57; `payment`: 14,828; `payment_refund`: 265; `salary`: 153; `social_security`: 2; `tax`: 140; `transfer`: 377; `utility`: 703.

**interest** — 15,507 matching records. Pattern: `\b(intereses|inter[eé]s|interest)\b`. Exact category distribution: `-`: 7,504; `bulk_collection`: 98; `bulk_payment`: 83; `cash_settlement`: 66; `cash_settlements`: 14; `cash_withdrawal`: 20; `collection`: 1,969; `collection_refund`: 10; `debt_repayment`: 396; `fee`: 1,985; `interest_charge`: 2,172; `investment_return`: 11; `payment`: 221; `payment_refund`: 10; `pos_withdrawal`: 5; `salary`: 80; `tax`: 435; `transfer`: 17; `utility`: 411.

**financing** — 23,251 matching records. Pattern: `\b(pr[eé]stamo|pr[eé]stamos|loan|loans|cr[eé]dito|leasing|factoring|confirming|hipoteca|amortizaci[oó]n|financiaci[oó]n)\b`. Exact category distribution: `-`: 5,986; `bulk_collection`: 23; `bulk_payment`: 404; `cash_settlement`: 46; `collection`: 3,293; `collection_refund`: 19; `debt_repayment`: 3,703; `fee`: 703; `interest_charge`: 239; `investment_deployment`: 12; `investment_return`: 6; `payment`: 3,741; `payment_refund`: 15; `pos_settlement`: 12; `pos_withdrawal`: 2,540; `salary`: 19; `tax`: 161; `transfer`: 1,497; `utility`: 832.

**internal_transfer** — 186,086 matching records. Pattern: `\b(traspaso|traspasos|interno|interna|intercompany|own account|cuentas propias)\b`. Exact category distribution: `-`: 135; `bulk_collection`: 71; `bulk_payment`: 23; `cash_settlement`: 156; `cash_withdrawal`: 625; `collection`: 15,473; `collection_refund`: 12; `debt_repayment`: 7; `fee`: 229; `interest_charge`: 11; `investment_deployment`: 108; `investment_return`: 173; `payment`: 31,213; `payment_refund`: 8; `pos_withdrawal`: 1; `salary`: 6,188; `social_security`: 1; `tax`: 72; `transfer`: 131,400; `utility`: 180.

Notably 15,473 `collection` narratives and 31,213 `payment` narratives match internal-transfer terms; 3,293 `collection` narratives match financing terms. Neither observation proves those rows are internal/financing, but it prevents treating category labels as perfect. No false-positive rate can be estimated without labeled examples. Recommended classifier must emit primary class plus conflict/unknown flags and a stable rule ID; this audit supplies evidence, not a production classifier.

## 5. Calendar-month coverage, gaps, and trajectory constraints

### Calendar semantics and common scoring horizon

The global observed booking span is 2024-09-01 00:00:00–2026-09-01 23:37:04. Proposed shared calendar horizon is the 24 calendar months 2024-09–2026-08. Exclude September 2026 from closed-month comparisons: 9,242 transaction observations on September 1 alone are not a completed month. Do not choose the run date 2026-09-19 as a false data cutoff, and do not shift each company to its own latest month without disclosing stale/asynchronous comparisons.

An observed month means at least one source transaction, irrespective of amount; it does not mean transactions existed every day, every account is present, or bank ingestion is complete. The per-company matrix below spans the entire global calendar, with outside-span months explicit. `G` is an internal no-observation gap and `X` is outside that company's observed span; both are NULL/unknown, not zero monetary activity. An observed boundary month may be partially covered; transaction first/last dates alone cannot prove truncation or completeness. `B` marks possible boundary partial coverage where the company's first or last observation does not reach the calendar boundary; `P` marks the known extraction-partial September 2026 month; `O` marks other observed months, all completeness-unverified. Zero **verified complete** months for every company.

Proof of a genuine zero-transaction complete month would require full account roster and effective dates, bank statement/ingestion interval coverage, successful sync manifests, all pages/cursors consumed, and balance/statement reconciliation. None are supplied. Company/product onboarding dates are not substitute completeness evidence. No observation is never automatically a zero cash-flow month.

| Coverage cohort | Companies with observations | Company-months observed incl partial Sep | Company-months observed closed horizon | <6 months incl Sep | <6 closed-horizon observed months | Internal gap companies / months incl Sep | Internal gap companies / months closed horizon |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All-source, all-status | 1286 | 22179 | 21313 | 6 | 8 | 115 / 425 | 114 / 408 |
| EUR booked, product union | 1173 | 20162 | 19388 | 137 | 139 | 128 / 459 | 127 / 442 |
| EUR booked, banking only | 1170 | 20082 | 19320 | 142 | 144 | 132 / 483 | 131 / 466 |

| Cohort | Latest first observed month | Earliest last observed month | Common company-span intersection |
| --- | --- | --- | --- |
| All-source, all-status | 2026-05 | 2025-04 | EMPTY intersection |
| EUR booked, product union | 2026-07 | 2025-04 | EMPTY intersection |
| EUR booked, banking only | 2026-07 | 2025-04 | EMPTY intersection |

There is no universal common observed horizon; the shared calendar is a reporting frame, not evidence that every company can be scored. Monthly counts below exclude no source rows unless indicated and reconcile to the raw total.

| Month | All records | All-source companies observed | EUR booked union records | EUR booked banking records | EUR booked banking companies | Period status |
| --- | --- | --- | --- | --- | --- | --- |
| 2024-09 | 41975 | 439 | 38108 | 33741 | 406 | calendar closed; completeness unknown |
| 2024-10 | 49521 | 470 | 45270 | 40321 | 431 | calendar closed; completeness unknown |
| 2024-11 | 44730 | 476 | 39994 | 35895 | 433 | calendar closed; completeness unknown |
| 2024-12 | 48178 | 520 | 42485 | 38183 | 473 | calendar closed; completeness unknown |
| 2025-01 | 61961 | 648 | 55153 | 49744 | 598 | calendar closed; completeness unknown |
| 2025-02 | 61678 | 684 | 55652 | 50493 | 633 | calendar closed; completeness unknown |
| 2025-03 | 71859 | 717 | 65344 | 59271 | 664 | calendar closed; completeness unknown |
| 2025-04 | 77155 | 742 | 70611 | 63780 | 686 | calendar closed; completeness unknown |
| 2025-05 | 79439 | 762 | 72923 | 66092 | 702 | calendar closed; completeness unknown |
| 2025-06 | 83975 | 777 | 76028 | 69275 | 717 | calendar closed; completeness unknown |
| 2025-07 | 97619 | 829 | 89867 | 83050 | 767 | calendar closed; completeness unknown |
| 2025-08 | 85031 | 842 | 76811 | 71141 | 767 | calendar closed; completeness unknown |
| 2025-09 | 101442 | 890 | 92284 | 86248 | 817 | calendar closed; completeness unknown |
| 2025-10 | 110678 | 933 | 100329 | 93638 | 854 | calendar closed; completeness unknown |
| 2025-11 | 99263 | 960 | 89151 | 83106 | 869 | calendar closed; completeness unknown |
| 2025-12 | 114764 | 1019 | 102533 | 96043 | 918 | calendar closed; completeness unknown |
| 2026-01 | 130699 | 1153 | 115422 | 107427 | 1024 | calendar closed; completeness unknown |
| 2026-02 | 147951 | 1217 | 131187 | 114318 | 1081 | calendar closed; completeness unknown |
| 2026-03 | 182783 | 1223 | 164290 | 152625 | 1094 | calendar closed; completeness unknown |
| 2026-04 | 176180 | 1229 | 158016 | 147391 | 1101 | calendar closed; completeness unknown |
| 2026-05 | 166696 | 1216 | 148256 | 138536 | 1088 | calendar closed; completeness unknown |
| 2026-06 | 177661 | 1205 | 159543 | 148208 | 1078 | calendar closed; completeness unknown |
| 2026-07 | 185290 | 1199 | 164455 | 153221 | 1075 | calendar closed; completeness unknown |
| 2026-08 | 150667 | 1163 | 132950 | 123521 | 1044 | calendar closed; completeness unknown |
| 2026-09 | 9242 | 866 | 8254 | 7681 | 762 | partial extraction |

### Six-month trajectory and consecutive comparison endpoints

A latest-six-month descriptive trajectory ending August 2026 needs March–August 2026 observations, not merely any six lifetime months. Comparing August with February at a six-calendar-month lag requires seven endpoint-inclusive months if consecutive continuity is demanded. Comparing two disjoint six-month windows ending August needs September 2025–August 2026 (12 months); confirming the same pattern at July and August requires August 2025–August 2026 (13 months). These are explicitly different definitions; AGENT3 must use the one agreed with AGENT2. A single comparison is not persistence; missing endpoints reset/leave persistence unknown, never compress away gaps or count September 1 as a full comparison endpoint.

| Observation-only upper bound | All-source companies | EUR booked union companies | EUR booked banking companies |
| --- | --- | --- | --- |
| Latest six consecutive months: 2026-03..08 | 1127 | 1005 | 998 |
| Seven endpoint-inclusive months: 2026-02..08 | 1117 | 991 | 984 |
| Two disjoint six-month windows: 2025-09..2026-08 | 769 | 701 | 697 |
| Two consecutive rolling-window endpoints: 2025-08..2026-08 | 742 | 674 | 670 |

These are availability upper bounds, not valid score counts: component denominators, checking-account scope, classification, and completeness gates can further reduce them. Under a requirement for verified complete historical months, zero companies can currently establish any of these trajectories. A provisional observed-data trajectory must be explicitly labeled and carry uncertainty.

### August and December seasonal caution

August 2025 and August 2026, and December 2024 and December 2025, all contain observations (see exact monthly table). Their lower/higher counts or flows are potential seasonal effects, not proof. The sample composition and coverage change substantially by month; aggregate counts cannot establish company seasonality. There are at most two Augusts and two Decembers, not enough repeated cycles for confident company-specific seasonal adjustment. Flag these months for contextual review; do not automatically excuse declines, add a seasonal bonus, or change signs. No cross-currency monetary seasonal aggregate was computed.

### Complete explicit list of companies with fewer than six observed months

Union of all companies below six in either raw or EUR booked banking observations (closed horizon). The table also states full-span counts including partial September and EUR booked product-union counts. Numeric 0 here means zero **observed months**, not a zero-valued cash-flow month.

| company_id | Raw full span | Raw closed horizon | EUR booked union closed | EUR booked banking full span | EUR booked banking closed | Verified complete months |
| --- | --- | --- | --- | --- | --- | --- |
| COMP_0014 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0020 | 9 | 8 | 8 | 2 | 2 | 0 |
| COMP_0029 | 24 | 24 | 3 | 3 | 3 | 0 |
| COMP_0030 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0046 | 12 | 12 | 0 | 0 | 0 | 0 |
| COMP_0050 | 12 | 12 | 0 | 0 | 0 | 0 |
| COMP_0057 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0069 | 10 | 9 | 0 | 0 | 0 | 0 |
| COMP_0072 | 8 | 8 | 3 | 3 | 3 | 0 |
| COMP_0086 | 6 | 5 | 5 | 6 | 5 | 0 |
| COMP_0093 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0097 | 12 | 11 | 0 | 0 | 0 | 0 |
| COMP_0104 | 8 | 7 | 0 | 0 | 0 | 0 |
| COMP_0107 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0126 | 22 | 21 | 21 | 5 | 5 | 0 |
| COMP_0127 | 15 | 15 | 0 | 0 | 0 | 0 |
| COMP_0131 | 9 | 9 | 5 | 5 | 5 | 0 |
| COMP_0135 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0145 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0149 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0154 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0158 | 8 | 7 | 0 | 0 | 0 | 0 |
| COMP_0163 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0166 | 8 | 8 | 1 | 1 | 1 | 0 |
| COMP_0168 | 10 | 10 | 0 | 0 | 0 | 0 |
| COMP_0187 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0191 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0202 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0205 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0208 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0213 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0219 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0226 | 12 | 12 | 0 | 0 | 0 | 0 |
| COMP_0233 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0237 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0240 | 8 | 7 | 0 | 0 | 0 | 0 |
| COMP_0242 | 5 | 4 | 4 | 5 | 4 | 0 |
| COMP_0247 | 23 | 23 | 0 | 0 | 0 | 0 |
| COMP_0249 | 25 | 24 | 1 | 1 | 1 | 0 |
| COMP_0251 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0256 | 17 | 17 | 0 | 0 | 0 | 0 |
| COMP_0276 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0292 | 8 | 8 | 3 | 3 | 3 | 0 |
| COMP_0306 | 22 | 21 | 0 | 0 | 0 | 0 |
| COMP_0323 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0339 | 16 | 16 | 0 | 0 | 0 | 0 |
| COMP_0350 | 17 | 16 | 0 | 0 | 0 | 0 |
| COMP_0359 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0373 | 11 | 10 | 0 | 0 | 0 | 0 |
| COMP_0390 | 20 | 20 | 0 | 0 | 0 | 0 |
| COMP_0404 | 24 | 23 | 0 | 0 | 0 | 0 |
| COMP_0408 | 7 | 7 | 0 | 0 | 0 | 0 |
| COMP_0409 | 8 | 8 | 1 | 1 | 1 | 0 |
| COMP_0415 | 6 | 5 | 5 | 6 | 5 | 0 |
| COMP_0419 | 7 | 7 | 0 | 0 | 0 | 0 |
| COMP_0463 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0464 | 8 | 7 | 0 | 0 | 0 | 0 |
| COMP_0469 | 11 | 10 | 0 | 0 | 0 | 0 |
| COMP_0475 | 9 | 9 | 0 | 0 | 0 | 0 |
| COMP_0477 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0479 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0486 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0487 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0489 | 9 | 9 | 0 | 0 | 0 | 0 |
| COMP_0493 | 12 | 11 | 0 | 0 | 0 | 0 |
| COMP_0514 | 7 | 7 | 5 | 5 | 5 | 0 |
| COMP_0521 | 20 | 20 | 0 | 0 | 0 | 0 |
| COMP_0536 | 7 | 7 | 5 | 5 | 5 | 0 |
| COMP_0556 | 18 | 17 | 0 | 0 | 0 | 0 |
| COMP_0559 | 17 | 16 | 0 | 0 | 0 | 0 |
| COMP_0566 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0573 | 22 | 22 | 0 | 0 | 0 | 0 |
| COMP_0579 | 12 | 12 | 0 | 0 | 0 | 0 |
| COMP_0605 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0606 | 9 | 9 | 1 | 1 | 1 | 0 |
| COMP_0617 | 10 | 10 | 0 | 0 | 0 | 0 |
| COMP_0629 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0641 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0658 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0660 | 9 | 9 | 0 | 0 | 0 | 0 |
| COMP_0666 | 24 | 23 | 0 | 0 | 0 | 0 |
| COMP_0676 | 8 | 7 | 7 | 0 | 0 | 0 |
| COMP_0683 | 9 | 8 | 8 | 0 | 0 | 0 |
| COMP_0690 | 11 | 10 | 3 | 3 | 3 | 0 |
| COMP_0692 | 20 | 20 | 5 | 5 | 5 | 0 |
| COMP_0728 | 11 | 10 | 0 | 0 | 0 | 0 |
| COMP_0744 | 8 | 7 | 2 | 2 | 2 | 0 |
| COMP_0759 | 22 | 21 | 0 | 0 | 0 | 0 |
| COMP_0765 | 23 | 22 | 0 | 0 | 0 | 0 |
| COMP_0777 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0781 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0784 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0795 | 7 | 7 | 5 | 5 | 5 | 0 |
| COMP_0800 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0804 | 8 | 8 | 0 | 0 | 0 | 0 |
| COMP_0822 | 13 | 13 | 0 | 0 | 0 | 0 |
| COMP_0828 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_0830 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0836 | 16 | 16 | 0 | 0 | 0 | 0 |
| COMP_0848 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_0851 | 9 | 9 | 0 | 0 | 0 | 0 |
| COMP_0853 | 6 | 6 | 0 | 0 | 0 | 0 |
| COMP_0860 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_0880 | 14 | 13 | 0 | 0 | 0 | 0 |
| COMP_0900 | 8 | 7 | 0 | 0 | 0 | 0 |
| COMP_0906 | 9 | 9 | 9 | 0 | 0 | 0 |
| COMP_0938 | 13 | 13 | 0 | 0 | 0 | 0 |
| COMP_0959 | 18 | 18 | 0 | 0 | 0 | 0 |
| COMP_0961 | 22 | 22 | 2 | 2 | 2 | 0 |
| COMP_0965 | 5 | 4 | 4 | 5 | 4 | 0 |
| COMP_0966 | 19 | 19 | 0 | 0 | 0 | 0 |
| COMP_0971 | 7 | 7 | 0 | 0 | 0 | 0 |
| COMP_0990 | 11 | 10 | 0 | 0 | 0 | 0 |
| COMP_1003 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_1004 | 17 | 17 | 0 | 0 | 0 | 0 |
| COMP_1014 | 21 | 20 | 0 | 0 | 0 | 0 |
| COMP_1015 | 23 | 23 | 0 | 0 | 0 | 0 |
| COMP_1022 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_1023 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_1036 | 5 | 4 | 4 | 5 | 4 | 0 |
| COMP_1053 | 5 | 4 | 4 | 5 | 4 | 0 |
| COMP_1065 | 5 | 5 | 5 | 5 | 5 | 0 |
| COMP_1068 | 1 | 1 | 1 | 1 | 1 | 0 |
| COMP_1085 | 19 | 18 | 0 | 0 | 0 | 0 |
| COMP_1089 | 20 | 20 | 0 | 0 | 0 | 0 |
| COMP_1097 | 8 | 8 | 5 | 5 | 5 | 0 |
| COMP_1104 | 7 | 7 | 0 | 0 | 0 | 0 |
| COMP_1105 | 22 | 21 | 0 | 0 | 0 | 0 |
| COMP_1115 | 20 | 20 | 0 | 0 | 0 | 0 |
| COMP_1122 | 24 | 24 | 0 | 0 | 0 | 0 |
| COMP_1123 | 25 | 24 | 0 | 0 | 0 | 0 |
| COMP_1166 | 22 | 21 | 0 | 0 | 0 | 0 |
| COMP_1186 | 14 | 14 | 0 | 0 | 0 | 0 |
| COMP_1187 | 12 | 11 | 2 | 2 | 2 | 0 |
| COMP_1190 | 9 | 8 | 0 | 0 | 0 | 0 |
| COMP_1192 | 21 | 21 | 0 | 0 | 0 | 0 |
| COMP_1201 | 16 | 15 | 0 | 0 | 0 | 0 |
| COMP_1222 | 18 | 17 | 0 | 0 | 0 | 0 |
| COMP_1229 | 10 | 10 | 0 | 0 | 0 | 0 |
| COMP_1237 | 8 | 8 | 5 | 5 | 5 | 0 |
| COMP_1244 | 11 | 11 | 0 | 0 | 0 | 0 |
| COMP_1255 | 11 | 11 | 0 | 0 | 0 | 0 |
| COMP_1283 | 14 | 14 | 0 | 0 | 0 | 0 |
| COMP_1285 | 8 | 8 | 0 | 0 | 0 | 0 |

### Complete explicit internal gap list

Every gap month across each cohort's own first-to-last observed span, including partial September if it is a span endpoint. Months after an early end or before a late start are outside-span unknowns (`X`), not internal gaps; the matrix shows them. Blank list means none, not complete data. EUR union and banking lists differ because debt-linked records may create observations.

| company_id | Raw gaps | EUR booked union gaps | EUR booked banking gaps |
| --- | --- | --- | --- |
| COMP_0005 | 2025-03 | 2025-03 | 2025-03 |
| COMP_0028 | 2025-08, 2025-11, 2026-02, 2026-03, 2026-05, 2026-06 | 2025-08, 2025-11, 2026-02, 2026-03, 2026-05, 2026-06 | 2025-08, 2025-11, 2026-02, 2026-03, 2026-05, 2026-06 |
| COMP_0029 | none | 2026-05, 2026-07 | 2026-05, 2026-07 |
| COMP_0032 | 2025-08, 2025-09 | 2025-08, 2025-09 | 2025-08, 2025-09 |
| COMP_0042 | none | 2024-11, 2025-11, 2026-04, 2026-05 | 2024-11, 2025-11, 2026-04, 2026-05 |
| COMP_0055 | 2025-03, 2025-04, 2025-05 | 2025-03, 2025-04, 2025-05 | 2025-03, 2025-04, 2025-05 |
| COMP_0060 | 2025-11 | 2025-11 | 2025-11 |
| COMP_0066 | 2025-06, 2025-08, 2025-09, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | 2025-06, 2025-08, 2025-09, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | 2025-06, 2025-08, 2025-09, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 |
| COMP_0067 | 2025-04, 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-07 | 2025-04, 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-07 | 2025-04, 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-07 |
| COMP_0070 | none | 2026-06 | 2026-06 |
| COMP_0072 | none | 2026-06 | 2026-06 |
| COMP_0080 | 2025-08, 2025-11 | 2025-08, 2025-11 | 2025-08, 2025-11 |
| COMP_0086 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 |
| COMP_0090 | 2025-02, 2025-05, 2025-08, 2026-03 | 2025-02, 2025-05, 2025-08, 2026-03 | 2025-02, 2025-05, 2025-08, 2026-03 |
| COMP_0106 | 2025-10 | 2025-10 | 2025-10 |
| COMP_0120 | 2026-02, 2026-03 | 2026-02, 2026-03 | 2026-02, 2026-03 |
| COMP_0126 | none | none | 2025-03, 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01 |
| COMP_0127 | 2025-06, 2026-01, 2026-02, 2026-03 | none | none |
| COMP_0131 | 2026-05 | 2026-05 | 2026-05 |
| COMP_0133 | 2025-08, 2025-09, 2026-05, 2026-06, 2026-07 | 2025-08, 2025-09, 2026-05, 2026-06, 2026-07 | 2025-08, 2025-09, 2026-05, 2026-06, 2026-07 |
| COMP_0143 | 2024-12 | 2024-12 | 2024-12 |
| COMP_0146 | 2025-08, 2025-10 | 2025-08, 2025-10 | 2025-08, 2025-10 |
| COMP_0161 | 2026-07 | 2026-07 | 2026-07 |
| COMP_0178 | none | none | 2025-08, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-05, 2026-06 |
| COMP_0198 | 2024-11, 2024-12, 2026-03 | 2024-11, 2024-12, 2026-03 | 2024-11, 2024-12, 2026-03 |
| COMP_0215 | 2024-11, 2025-02, 2025-03, 2025-04, 2025-05, 2025-08, 2025-09 | 2024-11, 2025-02, 2025-03, 2025-04, 2025-05, 2025-08, 2025-09 | 2024-11, 2025-02, 2025-03, 2025-04, 2025-05, 2025-08, 2025-09 |
| COMP_0226 | 2026-05 | none | none |
| COMP_0242 | 2026-04, 2026-06 | 2026-04, 2026-06 | 2026-04, 2026-06 |
| COMP_0258 | 2025-09 | 2025-09 | 2025-09 |
| COMP_0261 | 2025-12 | 2025-12 | 2025-12 |
| COMP_0269 | 2025-01, 2025-07, 2025-08 | 2025-01, 2025-07, 2025-08 | 2025-01, 2025-07, 2025-08 |
| COMP_0274 | none | 2025-01 | 2025-01 |
| COMP_0284 | 2024-10, 2025-01, 2025-02, 2025-03, 2025-04, 2025-05, 2025-08, 2025-10, 2025-11, 2025-12 | 2024-10, 2025-01, 2025-02, 2025-03, 2025-04, 2025-05, 2025-08, 2025-10, 2025-11, 2025-12 | 2024-10, 2025-01, 2025-02, 2025-03, 2025-04, 2025-05, 2025-08, 2025-10, 2025-11, 2025-12 |
| COMP_0285 | 2024-12, 2025-02, 2025-03, 2025-04, 2026-06 | 2024-12, 2025-02, 2025-03, 2025-04, 2026-06 | 2024-12, 2025-02, 2025-03, 2025-04, 2026-06 |
| COMP_0292 | none | 2026-05, 2026-06 | 2026-05, 2026-06 |
| COMP_0294 | 2025-08, 2025-11, 2026-02, 2026-06 | 2025-08, 2025-11, 2026-02, 2026-06 | 2025-08, 2025-11, 2026-02, 2026-06 |
| COMP_0314 | none | 2024-11, 2025-12, 2026-01, 2026-02, 2026-04, 2026-05, 2026-06 | 2024-11, 2025-12, 2026-01, 2026-02, 2026-04, 2026-05, 2026-06 |
| COMP_0315 | 2025-02, 2025-07, 2025-10, 2025-11 | 2025-02, 2025-07, 2025-10, 2025-11 | 2025-02, 2025-07, 2025-10, 2025-11 |
| COMP_0326 | 2025-04, 2025-05 | 2025-04, 2025-05 | 2025-04, 2025-05 |
| COMP_0331 | 2025-06, 2025-07, 2025-09, 2025-12, 2026-03, 2026-04, 2026-06, 2026-07 | 2025-06, 2025-07, 2025-09, 2025-12, 2026-03, 2026-04, 2026-06, 2026-07 | 2025-06, 2025-07, 2025-09, 2025-12, 2026-03, 2026-04, 2026-06, 2026-07 |
| COMP_0337 | 2026-02, 2026-03 | 2026-02, 2026-03 | 2026-02, 2026-03 |
| COMP_0346 | 2025-11, 2025-12, 2026-02, 2026-03, 2026-05 | 2025-11, 2025-12, 2026-02, 2026-03, 2026-05 | 2025-11, 2025-12, 2026-02, 2026-03, 2026-05 |
| COMP_0355 | 2026-02 | 2026-02 | 2026-02 |
| COMP_0380 | 2025-06, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-06 | 2025-06, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-06 | 2025-06, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-06 |
| COMP_0386 | 2025-08, 2025-09, 2025-11, 2025-12 | 2025-08, 2025-09, 2025-11, 2025-12 | 2025-08, 2025-09, 2025-11, 2025-12 |
| COMP_0422 | 2025-08 | 2025-08 | 2025-08 |
| COMP_0440 | none | 2026-02 | 2026-02 |
| COMP_0450 | 2026-04 | 2026-04 | 2026-04 |
| COMP_0451 | 2024-10, 2024-12, 2025-04, 2025-07, 2025-09, 2026-01, 2026-03 | 2024-10, 2024-12, 2025-04, 2025-07, 2025-09, 2026-01, 2026-03 | 2024-10, 2024-12, 2025-04, 2025-07, 2025-09, 2026-01, 2026-03 |
| COMP_0492 | 2025-03, 2025-05, 2025-08, 2025-09 | 2025-03, 2025-05, 2025-08, 2025-09 | 2025-03, 2025-05, 2025-08, 2025-09 |
| COMP_0502 | 2025-08, 2025-10 | 2025-08, 2025-10 | 2025-08, 2025-10 |
| COMP_0503 | 2025-10, 2025-11, 2025-12, 2026-01 | 2025-10, 2025-11, 2025-12, 2026-01 | 2025-10, 2025-11, 2025-12, 2026-01 |
| COMP_0510 | 2025-06, 2026-02 | 2025-06, 2026-02 | 2025-06, 2026-02 |
| COMP_0520 | 2025-08 | 2025-08 | 2025-08 |
| COMP_0527 | 2025-02, 2025-03 | 2025-02, 2025-03 | 2025-02, 2025-03 |
| COMP_0528 | none | 2026-04 | 2026-04 |
| COMP_0529 | 2025-08, 2025-09, 2025-12, 2026-03 | 2025-08, 2025-09, 2025-12, 2026-03 | 2025-08, 2025-09, 2025-12, 2026-03 |
| COMP_0557 | 2025-06, 2025-12, 2026-02, 2026-06 | 2025-06, 2025-12, 2026-02, 2026-06 | 2025-06, 2025-12, 2026-02, 2026-06 |
| COMP_0560 | 2025-01 | 2025-01 | 2025-01 |
| COMP_0573 | 2025-12, 2026-06 | none | none |
| COMP_0579 | 2025-01, 2025-03, 2025-05, 2025-06, 2025-07, 2025-08, 2025-12, 2026-01, 2026-03, 2026-04, 2026-05 | none | none |
| COMP_0585 | 2024-10, 2024-11, 2025-01, 2025-04, 2025-05, 2025-06, 2025-07, 2025-10, 2026-05, 2026-07 | 2024-10, 2024-11, 2025-01, 2025-04, 2025-05, 2025-06, 2025-07, 2025-10, 2026-05, 2026-07 | 2024-10, 2024-11, 2025-01, 2025-04, 2025-05, 2025-06, 2025-07, 2025-10, 2026-05, 2026-07 |
| COMP_0593 | 2025-08 | 2025-08 | 2025-08 |
| COMP_0599 | 2026-03 | 2026-03 | 2026-03 |
| COMP_0606 | 2025-12 | none | none |
| COMP_0611 | 2024-11, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2026-05, 2026-06, 2026-07 | 2024-11, 2025-04, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2026-05, 2026-06, 2026-07 | 2024-11, 2025-04, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2026-05, 2026-06, 2026-07 |
| COMP_0618 | none | 2025-10, 2026-02 | 2025-10, 2026-02 |
| COMP_0625 | 2025-11, 2025-12, 2026-04 | 2025-11, 2025-12, 2026-04 | 2025-11, 2025-12, 2026-04 |
| COMP_0645 | 2025-05, 2025-08, 2026-05 | 2025-05, 2025-08, 2026-05 | 2025-05, 2025-08, 2026-05 |
| COMP_0650 | 2025-08 | 2025-08 | 2025-08 |
| COMP_0670 | 2024-11 | 2024-11 | 2024-11 |
| COMP_0690 | none | 2026-01 | 2026-01 |
| COMP_0692 | none | 2025-07, 2025-08, 2025-09, 2025-12, 2026-01 | 2025-07, 2025-08, 2025-09, 2025-12, 2026-01 |
| COMP_0704 | 2025-08, 2025-12 | 2025-08, 2025-12 | 2025-08, 2025-12 |
| COMP_0722 | 2025-02, 2025-03, 2025-04, 2025-06, 2025-09, 2025-10, 2025-11, 2025-12 | 2025-02, 2025-03, 2025-04, 2025-06, 2025-09, 2025-10, 2025-11, 2025-12 | 2025-02, 2025-03, 2025-04, 2025-06, 2025-09, 2025-10, 2025-11, 2025-12 |
| COMP_0723 | 2026-06 | 2026-06 | 2026-06 |
| COMP_0726 | 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03 | 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03 | 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03 |
| COMP_0729 | 2025-03, 2025-04, 2025-05, 2025-06 | 2025-03, 2025-04, 2025-05, 2025-06 | 2025-03, 2025-04, 2025-05, 2025-06 |
| COMP_0742 | 2026-01 | none | none |
| COMP_0743 | none | none | 2024-10 |
| COMP_0789 | 2024-10, 2024-12, 2025-01, 2025-04, 2025-06, 2025-07, 2025-09, 2025-10, 2025-12, 2026-01, 2026-02, 2026-03, 2026-05 | 2024-10, 2024-12, 2025-01, 2025-04, 2025-06, 2025-07, 2025-09, 2025-10, 2025-12, 2026-01, 2026-02, 2026-03, 2026-05 | 2024-10, 2024-12, 2025-01, 2025-04, 2025-06, 2025-07, 2025-09, 2025-10, 2025-12, 2026-01, 2026-02, 2026-03, 2026-05 |
| COMP_0790 | 2024-12, 2025-01, 2025-02, 2025-03, 2025-04, 2025-06, 2025-12 | 2024-12, 2025-01, 2025-02, 2025-03, 2025-04, 2025-06, 2025-12 | 2024-12, 2025-01, 2025-02, 2025-03, 2025-04, 2025-06, 2025-12 |
| COMP_0794 | 2024-11 | 2024-11 | 2024-11 |
| COMP_0799 | none | 2026-04, 2026-05 | 2026-04, 2026-05 |
| COMP_0818 | 2026-06 | 2026-06 | 2026-06 |
| COMP_0844 | 2025-02, 2025-11, 2026-01, 2026-04 | 2025-02, 2025-11, 2026-01, 2026-04 | 2025-02, 2025-11, 2026-01, 2026-04 |
| COMP_0853 | 2026-05 | none | none |
| COMP_0859 | 2024-10, 2025-03 | 2024-10, 2025-03 | 2024-10, 2025-03 |
| COMP_0863 | 2026-05 | 2026-05 | 2026-05 |
| COMP_0867 | 2025-08, 2025-11, 2026-01, 2026-05, 2026-06, 2026-07 | 2025-08, 2025-11, 2026-01, 2026-05, 2026-06, 2026-07 | 2025-08, 2025-11, 2026-01, 2026-05, 2026-06, 2026-07 |
| COMP_0869 | 2025-02, 2025-03 | 2025-02, 2025-03 | 2025-02, 2025-03 |
| COMP_0879 | 2025-04 | 2025-08, 2025-10, 2026-01, 2026-02, 2026-04, 2026-05 | 2025-08, 2025-10, 2026-01, 2026-02, 2026-04, 2026-05 |
| COMP_0883 | 2026-01, 2026-02, 2026-03 | 2026-01, 2026-02, 2026-03 | 2026-01, 2026-02, 2026-03 |
| COMP_0903 | 2026-07 | 2026-07 | 2026-07 |
| COMP_0917 | 2025-06, 2025-12, 2026-03, 2026-04, 2026-06 | 2025-06, 2025-12, 2026-03, 2026-04, 2026-06 | 2025-06, 2025-12, 2026-03, 2026-04, 2026-06 |
| COMP_0921 | none | 2026-03, 2026-04 | 2026-03, 2026-04 |
| COMP_0922 | 2026-02 | 2026-02 | 2026-02 |
| COMP_0925 | 2026-04 | 2026-04 | 2026-04 |
| COMP_0936 | 2025-11, 2025-12 | 2025-11, 2025-12 | 2025-11, 2025-12 |
| COMP_0949 | 2025-10, 2025-12 | 2025-10, 2025-12 | 2025-10, 2025-12 |
| COMP_0959 | 2025-04, 2025-05, 2025-06, 2025-07, 2025-08 | none | none |
| COMP_0961 | none | 2025-06, 2025-07, 2025-08, 2025-09 | 2025-06, 2025-07, 2025-08, 2025-09 |
| COMP_0968 | 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06 | 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06 | 2025-10, 2025-11, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06 |
| COMP_0981 | 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08 | 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08 | 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08 |
| COMP_0984 | none | 2025-03, 2026-03, 2026-05 | 2025-03, 2026-03, 2026-05 |
| COMP_1008 | none | 2025-05, 2026-06, 2026-07 | 2025-05, 2026-06, 2026-07 |
| COMP_1009 | 2025-03, 2025-06, 2025-08, 2026-03, 2026-06 | 2025-03, 2025-06, 2025-08, 2026-03, 2026-06 | 2025-03, 2025-06, 2025-08, 2026-03, 2026-06 |
| COMP_1017 | 2025-05 | 2025-05 | 2025-05 |
| COMP_1030 | 2025-05 | 2025-05 | 2025-05 |
| COMP_1032 | 2025-05, 2025-06, 2026-02, 2026-06 | 2025-05, 2025-06, 2026-02, 2026-06 | 2025-05, 2025-06, 2026-02, 2026-06 |
| COMP_1042 | 2024-10, 2024-11, 2024-12, 2025-05, 2025-06, 2025-07, 2025-08, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | 2024-10, 2024-11, 2024-12, 2025-05, 2025-06, 2025-07, 2025-08, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | 2024-10, 2024-11, 2024-12, 2025-05, 2025-06, 2025-07, 2025-08, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 |
| COMP_1051 | 2026-02, 2026-05 | 2026-02, 2026-05 | 2026-02, 2026-05 |
| COMP_1054 | 2025-06, 2025-08, 2025-09 | 2025-06, 2025-08, 2025-09 | 2025-06, 2025-08, 2025-09 |
| COMP_1065 | 2025-04, 2025-05, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | 2025-04, 2025-05, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | 2025-04, 2025-05, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 |
| COMP_1069 | 2025-02 | 2025-02 | 2025-02 |
| COMP_1071 | none | 2026-01, 2026-02, 2026-03 | 2026-01, 2026-02, 2026-03 |
| COMP_1073 | 2024-11, 2025-02, 2025-03, 2025-06, 2025-11, 2026-02, 2026-04, 2026-05 | 2024-11, 2025-02, 2025-03, 2025-06, 2025-11, 2026-02, 2026-04, 2026-05 | 2024-11, 2025-02, 2025-03, 2025-06, 2025-11, 2026-02, 2026-04, 2026-05 |
| COMP_1083 | none | 2025-12, 2026-01, 2026-02, 2026-03 | 2025-12, 2026-01, 2026-02, 2026-03 |
| COMP_1097 | none | 2026-04, 2026-05, 2026-07 | 2026-04, 2026-05, 2026-07 |
| COMP_1109 | 2025-12, 2026-01, 2026-02, 2026-08 | 2025-12, 2026-01, 2026-02, 2026-08 | 2025-12, 2026-01, 2026-02, 2026-08 |
| COMP_1119 | 2025-03 | 2025-03 | 2025-03 |
| COMP_1125 | 2026-02 | 2026-02 | 2026-02 |
| COMP_1128 | 2025-05 | 2025-05 | 2025-05 |
| COMP_1141 | none | 2026-05 | 2026-05 |
| COMP_1142 | 2025-06, 2025-12, 2026-01 | 2025-06, 2025-12, 2026-01 | 2025-06, 2025-12, 2026-01 |
| COMP_1144 | 2025-02, 2025-03, 2025-10 | 2025-02, 2025-03, 2025-10 | 2025-02, 2025-03, 2025-10 |
| COMP_1153 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 |
| COMP_1154 | 2026-02 | 2026-02 | 2026-02 |
| COMP_1159 | 2025-11 | 2025-11 | 2025-11 |
| COMP_1162 | none | 2026-03, 2026-04, 2026-06 | 2026-03, 2026-04, 2026-06 |
| COMP_1171 | 2024-10, 2024-11, 2024-12, 2025-01, 2025-03, 2025-04 | 2024-10, 2024-11, 2024-12, 2025-01, 2025-03, 2025-04 | 2024-10, 2024-11, 2024-12, 2025-01, 2025-03, 2025-04 |
| COMP_1191 | 2024-11, 2025-01, 2025-03 | 2024-11, 2025-01, 2025-03 | 2024-11, 2025-01, 2025-03 |
| COMP_1226 | 2024-11, 2024-12, 2025-02, 2025-05, 2025-06, 2025-08, 2025-09, 2025-11, 2025-12, 2026-05, 2026-06 | 2024-11, 2024-12, 2025-02, 2025-05, 2025-06, 2025-08, 2025-09, 2025-11, 2025-12, 2026-05, 2026-06 | 2024-11, 2024-12, 2025-02, 2025-05, 2025-06, 2025-08, 2025-09, 2025-11, 2025-12, 2026-05, 2026-06 |
| COMP_1230 | none | none | 2026-01, 2026-02, 2026-03, 2026-04 |
| COMP_1237 | 2025-10, 2025-11 | none | none |
| COMP_1245 | 2026-02, 2026-03 | 2026-02, 2026-03 | 2026-02, 2026-03 |
| COMP_1247 | 2025-08, 2026-05 | 2025-08, 2026-05 | 2025-08, 2026-05 |
| COMP_1251 | 2025-08, 2025-10, 2026-02, 2026-05 | 2025-08, 2025-10, 2026-02, 2026-05 | 2025-08, 2025-10, 2026-02, 2026-05 |
| COMP_1259 | 2026-02 | 2026-02 | 2026-02 |
| COMP_1265 | 2024-12, 2025-01, 2025-03, 2025-04, 2025-08, 2025-09, 2025-11 | 2024-12, 2025-01, 2025-03, 2025-04, 2025-08, 2025-09, 2025-11 | 2024-12, 2025-01, 2025-03, 2025-04, 2025-08, 2025-09, 2025-11 |
| COMP_1274 | 2025-03 | 2025-03 | 2025-03 |

### Complete company × calendar-month matrix

Each cell is `flag RAW/EUR_BANK_BOOKED`: raw exact transaction record count and exact EUR booked banking count. `N` in the EUR position means no eligible observations/NULL, not zero cash flow. `G` and `X` contain no source observations; no numeric monetary zero is imputed. Raw first/last dates are printed to make boundary judgments reproducible. The matrix includes all 1,286 company IDs, all 25 global calendar labels, and every source transaction. All verified-complete counts are zero. EUR union closed-month counts are included separately. All amounts and financial score values are intentionally absent.

| company_id | First booking day | Last booking day | Raw closed months | EUR union closed | EUR banking closed | 2024-09 | 2024-10 | 2024-11 | 2024-12 | 2025-01 | 2025-02 | 2025-03 | 2025-04 | 2025-05 | 2025-06 | 2025-07 | 2025-08 | 2025-09 | 2025-10 | 2025-11 | 2025-12 | 2026-01 | 2026-02 | 2026-03 | 2026-04 | 2026-05 | 2026-06 | 2026-07 | 2026-08 | 2026-09 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COMP_0001 | 2026-01-14 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O24/24 | O18/18 | O32/32 | O30/30 | O22/22 | O33/33 | O32/32 | P5/5 |
| COMP_0002 | 2024-09-02 | 2025-04-14 | 8 | 8 | 8 | B86/86 | O91/91 | O57/57 | O65/65 | O92/92 | O64/64 | O85/85 | B41/41 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0003 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B56/56 | O48/48 | O55/55 | O53/53 | O54/54 | O51/51 | O58/58 | O50/50 | P2/2 |
| COMP_0004 | 2025-12-27 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B38/38 | O242/223 | O258/238 | O325/307 | O250/233 | O232/212 | O241/220 | O267/242 | O220/202 | P15/13 |
| COMP_0005 | 2025-01-10 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | B10/10 | O1/1 | G | O3/3 | O3/3 | O9/9 | O7/7 | O6/6 | O15/15 | O12/12 | O11/11 | O8/8 | O15/15 | O7/7 | O14/14 | O12/12 | O11/11 | O10/10 | O10/10 | O7/7 | X |
| COMP_0006 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O79/79 | O73/73 | O14/14 | O13/13 | O14/14 | O10/10 | O8/8 | O11/11 | O10/9 | O11/11 | O10/10 | O13/13 | P1/1 |
| COMP_0007 | 2024-12-31 | 2026-09-01 | 21 | 21 | 20 | X | X | X | B1/N | O281/222 | O261/199 | O264/201 | O275/210 | O289/208 | O275/191 | O322/242 | O241/184 | O290/222 | O301/229 | O265/214 | O302/236 | O359/289 | O312/234 | O368/284 | O339/279 | O325/268 | O394/296 | O388/310 | O299/224 | P26/25 |
| COMP_0008 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O100/100 | O98/98 | O165/165 | O266/266 | O152/152 | O56/56 | O121/121 | O105/105 | O121/119 | O176/176 | O129/129 | O96/96 | P7/7 |
| COMP_0009 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B96/96 | O74/74 | O70/70 | O62/62 | O36/36 | O21/21 | O44/44 | O47/47 | O31/31 | O32/32 | O51/51 | O32/32 | O40/40 | O47/47 | O46/46 | O35/35 | O49/49 | O38/38 | O109/109 | O82/79 | O47/46 | O48/48 | O49/47 | O30/30 | P3/3 |
| COMP_0010 | 2024-09-04 | 2026-08-31 | 24 | 24 | 24 | B10/10 | O12/12 | O9/9 | O11/11 | O13/13 | O8/8 | O9/9 | O10/10 | O10/10 | O8/8 | O15/15 | O7/7 | O9/9 | O12/12 | O8/8 | O12/12 | O10/10 | O5/5 | O9/9 | O13/13 | O5/5 | O8/8 | O22/22 | O5/5 | X |
| COMP_0011 | 2025-12-22 | 2026-08-31 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B15/15 | O17/17 | O13/13 | O11/11 | O23/21 | O7/7 | O5/5 | O7/7 | O7/7 | X |
| COMP_0012 | 2025-08-28 | 2026-08-29 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O1/1 | O1/1 | O1/1 | O9/9 | O16/16 | O11/11 | O16/16 | O23/23 | O14/14 | O14/14 | O22/22 | B19/19 | X |
| COMP_0013 | 2025-12-31 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O91/91 | O124/124 | O111/111 | O87/87 | O84/84 | O90/90 | O108/108 | O88/88 | P3/3 |
| COMP_0014 | 2026-01-02 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B225/N | O220/N | O286/N | O321/N | O300/N | O383/N | O500/N | O506/N | P17/N |
| COMP_0015 | 2025-04-01 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | O3/3 | O2/2 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O3/3 | O1/1 | O1/1 | O3/3 | O1/1 | O1/1 | O2/2 | O1/1 | P1/1 |
| COMP_0016 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B27/27 | O23/23 | O28/28 | O36/36 | O32/32 | O11/11 | O25/25 | O23/23 | O32/32 | O28/28 | O30/30 | O23/23 | O19/19 | O27/27 | O22/22 | O24/24 | O23/23 | O29/29 | O22/22 | O28/28 | O45/45 | O85/85 | O34/34 | O58/58 | P3/3 |
| COMP_0017 | 2025-03-21 | 2026-08-26 | 18 | 18 | 18 | X | X | X | X | X | X | B4/4 | O9/9 | O11/11 | O3/3 | O5/5 | O3/3 | O2/2 | O5/5 | O3/3 | O3/3 | O4/4 | O4/4 | O4/4 | O5/5 | O4/4 | O1/1 | O2/2 | B2/2 | X |
| COMP_0018 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B16/16 | O15/15 | O37/37 | O17/17 | O11/11 | O29/29 | O15/15 | O13/13 | O15/15 | O7/7 | O18/18 | O19/19 | O7/7 | O5/5 | O26/26 | O7/7 | O10/10 | O9/9 | O13/13 | O7/7 | O16/16 | O8/8 | O11/11 | O6/6 | P3/3 |
| COMP_0019 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B339/324 | O443/443 | O359/347 | O362/340 | O296/296 | O405/388 | O452/419 | O321/321 | O276/257 | O334/312 | O348/348 | O320/320 | O344/344 | O337/337 | O282/282 | O347/347 | O191/191 | O252/252 | O282/282 | O239/239 | O191/191 | O161/161 | O187/187 | O116/116 | P7/7 |
| COMP_0020 | 2026-01-01 | 2026-09-01 | 8 | 8 | 2 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O12/N | O24/N | O32/N | O61/N | O84/1 | O53/1 | O22/N | O9/N | P9/N |
| COMP_0021 | 2026-02-06 | 2026-08-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/13 | O12/12 | O9/9 | O9/9 | O15/15 | O24/24 | O19/19 | X |
| COMP_0022 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O320/320 | O202/202 | O206/206 | O213/213 | O209/209 | O215/215 | O238/238 | O223/223 | O260/260 | O369/369 | O356/356 | O364/364 | O349/349 | O197/197 | O201/201 | O214/194 | O194/194 | O186/186 | O193/193 | O219/219 | O281/281 | O569/569 | O546/546 | O682/682 | P10/10 |
| COMP_0023 | 2025-03-31 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B6/6 | O139/139 | O130/130 | O129/129 | O158/158 | O105/105 | O133/133 | O150/150 | O130/130 | O159/159 | O177/177 | O101/101 | O188/188 | O173/173 | O134/134 | O137/137 | O150/150 | O139/139 | P6/6 |
| COMP_0024 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B74/74 | O68/68 | O67/67 | O97/97 | O138/138 | O112/112 | O140/140 | O86/86 | O103/103 | O140/140 | O153/153 | O130/130 | O113/113 | O128/128 | O137/137 | O113/113 | O114/114 | O108/108 | O152/152 | O106/106 | P3/3 |
| COMP_0025 | 2025-06-09 | 2026-09-01 | 15 | 12 | 12 | X | X | X | X | X | X | X | X | X | B40/N | O43/N | O44/N | O61/2 | O74/2 | O50/2 | O54/2 | O68/2 | O55/2 | O69/2 | O79/4 | O59/2 | O72/2 | O67/2 | O54/2 | P3/N |
| COMP_0026 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B66/66 | O80/80 | O92/92 | O80/80 | O69/69 | O78/78 | O93/93 | O81/81 | P13/13 |
| COMP_0027 | 2026-01-07 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B39/39 | O45/45 | O103/103 | O180/176 | O179/174 | O202/198 | O218/213 | O167/166 | P14/14 |
| COMP_0028 | 2024-09-07 | 2026-07-24 | 17 | 17 | 17 | B4/4 | O5/5 | O3/3 | O3/3 | O2/2 | O2/2 | O2/2 | O4/4 | O2/2 | O1/1 | O1/1 | G | O1/1 | O1/1 | G | O1/1 | O1/1 | G | G | O3/3 | G | G | B2/2 | X | X |
| COMP_0029 | 2024-09-05 | 2026-08-25 | 24 | 3 | 3 | B23/N | O12/N | O16/N | O24/N | O10/N | O8/N | O7/N | O7/N | O18/N | O28/N | O7/N | O7/N | O7/N | O49/N | O22/N | O10/N | O26/N | O7/N | O6/N | O7/2 | O3/N | O6/1 | O14/N | B8/3 | X |
| COMP_0030 | 2024-09-05 | 2026-08-31 | 24 | 0 | 0 | B2/N | O1/N | O179/N | O191/N | O224/N | O195/N | O213/N | O249/N | O107/N | O177/N | O215/N | O188/N | O215/N | O209/N | O218/N | O206/N | O212/N | O158/N | O197/N | O168/N | O163/N | O104/N | O221/N | O198/N | X |
| COMP_0031 | 2025-11-07 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O1/1 | O306/306 | O438/438 | O515/515 | O475/475 | O666/666 | O805/805 | O821/821 | O890/890 | P44/44 |
| COMP_0032 | 2024-10-01 | 2026-01-01 | 14 | 14 | 14 | X | O3/3 | O1/1 | O3/3 | O5/5 | O1/1 | O2/2 | O4/4 | O1/1 | O3/3 | O2/2 | G | G | O1/1 | O1/1 | O2/2 | B2/2 | X | X | X | X | X | X | X | X |
| COMP_0033 | 2025-10-19 | 2026-06-17 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | B53/53 | O97/97 | O88/88 | O92/92 | O121/121 | O95/95 | O89/89 | O98/98 | B59/59 | X | X | X |
| COMP_0034 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B78/78 | O213/213 | O205/205 | O251/251 | O231/231 | O194/194 | O328/328 | O363/363 | O377/377 | O408/408 | O395/395 | O403/403 | O408/408 | O385/385 | O386/386 | O421/421 | O429/429 | O382/382 | P32/32 |
| COMP_0035 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B4/3 | O6/6 | O3/2 | O8/5 | O7/4 | O7/4 | O5/2 | O2/2 | O5/3 | O7/4 | O9/6 | O3/3 | O2/2 | O6/6 | O5/5 | O3/3 | O5/5 | O5/5 | O5/5 | O8/8 | O4/4 | O3/3 | O9/9 | O2/2 | X |
| COMP_0036 | 2025-01-20 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B19/19 | O70/70 | O63/63 | O55/55 | O72/72 | O61/61 | O53/53 | O74/74 | O61/61 | O70/70 | O47/47 | O51/51 | O59/59 | O63/63 | O62/62 | O49/49 | O55/55 | O56/56 | O63/63 | O63/63 | P5/5 |
| COMP_0037 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B11/11 | O7/7 | O11/11 | O11/11 | O8/8 | O10/10 | O16/16 | O10/10 | O26/26 | O27/27 | O32/32 | O45/45 | O40/40 | O52/52 | O49/49 | O44/44 | O46/46 | O43/43 | O42/42 | O30/30 | P4/4 |
| COMP_0038 | 2026-01-15 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B15/15 | O95/93 | O190/190 | O200/188 | O179/171 | O217/194 | O247/215 | O220/158 | P9/8 |
| COMP_0039 | 2024-09-05 | 2026-08-31 | 24 | 24 | 24 | B15/15 | O14/14 | O15/15 | O14/14 | O14/14 | O14/14 | O16/16 | O17/17 | O22/22 | O28/28 | O30/30 | O15/15 | O14/14 | O16/16 | O14/14 | O17/17 | O15/15 | O16/16 | O18/18 | O17/17 | O18/18 | O20/20 | O21/21 | O16/16 | X |
| COMP_0040 | 2026-01-12 | 2026-07-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O8/8 | O13/13 | O14/14 | O10/10 | O17/17 | O10/10 | X | X |
| COMP_0041 | 2025-12-29 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O30/30 | O37/37 | O37/37 | O47/47 | O46/46 | O56/56 | O66/66 | O39/39 | P4/4 |
| COMP_0042 | 2024-09-03 | 2026-09-01 | 24 | 18 | 18 | B173/1 | O153/1 | O165/N | O143/1 | O151/5 | O159/2 | O162/1 | O144/1 | O185/3 | O116/1 | O181/1 | O129/1 | O168/1 | O163/2 | O154/N | O157/6 | O162/3 | O148/1 | O165/6 | O150/N | O64/N | O69/1 | O57/N | O50/N | P1/N |
| COMP_0043 | 2025-12-29 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B14/14 | O218/217 | O227/226 | O213/210 | O245/245 | O174/168 | O166/162 | O183/158 | O148/131 | P12/12 |
| COMP_0044 | 2026-01-07 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B48/48 | O39/39 | O45/45 | O51/51 | O37/37 | O43/43 | O55/55 | O31/31 | X |
| COMP_0045 | 2026-01-26 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O6/6 | O34/34 | O22/22 | O34/34 | O30/30 | O30/30 | O29/29 | P1/1 |
| COMP_0046 | 2025-08-21 | 2026-07-10 | 12 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B3/N | O7/N | O7/N | O7/N | O6/N | O6/N | O8/N | O17/N | O14/N | O20/N | O18/N | B10/N | X | X |
| COMP_0047 | 2025-01-01 | 2026-07-05 | 19 | 19 | 19 | X | X | X | X | O175/175 | O251/251 | O224/224 | O191/191 | O186/186 | O200/200 | O231/231 | O163/163 | O158/158 | O193/192 | O158/158 | O156/156 | O199/198 | O140/140 | O163/163 | O166/166 | O148/148 | O134/133 | B46/46 | X | X |
| COMP_0048 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B45/6 | O71/31 | O86/31 | O129/27 | O97/28 | O109/9 | O105/14 | O93/10 | P4/N |
| COMP_0049 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O154/85 | O173/121 | O141/71 | O169/121 | O133/85 | O163/109 | O244/183 | O154/102 | O214/171 | O184/135 | O121/67 | O124/80 | O111/66 | O97/49 | O105/65 | O99/50 | O90/48 | O89/38 | O125/67 | O81/37 | P10/4 |
| COMP_0050 | 2025-09-08 | 2026-08-25 | 12 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | B8/N | O11/N | O22/N | O20/N | O10/N | O25/N | O10/N | O13/N | O8/N | O6/N | O5/N | B4/N | X |
| COMP_0051 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B69/47 | O47/43 | O59/40 | O60/59 | O63/61 | O39/35 | O59/53 | O56/53 | O66/54 | O81/73 | O64/57 | O59/56 | O93/90 | O115/100 | O130/118 | O106/89 | O87/83 | O109/98 | O146/131 | O166/158 | O167/144 | O159/103 | O136/100 | O110/85 | P6/6 |
| COMP_0052 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B16/16 | O16/16 | O15/15 | O19/19 | O16/16 | O15/15 | O20/20 | O14/14 | O18/18 | O23/23 | O18/18 | O7/7 | O12/12 | O16/16 | O10/10 | O24/24 | O18/18 | O15/15 | O19/19 | O25/25 | O20/20 | O15/15 | O24/24 | O9/9 | P1/1 |
| COMP_0053 | 2026-01-02 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B25/25 | O19/19 | O14/14 | O20/20 | O14/14 | O26/26 | O25/25 | O16/16 | X |
| COMP_0054 | 2025-02-04 | 2026-08-28 | 19 | 19 | 19 | X | X | X | X | X | B64/64 | O118/118 | O25/25 | O36/36 | O89/89 | O59/59 | O12/12 | O94/94 | O46/46 | O48/48 | O81/81 | O57/57 | O18/18 | O86/86 | O18/18 | O89/89 | O88/88 | O49/49 | B40/40 | X |
| COMP_0055 | 2025-02-01 | 2026-05-31 | 13 | 13 | 13 | X | X | X | X | X | O2/2 | G | G | G | O7/7 | O12/12 | O8/8 | O9/9 | O12/12 | O8/8 | O18/18 | O24/24 | O114/114 | O271/252 | O53/41 | O13/5 | X | X | X | X |
| COMP_0056 | 2025-11-24 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O7/7 | O25/25 | O15/15 | O29/29 | O35/34 | O16/16 | O25/25 | O60/60 | O19/19 | P3/3 |
| COMP_0057 | 2026-01-19 | 2026-08-18 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B20/N | O51/N | O41/N | O53/N | O54/N | O56/N | O67/N | B34/N | X |
| COMP_0058 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B78/78 | O514/511 | O757/751 | O714/688 | O710/676 | O809/781 | O667/645 | O699/679 | P58/57 |
| COMP_0059 | 2024-09-14 | 2026-09-01 | 24 | 24 | 24 | B1/1 | O8/8 | O4/4 | O36/25 | O61/37 | O46/32 | O57/37 | O57/47 | O66/50 | O53/43 | O57/42 | O45/36 | O59/46 | O51/44 | O47/10 | O47/6 | O45/7 | O41/3 | O35/3 | O50/5 | O41/9 | O40/10 | O40/7 | O20/1 | P1/N |
| COMP_0060 | 2024-09-02 | 2026-04-29 | 19 | 19 | 19 | B9/9 | O15/15 | O6/6 | O24/24 | O7/7 | O6/6 | O1/1 | O7/7 | O4/4 | O2/2 | O14/14 | O2/2 | O2/2 | O4/4 | G | O4/4 | O2/2 | O2/2 | O4/4 | B4/4 | X | X | X | X | X |
| COMP_0061 | 2025-11-27 | 2026-07-24 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B156/156 | O203/203 | O155/155 | O149/149 | O344/344 | O392/392 | O389/389 | O186/186 | B113/113 | X | X |
| COMP_0062 | 2025-01-02 | 2026-04-30 | 16 | 16 | 16 | X | X | X | X | B64/64 | O41/41 | O80/80 | O71/71 | O61/61 | O90/90 | O93/93 | O42/42 | O65/65 | O73/73 | O59/59 | O72/72 | O42/42 | O27/27 | O46/46 | O23/23 | X | X | X | X | X |
| COMP_0063 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O153/153 | O124/124 | O123/123 | O136/136 | O162/162 | O129/129 | P12/12 |
| COMP_0064 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B67/67 | O47/47 | O72/72 | O46/46 | O51/51 | O37/37 | O54/54 | O29/29 | P1/1 |
| COMP_0065 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B20/20 | O51/51 | O40/40 | O51/51 | O45/45 | O62/62 | O33/33 | O28/28 | O13/13 | O13/13 | O50/50 | O35/35 | O106/105 | O67/65 | O57/57 | O55/55 | O43/43 | O35/34 | O60/60 | O65/65 | O49/48 | O61/61 | O53/53 | O44/44 | X |
| COMP_0066 | 2024-11-15 | 2026-07-06 | 13 | 13 | 13 | X | X | B4/4 | O7/7 | O30/30 | O32/32 | O8/8 | O37/37 | O10/10 | G | O2/2 | G | G | O1/1 | O4/4 | G | G | G | G | G | O4/4 | O10/10 | B2/2 | X | X |
| COMP_0067 | 2025-03-27 | 2026-08-18 | 11 | 11 | 11 | X | X | X | X | X | X | B1/1 | G | O1/1 | O2/2 | O1/1 | O2/2 | O3/3 | G | G | O7/7 | G | G | G | O2/2 | O1/1 | O2/2 | G | B3/3 | X |
| COMP_0068 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B118/118 | O139/139 | O109/109 | O128/128 | O121/121 | O90/90 | O134/134 | O108/108 | O112/112 | O110/110 | O118/118 | O73/73 | O122/122 | O110/110 | O105/105 | O117/117 | O106/106 | O97/97 | O133/133 | O105/105 | O109/109 | O133/133 | O150/150 | O108/108 | P17/17 |
| COMP_0069 | 2025-12-30 | 2026-09-01 | 9 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/N | O65/N | O127/N | O121/N | O217/N | O93/N | O426/N | O864/N | O463/N | P6/N |
| COMP_0070 | 2025-09-21 | 2026-07-16 | 11 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | B115/113 | O415/411 | O509/501 | O497/494 | O478/472 | O461/459 | O616/612 | O565/561 | O246/246 | O1/N | B1/1 | X | X |
| COMP_0071 | 2024-12-10 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O2/2 | O5/1 | O5/2 | O7/4 | O12/3 | O8/2 | O15/7 | O4/3 | O7/5 | O7/4 | O19/15 | O23/11 | O10/8 | O15/10 | O14/9 | O19/10 | O12/10 | O9/7 | O15/11 | O8/5 | P1/1 |
| COMP_0072 | 2026-01-20 | 2026-08-28 | 8 | 3 | 3 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/N | O10/N | O8/N | O6/1 | O12/1 | O11/N | O9/2 | B5/N | X |
| COMP_0073 | 2024-09-23 | 2026-09-01 | 24 | 24 | 24 | B2/2 | O9/9 | O4/4 | O24/19 | O75/39 | O35/23 | O63/36 | O43/28 | O36/20 | O36/26 | O51/34 | O41/28 | O54/34 | O40/24 | O40/10 | O49/5 | O48/5 | O39/3 | O46/4 | O56/9 | O40/4 | O39/4 | O49/6 | O34/3 | P3/N |
| COMP_0074 | 2025-01-17 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B174/61 | O355/154 | O367/165 | O407/152 | O451/154 | O354/159 | O415/204 | O348/172 | O372/176 | O418/198 | O348/166 | O376/162 | O336/155 | O338/149 | O375/171 | O399/195 | O396/190 | O438/206 | O456/206 | O349/170 | P22/13 |
| COMP_0075 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O137/135 | O168/161 | O116/107 | O94/93 | O126/123 | O99/97 | O133/130 | O162/160 | O147/144 | O159/158 | O158/158 | O140/140 | O142/142 | O168/168 | O160/160 | O95/95 | O118/118 | O116/116 | O141/141 | O172/170 | O149/149 | O180/180 | O181/179 | O172/170 | P17/15 |
| COMP_0076 | 2024-09-24 | 2026-08-31 | 24 | 24 | 24 | B3/2 | O3/3 | O3/3 | O5/3 | O5/3 | O5/3 | O5/3 | O5/3 | O7/5 | O5/3 | O5/3 | O5/4 | O8/5 | O7/5 | O8/6 | O3/1 | O8/6 | O4/3 | O3/2 | O2/2 | O7/7 | O3/2 | O6/5 | O4/4 | X |
| COMP_0077 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O10/10 | O11/11 | O10/10 | O17/17 | O16/16 | O8/8 | O7/7 | O11/11 | O10/10 | O7/7 | O10/10 | O10/10 | O7/7 | O10/10 | O23/23 | O27/27 | O17/17 | O9/9 | O12/12 | O17/17 | O10/10 | O12/12 | O15/15 | O9/9 | P1/1 |
| COMP_0078 | 2026-01-01 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O1/N | O19/17 | O50/50 | O31/31 | O44/44 | O33/33 | O90/84 | O50/48 | P5/5 |
| COMP_0079 | 2025-12-29 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B40/3 | O86/11 | O276/159 | O328/202 | O277/166 | O277/159 | O312/173 | O339/205 | O249/148 | P23/17 |
| COMP_0080 | 2025-03-24 | 2026-05-22 | 13 | 13 | 13 | X | X | X | X | X | X | B1/1 | O12/12 | O2/2 | O3/3 | O4/4 | G | O3/3 | O12/12 | G | O16/16 | O2/2 | O3/3 | O5/5 | O18/18 | B2/2 | X | X | X | X |
| COMP_0081 | 2025-02-06 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B28/28 | O37/37 | O59/59 | O43/43 | O76/76 | O89/89 | O12/12 | O70/70 | O70/70 | O67/67 | O106/106 | O155/155 | O21/21 | O140/140 | O22/22 | O91/91 | O82/82 | O74/74 | O73/73 | X |
| COMP_0082 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B96/96 | O371/371 | O474/474 | O471/471 | O427/427 | O392/392 | O425/425 | O500/500 | O416/416 | O460/460 | O511/511 | O470/470 | O563/563 | O482/482 | O494/494 | O418/418 | O556/556 | O439/439 | P28/28 |
| COMP_0083 | 2026-01-31 | 2026-08-25 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O7/7 | O6/6 | O7/7 | O6/6 | O4/4 | O2/2 | B6/6 | X |
| COMP_0084 | 2026-02-19 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B45/45 | O98/98 | O81/81 | O88/88 | O95/95 | O112/112 | O92/92 | P4/4 |
| COMP_0085 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B60/60 | O26/26 | O31/31 | O31/31 | O33/33 | O42/42 | O81/81 | O20/20 | O21/21 | O18/18 | O50/50 | O25/25 | O38/38 | O38/38 | O22/22 | O15/15 | O35/35 | O37/37 | O34/34 | O42/42 | O44/44 | O36/36 | O40/40 | O43/43 | P2/2 |
| COMP_0086 | 2025-09-01 | 2026-09-01 | 5 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | O209/209 | G | G | G | G | G | G | G | O17/17 | O113/113 | O208/208 | O103/103 | P7/7 |
| COMP_0087 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O141/141 | O149/149 | O95/95 | O143/143 | O153/153 | O105/105 | O135/135 | O135/135 | O159/159 | O266/266 | O145/145 | O191/191 | O224/224 | O191/191 | O161/161 | O233/233 | O212/212 | O179/179 | O174/174 | O149/149 | O178/178 | O175/174 | O149/149 | O131/131 | P23/23 |
| COMP_0088 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B35/35 | O150/150 | O148/148 | O174/174 | O188/188 | O91/91 | O106/106 | O114/114 | O89/89 | O104/104 | O96/96 | O80/80 | O110/110 | O100/100 | O74/74 | O103/103 | O108/108 | O78/78 | P9/9 |
| COMP_0089 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B48/48 | O46/46 | O45/45 | O34/34 | O44/44 | O45/45 | O51/51 | O51/51 | O37/37 | O34/34 | O37/37 | O34/34 | O33/33 | O42/42 | O30/30 | O29/29 | O37/35 | O32/32 | O32/32 | O54/54 | O29/29 | O32/32 | O74/74 | O16/16 | X |
| COMP_0090 | 2024-09-02 | 2026-08-14 | 20 | 20 | 20 | B5/5 | O11/11 | O3/3 | O1/1 | O7/7 | G | O8/8 | O13/13 | G | O7/7 | O10/10 | G | O2/2 | O6/6 | O3/3 | O3/3 | O6/6 | O3/3 | G | O6/6 | O6/6 | O2/2 | O4/4 | B5/5 | X |
| COMP_0091 | 2025-05-02 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B54/54 | O54/54 | O57/57 | O49/49 | O58/58 | O69/69 | O54/54 | O69/69 | O65/65 | O48/48 | O69/69 | O60/60 | O57/57 | O53/53 | O60/60 | O49/49 | P4/4 |
| COMP_0092 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B33/33 | O31/31 | O30/30 | O32/32 | O34/34 | O25/25 | O30/30 | O28/28 | O27/27 | O26/26 | O28/28 | O28/28 | O33/33 | O29/29 | O21/21 | O29/29 | O27/27 | O25/25 | O36/36 | O27/27 | O24/24 | O33/33 | O27/27 | O27/27 | X |
| COMP_0093 | 2025-12-19 | 2026-07-20 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O10/N | O16/N | O21/N | O11/N | O24/N | O20/N | B20/N | X | X |
| COMP_0094 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B79/54 | O89/68 | O74/59 | O73/57 | O87/57 | O79/54 | O97/75 | O98/75 | O67/55 | O98/69 | O104/64 | O54/35 | O78/64 | O97/71 | O87/67 | O89/63 | O89/76 | O64/48 | O80/61 | O84/74 | O73/60 | O83/59 | O98/72 | O68/50 | P8/2 |
| COMP_0095 | 2025-11-19 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O12/12 | O20/20 | O19/19 | O20/20 | O33/33 | O25/25 | O14/14 | O27/27 | O18/18 | P2/2 |
| COMP_0096 | 2025-02-11 | 2026-08-25 | 19 | 19 | 19 | X | X | X | X | X | B5/5 | O15/15 | O2/2 | O4/4 | O12/12 | O4/4 | O3/3 | O14/14 | O2/2 | O8/8 | O19/19 | O5/5 | O7/7 | O14/14 | O1/1 | O3/3 | O14/14 | O3/3 | B3/3 | X |
| COMP_0097 | 2025-10-14 | 2026-09-01 | 11 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/N | O4/N | O6/N | O10/N | O6/N | O6/N | O23/N | O2/N | O7/N | O8/N | O4/N | P1/N |
| COMP_0098 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B15/15 | O17/17 | O24/24 | O29/29 | O33/33 | O27/27 | O25/25 | O24/24 | O16/16 | O25/25 | O29/29 | O32/32 | O36/36 | O36/36 | O27/27 | O36/36 | O41/41 | O37/37 | O35/35 | O34/34 | O36/36 | O21/21 | O35/35 | O35/35 | P4/4 |
| COMP_0099 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O87/87 | O111/111 | O94/94 | O131/131 | O122/122 | O113/113 | O132/132 | O140/140 | O141/141 | O109/109 | O154/154 | O107/107 | O122/122 | O107/107 | O96/96 | O101/101 | O108/108 | O99/99 | O99/99 | O112/112 | O118/118 | O91/91 | O110/110 | O92/92 | P6/6 |
| COMP_0100 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O30/30 | O28/28 | O54/54 | O27/27 | O19/19 | O37/37 | O29/29 | O33/33 | O53/53 | O31/31 | O25/25 | O40/40 | O22/22 | O22/22 | O47/47 | O52/52 | O31/31 | O41/41 | O46/46 | O36/36 | P4/4 |
| COMP_0101 | 2024-10-07 | 2026-09-01 | 23 | 23 | 23 | X | B187/135 | O272/212 | O260/188 | O220/141 | O227/170 | O269/202 | O232/152 | O247/170 | O292/197 | O259/182 | O238/186 | O276/205 | O321/249 | O270/230 | O251/173 | O218/145 | O240/175 | O302/211 | O323/243 | O286/211 | O258/184 | O211/123 | O205/140 | P10/2 |
| COMP_0102 | 2024-09-18 | 2026-09-01 | 24 | 24 | 24 | B7/7 | O6/6 | O13/13 | O14/14 | O7/7 | O13/13 | O5/5 | O5/5 | O15/15 | O12/12 | O7/7 | O11/11 | O5/5 | O14/14 | O10/10 | O15/15 | O7/7 | O15/15 | O5/5 | O15/15 | O8/8 | O7/7 | O7/7 | O13/13 | P2/2 |
| COMP_0103 | 2025-04-17 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B9/9 | O19/19 | O17/17 | O12/12 | O10/10 | O13/13 | O21/21 | O11/11 | O12/12 | O14/14 | O18/18 | O17/17 | O19/19 | O15/15 | O17/17 | O13/13 | O10/10 | P2/2 |
| COMP_0104 | 2026-02-22 | 2026-09-01 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/N | O64/N | O100/N | O71/N | O114/N | O90/N | O151/N | P8/N |
| COMP_0105 | 2024-10-28 | 2026-09-01 | 23 | 23 | 23 | X | B30/30 | O90/90 | O76/76 | O72/72 | O60/60 | O76/76 | O83/83 | O79/79 | O93/93 | O84/84 | O79/79 | O95/95 | O98/98 | O95/95 | O76/76 | O97/97 | O71/71 | O100/100 | O81/81 | O101/101 | O164/164 | O195/195 | O203/203 | P23/23 |
| COMP_0106 | 2024-09-05 | 2026-08-11 | 23 | 23 | 23 | B2/2 | O5/5 | O2/2 | O2/2 | O5/5 | O3/3 | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | O3/3 | O1/1 | G | O2/2 | O3/3 | O4/4 | O6/6 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B2/2 | X |
| COMP_0107 | 2024-09-02 | 2026-08-31 | 24 | 0 | 0 | B37/N | O63/N | O42/N | O58/N | O54/N | O40/N | O67/N | O60/N | O59/N | O39/N | O42/N | O55/N | O45/N | O50/N | O40/N | O64/N | O51/N | O44/N | O66/N | O43/N | O45/N | O51/N | O54/N | O55/N | X |
| COMP_0108 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O5/5 | O5/5 | O7/7 | O5/5 | O5/5 | O4/4 | O4/4 | O5/5 | O5/5 | O5/5 | O8/8 | O7/7 | O21/21 | O23/23 | O25/25 | O27/27 | O26/26 | O28/28 | O22/22 | O25/25 | O27/27 | O29/29 | O23/23 | O24/24 | P1/1 |
| COMP_0109 | 2025-04-13 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B33/33 | O75/75 | O196/196 | O184/184 | O168/168 | O205/205 | O505/505 | O541/541 | O487/487 | O513/513 | O558/558 | O777/777 | O963/963 | O617/617 | O590/590 | O558/558 | O499/499 | P21/21 |
| COMP_0110 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/11 | O28/18 | O24/12 | O21/11 | O59/46 | O32/24 | O31/19 | P3/N |
| COMP_0111 | 2026-02-26 | 2026-08-28 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B10/10 | O63/63 | O64/64 | O45/45 | O63/63 | O74/74 | B73/73 | X |
| COMP_0112 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B28/28 | O26/26 | O33/33 | O26/26 | O40/40 | O53/53 | O49/49 | O35/35 | O38/38 | O59/59 | O36/36 | O41/41 | O40/40 | O50/50 | O44/44 | O52/52 | O29/29 | O36/36 | O43/43 | O27/27 | P3/3 |
| COMP_0113 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B28/28 | O22/22 | O29/29 | O34/34 | O20/20 | O20/20 | O22/22 | O18/18 | O21/21 | O27/27 | O39/39 | O10/10 | O22/22 | O17/17 | O21/21 | O28/28 | O25/25 | O20/20 | O20/20 | O21/20 | O15/15 | O21/21 | O15/15 | O11/11 | X |
| COMP_0114 | 2026-01-06 | 2026-08-26 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O9/9 | O10/10 | O12/12 | O30/30 | O18/18 | O11/11 | B9/9 | X |
| COMP_0115 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B12/12 | O8/8 | O11/11 | O12/12 | O9/9 | O6/6 | O17/17 | O12/12 | O22/22 | O14/14 | O3/3 | O13/13 | O13/13 | O2/2 | O15/15 | O16/16 | O8/8 | O14/14 | O32/32 | O13/13 | P1/1 |
| COMP_0116 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O44/44 | O48/48 | O44/44 | O48/48 | O45/45 | O37/37 | O42/42 | O46/46 | O46/45 | O49/49 | O46/46 | O46/46 | P2/2 |
| COMP_0117 | 2024-09-14 | 2026-09-01 | 24 | 24 | 24 | B10/6 | O14/6 | O11/7 | O38/23 | O74/43 | O72/37 | O69/33 | O55/30 | O69/28 | O69/38 | O66/30 | O43/22 | O59/33 | O39/15 | O37/7 | O29/7 | O29/7 | O29/9 | O27/8 | O33/7 | O25/9 | O34/8 | O30/9 | O31/7 | P1/N |
| COMP_0118 | 2026-02-20 | 2026-08-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O26/26 | O34/34 | O75/75 | O27/27 | O39/39 | O26/26 | X |
| COMP_0119 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B90/90 | O131/131 | O138/138 | O172/172 | O165/165 | O443/443 | O123/123 | O57/57 | P3/3 |
| COMP_0120 | 2026-01-23 | 2026-09-01 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | G | G | O14/14 | O20/20 | O28/28 | O254/254 | O254/254 | P19/19 |
| COMP_0121 | 2024-09-04 | 2026-08-31 | 24 | 24 | 24 | B19/19 | O14/14 | O26/26 | O24/24 | O23/23 | O24/24 | O16/16 | O23/23 | O16/16 | O24/24 | O14/14 | O22/22 | O12/12 | O27/27 | O19/19 | O26/26 | O8/8 | O33/33 | O13/13 | O25/25 | O11/11 | O19/19 | O14/14 | O11/11 | X |
| COMP_0122 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B260/260 | O655/655 | O469/469 | O830/830 | O911/911 | O538/538 | O395/395 | O304/304 | O270/270 | O329/329 | O277/277 | O162/162 | O330/330 | O276/276 | O315/315 | O298/298 | O254/254 | O300/300 | O417/417 | O304/304 | O270/270 | O316/316 | O285/285 | O205/205 | P9/9 |
| COMP_0123 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B51/51 | O49/49 | O43/43 | O41/41 | O60/60 | O48/48 | O45/45 | O40/40 | O34/34 | O29/29 | O38/38 | O34/34 | O35/35 | O52/52 | O29/29 | O32/32 | O44/44 | O37/37 | O34/34 | O51/51 | O40/40 | O33/33 | O42/42 | O27/27 | P1/1 |
| COMP_0124 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B18/18 | O16/16 | O21/21 | O26/26 | O76/76 | O100/100 | O73/73 | O47/47 | P3/3 |
| COMP_0125 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B6/6 | O5/5 | O7/7 | O3/3 | O3/3 | O3/3 | O3/3 | O6/6 | O4/4 | O3/3 | O5/5 | O5/5 | O3/3 | O2/2 | O5/5 | O7/7 | O4/4 | O4/4 | O3/3 | O2/2 | O4/4 | O4/4 | O5/5 | O5/5 | P1/1 |
| COMP_0126 | 2024-12-02 | 2026-09-01 | 21 | 21 | 5 | X | X | X | B26/26 | O113/47 | O63/5 | O127/N | O100/N | O73/N | O57/N | O83/N | O84/N | O102/N | O95/N | O77/N | O111/N | O101/N | O108/1 | O95/11 | O102/N | O102/N | O94/N | O99/N | O85/N | P4/N |
| COMP_0127 | 2025-02-28 | 2026-08-21 | 15 | 0 | 0 | X | X | X | X | X | B5/N | O1/N | O1/N | O1/N | G | O1/N | O1/N | O3/N | O2/N | O2/N | O2/N | G | G | G | O1/N | O1/N | O1/N | O1/N | B1/N | X |
| COMP_0128 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B35/13 | O79/32 | O146/47 | O89/32 | O76/19 | O92/39 | O106/54 | O48/17 | O46/15 | O42/10 | O43/18 | O45/11 | O19/7 | O36/15 | O13/4 | O17/1 | O22/7 | O7/1 | O13/1 | O18/1 | P2/N |
| COMP_0129 | 2025-10-20 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O22/22 | O86/86 | O92/92 | O85/85 | O97/97 | O89/89 | O95/95 | O116/116 | O117/117 | O132/128 | P8/8 |
| COMP_0130 | 2024-10-21 | 2026-08-28 | 23 | 23 | 23 | X | B38/38 | O52/52 | O64/64 | O69/69 | O73/73 | O116/116 | O84/84 | O105/105 | O67/67 | O90/90 | O60/59 | O73/73 | O67/67 | O66/66 | O86/86 | O79/79 | O88/88 | O82/82 | O147/147 | O78/78 | O27/27 | O17/17 | B19/19 | X |
| COMP_0131 | 2025-11-05 | 2026-08-17 | 9 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/N | O7/N | O3/N | O5/N | O2/2 | O11/11 | G | O2/2 | O1/1 | B2/2 | X |
| COMP_0132 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B10/10 | O76/76 | O105/105 | O112/110 | O101/96 | O97/97 | O113/112 | O79/79 | P7/7 |
| COMP_0133 | 2025-01-20 | 2026-08-06 | 15 | 15 | 15 | X | X | X | X | B1/1 | O2/2 | O1/1 | O2/2 | O4/4 | O2/2 | O6/6 | G | G | O2/2 | O1/1 | O3/3 | O4/4 | O3/3 | O1/1 | O2/2 | G | G | G | B1/1 | X |
| COMP_0134 | 2025-07-21 | 2026-08-27 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B3/3 | O8/8 | O10/10 | O10/10 | O8/8 | O8/8 | O8/8 | O7/7 | O12/12 | O10/10 | O7/7 | O9/9 | O8/8 | B7/7 | X |
| COMP_0135 | 2024-09-06 | 2026-09-01 | 24 | 0 | 0 | B7/N | O8/N | O4/N | O5/N | O28/N | O57/N | O56/N | O78/N | O80/N | O56/N | O63/N | O83/N | O85/N | O74/N | O53/N | O75/N | O47/N | O56/N | O85/N | O85/N | O48/N | O37/N | O31/N | O28/N | P4/N |
| COMP_0136 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B173/173 | O186/186 | O169/169 | O184/184 | O179/179 | O169/169 | O212/212 | O186/186 | O173/173 | O168/168 | O186/186 | O127/127 | O181/181 | O187/187 | O165/165 | O197/197 | O170/170 | O174/174 | O208/208 | O211/211 | O216/216 | O214/214 | O197/197 | O135/135 | P2/2 |
| COMP_0137 | 2025-02-11 | 2026-08-25 | 19 | 19 | 19 | X | X | X | X | X | B8/8 | O16/16 | O2/2 | O4/4 | O12/12 | O4/4 | O3/3 | O16/16 | O3/3 | O7/7 | O21/21 | O3/3 | O5/5 | O13/13 | O1/1 | O2/2 | O14/14 | O8/8 | B3/3 | X |
| COMP_0138 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O597/597 | O702/701 | O586/586 | O566/566 | O572/572 | O509/509 | O591/591 | O602/602 | O654/654 | O665/665 | O656/656 | O607/607 | O668/668 | O666/664 | O605/605 | O659/659 | O563/561 | O537/537 | O625/625 | O663/660 | O596/596 | O649/648 | O677/675 | O637/636 | P25/25 |
| COMP_0139 | 2025-02-03 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B18/18 | O49/49 | O24/24 | O28/28 | O46/46 | O13/13 | O15/15 | O62/62 | O22/22 | O22/22 | O46/46 | O18/18 | O14/14 | O52/52 | O19/19 | O24/24 | O41/41 | O24/24 | O15/15 | X |
| COMP_0140 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B6/6 | O360/360 | O375/375 | O331/331 | O361/361 | O344/344 | O321/321 | O390/390 | O359/359 | O345/345 | O415/415 | O351/351 | O346/346 | O391/391 | O370/370 | O363/363 | P19/19 |
| COMP_0141 | 2025-08-25 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O33/33 | O31/31 | O8/8 | O39/39 | O27/27 | O50/50 | O108/108 | O112/112 | O84/84 | O121/121 | O127/127 | O114/114 | P2/2 |
| COMP_0142 | 2025-02-07 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B47/47 | O131/131 | O116/116 | O132/132 | O45/45 | O221/221 | O20/20 | O159/159 | O138/138 | O129/129 | O208/208 | O182/182 | O32/32 | O263/210 | O39/39 | O226/226 | O169/169 | O151/151 | O125/125 | X |
| COMP_0143 | 2024-09-01 | 2026-08-03 | 23 | 23 | 23 | O21/20 | O17/15 | O13/10 | G | O6/6 | O7/5 | O6/4 | O28/26 | O31/29 | O27/25 | O26/24 | O7/5 | O16/14 | O17/15 | O13/8 | O7/4 | O3/2 | O27/24 | O3/1 | O9/7 | O11/9 | O3/3 | O3/3 | B1/1 | X |
| COMP_0144 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B97/97 | O120/120 | O109/109 | O118/118 | O114/114 | O103/103 | O97/97 | O95/95 | P15/15 |
| COMP_0145 | 2026-01-02 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B198/N | O215/N | O401/N | O278/N | O347/N | O338/N | O256/N | O281/N | P20/N |
| COMP_0146 | 2025-07-14 | 2026-08-27 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | B3/3 | G | O1/1 | G | O10/10 | O8/8 | O4/4 | O18/18 | O10/10 | O13/13 | O5/5 | O8/8 | O8/8 | B5/5 | X |
| COMP_0147 | 2024-09-02 | 2025-04-22 | 8 | 8 | 8 | B87/87 | O118/118 | O96/96 | O111/111 | O119/119 | O71/71 | O95/95 | B51/51 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0148 | 2025-07-09 | 2026-03-18 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | B6/6 | O6/6 | O6/6 | O3/3 | O12/12 | O2/2 | O3/3 | O4/4 | B7/7 | X | X | X | X | X | X |
| COMP_0149 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B86/N | O67/N | O92/N | O65/N | O89/N | O54/N | O54/N | O70/N | O70/N | O85/N | O61/N | O50/N | O87/N | O55/N | O71/N | O71/N | O42/N | O67/N | O42/N | O75/N | O77/N | O105/N | O55/N | O94/N | P3/N |
| COMP_0150 | 2025-04-10 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B24/24 | O44/44 | O46/46 | O69/69 | O71/71 | O59/59 | O25/25 | O194/194 | O198/198 | O240/240 | O237/237 | O253/253 | O219/219 | O262/262 | O227/227 | O251/251 | O224/224 | P9/9 |
| COMP_0151 | 2024-09-27 | 2026-09-01 | 24 | 24 | 24 | B2/2 | O2/2 | O2/2 | O4/4 | O6/6 | O7/7 | O5/5 | O3/3 | O11/11 | O5/5 | O7/7 | O4/4 | O7/7 | O8/8 | O5/5 | O7/7 | O6/6 | O6/6 | O9/9 | O6/6 | O8/8 | O37/37 | O8/8 | O6/6 | P1/1 |
| COMP_0152 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O116/116 | O170/170 | O169/168 | O123/122 | O137/137 | O101/101 | O93/93 | O108/108 | O121/121 | O123/123 | O153/153 | O113/113 | O149/149 | O73/73 | O61/61 | O61/61 | O50/48 | O47/47 | O39/37 | O60/60 | O63/63 | O53/53 | O60/60 | O58/58 | P3/3 |
| COMP_0153 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B2/2 | O4/4 | O3/3 | O4/4 | O5/5 | O3/3 | O1/1 | O11/11 | O3/3 | O2/2 | O6/6 | O3/3 | O2/2 | O3/3 | O5/5 | O4/4 | O6/6 | O3/3 | O2/2 | O4/4 | O5/5 | O3/3 | O5/5 | O7/7 | X |
| COMP_0154 | 2026-01-19 | 2026-08-21 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O5/N | O5/N | O6/N | O3/N | O5/N | O7/N | B4/N | X |
| COMP_0155 | 2024-09-02 | 2026-08-26 | 24 | 24 | 24 | B33/33 | O50/50 | O34/34 | O25/25 | O26/26 | O32/32 | O23/23 | O27/27 | O17/17 | O17/17 | O31/31 | O27/27 | O19/19 | O16/16 | O13/13 | O21/21 | O12/12 | O11/11 | O9/9 | O14/14 | O18/18 | O15/15 | O12/12 | B8/8 | X |
| COMP_0156 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B2/2 | O61/61 | O80/80 | O146/146 | O81/81 | O86/86 | O78/78 | O102/102 | O49/49 | O93/93 | O156/156 | O129/129 | O114/114 | O115/115 | O113/113 | O132/132 | O265/265 | O338/338 | O250/250 | O118/118 | O51/51 | P4/4 |
| COMP_0157 | 2025-04-15 | 2026-08-10 | 17 | 17 | 17 | X | X | X | X | X | X | X | B43/43 | O11/11 | O27/27 | O31/31 | O64/64 | O7/7 | O9/9 | O4/4 | O12/12 | O7/7 | O7/7 | O6/6 | O11/11 | O8/8 | O18/18 | O15/15 | B2/2 | X |
| COMP_0158 | 2026-02-09 | 2026-09-01 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B50/N | O75/N | O76/N | O71/N | O80/N | O94/N | O68/N | P6/N |
| COMP_0159 | 2024-11-28 | 2026-09-01 | 22 | 22 | 22 | X | X | B3/3 | O9/9 | O11/11 | O9/9 | O6/6 | O11/11 | O11/11 | O13/13 | O15/15 | O6/6 | O6/6 | O12/12 | O8/8 | O10/10 | O9/9 | O9/9 | O8/8 | O16/16 | O9/9 | O19/19 | O13/13 | O6/6 | P3/3 |
| COMP_0160 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B53/53 | O74/74 | O79/79 | O67/67 | O61/61 | O108/108 | O83/80 | O68/68 | O102/102 | O64/64 | O65/65 | O81/81 | O68/68 | O81/81 | O82/82 | O72/71 | O68/68 | O96/96 | O51/51 | O65/65 | O91/91 | O46/46 | O59/59 | O58/58 | P1/1 |
| COMP_0161 | 2024-12-23 | 2026-08-12 | 20 | 20 | 20 | X | X | X | B6/6 | O28/28 | O25/25 | O19/19 | O26/26 | O19/19 | O13/13 | O18/18 | O14/14 | O10/10 | O21/21 | O8/8 | O8/8 | O14/14 | O4/4 | O3/3 | O4/4 | O2/2 | O1/1 | G | B1/1 | X |
| COMP_0162 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O2/2 | O1/1 | O5/5 | O6/6 | O6/6 | O3/3 | O5/5 | O5/5 | O6/6 | O26/26 | O19/19 | O25/25 | O12/12 | O29/29 | O24/24 | O24/24 | O22/22 | O25/25 | O38/38 | O21/21 | P1/1 |
| COMP_0163 | 2024-09-02 | 2026-08-28 | 24 | 0 | 0 | B16/N | O14/N | O19/N | O104/N | O79/N | O67/N | O62/N | O68/N | O82/N | O61/N | O65/N | O88/N | O62/N | O78/N | O31/N | O89/N | O52/N | O73/N | O63/N | O50/N | O63/N | O84/N | O66/N | B50/N | X |
| COMP_0164 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B30/30 | O30/30 | O19/19 | O28/28 | O21/21 | O19/19 | O16/16 | O31/31 | O19/19 | O27/27 | O30/30 | O18/18 | O33/33 | O31/31 | O19/19 | O31/31 | O22/22 | O16/16 | O19/19 | O18/18 | O22/22 | O26/26 | O20/20 | O13/13 | P1/1 |
| COMP_0165 | 2024-09-14 | 2026-08-26 | 24 | 24 | 24 | B3/3 | O4/4 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O4/4 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | B3/3 | X |
| COMP_0166 | 2025-12-19 | 2026-07-20 | 8 | 1 | 1 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/N | O8/N | O10/N | O15/N | O6/N | O13/N | O27/N | B43/8 | X | X |
| COMP_0167 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B31/27 | O30/28 | O35/31 | O30/28 | O23/23 | O27/25 | O28/26 | O17/17 | O22/20 | O15/15 | O22/20 | O15/15 | O24/20 | O22/20 | O29/23 | O28/24 | O20/18 | O48/28 | O62/62 | O35/35 | O47/41 | O43/39 | O43/40 | O41/41 | P7/4 |
| COMP_0168 | 2025-11-13 | 2026-08-26 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/N | O7/N | O7/N | O20/N | O11/N | O34/N | O14/N | O9/N | O17/N | B10/N | X |
| COMP_0169 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O518/147 | O548/130 | O178/63 | O128/75 | O97/68 | O114/85 | O157/104 | O410/136 | O399/144 | O301/160 | O278/146 | O252/131 | O286/158 | O237/121 | O105/65 | O77/57 | O79/67 | O105/92 | O155/134 | O193/129 | O276/212 | O281/222 | O697/654 | O351/310 | P13/11 |
| COMP_0170 | 2025-07-24 | 2026-04-02 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | B4/4 | O2/2 | O2/2 | O3/3 | O4/4 | O5/5 | O8/8 | O7/7 | O17/17 | B3/3 | X | X | X | X | X |
| COMP_0171 | 2026-01-20 | 2026-08-25 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O1/1 | O9/9 | O8/8 | O5/5 | O3/3 | O11/11 | B13/13 | X |
| COMP_0172 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B143/103 | O105/105 | O174/116 | O139/139 | O125/125 | O103/103 | O149/110 | O117/103 | O113/113 | O145/126 | O197/197 | O164/164 | O148/148 | O219/219 | O180/180 | O252/252 | O188/188 | O213/194 | O202/202 | O236/236 | O248/248 | O277/277 | O301/301 | O240/240 | P57/57 |
| COMP_0173 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O97/97 | O72/72 | O72/72 | O88/88 | O83/83 | O69/69 | O93/93 | O49/49 | O100/100 | O100/100 | O78/78 | O75/75 | O90/90 | O76/76 | O74/74 | O95/95 | O64/64 | O82/82 | O108/108 | O44/44 | P14/14 |
| COMP_0174 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B18/18 | O26/26 | O19/19 | O26/26 | O29/29 | O27/27 | O25/25 | O36/36 | O21/21 | O22/22 | O38/38 | O19/19 | O23/23 | O29/29 | O37/37 | O47/47 | O57/57 | O78/78 | O62/62 | O50/50 | O49/49 | O60/60 | O45/45 | O27/27 | P4/4 |
| COMP_0175 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B767/767 | O1285/1285 | O1451/1451 | O1461/1461 | O1420/1420 | O1627/1627 | O2070/2043 | O2737/2737 | O1780/1780 | P154/154 |
| COMP_0176 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B22/22 | O32/32 | O20/20 | O22/22 | O9/9 | O10/10 | O11/11 | O8/8 | O10/10 | O5/5 | O8/8 | O10/10 | O9/9 | O9/9 | O8/8 | O10/10 | O7/7 | O11/11 | O10/10 | O12/12 | O9/9 | O7/7 | O7/7 | O4/4 | X |
| COMP_0177 | 2025-10-11 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B71/71 | O59/59 | O21/21 | O56/56 | O64/64 | O74/74 | O87/84 | O127/118 | O50/49 | O182/181 | O130/124 | P4/4 |
| COMP_0178 | 2024-09-01 | 2026-08-31 | 24 | 24 | 15 | O4/4 | O12/5 | O56/20 | O67/22 | O65/14 | O44/3 | O62/3 | O81/4 | O53/3 | O64/3 | O68/4 | O56/N | O54/15 | O48/1 | O44/N | O32/N | O41/N | O44/N | O37/N | O37/1 | O36/N | O35/N | O32/1 | O21/N | X |
| COMP_0179 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B19/19 | O29/29 | O16/16 | O24/24 | O22/22 | O15/15 | O9/9 | O25/25 | O9/9 | O12/12 | O23/23 | O10/10 | O22/22 | O17/17 | O20/20 | O36/36 | O45/45 | O37/37 | O70/70 | O56/56 | O59/59 | O54/54 | O74/74 | O49/49 | P3/3 |
| COMP_0180 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O77/77 | O73/73 | O47/46 | O53/51 | O71/71 | O59/58 | O79/79 | O77/76 | O58/58 | O110/110 | O106/104 | O122/121 | O129/128 | O197/196 | O94/90 | O98/97 | O91/91 | O97/96 | O107/105 | O115/115 | O85/82 | O98/98 | O174/173 | O170/170 | P13/13 |
| COMP_0181 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B97/97 | O116/116 | O146/146 | O163/163 | O97/97 | O60/60 | O126/126 | O97/97 | O119/119 | O98/98 | O93/93 | O34/34 | O88/88 | O80/80 | O85/85 | O80/80 | O82/82 | O81/81 | O102/102 | O82/82 | O116/116 | O98/98 | O175/175 | O187/187 | P3/3 |
| COMP_0182 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O305/305 | O374/374 | O324/324 | O385/385 | O299/299 | O365/365 | O324/324 | O351/351 | O442/439 | O459/457 | O554/549 | O359/358 | P69/69 |
| COMP_0183 | 2025-09-30 | 2026-08-31 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O18/17 | O17/17 | O21/21 | O13/12 | O11/11 | O17/17 | O23/21 | O13/13 | O14/13 | O19/18 | O13/13 | X |
| COMP_0184 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B23/23 | O20/20 | O21/21 | O18/18 | O18/18 | O20/20 | O22/22 | O19/19 | P6/6 |
| COMP_0185 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O422/404 | O476/443 | O450/433 | O364/347 | O397/378 | O314/298 | O402/387 | O388/373 | P14/13 |
| COMP_0186 | 2024-09-11 | 2026-09-01 | 24 | 24 | 24 | B5/5 | O10/10 | O5/5 | O17/17 | O14/14 | O15/15 | O18/18 | O28/28 | O45/45 | O38/38 | O134/134 | O128/128 | O151/151 | O136/136 | O121/121 | O140/140 | O73/73 | O99/99 | O110/110 | O103/103 | O97/97 | O93/93 | O57/57 | O29/29 | P2/2 |
| COMP_0187 | 2026-01-31 | 2026-08-31 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O4/N | O4/N | O3/N | O5/N | O6/N | O3/N | O3/N | X |
| COMP_0188 | 2024-09-09 | 2026-04-16 | 20 | 20 | 20 | B16/16 | O22/22 | O18/18 | O25/25 | O28/28 | O23/23 | O42/42 | O26/26 | O21/21 | O24/24 | O20/20 | O13/13 | O23/23 | O19/19 | O26/26 | O43/43 | O10/10 | O25/25 | O45/45 | B24/24 | X | X | X | X | X |
| COMP_0189 | 2025-06-12 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B13/2 | O18/6 | O9/4 | O10/2 | O14/4 | O13/3 | O30/15 | O22/13 | O23/4 | O23/6 | O16/7 | O34/8 | O19/6 | O20/6 | O27/10 | P2/1 |
| COMP_0190 | 2025-10-17 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B17/17 | O38/38 | O62/62 | O156/156 | O136/136 | O142/142 | O155/155 | O90/90 | O88/88 | O62/62 | O23/23 | P6/6 |
| COMP_0191 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B61/N | O77/N | O86/N | O61/N | O78/N | O74/N | O69/N | O61/N | O65/N | O86/N | O60/N | O63/N | O68/N | O71/N | O62/N | O64/N | O56/N | O62/N | O55/N | O54/N | O65/N | O49/N | O45/N | O44/N | P4/N |
| COMP_0192 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B59/59 | O130/130 | O168/168 | O390/390 | O335/335 | O334/334 | O479/479 | O656/656 | P9/9 |
| COMP_0193 | 2025-10-03 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B701/701 | O139/139 | O74/74 | O22/22 | O42/42 | O399/399 | O792/792 | O1102/1102 | O1175/1175 | O1156/1156 | O1154/1154 | P40/40 |
| COMP_0194 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O2/2 | O2/2 | O3/3 | O2/2 | O2/2 | O2/2 | O2/2 | O4/4 | O2/2 | O2/2 | O7/7 | O2/2 | O2/2 | O2/2 | O2/2 | O11/11 | O5/5 | O3/3 | O2/2 | O2/2 | O3/3 | O14/14 | O32/32 | P1/1 |
| COMP_0195 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B50/50 | O90/90 | O69/69 | O87/87 | O71/71 | O68/68 | O120/120 | O60/60 | O113/109 | O100/99 | O105/105 | O104/104 | O75/75 | O139/139 | O103/103 | O140/139 | O146/146 | O91/91 | O76/76 | O98/98 | O78/78 | O95/95 | O132/132 | O48/48 | P2/2 |
| COMP_0196 | 2025-12-04 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B85/80 | O112/106 | O91/89 | O78/77 | O91/89 | O79/75 | O85/82 | O90/88 | O30/28 | P3/2 |
| COMP_0197 | 2024-11-26 | 2026-08-25 | 22 | 22 | 22 | X | X | B1/1 | O4/4 | O4/4 | O1/1 | O2/2 | O3/3 | O2/2 | O2/2 | O2/2 | O2/2 | O4/4 | O6/6 | O2/2 | O2/2 | O7/7 | O1/1 | O3/3 | O4/4 | O1/1 | O2/2 | O4/4 | B2/2 | X |
| COMP_0198 | 2024-09-04 | 2026-08-27 | 21 | 21 | 21 | B2/2 | O2/2 | G | G | O3/3 | O2/2 | O2/2 | O3/3 | O5/5 | O3/3 | O5/5 | O3/3 | O4/4 | O3/3 | O1/1 | O5/5 | O5/5 | O4/4 | G | O5/5 | O3/3 | O2/2 | O3/3 | B2/2 | X |
| COMP_0199 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O22/22 | O22/22 | O23/23 | O16/16 | O44/44 | O32/32 | O31/31 | O26/26 | O17/17 | O23/23 | O23/23 | O19/19 | P3/3 |
| COMP_0200 | 2025-10-03 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B80/80 | O61/61 | O45/45 | O32/32 | O28/28 | O32/32 | O65/65 | O140/140 | O127/127 | O80/80 | O132/132 | P3/3 |
| COMP_0201 | 2024-09-09 | 2026-09-01 | 24 | 24 | 24 | B17/17 | O23/23 | O19/19 | O30/17 | O83/38 | O47/22 | O69/43 | O60/36 | O56/27 | O59/36 | O68/38 | O44/28 | O54/30 | O73/41 | O71/3 | O64/1 | O56/2 | O73/4 | O58/1 | O61/4 | O59/1 | O65/4 | O81/4 | O65/2 | P3/1 |
| COMP_0202 | 2025-11-12 | 2026-06-30 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B65/N | O41/N | O95/N | O104/N | O129/N | O95/N | O87/N | O102/N | X | X | X |
| COMP_0203 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O359/96 | O405/113 | O374/68 | O382/66 | O429/92 | O374/106 | O455/91 | O388/82 | O404/91 | O398/108 | O452/120 | O354/98 | O391/95 | O480/136 | O360/75 | O344/59 | O443/96 | O428/93 | O391/79 | O400/94 | O412/108 | O408/125 | O462/130 | O351/83 | P25/5 |
| COMP_0204 | 2025-12-29 | 2026-08-31 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O3/3 | O6/6 | O5/5 | O9/9 | O7/7 | O7/7 | O9/9 | O9/9 | X |
| COMP_0205 | 2025-08-04 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B21/N | O11/N | O56/N | O46/N | O51/N | O52/N | O38/N | O42/N | O31/N | O40/N | O33/N | O26/N | O36/N | P3/N |
| COMP_0206 | 2026-01-18 | 2026-08-21 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B129/129 | O357/357 | O415/415 | O344/344 | O372/372 | O361/361 | O410/410 | B265/265 | X |
| COMP_0207 | 2024-09-01 | 2026-08-31 | 24 | 24 | 24 | O51/51 | O60/60 | O32/32 | O28/28 | O60/60 | O39/39 | O30/30 | O35/35 | O28/28 | O38/38 | O36/36 | O32/32 | O40/40 | O48/48 | O31/31 | O29/29 | O82/82 | O37/37 | O31/31 | O43/43 | O27/27 | O26/26 | O32/32 | O22/22 | X |
| COMP_0208 | 2026-01-30 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/N | O18/N | O49/N | O56/N | O66/N | O85/N | O77/N | O76/N | P6/N |
| COMP_0209 | 2025-12-16 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B29/29 | O27/27 | O41/41 | O27/27 | O43/43 | O31/31 | O65/65 | O46/46 | O29/29 | P2/2 |
| COMP_0210 | 2025-08-15 | 2026-08-31 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B24/23 | O46/46 | O39/39 | O47/46 | O47/47 | O55/55 | O53/52 | O62/62 | O61/61 | O39/38 | O55/55 | O45/45 | O46/45 | X |
| COMP_0211 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B11/11 | O43/43 | O48/48 | O42/42 | O57/57 | O63/63 | O35/35 | P2/2 |
| COMP_0212 | 2025-12-11 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/4 | O5/2 | O13/7 | O10/3 | O9/4 | O14/4 | O9/3 | O15/9 | O8/3 | P1/1 |
| COMP_0213 | 2025-08-09 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B172/N | O223/N | O221/N | O227/N | O230/N | O197/N | O196/N | O231/N | O177/N | O138/N | O83/N | O166/N | O140/N | P4/N |
| COMP_0214 | 2025-03-27 | 2026-06-04 | 16 | 16 | 16 | X | X | X | X | X | X | B1/1 | O3/3 | O5/5 | O3/3 | O11/11 | O2/2 | O8/8 | O8/8 | O2/2 | O8/8 | O5/5 | O5/5 | O7/7 | O6/6 | O5/5 | B1/1 | X | X | X |
| COMP_0215 | 2024-10-21 | 2026-08-17 | 16 | 16 | 16 | X | B1/1 | G | O3/3 | O2/2 | G | G | G | G | O1/1 | O1/1 | G | G | O3/3 | O1/1 | O5/5 | O2/2 | O2/2 | O14/14 | O3/3 | O6/6 | O6/6 | O9/9 | B2/2 | X |
| COMP_0216 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O488/23 | O204/16 | O411/27 | O451/35 | O566/30 | O554/36 | O671/36 | O561/92 | O558/88 | O553/70 | O478/70 | O429/53 | O459/75 | O337/52 | O367/67 | O505/89 | O478/78 | O583/93 | O591/96 | O624/100 | P25/6 |
| COMP_0217 | 2025-08-28 | 2026-08-31 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O1/1 | O1/1 | O1/1 | O4/4 | O7/7 | O4/4 | O4/4 | O6/6 | O10/10 | O4/4 | O7/7 | O6/6 | X |
| COMP_0218 | 2025-01-17 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B9/9 | O10/10 | O11/11 | O19/19 | O14/14 | O21/21 | O18/18 | O8/8 | O10/10 | O22/22 | O19/19 | O16/16 | O16/16 | O11/11 | O18/18 | O21/21 | O11/11 | O15/15 | O21/21 | O19/19 | P3/3 |
| COMP_0219 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B325/N | O290/N | O335/N | O356/N | O660/N | O381/N | O396/N | O505/N | O434/N | O480/N | O355/N | O374/N | O357/N | O399/N | O407/N | O453/N | O313/N | O284/N | O293/N | O373/N | O389/N | O265/N | O244/N | O263/N | P9/N |
| COMP_0220 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O50/8 | O43/5 | O51/8 | O54/11 | O52/7 | O54/11 | O63/5 | O42/4 | O63/7 | O67/12 | O66/8 | O73/15 | O75/15 | O82/16 | O104/52 | O97/29 | O131/64 | O92/22 | O103/35 | O71/18 | P2/N |
| COMP_0221 | 2026-02-19 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B76/46 | O181/145 | O179/138 | O176/137 | O196/154 | O183/138 | O145/107 | P7/7 |
| COMP_0222 | 2025-01-02 | 2026-08-26 | 20 | 20 | 20 | X | X | X | X | B28/28 | O31/31 | O26/26 | O24/24 | O39/39 | O17/17 | O27/27 | O23/23 | O27/27 | O25/25 | O28/28 | O30/30 | O29/29 | O29/29 | O32/32 | O29/29 | O4/4 | O24/24 | O9/9 | B10/10 | X |
| COMP_0223 | 2024-09-30 | 2025-12-19 | 16 | 16 | 16 | B1/1 | O3/3 | O2/2 | O4/4 | O3/3 | O1/1 | O4/4 | O1/1 | O3/3 | O4/4 | O6/6 | O2/2 | O1/1 | O3/3 | O1/1 | B5/5 | X | X | X | X | X | X | X | X | X |
| COMP_0224 | 2025-11-07 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/13 | O17/17 | O25/25 | O15/15 | O26/26 | O34/34 | O16/16 | O11/11 | O60/60 | O19/19 | P3/3 |
| COMP_0225 | 2025-02-17 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B58/58 | O93/93 | O89/89 | O83/83 | O92/92 | O117/117 | O57/57 | O114/114 | O116/116 | O107/107 | O194/194 | O137/137 | O148/148 | O108/108 | O108/108 | O89/89 | O130/130 | O159/159 | O88/88 | P5/5 |
| COMP_0226 | 2025-08-21 | 2026-08-11 | 12 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B7/N | O33/N | O30/N | O20/N | O32/N | O29/N | O30/N | O6/N | O1/N | G | O3/N | O31/N | B16/N | X |
| COMP_0227 | 2025-01-02 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B73/73 | O88/88 | O71/71 | O80/80 | O97/97 | O121/121 | O113/113 | O85/85 | O106/106 | O108/108 | O84/84 | O117/117 | O77/77 | O65/65 | O87/87 | O78/78 | O87/87 | O110/110 | O109/106 | O77/75 | P7/7 |
| COMP_0228 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O122/122 | O105/105 | O167/167 | O161/161 | O190/190 | O208/208 | O309/309 | O273/273 | O245/245 | O290/290 | O392/392 | O510/510 | O599/599 | O506/506 | O567/567 | O502/502 | O505/505 | O545/545 | O327/327 | O335/335 | P19/19 |
| COMP_0229 | 2024-09-17 | 2026-08-17 | 24 | 24 | 24 | B1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B1/1 | X |
| COMP_0230 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O7/7 | O9/9 | O5/5 | O10/10 | O6/6 | O4/4 | O10/10 | O6/6 | O9/9 | O7/7 | O7/7 | O8/8 | P1/1 |
| COMP_0231 | 2024-10-14 | 2026-08-31 | 23 | 23 | 23 | X | B56/56 | O34/34 | O54/54 | O28/28 | O17/17 | O32/32 | O39/32 | O24/19 | O17/11 | O14/12 | O7/5 | O16/11 | O50/49 | O133/133 | O35/33 | O21/21 | O8/8 | O9/9 | O13/13 | O11/10 | O6/6 | O37/37 | O18/18 | X |
| COMP_0232 | 2025-06-02 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B7/7 | O13/13 | O5/5 | O5/5 | O10/10 | O6/6 | O16/16 | O9/9 | O6/6 | O15/15 | O10/10 | O3/3 | O10/10 | O8/8 | O3/3 | P1/1 |
| COMP_0233 | 2024-09-30 | 2026-08-31 | 24 | 0 | 0 | B1/N | O1/N | O8/N | O5/N | O6/N | O6/N | O4/N | O5/N | O6/N | O20/N | O23/N | O177/N | O206/N | O125/N | O26/N | O214/N | O625/N | O741/N | O589/N | O518/N | O359/N | O335/N | O207/N | O223/N | X |
| COMP_0234 | 2024-09-09 | 2026-09-01 | 24 | 24 | 24 | B70/70 | O199/199 | O160/160 | O141/123 | O189/157 | O242/223 | O262/232 | O194/168 | O221/199 | O260/231 | O197/175 | O152/127 | O222/186 | O227/203 | O303/210 | O191/104 | O243/119 | O211/99 | O173/58 | O169/63 | O210/102 | O259/79 | O156/51 | O125/31 | P12/9 |
| COMP_0235 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B26/26 | O45/45 | O21/21 | O24/24 | O744/744 | O752/752 | O782/782 | O643/643 | O687/687 | O726/726 | O751/751 | O903/903 | O710/710 | O817/817 | O728/728 | O661/661 | O651/651 | O610/610 | O647/647 | O774/773 | O605/602 | O618/618 | O810/808 | O729/728 | P20/20 |
| COMP_0236 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B159/159 | O880/880 | O786/786 | O740/740 | O807/807 | O886/877 | O740/724 | P51/51 |
| COMP_0237 | 2026-01-07 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B18/N | O22/N | O21/N | O20/N | O23/N | O18/N | O26/N | O20/N | P4/N |
| COMP_0238 | 2025-12-19 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B55/55 | O94/94 | O71/71 | O103/103 | O106/106 | O70/70 | O83/83 | O83/83 | O84/84 | P3/3 |
| COMP_0239 | 2024-09-05 | 2026-09-01 | 24 | 24 | 24 | B15/15 | O13/13 | O9/9 | O10/9 | O10/10 | O17/17 | O23/21 | O22/22 | O18/18 | O27/27 | O33/33 | O15/15 | O31/31 | O40/40 | O24/24 | O23/22 | O31/31 | O11/11 | O18/17 | O20/20 | O14/14 | O22/22 | O36/36 | O14/14 | P2/2 |
| COMP_0240 | 2026-02-20 | 2026-09-01 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/N | O3/N | O8/N | O9/N | O23/N | O9/N | O19/N | P1/N |
| COMP_0241 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B169/169 | O211/211 | O268/267 | O186/182 | O208/207 | O204/203 | O207/206 | O237/234 | O222/215 | O225/219 | O241/232 | O247/238 | O79/79 | O66/66 | O60/60 | O73/73 | O234/234 | O317/317 | O397/397 | O465/465 | O538/538 | O463/463 | O438/437 | O350/350 | P40/40 |
| COMP_0242 | 2026-03-05 | 2026-09-01 | 4 | 4 | 4 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | G | O1/1 | G | O8/8 | O12/12 | P9/9 |
| COMP_0243 | 2025-04-11 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B307/307 | O603/603 | O614/614 | O660/660 | O509/509 | O540/540 | O629/629 | O550/550 | O660/659 | O642/642 | O592/592 | O687/687 | O570/570 | O524/524 | O587/587 | O639/639 | O525/525 | P35/35 |
| COMP_0244 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B210/210 | O235/235 | O188/188 | O208/208 | O201/201 | O183/183 | O196/196 | O187/187 | O201/201 | O197/197 | O196/196 | O138/138 | O179/179 | O180/180 | O137/137 | O153/153 | O137/137 | O166/166 | O149/149 | O129/129 | O115/115 | O123/123 | O143/143 | O112/112 | P8/8 |
| COMP_0245 | 2025-06-10 | 2026-08-31 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B2/2 | O5/5 | O8/8 | O8/8 | O18/18 | O13/13 | O13/13 | O18/18 | O18/18 | O10/10 | O19/19 | O63/63 | O8/8 | O14/14 | O9/9 | X |
| COMP_0246 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O83/83 | O129/129 | O66/66 | O111/111 | O111/111 | O81/81 | O92/92 | O134/134 | O99/99 | O83/83 | O101/101 | O62/62 | O106/105 | O127/127 | O85/85 | O117/117 | O130/130 | O102/102 | O163/163 | O142/142 | O104/104 | O106/106 | O181/181 | O98/98 | P9/9 |
| COMP_0247 | 2024-10-14 | 2026-08-25 | 23 | 0 | 0 | X | B2/N | O1/N | O3/N | O191/N | O107/N | O55/N | O36/N | O48/N | O61/N | O50/N | O45/N | O48/N | O48/N | O42/N | O39/N | O64/N | O56/N | O40/N | O45/N | O41/N | O66/N | O68/N | B19/N | X |
| COMP_0248 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O200/170 | O215/144 | O209/177 | O209/151 | O202/160 | O168/137 | O220/177 | O167/142 | O197/160 | O194/161 | O206/170 | O202/175 | O170/134 | O216/192 | O248/220 | O221/185 | O212/174 | O193/151 | O219/164 | O179/146 | P3/3 |
| COMP_0249 | 2024-09-03 | 2026-09-01 | 24 | 1 | 1 | B6/N | O10/N | O9/N | O14/N | O7/N | O13/N | O10/N | O11/N | O7/N | O9/N | O6/N | O9/N | O9/N | O18/N | O22/N | O27/N | O41/N | O30/N | O36/N | O34/N | O36/N | O42/N | O53/2 | O32/N | P2/N |
| COMP_0250 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B60/60 | O46/46 | O48/48 | O59/59 | O66/66 | O48/48 | O47/47 | O57/57 | O56/56 | O64/64 | O56/56 | O79/79 | O58/58 | O71/71 | O65/65 | O88/88 | O65/65 | O52/52 | O71/71 | O73/73 | O62/62 | O56/56 | O64/64 | O51/51 | P1/1 |
| COMP_0251 | 2025-08-09 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B40/N | O52/N | O67/N | O79/N | O93/N | O56/N | O32/N | O49/N | O37/N | O29/N | O23/N | O41/N | O37/N | P4/N |
| COMP_0252 | 2025-12-29 | 2026-09-01 | 9 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B26/N | O136/N | O121/N | O263/38 | O370/36 | O519/24 | O631/42 | O670/69 | O728/79 | P21/3 |
| COMP_0253 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B18/18 | O19/19 | O19/19 | O19/19 | O14/14 | O18/18 | O18/18 | O13/13 | O20/20 | O29/29 | O32/32 | O30/30 | O26/26 | O25/25 | O30/30 | O27/27 | O27/27 | O37/37 | O28/28 | O15/15 | O12/12 | O17/17 | O65/65 | O24/24 | P1/1 |
| COMP_0254 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O69/69 | O77/77 | O65/65 | O67/67 | O61/61 | O77/77 | O51/51 | O63/63 | O53/53 | O64/64 | O62/62 | O50/50 | O55/55 | O72/72 | O48/48 | O75/75 | O61/61 | O72/72 | O66/66 | O66/66 | O59/59 | O60/60 | O60/60 | O33/33 | P2/2 |
| COMP_0255 | 2026-01-10 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B350/350 | O387/387 | O422/422 | O403/403 | O430/430 | O390/390 | O373/372 | O252/252 | P17/17 |
| COMP_0256 | 2025-04-15 | 2026-08-24 | 17 | 0 | 0 | X | X | X | X | X | X | X | B11/N | O13/N | O20/N | O9/N | O17/N | O14/N | O12/N | O16/N | O10/N | O9/N | O14/N | O8/N | O10/N | O15/N | O9/N | O19/N | B8/N | X |
| COMP_0257 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O175/175 | O182/182 | O177/173 | O188/184 | O195/195 | O196/196 | O183/183 | O144/144 | O204/204 | O225/214 | O206/197 | O171/168 | O204/204 | O199/199 | O168/168 | O216/214 | O187/187 | O198/198 | O254/254 | O144/144 | P6/6 |
| COMP_0258 | 2024-09-06 | 2026-08-27 | 23 | 23 | 23 | B9/9 | O4/4 | O4/4 | O8/8 | O5/5 | O3/3 | O9/9 | O6/6 | O7/7 | O9/9 | O8/8 | O16/12 | G | O4/4 | O5/5 | O9/9 | O9/9 | O6/6 | O3/3 | O13/13 | O7/7 | O3/3 | O9/9 | B3/3 | X |
| COMP_0259 | 2024-09-06 | 2025-12-24 | 16 | 16 | 16 | B11/11 | O8/8 | O5/5 | O7/7 | O8/8 | O4/4 | O7/7 | O7/7 | O8/8 | O9/9 | O6/6 | O3/3 | O9/9 | O6/6 | O3/3 | B5/5 | X | X | X | X | X | X | X | X | X |
| COMP_0260 | 2025-08-28 | 2026-08-27 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O1/1 | O1/1 | O6/6 | O9/9 | O6/6 | O3/3 | O2/2 | O4/4 | O3/3 | O3/3 | O4/4 | B6/6 | X |
| COMP_0261 | 2024-09-05 | 2026-01-08 | 16 | 16 | 16 | B23/23 | O24/24 | O17/17 | O33/33 | O34/34 | O22/22 | O22/22 | O31/31 | O21/21 | O29/29 | O20/20 | O16/16 | O4/4 | O5/5 | O1/1 | G | B1/1 | X | X | X | X | X | X | X | X |
| COMP_0262 | 2025-05-20 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B43/34 | O269/83 | O353/84 | O336/67 | O306/58 | O370/87 | O265/51 | O434/28 | O344/51 | O351/67 | O323/70 | O416/55 | O486/60 | O402/65 | O486/80 | O438/72 | P121/N |
| COMP_0263 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O3/3 | O3/3 | O4/4 | O2/2 | O7/7 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O6/6 | O4/4 | O3/3 | O4/4 | O2/2 | O4/4 | O4/4 | O5/5 | O5/5 | P1/1 |
| COMP_0264 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B18/18 | O16/16 | O13/13 | O16/16 | O16/16 | O13/13 | O16/16 | O13/13 | O14/14 | O19/19 | O17/17 | O14/14 | O13/13 | O17/17 | O12/12 | O20/20 | O15/15 | O14/14 | O17/17 | O16/16 | O13/13 | O16/16 | O15/15 | O16/16 | X |
| COMP_0265 | 2024-11-15 | 2026-09-01 | 22 | 22 | 22 | X | X | B7/7 | O11/11 | O15/15 | O19/19 | O12/12 | O16/16 | O16/16 | O9/9 | O16/16 | O11/11 | O23/23 | O22/22 | O36/36 | O38/38 | O35/35 | O31/31 | O47/47 | O33/33 | O24/24 | O48/48 | O40/37 | O33/33 | P1/1 |
| COMP_0266 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B65/65 | O101/101 | O61/61 | O58/58 | O63/63 | O51/51 | O59/59 | O69/69 | O59/59 | O50/50 | O62/62 | O53/53 | O54/54 | O56/56 | O61/61 | O60/60 | O54/54 | O79/79 | O64/64 | O62/62 | O57/57 | O70/70 | O63/63 | O41/41 | P10/10 |
| COMP_0267 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B91/91 | O130/130 | O95/95 | O68/68 | O118/118 | O80/80 | O101/101 | O102/102 | O99/99 | O80/80 | O95/95 | O74/74 | O92/92 | O82/82 | O82/82 | O80/80 | O103/103 | O128/128 | O100/100 | O99/99 | O109/109 | O111/111 | O84/84 | O84/84 | P4/4 |
| COMP_0268 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B117/10 | O157/21 | O176/22 | O165/14 | O158/13 | O148/9 | O173/15 | O173/18 | O198/16 | O154/6 | O189/15 | O166/9 | O181/18 | O188/17 | O184/19 | O170/14 | O146/10 | O174/15 | O166/18 | O150/11 | O131/2 | O147/7 | O150/6 | O109/6 | P11/N |
| COMP_0269 | 2024-12-21 | 2025-10-09 | 8 | 8 | 7 | X | X | X | B3/1 | G | O188/188 | O497/465 | O302/227 | O208/156 | O328/246 | G | G | O6/3 | B4/N | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0270 | 2026-03-01 | 2026-08-29 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O47/38 | O49/37 | O45/29 | O124/36 | O64/47 | B214/29 | X |
| COMP_0271 | 2026-02-12 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1562/722 | O3190/1740 | O2717/1514 | O2990/1590 | O2989/1532 | O2887/1601 | O2778/1578 | P137/70 |
| COMP_0272 | 2026-02-06 | 2026-08-28 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B26/26 | O35/35 | O27/27 | O26/26 | O29/29 | O26/26 | B12/12 | X |
| COMP_0273 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O4/4 | O6/6 | O4/4 | O5/5 | O2/2 | O2/2 | O1/1 | O9/9 | O6/6 | O4/4 | O8/8 | O2/2 | O6/6 | O6/6 | O2/2 | O6/6 | O21/21 | O16/16 | O13/13 | O19/19 | O11/11 | O2/2 | O11/11 | O10/10 | P2/2 |
| COMP_0274 | 2024-12-17 | 2026-08-31 | 21 | 20 | 20 | X | X | X | B4/1 | O2/N | O13/6 | O11/3 | O14/4 | O14/6 | O8/4 | O5/2 | O6/2 | O4/2 | O7/5 | O12/3 | O6/4 | O3/2 | O9/5 | O8/7 | O8/4 | O7/5 | O10/5 | O4/2 | O9/4 | X |
| COMP_0275 | 2025-12-30 | 2026-08-31 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/6 | O3/1 | O18/8 | O11/6 | O13/7 | O12/7 | O28/15 | O16/6 | O12/7 | X |
| COMP_0276 | 2026-01-28 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/N | O19/N | O88/N | O201/N | O117/N | O112/N | O261/N | O120/N | P7/N |
| COMP_0277 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O204/201 | O191/185 | O165/162 | O179/178 | O191/188 | O167/165 | O183/180 | O139/136 | P15/14 |
| COMP_0278 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B66/66 | O68/68 | O48/48 | O63/63 | O74/74 | O62/62 | O74/74 | O95/95 | O64/64 | O60/60 | O75/75 | O40/40 | O96/96 | O86/86 | O78/78 | O75/75 | O75/75 | O64/64 | O82/82 | O100/100 | O76/76 | O69/69 | O105/105 | O58/58 | P4/4 |
| COMP_0279 | 2024-09-03 | 2026-06-02 | 22 | 22 | 22 | B2/2 | O9/9 | O5/5 | O4/4 | O3/3 | O2/2 | O5/5 | O10/10 | O2/2 | O4/4 | O3/3 | O2/2 | O2/2 | O2/2 | O3/3 | O7/7 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | B1/1 | X | X | X |
| COMP_0280 | 2026-01-23 | 2026-08-26 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B107/9 | O303/13 | O342/11 | O298/11 | O335/5 | O224/8 | O103/15 | B77/7 | X |
| COMP_0281 | 2025-07-28 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B26/26 | O146/146 | O176/176 | O162/162 | O147/147 | O208/208 | O203/203 | O172/172 | O199/199 | O200/200 | O164/164 | O356/231 | O233/233 | O188/188 | P11/11 |
| COMP_0282 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O140/140 | O142/142 | O345/345 | O883/883 | O370/370 | O330/330 | O368/368 | O357/357 | O428/428 | O374/374 | O324/324 | O364/364 | O379/379 | O404/404 | O431/431 | O472/472 | O230/230 | O344/344 | O319/319 | O365/365 | O369/369 | O281/281 | O372/372 | O292/292 | P21/21 |
| COMP_0283 | 2026-01-13 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O204/204 | O186/186 | O9621/9621 | O98/98 | O148/148 | O122/122 | O129/129 | P8/8 |
| COMP_0284 | 2024-09-12 | 2026-08-27 | 14 | 14 | 14 | B1/1 | G | O1/1 | O1/1 | G | G | G | G | G | O2/2 | O2/2 | G | O2/2 | G | G | G | O1/1 | O2/2 | O1/1 | O3/3 | O2/2 | O4/4 | O9/9 | B15/15 | X |
| COMP_0285 | 2024-09-23 | 2026-08-20 | 19 | 19 | 19 | B2/2 | O1/1 | O6/6 | G | O1/1 | G | G | G | O5/5 | O2/2 | O5/5 | O2/2 | O9/9 | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | O4/4 | O3/3 | O2/2 | G | O3/3 | B5/5 | X |
| COMP_0286 | 2026-03-02 | 2026-09-01 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B31/26 | O25/21 | O25/23 | O52/52 | O63/63 | O48/48 | P2/2 |
| COMP_0287 | 2024-09-02 | 2026-08-24 | 24 | 24 | 24 | B9/6 | O11/10 | O12/8 | O5/4 | O8/4 | O6/6 | O7/6 | O5/5 | O9/6 | O14/9 | O7/5 | O3/2 | O5/3 | O5/4 | O6/3 | O6/3 | O3/2 | O1/1 | O4/2 | O6/4 | O4/3 | O14/3 | O9/5 | B2/1 | X |
| COMP_0288 | 2024-09-01 | 2026-02-01 | 18 | 18 | 18 | O341/341 | O352/352 | O319/319 | O312/312 | O321/321 | O198/198 | O201/201 | O221/221 | O231/231 | O215/215 | O232/232 | O86/86 | O11/11 | O17/17 | O2/2 | O1/1 | O1/1 | B1/1 | X | X | X | X | X | X | X |
| COMP_0289 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B20/20 | O32/32 | O30/30 | O42/42 | O34/34 | O24/24 | O50/50 | O71/71 | O37/37 | O34/34 | O42/42 | O34/34 | O48/48 | O60/60 | O48/48 | O51/50 | O42/42 | O47/47 | O71/71 | O64/64 | O70/70 | O61/61 | O77/77 | O61/61 | P3/3 |
| COMP_0290 | 2025-07-14 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B117/117 | O160/160 | O214/214 | O595/595 | O113/113 | O115/115 | O131/131 | O111/111 | O129/129 | O120/120 | O124/124 | O498/498 | O141/141 | O107/107 | P7/7 |
| COMP_0291 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O25/25 | O33/33 | O37/37 | O24/24 | O23/23 | O26/26 | O24/24 | P2/2 |
| COMP_0292 | 2026-01-13 | 2026-08-31 | 8 | 3 | 3 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B102/N | O218/N | O206/N | O148/5 | O245/N | O56/N | O105/5 | O86/6 | X |
| COMP_0293 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B58/58 | O68/68 | O64/64 | O62/62 | O65/65 | O58/58 | O57/57 | O63/63 | O57/57 | O60/60 | O74/74 | O52/52 | O58/58 | O63/63 | O52/52 | O65/65 | O56/56 | O53/53 | O60/60 | O53/53 | O48/48 | O65/65 | O63/63 | O54/54 | P3/3 |
| COMP_0294 | 2025-02-14 | 2026-08-27 | 15 | 15 | 15 | X | X | X | X | X | B3/3 | O6/6 | O5/5 | O3/3 | O2/2 | O5/5 | G | O5/5 | O1/1 | G | O5/5 | O2/2 | G | O4/4 | O2/2 | O8/8 | G | O1/1 | B5/5 | X |
| COMP_0295 | 2026-02-17 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O10/10 | O11/11 | O89/89 | O71/71 | O80/80 | O76/76 | P2/2 |
| COMP_0296 | 2025-07-18 | 2026-08-31 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B5/5 | O3/3 | O3/3 | O6/6 | O3/3 | O6/6 | O4/4 | O4/4 | O4/4 | O5/5 | O2/2 | O6/5 | O6/6 | O6/6 | X |
| COMP_0297 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O98/98 | O57/57 | O60/60 | O59/59 | O80/80 | O49/49 | P4/4 |
| COMP_0298 | 2025-02-27 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B8/8 | O17/17 | O26/26 | O13/13 | O12/12 | O28/28 | O13/13 | O17/17 | O18/18 | O13/13 | O15/15 | O26/26 | O9/9 | O18/18 | O23/23 | O18/18 | O13/13 | O27/27 | O11/11 | X |
| COMP_0299 | 2025-08-28 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B2/1 | O2/1 | O80/70 | O65/60 | O72/62 | O71/62 | O51/48 | O62/55 | O89/75 | O76/62 | O71/60 | O86/63 | O83/70 | P2/2 |
| COMP_0300 | 2025-12-19 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B32/28 | O153/138 | O121/105 | O112/93 | O104/84 | O93/72 | O103/75 | O113/84 | O58/45 | P5/5 |
| COMP_0301 | 2025-10-13 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B41/12 | O75/15 | O75/20 | O85/20 | O67/14 | O104/23 | O59/11 | O80/14 | O121/24 | O75/17 | O90/12 | P6/N |
| COMP_0302 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O26/26 | O27/27 | O31/31 | O31/31 | O59/55 | O61/48 | P4/4 |
| COMP_0303 | 2026-01-19 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B314/314 | O647/647 | O637/637 | O641/641 | O639/639 | O655/655 | O615/615 | O537/537 | P28/28 |
| COMP_0304 | 2025-07-28 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B64/64 | O232/232 | O272/272 | O274/274 | O221/221 | O243/243 | O271/271 | O262/262 | O300/300 | O260/260 | O217/217 | O381/307 | O266/266 | O248/248 | P15/15 |
| COMP_0305 | 2025-11-10 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1007/1007 | O1445/1445 | O1332/1332 | O1268/1268 | O1466/1466 | O1395/1395 | O1425/1424 | O1483/1483 | O1555/1555 | O1383/1383 | P75/75 |
| COMP_0306 | 2024-12-01 | 2026-09-01 | 21 | 0 | 0 | X | X | X | O132/N | O99/N | O109/N | O126/N | O139/N | O141/N | O75/N | O130/N | O98/N | O105/N | O135/N | O103/N | O108/N | O98/N | O87/N | O109/N | O121/N | O107/N | O142/N | O102/N | O83/N | P5/N |
| COMP_0307 | 2024-09-05 | 2025-09-11 | 13 | 13 | 13 | B17/17 | O20/20 | O14/14 | O18/18 | O18/18 | O28/28 | O18/18 | O24/24 | O21/21 | O19/19 | O22/22 | O14/14 | B6/6 | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0308 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B87/83 | O105/96 | O83/75 | O79/75 | O93/85 | O75/70 | O92/88 | O90/82 | O82/76 | O78/75 | O86/81 | O69/65 | O76/73 | O94/86 | O71/65 | O71/68 | O79/74 | O75/71 | O78/74 | O89/85 | O92/86 | O93/89 | O98/92 | O79/75 | P6/6 |
| COMP_0309 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O3/3 | O3/3 | O4/4 | O3/3 | O6/6 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O5/5 | O4/4 | O3/3 | O4/4 | O2/2 | O4/4 | O4/4 | O5/5 | O5/5 | P1/1 |
| COMP_0310 | 2024-09-03 | 2026-08-07 | 24 | 24 | 24 | B21/21 | O22/22 | O20/20 | O18/18 | O15/15 | O27/27 | O20/20 | O28/28 | O24/24 | O23/23 | O18/18 | O22/22 | O21/21 | O21/21 | O15/15 | O21/21 | O21/21 | O22/22 | O16/16 | O14/14 | O11/11 | O17/17 | O6/6 | B4/4 | X |
| COMP_0311 | 2025-08-11 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B87/87 | O119/119 | O226/226 | O189/189 | O171/171 | O113/113 | O46/46 | O41/41 | O176/176 | O75/75 | O106/106 | O167/167 | O130/130 | P7/7 |
| COMP_0312 | 2025-12-22 | 2026-08-07 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B68/68 | O261/261 | O221/221 | O231/231 | O232/232 | O223/223 | O226/226 | O188/188 | B34/34 | X |
| COMP_0313 | 2024-09-10 | 2026-09-01 | 24 | 24 | 24 | B12/10 | O22/18 | O18/17 | O25/22 | O38/36 | O29/28 | O33/32 | O43/42 | O29/28 | O25/25 | O47/38 | O26/25 | O20/17 | O58/35 | O46/32 | O43/39 | O69/60 | O54/51 | O41/41 | O37/35 | O42/40 | O25/20 | O14/12 | O8/4 | P1/1 |
| COMP_0314 | 2024-09-16 | 2026-09-01 | 24 | 15 | 15 | B7/N | O20/1 | O17/N | O24/4 | O53/8 | O30/7 | O55/16 | O51/25 | O52/8 | O43/14 | O47/15 | O56/17 | O58/21 | O59/19 | O35/2 | O54/N | O69/N | O53/N | O59/1 | O73/N | O52/N | O51/N | O66/2 | O39/N | P4/N |
| COMP_0315 | 2025-01-14 | 2026-08-18 | 16 | 16 | 16 | X | X | X | X | B3/3 | G | O2/2 | O1/1 | O2/2 | O2/2 | G | O2/2 | O3/3 | G | G | O1/1 | O2/2 | O2/2 | O2/2 | O3/3 | O3/3 | O5/5 | O2/2 | B3/3 | X |
| COMP_0316 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O40/40 | O69/69 | O51/51 | O52/52 | O68/68 | O39/39 | O55/55 | O65/65 | O47/47 | O31/31 | O41/41 | O26/26 | O29/29 | O33/33 | O22/22 | O88/85 | O54/52 | O62/60 | O56/54 | O61/59 | O54/52 | O50/48 | O88/83 | O60/58 | P6/4 |
| COMP_0317 | 2025-09-02 | 2026-08-10 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O4/4 | O7/7 | O2/2 | O5/5 | O2/2 | O4/4 | O6/6 | O5/5 | O1/1 | O5/5 | B2/2 | X |
| COMP_0318 | 2025-01-08 | 2026-08-31 | 20 | 20 | 20 | X | X | X | X | B1/1 | O7/7 | O16/16 | O11/11 | O12/12 | O11/11 | O11/11 | O10/10 | O9/9 | O18/18 | O20/20 | O11/11 | O21/21 | O15/15 | O23/23 | O31/31 | O23/23 | O35/35 | O30/30 | O24/24 | X |
| COMP_0319 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1169/1169 | O1516/1516 | O1801/1801 | O1746/1746 | O1734/1734 | O1714/1714 | O1824/1824 | O1734/1734 | P87/87 |
| COMP_0320 | 2026-01-28 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/N | O11/11 | O55/55 | O71/71 | O62/62 | O89/88 | O95/94 | O86/85 | P8/8 |
| COMP_0321 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B135/135 | O107/107 | O96/96 | O120/120 | O138/138 | O125/125 | O137/137 | O113/113 | O129/129 | O127/127 | O123/123 | O124/124 | O137/137 | O134/134 | O134/134 | O134/134 | O138/138 | O120/120 | O143/143 | O110/110 | O147/147 | O135/135 | O144/144 | O123/123 | P8/8 |
| COMP_0322 | 2024-10-10 | 2026-09-01 | 23 | 23 | 23 | X | B32/32 | O64/64 | O93/93 | O32/32 | O25/25 | O11/11 | O42/42 | O28/28 | O17/17 | O47/47 | O136/136 | O118/118 | O58/58 | O23/23 | O30/30 | O22/22 | O14/14 | O10/10 | O23/23 | O16/16 | O24/24 | O28/28 | O114/114 | P3/3 |
| COMP_0323 | 2026-01-15 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/N | O20/N | O86/N | O90/N | O93/N | O97/N | O97/N | O79/N | P1/N |
| COMP_0324 | 2026-02-13 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B424/424 | O1158/1158 | O1019/1019 | O968/968 | O971/971 | O926/926 | O795/795 | P39/39 |
| COMP_0325 | 2024-09-17 | 2026-04-15 | 20 | 20 | 20 | B1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B1/1 | X | X | X | X | X |
| COMP_0326 | 2025-03-24 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | B2/2 | G | G | O1/1 | O46/6 | O189/15 | O239/122 | O176/32 | O174/13 | O281/12 | O238/30 | O270/61 | O592/320 | O526/290 | O145/42 | O255/54 | O751/466 | O1037/804 | P34/20 |
| COMP_0327 | 2025-10-18 | 2026-06-09 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | B69/69 | O137/137 | O141/141 | O146/146 | O110/110 | O115/115 | O112/112 | O98/98 | B34/34 | X | X | X |
| COMP_0328 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B40/40 | O43/43 | O36/36 | O35/35 | O39/39 | O38/38 | O40/40 | O25/25 | P3/3 |
| COMP_0329 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O30/30 | O60/60 | O50/50 | O66/66 | O64/64 | O35/35 | O32/32 | O27/27 | O34/34 | O41/41 | O31/31 | O24/24 | O41/41 | O23/23 | O27/27 | O31/31 | O29/29 | O31/31 | O62/62 | O49/49 | O35/35 | O74/74 | O55/55 | O42/42 | P3/3 |
| COMP_0330 | 2025-01-27 | 2026-08-31 | 20 | 20 | 20 | X | X | X | X | B4/4 | O11/11 | O10/10 | O9/9 | O9/9 | O7/7 | O6/6 | O10/10 | O10/10 | O15/15 | O11/11 | O19/19 | O11/11 | O18/18 | O10/10 | O4/4 | O34/34 | O28/28 | O18/18 | O11/11 | X |
| COMP_0331 | 2024-09-17 | 2026-08-25 | 16 | 16 | 16 | B1/1 | O4/4 | O2/2 | O4/4 | O1/1 | O3/3 | O2/2 | O1/1 | O1/1 | G | G | O2/2 | G | O3/3 | O2/2 | G | O1/1 | O1/1 | G | G | O1/1 | G | G | B1/1 | X |
| COMP_0332 | 2025-12-19 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O92/92 | O48/48 | O126/126 | O77/77 | O96/96 | O97/97 | O93/93 | O48/48 | P68/68 |
| COMP_0333 | 2025-02-06 | 2026-08-28 | 19 | 19 | 19 | X | X | X | X | X | B1/1 | O3/3 | O2/2 | O3/3 | O2/2 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O9/9 | O4/4 | O1/1 | O2/2 | O1/1 | O3/3 | O2/2 | O2/2 | B3/3 | X |
| COMP_0334 | 2024-12-19 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B33/33 | O129/129 | O263/210 | O303/241 | O329/275 | O399/309 | O446/360 | O449/360 | O386/297 | O422/320 | O572/502 | O284/203 | O455/374 | O486/370 | O371/252 | O570/410 | O373/268 | O348/275 | O540/436 | O506/427 | O409/316 | P34/33 |
| COMP_0335 | 2025-09-29 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B31/31 | O136/136 | O125/125 | O85/85 | O218/218 | O159/159 | O149/149 | O150/150 | O104/104 | O203/203 | O159/159 | O122/122 | P30/30 |
| COMP_0336 | 2025-06-12 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B121/45 | O130/46 | O71/28 | O86/42 | O166/55 | O129/50 | O162/42 | O133/38 | O131/51 | O155/45 | O180/75 | O121/42 | O97/37 | O135/49 | O167/57 | P8/1 |
| COMP_0337 | 2024-09-01 | 2026-04-16 | 18 | 18 | 18 | O1/1 | O2/2 | O1/1 | O1/1 | O3/3 | O1/1 | O1/1 | O3/3 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O3/3 | O1/1 | O2/2 | O22/22 | G | G | B1/1 | X | X | X | X | X |
| COMP_0338 | 2025-01-21 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B16/16 | O38/38 | O43/43 | O40/40 | O39/39 | O30/30 | O47/47 | O33/33 | O38/38 | O51/51 | O47/47 | O37/37 | O32/32 | O42/42 | O48/48 | O42/42 | O37/37 | O44/44 | O38/38 | O37/37 | P5/5 |
| COMP_0339 | 2025-05-15 | 2026-08-26 | 16 | 0 | 0 | X | X | X | X | X | X | X | X | B6/N | O11/N | O11/N | O10/N | O7/N | O15/N | O15/N | O11/N | O8/N | O12/N | O11/N | O12/N | O11/N | O9/N | O11/N | B11/N | X |
| COMP_0340 | 2024-09-16 | 2026-08-31 | 24 | 24 | 24 | B11/11 | O25/25 | O23/23 | O26/26 | O19/19 | O26/26 | O27/27 | O19/19 | O19/19 | O21/21 | O26/26 | O12/12 | O26/26 | O28/28 | O25/25 | O22/22 | O27/27 | O23/23 | O25/25 | O23/23 | O18/18 | O20/20 | O18/18 | O13/13 | X |
| COMP_0341 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B54/19 | O52/21 | O76/26 | O66/22 | O135/44 | O111/22 | O121/21 | O113/19 | O87/13 | O107/17 | O55/9 | O98/5 | O85/15 | O82/15 | O66/8 | O110/29 | O160/18 | O146/15 | O112/15 | O109/4 | O101/8 | O61/13 | O67/6 | O32/10 | P6/2 |
| COMP_0342 | 2024-10-18 | 2025-12-11 | 15 | 15 | 15 | X | B80/80 | O148/144 | O147/142 | O157/151 | O138/137 | O177/173 | O129/128 | O143/143 | O88/87 | O122/122 | O131/131 | O119/119 | O38/38 | O36/36 | B19/19 | X | X | X | X | X | X | X | X | X |
| COMP_0343 | 2025-01-01 | 2025-10-17 | 10 | 10 | 10 | X | X | X | X | O183/183 | O143/143 | O941/941 | O1073/1073 | O1026/1026 | O1077/1077 | O1228/1228 | O977/977 | O1229/1229 | B178/178 | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0344 | 2025-06-12 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B12/4 | O26/13 | O11/6 | O20/11 | O21/11 | O18/8 | O25/10 | O18/7 | O13/9 | O31/18 | O32/27 | O29/15 | O19/12 | O30/15 | O49/41 | P2/N |
| COMP_0345 | 2026-01-20 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O7/7 | O12/12 | O20/20 | O12/12 | O6/6 | O14/14 | O5/5 | X |
| COMP_0346 | 2025-02-07 | 2026-08-04 | 14 | 14 | 14 | X | X | X | X | X | B3/3 | O4/4 | O15/15 | O6/6 | O4/4 | O10/10 | O1/1 | O2/2 | O2/2 | G | G | O1/1 | G | G | O1/1 | G | O1/1 | O2/2 | B1/1 | X |
| COMP_0347 | 2025-08-18 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B13/13 | O36/36 | O29/29 | O26/26 | O34/34 | O28/28 | O31/31 | O28/28 | O30/30 | O29/29 | O29/29 | O28/28 | O27/27 | P1/1 |
| COMP_0348 | 2026-02-21 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B19/19 | O32/32 | O36/36 | O85/85 | O37/37 | O30/30 | O18/18 | P1/1 |
| COMP_0349 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O14/14 | O9/9 | O5/5 | O32/23 | O61/48 | O30/27 | O49/43 | O44/38 | O42/29 | O61/41 | O54/39 | O40/33 | O54/42 | O31/27 | O41/18 | O36/10 | O50/10 | O28/6 | O37/6 | O44/8 | O34/6 | O38/9 | O51/14 | O30/3 | P2/N |
| COMP_0350 | 2025-05-05 | 2026-09-01 | 16 | 0 | 0 | X | X | X | X | X | X | X | X | B84/N | O156/N | O106/N | O232/N | O151/N | O194/N | O172/N | O150/N | O134/N | O125/N | O48/N | O31/N | O29/N | O26/N | O25/N | O24/N | P1/N |
| COMP_0351 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O715/715 | O885/885 | O1055/1055 | O1029/1029 | O1552/1544 | O1859/1847 | O1110/1094 | O1521/1495 | P118/113 |
| COMP_0352 | 2025-12-31 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O89/84 | O176/170 | O245/232 | O183/178 | O170/166 | O164/157 | O175/170 | O151/147 | P8/7 |
| COMP_0353 | 2025-12-10 | 2026-08-28 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O2/2 | O5/5 | O10/10 | O10/10 | O9/9 | O10/10 | O11/11 | B8/8 | X |
| COMP_0354 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O116/35 | O169/45 | O145/52 | O150/24 | O146/23 | O89/13 | O147/13 | O139/14 | O126/9 | O101/10 | O132/21 | O106/11 | O120/19 | O127/30 | O106/16 | O162/27 | O112/28 | O117/23 | O116/24 | O110/18 | O146/16 | O72/13 | O132/28 | O122/13 | P6/4 |
| COMP_0355 | 2026-01-16 | 2026-08-19 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | G | O1/1 | O1/1 | O7/7 | O3/3 | O5/5 | B1/1 | X |
| COMP_0356 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B15/15 | O82/82 | O79/79 | O89/89 | O115/115 | O107/107 | O144/144 | O159/159 | O157/157 | O147/147 | O143/143 | O128/128 | O131/131 | O126/126 | O129/129 | O124/124 | O151/151 | O116/116 | P4/4 |
| COMP_0357 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B18/18 | O17/17 | O19/19 | O13/13 | O18/18 | O16/16 | O20/20 | O22/22 | O14/14 | O19/19 | O17/17 | O13/13 | O18/18 | O17/17 | O18/18 | O15/15 | O18/18 | O16/16 | O14/14 | O20/20 | O20/20 | O20/20 | O18/18 | O10/10 | P1/1 |
| COMP_0358 | 2025-07-28 | 2026-08-05 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B8/8 | O13/13 | O26/26 | O36/36 | O27/27 | O7/7 | O28/28 | O15/15 | O12/12 | O16/16 | O17/17 | O10/10 | O13/13 | B2/2 | X |
| COMP_0359 | 2024-09-03 | 2026-08-31 | 24 | 0 | 0 | B25/N | O30/N | O23/N | O17/N | O19/N | O22/N | O15/N | O17/N | O15/N | O15/N | O13/N | O15/N | O26/N | O21/N | O12/N | O12/N | O15/N | O15/N | O19/N | O21/N | O12/N | O16/N | O14/N | O11/N | X |
| COMP_0360 | 2026-02-16 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B186/186 | O482/482 | O376/376 | O363/363 | O385/385 | O361/361 | O277/277 | P14/14 |
| COMP_0361 | 2024-09-01 | 2026-08-31 | 24 | 24 | 24 | O193/6 | O196/4 | O188/6 | O201/6 | O203/6 | O177/8 | O197/6 | O299/4 | O361/4 | O310/4 | O275/4 | O272/4 | O291/4 | O301/4 | O276/8 | O188/6 | O175/7 | O256/6 | O194/6 | O135/4 | O95/6 | O55/6 | O51/4 | O47/10 | X |
| COMP_0362 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B136/136 | O282/282 | O189/189 | O219/219 | O184/184 | O188/188 | O244/244 | O189/189 | O241/241 | O172/172 | O175/175 | O172/172 | O120/120 | O221/221 | O142/142 | O163/163 | O125/125 | O123/123 | O138/138 | O138/138 | O101/101 | O178/178 | O137/137 | O161/161 | P11/11 |
| COMP_0363 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B5/5 | O9/9 | O7/7 | O8/8 | O7/7 | O7/7 | O4/4 | O9/9 | O6/6 | O7/7 | O8/8 | O6/6 | O4/4 | O8/8 | O8/8 | O7/7 | O8/8 | O5/5 | O5/5 | O8/8 | O7/7 | O5/5 | O10/10 | O6/6 | P1/1 |
| COMP_0364 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O138/138 | O119/119 | O58/58 | O21/21 | O15/15 | O17/17 | O78/78 | O114/114 | O131/131 | O162/162 | O183/183 | O181/181 | P1/1 |
| COMP_0365 | 2025-12-30 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O98/96 | O133/106 | O207/172 | O274/248 | O226/194 | O265/240 | O325/295 | O288/261 | P17/17 |
| COMP_0366 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B67/62 | O105/99 | O107/97 | O95/91 | O113/106 | O120/93 | O101/96 | O86/78 | P8/8 |
| COMP_0367 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O82/82 | O62/62 | O70/70 | O100/100 | O96/96 | O91/91 | O52/52 | O60/60 | O55/55 | O52/52 | O55/55 | O25/25 | O53/53 | O29/29 | O25/25 | O36/36 | O25/25 | O34/34 | O38/38 | O21/21 | O36/36 | O33/33 | O89/89 | O55/55 | P4/4 |
| COMP_0368 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B18/18 | O24/24 | O39/39 | O37/37 | O37/37 | O33/33 | O32/32 | O29/29 | O35/35 | O34/34 | O34/34 | O34/34 | O30/30 | O40/40 | O37/37 | O36/36 | O34/34 | O42/42 | O37/37 | O33/33 | O38/38 | O35/35 | O30/30 | O35/35 | P2/2 |
| COMP_0369 | 2026-01-20 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O32/32 | O58/56 | O73/72 | O83/82 | O95/92 | O102/101 | O99/98 | P5/5 |
| COMP_0370 | 2025-11-27 | 2026-09-01 | 10 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B25/N | O87/N | O103/2 | O71/3 | O99/2 | O70/2 | O83/2 | O60/4 | O79/3 | O83/2 | P7/1 |
| COMP_0371 | 2026-01-05 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O11/11 | O3/3 | O6/6 | O7/7 | O8/8 | O9/9 | O10/10 | X |
| COMP_0372 | 2025-12-22 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/13 | O53/53 | O46/46 | O51/51 | O43/43 | O32/32 | O36/36 | O44/44 | O29/29 | P1/1 |
| COMP_0373 | 2025-11-21 | 2026-09-01 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B27/N | O280/N | O312/N | O282/N | O325/N | O94/N | O123/N | O64/N | O311/N | O125/N | P6/N |
| COMP_0374 | 2025-11-11 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O2/2 | O9/9 | O9/9 | O10/10 | O8/8 | O4/4 | O9/9 | O37/37 | O38/38 | P1/1 |
| COMP_0375 | 2025-07-29 | 2026-08-31 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B3/3 | O5/5 | O12/12 | O9/9 | O4/4 | O8/8 | O6/6 | O5/5 | O4/4 | O8/8 | O3/3 | O2/2 | O7/7 | O4/4 | X |
| COMP_0376 | 2025-07-18 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B52/52 | O85/85 | O115/115 | O107/107 | O107/107 | O156/156 | O110/110 | O132/132 | O155/155 | O97/92 | O121/121 | O134/134 | O130/130 | O101/101 | P47/47 |
| COMP_0377 | 2025-11-26 | 2026-08-28 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O2/2 | O29/28 | O24/24 | O30/28 | O29/28 | O35/35 | O6/6 | O6/6 | B7/7 | X |
| COMP_0378 | 2025-12-22 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O16/16 | O20/20 | O20/20 | O28/28 | O21/21 | O26/26 | O25/25 | O18/18 | P2/2 |
| COMP_0379 | 2024-09-03 | 2026-05-14 | 21 | 21 | 21 | B22/22 | O25/25 | O25/25 | O31/31 | O36/36 | O31/31 | O29/29 | O35/35 | O23/23 | O28/28 | O32/32 | O30/30 | O31/31 | O28/28 | O34/34 | O29/29 | O27/27 | O32/32 | O21/21 | O6/6 | B2/2 | X | X | X | X |
| COMP_0380 | 2025-02-21 | 2026-07-10 | 11 | 11 | 11 | X | X | X | X | X | B2/2 | O1/1 | O3/3 | O5/5 | G | O12/12 | O2/2 | O3/3 | O5/5 | O1/1 | G | G | G | G | G | O1/1 | G | B1/1 | X | X |
| COMP_0381 | 2024-10-04 | 2026-09-01 | 23 | 23 | 23 | X | B52/52 | O45/45 | O56/56 | O38/38 | O38/38 | O49/49 | O56/56 | O42/42 | O46/46 | O54/54 | O37/37 | O53/53 | O63/63 | O41/41 | O55/55 | O38/38 | O31/31 | O52/52 | O54/54 | O47/47 | O44/44 | O48/48 | O45/45 | P1/1 |
| COMP_0382 | 2025-04-01 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | O5/5 | O3/3 | O2/2 | O3/3 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O4/4 | O1/1 | O1/1 | O1/1 | O1/1 | P1/1 |
| COMP_0383 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O14/14 | O17/17 | O12/12 | O13/13 | O14/14 | O15/15 | O19/19 | O15/15 | O22/22 | O13/13 | O22/22 | O14/14 | O9/9 | O16/16 | O12/12 | O19/19 | O17/17 | O14/14 | O13/13 | O18/18 | O29/29 | O35/35 | O48/48 | O34/34 | P1/1 |
| COMP_0384 | 2024-09-09 | 2026-09-01 | 24 | 24 | 24 | B176/169 | O223/200 | O297/268 | O195/183 | O192/175 | O265/225 | O307/272 | O267/233 | O317/291 | O268/242 | O189/164 | O217/189 | O293/265 | O267/228 | O239/210 | O185/158 | O168/149 | O208/172 | O254/221 | O159/132 | O231/209 | O181/160 | O172/146 | O99/79 | P12/10 |
| COMP_0385 | 2025-05-16 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B222/118 | O429/223 | O477/235 | O524/303 | O453/230 | O450/202 | O455/214 | O483/256 | O433/232 | O403/198 | O445/196 | O470/233 | O484/268 | O564/306 | O493/267 | O446/212 | P32/10 |
| COMP_0386 | 2025-07-14 | 2026-08-27 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | B3/3 | G | G | O4/4 | G | G | O1/1 | O2/2 | O1/1 | O2/2 | O2/2 | O5/5 | O4/4 | B2/2 | X |
| COMP_0387 | 2024-12-27 | 2026-09-01 | 21 | 21 | 20 | X | X | X | B6/N | O2/2 | O44/44 | O29/29 | O48/48 | O85/85 | O54/54 | O82/82 | O67/67 | O59/59 | O67/67 | O68/68 | O53/53 | O68/68 | O54/54 | O61/61 | O58/58 | O77/77 | O51/51 | O72/72 | O49/49 | P10/10 |
| COMP_0388 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B119/119 | O129/129 | O128/128 | O104/104 | O115/115 | O84/84 | O122/122 | O108/108 | O99/99 | O77/77 | O83/83 | O74/74 | O84/84 | O132/132 | O87/87 | O83/83 | O64/64 | O52/52 | O68/68 | O78/78 | O109/109 | O38/38 | O81/81 | O63/63 | P1/1 |
| COMP_0389 | 2025-04-22 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B27/27 | O99/99 | O150/150 | O198/198 | O96/96 | O89/89 | O159/159 | O148/146 | O172/172 | O97/97 | O123/123 | O119/119 | O102/102 | O117/117 | O137/137 | O121/121 | O60/60 | P8/8 |
| COMP_0390 | 2025-01-01 | 2026-08-31 | 20 | 0 | 0 | X | X | X | X | O11/N | O2/N | O4/N | O9/N | O5/N | O6/N | O2/N | O4/N | O3/N | O7/N | O6/N | O4/N | O4/N | O3/N | O6/N | O4/N | O3/N | O8/N | O6/N | O6/N | X |
| COMP_0391 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B19/19 | O17/17 | O24/24 | O41/41 | O45/45 | O21/21 | O30/30 | O10/10 | P1/1 |
| COMP_0392 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B67/67 | O57/57 | O65/65 | O64/64 | O84/84 | O94/94 | O92/92 | O72/72 | O69/69 | O108/108 | O74/74 | O102/102 | O80/80 | O102/102 | O119/119 | O79/79 | O86/86 | O91/91 | O91/91 | O96/96 | P3/3 |
| COMP_0393 | 2025-10-06 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B242/242 | O238/238 | O302/302 | O237/237 | O241/241 | O263/263 | O222/222 | O281/281 | O256/256 | O235/235 | O266/266 | P13/13 |
| COMP_0394 | 2025-10-03 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | O16/16 | O16/16 | O22/22 | O10/10 | O14/14 | O11/11 | O21/21 | O22/22 | O25/25 | O24/24 | P1/1 |
| COMP_0395 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B94/94 | O113/113 | O122/122 | O150/150 | O95/95 | O66/66 | O9/9 | O30/30 | O20/20 | O25/25 | O120/120 | O129/129 | O144/144 | O155/155 | O197/197 | O211/211 | O206/206 | O190/190 | O223/223 | O165/165 | O165/165 | O172/172 | O172/172 | O169/169 | P6/6 |
| COMP_0396 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B27/27 | O22/22 | O24/24 | O21/21 | O19/19 | O20/20 | O28/28 | O28/28 | O23/23 | O38/38 | O34/34 | O20/20 | O13/13 | O14/14 | O18/18 | O13/13 | O9/9 | O14/14 | O7/7 | O12/12 | O9/9 | O18/18 | O19/19 | O7/7 | X |
| COMP_0397 | 2025-03-31 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B4/4 | O306/306 | O96/96 | O106/106 | O119/119 | O88/88 | O103/103 | O115/115 | O113/113 | O112/112 | O98/98 | O85/85 | O127/127 | O108/108 | O113/113 | O67/67 | O95/95 | O129/129 | P4/4 |
| COMP_0398 | 2025-01-01 | 2026-05-02 | 17 | 17 | 17 | X | X | X | X | O28/28 | O14/14 | O17/17 | O17/17 | O17/17 | O24/24 | O63/63 | O93/93 | O71/71 | O85/85 | O53/53 | O45/45 | O35/35 | O34/34 | O24/24 | O20/20 | B2/2 | X | X | X | X |
| COMP_0399 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O886/363 | O870/360 | O481/245 | O200/117 | O154/103 | O507/304 | O775/416 | O916/430 | O949/442 | O972/445 | O1056/498 | O968/450 | O1116/574 | O1137/623 | O581/352 | O218/148 | O206/149 | O565/377 | O958/524 | O1113/551 | O1254/624 | O1040/677 | O1281/595 | O1289/636 | P49/18 |
| COMP_0400 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O36/36 | O50/50 | O42/42 | O46/46 | O33/33 | O28/28 | O31/31 | O34/34 | O36/36 | O20/20 | O15/15 | O29/29 | O18/18 | O26/26 | O23/23 | O39/39 | O39/39 | O13/13 | O16/16 | O13/13 | O16/16 | O9/9 | O17/17 | O10/10 | P4/4 |
| COMP_0401 | 2025-09-22 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B14/14 | O31/31 | O39/39 | O47/47 | O43/43 | O31/31 | O34/34 | O30/30 | O40/40 | O24/24 | O37/37 | O31/31 | P1/1 |
| COMP_0402 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B25/8 | O312/83 | O342/80 | O251/54 | O317/92 | O354/104 | O324/101 | O348/112 | O373/133 | O336/114 | O340/95 | O369/138 | O325/106 | O346/119 | O348/90 | O245/58 | P25/7 |
| COMP_0403 | 2025-10-13 | 2026-08-25 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O33/33 | O24/24 | O30/30 | O29/29 | O45/45 | O22/22 | O6/6 | O1/1 | O1/1 | B1/1 | X |
| COMP_0404 | 2024-10-12 | 2026-09-01 | 23 | 0 | 0 | X | B60/N | O109/N | O136/N | O163/N | O158/N | O200/N | O172/N | O207/N | O207/N | O224/N | O208/N | O207/N | O241/N | O333/N | O412/N | O405/N | O271/N | O245/N | O215/N | O223/N | O198/N | O154/N | O162/N | P6/N |
| COMP_0405 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O240/240 | O230/230 | O203/203 | O232/232 | O236/236 | O202/202 | O234/234 | O181/181 | O179/179 | O153/153 | O93/93 | O75/75 | O93/93 | O120/120 | O105/105 | O89/89 | O95/95 | O90/90 | O101/101 | O93/93 | O76/76 | O95/95 | O106/106 | O84/84 | P9/9 |
| COMP_0406 | 2026-01-26 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B267/266 | O872/859 | O1001/993 | O887/877 | O1139/1126 | O1406/1396 | O1461/1443 | O907/901 | P46/46 |
| COMP_0407 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O139/102 | O183/128 | O90/53 | O91/67 | O96/65 | O47/39 | O52/45 | O47/43 | O86/80 | O91/80 | O52/49 | O57/50 | O63/54 | O74/65 | O92/83 | O64/61 | O67/60 | O67/56 | O76/72 | O42/34 | P2/2 |
| COMP_0408 | 2026-02-19 | 2026-08-31 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B10/N | O26/N | O16/N | O17/N | O21/N | O21/N | O21/N | X |
| COMP_0409 | 2026-01-05 | 2026-08-14 | 8 | 1 | 1 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B480/2 | O485/N | O553/N | O470/N | O531/N | O489/N | O660/N | B349/N | X |
| COMP_0410 | 2024-09-23 | 2026-08-27 | 24 | 24 | 24 | B11/11 | O21/21 | O35/35 | O22/22 | O24/24 | O23/23 | O26/26 | O19/19 | O22/22 | O22/22 | O25/25 | O23/23 | O27/27 | O32/32 | O25/25 | O22/22 | O18/18 | O26/26 | O30/30 | O23/23 | O27/27 | O25/25 | O28/28 | B22/22 | X |
| COMP_0411 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O548/499 | O571/514 | O496/427 | O470/414 | O452/408 | O514/462 | O468/405 | O606/554 | O592/539 | O652/586 | O443/408 | O474/429 | O649/588 | O719/636 | O542/458 | O652/592 | O500/457 | O565/510 | O619/570 | O694/644 | O558/502 | O623/550 | O388/362 | O430/397 | P25/25 |
| COMP_0412 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O28/28 | O24/24 | O22/22 | O20/20 | O16/16 | O14/14 | O23/23 | O46/46 | O61/61 | O69/69 | O98/98 | O82/82 | O50/50 | O30/30 | O14/14 | O34/34 | O31/31 | O34/34 | O50/50 | O52/52 | O36/36 | O35/35 | O79/79 | O89/89 | P2/2 |
| COMP_0413 | 2026-01-20 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B20/20 | O70/70 | O125/125 | O241/241 | O195/195 | O227/227 | O271/271 | O149/149 | P12/12 |
| COMP_0414 | 2025-02-03 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B56/56 | O182/182 | O67/67 | O56/56 | O48/48 | O134/134 | O11/11 | O86/86 | O90/90 | O98/98 | O132/132 | O136/136 | O21/21 | O204/204 | O27/27 | O151/132 | O93/93 | O116/116 | O89/89 | X |
| COMP_0415 | 2026-04-10 | 2026-09-01 | 5 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B66/66 | O201/201 | O159/147 | O107/102 | O75/74 | P7/6 |
| COMP_0416 | 2025-10-31 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O74/74 | O74/74 | O79/79 | O79/79 | O78/78 | O80/80 | O68/68 | O74/74 | O98/98 | O72/72 | P14/14 |
| COMP_0417 | 2025-01-02 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B36/36 | O27/27 | O36/36 | O29/29 | O28/28 | O31/31 | O41/41 | O29/29 | O43/43 | O38/38 | O39/39 | O42/42 | O32/32 | O35/35 | O49/49 | O36/36 | O37/37 | O35/35 | O40/40 | O29/29 | P5/5 |
| COMP_0418 | 2024-09-18 | 2026-09-01 | 24 | 24 | 24 | B30/30 | O24/24 | O32/32 | O50/50 | O37/37 | O12/12 | O23/23 | O32/32 | O37/37 | O27/27 | O32/32 | O24/24 | O19/19 | O41/41 | O26/26 | O11/11 | O37/37 | O39/39 | O21/21 | O17/17 | O43/43 | O43/43 | O25/25 | O11/11 | P1/1 |
| COMP_0419 | 2026-02-13 | 2026-08-28 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/N | O26/N | O18/N | O19/N | O20/N | O15/N | B21/N | X |
| COMP_0420 | 2026-01-20 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O36/36 | O79/79 | O73/73 | O65/65 | O100/100 | O108/108 | O65/65 | P10/10 |
| COMP_0421 | 2025-09-05 | 2026-07-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O1/1 | O4/4 | O1/1 | O2/2 | O2/2 | O4/4 | O2/2 | O1/1 | O1/1 | B1/1 | X | X |
| COMP_0422 | 2025-07-29 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | B1/1 | G | O4/4 | O13/13 | O19/19 | O28/28 | O47/47 | O46/46 | O53/53 | O44/44 | O48/48 | O46/46 | O41/41 | O43/43 | P1/1 |
| COMP_0423 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B13/13 | O12/12 | O13/13 | O11/11 | O12/12 | O12/12 | O10/10 | O12/12 | O9/9 | O6/6 | O17/17 | O10/10 | O6/6 | O21/17 | O8/8 | O12/12 | O11/11 | O4/4 | O13/13 | O14/14 | O7/7 | O7/7 | O10/10 | O6/6 | X |
| COMP_0424 | 2024-12-19 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B12/12 | O18/18 | O14/14 | O10/10 | O15/15 | O14/14 | O20/20 | O16/16 | O15/15 | O16/16 | O23/23 | O18/18 | O16/16 | O18/18 | O17/17 | O23/23 | O19/19 | O30/30 | O13/13 | O23/23 | O13/13 | P1/1 |
| COMP_0425 | 2024-12-18 | 2026-08-25 | 21 | 21 | 21 | X | X | X | B2/2 | O5/5 | O1/1 | O2/2 | O4/4 | O4/4 | O1/1 | O4/4 | O2/2 | O1/1 | O4/4 | O3/3 | O2/2 | O2/2 | O2/2 | O3/3 | O5/5 | O1/1 | O1/1 | O3/3 | B4/4 | X |
| COMP_0426 | 2026-01-19 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O9/9 | O7/7 | O7/7 | O7/7 | O8/8 | O7/7 | O8/8 | P1/1 |
| COMP_0427 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O51/51 | O59/59 | O37/37 | O51/51 | O41/40 | O45/45 | O45/42 | O49/49 | O49/49 | O41/41 | O49/49 | O41/41 | O69/65 | O94/94 | O46/45 | O52/52 | O39/39 | O36/35 | O46/46 | O39/38 | O32/32 | O32/32 | O61/60 | O44/44 | P4/4 |
| COMP_0428 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O40/40 | O40/40 | O32/32 | O42/42 | O41/41 | O36/36 | O35/35 | O28/28 | O41/41 | O37/37 | O37/37 | O34/34 | O47/47 | O47/47 | O52/52 | O68/68 | O56/56 | O34/34 | O37/37 | O30/30 | O40/40 | O31/31 | O59/59 | O33/33 | P3/3 |
| COMP_0429 | 2025-04-29 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B1/1 | O5/5 | O7/7 | O12/12 | O3/3 | O4/4 | O12/12 | O3/3 | O5/5 | O6/6 | O3/3 | O3/3 | O3/3 | O5/5 | O5/5 | O8/8 | O4/4 | P1/1 |
| COMP_0430 | 2025-12-19 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B42/42 | O88/88 | O207/207 | O183/183 | O115/115 | O143/143 | O169/169 | O172/172 | O156/156 | P2/2 |
| COMP_0431 | 2024-11-26 | 2026-08-31 | 22 | 22 | 21 | X | X | B1/N | O40/35 | O36/35 | O32/27 | O41/36 | O33/25 | O33/27 | O48/46 | O47/37 | O36/31 | O36/32 | O43/32 | O34/25 | O39/29 | O32/25 | O43/31 | O29/23 | O34/28 | O30/24 | O30/22 | O31/23 | O21/17 | X |
| COMP_0432 | 2024-12-31 | 2026-08-18 | 21 | 21 | 21 | X | X | X | B1/1 | O17/17 | O17/17 | O12/12 | O18/18 | O14/14 | O14/14 | O15/15 | O19/19 | O22/22 | O16/16 | O14/14 | O12/12 | O13/13 | O10/10 | O13/13 | O9/9 | O7/7 | O4/4 | O4/4 | B9/9 | X |
| COMP_0433 | 2024-12-30 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B5/5 | O41/41 | O31/31 | O36/36 | O46/46 | O51/51 | O55/55 | O48/48 | O21/21 | O55/55 | O68/68 | O44/44 | O39/39 | O41/41 | O41/41 | O43/43 | O62/62 | O44/44 | O42/42 | O72/72 | O42/42 | P3/3 |
| COMP_0434 | 2025-01-01 | 2025-10-30 | 10 | 10 | 10 | X | X | X | X | O90/90 | O82/82 | O80/80 | O167/167 | O122/122 | O105/105 | O158/158 | O83/83 | O96/96 | B2/2 | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0435 | 2026-01-20 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B10/10 | O13/13 | O64/64 | O176/176 | O402/402 | O177/177 | O99/99 | O44/44 | P9/9 |
| COMP_0436 | 2026-01-20 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B11/11 | O20/20 | O141/141 | O195/195 | O237/237 | O345/345 | O887/887 | O607/607 | P16/16 |
| COMP_0437 | 2025-07-16 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B56/45 | O53/47 | O48/42 | O56/52 | O114/94 | O106/93 | O54/49 | O53/46 | O67/56 | O70/52 | O101/81 | O111/91 | O83/63 | O71/62 | P7/5 |
| COMP_0438 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O38/38 | O97/97 | O72/72 | O136/136 | O93/93 | O231/231 | O130/130 | O48/48 | O61/61 | O20/20 | O21/21 | O18/18 | O13/13 | O27/27 | O13/13 | O23/23 | O64/64 | O36/36 | O30/30 | O22/22 | O18/18 | O14/14 | O54/54 | O36/36 | P3/3 |
| COMP_0439 | 2026-02-27 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O166/166 | O85/85 | O119/119 | O107/107 | O129/129 | O100/100 | P1/1 |
| COMP_0440 | 2024-09-03 | 2026-05-31 | 21 | 20 | 20 | B11/2 | O20/3 | O14/3 | O22/4 | O19/2 | O15/2 | O15/2 | O18/3 | O14/2 | O14/4 | O15/2 | O12/2 | O11/2 | O19/3 | O16/4 | O24/3 | O22/3 | O5/N | O21/4 | O6/2 | O18/5 | X | X | X | X |
| COMP_0441 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B83/83 | O59/59 | O41/41 | O69/69 | O47/47 | O63/63 | O13/13 | O58/58 | O49/49 | O50/50 | O74/74 | O73/73 | O21/21 | O66/66 | O25/25 | O133/133 | O100/100 | O76/76 | O77/77 | P1/1 |
| COMP_0442 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O131/131 | O111/111 | O133/133 | O126/126 | O93/93 | O100/100 | O111/111 | O121/121 | O109/109 | O141/141 | O121/121 | O103/103 | O133/133 | O117/117 | O95/95 | O129/129 | O106/106 | O143/143 | O126/126 | O111/111 | O162/162 | O146/146 | O145/145 | O108/108 | P5/5 |
| COMP_0443 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B46/46 | O141/141 | O375/375 | O213/213 | O179/179 | O182/182 | O154/154 | O149/149 | O129/129 | P26/26 |
| COMP_0444 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B163/154 | O488/488 | O616/615 | O718/715 | O793/780 | O671/667 | O732/731 | O604/590 | P27/27 |
| COMP_0445 | 2025-07-16 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B41/30 | O47/32 | O62/39 | O56/31 | O50/32 | O56/33 | O41/28 | O67/36 | O67/43 | O55/35 | O44/23 | O41/16 | O44/23 | O44/26 | P2/N |
| COMP_0446 | 2025-10-17 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B513/510 | O848/845 | O903/899 | O923/919 | O876/874 | O1067/1065 | O915/910 | O974/970 | O1026/1024 | O1008/1002 | O631/630 | P16/16 |
| COMP_0447 | 2025-07-17 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B131/126 | O216/211 | O166/152 | O254/252 | O290/274 | O195/187 | O190/186 | O189/185 | O175/171 | O199/190 | O193/192 | O230/224 | O178/176 | O175/172 | P10/10 |
| COMP_0448 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B17/17 | O13/13 | O14/14 | O14/14 | O18/18 | O16/16 | O14/14 | O10/10 | O13/13 | O12/12 | O11/11 | O15/15 | O11/11 | O20/20 | O9/9 | O17/17 | O12/12 | O17/17 | O14/14 | O17/17 | O10/10 | O12/12 | O13/13 | O11/11 | P5/5 |
| COMP_0449 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B66/66 | O116/116 | O99/99 | O143/112 | O88/88 | O84/84 | O70/69 | O113/113 | O132/118 | O84/84 | O92/92 | O76/76 | O88/88 | O91/91 | O99/99 | O150/131 | O124/124 | O124/124 | O162/162 | O145/145 | O174/174 | O181/181 | O207/207 | O185/185 | P10/10 |
| COMP_0450 | 2024-09-02 | 2026-08-12 | 23 | 23 | 23 | B42/39 | O38/34 | O17/17 | O11/11 | O9/4 | O7/7 | O1/1 | O1/1 | O3/3 | O5/5 | O4/4 | O1/1 | O16/13 | O4/3 | O9/8 | O5/5 | O8/8 | O4/4 | O5/5 | G | O2/2 | O4/4 | O2/2 | B1/1 | X |
| COMP_0451 | 2024-09-05 | 2026-06-05 | 15 | 15 | 15 | B10/10 | G | O6/6 | G | O3/3 | O9/9 | O5/5 | G | O13/13 | O6/6 | G | O8/8 | G | O9/9 | O2/2 | O10/10 | G | O6/6 | G | O8/8 | O7/7 | B2/2 | X | X | X |
| COMP_0452 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B51/51 | O45/45 | O99/99 | O81/81 | O92/92 | O51/51 | O78/78 | O41/41 | O63/63 | O97/97 | O88/88 | O88/88 | O76/76 | O106/106 | O80/80 | O120/120 | O85/85 | O90/90 | O98/98 | O96/96 | P1/1 |
| COMP_0453 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B2/2 | O5/5 | O6/6 | O5/5 | O5/5 | O4/4 | O14/14 | O6/6 | O4/4 | O10/10 | O12/12 | O10/10 | O19/19 | O6/6 | O8/8 | O6/6 | O13/13 | O3/3 | O6/6 | O11/11 | O7/7 | P4/4 |
| COMP_0454 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B8/8 | O8/8 | O7/7 | O10/10 | O6/6 | O3/3 | O17/17 | O10/10 | O6/6 | O6/6 | O10/10 | O5/5 | O8/8 | O7/7 | O5/5 | O13/13 | O9/9 | O7/7 | O10/10 | O15/15 | O9/9 | O8/8 | O10/10 | O10/10 | X |
| COMP_0455 | 2024-11-29 | 2026-09-01 | 22 | 22 | 22 | X | X | B1/1 | O17/17 | O27/27 | O35/35 | O30/30 | O31/31 | O48/48 | O35/35 | O34/34 | O29/29 | O25/25 | O39/39 | O32/32 | O37/37 | O40/40 | O48/48 | O40/40 | O40/40 | O46/46 | O43/43 | O43/43 | O43/43 | P1/1 |
| COMP_0456 | 2025-05-30 | 2026-08-31 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B5/5 | O33/33 | O51/51 | O47/47 | O53/53 | O54/54 | O52/52 | O45/45 | O54/54 | O49/49 | O36/36 | O44/44 | O42/42 | O39/39 | O51/51 | O26/26 | X |
| COMP_0457 | 2025-01-09 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B9/9 | O12/12 | O41/41 | O42/42 | O40/40 | O30/30 | O59/59 | O33/33 | O64/64 | O55/55 | O45/45 | O75/75 | O61/61 | O48/48 | O59/59 | O78/78 | O67/67 | O69/69 | O72/72 | O56/56 | P6/6 |
| COMP_0458 | 2025-07-07 | 2026-08-14 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B5/5 | O2/2 | O2/2 | O5/5 | O2/2 | O4/4 | O3/3 | O2/2 | O6/6 | O3/3 | O2/2 | O2/2 | O4/4 | B2/2 | X |
| COMP_0459 | 2025-08-04 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B42/42 | O43/43 | O52/52 | O48/48 | O49/49 | O89/89 | O101/101 | O141/141 | O104/104 | O107/107 | O81/81 | O57/57 | O58/58 | P2/2 |
| COMP_0460 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O246/6 | O223/7 | O207/10 | O211/5 | O192/7 | O169/12 | O206/13 | O185/6 | O172/4 | O140/11 | O122/13 | O45/10 | O41/17 | O39/7 | O27/7 | O30/7 | O44/12 | O26/6 | O33/11 | O32/9 | O29/10 | O25/5 | O22/5 | O18/2 | P3/1 |
| COMP_0461 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O322/322 | O249/249 | O248/203 | O160/160 | O148/129 | O152/152 | O163/163 | O160/160 | O210/196 | O219/219 | O417/417 | O370/370 | O426/426 | O208/208 | O156/156 | O153/153 | O149/149 | O134/134 | O171/171 | O146/135 | O184/184 | O349/349 | O481/481 | O341/341 | P8/8 |
| COMP_0462 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B52/52 | O53/53 | O40/40 | O37/37 | O41/41 | O57/57 | O41/41 | O45/45 | O42/42 | O48/48 | O49/49 | O27/27 | O39/39 | O36/36 | O33/33 | O46/46 | O25/25 | O28/28 | O46/46 | O44/44 | O48/48 | O39/39 | O56/56 | O42/42 | P4/4 |
| COMP_0463 | 2024-09-03 | 2026-09-01 | 24 | 0 | 0 | B52/N | O58/N | O131/N | O111/N | O107/N | O119/N | O134/N | O107/N | O74/N | O120/N | O112/N | O85/N | O121/N | O122/N | O103/N | O109/N | O142/N | O154/N | O143/N | O111/N | O101/N | O107/N | O108/N | O121/N | P4/N |
| COMP_0464 | 2026-02-13 | 2026-09-01 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/N | O4/N | O2/N | O3/N | O4/N | O4/N | O2/N | P1/N |
| COMP_0465 | 2026-01-01 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O2/N | O65/65 | O312/312 | O335/335 | O388/388 | O400/397 | O382/380 | O342/340 | P10/10 |
| COMP_0466 | 2025-01-06 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B119/119 | O150/150 | O161/161 | O156/156 | O173/173 | O139/139 | O195/195 | O141/141 | O173/173 | O164/164 | O165/165 | O158/158 | O149/149 | O185/185 | O331/331 | O305/305 | O255/255 | O304/304 | O214/214 | O258/258 | P11/11 |
| COMP_0467 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B38/38 | O137/137 | O136/136 | O129/129 | O140/140 | O134/134 | O136/136 | O145/145 | O130/130 | O139/139 | O129/129 | O134/134 | O139/139 | O140/140 | O133/133 | O135/135 | O148/148 | O134/134 | P4/4 |
| COMP_0468 | 2026-02-19 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B184/177 | O324/313 | O360/323 | O318/306 | O280/250 | O316/282 | O256/230 | P14/14 |
| COMP_0469 | 2025-11-25 | 2026-09-01 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B11/N | O60/N | O60/N | O102/N | O103/N | O86/N | O120/N | O114/N | O87/N | O92/N | P1/N |
| COMP_0470 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B124/124 | O98/98 | O123/123 | O119/119 | O110/110 | O143/143 | O122/122 | O94/94 | P6/6 |
| COMP_0471 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O175/116 | O144/97 | O119/81 | O199/119 | O163/110 | O189/140 | O159/96 | O126/90 | O129/77 | O136/81 | O158/90 | O107/65 | O126/75 | O139/84 | O145/99 | O122/68 | O200/117 | O116/72 | O160/96 | O133/69 | O138/67 | O146/86 | O136/78 | O118/72 | P9/5 |
| COMP_0472 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B126/126 | O93/93 | O101/101 | O99/99 | O82/82 | O86/86 | O82/82 | O81/81 | P3/3 |
| COMP_0473 | 2025-10-17 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O3/2 | O41/40 | O103/102 | O77/76 | O83/83 | O80/80 | O114/114 | O131/130 | O298/292 | O132/122 | P2/2 |
| COMP_0474 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O82/82 | O95/93 | O85/85 | O79/79 | O81/79 | O85/85 | O80/79 | O89/86 | O87/87 | O84/83 | O103/100 | O51/51 | O73/73 | O102/99 | O83/82 | O75/75 | O94/93 | O83/83 | O84/84 | O90/88 | O81/81 | O100/100 | O114/109 | O47/47 | P3/3 |
| COMP_0475 | 2024-10-16 | 2025-06-13 | 9 | 0 | 0 | X | B1/N | O3/N | O2/N | O9/N | O1/N | O2/N | O1/N | O3/N | B3/N | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0476 | 2024-09-03 | 2026-08-26 | 24 | 24 | 24 | B9/9 | O14/14 | O11/11 | O12/12 | O17/17 | O12/12 | O8/8 | O11/11 | O12/12 | O11/11 | O11/11 | O9/9 | O11/11 | O13/13 | O9/9 | O9/9 | O10/10 | O9/9 | O9/9 | O9/9 | O10/10 | O9/9 | O9/9 | B8/8 | X |
| COMP_0477 | 2026-01-03 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B260/N | O170/N | O216/N | O252/N | O197/N | O181/N | O171/N | O185/N | P6/N |
| COMP_0478 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B10/10 | O117/117 | O121/121 | O92/92 | O115/115 | O145/145 | O130/130 | O116/116 | O131/131 | O116/116 | O103/103 | O100/100 | O102/102 | O123/123 | O107/107 | O100/100 | P12/12 |
| COMP_0479 | 2025-08-11 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B517/N | O861/N | O841/N | O773/N | O632/N | O710/N | O824/N | O917/N | O676/N | O843/N | O473/N | O795/N | O782/N | P34/N |
| COMP_0480 | 2024-09-02 | 2026-08-28 | 24 | 24 | 24 | B64/64 | O70/70 | O63/63 | O54/54 | O21/21 | O19/19 | O19/19 | O20/20 | O31/31 | O48/48 | O51/51 | O67/67 | O43/43 | O41/41 | O53/53 | O35/35 | O44/44 | O45/45 | O37/37 | O26/26 | O47/47 | O31/31 | O67/67 | B38/38 | X |
| COMP_0481 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B564/564 | O652/652 | O580/580 | O678/678 | O452/452 | O614/614 | O574/574 | O636/636 | O634/634 | O580/580 | O738/738 | O347/347 | O348/348 | O353/353 | O326/326 | O410/410 | O268/268 | O316/316 | O381/381 | O339/339 | O293/293 | O369/369 | O387/387 | O258/258 | P25/25 |
| COMP_0482 | 2025-05-20 | 2026-08-31 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B10/10 | O10/10 | O8/8 | O8/8 | O6/6 | O8/8 | O6/6 | O5/5 | O8/8 | O5/5 | O6/6 | O8/8 | O6/6 | O10/10 | O4/4 | O4/4 | X |
| COMP_0483 | 2025-02-10 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B14/14 | O38/38 | O31/31 | O34/34 | O32/32 | O45/45 | O25/25 | O31/31 | O30/30 | O31/31 | O16/16 | O17/17 | O8/8 | O28/28 | O35/35 | O29/29 | O32/32 | O35/35 | O27/27 | X |
| COMP_0484 | 2026-02-19 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B84/51 | O152/72 | O196/82 | O158/69 | O151/59 | O235/98 | O226/60 | P7/2 |
| COMP_0485 | 2025-12-01 | 2026-08-31 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O8/8 | O13/13 | O14/14 | O9/9 | O15/15 | O15/15 | O13/13 | O19/19 | O13/13 | X |
| COMP_0486 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B28/N | O25/N | O23/N | O23/N | O27/N | O25/N | O34/N | O33/N | O30/N | O27/N | O29/N | O25/N | O23/N | O22/N | O18/N | O29/N | O25/N | O18/N | O17/N | O17/N | O16/N | O22/N | O22/N | O23/N | P6/N |
| COMP_0487 | 2025-08-11 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B150/N | O169/N | O226/N | O121/N | O100/N | O94/N | O140/N | O96/N | O96/N | O100/N | O169/N | O336/N | O234/N | P25/N |
| COMP_0488 | 2026-01-21 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B26/26 | O41/41 | O30/30 | O46/46 | O40/40 | O12/12 | O47/47 | O77/77 | P2/2 |
| COMP_0489 | 2025-12-30 | 2026-08-31 | 9 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O3/N | O2/N | O4/N | O9/N | O2/N | O2/N | O1/N | O1/N | X |
| COMP_0490 | 2026-02-19 | 2026-08-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B19/19 | O25/25 | O21/21 | O22/22 | O37/37 | O31/31 | O25/25 | X |
| COMP_0491 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O768/685 | O634/492 | O449/354 | O325/199 | O256/127 | O197/114 | O235/140 | O322/202 | O386/254 | O646/496 | O795/634 | O615/517 | O648/549 | O466/340 | O300/139 | O256/96 | O179/82 | O154/61 | O182/90 | O541/454 | O450/383 | O638/472 | O978/807 | O915/814 | P8/8 |
| COMP_0492 | 2024-09-13 | 2025-10-13 | 10 | 10 | 10 | B1/1 | O2/2 | O1/1 | O6/6 | O23/23 | O9/9 | G | O3/3 | G | O1/1 | O3/3 | G | G | B1/1 | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0493 | 2025-10-21 | 2026-09-01 | 11 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | B15/N | O33/N | O28/N | O36/N | O35/N | O44/N | O36/N | O38/N | O38/N | O35/N | O39/N | P2/N |
| COMP_0494 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B34/34 | O47/47 | O31/31 | O44/44 | O39/39 | O36/36 | O34/34 | O36/36 | O29/29 | O36/36 | O54/54 | O29/29 | O39/39 | O58/58 | O34/34 | O37/37 | O41/41 | O32/32 | O37/37 | O45/45 | O40/40 | O78/78 | O85/85 | O59/59 | P4/4 |
| COMP_0495 | 2024-12-31 | 2026-09-01 | 21 | 21 | 20 | X | X | X | B1/N | O85/75 | O77/66 | O78/73 | O88/76 | O93/82 | O61/59 | O109/93 | O94/84 | O92/84 | O98/88 | O95/89 | O81/74 | O74/65 | O84/77 | O82/67 | O96/76 | O80/66 | O86/69 | O91/82 | O68/58 | P4/4 |
| COMP_0496 | 2024-09-25 | 2026-08-28 | 24 | 24 | 24 | B2/2 | O6/6 | O7/7 | O8/8 | O7/7 | O7/7 | O5/5 | O8/8 | O8/8 | O8/8 | O16/16 | O10/10 | O11/11 | O33/20 | O31/15 | O23/15 | O26/16 | O37/14 | O47/30 | O16/12 | O25/11 | O28/18 | O17/12 | B8/8 | X |
| COMP_0497 | 2026-02-03 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O3/3 | O2/2 | O2/2 | O4/4 | O6/6 | O2/2 | P2/2 |
| COMP_0498 | 2025-12-31 | 2026-08-27 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O8/8 | O7/7 | O22/22 | O25/25 | O3/3 | O21/21 | O16/16 | B20/20 | X |
| COMP_0499 | 2026-01-05 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B35/35 | O46/46 | O61/61 | O99/99 | O87/87 | O123/123 | O112/112 | O112/112 | P7/7 |
| COMP_0500 | 2024-10-04 | 2026-08-20 | 23 | 23 | 23 | X | B62/62 | O72/72 | O60/60 | O57/57 | O69/69 | O60/60 | O59/59 | O50/50 | O59/59 | O71/71 | O48/48 | O62/62 | O60/60 | O58/58 | O58/58 | O57/57 | O59/59 | O50/50 | O59/59 | O54/54 | O62/62 | O67/67 | B28/28 | X |
| COMP_0501 | 2026-02-25 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O37/37 | O39/39 | O43/43 | O38/38 | O51/51 | O39/39 | P1/1 |
| COMP_0502 | 2024-09-02 | 2026-09-01 | 22 | 22 | 22 | B6/6 | O36/36 | O38/38 | O19/19 | O7/7 | O2/2 | O6/6 | O8/8 | O6/6 | O3/3 | O7/7 | G | O6/6 | G | O7/7 | O95/84 | O111/111 | O103/103 | O138/136 | O117/116 | O122/122 | O113/113 | O121/121 | O76/76 | P1/1 |
| COMP_0503 | 2025-01-01 | 2026-02-04 | 10 | 10 | 10 | X | X | X | X | O653/653 | O679/679 | O822/822 | O727/727 | O921/921 | O826/826 | O957/957 | O791/791 | O631/631 | G | G | G | G | B2/2 | X | X | X | X | X | X | X |
| COMP_0504 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B75/67 | O120/116 | O120/117 | O88/84 | O89/87 | O68/64 | O67/65 | O83/76 | O112/108 | O190/185 | O88/82 | O83/79 | O73/70 | O136/128 | O100/94 | O93/86 | O107/105 | O59/58 | O56/53 | O65/62 | O73/69 | O90/86 | O117/113 | O49/47 | P4/4 |
| COMP_0505 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B2/1 | O136/53 | O66/33 | O103/51 | O102/46 | O109/50 | O93/44 | O83/34 | O67/24 | O72/33 | O64/24 | O87/37 | O73/32 | O290/256 | O527/493 | O569/539 | O549/501 | O622/601 | O728/684 | O765/678 | O603/508 | P121/83 |
| COMP_0506 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B31/31 | O40/40 | O35/35 | O29/29 | O35/35 | O41/41 | O20/20 | O30/30 | O27/27 | O30/30 | O37/37 | O21/21 | O34/34 | O28/28 | O23/23 | O37/37 | O37/37 | O33/33 | O37/37 | P1/1 |
| COMP_0507 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O33/33 | O29/29 | O24/24 | O37/37 | O41/41 | O30/30 | O48/48 | O16/16 | O33/33 | O39/39 | O49/49 | O37/37 | O27/27 | O40/40 | O49/49 | O31/31 | O26/26 | O18/18 | O31/31 | O13/13 | P1/1 |
| COMP_0508 | 2025-03-21 | 2026-08-31 | 18 | 18 | 18 | X | X | X | X | X | X | B8/8 | O11/11 | O16/16 | O25/25 | O23/23 | O4/4 | O14/14 | O22/22 | O15/15 | O17/17 | O9/9 | O11/11 | O12/12 | O11/11 | O7/7 | O13/13 | O8/8 | O9/9 | X |
| COMP_0509 | 2024-09-10 | 2026-08-31 | 24 | 24 | 24 | B9/9 | O12/12 | O12/12 | O9/9 | O12/12 | O9/9 | O8/8 | O19/19 | O7/7 | O11/11 | O5/5 | O6/6 | O10/10 | O12/12 | O19/19 | O8/8 | O10/10 | O11/11 | O10/10 | O12/12 | O22/22 | O13/13 | O6/6 | O5/5 | X |
| COMP_0510 | 2024-12-26 | 2026-06-12 | 17 | 17 | 17 | X | X | X | B2/2 | O5/5 | O2/2 | O3/3 | O5/5 | O3/3 | G | O6/6 | O2/2 | O3/3 | O2/2 | O1/1 | O3/3 | O1/1 | G | O4/4 | O1/1 | O3/3 | B1/1 | X | X | X |
| COMP_0511 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O27/27 | O30/30 | O37/37 | O39/37 | O38/38 | O36/36 | O53/52 | O67/65 | O60/59 | O65/64 | O79/77 | O29/27 | O39/37 | O93/91 | O46/44 | O65/63 | O55/54 | O47/47 | O40/39 | O38/38 | O47/47 | O69/69 | O152/152 | O39/38 | P4/4 |
| COMP_0512 | 2025-02-05 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B38/38 | O106/106 | O55/55 | O66/65 | O79/78 | O79/79 | O43/43 | O85/85 | O95/95 | O63/63 | O101/101 | O68/68 | O74/74 | O113/113 | O94/94 | O83/83 | O116/116 | O98/98 | O79/79 | P2/2 |
| COMP_0513 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B26/26 | O32/32 | O25/25 | O39/39 | O31/31 | O40/40 | O97/97 | O69/69 | O42/42 | O28/28 | O32/32 | O22/22 | O29/29 | O41/41 | O121/121 | O38/38 | O60/60 | O21/21 | O17/17 | O18/18 | O17/17 | O13/13 | O15/15 | O12/12 | P1/1 |
| COMP_0514 | 2026-02-10 | 2026-08-12 | 7 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/2 | O9/2 | O12/6 | O3/2 | O8/2 | O9/N | B2/N | X |
| COMP_0515 | 2025-08-15 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B292/271 | O763/706 | O782/718 | O717/668 | O854/800 | O964/929 | O871/827 | O825/786 | O813/761 | O739/689 | O798/758 | O858/799 | O661/603 | P31/30 |
| COMP_0516 | 2025-08-11 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B158/158 | O299/299 | O540/538 | O388/387 | O369/362 | O354/348 | O292/288 | O456/451 | O580/580 | O354/354 | O483/483 | O288/288 | O98/98 | P27/26 |
| COMP_0517 | 2024-12-31 | 2026-08-12 | 21 | 21 | 20 | X | X | X | B1/1 | O435/388 | O431/388 | O532/489 | O466/404 | O608/532 | O537/478 | O598/508 | O474/385 | O576/499 | O641/499 | O618/547 | O469/424 | O475/383 | O481/425 | O655/590 | O604/500 | O47/2 | O75/8 | O39/1 | B42/N | X |
| COMP_0518 | 2024-09-14 | 2026-09-01 | 24 | 24 | 24 | B92/92 | O190/190 | O172/169 | O286/258 | O286/209 | O185/151 | O291/247 | O261/225 | O316/269 | O273/245 | O284/243 | O363/313 | O271/231 | O230/192 | O261/167 | O201/98 | O174/59 | O163/75 | O243/139 | O245/136 | O240/133 | O238/117 | O206/87 | O212/94 | P11/5 |
| COMP_0519 | 2024-09-01 | 2026-08-25 | 24 | 24 | 24 | O302/200 | O418/305 | O370/269 | O332/234 | O376/270 | O329/219 | O346/280 | O317/246 | O314/254 | O333/271 | O297/228 | O257/191 | O339/284 | O408/347 | O342/276 | O116/91 | O16/16 | O11/11 | O14/14 | O15/15 | O9/9 | O4/4 | O5/5 | B4/4 | X |
| COMP_0520 | 2025-07-14 | 2026-08-27 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | B5/5 | G | O3/3 | O3/3 | O6/6 | O7/7 | O7/7 | O8/8 | O7/7 | O15/15 | O13/13 | O10/10 | O10/10 | B8/8 | X |
| COMP_0521 | 2025-01-02 | 2026-08-31 | 20 | 0 | 0 | X | X | X | X | B49/N | O78/N | O62/N | O72/N | O61/N | O79/N | O64/N | O57/N | O63/N | O32/N | O57/N | O40/N | O52/N | O66/N | O32/N | O54/N | O42/N | O35/N | O32/N | O20/N | X |
| COMP_0522 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B112/112 | O177/177 | O239/239 | O205/205 | O179/179 | O200/182 | O223/223 | O247/229 | O248/248 | O213/213 | O189/189 | O134/134 | O233/233 | O210/210 | O238/238 | O220/220 | O236/236 | O259/259 | O228/228 | O193/193 | O210/210 | O184/184 | O135/135 | O127/127 | P3/3 |
| COMP_0523 | 2025-12-30 | 2026-08-31 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O89/89 | O93/93 | O408/408 | O86/86 | O89/89 | O116/116 | O108/108 | O103/103 | X |
| COMP_0524 | 2026-03-02 | 2026-09-01 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B42/38 | O53/53 | O47/42 | O88/79 | O75/68 | O27/25 | P6/6 |
| COMP_0525 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B65/56 | O188/134 | O191/140 | O264/165 | O51/36 | O16/14 | O11/3 | O6/6 | O3/2 | O6/6 | O4/3 | O12/12 | O6/6 | O6/6 | O3/3 | O4/4 | O2/2 | O1/1 | O4/4 | O3/3 | O6/5 | O2/2 | O1/1 | O3/3 | X |
| COMP_0526 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B84/84 | O229/229 | O244/244 | O223/223 | O244/244 | O235/235 | O250/250 | O253/253 | O240/240 | O273/273 | O254/254 | O254/254 | O257/257 | O277/277 | O251/251 | O258/258 | O257/257 | O239/239 | P6/6 |
| COMP_0527 | 2025-01-20 | 2026-07-28 | 17 | 17 | 17 | X | X | X | X | B1/1 | G | G | O1/1 | O15/13 | O18/16 | O5/5 | O11/5 | O3/3 | O19/19 | O6/6 | O20/19 | O19/19 | O5/5 | O2/2 | O8/7 | O4/4 | O4/4 | B4/4 | X | X |
| COMP_0528 | 2026-01-22 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B55/2 | O128/7 | O156/4 | O9/N | O1/1 | O7/1 | O155/5 | O158/2 | P4/N |
| COMP_0529 | 2025-07-20 | 2026-08-28 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | B1/1 | G | G | O3/3 | O1/1 | G | O4/4 | O1/1 | G | O2/2 | O2/2 | O6/6 | O16/16 | B5/5 | X |
| COMP_0530 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B12/12 | O13/13 | O21/21 | O9/9 | O18/18 | O27/27 | O19/19 | O29/29 | O36/36 | O32/32 | O44/44 | O32/32 | O40/40 | O34/34 | O30/30 | O41/41 | O38/38 | O26/26 | O46/46 | O24/24 | O44/44 | O48/48 | O35/35 | O38/38 | P1/1 |
| COMP_0531 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B75/70 | O72/66 | O50/44 | O67/59 | O65/61 | O50/46 | O74/67 | O51/47 | O82/77 | O45/39 | O53/51 | O25/22 | O65/57 | O70/65 | O47/44 | O71/66 | O39/35 | O53/50 | O63/60 | O46/42 | O55/50 | O69/64 | O66/60 | O67/66 | P4/4 |
| COMP_0532 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B7/7 | O12/12 | O11/11 | O11/11 | O10/10 | O10/10 | O7/7 | O9/9 | O8/8 | O6/6 | O10/10 | O6/6 | O11/11 | O13/13 | O9/9 | O15/15 | O15/15 | O15/15 | O13/13 | O14/14 | O13/13 | O15/15 | O12/12 | O11/11 | P2/2 |
| COMP_0533 | 2024-12-27 | 2026-06-10 | 19 | 19 | 19 | X | X | X | B4/4 | O18/18 | O14/14 | O15/15 | O13/13 | O9/9 | O10/10 | O21/21 | O9/9 | O10/10 | O12/12 | O10/10 | O10/10 | O11/11 | O10/10 | O9/9 | O11/11 | O10/10 | B11/11 | X | X | X |
| COMP_0534 | 2025-11-10 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B53/53 | O112/112 | O99/99 | O66/66 | O99/99 | O92/92 | O83/83 | O97/97 | O92/92 | O88/88 | P7/7 |
| COMP_0535 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B91/91 | O128/128 | O162/162 | O103/103 | O77/77 | O87/87 | O121/121 | O118/118 | O101/101 | O104/104 | O112/112 | O113/113 | O199/199 | O255/255 | O214/214 | O213/213 | O308/308 | O189/189 | O197/197 | O223/223 | O194/194 | O215/215 | O232/232 | O194/194 | P16/16 |
| COMP_0536 | 2026-02-17 | 2026-08-31 | 7 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/N | O2/N | O15/12 | O23/19 | O23/23 | O28/28 | O16/16 | X |
| COMP_0537 | 2025-07-21 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B6/6 | O7/7 | O28/28 | O79/79 | O64/64 | O79/79 | O73/73 | O73/73 | O72/72 | O76/76 | O63/63 | O75/75 | O88/88 | O73/73 | P4/4 |
| COMP_0538 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B34/34 | O38/38 | O45/45 | O42/42 | O40/40 | O26/26 | O30/30 | O22/22 | O36/36 | O25/25 | O23/23 | O44/44 | O54/54 | O20/20 | O24/24 | O34/34 | O24/24 | O20/20 | O22/22 | O20/20 | O22/22 | O27/27 | O33/33 | O19/19 | X |
| COMP_0539 | 2024-09-12 | 2026-08-31 | 24 | 24 | 24 | B12/12 | O17/17 | O14/14 | O10/10 | O46/46 | O1/1 | O1/1 | O10/10 | O14/14 | O40/40 | O8/8 | O9/9 | O8/8 | O8/8 | O8/8 | O7/7 | O8/8 | O8/8 | O6/6 | O35/35 | O13/13 | O23/23 | O8/8 | O7/7 | X |
| COMP_0540 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B370/369 | O438/436 | O623/620 | O783/779 | O717/701 | O911/877 | O679/656 | O650/643 | P33/33 |
| COMP_0541 | 2025-08-04 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B71/71 | O69/69 | O67/67 | O91/91 | O98/98 | O109/109 | O91/91 | O53/53 | O76/76 | O73/73 | O60/60 | O61/61 | O57/57 | P3/3 |
| COMP_0542 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B4/4 | O129/129 | O100/100 | O117/117 | O160/160 | O147/147 | O108/108 | O132/132 | O69/69 | O150/150 | O152/152 | O96/96 | O150/150 | O109/109 | O154/154 | O143/143 | O123/123 | O96/96 | O107/107 | O128/128 | O61/61 | P13/13 |
| COMP_0543 | 2025-07-14 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B182/182 | O221/221 | O369/369 | O403/403 | O159/159 | O150/150 | O147/147 | O142/142 | O130/130 | O130/130 | O124/124 | O130/130 | O112/112 | O90/90 | P6/6 |
| COMP_0544 | 2024-12-02 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B302/302 | O326/326 | O276/276 | O280/280 | O209/209 | O223/223 | O230/230 | O180/180 | O145/145 | O169/169 | O204/204 | O252/252 | O308/308 | O267/267 | O238/238 | O197/197 | O217/217 | O183/183 | O193/193 | O214/214 | O163/163 | P15/15 |
| COMP_0545 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B11/11 | O22/22 | O49/49 | O19/19 | O16/16 | O12/12 | O12/12 | O17/17 | O17/17 | O16/16 | O21/21 | O17/17 | O12/12 | O19/19 | O16/16 | O22/21 | O11/11 | O17/17 | O14/14 | O15/15 | O11/11 | O15/15 | O24/24 | O14/14 | P1/1 |
| COMP_0546 | 2024-12-31 | 2026-08-27 | 21 | 21 | 21 | X | X | X | B1/1 | O7/7 | O2/2 | O6/6 | O3/3 | O2/2 | O5/5 | O3/3 | O7/7 | O4/4 | O7/7 | O4/4 | O4/4 | O1/1 | O6/6 | O4/4 | O1/1 | O3/3 | O5/5 | O3/3 | B10/10 | X |
| COMP_0547 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O35/35 | O37/37 | O43/43 | O47/47 | O31/31 | O47/47 | O42/42 | O23/23 | O53/53 | O55/55 | O50/50 | O41/41 | O54/54 | O46/46 | O38/38 | O49/49 | O37/37 | O44/44 | O60/60 | O28/28 | P4/4 |
| COMP_0548 | 2025-02-05 | 2026-08-31 | 19 | 19 | 19 | X | X | X | X | X | B47/47 | O62/62 | O29/29 | O21/21 | O36/36 | O44/44 | O6/6 | O49/49 | O30/30 | O37/37 | O40/40 | O53/53 | O9/9 | O59/39 | O13/13 | O68/68 | O36/36 | O42/42 | O38/38 | X |
| COMP_0549 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B5/5 | O19/19 | O10/10 | O8/8 | O26/26 | O23/23 | O14/14 | O31/31 | O24/24 | O21/21 | O17/17 | O19/19 | O22/22 | O25/25 | O23/23 | O23/23 | O49/49 | O22/22 | O18/18 | O29/29 | O16/16 | O15/15 | O31/31 | O22/22 | X |
| COMP_0550 | 2026-01-01 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O1/N | O7/5 | O30/30 | O37/37 | O30/30 | O27/25 | O70/59 | O32/31 | P3/3 |
| COMP_0551 | 2026-02-27 | 2026-08-26 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O19/19 | O20/20 | O16/16 | O14/14 | O15/15 | B15/15 | X |
| COMP_0552 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B43/43 | O46/46 | O44/44 | O42/42 | O42/42 | O40/40 | O42/42 | O47/47 | O42/42 | O42/42 | O49/49 | O40/40 | O45/45 | O47/47 | O41/41 | O44/44 | O40/40 | O40/40 | O44/44 | O40/40 | O40/40 | O32/32 | O46/46 | O42/42 | P2/2 |
| COMP_0553 | 2025-02-14 | 2026-08-24 | 19 | 19 | 19 | X | X | X | X | X | B5/5 | O7/7 | O8/8 | O8/8 | O9/9 | O8/8 | O2/2 | O11/11 | O10/10 | O6/6 | O7/7 | O11/11 | O1/1 | O9/9 | O3/3 | O11/11 | O2/2 | O20/20 | B3/3 | X |
| COMP_0554 | 2026-01-14 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B14/14 | O36/36 | O261/261 | O232/232 | O259/259 | O259/259 | O294/294 | O242/242 | P26/26 |
| COMP_0555 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O10/10 | O14/14 | O7/7 | O15/15 | O23/23 | O10/10 | O10/10 | O25/25 | O16/16 | O20/20 | O18/18 | O9/9 | O7/7 | O18/18 | O13/13 | O13/13 | O18/17 | O10/10 | O12/12 | O20/20 | O15/15 | O17/17 | O13/12 | O14/14 | P2/2 |
| COMP_0556 | 2025-04-10 | 2026-09-01 | 17 | 0 | 0 | X | X | X | X | X | X | X | B13/N | O16/N | O23/N | O22/N | O13/N | O14/N | O19/N | O17/N | O17/N | O19/N | O12/N | O33/N | O20/N | O10/N | O22/N | O14/N | O17/N | P4/N |
| COMP_0557 | 2025-05-29 | 2026-07-20 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | B1/1 | G | O6/6 | O1/1 | O1/1 | O1/1 | O2/2 | G | O1/1 | G | O4/4 | O3/3 | O2/2 | G | B1/1 | X | X |
| COMP_0558 | 2026-02-21 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B15/15 | O50/50 | O48/48 | O42/42 | O60/60 | O59/59 | O50/50 | P1/1 |
| COMP_0559 | 2025-05-19 | 2026-09-01 | 16 | 0 | 0 | X | X | X | X | X | X | X | X | B16/N | O35/N | O26/N | O27/N | O21/N | O19/N | O8/N | O6/N | O7/N | O9/N | O7/N | O5/N | O8/N | O6/N | O4/N | O4/N | P1/N |
| COMP_0560 | 2024-12-18 | 2026-09-01 | 20 | 20 | 20 | X | X | X | B3/3 | G | O26/5 | O68/11 | O63/8 | O54/12 | O53/8 | O62/9 | O35/6 | O43/7 | O47/11 | O30/9 | O54/4 | O50/11 | O51/11 | O63/10 | O57/13 | O53/7 | O37/4 | O54/9 | O42/11 | P2/N |
| COMP_0561 | 2025-03-25 | 2026-08-31 | 18 | 18 | 18 | X | X | X | X | X | X | B3/3 | O4/4 | O1/1 | O4/4 | O17/17 | O10/10 | O10/10 | O10/10 | O11/11 | O15/15 | O12/12 | O20/20 | O14/14 | O14/14 | O11/11 | O14/14 | O29/29 | O7/7 | X |
| COMP_0562 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O60/58 | O49/47 | O43/41 | O40/38 | O39/37 | O44/44 | O37/35 | O44/42 | O40/36 | O36/34 | O46/44 | O37/35 | O41/39 | O43/41 | O40/38 | O50/48 | O50/48 | O50/48 | O81/79 | O87/83 | O63/61 | O57/55 | O68/66 | O57/55 | P8/6 |
| COMP_0563 | 2025-01-10 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B10/10 | O23/23 | O14/14 | O18/18 | O15/15 | O16/16 | O15/15 | O19/19 | O21/21 | O24/24 | O18/18 | O19/19 | O8/8 | O22/22 | O15/15 | O35/35 | O10/10 | O11/11 | O21/21 | O15/15 | P4/4 |
| COMP_0564 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B109/107 | O137/137 | O144/143 | O152/139 | O135/134 | O136/136 | O115/112 | O119/119 | O149/148 | O129/127 | O145/145 | O79/79 | O134/133 | O144/144 | O120/120 | O161/161 | O112/112 | O121/121 | O159/159 | O148/148 | O128/128 | O125/125 | O145/145 | O98/98 | P10/10 |
| COMP_0565 | 2025-09-24 | 2026-07-03 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O21/21 | O24/24 | O53/53 | O53/53 | O45/45 | O51/51 | O46/46 | O48/48 | O36/36 | B8/8 | X | X |
| COMP_0566 | 2026-01-08 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B76/N | O96/N | O144/N | O113/N | O100/N | O90/N | O103/N | O125/N | P7/N |
| COMP_0567 | 2025-05-26 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B1/1 | O6/6 | O3/3 | O2/2 | O2/2 | O3/3 | O2/2 | O2/2 | O2/2 | O72/72 | O164/164 | O168/168 | O154/154 | O145/145 | O201/201 | O174/174 | P14/14 |
| COMP_0568 | 2025-01-13 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B195/195 | O252/252 | O504/504 | O314/311 | O401/396 | O196/194 | O231/230 | O122/120 | O197/195 | O178/177 | O177/173 | O175/174 | O115/114 | O91/87 | O96/93 | O64/63 | O64/63 | O32/32 | O63/63 | O33/33 | P5/5 |
| COMP_0569 | 2024-09-09 | 2026-09-01 | 24 | 24 | 24 | B121/121 | O177/177 | O211/211 | O112/112 | O199/199 | O160/160 | O154/154 | O164/164 | O198/198 | O171/171 | O134/134 | O64/64 | O136/136 | O175/175 | O105/105 | O125/125 | O147/147 | O140/140 | O106/106 | O244/243 | O165/165 | O162/158 | O164/163 | O78/78 | P7/7 |
| COMP_0570 | 2026-02-06 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B42/42 | O64/64 | O57/57 | O52/52 | O74/74 | O63/63 | O60/60 | P5/5 |
| COMP_0571 | 2024-09-17 | 2026-08-17 | 24 | 24 | 24 | B1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O5/5 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B1/1 | X |
| COMP_0572 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O5/5 | O2/2 | O2/2 | O4/4 | O1/1 | O1/1 | O6/6 | O2/2 | O2/2 | O2/2 | O1/1 | O1/1 | O3/3 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | O2/2 | P1/1 |
| COMP_0573 | 2024-09-05 | 2026-08-20 | 22 | 0 | 0 | B28/N | O24/N | O30/N | O47/N | O34/N | O38/N | O29/N | O14/N | O9/N | O12/N | O6/N | O7/N | O4/N | O1/N | O2/N | G | O2/N | O4/N | O2/N | O2/N | O2/N | G | O2/N | B2/N | X |
| COMP_0574 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O128/128 | O232/232 | O249/249 | O299/299 | O298/298 | O277/277 | O287/287 | O259/259 | O204/204 | O188/188 | O214/214 | O167/167 | O191/191 | O175/175 | O166/166 | O165/165 | O174/174 | O170/170 | O177/177 | O180/180 | O166/166 | O197/197 | O174/174 | O181/181 | P9/9 |
| COMP_0575 | 2024-10-04 | 2026-08-31 | 23 | 23 | 23 | X | B32/32 | O44/44 | O36/36 | O35/35 | O28/28 | O36/36 | O30/30 | O25/25 | O36/36 | O26/26 | O25/25 | O26/26 | O27/27 | O25/25 | O29/29 | O34/34 | O30/30 | O27/27 | O25/25 | O25/25 | O21/21 | O29/29 | O15/15 | X |
| COMP_0576 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B359/186 | O413/246 | O340/176 | O343/195 | O340/150 | O255/156 | O479/178 | O430/339 | P88/10 |
| COMP_0577 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B13/13 | O64/64 | O61/61 | O63/62 | O69/69 | O86/86 | O106/105 | O124/124 | O111/111 | O118/113 | O116/116 | O112/112 | O114/114 | O109/109 | O105/105 | O106/106 | O111/111 | O105/105 | P4/4 |
| COMP_0578 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B11/11 | O20/20 | O12/12 | O16/16 | O16/16 | O14/14 | O17/17 | O16/16 | O18/18 | O12/12 | O17/17 | O12/12 | O20/20 | O63/63 | O35/35 | O71/71 | O68/68 | O56/56 | O74/74 | O76/76 | O62/62 | O72/72 | O79/79 | O65/65 | P5/5 |
| COMP_0579 | 2024-09-25 | 2026-07-01 | 12 | 0 | 0 | B3/N | O4/N | O1/N | O1/N | G | O2/N | G | O1/N | G | G | G | G | O2/N | O1/N | O1/N | G | G | O2/N | G | G | G | O2/N | B1/N | X | X |
| COMP_0580 | 2026-02-10 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B49/13 | O66/23 | O54/14 | O64/17 | O68/27 | O85/22 | O57/22 | P1/N |
| COMP_0581 | 2024-09-03 | 2026-08-25 | 24 | 24 | 24 | B11/11 | O9/9 | O8/8 | O9/9 | O8/8 | O7/7 | O8/8 | O9/9 | O8/8 | O8/8 | O10/10 | O8/8 | O7/7 | O10/10 | O6/6 | O9/9 | O8/8 | O8/8 | O10/10 | O7/7 | O7/7 | O9/9 | O9/9 | B7/7 | X |
| COMP_0582 | 2024-09-02 | 2026-07-28 | 23 | 23 | 23 | B36/36 | O43/43 | O43/43 | O50/50 | O34/34 | O33/33 | O37/37 | O12/12 | O29/29 | O10/10 | O11/11 | O2/2 | O5/5 | O6/6 | O7/7 | O3/3 | O11/11 | O4/4 | O4/4 | O10/10 | O8/8 | O2/2 | B3/3 | X | X |
| COMP_0583 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B25/25 | O19/19 | O14/14 | O40/40 | O26/26 | O35/35 | O45/45 | O42/42 | O59/59 | O22/22 | O45/45 | O12/12 | O28/28 | O45/45 | O23/23 | O46/46 | O25/25 | O33/33 | O32/32 | O36/36 | O31/31 | O33/33 | O33/33 | O30/30 | P6/6 |
| COMP_0584 | 2025-08-19 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O17/17 | O14/14 | O10/10 | O16/16 | O17/17 | O11/11 | O15/15 | O17/17 | O9/9 | O15/15 | O14/14 | O9/9 | P1/1 |
| COMP_0585 | 2024-09-17 | 2026-08-20 | 14 | 14 | 14 | B2/2 | G | G | O1/1 | G | O1/1 | O1/1 | G | G | G | G | O2/2 | O3/3 | G | O2/2 | O3/3 | O1/1 | O1/1 | O1/1 | O1/1 | G | O1/1 | G | B1/1 | X |
| COMP_0586 | 2026-02-18 | 2026-09-01 | 7 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O118/118 | O143/143 | O146/146 | O108/108 | O156/156 | O138/138 | P4/4 |
| COMP_0587 | 2024-12-10 | 2026-08-10 | 21 | 21 | 21 | X | X | X | B5/5 | O4/4 | O3/3 | O3/3 | O3/3 | O3/3 | O3/3 | O5/5 | O2/2 | O3/3 | O5/5 | O3/3 | O4/4 | O4/4 | O4/4 | O3/3 | O6/6 | O3/3 | O3/3 | O3/3 | B2/2 | X |
| COMP_0588 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O30/9 | O37/10 | O30/8 | O30/15 | O35/23 | O43/27 | O47/28 | O36/17 | O31/15 | O23/12 | O27/15 | O25/15 | O31/19 | O56/38 | O45/25 | O37/24 | O37/21 | O33/23 | O48/36 | O34/21 | O41/28 | O43/33 | O58/43 | O30/21 | P6/2 |
| COMP_0589 | 2026-02-14 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B67/67 | O75/75 | O30/30 | O19/19 | O19/19 | O26/26 | O16/16 | P1/1 |
| COMP_0590 | 2025-10-14 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O4/4 | O14/14 | O33/33 | O39/39 | O68/68 | O61/61 | O58/58 | O70/70 | O56/56 | O58/58 | P5/5 |
| COMP_0591 | 2025-10-13 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B47/47 | O50/50 | O38/38 | O30/30 | O23/22 | O36/36 | O59/59 | O89/79 | O861/847 | O221/206 | O156/154 | P4/4 |
| COMP_0592 | 2025-10-03 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B67/65 | O73/72 | O130/129 | O180/177 | O152/151 | O161/161 | O168/168 | O212/212 | O185/185 | O753/753 | O240/238 | P8/8 |
| COMP_0593 | 2025-06-17 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | B1/1 | O5/5 | G | O16/16 | O17/17 | O138/138 | O164/164 | O176/176 | O225/225 | O228/228 | O212/212 | O218/218 | O189/189 | O190/190 | O59/59 | P5/5 |
| COMP_0594 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O11/11 | O14/14 | O20/20 | O37/37 | O20/20 | O38/38 | O23/23 | O30/30 | O57/57 | O26/26 | O54/54 | O32/32 | O28/28 | O34/34 | O29/29 | O36/36 | O34/34 | O24/24 | O47/47 | O30/30 | O59/59 | O28/28 | O32/32 | O26/26 | P2/2 |
| COMP_0595 | 2024-09-05 | 2026-08-31 | 24 | 24 | 24 | B28/28 | O47/47 | O21/21 | O23/23 | O48/48 | O25/25 | O28/28 | O17/17 | O35/35 | O21/21 | O9/9 | O7/7 | O9/9 | O9/9 | O24/24 | O61/61 | O34/34 | O53/53 | O19/19 | O36/36 | O22/22 | O25/25 | O16/16 | O8/8 | X |
| COMP_0596 | 2024-09-01 | 2026-08-21 | 24 | 24 | 24 | O14/14 | O10/10 | O8/8 | O13/13 | O10/10 | O11/11 | O20/20 | O28/28 | O7/7 | O18/18 | O9/9 | O10/10 | O5/5 | O12/12 | O14/14 | O10/10 | O18/18 | O12/12 | O5/5 | O15/15 | O20/20 | O6/6 | O8/8 | B4/4 | X |
| COMP_0597 | 2025-10-29 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B35/2 | O333/33 | O396/31 | O326/47 | O330/29 | O415/38 | O314/45 | O395/32 | O288/31 | O373/46 | O303/29 | P19/N |
| COMP_0598 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B49/49 | O126/126 | O139/139 | O135/135 | O144/144 | O135/135 | O137/137 | O115/115 | O152/152 | O137/137 | O113/113 | O135/135 | O98/98 | O106/106 | O188/188 | O132/132 | O143/143 | O156/156 | O138/138 | O180/180 | P11/11 |
| COMP_0599 | 2025-07-29 | 2026-07-03 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | B1/1 | O1/1 | O10/10 | O4/4 | O3/3 | O2/2 | O2/2 | O3/3 | G | O3/3 | O1/1 | O1/1 | B1/1 | X | X |
| COMP_0600 | 2025-01-09 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B53/53 | O94/94 | O452/451 | O413/410 | O414/412 | O410/409 | O436/433 | O388/388 | O443/442 | O467/459 | O405/403 | O564/543 | O450/434 | O432/423 | O513/493 | O417/393 | O408/384 | O472/444 | O504/478 | O467/448 | P20/18 |
| COMP_0601 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B10/10 | O17/17 | O18/18 | O17/17 | O15/15 | O18/18 | O11/11 | O8/8 | O9/9 | O15/15 | O12/12 | O6/6 | O9/9 | O11/11 | O14/14 | O10/10 | O18/18 | O9/9 | O15/15 | O9/7 | O10/10 | O9/9 | O10/10 | O10/10 | X |
| COMP_0602 | 2025-01-17 | 2026-08-31 | 20 | 20 | 20 | X | X | X | X | B47/47 | O36/36 | O37/37 | O36/36 | O28/28 | O26/26 | O40/40 | O14/14 | O29/29 | O34/34 | O38/38 | O34/34 | O26/26 | O24/24 | O33/33 | O29/29 | O19/19 | O32/32 | O28/28 | O26/26 | X |
| COMP_0603 | 2026-01-19 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B92/90 | O168/168 | O168/168 | O176/174 | O174/174 | O150/150 | O191/189 | O103/103 | P11/11 |
| COMP_0604 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O372/372 | O395/392 | O340/338 | O319/319 | O341/341 | O269/267 | O354/352 | O283/282 | O275/275 | O331/329 | O291/288 | O213/212 | O316/316 | O272/267 | O252/247 | O294/290 | O308/308 | O252/251 | O276/275 | O265/265 | O179/179 | O256/256 | O306/306 | O161/161 | P12/12 |
| COMP_0605 | 2025-08-04 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B45/N | O47/N | O57/N | O93/N | O71/N | O63/N | O70/N | O82/N | O80/N | O93/N | O67/N | O89/N | O71/N | P3/N |
| COMP_0606 | 2025-05-31 | 2026-02-27 | 9 | 1 | 1 | X | X | X | X | X | X | X | X | B2/N | O1/N | O3/N | O2/N | O4/1 | O57/N | O40/N | G | O23/N | B34/N | X | X | X | X | X | X | X |
| COMP_0607 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O56/56 | O31/31 | O15/15 | O23/23 | O20/20 | O25/25 | O18/18 | O22/22 | O33/33 | O22/22 | O63/63 | O28/28 | O33/33 | O29/29 | O17/17 | O12/12 | O17/17 | O14/14 | O17/17 | O15/15 | P4/4 |
| COMP_0608 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B52/52 | O62/62 | O49/49 | O61/61 | O47/47 | O63/63 | O58/58 | O56/56 | P3/3 |
| COMP_0609 | 2025-01-10 | 2026-08-28 | 20 | 20 | 20 | X | X | X | X | B2/2 | O13/13 | O27/27 | O5/5 | O6/6 | O5/5 | O5/5 | O7/7 | O6/6 | O3/3 | O1/1 | O4/4 | O3/3 | O3/3 | O1/1 | O2/2 | O3/3 | O4/4 | O7/7 | B9/9 | X |
| COMP_0610 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O117/117 | O121/121 | O106/106 | O109/109 | O131/131 | O147/147 | O133/133 | O136/136 | O156/156 | O143/143 | O126/126 | O89/89 | O111/111 | O106/106 | O113/113 | O79/79 | O67/67 | O76/76 | O73/73 | O66/66 | O71/71 | O65/65 | O48/48 | O52/52 | P4/4 |
| COMP_0611 | 2024-10-26 | 2026-08-19 | 14 | 13 | 13 | X | B40/40 | G | O98/98 | O181/40 | O165/121 | O1103/819 | O47/N | O151/98 | G | G | G | G | G | O196/196 | O158/98 | O120/40 | O98/98 | O10000/10000 | O189/49 | G | G | G | B22/22 | X |
| COMP_0612 | 2024-09-01 | 2026-06-08 | 22 | 22 | 22 | O152/134 | O164/159 | O153/129 | O155/133 | O157/137 | O159/153 | O160/154 | O133/125 | O152/123 | O171/164 | O176/160 | O118/110 | O181/172 | O124/119 | O92/88 | O51/43 | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | B3/3 | X | X | X |
| COMP_0613 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O473/473 | O553/553 | O514/514 | O422/422 | O351/351 | O423/423 | O408/408 | O360/360 | O471/471 | O420/420 | O290/290 | O397/397 | O369/369 | O549/549 | O453/453 | O452/452 | O403/403 | O428/428 | O451/451 | O453/453 | O437/437 | O560/560 | O300/300 | O369/369 | P17/17 |
| COMP_0614 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O20/20 | O46/46 | O25/25 | O30/30 | O37/37 | O38/38 | O32/32 | O43/43 | O36/33 | O50/42 | O82/76 | O154/144 | O184/171 | O90/73 | O63/51 | O55/42 | O63/41 | O37/30 | O20/16 | O17/15 | O12/9 | O18/14 | O16/12 | O7/3 | P1/1 |
| COMP_0615 | 2024-10-24 | 2026-09-01 | 23 | 23 | 23 | X | B23/23 | O38/38 | O46/46 | O46/46 | O45/45 | O56/56 | O58/58 | O51/51 | O44/44 | O51/51 | O38/38 | O66/66 | O46/46 | O47/47 | O70/70 | O52/52 | O42/42 | O42/42 | O55/55 | O51/51 | O39/39 | O49/49 | O32/32 | P4/4 |
| COMP_0616 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O806/179 | O922/224 | O848/198 | O1026/202 | O826/176 | O721/112 | O743/105 | O815/155 | O703/95 | O714/133 | O738/115 | O628/91 | O700/115 | O809/128 | O729/116 | O789/162 | O777/139 | O719/182 | O781/189 | O778/191 | O807/189 | O769/173 | O814/171 | O749/185 | P38/7 |
| COMP_0617 | 2025-11-03 | 2026-08-26 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B26/N | O32/N | O33/N | O30/N | O80/N | O14/N | O33/N | O28/N | O29/N | B22/N | X |
| COMP_0618 | 2024-09-05 | 2026-09-01 | 24 | 12 | 12 | B9/N | O13/N | O8/N | O6/N | O14/N | O7/N | O13/N | O8/N | O9/N | O5/N | O17/1 | O8/1 | O9/3 | O16/N | O14/4 | O16/4 | O10/3 | O9/N | O15/3 | O16/1 | O23/3 | O18/2 | O25/1 | O12/2 | P1/N |
| COMP_0619 | 2026-02-24 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O25/25 | O26/26 | O60/60 | O100/100 | O60/60 | O47/47 | P2/2 |
| COMP_0620 | 2025-01-02 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B16/16 | O18/18 | O19/19 | O15/15 | O14/14 | O11/11 | O18/18 | O13/13 | O14/14 | O15/15 | O10/10 | O16/16 | O17/17 | O11/11 | O13/13 | O15/15 | O16/16 | O14/14 | O27/27 | O16/16 | P2/2 |
| COMP_0621 | 2025-06-10 | 2026-09-01 | 15 | 12 | 12 | X | X | X | X | X | X | X | X | X | B22/N | O32/N | O36/N | O42/8 | O64/5 | O42/4 | O62/6 | O62/6 | O51/10 | O41/6 | O56/5 | O50/7 | O50/5 | O63/10 | O85/9 | P15/N |
| COMP_0622 | 2025-10-23 | 2026-06-18 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | B49/49 | O125/125 | O153/153 | O154/154 | O138/138 | O173/173 | O166/166 | O155/155 | B96/96 | X | X | X |
| COMP_0623 | 2025-02-08 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B420/382 | O712/597 | O801/650 | O811/706 | O768/688 | O789/706 | O583/526 | O763/688 | O797/730 | O757/692 | O684/599 | O463/399 | O452/378 | O647/582 | O662/592 | O740/665 | O505/425 | O726/586 | O442/380 | P40/29 |
| COMP_0624 | 2024-09-01 | 2025-11-17 | 15 | 15 | 15 | O721/721 | O559/559 | O185/185 | O256/256 | O270/270 | O208/208 | O367/367 | O685/685 | O864/864 | O777/777 | O977/977 | O768/768 | O918/918 | O847/847 | B316/316 | X | X | X | X | X | X | X | X | X | X |
| COMP_0625 | 2024-09-01 | 2026-05-05 | 18 | 18 | 18 | O13/13 | O14/14 | O15/15 | O11/11 | O18/18 | O15/15 | O7/7 | O6/6 | O2/2 | O5/5 | O7/7 | O1/1 | O1/1 | O5/5 | G | G | O1/1 | O2/2 | O2/2 | G | B1/1 | X | X | X | X |
| COMP_0626 | 2024-09-02 | 2026-08-27 | 24 | 24 | 24 | B8/8 | O22/22 | O11/11 | O22/22 | O17/17 | O9/9 | O24/24 | O10/10 | O22/22 | O16/16 | O12/12 | O20/20 | O12/12 | O36/36 | O18/18 | O14/14 | O24/24 | O21/21 | O15/15 | O10/8 | O22/22 | O8/8 | O12/12 | B18/18 | X |
| COMP_0627 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O567/567 | O554/554 | O356/356 | O121/121 | O62/62 | O280/280 | O489/489 | O543/543 | O587/587 | O615/615 | O609/609 | O612/612 | O602/602 | O508/508 | O258/258 | O166/166 | O178/178 | O284/284 | O470/470 | O568/568 | O626/626 | O679/679 | O661/661 | O708/708 | P25/25 |
| COMP_0628 | 2024-09-23 | 2026-09-01 | 24 | 24 | 24 | B8/8 | O57/57 | O67/67 | O59/59 | O45/45 | O37/37 | O55/55 | O73/73 | O57/57 | O66/66 | O54/54 | O70/70 | O74/74 | O58/58 | O86/86 | O64/64 | O49/49 | O62/62 | O57/57 | O32/32 | O78/78 | O35/35 | O67/67 | O36/36 | P6/6 |
| COMP_0629 | 2024-09-02 | 2026-08-31 | 24 | 0 | 0 | B109/N | O121/N | O106/N | O96/N | O126/N | O152/N | O70/N | O68/N | O67/N | O73/N | O82/N | O86/N | O95/N | O78/N | O67/N | O77/N | O76/N | O89/N | O91/N | O87/N | O112/N | O63/N | O80/N | O102/N | X |
| COMP_0630 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B18/18 | O5/5 | O2/2 | O3/3 | O1/1 | O13/13 | O1495/1481 | O1143/1142 | O1132/1130 | O1122/1121 | O1067/1067 | O1256/1254 | O1322/1304 | O1412/1408 | O1380/1377 | O1318/1316 | O1232/1231 | O1261/1256 | O1528/1516 | O1286/1286 | P106/106 |
| COMP_0631 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B28/28 | O28/28 | O26/26 | O24/24 | O26/26 | O28/28 | O33/33 | O21/21 | O27/27 | O28/28 | O23/23 | O37/37 | O27/27 | O37/37 | O34/34 | O42/42 | O31/31 | O32/32 | O37/37 | O33/33 | P1/1 |
| COMP_0632 | 2025-10-22 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O10/10 | O15/15 | O25/25 | O60/60 | O67/67 | O77/77 | O77/77 | O80/80 | O87/87 | O69/69 | P6/6 |
| COMP_0633 | 2025-10-23 | 2026-06-17 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | B50/48 | O97/94 | O121/117 | O152/141 | O145/141 | O148/147 | O156/154 | O124/120 | B101/98 | X | X | X |
| COMP_0634 | 2025-11-27 | 2026-07-24 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B18/18 | O65/65 | O76/76 | O121/121 | O142/142 | O173/173 | O177/177 | O58/58 | B35/35 | X | X |
| COMP_0635 | 2025-07-28 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B12/12 | O58/58 | O72/72 | O76/76 | O66/66 | O65/65 | O78/78 | O71/71 | O61/61 | O71/71 | O52/52 | O72/72 | O74/74 | O41/41 | P6/6 |
| COMP_0636 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O217/217 | O237/237 | O223/223 | O189/189 | O264/264 | O208/208 | O247/247 | O207/207 | O218/218 | O194/194 | O243/243 | O189/189 | O211/211 | O213/213 | O188/188 | O211/211 | O216/216 | O209/209 | O263/263 | O210/210 | O173/173 | O174/174 | O221/221 | O178/178 | P11/11 |
| COMP_0637 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B54/54 | O59/59 | O89/89 | O80/80 | O85/85 | O81/81 | O81/81 | O73/73 | O79/79 | O75/75 | O79/79 | O80/80 | O88/88 | O77/77 | O83/83 | O85/85 | O88/88 | O68/68 | O75/75 | O72/72 | O83/83 | O48/48 | O101/101 | O79/79 | P3/3 |
| COMP_0638 | 2024-10-07 | 2026-08-31 | 23 | 23 | 23 | X | B66/66 | O24/24 | O45/45 | O25/25 | O11/11 | O8/8 | O17/17 | O14/14 | O63/63 | O62/62 | O92/92 | O64/64 | O101/101 | O19/19 | O42/42 | O27/27 | O182/182 | O15/15 | O15/15 | O18/18 | O84/84 | O74/74 | O107/107 | X |
| COMP_0639 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O501/428 | O543/474 | O289/221 | O245/199 | O211/176 | O216/160 | O244/158 | O368/297 | O500/422 | O485/420 | O522/456 | O505/440 | O509/443 | O551/483 | O290/239 | O218/172 | O241/197 | O353/297 | O387/315 | O594/524 | O722/652 | O713/645 | O805/733 | O756/688 | P36/33 |
| COMP_0640 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O9/9 | O20/20 | O14/14 | O17/17 | O19/19 | O30/30 | O20/20 | O26/26 | O12/12 | O38/38 | O25/25 | O10/10 | O13/13 | O13/13 | O18/18 | O45/45 | O17/17 | O11/11 | O9/9 | O21/21 | O13/13 | O13/13 | O24/24 | O8/8 | P2/2 |
| COMP_0641 | 2024-09-02 | 2026-08-31 | 24 | 0 | 0 | B20/N | O17/N | O20/N | O12/N | O22/N | O24/N | O21/N | O30/N | O32/N | O29/N | O41/N | O17/N | O20/N | O38/N | O30/N | O56/N | O38/N | O34/N | O38/N | O28/N | O35/N | O80/N | O52/N | O50/N | X |
| COMP_0642 | 2025-06-02 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B1/1 | O11/11 | O2/2 | O2/2 | O5/5 | O2/2 | O3/3 | O3/3 | O1/1 | O3/3 | O3/3 | O1/1 | O5/5 | O8/8 | O30/30 | P1/1 |
| COMP_0643 | 2026-02-09 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B28/23 | O32/21 | O33/22 | O14/6 | O72/40 | O25/14 | O29/21 | P1/N |
| COMP_0644 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O39/39 | O53/53 | O30/30 | O34/34 | O46/46 | O21/21 | O34/34 | O23/23 | P2/2 |
| COMP_0645 | 2025-02-19 | 2026-07-24 | 15 | 15 | 15 | X | X | X | X | X | B1/1 | O15/15 | O4/4 | G | O17/17 | O6/6 | G | O17/17 | O4/4 | O3/3 | O19/19 | O6/6 | O3/3 | O16/16 | O2/2 | G | O13/13 | B9/9 | X | X |
| COMP_0646 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O171/171 | O180/180 | O154/154 | O111/111 | O143/143 | O202/202 | O636/636 | O1530/1530 | O1675/1675 | O1488/1488 | O1626/1626 | O922/922 | O659/659 | O661/661 | O572/572 | O538/538 | O597/597 | O569/569 | O750/750 | O514/514 | O447/447 | O503/503 | O498/498 | O393/393 | P24/24 |
| COMP_0647 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B213/213 | O249/249 | O214/214 | O212/212 | O220/220 | O205/205 | O238/238 | O206/206 | O252/252 | O237/237 | O305/305 | O204/204 | O260/260 | O261/261 | O227/227 | O200/200 | O199/199 | O194/194 | O290/290 | O254/254 | O243/243 | O262/262 | O271/271 | O224/224 | P10/10 |
| COMP_0648 | 2025-07-14 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B125/125 | O166/166 | O191/191 | O166/166 | O129/129 | O122/122 | O132/132 | O117/117 | O126/126 | O124/124 | O117/117 | O124/124 | O138/138 | O99/99 | P8/8 |
| COMP_0649 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B64/64 | O69/69 | O54/54 | O66/66 | O70/70 | O65/65 | O68/68 | O86/86 | O63/63 | O57/57 | O58/58 | O54/54 | O62/62 | O59/59 | O48/48 | O64/64 | O62/62 | O59/59 | O67/67 | O73/73 | O53/53 | O79/79 | O64/64 | O53/53 | P4/4 |
| COMP_0650 | 2025-06-18 | 2026-07-20 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | B4/4 | O4/4 | G | O2/2 | O6/6 | O4/4 | O2/2 | O2/2 | O2/2 | O2/2 | O3/3 | O1/1 | O1/1 | B1/1 | X | X |
| COMP_0651 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O298/298 | O285/285 | O332/332 | O353/353 | O403/403 | O556/556 | O778/778 | O571/571 | O574/574 | O535/535 | O591/591 | O1307/1307 | O1571/1488 | O1413/1413 | O1671/1661 | O1415/1415 | O1395/1395 | O1337/1337 | O1407/1407 | O1045/1045 | P51/51 |
| COMP_0652 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B46/46 | O44/44 | O45/45 | O52/52 | O65/65 | O71/71 | O68/68 | O52/52 | O55/55 | O86/86 | O46/46 | O77/77 | O76/76 | O59/59 | O76/76 | O71/71 | O86/86 | O78/78 | O94/94 | O68/68 | P1/1 |
| COMP_0653 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B10/10 | O33/33 | O72/72 | O20/20 | O31/30 | O55/53 | O10/9 | O49/48 | O62/61 | O16/16 | O60/57 | O85/85 | O20/20 | O54/53 | O69/68 | O30/28 | O48/48 | O76/75 | O32/28 | O77/76 | O87/86 | O51/51 | O78/78 | O91/90 | X |
| COMP_0654 | 2025-10-03 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B118/118 | O126/126 | O150/150 | O53/53 | O108/108 | O159/159 | O182/182 | O191/191 | O159/159 | O104/104 | O74/74 | P4/4 |
| COMP_0655 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B22/22 | O92/92 | O83/83 | O81/81 | O101/101 | O80/80 | O91/91 | O80/80 | O70/70 | O80/80 | O85/85 | O91/91 | O98/98 | O86/86 | O86/86 | O90/90 | O91/91 | O88/88 | P4/4 |
| COMP_0656 | 2025-08-28 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O5/5 | O327/275 | O350/298 | O336/274 | O388/321 | O328/284 | O357/313 | O378/322 | O364/289 | O360/281 | O407/314 | O315/253 | P14/11 |
| COMP_0657 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B31/31 | O22/22 | O36/36 | O33/33 | O27/27 | O38/38 | O42/42 | O27/27 | O37/37 | O53/53 | O38/38 | O32/32 | O24/24 | O48/48 | O44/44 | O42/42 | O35/35 | O37/37 | O33/33 | O40/40 | P1/1 |
| COMP_0658 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B90/N | O76/N | O75/N | O60/N | O76/N | O96/N | O59/N | O84/N | O70/N | O70/N | O64/N | O62/N | O72/N | O93/N | O70/N | O70/N | O66/N | O73/N | O79/N | O57/N | O63/N | O44/N | O53/N | O57/N | P4/N |
| COMP_0659 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O401/401 | O358/358 | O357/357 | O394/394 | O382/382 | O348/344 | O359/359 | O365/365 | O440/438 | O507/506 | O472/472 | O398/396 | O545/542 | O602/598 | O482/481 | O544/544 | O446/446 | O437/437 | O551/551 | O430/430 | O364/364 | O390/390 | O399/399 | O339/339 | P17/17 |
| COMP_0660 | 2025-12-30 | 2026-08-31 | 9 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/N | O7/N | O15/N | O11/N | O20/N | O12/N | O11/N | O10/N | O10/N | X |
| COMP_0661 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B98/98 | O110/110 | O112/112 | O115/115 | O133/133 | O122/122 | O139/139 | O87/87 | O134/134 | O176/176 | O149/149 | O156/156 | O157/157 | O164/164 | O206/206 | O152/152 | O156/156 | O149/149 | O168/168 | O156/156 | P2/2 |
| COMP_0662 | 2025-10-13 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | O17/17 | O18/18 | O10/10 | O11/11 | O15/15 | O17/17 | O9/9 | O28/28 | O13/13 | O10/10 | P2/2 |
| COMP_0663 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B22/22 | O43/43 | O47/47 | O69/69 | O59/59 | O52/52 | O61/61 | O48/48 | O65/65 | P4/4 |
| COMP_0664 | 2025-12-29 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B34/34 | O233/212 | O237/195 | O240/191 | O204/155 | O186/136 | O235/161 | O212/165 | O139/105 | P70/68 |
| COMP_0665 | 2024-09-09 | 2026-09-01 | 24 | 24 | 24 | B6/6 | O18/18 | O87/87 | O61/61 | O73/73 | O48/48 | O72/72 | O90/90 | O69/69 | O83/83 | O102/101 | O57/57 | O87/87 | O110/109 | O124/104 | O261/217 | O264/219 | O268/216 | O260/198 | O262/201 | O262/192 | O255/195 | O270/189 | O247/188 | P49/31 |
| COMP_0666 | 2024-10-08 | 2026-09-01 | 23 | 0 | 0 | X | B86/N | O77/N | O193/N | O165/N | O70/N | O69/N | O81/N | O69/N | O58/N | O54/N | O48/N | O64/N | O64/N | O30/N | O68/N | O95/N | O60/N | O89/N | O75/N | O56/N | O81/N | O63/N | O33/N | P5/N |
| COMP_0667 | 2025-03-20 | 2026-08-31 | 18 | 18 | 18 | X | X | X | X | X | X | B24/24 | O33/33 | O24/24 | O43/43 | O35/35 | O24/24 | O33/33 | O28/28 | O31/31 | O38/38 | O28/28 | O19/19 | O29/29 | O41/41 | O50/50 | O29/29 | O33/33 | O27/27 | X |
| COMP_0668 | 2026-01-15 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B25/25 | O66/66 | O69/69 | O71/71 | O77/77 | O81/81 | O36/36 | O21/21 | X |
| COMP_0669 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O112/110 | O103/98 | O99/94 | O91/88 | O116/109 | O113/104 | O121/118 | O60/57 | P17/16 |
| COMP_0670 | 2024-09-23 | 2026-09-01 | 23 | 23 | 23 | B1/1 | O3/3 | G | O9/2 | O19/6 | O10/2 | O16/4 | O13/5 | O24/7 | O19/6 | O15/5 | O11/4 | O12/3 | O11/2 | O12/2 | O11/2 | O12/2 | O12/3 | O14/2 | O10/2 | O11/2 | O11/4 | O12/3 | O12/2 | P2/N |
| COMP_0671 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O16/16 | O28/28 | O16/16 | O18/18 | O17/17 | O12/12 | O11/11 | O19/19 | O18/18 | O12/12 | O25/25 | O12/12 | O11/11 | O26/26 | O15/15 | O14/14 | O17/17 | O14/14 | O12/12 | O17/17 | O20/20 | O14/14 | O21/21 | O13/13 | P2/2 |
| COMP_0672 | 2025-11-13 | 2026-08-05 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O4/4 | O3/3 | O3/3 | O4/4 | O6/6 | O3/3 | O2/2 | O1/1 | B1/1 | X |
| COMP_0673 | 2025-12-29 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O69/69 | O121/121 | O106/106 | O109/109 | O105/105 | O90/90 | O126/126 | O93/93 | P6/6 |
| COMP_0674 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O92/92 | O108/108 | O119/119 | O117/117 | O97/97 | O115/115 | O123/122 | O125/125 | O104/104 | O82/82 | O146/146 | O97/97 | O108/108 | O120/120 | O129/129 | O131/131 | O105/105 | O123/123 | O125/125 | O116/116 | O86/86 | O105/105 | O76/76 | O67/67 | P4/4 |
| COMP_0675 | 2025-09-06 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B30/30 | O68/68 | O81/81 | O94/94 | O95/95 | O85/85 | O93/93 | O109/109 | O74/74 | O83/83 | O88/88 | O51/51 | P13/13 |
| COMP_0676 | 2026-02-06 | 2026-09-01 | 7 | 7 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B14/N | O18/N | O21/N | O19/N | O22/N | O21/N | O15/N | P1/N |
| COMP_0677 | 2026-02-25 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O11/11 | O14/14 | O15/15 | O9/9 | O12/12 | O9/9 | P2/2 |
| COMP_0678 | 2024-09-23 | 2026-06-26 | 22 | 22 | 22 | B1/1 | O3/3 | O5/5 | O1/1 | O3/3 | O9/9 | O1/1 | O2/2 | O1/1 | O2/2 | O2/2 | O1/1 | O3/3 | O2/2 | O3/3 | O1/1 | O4/4 | O3/3 | O3/3 | O2/2 | O1/1 | B2/2 | X | X | X |
| COMP_0679 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B18/18 | O63/63 | O58/58 | O64/64 | O70/70 | O57/57 | O68/68 | O65/65 | O63/63 | O72/72 | O56/56 | O68/68 | O70/70 | O66/66 | O62/62 | O64/64 | O71/71 | O60/60 | P6/6 |
| COMP_0680 | 2025-11-09 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B60/42 | O92/68 | O96/64 | O279/251 | O265/235 | O267/241 | O243/211 | O255/221 | O256/226 | O289/257 | P39/39 |
| COMP_0681 | 2024-09-02 | 2025-08-06 | 12 | 12 | 12 | B92/92 | O140/140 | O98/98 | O157/157 | O47/47 | O107/107 | O100/100 | O104/88 | O64/64 | O168/131 | O120/120 | B16/16 | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0682 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B24/24 | O38/38 | O38/38 | O41/41 | O31/31 | O34/34 | O262/262 | O27/27 | O34/34 | O34/34 | O31/31 | O31/31 | O19/19 | O35/35 | O46/46 | O52/52 | O24/24 | O27/27 | O248/248 | O60/60 | P5/5 |
| COMP_0683 | 2026-01-19 | 2026-09-01 | 8 | 8 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B44/N | O97/N | O98/N | O97/N | O95/N | O111/N | O102/N | O74/N | P4/N |
| COMP_0684 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B132/132 | O122/122 | O117/117 | O124/124 | O158/158 | O133/133 | O141/141 | O127/127 | P5/5 |
| COMP_0685 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O179/179 | O434/434 | O660/660 | O815/781 | O743/743 | O680/680 | O805/780 | O675/675 | O729/717 | O736/722 | O676/676 | O364/364 | O678/678 | O708/706 | O646/646 | O722/722 | O622/620 | O512/512 | O556/556 | O502/499 | O457/457 | O428/428 | O301/297 | O247/246 | P7/7 |
| COMP_0686 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B126/76 | O134/65 | O126/50 | O150/93 | O131/88 | O176/108 | O247/148 | O277/188 | O276/153 | O268/192 | O363/289 | O227/162 | O440/348 | O352/288 | O323/247 | O334/259 | O308/287 | O140/130 | O180/163 | O240/222 | O312/301 | O378/354 | O216/199 | O164/156 | P11/11 |
| COMP_0687 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B61/61 | O71/71 | O61/61 | O75/75 | O66/66 | O62/62 | O63/63 | O71/71 | O63/63 | O55/55 | O66/66 | O63/63 | O61/61 | O66/66 | O62/62 | O65/65 | O66/66 | O62/62 | O71/71 | O61/61 | O54/54 | O57/57 | O58/58 | O52/52 | P5/5 |
| COMP_0688 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B39/39 | O24/24 | O45/45 | O116/116 | O54/54 | O38/38 | O50/50 | O16/16 | P2/2 |
| COMP_0689 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B139/139 | O145/145 | O144/144 | O141/141 | O146/146 | O140/140 | O127/127 | O129/129 | O111/111 | O152/152 | O127/127 | O162/162 | O119/119 | O110/110 | O148/148 | O96/96 | O101/101 | O59/59 | O124/124 | O50/50 | P6/6 |
| COMP_0690 | 2025-11-14 | 2026-09-01 | 10 | 3 | 3 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B112/2 | O186/5 | O218/N | O132/1 | O151/N | O151/N | O249/N | O178/N | O145/N | O86/N | P2/N |
| COMP_0691 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B787/787 | O780/780 | O774/774 | O826/826 | O708/708 | O863/863 | O843/843 | O244/244 | P21/21 |
| COMP_0692 | 2024-10-28 | 2026-05-28 | 20 | 5 | 5 | X | B1/N | O3/N | O4/N | O4/N | O1/N | O6/N | O3/N | O1/N | O7/1 | O2/N | O2/N | O2/N | O19/5 | O3/1 | O4/N | O3/N | O8/2 | O7/1 | O3/N | B6/N | X | X | X | X |
| COMP_0693 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O568/195 | O596/213 | O585/206 | O562/203 | O565/191 | O485/174 | O522/186 | O511/187 | O514/179 | O504/175 | O556/192 | O517/183 | O517/184 | O557/199 | O505/185 | O550/195 | O531/191 | O497/176 | O544/191 | O499/181 | O525/191 | O543/192 | O543/193 | O497/174 | P19/7 |
| COMP_0694 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B21/21 | O24/24 | O16/16 | O22/22 | O21/21 | O12/12 | O15/15 | O19/19 | O14/14 | O12/12 | O21/21 | O15/15 | O11/11 | O20/20 | O18/18 | O18/18 | O26/26 | O20/20 | O17/17 | O21/21 | O20/20 | O16/16 | O19/19 | O14/14 | P1/1 |
| COMP_0695 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O202/202 | O202/202 | O204/204 | O214/214 | O173/173 | O74/74 | O69/69 | O69/69 | O75/75 | O72/72 | O83/81 | O89/86 | O81/81 | O80/80 | O111/111 | O109/109 | O103/103 | O112/112 | O322/322 | O204/204 | O144/144 | O103/103 | O113/113 | O87/87 | P6/6 |
| COMP_0696 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B227/14 | O205/3 | O217/14 | O275/15 | O186/16 | O179/31 | O182/25 | O172/20 | O191/20 | O193/17 | O180/22 | O180/11 | O175/7 | O268/36 | O233/11 | O307/20 | O195/18 | O252/20 | O233/27 | O216/15 | O202/17 | O256/11 | O201/13 | O176/15 | P4/N |
| COMP_0697 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B149/149 | O192/192 | O178/178 | O191/191 | O204/204 | O246/246 | O173/173 | O198/198 | O192/192 | O185/185 | O206/206 | O162/162 | O184/184 | O187/187 | O173/173 | O178/178 | O190/190 | O184/184 | O183/183 | O161/161 | O128/128 | O78/78 | O146/146 | O113/113 | P4/4 |
| COMP_0698 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B20/20 | O15/15 | O23/23 | O21/21 | O14/14 | O29/29 | O34/34 | O38/38 | P2/2 |
| COMP_0699 | 2024-09-04 | 2026-08-31 | 24 | 24 | 24 | B16/16 | O17/17 | O21/21 | O11/11 | O21/21 | O21/21 | O18/18 | O25/25 | O27/27 | O25/24 | O17/17 | O24/24 | O11/11 | O29/29 | O12/12 | O28/28 | O5/5 | O25/25 | O9/9 | O26/26 | O13/13 | O15/15 | O13/13 | O20/20 | X |
| COMP_0700 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B178/178 | O316/316 | O370/346 | O590/322 | O630/321 | O698/393 | O710/415 | O662/406 | O685/411 | O762/482 | O687/455 | O777/548 | O632/388 | O750/507 | O923/652 | O682/419 | O747/469 | O799/523 | O640/425 | O418/418 | P20/20 |
| COMP_0701 | 2025-05-20 | 2026-08-20 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B2/2 | O3/3 | O2/2 | O2/2 | O3/3 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O5/5 | O1/1 | O1/1 | O1/1 | B1/1 | X |
| COMP_0702 | 2026-01-02 | 2026-08-27 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B24/24 | O12/12 | O12/12 | O8/8 | O11/11 | O8/8 | O9/9 | B6/6 | X |
| COMP_0703 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O401/401 | O425/425 | O185/185 | O94/94 | O74/74 | O195/195 | O354/354 | O379/379 | O438/438 | O443/443 | O441/441 | O412/412 | O445/445 | O363/363 | O195/195 | O94/94 | O68/68 | O186/186 | O411/411 | O417/417 | O474/474 | O478/478 | O520/520 | O519/519 | P22/22 |
| COMP_0704 | 2025-06-04 | 2026-08-06 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | B1/1 | O5/5 | G | O1/1 | O2/2 | O1/1 | G | O2/2 | O1/1 | O1/1 | O2/2 | O2/2 | O1/1 | O1/1 | B1/1 | X |
| COMP_0705 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O33/33 | O32/32 | O26/26 | O33/33 | O51/51 | O30/30 | O39/39 | O33/33 | O30/30 | O41/41 | O30/30 | O34/34 | O38/38 | O29/29 | O34/34 | O35/35 | O31/31 | O30/30 | O37/37 | O30/30 | P3/3 |
| COMP_0706 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B58/58 | O77/77 | O54/54 | O69/69 | O57/57 | O63/63 | O52/52 | O66/66 | O68/68 | O102/102 | O76/76 | O55/55 | O81/81 | O108/108 | O98/98 | O105/105 | O87/87 | O89/89 | O104/104 | O115/115 | O89/89 | O70/70 | O123/123 | O84/84 | P6/6 |
| COMP_0707 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B38/38 | O34/34 | O112/112 | O247/247 | O215/215 | O207/207 | O241/241 | O231/231 | O237/237 | O205/205 | O209/209 | O193/193 | O216/216 | O225/225 | O199/199 | O277/277 | O248/248 | O249/249 | O295/295 | O286/286 | O254/254 | O255/255 | O258/258 | O254/254 | P10/10 |
| COMP_0708 | 2025-12-27 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B26/26 | O209/209 | O284/284 | O323/323 | O288/277 | O353/341 | O380/362 | O381/364 | O279/267 | P16/16 |
| COMP_0709 | 2025-11-17 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B19/19 | O21/21 | O31/31 | O38/38 | O51/51 | O73/73 | O81/81 | O67/67 | O72/72 | O67/67 | P8/8 |
| COMP_0710 | 2024-09-02 | 2026-08-28 | 24 | 24 | 24 | B69/69 | O105/105 | O44/44 | O51/51 | O51/51 | O43/43 | O66/66 | O48/48 | O38/38 | O46/46 | O32/32 | O24/24 | O38/38 | O43/43 | O76/76 | O36/36 | O56/56 | O56/56 | O57/57 | O27/27 | O36/36 | O59/59 | O44/44 | B28/28 | X |
| COMP_0711 | 2024-09-01 | 2026-08-24 | 24 | 24 | 24 | O413/413 | O401/401 | O322/322 | O338/338 | O293/293 | O364/364 | O278/278 | O153/153 | O168/168 | O137/137 | O99/99 | O110/110 | O161/161 | O109/109 | O68/68 | O51/51 | O57/57 | O9/9 | O11/11 | O10/10 | O14/14 | O7/7 | O7/7 | B15/15 | X |
| COMP_0712 | 2024-09-11 | 2025-05-29 | 9 | 9 | 9 | B3/3 | O5/5 | O6/6 | O1/1 | O2/2 | O1/1 | O5/5 | O3/3 | B6/6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0713 | 2024-12-26 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B7/7 | O994/994 | O837/837 | O862/861 | O1083/1083 | O938/938 | O895/894 | O925/925 | O580/580 | O919/918 | O999/999 | O840/837 | O841/837 | O1091/1091 | O1084/1084 | O1097/1096 | O1262/1260 | O1141/1141 | O1001/1000 | O1028/1027 | O732/732 | P72/72 |
| COMP_0714 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B12/12 | O50/50 | O49/49 | O46/46 | O47/47 | O67/67 | O81/81 | O114/114 | O93/93 | O97/97 | O97/97 | O96/96 | O98/98 | O93/93 | O85/85 | O91/91 | O99/99 | O87/87 | P4/4 |
| COMP_0715 | 2025-07-08 | 2026-01-28 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | B9/9 | O2/2 | O9/9 | O13/13 | O8/8 | O8/8 | B14/14 | X | X | X | X | X | X | X | X |
| COMP_0716 | 2026-01-19 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B11/11 | O9/9 | O18/18 | O23/23 | O17/17 | O15/15 | O12/12 | O10/10 | X |
| COMP_0717 | 2025-07-14 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B2/2 | O3/3 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O4/4 | O1/1 | O1/1 | O2/2 | O7/7 | P1/1 |
| COMP_0718 | 2026-02-25 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O12/12 | O20/20 | O14/14 | O12/12 | O16/16 | O10/10 | P6/6 |
| COMP_0719 | 2025-03-19 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B21/21 | O38/38 | O40/40 | O36/36 | O38/38 | O28/28 | O37/37 | O35/35 | O30/30 | O37/37 | O36/36 | O31/31 | O37/37 | O37/37 | O30/30 | O32/32 | O36/36 | O33/33 | P4/4 |
| COMP_0720 | 2025-09-29 | 2026-05-25 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O125/125 | O101/101 | O82/82 | O97/97 | O86/86 | O81/81 | O109/109 | B65/65 | X | X | X | X |
| COMP_0721 | 2025-01-12 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B29/29 | O57/57 | O58/58 | O65/65 | O74/74 | O68/68 | O64/64 | O71/71 | O48/48 | O62/62 | O80/80 | O75/75 | O97/97 | O71/71 | O80/80 | O110/110 | O77/77 | O82/82 | O102/102 | O108/108 | P12/12 |
| COMP_0722 | 2025-01-14 | 2026-08-18 | 12 | 12 | 12 | X | X | X | X | B1/1 | G | G | G | O1/1 | G | O2/2 | O3/3 | G | G | G | G | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | O1/1 | O1/1 | B3/3 | X |
| COMP_0723 | 2025-09-10 | 2026-07-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | O21/21 | O12/12 | O13/13 | O20/20 | O25/25 | O16/16 | O7/7 | O3/3 | G | B1/1 | X | X |
| COMP_0724 | 2026-01-06 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B31/31 | O30/30 | O30/30 | O27/27 | O35/35 | O28/28 | O29/29 | O23/23 | P2/2 |
| COMP_0725 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B64/64 | O85/85 | O70/70 | O108/108 | O129/129 | O112/112 | O157/156 | O92/92 | O106/106 | O142/142 | O128/128 | O136/136 | O107/107 | O127/127 | O151/151 | O118/118 | O116/116 | O110/110 | O120/120 | O112/112 | P4/4 |
| COMP_0726 | 2025-03-25 | 2026-09-01 | 6 | 6 | 6 | X | X | X | X | X | X | B1/1 | G | G | G | G | G | G | G | G | G | G | G | G | O7/7 | O9/9 | O7/7 | O9/9 | O7/7 | P1/1 |
| COMP_0727 | 2025-10-12 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B57/29 | O116/64 | O93/31 | O116/50 | O141/78 | O107/42 | O106/48 | O97/43 | O112/52 | O114/49 | O77/18 | P4/3 |
| COMP_0728 | 2025-11-28 | 2026-09-01 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B19/N | O126/N | O97/N | O180/N | O147/N | O150/N | O121/N | O130/N | O168/N | O144/N | P5/N |
| COMP_0729 | 2025-02-17 | 2025-12-11 | 7 | 7 | 7 | X | X | X | X | X | B2/2 | G | G | G | G | O4/4 | O9/9 | O11/11 | O12/12 | O12/12 | B8/8 | X | X | X | X | X | X | X | X | X |
| COMP_0730 | 2025-12-31 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/7 | O426/256 | O633/415 | O1005/745 | O797/522 | O712/452 | O485/248 | O750/458 | O324/173 | P2/N |
| COMP_0731 | 2025-12-19 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B35/35 | O105/105 | O92/92 | O110/110 | O109/109 | O113/113 | O112/112 | O108/108 | O101/101 | P4/4 |
| COMP_0732 | 2024-09-01 | 2026-08-11 | 24 | 24 | 24 | O18/18 | O10/10 | O6/6 | O9/9 | O10/10 | O4/4 | O4/4 | O8/8 | O4/4 | O5/5 | O6/6 | O2/2 | O2/2 | O5/5 | O2/2 | O24/24 | O4/4 | O1/1 | O1/1 | O1/1 | O2/2 | O2/2 | O2/2 | B1/1 | X |
| COMP_0733 | 2025-01-01 | 2026-08-07 | 20 | 20 | 20 | X | X | X | X | O14/14 | O4/4 | O10/10 | O11/11 | O6/6 | O5/5 | O6/6 | O3/3 | O4/4 | O8/8 | O7/7 | O4/4 | O7/7 | O2/2 | O3/3 | O6/6 | O4/4 | O1/1 | O7/7 | B3/3 | X |
| COMP_0734 | 2025-12-31 | 2026-07-24 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/2 | O1/1 | O1/1 | O2/2 | O2/1 | O3/2 | O6/5 | B3/2 | X | X |
| COMP_0735 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B1/1 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | O2/2 | O2/2 | O2/2 | O4/4 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | P1/1 |
| COMP_0736 | 2025-11-13 | 2026-08-05 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O15/15 | O3/3 | O3/3 | O9/9 | O1/1 | O2/2 | O7/7 | O1/1 | B1/1 | X |
| COMP_0737 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O41/41 | O47/47 | O48/48 | O49/49 | O39/39 | O57/57 | O49/49 | O54/54 | O38/38 | O58/58 | O46/46 | O40/40 | O62/62 | O64/64 | O63/63 | O65/65 | O55/55 | O46/46 | O49/49 | O63/63 | O55/55 | O54/54 | O76/76 | O43/43 | P2/2 |
| COMP_0738 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B13/13 | O13/13 | O19/19 | O15/15 | O13/13 | O19/19 | O18/18 | O17/17 | O15/15 | O18/18 | O14/14 | O22/22 | O16/16 | O15/15 | O16/16 | O19/19 | O14/14 | O18/18 | O20/20 | O15/15 | P1/1 |
| COMP_0739 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O19/19 | O33/33 | O37/37 | O45/45 | O18/18 | O23/23 | O18/18 | O24/24 | O25/25 | O33/33 | O30/30 | O26/26 | O24/24 | O40/40 | O34/34 | O33/33 | O25/25 | O20/20 | O18/18 | O20/20 | O23/23 | O17/17 | O24/24 | O24/24 | P1/1 |
| COMP_0740 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O29/22 | O27/22 | O31/25 | O22/18 | O9/8 | O12/11 | O21/19 | O19/17 | P1/1 |
| COMP_0741 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B22/22 | O27/27 | O21/21 | O25/25 | O31/31 | O26/26 | O25/25 | O64/64 | O34/34 | O34/34 | O38/38 | O26/26 | O32/32 | O40/40 | O50/50 | O51/51 | O38/38 | O52/52 | O56/56 | O69/69 | O34/34 | O42/42 | O51/51 | O30/30 | P1/1 |
| COMP_0742 | 2025-12-31 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/N | G | O47/43 | O400/399 | O361/361 | O350/350 | O273/271 | O422/422 | O400/399 | P18/18 |
| COMP_0743 | 2024-09-02 | 2026-09-01 | 24 | 24 | 23 | B108/7 | O85/N | O112/1 | O159/9 | O163/11 | O137/6 | O120/10 | O120/16 | O114/14 | O85/6 | O122/23 | O99/27 | O139/48 | O195/90 | O191/46 | O199/54 | O204/52 | O245/107 | O333/177 | O306/167 | O199/129 | O243/99 | O265/135 | O208/80 | P9/6 |
| COMP_0744 | 2026-02-10 | 2026-09-01 | 7 | 2 | 2 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/N | O2/1 | O6/1 | O12/N | O42/N | O78/N | O67/N | P6/N |
| COMP_0745 | 2025-12-29 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O132/110 | O107/87 | O146/126 | O132/112 | O137/97 | O184/125 | O133/110 | O135/115 | P45/43 |
| COMP_0746 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B40/40 | O26/26 | O34/34 | O30/30 | O36/36 | O26/26 | O36/36 | O31/31 | O30/30 | O43/43 | O47/47 | O30/30 | O31/31 | O37/37 | O25/25 | O41/41 | O34/34 | O38/38 | O40/40 | O36/36 | P1/1 |
| COMP_0747 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B72/72 | O299/299 | O311/311 | O284/284 | O309/309 | O301/301 | O319/319 | O362/362 | O311/311 | O295/295 | O318/318 | O347/347 | O333/332 | O310/310 | O328/328 | O316/316 | O356/356 | O293/293 | P17/17 |
| COMP_0748 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O101/45 | O120/52 | O103/45 | O107/42 | O85/38 | O93/38 | O83/37 | O110/39 | O83/32 | O87/40 | O104/43 | O93/38 | O98/42 | O124/53 | O68/34 | O108/47 | O35/23 | O36/28 | O35/27 | O45/30 | O29/19 | O40/28 | O61/47 | O27/21 | P3/3 |
| COMP_0749 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O50/50 | O40/40 | O43/43 | O46/46 | O46/46 | O68/68 | P3/3 |
| COMP_0750 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B17/17 | O110/110 | O153/153 | O177/177 | O167/167 | O153/153 | O182/182 | O168/168 | O163/163 | O174/174 | O162/162 | O148/148 | O164/164 | O178/178 | O158/158 | O171/171 | O172/172 | O147/147 | P11/11 |
| COMP_0751 | 2024-09-27 | 2026-09-01 | 24 | 24 | 24 | B3/3 | O9/9 | O7/7 | O7/7 | O13/13 | O11/11 | O30/30 | O154/154 | O114/114 | O136/136 | O80/80 | O52/52 | O36/36 | O107/107 | O49/49 | O62/62 | O56/56 | O46/46 | O60/60 | O42/42 | O45/45 | O48/48 | O100/100 | O33/33 | P1/1 |
| COMP_0752 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O73/73 | O91/91 | O89/89 | O96/96 | O78/78 | O70/70 | O101/101 | O60/60 | P5/5 |
| COMP_0753 | 2025-04-11 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B11/11 | O19/19 | O20/20 | O28/28 | O16/16 | O18/18 | O34/34 | O18/18 | O39/39 | O29/29 | O19/19 | O16/16 | O20/20 | O15/15 | O42/42 | O30/30 | O17/17 | P7/7 |
| COMP_0754 | 2025-05-20 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B67/57 | O154/144 | O242/226 | O219/204 | O226/209 | O305/292 | O300/280 | O277/254 | O386/363 | O334/311 | O282/268 | O220/200 | O341/318 | O239/228 | O506/476 | O463/429 | P136/112 |
| COMP_0755 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B193/193 | O309/309 | O271/271 | O338/322 | O351/351 | O303/303 | O753/753 | O602/602 | O410/410 | O507/507 | O381/381 | O400/400 | O312/312 | O375/375 | O503/503 | O455/455 | O503/503 | O326/326 | O422/422 | O367/367 | P3/3 |
| COMP_0756 | 2026-02-05 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B202/202 | O338/338 | O342/334 | O283/273 | O343/323 | O290/278 | O199/192 | P15/15 |
| COMP_0757 | 2026-01-23 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/13 | O24/24 | O60/60 | O116/116 | O44/44 | O38/38 | O67/67 | O41/41 | P5/5 |
| COMP_0758 | 2025-07-21 | 2026-08-31 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B3/3 | O5/5 | O3/3 | O8/8 | O11/11 | O9/9 | O10/10 | O10/10 | O13/13 | O12/12 | O10/10 | O11/11 | O9/9 | O8/8 | X |
| COMP_0759 | 2024-12-22 | 2026-09-01 | 21 | 0 | 0 | X | X | X | B7/N | O109/N | O93/N | O96/N | O133/N | O89/N | O99/N | O70/N | O60/N | O59/N | O63/N | O53/N | O60/N | O58/N | O51/N | O60/N | O62/N | O52/N | O49/N | O68/N | O54/N | P3/N |
| COMP_0760 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O228/228 | O264/264 | O235/235 | O262/262 | O268/268 | O254/254 | O252/252 | O226/226 | O225/225 | O171/171 | O181/181 | O47/47 | O138/138 | O155/155 | O134/134 | O146/146 | O137/137 | O154/154 | O177/177 | O169/169 | O250/250 | O247/247 | O227/227 | O83/83 | P5/5 |
| COMP_0761 | 2025-04-01 | 2026-09-01 | 17 | 9 | 9 | X | X | X | X | X | X | X | O5/N | O3/N | O3/N | O1/N | O5/N | O5/N | O1/N | O1/N | O45/17 | O64/35 | O68/29 | O74/33 | O53/29 | O57/17 | O42/25 | O72/34 | O73/29 | P3/1 |
| COMP_0762 | 2025-08-04 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B48/48 | O39/39 | O42/42 | O27/27 | O21/21 | O23/23 | O107/107 | O152/152 | O144/144 | O149/149 | O146/146 | O163/163 | O149/149 | P6/6 |
| COMP_0763 | 2025-01-02 | 2026-08-31 | 20 | 20 | 20 | X | X | X | X | B22/22 | O23/23 | O26/26 | O34/34 | O23/23 | O25/25 | O22/22 | O23/23 | O22/22 | O29/29 | O25/25 | O21/21 | O27/27 | O28/28 | O27/27 | O25/25 | O24/24 | O28/28 | O28/28 | O22/22 | X |
| COMP_0764 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O19/19 | O14/14 | O12/12 | O11/11 | O20/20 | O11/11 | O13/13 | O15/15 | O4/4 | O5/5 | O11/11 | O8/8 | O11/11 | O7/7 | O11/11 | O33/33 | O15/15 | O7/7 | O4/4 | O7/7 | O6/6 | O8/8 | O14/14 | O5/5 | P3/3 |
| COMP_0765 | 2024-11-05 | 2026-09-01 | 22 | 0 | 0 | X | X | B14/N | O20/N | O29/N | O49/N | O37/N | O38/N | O50/N | O54/N | O69/N | O92/N | O116/N | O99/N | O72/N | O63/N | O80/N | O79/N | O89/N | O85/N | O56/N | O50/N | O171/N | O148/N | P7/N |
| COMP_0766 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B107/107 | O169/169 | O158/158 | O116/116 | O147/147 | O145/145 | O155/155 | O126/126 | O119/119 | O173/173 | O77/77 | O39/39 | O60/60 | O72/72 | O45/45 | O38/38 | O27/27 | O27/27 | O21/21 | O26/26 | O26/26 | O16/16 | O26/26 | O7/7 | P1/1 |
| COMP_0767 | 2025-10-06 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B21/21 | O30/30 | O47/47 | O15/15 | O16/16 | O34/34 | O16/16 | O14/14 | O16/16 | O19/19 | O2/2 | P1/1 |
| COMP_0768 | 2025-07-29 | 2026-08-17 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B1/1 | O5/5 | O2/2 | O5/5 | O6/6 | O12/12 | O6/6 | O2/2 | O2/2 | O7/7 | O6/6 | O7/7 | O6/6 | B1/1 | X |
| COMP_0769 | 2025-12-31 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O1598/1598 | O1694/1694 | O1863/1863 | O1805/1805 | O1812/1812 | O2074/2062 | O2274/2255 | O1918/1908 | P99/99 |
| COMP_0770 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B12/12 | O21/21 | O15/15 | O14/14 | O18/18 | O19/19 | O14/14 | O14/14 | O10/10 | O18/18 | O33/33 | O22/22 | O28/28 | O33/33 | O22/22 | O22/22 | O22/22 | O17/17 | O18/18 | O20/20 | O26/26 | O27/27 | O17/17 | O28/28 | P2/2 |
| COMP_0771 | 2025-09-05 | 2026-06-15 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | B20/20 | O16/16 | O21/21 | O20/20 | O15/15 | O12/12 | O12/12 | O10/10 | O17/17 | B4/4 | X | X | X |
| COMP_0772 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O93/93 | O82/82 | O82/82 | O89/89 | O78/78 | O82/82 | O110/110 | O60/60 | O85/85 | O90/90 | O99/99 | O129/129 | O99/99 | O74/74 | O84/84 | O89/89 | O72/72 | O91/91 | O100/100 | O63/63 | P16/16 |
| COMP_0773 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O534/534 | O610/610 | O526/526 | O514/514 | O510/510 | O521/521 | O537/537 | O499/499 | O522/522 | O503/503 | O522/522 | O448/448 | O510/510 | O569/569 | O542/542 | O580/580 | O485/485 | O574/574 | O577/577 | O535/535 | O538/538 | O605/605 | O519/519 | O468/468 | P25/25 |
| COMP_0774 | 2025-01-20 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B20/15 | O39/25 | O47/34 | O49/31 | O43/30 | O37/22 | O42/26 | O33/20 | O36/25 | O37/22 | O35/26 | O40/21 | O35/21 | O23/14 | O32/18 | O32/18 | O21/14 | O32/23 | O30/18 | O25/14 | P2/2 |
| COMP_0775 | 2025-05-20 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B33/27 | O72/66 | O55/48 | O41/35 | O115/95 | O88/78 | O55/47 | O58/50 | O65/56 | O76/65 | O75/67 | O44/36 | O79/70 | O48/38 | O95/84 | O72/61 | P1/1 |
| COMP_0776 | 2024-09-06 | 2026-08-05 | 24 | 24 | 24 | B9/9 | O8/8 | O8/8 | O7/7 | O12/12 | O10/10 | O5/5 | O5/5 | O9/9 | O8/8 | O6/6 | O10/10 | O5/5 | O9/9 | O4/4 | O9/9 | O5/5 | O8/8 | O8/8 | O9/9 | O4/4 | O5/5 | O6/6 | B2/2 | X |
| COMP_0777 | 2026-01-02 | 2026-08-31 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B59/N | O74/N | O77/N | O71/N | O3/N | O101/N | O93/N | O77/N | X |
| COMP_0778 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O50/50 | O39/39 | O46/46 | O45/45 | O68/68 | O44/44 | O55/55 | O60/60 | O63/63 | O70/70 | O72/72 | O70/70 | O76/76 | O78/78 | O67/67 | O48/48 | O56/56 | O61/61 | O61/61 | O86/86 | O64/64 | O78/78 | O97/97 | O62/62 | P1/1 |
| COMP_0779 | 2025-01-03 | 2026-08-19 | 20 | 20 | 20 | X | X | X | X | B6/6 | O1/1 | O2/2 | O1/1 | O4/4 | O1/1 | O2/2 | O2/2 | O2/2 | O3/3 | O2/2 | O3/3 | O15/15 | O17/17 | O55/55 | O39/39 | O6/6 | O3/3 | O4/4 | B4/4 | X |
| COMP_0780 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O138/138 | O142/142 | O160/144 | O157/157 | O147/147 | O129/129 | O121/121 | O142/142 | O137/137 | O135/135 | O157/157 | O144/144 | O151/151 | O140/140 | O134/134 | O131/131 | O140/140 | O117/117 | O132/132 | O137/137 | O133/133 | O358/358 | O291/291 | O282/282 | P4/4 |
| COMP_0781 | 2025-08-09 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B18/N | O21/N | O19/N | O32/N | O20/N | O24/N | O13/N | O19/N | O11/N | O7/N | O6/N | O9/N | O7/N | P2/N |
| COMP_0782 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B108/108 | O144/144 | O135/135 | O148/148 | O128/128 | O130/130 | O135/135 | O131/131 | O134/134 | O120/120 | O135/135 | O125/125 | O107/107 | O160/160 | O133/133 | O141/141 | O119/119 | O133/133 | O148/148 | O133/133 | O124/124 | O120/120 | O124/124 | O131/131 | P11/11 |
| COMP_0783 | 2026-01-12 | 2026-09-01 | 8 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/N | O8/N | O32/3 | O32/1 | O31/1 | O40/1 | O38/1 | O50/1 | P4/N |
| COMP_0784 | 2025-12-31 | 2026-07-20 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/N | O8/N | O10/N | O24/N | O12/N | O28/N | O30/N | B27/N | X | X |
| COMP_0785 | 2024-09-05 | 2026-08-31 | 24 | 24 | 24 | B66/66 | O87/87 | O60/60 | O66/66 | O66/66 | O32/32 | O28/28 | O24/24 | O24/24 | O22/22 | O30/30 | O27/27 | O26/26 | O28/28 | O29/29 | O32/32 | O43/43 | O47/47 | O23/23 | O24/24 | O33/33 | O28/28 | O13/13 | O13/13 | X |
| COMP_0786 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O139/138 | O142/140 | O97/95 | O105/102 | O130/129 | O105/104 | O100/99 | O115/115 | O116/115 | O104/104 | O93/93 | O90/89 | O107/107 | O102/102 | O92/92 | O141/139 | O110/110 | O106/106 | O145/144 | O135/135 | O139/138 | O146/146 | O157/157 | O145/144 | P9/9 |
| COMP_0787 | 2026-02-09 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/2 | O11/8 | O17/10 | O10/3 | O15/13 | O10/5 | O11/7 | P1/N |
| COMP_0788 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B421/421 | O401/401 | O364/364 | O446/446 | O330/330 | O129/129 | O130/130 | O125/125 | O130/130 | O126/126 | O141/141 | O118/118 | O136/136 | O157/157 | O130/130 | O140/140 | O125/125 | O112/112 | O132/132 | O126/126 | O132/132 | O149/149 | O147/147 | O141/141 | P7/7 |
| COMP_0789 | 2024-09-02 | 2026-07-20 | 10 | 10 | 10 | B4/4 | G | O6/6 | G | G | O4/4 | O1/1 | G | O2/2 | G | G | O2/2 | G | G | O4/4 | G | G | G | G | O2/2 | G | O2/2 | B2/2 | X | X |
| COMP_0790 | 2024-11-14 | 2026-09-01 | 15 | 15 | 15 | X | X | B1/1 | G | G | G | G | G | O1/1 | G | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | G | O4/4 | O3/3 | O42/42 | O3/3 | O115/115 | O150/150 | O238/238 | O256/256 | P35/35 |
| COMP_0791 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B64/64 | O73/73 | O63/63 | O54/54 | O90/90 | O57/57 | O68/68 | O73/73 | O87/87 | O109/109 | O91/91 | O94/94 | O105/105 | O103/103 | O61/61 | O40/40 | O59/59 | O32/32 | O40/40 | O58/58 | O59/59 | O75/75 | O67/67 | O41/41 | P4/4 |
| COMP_0792 | 2024-09-04 | 2026-08-28 | 24 | 24 | 24 | B47/47 | O64/64 | O87/87 | O142/142 | O112/112 | O161/161 | O69/69 | O149/149 | O108/108 | O111/111 | O136/136 | O57/57 | O81/81 | O64/64 | O55/55 | O80/80 | O48/48 | O38/38 | O83/83 | O79/79 | O44/44 | O76/76 | O59/59 | B23/23 | X |
| COMP_0793 | 2026-01-09 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B480/367 | O619/447 | O760/567 | O847/670 | O853/685 | O1066/846 | O1057/812 | O814/686 | P53/33 |
| COMP_0794 | 2024-09-14 | 2026-09-01 | 23 | 23 | 23 | B1/1 | O1/1 | G | O1/1 | O2/2 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | O4/4 | O2/2 | O3/3 | O1/1 | O9/9 | O142/142 | O533/533 | O671/671 | O788/788 | O755/755 | O793/793 | P22/22 |
| COMP_0795 | 2026-02-17 | 2026-08-31 | 7 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B31/N | O31/N | O101/62 | O169/112 | O117/113 | O113/113 | O122/122 | X |
| COMP_0796 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B9/9 | O11/11 | O15/15 | O12/12 | O9/9 | O5/5 | O8/8 | O8/8 | O11/11 | O11/11 | O16/16 | O8/8 | O7/7 | O14/14 | O12/12 | O16/16 | O10/10 | O10/10 | O10/10 | O13/13 | O9/9 | O12/12 | O22/22 | O10/10 | P3/3 |
| COMP_0797 | 2025-09-22 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O31/31 | O699/699 | O698/698 | O642/642 | O758/758 | O793/793 | O826/826 | O866/866 | O813/813 | O978/978 | O973/973 | P37/37 |
| COMP_0798 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B50/50 | O52/52 | O48/48 | O65/65 | O72/72 | O56/56 | O69/69 | O60/60 | O64/64 | O65/65 | O148/148 | O143/143 | O161/161 | O171/171 | O143/143 | O137/137 | O133/133 | O142/142 | O173/173 | O134/134 | O103/103 | O155/155 | O166/166 | O115/115 | P21/21 |
| COMP_0799 | 2025-11-27 | 2026-09-01 | 10 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B58/N | O402/1 | O350/11 | O295/4 | O285/5 | O286/N | O288/N | O315/8 | O316/5 | O302/10 | P20/N |
| COMP_0800 | 2025-12-19 | 2026-07-20 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/N | O23/N | O36/N | O31/N | O26/N | O52/N | O52/N | B50/N | X | X |
| COMP_0801 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O21/21 | O18/18 | O7/7 | O28/28 | O18/18 | O41/41 | O51/51 | O32/32 | O35/35 | O52/52 | O26/26 | O44/44 | O33/33 | O48/48 | O45/45 | O59/59 | O34/34 | O34/34 | O54/54 | O27/27 | P7/7 |
| COMP_0802 | 2025-08-18 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B25/25 | O69/69 | O80/80 | O70/70 | O80/80 | O82/82 | O101/101 | O82/82 | O83/83 | O59/59 | O76/76 | O76/76 | O53/53 | P4/4 |
| COMP_0803 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O256/181 | O282/208 | O246/191 | O298/234 | O218/161 | O216/157 | O238/176 | O216/162 | O234/189 | O221/177 | O192/146 | O163/123 | O214/167 | O250/184 | O170/133 | O273/225 | O192/155 | O254/204 | O266/215 | O197/154 | O229/186 | O203/164 | O195/147 | O154/117 | P13/9 |
| COMP_0804 | 2026-01-05 | 2026-08-21 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/N | O7/N | O7/N | O8/N | O7/N | O5/N | O9/N | B5/N | X |
| COMP_0805 | 2025-08-07 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O3/3 | O8/8 | O6/6 | O7/7 | O4/4 | O3/3 | O5/5 | O8/8 | O15/15 | O13/13 | O11/11 | O5/5 | P1/1 |
| COMP_0806 | 2025-06-26 | 2026-03-31 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | B7/7 | O194/194 | O214/213 | O273/269 | O263/259 | O273/273 | O257/257 | O146/146 | O157/157 | O99/97 | X | X | X | X | X | X |
| COMP_0807 | 2025-04-11 | 2026-08-11 | 17 | 17 | 17 | X | X | X | X | X | X | X | B1/1 | O2/2 | O3/3 | O2/2 | O1/1 | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | O2/2 | O3/3 | O2/2 | O2/2 | O2/2 | B1/1 | X |
| COMP_0808 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B44/26 | O39/27 | O90/74 | O53/36 | O34/23 | O38/25 | O33/23 | O38/27 | O37/27 | O39/28 | O51/41 | O42/28 | O44/34 | O39/30 | O40/30 | O54/44 | O34/23 | O117/106 | O64/36 | O47/36 | O44/36 | O66/43 | O62/52 | O34/23 | P6/6 |
| COMP_0809 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B18/18 | O16/16 | O16/16 | O17/17 | O13/13 | O14/14 | O16/16 | O14/14 | O17/17 | O16/16 | O18/18 | O15/15 | O16/16 | O20/20 | O14/14 | O9/9 | O5/5 | O6/6 | O2/2 | O1/1 | O3/3 | O2/2 | O1/1 | O1/1 | P1/1 |
| COMP_0810 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B15/15 | O38/38 | O8/8 | O15/15 | O25/25 | O8/8 | O19/19 | O13/13 | O9/9 | O16/16 | O12/12 | O9/9 | O20/20 | O40/40 | O9/9 | O7/7 | O17/17 | O6/6 | O18/18 | O20/20 | O12/12 | O11/11 | O13/13 | O13/13 | X |
| COMP_0811 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B95/95 | O105/105 | O95/95 | O91/91 | O122/122 | O94/94 | O102/102 | O100/100 | O101/101 | O86/86 | O85/85 | O68/68 | O154/154 | O110/110 | O92/92 | O125/125 | O120/120 | O116/116 | O176/176 | O154/154 | O115/115 | O102/102 | O95/95 | O102/102 | P3/3 |
| COMP_0812 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B85/85 | O122/122 | O95/95 | O79/79 | O81/81 | O84/84 | O99/99 | O87/87 | O78/78 | O93/93 | O100/100 | O71/71 | O100/100 | O120/120 | O88/88 | O88/88 | O68/68 | O85/85 | O109/109 | O88/88 | O78/78 | O91/91 | O95/95 | O73/73 | P4/4 |
| COMP_0813 | 2024-09-04 | 2026-09-01 | 24 | 24 | 24 | B24/24 | O63/63 | O30/30 | O51/51 | O93/93 | O60/60 | O54/54 | O55/55 | O57/57 | O52/52 | O81/81 | O55/55 | O58/58 | O40/40 | O41/41 | O27/27 | O80/80 | O83/83 | O82/82 | O111/111 | O94/94 | O43/43 | O58/58 | O60/60 | P6/6 |
| COMP_0814 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O11/11 | O19/19 | O15/15 | O15/15 | O16/16 | O10/10 | O9/9 | O11/11 | O10/10 | O9/9 | O13/13 | O16/16 | O16/16 | O14/14 | O12/12 | O10/10 | O18/18 | O13/13 | O10/10 | O12/12 | O11/11 | O15/15 | O10/10 | O8/8 | P2/2 |
| COMP_0815 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O3/3 | O3/3 | O4/4 | O2/2 | O7/7 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O6/6 | O4/4 | O3/3 | O3/3 | O2/2 | O4/4 | O4/4 | O7/7 | O5/5 | P1/1 |
| COMP_0816 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B115/115 | O95/95 | O103/103 | O118/118 | O89/89 | O103/103 | O79/79 | O83/83 | O115/115 | O110/110 | O93/93 | O91/91 | O75/75 | O103/103 | O85/85 | O121/121 | O76/76 | O118/118 | O88/88 | O109/109 | O75/75 | O87/87 | O74/74 | O62/62 | P12/12 |
| COMP_0817 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B24/24 | O33/33 | O68/68 | O32/32 | O65/65 | O40/40 | O71/51 | O59/59 | O85/85 | O50/50 | O43/43 | O59/59 | O48/48 | O61/61 | O63/63 | O24/24 | O70/70 | O82/82 | O45/45 | O53/53 | O49/49 | O132/132 | O81/81 | O20/20 | P1/1 |
| COMP_0818 | 2024-09-10 | 2026-08-18 | 23 | 23 | 23 | B1/1 | O2/2 | O2/2 | O5/5 | O2/2 | O1/1 | O2/2 | O2/2 | O4/4 | O8/8 | O4/4 | O8/8 | O9/9 | O6/6 | O2/2 | O9/9 | O2/2 | O1/1 | O3/3 | O1/1 | O1/1 | G | O2/2 | B1/1 | X |
| COMP_0819 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O57/57 | O43/43 | O44/44 | O39/39 | O35/35 | O48/48 | O37/37 | O35/35 | O51/51 | O42/42 | O47/47 | O35/35 | O36/36 | O53/53 | O28/28 | O61/61 | O32/32 | O57/57 | O51/51 | O47/47 | O48/48 | O48/48 | O51/51 | O51/51 | P2/2 |
| COMP_0820 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O59/59 | O58/58 | O61/61 | O70/70 | O56/56 | O61/61 | O56/56 | O67/67 | O81/81 | O69/69 | O51/51 | O56/56 | O54/54 | O73/73 | O56/56 | O74/74 | O61/61 | O65/65 | O55/55 | O78/78 | O67/67 | O90/90 | O62/62 | O34/34 | P7/7 |
| COMP_0821 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B77/77 | O68/68 | O98/78 | O154/140 | O66/66 | O88/88 | O60/60 | O102/102 | O65/65 | O61/61 | O121/121 | O45/45 | O87/87 | O62/62 | O97/97 | O139/139 | O88/88 | O53/53 | O126/126 | O83/82 | O82/82 | O88/88 | O105/105 | O39/39 | P2/2 |
| COMP_0822 | 2025-08-26 | 2026-08-31 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B43/N | O97/N | O82/N | O86/N | O217/N | O80/N | O76/N | O72/N | O88/N | O78/N | O64/N | O58/N | O52/N | X |
| COMP_0823 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O4/4 | O5/5 | O7/7 | O4/4 | O6/6 | O3/3 | O7/7 | O6/6 | O17/17 | O6/6 | O9/9 | O6/6 | O5/5 | O10/10 | O8/8 | O6/6 | O16/16 | O6/6 | O11/11 | O9/9 | O23/23 | O10/10 | O13/13 | O10/10 | P3/3 |
| COMP_0824 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B93/83 | O182/165 | O74/54 | O87/69 | O156/139 | O84/61 | O85/63 | O71/57 | O169/156 | O163/142 | O272/237 | O183/133 | O186/144 | O192/150 | O185/145 | O288/264 | O188/138 | O177/136 | O252/226 | O114/77 | O108/60 | O109/76 | O113/64 | O159/124 | P6/6 |
| COMP_0825 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O919/103 | O960/118 | O895/101 | O766/96 | O763/88 | O702/88 | O721/100 | O727/94 | O765/101 | O763/100 | O138/8 | O21/2 | O14/5 | O11/4 | O13/6 | O17/5 | O12/5 | O9/5 | O6/2 | O7/2 | O10/4 | O5/2 | O12/5 | O8/4 | P5/2 |
| COMP_0826 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O3/3 | O3/3 | O4/4 | O2/2 | O7/7 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O5/5 | O4/4 | O3/3 | O3/3 | O2/2 | O4/4 | O4/4 | O6/6 | O5/5 | P1/1 |
| COMP_0827 | 2024-09-07 | 2026-08-28 | 24 | 24 | 24 | B9/9 | O16/16 | O7/7 | O10/10 | O8/8 | O9/9 | O11/11 | O15/15 | O13/13 | O9/9 | O14/14 | O9/9 | O7/7 | O8/8 | O8/8 | O13/13 | O15/15 | O11/11 | O12/12 | O15/15 | O18/18 | O7/7 | O11/11 | B6/6 | X |
| COMP_0828 | 2024-09-02 | 2026-08-31 | 24 | 0 | 0 | B106/N | O78/N | O55/N | O62/N | O62/N | O43/N | O46/N | O62/N | O37/N | O69/N | O51/N | O33/N | O56/N | O43/N | O61/N | O36/N | O35/N | O67/N | O43/N | O31/N | O49/N | O94/N | O66/N | O39/N | X |
| COMP_0829 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O54/54 | O94/94 | O87/87 | O72/72 | O77/77 | O82/82 | O52/52 | O96/96 | O93/93 | O68/68 | O75/75 | O83/83 | O71/71 | O86/86 | O86/86 | O72/72 | O112/112 | O95/95 | O90/90 | O66/66 | O64/64 | O89/89 | O95/95 | O70/70 | P6/6 |
| COMP_0830 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B59/N | O66/N | O58/N | O87/N | O74/N | O82/N | O81/N | O89/N | O56/N | O52/N | O73/N | O73/N | O63/N | O59/N | O70/N | O82/N | O72/N | O53/N | O69/N | O77/N | O20/N | O44/N | O82/N | O83/N | P3/N |
| COMP_0831 | 2024-09-03 | 2026-07-01 | 23 | 23 | 23 | B6/6 | O9/9 | O10/10 | O7/7 | O5/5 | O8/8 | O6/6 | O8/8 | O9/9 | O8/8 | O7/7 | O4/4 | O6/6 | O7/7 | O4/4 | O5/5 | O6/6 | O4/4 | O6/6 | O17/17 | O5/5 | O7/7 | B3/3 | X | X |
| COMP_0832 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O353/273 | O312/230 | O255/205 | O277/234 | O335/300 | O281/245 | O285/239 | O280/221 | O316/254 | O376/305 | O484/412 | O345/291 | O352/287 | O380/321 | O301/245 | O342/287 | O283/240 | O270/229 | O422/345 | O353/283 | O423/347 | O507/426 | O507/420 | O319/267 | P30/27 |
| COMP_0833 | 2024-09-30 | 2026-08-31 | 24 | 24 | 24 | B3/3 | O9/9 | O5/5 | O2/2 | O10/10 | O2/2 | O2/2 | O10/10 | O5/5 | O2/2 | O2/2 | O4/4 | O3/3 | O13/13 | O4/4 | O4/4 | O4/4 | O9/9 | O6/6 | O20/20 | O2/2 | O9/9 | O11/11 | O9/9 | X |
| COMP_0834 | 2024-09-02 | 2026-08-18 | 24 | 24 | 24 | B16/16 | O40/40 | O22/22 | O17/17 | O24/24 | O27/27 | O25/25 | O16/16 | O5/5 | O3/3 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O3/3 | O1/1 | O4/4 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B1/1 | X |
| COMP_0835 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B19/19 | O21/21 | O21/21 | O21/21 | O22/22 | O20/20 | O18/18 | O20/20 | O21/21 | O18/18 | O24/24 | O19/19 | O22/22 | O21/21 | O18/18 | O21/21 | O20/20 | O20/20 | O19/19 | O22/22 | O18/18 | O24/24 | O22/22 | O17/17 | P3/3 |
| COMP_0836 | 2025-05-07 | 2026-08-16 | 16 | 0 | 0 | X | X | X | X | X | X | X | X | B2/N | O8/N | O4/N | O2/N | O2/N | O2/N | O2/N | O1/N | O47/N | O58/N | O52/N | O44/N | O46/N | O59/N | O55/N | B3/N | X |
| COMP_0837 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B359/358 | O514/484 | O299/299 | O260/260 | O209/209 | O209/209 | O236/236 | O204/204 | O243/243 | O199/199 | O247/247 | O161/161 | O305/305 | O489/489 | O192/192 | O271/271 | O255/255 | O186/186 | O287/287 | O261/250 | O201/201 | O182/182 | O253/253 | O216/216 | P5/5 |
| COMP_0838 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O3/3 | O3/3 | O4/4 | O3/3 | O6/6 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O6/6 | O4/4 | O3/3 | O4/4 | O2/2 | O4/4 | O4/4 | O5/5 | O5/5 | P1/1 |
| COMP_0839 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O4/4 | O4/4 | O6/6 | O6/6 | O7/7 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O6/6 | O4/4 | O3/3 | O4/4 | O2/2 | O4/4 | O4/4 | O5/5 | O5/5 | P1/1 |
| COMP_0840 | 2024-09-02 | 2025-07-22 | 11 | 11 | 11 | B81/81 | O93/93 | O137/137 | O83/83 | O97/97 | O120/120 | O99/99 | O67/67 | O79/79 | O76/76 | B85/85 | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0841 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B192/192 | O264/264 | O139/125 | O105/105 | O120/120 | O139/139 | O175/175 | O178/178 | O162/162 | O176/176 | O245/245 | O168/168 | O180/180 | O248/248 | O154/154 | O149/149 | O134/134 | O97/97 | O191/191 | O167/167 | O176/176 | O181/181 | O203/203 | O182/182 | P21/21 |
| COMP_0842 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B7/7 | O8/8 | O6/6 | O12/12 | O6/6 | O6/6 | O7/7 | O4/4 | O5/5 | O41/41 | O4/4 | O5/5 | O14/14 | O3/3 | O5/5 | O8/8 | O6/6 | O12/12 | O8/8 | O4/4 | P2/2 |
| COMP_0843 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O62/56 | O81/70 | O63/55 | O59/47 | O59/48 | O89/72 | O73/62 | O96/74 | O72/56 | O60/55 | O72/60 | O73/61 | O60/51 | O90/76 | O81/73 | O59/54 | O62/56 | O98/75 | O73/65 | O76/58 | O96/69 | O67/52 | O76/62 | O62/49 | P7/4 |
| COMP_0844 | 2025-01-31 | 2026-06-30 | 14 | 14 | 14 | X | X | X | X | B2/2 | G | O7/7 | O2/2 | O10/10 | O14/14 | O4/4 | O2/2 | O8/8 | O4/4 | G | O6/6 | G | O2/2 | O4/4 | G | O6/6 | O8/8 | X | X | X |
| COMP_0845 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B25/25 | O33/33 | O26/26 | O28/28 | O34/34 | O41/41 | O40/40 | O26/26 | O37/37 | O52/52 | O46/46 | O57/57 | O46/46 | O46/46 | O67/67 | O38/38 | O46/46 | O48/48 | O38/38 | O38/38 | P2/2 |
| COMP_0846 | 2024-09-04 | 2026-09-01 | 24 | 24 | 24 | B58/58 | O54/54 | O54/54 | O47/47 | O39/39 | O60/60 | O45/45 | O53/51 | O50/50 | O57/57 | O55/53 | O42/42 | O51/51 | O56/55 | O59/58 | O55/55 | O55/53 | O62/62 | O61/61 | O50/49 | O51/51 | O50/50 | O82/82 | O41/41 | P1/1 |
| COMP_0847 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B21/21 | O32/32 | O20/20 | O19/19 | O30/30 | O16/16 | O25/25 | O34/34 | O19/19 | O20/20 | O49/49 | O20/20 | O22/22 | O35/35 | O23/23 | O28/28 | O26/26 | O35/35 | O27/27 | O34/34 | O34/34 | O44/44 | O40/40 | O36/36 | P3/3 |
| COMP_0848 | 2024-09-03 | 2026-09-01 | 24 | 0 | 0 | B70/N | O81/N | O66/N | O148/N | O146/N | O138/N | O148/N | O136/N | O116/N | O134/N | O160/N | O148/N | O156/N | O232/N | O225/N | O220/N | O207/N | O219/N | O375/N | O361/N | O244/N | O186/N | O199/N | O213/N | P8/N |
| COMP_0849 | 2026-01-01 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O3/N | O16/16 | O714/713 | O2121/2120 | O1135/1134 | O310/304 | O165/156 | O96/91 | P12/12 |
| COMP_0850 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O443/443 | O430/430 | O485/485 | O461/461 | O527/527 | O645/635 | O625/613 | O518/509 | P17/17 |
| COMP_0851 | 2025-12-01 | 2026-08-31 | 9 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O11/N | O6/N | O12/N | O12/N | O8/N | O8/N | O7/N | O12/N | O19/N | X |
| COMP_0852 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O384/384 | O338/338 | O63/63 | O49/49 | O68/68 | O52/52 | O83/83 | O257/257 | O306/306 | O379/379 | O485/485 | O431/431 | O406/406 | O279/279 | O130/130 | O78/78 | O63/63 | O77/77 | O132/132 | O200/200 | O336/336 | O313/313 | O317/317 | O494/494 | P30/30 |
| COMP_0853 | 2026-01-06 | 2026-07-31 | 6 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/N | O13/N | O8/N | O10/N | G | O13/N | O12/N | X | X |
| COMP_0854 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B24/24 | O245/245 | O253/253 | O178/178 | O395/395 | O286/286 | O242/242 | O237/237 | O240/240 | O229/229 | O234/234 | O233/233 | O195/195 | O247/247 | O203/203 | O121/121 | P15/15 |
| COMP_0855 | 2026-03-02 | 2026-09-01 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B467/396 | O457/401 | O397/342 | O469/386 | O458/387 | O424/359 | P70/67 |
| COMP_0856 | 2024-09-01 | 2026-09-01 | 24 | 21 | 21 | O7/N | O8/N | O8/N | O51/12 | O112/32 | O89/20 | O100/27 | O107/19 | O78/18 | O85/17 | O106/35 | O100/19 | O114/22 | O124/35 | O105/12 | O127/10 | O121/12 | O119/8 | O142/5 | O126/10 | O129/1 | O135/2 | O181/4 | O150/2 | P17/N |
| COMP_0857 | 2025-02-13 | 2026-05-19 | 16 | 16 | 16 | X | X | X | X | X | B7/7 | O9/9 | O9/9 | O10/10 | O9/9 | O9/9 | O13/13 | O10/10 | O12/12 | O8/8 | O7/7 | O10/10 | O7/7 | O7/7 | O7/7 | B5/5 | X | X | X | X |
| COMP_0858 | 2026-01-20 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B37/37 | O64/64 | O96/96 | O71/71 | O82/82 | O74/74 | O169/169 | O221/221 | P10/10 |
| COMP_0859 | 2024-09-03 | 2026-09-01 | 22 | 22 | 22 | B3/3 | G | O8/8 | O3/3 | O3/3 | O1/1 | G | O1/1 | O1/1 | O161/161 | O261/261 | O319/319 | O202/202 | O415/415 | O239/239 | O194/194 | O244/244 | O393/393 | O370/370 | O396/396 | O241/241 | O328/328 | O256/256 | O157/157 | P13/13 |
| COMP_0860 | 2026-01-26 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B17/N | O11/N | O16/N | O16/N | O24/N | O36/N | O72/N | O58/N | P5/N |
| COMP_0861 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O88/88 | O61/61 | O65/64 | O70/70 | O47/45 | O84/82 | O72/72 | O51/51 | O58/56 | O75/75 | O239/239 | O60/57 | O75/75 | O60/56 | O78/76 | O71/71 | O70/70 | O86/84 | O144/144 | O98/98 | P10/10 |
| COMP_0862 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B82/82 | O136/136 | O162/162 | O163/163 | O175/175 | O136/136 | O136/136 | O115/115 | O154/154 | O124/124 | O143/143 | O118/118 | O112/112 | O150/150 | O132/132 | O133/133 | O148/148 | O115/115 | O140/140 | O119/119 | O124/124 | O93/93 | O136/136 | O115/115 | P4/4 |
| COMP_0863 | 2025-01-08 | 2026-08-05 | 19 | 19 | 19 | X | X | X | X | B4/4 | O10/10 | O10/10 | O5/5 | O4/4 | O10/10 | O5/5 | O2/2 | O4/4 | O10/6 | O16/16 | O9/7 | O13/11 | O2/2 | O7/5 | O12/9 | G | O18/14 | O5/4 | B2/2 | X |
| COMP_0864 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O59/29 | O94/31 | O80/24 | O92/33 | O96/32 | O81/24 | O89/30 | O82/24 | O64/25 | O82/31 | O88/36 | O71/26 | O84/31 | O100/37 | O74/16 | O59/19 | O81/30 | O90/40 | O94/46 | O70/26 | O45/22 | O81/42 | O110/53 | O94/40 | P4/N |
| COMP_0865 | 2025-09-04 | 2026-08-31 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O7/7 | O6/6 | O7/7 | O10/10 | O4/4 | O26/26 | O20/20 | O6/6 | O11/11 | O12/12 | O4/4 | X |
| COMP_0866 | 2024-11-29 | 2026-08-31 | 22 | 22 | 22 | X | X | B1/1 | O13/8 | O12/10 | O8/7 | O8/5 | O11/9 | O12/9 | O11/8 | O13/12 | O4/4 | O13/9 | O13/11 | O8/7 | O16/12 | O13/11 | O8/7 | O13/9 | O15/12 | O12/9 | O11/8 | O12/10 | O7/5 | X |
| COMP_0867 | 2025-01-20 | 2026-08-06 | 14 | 14 | 14 | X | X | X | X | B2/2 | O2/2 | O5/5 | O5/5 | O9/9 | O12/12 | O3/3 | G | O2/2 | O1/1 | G | O1/1 | G | O1/1 | O1/1 | O3/3 | G | G | G | B1/1 | X |
| COMP_0868 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B21/21 | O39/39 | O27/27 | O18/18 | O25/25 | O34/34 | O30/30 | O35/35 | O35/35 | O49/49 | O47/47 | O33/33 | O38/38 | O56/56 | O31/31 | O26/26 | O38/38 | O30/30 | O51/51 | O42/42 | O35/35 | O58/58 | O47/47 | O27/27 | P1/1 |
| COMP_0869 | 2025-01-01 | 2026-02-07 | 12 | 12 | 12 | X | X | X | X | O1/1 | G | G | O3/3 | O8/8 | O357/357 | O707/706 | O553/551 | O673/671 | O780/778 | O609/608 | O714/714 | O362/362 | B81/81 | X | X | X | X | X | X | X |
| COMP_0870 | 2024-09-02 | 2026-04-29 | 20 | 20 | 20 | B198/198 | O212/212 | O210/210 | O200/200 | O206/206 | O189/189 | O223/223 | O217/217 | O239/239 | O212/212 | O209/209 | O200/200 | O222/222 | O227/227 | O191/191 | O170/170 | O129/129 | O166/166 | O170/170 | B161/161 | X | X | X | X | X |
| COMP_0871 | 2024-09-12 | 2026-08-31 | 24 | 24 | 24 | B7/7 | O7/7 | O5/5 | O4/4 | O7/7 | O5/5 | O5/5 | O9/9 | O6/6 | O13/13 | O10/10 | O6/6 | O5/5 | O8/8 | O5/5 | O4/4 | O5/5 | O7/7 | O5/5 | O7/7 | O6/6 | O6/6 | O6/6 | O3/3 | X |
| COMP_0872 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O49/49 | O46/46 | O54/54 | O54/54 | O63/63 | O64/64 | O69/69 | O57/57 | P2/2 |
| COMP_0873 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O100/100 | O87/87 | O90/89 | O99/99 | O85/85 | O93/92 | O104/104 | O67/67 | O91/90 | O117/117 | O77/77 | O119/115 | O97/97 | O113/113 | O110/109 | O113/111 | O84/84 | O99/98 | O117/116 | O68/68 | P10/10 |
| COMP_0874 | 2025-10-14 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B42/42 | O17/17 | O50/50 | O45/45 | O33/33 | O40/40 | O37/37 | O49/49 | O97/97 | O161/161 | O210/210 | P2/2 |
| COMP_0875 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O110/6 | O169/4 | O151/5 | O193/5 | O181/9 | O157/6 | O170/10 | O192/6 | O194/5 | O203/5 | O216/5 | O112/6 | O175/7 | O166/14 | O143/22 | O152/16 | O179/8 | O188/8 | O167/7 | O191/11 | O216/9 | O227/7 | O294/15 | O74/2 | P9/1 |
| COMP_0876 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B15/15 | O18/18 | O15/15 | O10/10 | O12/12 | O17/17 | O12/12 | O11/11 | O15/15 | O9/9 | O12/12 | O10/10 | O7/7 | O19/19 | O11/11 | O12/12 | O14/14 | O13/13 | O26/26 | O24/24 | O14/14 | O23/23 | O14/14 | O16/16 | X |
| COMP_0877 | 2025-07-28 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B124/124 | O499/499 | O656/656 | O627/627 | O548/548 | O727/727 | O686/686 | O584/584 | O619/619 | O525/525 | O509/509 | O1232/647 | O651/651 | O553/553 | P32/32 |
| COMP_0878 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B76/76 | O142/142 | O144/144 | O125/125 | O130/130 | O104/104 | O139/139 | O74/74 | P7/7 |
| COMP_0879 | 2025-01-06 | 2026-08-26 | 19 | 7 | 7 | X | X | X | X | B2/N | O2/N | O5/N | G | O3/N | O5/1 | O3/1 | O2/N | O11/1 | O4/N | O6/2 | O6/2 | O3/N | O7/N | O4/1 | O4/N | O2/N | O4/1 | O3/N | B5/N | X |
| COMP_0880 | 2025-08-29 | 2026-09-01 | 13 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | B1/N | O23/N | O55/N | O156/N | O230/N | O177/N | O213/N | O201/N | O394/N | O155/N | O133/N | O155/N | O375/N | P2/N |
| COMP_0881 | 2025-03-03 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B85/85 | O121/121 | O82/82 | O138/138 | O157/157 | O90/90 | O105/105 | O128/128 | O86/86 | O110/110 | O119/119 | O128/128 | O138/138 | O133/133 | O136/136 | O202/202 | O197/197 | O174/174 | P10/10 |
| COMP_0882 | 2024-09-17 | 2026-08-17 | 24 | 24 | 24 | B1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B1/1 | X |
| COMP_0883 | 2024-09-02 | 2026-08-14 | 21 | 21 | 21 | B15/15 | O15/15 | O12/12 | O13/13 | O14/14 | O13/13 | O13/13 | O9/9 | O13/13 | O13/13 | O13/13 | O7/7 | O5/5 | O5/5 | O3/3 | O2/2 | G | G | G | O2/2 | O14/14 | O3/3 | O4/4 | B5/5 | X |
| COMP_0884 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B8/8 | O9/9 | O29/29 | O32/32 | O26/26 | O47/47 | O40/40 | O31/31 | O47/47 | O28/28 | O42/42 | O37/37 | O39/39 | O39/39 | O45/45 | O41/41 | O34/34 | O42/42 | O34/34 | O31/31 | P1/1 |
| COMP_0885 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O248/248 | O224/224 | O226/226 | O282/282 | O195/195 | O210/210 | O210/210 | O263/263 | O209/209 | O218/218 | O225/225 | O236/236 | O217/217 | O271/271 | O215/215 | O247/247 | O153/153 | O217/217 | O263/263 | O299/299 | O217/217 | O234/234 | O202/202 | O253/253 | P15/15 |
| COMP_0886 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O235/235 | O350/350 | O352/352 | O378/378 | O345/345 | O325/325 | O427/427 | O464/464 | O490/490 | O541/541 | O526/526 | O560/560 | O661/661 | O596/596 | O619/619 | O665/665 | O639/639 | O647/647 | O869/869 | O671/671 | O681/681 | O664/664 | O709/709 | O534/534 | P23/23 |
| COMP_0887 | 2026-01-12 | 2026-08-26 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B23/23 | O45/45 | O107/107 | O161/161 | O286/286 | O519/519 | O126/126 | B105/105 | X |
| COMP_0888 | 2024-09-09 | 2026-09-01 | 24 | 24 | 24 | B16/16 | O24/24 | O20/20 | O39/39 | O32/32 | O31/31 | O31/31 | O46/46 | O54/54 | O24/24 | O19/19 | O18/18 | O15/15 | O25/25 | O29/29 | O30/30 | O15/15 | O13/13 | O21/21 | O18/18 | O14/14 | O11/11 | O31/31 | O20/20 | P1/1 |
| COMP_0889 | 2024-09-30 | 2026-05-15 | 21 | 21 | 21 | B1/1 | O101/101 | O77/77 | O77/77 | O97/97 | O96/96 | O92/92 | O100/100 | O96/96 | O81/81 | O113/113 | O90/90 | O102/102 | O114/114 | O128/128 | O90/90 | O91/91 | O79/79 | O75/75 | O79/79 | B27/27 | X | X | X | X |
| COMP_0890 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B140/140 | O147/147 | O149/149 | O173/173 | O155/155 | O150/150 | O163/163 | O169/169 | O162/162 | O158/158 | O154/154 | O122/122 | O152/152 | O143/143 | O133/133 | O156/156 | O122/122 | O135/135 | O186/186 | O152/152 | O160/160 | O166/166 | O144/144 | O130/130 | P19/19 |
| COMP_0891 | 2025-08-01 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | O24/24 | O27/27 | O42/42 | O45/45 | O13/13 | O16/16 | O17/17 | O13/13 | O18/18 | O20/20 | O16/16 | O22/22 | O24/24 | P4/4 |
| COMP_0892 | 2024-09-10 | 2026-08-31 | 24 | 24 | 24 | B13/13 | O17/17 | O10/10 | O29/29 | O30/30 | O30/30 | O48/48 | O62/62 | O18/18 | O21/21 | O22/22 | O24/24 | O19/19 | O17/17 | O201/201 | O26/26 | O52/52 | O21/21 | O21/21 | O51/51 | O53/53 | O57/57 | O43/43 | O28/28 | X |
| COMP_0893 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O809/299 | O771/312 | O832/306 | O725/315 | O878/320 | O765/308 | P31/14 |
| COMP_0894 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B14/14 | O54/54 | O55/55 | O62/62 | O73/73 | O61/61 | O72/72 | O80/80 | O68/68 | O80/80 | O68/68 | O70/70 | O79/79 | O81/81 | O78/78 | O77/77 | O92/92 | O72/72 | P6/6 |
| COMP_0895 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O46/46 | O25/25 | O14/14 | O23/23 | O34/34 | O10/10 | O13/13 | O19/19 | O12/12 | O16/16 | O33/33 | O13/13 | O22/22 | O23/23 | O8/8 | O20/20 | O23/23 | O13/13 | O18/18 | O16/16 | O15/15 | O15/15 | O18/18 | O13/13 | P1/1 |
| COMP_0896 | 2025-12-31 | 2026-09-01 | 9 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/N | O271/260 | O189/176 | O252/238 | O225/215 | O224/220 | O248/243 | O236/225 | O204/195 | P15/13 |
| COMP_0897 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O43/43 | O53/53 | O55/55 | O73/73 | O79/79 | O85/85 | O151/151 | O234/234 | O184/184 | O88/88 | O199/199 | O492/492 | O536/536 | O515/515 | O520/520 | O510/510 | O537/537 | O500/500 | O549/549 | O480/480 | P25/25 |
| COMP_0898 | 2026-02-25 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B79/79 | O837/788 | O808/737 | O712/667 | O730/676 | O988/889 | O596/555 | P34/32 |
| COMP_0899 | 2025-06-01 | 2026-08-31 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | O14/14 | O14/14 | O10/10 | O13/13 | O11/11 | O9/9 | O10/10 | O12/12 | O13/13 | O9/9 | O11/11 | O10/10 | O9/9 | O11/11 | O11/11 | X |
| COMP_0900 | 2026-02-09 | 2026-09-01 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B31/N | O164/N | O353/N | O324/N | O205/N | O442/N | O218/N | P2/N |
| COMP_0901 | 2026-02-06 | 2026-08-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B65/65 | O52/52 | O59/59 | O50/50 | O56/56 | O62/62 | O47/47 | X |
| COMP_0902 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B5/5 | O1/1 | O4/4 | O2/2 | O1/1 | O3/3 | O1/1 | O1/1 | O2/2 | O1/1 | O4/4 | O2/2 | O1/1 | O3/3 | O3/3 | O2/2 | O1/1 | O3/3 | O2/2 | P1/1 |
| COMP_0903 | 2024-10-04 | 2026-08-28 | 22 | 22 | 22 | X | B15/15 | O12/12 | O16/16 | O21/21 | O16/16 | O14/14 | O9/9 | O32/32 | O80/80 | O54/54 | O33/33 | O10/10 | O30/30 | O16/16 | O27/27 | O18/18 | O18/18 | O22/22 | O76/76 | O77/77 | O40/40 | G | B1/1 | X |
| COMP_0904 | 2025-01-02 | 2026-08-25 | 20 | 20 | 20 | X | X | X | X | B3/3 | O3/3 | O3/3 | O7/7 | O2/2 | O4/4 | O13/13 | O5/5 | O5/5 | O10/10 | O6/6 | O7/7 | O11/11 | O6/6 | O6/6 | O9/9 | O6/6 | O4/4 | O14/14 | B7/7 | X |
| COMP_0905 | 2024-09-05 | 2026-08-25 | 24 | 24 | 24 | B6/6 | O5/5 | O1/1 | O9/9 | O5/5 | O15/15 | O32/32 | O20/20 | O20/20 | O31/31 | O40/40 | O17/17 | O35/35 | O42/42 | O67/67 | O26/26 | O27/27 | O60/60 | O50/50 | O20/20 | O23/23 | O15/15 | O7/7 | B5/5 | X |
| COMP_0906 | 2025-11-09 | 2026-07-06 | 9 | 9 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B130/N | O184/N | O164/N | O148/N | O97/N | O27/N | O15/N | O11/N | B2/N | X | X |
| COMP_0907 | 2024-09-05 | 2026-08-21 | 24 | 24 | 24 | B3/3 | O2/2 | O4/4 | O1/1 | O2/2 | O1/1 | O2/2 | O5/5 | O3/3 | O1/1 | O10/10 | O1/1 | O1/1 | O2/2 | O3/3 | O2/2 | O2/2 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | O1/1 | B2/2 | X |
| COMP_0908 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O54/54 | O86/86 | O50/50 | O69/69 | O52/52 | O77/77 | O61/61 | O52/52 | O47/47 | O53/53 | O61/61 | O34/34 | O53/53 | O50/50 | O66/66 | O104/104 | O53/53 | O49/49 | O45/45 | O49/49 | O42/42 | O58/58 | O55/55 | O31/31 | P4/4 |
| COMP_0909 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O440/425 | O545/538 | O596/584 | O489/461 | O533/503 | O327/292 | O408/373 | O386/349 | O274/242 | O369/299 | O349/298 | O224/197 | O394/309 | O336/256 | O264/231 | O297/247 | O283/236 | O257/234 | O218/185 | O277/246 | O302/283 | O274/232 | O423/389 | O229/196 | P15/12 |
| COMP_0910 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B37/37 | O155/155 | O145/145 | O134/134 | O131/131 | O99/99 | O122/122 | O160/160 | O121/121 | O123/123 | O133/133 | O129/129 | O129/129 | O127/127 | O114/114 | O116/116 | O133/133 | O112/112 | P10/10 |
| COMP_0911 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B12/12 | O57/57 | O51/51 | O55/55 | O58/58 | O44/44 | O51/51 | O53/53 | O49/49 | O50/50 | O48/48 | O48/48 | O49/49 | O55/55 | O44/44 | O63/63 | O61/61 | O48/48 | P3/3 |
| COMP_0912 | 2025-10-02 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B185/184 | O180/176 | O192/189 | O200/197 | O226/221 | O335/331 | O382/365 | O396/374 | O624/576 | O735/688 | O428/408 | P20/17 |
| COMP_0913 | 2024-10-16 | 2026-09-01 | 23 | 23 | 23 | X | B11/11 | O6/6 | O24/24 | O12/12 | O25/25 | O32/32 | O21/21 | O21/21 | O25/25 | O89/89 | O63/63 | O61/61 | O25/25 | O27/27 | O24/24 | O22/22 | O35/35 | O11/11 | O36/36 | O9/9 | O25/25 | O100/100 | O85/85 | P1/1 |
| COMP_0914 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B29/29 | O55/55 | O62/62 | O50/50 | O70/70 | O61/61 | O47/47 | O57/57 | O67/67 | O49/49 | O80/80 | O50/50 | O67/67 | O69/69 | O103/103 | O75/75 | O101/101 | O89/89 | O85/85 | P2/2 |
| COMP_0915 | 2025-01-20 | 2026-08-31 | 20 | 20 | 20 | X | X | X | X | B35/34 | O80/78 | O66/64 | O80/80 | O91/88 | O92/87 | O80/77 | O57/57 | O95/90 | O97/97 | O83/80 | O78/73 | O52/52 | O93/93 | O91/85 | O80/80 | O90/90 | O115/106 | O100/100 | O91/88 | X |
| COMP_0916 | 2024-09-30 | 2025-10-26 | 14 | 14 | 14 | B4/1 | O4/1 | O12/5 | O10/3 | O7/2 | O17/7 | O9/4 | O14/5 | O15/5 | O9/4 | O14/5 | O15/3 | O17/4 | B10/4 | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0917 | 2025-02-24 | 2026-08-24 | 14 | 14 | 14 | X | X | X | X | X | B1/1 | O1/1 | O3/3 | O6/6 | G | O1/1 | O1/1 | O5/5 | O1/1 | O2/2 | G | O2/2 | O1/1 | G | G | O1/1 | G | O1/1 | B1/1 | X |
| COMP_0918 | 2025-09-15 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B11/11 | O14/14 | O14/14 | O12/12 | O11/11 | O11/11 | O15/15 | O18/18 | O13/13 | O11/11 | O12/12 | O10/10 | P1/1 |
| COMP_0919 | 2025-09-04 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B365/361 | O466/431 | O482/450 | O557/537 | O536/521 | O528/500 | O621/600 | O578/566 | O515/503 | O586/568 | O635/616 | O291/285 | P32/29 |
| COMP_0920 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B123/123 | O67/67 | O372/372 | O375/375 | O287/287 | O205/205 | O234/234 | O98/98 | P4/4 |
| COMP_0921 | 2025-11-28 | 2026-09-01 | 10 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/N | O16/14 | O32/26 | O22/17 | O9/N | O3/N | O21/5 | O39/24 | O40/27 | O36/29 | P2/2 |
| COMP_0922 | 2025-04-07 | 2026-08-31 | 16 | 16 | 16 | X | X | X | X | X | X | X | B1/1 | O3/3 | O3/3 | O3/3 | O1/1 | O1/1 | O3/3 | O2/2 | O1/1 | O1/1 | G | O2/2 | O2/2 | O3/3 | O2/2 | O3/3 | O1/1 | X |
| COMP_0923 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B89/89 | O94/94 | O97/97 | O96/96 | O85/85 | O85/85 | O106/106 | O110/110 | O135/135 | O110/110 | O113/113 | O95/95 | O174/174 | O103/103 | O119/119 | O93/93 | O77/77 | O72/72 | O75/75 | O80/80 | O81/81 | O86/86 | O99/99 | O97/97 | P9/9 |
| COMP_0924 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O132/125 | O184/174 | O121/120 | O134/132 | O136/133 | O110/110 | O135/134 | O161/161 | O143/142 | O149/147 | O165/165 | O125/125 | O152/152 | O157/157 | O143/143 | O170/169 | O181/181 | O138/138 | O154/154 | O229/229 | O253/253 | O237/237 | O283/283 | O250/250 | P5/5 |
| COMP_0925 | 2025-12-17 | 2026-07-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | O2/2 | O1/1 | O4/4 | G | O2/2 | O1/1 | O5/5 | X | X |
| COMP_0926 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B65/65 | O37/37 | O42/42 | O46/46 | O55/55 | O60/60 | O15/15 | O64/64 | O41/41 | O63/63 | O72/72 | O62/62 | O14/14 | O90/70 | O23/23 | O51/51 | O55/55 | O49/49 | O33/33 | P1/1 |
| COMP_0927 | 2024-10-07 | 2026-09-01 | 23 | 23 | 23 | X | B58/58 | O42/42 | O51/51 | O39/39 | O69/69 | O55/55 | O83/83 | O81/81 | O138/138 | O461/461 | O451/451 | O137/137 | O171/171 | O65/65 | O69/69 | O72/72 | O76/76 | O47/47 | O65/65 | O57/57 | O198/198 | O601/601 | O466/466 | P12/12 |
| COMP_0928 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B93/93 | O522/522 | O670/656 | O510/507 | O714/676 | O778/691 | O704/614 | O789/705 | O737/640 | O655/555 | O731/625 | O669/597 | O850/713 | O959/849 | O944/817 | O565/491 | P39/37 |
| COMP_0929 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O101/2 | O138/3 | O164/4 | O305/2 | O382/1 | O381/4 | O525/5 | O458/4 | O408/3 | O354/27 | O322/28 | O262/27 | O108/31 | O86/29 | O165/30 | O309/32 | O283/28 | O739/31 | O889/37 | O844/28 | P20/N |
| COMP_0930 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O23/23 | O16/16 | O19/19 | O21/20 | O28/26 | O21/21 | P1/1 |
| COMP_0931 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O53/53 | O38/38 | O106/106 | O142/142 | O103/103 | O100/100 | O114/114 | O102/102 | O121/121 | O108/108 | O100/100 | O130/130 | O94/94 | O101/101 | O159/159 | O137/137 | O87/87 | O82/82 | O69/69 | O99/99 | O108/108 | O198/198 | O143/143 | O119/119 | P9/9 |
| COMP_0932 | 2026-01-15 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B86/86 | O55/55 | O72/72 | O74/74 | O54/54 | O50/50 | O57/57 | O28/28 | P5/5 |
| COMP_0933 | 2026-02-13 | 2026-08-28 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B48/5 | O75/4 | O56/6 | O58/6 | O58/3 | O61/6 | B62/6 | X |
| COMP_0934 | 2025-11-13 | 2026-08-31 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O2/2 | O1/1 | O1/1 | O4/4 | O4/4 | O8/8 | O2/2 | O2/2 | O4/4 | X |
| COMP_0935 | 2025-09-16 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O44/44 | O73/73 | O87/87 | O91/91 | O65/65 | O105/105 | O158/158 | O162/162 | O214/212 | O183/182 | O298/146 | P32/5 |
| COMP_0936 | 2025-06-20 | 2026-08-31 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | B9/9 | O10/10 | O6/6 | O10/10 | O7/7 | G | G | O1/1 | O6/6 | O9/9 | O3/3 | O2/2 | O3/3 | O20/20 | O13/13 | X |
| COMP_0937 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B33/33 | O114/114 | O107/107 | O99/99 | O118/118 | O95/95 | O111/111 | O107/107 | O112/112 | O103/103 | O104/104 | O111/111 | O119/119 | O110/110 | O104/104 | O123/123 | O110/110 | O95/95 | P6/6 |
| COMP_0938 | 2024-09-03 | 2025-09-02 | 13 | 0 | 0 | B4/N | O6/N | O129/N | O175/N | O199/N | O162/N | O5/N | O10/N | O8/N | O9/N | O8/N | O6/N | B2/N | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_0939 | 2026-01-23 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B122/15 | O364/25 | O386/20 | O339/23 | O381/12 | O358/16 | O355/31 | O305/25 | P33/3 |
| COMP_0940 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B79/79 | O41/41 | O27/27 | O65/65 | O45/45 | O59/59 | O10/10 | O57/57 | O40/40 | O47/47 | O70/70 | O67/67 | O15/15 | O56/56 | O16/16 | O77/77 | O49/49 | O43/43 | O44/44 | P1/1 |
| COMP_0941 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O158/158 | O160/148 | O136/136 | O113/113 | O114/114 | O115/115 | O128/128 | O168/168 | O106/106 | O98/98 | O90/90 | O100/100 | O106/106 | O135/135 | O93/93 | O115/115 | O103/103 | O112/112 | O96/96 | O187/187 | O113/113 | O149/149 | O120/120 | O103/103 | P8/8 |
| COMP_0942 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B74/74 | O60/60 | O67/67 | O50/50 | O37/37 | O44/44 | O53/53 | O38/38 | O32/32 | O25/25 | O41/41 | O40/40 | O52/52 | O57/57 | O37/37 | O41/41 | O42/42 | O35/35 | O43/43 | O41/41 | O43/43 | O42/42 | O48/48 | O38/38 | P2/2 |
| COMP_0943 | 2026-02-16 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O36/36 | O32/32 | O36/36 | O71/71 | O55/55 | O44/44 | P1/1 |
| COMP_0944 | 2026-01-15 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O150/150 | O235/235 | O234/234 | O231/230 | O239/236 | O278/274 | O246/237 | P5/5 |
| COMP_0945 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B53/52 | O64/64 | O44/44 | O46/45 | O50/50 | O48/48 | O46/45 | O48/48 | O52/49 | O31/28 | O59/58 | O38/37 | O49/48 | O110/108 | O59/56 | O51/48 | O56/56 | O35/35 | O55/54 | O47/47 | O50/50 | O45/44 | O66/66 | O53/53 | P2/2 |
| COMP_0946 | 2025-07-31 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B3/3 | O18/18 | O59/59 | O108/105 | O123/115 | O117/111 | O100/96 | O125/125 | O114/114 | O143/143 | O142/142 | O123/123 | O120/120 | O92/92 | P6/6 |
| COMP_0947 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B153/139 | O132/132 | O119/119 | O146/146 | O87/87 | O116/116 | O124/124 | O127/127 | O108/108 | O134/134 | O105/105 | O90/90 | O137/137 | O161/161 | O106/106 | O164/164 | O86/86 | O136/136 | O158/158 | O143/143 | O155/155 | O198/198 | O118/118 | O111/111 | P13/13 |
| COMP_0948 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B57/57 | O100/100 | O69/69 | O105/105 | O83/83 | O88/88 | O69/69 | O71/71 | O78/78 | O75/75 | O106/106 | O69/69 | O63/63 | O89/89 | O80/80 | O82/82 | O75/75 | O79/79 | O76/76 | O128/128 | O72/72 | O162/162 | O139/139 | O86/86 | P11/11 |
| COMP_0949 | 2025-04-25 | 2026-08-18 | 15 | 15 | 15 | X | X | X | X | X | X | X | B2/2 | O4/4 | O1/1 | O2/2 | O2/2 | O2/2 | G | O1/1 | G | O3/3 | O2/2 | O2/2 | O1/1 | O2/2 | O1/1 | O1/1 | B3/3 | X |
| COMP_0950 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B36/36 | O29/27 | O32/32 | O33/33 | O33/30 | O27/24 | O25/23 | O19/18 | O39/30 | O25/25 | O24/24 | O17/17 | O23/21 | O19/19 | O14/14 | O16/16 | O18/18 | O19/19 | O17/17 | O19/19 | O11/11 | O13/13 | O17/17 | O10/10 | P3/3 |
| COMP_0951 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B125/35 | O160/49 | O133/42 | O146/39 | O131/41 | O120/38 | O148/55 | O108/33 | O109/39 | O114/35 | O153/65 | O131/64 | O120/44 | O140/55 | O111/48 | O130/47 | O140/48 | O128/64 | O163/74 | O144/53 | O123/50 | O97/36 | O150/41 | O107/38 | P4/2 |
| COMP_0952 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B48/48 | O85/85 | O81/81 | O114/99 | O111/111 | O93/93 | O149/149 | O96/96 | O109/109 | O121/121 | O110/110 | O124/107 | O115/115 | O106/106 | O95/95 | O120/120 | O91/91 | O99/99 | O111/111 | O69/69 | P9/9 |
| COMP_0953 | 2026-03-04 | 2026-08-31 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O5/5 | O4/4 | O7/7 | O3/3 | O6/6 | X |
| COMP_0954 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O164/164 | O169/169 | O131/131 | O168/168 | O206/206 | O123/123 | P6/6 |
| COMP_0955 | 2024-09-13 | 2026-09-01 | 24 | 24 | 24 | B14/14 | O19/19 | O19/19 | O24/24 | O24/24 | O14/14 | O26/26 | O21/21 | O16/16 | O16/16 | O23/23 | O9/9 | O20/20 | O24/24 | O16/16 | O17/17 | O23/23 | O16/16 | O25/25 | O18/18 | O15/15 | O17/17 | O23/23 | O17/17 | P2/2 |
| COMP_0956 | 2026-02-28 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O269/201 | O236/184 | O211/114 | O244/109 | O282/140 | O82/50 | P1/1 |
| COMP_0957 | 2026-03-02 | 2026-09-01 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B179/135 | O175/134 | O158/117 | O212/155 | O188/145 | O125/91 | P10/8 |
| COMP_0958 | 2025-01-05 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B163/163 | O188/188 | O193/193 | O239/239 | O245/245 | O196/196 | O209/209 | O214/214 | O200/200 | O240/240 | O225/225 | O214/214 | O170/170 | O304/304 | O416/416 | O342/342 | O360/360 | O330/330 | O274/274 | O314/314 | P22/22 |
| COMP_0959 | 2024-10-04 | 2026-08-31 | 18 | 0 | 0 | X | B29/N | O21/N | O27/N | O24/N | O22/N | O24/N | G | G | G | G | G | O4/N | O23/N | O32/N | O34/N | O21/N | O23/N | O26/N | O24/N | O30/N | O36/N | O26/N | O31/N | X |
| COMP_0960 | 2024-09-16 | 2026-08-31 | 24 | 24 | 24 | B4/4 | O7/7 | O14/14 | O20/20 | O24/24 | O15/15 | O17/17 | O15/15 | O11/11 | O14/14 | O19/19 | O14/14 | O14/14 | O20/20 | O15/15 | O19/19 | O22/22 | O25/25 | O18/18 | O15/15 | O16/16 | O30/30 | O18/18 | O9/9 | X |
| COMP_0961 | 2024-11-29 | 2026-08-27 | 22 | 2 | 2 | X | X | B2/N | O2/N | O8/N | O3/N | O4/N | O3/N | O5/1 | O27/N | O37/N | O33/N | O32/N | O29/1 | O34/N | O28/N | O19/N | O8/N | O8/N | O6/N | O5/N | O4/N | O17/N | B12/N | X |
| COMP_0962 | 2025-08-25 | 2026-04-20 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | B91/91 | O383/383 | O410/410 | O389/389 | O427/427 | O403/403 | O326/326 | O371/371 | B252/252 | X | X | X | X | X |
| COMP_0963 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O6/6 | O5/5 | O5/5 | O11/11 | O2/2 | O5/5 | O4/4 | O6/6 | O6/6 | O5/5 | O2/2 | O6/6 | O9/9 | O4/4 | O10/10 | O7/7 | O7/7 | O7/7 | O6/6 | O5/5 | O7/7 | O10/10 | O7/7 | P1/1 |
| COMP_0964 | 2026-02-17 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B14/3 | O32/4 | O98/70 | O228/198 | O250/246 | O175/175 | O186/186 | P9/9 |
| COMP_0965 | 2026-05-11 | 2026-09-01 | 4 | 4 | 4 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B160/135 | O274/217 | O314/235 | O314/242 | P21/15 |
| COMP_0966 | 2025-01-02 | 2026-07-22 | 19 | 0 | 0 | X | X | X | X | B36/N | O34/N | O45/N | O72/N | O157/N | O129/N | O139/N | O132/N | O127/N | O209/N | O110/N | O109/N | O115/N | O99/N | O111/N | O100/N | O55/N | O31/N | B43/N | X | X |
| COMP_0967 | 2024-12-09 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B35/35 | O35/35 | O27/27 | O34/34 | O36/36 | O32/32 | O47/47 | O41/41 | O30/30 | O36/36 | O47/47 | O46/46 | O49/49 | O56/56 | O39/39 | O54/54 | O56/56 | O61/61 | O57/57 | O78/78 | O62/62 | P1/1 |
| COMP_0968 | 2025-03-03 | 2026-07-29 | 9 | 9 | 9 | X | X | X | X | X | X | B8/8 | O14/14 | O15/15 | O16/16 | O12/12 | O7/7 | O2/2 | G | G | O1/1 | G | G | G | G | G | G | B1/1 | X | X |
| COMP_0969 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O790/426 | O861/506 | O747/413 | O819/485 | O790/467 | O723/402 | O718/391 | O760/439 | O777/466 | O789/441 | O699/380 | O708/380 | O758/393 | O870/494 | O726/409 | O817/469 | O683/383 | O777/451 | O782/440 | O793/476 | O709/540 | O732/688 | O676/644 | O688/510 | P44/30 |
| COMP_0970 | 2026-02-25 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B25/25 | O364/363 | O291/288 | O295/288 | O408/391 | O341/337 | O285/281 | P12/12 |
| COMP_0971 | 2026-02-13 | 2026-08-28 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B29/N | O35/N | O27/N | O35/N | O28/N | O29/N | B26/N | X |
| COMP_0972 | 2025-08-19 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B26/26 | O95/95 | O60/60 | O92/92 | O97/97 | O76/76 | O79/79 | O60/60 | O59/59 | O67/67 | O80/80 | O79/79 | O61/61 | P4/4 |
| COMP_0973 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B63/63 | O58/58 | O57/57 | O63/63 | O50/50 | O60/60 | O51/51 | O64/64 | O51/51 | O64/64 | O59/59 | O52/52 | O58/58 | O65/65 | O52/52 | O61/61 | O51/51 | O53/53 | O60/60 | O27/27 | O47/47 | O26/26 | O63/63 | O41/41 | P3/3 |
| COMP_0974 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O17/17 | O31/31 | O31/31 | O26/26 | O45/45 | O66/66 | O47/47 | O70/70 | O84/83 | O53/53 | O48/48 | O36/36 | P4/4 |
| COMP_0975 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B39/39 | O36/36 | O45/45 | O56/56 | O46/46 | O33/33 | O37/37 | O53/53 | O60/60 | O61/61 | O65/65 | O39/39 | O59/59 | O47/47 | O45/45 | O62/62 | O56/56 | O37/37 | O48/48 | O56/56 | O45/45 | O34/34 | O35/35 | O56/56 | P6/6 |
| COMP_0976 | 2025-12-18 | 2026-07-20 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B34/12 | O72/22 | O92/9 | O112/10 | O90/8 | O187/10 | O224/12 | B268/32 | X | X |
| COMP_0977 | 2025-11-24 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B46/46 | O186/186 | O174/174 | O123/123 | O178/178 | O157/157 | O203/203 | O210/210 | O174/174 | O128/128 | P7/7 |
| COMP_0978 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O107/44 | O112/52 | O91/48 | O158/44 | O93/44 | O105/50 | O94/42 | O93/56 | O110/54 | O76/29 | O85/37 | O55/19 | O69/33 | O104/58 | O78/28 | O110/36 | O85/32 | O99/52 | O85/43 | O100/47 | O67/38 | O95/39 | O99/49 | O74/17 | P5/2 |
| COMP_0979 | 2025-01-21 | 2026-07-04 | 19 | 19 | 19 | X | X | X | X | B4/4 | O3/3 | O3/3 | O6/6 | O4/4 | O5/5 | O15/15 | O4/4 | O2/2 | O15/15 | O11/11 | O7/7 | O8/8 | O5/5 | O4/4 | O7/7 | O8/8 | O8/8 | B2/2 | X | X |
| COMP_0980 | 2024-09-07 | 2026-04-30 | 20 | 20 | 20 | B27/27 | O15/15 | O11/11 | O41/41 | O13/13 | O15/15 | O23/23 | O29/29 | O27/27 | O18/18 | O29/29 | O27/27 | O38/38 | O34/34 | O35/35 | O36/36 | O28/28 | O30/30 | O21/21 | O48/48 | X | X | X | X | X |
| COMP_0981 | 2024-09-05 | 2026-09-01 | 8 | 8 | 8 | B29/29 | O29/29 | O29/29 | O36/36 | O15/15 | O8/8 | O5/5 | O6/6 | G | G | G | G | G | G | G | G | G | G | G | G | G | G | G | G | P4/4 |
| COMP_0982 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O117/3 | O116/7 | O143/37 | O230/91 | O180/77 | O202/66 | O234/96 | O148/51 | O178/87 | O236/95 | O201/84 | O128/22 | O133/29 | O132/43 | O148/45 | O189/78 | O176/67 | O171/78 | O116/33 | O89/17 | P16/4 |
| COMP_0983 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O216/216 | O262/262 | O265/265 | O220/220 | O225/225 | O286/286 | O220/220 | O88/88 | O25/25 | O34/34 | O29/29 | O97/97 | O371/371 | O332/332 | O237/237 | O347/347 | O438/438 | O570/570 | O590/590 | O428/428 | O421/421 | O439/439 | O419/419 | O307/307 | P13/13 |
| COMP_0984 | 2024-09-01 | 2026-08-03 | 24 | 18 | 18 | O18/N | O14/N | O26/N | O30/1 | O40/3 | O41/3 | O41/N | O45/1 | O29/1 | O37/8 | O37/8 | O48/9 | O61/12 | O39/12 | O37/6 | O25/5 | O10/1 | O9/2 | O7/N | O8/1 | O7/N | O6/1 | O7/3 | B9/6 | X |
| COMP_0985 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B67/67 | O71/71 | O75/75 | O75/75 | O68/68 | O72/72 | O77/77 | O65/65 | O73/73 | O108/106 | O95/94 | O52/50 | O74/72 | O94/92 | O95/77 | O100/98 | O77/75 | O64/63 | O95/90 | O84/81 | O79/77 | O75/72 | O82/82 | O26/26 | P1/1 |
| COMP_0986 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O61/61 | O59/59 | O53/53 | O51/51 | O54/54 | O58/58 | O62/62 | O45/45 | P5/5 |
| COMP_0987 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O72/72 | O32/32 | O33/33 | O33/33 | O41/41 | O33/33 | O46/46 | O51/51 | O37/37 | O44/44 | O54/54 | O33/33 | O51/51 | O64/64 | O39/39 | O43/43 | O57/57 | O47/47 | O87/87 | O52/52 | O48/48 | O43/43 | O44/44 | O38/38 | P4/4 |
| COMP_0988 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O457/447 | O545/533 | O569/553 | O498/487 | O556/545 | O572/563 | O610/601 | O399/389 | P47/46 |
| COMP_0989 | 2025-05-29 | 2026-08-31 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B1/1 | O5/5 | O5/5 | O2/2 | O2/2 | O8/8 | O3/3 | O4/4 | O1/1 | O2/2 | O2/2 | O3/3 | O2/2 | O3/3 | O2/2 | O1/1 | X |
| COMP_0990 | 2025-11-18 | 2026-09-01 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B11/N | O30/N | O22/N | O38/N | O39/N | O30/N | O45/N | O19/N | O57/N | O48/N | P2/N |
| COMP_0991 | 2025-08-18 | 2026-08-11 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O3/3 | O3/3 | O5/5 | O2/2 | O9/9 | O4/4 | O2/2 | O7/7 | O2/2 | O2/2 | O4/4 | B6/6 | X |
| COMP_0992 | 2025-10-14 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B14/14 | O4/4 | O21/16 | O19/19 | O9/9 | O15/15 | O15/12 | O8/8 | O18/15 | O63/58 | O82/80 | P2/2 |
| COMP_0993 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O54/38 | O63/40 | O126/95 | O205/184 | O303/272 | O339/311 | O372/348 | O349/319 | O219/193 | O89/61 | O65/40 | O57/39 | O50/39 | O55/43 | O94/70 | O178/164 | O192/171 | O241/208 | O288/258 | O233/208 | P16/14 |
| COMP_0994 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B19/19 | O11/11 | O26/26 | O53/53 | O17/15 | O24/22 | O29/25 | O20/20 | O15/15 | O21/21 | O45/45 | O26/20 | O13/13 | O62/39 | O20/10 | O61/61 | O12/12 | O19/19 | O26/22 | O17/17 | O14/12 | O44/44 | O26/26 | O13/11 | X |
| COMP_0995 | 2025-01-09 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B31/29 | O57/57 | O338/338 | O363/361 | O331/329 | O388/384 | O400/395 | O364/362 | O394/386 | O365/355 | O330/330 | O432/425 | O356/338 | O337/325 | O379/359 | O365/340 | O338/321 | O411/385 | O415/392 | O406/379 | P25/19 |
| COMP_0996 | 2025-12-31 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O8/8 | O159/159 | O171/171 | O174/174 | O142/142 | O106/106 | O128/128 | O105/105 | P2/2 |
| COMP_0997 | 2025-08-15 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O12/12 | O12/12 | O15/15 | O12/12 | O15/15 | O17/17 | O11/11 | O13/13 | O9/9 | O16/16 | O14/14 | O9/9 | P1/1 |
| COMP_0998 | 2025-08-11 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B83/83 | O333/333 | O442/442 | O399/397 | O386/385 | O399/398 | O359/358 | O512/512 | O507/507 | O413/413 | O462/462 | O199/199 | O142/142 | P55/55 |
| COMP_0999 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B50/50 | O46/46 | O62/62 | O66/66 | O108/108 | O97/97 | O89/89 | O74/74 | O86/86 | O118/118 | O97/97 | O96/96 | O92/92 | O124/124 | O120/120 | O101/101 | O94/94 | O106/106 | O96/96 | O81/81 | P1/1 |
| COMP_1000 | 2025-09-01 | 2026-03-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | O123/123 | O151/151 | O147/147 | O135/135 | O122/122 | O89/89 | O41/41 | X | X | X | X | X | X |
| COMP_1001 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B537/537 | O536/536 | O557/557 | O525/525 | O534/534 | O545/545 | O586/586 | O473/473 | O507/507 | O541/541 | O489/488 | O339/337 | O460/460 | O564/564 | O449/446 | O463/463 | O461/461 | O451/447 | O543/543 | O510/510 | O529/527 | O528/528 | O503/503 | O261/261 | P7/7 |
| COMP_1002 | 2025-10-17 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O49/49 | O27/27 | O26/26 | O8/8 | O21/21 | O34/34 | O13/13 | O25/25 | O22/22 | O26/26 | P2/2 |
| COMP_1003 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B172/N | O154/N | O163/N | O217/N | O138/N | O168/N | O89/N | O149/N | O118/N | O171/N | O151/N | O119/N | O109/N | O136/N | O111/N | O127/N | O110/N | O111/N | O113/N | O129/N | O97/N | O46/N | O108/N | O97/N | P3/N |
| COMP_1004 | 2024-09-02 | 2026-01-09 | 17 | 0 | 0 | B307/N | O443/N | O331/N | O328/N | O368/N | O305/N | O319/N | O363/N | O297/N | O300/N | O298/N | O262/N | O295/N | O158/N | O43/N | O32/N | B9/N | X | X | X | X | X | X | X | X |
| COMP_1005 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B61/61 | O248/248 | O283/283 | O344/344 | O388/388 | O372/372 | O373/373 | O434/434 | O396/396 | O416/416 | O405/405 | O404/404 | O410/410 | O393/393 | O406/406 | O416/416 | O453/453 | O432/432 | P21/21 |
| COMP_1006 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O164/164 | O181/181 | O172/172 | O178/178 | O166/166 | O149/149 | O174/174 | O194/194 | O192/192 | O166/166 | O177/177 | O103/103 | O182/182 | O183/183 | O186/186 | O172/172 | O187/187 | O141/141 | O157/157 | O166/166 | O162/162 | O194/194 | O192/192 | O161/161 | P7/7 |
| COMP_1007 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B50/50 | O20/20 | O37/37 | O57/57 | O22/22 | O14/14 | O16/16 | O19/19 | O21/21 | O22/22 | O39/39 | O35/35 | O18/18 | O69/69 | O18/18 | O70/69 | O31/31 | O24/22 | O33/31 | O39/37 | O33/30 | O37/35 | O45/42 | O22/22 | P6/6 |
| COMP_1008 | 2024-09-02 | 2026-09-01 | 24 | 21 | 21 | B58/10 | O61/4 | O49/10 | O60/8 | O50/4 | O71/12 | O59/8 | O67/6 | O59/N | O61/7 | O72/1 | O84/6 | O70/8 | O72/9 | O92/4 | O63/2 | O62/2 | O71/4 | O86/3 | O63/2 | O68/4 | O88/N | O91/N | O125/11 | P5/N |
| COMP_1009 | 2025-02-26 | 2026-08-05 | 14 | 14 | 14 | X | X | X | X | X | B1/1 | G | O4/4 | O2/2 | G | O4/4 | G | O1/1 | O2/2 | O1/1 | O3/3 | O6/6 | O2/2 | G | O2/2 | O1/1 | G | O2/2 | B1/1 | X |
| COMP_1010 | 2026-02-19 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B128/128 | O327/327 | O316/316 | O312/312 | O381/381 | O189/189 | O118/118 | P13/13 |
| COMP_1011 | 2024-10-17 | 2026-09-01 | 23 | 23 | 23 | X | B4/4 | O6/6 | O3/3 | O7/7 | O5/5 | O20/20 | O10/10 | O9/9 | O8/8 | O9/9 | O10/10 | O17/17 | O21/21 | O18/18 | O13/13 | O46/46 | O29/29 | O12/12 | O34/34 | O29/29 | O20/20 | O28/28 | O21/21 | P2/2 |
| COMP_1012 | 2025-11-24 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B73/73 | O117/117 | O222/222 | O124/124 | O127/127 | O212/212 | O216/216 | O172/171 | O249/247 | O226/225 | P14/14 |
| COMP_1013 | 2024-10-16 | 2026-08-31 | 23 | 23 | 23 | X | B7/7 | O11/11 | O50/50 | O7/7 | O13/13 | O28/28 | O50/50 | O143/143 | O78/78 | O36/36 | O13/13 | O8/8 | O21/21 | O6/6 | O19/19 | O11/11 | O18/18 | O27/27 | O56/56 | O68/68 | O106/106 | O64/64 | O17/17 | X |
| COMP_1014 | 2025-01-02 | 2026-09-01 | 20 | 0 | 0 | X | X | X | X | B10/N | O12/N | O68/N | O39/N | O92/N | O49/N | O36/N | O71/N | O50/N | O58/N | O53/N | O69/N | O43/N | O42/N | O52/N | O84/N | O42/N | O25/N | O42/N | O56/N | P2/N |
| COMP_1015 | 2024-10-28 | 2026-08-28 | 23 | 0 | 0 | X | B30/N | O129/N | O149/N | O134/N | O184/N | O73/N | O67/N | O66/N | O75/N | O63/N | O20/N | O14/N | O13/N | O14/N | O7/N | O10/N | O5/N | O7/N | O5/N | O5/N | O2/N | O5/N | B1/N | X |
| COMP_1016 | 2026-01-19 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B205/205 | O407/407 | O421/421 | O393/393 | O369/369 | O418/418 | O450/450 | O221/221 | P26/26 |
| COMP_1017 | 2025-04-02 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | B1/1 | G | O6/6 | O16/16 | O34/34 | O155/155 | O170/170 | O23/23 | O34/34 | O7/7 | O6/6 | O6/6 | O10/10 | O8/8 | O6/6 | O31/31 | O87/87 | P1/1 |
| COMP_1018 | 2025-10-09 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B47/25 | O79/45 | O78/37 | O40/24 | O44/21 | O71/42 | O59/31 | O57/31 | O52/22 | O98/35 | O105/59 | P2/1 |
| COMP_1019 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B36/36 | O54/54 | O61/61 | O43/43 | O45/45 | O53/53 | O59/59 | O65/65 | O117/117 | O62/62 | O59/59 | O52/52 | O72/72 | O103/103 | O150/150 | O231/231 | O227/227 | O335/335 | O491/491 | O368/368 | O340/340 | O349/349 | O229/229 | O178/178 | P13/13 |
| COMP_1020 | 2025-09-01 | 2026-08-31 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O56/56 | O54/54 | O41/41 | O79/79 | O69/69 | O32/32 | O60/60 | O66/66 | O53/52 | O74/74 | O53/53 | O21/21 | X |
| COMP_1021 | 2025-12-31 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O62/62 | O47/47 | O63/63 | O54/54 | O52/52 | O55/55 | O70/70 | O77/77 | P4/4 |
| COMP_1022 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B111/N | O100/N | O113/N | O92/N | O115/N | O107/N | O123/N | O136/N | O105/N | O138/N | O132/N | O102/N | O117/N | O130/N | O103/N | O114/N | O98/N | O129/N | O137/N | O114/N | O115/N | O116/N | O124/N | O112/N | P8/N |
| COMP_1023 | 2026-01-08 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B59/N | O81/N | O73/N | O60/N | O69/N | O73/N | O60/N | O75/N | P8/N |
| COMP_1024 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O9/9 | O80/80 | O106/106 | O117/117 | O125/125 | O215/215 | O436/436 | O548/548 | O315/315 | O50/50 | O19/19 | O20/20 | O14/14 | O79/79 | O134/134 | O138/138 | O234/234 | O343/343 | O588/588 | O609/609 | P22/22 |
| COMP_1025 | 2025-11-24 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B43/43 | O199/199 | O251/251 | O203/203 | O237/237 | O231/231 | O229/229 | O207/207 | O268/268 | O145/145 | P18/18 |
| COMP_1026 | 2026-02-25 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O13/13 | O19/19 | O10/10 | O6/6 | O16/16 | O3/3 | P2/2 |
| COMP_1027 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B1/1 | O14/14 | O23/23 | O24/24 | O24/24 | O18/18 | O27/27 | O28/28 | O23/23 | O28/28 | O17/17 | O16/16 | O20/20 | O13/13 | O15/15 | O21/21 | O16/16 | O17/17 | O26/26 | O39/39 | O21/21 | P2/2 |
| COMP_1028 | 2026-01-19 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B29/29 | O51/51 | O54/54 | O70/70 | O71/71 | O82/82 | O70/70 | O63/63 | P2/2 |
| COMP_1029 | 2024-09-02 | 2026-08-25 | 24 | 24 | 24 | B14/14 | O19/19 | O11/11 | O14/14 | O9/9 | O23/23 | O14/14 | O5/5 | O11/11 | O4/4 | O12/12 | O4/4 | O20/20 | O16/16 | O21/21 | O9/9 | O8/8 | O4/4 | O2/2 | O7/7 | O2/2 | O3/3 | O9/9 | B5/5 | X |
| COMP_1030 | 2025-04-02 | 2026-08-31 | 16 | 16 | 16 | X | X | X | X | X | X | X | B1/1 | G | O2/2 | O3/3 | O1/1 | O4/4 | O17/17 | O16/16 | O27/27 | O12/12 | O29/29 | O66/66 | O25/25 | O10/10 | O17/17 | O20/20 | O56/56 | X |
| COMP_1031 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O168/168 | O117/117 | O90/90 | O90/90 | O90/90 | O57/57 | O99/99 | O78/78 | O186/186 | O111/111 | O91/91 | O75/75 | O132/132 | O151/151 | O80/80 | O35/35 | O28/28 | O27/27 | O13/13 | O16/16 | P3/3 |
| COMP_1032 | 2025-01-01 | 2026-07-23 | 15 | 15 | 15 | X | X | X | X | O12/12 | O5/5 | O7/7 | O2/2 | G | G | O1/1 | O2/2 | O6/6 | O1/1 | O4/4 | O23/23 | O2/2 | G | O2/2 | O1/1 | O1/1 | G | B2/2 | X | X |
| COMP_1033 | 2024-09-04 | 2026-09-01 | 24 | 24 | 24 | B20/20 | O16/16 | O20/20 | O22/22 | O19/19 | O19/19 | O14/14 | O27/27 | O14/14 | O17/17 | O23/23 | O15/15 | O18/18 | O17/17 | O20/20 | O26/26 | O14/14 | O25/25 | O11/11 | O19/19 | O22/22 | O18/18 | O22/22 | O9/9 | P2/2 |
| COMP_1034 | 2026-01-30 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O90/90 | O104/104 | O121/121 | O165/165 | O188/188 | O210/210 | O218/218 | P8/8 |
| COMP_1035 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O291/177 | O301/143 | O311/155 | O299/281 | O301/301 | O295/295 | O296/296 | O322/322 | O331/331 | O441/441 | O408/403 | O388/388 | O438/438 | O433/433 | O457/457 | O410/409 | O460/460 | O505/505 | O455/455 | O343/343 | P8/8 |
| COMP_1036 | 2026-05-14 | 2026-09-01 | 4 | 4 | 4 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B561/561 | O1281/1280 | O1366/1365 | O1222/1220 | P37/37 |
| COMP_1037 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O344/344 | O341/341 | O445/445 | O469/469 | O516/516 | O543/543 | O921/921 | O1285/1285 | O1406/1406 | O709/709 | O596/596 | O1007/1007 | O1121/1121 | O991/991 | O1120/1120 | O950/950 | O882/882 | O856/856 | O934/934 | O947/947 | P47/47 |
| COMP_1038 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O85/85 | O89/89 | O103/103 | O96/96 | O62/62 | O65/65 | O76/76 | O72/72 | O81/81 | O73/73 | O71/71 | O82/82 | O114/114 | O83/83 | O120/120 | O115/115 | O86/86 | O106/106 | O105/105 | O109/104 | P17/17 |
| COMP_1039 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B1/1 | O1/1 | O13/13 | O2/2 | O7/7 | O2/2 | O2/2 | O8/8 | O28/28 | O25/25 | O29/29 | O49/49 | O66/66 | O79/79 | O91/91 | O89/83 | O106/104 | O83/82 | O92/85 | O96/91 | O75/73 | O100/95 | O84/83 | O66/65 | P11/11 |
| COMP_1040 | 2025-09-09 | 2026-08-31 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O23/23 | O22/22 | O17/17 | O13/13 | O11/11 | O13/13 | O12/12 | O17/17 | O31/31 | O24/24 | O22/22 | X |
| COMP_1041 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O7/5 | O12/6 | O13/6 | O9/7 | O16/12 | O11/9 | O9/9 | O6/5 | P4/4 |
| COMP_1042 | 2024-09-01 | 2026-06-02 | 10 | 9 | 9 | O12/12 | G | G | G | O2/2 | O12/12 | O5/5 | O56/56 | G | G | G | G | O6/6 | O26/26 | O5/5 | G | G | G | G | G | O3/3 | B3/N | X | X | X |
| COMP_1043 | 2025-12-22 | 2026-09-01 | 9 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/N | O4/N | O75/67 | O173/173 | O142/142 | O174/174 | O129/129 | O186/186 | O152/152 | P3/3 |
| COMP_1044 | 2026-02-14 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B349/349 | O1000/1000 | O891/891 | O847/847 | O910/910 | O1104/1104 | O821/821 | P37/37 |
| COMP_1045 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B217/217 | O192/191 | O221/220 | O178/178 | O171/170 | O133/133 | O107/107 | O129/128 | O86/86 | O172/172 | O195/191 | O63/63 | O169/169 | O188/188 | O97/97 | O100/100 | O88/88 | O196/196 | O141/141 | O95/95 | O142/142 | O184/184 | O143/143 | O23/23 | P1/1 |
| COMP_1046 | 2024-10-08 | 2025-12-11 | 15 | 15 | 15 | X | B67/34 | O98/72 | O137/110 | O142/117 | O114/78 | O133/108 | O117/94 | O128/98 | O122/96 | O141/111 | O93/68 | O64/59 | O61/46 | O32/25 | B34/34 | X | X | X | X | X | X | X | X | X |
| COMP_1047 | 2025-01-20 | 2026-08-31 | 20 | 20 | 20 | X | X | X | X | B13/13 | O14/14 | O15/15 | O17/17 | O17/17 | O18/18 | O20/20 | O19/19 | O15/15 | O23/23 | O14/14 | O23/23 | O24/24 | O12/12 | O13/13 | O19/19 | O37/37 | O36/36 | O26/26 | O13/13 | X |
| COMP_1048 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O341/341 | O453/453 | O585/585 | O600/600 | O719/719 | O819/819 | O901/901 | O665/665 | O576/576 | O581/581 | O551/551 | O767/767 | O295/295 | O304/304 | O487/487 | O475/472 | O474/471 | O566/553 | O607/602 | O581/579 | P30/30 |
| COMP_1049 | 2026-01-08 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B450/46 | O530/80 | O583/90 | O565/63 | O526/34 | O494/41 | O536/54 | O386/31 | P21/1 |
| COMP_1050 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B10/10 | O63/63 | O60/60 | O69/69 | O54/54 | O63/63 | O46/46 | P7/7 |
| COMP_1051 | 2024-12-31 | 2026-07-31 | 18 | 18 | 18 | X | X | X | B1/1 | O3/3 | O3/3 | O4/4 | O3/3 | O5/5 | O2/2 | O1/1 | O2/2 | O3/3 | O4/4 | O2/2 | O2/2 | O3/3 | G | O1/1 | O1/1 | G | O1/1 | O2/2 | X | X |
| COMP_1052 | 2025-01-07 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B30/30 | O33/33 | O31/31 | O36/36 | O22/22 | O38/38 | O35/35 | O22/22 | O24/24 | O38/38 | O25/25 | O36/36 | O29/29 | O27/27 | O18/18 | O21/21 | O21/21 | O40/40 | O98/98 | O74/74 | P9/9 |
| COMP_1053 | 2026-05-07 | 2026-09-01 | 4 | 4 | 4 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2932/2649 | O4390/4053 | O3663/3239 | O3279/2991 | P175/158 |
| COMP_1054 | 2024-09-05 | 2026-08-03 | 21 | 21 | 21 | B5/5 | O3/3 | O4/4 | O3/3 | O4/4 | O1/1 | O1/1 | O8/8 | O4/4 | G | O4/4 | G | G | O3/3 | O1/1 | O7/7 | O11/11 | O3/3 | O2/2 | O4/4 | O2/2 | O4/4 | O1/1 | B2/2 | X |
| COMP_1055 | 2025-08-28 | 2026-08-31 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O1/1 | O1/1 | O10/10 | O19/19 | O14/14 | O18/18 | O12/12 | O13/13 | O21/21 | O17/17 | O20/20 | O17/17 | X |
| COMP_1056 | 2026-02-10 | 2026-08-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B93/4 | O191/12 | O224/15 | O166/10 | O176/8 | O173/11 | O187/3 | X |
| COMP_1057 | 2025-07-14 | 2026-08-31 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B30/30 | O49/34 | O96/65 | O115/99 | O129/124 | O28/23 | O24/18 | O77/63 | O152/145 | O20/20 | O11/11 | O105/102 | O157/153 | O39/39 | X |
| COMP_1058 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O25/25 | O18/18 | O19/19 | O22/22 | O18/18 | O26/26 | O32/32 | O29/29 | O28/28 | O23/23 | O24/24 | O23/23 | O23/23 | O15/15 | O17/17 | O21/21 | O23/23 | O20/20 | O41/41 | O16/16 | P1/1 |
| COMP_1059 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B21/21 | O117/117 | O170/170 | O122/122 | O177/177 | O173/173 | O158/158 | O156/156 | O177/177 | O157/157 | O166/166 | O157/156 | O154/154 | O155/155 | O151/149 | O140/139 | P16/15 |
| COMP_1060 | 2026-02-17 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B44/44 | O99/99 | O93/93 | O105/105 | O90/90 | O106/106 | O109/109 | P8/8 |
| COMP_1061 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B16/16 | O9/9 | O12/12 | O7/7 | O9/9 | O11/11 | O8/8 | O14/14 | O11/11 | O11/11 | O10/10 | O10/10 | O12/12 | O12/12 | O10/10 | O10/10 | O9/9 | O13/13 | O15/15 | O32/32 | O79/79 | O128/128 | O140/140 | O224/224 | P10/10 |
| COMP_1062 | 2026-01-23 | 2026-08-25 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O4/4 | O19/19 | O34/34 | O75/75 | O61/61 | O15/15 | B12/12 | X |
| COMP_1063 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B73/73 | O87/87 | O98/98 | O112/112 | O106/106 | O145/145 | O107/107 | O84/84 | O99/99 | O163/163 | O124/124 | O157/157 | O111/111 | O147/147 | O162/162 | O128/128 | O134/134 | O120/120 | O123/123 | O102/102 | P4/4 |
| COMP_1064 | 2025-03-18 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B8/8 | O34/34 | O26/26 | O27/27 | O24/24 | O20/20 | O21/21 | O37/37 | O30/30 | O40/40 | O40/40 | O28/28 | O35/35 | O38/38 | O34/34 | O42/42 | O46/46 | O25/25 | P2/2 |
| COMP_1065 | 2025-03-10 | 2026-05-22 | 5 | 5 | 5 | X | X | X | X | X | X | B2/2 | G | G | O1/1 | G | G | G | G | G | G | G | G | O51/51 | O13/13 | B26/26 | X | X | X | X |
| COMP_1066 | 2025-07-25 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B267/267 | O1118/1118 | O1225/1224 | O1332/1332 | O1369/1369 | O1637/1637 | O1345/1345 | O1133/1133 | O1079/1079 | O1148/1148 | O859/859 | O897/897 | O947/947 | O733/733 | P32/32 |
| COMP_1067 | 2025-06-10 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B895/3 | O631/3 | O489/3 | O472/1 | O742/1 | O582/3 | O619/3 | O582/1 | O688/1 | O548/2 | O673/3 | O478/2 | O417/1 | O746/11 | O552/1 | P45/N |
| COMP_1068 | 2026-02-03 | 2026-02-19 | 1 | 1 | 1 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | X | X | X | X | X | X | X |
| COMP_1069 | 2024-09-01 | 2026-09-01 | 23 | 23 | 23 | O5/5 | O5/5 | O1/1 | O2/2 | O6/6 | G | O3/3 | O3/3 | O6/6 | O1/1 | O9/9 | O5/5 | O6/6 | O4/4 | O5/5 | O16/16 | O19/19 | O28/28 | O33/33 | O49/49 | O52/52 | O62/62 | O68/68 | O58/58 | P3/3 |
| COMP_1070 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B21/21 | O104/74 | O106/77 | O114/87 | O138/81 | O93/64 | O96/70 | O167/75 | O106/75 | O133/92 | O146/85 | O124/68 | O103/65 | O134/79 | O117/75 | O52/50 | O146/82 | O90/62 | P5/3 |
| COMP_1071 | 2025-12-29 | 2026-09-01 | 9 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/2 | O3/N | O4/N | O13/N | O25/6 | O23/17 | O37/14 | O21/6 | O22/7 | P1/N |
| COMP_1072 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O310/310 | O258/258 | O315/315 | O319/319 | O377/377 | O426/426 | O794/794 | O557/557 | O605/605 | O635/635 | O654/654 | O1148/1148 | O1161/1161 | O1018/1018 | O1200/1200 | O1177/1177 | O1127/1127 | O1139/1139 | O1172/1172 | O960/960 | P39/39 |
| COMP_1073 | 2024-09-27 | 2026-08-03 | 16 | 16 | 16 | B2/2 | O4/4 | G | O2/2 | O1/1 | G | G | O1/1 | O2/2 | G | O1/1 | O1/1 | O1/1 | O3/3 | G | O2/2 | O2/2 | G | O1/1 | G | G | O3/3 | O1/1 | B1/1 | X |
| COMP_1074 | 2025-04-08 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | B2/2 | O24/24 | O15/15 | O26/26 | O17/17 | O22/22 | O34/34 | O39/39 | O42/42 | O53/53 | O58/58 | O65/65 | O60/60 | O77/77 | O70/70 | O86/86 | O74/74 | P2/2 |
| COMP_1075 | 2025-10-10 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O15/15 | O90/90 | O91/91 | O68/68 | O78/78 | O191/191 | O200/200 | O159/159 | O130/130 | O21/20 | P10/10 |
| COMP_1076 | 2025-05-30 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B6/6 | O57/57 | O60/60 | O54/54 | O78/78 | O73/73 | O79/79 | O73/73 | O66/66 | O102/102 | O73/73 | O84/84 | O89/89 | O83/83 | O73/73 | O46/46 | P9/9 |
| COMP_1077 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O892/892 | O1290/1290 | O1213/1213 | O1218/1218 | O785/785 | O504/504 | O522/522 | O770/770 | O1231/1231 | O902/902 | O519/519 | O530/530 | O738/738 | O540/540 | O606/606 | O600/600 | O646/646 | O533/533 | O490/490 | O382/382 | P19/19 |
| COMP_1078 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B27/27 | O42/42 | O26/26 | O33/33 | O21/21 | O26/26 | O22/22 | O31/31 | O18/18 | O23/23 | O29/29 | O19/19 | O28/28 | O32/32 | O26/26 | O27/27 | O21/21 | O30/30 | O25/25 | O15/15 | O28/28 | O17/17 | O31/31 | O22/22 | P6/6 |
| COMP_1079 | 2024-09-01 | 2026-09-01 | 24 | 24 | 23 | O35/N | O53/5 | O43/4 | O45/4 | O44/6 | O42/3 | O43/3 | O48/6 | O52/4 | O41/1 | O67/14 | O34/7 | O35/8 | O45/10 | O44/9 | O54/6 | O41/9 | O37/1 | O45/3 | O56/12 | O43/6 | O34/7 | O56/8 | O15/2 | P1/N |
| COMP_1080 | 2026-01-03 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B20/20 | O25/25 | O27/27 | O42/42 | O36/36 | O24/24 | O27/27 | O23/23 | P4/4 |
| COMP_1081 | 2024-10-07 | 2026-09-01 | 23 | 23 | 23 | X | B121/121 | O104/104 | O85/85 | O72/72 | O77/77 | O71/71 | O86/86 | O244/244 | O375/375 | O415/415 | O187/187 | O262/262 | O149/149 | O85/85 | O87/87 | O83/83 | O89/89 | O73/73 | O88/88 | O238/238 | O364/364 | O447/447 | O363/363 | P12/12 |
| COMP_1082 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B34/34 | O35/35 | O24/24 | O28/28 | O22/22 | O19/19 | O19/19 | O21/21 | O14/14 | O19/19 | O21/21 | O9/9 | O12/12 | O22/22 | O12/12 | O20/20 | O17/17 | O10/10 | O15/15 | O19/19 | O12/12 | O17/17 | O28/28 | O13/13 | X |
| COMP_1083 | 2025-10-31 | 2026-09-01 | 11 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/N | O15/3 | O9/N | O9/N | O9/N | O13/N | O14/1 | O17/2 | O13/1 | O14/2 | O11/1 | P2/1 |
| COMP_1084 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B12/12 | O44/44 | O49/49 | O43/43 | O46/46 | O42/42 | O47/47 | O58/58 | O45/45 | O45/45 | O43/43 | O49/49 | O48/48 | O49/49 | O43/43 | O47/47 | O50/50 | O45/45 | P2/2 |
| COMP_1085 | 2025-03-03 | 2026-09-01 | 18 | 0 | 0 | X | X | X | X | X | X | B9/N | O7/N | O8/N | O12/N | O47/N | O52/N | O55/N | O54/N | O23/N | O6/N | O12/N | O10/N | O6/N | O6/N | O6/N | O15/N | O13/N | O7/N | P3/N |
| COMP_1086 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O515/515 | O625/625 | O856/856 | O874/874 | O829/825 | O589/589 | O707/704 | O697/697 | O538/536 | O885/885 | O857/854 | O1037/1037 | O639/639 | O530/528 | O1137/1131 | O966/962 | O1133/1124 | O767/763 | O559/556 | O739/736 | O780/780 | O823/823 | O715/715 | O910/910 | P31/31 |
| COMP_1087 | 2025-10-16 | 2026-08-18 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B65/65 | O102/102 | O95/95 | O124/124 | O134/134 | O179/179 | O179/179 | O141/141 | O119/119 | O105/105 | B64/64 | X |
| COMP_1088 | 2025-11-10 | 2026-08-03 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O16/16 | O12/12 | O4/4 | O5/5 | O12/12 | O5/5 | O2/2 | O15/15 | B1/1 | X |
| COMP_1089 | 2025-01-03 | 2026-08-31 | 20 | 0 | 0 | X | X | X | X | B19/N | O11/N | O10/N | O8/N | O7/N | O6/N | O48/N | O35/N | O33/N | O21/N | O17/N | O38/N | O17/N | O15/N | O17/N | O38/N | O25/N | O9/N | O29/N | O12/N | X |
| COMP_1090 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O793/776 | O865/855 | O718/718 | O803/803 | O605/605 | O519/519 | O647/647 | O807/774 | O856/821 | O701/701 | O774/774 | O563/563 | O926/926 | O812/812 | O754/736 | O709/709 | O594/594 | O622/622 | O730/730 | O693/644 | O692/692 | O537/537 | O946/946 | O661/661 | P25/25 |
| COMP_1091 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B437/437 | O726/726 | O794/794 | O753/736 | O724/723 | O710/688 | O969/945 | O839/804 | O695/670 | O921/895 | O870/853 | O795/783 | O838/817 | O701/686 | O1806/1782 | O721/708 | O1002/984 | O1130/1117 | O771/752 | O902/868 | P22/21 |
| COMP_1092 | 2026-01-04 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B39/39 | O31/31 | O26/26 | O35/35 | O43/43 | O37/37 | O31/31 | O22/22 | P1/1 |
| COMP_1093 | 2025-01-08 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B31/31 | O70/70 | O59/59 | O55/55 | O43/43 | O30/30 | O56/56 | O31/31 | O35/35 | O43/43 | O48/48 | O54/54 | O42/42 | O40/40 | O70/70 | O52/52 | O67/67 | O49/49 | O52/52 | O52/52 | P10/10 |
| COMP_1094 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B20/20 | O18/18 | O19/19 | O12/12 | O19/19 | O13/13 | O14/14 | O20/20 | O12/12 | O12/12 | O20/20 | O15/15 | O16/16 | O14/14 | O10/10 | O25/25 | O13/13 | O18/18 | O14/14 | O14/14 | O15/15 | O14/14 | O17/17 | O16/16 | X |
| COMP_1095 | 2025-03-24 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B1/1 | O23/23 | O53/53 | O76/76 | O132/132 | O111/111 | O222/222 | O369/369 | O279/279 | O302/302 | O272/272 | O371/371 | O381/381 | O585/585 | O398/398 | O561/561 | O426/426 | O375/375 | P21/21 |
| COMP_1096 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B135/135 | O170/170 | O135/135 | O164/164 | O163/163 | O231/231 | O203/203 | O177/177 | O153/153 | O238/238 | O283/283 | O219/219 | O199/199 | O235/235 | O189/189 | O219/219 | O243/243 | O269/269 | O319/319 | O307/307 | O301/301 | O295/295 | O373/373 | O292/292 | P11/11 |
| COMP_1097 | 2026-01-12 | 2026-08-31 | 8 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/2 | O13/4 | O8/2 | O11/N | O12/N | O24/2 | O14/N | O11/2 | X |
| COMP_1098 | 2025-01-20 | 2026-06-30 | 18 | 18 | 18 | X | X | X | X | B18/18 | O26/26 | O15/15 | O20/20 | O24/24 | O14/14 | O28/28 | O28/28 | O29/29 | O34/34 | O24/24 | O14/14 | O32/32 | O37/37 | O19/19 | O26/26 | O20/20 | O19/16 | X | X | X |
| COMP_1099 | 2024-09-02 | 2025-04-14 | 8 | 8 | 8 | B199/199 | O219/219 | O176/176 | O151/151 | O169/169 | O171/171 | O123/123 | B87/87 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_1100 | 2025-06-23 | 2026-08-21 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B7/7 | O6/6 | O3/3 | O12/12 | O6/6 | O19/19 | O25/25 | O13/13 | O6/6 | O17/17 | O9/9 | O1/1 | O4/4 | O7/7 | B3/3 | X |
| COMP_1101 | 2026-01-15 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O6/6 | O8/8 | O12/12 | O10/10 | O15/15 | O11/11 | O9/9 | P1/1 |
| COMP_1102 | 2025-08-11 | 2026-09-01 | 13 | 13 | 13 | X | X | X | X | X | X | X | X | X | X | X | B53/53 | O83/83 | O81/81 | O62/62 | O77/77 | O98/98 | O63/63 | O53/53 | O102/102 | O50/50 | O44/44 | O87/87 | O51/51 | P1/1 |
| COMP_1103 | 2026-01-02 | 2026-08-27 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B18/3 | O19/1 | O52/4 | O21/2 | O30/15 | O19/4 | O20/4 | B25/7 | X |
| COMP_1104 | 2026-02-09 | 2026-08-25 | 7 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B50/N | O75/N | O76/N | O71/N | O80/N | O84/N | B55/N | X |
| COMP_1105 | 2024-12-08 | 2026-09-01 | 21 | 0 | 0 | X | X | X | B106/N | O171/N | O130/N | O133/N | O143/N | O162/N | O148/N | O169/N | O135/N | O137/N | O101/N | O108/N | O146/N | O120/N | O99/N | O108/N | O109/N | O115/N | O85/N | O132/N | O115/N | P7/N |
| COMP_1106 | 2025-03-27 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B4/4 | O8/8 | O12/12 | O14/14 | O15/15 | O16/15 | O8/8 | O25/25 | O27/27 | O15/15 | O47/47 | O31/31 | O48/48 | O39/39 | O43/43 | O45/45 | O97/96 | O35/34 | P1/1 |
| COMP_1107 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B73/73 | O127/127 | O143/143 | O222/222 | O162/162 | O145/130 | O157/157 | O129/129 | O209/209 | O152/152 | O127/127 | O191/191 | O129/129 | O110/110 | O169/169 | O143/143 | O165/165 | O195/195 | O190/190 | O201/201 | P13/13 |
| COMP_1108 | 2026-01-09 | 2026-09-01 | 8 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B53/5 | O57/4 | O93/10 | O53/3 | O26/1 | O42/2 | O36/1 | O20/N | P2/N |
| COMP_1109 | 2024-09-02 | 2026-09-01 | 20 | 20 | 20 | B158/158 | O172/172 | O180/180 | O175/175 | O148/148 | O174/174 | O152/152 | O166/166 | O188/188 | O182/182 | O178/178 | O126/126 | O183/183 | O192/192 | O141/141 | G | G | G | O2/2 | O14/14 | O17/17 | O30/30 | O7/7 | G | P3/3 |
| COMP_1110 | 2025-10-17 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B41/41 | O78/78 | O179/179 | O513/513 | O454/454 | O445/445 | O273/273 | O200/200 | O322/322 | O384/384 | O29/29 | P2/2 |
| COMP_1111 | 2025-11-24 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O8/8 | O45/45 | O44/44 | O42/42 | O46/46 | O44/44 | O41/41 | O44/44 | O44/44 | P1/1 |
| COMP_1112 | 2025-06-02 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B20/20 | O15/15 | O14/14 | O22/22 | O18/18 | O14/14 | O18/18 | O17/17 | O15/15 | O20/20 | O15/15 | O17/17 | O22/22 | O14/14 | O12/12 | P1/1 |
| COMP_1113 | 2025-07-24 | 2026-08-19 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B2/2 | O4/4 | O6/6 | O6/6 | O7/7 | O4/4 | O13/13 | O9/9 | O10/10 | O25/25 | O15/15 | O10/10 | O14/14 | B11/11 | X |
| COMP_1114 | 2026-01-03 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | O9/9 | O11/11 | O7/7 | O4/4 | O5/5 | O13/13 | O4/4 | P2/2 |
| COMP_1115 | 2025-01-02 | 2026-08-31 | 20 | 0 | 0 | X | X | X | X | B49/N | O60/N | O57/N | O50/N | O56/N | O62/N | O67/N | O48/N | O54/N | O47/N | O69/N | O65/N | O44/N | O63/N | O79/N | O60/N | O12/N | O45/N | O47/N | O39/N | X |
| COMP_1116 | 2025-11-26 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O7/7 | O24/24 | O33/33 | O28/28 | O28/28 | O26/26 | O25/25 | O29/29 | O31/31 | P2/2 |
| COMP_1117 | 2025-09-01 | 2026-07-31 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | O15/15 | O12/12 | O4/4 | O6/6 | O5/5 | O1/1 | O3/3 | O3/3 | O2/2 | O4/4 | O2/2 | X | X |
| COMP_1118 | 2026-02-12 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/7 | O14/14 | O13/13 | O21/21 | O22/22 | O47/47 | O17/17 | P3/3 |
| COMP_1119 | 2024-09-05 | 2026-09-01 | 23 | 23 | 23 | B11/11 | O13/13 | O15/15 | O10/10 | O11/11 | O5/5 | G | O3/3 | O11/11 | O18/18 | O13/13 | O6/6 | O10/10 | O15/15 | O28/28 | O17/17 | O11/11 | O15/15 | O21/21 | O15/15 | O18/18 | O11/11 | O23/23 | O13/13 | P4/4 |
| COMP_1120 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B3/3 | O7/7 | O6/6 | O2/2 | O3/3 | O4/4 | O2/2 | O4/4 | O5/5 | O3/3 | O3/3 | O4/4 | O3/3 | O2/2 | O5/5 | O5/5 | O4/4 | O5/5 | O3/3 | O2/2 | O4/4 | O5/5 | O5/5 | O6/6 | P1/1 |
| COMP_1121 | 2025-10-20 | 2026-03-17 | 6 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | B177/177 | O344/344 | O372/372 | O274/274 | O280/280 | B184/184 | X | X | X | X | X | X |
| COMP_1122 | 2024-09-06 | 2026-08-28 | 24 | 0 | 0 | B12/N | O17/N | O15/N | O20/N | O17/N | O27/N | O15/N | O19/N | O18/N | O22/N | O23/N | O22/N | O24/N | O19/N | O25/N | O27/N | O22/N | O38/N | O25/N | O30/N | O41/N | O24/N | O28/N | B36/N | X |
| COMP_1123 | 2024-09-02 | 2026-09-01 | 24 | 0 | 0 | B82/N | O101/N | O89/N | O93/N | O99/N | O94/N | O91/N | O55/N | O74/N | O74/N | O115/N | O59/N | O81/N | O100/N | O88/N | O106/N | O64/N | O87/N | O86/N | O88/N | O74/N | O76/N | O86/N | O85/N | P19/N |
| COMP_1124 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O225/225 | O212/212 | O243/243 | O251/250 | O236/236 | O264/264 | O262/262 | O219/219 | O271/271 | O298/298 | O248/243 | O224/224 | O256/256 | O218/218 | O247/247 | O227/227 | O220/220 | O221/221 | O173/173 | O165/165 | P3/3 |
| COMP_1125 | 2025-02-17 | 2026-08-31 | 18 | 18 | 18 | X | X | X | X | X | B9/9 | O19/19 | O11/11 | O13/13 | O25/25 | O23/23 | O7/7 | O55/55 | O29/29 | O11/11 | O9/8 | O3/3 | G | O12/12 | O24/24 | O9/9 | O18/18 | O29/29 | O10/10 | X |
| COMP_1126 | 2025-12-18 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B166/166 | O298/298 | O290/290 | O365/365 | O359/359 | O367/367 | O357/357 | O369/369 | O371/371 | P15/15 |
| COMP_1127 | 2024-10-11 | 2026-09-01 | 23 | 23 | 23 | X | B111/111 | O171/171 | O87/87 | O39/39 | O22/22 | O18/18 | O27/27 | O20/20 | O26/26 | O19/19 | O17/17 | O21/21 | O44/44 | O125/125 | O235/235 | O107/107 | O254/254 | O58/58 | O41/41 | O20/20 | O19/19 | O25/25 | O23/23 | P1/1 |
| COMP_1128 | 2024-09-24 | 2026-09-01 | 23 | 23 | 23 | B3/3 | O1/1 | O2/2 | O3/3 | O3/3 | O2/2 | O6/6 | O5/5 | G | O10/10 | O8/8 | O4/4 | O9/9 | O10/10 | O2/2 | O7/7 | O14/14 | O11/11 | O4/4 | O9/9 | O5/5 | O76/76 | O30/30 | O26/26 | P5/5 |
| COMP_1129 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B921/921 | O1077/1077 | O8951/1139 | O824/824 | O684/684 | O655/646 | O618/618 | O773/773 | O557/557 | P41/41 |
| COMP_1130 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B81/81 | O129/129 | O65/65 | O135/135 | O104/104 | O67/67 | O91/91 | O85/85 | O77/71 | O108/106 | O102/102 | O56/56 | O83/83 | O109/109 | O73/73 | O117/117 | O78/76 | O53/53 | O65/65 | O87/87 | O68/68 | O68/68 | O97/97 | O64/64 | P2/2 |
| COMP_1131 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B158/158 | O313/313 | O219/219 | O303/303 | O327/327 | O221/221 | O216/216 | O209/209 | O171/171 | P3/3 |
| COMP_1132 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B144/144 | O117/117 | O104/96 | O104/94 | O96/87 | O95/82 | O97/91 | O84/75 | P4/4 |
| COMP_1133 | 2024-09-06 | 2026-09-01 | 24 | 24 | 24 | B147/147 | O230/230 | O262/261 | O330/330 | O286/285 | O308/308 | O272/272 | O256/255 | O197/197 | O296/296 | O256/255 | O210/210 | O238/238 | O285/285 | O180/180 | O215/215 | O176/176 | O239/239 | O230/230 | O265/265 | O215/215 | O238/238 | O201/201 | O226/226 | P12/12 |
| COMP_1134 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B62/62 | O86/86 | O66/66 | O67/67 | O86/86 | O45/45 | O52/52 | O60/60 | O51/51 | O64/64 | O65/65 | O41/41 | O61/61 | O81/81 | O71/71 | O65/65 | O63/63 | O50/50 | O79/79 | O54/54 | O60/60 | O80/80 | O72/72 | O49/49 | P5/5 |
| COMP_1135 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O154/154 | O161/161 | O200/200 | O207/207 | O271/271 | O256/256 | O414/414 | O284/284 | O335/335 | O335/335 | O471/471 | O821/821 | O972/972 | O862/862 | O1054/1054 | O909/909 | O842/842 | O830/830 | O799/799 | O792/792 | P38/38 |
| COMP_1136 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B49/49 | O58/58 | O55/55 | O68/68 | O61/61 | O82/82 | O86/86 | O57/57 | O58/58 | O91/91 | O67/67 | O93/93 | O70/70 | O105/105 | O69/69 | O99/99 | O59/59 | O88/88 | O73/73 | O101/101 | P7/7 |
| COMP_1137 | 2024-09-01 | 2026-08-31 | 24 | 24 | 24 | O6/6 | O10/10 | O5/5 | O5/5 | O8/8 | O7/7 | O7/7 | O5/5 | O5/5 | O5/5 | O8/8 | O5/5 | O9/9 | O5/5 | O4/4 | O4/4 | O13/13 | O6/6 | O10/10 | O8/8 | O5/5 | O6/6 | O5/5 | O4/4 | X |
| COMP_1138 | 2024-09-12 | 2026-08-31 | 24 | 24 | 24 | B4/4 | O11/11 | O17/17 | O47/47 | O42/42 | O117/117 | O68/68 | O78/78 | O57/57 | O102/102 | O92/92 | O87/87 | O78/78 | O107/107 | O77/77 | O60/60 | O79/79 | O85/85 | O103/103 | O100/100 | O104/104 | O105/105 | O89/89 | O60/60 | X |
| COMP_1139 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O143/143 | O183/183 | O140/140 | O184/184 | O177/177 | O163/163 | O169/169 | O148/148 | O179/179 | O164/164 | O173/173 | O145/145 | O172/172 | O178/178 | O178/178 | O165/165 | O176/176 | O173/173 | O191/191 | O187/187 | O174/174 | O194/194 | O194/194 | O203/203 | P10/10 |
| COMP_1140 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O112/112 | O114/114 | O97/97 | O86/86 | O129/129 | O129/129 | P4/4 |
| COMP_1141 | 2025-10-13 | 2026-09-01 | 11 | 6 | 6 | X | X | X | X | X | X | X | X | X | X | X | X | X | B22/N | O64/N | O74/N | O614/1 | O615/2 | O647/2 | O660/1 | O433/N | O559/1 | O643/2 | O889/N | P1/N |
| COMP_1142 | 2024-09-01 | 2026-09-01 | 21 | 21 | 21 | O2/2 | O1/1 | O3/3 | O5/5 | O2/2 | O11/11 | O3/3 | O2/2 | O5/5 | G | O1/1 | O2/2 | O2/2 | O2/2 | O3/3 | G | G | O4/4 | O2/2 | O11/11 | O12/12 | O76/76 | O141/139 | O148/148 | P1/1 |
| COMP_1143 | 2024-10-16 | 2025-12-12 | 15 | 15 | 15 | X | B77/77 | O130/130 | O145/145 | O179/179 | O150/150 | O188/188 | O176/175 | O185/184 | O172/172 | O204/204 | O142/141 | O135/135 | O83/83 | O55/52 | B18/18 | X | X | X | X | X | X | X | X | X |
| COMP_1144 | 2025-01-08 | 2026-08-18 | 17 | 17 | 17 | X | X | X | X | B4/4 | G | G | O1/1 | O8/8 | O3/3 | O1/1 | O8/8 | O3/3 | G | O1/1 | O1/1 | O2/2 | O2/2 | O2/2 | O3/3 | O9/9 | O1/1 | O1/1 | B10/10 | X |
| COMP_1145 | 2025-01-02 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B32/32 | O29/29 | O27/27 | O23/23 | O23/23 | O42/42 | O23/23 | O18/18 | O19/19 | O26/26 | O32/32 | O33/33 | O23/23 | O22/22 | O27/27 | O25/25 | O30/30 | O33/33 | O39/39 | O19/19 | P1/1 |
| COMP_1146 | 2025-12-03 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B112/112 | O117/117 | O126/126 | O116/116 | O122/122 | O141/141 | O183/183 | O159/159 | O126/126 | P9/9 |
| COMP_1147 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O31/31 | O44/44 | O26/26 | O33/33 | O27/27 | O48/48 | O49/49 | O8/8 | O30/30 | O39/39 | O19/19 | O44/44 | O24/24 | O38/38 | O55/55 | O42/42 | O35/35 | O40/40 | O50/50 | O12/12 | P9/9 |
| COMP_1148 | 2025-10-15 | 2026-04-20 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O5/5 | O12/12 | O13/13 | O11/11 | O6/6 | B4/4 | X | X | X | X | X |
| COMP_1149 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B59/59 | O96/96 | O76/76 | O75/75 | O98/98 | O83/83 | O68/68 | O90/90 | O72/72 | O80/80 | O158/158 | O101/101 | O144/144 | O201/201 | O158/158 | O157/157 | O167/167 | O135/135 | O227/227 | O181/181 | O154/154 | O162/162 | O181/181 | O101/101 | P10/10 |
| COMP_1150 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B36/36 | O59/59 | O43/43 | O50/50 | O35/35 | O50/50 | O45/45 | O48/48 | O41/41 | O47/47 | O62/62 | O43/43 | O45/45 | O46/46 | O50/50 | O56/56 | O40/40 | O46/46 | O42/42 | O43/43 | O39/39 | O61/61 | O69/69 | O33/33 | P6/6 |
| COMP_1151 | 2025-10-13 | 2026-08-28 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/5 | O9/9 | O10/10 | O12/12 | O17/17 | O13/13 | O10/10 | O11/11 | O10/10 | O12/12 | B17/17 | X |
| COMP_1152 | 2025-01-02 | 2026-03-02 | 15 | 14 | 14 | X | X | X | X | B970/970 | O861/861 | O882/882 | O909/909 | O1000/1000 | O1028/1015 | O1145/1145 | O973/973 | O1106/1091 | O1083/1083 | O887/887 | O1037/1037 | O1141/1141 | O1128/1128 | B70/N | X | X | X | X | X | X |
| COMP_1153 | 2024-09-30 | 2026-08-31 | 15 | 15 | 15 | B3/3 | O3/3 | O15/15 | O13/13 | O7/7 | O22/22 | O9/9 | O13/13 | O6/6 | O12/12 | O14/14 | O12/12 | O13/13 | O11/11 | G | G | G | G | G | G | G | G | G | O5/5 | X |
| COMP_1154 | 2025-05-31 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | B1/1 | O7/7 | O7/7 | O2/2 | O1/1 | O4/4 | O1/1 | O6/6 | O1/1 | G | O3/3 | O8/8 | O10/10 | O14/14 | O6/6 | O4/4 | P2/2 |
| COMP_1155 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B1/1 | O1/1 | O1/1 | O1/1 | O2/2 | O2/2 | O1/1 | O9/9 | O1/1 | O2/2 | O3/3 | O1/1 | O1/1 | O7/7 | O2/2 | O5/5 | O23/23 | O94/46 | O140/35 | O67/17 | O39/13 | O28/12 | O26/11 | O14/6 | P6/4 |
| COMP_1156 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B13/13 | O14/14 | O17/17 | O36/36 | O23/23 | O15/15 | O14/14 | O17/17 | O17/17 | O14/14 | O12/12 | O10/10 | O14/14 | O34/34 | O13/13 | O17/17 | O13/13 | O17/17 | O14/14 | O15/15 | O16/16 | O16/16 | O30/30 | O8/8 | X |
| COMP_1157 | 2025-10-01 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | O110/110 | O67/67 | O186/186 | O194/194 | O223/223 | O251/251 | O81/81 | O49/49 | O85/85 | O238/238 | O70/70 | P8/8 |
| COMP_1158 | 2025-01-09 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B12/12 | O14/13 | O11/11 | O10/10 | O13/13 | O9/9 | O8/8 | O7/7 | O7/7 | O8/8 | O7/7 | O11/11 | O9/9 | O16/16 | O20/20 | O15/15 | O19/19 | O20/20 | O21/21 | O20/20 | P1/1 |
| COMP_1159 | 2025-07-10 | 2026-02-06 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | B1720/1707 | O1053/1040 | O949/949 | O438/438 | G | O258/257 | O876/876 | B173/173 | X | X | X | X | X | X | X |
| COMP_1160 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O223/223 | O283/283 | O241/241 | O219/219 | O237/237 | O219/219 | O229/229 | O212/212 | O318/318 | O216/216 | O217/217 | O188/188 | O228/228 | O288/288 | O231/231 | O249/249 | O211/211 | O311/311 | O658/658 | O619/619 | O684/684 | O742/742 | O456/456 | O567/567 | P30/30 |
| COMP_1161 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O54/38 | O323/316 | O347/344 | O334/323 | O389/382 | O350/341 | P3/3 |
| COMP_1162 | 2024-09-02 | 2026-07-20 | 23 | 20 | 20 | B31/10 | O24/12 | O19/8 | O18/8 | O31/13 | O20/6 | O21/8 | O22/10 | O27/14 | O25/10 | O24/12 | O17/7 | O21/5 | O17/7 | O16/4 | O14/5 | O14/5 | O15/4 | O3/N | O2/N | O3/2 | O2/N | B5/1 | X | X |
| COMP_1163 | 2024-10-10 | 2026-09-01 | 23 | 23 | 23 | X | B1/1 | O1/1 | O27/13 | O53/27 | O41/26 | O49/22 | O55/35 | O46/30 | O49/31 | O50/29 | O55/32 | O46/25 | O40/27 | O51/10 | O44/2 | O45/3 | O34/2 | O37/2 | O37/1 | O33/1 | O45/3 | O42/4 | O33/4 | P3/1 |
| COMP_1164 | 2024-12-31 | 2026-08-31 | 21 | 21 | 21 | X | X | X | B1/1 | O8/8 | O5/5 | O5/5 | O4/4 | O11/11 | O7/7 | O18/18 | O13/13 | O6/6 | O16/16 | O14/14 | O16/16 | O21/21 | O21/21 | O13/13 | O16/16 | O19/19 | O16/15 | O27/25 | O22/19 | X |
| COMP_1165 | 2024-10-07 | 2026-09-01 | 23 | 23 | 23 | X | B15/15 | O15/15 | O15/15 | O9/9 | O29/29 | O45/45 | O230/230 | O322/322 | O81/81 | O35/35 | O25/25 | O21/21 | O20/20 | O17/17 | O20/20 | O23/23 | O21/21 | O45/45 | O174/174 | O242/242 | O74/74 | O38/38 | O26/26 | P1/1 |
| COMP_1166 | 2024-12-23 | 2026-09-01 | 21 | 0 | 0 | X | X | X | B20/N | O99/N | O138/N | O343/N | O245/N | O241/N | O281/N | O250/N | O240/N | O239/N | O209/N | O181/N | O199/N | O101/N | O84/N | O48/N | O77/N | O26/N | O234/N | O145/N | O42/N | P2/N |
| COMP_1167 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B138/136 | O164/162 | O167/166 | O189/187 | O211/211 | O181/181 | O209/209 | O201/201 | O201/201 | O235/206 | O195/195 | O193/193 | O207/207 | O221/221 | O187/187 | O208/208 | O218/218 | O204/204 | O207/207 | O199/199 | O210/191 | O180/180 | O175/175 | O177/177 | P1/1 |
| COMP_1168 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B68/68 | O100/100 | O69/69 | O84/84 | O78/78 | O78/78 | O61/61 | O75/75 | O77/77 | O79/79 | O82/82 | O69/69 | O73/73 | O80/80 | O73/73 | O72/72 | O59/59 | O74/74 | O70/70 | O66/66 | O69/69 | O78/78 | O76/76 | O70/70 | P8/8 |
| COMP_1169 | 2024-12-31 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B2/2 | O220/220 | O170/170 | O224/224 | O172/172 | O183/183 | O173/173 | O193/193 | O182/182 | O207/207 | O222/204 | O176/145 | O204/165 | O219/166 | O202/158 | O212/180 | O175/144 | O182/156 | O234/207 | O219/193 | O192/172 | P12/11 |
| COMP_1170 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B10/10 | O12/12 | O9/9 | O15/15 | O14/14 | O2/2 | O8/7 | O8/8 | O9/9 | O7/7 | O14/14 | O5/5 | O11/11 | O17/17 | O7/7 | O10/10 | O8/8 | O8/8 | O8/8 | O6/6 | O6/6 | O3/3 | O8/8 | O2/2 | X |
| COMP_1171 | 2024-09-16 | 2026-09-01 | 18 | 18 | 18 | B1/1 | G | G | G | G | O2/2 | G | G | O7/7 | O7/7 | O48/48 | O33/33 | O106/106 | O74/69 | O67/66 | O99/98 | O76/76 | O84/82 | O131/131 | O97/96 | O101/101 | O104/104 | O44/44 | O50/50 | P1/1 |
| COMP_1172 | 2025-07-14 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B226/226 | O317/317 | O381/381 | O309/309 | O171/171 | O669/669 | O169/169 | O163/163 | O157/157 | O161/161 | O169/169 | O630/630 | O155/155 | O137/137 | P9/9 |
| COMP_1173 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B99/68 | O101/78 | O42/37 | O84/58 | O36/29 | O30/28 | O31/23 | O37/29 | O35/32 | O46/38 | O51/49 | O13/13 | O22/22 | O21/21 | O13/13 | O21/21 | O27/27 | O23/23 | O124/122 | O90/89 | O166/166 | O74/74 | O106/103 | O44/43 | P6/6 |
| COMP_1174 | 2025-02-27 | 2026-08-04 | 19 | 19 | 19 | X | X | X | X | X | B1/1 | O84/84 | O125/125 | O134/134 | O179/179 | O144/144 | O152/152 | O170/170 | O161/161 | O152/147 | O135/135 | O161/161 | O117/117 | O147/147 | O56/56 | O33/33 | O20/20 | O10/10 | B2/2 | X |
| COMP_1175 | 2026-01-20 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O5/5 | O8/8 | O5/5 | O6/6 | O9/9 | O14/14 | O5/5 | X |
| COMP_1176 | 2025-11-10 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B107/107 | O176/176 | O132/132 | O163/163 | O172/172 | O142/142 | O132/132 | O156/156 | O176/176 | O149/149 | P11/11 |
| COMP_1177 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B61/61 | O80/80 | O56/56 | O86/86 | O73/73 | O52/52 | O73/73 | O86/86 | O80/80 | O65/65 | O75/75 | O70/70 | O69/69 | O78/78 | O59/59 | O86/86 | O66/66 | O73/73 | O71/71 | O81/81 | O67/67 | O76/76 | O84/84 | O58/58 | P6/6 |
| COMP_1178 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B375/375 | O509/509 | O422/422 | O199/198 | O231/231 | O375/375 | O477/477 | O637/618 | O875/843 | O745/729 | O1006/1006 | O925/925 | O976/976 | O1021/1021 | O884/866 | O1110/1110 | O1013/1013 | O904/904 | O995/990 | O981/973 | O1094/1094 | O1013/1013 | O1056/1056 | O734/734 | P40/40 |
| COMP_1179 | 2026-01-22 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O6/6 | O12/11 | O7/3 | O9/9 | O33/31 | O116/116 | O67/67 | X |
| COMP_1180 | 2025-01-17 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B2/2 | O20/20 | O22/22 | O26/26 | O17/17 | O29/29 | O50/50 | O21/21 | O38/38 | O37/37 | O28/28 | O27/27 | O57/57 | O38/38 | O48/48 | O55/55 | O38/38 | O42/42 | O49/49 | O34/34 | P3/3 |
| COMP_1181 | 2025-10-16 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B39/39 | O76/76 | O86/86 | O93/93 | O93/93 | O110/110 | O89/89 | O106/106 | O79/79 | O112/112 | O110/110 | P2/2 |
| COMP_1182 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O192/192 | O239/239 | O143/143 | O204/204 | O218/218 | O232/232 | O430/430 | O280/280 | O200/200 | O172/172 | O139/139 | O91/91 | O221/221 | O223/218 | O185/177 | O330/311 | O182/177 | O258/252 | O301/280 | O257/231 | O622/197 | O400/217 | O286/259 | O93/86 | P13/12 |
| COMP_1183 | 2025-01-03 | 2026-07-03 | 19 | 19 | 19 | X | X | X | X | B8/8 | O5/5 | O5/5 | O6/6 | O8/8 | O6/6 | O9/9 | O6/6 | O5/5 | O6/6 | O8/8 | O6/6 | O6/6 | O6/6 | O4/4 | O13/13 | O8/8 | O5/5 | B2/2 | X | X |
| COMP_1184 | 2025-06-13 | 2026-09-01 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B20/17 | O36/32 | O31/27 | O31/27 | O50/47 | O49/46 | O40/37 | O44/41 | O51/48 | O44/43 | O46/44 | O43/40 | O45/44 | O59/56 | O53/50 | P6/4 |
| COMP_1185 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O659/659 | O720/720 | O658/658 | O685/685 | O703/703 | O692/692 | O684/684 | O689/689 | O688/688 | O706/706 | O827/827 | O652/652 | O723/723 | O747/747 | O641/641 | O684/684 | O676/676 | O638/638 | O782/782 | O742/742 | O699/699 | O600/600 | O786/786 | O725/725 | P35/35 |
| COMP_1186 | 2025-07-17 | 2026-08-27 | 14 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | B3/N | O7/N | O5/N | O7/N | O4/N | O4/N | O6/N | O2/N | O2/N | O5/N | O5/N | O2/N | O4/N | B3/N | X |
| COMP_1187 | 2025-10-21 | 2026-09-01 | 11 | 2 | 2 | X | X | X | X | X | X | X | X | X | X | X | X | X | B27/N | O40/N | O104/N | O120/N | O103/N | O17/3 | O337/2 | O753/N | O944/N | O962/N | O818/N | P14/N |
| COMP_1188 | 2024-09-17 | 2026-08-17 | 24 | 24 | 24 | B7/7 | O5/5 | O4/4 | O7/7 | O6/6 | O6/6 | O8/8 | O9/9 | O6/6 | O6/6 | O12/12 | O8/8 | O10/10 | O8/8 | O6/6 | O8/8 | O6/6 | O6/6 | O5/5 | O7/7 | O9/9 | O8/8 | O10/10 | B1/1 | X |
| COMP_1189 | 2024-09-03 | 2026-08-31 | 24 | 24 | 24 | B33/33 | O39/39 | O40/40 | O27/27 | O32/32 | O18/18 | O23/23 | O37/37 | O25/25 | O14/14 | O29/29 | O20/20 | O16/16 | O22/22 | O18/18 | O11/11 | O14/14 | O7/7 | O7/7 | O8/8 | O7/7 | O3/3 | O4/4 | O6/6 | X |
| COMP_1190 | 2026-01-06 | 2026-09-01 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B57/N | O60/N | O65/N | O62/N | O67/N | O54/N | O61/N | O55/N | P8/N |
| COMP_1191 | 2024-10-07 | 2026-09-01 | 20 | 20 | 20 | X | B7/7 | G | O6/6 | G | O14/14 | G | O19/19 | O14/14 | O14/14 | O34/34 | O45/45 | O126/124 | O85/80 | O70/65 | O87/87 | O66/64 | O76/76 | O148/147 | O132/129 | O101/101 | O73/73 | O27/27 | O60/60 | P6/6 |
| COMP_1192 | 2024-12-01 | 2026-08-31 | 21 | 0 | 0 | X | X | X | O82/N | O32/N | O69/N | O76/N | O57/N | O51/N | O61/N | O59/N | O57/N | O53/N | O61/N | O55/N | O68/N | O53/N | O42/N | O42/N | O55/N | O105/N | O53/N | O36/N | O50/N | X |
| COMP_1193 | 2025-01-09 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B4/4 | O1/1 | O6/6 | O4/4 | O3/3 | O2/2 | O5/5 | O2/2 | O5/5 | O26/26 | O22/22 | O49/49 | O34/34 | O43/43 | O37/37 | O41/41 | O30/30 | O29/29 | O41/41 | O25/25 | P3/3 |
| COMP_1194 | 2025-09-08 | 2026-07-09 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | B167/167 | O191/191 | O163/163 | O268/265 | O238/237 | O225/224 | O236/234 | O214/212 | O76/75 | O79/77 | B36/35 | X | X |
| COMP_1195 | 2025-11-27 | 2026-09-01 | 10 | 10 | 10 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B30/22 | O881/798 | O765/612 | O578/498 | O912/594 | O630/548 | O627/567 | O919/831 | O654/563 | O545/462 | P31/24 |
| COMP_1196 | 2025-01-03 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B27/27 | O27/27 | O29/29 | O41/41 | O38/38 | O29/29 | O42/42 | O24/24 | O42/42 | O35/35 | O28/28 | O29/29 | O32/32 | O38/38 | O51/51 | O37/37 | O39/39 | O47/47 | O52/52 | O43/43 | P3/3 |
| COMP_1197 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B79/79 | O45/45 | O47/47 | O56/56 | O48/48 | O60/60 | O15/15 | O59/59 | O47/47 | O51/51 | O73/73 | O72/72 | O15/15 | O81/81 | O20/20 | O108/108 | O100/100 | O75/75 | O63/63 | P1/1 |
| COMP_1198 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O331/181 | O333/176 | O198/86 | O154/59 | O328/186 | O232/103 | O258/147 | O248/119 | O240/132 | O171/89 | O137/70 | O112/54 | O151/74 | O147/69 | O119/59 | O129/57 | O76/40 | O91/54 | O108/80 | O57/34 | O91/59 | O74/36 | O65/38 | O50/32 | P8/5 |
| COMP_1199 | 2024-09-02 | 2026-08-31 | 24 | 24 | 24 | B3/3 | O8/8 | O10/10 | O5/5 | O20/20 | O9/9 | O8/8 | O5/5 | O40/40 | O6/6 | O13/13 | O5/5 | O11/11 | O14/14 | O5/5 | O7/7 | O17/17 | O8/8 | O19/19 | O13/13 | O15/15 | O15/15 | O20/20 | O16/16 | X |
| COMP_1200 | 2026-02-28 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O5/5 | O4/4 | O8/8 | O7/7 | O23/23 | O12/12 | P1/1 |
| COMP_1201 | 2025-06-10 | 2026-09-01 | 15 | 0 | 0 | X | X | X | X | X | X | X | X | X | B22/N | O27/N | O38/N | O35/N | O46/N | O31/N | O31/N | O33/N | O41/N | O39/N | O43/N | O45/N | O40/N | O63/N | O69/N | P1/N |
| COMP_1202 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O278/278 | O293/293 | O143/143 | O50/50 | O38/38 | O90/90 | O159/159 | O195/195 | O270/270 | O259/259 | O279/279 | O265/265 | O280/280 | O307/307 | O110/110 | O41/41 | O39/39 | O145/145 | O271/271 | O321/321 | O312/312 | O268/268 | O346/346 | O334/334 | P14/14 |
| COMP_1203 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B83/48 | O240/182 | O206/132 | O238/178 | O502/340 | O429/269 | O321/258 | O214/154 | P5/5 |
| COMP_1204 | 2025-12-19 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B99/61 | O249/146 | O229/139 | O265/155 | O255/147 | O245/139 | O272/159 | O271/165 | O266/151 | P14/5 |
| COMP_1205 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B9/9 | O119/119 | O82/82 | O91/91 | O92/92 | O107/107 | O73/73 | P10/10 |
| COMP_1206 | 2025-02-20 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B5/5 | O8/8 | O390/390 | O131/131 | O141/141 | O144/144 | O124/124 | O134/134 | O161/161 | O151/151 | O97/97 | O77/77 | O122/122 | O67/67 | O81/81 | O145/145 | O58/58 | O122/122 | O81/81 | P13/13 |
| COMP_1207 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B92/92 | O123/123 | O122/122 | O107/107 | O114/114 | O111/111 | O127/127 | O128/128 | O105/105 | O111/111 | O135/135 | O92/92 | O107/107 | O123/123 | O92/92 | O108/108 | O103/103 | O97/97 | O96/96 | O102/102 | O122/122 | O34/34 | O128/128 | O105/105 | P2/2 |
| COMP_1208 | 2026-02-06 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B162/162 | O227/227 | O219/219 | O265/232 | O251/219 | O294/241 | O255/210 | P14/14 |
| COMP_1209 | 2024-10-07 | 2026-08-31 | 23 | 23 | 23 | X | B11/11 | O29/29 | O27/27 | O34/34 | O22/22 | O46/46 | O29/29 | O32/32 | O23/23 | O39/39 | O31/31 | O35/35 | O43/43 | O37/37 | O39/39 | O34/34 | O29/29 | O35/35 | O46/46 | O31/31 | O22/22 | O23/23 | O28/28 | X |
| COMP_1210 | 2024-09-23 | 2026-09-01 | 24 | 24 | 24 | B1/1 | O4/4 | O2/2 | O3/3 | O5/5 | O2/2 | O2/2 | O3/3 | O6/6 | O2/2 | O5/5 | O5/5 | O2/2 | O3/3 | O8/8 | O2/2 | O2/2 | O5/5 | O2/2 | O2/2 | O4/4 | O4/4 | O6/6 | O4/4 | P1/1 |
| COMP_1211 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B261/261 | O200/200 | O78/78 | O54/54 | O62/62 | O44/44 | O37/37 | O19/19 | O19/19 | O51/51 | O15/15 | O10/10 | O14/14 | O34/34 | O14/14 | O8/8 | O9/9 | O9/9 | O6/6 | O20/20 | P2/2 |
| COMP_1212 | 2024-09-03 | 2026-09-01 | 24 | 24 | 24 | B34/34 | O38/38 | O25/25 | O31/31 | O46/46 | O22/22 | O73/73 | O104/104 | O123/123 | O107/107 | O125/125 | O135/135 | O112/112 | O175/175 | O135/135 | O202/202 | O248/248 | O184/184 | O240/240 | O237/237 | O373/373 | O377/377 | O244/244 | O215/215 | P5/5 |
| COMP_1213 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B222/222 | O283/283 | O237/222 | O248/235 | O229/229 | O233/233 | O253/253 | O266/266 | O182/182 | O255/255 | O272/272 | O198/198 | O243/243 | O266/266 | O197/197 | O268/268 | O219/219 | O246/246 | O269/269 | O228/228 | O231/231 | O280/280 | O245/245 | O195/195 | P15/15 |
| COMP_1214 | 2025-12-30 | 2026-08-26 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B4/4 | O11/11 | O15/15 | O9/9 | O13/13 | O7/7 | O16/16 | O10/10 | B15/15 | X |
| COMP_1215 | 2025-09-01 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | O1032/1032 | O1439/1439 | O1273/1273 | O1234/1234 | O1190/1190 | O1223/1223 | O1290/1290 | O1196/1196 | O1305/1305 | O1566/1566 | O1311/1311 | O530/530 | P56/56 |
| COMP_1216 | 2025-07-26 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B82/82 | O316/316 | O407/407 | O431/431 | O345/345 | O524/524 | O439/439 | O328/328 | O395/395 | O363/363 | O322/322 | O596/376 | O350/350 | O326/326 | P19/19 |
| COMP_1217 | 2025-12-29 | 2026-08-31 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B2/2 | O8/8 | O3/3 | O7/7 | O10/10 | O5/5 | O5/5 | O9/9 | O4/4 | X |
| COMP_1218 | 2025-12-12 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B12/12 | O42/42 | O45/45 | O49/49 | O33/33 | O45/45 | O41/41 | O44/44 | O45/45 | P6/6 |
| COMP_1219 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B8/8 | O81/81 | O49/49 | O67/67 | O68/68 | O61/61 | O63/63 | O55/55 | O82/82 | O63/63 | O62/62 | O72/72 | O58/58 | O93/93 | O64/64 | O68/68 | O78/78 | O68/68 | O69/69 | O64/64 | O59/59 | O76/76 | O79/79 | O78/78 | P12/12 |
| COMP_1220 | 2025-07-21 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B6/6 | O12/12 | O18/18 | O23/23 | O29/29 | O29/29 | O18/18 | O18/18 | O25/25 | O16/16 | O13/13 | O23/23 | O24/24 | O28/28 | P2/2 |
| COMP_1221 | 2025-07-18 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B444/444 | O813/813 | O1199/1199 | O1793/1793 | O925/925 | O694/694 | O440/440 | O599/599 | O636/636 | O292/292 | O238/238 | O182/182 | O262/262 | O179/179 | P10/10 |
| COMP_1222 | 2025-04-30 | 2026-09-01 | 17 | 0 | 0 | X | X | X | X | X | X | X | B4/N | O10/N | O10/N | O13/N | O8/N | O9/N | O9/N | O20/N | O118/N | O333/N | O397/N | O375/N | O304/N | O373/N | O266/N | O373/N | O420/N | P22/N |
| COMP_1223 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B126/126 | O208/208 | O158/158 | O139/139 | O219/203 | O168/168 | O190/190 | O196/196 | O177/177 | O175/175 | O255/255 | O161/161 | O176/176 | O265/265 | O163/163 | O191/191 | O240/240 | O172/172 | O195/195 | O254/254 | O171/171 | O180/180 | O231/231 | O156/156 | P4/4 |
| COMP_1224 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B53/53 | O61/61 | O54/54 | O49/49 | O57/57 | O49/49 | O57/57 | O63/63 | O57/57 | O57/57 | O77/77 | O63/63 | O61/61 | O72/72 | O66/66 | O85/85 | O63/63 | O71/71 | O63/63 | O73/73 | O63/63 | O61/61 | O72/72 | O55/55 | P7/7 |
| COMP_1225 | 2026-01-02 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B309/309 | O298/298 | O319/319 | O315/315 | O296/296 | O296/296 | O322/322 | O277/277 | P18/18 |
| COMP_1226 | 2024-10-08 | 2026-08-06 | 12 | 12 | 12 | X | B3/3 | G | G | O2/2 | G | O1/1 | O1/1 | G | G | O3/3 | G | G | O2/2 | G | G | O2/2 | O1/1 | O1/1 | O2/2 | G | G | O2/2 | B1/1 | X |
| COMP_1227 | 2025-02-03 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B2/2 | O7/7 | O15/15 | O17/17 | O9/9 | O14/14 | O9/9 | O14/14 | O23/23 | O17/17 | O11/11 | O25/25 | O10/10 | O16/16 | O16/16 | O5/5 | O26/26 | O18/18 | O11/11 | P2/2 |
| COMP_1228 | 2026-01-11 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B45/45 | O45/45 | O65/65 | O58/58 | O66/66 | O43/43 | O52/52 | O43/43 | P5/5 |
| COMP_1229 | 2025-11-21 | 2026-08-28 | 10 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B7/N | O14/N | O15/N | O18/N | O17/N | O16/N | O12/N | O13/N | O11/N | B14/N | X |
| COMP_1230 | 2025-01-01 | 2026-09-01 | 20 | 20 | 16 | X | X | X | X | O57/8 | O55/8 | O45/8 | O74/17 | O57/8 | O63/7 | O63/4 | O26/4 | O37/5 | O61/6 | O53/3 | O53/1 | O53/N | O54/N | O64/N | O66/N | O63/9 | O66/1 | O55/4 | O25/1 | P5/N |
| COMP_1231 | 2025-11-05 | 2026-07-10 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B32/11 | O41/10 | O52/27 | O24/17 | O61/31 | O58/26 | O50/22 | O29/11 | B29/13 | X | X |
| COMP_1232 | 2025-04-01 | 2026-08-31 | 17 | 17 | 17 | X | X | X | X | X | X | X | O9/9 | O19/19 | O12/12 | O20/18 | O11/11 | O12/12 | O16/16 | O21/21 | O13/13 | O16/16 | O13/13 | O19/19 | O21/20 | O22/22 | O10/10 | O14/14 | O20/20 | X |
| COMP_1233 | 2024-12-02 | 2026-09-01 | 21 | 21 | 21 | X | X | X | B283/283 | O240/240 | O252/252 | O162/162 | O145/145 | O144/144 | O132/132 | O86/86 | O74/74 | O87/87 | O176/176 | O194/194 | O190/190 | O128/128 | O111/111 | O82/82 | O77/77 | O103/103 | O76/76 | O121/121 | O84/84 | P8/8 |
| COMP_1234 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B66/66 | O100/100 | O72/72 | O87/87 | O64/64 | O71/71 | O70/70 | O83/83 | O73/73 | O92/92 | O75/75 | O60/60 | O63/63 | O100/100 | O69/69 | O89/89 | O79/79 | O66/66 | O75/75 | O84/84 | O82/82 | O91/91 | O97/97 | O72/72 | P10/10 |
| COMP_1235 | 2025-10-06 | 2026-08-31 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B152/152 | O143/143 | O106/106 | O111/111 | O95/95 | O154/154 | O150/150 | O193/193 | O141/141 | O99/99 | O68/68 | X |
| COMP_1236 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B196/196 | O147/147 | O123/123 | O132/132 | O108/108 | O121/121 | O109/109 | O104/104 | O102/102 | O117/117 | O81/81 | O37/37 | O54/54 | O62/62 | O52/52 | O48/48 | O41/41 | O41/41 | O49/49 | O43/43 | O31/31 | O26/26 | O56/56 | O56/56 | P6/6 |
| COMP_1237 | 2025-08-05 | 2026-05-04 | 8 | 5 | 5 | X | X | X | X | X | X | X | X | X | X | X | B4/N | O1/N | G | G | O1/N | O1750/489 | O1871/481 | O2108/541 | O771/29 | B2/1 | X | X | X | X |
| COMP_1238 | 2024-09-12 | 2026-08-31 | 24 | 24 | 24 | B5/5 | O8/8 | O6/6 | O8/8 | O8/8 | O8/8 | O5/5 | O6/6 | O6/6 | O5/5 | O9/9 | O4/4 | O7/7 | O8/8 | O10/10 | O14/14 | O8/8 | O6/6 | O5/5 | O5/5 | O5/5 | O12/12 | O9/9 | O8/8 | X |
| COMP_1239 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O8/8 | O5/5 | O3/3 | O6/6 | O2/2 | O6/6 | O5/5 | O3/3 | O4/4 | O5/5 | O3/3 | O2/2 | O5/5 | O5/5 | O4/4 | O3/3 | O3/3 | O2/2 | O3/3 | O2/2 | O5/5 | O3/3 | P1/1 |
| COMP_1240 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B4/4 | O5/5 | O7/7 | O3/3 | O3/3 | O4/4 | O3/3 | O6/6 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O6/6 | O4/4 | O3/3 | O4/4 | O2/2 | O3/3 | O4/4 | O6/6 | O5/5 | P1/1 |
| COMP_1241 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B5/5 | O6/6 | O13/13 | O3/3 | O3/3 | O4/4 | O3/3 | O6/6 | O4/4 | O3/3 | O4/4 | O4/4 | O3/3 | O2/2 | O5/5 | O6/6 | O4/4 | O3/3 | O4/4 | O2/2 | O4/4 | O4/4 | O5/5 | O5/5 | P1/1 |
| COMP_1242 | 2026-01-19 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/1 | O10/10 | O28/28 | O45/45 | O32/32 | O38/38 | O69/69 | O29/29 | P1/1 |
| COMP_1243 | 2026-01-12 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B8/8 | O100/100 | O166/166 | O167/155 | O147/132 | O147/129 | O137/117 | O95/91 | P7/6 |
| COMP_1244 | 2025-10-17 | 2026-08-31 | 11 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/N | O28/N | O11/N | O20/N | O56/N | O21/N | O25/N | O37/N | O29/N | O27/N | O33/N | X |
| COMP_1245 | 2024-09-04 | 2026-04-30 | 18 | 18 | 18 | B10/10 | O24/23 | O5/5 | O8/8 | O5/5 | O8/8 | O14/14 | O12/12 | O2/2 | O5/5 | O4/4 | O4/4 | O11/11 | O4/4 | O1/1 | O2/2 | O6/6 | G | G | O4/4 | X | X | X | X | X |
| COMP_1246 | 2026-02-16 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B41/41 | O290/290 | O68/68 | O142/142 | O69/69 | O70/70 | O70/70 | P1/1 |
| COMP_1247 | 2025-02-19 | 2026-08-31 | 17 | 17 | 17 | X | X | X | X | X | B2/2 | O16/16 | O3/3 | O1/1 | O12/12 | O5/5 | G | O18/18 | O3/3 | O2/2 | O16/16 | O3/3 | O1/1 | O14/14 | O1/1 | G | O15/15 | O4/4 | O2/2 | X |
| COMP_1248 | 2025-02-13 | 2026-09-01 | 19 | 19 | 19 | X | X | X | X | X | B58/58 | O142/142 | O157/157 | O111/111 | O110/110 | O110/110 | O96/96 | O102/102 | O140/140 | O138/137 | O162/153 | O171/159 | O128/120 | O153/145 | O157/149 | O136/129 | O108/101 | O102/96 | O66/60 | P6/6 |
| COMP_1249 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O168/168 | O146/145 | O155/155 | O152/152 | O132/130 | O96/96 | O88/88 | O90/87 | O134/132 | O100/96 | O108/106 | O109/106 | O113/111 | O109/105 | O125/98 | O117/109 | O99/87 | O111/107 | O106/103 | O136/131 | O174/169 | O153/134 | O201/190 | O186/173 | P23/23 |
| COMP_1250 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B81/81 | O65/65 | O54/54 | O71/71 | O90/90 | O70/70 | O79/79 | O114/95 | O73/73 | O104/104 | O86/86 | O104/104 | O61/61 | O80/80 | O65/65 | O66/66 | O79/79 | O59/59 | O63/63 | O84/84 | O76/76 | O94/94 | O92/92 | O103/103 | P5/5 |
| COMP_1251 | 2025-03-19 | 2026-07-21 | 13 | 13 | 13 | X | X | X | X | X | X | B3/3 | O1/1 | O5/5 | O3/3 | O4/4 | G | O2/2 | G | O2/2 | O1/1 | O2/2 | G | O1/1 | O1/1 | G | O1/1 | B2/2 | X | X |
| COMP_1252 | 2024-09-02 | 2026-09-01 | 24 | 24 | 24 | B51/51 | O52/52 | O48/48 | O53/53 | O56/56 | O22/22 | O28/28 | O39/39 | O72/72 | O56/56 | O43/43 | O50/50 | O43/43 | O63/63 | O52/52 | O42/42 | O39/39 | O39/39 | O78/78 | O37/36 | O53/53 | O57/57 | O64/64 | O29/29 | P3/3 |
| COMP_1253 | 2025-06-10 | 2026-08-31 | 15 | 15 | 15 | X | X | X | X | X | X | X | X | X | B2/2 | O5/5 | O6/6 | O4/4 | O10/10 | O5/5 | O7/7 | O16/16 | O9/9 | O7/7 | O13/13 | O36/36 | O7/7 | O12/12 | O10/10 | X |
| COMP_1254 | 2026-01-13 | 2026-08-29 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B5/2 | O4/2 | O13/4 | O12/4 | O21/8 | O10/2 | O14/5 | B27/8 | X |
| COMP_1255 | 2024-09-09 | 2025-07-21 | 11 | 0 | 0 | B14/N | O14/N | O13/N | O12/N | O12/N | O5/N | O4/N | O6/N | O4/N | O10/N | B11/N | X | X | X | X | X | X | X | X | X | X | X | X | X | X |
| COMP_1256 | 2024-10-28 | 2026-09-01 | 23 | 23 | 23 | X | B7/7 | O26/26 | O25/25 | O27/27 | O24/24 | O73/73 | O31/31 | O25/25 | O27/27 | O29/29 | O24/24 | O29/29 | O25/25 | O16/16 | O26/26 | O26/26 | O21/21 | O21/21 | O25/25 | O21/21 | O24/24 | O14/14 | O18/18 | P1/1 |
| COMP_1257 | 2024-12-05 | 2026-08-31 | 21 | 21 | 21 | X | X | X | B18/18 | O25/25 | O33/33 | O33/33 | O19/19 | O30/30 | O23/23 | O23/23 | O18/18 | O23/23 | O29/29 | O22/22 | O20/20 | O12/12 | O19/19 | O20/20 | O20/20 | O20/20 | O17/17 | O18/18 | O10/10 | X |
| COMP_1258 | 2025-09-08 | 2026-09-01 | 12 | 12 | 12 | X | X | X | X | X | X | X | X | X | X | X | X | B33/33 | O63/63 | O59/59 | O59/59 | O48/48 | O44/44 | O63/63 | O47/47 | O61/61 | O65/65 | O75/75 | O38/38 | P2/2 |
| COMP_1259 | 2025-12-10 | 2026-07-17 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/12 | O4/4 | G | O2/2 | O5/5 | O4/4 | O1/1 | B10/10 | X | X |
| COMP_1260 | 2026-02-26 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B13/13 | O276/275 | O244/242 | O244/244 | O226/223 | O287/287 | O236/236 | P4/4 |
| COMP_1261 | 2026-02-27 | 2026-08-31 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B6/6 | O20/20 | O22/22 | O15/15 | O30/30 | O32/32 | O11/11 | X |
| COMP_1262 | 2026-02-21 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B14/14 | O56/56 | O66/66 | O51/51 | O55/55 | O62/62 | O59/59 | P3/3 |
| COMP_1263 | 2024-10-12 | 2026-08-31 | 23 | 23 | 23 | X | B20/20 | O41/41 | O33/33 | O35/35 | O20/20 | O41/41 | O36/36 | O48/48 | O35/35 | O47/47 | O31/31 | O27/27 | O39/39 | O29/29 | O29/29 | O30/30 | O39/39 | O18/18 | O24/24 | O26/26 | O38/38 | O23/23 | O18/18 | X |
| COMP_1264 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O216/216 | O201/201 | O178/178 | O211/211 | O232/232 | O128/128 | O223/223 | O204/204 | O199/199 | O190/190 | O165/165 | O169/169 | O62/62 | O48/48 | O61/61 | O37/37 | O72/72 | O37/37 | O40/40 | O50/50 | O37/37 | O40/40 | O57/57 | O36/36 | P3/3 |
| COMP_1265 | 2024-10-14 | 2025-12-23 | 8 | 8 | 8 | X | B2/2 | O2/2 | G | G | O1/1 | G | G | O2/2 | O3/3 | O3/3 | G | G | O3/3 | G | B4/4 | X | X | X | X | X | X | X | X | X |
| COMP_1266 | 2025-10-07 | 2026-09-01 | 11 | 11 | 11 | X | X | X | X | X | X | X | X | X | X | X | X | X | B209/15 | O203/17 | O150/7 | O194/28 | O156/8 | O183/19 | O167/14 | O176/18 | O129/8 | O137/13 | O131/13 | P1/1 |
| COMP_1267 | 2024-12-31 | 2026-09-01 | 21 | 21 | 20 | X | X | X | B1/N | O241/149 | O197/115 | O235/150 | O185/102 | O171/89 | O196/118 | O255/170 | O152/75 | O173/79 | O194/86 | O139/60 | O185/82 | O177/78 | O161/61 | O172/66 | O184/102 | O110/62 | O189/89 | O250/159 | O183/91 | P2/1 |
| COMP_1268 | 2026-02-27 | 2026-09-01 | 7 | 7 | 7 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B16/16 | O1817/1817 | O1665/1665 | O1501/1501 | O1720/1720 | O1732/1731 | O354/354 | P9/9 |
| COMP_1269 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O37/37 | O28/28 | O34/34 | O43/42 | O40/39 | O51/50 | O64/63 | O20/20 | O54/53 | O85/84 | O37/37 | O54/53 | O55/54 | O27/27 | O39/39 | O29/29 | O42/42 | O53/52 | O45/45 | O20/20 | P6/6 |
| COMP_1270 | 2025-07-09 | 2026-08-27 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B3/3 | O7/7 | O3/3 | O12/12 | O6/6 | O11/11 | O7/7 | O8/8 | O12/12 | O11/11 | O5/5 | O10/10 | O17/17 | B6/6 | X |
| COMP_1271 | 2025-03-23 | 2026-09-01 | 18 | 18 | 18 | X | X | X | X | X | X | B82/82 | O286/286 | O303/303 | O284/284 | O334/334 | O294/294 | O377/377 | O398/398 | O347/347 | O358/358 | O356/356 | O364/364 | O395/395 | O381/381 | O348/348 | O391/391 | O392/392 | O312/312 | P22/22 |
| COMP_1272 | 2026-01-01 | 2026-09-01 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | O150/124 | O195/162 | O234/174 | O242/193 | O216/169 | O226/178 | O229/172 | O159/127 | P45/32 |
| COMP_1273 | 2026-01-15 | 2026-08-31 | 8 | 8 | 8 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B20/20 | O19/19 | O12/12 | O23/23 | O18/18 | O21/21 | O28/28 | O15/15 | X |
| COMP_1274 | 2025-02-04 | 2026-07-27 | 17 | 17 | 17 | X | X | X | X | X | B3/3 | G | O5/5 | O6/6 | O6/6 | O7/7 | O6/6 | O9/9 | O10/10 | O9/9 | O11/11 | O11/11 | O1/1 | O2/2 | O1/1 | O1/1 | O2/2 | B2/2 | X | X |
| COMP_1275 | 2025-01-01 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | O20/20 | O29/29 | O52/52 | O22/22 | O28/28 | O49/49 | O26/26 | O28/28 | O52/52 | O56/56 | O20/20 | O48/48 | O22/22 | O23/23 | O52/52 | O18/18 | O26/26 | O44/44 | O21/21 | O19/19 | P2/2 |
| COMP_1276 | 2025-01-16 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B78/78 | O147/147 | O117/117 | O132/132 | O148/148 | O135/135 | O178/178 | O141/141 | O173/173 | O186/186 | O177/177 | O150/150 | O151/151 | O162/162 | O161/161 | O157/157 | O200/200 | O165/165 | O141/141 | O124/124 | P12/12 |
| COMP_1277 | 2025-01-09 | 2026-09-01 | 20 | 20 | 20 | X | X | X | X | B12/12 | O15/15 | O14/14 | O17/17 | O14/14 | O9/9 | O17/17 | O7/7 | O13/13 | O14/14 | O9/9 | O20/20 | O11/11 | O11/11 | O18/18 | O19/19 | O17/17 | O18/18 | O17/17 | O16/16 | P4/4 |
| COMP_1278 | 2025-05-07 | 2026-09-01 | 16 | 16 | 16 | X | X | X | X | X | X | X | X | B42/42 | O84/84 | O72/72 | O64/64 | O69/69 | O60/60 | O87/67 | O88/88 | O58/58 | O101/101 | O76/76 | O81/81 | O62/62 | O103/103 | O68/68 | O55/55 | P2/2 |
| COMP_1279 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O492/192 | O534/210 | O511/210 | O569/213 | O523/211 | O462/185 | O501/198 | O434/153 | O434/383 | O466/466 | O464/464 | O404/404 | O441/441 | O543/543 | O556/556 | O655/655 | O162/162 | O102/102 | O131/131 | O133/133 | O126/126 | O122/122 | O137/137 | O104/104 | P11/11 |
| COMP_1280 | 2025-07-16 | 2026-09-01 | 14 | 14 | 14 | X | X | X | X | X | X | X | X | X | X | B10/10 | O14/14 | O25/25 | O30/30 | O13/13 | O50/50 | O19/19 | O35/35 | O27/27 | O26/26 | O20/20 | O29/29 | O25/25 | O28/28 | P5/5 |
| COMP_1281 | 2025-04-01 | 2026-09-01 | 17 | 17 | 17 | X | X | X | X | X | X | X | O4/4 | O2/2 | O7/7 | O15/15 | O6/6 | O13/13 | O22/22 | O33/33 | O21/21 | O27/27 | O25/25 | O38/38 | O13/13 | O36/36 | O34/34 | O30/30 | O9/9 | P1/1 |
| COMP_1282 | 2024-09-01 | 2026-09-01 | 24 | 24 | 24 | O240/236 | O182/171 | O146/139 | O134/126 | O155/139 | O120/114 | O133/126 | O145/134 | O129/120 | O142/138 | O156/143 | O137/133 | O125/121 | O162/154 | O123/118 | O131/129 | O147/139 | O142/126 | O130/128 | O145/129 | O126/124 | O133/127 | O150/142 | O104/100 | P12/9 |
| COMP_1283 | 2025-07-09 | 2026-08-31 | 14 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | B12/N | O6/N | O9/N | O21/N | O14/N | O16/N | O8/N | O14/N | O14/N | O12/N | O12/N | O12/N | O12/N | O10/N | X |
| COMP_1284 | 2025-12-23 | 2026-09-01 | 9 | 9 | 9 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B3/3 | O54/54 | O87/87 | O102/102 | O114/114 | O103/103 | O107/107 | O246/246 | O93/93 | P65/65 |
| COMP_1285 | 2025-12-31 | 2026-07-20 | 8 | 0 | 0 | X | X | X | X | X | X | X | X | X | X | X | X | X | X | X | B1/N | O10/N | O12/N | O18/N | O11/N | O13/N | O22/N | B26/N | X | X |
| COMP_1286 | 2024-09-21 | 2026-09-01 | 24 | 24 | 24 | B118/60 | O501/329 | O461/305 | O484/289 | O465/283 | O427/264 | O471/301 | O580/367 | O498/327 | O539/373 | O543/362 | O375/227 | O453/265 | O422/261 | O395/243 | O434/239 | O357/191 | O439/253 | O459/271 | O466/266 | O306/209 | O176/176 | O176/176 | O166/166 | P16/16 |

## 6. Historical-leakage hazards and data-quality limitations

| Field / input | Observed hazard | Safe historical treatment |
| --- | --- | --- |
| transactions.date / value_date | Booking range coherent; value dates span 2022-07-01 to 2099-12-31; all naive | Use date for grouping/cutoff; preserve value_date and flag anomalies. No UTC assumption. |
| transactions.status / accounting_status / category | Only current extracted values; no status/category version timestamps | Retrospective analysis of present snapshot only, not claims of what was known at each historical date. |
| companies.created_at | Explicit platform onboarding, not incorporation; 338,136 bookings precede it by calendar day | Never use as founding date, company age, history start, or expected zero-activity boundary. |
| banking_products.created_at / debt_products.created_at | Connection dates; 435,755 bookings precede matched product connection by calendar day; 62 products connected after 2026-09-01 | History can be backfilled; no timestamped metadata versions. Do not gate valid booking history on created_at. |
| banking_products/debt_products metadata | Current type/currency/service; no explicit mutable account status column is present | Do not invent active/closed/status fields. If supplied later, current account status cannot reconstruct historical active accounts. |
| invoices.status / pending_amount / payment_date | Current ERP snapshot; 300 paid records retain nonzero pending_amount; 237,593 non-paid records carry payment_date | No historical paid/unpaid labels from present state; payment_date alone is not proof settlement occurred. No payment-event history. |
| invoices.due_date / payment_date | Syntactically valid dates reach years 7025 and 6913; 20,869 due dates and 29,089 payment dates precede issuance | Apply domain validity flags; exclude from unvalidated historical debt-coverage or delinquency reconstruction. |
| debt_products.granted / outstanding / liquidity | Current facility and balances; sign conventions vary, 1,351 negative outstanding amounts | Do not spread today's outstanding backwards. Do not silently abs() all balances or assume positive debt convention. |
| debt_schedule_config balances / rate / dates | Current remaining principal/latest rate; no periodic payment amounts or rate history; next_payment_date often predates extract | Cannot reliably reconstruct historical installments or interest from these fields alone. |
| balances.date / balance / available / granted / liquidity / countable | One row per product, 7,980 dated 2026-09-01 and 16 older; available is 100% empty | Only dated point-in-time evidence. No backfilling through unverified transactions, no using Sep snapshot for earlier months. |
| invoice operation_id / document_type / counterparty | Multiple document kinds, no explicit receivable/payable direction or transaction FK | Do not infer invoice = revenue or all negatives = supplier expense without semantic evidence. |
| all monetary fields | Extreme values and suspicious repeating-9 numbers; amounts have mixed native currencies | Flag/quarantine under an explicit policy; never silently drop, cap, infer sentinel, or pool different currencies. |

All meaningful date fields parse successfully as naive Python datetimes. Parse success is not plausibility: no timezone offset is supplied, and converting to UTC/local time without evidence can shift months. Preserve the calendar date as written. Booking date is supported by the dictionary and observed bounds; value_date is unsuitable as the unvalidated common history clock.

| Date relation | Records |
| --- | --- |
| absolute difference >31 days | 2748 |
| equal timestamps | 2229891 |
| value after booking | 83518 |
| value before booking | 243028 |

| Additional quality check | Exact count |
| --- | --- |
| banking_products_created_after_snapshot | 43 |
| debt_products_created_after_snapshot | 19 |
| invoice_due_date_outside_2020_2030 | 199 |
| invoice_payment_date_outside_2020_2030 | 176 |
| schedule_last_payment_after_snapshot | 1 |
| schedule_next_payment_before_snapshot | 81 |
| schedule_settlement_resolves_to_debt | 8 |
| value_date_after_snapshot | 264 |
| value_date_before_history_start | 793 |
| value_date_year_ge_2030 | 8 |

| Balance snapshot datetime | Rows |
| --- | --- |
| 2026-08-25 00:00:00 | 2 |
| 2026-08-27 00:00:00 | 5 |
| 2026-08-28 00:00:00 | 8 |
| 2026-08-29 00:00:00 | 1 |
| 2026-09-01 00:00:00 | 7980 |

| Schedule/product comparison | Exact count out of 87 |
| --- | --- |
| schedule_outstanding_equals_product_absolute | 11 |
| schedule_outstanding_equals_product_signed | 0 |

Only 11/87 schedule outstanding amounts equal the absolute product outstanding, and none match the signed product value. This is evidence against treating the two snapshots as freely interchangeable. 81 next_payment_date values precede 2026-09-01, so the column is not a validated next-current-obligation date. A past next_payment_date is not, by itself, proof of delinquency.

### Numeric sentinel candidates and extremes

Full-data diagnostic predicate: monetary literal matches `-?9{6,}(\.0+)?` or absolute Decimal value is at least 1,000,000,000. These values are NOT reclassified as NULL; provider confirmation is needed. Values below are scalar magnitudes, not personal records and not currency-aggregated amounts.

| Column | Exact observed suspect literal: count |
| --- | --- |
| balances.balance | `-999999999`: 2; `1000207616.82`: 1; `1012432308`: 1; `1212546381.96`: 1; `99999990850`: 1 |
| balances.countable | `1000018899.36`: 1; `1000031013.18`: 1; `1001000207615.82`: 1; `999999999`: 1 |
| balances.granted | `-999999`: 1 |
| balances.liquidity | `1000207616.82`: 1 |
| debt_products.granted | `-999999`: 1 |
| debt_products.liquidity | `999999`: 1 |
| invoices.amount | `-1272103835.8`: 1; `-1616399369`: 1; `-4567500442`: 1; `-62442200699.61`: 1; `-9999999`: 1; `1026306000`: 1; `1272103835.8`: 1; `1354520794.4`: 1; `3715276416.16`: 1; `4567500442`: 1; `62442200699.61`: 1 |
| invoices.pending_amount | `-1613461892.11`: 1; `-9999999`: 1; `1272103835.8`: 1 |
| transactions.amount | `-1000000000`: 1; `-1375802701.74`: 1; `-1613213828.46`: 1; `-1694290175`: 1; `-2060935983`: 1; `-3069784469.83`: 1; `1000000000`: 3; `1000656000`: 2; `1077721000`: 1; `1081745000`: 1; `1125136925`: 1; `1202575075.7`: 1; `1305284726.87`: 1; `1694290175`: 1; `1800000000`: 1; `2000000000`: 2; `2161837417.6`: 1; `2208837079.2`: 1; `2828356389.92`: 1; `3100000000`: 1; `999999999`: 5 |

### Evidence locators for independent investigation

Each group below gives up to five deterministic first-match locators from the complete scan. They are evidence pointers only; every statistic elsewhere uses all matching records, not these examples. Source hashes are in the inventory. Retrieve records locally; do not publish their narratives or bank details.

| Finding / diagnostic | First-match reproducible source-record locators |
| --- | --- |
| chargeback | transactions.csv#record=2; transactions.csv#record=3; transactions.csv#record=8; transactions.csv#record=14; transactions.csv#record=16 |
| extreme_balances_balance | balances.csv#record=1860; balances.csv#record=2508; balances.csv#record=2514; balances.csv#record=2588; balances.csv#record=3621 |
| extreme_balances_countable | balances.csv#record=3590; balances.csv#record=3602; balances.csv#record=3603; balances.csv#record=3621 |
| extreme_balances_granted | balances.csv#record=6700 |
| extreme_balances_liquidity | balances.csv#record=3621 |
| extreme_debt_products_granted | debt_products.csv#record=1998 |
| extreme_debt_products_liquidity | debt_products.csv#record=1998 |
| extreme_invoices_amount | invoices.csv#record=1443; invoices.csv#record=11462; invoices.csv#record=54577; invoices.csv#record=66286; invoices.csv#record=665397 |
| extreme_invoices_pending_amount | invoices.csv#record=677239; invoices.csv#record=707436; invoices.csv#record=829102 |
| extreme_transactions_amount | transactions.csv#record=6045; transactions.csv#record=18857; transactions.csv#record=51083; transactions.csv#record=491832; transactions.csv#record=492081 |
| fee | transactions.csv#record=1; transactions.csv#record=12; transactions.csv#record=22; transactions.csv#record=51; transactions.csv#record=52 |
| financing | transactions.csv#record=4; transactions.csv#record=43; transactions.csv#record=48; transactions.csv#record=56; transactions.csv#record=59 |
| interest | transactions.csv#record=1; transactions.csv#record=10; transactions.csv#record=12; transactions.csv#record=70; transactions.csv#record=99 |
| internal_transfer | transactions.csv#record=54; transactions.csv#record=154; transactions.csv#record=278; transactions.csv#record=380; transactions.csv#record=397 |
| invoice_due_date_outside_2020_2030 | invoices.csv#record=40812; invoices.csv#record=70006; invoices.csv#record=72318; invoices.csv#record=148460; invoices.csv#record=161116 |
| invoice_payment_date_outside_2020_2030 | invoices.csv#record=40812; invoices.csv#record=70006; invoices.csv#record=72318; invoices.csv#record=72411; invoices.csv#record=160447 |
| transaction_unknown_product | transactions.csv#record=1622; transactions.csv#record=4336; transactions.csv#record=4342; transactions.csv#record=7851; transactions.csv#record=8213 |
| unknown_product_balances | balances.csv#record=93; balances.csv#record=318; balances.csv#record=320; balances.csv#record=1093; balances.csv#record=1780 |
| unknown_product_transactions | transactions.csv#record=1622; transactions.csv#record=4336; transactions.csv#record=4342; transactions.csv#record=7851; transactions.csv#record=8213 |
| value_date_after_snapshot | transactions.csv#record=5608; transactions.csv#record=11515; transactions.csv#record=14321; transactions.csv#record=20068; transactions.csv#record=27173 |
| value_date_before_history_start | transactions.csv#record=269; transactions.csv#record=354; transactions.csv#record=2543; transactions.csv#record=3418; transactions.csv#record=4524 |
| value_date_year_ge_2030 | transactions.csv#record=20068; transactions.csv#record=27173; transactions.csv#record=51739; transactions.csv#record=493182; transactions.csv#record=723106 |

## 7. Complete company ID, table-membership, and currency coverage register

All direct company ID sets are exactly recoverable from this register: every row belongs to `companies` and `transactions`; membership letters denote `B=banking_products`, `D=debt_products`, `S=debt_schedule_config`, `I=invoices`, `L=balances`. The groups table links indirectly using group_id. No company has been omitted. Currency counts are counts of rows, never monetary sums. `multi` is based on the union of known product, transaction, and invoice currencies, excluding unknown. `-` means no rows in that table, not zero financial activity. Invoice-month counts are distinct issuance_date months over the observed invoice span; they are not substitutes for transaction history.

| company_id | group_id | Company currency | Membership | multi | Bank-product currency:count | Debt-product currency:count | Transaction inherited currency:count | Invoice explicit currency:count | Invoice issuance months | Balance inherited currency:count |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COMP_0001 | GROUP_0147 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 203 | `EUR`: 633 | 24 | `EUR`: 2 |
| COMP_0002 | GROUP_0125 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 581 | none | 0 | `EUR`: 2 |
| COMP_0003 | GROUP_0044 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 427 | `EUR`: 40; `USD`: 1 | 9 | `EUR`: 2 |
| COMP_0004 | GROUP_0058 | EUR | BDSIL | no | `EUR`: 12 | `EUR`: 14 | `EUR`: 2,088 | `EUR`: 1,700 | 23 | `EUR`: 26 |
| COMP_0005 | GROUP_0092 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 171 | none | 0 | `EUR`: 1 |
| COMP_0006 | GROUP_0195 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 267 | `EUR`: 225 | 13 | `EUR`: 2 |
| COMP_0007 | GROUP_0064 | EUR | BDL | yes | `EUR`: 38; `USD`: 5 | `EUR`: 46; `USD`: 2 | `<unknown>`: 88; `EUR`: 5,280; `USD`: 809 | none | 0 | `<unknown>`: 1; `EUR`: 82; `USD`: 7 |
| COMP_0008 | GROUP_0195 | EUR | BIL | yes | `EUR`: 7; `USD`: 2 | none | `EUR`: 1,591; `USD`: 1 | `EUR`: 609 | 23 | `EUR`: 7; `USD`: 2 |
| COMP_0009 | GROUP_0225 | EUR | BDIL | yes | `EUR`: 7 | `EUR`: 4 | `EUR`: 1,219 | `CNY`: 21; `EUR`: 684; `GBP`: 2; `ZAR`: 14 | 24 | `EUR`: 11 |
| COMP_0010 | GROUP_0013 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 240 | `EUR`: 604 | 25 | `EUR`: 1 |
| COMP_0011 | GROUP_0234 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 105 | `EUR`: 56 | 8 | `EUR`: 4 |
| COMP_0012 | GROUP_0087 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 148 | none | 0 | `EUR`: 2 |
| COMP_0013 | GROUP_0203 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 2 | `EUR`: 788 | `EUR`: 1,524 | 20 | `EUR`: 6 |
| COMP_0014 | GROUP_0173 | CAD | BIL | yes | `CAD`: 1 | none | `CAD`: 2,758 | `CAD`: 4,599; `EUR`: 14; `USD`: 4 | 23 | `CAD`: 1 |
| COMP_0015 | GROUP_0068 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 28 | `EUR`: 13 | 9 | `EUR`: 1 |
| COMP_0016 | GROUP_0070 | EUR | BIL | no | `EUR`: 11 | none | `EUR`: 737 | `EUR`: 320 | 15 | `EUR`: 11 |
| COMP_0017 | GROUP_0073 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 74 | `EUR`: 54 | 18 | `EUR`: 1 |
| COMP_0018 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 340 | `EUR`: 371 | 24 | `EUR`: 1 |
| COMP_0019 | GROUP_0212 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 7,191 | none | 0 | `EUR`: 3 |
| COMP_0020 | GROUP_0007 | EUR | BDL | yes | `EUR`: 4; `GBP`: 1; `USD`: 1 | `EUR`: 2 | `EUR`: 241; `USD`: 65 | none | 0 | `EUR`: 6; `GBP`: 1; `USD`: 1 |
| COMP_0021 | GROUP_0023 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 101 | `EUR`: 89 | 15 | `EUR`: 1 |
| COMP_0022 | GROUP_0065 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 7,016 | `EUR`: 1,736 | 5 | `EUR`: 4 |
| COMP_0023 | GROUP_0237 | EUR | BDIL | yes | `EUR`: 3 | `EUR`: 4 | `EUR`: 2,444 | `CHF`: 5; `CZK`: 3; `DKK`: 30; `EUR`: 3,424; `GBP`: 121; `SEK`: 8; `USD`: 168 | 25 | `EUR`: 7 |
| COMP_0024 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,282 | `EUR`: 2,902 | 23 | `EUR`: 2 |
| COMP_0025 | GROUP_0211 | USD | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 3 | none | `EUR`: 26; `GBP`: 42; `USD`: 824 | `EUR`: 6; `GBP`: 69; `USD`: 846 | 25 | `EUR`: 1; `GBP`: 1; `USD`: 2 |
| COMP_0026 | GROUP_0236 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 652 | none | 0 | `EUR`: 2 |
| COMP_0027 | GROUP_0241 | EUR | BDIL | yes | `EUR`: 6; `USD`: 1 | `EUR`: 1 | `EUR`: 1,128; `USD`: 19 | `CAD`: 1; `EUR`: 3,310; `USD`: 20 | 13 | `EUR`: 7; `USD`: 1 |
| COMP_0028 | GROUP_0218 | EUR | BL | yes | `EUR`: 2; `USD`: 2 | none | `EUR`: 38 | none | 0 | `EUR`: 1; `USD`: 1 |
| COMP_0029 | GROUP_0013 | EUR | BIL | yes | `EUR`: 2; `SGD`: 2; `USD`: 2 | none | `EUR`: 6; `SGD`: 322; `USD`: 4 | `CNY`: 4; `EUR`: 59; `HKD`: 3; `MYR`: 24; `SGD`: 502; `USD`: 147 | 25 | `EUR`: 2; `SGD`: 2; `USD`: 2 |
| COMP_0030 | GROUP_0126 | EUR | BL | no | `BRL`: 3 | none | `BRL`: 4,210 | none | 0 | `BRL`: 3 |
| COMP_0031 | GROUP_0035 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 4,963 | `EUR`: 468 | 9 | `EUR`: 3 |
| COMP_0032 | GROUP_0094 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 31 | `EUR`: 17 | 10 | `EUR`: 1 |
| COMP_0033 | GROUP_0130 | EUR | B | no | `EUR`: 3 | none | `EUR`: 792 | none | 0 | none |
| COMP_0034 | GROUP_0172 | EUR | BDL | no | `EUR`: 11 | `EUR`: 1 | `EUR`: 5,889 | none | 0 | `EUR`: 12 |
| COMP_0035 | GROUP_0115 | EUR | BL | yes | `EUR`: 5; `USD`: 3 | none | `EUR`: 101; `USD`: 22 | none | 0 | `EUR`: 5; `USD`: 3 |
| COMP_0036 | GROUP_0103 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,171 | none | 0 | `EUR`: 1 |
| COMP_0037 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 564 | `EUR`: 555 | 20 | `EUR`: 2 |
| COMP_0038 | GROUP_0104 | EUR | BDIL | yes | `EUR`: 22; `USD`: 1 | `EUR`: 2 | `EUR`: 1,362; `USD`: 10 | `EUR`: 183 | 19 | `EUR`: 24; `USD`: 1 |
| COMP_0039 | GROUP_0225 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 416 | `EUR`: 91 | 24 | `EUR`: 2 |
| COMP_0040 | GROUP_0178 | EUR | BDSL | no | `EUR`: 8 | `EUR`: 2 | `EUR`: 81 | none | 0 | `EUR`: 10 |
| COMP_0041 | GROUP_0149 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 2 | `EUR`: 364 | `EUR`: 59 | 6 | `EUR`: 6 |
| COMP_0042 | GROUP_0162 | USD | BDIL | yes | `CAD`: 2; `EUR`: 3; `USD`: 15 | `USD`: 1 | `CAD`: 79; `EUR`: 38; `USD`: 3,252 | `CAD`: 45; `EUR`: 66; `USD`: 1,380 | 18 | `CAD`: 2; `EUR`: 3; `USD`: 14 |
| COMP_0043 | GROUP_0185 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 1,543; `USD`: 57 | `EUR`: 1,350; `GBP`: 12 | 16 | `EUR`: 2; `USD`: 1 |
| COMP_0044 | GROUP_0241 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 349 | `EUR`: 394 | 16 | `EUR`: 1 |
| COMP_0045 | GROUP_0242 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 187 | none | 0 | `EUR`: 1 |
| COMP_0046 | GROUP_0062 | EUR | BDL | no | `EUR`: 1 | `EUR`: 2 | `<unknown>`: 123 | none | 0 | `<unknown>`: 2; `EUR`: 1 |
| COMP_0047 | GROUP_0018 | EUR | BDSIL | no | `EUR`: 21 | `EUR`: 25 | `EUR`: 3,282 | `EUR`: 1,138 | 25 | `EUR`: 41 |
| COMP_0048 | GROUP_0241 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 3 | `EUR`: 739 | `EUR`: 1,711 | 12 | `EUR`: 4 |
| COMP_0049 | GROUP_0180 | EUR | BDIL | no | `EUR`: 13 | `EUR`: 3 | `EUR`: 2,781 | `EUR`: 1,912 | 25 | `EUR`: 16 |
| COMP_0050 | GROUP_0230 | USD | BIL | no | `USD`: 2 | none | `USD`: 142 | `USD`: 62 | 11 | `USD`: 2 |
| COMP_0051 | GROUP_0163 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 4 | `EUR`: 2,252 | `EUR`: 2,321 | 25 | `EUR`: 9 |
| COMP_0052 | GROUP_0142 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 405 | `EUR`: 77 | 8 | `EUR`: 2 |
| COMP_0053 | GROUP_0174 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 159 | `EUR`: 20 | 9 | `EUR`: 1 |
| COMP_0054 | GROUP_0217 | EUR | BIL | no | `EUR`: 9 | none | `EUR`: 1,117 | `EUR`: 668 | 24 | `EUR`: 9 |
| COMP_0055 | GROUP_0131 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 512; `USD`: 39 | `EUR`: 321; `GBP`: 1; `USD`: 46 | 13 | `EUR`: 2; `USD`: 1 |
| COMP_0056 | GROUP_0234 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 237 | `EUR`: 282 | 12 | `EUR`: 2 |
| COMP_0057 | GROUP_0122 | CAD | BIL | yes | `CAD`: 2 | none | `CAD`: 376 | `CAD`: 513; `EUR`: 97; `USD`: 31 | 14 | `CAD`: 2 |
| COMP_0058 | GROUP_0104 | EUR | BDSIL | yes | `EUR`: 22; `USD`: 1 | `EUR`: 34 | `EUR`: 4,988; `USD`: 18 | `EUR`: 4,360 | 25 | `EUR`: 56; `USD`: 1 |
| COMP_0059 | GROUP_0101 | EUR | BIL | yes | `EUR`: 3; `GBP`: 2; `USD`: 2 | none | `EUR`: 802; `GBP`: 36; `USD`: 170 | `CAD`: 31; `EUR`: 899; `GBP`: 103; `PLN`: 51; `SEK`: 66; `TRY`: 33; `USD`: 137 | 24 | `EUR`: 3; `GBP`: 2; `USD`: 2 |
| COMP_0060 | GROUP_0112 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 119 | `EUR`: 68; `GBP`: 3 | 16 | `EUR`: 1 |
| COMP_0061 | GROUP_0022 | EUR | BL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 2,087 | none | 0 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0062 | GROUP_0165 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 949 | none | 0 | `EUR`: 2 |
| COMP_0063 | GROUP_0011 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 855 | none | 0 | `EUR`: 1 |
| COMP_0064 | GROUP_0174 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 404 | `EUR`: 206 | 7 | `EUR`: 1 |
| COMP_0065 | GROUP_0139 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 9 | `EUR`: 1,136 | `EUR`: 1,041 | 25 | `EUR`: 15 |
| COMP_0066 | GROUP_0115 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 151 | none | 0 | `EUR`: 4 |
| COMP_0067 | GROUP_0064 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 25 | none | 0 | `EUR`: 2 |
| COMP_0068 | GROUP_0142 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 2,772 | `EUR`: 898 | 8 | `EUR`: 1 |
| COMP_0069 | GROUP_0175 | DKK | BIL | yes | `DKK`: 1 | none | `DKK`: 2,389 | `DKK`: 3,793; `EUR`: 54; `USD`: 11 | 10 | `DKK`: 1 |
| COMP_0070 | GROUP_0230 | EUR | BDIL | yes | `EUR`: 5; `USD`: 2 | `EUR`: 3 | `EUR`: 3,870; `USD`: 34 | `EUR`: 3,149; `USD`: 32 | 23 | `EUR`: 5; `USD`: 1 |
| COMP_0071 | GROUP_0102 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 4 | `EUR`: 218 | `EUR`: 321 | 21 | `EUR`: 7 |
| COMP_0072 | GROUP_0003 | GBP | BIL | yes | `EUR`: 1; `GBP`: 1 | none | `EUR`: 4; `GBP`: 62 | `EUR`: 5; `GBP`: 47 | 8 | `EUR`: 1; `GBP`: 1 |
| COMP_0073 | GROUP_0101 | EUR | BIL | yes | `EUR`: 4; `GBP`: 3; `PLN`: 1; `SEK`: 1; `USD`: 3 | none | `EUR`: 599; `GBP`: 91; `USD`: 266 | `EUR`: 745; `GBP`: 163; `PLN`: 27; `SEK`: 58; `TRY`: 32; `USD`: 167 | 25 | `EUR`: 3; `GBP`: 2; `USD`: 2 |
| COMP_0074 | GROUP_0088 | EUR | BDIL | no | `EUR`: 10 | `EUR`: 12 | `EUR`: 7,494 | `EUR`: 2,335 | 20 | `EUR`: 22 |
| COMP_0075 | GROUP_0115 | EUR | BDL | yes | `EUR`: 11; `USD`: 4 | `EUR`: 1 | `EUR`: 3,416; `USD`: 34 | none | 0 | `EUR`: 12; `USD`: 4 |
| COMP_0076 | GROUP_0146 | EUR | BDL | no | `EUR`: 1 | `EUR`: 3 | `EUR`: 119 | none | 0 | `EUR`: 4 |
| COMP_0077 | GROUP_0213 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 296 | `EUR`: 301 | 25 | `EUR`: 2 |
| COMP_0078 | GROUP_0246 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 3 | `EUR`: 323 | `EUR`: 1,121 | 24 | `EUR`: 4 |
| COMP_0079 | GROUP_0203 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 6 | `EUR`: 2,207 | `EUR`: 3,465 | 23 | `EUR`: 10 |
| COMP_0080 | GROUP_0112 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 83 | none | 0 | `EUR`: 1 |
| COMP_0081 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,315 | `EUR`: 1,221 | 23 | `EUR`: 1 |
| COMP_0082 | GROUP_0172 | EUR | BDL | no | `EUR`: 10 | `EUR`: 1 | `EUR`: 7,993 | none | 0 | `EUR`: 11 |
| COMP_0083 | GROUP_0133 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 39 | `EUR`: 6 | 5 | `EUR`: 4; `USD`: 1 |
| COMP_0084 | GROUP_0138 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 615 | none | 0 | `EUR`: 1 |
| COMP_0085 | GROUP_0155 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 864 | `EUR`: 404 | 24 | `EUR`: 1 |
| COMP_0086 | GROUP_0168 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 657 | none | 0 | `EUR`: 3 |
| COMP_0087 | GROUP_0065 | EUR | BDSL | no | `EUR`: 23 | `EUR`: 28 | `EUR`: 3,996 | none | 0 | `EUR`: 51 |
| COMP_0088 | GROUP_0172 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 1,957 | none | 0 | `EUR`: 4 |
| COMP_0089 | GROUP_0153 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 946 | `EUR`: 1,011 | 24 | `EUR`: 3 |
| COMP_0090 | GROUP_0116 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 111 | `EUR`: 29; `USD`: 4 | 21 | `EUR`: 2; `USD`: 1 |
| COMP_0091 | GROUP_0237 | EUR | BDIL | yes | `EUR`: 1 | `EUR`: 1 | `EUR`: 929 | `EUR`: 997; `GBP`: 1; `USD`: 1 | 21 | `EUR`: 2 |
| COMP_0092 | GROUP_0159 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 690 | none | 0 | `EUR`: 1 |
| COMP_0093 | GROUP_0149 | GBP | BI | yes | `GBP`: 1 | none | `GBP`: 124 | `EUR`: 1; `GBP`: 63 | 5 | none |
| COMP_0094 | GROUP_0021 | EUR | BDIL | yes | `EUR`: 11; `USD`: 1 | `EUR`: 9 | `EUR`: 1,997 | `EUR`: 2,609; `USD`: 1,234 | 25 | `EUR`: 20; `USD`: 1 |
| COMP_0095 | GROUP_0240 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 198 | `EUR`: 209 | 17 | `EUR`: 1 |
| COMP_0096 | GROUP_0217 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 138 | `EUR`: 38 | 10 | `EUR`: 3 |
| COMP_0097 | GROUP_0170 | USD | BL | no | `USD`: 1 | none | `USD`: 83 | none | 0 | `USD`: 1 |
| COMP_0098 | GROUP_0132 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 709 | `EUR`: 518 | 24 | `EUR`: 1 |
| COMP_0099 | GROUP_0238 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 6 | `EUR`: 2,702 | `EUR`: 2,084 | 25 | `EUR`: 9 |
| COMP_0100 | GROUP_0129 | EUR | BDIL | no | `EUR`: 11 | `EUR`: 7 | `EUR`: 707 | `EUR`: 251 | 24 | `EUR`: 18 |
| COMP_0101 | GROUP_0108 | EUR | BDIL | yes | `EUR`: 14; `USD`: 2 | `EUR`: 11 | `EUR`: 5,854; `USD`: 20 | `EUR`: 2,607 | 25 | `EUR`: 25; `USD`: 2 |
| COMP_0102 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 238 | none | 0 | `EUR`: 2 |
| COMP_0103 | GROUP_0170 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 249 | none | 0 | `EUR`: 1 |
| COMP_0104 | GROUP_0173 | NZD | BIL | yes | `NZD`: 2 | none | `NZD`: 603 | `AUD`: 1; `EUR`: 9; `NZD`: 605 | 23 | `NZD`: 2 |
| COMP_0105 | GROUP_0079 | EUR | BDSIL | yes | `EUR`: 2 | `EUR`: 1 | `EUR`: 2,221 | `EUR`: 2,217; `USD`: 5 | 24 | `EUR`: 3 |
| COMP_0106 | GROUP_0022 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 55 | `EUR`: 3 | 3 | `EUR`: 2 |
| COMP_0107 | GROUP_0094 | PEN | BIL | yes | `PEN`: 2; `USD`: 1 | none | `PEN`: 830; `USD`: 394 | `PEN`: 260; `USD`: 303 | 24 | `PEN`: 2; `USD`: 1 |
| COMP_0108 | GROUP_0179 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 366 | none | 0 | `EUR`: 1 |
| COMP_0109 | GROUP_0170 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 7,490 | none | 0 | `EUR`: 5 |
| COMP_0110 | GROUP_0008 | EUR | BIL | yes | `EUR`: 1; `NOK`: 2 | none | `EUR`: 141; `NOK`: 73 | `EUR`: 121; `NOK`: 164; `USD`: 3 | 10 | `EUR`: 1; `NOK`: 2 |
| COMP_0111 | GROUP_0243 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 392 | none | 0 | `EUR`: 1 |
| COMP_0112 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 788 | `EUR`: 793 | 23 | `EUR`: 2 |
| COMP_0113 | GROUP_0070 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 526 | `EUR`: 96 | 17 | `EUR`: 5 |
| COMP_0114 | GROUP_0044 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 105 | `EUR`: 16 | 5 | `EUR`: 1 |
| COMP_0115 | GROUP_0095 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 253 | none | 0 | `EUR`: 1 |
| COMP_0116 | GROUP_0195 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 543 | `EUR`: 270 | 24 | `EUR`: 2 |
| COMP_0117 | GROUP_0101 | EUR | BIL | yes | `EUR`: 2; `GBP`: 2; `USD`: 2 | none | `EUR`: 476; `GBP`: 53; `USD`: 464 | `CAD`: 40; `EUR`: 256; `GBP`: 49; `PLN`: 24; `SEK`: 29; `TRY`: 20; `USD`: 285 | 25 | `EUR`: 2; `GBP`: 2; `USD`: 2 |
| COMP_0118 | GROUP_0138 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 243 | none | 0 | `EUR`: 2 |
| COMP_0119 | GROUP_0048 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 1 | `EUR`: 1,322 | `EUR`: 2,266 | 21 | `EUR`: 8 |
| COMP_0120 | GROUP_0210 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 590 | `EUR`: 3,374 | 5 | `EUR`: 4 |
| COMP_0121 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 463 | none | 0 | `EUR`: 2 |
| COMP_0122 | GROUP_0086 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 8,979 | none | 0 | `EUR`: 1 |
| COMP_0123 | GROUP_0153 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 5 | `EUR`: 969 | `EUR`: 1,388 | 25 | `EUR`: 9 |
| COMP_0124 | GROUP_0136 | EUR | BIL | no | `EUR`: 7 | none | `EUR`: 380 | `EUR`: 488 | 24 | `EUR`: 6 |
| COMP_0125 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 102 | `EUR`: 146 | 24 | `EUR`: 1 |
| COMP_0126 | GROUP_0220 | EUR | BDIL | yes | `EUR`: 8 | `EUR`: 2 | `EUR`: 1,901 | `EUR`: 232; `GBP`: 29; `USD`: 12 | 23 | `EUR`: 10 |
| COMP_0127 | GROUP_0064 | EUR | BL | no | `BRL`: 1 | none | `BRL`: 24 | none | 0 | `BRL`: 1 |
| COMP_0128 | GROUP_0103 | EUR | BDL | no | `EUR`: 1 | `EUR`: 3 | `EUR`: 994 | none | 0 | `EUR`: 4 |
| COMP_0129 | GROUP_0185 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 942; `USD`: 4 | `EUR`: 437 | 21 | `EUR`: 3; `USD`: 1 |
| COMP_0130 | GROUP_0079 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 1,647 | `EUR`: 4,340; `USD`: 81 | 24 | `EUR`: 4 |
| COMP_0131 | GROUP_0070 | EUR | BIL | no | `EUR`: 2 | none | `<unknown>`: 22; `EUR`: 18 | `EUR`: 25 | 10 | `EUR`: 2 |
| COMP_0132 | GROUP_0104 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 700 | `EUR`: 615 | 24 | `EUR`: 6 |
| COMP_0133 | GROUP_0103 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 35 | none | 0 | `EUR`: 2 |
| COMP_0134 | GROUP_0169 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 115 | none | 0 | `EUR`: 1 |
| COMP_0135 | GROUP_0050 | EUR | BL | no | `USD`: 3 | none | `USD`: 1,233 | none | 0 | `USD`: 3 |
| COMP_0136 | GROUP_0142 | EUR | BDIL | no | `EUR`: 12 | `EUR`: 2 | `EUR`: 4,369 | `EUR`: 824 | 8 | `EUR`: 14 |
| COMP_0137 | GROUP_0217 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 145 | `EUR`: 43 | 11 | `EUR`: 5 |
| COMP_0138 | GROUP_0035 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 5 | `EUR`: 14,877 | `EUR`: 3,238 | 25 | `EUR`: 12 |
| COMP_0139 | GROUP_0217 | EUR | BIL | no | `EUR`: 13 | none | `EUR`: 552 | `EUR`: 733 | 23 | `EUR`: 13 |
| COMP_0140 | GROUP_0072 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 5,447 | `EUR`: 1,143 | 21 | `EUR`: 5 |
| COMP_0141 | GROUP_0220 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 864 | `EUR`: 50 | 6 | `EUR`: 2 |
| COMP_0142 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 2,533 | `EUR`: 2,164 | 24 | `EUR`: 1 |
| COMP_0143 | GROUP_0146 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 302 | `EUR`: 159 | 9 | `EUR`: 4 |
| COMP_0144 | GROUP_0236 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 868 | none | 0 | `EUR`: 1 |
| COMP_0145 | GROUP_0007 | GBP | BL | yes | `EUR`: 1; `GBP`: 1; `MXN`: 1; `PHP`: 1; `USD`: 1 | none | `GBP`: 12; `MXN`: 13; `USD`: 2,309 | none | 0 | `EUR`: 1; `GBP`: 1; `MXN`: 1; `PHP`: 1; `USD`: 1 |
| COMP_0146 | GROUP_0020 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 93 | none | 0 | `EUR`: 1 |
| COMP_0147 | GROUP_0227 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 748 | `EUR`: 4 | 4 | `EUR`: 1 |
| COMP_0148 | GROUP_0016 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 49 | none | 0 | `EUR`: 1 |
| COMP_0149 | GROUP_0132 | ARS | BIL | yes | `ARS`: 2 | none | `ARS`: 1,687 | `ARS`: 1,527; `COP`: 1; `EUR`: 10; `USD`: 19 | 24 | `ARS`: 2 |
| COMP_0150 | GROUP_0081 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 2,652 | `EUR`: 651 | 16 | `EUR`: 7 |
| COMP_0151 | GROUP_0101 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 172 | `EUR`: 77; `GBP`: 6; `USD`: 12 | 22 | `EUR`: 3 |
| COMP_0152 | GROUP_0037 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 2,298; `USD`: 6 | `EUR`: 1,984; `USD`: 4 | 21 | `EUR`: 2; `USD`: 1 |
| COMP_0153 | GROUP_0115 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 96 | none | 0 | `EUR`: 1 |
| COMP_0154 | GROUP_0003 | GBP | BIL | no | `GBP`: 1 | none | `GBP`: 37 | `GBP`: 10 | 6 | `GBP`: 1 |
| COMP_0155 | GROUP_0143 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 510 | `EUR`: 327 | 24 | `EUR`: 1 |
| COMP_0156 | GROUP_0187 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 2,563 | none | 0 | `EUR`: 2 |
| COMP_0157 | GROUP_0146 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 282 | none | 0 | `EUR`: 3 |
| COMP_0158 | GROUP_0001 | USD | BL | no | `USD`: 3 | none | `USD`: 520 | none | 0 | `USD`: 3 |
| COMP_0159 | GROUP_0102 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 222 | `EUR`: 43 | 8 | `EUR`: 2 |
| COMP_0160 | GROUP_0106 | EUR | BDL | no | `EUR`: 5 | `EUR`: 3 | `EUR`: 1,743 | none | 0 | `EUR`: 8 |
| COMP_0161 | GROUP_0079 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 244 | `EUR`: 316 | 13 | `EUR`: 2 |
| COMP_0162 | GROUP_0095 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 306 | none | 0 | `EUR`: 3 |
| COMP_0163 | GROUP_0094 | MXN | BIL | yes | `MXN`: 2; `USD`: 2 | none | `MXN`: 1,418; `USD`: 68 | `MXN`: 1,449; `USD`: 121 | 25 | `MXN`: 1; `USD`: 1 |
| COMP_0164 | GROUP_0154 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 559 | `EUR`: 201 | 24 | `EUR`: 4 |
| COMP_0165 | GROUP_0035 | EUR | BDL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 74 | none | 0 | `EUR`: 2 |
| COMP_0166 | GROUP_0149 | GBP | BI | yes | `EUR`: 1; `GBP`: 1 | none | `EUR`: 8; `GBP`: 123 | `EUR`: 1; `GBP`: 818 | 6 | none |
| COMP_0167 | GROUP_0218 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 676; `USD`: 68 | `EUR`: 544; `USD`: 109 | 25 | `EUR`: 4; `USD`: 1 |
| COMP_0168 | GROUP_0061 | MYR | BDIL | yes | `MYR`: 1 | `EUR`: 1 | `EUR`: 2; `MYR`: 143 | `AUD`: 7; `EUR`: 10; `GBP`: 1; `HKD`: 2; `JPY`: 2; `MYR`: 75; `NZD`: 1; `PHP`: 1; `SGD`: 1; `USD`: 2,062 | 13 | `EUR`: 1; `MYR`: 1 |
| COMP_0169 | GROUP_0090 | EUR | BDIL | yes | `EUR`: 5; `USD`: 1 | `EUR`: 10 | `EUR`: 6,235 | `EUR`: 3,594; `GBP`: 8 | 22 | `EUR`: 13; `USD`: 1 |
| COMP_0170 | GROUP_0128 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 55 | none | 0 | `EUR`: 1 |
| COMP_0171 | GROUP_0048 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 59 | `EUR`: 62 | 7 | `EUR`: 1 |
| COMP_0172 | GROUP_0212 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 4,435 | none | 0 | `EUR`: 3 |
| COMP_0173 | GROUP_0019 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 9 | `EUR`: 1,623 | `EUR`: 2,995 | 24 | `EUR`: 13 |
| COMP_0174 | GROUP_0017 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 874 | none | 0 | `EUR`: 4 |
| COMP_0175 | GROUP_0143 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 14,752 | none | 0 | `EUR`: 2 |
| COMP_0176 | GROUP_0225 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 270 | `EUR`: 134 | 22 | `EUR`: 2 |
| COMP_0177 | GROUP_0185 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 905; `USD`: 20 | `EUR`: 291; `GBP`: 6 | 16 | `EUR`: 2; `USD`: 1 |
| COMP_0178 | GROUP_0220 | EUR | BDIL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | `EUR`: 1 | `EUR`: 726; `GBP`: 288; `USD`: 79 | `EUR`: 48; `GBP`: 5; `USD`: 3 | 15 | `EUR`: 3; `GBP`: 1; `USD`: 1 |
| COMP_0179 | GROUP_0017 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 755 | none | 0 | `EUR`: 3 |
| COMP_0180 | GROUP_0055 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 15 | `EUR`: 2,400 | `EUR`: 2,851 | 25 | `EUR`: 21 |
| COMP_0181 | GROUP_0045 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 2,505 | `EUR`: 1,594 | 25 | `EUR`: 5 |
| COMP_0182 | GROUP_0179 | EUR | BL | yes | `EUR`: 14; `USD`: 2 | none | `EUR`: 4,599; `USD`: 11 | none | 0 | `EUR`: 7; `USD`: 1 |
| COMP_0183 | GROUP_0232 | EUR | BDIL | no | `EUR`: 11 | `EUR`: 1 | `EUR`: 184 | `EUR`: 189 | 9 | `EUR`: 12 |
| COMP_0184 | GROUP_0044 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 167 | `EUR`: 302 | 14 | `EUR`: 1 |
| COMP_0185 | GROUP_0044 | EUR | BDIL | yes | `EUR`: 8; `USD`: 2 | `EUR`: 2 | `EUR`: 3,084; `USD`: 143 | `AED`: 5; `BRL`: 12; `EUR`: 4,147; `GBP`: 1; `MXN`: 2; `PLN`: 2; `USD`: 441 | 25 | `<unknown>`: 1; `EUR`: 10; `USD`: 2 |
| COMP_0186 | GROUP_0142 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,668 | `EUR`: 61 | 8 | `EUR`: 3 |
| COMP_0187 | GROUP_0044 | PLN | BIL | no | `PLN`: 1 | none | `PLN`: 30 | `PLN`: 10 | 3 | `PLN`: 1 |
| COMP_0188 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 493 | none | 0 | `EUR`: 2 |
| COMP_0189 | GROUP_0211 | GBP | BIL | yes | `EUR`: 2; `GBP`: 2; `USD`: 2 | none | `EUR`: 97; `GBP`: 135; `USD`: 61 | `EUR`: 145; `GBP`: 339; `USD`: 92 | 23 | `EUR`: 2; `GBP`: 2; `USD`: 2 |
| COMP_0190 | GROUP_0182 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 975 | `EUR`: 743; `USD`: 1 | 24 | `EUR`: 4 |
| COMP_0191 | GROUP_0132 | GBP | BIL | yes | `GBP`: 2 | none | `GBP`: 1,540 | `EUR`: 88; `GBP`: 1,432; `USD`: 127 | 25 | `GBP`: 2 |
| COMP_0192 | GROUP_0048 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 2,560 | `EUR`: 1,831 | 18 | `EUR`: 5 |
| COMP_0193 | GROUP_0224 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 1 | `EUR`: 6,796 | `EUR`: 1,409 | 25 | `EUR`: 7 |
| COMP_0194 | GROUP_0035 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 115 | `EUR`: 24 | 21 | `EUR`: 1 |
| COMP_0195 | GROUP_0065 | EUR | BDL | no | `EUR`: 9 | `EUR`: 3 | `EUR`: 2,260 | none | 0 | `EUR`: 12 |
| COMP_0196 | GROUP_0199 | EUR | BL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 716; `USD`: 28 | none | 0 | `EUR`: 2; `USD`: 1 |
| COMP_0197 | GROUP_0035 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 61 | `EUR`: 62 | 24 | `EUR`: 2 |
| COMP_0198 | GROUP_0037 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 67 | `EUR`: 78 | 22 | `EUR`: 2 |
| COMP_0199 | GROUP_0179 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 301 | none | 0 | `EUR`: 2 |
| COMP_0200 | GROUP_0224 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 825 | `EUR`: 1,117 | 25 | `EUR`: 5 |
| COMP_0201 | GROUP_0101 | EUR | BIL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | none | `EUR`: 765; `GBP`: 104; `USD`: 489 | `CAD`: 56; `EUR`: 831; `GBP`: 166; `PLN`: 57; `SEK`: 63; `TRY`: 36; `USD`: 299 | 25 | `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_0202 | GROUP_0194 | AED | BL | no | `AED`: 1 | none | `AED`: 718 | none | 0 | `AED`: 1 |
| COMP_0203 | GROUP_0016 | EUR | BDSIL | yes | `EUR`: 16 | `EUR`: 12 | `EUR`: 9,669 | `EUR`: 3,141; `GBP`: 13; `MXN`: 2; `NAD`: 1; `USD`: 31; `ZAR`: 7 | 25 | `EUR`: 28 |
| COMP_0204 | GROUP_0052 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 58 | `EUR`: 55 | 9 | `EUR`: 1 |
| COMP_0205 | GROUP_0175 | USD | BIL | yes | `USD`: 2 | none | `USD`: 486 | `EUR`: 10; `USD`: 297 | 11 | `USD`: 2 |
| COMP_0206 | GROUP_0239 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 2,653 | none | 0 | `EUR`: 1 |
| COMP_0207 | GROUP_0153 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 917 | `EUR`: 747 | 23 | `EUR`: 3 |
| COMP_0208 | GROUP_0003 | GBP | BIL | no | `GBP`: 1 | none | `GBP`: 438 | `GBP`: 2,700 | 23 | `GBP`: 1 |
| COMP_0209 | GROUP_0221 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 340 | `EUR`: 195 | 23 | `EUR`: 1 |
| COMP_0210 | GROUP_0117 | EUR | BDIL | yes | `EUR`: 5 | `EUR`: 6 | `EUR`: 619 | `EUR`: 172; `USD`: 10 | 11 | `EUR`: 11 |
| COMP_0211 | GROUP_0243 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 301 | none | 0 | `EUR`: 1 |
| COMP_0212 | GROUP_0199 | SEK | BL | yes | `EUR`: 2; `SEK`: 1; `USD`: 2 | none | `EUR`: 40; `SEK`: 40; `USD`: 12 | none | 0 | `EUR`: 2; `SEK`: 1; `USD`: 2 |
| COMP_0213 | GROUP_0170 | NZD | BL | no | `NZD`: 2 | none | `NZD`: 2,405 | none | 0 | `NZD`: 2 |
| COMP_0214 | GROUP_0112 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 80 | none | 0 | `EUR`: 1 |
| COMP_0215 | GROUP_0070 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 61 | `EUR`: 36 | 10 | `EUR`: 4 |
| COMP_0216 | GROUP_0067 | EUR | BDL | no | `EUR`: 5 | `EUR`: 8 | `EUR`: 9,893 | none | 0 | `EUR`: 13 |
| COMP_0217 | GROUP_0087 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 56 | none | 0 | `EUR`: 2 |
| COMP_0218 | GROUP_0113 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 312 | `EUR`: 106 | 18 | `EUR`: 5 |
| COMP_0219 | GROUP_0132 | BRL | BIL | yes | `BRL`: 3 | none | `BRL`: 8,940 | `BRL`: 3,115; `EUR`: 12 | 25 | `BRL`: 3 |
| COMP_0220 | GROUP_0124 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 12 | `EUR`: 1,435 | `EUR`: 1,162 | 24 | `EUR`: 17 |
| COMP_0221 | GROUP_0138 | EUR | BDL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 1,143 | none | 0 | `EUR`: 2 |
| COMP_0222 | GROUP_0064 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 491 | none | 0 | `EUR`: 1 |
| COMP_0223 | GROUP_0078 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 44 | none | 0 | `EUR`: 2 |
| COMP_0224 | GROUP_0234 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 239 | none | 0 | `EUR`: 2 |
| COMP_0225 | GROUP_0118 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 2,092 | `EUR`: 155 | 7 | `EUR`: 2 |
| COMP_0226 | GROUP_0013 | EUR | BIL | no | `BRL`: 1 | none | `BRL`: 238 | `BRL`: 1,567 | 24 | `BRL`: 1 |
| COMP_0227 | GROUP_0092 | EUR | BDL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 1,840 | none | 0 | `EUR`: 5 |
| COMP_0228 | GROUP_0081 | EUR | BDIL | no | `EUR`: 13 | `EUR`: 2 | `EUR`: 6,877 | `EUR`: 1,636 | 16 | `EUR`: 15 |
| COMP_0229 | GROUP_0101 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 25 | `EUR`: 1 | 1 | `EUR`: 1 |
| COMP_0230 | GROUP_0213 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 89 | none | 0 | `EUR`: 2 |
| COMP_0231 | GROUP_0108 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 648; `USD`: 31 | `EUR`: 675; `USD`: 60 | 22 | `EUR`: 4; `USD`: 1 |
| COMP_0232 | GROUP_0038 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 127 | `EUR`: 284 | 17 | `EUR`: 2 |
| COMP_0233 | GROUP_0150 | EUR | BL | yes | `CLP`: 3; `EUR`: 2; `USD`: 2 | none | `CLP`: 3,740; `USD`: 690 | none | 0 | `CLP`: 3; `EUR`: 2; `USD`: 2 |
| COMP_0234 | GROUP_0101 | EUR | BIL | yes | `EUR`: 13; `GBP`: 1; `USD`: 1 | none | `EUR`: 4,210; `GBP`: 360; `USD`: 218 | `EUR`: 2,005; `GBP`: 60; `HKD`: 1; `USD`: 936 | 25 | `EUR`: 13; `GBP`: 1; `USD`: 1 |
| COMP_0235 | GROUP_0028 | EUR | BDL | yes | `EUR`: 4; `USD`: 1 | `EUR`: 29 | `EUR`: 14,477; `USD`: 7 | none | 0 | `EUR`: 33; `USD`: 1 |
| COMP_0236 | GROUP_0243 | EUR | BL | yes | `CHF`: 1; `EUR`: 3; `GBP`: 2; `PLN`: 2; `USD`: 1 | none | `CHF`: 4; `EUR`: 5,024; `GBP`: 19; `USD`: 2 | none | 0 | `CHF`: 1; `EUR`: 3; `GBP`: 2; `PLN`: 1; `USD`: 1 |
| COMP_0237 | GROUP_0044 | GBP | BIL | no | `GBP`: 2 | none | `GBP`: 172 | `GBP`: 90 | 10 | `GBP`: 2 |
| COMP_0238 | GROUP_0149 | EUR | BIL | yes | `EUR`: 6 | none | `EUR`: 752 | `EUR`: 556; `GBP`: 6; `USD`: 5 | 18 | `EUR`: 6 |
| COMP_0239 | GROUP_0202 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 498 | `EUR`: 353 | 25 | `EUR`: 1 |
| COMP_0240 | GROUP_0009 | CAD | BL | yes | `CAD`: 2; `USD`: 2 | none | `CAD`: 50; `USD`: 23 | none | 0 | `CAD`: 2; `USD`: 2 |
| COMP_0241 | GROUP_0050 | EUR | BL | yes | `AUD`: 1; `EUR`: 3; `GBP`: 1; `USD`: 1 | none | `EUR`: 6,103; `GBP`: 42 | none | 0 | `AUD`: 1; `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_0242 | GROUP_0108 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 31 | `EUR`: 82 | 7 | `EUR`: 1 |
| COMP_0243 | GROUP_0170 | EUR | BL | no | `EUR`: 9 | none | `EUR`: 9,873 | none | 0 | `EUR`: 9 |
| COMP_0244 | GROUP_0212 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 4,071 | none | 0 | `EUR`: 3 |
| COMP_0245 | GROUP_0096 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 226 | `EUR`: 53 | 14 | `EUR`: 1 |
| COMP_0246 | GROUP_0213 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 2 | `EUR`: 2,622 | `EUR`: 4,995 | 25 | `EUR`: 9 |
| COMP_0247 | GROUP_0218 | EUR | BIL | yes | `DKK`: 1; `NOK`: 1; `SEK`: 1; `USD`: 2 | none | `NOK`: 1; `SEK`: 1; `USD`: 1,173 | `EUR`: 188; `USD`: 493 | 23 | `DKK`: 1; `NOK`: 1; `SEK`: 1; `USD`: 2 |
| COMP_0248 | GROUP_0095 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 41 | `EUR`: 4,050 | `EUR`: 3,794 | 24 | `EUR`: 48 |
| COMP_0249 | GROUP_0194 | GBP | BL | yes | `EUR`: 1; `GBP`: 3; `USD`: 1 | none | `EUR`: 2; `GBP`: 491 | none | 0 | `EUR`: 1; `GBP`: 3; `USD`: 1 |
| COMP_0250 | GROUP_0065 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 1,463 | `EUR`: 597 | 18 | `EUR`: 5 |
| COMP_0251 | GROUP_0170 | PEN | BL | no | `PEN`: 1 | none | `PEN`: 639 | none | 0 | `PEN`: 1 |
| COMP_0252 | GROUP_0179 | EUR | BL | yes | `AED`: 2; `CHF`: 4; `CZK`: 5; `DKK`: 4; `EUR`: 8; `GBP`: 4; `HUF`: 3; `NOK`: 4; `PLN`: 4; `RON`: 3; `SEK`: 4; `USD`: 4 | none | `CHF`: 293; `DKK`: 2; `EUR`: 1,520; `GBP`: 639; `NOK`: 193; `PLN`: 141; `SEK`: 366; `USD`: 331 | none | 0 | `AED`: 2; `CHF`: 4; `CZK`: 4; `DKK`: 3; `EUR`: 8; `GBP`: 4; `HUF`: 3; `NOK`: 4; `PLN`: 4; `RON`: 3; `SEK`: 4; `USD`: 4 |
| COMP_0253 | GROUP_0055 | EUR | BIL | yes | `EUR`: 3; `GBP`: 1; `USD`: 1 | none | `EUR`: 583 | `EUR`: 462; `USD`: 63 | 25 | `EUR`: 3; `GBP`: 1; `USD`: 1 |
| COMP_0254 | GROUP_0158 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,488 | none | 0 | `EUR`: 3 |
| COMP_0255 | GROUP_0025 | EUR | BDIL | no | `EUR`: 15 | `EUR`: 4 | `EUR`: 3,024 | `EUR`: 4,517 | 15 | `EUR`: 19 |
| COMP_0256 | GROUP_0170 | USD | BL | no | `USD`: 3 | none | `USD`: 214 | none | 0 | `USD`: 3 |
| COMP_0257 | GROUP_0023 | EUR | BIL | yes | `EUR`: 6; `USD`: 2 | none | `EUR`: 3,790; `USD`: 33 | `EUR`: 4,573 | 25 | `EUR`: 6; `USD`: 2 |
| COMP_0258 | GROUP_0078 | EUR | BDSL | no | `EUR`: 3 | `EUR`: 4 | `EUR`: 159 | none | 0 | `EUR`: 7 |
| COMP_0259 | GROUP_0198 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 106 | `EUR`: 53 | 13 | `EUR`: 2 |
| COMP_0260 | GROUP_0087 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 49 | none | 0 | `EUR`: 2 |
| COMP_0261 | GROUP_0086 | EUR | BDL | no | `EUR`: 1 | `EUR`: 5 | `EUR`: 303 | none | 0 | `EUR`: 6 |
| COMP_0262 | GROUP_0211 | USD | BIL | yes | `CAD`: 1; `EUR`: 2; `GBP`: 1; `USD`: 3 | none | `CAD`: 37; `EUR`: 1,012; `GBP`: 133; `USD`: 4,561 | `AUD`: 9; `EUR`: 289; `GBP`: 93; `NZD`: 4; `USD`: 2,565 | 25 | `CAD`: 1; `EUR`: 2; `GBP`: 1; `USD`: 3 |
| COMP_0263 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 98 | `EUR`: 139 | 24 | `EUR`: 1 |
| COMP_0264 | GROUP_0066 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 369 | `EUR`: 3 | 1 | `EUR`: 1 |
| COMP_0265 | GROUP_0033 | EUR | BIL | yes | `EUR`: 5; `GBP`: 2; `USD`: 1 | none | `EUR`: 540; `GBP`: 3 | `CHF`: 1; `EUR`: 368; `GBP`: 3; `USD`: 2 | 22 | `EUR`: 5; `GBP`: 1 |
| COMP_0266 | GROUP_0016 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,482 | none | 0 | `EUR`: 2 |
| COMP_0267 | GROUP_0155 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,291 | `EUR`: 1,416 | 25 | `EUR`: 2 |
| COMP_0268 | GROUP_0094 | GBP | BIL | yes | `AUD`: 1; `CAD`: 1; `EUR`: 2; `GBP`: 2; `USD`: 1 | none | `AUD`: 203; `CAD`: 214; `EUR`: 311; `GBP`: 2,917; `USD`: 236 | `AUD`: 202; `CAD`: 233; `EUR`: 184; `GBP`: 2,810; `USD`: 407 | 25 | `AUD`: 1; `CAD`: 1; `EUR`: 2; `GBP`: 2; `USD`: 1 |
| COMP_0269 | GROUP_0156 | EUR | BDIL | yes | `EUR`: 7; `GBP`: 1; `USD`: 1 | `EUR`: 10 | `EUR`: 1,534; `GBP`: 1; `USD`: 1 | `EUR`: 2; `GBP`: 8; `USD`: 8 | 2 | `EUR`: 17; `GBP`: 1; `USD`: 1 |
| COMP_0270 | GROUP_0116 | EUR | BIL | yes | `EUR`: 4; `USD`: 3 | none | `EUR`: 216; `USD`: 327 | `DKK`: 2; `EUR`: 409; `GBP`: 64; `USD`: 446 | 24 | `EUR`: 4; `USD`: 3 |
| COMP_0271 | GROUP_0138 | EUR | BDL | yes | `EUR`: 19; `USD`: 2 | `EUR`: 8 | `EUR`: 19,243; `USD`: 7 | none | 0 | `EUR`: 27; `USD`: 2 |
| COMP_0272 | GROUP_0017 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 181 | none | 0 | `EUR`: 4 |
| COMP_0273 | GROUP_0155 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 178 | `EUR`: 26 | 10 | `EUR`: 2 |
| COMP_0274 | GROUP_0097 | EUR | BL | yes | `EUR`: 3; `USD`: 3 | none | `EUR`: 76; `USD`: 88 | none | 0 | `EUR`: 3; `USD`: 3 |
| COMP_0275 | GROUP_0060 | USD | BIL | yes | `CHF`: 1; `EUR`: 1; `USD`: 1 | none | `CHF`: 38; `EUR`: 63; `USD`: 24 | `CHF`: 46; `EUR`: 97; `USD`: 11 | 11 | `CHF`: 1; `EUR`: 1; `USD`: 1 |
| COMP_0276 | GROUP_0199 | AOA | BL | no | `AOA`: 6 | none | `AOA`: 932 | none | 0 | `AOA`: 6 |
| COMP_0277 | GROUP_0236 | EUR | BDL | yes | `EUR`: 16; `USD`: 1 | `EUR`: 2 | `EUR`: 1,432; `USD`: 2 | none | 0 | `EUR`: 18; `USD`: 1 |
| COMP_0278 | GROUP_0162 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 1,757 | `EUR`: 2,048; `USD`: 2 | 25 | `EUR`: 4 |
| COMP_0279 | GROUP_0022 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 72 | `EUR`: 50 | 22 | `EUR`: 2; `USD`: 1 |
| COMP_0280 | GROUP_0107 | GBP | BIL | yes | `EUR`: 1; `GBP`: 2; `USD`: 1 | none | `EUR`: 79; `GBP`: 1,403; `USD`: 307 | `AUD`: 7; `CHF`: 2; `EUR`: 27; `GBP`: 306; `INR`: 3; `ISK`: 10; `JPY`: 9; `SGD`: 1; `USD`: 174; `ZAR`: 8 | 9 | `EUR`: 1; `GBP`: 2; `USD`: 1 |
| COMP_0281 | GROUP_0127 | EUR | BDL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 2,591 | none | 0 | `EUR`: 6 |
| COMP_0282 | GROUP_0187 | EUR | BL | no | `EUR`: 36 | none | `EUR`: 8,704 | none | 0 | `EUR`: 35 |
| COMP_0283 | GROUP_0089 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 10,521 | `CHF`: 1; `EUR`: 461; `GBP`: 1; `USD`: 10 | 11 | `EUR`: 4; `USD`: 1 |
| COMP_0284 | GROUP_0163 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 46 | `EUR`: 28 | 11 | `EUR`: 2 |
| COMP_0285 | GROUP_0205 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 60 | none | 0 | `EUR`: 1 |
| COMP_0286 | GROUP_0203 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 4 | `EUR`: 246 | `EUR`: 51 | 5 | `EUR`: 8 |
| COMP_0287 | GROUP_0231 | EUR | BDIL | yes | `EUR`: 2; `USD`: 1 | `EUR`: 1 | `EUR`: 105; `USD`: 56 | `EUR`: 43; `USD`: 76 | 24 | `EUR`: 3; `USD`: 1 |
| COMP_0288 | GROUP_0075 | EUR | BDL | yes | `EUR`: 9; `USD`: 1 | `EUR`: 1 | `EUR`: 3,062 | none | 0 | `EUR`: 8 |
| COMP_0289 | GROUP_0142 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 3 | `EUR`: 1,153 | `EUR`: 367 | 8 | `<unknown>`: 1; `EUR`: 9 |
| COMP_0290 | GROUP_0053 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,682 | `EUR`: 4,588 | 21 | `EUR`: 2 |
| COMP_0291 | GROUP_0104 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 201 | `EUR`: 193 | 18 | `EUR`: 5 |
| COMP_0292 | GROUP_0199 | GHS | BL | yes | `EUR`: 11; `GHS`: 15; `USD`: 12; `XOF`: 1 | none | `EUR`: 16; `GHS`: 1,145; `USD`: 5 | none | 0 | `EUR`: 2; `GHS`: 4; `USD`: 3 |
| COMP_0293 | GROUP_0126 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 2 | `EUR`: 1,431 | `EUR`: 321 | 24 | `EUR`: 8 |
| COMP_0294 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 57 | `EUR`: 33 | 11 | `EUR`: 1 |
| COMP_0295 | GROUP_0039 | EUR | BIL | no | `EUR`: 7 | none | `EUR`: 345 | `EUR`: 293 | 10 | `EUR`: 7 |
| COMP_0296 | GROUP_0199 | EUR | BL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 62; `USD`: 1 | none | 0 | `EUR`: 1; `USD`: 1 |
| COMP_0297 | GROUP_0011 | EUR | BDL | no | `EUR`: 4 | `EUR`: 3 | `EUR`: 416 | none | 0 | `EUR`: 7 |
| COMP_0298 | GROUP_0063 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 325 | none | 0 | `EUR`: 4 |
| COMP_0299 | GROUP_0087 | EUR | BL | yes | `EUR`: 2; `USD`: 2 | none | `EUR`: 691; `USD`: 121 | none | 0 | `EUR`: 2; `USD`: 2 |
| COMP_0300 | GROUP_0144 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 729; `USD`: 165 | `EUR`: 365 | 23 | `EUR`: 2; `USD`: 1 |
| COMP_0301 | GROUP_0009 | EUR | BL | yes | `AUD`: 1; `EUR`: 2; `USD`: 4 | none | `AUD`: 2; `EUR`: 182; `USD`: 694 | none | 0 | `EUR`: 2; `USD`: 4 |
| COMP_0302 | GROUP_0243 | PLN | BL | yes | `EUR`: 2; `GBP`: 1; `PLN`: 2; `USD`: 1 | none | `EUR`: 224; `PLN`: 15; `USD`: 2 | none | 0 | `EUR`: 2; `PLN`: 2; `USD`: 1 |
| COMP_0303 | GROUP_0239 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 4,713 | none | 0 | `EUR`: 5 |
| COMP_0304 | GROUP_0127 | EUR | BDL | no | `EUR`: 4 | `EUR`: 2 | `EUR`: 3,526 | none | 0 | `EUR`: 6 |
| COMP_0305 | GROUP_0184 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 13,834 | none | 0 | `EUR`: 4 |
| COMP_0306 | GROUP_0094 | COP | BIL | yes | `COP`: 1 | none | `COP`: 2,354 | `BRL`: 3; `CLP`: 4; `COP`: 1,797; `MXN`: 1; `USD`: 45 | 25 | `COP`: 1 |
| COMP_0307 | GROUP_0112 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 239 | `EUR`: 133 | 16 | `EUR`: 1 |
| COMP_0308 | GROUP_0250 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 2,020 | `EUR`: 3,893 | 25 | `EUR`: 3 |
| COMP_0309 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 97 | `EUR`: 145 | 24 | `EUR`: 1 |
| COMP_0310 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 447 | none | 0 | `EUR`: 2 |
| COMP_0311 | GROUP_0175 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 1,653 | `AUD`: 5; `CHF`: 3; `DKK`: 37; `EUR`: 1,798; `GBP`: 7; `PLN`: 6; `SEK`: 2; `USD`: 50 | 21 | `EUR`: 3 |
| COMP_0312 | GROUP_0194 | EUR | B | no | `EUR`: 1 | none | `EUR`: 1,684 | none | 0 | none |
| COMP_0313 | GROUP_0094 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 708; `GBP`: 4; `USD`: 93 | `CLP`: 3; `COP`: 6; `EUR`: 397; `GBP`: 23; `MXN`: 1; `PEN`: 3; `USD`: 52 | 22 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0314 | GROUP_0101 | EUR | BIL | yes | `AUD`: 1; `CAD`: 1; `EUR`: 2; `GBP`: 2; `SEK`: 1; `USD`: 2 | none | `CAD`: 54; `EUR`: 373; `GBP`: 356; `SEK`: 2; `USD`: 342 | `AUD`: 14; `CAD`: 44; `EUR`: 578; `GBP`: 200; `JPY`: 1; `PLN`: 65; `SEK`: 132; `SGD`: 6; `TRY`: 31; `USD`: 230 | 24 | `AUD`: 1; `CAD`: 1; `EUR`: 2; `GBP`: 2; `SEK`: 1; `USD`: 2 |
| COMP_0315 | GROUP_0064 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 38 | none | 0 | `EUR`: 1 |
| COMP_0316 | GROUP_0150 | EUR | BIL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | none | `EUR`: 1,223; `USD`: 24 | `EUR`: 973 | 25 | `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_0317 | GROUP_0170 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 51 | none | 0 | `EUR`: 1 |
| COMP_0318 | GROUP_0226 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 339 | `EUR`: 95 | 15 | `EUR`: 2 |
| COMP_0319 | GROUP_0184 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 13,325 | none | 0 | `EUR`: 3 |
| COMP_0320 | GROUP_0246 | EUR | BDIL | yes | `EUR`: 3; `USD`: 1 | `EUR`: 2 | `EUR`: 479; `USD`: 1 | `EUR`: 312 | 25 | `EUR`: 5; `USD`: 1 |
| COMP_0321 | GROUP_0159 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 3,081 | none | 0 | `<unknown>`: 1; `EUR`: 4 |
| COMP_0322 | GROUP_0108 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 1,010 | `EUR`: 1,319; `GBP`: 8 | 24 | `EUR`: 4 |
| COMP_0323 | GROUP_0122 | USD | BIL | yes | `USD`: 3 | none | `USD`: 564 | `BRL`: 2; `CAD`: 20; `CLP`: 5; `COP`: 32; `EUR`: 22; `GBP`: 3; `MXN`: 42; `USD`: 3,401 | 16 | `USD`: 3 |
| COMP_0324 | GROUP_0138 | EUR | BL | no | `EUR`: 14 | none | `EUR`: 6,300 | none | 0 | `EUR`: 14 |
| COMP_0325 | GROUP_0101 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 21 | `EUR`: 1 | 1 | `EUR`: 1 |
| COMP_0326 | GROUP_0018 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 10 | `EUR`: 4,956 | `EUR`: 4,013 | 19 | `EUR`: 16 |
| COMP_0327 | GROUP_0130 | EUR | B | no | `EUR`: 1 | none | `EUR`: 962 | none | 0 | none |
| COMP_0328 | GROUP_0136 | EUR | BIL | no | `EUR`: 7 | none | `EUR`: 299 | `EUR`: 288 | 9 | `EUR`: 6 |
| COMP_0329 | GROUP_0161 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 996 | none | 0 | `EUR`: 2 |
| COMP_0330 | GROUP_0088 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 255 | `EUR`: 929 | 18 | `EUR`: 3 |
| COMP_0331 | GROUP_0096 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 30 | `EUR`: 8 | 6 | `EUR`: 1 |
| COMP_0332 | GROUP_0149 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 29 | `EUR`: 747 | `EUR`: 29 | 5 | `EUR`: 30 |
| COMP_0333 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 44 | `EUR`: 35 | 20 | `EUR`: 1 |
| COMP_0334 | GROUP_0159 | EUR | BDL | no | `EUR`: 9 | `EUR`: 1 | `EUR`: 8,107 | none | 0 | `EUR`: 10 |
| COMP_0335 | GROUP_0214 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 1,671 | none | 0 | `EUR`: 4 |
| COMP_0336 | GROUP_0211 | GBP | BIL | yes | `EUR`: 4; `GBP`: 3; `USD`: 3 | none | `EUR`: 703; `GBP`: 989; `USD`: 300 | `CHF`: 1; `DKK`: 1; `EUR`: 653; `GBP`: 1,380; `SEK`: 3; `USD`: 383 | 24 | `EUR`: 4; `GBP`: 3; `USD`: 3 |
| COMP_0337 | GROUP_0022 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 48 | `EUR`: 26 | 16 | `EUR`: 1 |
| COMP_0338 | GROUP_0088 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 784 | `EUR`: 928; `USD`: 6 | 20 | `EUR`: 4 |
| COMP_0339 | GROUP_0188 | GBP | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `GBP`: 117; `USD`: 54 | `GBP`: 181; `USD`: 101 | 24 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0340 | GROUP_0116 | EUR | BDIL | yes | `EUR`: 5 | `EUR`: 3 | `EUR`: 522 | `EUR`: 189; `USD`: 3 | 24 | `EUR`: 8 |
| COMP_0341 | GROUP_0150 | EUR | BIL | yes | `EUR`: 3; `GBP`: 2; `USD`: 3 | none | `EUR`: 405; `GBP`: 57; `USD`: 1,750 | `CAD`: 41; `CLP`: 4; `EUR`: 520; `GBP`: 13; `USD`: 696 | 25 | `EUR`: 3; `GBP`: 2; `USD`: 3 |
| COMP_0342 | GROUP_0079 | EUR | BDIL | yes | `EUR`: 5 | `EUR`: 2 | `EUR`: 1,672 | `EUR`: 2,912; `MAD`: 5 | 13 | `EUR`: 7 |
| COMP_0343 | GROUP_0167 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 8,055 | `EUR`: 4,956 | 11 | `EUR`: 5 |
| COMP_0344 | GROUP_0211 | GBP | BIL | yes | `EUR`: 2; `GBP`: 2; `USD`: 2 | none | `EUR`: 207; `GBP`: 92; `USD`: 57 | `EUR`: 221; `GBP`: 107; `USD`: 86 | 20 | `EUR`: 2; `GBP`: 2; `USD`: 2 |
| COMP_0345 | GROUP_0069 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 84 | `EUR`: 137 | 20 | `EUR`: 1 |
| COMP_0346 | GROUP_0097 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 53 | `EUR`: 56 | 20 | `EUR`: 4 |
| COMP_0347 | GROUP_0117 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 369 | `EUR`: 75 | 10 | `EUR`: 5 |
| COMP_0348 | GROUP_0138 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 258 | none | 0 | `EUR`: 2 |
| COMP_0349 | GROUP_0101 | EUR | BIL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | none | `EUR`: 786; `GBP`: 26; `USD`: 105 | `CAD`: 14; `EUR`: 868; `GBP`: 80; `PLN`: 39; `SEK`: 48; `TRY`: 6; `USD`: 85 | 25 | `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_0350 | GROUP_0189 | EUR | BIL | yes | `USD`: 1 | none | `USD`: 1,688 | `CAD`: 1; `EUR`: 332; `USD`: 1,033 | 24 | `USD`: 1 |
| COMP_0351 | GROUP_0223 | EUR | BDL | yes | `EUR`: 21; `USD`: 7 | `EUR`: 26 | `EUR`: 9,788; `USD`: 56 | none | 0 | `EUR`: 47; `USD`: 6 |
| COMP_0352 | GROUP_0044 | EUR | BIL | yes | `EUR`: 4; `USD`: 2 | none | `EUR`: 1,312; `USD`: 50 | `EUR`: 386; `USD`: 82 | 23 | `EUR`: 4; `USD`: 2 |
| COMP_0353 | GROUP_0073 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 66 | `EUR`: 38; `GBP`: 1; `USD`: 15 | 8 | `EUR`: 1 |
| COMP_0354 | GROUP_0220 | EUR | BDIL | no | `EUR`: 10 | `EUR`: 10 | `EUR`: 3,014 | `EUR`: 899 | 24 | `EUR`: 20 |
| COMP_0355 | GROUP_0049 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 22 | none | 0 | `EUR`: 1 |
| COMP_0356 | GROUP_0172 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 2,146 | none | 0 | `EUR`: 3 |
| COMP_0357 | GROUP_0036 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 411 | `EUR`: 540 | 24 | `EUR`: 2 |
| COMP_0358 | GROUP_0127 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 230 | none | 0 | `EUR`: 2 |
| COMP_0359 | GROUP_0110 | EUR | BIL | no | `USD`: 1 | none | `USD`: 420 | `USD`: 144 | 25 | `USD`: 1 |
| COMP_0360 | GROUP_0138 | EUR | BL | no | `EUR`: 10 | none | `EUR`: 2,444 | none | 0 | `EUR`: 10 |
| COMP_0361 | GROUP_0116 | DKK | BIL | yes | `AUD`: 1; `BRL`: 1; `CAD`: 1; `CZK`: 1; `DKK`: 4; `EUR`: 1; `GBP`: 1; `PHP`: 1; `RUB`: 1; `USD`: 3 | none | `<unknown>`: 27; `DKK`: 3,631; `EUR`: 133; `USD`: 1,145 | `DKK`: 185; `EUR`: 44; `GBP`: 3; `USD`: 397 | 24 | `AUD`: 1; `BRL`: 1; `CAD`: 1; `CZK`: 1; `DKK`: 3; `EUR`: 1; `GBP`: 1; `PHP`: 1; `RUB`: 1; `USD`: 3 |
| COMP_0362 | GROUP_0142 | EUR | BDIL | no | `EUR`: 15 | `EUR`: 1 | `EUR`: 4,149 | `EUR`: 824 | 8 | `EUR`: 16 |
| COMP_0363 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 165 | `EUR`: 62 | 24 | `EUR`: 1 |
| COMP_0364 | GROUP_0195 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,218 | `EUR`: 907 | 17 | `EUR`: 2 |
| COMP_0365 | GROUP_0122 | EUR | BDSIL | yes | `EUR`: 7; `USD`: 1 | `EUR`: 10 | `EUR`: 1,630; `USD`: 204 | `AED`: 17; `BRL`: 1; `CAD`: 20; `CHF`: 14; `EUR`: 1,963; `GBP`: 28; `MYR`: 1; `SGD`: 16; `USD`: 805 | 19 | `EUR`: 17; `USD`: 1 |
| COMP_0366 | GROUP_0119 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 730; `USD`: 72 | `EUR`: 70; `USD`: 8 | 15 | `EUR`: 3; `USD`: 1 |
| COMP_0367 | GROUP_0187 | EUR | BL | no | `EUR`: 7 | none | `EUR`: 1,278 | none | 0 | `EUR`: 7 |
| COMP_0368 | GROUP_0016 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 815 | `EUR`: 935; `USD`: 169 | 25 | `EUR`: 2 |
| COMP_0369 | GROUP_0246 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 4 | `EUR`: 549 | `EUR`: 1,365 | 22 | `EUR`: 5 |
| COMP_0370 | GROUP_0164 | GBP | BIL | yes | `EUR`: 1; `GBP`: 3; `USD`: 1 | none | `EUR`: 21; `GBP`: 746 | `EUR`: 22; `GBP`: 167 | 8 | `EUR`: 1; `GBP`: 3; `USD`: 1 |
| COMP_0371 | GROUP_0122 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 56 | `EUR`: 30 | 10 | `EUR`: 2 |
| COMP_0372 | GROUP_0144 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 348 | `EUR`: 546 | 24 | `EUR`: 1 |
| COMP_0373 | GROUP_0192 | CHF | BL | no | `CHF`: 1 | none | `CHF`: 1,949 | none | 0 | `CHF`: 1 |
| COMP_0374 | GROUP_0020 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 133 | none | 0 | `EUR`: 1 |
| COMP_0375 | GROUP_0143 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 80 | `EUR`: 54 | 22 | `EUR`: 1 |
| COMP_0376 | GROUP_0070 | EUR | BIL | no | `EUR`: 18 | none | `EUR`: 1,649 | `EUR`: 312 | 14 | `EUR`: 18 |
| COMP_0377 | GROUP_0009 | EUR | BL | yes | `EUR`: 2; `GBP`: 1; `USD`: 2 | none | `EUR`: 167; `USD`: 4 | none | 0 | `EUR`: 2; `GBP`: 1; `USD`: 2 |
| COMP_0378 | GROUP_0234 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 182 | `EUR`: 169 | 12 | `EUR`: 1 |
| COMP_0379 | GROUP_0112 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 557 | `EUR`: 544 | 25 | `EUR`: 2 |
| COMP_0380 | GROUP_0059 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 36 | `EUR`: 26 | 7 | `EUR`: 1 |
| COMP_0381 | GROUP_0079 | EUR | BDIL | yes | `EUR`: 3 | `EUR`: 1 | `EUR`: 1,085 | `EUR`: 2,299; `MAD`: 4 | 22 | `EUR`: 4 |
| COMP_0382 | GROUP_0068 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 31 | `EUR`: 2 | 2 | `EUR`: 1 |
| COMP_0383 | GROUP_0078 | EUR | BL | no | `EUR`: 9 | none | `EUR`: 455 | none | 0 | `EUR`: 9 |
| COMP_0384 | GROUP_0094 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 4,750; `USD`: 631 | `BRL`: 1; `EUR`: 2,961; `GBP`: 3; `USD`: 348 | 25 | `EUR`: 3; `USD`: 1 |
| COMP_0385 | GROUP_0145 | EUR | BDL | yes | `EUR`: 10; `GBP`: 2; `USD`: 5 | `EUR`: 2 | `EUR`: 6,410; `GBP`: 54; `USD`: 799 | none | 0 | `EUR`: 12; `GBP`: 2; `USD`: 5 |
| COMP_0386 | GROUP_0020 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 26 | none | 0 | `EUR`: 1 |
| COMP_0387 | GROUP_0097 | EUR | BDIL | no | `EUR`: 10 | `EUR`: 2 | `EUR`: 1,164 | `EUR`: 876 | 24 | `EUR`: 12 |
| COMP_0388 | GROUP_0187 | EUR | BL | no | `EUR`: 11 | none | `EUR`: 2,182 | none | 0 | `EUR`: 11 |
| COMP_0389 | GROUP_0150 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 2,022 | none | 0 | `EUR`: 4 |
| COMP_0390 | GROUP_0064 | EUR | BL | yes | `PEN`: 1; `USD`: 1 | none | `PEN`: 70; `USD`: 33 | none | 0 | `PEN`: 1; `USD`: 1 |
| COMP_0391 | GROUP_0042 | EUR | BDL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 208 | none | 0 | `EUR`: 5 |
| COMP_0392 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,695 | `EUR`: 2,326 | 24 | `EUR`: 2 |
| COMP_0393 | GROUP_0054 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 2,796 | `EUR`: 2,901; `USD`: 12 | 22 | `EUR`: 1 |
| COMP_0394 | GROUP_0224 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 194 | `EUR`: 164 | 23 | `EUR`: 6 |
| COMP_0395 | GROUP_0112 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 3,148 | `EUR`: 4,097 | 24 | `EUR`: 5 |
| COMP_0396 | GROUP_0096 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 457 | `EUR`: 201 | 24 | `EUR`: 1 |
| COMP_0397 | GROUP_0155 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,988 | `EUR`: 3,622 | 25 | `EUR`: 1 |
| COMP_0398 | GROUP_0018 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 642 | `EUR`: 98 | 10 | `EUR`: 2 |
| COMP_0399 | GROUP_0115 | EUR | BDL | yes | `EUR`: 8; `USD`: 1 | `EUR`: 1 | `EUR`: 19,541 | none | 0 | `EUR`: 9; `USD`: 1 |
| COMP_0400 | GROUP_0142 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 1 | `EUR`: 643 | `EUR`: 110 | 9 | `EUR`: 7 |
| COMP_0401 | GROUP_0087 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 402 | none | 0 | `EUR`: 1 |
| COMP_0402 | GROUP_0131 | EUR | BDL | yes | `EUR`: 8; `USD`: 1 | `EUR`: 11 | `EUR`: 4,980 | none | 0 | `EUR`: 19; `USD`: 1 |
| COMP_0403 | GROUP_0201 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 208 | `EUR`: 483 | 17 | `EUR`: 2 |
| COMP_0404 | GROUP_0094 | USD | BIL | yes | `USD`: 4 | none | `USD`: 4,916 | `CAD`: 4; `COP`: 2; `EUR`: 5; `GBP`: 7; `USD`: 1,126 | 25 | `USD`: 4 |
| COMP_0405 | GROUP_0035 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 3,414 | `EUR`: 1,159 | 25 | `EUR`: 6 |
| COMP_0406 | GROUP_0034 | EUR | BDIL | yes | `EUR`: 8; `USD`: 6 | `EUR`: 2 | `EUR`: 7,907; `USD`: 79 | `ARS`: 1; `BRL`: 1; `EUR`: 4,537; `GBP`: 38; `USD`: 330 | 16 | `EUR`: 8; `USD`: 4 |
| COMP_0407 | GROUP_0067 | EUR | BDL | no | `EUR`: 8 | `EUR`: 2 | `EUR`: 1,578 | none | 0 | `EUR`: 10 |
| COMP_0408 | GROUP_0076 | EUR | BL | no | `USD`: 1 | none | `USD`: 132 | none | 0 | `USD`: 1 |
| COMP_0409 | GROUP_0009 | BAM | BL | yes | `BAM`: 4; `EUR`: 1; `USD`: 1 | none | `BAM`: 3,987; `EUR`: 2; `USD`: 28 | none | 0 | `BAM`: 4; `EUR`: 1; `USD`: 1 |
| COMP_0410 | GROUP_0112 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 578 | `EUR`: 344 | 24 | `EUR`: 1 |
| COMP_0411 | GROUP_0158 | EUR | BDL | no | `EUR`: 10 | `EUR`: 5 | `EUR`: 13,250 | none | 0 | `EUR`: 15 |
| COMP_0412 | GROUP_0016 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,039 | `AOA`: 4; `EUR`: 594 | 25 | `EUR`: 2 |
| COMP_0413 | GROUP_0130 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 1,310 | none | 0 | `EUR`: 5 |
| COMP_0414 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,797 | `EUR`: 1,493 | 25 | `EUR`: 1 |
| COMP_0415 | GROUP_0204 | EUR | BDSIL | no | `EUR`: 9 | `EUR`: 8 | `EUR`: 615 | `EUR`: 564 | 7 | `EUR`: 17 |
| COMP_0416 | GROUP_0040 | EUR | BIL | yes | `EUR`: 6 | none | `EUR`: 797 | `EUR`: 417; `GBP`: 3; `USD`: 13 | 12 | `EUR`: 5 |
| COMP_0417 | GROUP_0092 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 717 | none | 0 | `EUR`: 2 |
| COMP_0418 | GROUP_0070 | EUR | BIL | no | `EUR`: 13 | none | `EUR`: 694 | `EUR`: 144 | 19 | `EUR`: 13 |
| COMP_0419 | GROUP_0152 | GBP | BL | yes | `GBP`: 1; `USD`: 1 | none | `GBP`: 86; `USD`: 49 | none | 0 | `GBP`: 1; `USD`: 1 |
| COMP_0420 | GROUP_0104 | EUR | BDSIL | no | `EUR`: 9 | `EUR`: 8 | `EUR`: 540 | `EUR`: 284 | 25 | `EUR`: 17 |
| COMP_0421 | GROUP_0230 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 20 | `EUR`: 4 | 4 | `EUR`: 1 |
| COMP_0422 | GROUP_0018 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 434 | `EUR`: 506 | 15 | `EUR`: 2 |
| COMP_0423 | GROUP_0162 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 252; `USD`: 4 | `EUR`: 105; `USD`: 3 | 14 | `EUR`: 3; `USD`: 1 |
| COMP_0424 | GROUP_0097 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 364 | `EUR`: 100 | 24 | `EUR`: 5 |
| COMP_0425 | GROUP_0097 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 56 | none | 0 | `EUR`: 1 |
| COMP_0426 | GROUP_0003 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 60 | `EUR`: 87 | 23 | `EUR`: 1 |
| COMP_0427 | GROUP_0214 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 1,152 | `EUR`: 1,379 | 24 | `EUR`: 2; `USD`: 1 |
| COMP_0428 | GROUP_0213 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 980 | `EUR`: 1,684 | 25 | `EUR`: 1 |
| COMP_0429 | GROUP_0170 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 90 | none | 0 | `EUR`: 1 |
| COMP_0430 | GROUP_0182 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,277 | `EUR`: 308 | 13 | `EUR`: 2 |
| COMP_0431 | GROUP_0102 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 749 | `EUR`: 252 | 18 | `EUR`: 3 |
| COMP_0432 | GROUP_0095 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 260 | none | 0 | `EUR`: 3 |
| COMP_0433 | GROUP_0023 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 930 | `EUR`: 880 | 25 | `EUR`: 5 |
| COMP_0434 | GROUP_0134 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 985 | `EUR`: 8 | 2 | `EUR`: 2 |
| COMP_0435 | GROUP_0048 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 994 | `EUR`: 589 | 12 | `EUR`: 4 |
| COMP_0436 | GROUP_0048 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 2,459 | `EUR`: 1,127 | 11 | `EUR`: 5 |
| COMP_0437 | GROUP_0199 | EUR | BL | yes | `EUR`: 4; `USD`: 5 | none | `EUR`: 891; `USD`: 159 | none | 0 | `EUR`: 4; `USD`: 5 |
| COMP_0438 | GROUP_0150 | EUR | BIL | yes | `EUR`: 3; `GBP`: 1; `USD`: 2 | none | `EUR`: 1,318 | `EUR`: 1,195; `USD`: 2 | 24 | `EUR`: 3; `GBP`: 1; `USD`: 1 |
| COMP_0439 | GROUP_0236 | EUR | BL | yes | `EUR`: 3; `GBP`: 1 | none | `EUR`: 716 | none | 0 | `EUR`: 3; `GBP`: 1 |
| COMP_0440 | GROUP_0162 | VND | BIL | yes | `EUR`: 2; `USD`: 1; `VND`: 1 | none | `EUR`: 57; `USD`: 20; `VND`: 254 | `VND`: 9 | 6 | `EUR`: 2; `USD`: 1; `VND`: 1 |
| COMP_0441 | GROUP_0217 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 1,178 | `EUR`: 1,003 | 24 | `EUR`: 3 |
| COMP_0442 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 2,926 | none | 0 | `EUR`: 2 |
| COMP_0443 | GROUP_0143 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,594 | none | 0 | `EUR`: 1 |
| COMP_0444 | GROUP_0042 | EUR | BDL | no | `EUR`: 37 | `EUR`: 23 | `EUR`: 4,812 | none | 0 | `EUR`: 60 |
| COMP_0445 | GROUP_0199 | GBP | BL | yes | `EUR`: 2; `GBP`: 2; `USD`: 2 | none | `EUR`: 427; `GBP`: 244; `USD`: 46 | none | 0 | `EUR`: 2; `GBP`: 2; `USD`: 2 |
| COMP_0446 | GROUP_0182 | EUR | BDL | no | `EUR`: 8 | `EUR`: 6 | `EUR`: 9,700 | none | 0 | `EUR`: 14 |
| COMP_0447 | GROUP_0190 | EUR | BDIL | yes | `EUR`: 11; `USD`: 3 | `EUR`: 11 | `EUR`: 2,717; `USD`: 74 | `EUR`: 1,042; `USD`: 105 | 20 | `EUR`: 21; `USD`: 2 |
| COMP_0448 | GROUP_0158 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 335 | none | 0 | `EUR`: 1 |
| COMP_0449 | GROUP_0017 | EUR | BDL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 2,903 | none | 0 | `EUR`: 7 |
| COMP_0450 | GROUP_0202 | EUR | BDIL | yes | `EUR`: 3; `USD`: 1 | `EUR`: 2 | `EUR`: 182; `USD`: 17 | `EUR`: 52; `USD`: 5 | 13 | `EUR`: 4; `USD`: 1 |
| COMP_0451 | GROUP_0158 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 104 | none | 0 | `EUR`: 1 |
| COMP_0452 | GROUP_0103 | EUR | BDL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 1,626 | none | 0 | `EUR`: 5 |
| COMP_0453 | GROUP_0023 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 166 | `EUR`: 15 | 5 | `EUR`: 2 |
| COMP_0454 | GROUP_0112 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 207 | `EUR`: 340 | 24 | `EUR`: 1 |
| COMP_0455 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 764 | `EUR`: 758 | 23 | `EUR`: 2 |
| COMP_0456 | GROUP_0131 | EUR | BDL | no | `EUR`: 5 | `EUR`: 4 | `EUR`: 681 | none | 0 | `EUR`: 9 |
| COMP_0457 | GROUP_0129 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,021 | `EUR`: 1,161 | 24 | `EUR`: 1 |
| COMP_0458 | GROUP_0212 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 44 | none | 0 | `EUR`: 1 |
| COMP_0459 | GROUP_0051 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 974 | none | 0 | `EUR`: 2 |
| COMP_0460 | GROUP_0116 | GBP | BIL | yes | `CAD`: 2; `EUR`: 2; `GBP`: 5; `USD`: 2 | none | `CAD`: 1; `EUR`: 203; `GBP`: 1,285; `USD`: 998 | `DKK`: 4; `EUR`: 108; `GBP`: 373; `USD`: 250 | 25 | `CAD`: 2; `EUR`: 2; `GBP`: 5; `USD`: 2 |
| COMP_0461 | GROUP_0070 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 5,724 | `EUR`: 507 | 9 | `EUR`: 5 |
| COMP_0462 | GROUP_0194 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,018 | none | 0 | `EUR`: 2 |
| COMP_0463 | GROUP_0086 | USD | BL | no | `USD`: 1 | none | `USD`: 2,656 | none | 0 | `USD`: 1 |
| COMP_0464 | GROUP_0008 | EUR | BIL | yes | `NOK`: 2 | none | `NOK`: 23 | `EUR`: 2; `NOK`: 12 | 7 | `NOK`: 2 |
| COMP_0465 | GROUP_0246 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 3 | `EUR`: 2,236 | `EUR`: 601 | 15 | `EUR`: 6 |
| COMP_0466 | GROUP_0200 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 4 | `EUR`: 3,906 | `EUR`: 3,198 | 10 | `EUR`: 9 |
| COMP_0467 | GROUP_0172 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 2,360 | none | 0 | `EUR`: 3 |
| COMP_0468 | GROUP_0138 | EUR | BDL | no | `EUR`: 2 | `EUR`: 2 | `EUR`: 2,052 | none | 0 | `EUR`: 4 |
| COMP_0469 | GROUP_0149 | CLP | BIL | yes | `CLP`: 1; `USD`: 1 | none | `CLP`: 768; `USD`: 68 | `CLP`: 2,859; `EUR`: 2; `USD`: 131 | 25 | `CLP`: 1; `USD`: 1 |
| COMP_0470 | GROUP_0236 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 939 | none | 0 | `EUR`: 4 |
| COMP_0471 | GROUP_0162 | EUR | BDSIL | yes | `EUR`: 20; `USD`: 6 | `EUR`: 25 | `EUR`: 3,428; `USD`: 64 | `EUR`: 3,696; `GBP`: 4; `IDR`: 3; `SEK`: 4; `USD`: 130 | 25 | `EUR`: 45; `USD`: 6 |
| COMP_0472 | GROUP_0044 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 753 | `EUR`: 217; `USD`: 12 | 17 | `EUR`: 3 |
| COMP_0473 | GROUP_0185 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 1,046; `USD`: 21 | `EUR`: 675; `USD`: 2 | 15 | `EUR`: 3; `USD`: 1 |
| COMP_0474 | GROUP_0141 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 2,030 | `EUR`: 3,135 | 25 | `EUR`: 5 |
| COMP_0475 | GROUP_0015 | EUR | BL | no | `USD`: 2 | none | `USD`: 25 | none | 0 | `USD`: 2 |
| COMP_0476 | GROUP_0111 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 252 | `EUR`: 874 | 25 | `EUR`: 1 |
| COMP_0477 | GROUP_0232 | USD | BDIL | yes | `USD`: 15 | `USD`: 4 | `<unknown>`: 84; `USD`: 1,554 | `EUR`: 324; `USD`: 3,241 | 25 | `<unknown>`: 1; `USD`: 19 |
| COMP_0478 | GROUP_0131 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 1,740 | none | 0 | `EUR`: 4 |
| COMP_0479 | GROUP_0170 | AUD | BL | no | `AUD`: 1 | none | `AUD`: 9,678 | none | 0 | `AUD`: 1 |
| COMP_0480 | GROUP_0112 | EUR | BIL | no | `EUR`: 8 | none | `EUR`: 1,034 | `EUR`: 1,190 | 25 | `EUR`: 8 |
| COMP_0481 | GROUP_0225 | EUR | BDL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 11,122 | none | 0 | `EUR`: 5 |
| COMP_0482 | GROUP_0211 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 112 | `EUR`: 43; `USD`: 2 | 11 | `EUR`: 1 |
| COMP_0483 | GROUP_0063 | EUR | BDL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 538 | none | 0 | `EUR`: 6 |
| COMP_0484 | GROUP_0138 | EUR | BDL | no | `EUR`: 4 | `EUR`: 2 | `EUR`: 1,209 | none | 0 | `EUR`: 6 |
| COMP_0485 | GROUP_0052 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 119 | `EUR`: 94 | 10 | `EUR`: 1 |
| COMP_0486 | GROUP_0132 | CLP | BIL | yes | `CLP`: 1; `EUR`: 1; `USD`: 1 | none | `CLP`: 579; `USD`: 8 | `CLP`: 741; `EUR`: 14; `USD`: 4 | 25 | `CLP`: 1; `EUR`: 1; `USD`: 1 |
| COMP_0487 | GROUP_0170 | COP | BL | no | `COP`: 4 | none | `COP`: 2,056 | none | 0 | `COP`: 2 |
| COMP_0488 | GROUP_0060 | USD | BIL | no | `EUR`: 1 | none | `EUR`: 321 | `EUR`: 133 | 17 | `EUR`: 1 |
| COMP_0489 | GROUP_0175 | DKK | BL | yes | `DKK`: 1; `EUR`: 1 | none | `DKK`: 26 | none | 0 | `DKK`: 1; `EUR`: 1 |
| COMP_0490 | GROUP_0138 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 180 | none | 0 | `EUR`: 2 |
| COMP_0491 | GROUP_0146 | EUR | BDSIL | no | `EUR`: 14 | `EUR`: 16 | `EUR`: 11,343 | `EUR`: 1,044 | 23 | `EUR`: 30 |
| COMP_0492 | GROUP_0150 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 50 | `EUR`: 18 | 3 | `EUR`: 1 |
| COMP_0493 | GROUP_0126 | EUR | BL | no | `CAD`: 3 | none | `CAD`: 379 | none | 0 | `CAD`: 3 |
| COMP_0494 | GROUP_0142 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 2 | `EUR`: 1,038 | `EUR`: 387 | 7 | `EUR`: 8 |
| COMP_0495 | GROUP_0124 | EUR | BDIL | yes | `EUR`: 17; `GBP`: 1; `USD`: 3 | `EUR`: 13 | `EUR`: 1,688; `USD`: 29 | `EUR`: 429 | 25 | `EUR`: 30; `GBP`: 1; `USD`: 3 |
| COMP_0496 | GROUP_0137 | EUR | BDIL | yes | `BRL`: 1; `CAD`: 1; `EUR`: 6; `GBP`: 1; `JPY`: 1; `THB`: 1; `USD`: 2; `ZAR`: 1 | `EUR`: 1 | `BRL`: 2; `EUR`: 330; `JPY`: 10; `USD`: 52 | `BRL`: 3; `EUR`: 776; `GBP`: 1; `JPY`: 16; `THB`: 3; `USD`: 116; `ZAR`: 5 | 25 | `BRL`: 1; `CAD`: 1; `EUR`: 7; `GBP`: 1; `JPY`: 1; `THB`: 1; `USD`: 2; `ZAR`: 1 |
| COMP_0497 | GROUP_0185 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 22 | `EUR`: 45 | 14 | `EUR`: 2 |
| COMP_0498 | GROUP_0153 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 123 | `EUR`: 138 | 8 | `EUR`: 5 |
| COMP_0499 | GROUP_0241 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 682 | `EUR`: 587 | 16 | `EUR`: 4 |
| COMP_0500 | GROUP_0079 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 1,341 | `EUR`: 3,143; `MAD`: 5 | 24 | `EUR`: 1 |
| COMP_0501 | GROUP_0138 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 264 | none | 0 | `EUR`: 3 |
| COMP_0502 | GROUP_0098 | EUR | BL | no | `EUR`: 7 | none | `EUR`: 1,148 | none | 0 | `EUR`: 7 |
| COMP_0503 | GROUP_0134 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 7,009 | `EUR`: 214 | 8 | `EUR`: 2 |
| COMP_0504 | GROUP_0013 | EUR | BIL | yes | `EUR`: 8; `JPY`: 1; `SGD`: 1; `USD`: 2 | none | `EUR`: 2,105; `JPY`: 4; `SGD`: 1; `USD`: 95 | `COP`: 1; `EUR`: 1,930; `GBP`: 22; `SGD`: 3; `USD`: 277 | 25 | `EUR`: 8; `JPY`: 1; `SGD`: 1; `USD`: 2 |
| COMP_0505 | GROUP_0092 | EUR | BDL | yes | `EUR`: 15; `USD`: 1 | `EUR`: 17 | `EUR`: 5,791; `USD`: 40 | none | 0 | `EUR`: 32; `USD`: 1 |
| COMP_0506 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 606 | `EUR`: 2,675 | 25 | `EUR`: 1 |
| COMP_0507 | GROUP_0023 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 652 | `EUR`: 185 | 21 | `EUR`: 2 |
| COMP_0508 | GROUP_0070 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 235 | `EUR`: 59 | 12 | `EUR`: 4 |
| COMP_0509 | GROUP_0055 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 257 | `EUR`: 229; `USD`: 21 | 24 | `EUR`: 3; `USD`: 1 |
| COMP_0510 | GROUP_0079 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 47 | `EUR`: 30; `USD`: 12 | 21 | `EUR`: 1 |
| COMP_0511 | GROUP_0202 | EUR | BDIL | no | `EUR`: 9 | `EUR`: 9 | `EUR`: 1,294 | `EUR`: 619 | 24 | `EUR`: 16 |
| COMP_0512 | GROUP_0217 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 1,537 | `EUR`: 1,547 | 25 | `EUR`: 4 |
| COMP_0513 | GROUP_0142 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 886 | `EUR`: 107 | 7 | `EUR`: 2 |
| COMP_0514 | GROUP_0008 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `NOK`: 1; `USD`: 1 | none | `EUR`: 14; `GBP`: 10; `USD`: 25 | `EUR`: 2; `GBP`: 1 | 3 | `EUR`: 1; `GBP`: 1; `NOK`: 1; `USD`: 1 |
| COMP_0515 | GROUP_0117 | EUR | BDIL | yes | `EUR`: 12; `SGD`: 1; `USD`: 2 | `EUR`: 9 | `EUR`: 9,388; `USD`: 580 | `EUR`: 4,140; `USD`: 102 | 13 | `EUR`: 21; `SGD`: 1; `USD`: 2 |
| COMP_0516 | GROUP_0192 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 4,686 | none | 0 | `EUR`: 2 |
| COMP_0517 | GROUP_0165 | EUR | BDL | no | `EUR`: 10 | `EUR`: 8 | `EUR`: 8,804 | none | 0 | `EUR`: 18 |
| COMP_0518 | GROUP_0101 | EUR | BIL | yes | `AUD`: 1; `EUR`: 4; `GBP`: 2; `USD`: 3 | none | `EUR`: 4,847; `GBP`: 150; `USD`: 697 | `CAD`: 48; `EUR`: 2,263; `GBP`: 273; `PLN`: 118; `SEK`: 116; `TRY`: 51; `USD`: 523 | 25 | `AUD`: 1; `EUR`: 4; `GBP`: 2; `USD`: 3 |
| COMP_0519 | GROUP_0233 | EUR | BDIL | yes | `EUR`: 10; `USD`: 1 | `EUR`: 15 | `EUR`: 5,178; `USD`: 96 | `EUR`: 295; `GBP`: 1; `USD`: 22 | 6 | `EUR`: 25; `USD`: 1 |
| COMP_0520 | GROUP_0020 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 102 | none | 0 | `EUR`: 1 |
| COMP_0521 | GROUP_0073 | USD | BIL | yes | `USD`: 7 | none | `USD`: 1,047 | `EUR`: 5; `GBP`: 1; `USD`: 1,293 | 25 | `USD`: 7 |
| COMP_0522 | GROUP_0066 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 4,842 | `EUR`: 4,040 | 25 | `EUR`: 3 |
| COMP_0523 | GROUP_0122 | EUR | BDIL | yes | `EUR`: 5 | `EUR`: 3 | `EUR`: 1,093 | `CHF`: 1; `EUR`: 2,059; `USD`: 47 | 19 | `EUR`: 8 |
| COMP_0524 | GROUP_0006 | EUR | BDSL | yes | `EUR`: 7; `USD`: 3 | `EUR`: 7; `USD`: 1 | `EUR`: 311; `USD`: 27 | none | 0 | `EUR`: 14; `USD`: 4 |
| COMP_0525 | GROUP_0202 | EUR | BIL | yes | `EUR`: 1; `MXN`: 1; `USD`: 1 | none | `EUR`: 624; `USD`: 234 | `EUR`: 1,169; `MXN`: 15; `USD`: 40 | 24 | `EUR`: 1; `MXN`: 1; `USD`: 1 |
| COMP_0526 | GROUP_0172 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 4,328 | none | 0 | `EUR`: 4 |
| COMP_0527 | GROUP_0108 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 133; `USD`: 12 | `EUR`: 175; `USD`: 25 | 9 | `EUR`: 2; `USD`: 1 |
| COMP_0528 | GROUP_0192 | CHF | BL | yes | `CHF`: 1; `EUR`: 1 | none | `CHF`: 651; `EUR`: 22 | none | 0 | `CHF`: 1; `EUR`: 1 |
| COMP_0529 | GROUP_0095 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 41 | none | 0 | `EUR`: 1 |
| COMP_0530 | GROUP_0017 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 737 | none | 0 | `EUR`: 1 |
| COMP_0531 | GROUP_0214 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 1,424 | `EUR`: 1,125 | 24 | `EUR`: 6 |
| COMP_0532 | GROUP_0017 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 265 | none | 0 | `EUR`: 2 |
| COMP_0533 | GROUP_0079 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 217 | `EUR`: 355; `USD`: 9 | 23 | `EUR`: 1 |
| COMP_0534 | GROUP_0184 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 888 | `EUR`: 1,597 | 16 | `EUR`: 1 |
| COMP_0535 | GROUP_0130 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 3,966 | none | 0 | `EUR`: 2 |
| COMP_0536 | GROUP_0039 | EUR | BIL | no | `EUR`: 3 | none | `<unknown>`: 10; `EUR`: 98 | `EUR`: 88 | 9 | `EUR`: 3 |
| COMP_0537 | GROUP_0172 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 860 | none | 0 | `EUR`: 1 |
| COMP_0538 | GROUP_0065 | EUR | BDL | no | `EUR`: 9 | `EUR`: 1 | `EUR`: 724 | none | 0 | `EUR`: 10 |
| COMP_0539 | GROUP_0187 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 321 | none | 0 | `EUR`: 5 |
| COMP_0540 | GROUP_0048 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 4 | `EUR`: 5,204 | `EUR`: 2,880 | 23 | `EUR`: 10 |
| COMP_0541 | GROUP_0169 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 979 | none | 0 | `EUR`: 2 |
| COMP_0542 | GROUP_0023 | EUR | BIL | no | `EUR`: 12 | none | `EUR`: 2,448 | `EUR`: 3,333 | 24 | `EUR`: 12 |
| COMP_0543 | GROUP_0053 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,495 | `EUR`: 1,992 | 17 | `EUR`: 2 |
| COMP_0544 | GROUP_0208 | EUR | BDL | no | `EUR`: 11 | `EUR`: 1 | `EUR`: 4,791 | none | 0 | `EUR`: 11 |
| COMP_0545 | GROUP_0015 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 420 | `EUR`: 534 | 24 | `EUR`: 3 |
| COMP_0546 | GROUP_0095 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 88 | none | 0 | `EUR`: 3 |
| COMP_0547 | GROUP_0023 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 865 | `EUR`: 2,988 | 23 | `EUR`: 2 |
| COMP_0548 | GROUP_0217 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 719 | `EUR`: 571 | 25 | `EUR`: 2 |
| COMP_0549 | GROUP_0065 | EUR | BDL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 512 | none | 0 | `EUR`: 7 |
| COMP_0550 | GROUP_0246 | EUR | BDIL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | `EUR`: 6 | `EUR`: 237 | `CLP`: 2; `EUR`: 522 | 20 | `EUR`: 8; `GBP`: 1; `USD`: 1 |
| COMP_0551 | GROUP_0184 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 101 | none | 0 | `EUR`: 1 |
| COMP_0552 | GROUP_0126 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 1,022 | `EUR`: 5 | 2 | `EUR`: 3 |
| COMP_0553 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 141 | `EUR`: 148 | 21 | `EUR`: 1 |
| COMP_0554 | GROUP_0184 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 1,623 | none | 0 | `EUR`: 4 |
| COMP_0555 | GROUP_0106 | EUR | BDL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 349 | none | 0 | `EUR`: 6 |
| COMP_0556 | GROUP_0237 | DKK | BDIL | yes | `DKK`: 1 | `EUR`: 2 | `DKK`: 303; `EUR`: 2 | `CHF`: 4; `CZK`: 3; `DKK`: 201; `EUR`: 205; `GBP`: 49; `SEK`: 63; `USD`: 23 | 21 | `DKK`: 1; `EUR`: 2 |
| COMP_0557 | GROUP_0023 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 23 | none | 0 | `EUR`: 1 |
| COMP_0558 | GROUP_0026 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 325 | `EUR`: 434 | 18 | `EUR`: 1 |
| COMP_0559 | GROUP_0188 | GBP | BIL | yes | `EUR`: 1 | none | `EUR`: 209 | `EUR`: 440; `PLN`: 1; `USD`: 5 | 25 | `EUR`: 1 |
| COMP_0560 | GROUP_0097 | EUR | BDL | yes | `EUR`: 4; `MXN`: 1; `USD`: 4 | `EUR`: 1 | `EUR`: 169; `USD`: 778 | none | 0 | `EUR`: 5; `MXN`: 1; `USD`: 4 |
| COMP_0561 | GROUP_0063 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 206 | none | 0 | `EUR`: 2 |
| COMP_0562 | GROUP_0218 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 1,158; `USD`: 52 | `EUR`: 800; `NOK`: 70; `USD`: 575 | 25 | `EUR`: 4; `USD`: 1 |
| COMP_0563 | GROUP_0200 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 353 | `EUR`: 197 | 9 | `EUR`: 7 |
| COMP_0564 | GROUP_0212 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 3,154 | none | 0 | `EUR`: 3 |
| COMP_0565 | GROUP_0018 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 387 | `EUR`: 23 | 3 | `EUR`: 1 |
| COMP_0566 | GROUP_0119 | GBP | BIL | yes | `GBP`: 2; `USD`: 2 | none | `GBP`: 531; `USD`: 323 | `AED`: 2; `CAD`: 3; `EUR`: 1; `GBP`: 61; `USD`: 149 | 21 | `GBP`: 2; `USD`: 2 |
| COMP_0567 | GROUP_0194 | EUR | BDL | no | `EUR`: 2 | `EUR`: 4 | `EUR`: 1,115 | none | 0 | `EUR`: 6 |
| COMP_0568 | GROUP_0150 | EUR | BDIL | yes | `EUR`: 9; `USD`: 2 | `EUR`: 6 | `EUR`: 3,502; `USD`: 3 | `EUR`: 2,742; `USD`: 3 | 24 | `EUR`: 15; `USD`: 2 |
| COMP_0569 | GROUP_0094 | EUR | BIL | no | `EUR`: 10 | none | `EUR`: 3,619 | `EUR`: 594 | 24 | `EUR`: 9 |
| COMP_0570 | GROUP_0123 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 1 | `EUR`: 417 | `EUR`: 395 | 21 | `EUR`: 7 |
| COMP_0571 | GROUP_0101 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 29 | `EUR`: 1 | 1 | `EUR`: 1 |
| COMP_0572 | GROUP_0064 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 43 | none | 0 | `EUR`: 1 |
| COMP_0573 | GROUP_0132 | INR | BIL | yes | `INR`: 1 | none | `INR`: 301 | `EUR`: 38; `GBP`: 1; `INR`: 177; `USD`: 12 | 11 | `INR`: 1 |
| COMP_0574 | GROUP_0197 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 4,927 | `EUR`: 4,845 | 25 | `EUR`: 2 |
| COMP_0575 | GROUP_0079 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 666 | `EUR`: 1,631; `MAD`: 17; `USD`: 27 | 23 | `EUR`: 2 |
| COMP_0576 | GROUP_0044 | EUR | BDIL | yes | `EUR`: 6; `USD`: 2 | `EUR`: 4 | `EUR`: 1,644; `USD`: 1,403 | `EUR`: 2,580; `GBP`: 8; `SGD`: 1; `USD`: 1,045 | 25 | `EUR`: 9; `USD`: 2 |
| COMP_0577 | GROUP_0172 | EUR | BDL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 1,697 | none | 0 | `EUR`: 5 |
| COMP_0578 | GROUP_0162 | EUR | BDSIL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 927 | `EUR`: 422 | 14 | `EUR`: 5 |
| COMP_0579 | GROUP_0132 | GBP | BIL | yes | `GBP`: 1 | none | `GBP`: 21 | `EUR`: 2; `GBP`: 4 | 3 | `GBP`: 1 |
| COMP_0580 | GROUP_0008 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `NOK`: 1; `USD`: 1 | none | `EUR`: 138; `GBP`: 282; `USD`: 24 | `EUR`: 113; `GBP`: 1,445; `NOK`: 7; `USD`: 8 | 11 | `EUR`: 1; `GBP`: 1; `NOK`: 1; `USD`: 1 |
| COMP_0581 | GROUP_0191 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 200 | none | 0 | `EUR`: 2 |
| COMP_0582 | GROUP_0159 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 403 | none | 0 | `EUR`: 1 |
| COMP_0583 | GROUP_0143 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 785 | none | 0 | `EUR`: 3 |
| COMP_0584 | GROUP_0117 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 172 | none | 0 | `EUR`: 4 |
| COMP_0585 | GROUP_0004 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 21 | `EUR`: 33 | 8 | `EUR`: 1 |
| COMP_0586 | GROUP_0047 | EUR | BIL | no | `EUR`: 2 | none | `<unknown>`: 2; `EUR`: 813 | `EUR`: 1,390 | 12 | `EUR`: 2 |
| COMP_0587 | GROUP_0108 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 74 | `EUR`: 64 | 17 | `EUR`: 1 |
| COMP_0588 | GROUP_0218 | EUR | BDIL | yes | `EUR`: 3 | `EUR`: 1 | `EUR`: 893 | `EUR`: 791; `USD`: 94 | 20 | `EUR`: 4 |
| COMP_0589 | GROUP_0138 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 253 | none | 0 | `EUR`: 4 |
| COMP_0590 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 467 | `EUR`: 749 | 14 | `EUR`: 2 |
| COMP_0591 | GROUP_0185 | EUR | BIL | yes | `EUR`: 3; `USD`: 3 | none | `EUR`: 1,573; `USD`: 41 | `EUR`: 1,245; `USD`: 2 | 13 | `EUR`: 3; `USD`: 3 |
| COMP_0592 | GROUP_0185 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 2,319; `USD`: 10 | `EUR`: 1,296 | 15 | `EUR`: 4; `USD`: 1 |
| COMP_0593 | GROUP_0053 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,843 | `EUR`: 534 | 14 | `EUR`: 2 |
| COMP_0594 | GROUP_0090 | EUR | BDSIL | no | `EUR`: 3 | `EUR`: 10 | `EUR`: 771 | `EUR`: 320 | 21 | `EUR`: 13 |
| COMP_0595 | GROUP_0065 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 625 | none | 0 | `EUR`: 4 |
| COMP_0596 | GROUP_0212 | EUR | BDL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 287 | none | 0 | `EUR`: 6 |
| COMP_0597 | GROUP_0029 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 24 | `EUR`: 3,527 | `EUR`: 2,458 | 8 | `EUR`: 30 |
| COMP_0598 | GROUP_0200 | EUR | BDIL | no | `EUR`: 8 | `EUR`: 1 | `EUR`: 2,669 | `EUR`: 1,022 | 9 | `EUR`: 9 |
| COMP_0599 | GROUP_0018 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 32 | `EUR`: 18 | 12 | `EUR`: 2 |
| COMP_0600 | GROUP_0113 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 4 | `EUR`: 8,222 | `EUR`: 2,086 | 25 | `EUR`: 9 |
| COMP_0601 | GROUP_0070 | EUR | BIL | no | `EUR`: 8 | none | `EUR`: 290 | `EUR`: 57 | 15 | `EUR`: 8 |
| COMP_0602 | GROUP_0103 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 616 | none | 0 | `EUR`: 3 |
| COMP_0603 | GROUP_0239 | EUR | BDL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 1,233 | none | 0 | `EUR`: 5 |
| COMP_0604 | GROUP_0065 | EUR | BDSL | no | `EUR`: 28 | `EUR`: 7 | `EUR`: 6,932 | none | 0 | `EUR`: 35 |
| COMP_0605 | GROUP_0051 | GBP | BL | no | `GBP`: 2 | none | `GBP`: 931 | none | 0 | `GBP`: 2 |
| COMP_0606 | GROUP_0083 | USD | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 1; `GBP`: 130; `USD`: 35 | `USD`: 27 | 9 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0607 | GROUP_0023 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 514 | `EUR`: 466 | 20 | `EUR`: 2 |
| COMP_0608 | GROUP_0174 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 451 | `EUR`: 81 | 5 | `EUR`: 1 |
| COMP_0609 | GROUP_0129 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 116 | `EUR`: 64 | 19 | `EUR`: 1 |
| COMP_0610 | GROUP_0112 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 2,445 | `EUR`: 3,585 | 15 | `EUR`: 4 |
| COMP_0611 | GROUP_0099 | EUR | BIL | yes | `DKK`: 1; `EUR`: 2; `JPY`: 1; `USD`: 1 | none | `EUR`: 11,719; `JPY`: 101; `USD`: 748 | `AED`: 1; `EUR`: 577; `GBP`: 5; `JPY`: 17; `USD`: 389 | 23 | `DKK`: 1; `EUR`: 2; `JPY`: 1; `USD`: 1 |
| COMP_0612 | GROUP_0218 | EUR | BDL | yes | `CZK`: 1; `EUR`: 7; `USD`: 3 | `EUR`: 1 | `EUR`: 2,118; `USD`: 193 | none | 0 | `CZK`: 1; `EUR`: 7; `USD`: 2 |
| COMP_0613 | GROUP_0158 | EUR | BDL | no | `EUR`: 6 | `EUR`: 1 | `EUR`: 10,323 | none | 0 | `EUR`: 7 |
| COMP_0614 | GROUP_0218 | EUR | BIL | yes | `EUR`: 3; `USD`: 2 | none | `EUR`: 1,044; `USD`: 132 | `EUR`: 748; `USD`: 583 | 24 | `EUR`: 3; `USD`: 2 |
| COMP_0615 | GROUP_0079 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,091 | `EUR`: 2,149; `MAD`: 3; `USD`: 2 | 24 | `EUR`: 2 |
| COMP_0616 | GROUP_0017 | EUR | BDL | yes | `EUR`: 7; `GBP`: 1; `PLN`: 1; `USD`: 1 | `EUR`: 2 | `EUR`: 17,347; `GBP`: 632; `PLN`: 437; `USD`: 333 | none | 0 | `EUR`: 8; `GBP`: 1; `PLN`: 1; `USD`: 1 |
| COMP_0617 | GROUP_0212 | MXN | BL | yes | `MXN`: 1; `USD`: 1 | none | `MXN`: 327 | none | 0 | `MXN`: 1; `USD`: 1 |
| COMP_0618 | GROUP_0013 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 28; `GBP`: 273 | `EUR`: 83; `GBP`: 629; `USD`: 3 | 25 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0619 | GROUP_0039 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 325 | `EUR`: 227 | 9 | `EUR`: 6 |
| COMP_0620 | GROUP_0082 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 310 | `EUR`: 103 | 21 | `EUR`: 1 |
| COMP_0621 | GROUP_0211 | USD | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 2 | none | `EUR`: 81; `GBP`: 74; `USD`: 618 | `AUD`: 3; `EUR`: 120; `GBP`: 177; `USD`: 698 | 25 | `EUR`: 1; `GBP`: 1; `USD`: 2 |
| COMP_0622 | GROUP_0130 | EUR | BL | yes | `EUR`: 2; `GBP`: 1 | none | `EUR`: 1,209 | none | 0 | `EUR`: 2; `GBP`: 1 |
| COMP_0623 | GROUP_0063 | EUR | BDL | no | `EUR`: 19 | `EUR`: 29 | `EUR`: 12,562 | none | 0 | `EUR`: 48 |
| COMP_0624 | GROUP_0154 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 8,718 | none | 0 | `EUR`: 3 |
| COMP_0625 | GROUP_0159 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 126 | none | 0 | `EUR`: 1 |
| COMP_0626 | GROUP_0070 | EUR | BL | no | `EUR`: 8 | none | `EUR`: 403 | none | 0 | `<unknown>`: 2; `EUR`: 8 |
| COMP_0627 | GROUP_0115 | EUR | BL | no | `EUR`: 9 | none | `EUR`: 11,128 | none | 0 | `EUR`: 9 |
| COMP_0628 | GROUP_0013 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 1,352 | `EUR`: 2,867 | 25 | `EUR`: 3 |
| COMP_0629 | GROUP_0132 | COP | BIL | yes | `COP`: 2 | none | `COP`: 2,173 | `BRL`: 1; `COP`: 3,127; `EUR`: 18; `MXN`: 3; `USD`: 95 | 24 | `COP`: 2 |
| COMP_0630 | GROUP_0247 | EUR | BDL | yes | `EUR`: 44; `USD`: 1 | `EUR`: 4 | `EUR`: 18,058; `USD`: 44 | none | 0 | `EUR`: 48; `USD`: 1 |
| COMP_0631 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 603 | `EUR`: 663 | 25 | `EUR`: 2 |
| COMP_0632 | GROUP_0172 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 577 | none | 0 | `EUR`: 1 |
| COMP_0633 | GROUP_0130 | EUR | BL | yes | `CZK`: 1; `EUR`: 1; `GBP`: 1; `PLN`: 1; `TRY`: 1; `USD`: 1 | none | `EUR`: 1,060; `GBP`: 20; `PLN`: 8; `USD`: 6 | none | 0 | `CZK`: 1; `EUR`: 1; `GBP`: 1; `PLN`: 1; `TRY`: 1; `USD`: 1 |
| COMP_0634 | GROUP_0022 | EUR | BL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 865 | none | 0 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0635 | GROUP_0127 | EUR | BDL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 875 | none | 0 | `EUR`: 7 |
| COMP_0636 | GROUP_0037 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 5,114 | `EUR`: 2,824 | 11 | `EUR`: 2 |
| COMP_0637 | GROUP_0132 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,865 | `CHF`: 5; `EUR`: 1,400; `USD`: 1 | 24 | `EUR`: 2 |
| COMP_0638 | GROUP_0108 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,175 | `EUR`: 1,323; `GBP`: 6 | 25 | `EUR`: 2 |
| COMP_0639 | GROUP_0115 | EUR | BDL | no | `EUR`: 14 | `EUR`: 4 | `EUR`: 10,804 | none | 0 | `EUR`: 18 |
| COMP_0640 | GROUP_0022 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 447 | `EUR`: 134 | 23 | `EUR`: 4 |
| COMP_0641 | GROUP_0132 | EUR | BIL | yes | `PEN`: 2; `USD`: 1 | none | `PEN`: 670; `USD`: 114 | `EUR`: 18; `PEN`: 114; `USD`: 302 | 24 | `PEN`: 2; `USD`: 1 |
| COMP_0642 | GROUP_0072 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 3 | `EUR`: 81 | `EUR`: 120 | 16 | `EUR`: 4 |
| COMP_0643 | GROUP_0008 | EUR | BDIL | yes | `EUR`: 3; `NOK`: 2; `USD`: 1 | `EUR`: 1 | `EUR`: 147; `NOK`: 84; `USD`: 3 | `EUR`: 157; `GBP`: 15; `NOK`: 202 | 16 | `EUR`: 4; `NOK`: 2; `USD`: 1 |
| COMP_0644 | GROUP_0236 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 282 | none | 0 | `EUR`: 3 |
| COMP_0645 | GROUP_0217 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 135 | `EUR`: 127 | 14 | `EUR`: 4 |
| COMP_0646 | GROUP_0118 | EUR | BDIL | yes | `EUR`: 6 | `EUR`: 1 | `EUR`: 15,563 | `EUR`: 4,242; `GBP`: 33; `MXN`: 9; `THB`: 1; `USD`: 406; `ZAR`: 3 | 25 | `EUR`: 7 |
| COMP_0647 | GROUP_0126 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 5,650 | `EUR`: 1,675 | 24 | `EUR`: 4 |
| COMP_0648 | GROUP_0053 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,884 | `EUR`: 1,465 | 18 | `EUR`: 2 |
| COMP_0649 | GROUP_0153 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 1,521 | `EUR`: 4,073 | 25 | `EUR`: 3 |
| COMP_0650 | GROUP_0038 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 34 | `EUR`: 84 | 14 | `EUR`: 2 |
| COMP_0651 | GROUP_0081 | EUR | BDIL | no | `EUR`: 13 | `EUR`: 1 | `<unknown>`: 93; `EUR`: 17,795 | `EUR`: 1,970 | 11 | `EUR`: 14 |
| COMP_0652 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,316 | `EUR`: 1,733 | 24 | `EUR`: 2 |
| COMP_0653 | GROUP_0128 | EUR | BDSL | yes | `EUR`: 3; `USD`: 2 | `EUR`: 121; `USD`: 2 | `EUR`: 1,195; `USD`: 21 | none | 0 | `EUR`: 124; `USD`: 4 |
| COMP_0654 | GROUP_0053 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,428 | `EUR`: 1,899 | 10 | `EUR`: 3 |
| COMP_0655 | GROUP_0172 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,499 | none | 0 | `EUR`: 2 |
| COMP_0656 | GROUP_0087 | EUR | BL | yes | `EUR`: 4; `GBP`: 2; `USD`: 2 | none | `EUR`: 3,243; `GBP`: 24; `USD`: 665 | none | 0 | `EUR`: 4; `GBP`: 2; `USD`: 2 |
| COMP_0657 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 720 | `EUR`: 811 | 25 | `EUR`: 2 |
| COMP_0658 | GROUP_0132 | AED | BIL | yes | `AED`: 2; `USD`: 2 | none | `AED`: 956; `USD`: 727 | `AED`: 101; `EUR`: 45; `GBP`: 3; `USD`: 1,582 | 24 | `AED`: 2; `USD`: 2 |
| COMP_0659 | GROUP_0035 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 2 | `EUR`: 10,327 | `EUR`: 1,731 | 25 | `EUR`: 8 |
| COMP_0660 | GROUP_0175 | DKK | BL | yes | `DKK`: 1; `EUR`: 1 | none | `DKK`: 100 | none | 0 | `DKK`: 1; `EUR`: 1 |
| COMP_0661 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,841 | `EUR`: 4,528 | 24 | `EUR`: 2 |
| COMP_0662 | GROUP_0054 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 162 | `EUR`: 779 | 22 | `EUR`: 3 |
| COMP_0663 | GROUP_0143 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 470 | none | 0 | `EUR`: 1 |
| COMP_0664 | GROUP_0058 | EUR | BDSIL | no | `EUR`: 6 | `EUR`: 7 | `EUR`: 1,790 | `EUR`: 1,416 | 13 | `EUR`: 13 |
| COMP_0665 | GROUP_0150 | EUR | BIL | yes | `EUR`: 6; `GBP`: 1; `USD`: 1 | none | `EUR`: 2,911; `GBP`: 190; `USD`: 384 | `EUR`: 1,970; `USD`: 3 | 25 | `EUR`: 6; `GBP`: 1; `USD`: 1 |
| COMP_0666 | GROUP_0013 | EUR | BIL | yes | `ARS`: 4; `USD`: 1 | none | `ARS`: 1,753 | `ARS`: 459; `EUR`: 36; `USD`: 177 | 25 | `ARS`: 4; `USD`: 1 |
| COMP_0667 | GROUP_0068 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 569 | `EUR`: 724 | 22 | `EUR`: 1 |
| COMP_0668 | GROUP_0048 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 446 | `EUR`: 444 | 9 | `EUR`: 1 |
| COMP_0669 | GROUP_0007 | EUR | BDL | yes | `EUR`: 2; `USD`: 1 | `EUR`: 1 | `EUR`: 794; `USD`: 38 | none | 0 | `EUR`: 3; `USD`: 1 |
| COMP_0670 | GROUP_0101 | EUR | BIL | yes | `EUR`: 3; `GBP`: 2; `PLN`: 1; `USD`: 2 | none | `EUR`: 84; `GBP`: 2; `USD`: 196 | `EUR`: 19; `GBP`: 4; `USD`: 140 | 25 | `EUR`: 3; `GBP`: 2; `PLN`: 1; `USD`: 2 |
| COMP_0671 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 400 | `EUR`: 407 | 24 | `EUR`: 1 |
| COMP_0672 | GROUP_0184 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 29 | `EUR`: 13 | 6 | `EUR`: 2 |
| COMP_0673 | GROUP_0203 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 3 | `EUR`: 841 | `EUR`: 2,368 | 23 | `EUR`: 7 |
| COMP_0674 | GROUP_0112 | EUR | BIL | no | `EUR`: 14 | none | `EUR`: 2,620 | `EUR`: 2,796 | 25 | `EUR`: 14 |
| COMP_0675 | GROUP_0023 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 964 | `EUR`: 1,015 | 24 | `EUR`: 3 |
| COMP_0676 | GROUP_0104 | EUR | DIL | no | none | `EUR`: 1 | `EUR`: 131 | `EUR`: 88 | 18 | `EUR`: 1 |
| COMP_0677 | GROUP_0138 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 76 | none | 0 | `EUR`: 2 |
| COMP_0678 | GROUP_0154 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 55 | `EUR`: 15 | 9 | `EUR`: 1 |
| COMP_0679 | GROUP_0172 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,121 | none | 0 | `EUR`: 1 |
| COMP_0680 | GROUP_0089 | EUR | BIL | yes | `CHF`: 1; `EUR`: 3; `GBP`: 1; `USD`: 1 | none | `EUR`: 1,855; `USD`: 286 | `CHF`: 4; `DKK`: 1; `EUR`: 2,093; `GBP`: 1; `USD`: 55 | 12 | `CHF`: 1; `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_0681 | GROUP_0176 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,213 | none | 0 | `EUR`: 1 |
| COMP_0682 | GROUP_0200 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 1,141 | `EUR`: 300 | 9 | `EUR`: 7 |
| COMP_0683 | GROUP_0239 | EUR | DL | no | none | `EUR`: 5 | `EUR`: 722 | none | 0 | `EUR`: 5 |
| COMP_0684 | GROUP_0236 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,059 | none | 0 | `EUR`: 3 |
| COMP_0685 | GROUP_0035 | EUR | BDIL | no | `EUR`: 8 | `EUR`: 3 | `EUR`: 13,882 | `EUR`: 2,152 | 25 | `EUR`: 11 |
| COMP_0686 | GROUP_0139 | EUR | BDIL | no | `EUR`: 10 | `EUR`: 26 | `EUR`: 5,899 | `EUR`: 3,768 | 25 | `EUR`: 36 |
| COMP_0687 | GROUP_0212 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,517 | none | 0 | `EUR`: 2 |
| COMP_0688 | GROUP_0241 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 384 | `EUR`: 81 | 13 | `EUR`: 1 |
| COMP_0689 | GROUP_0200 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 2,476 | `EUR`: 1,430 | 9 | `EUR`: 1 |
| COMP_0690 | GROUP_0009 | USD | BL | yes | `EUR`: 1; `GBP`: 1; `USD`: 2 | none | `EUR`: 8; `GBP`: 102; `USD`: 1,500 | none | 0 | `EUR`: 1; `GBP`: 1; `USD`: 2 |
| COMP_0691 | GROUP_0010 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 5,846 | `EUR`: 3,183 | 23 | `EUR`: 3 |
| COMP_0692 | GROUP_0108 | GBP | BIL | yes | `EUR`: 1; `GBP`: 7; `USD`: 1 | none | `EUR`: 10; `GBP`: 79 | `EUR`: 2; `GBP`: 34 | 9 | `EUR`: 1; `GBP`: 7; `USD`: 1 |
| COMP_0693 | GROUP_0116 | EUR | BL | yes | `EUR`: 5; `GBP`: 3; `USD`: 3 | none | `EUR`: 4,552; `GBP`: 3,628; `USD`: 4,632 | none | 0 | `EUR`: 4; `GBP`: 2; `USD`: 2 |
| COMP_0694 | GROUP_0162 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 433 | `EUR`: 41 | 7 | `EUR`: 2 |
| COMP_0695 | GROUP_0084 | EUR | BIL | yes | `EUR`: 4; `GBP`: 1; `USD`: 1 | none | `EUR`: 3,101 | `DKK`: 2; `EUR`: 1,853; `USD`: 4 | 25 | `EUR`: 3 |
| COMP_0696 | GROUP_0017 | EUR | BDL | yes | `EUR`: 10; `USD`: 1 | `EUR`: 9 | `EUR`: 5,091; `USD`: 14 | none | 0 | `EUR`: 19; `USD`: 1 |
| COMP_0697 | GROUP_0132 | EUR | BDIL | yes | `EUR`: 4 | `EUR`: 4 | `EUR`: 4,185 | `EUR`: 4,894; `USD`: 38 | 25 | `EUR`: 8 |
| COMP_0698 | GROUP_0241 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 196 | `EUR`: 100 | 13 | `EUR`: 1 |
| COMP_0699 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 449 | none | 0 | `EUR`: 2 |
| COMP_0700 | GROUP_0103 | EUR | BDL | no | `EUR`: 5 | `EUR`: 3 | `EUR`: 12,676 | none | 0 | `EUR`: 8 |
| COMP_0701 | GROUP_0211 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 29 | `EUR`: 8 | 3 | `EUR`: 1 |
| COMP_0702 | GROUP_0236 | EUR | BDL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 90 | none | 0 | `EUR`: 2 |
| COMP_0703 | GROUP_0115 | EUR | BL | no | `EUR`: 7 | none | `EUR`: 8,033 | none | 0 | `EUR`: 7 |
| COMP_0704 | GROUP_0131 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 21 | none | 0 | `EUR`: 1 |
| COMP_0705 | GROUP_0067 | EUR | BDL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 679 | none | 0 | `EUR`: 6 |
| COMP_0706 | GROUP_0212 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 1,956 | none | 0 | `EUR`: 3 |
| COMP_0707 | GROUP_0035 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 5,195 | `EUR`: 1,496 | 25 | `EUR`: 5 |
| COMP_0708 | GROUP_0196 | EUR | BIL | yes | `EUR`: 14; `HUF`: 1; `USD`: 1 | none | `EUR`: 2,539 | `EUR`: 1,530; `USD`: 1 | 25 | `EUR`: 14; `HUF`: 1; `USD`: 1 |
| COMP_0709 | GROUP_0040 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 528 | `EUR`: 646 | 8 | `EUR`: 4 |
| COMP_0710 | GROUP_0146 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 1,173 | none | 0 | `EUR`: 3 |
| COMP_0711 | GROUP_0219 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 3,595 | `EUR`: 1,268 | 24 | `EUR`: 1 |
| COMP_0712 | GROUP_0155 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 32 | `EUR`: 23 | 11 | `EUR`: 1 |
| COMP_0713 | GROUP_0023 | EUR | BIL | yes | `EUR`: 26; `USD`: 1 | none | `EUR`: 19,213; `USD`: 15 | `EUR`: 2,379 | 24 | `EUR`: 26; `USD`: 1 |
| COMP_0714 | GROUP_0172 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,406 | none | 0 | `EUR`: 2 |
| COMP_0715 | GROUP_0177 | EUR | B | no | `EUR`: 1 | none | `EUR`: 63 | none | 0 | none |
| COMP_0716 | GROUP_0178 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 115 | none | 0 | `EUR`: 4 |
| COMP_0717 | GROUP_0020 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 30 | none | 0 | `EUR`: 1 |
| COMP_0718 | GROUP_0138 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 92 | none | 0 | `EUR`: 1 |
| COMP_0719 | GROUP_0068 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 616 | `EUR`: 682 | 25 | `EUR`: 1 |
| COMP_0720 | GROUP_0130 | EUR | B | no | `EUR`: 1 | none | `EUR`: 751 | none | 0 | none |
| COMP_0721 | GROUP_0113 | EUR | BDSIL | no | `EUR`: 8 | `EUR`: 9 | `EUR`: 1,490 | `EUR`: 465 | 16 | `EUR`: 17 |
| COMP_0722 | GROUP_0064 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 22 | none | 0 | `EUR`: 1 |
| COMP_0723 | GROUP_0230 | EUR | BDIL | yes | `EUR`: 6; `USD`: 1 | `EUR`: 3; `USD`: 2 | `EUR`: 130 | `EUR`: 27 | 12 | `EUR`: 9; `USD`: 3 |
| COMP_0724 | GROUP_0236 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 235 | none | 0 | `EUR`: 2 |
| COMP_0725 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,294 | `EUR`: 3,406 | 24 | `EUR`: 2 |
| COMP_0726 | GROUP_0055 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 41 | `EUR`: 128 | 24 | `EUR`: 2 |
| COMP_0727 | GROUP_0009 | EUR | BL | yes | `EUR`: 3; `GBP`: 1; `USD`: 3 | none | `EUR`: 507; `USD`: 633 | none | 0 | `EUR`: 3; `GBP`: 1; `USD`: 3 |
| COMP_0728 | GROUP_0183 | USD | BIL | yes | `USD`: 4 | none | `USD`: 1,287 | `CAD`: 60; `USD`: 1,079 | 22 | `USD`: 4 |
| COMP_0729 | GROUP_0018 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 58 | `EUR`: 10 | 3 | `EUR`: 1 |
| COMP_0730 | GROUP_0041 | EUR | BL | yes | `CHF`: 2; `EUR`: 5; `GBP`: 2; `SEK`: 2; `USD`: 3 | none | `CHF`: 610; `EUR`: 3,276; `GBP`: 678; `SEK`: 426; `USD`: 157 | none | 0 | `CHF`: 2; `EUR`: 5; `GBP`: 2; `SEK`: 2; `USD`: 3 |
| COMP_0731 | GROUP_0149 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 889 | `EUR`: 1,483; `USD`: 4 | 7 | `EUR`: 2 |
| COMP_0732 | GROUP_0022 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 133 | `EUR`: 38 | 16 | `EUR`: 3 |
| COMP_0733 | GROUP_0129 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 115 | `EUR`: 50 | 17 | `EUR`: 5 |
| COMP_0734 | GROUP_0041 | USD | BL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 16; `USD`: 5 | none | 0 | `EUR`: 1; `USD`: 1 |
| COMP_0735 | GROUP_0200 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 30 | `EUR`: 2 | 1 | `EUR`: 1 |
| COMP_0736 | GROUP_0184 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 44 | none | 0 | `EUR`: 1 |
| COMP_0737 | GROUP_0205 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,263 | `EUR`: 1,343 | 25 | `EUR`: 2 |
| COMP_0738 | GROUP_0064 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 330 | none | 0 | `EUR`: 2 |
| COMP_0739 | GROUP_0187 | EUR | BL | no | `EUR`: 7 | none | `EUR`: 634 | none | 0 | `EUR`: 7 |
| COMP_0740 | GROUP_0044 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 143; `USD`: 28 | `EUR`: 91 | 12 | `EUR`: 2; `USD`: 1 |
| COMP_0741 | GROUP_0013 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 919 | `CAD`: 1; `EUR`: 1,568; `USD`: 1 | 25 | `EUR`: 1 |
| COMP_0742 | GROUP_0047 | EUR | BDIL | yes | `EUR`: 3; `USD`: 1 | `EUR`: 1 | `<unknown>`: 8; `EUR`: 2,263; `USD`: 3 | `EUR`: 350; `USD`: 1 | 11 | `EUR`: 4; `USD`: 1 |
| COMP_0743 | GROUP_0033 | EUR | BDIL | yes | `EUR`: 13; `GBP`: 1; `USD`: 1 | `EUR`: 10 | `EUR`: 4,157; `USD`: 3 | `DKK`: 4; `EUR`: 1,918; `GBP`: 3; `USD`: 282 | 21 | `<unknown>`: 1; `EUR`: 17; `GBP`: 1; `USD`: 1 |
| COMP_0744 | GROUP_0032 | USD | BL | yes | `EUR`: 1; `MXN`: 1; `USD`: 2 | none | `EUR`: 2; `MXN`: 2; `USD`: 214 | none | 0 | `EUR`: 1; `MXN`: 1; `USD`: 2 |
| COMP_0745 | GROUP_0058 | EUR | BDSIL | no | `EUR`: 6 | `EUR`: 14 | `EUR`: 1,167 | `EUR`: 419 | 21 | `EUR`: 20 |
| COMP_0746 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 692 | `EUR`: 650 | 24 | `EUR`: 2 |
| COMP_0747 | GROUP_0172 | EUR | BDL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 5,481 | none | 0 | `EUR`: 7 |
| COMP_0748 | GROUP_0074 | EUR | BDL | yes | `EUR`: 2; `USD`: 2 | `EUR`: 2 | `EUR`: 891; `USD`: 987 | none | 0 | `EUR`: 4; `USD`: 2 |
| COMP_0749 | GROUP_0243 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 301 | none | 0 | `EUR`: 2 |
| COMP_0750 | GROUP_0172 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 2,775 | none | 0 | `EUR`: 3 |
| COMP_0751 | GROUP_0142 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 1,301 | `EUR`: 29 | 8 | `EUR`: 3 |
| COMP_0752 | GROUP_0236 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 663 | none | 0 | `EUR`: 4 |
| COMP_0753 | GROUP_0170 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 398 | none | 0 | `EUR`: 2 |
| COMP_0754 | GROUP_0211 | EUR | BL | yes | `EUR`: 4; `GBP`: 3; `USD`: 3 | none | `EUR`: 4,371; `GBP`: 116; `USD`: 210 | none | 0 | `EUR`: 4; `GBP`: 3; `USD`: 3 |
| COMP_0755 | GROUP_0103 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 8,084 | none | 0 | `EUR`: 4 |
| COMP_0756 | GROUP_0104 | EUR | BIL | no | `EUR`: 10 | none | `EUR`: 2,012 | `EUR`: 1,924 | 25 | `EUR`: 10 |
| COMP_0757 | GROUP_0133 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 408 | `EUR`: 200 | 21 | `EUR`: 2 |
| COMP_0758 | GROUP_0169 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 122 | none | 0 | `EUR`: 1 |
| COMP_0759 | GROUP_0094 | USD | BIL | no | `USD`: 2 | none | `USD`: 1,448 | `USD`: 241 | 23 | `USD`: 2 |
| COMP_0760 | GROUP_0249 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 4,635 | none | 0 | `EUR`: 3 |
| COMP_0761 | GROUP_0199 | CHF | BL | yes | `CHF`: 1; `EUR`: 1; `USD`: 2 | none | `CHF`: 168; `EUR`: 249; `USD`: 158 | none | 0 | `CHF`: 1; `EUR`: 1; `USD`: 2 |
| COMP_0762 | GROUP_0051 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,216 | none | 0 | `EUR`: 2 |
| COMP_0763 | GROUP_0095 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 504 | none | 0 | `EUR`: 1 |
| COMP_0764 | GROUP_0022 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 274 | `EUR`: 106 | 23 | `EUR`: 3 |
| COMP_0765 | GROUP_0016 | NAD | BIL | yes | `NAD`: 1; `USD`: 1 | none | `NAD`: 1,425; `USD`: 142 | `EUR`: 58; `NAD`: 3,374; `USD`: 372 | 23 | `NAD`: 1; `USD`: 1 |
| COMP_0766 | GROUP_0212 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,923 | none | 0 | `EUR`: 2 |
| COMP_0767 | GROUP_0054 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 231 | none | 0 | `EUR`: 1 |
| COMP_0768 | GROUP_0127 | EUR | BL | no | `EUR`: 7 | none | `EUR`: 68 | none | 0 | `EUR`: 7 |
| COMP_0769 | GROUP_0114 | EUR | BDL | no | `EUR`: 5 | `EUR`: 4 | `EUR`: 15,138 | none | 0 | `<unknown>`: 1; `EUR`: 9 |
| COMP_0770 | GROUP_0082 | EUR | BDSIL | no | `EUR`: 1 | `EUR`: 2 | `EUR`: 492 | `EUR`: 222 | 24 | `EUR`: 3 |
| COMP_0771 | GROUP_0175 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 147 | none | 0 | `EUR`: 1 |
| COMP_0772 | GROUP_0023 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 1,768 | `EUR`: 557 | 25 | `EUR`: 5 |
| COMP_0773 | GROUP_0112 | EUR | BIL | no | `EUR`: 17 | none | `EUR`: 12,773 | `EUR`: 3,862 | 25 | `EUR`: 17 |
| COMP_0774 | GROUP_0103 | EUR | BDL | no | `EUR`: 1 | `EUR`: 4 | `EUR`: 690 | none | 0 | `EUR`: 5 |
| COMP_0775 | GROUP_0211 | EUR | BIL | yes | `EUR`: 3; `GBP`: 2; `USD`: 2 | none | `EUR`: 924; `GBP`: 76; `USD`: 72 | `EUR`: 789; `GBP`: 47; `USD`: 7 | 21 | `EUR`: 3; `GBP`: 2; `USD`: 2 |
| COMP_0776 | GROUP_0158 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 171 | none | 0 | `EUR`: 2 |
| COMP_0777 | GROUP_0179 | USD | BL | no | `USD`: 3 | none | `USD`: 555 | none | 0 | `USD`: 3 |
| COMP_0778 | GROUP_0238 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,517 | `EUR`: 2,450; `USD`: 1 | 25 | `EUR`: 1 |
| COMP_0779 | GROUP_0108 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 172 | `EUR`: 299 | 13 | `EUR`: 1 |
| COMP_0780 | GROUP_0065 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 3,859 | `EUR`: 970 | 17 | `EUR`: 5 |
| COMP_0781 | GROUP_0170 | USD | BL | no | `USD`: 1 | none | `USD`: 208 | none | 0 | `USD`: 1 |
| COMP_0782 | GROUP_0130 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 3,157 | none | 0 | `EUR`: 2 |
| COMP_0783 | GROUP_0122 | GBP | BIL | yes | `EUR`: 1; `GBP`: 2 | none | `EUR`: 8; `GBP`: 233 | `CHF`: 6; `EUR`: 28; `GBP`: 383; `USD`: 8 | 17 | `EUR`: 1; `GBP`: 2 |
| COMP_0784 | GROUP_0149 | GBP | BI | yes | `GBP`: 1 | none | `GBP`: 140 | `EUR`: 1; `GBP`: 52 | 4 | none |
| COMP_0785 | GROUP_0140 | EUR | BL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 871 | none | 0 | `EUR`: 2; `USD`: 1 |
| COMP_0786 | GROUP_0017 | EUR | BDL | no | `EUR`: 12 | `EUR`: 1 | `EUR`: 2,870 | none | 0 | `EUR`: 13 |
| COMP_0787 | GROUP_0008 | EUR | BIL | yes | `EUR`: 3; `NOK`: 2 | none | `EUR`: 48; `NOK`: 32 | `EUR`: 61; `GBP`: 1; `NOK`: 40 | 9 | `EUR`: 3; `NOK`: 2 |
| COMP_0788 | GROUP_0045 | EUR | BDSIL | no | `EUR`: 5 | `EUR`: 5 | `EUR`: 4,495 | `EUR`: 4,786 | 25 | `EUR`: 8 |
| COMP_0789 | GROUP_0115 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 29 | none | 0 | `EUR`: 5 |
| COMP_0790 | GROUP_0210 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 854 | `CHF`: 1; `EUR`: 3,107; `GBP`: 15; `USD`: 176 | 25 | `EUR`: 4 |
| COMP_0791 | GROUP_0065 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,667 | none | 0 | `EUR`: 2 |
| COMP_0792 | GROUP_0070 | EUR | BL | no | `EUR`: 13 | none | `EUR`: 1,973 | none | 0 | `EUR`: 13 |
| COMP_0793 | GROUP_0147 | EUR | BDIL | no | `EUR`: 12 | `EUR`: 7 | `EUR`: 6,549 | `EUR`: 3,726 | 25 | `EUR`: 19 |
| COMP_0794 | GROUP_0035 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 3,739 | `EUR`: 491 | 16 | `EUR`: 4 |
| COMP_0795 | GROUP_0039 | EUR | BIL | no | `EUR`: 4 | none | `<unknown>`: 162; `EUR`: 522 | `EUR`: 509 | 9 | `EUR`: 4 |
| COMP_0796 | GROUP_0160 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 271 | `EUR`: 207 | 25 | `EUR`: 3 |
| COMP_0797 | GROUP_0081 | EUR | BIL | no | `EUR`: 27 | none | `EUR`: 8,115 | `EUR`: 711 | 16 | `EUR`: 3 |
| COMP_0798 | GROUP_0057 | EUR | BDIL | no | `EUR`: 19 | `EUR`: 12 | `EUR`: 2,646 | `EUR`: 468 | 15 | `EUR`: 31 |
| COMP_0799 | GROUP_0183 | GBP | BIL | yes | `EUR`: 3; `GBP`: 3; `USD`: 3 | none | `EUR`: 44; `GBP`: 2,057; `USD`: 816 | `AED`: 4; `EUR`: 221; `GBP`: 1,810; `SEK`: 14; `USD`: 712 | 24 | `EUR`: 3; `GBP`: 3; `USD`: 3 |
| COMP_0800 | GROUP_0149 | GBP | BI | yes | `GBP`: 1 | none | `GBP`: 278 | `EUR`: 1; `GBP`: 115 | 9 | none |
| COMP_0801 | GROUP_0023 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 714 | `EUR`: 296 | 25 | `EUR`: 5 |
| COMP_0802 | GROUP_0117 | EUR | BDIL | no | `EUR`: 10 | `EUR`: 3 | `EUR`: 940 | `EUR`: 118 | 11 | `EUR`: 13 |
| COMP_0803 | GROUP_0231 | EUR | BDIL | yes | `EUR`: 30 | `EUR`: 35 | `EUR`: 5,390 | `EUR`: 2,451; `GBP`: 8; `USD`: 360 | 25 | `EUR`: 65 |
| COMP_0804 | GROUP_0077 | BRL | BL | no | `BRL`: 1 | none | `BRL`: 56 | none | 0 | `BRL`: 1 |
| COMP_0805 | GROUP_0213 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 90 | `EUR`: 52 | 18 | `EUR`: 2 |
| COMP_0806 | GROUP_0177 | EUR | BDL | yes | `EUR`: 6; `GBP`: 1; `USD`: 1 | `EUR`: 3 | `EUR`: 1,883 | none | 0 | `EUR`: 8 |
| COMP_0807 | GROUP_0101 | EUR | BIL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | none | `EUR`: 33 | `EUR`: 1 | 1 | `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_0808 | GROUP_0015 | EUR | BIL | yes | `EUR`: 4; `GBP`: 1; `USD`: 3 | none | `EUR`: 898; `USD`: 291 | `EUR`: 1,837; `USD`: 2 | 24 | `EUR`: 4; `GBP`: 1; `USD`: 3 |
| COMP_0809 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 271 | `EUR`: 220 | 24 | `EUR`: 1 |
| COMP_0810 | GROUP_0016 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 373 | `EUR`: 287 | 25 | `EUR`: 2 |
| COMP_0811 | GROUP_0155 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 2,608 | `EUR`: 1,852 | 25 | `EUR`: 1 |
| COMP_0812 | GROUP_0160 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 2,161 | `EUR`: 4,206 | 25 | `EUR`: 6 |
| COMP_0813 | GROUP_0155 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 1,458 | `EUR`: 136 | 24 | `EUR`: 6 |
| COMP_0814 | GROUP_0016 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 305 | `EUR`: 226 | 25 | `EUR`: 1 |
| COMP_0815 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 99 | `EUR`: 141 | 24 | `EUR`: 1 |
| COMP_0816 | GROUP_0158 | EUR | BDL | no | `EUR`: 6 | `EUR`: 9 | `EUR`: 2,279 | none | 0 | `EUR`: 15 |
| COMP_0817 | GROUP_0070 | EUR | BIL | no | `EUR`: 8 | none | `EUR`: 1,358 | `EUR`: 548 | 22 | `EUR`: 8 |
| COMP_0818 | GROUP_0115 | EUR | BL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 78 | none | 0 | `EUR`: 1; `USD`: 1 |
| COMP_0819 | GROUP_0250 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 1,078 | `EUR`: 2,982 | 25 | `EUR`: 6 |
| COMP_0820 | GROUP_0158 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 1,521 | none | 0 | `EUR`: 4 |
| COMP_0821 | GROUP_0070 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 2,056 | `EUR`: 609 | 16 | `EUR`: 4 |
| COMP_0822 | GROUP_0116 | COP | BL | no | `COP`: 1 | none | `COP`: 1,093 | none | 0 | `COP`: 1 |
| COMP_0823 | GROUP_0115 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 210 | none | 0 | `EUR`: 4 |
| COMP_0824 | GROUP_0159 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 3,696 | none | 0 | `EUR`: 3 |
| COMP_0825 | GROUP_0043 | EUR | BDL | no | `EUR`: 6 | `EUR`: 32 | `EUR`: 8,269 | none | 0 | `EUR`: 38 |
| COMP_0826 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 97 | `EUR`: 142 | 24 | `EUR`: 1 |
| COMP_0827 | GROUP_0078 | EUR | BDL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 261 | none | 0 | `EUR`: 7 |
| COMP_0828 | GROUP_0016 | EUR | BIL | yes | `MZN`: 1; `USD`: 1 | none | `MZN`: 1,087; `USD`: 237 | `EUR`: 88; `MZN`: 2,078; `USD`: 534 | 25 | `MZN`: 1; `USD`: 1 |
| COMP_0829 | GROUP_0153 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 5 | `EUR`: 1,935 | `EUR`: 2,513 | 24 | `EUR`: 7 |
| COMP_0830 | GROUP_0016 | EUR | BL | no | `BRL`: 2 | none | `BRL`: 1,627 | none | 0 | `BRL`: 2 |
| COMP_0831 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 157 | `EUR`: 95 | 24 | `EUR`: 1 |
| COMP_0832 | GROUP_0014 | EUR | BIL | yes | `EUR`: 9; `GBP`: 1; `USD`: 3 | none | `EUR`: 8,206; `USD`: 182 | `EUR`: 3,851; `USD`: 23 | 16 | `EUR`: 8; `GBP`: 1; `USD`: 3 |
| COMP_0833 | GROUP_0158 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 150 | none | 0 | `EUR`: 1 |
| COMP_0834 | GROUP_0096 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 215 | `EUR`: 140 | 11 | `EUR`: 1 |
| COMP_0835 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 491 | `EUR`: 834 | 25 | `EUR`: 1 |
| COMP_0836 | GROUP_0189 | GBP | BIL | yes | `EUR`: 1; `GBP`: 2 | none | `GBP`: 387 | `EUR`: 193; `GBP`: 1,449; `USD`: 6 | 25 | `<unknown>`: 1; `EUR`: 1; `GBP`: 2 |
| COMP_0837 | GROUP_0070 | EUR | BL | no | `EUR`: 40 | none | `EUR`: 6,243 | none | 0 | `EUR`: 36 |
| COMP_0838 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 98 | `EUR`: 143 | 24 | `EUR`: 1 |
| COMP_0839 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 106 | `EUR`: 141 | 24 | `EUR`: 1 |
| COMP_0840 | GROUP_0248 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 1,017 | none | 0 | `EUR`: 3 |
| COMP_0841 | GROUP_0005 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 4,146 | none | 0 | `EUR`: 2 |
| COMP_0842 | GROUP_0053 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 173 | `EUR`: 46 | 18 | `EUR`: 3 |
| COMP_0843 | GROUP_0218 | EUR | BIL | yes | `EUR`: 5; `USD`: 2 | none | `EUR`: 1,474; `USD`: 292 | `EUR`: 986; `USD`: 436 | 25 | `EUR`: 5; `USD`: 2 |
| COMP_0844 | GROUP_0088 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 79 | `EUR`: 32 | 18 | `EUR`: 4 |
| COMP_0845 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 814 | `EUR`: 889 | 23 | `EUR`: 2 |
| COMP_0846 | GROUP_0141 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 1,288 | `EUR`: 1,890 | 25 | `EUR`: 2 |
| COMP_0847 | GROUP_0037 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 692 | `EUR`: 1,053 | 23 | `EUR`: 2 |
| COMP_0848 | GROUP_0126 | EUR | BL | no | `USD`: 8 | none | `USD`: 4,336 | none | 0 | `USD`: 4 |
| COMP_0849 | GROUP_0246 | EUR | BDIL | yes | `EUR`: 3; `USD`: 1 | `EUR`: 5 | `EUR`: 4,572 | `EUR`: 836; `USD`: 2 | 22 | `EUR`: 6 |
| COMP_0850 | GROUP_0114 | EUR | BDL | no | `EUR`: 7 | `EUR`: 12 | `EUR`: 4,151 | none | 0 | `EUR`: 19 |
| COMP_0851 | GROUP_0211 | USD | BL | yes | `SGD`: 1; `USD`: 1 | none | `SGD`: 10; `USD`: 85 | none | 0 | `SGD`: 1; `USD`: 1 |
| COMP_0852 | GROUP_0090 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 5,750 | `EUR`: 2,895; `GBP`: 1 | 24 | `EUR`: 2; `USD`: 1 |
| COMP_0853 | GROUP_0001 | JPY | BL | no | `JPY`: 1 | none | `JPY`: 62 | none | 0 | `JPY`: 1 |
| COMP_0854 | GROUP_0131 | EUR | BIL | yes | `EUR`: 6 | none | `EUR`: 3,577 | `EUR`: 2,010; `USD`: 38 | 25 | `EUR`: 6 |
| COMP_0855 | GROUP_0006 | EUR | BDL | yes | `EUR`: 8; `USD`: 4 | `EUR`: 13; `MXN`: 1 | `EUR`: 2,687; `USD`: 55 | none | 0 | `EUR`: 21; `MXN`: 1; `USD`: 3 |
| COMP_0856 | GROUP_0101 | EUR | BIL | yes | `CAD`: 1; `CHF`: 1; `EUR`: 3; `GBP`: 3; `MXN`: 1; `SEK`: 1; `SGD`: 1; `USD`: 3 | none | `EUR`: 647; `GBP`: 1,667; `USD`: 127 | `EUR`: 929; `GBP`: 737; `PLN`: 7; `USD`: 105 | 25 | `CAD`: 1; `CHF`: 1; `EUR`: 3; `GBP`: 3; `MXN`: 1; `SEK`: 1; `SGD`: 1; `USD`: 3 |
| COMP_0857 | GROUP_0097 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 139 | `EUR`: 23 | 13 | `EUR`: 3 |
| COMP_0858 | GROUP_0048 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 824 | `EUR`: 808 | 12 | `EUR`: 2 |
| COMP_0859 | GROUP_0150 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 4,209 | none | 0 | `EUR`: 5 |
| COMP_0860 | GROUP_0199 | XOF | BL | no | `XOF`: 3 | none | `XOF`: 255 | none | 0 | `XOF`: 2 |
| COMP_0861 | GROUP_0226 | EUR | BDIL | yes | `EUR`: 17; `USD`: 2 | `EUR`: 9 | `EUR`: 1,644; `USD`: 18 | `EUR`: 612 | 24 | `EUR`: 26; `USD`: 2 |
| COMP_0862 | GROUP_0132 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 3,165 | `CHF`: 12; `EUR`: 2,524; `USD`: 1 | 25 | `EUR`: 2 |
| COMP_0863 | GROUP_0142 | EUR | BDL | yes | `EUR`: 2; `USD`: 1 | `EUR`: 1 | `EUR`: 135; `USD`: 13 | none | 0 | `EUR`: 3; `USD`: 1 |
| COMP_0864 | GROUP_0218 | EUR | BIL | yes | `EUR`: 6; `USD`: 6 | none | `EUR`: 747; `USD`: 1,217 | `EUR`: 812; `PLN`: 4; `USD`: 1,091 | 17 | `EUR`: 6; `USD`: 6 |
| COMP_0865 | GROUP_0230 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 118 | `EUR`: 43; `USD`: 2 | 11 | `EUR`: 3 |
| COMP_0866 | GROUP_0102 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 234 | `EUR`: 36 | 8 | `EUR`: 5 |
| COMP_0867 | GROUP_0103 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 48 | none | 0 | `EUR`: 1 |
| COMP_0868 | GROUP_0096 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 873 | `EUR`: 1,047 | 24 | `EUR`: 4 |
| COMP_0869 | GROUP_0228 | EUR | BIL | yes | `EUR`: 3; `JPY`: 1; `USD`: 1 | none | `EUR`: 4,840; `JPY`: 3; `USD`: 5 | `AUD`: 1; `EUR`: 1,431; `JPY`: 2; `USD`: 12 | 12 | `EUR`: 1 |
| COMP_0870 | GROUP_0142 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 3,951 | `EUR`: 350 | 8 | `EUR`: 5 |
| COMP_0871 | GROUP_0021 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 151 | `EUR`: 415; `USD`: 138 | 11 | `EUR`: 1 |
| COMP_0872 | GROUP_0236 | EUR | BL | no | `EUR`: 8 | none | `EUR`: 458 | none | 0 | `EUR`: 8 |
| COMP_0873 | GROUP_0023 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 1,929; `USD`: 12 | `EUR`: 1,118 | 22 | `EUR`: 3; `USD`: 1 |
| COMP_0874 | GROUP_0185 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 783 | `EUR`: 389 | 12 | `EUR`: 2 |
| COMP_0875 | GROUP_0141 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 8 | `EUR`: 4,229 | `EUR`: 3,403 | 25 | `EUR`: 12 |
| COMP_0876 | GROUP_0189 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 349 | `EUR`: 219 | 23 | `EUR`: 1 |
| COMP_0877 | GROUP_0127 | EUR | BDL | no | `EUR`: 15 | `EUR`: 11 | `EUR`: 8,572 | none | 0 | `EUR`: 26 |
| COMP_0878 | GROUP_0147 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 941 | `EUR`: 75 | 10 | `EUR`: 3 |
| COMP_0879 | GROUP_0108 | EUR | BIL | yes | `EUR`: 2; `GBP`: 3 | none | `EUR`: 9; `GBP`: 72 | `EUR`: 21; `GBP`: 62 | 16 | `EUR`: 2; `GBP`: 2 |
| COMP_0880 | GROUP_0218 | USD | BIL | yes | `USD`: 3 | none | `USD`: 2,270 | `EUR`: 123; `USD`: 2,961 | 15 | `USD`: 3 |
| COMP_0881 | GROUP_0071 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 2,339 | none | 0 | `EUR`: 1 |
| COMP_0882 | GROUP_0101 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 25 | `EUR`: 2 | 2 | `EUR`: 1 |
| COMP_0883 | GROUP_0194 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 193 | `EUR`: 4 | 4 | `EUR`: 1 |
| COMP_0884 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 682 | `EUR`: 671 | 21 | `EUR`: 2 |
| COMP_0885 | GROUP_0158 | EUR | BDL | no | `EUR`: 6 | `EUR`: 2 | `EUR`: 5,549 | none | 0 | `EUR`: 8 |
| COMP_0886 | GROUP_0161 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 12,971 | none | 0 | `EUR`: 1 |
| COMP_0887 | GROUP_0048 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 1,372 | `EUR`: 698 | 10 | `EUR`: 4 |
| COMP_0888 | GROUP_0142 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 3 | `EUR`: 597 | `EUR`: 156 | 7 | `EUR`: 8 |
| COMP_0889 | GROUP_0130 | EUR | B | no | `EUR`: 1 | none | `EUR`: 1,806 | none | 0 | none |
| COMP_0890 | GROUP_0245 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 3,640 | `CNY`: 4; `EUR`: 2,547; `USD`: 26 | 22 | `EUR`: 3 |
| COMP_0891 | GROUP_0081 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 301 | none | 0 | `EUR`: 4 |
| COMP_0892 | GROUP_0142 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 913 | `EUR`: 32 | 7 | `EUR`: 4 |
| COMP_0893 | GROUP_0011 | EUR | BDL | no | `EUR`: 4 | `EUR`: 6 | `EUR`: 4,818 | none | 0 | `EUR`: 10 |
| COMP_0894 | GROUP_0172 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,242 | none | 0 | `EUR`: 1 |
| COMP_0895 | GROUP_0016 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 463 | `EUR`: 204 | 25 | `EUR`: 4 |
| COMP_0896 | GROUP_0114 | EUR | BDL | yes | `EUR`: 4; `USD`: 1 | `EUR`: 2 | `EUR`: 1,804; `USD`: 62 | none | 0 | `EUR`: 6; `USD`: 1 |
| COMP_0897 | GROUP_0081 | EUR | BDIL | no | `EUR`: 9 | `EUR`: 2 | `EUR`: 5,908 | `EUR`: 1,681 | 16 | `EUR`: 11 |
| COMP_0898 | GROUP_0011 | EUR | BDL | no | `EUR`: 6 | `EUR`: 5 | `EUR`: 4,784 | none | 0 | `EUR`: 11 |
| COMP_0899 | GROUP_0093 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 167 | `EUR`: 85 | 11 | `EUR`: 2 |
| COMP_0900 | GROUP_0199 | AOA | BL | no | `AOA`: 7 | none | `AOA`: 1,739 | none | 0 | `AOA`: 7 |
| COMP_0901 | GROUP_0017 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 391 | none | 0 | `EUR`: 5 |
| COMP_0902 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 43 | `EUR`: 8 | 6 | `EUR`: 1 |
| COMP_0903 | GROUP_0079 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 637 | `EUR`: 434 | 22 | `EUR`: 2 |
| COMP_0904 | GROUP_0129 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 131 | `EUR`: 57 | 20 | `EUR`: 4 |
| COMP_0905 | GROUP_0065 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 578 | none | 0 | `EUR`: 3 |
| COMP_0906 | GROUP_0238 | EUR | DSIL | no | none | `EUR`: 2 | `EUR`: 778 | `EUR`: 35 | 6 | `EUR`: 2 |
| COMP_0907 | GROUP_0022 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 53 | `EUR`: 29 | 15 | `EUR`: 2 |
| COMP_0908 | GROUP_0022 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 1,355 | `EUR`: 1,026; `USD`: 21 | 25 | `EUR`: 1 |
| COMP_0909 | GROUP_0220 | EUR | BDIL | yes | `EUR`: 55; `GBP`: 3; `USD`: 7 | `EUR`: 57; `GBP`: 2 | `EUR`: 8,297; `GBP`: 82; `USD`: 130 | `EUR`: 1,072; `USD`: 22 | 25 | `EUR`: 107; `GBP`: 5; `USD`: 7 |
| COMP_0910 | GROUP_0172 | EUR | BDL | no | `EUR`: 4 | `EUR`: 2 | `EUR`: 2,230 | none | 0 | `EUR`: 6 |
| COMP_0911 | GROUP_0172 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 899 | none | 0 | `EUR`: 1 |
| COMP_0912 | GROUP_0185 | EUR | BDIL | yes | `EUR`: 10; `USD`: 2 | `EUR`: 1 | `EUR`: 3,726; `USD`: 177 | `EUR`: 2,245; `GBP`: 8; `USD`: 2 | 20 | `EUR`: 10; `USD`: 2 |
| COMP_0913 | GROUP_0108 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 790 | `EUR`: 1,108 | 21 | `EUR`: 2 |
| COMP_0914 | GROUP_0244 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,268 | `EUR`: 1,296 | 21 | `EUR`: 3 |
| COMP_0915 | GROUP_0088 | EUR | BDIL | yes | `EUR`: 3; `USD`: 2 | `EUR`: 4 | `EUR`: 1,599; `USD`: 47 | `EUR`: 4,351; `USD`: 27 | 23 | `EUR`: 7; `USD`: 2 |
| COMP_0916 | GROUP_0150 | EUR | BL | yes | `EUR`: 1; `GBP`: 1; `PLN`: 1; `USD`: 1 | none | `EUR`: 53; `GBP`: 24; `PLN`: 55; `USD`: 25 | none | 0 | `EUR`: 1; `GBP`: 1; `PLN`: 1; `USD`: 1 |
| COMP_0917 | GROUP_0217 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 27 | `EUR`: 32 | 7 | `EUR`: 1 |
| COMP_0918 | GROUP_0179 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 153 | none | 0 | `EUR`: 1 |
| COMP_0919 | GROUP_0230 | EUR | BDIL | yes | `EUR`: 16; `USD`: 5 | `EUR`: 26; `USD`: 2 | `EUR`: 5,978; `USD`: 214 | `EUR`: 3,537; `GBP`: 4; `USD`: 71 | 25 | `EUR`: 42; `USD`: 7 |
| COMP_0920 | GROUP_0122 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 1,765 | `EUR`: 2,245; `GBP`: 5; `USD`: 11 | 16 | `EUR`: 3 |
| COMP_0921 | GROUP_0183 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 144; `USD`: 77 | `EUR`: 272; `USD`: 52 | 15 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0922 | GROUP_0096 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 32 | `EUR`: 11 | 3 | `EUR`: 1 |
| COMP_0923 | GROUP_0126 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 2,380 | `EUR`: 904 | 24 | `EUR`: 1 |
| COMP_0924 | GROUP_0065 | EUR | BDSL | no | `EUR`: 15 | `EUR`: 7 | `EUR`: 4,047 | none | 0 | `EUR`: 22 |
| COMP_0925 | GROUP_0021 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 27 | none | 0 | `EUR`: 1 |
| COMP_0926 | GROUP_0217 | EUR | BIL | no | `EUR`: 8 | none | `EUR`: 938 | `EUR`: 806 | 25 | `EUR`: 8 |
| COMP_0927 | GROUP_0108 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 3,564 | `EUR`: 4,298 | 23 | `EUR`: 6 |
| COMP_0928 | GROUP_0131 | EUR | BDL | yes | `EUR`: 12; `MXN`: 1; `USD`: 3 | `EUR`: 13 | `EUR`: 10,899; `USD`: 30 | none | 0 | `EUR`: 25; `MXN`: 1; `USD`: 3 |
| COMP_0929 | GROUP_0067 | EUR | BDL | no | `EUR`: 8 | `EUR`: 4 | `EUR`: 7,243 | none | 0 | `EUR`: 12 |
| COMP_0930 | GROUP_0246 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 135 | `EUR`: 71 | 12 | `EUR`: 3 |
| COMP_0931 | GROUP_0084 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 2,622 | `EUR`: 1,728; `USD`: 1 | 25 | `EUR`: 3 |
| COMP_0932 | GROUP_0081 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 481 | `EUR`: 1,945 | 16 | `EUR`: 1 |
| COMP_0933 | GROUP_0152 | GBP | BL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 36; `GBP`: 250; `USD`: 132 | none | 0 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_0934 | GROUP_0184 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 30 | none | 0 | `EUR`: 1 |
| COMP_0935 | GROUP_0018 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 5 | `EUR`: 1,521 | `EUR`: 3,855 | 14 | `EUR`: 8 |
| COMP_0936 | GROUP_0046 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 99 | `EUR`: 105 | 14 | `EUR`: 2 |
| COMP_0937 | GROUP_0172 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,881 | none | 0 | `EUR`: 2 |
| COMP_0938 | GROUP_0050 | EUR | B | no | `USD`: 1 | none | `USD`: 723 | none | 0 | none |
| COMP_0939 | GROUP_0001 | GBP | BL | yes | `EUR`: 2; `GBP`: 2; `USD`: 2 | none | `EUR`: 170; `GBP`: 1,808; `USD`: 665 | none | 0 | `EUR`: 2; `GBP`: 2; `USD`: 2 |
| COMP_0940 | GROUP_0217 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 908 | `EUR`: 728 | 25 | `EUR`: 5 |
| COMP_0941 | GROUP_0158 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 2,926 | none | 0 | `EUR`: 3 |
| COMP_0942 | GROUP_0016 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 7 | `EUR`: 1,082 | `EUR`: 1,651 | 25 | `EUR`: 9 |
| COMP_0943 | GROUP_0173 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 284 | `EUR`: 4,358 | 13 | `EUR`: 1 |
| COMP_0944 | GROUP_0104 | EUR | BDIL | yes | `EUR`: 5 | `EUR`: 2 | `EUR`: 1,622 | `CHF`: 1; `EUR`: 1,656 | 25 | `EUR`: 7 |
| COMP_0945 | GROUP_0162 | EUR | BIL | yes | `EUR`: 11; `USD`: 3 | none | `EUR`: 1,235; `USD`: 22 | `EUR`: 1,165; `SEK`: 1; `USD`: 11 | 25 | `EUR`: 10; `USD`: 2 |
| COMP_0946 | GROUP_0143 | EUR | BL | yes | `EUR`: 4; `GBP`: 1; `MXN`: 1; `USD`: 1 | none | `EUR`: 1,372; `USD`: 21 | none | 0 | `EUR`: 3 |
| COMP_0947 | GROUP_0158 | EUR | BL | no | `EUR`: 6 | none | `EUR`: 3,127 | none | 0 | `EUR`: 6 |
| COMP_0948 | GROUP_0189 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 2,112 | `EUR`: 3,105 | 25 | `EUR`: 1 |
| COMP_0949 | GROUP_0064 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 29 | none | 0 | `EUR`: 1 |
| COMP_0950 | GROUP_0082 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 10 | `EUR`: 538 | `EUR`: 343 | 24 | `EUR`: 12 |
| COMP_0951 | GROUP_0218 | EUR | BIL | yes | `EUR`: 3; `GBP`: 1; `USD`: 2 | none | `EUR`: 1,136; `USD`: 1,999 | `EUR`: 1,211; `USD`: 1,764 | 24 | `EUR`: 3; `GBP`: 1; `USD`: 2 |
| COMP_0952 | GROUP_0103 | EUR | BDL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 2,056 | none | 0 | `EUR`: 3 |
| COMP_0953 | GROUP_0070 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 31 | `EUR`: 80 | 12 | `EUR`: 2 |
| COMP_0954 | GROUP_0011 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 974 | none | 0 | `EUR`: 2 |
| COMP_0955 | GROUP_0035 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 458 | `EUR`: 167 | 25 | `EUR`: 1 |
| COMP_0956 | GROUP_0166 | EUR | BDIL | yes | `EUR`: 34 | `EUR`: 28 | `EUR`: 1,326 | `CAD`: 1; `EUR`: 3,271; `USD`: 5 | 25 | `EUR`: 62 |
| COMP_0957 | GROUP_0006 | EUR | BDL | no | `EUR`: 4 | `EUR`: 5 | `EUR`: 1,047 | none | 0 | `EUR`: 8 |
| COMP_0958 | GROUP_0200 | EUR | BDIL | no | `EUR`: 11 | `EUR`: 6 | `EUR`: 5,058 | `EUR`: 2,583 | 11 | `EUR`: 17 |
| COMP_0959 | GROUP_0013 | EUR | BIL | yes | `PEN`: 1; `USD`: 1 | none | `PEN`: 259; `USD`: 198 | `CLP`: 16; `EUR`: 8; `PEN`: 1,478; `USD`: 159 | 24 | `PEN`: 1; `USD`: 1 |
| COMP_0960 | GROUP_0137 | EUR | BIL | yes | `EUR`: 4; `USD`: 1 | none | `EUR`: 395 | `EUR`: 72 | 23 | `EUR`: 3; `USD`: 1 |
| COMP_0961 | GROUP_0101 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 2 | none | `EUR`: 2; `USD`: 324 | `EUR`: 7; `USD`: 125 | 22 | `EUR`: 1; `GBP`: 1; `USD`: 2 |
| COMP_0962 | GROUP_0154 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 3,052 | `EUR`: 1 | 1 | `EUR`: 1 |
| COMP_0963 | GROUP_0159 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 147 | none | 0 | `EUR`: 2 |
| COMP_0964 | GROUP_0039 | EUR | BIL | no | `EUR`: 6 | none | `<unknown>`: 101; `EUR`: 891 | `EUR`: 696 | 11 | `EUR`: 6 |
| COMP_0965 | GROUP_0229 | EUR | BDSL | no | `EUR`: 4 | `EUR`: 19 | `EUR`: 1,083 | none | 0 | `EUR`: 23 |
| COMP_0966 | GROUP_0094 | BRL | BIL | yes | `BRL`: 2 | none | `BRL`: 1,853 | `BRL`: 545; `CAD`: 1 | 24 | `BRL`: 2 |
| COMP_0967 | GROUP_0142 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 959 | `EUR`: 338 | 7 | `EUR`: 6 |
| COMP_0968 | GROUP_0129 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 76 | `EUR`: 75 | 11 | `EUR`: 1 |
| COMP_0969 | GROUP_0158 | EUR | BDL | no | `EUR`: 7 | `EUR`: 6 | `EUR`: 18,236 | none | 0 | `EUR`: 13 |
| COMP_0970 | GROUP_0011 | EUR | BDL | no | `EUR`: 7 | `EUR`: 5 | `EUR`: 2,021 | none | 0 | `EUR`: 12 |
| COMP_0971 | GROUP_0152 | GBP | BL | yes | `GBP`: 1; `USD`: 1 | none | `GBP`: 202; `USD`: 7 | none | 0 | `GBP`: 1; `USD`: 1 |
| COMP_0972 | GROUP_0170 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 935 | none | 0 | `EUR`: 1 |
| COMP_0973 | GROUP_0013 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,299 | `EUR`: 4,555; `USD`: 14 | 25 | `EUR`: 1 |
| COMP_0974 | GROUP_0195 | EUR | BDIL | yes | `EUR`: 9 | `EUR`: 5 | `EUR`: 558 | `AED`: 1; `EUR`: 310; `USD`: 6 | 17 | `EUR`: 14 |
| COMP_0975 | GROUP_0237 | EUR | BDIL | yes | `EUR`: 1 | `EUR`: 1 | `EUR`: 1,156 | `CHF`: 4; `CZK`: 17; `DKK`: 1; `EUR`: 843; `SEK`: 1; `USD`: 2 | 21 | `EUR`: 2 |
| COMP_0976 | GROUP_0149 | GBP | BI | yes | `EUR`: 1; `GBP`: 2 | none | `EUR`: 115; `GBP`: 964 | `EUR`: 385; `GBP`: 737 | 14 | none |
| COMP_0977 | GROUP_0080 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,586 | `EUR`: 2,190; `USD`: 12 | 25 | `EUR`: 2 |
| COMP_0978 | GROUP_0142 | EUR | BDIL | no | `EUR`: 12 | `EUR`: 3 | `EUR`: 2,249 | `EUR`: 331 | 9 | `EUR`: 14 |
| COMP_0979 | GROUP_0018 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 121 | `EUR`: 35 | 17 | `EUR`: 1 |
| COMP_0980 | GROUP_0118 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 545 | none | 0 | `EUR`: 1 |
| COMP_0981 | GROUP_0118 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 161 | none | 0 | `EUR`: 1 |
| COMP_0982 | GROUP_0207 | EUR | BDL | yes | `EUR`: 20; `USD`: 2 | `EUR`: 16 | `EUR`: 3,105; `USD`: 178 | none | 0 | `EUR`: 35; `USD`: 2 |
| COMP_0983 | GROUP_0118 | EUR | BL | no | `EUR`: 6 | none | `EUR`: 6,879 | none | 0 | `EUR`: 5 |
| COMP_0984 | GROUP_0218 | EUR | BIL | yes | `EUR`: 3; `ILS`: 1; `USD`: 2 | none | `EUR`: 83; `ILS`: 388; `USD`: 160 | `EUR`: 143; `ILS`: 66; `USD`: 191 | 13 | `EUR`: 3; `ILS`: 1; `USD`: 2 |
| COMP_0985 | GROUP_0141 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,844 | `EUR`: 2,484 | 25 | `EUR`: 3 |
| COMP_0986 | GROUP_0044 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 448 | `EUR`: 748 | 24 | `EUR`: 1 |
| COMP_0987 | GROUP_0035 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 1,126 | `EUR`: 1,829 | 25 | `EUR`: 5 |
| COMP_0988 | GROUP_0236 | EUR | BDL | yes | `EUR`: 27; `USD`: 1 | `EUR`: 15 | `EUR`: 4,254 | none | 0 | `EUR`: 42; `USD`: 1 |
| COMP_0989 | GROUP_0038 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 46 | `EUR`: 130 | 18 | `EUR`: 2 |
| COMP_0990 | GROUP_0211 | USD | BIL | yes | `HKD`: 1; `USD`: 1 | none | `HKD`: 140; `USD`: 201 | `AUD`: 3; `GBP`: 21; `HKD`: 245; `JPY`: 1; `SGD`: 13; `USD`: 388 | 18 | `HKD`: 1; `USD`: 1 |
| COMP_0991 | GROUP_0127 | EUR | BDL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 51 | none | 0 | `EUR`: 2 |
| COMP_0992 | GROUP_0185 | EUR | BIL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 252; `USD`: 18 | `EUR`: 218 | 15 | `EUR`: 2; `USD`: 1 |
| COMP_0993 | GROUP_0226 | EUR | BDIL | no | `EUR`: 11 | `EUR`: 6 | `EUR`: 3,588 | `EUR`: 3,965 | 23 | `<unknown>`: 3; `EUR`: 17 |
| COMP_0994 | GROUP_0037 | EUR | BDIL | yes | `EUR`: 8; `USD`: 1 | `EUR`: 4 | `EUR`: 578; `USD`: 55 | `EUR`: 654; `USD`: 45 | 24 | `EUR`: 12; `USD`: 1 |
| COMP_0995 | GROUP_0113 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 4 | `EUR`: 6,825 | `EUR`: 1,060 | 20 | `EUR`: 10 |
| COMP_0996 | GROUP_0203 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 997 | `EUR`: 1,258 | 20 | `EUR`: 2 |
| COMP_0997 | GROUP_0117 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 162 | `EUR`: 29 | 9 | `EUR`: 2 |
| COMP_0998 | GROUP_0192 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 4,691 | none | 0 | `EUR`: 2 |
| COMP_0999 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,804 | `EUR`: 3,133 | 24 | `EUR`: 2 |
| COMP_1000 | GROUP_0105 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 808 | `EUR`: 295 | 6 | `EUR`: 1 |
| COMP_1001 | GROUP_0143 | EUR | BDL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 11,898 | none | 0 | `EUR`: 6 |
| COMP_1002 | GROUP_0185 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 261 | `EUR`: 230 | 13 | `EUR`: 1 |
| COMP_1003 | GROUP_0132 | MXN | BIL | yes | `MXN`: 2; `USD`: 1 | none | `MXN`: 3,050; `USD`: 56 | `EUR`: 21; `MXN`: 3,122; `USD`: 148 | 25 | `MXN`: 2; `USD`: 1 |
| COMP_1004 | GROUP_0109 | USD | BIL | yes | `USD`: 4 | none | `USD`: 4,458 | `CAD`: 140; `EUR`: 380; `MXN`: 23; `USD`: 2,995 | 16 | `USD`: 3 |
| COMP_1005 | GROUP_0172 | EUR | BDL | no | `EUR`: 3 | `EUR`: 4 | `EUR`: 6,655 | none | 0 | `EUR`: 7 |
| COMP_1006 | GROUP_0163 | EUR | BIL | yes | `EUR`: 15; `USD`: 1 | none | `EUR`: 4,106 | `EUR`: 2,235 | 25 | `EUR`: 14 |
| COMP_1007 | GROUP_0159 | EUR | BDL | no | `EUR`: 4 | `EUR`: 3 | `EUR`: 797 | none | 0 | `<unknown>`: 1; `EUR`: 7 |
| COMP_1008 | GROUP_0220 | EUR | BDIL | yes | `EUR`: 7; `GBP`: 2; `USD`: 1 | `EUR`: 2 | `EUR`: 125; `GBP`: 1,569; `USD`: 13 | `EUR`: 7; `GBP`: 128 | 9 | `EUR`: 8; `GBP`: 2; `USD`: 1 |
| COMP_1009 | GROUP_0059 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 32 | `EUR`: 35 | 10 | `EUR`: 2 |
| COMP_1010 | GROUP_0138 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 1,784 | none | 0 | `EUR`: 3 |
| COMP_1011 | GROUP_0155 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 381 | `EUR`: 641 | 25 | `EUR`: 2 |
| COMP_1012 | GROUP_0032 | EUR | BDL | no | `EUR`: 13 | `EUR`: 10 | `EUR`: 1,752 | none | 0 | `EUR`: 21 |
| COMP_1013 | GROUP_0108 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 857 | `EUR`: 1,087; `GBP`: 3; `USD`: 6 | 22 | `EUR`: 3 |
| COMP_1014 | GROUP_0132 | AUD | BL | no | `AUD`: 3 | none | `AUD`: 995 | none | 0 | `AUD`: 3 |
| COMP_1015 | GROUP_0132 | USD | BL | no | `USD`: 4 | none | `USD`: 1,078 | none | 0 | `USD`: 4 |
| COMP_1016 | GROUP_0069 | EUR | BDIL | no | `EUR`: 39 | `EUR`: 2 | `EUR`: 2,910 | `EUR`: 2,771 | 23 | `EUR`: 41 |
| COMP_1017 | GROUP_0108 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 601 | `EUR`: 1,372 | 15 | `EUR`: 2 |
| COMP_1018 | GROUP_0060 | USD | BIL | yes | `CHF`: 1; `EUR`: 1; `USD`: 2 | none | `CHF`: 169; `EUR`: 373; `USD`: 190 | `CHF`: 289; `EUR`: 1,154; `GBP`: 2; `USD`: 233 | 14 | `CHF`: 1; `EUR`: 1; `USD`: 2 |
| COMP_1019 | GROUP_0118 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 3,792 | `EUR`: 827 | 9 | `EUR`: 3 |
| COMP_1020 | GROUP_0195 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 658 | `EUR`: 1,072 | 25 | `<unknown>`: 1; `EUR`: 3 |
| COMP_1021 | GROUP_0236 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 485 | none | 0 | `EUR`: 2 |
| COMP_1022 | GROUP_0126 | MXN | BIL | yes | `MXN`: 1 | none | `MXN`: 2,791 | `EUR`: 33; `MXN`: 437 | 25 | `MXN`: 1 |
| COMP_1023 | GROUP_0119 | NOK | BL | yes | `NOK`: 4; `USD`: 2 | none | `NOK`: 482; `USD`: 76 | none | 0 | `NOK`: 4; `USD`: 2 |
| COMP_1024 | GROUP_0226 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 4 | `EUR`: 4,201 | `EUR`: 1,255 | 22 | `EUR`: 11 |
| COMP_1025 | GROUP_0032 | EUR | BDL | no | `EUR`: 8 | `EUR`: 4 | `EUR`: 2,031 | none | 0 | `EUR`: 11 |
| COMP_1026 | GROUP_0186 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 72 | `EUR`: 78 | 19 | `EUR`: 5 |
| COMP_1027 | GROUP_0095 | EUR | BDSL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 433 | none | 0 | `EUR`: 4 |
| COMP_1028 | GROUP_0069 | EUR | BDIL | no | `EUR`: 11 | `EUR`: 2 | `EUR`: 492 | `EUR`: 362 | 24 | `EUR`: 13 |
| COMP_1029 | GROUP_0016 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 246 | `EUR`: 140 | 24 | `EUR`: 3 |
| COMP_1030 | GROUP_0108 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 306 | `EUR`: 694 | 14 | `EUR`: 2 |
| COMP_1031 | GROUP_0187 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,737 | none | 0 | `EUR`: 1 |
| COMP_1032 | GROUP_0023 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 71 | `EUR`: 13 | 8 | `EUR`: 1 |
| COMP_1033 | GROUP_0142 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 449 | `EUR`: 102 | 8 | `EUR`: 2 |
| COMP_1034 | GROUP_0128 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,108 | none | 0 | `EUR`: 2 |
| COMP_1035 | GROUP_0148 | EUR | BDIL | no | `EUR`: 15 | `EUR`: 2 | `EUR`: 7,493 | `EUR`: 1,840 | 21 | `EUR`: 17 |
| COMP_1036 | GROUP_0121 | EUR | BDSL | no | `EUR`: 27 | `EUR`: 42 | `EUR`: 4,467 | none | 0 | `<unknown>`: 3; `EUR`: 69 |
| COMP_1037 | GROUP_0081 | EUR | BDIL | no | `EUR`: 15 | `EUR`: 5 | `EUR`: 16,430 | `EUR`: 3,008 | 16 | `EUR`: 20 |
| COMP_1038 | GROUP_0018 | EUR | BDSIL | no | `EUR`: 23 | `EUR`: 34 | `EUR`: 1,810 | `EUR`: 501 | 24 | `EUR`: 56 |
| COMP_1039 | GROUP_0146 | EUR | BDL | no | `EUR`: 5 | `EUR`: 4 | `EUR`: 1,205 | none | 0 | `EUR`: 9 |
| COMP_1040 | GROUP_0056 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 213 | `EUR`: 43 | 8 | `EUR`: 2 |
| COMP_1041 | GROUP_0007 | EUR | BL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 63; `USD`: 24 | none | 0 | `EUR`: 1; `USD`: 1 |
| COMP_1042 | GROUP_0012 | EUR | BIL | yes | `EUR`: 3; `GBP`: 1; `USD`: 1 | none | `EUR`: 127; `USD`: 3 | `COP`: 1; `EUR`: 874; `GBP`: 1; `HUF`: 2; `USD`: 7 | 24 | `EUR`: 3; `GBP`: 1; `USD`: 1 |
| COMP_1043 | GROUP_0047 | EUR | BIL | yes | `EUR`: 3 | none | `<unknown>`: 20; `EUR`: 1,026 | `EUR`: 1,543; `USD`: 1 | 13 | `EUR`: 3 |
| COMP_1044 | GROUP_0076 | EUR | BL | no | `EUR`: 9 | none | `EUR`: 5,959 | none | 0 | `EUR`: 9 |
| COMP_1045 | GROUP_0141 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 3,431 | `EUR`: 2,427 | 25 | `EUR`: 3 |
| COMP_1046 | GROUP_0079 | EUR | BDIL | yes | `EUR`: 5 | `EUR`: 7 | `EUR`: 1,483 | `EUR`: 4,302; `MAD`: 13; `USD`: 72 | 15 | `EUR`: 12 |
| COMP_1047 | GROUP_0092 | EUR | BDL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 388 | none | 0 | `EUR`: 4 |
| COMP_1048 | GROUP_0067 | EUR | BDL | no | `EUR`: 9 | `EUR`: 1 | `EUR`: 11,377 | none | 0 | `EUR`: 10 |
| COMP_1049 | GROUP_0025 | EUR | BDIL | no | `EUR`: 13 | `EUR`: 6 | `EUR`: 4,091 | `EUR`: 3,443 | 25 | `EUR`: 19 |
| COMP_1050 | GROUP_0047 | EUR | BIL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 372 | `EUR`: 1,447 | 14 | `EUR`: 1; `USD`: 1 |
| COMP_1051 | GROUP_0095 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 43 | none | 0 | `EUR`: 2 |
| COMP_1052 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 707 | `EUR`: 779 | 22 | `EUR`: 2 |
| COMP_1053 | GROUP_0002 | EUR | BDSL | yes | `EUR`: 15; `GBP`: 1; `USD`: 8 | `EUR`: 25; `USD`: 1 | `EUR`: 13,107; `GBP`: 72; `USD`: 1,260 | none | 0 | `EUR`: 40; `GBP`: 1; `USD`: 9 |
| COMP_1054 | GROUP_0159 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 77 | none | 0 | `EUR`: 1 |
| COMP_1055 | GROUP_0087 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 164 | none | 0 | `EUR`: 2 |
| COMP_1056 | GROUP_0152 | GBP | BL | yes | `CHF`: 3; `EUR`: 3; `GBP`: 3; `USD`: 3 | none | `CHF`: 11; `EUR`: 63; `GBP`: 235; `USD`: 901 | none | 0 | `CHF`: 3; `EUR`: 3; `GBP`: 3; `USD`: 3 |
| COMP_1057 | GROUP_0218 | USD | BIL | yes | `EUR`: 2; `USD`: 2 | none | `EUR`: 926; `USD`: 106 | `EUR`: 252; `USD`: 156 | 14 | `EUR`: 2; `USD`: 2 |
| COMP_1058 | GROUP_0124 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 464 | `EUR`: 324 | 25 | `EUR`: 2 |
| COMP_1059 | GROUP_0131 | EUR | BDL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 2,367 | none | 0 | `EUR`: 6 |
| COMP_1060 | GROUP_0138 | EUR | BL | no | `EUR`: 9 | none | `EUR`: 654 | none | 0 | `EUR`: 9 |
| COMP_1061 | GROUP_0111 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 822 | `EUR`: 1,899 | 25 | `EUR`: 2 |
| COMP_1062 | GROUP_0048 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 221 | `EUR`: 304 | 9 | `EUR`: 1 |
| COMP_1063 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,386 | `EUR`: 4,105 | 24 | `EUR`: 2 |
| COMP_1064 | GROUP_0056 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 557 | `EUR`: 635 | 25 | `<unknown>`: 1; `EUR`: 5 |
| COMP_1065 | GROUP_0215 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 93 | `EUR`: 201 | 4 | `EUR`: 2 |
| COMP_1066 | GROUP_0051 | EUR | BDL | yes | `EUR`: 5; `GBP`: 1; `USD`: 1 | `EUR`: 16 | `EUR`: 15,120; `GBP`: 1 | none | 0 | `EUR`: 21 |
| COMP_1067 | GROUP_0211 | AUD | BIL | yes | `AUD`: 3; `CAD`: 2; `EUR`: 1; `GBP`: 2; `HKD`: 2; `NZD`: 3; `SGD`: 2; `USD`: 2 | none | `AUD`: 6,695; `CAD`: 55; `EUR`: 39; `GBP`: 353; `HKD`: 31; `NZD`: 865; `SGD`: 177; `USD`: 944 | `AUD`: 2,188; `CAD`: 6; `EUR`: 38; `GBP`: 81; `HKD`: 15; `NOK`: 1; `NZD`: 118; `SGD`: 17; `USD`: 715 | 25 | `AUD`: 3; `CAD`: 2; `EUR`: 1; `GBP`: 2; `HKD`: 2; `NZD`: 3; `SGD`: 2; `USD`: 2 |
| COMP_1068 | GROUP_0209 | GBP | BDSL | no | `EUR`: 11 | `EUR`: 15 | `EUR`: 12 | none | 0 | `EUR`: 25 |
| COMP_1069 | GROUP_0155 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 449 | `EUR`: 170 | 21 | `EUR`: 2 |
| COMP_1070 | GROUP_0031 | EUR | BDSIL | no | `EUR`: 5 | `EUR`: 13 | `EUR`: 1,995 | `EUR`: 3,071 | 25 | `EUR`: 16 |
| COMP_1071 | GROUP_0164 | GBP | BIL | yes | `EUR`: 2; `GBP`: 2; `USD`: 2 | none | `EUR`: 52; `GBP`: 47; `USD`: 54 | `EUR`: 8; `GBP`: 7; `USD`: 1 | 8 | `EUR`: 2; `GBP`: 2; `USD`: 2 |
| COMP_1072 | GROUP_0081 | EUR | BDSIL | no | `EUR`: 16 | `EUR`: 3 | `EUR`: 15,391 | `EUR`: 3,384 | 16 | `EUR`: 19 |
| COMP_1073 | GROUP_0142 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 28 | `EUR`: 13 | 7 | `EUR`: 1 |
| COMP_1074 | GROUP_0238 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 766 | `EUR`: 766 | 18 | `EUR`: 2 |
| COMP_1075 | GROUP_0022 | EUR | BL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | none | `EUR`: 1,061; `USD`: 1 | none | 0 | `EUR`: 2; `GBP`: 1; `USD`: 1 |
| COMP_1076 | GROUP_0131 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 1,105 | none | 0 | `EUR`: 4 |
| COMP_1077 | GROUP_0081 | EUR | BDIL | no | `EUR`: 13 | `EUR`: 1 | `EUR`: 14,930 | `EUR`: 3,694 | 16 | `EUR`: 14 |
| COMP_1078 | GROUP_0013 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 625 | `EUR`: 1,087 | 25 | `EUR`: 2 |
| COMP_1079 | GROUP_0141 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 6 | `EUR`: 1,053 | `EUR`: 449 | 25 | `EUR`: 9 |
| COMP_1080 | GROUP_0007 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 228 | none | 0 | `EUR`: 1 |
| COMP_1081 | GROUP_0108 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 4,177 | `EUR`: 3,159 | 24 | `EUR`: 5 |
| COMP_1082 | GROUP_0142 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 462 | `EUR`: 83 | 8 | `EUR`: 4 |
| COMP_1083 | GROUP_0199 | PLN | BL | yes | `EUR`: 2; `PLN`: 2; `USD`: 2 | none | `EUR`: 11; `PLN`: 117; `USD`: 5 | none | 0 | `EUR`: 2; `PLN`: 1; `USD`: 2 |
| COMP_1084 | GROUP_0172 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 807 | none | 0 | `EUR`: 1 |
| COMP_1085 | GROUP_0137 | AUD | BIL | yes | `AUD`: 3 | none | `AUD`: 351 | `AUD`: 111; `EUR`: 4; `JPY`: 2; `USD`: 26; `ZAR`: 1 | 21 | `AUD`: 3 |
| COMP_1086 | GROUP_0193 | EUR | BDL | yes | `EUR`: 9; `GBP`: 1; `USD`: 3 | `EUR`: 2 | `EUR`: 18,695; `USD`: 43 | none | 0 | `EUR`: 11; `GBP`: 1; `USD`: 3 |
| COMP_1087 | GROUP_0182 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 1,307 | none | 0 | `EUR`: 1 |
| COMP_1088 | GROUP_0234 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 75 | none | 0 | `EUR`: 1 |
| COMP_1089 | GROUP_0108 | USD | BIL | yes | `USD`: 2 | none | `USD`: 415 | `EUR`: 104; `USD`: 351 | 18 | `USD`: 2 |
| COMP_1090 | GROUP_0070 | EUR | BL | no | `EUR`: 7 | none | `EUR`: 17,352 | none | 0 | `EUR`: 7 |
| COMP_1091 | GROUP_0103 | EUR | BDL | no | `EUR`: 4 | `EUR`: 7 | `EUR`: 17,126 | none | 0 | `EUR`: 11 |
| COMP_1092 | GROUP_0236 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 265 | none | 0 | `EUR`: 3 |
| COMP_1093 | GROUP_0200 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 989 | `EUR`: 388 | 10 | `EUR`: 6 |
| COMP_1094 | GROUP_0017 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 380 | none | 0 | `EUR`: 2 |
| COMP_1095 | GROUP_0118 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 4,958 | `EUR`: 2,612; `USD`: 1 | 21 | `EUR`: 3 |
| COMP_1096 | GROUP_0125 | EUR | BL | no | `EUR`: 6 | none | `EUR`: 5,523 | none | 0 | `EUR`: 6 |
| COMP_1097 | GROUP_0044 | EUR | BIL | yes | `AED`: 1; `EUR`: 1; `USD`: 1 | none | `AED`: 72; `EUR`: 12; `USD`: 17 | `EUR`: 58 | 7 | `<unknown>`: 2; `AED`: 1; `EUR`: 1; `USD`: 1 |
| COMP_1098 | GROUP_0103 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 427 | none | 0 | `EUR`: 1 |
| COMP_1099 | GROUP_0125 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 1,295 | none | 0 | `EUR`: 2 |
| COMP_1100 | GROUP_0070 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 138 | `EUR`: 31 | 11 | `EUR`: 2 |
| COMP_1101 | GROUP_0236 | EUR | BDL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 75 | none | 0 | `EUR`: 2 |
| COMP_1102 | GROUP_0087 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 905 | none | 0 | `EUR`: 1 |
| COMP_1103 | GROUP_0236 | GBP | BL | yes | `EUR`: 2; `GBP`: 2; `USD`: 1 | none | `EUR`: 40; `GBP`: 164 | none | 0 | `EUR`: 2; `GBP`: 2; `USD`: 1 |
| COMP_1104 | GROUP_0107 | USD | BIL | yes | `USD`: 3 | none | `USD`: 491 | `CAD`: 2; `EUR`: 1; `GBP`: 1; `INR`: 5; `JPY`: 1; `USD`: 161; `ZAR`: 1 | 9 | `USD`: 3 |
| COMP_1105 | GROUP_0094 | CLP | BIL | yes | `CLP`: 1 | none | `CLP`: 2,679 | `CAD`: 1; `CLP`: 4,613; `USD`: 3 | 25 | `CLP`: 1 |
| COMP_1106 | GROUP_0056 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 4 | `EUR`: 530 | `EUR`: 536 | 21 | `<unknown>`: 3; `EUR`: 8 |
| COMP_1107 | GROUP_0103 | EUR | BDL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 3,152 | none | 0 | `EUR`: 5 |
| COMP_1108 | GROUP_0119 | DKK | BIL | yes | `DKK`: 1; `EUR`: 1; `USD`: 1 | none | `DKK`: 264; `EUR`: 26; `USD`: 92 | `DKK`: 87; `EUR`: 22; `GBP`: 3; `NOK`: 1; `USD`: 132 | 24 | `DKK`: 1; `EUR`: 1; `USD`: 1 |
| COMP_1109 | GROUP_0205 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,588 | `EUR`: 4,000 | 18 | `EUR`: 2 |
| COMP_1110 | GROUP_0182 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 2,920 | `EUR`: 602 | 18 | `EUR`: 4 |
| COMP_1111 | GROUP_0169 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 362 | none | 0 | `EUR`: 1 |
| COMP_1112 | GROUP_0170 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 254 | none | 0 | `EUR`: 1 |
| COMP_1113 | GROUP_0018 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 136 | `EUR`: 92 | 16 | `EUR`: 4 |
| COMP_1114 | GROUP_0236 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 67 | none | 0 | `EUR`: 1 |
| COMP_1115 | GROUP_0064 | EUR | BL | yes | `MXN`: 1; `USD`: 1 | none | `<unknown>`: 573; `MXN`: 336; `USD`: 164 | none | 0 | `MXN`: 1; `USD`: 1 |
| COMP_1116 | GROUP_0169 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 237 | none | 0 | `EUR`: 1 |
| COMP_1117 | GROUP_0139 | EUR | BDL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 57 | none | 0 | `EUR`: 2 |
| COMP_1118 | GROUP_0023 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 144 | `EUR`: 126 | 11 | `EUR`: 1 |
| COMP_1119 | GROUP_0187 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 317 | none | 0 | `EUR`: 2 |
| COMP_1120 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 96 | `EUR`: 119 | 24 | `EUR`: 1 |
| COMP_1121 | GROUP_0165 | EUR | BDSL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 1,631 | none | 0 | `EUR`: 2 |
| COMP_1122 | GROUP_0132 | EUR | BIL | yes | `CAD`: 1 | none | `CAD`: 566 | `CAD`: 625; `EUR`: 18; `USD`: 32 | 25 | `CAD`: 1 |
| COMP_1123 | GROUP_0126 | MXN | BIL | yes | `MXN`: 1 | none | `MXN`: 2,066 | `EUR`: 148; `MXN`: 1,369 | 25 | `<unknown>`: 2; `MXN`: 1 |
| COMP_1124 | GROUP_0148 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 3 | `EUR`: 4,683 | `EUR`: 1,280 | 21 | `EUR`: 9 |
| COMP_1125 | GROUP_0063 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 316 | none | 0 | `EUR`: 2 |
| COMP_1126 | GROUP_0149 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 2,957 | `EUR`: 510 | 8 | `EUR`: 4 |
| COMP_1127 | GROUP_0108 | EUR | BIL | no | `EUR`: 6 | none | `EUR`: 1,530 | `EUR`: 1,194 | 23 | `EUR`: 6 |
| COMP_1128 | GROUP_0085 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 255 | none | 0 | `EUR`: 1 |
| COMP_1129 | GROUP_0024 | EUR | BDL | no | `EUR`: 4 | `EUR`: 4 | `EUR`: 15,101 | none | 0 | `EUR`: 8 |
| COMP_1130 | GROUP_0126 | EUR | BDL | yes | `EUR`: 4; `USD`: 1 | `EUR`: 1 | `EUR`: 2,054; `USD`: 10 | none | 0 | `EUR`: 5; `USD`: 1 |
| COMP_1131 | GROUP_0143 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 2,140 | none | 0 | `EUR`: 1 |
| COMP_1132 | GROUP_0114 | EUR | BL | yes | `EUR`: 2; `USD`: 1 | none | `EUR`: 790; `USD`: 55 | none | 0 | `EUR`: 2; `USD`: 1 |
| COMP_1133 | GROUP_0086 | EUR | BDL | yes | `EUR`: 4; `USD`: 2 | `EUR`: 3 | `EUR`: 5,766; `USD`: 4 | none | 0 | `EUR`: 7; `USD`: 2 |
| COMP_1134 | GROUP_0035 | EUR | BDIL | no | `EUR`: 7 | `EUR`: 3 | `EUR`: 1,535 | `EUR`: 761 | 24 | `EUR`: 10 |
| COMP_1135 | GROUP_0081 | EUR | BDIL | no | `EUR`: 13 | `EUR`: 1 | `EUR`: 11,007 | `EUR`: 1,956 | 16 | `EUR`: 14 |
| COMP_1136 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,496 | `EUR`: 1,681 | 23 | `EUR`: 2 |
| COMP_1137 | GROUP_0159 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 155 | none | 0 | `EUR`: 1 |
| COMP_1138 | GROUP_0155 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,769 | `EUR`: 2,004 | 25 | `EUR`: 1 |
| COMP_1139 | GROUP_0197 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 4,163 | `EUR`: 3,697 | 25 | `EUR`: 2 |
| COMP_1140 | GROUP_0011 | EUR | BL | no | `EUR`: 4 | none | `EUR`: 673 | none | 0 | `EUR`: 4 |
| COMP_1141 | GROUP_0009 | USD | BL | yes | `EUR`: 3; `GBP`: 4; `USD`: 5 | none | `EUR`: 9; `GBP`: 5,092; `USD`: 120 | none | 0 | `EUR`: 3; `GBP`: 4; `USD`: 5 |
| COMP_1142 | GROUP_0202 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 439 | `EUR`: 1,268 | 25 | `EUR`: 2 |
| COMP_1143 | GROUP_0079 | EUR | BDSIL | yes | `EUR`: 5 | `EUR`: 5 | `EUR`: 2,039 | `EUR`: 4,691; `MAD`: 7; `USD`: 40 | 13 | `EUR`: 10 |
| COMP_1144 | GROUP_0064 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 60 | none | 0 | `EUR`: 2 |
| COMP_1145 | GROUP_0092 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 546 | none | 0 | `EUR`: 2 |
| COMP_1146 | GROUP_0032 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 1,211 | none | 0 | `EUR`: 3 |
| COMP_1147 | GROUP_0181 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 703 | none | 0 | `EUR`: 1 |
| COMP_1148 | GROUP_0165 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 56 | none | 0 | `EUR`: 1 |
| COMP_1149 | GROUP_0057 | EUR | BDIL | no | `EUR`: 21 | `EUR`: 5 | `EUR`: 3,034 | `EUR`: 1,438 | 16 | `EUR`: 26 |
| COMP_1150 | GROUP_0106 | EUR | BDL | no | `EUR`: 12 | `EUR`: 6 | `EUR`: 1,135 | none | 0 | `EUR`: 17 |
| COMP_1151 | GROUP_0016 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 126 | none | 0 | `EUR`: 1 |
| COMP_1152 | GROUP_0128 | EUR | BL | no | `EUR`: 12 | none | `EUR`: 14,220 | none | 0 | `EUR`: 12 |
| COMP_1153 | GROUP_0150 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 158 | none | 0 | `EUR`: 3 |
| COMP_1154 | GROUP_0023 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 77 | none | 0 | `EUR`: 1 |
| COMP_1155 | GROUP_0150 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1; `USD`: 2 | none | `EUR`: 207; `USD`: 270 | `EUR`: 95; `USD`: 122 | 9 | `EUR`: 1; `GBP`: 1; `USD`: 2 |
| COMP_1156 | GROUP_0141 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 409 | `EUR`: 197 | 25 | `EUR`: 2 |
| COMP_1157 | GROUP_0150 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 1,562 | none | 0 | `EUR`: 3 |
| COMP_1158 | GROUP_0222 | EUR | BIL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 257; `USD`: 1 | `EUR`: 256; `USD`: 2 | 23 | `EUR`: 1; `USD`: 1 |
| COMP_1159 | GROUP_0235 | EUR | BIL | yes | `EUR`: 8; `GBP`: 1; `USD`: 1 | none | `EUR`: 5,441; `GBP`: 8; `USD`: 18 | `EUR`: 3,456; `GBP`: 7; `USD`: 16 | 16 | `EUR`: 8; `GBP`: 1; `USD`: 1 |
| COMP_1160 | GROUP_0158 | EUR | BDL | no | `EUR`: 9 | `EUR`: 1 | `EUR`: 8,076 | none | 0 | `EUR`: 10 |
| COMP_1161 | GROUP_0047 | EUR | BIL | yes | `EUR`: 2; `USD`: 2 | none | `EUR`: 1,753; `USD`: 53 | `EUR`: 2,657; `GBP`: 1; `USD`: 39 | 15 | `EUR`: 2; `USD`: 2 |
| COMP_1162 | GROUP_0116 | EUR | BIL | yes | `EUR`: 6; `JPY`: 1; `USD`: 3 | none | `EUR`: 151; `JPY`: 24; `USD`: 216 | `DKK`: 1; `EUR`: 74; `GBP`: 2; `JPY`: 16; `USD`: 170 | 16 | `EUR`: 6; `JPY`: 1; `USD`: 3 |
| COMP_1163 | GROUP_0101 | EUR | BIL | yes | `EUR`: 2; `GBP`: 2; `JPY`: 1; `USD`: 2 | none | `EUR`: 564; `GBP`: 69; `USD`: 284 | `CAD`: 34; `EUR`: 659; `GBP`: 120; `PLN`: 25; `SEK`: 45; `USD`: 135 | 25 | `EUR`: 2; `GBP`: 2; `JPY`: 1; `USD`: 2 |
| COMP_1164 | GROUP_0095 | EUR | BDL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 279 | none | 0 | `EUR`: 6 |
| COMP_1165 | GROUP_0108 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 1,543 | `EUR`: 1,980; `GBP`: 3; `USD`: 4 | 20 | `EUR`: 4 |
| COMP_1166 | GROUP_0086 | USD | BL | no | `USD`: 2 | none | `USD`: 3,444 | none | 0 | `USD`: 2 |
| COMP_1167 | GROUP_0212 | EUR | BDL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 4,678 | none | 0 | `EUR`: 7 |
| COMP_1168 | GROUP_0037 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 1,788 | `EUR`: 4,023; `GBP`: 7; `NOK`: 2 | 25 | `EUR`: 2 |
| COMP_1169 | GROUP_0095 | EUR | BDIL | no | `EUR`: 9 | `EUR`: 38 | `EUR`: 3,975 | `EUR`: 1,698 | 25 | `EUR`: 47 |
| COMP_1170 | GROUP_0090 | EUR | BIL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 206; `USD`: 1 | `EUR`: 58; `USD`: 3 | 24 | `EUR`: 1; `USD`: 1 |
| COMP_1171 | GROUP_0139 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 9 | `EUR`: 1,132 | `EUR`: 1,363 | 25 | `EUR`: 15 |
| COMP_1172 | GROUP_0053 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 3,823 | `EUR`: 4,376 | 20 | `EUR`: 2 |
| COMP_1173 | GROUP_0202 | EUR | BDIL | yes | `EUR`: 3; `USD`: 1 | `EUR`: 2 | `EUR`: 1,227; `USD`: 115 | `EUR`: 1,989; `MXN`: 4; `USD`: 23 | 25 | `EUR`: 5; `USD`: 1 |
| COMP_1174 | GROUP_0148 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 1,983 | `EUR`: 1,169 | 18 | `EUR`: 3 |
| COMP_1175 | GROUP_0196 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 56 | `EUR`: 40; `GBP`: 2 | 14 | `EUR`: 1 |
| COMP_1176 | GROUP_0184 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,516 | `EUR`: 4,623 | 16 | `EUR`: 1 |
| COMP_1177 | GROUP_0120 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 1,731 | `EUR`: 4,494 | 25 | `EUR`: 1 |
| COMP_1178 | GROUP_0159 | EUR | BDL | no | `EUR`: 9 | `EUR`: 1 | `EUR`: 18,597 | none | 0 | `EUR`: 10 |
| COMP_1179 | GROUP_0239 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 253 | none | 0 | `EUR`: 2 |
| COMP_1180 | GROUP_0103 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 681 | none | 0 | `EUR`: 1 |
| COMP_1181 | GROUP_0009 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 995 | none | 0 | `EUR`: 3 |
| COMP_1182 | GROUP_0022 | EUR | BDIL | yes | `EUR`: 14; `GBP`: 1; `USD`: 1 | `EUR`: 1 | `EUR`: 5,179; `USD`: 732 | `BRL`: 6; `EUR`: 3,949; `GBP`: 63; `MXN`: 2; `SAR`: 2; `USD`: 327 | 25 | `EUR`: 15; `GBP`: 1; `USD`: 1 |
| COMP_1183 | GROUP_0018 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 122 | `EUR`: 44 | 13 | `EUR`: 1 |
| COMP_1184 | GROUP_0211 | EUR | BIL | yes | `EUR`: 1; `GBP`: 1 | none | `EUR`: 603; `GBP`: 45 | `EUR`: 561; `GBP`: 57; `USD`: 6 | 22 | `EUR`: 1; `GBP`: 1 |
| COMP_1185 | GROUP_0126 | EUR | BDSIL | yes | `EUR`: 9 | `EUR`: 2 | `EUR`: 16,841 | `BRL`: 8; `CAD`: 8; `EUR`: 2,882; `GBP`: 13; `MXN`: 9; `USD`: 11 | 25 | `EUR`: 11 |
| COMP_1186 | GROUP_0135 | PLN | BL | no | `PLN`: 1 | none | `PLN`: 59 | none | 0 | `PLN`: 1 |
| COMP_1187 | GROUP_0179 | GBP | BL | yes | `EUR`: 9; `GBP`: 8; `USD`: 7 | none | `EUR`: 38; `GBP`: 4,201 | none | 0 | `EUR`: 9; `GBP`: 8; `USD`: 7 |
| COMP_1188 | GROUP_0004 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 168 | `EUR`: 71 | 20 | `EUR`: 1 |
| COMP_1189 | GROUP_0159 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 460 | none | 0 | `EUR`: 1 |
| COMP_1190 | GROUP_0119 | USD | BIL | yes | `GBP`: 2; `USD`: 2 | none | `GBP`: 150; `USD`: 339 | `CAD`: 1; `EUR`: 2; `GBP`: 34; `USD`: 108 | 21 | `GBP`: 2; `USD`: 2 |
| COMP_1191 | GROUP_0139 | EUR | BDIL | no | `EUR`: 6 | `EUR`: 7 | `EUR`: 1,210 | `EUR`: 1,870 | 25 | `EUR`: 13 |
| COMP_1192 | GROUP_0094 | COP | BIL | yes | `COP`: 1 | none | `COP`: 1,217 | `COP`: 584; `USD`: 7 | 24 | `COP`: 1 |
| COMP_1193 | GROUP_0081 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 412 | `EUR`: 301 | 10 | `EUR`: 4 |
| COMP_1194 | GROUP_0230 | EUR | BDIL | yes | `EUR`: 6; `USD`: 1 | `EUR`: 1 | `EUR`: 1,880; `USD`: 13 | `EUR`: 1,017; `HUF`: 2; `PLN`: 4 | 22 | `EUR`: 6; `USD`: 1 |
| COMP_1195 | GROUP_0171 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 1 | `EUR`: 6,572 | `EUR`: 2,799 | 9 | `EUR`: 5 |
| COMP_1196 | GROUP_0222 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 733 | `EUR`: 751 | 23 | `EUR`: 2 |
| COMP_1197 | GROUP_0217 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 1,115 | `EUR`: 981 | 25 | `EUR`: 5 |
| COMP_1198 | GROUP_0218 | EUR | BIL | yes | `EUR`: 4; `USD`: 3 | none | `EUR`: 2,039; `USD`: 1,869 | `EUR`: 266; `USD`: 820 | 25 | `EUR`: 4; `USD`: 3 |
| COMP_1199 | GROUP_0016 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 292 | `EUR`: 165 | 24 | `EUR`: 1 |
| COMP_1200 | GROUP_0138 | EUR | BL | no | `EUR`: 2 | none | `EUR`: 61 | none | 0 | `EUR`: 2 |
| COMP_1201 | GROUP_0211 | AUD | BL | yes | `AUD`: 1; `USD`: 2 | none | `AUD`: 453; `USD`: 151 | none | 0 | `AUD`: 1; `USD`: 2 |
| COMP_1202 | GROUP_0115 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 5,107 | none | 0 | `EUR`: 5 |
| COMP_1203 | GROUP_0216 | GBP | BL | yes | `EUR`: 2; `GBP`: 3; `HUF`: 1; `PLN`: 1; `USD`: 1 | none | `EUR`: 1,566; `GBP`: 359; `HUF`: 76; `PLN`: 85; `USD`: 152 | none | 0 | `EUR`: 2; `GBP`: 3; `HUF`: 1; `PLN`: 1; `USD`: 1 |
| COMP_1204 | GROUP_0100 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 3 | `EUR`: 2,165 | `EUR`: 3,418 | 17 | `EUR`: 6 |
| COMP_1205 | GROUP_0011 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 583 | none | 0 | `EUR`: 1 |
| COMP_1206 | GROUP_0084 | EUR | BIL | yes | `EUR`: 3 | none | `EUR`: 2,252 | `DKK`: 1; `EUR`: 1,823; `USD`: 2 | 23 | `EUR`: 3 |
| COMP_1207 | GROUP_0132 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 2,586 | `EUR`: 3,087 | 25 | `EUR`: 2 |
| COMP_1208 | GROUP_0104 | EUR | BDIL | no | `EUR`: 4 | `EUR`: 6 | `EUR`: 1,687 | `EUR`: 341 | 17 | `EUR`: 10 |
| COMP_1209 | GROUP_0079 | EUR | BIL | yes | `EUR`: 4 | none | `EUR`: 725 | `EUR`: 1,738; `USD`: 336 | 23 | `EUR`: 4 |
| COMP_1210 | GROUP_0015 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 85 | `EUR`: 60 | 23 | `EUR`: 2 |
| COMP_1211 | GROUP_0103 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 966 | none | 0 | `EUR`: 3 |
| COMP_1212 | GROUP_0118 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 3,610 | `EUR`: 4,866 | 25 | `EUR`: 5 |
| COMP_1213 | GROUP_0158 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 5,780 | none | 0 | `EUR`: 5 |
| COMP_1214 | GROUP_0100 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 100 | `EUR`: 43 | 9 | `EUR`: 2 |
| COMP_1215 | GROUP_0168 | EUR | BL | no | `EUR`: 17 | none | `EUR`: 14,645 | none | 0 | `EUR`: 17 |
| COMP_1216 | GROUP_0127 | EUR | BDL | no | `EUR`: 14 | `EUR`: 7 | `EUR`: 5,243 | none | 0 | `EUR`: 21 |
| COMP_1217 | GROUP_0144 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 53 | `EUR`: 26 | 14 | `EUR`: 1 |
| COMP_1218 | GROUP_0084 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 362 | `EUR`: 127 | 9 | `EUR`: 1 |
| COMP_1219 | GROUP_0142 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 1 | `EUR`: 1,597 | `EUR`: 323 | 8 | `EUR`: 3 |
| COMP_1220 | GROUP_0169 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 284 | none | 0 | `EUR`: 1 |
| COMP_1221 | GROUP_0169 | EUR | BL | no | `EUR`: 6 | none | `EUR`: 8,706 | none | 0 | `EUR`: 6 |
| COMP_1222 | GROUP_0137 | MXN | BIL | yes | `MXN`: 9; `USD`: 2 | none | `MXN`: 3,052; `USD`: 12 | `MXN`: 37; `USD`: 27 | 14 | `MXN`: 9; `USD`: 2 |
| COMP_1223 | GROUP_0141 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 4,570 | `EUR`: 4,225 | 25 | `EUR`: 2 |
| COMP_1224 | GROUP_0143 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 1,509 | `EUR`: 1,298 | 24 | `EUR`: 2 |
| COMP_1225 | GROUP_0044 | EUR | BDIL | yes | `EUR`: 7 | `EUR`: 5 | `EUR`: 2,450 | `EUR`: 329; `USD`: 2 | 16 | `EUR`: 12 |
| COMP_1226 | GROUP_0160 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 21 | `EUR`: 27 | 19 | `EUR`: 1 |
| COMP_1227 | GROUP_0244 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 267 | `EUR`: 50 | 12 | `EUR`: 2 |
| COMP_1228 | GROUP_0049 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 422 | none | 0 | `EUR`: 1 |
| COMP_1229 | GROUP_0009 | GBP | BL | yes | `EUR`: 1; `GBP`: 1; `USD`: 2 | none | `GBP`: 84; `USD`: 53 | none | 0 | `EUR`: 1; `GBP`: 1; `USD`: 2 |
| COMP_1230 | GROUP_0019 | EUR | BDIL | no | `EUR`: 2 | `EUR`: 8 | `EUR`: 1,095 | `EUR`: 1,583 | 25 | `EUR`: 10 |
| COMP_1231 | GROUP_0234 | EUR | BL | yes | `EUR`: 2; `GBP`: 1; `USD`: 1 | none | `EUR`: 168; `GBP`: 118; `USD`: 90 | none | 0 | `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_1232 | GROUP_0237 | EUR | BDIL | yes | `EUR`: 1 | `EUR`: 2 | `EUR`: 268 | `DKK`: 1; `EUR`: 343; `GBP`: 4; `SEK`: 3; `USD`: 1 | 21 | `EUR`: 3 |
| COMP_1233 | GROUP_0208 | EUR | BDL | no | `EUR`: 11 | `EUR`: 1 | `EUR`: 2,955 | none | 0 | `EUR`: 10 |
| COMP_1234 | GROUP_0142 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 1,890 | `EUR`: 231 | 8 | `EUR`: 4 |
| COMP_1235 | GROUP_0054 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 1,412 | `EUR`: 2,411; `USD`: 9 | 25 | `EUR`: 1 |
| COMP_1236 | GROUP_0157 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 1,942 | `EUR`: 4,128 | 25 | `EUR`: 4 |
| COMP_1237 | GROUP_0206 | EUR | BDIL | yes | `EUR`: 2; `USD`: 1 | `EUR`: 1 | `EUR`: 6,502; `USD`: 6 | `CZK`: 6; `EUR`: 2,857; `PLN`: 11 | 22 | `EUR`: 3; `USD`: 1 |
| COMP_1238 | GROUP_0142 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 175 | `EUR`: 25 | 8 | `EUR`: 1 |
| COMP_1239 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 97 | `EUR`: 142 | 24 | `EUR`: 1 |
| COMP_1240 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 98 | `EUR`: 141 | 24 | `EUR`: 1 |
| COMP_1241 | GROUP_0250 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 106 | `EUR`: 139 | 24 | `EUR`: 1 |
| COMP_1242 | GROUP_0122 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 253 | `EUR`: 413; `USD`: 1 | 19 | `EUR`: 2 |
| COMP_1243 | GROUP_0104 | EUR | BDSIL | no | `EUR`: 5 | `EUR`: 1 | `EUR`: 974 | `EUR`: 3,667 | 23 | `EUR`: 6 |
| COMP_1244 | GROUP_0013 | EUR | BIL | yes | `COP`: 1 | none | `COP`: 303 | `COP`: 548; `USD`: 33 | 15 | `COP`: 1 |
| COMP_1245 | GROUP_0022 | EUR | BDIL | yes | `EUR`: 1 | `EUR`: 2 | `EUR`: 129 | `EUR`: 85; `USD`: 1 | 15 | `EUR`: 3 |
| COMP_1246 | GROUP_0138 | EUR | BL | no | `EUR`: 6 | none | `EUR`: 751 | none | 0 | `EUR`: 6 |
| COMP_1247 | GROUP_0217 | EUR | BIL | no | `EUR`: 5 | none | `EUR`: 118 | `EUR`: 37 | 10 | `EUR`: 5 |
| COMP_1248 | GROUP_0066 | EUR | BL | yes | `EUR`: 6; `USD`: 1 | none | `EUR`: 2,281; `USD`: 72 | none | 0 | `EUR`: 6; `USD`: 1 |
| COMP_1249 | GROUP_0090 | EUR | BDIL | yes | `EUR`: 7; `NOK`: 1; `SEK`: 1; `USD`: 2 | `EUR`: 8 | `EUR`: 3,127; `NOK`: 2; `USD`: 2 | `EUR`: 2,760; `GBP`: 3; `MAD`: 5; `USD`: 23 | 24 | `EUR`: 15; `NOK`: 1; `SEK`: 1; `USD`: 1 |
| COMP_1250 | GROUP_0065 | EUR | BIL | no | `EUR`: 4 | none | `EUR`: 1,918 | `EUR`: 611 | 22 | `EUR`: 4 |
| COMP_1251 | GROUP_0217 | EUR | BIL | yes | `EUR`: 1; `USD`: 1 | none | `EUR`: 28 | `EUR`: 43 | 12 | `EUR`: 1; `USD`: 1 |
| COMP_1252 | GROUP_0070 | EUR | BIL | no | `EUR`: 11 | none | `EUR`: 1,169 | `EUR`: 301 | 22 | `EUR`: 11 |
| COMP_1253 | GROUP_0096 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 149 | `EUR`: 46 | 14 | `EUR`: 1 |
| COMP_1254 | GROUP_0040 | GBP | BL | yes | `EUR`: 1; `GBP`: 1; `USD`: 1 | none | `EUR`: 35; `GBP`: 69; `USD`: 2 | none | 0 | `<unknown>`: 1; `EUR`: 1; `GBP`: 1; `USD`: 1 |
| COMP_1255 | GROUP_0194 | EUR | BL | yes | `NOK`: 1; `SEK`: 3 | none | `NOK`: 6; `SEK`: 99 | none | 0 | `NOK`: 1; `SEK`: 3 |
| COMP_1256 | GROUP_0079 | EUR | BIL | yes | `EUR`: 2 | none | `EUR`: 585 | `EUR`: 1,339; `MAD`: 1 | 24 | `EUR`: 2 |
| COMP_1257 | GROUP_0222 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 452 | `EUR`: 323 | 23 | `EUR`: 3; `USD`: 1 |
| COMP_1258 | GROUP_0056 | EUR | BDIL | no | `EUR`: 1 | `EUR`: 1 | `EUR`: 657 | `EUR`: 132 | 7 | `EUR`: 2 |
| COMP_1259 | GROUP_0151 | EUR | BL | no | `EUR`: 1 | none | `<unknown>`: 1; `EUR`: 38 | none | 0 | `EUR`: 1 |
| COMP_1260 | GROUP_0011 | EUR | BDL | no | `EUR`: 6 | `EUR`: 1 | `EUR`: 1,530 | none | 0 | `EUR`: 7 |
| COMP_1261 | GROUP_0011 | EUR | BDSL | no | `EUR`: 3 | `EUR`: 2 | `EUR`: 136 | none | 0 | `EUR`: 5 |
| COMP_1262 | GROUP_0026 | EUR | BDSIL | no | `EUR`: 7 | `EUR`: 2 | `EUR`: 366 | `EUR`: 195 | 12 | `EUR`: 9 |
| COMP_1263 | GROUP_0091 | EUR | BDL | no | `EUR`: 3 | `EUR`: 1 | `EUR`: 727 | none | 0 | `EUR`: 4 |
| COMP_1264 | GROUP_0155 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 2,896 | `EUR`: 3,247 | 24 | `EUR`: 3 |
| COMP_1265 | GROUP_0078 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 20 | none | 0 | `EUR`: 1 |
| COMP_1266 | GROUP_0087 | CZK | BL | yes | `CZK`: 1; `EUR`: 1 | none | `CZK`: 1,675; `EUR`: 161 | none | 0 | `CZK`: 1; `EUR`: 1 |
| COMP_1267 | GROUP_0095 | EUR | BDSIL | no | `EUR`: 6 | `EUR`: 26 | `EUR`: 3,752 | `EUR`: 2,445 | 24 | `EUR`: 28 |
| COMP_1268 | GROUP_0027 | EUR | BDL | no | `EUR`: 9 | `EUR`: 4 | `EUR`: 8,814 | none | 0 | `EUR`: 13 |
| COMP_1269 | GROUP_0019 | EUR | BDIL | no | `EUR`: 5 | `EUR`: 2 | `EUR`: 863 | `EUR`: 865 | 21 | `EUR`: 7 |
| COMP_1270 | GROUP_0020 | EUR | BL | no | `EUR`: 1 | none | `EUR`: 118 | none | 0 | `EUR`: 1 |
| COMP_1271 | GROUP_0172 | EUR | BDL | no | `EUR`: 4 | `EUR`: 2 | `EUR`: 6,024 | none | 0 | `EUR`: 6 |
| COMP_1272 | GROUP_0077 | EUR | BDL | yes | `EUR`: 13; `USD`: 4 | `EUR`: 22 | `EUR`: 1,411; `USD`: 285 | none | 0 | `EUR`: 35; `USD`: 4 |
| COMP_1273 | GROUP_0241 | EUR | BIL | no | `EUR`: 3 | none | `EUR`: 156 | `EUR`: 164 | 12 | `EUR`: 3 |
| COMP_1274 | GROUP_0213 | EUR | BIL | no | `EUR`: 1 | none | `EUR`: 92 | `EUR`: 52 | 14 | `EUR`: 1 |
| COMP_1275 | GROUP_0067 | EUR | BDL | no | `EUR`: 2 | `EUR`: 3 | `EUR`: 657 | none | 0 | `EUR`: 5 |
| COMP_1276 | GROUP_0103 | EUR | BL | no | `EUR`: 3 | none | `EUR`: 3,035 | none | 0 | `EUR`: 3 |
| COMP_1277 | GROUP_0200 | EUR | BIL | no | `EUR`: 2 | none | `EUR`: 292 | `EUR`: 142 | 15 | `EUR`: 2 |
| COMP_1278 | GROUP_0222 | EUR | BIL | yes | `EUR`: 1 | none | `EUR`: 1,172 | `COP`: 3; `EUR`: 903 | 18 | `EUR`: 1 |
| COMP_1279 | GROUP_0035 | EUR | BDIL | no | `EUR`: 14 | `EUR`: 10 | `EUR`: 9,017 | `EUR`: 1,726 | 24 | `EUR`: 24 |
| COMP_1280 | GROUP_0159 | EUR | BL | no | `EUR`: 5 | none | `EUR`: 356 | none | 0 | `EUR`: 5 |
| COMP_1281 | GROUP_0218 | EUR | BIL | yes | `EUR`: 3; `USD`: 1 | none | `EUR`: 336 | `EUR`: 935; `USD`: 63 | 17 | `EUR`: 3; `USD`: 1 |
| COMP_1282 | GROUP_0218 | EUR | BDIL | yes | `EUR`: 14; `USD`: 5 | `EUR`: 8 | `EUR`: 3,337; `USD`: 112 | `EUR`: 2,902; `USD`: 378 | 25 | `EUR`: 17; `USD`: 5 |
| COMP_1283 | GROUP_0170 | MXN | BL | no | `MXN`: 1 | none | `MXN`: 172 | none | 0 | `MXN`: 1 |
| COMP_1284 | GROUP_0149 | EUR | BDIL | no | `EUR`: 3 | `EUR`: 19 | `EUR`: 974 | `EUR`: 156 | 13 | `EUR`: 22 |
| COMP_1285 | GROUP_0149 | GBP | BI | yes | `GBP`: 1 | none | `GBP`: 113 | `EUR`: 1; `GBP`: 36 | 4 | none |
| COMP_1286 | GROUP_0030 | EUR | BDL | yes | `EUR`: 9; `USD`: 1 | `EUR`: 5 | `EUR`: 9,721; `USD`: 6 | none | 0 | `EUR`: 14; `USD`: 1 |

## 8. Complete known non-EUR product/account exclusion register

Every product with explicit `currency != EUR`, with its company and the exact number of linked transaction records. Zero in the last column means no transaction records linked to that product, **not** a complete zero-flow period. Product IDs remain strings with leading zeros. The orphan product tables in Section 3 separately cover unknown currency. There is no explicit multi-currency product row; multiple currencies per company are enumerated in Section 7. This register supports filtering and evidence tracking without showing account numbers, labels, bank names, or narratives.

| product_id | company_id | Product source | type | currency | Transaction record count |
| --- | --- | --- | --- | --- | --- |
| PRODUCT_00033 | COMP_0808 | banking_products | checking | USD | 256 |
| PRODUCT_00039 | COMP_1229 | banking_products | checking | GBP | 84 |
| PRODUCT_00051 | COMP_0252 | banking_products | checking | AED | 0 |
| PRODUCT_00060 | COMP_1141 | banking_products | checking | USD | 11 |
| PRODUCT_00066 | COMP_0361 | banking_products | checking | AUD | 0 |
| PRODUCT_00070 | COMP_0612 | banking_products | checking | USD | 149 |
| PRODUCT_00078 | COMP_0279 | banking_products | checking | USD | 0 |
| PRODUCT_00082 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_00100 | COMP_0656 | banking_products | checking | GBP | 0 |
| PRODUCT_00107 | COMP_0693 | banking_products | checking | USD | 3805 |
| PRODUCT_00113 | COMP_0252 | banking_products | checking | USD | 0 |
| PRODUCT_00122 | COMP_0612 | banking_products | checking | USD | 15 |
| PRODUCT_00126 | COMP_0252 | banking_products | checking | CZK | 0 |
| PRODUCT_00132 | COMP_1053 | banking_products | checking | USD | 13 |
| PRODUCT_00133 | COMP_0560 | banking_products | checking | USD | 0 |
| PRODUCT_00134 | COMP_1014 | banking_products | checking | AUD | 243 |
| PRODUCT_00148 | COMP_0323 | banking_products | checking | USD | 157 |
| PRODUCT_00177 | COMP_0856 | banking_products | checking | USD | 3 |
| PRODUCT_00182 | COMP_0370 | banking_products | checking | USD | 0 |
| PRODUCT_00185 | COMP_0351 | banking_products | checking | USD | 0 |
| PRODUCT_00197 | COMP_1067 | banking_products | checking | SGD | 18 |
| PRODUCT_00225 | COMP_0158 | banking_products | checking | USD | 7 |
| PRODUCT_00231 | COMP_0832 | banking_products | checking | GBP | 0 |
| PRODUCT_00236 | COMP_0240 | banking_products | checking | CAD | 50 |
| PRODUCT_00239 | COMP_0351 | banking_products | checking | USD | 0 |
| PRODUCT_00240 | COMP_0252 | banking_products | checking | RON | 0 |
| PRODUCT_00247 | COMP_1141 | banking_products | checking | GBP | 297 |
| PRODUCT_00253 | COMP_0029 | banking_products | checking | SGD | 0 |
| PRODUCT_00256 | COMP_0848 | banking_products | checking | USD | 862 |
| PRODUCT_00269 | COMP_0075 | banking_products | checking | USD | 15 |
| PRODUCT_00270 | COMP_0919 | debt_products | confirming | USD | 0 |
| PRODUCT_00275 | COMP_0469 | banking_products | checking | CLP | 768 |
| PRODUCT_00300 | COMP_0361 | banking_products | checking | CZK | 0 |
| PRODUCT_00302 | COMP_0226 | banking_products | checking | BRL | 238 |
| PRODUCT_00303 | COMP_0730 | banking_products | checking | GBP | 12 |
| PRODUCT_00319 | COMP_0241 | banking_products | checking | AUD | 0 |
| PRODUCT_00330 | COMP_0029 | banking_products | checking | USD | 4 |
| PRODUCT_00333 | COMP_0029 | banking_products | checking | USD | 0 |
| PRODUCT_00343 | COMP_0804 | banking_products | checking | BRL | 56 |
| PRODUCT_00345 | COMP_0777 | banking_products | checking | USD | 244 |
| PRODUCT_00346 | COMP_1163 | banking_products | checking | USD | 278 |
| PRODUCT_00365 | COMP_0252 | banking_products | checking | HUF | 0 |
| PRODUCT_00375 | COMP_0249 | banking_products | checking | GBP | 78 |
| PRODUCT_00378 | COMP_1231 | banking_products | checking | USD | 90 |
| PRODUCT_00388 | COMP_0560 | banking_products | checking | USD | 393 |
| PRODUCT_00392 | COMP_0856 | banking_products | checking | GBP | 188 |
| PRODUCT_00406 | COMP_0149 | banking_products | checking | ARS | 1408 |
| PRODUCT_00419 | COMP_0670 | banking_products | checking | USD | 196 |
| PRODUCT_00429 | COMP_0404 | banking_products | card | USD | 4336 |
| PRODUCT_00442 | COMP_0477 | banking_products | checking | USD | 133 |
| PRODUCT_00450 | COMP_0521 | banking_products | checking | USD | 104 |
| PRODUCT_00452 | COMP_0665 | banking_products | checking | GBP | 190 |
| PRODUCT_00466 | COMP_0247 | banking_products | wallet | NOK | 1 |
| PRODUCT_00472 | COMP_0427 | banking_products | checking | USD | 0 |
| PRODUCT_00475 | COMP_1187 | banking_products | checking | GBP | 19 |
| PRODUCT_00485 | COMP_1104 | banking_products | checking | USD | 155 |
| PRODUCT_00497 | COMP_0556 | banking_products | checking | DKK | 303 |
| PRODUCT_00498 | COMP_0020 | banking_products | checking | USD | 65 |
| PRODUCT_00501 | COMP_0262 | banking_products | checking | USD | 1616 |
| PRODUCT_00506 | COMP_1194 | banking_products | checking | USD | 13 |
| PRODUCT_00508 | COMP_0301 | banking_products | checking | USD | 159 |
| PRODUCT_00509 | COMP_0830 | banking_products | checking | BRL | 1448 |
| PRODUCT_00522 | COMP_1004 | banking_products | checking | USD | 2263 |
| PRODUCT_00535 | COMP_1004 | banking_products | checking | USD | 1969 |
| PRODUCT_00550 | COMP_0110 | banking_products | checking | NOK | 62 |
| PRODUCT_00554 | COMP_0296 | banking_products | checking | USD | 1 |
| PRODUCT_00555 | COMP_0323 | banking_products | checking | USD | 400 |
| PRODUCT_00556 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_00569 | COMP_0670 | banking_products | checking | GBP | 0 |
| PRODUCT_00576 | COMP_0514 | banking_products | checking | NOK | 0 |
| PRODUCT_00582 | COMP_0864 | banking_products | checking | USD | 93 |
| PRODUCT_00595 | COMP_0025 | banking_products | checking | USD | 0 |
| PRODUCT_00599 | COMP_0909 | banking_products | checking | GBP | 66 |
| PRODUCT_00604 | COMP_0861 | banking_products | wallet | USD | 18 |
| PRODUCT_00608 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_00612 | COMP_1222 | banking_products | checking | MXN | 0 |
| PRODUCT_00614 | COMP_0301 | banking_products | checking | USD | 3 |
| PRODUCT_00630 | COMP_0990 | banking_products | checking | HKD | 140 |
| PRODUCT_00639 | COMP_0692 | banking_products | saving | GBP | 1 |
| PRODUCT_00645 | COMP_1057 | banking_products | checking | USD | 38 |
| PRODUCT_00675 | COMP_0352 | banking_products | checking | USD | 9 |
| PRODUCT_00676 | COMP_0252 | banking_products | checking | CZK | 0 |
| PRODUCT_00677 | COMP_0848 | banking_products | checking | USD | 75 |
| PRODUCT_00680 | COMP_0252 | banking_products | checking | DKK | 0 |
| PRODUCT_00685 | COMP_0591 | banking_products | checking | USD | 8 |
| PRODUCT_00686 | COMP_1067 | banking_products | checking | CAD | 2 |
| PRODUCT_00691 | COMP_0633 | banking_products | checking | CZK | 0 |
| PRODUCT_00695 | COMP_1283 | banking_products | checking | MXN | 172 |
| PRODUCT_00697 | COMP_1086 | banking_products | checking | USD | 0 |
| PRODUCT_00700 | COMP_0252 | banking_products | checking | SEK | 36 |
| PRODUCT_00706 | COMP_0879 | banking_products | checking | GBP | 3 |
| PRODUCT_00719 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_00734 | COMP_0692 | banking_products | checking | GBP | 3 |
| PRODUCT_00744 | COMP_0744 | banking_products | wallet | USD | 6 |
| PRODUCT_00748 | COMP_0145 | banking_products | checking | GBP | 12 |
| PRODUCT_00756 | COMP_0251 | banking_products | checking | PEN | 639 |
| PRODUCT_00762 | COMP_0262 | banking_products | checking | CAD | 37 |
| PRODUCT_00775 | COMP_1222 | banking_products | checking | MXN | 28 |
| PRODUCT_00780 | COMP_0351 | banking_products | checking | USD | 6 |
| PRODUCT_00784 | COMP_0521 | banking_products | checking | USD | 8 |
| PRODUCT_00786 | COMP_0754 | banking_products | checking | USD | 10 |
| PRODUCT_00793 | COMP_0409 | banking_products | checking | BAM | 36 |
| PRODUCT_00797 | COMP_1285 | banking_products | checking | GBP | 113 |
| PRODUCT_00799 | COMP_0287 | banking_products | checking | USD | 56 |
| PRODUCT_00805 | COMP_0276 | banking_products | checking | AOA | 689 |
| PRODUCT_00808 | COMP_0851 | banking_products | checking | USD | 85 |
| PRODUCT_00809 | COMP_0247 | banking_products | wallet | DKK | 0 |
| PRODUCT_00828 | COMP_0723 | debt_products | confirming | USD | 0 |
| PRODUCT_00830 | COMP_0909 | banking_products | checking | GBP | 5 |
| PRODUCT_00831 | COMP_0960 | banking_products | checking | USD | 0 |
| PRODUCT_00839 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_00849 | COMP_1067 | banking_products | checking | GBP | 281 |
| PRODUCT_00852 | COMP_1050 | banking_products | checking | USD | 0 |
| PRODUCT_00855 | COMP_0235 | banking_products | checking | USD | 7 |
| PRODUCT_00860 | COMP_0042 | banking_products | checking | USD | 40 |
| PRODUCT_00863 | COMP_1222 | banking_products | checking | MXN | 0 |
| PRODUCT_00870 | COMP_1222 | banking_products | checking | MXN | 3 |
| PRODUCT_00874 | COMP_1203 | banking_products | checking | USD | 152 |
| PRODUCT_00887 | COMP_0518 | banking_products | checking | USD | 54 |
| PRODUCT_00888 | COMP_0385 | banking_products | checking | USD | 79 |
| PRODUCT_00891 | COMP_0301 | banking_products | checking | USD | 512 |
| PRODUCT_00918 | COMP_0621 | banking_products | checking | USD | 377 |
| PRODUCT_00922 | COMP_0409 | banking_products | checking | USD | 28 |
| PRODUCT_00941 | COMP_0665 | banking_products | checking | USD | 384 |
| PRODUCT_00945 | COMP_0982 | banking_products | checking | USD | 163 |
| PRODUCT_00951 | COMP_0900 | banking_products | checking | AOA | 44 |
| PRODUCT_00953 | COMP_0616 | banking_products | checking | PLN | 437 |
| PRODUCT_00954 | COMP_0723 | debt_products | confirming | USD | 0 |
| PRODUCT_00962 | COMP_1008 | banking_products | checking | USD | 13 |
| PRODUCT_00984 | COMP_0730 | banking_products | checking | USD | 0 |
| PRODUCT_00986 | COMP_0390 | banking_products | checking | USD | 33 |
| PRODUCT_00991 | COMP_0946 | banking_products | checking | GBP | 0 |
| PRODUCT_01004 | COMP_0560 | banking_products | checking | MXN | 0 |
| PRODUCT_01007 | COMP_0670 | banking_products | checking | PLN | 0 |
| PRODUCT_01009 | COMP_0344 | banking_products | checking | USD | 0 |
| PRODUCT_01011 | COMP_1075 | banking_products | checking | GBP | 0 |
| PRODUCT_01023 | COMP_0727 | banking_products | checking | USD | 80 |
| PRODUCT_01028 | COMP_0524 | banking_products | checking | USD | 4 |
| PRODUCT_01030 | COMP_0252 | banking_products | checking | DKK | 0 |
| PRODUCT_01034 | COMP_0730 | banking_products | checking | CHF | 193 |
| PRODUCT_01039 | COMP_0205 | banking_products | checking | USD | 486 |
| PRODUCT_01067 | COMP_0219 | banking_products | checking | BRL | 68 |
| PRODUCT_01068 | COMP_0104 | banking_products | checking | NZD | 0 |
| PRODUCT_01069 | COMP_0377 | banking_products | checking | USD | 0 |
| PRODUCT_01081 | COMP_0471 | banking_products | checking | USD | 6 |
| PRODUCT_01087 | COMP_1086 | banking_products | checking | GBP | 0 |
| PRODUCT_01106 | COMP_0518 | banking_products | checking | AUD | 0 |
| PRODUCT_01110 | COMP_0219 | banking_products | checking | BRL | 7086 |
| PRODUCT_01113 | COMP_0514 | banking_products | checking | USD | 25 |
| PRODUCT_01115 | COMP_0070 | banking_products | checking | USD | 2 |
| PRODUCT_01117 | COMP_1266 | banking_products | checking | CZK | 1675 |
| PRODUCT_01121 | COMP_0460 | banking_products | checking | CAD | 1 |
| PRODUCT_01133 | COMP_0493 | banking_products | investment | CAD | 0 |
| PRODUCT_01135 | COMP_1132 | banking_products | checking | USD | 55 |
| PRODUCT_01144 | COMP_0314 | banking_products | checking | GBP | 199 |
| PRODUCT_01145 | COMP_0653 | debt_products | loan | USD | 0 |
| PRODUCT_01152 | COMP_0568 | banking_products | checking | USD | 0 |
| PRODUCT_01153 | COMP_0873 | banking_products | checking | USD | 12 |
| PRODUCT_01169 | COMP_1086 | banking_products | checking | USD | 43 |
| PRODUCT_01177 | COMP_0787 | banking_products | checking | NOK | 26 |
| PRODUCT_01193 | COMP_0861 | banking_products | checking | USD | 0 |
| PRODUCT_01201 | COMP_1184 | banking_products | checking | GBP | 45 |
| PRODUCT_01206 | COMP_0276 | banking_products | checking | AOA | 2 |
| PRODUCT_01207 | COMP_0653 | banking_products | investment | USD | 0 |
| PRODUCT_01215 | COMP_0252 | banking_products | checking | PLN | 0 |
| PRODUCT_01220 | COMP_0339 | banking_products | checking | USD | 54 |
| PRODUCT_01223 | COMP_0219 | banking_products | checking | BRL | 1786 |
| PRODUCT_01228 | COMP_0742 | banking_products | checking | USD | 3 |
| PRODUCT_01230 | COMP_0730 | banking_products | checking | CHF | 417 |
| PRODUCT_01233 | COMP_1272 | banking_products | checking | USD | 15 |
| PRODUCT_01234 | COMP_1162 | banking_products | checking | USD | 0 |
| PRODUCT_01246 | COMP_0237 | banking_products | checking | GBP | 16 |
| PRODUCT_01248 | COMP_1085 | banking_products | checking | AUD | 101 |
| PRODUCT_01258 | COMP_0008 | banking_products | checking | USD | 0 |
| PRODUCT_01271 | COMP_1123 | banking_products | checking | MXN | 2066 |
| PRODUCT_01284 | COMP_0276 | banking_products | checking | AOA | 26 |
| PRODUCT_01286 | COMP_1255 | banking_products | checking | SEK | 75 |
| PRODUCT_01287 | COMP_0680 | banking_products | checking | GBP | 0 |
| PRODUCT_01293 | COMP_1056 | banking_products | checking | CHF | 2 |
| PRODUCT_01324 | COMP_0350 | banking_products | checking | USD | 1688 |
| PRODUCT_01325 | COMP_0693 | banking_products | checking | GBP | 3088 |
| PRODUCT_01328 | COMP_0370 | banking_products | checking | GBP | 739 |
| PRODUCT_01333 | COMP_1203 | banking_products | checking | PLN | 85 |
| PRODUCT_01337 | COMP_0933 | banking_products | checking | GBP | 250 |
| PRODUCT_01351 | COMP_0945 | banking_products | checking | USD | 22 |
| PRODUCT_01358 | COMP_0276 | banking_products | checking | AOA | 122 |
| PRODUCT_01367 | COMP_1155 | banking_products | checking | USD | 1 |
| PRODUCT_01371 | COMP_0256 | banking_products | checking | USD | 5 |
| PRODUCT_01372 | COMP_0475 | banking_products | checking | USD | 25 |
| PRODUCT_01374 | COMP_0316 | banking_products | checking | GBP | 0 |
| PRODUCT_01382 | COMP_0799 | banking_products | checking | USD | 0 |
| PRODUCT_01384 | COMP_0515 | banking_products | checking | USD | 0 |
| PRODUCT_01393 | COMP_0919 | banking_products | checking | USD | 7 |
| PRODUCT_01411 | COMP_0042 | banking_products | checking | USD | 4 |
| PRODUCT_01422 | COMP_0653 | banking_products | checking | USD | 21 |
| PRODUCT_01430 | COMP_0361 | banking_products | checking | GBP | 0 |
| PRODUCT_01436 | COMP_1133 | banking_products | checking | USD | 4 |
| PRODUCT_01442 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_01443 | COMP_0928 | banking_products | checking | MXN | 0 |
| PRODUCT_01450 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_01457 | COMP_0521 | banking_products | checking | USD | 37 |
| PRODUCT_01458 | COMP_0445 | banking_products | checking | GBP | 237 |
| PRODUCT_01464 | COMP_0097 | banking_products | checking | USD | 83 |
| PRODUCT_01466 | COMP_1255 | banking_products | checking | NOK | 6 |
| PRODUCT_01468 | COMP_0196 | banking_products | checking | USD | 28 |
| PRODUCT_01473 | COMP_1272 | banking_products | checking | USD | 161 |
| PRODUCT_01481 | COMP_0754 | banking_products | checking | USD | 98 |
| PRODUCT_01493 | COMP_0479 | banking_products | checking | AUD | 9678 |
| PRODUCT_01509 | COMP_1257 | banking_products | checking | USD | 0 |
| PRODUCT_01514 | COMP_0748 | banking_products | checking | USD | 368 |
| PRODUCT_01524 | COMP_1141 | banking_products | checking | USD | 76 |
| PRODUCT_01528 | COMP_0568 | banking_products | checking | USD | 3 |
| PRODUCT_01558 | COMP_0848 | banking_products | checking | USD | 637 |
| PRODUCT_01572 | COMP_0730 | banking_products | checking | USD | 42 |
| PRODUCT_01584 | COMP_1042 | banking_products | checking | USD | 3 |
| PRODUCT_01593 | COMP_0268 | banking_products | checking | USD | 236 |
| PRODUCT_01595 | COMP_0855 | banking_products | checking | USD | 18 |
| PRODUCT_01596 | COMP_0909 | debt_products | guarantee | GBP | 0 |
| PRODUCT_01599 | COMP_1067 | banking_products | checking | NZD | 62 |
| PRODUCT_01603 | COMP_0252 | banking_products | checking | CHF | 277 |
| PRODUCT_01611 | COMP_0971 | banking_products | checking | USD | 7 |
| PRODUCT_01619 | COMP_0252 | banking_products | checking | RON | 0 |
| PRODUCT_01622 | COMP_0787 | banking_products | saving | NOK | 6 |
| PRODUCT_01626 | COMP_1161 | banking_products | checking | USD | 45 |
| PRODUCT_01651 | COMP_0314 | banking_products | checking | CAD | 54 |
| PRODUCT_01656 | COMP_0611 | banking_products | checking | USD | 748 |
| PRODUCT_01658 | COMP_0236 | banking_products | checking | GBP | 19 |
| PRODUCT_01659 | COMP_0189 | banking_products | checking | USD | 61 |
| PRODUCT_01668 | COMP_0634 | banking_products | checking | GBP | 0 |
| PRODUCT_01680 | COMP_0848 | banking_products | checking | USD | 673 |
| PRODUCT_01685 | COMP_0666 | banking_products | investment | ARS | 0 |
| PRODUCT_01721 | COMP_0252 | banking_products | checking | CZK | 0 |
| PRODUCT_01722 | COMP_0799 | banking_products | checking | USD | 21 |
| PRODUCT_01738 | COMP_0460 | banking_products | wallet | GBP | 15 |
| PRODUCT_01746 | COMP_0708 | banking_products | checking | HUF | 0 |
| PRODUCT_01763 | COMP_0252 | banking_products | checking | GBP | 386 |
| PRODUCT_01766 | COMP_0853 | banking_products | checking | JPY | 62 |
| PRODUCT_01772 | COMP_0692 | banking_products | checking | GBP | 60 |
| PRODUCT_01791 | COMP_1133 | banking_products | checking | USD | 0 |
| PRODUCT_01795 | COMP_0406 | banking_products | checking | USD | 74 |
| PRODUCT_01810 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_01816 | COMP_1115 | banking_products | checking | MXN | 336 |
| PRODUCT_01820 | COMP_0283 | banking_products | checking | USD | 0 |
| PRODUCT_01834 | COMP_1067 | banking_products | checking | HKD | 4 |
| PRODUCT_01835 | COMP_0660 | banking_products | checking | DKK | 100 |
| PRODUCT_01841 | COMP_1282 | banking_products | checking | USD | 18 |
| PRODUCT_01848 | COMP_0252 | banking_products | checking | GBP | 226 |
| PRODUCT_01860 | COMP_0073 | banking_products | checking | SEK | 0 |
| PRODUCT_01861 | COMP_1041 | banking_products | checking | USD | 24 |
| PRODUCT_01867 | COMP_1182 | banking_products | checking | USD | 732 |
| PRODUCT_01874 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_01891 | COMP_0471 | banking_products | checking | USD | 0 |
| PRODUCT_01903 | COMP_0723 | banking_products | checking | USD | 0 |
| PRODUCT_01907 | COMP_0471 | banking_products | checking | USD | 29 |
| PRODUCT_01917 | COMP_0692 | banking_products | checking | GBP | 4 |
| PRODUCT_01920 | COMP_0274 | banking_products | checking | USD | 9 |
| PRODUCT_01932 | COMP_0591 | banking_products | checking | USD | 27 |
| PRODUCT_01933 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_01936 | COMP_0265 | banking_products | checking | USD | 0 |
| PRODUCT_01947 | COMP_0236 | banking_products | checking | PLN | 0 |
| PRODUCT_01953 | COMP_0915 | banking_products | checking | USD | 46 |
| PRODUCT_01964 | COMP_0075 | banking_products | checking | USD | 7 |
| PRODUCT_01969 | COMP_0713 | banking_products | checking | USD | 15 |
| PRODUCT_01976 | COMP_1008 | banking_products | checking | GBP | 115 |
| PRODUCT_01990 | COMP_0419 | banking_products | checking | USD | 49 |
| PRODUCT_01994 | COMP_0900 | banking_products | checking | AOA | 4 |
| PRODUCT_01999 | COMP_0916 | banking_products | checking | GBP | 24 |
| PRODUCT_02003 | COMP_0912 | banking_products | checking | USD | 132 |
| PRODUCT_02009 | COMP_0518 | banking_products | checking | USD | 0 |
| PRODUCT_02019 | COMP_0145 | banking_products | checking | MXN | 13 |
| PRODUCT_02041 | COMP_0566 | banking_products | checking | USD | 11 |
| PRODUCT_02046 | COMP_0059 | banking_products | checking | USD | 169 |
| PRODUCT_02062 | COMP_0784 | banking_products | checking | GBP | 140 |
| PRODUCT_02066 | COMP_0262 | banking_products | checking | USD | 1639 |
| PRODUCT_02070 | COMP_1067 | banking_products | checking | GBP | 72 |
| PRODUCT_02089 | COMP_0059 | banking_products | checking | USD | 1 |
| PRODUCT_02122 | COMP_0946 | banking_products | checking | MXN | 0 |
| PRODUCT_02135 | COMP_0117 | banking_products | checking | GBP | 8 |
| PRODUCT_02143 | COMP_0843 | banking_products | checking | USD | 95 |
| PRODUCT_02156 | COMP_0818 | banking_products | checking | USD | 0 |
| PRODUCT_02165 | COMP_0618 | banking_products | checking | GBP | 273 |
| PRODUCT_02170 | COMP_0042 | banking_products | checking | USD | 32 |
| PRODUCT_02184 | COMP_0560 | banking_products | checking | USD | 18 |
| PRODUCT_02188 | COMP_0728 | banking_products | card | USD | 1 |
| PRODUCT_02189 | COMP_0614 | banking_products | checking | USD | 132 |
| PRODUCT_02193 | COMP_0447 | banking_products | checking | USD | 72 |
| PRODUCT_02214 | COMP_0515 | banking_products | checking | SGD | 0 |
| PRODUCT_02219 | COMP_0643 | banking_products | checking | USD | 3 |
| PRODUCT_02220 | COMP_1155 | banking_products | checking | GBP | 0 |
| PRODUCT_02221 | COMP_0275 | banking_products | checking | CHF | 38 |
| PRODUCT_02241 | COMP_0351 | banking_products | checking | USD | 24 |
| PRODUCT_02257 | COMP_0524 | banking_products | checking | USD | 6 |
| PRODUCT_02258 | COMP_0404 | banking_products | checking | USD | 18 |
| PRODUCT_02268 | COMP_1255 | banking_products | checking | SEK | 13 |
| PRODUCT_02273 | COMP_0182 | banking_products | checking | USD | 11 |
| PRODUCT_02282 | COMP_0785 | banking_products | checking | USD | 0 |
| PRODUCT_02288 | COMP_0928 | banking_products | checking | USD | 0 |
| PRODUCT_02304 | COMP_1003 | banking_products | checking | MXN | 669 |
| PRODUCT_02317 | COMP_0252 | banking_products | checking | CHF | 0 |
| PRODUCT_02320 | COMP_0748 | banking_products | checking | USD | 619 |
| PRODUCT_02322 | COMP_0069 | banking_products | checking | DKK | 2389 |
| PRODUCT_02325 | COMP_0856 | banking_products | checking | GBP | 308 |
| PRODUCT_02329 | COMP_1281 | banking_products | checking | USD | 0 |
| PRODUCT_02333 | COMP_0270 | banking_products | checking | USD | 327 |
| PRODUCT_02348 | COMP_1163 | banking_products | checking | USD | 6 |
| PRODUCT_02350 | COMP_0233 | banking_products | checking | USD | 0 |
| PRODUCT_02352 | COMP_0521 | banking_products | checking | USD | 0 |
| PRODUCT_02356 | COMP_0314 | banking_products | checking | AUD | 0 |
| PRODUCT_02384 | COMP_0832 | banking_products | checking | USD | 179 |
| PRODUCT_02386 | COMP_0475 | banking_products | saving | USD | 0 |
| PRODUCT_02394 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_02395 | COMP_0692 | banking_products | saving | GBP | 1 |
| PRODUCT_02399 | COMP_0692 | banking_products | checking | GBP | 4 |
| PRODUCT_02404 | COMP_0370 | banking_products | checking | GBP | 7 |
| PRODUCT_02408 | COMP_0169 | banking_products | checking | USD | 0 |
| PRODUCT_02411 | COMP_0241 | banking_products | checking | GBP | 42 |
| PRODUCT_02427 | COMP_0341 | banking_products | checking | GBP | 34 |
| PRODUCT_02428 | COMP_0754 | banking_products | checking | USD | 102 |
| PRODUCT_02431 | COMP_0909 | banking_products | checking | USD | 28 |
| PRODUCT_02437 | COMP_1158 | banking_products | checking | USD | 1 |
| PRODUCT_02451 | COMP_1182 | banking_products | checking | GBP | 0 |
| PRODUCT_02454 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_02463 | COMP_0900 | banking_products | checking | AOA | 128 |
| PRODUCT_02467 | COMP_0653 | debt_products | loan | USD | 0 |
| PRODUCT_02480 | COMP_0073 | banking_products | checking | USD | 0 |
| PRODUCT_02489 | COMP_0277 | banking_products | checking | USD | 2 |
| PRODUCT_02498 | COMP_1085 | banking_products | checking | AUD | 61 |
| PRODUCT_02504 | COMP_0730 | banking_products | checking | GBP | 666 |
| PRODUCT_02506 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_02518 | COMP_0268 | banking_products | checking | GBP | 3 |
| PRODUCT_02522 | COMP_0107 | banking_products | checking | USD | 394 |
| PRODUCT_02523 | COMP_0292 | banking_products | checking | XOF | 0 |
| PRODUCT_02531 | COMP_0496 | banking_products | checking | GBP | 0 |
| PRODUCT_02536 | COMP_0252 | banking_products | checking | USD | 60 |
| PRODUCT_02542 | COMP_0073 | banking_products | checking | PLN | 0 |
| PRODUCT_02544 | COMP_0727 | banking_products | checking | USD | 521 |
| PRODUCT_02546 | COMP_1244 | banking_products | checking | COP | 303 |
| PRODUCT_02558 | COMP_0856 | banking_products | checking | CHF | 0 |
| PRODUCT_02561 | COMP_0336 | banking_products | checking | USD | 1 |
| PRODUCT_02563 | COMP_0496 | banking_products | checking | BRL | 2 |
| PRODUCT_02570 | COMP_0495 | banking_products | checking | USD | 15 |
| PRODUCT_02584 | COMP_0486 | banking_products | checking | CLP | 579 |
| PRODUCT_02593 | COMP_0385 | banking_products | checking | USD | 265 |
| PRODUCT_02594 | COMP_1067 | banking_products | checking | USD | 292 |
| PRODUCT_02595 | COMP_0799 | banking_products | checking | GBP | 2051 |
| PRODUCT_02601 | COMP_1115 | banking_products | checking | USD | 164 |
| PRODUCT_02604 | COMP_0178 | banking_products | checking | USD | 79 |
| PRODUCT_02613 | COMP_1023 | banking_products | checking | NOK | 327 |
| PRODUCT_02623 | COMP_0178 | banking_products | checking | GBP | 288 |
| PRODUCT_02633 | COMP_1203 | banking_products | checking | HUF | 76 |
| PRODUCT_02638 | COMP_0450 | banking_products | checking | USD | 17 |
| PRODUCT_02643 | COMP_0966 | banking_products | checking | BRL | 881 |
| PRODUCT_02662 | COMP_1187 | banking_products | checking | GBP | 1366 |
| PRODUCT_02672 | COMP_0848 | banking_products | checking | USD | 875 |
| PRODUCT_02675 | COMP_0149 | banking_products | checking | ARS | 279 |
| PRODUCT_02676 | COMP_0580 | banking_products | checking | NOK | 0 |
| PRODUCT_02688 | COMP_0959 | banking_products | checking | PEN | 259 |
| PRODUCT_02694 | COMP_0939 | banking_products | checking | USD | 481 |
| PRODUCT_02697 | COMP_0361 | banking_products | checking | DKK | 595 |
| PRODUCT_02699 | COMP_0212 | banking_products | checking | SEK | 40 |
| PRODUCT_02700 | COMP_0361 | banking_products | checking | USD | 0 |
| PRODUCT_02713 | COMP_1083 | banking_products | checking | USD | 3 |
| PRODUCT_02715 | COMP_0301 | banking_products | checking | USD | 20 |
| PRODUCT_02732 | COMP_0830 | banking_products | checking | BRL | 179 |
| PRODUCT_02734 | COMP_0487 | banking_products | checking | COP | 0 |
| PRODUCT_02741 | COMP_0233 | banking_products | checking | CLP | 1406 |
| PRODUCT_02747 | COMP_0384 | banking_products | checking | USD | 631 |
| PRODUCT_02756 | COMP_0693 | banking_products | checking | USD | 667 |
| PRODUCT_02757 | COMP_1282 | banking_products | checking | USD | 0 |
| PRODUCT_02766 | COMP_0390 | banking_products | checking | PEN | 70 |
| PRODUCT_02794 | COMP_0117 | banking_products | checking | USD | 22 |
| PRODUCT_02797 | COMP_0341 | banking_products | checking | USD | 1 |
| PRODUCT_02827 | COMP_0976 | banking_products | checking | GBP | 757 |
| PRODUCT_02844 | COMP_1071 | banking_products | checking | USD | 7 |
| PRODUCT_02849 | COMP_0971 | banking_products | checking | GBP | 202 |
| PRODUCT_02854 | COMP_0460 | banking_products | checking | USD | 936 |
| PRODUCT_02858 | COMP_0366 | banking_products | checking | USD | 72 |
| PRODUCT_02859 | COMP_0633 | banking_products | checking | PLN | 8 |
| PRODUCT_02862 | COMP_0252 | banking_products | checking | NOK | 0 |
| PRODUCT_02867 | COMP_0855 | banking_products | checking | USD | 10 |
| PRODUCT_02868 | COMP_0566 | banking_products | checking | GBP | 22 |
| PRODUCT_02878 | COMP_0509 | banking_products | checking | USD | 0 |
| PRODUCT_02886 | COMP_0240 | banking_products | checking | USD | 23 |
| PRODUCT_02887 | COMP_1198 | banking_products | checking | USD | 532 |
| PRODUCT_02888 | COMP_1053 | banking_products | checking | USD | 7 |
| PRODUCT_02889 | COMP_0117 | banking_products | checking | GBP | 45 |
| PRODUCT_02911 | COMP_0734 | banking_products | checking | USD | 5 |
| PRODUCT_02913 | COMP_1272 | banking_products | checking | USD | 1 |
| PRODUCT_02919 | COMP_0268 | banking_products | checking | AUD | 203 |
| PRODUCT_02922 | COMP_1097 | banking_products | checking | USD | 17 |
| PRODUCT_02940 | COMP_0275 | banking_products | checking | USD | 24 |
| PRODUCT_02950 | COMP_0765 | banking_products | checking | USD | 142 |
| PRODUCT_02952 | COMP_0573 | banking_products | checking | INR | 301 |
| PRODUCT_02955 | COMP_0629 | banking_products | checking | COP | 2102 |
| PRODUCT_02956 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_02957 | COMP_0961 | banking_products | checking | GBP | 0 |
| PRODUCT_02966 | COMP_0314 | banking_products | checking | GBP | 157 |
| PRODUCT_02977 | COMP_0477 | banking_products | checking | USD | 15 |
| PRODUCT_02982 | COMP_0580 | banking_products | checking | USD | 24 |
| PRODUCT_02983 | COMP_0208 | banking_products | checking | GBP | 438 |
| PRODUCT_02990 | COMP_0262 | banking_products | checking | USD | 1306 |
| PRODUCT_02992 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_02998 | COMP_0292 | banking_products | checking | GHS | 79 |
| PRODUCT_03005 | COMP_0057 | banking_products | checking | CAD | 376 |
| PRODUCT_03009 | COMP_1097 | banking_products | checking | AED | 72 |
| PRODUCT_03011 | COMP_0025 | banking_products | checking | GBP | 42 |
| PRODUCT_03017 | COMP_0042 | banking_products | checking | USD | 0 |
| PRODUCT_03042 | COMP_0007 | banking_products | checking | USD | 45 |
| PRODUCT_03048 | COMP_1018 | banking_products | checking | USD | 3 |
| PRODUCT_03063 | COMP_0028 | banking_products | checking | USD | 0 |
| PRODUCT_03068 | COMP_1053 | banking_products | checking | GBP | 72 |
| PRODUCT_03086 | COMP_0761 | banking_products | checking | USD | 57 |
| PRODUCT_03098 | COMP_1286 | banking_products | wallet | USD | 6 |
| PRODUCT_03100 | COMP_1161 | banking_products | checking | USD | 8 |
| PRODUCT_03102 | COMP_1166 | banking_products | checking | USD | 2219 |
| PRODUCT_03103 | COMP_0643 | banking_products | saving | NOK | 11 |
| PRODUCT_03106 | COMP_0339 | banking_products | checking | GBP | 117 |
| PRODUCT_03108 | COMP_0781 | banking_products | checking | USD | 208 |
| PRODUCT_03117 | COMP_0270 | banking_products | wallet | USD | 0 |
| PRODUCT_03124 | COMP_0262 | banking_products | checking | GBP | 133 |
| PRODUCT_03141 | COMP_0909 | debt_products | guarantee | GBP | 0 |
| PRODUCT_03142 | COMP_1018 | banking_products | checking | USD | 187 |
| PRODUCT_03144 | COMP_0252 | banking_products | checking | CHF | 16 |
| PRODUCT_03147 | COMP_1085 | banking_products | checking | AUD | 189 |
| PRODUCT_03152 | COMP_0487 | banking_products | checking | COP | 0 |
| PRODUCT_03155 | COMP_0915 | banking_products | checking | USD | 1 |
| PRODUCT_03160 | COMP_0042 | banking_products | checking | USD | 2 |
| PRODUCT_03164 | COMP_0696 | banking_products | checking | USD | 14 |
| PRODUCT_03169 | COMP_0848 | banking_products | checking | USD | 794 |
| PRODUCT_03171 | COMP_0591 | banking_products | checking | USD | 6 |
| PRODUCT_03173 | COMP_0931 | banking_products | checking | USD | 0 |
| PRODUCT_03188 | COMP_0666 | banking_products | checking | ARS | 1371 |
| PRODUCT_03194 | COMP_0473 | banking_products | checking | USD | 21 |
| PRODUCT_03195 | COMP_0921 | banking_products | checking | USD | 77 |
| PRODUCT_03200 | COMP_0743 | banking_products | checking | GBP | 0 |
| PRODUCT_03203 | COMP_1105 | banking_products | checking | CLP | 2679 |
| PRODUCT_03206 | COMP_0252 | banking_products | checking | NOK | 174 |
| PRODUCT_03210 | COMP_0869 | banking_products | checking | USD | 5 |
| PRODUCT_03215 | COMP_0495 | banking_products | checking | USD | 4 |
| PRODUCT_03233 | COMP_1249 | banking_products | checking | USD | 0 |
| PRODUCT_03237 | COMP_0406 | banking_products | checking | USD | 5 |
| PRODUCT_03241 | COMP_0008 | banking_products | checking | USD | 1 |
| PRODUCT_03248 | COMP_1067 | banking_products | checking | AUD | 5116 |
| PRODUCT_03251 | COMP_1163 | banking_products | checking | GBP | 1 |
| PRODUCT_03264 | COMP_1053 | banking_products | checking | USD | 633 |
| PRODUCT_03266 | COMP_0984 | banking_products | checking | ILS | 388 |
| PRODUCT_03270 | COMP_0658 | banking_products | checking | USD | 645 |
| PRODUCT_03272 | COMP_0856 | banking_products | checking | GBP | 1171 |
| PRODUCT_03274 | COMP_0168 | banking_products | checking | MYR | 143 |
| PRODUCT_03285 | COMP_0212 | banking_products | checking | USD | 0 |
| PRODUCT_03289 | COMP_0621 | banking_products | checking | GBP | 74 |
| PRODUCT_03298 | COMP_0050 | banking_products | checking | USD | 66 |
| PRODUCT_03301 | COMP_0292 | banking_products | checking | GHS | 6 |
| PRODUCT_03307 | COMP_0799 | banking_products | checking | USD | 795 |
| PRODUCT_03308 | COMP_1071 | banking_products | checking | USD | 47 |
| PRODUCT_03314 | COMP_0806 | banking_products | checking | USD | 0 |
| PRODUCT_03320 | COMP_0966 | banking_products | checking | BRL | 972 |
| PRODUCT_03322 | COMP_0135 | banking_products | checking | USD | 24 |
| PRODUCT_03332 | COMP_0916 | banking_products | checking | PLN | 55 |
| PRODUCT_03334 | COMP_0961 | banking_products | checking | USD | 30 |
| PRODUCT_03339 | COMP_0460 | banking_products | checking | GBP | 511 |
| PRODUCT_03340 | COMP_0469 | banking_products | checking | USD | 68 |
| PRODUCT_03345 | COMP_0579 | banking_products | checking | GBP | 21 |
| PRODUCT_03346 | COMP_0460 | banking_products | checking | USD | 62 |
| PRODUCT_03358 | COMP_1162 | banking_products | checking | USD | 30 |
| PRODUCT_03360 | COMP_0460 | banking_products | checking | GBP | 234 |
| PRODUCT_03366 | COMP_1251 | banking_products | checking | USD | 0 |
| PRODUCT_03368 | COMP_1083 | banking_products | checking | PLN | 117 |
| PRODUCT_03373 | COMP_0445 | banking_products | checking | GBP | 7 |
| PRODUCT_03381 | COMP_0783 | banking_products | checking | GBP | 77 |
| PRODUCT_03394 | COMP_1203 | banking_products | checking | GBP | 357 |
| PRODUCT_03405 | COMP_0101 | banking_products | checking | USD | 18 |
| PRODUCT_03411 | COMP_0236 | banking_products | checking | CHF | 4 |
| PRODUCT_03414 | COMP_0447 | banking_products | checking | USD | 2 |
| PRODUCT_03415 | COMP_0519 | banking_products | checking | USD | 96 |
| PRODUCT_03419 | COMP_0269 | banking_products | checking | GBP | 1 |
| PRODUCT_03434 | COMP_1190 | banking_products | checking | GBP | 141 |
| PRODUCT_03448 | COMP_1022 | banking_products | checking | MXN | 2791 |
| PRODUCT_03472 | COMP_0666 | banking_products | investment | ARS | 0 |
| PRODUCT_03476 | COMP_0007 | debt_products | factoring | USD | 0 |
| PRODUCT_03483 | COMP_1190 | banking_products | checking | USD | 11 |
| PRODUCT_03492 | COMP_0135 | banking_products | checking | USD | 1003 |
| PRODUCT_03505 | COMP_0302 | banking_products | checking | GBP | 0 |
| PRODUCT_03520 | COMP_0385 | banking_products | checking | USD | 209 |
| PRODUCT_03523 | COMP_0832 | banking_products | checking | USD | 0 |
| PRODUCT_03530 | COMP_0177 | banking_products | checking | USD | 20 |
| PRODUCT_03531 | COMP_0864 | banking_products | checking | USD | 0 |
| PRODUCT_03544 | COMP_1187 | banking_products | checking | GBP | 558 |
| PRODUCT_03548 | COMP_0909 | banking_products | checking | USD | 4 |
| PRODUCT_03550 | COMP_0377 | banking_products | checking | GBP | 0 |
| PRODUCT_03556 | COMP_0271 | banking_products | checking | USD | 7 |
| PRODUCT_03562 | COMP_0851 | banking_products | checking | SGD | 10 |
| PRODUCT_03570 | COMP_0252 | banking_products | checking | CHF | 0 |
| PRODUCT_03572 | COMP_0592 | banking_products | checking | USD | 10 |
| PRODUCT_03582 | COMP_0504 | banking_products | checking | USD | 40 |
| PRODUCT_03588 | COMP_0268 | banking_products | checking | GBP | 2914 |
| PRODUCT_03597 | COMP_0299 | banking_products | checking | USD | 16 |
| PRODUCT_03602 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_03605 | COMP_0856 | banking_products | checking | CAD | 0 |
| PRODUCT_03630 | COMP_0611 | banking_products | checking | DKK | 0 |
| PRODUCT_03632 | COMP_0419 | banking_products | checking | GBP | 86 |
| PRODUCT_03635 | COMP_0939 | banking_products | checking | GBP | 1221 |
| PRODUCT_03646 | COMP_0145 | banking_products | checking | PHP | 0 |
| PRODUCT_03648 | COMP_0493 | banking_products | checking | CAD | 290 |
| PRODUCT_03663 | COMP_0800 | banking_products | checking | GBP | 278 |
| PRODUCT_03666 | COMP_0900 | banking_products | checking | AOA | 6 |
| PRODUCT_03677 | COMP_0185 | banking_products | checking | USD | 143 |
| PRODUCT_03685 | COMP_1122 | banking_products | checking | CAD | 566 |
| PRODUCT_03694 | COMP_1067 | banking_products | checking | AUD | 889 |
| PRODUCT_03697 | COMP_1222 | banking_products | checking | USD | 12 |
| PRODUCT_03700 | COMP_0252 | banking_products | checking | SEK | 0 |
| PRODUCT_03730 | COMP_0252 | banking_products | checking | CZK | 0 |
| PRODUCT_03741 | COMP_0606 | banking_products | checking | USD | 35 |
| PRODUCT_03747 | COMP_0351 | banking_products | checking | USD | 3 |
| PRODUCT_03779 | COMP_0477 | debt_products | lineofcredit | USD | 15 |
| PRODUCT_03788 | COMP_0658 | banking_products | checking | USD | 82 |
| PRODUCT_03792 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_03806 | COMP_0030 | banking_products | checking | BRL | 4202 |
| PRODUCT_03810 | COMP_0361 | banking_products | checking | DKK | 2161 |
| PRODUCT_03815 | COMP_0669 | banking_products | checking | USD | 38 |
| PRODUCT_03818 | COMP_0521 | banking_products | checking | USD | 1 |
| PRODUCT_03819 | COMP_0189 | banking_products | checking | USD | 0 |
| PRODUCT_03820 | COMP_0409 | banking_products | checking | BAM | 14 |
| PRODUCT_03824 | COMP_0939 | banking_products | checking | GBP | 587 |
| PRODUCT_03831 | COMP_0408 | banking_products | checking | USD | 132 |
| PRODUCT_03846 | COMP_0213 | banking_products | checking | NZD | 88 |
| PRODUCT_03853 | COMP_0938 | banking_products | checking | USD | 723 |
| PRODUCT_03884 | COMP_0550 | banking_products | wallet | GBP | 0 |
| PRODUCT_03906 | COMP_0951 | banking_products | checking | USD | 173 |
| PRODUCT_03911 | COMP_0270 | banking_products | checking | USD | 0 |
| PRODUCT_03912 | COMP_0233 | banking_products | checking | CLP | 2323 |
| PRODUCT_03923 | COMP_0869 | banking_products | checking | JPY | 3 |
| PRODUCT_03925 | COMP_0042 | banking_products | checking | USD | 50 |
| PRODUCT_03928 | COMP_0247 | banking_products | wallet | SEK | 1 |
| PRODUCT_03938 | COMP_1018 | banking_products | checking | CHF | 169 |
| PRODUCT_03941 | COMP_0743 | banking_products | checking | USD | 3 |
| PRODUCT_03954 | COMP_0727 | banking_products | checking | GBP | 0 |
| PRODUCT_03958 | COMP_0050 | banking_products | checking | USD | 76 |
| PRODUCT_03959 | COMP_0301 | banking_products | checking | AUD | 2 |
| PRODUCT_03962 | COMP_0205 | banking_products | saving | USD | 0 |
| PRODUCT_03976 | COMP_0158 | banking_products | checking | USD | 164 |
| PRODUCT_03981 | COMP_0336 | banking_products | checking | GBP | 988 |
| PRODUCT_03985 | COMP_0344 | banking_products | checking | GBP | 92 |
| PRODUCT_03996 | COMP_0487 | banking_products | checking | COP | 1939 |
| PRODUCT_03997 | COMP_0933 | banking_products | checking | USD | 132 |
| PRODUCT_03999 | COMP_0524 | debt_products | loan | USD | 0 |
| PRODUCT_04008 | COMP_0058 | banking_products | checking | USD | 18 |
| PRODUCT_04015 | COMP_0919 | banking_products | checking | USD | 2 |
| PRODUCT_04017 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_04019 | COMP_0951 | banking_products | checking | USD | 1826 |
| PRODUCT_04033 | COMP_0269 | banking_products | checking | USD | 1 |
| PRODUCT_04035 | COMP_0856 | banking_products | checking | SEK | 0 |
| PRODUCT_04041 | COMP_0202 | banking_products | checking | AED | 718 |
| PRODUCT_04043 | COMP_0982 | banking_products | checking | USD | 15 |
| PRODUCT_04048 | COMP_1108 | banking_products | checking | DKK | 264 |
| PRODUCT_04063 | COMP_0852 | banking_products | checking | USD | 0 |
| PRODUCT_04065 | COMP_0406 | banking_products | checking | USD | 0 |
| PRODUCT_04067 | COMP_1198 | banking_products | checking | USD | 149 |
| PRODUCT_04075 | COMP_0959 | banking_products | checking | USD | 198 |
| PRODUCT_04079 | COMP_0856 | banking_products | checking | MXN | 0 |
| PRODUCT_04095 | COMP_0783 | banking_products | checking | GBP | 156 |
| PRODUCT_04098 | COMP_1067 | banking_products | checking | AUD | 690 |
| PRODUCT_04106 | COMP_0280 | banking_products | checking | GBP | 832 |
| PRODUCT_04118 | COMP_0806 | banking_products | checking | GBP | 0 |
| PRODUCT_04121 | COMP_1130 | banking_products | checking | USD | 10 |
| PRODUCT_04131 | COMP_0361 | banking_products | checking | DKK | 0 |
| PRODUCT_04142 | COMP_0409 | banking_products | checking | BAM | 201 |
| PRODUCT_04144 | COMP_1067 | banking_products | checking | CAD | 53 |
| PRODUCT_04155 | COMP_0505 | banking_products | checking | USD | 40 |
| PRODUCT_04156 | COMP_0059 | banking_products | checking | GBP | 35 |
| PRODUCT_04178 | COMP_0617 | banking_products | checking | USD | 0 |
| PRODUCT_04182 | COMP_0083 | banking_products | checking | USD | 0 |
| PRODUCT_04192 | COMP_0341 | banking_products | checking | USD | 502 |
| PRODUCT_04208 | COMP_0912 | banking_products | checking | USD | 45 |
| PRODUCT_04210 | COMP_0951 | banking_products | checking | GBP | 0 |
| PRODUCT_04212 | COMP_0252 | banking_products | checking | NOK | 0 |
| PRODUCT_04222 | COMP_0680 | banking_products | checking | USD | 286 |
| PRODUCT_04229 | COMP_1067 | banking_products | checking | NZD | 2 |
| PRODUCT_04244 | COMP_0855 | banking_products | checking | USD | 0 |
| PRODUCT_04258 | COMP_0185 | banking_products | checking | USD | 0 |
| PRODUCT_04259 | COMP_0761 | banking_products | checking | USD | 101 |
| PRODUCT_04261 | COMP_0252 | banking_products | checking | DKK | 2 |
| PRODUCT_04264 | COMP_0349 | banking_products | checking | USD | 105 |
| PRODUCT_04265 | COMP_0460 | banking_products | checking | GBP | 515 |
| PRODUCT_04266 | COMP_0612 | banking_products | checking | USD | 29 |
| PRODUCT_04268 | COMP_0276 | banking_products | checking | AOA | 23 |
| PRODUCT_04269 | COMP_0073 | banking_products | checking | GBP | 0 |
| PRODUCT_04285 | COMP_0265 | banking_products | checking | GBP | 3 |
| PRODUCT_04289 | COMP_0808 | banking_products | checking | GBP | 0 |
| PRODUCT_04292 | COMP_0909 | banking_products | checking | USD | 0 |
| PRODUCT_04299 | COMP_0127 | banking_products | checking | BRL | 24 |
| PRODUCT_04302 | COMP_0316 | banking_products | checking | USD | 24 |
| PRODUCT_04306 | COMP_0754 | banking_products | checking | GBP | 34 |
| PRODUCT_04337 | COMP_0692 | banking_products | checking | GBP | 6 |
| PRODUCT_04342 | COMP_1008 | banking_products | checking | GBP | 1454 |
| PRODUCT_04343 | COMP_0028 | banking_products | checking | USD | 0 |
| PRODUCT_04344 | COMP_0361 | banking_products | checking | DKK | 875 |
| PRODUCT_04354 | COMP_0377 | banking_products | checking | USD | 4 |
| PRODUCT_04355 | COMP_1104 | banking_products | checking | USD | 5 |
| PRODUCT_04359 | COMP_0385 | banking_products | checking | GBP | 54 |
| PRODUCT_04361 | COMP_0409 | banking_products | checking | BAM | 3736 |
| PRODUCT_04368 | COMP_0314 | banking_products | checking | USD | 340 |
| PRODUCT_04371 | COMP_0014 | banking_products | checking | CAD | 2758 |
| PRODUCT_04372 | COMP_1053 | banking_products | checking | USD | 7 |
| PRODUCT_04373 | COMP_0336 | banking_products | checking | USD | 299 |
| PRODUCT_04376 | COMP_0775 | banking_products | checking | USD | 69 |
| PRODUCT_04379 | COMP_1042 | banking_products | checking | GBP | 0 |
| PRODUCT_04390 | COMP_0213 | banking_products | checking | NZD | 2317 |
| PRODUCT_04398 | COMP_1086 | banking_products | checking | USD | 0 |
| PRODUCT_04402 | COMP_0201 | banking_products | checking | USD | 489 |
| PRODUCT_04403 | COMP_0191 | banking_products | checking | GBP | 8 |
| PRODUCT_04408 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_04420 | COMP_1083 | banking_products | checking | USD | 2 |
| PRODUCT_04427 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_04428 | COMP_0495 | banking_products | checking | USD | 10 |
| PRODUCT_04430 | COMP_0292 | banking_products | checking | GHS | 664 |
| PRODUCT_04435 | COMP_1159 | banking_products | checking | GBP | 8 |
| PRODUCT_04436 | COMP_1141 | banking_products | checking | USD | 0 |
| PRODUCT_04445 | COMP_0265 | banking_products | checking | GBP | 0 |
| PRODUCT_04449 | COMP_0621 | banking_products | checking | USD | 241 |
| PRODUCT_04462 | COMP_0256 | banking_products | checking | USD | 22 |
| PRODUCT_04481 | COMP_0402 | banking_products | checking | USD | 0 |
| PRODUCT_04487 | COMP_0855 | debt_products | guarantee | MXN | 0 |
| PRODUCT_04518 | COMP_1222 | banking_products | checking | MXN | 2255 |
| PRODUCT_04520 | COMP_1222 | banking_products | checking | USD | 0 |
| PRODUCT_04524 | COMP_0496 | banking_products | checking | CAD | 0 |
| PRODUCT_04525 | COMP_1056 | banking_products | checking | GBP | 172 |
| PRODUCT_04529 | COMP_0236 | banking_products | checking | GBP | 0 |
| PRODUCT_04542 | COMP_0070 | banking_products | checking | USD | 32 |
| PRODUCT_04545 | COMP_0323 | banking_products | saving | USD | 7 |
| PRODUCT_04550 | COMP_0693 | banking_products | checking | GBP | 401 |
| PRODUCT_04555 | COMP_0843 | banking_products | checking | USD | 197 |
| PRODUCT_04561 | COMP_0059 | banking_products | checking | GBP | 1 |
| PRODUCT_04585 | COMP_0633 | banking_products | checking | USD | 6 |
| PRODUCT_04587 | COMP_1015 | banking_products | checking | USD | 36 |
| PRODUCT_04602 | COMP_0634 | banking_products | checking | USD | 0 |
| PRODUCT_04618 | COMP_1141 | banking_products | checking | USD | 0 |
| PRODUCT_04623 | COMP_0496 | banking_products | checking | JPY | 10 |
| PRODUCT_04625 | COMP_0576 | banking_products | checking | USD | 172 |
| PRODUCT_04637 | COMP_0525 | banking_products | checking | USD | 234 |
| PRODUCT_04655 | COMP_0656 | banking_products | checking | GBP | 24 |
| PRODUCT_04674 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_04695 | COMP_1053 | banking_products | checking | USD | 19 |
| PRODUCT_04700 | COMP_0856 | banking_products | checking | USD | 0 |
| PRODUCT_04710 | COMP_0828 | banking_products | checking | USD | 237 |
| PRODUCT_04715 | COMP_0438 | banking_products | checking | USD | 0 |
| PRODUCT_04719 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_04728 | COMP_0822 | banking_products | checking | COP | 1093 |
| PRODUCT_04730 | COMP_0145 | banking_products | checking | USD | 2309 |
| PRODUCT_04734 | COMP_1053 | banking_products | checking | USD | 2 |
| PRODUCT_04739 | COMP_0880 | banking_products | wallet | USD | 1069 |
| PRODUCT_04740 | COMP_0035 | banking_products | checking | USD | 12 |
| PRODUCT_04750 | COMP_0666 | banking_products | checking | ARS | 382 |
| PRODUCT_04776 | COMP_0728 | banking_products | checking | USD | 20 |
| PRODUCT_04779 | COMP_1159 | banking_products | checking | USD | 18 |
| PRODUCT_04781 | COMP_1187 | banking_products | checking | GBP | 240 |
| PRODUCT_04813 | COMP_1282 | banking_products | checking | USD | 94 |
| PRODUCT_04824 | COMP_1237 | banking_products | checking | USD | 6 |
| PRODUCT_04829 | COMP_0437 | banking_products | checking | USD | 0 |
| PRODUCT_04831 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_04846 | COMP_0860 | banking_products | checking | XOF | 193 |
| PRODUCT_04847 | COMP_1186 | banking_products | checking | PLN | 59 |
| PRODUCT_04851 | COMP_1023 | banking_products | checking | NOK | 154 |
| PRODUCT_04860 | COMP_0919 | banking_products | checking | USD | 0 |
| PRODUCT_04869 | COMP_0341 | banking_products | checking | GBP | 23 |
| PRODUCT_04870 | COMP_1089 | banking_products | checking | USD | 11 |
| PRODUCT_04877 | COMP_0477 | debt_products | loan | USD | 0 |
| PRODUCT_04881 | COMP_0445 | banking_products | checking | USD | 1 |
| PRODUCT_04885 | COMP_0437 | banking_products | checking | USD | 38 |
| PRODUCT_04902 | COMP_0135 | banking_products | checking | USD | 206 |
| PRODUCT_04906 | COMP_0292 | banking_products | checking | USD | 4 |
| PRODUCT_04907 | COMP_1056 | banking_products | checking | GBP | 63 |
| PRODUCT_04910 | COMP_0361 | banking_products | checking | BRL | 0 |
| PRODUCT_04916 | COMP_1203 | banking_products | checking | GBP | 2 |
| PRODUCT_04924 | COMP_0437 | banking_products | checking | USD | 0 |
| PRODUCT_04943 | COMP_0863 | banking_products | checking | USD | 13 |
| PRODUCT_04963 | COMP_1141 | banking_products | checking | GBP | 4425 |
| PRODUCT_04964 | COMP_0247 | banking_products | wallet | USD | 6 |
| PRODUCT_04974 | COMP_0464 | banking_products | saving | NOK | 2 |
| PRODUCT_04983 | COMP_0253 | banking_products | checking | USD | 0 |
| PRODUCT_04989 | COMP_0189 | banking_products | checking | GBP | 135 |
| PRODUCT_05001 | COMP_1067 | banking_products | checking | USD | 652 |
| PRODUCT_05002 | COMP_1229 | banking_products | checking | USD | 35 |
| PRODUCT_05003 | COMP_0777 | banking_products | checking | USD | 69 |
| PRODUCT_05009 | COMP_0939 | banking_products | checking | USD | 184 |
| PRODUCT_05014 | COMP_0909 | banking_products | checking | USD | 0 |
| PRODUCT_05019 | COMP_0616 | banking_products | checking | GBP | 632 |
| PRODUCT_05020 | COMP_1163 | banking_products | checking | JPY | 0 |
| PRODUCT_05023 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_05037 | COMP_0909 | banking_products | checking | USD | 93 |
| PRODUCT_05038 | COMP_0029 | banking_products | checking | SGD | 322 |
| PRODUCT_05040 | COMP_0252 | banking_products | checking | USD | 0 |
| PRODUCT_05049 | COMP_0690 | banking_products | checking | USD | 267 |
| PRODUCT_05057 | COMP_0690 | banking_products | checking | USD | 1233 |
| PRODUCT_05060 | COMP_0961 | banking_products | checking | USD | 294 |
| PRODUCT_05061 | COMP_0521 | banking_products | checking | USD | 146 |
| PRODUCT_05077 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_05082 | COMP_0042 | banking_products | checking | CAD | 79 |
| PRODUCT_05096 | COMP_0361 | banking_products | checking | CAD | 0 |
| PRODUCT_05101 | COMP_0341 | banking_products | checking | USD | 1247 |
| PRODUCT_05118 | COMP_1162 | banking_products | checking | USD | 186 |
| PRODUCT_05120 | COMP_0361 | banking_products | checking | PHP | 0 |
| PRODUCT_05125 | COMP_0399 | banking_products | checking | USD | 0 |
| PRODUCT_05141 | COMP_0361 | banking_products | checking | RUB | 0 |
| PRODUCT_05147 | COMP_0042 | banking_products | checking | USD | 61 |
| PRODUCT_05150 | COMP_0460 | banking_products | checking | CAD | 0 |
| PRODUCT_05155 | COMP_0075 | banking_products | checking | USD | 8 |
| PRODUCT_05158 | COMP_0361 | banking_products | checking | USD | 1116 |
| PRODUCT_05169 | COMP_0075 | banking_products | checking | USD | 4 |
| PRODUCT_05182 | COMP_0471 | banking_products | checking | USD | 0 |
| PRODUCT_05184 | COMP_0945 | banking_products | checking | USD | 0 |
| PRODUCT_05187 | COMP_0471 | banking_products | checking | USD | 0 |
| PRODUCT_05196 | COMP_0042 | banking_products | checking | USD | 0 |
| PRODUCT_05199 | COMP_0656 | banking_products | checking | USD | 585 |
| PRODUCT_05205 | COMP_0234 | banking_products | checking | GBP | 360 |
| PRODUCT_05220 | COMP_0496 | banking_products | checking | USD | 48 |
| PRODUCT_05221 | COMP_0336 | banking_products | checking | GBP | 0 |
| PRODUCT_05223 | COMP_1056 | banking_products | checking | USD | 0 |
| PRODUCT_05229 | COMP_0352 | banking_products | checking | USD | 41 |
| PRODUCT_05234 | COMP_0302 | banking_products | checking | PLN | 0 |
| PRODUCT_05238 | COMP_0622 | banking_products | checking | GBP | 0 |
| PRODUCT_05250 | COMP_0836 | banking_products | checking | GBP | 351 |
| PRODUCT_05252 | COMP_0252 | banking_products | checking | NOK | 19 |
| PRODUCT_05254 | COMP_0988 | banking_products | checking | USD | 0 |
| PRODUCT_05267 | COMP_1255 | banking_products | checking | SEK | 11 |
| PRODUCT_05268 | COMP_0919 | banking_products | checking | USD | 205 |
| PRODUCT_05274 | COMP_0292 | banking_products | checking | USD | 1 |
| PRODUCT_05281 | COMP_0020 | banking_products | checking | GBP | 0 |
| PRODUCT_05318 | COMP_0292 | banking_products | checking | GHS | 396 |
| PRODUCT_05320 | COMP_0042 | banking_products | checking | USD | 200 |
| PRODUCT_05341 | COMP_0759 | banking_products | card | USD | 263 |
| PRODUCT_05346 | COMP_0928 | banking_products | checking | USD | 0 |
| PRODUCT_05370 | COMP_0658 | banking_products | checking | AED | 200 |
| PRODUCT_05385 | COMP_0406 | banking_products | checking | USD | 0 |
| PRODUCT_05386 | COMP_0030 | banking_products | checking | BRL | 8 |
| PRODUCT_05394 | COMP_0605 | banking_products | checking | GBP | 64 |
| PRODUCT_05395 | COMP_1187 | banking_products | checking | GBP | 0 |
| PRODUCT_05419 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_05422 | COMP_0240 | banking_products | checking | USD | 0 |
| PRODUCT_05423 | COMP_0073 | banking_products | checking | GBP | 91 |
| PRODUCT_05427 | COMP_0007 | banking_products | checking | USD | 20 |
| PRODUCT_05429 | COMP_0252 | banking_products | checking | DKK | 0 |
| PRODUCT_05434 | COMP_0727 | banking_products | checking | USD | 32 |
| PRODUCT_05438 | COMP_1272 | banking_products | checking | USD | 108 |
| PRODUCT_05440 | COMP_0158 | banking_products | checking | USD | 349 |
| PRODUCT_05449 | COMP_0856 | banking_products | checking | USD | 124 |
| PRODUCT_05458 | COMP_0896 | banking_products | checking | USD | 62 |
| PRODUCT_05465 | COMP_0351 | banking_products | checking | USD | 23 |
| PRODUCT_05483 | COMP_0487 | banking_products | checking | COP | 117 |
| PRODUCT_05492 | COMP_0808 | banking_products | checking | USD | 35 |
| PRODUCT_05495 | COMP_1254 | banking_products | wallet | USD | 2 |
| PRODUCT_05505 | COMP_0606 | banking_products | checking | GBP | 130 |
| PRODUCT_05506 | COMP_0489 | banking_products | checking | DKK | 26 |
| PRODUCT_05528 | COMP_0042 | banking_products | checking | USD | 1794 |
| PRODUCT_05532 | COMP_0385 | banking_products | checking | USD | 145 |
| PRODUCT_05541 | COMP_0447 | banking_products | checking | USD | 0 |
| PRODUCT_05543 | COMP_0994 | banking_products | checking | USD | 55 |
| PRODUCT_05555 | COMP_0302 | banking_products | checking | USD | 2 |
| PRODUCT_05594 | COMP_0271 | banking_products | checking | USD | 0 |
| PRODUCT_05607 | COMP_1103 | banking_products | checking | USD | 0 |
| PRODUCT_05608 | COMP_1056 | banking_products | checking | CHF | 0 |
| PRODUCT_05614 | COMP_1170 | banking_products | checking | USD | 1 |
| PRODUCT_05617 | COMP_0336 | banking_products | checking | USD | 0 |
| PRODUCT_05618 | COMP_0695 | banking_products | checking | USD | 0 |
| PRODUCT_05622 | COMP_0027 | banking_products | checking | USD | 19 |
| PRODUCT_05624 | COMP_0928 | banking_products | checking | USD | 30 |
| PRODUCT_05634 | COMP_0909 | banking_products | checking | USD | 2 |
| PRODUCT_05635 | COMP_1015 | banking_products | checking | USD | 971 |
| PRODUCT_05641 | COMP_0351 | banking_products | checking | USD | 0 |
| PRODUCT_05658 | COMP_1155 | banking_products | wallet | USD | 269 |
| PRODUCT_05661 | COMP_0274 | banking_products | checking | USD | 79 |
| PRODUCT_05664 | COMP_0189 | banking_products | checking | GBP | 0 |
| PRODUCT_05684 | COMP_0775 | banking_products | checking | GBP | 72 |
| PRODUCT_05691 | COMP_0527 | banking_products | checking | USD | 12 |
| PRODUCT_05694 | COMP_0344 | banking_products | checking | USD | 57 |
| PRODUCT_05729 | COMP_0035 | banking_products | checking | USD | 1 |
| PRODUCT_05735 | COMP_0101 | banking_products | checking | USD | 2 |
| PRODUCT_05743 | COMP_0280 | banking_products | checking | GBP | 571 |
| PRODUCT_05753 | COMP_1056 | banking_products | checking | CHF | 9 |
| PRODUCT_05764 | COMP_0477 | debt_products | lineofcredit | USD | 132 |
| PRODUCT_05765 | COMP_0504 | banking_products | checking | USD | 55 |
| PRODUCT_05783 | COMP_1089 | banking_products | checking | USD | 404 |
| PRODUCT_05784 | COMP_0477 | banking_products | checking | USD | 2 |
| PRODUCT_05790 | COMP_0984 | banking_products | checking | USD | 49 |
| PRODUCT_05807 | COMP_0580 | banking_products | checking | GBP | 282 |
| PRODUCT_05815 | COMP_0560 | banking_products | checking | USD | 367 |
| PRODUCT_05819 | COMP_0336 | banking_products | checking | GBP | 1 |
| PRODUCT_05821 | COMP_0107 | banking_products | checking | PEN | 673 |
| PRODUCT_05823 | COMP_0566 | banking_products | checking | GBP | 509 |
| PRODUCT_05829 | COMP_0855 | banking_products | checking | USD | 27 |
| PRODUCT_05837 | COMP_0919 | banking_products | checking | USD | 0 |
| PRODUCT_05849 | COMP_1222 | banking_products | checking | MXN | 622 |
| PRODUCT_05854 | COMP_0154 | banking_products | checking | GBP | 37 |
| PRODUCT_05883 | COMP_0690 | banking_products | checking | GBP | 102 |
| PRODUCT_05899 | COMP_1003 | banking_products | checking | MXN | 2381 |
| PRODUCT_05907 | COMP_0252 | banking_products | checking | HUF | 0 |
| PRODUCT_05916 | COMP_1282 | banking_products | investment | USD | 0 |
| PRODUCT_05919 | COMP_0633 | banking_products | checking | TRY | 0 |
| PRODUCT_05923 | COMP_1104 | banking_products | checking | USD | 331 |
| PRODUCT_05937 | COMP_0754 | banking_products | checking | GBP | 80 |
| PRODUCT_05944 | COMP_1201 | banking_products | checking | AUD | 453 |
| PRODUCT_05952 | COMP_0385 | banking_products | checking | USD | 101 |
| PRODUCT_05957 | COMP_0612 | banking_products | checking | CZK | 0 |
| PRODUCT_05959 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_05960 | COMP_0061 | banking_products | checking | GBP | 0 |
| PRODUCT_05972 | COMP_0860 | banking_products | checking | XOF | 0 |
| PRODUCT_05982 | COMP_0438 | banking_products | checking | GBP | 0 |
| PRODUCT_05991 | COMP_0493 | banking_products | checking | CAD | 89 |
| PRODUCT_05992 | COMP_0641 | banking_products | checking | PEN | 117 |
| PRODUCT_06002 | COMP_0849 | banking_products | wallet | USD | 0 |
| PRODUCT_06003 | COMP_0237 | banking_products | checking | GBP | 156 |
| PRODUCT_06008 | COMP_0754 | banking_products | checking | GBP | 2 |
| PRODUCT_06017 | COMP_1057 | banking_products | checking | USD | 68 |
| PRODUCT_06042 | COMP_0276 | banking_products | checking | AOA | 70 |
| PRODUCT_06068 | COMP_0666 | banking_products | checking | USD | 0 |
| PRODUCT_06070 | COMP_1108 | banking_products | checking | USD | 92 |
| PRODUCT_06072 | COMP_1192 | banking_products | checking | COP | 1217 |
| PRODUCT_06077 | COMP_0257 | banking_products | checking | USD | 16 |
| PRODUCT_06080 | COMP_0007 | debt_products | lineofcredit | USD | 8 |
| PRODUCT_06099 | COMP_0775 | banking_products | checking | GBP | 4 |
| PRODUCT_06113 | COMP_0496 | banking_products | checking | THB | 0 |
| PRODUCT_06121 | COMP_0909 | banking_products | checking | USD | 3 |
| PRODUCT_06122 | COMP_1141 | banking_products | checking | USD | 33 |
| PRODUCT_06127 | COMP_1015 | banking_products | checking | USD | 37 |
| PRODUCT_06128 | COMP_0909 | banking_products | checking | GBP | 11 |
| PRODUCT_06132 | COMP_1014 | banking_products | checking | AUD | 752 |
| PRODUCT_06160 | COMP_0693 | banking_products | checking | USD | 160 |
| PRODUCT_06168 | COMP_0007 | banking_products | checking | USD | 44 |
| PRODUCT_06170 | COMP_0437 | banking_products | checking | USD | 97 |
| PRODUCT_06172 | COMP_0252 | banking_products | checking | PLN | 0 |
| PRODUCT_06175 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_06181 | COMP_1163 | banking_products | checking | GBP | 68 |
| PRODUCT_06206 | COMP_0314 | banking_products | checking | SEK | 2 |
| PRODUCT_06208 | COMP_0730 | banking_products | checking | SEK | 416 |
| PRODUCT_06212 | COMP_0007 | banking_products | checking | USD | 594 |
| PRODUCT_06218 | COMP_0236 | banking_products | checking | USD | 2 |
| PRODUCT_06224 | COMP_0231 | banking_products | checking | USD | 31 |
| PRODUCT_06247 | COMP_0314 | banking_products | checking | USD | 2 |
| PRODUCT_06249 | COMP_1023 | banking_products | checking | NOK | 1 |
| PRODUCT_06257 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_06263 | COMP_0252 | banking_products | checking | AED | 0 |
| PRODUCT_06266 | COMP_0163 | banking_products | checking | MXN | 1327 |
| PRODUCT_06270 | COMP_1023 | banking_products | checking | USD | 48 |
| PRODUCT_06273 | COMP_0090 | banking_products | wallet | USD | 0 |
| PRODUCT_06285 | COMP_0836 | banking_products | checking | GBP | 36 |
| PRODUCT_06288 | COMP_0445 | banking_products | checking | USD | 45 |
| PRODUCT_06297 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_06307 | COMP_0807 | banking_products | checking | GBP | 0 |
| PRODUCT_06310 | COMP_1053 | banking_products | checking | USD | 571 |
| PRODUCT_06314 | COMP_0093 | banking_products | checking | GBP | 124 |
| PRODUCT_06317 | COMP_0117 | banking_products | checking | USD | 442 |
| PRODUCT_06326 | COMP_1141 | banking_products | checking | GBP | 370 |
| PRODUCT_06332 | COMP_1222 | banking_products | checking | MXN | 0 |
| PRODUCT_06341 | COMP_0463 | banking_products | checking | USD | 2656 |
| PRODUCT_06350 | COMP_0504 | banking_products | checking | SGD | 1 |
| PRODUCT_06355 | COMP_0274 | banking_products | checking | USD | 0 |
| PRODUCT_06368 | COMP_0252 | banking_products | checking | SEK | 330 |
| PRODUCT_06375 | COMP_0306 | banking_products | checking | COP | 2354 |
| PRODUCT_06377 | COMP_0055 | banking_products | checking | USD | 39 |
| PRODUCT_06379 | COMP_0247 | banking_products | checking | USD | 1167 |
| PRODUCT_06381 | COMP_0252 | banking_products | checking | USD | 271 |
| PRODUCT_06387 | COMP_0252 | banking_products | checking | HUF | 0 |
| PRODUCT_06394 | COMP_0061 | banking_products | checking | USD | 0 |
| PRODUCT_06414 | COMP_1067 | banking_products | checking | NZD | 801 |
| PRODUCT_06426 | COMP_0365 | banking_products | checking | USD | 204 |
| PRODUCT_06427 | COMP_0525 | banking_products | checking | MXN | 0 |
| PRODUCT_06428 | COMP_0807 | banking_products | checking | USD | 0 |
| PRODUCT_06429 | COMP_0630 | banking_products | checking | USD | 44 |
| PRODUCT_06431 | COMP_1282 | banking_products | checking | USD | 0 |
| PRODUCT_06435 | COMP_1053 | banking_products | checking | USD | 8 |
| PRODUCT_06439 | COMP_0900 | banking_products | checking | AOA | 56 |
| PRODUCT_06445 | COMP_1231 | banking_products | checking | GBP | 118 |
| PRODUCT_06451 | COMP_0249 | banking_products | checking | GBP | 413 |
| PRODUCT_06453 | COMP_0992 | banking_products | checking | USD | 18 |
| PRODUCT_06461 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_06466 | COMP_0249 | banking_products | checking | GBP | 0 |
| PRODUCT_06470 | COMP_0641 | banking_products | checking | USD | 114 |
| PRODUCT_06473 | COMP_0253 | banking_products | checking | GBP | 0 |
| PRODUCT_06482 | COMP_0201 | banking_products | checking | GBP | 104 |
| PRODUCT_06486 | COMP_0761 | banking_products | checking | CHF | 168 |
| PRODUCT_06492 | COMP_0240 | banking_products | checking | CAD | 0 |
| PRODUCT_06497 | COMP_0919 | debt_products | confirming | USD | 0 |
| PRODUCT_06500 | COMP_1254 | banking_products | wallet | GBP | 69 |
| PRODUCT_06520 | COMP_0423 | banking_products | checking | USD | 4 |
| PRODUCT_06523 | COMP_0744 | banking_products | checking | USD | 208 |
| PRODUCT_06529 | COMP_1071 | banking_products | checking | GBP | 40 |
| PRODUCT_06544 | COMP_0864 | banking_products | checking | USD | 2 |
| PRODUCT_06549 | COMP_0035 | banking_products | checking | USD | 9 |
| PRODUCT_06554 | COMP_0524 | banking_products | checking | USD | 17 |
| PRODUCT_06556 | COMP_1056 | banking_products | checking | USD | 883 |
| PRODUCT_06572 | COMP_1201 | banking_products | checking | USD | 13 |
| PRODUCT_06578 | COMP_0864 | banking_products | checking | USD | 0 |
| PRODUCT_06580 | COMP_0191 | banking_products | checking | GBP | 1532 |
| PRODUCT_06587 | COMP_0094 | banking_products | checking | USD | 0 |
| PRODUCT_06597 | COMP_0656 | banking_products | checking | USD | 80 |
| PRODUCT_06605 | COMP_0163 | banking_products | checking | USD | 67 |
| PRODUCT_06614 | COMP_0464 | banking_products | checking | NOK | 21 |
| PRODUCT_06625 | COMP_0252 | banking_products | checking | CZK | 0 |
| PRODUCT_06640 | COMP_0562 | banking_products | checking | USD | 52 |
| PRODUCT_06656 | COMP_0361 | banking_products | checking | USD | 29 |
| PRODUCT_06666 | COMP_0759 | banking_products | checking | USD | 1185 |
| PRODUCT_06668 | COMP_0187 | banking_products | checking | PLN | 30 |
| PRODUCT_06669 | COMP_0299 | banking_products | checking | USD | 105 |
| PRODUCT_06682 | COMP_1103 | banking_products | checking | GBP | 2 |
| PRODUCT_06690 | COMP_1083 | banking_products | checking | PLN | 0 |
| PRODUCT_06695 | COMP_1203 | banking_products | saving | GBP | 0 |
| PRODUCT_06704 | COMP_0576 | banking_products | checking | USD | 1231 |
| PRODUCT_06710 | COMP_1162 | banking_products | checking | JPY | 24 |
| PRODUCT_06734 | COMP_0373 | banking_products | checking | CHF | 1949 |
| PRODUCT_06736 | COMP_0404 | banking_products | checking | USD | 20 |
| PRODUCT_06747 | COMP_0864 | banking_products | checking | USD | 1120 |
| PRODUCT_06771 | COMP_0808 | banking_products | checking | USD | 0 |
| PRODUCT_06772 | COMP_0182 | banking_products | checking | USD | 0 |
| PRODUCT_06784 | COMP_1190 | banking_products | checking | USD | 328 |
| PRODUCT_06790 | COMP_0073 | banking_products | checking | USD | 266 |
| PRODUCT_06807 | COMP_1004 | banking_products | checking | USD | 14 |
| PRODUCT_06818 | COMP_0566 | banking_products | checking | USD | 312 |
| PRODUCT_06822 | COMP_1023 | banking_products | checking | NOK | 0 |
| PRODUCT_06823 | COMP_0406 | banking_products | investment | USD | 0 |
| PRODUCT_06836 | COMP_0921 | banking_products | checking | GBP | 0 |
| PRODUCT_06845 | COMP_1014 | banking_products | checking | AUD | 0 |
| PRODUCT_06850 | COMP_0236 | banking_products | checking | PLN | 0 |
| PRODUCT_06855 | COMP_0438 | banking_products | checking | USD | 0 |
| PRODUCT_06866 | COMP_0641 | banking_products | checking | PEN | 553 |
| PRODUCT_06879 | COMP_0614 | banking_products | checking | USD | 0 |
| PRODUCT_06885 | COMP_0292 | banking_products | checking | USD | 0 |
| PRODUCT_06894 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_06922 | COMP_1187 | banking_products | checking | GBP | 2 |
| PRODUCT_06937 | COMP_0730 | banking_products | checking | SEK | 10 |
| PRODUCT_06941 | COMP_1056 | banking_products | checking | USD | 18 |
| PRODUCT_06948 | COMP_0129 | banking_products | checking | USD | 4 |
| PRODUCT_06950 | COMP_0848 | banking_products | checking | USD | 75 |
| PRODUCT_06951 | COMP_0976 | banking_products | checking | GBP | 207 |
| PRODUCT_06968 | COMP_0692 | banking_products | checking | USD | 0 |
| PRODUCT_06992 | COMP_0730 | banking_products | checking | USD | 115 |
| PRODUCT_06997 | COMP_1166 | banking_products | card | USD | 1225 |
| PRODUCT_06998 | COMP_0233 | banking_products | checking | USD | 690 |
| PRODUCT_06999 | COMP_1190 | banking_products | checking | GBP | 9 |
| PRODUCT_07004 | COMP_0605 | banking_products | checking | GBP | 867 |
| PRODUCT_07010 | COMP_0460 | banking_products | checking | GBP | 10 |
| PRODUCT_07018 | COMP_0163 | banking_products | checking | MXN | 91 |
| PRODUCT_07031 | COMP_0477 | debt_products | lineofcredit | USD | 1257 |
| PRODUCT_07033 | COMP_0864 | banking_products | checking | USD | 2 |
| PRODUCT_07042 | COMP_1056 | banking_products | checking | GBP | 0 |
| PRODUCT_07044 | COMP_1066 | banking_products | checking | GBP | 1 |
| PRODUCT_07051 | COMP_1229 | banking_products | checking | USD | 18 |
| PRODUCT_07072 | COMP_0693 | banking_products | checking | GBP | 139 |
| PRODUCT_07074 | COMP_0496 | banking_products | checking | ZAR | 0 |
| PRODUCT_07078 | COMP_0440 | banking_products | checking | USD | 20 |
| PRODUCT_07094 | COMP_0515 | banking_products | checking | USD | 580 |
| PRODUCT_07098 | COMP_0496 | banking_products | checking | USD | 4 |
| PRODUCT_07104 | COMP_0528 | banking_products | checking | CHF | 651 |
| PRODUCT_07113 | COMP_0234 | banking_products | checking | USD | 218 |
| PRODUCT_07117 | COMP_0072 | banking_products | checking | GBP | 62 |
| PRODUCT_07131 | COMP_0025 | banking_products | checking | USD | 801 |
| PRODUCT_07138 | COMP_0946 | banking_products | checking | USD | 21 |
| PRODUCT_07139 | COMP_0406 | banking_products | investment | USD | 0 |
| PRODUCT_07151 | COMP_1067 | banking_products | checking | SGD | 159 |
| PRODUCT_07155 | COMP_1004 | banking_products | checking | USD | 212 |
| PRODUCT_07156 | COMP_1222 | banking_products | wallet | MXN | 10 |
| PRODUCT_07163 | COMP_0799 | banking_products | checking | GBP | 6 |
| PRODUCT_07180 | COMP_0025 | banking_products | checking | USD | 23 |
| PRODUCT_07190 | COMP_1053 | debt_products | guarantee | USD | 0 |
| PRODUCT_07204 | COMP_0670 | banking_products | checking | USD | 0 |
| PRODUCT_07211 | COMP_1066 | banking_products | checking | USD | 0 |
| PRODUCT_07218 | COMP_0257 | banking_products | checking | USD | 17 |
| PRODUCT_07219 | COMP_0848 | banking_products | checking | USD | 345 |
| PRODUCT_07223 | COMP_0370 | banking_products | investment | GBP | 0 |
| PRODUCT_07226 | COMP_0313 | banking_products | checking | USD | 93 |
| PRODUCT_07247 | COMP_0302 | banking_products | checking | PLN | 15 |
| PRODUCT_07252 | COMP_1187 | banking_products | checking | GBP | 1182 |
| PRODUCT_07258 | COMP_0268 | banking_products | checking | CAD | 214 |
| PRODUCT_07275 | COMP_0110 | banking_products | saving | NOK | 11 |
| PRODUCT_07282 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_07300 | COMP_0042 | banking_products | checking | USD | 45 |
| PRODUCT_07308 | COMP_0300 | banking_products | checking | USD | 165 |
| PRODUCT_07311 | COMP_0777 | banking_products | checking | USD | 242 |
| PRODUCT_07351 | COMP_0860 | banking_products | checking | XOF | 62 |
| PRODUCT_07371 | COMP_0832 | banking_products | checking | USD | 3 |
| PRODUCT_07384 | COMP_0765 | banking_products | checking | NAD | 1425 |
| PRODUCT_07387 | COMP_0744 | banking_products | wallet | MXN | 2 |
| PRODUCT_07388 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_07392 | COMP_0514 | banking_products | checking | GBP | 10 |
| PRODUCT_07394 | COMP_0349 | banking_products | checking | GBP | 26 |
| PRODUCT_07396 | COMP_1173 | banking_products | checking | USD | 115 |
| PRODUCT_07398 | COMP_0288 | banking_products | checking | USD | 0 |
| PRODUCT_07420 | COMP_0658 | banking_products | checking | AED | 756 |
| PRODUCT_07429 | COMP_0611 | banking_products | checking | JPY | 101 |
| PRODUCT_07431 | COMP_0828 | banking_products | checking | MZN | 1087 |
| PRODUCT_07435 | COMP_0104 | banking_products | checking | NZD | 603 |
| PRODUCT_07445 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_07472 | COMP_0256 | banking_products | checking | USD | 187 |
| PRODUCT_07485 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_07501 | COMP_0313 | banking_products | checking | GBP | 4 |
| PRODUCT_07510 | COMP_1006 | banking_products | checking | USD | 0 |
| PRODUCT_07511 | COMP_0518 | banking_products | checking | USD | 643 |
| PRODUCT_07516 | COMP_0233 | banking_products | checking | CLP | 11 |
| PRODUCT_07527 | COMP_0280 | banking_products | checking | USD | 307 |
| PRODUCT_07529 | COMP_0799 | banking_products | checking | GBP | 0 |
| PRODUCT_07534 | COMP_0249 | banking_products | checking | USD | 0 |
| PRODUCT_07535 | COMP_0900 | banking_products | checking | AOA | 1119 |
| PRODUCT_07541 | COMP_0252 | banking_products | checking | GBP | 2 |
| PRODUCT_07546 | COMP_0167 | banking_products | checking | USD | 68 |
| PRODUCT_07555 | COMP_0880 | banking_products | checking | USD | 1000 |
| PRODUCT_07576 | COMP_0521 | banking_products | checking | USD | 751 |
| PRODUCT_07580 | COMP_1075 | banking_products | checking | USD | 1 |
| PRODUCT_07583 | COMP_0879 | banking_products | checking | GBP | 10 |
| PRODUCT_07592 | COMP_0856 | banking_products | checking | SGD | 0 |
| PRODUCT_07612 | COMP_0616 | banking_products | checking | USD | 333 |
| PRODUCT_07618 | COMP_0043 | banking_products | checking | USD | 57 |
| PRODUCT_07622 | COMP_0633 | banking_products | checking | GBP | 20 |
| PRODUCT_07625 | COMP_0320 | banking_products | checking | USD | 1 |
| PRODUCT_07626 | COMP_0900 | banking_products | checking | AOA | 382 |
| PRODUCT_07637 | COMP_0495 | banking_products | checking | GBP | 0 |
| PRODUCT_07648 | COMP_1003 | banking_products | checking | USD | 56 |
| PRODUCT_07655 | COMP_0038 | banking_products | checking | USD | 10 |
| PRODUCT_07658 | COMP_0617 | banking_products | checking | MXN | 327 |
| PRODUCT_07665 | COMP_0437 | banking_products | checking | USD | 24 |
| PRODUCT_07672 | COMP_0471 | banking_products | checking | USD | 29 |
| PRODUCT_07685 | COMP_0990 | banking_products | checking | USD | 201 |
| PRODUCT_07687 | COMP_0292 | banking_products | checking | GHS | 0 |
| PRODUCT_07705 | COMP_0728 | banking_products | card | USD | 1 |
| PRODUCT_07707 | COMP_0042 | banking_products | checking | USD | 70 |
| PRODUCT_07708 | COMP_1071 | banking_products | checking | GBP | 7 |
| PRODUCT_07738 | COMP_1187 | banking_products | checking | USD | 0 |
| PRODUCT_07744 | COMP_0344 | banking_products | checking | GBP | 0 |
| PRODUCT_07764 | COMP_0708 | banking_products | checking | USD | 0 |
| PRODUCT_07768 | COMP_0073 | banking_products | checking | GBP | 0 |
| PRODUCT_07776 | COMP_0618 | banking_products | checking | USD | 0 |
| PRODUCT_07777 | COMP_0007 | banking_products | checking | USD | 98 |
| PRODUCT_07782 | COMP_1187 | banking_products | checking | GBP | 834 |
| PRODUCT_07812 | COMP_0163 | banking_products | checking | USD | 1 |
| PRODUCT_07813 | COMP_0695 | banking_products | checking | GBP | 0 |
| PRODUCT_07815 | COMP_0775 | banking_products | checking | USD | 3 |
| PRODUCT_07832 | COMP_0439 | banking_products | checking | GBP | 0 |
| PRODUCT_07834 | COMP_0670 | banking_products | checking | GBP | 2 |
| PRODUCT_07838 | COMP_1222 | banking_products | checking | MXN | 134 |
| PRODUCT_07842 | COMP_0518 | banking_products | checking | GBP | 143 |
| PRODUCT_07844 | COMP_0740 | banking_products | checking | USD | 28 |
| PRODUCT_07847 | COMP_0477 | banking_products | risk | USD | 0 |
| PRODUCT_07851 | COMP_0252 | banking_products | checking | SEK | 0 |
| PRODUCT_07862 | COMP_0152 | banking_products | checking | USD | 6 |
| PRODUCT_07873 | COMP_1023 | banking_products | checking | USD | 28 |
| PRODUCT_07877 | COMP_0057 | banking_products | investment | CAD | 0 |
| PRODUCT_07889 | COMP_0166 | banking_products | checking | GBP | 123 |
| PRODUCT_07895 | COMP_1067 | banking_products | checking | HKD | 27 |
| PRODUCT_07897 | COMP_0680 | banking_products | checking | CHF | 0 |
| PRODUCT_07901 | COMP_0550 | banking_products | wallet | USD | 0 |
| PRODUCT_07903 | COMP_1015 | banking_products | checking | USD | 34 |
| PRODUCT_07908 | COMP_0252 | banking_products | checking | PLN | 16 |
| PRODUCT_07909 | COMP_1249 | banking_products | checking | SEK | 0 |
| PRODUCT_07911 | COMP_0107 | banking_products | checking | PEN | 157 |
| PRODUCT_07928 | COMP_1103 | banking_products | checking | GBP | 162 |
| PRODUCT_07944 | COMP_0252 | banking_products | checking | RON | 0 |
| PRODUCT_07956 | COMP_0252 | banking_products | checking | PLN | 125 |
| PRODUCT_07966 | COMP_0880 | banking_products | checking | USD | 201 |
| PRODUCT_07979 | COMP_0252 | banking_products | checking | GBP | 25 |
| PRODUCT_07986 | COMP_1198 | banking_products | checking | USD | 1188 |
| PRODUCT_08019 | COMP_0643 | banking_products | checking | NOK | 73 |
| PRODUCT_08024 | COMP_0404 | banking_products | checking | USD | 542 |
| PRODUCT_08027 | COMP_1141 | banking_products | checking | GBP | 0 |
| PRODUCT_08028 | COMP_0629 | banking_products | checking | COP | 71 |
| PRODUCT_08036 | COMP_0984 | banking_products | checking | USD | 111 |
| PRODUCT_08047 | COMP_1249 | banking_products | checking | USD | 2 |
| PRODUCT_08070 | COMP_0241 | banking_products | checking | USD | 0 |
| PRODUCT_08073 | COMP_0518 | banking_products | checking | GBP | 7 |
| PRODUCT_08077 | COMP_0728 | banking_products | checking | USD | 1265 |
| PRODUCT_08097 | COMP_0504 | banking_products | checking | JPY | 4 |
| PRODUCT_08108 | COMP_1201 | banking_products | checking | USD | 138 |
| PRODUCT_08109 | COMP_0030 | banking_products | investment | BRL | 0 |
| PRODUCT_08127 | COMP_1249 | banking_products | checking | NOK | 2 |
| PRODUCT_08139 | COMP_1248 | banking_products | checking | USD | 72 |
| PRODUCT_08150 | COMP_0486 | banking_products | checking | USD | 8 |
| PRODUCT_08160 | COMP_0073 | banking_products | checking | USD | 0 |
| PRODUCT_08167 | COMP_0916 | banking_products | checking | USD | 25 |
| PRODUCT_08171 | COMP_0385 | banking_products | checking | GBP | 0 |
| PRODUCT_08177 | COMP_0879 | banking_products | checking | GBP | 59 |
| PRODUCT_08186 | COMP_0212 | banking_products | checking | USD | 12 |
| PRODUCT_08191 | COMP_0042 | banking_products | checking | USD | 3 |
| PRODUCT_08198 | COMP_0042 | banking_products | checking | USD | 4 |
| PRODUCT_08206 | COMP_0042 | banking_products | checking | USD | 947 |
| PRODUCT_08209 | COMP_0359 | banking_products | checking | USD | 420 |
| PRODUCT_08211 | COMP_0042 | banking_products | checking | CAD | 0 |
| PRODUCT_08213 | COMP_0042 | debt_products | loan | USD | 0 |
| PRODUCT_08215 | COMP_0945 | banking_products | checking | USD | 0 |
| PRODUCT_08220 | COMP_0440 | banking_products | checking | VND | 254 |

## 9. Feasible base-component definitions (proposed policy, not implementation)

### Shared eligibility contract and units

For an explicitly declared company and period, join transactions to the union of product tables by `product_id`, verify matching `company_id`, preserve IDs and record locators, and classify product source/type. Require `transactions.status == "booked"`, valid booking `date` inside the common cutoff/window, and inherited product `currency == "EUR"`. Unknown product/currency/status stays excluded with reason and count, not company-currency fallback. Default conservative operational scope is `banking_products.type == "checking"`; wider account scope needs duplicate/own-funding-flow validation. The observed EUR booked banking matrices are broader availability diagnostics. Amount-as-account-currency is a **provisional** assumption, not established by exchange_rate. Until confirmed, monetary components are provisional rather than verified EUR economics.

Use decimal arithmetic and original monetary units; no FX and no integer-ID coercion. Bucket by booking calendar month without assigning a timezone. Exclude explicitly ambiguous classifications/sign conflicts from the candidate numerator/denominator and report their count/materiality. Use categories as explicit candidate rules, with narrative conflicts flagged for reviewed mapping, never opportunistic keyword guesses. Keep fee/interest and return buckets disjoint from operational buckets. If economic comparability or classification evidence is insufficient, the component is NULL/unavailable even if a raw ratio could be calculated. Missing month, missing category, and numerical zero are different states.

These are amount-weighted proxies over observed rows, not calibrated default probabilities. Scoring thresholds, weightings, persistence windows, minimum materiality, and missing-component policy belong in explicit configuration agreed after research. No numeric 0–100 transformation is justified by this audit alone.

### 9.1 Operational inflow/outflow ratio

- **Exact source columns:** `transactions.transaction_id`, `company_id`, `product_id`, `date`, `amount`, `status`, `category`, `description`; product union `product_id`, `company_id`, `currency`, `type` and source table. `counterparty_id` is optional corroboration, not a required FK for this proxy.
- **Candidate numerator I:** sum positive amounts with `category in {collection, bulk_collection, pos_settlement}` after shared gates and unresolved transfer/financing conflicts excluded. All other positive categories, including investment_return, transfer, cash_settlement/cash_settlements, tax_refund, payment_refund, unknown, are excluded by default.
- **Candidate denominator O:** sum absolute negative amounts with `category in {payment, bulk_payment, utility, salary, social_security, tax}` after shared gates. Exclude fees, interest, collection refunds, debt principal, investment flows, cash/transfer classes, and unresolved conflicts. This is a gross operating-cash proxy, not net income/EBITDA. POS/cash-account de-duplication remains necessary if account scope broadens.
- **Definition / units:** `I / O`, dimensionless EUR/EUR. Period aggregation uses sum of eligible amounts then divide, not unweighted averaging of monthly ratios.
- **Zero denominator:** O=0 → NULL with reason `no_observed_operating_outflow`, including I=0; never infinity or best score. I=0 and O>0 gives numeric 0 **only** if the receipt-side coverage/classification is demonstrably adequate; otherwise unknown. A month with no source observations is always NULL, even if a program's sum([]) would equal zero.
- **Limitations/evidence needed:** category validation, documented amount currency, complete account coverage and transfer/financing exclusion. The 635,860 unclassified rows and internal-like narratives mean this can be computed descriptively but is not proven total operational health.

### 9.2 Chargeback rate (collection-return proxy only)

- **Sources/joins:** same shared transaction/product fields, plus category-specific evidence and, if later available, original collection/chargeback linkage. There is currently no such linkage column.
- **Candidate numerator R:** sum absolute negative `amount` where `category == "collection_refund"`. Positive collection_refund is a separate anomaly/reversal bucket; do not abs() it into returns. `payment_refund` concerns refunds of payments and is not a customer-collection chargeback by default.
- **Denominator:** gross eligible operating collection receipts I in the same declared period (`collection`, `bulk_collection`, `pos_settlement`, positive); **not** all positive cash, not invoice totals. All units EUR; `R/I` dimensionless, optionally display 100× as a percent. Bulk records preclude interpreting a record-count rate as a per-customer failure probability.
- **Zero denominator:** I=0 → NULL, regardless of R. R=0 and I>0 can yield 0 only when capture/classification of returns is adequate; absent evidence means `no_observed_returns`, not proven zero true chargebacks. R/I may exceed 1 due to lagged returns; do not silently clamp the raw metric.
- **Blocker/uncertainty:** this is not a verified card chargeback rate. Returns can reference collections outside the period, legitimate refunds, or corrections. Need provider definition of collection_refund, historical return completeness, and original-transaction linkage to claim a cohort chargeback rate. Keep label `collection_return_proxy` unless evidence supports the stronger meaning.

### 9.3 Fee/interest load

- **Sources/joins:** same transaction/product fields. Numerator F is the sum of absolute negative amounts for `category in {fee, interest_charge}` after shared gates. A record belongs to one source category and is counted once; keyword overlap must not double-count it.
- **Denominator / units:** gross eligible operational inflows I; `F/I`, EUR/EUR. State this denominator explicitly; using all debits or debt outstanding would define a different component.
- **Zero denominator:** I=0 → NULL. F=0 with I>0 is only observed zero and requires adequate fee capture for a confirmed zero. Positive fee amounts (71 overall) are excluded as unresolved credits/refunds, not automatically netted; no positive interest_charge was observed.
- **Limitations/evidence needed:** some charges appear in `payment`, `-`, or combined narratives; debt_repayment does not split principal and interest. Banks may net charges from receipts. Need validated category semantics, bank fee/interest coverage, and linked refund treatment. Do not sum debt_schedule interest estimates into observed interest charges or use current rates to reconstruct past charges.

### 9.4 Financial coverage — general historical computation blocked

- **Proposed meaning:** debt-service coverage, `(eligible operating inflow I − eligible operating outflow O) / debt_service_due`, where debt_service_due is principal plus contractual cash interest due in the same company, currency, and period. This is dimensionless; negative net operating cash is retained as negative if inputs are valid. Interest must not be counted twice in both O and debt service.
- **Potential columns/joins:** transaction fields above for cash generation; `debt_products.product_id`, `company_id`, `currency`, `type`; `debt_schedule_config.product_id`, `company_id`, `settlement_product_id`, `currency`, `granted_balance`, `outstanding_balance`, `total_periods`, `next_payment_date`, `last_payment_date`, `amortization_type`, `amortising_frequency`, `interest_calc_method`, `annual_interest_rate_or_spread`, `interest_type`. Join schedules to debt on `(product_id, company_id)` and settlement products through the product union with ownership checks.
- **Unavailable required input:** an exhaustive, historical, timestamped schedule of principal/interest **due amounts by period**, with amendments, rate history, payment allocation, and confirmation all facilities are captured. A next-payment date, current balance, or total periods is not that schedule. Only 87/2,239 facilities have terms; 2 settlement IDs are unresolved, another 8 point to debt rather than banking products. `debt_repayment` records cash paid, not necessarily contractual debt service due, and may combine principal/interest. Absence of debt products is not proof of no debt.
- **Zero denominator:** unobserved debt_service_due → NULL/missing, not zero debt. Verified zero contractual debt service → not applicable/NULL with reason, not infinity or automatic maximum; any distinct no-debt policy needs evidence and explicit configuration.
- **Optional distinct snapshot alternative, not silent substitution:** liquidity runway `validated available EUR cash at cutoff / average monthly eligible EUR operating outflows` has units **months**, not DSCR. Possible sources are `balances.product_id`, `company_id`, `date`, `balance`, `available`, `liquidity` joined to validated cash account types. But available is 100% missing, ledger balance is not proven unrestricted cash, liquidity is incomplete, snapshots are asynchronous, and debt balances/sign conventions complicate aggregation. It cannot create a historical monthly coverage series. A separately named current snapshot proxy would require approved semantics and synchronized point-in-time scope; never backfill the current snapshot into older months.
- **Data completeness remains separate:** observation-count coverage, join coverage, classification coverage, EUR exclusion share, and ingestion confidence are quality/confidence features, not financial coverage. Never relabel them as this fourth base component.

### Missing-component and score availability policy

The honest default is a partial component vector with financial coverage NULL and an explicit unavailable/provisional status. Do not claim a verified four-component score where a required input is blocked. An approved config may reweight available components for a clearly labeled partial-score product, but must publish active/missing components, weights, excluded coverage, and comparability limits; it cannot give missing inputs a neutral 50 or a zero by default. A hard completeness gate would currently block historical verified scores for every company. This trade-off requires the coordinator's decision after AGENT2 research, not a hidden implementation shortcut.

## 10. Verification, blockers, and coordinator handoff

- PASS: Independent os.walk file inventory equals recursive os.scandir inventory, including hidden entries.

- PASS: All nine source SHA-256 hashes unchanged after profiling.

- PASS: balances: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: banking_products: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: companies: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: debt_products: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: debt_schedule_config: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: groups: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: invoices: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: transactions: independent exact row count, per-column empty counts, company ID set, currency and category partitions reconciled.

- PASS: All 2,556,437 transaction records independently reconcile by company/calendar month and by currency; EUR booked banking monthly totals also reconcile.

- PASS: Zero malformed CSV records, numeric parse failures, date parse failures, duplicate primary keys, and duplicate complete rows in every CSV.

The report generator also asserts inventory/table coverage, company registry cardinality, 25-column matrix cardinality, raw and EUR monthly reconciliation, the completeness of all short-history/gap lists, and that `SCORING ASSUMPTIONS` is the last section. Source data were opened read-only; no source writes, deployments, commits, or subsequent phases are part of this task. Temporary local analysis programs are not scoring artifacts. The requested audit report is the sole project deliverable.

| Blocker / decision | Who / evidence needed | Consequence until resolved |
| --- | --- | --- |
| No certified complete monthly ingestion | Data provider: account roster, historical sync/statement coverage, reconciliation | Verified trajectories/persistence blocked; observed-data alternatives must be provisional. |
| Financial coverage inputs missing | Provider + coordinator: exhaustive due-amount history or approval of separately labeled alternative | General historical fourth component blocked; missing/reweight policy cannot be implicit. |
| Ambiguous categories, own-account transfers, and chargeback semantics | Provider: documented category meanings, source transaction codes, transfer/original-return links | Operating ratios and collection-return/fee proxies remain provisional with excluded/unknown buckets. |
| Currency semantics / unresolved products | Provider: missing product metadata and amount/exchange-rate unit definition | Exclude 1,314 unresolved-currency transactions and non-EUR activity; no undocumented FX. |
| Syntactically valid invalid-domain dates, extreme amounts, stale snapshots | Provider: domain validation rules, sentinel documentation, extract timestamp consistency | Do not infer overdue/coverage or silently impute/cap; flag or quarantine with evidence. |
| 0–100 calibration, cutoff/window persistence definition, missing/zero handling | AGENT2 + coordinator + AGENT3 configuration | Audit provides facts and candidate definitions, not calibrated thresholds or score implementation. |

No access or execution blockers prevented audit completion. The above are unresolved **downstream data/semantic blockers**, not skipped audit work. Assistance requested from the coordinator/provider is specific to these six items. Return this artifact to the coordinator; AGENT3 must wait for both this audit and AGENT2 research. Do not launch PHASE 2 from this task.

## SCORING ASSUMPTIONS

Status applies to the stated assumption/policy, not to every observed fact in its evidence. **Supported** means justified by observed data/documentation; **provisional** means an explicit proposed policy or unconfirmed inference; **blocked** means inputs do not support the required claim. The following list is the audit contract for AGENT3; these choices must be configurable and carried into result metadata.

| ID / subject | Assumption or proposed policy | Evidence | Uncertainty | Downstream impact | Status |
| --- | --- | --- | --- | --- | --- |
| A01 Source identity | Use exactly the nine hashed files and parsed CSV records, preserving IDs/zero padding. | Complete independent inventory and full record/null/key reconciliation; documented stable IDs. | A different extract invalidates counts and ordinal locators. | Bind evidence to source hash + ID + logical row ordinal; never normalize IDs to numbers. | supported |
| A02 Scoring date cutoff | Report as of 2026-09-01; closed history includes booking date < 2026-09-01, starting 2024-09-01. | Max booking 2026-09-01; September has one observed day. | Extract contains some metadata after this date; calendar closure is not verified ingestion. | Exclude September from closed-month score/trajectory; disclose stale/missing companies, do not use run date. | provisional |
| A03 History date | Use transactions.date (booking), not value_date; group by original naive calendar date. | Dictionary mapping; value_date spans 2022–2099 and has implausible values. | No timezone or booking-event version; same-day backfills may be unknown. | No assumed UTC conversion; future/invalid booking records would be quarantined; preserve raw dates. | supported |
| A04 Currency join | Resolve product_id using disjoint union of banking_products and debt_products, checking company_id. | 183,627 debt-linked and 1,314 unresolved transactions; zero known ownership mismatches. | 1,314 transaction currencies and 29 balance currencies remain unknown. | Keep join status, product source/type, and exclusion reason; no company-currency fallback. | supported |
| A05 EUR units | Treat amount on a resolved EUR product as EUR-account units only with explicit provisional labeling; no FX. | Products have currency; transaction currency is absent; EUR products include 10,312 non-unit rates. | Base/quote and whether amount is converted are undocumented. | Provider confirmation required for verified monetary interpretation; do not multiply/divide exchange_rate. | provisional |
| A06 Non-EUR filtering | Score only the EUR slice; exclude/disclose all known non-EUR and unknown currencies. | 249,046 known non-EUR and 1,314 unknown transaction rows; multi-currency register. | EUR slice may be unrepresentative or exclude all meaningful operations. | Never pool currencies; no eligible EUR activity is unavailable, not financial distress or zero flow. | provisional |
| A07 Posted status | Only status=booked is candidate realized cash; pending and empty excluded; accounting_status not cash cancellation. | 2,520,019 booked, 6,579 pending, 29,839 empty; dictionary reconciliation semantics. | Only current status; no lifecycle/event history. | No status-based historical knowledge claims; report exclusions, do not blindly remove DISCARDED. | provisional |
| A08 Amount sign | Negative is outgoing and positive incoming; zero is genuine observed numeric zero. | Dictionary and full numeric/sign profile; 369 zero-amount transactions. | Direction is not operating classification; corrections exist. | Preserve zeros and sign anomalies; never classify every credit as revenue or debit as cost. | supported |
| A09 Operating classification | Use the explicit candidate category sets in Section 9, checking-account scope, conflict flags, unknown bucket. | Full category/sign table and narrative conflict counts. | Auto-categories imperfect; capex, financing, internal funding can masquerade as operating. | Ratios are incomplete/provisional; no amount-sign fallback for unknown categories. | provisional |
| A10 Product scope | Resolve all product currencies, but conservative first operational scope is banking checking; widening is explicit. | EUR booked closed-horizon distribution includes cards/TPV/credit-related products; product type alone does not establish economics. | May exclude genuine operations on credit lines/cards; multi-account cash can duplicate. | Coverage matrix is an upper bound; publish excluded product types and re-evaluate component availability. | provisional |
| A11 Internal transfers | Do not assume every transfer is internal or every collection external; exclude ambiguous own-account candidates. | Both signs in transfer; internal-like terms across collection/payment; counterparties mostly missing. | No authoritative own-account counterparty map or paired transfer reference. | Reliable net external flow reconciliation is blocked without evidence; classification must carry ambiguity. | provisional |
| A12 Chargebacks | Use negative collection_refund / gross eligible collections only as collection_return_proxy. | 11,571 negative and 277 positive collection_refund rows; no original transaction linkage. | Legitimate refunds, temporal lag, card vs non-card returns unknown. | True cohort chargeback rate blocked; proxy can exceed 100% and must not be mislabeled. | provisional |
| A13 Fees/interest | Use gross negative fee and interest_charge once each; do not automatically net positive credits or split debt_repayment. | Observed category/sign distributions, keyword overlaps. | Uncategorized/netted/combined costs not fully observed. | F/I measures observed load, not exhaustive finance cost; positive fee corrections flagged. | provisional |
| A14 Duplicate/reversal handling | Use unique source IDs; do not delete distinct IDs merely sharing date/amount or cancel equal opposite signs. | Zero duplicate keys/full rows; no reversal linkage. | Economic duplicates, lifecycle aliases, transfer pairs can still exist. | Preserve raw rows and diagnostics; any future de-duplication rule needs evidence and retained provenance. | supported |
| A15 Month completeness | Observed means at least one record; gaps/outside-span months are NULL; no verified-complete months. | Full per-company matrix; no ingestion/statement interval manifest. | Cannot distinguish true quiet month from missing data, nor certify observed months complete. | No zero-fill; verified six-month trajectories/persistence blocked unless coverage evidence arrives. | supported |
| A16 Trajectory availability | Use calendar-consecutive endpoints and research-agreed windows, not any six observed labels or a partial last month. | 998 companies have EUR booked banking observations March–August; 670 across August 2025–August 2026; all are upper bounds. | Component-valid/full-complete counts may be smaller; exact window/persistence policy not set by data. | Never bridge gaps; flag unavailable history; require consecutive valid comparisons to confirm persistence. | provisional |
| A17 Financial coverage | Historical DSCR needs exhaustive principal+interest due amounts and historical amendments, not snapshot debt. | 87 schedules for 2,239 debt products; missing periodic cash due amounts; current debt balances and inconsistent dates/signs. | Debt paid differs from debt due; no full liability coverage. | Fourth general historical component NULL; do not substitute completeness or confidence. | blocked |
| A18 Missing components | Default unavailable/partial vector; partial-score reweighting requires explicit approval and declared active weights. | Financial coverage blocked; other proxies and denominators can be unavailable. | Research/coordinator has not supplied missing-data scoring policy. | No silent 0/50 imputation, automatic weight redistribution, or claim of a verified four-component score. | provisional |
| A19 Zero denominators | Return NULL with reason for O=0, I=0, or unknown debt service; verified no-debt case is separately not applicable. | Possible sparse/missing activity; monetary zeros are retained separately. | Observed zero may reflect incomplete capture; absent records never prove economic zero. | No infinity/max-score rewards; zero numerator is valid only with adequate measurement. | provisional |
| A20 Seasonality | Flag August and December as potentially seasonal; do not automatically adjust or excuse declines. | Two Augusts and two Decembers observed; changing monthly company participation. | Too few cycles and no sector-specific validation. | Provide context, maintain raw metrics; any adjustment requires independently justified config. | provisional |
| A21 Historical snapshots | Exclude current invoice statuses/pending amounts, outstanding debt, current balances/rates/account metadata from historical reconstruction. | Single snapshots and no historical versions; dates after claimed snapshot; financial anomalies. | Even transaction classifications/statuses are current-state labels, not as-known histories. | No leakage into past features; current snapshot proxy, if approved, must be separately dated and named. | supported |
| A22 Onboarding and account status | created_at is onboarding/connection, not founding; no explicit account active/closed status exists here. | Dictionary and pre-onboarding/pre-connection transactions. | Company founding date and historical active-account intervals unavailable. | Do not invent age/status fields or reject backfilled history based on registration dates. | supported |
| A23 Date/numeric sentinel policy | Syntactically valid extreme dates/numbers stay flagged, not automatically converted to null or clipped. | Years 2099/6913/7025; repeating-9/extreme values; exact sentinel/zero tables. | No domain-validity/sentinel specification or risk thresholds provided. | Provider-confirmed quarantine/capping rules and original evidence must be explicit; current verified interpretation blocked where affected. | provisional |
| A24 Invoice joining | No direct transaction↔invoice settlement join; company+counterparty is only candidate corroboration. | Shared counterparty space but no payment allocation/document FK; mixed document types and signs. | Many-to-many, partial ERP coverage, current statuses unreliable historically. | Do not fan out amounts or double-count ERP amounts as bank cash; no invoice-derived revenue/debt assumptions. | supported |
| A25 Calibration / model meaning | 0–100 weights, thresholds, components, persistence, and minimum evidence must come from declared config and AGENT2 research. | Synthetic dataset with no provided default-outcome label or empirical risk calibration. | No defensible default-probability calibration from this audit alone. | Label treasury-health proxies honestly; wait for research and policy approval before claiming a complete validated score. | blocked |
