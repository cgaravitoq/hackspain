import csv
import json
from pathlib import Path
from typing import Any

from xray.relations import build

COMPANY_FIELDS = ["company_id", "group_id", "currency"]
BANKING_FIELDS = ["product_id", "type", "currency"]
DEBT_FIELDS = ["product_id", "company_id", "type", "bank_name", "outstanding", "currency", "created_at"]
TRANSACTION_FIELDS = [
    "transaction_id",
    "company_id",
    "product_id",
    "date",
    "amount",
    "status",
    "category",
    "description",
    "counterparty_id",
]
INVOICE_FIELDS = [
    "operation_id",
    "company_id",
    "document_type",
    "issuance_date",
    "amount",
    "concept",
    "counterparty_id",
    "currency",
]
EDGE_FIELDS = {
    "source",
    "target",
    "relation_type",
    "subtype",
    "scope",
    "confidence",
    "claim_status",
    "evidence_level",
    "matches",
    "amount_minor",
    "currency",
    "first_date",
    "last_date",
    "evidence_ids",
    "detail",
    "example",
    "provider_identity_confirmed",
}
NODE_FIELDS = {"company_id", "group_id", "degree", "role", "intercompany_flow_volume_minor"}


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def seed_dataset(
    folder: Path,
    *,
    companies: list[tuple[str, str]],
    transactions: list[dict[str, Any]] | None = None,
    invoices: list[dict[str, Any]] | None = None,
    debt_products: list[dict[str, Any]] | None = None,
    banking_products: list[dict[str, Any]] | None = None,
) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    _write_csv(
        folder / "companies.csv",
        COMPANY_FIELDS,
        [{"company_id": company_id, "group_id": group_id, "currency": "EUR"} for company_id, group_id in companies],
    )
    _write_csv(folder / "banking_products.csv", BANKING_FIELDS, banking_products or [{"product_id": "P1", "type": "checking", "currency": "EUR"}])
    _write_csv(
        folder / "debt_products.csv",
        DEBT_FIELDS,
        debt_products
        or [
            {
                "product_id": "D1",
                "company_id": companies[0][0],
                "type": "loan",
                "bank_name": "Banca March",
                "outstanding": 0.0,
                "currency": "EUR",
                "created_at": "2026-01-01 00:00:00",
            }
        ],
    )
    _write_csv(folder / "transactions.csv", TRANSACTION_FIELDS, transactions or [transaction("TX_FILLER", companies[0][0], "2026-01-01", 1.0)])
    _write_csv(folder / "invoices.csv", INVOICE_FIELDS, invoices or [invoice("INV_FILLER", companies[0][0], "2026-01-01", 1.0)])
    return folder


def transaction(
    transaction_id: str,
    company_id: str,
    day: str,
    amount: float,
    *,
    category: str = "transfer",
    description: str = "",
    counterparty_id: str = "",
    product_id: str = "P1",
    status: str = "booked",
) -> dict[str, Any]:
    return {
        "transaction_id": transaction_id,
        "company_id": company_id,
        "product_id": product_id,
        "date": day,
        "amount": amount,
        "status": status,
        "category": category,
        "description": description,
        "counterparty_id": counterparty_id,
    }


def invoice(
    operation_id: str,
    company_id: str,
    day: str,
    amount: float,
    *,
    document_type: str = "invoice",
    concept: str = "",
    counterparty_id: str = "",
    currency: str = "EUR",
) -> dict[str, Any]:
    return {
        "operation_id": operation_id,
        "company_id": company_id,
        "document_type": document_type,
        "issuance_date": day,
        "amount": amount,
        "concept": concept,
        "counterparty_id": counterparty_id,
        "currency": currency,
    }


def bank_pair(
    index: int,
    payer: str,
    receiver: str,
    amount: float,
    paid_on: str,
    received_on: str,
    **fields: Any,
) -> list[dict[str, Any]]:
    return [
        transaction(f"TX_{index}_out", payer, paid_on, -amount, **fields),
        transaction(f"TX_{index}_in", receiver, received_on, amount, **fields),
    ]


