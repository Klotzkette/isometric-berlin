"""Two complete Neukölln landmarks; exact retained owners and every LoD2 sheet.

Only the named coarse OSM predecessors may yield after full required models are
attached. References guide estimated openings; no photographic pixels ship.
"""

from __future__ import annotations

import base64
import copy
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
import shapely
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_surrounding_outlines as exporter
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_litten_instanz_v257 import edge
from build_moabit_mitte_v300 import Mesh, clipped_member_ranges, read, sha, write

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/neukoelln-v305"
ZIP = RAW / "LoD2_393_5815.zip"
SOURCE = GEO / "neukoelln-landmarks-v305-source.json.gz"
TARGETS = {
  "arcaden": {
    "name": "Neukölln Arcaden",
    "old": "OSM-way-24315002",
    "parents": [
      "DEBE00YYpu00008U",
      "DEBE08YYF0001IKP",
      "DEBE00YYpu00008I",
      "DEBE08YYF00001FF",
    ],
    "wall": 0xAAB3B3,
    "roof": 0x737D7B,
  },
  "rathaus": {
    "name": "Rathaus Neukölln",
    "old": "OSM-relation-374042",
    "parents": ["DEBE08AL3Rd0004a", "DEBE08AL3Rd0001s"],
    "wall": 0xC3BCA9,
    "roof": 0xA45F47,
  },
}
REFERENCES = [
  dict(
    url="https://www.berlin.de/ba-neukoelln/ueber-den-bezirk/sehenswertes/artikel.105690.php",
    credit="Bezirksamt Neukölln",
    checked="2026-11-02",
    imageSha256=sha(RAW / "rathaus-ba.jpg"),
    use="Stone clock tower, open upper lantern, copper roof and Fortuna; pale plaster wings and red pitched roofs. The page states 67m; tourism documents state 68m. A 67m display supplement is explicitly estimated, not measured LoD2.",
  ),
  dict(
    url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090494",
    credit="Landesdenkmalamt Berlin",
    checked="2026-11-02",
    use="Extant multi-wing townhall identity and alterations; no destroyed wing is reconstructed.",
  ),
  dict(
    url="https://www.tga-effizienz.de/details-dienstleistungen/berlin-neuk%C3%B6lln-arcaden-mit-cineplex-kino.html",
    credit="Ingenieurbüro TGA Effizienz, January2019 project photo",
    checked="2026-11-02",
    imageSha256=sha(RAW / "arcaden-tga-2019.jpg"),
    use="Curved narrow corner, metal bands, glazed base and projecting translucent canopy. Historical shop adverts are not copied or asserted as current tenants.",
  ),
  dict(
    url="https://www.neukoelln-arcaden.de/",
    credit="Neukölln Arcaden operator",
    checked="2026-11-02",
    use="Karl-Marx-Straße66 identity and entrances on Karl-Marx-Straße/Flughafenstraße. Only architectural references; no opening-time or shop data bundled.",
  ),
  dict(
    url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    credit="Geoportal Berlin, DOP2025, dl-de/zero-2-0",
    checked="2026-11-02",
    imageSha256=sha(RAW / "rathaus-dop2025.png"),
    use="Reference-only roof, courts and tower situation, EPSG25833 bbox393690,5815680,393900,5815820. Photogrammetric roof displacement is not used as a surveyed tower base.",
  ),
  dict(
    url="https://www.openstreetmap.org/node/5299353950",
    credit="OpenStreetMap contributors, ODbL-1.0",
    checked="retained2026-09-29 PBF",
    use="Fortuna mapped anchor4226.045/4269.417, tagged2.2m figure/min_height68; small statue silhouette and tower width remain estimates.",
  ),
]


