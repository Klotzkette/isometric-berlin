"""Complete bounded Rixdorf source bodies and independent native roof courses.

Writes only v304 derivatives. Current packets and every older source stay exact
inputs; old whole-owner triangles/ink/nav are receipted, never regenerated away.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import inspect
import json
import math
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import (
  Detail,
  clip_polygon,
  mesh_signature,
  packed_detail,
)
from build_scheunenviertel_v168 import merge_native_faces
from build_surrounding_outlines import (
  chunk_payload,
  load_projected_polygon,
  polygons_from_geometry,
  world,
)
from integrate_city_refinements_v166 import line_signature
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "rixdorf-v304-source.json.gz"
PLAN = DATA / "rixdorfV304.json"
LEGACY = DATA / "legacyFittingsV304.json"
EVIDENCE = GEO / "rixdorf-v304-evidence.json.gz"
KIND = "rixdorf-v304"
PRESERVED = {
  "DEBE08YYF000005L",
  "DEBE08YYF00005wd",
  "DEBE08YYF00006o6",
  "DEBE08YYF00003et",
  "DEBE08YYF00008Fc",
}
REFERENCE_PAGE = (
  "https://www.berlin.de/tourismus-neukoelln/entdecken/artikel.1152599.php"
)
LDA = "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr="


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  def numeric(v: Any) -> Any:
    if isinstance(v, np.generic):
      return v.item()
    raise TypeError(type(v).__name__)

  raw = (
    json.dumps(
      value, ensure_ascii=False, separators=(",", ":"), allow_nan=False, default=numeric
    )
    + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def fnv(text: str) -> int:
  h = 2166136261
  for c in text:
    h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return h


def fingerprint(mesh: dict) -> int:
  return fnv(mesh["positions"] + mesh["colors"] + mesh["indices"])


def extract(reference_dir: Path) -> dict:
  """Freeze only the audited 70 addressed families and two hall companions."""
  inputs = read(reference_dir / "inventory-inputs.json")
  inventory = read(reference_dir / "inventory-summary.json")
  labels = {r["parent"]: r["labels"] for r in inventory}
  labels.update(
    {
      "DEBE08YYF0000AbQ": ["Kirchgasse 14–17, northern hall companion"],
      "DEBE08YYF00008yd": ["Kirchgasse 14–17, southern hall companion"],
    }
  )
  parents = [
    dict(p, labels=labels[p["id"]]) for p in inputs["parents"] if p["id"] in labels
  ]
  assert len(parents) == 72 and not (set(labels) & PRESERVED)
  geoms = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in parents
  }
  selected = unary_union(list(geoms.values()))
  old = [
    r
    for r in inputs["oldOwners"]
    if shape(r["geometry"]).intersection(selected).area / shape(r["geometry"]).area
    > 0.2
  ]
  for r in old:
    g = shape(r["geometry"])
    r["replacementOwners"] = [
      p for p, q in geoms.items() if q.intersection(g).area / min(g.area, q.area) > 0.2
    ]
    r["measuredCoverage"] = round(g.intersection(selected).area / g.area, 6)
  assert all(r["replacementOwners"] for r in old)
  archives = sorted({p["archive"] for p in parents})
  return {
    "schemaVersion": 1,
    "policy": "70 addressed complete official families, plus two complete companions of the same modern Kirchgasse hall; no new city coverage. Every original source ring, hole, wall and roof sheet retained. The five previously authored v210 church/smithy parents, belfry, furniture, mapped paths, gardens and all other owners remain untouched. Small facade openings, neutral colours, shutters and trim are recognition estimates, not measured subdivisions or a 2026 paint/tenant survey.",
    "parents": parents,
    "oldOwners": old,
    "archives": [
      {
        "url": "https://gdi.berlin.de/data/a_lod2/atom/" + name,
        "sha256": sha(GEO / "raw/lod2" / name),
        "license": "dl-de/zero-2-0",
      }
      for name in archives
    ],
    "mappedSource": {
      "url": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "sha256": sha(GEO / "raw/outer-v159/berlin-260929.osm.pbf"),
      "license": "ODbL-1.0",
    },
    "factualReferences": [
      LDA + "09090370",
      LDA + "09090376",
      "https://www.berlin.de/ba-neukoelln/_assets/bilder/stadtentwicklungsamt/stadtplanung/rixdorf-seine-geschichte-und-denkmale.pdf",
    ],
    "visualReferences": [
      {
        "page": REFERENCE_PAGE,
        "author": "visitBerlin / Dagmar Schwelle",
        "license": "Reference only; no redistribution licence asserted",
        "file": file,
        "inspectedImageSha256": sha(reference_dir / file),
        "use": use,
      }
      for file, use in [
        (
          "kirchgasse-dagmar-schwelle.jpg",
          "Low village houses, gardens, pitched roof contrast and taller corner house; no image pixels reproduced.",
        ),
        (
          "richardplatz-houses-dagmar-schwelle.jpg",
          "Cream plaster, brick, green shutters and tall gates on low houses; exact small facade subdivisions remain estimates.",
        ),
        (
          "kutschenhof-dagmar-schwelle.jpg",
          "Retained low courtyard roofs, open yard and subsidiary buildings; no blanket perimeter fill.",
        ),
      ]
    ],
  }


def rgb(v: int) -> tuple[int, int, int]:
  return (v >> 16 & 255, v >> 8 & 255, v & 255)


def retained_roof_colours(source: dict) -> dict[str, int]:
  """Keep the sole exact earlier mapped roof observation across body replacement."""
  pins = {
    "outer-materials-v232-evidence.json.gz": "09188f7cd63500491ce62c7cf8bcaf11c14fe4d729d8465a280c224b1c956fdf",
    "outer-materials-v254-evidence.json.gz": "4362a8e8e596470fac9408849f7c056c02ffadd7f09c2a0f8ca48da240f98948",
    "outer-materials-v263-evidence.json.gz": "0b61405f4a134f491175b7d93ce39ec7dbfb422ac65cebf2c76cfbcbc374d3f7",
  }
  old = {row["sourceId"]: row for row in source["oldOwners"]}
  observed = {}
  for name, pin in pins.items():
    path = GEO / name
    assert sha(path) == pin
    evidence = read(path)
    for owner in old.keys() & evidence["owners"].keys():
      assert owner not in observed
      observed[owner] = evidence["owners"][owner]
  assert set(observed) == {"OSM-way-168921751"}
  owner = "OSM-way-168921751"
  assert old[owner]["replacementOwners"] == ["DEBE08YYF0000CEW"]
  assert observed[owner]["tags"] == {
    "roof:colour": "#c59d8f",
    "roof:material": "roof_tiles",
  }
  assert observed[owner]["wall"] is None and observed[owner]["roof"] == [197, 157, 143]
  # The retained source observation outranks the village display estimate.
  return {"DEBE08YYF0000CEW": 0xC59D8F}


def translated_surfaces(parent: dict) -> tuple[list[dict], float]:
  low = min(p["ground_y_m"] for p in parent["parts"])
  result = []
  for part in parent["parts"]:
    for si, s in enumerate(part["surfaces"]):
      rings = [
        [[x, round(y - low + 3, 3), z] for x, y, z in ring] for ring in s["rings"]
      ]
      result.append(dict(part=part["id"], sheet=si, kind=s["kind"], rings=rings))
  return result, low


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
        if village and row == 0 and "Kirchgasse 14" not in " ".join(parent["labels"]):
          for side in [-1, 1]:
            pane(
              u + side * (ww / 2 + 0.22),
              y,
              0.31,
              h + 0.12,
              0x456E54,
              "estimated village shutter",
              0.09,
            )
  pane(w / 2, lower + 0.22, w - 0.1, 0.30, 0xADA99A, "estimated plinth", 0.065)
  pane(w / 2, eave - 0.14, w - 0.1, 0.16, 0xD9D1BA, "estimated eave course", 0.09)
  return openings


def models(source: dict) -> tuple[dict, dict, dict]:
  parents = source["parents"]
  roof_colours = retained_roof_colours(source)
  footprints = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in parents
  }
  # Keep exact delivered foreign footprints as occlusion input, never as fill.
  occupied = unary_union(
    [shape(r["geometry"]) for r in source["oldOwners"]] + list(footprints.values())
  )
  drawn, native, metrics = {}, {}, {}
  for p in parents:
    d = Detail()
    surfaces, _ = translated_surfaces(p)
    village = (
      max(q["top_y_m"] for q in p["parts"]) - min(q["ground_y_m"] for q in p["parts"])
      < 14
    )
    # Material classes remain measured-vs-estimated explicit. No random colours.
    wall, roof = (0xDED6BF, 0xA76349) if village else (0xC9C7BA, 0x697171)
    if p["id"] in {"DEBE08YYF000005c", "DEBE08YYF0000AbQ", "DEBE08YYF00008yd"}:
      wall, roof = 0xC3BCA8, 0x6F716A
    roof = roof_colours.get(p["id"], roof)
    roof_triangles = []
    for s in surfaces:
      ts = triangles_for(s["rings"])
      for t in ts:
        d.triangles.append(
          (t, rgb(roof if s["kind"] == "RoofSurface" else wall), "source " + s["kind"])
        )
      if s["kind"] == "RoofSurface":
        roof_triangles.extend(ts)
    openings = sum(
      facade(d, s, p, occupied, footprints[p["id"]])
      for s in surfaces
      if s["kind"] == "WallSurface"
    )
    n, caps = native_model(d)
    drawn[p["id"]] = d
    native[p["id"]] = n
    metrics[p["id"]] = {
      "labels": p["labels"],
      "parts": len(p["parts"]),
      "sourceSheets": len(surfaces),
      "drawnTriangles": len(d.triangles),
      "nativeTriangles": len(n.triangles),
      "estimatedOpenings": openings,
      "roofTriangles": roof_triangles,
      "nativeRoofCaps": caps,
    }
    print(p["id"], len(d.triangles), len(n.triangles), flush=True)
  return drawn, native, metrics


def native_model(detail: Detail) -> tuple[Detail, list]:
  """Independent one-metre surface skin; exact coplanar union removes seams."""
  cells = {}
  caps = {}
  for triangle, color, role in detail.triangles:
    # Fine trim stays explicit in the drawn view. The native skin reads each
    # opening with actual cardinal cells rather than a rotated smooth plane.
    if role in {
      "estimated window reveal",
      "estimated window mullion",
      "estimated window transom",
      "estimated stone sill",
      "estimated plinth",
      "estimated eave course",
    }:
      continue
    a, b, c = np.array(triangle)
    normal = np.cross(b - a, c - a)
    mag = np.linalg.norm(normal)
    if mag < 1e-9:
      continue
    normal /= mag
    offset = normal * (0.45 if role.startswith("estimated") else 0.01)
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.45
      ),
    )
    ii, jj = np.triu_indices(steps + 1)
    points = (
      a
      + (ii / steps)[:, None] * (b - a)
      + ((jj - ii) / steps)[:, None] * (c - a)
      + offset
    )
    rows = np.unique(np.floor(points - [0, 3, 0]).astype(int), axis=0)
    for row in rows:
      k = tuple(row)
      cells[k] = color
      if role == "source RoofSurface":
        caps[(k[0], k[2])] = max(caps.get((k[0], k[2]), -math.inf), k[1] + 4)
  out = Detail()
  for (x, iy, z), color in cells.items():
    y = iy + 3
    for delta, q in [
      ((-1, 0, 0), [[x, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z]]),
      (
        (1, 0, 0),
        [[x + 1, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1]],
      ),
      ((0, -1, 0), [[x, y, z + 1], [x, y, z], [x + 1, y, z], [x + 1, y, z + 1]]),
      (
        (0, 1, 0),
        [[x, y + 1, z], [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]],
      ),
      ((0, 0, -1), [[x + 1, y, z], [x, y, z], [x, y + 1, z], [x + 1, y + 1, z]]),
      (
        (0, 0, 1),
        [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]],
      ),
    ]:
      if (x + delta[0], iy + delta[1], z + delta[2]) not in cells:
        out.polygon(q, color, "native cardinal surface")
  return merge_native_faces(out), [
    [x, z, x + 1, z + 1, y] for (x, z), y in sorted(caps.items())
  ]


def prepared_packets(paths: list[Path]) -> dict:
  """Run the complete unchanged predecessor preparers using the same viewer flags."""
  code = r"""
