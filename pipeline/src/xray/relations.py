import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from xray.load import CUTOFF

RULE_VERSION = "xray-relations/0.1"
AMOUNT_FLOOR = 50.0
FLOW_FREQUENCY_CAP = 200
FLOW_WINDOW_DAYS = 3
FLOW_STRICT_FREQUENCY_CAP = 4
FLOW_MINIMUM_MATCHES = 2
FLOW_HIGH_CONFIDENCE_MATCHES = 5
FLOW_HIGH_CONFIDENCE_CROSS_MATCHES = 3
INVOICE_FREQUENCY_CAP = 100
INVOICE_WINDOW_DAYS = 5
INVOICE_MINIMUM_MATCHES = 3
INVOICE_HIGH_CONFIDENCE_MATCHES = 5
INVOICE_SAME_DAY_SHARE = 0.5
LOAN_BALANCE_FLOOR = 1000.0
SUCCESSION_MINIMUM_COUNTERPARTIES = 10
NULL_FLOW_SHIFT_DAYS = 45
NULL_INVOICE_SHIFT_DAYS = 40
EVIDENCE_ID_LIMIT = 20
DEFAULT_CURRENCY = "EUR"
INVOICE_DOCUMENT_TYPES = ("invoice", "invoiceGroup", "note", "refund")
LINE_OF_CREDIT = "lineofcredit"
POOL_DESCRIPTION = (
    r"SCF-AJUS|SCF-TRASPASO FONDOS|TRASPASO AUTOMATIC|TRASPAS AUTOMATIC|Traspaso automatico|"
    r"SALDOS DE CUENTAS PERIFERICAS|RETORNO? TRASPAS|Retorno traspaso|TRASPASO DE APUNTES|"
    r"AP\.RET\.|TRASP\. (?:ORI|DST)"
)
TRANSFER_DESCRIPTION = r"TRASP|TRANSF INTERNA|INTERCOMPA|INTRAGRUPO|CUENTAS \[COMPANY\]"
PAYROLL_CATEGORIES = ("salary", "social_security")
TAX_CATEGORIES = ("tax",)
COMMERCIAL_CATEGORIES = ("payment", "collection", "bulk_payment", "bulk_collection", "utility")


@dataclass(frozen=True)
class Tables:
    companies: pd.DataFrame
    transactions: pd.DataFrame
    invoices: pd.DataFrame
    debt: pd.DataFrame
    product_type: pd.Series
    product_currency: pd.Series
    group_of: pd.Series
    company_currency: pd.Series


def _minor_units(amount: float) -> int:
    return int(round(round(amount, 2) * 100))


def _one_to_one(matches: pd.DataFrame, left_id: str, right_id: str) -> pd.DataFrame:
    left = matches[left_id].map(matches[left_id].value_counts()) == 1
    right = matches[right_id].map(matches[right_id].value_counts()) == 1
    return matches[left & right]


def _read(data_dir: Path) -> Tables:
    companies = pd.read_csv(data_dir / "companies.csv", usecols=["company_id", "group_id", "currency"])
    banking = pd.read_csv(data_dir / "banking_products.csv", usecols=["product_id", "type", "currency"])
    debt = pd.read_csv(
        data_dir / "debt_products.csv",
        usecols=["product_id", "company_id", "type", "bank_name", "outstanding", "currency", "created_at"],
    )
    products = pd.concat([banking, debt[["product_id", "type", "currency"]]]).set_index("product_id")
    transactions = pd.read_csv(
        data_dir / "transactions.csv",
        usecols=[
            "transaction_id",
            "company_id",
            "product_id",
            "date",
            "amount",
            "status",
            "category",
            "description",
            "counterparty_id",
        ],
        parse_dates=["date"],
    )
    invoices = pd.read_csv(
        data_dir / "invoices.csv",
        usecols=[
            "operation_id",
            "company_id",
            "document_type",
            "issuance_date",
            "amount",
            "concept",
            "counterparty_id",
            "currency",
        ],
        parse_dates=["issuance_date"],
    )
    return Tables(
        companies=companies,
        transactions=transactions,
        invoices=invoices,
        debt=debt,
        product_type=products["type"],
        product_currency=products["currency"],
        group_of=companies.set_index("company_id")["group_id"],
        company_currency=companies.set_index("company_id")["currency"],
    )


