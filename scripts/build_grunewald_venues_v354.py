"""Measured roofs at three exact Grunewald restaurant building owners.

The full official source parents are retained. Only the two Fischerhütte leaves
independently matched to the named public buildings and Paulsborn's complete
main family/chimney replace their explicitly proven 9 m fallback prisms.
No water, shore, park, path or unrelated building owner is changed.
"""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_civic_places_v352 import pieces, read, write
from scripts.build_fuel_packets_v351 import Mesh, rgb
from scripts.build_grunewald_terrain_v190 import field, offset_at
from scripts.build_karl_marx_allee_v161 import Detail
from scripts.build_rixdorf_v304 import native_model

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
KIND = "grunewald-venues-v354"
FISCHER = "outer187--20_15"
PAULSBORN = "outer187--16_11"
SELECTION = {
  "fischerhuette": {
    "host": FISCHER,
    "old": "OSM-way-108201957",
    "parents": {"DEBE06YYA000044F": ["DEBE3DX5V7WQi7xu"]},
    "label": "Fischerhütte am Schlachtensee",
    "tile": "379_5812",
    "wall": [218, 207, 178],
    "roof": [135, 103, 79],
  },
  "alte-fischerhuette": {
    "host": FISCHER,
    "old": "OSM-way-108201958",
    "parents": {"DEBE06YYA000044F": ["DEBE3DhoByTOHyrA"]},
    "label": "Alte Fischerhütte / Weinhandlung",
    "tile": "379_5812",
    "wall": [205, 172, 106],
    "roof": [150, 104, 77],
  },
  "paulsborn": {
    "host": PAULSBORN,
    "old": "OSM-way-1442674049",
    "parents": {"DEBE06YYA0000LNp": None, "DEBE06YYA000377J": None},
    "label": "Villa Paulsborn / Locanda 12 Apostoli",
    "tile": "381_5814",
    "wall": [225, 218, 198],
    "roof": [106, 94, 82],
  },
}
REFERENCES = [
  "https://www.berlin.de/lageso/gesundheit/gesundheitsschutz/badegewaesser/badegewaesserprofile/artikel.339152.php",
  "https://www.berlin.de/sen/uvk/natur-und-gruen/naturschutz/natura-2000/natura-gebiete/grunewald/",
  "https://www.berlin.de/sen/uvk/_assets/natur-gruen/naturschutz/natura-2000/natura-gebiete/grunewald.pdf",
  "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/wasserbau/entschlammungsprogramm/hundekehlegraben/",
  "https://fischerhuette-berlin.de/",
  "https://fischerhuette-berlin.de/app/uploads/sites/3/2024/05/FischerhuetteWeinhandlungTerrasse_04544-1536x1024.jpg",
  "https://www.locanda-12apostoli.de/",
  "https://static.wixstatic.com/media/400dae_e7734af4ddd04351822343497a6c3034~mv2.jpg",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075450",
  "https://denkmaldatenbank.berlin.de/media/uploads/Zeh/01/09075450_klein.jpg",
]


def fingerprint(mesh):
  value = 2166136261
  for key in ["positions", "colors", "indices"]:
    for char in mesh[key]:
      value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return value


def arrays(mesh, origin):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p.astype(float) / 100 + origin, ix


def world_poly(nav, origin):
  return translate(Polygon(nav["ring"], nav["holes"]), origin[0], origin[2])


