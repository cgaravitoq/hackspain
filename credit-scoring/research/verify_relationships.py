from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path('/home/juan/Descargas/output_hackspain_data/output')
OUT = Path('/home/juan/hackspain/credit-scoring/research')


def frame(path, **kwargs):
    return pd.read_csv(path, dtype=str, keep_default_na=False, **kwargs)


def main():
    audit = json.loads((OUT / 'relationship_audit.json').read_text())
    companies = frame(DATA / 'companies.csv').set_index('company_id')
    nodes = frame(OUT / 'graph_nodes.csv').set_index('company_id')
    assert set(companies.index) == set(nodes.index)
    assert len(companies) == len(nodes) == 1286
    for field in companies.columns:
        assert companies[field].sort_index().equals(nodes[field].sort_index())
    assert nodes['final_score'].eq('').sum() == 119
    score_dir = OUT.parent / 'results-v2-agent6-20260919/companies'
    for company_id, node in nodes.iterrows():
        score = json.loads((score_dir / (company_id + '.json')).read_text())
        for field in ['base_score', 'final_score']:
            assert (None if node[field] == '' else float(node[field])) == score[field]
        for field in ['trajectory', 'persistence', 'rule_version', 'data_cutoff']:
            assert node[field] == score[field]
        assert (None if node.coverage_pct == '' else float(node.coverage_pct)) == score['confidence']['coverage_pct']
    checks_scores = len(nodes)
    products = pd.concat([frame(DATA / (name + '.csv')) for name in ['banking_products', 'debt_products']], ignore_index=True)
    known = set(products.product_id)
    product_owners = defaultdict(set)
    for name in ['banking_products', 'debt_products', 'balances', 'debt_schedule_config']:
        for row in frame(DATA / (name + '.csv')).itertuples():
            product_owners[row.product_id].add(row.company_id)
    cp_maps = {}
    record_ids = {}
    checks = {'score_nodes_verified': checks_scores}
    evidence_rows = []
    for name, id_field in [('transactions', 'transaction_id'), ('invoices', 'operation_id')]:
        cp_map = defaultdict(set)
        count = 0
        direct = 0
        unknown_ids = set()
        unknown_example = None
        cross_record_ids = []
        columns = [id_field, 'company_id', 'counterparty_id'] + (['product_id'] if name == 'transactions' else [])
        for chunk in frame(DATA / (name + '.csv'), usecols=columns, chunksize=200000):
            count += len(chunk)
            direct += int(chunk.counterparty_id.isin(companies.index).sum())
            for r in chunk[['company_id', 'counterparty_id']].drop_duplicates().itertuples(index=False):
                if r.counterparty_id:
                    cp_map[r.counterparty_id].add(r.company_id)
            if name == 'transactions':
                record_ids.update(zip(chunk.transaction_id, chunk.company_id))
                for r in chunk[['product_id', 'company_id']].drop_duplicates().itertuples(index=False):
                    product_owners[r.product_id].add(r.company_id)
                unknown = chunk.loc[~chunk.product_id.isin(known)]
                unknown_ids.update(unknown.product_id)
                if len(unknown) and unknown_example is None:
                    unknown_example = unknown.iloc[0].to_dict()
            else:
                for r in chunk.loc[chunk.operation_id.isin(record_ids)].itertuples(index=False):
                    cross_record_ids.append({'operation_id': r.operation_id, 'invoice_company': r.company_id, 'transaction_company': record_ids[r.operation_id]})
            for r in chunk.loc[chunk.company_id.isin(['COMP_0977', 'COMP_1109', 'COMP_0354', 'COMP_0909']) & chunk.counterparty_id.isin(['COUNTERPARTY_03211', 'COUNTERPARTY_08536'])].head(4).to_dict('records'):
                evidence_rows.append({'file': name + '.csv', **r})
        assert count == audit['files'][name + '.csv']['rows']
        assert direct == 0
        assert len(cp_map) == audit[name]['unique_counterparties']
        cp_maps[name] = cp_map
        checks[name] = {'rows': count, 'direct_company_rows': direct, 'unknown_product_ids': sorted(unknown_ids), 'unknown_product_example': unknown_example, 'cross_file_record_ids': cross_record_ids}
    del record_ids
    merged = defaultdict(set)
    for mapping in cp_maps.values():
        for cp, members in mapping.items():
            merged[cp].update(members)
    weights = Counter()
    for members in merged.values():
        weights.update(combinations(sorted(members), 2))
    assert weights == Counter({('COMP_0977', 'COMP_1109'): 97, ('COMP_0354', 'COMP_0909'): 1})
    assert all(len(v) == 1 for v in product_owners.values())
    schedules = frame(DATA / 'debt_schedule_config.csv')
    checks['settlement_fallback'] = [{'company_id': r.company_id, 'settlement_product_id': r.settlement_product_id,
                                    'owners_any_file': sorted(product_owners.get(r.settlement_product_id, set()))}
                                   for r in schedules.itertuples() if r.settlement_product_id not in known]
    balances = frame(DATA / 'balances.csv')
    checks['unknown_balance_examples'] = balances.loc[~balances.product_id.isin(known)].head(3).to_dict('records')
    checks['structured_examples'] = evidence_rows[:12]
    services = defaultdict(set)
    for r in products.itertuples():
        if r.service and r.service != 'custom':
            services[r.service].add(r.company_id)
    service_pairs = set()
    for members in services.values():
        service_pairs.update(combinations(sorted(members), 2))
    checks['same_service'] = {'pairs': len(service_pairs), 'unique_services': len(services), 'examples': {k: sorted(v)[:3] for k, v in list(services.items())[:3]}}
    vals = pd.to_numeric(nodes.final_score, errors='coerce')
    scored = pd.DataFrame({'value': vals, 'group': nodes.group_id}).dropna()
    agg = scored.groupby('group').value.agg(['sum', 'count'])
    eligible = scored.loc[scored.group.map(agg['count']) > 1]
    predictions = (eligible.group.map(agg['sum']) - eligible.value) / (eligible.group.map(agg['count']) - 1)
    baseline = (scored.value.sum() - eligible.value) / (len(scored) - 1)
    checks['leave_one_out_group_score'] = {'companies': len(eligible), 'groups': eligible.group.nunique(),
                                         'group_mae': float(abs(predictions - eligible.value).mean()), 'global_mae': float(abs(baseline - eligible.value).mean()),
                                         'group_rmse': float(np.sqrt(((predictions - eligible.value) ** 2).mean())), 'global_rmse': float(np.sqrt(((baseline - eligible.value) ** 2).mean()))}
    if (OUT / 'graph_edges.csv').exists():
        incidence = frame(OUT / 'relationship_incidence.csv')
        structured = defaultdict(set)
        text = defaultdict(set)
        for row in incidence.itertuples():
            (structured if row.evidence_kind == 'column' else text)[row.counterparty_id].add(row.company_id)
        mentions = Counter()
        for cp in structured.keys() | text.keys():
            members = structured[cp] | text[cp]
            for a, b in combinations(sorted(members), 2):
                if a in text[cp] or b in text[cp]:
                    mentions[a, b] += 1
        banks = defaultdict(set)
        for r in products.itertuples():
            if r.bank_name and r.bank_name != 'Other (customer-defined)':
                banks[r.bank_name].add(r.company_id)
        bank_weights = Counter()
        for members in banks.values():
            bank_weights.update(combinations(sorted(members), 2))
        service_weights = Counter()
        for members in services.values():
            service_weights.update(combinations(sorted(members), 2))
        expected = {'shared_counterparty_structured': weights, 'shared_counterparty_mention': mentions, 'shared_named_bank': bank_weights, 'shared_bank_service': service_weights}
        seen = defaultdict(set)
        types = Counter()
        with (OUT / 'graph_edges.csv').open(newline='') as stream:
            reader = csv.DictReader(stream)
            assert reader.fieldnames == ['company_a', 'company_b', 'relationship_type', 'weight', 'direction', 'source_file']
            for r in reader:
                a, b, kind = r['company_a'], r['company_b'], r['relationship_type']
                assert a in nodes.index and b in nodes.index and a < b
                assert r['direction'] == 'undirected'
                assert (a, b) not in seen[kind]
                seen[kind].add((a, b))
                assert int(r['weight']) == expected[kind][a, b]
                types[kind] += 1
        for kind, expected_pairs in expected.items():
            assert seen[kind] == set(expected_pairs)
        checks['graph_edge_counts'] = dict(types)
        memberships = frame(OUT / 'graph_memberships.csv')
        assert len(memberships) == len(companies)
        assert set(zip(memberships.company_id, memberships.group_id)) == set(zip(companies.index, companies.group_id))
        checks['memberships_verified'] = len(memberships)
    (OUT / 'relationship_validation.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(checks, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
