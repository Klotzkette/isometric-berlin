"""Step 10: required full theatre owner and exact mapped Orankesee fittings."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path
from statistics import median
from typing import Any

import geopandas as gpd
import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_west_streets_v163 as streets  # noqa: E402
from build_concert_halls_v160 import triangulate  # noqa: E402
from build_karl_marx_allee_v161 import (  # noqa: E402
  Detail,
  native_detail,
  packed_detail,
)
from build_surrounding_outlines import tags_for, world  # noqa: E402

DATA = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data"
OWNER = "DEBE01YYK00001YG"
RAW = DATA / "raw/volksbuehne-orankesee-v209"


def dump(path: Path, value: Any) -> None:
  """Store deterministic bounded output."""
  path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def signature(mesh: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[bytes]]:
  """Return exact packed triangle identities, including original colour bytes."""
  p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  vertices = np.column_stack([p, c])
  return p, c, ix, [b"".join(sorted(row.tobytes() for row in t)) for t in vertices[ix]]


def digest(path: Path) -> str:
  """Identify original retained inputs."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def poly_detail(
  detail: Detail, poly: Polygon, low: float, high: float, wall: tuple, roof: tuple
) -> None:
  """Closed above-source addition with an explicit source-derived height."""
  for t in constrained_delaunay_triangles(poly).geoms:
    detail.polygon(
      [[x, high, z] for x, z in list(t.exterior.coords)[:3]], roof, "source RoofSurface"
    )
  for ring in [poly.exterior, *poly.interiors]:
    for a, b in zip(ring.coords, list(ring.coords)[1:]):
      detail.polygon(
        [[a[0], low, a[1]], [b[0], low, b[1]], [b[0], high, b[1]], [a[0], high, a[1]]],
        wall,
        "source WallSurface",
      )


def packed_float(detail: Detail) -> dict:
  """Index centimetre-independent full source positions; sRGB colours remain explicit."""
  vertices, indices, lookup = [], [], {}
  for triangle, color, _role in detail.triangles:
    for p in triangle:
      key = (*[round(float(v), 3) for v in p], *color)
      if key not in lookup:
        lookup[key] = len(vertices)
        vertices.append(list(key))
      indices.append(lookup[key])
  return dict(vertices=vertices, indices=indices)


