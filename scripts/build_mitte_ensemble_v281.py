"""Step 10: source-bound Ensemble courtyard and Dorotheenstrasse recognition.

Complete retained LoD2 owners are evidence, not replacement shells. Only exact
generic drawn fittings retire; native fittings follow the existing native faces.
"""

from __future__ import annotations

import base64
import gzip
import math
from collections import Counter

import build_alt_mitte_v169 as core
import numpy as np
import shapely
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_ihz_v241 import native_faces
from build_karl_marx_allee_v161 import Detail, native_detail
from build_lafayette_v241 import GEO, ROOT, pieces, read, sha, surface_plane, write
from build_scheunenviertel_v168 import merge_native_faces
from lafayette_v241_receipts import fingerprint, mesh_signatures, retained
from shapely.geometry import Polygon, box

APP = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "mitte-ensemble-v281-source.json.gz"
EVIDENCE = GEO / "mitte-ensemble-v281-evidence.json"
RUNTIME = APP / "mitteEnsembleV281.json"
PREVIOUS = APP / "mitteEnsembleV281Previous.json"
RED = "DEBE01YYK00007Hk"
NEW = "DEBE01YYK00001hf"
GANYMED = "DEBE01YYK0000BQ7"
SPLENDID = "DEBE01YYK0000D6X"
HYPO = "DEBE01YYK00002Gu"
OWNERS = {RED, NEW, GANYMED, SPLENDID, HYPO}
BOUNDS = [920, -395, 1250, 85]
POLICY = "Full measured owners, roofs, courts, independent native cells and navigation unchanged. Thin source-bound architectural fittings only. Reference-derived window, relief, colour and signage dimensions are display estimates, not measured reconstruction. No raster media or textures. No coverage, quality or residency changes."
REFERENCES = [
  dict(
    url="https://www.berliner-ensemble.de/magazin/kennen-sie-schon-die-be-kantine",
    date="2024-07-03",
    use="Operator identifies courtyard canteen and red rehearsal building",
  ),
  dict(
    url="https://www.berliner-ensemble.de/sites/default/files/2023-10/Drohne_Hof_02-Foto-Dronebrothers.jpg",
    author="Dronebrothers / Berliner Ensemble",
    use="Reference only: red rehearsal building, sparse windows, grey base and gold screened Neues Haus; no image bundled",
  ),
  dict(
    url="https://www.berliner-ensemble.de/neues-haus",
    use="Operator venue and building history",
  ),
  dict(
    url="https://www.ganymed-brasserie.de/unser-restaurant/",
    use="Operator confirms address Schiffbauerdamm 5 and historic building",
  ),
  dict(
    url="https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Schiffbauerdamm_5,_Mietshaus.jpg",
    author="Jörg Zägel",
    date="2010-04-28",
    license="CC-BY-SA-3.0",
    licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/",
    use="Reference only: arched corner mural niche and burgundy awnings. No copied photograph or commercial logo.",
  ),
  dict(
    url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055004",
    author="Landesdenkmalamt Berlin",
    use="Hotel Splendid, Dorotheenstrasse 37; four-wing courtyard, sculptural central risalit and curved neobaroque window hoods",
  ),
  dict(
    url="https://denkmaldatenbank.berlin.de/media/uploads/Mit/02/09055004a.jpg",
    author="Landesdenkmalamt Berlin",
    date="2001",
    use="Reference only: facade axes, central reliefs and open iron balconies. Historic photograph does not establish current tenant or paint hue.",
  ),
  dict(
    url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055003",
    author="Landesdenkmalamt Berlin",
    use="Preussische Hypothekenbank, Dorotheenstrasse 35: three axes, rusticated base and giant columns/pilasters",
  ),
  dict(
    url="https://denkmaldatenbank.berlin.de/media/uploads/Mit/02/09055003a.jpg",
    author="Landesdenkmalamt Berlin",
    date="2001",
    use="Reference only: central triple opening, colossal order, cornices and portal. No image bundled.",
  ),
]


def target_key(owner, part, si):
  if owner == RED and part == "DEBE3Dn17KY31ZDw" and si in (0, 5):
    return "red-court" if si == 5 else "red-return"
  if owner == SPLENDID and part == "DEBE3DHvXqHau5Ma" and si == 2:
    return "splendid"
  if owner == HYPO and si == 8:
    return "hypothekenbank"
  if owner == NEW and part == "DEBE3DAHYCHo1QS2" and si in (6, 11, 13):
    return "new-side"
  if owner == GANYMED and si == 15:
    return "ganymed-niche"
  if owner == GANYMED and si in (1, 11):
    return "ganymed-awning-west" if si == 1 else "ganymed-awning-south"
  return None


