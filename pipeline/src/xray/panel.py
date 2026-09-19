import polars as pl

from xray.load import COST, FINANCING

SUM_COLUMNS = (
    "inflow",
    "outflow",
    "fees",
    "refunds",
    "withdrawals",
    "debt_repayment",
    "financing_in",
    "financing_out",
)


def monthly_panel(transactions: pl.DataFrame) -> pl.DataFrame:
    amount = pl.col("amount")
    category = pl.col("category")
    is_financing = category.is_in(FINANCING)
    outgoing = -amount

    monthly = transactions.group_by("company_id", "month").agg(
        inflow=amount.filter((amount > 0) & ~is_financing).sum(),
        outflow=outgoing.filter((amount < 0) & ~is_financing).sum(),
        fees=outgoing.filter((amount < 0) & category.is_in(COST)).sum(),
        refunds=outgoing.filter((amount < 0) & (category == "collection_refund")).sum(),
        withdrawals=outgoing.filter((amount < 0) & (category == "cash_withdrawal")).sum(),
        debt_repayment=outgoing.filter((amount < 0) & (category == "debt_repayment")).sum(),
        financing_in=amount.filter((amount > 0) & is_financing).sum(),
        financing_out=outgoing.filter((amount < 0) & is_financing).sum(),
        n_tx=pl.len(),
        n_uncategorised=(category == "-").sum(),
    )

    span = monthly.group_by("company_id").agg(
        start=pl.col("month").min(), end=pl.col("month").max()
    )
    grid = (
        span.with_columns(month=pl.date_ranges("start", "end", interval="1mo"))
        .explode("month")
        .select("company_id", "month")
    )
    return (
        grid.join(monthly, on=["company_id", "month"], how="left")
        .with_columns(
            pl.col(*SUM_COLUMNS).fill_null(0.0),
            pl.col("n_tx", "n_uncategorised").fill_null(0),
        )
        .sort("company_id", "month")
        .with_columns(observed=pl.col("n_tx") > 0)
        .with_columns(
            months_observed=pl.col("observed").cast(pl.Int32).cum_sum().over("company_id")
        )
    )
