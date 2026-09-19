import hashlib
from collections.abc import Iterable

ACTIVITIES = (
    "Talleres",
    "Bodegas",
    "Transportes",
    "Construcciones",
    "Industrias",
    "Suministros",
    "Logística",
    "Servicios",
    "Comercial",
    "Manufacturas",
    "Distribuciones",
    "Tecnologías",
    "Proyectos",
    "Soluciones",
    "Gestión",
    "Obras",
)

IDENTITIES = (
    "Ribera",
    "Altamira",
    "Navarro",
    "Ebro",
    "Duero",
    "Sierra",
    "Montes",
    "Campos",
    "Ortega",
    "Romero",
    "Vega",
    "Serrano",
    "Molina",
    "Cabrera",
    "Olmedo",
    "Salinas",
    "Robledo",
    "Moncayo",
    "Alameda",
    "Laredo",
    "Belmonte",
    "Valencia",
    "Aranda",
    "Mendoza",
    "Segura",
    "Castaño",
    "Montalvo",
    "Pineda",
    "Miranda",
    "Lorenzo",
    "Meridian",
    "Gálvez",
)

QUALIFIERS = (
    "Norte",
    "Sur",
    "Central",
    "Ibérica",
    "Atlántica",
    "Mediterránea",
    "Hispana",
    "Peninsular",
    "Occidental",
    "Oriental",
    "Levante",
    "Castilla",
    "Aragón",
    "Cantábrica",
    "Andaluza",
    "Riojana",
)

LEGAL_FORMS = ("", "S.L.", "S.A.", "S.L.U.")

DEMO_NAMES = {
    "COMP_0176": "Talleres Ribera",
    "COMP_0077": "Bodegas Altamira",
    "COMP_0909": "Meridian Logística",
}


def _candidate(company_id: str, attempt: int) -> str:
    digest = hashlib.sha256(f"{company_id}:{attempt}".encode()).digest()
    activity = ACTIVITIES[int.from_bytes(digest[:2]) % len(ACTIVITIES)]
    identity = IDENTITIES[int.from_bytes(digest[2:4]) % len(IDENTITIES)]
    qualifier = QUALIFIERS[int.from_bytes(digest[4:6]) % len(QUALIFIERS)] if attempt else ""
    legal_form = LEGAL_FORMS[int.from_bytes(digest[6:8]) % len(LEGAL_FORMS)]
    return " ".join(part for part in (activity, identity, qualifier, legal_form) if part)


def company_name(company_id: str, used_names: set[str] | None = None) -> str:
    override = DEMO_NAMES.get(company_id)
    if override is not None:
        return override
    used = used_names if used_names is not None else set()
    attempt = 0
    while (candidate := _candidate(company_id, attempt)) in used:
        attempt += 1
    return candidate


def company_names(company_ids: Iterable[str]) -> dict[str, str]:
    ordered = sorted(set(company_ids))
    names = dict(DEMO_NAMES)
    used = set(DEMO_NAMES.values())
    for company_id in ordered:
        if company_id in names:
            continue
        names[company_id] = company_name(company_id, used)
        used.add(names[company_id])
    return {company_id: names[company_id] for company_id in ordered}