def theatre() -> tuple[dict, dict, dict]:
  """Keep full LoD2 shell and independently sourced bDOM upper masses."""
  original = json.loads((DATA / "volksbuehne-v189-source.json").read_text())
  prior = json.loads((DATA / "mitte-streets-v166.json").read_text())
  owner = next(b for b in prior["buildings"] if b["id"] == OWNER)
  v189 = json.loads((DEST / "volksbuehneV189.json").read_text())["building"]
  fp = Polygon(v189["rings"][0], v189["rings"][1:])
  ox, oz = v189["frontOrigin"]
  tx, tz = v189["frontAxis"]

  def coord(u: float, v: float) -> list[float]:
    return [ox + tx * u - tz * v, oz + tz * u + tx * v]

  samples = json.loads((DATA / "volksbuehne-v209-bdom-samples.json").read_text())
  rows = samples["samples"]
  stage_samples = [r for r in rows if -6 <= r[0] <= 10 and -54 <= r[1] <= -42]
  auditorium_samples = [r for r in rows if -10 <= r[0] <= 10 and -34 <= r[1] <= -14]
  stage_nhn = round(median(r[4] for r in stage_samples), 3)
  auditorium_nhn = round(median(r[4] for r in auditorium_samples), 3)
  stage = Polygon(
    [
      coord(u, v)
      for u, v in [(-12.2, -56.0), (12.8, -56.0), (12.8, -40.0), (-12.2, -40.0)]
    ]
  ).intersection(fp)
  # Orthophoto partition, not a separately surveyed LoD2 polygon. The front
  # half-ellipse follows the roof's visible round auditorium end, inside LoD2.
  outline = [coord(-15.5, -40), coord(15.5, -40), coord(15.5, -19)]
  outline += [
    coord(15.5 * math.cos(a), -19 + 14.0 * math.sin(a))
    for a in np.linspace(0, math.pi, 33)[1:]
  ]
  auditorium = Polygon(outline).intersection(fp)
  supplement = Detail()
  volumes = []
  for name, polygon, nhn, samples_used, wall, roof in [
    ("stage tower", stage, stage_nhn, stage_samples, (181, 178, 162), (130, 134, 129)),
    (
      "auditorium body",
      auditorium,
      auditorium_nhn,
      auditorium_samples,
      (186, 179, 157),
      (141, 145, 139),
    ),
  ]:
    high = round(nhn - 35.866 + 3, 3)
    poly_detail(supplement, polygon, v189["topY"], high, wall, roof)
    volumes.append(
      dict(
        name=name,
        footprint=mapping(polygon),
        baseY=v189["topY"],
        topY=high,
        roofNhn=nhn,
        heightMethod="median of retained interior bDOM samples",
        sampleCoordinates=[[r[2], r[3]] for r in samples_used],
      )
    )
  # Rear pitched roof is independently observed in the DOP and bDOM transect.
  # Ridge/eave elevations use the measured central/back samples; interpolation
  # and partition position remain explicit display interpretation.
  rear = Polygon(
    [coord(u, v) for u, v in [(-11.5, -69), (11.5, -69), (11.5, -56.2), (-11.5, -56.2)]]
  )
  ridge = median(r[4] for r in rows if abs(r[0]) <= 6 and r[1] == -58) - 35.866 + 3
  rear_eave = 23.564
  for u0, u1 in [(-11.5, 0), (0, 11.5)]:
    corners = [(-69, u0), (-69, u1), (-56.2, u1), (-56.2, u0)]
    roof = [
      [*coord(u, v)[:1], ridge if u == 0 else rear_eave, coord(u, v)[1]]
      for v, u in corners
    ]
    supplement.polygon(roof, (153, 98, 81), "source RoofSurface")
  for v in [-69, -56.2]:
    a, b, c = coord(-11.5, v), coord(0, v), coord(11.5, v)
    supplement.polygon(
      [[a[0], rear_eave, a[1]], [b[0], ridge, b[1]], [c[0], rear_eave, c[1]]],
      (190, 181, 164),
      "source WallSurface",
    )
  volumes.append(
    dict(
      name="rear pitched roof",
      footprint=mapping(rear),
      baseY=rear_eave,
      topY=round(ridge, 3),
      heightMethod="central bDOM v=-58 transect; linear roof interpretation",
    )
  )

  shell = Detail()
  for part in owner["parts"]:
    for sheet in part["surfaces"]:
      color = (160, 159, 151) if sheet["kind"] == "RoofSurface" else (211, 208, 197)
      for tri in triangulate(sheet["rings"]):
        shell.polygon(tri, color, "source " + sheet["kind"])
  drawn = Detail()
  drawn.triangles = shell.triangles + supplement.triangles
  original_facaded, _ = streets.outer_detail(
    owner, unary_union([shape(r["geometry"]) for r in prior["roads"]])
  )
  native_base = native_detail(original_facaded)
  native_upper = native_detail(supplement)
  native = Detail()
  native.triangles = native_base.triangles + native_upper.triangles
  # Match exact triangle multisets in immutable v108 packets. The native base
  # retains the original independent surface blocks including its old windows.
  receipts = []
  for mode, selected in [("drawn", shell), ("minecraft", native_base)]:
    packed = packed_detail(selected, box(2560, -1024, 3072, -512))
    wanted = Counter(signature(packed)[3])
    path = ROOT / f"src/app/public/mesh/surrounding-berlin-v159/5_-2.{mode}.json.gz"
    packet = json.loads(gzip.decompress(path.read_bytes()))
    for part in packet["meshes"]:
      if part["kind"] != "mitte-street-fronts-v166":
        continue
      removed = []
      for i, key in enumerate(signature(part)[3]):
        if wanted[key]:
          wanted[key] -= 1
          removed.append(i)
      # Ground sheets were never in the streamed original; they are now present.
      if mode == "minecraft":
        assert not +wanted, f"native owner mismatch {sum((+wanted).values())}"
      fnv = 2166136261
      for text in [part["positions"], part["colors"], part["indices"]]:
        for c in text:
          fnv = ((fnv ^ ord(c)) * 16777619) & 0xFFFFFFFF
      receipts.append(
        dict(
          tile="5_-2",
          kind=part["kind"],
          mode=mode,
          fingerprint=fnv,
          triangles=removed,
          owner=OWNER,
          packetSha256=digest(path),
          originalSheetCount=75,
        )
      )
  result = dict(
    owner=OWNER,
    groundY=3,
    originalTopY=23.564,
    rings=v189["rings"],
    sourceSha256=digest(DATA / "volksbuehne-v189-source.json"),
    bdomSha256=digest(DATA / "volksbuehne-v209-bdom-samples.json"),
    drawn=packed_float(drawn),
    native=packed_float(native),
    volumes=volumes,
  )
  evidence = dict(
    owner=OWNER,
    originalSource=original,
    baselineRelease="v1.0.108",
    bdom=samples,
    volumes=volumes,
    originalSurfaceCount=75,
    originalSourceSha256=result["sourceSha256"],
    originalV189RuntimeSha256=digest(DEST / "volksbuehneV189.json"),
    roofPlanStatus="DOP2025-interpreted local partitions clipped to exact LoD2 footprint. The bDOM gives measured roof heights; edge positions, roof interpolation and wall materials remain display interpretation.",
    sourceConflict="Retained older LoD2 uniformly ends at 56.430m NHN; 2025 bDOM interior stage median is higher. All 75 original sheets remain rendered in the required owner. Additional roof masses sit above the retained flat roof; no old side facade or sculpture is suppressed.",
    sourceUrls=[
      "https://gdi.berlin.de/services/wms/bdom",
      "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
      "https://gdi.berlin.de/data/bdom/docs/dom.pdf",
    ],
    dop=dict(
      bbox=[392220, 5820780, 392320, 5820910],
      crs="EPSG:25833",
      layer="dop_2025",
      sha256=digest(RAW / "volksbuehne-dop.jpg"),
    ),
    cameraPoses=[
      dict(target=[2768, 15, -848], position=[2658, 89, -700]),
      dict(target=[2768, 22, -848], position=[2862, 85, -955]),
    ],
  )
  return result, evidence, dict(records=receipts)


