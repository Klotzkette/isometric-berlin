"""Exact old closed colonnade proxy receipts; every unrelated owner stays."""

import json
from pathlib import Path

import build_townhall_core_previous_v227 as core

OWNERS = {"33885752": "DEBE00YYkm000061", "33887411": "DEBE01YYK00004G1"}
OUTPUT = (
  Path(__file__).resolve().parents[1]
  / "src/app/src/data/colonnadesCorePreviousV231.json"
)


def build() -> dict:
  """Reuse the audited native-row proof without changing its original constants."""
  previous = core.OWNERS
  try:
    core.OWNERS = OWNERS
    result = core.build()
  finally:
    core.OWNERS = previous
  result["schema"] = "colonnades-core-transfer-v231/1"
  result["policy"] = (
    "Exact full original prism equality and uncontested exact native rows only. "
    "Required open colonnades retain complete measured roofs, original upper fascia "
    "and mapped roof complement; complete original lower source sheets remain in evidence."
  )
  return result


if __name__ == "__main__":
  value = build()
  OUTPUT.write_text(json.dumps(value, separators=(",", ":")) + "\n")
  print({owner["prism"]["id"]: len(owner["columns"]) for owner in value["owners"]})
