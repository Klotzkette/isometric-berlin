"""Finite Friedrichshain street fronts and four complete corrected source families.

New files only. Every body/ink retirement is replayed from the original full
resolved owner, guarded at the complete prior construction stage. Source sheets
and all outside owners remain retained. Facade details are display estimates.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
import shapely
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts import build_ost_housing_v301 as front
from scripts import build_surrounding_outlines as old
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_moabit_mitte_v300 import roof_at

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data/friedrichshainV303.json"
PROFILES = GEO / "friedrichshain-v303-profiles.json"
SOURCE = GEO / "friedrichshain-v303-source.json.gz"
EVIDENCE = GEO / "friedrichshain-v303-evidence.json.gz"
KIND = "friedrichshain-v303"


def read(path: Path) -> Any:
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def write(path: Path, value: Any) -> None:
  data = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(data, mtime=0) if path.suffix == ".gz" else data)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


class Mesh(front.Fittings):
  def payload(self) -> dict[str, Any]:
    return {**super().payload(), "kind": KIND}

  def triangle(self, points: Any, tint: int, role: str) -> None:
    values = np.rint((np.array(points) - self.origin) * 100).astype(np.int64)
    if np.min(values) < 0 or np.max(values) > 65535:
      raise ValueError("Complete source triangle outside packet frame")
    if len(set(map(tuple, values))) != 3:
      return
    start = len(self.positions)
    self.positions.extend(values.tolist())
    self.colors.extend([front.linear(tint)] * 3)
    self.indices.extend([start, start + 1, start + 2])
    self.roles[role] += 1


def packet_path(key: str, native: bool) -> Path:
  return OUT / f"{key}.{'minecraft' if native else 'drawn'}.json.gz"


def guards(paths: list[Path]) -> dict[str, dict[str, Any]]:
  # JS owns JSON.stringify number semantics and the precise published stage.
  code = r"""
