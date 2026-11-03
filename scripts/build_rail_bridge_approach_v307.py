"""Finite Swinemuender pavement evidence and explicit legacy display-datum fit.

The first48.2446m uses measured bDOM pavement. The following bounded existing
street/sidewalk context reconciles to the legacy flat datum; its gradients are
presentation estimates, never asserted as measured Berlin terrain. Complete
existing house contours/paint survive on rigid whole-building contact pads.
"""

from __future__ import annotations

import argparse
import base64
import math
import shutil
import zipfile
from collections import Counter, defaultdict
from dataclasses import replace
from pathlib import Path

import build_surrounding_outlines as exporter
import numpy as np
import pyogrio
import shapely
from build_rail_sse_packets_v307 import triangle_keys_v307
from build_rail_sse_v307 import DATA, GEO, ROOT, read_v307, sha_v307, write_v307
from build_rail_terrain_contact_v307 import (
  _is_ground_v307,
  _merge_v307,
  complete_fields_v307,
  predecessor_parts_v307,
)
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from terrain_fields_v307 import (
  TerrainFieldV307,
  TerrainMeshV307,
  compile_ground_v307,
  polygons_v307,
  triangulate_v307,
)

TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/release-plan-v196"
)
AUDIT = TASK / "rail-v307"
CAPTURE = AUDIT / "prepared"
PROFILE = DATA / "railBridgeApproachV307Profile.json"
SOURCE = GEO / "rail-bridge-approach-v307-source.json.gz"
FIELD = "bridge-approach-v307"
TILES = ["2_-7", "3_-7", "2_-6", "3_-6"]


def smooth(t):
  t = min(1.0, max(0.0, t))
  return t * t * (3 - 2 * t)


def grid(profile, x, z, column="offsets"):
  w, n, e, s = profile["bounds"]
  if not (w <= x < e and n <= z < s):
    return 0.0
  u, v = (x - w) / 4, (z - n) / 4
  i, j, a, b = math.floor(u), math.floor(v), u % 1, v % 1
  r = profile[column]
  return (
    (r[j][i] * (1 - a) + r[j][i + 1] * (a - b) + r[j + 1][i + 1] * b)
    if a >= b
    else (r[j][i] * (1 - b) + r[j + 1][i] * (b - a) + r[j + 1][i + 1] * a)
  )


def field(profile, lower=False):
  paved = shape(profile["pavedDomain"])
  domain = paved if lower else shape(profile["domain"]).difference(paved)

  def offset(x, z, native=False):
    if native:
      x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
    if domain.distance(Point(x, z)) > 1e-7:
      return 0
    value = grid(profile, x, z, "lowerOffsets" if lower else "offsets")
    return math.ceil((3 + value) * 8 - 1e-9) / 8 - 3 if native else value

  return TerrainFieldV307(
    FIELD + (":lower" if lower else ""),
    domain,
    tuple(profile["bounds"]),
    4,
    offset,
    lambda *_: 3,
  )


def pavement_at(profile, x, z, native=False):
  line = LineString(profile["line"])
  station = line.project(Point(x, z))
  rows = profile["pavement"]
  if station <= profile["measuredLengthM"]:
    value = rows[-1][1]
    for a, b in zip(rows, rows[1:]):
      if station <= b[0]:
        t = max(0, min(1, (station - a[0]) / (b[0] - a[0])))
        value = a[1] * (1 - t) + b[1] * t
        break
  else:
    length = profile["fitEndM"] - profile["measuredLengthM"]
    t = min(1, max(0, (station - profile["measuredLengthM"]) / length))
    slope = (rows[-1][1] - rows[-2][1]) / (rows[-1][0] - rows[-2][0])
    value = (
      (2 * t**3 - 3 * t * t + 1) * rows[-1][1]
      + (t**3 - 2 * t * t + t) * length * slope
      + (-2 * t**3 + 3 * t * t) * 3.09
    )
  return native_height(value) if native else value


