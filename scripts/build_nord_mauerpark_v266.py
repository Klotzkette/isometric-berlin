"""Finite source-bound details for the Nordbahnhof venues and Mauerpark.

Every member is supported by an existing delivered wall/ground surface. Core
and streamed packets keep their original identity, geometry and lifetime.
"""

from __future__ import annotations

import base64
import math
import re
from collections import Counter

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from scripts import build_district_facades_v188 as base
from scripts import build_friedrichshain_v266 as fh
from scripts import build_scheunen_v265 as fit
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "nord-mauerpark-v266-context.json.gz"
EVIDENCE = GEO / "nord-mauerpark-v266-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/nordMauerparkV266.json"
MAX_BOXES = 900
POLICY = (
  "Complete original core and streamed geometry is retained. HfS timber slats "
  "and cafe glazing follow the architect's exterior evidence, bat its entrance "
  "photograph. Member spacing, dimensions, tones and unmeasured openings are "
  "explicit proportional display estimates. DB and MYJUMP entrance fittings "
  "are estimated on exact retained mapped owners, never evidence of surveyed "
  "doors. Mauerpark stone edges retain their actual mapped line and 0.5m tag. "
  "Native fittings fit independent delivered orthogonal wall planes. No new "
  "descriptor, root, cache, texture, live budget, building envelope or tour stop."
)
REFERENCES = [
  dict(
    url="https://www.hfs-berlin.de/buehnen/",
    claim="Zinnowitzer Str. 11 and bat Belforter Str. 15 are distinct venues",
  ),
  dict(
    url="https://ortner-ortner.com/de/baukunst/projekte/kultur/hochschule-fuer-schauspielkunst-ernst-busch",
    claim="Timber stage tower and glazed cafe box; published 24m tower; original measured source heights retained",
    credit="Schnepp Renou / Horst Stasny / euroluftbild.de for O&O Baukunst; reference only",
  ),
  dict(
    url="https://www.ortner-ortner.com/en/baukunst/projekte/kultur/berliner-arbeitertheater-bat",
    claim="Bat exterior entrance photograph: framed central door, three upper openings and low side openings",
    credit="Stefan Mueller for O&O Baukunst; reference only",
  ),
  dict(
    url="https://myjump.de/berlin-mitte",
    claim="MYJUMP Berlin Mitte, Caroline-Michaelis-Strasse 8; no exterior construction measurement",
  ),
  dict(
    url="https://www.dbsystel.de/resource/blob/418080/771e5262de9b4aec0e5120bbccdcfdfd/Anfahrtsskizze-DB-Systel-Berlin--Caroline-Michaelis-Strasse-data.pdf",
    claim="Stettiner Carree at Caroline-Michaelis 5-11; distinct from Nordbahnhof Carre; no map tracing",
    credit="Exterior photo Bartlomiej Banaszak; reference only",
  ),
  dict(
    url="https://gruen-berlin.de/pressemitteilung/mehr-gruen-fuer-die-stadt-mauerpark-eroeffnet-mit-verdoppelter-flaeche",
    claim="Granite public-space character and stone seating; no protected park-plan tracing",
  ),
  dict(
    url="https://gruen-berlin.de/projekt-meldung/qualifizierung-mauerpark-musterflaechen-am-amphitheater",
    claim="Amphitheatre survives; future works are not represented as completed",
  ),
]


