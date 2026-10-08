"""Step 10: local official DGM refinement of Teufelsberg and Drachenberg."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import subprocess
import zipfile
from functools import lru_cache
from pathlib import Path

import numpy as np
from build_grunewald_terrain_v190 import offset_at as old_offset
from build_grunewald_terrain_v190 import sample_grid, smooth
from build_weinberg_dgm_samples import BASE_URL, tile_code

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data/teufelsbergTerrainV195.json"
EVIDENCE = GEO / "teufelsberg-terrain-v195.json"
RAW = GEO / "raw/teufelsberg-v195"
SUPPORT = (-9248, 1248, -7936, 2688)
STEP = 8
FADE = 64
BASE = "v1.0.94"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PEAKS = [
  ("Teufelsberg", "156850034", -8775.006918908737, 2150.707746723667, 120.1),
  ("Drachenberg", "353075536", -8403.524021575635, 1642.2394943060353, 99),
]


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
    for profile in reversed(field()["profiles"]):
      w, n, e, s = profile["support"]
      if w < x < e and n < z < s:
        return sample_grid(profile, x, z)
  return old_offset(x, z)


def build_samples() -> dict:
  """Sample two retained DGM tiles only; preserve the old field at the apron."""
  tiles = {}
  sources = []
  for code in ["380_5816", "380_5818"]:
    path = GEO / f"raw/grunewald-v190/DGM1_{code}.zip"
    member = f"dgm1_33_{code}_2_be.xyz"
    with zipfile.ZipFile(path) as archive:
      with archive.open(member) as stream:
        values = np.loadtxt(stream, usecols=2, dtype=np.float32)
    assert len(values) == 4_000_000
    tiles[code] = values.reshape(2000, 2000)
    sources.append(
      {
        "url": BASE_URL + path.name,
        "member": member,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )

  def nhn(x: float, z: float) -> float:
    e, n = 389500 + x, 5820000 - z
    code = tile_code(e, n)
    a, b = [int(v) * 1000 for v in code.split("_")]
    return round(float(tiles[code][math.floor(n - b), math.floor(e - a)]), 2)

  values = []
  measurements = []
  for z in range(SUPPORT[1], SUPPORT[3] + 1, STEP):
    row = []
    survey = []
    for x in range(SUPPORT[0], SUPPORT[2] + 1, STEP):
      measured = nhn(x, z)
      edge = min(x - SUPPORT[0], SUPPORT[2] - x, z - SUPPORT[1], SUPPORT[3] - z)
      weight = smooth(edge / FADE)
      row.append(round(old_offset(x, z) * (1 - weight) + (measured - 33) * weight, 4))
      survey.append(measured)
    values.append(row)
    measurements.append(survey)
  general = {
    "name": "Teufelsberg and Drachenberg",
    "support": list(SUPPORT),
    "stepM": STEP,
    "offsets": values,
  }
  crest_support = [-8800, 2140, -8768, 2172]
  crest_values = []
  for z in range(crest_support[1], crest_support[3] + 1):
    row = []
    for x in range(crest_support[0], crest_support[2] + 1):
      edge = min(
        x - crest_support[0],
        crest_support[2] - x,
        z - crest_support[1],
        crest_support[3] - z,
      )
      weight = smooth(edge / 8)
      row.append(
        round(sample_grid(general, x, z) * (1 - weight) + (nhn(x, z) - 33) * weight, 4)
      )
    crest_values.append(row)
  crest = {
    "name": "Measured Teufelsberg summit crest",
    "support": crest_support,
    "stepM": 1,
    "offsets": crest_values,
  }
  payload = {
    "schemaVersion": 1,
    "nativeStepM": 8,
    "fadeM": FADE,
    "datumNHN": 30,
    "baseline": 3,
    "profiles": [general, crest],
  }
  DATA.write_bytes(encode(payload))
  field.cache_clear()
  peaks = []
  for name, oid, x, z, nominal in PEAKS:
    candidates = [
      (measurements[iz][ix], SUPPORT[0] + ix * STEP, SUPPORT[1] + iz * STEP)
      for iz in range(len(values))
      for ix in range(len(values[0]))
      if math.hypot(SUPPORT[0] + ix * STEP - x, SUPPORT[1] + iz * STEP - z) < 210
    ]
    peak = max(candidates)
    if name == "Teufelsberg":
      crest_candidates = [
        (nhn(x, z), x, z)
        for x in range(crest_support[0], crest_support[2] + 1)
        for z in range(crest_support[1], crest_support[3] + 1)
      ]
      peak = max(crest_candidates)
    peaks.append(
      {
        "name": name,
        "sourceId": "OSM-node-" + oid,
        "anchor": [x, z],
        "publishedPeakNHN": nominal,
        "dgmAtMappedNodeNHN": nhn(x, z),
        "oldDisplayAtMappedNodeNHN": round(33 + old_offset(x, z), 4),
        "displayAtMappedNodeNHN": round(33 + offset_at(x, z), 4),
        "nearbySampledHighpoint": {"nhn": peak[0], "point": [peak[1], peak[2]]},
        "policy": "Mapped label point and documented summit are different anchors; no artificial boost to force a published height.",
      }
    )
  evidence = {
    "schemaVersion": 1,
    "baseline": BASE,
    "source": "Geoportal Berlin ATKIS DGM1",
    "license": "dl-de/zero-2-0",
    "sources": sources,
    "fieldSha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
    "originalFieldSha256": hashlib.sha256(
      (ROOT / "src/app/src/data/grunewaldTerrainV190.json").read_bytes()
    ).hexdigest(),
    "sourceResolutionM": 1,
    "displayGridM": STEP,
    "nativeTerraceM": 8,
    "edgeFadeM": FADE,
    "measuredNHN": measurements,
    "summitCrestMaxNHN": 33 + max(map(max, crest_values)),
    "peaks": peaks,
    "factSources": [
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.177406.php",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.1173608.php",
    ],
    "policy": "Refine source-based hill geometry, not synthetic mounds; preserve previous source XZ, complete city geometry and all existing lake datums. Refined field joins original at64m apron.",
  }
  EVIDENCE.write_bytes(encode(evidence))
  return evidence


def stage_packets() -> dict:
  """Replay unchanged source sheets through the fine field with v194 hash gates."""
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
  old_descriptors = {
    d["id"]: d
    for d in old_receipt["replacementDescriptors"]
    + old_receipt.get("extraDescriptors", [])
  }
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
    "Verified immutable v194 families",
    len(families),
    "assets",
    len(baseline),
    flush=True,
  )
  original_field = old.field()
  # The whole original32m field remains the outer datum. Only the named hills
  # replace it locally; complete packet edges outside those hills retain it.
  combined = {
    "profiles": [
      original_field["profiles"][0],
      *field()["profiles"],
      *original_field["profiles"][1:],
    ]
  }
  base_drape = draper.drape_triangle
  crest = field()["profiles"][1]["support"]

  def precise_drape(points, *, minecraft=False):
    previous = draper.STEP
    near = (
      points[:, 0].max() > crest[0]
      and points[:, 0].min() < crest[2]
      and points[:, 2].max() > crest[1]
      and points[:, 2].min() < crest[3]
    )
    if near and not minecraft:
      draper.STEP = 1
    try:
      return base_drape(points, minecraft=minecraft)
    finally:
      draper.STEP = previous

  draper.drape_triangle = precise_drape
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
    candidate.get("terrainSha256") == hashlib.sha256(DATA.read_bytes()).hexdigest()
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
    old.prepare_packets(only=selected)
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
          "id": f"{identity}-teufelsberg-v195-{i}",
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
        url = d.get(mode, {}).get("url", f"teufelsberg-v195/{d['id']}.{mode}.json.gz")
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
    "historicalProof": "Every v194 input family hash equals its immutable v190 output; unchanged v189 source triangle/colour/identity inventory is replayed with strictly finer terrain. All original source XZ courses survive, every tree/building remains rigid, water datums stay unchanged.",
  }
  detail = {key: receipt.pop(key) for key in ("packets", "parentOffsets")}
  blob = gzip.compress(encode(detail), mtime=0, compresslevel=9)
  assert len(blob) < 5 * 1024 * 1024
  detail_path = GEO / "teufelsberg-v195-packet-details.json.gz"
  detail_path.write_bytes(blob)
  receipt["details"] = {
    "url": detail_path.name,
    "bytes": len(blob),
    "decodedBytes": len(encode(detail)),
    "sha256": hashlib.sha256(blob).hexdigest(),
  }
  (GEO / "teufelsberg-v195-packet-audit.json").write_bytes(encode(receipt))
  (GEO / "teufelsberg-v195-manifest-patch.json").write_bytes(encode({"chunks": final}))
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
    print(json.dumps(build_samples()["peaks"], indent=2))
