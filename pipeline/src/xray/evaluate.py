import argparse
import json
import math
import subprocess
import textwrap
from datetime import date
from pathlib import Path
from typing import Any

import polars as pl

CUTOFFS = ("2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07")
CANDIDATES = ("pipeline", "credit-scoring", "naive")

CREDIT_DRIVER = textwrap.dedent(
    """
    import csv
    import sys
    from datetime import date, timedelta
    from pathlib import Path

    checkout = Path(sys.argv[1])
    data_dir = Path(sys.argv[2])
    cutoff = date.fromisoformat(sys.argv[3])
    out_path = Path(sys.argv[4])
    sys.path.insert(0, str(checkout))

    from src.data_pipeline import build_dataset
    from src.score_engine import load_config, score_company

    dataset = build_dataset(data_dir, cutoff=cutoff)
    config = load_config(checkout / "src" / "config.yaml")
    features = dataset.features
    by_company = {
        company_id: frame.droplevel("company_id")
        for company_id, frame in features.groupby(level="company_id")
    }
    empty_features = features.iloc[0:0].droplevel("company_id")
    empty_exclusions = {column: 0 for column in dataset.exclusions.columns}
    company_ids = sorted(set(by_company) | set(dataset.exclusions.index))
    rows = []
    for company_id in company_ids:
        exclusions = (
            dataset.exclusions.loc[company_id].to_dict()
            if company_id in dataset.exclusions.index
            else empty_exclusions
        )
        result = score_company(
            company_id=company_id,
            features=by_company.get(company_id, empty_features),
            exclusions={key: int(value) for key, value in exclusions.items()},
            config=config,
            scoring_date=cutoff - timedelta(days=1),
            system_no_category=dataset.totals["no_category_system"],
            cutoff=dataset.cutoff,
        )
        if result["final_score"] is not None:
            rows.append({"company_id": company_id, "score": result["final_score"]})
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["company_id", "score"])
        writer.writeheader()
        writer.writerows(rows)
    """
)


def _month(value: str) -> date:
    year, month = (int(part) for part in value.split("-"))
    return date(year, month, 1)


def _shift_month(value: date, months: int) -> date:
    index = value.year * 12 + value.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def add_parser(commands: Any) -> None:
    parser = commands.add_parser("evaluate", help="compare score rankings against payment-delay outcomes")
    parser.add_argument("--data", type=Path, required=True, help="folder with the Embat CSV files")
    parser.add_argument("--artifacts", type=Path, help="folder with xray score artifacts")
    parser.add_argument("--credit-scoring-scores", type=Path, help="folder with one credit score CSV per cutoff")
    parser.add_argument("--prepare-credit-scoring", action="store_true", help="write credit score CSVs")
    parser.add_argument("--credit-scoring", type=Path, help="credit-scoring checkout")
    parser.add_argument("--credit-scoring-python", type=Path, help="Python interpreter for credit-scoring")
    parser.add_argument("--out", type=Path, help="folder that receives credit score CSVs")


def read_invoices(data_dir: Path) -> pl.DataFrame:
    return (
        pl.scan_csv(data_dir / "invoices.csv", schema_overrides={"amount": pl.Float64})
        .filter((pl.col("document_type") == "invoice") & (pl.col("amount") > 0))
        .select(
            "company_id",
            pl.col("due_date").str.slice(0, 10).str.to_date("%Y-%m-%d"),
            pl.col("payment_date").str.slice(0, 10).str.to_date("%Y-%m-%d"),
        )
        .collect()
    )


def labels_for_cutoff(invoices: pl.DataFrame, cutoff: date) -> tuple[pl.DataFrame, int, int]:
    historical_start = _shift_month(cutoff, -2)
    future_start = _shift_month(cutoff, 1)
    future_end = _shift_month(cutoff, 4)
    in_windows = invoices.filter(
        (pl.col("due_date") >= historical_start) & (pl.col("due_date") < future_end)
    )
    null_invoices = in_windows.get_column("payment_date").null_count()
    paid = in_windows.filter(pl.col("payment_date").is_not_null()).with_columns(
        (pl.col("payment_date") - pl.col("due_date")).dt.total_days().alias("delay")
    )
    historical = (
        paid.filter(pl.col("due_date") < future_start)
        .group_by("company_id")
        .agg(pl.col("delay").mean().alias("historical_delay"))
    )
    future = (
        paid.filter(pl.col("due_date") >= future_start)
        .group_by("company_id")
        .agg(pl.col("delay").mean().alias("future_delay"))
    )
    labels = historical.join(future, on="company_id", how="inner").select(
        "company_id", (pl.col("future_delay") > pl.col("historical_delay")).alias("positive")
    )
    return labels.sort("company_id"), null_invoices, in_windows.height


