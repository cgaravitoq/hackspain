"""Monthly operational features per company, built from the read-only extract.

Scope rules that execute here, not downstream:

- currency comes from the product union (banking + debt); anything that is not
  EUR, and anything whose product does not resolve, is dropped before a single
  amount is added up. No FX conversion happens anywhere.
- a company-month with no observation does not exist in the output. It is never
  materialised as a zero row. An observed zero total is kept as a zero.
- the booking column is `date`. `value_date` runs to 2099 in the extract and is
  never read.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

TRANSACTION_COLUMNS = ["transaction_id", "company_id", "product_id", "date", "amount", "category"]

EUR = "EUR"

# Dropped at row level: no usable category, or a category whose economic
# meaning the audit could not establish (see config.yaml `categories`).
EXCLUDED_ROW_CATEGORIES = frozenset({"-", "", "cash_withdrawal", "pos_withdrawal", "transfer"})

OPERATIONAL_INFLOW_CATEGORIES = frozenset({"collection", "bulk_collection", "tax_refund"})
OPERATIONAL_OUTFLOW_CATEGORIES = frozenset(
    {"payment", "bulk_payment", "utility", "salary", "social_security", "tax"}
)
CHARGEBACK_CATEGORIES = frozenset({"collection_refund", "payment_refund"})
# Refunds are operational by nature and are signed in the source, so they net
# against the side they reverse instead of being counted twice.
OPERATIONAL_CATEGORIES = (
    OPERATIONAL_INFLOW_CATEGORIES | OPERATIONAL_OUTFLOW_CATEGORIES | CHARGEBACK_CATEGORIES
)
FEE_CATEGORY = "fee"
DEBT_REPAYMENT_CATEGORY = "debt_repayment"
INTEREST_CATEGORY = "interest_charge"

FEATURE_COLUMNS = [
    "operational_inflow",
    "operational_outflow",
    "chargeback_count",
    "total_transactions",
    "chargeback_rate",
    "fee_load",
    "total_volume",
    "fee_ratio",
    "debt_repayment_load",
    "interest_load",
    "debt_interest_ratio",
]

EXCLUSION_COLUMNS = [
    "excluded_unknown_product",
    "excluded_non_eur",
    "excluded_no_category",
    "excluded_other_category",
]


@dataclass(frozen=True)
class Dataset:
    """Monthly features plus the exclusion evidence needed for traceability."""

    features: pd.DataFrame
    exclusions: pd.DataFrame
    totals: dict[str, int]
    cutoff: pd.Timestamp


def load_currency_map(data_dir: Path) -> pd.Series:
    """product_id -> currency, from the union of both product tables."""
    frames = []
    for name in ("banking_products.csv", "debt_products.csv"):
        frame = pd.read_csv(
            data_dir / name, usecols=["product_id", "currency"], dtype=str, keep_default_na=False
        )
        frames.append(frame)
    products = pd.concat(frames, ignore_index=True)
    products = products.drop_duplicates(subset="product_id", keep="first")
    return products.set_index("product_id")["currency"]


def load_transactions(data_dir: Path) -> pd.DataFrame:
    frame = pd.read_csv(
        data_dir / "transactions.csv",
        usecols=TRANSACTION_COLUMNS,
        dtype={"transaction_id": str, "company_id": str, "product_id": str, "category": str},
        keep_default_na=False,
        na_values=[],
    )
    frame["date"] = pd.to_datetime(frame["date"], format="%Y-%m-%d %H:%M:%S", errors="coerce")
    frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce")
    return frame


def default_cutoff(dates: pd.Series) -> pd.Timestamp:
    """Start of the month containing the latest booking.

    The extract ends on 2026-09-01, a one-day month. Scoring the last three
    "observed" months would otherwise let a one-day stub outweigh two full
    months, so the trailing partial calendar month is cut off rather than
    treated as an observation.
    """
    latest = dates.max()
    return pd.Timestamp(year=latest.year, month=latest.month, day=1)


def build_dataset(data_dir: str | Path, cutoff: pd.Timestamp | None = None) -> Dataset:
    data_dir = Path(data_dir)
    transactions = load_transactions(data_dir)
    currency = load_currency_map(data_dir)

    unparsed_dates = int(transactions["date"].isna().sum())
    unparsed_amounts = int(transactions["amount"].isna().sum())
    transactions = transactions.dropna(subset=["date", "amount"])

    if cutoff is None:
        cutoff = default_cutoff(transactions["date"])
    cutoff = pd.Timestamp(cutoff)
    no_category_system = int(transactions["category"].isin({"-", ""}).sum())
    after_cutoff = int((transactions["date"] >= cutoff).sum())
    transactions = transactions[transactions["date"] < cutoff]

    transactions["currency"] = transactions["product_id"].map(currency)

    unknown_product = transactions["currency"].isna()
    non_eur = ~unknown_product & (transactions["currency"] != EUR)
    no_category = transactions["category"].isin({"-", ""})
    other_excluded = transactions["category"].isin(EXCLUDED_ROW_CATEGORIES) & ~no_category

    flags = pd.DataFrame(
        {
            "company_id": transactions["company_id"],
            "excluded_unknown_product": unknown_product,
            "excluded_non_eur": non_eur,
            "excluded_no_category": ~unknown_product & ~non_eur & no_category,
            "excluded_other_category": ~unknown_product & ~non_eur & other_excluded,
        }
    )
    exclusions = flags.groupby("company_id", sort=True)[EXCLUSION_COLUMNS].sum().astype(int)

    included = transactions[~unknown_product & ~non_eur & ~no_category & ~other_excluded].copy()

    totals = {
        "transactions_read": int(len(transactions)) + after_cutoff,
        "unparsed_dates": unparsed_dates,
        "unparsed_amounts": unparsed_amounts,
        "after_cutoff": after_cutoff,
        "excluded_unknown_product": int(unknown_product.sum()),
        "excluded_non_eur": int(non_eur.sum()),
        "excluded_no_category": int(flags["excluded_no_category"].sum()),
        "no_category_system": no_category_system,
        "excluded_other_category": int(flags["excluded_other_category"].sum()),
        "included": int(len(included)),
    }

    return Dataset(
        features=aggregate_monthly(included),
        exclusions=exclusions,
        totals=totals,
        cutoff=cutoff,
    )


def aggregate_monthly(included: pd.DataFrame) -> pd.DataFrame:
    if included.empty:
        index = pd.MultiIndex.from_arrays([[], []], names=["company_id", "period"])
        return pd.DataFrame(0.0, index=index, columns=FEATURE_COLUMNS)

    included["period"] = included["date"].dt.to_period("M")
    amount = included["amount"]
    category = included["category"]
    operational = category.isin(OPERATIONAL_CATEGORIES)

    included["op_inflow"] = np.where(operational & (amount > 0), amount, 0.0)
    included["op_outflow"] = np.where(operational & (amount < 0), -amount, 0.0)
    included["chargeback_count"] = category.isin(CHARGEBACK_CATEGORIES).astype("int64")
    included["fee_amount"] = np.where(category == FEE_CATEGORY, amount, 0.0)
    included["debt_amount"] = np.where(category == DEBT_REPAYMENT_CATEGORY, amount, 0.0)
    included["interest_amount"] = np.where(category == INTEREST_CATEGORY, amount, 0.0)

    grouped = included.groupby(["company_id", "period"], sort=True)
    features = grouped.agg(
        operational_inflow=("op_inflow", "sum"),
        operational_outflow=("op_outflow", "sum"),
        chargeback_count=("chargeback_count", "sum"),
        total_transactions=("transaction_id", "size"),
        fee_load=("fee_amount", "sum"),
        debt_repayment_load=("debt_amount", "sum"),
        interest_load=("interest_amount", "sum"),
    )

    # abs() is applied to the signed monthly net, not per row: a fee and its
    # reversal inside the same month cancel instead of adding up.
    features["fee_load"] = features["fee_load"].abs()
    features["debt_repayment_load"] = features["debt_repayment_load"].abs()
    features["interest_load"] = features["interest_load"].abs()

    features["total_volume"] = features["operational_inflow"] + features["operational_outflow"]
    features["chargeback_rate"] = _safe_ratio(
        features["chargeback_count"], features["total_transactions"]
    )
    features["fee_ratio"] = _safe_ratio(features["fee_load"], features["total_volume"])
    features["debt_interest_ratio"] = _safe_ratio(
        features["debt_repayment_load"] + features["interest_load"], features["total_volume"]
    )
    return features[FEATURE_COLUMNS]


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    return np.where(denominator > 0, numerator / denominator.where(denominator > 0, 1.0), 0.0)


def build_monthly_features(data_dir: str | Path) -> pd.DataFrame:
    """Monthly features indexed by (company_id, period). Observed months only."""
    return build_dataset(data_dir).features
