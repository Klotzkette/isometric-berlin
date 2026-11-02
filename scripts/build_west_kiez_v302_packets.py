"""Step 10: bounded exact-owner West Kiez facade append/retire receipts."""

from __future__ import annotations

import base64
import json
import math
import sys
from collections import defaultdict

import numpy as np
from shapely import LineString, Point, Polygon, box
from shapely.affinity import translate
from shapely.geometry import shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base
from scripts.build_west_kiez_v302 import DATA, GEO, ROOT, addresses, digest, read, write

OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RUNTIME = DATA / "westKiezV302.json"
EVIDENCE = GEO / "west-kiez-v302-packets-evidence.json.gz"
KIND = "west-kiez-v302"
SOUTH_ADDRESSES = {
  "Akazienstraße": ["12", "14", "15", "17", "30"],
  "Goltzstraße": ["32"],
  "Crellestraße": ["5", "8", "9", "15", "16", "36"],
  "Landshuter Straße": ["15"],
  "Hauptstraße": ["146"],
  "Stuttgarter Platz": ["16", "19"],
}
LDA = "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr="
REFERENCES = {
  "Akazienstraße 12": LDA + "09066354",
  "Akazienstraße 14": LDA + "09066355",
  "Akazienstraße 15": LDA + "09066356",
  "Akazienstraße 17": LDA + "09066357",
  "Akazienstraße 30": LDA + "09066358",
  "Goltzstraße 32": "https://bildhauerei-in-berlin.de/bildwerk/mietshaus-hohenstaufenstrasse-goltzstrasse-10465/",
  "Crellestraße 5": LDA + "09066423",
  "Crellestraße 8": LDA + "09066424",
  "Crellestraße 9": LDA + "09066425",
  "Crellestraße 15": LDA + "09066426",
  "Crellestraße 16": LDA + "09066427",
  "Crellestraße 36": LDA + "09066428",
  "Landshuter Straße 15": LDA + "09066609",
  # This ordinary house has a mapped address/body, but no individually
  # documented historic ornament. Its fittings remain explicitly neutral.
  "Hauptstraße 146": "https://www.openstreetmap.org/",
  "Stuttgarter Platz 16": LDA + "09096452",
  "Stuttgarter Platz 19": LDA + "09096453",
}


def fingerprint(parts):
  value = 2166136261
  for text in parts:
    for byte in text.encode("ascii"):
      value = ((value ^ byte) * 16777619) & 0xFFFFFFFF
  return value


class Mesh(base.FacadeMesh):
  """Offline small full boxes with exact packet-size allocation at runtime."""

  def member(self, a, direction, normal, u, y, out, w, h, depth, rgb):
    xz = a + direction * u + normal * out

    def p(x, v, z):
      return [
        xz[0] + direction[0] * x + normal[0] * z,
        y + v,
        xz[1] + direction[1] * x + normal[1] * z,
      ]

    w, h, depth = w / 2, h / 2, depth / 2
    for face in [
      [(-w, -h, -depth), (w, -h, -depth), (w, h, -depth), (-w, h, -depth)],
      [(w, -h, depth), (-w, -h, depth), (-w, h, depth), (w, h, depth)],
      [(-w, -h, depth), (-w, -h, -depth), (-w, h, -depth), (-w, h, depth)],
      [(w, -h, -depth), (w, -h, depth), (w, h, depth), (w, h, -depth)],
      [(-w, h, -depth), (w, h, -depth), (w, h, depth), (-w, h, depth)],
      [(-w, -h, depth), (w, -h, depth), (w, -h, -depth), (-w, -h, -depth)],
    ]:
      self.quad([p(*q) for q in face], rgb)


def original_triangles(packet):
  result = []
  for part in packet["meshes"]:
    p = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    result.append(
      (
        p,
        ix,
        {tuple(sorted(tuple(map(int, q)) for q in p[t])): i for i, t in enumerate(ix)},
      )
    )
  return result


def generic_front_triangles(packet, faces, native):
  """Replay old exact pane coordinates; no body triangle can qualify."""
  old = base.FacadeMesh(packet["origin"])
  for face in faces:
    for f in face.get("nativeSpans", []) if native else [face]:
      base.window_grid(old, dict(f), native)
  expected = {
    tuple(sorted(tuple(q) for q in [old.positions[i] for i in t]))
    for t in np.array(old.indices).reshape(-1, 3)
  }
  retired = []
  for i, (part, (positions, indices, lookup)) in enumerate(
    zip(packet["meshes"], original_triangles(packet))
  ):
    if part["kind"] != "district-facades-v188":
      continue
    hits = sorted(lookup[key] for key in expected if key in lookup)
    if hits:
      retired.append(dict(mesh=i, triangles=hits))
  return retired


