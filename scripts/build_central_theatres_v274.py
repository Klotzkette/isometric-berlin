"""Bounded theatre roof architecture, with an exact old Palast-plan receipt."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path

from shapely.geometry import Point, Polygon

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
CACHE = Path.home() / ".cache/codex-berlin-v274/central-theatres"
PARENTS = {
  "deutsches": "DEBE01YYK00002VR",
  "kammer": "DEBE01YYK000037b",
  "ensemble": "DEBE01YYK00004vY",
  "boell": "DEBE01YYK00003sO",
  "palast": "DEBE01YYK0000AUt",
}
STAGE = {
  "u": -0.5,
  "out": -66.5,
  "width": 31.0,
  "depth": 23.0,
  "baseY": 25.2,
  "topY": 37.2,
  "capY": 37.44,
}
AXIS = (3.713 / math.hypot(3.713, 49.535), 49.535 / math.hypot(3.713, 49.535))
YAW = -math.atan2(AXIS[1], AXIS[0])


def write(path: Path, data: object) -> None:
  raw = (json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def palast(u: float, y: float, out: float) -> list[float]:
  a, b = AXIS
  return [1135.4015 + a * u - b * out, y, -535.6215 + b * u + a * out]


def extract() -> dict:
  """All original parts/sheets remain evidence; none is retired by this pass."""
  archive = GEO / "raw/lod2/LoD2_390_5820.zip"
  parents = {}
  for name, pid in PARENTS.items():
    parent = extract_parent(archive, pid)
    parents[name] = {
      "id": pid,
      "parts": [part_profile(p) for p in leaf_building_parts(parent) or [parent]],
    }
  prior = json.loads((CACHE / "palast-previous.json").read_text())
  bdom = json.loads((CACHE / "palast-bdom.json").read_text())
  dop = {
    name: json.loads((CACHE / f"{name}-request.json").read_text())
    for name in ["palast", "deutsches-boell", "ensemble"]
  }
  voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  vox = json.loads(voxel_path.read_text())
  columns = []
  for iz, row in enumerate(vox["building_rows"]):
    z = (vox["grid"]["min_z_idx"] + iz + 0.5) * vox["cell_m"]
    if not -630 <= z <= -300:
      continue
    for ix, n, y0, y1, *_ in row:
      for j in range(n):
        x = (vox["grid"]["min_x_idx"] + ix + j + 0.5) * vox["cell_m"]
        if (740 < x < 780 and -630 < z < -590) or (970 < x < 1010 and -345 < z < -305):
          columns.append([x, z, y0 / 10, y1 / 10])
  bindings = {
    p: sha(ROOT / p)
    for p in [
      "src/app/src/deutschesTheaterPrisms.json",
      "src/app/src/boellStiftungPrisms.json",
      "src/app/src/data/volksbuehneEnvelopeV209.json",
      "geo_data/regierungsviertel/volksbuehne-v209-source.json",
      "geo_data/regierungsviertel/volksbuehne-v209-bdom-samples.json",
    ]
  }
  return {
    "schemaVersion": 1,
    "archive": {"path": str(archive.relative_to(ROOT)), "sha256": sha(archive)},
    "parents": parents,
    "previousPalastPlans": prior,
    "palastBdomSamples": bdom,
    "dop2025": dop,
    "sourcePolicy": "All original parts and prior facade details retained. Only exact prior Palast stage recipe is replaced; no source sheet or ordinary neighbour is retired.",
    "sourceBindings": bindings,
    "references": [
      {
        "url": "https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/efriedrichstrasse-107.pdf",
        "role": "LDA: Palast main building 110 x 80 x 20m; stage tower 32m high, 23m short dimension",
      },
      {
        "url": "https://www.palast.berlin/wp-content/uploads/2024/11/Der-Palast-in-Berlin-FactSheet_FF.pdf",
        "role": "Palast operator, identity and stage-building context",
      },
      {
        "url": "https://www.deutschestheater.de/service/technikportal",
        "role": "Operator: Deutsches Theater and separate Kammerspiele",
      },
      {
        "url": "https://www.ernst-architekten.de/portfolio-items/deutsches-theater-berlin/",
        "role": "Architect: roof/stage-building refurbishment context",
      },
      {
        "url": "https://www.berliner-ensemble.de/index.php/das-theater-am-schiffbauerdamm",
        "role": "Operator: theatre identity and building history",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011192",
        "role": "LDA: Theatre am Schiffbauerdamm",
      },
      {
        "url": "https://www.boell.de/de/das-stiftungshaus-der-schumannstrasse",
        "role": "Operator: built headquarters, roof atrium and environmental design",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080037",
        "role": "LDA: Volksbuehne; retained measured v209 stage, auditorium and rear roof remain authoritative",
      },
    ],
    "boellPrisms": json.loads(
      (ROOT / "src/app/src/boellStiftungPrisms.json").read_text()
    ),
    "nativeRoofColumns": {
      "path": str(voxel_path.relative_to(ROOT)),
      "sha256": sha(voxel_path),
      "cellM": vox["cell_m"],
      "columns": columns,
    },
    "heightPolicy": "Palast stage height 32m and 23m short dimension from LDA. Long axis 31m and local position interpreted from DOP2025 and 56 bounded bDOM checks, not surveyed boundary coordinates. Other fittings are small image-based estimates on retained measured roofs.",
  }


def build(evidence: dict) -> dict:
  rows: dict[str, list] = {"palast": [], "other": []}
  labels: list[str] = []
  owners: list[str] = []

  def emit(
    site: str, owner: str, role: str, p: list, size: list, yaw: float, color: int
  ) -> None:
    if role not in labels:
      labels.append(role)
    if owner not in owners:
      owners.append(owner)
    rows["palast" if site == "palast" else "other"].append(
      [*p, *size, yaw, color, labels.index(role), owners.index(owner)]
    )

  def pbox(u, y, out, w, h, d, color, role):
    emit("palast", PARENTS["palast"], role, palast(u, y, out), [w, h, d], YAW, color)

  # Correct long/short directions and setback of the upper theatre body. Closed
  # five-surface shell, not an opaque hidden solid or a painted replacement cap.
  u, v, w, d, lo, top = [
    STAGE[k] for k in ["u", "out", "width", "depth", "baseY", "topY"]
  ]
  for side in [-1, 1]:
    pbox(
      u + side * (w / 2 - 0.25),
      (lo + top) / 2,
      v,
      0.5,
      top - lo,
      d,
      0xBCB9AA,
      "v274 stage end wall",
    )
    pbox(
      u,
      (lo + top) / 2,
      v + side * (d / 2 - 0.25),
      w - 1,
      top - lo,
      0.5,
      0xC6C2B3,
      "v274 stage long wall",
    )
    pbox(
      u + side * (w / 2 - 0.15),
      top + 0.12,
      v,
      0.3,
      0.24,
      d,
      0xD5D1C3,
      "v274 stage coping",
    )
    pbox(
      u,
      top + 0.12,
      v + side * (d / 2 - 0.15),
      w,
      0.24,
      0.3,
      0xD5D1C3,
      "v274 stage coping",
    )
  pbox(u, top - 0.12, v, w, 0.24, d, 0x7D8583, "v274 stage roof")
  for a in range(-14, 15, 2):
    for side in [-1, 1]:
      pbox(
        u + a,
        (lo + top) / 2,
        v + side * (d / 2 + 0.04),
        0.065,
        top - lo - 0.2,
        0.07,
        0x8E938D,
        "v274 stage vertical panel reveal",
      )
  # Roof smoke hatches and service upstands are read from the orthophoto, not
  # invented additional storeys. Their maximum top stays below the coping.
  for a, b, ww, dd in [(-8, 0, 4.2, 2.1), (0, -3.8, 6.4, 2.3), (8.2, 4, 3.8, 1.8)]:
    pbox(
      u + a, top + 0.04, v + b, ww, 0.16, dd, 0xA9ACA3, "v274 stage roof hatch upstand"
    )
    pbox(
      u + a,
      top + 0.14,
      v + b,
      ww - 0.2,
      0.04,
      dd - 0.2,
      0x3D484A,
      "v274 stage roof hatch glazing",
    )
  for a in [-14, -10, -6, -2, 2, 6, 10, 14]:
    pbox(
      u + a,
      top + 0.025,
      v,
      0.035,
      0.025,
      d - 0.6,
      0xB7BAB1,
      "v274 stage standing roof seam",
    )

  def frame(site, owner, centre, yaw, w, d, top, role, color=0xCCD1CB):
    x, y, z = centre
    c, s = math.cos(yaw), -math.sin(yaw)
    for side in [-1, 1]:
      emit(
        site,
        owner,
        role,
        [x + c * side * w / 2, y + top / 2, z + s * side * w / 2],
        [0.12, top, d + 0.12],
        yaw,
        color,
      )
      emit(
        site,
        owner,
        role,
        [x - s * side * d / 2, y + top / 2, z + c * side * d / 2],
        [w + 0.12, top, 0.12],
        yaw,
        color,
      )

  def roof_hatch(site, owner, p, yaw, w, d, height):
    emit(
      site,
      owner,
      "raised roof monitor curb",
      [p[0], p[1] + height / 2, p[2]],
      [w, height, d],
      yaw,
      0xC7CCC5,
    )
    emit(
      site,
      owner,
      "roof monitor glazing",
      [p[0], p[1] + height + 0.03, p[2]],
      [w - 0.2, 0.06, d - 0.2],
      yaw,
      0x45595C,
    )
    frame(
      site,
      owner,
      [p[0], p[1] + height, p[2]],
      yaw,
      w,
      d,
      0.13,
      "roof monitor raised frame",
    )

  # Deutsches Theater: the 25.3m stage body is retained, now with its physical
  # perimeter roof edge, smoke vents and roof service casing. Front courtyards,
  # pediments, the DT mark and every old window are unaffected.
  dt = next(
    p for p in evidence["parents"]["deutsches"]["parts"] if p["id"].endswith("5900rDXT")
  )
  ring = dt["ring"]
  poly = Polygon(ring)
  p = poly.centroid
  yaw = -math.atan2(ring[1][1] - ring[0][1], ring[1][0] - ring[0][0])
  owner = dt["id"]
  for a, b in zip(ring, ring[1:] + ring[:1]):
    length = math.dist(a, b)
    if length < 0.5:
      continue
    emit(
      "deutsches",
      owner,
      "DT measured stage roof cornice",
      [(a[0] + b[0]) / 2, 30.56, (a[1] + b[1]) / 2],
      [length, 0.12, 0.24],
      -math.atan2(b[1] - a[1], b[0] - a[0]),
      0xB5BCB7,
    )
  for dx, dz in [(-4, -4), (4, -4), (-4, 4), (4, 4)]:
    roof_hatch("deutsches", owner, [p.x + dx, 30.5, p.y + dz], yaw, 1.6, 2.2, 0.36)

  # BE: distinct long roof ridge with three shallow smoke-monitor bodies, all
  # well within the measured main roof; the separate moving sign is untouched.
  be_owner = "DEBE3DYN6lQyofA6"
  be_centre = [988.8, 23.2, -327.3]
  yaw = -math.atan2(21.1, -26.7)
  for a in [-7, 0, 7]:
    roof_hatch(
      "ensemble",
      be_owner,
      [
        be_centre[0] + math.cos(yaw) * a,
        be_centre[1],
        be_centre[2] - math.sin(yaw) * a,
      ],
      yaw,
      1.6,
      1.2,
      0.45,
    )

  # Böll: the roof atrium is a framed physical cover. It previously existed as
  # an almost coplanar 12mm field. Keep that whole field, add shallow curb/glass
  # beams and the paired service housings, never fill the ground cantilever.
  core = next(
    p for p in evidence["parents"]["boell"]["parts"] if p["id"].endswith("G9NcorMt")
  )
  legacy = next(p for p in evidence["boellPrisms"] if p["id"] == "G9NcorMt")
  ring = [[x / 10, z / 10] for x, z in legacy["ring"]]
  a, b = ring[:2]
  length = math.dist(a, b)
  tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1]))
  sign = 1 if area >= 0 else -1
  nx, nz = tz * sign, -tx * sign

  def bp(u, v, y):
    return [ring[0][0] + tx * u - nx * v, y, ring[0][1] + tz * u - nz * v]

  yaw = -math.atan2(tz, tx)
  frame(
    "boell",
    core["id"],
    bp(12, 19, 28.81),
    yaw,
    9.1,
    9.3,
    0.55,
    "Boll raised atrium cover rim",
    0xC6CDCA,
  )
  for du in [-3, -1.5, 0, 1.5, 3]:
    emit(
      "boell",
      core["id"],
      "Boll atrium cover structural beam",
      bp(12 + du, 19, 29.37),
      [0.09, 0.16, 9.2],
      yaw,
      0xCBD3CE,
    )
  for v in [13, 19]:
    emit(
      "boell",
      core["id"],
      "Boll roof service housing",
      bp(21.6, v, 29.1),
      [2.4, 0.6, 4.1],
      yaw,
      0xBBC2BC,
    )

  # Volksbühne: retain the full v209 stage/drum/gable. Add the actual stepped
  # roof perimeter, central monitor and auditorium smoke heads seen in the DOP.
  vb = json.loads((DATA / "volksbuehneEnvelopeV209.json").read_text())
  stage = vb["volumes"][0]
  ring = stage["footprint"]["coordinates"][0][:-1]
  a, b = ring[:2]
  yaw = -math.atan2(b[1] - a[1], b[0] - a[0])
  poly = Polygon(ring)
  c = poly.centroid
  for a, b in zip(ring, ring[1:] + ring[:1]):
    emit(
      "volksbuehne",
      vb["owner"],
      "Volksbuhne stage parapet",
      [(a[0] + b[0]) / 2, 42.43, (a[1] + b[1]) / 2],
      [math.dist(a, b), 0.35, 0.3],
      -math.atan2(b[1] - a[1], b[0] - a[0]),
      0xC1C1B6,
    )
  roof_hatch("volksbuehne", vb["owner"], [c.x, 42.254, c.y], yaw, 5.3, 5.6, 0.38)
  origin = [2748.6705, -811.36]
  tx, tz = 0.8976526046127071, 0.44070375699785336
  for u, v in [(-7, -14), (0, -14), (7, -14), (-7, -24), (7, -24)]:
    roof_hatch(
      "volksbuehne",
      vb["owner"],
      [origin[0] + tx * u - tz * v, 28.889, origin[1] + tz * u + tx * v],
      yaw,
      1.1,
      1.1,
      0.4,
    )

  # Independent axis-aligned native surface cells. Native support on the three
  # older 4m core roofs follows retained column rounding, not hidden smooth doubles.
  native: dict[str, list] = {"palast": [], "other": []}
  for family, boxes in rows.items():
    for row in boxes:
      x, y, z, w, h, d, yaw, color, role, owner = row
      c, s = math.cos(yaw), -math.sin(yaw)
      ring = [
        (x + c * u - s * v, z + s * u + c * v)
        for u, v in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
      ]
      if owners[owner].endswith("5900rDXT"):
        y += 2.7  # exact retained 4m column cap 33.2 versus measured 30.5
      elif owners[owner].endswith("6lQyofA6"):
        y += 4.8  # retained ridge columns reach 28/28.1; curb embeds by up to .1m
      elif owners[owner] == vb["owner"]:
        y += 0.746 if row[1] > 40 else 0.111  # retained independent v209 stepped caps
      # A thin plane becomes connected unrotated strips; large horizontal sheets
      # become square surface tiles. There is no volumetric grid fill.
      if min(w, d) < 0.6:
        n = max(1, math.ceil(max(w, d) / 0.4))
        for i in range(n):
          u = (i + 0.5) / n - 0.5
          dx, dz = (c * w * u, s * w * u) if w >= d else (-s * d * u, c * d * u)
          ww, dd = (
            (
              max(0.12, abs(c * w / n) + abs(s * d)),
              max(0.12, abs(s * w / n) + abs(c * d)),
            )
            if w >= d
            else (
              max(0.12, abs(s * d / n) + abs(c * w)),
              max(0.12, abs(c * d / n) + abs(s * w)),
            )
          )
          native[family].append([x + dx, y, z + dz, ww, h, dd, 0, color, role, owner])
      else:
        poly = Polygon(ring)
        minx, minz, maxx, maxz = poly.bounds
        q = 0.7
        for ix in range(math.floor(minx / q), math.ceil(maxx / q)):
          for iz in range(math.floor(minz / q), math.ceil(maxz / q)):
            xx, zz = (ix + 0.5) * q, (iz + 0.5) * q
            if not poly.covers(Point(xx, zz)):
              continue
            # Adjacent closed surface cells must meet. Centre inclusion limits
            # boundary overhang to half a cell, without cracks from shrunken tiles.
            native[family].append([xx, y, zz, q, h, q, 0, color, role, owner])

  def encode(boxes):
    raw = [v for box in boxes for v in box[:8]]
    return base64.b64encode(struct.pack(f"<{len(raw)}f", *raw)).decode()

  return {
    "schemaVersion": 1,
    "stage": STAGE,
    "roles": labels,
    "owners": owners,
    "palastPrevious": evidence["previousPalastPlans"],
    "drawn": {k: encode(v) for k, v in rows.items()},
    "native": {k: encode(v) for k, v in native.items()},
    "sourceBoxes": rows,
    "counts": {
      "drawn": {k: len(v) for k, v in rows.items()},
      "native": {k: len(v) for k, v in native.items()},
    },
    "boundsPolicy": "Source-bound static roof fittings and exact receipted Palast stage replacement only. Full drawn detail on mobile; independent orthogonal native surface cells.",
  }


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  evidence_path = GEO / "central-theatres-v274-evidence.json.gz"
  if args.refresh_source or not evidence_path.exists():
    evidence = extract()
    write(evidence_path, evidence)
  else:
    evidence = json.loads(gzip.decompress(evidence_path.read_bytes()))
  for path, digest in evidence["sourceBindings"].items():
    if sha(ROOT / path) != digest:
      raise ValueError(f"Retained source changed: {path}")
  result = build(evidence)
  write(DATA / "centralTheatresV274.json", result)
  print(
    json.dumps(
      {
        "counts": result["counts"],
        "runtimeBytes": (DATA / "centralTheatresV274.json").stat().st_size,
        "evidenceBytes": (GEO / "central-theatres-v274-evidence.json.gz")
        .stat()
        .st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
