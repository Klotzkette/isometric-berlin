"""Step 10: four individually referenced Jägerstraße fronts on retained bodies.

Only original estimated street-window fittings yield. Complete measured bodies,
roof sheets and linework stay untouched. Native fittings follow admitted actual
cardinal faces of the retained independent Alt-Mitte construction.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_alt_mitte_v169 import APPEARANCE, facade, footprint, model
from build_concert_halls_v160 import normal_of
from build_district_facades_v188 import FacadeMesh, linear
from build_karl_marx_allee_v161 import Detail, native_detail
from build_scheunenviertel_v168 import merge_native_faces

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PLAN = DATA / "moabitMitteV300.json"
EVIDENCE = GEO / "moabit-mitte-v300-stream-evidence.json.gz"
KIND = "moabit-mitte-v300"
TARGETS = {
  "DEBE01YYK00003dj": dict(
    address="Jägerstraße 27",
    axes=7,
    rows=6,
    heights=[2.1, 6.5, 11.2, 15.5, 20.1, 24.4],
    style="historic-modern-addition",
  ),
  "DEBE01YYK00004wE": dict(
    address="Jägerstraße 28",
    axes=3,
    rows=5,
    heights=[2.2, 6.7, 11.5, 16.2, 21.1],
    style="neo-baroque-oriel",
  ),
  "DEBE01YYK00002a7": dict(
    address="Jägerstraße 29–31",
    axes=6,
    rows=3,
    heights=[2.1, 6.7, 11.4],
    style="low-classic-front",
  ),
  "DEBE01YYK00004BA": dict(
    address="Jägerstraße 32",
    axes=7,
    rows=5,
    heights=[2.2, 7.3, 12.4, 17.5, 22.5],
    style="stone-pier-commercial",
  ),
}
WIKI = "https://commons.wikimedia.org/wiki/File:"
REFERENCES = [
  dict(
    address="Jägerstraße 27",
    url=WIKI + "Berlin,_Mitte,_Jägerstraße_27,_Geschäfts-_und_Wohnhaus.jpg",
    image="https://upload.wikimedia.org/wikipedia/commons/8/8d/Berlin,_Mitte,_J%C3%A4gerstra%C3%9Fe_27,_Gesch%C3%A4fts-_und_Wohnhaus.jpg",
    credit="Jörg Zägel",
    date="2009-07-26",
    licence="CC BY-SA 3.0",
    licenceUrl="https://creativecommons.org/licenses/by-sa/3.0/",
    inspectedImageSha256="ce5a367a2ee6f307ad93d94547af8591027aa76553cb55b55e596776d105a912",
    use="Seven street axes, two historic upper levels and distinct modern upper addition; not a current tenant or paint survey.",
  ),
  dict(
    address="Jägerstraße 28",
    url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030034",
    image="https://denkmaldatenbank.berlin.de/media/uploads/Mit/02/09030034a.jpg",
    credit="Landesdenkmalamt Berlin archive",
    date="1999 (embedded LDA watermark)",
    licence="Reference only; no redistribution licence asserted",
    inspectedImageSha256="84212549418e11a050fdadf0a2e552267e7d576c2b85e82261c7513b8b50bb0b",
    use="Three broad lower groups, paired upper arched lights, central projecting oriel, stone bands and balconet; dimensions estimated.",
  ),
  dict(
    address="Jägerstraße 29–31",
    url=WIKI + "Berlin,_Mitte,_Jägerstraße_29-31,_Wohnhaus_01.jpg",
    image="https://upload.wikimedia.org/wikipedia/commons/6/6b/Berlin,_Mitte,_J%C3%A4gerstra%C3%9Fe_29-31,_Wohnhaus_01.jpg",
    credit="Jörg Zägel",
    date="2009-07-26",
    licence="CC BY-SA 3.0",
    licenceUrl="https://creativecommons.org/licenses/by-sa/3.0/",
    inspectedImageSha256="f450db5673f3f6c1ac4ee4051200be93c6cc25a3bd65fc42cdd69d1082e5b7f1",
    use="Six axes and three principal storeys, pale sash frames and narrow belt courses; retained measured roof unchanged.",
  ),
  dict(
    address="Jägerstraße 32",
    url=WIKI + "Berlin,_Mitte,_Jägerstraße_32,_Geschäftshaus_01.jpg",
    image="https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Berlin%2C_Mitte%2C_J%C3%A4gerstra%C3%9Fe_32%2C_Gesch%C3%A4ftshaus_01.jpg/960px-Berlin%2C_Mitte%2C_J%C3%A4gerstra%C3%9Fe_32%2C_Gesch%C3%A4ftshaus_01.jpg",
    credit="Jörg Zägel",
    date="2009-07-26",
    licence="CC BY-SA 3.0",
    licenceUrl="https://creativecommons.org/licenses/by-sa/3.0/",
    inspectedImageSha256="c481cd5bc3503e4d1e4086dec3190157bacddd58836fd3a634b092924f39a47c",
    use="Seven major axes, five principal levels, narrow stone piers with fluting and broad glazing; no historic tenant claim.",
  ),
]


def read(path: Path) -> Any:
  """Read a retained source without changing it."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  """Write only this pass's finite draft/evidence."""
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Immutable source byte receipt."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def fingerprint(texts: list[str]) -> int:
  """Exact runtime FNV-1a over ASCII packed fields / JS JSON navigation."""
  value = 2166136261
  for text in texts:
    for byte in text.encode("utf-8"):
      value = ((value ^ byte) * 16777619) & 0xFFFFFFFF
  return value


