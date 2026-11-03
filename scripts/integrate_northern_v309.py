"""Compose finite northern source transactions against complete v195 predecessors.

All component plans retain their independent evidence. This derivative joins
only compatible exact predecessors; overlapping retirements are rejected, not
silently hidden. Original public assets are never rewritten by this tool.
"""

from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import struct
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
ANCHOR = "9727870f79db9c6a6e9d6437668e5ac13229522f"
SOURCES = (
  "northQuarterV306.json",
  "railTerrainContactApproachV309Packets.json",
  "railBridgeApproachV307Packets.json",
  "railSseArchitectureV307Packets.json",
  "hospitalArchitectureV308Packets.json",
  "gesundbrunnenRoadBridgesV309Packets.json",
)
KIND = "northern-fidelity-v309"
OUTPUT = DATA / "northernFidelityV309Packets.json"


def fingerprint(text: str) -> int:
  """Original packet FNV over the complete ASCII binary source strings."""
  value = 2166136261
  for c in text:
    value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def merge_append(parts: list[dict]) -> dict | None:
  """Retain ordered triangle positions and exact final RGB, without rounding."""
  if not parts:
    return None
  positions = bytearray()
  colors = bytearray()
  indices: list[int] = []
  for part in parts:
    if part["positionType"] != "u16cm":
      raise ValueError("Unrecognised northern append positions")
    p = base64.b64decode(part["positions"], validate=True)
    c = base64.b64decode(part["colors"], validate=True)
    ix = base64.b64decode(part["indices"], validate=True)
    if len(p) % 6 or len(ix) % 12:
      raise ValueError("Unaligned complete northern append")
    if part.get("colorType", "u8") == "u8":
      c = b"".join(struct.pack("<H", byte * 257) for byte in c)
    elif part["colorType"] != "u16linear":
      raise ValueError("Unrecognised complete northern colour stream")
    if len(c) != len(p):
      raise ValueError("Complete northern colour count differs")
    offset, count = len(positions) // 6, len(p) // 6
    source_indices = struct.unpack(f"<{len(ix) // 4}I", ix)
    if any(i >= count for i in source_indices):
      raise ValueError("Complete northern append index escaped its source")
    positions.extend(p)
    colors.extend(c)
    indices.extend(i + offset for i in source_indices)
  return {
    "kind": KIND,
    "positionType": "u16cm",
    "colorType": "u16linear",
    "positions": base64.b64encode(positions).decode(),
    "colors": base64.b64encode(colors).decode(),
    "indices": base64.b64encode(struct.pack(f"<{len(indices)}I", *indices)).decode(),
  }


def compose_plans(plans: list[dict]) -> dict:
  """One unpublished transaction per exact raw/prepared packet predecessor."""
  first = plans[0]
  guards = (
    "origin",
    "records",
    "preparedRecords",
    "navGuard",
    "preparedNavGuard",
    "lineGuard",
    "preparedLineGuard",
  )
  if any(any(plan[k] != first[k] for k in guards) for plan in plans[1:]):
    raise ValueError("Northern components disagree on a complete predecessor")
  result = {key: copy.deepcopy(first[key]) for key in guards}
  retired: dict[int, set[int]] = {}
  lines: set[int] = set()
  nav: list[dict] = []
  nav_keys: set[str] = set()
  owners: set[str] = set()
  appended_nav: list[dict] = []
  line_appends: list[dict] = []
  for plan in plans:
    for row in plan["retire"]:
      values = set(row["triangles"])
      existing = retired.setdefault(row["mesh"], set())
      if len(values) != len(row["triangles"]) or existing & values:
        raise ValueError("Overlapping northern source-triangle retirement")
      existing.update(values)
    if lines.intersection(plan["retireLines"]):
      raise ValueError("Overlapping northern original ink retirement")
    lines.update(plan["retireLines"])
    for value in plan["retireNav"]:
      key = json.dumps(value, sort_keys=True, separators=(",", ":"))
      if key in nav_keys:
        raise ValueError("Overlapping northern original navigation retirement")
      nav_keys.add(key)
      nav.append(value)
    owners.update(plan["owners"])
    appended_nav.extend(plan["appendNav"])
    if plan.get("appendLines"):
      line_appends.append(plan["appendLines"])
  result.update(
    retire=[
      {"mesh": mesh, "triangles": sorted(rows)}
      for mesh, rows in sorted(retired.items())
    ],
    retireLines=sorted(lines),
    retireNav=nav,
    appendNav=appended_nav,
    owners=sorted(owners),
  )
  append = merge_append([p["append"] for p in plans if p.get("append")])
  if append:
    result["append"] = append
    result["appendFingerprint"] = fingerprint(
      append["positions"] + append["colors"] + append["indices"]
    )
  if line_appends:
    coloured = "colors" in line_appends[0]
    if any(("colors" in part) != coloured for part in line_appends):
      raise ValueError("Incompatible full northern ink formats")
    result["appendLines"] = {
      field: base64.b64encode(
        b"".join(base64.b64decode(part[field], validate=True) for part in line_appends)
      ).decode()
      for field in (["positions", "colors"] if coloured else ["positions"])
    }
  return result


