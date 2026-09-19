from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import uuid
import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from src.copilot import _limitation_sources, pointer_value
from templates import design_system as ds
from templates import template_financiero as financial
from templates import template_sales as sales
from templates import template_tesorero as treasury
from templates.pdf_utils import load_company_data
from templates.template_financiero import render_report as render_financial
from templates.template_sales import render_report as render_sales
from templates.template_tesorero import render_report as render_treasury

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "results-v2-agent6-20260919"
OUTPUT = ROOT / "results/reports"
REPORT_DATE = "2026-09-19"
COMPANIES = ("COMP_0216", "COMP_0874", "COMP_0114")
RENDERERS = {"tesorero": render_treasury, "financiero": render_financial, "sales": render_sales}
MODULES = {"tesorero": treasury, "financiero": financial, "sales": sales}
NARRATIVES = OUTPUT / "AGENT14_narratives_20260919.json"
MANIFEST = OUTPUT / "AGENT14_manifest_20260919.json"
READ_SNAPSHOT = {
    "templates/design_system.py": "5dc48f060783915ecb11090f74cf02a1ed24c5519760565527e4e38dad34d2a3",
    "templates/pdf_utils.py": "63a16da5b3bdd0067fe22a109aede016dc582867449107095c1b18fb93299f4b",
    "templates/template_tesorero.py": "fbcd2bc30d6b05bb57a83820a1c0b248885d6d06ffe606f82cfd497a691952ad",
    "templates/template_financiero.py": "b1d792fb8a25e0e07d56f972606a471bb38977a9781ada45ffb29f592cb96b92",
    "templates/template_sales.py": "62f9110e655b52bae827b55897393a63731e2925de11e73119165386cc3a529b",
    "results-v2-agent6-20260919/companies/COMP_0216.json": "a74950b9b43496104625bfa37c3d40898849ee68c09b2bb64bc3e933e825530f",
    "results-v2-agent6-20260919/forecasts/COMP_0216.json": "888bb123e8f61f10e277c110d0d520ba43a83b115d0e487ee08ee1aea5f247e7",
    "results-v2-agent6-20260919/companies/COMP_0874.json": "fc870dc085606a6713d9bf4f378e9d5ec055d631fd694f0cd557d75fc7d500bf",
    "results-v2-agent6-20260919/forecasts/COMP_0874.json": "66bf2dec4ad9b228658a34f0fb7b2be07cc8c7185bce5aa4907fe8551463c727",
    "results-v2-agent6-20260919/companies/COMP_0114.json": "87cf22c6522523e02d26f1c0fb75431f0ef601078a640412730d39567fc90958",
    "results-v2-agent6-20260919/forecasts/COMP_0114.json": "1a3201c75489fdb36508ea2d416f242ed5158022b6b121cff46e8f9534c420f5",
}
HISTORY_SOURCES = [f"forecast:/{key}" for key in (
    "forecast_status", "observed_operational_months", "min_months_required", "months_missing", "reason",
)]
COVERAGE_SOURCES = [f"company:/confidence/{key}" for key in (
    "months_complete", "months_available", "coverage_pct",
)] + ["company:/evidence_records/count", "company:/evidence_records/date_range"]
TREND_SOURCES = ["company:/trajectory", "company:/persistence"]
BASE_FORECAST_SOURCES = ["company:/final_score", "forecast:/forecast_months", "forecast:/scenarios/base/scores",
                         "forecast:/confidence", "forecast:/forecast_status"]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def check_snapshot():
    for relative, expected in READ_SNAPSHOT.items():
        require(digest(ROOT / relative) == expected, f"Snapshot changed since mandatory reading: {relative}")


def item(text, sources, operation="Translate the cited observed fields into Spanish without causal inference.", policy=None):
    evidence = {"sources": sources, "operation": operation}
    if policy:
        evidence["policy"] = policy
    return text, evidence


def signal_sources(index):
    return [f"company:/signals/{index}/{key}" for key in ("component", "change", "contribution")]


def envelope(company_id, role, fields):
    sections, evidence = {}, {}
    for key, value in fields.items():
        if isinstance(value, list):
            sections[key] = [entry[0] for entry in value]
            evidence.update({f"sections.{key}[{index}]": entry[1] for index, entry in enumerate(value)})
        else:
            sections[key], evidence[f"sections.{key}"] = value
    return {"company_id": company_id, "role": role, "sections": sections, "evidence": evidence}