def extract() -> None:
  frame = pyogrio.read_dataframe(
    GEO / "raw/ring-v182/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN ('OSM-way-24315002','OSM-relation-374042')",
  )
  olds = {
    r["sourceId"]: {
      k: v
      for k, v in r.items()
      if k != "geometry" and not (isinstance(v, float) and math.isnan(v))
    }
    | {"geometry": mapping(r["geometry"])}
    for r in frame.to_dict("records")
  }
  sites = []
  for key, t in TARGETS.items():
    parents = []
    for pid in t["parents"]:
      e = extract_parent(ZIP, pid)
      parents.append(
        dict(id=pid, parts=[part_profile(p) for p in leaf_building_parts(e) or [e]])
      )
    footprint = unary_union(
      [Polygon(p["ring"], p["holes"]) for parent in parents for p in parent["parts"]]
    )
    old = olds[t["old"]]
    oldshape = shape(old["geometry"])
    complement = oldshape.difference(footprint)
    sites.append(
      dict(
        key=key,
        **t,
        predecessor=old,
        parentsSource=parents,
        officialCoveredFraction=footprint.intersection(oldshape).area / oldshape.area,
        outsideComplement=mapping(complement),
        outsideComplementAreaM2=complement.area,
        yOffset=3 - min(p["ground_y_m"] for parent in parents for p in parent["parts"]),
      )
    )
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      origin=[389500, 5820000, 30],
      archive=dict(
        path=str(ZIP.relative_to(ROOT)),
        url="https://gdi.berlin.de/data/a_lod2/atom/" + ZIP.name,
        sha256=sha(ZIP),
        license="dl-de/zero-2-0",
      ),
      oldSource=dict(
        path="geo_data/regierungsviertel/raw/ring-v182/resolved-outlines.gpkg",
        sha256=sha(GEO / "raw/ring-v182/resolved-outlines.gpkg"),
      ),
      addressSourceSha256=sha(GEO / "raw/outer-v159/berlin-260929.osm.pbf"),
      references=REFERENCES,
      sites=sites,
      policy="Every official parent leaf, wall and roof polygon including holes is retained. Source heights are translated as a complete family to the existing3m street datum. Exact old outside fragments remain fallback complements. The absent tower is a separately labelled reference supplement. No pixels or old tenant adverts bundled.",
    ),
  )


def roof_heights(
  triangles: list[list[list[float]]], xs: np.ndarray, zs: np.ndarray
) -> np.ndarray:
  tops = np.full(len(xs), -np.inf)
  for a, b, c in triangles:
    det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(det) < 1e-10:
      continue
    u = ((b[2] - c[2]) * (xs - c[0]) + (c[0] - b[0]) * (zs - c[2])) / det
    v = ((c[2] - a[2]) * (xs - c[0]) + (a[0] - c[0]) * (zs - c[2])) / det
    inside = (u >= -1e-7) & (v >= -1e-7) & (u + v <= 1 + 1e-7)
    tops[inside] = np.maximum(
      tops[inside],
      u[inside] * a[1] + v[inside] * b[1] + (1 - u[inside] - v[inside]) * c[1],
    )
  return tops


def box_surfaces(
  g: BaseGeometry, low: float, high: float, identity: str
) -> list[dict[str, Any]]:
  """Only exact outside complements; all old courtyard holes remain holes."""
  polygons = [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))
  result = []
  for i, p in enumerate(polygons):
    if p.geom_type != "Polygon" or p.area <= 1e-9:
      continue
    rings = [list(p.exterior.coords)[:-1], *[list(h.coords)[:-1] for h in p.interiors]]
    surfaces = [
      dict(kind="RoofSurface", rings=[[[x, high, z] for x, z in r] for r in rings])
    ]
    for r in rings:
      for a, b in zip(r, [*r[1:], r[0]]):
        surfaces.append(
          dict(
            kind="WallSurface",
            rings=[
              [
                [a[0], low, a[1]],
                [b[0], low, b[1]],
                [b[0], high, b[1]],
                [a[0], high, a[1]],
              ]
            ],
          )
        )
    result.append(
      dict(
        id=f"{identity}-outside-{i}",
        ring=rings[0],
        holes=rings[1:],
        ground_y_m=low,
        top_y_m=high,
        surfaces=surfaces,
      )
    )
  return result


