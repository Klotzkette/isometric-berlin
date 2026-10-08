"""Step10: exact six-owner Tempelhof proxy subtraction, all other geometry retained."""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import re

import geopandas as gpd
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  ROOT,
  chunk_payload,
  load_projected_polygon,
  world,
)
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.geometry import box, mapping

GEO = ROOT / "geo_data/regierungsviertel"
RECEIPT = GEO / "airports-v194-packet-patch.json"
OWNERS = frozenset(
  p["id"]
  for p in json.loads((GEO / "airports-v194-source.json").read_text())["parents"]
)


def signature_sha(counter) -> str:
  h = hashlib.sha256()
  for key, count in sorted(counter.items()):
    h.update(key)
    h.update(str(count).encode())
    h.update(b"\n")
  return h.hexdigest()


def integrate(publish: bool = False) -> dict:
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  if RECEIPT.exists():
    previous = json.loads(RECEIPT.read_text())
    if all(
      hashlib.sha256(
        (DEFAULT_OUTPUT / c["descriptor"][m]["url"]).read_bytes()
      ).hexdigest()
      == c["modes"][m]["newSha256"]
      for c in previous["chunks"]
      for m in ["drawn", "minecraft"]
    ):
      return previous
  sources = {}
  base = load_projected_polygon(GEO / "bounds.geojson")
  for key, path, scope in [
    (
      "outer",
      "outer-v159",
      base.difference(load_projected_polygon(GEO / "bounds-v158.geojson")),
    ),
    (
      "ring",
      "ring-v182",
      load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(base),
    ),
  ]:
    rows = gpd.read_file(GEO / f"raw/{path}/resolved-outlines.gpkg", layer="buildings")
    sources[key] = (
      [r for r in rows.to_dict("records") if r["sourceId"] in OWNERS],
      world(scope),
    )
  stages = {}
  changes = []
  for d in manifest["chunks"]:
    kind = (
      "ring"
      if d["id"].startswith("ring182-")
      else "outer"
      if re.fullmatch(r"-?\d+_-?\d+", d["id"])
      else None
    )
    if kind is None:
      continue
    tile = box(*d["bounds"])
    records, scope = sources[kind]
    owned = [r for r in records if r["geometry"].intersects(tile)]
    if not owned:
      continue
    descriptor = copy.deepcopy(d)
    change = {
      "id": d["id"],
      "ownerIds": sorted({r["sourceId"] for r in owned}),
      "modes": {},
    }
    for mode in ["drawn", "minecraft"]:
      path = DEFAULT_OUTPUT / d[mode]["url"]
      beforebytes = path.read_bytes()
      assert hashlib.sha256(beforebytes).hexdigest() == d[mode]["sha256"]
      old = json.loads(gzip.decompress(beforebytes))
      selected = chunk_payload(
        d["id"],
        tile,
        scope.intersection(tile),
        owned,
        {},
        minecraft=mode == "minecraft",
      )
      empty = chunk_payload(
        d["id"], tile, scope.intersection(tile), [], {}, minecraft=mode == "minecraft"
      )
      remove = mesh_signature(selected) - mesh_signature(empty)
      before = mesh_signature(old)
      assert remove and not remove - before, (
        d["id"],
        mode,
        sum((remove - before).values()),
      )
      payload = copy.deepcopy(old)
      payload["meshes"] = subtract_meshes(payload["meshes"], remove.copy())
      line_count = 0
      if mode == "drawn":
        lines = line_signature(selected["lines"]) - line_signature(empty["lines"])
        assert not lines - line_signature(old["lines"])
        line_count = sum(lines.values())
        payload["lines"] = subtract_lines(payload["lines"], lines.copy())
      payload["nav"]["buildings"] = [
        r for r in old["nav"]["buildings"] if r["sourceId"] not in OWNERS
      ]
      assert mesh_signature(payload) == before - remove
      for key in ["ground", "roads", "bridges", "water"]:
        assert payload["nav"].get(key) == old["nav"].get(key)
      assert all(
        r in payload["nav"]["buildings"]
        for r in old["nav"]["buildings"]
        if r["sourceId"] not in OWNERS
      )
      raw = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, mtime=0)
      descriptor[mode] = {
        **d[mode],
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      change["modes"][mode] = {
        "oldSha256": d[mode]["sha256"],
        "newSha256": descriptor[mode]["sha256"],
        "removedTriangles": sum(remove.values()),
        "removedSourceInkSegments": line_count,
        "preservedTriangles": sum((before - remove).values()),
        "preservedTriangleSha256": signature_sha(before - remove),
      }
      stages[path] = (beforebytes, packed)
    change["descriptor"] = descriptor
    changes.append(change)
  assert changes
  result = {
    "version": "1.0.94",
    "ownerIds": sorted(OWNERS),
    "chunks": changes,
    "sourceRecords": [
      {
        **{k: r[k] for k in ["sourceId", "height", "minHeight", "heightSource"]},
        "sourceScope": key,
        "geometry": mapping(r["geometry"]),
      }
      for key, (records, _) in sources.items()
      for r in records
    ],
    "policy": "Exact six retained LoD2 parents only. Each complete source sheet remains in airports-v194-source.json and is drawn by AirportsV194. New granular solids are provided by airportsV194Navigation. Every unowned triangle/colour multiset, unrelated nav record and source surface remains unchanged. No v188 companion belongs to these owners.",
    "unrelatedGeometryPreserved": True,
  }
  if publish:
    backup = GEO / "raw/airports-v194/previous-packets"
    backup.mkdir(parents=True, exist_ok=True)
    for path, (old, new) in stages.items():
      (backup / path.name).write_bytes(old)
      path.write_bytes(new)
  RECEIPT.write_text(json.dumps(result, indent=2) + "\n")
  return result


if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("--publish", action="store_true")
  a = p.parse_args()
  r = integrate(a.publish)
  print([(c["id"], c["modes"]["drawn"]["removedTriangles"]) for c in r["chunks"]])