def _booked_flows(transactions: pd.DataFrame) -> pd.DataFrame:
    flows = transactions[
        (transactions["amount"].abs() >= AMOUNT_FLOOR) & (transactions["status"] == "booked")
    ].copy()
    flows["cents"] = (flows["amount"].abs() * 100).round().astype("int64")
    flows["date"] = flows["date"].dt.normalize()
    flows["frequency"] = flows["cents"].map(flows["cents"].value_counts())
    return flows[flows["frequency"] <= FLOW_FREQUENCY_CAP]


def _bank_mirrors(flows: pd.DataFrame, group_of: pd.Series, shift_days: int) -> pd.DataFrame:
    incoming = flows[flows["amount"] > 0]
    outgoing = flows[flows["amount"] < 0].copy()
    outgoing["date"] = outgoing["date"] + pd.Timedelta(days=shift_days)
    matches = incoming.merge(outgoing, on="cents", suffixes=("_in", "_out"))
    matches = matches[matches["company_id_in"] != matches["company_id_out"]]
    matches["day_delta"] = (matches["date_in"] - matches["date_out"]).dt.days
    matches = _one_to_one(
        matches[matches["day_delta"].abs() <= FLOW_WINDOW_DAYS], "transaction_id_in", "transaction_id_out"
    )
    matches = matches.copy()
    matches["same_group"] = matches["company_id_in"].map(group_of) == matches["company_id_out"].map(group_of)
    return matches


def _issued_invoices(invoices: pd.DataFrame) -> pd.DataFrame:
    issued = invoices[
        (invoices["amount"].abs() >= AMOUNT_FLOOR) & invoices["document_type"].isin(INVOICE_DOCUMENT_TYPES)
    ].copy()
    issued["cents"] = (issued["amount"].abs() * 100).round().astype("int64")
    issued["frequency"] = issued["cents"].map(issued["cents"].value_counts())
    return issued[issued["frequency"] <= INVOICE_FREQUENCY_CAP]


def _invoice_mirrors(invoices: pd.DataFrame, group_of: pd.Series, shift_days: int) -> pd.DataFrame:
    sales = invoices[invoices["amount"] > 0]
    purchases = invoices[invoices["amount"] < 0].copy()
    purchases["issuance_date"] = purchases["issuance_date"] + pd.Timedelta(days=shift_days)
    matches = sales.merge(purchases, on="cents", suffixes=("_seller", "_buyer"))
    matches = matches[matches["company_id_seller"] != matches["company_id_buyer"]]
    matches["day_delta"] = (matches["issuance_date_seller"] - matches["issuance_date_buyer"]).dt.days
    matches = _one_to_one(
        matches[matches["day_delta"].abs() <= INVOICE_WINDOW_DAYS], "operation_id_seller", "operation_id_buyer"
    )
    matches = matches.copy()
    matches["same_group"] = (
        matches["company_id_seller"].map(group_of) == matches["company_id_buyer"].map(group_of)
    )
    return matches


def _flow_subtypes(matches: pd.DataFrame, product_type: pd.Series) -> pd.Series:
    out_category = matches["category_out"].fillna("").astype(str)
    in_category = matches["category_in"].fillna("").astype(str)
    out_type = matches["product_id_out"].map(product_type).fillna("")
    in_type = matches["product_id_in"].map(product_type).fillna("")
    descriptions = (
        matches["description_out"].fillna("").astype(str) + " " + matches["description_in"].fillna("").astype(str)
    )
    conditions = [
        descriptions.str.contains(POOL_DESCRIPTION, case=False, regex=True),
        (out_type == LINE_OF_CREDIT) | (in_type == LINE_OF_CREDIT),
        out_category.isin(PAYROLL_CATEGORIES) | in_category.isin(PAYROLL_CATEGORIES),
        out_category.isin(TAX_CATEGORIES) | in_category.isin(TAX_CATEGORIES),
        descriptions.str.contains(TRANSFER_DESCRIPTION, case=False, regex=True)
        | ((out_category == "transfer") & (in_category == "transfer")),
        out_category.isin(COMMERCIAL_CATEGORIES) | in_category.isin(COMMERCIAL_CATEGORIES),
    ]
    choices = [
        "cash_pooling",
        "credit_line_financing",
        "payroll_on_behalf",
        "taxes_on_behalf",
        "funds_transfer",
        "commercial_payment",
    ]
    fallback = np.where((out_category == "transfer") | (in_category == "transfer"), "funds_transfer", "other_flows")
    return pd.Series(np.select(conditions, choices, default=fallback), index=matches.index)