def lake() -> tuple[dict, dict]:
  """No new water: exact shore articulation and source-mapped public fittings."""
  path = RAW / "orankesee.gpkg"
  polygons = gpd.read_file(path, layer="multipolygons").to_crs(25833)
  lake_row = polygons[polygons.name == "Orankesee"].iloc[0]
  lake_geo = lake_row.geometry
  lido = polygons[polygons.osm_id == "3099999"].iloc[0]
  beach = polygons[polygons.osm_way_id == "10354648"].iloc[0]
  domain = lake_geo.buffer(40).union(lido.geometry)
  records = []
  for layer in ["multipolygons", "lines", "points"]:
    frame = gpd.read_file(path, layer=layer).to_crs(25833)
    for _, row in frame.iterrows():
      if not row.geometry.intersects(domain):
        continue
      tags = tags_for(row)
      rid = (
        "relation/" + str(row.osm_id)
        if layer == "multipolygons" and isinstance(row.osm_id, str)
        else (
          "way/" + str(row.osm_way_id)
          if layer == "multipolygons"
          else ("node/" if layer == "points" else "way/") + str(row.osm_id)
        )
      )
      if (
        layer == "multipolygons"
        and str(row.osm_way_id)
        not in {"4788724", "10354648", "43887876", "111400097", "205024294"}
        and str(row.osm_id) != "3099999"
      ):
        continue
      if layer == "lines" and not (
        tags.get("highway") in {"footway", "path", "steps"}
        or tags.get("barrier") == "fence"
        or tags.get("attraction") == "water_slide"
      ):
        continue
      if layer == "points" and not (
        tags.get("amenity") in {"bench", "waste_basket", "bicycle_parking"}
        or tags.get("emergency") == "life_ring"
        or tags.get("information") == "board"
      ):
        continue
      records.append(
        dict(
          id=rid,
          tags=tags,
          geometry=mapping(world(row.geometry)),
          renderGeometry=mapping(
            world(
              row.geometry
              if domain.covers(row.geometry)
              else row.geometry.intersection(domain)
            )
          ),
        )
      )
  shoreline = world(lake_geo)
  coast = (
    max(shoreline.geoms, key=lambda p: p.area)
    if hasattr(shoreline, "geoms")
    else shoreline
  )
  beach_world = world(beach.geometry).difference(shoreline)
  positions = []
  for poly in getattr(beach_world, "geoms", [beach_world]):
    for tri in constrained_delaunay_triangles(poly).geoms:
      positions += [
        [round(x, 3), 3.065, round(z, 3)] for x, z in list(tri.exterior.coords)[:3]
      ]
  data = dict(
    waterOwner="way/4788724",
    noNewWaterSurface=True,
    groundY=3,
    shoreline=[[round(x, 3), round(z, 3)] for x, z in coast.exterior.coords],
    sand=positions,
    features=records,
    estimateStatus="OSM preserves complete source coordinates; untagged widths, all bench/bin/fence/slide vertical dimensions and sand display lift are procedural estimates. Existing lake water, paths, trees and buildings stay in original source owners.",
  )
  evidence = dict(
    source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    license="ODbL-1.0",
    sourceDate="2026-09-29",
    features=records,
    fullWater=mapping(shoreline),
    lido=mapping(world(lido.geometry)),
    beach=mapping(world(beach.geometry)),
    noNewWaterSurface=True,
    newScope=False,
    scope="Previously approved Alt-Hohenschönhausen v200 / prior Weißensee edge",
    sourceReferences=[
      "https://www.berlin.de/tourismus/seen/4361773-4299185-orankesee.html",
      "https://www.berlin.de/lageso/gesundheit/gesundheitsschutz/badegewaesser/badegewaesserprofile/artikel.339144.php",
      "https://strandbad-orankesee.de/",
    ],
    cameraPoses=[
      dict(
        target=[round(coast.centroid.x, 2), 3, round(coast.centroid.y, 2)],
        position=[
          round(coast.centroid.x + 260, 2),
          210,
          round(coast.centroid.y + 300, 2),
        ],
      )
    ],
  )
  return data, evidence


