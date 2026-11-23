"""Build compact, source-bounded profiles for the ranked Berlin facades."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

from PIL import Image

if __package__:
  from .read_facade_openings_v377 import photo_bands, structural_bands
else:
  from read_facade_openings_v377 import photo_bands, structural_bands

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
# These structures were replaced or their facades comprehensively rebuilt
# after the Berlin 3DCityDB photography. A matching footprint is insufficient.
POST_ARCHIVE_REBUILD = {"DEBE02AL5Nr0005A", "DEBE02AL5KH0003C", "DEBE03AL3D20001p"}
OSM_SOURCE = "https://download.geofabrik.de/europe/germany/berlin/berlin-261122.osm.pbf"
OSM_SHA = "56551452bd0656d371ac473216324b679879eddf2a40f417ce9330a7f065c00d"


def compact(data):
  return (
    json.dumps(
      data, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    ).encode()
    + b"\n"
  )


def load(path):
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def save(path, data, check=False):
  raw = compact(data)
  if path.suffix == ".gz":
    raw = gzip.compress(raw, mtime=0)
  if check:
    if path.read_bytes() != raw:
      raise ValueError(f"Stale facade data {path}")
  else:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(raw)
    tmp.replace(path)


def capture_surveys(rank, cadastral, osm):
  survey = load(cadastral / "summary.json")
  streets = load(osm)
  result = {}
  for target in rank["targets"]:
    owner = target["id"]
    raw = load(cadastral / (owner + ".json.gz"))
    # Generally uuid is identical to the modeled building. OSM footprints can
    # coincide with a different underground owner, retain both sources explicitly.
    candidates = [d for d in survey[owner] if d["score"] >= 0.5]
    selected = next((d for d in candidates if d["uuid"] == owner), None)
    if not selected:
      selected = next(
        (
          d
          for d in candidates
          if d["usage"] not in ("Tiefgarage", "Unterirdisches Gebäude")
        ),
        None,
      )
    context = streets[owner]
    result[owner] = dict(
      wfs=raw["url"],
      footprintMatches=candidates,
      building=selected,
      osmBuildings=[r for r in context["buildings"] if r["iou"] >= 0.5],
      entrances=context["entrances"],
    )
  return dict(
    schema=1,
    crs="viewer metres, x=easting-389500, z=5820000-northing (EPSG:25833)",
    alkisSource="Geoportal Berlin / ALKIS Berlin, Gebäudeflächen, 2026-11-23",
    osmSource=OSM_SOURCE,
    osmSha256=OSM_SHA,
    osmAttribution="© OpenStreetMap contributors, ODbL 1.0",
    targets=result,
  )


def capture_photos(rank, manifests):
  selected = {t["id"] for t in rank["targets"]} - POST_ARCHIVE_REBUILD
  results = defaultdict(list)
  seen = set()
  for r in (record for manifest in manifests for record in load(manifest)):
    # The same plane can appear in both the old prism census and the official
    # replacement-wall survey. Keep its polygon identity for the shell renderer.
    key = (r["id"], segment_id(r))
    if r["id"] not in selected or key in seen:
      continue
    seen.add(key)
    path = Path(r["image"])
    with Image.open(path) as image:
      windows = photo_bands(image, r["widthM"], r["heightM"])
      layers = structural_bands(image, r["widthM"], r["heightM"])
    # A material reading behind separately resolved glazing would obscure it.
    for strip in layers:
      x, y = strip["x"], strip["y"]
      overlap = any(
        min(x[1], b["x"][1]) > max(x[0], b["x"][0])
        and min(y[1], b["y"][1]) > max(y[0], b["y"][0])
        for b in windows
      )
      if not overlap:
        windows.append(strip)
    if windows:
      result = {
        k: r[k]
        for k in (
          "a",
          "b",
          "normal",
          "low",
          "high",
          "sourceUrls",
          "imageSources",
          "fraction",
          "wallDistanceM",
        )
      }
      if "wallId" in r:
        result["wallId"] = r["wallId"]
      result.update(
        imageSha256=hashlib.sha256(path.read_bytes()).hexdigest(), bands=windows
      )
      results[r["id"]].append(result)
  return dict(
    schema=1,
    archive="Berlin Buildings RGB texture, 2013/14; 3DCityDB Berlin demo, ScaleFactor 0.3",
    postArchiveRebuild=sorted(POST_ARCHIVE_REBUILD),
    targets=results,
  )


def azimuth(normal):
  return round(math.degrees(math.atan2(normal[0], -normal[1])) % 360, 3)


def segment_id(record):
  return tuple(tuple(record[k]) for k in ("a", "b")) + (
    record["low"],
    record["high"],
    record.get("wallId", ""),
  )


def doorway_candidates(target, survey):
  low = min(s["low"] for s in target["segments"] if s["family"] == "drawn")
  faces = {
    segment_id(s): s
    for s in target["segments"]
    if s["family"] == "drawn" and s["low"] < low + 2.5 and s["high"] - s["low"] >= 2.3
  }
  for door in survey["entrances"]:
    tags = door["tags"]
    if tags.get("entrance", "no") in ("no", "emergency", "exit", "roof") or tags.get(
      "level", "0"
    ) not in ("0", "G", "EG"):
      continue
    near = []
    x, z = door["world"]
    for key, face in faces.items():
      a, b = face["a"], face["b"]
      length = math.dist(a, b)
      if length < 2:
        continue
      dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
      along = (x - a[0]) * dx + (z - a[1]) * dz
      distance = abs((x - a[0]) * dz - (z - a[1]) * dx)
      if 0.5 <= along <= length - 0.5 and distance <= 1.3:
        near.append((distance, key, face, along, length))
    if not near:
      continue
    _, _, face, along, length = min(near, key=lambda d: (d[0], d[1]))
    # OSM supplies the exact mapped centre. Door dimensions (in metres) are
    # representational. They do not certify size, styling, materials or bay count.
    half = min(0.75, along, length - along)
    band = dict(
      kind="entrance",
      columns=1,
      rows=1,
      x=[round((along - half) / length, 5), round((along + half) / length, 5)],
      y=[0, round(2.15 / (face["high"] - face["low"]), 5)],
      fillX=1,
      fillY=1,
    )
    yield face, band, door["id"]


def same_plane_overlap(a, band, b, other):
  """A newer field supersedes an overlapping old field on the same real plane."""
  na, nb = a["normal"], b["normal"]
  if na[0] * nb[0] + na[1] * nb[1] < 0.994:
    return False

  def project(f, axis, origin):
    return [
      sum((p[k] - origin[k]) * axis[k] for k in range(2)) for p in [f["a"], f["b"]]
    ]

  if max(abs(d) for d in project(b, na, a["a"])) > 0.65:
    return False
  length = math.dist(a["a"], a["b"])
  tangent = [(a["b"][k] - a["a"][k]) / length for k in range(2)]

  def interval(bounds, vs):
    return sorted(bounds[0] + v * (bounds[1] - bounds[0]) for v in vs)

  left = interval((0, length), band["x"])
  right = interval(project(b, tangent, a["a"]), other["x"])
  height = interval((a["low"], a["high"]), band["y"])
  oth = interval((b["low"], b["high"]), other["y"])
  return (
    min(left[1], right[1]) - max(left[0], right[0]) > 0.035
    and min(height[1], oth[1]) - max(height[0], oth[0]) > 0.035
  )


def build(rank, surveys, photos, manual):
  profiles, recipes = [], {}
  targets, stats = {}, {}
  for target in rank["targets"]:
    owner = target["id"]
    faces = {}
    counts = defaultdict(int)

    def add(face, bands):
      key = segment_id(face)
      if key not in faces:
        faces[key] = (
          {
            k: face[k]
            for k in ("a", "b", "normal", "low", "high", "wallId")
            if k in face
          },
          [],
        )
      dest = faces[key][1]
      for band in bands:
        if band not in dest:
          dest.append(band)

    current = []
    for record in manual.get(owner, []):
      if "normal" not in record:
        angle = math.radians(record["azimuth"])
        record = {**record, "normal": [math.sin(angle), -math.cos(angle)]}
      current.append(record)

    def eligible(face, band):
      return not any(
        same_plane_overlap(face, band, record, patch)
        for record in current
        for patch in record["bands"]
      )

    readings = photos["targets"].get(owner, [])
    surveyed = [r for r in readings if r.get("wallId")]
    for obs in readings:
      observed = [
        band
        for band in obs["bands"]
        if eligible(obs, band)
        and (
          "wallId" in obs
          or not any(
            same_plane_overlap(obs, band, wall, layer)
            for wall in surveyed
            for layer in wall["bands"]
          )
        )
      ]
      if observed:
        add(obs, observed)
      for band in observed:
        counts[band["kind"]] += band["columns"] * band["rows"]
    for face, band, _ in doorway_candidates(target, surveys["targets"][owner]):
      if eligible(face, band):
        add(face, [band])
        counts["mappedEntrances"] += 1
    for record in current:
      add(record, record["bands"])
      counts["currentPhotoBands"] += len(record["bands"])
    fronts = []
    for face, bands in sorted(faces.values(), key=lambda pair: segment_id(pair[0])):
      encoded = compact(bands)
      if encoded not in recipes:
        recipes[encoded] = len(profiles)
        profiles.append(bands)
      front = {k: face[k] for k in ("a", "b", "low", "high", "wallId") if k in face}
      fronts.append(
        dict(
          **front,
          azimuth=azimuth(face["normal"]),
          tolerance=38,
          profile=recipes[encoded],
        )
      )
    targets[owner] = {"fronts": fronts}
    stats[owner] = {"fronts": len(fronts), **counts}
  return {"profiles": profiles, "targets": targets}, stats


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--rank", type=Path, default=GEO / "windowless-buildings-v377.json"
  )
  parser.add_argument(
    "--surveys", type=Path, default=GEO / "building-facade-surveys-v377.json.gz"
  )
  parser.add_argument(
    "--photos", type=Path, default=GEO / "facade-photo-readings-v377.json.gz"
  )
  parser.add_argument("--manual", type=Path, default=GEO / "facade-evidence-v377.json")
  parser.add_argument(
    "--retail", type=Path, default=GEO / "retail-and-housing-fronts-v377.json"
  )
  parser.add_argument(
    "--primary", type=Path, default=GEO / "primary-building-fronts-v377.json"
  )
  parser.add_argument(
    "--research", type=Path, default=GEO / "research-and-event-fronts-v377.json"
  )
  parser.add_argument(
    "--projects", type=Path, default=GEO / "industrial-and-campus-fronts-v377.json"
  )
  parser.add_argument(
    "--output", type=Path, default=DATA / "buildingFacadeProfilesV377.json"
  )
  parser.add_argument("--capture-cadastral", type=Path)
  parser.add_argument("--capture-osm", type=Path)
  parser.add_argument("--capture-photos", type=Path, action="append")
  parser.add_argument("--stats", type=Path)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  rank = load(args.rank)
  if args.capture_cadastral or args.capture_osm:
    if not (args.capture_cadastral and args.capture_osm):
      parser.error("Provide both ALKIS and OSM extracts")
    save(
      args.surveys,
      capture_surveys(rank, args.capture_cadastral, args.capture_osm),
      args.check,
    )
  if args.capture_photos:
    save(args.photos, capture_photos(rank, args.capture_photos), args.check)
  measured = defaultdict(list)
  for survey in (args.manual, args.retail, args.projects, args.research, args.primary):
    evidence = load(survey)
    for site in evidence.get("sites", []):
      measured[site["owner"]].extend(site.get("fronts", []))
    for owner, readings in evidence.get("fronts", {}).items():
      measured[owner].extend(readings)
  catalog, stats = build(rank, load(args.surveys), load(args.photos), measured)
  save(args.output, catalog, args.check)
  if args.stats:
    save(args.stats, stats)


if __name__ == "__main__":
  main()
