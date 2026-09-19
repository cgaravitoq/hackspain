from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from decimal import Decimal
from itertools import combinations
from pathlib import Path

import numpy as np

DATA = Path('/home/juan/Descargas/output_hackspain_data/output')
ROOT = Path('/home/juan/hackspain/credit-scoring')
OUT = ROOT / 'research'
SCORES = ROOT / 'results-v2-agent6-20260919/companies'


def records(name):
    with (DATA / name).open(newline='', encoding='utf-8') as stream:
        return list(csv.DictReader(stream))


def distribution(rows, field):
    return dict(sorted(Counter(r[field] for r in rows).items()))


def pairs(mapping):
    result = Counter()
    for members in mapping.values():
        result.update(combinations(sorted(members), 2))
    return result


def profile(rows):
    return {'rows': len(rows), 'columns': list(rows[0]), 'examples': rows[:3],
            'missing': {k: sum(not r[k] for r in rows) for k in rows[0]}}


def main():
    small = {name: records(name + '.csv') for name in
             ['groups', 'companies', 'banking_products', 'debt_products', 'balances', 'debt_schedule_config']}
    audit = {'files': {name + '.csv': profile(rows) for name, rows in small.items()}}
    companies = {r['company_id']: r for r in small['companies']}
    group_members = defaultdict(set)
    for row in small['companies']:
        group_members[row['group_id']].add(row['company_id'])
    group_pairs = pairs(group_members)
    audit['groups'] = {
        'unique_values': {k: sorted(set(r[k] for r in small['groups'])) for k in small['groups'][0]},
        'distributions': {k: distribution(small['groups'], k) for k in ['erp', 'n_companies_in_sample']},
        'companies_with_group': sum(bool(r['group_id']) for r in companies.values()),
        'unknown_group_ids': sorted(set(group_members) - {r['group_id'] for r in small['groups']}),
        'duplicate_company_rows': len(small['companies']) - len(companies),
        'duplicate_group_rows': len(small['groups']) - len({r['group_id'] for r in small['groups']}),
        'membership_count_mismatches': [r for r in small['groups'] if int(r['n_companies_in_sample']) != len(group_members[r['group_id']])],
        'singleton_groups': sum(len(v) == 1 for v in group_members.values()),
        'multi_company_groups': sum(len(v) > 1 for v in group_members.values()),
        'co_membership_pairs_not_direct_edges': len(group_pairs),
        'actual_size_min_median_max': [min(map(len, group_members.values())), float(np.median(list(map(len, group_members.values())))), max(map(len, group_members.values()))],
        'example': {g: sorted(group_members[g]) for g in sorted(group_members)[:3]},
    }
    audit['company_attributes'] = {k: distribution(small['companies'], k) for k in ['country', 'currency', 'erp']}
    audit['company_created_at_range'] = [min(r['created_at'] for r in companies.values()), max(r['created_at'] for r in companies.values())]
    audit['attribute_pairs'] = {}
    for field in ['country', 'currency', 'erp']:
        mapping = defaultdict(set)
        for row in companies.values():
            if row[field]:
                mapping[row[field]].add(row['company_id'])
        p = pairs(mapping)
        audit['attribute_pairs'][field] = {'pairs': len(p), 'example': list(next(iter(p), ())), 'missing': sum(not r[field] for r in companies.values())}
    products = small['banking_products'] + small['debt_products']
    owners = defaultdict(set)
    all_product_owners = defaultdict(set)
    product_map = {}
    for r in products:
        owners[r['product_id']].add(r['company_id'])
        product_map[r['product_id']] = r
    for name in ['banking_products', 'debt_products', 'balances', 'debt_schedule_config']:
        for r in small[name]:
            all_product_owners[r['product_id']].add(r['company_id'])
    audit['products'] = {
        'rows': len(products), 'unique_ids': len(owners),
        'unknown_company_rows': sum(r['company_id'] not in companies for r in products),
        'banking_debt_overlap': sorted({r['product_id'] for r in small['banking_products']} & {r['product_id'] for r in small['debt_products']}),
        'shared_product_ids': {k: sorted(v) for k, v in owners.items() if len(v) > 1},
        'type_counts': distribution(products, 'type'),
        'custom_type_counts': distribution([r for r in products if r['bank_name'] == 'Other (customer-defined)'], 'type'),
        'custom_examples': [r for r in products if r['bank_name'] == 'Other (customer-defined)'][:3],
        'guarantee_rows': [r for r in products if r['type'] == 'guarantee'],
        'bank_names': distribution(products, 'bank_name'),
    }
    bank_members = defaultdict(set)
    for r in products:
        if r['bank_name'] and r['bank_name'] != 'Other (customer-defined)':
            bank_members[r['bank_name']].add(r['company_id'])
    bp = pairs(bank_members)
    audit['shared_bank'] = {'pairs': len(bp), 'companies': len(set().union(*bank_members.values())),
                            'bank_company_counts': {k: len(v) for k, v in sorted(bank_members.items())},
                            'example': [{'company_a': a, 'company_b': b, 'banks': [k for k, v in bank_members.items() if a in v and b in v]} for a, b in list(bp)[:2]]}
    settlements = []
    settlement_members = defaultdict(set)
    for r in small['debt_schedule_config']:
        target = r['settlement_product_id']
        target_owners = sorted(owners.get(target, set()))
        relation = 'missing' if not target else 'unresolved' if not target_owners else 'same_company' if target_owners == [r['company_id']] else 'cross_company'
        settlements.append({**r, 'settlement_owners': target_owners, 'relation': relation})
        if target:
            settlement_members[target].add(r['company_id'])
    audit['settlements'] = {'status_counts': dict(Counter(r['relation'] for r in settlements)),
                            'cross_company_rows': [r for r in settlements if r['relation'] == 'cross_company'],
                            'unresolved_rows': [r for r in settlements if r['relation'] == 'unresolved'],
                            'shared_settlement_pairs': len(pairs(settlement_members)),
                            'unique_nonempty_accounts': len(settlement_members), 'examples': settlements[:3]}
    audit['small_reference_checks'] = {}
    for name in ['balances', 'debt_schedule_config']:
        rows = small[name]
        audit['small_reference_checks'][name] = {
            'unknown_company_rows': sum(r['company_id'] not in companies for r in rows),
            'unknown_product_rows': sum(r['product_id'] not in owners for r in rows),
            'owner_mismatch_rows': [r for r in rows if r['product_id'] in owners and r['company_id'] not in owners[r['product_id']]],
            'shared_product_ids': {p: sorted({r['company_id'] for r in rows if r['product_id'] == p}) for p in {r['product_id'] for r in rows} if len({r['company_id'] for r in rows if r['product_id'] == p}) > 1},
        }
    incidence = defaultdict(Counter)
    incidence_example = {}
    all_structured_cp = set()
    all_text_cp = set()
    cp_regex = re.compile(r'\bCOUNTERPARTY_\d+\b')
    entity_regex = re.compile(r'\b(?:COMP|GROUP|PRODUCT)_\d+\b')
    placeholder_regex = re.compile(r'\[(?:COMPANY|PERSON|NAME|IBAN|ACCOUNT|CARD|TAXID|EMAIL|PHONE|URL|ADDRESS|REF|NUM|X)\]')
    for name, id_field, text_field in [('transactions', 'transaction_id', 'description'), ('invoices', 'operation_id', 'concept')]:
        counts = Counter()
        missing = Counter()
        categories = Counter()
        cp_ids = set()
        text_cp_ids = set()
        company_ids = set()
        entity_matches = []
        identity_owners = {}
        multi_identity = defaultdict(set)
        seen_products = defaultdict(set)
        examples = {}
        direct = defaultdict(lambda: [0, Decimal(0)])
        direct_currencies = defaultdict(set)
        categorical = defaultdict(Counter)
        placeholders = Counter()
        dates = []
        with (DATA / (name + '.csv')).open(newline='', encoding='utf-8') as stream:
            reader = csv.DictReader(stream)
            columns = reader.fieldnames
            initial = []
            for r in reader:
                counts['rows'] += 1
                if len(initial) < 3:
                    initial.append(r)
                for k, v in r.items():
                    if not v:
                        missing[k] += 1
                company, cp, identifier = r['company_id'], r['counterparty_id'], r[id_field]
                company_ids.add(company)
                if company not in companies:
                    counts['unknown_company_rows'] += 1
                if identifier in identity_owners:
                    counts['duplicate_id_rows'] += 1
                    if company != identity_owners[identifier]:
                        multi_identity[identifier].update([company, identity_owners[identifier]])
                else:
                    identity_owners[identifier] = company
                if cp:
                    counts['counterparty_nonempty_rows'] += 1
                    cp_ids.add(cp)
                    key = (name, 'column', cp)
                    incidence[key][company] += 1
                    incidence_example.setdefault((key, company), identifier)
                if cp in companies:
                    counts['direct_company_counterparty_rows'] += 1
                    pair = (company, cp)
                    direct[pair][0] += 1
                    direct[pair][1] += Decimal(r['amount'])
                    direct_currencies[pair].add(r.get('currency') or product_map.get(r.get('product_id'), {}).get('currency', 'unknown'))
                text_ids = set(cp_regex.findall(r[text_field]))
                if text_ids:
                    counts['text_counterparty_rows'] += 1
                    text_cp_ids.update(text_ids)
                    if not cp:
                        counts['text_counterparty_blank_column_rows'] += 1
                        examples.setdefault('text_only_counterparty', r)
                    if cp and cp not in text_ids:
                        counts['column_counterparty_absent_from_text_rows'] += 1
                        examples.setdefault('column_text_different', r)
                    if len(text_ids) > 1:
                        counts['multiple_text_counterparty_rows'] += 1
                        examples.setdefault('multiple_text_counterparties', r)
                    for text_cp in text_ids:
                        key = (name, 'text', text_cp)
                        incidence[key][company] += 1
                        incidence_example.setdefault((key, company), identifier)
                matches = entity_regex.findall(r[text_field])
                if matches:
                    counts['other_entity_id_text_rows'] += 1
                    if len(entity_matches) < 5:
                        entity_matches.append({'id': identifier, 'company_id': company, 'matches': matches, 'text': r[text_field]})
                placeholders.update(set(placeholder_regex.findall(r[text_field])))
                if name == 'transactions':
                    category = r['category']
                    categories[category] += 1
                    product = r['product_id']
                    seen_products[product].add(company)
                    if product not in owners:
                        counts['unknown_product_rows'] += 1
                    elif company not in owners[product]:
                        counts['product_owner_mismatch_rows'] += 1
                        examples.setdefault('product_owner_mismatch', r)
                    if category == 'transfer':
                        counts['transfer_rows'] += 1
                        counts['transfer_with_counterparty_rows'] += bool(cp)
                        counts['transfer_company_counterparty_rows'] += cp in companies
                        counts['transfer_with_text_counterparty_rows'] += bool(text_ids)
                        examples.setdefault('transfer', r)
                else:
                    for k in ['document_type', 'currency', 'accounting_currency', 'status']:
                        categorical[k][r[k]] += 1
                if counts['rows'] % 500000 == 0:
                    print(name, counts['rows'], flush=True)
        all_structured_cp.update(cp_ids)
        all_text_cp.update(text_cp_ids)
        for product, member_set in seen_products.items():
            all_product_owners[product].update(member_set)
        audit['files'][name + '.csv'] = {'rows': counts['rows'], 'columns': columns, 'missing': dict(missing), 'examples': initial}
        audit[name] = {
            'counts': dict(counts), 'unique_companies': len(company_ids), 'unique_counterparties': len(cp_ids),
            'counterparty_examples': sorted(cp_ids)[:5], 'counterparty_company_id_intersection': sorted(cp_ids & companies.keys()),
            'unique_text_counterparties': len(text_cp_ids), 'text_ids_absent_from_own_column': len(text_cp_ids - cp_ids),
            'text_counterparty_examples': sorted(text_cp_ids)[:5],
            'examples': examples, 'other_entity_text_examples': entity_matches,
            'duplicate_ids_across_companies': {k: sorted(v) for k, v in multi_identity.items()},
            'unique_record_ids': len(identity_owners), 'categories': dict(categories),
            'categorical_values': dict(categorical), 'placeholder_row_counts': dict(placeholders),
            'shared_products': {k: sorted(v) for k, v in seen_products.items() if len(v) > 1},
            'unique_products': len(seen_products),
            'direct_pairs': [{'company_a': a, 'company_b': b, 'count': v[0], 'total_amount': str(v[1]), 'currencies': sorted(direct_currencies[a, b])} for (a, b), v in sorted(direct.items())],
        }
        print(name, json.dumps(audit[name]['counts']), flush=True)
    audit['all_product_ownership'] = {'unique_product_ids': len(all_product_owners), 'shared_ids': {k: sorted(v) for k, v in all_product_owners.items() if len(v) > 1}}
    audit['counterparty_spaces'] = {'structured_union': len(all_structured_cp), 'text_union': len(all_text_cp), 'text_absent_all_structured': len(all_text_cp - all_structured_cp)}
    with (OUT / 'relationship_incidence.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream)
        writer.writerow(['source', 'evidence_kind', 'counterparty_id', 'company_id', 'row_count', 'example_record_id'])
        for key in sorted(incidence):
            for company, count in sorted(incidence[key].items()):
                writer.writerow([*key, company, count, incidence_example[key, company]])
    cp_maps = {}
    for source in ['transactions', 'invoices']:
        for kind in ['column', 'text']:
            cp_maps[source + '_' + kind] = {cp: set(members) for (s, k, cp), members in incidence.items() if s == source and k == kind}
    combined = defaultdict(set)
    combined_all = defaultdict(set)
    for label, mapping in cp_maps.items():
        for cp, members in mapping.items():
            combined_all[cp].update(members)
            if label.endswith('_column'):
                combined[cp].update(members)
    cp_maps['structured_union'] = combined
    cp_maps['column_and_text_union'] = combined_all
    audit['shared_counterparties'] = {}
    for name, mapping in cp_maps.items():
        p = pairs(mapping)
        audit['shared_counterparties'][name] = {
            'counterparties': len(mapping), 'shared_counterparties': sum(len(v) > 1 for v in mapping.values()),
            'max_companies_per_counterparty': max(map(len, mapping.values()), default=0),
            'pairs': len(p), 'pair_evidence_count': sum(p.values()), 'within_group_pairs': len(p.keys() & group_pairs.keys()),
            'participating_companies': len({c for pair in p for c in pair}),
            'weight_min_max': [min(p.values(), default=0), max(p.values(), default=0)],
            'top_pairs': [{'company_a': a, 'company_b': b, 'shared_count': n,
                           'counterparty_examples': [cp for cp, members in mapping.items() if a in members and b in members][:5]}
                          for (a, b), n in p.most_common(5)],
        }
    tx = cp_maps['transactions_column']
    inv = cp_maps['invoices_column']
    cross = Counter()
    for cp in tx.keys() & inv.keys():
        cross.update({tuple(sorted((a, b))) for a in tx[cp] for b in inv[cp] if a != b})
    audit['shared_counterparties']['cross_source'] = {
        'ids_in_both_files': len(tx.keys() & inv.keys()), 'pairs': len(cross), 'pair_evidence_count': sum(cross.values()),
        'within_group_pairs': len(cross.keys() & group_pairs.keys()),
        'examples': [{'company_a': a, 'company_b': b, 'shared_count': n,
                      'counterparties': [cp for cp in tx.keys() & inv.keys() if (a in tx[cp] and b in inv[cp]) or (b in tx[cp] and a in inv[cp])][:5]} for (a, b), n in cross.most_common(3)]}
    structured_pairs = pairs(combined)
    enriched_pairs = pairs(combined_all)
    audit['shared_counterparties']['text_addition'] = {'additional_pairs': len(enriched_pairs.keys() - structured_pairs.keys()), 'additional_counterparties': len(set(combined_all) - set(combined))}
    score_rows = []
    scores = {}
    for path in sorted(SCORES.glob('*.json')):
        value = json.loads(path.read_text())
        assert path.stem == value['company_id']
        assert value['company_id'] not in scores
        scores[value['company_id']] = value
    audit['scores'] = {'files': len(scores), 'unknown_companies': sorted(scores.keys() - companies.keys()), 'missing_companies': sorted(companies.keys() - scores.keys())}
    for cid, company in sorted(companies.items()):
        score = scores.get(cid, {})
        base = score.get('base_score')
        trajectory = score.get('trajectory')
        cluster = ''
        band = ''
        if base is not None:
            low = min(90, int(base // 10) * 10)
            band = f'{low}-{low + 10}'
            if trajectory in ['improving', 'stable', 'deteriorating']:
                cluster = band + '|' + trajectory
        score_rows.append({'company_id': cid, 'final_score': score.get('final_score'), 'trajectory': trajectory,
                           'persistence': score.get('persistence'), **{k: v for k, v in company.items() if k != 'company_id'},
                           'base_score': base, 'base_score_band': band, 'behavioral_cohort': cluster,
                           'group_size_in_sample': len(group_members[company['group_id']]),
                           'group_erp': next(r['erp'] for r in small['groups'] if r['group_id'] == company['group_id']),
                           'coverage_pct': score.get('confidence', {}).get('coverage_pct'),
                           'months_available': score.get('confidence', {}).get('months_available'),
                           'currency_scope': score.get('confidence', {}).get('currency_scope'),
                           'rule_version': score.get('rule_version'), 'data_cutoff': score.get('data_cutoff'),
                           'primary_fallback_used': score.get('window_usage', {}).get('primary', {}).get('fallback_used'),
                           'drift_fallback_used': score.get('window_usage', {}).get('drift_detection', {}).get('fallback_used')})
    with (OUT / 'graph_nodes.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(score_rows[0]))
        writer.writeheader()
        writer.writerows(score_rows)
    audit['scores']['distributions'] = {k: dict(Counter(str(r[k]) for r in score_rows)) for k in ['trajectory', 'persistence', 'currency_scope', 'rule_version', 'behavioral_cohort', 'primary_fallback_used', 'drift_fallback_used']}
    audit['scores']['null_base'] = sum(r['base_score'] is None for r in score_rows)
    audit['scores']['null_final'] = sum(r['final_score'] is None for r in score_rows)
    audit['scores']['ranges'] = {k: [min(r[k] for r in score_rows if r[k] is not None), max(r[k] for r in score_rows if r[k] is not None)] for k in ['base_score', 'final_score', 'coverage_pct', 'months_available']}
    audit['scores']['examples'] = score_rows[:3]
    cohorts = defaultdict(set)
    for r in score_rows:
        if r['behavioral_cohort']:
            cohorts[r['behavioral_cohort']].add(r['company_id'])
    audit['scores']['cohorts'] = [{'cohort': k, 'companies': len(v), 'examples': sorted(v)[:3]} for k, v in sorted(cohorts.items())]
    audit['scores']['cohort_pairs_not_edges'] = len(pairs(cohorts))
    valid = [r for r in score_rows if r['base_score'] is not None]
    a, b = np.triu_indices(len(valid), 1)
    group = np.array([r['group_id'] for r in valid])
    same = group[a] == group[b]
    traj = np.array([r['trajectory'] for r in valid])
    known = np.isin(traj, ['improving', 'stable', 'deteriorating'])
    known_pair = known[a] & known[b]
    group_stats = {}
    for k in ['base_score', 'final_score']:
        values = np.array([r[k] for r in valid], dtype=float)
        diffs = abs(values[a] - values[b])
        group_stats[k] = {'within_pairs': int(same.sum()), 'between_pairs': int((~same).sum()),
                          'within_mean_absolute_difference': float(diffs[same].mean()), 'between_mean_absolute_difference': float(diffs[~same].mean()),
                          'within_median_absolute_difference': float(np.median(diffs[same])), 'between_median_absolute_difference': float(np.median(diffs[~same]))}
        if k == 'base_score':
            for threshold in [5, 10, 15]:
                peer = (diffs <= threshold) & (traj[a] == traj[b]) & known_pair
                group_stats['peers_' + str(threshold)] = {'pairs': int(peer.sum()), 'within_pairs': int((peer & same).sum()), 'between_pairs': int((peer & ~same).sum()),
                                                         'within_eligible_pairs': int((same & known_pair).sum()), 'between_eligible_pairs': int((~same & known_pair).sum())}
            observed = float(diffs[same].mean())
            rng = np.random.default_rng(20260919)
            ai, bi = a[same], b[same]
            null = np.array([np.abs((shuffled := rng.permutation(values))[ai] - shuffled[bi]).mean() for _ in range(2000)])
            group_stats['permutation_base_difference'] = {'iterations': 2000, 'seed': 20260919, 'observed': observed, 'null_mean': float(null.mean()),
                                                         'null_95_percent_interval': list(map(float, np.quantile(null, [.025, .975]))),
                                                         'p_one_sided_more_similar': float((1 + (null <= observed).sum()) / 2001)}
    group_stats['trajectory'] = {'within_known_pairs': int((same & known_pair).sum()), 'between_known_pairs': int((~same & known_pair).sum()),
                                 'within_agreement': float((traj[a] == traj[b])[same & known_pair].mean()),
                                 'between_agreement': float((traj[a] == traj[b])[~same & known_pair].mean())}
    valid_by_id = {r['company_id']: r for r in valid}
    group_examples = []
    for x, y in group_pairs:
        if x in valid_by_id and y in valid_by_id:
            group_examples.append({'company_a': x, 'company_b': y, 'group_id': companies[x]['group_id'],
                                   'base_a': valid_by_id[x]['base_score'], 'base_b': valid_by_id[y]['base_score'],
                                   'trajectory_a': valid_by_id[x]['trajectory'], 'trajectory_b': valid_by_id[y]['trajectory']})
    group_stats['most_different_example'] = max(group_examples, key=lambda r: abs(r['base_a'] - r['base_b']))
    group_stats['most_similar_example'] = min(group_examples, key=lambda r: abs(r['base_a'] - r['base_b']))
    audit['scores']['group_comparison'] = group_stats
    (OUT / 'relationship_audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: audit[k] for k in ['groups', 'settlements', 'shared_counterparties']}, ensure_ascii=False, indent=2), flush=True)
    print(json.dumps(audit['scores'], ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