def native_fronts(face, packet):
  """Use actual short cardinal source-wall facets, including formerly blank ones."""
  ox, oy, oz = packet["origin"]
  corridor = LineString([face["a"], face["b"]]).buffer(1.6, cap_style=2)
  triangles = set()
  for part, (p, ix, _) in zip(packet["meshes"], original_triangles(packet)):
    if part["kind"] == "city":
      triangles.update(tuple(sorted(tuple(map(int, q)) for q in p[t])) for t in ix)
  result = []
  for building in packet["nav"]["buildings"]:
    if building["sourceId"] != face["owner"]:
      continue
    low = (
      packet["nav"]["groundY"] + building["minHeight"] + building.get("groundOffset", 0)
    )
    high = (
      packet["nav"]["groundY"] + building["height"] + building.get("groundOffset", 0)
    )
    polygon = translate(Polygon(building["ring"], building["holes"]), ox, oz)
    for a, b in zip(building["ring"], building["ring"][1:] + building["ring"][:1]):
      if a[0] != b[0] and a[1] != b[1]:
        continue
      if not base.source_wall_exists(triangles, a, b, low - oy, high - oy):
        continue
      clipped = LineString(
        [np.array(a) + [ox, oz], np.array(b) + [ox, oz]]
      ).intersection(corridor)
      if clipped.geom_type != "LineString" or clipped.length < 1.3:
        continue
      wa, wb = np.array(clipped.coords[0]), np.array(clipped.coords[-1])
      direction = (wb - wa) / clipped.length
      normal = np.array([-direction[1], direction[0]])
      if np.dot(normal, face["normal"]) < 0:
        normal = -normal
      if np.dot(normal, face["normal"]) < 0.6 or polygon.covers(
        Point(*(wa + wb) / 2 + normal * 0.2)
      ):
        continue
      result.append(
        dict(
          face, a=wa.tolist(), b=wb.tolist(), normal=normal.tolist(), low=low, high=high
        )
      )
  return result


