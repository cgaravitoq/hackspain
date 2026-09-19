"""Deterministic four-layer treasury health score.

Layer 1 is a weighted scorecard over the last three observed months. Layer 2
compares that window against the three observed months before it. Layer 3 only
confirms a direction when the previous endpoint moved the same way. Layer 4
describes how much evidence there is and never touches the score.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from math import isfinite
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml

from .data_pipeline import Dataset, build_dataset

COMPONENTS = ("inflow_outflow_ratio", "chargeback_score", "fee_score", "debt_score")

WINDOW = 3
# Reconciliation slack for `sum(contributions) == trajectory_adjustment`, wide
# enough for the 4-decimal rounding applied on export and nothing else.
TOLERANCE = 1e-3

RATIO_CAP = 2.0
CHARGEBACK_PENALTY = 20.0
FEE_PENALTY = 10.0
DEBT_PENALTY = 5.0


@dataclass(frozen=True)
class Config:
    version: str
    weights: dict[str, float]
    improving: float
    deteriorating: float
    complete_month: int
    max_adjustment: float
    raw: dict[str, Any]
    windows: dict[str, int] = field(default_factory=lambda: {"short": 3, "medium": 6, "long": 9})
    comparison_horizons: dict[str, str] = field(
        default_factory=lambda: {"primary": "short", "drift_detection": "long"}
    )
    evaluation_frequency: str = "monthly"
    min_months_for_window: int = 4

    def __post_init__(self) -> None:
        if not isinstance(self.windows, dict) or not self.windows:
            raise ValueError("windows must map names to positive integer sizes")
        if any(
            not isinstance(name, str) or not name or type(size) is not int or size < 1
            for name, size in self.windows.items()
        ):
            raise ValueError("window sizes must be positive integers (not booleans)")
        if not isinstance(self.comparison_horizons, dict) or any(
            not isinstance(self.comparison_horizons.get(horizon), str)
            or self.comparison_horizons[horizon] not in self.windows
            for horizon in ("primary", "drift_detection")
        ):
            raise ValueError("primary and drift_detection must reference known windows")
        if type(self.min_months_for_window) is not int or self.min_months_for_window < 2:
            raise ValueError("min_months_for_window must be an integer of at least 2")
        if self.evaluation_frequency != "monthly":
            raise ValueError("evaluation_frequency only supports monthly")

    @property
    def primary_window(self) -> int:
        return self.windows[self.comparison_horizons["primary"]]

    @property
    def drift_window(self) -> int:
        return self.windows[self.comparison_horizons["drift_detection"]]

    @property
    def rule_version(self) -> str:
        return f"{self.version}-w{self.primary_window}-h{self.drift_window}"


def load_config(path: str | Path) -> Config:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    weights = {name: float(raw["weights"][name]) for name in COMPONENTS}
    if any(not isfinite(weight) or weight < 0 for weight in weights.values()):
        raise ValueError("weights must be finite and nonnegative")
    total = sum(weights.values())
    if abs(total - 1.0) > 1e-9:
        raise ValueError(f"weights must sum to 1.0, got {total}")
    thresholds = raw["thresholds"]
    config = Config(
        version=str(raw["version"]),
        weights=weights,
        improving=float(thresholds["improving"]),
        deteriorating=float(thresholds["deteriorating"]),
        complete_month=int(thresholds["complete_month"]),
        max_adjustment=float(thresholds["max_adjustment"]),
        raw=raw,
        windows=raw.get("windows", {"short": 3, "medium": 6, "long": 9}),
        comparison_horizons=raw.get(
            "comparison_horizons", {"primary": "short", "drift_detection": "long"}
        ),
        evaluation_frequency=raw.get("evaluation_frequency", "monthly"),
        min_months_for_window=raw.get("min_months_for_window", 4),
    )
    if not all(isfinite(value) for value in (config.improving, config.deteriorating)):
        raise ValueError("direction thresholds must be finite")
    if config.improving <= 0 or config.deteriorating >= 0:
        raise ValueError("improving must be positive and deteriorating negative")
    if not 0 < config.max_adjustment <= 10:
        raise ValueError("max_adjustment must be in (0, 10]")
    if config.complete_month < 1:
        raise ValueError("complete_month must be at least 1")
    return config


def monthly_component_scores(features: pd.DataFrame) -> pd.DataFrame:
    """Normalize every observed month to four 0-100 component scores."""
    inflow = features["operational_inflow"]
    outflow = features["operational_outflow"]
    ratio = pd.Series(1.0, index=features.index, dtype=float)
    ratio = ratio.where(~((outflow == 0) & (inflow > 0)), RATIO_CAP)
    positive = outflow > 0
    ratio[positive] = inflow[positive] / outflow[positive]

    scores = pd.DataFrame(index=features.index)
    scores["inflow_outflow_ratio"] = (ratio / RATIO_CAP).clip(upper=1.0) * 100
    scores["chargeback_score"] = (
        1 - (features["chargeback_rate"] * CHARGEBACK_PENALTY).clip(upper=1.0)
    ) * 100
    scores["fee_score"] = (1 - (features["fee_ratio"] * FEE_PENALTY).clip(upper=1.0)) * 100
    scores["debt_score"] = (
        1 - (features["debt_interest_ratio"] * DEBT_PENALTY).clip(upper=1.0)
    ) * 100
    return scores


def _window_average(scores: pd.DataFrame, months: list[pd.Period]) -> dict[str, float]:
    window = scores.loc[months]
    return {component: float(window[component].mean()) for component in COMPONENTS}


def _weighted(averages: dict[str, float], weights: dict[str, float]) -> float:
    return sum(weights[component] * averages[component] for component in COMPONENTS)


def _direction(delta: float, config: Config) -> str:
    if delta > config.improving:
        return "improving"
    if delta < config.deteriorating:
        return "deteriorating"
    return "stable"


def _validate_component_history(scores: pd.DataFrame) -> None:
    if not isinstance(scores, pd.DataFrame) or len(scores.columns) != len(COMPONENTS):
        raise ValueError("component_scores must contain exactly the four component columns")
    if set(scores.columns) != set(COMPONENTS):
        raise ValueError("component_scores must contain exactly the four component columns")
    if (
        not isinstance(scores.index, pd.PeriodIndex)
        or scores.index.freqstr != "M"
        or not scores.index.is_unique
        or scores.index.hasnans
    ):
        raise ValueError("component_scores must have unique, nonmissing monthly periods")
    if scores.empty:
        return
    if any(
        not pd.api.types.is_numeric_dtype(dtype)
        or pd.api.types.is_bool_dtype(dtype)
        or pd.api.types.is_complex_dtype(dtype)
        for dtype in scores.dtypes
    ):
        raise ValueError("component scores must be finite numeric values in [0, 100]")
    values = scores.to_numpy(dtype=float, na_value=np.nan)
    if not np.isfinite(values).all() or (values < 0).any() or (values > 100).any():
        raise ValueError("component scores must be finite numeric values in [0, 100]")


def _comparison(
    scores: pd.DataFrame, size: int, config: Config
) -> dict[str, Any]:
    months = list(scores.index)
    available = len(months) >= config.min_months_for_window
    recent_size = min(size, len(months) - 1) if available else min(size, len(months))
    recent = months[-recent_size:] if recent_size else []
    baseline = months[-recent_size - size : -recent_size] if available else []
    recent_avg = _window_average(scores, recent) if recent else None
    baseline_avg = _window_average(scores, baseline) if baseline else None
    delta = (
        _weighted(recent_avg, config.weights) - _weighted(baseline_avg, config.weights)
        if baseline else None
    )
    return {
        "recent": recent,
        "baseline": baseline,
        "recent_average": recent_avg,
        "baseline_average": baseline_avg,
        "delta": delta,
        "trajectory": _direction(delta, config) if delta is not None else "insufficient_data",
        "fallback_used": len(recent) < size or len(baseline) < size,
    }


def _periods_compared(comparison: dict[str, Any]) -> dict[str, list[str]]:
    return {side: [str(month) for month in comparison[side]] for side in ("recent", "baseline")}


def score_component_history(component_scores: pd.DataFrame, config: Config) -> dict[str, Any]:
    _validate_component_history(component_scores)
    scores = component_scores.sort_index()
    months = list(scores.index)
    primary = _comparison(scores, config.primary_window, config)
    drift = _comparison(scores, config.drift_window, config)
    recent, baseline = primary["recent"], primary["baseline"]
    recent_avg = primary["recent_average"]
    base_score = _weighted(recent_avg, config.weights) if recent else None

    # Layer 2: at least four observed months, so the baseline has something
    # real in it. Observed months are used as they are; gaps are not bridged
    # and never filled with zeros.
    delta = primary["delta"]
    trajectory = primary["trajectory"]
    changes = {
        component: recent_avg[component] - primary["baseline_average"][component]
        for component in COMPONENTS
    } if baseline else {}
    persistence = _persistence(months, scores, trajectory, config)

    if persistence == "confirmed":
        raw_adjustment = max(-config.max_adjustment, min(config.max_adjustment, delta))
    else:
        raw_adjustment = 0.0
    final_score = (
        max(0.0, min(100.0, base_score + raw_adjustment)) if base_score is not None else None
    )
    # Effective adjustment after capping and 0-100 clipping, so that
    # base_score + trajectory_adjustment == final_score by construction.
    adjustment = final_score - base_score if base_score is not None else 0.0

    scale = adjustment / delta if raw_adjustment and delta else 0.0
    signals = [
        {
            "component": component,
            "change": _clean(changes[component]),
            "contribution": _clean(config.weights[component] * changes[component] * scale),
        }
        for component in COMPONENTS
        if changes
    ]
    reconciliation = sum(signal["contribution"] for signal in signals)
    if abs(reconciliation - adjustment) > TOLERANCE:
        raise AssertionError(
            f"contributions {reconciliation} do not reconcile with {adjustment}"
        )

    limitations = []
    window_usage = {}
    for name, comparison, size in (
        ("primary", primary, config.primary_window),
        ("drift_detection", drift, config.drift_window),
    ):
        counts = {side: len(comparison[side]) for side in ("recent", "baseline")}
        window_usage[name] = {
            "configured_months": size,
            "recent_months": counts["recent"],
            "baseline_months": counts["baseline"],
            "fallback_used": comparison["fallback_used"],
        }
        if comparison["fallback_used"]:
            limitations.append(
                f"{name} shortened windows: configured {size} observed months per side; "
                f"actual recent {counts['recent']}, baseline {counts['baseline']}"
            )
        if comparison["delta"] is None:
            limitations.append(
                f"{name} comparison unavailable: {len(months)} observed months, "
                f"{config.min_months_for_window} required"
            )
    if trajectory == "insufficient_data":
        limitations.append(
            f"trajectory unavailable: {len(months)} observed months, "
            f"{config.min_months_for_window} required"
        )
    if any(right.ordinal - left.ordinal > 1 for left, right in zip(months, months[1:])):
        limitations.append("observations span calendar gaps; windows use observed months without zero filling")
    if persistence == "confirmed":
        shared_window = "quarter" if config.primary_window == 3 else "window"
        limitations.append(
            f"persistence windows share the baseline {shared_window}; the two comparisons "
            "are consecutive endpoints, not independent samples"
        )
    if config.primary_window != 3:
        limitations.append(
            "legacy explainer uses fixed three-month/quarter wording; for this nondefault "
            "primary window use periods_compared and window_usage instead"
        )
    limitations.append(
        "component averages, base contributions and signals are exported to four decimal "
        "places; base contributions reconcile to the unrounded base within 0.001 points; "
        "comparison deltas retain calculation precision for directional thresholds"
    )
    drift_detection = {
        "status": "ok" if drift["delta"] is not None else "insufficient_data",
        "window_months": config.drift_window,
        "delta": drift["delta"],
        "trajectory": drift["trajectory"],
        "periods_compared": _periods_compared(drift),
        "actual_window_months": {side: len(drift[side]) for side in ("recent", "baseline")},
        "fallback_used": drift["fallback_used"],
    }
    result = {
        "base_score": round(base_score, 1) if base_score is not None else None,
        "trajectory": trajectory,
        "persistence": persistence,
        "trajectory_adjustment": round(adjustment, 1),
        "final_score": round(final_score, 1) if final_score is not None else None,
        "signals": signals,
        "periods_compared": _periods_compared(primary),
        "primary_delta": delta,
        "latest_observed_month": str(months[-1]) if months else None,
        "component_summary": {
            component: {
                "weight": config.weights[component],
                "recent_average": _clean(recent_avg[component]) if recent else None,
                "base_contribution": _clean(config.weights[component] * recent_avg[component])
                if recent else None,
            }
            for component in COMPONENTS
        },
        "window_usage": window_usage,
        "rule_version": config.rule_version,
        "drift_detection": drift_detection,
        "limitations": limitations,
    }
    if trajectory in {"stable", "improving"} and drift["trajectory"] == "deteriorating":
        result["drift_alert"] = {
            key: drift_detection[key]
            for key in ("delta", "window_months", "periods_compared", "fallback_used")
        } | {"threshold_used": config.deteriorating}
    return result


def score_company(
    company_id: str,
    features: pd.DataFrame,
    exclusions: dict[str, int],
    config: Config,
    scoring_date: date,
    system_no_category: int,
    cutoff: pd.Timestamp,
) -> dict[str, Any]:
    """Score one company from its observed months. `features` is period-indexed."""
    features = features.sort_index()
    scores = monthly_component_scores(features)
    if scores.empty:
        scores.index = pd.PeriodIndex([], freq="M", name=features.index.name)
    result = score_component_history(scores, config)
    confidence = _confidence(features, config)
    limitations = _limitations(config, system_no_category, cutoff) + result["limitations"]
    recent = [pd.Period(month, freq="M") for month in result["periods_compared"]["recent"]]
    baseline = [pd.Period(month, freq="M") for month in result["periods_compared"]["baseline"]]
    evidence_months = sorted(set(recent) | set(baseline))
    evidence_count = int(features.loc[evidence_months, "total_transactions"].sum())
    if not recent:
        confidence["currency_scope"] = "insufficient"
        limitations.append("no EUR operational month observed before the cutoff; score not measured")
    last_closed = (cutoff - pd.Timedelta(days=1)).to_period("M")
    if recent and recent[-1] < last_closed:
        limitations.append(
            f"latest observed month is {recent[-1]}, before the last closed month "
            f"{last_closed}: the score describes stale activity, not current health"
        )
    # August and December are holiday months in this population; a drop that
    # lands on them is flagged, never silently corrected.
    seasonal = [str(period) for period in recent if period.month in (8, 12)]
    if seasonal and result["trajectory"] == "deteriorating":
        limitations.append(
            f"recent window contains potentially seasonal month(s) {', '.join(seasonal)}; "
            "deterioration is not seasonally adjusted"
        )
    return result | {
        "company_id": company_id,
        "scoring_date": scoring_date.isoformat(),
        "data_cutoff": cutoff.date().isoformat(),
        "confidence": confidence,
        "evidence_records": {
            "count": evidence_count,
            "date_range": _range_label(evidence_months),
            "excluded_unknown_product": exclusions["excluded_unknown_product"],
            "excluded_non_eur": exclusions["excluded_non_eur"],
            "excluded_no_category": exclusions["excluded_no_category"],
        },
        "limitations": limitations,
    }


def _persistence(
    months: list[pd.Period], scores: pd.DataFrame, trajectory: str, config: Config
) -> str:
    """Repeat the comparison one quarter back and require the same direction."""
    if trajectory in {"insufficient_data", "stable"}:
        return "unconfirmed"
    size = config.primary_window
    prior_recent = months[-2 * size : -size]
    prior_baseline = months[-3 * size : -2 * size]
    if (
        not prior_baseline
        or len(prior_recent) < size
        or len(months) - size < config.min_months_for_window
    ):
        return "unconfirmed"
    prior_delta = _weighted(_window_average(scores, prior_recent), config.weights) - _weighted(
        _window_average(scores, prior_baseline), config.weights
    )
    return "confirmed" if _direction(prior_delta, config) == trajectory else "unconfirmed"


def _confidence(features: pd.DataFrame, config: Config) -> dict[str, Any]:
    months_available = int(len(features))
    months_complete = int((features["total_transactions"] >= config.complete_month).sum())
    coverage = round(months_complete / months_available, 2) if months_available else None
    return {
        "months_available": months_available,
        "months_complete": months_complete,
        "coverage_pct": coverage,
        "currency_scope": "EUR_only",
    }


def _limitations(config: Config, system_no_category: int, cutoff: pd.Timestamp) -> list[str]:
    return [
        "transfer category excluded (ambiguous internal/external)",
        f"{system_no_category} transactions system-wide have no usable category",
        f"months_complete threshold set at {config.complete_month} transactions (not validated)",
        f"scoring cutoff {cutoff.date().isoformat()}: the trailing partial calendar month "
        "is excluded, not scored as a short month",
        "settlement and investment categories count as evidence but feed no component; "
        "the audit could not prove they are operational",
        "amounts are EUR product-currency only; no FX conversion and no non-EUR activity",
    ]


def _clean(value: float) -> float:
    rounded = round(value, 4)
    return rounded if rounded else 0.0


def _range_label(months: list[pd.Period]) -> str | None:
    if not months:
        return None
    return f"{months[0]} to {months[-1]}"


def score_dataset(
    dataset: Dataset,
    config: Config,
    scoring_date: date,
    company_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    features = dataset.features
    by_company = {
        company_id: frame.droplevel("company_id")
        for company_id, frame in features.groupby(level="company_id")
    }
    empty_features = features.iloc[0:0].droplevel("company_id")
    known = set(by_company) | set(dataset.exclusions.index)
    targets = sorted(known if company_ids is None else set(company_ids))
    empty = {column: 0 for column in dataset.exclusions.columns}

    results = []
    for company_id in targets:
        company_features = by_company.get(company_id, empty_features)
        exclusions = (
            dataset.exclusions.loc[company_id].to_dict()
            if company_id in dataset.exclusions.index
            else empty
        )
        results.append(
            score_company(
                company_id=company_id,
                features=company_features,
                exclusions={key: int(value) for key, value in exclusions.items()},
                config=config,
                scoring_date=scoring_date,
                system_no_category=dataset.totals["no_category_system"],
                cutoff=dataset.cutoff,
            )
        )
    return results


def run(
    data_dir: str | Path,
    config_path: str | Path,
    scoring_date: date,
    company_ids: list[str] | None = None,
) -> tuple[list[dict[str, Any]], Dataset]:
    config = load_config(config_path)
    dataset = build_dataset(data_dir)
    return score_dataset(dataset, config, scoring_date, company_ids), dataset
