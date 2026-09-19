import csv
from datetime import date
from pathlib import Path

from xray.treasury import read_treasury

CUTOFF = date(2026, 9, 1)


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def seed(folder: Path, second_date: str = '2026-09-01', second_owner: str = 'C1', second_amount: str = '-20.01') -> None:
    write_csv(folder / 'banking_products.csv', [
        {'product_id': 'P1', 'company_id': 'C1', 'currency': 'EUR', 'type': 'checking'},
        {'product_id': 'P2', 'company_id': 'C1', 'currency': 'EUR', 'type': 'saving'},
        {'product_id': 'INVEST', 'company_id': 'C1', 'currency': 'EUR', 'type': 'investment'},
        {'product_id': 'USD', 'company_id': 'C1', 'currency': 'USD', 'type': 'checking'},
    ])
    write_csv(folder / 'balances.csv', [
        {'product_id': 'P1', 'company_id': 'C1', 'date': '2026-09-01 00:00:00', 'balance': '100.10', 'available': ''},
        {'product_id': 'P2', 'company_id': second_owner, 'date': second_date, 'balance': second_amount, 'available': ''},
        {'product_id': 'INVEST', 'company_id': 'C1', 'date': '2026-09-01', 'balance': '999999', 'available': ''},
        {'product_id': 'USD', 'company_id': 'C1', 'date': '2026-09-01', 'balance': '999999', 'available': ''},
    ])


def test_aggregates_only_matching_euro_cash_accounts_without_verifying_available(tmp_path):
    seed(tmp_path)
    result = read_treasury(tmp_path, CUTOFF)['C1']
    assert result['ledger_minor'] == 8009
    assert result['available_minor'] is None
    assert result['availability_verified'] is False
    assert result['accounts_expected'] == result['accounts_observed'] == 2
    assert result['account_ids'] == ['P1', 'P2']
    assert result['source'] == 'balances.csv'


def test_does_not_treat_stale_or_other_company_balances_as_current_cash(tmp_path):
    seed(tmp_path, second_date='2026-08-30')
    assert read_treasury(tmp_path, CUTOFF)['C1']['ledger_minor'] is None
    seed(tmp_path, second_owner='OTHER')
    assert read_treasury(tmp_path, CUTOFF)['C1']['ledger_minor'] is None


def test_does_not_round_fractional_cents_into_observed_cash(tmp_path):
    seed(tmp_path, second_amount='0.001')
    assert read_treasury(tmp_path, CUTOFF)['C1']['ledger_minor'] is None


def test_missing_balances_preserve_legacy_scoring_without_inventing_zero(tmp_path):
    assert read_treasury(tmp_path, CUTOFF) == {}


def test_duplicate_balance_rows_do_not_double_the_opening_balance(tmp_path):
    seed(tmp_path)
    with (tmp_path / 'balances.csv').open('a', encoding='utf-8', newline='') as handle:
        csv.writer(handle).writerow(['P1', 'C1', '2026-09-01', '100.10', ''])
    assert read_treasury(tmp_path, CUTOFF)['C1']['ledger_minor'] is None


def test_available_is_reported_separately_but_does_not_grant_permission(tmp_path):
    seed(tmp_path)
    write_csv(tmp_path / 'balances.csv', [
        {'product_id': 'P1', 'company_id': 'C1', 'date': '2026-09-01', 'balance': '100.10', 'available': '50.01'},
        {'product_id': 'P2', 'company_id': 'C1', 'date': '2026-09-01', 'balance': '-20.01', 'available': '0'},
    ])
    result = read_treasury(tmp_path, CUTOFF)['C1']
    assert result['available_minor'] == 5001
    assert result['ledger_minor'] == 8009
    assert result['availability_verified'] is False