def recognition_front(mesh, face, native=False, style="goltz-glazed-brick", axes=None):
  a, b = np.array(face["a"]), np.array(face["b"])
  length = math.dist(a, b)
  direction = (b - a) / length
  normal = np.array(face["normal"])
  low, high = face["low"], face["high"]
  # Goltz32 is documented as five storeys with seven and five main axes.
  # Short cardinal facets subdivide independently inside their actual width.
  floors = (
    5
    if style in {"goltz-glazed-brick", "akazien-reform", "landshuter-renaissance"}
    else max(2, min(5, round((high - low - 1) / 4.3)))
  )
  columns = axes or max(1, round(length / (3.2 if native else 4.0)))
  glass, stone, dark = (75, 98, 104), (226, 222, 202), (71, 72, 65)
  if style == "early-crelle":
    stone = (209, 204, 190)
  pitch = (high - low - 0.6) / floors
  width = min(1.65, length / columns * 0.62)
  for row in range(floors):
    y = low + 1.6 + row * pitch
    height = min(2.5, pitch * 0.64)
    for column in range(columns):
      u = (column + 0.5) * length / columns
      mesh.member(a, direction, normal, u, y, 0.12, width, height, 0.035, glass)
      for sign in [-1, 1]:
        mesh.member(
          a,
          direction,
          normal,
          u + sign * (width + 0.11) / 2,
          y,
          0.18,
          0.09,
          height + 0.2,
          0.10,
          stone,
        )
        mesh.member(
          a,
          direction,
          normal,
          u,
          y + sign * (height + 0.11) / 2,
          0.18,
          width + 0.2,
          0.09,
          0.10,
          stone,
        )
      mesh.member(a, direction, normal, u, y, 0.21, 0.055, height, 0.04, stone)
      mesh.member(
        a, direction, normal, u, y + 0.23 * height, 0.21, width, 0.055, 0.04, stone
      )
      if style in {"akazien-reform", "landshuter-renaissance"}:
        # Smaller distinct sash lights, following the official account
        # of mixed window shapes; exact small joinery remains estimated.
        for sign in [-1, 1]:
          mesh.member(
            a,
            direction,
            normal,
            u + sign * width * 0.25,
            y,
            0.22,
            0.035,
            height,
            0.035,
            stone,
          )
      if style == "landshuter-renaissance" and row > 0:
        mesh.member(
          a,
          direction,
          normal,
          u,
          y + height / 2 + 0.27,
          0.20,
          width + 0.35,
          0.12,
          0.20,
          stone,
        )
        for sign in [-1, 1]:
          mesh.member(
            a,
            direction,
            normal,
            u + sign * (width + 0.24) / 2,
            y,
            0.15,
            0.12,
            height + 0.35,
            0.15,
            stone,
          )
      if style == "historic-stucco" and row in {1, 2}:
        mesh.member(
          a,
          direction,
          normal,
          u,
          y + height / 2 + 0.23,
          0.20,
          width + 0.32,
          0.14,
          0.17,
          stone,
        )
      if style == "goltz-glazed-brick":
        # External photograph supports dark vertical brick piers and
        # pale, red-accented spandrel fields. Code patterns are original.
        panel_y = y - height / 2 - 0.45
        if row > 0:
          for k in [-2, -1, 0, 1, 2]:
            mesh.member(
              a,
              direction,
              normal,
              u + k * 0.22,
              panel_y,
              0.135,
              0.10,
              0.12,
              0.025,
              (143, 82, 65),
            )
    if style == "goltz-glazed-brick":
      for column in range(columns + 1):
        u = 0.1 + column * (length - 0.2) / columns
        mesh.member(a, direction, normal, u, y, 0.13, 0.16, pitch, 0.04, dark)
  for y in [low + 0.45, low + pitch + 0.2, high - 0.35]:
    mesh.member(
      a, direction, normal, length / 2, y, 0.19, length - 0.25, 0.18, 0.16, stone
    )
    if style == "goltz-glazed-brick":
      for k in range(max(1, int(length / 0.65))):
        u = (k + 0.5) * length / max(1, int(length / 0.65))
        mesh.member(a, direction, normal, u, y - 0.17, 0.20, 0.25, 0.075, 0.05, dark)
  if style not in {"early-crelle", "unmeasured-neutral"}:
    for row in range(1, floors):
      y = low + row * pitch + 0.3
      mesh.member(
        a, direction, normal, length / 2, y, 0.17, length - 0.25, 0.075, 0.10, stone
      )
  return dict(axes=columns, storeys=floors, source=face["owner"], style=style)


def save_plans(plans):
  write(RUNTIME, dict(schemaVersion=1, keys=list(plans), packets=plans))