def history_text(data):
    forecast = data["forecast"]
    missing = forecast["months_missing"]
    return (f"No hay proyección: {forecast['observed_operational_months']} meses operativos EUR disponibles "
            f"de {forecast['min_months_required']} requeridos; "
            + (f"falta {missing} mes." if missing == 1 else f"faltan {missing} meses."))


def treasury_narrative(data):
    company, forecast = data["company"], data["forecast"]
    company_id = company["company_id"]
    persistence_index = 6 if company_id == "COMP_0216" else 7
    fields = {
        "persistence_explanation": item(
            "La confirmación comparte referencia entre comparaciones; no representa muestras independientes.",
            [*TREND_SOURCES, f"company:/limitations/{persistence_index}"]),
        "limitations": [item(text, sources) for text, sources in treasury._operational_limitations(company)],
    }
    if company_id == "COMP_0216":
        fields.update({
            "trend_summary": item(
                "La mejora reciente está confirmada: servicio de deuda aporta +7.6017 puntos al ajuste. "
                "Sigue activa la alerta MEDIUM de deterioro a largo plazo.",
                [*TREND_SOURCES, *signal_sources(3), "company:/alerts/0"]),
            "forecast_explanation": item(
                "Confianza media con 20 meses operativos. Base condicional: Oct 2026 69.4; Nov 2026 80.2; "
                "Dic 2026 67.4, por debajo del 77.4 actual.",
                [*BASE_FORECAST_SOURCES, "forecast:/observed_operational_months"],
                "Copy the ordered base scores/months; translate medium; compare terminal 67.4 < current 77.4."),
            "adverse_summary": item(
                "49.7 en Dic 2026 es el mínimo adverso, no un límite probabilístico.",
                ["forecast:/scenarios/adverse/scores", "forecast:/forecast_months", "forecast:/limitations/14"],
                "Minimum of [63.5, 58.4, 49.7] is 49.7 at index 2, December 2026; retain the scenario-bound caveat."),
            "watch_items": [
                item("Atender la deriva MEDIUM: delta -13.918647356475269 < umbral -2.0 en la comparación larga.",
                     ["company:/alerts/0", "company:/window_usage/drift_detection"],
                     "Copy the exact stored trigger and threshold; compare -13.918647356475269 < -2.0."),
                item("Revisar comisiones: cambio -0.0231 y contribución -0.0036 puntos al ajuste.", signal_sources(2)),
                item("Contrastar el mínimo adverso de 49.7 en Dic 2026 frente al 77.4 actual.",
                     ["company:/final_score", "forecast:/scenarios/adverse/scores", "forecast:/forecast_months"],
                     "Select the earliest adverse minimum; exact Decimal difference current 77.4 minus 49.7 = 27.7."),
            ],
        })
    else:
        fields.update({
            "forecast_explanation": item(history_text(data), HISTORY_SOURCES),
            "adverse_summary": item(
                f"Sin escenario adverso: {forecast['observed_operational_months']} meses operativos de "
                f"{forecast['min_months_required']} requeridos; "
                + ("falta 1." if forecast["months_missing"] == 1 else f"faltan {forecast['months_missing']}.") ,
                [*HISTORY_SOURCES, "forecast:/scenarios"]),
        })
        if company_id == "COMP_0874":
            fields.update({
                "trend_summary": item(
                    "Deterioro confirmado: entradas/salidas cambia -29.8543 puntos normalizados y aporta "
                    "-7.8274 al ajuste; alerta HIGH.", [*TREND_SOURCES, *signal_sources(0), "company:/alerts/0"]),
                "watch_items": [
                    item("Atender la alerta HIGH: trayectoria de deterioro y persistencia confirmada.",
                         [*TREND_SOURCES, "company:/alerts/0"]),
                    item("Revisar entradas/salidas: cambio -29.8543; contribución -7.8274 puntos al ajuste.", signal_sources(0)),
                    item("Revisar devoluciones: cambio -12.2324; contribución -2.0045 puntos al ajuste.", signal_sources(1)),
                ],
            })
        else:
            fields.update({
                "trend_summary": item(
                    "COBERTURA MUY BAJA: 0 de 7 meses completos; 19 transacciones en la ventana de evidencia. "
                    "Deterioro confirmado y alerta HIGH.",
                    [*COVERAGE_SOURCES, *TREND_SOURCES, "company:/alerts/0"]),
                "watch_items": [
                    item("Atender la alerta HIGH: deterioro con persistencia confirmada; la baja cobertura no elimina esta alerta.",
                         [*TREND_SOURCES, "company:/alerts/0", "company:/alerts/1"]),
                    item("Revisar cobertura: 0% < umbral 50%; 0 de 7 meses completos y 19 transacciones en la ventana de evidencia.",
                         [*COVERAGE_SOURCES, "company:/alerts/1"],
                         "Copy coverage counts and evidence-window count; fractions 0.0 and 0.5 times 100 are 0% and 50%."),
                    item("Revisar comisiones: cambio -45.4687; contribución -4.0548 puntos al ajuste.", signal_sources(2)),
                ],
            })
            fields["limitations"][0] = item(
                "Evidencia muy limitada: 0 de 7 meses completos (0%); 19 transacciones incluidas entre 2026-03 y 2026-08.",
                COVERAGE_SOURCES, "Copy the exact evidence-window count/range and month counts; coverage fraction times 100.")
    return envelope(company_id, "tesorero", fields)