def extract() -> None:
  """Freeze only the named venue/park objects from existing local sources."""
  source = GEO / "alt-mitte-v169/source-390_5821-00.json.gz"
  old = base.read_json(source)
  hfs = next(b for b in old["buildings"] if b["id"] == "DEBE01YYK00004jQ")
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes, benches, edges = [], [], []
  for bounds in [(13.381, 52.532, 13.386, 52.536), (13.399, 52.540, 13.406, 52.547)]:
    f = pyogrio.read_dataframe(pbf, layer="points", bbox=bounds)
    for row in f.itertuples():
      tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.other_tags)))
      x, y = tr.transform(row.geometry.x, row.geometry.y)
      item = dict(id=str(row.osm_id), point=[x - 389500, 5820000 - y], tags=tags)
      if str(row.osm_id) in {
        "9282901515",
        "600118966",
        "600118967",
        "600118969",
        "600118970",
      }:
        nodes.append(item)
      if (
        tags.get("amenity") == "bench"
        and tags.get("material") == "wood"
        and tags.get("direction", "").isdigit()
      ):
        benches.append(
          dict(
            **item,
            direction=int(tags["direction"]),
            backrest=tags.get("backrest") == "yes",
          )
        )
  f = pyogrio.read_dataframe(
    pbf, layer="lines", bbox=(13.400, 52.542, 13.405, 52.545)
  ).to_crs(25833)
  for row in f.itertuples():
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.other_tags)))
    if tags.get("height") == "0.5" and tags.get("material") == "stone":
      edges.append(
        dict(id=str(row.osm_id), geometry=mapping(base.world(row.geometry)), tags=tags)
      )
  f = pyogrio.read_dataframe(
    pbf, layer="multipolygons", where="name = 'Mauerpark'"
  ).to_crs(25833)
  park = base.world(f.iloc[0].geometry)
  fallback_path = GEO / "alt-mitte-v169/source-390_5821-osm-00.json.gz"
  fallback = base.read_json(fallback_path)
  ids = {
    "OSM-way-27830228",
    "OSM-way-1545436689",
    "OSM-way-1545436690",
    "OSM-way-1545436691",
    "OSM-way-1546060720",
  }
  base.write_json(
    CONTEXT,
    dict(
      schemaVersion=1,
      source="OpenStreetMap / Geoportal Berlin retained source",
      license="ODbL-1.0 / dl-de/zero-2-0",
      inputs={
        str(p.relative_to(ROOT)): base.digest(p) for p in [source, fallback_path, pbf]
      },
      hfs=hfs,
      venues=[b for b in fallback["buildings"] if b["id"] in ids],
      nodes=nodes,
      park=dict(id="way/233994267", geometry=mapping(park)),
      edges=edges,
      benches=[b for b in benches if park.buffer(-1.1).covers(Point(b["point"]))],
      references=REFERENCES,
    ),
  )


def surface_frame(
  ring: list, owner: str, part: str, sheet: int, footprint: Polygon
) -> dict:
  """Keep the exact wall plane and determine the outward side from its source."""
  pts = np.array(ring)
  a, b = max(
    ((a, b) for a in pts for b in pts),
    key=lambda p: np.linalg.norm((p[0] - p[1])[[0, 2]]),
  )
  anchor = a[[0, 2]]
  d = (b - a)[[0, 2]]
  length = float(np.linalg.norm(d))
  d /= length
  n = np.array([-d[1], d[0]])
  if footprint.covers(Point(anchor + d * length / 2 + n * 0.1)):
    n = -n
  return dict(
    owner=owner,
    part=part,
    sheet=sheet,
    a=anchor.tolist(),
    d=d.tolist(),
    n=n.tolist(),
    length=length,
    low=float(pts[:, 1].min()),
    high=float(pts[:, 1].max()),
    ring=ring,
  )


def load_packets() -> dict:
  """Read existing core pieces and streamed packets without creating descriptors."""
  packets = {}
  for mode, family in [("drawn", "Drawn"), ("minecraft", "Native")]:
    manifest = base.read_json(
      ROOT / f"src/app/src/data/altMitte{family}V169Source.json"
    )
    for entry in manifest["chunkFiles"]:
      if not any(entry["id"].startswith(k + "-piece-") for k in ["1_-3", "1_-4"]):
        continue
      path = ROOT / "src/app/src/data" / entry["file"]
      packets.setdefault("alt-mitte-v169-" + entry["id"], {})[mode] = dict(
        path=path, packet=base.read_json(path)
      )
    manifest = base.read_json(OUT / "manifest.json")
    for key in ["1_-3", "1_-4", "6_-3", "3_-6", "4_-6", "3_-7", "4_-7"]:
      desc = next(d for d in manifest["chunks"] if d["id"] == key)
      path = OUT / desc[mode]["url"]
      packets.setdefault(key, {})[mode] = dict(path=path, packet=base.read_json(path))
  return packets