def key(triangle: Any) -> tuple:
  """Orientation-independent exact centimetre triangle receipt."""
  return tuple(sorted(tuple(map(int, p)) for p in np.rint(np.asarray(triangle) * 100)))


def decoded(packet: dict) -> list[tuple[np.ndarray, np.ndarray]]:
  """Decode exact current immutable packed arrays offline."""
  result = []
  for mesh in packet["meshes"]:
    ps = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    result.append((ps.astype(float) / 100 + packet["origin"], ix))
  return result


def public_faces(record: dict, occupied: Any, roads: Any) -> list[dict]:
  """Select actual open street walls, including short mapped bay facets."""
  result = []
  for part in record["parts"]:
    for surface in part["surfaces"]:
      if surface["kind"] != "WallSurface":
        continue
      n = normal_of(surface["rings"][0])
      if not np.isfinite(n).all() or abs(n[1]) > 0.03 or n[2] > -0.8:
        continue
      q = np.asarray(surface["rings"][0])
      center = q.mean(axis=0)
      point = Point(center[0], center[2])
      near = nearest_points(point, roads)[1]
      toward = np.array([near.x - center[0], 0, near.y - center[2]])
      distance = float(np.linalg.norm(toward))
      if distance < 0.1 or distance > 24 or np.dot(toward, n) / distance < 0.85:
        continue
      ray = LineString([center[[0, 2]] + n[[0, 2]] * 0.3, [near.x, near.y]])
      if occupied.intersection(ray).length > 0.6:
        continue
      result.append(
        dict(
          part=part["id"],
          rings=surface["rings"],
          normal=n.tolist(),
          low=float(q[:, 1].min()),
          high=float(q[:, 1].max()),
          ground=part["groundY"],
          top=part["topY"],
        )
      )
  return result


def projected(face: dict, tangent: np.ndarray) -> Any:
  """Exact wall polygon in common street-axis/elevation coordinates."""
  rings = [[(float(np.dot(p, tangent)), p[1]) for p in ring] for ring in face["rings"]]
  return shapely.make_valid(Polygon(rings[0], rings[1:]))