import {gunzipSync} from 'node:zlib';
import {basename} from 'node:path';
import {prepareSurroundingQuarterPredecessorV303 as prepare} from './src/SurroundingCityGeometry.ts';
const done=g=>{let r=g.next();while(!r.done)r=g.next();return r.value};
const ownership={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h};
const out={};for(const path of Bun.argv.slice(1)){const raw=await Bun.file(path).bytes(),p=JSON.parse(new TextDecoder().decode(path.endsWith('.gz')?gunzipSync(raw):raw)),id=basename(path).split('.')[0],native=path.includes('.minecraft.');const n=done(prepare(p,id,native,ownership));out[path]={prepared:n,navGuard:fnv(JSON.stringify(p.nav)),lineGuard:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null,preparedNavGuard:fnv(JSON.stringify(n.nav)),preparedLineGuard:n.lines?fnv(n.lines.positions+(n.lines.colors??'')):null};}process.stdout.write(JSON.stringify(out));
"""
  r = subprocess.run(
    ["bun", "-e", code, *map(str, paths)],
    cwd=ROOT / "src/app",
    capture_output=True,
    text=True,
    check=True,
  )
  return json.loads(r.stdout)


def exact_retirement(packet: dict, expected: Counter, kind: str = "city") -> list:
  records = []
  for mi, m in enumerate(packet["meshes"]):
    if m["kind"] != kind:
      continue
    ps = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    cs = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    vs = np.column_stack([ps, cs])
    selected = []
    for ti, tri in enumerate(vs[ix]):
      key = b"".join(sorted(q.tobytes() for q in tri))
      if expected[key]:
        expected[key] -= 1
        selected.append(ti)
    if selected:
      records.append(dict(mesh=mi, triangles=selected))
  assert not +expected, f"Missing exact old triangles {sum((+expected).values())}"
  return records


def line_retirement(packet: dict, expected: Counter) -> list:
  if not expected:
    return []
  p = packet["lines"]
  ps = np.frombuffer(base64.b64decode(p["positions"]), "<u2").reshape(-1, 3)
  cs = np.frombuffer(base64.b64decode(p["colors"]), "u1").reshape(-1, 3)
  values = np.column_stack([ps, cs]).reshape(-1, 2, 6)
  selected = []
  for i, pair in enumerate(values):
    k = b"".join(sorted(q.tobytes() for q in pair))
    if expected[k]:
      expected[k] -= 1
      selected.append(i)
  assert not +expected, f"Missing old ink {sum((+expected).values())}"
  return selected


def roof_lines(detail: Detail, tile: Any, origin: list) -> dict | None:
  lines = set()
  edges = Counter()
  points = {}
  for t, _, role in detail.triangles:
    if role != "source RoofSurface":
      continue
    n = np.cross(np.array(t[1]) - t[0], np.array(t[2]) - t[0])
    if np.linalg.norm(n) < 1e-9:
      continue
    n = n / np.linalg.norm(n)
    plane = tuple(round(float(v), 6) for v in [*n, np.dot(n, t[0])])
    for a, b in zip(t, t[1:] + t[:1]):
      edge = tuple(sorted(tuple(round(float(v), 6) for v in p) for p in [a, b]))
      key = (plane, edge)
      edges[key] += 1
      points[key] = [a, b]
  for key, count in edges.items():
    # Suppress only an internal triangulation edge shared by two coplanar
    # triangles. Source roof boundaries, pitches and ridges stay explicit.
    if count % 2 == 0:
      continue
    q = points[key]
    for axis, edge, lower in [
      (0, tile.bounds[0], True),
      (0, tile.bounds[2], False),
      (2, tile.bounds[1], True),
      (2, tile.bounds[3], False),
    ]:
      if len(q) < 2:
        break
      aa, bb = q
      ia = aa[axis] >= edge if lower else aa[axis] <= edge
      ib = bb[axis] >= edge if lower else bb[axis] <= edge
      if not ia and not ib:
        q = []
      elif ia != ib:
        f = (edge - aa[axis]) / (bb[axis] - aa[axis])
        p = [aa[i] + f * (bb[i] - aa[i]) for i in range(3)]
        q = [aa, p] if ia else [p, bb]
    if len(q) == 2:
      v = [tuple(int(round((x - o) * 100)) for x, o in zip(p, origin)) for p in q]
      if v[0] != v[1] and all(0 <= x <= 65535 for p in v for x in p):
        lines.add(tuple(sorted(v)))
  if not lines:
    return None
  arr = np.array(sorted(lines), dtype="<u2").reshape(-1, 3)
  return {
    "positions": base64.b64encode(arr.tobytes()).decode(),
    "colors": base64.b64encode(
      np.tile(np.array([32, 34, 32], dtype="u1"), (len(arr), 1)).tobytes()
    ).decode(),
  }


def navigation(
  parent: dict, metric: dict, tile: Any, origin: list, native: bool
) -> list:
  low = min(p["ground_y_m"] for p in parent["parts"])
  rows = []
  for part in parent["parts"]:
    footprint = Polygon(part["ring"], part["holes"])
    native_caps = (
      [
        cap
        for cap in metric["nativeRoofCaps"]
        if box(*cap[:4]).intersection(footprint).area > 0.00001
        and box(*cap[:4]).intersection(tile).area > 0.00001
      ]
      if native
      else []
    )
    if native:
      native_caps = merge_caps(native_caps)
    # The native body is an independent orthogonal one-metre exterior skin.
    # Its granular collision footprint must follow those same roof cells,
    # including their stepped court holes, rather than rotated smooth rings.
    shape_local = (
      unary_union([box(*cap[:4]) for cap in native_caps]).intersection(tile)
      if native
      else footprint.intersection(tile)
    )
    if shape_local.area < 0.00001:
      continue
    for g in polygons_from_geometry(shape_local):
      g = translate(g, -origin[0], -origin[2])
      r = {
        "ring": [[round(x, 3), round(z, 3)] for x, z in list(g.exterior.coords)[:-1]],
        "holes": [
          [[round(x, 3), round(z, 3)] for x, z in list(h.coords)[:-1]]
          for h in g.interiors
        ],
        "height": round(part["top_y_m"] - low, 3),
        "minHeight": round(part["ground_y_m"] - low, 3),
        "sourceId": parent["id"] + ":" + part["id"],
      }
      if native:
        r["minHeight"] = math.floor(part["ground_y_m"] - low)
        caps = []
        for x0, z0, x1, z1, top in native_caps:
          if max(x0, tile.bounds[0]) >= min(x1, tile.bounds[2]) or max(
            z0, tile.bounds[1]
          ) >= min(z1, tile.bounds[3]):
            continue
          if (
            box(x0, z0, x1, z1).intersection(translate(g, origin[0], origin[2])).area
            < 0.00001
          ):
            continue
          caps.append(
            [
              max(x0, tile.bounds[0]) - origin[0],
              max(z0, tile.bounds[1]) - origin[2],
              min(x1, tile.bounds[2]) - origin[0],
              min(z1, tile.bounds[3]) - origin[2],
              top - 3,
            ]
          )
        r["nativeRoofCaps"] = caps
        if caps:
          r["height"] = max(c[4] for c in caps)
      else:
        roofs = []
        for s in part["surfaces"]:
          if s["kind"] != "RoofSurface":
            continue
          rings = [[[x, y - low, z] for x, y, z in ring] for ring in s["rings"]]
          for tri in triangles_for(rings):
            q = tri
            for axis, edge, lower in [
              (0, tile.bounds[0], True),
              (0, tile.bounds[2], False),
              (2, tile.bounds[1], True),
              (2, tile.bounds[3], False),
            ]:
              q = clip_polygon(q, axis, edge, lower)
              if len(q) < 3:
                break
            for i in range(1, len(q) - 1):
              roofs.append(
                [
                  [
                    round(v[0] - origin[0], 3),
                    round(v[1], 3),
                    round(v[2] - origin[2], 3),
                  ]
                  for v in [q[0], q[i], q[i + 1]]
                ]
              )
        r["roofTriangles"] = roofs
      rows.append(r)
  return rows


def merge_caps(cells: list) -> list:
  """Join only identical adjacent one-metre cap cells, preserving every top."""
  horizontal = defaultdict(list)
  for x0, z0, x1, z1, y in cells:
    assert x1 - x0 == 1 and z1 - z0 == 1
    horizontal[(z0, z1, y)].append(x0)
  stripes = defaultdict(list)
  for (z0, z1, y), xs in sorted(horizontal.items()):
    start = end = min(xs)
    for x in [*sorted(set(xs))[1:], None]:
      if x is not None and x == end + 1:
        end = x
        continue
      stripes[(start, end + 1, y)].append(z0)
      start = end = x
  result = []
  for (x0, x1, y), zs in sorted(stripes.items()):
    start = end = min(zs)
    for z in [*sorted(set(zs))[1:], None]:
      if z is not None and z == end + 1:
        end = z
        continue
      result.append([x0, start, x1, end + 1, y])
      start = end = z
  return result


def build(source: dict) -> None:
  descriptors = [
    d
    for d in read(OUT / "manifest.json")["chunks"]
    if d["id"].startswith("ring182-") and not d.get("detailCompanionOf")
  ]
  old = source["oldOwners"]
  scope = world(
    load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(
      load_projected_polygon(GEO / "bounds.geojson")
    )
  )
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
    inspect.getsource(f)
    for f in [models, facade, native_model, translated_surfaces, retained_roof_colours]
  )
  cache = (
    GEO
    / "raw"
    / (
      "rixdorf-v304-" + hashlib.sha256(signature.encode()).hexdigest()[:16] + ".json.gz"
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
        expected.update(mesh_signature(full) - mesh_signature(empty))
        if not is_native:
          expectedlines.update(
            line_signature(full["lines"]) - line_signature(empty["lines"])
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
  legacy = []
  v185 = read(GEO / "south-kiez-v185-evidence.json")
  for mode, name, field, first, count in [
    ("drawn", "southKiezV185.json", "boxes", "firstBox", "boxCount"),
    (
      "minecraft",
      "southKiezV185Native.json",
      "nativeRows",
      "firstNative",
      "nativeCount",
    ),
  ]:
    path = DATA / name
    rows = read(path)[field]
    for e in v185["features"]:
      if e["role"] != "source-frontage-profile" or e["sourceId"] not in ownerkeys:
        continue
      start, n = e[first], e[count]
      legacy.append(
        dict(
          native=mode == "minecraft",
          owner=e["sourceId"],
          expectedCount=len(rows),
          rows=[
            dict(index=start + i, row=row)
            for i, row in enumerate(rows[start : start + n])
          ],
          requiredPacketKeys=[
            k for k in ownerkeys[e["sourceId"]] if k.startswith(mode + ":")
          ],
        )
      )
  write(LEGACY, dict(schemaVersion=1, records=legacy))
  counts = {
    "addressedFamilies": 70,
    "completeOfficialParents": len(parents),
    "oldOwners": len(old),
    "packets": len(plans),
    "sourceParts": sum(len(p["parts"]) for p in parents.values()),
    "sourceSheets": sum(m["sourceSheets"] for m in metrics.values()),
    "drawnTriangles": sum(m["drawnTriangles"] for m in metrics.values()),
    "nativeTriangles": sum(m["nativeTriangles"] for m in metrics.values()),
    "estimatedOpenings": sum(m["estimatedOpenings"] for m in metrics.values()),
    "legacyProfiles": len(legacy),
    "runtimeBytes": PLAN.stat().st_size,
    "runtimeGzipBytes": len(gzip.compress(PLAN.read_bytes(), mtime=0)),
  }
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      runtimeSha256=sha(PLAN),
      legacySha256=sha(LEGACY),
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
      preservedV210Owners=sorted(PRESERVED),
      materialTransfers=[
        dict(
          oldOwner="OSM-way-168921751",
          replacementOwner="DEBE08YYF0000CEW",
          source="outer-materials-v254-evidence.json.gz",
          sourceSha256="4362a8e8e596470fac9408849f7c056c02ffadd7f09c2a0f8ca48da240f98948",
          roofColour="#c59d8f",
          roofMaterial="roof_tiles",
          bothModes=True,
          preservedOtherGeometryAndColours=True,
        )
      ],
      legacyPolicy="Only exact v185 estimated source-frontage profiles of admitted whole-owner replacements may be masked; the root lifetime controller must restore them on eviction. All benches, street/path edges and every other profile remain unchanged.",
    ),
  )
  print(counts)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument(
    "--references",
    type=Path,
    help="Retained external inventory and reference-photo directory; required only with --extract",
  )
  args = parser.parse_args()
  if args.extract:
    if args.references is None:
      parser.error(
        "--extract requires --references pointing to the retained inventory and reference photos"
      )
    write(SOURCE, extract(args.references))
  build(read(SOURCE))


if __name__ == "__main__":
  main()
