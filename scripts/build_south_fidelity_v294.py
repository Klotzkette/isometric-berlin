"""Step 10: finite retained-source companions for the requested southern sites.

No source packet, envelope, geographic coverage or public asset is rewritten.
This derives only small immutable plans and complete bounded owner receipts.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import pyogrio
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_steglitz_v182 import native_blocks
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box, mapping
from shapely.ops import triangulate

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"


def read(path: Path) -> dict[str, Any]:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: object) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def world(g: Any) -> Any:
  return affine_transform(g, [1, 0, 0, -1, -389500, 5820000])


def coords(g: Any) -> list[list[float]]:
  return [[round(x, 3), round(z, 3)] for x, z in g.coords]


def feature(row: Any) -> dict[str, Any]:
  g = world(row.geometry)
  return dict(
    id=("relation/" + str(row.osm_id))
    if isinstance(row.osm_id, str)
    else "way/" + str(row.osm_way_id),
    name=row["name"] if isinstance(row["name"], str) else "",
    tags=row.other_tags if isinstance(row.other_tags, str) else "",
    geometry=mapping(g),
  )


def build() -> None:
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  ids = [
    379305718,
    379346486,
    168901481,
    168901479,
    217402343,
    217402355,
    234288064,
    234288067,
    13759929,
    22989918,
    22989988,
    216503834,
    62182568,
    62182562,
    16213839,
    586090654,
    37853280,
    24315001,
    143429088,
  ]
  df = pyogrio.read_dataframe(
    raw,
    layer="multipolygons",
    where="osm_way_id IN (" + ",".join("'" + str(i) + "'" for i in ids) + ")",
  ).to_crs(25833)
  features = {str(r.osm_way_id): feature(r) for _, r in df.iterrows()}
  assert len(features) == len(ids)
  lines = pyogrio.read_dataframe(
    raw,
    layer="lines",
    where="osm_id IN ('155667522','155667526','384345627','384345628','384345629','384345630','384345631','384345632','65425836')",
  ).to_crs(25833)
  tracks = []
  passage = None
  for _, r in lines.iterrows():
    g = world(r.geometry)
    if r.osm_id == "65425836":
      passage = dict(
        id="way/65425836",
        points=coords(g),
        tags=r.other_tags,
        widthEstimateM=11.0,
        soffitY=7.5,
        groundY=3.0,
        signedMaxHeightM=4.0,
        endAlignmentEstimateM=1.5,
      )
      ps = passage["points"]
      dx = ps[-1][0] - ps[0][0]
      dz = ps[-1][1] - ps[0][1]
      le = math.hypot(dx, dz)
      passage["cutPoints"] = [
        [ps[0][0] - dx / le * 1.5, ps[0][1] - dz / le * 1.5],
        [ps[-1][0] + dx / le * 1.5, ps[-1][1] + dz / le * 1.5],
      ]
    else:
      g = g.intersection(box(3270, 1950, 4635, 2410))
      assert g.geom_type == "LineString" and g.length > 1
      tracks.append(
        dict(
          id="way/" + r.osm_id,
          points=coords(g),
          tags=r.other_tags,
          railY=9.04,
          deckTopY=8.93,
        )
      )
  assert passage and len(tracks) == 8
  # Whole original official source sheets remain a separate small evidence file.
  official = []
  for owner, archive, key in [
    ("DEBE02YY40001ISn", "LoD2_392_5817.zip", "nkz-main"),
    ("DEBE00YY1IW0004t", "LoD2_392_5817.zip", "nkz-west"),
    ("DEBE07YY900001Wl", "LoD2_388_5817.zip", "metropol"),
  ]:
    path = GEO / "raw/lod2" / archive
    parent = extract_parent(path, owner)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    official.append(
      dict(
        key=key,
        owner=owner,
        parts=parts,
        archiveUrl="https://gdi.berlin.de/data/a_lod2/atom/" + archive,
        archiveSha256=sha(path),
      )
    )
  source = dict(
    schemaVersion=1,
    step=10,
    date="2026-11-02",
    osmSnapshotSha256=sha(raw),
    originals=official,
    features=list(features.values()),
    tracks=tracks,
    passage=passage,
    allOriginalSourceSheetsRetained=True,
  )
  write(GEO / "south-fidelity-v294-source.json.gz", source)

  # Geometry metadata from the actual delivered source, never an invented
  # rectangle over a district. All courts, roof sheets and source vertices stay.
  old = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN ('DEBE02YY40001ISn','DEBE00YY1IW0004t','DEBE07YY900001Wl')",
  )
  originals = {
    r.sourceId: dict(
      sourceId=r.sourceId,
      height=r.height,
      minHeight=r.minHeight,
      heightSource=r.heightSource,
      sourceGroundY=r.sourceGroundY,
      geometry=mapping(r.geometry),
    )
    for _, r in old.iterrows()
  }
  assert len(originals) == 3
  for s in official:
    s["previous"] = originals[s["owner"]]
  # A compact, explicit metric plan is enough for additive fittings. Complete
  # source surfaces for the two underpass owners are retained, not estimated.
  runtime = dict(
    schemaVersion=1,
    tracks=tracks,
    passage=passage,
    plans={k: v["geometry"]["coordinates"][0][0][:-1] for k, v in features.items()},
    nkzOwners=[s for s in official if s["key"].startswith("nkz")],
    metropolParts=next(s for s in official if s["key"] == "metropol")["parts"],
  )
  # Exact retained Huxleys street-wall axes, used only for further small relief.
  venues = read(GEO / "venues-hermann-v238-source.json.gz")
  runtime["huxleys"] = next(b for b in venues["buildings"] if b["key"] == "huxleys")
  runtime["huxleys"].pop("oldOwner")
  runtime["huxleys"].pop("entrances")
  # The complete core exterior provides source heights for the old Mercedes
  # frontage, Forum Tower and entertainment complex; no roof is reconstructed.
  prisms = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  core = []
  for key, osm in [
    ("formerMercedes", "13759929"),
    ("forumTower", "216503834"),
    ("theatreCasino", "22989988"),
    ("theatreNorth", "143429088"),
  ]:
    poly = Polygon(runtime["plans"][osm])
    selected = [
      p
      for p in prisms
      if poly.buffer(0.3).covers(
        Polygon([[x / 10, z / 10] for x, z in p["ring"]]).representative_point()
      )
    ]
    assert selected
    core.append(dict(key=key, osm="way/" + osm, originalPrisms=selected))
  runtime["core"] = core
  cut = LineString(passage["cutPoints"]).buffer(
    passage["widthEstimateM"] / 2, cap_style=2
  )
  shells = []
  for owner in runtime["nkzOwners"]:
    ground = min(p["ground_y_m"] for p in owner["parts"])
    triangles = []
    solids = []
    for part in owner["parts"]:
      plan = Polygon(part["ring"], part["holes"])
      outside = plan.difference(cut)
      for poly in [outside] if outside.geom_type == "Polygon" else outside.geoms:
        if poly.area > 0.0001:
          solids.append(
            dict(
              ring=[list(p) for p in list(poly.exterior.coords)[:-1]],
              holes=[[list(p) for p in list(r.coords)[:-1]] for r in poly.interiors],
              minY=3,
              maxY=part["top_y_m"] - ground + 3,
            )
          )
      inside = plan.intersection(cut)
      for poly in [inside] if inside.geom_type == "Polygon" else inside.geoms:
        if poly.area > 0.0001:
          solids.append(
            dict(
              ring=[list(p) for p in list(poly.exterior.coords)[:-1]],
              holes=[[list(p) for p in list(r.coords)[:-1]] for r in poly.interiors],
              minY=passage["soffitY"],
              maxY=part["top_y_m"] - ground + 3,
            )
          )
          for t in triangulate(poly):
            if poly.covers(t):
              triangles.append(
                dict(
                  p=[
                    [x, passage["soffitY"], z] for x, z in list(t.exterior.coords)[:3]
                  ],
                  tone=0xA3A39A,
                  role="nkz-open-road-soffit",
                )
              )
      for surface in part["surfaces"]:
        rings = [[[x, y - ground + 3, z] for x, y, z in r] for r in surface["rings"]]
        tone = 0xBEC0BA if surface["kind"] == "WallSurface" else 0x888B83
        if surface["kind"] == "RoofSurface":
          for t in triangles_for(rings):
            triangles.append(dict(p=t, tone=tone, role="nkz-complete-retained-roof"))
          continue
        ps = rings[0]
        a, b = max(
          ((a, b) for a in ps for b in ps),
          key=lambda q: math.hypot(q[0][0] - q[1][0], q[0][2] - q[1][2]),
        )
        length = math.hypot(b[0] - a[0], b[2] - a[2])
        dx = (b[0] - a[0]) / length
        dz = (b[2] - a[2]) / length
        polygon = Polygon([[(p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]] for p in ps])
        crossing = LineString([[a[0], a[2]], [b[0], b[2]]]).intersection(cut)
        if crossing.geom_type == "LineString" and not crossing.is_empty:
          us = [(x - a[0]) * dx + (z - a[2]) * dz for x, z in crossing.coords]
          polygon = polygon.difference(
            box(min(us) - 1e-6, -50, max(us) + 1e-6, passage["soffitY"])
          )
        for poly in [polygon] if polygon.geom_type == "Polygon" else polygon.geoms:
          for t in triangulate(poly):
            if poly.covers(t):
              triangles.append(
                dict(
                  p=[
                    [a[0] + dx * u, y, a[2] + dz * u]
                    for u, y in list(t.exterior.coords)[:3]
                  ],
                  tone=tone,
                  role="nkz-complete-retained-wall-complement",
                )
              )
    surfaces = [dict(color=t["tone"], triangles=[t["p"]]) for t in triangles]
    blocks = native_blocks(dict(surfaces=surfaces, boxes=[], rods=[]))
    # Native 1m skins remain cardinal and the signed4m clearance is retained.
    assert all(
      r[1] - r[4] / 2 >= 7 - 1e-5
      for r in blocks
      if cut.buffer(-1.0).contains(__import__("shapely").geometry.Point(r[0], r[2]))
    )
    shells.append(
      dict(owner=owner["owner"], triangles=triangles, blocks=blocks, solids=solids)
    )
  runtime["nkzShells"] = shells
  write(APP / "southFidelityV294.json", runtime)
  source["originals"] = official
  source["inputs"] = {
    str(p.relative_to(ROOT)): sha(p)
    for p in [
      GEO / "raw/outer-v159/resolved-outlines.gpkg",
      GEO / "venues-hermann-v238-source.json.gz",
      ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json",
    ]
  }
  source["policy"] = (
    "Complete source sheets/footprints/roofs retained; only mapped Adalbertstraße building passage cuts lower aggregate walls. Width, soffit, facade subdivision, aircraft fine sections, stall and garden fittings are explicitly display estimates. No photographic pixels, proposed facade renders as completed facts, generic district fill or live-budget changes."
  )
  write(GEO / "south-fidelity-v294-source.json.gz", source)
  print(
    "Runtime",
    (APP / "southFidelityV294.json").stat().st_size,
    "Source",
    (GEO / "south-fidelity-v294-source.json.gz").stat().st_size,
  )


if __name__ == "__main__":
  build()
