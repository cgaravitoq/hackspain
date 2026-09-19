from __future__ import annotations

import json
import math
import re
from datetime import date
from pathlib import Path

from src.copilot import validate_artifacts

__all__ = [
    "format_score", "load_company_data", "months_to_spanish", "persistence_to_spanish",
    "safe_get", "score_to_color", "trajectory_to_spanish",
]


def _number(value, low=None, high=None):
    try:
        valid = type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        valid = False
    if not valid or (low is not None and value < low) or (high is not None and value > high):
        raise ValueError(f"Expected a finite number in [{low}, {high}].")
    return value


def score_to_color(score):
    if score is None:
        return "#6B7280"
    _number(score, 0, 100)
    for upper, color in ((40, "#E53935"), (65, "#FFB300"), (85, "#00C9B1"), (100, "#1DB954")):
        if score <= upper:
            return color


def trajectory_to_spanish(trajectory):
    labels = {"improving": "Mejorando", "deteriorating": "Empeorando",
              "stable": "Estable", "insufficient_data": "Datos insuficientes"}
    return labels.get(trajectory, "No disponible") if isinstance(trajectory, str) else "No disponible"


def persistence_to_spanish(persistence):
    labels = {"confirmed": "Confirmada", "unconfirmed": "Sin confirmar"}
    return labels.get(persistence, "No disponible") if isinstance(persistence, str) else "No disponible"


def format_score(score):
    return "—" if score is None else f"{_number(score, 0, 100):.1f}"


def safe_get(d, *keys, default="—"):
    for key in keys:
        if not isinstance(d, dict):
            return default
        d = d.get(key)
    return default if d is None else d


def months_to_spanish(month_str):
    if not isinstance(month_str, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}", month_str):
        raise ValueError("Month must use YYYY-MM.")
    month = date.fromisoformat(month_str + "-01")
    labels = ("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
    return f"{labels[month.month - 1]} {month.year:04d}"


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def _read_artifact(path):
    try:
        document = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
        json.dumps(document, allow_nan=False)
        if not isinstance(document, dict):
            raise TypeError("An artifact must be a JSON object.")
        return document
    except (OSError, UnicodeError, ValueError, TypeError, RecursionError) as error:
        raise ValueError(f"Invalid artifact {path}: {error}") from error


def _artifact_path(root, folder, filename):
    directory = root / folder
    path = directory / filename
    if (directory.is_symlink() or path.is_symlink()
            or not directory.resolve().is_relative_to(root)
            or not path.resolve().is_relative_to(directory.resolve())):
        raise ValueError(f"Artifact path escapes the selected root or is a symbolic link: {path}")
    return path


def _validate_display_evidence(company, forecast):
    evidence = company.get("evidence_records")
    if not isinstance(evidence, dict):
        raise TypeError("Required company evidence_records must be an object.")
    for key in ("count", "excluded_no_category", "excluded_non_eur", "excluded_unknown_product"):
        if type(evidence.get(key)) is not int or evidence[key] < 0:
            raise ValueError(f"Missing or invalid evidence_records.{key}.")
    for key in ("forecast_months", "training_periods", "backtest_periods", "backtest_training_periods"):
        if not isinstance(forecast.get(key), list):
            raise TypeError(f"forecast.{key} must be an array, including when unavailable.")
    for key in ("method_per_component", "baseline_vs_regression", "historical_std_per_component", "provenance"):
        if not isinstance(forecast.get(key), dict):
            raise TypeError(f"forecast.{key} must be an object.")
    scenarios = forecast.get("scenarios")
    if scenarios is not None:
        if not isinstance(scenarios, dict):
            raise ValueError("forecast.scenarios must be an object or null.")
        for scenario in scenarios.values():
            if not isinstance(scenario, dict) or any(
                not isinstance(scenario.get(key), list) for key in ("scores", "metrics", "score_details")
            ):
                raise ValueError("Each scenario requires scores, metrics and score_details arrays.")
    validate_artifacts(company, forecast)
    provenance = forecast["provenance"]
    version_sizes = re.search(r"-w([0-9]+)-h([0-9]+)$", company["rule_version"]).groups()
    for name, version_size in zip(("primary", "drift_detection"), version_sizes, strict=True):
        configured = provenance["windows"][provenance["comparison_horizons"][name]]
        usage = company["window_usage"][name]
        if (type(configured) is not int or configured <= 0 or configured != int(version_size)
                or usage["configured_months"] != configured
                or any(not 0 <= usage[f"{side}_months"] <= configured for side in ("recent", "baseline"))):
            raise ValueError(f"Forecast configuration, observed windows and rule version disagree for {name}.")
    confidence = company["confidence"]
    available, complete = confidence["months_available"], confidence["months_complete"]
    expected = round(complete / available, 2) if available else None
    if confidence["coverage_pct"] != expected:
        raise ValueError("Observed coverage disagrees with the exact month counts.")
    if company["signals"] and {s["component"] for s in company["signals"]} != set(company["component_summary"]):
        raise ValueError("A measured comparison requires evidence for all four components.")


def load_company_data(company_id, results_dir):
    if not isinstance(company_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", company_id):
        raise ValueError("company_id must be an alphanumeric identifier, not a path.")
    root = Path(results_dir).resolve()
    if not root.is_dir():
        raise ValueError(f"Results directory does not exist: {root}")
    company_path = _artifact_path(root, "companies", f"{company_id}.json")
    forecast_paths = [_artifact_path(root, "forecasts", f"{company_id}{suffix}.json")
                      for suffix in ("_forecast", "")]
    existing = [path for path in forecast_paths if path.is_file()]
    if not existing:
        raise ValueError(f"Missing forecast artifact; this is not insufficient_data. Expected: {forecast_paths}")
    company = _read_artifact(company_path)
    if company.get("company_id") != company_id:
        raise ValueError(f"Company identity does not match {company_path}.")
    forecasts = [_read_artifact(path) for path in existing]
    if any(document != forecasts[0] for document in forecasts[1:]):
        raise ValueError(f"Ambiguous conflicting forecast artifacts: {existing}")
    for forecast in forecasts:
        try:
            _validate_display_evidence(company, forecast)
        except (ValueError, TypeError, KeyError, IndexError, AttributeError, OverflowError) as error:
            raise ValueError(f"Incompatible artifacts for {company_id} in {root}: {error}") from error
    return {
        "company": company,
        "forecast": forecasts[0],
        "source_paths": {"company": str(company_path), "forecast": str(existing[0]), "results_dir": str(root)},
    }
