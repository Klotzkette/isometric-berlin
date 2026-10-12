"""Step 10: current Springergebäude, replacing one exact obsolete source owner.

OSM supplies the current footprint, official bDOM the bounded roof evidence.
Kalzip's photographs establish material and broad facade hierarchy; apertures
and panel subdivisions remain estimates. Old LoD2 and packet bytes stay intact.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

import build_alt_mitte_v169 as core
import geopandas as gpd
import numpy as np
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
OWNER = "DEBE01YYK0000Eik"
OSM = "1282540270"
BOUNDS = (-512, -2048, 0, -1536)
WHITE, DARK, GLASS, GREEN = (
  (224, 227, 223),
  (48, 57, 59),
  (103, 133, 145),
  (157, 188, 50),
)


def dump(path: Path, obj: object) -> None:
  """Write a deterministic compact source or runtime receipt."""
  raw = (json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_source() -> tuple[dict, list, dict]:
  """Read only the retained bounded source sheet and named OSM building."""
  records = []
  manifest = json.loads((core.SOURCE / "source-manifest.json").read_bytes())
  for chunk in manifest["chunks"]:
    records.extend(
      json.loads(gzip.decompress((core.SOURCE / chunk["file"]).read_bytes()))[
        "buildings"
      ]
    )
  old = next(r for r in records if r["id"] == OWNER)
  # Same retained PBF records in the existing indexed cache; no large GDAL
  # temporary-node database is needed for a single exact way.
  path = GEO / "raw/outer-v159/candidate.gpkg"
  rows = gpd.read_file(path, layer="multipolygons", where=f"osm_way_id='{OSM}'")
  row = rows[rows["osm_way_id"] == OSM].iloc[0]
  projected = transform(
    Transformer.from_crs(4326, 25833, always_xy=True).transform, row.geometry
  )
  assert len(projected.geoms) == 1, "Named current source must remain complete"
  poly = list(projected.geoms)[0]
  assert not poly.interiors, "Do not drop a newly mapped courtyard"
  ring = [[x - 389500, 5820000 - z] for x, z in list(poly.exterior.coords)[:-1]]
  current = dict(
    id="OSM-way-" + OSM,
    name=row["name"],
    ring=ring,
    holes=[],
    geographicGeometry=row.geometry.__geo_interface__,
    tags={
      "building": row["building"],
      "building:levels": "6",
      "description": old["osmTags"]["description"],
    },
  )
  return old, records, current


def old_models(old: dict, records: list) -> tuple[Detail, Detail, Detail]:
  """Replay the exact existing owner for byte-guarded geometry transfers."""
  appearance = json.loads(
    gzip.decompress((core.SOURCE / "appearance-baseline.json.gz").read_bytes())
  )
  ranks = {}
  for previous in appearance["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          core.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  occupied = unary_union([core.footprint(r) for r in records])
  shell, fronts, _, _ = core.model(old, occupied)
  full = Detail()
  full.triangles = shell.triangles + fronts.triangles
  return shell, fronts, merge_native_faces(native_detail(full))


def drawn_model(current: dict, ground: float, top: float) -> tuple[Detail, list, list]:
  """Extrude the exact current footprint; fit every facade within its wall."""
  poly = orient(Polygon(current["ring"]), sign=-1)
  ring = list(poly.exterior.coords)[:-1]
  original = current["ring"]
  fronts = {
    frozenset((tuple(original[i]), tuple(original[(i + 1) % len(original)]))): i
    for i in range(len(original))
  }
  detail, faces, fittings = Detail(), [], []
  height = top - ground
  pitch = height / 6
  for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
    a, b = np.array(a), np.array(b)
    length = float(np.linalg.norm(b - a))
    d = (b - a) / length
    n = np.array([-d[1], d[0]])
    edge = fronts[frozenset((tuple(a), tuple(b)))]
    is_core = edge in {1, 2, 3, 5, 6, 7}
    front = edge in {2, 6}
    face = dict(
      a=a.tolist(),
      d=d.tolist(),
      normal=n.tolist(),
      length=length,
      osmEdge=edge,
      stairCore=is_core,
      stairFront=front,
    )
    fi = len(faces)
    faces.append(face)
    detail.polygon(
      [
        [*a[:1], ground, a[1]],
        [b[0], ground, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      DARK if is_core else WHITE,
      "current OSM wall",
    )

    def pane(
      u: float,
      y: float,
      w: float,
      h: float,
      color: tuple,
      role: str,
      offset: float = 0.055,
    ) -> None:
      assert 0 <= u - w / 2 and u + w / 2 <= length + 1e-7
      assert ground - 1e-7 <= y - h / 2 and y + h / 2 <= top + 1e-7
      # Facing out: clockwise in wall-local (u,y) gives outward world normal.
      vertices = [
        [float((a + d * q + n * offset)[0]), yy, float((a + d * q + n * offset)[1])]
        for q, yy in [
          (u - w / 2, y - h / 2),
          (u + w / 2, y - h / 2),
          (u + w / 2, y + h / 2),
          (u - w / 2, y + h / 2),
        ]
      ]
      detail.polygon(vertices, color, role)
      fittings.append([fi, u, y, w, h, offset, role, list(color)])

    if is_core and not front:
      continue
    for level in range(6):
      y = ground + (level + 0.53) * pitch
      if front:
        width = min(3.1, length * 0.40)
        if level == 0:
          pane(
            length / 2, ground + 1.5, length - 0.3, 2.8, GREEN, "lime entrance field"
          )
          pane(length / 2, ground + 1.42, 2.55, 2.5, GLASS, "entrance glazing", 0.08)
          pane(length / 2, ground + 1.42, 0.11, 2.5, DARK, "entrance mullion", 0.11)
        else:
          pane(length / 2, y, width, 1.25, GREEN, "lime stair surround")
          pane(length / 2, y, width - 0.20, 1.04, GLASS, "paired stair glazing", 0.085)
          pane(length / 2, y, 0.10, 1.05, GREEN, "paired stair mullion", 0.105)
      else:
        pane(length / 2, y, length - 0.10, 2.08, DARK, "anthracite window ribbon")
        count = max(1, round(length / 1.65))
        bay = (length - 0.30) / count
        for j in range(count):
          pane(
            0.15 + (j + 0.5) * bay,
            y,
            min(1.03, bay - 0.2),
            1.88,
            GLASS,
            "narrow facade glazing",
            0.09,
          )
        # Thin panel joints subdivide the broad photographed white metal bands.
        pane(
          length / 2,
          ground + (level + 0.94) * pitch,
          length - 0.10,
          0.035,
          (188, 194, 192),
          "horizontal metal seam",
          0.06,
        )
    pane(
      length / 2,
      top - 0.09,
      length - 0.08,
      0.12,
      (164, 174, 174),
      "parapet metal coping",
      0.07,
    )
  roof = [[[x, top, z] for x, z in ring]]
  for triangle in core.triangulate(roof):
    detail.polygon(triangle, (108, 118, 119), "current flat roof")
  # Two low PV fields are visible in the official DOP. Their perimeter and
  # module subdivisions are display estimates, not an invented installation plan.
  a, b = np.array(original[11]), np.array(original[10])
  axis = (b - a) / np.linalg.norm(b - a)
  inward = np.array([-axis[1], axis[0]])
  if not poly.covers(Point(*((a + b) / 2 + inward))):
    inward = -inward
  for start, end in [(3.0, 25.0), (30.0, 57.0)]:
    corners = [
      a + axis * u + inward * v
      for u, v in [(start, 2), (end, 2), (end, 8.5), (start, 8.5)]
    ]
    field = Polygon(corners).intersection(poly.buffer(-1.0))
    if field.is_empty:
      continue
    for t in core.triangulate(
      [[[x, top + 0.12, z] for x, z in list(field.exterior.coords)[:-1]]]
    ):
      detail.polygon(t, (49, 69, 83), "DOP reference PV field")
  return detail, faces, fittings


def native_model(current: dict, ground: float, top: float, faces: list) -> Detail:
  """Independent one-metre surface cells, painted by local facade centres."""
  poly = Polygon(current["ring"])
  x0, z0, x1, z1 = poly.bounds
  cells = {}
  nlevels = math.ceil(top - ground)
  pitch = (top - ground) / 6
  for x in range(math.floor(x0), math.ceil(x1)):
    for z in range(math.floor(z0), math.ceil(z1)):
      centre = Point(x + 0.5, z + 0.5)
      if poly.intersection(box(x, z, x + 1, z + 1)).area < 0.05:
        continue
      wall = poly.boundary.distance(centre) < 1.05
      for iy in range(nlevels):
        if not wall and iy != nlevels - 1:
          continue
        color = (91, 105, 111) if iy == nlevels - 1 else WHITE
        if wall:
          face = min(
            faces,
            key=lambda f: (
              abs(
                float((np.array([x + 0.5, z + 0.5]) - f["a"]) @ np.array(f["normal"]))
              )
              + max(
                0, -float((np.array([x + 0.5, z + 0.5]) - f["a"]) @ np.array(f["d"]))
              )
              + max(
                0,
                float((np.array([x + 0.5, z + 0.5]) - f["a"]) @ np.array(f["d"]))
                - f["length"],
              )
            ),
          )
          u = float((np.array([x + 0.5, z + 0.5]) - face["a"]) @ np.array(face["d"]))
          local = (iy + 0.5) / pitch
          level = math.floor(local)
          frac = local - level
          if face["stairCore"]:
            color = DARK
            if face["stairFront"] and abs(u - face["length"] / 2) < 1.8:
              if level == 0 and iy < 3:
                color = GREEN if abs(u - face["length"] / 2) > 1 else GLASS
              elif abs(frac - 0.53) < 0.23:
                color = GREEN if abs(u - face["length"] / 2) > 1 else GLASS
          elif abs(frac - 0.53) < 0.29:
            color = GLASS if int(u * 1.2) % 2 == 0 else DARK
        cells[x, iy, z] = color
  result = Detail()
  for (x, iy, z), color in cells.items():
    y = ground + iy
    for delta, points in [
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
      if tuple(a + b for a, b in zip((x, iy, z), delta, strict=True)) not in cells:
        result.polygon(points, color, "independent native surface")
  return merge_native_faces(result)


def transfers(
  shell: Detail, fronts: Detail, native: Detail, old: dict, source_records: list
) -> tuple[list, list, list]:
  """Fingerprint-guarded exact old triangles/ink, never a spatial deletion."""
  records, originals, line_records = [], [], []
  for mode, which, detail in [
    ("drawn", "shell", shell),
    ("drawn", "front", fronts),
    ("minecraft", "shell", native),
  ]:
    folder = OUT / ("altMitteV169Drawn" if mode == "drawn" else "altMitteV169Native")
    ts = (
      OUT
      / ("altMitteDrawnV169Data.ts" if mode == "drawn" else "altMitteNativeV169Data.ts")
    ).read_text()
    names = dict(
      (int(n), identity)
      for identity, n in re.findall(r'\{id:"([^"]+)",packet:p(\d+)\}', ts)
    )
    if which == "front":
      candidates = [
        (
          p.name.removesuffix(".drawn.json.gz"),
          p,
          json.loads(gzip.decompress(p.read_bytes())),
        )
        for p in sorted(
          (ROOT / "src/app/public/mesh/surrounding-berlin-v159").glob(
            "-1_-4*.drawn.json.gz"
          )
        )
      ]
    else:
      candidates = [
        ("alt-mitte-v169-" + names[int(p.stem[-3:])], p, json.loads(p.read_bytes()))
        for p in sorted(folder.glob("packet-*.json"))
        if names[int(p.stem[-3:])].startswith("-1_-4")
      ]
    remaining_by_origin = {}
    for tile, path, packet in candidates:
      origin = packet["origin"]
      key = tuple(origin)
      if key not in remaining_by_origin:
        wanted = Counter()
        for m in pack_detail(
          core.isometric_shading(detail) if mode == "drawn" else detail,
          BOUNDS,
          origin_y=origin[1],
        ):
          verts = vertices(m)
          inds = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(
            -1, 3
          )
          wanted.update(signature(t) for t in verts[inds])
        remaining_by_origin[key] = wanted
      remaining = remaining_by_origin[key]
      for mesh in packet["meshes"]:
        if mesh["kind"] != "alt-mitte-v169":
          continue
        verts = vertices(mesh)
        inds = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        matches = []
        for i, triangle in enumerate(verts[inds]):
          sig = signature(triangle)
          if remaining[sig]:
            matches.append(i)
            remaining[sig] -= 1
        if matches:
          records.append(
            dict(
              tile=tile,
              kind=mesh["kind"],
              mode=mode,
              fingerprint=fingerprint(
                [mesh["positions"], mesh["colors"], mesh["indices"]]
              ),
              triangles=matches,
              part=OWNER,
              layer=which,
            )
          )
          originals.append(dict(file=str(path.relative_to(ROOT)), sha256=digest(path)))
    assert sum(sum(c.values()) for c in remaining_by_origin.values()) == 0, (
      mode,
      which,
    )
  edges = [
    (a, b)
    for s in old["parts"][0]["surfaces"]
    if s["kind"] in {"WallSurface", "RoofSurface"}
    for r in s["rings"]
    for a, b in zip(r, r[1:] + r[:1], strict=True)
  ]
  neighbour_edges = [
    (a, b)
    for record in source_records
    if record["id"] != OWNER
    for part in record["parts"]
    for s in part["surfaces"]
    if s["kind"] in {"WallSurface", "RoofSurface"}
    for r in s["rings"]
    for a, b in zip(r, r[1:] + r[:1], strict=True)
    if -130 < a[0] < -60 and -1750 < a[2] < -1680
  ]
  for path in sorted((OUT / "altMitteV169Drawn").glob("packet-*.json")):
    packet = json.loads(path.read_bytes())
    if (
      packet["origin"][0] != BOUNDS[0]
      or packet["origin"][2] != BOUNDS[1]
      or "lines" not in packet
    ):
      continue
    origin = np.array(packet["origin"])
    wanted = {
      tuple(
        sorted(tuple(np.rint((np.array(q) - origin) * 100).astype(int)) for q in [a, b])
      )
      for a, b in edges
    }
    # Source ink is globally deduplicated. A shared edge must remain visible
    # for every unchanged neighbouring owner, even after this owner transfers.
    shared = {
      tuple(
        sorted(tuple(np.rint((np.array(q) - origin) * 100).astype(int)) for q in [a, b])
      )
      for a, b in neighbour_edges
    }
    wanted -= shared
    line = packet["lines"]
    values = np.frombuffer(base64.b64decode(line["positions"]), dtype="<u2").reshape(
      -1, 2, 3
    )
    matches = [
      i for i, p in enumerate(values) if tuple(sorted(tuple(q) for q in p)) in wanted
    ]
    if matches:
      ts = (OUT / "altMitteDrawnV169Data.ts").read_text()
      idx = int(path.stem[-3:])
      identity = re.search(r'\{id:"([^"]+)",packet:p' + str(idx) + r"\}", ts)[1]
      line_records.append(
        dict(
          tile="alt-mitte-v169-" + identity,
          mode="drawn",
          fingerprint=fingerprint([line["positions"], line.get("colors", "")]),
          segments=matches,
          part=OWNER,
        )
      )
      originals.append(dict(file=str(path.relative_to(ROOT)), sha256=digest(path)))
  return records, line_records, originals


def build() -> None:
  old, records, current = extract_source()
  evidence = json.loads((GEO / "springer-v215-bdom.json").read_bytes())
  ground = old["groundY"]
  top = round(
    float(np.median([r[2] for r in evidence["samples"][:5]]))
    + old["verticalTransform"]["offsetY"],
    2,
  )
  print("Springer source extracted; current roof", top, flush=True)
  shell, fronts, old_native = old_models(old, records)
  drawn, faces, fittings = drawn_model(current, ground, top)
  native = native_model(current, ground, top, faces)
  transfer, line_records, originals = transfers(shell, fronts, old_native, old, records)
  new_roofs = core.native_roofs(native)
  old_roofs = core.native_roofs(old_native)
  changed = [
    [x, z, old_roofs.get((x, z)), new_roofs.get((x, z))]
    for x, z in sorted(set(old_roofs) | set(new_roofs))
    if old_roofs.get((x, z)) != new_roofs.get((x, z))
  ]
  counts = {}
  for mode, detail in [("Drawn", drawn), ("Minecraft", native)]:
    packet = empty_packet("springer-current-v215", BOUNDS)
    packet["meshes"] = pack_detail(
      core.isometric_shading(detail) if mode == "Drawn" else detail, BOUNDS
    )
    dump(OUT / f"springerV215{mode}.json", packet)
    counts[mode.lower() + "Triangles"] = len(detail.triangles)
    counts[mode.lower() + "Meshes"] = len(packet["meshes"])
    # Decoder uses one six-u16 position/colour interleaved buffer and an
    # exact U16 index when the merged packet has fewer than 65,536 vertices.
    vertices_count = sum(
      len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"]
    )
    indices_count = sum(
      len(base64.b64decode(m["indices"])) // 4 for m in packet["meshes"]
    )
    counts[mode.lower() + "GpuBytes"] = vertices_count * 12 + indices_count * (
      2 if vertices_count <= 65535 else 4
    )
  counts["transferredTriangles"] = sum(len(r["triangles"]) for r in transfer)
  counts["transferredLines"] = sum(len(r["segments"]) for r in line_records)
  nav = dict(
    owner=OWNER,
    currentOwner=current["id"],
    ring=current["ring"],
    holes=[],
    groundY=ground,
    roofY=top,
    oldRing=old["footprintPolygons"][0]["ring"],
    oldRoofY=old["parts"][0]["topY"],
    nativeChangedRoofCells=changed,
    roofTriangles=[
      t
      for t, _, role in drawn.triangles
      if role in {"current flat roof", "DOP reference PV field"}
    ],
  )
  dump(OUT / "springerV215Navigation.json", nav)
  dump(
    OUT / "springerV215Ownership.json",
    dict(owner=OWNER, records=transfer, lineRecords=line_records),
  )
  source = dict(
    schemaVersion=1,
    oldSource=old,
    currentSource=current,
    bdom=evidence,
    faces=faces,
    fittings=fittings,
    originalPackets=originals,
    counts=counts,
    retainedInputs={
      str(p.relative_to(ROOT)): digest(p)
      for p in [
        core.SOURCE / "source-389_5821-00.json.gz",
        OUT / "altMitteV169Ownership.json",
        ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json",
      ]
    },
    references=[
      dict(
        url="https://www.kalzip.com/news/baustelle-der-woche-springergebaeude-bundeswehrkrankenhaus-berlin/",
        photo="https://www.kalzip.com/wp-content/uploads/2025/02/YDRAY-20241104_091742-scaled-3.jpeg",
        credit="Kalzip GmbH; photographer not stated",
        licence="Copyright; reference-only, no image distributed",
        accessed="2026-10-12",
      ),
      dict(
        url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
        credit="Geoportal Berlin",
        licence="dl-de/zero-2-0",
        use="Roof/PV visual check; no raster distributed",
      ),
    ],
    conflict="The LoD2 outline is dated 2017-10-11 and describes the predecessor. The current named OSM outline and Kalzip 2024 construction photograph agree on the two wider stair cores. Only that obsolete exact owner is transferred; its complete raw record, earlier generic facade triangles and source packets remain immutable.",
    estimates="Six levels are OSM-tagged. Facade window counts/spacing, cladding joints, colours and PV field boundaries are reference-based estimates. The roof level uses median five official bDOM upper-roof samples with the retained vertical datum; it is not a new parapet survey.",
  )
  path = GEO / "springer-v215-source.json.gz"
  dump(path, source)
  dump(
    OUT / "springerV215Profile.json",
    dict(
      owner=OWNER,
      currentOwner=current["id"],
      anchor=[
        Polygon(current["ring"]).centroid.x,
        ground,
        Polygon(current["ring"]).centroid.y,
      ],
      counts=counts,
      sourceSha256=digest(path),
      roofY=top,
      fullMobileIdentical=True,
    ),
  )
  print(counts, flush=True)


if __name__ == "__main__":
  build()