def build_profile():
  roads = read_v307(AUDIT / "swinemuender-approach-roads-v307.json")
  first = shape(next(r["geometry"] for r in roads if r["id"] == "way/912265511"))
  following = shape(next(r["geometry"] for r in roads if r["id"] == "way/24457236"))
  line = LineString(list(first.coords) + list(following.coords)[1:])
  p0 = np.asarray(first.coords[0])
  direction = np.asarray(first.coords[1]) - p0
  direction /= np.linalg.norm(direction)
  normal = np.array([-direction[1], direction[0]])
  domain = Polygon(
    [
      p0 + direction * s + normal * t
      for s, t in [(-28, -130), (line.length, -130), (line.length, 130), (-28, 130)]
    ]
  )

  def weight(x, z):
    relative = np.array([x, z]) - p0
    signed = float(relative @ direction)
    lateral = abs(float(relative @ normal))
    station = line.project(Point(x, z))
    return (
      smooth((signed + 28) / 24)
      * (1 - smooth((station - first.length) / (line.length - first.length)))
      * (1 - smooth((lateral - 12) / 118))
    )

  with zipfile.ZipFile(GEO / "raw/dgm/weinberg-v176/DGM1_390_5822.zip") as archive:
    with archive.open(archive.namelist()[0]) as stream:
      dgm = np.loadtxt(stream, usecols=2, dtype=np.float32).reshape(2000, 2000) - 30

  def measured(x, z):
    return round(float(dgm[math.floor(-z - 2000), math.floor(x - 500)]), 2)

  frame = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(
      domain.bounds[0] - 120,
      domain.bounds[1] - 120,
      domain.bounds[2] + 120,
      domain.bounds[3] + 120,
    ),
  )
  records = [r for r in frame.itertuples() if r.geometry.area > 2]
  pads = []
  owners = []
  for r in records:
    anchor = r.geometry.representative_point()
    w = weight(anchor.x, anchor.y)
    if w < 0.003 or not r.geometry.intersects(domain):
      continue
    base = (
      float(r.sourceGroundY)
      if math.isfinite(float(r.sourceGroundY))
      else measured(anchor.x, anchor.y)
    )
    height = round(3 + w * (base - 3), 2)
    if abs(height - 3) < 0.01:
      continue
    shells = unary_union([Polygon(p.exterior) for p in polygons_v307(r.geometry)])
    pad = shells.buffer(2)
    pads.append(
      dict(domain=mapping(pad), targetY=height, blendM=8, sourceIds=[r.sourceId])
    )
    domain = domain.union(pad.buffer(8))
    owners.append(
      dict(
        sourceId=r.sourceId,
        height=float(r.height),
        minHeight=float(r.minHeight),
        sourceGroundY=base,
        geometry=mapping(r.geometry),
        targetY=height,
        displayOffset=round(height - 3, 2),
      )
    )
  pad_shapes = [shape(p["domain"]) for p in pads]

  def target(x, z):
    value = 3 + weight(x, z) * (measured(x, z) - 3)
    point = Point(x, z)
    nearest = None
    for p, g in zip(pads, pad_shapes, strict=True):
      distance = g.distance(point)
      if distance < 8 and (nearest is None or distance < nearest[0]):
        nearest = (distance, p["targetY"])
    if nearest:
      distance, top = nearest
      alpha = 1 - smooth(distance / 8)
      value = value * (1 - alpha) + top * alpha
    return value

  bounds = [
    math.floor(v / 4) * 4 if i < 2 else math.ceil(v / 4) * 4
    for i, v in enumerate(domain.bounds)
  ]
  w, n, e, s = bounds
  offsets = []
  samples = []
  for z in range(n, s + 1, 4):
    offsets.append([round(target(x, z) - 3, 6) for x in range(w, e + 1, 4)])
    samples.extend(
      [[x, z, measured(x, z)] for x in range(w, e + 1, 4) if domain.covers(Point(x, z))]
    )
  bdom = read_v307(AUDIT / "swinemuender-approach-bdom-v307.json")
  pavement = [
    [
      station,
      next(
        q["sceneY"]
        for q in bdom["rows"]
        if q["stationM"] == station and q["lateral"] == 0
      ),
    ]
    for station in sorted({q["stationM"] for q in bdom["rows"]})
  ]
  profile = dict(
    schemaVersion=1,
    key=FIELD,
    bounds=bounds,
    step=4,
    nativeStep=4,
    domain=mapping(domain),
    offsets=offsets,
    line=list(line.coords),
    measuredLengthM=first.length,
    fitEndM=line.length,
    pavement=pavement,
    pads=pads,
    policy=__doc__,
    fitPolicy="Measured pavement only0..48.244637m. Thereafter bounded cubic display-datum reconciliation to existing3m; transverse fit includes mapped side streets and complete source-house pads. Estimated gradients are not measured road gradients.",
  )
  protected = unary_union(
    [exporter.native_polygon(shape(o["geometry"])).buffer(4.5) for o in owners]
  )
  bridge_source = GEO / "gesundbrunnen-bridge-contact-exclusions-v309-extension.json.gz"
  bridges = unary_union(
    [shape(g) for g in read_v307(bridge_source)["domains"].values()]
  )
  paved = (
    line.buffer(14, cap_style=2)
    .difference(protected)
    .difference(bridges)
    .intersection(domain)
  )
  profile["pavedDomain"] = mapping(paved)
  profile["dgmHeights"] = [
    [measured(x, z) for x in range(w, e + 1, 4)] for z in range(n, s + 1, 4)
  ]
  profile["lowerOffsets"] = [
    [
      round(min(3 + grid(profile, x, z), pavement_at(profile, x, z) - 0.4) - 3, 6)
      for x in range(w, e + 1, 4)
    ]
    for z in range(n, s + 1, 4)
  ]
  profile["pavementFit"] = dict(
    method="cubic-Hermite-display-datum-fit",
    start=[first.length, pavement[-1][1]],
    end=[line.length, 3.09],
    startSlope=(pavement[-1][1] - pavement[-2][1])
    / (pavement[-1][0] - pavement[-2][0]),
    endSlope=0,
    policy="Estimated presentation reconciliation, never a measured Berlin road gradient.",
  )
  write_v307(PROFILE, profile)
  write_v307(
    SOURCE,
    dict(
      schemaVersion=1,
      profileSha256=sha_v307(PROFILE),
      pbfRoads=[
        r
        for r in roads
        if r["id"]
        in {
          "way/912265511",
          "way/24457236",
          "way/912265507",
          "way/912265510",
          "way/1135640197",
          "way/1135640198",
          "way/730886455",
          "way/182674122",
          "way/1054376581",
        }
      ],
      bdom=bdom,
      pavementFit=profile["pavementFit"],
      dgmSamples=samples,
      dgmUrl="https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5822.zip",
      dgmSha256=sha_v307(GEO / "raw/dgm/weinberg-v176/DGM1_390_5822.zip"),
      wholeHouseOwners=owners,
      policy=__doc__,
    ),
  )
  print("profile", bounds, "area", domain.area, "whole owners", len(owners), flush=True)
  return profile, owners