class Front:
  """Original narrow fittings projected onto retained source wall sheets."""

  def __init__(
    self, faces: list[dict], native: bool, normal: np.ndarray, tangent: np.ndarray
  ) -> None:
    self.faces = [(f, projected(f, tangent)) for f in faces]
    self.native = native
    self.normal = normal
    self.tangent = tangent
    self.detail = Detail()
    self.roles: Counter = Counter()

  def emit(self, polygon: Any, rgb: tuple, role: str, out: float = 0.13) -> None:
    """Clip every glazing/moulding fragment inside its exact measured wall."""
    if polygon.is_empty:
      return
    for face, wall in self.faces:
      clipped = polygon.intersection(wall)
      if clipped.is_empty or clipped.area < 0.0002:
        continue
      n = np.asarray(face["normal"])
      anchor = np.asarray(face["rings"][0][0])
      denominator = float(np.dot(n, self.normal))
      if denominator < 0.4:
        continue
      for tri in shapely.constrained_delaunay_triangles(clipped).geoms:
        points = []
        for u, y in list(tri.exterior.coords)[:3]:
          q = self.tangent * u + np.array([0, y, 0])
          q += self.normal * (float(np.dot(n, anchor - q)) / denominator)
          # Native offset is along its cardinal face normal, not the diagonal
          # street direction. Thus every native triangle stays orthogonal.
          q += (n if self.native else self.normal) * out
          points.append(q.tolist())
        self.detail.polygon(points, rgb, role)
        self.roles[role] += 1

  def band(
    self,
    u: float,
    y: float,
    w: float,
    h: float,
    rgb: tuple,
    role: str,
    out: float = 0.16,
  ) -> None:
    self.emit(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2), rgb, role, out)

  def window(
    self,
    u: float,
    y: float,
    w: float,
    h: float,
    arch: bool,
    stone: tuple,
    out: float = 0.12,
  ) -> None:
    """Split glazing, complete arch/reveal, transom and sill; no new shell."""
    if arch:
      spring = y + h * 0.23
      radius = h * 0.27
      profile = Polygon(
        [(u - w / 2, y - h / 2), (u + w / 2, y - h / 2), (u + w / 2, spring)]
        + [
          (u + math.cos(a) * w / 2, spring + math.sin(a) * radius)
          for a in np.linspace(0, math.pi, 13)
        ]
        + [(u - w / 2, spring)]
      )
    else:
      profile = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    self.emit(profile, (77, 101, 109), "individual-window-glazing", out)
    self.emit(
      profile.buffer(0.115, join_style=2).difference(profile),
      stone,
      "complete-window-reveal",
      out + 0.065,
    )
    self.band(u, y, w * 0.045, h, stone, "sash-mullion", out + 0.08)
    self.emit(
      profile.intersection(box(u - w, y + h * 0.2, u + w, y + h * 0.2 + 0.065)),
      stone,
      "sash-transom",
      out + 0.085,
    )
    self.band(
      u, y - h / 2 - 0.14, w + 0.38, 0.16, stone, "projecting-stone-sill", out + 0.11
    )