def legacy_fasanen_plans(plans, proof, descriptors):
  """Exact original v163 triangle replays for only the three false Fasanen owners."""
  # Historic builders use sibling imports; replay their original code without
  # modifying those sources or importing an accidentally different package.
  sys.path.insert(0, str(ROOT / "scripts"))
  from scripts.build_karl_marx_allee_v161 import Detail, native_detail, packed_detail
  from scripts.build_west_streets_v163 import core_detail, partition_detail

  source = read(GEO / "west-streets-v163.json")
  authoring = read(GEO / "west-kiez-v302-core-fittings.json.gz")["streamed"]
  old_ids = {identity for r in authoring for identity in r["oldIds"]}
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  old_detail = Detail()
  old_native = Detail()
  for record in source["corePrisms"]:
    if record["id"] in old_ids:
      isolated = core_detail(record, roads)
      old_detail.triangles.extend(isolated.triangles)
      old_native.triangles.extend(native_detail(isolated).triangles)
  raw_proof = {}
  for mode in ["drawn", "minecraft"]:
    native = mode == "minecraft"
    details = old_native if native else old_detail
    for (x, z), isolated in partition_detail(details).items():
      identity = f"{x}_{z}"
      if identity not in descriptors:
        raise ValueError("Fasanen legacy packet disappeared")
      descriptor = descriptors[identity]
      tile = box(*descriptor["bounds"])
      packet = read(OUT / descriptor[mode]["url"])
      expected = packed_detail(isolated, tile)
      if not expected:
        continue
      expected_keys = set(original_triangles(dict(meshes=[expected]))[0][2])
      retired = []
      for i, (part, (_, _, lookup)) in enumerate(
        zip(packet["meshes"], original_triangles(packet))
      ):
        if part["kind"] != "city-west-street-fronts-v163":
          continue
        positions, indices, _ = original_triangles(packet)[i]
        hits = [
          at
          for at, t in enumerate(indices)
          if tuple(sorted(tuple(map(int, q)) for q in positions[t])) in expected_keys
        ]
        if hits:
          retired.append(dict(mesh=i, triangles=hits))
      if not retired:
        raise ValueError(
          f"Historical Fasanen fitting replay no longer matches {mode}:{identity}"
        )
      new = Detail()
      for house in authoring:
        for row in house["nativeRows" if native else "drawnRows"]:
          px, py, pz, w, h, d = row[:6]
          rgb = row[6 if native else 7]
          tint = (rgb >> 16, (rgb >> 8) & 255, rgb & 255)
          if native:
            new.box([px, py, pz], [w, h, d], tint, "correct complete Fasanen front")
          else:
            yaw = row[6]
            c, s = math.cos(yaw), math.sin(yaw)
            temp = Detail()
            temp.box([0, 0, 0], [w, h, d], tint, "correct complete Fasanen front")
            new.triangles.extend(
              (
                [
                  [px + c * q[0] + s * q[2], py + q[1], pz - s * q[0] + c * q[2]]
                  for q in tri
                ],
                color,
                role,
              )
              for tri, color, role in temp.triangles
            )
      append = packed_detail(new, tile)
      if not append:
        raise ValueError(
          f"Complete correct Fasanen fitting complement is empty at {mode}:{identity}"
        )
      append["kind"] = KIND
      key = f"{mode}:{identity}"
      if key in plans:
        raise ValueError("Legacy Fasanen overlaps another v302 host")
      plans[key] = dict(
        origin=packet["origin"],
        navGuard=0,
        records=[
          dict(
            mesh=i,
            kind=p["kind"],
            fingerprint=fingerprint([p["positions"], p["colors"], p["indices"]]),
          )
          for i, p in enumerate(packet["meshes"])
        ],
        lineGuard=fingerprint(
          [packet["lines"]["positions"], packet["lines"].get("colors", "")]
        )
        if packet.get("lines")
        else None,
        append=append,
        appendFingerprint=fingerprint(
          [append["positions"], append["colors"], append["indices"]]
        ),
        retire=retired,
        owners=[r["parent"] for r in authoring],
      )
      raw_proof[key] = dict(legacyTriangles=sorted(expected_keys))
      proof.append(
        dict(
          key=key,
          asset=descriptor[mode]["url"],
          assetSha256=digest(OUT / descriptor[mode]["url"]),
          legacyFasanenCoreIds=sorted(old_ids),
          retiredTriangles=sum(len(r["triangles"]) for r in retired),
          newVertexCount=len(base64.b64decode(append["positions"])) // 6,
          source="Actual historical v163 core_detail, native_detail and clipped packed_detail replay; all source body/roof triangles excluded",
        )
      )
  write(GEO / "west-kiez-v302-legacy-field-proof.json.gz", raw_proof)


