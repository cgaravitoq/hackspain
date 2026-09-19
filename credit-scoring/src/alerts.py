from __future__ import annotations

import copy
import json
import os
import re
import tempfile
from collections import Counter
from datetime import date
from math import isfinite
from pathlib import Path
from typing import Any

import yaml

SEVERITIES = {
    "DETERIORATION_CONFIRMED": "HIGH",
    "DRIFT_DETECTED": "MEDIUM",
    "INSUFFICIENT_DATA": "INFO",
    "STALE_DATA": "MEDIUM",
    "LOW_COVERAGE": "LOW",
    "SCORE_FLOOR": "HIGH",
}
SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW", "INFO"]
TRAJECTORIES = {"stable", "improving", "deteriorating", "insufficient_data"}
PERSISTENCE = {"confirmed", "unconfirmed"}
DEFAULT_CONFIG = Path(__file__).resolve().parents[1] / "alert_config.yaml"


def _object(value: Any, label: str) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a nonempty string")
    return value


def _number(value: Any, label: str, low: float | None = None,
            high: float | None = None) -> int | float:
    if type(value) not in (int, float) or (type(value) is float and not isfinite(value)):
        raise ValueError(f"{label} must be a finite number, not a boolean")
    if (low is not None and value < low) or (high is not None and value > high):
        raise ValueError(f"{label} is outside the allowed range [{low}, {high}]")
    return value


def _integer(value: Any, label: str, minimum: int = 0) -> int:
    if type(value) is not int or value < minimum:
        raise ValueError(f"{label} must be an integer >= {minimum}, not a boolean")
    return value


def _choice(value: Any, choices: set[str], label: str) -> str:
    if not isinstance(value, str) or value not in choices:
        raise ValueError(f"{label} must be one of {sorted(choices)}")
    return value


def parse_date(value: Any) -> date:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("date must be a real ISO YYYY-MM-DD string")
    return date.fromisoformat(value)


def _month(value: Any) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}", value):
        raise ValueError("month must be a real ISO YYYY-MM string")
    parsed = parse_date(value + "-01")
    return parsed.year * 12 + parsed.month


def validate_config(raw: Any) -> dict:
    raw = _object(raw, "alert config")
    _text(raw.get("version"), "config.version")
    if raw.get("severity_order") != SEVERITY_ORDER:
        raise ValueError(f"severity_order must be {SEVERITY_ORDER}")
    rules = _object(raw.get("rules"), "config.rules")
    if set(rules) != set(SEVERITIES):
        raise ValueError(f"config.rules must contain exactly {list(SEVERITIES)}")
    for name, severity in SEVERITIES.items():
        rule = _object(rules[name], f"rules.{name}")
        if rule.get("severity") != severity:
            raise ValueError(f"{name} severity must be {severity}")
    categorical = rules["DETERIORATION_CONFIRMED"]
    _choice(categorical.get("trajectory"), TRAJECTORIES, "trajectory trigger")
    _choice(categorical.get("persistence"), PERSISTENCE, "persistence trigger")
    delta = _number(rules["DRIFT_DETECTED"].get("delta_threshold"), "delta_threshold")
    if delta >= 0:
        raise ValueError("delta_threshold must be negative")
    _integer(rules["INSUFFICIENT_DATA"].get("min_months_threshold"), "min_months_threshold")
    _integer(rules["STALE_DATA"].get("max_age_months"), "max_age_months")
    _number(rules["LOW_COVERAGE"].get("coverage_threshold"), "coverage_threshold", 0, 1)
    _number(rules["SCORE_FLOOR"].get("score_threshold"), "score_threshold", 0, 100)
    json.dumps(raw, allow_nan=False)
    return copy.deepcopy(raw)


def load_config(path: str | Path = DEFAULT_CONFIG) -> dict:
    return validate_config(yaml.safe_load(Path(path).read_text(encoding="utf-8")))