def integrate(output: Path = OUTPUT) -> dict:
  """Compile and validate all finite sources before writing this new derivative."""
  import gzip

  sources = {name: json.loads((DATA / name).read_bytes()) for name in SOURCES}
  packets: dict[str, dict] = {}
  pins = {}
  for name, source in sources.items():
    if source["schemaVersion"] != 1 or set(source["keys"]) != source["packets"].keys():
      raise ValueError("Invalid complete component catalogue: " + name)
    pins[name] = hashlib.sha256((DATA / name).read_bytes()).hexdigest()
  for key in sorted({key for source in sources.values() for key in source["keys"]}):
    plans = [
      source["packets"][key] for source in sources.values() if key in source["packets"]
    ]
    plan = compose_plans(plans)
    mode, identity = key.split(":", 1)
    path = f"src/app/public/mesh/surrounding-berlin-v159/{identity}.{mode}.json.gz"
    wire = subprocess.check_output(["git", "show", f"{ANCHOR}:{path}"], cwd=ROOT)
    raw = json.loads(gzip.decompress(wire))
    expected = [
      {
        "mesh": i,
        "kind": p["kind"],
        "fingerprint": fingerprint(p["positions"] + p["colors"] + p["indices"]),
      }
      for i, p in enumerate(raw["meshes"])
    ]
    if plan["records"] != expected or plan["origin"] != raw["origin"]:
      raise ValueError("Changed complete v195 raw predecessor: " + key)
    # Prepared guards are verified by the actual production decoder in Bun QA.
    # Every source/prepared vertex remains allocated; retired indices degenerate.
    new_vertices = (
      len(base64.b64decode(plan["append"]["positions"])) // 6
      if plan.get("append")
      else 0
    )
    new_indices = (
      len(base64.b64decode(plan["append"]["indices"])) // 4 if plan.get("append") else 0
    )
    if (
      sum(len(base64.b64decode(p["positions"])) // 6 for p in raw["meshes"])
      + new_vertices
      > 400000
      or sum(len(base64.b64decode(p["indices"])) // 4 for p in raw["meshes"])
      + new_indices
      > 2400000
      or len(plan["preparedRecords"]) + int(bool(plan.get("append"))) > 16
    ):
      raise ValueError(
        "Northern transaction exceeds existing bounded tile limits: " + key
      )
    packets[key] = plan
  result = {"schemaVersion": 1, "keys": list(packets), "packets": packets}
  output.write_text(
    json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n"
  )
  return {
    "anchor": ANCHOR,
    "components": pins,
    "keys": list(packets),
    "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, default=OUTPUT)
  args = parser.parse_args()
  print(json.dumps(integrate(args.output), indent=2))