def _example(descriptions: pd.Series) -> str:
    observed = descriptions.dropna().astype(str)
    return observed.value_counts().index[0][:90] if not observed.empty else ""


def _flow_edges(matches: pd.DataFrame, product_type: pd.Series, product_currency: pd.Series) -> list[dict[str, Any]]:
    enriched = matches.copy()
    enriched["subtype"] = _flow_subtypes(matches, product_type)
    strict = (enriched["day_delta"] == 0) & (enriched["frequency_in"] <= FLOW_STRICT_FREQUENCY_CAP)
    selected = pd.concat([enriched[enriched["same_group"]], enriched[~enriched["same_group"] & strict]])
    edges: list[dict[str, Any]] = []
    for (payer, receiver, same_group), rows in selected.groupby(
        ["company_id_out", "company_id_in", "same_group"], sort=True
    ):
        if len(rows) < FLOW_MINIMUM_MATCHES:
            continue
        counts = rows["subtype"].value_counts().to_dict()
        scope = "intragroup" if same_group else "intergroup"
        threshold = FLOW_HIGH_CONFIDENCE_MATCHES if same_group else FLOW_HIGH_CONFIDENCE_CROSS_MATCHES
        currency = rows["product_id_out"].map(product_currency).dropna()
        edges.append(
            {
                "source": payer,
                "target": receiver,
                "relation_type": "INFERRED_PAYMENT_TO",
                "subtype": max(counts, key=counts.get),
                "scope": scope,
                "confidence": "high" if len(rows) >= threshold else "medium",
                "claim_status": "inferred",
                "evidence_level": "bank_mirror",
                "matches": int(len(rows)),
                "amount_minor": _minor_units(rows["amount_in"].sum()),
                "currency": str(currency.value_counts().index[0]) if not currency.empty else DEFAULT_CURRENCY,
                "first_date": str(rows["date_in"].min().date()),
                "last_date": str(rows["date_in"].max().date()),
                "evidence_ids": rows.sort_values(["date_out", "transaction_id_out"])["transaction_id_out"]
                .head(EVIDENCE_ID_LIMIT)
                .tolist(),
                "detail": {"subtype_counts": {str(k): int(v) for k, v in counts.items()}},
                "example": _example(rows["description_out"]),
                "provider_identity_confirmed": False,
            }
        )
    return edges


def _invoice_edges(matches: pd.DataFrame) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for (seller, buyer, same_group), rows in matches.groupby(
        ["company_id_seller", "company_id_buyer", "same_group"], sort=True
    ):
        distinct_amounts = int(rows["cents"].nunique())
        same_day_share = float((rows["day_delta"] == 0).mean())
        if same_group:
            qualifies = len(rows) >= INVOICE_MINIMUM_MATCHES
        else:
            qualifies = distinct_amounts >= INVOICE_MINIMUM_MATCHES and same_day_share >= INVOICE_SAME_DAY_SHARE
        if not qualifies:
            continue
        if same_group:
            high = len(rows) >= INVOICE_HIGH_CONFIDENCE_MATCHES
        else:
            high = distinct_amounts >= INVOICE_HIGH_CONFIDENCE_MATCHES
        currency = rows["currency_seller"].dropna()
        edges.append(
            {
                "source": buyer,
                "target": seller,
                "relation_type": "INFERRED_PAYMENT_TO",
                "subtype": "sale_to_purchase_invoice",
                "scope": "intragroup" if same_group else "intergroup",
                "confidence": "high" if high else "medium",
                "claim_status": "inferred",
                "evidence_level": "invoice_mirror",
                "matches": int(len(rows)),
                "amount_minor": _minor_units(rows["amount_seller"].sum()),
                "currency": str(currency.value_counts().index[0]) if not currency.empty else DEFAULT_CURRENCY,
                "first_date": str(rows["issuance_date_seller"].min().date()),
                "last_date": str(rows["issuance_date_seller"].max().date()),
                "evidence_ids": rows.sort_values(["issuance_date_seller", "operation_id_seller"])["operation_id_seller"]
                .head(EVIDENCE_ID_LIMIT)
                .tolist(),
                "detail": {"distinct_amounts": distinct_amounts, "same_day_share": round(same_day_share, 2)},
                "example": _example(rows["concept_seller"]),
                "provider_identity_confirmed": False,
            }
        )
    return edges


