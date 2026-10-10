"""Step 10: three finite prison/memorial sites from retained LoD2 and OSM."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, box, shape

from scripts.build_breitscheid_towers_v161 import normal_of, triangles_for

ROOT = Path(__file__).resolve().parents[1]
GROUND = 3.0
HAUS1 = "DEBE11YYI00001A0"
HQ_RECOGNITION = {HAUS1, "DEBE11YYI00001PT", "DEBE11YYI0000MqA", "DEBE11YYI0000O2G"}
NAMES = {
  "tegel": "JVA Tegel",
  "hq": "Former Stasi headquarters / Normannenstrasse",
  "hsh": "Berlin-Hohenschoenhausen memorial",
}


def parts(geometry: object, kind: type = Polygon) -> list:
  """Keep disconnected components and source holes."""
  if isinstance(geometry, kind):
    return [geometry] if not geometry.is_empty else []
  return [p for g in getattr(geometry, "geoms", []) for p in parts(g, kind)]


def compact(cells: dict[tuple[int, int, int], int]) -> list:
  """Losslessly merge adjacent equal-colour surface cells, never solid-fill."""
  runs = [[x, y, z, 1, 1, 1, c] for (x, y, z), c in sorted(cells.items())]
  for axis in [0, 2, 1]:
    groups: dict[tuple, list] = {}
    for r in runs:
      groups.setdefault(
        tuple(r[i] for i in range(7) if i not in [axis, axis + 3]), []
      ).append(r)
    runs = []
    for group in groups.values():
      merged = []
      for r in sorted(group, key=lambda r: r[axis]):
        if merged and merged[-1][axis] + merged[-1][axis + 3] == r[axis]:
          merged[-1][axis + 3] += r[axis + 3]
        else:
          merged.append(r.copy())
      runs.extend(merged)
  return [
    [x + w / 2, GROUND + y + h / 2, z + d / 2, w, h, d, c]
    for x, y, z, w, h, d, c in runs
  ]


def build(root: Path = ROOT) -> tuple[dict, dict, dict]:
  """Derive full shells, source-clipped facade estimates and perimeter fittings."""
  source_path = root / "geo_data/regierungsviertel/prisons-memorials-v209-source.json"
  source = json.loads(source_path.read_bytes())
  sites = source["sites"]
  owners = source["owners"]
  drawn, detail, native, ground, faces = [], [], [], [], []
  cells: dict[tuple[int, int, int], int] = {}
  site_shapes = {s["key"]: shape(s["geometry"]) for s in sites}
  all_shapes = [shape(o["footprint"]) for o in owners]
  windows = []

  def emit(
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    yaw: float,
    color: int,
    role: str,
    site: str,
    native_reach: float = 0,
    normal: tuple = (0, 0),
  ) -> None:
    detail.append([*[round(v, 4) for v in [x, y, z, w, h, d, yaw]], color, role, site])
    count = 1 if w <= 2.0 else max(1, math.ceil(w / 0.9))
    dx, dz = math.cos(yaw), -math.sin(yaw)
    for i in range(count):
      u = (i + 0.5) * w / count - w / 2
      native.append(
        [
          round(x + dx * u + normal[0] * native_reach, 4),
          round(y, 4),
          round(z + dz * u + normal[1] * native_reach, 4),
          round(abs(dx) * w / count + abs(dz) * d, 4),
          round(h, 4),
          round(abs(dz) * w / count + abs(dx) * d, 4),
          color,
          role,
          site,
        ]
      )

  def skin(triangles: list, color: int) -> None:
    for tri in triangles:
      a, b, c = map(np.array, tri)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 0.68
        ),
      )
      # Barycentric surface sampling is vectorized; each layer is temporary.
      for i in range(n + 1):
        js = np.arange(n + 1 - i)[:, None]
        q = a + (b - a) * i / n + (c - a) * js / n
        q[:, 1] -= GROUND
        for v in np.unique(np.floor(q).astype(int), axis=0):
          cells[tuple(v)] = color

  for oi, owner in enumerate(owners):
    site = owner["site"]
    fp = all_shapes[oi]
    shift = owner["displayOffsetY"]
    haus1 = owner["id"] == HAUS1
    brick = site == "tegel" and max(p["top_y_m"] for p in owner["parts"]) + shift > 12
    wall_color = (
      0xA2725C
      if brick
      else 0x9B9784
      if haus1
      else 0xBBB9A9
      if site == "hq"
      else 0xB4AA91
    )
    for pi, part in enumerate(owner["parts"]):
      for si, sheet in enumerate(part["surfaces"]):
        rings = [[[x, round(y + shift, 3), z] for x, y, z in r] for r in sheet["rings"]]
        roof = sheet["kind"] == "RoofSurface"
        color = (0x685E57 if brick else 0x77786E) if roof else wall_color
        triangles = triangles_for(rings)
        drawn.append(
          dict(
            owner=oi,
            part=part["id"],
            sheet=si,
            kind=sheet["kind"],
            color=color,
            triangles=triangles,
          )
        )
        skin(triangles, color)
        if (
          roof or not triangles or (site == "hq" and owner["id"] not in HQ_RECOGNITION)
        ):
          continue
        n = normal_of(rings[0])
        if abs(n[1]) > 0.015:
          continue
        a, b = max(
          ((a, b) for a in rings[0] for b in rings[0]),
          key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
        )
        a, b = np.array(a), np.array(b)
        d = b - a
        d[1] = 0
        length = float(np.linalg.norm(d))
        if length < 3.5:
          continue
        d /= length
        n = np.array([d[2], 0, -d[0]])
        middle = (a + b) / 2
        if fp.covers(Point(middle[0] + n[0] * 0.12, middle[2] + n[2] * 0.12)):
          n *= -1
        if any(
          j != oi and g.covers(Point(middle[0] + n[0] * 0.6, middle[2] + n[2] * 0.6))
          for j, g in enumerate(all_shapes)
        ):
          continue
        # The current Tegel refinement interprets public exterior fronts only.
        if (
          site == "tegel"
          and site_shapes[site].boundary.distance(Point(middle[0], middle[2])) > 62
        ):
          continue
        planar = [
          [(float(np.dot(np.subtract(v, a), d)), v[1]) for v in ring] for ring in rings
        ]
        poly = Polygon(planar[0], planar[1:]).buffer(-0.06)
        yaw = math.atan2(-d[2], d[0])
        fi = len(faces)
        faces.append(
          dict(
            owner=oi,
            part=part["id"],
            sheet=si,
            rings=rings,
            a=a.tolist(),
            direction=d.tolist(),
            outward=n.tolist(),
          )
        )
        low, high = min(v[1] for v in rings[0]), max(v[1] for v in rings[0])
        if high - low < 4.8:
          continue
        pitch_y = 3.25 if haus1 else 3.15 if site == "hq" else 3.4
        count = max(1, round(length / (2.85 if haus1 else 3.25)))
        for floor in range(max(1, math.ceil((high - GROUND) / pitch_y))):
          y = GROUND + 2.0 + floor * pitch_y
          for bay in range(count):
            u = (bay + 0.5) * length / count
            w, h = (
              min(1.6 if haus1 else 1.4, length / count * 0.68),
              1.95 if haus1 else 1.75,
            )
            if not poly.covers(
              box(u - w / 2 - 0.1, y - h / 2 - 0.1, u + w / 2 + 0.1, y + h / 2 + 0.1)
            ):
              continue
            p = a + d * u
            if any(
              j != oi and g.covers(Point(p[0] + n[0] * 0.6, p[2] + n[2] * 0.6))
              for j, g in enumerate(all_shapes)
            ):
              continue
            windows.append(dict(face=fi, along=u, y=y, width=w, height=h))
            frame = 0xD5C6A5 if haus1 else 0xD4D5C8
            rows = [
              (0, 0, w, h, 0.10, 0.18, 0x597276, "window-pane"),
              (-w / 2, 0, 0.075, h + 0.14, 0.12, 0.27, frame, "window-jamb"),
              (w / 2, 0, 0.075, h + 0.14, 0.12, 0.27, frame, "window-jamb"),
              (0, -h / 2 - 0.03, w + 0.19, 0.10, 0.22, 0.29, frame, "window-sill"),
              (0, h * 0.22, w, 0.065, 0.08, 0.30, frame, "window-transom"),
            ]
            if site == "hsh":
              rows += [
                (w * t, 0, 0.04, h + 0.12, 0.06, 0.41, 0x777E76, "historic-window-bar")
                for t in [-0.32, 0, 0.32]
              ]
            if haus1:
              rows += [(0, 0, 0.065, h, 0.08, 0.30, frame, "window-mullion")]
            for du, dy, rw, rh, depth, out, tint, role in rows:
              q = p + d * du + n * out
              emit(
                q[0],
                y + dy,
                q[2],
                rw,
                rh,
                depth,
                yaw,
                tint,
                role,
                site,
                1.05,
                (n[0], n[2]),
              )

  barriers = []
  gates = []
  for site in sites:
    key = site["key"]
    for original in site["barriers"]:
      line = shape(original["geometry"])
      tags = original["tags"]
      wall = tags["barrier"] == "wall"
      height = float(tags.get("height", 4.0 if wall else 2.5))
      record = dict(
        id=original["id"],
        site=key,
        sourceCoordinates=[list(p) for p in line.coords],
        barrier=tags["barrier"],
        height=height,
        heightEvidence="OSM height tag"
        if "height" in tags
        else "visual display estimate, not survey",
      )
      barriers.append(record)
      segments = [line]
      # Mapped gate anchors carve a finite opening instead of sealing a source gate.
      for gate in site["gates"]:
        p = shape(gate["geometry"])
        if line.distance(p) < 0.15:
          segments = [
            q for s in segments for q in parts(s.difference(p.buffer(2.1)), LineString)
          ]
      for segment in segments:
        coordinates = list(segment.coords)
        for a, b in zip(coordinates, coordinates[1:]):
          dx, dz = b[0] - a[0], b[1] - a[1]
          length = math.hypot(dx, dz)
          if length < 0.02:
            continue
          yaw = math.atan2(-dz, dx)
          x, z = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
          if wall:
            emit(
              x,
              GROUND + height / 2,
              z,
              length,
              height,
              0.42,
              yaw,
              0xABA69A,
              "site-wall",
              key,
            )
            emit(
              x,
              GROUND + height + 0.07,
              z,
              length,
              0.14,
              0.57,
              yaw,
              0x888C83,
              "wall-coping",
              key,
            )
            posts = max(1, math.ceil(length / 3.0))
            for j in range(posts + 1):
              emit(
                a[0] + dx * j / posts,
                GROUND + height / 2,
                a[1] + dz * j / posts,
                0.10,
                height,
                0.49,
                yaw,
                0x95998F,
                "wall-panel-joint",
                key,
              )
          else:
            for y in [0.32, height * 0.52, height - 0.08]:
              emit(
                x, GROUND + y, z, length, 0.07, 0.07, yaw, 0x647870, "fence-rail", key
              )
            posts = max(1, math.ceil(length / 2.3))
            for j in range(posts + 1):
              emit(
                a[0] + dx * j / posts,
                GROUND + height / 2,
                a[1] + dz * j / posts,
                0.09,
                height,
                0.09,
                yaw,
                0x5D7068,
                "fence-post",
                key,
              )
            rods = max(1, math.ceil(length / 0.4))
            for j in range(rods):
              emit(
                a[0] + dx * (j + 0.5) / rods,
                GROUND + height / 2,
                a[1] + dz * (j + 0.5) / rods,
                0.032,
                height - 0.13,
                0.032,
                yaw,
                0x89978B,
                "fence-infill",
                key,
              )
    for gate in site["gates"]:
      p = shape(gate["geometry"])
      nearby = sorted(site["barriers"], key=lambda r: shape(r["geometry"]).distance(p))
      if not nearby or shape(nearby[0]["geometry"]).distance(p) > 8:
        continue
      line = shape(nearby[0]["geometry"])
      t = line.project(p)
      a, b = line.interpolate(max(0, t - 1)), line.interpolate(min(line.length, t + 1))
      yaw = math.atan2(-(b.y - a.y), b.x - a.x)
      gates.append(
        dict(
          id=gate["id"], site=key, position=[p.x, p.y], width=4.2, displayEstimate=True
        )
      )
      for side in [-1, 1]:
        x, z = p.x + math.cos(yaw) * side * 2.15, p.y - math.sin(yaw) * side * 2.15
        emit(x, GROUND + 1.9, z, 0.28, 3.8, 0.38, yaw, 0xD0CCC0, "gate-post", key)
      # Visual open gate leaves at their jambs preserve the documented passage.
      for side in [-1, 1]:
        for u in [0.0, 0.35, 0.7, 1.05, 1.4, 1.75]:
          x = p.x + math.cos(yaw) * side * 2.1 + math.sin(yaw) * u
          z = p.y - math.sin(yaw) * side * 2.1 + math.cos(yaw) * u
          emit(x, GROUND + 1.5, z, 0.045, 3, 0.045, 0, 0x5C6B64, "open-gate-leaf", key)
    # Add ground only on new coverage. Existing paths/grass stay untouched.
    new_ground = shape(site["newGround"])
    for p in parts(new_ground):
      for tri in constrained_delaunay_triangles(p).geoms:
        ground.append(
          dict(
            site=key,
            color=0xC6C7B7,
            triangles=[[[x, GROUND, z] for x, z in list(tri.exterior.coords)[:3]]],
          )
        )
    for road in site.get("roads", []):
      highway = road["tags"].get("highway")
      width = (
        float(
          road["tags"]
          .get(
            "width",
            2.0 if highway in ["footway", "path", "steps", "pedestrian"] else 4.5,
          )
          .replace(" m", "")
        )
        if isinstance(road["tags"].get("width"), str)
        else 2.0
        if highway in ["footway", "path", "steps", "pedestrian"]
        else 4.5
      )
      surface = (
        shape(road["clipped"])
        .buffer(width / 2, cap_style=2, join_style=2)
        .intersection(new_ground)
      )
      for p in parts(surface):
        for tri in constrained_delaunay_triangles(p).geoms:
          ground.append(
            dict(
              site=key,
              color=0xAAAFA5,
              triangles=[
                [[x, GROUND + 0.025, z] for x, z in list(tri.exterior.coords)[:3]]
              ],
            )
          )

  blocks = compact(cells)
  nav = dict(
    groundY=GROUND,
    sites=[
      dict(key=s["key"], name=NAMES[s["key"]], geometry=s["context"]) for s in sites
    ],
    owners=[
      dict(
        id=o["id"],
        site=o["site"],
        geometry=o["footprint"],
        low=GROUND,
        high=round(max(p["top_y_m"] for p in o["parts"]) + o["displayOffsetY"], 3),
      )
      for o in owners
    ],
    barriers=barriers,
    gates=gates,
  )
  data = dict(
    version=209,
    sourceIds=[o["id"] for o in owners],
    surfaces=drawn,
    ground=ground,
    boxes=detail,
    blocks=native,
    envelopeBlocks=blocks,
    sites=[
      dict(
        key=s["key"],
        name=NAMES[s["key"]],
        anchor=[
          round(site_shapes[s["key"]].centroid.x, 3),
          GROUND,
          round(site_shapes[s["key"]].centroid.y, 3),
        ],
      )
      for s in sites
    ],
  )
  audit = dict(
    sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
    owners=len(owners),
    parts=sum(len(o["parts"]) for o in owners),
    sourceSheets=sum(len(p["surfaces"]) for o in owners for p in o["parts"]),
    renderedSheets=len(drawn),
    triangles=sum(len(s["triangles"]) for s in drawn),
    surfaceCells=len(cells),
    envelopeBlocks=len(blocks),
    detailBoxes=len(detail),
    detailBlocks=len(native),
    faces=faces,
    windows=windows,
    barriers=barriers,
    gates=gates,
  )
  return data, nav, audit


def main() -> None:
  """Write bounded prepared assets; no download and no source mutation."""
  data, nav, audit = build()
  envelopes = {
    k: data[k]
    for k in ["version", "sourceIds", "sites", "surfaces", "ground", "envelopeBlocks"]
  }
  details = {k: data[k] for k in ["version", "sites"]}
  details["boxes"] = [r[:8] + [r[9]] for r in data["boxes"]]
  details["blocks"] = [r[:7] + [r[8]] for r in data["blocks"]]
  for name, value in [
    ("src/app/src/data/prisonsMemorialsV209.json", details),
    ("src/app/src/data/prisonsMemorialsV209Envelopes.json", envelopes),
    ("src/app/src/data/prisonsMemorialsV209Navigation.json", nav),
    (
      "src/app/src/data/prisonsMemorialsV209Owners.json",
      [{"id": o["id"], "site": o["site"]} for o in nav["owners"]],
    ),
    ("geo_data/regierungsviertel/prisons-memorials-v209-evidence.json", audit),
  ]:
    p = ROOT / name
    p.write_text(
      json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
      + "\n"
    )
    print(name, p.stat().st_size)
  print(
    {
      k: v
      for k, v in audit.items()
      if k not in ["faces", "windows", "barriers", "gates"]
    }
  )


if __name__ == "__main__":
  main()