def _periods(value: Any, scoring_month: int, label: str) -> dict:
    periods = _object(value, label)
    for side in ("recent", "baseline"):
        months = periods.get(side)
        if not isinstance(months, list):
            raise ValueError(f"{label}.{side} must be a list of ISO months")
        for month in months:
            if _month(month) > scoring_month:
                raise ValueError(f"{label}.{side} contains future evidence: {month}")
        if len(set(months)) != len(months):
            raise ValueError(f"{label}.{side} contains duplicate months")
    if set(periods["recent"]) & set(periods["baseline"]):
        raise ValueError(f"{label} windows overlap")
    return periods


def _drift_metadata(value: Any, scoring_month: int, label: str) -> dict:
    metadata = _object(value, label)
    size = _integer(metadata.get("window_months"), f"{label}.window_months", 1)
    periods = _periods(metadata.get("periods_compared"), scoring_month, f"{label}.periods_compared")
    if type(metadata.get("fallback_used")) is not bool:
        raise ValueError(f"{label}.fallback_used must be boolean")
    if any(len(periods[side]) > size for side in ("recent", "baseline")):
        raise ValueError(f"{label} periods exceed the configured window")
    expected_fallback = any(len(periods[side]) < size for side in ("recent", "baseline"))
    if metadata["fallback_used"] != expected_fallback:
        raise ValueError(f"{label}.fallback_used disagrees with its periods")
    return metadata


def validate_report(report: Any) -> None:
    report = _object(report, "company report")
    json.dumps(report, allow_nan=False)
    company_id = _text(report.get("company_id"), "company_id")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", company_id):
        raise ValueError("company_id must be a safe alphanumeric ID with optional underscores or hyphens")
    scoring_date = parse_date(report.get("scoring_date"))
    scoring_month = scoring_date.year * 12 + scoring_date.month
    version = _text(report.get("rule_version"), "rule_version")
    _choice(report.get("trajectory"), TRAJECTORIES, "trajectory")
    _choice(report.get("persistence"), PERSISTENCE, "persistence")
    if "final_score" not in report:
        raise ValueError("final_score is required; null means unmeasured")
    if report["final_score"] is not None:
        _number(report["final_score"], "final_score", 0, 100)
    confidence = _object(report.get("confidence"), "confidence")
    _integer(confidence.get("months_available"), "confidence.months_available")
    if "coverage_pct" not in confidence:
        raise ValueError("confidence.coverage_pct is required; null means unknown")
    if confidence["coverage_pct"] is not None:
        _number(confidence["coverage_pct"], "confidence.coverage_pct", 0, 1)
    if "periods_compared" in report:
        _periods(report["periods_compared"], scoring_month, "periods_compared")
    if version.startswith("v2."):
        for key in ("latest_observed_month", "drift_detection"):
            if key not in report:
                raise ValueError(f"v2 report requires {key}")
    latest = report.get("latest_observed_month")
    if latest is not None and _month(latest) > scoring_month:
        raise ValueError("latest_observed_month is future evidence relative to scoring_date")
    if "drift_detection" in report:
        detection = _drift_metadata(report["drift_detection"], scoring_month, "drift_detection")
        status = _choice(detection.get("status"), {"ok", "insufficient_data"}, "drift_detection.status")
        _choice(detection.get("trajectory"), TRAJECTORIES, "drift_detection.trajectory")
        counts = _object(detection.get("actual_window_months"), "drift_detection.actual_window_months")
        for side in ("recent", "baseline"):
            count = _integer(counts.get(side), f"drift_detection.actual_window_months.{side}")
            if count != len(detection["periods_compared"][side]):
                raise ValueError("drift_detection counts disagree with periods")
        if status == "ok":
            _number(detection.get("delta"), "drift_detection.delta")
            if not all(detection["periods_compared"][side] for side in ("recent", "baseline")):
                raise ValueError("available drift requires both comparison windows")
            if detection["trajectory"] == "insufficient_data":
                raise ValueError("available drift cannot have an insufficient trajectory")
        elif ("delta" not in detection or detection["delta"] is not None
              or detection["trajectory"] != "insufficient_data"):
            raise ValueError("unavailable drift must have null delta and insufficient trajectory")
    flag = report.get("drift_alert")
    if flag is not None and flag is not False:
        flag = _drift_metadata(flag, scoring_month, "drift_alert")
        delta = _number(flag.get("delta"), "drift_alert.delta")
        threshold = _number(flag.get("threshold_used"), "drift_alert.threshold_used")
        if threshold >= 0 or delta >= threshold:
            raise ValueError("active drift_alert must deteriorate below its producer threshold")
        detection = report.get("drift_detection")
        if not detection or detection["status"] != "ok" or detection["trajectory"] != "deteriorating":
            raise ValueError("active drift_alert requires supporting deterioration metadata")
        for key in ("delta", "window_months", "periods_compared", "fallback_used"):
            if flag[key] != detection[key]:
                raise ValueError(f"drift_alert.{key} disagrees with drift_detection")


