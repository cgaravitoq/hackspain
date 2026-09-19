from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import data_pipeline as dp
from . import score_engine as se

FORECAST_RULE_VERSION = "forecast-v1.0.0"
DEFAULT_CONFIG = Path(__file__).resolve().parent / "config.yaml"
METRIC_UNITS = "normalized_score_points_0_100"
FORECAST_LIMITATIONS = [
    "Method not externally validated",
    "Projected scores use same weights as observed — no recalibration",
    "Favorable/adverse scenarios based on historical std, not causal model",
    "Linear regression is a candidate method; only three held-out observations are used for method selection, not validation",
    "Outputs project normalized components, not cash balances or default probabilities",
    "Seasonality is unsupported: no seasonal adjustment or seasonal predictor is fitted",
    "Scenarios are input perturbations, not calibrated probability bounds; nonlinear engine adjustments may change their score ordering",
    "Scoring windows use the original full observed history plus explicit target projections only; no hidden bridge months or zero filling; projected rows are not observation evidence",
]


def validate_min_months(value: int) -> int:
    if type(value) is not int or value < 12:
        raise ValueError("min_months must be an integer >= 12; the operational-data floor cannot be bypassed")
    return value


def _company_id(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", value):
        raise ValueError("company_id must be a safe alphanumeric ID with optional underscores or hyphens")
    return value


def _date(value: Any, label: str) -> date:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError(f"{label} must be an ISO YYYY-MM-DD date")
    return date.fromisoformat(value)


def operational_months(transactions: pd.DataFrame, currency: pd.Series,
                       cutoff: pd.Timestamp) -> dict[str, pd.PeriodIndex]:
    valid = transactions["date"].notna() & transactions["amount"].notna()
    valid &= transactions["date"] < cutoff
    valid &= transactions["product_id"].map(currency).eq(dp.EUR)
    valid &= transactions["category"].isin(dp.OPERATIONAL_CATEGORIES)
    observed = transactions.loc[valid, ["company_id", "date", "amount"]].copy()
    if not np.isfinite(observed["amount"].to_numpy(dtype=float)).all():
        raise ValueError("operational amounts must be finite")
    observed["period"] = observed["date"].dt.to_period("M")
    return {
        company_id: pd.PeriodIndex(frame["period"].unique(), freq="M").sort_values()
        for company_id, frame in observed.groupby("company_id", sort=True)
    }


def _period_index(index: pd.Index, label: str) -> None:
    if (not isinstance(index, pd.PeriodIndex) or index.freqstr != "M"
            or not index.is_unique or index.hasnans):
        raise ValueError(f"{label} must contain unique, nonmissing calendar months")


def _finite(values: np.ndarray, label: str) -> None:
    if not np.isfinite(values).all():
        raise ValueError(f"{label} must be finite")


def _regression(x: np.ndarray, y: np.ndarray, targets: np.ndarray) -> np.ndarray:
    _finite(x, "regression calendar ordinals")
    _finite(y, "regression observations")
    origin = float(x.mean())
    design = np.column_stack((x - origin, np.ones(len(x))))
    try:
        coefficients, _, rank, _ = np.linalg.lstsq(design, y, rcond=None)
    except np.linalg.LinAlgError as error:
        raise ValueError(f"regression fit is unevaluable: {error}") from error
    if rank != 2:
        raise ValueError("regression fit is unevaluable: calendar ordinals have insufficient rank")
    _finite(coefficients, "regression coefficients")
    predictions = (targets - origin) * coefficients[0] + coefficients[1]
    if np.all(y == y[0]):
        predictions = np.full(len(targets), y[0], dtype=float)
    _finite(predictions, "regression predictions")
    return predictions


def fit_component(series: pd.Series, targets: pd.PeriodIndex) -> dict[str, Any]:
    _period_index(series.index, "component observations")
    _period_index(targets, "target months")
    if len(series) < 12:
        raise ValueError("component fitting requires at least 12 observed operational months")
    series = series.sort_index()
    if (not pd.api.types.is_numeric_dtype(series.dtype) or pd.api.types.is_bool_dtype(series.dtype)
            or pd.api.types.is_complex_dtype(series.dtype)):
        raise ValueError("component observations must be finite numeric normalized scores")
    y = series.to_numpy(dtype=float)
    _finite(y, "component observations")
    if (y < 0).any() or (y > 100).any():
        raise ValueError("component observations must be normalized scores in [0, 100]")
    x, target_x = series.index.asi8.astype(float), targets.asi8.astype(float)
    regression_raw = _regression(x[:-3], y[:-3], x[-3:])
    regression = np.clip(regression_raw, 0, 100)
    naive = np.full(3, float(y[-6:-3].mean()))
    regression_mae = float(np.abs(y[-3:] - regression).mean())
    naive_mae = float(np.abs(y[-3:] - np.clip(naive, 0, 100)).mean())
    _finite(np.array([regression_mae, naive_mae]), "held-out MAEs")
    winner = "regression" if regression_mae < naive_mae else "naive"
    raw = (_regression(x, y, target_x) if winner == "regression"
           else np.full(len(targets), float(y[-3:].mean())))
    predictions = np.clip(raw, 0, 100)
    std = float(y.std(ddof=1))
    _finite(np.array([std]), "historical sample standard deviation")
    return {
        "winner": winner, "regression_mae": regression_mae, "naive_mae": naive_mae,
        "predictions": predictions.tolist(), "historical_std": std,
        "clipping": {"backtest_regression": bool(np.any(regression != regression_raw)),
                     "backtest_naive": bool(np.any(naive != np.clip(naive, 0, 100))),
                     "future_base": bool(np.any(predictions != raw))},
    }


def _matches(actual: Any, expected: Any) -> bool:
    if isinstance(expected, dict):
        return (isinstance(actual, dict) and actual.keys() == expected.keys()
                and all(_matches(actual[key], value) for key, value in expected.items()))
    if isinstance(expected, list):
        return (isinstance(actual, list) and len(actual) == len(expected)
                and all(_matches(a, b) for a, b in zip(actual, expected, strict=True)))
    if type(expected) in (int, float):
        return type(actual) in (int, float) and bool(np.isclose(actual, expected, rtol=1e-12, atol=1e-9))
    return type(actual) is type(expected) and actual == expected


def validate_source(report: dict, dataset: dp.Dataset, config: se.Config) -> pd.DataFrame:
    if not isinstance(report, dict):
        raise ValueError("company report must be a JSON object")
    json.dumps(report, allow_nan=False)
    company_id = _company_id(report.get("company_id"))
    if report.get("rule_version") != config.rule_version:
        raise ValueError(f"{company_id}: rule_version {report.get('rule_version')!r} does not match "
                         f"active {config.rule_version}; select the AGENT6 v2 snapshot via --results-dir; "
                         "legacy reports cannot be relabeled or automatically rescored")
    scoring_date = _date(report.get("scoring_date"), "scoring_date")
    cutoff_date = _date(report.get("data_cutoff"), "data_cutoff")
    if dataset.cutoff != pd.Timestamp(cutoff_date):
        raise ValueError(f"{company_id}: data_cutoff differs from current dataset cutoff")
    if dataset.cutoff > pd.Timestamp(scoring_date):
        raise ValueError(f"{company_id}: dataset cutoff is in the future relative to scoring_date")
    known = set(dataset.features.index.get_level_values("company_id")) | set(dataset.exclusions.index)
    if company_id not in known:
        raise ValueError(f"{company_id}: company identity is absent from current source data")
    if company_id in dataset.features.index.get_level_values("company_id"):
        features = dataset.features.xs(company_id, level="company_id").sort_index()
    else:
        features = dataset.features.iloc[:0].droplevel("company_id")
    _period_index(features.index, "observed feature periods")
    _finite(features.to_numpy(dtype=float), "source features")
    if len(features) and (features.index.to_timestamp() >= dataset.cutoff).any():
        raise ValueError(f"{company_id}: observations reach or exceed the exclusive data_cutoff")
    if len(features) and (features.index >= pd.Period(scoring_date, freq="M")).any():
        raise ValueError(f"{company_id}: future or incomplete scoring-month observations are not allowed")
    exclusions = {key: 0 for key in dp.EXCLUSION_COLUMNS}
    if company_id in dataset.exclusions.index:
        exclusions.update({key: int(value) for key, value in dataset.exclusions.loc[company_id].items()})
    reproduced = se.score_company(company_id, features, exclusions, config, scoring_date,
                                  dataset.totals["no_category_system"], dataset.cutoff)
    for key, expected in reproduced.items():
        if key == "limitations":
            actual = report.get(key)
            matches = (isinstance(actual, list) and all(isinstance(item, str) for item in actual)
                       and set(expected).issubset(actual))
        else:
            matches = key in report and _matches(report[key], expected)
        if not matches:
            raise ValueError(f"{company_id}: persisted {key} does not reproduce from current data/config; "
                             "use the matching AGENT6 source/config snapshot")
    if "drift_alert" in report and "drift_alert" not in reproduced:
        raise ValueError(f"{company_id}: persisted drift_alert does not reproduce")
    return features


def forecast_company(report: dict, dataset: dp.Dataset, observed_months: pd.PeriodIndex,
                     config: se.Config, min_months: int = 12) -> dict[str, Any]:
    validate_min_months(min_months)
    features = validate_source(report, dataset, config)
    _period_index(observed_months, "observed operational months")
    observed_months = observed_months.sort_values()
    if not observed_months.isin(features.index).all():
        raise ValueError("operational month membership is not present in the matching dataset")
    count = len(observed_months)
    missing = max(0, min_months - count)
    limitations = list(report["limitations"]) + FORECAST_LIMITATIONS
    result = {
        "company_id": report["company_id"], "scoring_date": report["scoring_date"],
        "data_cutoff": report["data_cutoff"], "rule_version": report["rule_version"],
        "forecast_rule_version": FORECAST_RULE_VERSION,
        "forecast_status": "insufficient_data", "observed_operational_months": count,
        "min_months_required": min_months, "months_missing": missing,
        "reason": f"{count} observed EUR operational months; {min_months} required; {missing} months missing",
        "months_used_for_training": 0, "backtest_training_months": 0, "confidence": None,
        "method_per_component": {}, "forecast_months": [], "scenarios": None,
        "baseline_vs_regression": {}, "limitations": limitations, "metric_units": METRIC_UNITS,
        "training_periods": [], "backtest_periods": [], "backtest_training_periods": [],
        "historical_std_per_component": {}, "latest_observed_month": report["latest_observed_month"],
        "latest_operational_month": str(observed_months[-1]) if count else None,
        "provenance": {
            "weights": dict(config.weights), "windows": dict(config.windows),
            "comparison_horizons": dict(config.comparison_horizons),
            "evaluation_frequency": config.evaluation_frequency,
            "min_months_for_window": config.min_months_for_window,
            "thresholds": {"improving": config.improving, "deteriorating": config.deteriorating,
                           "max_adjustment": config.max_adjustment, "complete_month": config.complete_month},
            "observed_window_usage": report["window_usage"],
            "observed_score_reproduced": True,
            "window_convention": "original observed rows plus explicit target projections; no bridge months",
            "operational_observation_periods": list(observed_months.astype(str)),
            "std_ddof": 1, "clipping_policy": "clip all evaluated and deployed component predictions to [0, 100]",
            "clipping": {}, "target_gaps_from_latest_operational_month": [],
        },
    }
    if missing:
        result["forecast"] = None
        validate_forecast(result)
        return result
    full_history = se.monthly_component_scores(features)
    eligible = full_history.loc[observed_months]
    targets = pd.period_range(pd.Period(report["scoring_date"], freq="M") + 1, periods=3, freq="M")
    result.update({
        "forecast_status": "low_confidence" if count < 18 else "ok",
        "confidence": "low" if count < 18 else "medium", "months_used_for_training": count,
        "backtest_training_months": count - 3, "forecast_months": list(targets.astype(str)),
        "training_periods": list(observed_months.astype(str)),
        "backtest_periods": list(observed_months[-3:].astype(str)),
        "backtest_training_periods": list(observed_months[:-3].astype(str)), "scenarios": {},
    })
    if count < 18:
        limitations.append(f"Short history: {count} operational observations (12–17); confidence is low")
    if (np.diff(observed_months.asi8) > 1).any():
        limitations.append("Operational observations contain calendar gaps; OLS uses actual calendar-month ordinals without imputation")
    if observed_months[-1] < (dataset.cutoff - pd.Timedelta(days=1)).to_period("M"):
        limitations.append(f"Stale operational history: latest month {observed_months[-1]}; extrapolation is longer than the current-data case")
    gaps = [int(target.ordinal - observed_months[-1].ordinal) for target in targets]
    result["provenance"]["target_gaps_from_latest_operational_month"] = gaps
    limitations.append(f"Latest operational month {observed_months[-1]}; targets {', '.join(result['forecast_months'])} "
                       f"are {gaps} calendar months later; intervening months are not observations")
    base = pd.DataFrame(index=targets)
    for component in se.COMPONENTS:
        fit = fit_component(eligible[component], targets)
        base[component] = fit["predictions"]
        result["method_per_component"][component] = fit["winner"]
        result["baseline_vs_regression"][component] = {
            key: fit[key] for key in ("regression_mae", "naive_mae", "winner")
        }
        result["historical_std_per_component"][component] = fit["historical_std"]
        result["provenance"]["clipping"][component] = fit["clipping"]
        if fit["winner"] == "naive":
            limitations.append(f"{component}: naive baseline selected because held-out MAE is no greater than regression MAE; ties select naive")
    std = pd.Series(result["historical_std_per_component"])
    for name, direction in (("base", 0), ("favorable", 1), ("adverse", -1)):
        raw = base + direction * std
        projected = raw.clip(lower=0, upper=100)
        for component in se.COMPONENTS:
            result["provenance"]["clipping"][component][name] = bool((raw[component] != projected[component]).any())
        details = [se.score_component_history(pd.concat([full_history, projected.iloc[:end]]), config)
                   for end in range(1, 4)]
        result["scenarios"][name] = {
            "scores": [entry["final_score"] for entry in details],
            "metrics": projected.to_dict(orient="records"), "score_details": details,
        }
        for endpoint, entry in zip(targets, details, strict=True):
            for limitation in entry["limitations"]:
                if limitation not in limitations:
                    limitations.append(f"{name} {endpoint}: {limitation}")
    if any(any(flags.values()) for flags in result["provenance"]["clipping"].values()):
        limitations.append("Component clipping to [0, 100] occurred; per-component backtest/deployment flags are in provenance.clipping")
    validate_forecast(result)
    return result


def validate_forecast(result: dict) -> None:
    json.dumps(result, allow_nan=False)
    _company_id(result.get("company_id"))
    _date(result.get("scoring_date"), "scoring_date")
    required = {"rule_version", "forecast_rule_version", "reason", "limitations", "metric_units",
                "observed_operational_months", "min_months_required", "months_missing", "confidence",
                "training_periods", "backtest_periods", "historical_std_per_component",
                "latest_observed_month", "provenance", "months_used_for_training", "backtest_training_months",
                "forecast_months", "method_per_component", "baseline_vs_regression", "scenarios"}
    required |= {"backtest_training_periods", "data_cutoff", "latest_operational_month"}
    if not required.issubset(result) or result["metric_units"] != METRIC_UNITS:
        raise ValueError("forecast artifact is missing required contract fields or metric units")
    for key in ("reason", "rule_version", "forecast_rule_version"):
        if not isinstance(result[key], str) or not result[key].strip():
            raise ValueError(f"{key} must be a nonempty string")
    if not isinstance(result["limitations"], list) or not all(isinstance(item, str) for item in result["limitations"]):
        raise ValueError("limitations must be a list of strings")
    if _date(result["data_cutoff"], "data_cutoff") > _date(result["scoring_date"], "scoring_date"):
        raise ValueError("data_cutoff must not be in the future")
    for key in ("months_missing", "months_used_for_training", "backtest_training_months"):
        if type(result[key]) is not int or result[key] < 0:
            raise ValueError(f"{key} must be a nonnegative integer")
    validate_min_months(result["min_months_required"])
    count = result["observed_operational_months"]
    if type(count) is not int or count < 0:
        raise ValueError("observed_operational_months must be a nonnegative integer")
    missing = max(0, result["min_months_required"] - count)
    if result["months_missing"] != missing:
        raise ValueError("forecast months_missing disagrees with the effective gate")
    if missing:
        if (result.get("forecast_status") != "insufficient_data" or result.get("forecast", "absent") is not None
                or result["scenarios"] is not None or result["confidence"] is not None
                or any(result[key] for key in ("forecast_months", "method_per_component", "baseline_vs_regression",
                                               "months_used_for_training", "backtest_training_months", "training_periods",
                                               "backtest_periods", "backtest_training_periods", "historical_std_per_component"))):
            raise ValueError("blocked forecast must contain null projections and zero training counts")
        return
    if (result.get("forecast_status") != ("low_confidence" if count < 18 else "ok")
            or result["confidence"] != ("low" if count < 18 else "medium")
            or result["months_used_for_training"] != count or result["backtest_training_months"] != count - 3):
        raise ValueError("forecast confidence or training counts disagree with observed history")
    training = result["training_periods"]
    if (not isinstance(training, list) or len(training) != count
            or any(not isinstance(month, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}", month) for month in training)):
        raise ValueError("training_periods must enumerate every final-fit observation")
    periods = pd.PeriodIndex(training, freq="M")
    _period_index(periods, "training periods")
    if (not periods.is_monotonic_increasing or (periods.to_timestamp() >= pd.Timestamp(result["data_cutoff"])).any()
            or result["backtest_periods"] != training[-3:]
            or result["backtest_training_periods"] != training[:-3]
            or result["latest_operational_month"] != training[-1]):
        raise ValueError("training and backtest periods must preserve the observed calendar split")
    expected_months = list(pd.period_range(pd.Period(result["scoring_date"], freq="M") + 1,
                                         periods=3, freq="M").astype(str))
    if result["forecast_months"] != expected_months or set(result["scenarios"]) != {"base", "favorable", "adverse"}:
        raise ValueError("forecast must have exactly three explicit target months and scenarios")
    for key in ("method_per_component", "baseline_vs_regression", "historical_std_per_component"):
        if set(result[key]) != set(se.COMPONENTS):
            raise ValueError(f"{key} must contain all four components")
    if any(type(value) not in (int, float) or value < 0 for value in result["historical_std_per_component"].values()):
        raise ValueError("historical standard deviations must be finite nonnegative numbers")
    for component, comparison in result["baseline_vs_regression"].items():
        if any(type(comparison[key]) not in (int, float) or comparison[key] < 0
               for key in ("regression_mae", "naive_mae")):
            raise ValueError("held-out MAEs must be finite nonnegative numbers")
        winner = "regression" if comparison["regression_mae"] < comparison["naive_mae"] else "naive"
        if comparison["winner"] != winner or result["method_per_component"][component] != winner:
            raise ValueError("selected method disagrees with held-out comparison")
    for scenario in result["scenarios"].values():
        if any(len(scenario[key]) != 3 for key in ("scores", "metrics", "score_details")):
            raise ValueError("all scenario arrays must have exactly three endpoints")
        for score, metrics, details in zip(scenario["scores"], scenario["metrics"], scenario["score_details"], strict=True):
            if type(score) not in (float, int) or not 0 <= score <= 100 or score != details["final_score"]:
                raise ValueError("scenario scores must reconcile with finite shared-engine scores")
            if set(metrics) != set(se.COMPONENTS) or any(
                type(value) not in (int, float) or not 0 <= value <= 100 for value in metrics.values()
            ):
                raise ValueError("scenario metrics must be four normalized scores in [0, 100]")
            if "confidence" in details or "evidence_records" in details:
                raise ValueError("projected rows must not create observed confidence or evidence")


def write_forecast(results_dir: str | Path, result: dict) -> Path:
    validate_forecast(result)
    text = json.dumps(result, indent=2, allow_nan=False) + "\n"
    directory = Path(results_dir) / "forecasts"
    if directory.is_symlink():
        raise ValueError("forecast output directory must not be a symlink")
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{result['company_id']}.json"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=directory,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    return path


def _unique_object(pairs: list[tuple[str, Any]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def run(data_dir: str | Path, results_dir: str | Path, company_id: str | None = None,
        min_months: int = 12) -> list[Path]:
    validate_min_months(min_months)
    root = Path(results_dir)
    reports = []
    for path in sorted((root / "companies").glob("*.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
            if not isinstance(report, dict) or _company_id(report.get("company_id")) != path.stem:
                raise ValueError("report filename does not match company identity")
            json.dumps(report, allow_nan=False)
        except (ValueError, OSError) as error:
            raise ValueError(f"input error at {path}: {error}") from error
        reports.append(report)
    if not reports:
        raise ValueError(f"no company reports at {root / 'companies'}; check --results-dir")
    if company_id is not None and _company_id(company_id) not in {r["company_id"] for r in reports}:
        raise ValueError(f"no report for {company_id}; check --company-id and --results-dir")
    config = se.load_config(DEFAULT_CONFIG)
    dataset = dp.build_dataset(data_dir)
    membership = operational_months(dp.load_transactions(Path(data_dir)), dp.load_currency_map(Path(data_dir)), dataset.cutoff)
    empty = pd.PeriodIndex([], freq="M")
    scored = sum(report.get("final_score") is not None for report in reports)
    qualified = sum(report.get("final_score") is not None and len(membership.get(report["company_id"], empty)) >= min_months
                    for report in reports)
    print(f"operational eligibility (>={min_months} months): {qualified} qualify / {scored} scored; "
          f"{len(reports)} reports; {len(reports) - scored} unscored", file=sys.stderr)
    if company_id is not None:
        count = len(membership.get(company_id, empty))
        print(f"selected {company_id}: {count} observed; {min_months} required; "
              f"{'eligible' if count >= min_months else 'insufficient_data'}", file=sys.stderr)
    for report in reports:
        validate_source(report, dataset, config)
    selected = [report for report in reports if company_id is None or report["company_id"] == company_id]
    forecasts = [forecast_company(report, dataset, membership.get(report["company_id"], empty), config, min_months)
                 for report in selected]
    paths = []
    try:
        for result in forecasts:
            paths.append(write_forecast(root, result))
    except (ValueError, OSError) as error:
        raise OSError(f"forecast publication failed after {len(paths)}/{len(forecasts)} artifacts: {error}") from error
    counts = dict(Counter(result["forecast_status"] for result in forecasts))
    print(f"forecast outcomes: {counts}", file=sys.stderr)
    methods = {component: dict(Counter(result["method_per_component"][component]
                                      for result in forecasts if result["method_per_component"]))
               for component in se.COMPONENTS}
    print(f"method selections: {methods}", file=sys.stderr)
    return paths