def compact_part(p):
  return dict(
    mesh=p["mesh"],
    kind=p["kind"],
    retireTriangles=p["retireTriangles"],
    provenanceColumns=[
      "sourceTriangle",
      "sourceAreaM2",
      "outsideAreaM2",
      "outsideTriangles",
      "verticalSourcePlane",
      "fields",
    ],
    provenanceRows=[
      [
        v["sourceTriangle"],
        v["sourceAreaM2"],
        v["outsideAreaM2"],
        v.get("outsideTriangles", 0),
        v.get("verticalSourcePlane", False),
        v["fields"],
      ]
      for v in p["provenance"]
    ],
  )


def compile_ground(profile):
  """One source union, including pre-existing measured fields and the new fit."""
  new = field(profile)
  lower = field(profile, True)
  complete_domain = shape(profile["domain"])
  fields = [
    replace(f, domain=f.domain.difference(complete_domain))
    if f.key == "gesundbrunnen"
    else f
    for f in complete_fields_v307()
  ] + [new, lower]
  old_models = read_v307(DATA / "railTerrainContactV307.json")
  old_plans = read_v307(DATA / "railTerrainContactV307Packets.json")
  old_evidence = read_v307(GEO / "rail-terrain-contact-v307-evidence.json.gz")

  def keep(key):
    return key.split(":")[1] not in TILES

  models = [q for q in old_models["meshes"] if keep(q["key"])]
  plans = {k: v for k, v in old_plans["packets"].items() if keep(k)}
  evidence = [p for p in old_evidence["packets"] if keep(p["key"])]
  approach = []
  for native in [False, True]:
    mode = "minecraft" if native else "drawn"
    for tile in TILES:
      path = CAPTURE / f"{tile}.{mode}.json"
      capture = read_v307(path)
      result = compile_ground_v307(
        predecessor_parts_v307(capture),
        capture["origin"],
        fields,
        native=native,
        ground_predicate=lambda k, p, c: _is_ground_v307(native, k, p, c),
      )
      extra_parts = [
        p
        for p in predecessor_parts_v307(capture)
        if p["kind"] in {"street-curves-v276", "city-streets-v249"}
      ]
      if extra_parts:
        extra = compile_ground_v307(
          extra_parts,
          capture["origin"],
          [new, lower],
          native=native,
          ground_predicate=lambda _k, p, _c: (
            np.min(p[:, 1]) >= 3 and np.max(p[:, 1]) <= 3.19
          ),
        )
        result["parts"].extend(extra["parts"])
      if not result["parts"]:
        continue
      outside = TerrainMeshV307(capture["origin"])
      inside = {f.key: TerrainMeshV307(capture["origin"]) for f in fields}
      for part in result["parts"]:
        _merge_v307(outside, part["outside"])
        for key, packed in part["fields"].items():
          _merge_v307(inside[key], packed)
      required = []
      for key, m in inside.items():
        packed = m.packed()
        if packed:
          row = dict(key=f"{mode}:{tile}:{key}", native=native, field=key, **packed)
          (approach if key.startswith(FIELD) else models).append(row)
          required.append(key)
      raw, prepared = capture["pins"]["raw"], capture["pins"]["prepared"]
      packed = outside.packed()
      plan = dict(
        origin=capture["origin"],
        records=raw["records"],
        preparedRecords=prepared["records"],
        navGuard=raw["nav"],
        lineGuard=raw["lines"],
        preparedNavGuard=prepared["nav"],
        preparedLineGuard=prepared["lines"],
        retire=[
          dict(mesh=p["mesh"], triangles=p["retireTriangles"]) for p in result["parts"]
        ],
        retireLines=[],
        retireNav=[],
        appendNav=[],
        owners=["measured-ground-v307:" + key for key in required],
      )
      if packed:
        plan["append"] = {
          k: v
          for k, v in packed.items()
          if k not in ["origin", "vertices", "triangles"]
        }
        plan["append"]["kind"] = "measured-ground-outside-v307"
        h = 2166136261
        for c in (
          plan["append"]["positions"]
          + plan["append"]["colors"]
          + plan["append"]["indices"]
        ):
          h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
        plan["appendFingerprint"] = h
      key = f"{mode}:{tile}"
      plans[key] = plan
      evidence.append(
        dict(
          key=key,
          captureSha256=sha_v307(path),
          origin=capture["origin"],
          requiredFields=required,
          parts=[compact_part(p) for p in result["parts"]],
        )
      )
      print("union", key, len(plan["retire"][0]["triangles"]), flush=True)
  write_v307(
    DATA / "railTerrainContactApproachV309.json",
    dict(schemaVersion=1, fields=old_models["fields"], meshes=models),
  )

  write_v307(
    DATA / "railTerrainContactApproachV309Packets.json",
    dict(schemaVersion=1, keys=list(plans), packets=plans),
  )
  write_v307(
    DATA / "railBridgeApproachV307Ground.json", dict(schemaVersion=1, meshes=approach)
  )
  write_v307(
    GEO / "rail-terrain-contact-approach-v309-evidence.json.gz",
    dict(
      schemaVersion=1,
      baseHead=old_evidence["baseHead"],
      immutableInputs={
        str(p.relative_to(ROOT)): sha_v307(p)
        for p in [
          DATA / "railTerrainContactV307.json",
          DATA / "railTerrainContactV307Packets.json",
          GEO / "rail-terrain-contact-v307-evidence.json.gz",
        ]
      },
      fieldSources={
        **old_evidence["fieldSources"],
        str(PROFILE.relative_to(ROOT)): sha_v307(PROFILE),
      },
      packets=evidence,
      policy="One full original ground triangle partition against disjoint measured306/307 and explicitly estimated approach-datum domains. Complete immutable source outside and u16linear paint retained. Approach interiors belong only to paired BridgeRequiredroot.",
    ),
  )


