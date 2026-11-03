"""Complete source-anchored rail and embedded sports architecture v307.

All roof polygons and courtyard holes are retained. Open railway canopy walls
are reference-guided apertures in the exact official vertical envelopes, never
closed boxes across the track cutting. Small sections/panel spacing are display
estimates; source footprints, roof sheets and station identities are measured.
"""

from __future__ import annotations

import argparse
import base64
import math
from collections import Counter
from pathlib import Path
from typing import Any

import build_surrounding_outlines as exporter
import numpy as np
import pyogrio
import shapely
from build_breitscheid_towers_v161 import triangles_for
from build_moabit_mitte_v300 import roof_at
from build_rail_sse_v307 import (
  DATA,
  GEO,
  RAW,
  ROOT,
  SOURCE,
  read_v307,
  sample_offset_v307,
  write_v307,
)
from build_rail_stations_v190 import tags, world
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union
from terrain_fields_v307 import polygons_v307


def _encoded_v307(a: np.ndarray) -> str:
  return base64.b64encode(a.tobytes()).decode()


def _linear_v307(tone: int) -> np.ndarray:
  values = (
    np.array([(tone >> 16) & 255, (tone >> 8) & 255, tone & 255], dtype=float) / 255
  )
  return np.asarray(
    np.where(values <= 0.04045, values / 12.92, ((values + 0.055) / 1.055) ** 2.4),
    dtype="<f4",
  )


