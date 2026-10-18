"""Two complete measured venue replacements and mapped Hermannplatz access markers.

Only exact old owner triangles/navigation yield, atomically in their original
packets. Dated source geometry is retained; facade subdivisions are estimates.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pyogrio
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_district_facades_v188 import world as world_geometry
from build_karl_marx_allee_v161 import Detail, mesh_signature, packed_detail
from build_panorama_facade_v202 import fingerprint
from build_region_outlines_v200 import world, xml_elements
from build_small_tiergarten_v237 import oriented
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import chunk_payload, load_projected_polygon
from build_west_streets_v163 import partition_detail
from integrate_city_refinements_v166 import line_signature
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "venues-hermann-v238-source.json.gz"
EVIDENCE = GEO / "venues-hermann-v238-evidence.json"
ADDITION = GEO / "venues-hermann-v238-manifest-addition.json"
REPLACEMENT = ROOT / "src/app/src/data/venuesV238Replacement.json"
TARGETS = [
  dict(
    key="huxleys",
    name="Huxleys Neue Welt",
    parent="DEBE08YYF00009PW",
    osm=30255865,
    archive="LoD2_392_5816.zip",
    owner="OSM-way-30255865",
    packet="ring182-6_7",
    family="ring-v182",
  ),
  dict(
    key="columbia",
    name="Columbiahalle",
    parent="DEBE07YY900008dL",
    osm=22906406,
    archive="LoD2_390_5816.zip",
    owner="DEBE07YY900008dL",
    packet="2_7",
    family="outer-v159",
  ),
]
REFS = [
  "https://huxleysneuewelt.de/contact",
  "https://huxleysneuewelt.de/about",
  "https://huxleysneuewelt.de/information",
  "https://neuewelt-berlin.de/huxleys-neue-welt/",
  "https://www.columbiahalle.berlin/kontakt.html",
  "https://www.columbiahalle.berlin/about-us.html",
  "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/tempelhof-schoeneberg/columbia-kino-und-sporthalle-647683.php",
  "https://www.bvg.de/de/verbindungen/stationsuebersicht/u-hermannplatz",
]
POLICY = (
  "All 19 official LoD2 parts, roof/wall sheets, holes and relative elevations retained. "
  "Each parent is rigidly shifted onto the existing outer-city ground y=3. "
  "Exactly two coarse prior owners yield through fingerprinted triangle/line/nav receipts. "
  "Facade colours, window divisions, frame depths, lettering and fitting sizes are display estimates; "
  "no measured facade survey or photographic texture. Columbiahalle is distinct from Columbia Theater. "
  "Hermannplatz additions use mapped at-grade entrance nodes and existing stair axes, with "
  "no excavation, below-ground floor, terrain edit, invented elevator or navigable basement."
)


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, data):
  raw = (
    json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract():
  maps = {
    n: xml_elements(GEO / f"raw/venues-hermann-v238/{n}.osm")
    for n in ("huxleys", "columbia")
  }

  def geometry(e, es):
    if e["type"] == "node":
      return Point(world(e["lon"], e["lat"]))
    ps = [world(es["node", i]["lon"], es["node", i]["lat"]) for i in e["nodes"]]
    return Polygon(ps) if len(ps) > 3 and ps[0] == ps[-1] else LineString(ps)

  buildings = []
  for t in TARGETS:
    es = maps[t["key"]]
    archive = GEO / "raw/lod2" / t["archive"]
    parent = extract_parent(archive, t["parent"])
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    oldpath = GEO / f"raw/{t['family']}/resolved-outlines.gpkg"
    row = pyogrio.read_dataframe(
      oldpath, layer="buildings", where=f"sourceId='{t['owner']}'"
    ).iloc[0]
    old = {k: row[k] for k in ("sourceId", "height", "minHeight", "heightSource")}
    old["geometry"] = mapping(row.geometry)
    osm = es["way", t["osm"]]
    g = geometry(osm, es)
    entrances = [
      dict(id=f"node/{i}", tags=e["tags"], position=list(geometry(e, es).coords)[0])
      for (typ, i), e in es.items()
      if typ == "node"
      and e["tags"].get("entrance")
      and g.boundary.distance(geometry(e, es)) < 3
    ]
    buildings.append(
      dict(
        **t,
        parts=parts,
        oldOwner=old,
        sourceGroundY=min(p["ground_y_m"] for p in parts),
        archiveSha256=sha(archive),
        archiveUrl="https://gdi.berlin.de/data/a_lod2/atom/" + t["archive"],
        osmTags=osm["tags"],
        osmGeometry=mapping(g),
        entrances=entrances,
      )
    )
  es = maps["huxleys"]
  entries = [
    e
    for (typ, i), e in es.items()
    if typ == "node" and e["tags"].get("railway") == "subway_entrance"
  ]
  access = []
  for e in entries:
    linked = [
      w
      for (typ, i), w in es.items()
      if typ == "way"
      and e["id"] in w.get("nodes", [])
      and (w["tags"].get("highway") == "steps" or w["tags"].get("conveying"))
    ]
    access.append(
      dict(
        id=f"node/{e['id']}",
        tags=e["tags"],
        position=list(geometry(e, es).coords)[0],
        stairs=[
          dict(id=f"way/{w['id']}", tags=w["tags"], geometry=mapping(geometry(w, es)))
          for w in linked
        ],
      )
    )
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      retrieved="2026-10-18",
      policy=POLICY,
      licenses=["Berlin LoD2: dl-de/zero-2-0", "OpenStreetMap contributors: ODbL-1.0"],
      references=REFS,
      buildings=buildings,
      accesses=access,
      maps={
        n: dict(
          url="https://api.openstreetmap.org/api/0.6/map?bbox=" + bbox,
          sha256=sha(GEO / f"raw/venues-hermann-v238/{n}.osm"),
        )
        for n, bbox in [
          ("huxleys", "13.4197,52.4858,13.4258,52.4891"),
          ("columbia", "13.3902,52.4836,13.3943,52.4854"),
        ]
      },
    ),
  )
  return read(SOURCE)


# Original small block glyphs, no downloaded font or logo asset.
GLYPHS = {
  "A": ["010", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["111", "100", "100", "100", "111"],
  "E": ["111", "100", "110", "100", "111"],
  "H": ["101", "101", "111", "101", "101"],
  "I": ["111", "010", "010", "010", "111"],
  "L": ["100", "100", "100", "100", "111"],
  "M": ["10001", "11011", "10101", "10001", "10001"],
  "N": ["1001", "1101", "1011", "1001", "1001"],
  "O": ["111", "101", "101", "101", "111"],
  "S": ["111", "100", "111", "001", "111"],
  "T": ["111", "010", "010", "010", "010"],
  "U": ["101", "101", "101", "101", "111"],
  "W": ["10101", "10101", "10101", "10101", "01110"],
  "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  " ": ["0", "0", "0", "0", "0"],
}


def rgb(hexcolor):
  return ((hexcolor >> 16) & 255, (hexcolor >> 8) & 255, hexcolor & 255)


def text_label(detail, text, center, direction, normal, height, color, native):
  pitch = height / 5
  total = sum(len(GLYPHS[ch][0]) + 1 for ch in text) * pitch - pitch
  cursor = -total / 2
  angle = math.atan2(direction[1], direction[0])
  for ch in text:
    for ri, row in enumerate(GLYPHS[ch]):
      for ci, bit in enumerate(row):
        if bit == "0":
          continue
        u = cursor + (ci + 0.5) * pitch
        p = np.array(center)[[0, 2]] + np.array(direction) * u + np.array(normal) * 0.12
        oriented(
          detail,
          [p[0], center[1] + (2 - ri) * pitch, p[1]],
          [pitch * 0.84, pitch * 0.84, 0.045],
          angle,
          color,
          "geometric-venue-lettering",
          native,
        )
    cursor += (len(GLYPHS[ch][0]) + 1) * pitch


def face_axes(b):
  allparts = [(p, Polygon(p["ring"], p["holes"])) for p in b["parts"]]
  result = []
  for p, poly in allparts:
    for s in p["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      ring = [[x, y - b["sourceGroundY"] + 3, z] for x, y, z in s["rings"][0]]
      horizontal = [
        (a, c) for a, c in zip(ring, ring[1:] + ring[:1]) if abs(a[1] - c[1]) < 0.03
      ]
      if not horizontal:
        continue
      a, c = max(horizontal, key=lambda ac: math.dist(ac[0], ac[1]))
      av, cv = np.array([a[0], a[2]]), np.array([c[0], c[2]])
      length = float(np.linalg.norm(cv - av))
      if length < 1:
        continue
      d = (cv - av) / length
      n = np.array([-d[1], d[0]])
      if poly.covers(Point((av + cv) / 2 + n * 0.1)):
        n = -n
      others = [
        q["top_y_m"] - b["sourceGroundY"] + 3
        for q, g in allparts
        if q["id"] != p["id"] and g.covers(Point((av + cv) / 2 + n * 0.2))
      ]
      low = max(min(v[1] for v in ring), max(others, default=3))
      high = max(v[1] for v in ring)
      plane = Polygon([[(np.array([v[0], v[2]]) - av).dot(d), v[1]] for v in ring])
      if not plane.is_valid:
        plane = plane.buffer(0)
      if high - low > 0.5:
        result.append(
          dict(
            a=av, d=d, n=n, length=length, low=low, high=high, plane=plane, part=p["id"]
          )
        )
  return result


def architecture(b):
  drawn, native = Detail(), Detail()
  surfaces = []
  for p in b["parts"]:
    for si, s in enumerate(p["surfaces"]):
      rings = [
        [[x, y - b["sourceGroundY"] + 3, z] for x, y, z in r] for r in s["rings"]
      ]
      tris = triangles_for(rings)
      color = 0xD4CDB7 if b["key"] == "huxleys" else 0xD5D2C1
      if s["kind"] == "RoofSurface":
        color = 0x777D7B
      surfaces.append(dict(color=color, triangles=tris))
      for tri in tris:
        drawn.triangles.append(
          (tri, rgb(color), f"{b['parent']}/{p['id']}/{si}/{s['kind']}")
        )
  for row in native_blocks(dict(surfaces=surfaces, boxes=[], rods=[])):
    native.box(row[:3], row[3:6], rgb(row[6]), "independent-measured-native-skin")
  faces = face_axes(b)
  audit = []
  for f in faces:
    # Only the public north street frontage at Neue Welt, or the southern
    # entrance/side wings at Columbia. The high gym gable stays windowless.
    front = (
      (f["n"][1] < -0.65 and f["a"][1] < 3655)
      if b["key"] == "huxleys"
      else (f["n"][1] > 0.65 and f["a"][1] > 3835)
    )
    if not front:
      continue
    d, n, a = f["d"], f["n"], f["a"]
    angle = math.atan2(d[1], d[0])

    def fitting(u, y, w, h, depth, color, role, out=0.11):
      if y - h / 2 < f["low"] + 0.02 or not f["plane"].buffer(0.001).covers(
        box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
      ):
        return
      for detail, isnative in [(drawn, False), (native, True)]:
        # Native skin encloses sampled metre cells; fittings must be outside
        # its conservative .71m diagonal reach, not swallowed by that skin.
        p = a + d * u + n * (0.81 if isnative else out)
        oriented(detail, [p[0], y, p[1]], [w, h, depth], angle, color, role, isnative)
      audit.append(
        dict(part=f["part"], role=role, center=(a + d * u).tolist(), y=y, size=[w, h])
      )

    # A thin stone base/eave follows only exposed source frontage; it does not
    # invent a taller parent extrusion or close any courtyard.
    if f["length"] > 2:
      fitting(
        f["length"] / 2,
        f["high"] - 0.18,
        f["length"] - 0.12,
        0.18,
        0.22,
        (188, 185, 171),
        "source-eave",
      )
    if b["key"] == "huxleys" and f["length"] > 3.0:
      for y in [7.4, 11.1, 14.8]:
        if y + 1.05 > f["high"] - 0.55:
          continue
        count = max(1, round(f["length"] / 3.3))
        for i in range(count):
          u = (i + 0.5) * f["length"] / count
          fitting(u, y, 1.55, 2.15, 0.1, (228, 222, 207), "front-window-frame")
          fitting(u, y, 1.29, 1.89, 0.13, (101, 127, 133), "front-window-glass", 0.19)
          fitting(u, y, 0.1, 1.9, 0.18, (216, 214, 201), "front-window-mullion", 0.27)
    # Columbia's documented tall hall wall is deliberately blank.
  # Exact mapped Columbia doors; no guessed entrance coordinates at Huxleys.
  if b["key"] == "columbia":
    for e in b["entrances"]:
      p = np.array(e["position"])
      f = min(
        faces,
        key=lambda f: LineString([f["a"], f["a"] + f["d"] * f["length"]]).distance(
          Point(p)
        ),
      )
      u = float(np.clip((p - f["a"]).dot(f["d"]), 0, f["length"]))
      center = f["a"] + f["d"] * u
      for detail, isnative in [(drawn, False), (native, True)]:
        c = center + f["n"] * (0.82 if isnative else 0.14)
        oriented(
          detail,
          [c[0], 4.35, c[1]],
          [1.65, 2.6, 0.12],
          math.atan2(f["d"][1], f["d"][0]),
          (92, 112, 113),
          "mapped-entrance-door",
          isnative,
        )
      audit.append(
        dict(
          role="mapped-entrance-door",
          id=e["id"],
          sourcePosition=e["position"],
          wallPosition=center.tolist(),
        )
      )
  eligible = [
    f
    for f in faces
    if (
      (f["n"][1] < -0.65 and f["a"][1] < 3655)
      if b["key"] == "huxleys"
      else (f["n"][1] > 0.65 and f["a"][1] > 3835)
    )
    and f["length"] > 8
    and f["high"] - f["low"] > 3
  ]
  if eligible:
    f = max(eligible, key=lambda f: f["length"])
    # Geometric current venue name, not a copied historical sign or logo.
    word = "HUXLEYS" if b["key"] == "huxleys" else "COLUMBIA HALLE"
    ht = min(
      0.65, (f["length"] - 1.5) * 5 / (sum(len(GLYPHS[ch][0]) + 1 for ch in word))
    )
    y = min(f["high"] - 1.0, 6.5)
    if y < f["low"] + 1:
      y = f["low"] + 1.5
    d = np.array([f["n"][1], -f["n"][0]])
    for detail, isnative in [(drawn, False), (native, True)]:
      p = f["a"] + f["d"] * f["length"] / 2 + f["n"] * (0.85 if isnative else 0.2)
      oriented(
        detail,
        [p[0], y, p[1]],
        [f["length"] - 0.7, ht + 1, 0.08],
        math.atan2(d[1], d[0]),
        (225, 223, 211),
        "venue-name-board",
        isnative,
      )
      text_label(detail, word, [p[0], y, p[1]], d, f["n"], ht, (59, 75, 79), isnative)
    audit.append(
      dict(
        role="venue-name",
        text=word,
        part=f["part"],
        position=[*list(f["a"] + f["d"] * f["length"] / 2), y],
      )
    )
  return {"drawn": drawn, "minecraft": native}, audit


def access_models(source):
  details = {m: Detail() for m in ("drawn", "minecraft")}
  audit = []
  for a in source["accesses"]:
    p = np.array(a["position"])
    if a["stairs"]:
      line = shape(a["stairs"][0]["geometry"])
      ps = list(line.coords)
      if math.dist(ps[-1], p) < math.dist(ps[0], p):
        ps.reverse()
      d = np.array(ps[-1]) - np.array(ps[0])
      length = float(np.linalg.norm(d))
      d /= length
    else:
      # No source axis means no speculative long rail. The mapped marker alone
      # receives a short pole; its sign orientation is only a display estimate.
      d = np.array([1.0, 0.0])
      length = 0
    n = np.array([-d[1], d[0]])
    width = 1.8
    for mode, detail in details.items():
      native = mode == "minecraft"
      if length:
        for side in [-1, 1]:
          for t in [0, 0.5, 1]:
            c = p + d * length * t + n * side * width / 2
            detail.box(
              [c[0], 3.6, c[1]],
              [0.065, 1, 0.065],
              (72, 89, 86),
              "mapped-stair-railing-post",
            )
          c = p + d * length / 2 + n * side * width / 2
          oriented(
            detail,
            [c[0], 4.13, c[1]],
            [length, 0.07, 0.07],
            math.atan2(d[1], d[0]),
            (72, 89, 86),
            "mapped-stair-railing",
            native,
          )
      # Marker stays beside the access mouth so it cannot block the route.
      c = p + n * (width / 2 + 0.18)
      detail.box(
        [c[0], 4.65, c[1]], [0.075, 3.1, 0.075], (62, 81, 78), "mapped-U-marker-post"
      )
      oriented(
        detail,
        [c[0], 6.0, c[1]],
        [0.82, 0.82, 0.08],
        math.atan2(n[1], n[0]),
        (33, 78, 141),
        "mapped-U-marker-board",
        native,
      )
      for side in [-1, 1]:
        text_label(
          detail,
          "U",
          [c[0], 6.0, c[1]],
          n * side,
          d * side,
          0.57,
          (239, 239, 227),
          native,
        )
    audit.append(
      dict(
        id=a["id"],
        position=a["position"],
        stairOwners=[s["id"] for s in a["stairs"]],
        widthEstimate=width,
        axisLength=length,
      )
    )
  return details, audit


def replacement_for(b, models):
  desc = next(
    c for c in read(OUT / "manifest.json")["chunks"] if c["id"] == b["packet"]
  )
  tile = box(*desc["bounds"])
  scope = (
    world_geometry(
      load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(
        load_projected_polygon(GEO / "bounds.geojson")
      )
    )
    if b["family"] == "ring-v182"
    else tile
  )
  # This owner is wholly inside the existing outer coverage, so tile as ground
  # gives exactly the same native clipping. Exact signatures prove that fact.
  owner = {**b["oldOwner"], "geometry": shape(b["oldOwner"]["geometry"])}
  result = {}
  for mode in ["drawn", "minecraft"]:
    path = OUT / desc[mode]["url"]
    payload = read(path)
    full = chunk_payload(
      b["packet"],
      tile,
      scope.intersection(tile),
      [owner],
      {},
      minecraft=mode == "minecraft",
    )
    empty = chunk_payload(
      b["packet"], tile, scope.intersection(tile), [], {}, minecraft=mode == "minecraft"
    )
    expected = mesh_signature(full) - mesh_signature(empty)
    assert expected and not expected - mesh_signature(payload), (
      b["key"],
      mode,
      "old owner mismatch",
    )
    records = []
    for index, mesh in enumerate(payload["meshes"]):
      if mesh["kind"] != "city":
        continue
      v = np.column_stack(
        [
          np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
          np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
        ]
      )
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      removed = []
      for i, tri in enumerate(v[ix]):
        key = b"".join(sorted(q.tobytes() for q in tri))
        if expected[key]:
          expected[key] -= 1
          removed.append(i)
      if removed:
        records.append(
          dict(
            mesh=index,
            fingerprint=fingerprint(
              [mesh[k] for k in ("positions", "colors", "indices")]
            ),
            triangles=removed,
          )
        )
    assert not +expected
    lineFingerprint = None
    segments = []
    if mode == "drawn" and payload.get("lines"):
      expected = line_signature(full["lines"]) - line_signature(empty["lines"])
      mesh = payload["lines"]
      v = np.column_stack(
        [
          np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
          np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
        ]
      ).reshape(-1, 2, 6)
      for i, seg in enumerate(v):
        key = b"".join(sorted(q.tobytes() for q in seg))
        if expected[key]:
          expected[key] -= 1
          segments.append(i)
      assert not +expected
      lineFingerprint = fingerprint([mesh[k] for k in ("positions", "colors")])
    replacement = packed_detail(models[mode], tile)
    replacement["kind"] = "elevated-station-v238"
    nav = [
      dict(owner=b["owner"], original=r, groundY=payload["nav"]["groundY"])
      for r in payload["nav"]["buildings"]
      if r["sourceId"] == b["owner"]
    ]
    assert nav
    ox, _, oz = payload["origin"]
    solids = [
      dict(
        ring=[[x - ox, z - oz] for x, z in p["ring"]],
        holes=[[[x - ox, z - oz] for x, z in r] for r in p["holes"]],
        minY=3 + p["ground_y_m"] - b["sourceGroundY"],
        maxY=3 + p["top_y_m"] - b["sourceGroundY"],
      )
      for p in b["parts"]
    ]
    result[f"{mode}:{b['packet']}"] = dict(
      origin=payload["origin"],
      records=records,
      lineFingerprint=lineFingerprint,
      segments=segments,
      replacement=replacement,
      navigationRecords=nav,
      navigationSolids=solids,
      sourcePacketSha256=sha(path),
    )
  return result


def build():
  source = read(SOURCE) if SOURCE.exists() else extract()
  packets = {}
  sites = []
  for b in source["buildings"]:
    models, audit = architecture(b)
    packets.update(replacement_for(b, models))
    sites.append(
      dict(
        key=b["key"],
        owner=b["owner"],
        parts=len(b["parts"]),
        sheets=sum(len(p["surfaces"]) for p in b["parts"]),
        modelTriangles={m: len(d.triangles) for m, d in models.items()},
        details=audit,
      )
    )
  write(
    REPLACEMENT,
    dict(schema=1, keys=list(packets), packets=packets, sourceSha256=sha(SOURCE)),
  )
  models, audit = access_models(source)
  partitions = {m: partition_detail(d) for m, d in models.items()}
  descriptors = []
  for cell in sorted(set().union(*[set(p) for p in partitions.values()])):
    ix, iz = cell
    ident = f"venues238-{ix}_{iz}"
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    desc = dict(id=ident, bounds=bounds)
    for mode in ["drawn", "minecraft"]:
      mesh = packed_detail(partitions[mode].get(cell, Detail()), box(*bounds))
      mesh["kind"] = "venues-hermann-v238"
      payload = dict(
        schemaVersion=1,
        id=ident,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(groundY=3, ground=[], water=[], buildings=[]),
      )
      path = OUT / f"{ident}.{mode}.json.gz"
      write(path, payload)
      desc[mode] = dict(
        url=path.name,
        encoding="gzip",
        bytes=path.stat().st_size,
        decodedBytes=len(gzip.decompress(path.read_bytes())),
        sha256=sha(path),
      )
    descriptors.append(desc)
  write(
    ADDITION,
    dict(
      schemaVersion=1,
      version="1.0.138",
      chunks=descriptors,
      source=dict(sourceSha256=sha(SOURCE), replacementSha256=sha(REPLACEMENT)),
    ),
  )
  counts = {}
  for key, r in packets.items():
    m = r["replacement"]
    nv = len(base64.b64decode(m["positions"])) // 6
    ni = len(base64.b64decode(m["indices"])) // 4
    counts[key] = dict(
      vertices=nv,
      indices=ni,
      gpuBytes=nv * 12 + ni * (2 if nv <= 65535 else 4),
      removedTriangles=sum(len(s["triangles"]) for s in r["records"]),
      removedLines=len(r["segments"]),
    )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=sha(SOURCE),
      replacementSha256=sha(REPLACEMENT),
      additionSha256=sha(ADDITION),
      sites=sites,
      accesses=audit,
      replacementCounts=counts,
      unchangedPackets={k: r["sourcePacketSha256"] for k, r in packets.items()},
      limitations=[
        "Unmeasured facade subdivisions/colours/sign dimensions are display estimates, not exact current surveyed openings.",
        "Huxleys has no mapped door node; no exact portal location is claimed.",
        "Hermannplatz has seven mapped markers and six stair axes; only above-ground recognition is added, navigation/underground voids unchanged.",
      ],
    ),
  )
  print(
    json.dumps(
      dict(
        sourceBytes=SOURCE.stat().st_size,
        replacementBytes=REPLACEMENT.stat().st_size,
        companionPackets=len(descriptors),
        counts=counts,
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