def decode_capture(capture):
  pos = np.frombuffer(base64.b64decode(capture["mesh"]["positions"]), "<u2").reshape(
    -1, 3
  )
  color = np.frombuffer(base64.b64decode(capture["mesh"]["colors"]), "<u2").reshape(
    -1, 3
  )
  index = np.frombuffer(base64.b64decode(capture["mesh"]["indices"]), "<u4").reshape(
    -1, 3
  )
  return pos, color, index


def native_height(y):
  return round(math.ceil(y * 8 - 1e-9) * 12.5) / 100


def compile_houses(profile, owners):
  """Rigid complete old source-house replay; no invented house contour."""
  models = []
  plans = {}
  navigation = []
  proof = []
  owners_by_id = {o["sourceId"]: o for o in owners}
  for native in [False, True]:
    mode = "minecraft" if native else "drawn"
    for tile in TILES:
      capture = read_v307(CAPTURE / f"{tile}.{mode}.json")
      origin = np.asarray(capture["origin"])
      ox, _, oz = origin
      tile_shape = box(ox, oz, ox + 512, oz + 512)
      pos, color, final_index = decode_capture(capture)
      prepared = capture["prepared"]
      city_parts = [p for p in capture["parts"] if p["kind"] == "city"]
      by_triangle = defaultdict(list)
      for part in city_parts:
        source = prepared["meshes"][part["mesh"]]
        for ordinal, key in enumerate(triangle_keys_v307(source)):
          by_triangle[key].append((part, ordinal))
      consumed = set()
      retired = defaultdict(list)
      mesh = TerrainMeshV307(capture["origin"])
      hits = {}
      retire_nav = []
      append_nav = []
      boundaries = []
      nav_rows = [
        b for b in capture["nav"]["buildings"] if b.get("sourceId") in owners_by_id
      ]
      for old in nav_rows:
        owner = owners_by_id[old["sourceId"]]
        original = shape(owner["geometry"])
        geometry = exporter.polygonal(original.intersection(tile_shape))
        if native:
          geometry = exporter.native_polygon(geometry).intersection(tile_shape)
        if geometry.is_empty:
          continue
        delta = (
          (native_height(owner["targetY"]) - 3) if native else owner["displayOffset"]
        )
        chosen = None
        chosen_high = None
        for offset in sorted({0, old.get("groundOffset", 0)}):
          low = 3 + owner["minHeight"] + offset
          high = 3 + max(owner["height"], owner["minHeight"] + 1) + offset
          if native:
            high = 3 + offset + max(2, round((high - 3 - offset) / 2) * 2)
          outline = (
            shapely.orient_polygons(geometry, exterior_cw=True).boundary
            if native
            else shapely.orient_polygons(
              original, exterior_cw=True
            ).boundary.intersection(tile_shape)
          )
          proxy = exporter.PackedMesh(ox, oz)
          proxy.building(geometry, low, high, outline)
          wanted = Counter(triangle_keys_v307(proxy.payload("city")))
          available = Counter({k: len(v) for k, v in by_triangle.items()})
          if not wanted - available:
            chosen = wanted
            chosen_high = high
            break
        if chosen is None:
          raise ValueError(
            f"Complete actual old house not found {tile} {mode} {owner['sourceId']}"
          )
        count = 0
        for key, amount in chosen.items():
          for part, ordinal in [q for q in by_triangle[key]][:amount]:
            consumed.add((part["mesh"], ordinal))
            retired[part["mesh"]].append(ordinal)
            index_at = part["indexStart"] // 3 + ordinal
            ids = final_index[index_at]
            if len(set(map(int, ids))) == 3:
              xyz = pos[ids].astype(float) / 100 + origin
              xyz[:, 1] += delta
              mesh.add(xyz, color[ids])
              count += 1
        hits[owner["sourceId"]] = (owner, delta, chosen_high)
        retire_nav.append(old)
        new = {**old, "groundOffset": old.get("groundOffset", 0) + delta}
        append_nav.append(new)
        for poly in polygons_v307(geometry):
          navigation.append(
            dict(
              native=native,
              role="whole-existing-house",
              key=owner["sourceId"],
              ring=list(poly.exterior.coords),
              holes=[list(r.coords) for r in poly.interiors],
              low=3 + old.get("groundOffset", 0) + owner["minHeight"] + delta,
              high=3 + old.get("groundOffset", 0) + old["height"] + delta,
              sourceNav=new,
            )
          )
        boundaries.append((original.boundary, chosen_high, delta))
        proof.append(
          dict(
            mode=mode,
            tile=tile,
            sourceId=owner["sourceId"],
            sourceTriangles=sum(chosen.values()),
            deliveredVisibleTriangles=count,
            rigidOffset=delta,
            policy="Full old source XZ/paint/normals/contour retained; only rigid Y translation.",
          )
        )
      if not hits:
        continue
      # Roof and entrance details are complete existing extras, never inferred.
      for part in capture["parts"]:
        if part["kind"] not in {"roof-house-v233", "house-doors-v233"}:
          continue
        start = part["indexStart"] // 3
        count = part["indexCount"] // 3
        step = 24 if part["kind"] == "house-doors-v233" else 1
        for first in range(0, count, step):
          ordinals = list(range(first, min(first + step, count)))
          ids = np.unique(
            final_index[start + first : start + min(first + step, count)].ravel()
          )
          xyz = pos[ids].astype(float) / 100 + origin
          centre = Point(xyz[:, 0].mean(), xyz[:, 2].mean())
          choices = []
          for key, (owner, delta, high) in hits.items():
            g = shape(owner["geometry"])
            if g.buffer(2).covers(centre) and (
              part["kind"] != "roof-house-v233" or xyz[:, 1].min() >= high - 0.5
            ):
              choices.append((g.distance(centre), key, delta))
          if not choices:
            continue
          _, _key, delta = min(choices)
          for ordinal in ordinals:
            retired[part["mesh"]].append(ordinal)
            ids = final_index[start + ordinal]
            if len(set(map(int, ids))) == 3:
              p = pos[ids].astype(float) / 100 + origin
              p[:, 1] += delta
              mesh.add(p, color[ids])
      lines = []
      line_positions = []
      line_colors = []
      if not native and prepared.get("lines"):
        lp = np.frombuffer(
          base64.b64decode(prepared["lines"]["positions"]), "<u2"
        ).reshape(-1, 2, 3)
        lc = (
          np.frombuffer(base64.b64decode(prepared["lines"]["colors"]), "u1").reshape(
            -1, 2, 3
          )
          if prepared["lines"].get("colors")
          else None
        )
        for ordinal, local in enumerate(lp):
          xyz = local.astype(float) / 100 + origin
          line = LineString(xyz[:, [0, 2]])
          choices = [
            (g.distance(line), dy)
            for g, high, dy in boundaries
            if np.max(abs(xyz[:, 1] - (high + 0.02))) < 0.025
            and g.distance(line) < 0.025
          ]
          if not choices:
            continue
          dy = min(choices)[1]
          shifted = local.astype(int)
          shifted[:, 1] += round(dy * 100)
          assert shifted.min() >= 0 and shifted.max() <= 65535
          lines.append(ordinal)
          line_positions.extend(shifted.tolist())
          if lc is not None:
            line_colors.extend(lc[ordinal].tolist())
      packed = mesh.packed()
      if packed:
        models.append(
          dict(
            materials=read_v307(AUDIT / "approach-normals" / f"{tile}.{mode}.json")[
              "materials"
            ],
            key=f"{mode}:{tile}:unchanged-house-contours",
            field=FIELD,
            native=native,
            **packed,
          )
        )
      raw, pre = capture["pins"]["raw"], capture["pins"]["prepared"]
      plan = dict(
        origin=capture["origin"],
        records=raw["records"],
        preparedRecords=pre["records"],
        navGuard=raw["nav"],
        lineGuard=raw["lines"],
        preparedNavGuard=pre["nav"],
        preparedLineGuard=pre["lines"],
        retire=[dict(mesh=k, triangles=sorted(set(v))) for k, v in retired.items()],
        retireLines=lines,
        retireNav=retire_nav,
        appendNav=append_nav,
        owners=list(hits),
      )
      if line_positions:
        plan["appendLines"] = dict(
          positions=base64.b64encode(
            np.asarray(line_positions, dtype="<u2").tobytes()
          ).decode()
        )
        if line_colors:
          plan["appendLines"]["colors"] = base64.b64encode(
            np.asarray(line_colors, dtype="u1").tobytes()
          ).decode()
      plans[f"{mode}:{tile}"] = plan
      print(
        "houses",
        mode,
        tile,
        len(hits),
        sum(len(v) for v in retired.values()),
        flush=True,
      )
  write_v307(
    DATA / "railBridgeApproachV307Bodies.json",
    dict(schemaVersion=1, models=models, navigation=navigation),
  )

  write_v307(
    DATA / "railBridgeApproachV307Packets.json",
    dict(schemaVersion=1, keys=list(plans), packets=plans),
  )
  write_v307(
    GEO / "rail-bridge-approach-v307-house-evidence.json.gz",
    dict(
      schemaVersion=1,
      parts=proof,
      materialSources={
        str(p.relative_to(AUDIT)): sha_v307(p)
        for p in (AUDIT / "approach-normals").glob("*.json")
      },
      policy="All old complete house bodies plus existing roof/door extras and original outline paint replayed at rigid source-bound display pads. Complete source-outside remains; no new building contour.",
    ),
  )