def compile_data() -> None:
  evidence = read(SOURCE)
  drawn, native = Mesh(), Mesh()
  profile = dict(
    schemaVersion=1,
    sites=[],
    navigation=[],
    nativeRoofs=[],
    faces=[],
    tower={},
    towerNavigation={"drawn": [], "native": []},
  )
  source_triangles = 0
  for site in evidence["sites"]:
    key = site["key"]
    transformed = []
    for parent in site["parentsSource"]:
      for original in parent["parts"]:
        p = copy.deepcopy(original)
        p.update(parent=parent["id"], site=key)
        for s in p["surfaces"]:
          for ring in s["rings"]:
            for q in ring:
              q[1] = round(q[1] + site["yOffset"], 6)
        p["ground_y_m"] += site["yOffset"]
        p["top_y_m"] += site["yOffset"]
        transformed.append(p)
    complements = box_surfaces(
      shape(site["outsideComplement"]),
      3,
      3 + site["predecessor"]["height"],
      site["old"],
    )
    for p in complements:
      p.update(parent=site["old"] + "-outside", site=key)
    parts = transformed + complements
    shapes = [Polygon(p["ring"], p["holes"]) for p in parts]
    # All measured sheet triangles, including source surfaces hidden by another
    # leaf, remain in the complete drawn model; no visual subset masquerades as it.
    for p in parts:
      roofs = []
      for s in p["surfaces"]:
        triangles = triangles_for(s["rings"])
        if s["kind"] == "RoofSurface":
          roofs.extend(triangles)
        for tri in triangles:
          drawn.triangle(
            tri,
            site["roof"] if s["kind"] == "RoofSurface" else site["wall"],
            "retained-outside-complement"
            if p in complements
            else "complete-source-sheet",
          )
          source_triangles += 1
      profile["navigation"].append(
        dict(
          id=p["id"],
          parent=p["parent"],
          site=key,
          ring=p["ring"],
          holes=p["holes"],
          low=p["ground_y_m"],
          high=p["top_y_m"],
          roofTriangles=roofs,
        )
      )
    cells = {}
    step = 0.5
    for p, g in zip(parts, shapes, strict=True):
      minx, minz, maxx, maxz = g.bounds
      ix, iz = np.meshgrid(
        np.arange(math.floor(minx / step), math.ceil(maxx / step)),
        np.arange(math.floor(minz / step), math.ceil(maxz / step)),
      )
      ix, iz = ix.ravel(), iz.ravel()
      inside = shapely.contains_xy(g, (ix + 0.5) * step, (iz + 0.5) * step)
      ix, iz = ix[inside], iz[inside]
      roofs = [
        t
        for s in p["surfaces"]
        if s["kind"] == "RoofSurface"
        for t in triangles_for(s["rings"])
      ]
      tops = roof_heights(roofs, (ix + 0.5) * step, (iz + 0.5) * step)
      # A tiny vertical source leaf can have no projected roof; its exact source
      # vertical envelope is recorded as a separate fallback, never a flat cap
      # imposed on the entire measured family.
      tops[~np.isfinite(tops)] = p["top_y_m"]
      low = round(p["ground_y_m"] / step) * step
      for x, z, top in zip(ix, iz, tops, strict=True):
        previous = cells.get((int(x), int(z)), (low, low))
        cells[(int(x), int(z))] = (
          min(low, previous[0]),
          max(math.ceil(top / step) * step, previous[1]),
        )
    # Independent complete orthogonal source body columns; rows never bridge a
    # courtyard, entrance court or the void between separate official owners.
    for z in sorted({z for x, z in cells}):
      xs = sorted(x for x, zz in cells if zz == z)
      at = 0
      while at < len(xs):
        first = last = xs[at]
        lo, hi = cells[(first, z)]
        at += 1
        while at < len(xs) and xs[at] == last + 1 and cells[(xs[at], z)] == (lo, hi):
          last = xs[at]
          at += 1
        native.box(
          [(first + last + 1) * step / 2, (lo + hi) / 2, (z + 0.5) * step],
          [(last - first + 1) * step, hi - lo, step],
          site["wall"],
          "independent-source-column",
        )
        native.box(
          [(first + last + 1) * step / 2, hi + 0.025, (z + 0.5) * step],
          [(last - first + 1) * step, 0.05, step],
          site["roof"],
          "independent-roof-cap",
        )
        profile["nativeRoofs"].append([key, first, z, last - first + 1, lo, hi + 0.05])
    # Source-clipped estimated facade members. Party/interior sheets remain plain.
    seen = set()
    for p, g in zip(parts, shapes, strict=True):
      if p in complements:
        continue
      for si, s in enumerate(p["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        f = edge(s)
        if not f or math.dist(f["a"], f["b"]) < 1.8 or f["top"] - f["bottom"] < 3:
          continue
        dx, dz = f["b"][0] - f["a"][0], f["b"][1] - f["a"][1]
        length = math.hypot(dx, dz)
        d = [dx / length, dz / length]
        n = f["normal"]
        center = Point((f["a"][0] + f["b"][0]) / 2, (f["a"][1] + f["b"][1]) / 2)
        if g.contains(Point(center.x + n[0] * 0.05, center.y + n[1] * 0.05)):
          n = [-n[0], -n[1]]
        outside = Point(center.x + n[0] * 0.2, center.y + n[1] * 0.2)
        mid = (f["bottom"] + f["top"]) / 2
        if any(
          q is not p and q["ground_y_m"] <= mid < q["top_y_m"] and h.covers(outside)
          for q, h in zip(parts, shapes, strict=True)
        ):
          continue
        signature = tuple(
          round(v, 3) for v in f["a"] + f["b"] + [f["bottom"], f["top"]]
        )
        if signature in seen:
          continue
        seen.add(signature)
        uv = [
          [[(q[0] - f["a"][0]) * d[0] + (q[2] - f["a"][1]) * d[1], q[1]] for q in ring]
          for ring in s["rings"]
        ]
        wall = shapely.make_valid(Polygon(uv[0], uv[1:]))
        # Large rear parking/service walls are not fitted as shop windows.
        arcaden_front = key == "arcaden" and (
          (n[0] < -0.25 and center.x < 4008) or (n[1] < -0.25 and center.y < 4180)
        )
        if key == "arcaden" and not arcaden_front:
          continue
        start = len(drawn.boxes)

        def member(u, y, w, h, depth, out, tone, role, strip=False):
          for cu, cw in clipped_member_ranges(wall, u, y, w, h, strip):
            pos = [
              f["a"][0] + d[0] * cu + n[0] * out,
              y,
              f["a"][1] + d[1] * cu + n[1] * out,
            ]
            drawn.box(pos, [cw, h, depth], tone, role, d, n)
            # Each tiny native fitting is projected to an actual exterior cell,
            # so the cardinal silhouette never inherits a smooth diagonal skin.
            axis = 0 if abs(n[0]) >= abs(n[1]) else 1
            sgn = 1 if n[axis] > 0 else -1
            world = [pos[0], pos[2]]
            candidates = []
            for delta in range(-3, 4):
              coords = [math.floor(world[0] / step), math.floor(world[1] / step)]
              coords[axis] += delta
              if tuple(coords) not in cells:
                continue
              lo, hi = cells[tuple(coords)]
              neighbor = coords.copy()
              neighbor[axis] += sgn
              if (
                lo > y - h / 2
                or hi < y + h / 2
                or tuple(neighbor) in cells
                and cells[tuple(neighbor)][1] > y - h / 2
              ):
                continue
              plane = (coords[axis] + (1 if sgn > 0 else 0)) * step
              candidates.append((abs(plane - world[axis]), plane))
            if candidates:
              distance, plane = min(candidates)
              if distance < 1.6:
                world[axis] = plane + sgn * 0.12
                native.box(
                  [world[0], y, world[1]],
                  [depth if axis == 0 else cw, h, cw if axis == 0 else depth],
                  tone,
                  role + "-cardinal",
                )

        if arcaden_front:
          # Broad glazed base and repeated metal transoms on the curved corner.
          for y in np.arange(max(5.1, f["bottom"] + 1.8), min(f["top"] - 0.5, 31), 3.3):
            for i in range(max(1, math.ceil(length / 2.6))):
              pitch = length / max(1, math.ceil(length / 2.6))
              u = (i + 0.5) * pitch
              member(
                u,
                float(y),
                max(0.35, pitch - 0.16),
                2.8,
                0.075,
                0.11,
                0x5E7278,
                "arcaden-glazed-bay",
              )
              member(
                u - pitch / 2 + 0.05,
                float(y),
                0.07,
                3.0,
                0.09,
                0.19,
                0xB4BFC0,
                "arcaden-metal-mullion",
              )
            member(
              length / 2,
              float(y + 1.55),
              length - 0.04,
              0.13,
              0.12,
              0.23,
              0x798789,
              "arcaden-continuous-metal-band",
              True,
            )
          # The entrance shelter is a thin, ribbed projecting canopy, not a box.
          if center.x < 3970 and center.y < 4195 and f["bottom"] < 5 and length > 2:
            member(
              length / 2,
              7.1,
              length,
              0.11,
              2.7,
              1.35,
              0xADC5BF,
              "arcaden-entrance-canopy",
            )
            for u in np.arange(0.2, length, 0.9):
              member(
                float(u), 7.17, 0.07, 0.10, 2.85, 1.36, 0x4F5A59, "arcaden-canopy-rib"
              )
        else:
          floor_count = max(1, round((f["top"] - f["bottom"]) / 4.0))
          floor_height = (f["top"] - f["bottom"]) / floor_count
          bays = max(1, round(length / 3.1))
          pitch = length / bays
          for floor in range(floor_count):
            y = f["bottom"] + (floor + 0.53) * floor_height
            for i in range(bays):
              u = (i + 0.5) * pitch
              w = min(1.35, pitch * 0.52)
              h = min(2.25, floor_height * 0.62)
              member(
                u, y, w + 0.16, h + 0.18, 0.07, 0.10, 0xE2DDCB, "rathaus-window-reveal"
              )
              member(u, y, w, h, 0.045, 0.15, 0x536B6B, "rathaus-divided-glazing")
              member(u, y, 0.05, h, 0.035, 0.19, 0xDDD8C8, "rathaus-window-mullion")
              member(
                u, y + 0.12, w, 0.055, 0.035, 0.19, 0xDDD8C8, "rathaus-window-crossbar"
              )
          member(
            length / 2,
            f["top"] - 0.2,
            length - 0.04,
            0.20,
            0.18,
            0.17,
            0xD0CAB7,
            "rathaus-stone-eave",
            True,
          )
        if len(drawn.boxes) > start:
          profile["faces"].append(
            dict(
              site=key,
              parent=p["parent"],
              part=p["id"],
              surface=si,
              normal=n,
              a=f["a"],
              b=f["b"],
              bottom=f["bottom"],
              top=f["top"],
              members=len(drawn.boxes) - start,
              estimated=True,
            )
          )
    profile["sites"].append(
      dict(
        key=key,
        name=site["name"],
        oldId=site["old"],
        parents=site["parents"],
        parts=len(transformed),
        surfaces=sum(len(p["surfaces"]) for p in transformed),
        outsideComplementAreaM2=site["outsideComplementAreaM2"],
        officialCoveredFraction=site["officialCoveredFraction"],
        sourceYOffset=site["yOffset"],
      )
    )
  add_tower(drawn, native, profile)
  # Exact navigation rectangles merge only identical adjacent compiled row
  # runs, reducing query work without filling a single additional native cell.
  grouped = {}
  for site, x, z, width, low, high in profile["nativeRoofs"]:
    grouped.setdefault((site, x, width, low, high), []).append(z)
  profile["nativeNavigation"] = []
  for (site, x, width, low, high), zs in sorted(grouped.items()):
    zs = sorted(zs)
    start = last = zs[0]
    for z in zs[1:] + [None]:
      if z is not None and z == last + 1:
        last = z
      else:
        profile["nativeNavigation"].append(
          [site, x, start, x + width, last + 1, low, high]
        )
        start = last = z
  profile["nativeRoofRunCount"] = len(profile.pop("nativeRoofs"))
  profile["nativeRegions"] = []
  region_rows = {}
  for site, x, z, x1, z1, low, high in profile["nativeNavigation"]:
    region_rows.setdefault((site, low), []).append((x, z, x1, z1, high))
  for (site, low), rows in sorted(region_rows.items()):
    from shapely.geometry import box

    region = unary_union(
      [box(x * 0.5, z * 0.5, x1 * 0.5, z1 * 0.5) for x, z, x1, z1, high in rows]
    )
    pieces = [region] if region.geom_type == "Polygon" else list(region.geoms)
    for i, p in enumerate(pieces):
      profile["nativeRegions"].append(
        dict(
          site=site,
          low=low,
          high=max(r[4] for r in rows),
          ring=[list(q) for q in list(p.exterior.coords)[:-1]],
          holes=[[list(q) for q in list(h.coords)[:-1]] for h in p.interiors],
        )
      )
  actual_source_triangles = len(drawn.indices) // 3
  from neukoelln_roof_materials_v305 import apply_roof_materials_v305

  model = dict(
    schemaVersion=1,
    drawn=drawn.packed(),
    fittings=drawn.boxes,
    nativeBoxes=native.boxes,
    counts=dict(
      sites=2,
      parents=6,
      sourceTriangles=actual_source_triangles,
      sourceTriangulationTriangles=source_triangles,
      drawnTriangles=actual_source_triangles + len(drawn.boxes) * 12,
      nativeTriangles=len(native.boxes) * 12,
      sourceSurfaces=sum(s["surfaces"] for s in profile["sites"]),
    ),
  )
  material_audit = apply_roof_materials_v305(model, profile, roof_heights)
  write(DATA / "neukoellnLandmarksV305Core.json", model)
  write(GEO / "neukoelln-landmarks-v305-material-audit.json", material_audit)
  write(DATA / "neukoellnLandmarksV305Profile.json", profile)
  write(
    DATA / "neukoellnLandmarksV305Owners.json",
    dict(
      schemaVersion=1,
      sites=[
        dict(key=s["key"], old=s["predecessor"], parents=s["parents"])
        for s in evidence["sites"]
      ],
      sourceSha256=sha(SOURCE),
    ),
  )
  print(
    json.dumps(
      dict(
        sourceBytes=SOURCE.stat().st_size,
        modelBytes=(DATA / "neukoellnLandmarksV305Core.json").stat().st_size,
        profileBytes=(DATA / "neukoellnLandmarksV305Profile.json").stat().st_size,
        sourceTriangles=source_triangles,
        fittings=len(drawn.boxes),
        nativeBoxes=len(native.boxes),
        nativeNavigation=len(profile["nativeNavigation"]),
        roles=dict(drawn.roles),
      )
    )
  )


def add_tower(drawn: Mesh, native: Mesh, profile: dict[str, Any]) -> None:
  """Evidence-bound absent clock-tower supplement; dimensions visibly estimated."""
  x, z = 4226.045, 4269.417
  yaw = -math.atan2(0.766, 0.643)
  d = [math.cos(yaw), -math.sin(yaw)]
  n = [-d[1], d[0]]
  stone, copper, dark, gold = 0xA49F8C, 0x628C7D, 0x2F4141, 0xBBAA68

  def emit(u, y, v, w, h, depth, tone, role, draw=True):
    if draw:
      drawn.box(
        [x + d[0] * u + n[0] * v, y, z + d[1] * u + n[1] * v],
        [w, h, depth],
        tone,
        role,
        d,
        n,
      )
    solid = not any(s in role for s in ["clock", "window"])
    if solid and draw:
      profile["towerNavigation"]["drawn"].append(drawn.boxes[-1])
    # Independent short cardinal strips follow the rotated reference footprint.
    count = max(1, math.ceil(w / 0.5))
    for i in range(count):
      uu = u + w * ((i + 0.5) / count - 0.5)
      native.box(
        [x + d[0] * uu + n[0] * v, y, z + d[1] * uu + n[1] * v],
        [
          max(0.07, abs(d[0]) * w / count + abs(n[0]) * depth),
          h,
          max(0.07, abs(d[1]) * w / count + abs(n[1]) * depth),
        ],
        tone,
        role + "-native",
      )
      if solid:
        profile["towerNavigation"]["native"].append(native.boxes[-1])

  emit(0, 28, 0, 8.3, 50, 8.3, stone, "reference-tower-shaft")
  emit(0, 53.1, 0, 9.0, 0.35, 9.0, stone, "tower-belfry-course")
  # Open belfry: dark inset plus individual pillars on all four faces.
  emit(0, 56.1, 0, 7.5, 5.7, 7.5, dark, "tower-belfry-recess")
  for side in [-1, 1]:
    for u in [-4, -2, 0, 2, 4]:
      emit(u, 56.1, side * 4.05, 0.35, 5.7, 0.35, stone, "tower-belfry-pillar")
      emit(side * 4.05, 56.1, u, 0.35, 5.7, 0.35, stone, "tower-belfry-pillar")
  emit(0, 59.1, 0, 9.1, 0.35, 9.1, stone, "tower-lantern-base")
  emit(0, 61.0, 0, 6.8, 3.5, 6.8, stone, "tower-upper-lantern")
  for k in range(10):
    size = 8.2 - k * 0.55
    emit(
      0, 63.0 + k * 0.33, 0, size, 0.35, size, copper, "tower-stepped-copper-hip", False
    )
  bottom = [
    [x + d[0] * u + n[0] * v, 62.75, z + d[1] * u + n[1] * v]
    for u, v in [(-4.1, -4.1), (4.1, -4.1), (4.1, 4.1), (-4.1, 4.1)]
  ]
  top = [
    [x + d[0] * u + n[0] * v, 66.3, z + d[1] * u + n[1] * v]
    for u, v in [(-1.35, -1.35), (1.35, -1.35), (1.35, 1.35), (-1.35, 1.35)]
  ]
  hip = []
  for i in range(4):
    j = (i + 1) % 4
    hip.extend([[bottom[i], bottom[j], top[j]], [bottom[i], top[j], top[i]]])
  hip.extend([[top[0], top[1], top[2]], [top[0], top[2], top[3]]])
  for t in hip:
    drawn.triangle(t, copper, "reference-smooth-copper-hip")
  profile["towerRoof"] = dict(
    ring=[[p[0], p[2]] for p in bottom],
    low=62.75,
    high=66.3,
    roofTriangles=hip,
    estimated=True,
  )
  emit(0, 66.95, 0, 1.0, 0.65, 1.0, copper, "tower-fortuna-pedestal")
  # Original reduced silhouette: globe, slim standing figure and raised sail.
  emit(0, 67.55, 0, 0.58, 0.5, 0.58, copper, "fortuna-globe")
  emit(0, 68.7, 0, 0.30, 1.8, 0.28, copper, "fortuna-figure")
  emit(0.08, 69.82, 0, 0.36, 0.36, 0.32, copper, "fortuna-head")
  for k in range(7):
    emit(
      -0.35 - k * 0.08,
      69.1 + k * 0.1,
      0,
      0.3,
      0.22,
      0.12,
      copper,
      "fortuna-raised-sail",
    )
  # Four bare-stone gold clocks and narrow paired shaft openings.
  for side in range(4):
    sgn = 1 if side < 2 else -1
    for k in range(12):
      a = k * math.pi / 6
      u = math.sin(a) * 2.0
      y = 47.9 + math.cos(a) * 2.0
      pu, pv = (u, sgn * 4.22) if side % 2 == 0 else (sgn * 4.22, u)
      emit(pu, y, pv, 0.13, 0.25, 0.12, gold, "tower-gold-clock-hour")
    for k in range(15):
      u = -0.8 * k / 15
      y = 47.9 + 1.1 * k / 15
      pu, pv = (u, sgn * 4.25) if side % 2 == 0 else (sgn * 4.25, u)
      emit(pu, y, pv, 0.12, 0.14, 0.12, gold, "tower-clock-hand")
    for y in [14.0, 23.0, 33.0, 40.4]:
      for u in [-0.7, 0.7]:
        pu, pv = (u, sgn * 4.19) if side % 2 == 0 else (sgn * 4.19, u)
        emit(
          pu,
          y,
          pv,
          0.35 if side % 2 == 0 else 0.07,
          1.5,
          0.07 if side % 2 == 0 else 0.35,
          dark,
          "tower-narrow-shaft-window",
        )
  ring = [
    [x + d[0] * u + n[0] * v, z + d[1] * u + n[1] * v]
    for u, v in [(-4.15, -4.15), (4.15, -4.15), (4.15, 4.15), (-4.15, 4.15)]
  ]
  profile["tower"] = dict(
    id="rathaus-neukoelln-reference-tower-v305",
    anchor=[x, z],
    ring=ring,
    low=3,
    high=70,
    shaftHigh=53,
    estimated=True,
    documentedHeightConflict=[67, 68],
    fortunaHeightM=2.2,
    source="Retained OSM node5299353950 and BA photo; absent from LoD2 family; width and small silhouette are display estimates",
  )


def packet_plans() -> None:
  """Exact coarse source faces/ink/nav only; preserve every foreign triangle."""
  from shapely.geometry import box

  evidence = read(SOURCE)
  pins = read(RAW / "prepared-pins.json")
  packets = {}
  audit = []

  def triangles(m):
    positions = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    return [tuple(sorted(tuple(map(int, v)) for v in positions[t])) for t in indices]

  for key, pin in pins.items():
    mode, identity = key.split(":")
    native = mode == "minecraft"
    packet = read(
      ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{identity}.{mode}.json.gz"
    )
    prepared = read(RAW / f"{identity}.{mode}.prepared.json.gz")
    ox, _, oz = packet["origin"]
    tile = box(ox, oz, ox + 512, oz + 512)
    owners = []
    wanted = Counter()
    wanted_lines = Counter()
    for site in evidence["sites"]:
      old = site["predecessor"]
      g = exporter.polygonal(shape(old["geometry"]).intersection(tile))
      if native:
        g = exporter.native_polygon(g).intersection(tile)
      if g.is_empty:
        continue
      owners.append(old["sourceId"])
      low = 3 + old["minHeight"]
      high = 3 + max(old["height"], old["minHeight"] + 1)
      if native:
        high = 3 + max(2, round((high - 3) / 2) * 2)
      outline = (
        shapely.orient_polygons(g, exterior_cw=True).boundary
        if native
        else shapely.orient_polygons(
          shape(old["geometry"]), exterior_cw=True
        ).boundary.intersection(tile)
      )
      mesh = exporter.PackedMesh(ox, oz)
      mesh.building(g, low, high, outline)
      wanted.update(triangles(mesh.payload("city")))
      for line in (
        ()
        if native
        else exporter.line_parts(g.boundary.difference(tile.boundary.buffer(0.02)))
      ):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          segment = tuple(
            sorted(
              (
                tuple(round(v * 100) for v in [a[0] - ox, high + 0.02 + 10, a[1] - oz]),
                tuple(round(v * 100) for v in [b[0] - ox, high + 0.02 + 10, b[1] - oz]),
              )
            )
          )
          wanted_lines[segment] += 1
    retirement = []
    for mi, m in enumerate(prepared["meshes"]):
      if m["kind"] != "city":
        continue
      rows = []
      for i, t in enumerate(triangles(m)):
        if wanted[t] > 0:
          rows.append(i)
          wanted[t] -= 1
      if rows:
        retirement.append(dict(mesh=mi, triangles=rows))
    missing = sum(wanted.values())
    if missing:
      raise ValueError(f"{key}: {missing} exact source body triangles were not found")
    retire_lines = []
    if prepared.get("lines"):
      ps = np.frombuffer(
        base64.b64decode(prepared["lines"]["positions"]), "<u2"
      ).reshape(-1, 2, 3)
      for i, s in enumerate(ps):
        k = tuple(sorted(tuple(map(int, v)) for v in s))
        if wanted_lines[k] > 0:
          retire_lines.append(i)
          wanted_lines[k] -= 1
    if sum(wanted_lines.values()):
      raise ValueError(f"{key}: exact old roof ink missing")
    nav = [b for b in prepared["nav"]["buildings"] if b["sourceId"] in owners]
    if set(b["sourceId"] for b in nav) != set(owners):
      raise ValueError("Not every old body has an exact navigation record")
    packets[key] = dict(
      origin=packet["origin"],
      **pin,
      retire=retirement,
      retireLines=retire_lines,
      retireNav=nav,
      appendNav=[],
      owners=owners,
    )
    audit.append(
      dict(
        key=key,
        owners=owners,
        retiredTriangles=sum(len(r["triangles"]) for r in retirement),
        retiredRoofSegments=len(retire_lines),
        retiredNavigation=len(nav),
        preservedParts=len(prepared["meshes"]),
        oldOnlyRequiredReplacement=True,
      )
    )
  write(
    DATA / "neukoellnLandmarksV305Packets.json",
    dict(schemaVersion=1, keys=list(packets), packets=packets),
  )
  write(
    GEO / "neukoelln-landmarks-v305-packet-evidence.json",
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      packets=audit,
      policy="Whole exact source predecessor body only; all unrelated roofs, roads, curbs, triangles, navigation and earlier packet fittings preserved. No model means no retirement; all old outside fragments are retained in required replacement.",
    ),
  )
  print(json.dumps(audit))


if __name__ == "__main__":
  if "--extract" in sys.argv:
    extract()
  if "--compile" in sys.argv:
    compile_data()
  if "--packets" in sys.argv:
    packet_plans()
