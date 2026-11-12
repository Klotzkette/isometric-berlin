"""Select exact ordinary LoD2 housing parts missing even the old overview sample."""

from __future__ import annotations

import json
from collections import defaultdict

from shapely.geometry import Polygon

from scripts.build_core_house_colours_v273 import (
  APP,
  ATTR,
  PRISMS,
  RESIDENTIAL,
  fnv,
  protections,
  source_guard,
  source_owners,
)
from scripts.build_north_mitte_colours_v271 import WALL_TONES

OUTPUT = APP / "data/coreFacadeFallback.json"


def compile_receipts() -> dict[str, list[list[int]]]:
  """Bind old source identities, all rings, heights and the absent sample."""
  parts = json.loads(PRISMS.read_text())["buildings"]
  attributes = json.loads(ATTR.read_text())
  owners = source_owners()
  protected, _ = protections()
  blocked_families = set()
  for part in parts:
    part_id = part["id"]
    index = attributes["prisms"].get(part_id)
    tags = attributes["records"][index]["tags"] if index is not None else {}
    for full_id, parent, name, _ in owners.get(part_id, []):
      if (
        name
        or {part_id, full_id, parent} & protected
        or any(
          key in tags
          for key in (
            "building:colour",
            "building:material",
            "facade:colour",
            "facade:material",
          )
        )
      ):
        blocked_families.add(parent or full_id)
  receipts: dict[str, list[list[int]]] = defaultdict(list)
  for part in parts:
    part_id = part["id"]
    matches = owners.get(part_id, [])
    if (
      part.get("tone")
      or len(matches) != 1
      or part["class"] != 0
      or not 50 <= part["h_dm"] <= 450
    ):
      continue
    full_id, parent, _, function = matches[0]
    family = parent or full_id
    if function not in RESIDENTIAL or family in blocked_families:
      continue
    polygon = Polygon(part["ring"], part.get("holes", []))
    if not polygon.is_valid or polygon.is_empty:
      continue
    receipt = [*source_guard(part), fnv(family) % len(WALL_TONES)]
    if receipt not in receipts[part_id]:
      receipts[part_id].append(receipt)
  return dict(sorted(receipts.items()))


def main() -> None:
  receipts = compile_receipts()
  OUTPUT.write_text(json.dumps(receipts, separators=(",", ":")) + "\n")
  print(
    f"{sum(map(len, receipts.values()))} retained housing parts in {OUTPUT.stat().st_size} bytes"
  )


if __name__ == "__main__":
  main()
