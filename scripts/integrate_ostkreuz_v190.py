"""Step 10: subtract exactly four closed Ostkreuz proxies, preserve all else.

Publishing writes only the affected packets. The root integrator applies the
returned descriptor patch to the shared manifest, avoiding parallel overwrite.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
from typing import Any

import geopandas as gpd
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import DEFAULT_OUTPUT, ROOT, chunk_payload
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.geometry import Polygon, box, mapping

GEO = ROOT / "geo_data/regierungsviertel"
OWNERS = frozenset(
  "OSM-way-" + sid
  for sid in (
    "110639235",
    "463652072",
    "1228253162",
    "1228253163",
  )
)


def integrate(*, publish: bool = False) -> dict[str, Any]:
  """Require exact signature matches and prove unrelated surfaces unchanged."""
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  new_navigation = json.loads(
    (ROOT / "src/app/src/data/ostkreuzV190.json").read_text()
  )["navigation"]
  rows = gpd.read_file(GEO / "raw/ring-v182/resolved-outlines.gpkg", layer="buildings")
  records = [b for b in rows.to_dict("records") if b["sourceId"] in OWNERS]
  assert {b["sourceId"] for b in records} == OWNERS
  source_records = [
    {
      **{k: r[k] for k in ("sourceId", "height", "minHeight", "heightSource")},
      "geometry": mapping(r["geometry"]),
    }
    for r in records
  ]
  receipt_path = GEO / "ostkreuz-v190-packet-patch.json"
  if receipt_path.exists():
    prior = json.loads(receipt_path.read_text())
    if all(
      hashlib.sha256(
        (DEFAULT_OUTPUT / c["descriptor"][m]["url"]).read_bytes()
      ).hexdigest()
      == c["modes"][m]["newSha256"]
      for c in prior["chunks"]
      for m in ("drawn", "minecraft")
    ):
      prior["removedSourceRecords"] = source_records
      receipt_path.write_text(json.dumps(prior, indent=2) + "\n")
      return prior
  staged = {}
  changes = []
  for d in manifest["chunks"]:
    if not d["id"].startswith("ring182-"):
      continue
    tile = box(*d["bounds"])
    selected = [b for b in records if b["geometry"].intersects(tile)]
    if not selected:
      continue
    entry = {"id": d["id"], "modes": {}}
    descriptor = copy.deepcopy(d)
    for mode in ["drawn", "minecraft"]:
      path = DEFAULT_OUTPUT / d[mode]["url"]
      original_bytes = path.read_bytes()
      assert hashlib.sha256(original_bytes).hexdigest() == d[mode]["sha256"]
      original = json.loads(gzip.decompress(original_bytes))
      # These four source polygons are wholly inside the ring182 ground scope.
      # A tile is sufficient here, verified by every native signature matching.
      selected_packet = chunk_payload(
        d["id"], tile, tile, selected, {}, minecraft=mode == "minecraft"
      )
      empty_packet = chunk_payload(
        d["id"], tile, tile, [], {}, minecraft=mode == "minecraft"
      )
      remove = mesh_signature(selected_packet) - mesh_signature(empty_packet)
      before = mesh_signature(original)
      assert remove and not (remove - before), (
        d["id"],
        mode,
        sum((remove - before).values()),
      )
      payload = copy.deepcopy(original)
      payload["meshes"] = subtract_meshes(payload["meshes"], remove.copy())
      removed_lines = 0
      if mode == "drawn":
        line_remove = line_signature(selected_packet["lines"])
        assert not (line_remove - line_signature(original["lines"]))
        removed_lines = sum(line_remove.values())
        payload["lines"] = subtract_lines(payload["lines"], line_remove.copy())
      payload["nav"]["buildings"] = [
        b for b in original["nav"]["buildings"] if b["sourceId"] not in OWNERS
      ]
      replacements = []
      for nav in new_navigation:
        polygon = Polygon(nav["rings"][0], nav["rings"][1:]).intersection(tile)
        for part in polygon.geoms if polygon.geom_type == "MultiPolygon" else [polygon]:
          if part.is_empty or part.geom_type != "Polygon":
            continue

          def local(ring: Any) -> list[list[float]]:
            return [
              [round(x - original["origin"][0], 3), round(z - original["origin"][2], 3)]
              for x, z in ring.coords
            ]

          replacements.append(
            dict(
              ring=local(part.exterior),
              holes=[local(r) for r in part.interiors],
              height=nav["maxY"] - 3,
              minHeight=nav["minY"] - 3,
              sourceId="OSTKREUZ-V190-" + nav["id"],
              heightSource="represented thin roof/deck/platform/support; display grade",
            )
          )
      payload["nav"]["buildings"].extend(replacements)
      assert mesh_signature(payload) == before - remove
      for key in ["ground", "roads", "bridges", "water"]:
        assert payload["nav"].get(key) == original["nav"].get(key)
      assert all(
        b in payload["nav"]["buildings"]
        for b in original["nav"]["buildings"]
        if b["sourceId"] not in OWNERS
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
      entry["modes"][mode] = dict(
        oldSha256=d[mode]["sha256"],
        newSha256=descriptor[mode]["sha256"],
        removedTriangles=sum(remove.values()),
        preservedTriangles=sum((before - remove).values()),
        removedSourceInkSegments=removed_lines,
        replacementNavigationCount=len(replacements),
      )
      staged[path] = (original_bytes, packed)
    entry["descriptor"] = descriptor
    changes.append(entry)
  assert changes
  result = dict(
    version="1.0.90",
    ownerIds=sorted(OWNERS),
    removedSourceRecords=source_records,
    chunks=changes,
    unrelatedGeometryPreserved=True,
    district188Unchanged="The existing v188 selector excludes every non-DEBE source; no generic facade companion belongs to these four OSM owners.",
    sourceInventoryRetained="rail-stations-v190-evidence.json",
    policy="Only the exact four named OSM proxy source triangle/colour multisets and their exact roof ink are replaced by open station geometry. All unowned geometry and surface/navigation data remain.",
  )
  if publish:
    backup = GEO / "raw/rail-v190/previous-packets"
    backup.mkdir(parents=True, exist_ok=True)
    for path, (old, new) in staged.items():
      (backup / path.name).write_bytes(old)
      path.write_bytes(new)
  (GEO / "ostkreuz-v190-packet-patch.json").write_text(
    json.dumps(result, indent=2) + "\n"
  )
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--publish", action="store_true")
  args = parser.parse_args()
  print(json.dumps(integrate(publish=args.publish), indent=2))
