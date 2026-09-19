import polars as pl

RULE_VERSION = "xray-score/0.1"
LAMBDA = 0.25
ADJUSTMENT_CAP = 10.0
MOMENTUM_THRESHOLD = 5.0
VOLATILITY_FACTOR = 0.75
EXIT_FACTOR = 0.5
PENALTY_CAP = 15.0
HEALTHY_LEVEL = 60.0
PERSISTENCE_MONTHS = 3

NOT_EVALUABLE = "not_evaluable"
DOWN_STATES = ("slipping", "falling")


def score_panel(panel: pl.DataFrame) -> pl.DataFrame:
    windows = [
        pl.col(column).rolling_sum(window_size=3, min_samples=3).over("company_id").alias(f"{column}_3")
        for column in ("inflow", "outflow", "fees", "refunds", "withdrawals", "n_tx", "n_uncategorised")
    ]
    scored = panel.with_columns(windows)

    inflow, outflow = pl.col("inflow_3"), pl.col("outflow_3")
    enough = pl.col("months_observed") >= 3
    balance = pl.when(enough & ((inflow + outflow) > 0)).then(100 * inflow / (inflow + outflow))
    fee_penalty = pl.when(outflow > 0).then(-(100 * pl.col("fees_3") / outflow).clip(0, PENALTY_CAP)).otherwise(0.0)
    refund_penalty = pl.when(inflow > 0).then(-(100 * pl.col("refunds_3") / inflow).clip(0, PENALTY_CAP)).otherwise(0.0)

    scored = scored.with_columns(
        balance=balance,
        fee_penalty=fee_penalty,
        refund_penalty=refund_penalty,
        share_uncategorised=pl.when(pl.col("n_tx_3") > 0).then(pl.col("n_uncategorised_3") / pl.col("n_tx_3")).otherwise(0.0),
    ).with_columns(level=(pl.col("balance") + pl.col("fee_penalty") + pl.col("refund_penalty")).clip(0, 100))

    scored = scored.with_columns(
        momentum=pl.when(pl.col("months_observed") >= 6).then(pl.col("level") - pl.col("level").shift(3).over("company_id"))
    ).with_columns(
        adjustment=(LAMBDA * pl.col("momentum")).clip(-ADJUSTMENT_CAP, ADJUSTMENT_CAP).fill_null(0.0),
        momentum_sd=pl.col("momentum").rolling_std(window_size=12, min_samples=6).over("company_id"),
    )

    return scored.with_columns(
        score=(pl.col("level") + pl.col("adjustment")).clip(0, 100),
        threshold=pl.max_horizontal(pl.lit(MOMENTUM_THRESHOLD), VOLATILITY_FACTOR * pl.col("momentum_sd")).fill_null(MOMENTUM_THRESHOLD),
        inflow_avg_prev6=pl.col("inflow").shift(1).rolling_mean(window_size=6, min_samples=6).over("company_id"),
    )


def confidence(months_observed: int, share_uncategorised: float) -> str:
    if months_observed < 3:
        return "none"
    levels = ["low", "medium", "high"]
    index = 0 if months_observed < 6 else 1 if months_observed < 12 else 2
    if share_uncategorised > 0.4:
        index = max(index - 1, 0)
    return levels[index]


def states(momentum: list[float | None], level: list[float | None], threshold: list[float]) -> list[str]:
    result: list[str] = []
    run_up = run_down = 0
    previous = NOT_EVALUABLE
    for m, l, tau in zip(momentum, level, threshold, strict=True):
        if m is None or l is None:
            run_up = run_down = 0
            previous = NOT_EVALUABLE
            result.append(previous)
            continue
        going_down = m <= -tau or (previous in DOWN_STATES and m <= -tau * EXIT_FACTOR)
        going_up = m >= tau or (previous == "improving" and m >= tau * EXIT_FACTOR)
        if going_down:
            run_down, run_up = run_down + 1, 0
        elif going_up:
            run_up, run_down = run_up + 1, 0
        else:
            run_up = run_down = 0
        if run_down >= PERSISTENCE_MONTHS:
            previous = "falling"
        elif run_down >= 1:
            previous = "slipping"
        elif run_up >= PERSISTENCE_MONTHS:
            previous = "improving"
        elif l >= HEALTHY_LEVEL:
            previous = "healthy"
        else:
            previous = "stable"
        result.append(previous)
    return result
