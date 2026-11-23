"""Bake independently supported street facades from the selected building and street records."""

import argparse
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

from PIL import ImageColor

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/district-fronts-v379-evidence.json.gz"
DATA = ROOT / "src/app/src/data"
MESH = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def ledger(data):
  return json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"


def paint(tags, photo):
  mapped = tags.get("building:colour", "").lower()
  try:
    red, green, blue = ImageColor.getrgb(mapped)
    color = red << 16 | green << 8 | blue
  except ValueError:
    color = photo.get("swatch")
  masonry = (tags.get("facade:material") or tags.get("building:material")) in {
    "brick",
    "bricks",
  }
  if color is None and not masonry:
    return []
  return [
    dict(
      kind="brick" if masonry else "spandrel",
      color=color if color is not None else 0x967365,
      x=[0, 1],
      y=[0, 1],
      columns=1,
      rows=1,
      fillX=1,
      fillY=1,
    )
  ]


def openings(tags, width, height):
  floors = int(tags["building:levels"])
  # The recorded use and storeys support lights on the upper floors; the
  # entrance and shop floor can have a different arrangement and are left open.
  pitch = {
    "office": 2.9,
    "school": 3.25,
    "university": 3.25,
    "dormitory": 3.05,
    "hotel": 3.35,
    "detached": 3.55,
    "house": 3.55,
  }.get(tags["building"], 3.55)
  cols = max(1, round((width - 0.85) / pitch))
  margin = min(0.43 / width, 0.09)
  roof = min(0.45 / height, 0.06)
  upper = (1 - roof) / floors
  return [
    dict(
      kind="window",
      x=[round(margin, 4), round(1 - margin, 4)],
      y=[round(upper, 4), round(1 - roof, 4)],
      rows=floors - 1,
      columns=cols,
      fillX=round(min(0.72, 1.65 / ((width - 0.86) / cols)), 3),
      fillY=round(min(0.67, 1.66 / (height * (1 - roof) / floors)), 3),
      color=0x687C83
      if tags["building"] in {"office", "school", "university"}
      else 0x74858A,
    )
  ]


def projection(target, source):
  """Register a cardinal native segment only against the same physical street frontage."""
  a, b = target["a"], target["b"]
  sa, sb = source["a"], source["b"]
  dx, dz = sa[0] - sb[0], sa[1] - sb[1]
  length = math.hypot(dx, dz)
  normal = source["normal"]
  if sum(x * y for x, y in zip(normal, target["normal"])) < 0.96:
    return None
  if (
    max(abs((c[0] - sb[0]) * normal[0] + (c[1] - sb[1]) * normal[1]) for c in (a, b))
    > 3.0
  ):
    return None
  u0, u1 = [((c[0] - sb[0]) * dx + (c[1] - sb[1]) * dz) / length**2 for c in (b, a)]
  if u0 < -0.06 or u1 > 1.06 or u1 - u0 < 0.16:
    return None
  return [round(max(0, u0), 5), round(min(1, u1), 5)]


def generate(source):
  # A region is shared by adjoining 4 x 4 km cells; both style records travel
  # together. An individual tile can never cause two region downloads.
  banks = defaultdict(lambda: {"profiles": [], "tiles": defaultdict(list)})
  profiles = defaultdict(dict)
  tile_regions = {}
  for row in source["sites"]:
    cx, cz = row["centre"]
    region = tile_regions.setdefault(
      row["tile"], f"r{math.floor(cx / 4096)}_{math.floor(cz / 4096)}"
    )
    bank = banks[region]
    for family, faces in row["fronts"].items():
      prepared = []
      for face in faces:
        inspected = face
        span = [0, 1]
        if family == "minecraft":
          for drawn in row["fronts"]["drawn"]:
            span0 = projection(face, drawn) if "photo" in drawn else None
            if span0:
              span, inspected = span0, drawn
              break
        photo = inspected.get("photo", {})
        width = math.dist(inspected["a"], inspected["b"])
        fitted = photo.get("profile", [])
        bands = paint(row["attributes"], photo)
        if not any(b["kind"] in {"window", "glazing", "arch"} for b in fitted):
          bands.extend(
            openings(row["attributes"], width, inspected["high"] - inspected["low"])
          )
        bands.extend(fitted)
        identity = json.dumps(bands, sort_keys=True)
        if identity not in profiles[region]:
          profiles[region][identity] = len(bank["profiles"])
          bank["profiles"].append(bands)
        prepared.append(
          [
            *face["b"],
            *face["a"],
            face["low"],
            face["high"],
            *span,
            0,
            1,
            profiles[region][identity],
          ]
        )
      bank["tiles"][family + ":" + row["tile"]].append(
        {"id": row["id"], "owner": row["id"], "faces": prepared}
      )
  index = defaultdict(list)
  for tile, region in sorted(tile_regions.items()):
    index[region].append(tile)
  return index, banks


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--check",
    action="store_true",
    help="Verify every output and source tile without writing.",
  )
  opts = parser.parse_args()
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  manifest = {
    x["id"]: x for x in json.loads((MESH / "manifest.json").read_bytes())["chunks"]
  }
  for tile, styles in source["source"]["hostPackets"].items():
    for family, sha in styles.items():
      desc = manifest[tile][family]
      if (
        sha != desc["sha256"]
        or hashlib.sha256((MESH / desc["url"]).read_bytes()).hexdigest() != sha
      ):
        raise ValueError(f"Source packet changed at {family}:{tile}")
  index, banks = generate(source)
  outputs = {
    DATA / "districtFrontsIndexV379.json": json.dumps(
      index, sort_keys=True, separators=(",", ":")
    )
    + "\n"
  }
  outputs.update(
    {
      DATA / "districtFrontsV379" / (region + ".json"): ledger(bank)
      for region, bank in banks.items()
    }
  )
  old = set((DATA / "districtFrontsV379").glob("*.json"))
  if old - outputs.keys():
    raise ValueError("Obsolete district region in the output directory")
  for path, text in outputs.items():
    if opts.check:
      if path.read_text() != text:
        raise ValueError(f"District facade output differs: {path}")
    else:
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_text(text)
  print(
    f"{len(source['sites'])} source owners, {len(source['source']['hostPackets'])} tiles, {len(banks)} regions"
  )


if __name__ == "__main__":
  main()