def old_body_receipt(packet, selected):
  """Admit only complete roofs/vertical fallback walls, never nearby terrain.

  Full roof coverage and every perimeter wall's expected area are proved from
  the exact preceding navigation polygon. All actual old triangle ordinals and
  full original vertex/color/index strings stay bound by the runtime receipt.
  """
  origin = packet["origin"]
  by_mesh = {}
  reports = []
  for old in selected:
    assert old["heightSource"].startswith("display_fallback:")
    poly = world_poly(old, origin)
    lo = packet["nav"]["groundY"] + old.get("groundOffset", 0) + old["minHeight"]
    hi = packet["nav"]["groundY"] + old.get("groundOffset", 0) + old["height"]
    roofs, wall_area, count = [], 0.0, 0
    for mi, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "city":
        continue
      ps, ix = arrays(mesh, origin)
      all_triangles = ps[ix]
      bounds = poly.bounds
      nearby = (
        (all_triangles[:, :, 0].min(axis=1) >= bounds[0] - 0.02)
        & (all_triangles[:, :, 0].max(axis=1) <= bounds[2] + 0.02)
        & (all_triangles[:, :, 2].min(axis=1) >= bounds[1] - 0.02)
        & (all_triangles[:, :, 2].max(axis=1) <= bounds[3] + 0.02)
      )
      for ti in np.flatnonzero(nearby):
        t = all_triangles[ti]
        if not all(poly.buffer(0.011).covers(Point(x, z)) for x, _, z in t):
          continue
        normal = np.cross(t[1] - t[0], t[2] - t[0])
        if np.linalg.norm(normal) < 1e-8:
          continue
        roof = np.all(np.abs(t[:, 1] - hi) < 0.011)
        wall = abs(normal[1]) < 1e-5 and abs(np.ptp(t[:, 1]) - (hi - lo)) < 0.011
        if wall:
          mid = t[:, [0, 2]].mean(axis=0)
          normal_xz = normal[[0, 2]] / np.linalg.norm(normal[[0, 2]])
          wall = not poly.contains(Point(*(mid + normal_xz * 0.04))) and poly.buffer(
            0.001
          ).covers(Point(*(mid - normal_xz * 0.04)))
          # V190 sometimes used the earlier touching neighbour as its rigid
          # anchor. Only that exact original lookup is admitted, not arbitrary Y.
          candidates = [
            n
            for n in packet["nav"]["buildings"]
            if world_poly(n, origin).buffer(0.1).covers(Point(*mid))
          ]
          expected = (
            packet["nav"]["groundY"] + candidates[0].get("groundOffset", 0)
            if candidates
            else lo
          )
          wall = wall and abs(t[:, 1].min() - expected) < 0.011
        if not roof and not wall:
          continue
        # A neighbour's boundary wall at a different height cannot pass this
        # exact full-height test. Duplicate same-height faces are detected below.
        if ti in by_mesh.setdefault(mi, set()):
          raise ValueError("Fallback owner triangles overlap")
        by_mesh[mi].add(ti)
        count += 1
        if roof:
          roofs.append(Polygon([(x, z) for x, _, z in t]))
        else:
          wall_area += float(np.linalg.norm(normal) / 2)
    union = unary_union(roofs)
    missing = poly.symmetric_difference(union).area
    expected_wall = poly.length * (hi - lo)
    assert missing < 0.005, (old["sourceId"], "incomplete old roof", missing)
    assert abs(wall_area - expected_wall) < 0.02, (
      old["sourceId"],
      wall_area,
      expected_wall,
    )
    reports.append(
      dict(
        sourceId=old["sourceId"],
        triangles=count,
        roofArea=union.area,
        roofDifference=missing,
        wallArea=wall_area,
        expectedWallArea=expected_wall,
        groundY=lo,
        topY=hi,
      )
    )
  retired_lines = []
  if packet.get("lines", {}).get("positions"):
    lines = (
      np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
        -1, 2, 3
      )
      / 100
      + origin
    )
    for i, line in enumerate(lines):
      for old in selected:
        poly = world_poly(old, origin)
        hi = (
          packet["nav"]["groundY"] + old.get("groundOffset", 0) + old["height"] + 0.02
        )
        if all(
          abs(v[1] - hi) < 0.011 and poly.boundary.distance(Point(v[0], v[2])) < 0.015
          for v in line
        ):
          retired_lines.append(i)
          break
  return (
    [dict(mesh=m, triangles=sorted(v)) for m, v in sorted(by_mesh.items())],
    retired_lines,
    reports,
  )