def _loan_edges(debt: pd.DataFrame, group_of: pd.Series, product_currency: pd.Series) -> list[dict[str, Any]]:
    in_house = debt[
        (debt["bank_name"] == "In-house bank")
        & debt["outstanding"].notna()
        & (debt["outstanding"].abs() >= LOAN_BALANCE_FLOOR)
    ].copy()
    in_house["cents"] = (in_house["outstanding"].abs() * 100).round().astype("int64")
    pairs = in_house[in_house["outstanding"] > 0].merge(
        in_house[in_house["outstanding"] < 0], on="cents", suffixes=("_lender", "_borrower")
    )
    pairs = pairs[
        (pairs["company_id_lender"] != pairs["company_id_borrower"])
        & (pairs["company_id_lender"].map(group_of) == pairs["company_id_borrower"].map(group_of))
    ]
    edges: list[dict[str, Any]] = []
    for (lender, borrower), rows in pairs.groupby(["company_id_lender", "company_id_borrower"], sort=True):
        products = min(rows["product_id_lender"].nunique(), rows["product_id_borrower"].nunique())
        created = pd.concat([rows["created_at_lender"], rows["created_at_borrower"]]).dropna().astype(str)
        currency = rows["product_id_lender"].map(product_currency).dropna()
        evidence = sorted(set(rows["product_id_lender"]) | set(rows["product_id_borrower"]))
        edges.append(
            {
                "source": borrower,
                "target": lender,
                "relation_type": "OPEN_OBLIGATION_TO",
                "subtype": "in_house_bank_line",
                "scope": "intragroup",
                "confidence": "high" if rows["cents"].nunique() == 1 and products >= 1 else "medium",
                "claim_status": "inferred",
                "evidence_level": "debt_balance_mirror",
                "matches": int(products),
                "amount_minor": _minor_units(rows.drop_duplicates("cents")["outstanding_lender"].sum()),
                "currency": str(currency.value_counts().index[0]) if not currency.empty else DEFAULT_CURRENCY,
                "first_date": str(created.min()[:10]) if not created.empty else "",
                # An in-house line stays open, so it ends at the artifact snapshot date.
                "last_date": CUTOFF.isoformat(),
                "evidence_ids": evidence[:EVIDENCE_ID_LIMIT],
                "detail": {
                    "lender_products": sorted(set(rows["product_id_lender"])),
                    "borrower_products": sorted(set(rows["product_id_borrower"])),
                },
                "example": "Mirror outstanding balance on 'In-house bank' credit lines",
                "provider_identity_confirmed": False,
            }
        )
    return edges