def selected_south_faces(descriptors, old):
  """Individual actual address owners, never arbitrary regional house fill."""
  import pyogrio

  path = GEO / "west-kiez-v302-south-addresses.json"
  selected = read(path) if path.exists() else addresses(SOUTH_ADDRESSES)
  if not path.exists():
    write(path, selected)
  buildings = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(-5400, 2300, -500, 3900),
  )
  # Stuttgarter Platz is deliberately included separately from Schöneberg.
  west = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(-5100, 1300, -4600, 1500),
  )
  import pandas as pd

  buildings = pd.concat([buildings, west], ignore_index=True)
  tree = STRtree(list(buildings.geometry))
  context = read(GEO / "district-facades-v188-context.json.gz")
  result = []
  for address in selected:
    point = Point(address["osm"]["xz"])
    candidates = [
      int(i)
      for i in tree.query(point.buffer(0.5))
      if buildings.iloc[int(i)].geometry.distance(point) <= 0.5
    ]
    if len(candidates) != 1:
      raise ValueError(
        f"Ambiguous actual address owner {address['address']}: {candidates}"
      )
    building = buildings.iloc[candidates[0]]
    owner = building.sourceId
    existing = [f for f in old["faces"] if f["owner"] == owner]
    # A primary street wall which already has one generic register keeps
    # its exact original source/omission selection; only that register yields.
    if existing:
      f = max(existing, key=lambda f: math.dist(f["a"], f["b"]))
      result.append(dict(address=address, face=f, existing=existing))
      continue
    roads = [
      shape(r["geometry"]) for r in context["roads"] if r["name"] == address["street"]
    ]
    road = unary_union(roads)
    found = []
    for identity, descriptor in descriptors.items():
      if descriptor.get("detailCompanionOf") or not box(
        *descriptor["bounds"]
      ).intersects(building.geometry):
        continue
      packet = read(OUT / descriptor["drawn"]["url"])
      matches = [b for b in packet["nav"]["buildings"] if b["sourceId"] == owner]
      for b in matches:
        ox, oy, oz = packet["origin"]
        low = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
        high = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
        triangles = set()
        for part, (p, ix, _) in zip(packet["meshes"], original_triangles(packet)):
          if part["kind"] == "city":
            triangles.update(
              tuple(sorted(tuple(map(int, q)) for q in p[t])) for t in ix
            )
        for a, end in zip(b["ring"], b["ring"][1:] + b["ring"][:1]):
          if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
            continue
          wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
          length = math.dist(wa, wb)
          if length < 4:
            continue
          direction = (wb - wa) / length
          normal = np.array([-direction[1], direction[0]])
          middle = (wa + wb) / 2
          if building.geometry.covers(Point(*(middle + normal * 0.2))):
            normal = -normal
          near = nearest_points(Point(*middle), road)[1]
          toward = np.array([near.x, near.y]) - middle
          distance = float(np.linalg.norm(toward))
          if not 1 <= distance <= 35 or float(np.dot(toward, normal)) / distance < 0.72:
            continue
          f = dict(
            owner=owner,
            chunk=identity,
            a=wa.tolist(),
            b=wb.tolist(),
            normal=normal.tolist(),
            low=low,
            high=high,
            streetName=address["street"],
            nativeSpans=[],
          )
          found.append((length, f))
    if not found:
      raise ValueError(
        f"No complete original street-wall triangles at {address['address']} {owner}"
      )
    f = max(found, key=lambda x: x[0])[1]
    result.append(dict(address=address, face=f, existing=[]))
  return result


def goltz_corner(record, descriptors):
  """The independently documented five-axis Hohenstaufenstraße return."""
  face = record["face"]
  packet = read(OUT / descriptors[face["chunk"]]["drawn"]["url"])
  context = read(GEO / "district-facades-v188-context.json.gz")
  road = unary_union(
    [
      shape(r["geometry"])
      for r in context["roads"]
      if r["name"] == "Hohenstaufenstraße"
    ]
  )
  ox, oy, oz = packet["origin"]
  triangles = set()
  for part, (p, ix, _) in zip(packet["meshes"], original_triangles(packet)):
    if part["kind"] == "city":
      triangles.update(tuple(sorted(tuple(map(int, q)) for q in p[t])) for t in ix)
  candidates = []
  for b in packet["nav"]["buildings"]:
    if b["sourceId"] != face["owner"]:
      continue
    poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
    low = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
    high = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
    for a, end in zip(b["ring"], b["ring"][1:] + b["ring"][:1]):
      if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
        continue
      a, end = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
      length = math.dist(a, end)
      if length < 7:
        continue
      d = (end - a) / length
      n = np.array([-d[1], d[0]])
      center = (a + end) / 2
      if poly.covers(Point(*(center + n * 0.2))):
        n = -n
      near = nearest_points(Point(*center), road)[1]
      toward = np.array([near.x, near.y]) - center
      distance = np.linalg.norm(toward)
      if not 1 <= distance <= 30 or np.dot(toward, n) / distance < 0.85:
        continue
      candidates.append(
        (
          length,
          dict(
            face,
            a=a.tolist(),
            b=end.tolist(),
            normal=n.tolist(),
            streetName="Hohenstaufenstraße",
            nativeSpans=[],
          ),
        )
      )
  if not candidates:
    raise ValueError("Documented Goltz32 return has no complete source wall")
  return dict(
    address=record["address"],
    face=max(candidates, key=lambda x: x[0])[1],
    existing=[],
    host="district188-" + face["chunk"],
    countedAxes=5,
  )