def recognition(
  faces: list[dict],
  spec: dict,
  native: bool,
  normal: np.ndarray,
  tangent: np.ndarray,
  span: tuple[float, float],
  ground: float,
) -> tuple[Detail, dict]:
  """House-specific photo compositions; metric wall clips remain authoritative."""
  front = Front(faces, native, normal, tangent)
  u0, u1 = span
  length = u1 - u0
  stone = (218, 207, 184)
  frame = (203, 207, 193)
  if spec["style"] == "low-classic-front":
    stone = (234, 225, 199)
  for row, elevation in enumerate(spec["heights"]):
    columns = 6 if spec["style"] == "neo-baroque-oriel" and row == 4 else spec["axes"]
    pitch = length / columns
    for col in range(columns):
      u = u0 + (col + 0.5) * pitch
      w = min(pitch * 0.66, 2.55 if spec["style"] == "stone-pier-commercial" else 2.2)
      h = 3.5 if spec["rows"] in {5, 6} else 3.4
      if row == 0:
        h = 3.6
      if spec["style"] == "neo-baroque-oriel" and row == 4:
        h = 2.6
        w = pitch * 0.68
      arch = (spec["style"] == "neo-baroque-oriel" and row > 0) or (
        spec["style"] == "historic-modern-addition" and row in {1, 2}
      )
      out = 0.13
      if (
        spec["style"] == "neo-baroque-oriel"
        and columns == 3
        and col == 1
        and row in {2, 3}
      ):
        out = 0.48
      front.window(
        u,
        ground + elevation,
        w,
        h,
        arch,
        frame if spec["style"] == "historic-modern-addition" and row > 2 else stone,
        out,
      )
      if spec["style"] == "stone-pier-commercial":
        for delta in [-w / 3, w / 3]:
          front.band(
            u + delta,
            ground + elevation,
            0.045,
            h,
            frame,
            "three-light-steel-division",
            0.22,
          )
      if spec["style"] == "neo-baroque-oriel" and row in {2, 3}:
        front.band(
          u,
          ground + elevation - h / 2 + 0.3,
          w + 0.14,
          0.065,
          (83, 84, 75),
          "balconet-top-rail",
          0.60 if col == 1 else 0.25,
        )
        for delta in np.linspace(-w * 0.4, w * 0.4, 7):
          front.band(
            u + delta,
            ground + elevation - h / 2 + 0.1,
            0.045,
            0.45,
            (83, 84, 75),
            "balconet-upright",
            0.60 if col == 1 else 0.25,
          )
  # Narrow stone bands and piers preserve the source wall paint between them.
  courses = [ground + 0.55, ground + 4.6, ground + 9.1, ground + 13.8]
  if spec["style"] == "neo-baroque-oriel":
    courses += [ground + 18.8, ground + 23.2]
  if spec["style"] == "stone-pier-commercial":
    courses = [ground + 4.5, ground + 20.3, ground + 24.5]
  if spec["style"] == "historic-modern-addition":
    courses = [ground + 4.5, ground + 9.2, ground + 13.8, ground + 23.4]
  for y in courses:
    front.band((u0 + u1) / 2, y, length, 0.17, stone, "house-belt-cornice", 0.25)
  if spec["style"] == "stone-pier-commercial":
    for k in range(1, spec["axes"]):
      u = u0 + k * length / spec["axes"]
      front.band(u, ground + 12, 0.46, 15.5, stone, "continuous-stone-pilaster", 0.24)
      for off in [-0.12, 0, 0.12]:
        front.band(
          u + off, ground + 12, 0.035, 14.8, (178, 166, 141), "pilaster-fluting", 0.265
        )
  if spec["style"] == "historic-modern-addition":
    for y in np.arange(ground + 0.8, ground + 9, 0.65):
      front.band(
        (u0 + u1) / 2,
        float(y),
        length,
        0.035,
        (170, 159, 137),
        "historic-base-rustication",
        0.19,
      )
  return front.detail, dict(
    roles=dict(front.roles),
    native=native,
    sourceWallFacets=len(faces),
    nominalPublicAxes=spec["axes"],
    principalStoreys=spec["rows"],
  )


def packed_key(triangle: Any, origin: list) -> tuple:
  """Replay the original packer's local quantisation, including half cents."""
  return tuple(
    sorted(
      tuple(round((p[i] - origin[i]) * 100) + round(origin[i] * 100) for i in range(3))
      for p in triangle
    )
  )