def reference(key):
  # Original measured facade planes; u subdivisions below are reference estimates.
  if key == "red-court":
    return np.array([936.879, -379.695]), np.array([953.084, -344.671]), 4.5, 25.084
  if key == "red-return":
    return np.array([953.084, -344.671]), np.array([938.987, -338.201]), 4.5, 25.084
  if key == "splendid":
    return np.array([1210.629, 51.031]), np.array([1233.134, 49.13]), 4.5, 24.183
  if key == "hypothekenbank":
    return np.array([1233.134, 49.13]), np.array([1244.515, 47.956]), 4.3, 24.707
  if key == "new-side":
    return np.array([965.333, -393.103]), np.array([974.589, -373.598]), 4.4, 17.921
  if key == "ganymed-niche":
    return np.array([1021.72, -294.498]), np.array([1021.706, -291.106]), 2.5, 23.183
  if key == "ganymed-awning-west":
    return np.array([998.247, -289.580]), np.array([1009.070, -278.635]), 2.5, 23.183
  if key == "ganymed-awning-south":
    return np.array([1009.070, -278.635]), np.array([1021.706, -291.106]), 2.5, 23.183
  raise ValueError(key)


def fittings(surface, key, native=False):
  d = Detail()
  o, n, dominant, _, _ = surface_plane(surface)
  first, last, base, top = reference(key)
  tangent = (last - first) / np.linalg.norm(last - first)
  width = float(np.linalg.norm(last - first))
  rings = []
  for ring in surface["rings"]:
    p = np.array(ring)
    rings.append(np.column_stack(((p[:, [0, 2]] - first) @ tangent, p[:, 1])).tolist())
  clip = shapely.make_valid(Polygon(rings[0], rings[1:]))
  # Native wall cells can extend below the measured ground and above eaves.
  # Their body stays intact; the architectural fitting never claims that space.
  clip = clip.intersection(box(-0.25, base, width + 0.25, top))

  def emit(shape, color, role, depth=0.22):
    for poly in pieces(clip.intersection(shape)):
      if poly.area < 0.0001:
        continue
      for tri in shapely.constrained_delaunay_triangles(poly).geoms:
        points = []
        for u, y in list(tri.exterior.coords)[:-1]:
          # Two linear equations recover x,z on the measured/native face.
          rhs = [u + first @ tangent, n @ o - n[1] * y]
          x, z = np.linalg.solve([[tangent[0], tangent[1]], [n[0], n[2]]], rhs)
          p = np.array([x, y, z]) + n * (
            (0.08 + (depth - 0.22) * 2.5) if native else depth
          )
          points.append(p.tolist())
        if (
          np.cross(np.array(points[1]) - points[0], np.array(points[2]) - points[0]) @ n
          < 0
        ):
          points.reverse()
        d.polygon(points, color, key + ": " + role)

  def rect(u, y, w, h, color, role, depth=0.3):
    if w > 0 and h > 0:
      emit(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2), color, role, depth)

  def arc(u, y, rx, ry, thickness, color, role, depth=0.34):
    count = 12
    for i in range(count):
      a, b = i * math.pi / count, (i + 1) * math.pi / count
      emit(
        Polygon(
          [
            (u + rx * math.cos(a), y + ry * math.sin(a)),
            (u + rx * math.cos(b), y + ry * math.sin(b)),
            (u + (rx - thickness) * math.cos(b), y + (ry - thickness) * math.sin(b)),
            (u + (rx - thickness) * math.cos(a), y + (ry - thickness) * math.sin(a)),
          ]
        ),
        color,
        role,
        depth,
      )

  def window(u, y, w, h, frame=(211, 208, 195), depth=0.3):
    rect(u, y, w + 0.17, h + 0.18, frame, "window reveal", depth)
    rect(u, y, w, h, (53, 69, 69), "glazing", depth + 0.025)
    rect(u, y, 0.065, h, frame, "paired mullion", depth + 0.04)
    rect(u, y + h * 0.24, w, 0.07, frame, "transom", depth + 0.04)
    rect(u, y - h / 2 - 0.08, w + 0.28, 0.12, frame, "projected sill", depth + 0.06)

  def label(text, u, y, height, color, depth=0.55):
    # Small original geometric letters; no font, logo or image asset.
    glyphs = {
      "A": "010101111101101",
      "D": "110101101101110",
      "E": "111100110100111",
      "G": "111100101101111",
      "I": "111010010010111",
      "K": "101101110101101",
      "M": "101111111101101",
      "N": "101111111111101",
      "T": "111010010010010",
      "Y": "101101010010010",
    }
    cell = height / 5
    left = u - (len(text) * 4 - 1) * cell / 2
    for i, char in enumerate(text):
      glyph = glyphs[char]
      for k, on in enumerate(glyph):
        if on == "1":
          rect(
            left + (i * 4 + k % 3 + 0.5) * cell,
            y + (2 - k // 3) * cell,
            cell * 0.88,
            cell * 0.88,
            color,
            "geometric lettering " + text,
            depth,
          )

  if key.startswith("red-"):
    emit(clip, (151, 69, 56), "plain red rehearsal wall")
    emit(
      box(-2, base - 1, width + 2, base + 3.2),
      (112, 111, 105),
      "grey service and canteen base",
      0.235,
    )
    # The upper wall is intentionally mostly solid, as in the operator's photo.
    count = 10 if key == "red-court" else 4
    for i in range(count):
      u = width * (i + 0.5) / count
      window(u, base + 12.2, 1.15, 2.85, (80, 74, 66))
      if i % 2 == 0:
        window(u, base + 7.05, 1.45, 1.1, (147, 145, 132))
    rect(
      width / 2,
      base + 10.6,
      width - 0.3,
      0.10,
      (44, 46, 43),
      "continuous upper walkway rail",
      0.40,
    )
    for u in np.arange(0.4, width, 0.9):
      rect(u, base + 10.12, 0.045, 1.0, (44, 46, 43), "walkway guard upright", 0.4)
    rect(width / 2, top - 0.15, width, 0.18, (112, 116, 108), "metal roof edge", 0.32)
    if key == "red-court":
      window(width * 0.74, base + 1.45, 2.65, 2.7, (58, 61, 58))
      rect(
        width * 0.74,
        base + 3.0,
        3.1,
        0.44,
        (44, 46, 43),
        "canteen entrance lintel",
        0.37,
      )
      label("KANTINE", width * 0.74, base + 3.0, 0.25, (226, 219, 192), 0.42)
      for u in [width * 0.24, width * 0.34]:
        window(u, base + 1.45, 1.2, 2.65, (62, 66, 62))
  elif key == "new-side":
    emit(clip, (190, 157, 90), "gold expanded-metal screen")
    emit(
      box(-1, base - 1, width + 1, base + 2.7),
      (64, 76, 73),
      "recessed dark foyer",
      0.24,
    )
    for u in np.arange(0.0, width, 0.26):
      rect(
        u,
        (base + 2.7 + top) / 2,
        0.035,
        top - base - 2.7,
        (154, 124, 66),
        "fine screen rib",
        0.28,
      )
    for u in np.arange(0.0, width + 1, width / 8):
      rect(
        u, (base + top) / 2, 0.065, top - base, (108, 109, 87), "screen bay joint", 0.32
      )
    for y in [base + 2.7, base + 6.9, base + 11.1, top - 0.12]:
      rect(width / 2, y, width, 0.075, (222, 205, 155), "horizontal screen joint", 0.34)
  elif key == "ganymed-niche":
    emit(clip, (222, 213, 181), "plain chamfer between historic fronts")
    u = width / 2
    y = base + 10.9
    w = width * 0.69
    h = 6.1
    rect(
      u, y, w + 0.28, h + 0.25, (149, 150, 132), "historic mural niche surround", 0.28
    )
    rect(u, y, w, h, (171, 143, 74), "gold mural ground", 0.30)
    emit(
      Polygon(
        [
          (u - w / 2, y + h / 2),
          *[
            (u + w / 2 * math.cos(t), y + h / 2 + 0.76 * math.sin(t))
            for t in np.linspace(math.pi, 0, 13)
          ],
        ]
      ),
      (171, 143, 74),
      "gold arched mural crown",
      0.30,
    )
    arc(
      u, y + h / 2, w / 2 + 0.14, 0.92, 0.16, (149, 150, 132), "arched niche cap", 0.34
    )
    # Small geometric allegory cue; no photographic texture or copied mural artwork.
    rect(u, y + 1.1, 0.5, 0.6, (200, 172, 126), "estimated allegory head", 0.34)
    emit(
      Polygon(
        [
          (u - 0.25, y + 0.8),
          (u + 0.38, y + 0.7),
          (u + 0.65, y - 1.6),
          (u - 0.62, y - 1.6),
        ]
      ),
      (118, 69, 66),
      "estimated draped allegory silhouette",
      0.34,
    )
    rect(u, y - 1.8, w * 0.85, 0.12, (136, 129, 104), "niche plinth", 0.35)
    rect(
      u,
      base + 2.35,
      width * 0.82,
      0.55,
      (101, 41, 44),
      "burgundy entrance canopy valance",
      0.34,
    )
    rect(u, base + 1.1, 1.45, 2.1, (65, 47, 41), "recessed restaurant entrance", 0.30)
  elif key.startswith("ganymed-awning"):
    # Awning widths stay tied to the complete facade across native cells.
    for i in range(max(2, round(width / 4.4))):
      count = max(2, round(width / 4.4))
      step = width / count
      u = (i + 0.5) * step
      rect(
        u,
        base + 3.3,
        step * 0.80,
        0.68,
        (101, 37, 42),
        "burgundy brasserie awning",
        0.46,
      )
      rect(u, base + 2.94, step * 0.8, 0.13, (131, 53, 53), "awning valance", 0.50)
      rect(
        u,
        base + 3.86,
        step * 0.75,
        0.25,
        (132, 48, 47),
        "restaurant lettering fascia",
        0.36,
      )
    label(
      "GANYMED",
      (count // 2 + 0.5) * width / count,
      base + 3.86,
      0.19,
      (241, 220, 174),
      0.41,
    )
  elif key == "hypothekenbank":
    # This owner has an immutable transparent v168 shell: no opaque backing,
    # no replacement panes and no retirement. Only the documented stone order.
    stone = (224, 216, 196)
    shade = (182, 174, 153)
    for u in [0.28, width - 0.28, width * 0.28, width * 0.72]:
      rect(u, base + 11.3, 0.48, 10.4, stone, "giant pilaster", 0.34)
      rect(u, base + 16.5, 0.85, 0.40, stone, "sculptural capital", 0.43)
      rect(u, base + 6.15, 0.76, 0.35, stone, "column base", 0.43)
      for du in [-0.14, 0.14]:
        rect(u + du, base + 11.3, 0.035, 9.5, shade, "column flute", 0.37)
    for y, h in [(base + 5.8, 0.32), (base + 16.95, 0.42), (top - 0.22, 0.32)]:
      rect(width / 2, y, width, h, stone, "projecting entablature", 0.46)
    for u in np.arange(0.35, width, 0.45):
      rect(u, base + 16.6, 0.14, 0.22, stone, "cornice dentil", 0.48)
    for u, w in [(width * 0.14, 1.3), (width * 0.5, 3.5), (width * 0.86, 1.3)]:
      for y in [base + 3.4, base + 8.1, base + 13.0, base + 18.5]:
        for side in [-1, 1]:
          rect(
            u + side * w / 2, y, 0.10, 2.9, stone, "three-axis window surround", 0.32
          )
        rect(u, y - 1.52, w + 0.2, 0.16, stone, "three-axis sill", 0.40)
      arc(
        u,
        base + 4.8,
        w / 2 + 0.1,
        0.48,
        0.13,
        stone,
        "rusticated base opening arch",
        0.43,
      )
    for u in [width * 0.5 - 0.6, width * 0.5 + 0.6]:
      for y in [base + 3.4, base + 8.1, base + 13, base + 18.5]:
        rect(u, y, 0.09, 2.8, stone, "central triple-opening divider", 0.35)
    arc(
      width * 0.5,
      base + 14.45,
      1.85,
      0.48,
      0.14,
      stone,
      "central segmental upper hood",
      0.46,
    )
    for y in [base + 5.0, base + 10.1, base + 15.3]:
      rect(width * 0.5, y, 0.7, 0.43, stone, "estimated central cartouche", 0.50)
    for u in [0.28, width * 0.28, width * 0.72, width - 0.28]:
      for y in np.arange(base + 0.5, base + 5.4, 0.55):
        rect(u, y, 0.55, 0.035, shade, "rustication joint in pier", 0.37)
  elif key == "splendid":
    emit(clip, (202, 190, 167), "warm limestone and plaster field")
    emit(
      box(-1, base - 1, width + 1, base + 4.5),
      (184, 178, 163),
      "rusticated ground storey",
      0.24,
    )
    for y in np.arange(base + 0.4, base + 4.5, 0.62):
      rect(width / 2, y, width, 0.035, (151, 146, 134), "rustication joint", 0.27)
    # A central risalit with sculpture and curved hoods, not a repeated office grid.
    count = 9
    step = width / count
    floors = [base + 2.25, base + 6.45, base + 10.5, base + 14.4, base + 18.0]
    rect(
      width / 2,
      base + 11.85,
      step * 2.95,
      14.1,
      (214, 201, 174),
      "central projecting risalit",
      0.34,
    )
    for f, y in enumerate(floors):
      for i in range(count):
        u = (i + 0.5) * step
        central = 3 <= i <= 5
        if f == 0 and central:
          continue
        w = step * (0.67 if central else 0.57)
        h = 3.0 if f < 3 else 2.6
        window(u, y, w, h, depth=0.40 if central else 0.30)
        if f == 0 or f >= 2:
          arc(
            u,
            y + h / 2,
            w / 2 + 0.15,
            0.33,
            0.12,
            (224, 213, 190),
            "curved neobaroque window hood",
            0.48 if central else 0.39,
          )
        if f in (2, 4):
          rect(
            u,
            y - h / 2 - 0.12,
            w + 0.5,
            0.15,
            (190, 181, 158),
            "shallow balcony slab",
            0.52,
          )
          rect(
            u,
            y - h / 2 + 0.75,
            w + 0.4,
            0.065,
            (62, 65, 58),
            "open iron balcony top rail",
            0.57,
          )
          for du in np.linspace(-w * 0.48, w * 0.48, 5):
            rect(
              u + du,
              y - h / 2 + 0.36,
              0.045,
              0.77,
              (62, 65, 58),
              "open iron balcony spindle",
              0.57,
            )
    window(width / 2, base + 2.2, step * 2.3, 3.6, depth=0.45)
    arc(
      width / 2,
      base + 3.9,
      step * 1.3,
      0.8,
      0.20,
      (225, 211, 181),
      "broad sculptural entrance arch",
      0.60,
    )
    for side in [-1, 1]:
      u = width / 2 + side * step * 1.5
      rect(u, base + 10.0, 0.55, 10.5, (219, 204, 174), "risalit giant pilaster", 0.55)
      for y in [base + 4.6, base + 12.9, base + 16.8]:
        rect(u, y, 0.58, 0.65, (220, 208, 181), "abstract sculptural capital", 0.62)
        emit(
          Polygon(
            [
              (u - 0.2, y - 0.45),
              (u + 0.2, y - 0.45),
              (u + 0.34, y - 1.2),
              (u - 0.34, y - 1.2),
            ]
          ),
          (199, 181, 150),
          "estimated herm relief",
          0.61,
        )
    for y in [base + 4.5, base + 8.45, base + 16.4, top - 0.20]:
      rect(width / 2, y, width, 0.18, (226, 214, 188), "continuous stone cornice", 0.41)
    arc(
      width / 2,
      base + 17.0,
      step * 1.38,
      1.10,
      0.18,
      (228, 214, 185),
      "central curved pediment",
      0.60,
    )
  return d


def receipts(front):
  result, inputs = [], {}
  shaded = core.isometric_shading(front)
  for tile in ["1_-1", "2_0"]:
    p = read(PUB / (tile + ".drawn.json.gz"))
    origin = p["origin"]
    bounds = [origin[0], origin[2], origin[0] + 512, origin[2] + 512]
    pending = Counter(
      s
      for m in pack_detail(shaded, bounds, origin_y=origin[1])
      for s in mesh_signatures(m)
    )
    for c in read(PUB / "manifest.json")["chunks"]:
      if c["id"] != tile and not c["id"].startswith(tile + "-alt-mitte-v169-"):
        continue
      path = PUB / c["drawn"]["url"]
      packet = read(path)
      for m in packet["meshes"]:
        if m["kind"] != "alt-mitte-v169":
          continue
        chosen = []
        for i, sig in enumerate(mesh_signatures(m)):
          if pending[sig]:
            chosen.append(i)
            pending[sig] -= 1
        if chosen:
          result.append(
            dict(
              tile=c["id"],
              kind=m["kind"],
              mode="drawn",
              fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
              triangles=chosen,
            )
          )
          inputs[str(path.relative_to(ROOT))] = sha(path)
    assert not sum(pending.values()), (tile, sum(pending.values()))
  return result, inputs


def build():
  _, occupied, inputs = retained()
  buildings = []
  for tile in ["390_5820", "390_5819"]:
    path = core.SOURCE / f"source-{tile}-00.json.gz"
    buildings.extend(b for b in read(path)["buildings"] if b["id"] in OWNERS)
  assert {b["id"] for b in buildings} == OWNERS
  write(
    SOURCE,
    dict(schemaVersion=1, buildings=buildings, references=REFERENCES, policy=POLICY),
  )
  drawn, native, old = Detail(), Detail(), Detail()
  audit = []
  for b in buildings:
    targets = []
    removed = 0
    for p in b["parts"]:
      low = min(
        (
          q[1]
          for s in p["surfaces"]
          if s["kind"] == "GroundSurface"
          for r in s["rings"]
          for q in r
        ),
        default=p["groundY"],
      )
      for si, s in enumerate(p["surfaces"]):
        key = target_key(b["id"], p["id"], si)
        if not key:
          continue
        assert s["kind"] == "WallSurface"
        targets.append((s, key))
        drawn.triangles.extend(fittings(s, key).triangles)
        if b["category"] != "retained":
          f = core.facade(s["rings"], low, p["topY"], occupied)
          old.triangles.extend(f.triangles)
          removed += len(f.triangles)
    shell, front, _, _ = core.model(b, occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    existing = merge_native_faces(native_detail(full))
    for key in dict.fromkeys(key for _, key in targets):
      for face in native_faces(existing, [s for s, k in targets if k == key]):
        native.triangles.extend(fittings(face, key, True).triangles)
    audit.append(
      dict(
        owner=b["id"],
        category=b["category"],
        sourceSheets=sum(len(p["surfaces"]) for p in b["parts"]),
        selectedSheets=len(targets),
        oldFacadeTriangles=removed,
        sourceTriangles=len(shell.triangles),
        nativeSourceTriangles=len(existing.triangles),
      )
    )
  records, packet_inputs = receipts(old)
  inputs.update(packet_inputs)
  write(PREVIOUS, dict(schemaVersion=1, records=records))
  runtime = {}
  counts = {}
  for mode, d in [("drawn", drawn), ("minecraft", native)]:
    seen = set()
    unique = []
    for t, c, role in d.triangles:
      # Clipping a decorative line against a stepped native cell can
      # leave a sub-centimetre sliver. Keep only triangles with area in
      # the actual centimetre packet; no source geometry is affected.
      q = np.rint(np.array(t) * 100).astype(np.int64)
      if not np.any(np.cross(q[1] - q[0], q[2] - q[0])):
        continue
      key = (tuple(sorted(tuple(round(v, 5) for v in p) for p in t)), c)
      if key not in seen:
        seen.add(key)
        unique.append((t, c, role))
    d.triangles = unique
    packet = empty_packet("mitte-ensemble-v281-" + mode, BOUNDS)
    packet["meshes"] = pack_detail(d, BOUNDS, origin_y=-10)
    for m in packet["meshes"]:
      m["kind"] = "mitte-ensemble-v281"
    runtime[mode] = packet
    counts[mode] = dict(
      triangles=sum(
        len(base64.b64decode(m["indices"])) // 12 for m in packet["meshes"]
      ),
      roles=dict(Counter(r for _, _, r in d.triangles)),
    )
  write(RUNTIME, runtime)
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=sha(SOURCE),
      runtimeSha256=sha(RUNTIME),
      previousSha256=sha(PREVIOUS),
      sourceInputs=inputs,
      owners=audit,
      counts=counts,
      retiredTriangles=sum(len(r["triangles"]) for r in records),
      runtimeBytes=RUNTIME.stat().st_size,
      runtimeGzipBytes=len(gzip.compress(RUNTIME.read_bytes(), mtime=0)),
    ),
  )
  print(
    dict(
      owners=audit,
      triangles={k: v["triangles"] for k, v in counts.items()},
      runtimeBytes=RUNTIME.stat().st_size,
      gzipBytes=len(gzip.compress(RUNTIME.read_bytes(), mtime=0)),
    )
  )


if __name__ == "__main__":
  build()
