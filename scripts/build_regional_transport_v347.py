"""Step 10: complete mapped A10 junctions and current BER aviation fittings."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import struct
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from build_karl_marx_allee_v161 import Detail, packed_detail
from build_region_outlines_v200 import nav_polys, world
from build_surrounding_outlines import line_parts
from build_west_streets_v163 import partition_detail
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
A10_SOURCE = GEO / "a10-transport-v347-source.json.gz"
BER_SOURCE = GEO / "ber-fittings-v347-source.json.gz"


def base85(raw: bytes) -> str:
  """Existing losslessGzipBase85 wire alphabet; build time only."""
  alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#"
  padding = (4 - len(raw) % 4) % 4
  result = [str(padding)]
  raw += bytes(padding)
  for at in range(0, len(raw), 4):
    word, word_string = int.from_bytes(raw[at : at + 4], "big"), ""
    for _ in range(5):
      word, digit = divmod(word, 85)
      word_string = alphabet[digit] + word_string
    result.append(word_string)
  return "".join(result)


def encoded(value: Any) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def read(path: Path) -> Any:
  value = path.read_bytes()
  return json.loads(gzip.decompress(value) if path.suffix == ".gz" else value)


def write(path: Path, value: Any) -> None:
  payload = encoded(value)
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(payload, mtime=0) if path.suffix == ".gz" else payload)


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(raw: Path) -> None:
  current = read(raw / "a10-assembled-current.json.gz")
  nodes = {r["id"]: r for r in current["elements"] if r["type"] == "node"}
  ways = [r for r in current["elements"] if r["type"] == "way"]
  projected = {
    w["id"]: LineString([world(nodes[n]["lon"], nodes[n]["lat"]) for n in w["nodes"]])
    for w in ways
  }
  main = [
    w
    for w in ways
    if w["tags"].get("ref") == "A 10" and w["tags"].get("highway") == "motorway"
  ]
  ring = unary_union([projected[w["id"]] for w in main])
  # Full source ways are archived. Only the finite 2 km junction approach
  # corridor can be drawn; the region between motorways is never filled.
  corridor = ring.buffer(2000)
  records = []
  for w in ways:
    is_main = w in main
    g = projected[w["id"]]
    selected = g if is_main else g.intersection(corridor)
    if selected.is_empty:
      continue
    records.append(
      dict(
        id=f"way/{w['id']}",
        main=is_main,
        nodes=w["nodes"],
        tags=w["tags"],
        geometry=mapping(g),
        renderGeometry=mapping(selected),
        version=w.get("version"),
        timestamp=w.get("timestamp"),
      )
    )
  old = read(GEO / "region-outlines-v200-source.json.gz")
  old_main = {r["id"]: r for r in old["features"] if r["site"] == "A10"}
  same = [
    r["id"]
    for r in records
    if r["main"]
    and r["id"] in old_main
    and r["nodes"] == old_main[r["id"]]["nodes"]
    and shape(r["geometry"]).equals_exact(
      transform(world, shape(old_main[r["id"]]["geometry"])), 0.00001
    )
  ]
  write(
    A10_SOURCE,
    dict(
      schemaVersion=1,
      retrievedDate="2026-11-15",
      license="OpenStreetMap contributors, ODbL-1.0",
      frame="EPSG:25833 x=easting-389500,z=5820000-northing",
      sourceRoot="https://api.openstreetmap.org/api/0.6/relation/21105/full.json",
      rawSha256=digest(raw / "a10-assembled-current.json.gz"),
      junctionQueries=current["junctionBoxes"],
      endpointWitnesses=current.get("endpointWitnesses", []),
      rampEndpoints=current.get("rampEndpoints", []),
      relations=[r for r in current["elements"] if r["type"] == "relation"],
      junctions=[
        dict(
          id=f"node/{n['id']}",
          tags=n.get("tags", {}),
          point=list(world(n["lon"], n["lat"])),
        )
        for n in nodes.values()
        if n.get("tags", {}).get("highway") == "motorway_junction"
      ],
      previousMainGeometryUnchanged=sorted(same),
      records=sorted(records, key=lambda r: r["id"]),
    ),
  )

  site = read(GEO / "ber-v236-manifest-addition.json")
  ground = unary_union([Polygon(p["ring"], p["holes"]) for p in site["footprint"]])
  records, excluded = [], []
  for e in ET.parse(raw / "ber-current.osm").getroot():
    tags = {t.get("k"): t.get("v") for t in e.findall("tag")}
    if e.tag != "node" or tags.get("aeroway") not in {
      "navigationaid",
      "holding_position",
      "parking_position",
      "gate",
    }:
      continue
    x, z = world(float(e.get("lon")), float(e.get("lat")))
    record = dict(
      id=f"node/{e.get('id')}",
      point=[x, z],
      tags=tags,
      version=e.get("version"),
      timestamp=e.get("timestamp"),
    )
    if not ground.covers(Point(x, z)):
      excluded.append(record)
      continue
    records.append(record)
  write(
    BER_SOURCE,
    dict(
      schemaVersion=1,
      retrievedDate="2026-11-15",
      license="OpenStreetMap contributors, ODbL-1.0",
      sourceUrl="https://api.openstreetmap.org/api/0.6/map?bbox=13.48,52.34,13.55,52.385",
      rawSha256=digest(raw / "ber-current.osm"),
      retainedGroundSha256=digest(GEO / "ber-v236-manifest-addition.json"),
      records=records,
      outsideRetainedGround=excluded,
      currentTerminalStatus="T1/T2 operational; T5 closed since February 2021 and will not reopen; current operator reference checked 2026-11-15",
      references=[
        "https://corporate.berlin-airport.de/de/unternehmen-presse/ber/flughafenanlagen.html",
        "https://corporate.berlin-airport.de/content/dam/corporate/de/unternehmen-presse/ber/flughafenanlagen-ber.pdf",
        "https://www.faa.gov/Air_traffic/publications/atpubs/aim_html/chap2_section_1.html",
      ],
    ),
  )


def cycles(records: list[dict]) -> list[int]:
  main = [r for r in records if r["main"]]
  onward = {r["nodes"][0]: r["nodes"][-1] for r in main}
  assert len(onward) == len(main) and set(onward) == set(onward.values())
  left = set(onward)
  sizes = []
  while left:
    start = current = next(iter(left))
    count = 0
    while current in left:
      left.remove(current)
      count += 1
      current = onward[current]
    assert current == start
    sizes.append(count)
  return sorted(sizes)


def road_width(tags: dict) -> tuple[float, str]:
  if tags.get("width"):
    try:
      return float(tags["width"].split()[0]), "OSM width"
    except ValueError:
      pass
  lanes = float(tags.get("lanes", 1 if tags.get("highway", "").endswith("link") else 2))
  return (
    lanes * 3.5 + (2.5 if tags.get("highway") == "motorway" else 1.5),
    "mapped lanes × 3.5m + estimated shoulders"
    if "lanes" in tags
    else "explicit lane/shoulder estimate",
  )


def a10_build() -> dict:
  source = read(A10_SOURCE)
  groups = defaultdict(lambda: dict(positions=[], colors=[], features=[]))
  for record in source["records"]:
    g = shape(record["renderGeometry"])
    tags = record["tags"]
    centre = g.representative_point()
    key = f"a10-v347-{math.floor(centre.x / 10000)}-{math.floor(centre.y / 10000)}"
    group = groups[key]
    first = len(group["positions"]) // 3
    width, width_source = road_width(tags)
    paths = [] if record["main"] else list(line_parts(g))
    for line in line_parts(g):
      for side in [-1, 1]:
        paths.extend(
          line_parts(line.offset_curve(side * width / 2, join_style="round"))
        )
    # Cartographic grade only, matching V200; no unsupported road deck/bridge.
    colour = (
      (138, 124, 96)
      if tags.get("bridge") == "yes"
      else (101, 113, 106)
      if record["main"]
      else (126, 137, 119)
    )
    for path in paths:
      pts = list(path.coords)
      for a, b in zip(pts, pts[1:]):
        if a == b:
          continue
        group["positions"].extend(
          [
            round(a[0] * 100),
            309,
            round(a[1] * 100),
            round(b[0] * 100),
            309,
            round(b[1] * 100),
          ]
        )
        group["colors"].extend(colour * 2)
    group["features"].append(
      dict(
        id=record["id"],
        main=record["main"],
        firstVertex=first,
        vertexCount=len(group["positions"]) // 3 - first,
        widthM=width,
        widthSource=width_source,
        bridge=tags.get("bridge"),
        layer=tags.get("layer"),
        tunnel=tags.get("tunnel"),
        ref=tags.get("ref"),
      )
    )
  payload = []
  for key, g in sorted(groups.items()):
    raw = encoded(
      dict(
        positionsCm=base64.b64encode(
          struct.pack(f"<{len(g['positions'])}i", *g["positions"])
        ).decode(),
        colorsU8=base64.b64encode(bytes(g["colors"])).decode(),
      )
    )
    assert len(raw) < 2 * 1024**2
    payload.append(
      dict(
        key=key, decodedBytes=len(raw), gzipBase85=base85(gzip.compress(raw, mtime=0))
      )
    )
  write(
    GEO / "a10-transport-v347-feature-ranges.json",
    dict(
      groups=[
        dict(key=key, features=g["features"]) for key, g in sorted(groups.items())
      ]
    ),
  )
  output = DATA / "a10TransportV347.json"
  write(output, dict(schemaVersion=1, sourceSha256=digest(A10_SOURCE), groups=payload))
  complete = unary_union([shape(r["renderGeometry"]) for r in source["records"]])
  scope = complete.buffer(20, quad_segs=1, join_style="mitre")
  write(
    GEO / "a10-transport-v347-scope.json",
    dict(
      bounds=list(scope.bounds),
      footprint=nav_polys(scope),
      groundY=3,
      scope="Only exact mapped courses plus20m cartographic navigation margin, no regional land fill",
    ),
  )
  report = dict(
    sourceSha256=digest(A10_SOURCE),
    outputSha256=digest(output),
    cycles=cycles(source["records"]),
    mainWays=sum(r["main"] for r in source["records"]),
    addedJunctionWays=sum(not r["main"] for r in source["records"]),
    mainLengthM=sum(
      shape(r["geometry"]).length for r in source["records"] if r["main"]
    ),
    junctionLengthM=sum(
      shape(r["renderGeometry"]).length for r in source["records"] if not r["main"]
    ),
    previousMainGeometryUnchanged=len(source["previousMainGeometryUnchanged"]),
    bridgeWays=sum(r["tags"].get("bridge") == "yes" for r in source["records"]),
    vertices=sum(len(g["positions"]) // 3 for g in groups.values()),
    geometryBytes=sum(
      len(g["positions"]) * 4 + len(g["colors"]) for g in groups.values()
    ),
    sourceBytes=A10_SOURCE.stat().st_size,
    outputBytes=output.stat().st_size,
    outputGzipBytes=len(gzip.compress(output.read_bytes(), mtime=0)),
    groups=len(groups),
    estimates="Widths from lanes and shoulder estimates unless explicitly tagged; same3m regional cartographic datum, no physical bridge elevation or navigable highway-deck claim. Existing V200 complete centre/edge lines remain intact.",
  )
  write(GEO / "a10-transport-v347-evidence.json", report)
  return report


LIGHT_COLOURS = {
  "white": (239, 234, 210),
  "blue": (51, 94, 213),
  "green": (49, 172, 116),
  "yellow": (228, 188, 47),
  "red": (207, 56, 43),
}


def light_style(tags: dict) -> tuple[str, float, float]:
  """Source colour wins; generic aviation convention only fills untagged colour.

  Height and radius are explicit display estimates, never surveyed dimensions.
  Insets stay low; edge/approach units have short frangible posts. PAPI nodes
  remain single mapped anchors, not an invented four-unit array.
  """
  kind = tags["navigationaid"]
  colour = tags.get(
    "light:colour", tags.get("navigationaid:colour", tags.get("colour"))
  )
  if colour not in LIGHT_COLOURS:
    colour = "blue" if kind == "txe" else "green" if kind == "txc" else "white"
  return (
    colour,
    (0.07 if kind in {"txc", "rwc", "tdz", "rwt"} else 0.45),
    (0.13 if kind in {"txc", "rwc", "tdz", "rwt"} else 0.18),
  )


def ber_details(source: dict) -> tuple[dict[str, Detail], dict]:
  drawn, native = Detail(), Detail()
  rendered, archived = [], []
  colour_counts = Counter()
  for record in source["records"]:
    tags = record["tags"]
    if tags["aeroway"] != "navigationaid":
      # Gate nodes cannot justify a guessed façade/level or a sign floating in
      # a terminal; holding/stand points do not describe full painted extents.
      archived.append(record["id"])
      continue
    x, z = record["point"]
    colour, height, radius = light_style(tags)
    colour_counts[colour] += 1
    role = record["id"]
    base_y = 3.045
    metal = (133, 140, 136)
    lens = LIGHT_COLOURS[colour]
    drawn.lathe(
      x,
      z,
      [
        (base_y, radius),
        (base_y + height * 0.72, radius),
        (base_y + height, radius * 0.78),
        (base_y + height, 0),
      ],
      metal,
      role,
      segments=8,
    )
    drawn.lathe(
      x,
      z,
      [
        (base_y + height, radius * 0.78),
        (base_y + height + 0.045, radius * 0.78),
        (base_y + height + 0.045, 0),
      ],
      lens,
      role,
      segments=8,
    )
    # Independently authored cardinal housings, not relabelled Drawn cylinders.
    native.box(
      [x, base_y + height / 2, z], [radius * 2, height, radius * 2], metal, role
    )
    native.box(
      [x, base_y + height + 0.0225, z],
      [radius * 1.56, 0.045, radius * 1.56],
      lens,
      role,
    )
    rendered.append(record["id"])
  return {"drawn": drawn, "minecraft": native}, dict(
    renderedSourceIds=rendered,
    archivedNonFixtureSourceIds=archived,
    sourceKinds=dict(Counter(r["tags"]["aeroway"] for r in source["records"])),
    lightTypes=dict(
      Counter(
        r["tags"]["navigationaid"]
        for r in source["records"]
        if r["tags"]["aeroway"] == "navigationaid"
      )
    ),
    lensColours=dict(colour_counts),
    estimates="Only the mapped light anchors are rendered. Body height 0.07m inset / 0.45m edge-approach, radius0.13/0.18m and materials are display estimates. Untagged colour uses generic aviation convention (blue taxiway edge, green centre, otherwise white); no operational light state or PAPI approach indication is claimed. Gate/stand/holding nodes are retained for audit, not expanded into unknown geometry. No dynamic lights, animations, new ground or navigation solids.",
  )


def ber_build(output: Path) -> dict:
  source = read(BER_SOURCE)
  details, report = ber_details(source)
  partitions = {family: partition_detail(detail) for family, detail in details.items()}
  prior = read(GEO / "ber-v236-manifest-addition.json")
  hosts = {tuple(c["bounds"]): c["id"] for c in prior["chunks"]}
  keys = sorted(set(partitions["drawn"]) | set(partitions["minecraft"]))
  output.mkdir(parents=True, exist_ok=True)
  chunks, receipts = [], []
  for ix, iz in keys:
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    assert tuple(bounds) in hosts, f"Uncovered BER fixture tile {bounds}"
    identity = f"ber347-{ix}_{iz}"
    descriptor = dict(
      id=identity, bounds=bounds, detailCompanionOf=hosts[tuple(bounds)]
    )
    for family in ("drawn", "minecraft"):
      detail = partitions[family].get((ix, iz), Detail())
      mesh = packed_detail(detail, box(*bounds))
      assert mesh is not None
      mesh["kind"] = "ber-source-light-fittings-v347"
      packet = dict(
        schemaVersion=1,
        id=identity,
        origin=[bounds[0], -10, bounds[1]],
        meshes=[mesh],
        nav=dict(ground=[], water=[], buildings=[], groundY=3),
      )
      raw = encoded(packet)
      compressed = gzip.compress(raw, compresslevel=9, mtime=0)
      assert len(raw) < 12 * 1024**2 and len(compressed) < 5 * 1024**2
      filename = f"{identity}.{family}.json.gz"
      (output / filename).write_bytes(compressed)
      descriptor[family] = dict(
        url=filename,
        encoding="gzip",
        bytes=len(compressed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
      receipts.append(
        dict(
          id=identity,
          family=family,
          triangles=len(base64.b64decode(mesh["indices"])) // 12,
          vertices=len(base64.b64decode(mesh["positions"])) // 6,
          bytes=len(compressed),
          decodedBytes=len(raw),
        )
      )
    chunks.append(descriptor)
  report.update(
    sourceSha256=digest(BER_SOURCE),
    chunks=len(chunks),
    packets=receipts,
    compressedBytes=sum(r["bytes"] for r in receipts),
    maximumDecodedPacketBytes=max(r["decodedBytes"] for r in receipts),
    retainedFiles={
      str(p.relative_to(ROOT)): digest(p)
      for p in [
        GEO / "region-outlines-v200-source.json.gz",
        DATA / "berAirportV205.json",
        GEO / "ber-ground-v236-source.json.gz",
        GEO / "ber-buildings-v236-source.json.gz",
        GEO / "ber-v236-manifest-addition.json",
      ]
    },
  )
  write(GEO / "ber-fittings-v347-evidence.json", report)
  write(
    GEO / "ber-fittings-v347-manifest.json",
    dict(
      schemaVersion=1,
      chunks=chunks,
      footprint=[],
      source=dict(
        sourceSha256=digest(BER_SOURCE),
        detailCompanionsOnly=True,
        renderedLightAnchors=len(report["renderedSourceIds"]),
        evidence="geo_data/regierungsviertel/ber-fittings-v347-evidence.json",
      ),
    ),
  )
  return {
    k: report[k]
    for k in ("chunks", "compressedBytes", "maximumDecodedPacketBytes", "sourceKinds")
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--prepare",
    type=Path,
    metavar="RAW_DIR",
    help="Prepare bounded source archives from the documented official API capture",
  )
  parser.add_argument(
    "--output",
    type=Path,
    required=True,
    help="Isolated packet staging directory; no live manifest changes",
  )
  args = parser.parse_args()
  if args.prepare:
    prepare(args.prepare)
  print(json.dumps(dict(a10=a10_build(), ber=ber_build(args.output))))
