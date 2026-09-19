import argparse
import json
from pathlib import Path

from xray.export import build
from xray.load import read


def main() -> None:
    parser = argparse.ArgumentParser(prog="xray")
    commands = parser.add_subparsers(dest="command", required=True)
    score = commands.add_parser("score", help="score every company and month and write the artifacts")
    score.add_argument("--data", type=Path, required=True, help="folder with the nine Embat CSV files")
    score.add_argument("--out", type=Path, required=True, help="folder that receives the JSON artifacts")
    score.add_argument("--seed", type=int, default=42, help="seed that picks the held-out groups")
    args = parser.parse_args()
    summary = build(read(args.data), args.out, args.seed)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