def invoice_pair(
    index: int,
    seller: str,
    buyer: str,
    amount: float,
    sold_on: str,
    bought_on: str,
    **fields: Any,
) -> list[dict[str, Any]]:
    return [
        invoice(f"INV_{index}_sale", seller, sold_on, amount, **fields),
        invoice(f"INV_{index}_buy", buyer, bought_on, -amount, **fields),
    ]


def debt_product(product_id: str, company_id: str, outstanding: float) -> dict[str, Any]:
    return {
        "product_id": product_id,
        "company_id": company_id,
        "type": "lineofcredit",
        "bank_name": "In-house bank",
        "outstanding": outstanding,
        "currency": "EUR",
        "created_at": "2026-01-01 00:00:00",
    }


def detect(tmp_path: Path, **datasets: Any) -> dict[str, Any]:
    data = seed_dataset(tmp_path / "data", **datasets)
    out = tmp_path / "out"
    build(data, out)
    return json.loads((out / "relations.json").read_text())


def edges_of(payload: dict[str, Any], evidence_level: str) -> list[dict[str, Any]]:
    return [edge for edge in payload["edges"] if edge["evidence_level"] == evidence_level]


def test_bank_mirrors_need_the_amount_within_a_three_day_window(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G1"), ("C4", "G1")],
        transactions=[
            *bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-13"),
            *bank_pair(2, "C1", "C2", 200.0, "2026-01-20", "2026-01-23"),
            *bank_pair(3, "C3", "C4", 300.0, "2026-02-10", "2026-02-14"),
            *bank_pair(4, "C3", "C4", 400.0, "2026-02-20", "2026-02-24"),
        ],
    )
    edges = edges_of(payload, "bank_mirror")
    assert [(edge["source"], edge["target"], edge["matches"]) for edge in edges] == [("C1", "C2", 2)]


def test_invoice_mirrors_need_the_issuance_within_a_five_day_window(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1")],
        invoices=[
            *invoice_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-15"),
            *invoice_pair(2, "C1", "C2", 200.0, "2026-02-10", "2026-02-15"),
            *invoice_pair(3, "C1", "C2", 300.0, "2026-03-10", "2026-03-15"),
            *invoice_pair(4, "C1", "C2", 400.0, "2026-04-10", "2026-04-16"),
        ],
    )
    edges = edges_of(payload, "invoice_mirror")
    assert [(edge["source"], edge["target"], edge["matches"]) for edge in edges] == [("C2", "C1", 3)]


def test_flows_below_the_fifty_minor_unit_floor_never_pair(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G1"), ("C4", "G1")],
        transactions=[
            *bank_pair(1, "C1", "C2", 50.0, "2026-01-10", "2026-01-10"),
            *bank_pair(2, "C1", "C2", 60.0, "2026-01-20", "2026-01-20"),
            *bank_pair(3, "C3", "C4", 45.0, "2026-02-10", "2026-02-10"),
            *bank_pair(4, "C3", "C4", 46.0, "2026-02-20", "2026-02-20"),
        ],
    )
    edges = edges_of(payload, "bank_mirror")
    assert [(edge["source"], edge["target"]) for edge in edges] == [("C1", "C2")]


def test_frequent_amounts_are_dropped_before_pairing(tmp_path: Path):
    filler = [
        transaction(f"TX_FILLER_{index}", "C9", "2024-01-01", 5000.0 if index % 2 else 6000.0)
        for index in range(400)
    ]
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C9", "G1")],
        transactions=[
            *bank_pair(1, "C1", "C2", 5000.0, "2026-01-10", "2026-01-10"),
            *bank_pair(2, "C1", "C2", 6000.0, "2026-01-11", "2026-01-11"),
            *filler,
        ],
    )
    assert edges_of(payload, "bank_mirror") == []


