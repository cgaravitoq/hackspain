from dataclasses import dataclass
from datetime import date
from pathlib import Path

import polars as pl

CUTOFF = date(2026, 9, 1)
FINANCING = ("transfer", "investment_deployment", "investment_return")
COST = ("fee", "interest_charge")


@dataclass(frozen=True)
class Dataset:
    companies: pl.DataFrame
    groups: pl.DataFrame
    transactions: pl.DataFrame
    invoices: pl.DataFrame
    debt: pl.DataFrame
    balances: pl.DataFrame


def _to_date(column: str) -> pl.Expr:
    # Strict on purpose: a nulled date would silently drop its row from the CUTOFF and overdue filters.
    return pl.col(column).str.slice(0, 10).str.to_date("%Y-%m-%d")


def read(data_dir: Path) -> Dataset:
    companies = pl.read_csv(
        data_dir / "companies.csv", columns=["company_id", "group_id", "currency"]
    )
    groups = pl.read_csv(data_dir / "groups.csv", columns=["group_id", "erp"])
    eur_products = (
        pl.read_csv(data_dir / "banking_products.csv", columns=["product_id", "currency"])
        .filter(pl.col("currency") == "EUR")
        .get_column("product_id")
    )
    transactions = (
        pl.scan_csv(
            data_dir / "transactions.csv",
            schema_overrides={"amount": pl.Float64, "exchange_rate": pl.Float64},
        )
        .filter(pl.col("status") == "booked")
        .filter(pl.col("product_id").is_in(eur_products.implode()))
        .with_columns(_to_date("date"))
        .filter(pl.col("date") < CUTOFF)
        .with_columns(
            pl.col("category").fill_null("-"),
            pl.col("date").dt.truncate("1mo").alias("month"),
        )
        .select("company_id", "month", "amount", "category")
        .collect()
    )
    invoices = (
        pl.scan_csv(
            data_dir / "invoices.csv",
            schema_overrides={"amount": pl.Float64, "pending_amount": pl.Float64},
        )
        .filter((pl.col("document_type") == "invoice") & (pl.col("amount") > 0))
        .with_columns(_to_date("issuance_date"), _to_date("due_date"), _to_date("payment_date"))
        .select(
            "company_id",
            "issuance_date",
            "due_date",
            "payment_date",
            "amount",
            "pending_amount",
            "status",
            "counterparty_id",
        )
        .collect()
    )
    debt = (
        pl.read_csv(
            data_dir / "debt_products.csv",
            columns=["company_id", "type", "outstanding", "granted"],
            schema_overrides={"outstanding": pl.Float64, "granted": pl.Float64},
        )
        .with_columns(pl.col("outstanding").abs().fill_null(0.0), pl.col("granted").abs().fill_null(0.0))
    )
    balances = pl.read_csv(
        data_dir / "balances.csv",
        columns=["company_id", "balance"],
        schema_overrides={"balance": pl.Float64},
    )
    return Dataset(companies, groups, transactions, invoices, debt, balances)