def _evidence(pointer: str, value: Any) -> dict:
    return {"pointer": pointer, "value": copy.deepcopy(value)}


def _evaluate(report: dict, config: dict) -> tuple[list[dict], list[dict]]:
    found, diagnostics = [], []
    rules = config["rules"]

    def emit(name, value, threshold, evidence, **extra):
        found.append({
            "company_id": report["company_id"], "alert_type": name,
            "severity": rules[name]["severity"], "trigger_value": value,
            "threshold_used": threshold, "scoring_date": report["scoring_date"],
            "rule_version": report["rule_version"], "alert_rule_version": config["version"],
            "final_score": report["final_score"], "evidence": evidence, **extra,
        })

    def unknown(name, reason):
        diagnostics.append({"company_id": report["company_id"], "alert_type": name,
                            "status": "unevaluable", "reason": reason})

    name = "DETERIORATION_CONFIRMED"
    fields = ("trajectory", "persistence")
    if all(report[key] == rules[name][key] for key in fields):
        emit(name, {key: report[key] for key in fields}, {key: rules[name][key] for key in fields},
             [_evidence(f"/{key}", report[key]) for key in fields])

    name = "DRIFT_DETECTED"
    detection, flag = report.get("drift_detection"), report.get("drift_alert")
    if detection is None:
        unknown(name, "drift metadata absent; legacy drift cannot be evaluated")
    elif detection["status"] == "insufficient_data":
        unknown(name, "source drift comparison has insufficient data")
    elif isinstance(flag, dict) and flag["delta"] < rules[name]["delta_threshold"]:
        emit(name, flag["delta"], rules[name]["delta_threshold"], [
            _evidence("/drift_alert", flag),
            _evidence("/drift_detection/delta", detection["delta"]),
            _evidence("/drift_detection/periods_compared", detection["periods_compared"]),
        ])

    name = "INSUFFICIENT_DATA"
    months = report["confidence"]["months_available"]
    if months < rules[name]["min_months_threshold"]:
        emit(name, months, rules[name]["min_months_threshold"],
             [_evidence("/confidence/months_available", months)])

    name = "STALE_DATA"
    latest, pointer = report.get("latest_observed_month"), "/latest_observed_month"
    if "latest_observed_month" not in report and "drift_detection" not in report:
        recent = report.get("periods_compared", {}).get("recent", [])
        if recent:
            index = max(range(len(recent)), key=lambda i: _month(recent[i]))
            latest, pointer = recent[index], f"/periods_compared/recent/{index}"
    if latest is None:
        unknown(name, "latest observed month unavailable; stale age is unknown")
    else:
        age = _month(report["scoring_date"][:7]) - _month(latest)
        if age > rules[name]["max_age_months"]:
            emit(name, age, rules[name]["max_age_months"], [
                _evidence("/scoring_date", report["scoring_date"]), _evidence(pointer, latest),
            ], calculation={"age_months": age, "latest_month_source": pointer,
                            "method": "calendar_month_difference"})

    for name, value, threshold, pointer in (
        ("LOW_COVERAGE", report["confidence"]["coverage_pct"], "coverage_threshold", "/confidence/coverage_pct"),
        ("SCORE_FLOOR", report["final_score"], "score_threshold", "/final_score"),
    ):
        if value is None:
            unknown(name, f"{pointer} is null; not measured")
        elif value < rules[name][threshold]:
            emit(name, value, rules[name][threshold], [_evidence(pointer, value)])
    return found, diagnostics