class ModelV307:
  """Exact Float32 world sheets and actual original linear Float32 paint."""

  def __init__(self, native: bool = False) -> None:
    self.native = native
    self.solids: list[dict[str, Any]] = []
    self.points: list[list[float]] = []
    self.colors: list[list[float]] = []
    self.indices: list[int] = []
    self.lookup: dict[tuple, int] = {}
    self.roles: Counter[str] = Counter()

  def triangle(self, points: Any, tone: int | np.ndarray, role: str) -> None:
    p = np.asarray(points, dtype="<f4")
    rgb = _linear_v307(tone) if isinstance(tone, int) else np.asarray(tone)
    if rgb.ndim == 1:
      rgb = np.tile(rgb, (3, 1))
    normal = np.cross(p[1] - p[0], p[2] - p[0])
    length = np.linalg.norm(normal)
    if length < 1e-8:
      return
    ids = []
    for q, c in zip(p, rgb, strict=True):
      key = (*map(float, q), *map(float, np.asarray(c, dtype="<f4")))
      at = self.lookup.get(key)
      if at is None:
        at = len(self.points)
        self.lookup[key] = at
        self.points.append(q.tolist())
        self.colors.append(list(map(float, np.asarray(c, dtype="<f4"))))
      ids.append(at)
    self.indices.extend(ids)
    self.roles[role] += 1

  def cube(
    self,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    tone: int,
    role: str,
    yaw: float = 0,
  ) -> None:
    if min(w, h, d) <= 0:
      raise ValueError("Invalid complete rail fitting")
    p = np.array(
      [
        [-1, -1, -1],
        [1, -1, -1],
        [1, -1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, 1, -1],
        [1, 1, 1],
        [-1, 1, 1],
      ],
      dtype=float,
    ) * [w / 2, h / 2, d / 2]
    c, s = math.cos(yaw), math.sin(yaw)
    p[:, [0, 2]] = p[:, [0, 2]] @ np.array([[c, -s], [s, c]])
    p += [x, y, z]
    if role in (
      "independent-native-sports-source-volume",
      "independent-native-open-station-roof",
      "complete-mapped-open-platform-canopy",
      "complete-osm-pool-roof-complement",
      "wedding-source-concrete-deck-underside",
      "estimated-source-bound-open-roof-pier",
      "source-bound-concourse-deck",
    ):
      self.solids.append(
        dict(
          key=role + "-" + str(len(self.solids)),
          native=self.native,
          ring=p[:4, [0, 2]].tolist(),
          holes=[],
          low=y - h / 2,
          high=y + h / 2,
          role="actual-compiled-solid",
        )
      )
    rgb = _linear_v307(tone)
    for face, shade in [
      ((0, 1, 2, 3), 0.66),
      ((4, 7, 6, 5), 1),
      ((0, 4, 5, 1), 0.86),
      ((1, 5, 6, 2), 0.8),
      ((2, 6, 7, 3), 0.92),
      ((3, 7, 4, 0), 0.74),
    ]:
      a, b, c, d = face
      self.triangle(p[[a, b, c]], rgb * shade, role)
      self.triangle(p[[a, c, d]], rgb * shade, role)

  def beam(
    self,
    a: Any,
    b: Any,
    y: float,
    w: float,
    h: float,
    tone: int,
    role: str,
    native: bool = False,
  ) -> None:
    a, b = np.asarray(a), np.asarray(b)
    length = float(np.linalg.norm(b - a))
    if length < 0.001:
      return
    count = max(1, math.ceil(length / 1.5)) if native else 1
    for i in range(count):
      p = a + (b - a) * (i + 0.5) / count
      if native:
        self.cube(
          *[p[0], y, p[1]],
          abs(b[0] - a[0]) / count + w,
          h,
          abs(b[1] - a[1]) / count + w,
          tone,
          role,
        )
      else:
        self.cube(
          p[0], y, p[1], length, h, w, tone, role, -math.atan2(b[1] - a[1], b[0] - a[0])
        )

  def surface(
    self,
    g: Any,
    y: float,
    tone: int,
    role: str,
    native: bool = False,
    thickness: float = 0.16,
  ) -> None:
    if native:
      w, n, e, s = g.bounds
      for z in range(math.floor(n / 2) * 2, math.ceil(s / 2) * 2, 2):
        start = None
        for x in range(math.floor(w / 2) * 2, math.ceil(e / 2) * 2 + 2, 2):
          inside = g.covers(Point(x + 1, z + 1))
          if inside and start is None:
            start = x
          if not inside and start is not None:
            self.cube(
              (start + x) / 2,
              y - thickness / 2,
              z + 1,
              x - start,
              thickness,
              2,
              tone,
              role,
            )
            start = None
    else:
      for p in polygons_v307(g):
        for t in shapely.constrained_delaunay_triangles(p).geoms:
          self.triangle([[x, y, z] for x, z in list(t.exterior.coords)[:3]], tone, role)

  def packed(self, key: str, native: bool) -> list[dict[str, Any]]:
    """Spatial source-triangle partition; all Float32/RGB/index geometry stays exact."""
    positions = np.asarray(self.points, dtype="<f4")
    colors = np.asarray(self.colors, dtype="<f4")
    indices = np.asarray(self.indices, dtype="<u4").reshape(-1, 3)
    centres = positions[indices][:, :, [0, 2]].mean(axis=1)
    tiles = np.floor(centres / 512).astype(int)
    output = []
    for tile in sorted(set(map(tuple, tiles))):
      ordinals = np.flatnonzero(np.all(tiles == tile, axis=1))
      ix = indices[ordinals]
      vertices = np.unique(ix)
      remap = np.full(len(positions), -1, dtype=np.int64)
      remap[vertices] = np.arange(len(vertices))
      final = remap[ix].astype("<u4")
      if not np.array_equal(
        positions[vertices][final], positions[ix]
      ) or not np.array_equal(colors[vertices][final], colors[ix]):
        raise ValueError("Spatial source partition changed actual geometry or paint")
      output.append(
        dict(
          key=key + ":" + str(tile[0]) + "_" + str(tile[1]),
          native=native,
          positionType="f32",
          colorType="f32linear",
          origin=[0, 0, 0],
          positions=_encoded_v307(positions[vertices]),
          colors=_encoded_v307(colors[vertices]),
          indices=_encoded_v307(final),
          vertices=len(vertices),
          triangles=len(ordinals),
          sourceTriangleOrdinals=_encoded_v307(ordinals.astype("<u4")),
        )
      )
    if sum(p["triangles"] for p in output) != len(indices):
      raise ValueError("Spatial source catalog lost an original triangle")
    return output