import {gunzipSync} from 'node:zlib';
import {prepareSurroundingQuarterPredecessorV303} from './src/SurroundingCityGeometry.ts';
const done=g=>{let r=g.next();while(!r.done)r=g.next();return r.value};
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h};
const out={};
for(const path of Bun.argv.slice(1)){
 const p=JSON.parse(gunzipSync(await Bun.file(path).bytes()).toString()),native=path.includes('.minecraft.');
 const q=done(prepareSurroundingQuarterPredecessorV303(p,p.id,native,{neighbourhoodV300:true,westKiezV302:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,tachelesFrontsV270:true}));
 out[path]={navGuard:fnv(JSON.stringify(p.nav)),lineGuard:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null,preparedNavGuard:fnv(JSON.stringify(q.nav)),preparedLineGuard:q.lines?fnv(q.lines.positions+(q.lines.colors??'')):null,prepared:q};
}
process.stdout.write(JSON.stringify(out));
"""
  result = subprocess.run(
    ["bun", "-e", code, *map(str, paths)],
    cwd=ROOT / "src/app",
    capture_output=True,
    text=True,
    check=True,
  )
  return json.loads(result.stdout)


def source_records(packet: dict[str, Any]) -> list[dict[str, Any]]:
  return [
    {"mesh": i, "kind": m["kind"], "fingerprint": front.mesh_fingerprint(m)}
    for i, m in enumerate(packet["meshes"])
  ]


def choose_old_faces(
  profile: dict[str, Any], fronts: list[dict[str, Any]], faces: list[dict[str, Any]]
) -> list[dict[str, Any]]:
  result = []
  for f in faces:
    if f["owner"] != profile["owner"] or f["chunk"] != profile["packet"]:
      continue
    for q in fronts:
      a, d, n = (np.array(q[k]) for k in ["a", "d", "n"])
      aa, bb = np.array(f["a"]), np.array(f["b"])
      if (
        np.dot(f["normal"], n) > 0.995
        and max(abs((aa - a) @ n), abs((bb - a) @ n)) < 1.1
      ):
        span = sorted([(aa - a) @ d, (bb - a) @ d])
        if span[0] >= -0.05 and span[1] <= q["length"] + 0.05:
          result.append(f)
          break
  return result


def single_front(
  mesh: Mesh,
  face: dict[str, Any],
  profile: dict[str, Any],
  native: bool,
  plane: Any,
  carrier: dict[str, Any],
) -> None:
  """Existing full-plane support; measured bodies never acquire invented wings."""
  length, low, high = (face[k] for k in ["length", "low", "high"])
  modern = profile["id"] in {"rigaer36", "rigaer38"}
  # Photograph-backed paint and brick zones are shallow display sheets, never
  # a replacement for the measured source backing or a new closed court.
  if modern or profile["id"] == "simon-dach41":
    for y0, y1, tint in (
      [(low + 0.06, low + 6.1, 0xB29A82), (low + 6.1, high - 0.1, 0xE4DCD0)]
      if modern
      else [(low + 0.06, high - 0.1, 0xCEAD5E)]
    ):
      front.pane_if_backed(
        mesh,
        face,
        plane,
        length / 2,
        (y0 + y1) / 2,
        length - 0.06,
        y1 - y0,
        tint,
        "photo-backed-facade-field",
        0.03,
      )
  if modern:
    # Contemporary tall lights, a double-height brick base and plain upper
    # horizontal bands; no transplanted Gründerzeit window hoods here.
    total = carrier["length"]
    columns = (
      max(1, round(length / (total / profile["columns"])))
      if native
      else profile["columns"]
    )
    for row in range(7):
      y = (
        low + 1.5
        if row == 0
        else low + 4.8
        if row == 1
        else low + 6.4 + (row - 1.5) * (high - low - 7) / 5
      )
      for col in range(columns):
        if native:
          u = (col + 0.5) * length / columns
        else:
          point = np.array(carrier["a"]) + np.array(carrier["d"]) * (
            (col + 0.5) * total / columns
          )
          u = float(np.dot(point - np.array(face["a"]), face["d"]))
        width = min(1.42, (length / columns if native else total / columns) * 0.65)
        height = 2.05 if row > 1 else 1.65
        if not front.pane_if_backed(
          mesh,
          face,
          plane,
          u,
          y,
          width + 0.14,
          height + 0.14,
          0xC5C0B8,
          "modern-reveal",
          0.08,
        ):
          continue
        mesh.pane(face, u, y, width, height, 0x53626A, "modern-tall-glass", 0.11)
        mesh.pane(face, u, y, 0.045, height, 0xD5D1C7, "modern-mullion", 0.13)
        if row > 1:
          mesh.pane(
            face, u, y - 0.52, width, 0.055, 0x515A59, "modern-french-rail", 0.18
          )
          for delta in [-0.4, 0, 0.4]:
            mesh.pane(
              face,
              u + delta * width,
              y - 0.87,
              0.035,
              0.7,
              0x515A59,
              "modern-french-upright",
              0.18,
            )
      if row > 1:
        front.pane_if_backed(
          mesh,
          face,
          plane,
          length / 2,
          y + 1.33,
          length - 0.08,
          0.15,
          0xE9E5DB,
          "modern-storey-band",
          0.08,
        )
    return
  if native and profile["id"] == "silvio-meier6":
    profile = {**profile, "balconyColumns": [1, 2, 6, 7]}
  front.reference_front(mesh, face, profile, native, plane, carrier)
  # The architect's photographed Silvio6 front has two broad paired balcony
  # groups, separate from the plain centre windows. Small depths are estimates.
  if profile["id"] == "silvio-meier6" and not native:
    low, eave = face["low"], face.get("representedEave", face["high"])
    a, d = (np.array(carrier[k]) for k in ["a", "d"])
    for fraction in [2 / 9, 7 / 9]:
      point = a + d * (carrier["length"] * fraction)
      u = float(np.dot(point - np.array(face["a"]), face["d"]))
      width = min(carrier["length"] * 2 / 9, 5.4)
      for floor in range(1, 5):
        y = low + 3.4 + (floor - 1) * (eave - low - 3.9) / 4 + 0.18
        if not plane.buffer(0.02).covers(
          box(u - width / 2, y - 0.2, u + width / 2, y + 1)
        ):
          continue
        mesh.member(
          face, u, y, width, 0.12, 0.8, 0xC7C4B7, "silvio-paired-balcony-slab", 0.10
        )
        mesh.pane(
          face, u, y + 0.52, width, 0.78, 0xD3D1C4, "silvio-solid-parapet", 0.90
        )
        mesh.pane(face, u, y + 0.95, width, 0.06, 0xEEEADD, "silvio-parapet-cap", 0.92)


def fitting_plans(
  profiles: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
  recipes = {}
  evidence = []
  paths = set()
  raws = {}
  old_faces = read(GEO / "district-facades-v188-evidence.json.gz")["faces"]

  def packet(key: str, native: bool) -> dict[str, Any]:
    path = packet_path(key, native)
    paths.add(path)
    if path not in raws:
      raws[path] = read(path)
    return raws[path]

  seen = set()
  for profile in profiles:
    pair = (profile["packet"], profile["owner"])
    if pair in seen:
      continue
    seen.add(pair)
    source = packet(profile["packet"], False)
    fronts = front.selected_fronts(source, profile)
    if not fronts:
      raise ValueError("Missing complete front " + profile["id"])
    carrier = front.carrier_for(fronts)
    old_faces_here = choose_old_faces(profile, fronts, old_faces)
    target = "district188-" + profile["packet"] if old_faces_here else profile["packet"]
    for native in [False, True]:
      raw = packet(target, native)
      support = packet(profile["packet"], native)
      key = ("minecraft:" if native else "drawn:") + target
      rec = recipes.setdefault(
        key, {"raw": raw, "mesh": Mesh(raw["origin"]), "owners": [], "oldFaces": []}
      )
      faces = front.native_fronts(support, profile, fronts) if native else fronts
      before = len(rec["mesh"].positions)
      for face in faces:
        plane = front.source_plane(support, face)
        single_front(rec["mesh"], face, profile, native, plane, carrier)
      if len(rec["mesh"].positions) == before:
        raise ValueError("No supported facade " + profile["id"] + " " + str(native))
      rec["owners"].append(profile["owner"])
      rec["oldFaces"].extend(old_faces_here)
      evidence.append(
        {
          "profile": profile,
          "key": key,
          "newVertices": len(rec["mesh"].positions) - before,
          "supportedFaces": faces,
          "carrier": carrier,
        }
      )
  pins = guards(sorted(paths))
  plans = {}
  retirement = []
  for key, rec in recipes.items():
    native = key.startswith("minecraft:")
    tile = key.split(":", 1)[1]
    raw = rec["raw"]
    path = packet_path(tile, native)
    retire, proof = front.exact_retirements(
      {**raw, "_auditNative": native}, rec["oldFaces"]
    )
    append = rec["mesh"].payload()
    pin = {k: v for k, v in pins[str(path)].items() if k != "prepared"}
    plans[key] = {
      "origin": raw["origin"],
      **pin,
      "records": source_records(raw),
      "append": append,
      "appendFingerprint": front.mesh_fingerprint(append),
      "retire": retire,
      "owners": sorted(set(rec["owners"])),
    }
    retirement.extend({"key": key, **p} for p in proof)
  return plans, {
    "fronts": evidence,
    "retiredGenericPanes": retirement,
    "inputs": {
      str(p.relative_to(ROOT)): {
        "wireSha256": sha(p),
        "decodedSha256": hashlib.sha256(gzip.decompress(p.read_bytes())).hexdigest(),
      }
      for p in paths
    },
  }


def triangle_key(points: Any) -> tuple[tuple[int, ...], ...]:
  return tuple(sorted(tuple(map(int, p)) for p in points))


def replay_old_body(
  raw: dict[str, Any], owner: str, source_shape: Any, native: bool
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int], list[dict[str, Any]]]:
  """Exact original exporter, including source-wall and tile-cut distinction."""
  origin = raw["origin"]
  tile = box(origin[0], origin[2], origin[0] + 512, origin[2] + 512)
  oldnav = [b for b in raw["nav"]["buildings"] if b["sourceId"] == owner]
  if not oldnav:
    raise ValueError("No full old owner " + owner)
  ground = unary_union(
    [
      Polygon(
        [[x + origin[0], z + origin[2]] for x, z in p["ring"]],
        [[[x + origin[0], z + origin[2]] for x, z in h] for h in p["holes"]],
      )
      for p in raw["nav"]["ground"]
    ]
  )
  shape = old.polygonal(source_shape.intersection(tile))
  if native:
    shape = old.native_polygon(shape).intersection(ground)
  oldshape = unary_union(
    [
      Polygon(
        [[x + origin[0], z + origin[2]] for x, z in b["ring"]],
        [[[x + origin[0], z + origin[2]] for x, z in h] for h in b["holes"]],
      )
      for b in oldnav
    ]
  )
  if shape.symmetric_difference(oldshape).area > max(0.02, shape.length * 0.008):
    raise ValueError("Old owner complete footprint changed " + owner)
  mesh = old.PackedMesh(origin[0], origin[2])
  b = oldnav[0]
  low = raw["nav"]["groundY"] + b.get("groundOffset", 0) + b["minHeight"]
  high = raw["nav"]["groundY"] + b.get("groundOffset", 0) + b["height"]
  source_outline = shapely.orient_polygons(
    shape if native else source_shape, exterior_cw=True
  ).boundary
  if not native:
    source_outline = source_outline.intersection(tile)
  mesh.building(shape, low, high, source_outline)
  expected = mesh.payload("city")
  p = np.frombuffer(base64.b64decode(expected["positions"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(expected["indices"]), "<u4").reshape(-1, 3)
  keys = {triangle_key(p[t]) for t in ix}
  retire = []
  proof = []
  for mi, m in enumerate(raw["meshes"]):
    if m["kind"] != "city":
      continue
    pp = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    ii = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    hits = []
    for ti, t in enumerate(ii):
      k = triangle_key(pp[t])
      if k in keys:
        hits.append(ti)
        keys.remove(k)
    if hits:
      retire.append({"mesh": mi, "triangles": hits})
      proof.append(
        {
          "mesh": mi,
          "count": len(hits),
          "indexSha256": hashlib.sha256(np.array(hits, "<u4").tobytes()).hexdigest(),
        }
      )
  if keys:
    raise ValueError(f"Incomplete exact old body {owner}: {len(keys)}")
  ink = []
  for line in (
    []
    if native
    else old.line_parts(shape.boundary.difference(tile.boundary.buffer(0.02)))
  ):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      ink.append(
        np.rint(
          (np.array([[a[0], high + 0.02, a[1]], [b[0], high + 0.02, b[1]]]) - origin)
          * 100
        ).astype(int)
      )
  expected_lines = {triangle_key(p) for p in ink}
  segments = []
  if not native:
    pp = np.frombuffer(base64.b64decode(raw["lines"]["positions"]), "<u2").reshape(
      -1, 2, 3
    )
    for i, p in enumerate(pp):
      key = triangle_key(p)
      if key in expected_lines:
        segments.append(i)
        expected_lines.remove(key)
  if expected_lines:
    raise ValueError("Incomplete exact old roof ink " + owner)
  return oldnav, retire, segments, proof


def native_body(
  mesh: Mesh, parts: list[dict[str, Any]], offset: float, wall: int, roof: int
) -> list[list[float]]:
  """Independent half-metre cardinal columns under the actual measured roofs."""
  step = 0.5
  cells = {}
  for part in parts:
    shape = Polygon(part["ring"], part["holes"])
    tris = [
      [[q[0], q[1] + offset, q[2]] for q in tri]
      for s in part["surfaces"]
      if s["kind"] == "RoofSurface"
      for tri in triangles_for(s["rings"])
    ]
    xmin, zmin, xmax, zmax = shape.bounds
    for z in range(math.floor(zmin / step), math.ceil(zmax / step)):
      for x in range(math.floor(xmin / step), math.ceil(xmax / step)):
        px, pz = (x + 0.5) * step, (z + 0.5) * step
        if not shape.covers(Point(px, pz)):
          continue
        high = roof_at(tris, px, pz)
        if high is None:
          continue
        low = round((part["ground_y_m"] + offset) / step) * step
        high = math.ceil(high / step) * step
        prior = cells.get((x, z))
        cells[(x, z)] = (
          (min(low, prior[0]), max(high, prior[1])) if prior else (low, high)
        )
  caps = []
  for z in sorted({z for x, z in cells}):
    xs = sorted(x for x, zz in cells if zz == z)
    at = 0
    while at < len(xs):
      first = last = xs[at]
      low, high = cells[(first, z)]
      at += 1
      while at < len(xs) and xs[at] == last + 1 and cells[(xs[at], z)] == (low, high):
        last = xs[at]
        at += 1
      x0, x1, z0, z1 = first * step, (last + 1) * step, z * step, (z + 1) * step
      corners = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
      mesh.quad(
        [[x, high, zz] for x, zz in reversed(corners)],
        roof,
        "native-measured-stepped-roof",
      )
      for a, b in zip(corners, corners[1:] + corners[:1]):
        mesh.quad(
          [
            [a[0], high, a[1]],
            [b[0], high, b[1]],
            [b[0], low, b[1]],
            [a[0], low, a[1]],
          ],
          wall,
          "native-measured-wall",
        )
      caps.append([x0, z0, x1, z1, high])
  return caps


def body_plans() -> tuple[dict[str, Any], list[dict[str, Any]]]:
  source = read(SOURCE)
  recipes = {}
  evidence = []
  resolved = pyogrio.read_dataframe(
    GEO / "raw/ring-v182/resolved-outlines.gpkg", layer="buildings"
  )
  shapes = {
    r.sourceId: r.geometry
    for r in resolved.itertuples()
    if r.sourceId in {p["owner"] for p in source["parents"]}
  }
  paths = sorted(
    {packet_path(p["packet"], n) for p in source["parents"] for n in [False, True]}
  )
  pins = guards(paths)
  for parent in source["parents"]:
    for native in [False, True]:
      path = packet_path(parent["packet"], native)
      raw = read(path)
      prepared = pins[str(path)]["prepared"]
      key = ("minecraft:" if native else "drawn:") + parent["packet"]
      r = recipes.setdefault(
        key,
        {
          "raw": raw,
          "prepared": prepared,
          "mesh": Mesh(raw["origin"]),
          "retire": defaultdict(set),
          "retireLines": set(),
          "retireNav": [],
          "appendNav": [],
          "owners": [],
          "lines": [],
        },
      )
      nav, retire, ink, proof = replay_old_body(
        prepared, parent["owner"], shapes[parent["owner"]], native
      )
      r["retireNav"].extend(nav)
      r["owners"].append(parent["owner"])
      r["retireLines"].update(ink)
      for item in retire:
        r["retire"][item["mesh"]].update(item["triangles"])
      parts = parent["parts"]
      offset = (
        raw["nav"]["groundY"]
        + min(b.get("groundOffset", 0) + b["minHeight"] for b in nav)
        - min(p["ground_y_m"] for p in parts)
      )
      wall = 0xD0CABD
      roof = 0x665D58
      if parent["address"].endswith("70"):
        wall = 0xD8D2C6
        roof = 0x67635D
      caps = native_body(r["mesh"], parts, offset, wall, roof) if native else []
      allroof = []
      sheets = 0
      for part in parts:
        rooftris = []
        for surface in part["surfaces"]:
          triangles = triangles_for(surface["rings"])
          sheets += 1
          for tri in triangles:
            moved = [[q[0], q[1] + offset, q[2]] for q in tri]
            if surface["kind"] == "RoofSurface":
              rooftris.append(moved)
              allroof.append(moved)
            if not native:
              r["mesh"].triangle(
                moved,
                roof if surface["kind"] == "RoofSurface" else wall,
                "complete-source-" + surface["kind"],
              )
          if not native and surface["kind"] == "RoofSurface":
            for ring in surface["rings"]:
              for a, b in zip(ring, ring[1:] + ring[:1]):
                r["lines"].extend(
                  [
                    [a[0], a[1] + offset + 0.02, a[2]],
                    [b[0], b[1] + offset + 0.02, b[2]],
                  ]
                )
        localring = [
          [round(x - raw["origin"][0], 4), round(z - raw["origin"][2], 4)]
          for x, z in part["ring"]
        ]
        localholes = [
          [
            [round(x - raw["origin"][0], 4), round(z - raw["origin"][2], 4)]
            for x, z in h
          ]
          for h in part["holes"]
        ]
        record = {
          "ring": localring,
          "holes": localholes,
          "height": round(part["top_y_m"] + offset - raw["nav"]["groundY"], 6),
          "minHeight": round(part["ground_y_m"] + offset - raw["nav"]["groundY"], 6),
          "sourceId": parent["id"],
        }
        if not native:
          record["roofTriangles"] = [
            [
              [
                round(q[0] - raw["origin"][0], 4),
                round(q[1], 6),
                round(q[2] - raw["origin"][2], 4),
              ]
              for q in t
            ]
            for t in rooftris
          ]
        else:
          record["nativeRoofCaps"] = [
            [
              round(a - raw["origin"][0], 4),
              round(b - raw["origin"][2], 4),
              round(c - raw["origin"][0], 4),
              round(d - raw["origin"][2], 4),
              high,
            ]
            for a, b, c, d, high in caps
          ]
        if not native:
          r["appendNav"].append(record)
      if native:
        nativefoot = unary_union([box(a, b, c, d) for a, b, c, d, _ in caps])
        for poly in old.polygons_from_geometry(nativefoot):
          record = {
            "ring": [
              [round(x - raw["origin"][0], 4), round(z - raw["origin"][2], 4)]
              for x, z in poly.exterior.coords
            ],
            "holes": [
              [
                [round(x - raw["origin"][0], 4), round(z - raw["origin"][2], 4)]
                for x, z in h.coords
              ]
              for h in poly.interiors
            ],
            "height": max(c[4] for c in caps) - raw["nav"]["groundY"],
            "minHeight": 0,
            "sourceId": parent["id"],
            "nativeRoofCaps": [
              [
                round(a - raw["origin"][0], 4),
                round(b - raw["origin"][2], 4),
                round(c - raw["origin"][0], 4),
                round(d - raw["origin"][2], 4),
                high,
              ]
              for a, b, c, d, high in caps
            ],
          }
          r["appendNav"].append(record)
      # Drawn frontage follows each measured exterior wall. The 70/72 street
      # count is photographic; remaining garden/back rhythms stay estimates.
      proxy = {
        "origin": raw["origin"],
        "nav": {
          **raw["nav"],
          "buildings": [b for b in r["appendNav"] if b["sourceId"] == parent["id"]],
        },
        "meshes": [r["mesh"].payload()],
      }
      proxy["meshes"][0]["kind"] = "city"
      front.TRIANGLES.pop(id(proxy), None)
      front.NATIVE_PLANES.pop(id(proxy), None)
      number = parent["address"].rsplit(" ", 1)[1]
      profile = {
        "id": "body-" + number,
        "address": parent["address"],
        "owner": parent["id"],
        "packet": parent["packet"],
        "point": list(
          unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
          .representative_point()
          .coords
        )[0],
        "type": "historic",
        "floors": {"70": 2, "71": 5, "72": 4, "74": 5}[number],
        "columns": {"70": 7, "71": 6, "72": 8, "74": 8}[number],
        "windowWidth": 1.1,
        "windowHeight": 1.7,
        "frontOnly": True,
        "reveal": 0xC6C2B5,
      }
      if not native:
        try:
          faces = front.selected_fronts(proxy, profile)
        except ValueError:
          faces = []
        if faces:
          carrier = front.carrier_for(faces)
          for face in faces:
            front.reference_front(
              r["mesh"], face, profile, False, front.source_plane(proxy, face), carrier
            )
      else:
        # Cardinal fittings bind only to actual new native carrier planes.
        drawnproxy = {
          "origin": raw["origin"],
          "nav": {
            **raw["nav"],
            "buildings": [
              {k: v for k, v in b.items() if k != "nativeRoofCaps"}
              for b in proxy["nav"]["buildings"]
            ],
          },
          "meshes": [],
        }
        drawnfaces = front.owner_faces(drawnproxy, parent["id"])
        if drawnfaces:
          carrier = front.carrier_for(drawnfaces)
          for face in front.native_fronts(proxy, profile, drawnfaces):
            front.reference_front(
              r["mesh"], face, profile, True, front.source_plane(proxy, face), carrier
            )
      evidence.append(
        {
          "key": key,
          "oldOwner": parent["owner"],
          "parent": parent["id"],
          "address": parent["address"],
          "completeLeafParts": len(parts),
          "completeSourceSheets": sheets,
          "coverageFraction": parent["coverage"],
          "oldTriangleReceipt": proof,
          "oldRoofInkSegments": ink,
          "fullNativeCaps": len(caps),
          "offsetY": offset,
        }
      )
  plans = {}
  for key, r in recipes.items():
    native = key.startswith("minecraft:")
    path = packet_path(key.split(":", 1)[1], native)
    pin = {k: v for k, v in pins[str(path)].items() if k != "prepared"}
    append = r["mesh"].payload()
    plan = {
      "origin": r["raw"]["origin"],
      **pin,
      "records": source_records(r["raw"]),
      "preparedRecords": source_records(r["prepared"]),
      "append": append,
      "appendFingerprint": front.mesh_fingerprint(append),
      "retire": [
        {"mesh": mi, "triangles": sorted(ts)} for mi, ts in sorted(r["retire"].items())
      ],
      "retireLines": sorted(r["retireLines"]),
      "retireNav": r["retireNav"],
      "appendNav": r["appendNav"],
      "owners": sorted(r["owners"]),
    }
    if r["lines"]:
      positions = np.rint((np.array(r["lines"]) - r["raw"]["origin"]) * 100).astype(
        "<u2"
      )
      plan["appendLines"] = {
        "positionType": "u16cm",
        "positions": base64.b64encode(positions.tobytes()).decode(),
        "colors": base64.b64encode(
          bytes(front.linear(0x56504A)) * len(positions)
        ).decode(),
      }
    for m in [*r["prepared"]["meshes"], append]:
      if m["positionType"] != "u16cm":
        raise ValueError("Nonpacked source")
    vertices = sum(
      len(base64.b64decode(m["positions"])) // 6
      for m in [*r["prepared"]["meshes"], append]
    )
    indices = sum(
      len(base64.b64decode(m["indices"])) // 4
      for m in [*r["prepared"]["meshes"], append]
    )
    if vertices > 400000 or indices > 2400000 or len(r["prepared"]["meshes"]) + 1 > 16:
      raise ValueError("Unchanged packet limit " + key)
    plans[key] = plan
  return plans, evidence


def build() -> dict[str, Any]:
  front.TRIANGLES.clear()
  front.NATIVE_PLANES.clear()
  profiles = read(PROFILES)
  plans, proof = fitting_plans(profiles)
  bodies, bodyproof = body_plans()
  if set(plans) & set(bodies):
    raise ValueError("Body/fitting packet collision; merge required")
  plans.update(bodies)
  result = {"schemaVersion": 1, "keys": sorted(plans), "packets": plans}
  write(DATA, result)
  proof.update(
    {
      "schemaVersion": 1,
      "sourceSha256": sha(SOURCE),
      "profilesSha256": sha(PROFILES),
      "referenceSourceSha256": sha(GEO / "friedrichshain-v303-references.json"),
      "addressSource": {
        "file": "geo_data/regierungsviertel/raw/outer-v159/berlin-260929.osm.pbf",
        "sha256": sha(GEO / "raw/outer-v159/berlin-260929.osm.pbf"),
      },
      "originalResolvedGeometry": {
        "file": "geo_data/regierungsviertel/raw/ring-v182/resolved-outlines.gpkg",
        "sha256": sha(GEO / "raw/ring-v182/resolved-outlines.gpkg"),
      },
      "completeBodies": bodyproof,
      "policy": "Complete original source families, court holes and roof sheets retained. Exact replayed false OSM owner triangles and roof ink yield only after complete admitted same-packet replacement and granular drawn/native navigation. Correct existing bodies remain; source-bound individual facade estimates replace only exact old panes. Every unrelated source, road, ground, water and previous authored detail remains. No photo pixels or new district coverage.",
    }
  )
  write(EVIDENCE, proof)
  return {
    "plans": len(plans),
    "profiles": len(profiles),
    "runtimeBytes": DATA.stat().st_size,
    "evidenceBytes": EVIDENCE.stat().st_size,
    "bodyTransactions": len(bodies),
    "vertices": {
      k: len(base64.b64decode(v["append"]["positions"])) // 6 for k, v in plans.items()
    },
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
