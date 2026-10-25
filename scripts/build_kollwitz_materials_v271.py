"""Step 10: Kollwitz and northern Kastanienallee ordinary-house colour receipts."""

from __future__ import annotations

import base64
import re
from collections import Counter, defaultdict

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_outer_materials_v232 as previous

base, appearance = previous.base, previous.appearance
ROOT, GEO, OUT = previous.ROOT, previous.GEO, previous.OUT
OUTPUT = ROOT / "src/app/src/data/kollwitzMaterialsV271.json"
INDEX = ROOT / "src/app/src/data/kollwitzMaterialsV271Index.json"
EVIDENCE = GEO / "kollwitz-materials-v271-evidence.json.gz"
CONTEXT = GEO / "kollwitz-materials-v271-context.json.gz"
SOURCE = GEO / "raw/north-city-v190/candidate.gpkg"
STREETS = GEO / "kiez-facades-v209-context.json.gz"
SHOPS = ROOT / "src/app/src/data/northShopfrontsV254.json"
FACADES = GEO / "kiez-facades-v209-evidence.json.gz"
TILES = ("5_-5", "5_-4", "6_-5", "6_-4", "7_-5", "7_-4")
# Same finite Kollwitzkiez area as the retained v209 street-front pass.
BOUNDS = (2850, -2450, 3700, -1610)
KASTANIEN_CLIP = (2560, -2450, 2850, -1900)
KASTANIEN_FRONT_DISTANCE = 25
KASTANIEN_COMPLETE_DISTANCE = 75
WALLS = (
  0xE8DDC7,
  0xDCC5A6,
  0xEEE8D8,
  0xCDD4C3,
  0xDDBDB3,
  0xC4D1D0,
  0xE5CF9E,
  0xD4D1C7,
  0xE7D4BD,
  0xCFC2B3,
  0xDCDCCF,
  0xD8C4C8,
)
ROOFS = (0x7B6961, 0x8E7165, 0x6B7376, 0x8F6953, 0x68716B, 0x9B7E6D, 0x665F58, 0x838282)
POLICY = (
  "Six retained numeric city packets in the frozen v209 Kollwitzkiez area and "
  "the mapped northern Kastanienallee course only. Its complete source owners "
  "must approach the actual road within 25m and stay wholly within 75m of it. "
  "Require a unique reciprocal >=97% match to an unnamed ordinary mapped house, "
  "or its already verified v188/v209 street-front identity. Only exact original "
  "generic wall/cap triangles with unanimous incident-face ownership may change. "
  "Mapped colours/materials and authored models are protected. Unknown paint is "
  "an explicit coherent display estimate, not surveyed per-building colour. "
  "Preserve all original packet bytes, geometry, measured heights/roofs, windows, "
  "cornices, navigation, native geometry and runtime limits. No extra GPU storage."
)


def rgb(hex_value: int) -> tuple[int, int, int]:
  """Convert an explicit sRGB display swatch without asserting source material."""
  return hex_value >> 16, (hex_value >> 8) & 255, hex_value & 255