def compile_pavement(profile):
  """Measured first48m, then documented fit; exact old XZ/RGB painted on caps."""
  paved = shape(profile["pavedDomain"])
  models = []
  metadata = []
  source_proof = []
  for native in [False, True]:
    mode = "minecraft" if native else "drawn"
    for tile in TILES:
      capture = read_v307(CAPTURE / f"{tile}.{mode}.json")
      origin = np.asarray(capture["origin"])
      tile_domain = paved.intersection(
        box(origin[0], origin[2], origin[0] + 512, origin[2] + 512)
      )
      if tile_domain.is_empty:
        continue
      pos, rgb, indices = decode_capture(capture)
      target = TerrainMeshV307(capture["origin"])
      floors = []
      volumes = []
      body_bottoms = defaultdict(list)
      step = 1 if native else 4
      w, n, e, s = tile_domain.bounds
      for z in range(math.floor(n / step) * step, math.ceil(s / step) * step, step):
        for x in range(math.floor(w / step) * step, math.ceil(e / step) * step, step):
          cell = box(x, z, x + step, z + step)
          if native:
            if not tile_domain.covers(Point(x + 0.5, z + 0.5)):
              continue
            region = cell
          else:
            region = tile_domain.intersection(cell)
          halves = (
            [region]
            if native
            else [
              region.intersection(Polygon(h))
              for h in [
                ((x, z), (x + step, z), (x + step, z + step)),
                ((x, z), (x + step, z + step), (x, z + step)),
              ]
            ]
          )
          for triangle in [t for half in halves for t in triangulate_v307(half)]:
            top = np.array(
              [[u, pavement_at(profile, u, v, native) - 0.14, v] for u, v in triangle]
            )
            if native:
              top[:, 1] = pavement_at(profile, x + 0.5, z + 0.5, True) - 0.14
            low = top.copy()
            base = 3 + grid(profile, x + step / 2, z + step / 2, "lowerOffsets") - 0.25
            if native:
              base = (
                native_height(
                  3
                  + grid(
                    profile,
                    math.floor((x + 0.5) / 4) * 4 + 2,
                    math.floor((z + 0.5) / 4) * 4 + 2,
                    "lowerOffsets",
                  )
                )
                - 0.25
              )
            low[:, 1] = [
              min(
                v - 0.08,
                base if native else 3 + grid(profile, u, w, "lowerOffsets") - 0.25,
              )
              for u, v, w in top
            ]
            colour = np.asarray([[10023, 10537, 10023]] * 3)
            first = len(target.indices) // 3
            target.add(top, colour)
            if len(target.indices) // 3 == first:
              continue
            bottom = len(target.indices) // 3
            target.add(low[[0, 2, 1]], colour)
            floors.append(first)
            volumes.append([first, bottom])
            body_bottoms[(x, z)].append(bottom)
            for a, b in [(0, 1), (1, 2), (2, 0)]:
              # Native cell diagonal is an internal seam, not a diagonal wall.
              if native and top[a, 0] != top[b, 0] and top[a, 2] != top[b, 2]:
                continue
              target.add(np.array([top[a], low[a], low[b]]), colour)
              target.add(np.array([top[a], low[b], top[b]]), colour)
      for part in capture["parts"]:
        if part["kind"] not in {"city", "city-streets-v249", "street-curves-v276"}:
          continue
        start = part["indexStart"] // 3
        count = part["indexCount"] // 3
        for ordinal in range(count):
          ids = indices[start + ordinal]
          if len(set(map(int, ids))) < 3:
            continue
          points = pos[ids].astype(float) / 100 + origin
          if points[:, 1].min() < 2.99 or points[:, 1].max() > 3.19:
            continue
          footprint = Polygon(points[:, [0, 2]])
          if footprint.area < 1e-8 or not footprint.intersects(tile_domain):
            continue
          cut = footprint.intersection(tile_domain)
          x0, z0, x1, z1 = cut.bounds
          inverse = np.linalg.inv(np.vstack((points[:, [0, 2]].T, np.ones(3))))
          delivered = 0
          for z in range(
            math.floor(z0 / step) * step, math.ceil(z1 / step) * step, step
          ):
            for x in range(
              math.floor(x0 / step) * step, math.ceil(x1 / step) * step, step
            ):
              if native and not tile_domain.covers(Point(x + 0.5, z + 0.5)):
                continue
              for tri in triangulate_v307(
                cut.intersection(box(x, z, x + step, z + step))
              ):
                weights = np.c_[tri, np.ones(3)] @ inverse.T
                xyz = weights @ points
                if native:
                  lift = round(float(points[:, 1].mean()) * 100) / 100 - 3.09
                  xyz[:, 1] = pavement_at(profile, x + 0.5, z + 0.5, True) + lift
                else:
                  xyz[:, 1] = [
                    pavement_at(profile, u, v) + (old - 3.09) for u, old, v in xyz
                  ]
                if np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0])[1] < 0:
                  xyz, weights = xyz[[0, 2, 1]], weights[[0, 2, 1]]
                first = len(target.indices) // 3
                target.add(xyz, weights @ rgb[ids])
                if len(target.indices) // 3 > first:
                  floors.append(first)
                  if body_bottoms.get((x, z)):
                    volumes.append([first, *body_bottoms[(x, z)]])
                  delivered += 1
                  for ai, bi in [(0, 1), (1, 2), (2, 0)]:
                    edge = LineString(xyz[[ai, bi]][:, [0, 2]])
                    if native and xyz[ai, 0] != xyz[bi, 0] and xyz[ai, 2] != xyz[bi, 2]:
                      continue
                    boundary = (
                      edge.difference(tile_domain.boundary.buffer(0.015)).length < 0.02
                      or edge.difference(footprint.boundary.buffer(0.015)).length < 0.02
                    )
                    step_edge = False
                    if native:
                      centre = edge.interpolate(0.5, normalized=True)
                      outside = not tile_domain.covers(
                        Point(
                          centre.x + (centre.x - (x + 0.5)) * 0.02,
                          centre.y + (centre.y - (z + 0.5)) * 0.02,
                        )
                      )
                      step_edge = (
                        outside
                        or min(
                          pavement_at(profile, centre.x + dx, centre.y + dz, True)
                          for dx, dz in [(-0.51, 0), (0.51, 0), (0, -0.51), (0, 0.51)]
                        )
                        < float(xyz[ai, 1]) - 0.005
                      )
                    if not boundary and not step_edge:
                      continue
                    upper = xyz[[ai, bi]]
                    lower = upper.copy()
                    lower[:, 1] -= 0.22
                    paint = (weights @ rgb[ids])[[ai, bi]]
                    target.add(
                      np.array([upper[0], lower[0], lower[1]]),
                      np.array([paint[0], paint[0], paint[1]]),
                    )
                    target.add(
                      np.array([upper[0], lower[1], upper[1]]),
                      np.array([paint[0], paint[1], paint[1]]),
                    )
          source_proof.append(
            dict(
              mode=mode,
              tile=tile,
              mesh=part["mesh"],
              sourceTriangle=ordinal,
              delivered=delivered,
              captureSha256=sha_v307(CAPTURE / f"{tile}.{mode}.json"),
            )
          )
      packed = target.packed()
      if packed:
        key = f"{mode}:{tile}:measured-pavement-and-explicit-datumfit"
        models.append(
          dict(
            key=key,
            field=FIELD,
            native=native,
            materials=read_v307(AUDIT / "approach-normals" / f"{tile}.{mode}.json")[
              "materials"
            ],
            **packed,
          )
        )
        metadata.append(dict(key=key, native=native, floors=floors, volumes=volumes))
      print("pavement", mode, tile, len(target.indices) // 3, flush=True)
  write_v307(
    DATA / "railBridgeApproachV307Pavement.json",
    dict(schemaVersion=1, models=models, contacts=metadata),
  )
  write_v307(
    GEO / "rail-bridge-approach-v307-pavement-evidence.json.gz",
    dict(
      schemaVersion=1,
      measuredProfile=profile["pavement"],
      measuredEndM=profile["measuredLengthM"],
      estimatedFitEndM=profile["fitEndM"],
      sources=source_proof,
      policy="Old source XZ and complete u16linear paint retained on exact profile caps. First48.2446m is bDOM pavement; continuation and lateral context are a declared legacy display-datum fit. Lower solid substrate is a display estimate, never a measured bridge extension.",
    ),
  )


def compile_navigation():
  ground = read_v307(DATA / "railBridgeApproachV307Ground.json")
  pavement = read_v307(DATA / "railBridgeApproachV307Pavement.json")
  bodies = read_v307(DATA / "railBridgeApproachV307Bodies.json")
  metadata = {r["key"]: r for r in pavement["contacts"]}
  models = []
  for model in ground["meshes"] + pavement["models"]:
    p = (
      np.frombuffer(base64.b64decode(model["positions"]), "<u2")
      .reshape(-1, 3)
      .astype(float)
      / 100
      + model["origin"]
    )
    ix = np.frombuffer(base64.b64decode(model["indices"]), "<u4").reshape(-1, 3)
    cellmap = defaultdict(list)
    selected = (
      metadata[model["key"]]["floors"]
      if model["key"] in metadata
      else np.flatnonzero(
        abs(np.cross(p[ix][:, 1] - p[ix][:, 0], p[ix][:, 2] - p[ix][:, 0])[:, 1]) > 1e-7
      ).tolist()
    )
    for ordinal in selected:
      if ordinal >= len(ix):
        raise ValueError("A pavement contact ordinal escaped its actual mesh")
      triangle = p[ix[ordinal]]
      low = triangle[:, [0, 2]].min(axis=0)
      high = triangle[:, [0, 2]].max(axis=0)
      for z in range(math.floor(low[1] / 4), math.floor(high[1] / 4) + 1):
        for x in range(math.floor(low[0] / 4), math.floor(high[0] / 4) + 1):
          cellmap[f"{x},{z}"].append(int(ordinal))
    runs = {}
    for key, values in cellmap.items():
      rows = []
      for n in sorted(set(values)):
        if rows and rows[-1][0] + rows[-1][1] == n:
          rows[-1][1] += 1
        else:
          rows.append([n, 1])
      runs[key] = rows
    models.append(
      dict(
        key=model["key"],
        native=model["native"],
        cells=runs,
        volumes=metadata.get(model["key"], {}).get("volumes", []),
      )
    )
  write_v307(
    DATA / "railBridgeApproachV307Navigation.json",
    dict(
      schemaVersion=1,
      models=models,
      houses=bodies["navigation"],
      modelSources={
        str(p.relative_to(ROOT)): sha_v307(p)
        for p in [
          DATA / "railBridgeApproachV307Ground.json",
          DATA / "railBridgeApproachV307Pavement.json",
          DATA / "railBridgeApproachV307Bodies.json",
        ]
      },
      policy="Exact actual render-mesh face ordinals and small4m run index. Runtime uses actual privateRoot geometry, no second decoded position/index arrays.",
    ),
  )


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--profile-only", action="store_true")
  parser.add_argument("--bodies-only", action="store_true")
  parser.add_argument("--ground-only", action="store_true")
  parser.add_argument("--pavement-only", action="store_true")
  parser.add_argument("--navigation-only", action="store_true")
  args = parser.parse_args()
  for mode in ["drawn", "minecraft"]:
    target = CAPTURE / f"3_-6.{mode}.json"
    if not target.exists():
      shutil.copy2(AUDIT / "approach-prepared" / target.name, target)
  if args.navigation_only:
    compile_navigation()
    return
  if args.bodies_only or args.ground_only or args.pavement_only:
    profile = read_v307(PROFILE)
    owners = read_v307(SOURCE)["wholeHouseOwners"]
  else:
    profile, owners = build_profile()
  if args.pavement_only:
    compile_pavement(profile)
  elif args.bodies_only:
    compile_houses(profile, owners)
  elif not args.profile_only:
    compile_ground(profile)
    if not args.ground_only:
      compile_houses(profile, owners)
      compile_pavement(profile)


if __name__ == "__main__":
  main()
