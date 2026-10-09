"""Step 10: measured Olympic site and Waldbühne relief; private packet staging."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
import zipfile
from functools import lru_cache
from pathlib import Path

import numpy as np
from build_grunewald_terrain_v190 import (
  bank_pieces,
  sample_grid,
  smooth,
  without_hero_ink,
)
from build_weinberg_dgm_samples import BASE_URL, tile_code
from shapely import STRtree, make_valid
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data/olympicTerrainV201.json"
EVIDENCE = GEO / "olympic-terrain-v201.json"
RAW = GEO / "raw/olympic-v201"
SUPPORT = (-10496, -1152, -8064, 1152)
STEP = 8
FADE = 192
BASE = "v1.0.100"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def encode(value: object) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def original(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


@lru_cache(maxsize=1)
def field() -> dict:
  return json.loads(DATA.read_bytes())


def offset_at(x: float, z: float, native: bool = False) -> float:
  if native:
    x, z = math.floor(x / 8) * 8 + 4, math.floor(z / 8) * 8 + 4
  if SUPPORT[0] < x < SUPPORT[2] and SUPPORT[1] < z < SUPPORT[3]:
    return sample_grid(field()["profiles"][0], x, z)
  return old_offset(x, z)


@lru_cache(maxsize=1)
def previous_profiles() -> list[dict]:
  old = json.loads((ROOT / "src/app/src/data/grunewaldTerrainV190.json").read_bytes())[
    "profiles"
  ]
  hills = json.loads(
    (ROOT / "src/app/src/data/teufelsbergTerrainV195.json").read_bytes()
  )["profiles"]
  return [*old, *hills]


def old_offset(x: float, z: float) -> float:
  for profile in reversed(previous_profiles()):
    west, north, east, south = profile["support"]
    if west < x < east and north < z < south:
      return sample_grid(profile, x, z)
  return 0.0


def build_samples() -> dict:
  """Read four small official tiles, including one incomplete border tile."""
  RAW.mkdir(parents=True, exist_ok=True)
  tiles, sources = {}, []
  for code in ["378_5818", "380_5818", "378_5820", "380_5820"]:
    path = GEO / f"raw/grunewald-v190/DGM1_{code}.zip"
    if not path.exists():
      path = RAW / f"DGM1_{code}.zip"
    member = f"dgm1_33_{code}_2_be.xyz"
    cache = RAW / f"{code}.npy"
    if cache.exists():
      values = np.load(cache)
    else:
      with zipfile.ZipFile(path) as archive:
        with archive.open(member) as stream:
          xyz = np.loadtxt(stream, dtype=np.float64)
      east, north = [int(v) * 1000 for v in code.split("_")]
      values = np.full((2000, 2000), np.nan, dtype=np.float32)
      values[
        np.floor(xyz[:, 1] - north).astype(int), np.floor(xyz[:, 0] - east).astype(int)
      ] = xyz[:, 2]
      np.save(cache, values)
    tiles[code] = values
    sources.append(
      {
        "url": BASE_URL + path.name,
        "member": member,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "validCells": int(np.isfinite(values).sum()),
      }
    )

  def nhn(x: float, z: float) -> float:
    east, north = 389500 + x, 5820000 - z
    code = tile_code(east, north)
    a, b = [int(v) * 1000 for v in code.split("_")]
    value = float(tiles[code][math.floor(north - b), math.floor(east - a)])
    assert math.isfinite(value), (x, z, code)
    return round(value, 2)

  values, measurements = [], []
  for z in range(SUPPORT[1], SUPPORT[3] + 1, STEP):
    row, survey = [], []
    for x in range(SUPPORT[0], SUPPORT[2] + 1, STEP):
      measured = nhn(x, z)
      edge = min(x - SUPPORT[0], SUPPORT[2] - x, z - SUPPORT[1], SUPPORT[3] - z)
      weight = smooth(edge / FADE)
      row.append(round(old_offset(x, z) * (1 - weight) + (measured - 33) * weight, 4))
      survey.append(measured)
    values.append(row)
    measurements.append(survey)
  DATA.write_bytes(
    encode(
      {
        "schemaVersion": 1,
        "nativeStepM": 8,
        "fadeM": FADE,
        "datumNHN": 30,
        "baseline": 3,
        "profiles": [
          {
            "name": "Olympic site and Waldbühne",
            "support": list(SUPPORT),
            "stepM": STEP,
            "offsets": values,
          }
        ],
      }
    )
  )
  field.cache_clear()
  checks = [
    ("Waldbühne lower bowl", -9651, 151),
    ("Waldbühne upper seating", -9651, 245),
    ("Olympiastadion infield", -8944, 266),
    ("Olympiastadion east plaza", -8780, 266),
    ("Glockenturm approach", -9478, 320),
  ]
  evidence = {
    "schemaVersion": 1,
    "baseline": BASE,
    "source": "Geoportal Berlin ATKIS DGM1",
    "license": "dl-de/zero-2-0",
    "sources": sources,
    "fieldSha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
    "sourceResolutionM": 1,
    "displayGridM": STEP,
    "nativeTerraceM": 8,
    "edgeFadeM": FADE,
    "measuredNHN": measurements,
    "checkpoints": [
      {
        "name": name,
        "point": [x, z],
        "measuredNHN": nhn(x, z),
        "displayNHN": round(33 + offset_at(x, z), 4),
      }
      for name, x, z in checks
    ],
    "factSources": [
      "https://www.waldbuehne-berlin.de/location/geschichte/",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.111002.php",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/sportanlagen/stadien-und-sportplaetze/artikel.154614.php",
    ],
    "policy": "Measured terrain only; exact old field at192m apron. Stadium source inner arena retains its separately measured LoD2 pitch/seat elevation rather than a new terrain cap. Preserve all source XZ and source inventory.",
  }
  EVIDENCE.write_bytes(encode(evidence))
  return evidence


OLYMPIC_OFFSETS = {
  "DEBE04AL5LX00002": 33.45,
  "DEBE04AL5LX00003": 33.45,
  "DEBE04AL5LX00004": 33.45,
  "DEBE04YY500001If": 34.676,
  "DEBE04YY500008Cu": 31.011,
  "DEBE04YY500006Fm": 30.986,
}


def corrected_hero_navigation() -> list[dict]:
  old = json.loads(
    (ROOT / "src/app/src/data/westLandmarksV187Navigation.json").read_bytes()
  )["buildings"]
  return [
    {
      **b,
      "groundY": b["groundY"] + OLYMPIC_OFFSETS[b["owner"]],
      "topY": b["topY"] + OLYMPIC_OFFSETS[b["owner"]],
    }
    for b in old
    if b["owner"] in OLYMPIC_OFFSETS
  ]


def prepare_packets(only: set[str], save) -> None:
  """Move every existing layer together; stage, never mutate public assets."""
  import build_grunewald_terrain_v190 as prior
  import build_weinberg_terrain_packets_v176 as terrain

  baseline = json.loads(prior.original(PUBLIC / "manifest.json"))
  support = box(SUPPORT[0] - 512, SUPPORT[1] - 512, SUPPORT[2] + 512, SUPPORT[3] + 512)
  output = RAW / "packets"
  output.mkdir(exist_ok=True)
  selected = [d for d in baseline["chunks"] if support.intersects(box(*d["bounds"]))]

  def source_packet(d: dict, mode: str) -> tuple[bytes, dict]:
    path = PUBLIC / d[mode]["url"]
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != d[mode]["sha256"]:
      raw = prior.original(path)
    return raw, json.loads(gzip.decompress(raw))

  # Parent anchors are reconstructed across complete neighboring packet pieces,
  # preventing seams where a building crosses a packet boundary.
  parent_parts = {}
  decoded = {}
  for d in selected:
    raw, p = source_packet(d, "drawn")
    decoded[d["id"]] = p
    ox, _, oz = p["origin"]
    for b in p["nav"]["buildings"]:
      key = b.get("partId", b["sourceId"])
      g = Polygon(
        [(x + ox, z + oz) for x, z in b["ring"]],
        [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
      )
      parent_parts.setdefault(key, []).append(make_valid(g))
  offsets = {}
  for key, parts in parent_parts.items():
    p = unary_union(parts).representative_point()
    offsets[key] = round(offset_at(p.x, p.y), 2)
  hero_nav = corrected_hero_navigation()
  hero_ids = {b["owner"] for b in hero_nav if b["owner"] in OLYMPIC_OFFSETS}
  hero_shapes = [
    unary_union(parts).buffer(0.08)
    for key, parts in parent_parts.items()
    if key in hero_ids
  ]
  heroes = unary_union(hero_shapes)
  lake_evidence = json.loads((GEO / "grunewald-terrain-v190.json").read_bytes())
  lake_evidence = lake_evidence["lakes"] + lake_evidence.get("additionalWater", [])
  lakes = [
    (shape(lake["geometry"]).buffer(0.12), lake["waterY"]) for lake in lake_evidence
  ]
  terrain.SUPPORT = [
    SUPPORT[0] - 512,
    SUPPORT[1] - 512,
    SUPPORT[2] + 512,
    SUPPORT[3] + 512,
  ]
  terrain.STEP = STEP
  terrain.NATIVE_STEP = 8
  terrain.sample_offset = lambda x, z: offset_at(x, z)
  terrain.sample_native_offset = lambda x, z: offset_at(x, z, True)

  def water_at(points: np.ndarray) -> float | None:
    p = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
    for g, y in lakes:
      if g.covers(p):
        return y
    return None

  def arrays(mesh: dict, origin: list) -> tuple:
    p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    ).astype(float) / 100 + np.asarray(origin)
    i = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
    c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
    return p, i, c

  audit = []
  descriptors = []
  for d in [d for d in selected if d["id"] in only]:
    has_change = False
    new_d = json.loads(json.dumps(d))
    packet_audit = []
    for mode in ("drawn", "minecraft"):
      raw, p = source_packet(d, mode)
      origin = p["origin"]
      ox, _, oz = origin
      building_shapes = []
      values = []
      for b in p["nav"]["buildings"]:
        polygon = Polygon(
          [(x + ox, z + oz) for x, z in b["ring"]],
          [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
        )
        building_shapes.append(polygon.buffer(0.1))
        values.append(offsets.get(b.get("partId", b["sourceId"]), 0))
      tree = STRtree(building_shapes)

      class Owners:
        def lookup(self, points: np.ndarray) -> float | None:
          centre = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
          for index in tree.query(centre):
            if building_shapes[index].covers(centre):
              return values[index]
          return None

      owner = Owners()
      # Native fallback blocks legitimately extend to their own voxel-cell
      # edges; replacing only the drawn polygon leaves old exterior slabs.
      active_heroes = (
        heroes
        if mode == "drawn"
        else unary_union(
          [
            Polygon(
              [(x + ox, z + oz) for x, z in b["ring"]],
              [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
            ).buffer(0.08)
            for b in p["nav"]["buildings"]
            if b["sourceId"] in hero_ids
          ]
        )
      )
      records = []
      for mi, mesh in enumerate(p["meshes"]):
        positions, indices, colors = arrays(mesh, origin)
        exact = {}
        removed = 0
        if mesh["kind"] == "outskirts-v187-forest":
          if len(indices) % 18:
            raise ValueError("Forest triangle grouping changed")
          for start in range(0, len(indices), 18):
            # The first eight triangles are exactly the retained trunk walls.
            trunk = positions[indices[start : start + 8].ravel()]
            x = (trunk[:, 0].min() + trunk[:, 0].max()) / 2
            z = (trunk[:, 2].min() + trunk[:, 2].max()) / 2
            dy = round(offset_at(x, z, mode == "minecraft"), 2)
            for tri in indices[start : start + 18]:
              exact[
                terrain.triangle_key(np.rint(positions[tri] * 100).astype(np.int64))
              ] = dy
        elif not active_heroes.is_empty and active_heroes.intersects(box(*d["bounds"])):
          keep = []
          for tri in indices:
            pts = positions[tri]
            is_ground = terrain.is_ground_triangle(mesh["kind"], pts, colors[tri])
            replaced = (
              not is_ground
              and np.min(pts[:, 1]) >= 2.999
              and all(active_heroes.covers(Point(x, z)) for x, _, z in pts)
            )
            if replaced:
              removed += 1
            else:
              keep.append(tri)
          if removed:
            mesh = {**mesh, "indices": terrain.array64(np.asarray(keep, dtype="<u4"))}
        changed, receipt = terrain.elevate_mesh(
          mesh,
          origin,
          exact,
          owner.lookup,
          minecraft=mode == "minecraft",
          water_at=water_at,
          bank_transform=bank_pieces,
        )
        receipt["replacedHeroTriangles"] = removed
        p["meshes"][mi] = changed
        records.append(receipt)
      if p.get("lines", {}).get("positions"):
        p["lines"], removed_ink = without_hero_ink(p["lines"], origin, active_heroes)
        # Use8m cuts for ink so it agrees through the locally refined hill.
        terrain.STEP = 8
        p["lines"], line_receipt = terrain.elevate_lines(p["lines"], origin, owner, {})
        terrain.STEP = STEP
        line_receipt["replacedHeroSegments"] = removed_ink
      else:
        line_receipt = {}
      # Preserve the immutable source-part navigation rings even when the
      # ordinary ground has a purposeful stadium-bowl cutout beneath them.
      prior_hero_rows = [b for b in p["nav"]["buildings"] if b["sourceId"] in hero_ids]
      p["nav"]["buildings"] = [
        b for b in p["nav"]["buildings"] if b["sourceId"] not in hero_ids
      ]
      for b in p["nav"]["buildings"]:
        dy = offsets.get(b.get("partId", b["sourceId"]), 0)
        if dy:
          b["groundOffset"] = round(b.get("groundOffset", 0) + dy, 2)
      for b in prior_hero_rows:
        dy = OLYMPIC_OFFSETS[b["sourceId"]]
        p["nav"]["buildings"].append(
          {**b, "height": b["height"] + dy, "minHeight": b.get("minHeight", 0) + dy}
        )
      if not terrain.fits(p):
        raise ValueError(f"Unchanged packet budget exceeded:{d['id']}:{mode}")
      data = encode(p)
      # Do not reserialize unrelated zero-offset packets merely in the support bbox.
      relevant = any(
        r.get("translatedSourceTriangles", 0)
        or r.get("drapedSourceTriangles", 0)
        or r.get("bankTriangles", 0)
        or r.get("replacedHeroTriangles", 0)
        for r in records
      )
      if not relevant:
        continue
      compressed = gzip.compress(data, mtime=0, compresslevel=9)
      path = output / d[mode]["url"]
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_bytes(compressed)
      new_d[mode].update(
        bytes=len(compressed),
        decodedBytes=len(data),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
      packet_audit.append(
        {
          "mode": mode,
          "baseSha256": hashlib.sha256(raw).hexdigest(),
          "sha256": new_d[mode]["sha256"],
          "meshes": records,
          "lines": line_receipt,
        }
      )
      has_change = True
    if has_change:
      descriptors.append(new_d)
      audit.append({"id": d["id"], "representations": packet_audit})
      # Copy the other representation if only one needed an altitude change.
      for mode in ("drawn", "minecraft"):
        dest = output / d[mode]["url"]
        if not dest.exists():
          dest.parent.mkdir(parents=True, exist_ok=True)
          dest.write_bytes(source_packet(d, mode)[0])
      print(d["id"], len(audit), flush=True)
  receipt = {
    "schemaVersion": 1,
    "olympicHeroDatumV201": True,
    "preserveSourceHeroNavigationV201": True,
    "baseRelease": "v1.0.89",
    "baseManifestSha256": hashlib.sha256(
      original(PUBLIC / "manifest.json")
    ).hexdigest(),
    "terrainSha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
    "replacementDescriptors": descriptors,
    "packets": audit,
    "parentOffsets": offsets,
    "policy": "All old XZ source courses, triangles, colors and identities retained; source ground triangles split at DGM planes; buildings/trees rigidly translated; exact documented hero fallback owners substituted by complete source models.",
  }
  save(receipt)
  print("prepared", len(descriptors), "packets", flush=True)


def stage_packets() -> dict:
  """Replay unchanged source sheets through the fine field with v200 hash gates."""
  import copy

  import build_grunewald_terrain_v190 as old
  import build_weinberg_terrain_packets_v176 as draper
  from alt_mitte_v169_packets import empty_packet
  from shapely.geometry import box
  from split_alt_mitte_v169_core import split_mesh

  old_receipt = old.read_receipt()
  manifest = json.loads(original(PUBLIC / "manifest.json"))
  selected = {
    d["id"]
    for d in manifest["chunks"]
    if not d.get("detailCompanionOf") and box(*d["bounds"]).intersects(box(*SUPPORT))
  }
  flat = json.loads(old.original(PUBLIC / "manifest.json"))
  old_descriptors = {d["id"]: d for d in flat["chunks"]}
  old_descriptors.update(
    {
      d["id"]: d
      for d in old_receipt["replacementDescriptors"]
      + old_receipt.get("extraDescriptors", [])
    }
  )
  hill_receipt = json.loads((GEO / "teufelsberg-v195-packet-audit.json").read_bytes())
  old_descriptors.update(
    {
      d["id"]: d
      for d in hill_receipt["replacementDescriptors"]
      + hill_receipt.get("extraDescriptors", [])
    }
  )
  families = {
    identity: [
      d
      for d in manifest["chunks"]
      if d["id"] == identity or d.get("detailCompanionOf") == identity
    ]
    for identity in sorted(selected)
  }
  baseline = []
  for family in families.values():
    for d in family:
      assert d["id"] in old_descriptors, d["id"]
      for mode in ("drawn", "minecraft"):
        assert d[mode] == old_descriptors[d["id"]][mode], (
          f"Post-v190 geometry needs separate replay:{d['id']}:{mode}"
        )
        assert (
          hashlib.sha256(original(PUBLIC / d[mode]["url"])).hexdigest()
          == d[mode]["sha256"]
        )
      baseline.append(copy.deepcopy(d))
  print(
    "Verified immutable v200 families",
    len(families),
    "assets",
    len(baseline),
    flush=True,
  )
  # Complete neighbouring flat source fragments establish stable rigid owner
  # anchors; publish only families crossing the finite new field. A conservative
  # 8m cut preserves both the old32m planes and prior8m Teufelsberg packet tails.
  combined = {
    "profiles": [
      {
        "support": [
          SUPPORT[0] - 512,
          SUPPORT[1] - 512,
          SUPPORT[2] + 512,
          SUPPORT[3] + 512,
        ]
      },
      field()["profiles"][0],
    ]
  }
  old.STEP = 8
  draper.fits = lambda p: True  # Unsplit private staging; strict ceilings below.
  captured = {}
  unsplit = RAW / "unsplit-packets"

  def save(receipt):
    captured.clear()
    captured.update(receipt)
    # Split output reuses the original URLs. Keep an independently hashed copy
    # of every complete mesh before writing those URLs, including companions.
    for descriptor in receipt["replacementDescriptors"]:
      for mode in ("drawn", "minecraft"):
        asset = descriptor[mode]
        raw = (RAW / "packets" / asset["url"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
        path = unsplit / asset["url"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    (RAW / "unsplit-audit.json.gz").write_bytes(gzip.compress(encode(receipt), mtime=0))

  old.RAW = RAW
  RAW.mkdir(parents=True, exist_ok=True)
  old.DATA = DATA
  old.field = lambda: combined
  old.offset_at = offset_at
  old.write_receipt = save
  old.read_receipt = lambda: {
    "replacementDescriptors": [],
    "packets": [],
    "extraDescriptors": [],
    "splitPackets": [],
  }
  cache = RAW / "unsplit-audit.json.gz"
  candidate = json.loads(gzip.decompress(cache.read_bytes())) if cache.exists() else {}
  valid = (
    candidate.get("olympicHeroDatumV201") is True
    and candidate.get("preserveSourceHeroNavigationV201") is True
    and candidate.get("terrainSha256") == hashlib.sha256(DATA.read_bytes()).hexdigest()
    and {d["id"] for d in candidate.get("replacementDescriptors", [])} == selected
  )
  if valid:
    for descriptor in candidate["replacementDescriptors"]:
      for mode in ("drawn", "minecraft"):
        asset = descriptor[mode]
        path = unsplit / asset["url"]
        valid = (
          valid
          and path.exists()
          and hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]
        )
  if valid:
    captured.update(candidate)
  else:
    prepare_packets(selected, save)
  # Fine ink subdivisions are already8m. The1m crest has no ground-outline
  # crossing; complete elevated building ink remains one rigid owner.
  output = RAW / "packets"

  def pack(p):
    raw = encode(p)
    return raw, gzip.compress(raw, mtime=0, compresslevel=9)

  def fits(p):
    a, b = pack(p)
    return len(a) < 2_600_000 and len(b) < 650_000

  def write(p, url):
    a, b = pack(p)
    dest = output / url
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b)
    return {
      "url": url,
      "bytes": len(b),
      "decodedBytes": len(a),
      "encoding": "gzip",
      "sha256": hashlib.sha256(b).hexdigest(),
    }

  final = []
  splits = []
  for descriptor in captured["replacementDescriptors"]:
    identity = descriptor["id"]
    modes = {}
    reports = []
    for mode in ("drawn", "minecraft"):
      p = json.loads(gzip.decompress((unsplit / descriptor[mode]["url"]).read_bytes()))
      pieces = []
      counts = []
      for mesh in p["meshes"]:
        meshpieces = split_mesh(mesh, 45000)
        pieces.extend(meshpieces)
        counts.append(len(meshpieces))
      parts = []
      current = {**p, "meshes": []}
      assert fits(current)
      for mesh in pieces:
        candidate = {**current, "meshes": [*current["meshes"], mesh]}
        if fits(candidate):
          current = candidate
        else:
          parts.append(current)
          current = empty_packet(identity, descriptor["bounds"], p["origin"][1])
          current["meshes"] = [mesh]
          assert fits(current)
      parts.append(current)
      modes[mode] = parts
      reports.append(
        {
          "mode": mode,
          "unsplitSha256": descriptor[mode]["sha256"],
          "meshPieceCounts": counts,
          "packetMeshes": [len(v["meshes"]) for v in parts],
        }
      )
    old_family = families[identity]
    count = max(len(old_family), *(len(p) for p in modes.values()))
    for i in range(count):
      d = (
        copy.deepcopy(old_family[i])
        if i < len(old_family)
        else {
          "id": f"{identity}-olympic-v201-{i}",
          "bounds": descriptor["bounds"],
          "detailCompanionOf": identity,
        }
      )
      for mode in ("drawn", "minecraft"):
        p = (
          modes[mode][i]
          if i < len(modes[mode])
          else empty_packet(d["id"], d["bounds"], -10)
        )
        p["id"] = d["id"]
        url = d.get(mode, {}).get("url", f"olympic-v201/{d['id']}.{mode}.json.gz")
        d[mode] = write(p, url)
      final.append(d)
    splits.append({"id": identity, "representations": reports})
  receipt = {
    **captured,
    "schemaVersion": 1,
    "inheritedSourceRelease": captured["baseRelease"],
    "baseRelease": BASE,
    "baseManifestSha256": hashlib.sha256(
      original(PUBLIC / "manifest.json")
    ).hexdigest(),
    "baselineDescriptors": baseline,
    "replacementDescriptors": [d for d in final if not d.get("detailCompanionOf")],
    "extraDescriptors": [d for d in final if d.get("detailCompanionOf")],
    "splitPackets": splits,
    "replacedOwnerIds": sorted(OLYMPIC_OFFSETS),
    "historicalProof": "Every immutable v200 input family is hash-verified as either unchanged flat v189 source or a v190/v195 receipted terrain output; complete original v189 source triangle/colour/identity inventory is replayed with finer terrain. All original source XZ courses survive, every tree/building remains rigid, water datums stay unchanged.",
  }
  detail = {key: receipt.pop(key) for key in ("packets", "parentOffsets")}
  blob = gzip.compress(encode(detail), mtime=0, compresslevel=9)
  assert len(blob) < 5 * 1024 * 1024
  detail_path = GEO / "olympic-v201-packet-details.json.gz"
  detail_path.write_bytes(blob)
  receipt["details"] = {
    "url": detail_path.name,
    "bytes": len(blob),
    "decodedBytes": len(encode(detail)),
    "sha256": hashlib.sha256(blob).hexdigest(),
  }
  (GEO / "olympic-v201-packet-audit.json").write_bytes(encode(receipt))
  (GEO / "olympic-v201-manifest-patch.json").write_bytes(encode({"chunks": final}))
  print(
    "Staged",
    len(receipt["replacementDescriptors"]),
    "primaries +",
    len(receipt["extraDescriptors"]),
    "companions",
    flush=True,
  )
  return receipt


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--packets", action="store_true")
  args = parser.parse_args()
  if args.packets:
    stage_packets()
  else:
    print(json.dumps(build_samples()["checkpoints"], indent=2))