def navigation(building: dict) -> dict:
  """Extract only new upper solids; keep the rear roof's exact sloping profile."""
  frame = json.loads((DEST / "volksbuehneV189.json").read_text())["building"]
  ox, oz = frame["frontOrigin"]
  tx, tz = frame["frontAxis"]
  rear = building["volumes"][2]
  local = [
    [(x - ox) * tx + (z - oz) * tz, -(x - ox) * tz + (z - oz) * tx]
    for x, z in rear["footprint"]["coordinates"][0]
  ]
  return dict(
    owner=OWNER,
    sourceReceipt="volksbuehne-v209-source.json",
    upperVolumesOnly=True,
    flatVolumes=[
      dict(
        name=v["name"],
        lowY=v["baseY"],
        highY=v["topY"],
        rings=v["footprint"]["coordinates"],
      )
      for v in building["volumes"][:2]
    ],
    rearRoof=dict(
      lowY=rear["baseY"],
      highY=rear["topY"],
      origin=frame["frontOrigin"],
      axis=frame["frontAxis"],
      halfWidth=round(max(abs(p[0]) for p in local), 6),
      vMin=round(min(p[1] for p in local), 6),
      vMax=round(max(p[1] for p in local), 6),
    ),
  )


def main() -> None:
  """Write only site payloads and auditable exact-owner receipts."""
  building, source, receipts = theatre()
  water, water_source = lake()
  dump(DEST / "volksbuehneEnvelopeV209.json", building)
  dump(DEST / "volksbuehneOwnershipV209.json", receipts)
  dump(DEST / "volksbuehneV209Navigation.json", navigation(building))
  dump(DATA / "volksbuehne-v209-source.json", source)
  dump(DEST / "orankeseeV209.json", water)
  dump(DATA / "orankesee-v209-source.json", water_source)
  print(
    json.dumps(
      dict(
        volumes=building["volumes"],
        receipts=[
          dict(mode=r["mode"], triangles=len(r["triangles"]))
          for r in receipts["records"]
        ],
        features=len(water["features"]),
      )
    )
  )


if __name__ == "__main__":
  main()