def test_bank_mirrors_need_two_matches(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1")],
        transactions=[*bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10")],
    )
    assert edges_of(payload, "bank_mirror") == []


def test_invoice_mirrors_need_three_matches(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1")],
        invoices=[
            *invoice_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(2, "C1", "C2", 200.0, "2026-02-10", "2026-02-10"),
        ],
    )
    assert edges_of(payload, "invoice_mirror") == []


def test_cross_group_invoices_need_half_of_the_matches_on_the_same_day(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C3", "G3")],
        invoices=[
            *invoice_pair(1, "C1", "C3", 100.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(2, "C1", "C3", 200.0, "2026-02-10", "2026-02-12"),
            *invoice_pair(3, "C1", "C3", 300.0, "2026-03-10", "2026-03-14"),
        ],
    )
    assert edges_of(payload, "invoice_mirror") == []


def test_cross_group_flows_need_a_strict_match_on_the_same_day(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G3"), ("C4", "G3")],
        transactions=[
            *bank_pair(1, "C1", "C3", 100.0, "2026-01-10", "2026-01-11"),
            *bank_pair(2, "C1", "C3", 200.0, "2026-01-20", "2026-01-22"),
            *bank_pair(3, "C2", "C4", 300.0, "2026-02-10", "2026-02-10"),
            *bank_pair(4, "C2", "C4", 400.0, "2026-02-20", "2026-02-20"),
        ],
    )
    edges = edges_of(payload, "bank_mirror")
    assert [(edge["source"], edge["target"], edge["scope"]) for edge in edges] == [("C2", "C4", "intergroup")]


def test_in_house_lines_below_the_thousand_balance_floor_never_pair(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G1"), ("C4", "G1")],
        debt_products=[
            debt_product("D1", "C1", 1000.0),
            debt_product("D2", "C2", -1000.0),
            debt_product("D3", "C3", 999.0),
            debt_product("D4", "C4", -999.0),
        ],
    )
    edges = edges_of(payload, "debt_balance_mirror")
    assert [(edge["source"], edge["target"], edge["matches"]) for edge in edges] == [("C2", "C1", 1)]


def test_a_shared_counterparty_is_a_succession_only_above_ten_counterparties(tmp_path: Path):
    transactions = []
    for index in range(10):
        transactions.append(transaction(f"TX_SUCC_{index}", "C1", "2025-01-05", 10.0, counterparty_id=f"CP_A{index}"))
        transactions.append(transaction(f"TX_SUCC_{index}_2", "C2", "2025-06-05", 10.0, counterparty_id=f"CP_A{index}"))
    for index in range(9):
        transactions.append(transaction(f"TX_SHARED_{index}", "C3", "2025-01-05", 10.0, counterparty_id=f"CP_B{index}"))
        transactions.append(transaction(f"TX_SHARED_{index}_2", "C4", "2025-06-05", 10.0, counterparty_id=f"CP_B{index}"))
    payload = detect(tmp_path, companies=[("C1", "G1"), ("C2", "G2"), ("C3", "G1"), ("C4", "G2")], transactions=transactions)
    edges = edges_of(payload, "shared_counterparty_id")
    assert sorted((edge["source"], edge["target"], edge["subtype"]) for edge in edges) == [
        ("C1", "C2", "client_portfolio_transfer"),
        ("C3", "C4", "shared_supplier_or_client"),
    ]


def test_frequent_invoice_amounts_are_dropped_before_pairing(tmp_path: Path):
    filler = [invoice(f"INV_FILLER_{index}", "C9", "2024-01-01", 5000.0 + 1000 * (index % 3)) for index in range(300)]
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C9", "G1")],
        invoices=[
            *invoice_pair(1, "C1", "C2", 5000.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(2, "C1", "C2", 6000.0, "2026-01-11", "2026-01-11"),
            *invoice_pair(3, "C1", "C2", 7000.0, "2026-01-12", "2026-01-12"),
            *filler,
        ],
    )
    assert edges_of(payload, "invoice_mirror") == []


def test_the_shifted_null_models_count_the_pairs_the_real_windows_drop(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G1"), ("C4", "G1")],
        transactions=[
            *bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10"),
            *bank_pair(2, "C1", "C2", 200.0, "2026-01-20", "2026-01-20"),
            *bank_pair(3, "C3", "C4", 300.0, "2026-02-10", "2026-02-10"),
            *bank_pair(4, "C3", "C4", 400.0, "2026-02-20", "2026-02-20"),
            *bank_pair(5, "C1", "C3", 500.0, "2025-03-01", "2025-04-15"),
            *bank_pair(6, "C1", "C3", 600.0, "2025-03-10", "2025-04-24"),
        ],
        invoices=[
            *invoice_pair(1, "C1", "C2", 700.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(2, "C1", "C2", 800.0, "2026-02-10", "2026-02-10"),
            *invoice_pair(3, "C1", "C2", 900.0, "2026-03-10", "2026-03-10"),
            *invoice_pair(4, "C3", "C4", 1000.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(5, "C3", "C4", 1100.0, "2026-02-10", "2026-02-10"),
            *invoice_pair(6, "C3", "C4", 1200.0, "2026-03-10", "2026-03-10"),
            *invoice_pair(7, "C1", "C2", 1300.0, "2025-05-25", "2025-04-15"),
            *invoice_pair(8, "C1", "C2", 1400.0, "2025-05-30", "2025-04-20"),
            *invoice_pair(9, "C1", "C2", 1500.0, "2025-06-04", "2025-04-25"),
        ],
    )
    assert payload["calibration"] == {
        "bank_flows_observed_min_2": {"intragroup": 2, "intergroup": 0},
        "bank_flows_shifted_45d_min_2": {"intragroup": 1, "intergroup": 0},
        "bank_flows_observed_min_5": {"intragroup": 0, "intergroup": 0},
        "bank_flows_shifted_45d_min_5": {"intragroup": 0, "intergroup": 0},
        "bank_flows_strict_observed_min_2": {"intragroup": 2, "intergroup": 0},
        "bank_flows_strict_shifted_45d_min_2": {"intragroup": 1, "intergroup": 0},
        "invoices_observed_min_3": {"intragroup": 2, "intergroup": 0},
        "invoices_shifted_40d_min_3": {"intragroup": 1, "intergroup": 0},
    }


def test_a_cross_group_pair_seen_in_banks_and_invoices_is_promoted_to_high(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G2")],
        transactions=[
            *bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10"),
            *bank_pair(2, "C1", "C2", 200.0, "2026-02-10", "2026-02-10"),
        ],
        invoices=[
            *invoice_pair(3, "C2", "C1", 300.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(4, "C2", "C1", 400.0, "2026-02-10", "2026-02-10"),
            *invoice_pair(5, "C2", "C1", 500.0, "2026-03-10", "2026-03-10"),
        ],
    )
    edges = payload["edges"]
    assert {(edge["source"], edge["target"], edge["evidence_level"], edge["confidence"]) for edge in edges} == {
        ("C1", "C2", "bank_mirror", "high"),
        ("C1", "C2", "invoice_mirror", "high"),
    }


def test_a_shared_counterparty_edge_is_ordered_by_company_id_not_by_date(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C4", "G2"), ("C9", "G1")],
        transactions=[
            transaction("TX_1", "C9", "2025-01-05", 10.0, counterparty_id="CP_1"),
            transaction("TX_2", "C4", "2025-06-05", 10.0, counterparty_id="CP_1"),
        ],
    )
    edges = edges_of(payload, "shared_counterparty_id")
    assert [(edge["source"], edge["target"]) for edge in edges] == [("C4", "C9")]


def test_an_in_house_line_is_an_obligation_from_the_borrower_to_the_lender(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1")],
        debt_products=[debt_product("D1", "C1", 5000.0), debt_product("D2", "C2", -5000.0)],
    )
    edge = edges_of(payload, "debt_balance_mirror")[0]
    assert (edge["source"], edge["target"]) == ("C2", "C1")
    assert edge["relation_type"] == "OPEN_OBLIGATION_TO"
    assert edge["subtype"] == "in_house_bank_line"
    assert edge["confidence"] == "high"


def test_every_edge_carries_the_inferred_contract_and_no_group_edges_exist(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G2")],
        transactions=[
            *bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10"),
            *bank_pair(2, "C1", "C2", 200.0, "2026-02-10", "2026-02-10"),
            transaction("TX_SHARED_1", "C2", "2025-01-05", 10.0, counterparty_id="CP_1"),
            transaction("TX_SHARED_2", "C3", "2025-06-05", 10.0, counterparty_id="CP_1"),
        ],
        invoices=[
            *invoice_pair(3, "C3", "C1", 300.0, "2026-01-10", "2026-01-10"),
            *invoice_pair(4, "C3", "C1", 400.0, "2026-02-10", "2026-02-10"),
            *invoice_pair(5, "C3", "C1", 500.0, "2026-03-10", "2026-03-10"),
        ],
        debt_products=[debt_product("D1", "C1", 5000.0), debt_product("D2", "C2", -5000.0)],
    )
    assert set(payload) == {"meta", "calibration", "nodes", "edges"}
    assert set(payload["meta"]) == {"rule_version", "generated_at", "counts"}
    assert payload["meta"]["rule_version"] == "xray-relations/0.1"
    assert {edge["evidence_level"] for edge in payload["edges"]} == {
        "bank_mirror",
        "invoice_mirror",
        "debt_balance_mirror",
        "shared_counterparty_id",
    }
    for edge in payload["edges"]:
        assert set(edge) == EDGE_FIELDS
        assert edge["claim_status"] == "inferred"
        assert edge["provider_identity_confirmed"] is False
        assert edge["source"] != edge["target"]
        assert isinstance(edge["matches"], int)
        assert isinstance(edge["amount_minor"], int)
        assert edge["currency"] == "EUR"
        assert len(edge["evidence_ids"]) <= 20
    counts = payload["meta"]["counts"]
    assert counts == {"INFERRED_PAYMENT_TO": 2, "OPEN_OBLIGATION_TO": 1, "SHARES_COUNTERPARTY_WITH": 1}
    for node in payload["nodes"]:
        assert set(node) == NODE_FIELDS
        assert "group_id" in node


def test_the_flow_subtype_follows_the_description_product_and_category(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1")] + [(f"C{index}", "G1") for index in range(2, 9)],
        banking_products=[
            {"product_id": "P1", "type": "checking", "currency": "EUR"},
            {"product_id": "P_LC", "type": "lineofcredit", "currency": "EUR"},
        ],
        transactions=[
            *bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10", description="SCF-AJUS SALDOS"),
            *bank_pair(2, "C1", "C2", 110.0, "2026-02-10", "2026-02-10", description="SCF-AJUS SALDOS"),
            *bank_pair(3, "C1", "C3", 200.0, "2026-01-10", "2026-01-10", product_id="P_LC"),
            *bank_pair(4, "C1", "C3", 210.0, "2026-02-10", "2026-02-10", product_id="P_LC"),
            *bank_pair(5, "C1", "C4", 300.0, "2026-01-10", "2026-01-10", category="salary"),
            *bank_pair(6, "C1", "C4", 310.0, "2026-02-10", "2026-02-10", category="salary"),
            *bank_pair(7, "C1", "C5", 400.0, "2026-01-10", "2026-01-10", category="tax"),
            *bank_pair(8, "C1", "C5", 410.0, "2026-02-10", "2026-02-10", category="tax"),
            *bank_pair(9, "C1", "C6", 500.0, "2026-01-10", "2026-01-10", description="TRANSF INTERNA"),
            *bank_pair(10, "C1", "C6", 510.0, "2026-02-10", "2026-02-10", description="TRANSF INTERNA"),
            *bank_pair(11, "C1", "C7", 600.0, "2026-01-10", "2026-01-10", category="payment"),
            *bank_pair(12, "C1", "C7", 610.0, "2026-02-10", "2026-02-10", category="payment"),
            *bank_pair(13, "C1", "C8", 700.0, "2026-01-10", "2026-01-10", category="fee"),
            *bank_pair(14, "C1", "C8", 710.0, "2026-02-10", "2026-02-10", category="fee"),
        ],
    )
    subtypes = {edge["target"]: edge["subtype"] for edge in edges_of(payload, "bank_mirror")}
    assert subtypes == {
        "C2": "cash_pooling",
        "C3": "credit_line_financing",
        "C4": "payroll_on_behalf",
        "C5": "taxes_on_behalf",
        "C6": "funds_transfer",
        "C7": "commercial_payment",
        "C8": "other_flows",
    }


def test_the_group_treasury_hub_is_the_most_connected_company_with_three_edges(tmp_path: Path):
    payload = detect(
        tmp_path,
        companies=[("C1", "G1"), ("C2", "G1"), ("C3", "G1"), ("C4", "G1"), ("C5", "G2"), ("C6", "G2"), ("C7", "G2")],
        transactions=[
            *bank_pair(1, "C1", "C2", 100.0, "2026-01-10", "2026-01-10"),
            *bank_pair(2, "C1", "C2", 110.0, "2026-02-10", "2026-02-10"),
            *bank_pair(3, "C1", "C3", 200.0, "2026-01-10", "2026-01-10"),
            *bank_pair(4, "C1", "C3", 210.0, "2026-02-10", "2026-02-10"),
            *bank_pair(5, "C1", "C4", 300.0, "2026-01-10", "2026-01-10"),
            *bank_pair(6, "C1", "C4", 310.0, "2026-02-10", "2026-02-10"),
            *bank_pair(7, "C6", "C7", 400.0, "2026-01-10", "2026-01-10"),
            *bank_pair(8, "C6", "C7", 410.0, "2026-02-10", "2026-02-10"),
            *bank_pair(9, "C7", "C6", 500.0, "2026-01-10", "2026-01-10"),
            *bank_pair(10, "C7", "C6", 510.0, "2026-02-10", "2026-02-10"),
        ],
    )
    nodes = {node["company_id"]: node for node in payload["nodes"]}
    assert nodes["C1"] == {
        "company_id": "C1",
        "group_id": "G1",
        "degree": 3,
        "role": "group_treasury_hub",
        "intercompany_flow_volume_minor": 21000 + 41000 + 61000,
    }
    assert (nodes["C2"]["degree"], nodes["C2"]["role"], nodes["C2"]["intercompany_flow_volume_minor"]) == (
        1,
        "connected",
        21000,
    )
    assert (nodes["C5"]["degree"], nodes["C5"]["role"]) == (0, "isolated")
    assert (nodes["C6"]["degree"], nodes["C6"]["role"]) == (2, "connected")


def test_evidence_ids_keep_the_twenty_earliest_matches(tmp_path: Path):
    transactions = []
    for index in range(25):
        transactions.extend(
            bank_pair(
                100 + index,
                "C1",
                "C2",
                100.0 * (index + 1),
                f"2026-01-{index + 1:02d}",
                f"2026-01-{index + 1:02d}",
            )
        )
    payload = detect(tmp_path, companies=[("C1", "G1"), ("C2", "G1")], transactions=transactions)
    edge = edges_of(payload, "bank_mirror")[0]
    assert edge["matches"] == 25
    assert edge["evidence_ids"] == [f"TX_{index}_out" for index in range(100, 120)]