def read_pipeline_scores(artifacts_dir: Path, cutoff: str) -> pl.DataFrame:
    rows = []
    for path in sorted((artifacts_dir / "scores").glob("*.json")):
        payload = json.loads(path.read_text())
        entry = next((item for item in payload["series"] if item["month"] == cutoff), None)
        if entry is not None and entry["score"] is not None:
            rows.append((payload["company_id"], float(entry["score"])))
    return pl.DataFrame(rows, schema={"company_id": pl.String, "score": pl.Float64}, orient="row")


def read_credit_scores(scores_dir: Path, cutoff: str) -> pl.DataFrame:
    return (
        pl.read_csv(
            scores_dir / f"{cutoff}.csv",
            columns=["company_id", "score"],
            schema_overrides={"company_id": pl.String, "score": pl.Float64},
        )
        .drop_nulls()
        .sort("company_id")
    )


def read_naive_monthly(data_dir: Path) -> pl.DataFrame:
    amount = pl.col("amount")
    return (
        pl.scan_csv(data_dir / "transactions.csv", schema_overrides={"amount": pl.Float64})
        .filter(pl.col("status") == "booked")
        .with_columns(pl.col("date").str.slice(0, 10).str.to_date("%Y-%m-%d"))
        .filter(pl.col("date") < _shift_month(_month(CUTOFFS[-1]), 1))
        .with_columns(pl.col("date").dt.truncate("1mo").alias("month"))
        .group_by("company_id", "month")
        .agg(
            amount.filter(amount > 0).sum().alias("inflow"),
            (-amount).filter(amount < 0).sum().alias("outflow"),
        )
        .collect()
    )


def naive_scores(monthly: pl.DataFrame, cutoff: str) -> pl.DataFrame:
    recent = (
        monthly.filter(pl.col("month") <= _month(cutoff))
        .sort("company_id", "month")
        .group_by("company_id", maintain_order=True)
        .tail(3)
        .group_by("company_id")
        .agg(pl.col("inflow", "outflow").sum())
        .with_columns(
            pl.when(pl.col("outflow") > 0)
            .then(pl.col("inflow") / pl.col("outflow"))
            .when(pl.col("inflow") > 0)
            .then(pl.lit(float("inf")))
            .otherwise(None)
            .alias("score")
        )
        .select("company_id", "score")
        .drop_nulls()
        .sort("company_id")
    )
    return recent


def auc(scores: list[float], positives: list[bool]) -> float | None:
    positive_scores = [score for score, positive in zip(scores, positives, strict=True) if positive]
    negative_scores = [score for score, positive in zip(scores, positives, strict=True) if not positive]
    pairs = len(positive_scores) * len(negative_scores)
    if not pairs:
        return None
    ordered = sum(
        1.0 if positive < negative else 0.5 if positive == negative else 0.0
        for positive in positive_scores
        for negative in negative_scores
    )
    return ordered / pairs


def precision_at_worst(company_ids: list[str], scores: list[float], positives: list[bool]) -> float | None:
    if not scores:
        return None
    count = math.ceil(len(scores) * 0.1)
    ranked = sorted(zip(scores, company_ids, positives, strict=True))[:count]
    return sum(positive for _, _, positive in ranked) / count


def evaluate_cutoff(
    cutoff: str,
    labels: pl.DataFrame,
    pipeline: pl.DataFrame,
    credit: pl.DataFrame,
    naive: pl.DataFrame,
    null_invoices: int,
    invoices_in_windows: int = 0,
) -> list[dict[str, Any]]:
    eligible = (
        labels.join(pipeline.rename({"score": "pipeline"}), on="company_id", how="inner")
        .join(credit.rename({"score": "credit-scoring"}), on="company_id", how="inner")
        .join(naive.rename({"score": "naive"}), on="company_id", how="inner")
        .sort("company_id")
    )
    positives = eligible.get_column("positive").to_list()
    company_ids = eligible.get_column("company_id").to_list()
    positive_count = sum(positives)
    pairs = positive_count * (eligible.height - positive_count)
    rows = []
    for candidate in CANDIDATES:
        scores = eligible.get_column(candidate).to_list()
        rows.append(
            {
                "cutoff": cutoff,
                "candidate": candidate,
                "companies": eligible.height,
                "positives": positive_count,
                "pairs": pairs,
                "auc": auc(scores, positives),
                "precision_worst_10": precision_at_worst(company_ids, scores, positives),
                "invoices": invoices_in_windows,
                "null_payment_date": null_invoices,
            }
        )
    return rows