def wall_fittings(detail, surface, family, base, key):
  """Photo-informed openings, clipped to complete measured wall sheets.

  Bay spacing is explicitly estimated, not a surveyed individual-aperture claim.
  All coloured regions are disjoint; no full backing overlaps glazing/mullions.
  """
  ring = surface["rings"][0]
  horizontal = [
    (a, b) for a, b in zip(ring, ring[1:] + ring[:1]) if abs(a[1] - b[1]) < 0.02
  ]
  if not horizontal:
    return 0
  aa, bb = max(horizontal, key=lambda q: math.dist(*q))
  a, b = np.array(aa)[[0, 2]], np.array(bb)[[0, 2]]
  length = np.linalg.norm(b - a)
  if length < 3:
    return 0
  d = (b - a) / length
  n = np.array([-d[1], d[0]])
  mid = (a + b) / 2
  if family.covers(Point(*(mid + n * 0.15))):
    n = -n
  if family.contains(Point(*(mid + n * 0.3))):
    return 0
  rr = [[[(np.array(p)[[0, 2]] - a).dot(d), p[1]] for p in r] for r in surface["rings"]]
  plane = Polygon(rr[0], rr[1:]).buffer(0)
  count = 0

  def emit(poly, color, role):
    for p in pieces(poly):
      for triangle in shapely.constrained_delaunay_triangles(
        shapely.set_precision(p, 0.000001)
      ).geoms:
        q = [
          [
            float(a[0] + d[0] * u + n[0] * 0.16),
            float(y),
            float(a[1] + d[1] * u + n[1] * 0.16),
          ]
          for u, y in list(triangle.exterior.coords)[:-1]
        ]
        normal = np.cross(np.subtract(q[1], q[0]), np.subtract(q[2], q[0]))
        if np.dot(normal[[0, 2]], n) < 0:
          q.reverse()
        detail.triangles.append((q, color, role))

  bays = max(1, round(length / (3.4 if key == "paulsborn" else 3.1)))
  for row in range(2):
    low = base + 1.05 + row * 3.65
    h = 2.35 if row == 0 else 1.7
    width = min(1.55 if row == 0 else 1.1, length / bays * 0.52)
    for bay in range(bays):
      u = (bay + 0.5) * length / bays
      if key == "paulsborn" and row == 0:
        # Rounded large restaurant windows visible in the operator garden photo.
        pts = [
          (u - width / 2, low),
          (u + width / 2, low),
          (u + width / 2, low + h - width / 2),
        ]
        pts += [
          (u + width / 2 * math.cos(t), low + h - width / 2 + width / 2 * math.sin(t))
          for t in np.linspace(0, math.pi, 13)[1:]
        ]
        aperture = Polygon(pts)
      else:
        aperture = box(u - width / 2, low, u + width / 2, low + h)
      outer = aperture.buffer(0.12, join_style=2)
      if not plane.buffer(-0.025).covers(outer):
        continue
      mullion = aperture.intersection(
        unary_union(
          [
            box(u - 0.045, low, u + 0.045, low + h),
            box(u - width / 2, low + h * 0.68, u + width / 2, low + h * 0.68 + 0.07),
          ]
        )
      )
      frame = [204, 198, 177] if key == "paulsborn" else [57, 75, 59]
      emit(outer.difference(aperture), frame, "estimated window reveal")
      emit(aperture.difference(mullion), [62, 80, 78], "estimated window glazing")
      emit(mullion, frame, "estimated window mullion")
      count += 1
  return count


def supported_minimum(family, native):
  """Exact minimum of the retained piecewise-linear field, no ground mutation."""
  domain = family.buffer(1.5) if native else family
  profile = field()["profiles"][0]
  # Both literal sites lie outside the separate Karlsberg refinement.
  assert all(not box(*p["support"]).intersects(domain) for p in field()["profiles"][1:])
  step = 8 if native else profile["stepM"]
  west, north = (0, 0) if native else profile["support"][:2]
  lo_x, lo_z, hi_x, hi_z = domain.bounds
  values = []
  for ix in range(math.floor((lo_x - west) / step), math.ceil((hi_x - west) / step)):
    for iz in range(
      math.floor((lo_z - north) / step), math.ceil((hi_z - north) / step)
    ):
      x, z = west + ix * step, north + iz * step
      if native:
        if box(x, z, x + step, z + step).intersects(domain):
          values.append(3 + offset_at(x + step / 2, z + step / 2, True))
      else:
        for triangle in [
          Polygon([(x, z), (x + step, z), (x + step, z + step)]),
          Polygon([(x, z), (x + step, z + step), (x, z + step)]),
        ]:
          for p in pieces(triangle.intersection(domain)):
            values.extend(3 + offset_at(a, b) for a, b in p.exterior.coords)
  assert values
  return min(values), len(values)


