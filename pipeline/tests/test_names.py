from xray.names import company_name, company_names


def test_company_name_is_deterministic() -> None:
    assert company_name("COMP_0042") == company_name("COMP_0042")


def test_company_names_are_unique() -> None:
    company_ids = [f"COMP_{index:04d}" for index in range(2000)]
    names = company_names(company_ids)

    assert len(set(names.values())) == len(company_ids)
    assert all(not name.rsplit(" ", 1)[-1].isdigit() for name in names.values())


def test_company_names_keep_demo_overrides() -> None:
    names = company_names(["COMP_0176", "COMP_0077", "COMP_0909"])

    assert names == {
        "COMP_0077": "Bodegas Altamira",
        "COMP_0176": "Talleres Ribera",
        "COMP_0909": "Meridian Logística",
    }
