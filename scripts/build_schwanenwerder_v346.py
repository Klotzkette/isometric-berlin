"""Complete current-matched official Schwanenwerder villa families, exact old-owner transfer.

Every measured leaf, source wall/roof/hole stays in both representations. The
current OSM island/buildings delimit the finite requested scope; poorly aligned
ancillary footprints stay unchanged. No blanket new urban coverage or textures.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import inspect
import math
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import Detail, mesh_signature, packed_detail
from build_rixdorf_v304 import (
  exact_retirement,
  fingerprint,
  line_retirement,
  native_model,
  navigation,
  prepared_packets,
  read,
  rgb,
  roof_lines,
  sha,
  translated_surfaces,
  write,
)
from build_surrounding_outlines import chunk_payload, load_projected_polygon, world
from integrate_city_refinements_v166 import line_signature
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from isometric_berlin.data.fetch_osm import parse_hstore

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/islands-v346"
SOURCE = GEO / "schwanenwerder-v346-source.json.gz"
PLAN = DATA / "schwanenwerderV346Packets.json"
EVIDENCE = GEO / "schwanenwerder-v346-evidence.json.gz"
KIND = "schwanenwerder-v346"


def osm_id(r):
  return (
    ("OSM-way-" + r.osm_way_id)
    if isinstance(r.osm_way_id, str)
    else ("OSM-relation-" + str(r.osm_id))
  )


def extract():
  current_path = RAW / "current.gpkg"
  if not current_path.exists():
    snapshot = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
    gpd.read_file(
      snapshot, layer="multipolygons", bbox=(13.1655, 52.4435, 13.1765, 52.452)
    ).to_file(current_path, layer="multipolygons", driver="GPKG")
  current = gpd.read_file(RAW / "current.gpkg", layer="multipolygons").to_crs(25833)
  current["geometry"] = current.geometry.map(world)
  island = current[current.osm_id == "16653908"].geometry.iloc[0]
  mapped = current[
    current.building.notna()
    & current.geometry.representative_point().map(island.covers)
  ]
  old = gpd.read_file(
    GEO / "raw/outskirts-v187/resolved-outlines.gpkg",
    layer="buildings",
    bbox=island.bounds,
  )
  old = old[old.geometry.representative_point().map(island.covers)]
  assert len(mapped) == 97 and len(old) == 97
  parents = []
  for archive in sorted(RAW.glob("LoD2_*.zip")):
    with zipfile.ZipFile(archive) as z:
      for name in z.namelist():
        if not name.endswith((".gml", ".xml")):
          continue
        with z.open(name) as f:
          for _, e in ET.iterparse(f, events=("end",)):
            if e.tag != "{" + NS["bldg"] + "}Building":
              continue
            try:
              parts = [part_profile(p) for p in leaf_building_parts(e) or [e]]
            except ValueError:
              e.clear()
              continue
            geom = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
            if island.covers(geom.representative_point()):
              matches = [
                r
                for _, r in mapped.iterrows()
                if geom.intersection(r.geometry).area / min(geom.area, r.geometry.area)
                > 0.5
              ]
              if matches:
                labels = []
                tags = []
                for r in matches:
                  t = parse_hstore(r.other_tags or "") | {
                    k: str(r[k])
                    for k in ["name", "building"]
                    if isinstance(r.get(k), str) and r[k]
                  }
                  t = {
                    k: v
                    for k, v in t.items()
                    if k
                    in {
                      "name",
                      "building",
                      "building:levels",
                      "building:colour",
                      "building:material",
                      "roof:colour",
                      "roof:material",
                      "roof:shape",
                      "addr:street",
                      "addr:housenumber",
                    }
                  }
                  tags.append(dict(id=osm_id(r), tags=t, geometry=mapping(r.geometry)))
                  labels.append(
                    t.get("name")
                    or (
                      "Inselstraße "
                      + t.get("addr:housenumber", "building " + osm_id(r))
                    )
                  )
                parents.append(
                  dict(
                    id=e.get(GML_ID),
                    parts=parts,
                    archive=archive.name,
                    labels=labels,
                    currentMatches=tags,
                  )
                )
            e.clear()
  geoms = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in parents
  }
  # Iteratively remove ambiguous components: no part of a retained old envelope
  # may be silently left over or concealed under a new unrelated official body.
  while True:
    union = unary_union(list(geoms.values()))
    selected = old[
      old.geometry.map(lambda g: g.intersection(union).area / g.area >= 0.70)
    ]
    excluded = old[~old.index.isin(selected.index)]
    reject = {
      pid
      for pid, g in geoms.items()
      if any(g.intersection(r.geometry).area > 1 for _, r in excluded.iterrows())
    }
    if not reject:
      break
    geoms = {k: g for k, g in geoms.items() if k not in reject}
  parents = [p for p in parents if p["id"] in geoms]
  originals = []
  for _, r in selected.iterrows():
    entry = {
      k: (None if isinstance(v, float) and not math.isfinite(v) else v)
      for k, v in r.items()
      if k != "geometry"
    }
    entry.update(
      geometry=mapping(r.geometry),
      replacementOwners=[
        k for k, g in geoms.items() if g.intersection(r.geometry).area > 0.5
      ],
      measuredCoverage=round(r.geometry.intersection(union).area / r.geometry.area, 6),
    )
    assert entry["replacementOwners"]
    originals.append(entry)
  transfers = []
  for name in [
    "outer-materials-v232-evidence.json.gz",
    "outer-materials-v254-evidence.json.gz",
    "outer-materials-v263-evidence.json.gz",
  ]:
    evidence = read(GEO / name)
    for r in originals:
      observed = evidence["owners"].get(r["sourceId"])
      if observed:
        transfers.append(
          dict(
            oldOwner=r["sourceId"],
            replacementOwners=r["replacementOwners"],
            source=name,
            sourceSha256=sha(GEO / name),
            observation=observed,
          )
        )
  source = dict(
    schemaVersion=1,
    island=mapping(island),
    parents=parents,
    oldOwners=originals,
    unmatchedOldOwners=sorted(set(old.sourceId) - {r["sourceId"] for r in originals}),
    materialTransfers=transfers,
    archives=[
      dict(
        url="https://gdi.berlin.de/data/a_lod2/atom/" + p.name,
        sha256=sha(p),
        license="dl-de/zero-2-0",
      )
      for p in sorted(RAW.glob("LoD2_*.zip"))
    ],
    mappedSource=dict(
      url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
      sha256=sha(GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"),
      license="ODbL-1.0",
      snapshot="2026-11-13",
    ),
    currentBuildings=[
      dict(
        id=osm_id(r),
        geometry=mapping(r.geometry),
        tags=parse_hstore(r.other_tags or ""),
      )
      for _, r in mapped.iterrows()
    ],
    references=[
      "https://www.berlin.de/tourismus/inseln/10383658-6228302-schwanenwerder.html",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075575",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075236",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09045954",
    ],
    policy="All complete official families matched to current island buildings. Exact old fallback triangles/roof ink/navigation transfer atomically. Source roofs and volumes measured; facade window spacing, reveals and neutral finish estimates. No unverified private residents, no invented shoreline footpath, no image pixels.",
  )
  print(
    "Selected",
    len(parents),
    "parents",
    len(originals),
    "old owners; retained",
    source["unmatchedOldOwners"],
  )
  write(SOURCE, source)


def models(source):
  parents = source["parents"]
  footprints = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in parents
  }
  occupied = unary_union(
    [shape(r["geometry"]) for r in source["oldOwners"]] + list(footprints.values())
  )
  observed = {}
  for row in source["materialTransfers"]:
    for pid in row["replacementOwners"]:
      observed[pid] = row["observation"]
  drawn, native, metrics = {}, {}, {}
  for p in parents:
    d = Detail()
    surfaces, _ = translated_surfaces(p)
    wall, roof = 0xDAD7CB, 0x737975
    tags = p["currentMatches"][0]["tags"]
    # Generic neutral material is explicitly an estimate; mapped roof evidence
    # takes precedence across replacement and is carried in the audit receipt.
    if tags.get("roof:material") in {"roof_tiles", "tile", "tiles"}:
      roof = 0x9C6955
    if tags.get("building") in {"garage", "garages", "shed", "hut"}:
      wall = 0xC5C3B6
    o = observed.get(p["id"], {})
    if o.get("wall"):
      wall = sum(int(c) << (16 - i * 8) for i, c in enumerate(o["wall"]))
    if o.get("roof"):
      roof = sum(int(c) << (16 - i * 8) for i, c in enumerate(o["roof"]))
    roof_triangles = []
    for s in surfaces:
      ts = triangles_for(s["rings"])
      d.triangles.extend(
        (t, rgb(roof if s["kind"] == "RoofSurface" else wall), "source " + s["kind"])
        for t in ts
      )
      if s["kind"] == "RoofSurface":
        roof_triangles.extend(ts)
    openings = 0
    if tags.get("building") not in {"garage", "garages", "shed", "hut"}:
      openings = sum(
        facade(d, s, p, occupied, footprints[p["id"]])
        for s in surfaces
        if s["kind"] == "WallSurface"
      )
    n, caps = native_model(d)
    drawn[p["id"]] = d
    native[p["id"]] = n
    metrics[p["id"]] = dict(
      labels=p["labels"],
      parts=len(p["parts"]),
      sourceSheets=len(surfaces),
      drawnTriangles=len(d.triangles),
      nativeTriangles=len(n.triangles),
      estimatedOpenings=openings,
      roofTriangles=roof_triangles,
      nativeRoofCaps=caps,
    )
    print(p["id"], len(d.triangles), len(n.triangles), flush=True)
  return drawn, native, metrics


def facade(
  detail: Detail, surface: dict, parent: dict, occupied: Any, footprint: Any
) -> int:
  """Conservative wall-backed openings; no invented dormers or fake court fill."""
  ring = surface["rings"][0]
  horizontal = [
    (a, b) for a, b in zip(ring, ring[1:] + ring[:1]) if abs(a[1] - b[1]) < 0.02
  ]
  if not horizontal:
    return 0
  a, b = max(horizontal, key=lambda q: math.dist(q[0], q[1]))
  av, bv = np.array(a)[[0, 2]], np.array(b)[[0, 2]]
  w = np.linalg.norm(bv - av)
  if w < 2.5:
    return 0
  d = (bv - av) / w
  n = np.array([-d[1], d[0]])
  if footprint.covers(Point((av + bv) / 2 + n * 0.15)):
    n = -n
  # Interior joins between source leaf parts are not street or courtyard walls.
  if occupied.contains(Point((av + bv) / 2 + n * 0.35)):
    return 0
  plane = Polygon([[(np.array(p)[[0, 2]] - av).dot(d), p[1]] for p in ring])
  if not plane.is_valid:
    plane = plane.buffer(0)
  lower, upper = min(p[1] for p in ring), max(p[1] for p in ring)
  eave = (
    min(max(a[1], b[1]) for a, b in horizontal if max(a[1], b[1]) > lower + 0.5)
    if any(max(a[1], b[1]) > lower + 0.5 for a, b in horizontal)
    else upper
  )
  height = eave - lower
  if height < 2.4:
    return 0
  village = (
    max(p["top_y_m"] for p in parent["parts"])
    - min(p["ground_y_m"] for p in parent["parts"])
    < 14
  )
  pitch = 3.05 if village else 3.45
  rows = max(1, int((height + 0.15) / pitch))
  count = max(1, int(w / (3.0 if village else 2.9)))
  openings = 0

  def pane(
    u: float, y: float, ww: float, hh: float, color: int, role: str, out: float = 0.10
  ) -> bool:
    if not plane.buffer(0.001).covers(
      box(u - ww / 2, y - hh / 2, u + ww / 2, y + hh / 2)
    ):
      return False
    q = []
    for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
      xz = av + d * (u + dx * ww / 2) + n * out
      q.append([float(xz[0]), y + dy * hh / 2, float(xz[1])])
    normal = np.cross(np.array(q[1]) - q[0], np.array(q[2]) - q[0])
    if np.dot(normal[[0, 2]], n) < 0:
      q.reverse()
    detail.polygon(q, rgb(color), role)
    return True

  for row in range(rows):
    y = lower + (row + 0.53) * height / rows
    h = min(1.75 if village else 2.05, height / rows * 0.58)
    for col in range(count):
      u = (col + 0.5) * w / count
      ww = min(1.0 if village else 1.25, w / count * 0.48)
      if pane(u, y, ww + 0.18, h + 0.18, 0xDED8C9, "estimated window reveal", 0.055):
        pane(u, y, ww, h, 0x53696B, "estimated window glazing", 0.07)
        pane(u, y, 0.055, h, 0xE1DECF, "estimated window mullion", 0.09)
        pane(u, y + 0.15, ww, 0.055, 0xE1DECF, "estimated window transom", 0.09)
        pane(
          u, y - h / 2 - 0.11, ww + 0.22, 0.12, 0xC4BFAC, "estimated stone sill", 0.13
        )
        openings += 1
  pane(w / 2, lower + 0.22, w - 0.1, 0.30, 0xADA99A, "estimated plinth", 0.065)
  pane(w / 2, eave - 0.14, w - 0.1, 0.16, 0xD9D1BA, "estimated eave course", 0.09)
  return openings


def replay_datum(counter, origin, nav, points=3):
  """Replay the published V190 first-contributing owner offset without tolerance."""
  owners = [
    (
      translate(Polygon(q["ring"], q["holes"]), origin[0], origin[2]).buffer(0.1),
      q.get("groundOffset", 0),
    )
    for q in nav
  ]
  out = Counter()
  for key, count in counter.items():
    rows = np.frombuffer(key, dtype="<u2").reshape(points, 6).copy()
    centre = Point(
      float(rows[:, 0].mean()) / 100 + origin[0],
      float(rows[:, 2].mean()) / 100 + origin[2],
    )
    dy = next((offset for g, offset in owners if g.covers(centre)), 0)
    rows[:, 1] = rows[:, 1].astype(int) + round(dy * 100)
    out[b"".join(sorted(row.tobytes() for row in rows))] += count
  return out


def build(source: dict) -> None:
  descriptors = [
    d
    for d in read(OUT / "manifest.json")["chunks"]
    if d["id"].startswith("outer187-") and not d.get("detailCompanionOf")
  ]
  old = source["oldOwners"]
  scope = world(load_projected_polygon(GEO / "bounds-outskirts-v187.geojson"))
  source_footprints = [
    Polygon(p["ring"], p["holes"])
    for parent in source["parents"]
    for p in parent["parts"]
  ]
  selected = [
    d
    for d in descriptors
    if any(shape(r["geometry"]).intersects(box(*d["bounds"])) for r in old)
    or any(g.intersects(box(*d["bounds"])) for g in source_footprints)
  ]
  paths = [OUT / d[mode]["url"] for d in selected for mode in ["drawn", "minecraft"]]
  predecessor = prepared_packets(paths)
  # Ignored, source-and-compiler-bound offline cache saves repeated voxel work.
  # It never enters the viewer or release source and is safe to delete.
  signature = sha(SOURCE) + "".join(
    inspect.getsource(f) for f in [models, facade, native_model, translated_surfaces]
  )
  cache = (
    GEO
    / "raw"
    / (
      "schwanenwerder-v346-"
      + hashlib.sha256(signature.encode()).hexdigest()[:16]
      + ".json.gz"
    )
  )
  if cache.exists():
    saved = read(cache)
    drawn, native = {}, {}
    for key, target in [("drawn", drawn), ("native", native)]:
      for owner, triangles in saved[key].items():
        d = Detail()
        d.triangles = triangles
        target[owner] = d
    metrics = saved["metrics"]
  else:
    drawn, native, metrics = models(source)
    write(
      cache,
      {
        "drawn": {k: v.triangles for k, v in drawn.items()},
        "native": {k: v.triangles for k, v in native.items()},
        "metrics": metrics,
      },
    )
  parents = {p["id"]: p for p in source["parents"]}
  footprints = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in source["parents"]
  }
  plans, receipts, ownerkeys = {}, [], defaultdict(list)
  for desc in selected:
    tile = box(*desc["bounds"])
    tileowners = [r for r in old if shape(r["geometry"]).intersects(tile)]
    tileparents = [
      p for p, g in footprints.items() if g.intersection(tile).area > 0.00001
    ]
    for mode in ["drawn", "minecraft"]:
      is_native = mode == "minecraft"
      path = OUT / desc[mode]["url"]
      raw = read(path)
      pred = predecessor[str(path)]
      prepared = pred["prepared"]
      actualold = [
        r
        for r in tileowners
        if any(q["sourceId"] == r["sourceId"] for q in prepared["nav"]["buildings"])
      ]
      if not actualold and not tileparents:
        continue
      key = mode + ":" + desc["id"]
      expected, expectedlines = Counter(), Counter()
      for r in actualold:
        owner = {**r, "geometry": shape(r["geometry"])}
        full = chunk_payload(
          desc["id"], tile, scope.intersection(tile), [owner], {}, minecraft=is_native
        )
        empty = chunk_payload(
          desc["id"], tile, scope.intersection(tile), [], {}, minecraft=is_native
        )
        expected.update(
          replay_datum(
            mesh_signature(full) - mesh_signature(empty),
            raw["origin"],
            raw["nav"]["buildings"],
          )
        )
        if not is_native:
          expectedlines.update(
            replay_datum(
              line_signature(full["lines"]) - line_signature(empty["lines"]),
              raw["origin"],
              raw["nav"]["buildings"],
              2,
            )
          )
        ownerkeys[r["sourceId"]].append(key)
      retire = exact_retirement(prepared, expected)
      retirelines = line_retirement(prepared, expectedlines)
      detail = Detail()
      for pid in tileparents:
        detail.triangles.extend((native if is_native else drawn)[pid].triangles)
      append = packed_detail(detail, tile)
      assert append is not None
      append["kind"] = KIND
      nav = [
        q
        for q in prepared["nav"]["buildings"]
        if q["sourceId"] in {r["sourceId"] for r in actualold}
      ]
      appendnav = [
        q
        for pid in tileparents
        for q in navigation(parents[pid], metrics[pid], tile, raw["origin"], is_native)
      ]

      def records(p: dict[str, Any]) -> list[dict[str, Any]]:
        return [
          dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
          for i, m in enumerate(p["meshes"])
        ]

      plan = {
        "origin": raw["origin"],
        "navGuard": pred["navGuard"],
        "lineGuard": pred["lineGuard"],
        "preparedNavGuard": pred["preparedNavGuard"],
        "preparedLineGuard": pred["preparedLineGuard"],
        "records": records(raw),
        "preparedRecords": records(prepared),
        "append": append,
        "appendFingerprint": fingerprint(append),
        "retire": retire,
        "retireLines": retirelines,
        "retireNav": nav,
        "appendNav": appendnav,
        "owners": tileparents,
      }
      ink = None if is_native else roof_lines(detail, tile, raw["origin"])
      if ink:
        plan["appendLines"] = ink
      nv = sum(
        len(base64.b64decode(m["positions"])) / 6 for m in prepared["meshes"] + [append]
      )
      ni = sum(
        len(base64.b64decode(m["indices"])) / 4 for m in prepared["meshes"] + [append]
      )
      assert nv <= 400000 and ni <= 2400000 and len(prepared["meshes"]) + 1 <= 16, (
        key,
        nv,
        ni,
      )
      plans[key] = plan
      receipts.append(
        dict(
          key=key,
          url=desc[mode]["url"],
          sourceSha256=sha(path),
          owners=[r["sourceId"] for r in actualold],
          replacementOwners=tileparents,
          retiredTriangles=sum(len(r["triangles"]) for r in retire),
          retiredLines=len(retirelines),
          vertices=int(nv),
          indices=int(ni),
          sourceParts=len(prepared["meshes"]),
          navRemoved=len(nav),
          navAdded=len(appendnav),
        )
      )
  assert set(ownerkeys) == {r["sourceId"] for r in old}
  # Every parent appears on each intersected existing tile; complete source
  # roofs and courts never depend on a single arbitrarily chosen owner tile.
  assert {p for q in plans.values() for p in q["owners"]} == set(parents)
  write(PLAN, dict(schemaVersion=1, keys=list(plans), packets=plans))
  counts = {
    "completeOfficialParents": len(parents),
    "oldOwners": len(old),
    "packets": len(plans),
    "sourceParts": sum(len(p["parts"]) for p in parents.values()),
    "sourceSheets": sum(m["sourceSheets"] for m in metrics.values()),
    "drawnTriangles": sum(m["drawnTriangles"] for m in metrics.values()),
    "nativeTriangles": sum(m["nativeTriangles"] for m in metrics.values()),
    "estimatedOpenings": sum(m["estimatedOpenings"] for m in metrics.values()),
    "runtimeBytes": PLAN.stat().st_size,
    "runtimeGzipBytes": len(gzip.compress(PLAN.read_bytes(), mtime=0)),
  }
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      runtimeSha256=sha(PLAN),
      counts=counts,
      receipts=receipts,
      parents=[
        dict(
          id=k,
          **{
            kk: vv
            for kk, vv in v.items()
            if kk not in {"roofTriangles", "nativeRoofCaps"}
          },
        )
        for k, v in metrics.items()
      ],
      preservedOldOwners=source["unmatchedOldOwners"],
      materialTransfers=source["materialTransfers"],
    ),
  )
  print(counts)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  build(read(SOURCE))