def _counterparty_edges(
    transactions: pd.DataFrame, group_of: pd.Series, company_currency: pd.Series
) -> list[dict[str, Any]]:
    tagged = transactions[transactions["counterparty_id"].notna()][
        ["transaction_id", "company_id", "counterparty_id", "date", "amount"]
    ].copy()
    tagged["company_id"] = tagged["company_id"].astype(str)
    tagged["counterparty_id"] = tagged["counterparty_id"].astype(str)
    holders = tagged.groupby("counterparty_id")["company_id"].nunique()
    shared = tagged[tagged["counterparty_id"].isin(holders[holders > 1].index)]
    partners = shared.groupby("counterparty_id")["company_id"].apply(lambda ids: tuple(sorted(set(ids))))
    shared = shared.assign(partners=shared["counterparty_id"].map(partners))
    edges: list[dict[str, Any]] = []
    for (first, second), rows in shared.groupby("partners", sort=True):
        first_rows = rows[rows["company_id"] == first]
        second_rows = rows[rows["company_id"] == second]
        counterparties = int(rows["counterparty_id"].nunique())
        succession = counterparties >= SUCCESSION_MINIMUM_COUNTERPARTIES and (
            first_rows["date"].max() < second_rows["date"].min()
            or second_rows["date"].max() < first_rows["date"].min()
        )
        ordered = (
            rows.groupby("counterparty_id")["date"].min().sort_values().index[:EVIDENCE_ID_LIMIT].tolist()
        )
        edges.append(
            {
                "source": first,
                "target": second,
                "relation_type": "SHARES_COUNTERPARTY_WITH",
                "subtype": "client_portfolio_transfer" if succession else "shared_supplier_or_client",
                "scope": "intragroup" if group_of[first] == group_of[second] else "intergroup",
                "confidence": "high" if succession else "low",
                "claim_status": "inferred",
                "evidence_level": "shared_counterparty_id",
                "matches": counterparties,
                "amount_minor": _minor_units(rows["amount"].sum()),
                "currency": str(company_currency.get(first, DEFAULT_CURRENCY)),
                "first_date": str(rows["date"].min().date()),
                "last_date": str(rows["date"].max().date()),
                "evidence_ids": ordered,
                "detail": {
                    "shared_counterparties": counterparties,
                    "source_last_activity": str(first_rows["date"].max().date()),
                    "target_first_activity": str(second_rows["date"].min().date()),
                },
                "example": "counterparty_id shared by two companies, unique per company elsewhere in the dataset",
                "provider_identity_confirmed": False,
            }
        )
    return edges


def _promote_cross_signal(edges: list[dict[str, Any]]) -> None:
    signals: dict[frozenset[str], set[str]] = defaultdict(set)
    for edge in edges:
        signals[frozenset((edge["source"], edge["target"]))].add(edge["evidence_level"])
    for edge in edges:
        if edge["scope"] == "intergroup" and {"bank_mirror", "invoice_mirror"} <= signals[
            frozenset((edge["source"], edge["target"]))
        ]:
            edge["confidence"] = "high"


def _pair_counts(matches: pd.DataFrame, left: str, right: str) -> pd.DataFrame:
    return matches.groupby([left, right, "same_group"], sort=True).size().rename("matches").reset_index()


def _calibration_entry(counts: pd.DataFrame, minimum: int) -> dict[str, int]:
    return {
        "intragroup": int(((counts["matches"] >= minimum) & counts["same_group"]).sum()),
        "intergroup": int(((counts["matches"] >= minimum) & ~counts["same_group"]).sum()),
    }


def _calibration(
    flows: pd.DataFrame, null_flows: pd.DataFrame, invoices: pd.DataFrame, null_invoices: pd.DataFrame
) -> dict[str, dict[str, int]]:
    flow_pairs = _pair_counts(flows, "company_id_out", "company_id_in")
    null_flow_pairs = _pair_counts(null_flows, "company_id_out", "company_id_in")
    strict = (flows["day_delta"] == 0) & (flows["frequency_in"] <= FLOW_STRICT_FREQUENCY_CAP)
    null_strict = (null_flows["day_delta"] == 0) & (null_flows["frequency_in"] <= FLOW_STRICT_FREQUENCY_CAP)
    strict_pairs = _pair_counts(flows[strict], "company_id_out", "company_id_in")
    null_strict_pairs = _pair_counts(null_flows[null_strict], "company_id_out", "company_id_in")
    invoice_pairs = _pair_counts(invoices, "company_id_seller", "company_id_buyer")
    null_invoice_pairs = _pair_counts(null_invoices, "company_id_seller", "company_id_buyer")
    return {
        "bank_flows_observed_min_2": _calibration_entry(flow_pairs, FLOW_MINIMUM_MATCHES),
        "bank_flows_shifted_45d_min_2": _calibration_entry(null_flow_pairs, FLOW_MINIMUM_MATCHES),
        "bank_flows_observed_min_5": _calibration_entry(flow_pairs, FLOW_HIGH_CONFIDENCE_MATCHES),
        "bank_flows_shifted_45d_min_5": _calibration_entry(null_flow_pairs, FLOW_HIGH_CONFIDENCE_MATCHES),
        "bank_flows_strict_observed_min_2": _calibration_entry(strict_pairs, FLOW_MINIMUM_MATCHES),
        "bank_flows_strict_shifted_45d_min_2": _calibration_entry(null_strict_pairs, FLOW_MINIMUM_MATCHES),
        "invoices_observed_min_3": _calibration_entry(invoice_pairs, INVOICE_MINIMUM_MATCHES),
        "invoices_shifted_40d_min_3": _calibration_entry(null_invoice_pairs, INVOICE_MINIMUM_MATCHES),
    }