def prepare_credit_scoring(
    data_dir: Path,
    checkout: Path,
    python: Path,
    out_dir: Path,
) -> None:
    for cutoff in CUTOFFS:
        next_month = _shift_month(_month(cutoff), 1)
        subprocess.run(
            [
                str(python),
                "-c",
                CREDIT_DRIVER,
                str(checkout),
                str(data_dir),
                next_month.isoformat(),
                str(out_dir / f"{cutoff}.csv"),
            ],
            cwd=checkout,
            check=True,
        )


def evaluate(data_dir: Path, artifacts_dir: Path, credit_scores_dir: Path) -> tuple[list[dict[str, Any]], str]:
    invoices = read_invoices(data_dir)
    monthly = read_naive_monthly(data_dir)
    rows = []
    for cutoff in CUTOFFS:
        labels, null_invoices, invoice_count = labels_for_cutoff(invoices, _month(cutoff))
        rows.extend(
            evaluate_cutoff(
                cutoff,
                labels,
                read_pipeline_scores(artifacts_dir, cutoff),
                read_credit_scores(credit_scores_dir, cutoff),
                naive_scores(monthly, cutoff),
                null_invoices,
                invoice_count,
            )
        )
    return rows, verdict(rows)


def verdict(rows: list[dict[str, Any]]) -> str:
    wins = {candidate: 0 for candidate in CANDIDATES}
    for cutoff in CUTOFFS:
        cutoff_rows = [row for row in rows if row["cutoff"] == cutoff and row["auc"] is not None]
        if not cutoff_rows:
            continue
        best = max(row["auc"] for row in cutoff_rows)
        leaders = [row["candidate"] for row in cutoff_rows if row["auc"] == best]
        if len(leaders) == 1:
            wins[leaders[0]] += 1
    winner = next((candidate for candidate in CANDIDATES if wins[candidate] >= 4), None)
    if winner == "naive":
        return f"VERDICT: naive baseline wins {wins[winner]}/6 cutoffs; no formula justifies its cost."
    if winner is not None:
        return f"VERDICT: {winner} wins {wins[winner]}/6 cutoffs under the fixed decision rule."
    return "VERDICT: no policy beats the naive baseline in 4 of 6 cutoffs; no formula justifies its cost."


def format_results(rows: list[dict[str, Any]], decision: str) -> str:
    headers = (
        "cutoff",
        "candidate",
        "companies",
        "positives",
        "pairs",
        "auc",
        "precision_worst_10",
        "invoices",
        "null_payment_date",
    )
    values = []
    for row in rows:
        values.append(
            [
                str(row[header])
                if header not in {"auc", "precision_worst_10"} or row[header] is None
                else f"{row[header]:.4f}"
                for header in headers
            ]
        )
    widths = [max(len(header), *(len(row[index]) for row in values)) for index, header in enumerate(headers)]
    lines = ["  ".join(header.ljust(widths[index]) for index, header in enumerate(headers))]
    lines.append("  ".join("-" * width for width in widths))
    lines.extend("  ".join(value.ljust(widths[index]) for index, value in enumerate(row)) for row in values)
    return "\n".join([*lines, decision])


def run_command(args: argparse.Namespace) -> str:
    if args.prepare_credit_scoring:
        if args.credit_scoring is None or args.credit_scoring_python is None or args.out is None:
            raise ValueError("preparation requires --credit-scoring, --credit-scoring-python and --out")
        prepare_credit_scoring(args.data, args.credit_scoring, args.credit_scoring_python, args.out)
        return f"Wrote {len(CUTOFFS)} credit-scoring CSVs to {args.out}"
    if args.artifacts is None or args.credit_scoring_scores is None:
        raise ValueError("evaluation requires --artifacts and --credit-scoring-scores")
    rows, decision = evaluate(args.data, args.artifacts, args.credit_scoring_scores)
    return format_results(rows, decision)
