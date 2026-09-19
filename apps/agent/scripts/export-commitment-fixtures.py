import argparse
import hashlib
import importlib.util
import json
import random
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--oracle', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('commitment_reference', args.oracle)
if spec is None or spec.loader is None:
    raise SystemExit('Cannot load the supplied reference module')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ledger = {
    'company_id': 'DEMO', 'currency': 'EUR', 'as_of': '2026-09-01',
    'horizon_end': '2026-11-01', 'observed_months': 24,
    'opening_minor': 4000000, 'floor_minor': 2000000,
    'opening_verified': True, 'coverage_verified': True,
}
rng = random.Random(20260919)
cases = []
for case in range(100):
    events = [{'id': f'{case}-{i}', 'company_id': 'DEMO', 'currency': 'EUR', 'date': f'2026-09-{i + 2:02}', 'amount_minor': rng.randint(-500000, 500000)} for i in range(8)]
    cases.append({'ledger': ledger, 'events': events, 'expected': module.evaluate(ledger, events)})
    rng.shuffle(events)
payload = {'seed': 20260919, 'oracle_sha256': hashlib.sha256(args.oracle.read_bytes()).hexdigest(), 'cases': cases}
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(cases)} oracle cases to {args.out}')