def financial_narrative(data):
    company_id = data["company"]["company_id"]
    score_sources = ["company:/base_score", "company:/trajectory_adjustment", "company:/final_score",
                     *TREND_SOURCES, "company:/component_summary", "company:/signals", "company:/alerts",
                     "forecast:/provenance/thresholds/max_adjustment"]
    fields = {
        "parameter_note": item(financial.PARAMETER_NOTE,
                               ["company:/rule_version", "forecast:/forecast_rule_version", "forecast:/provenance"],
                               "Required static statement contextualizing persisted, versioned artifact parameters."),
        "limitations": [item(text, sources,
                              "Faithful compact Spanish translation; exact duplicate grouping retains every source and affected scenario/month.")
                        for text, sources in financial._limitation_entries(data)],
    }
    if company_id == "COMP_0216":
        fields.update({
            "score_explanation": item(
                "Base ponderada 67.4 + ajuste confirmado +10.0 = 77.4. Servicio de deuda: 10.4818 puntos base "
                "y +7.6017 de ajuste. Persiste alerta MEDIUM de deriva.", score_sources,
                "Reconcile 67.4 + 10.0 = 77.4; distinguish base_contribution from signal contribution and preserve the active drift."),
            "method_explanation": item(
                "Regresión en devoluciones y comisiones; naive en entradas/salidas y deuda, por menor MAE reservado. "
                "Selección: 17 meses y 3 observaciones reservadas; ajuste final: 20.",
                ["forecast:/method_per_component", "forecast:/baseline_vs_regression", "forecast:/backtest_periods",
                 "forecast:/backtest_training_months", "forecast:/months_used_for_training"],
                "Copy recorded winners, compare original MAEs without rounding, count the three held-out periods, and distinguish training phases."),
            "forecast_confidence_explanation": item(
                "Cobertura 100% no equivale a confianza predictiva. Base final 67.4 en Dic 2026: 10.0 puntos por debajo de 77.4.",
                [*BASE_FORECAST_SOURCES, "company:/confidence/coverage_pct"],
                "Coverage fraction 1.0 times 100; current 77.4 minus terminal base 67.4 = 10.0 using Decimal, not binary rounding."),
        })
    else:
        fields.update({
            "method_explanation": item(
                history_text(data) + " No se han calculado métodos ni MAE; las reglas metodológicas siguientes no se han ejecutado.",
                [*HISTORY_SOURCES, "forecast:/method_per_component", "forecast:/baseline_vs_regression", "forecast:/training_periods"]),
            "forecast_confidence_explanation": item(
                "Confianza predictiva no calculada; la cobertura observada no sustituye el historial operativo requerido.",
                [*HISTORY_SOURCES, "forecast:/confidence", *COVERAGE_SOURCES]),
        })
        fields["score_explanation"] = item(
            "Base ponderada 72.0 + ajuste confirmado -10.0 = 62.0. Entradas/salidas aporta 15.3197 a la base "
            "y -7.8274 al ajuste. Alerta HIGH de deterioro confirmado."
            if company_id == "COMP_0874" else
            "ADVERTENCIA: 0 de 7 meses completos; 19 transacciones (ventana de evidencia). "
            "Base 66.7 - 10.0 = 56.7; deterioro confirmado HIGH.",
            [*score_sources, *COVERAGE_SOURCES],
            "Copy separate base/adjustment attributions; reconcile base plus applied adjustment exactly; retain coverage scope and the HIGH alert.")
    return envelope(company_id, "financiero", fields)