def build() -> None:
  """Compile drafts only; publication/integration remains with root."""
  records = []
  hashes = {}
  source_manifest = read(GEO / "alt-mitte-v169/source-manifest.json")
  for path in [
    GEO / "alt-mitte-v169" / entry["file"] for entry in source_manifest["chunks"]
  ]:
    source = read(path)
    records.extend(source["buildings"])
    if any(b["id"] in TARGETS for b in source["buildings"]):
      hashes[str(path.relative_to(ROOT))] = sha(path)
  occupied = unary_union([footprint(b) for b in records])
  shapely.prepare(occupied)
  appearance_path = GEO / "alt-mitte-v169/appearance-baseline.json.gz"
  ranks = {}
  APPEARANCE.clear()
  hashes[str(appearance_path.relative_to(ROOT))] = sha(appearance_path)
  for previous in read(appearance_path)["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  roads = unary_union(
    [
      shape(r["geometry"])
      for r in read(GEO / "alt-mitte-edges-v186-streets.json")["roads"]
      if r["name"] == "Jägerstraße"
    ]
  )
  drawn = read(OUT / "3_1.drawn.json.gz")
  native = read(OUT / "3_1.minecraft.json.gz")
  original = [defaultdict(list) for _ in drawn["meshes"]]
  for mi, (ps, ix) in enumerate(decoded(drawn)):
    for ti, tri in enumerate(ps[ix]):
      original[mi][key(tri)].append(ti)
  raw_native = []
  metadata = read(DATA / "altMitteNativeV169Source.json")
  for entry in metadata["chunkFiles"]:
    if entry["id"].startswith("3_1-"):
      path = DATA / entry["file"]
      p = read(path)
      hashes[str(path.relative_to(ROOT))] = sha(path)
      for ps, ix in decoded(p):
        raw_native.extend(ps[ix].tolist())
  native_keys = Counter(key(t) for t in raw_native)
  result = {"drawn": Detail(), "minecraft": Detail()}
  retire = defaultdict(set)
  evidence = []
  for record in records:
    owner = record["id"]
    if owner not in TARGETS:
      continue
    spec = TARGETS[owner]
    faces = public_faces(record, occupied, roads)
    if not faces:
      raise ValueError("No admitted street wall: " + owner)
    normal = np.array([-0.276, 0, -0.961])
    normal /= np.linalg.norm(normal)
    tangent = np.array([-normal[2], 0, normal[0]])
    spans = [projected(f, tangent).bounds for f in faces]
    span = (min(b[0] for b in spans), max(b[2] for b in spans))
    ground = record["groundY"]
    expected = []
    for f in faces:
      expected.extend(facade(f["rings"], f["ground"], f["top"], occupied).triangles)
    matches = defaultdict(set)
    for triangle, _, _ in expected:
      hits = [
        (mi, ti)
        for mi, lookup in enumerate(original)
        for ti in lookup.get(packed_key(triangle, drawn["origin"]), [])
        if drawn["meshes"][mi]["kind"] == "alt-mitte-v169"
      ]
      if len(hits) != 1:
        raise ValueError(f"Unproven fitting triangle {owner}: {len(hits)}")
      mi, ti = hits[0]
      matches[mi].add(ti)
    for mi, indices in matches.items():
      retire[mi].update(indices)
    new, info = recognition(faces, spec, False, normal, tangent, span, ground)
    result["drawn"].triangles.extend(new.triangles)
    # Regenerate this exact parent with its independent source grid. Match each
    # selected cardinal sheet against the actually retained resident packet.
    shells, fronts, _, _ = model(record, occupied)
    full = Detail()
    full.triangles = shells.triangles + fronts.triangles
    native_parent = merge_native_faces(native_detail(full))
    nfaces = []
    corridor = unary_union(
      [LineString([(p[0], p[2]) for p in f["rings"][0]]).buffer(2.2) for f in faces]
    )
    for triangle, _, _ in native_parent.triangles:
      q = np.asarray(triangle)
      n = normal_of(triangle)
      if not np.isfinite(n).all() or abs(n[1]) > 0.001 or np.dot(n, normal) < 0.7:
        continue
      center = q.mean(axis=0)
      if not corridor.covers(Point(center[0], center[2])):
        continue
      if native_keys[key(triangle)] != 1:
        raise ValueError("Unproven/ambiguous resident cardinal sheet " + owner)
      nfaces.append(dict(rings=[triangle], normal=n.tolist()))
    if not nfaces:
      raise ValueError("No exact native street sheets " + owner)
    new, ninfo = recognition(nfaces, spec, True, normal, tangent, span, ground)
    result["minecraft"].triangles.extend(new.triangles)
    evidence.append(
      dict(
        owner=owner,
        **spec,
        sourceFaces=faces,
        axisNormal=normal.tolist(),
        axisTangent=tangent.tolist(),
        span=span,
        retiredGenericTriangles=sum(len(v) for v in matches.values()),
        drawn=info,
        minecraft=ninfo,
        nativeMatchedTriangles=[key(f["rings"][0]) for f in nfaces],
        estimateBoundary="Photographic composition; aperture, moulding and projection dimensions are display estimates. Full original wall/roof geometry remains.",
      )
    )
  packets = {}
  for mode, packet in [("drawn", drawn), ("minecraft", native)]:
    mesh = FacadeMesh(packet["origin"])
    for triangle, rgb, _ in result[mode].triangles:
      points = [
        np.rint((np.asarray(p) - mesh.origin) * 100).astype(int).tolist()
        for p in triangle
      ]
      cross = np.cross(
        np.subtract(points[1], points[0]), np.subtract(points[2], points[0])
      )
      if not np.any(cross):
        continue
      start = len(mesh.positions)
      for q in points:
        if min(q) < 0 or max(q) > 65535:
          raise ValueError("Fitting escaped its exact packet")
        mesh.positions.append(q)
        mesh.colours.append(linear(rgb))
      mesh.indices.extend([start, start + 1, start + 2])
    append = mesh.payload()["meshes"][0]
    append["kind"] = KIND
    lines = packet.get("lines")
    packets[mode + ":3_1"] = dict(
      origin=packet["origin"],
      navGuard=fingerprint(
        [json.dumps(packet["nav"], ensure_ascii=False, separators=(",", ":"))]
      ),
      records=[
        dict(
          mesh=i,
          kind=m["kind"],
          fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
        )
        for i, m in enumerate(packet["meshes"])
      ],
      lineGuard=fingerprint([lines["positions"], lines.get("colors", "")])
      if lines
      else None,
      append=append,
      appendFingerprint=fingerprint(
        [append["positions"], append["colors"], append["indices"]]
      ),
      retire=[
        dict(mesh=mi, triangles=sorted(indices))
        for mi, indices in sorted(retire.items())
      ]
      if mode == "drawn"
      else [],
      owners=list(TARGETS),
    )
  write(PLAN, dict(schemaVersion=1, keys=list(packets), packets=packets))
  for mode in ["drawn", "minecraft"]:
    hashes[str((OUT / f"3_1.{mode}.json.gz").relative_to(ROOT))] = sha(
      OUT / f"3_1.{mode}.json.gz"
    )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=__doc__,
      sourceHashes=hashes,
      fronts=evidence,
      references=REFERENCES,
      packedTriangleCounts={
        mode: len(base64.b64decode(packets[mode + ":3_1"]["append"]["indices"])) // 12
        for mode in result
      },
      omissions=[
        "Charlottenstraße 75/76 is modern Checkpoint Plaza, not LDA 09030023; no false common historic facade added.",
        "Charlottenstraße 77 has distinct LDA 09030025 / Roter Adler identity; no unverified facade grid substituted.",
        "Torstraße 58–72 retains existing v239/v244 fittings; no duplicate unverified window grid added.",
      ],
      bodyAndRoofRetiredTriangles=0,
      navigationChanged=False,
      touchDetail="identical full geometry",
      newDescriptors=0,
    ),
  )
  print(
    json.dumps(
      dict(
        fronts=len(evidence),
        planBytes=PLAN.stat().st_size,
        triangles={
          m: len(base64.b64decode(packets[m + ":3_1"]["append"]["indices"])) // 12
          for m in result
        },
        retired=sum(len(v) for v in retire.values()),
      )
    )
  )


if __name__ == "__main__":
  build()
