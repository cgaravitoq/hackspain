import csv
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

MAX_MINOR = 9_007_199_254_740_991


def _minor(value: str | None) -> int | None:
    if not value or not value.strip():
        return None
    try:
        amount = Decimal(value) * 100
    except InvalidOperation:
        return None
    if not amount.is_finite() or amount != amount.to_integral_value() or abs(amount) > MAX_MINOR:
        return None
    return int(amount)


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def read_treasury(folder: Path, cutoff: date) -> dict[str, dict[str, Any]]:
    if not (folder / 'balances.csv').is_file():
        return {}
    accounts: dict[str, list[str]] = defaultdict(list)
    for product in _rows(folder / 'banking_products.csv'):
        if product.get('type') in {'checking', 'saving'} and product.get('currency') == 'EUR':
            accounts[product['company_id']].append(product['product_id'])
    balances: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in _rows(folder / 'balances.csv'):
        balances[row['product_id']].append(row)
    result: dict[str, dict[str, Any]] = {}
    for company_id, product_ids in accounts.items():
        ledger_values: list[int] = []
        available_values: list[int] = []
        observed = 0
        limitations = [
            'Saldo contable, no disponibilidad libre ni autorización de gasto.',
            'Sólo cuentas checking/saving en EUR del catálogo; no acredita cobertura financiera completa.',
        ]
        for product_id in product_ids:
            candidates = balances[product_id]
            if len(candidates) != 1:
                continue
            row = candidates[0]
            if row.get('company_id') != company_id or row.get('date', '')[:10] != cutoff.isoformat():
                continue
            value = _minor(row.get('balance'))
            if value is None:
                continue
            observed += 1
            ledger_values.append(value)
            available = _minor(row.get('available'))
            if available is not None:
                available_values.append(available)
        complete = observed == len(product_ids) and len(set(product_ids)) == len(product_ids)
        ledger_total = sum(ledger_values)
        ledger_minor = ledger_total if complete and abs(ledger_total) <= MAX_MINOR else None
        available_total = sum(available_values)
        available_minor = available_total if complete and len(available_values) == len(product_ids) and abs(available_total) <= MAX_MINOR else None
        if ledger_minor is None:
            limitations.append('Faltan saldos válidos y contemporáneos o existen duplicados/conflictos de titularidad.')
        if available_minor is None:
            limitations.append('La fuente no informa disponible para todas las cuentas del perímetro.')
        result[company_id] = {
            'as_of': cutoff.isoformat(),
            'currency': 'EUR',
            'ledger_minor': ledger_minor,
            'available_minor': available_minor,
            'account_ids': sorted(set(product_ids)),
            'accounts_expected': len(product_ids),
            'accounts_observed': observed,
            'source': 'balances.csv',
            'availability_verified': False,
            'limitations': limitations,
        }
    return result
