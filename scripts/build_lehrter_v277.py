"""Complete retained Lehrter cultural/police sources and bounded facade recognition.

The only retired owners are four exact old presentation records. All original
surfaces, old records and footprint differences remain independently recorded.
"""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from shapely import make_valid
from shapely.geometry import Polygon, box, mapping
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_theatres_v272 import frames, native_shell
from scripts.native_facade_clearance_v272 import NativeFacadeClearance

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "lehrter-v277-source.json.gz"
EVIDENCE = GEO / "lehrter-v277-evidence.json.gz"
IDS = ("ui4o8MEJ", "hlcQTuwD", "UEwVyTdb", "37687041")
POLICY = (
  "Complete measured Kulturfabrik and police source sheets replace only four exact "
  "coarse prisms and exclusive original native columns. Every original source "
  "sheet, earlier source record, old-only footprint complement and prior street "
  "node is retained. The current datum stays 5.2m. Facade subdivisions, lettering, "
  "fine relief and fitting sizes are documented display estimates. Kulturfabrik "
  "is Lehrter35, Slaughterhouse its rear ground floor; the police address is "
  "Kruppstrasse2-4. No claim that former Lehrter60/61 is police. No coverage, "
  "budget, mobile-detail, texture, animation or road replacement changes."
)
REFS = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050403",
  "https://kulturfabrik-moabit.de/ueber-uns/geschichte/",
  "https://kulturfabrik-moabit.de/wp-content/uploads/2016/06/fassade_leerstand.jpg",
  "https://kulturfabrik-moabit.de/gruppen/filmrauschpalast/",
  "https://kulturfabrik-moabit.de/gruppen/slaughterhouse/",
  "https://kulturfabrik-moabit.de/kontakt/vermietung/",
  "https://www.bim-berlin.de/ueber-uns/nachhaltigkeit/foerdermassnahmen",
  "https://www.karriereportal-stellen.berlin.de/SachbearbeiterinSachbearbeiter-Digitalisierung-in-der-Land-de-j70665.html",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050323",
]