def sales_narrative(data):
    company_id = data["company"]["company_id"]
    commercial_sources = ["company:/final_score", *TREND_SOURCES, "company:/alerts"]
    health = item("El índice actual se sitúa en la banda comercial buena.", ["company:/final_score"],
                  "Apply the template's strict health band: 77.4 > 65; this is a display policy, not a credit evaluation.", sales.POLICY)
    if company_id == "COMP_0216":
        fields = {
            "summary_lines": [
                health,
                item("La mejora reciente está confirmada, aunque sigue activa la alerta de deterioro a largo plazo.",
                     [*TREND_SOURCES, "company:/alerts/0"]),
                item("El escenario base cerraría por debajo del nivel actual, con confianza media.", BASE_FORECAST_SOURCES,
                     "Compare terminal base 67.4 < current 77.4; translate medium without equating it to observed coverage."),
            ],
            "positive_signals": [
                item("Entradas/salidas: +1.583 puntos al ajuste de trayectoria.", signal_sources(0)),
                item("Devoluciones: +0.8189 puntos al ajuste de trayectoria.", signal_sources(1)),
                item("Servicio de deuda: +7.6017 puntos al ajuste de trayectoria.", signal_sources(3)),
            ],
            "pressure_signals": [
                item("Comisiones: -0.0036 puntos al ajuste de trayectoria.", signal_sources(2)),
                item("Deterioro a largo plazo: alerta MEDIUM activa.", ["company:/alerts/0"]),
            ],
            "recommendation_text": item(
                "GREEN: score 77.4, mejora confirmada y ninguna alerta HIGH. La base cerraría a la baja en 67.4; "
                "la deriva MEDIUM sigue activa.", [*commercial_sources, *BASE_FORECAST_SOURCES],
                "Template RED conditions are absent; 77.4 > 65, improving, confirmed, no HIGH => GREEN. Disclose 67.4 < 77.4 and active MEDIUM drift.",
                sales.POLICY),
            "forecast_explanation": item(
                "Escenario base condicional: 69.4 en Oct 2026, 80.2 en Nov 2026 y 67.4 en Dic 2026; "
                "cierre 10.0 puntos por debajo de 77.4.", BASE_FORECAST_SOURCES,
                "Copy all ordered base months/scores; exact Decimal difference current 77.4 minus terminal 67.4 = 10.0; no monotonicity claim."),
        }
    else:
        sparse = company_id == "COMP_0114"
        fields = {
            "summary_lines": [
                item("La salud figura en la banda comercial regular, con evidencia escasa y sin meses completos."
                     if sparse else "El índice actual se sitúa en la banda comercial regular.",
                     ["company:/final_score", *COVERAGE_SOURCES],
                     "Apply the template's inclusive 45–65 regular health band; for COMP_0114 foreground 0 complete months and sparse evidence.", sales.POLICY),
                item("El deterioro reciente está confirmado y activa una alerta de severidad HIGH.",
                     [*TREND_SOURCES, "company:/alerts/0"]),
                item("No hay historial operativo suficiente para calcular la proyección.", HISTORY_SOURCES),
            ],
            "positive_signals": [],
            "pressure_signals": [
                item("Entradas/salidas: -5.9452 puntos al ajuste de trayectoria." if sparse
                     else "Entradas/salidas: -7.8274 puntos al ajuste de trayectoria.", signal_sources(0)),
                item("Comisiones: -4.0548 puntos al ajuste de trayectoria." if sparse
                     else "Comisiones: -0.1681 puntos al ajuste de trayectoria.", signal_sources(2)),
                item("Deterioro confirmado: alerta HIGH activa.", ["company:/alerts/0"]),
            ],
            "forecast_explanation": item(history_text(data), HISTORY_SOURCES),
            "recommendation_text": item(
                "RED por deterioro confirmado y alerta HIGH. COBERTURA MUY BAJA: 0 de 7 meses completos; "
                "19 transacciones incluidas en la ventana de evidencia." if sparse else
                "RED: 62.0/100 con deterioro confirmado y alerta HIGH. No hay proyección: 11 de 12 meses operativos; falta 1.",
                [*commercial_sources, *COVERAGE_SOURCES, *HISTORY_SOURCES],
                "Template RED precedence: deteriorating + confirmed and active HIGH DETERIORATION_CONFIRMED; low coverage does not override this branch. Copy history counts without promising future availability.",
                sales.POLICY),
        }
        fields["pressure_signals"].append(
            item("Cobertura LOW: 0 de 7 meses completos; solo 19 transacciones en la ventana de evidencia.",
                 ["company:/alerts/1", *COVERAGE_SOURCES]) if sparse else
            item("Devoluciones: -2.0045 puntos al ajuste de trayectoria.", signal_sources(1)))
    return envelope(company_id, "sales", fields)