def build():
  manifest = read(OUT / "manifest.json")
  descriptors = {d["id"]: d for d in manifest["chunks"]}
  source = read(GEO / "district-facades-v188-evidence.json.gz")
  selected = selected_south_faces(descriptors, source)
  selected.append(
    goltz_corner(
      next(r for r in selected if r["address"]["address"] == "Goltzstraße 32"),
      descriptors,
    )
  )
  grouped = defaultdict(list)
  for record in selected:
    host = record.get(
      "host", ("district188-" if record["existing"] else "") + record["face"]["chunk"]
    )
    grouped[host].append(record)
  plans, proof = {}, []
  for companion, records in grouped.items():
    for mode in ["drawn", "minecraft"]:
      native = mode == "minecraft"
      packet = read(OUT / descriptors[companion][mode]["url"])
      mesh = Mesh(packet["origin"])
      fronts, roles, old_faces, body_assets = [], [], [], {}
      for record in records:
        face = record["face"]
        tile = face["chunk"]
        address = record["address"]["address"]
        base_packet = read(OUT / descriptors[tile][mode]["url"])
        body_assets[descriptors[tile][mode]["url"]] = digest(
          OUT / descriptors[tile][mode]["url"]
        )
        actual = native_fronts(face, base_packet) if native else [face]
        if not actual:
          raise ValueError(f"No actual native source front at {address} {tile}")
        style = (
          "goltz-glazed-brick"
          if address == "Goltzstraße 32"
          else "akazien-reform"
          if address == "Akazienstraße 30"
          else "landshuter-renaissance"
          if address == "Landshuter Straße 15"
          else "early-crelle"
          if address in {"Crellestraße 15", "Crellestraße 16"}
          else "unmeasured-neutral"
          if address == "Hauptstraße 146"
          else "historic-stucco"
        )
        if address == "Hauptstraße 146":
          REFERENCES[address] = (
            f"https://www.openstreetmap.org/{record['address']['osm']['element']}/{record['address']['osm']['id']}"
          )
        counted = record.get("countedAxes", 7 if address == "Goltzstraße 32" else None)
        roles.extend(
          dict(
            address=address,
            reference=REFERENCES[address],
            **recognition_front(
              mesh, f, native, style, axes=counted if not native else None
            ),
          )
          for f in actual
        )
        fronts.extend(actual)
        old_faces.extend(record["existing"])
      append = mesh.payload()["meshes"][0]
      append["kind"] = KIND
      raw_indices = sum(
        len(base64.b64decode(p["indices"])) / 4 for p in packet["meshes"]
      )
      raw_vertices = sum(
        len(base64.b64decode(p["positions"])) / 6 for p in packet["meshes"]
      )
      if (
        raw_indices + len(mesh.indices) > 2400000
        or raw_vertices + len(mesh.positions) > 400000
        or len(packet["meshes"]) + 1 > 16
      ):
        raise ValueError("Unchanged packet budgets exceeded")
      plan = dict(
        origin=packet["origin"],
        navGuard=0,
        records=[
          dict(
            mesh=i,
            kind=p["kind"],
            fingerprint=fingerprint([p["positions"], p["colors"], p["indices"]]),
          )
          for i, p in enumerate(packet["meshes"])
        ],
        lineGuard=fingerprint(
          [packet["lines"]["positions"], packet["lines"].get("colors", "")]
        )
        if packet.get("lines")
        else None,
        append=append,
        appendFingerprint=fingerprint(
          [append["positions"], append["colors"], append["indices"]]
        ),
        retire=generic_front_triangles(packet, old_faces, native),
        owners=sorted({record["face"]["owner"] for record in records}),
      )
      plans[f"{mode}:{companion}"] = plan
      proof.append(
        dict(
          key=f"{mode}:{companion}",
          asset=descriptors[companion][mode]["url"],
          assetSha256=digest(OUT / descriptors[companion][mode]["url"]),
          sourceBodyAssets=body_assets,
          newVertexCount=len(mesh.positions),
          retiredTriangles=sum(len(r["triangles"]) for r in plan["retire"]),
          faces=fronts,
          roles=roles,
        )
      )
  legacy_fasanen_plans(plans, proof, descriptors)
  save_plans(plans)
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      packets=proof,
      reference="https://bildhauerei-in-berlin.de/bildwerk/mietshaus-hohenstaufenstrasse-goltzstrasse-10465/",
      credit="Pauline Ahrens, 2023, CC BY 4.0; original procedural recognition, no photographic pixels bundled",
      policy="Only exact old generic fitting triangles yield; complete original body/roof/source packets remain immutable. Counted front has seven axes and five storeys; small member dimensions are display estimates.",
    ),
  )
  print(
    json.dumps(
      dict(
        keys=list(plans),
        proof=[
          {
            k: v
            for k, v in p.items()
            if k in ["key", "newVertexCount", "retiredTriangles"]
          }
          for p in proof
        ],
      )
    )
  )


if __name__ == "__main__":
  build()