def extract_extra_v307() -> dict[str, Any]:
  source = read_v307(SOURCE)
  ids = [p["id"] for p in source["parents"]] + ["OSM-way-7997192", "OSM-way-1228255547"]
  frame = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN (" + ",".join("'" + i + "'" for i in ids) + ")",
  )
  owners = [
    dict(
      sourceId=r.sourceId,
      height=r.height,
      minHeight=r.minHeight,
      heightSource=r.heightSource,
      sourceGroundY=None if math.isnan(r.sourceGroundY) else r.sourceGroundY,
      geometry=mapping(r.geometry),
    )
    for r in frame.itertuples()
  ]
  missing = set(ids) - {o["sourceId"] for o in owners}
  if missing:
    raise ValueError(f"Complete old source owners missing: {missing}")
  fields = read_v307(DATA / "railSseTerrainV307.json")["profiles"]
  domains = [shape(f["domain"]) for f in fields]
  paths = []
  for f in read_v307(RAW / "paths.geojson")["features"]:
    t = tags(f)
    g = world(shape(f["geometry"]))
    if not any(g.intersects(d) for d in domains):
      continue
    if (
      t.get("highway") == "steps"
      or t.get("railway") in ("rail", "light_rail")
      or t.get("tunnel") == "yes"
    ):
      paths.append(
        dict(id="way/" + str(f["properties"]["osm_id"]), tags=t, geometry=mapping(g))
      )
  source["predecessors"] = owners
  source["mappedPaths"] = paths
  source["architecturePolicy"] = (
    "Every official source roof sheet and original wall envelope is retained. Railway canopy envelope walls are apertured into source-bound fascia and supports because DOP2025 and operator material show open platforms; section sizes are estimates. No closed wall spans a railway. Roof/skylight/panel subdivisions are estimated, clipped to actual roofs. All old platform and fitting buffers are preserved at measured site grades."
  )
  source["references"].append(
    dict(
      url="https://www.schuessler-plan.de/datas/Publikation_plan_Magazin/SP_plan_5_Magazin.pdf",
      credit="Schüßler-Plan, plan magazine issue5, Gesundbrunnen engineering project",
      checked="2026-11-02",
      use="Primary designer: existing125x65m concrete station plate, large lightweight roof with support spans15–37m. Source-bound open canopy, no solid box below it.",
    )
  )
  source["references"] = list(
    {tuple(sorted(r.items())): r for r in source["references"]}.values()
  )
  write_v307(SOURCE, source)
  return source