def build(task):
  parents = {}
  for spec in SELECTION.values():
    for owner in spec["parents"]:
      if owner in parents:
        continue
      archive = GEO / "raw/lod2" / f"LoD2_{spec['tile']}.zip"
      xml = extract_parent(archive, owner)
      parents[owner] = dict(
        id=owner,
        sourceUrl=f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
        sourceSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
        parts=[part_profile(p) for p in leaf_building_parts(xml) or [xml]],
      )
  original_parents = copy.deepcopy(parents)
  sources, reports = [], []
  for serial, host in enumerate([FISCHER, PAULSBORN]):
    plans = {}
    for mode in ["drawn", "minecraft"]:
      capture = read(task / f"{mode}-{host}.json.gz")
      packet = capture["prepared"]
      assert not capture["declined"]
      ids = [s["old"] for s in SELECTION.values() if s["host"] == host]
      old = [n for n in packet["nav"]["buildings"] if n["sourceId"] in ids]
      assert len(old) == len(ids)
      companion = (
        read(task / f"{mode}-{host}-grunewald-v190-1.json.gz")
        if mode == "minecraft"
        else None
      )
      proof_packet = {
        **packet,
        "meshes": [
          *packet["meshes"],
          *(companion["prepared"]["meshes"] if companion else []),
        ],
      }
      retire, lines, retired = old_body_receipt(proof_packet, old)
      whole = Detail()
      appended_nav = []
      site_reports = []
      for key, spec in SELECTION.items():
        if spec["host"] != host:
          continue
        previous = next(n for n in old if n["sourceId"] == spec["old"])
        base = packet["nav"]["groundY"] + previous.get("groundOffset", 0)
        parts = [
          copy.deepcopy(p)
          for parent, selected in spec["parents"].items()
          for p in parents[parent]["parts"]
          if selected is None or p["id"] in selected
        ]
        family = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
        delta = base - min(p["ground_y_m"] for p in parts)
        detail = Detail()
        for part in parts:
          part["ground_y_m"] += delta
          part["top_y_m"] += delta
          for s in part["surfaces"]:
            for r in s["rings"]:
              for v in r:
                v[1] += delta
            for t in triangles_for(s["rings"]):
              detail.triangles.append(
                (
                  t,
                  spec["roof"] if s["kind"] == "RoofSurface" else spec["wall"],
                  "source " + s["kind"],
                )
              )
        source_triangles = len(detail.triangles)
        openings = sum(
          wall_fittings(detail, s, family, base, key)
          for p in parts
          for s in p["surfaces"]
          if s["kind"] == "WallSurface"
        )
        # Retain all terrain. A narrow solid foundation on the exact footprint
        # extends below the lowest retained DGM surface; no levelling or apron.
        min_ground, ground_samples = supported_minimum(family, mode == "minecraft")
        foundation_low = min(base, math.floor(min_ground * 100) / 100 - 0.05)
        if foundation_low < base - 0.01:
          for poly in pieces(shapely.orient_polygons(family, exterior_cw=True)):
            for ring in [poly.exterior, *poly.interiors]:
              for (x, z), (a, b) in zip(ring.coords, list(ring.coords)[1:]):
                detail.polygon(
                  [
                    [x, foundation_low, z],
                    [a, foundation_low, b],
                    [a, base, b],
                    [x, base, z],
                  ],
                  [137, 133, 119],
                  "foundation below source base",
                )
        if mode == "minecraft":
          model, caps = native_model(detail)
          domain = unary_union([box(*c[:4]) for c in caps])
          for poly in pieces(domain):
            sub = [c for c in caps if box(*c[:4]).intersection(poly).area > 0.001]
            appended_nav.append(
              dict(
                ring=[
                  [x - packet["origin"][0], z - packet["origin"][2]]
                  for x, z in list(poly.exterior.coords)[:-1]
                ],
                holes=[
                  [
                    [x - packet["origin"][0], z - packet["origin"][2]]
                    for x, z in list(r.coords)[:-1]
                  ]
                  for r in poly.interiors
                ],
                height=max(c[4] for c in sub) - 3,
                minHeight=foundation_low - 3,
                sourceId=KIND + ":" + key,
                heightSource="independent one-metre measured roof cells",
                nativeRoofCaps=[
                  [
                    x0 - packet["origin"][0],
                    z0 - packet["origin"][2],
                    x1 - packet["origin"][0],
                    z1 - packet["origin"][2],
                    top - 3,
                  ]
                  for x0, z0, x1, z1, top in sub
                ],
              )
            )
        else:
          model = detail
          for part in parts:
            roofs = [
              t
              for s in part["surfaces"]
              if s["kind"] == "RoofSurface"
              for t in triangles_for(s["rings"])
            ]
            appended_nav.append(
              dict(
                ring=[
                  [x - packet["origin"][0], z - packet["origin"][2]]
                  for x, z in part["ring"]
                ],
                holes=[
                  [[x - packet["origin"][0], z - packet["origin"][2]] for x, z in r]
                  for r in part["holes"]
                ],
                height=part["top_y_m"] - 3,
                minHeight=foundation_low - 3,
                sourceId=KIND + ":" + part["id"],
                heightSource="complete measured LoD2 leaf; retained terrain anchor",
                roofTriangles=[
                  [
                    [x - packet["origin"][0], y - 3, z - packet["origin"][2]]
                    for x, y, z in t
                  ]
                  for t in roofs
                ],
              )
            )
        whole.triangles.extend(model.triangles)
        site_reports.append(
          dict(
            key=key,
            oldOwner=spec["old"],
            parts=[p["id"] for p in parts],
            sourceTriangles=source_triangles,
            openings=openings,
            sourceTranslationY=delta,
            base=base,
            foundationLow=foundation_low,
            minimumGroundSample=min_ground,
            groundSupportSamples=ground_samples,
            triangles=len(model.triangles),
            footprintArea=family.area,
          )
        )
      batches = (
        [whole.triangles]
        if companion is None
        else [
          whole.triangles[: len(whole.triangles) // 2],
          whole.triangles[len(whole.triangles) // 2 :],
        ]
      )
      for bi, triangles in enumerate(batches):
        mesh = Mesh(packet["origin"])
        for t, c, _ in triangles:
          mesh.triangle(t, [rgb(c)] * 3)
        payload = mesh.payload()
        payload["kind"] = KIND
        current = capture if bi == 0 else companion
        plan = current["plan"]
        split = len(packet["meshes"])
        local_retire = (
          [r for r in retire if r["mesh"] < split]
          if bi == 0
          else [
            dict(mesh=r["mesh"] - split, triangles=r["triangles"])
            for r in retire
            if r["mesh"] >= split
          ]
        )
        plan.update(
          retire=local_retire,
          retireLines=lines if bi == 0 else [],
          retireNav=old if bi == 0 else [],
          appendNav=appended_nav if bi == 0 else [],
          owners=ids,
          append=payload,
          appendFingerprint=fingerprint(payload),
        )
        plans[f"{mode}:{host}" + ("" if bi == 0 else "-grunewald-v190-1")] = plan
      reports.append(
        dict(
          key=f"{mode}:{host}",
          oldBodyProof=retired,
          retiredLines=len(lines),
          retiredTriangles=sum(len(r["triangles"]) for r in retire),
          sites=site_reports,
          oldPacketSha256=hashlib.sha256(
            (
              ROOT
              / "src/app/public/mesh/surrounding-berlin-v159"
              / f"{host}.{mode}.json.gz"
            ).read_bytes()
          ).hexdigest(),
        )
      )
    value = dict(schemaVersion=1, keys=list(plans), packets=plans)
    file = f"grunewaldVenuesV354Packets{serial:03}.json.gz"
    write(DATA / file, value)
    compressed = (DATA / file).read_bytes()
    sources.append(
      dict(
        file=file,
        keys=list(plans),
        decodedBytes=len(gzip.decompress(compressed)),
        compressedBytes=len(compressed),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
    )
  write(DATA / "grunewaldVenuesV354Index.json", dict(sources=sources))
  evidence = dict(
    schemaVersion=1,
    baseline="4bb88fa3",
    references=REFERENCES,
    originalParents=list(original_parents.values()),
    selection=SELECTION,
    reports=reports,
    limits="Only three precisely matched fallback bodies. Full official parents retained, two selected Fischerhütte leaves rendered; annexes unchanged. Photographic material and aperture spacing are estimates; no interior or survey claim. No water/terrain/path edits.",
    sources=sources,
  )
  write(GEO / "grunewald-venues-v354-source.json.gz", evidence)
  write(task / "build-report.json", dict(reports=reports, sources=sources))
  print(json.dumps(sources))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("task", type=Path)
  build(parser.parse_args().task)