def swatches(owner: str) -> tuple[tuple, tuple]:
  """Stable per-source fallback, independent of packet clipping or iteration."""
  hashed = 2166136261
  for char in owner:
    hashed = ((hashed ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return rgb(WALLS[hashed % len(WALLS)]), rgb(ROOFS[(hashed >> 16) % len(ROOFS)])


def kastanien_courses() -> tuple[list[dict], BaseGeometry]:
  """Retain only the real named road east of the v169 source boundary."""
  roads = []
  for row in base.read_json(STREETS)["roads"]:
    if row["name"] != "Kastanienallee":
      continue
    geometry = shape(row["geometry"]).intersection(box(*KASTANIEN_CLIP))
    if not geometry.is_empty and geometry.length > 0.01:
      roads.append(dict(id=row["id"], name=row["name"], geometry=mapping(geometry)))
  return roads, unary_union([shape(row["geometry"]) for row in roads])


def owner_zone(geometry: BaseGeometry, course: BaseGeometry) -> str | None:
  """Select whole owners; never paint a clipped strip through one building."""
  if box(*BOUNDS).covers(geometry):
    return "Kollwitzkiez"
  if geometry.distance(course) <= KASTANIEN_FRONT_DISTANCE and course.buffer(
    KASTANIEN_COMPLETE_DISTANCE
  ).covers(geometry):
    return "northern Kastanienallee"
  return None


def extract_context() -> None:
  """Freeze only bounded non-personal OSM usage/material evidence."""
  roads, course = kastanien_courses()
  scope = box(*BOUNDS).union(course.buffer(KASTANIEN_COMPLETE_DISTANCE))
  frame = pyogrio.read_dataframe(
    SOURCE, layer="multipolygons", bbox=(13.405, 52.532, 13.428, 52.544)
  ).to_crs(25833)
  records = []
  for row in frame.itertuples():
    if not isinstance(row.building, str):
      continue
    geometry = base.world(row.geometry)
    if not geometry.is_valid or not geometry.intersects(scope):
      continue
    tags = dict(re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', str(row.other_tags)))
    tags = {key: value for key, value in tags.items() if key in previous.KEYS}
    ordinary = row.building in {
      "yes",
      "apartments",
      "residential",
      "house",
      "terrace",
      "detached",
      "semidetached_house",
    } and not any(
      isinstance(getattr(row, key), str) for key in ("name", "amenity", "tourism")
    )
    osm = (
      "OSM-way-" + str(row.osm_way_id)
      if isinstance(row.osm_way_id, str)
      else "OSM-relation-" + str(row.osm_id)
    )
    records.append(
      dict(
        id=osm,
        building=row.building,
        ordinary=ordinary,
        tags=tags,
        geometry=mapping(geometry),
      )
    )
  base.write_json(
    CONTEXT,
    dict(
      source=SOURCE.relative_to(ROOT).as_posix(),
      sha256=appearance.digest(SOURCE),
      northernKastanienRoads=roads,
      streetContextSha256=appearance.digest(STREETS),
      records=records,
    ),
  )


def protected_owners() -> tuple[set[str], set[str]]:
  """Preserve authored sites; plain old window recipes do not own wall paint."""
  owners = set(base.read_json(GEO / "kiez-facades-v209-context.json.gz")["authoredIds"])
  # These records own shop glazing/frames only, not the generic shell's paint.
  # All their triangles remain untouched; another actual model/material source
  # still protects an owner through the other independently scanned inputs.
  kastanien_shops = {
    row["owner"]
    for row in base.read_json(SHOPS)["drawn"]
    if row["street"] == "Kastanienallee"
  }
  for pattern in (
    "src/app/src/data/*.json",
    "src/app/src/*.ts",
    "src/app/src/*Source.json",
    "src/app/src/*Prisms.json",
  ):
    for path in ROOT.glob(pattern):
      if (
        path.name in {"buildingAttributeSource.json", OUTPUT.name}
        or "V271" in path.name
      ):
        continue
      identities = set(
        re.findall(r"\b(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+)", path.read_text())
      )
      owners.update(identities - kastanien_shops if path == SHOPS else identities)
  for name in ("outer-materials-v232", "outer-materials-v254", "outer-materials-v263"):
    owners.update(base.read_json(GEO / f"{name}-evidence.json.gz")["owners"])
  front_owners = set()
  for name in ("district-facades-v188", "kiez-facades-v209"):
    front_owners.update(
      row["owner"] for row in base.read_json(GEO / f"{name}-evidence.json.gz")["faces"]
    )
  return owners, front_owners


def select_owners(
  packets: dict, context: dict, protected: set[str], fronts: set[str]
) -> dict:
  """Bind complete retained source owners to positive ordinary-house evidence."""
  outlines = defaultdict(list)
  for packet in packets.values():
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      if (
        row["sourceId"] in protected
        or row["minHeight"] > 0.1
        or not 6 <= row["height"] <= 40
      ):
        continue
      geometry = translate(Polygon(row["ring"], row["holes"]), ox, oz)
      if geometry.is_valid and not geometry.is_empty:
        outlines[row["sourceId"]].append(geometry)
  shapes = [shape(row["geometry"]) for row in context["records"]]
  course = unary_union(
    [shape(row["geometry"]) for row in context["northernKastanienRoads"]]
  )
  tree = STRtree(shapes)
  selected = {}
  for owner, parts in sorted(outlines.items()):
    geometry = unary_union(parts)
    zone = owner_zone(geometry, course)
    if zone is None:
      continue
    matches, blocked = [], False
    for index in tree.query(geometry):
      record = context["records"][index]
      overlap = geometry.intersection(shapes[index]).area
      if overlap <= 0.1:
        continue
      coverage = [overlap / geometry.area, overlap / shapes[index].area]
      if (not record["ordinary"] or record["tags"]) and coverage[0] > 0.05:
        blocked = True
      if record["ordinary"] and not record["tags"] and min(coverage) >= 0.97:
        matches.append((int(index), coverage))
    if blocked or (len(matches) != 1 and owner not in fronts):
      continue
    wall, roof = swatches(owner)
    proof = dict(kind="retained ordinary street-front owner", facadeOwner=owner)
    if len(matches) == 1:
      index, coverage = matches[0]
      proof = dict(
        kind="complete reciprocal OSM footprint",
        osm=context["records"][index]["id"],
        coverage=coverage,
      )
    selected[owner] = dict(
      wall=wall,
      roof=roof,
      evidence=proof,
      bounds=list(geometry.bounds),
      estimatedPaint=True,
      zone=zone,
    )
  return selected


def changed_owners(part: dict, packet: dict, changed: dict, selected: dict) -> set[str]:
  """Count owners only after connected-face rejection, using surviving faces."""
  positions = (
    np.frombuffer(base64.b64decode(part["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + packet["origin"]
  )
  colours = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  ox, _, oz = packet["origin"]
  rows = []
  for record in packet["nav"]["buildings"]:
    polygon = translate(Polygon(record["ring"], record["holes"]), ox, oz)
    if not polygon.is_valid or polygon.is_empty:
      continue
    low = packet["nav"]["groundY"] + record.get("groundOffset", 0) + record["minHeight"]
    high = packet["nav"]["groundY"] + record.get("groundOffset", 0) + record["height"]
    rows.append((record["sourceId"], polygon, low, high))
  tree = STRtree([polygon.buffer(0.018) for _, polygon, _, _ in rows])
  owners = set()
  for triangle in indices:
    if not all(int(vertex) in changed for vertex in triangle):
      continue
    points = positions[triangle]
    tone = tuple(colours[triangle[0]])
    candidates = set()
    for index in tree.query(Point(np.mean(points[:, [0, 2]], axis=0))):
      owner, polygon, low, high = rows[index]
      fits = (
        (
          np.max(np.abs(points[:, 1] - high)) <= 0.018
          and polygon.buffer(0.018).covers(Polygon(points[:, [0, 2]]))
        )
        if tone == previous.ROOF
        else (
          abs(points[:, 1].min() - low) <= 0.018
          and abs(points[:, 1].max() - high) <= 0.018
          and polygon.boundary.buffer(0.018).covers(LineString(points[:, [0, 2]]))
        )
      )
      if fits:
        candidates.add(owner)
    assert len(candidates) == 1 and candidates <= set(selected)
    owners.update(candidates)
  return owners


def build() -> dict:
  """Compile small exact colour receipts; source geometry remains immutable."""
  if not CONTEXT.exists():
    extract_context()
  context = base.read_json(CONTEXT)
  protected, fronts = protected_owners()
  drawn = {tile: base.read_json(OUT / f"{tile}.drawn.json.gz") for tile in TILES}
  selected = select_owners(drawn, context, protected, fronts)
  output = dict(schemaVersion=1, palette=[], packets={})
  palette_lookup, assets, accepted, counts = {}, [], set(), Counter()
  unresolved = Counter()
  for tile in TILES:
    for family in ("drawn", "minecraft"):
      path = OUT / f"{tile}.{family}.json.gz"
      packet = drawn[tile] if family == "drawn" else base.read_json(path)
      corners = defaultdict(set)
      for row in packet["nav"]["buildings"]:
        for ring in [row["ring"], *row["holes"]]:
          for x, z in ring:
            corners[(int(np.floor(x * 100 + 0.5)), int(np.floor(z * 100 + 0.5)))].add(
              row["sourceId"]
            )
      receipts = []
      for mesh, part in enumerate(packet["meshes"]):
        if part["kind"] != "city":
          continue
        values, owners = previous.owned_colours(
          part, packet, selected, family == "minecraft"
        )
        if not values:
          continue
        visible = changed_owners(part, packet, values, selected)
        assert visible <= owners
        accepted.update(visible)
        counts[family + "Vertices"] += len(values)
        positions = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(
          -1, 3
        )
        unresolved[family] += sum(
          len(corners[(int(positions[v, 0]), int(positions[v, 2]))]) != 1
          for v in values
        )
        runs = appearance.runs_for(values, output["palette"], palette_lookup)
        receipts.append(
          dict(
            mesh=mesh,
            fingerprint=appearance.fingerprint(part),
            runs=base64.b64encode(np.array(runs, "<u4").tobytes()).decode(),
          )
        )
      if receipts:
        output["packets"][family + ":" + tile] = receipts
      assets.append(dict(url=path.name, sha256=appearance.digest(path)))
  evidence = dict(
    policy=POLICY,
    bounds=BOUNDS,
    tiles=TILES,
    northernKastanienRoads=context["northernKastanienRoads"],
    northernKastanienStreetContextSha256=context["streetContextSha256"],
    contextSha256=appearance.digest(CONTEXT),
    protectedOwners=sorted(protected),
    owners={key: selected[key] for key in sorted(accepted)},
    assets=assets,
    counts=dict(counts),
    ownerCountsByZone=dict(Counter(selected[owner]["zone"] for owner in accepted)),
    previouslyUnresolvedCornerVertices=dict(unresolved),
    existingFacadeOwners=sorted(accepted & fronts),
    northernKastanienPreservedFronts=sorted(
      {
        row["owner"]
        for row in base.read_json(FACADES)["faces"]
        if row["streetName"] == "Kastanienallee" and row["chunk"] in {"5_-4", "5_-5"}
      }
    ),
    preservedFittingSources=[
      dict(path=path.relative_to(ROOT).as_posix(), sha256=appearance.digest(path))
      for path in [
        SHOPS,
        FACADES,
        *[
          OUT / f"kiez209-{tile}.{family}.json.gz"
          for tile in ("5_-4", "5_-5")
          for family in ("drawn", "minecraft")
        ],
      ]
    ],
    fallbackWallSwatches=list(WALLS),
    fallbackRoofSwatches=list(ROOFS),
  )
  base.write_json(OUTPUT, output)
  base.write_json(INDEX, dict(keys=list(output["packets"])))
  base.write_json(EVIDENCE, evidence)
  print(
    dict(
      owners=len(accepted),
      packets=len(output["packets"]),
      existingFacadeOwners=len(accepted & fronts),
      bytes=OUTPUT.stat().st_size,
      **counts,
    ),
    flush=True,
  )
  return evidence


if __name__ == "__main__":
  build()