def build_models_v307(captures: Path) -> None:
  source = extract_extra_v307()
  rail = read_v307(DATA / "railStationsV190.json")
  terrain = read_v307(DATA / "railSseTerrainV307.json")
  fields = {p["key"]: p for p in terrain["profiles"]}
  sites = {s["id"]: shape(s["geometry"]) for s in source["sites"]}
  models = []
  navigation = []
  audit = []
  for native in (False, True):
    mode = "minecraft" if native else "drawn"
    model = ModelV307(native)
    # Full official sports bodies. The site datum is the actual NHN−30 value,
    # so only the shallow metal roofs project above the measured landscape.
    for parent in source["parents"]:
      if parent["site"] not in ("velodrom", "sse", "gesundbrunnenAccess"):
        continue
      for part in parent["parts"]:
        for face in part["surfaces"]:
          if native:
            continue
          for triangle in triangles_for(face["rings"]):
            model.triangle(
              triangle,
              0x99A3A1
              if face["kind"] == "RoofSurface"
              else (0x8D9F9F if parent["site"] == "gesundbrunnenAccess" else 0x737F7C),
              "complete-official-sports-sheet",
            )
        if native:
          g = Polygon(part["ring"], part["holes"])
          w, n, e, s = g.bounds
          for z in range(math.floor(n / 2) * 2, math.ceil(s / 2) * 2, 2):
            for x in range(math.floor(w / 2) * 2, math.ceil(e / 2) * 2, 2):
              if not g.covers(Point(x + 1, z + 1)):
                continue
              roofs = [
                t
                for f in part["surfaces"]
                if f["kind"] == "RoofSurface"
                for t in triangles_for(f["rings"])
              ]
              ys = [q[1] for t in roofs for q in t]
              top = roof_at(roofs, x + 1, z + 1)
              if top is None:
                top = max(ys) if ys else part["top_y_m"]
              top = math.ceil(top * 8) / 8
              low = part["ground_y_m"]
              model.cube(
                x + 1,
                (top + low) / 2,
                z + 1,
                2,
                top - low,
                2,
                0x99A3A1,
                "independent-native-sports-source-volume",
              )
        navigation.append(
          dict(
            key=part["id"],
            native=native,
            ring=part["ring"],
            holes=part["holes"],
            low=part["ground_y_m"],
            high=part["top_y_m"],
            role="sports-source-shell",
            roofTriangles=[
              t
              for f in part["surfaces"]
              if f["kind"] == "RoofSurface"
              for t in triangles_for(f["rings"])
            ],
          )
        )
    # The official data owns only the pool rim. Keep its entire mapped roof
    # complement, rather than discarding the8,263m² absent from LoD2.
    pool = sites["way/7997192"]
    rim = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for a in source["parents"]
        if a["site"] == "sse"
        for p in a["parts"]
      ]
    )
    complement = pool.difference(rim)
    model.surface(
      complement, 26.22, 0x899593, "complete-osm-pool-roof-complement", native, 0.18
    )
    navigation.append(
      dict(
        key="sse-complete-mapped-roof-complement-v307",
        native=native,
        geometry=mapping(complement),
        low=26.04,
        high=26.22,
        role="estimated-thin-roof-supported-by-measured-rim",
      )
    )
    # Distinctive radial metal roof joints and source-clipped pool skylight rows.
    vel = sites["way/7997184"]
    centre = vel.centroid
    for i in range(96):
      angle = i * math.tau / 96
      a = (
        np.array([centre.x, centre.y])
        + np.array([math.cos(angle), math.sin(angle)]) * 3.5
      )
      b = (
        np.array([centre.x, centre.y])
        + np.array([math.cos(angle), math.sin(angle)]) * 68
      )
      cut = LineString([a, b]).intersection(vel.buffer(-0.4))
      for q in exporter.line_parts(cut):
        model.beam(
          q.coords[0],
          q.coords[-1],
          26.31,
          0.045,
          0.04,
          0x727F7D,
          "estimated-source-clipped-radial-roof-joint",
          native,
        )
    w, n, e, s = pool.bounds
    for z in np.arange(n + 5, s - 4, 7):
      for x in np.arange(w + 5, e - 4, 7):
        if pool.buffer(-1).covers(box(x - 1.1, z - 0.5, x + 1.1, z + 0.5)):
          model.cube(x, 26.3, z, 2.2, 0.12, 1, 0xB9CED1, "estimated-roof-skylight", 0)
    # Every mapped railway canopy roof sheet survives, with actual open space
    # under it. Original wall envelopes are kept in the source ledger.
    roof_levels = {}
    roof_lookup = {
      parent["id"]: [
        t
        for part in parent["parts"]
        for f in part["surfaces"]
        if f["kind"] == "RoofSurface"
        for t in triangles_for(f["rings"])
      ]
      for parent in source["parents"]
    }
    for parent in source["parents"]:
      if parent["site"] not in (
        "gesundbrunnen",
        "landsbergerAllee",
        "landsbergerNorth",
      ):
        continue
      roof_levels[parent["id"]] = max(p["top_y_m"] for p in parent["parts"])
      for part in parent["parts"]:
        g = Polygon(part["ring"], part["holes"])
        roof_faces = [f for f in part["surfaces"] if f["kind"] == "RoofSurface"]
        if not native:
          for face in roof_faces:
            for triangle in triangles_for(face["rings"]):
              model.triangle(
                triangle, 0xD3D7D0, "complete-official-open-station-roof-sheet"
              )
        else:
          roof_triangles = [t for f in roof_faces for t in triangles_for(f["rings"])]
          w, n, e, b = g.bounds
          for z in range(math.floor(n / 2) * 2, math.ceil(b / 2) * 2, 2):
            for x in range(math.floor(w / 2) * 2, math.ceil(e / 2) * 2, 2):
              if not g.covers(Point(x + 1, z + 1)):
                continue
              top = roof_at(roof_triangles, x + 1, z + 1)
              if top is None:
                top = part["top_y_m"]
              top = math.ceil(top * 8) / 8
              model.cube(
                x + 1,
                top - 0.14,
                z + 1,
                2,
                0.28,
                2,
                0xD3D7D0,
                "independent-native-open-station-roof",
              )
        if not native:
          roof_triangles = [t for f in roof_faces for t in triangles_for(f["rings"])]
          lower = min(q[1] for t in roof_triangles for q in t)
          navigation.append(
            dict(
              key=part["id"] + "-open-roof",
              native=False,
              ring=part["ring"],
              holes=part["holes"],
              low=lower - 0.28,
              high=part["top_y_m"],
              roofTriangles=roof_triangles,
              role="open-thin-canopy",
            )
          )
        # Exact source roof perimeter gets a shallow fascia; all remaining
        # vertical envelope is an intentional documented open aperture.
        for face in roof_faces:
          for ring in face["rings"]:
            for a, b in zip(ring, ring[1:] + ring[:1]):
              model.beam(
                [a[0], a[2]],
                [b[0], b[2]],
                (a[1] + b[1]) / 2 - 0.13,
                0.14,
                0.26,
                0x8C9994,
                "source-roof-edge-fascia",
                native,
              )
        low = 20.0 if parent["id"] == "DEBE00YYNf00003i" else part["ground_y_m"] + 0.96
        f = g.minimum_rotated_rectangle
        corners = list(f.exterior.coords)[:4]
        for a in corners:
          q = (
            nearest_points(Point(a), g)[1]
            .buffer(0.7)
            .intersection(g)
            .representative_point()
          )
          pier_top = roof_at(
            [t for f in roof_faces for t in triangles_for(f["rings"])], q.x, q.y
          )
          if pier_top is None:
            pier_top = part["top_y_m"]
          if pier_top - low > 0.5:
            model.cube(
              q.x,
              (low + pier_top - 0.28) / 2,
              q.y,
              0.28,
              pier_top - 0.28 - low,
              0.28,
              0x76847E,
              "estimated-source-bound-open-roof-pier",
            )
    concourse = next(a for a in source["parents"] if a["id"] == "DEBE00YYNf00003i")[
      "parts"
    ][0]
    deck = Polygon(concourse["ring"], concourse["holes"])
    openings = []
    for path in source["mappedPaths"]:
      if (
        path["tags"].get("highway") == "steps"
        and path["tags"].get("indoor") == "yes"
        and path["tags"].get("tunnel") != "yes"
      ):
        cut = shape(path["geometry"]).buffer(
          float(path["tags"].get("width", "2.6")) / 2, cap_style=2
        )
        if cut.intersects(deck):
          openings.append(cut)
    deck = deck.difference(unary_union(openings))
    model.surface(deck, 20.0, 0xB1B6AB, "source-bound-concourse-deck", native, 0.65)
    if not native:
      navigation.append(
        dict(
          key="gesundbrunnen-source-bound-concourse-deck",
          native=False,
          geometry=mapping(deck),
          low=19.35,
          high=20.0,
          role="source-bound-reference-deck",
        )
      )
    # Complete mapped long Landsberger platform canopy, absent from LoD2.
    mapped_roof = next(
      r for r in rail["roofs"] if r["retainedOwnerId"] == "OSM-way-1228255547"
    )
    roof_geometry = Polygon(mapped_roof["rings"][0], mapped_roof["rings"][1:])
    canopy_y = (
      3
      + sample_offset_v307(
        fields["europasportpark"],
        mapped_roof["frame"]["x"],
        mapped_roof["frame"]["z"],
        native,
      )
      + 4.0
    )
    model.surface(
      roof_geometry,
      canopy_y,
      0xA5B0AA,
      "complete-mapped-open-platform-canopy",
      native,
      0.22,
    )
    roof_levels["OSM-way-1228255547"] = canopy_y
    navigation.append(
      dict(
        key="OSM-way-1228255547",
        native=native,
        ring=mapped_roof["rings"][0],
        holes=mapped_roof["rings"][1:],
        low=canopy_y - 0.22,
        high=canopy_y,
        role="open-thin-canopy",
      )
    )
    # Exact mapped rail axes follow the same measured field. No tunnel line is
    # spuriously drawn on the surface and every original intermediate node stays.
    for path in source["mappedPaths"]:
      t = path["tags"]
      if t.get("railway") not in ("rail", "light_rail") or t.get("tunnel") == "yes":
        continue
      line = shape(path["geometry"])
      for field in fields.values():
        domain = shape(field["domain"])
        for cut in exporter.line_parts(line.intersection(domain)):
          for a, b in zip(cut.coords, list(cut.coords)[1:]):
            a, b = np.asarray(a), np.asarray(b)
            length = float(np.linalg.norm(b - a))
            if length < 0.05:
              continue
            direction = (b - a) / length
            normal = np.array([-direction[1], direction[0]])
            count = max(1, math.ceil(length / 2))
            for i in range(count):
              aa = a + (b - a) * i / count
              bb = a + (b - a) * (i + 1) / count
              centre = (aa + bb) / 2
              y = 3 + sample_offset_v307(
                field, float(centre[0]), float(centre[1]), native
              )
              model.beam(
                aa,
                bb,
                y + 0.025,
                3.2,
                0.1,
                0x6B706B,
                "source-mapped-measured-rail-ballast",
                native,
              )
              for side in (-1, 1):
                model.beam(
                  aa + normal * 0.72 * side,
                  bb + normal * 0.72 * side,
                  y + 0.15,
                  0.12,
                  0.16,
                  0x465651,
                  "source-mapped-measured-running-rail",
                  native,
                )
              model.beam(
                centre - normal * 1.1,
                centre + normal * 1.1,
                y + 0.09,
                0.17,
                0.12,
                0x5E625C,
                "estimated-source-bound-rail-sleeper",
                native,
              )
    # Mapped surface/upper-platform stair axes, real source widths and source
    # step counts; individual treads remain cardinal in the native reading.
    for path in source["mappedPaths"]:
      t = path["tags"]
      if (
        t.get("highway") != "steps"
        or t.get("tunnel") == "yes"
        or t.get("indoor") != "yes"
      ):
        continue
      try:
        levels = [float(v) for v in t.get("level", "").split(";")]
      except ValueError:
        continue
      if (
        not levels or min(levels) < -1 or max(levels) > 0 or min(levels) == max(levels)
      ):
        continue
      line = shape(path["geometry"])
      candidates = [
        p
        for p in rail["platforms"]
        if p["station"] in ("Gesundbrunnen", "Landsberger Allee")
      ]
      platform = min(
        candidates, key=lambda p: Polygon(p["rings"][0], p["rings"][1:]).distance(line)
      )
      if Polygon(platform["rings"][0], platform["rings"][1:]).distance(line) > 25:
        continue
      field = fields[
        "gesundbrunnen" if platform["station"] == "Gesundbrunnen" else "europasportpark"
      ]
      if not shape(field["domain"]).covers(line):
        continue
      a, b = np.array(line.coords[0]), np.array(line.coords[-1])
      length = float(np.linalg.norm(b - a))
      if length < 1:
        continue
      direction = (b - a) / length
      platform_geometry = Polygon(platform["rings"][0], platform["rings"][1:])
      anchor = nearest_points(platform_geometry, line.centroid)[0]
      platform_y = platform["y"] + sample_offset_v307(
        field, float(anchor.x), float(anchor.y), native
      )
      street_y = (
        20.0
        if platform["station"] == "Gesundbrunnen"
        else max(
          3 + sample_offset_v307(field, float(q[0]), float(q[1]), native)
          for q in (a, b)
        )
        + 0.12
      )
      low = street_y + (street_y - platform_y) * min(levels)
      high = street_y + (street_y - platform_y) * max(levels)
      if high <= low + 0.4:
        continue
      if t.get("incline") == "down":
        low, high = high, low
      try:
        count = int(t.get("step_count", str(math.ceil(abs(high - low) / 0.17))))
      except ValueError:
        count = math.ceil(abs(high - low) / 0.17)
      width = float(t.get("width", "1.2" if t.get("conveying") else "2.6"))
      for i in range(count):
        q = a + (b - a) * (i + 0.5) / count
        y = low + (high - low) * (i + 0.5) / count
        if native:
          sx, sz = (
            abs(b[0] - a[0]) / count + abs(direction[1]) * width,
            abs(b[1] - a[1]) / count + abs(direction[0]) * width,
          )
          model.cube(
            q[0],
            y - 0.06,
            q[1],
            max(0.08, sx),
            0.12,
            max(0.08, sz),
            0xA0A9A3,
            "source-mapped-individual-stair-tread",
          )
        else:
          model.cube(
            q[0],
            y - 0.06,
            q[1],
            length / count + 0.02,
            0.12,
            width,
            0xA0A9A3,
            "source-mapped-individual-stair-tread",
            -math.atan2(direction[1], direction[0]),
          )
        navigation.append(
          dict(
            key=path["id"] + "-tread-" + str(i),
            native=native,
            centre=[float(q[0]), y - 0.06, float(q[1])],
            size=[
              max(0.08, sx) if native else length / count + 0.02,
              0.12,
              max(0.08, sz) if native else width,
            ],
            yaw=0 if native else -math.atan2(direction[1], direction[0]),
            role="stair-tread",
          )
        )
    # Retain every old station platform, name, tactile edge and fitting. Only
    # measured grade/roof positions change; architecture admits the whole set.
    old = read_v307(captures / f"legacy.{mode}.json")
    for station in old:
      name = station["stationName"]
      if name == "Wedding":
        continue
      field = fields["gesundbrunnen" if name == "Gesundbrunnen" else "europasportpark"]
      platforms = [p for p in rail["platforms"] if p["station"] == name]
      roof_records = [r for r in rail["roofs"] if r["station"] == name]

      def grade(x: float, y: float, z: float) -> float:
        choices = [
          r
          for r in roof_records
          if Polygon(r["rings"][0], r["rings"][1:]).buffer(0.4).covers(Point(x, z))
          and abs(y - (r["y"] + 0.08)) < 0.021
        ]
        if choices:
          roof = min(choices, key=lambda r: abs(y - r["y"]))
          target = roof_at(roof_lookup.get(roof["retainedOwnerId"], []), x, z)
          if target is None:
            target = roof_levels.get(roof["retainedOwnerId"])
          if target is not None:
            return target - roof["y"]
        return sample_offset_v307(field, x, z, native)

      for child in station["children"]:
        attr = child["attributes"]["position"]
        dtype = {"Float32Array": "<f4", "Uint16Array": "<u2"}[attr["type"]]
        ps = (
          np.frombuffer(base64.b64decode(attr["array"]), dtype)
          .reshape(-1, 3)
          .astype(float)
        )
        ind = child["index"]
        ix = (
          np.frombuffer(
            base64.b64decode(ind["array"]),
            {"Uint16Array": "<u2", "Uint32Array": "<u4"}[ind["type"]],
          ).reshape(-1, 3)
          if ind
          else np.arange(len(ps)).reshape(-1, 3)
        )
        if child["instanceCount"] is None:
          # Drawn platform sheets use exactly the same4m field planes as terrain.
          for platform in platforms:
            g = Polygon(platform["rings"][0], platform["rings"][1:])
            w, n, e, s = g.bounds
            for z in range(math.floor(n / 4) * 4, math.ceil(s / 4) * 4, 4):
              for x in range(math.floor(w / 4) * 4, math.ceil(e / 4) * 4, 4):
                cell = g.intersection(box(x, z, x + 4, z + 4))
                for half in [
                  Polygon([(x, z), (x + 4, z), (x + 4, z + 4)]),
                  Polygon([(x, z), (x + 4, z + 4), (x, z + 4)]),
                ]:
                  for p in polygons_v307(cell.intersection(half)):
                    for t in shapely.constrained_delaunay_triangles(p).geoms:
                      model.triangle(
                        [
                          [a, platform["y"] + sample_offset_v307(field, a, b, False), b]
                          for a, b in list(t.exterior.coords)[:3]
                        ],
                        0xB5B4A8,
                        "complete-graded-original-platform",
                      )
          continue
        matrices = (
          np.frombuffer(base64.b64decode(child["matrix"]), "<f4")
          .reshape(-1, 4, 4)
          .transpose(0, 2, 1)
        )
        instance_colors = np.frombuffer(
          base64.b64decode(child["color"]), "<f4"
        ).reshape(-1, 3)
        colorspec = child["attributes"].get("color")
        vertex_colors = (
          np.frombuffer(
            base64.b64decode(colorspec["array"]),
            {"Float32Array": "<f4", "Uint8Array": "u1", "Uint16Array": "<u2"}[
              colorspec["type"]
            ],
          )
          .reshape(-1, 3)
          .astype(float)
          if colorspec
          else np.ones_like(ps)
        )
        if colorspec and colorspec["normalized"]:
          vertex_colors /= 255 if colorspec["type"] == "Uint8Array" else 65535
        for matrix, color in zip(matrices, instance_colors, strict=True):
          points = np.c_[ps, np.ones(len(ps))] @ matrix.T
          points = points[:, :3]
          centre = matrix[:3, 3]
          points[:, 1] += grade(*map(float, centre))
          if (
            native
            and abs(float(matrix[1, 1]) - 0.3) < 0.00001
            and np.max(np.abs(color - _linear_v307(0xB5B4A8))) < 0.0001
          ):
            lo, hi = points.min(axis=0), points.max(axis=0)
            navigation.append(
              dict(
                key=station["stationName"] + "-native-platform-" + str(len(navigation)),
                native=True,
                ring=[[lo[0], lo[2]], [hi[0], lo[2]], [hi[0], hi[2]], [lo[0], hi[2]]],
                holes=[],
                low=float(lo[1]),
                high=float(hi[1]),
                role="actual-compiled-solid",
              )
            )
          rgb = np.asarray(vertex_colors, dtype="<f4") * np.asarray(color, dtype="<f4")
          for t in ix:
            model.triangle(
              points[t], rgb[t], "complete-original-station-fitting-at-measured-grade"
            )
      # Source-mapped platform navigation, same exact floor plane sampler.
      for p in platforms:
        navigation.append(
          dict(
            key=p["id"],
            native=native,
            ring=p["rings"][0],
            holes=p["rings"][1:],
            field=field["key"],
            baseY=p["y"],
            low=min(
              p["y"] + sample_offset_v307(field, float(q[0]), float(q[1]), native) - 0.3
              for q in p["rings"][0]
            ),
            high=max(
              p["y"] + sample_offset_v307(field, float(q[0]), float(q[1]), native)
              for q in p["rings"][0]
            ),
            role="graded-platform",
          )
        )
    # Modern Wedding concrete deck, using only its complete source platform.
    for p in rail["platforms"]:
      if p["station"] != "Wedding":
        continue
      g = Polygon(p["rings"][0], p["rings"][1:])
      model.surface(
        g, 10.12, 0xAEB3AD, "wedding-source-concrete-deck-underside", native, 0.62
      )
      for ring in p["rings"]:
        for a, b in zip(ring, ring[1:]):
          model.beam(
            a, b, 9.91, 0.24, 0.62, 0xB7BAB2, "wedding-modern-concrete-fascia", native
          )
    navigation.extend(model.solids)
    packed = model.packed("complete-rail-sports-architecture-v307:" + mode, native)
    models.extend(packed)
    audit.append(
      dict(
        native=native,
        vertices=sum(p["vertices"] for p in packed),
        triangles=sum(p["triangles"] for p in packed),
        spatialParts=len(packed),
        roles=dict(model.roles),
      )
    )
  write_v307(
    DATA / "railSseArchitectureV307.json",
    dict(
      schemaVersion=1,
      models=models,
      catalog={
        "drawn": [p["key"] for p in models if not p["native"]],
        "minecraft": [p["key"] for p in models if p["native"]],
      },
    ),
  )
  navigation = [
    r
    for r in navigation
    if not (
      r["native"]
      and r["role"]
      in (
        "sports-source-shell",
        "graded-platform",
        "estimated-thin-roof-supported-by-measured-rim",
        "open-thin-canopy",
      )
    )
  ]
  write_v307(
    DATA / "railSseNavigationV307.json", dict(schemaVersion=1, records=navigation)
  )
  write_v307(
    GEO / "rail-sse-v307-model-evidence.json.gz",
    dict(
      schemaVersion=1,
      counts=audit,
      sourceSource=str(SOURCE.relative_to(ROOT)),
      policy=source["architecturePolicy"],
    ),
  )
  print(audit)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("captures", type=Path)
  build_models_v307(parser.parse_args().captures)


if __name__ == "__main__":
  main()