def filename(payload):
    return f"{payload['company_id']}_{payload['role']}_{REPORT_DATE.replace('-', '')}.pdf"


def arithmetic_audit(data):
    company, forecast = data["company"], data["forecast"]
    base, adjustment, current = [Decimal(str(company[key])) for key in ("base_score", "trajectory_adjustment", "final_score")]
    require(base + adjustment == current, "Published score reconciliation failed")
    result = {
        "score": {"sources": ["company:/base_score", "company:/trajectory_adjustment", "company:/final_score"],
                  "operation": "Exact Decimal base plus applied adjustment equals final score",
                  "operands": [str(base), str(adjustment)], "result": str(current)},
        "coverage": {"sources": ["company:/confidence/coverage_pct"], "operation": "Stored fraction times 100",
                     "result": str(Decimal(str(company["confidence"]["coverage_pct"])) * 100)},
    }
    if forecast["forecast_status"] == "insufficient_data":
        missing = forecast["min_months_required"] - forecast["observed_operational_months"]
        require(missing == forecast["months_missing"], "Refusal count mismatch")
        result["missing_months"] = {"sources": HISTORY_SOURCES, "operation": "Required minus observed operational months",
                                    "operands": [forecast["min_months_required"], forecast["observed_operational_months"]], "result": missing}
    else:
        for name in ("base", "adverse"):
            scores = forecast["scenarios"][name]["scores"]
            index = len(scores) - 1 if name == "base" else min(range(len(scores)), key=scores.__getitem__)
            value = Decimal(str(scores[index]))
            result[name] = {
                "sources": ["company:/final_score", f"forecast:/scenarios/{name}/scores", "forecast:/forecast_months"],
                "operation": "Current minus terminal base" if name == "base" else "Current minus earliest adverse minimum",
                "operands": [str(current), str(value)], "result": str(current - value), "month": forecast["forecast_months"][index],
            }
        require(result["base"]["result"] == "10.0" and result["adverse"]["result"] == "27.7", "Authored differences do not match this snapshot")
    return result


def validate_payload(data, payload):
    arithmetic_audit(data)
    require(set(payload) == {"company_id", "role", "sections", "evidence"}, "Unexpected narrative envelope fields")
    MODULES[payload["role"]]._validate_narrative(data, payload)
    for entry in payload["evidence"].values():
        for source in entry["sources"]:
            artifact, pointer = source.split(":", 1)
            pointer_value(data[artifact], pointer)
    if payload["role"] == "financiero":
        expected = {f"{artifact}:{pointer}" for artifact in ("company", "forecast")
                    for pointer, _ in _limitation_sources(data[artifact])}
        covered = {source for key, entry in payload["evidence"].items() if key.startswith("sections.limitations[")
                   for source in entry["sources"]}
        require(expected == covered, "Financial limitation mapping must cover every original pointer exactly in scope")
        return len(expected)
    return None