def build() -> dict:
  """Compile small, independently supported drawn/native source receipts."""
  if not CONTEXT.exists():
    extract()
  context = base.read_json(CONTEXT)
  packets = load_packets()
  plans, geometry, planes, assets = {}, {}, [], {}
  for key, modes in packets.items():
    plans[key] = {}
    for mode, record in modes.items():
      p = record["packet"]
      plans[key][mode] = dict(
        origin=p["origin"],
        guard=nav_fingerprint(p["nav"]),
        records=[
          dict(
            mesh=i,
            kind=m["kind"],
            fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
          )
          for i, m in enumerate(p["meshes"])
        ],
        boxes=[],
      )
      geometry[key, mode] = fit.drawn_triangles(p, [])
      if mode == "minecraft":
        for plane in fit.native_planes(p, []):
          plane["chunk"] = key
          planes.append(plane)
      assets[str(record["path"].relative_to(ROOT))] = base.digest(record["path"])
  # MYJUMP's complete existing legacy envelope is intentionally retained in
  # the main city root (the modern LoD2 source conflicts with that ownership).
  # Its new fittings join the already streamed tile lifetime. Read the actual
  # retained prism and native columns, never substitute the conflicting shell.
  prism_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  prism = next(
    p for p in base.read_json(prism_path)["buildings"] if p["id"] == "27830228"
  )
  root_ring = [[x / 10, z / 10] for x, z in prism["ring"]]
  root_tris = []
  for a, b in zip(root_ring, root_ring[1:] + root_ring[:1]):
    lo, hi = prism["y0_dm"] / 10, (prism["y0_dm"] + prism["h_dm"]) / 10
    p, q, r, s = [a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]]
    root_tris.extend([[p, q, r], [p, r, s]])
  geometry["retained-myjump-root", "drawn"] = np.array(root_tris)
  voxel = base.read_json(voxel_path)
  cell = voxel["cell_m"]
  columns = {}
  for iz, row in enumerate(voxel["building_rows"]):
    z = voxel["grid"]["min_z_idx"] + iz
    if not -1620 < (z + 0.5) * cell < -1525:
      continue
    for x, run, low, high, _ in row:
      for offset in range(run):
        ix = voxel["grid"]["min_x_idx"] + x + offset
        if 898 < (ix + 0.5) * cell < 982:
          columns[ix, z] = [low / 10, high / 10]
  for (ix, iz), (lo, hi) in columns.items():
    for axis, step in [(0, -1), (0, 1), (2, -1), (2, 1)]:
      neighbour = (ix + step, iz) if axis == 0 else (ix, iz + step)
      if neighbour in columns:
        continue
      coordinate = ((ix if axis == 0 else iz) + (step > 0)) * cell
      along = (iz if axis == 0 else ix) * cell
      planes.append(
        dict(
          axis=axis,
          plane=coordinate,
          polygon=box(along, lo, along + cell, hi),
          chunk="1_-4",
          retainedRootColumn=[ix, iz, lo, hi],
        )
      )
  for p in [prism_path, voxel_path]:
    assets[str(p.relative_to(ROOT))] = base.digest(p)
  features, drawn_cache, native_used = [], {}, set()

  def member(
    face: dict,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    outset: float,
    colour: int,
    role: str,
  ) -> None:
    """Fit full rectangles, never a centre-only wall or a guessed native turn."""
    point = np.array(face["a"]) + np.array(face["d"]) * u
    drawn = None
    for (key, mode), triangles in geometry.items():
      if mode != "drawn":
        continue
      if key == "retained-myjump-root" and face["owner"] != "OSM-way-27830228":
        continue
      cache_key = (key, face["owner"], face["part"], face["sheet"])
      if cache_key not in drawn_cache:
        delta = triangles[:, :, [0, 2]] - np.array(face["a"])
        distance = delta @ np.array(face["n"])
        selected = np.where(np.max(np.abs(distance), axis=1) < 0.125)[0]
        along = delta @ np.array(face["d"])
        polys = [
          Polygon(np.column_stack([along[i], triangles[i, :, 1]])) for i in selected
        ]
        drawn_cache[cache_key] = unary_union([p for p in polys if p.area > 0.001])
      polygon = drawn_cache[cache_key]
      if polygon.buffer(0.012).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
        drawn = key
        break
    if drawn is None:
      return
    candidates = []
    for plane in planes:
      if "retainedRootColumn" in plane and face["owner"] != "OSM-way-27830228":
        continue
      dim, across = (0, 1) if plane["axis"] == 0 else (1, 0)
      if abs(face["n"][dim]) < 0.65 or abs(point[dim] - plane["plane"]) > 1.65:
        continue
      nw = min(w, 1.1)
      for offset in [0, -0.4, 0.4]:
        at = point[across] + offset
        if (
          not plane["polygon"]
          .buffer(0.012)
          .covers(box(at - nw / 2, y - h / 2, at + nw / 2, y + h / 2))
        ):
          continue
        p = point.copy()
        p[dim], p[across] = plane["plane"], at
        n, d = [0.0, 0.0], [0.0, 0.0]
        n[dim] = math.copysign(1.0, face["n"][dim])
        d[across] = 1.0
        candidates.append(
          (
            float(np.linalg.norm(p - point)),
            plane["chunk"],
            dict(a=p.tolist(), d=d, n=n),
            nw,
            plane["axis"],
            plane["plane"],
          )
        )
    if not candidates:
      return
    distance, native, nf, nw, axis, coordinate = min(candidates, key=lambda r: r[0])
    receipt = (
      native,
      axis,
      coordinate,
      round(nf["a"][1 if axis == 0 else 0], 1),
      round(y, 2),
      role,
    )
    if receipt in native_used:
      return
    native_used.add(receipt)
    support = drawn
    if drawn == "retained-myjump-root":
      drawn = "1_-4"
    fit.append_box(
      plans[drawn]["drawn"]["boxes"],
      plans[drawn]["drawn"]["origin"],
      face,
      point,
      0,
      y,
      w,
      h,
      depth,
      outset,
      colour,
    )
    fit.append_box(
      plans[native]["minecraft"]["boxes"],
      plans[native]["minecraft"]["origin"],
      nf,
      nf["a"],
      0,
      y,
      nw,
      h,
      depth,
      outset,
      colour,
    )
    features.append(
      dict(
        role=role,
        owner=face["owner"],
        face=face,
        point=point.tolist(),
        u=u,
        y=y,
        width=w,
        height=h,
        drawn=drawn,
        drawnSupport=support,
        native=native,
        nativeFrame=nf,
        nativeWidth=nw,
        nativeProjectionDistance=distance,
      )
    )

  # The actual complete tower envelope already exists. Add only its characteristic
  # wooden veil and the cafe's shallow glazing, at the existing source surfaces.
  owner = context["hfs"]
  for part in owner["parts"]:
    tower = part["id"] == "DEBE3Dmw8vYTObj1"
    cafe = part["id"] == "DEBE3DelauZI4HLM"
    if not tower and not cafe:
      continue
    ground = next(s for s in part["surfaces"] if s["kind"] == "GroundSurface")
    footprint = Polygon([(p[0], p[2]) for p in ground["rings"][0]])
    for si, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface" or si not in ([2, 3] if tower else [0, 5]):
        continue
      face = surface_frame(surface["rings"][0], owner["id"], part["id"], si, footprint)
      lo, hi = face["low"] + 0.18, face["high"] - 0.18
      spacing = 0.65 if tower else 1.2
      for i, u in enumerate(np.arange(0.45, face["length"] - 0.45, spacing)):
        if tower:
          member(
            face,
            u,
            (lo + hi) / 2,
            0.20,
            hi - lo,
            0.12,
            0.20,
            [0xA3957F, 0xB5A58C, 0x8C8374][i % 3],
            "hfs-timber-slat",
          )
          for level in [0.25, 0.5, 0.75]:
            member(
              face,
              u,
              lo + (hi - lo) * level,
              0.64,
              0.11,
              0.16,
              0.15,
              0x786F61,
              "hfs-timber-rail",
            )
        else:
          member(
            face,
            u,
            (lo + hi) / 2,
            1.08,
            hi - lo,
            0.06,
            0.17,
            0x7E9C9F,
            "hfs-cafe-glazing",
          )
          member(
            face,
            u - 0.53,
            (lo + hi) / 2,
            0.07,
            hi - lo,
            0.10,
            0.23,
            0xCBD0C7,
            "hfs-cafe-mullion",
          )

  # Exact retained fallback owners are used for these spatial bindings. Their
  # conflicting modern source families are deliberately not substituted.
  nodes = {n["id"]: n for n in context["nodes"]}
  bindings = {
    "OSM-way-27830228": "9282901515",
    "OSM-way-1545436689": "600118969",
    "OSM-way-1545436690": "600118966",
    "OSM-way-1545436691": "600118967",
    "OSM-way-1546060720": "600118970",
  }
  for building in context["venues"]:
    node = nodes[bindings[building["id"]]]
    poly = Polygon(
      root_ring
      if building["id"] == "OSM-way-27830228"
      else building["footprintPolygons"][0]["ring"]
    )
    p = Point(node["point"])
    edges = [
      LineString([a, b])
      for a, b in zip(poly.exterior.coords, list(poly.exterior.coords)[1:])
    ]
    edge = min(edges, key=lambda e: e.distance(p) if e.length > 6 else 1e5)
    lo = building["groundY"]
    ring = [
      [x, y, z]
      for (x, z), y in [
        (edge.coords[0], lo),
        (edge.coords[1], lo),
        (edge.coords[1], lo + 9),
        (edge.coords[0], lo + 9),
      ]
    ]
    face = surface_frame(ring, building["id"], building["id"], 0, poly)
    u = max(2.1, min(face["length"] - 2.1, edge.project(p)))
    role = "myjump" if node["id"] == "9282901515" else "db-stettiner"
    for shift in [-1.2, 0, 1.2]:
      member(
        face,
        u + shift,
        lo + 1.5,
        1.08,
        2.7,
        0.06,
        0.19,
        0x759498,
        role + "-entry-glazing-estimate",
      )
      member(
        face,
        u + shift - 0.52,
        lo + 1.5,
        0.10,
        2.9,
        0.13,
        0.24,
        0x434A4C,
        role + "-entry-frame-estimate",
      )
      member(
        face,
        u + shift,
        lo + 3.1,
        1.2,
        0.25,
        0.16,
        0.24,
        0x80618C if role == "myjump" else 0xC8C3B2,
        role + "-blank-fascia-estimate",
      )

  # Bat's photograph establishes the central entry, low side openings and the
  # three upper openings. The measured source envelope and gable remain intact.
  packet = packets["6_-3"]["drawn"]["packet"]
  original = next(
    b for b in packet["nav"]["buildings"] if b["sourceId"] == "DEBE03YY600006rz"
  )
  poly = translate(
    Polygon(original["ring"], original["holes"]),
    packet["origin"][0],
    packet["origin"][2],
  )
  a, b = [3204.47, -1350.16], [3214.28, -1344.49]
  face = surface_frame(
    [[*a[:1], 3.0, a[1]], [b[0], 3.0, b[1]], [b[0], 12.99, b[1]], [a[0], 12.99, a[1]]],
    original["sourceId"],
    original["sourceId"],
    0,
    poly,
  )
  mid = face["length"] / 2
  for shift in [-1.0, 0.0, 1.0]:
    member(
      face, mid + shift, 4.55, 0.90, 2.9, 0.06, 0.19, 0x708C8B, "bat-entry-glazing"
    )
    member(
      face,
      mid + shift - 0.46,
      4.55,
      0.09,
      3.08,
      0.13,
      0.27,
      0x5B6362,
      "bat-entry-frame",
    )
    member(face, mid + shift, 6.15, 1.0, 0.14, 0.15, 0.27, 0x77817F, "bat-entry-lintel")
  for shift in [-3.5, 0.0, 3.5]:
    y, h = (10.25, 1.15) if shift == 0 else (9.2, 1.85)
    member(face, mid + shift, y, 1.05, h, 0.06, 0.19, 0x98A9A0, "bat-upper-opening")
    member(
      face,
      mid + shift,
      y - h / 2 - 0.05,
      1.18,
      0.13,
      0.15,
      0.26,
      0xBCB7A8,
      "bat-upper-sill",
    )
    member(face, mid + shift, y, 0.06, h, 0.1, 0.25, 0xE2D9C2, "bat-upper-mullion")
  for shift in [-3.5, 3.5]:
    member(face, mid + shift, 3.7, 1.05, 0.65, 0.06, 0.19, 0x9EA79B, "bat-low-opening")
  for shift in [-3.5, -2.0, -0.5, 1.0, 2.5, 3.5]:
    member(
      face, mid + shift, 8.08, 1.1, 0.10, 0.12, 0.21, 0xC1BDAB, "bat-storey-cornice"
    )

  park_rows = []
  ground_patches = {}
  # Stone edging is a line object, not guessed furniture: exact source chain,
  # tagged height, estimated 0.28m width. Cardinal native segments follow an
  # independent raster path whose endpoints retain the mapped chain endpoints.
  for edge in context["edges"]:
    line = shape(edge["geometry"])
    for si, (a, b) in enumerate(zip(line.coords, list(line.coords)[1:])):
      if not shape(context["park"]["geometry"]).buffer(0.1).covers(LineString([a, b])):
        continue
      local = {}
      for mode in ["drawn", "minecraft"]:
        if mode == "drawn":
          segments = [(np.array(a), np.array(b))]
        else:
          count = max(1, math.ceil(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / 0.8))
          points = [
            np.array(a) + (np.array(b) - a) * i / count for i in range(count + 1)
          ]
          segments = [
            (p, np.array([q[0], p[1]])) for p, q in zip(points, points[1:])
          ] + [(np.array([q[0], p[1]]), q) for p, q in zip(points, points[1:])]
        collected = []
        for p, q in segments:
          length = float(np.linalg.norm(q - p))
          if length < 0.02:
            continue
          d = (q - p) / length
          n = np.array([-d[1], d[0]])
          centre = (p + q) / 2
          for key in ["3_-6", "4_-6", "3_-7", "4_-7"]:
            packet = packets[key][mode]["packet"]
            minx, _, minz = packet["origin"]
            if not (
              minx + 0.3 < centre[0] < minx + 511.7
              and minz + 0.3 < centre[1] < minz + 511.7
            ):
              continue
            probes = [p, q, centre]
            heights = [ground_height(pt, geometry[key, mode]) for pt in probes]
            if any(y is None for y in heights) or max(heights) - min(heights) > 0.04:
              continue
            ground_key = (key, mode, max(heights))
            if ground_key not in ground_patches:
              tris = geometry[key, mode]
              flat = tris[np.max(np.abs(tris[:, :, 1] - max(heights)), axis=1) < 0.012]
              ground_patches[ground_key] = unary_union(
                [Polygon(t[:, [0, 2]]) for t in flat]
              )
            patch = LineString([p, q]).buffer(0.14, cap_style=2)
            if not ground_patches[ground_key].buffer(0.02).covers(patch):
              continue
            collected.append(
              (
                key,
                dict(a=centre.tolist(), d=d.tolist(), n=n.tolist()),
                length,
                max(heights),
              )
            )
            break
        if len(collected) != len(
          [1 for p, q in segments if np.linalg.norm(q - p) >= 0.02]
        ):
          break
        local[mode] = collected
      if len(local) != 2:
        continue
      for mode, values in local.items():
        for key, frame, length, y in values:
          fit.append_box(
            plans[key][mode]["boxes"],
            plans[key][mode]["origin"],
            frame,
            frame["a"],
            0,
            y + 0.25,
            length,
            0.5,
            0.28,
            0,
            0xA3A49B,
          )
      park_rows.append(
        dict(
          id=edge["id"],
          segment=si,
          a=a,
          b=b,
          modes={
            m: [dict(chunk=k, frame=f, length=le, ground=y) for k, f, le, y in v]
            for m, v in local.items()
          },
        )
      )
  benches = []
  for bench in context["benches"]:
    for key in ["3_-6", "4_-6", "3_-7", "4_-7"]:
      grounds = {
        m: fh.bench_support(bench, m == "minecraft", geometry[key, m])
        for m in ["drawn", "minecraft"]
      }
      if any(y is None for y in grounds.values()):
        continue
      for mode, y in grounds.items():
        fh.bench_boxes(
          plans[key][mode]["boxes"],
          plans[key][mode]["origin"],
          bench,
          mode == "minecraft",
          y,
        )
      benches.append(dict(**bench, chunk=key, ground=grounds))
      break
  result = {}
  for key, modes in plans.items():
    modes = {m: p for m, p in modes.items() if p["boxes"]}
    if not modes:
      continue
    for mode, plan in modes.items():
      p = packets[key][mode]["packet"]
      assert len(plan["boxes"]) <= MAX_BOXES and len(p["meshes"]) < 16
      assert (
        sum(len(base64.b64decode(m["positions"])) // 6 for m in p["meshes"])
        + 24 * len(plan["boxes"])
        <= 400_000
      )
      assert (
        sum(len(base64.b64decode(m["indices"])) // 4 for m in p["meshes"])
        + 36 * len(plan["boxes"])
        <= 2_400_000
      )
      assert all(all(0 < v < 655.35 for v in row[:3]) for row in plan["boxes"])
    result[key] = modes
  base.write_json(RUNTIME, dict(schemaVersion=1, keys=sorted(result), chunks=result))
  counts = dict(Counter(f["role"] for f in features))
  base.write_json(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      inputs=context["inputs"]
      | {
        str(p.relative_to(ROOT)): base.digest(p)
        for p in [CONTEXT, ROOT / "docs/nord-mauerpark-v266-references.json"]
      },
      assets=assets,
      features=features,
      edges=park_rows,
      benches=benches,
      counts=counts,
      references=REFERENCES,
    ),
  )
  return dict(
    counts=counts,
    edges=len(park_rows),
    benches=len(benches),
    packets={k: {m: len(p["boxes"]) for m, p in v.items()} for k, v in result.items()},
    runtimeBytes=RUNTIME.stat().st_size,
  )


def ground_height(point: np.ndarray, triangles: np.ndarray) -> float | None:
  """Use only an actual horizontal delivered surface at the mapped location."""
  low, high = triangles.min(axis=1), triangles.max(axis=1)
  mask = (
    (high[:, 1] - low[:, 1] < 0.015)
    & (low[:, 1] < 10)
    & (low[:, 0] - 0.01 <= point[0])
    & (high[:, 0] + 0.01 >= point[0])
    & (low[:, 2] - 0.01 <= point[1])
    & (high[:, 2] + 0.01 >= point[1])
  )
  heights = [
    float(tri[0, 1])
    for tri in triangles[mask]
    if Polygon(tri[:, [0, 2]]).buffer(0.012).covers(Point(point))
  ]
  return max(heights) if heights else None


if __name__ == "__main__":
  import json

  print(json.dumps(build(), indent=2))
