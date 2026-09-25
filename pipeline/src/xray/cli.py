import argparse
import json
from pathlib import Path

from xray.evaluate import add_parser as add_evaluate_parser
from xray.evaluate import run_command as run_evaluate
from xray.export import build
from xray.load import read
from xray.relations import build as build_relations


def main() -> None:
    parser = argparse.ArgumentParser(prog="xray")
    commands = parser.add_subparsers(dest="command", required=True)
    score = commands.add_parser("score", help="score every company and month and write the artifacts")
    score.add_argument("--data", type=Path, required=True, help="folder with the six Embat CSV files the score reads")
    score.add_argument("--out", type=Path, required=True, help="folder that receives the JSON artifacts")
    score.add_argument("--seed", type=int, default=42, help="seed that picks the held-out groups")
    relations = commands.add_parser("relations", help="detect inter-company relations and write relations.json")
    relations.add_argument("--data", type=Path, required=True, help="folder with the Embat CSV files")
    relations.add_argument("--out", type=Path, required=True, help="folder that receives relations.json")
    add_evaluate_parser(commands)
    args = parser.parse_args()
    if args.command == "evaluate":
        print(run_evaluate(args))
        return
    if args.command == "relations":
        summary = build_relations(args.data, args.out)
    else:
        summary = build(read(args.data), args.out, args.seed)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