def encoded(document):
    return (json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def publish_exclusive(path, content):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".agent14-", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
            os.link(temporary, path)
        finally:
            temporary.unlink()


def save_manifest(document, run_id):
    current = json.loads(MANIFEST.read_text(encoding="utf-8"))
    require(current["run_id"] == run_id == document["run_id"], "Manifest ownership mismatch")
    with tempfile.NamedTemporaryFile(dir=OUTPUT, prefix=".agent14-", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(encoded(document))
            stream.flush()
            os.fsync(stream.fileno())
            temporary.replace(MANIFEST)
        finally:
            temporary.unlink(missing_ok=True)


def prepare():
    check_snapshot()
    require(not NARRATIVES.exists() and not MANIFEST.exists(), "Existing audit files require explicit ownership approval")
    payloads, sources, limitation_counts = [], {}, {}
    for company_id in COMPANIES:
        data = load_company_data(company_id, SOURCE)
        sources[company_id] = data["source_paths"]
        for builder in (treasury_narrative, financial_narrative, sales_narrative):
            payload = builder(data)
            limitation_counts[filename(payload)] = validate_payload(data, payload)
            require(not (OUTPUT / filename(payload)).exists(), f"Existing final report requires approval: {filename(payload)}")
            payloads.append(payload)
    check_snapshot()
    run_id = str(uuid.uuid4())
    manifest = {
        "run_id": run_id, "owner": "AGENT14_fill_and_render", "report_date": REPORT_DATE,
        "source_root": str(SOURCE), "source_paths": sources,
        "source_selection": "Requested results/ contains v1.0.0 companies and no forecasts; AGENT14 explicitly permits the complete documented v2 root.",
        "rule_version": "v2.0.0-w3-h9", "forecast_rule_version": "forecast-v1.0.0", "alert_rule_version": "alerts-v1.0.0",
        "source_and_template_sha256": {str(ROOT / path): value for path, value in READ_SNAPSHOT.items()},
        "authoring": "Spanish narrative reasoning by this session; existing compact limitation translations reused; no external model API calls.",
        "operator_approvals": {
            "model_substitution": "User selected Continuar aquí; use this session instead of claude-opus-5.",
            "minimum_size_waived": "User selected Aceptar tamaño natural; no artificial minimum, maximum 2000000 bytes; all other gates retained.",
        },
        "prerequisite_tests": {"design_system": 24, "role_templates": 56, "failures": 0},
        "financial_limitation_source_counts": limitation_counts,
        "narratives_sha256": hashlib.sha256(encoded(payloads)).hexdigest(),
        "reports": [], "status": "NARRATIVES_VALIDATED",
    }
    publish_exclusive(NARRATIVES, encoded(payloads))
    publish_exclusive(MANIFEST, encoded(manifest))
    print(f"Prepared {len(payloads)} validated narratives. Run ID: {run_id}")


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def command(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def inspect_pdf(path, data, payload, raster_dir):
    content = path.read_bytes()
    require(content.startswith(b"%PDF-"), f"Invalid PDF signature: {path.name}")
    require(0 < len(content) <= 2_000_000, f"FAIL_SIZE: {len(content)} bytes")
    info = command("pdfinfo", "-box", "-f", "1", "-l", "2", str(path))
    require(re.search(r"Pages:\s+2\b", info), "Expected exactly two pages")
    require(len(re.findall(r"MediaBox:\s+0\.00\s+0\.00\s+595\.00\s+842\.00", info)) >= 2, "Wrong nominal A4 media box")
    raw = command("pdftotext", "-raw", str(path), "-")
    pages = [normalize(page) for page in raw.split("\f") if page.strip()]
    require(len(pages) == 2, "Text extraction page count mismatch")
    role = payload["role"]
    role_label = {"tesorero": "TESORERO", "financiero": "FINANCIERO / ANALISTA", "sales": sales.ROLE}[role]
    for number, page in enumerate(pages, 1):
        for expected in (data["company"]["company_id"], REPORT_DATE, role_label,
                         "Generado por Embat · Confidencial", f"{number} / 2"):
            require(expected in page, f"Missing page {number} identity/footer: {expected}")
    text = " ".join(pages)
    require(not re.search(r"\b(?:None|NaN|TODO|TBD)\b|\{[^}]+\}|[\u25a0\ufffd]", text), "Unresolved text or missing glyph")
    score = str(data["company"]["final_score"])
    require(re.search(rf"(?<![\d.]){re.escape(score)}(?![\d.])", pages[0]), "Current score missing from page one")
    for key, value in payload["sections"].items():
        for sentence in value if isinstance(value, list) else [value]:
            require(normalize(sentence) in text, f"Narrative omitted or truncated: {key}: {sentence}")
    headings = {
        "tesorero": ("Resumen ejecutivo", "Alertas activas", "Tendencia reciente", "Proyección y riesgos", "Qué vigilar", "LIMITACIONES"),
        "financiero": ("Scoring detallado", "Cobertura y calidad de datos", "Predicción y validación", "Validación del método", "Parámetros de configuración usados", "LIMITACIONES"),
        "sales": ("Ficha comercial", "Semáforo de oportunidad", "Resumen en 3 líneas", "Alertas relevantes para Sales", "Detalle y recomendación", "Señales clave", "DATOS DE SOPORTE"),
    }
    for heading in headings[role]:
        require(heading in text, f"Missing heading: {heading}")
    if role == "sales":
        require(sales.DISCLAIMER in text, "Missing exact credit-evaluation disclaimer")
        require(sales.HEADLINES[sales._recommendation_class(data["company"])] in text, "Wrong recommendation headline")
    if role == "financiero":
        for row in financial._component_rows(data) + financial._adjustment_rows(data):
            for cell in row:
                require(normalize(cell) in text, f"Financial table value missing: {cell}")
        for row in financial._method_rows(data):
            for index in (2, 3):
                require(row[index] in text, f"Missing MAE value: {row[index]}")
        for version in (data["company"]["rule_version"], data["forecast"]["forecast_rule_version"]):
            require(version in text, f"Missing version: {version}")
    if data["forecast"]["forecast_status"] == "insufficient_data":
        require(not any(month in pages[1] for month in ("Oct 2026", "Nov 2026", "Dic 2026")), "Fabricated forecast months")
        require("insuficiente" in pages[1] or "No hay proyección" in pages[1], "Missing forecast refusal")
    if payload["company_id"] == "COMP_0114":
        require(("COBERTURA MUY BAJA" in pages[0] or "ADVERTENCIA: 0 de 7" in pages[0]
                 or "evidencia escasa y sin meses completos" in pages[0]), "Sparse coverage warning not on page one")
        require("19 transacciones" in text and "HIGH" in pages[0], "Sparse evidence or actual HIGH alert omitted")
    bbox = command("pdftotext", "-bbox", str(path), "-")
    xml = ET.fromstring(bbox)
    for page in xml.iter("{http://www.w3.org/1999/xhtml}page"):
        words = [(word.text, tuple(float(word.attrib[key]) for key in ("xMin", "yMin", "xMax", "yMax")))
                 for word in page.iter("{http://www.w3.org/1999/xhtml}word")]
        for index, (word, box) in enumerate(words):
            require(47.9 <= box[0] < box[2] <= 547.1 and 0 <= box[1] < box[3] <= 842, f"Out-of-bounds word: {word}")
            require(box[3] - box[1] >= 7.3, f"Text smaller than the 8 pt font footprint: {word}")
            for other, other_box in words[index + 1:]:
                overlap_x = min(box[2], other_box[2]) - max(box[0], other_box[0])
                overlap_y = min(box[3], other_box[3]) - max(box[1], other_box[1])
                require(not (overlap_x > 0.3 and overlap_y > 0.3), f"Text overlaps: {word} / {other}")
    fonts = command("pdffonts", str(path))
    font_names = [line.split()[0] for line in fonts.splitlines()[2:] if line.strip()]
    require(set(font_names) <= {"Helvetica", "Helvetica-Bold"}, f"Unexpected fonts: {font_names}")
    prefix = raster_dir / path.stem
    command("pdftoppm", "-png", "-scale-to", "1684", str(path), str(prefix))
    rasters = [Path(f"{prefix}-{number}.png") for number in (1, 2)]
    require(all(image.is_file() and image.stat().st_size > 0 for image in rasters), "Both pages must rasterize")
    return {
        "filename": filename(payload), "company_id": payload["company_id"], "role": role,
        "pages": 2, "bytes": len(content), "score_in_pdf": score, "sha256": digest(path),
        "staged_pdf": str(path), "rasters": {str(image): digest(image) for image in rasters},
        "automatic_checks": "PASS", "visual_review": "PENDING", "status": "AWAITING_VISUAL_REVIEW",
        "checks": ["PDF signature", "independent Poppler parse", "two nominal A4 pages", "page identity and footers",
                   "exact current score", "all narrative text retained", "all headings", "role fields and policies",
                   "complete financial limitation evidence", "no placeholders or missing-glyph boxes", "word bounds and no text overlap",
                   "built-in Helvetica only", "maximum 2000000 bytes; minimum waived by operator", "both pages rasterized"],
    }


def load_run(run_id):
    check_snapshot()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    require(bool(run_id) and manifest["run_id"] == run_id, "Supply the run ID created by this execution")
    require(digest(NARRATIVES) == manifest["narratives_sha256"], "Narratives changed after validation")
    return manifest, json.loads(NARRATIVES.read_text(encoding="utf-8"))


def render(run_id):
    manifest, payloads = load_run(run_id)
    require(all(not (OUTPUT / filename(payload)).exists() for payload in payloads), "Refusing to overwrite final reports")
    staging = Path(tempfile.mkdtemp(prefix="embat-agent14-"))
    reports = []
    for payload in payloads:
        data = load_company_data(payload["company_id"], SOURCE)
        validate_payload(data, payload)
        output = staging / filename(payload)
        with patch.object(ds, "draw_forecast_chart", wraps=ds.draw_forecast_chart) as chart, \
                patch.object(ds, "_scenario_band", wraps=ds._scenario_band) as band, \
                patch.object(ds, "draw_alert_badge", wraps=ds.draw_alert_badge) as badges:
            RENDERERS[payload["role"]](data, payload, output, report_date=REPORT_DATE)
        forecast = data["forecast"]
        if forecast["forecast_status"] == "insufficient_data":
            require(not chart.called and not band.called, "Unavailable forecast drew a chart")
        else:
            require(chart.called, "Available forecast chart is missing")
            arguments = chart.call_args.args
            expected = [forecast["forecast_months"], forecast["scenarios"]["base"]["scores"]]
            expected += ([None, None] if payload["role"] == "sales" else
                         [forecast["scenarios"][name]["scores"] for name in ("favorable", "adverse")])
            require(list(arguments[-4:]) == expected, "Chart altered scenario data or labels")
            require(not band.called if payload["role"] == "sales" else band.called, "Wrong scenario band policy")
        if payload["role"] in ("tesorero", "sales"):
            expected = [(alert["alert_type"], alert["severity"]) for alert in data["company"]["alerts"]
                        if payload["role"] == "tesorero" or alert["severity"] == "HIGH"]
            observed = [tuple(call.args[-2:]) for call in badges.call_args_list]
            require(set(observed) == set(expected), "Incorrect role-specific alert filtering")
        result = inspect_pdf(output, data, payload, staging)
        result["arithmetic"] = arithmetic_audit(data)
        result["checks"].append("chart arrays and refusal path observed during rendering")
        if payload["role"] in ("tesorero", "sales"):
            result["checks"].append("role-specific alert filtering observed during rendering")
        reports.append(result)
        print(f"{output.name} | 2 pages | {result['bytes']} bytes | AUTOMATIC PASS; visual review pending")
    check_snapshot()
    manifest.update(reports=reports, staging_directory=str(staging), status="AWAITING_VISUAL_REVIEW")
    save_manifest(manifest, run_id)
    print(f"Rasterized pages for visual review: {staging}")


def publish(run_id, visual_reviewed):
    manifest, payloads = load_run(run_id)
    require(visual_reviewed, "All 18 rasterized pages require explicit visual inspection before publication")
    require(manifest["status"] == "AWAITING_VISUAL_REVIEW" and len(manifest["reports"]) == 9, "Incomplete validated matrix")
    require({entry["filename"] for entry in manifest["reports"]} == {filename(payload) for payload in payloads}, "Wrong report matrix")
    for report in manifest["reports"]:
        require(not (OUTPUT / report["filename"]).exists(), f"Existing final report: {report['filename']}")
        require(digest(report["staged_pdf"]) == report["sha256"], "PDF changed after validation")
        for image, expected in report["rasters"].items():
            require(digest(image) == expected, "Raster changed after inspection")
    for report in manifest["reports"]:
        path = OUTPUT / report["filename"]
        publish_exclusive(path, Path(report["staged_pdf"]).read_bytes())
        require(digest(path) == report["sha256"], "Publication changed PDF bytes")
        report.update(final_path=str(path), visual_review="PASS: both rasterized pages inspected in this session", status="OK")
        report["checks"].append("visual inspection: no clipping, collisions, broken accents, illegible labels or hidden warnings")
    check_snapshot()
    manifest.update(status="OK", passed=9)
    save_manifest(manifest, run_id)
    print("| Fichero | Páginas | Tamaño | Score en PDF | Rol | Estado |")
    print("|---------|---------|--------|--------------|-----|--------|")
    for report in manifest["reports"]:
        print(f"| {report['filename']} | {report['pages']} | {report['bytes']} bytes | {report['score_in_pdf']} | {report['role']} | OK |")
    print("REPORTS COMPLETE")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("prepare", "render", "publish"))
    parser.add_argument("--run-id")
    parser.add_argument("--visual-reviewed", action="store_true")
    args = parser.parse_args()
    if args.stage == "prepare":
        prepare()
    elif args.stage == "render":
        render(args.run_id)
    else:
        publish(args.run_id, args.visual_reviewed)


if __name__ == "__main__":
    main()