def read(path: Path) -> Any:
  """Read one local immutable source file."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  """Write deterministic compact derived data, never an old source."""
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Hash a source without allocating a duplicate byte buffer."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def extract(cache: Path) -> dict[str, Any]:
  """Freeze complete official profiles and exact old public source ownership."""
  import pyogrio

  from scripts.build_district_facades_v188 import world

  prior_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = read(prior_path)["buildings"]
  previous = []
  for owner in IDS:
    matches = [p for p in prisms if p["id"] == owner]
    assert len(matches) == 1
    previous.append(matches[0])
  kultur = read(cache / "lehrter-parts.json.gz")["DEBE01YYK0002RHX"]
  police = read(cache / "lehrter-police-source.json.gz")["237687041"][0]
  parents = [
    dict(
      key="kulturfabrik",
      id="DEBE01YYK0002RHX",
      name="Kulturfabrik Moabit",
      address="Lehrter Straße 35",
      osm="way/433272041",
      sourceParts=kultur,
      legacyIds=list(IDS[:3]),
    ),
    dict(
      key="polizei",
      id=police["id"],
      name="Polizeiliegenschaft Kruppstraße",
      address="Kruppstraße 2–4",
      osm="way/237687041",
      sourceParts=police["parts"],
      legacyIds=[IDS[3]],
    ),
  ]
  roads = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="lines",
    where="name = 'Lehrter Straße'",
  ).to_crs(25833)
  street_rows = [
    dict(
      id=str(r.osm_id),
      geometry=mapping(world(r.geometry)),
      highway=r.highway,
      tags=r.other_tags,
    )
    for r in roads.itertuples()
  ]
  source = dict(
    schemaVersion=1,
    parents=parents,
    previousPrisms=previous,
    archive=dict(
      url="https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5821.zip",
      sha256=sha(cache / "LoD2_388_5821.zip"),
    ),
    previousFile=str(prior_path.relative_to(ROOT)),
    previousFileSha256=sha(prior_path),
    streetSource=dict(
      path="geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
      sha256=sha(GEO / "raw/outer-v159/candidate.gpkg"),
    ),
    streetRows=street_rows,
    references=REFS,
    policy=POLICY,
  )
  write(SOURCE, source)
  return source


def polygon(part: dict[str, Any]) -> Any:
  """Node every crossing without dropping any polygonized old source fragment.

  Exact original decimetre rings remain in the ownership receipt. The one
  self-crossing ring is interpreted with GEOS linework, not a largest-part
  buffer repair; this retains both sides of its crossing.
  """
  raw = Polygon(
    [(x / 10, z / 10) for x, z in part["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in part.get("holes", [])],
  )
  return raw if raw.is_valid else make_valid(raw)


def prepare(source: dict[str, Any]) -> dict[str, Any]:
  """Retain complete roofs and preserve every old-only outline sliver explicitly."""
  result = copy.deepcopy(source)
  result["surfaces"], result["parts"], result["conflicts"] = [], [], []
  result["quantizedRingRepairs"] = [
    dict(
      id=p["id"],
      originalRing=p["ring"],
      polygonized=mapping(polygon(p)),
      policy="Complete make_valid linework; every bounded component retained",
    )
    for p in source["previousPrisms"]
    if not Polygon(p["ring"], p["holes"]).is_valid
  ]
  old = {p["id"]: p for p in source["previousPrisms"]}
  for parent in result["parents"]:
    ground = min(p["ground_y_m"] for p in parent["sourceParts"])
    parent["datumShift"] = 5.2 - ground
    source_foot = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in parent["sourceParts"]]
    )
    for part in parent["sourceParts"]:
      part["sourceId"] = (
        part["id"][-8:] if parent["key"] == "kulturfabrik" else parent["legacyIds"][0]
      )
      part["parentId"] = parent["id"]
      part["minY"] = part["ground_y_m"] + parent["datumShift"]
      part["maxY"] = part["top_y_m"] + parent["datumShift"]
      for surface in part["surfaces"]:
        ss = copy.deepcopy(surface)
        ss.update(partId=part["id"], parentId=parent["id"], key=parent["key"])
        for ring in ss["rings"]:
          for v in ring:
            v[1] = round(v[1] + parent["datumShift"], 3)
        ss["triangles"] = triangles_for(ss["rings"])
        ss["color"] = (
          (0x656861 if parent["key"] == "kulturfabrik" else 0x737A79)
          if ss["kind"] == "RoofSurface"
          else (0xD1C6B1 if parent["key"] == "kulturfabrik" else 0xC7C8BA)
        )
        result["surfaces"].append(ss)
      result["parts"].append(
        {
          k: part[k]
          for k in ["id", "sourceId", "parentId", "ring", "holes", "minY", "maxY"]
        }
      )
    old_foot = unary_union([polygon(old[k]) for k in parent["legacyIds"]])
    difference = old_foot.difference(source_foot)
    result["conflicts"].append(
      dict(
        parentId=parent["id"],
        oldArea=old_foot.area,
        sourceArea=source_foot.area,
        overlapM2=old_foot.intersection(source_foot).area,
        oldOnlyAreaM2=difference.area,
        sourceOnlyAreaM2=source_foot.difference(old_foot).area,
        oldOnlyGeometry=mapping(difference),
        policy="Every old-only fragment retained at original old prism height; no silent outline loss.",
      )
    )
    for legacy in parent["legacyIds"]:
      p = old[legacy]
      residual = polygon(p).difference(source_foot)
      pieces = list(residual.geoms) if hasattr(residual, "geoms") else [residual]
      for i, poly in enumerate(pieces):
        if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 1e-9:
          continue
        ring = [list(v) for v in list(poly.exterior.coords)[:-1]]
        holes = [[list(v) for v in list(h.coords)[:-1]] for h in poly.interiors]
        lo, hi = p["y0_dm"] / 10, (p["y0_dm"] + p["h_dm"]) / 10
        identifier = f"{legacy}:old-outline:{i}"
        result["parts"].append(
          dict(
            id=identifier,
            sourceId=legacy,
            parentId=parent["id"],
            ring=ring,
            holes=holes,
            minY=lo,
            maxY=hi,
            legacyComplement=True,
          )
        )
        sheets = [("RoofSurface", [[[x, hi, z] for x, z in r] for r in [ring, *holes]])]
        for r in [ring, *holes]:
          for a, b in zip(r, r[1:] + r[:1]):
            sheets.append(
              (
                "WallSurface",
                [
                  [
                    [a[0], lo, a[1]],
                    [b[0], lo, b[1]],
                    [b[0], hi, b[1]],
                    [a[0], hi, a[1]],
                  ]
                ],
              )
            )
        for kind, rings in sheets:
          result["surfaces"].append(
            dict(
              kind=kind,
              rings=rings,
              triangles=triangles_for(rings),
              color=0xC7C1AE,
              partId=identifier,
              parentId=parent["id"],
              key=parent["key"],
              legacyComplement=True,
            )
          )
  return result


def recognition(
  source: dict[str, Any], blocks: list[Any]
) -> tuple[list[Any], list[Any], list[Any], list[Any]]:
  """Fit explicit primary-photo interpretations only onto actual public walls."""
  detailed = {
    **source,
    "surfaces": [s for s in source["surfaces"] if not s.get("legacyComplement")],
  }
  ff = frames(detailed)
  clearance = NativeFacadeClearance(blocks)
  drawn, native, ribs, labels = [], [], [], []
  receipts = []

  def put(
    f: dict,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: str,
    out: float = 0.18,
    depth: float = 0.10,
  ) -> None:
    if (
      not f["poly"].buffer(0.02).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    ):
      return
    p = f["a"] + f["d"] * u + f["n"] * out
    drawn.append(
      [
        *map(float, [p[0], y, p[1], w, h, depth]),
        float(math.atan2(-f["d"][1], f["d"][0])),
        color,
        role,
      ]
    )
    receipts.append(dict(sheet=f["sheet"], u=u, y=y, width=w, height=h, role=role))
    count = max(1, math.ceil(w / 0.65))
    for i in range(count):
      rw = max(0.07, abs(f["d"][0]) * w / count + abs(f["n"][0]) * depth)
      rd = max(0.07, abs(f["d"][1]) * w / count + abs(f["n"][1]) * depth)
      q = clearance.position(f, u + (i + 0.5) * w / count - w / 2, y, rw, h, rd, out)
      native.append(
        [float(q[0]), y, float(q[1]), float(rw), h, float(rd), 0, color, role]
      )

  def beam(
    f: dict,
    u: float,
    y: float,
    v: float,
    yy: float,
    width: float,
    color: int,
    role: str,
  ) -> None:
    a = f["a"] + f["d"] * u + f["n"] * 0.31
    b = f["a"] + f["d"] * v + f["n"] * 0.31
    ribs.append(
      [
        [float(a[0]), y, float(a[1])],
        [float(b[0]), yy, float(b[1])],
        width,
        color,
        role,
      ]
    )
    native.extend(clearance.segment(f, u, y, v, yy, width, color, role, 0.18))

  def label(f: dict, text: str, u: float, y: float, height: float, color: int) -> None:
    a = f["a"] + f["d"] * u + f["n"] * 0.43
    na = clearance.position(
      f,
      u,
      y + height / 2,
      len(text) * height,
      height,
      0.2,
      0.3,
      span_u=len(text) * height / 2,
      half_normal=0.2,
    )
    labels.append(
      dict(
        text=text,
        a=a.tolist(),
        nativeA=na.tolist(),
        n=f["n"].tolist(),
        d=f["d"].tolist(),
        y=y,
        height=height,
        color=color,
      )
    )

  # Ring-split front is deliberately recombined only along its exact coplanar
  # retained street edge; three old surfaces remain independently in the shell.
  a = np.array([-789.476, -1716.036])
  b = np.array([-795.547, -1728.581])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([d[1], -d[0]])
  front = dict(
    a=a,
    d=d,
    n=n,
    length=float(np.linalg.norm(b - a)),
    poly=box(0, 5.2, float(np.linalg.norm(b - a)), 26.59),
    sheet="three-coplanar-Kulturfabrik-front-sheets",
  )
  length = front["length"]
  pitch = (length - 1.3) / 3
  axes = [0.65 + (i + 0.5) * pitch for i in range(3)]
  # Five storeys, double rectangular lights below a round-arched upper register.
  for i in range(4):
    u = 0.65 + i * pitch
    put(
      front, u, 17.3, 0.44, 16.6, 0xC6BCA7, "kultur-monumental-stone-pier", 0.25, 0.24
    )
  for axis in axes:
    for yy in [11.3, 15.8, 20.3]:
      put(front, axis, yy, pitch - 0.85, 3.35, 0x4B6265, "kultur-paired-window")
      for du in [-(pitch - 0.85) / 2, 0, (pitch - 0.85) / 2]:
        put(front, axis + du, yy, 0.09, 3.45, 0xE9E1CD, "kultur-window-mullion", 0.31)
      put(
        front,
        axis,
        yy + 0.55,
        pitch - 0.85,
        0.10,
        0xE9E1CD,
        "kultur-window-transom",
        0.31,
      )
      put(
        front,
        axis,
        yy - 1.86,
        pitch - 0.57,
        0.22,
        0xE0D5BF,
        "kultur-window-sill",
        0.31,
        0.25,
      )
      if yy < 20:
        put(
          front,
          axis,
          yy + 2.17,
          pitch - 0.95,
          0.63,
          0xB9AD95,
          "kultur-relief-spandrel",
          0.27,
          0.18,
        )
        for du in [-0.65, 0.65]:
          put(
            front,
            axis + du,
            yy + 2.17,
            0.48,
            0.36,
            0xD8CAB0,
            "kultur-relief-panel",
            0.37,
            0.08,
          )
    radius = (pitch - 0.8) / 2
    spring = 23.55
    put(
      front, axis, spring - 0.38, radius * 2, 0.8, 0x435B60, "kultur-upper-arched-light"
    )
    for j in range(12):
      yy = spring + (j + 0.5) * radius / 12
      ww = 2 * math.sqrt(max(0, radius**2 - (yy - spring) ** 2))
      put(
        front, axis, yy, ww, radius / 12 + 0.012, 0x435B60, "kultur-upper-arched-light"
      )
    for j in range(20):
      aa = math.pi * j / 20
      bb = math.pi * (j + 1) / 20
      beam(
        front,
        axis + radius * math.cos(aa),
        spring + radius * math.sin(aa),
        axis + radius * math.cos(bb),
        spring + radius * math.sin(bb),
        0.16,
        0xE5D9C2,
        "kultur-three-round-arch-rims",
      )
    put(front, axis, 23.78, 0.10, 2.13, 0xDDD7C5, "kultur-upper-window-mullion", 0.35)
    put(
      front,
      axis,
      23.62,
      pitch - 0.8,
      0.09,
      0xDDD7C5,
      "kultur-upper-window-transom",
      0.35,
    )
    for du in np.linspace(-radius, radius, 9):
      put(
        front,
        axis + float(du),
        22.38,
        0.09,
        0.47,
        0xE3D8BE,
        "kultur-balustrade-spindles",
        0.32,
        0.16,
      )
  for yy, h, dep in [
    (9.12, 0.25, 0.32),
    (22.02, 0.22, 0.28),
    (22.72, 0.18, 0.28),
    (26.28, 0.28, 0.3),
  ]:
    put(front, length / 2, yy, length - 0.12, h, 0xDAD0B9, "kultur-cornice", 0.3, dep)
  # The portal and two ground arches are photographic estimates, not surveyed
  # metric apertures. They do not create an invented navigable tunnel.
  for axis in axes:
    put(front, axis, 6.5, pitch - 0.8, 2.3, 0x43514B, "kultur-ground-opening")
    if axis == axes[0]:
      put(front, axis, 8.12, pitch - 0.8, 0.95, 0x43514B, "kultur-ground-left-portal")
    else:
      radius = (pitch - 0.8) / 2
      spring = 7.45
      for j in range(12):
        yy = spring + (j + 0.5) * radius / 12
        ww = 2 * math.sqrt(max(0, radius**2 - (yy - spring) ** 2))
        put(
          front,
          axis,
          yy,
          ww,
          radius / 12 + 0.012,
          0x43514B,
          "kultur-ground-arched-light",
        )
      for j in range(20):
        aa = math.pi * j / 20
        bb = math.pi * (j + 1) / 20
        beam(
          front,
          axis + radius * math.cos(aa),
          spring + radius * math.sin(aa),
          axis + radius * math.cos(bb),
          spring + radius * math.sin(bb),
          0.16,
          0xE5D9C2,
          "kultur-ground-arch-rims",
        )
    put(front, axis, 6.8, 0.10, 2.9, 0xCACAB8, "kultur-ground-mullion", 0.31)
  label(front, "KULTURFABRIK", length / 2, 9.42, 0.49, 0x674E3E)
  label(front, "FILMRAUSCHPALAST", axes[0], 8.28, 0.17, 0xE4DBBD)
  source["recognitionAnchors"] = {
    "cultureFront": {
      k: (v.tolist() if isinstance(v, np.ndarray) else v)
      for k, v in front.items()
      if k in ["a", "d", "n", "length"]
    },
    "threeAxes": axes,
    "fiveStoreyHeights": [7.13, 11.3, 15.8, 20.3, 24.05],
  }
  # Courtyard secondary factory windows and the police's source-bound public
  # elevations. Party walls and skinny roof fragments receive no window grid.
  for f in ff:
    if f["length"] < 4 or f["high"] - f["low"] < 6:
      continue
    mid = f["a"] + f["d"] * f["length"] / 2
    if f["key"] == "kulturfabrik" and np.dot(mid - a, n) > -0.2:
      continue
    rows = (
      [8.1, 12.25, 16.4, 20.55, 24.7]
      if f["key"] == "kulturfabrik"
      else [8.2, 12.8, 17.4, 22.0]
    )
    pitch = 2.9 if f["key"] == "kulturfabrik" else 3.15
    for yy in rows:
      for u in np.arange(1.5, f["length"] - 1, pitch):
        put(f, float(u), yy, 1.45, 2.3, 0x5D767A, f["key"] + "-secondary-window")
        put(f, float(u), yy, 0.075, 2.35, 0xE5E4D7, f["key"] + "-window-mullion", 0.29)
        put(
          f,
          float(u),
          yy - 1.25,
          1.70,
          0.17,
          0xABA999,
          f["key"] + "-window-sill",
          0.31,
          0.22,
        )
    for yy in rows[:-1]:
      put(
        f,
        f["length"] / 2,
        yy + 1.65,
        f["length"] - 0.1,
        0.13,
        0xBAB9A9,
        f["key"] + "-floor-course",
        0.23,
      )
  # Actual rear ground floor, distinct from the front cinema access sign.
  rear = max(
    (
      f
      for f in ff
      if f["key"] == "kulturfabrik"
      and f["length"] > 7
      and f["low"] < 6
      and f["a"][0] > -770
    ),
    key=lambda f: f["n"][1],
  )
  label(rear, "SLAUGHTERHOUSE", rear["length"] / 2, 8.35, 0.35, 0x4A342D)
  put(
    rear,
    rear["length"] / 2,
    6.7,
    2.2,
    2.9,
    0x333E39,
    "slaughterhouse-rear-ground-portal",
    0.21,
    0.10,
  )
  police = max(
    (f for f in ff if f["key"] == "polizei" and f["low"] < 6 and f["length"] > 15),
    key=lambda f: f["n"][1],
  )
  label(police, "POLIZEI", police["length"] / 2, 9.2, 0.55, 0x234766)
  put(
    police,
    police["length"] / 2,
    7.15,
    3.1,
    3.8,
    0x344B51,
    "police-public-entrance",
    0.21,
  )
  source["recognitionAnchors"].update(
    rearVenue={
      k: (v.tolist() if isinstance(v, np.ndarray) else v)
      for k, v in rear.items()
      if k in ["a", "d", "n", "length", "sheet"]
    },
    policePublicFace={
      k: (v.tolist() if isinstance(v, np.ndarray) else v)
      for k, v in police.items()
      if k in ["a", "d", "n", "length", "sheet"]
    },
  )
  source["fittingReceipts"] = receipts
  return drawn, native, ribs, labels


def ownership(source: dict[str, Any]) -> dict[str, Any]:
  """Retire only exact exclusive tuples; shared/new neighbouring cells remain."""
  paths = [
    ROOT / "src/app/public/mesh/regierungsviertel" / name
    for name in ["lod2-prisms.json", "minecraft-voxels.json"]
  ]
  prisms = read(paths[0])["buildings"]
  voxel = read(paths[1])
  selected = unary_union([polygon(p) for p in source["previousPrisms"]])
  cell = voxel["cell_m"]
  assert cell == 4
  # Separate site envelopes prevent the intervening street/block from becoming
  # an accidental retirement region.
  regions = [
    unary_union(
      [polygon(p) for p in source["previousPrisms"] if p["id"] in parent["legacyIds"]]
    )
    for parent in source["parents"]
  ]
  nearby = unary_union([p.envelope.buffer(cell * 2) for p in regions])
  neighbours = [
    p for p in prisms if p["id"] not in IDS and polygon(p).envelope.intersects(nearby)
  ]
  occupied = unary_union([polygon(p) for p in neighbours])
  bounds = list(selected.bounds)
  columns = []
  shared = []
  for zi, runs in enumerate(voxel["building_rows"]):
    z = voxel["grid"]["min_z_idx"] + zi
    if not bounds[1] - cell <= z * cell <= bounds[3]:
      continue
    for offset, count, lo, hi, kind in runs:
      for x in range(
        voxel["grid"]["min_x_idx"] + offset, voxel["grid"]["min_x_idx"] + offset + count
      ):
        if not bounds[0] - cell <= x * cell <= bounds[2]:
          continue
        sq = box(x * cell, z * cell, (x + 1) * cell, (z + 1) * cell)
        if selected.intersection(sq).area <= 0.001:
          continue
        (shared if occupied.intersection(sq).area > 0.001 else columns).append(
          [x, z, lo, hi, kind]
        )
  return dict(
    schemaVersion=1,
    site="Lehrter Kulturfabrik and Kruppstraße police",
    cellM=cell,
    bounds=bounds,
    previousPrisms=source["previousPrisms"],
    neighbours=neighbours,
    columns=columns,
    retainedSharedColumns=shared,
    inputs=[dict(path=str(p.relative_to(ROOT)), sha256=sha(p)) for p in paths],
    policy=POLICY,
  )


def build() -> dict[str, Any]:
  """Generate finite source-bound models, exact navigation and owner receipts."""
  source = read(SOURCE)
  assert sha(ROOT / source["previousFile"]) == source["previousFileSha256"]
  p = prepare(source)
  blocks = native_shell(p)
  details, native, ribs, labels = recognition(p, blocks)

  def packed(rows: Any, dtype: str) -> str:
    return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

  runtime = dict(
    schemaVersion=1,
    sourceSha256=sha(SOURCE),
    sourcePartIds=[
      part["id"] for parent in source["parents"] for part in parent["sourceParts"]
    ],
    sourcePositions=packed([t for s in p["surfaces"] for t in s["triangles"]], "<f4"),
    sourceColors=packed(
      [s["color"] for s in p["surfaces"] for _ in s["triangles"]], "<u4"
    ),
    facadeBoxes=packed([r[:8] for r in details], "<f4"),
    nativeBoxes=packed([r[:8] for r in blocks + native], "<f4"),
    ribSegments=ribs,
    labels=labels,
    recognitionAnchors=p["recognitionAnchors"],
    counts=dict(
      parents=2,
      sourceParts=sum(len(v["sourceParts"]) for v in source["parents"]),
      sourceSurfaces=sum(
        len(part["surfaces"]) for v in source["parents"] for part in v["sourceParts"]
      ),
      triangles=sum(len(s["triangles"]) for s in p["surfaces"]),
      facadeBoxes=len(details),
      nativeShellBlocks=len(blocks),
      nativeDetailBoxes=len(native),
      ribSegments=len(ribs),
      labels=len(labels),
    ),
  )
  nav = []
  for part in p["parts"]:
    triangles = [
      t
      for s in p["surfaces"]
      if s["partId"] == part["id"] and s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ]
    nav.append({**part, "roofTriangles": triangles})
  native_roofs = {}
  for x, y, z, *_ in blocks:
    native_roofs[x, z] = max(native_roofs.get((x, z), -100), y + 1)
  native_shape = unary_union([box(x - 1, z - 1, x + 1, z + 1) for x, z in native_roofs])
  polys = list(native_shape.geoms) if hasattr(native_shape, "geoms") else [native_shape]
  navigation = dict(
    parts=nav,
    nativeRoofs=[[x, z, y] for (x, z), y in native_roofs.items()],
    nativePolygons=[
      dict(
        sourceId=min(
          source["parents"],
          key=lambda parent: q.distance(
            unary_union(
              [Polygon(part["ring"], part["holes"]) for part in parent["sourceParts"]]
            )
          ),
        )["legacyIds"][0],
        ring=[list(v) for v in list(q.exterior.coords)[:-1]],
        holes=[[list(v) for v in list(h.coords)[:-1]] for h in q.interiors],
      )
      for q in polys
    ],
    minY=4,
  )
  write(DATA / "lehrterV277.json", runtime)
  write(DATA / "lehrterV277Navigation.json", navigation)
  write(DATA / "lehrterV277Ownership.json", ownership(source))
  write(
    EVIDENCE,
    dict(
      sourceSha256=sha(SOURCE),
      counts=runtime["counts"],
      conflicts=p["conflicts"],
      quantizedRingRepairs=p["quantizedRingRepairs"],
      recognitionAnchors=p["recognitionAnchors"],
      fittingReceipts=p["fittingReceipts"],
      facadeBoxes=details,
      nativeDetailBoxes=native,
      retainedStreetRows=len(source["streetRows"]),
      references=REFS,
      policy=POLICY,
    ),
  )
  return runtime["counts"]


if __name__ == "__main__":
  import sys

  if "--extract" in sys.argv:
    extract(Path.home() / ".cache/codex-berlin-v277")
  print(json.dumps(build()))