def _nodes(companies: pd.DataFrame, edges: list[dict[str, Any]], group_of: pd.Series) -> list[dict[str, Any]]:
    degree: Counter[str] = Counter()
    volume: Counter[str] = Counter()
    for edge in edges:
        degree[edge["source"]] += 1
        degree[edge["target"]] += 1
        if edge["evidence_level"] == "bank_mirror":
            volume[edge["source"]] += edge["amount_minor"]
            volume[edge["target"]] += edge["amount_minor"]
    hubs: dict[str, str] = {}
    best: dict[str, tuple[int, int]] = {}
    for company_id, group_id in zip(companies["company_id"], companies["group_id"], strict=True):
        if degree[company_id] == 0:
            continue
        candidate = (degree[company_id], volume[company_id])
        if candidate > best.get(group_id, (0, 0)):
            best[group_id] = candidate
            hubs[group_id] = company_id
    nodes: list[dict[str, Any]] = []
    for company_id, group_id in zip(companies["company_id"], companies["group_id"], strict=True):
        degree_count = degree[company_id]
        if degree_count == 0:
            role = "isolated"
        elif hubs.get(group_id) == company_id and degree_count >= 3:
            role = "group_treasury_hub"
        else:
            role = "connected"
        nodes.append(
            {
                "company_id": company_id,
                "group_id": group_id,
                "degree": degree_count,
                "role": role,
                "intercompany_flow_volume_minor": volume[company_id],
            }
        )
    return nodes


def build(data_dir: Path, out_dir: Path) -> dict[str, Any]:
    tables = _read(data_dir)
    flows = _booked_flows(tables.transactions)
    invoices = _issued_invoices(tables.invoices)
    matches = _bank_mirrors(flows, tables.group_of, 0)
    null_flows = _bank_mirrors(flows, tables.group_of, NULL_FLOW_SHIFT_DAYS)
    invoice_matches = _invoice_mirrors(invoices, tables.group_of, 0)
    null_invoices = _invoice_mirrors(invoices, tables.group_of, NULL_INVOICE_SHIFT_DAYS)
    edges = (
        _flow_edges(matches, tables.product_type, tables.product_currency)
        + _invoice_edges(invoice_matches)
        + _loan_edges(tables.debt, tables.group_of, tables.product_currency)
        + _counterparty_edges(tables.transactions, tables.group_of, tables.company_currency)
    )
    _promote_cross_signal(edges)
    edges.sort(
        key=lambda edge: (edge["scope"], edge["relation_type"], -edge["matches"], edge["source"], edge["target"])
    )
    calibration = _calibration(matches, null_flows, invoice_matches, null_invoices)
    nodes = _nodes(tables.companies, edges, tables.group_of)
    counts = Counter(edge["relation_type"] for edge in edges)
    payload = {
        "meta": {
            "rule_version": RULE_VERSION,
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "counts": {relation_type: counts[relation_type] for relation_type in sorted(counts)},
        },
        "calibration": calibration,
        "nodes": nodes,
        "edges": edges,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "relations.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    return {
        "companies": len(tables.companies),
        "groups": int(tables.companies["group_id"].nunique()),
        "edges": len(edges),
        "edges_by_relation_type": dict(counts),
        "edges_by_evidence_level": dict(Counter(edge["evidence_level"] for edge in edges)),
        "edges_by_subtype": dict(Counter(edge["subtype"] for edge in edges)),
        "edges_by_scope": dict(Counter(edge["scope"] for edge in edges)),
        "edges_by_confidence": dict(Counter(edge["confidence"] for edge in edges)),
        "companies_with_relations": sum(1 for node in nodes if node["degree"] > 0),
        "calibration": calibration,
    }