def sort_alerts(items: list[dict], config: dict) -> list[dict]:
    ranks = {severity: index for index, severity in enumerate(config["severity_order"])}
    return sorted(items, key=lambda item: (
        ranks[item["severity"]], item["final_score"] is None,
        item["final_score"] if item["final_score"] is not None else 0,
        item["company_id"], item["alert_type"],
    ))


def evaluate_company(report: dict, config: dict) -> tuple[list[dict], list[dict]]:
    return evaluate_batch([report], config)


def evaluate_batch(reports: list[dict], config: dict) -> tuple[list[dict], list[dict]]:
    config = validate_config(config)
    found, diagnostics, seen = [], [], set()
    for report in reports:
        validate_report(report)
        company_id = report["company_id"]
        if company_id in seen:
            raise ValueError(f"duplicate company_id: {company_id}")
        seen.add(company_id)
        matches, unavailable = _evaluate(report, config)
        found.extend(matches)
        diagnostics.extend(unavailable)
    return sort_alerts(found, config), sorted(diagnostics, key=lambda item: (item["company_id"], item["alert_type"]))


def _unique_object(pairs: list[tuple[str, Any]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _atomic_write(path: Path, text: str) -> None:
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def run(results_dir: str | Path, config_path: str | Path = DEFAULT_CONFIG,
        generated_on: str | None = None) -> tuple[list[dict], list[dict], Path]:
    config = load_config(config_path)
    generated = parse_date(generated_on) if generated_on is not None else date.today()
    root = Path(results_dir)
    companies = root / "companies"
    if not companies.is_dir():
        raise ValueError(f"company report directory does not exist: {companies}")
    reports, paths = [], []
    for path in sorted(companies.glob("*.json")):
        try:
            if path.is_symlink():
                raise ValueError("company report symlinks are not supported")
            report = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
            validate_report(report)
            if path.stem != report["company_id"]:
                raise ValueError("filename does not match company_id")
        except (ValueError, OSError) as error:
            raise ValueError(f"input error at {path}: {error}") from error
        reports.append(report)
        paths.append(path)
    found, diagnostics = evaluate_batch(reports, config)
    by_company = {report["company_id"]: [] for report in reports}
    for item in found:
        by_company[item["company_id"]].append(item)
    serialized = [json.dumps(report | {"alerts": by_company[report["company_id"]]},
                             indent=2, allow_nan=False) + "\n" for report in reports]
    aggregate = json.dumps(found, indent=2, allow_nan=False) + "\n"
    output = root / f"alerts_{generated.isoformat().replace('-', '')}.json"
    completed = 0
    target = output
    try:
        for target, text in zip(paths, serialized, strict=True):
            _atomic_write(target, text)
            completed += 1
        target = output
        _atomic_write(output, aggregate)
    except OSError as error:
        raise OSError(f"partial write failure at {target}: {completed}/{len(paths)} company reports "
                      f"replaced; aggregate not published by this run: {error}") from error
    return found, diagnostics, output


def summary_table(items: list[dict]) -> str:
    types = Counter(item["alert_type"] for item in items)
    severities = Counter(item["severity"] for item in items)
    lines = ["ALERT_TYPE\tSEVERITY\tCOUNT"]
    lines.extend(f"{name}\t{severity}\t{types[name]}" for name, severity in SEVERITIES.items())
    lines.extend(f"TOTAL\t{severity}\t{severities[severity]}" for severity in SEVERITY_ORDER)
    lines.append(f"TOTAL\tALL\t{len(items)}")
    return "\n".join(lines)
