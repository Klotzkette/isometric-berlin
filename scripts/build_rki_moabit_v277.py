"""Complete retained Nordufer/Heizkraftwerk bodies and bounded exterior fittings.

No proposed RKI tower or unlocated new power-station chimney is introduced.
Surveyed sheets remain immutable evidence; facade subdivisions are estimates.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_tiergarten_werkhof_v275 import roof_at

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "rki-moabit-v277-source.json.gz"
OUTPUT = DATA / "rkiMoabitV277.json"
DECKS_SOURCE = GEO / "berlin-decks-v277-source.json.gz"
RKI = (
  "K00040nS",
  "K00040EV",
  "K0004to7",
  "K00040t9",
  "K00043hi",
  "K0003v0Q",
  "K00045Yh",
  "K0004taX",
  "K0004tlv",
)
POWER = (
  "K0002Lsy",
  "K0002R1P",
  "K0002QNg",
  "K0002MVh",
  "K0002USy",
  "K0002Usa",
  "K0002S9J",
  "K0003VEk",
  "K0002MUy",
)
OLD_IDS = (
  "27575821",
  "27218783",
  "27218732",
  "84225949",
  "27575819",
  "27575820",
  "04971191",
  "27576685",
  "27576684",
  "84225947",
  "43012631",
  "84225945",
  "01745260",
  "01745259",
  "64895469",
  "64895470",
  "64895471",
)
REFERENCES = (
  "https://www.rki.de/DE/Institut/Das-RKI/Standorte/standorte.html",
  "https://www.rki.de/DE/Institut/Das-RKI/Geschichte/Geschichte-des-RKI/Bildband_Salon/1971-1980.html",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030308",
  "https://industriekultur.berlin/ort/robert-koch-institut/",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050441,T",
  "https://industriekultur.berlin/ort/kraftwerk-moabit/",
  "https://www.bew.berlin/fernwaermesystem/erzeugungsanlagen/",
  "https://www.bew.berlin/aktuelles-und-presse/2026/bauma%C3%9Fnahme-putlitzbruecke/",
  "https://www.beos.net/objekte/berlin-decks",
)


def digest(value: Any) -> str:
  """Canonical evidence digest independent of file indentation."""
  return hashlib.sha256(
    json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
  ).hexdigest()


def pack(rows: Any, dtype: str = "<f4") -> str:
  """Retain explicit Float32 construction arrays without photographic textures."""
  return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()


def extract() -> dict[str, Any]:
  """Replay every leaf/surface of exactly eighteen retained official parents."""
  archive = GEO / "raw/lod2/LoD2_387_5822.zip"
  wanted = {"DEBE01YY" + p for p in RKI + POWER}
  parents = []
  with zipfile.ZipFile(archive) as zipped:
    for member in zipped.namelist():
      if not member.lower().endswith((".xml", ".gml")):
        continue
      with zipped.open(member) as stream:
        for _, e in ET.iterparse(stream, events=("end",)):
          if e.tag != f"{{{NS['bldg']}}}Building":
            continue
          pid = e.get(GML_ID)
          if pid in wanted:
            parts = [part_profile(p) for p in leaf_building_parts(e) or [e]]
            parents.append(
              dict(
                id=pid,
                function=e.findtext("bldg:function", namespaces=NS),
                site="rki" if pid[-8:] in RKI else "power",
                parts=parts,
                sha256=digest(parts),
              )
            )
          e.clear()
  parents.sort(key=lambda p: p["id"])
  assert {p["id"] for p in parents} == wanted
  decks = json.loads(gzip.decompress(DECKS_SOURCE.read_bytes()))
  for owner in sorted({p["sourceId"] for p in decks["parts"]}):
    fitted = []
    for p in decks["parts"]:
      if p["sourceId"] != owner:
        continue
      surfaces = []
      rings = [p["ring"], *p.get("holes", [])]
      cleaned = [r[:-1] if r[0] == r[-1] else r for r in rings]
      surfaces.append(
        {
          "kind": "RoofSurface",
          "rings": [[[x, p["top_y_m"], z] for x, z in r] for r in cleaned],
        }
      )
      for r in cleaned:
        for a, b in zip(r, r[1:] + r[:1], strict=True):
          if a == b:
            continue
          surfaces.append(
            {
              "kind": "WallSurface",
              "rings": [
                [
                  [a[0], p["ground_y_m"], a[1]],
                  [b[0], p["ground_y_m"], b[1]],
                  [b[0], p["top_y_m"], b[1]],
                  [a[0], p["top_y_m"], a[1]],
                ]
              ],
            }
          )
      fitted.append(
        {**p, "height_m": p["top_y_m"] - p["ground_y_m"], "surfaces": surfaces}
      )
    parents.append(
      {
        "id": "BERLIN-DECKS-" + owner,
        "site": "decks",
        "sourceKind": "current-osm-and-bdom-not-lod2",
        "parts": fitted,
        "sha256": digest(fitted),
      }
    )
  return dict(
    schemaVersion=1,
    parents=parents,
    archive=dict(
      path=str(archive.relative_to(ROOT)),
      sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
      url=f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      license="dl-de/zero-2-0",
    ),
    references=list(REFERENCES),
    decksSource={
      "path": str(DECKS_SOURCE.relative_to(ROOT)),
      "sha256": hashlib.sha256(DECKS_SOURCE.read_bytes()).hexdigest(),
      "datum": decks["datum"],
      "limits": decks["limits"],
      "references": decks["references"],
    },
    datum=dict(
      source="EPSG:25833, NHN minus 30 metres",
      displayedGround=5.2,
      rkiAnchorParent="DEBE01YYK00045Yh",
      rkiAnchorGround=6.101,
      powerAnchorParent="DEBE01YYK0002MVh",
      powerAnchorGround=4.63,
      policy="One translation per complete site preserves relative basement, connecting and roof heights. The historic entrance and principal hall meet the retained 5.2 m city ground; no independent leaf flattening.",
    ),
    limits="All original source heights retained, not independently re-surveyed. No future RKI tower, no unlocated 42m new chimney and no assertion that all Berlin Decks stages are complete. Facade materials, bay spacing and small dimensions are reference-based display estimates.",
  )


def palette(parent: str) -> tuple[int, int, str]:
  """Distinct source-identified historic, laboratory and industrial materials."""
  if parent.startswith("BERLIN-DECKS-"):
    return 0x477362, 0x707C6D, "decks"
  if parent[-8:] in RKI:
    if parent.endswith(("3v0Q", "40EV", "4taX", "4tlv")):
      return 0x9E6855, 0x70756D, "lab"
    return 0xA85F49, 0x695F59, "historic"
  if parent.endswith(("2Lsy", "2R1P", "2S9J", "3VEk")):
    return 0xB2B7B4, 0x77817C, "plant"
  if parent.endswith("2MUy"):
    return 0x9D9990, 0x69736D, "cooling"
  return 0x9C5946, 0x65716B, "hall"


def merge_rows(rows: list[list[float]]) -> list[list[float]]:
  """Lossless unions of exactly touching equal-section native boxes only."""
  for axis, size in [(0, 3), (2, 5)]:
    other = [i for i in range(8) if i not in (axis, size)]
    groups: dict[tuple, list] = {}
    for r in rows:
      groups.setdefault(tuple(r[i] for i in other), []).append(r)
    rows = []
    for group in groups.values():
      group.sort(key=lambda r: r[axis] - r[size] / 2)
      pending = None
      for r in group:
        if (
          pending is not None
          and pending[axis] + pending[size] / 2 == r[axis] - r[size] / 2
        ):
          low, high = pending[axis] - pending[size] / 2, r[axis] + r[size] / 2
          pending[axis], pending[size] = (low + high) / 2, high - low
        else:
          if pending is not None:
            rows.append(pending)
          pending = list(r)
      if pending is not None:
        rows.append(pending)
  return rows


def build(evidence: dict[str, Any] | None = None) -> dict[str, Any]:
  """Publish complete source shells and independent one-metre native roofs."""
  evidence = evidence or json.loads(gzip.decompress(SOURCE.read_bytes()))
  positions, tones, parts, walls, raw_boxes = [], [], [], [], []
  source_triangles = 0
  drawn_posts, native_posts = [], []
  originals = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  owners = [
    (
      p["id"],
      Polygon(
        [(x / 10, z / 10) for x, z in p["ring"]],
        [[(x / 10, z / 10) for x, z in ring] for ring in p.get("holes", [])],
      ),
    )
    for p in originals
    if p["id"] in OLD_IDS
  ]
  assert len(owners) == len(OLD_IDS)
  # Spatial index contains *all* actual replacement volumes, not just own parts.
  occupancy: dict[tuple[int, int], list[tuple[float, float]]] = {}
  for parent in evidence["parents"]:
    offset = (
      0
      if parent["site"] == "decks"
      else 5.2 - (6.101 if parent["site"] == "rki" else 4.63)
    )
    wall, roof, style = palette(parent["id"])
    open_canopy = parent.get("function") == "51009_1610"
    for p in parent["parts"]:
      poly = Polygon(p["ring"], p["holes"])
      roofs, face_list = [], []
      for s in p["surfaces"]:
        rings = [[[x, round(y + offset, 6), z] for x, y, z in r] for r in s["rings"]]
        triangles = triangles_for(rings)
        source_triangles += len(triangles)
        if not open_canopy or s["kind"] == "RoofSurface":
          positions.extend(triangles)
          tones.extend([roof if s["kind"] == "RoofSurface" else wall] * len(triangles))
        if s["kind"] == "RoofSurface":
          roofs.extend(triangles)
        else:
          face_list.append(rings)
      low = round(p["ground_y_m"] + offset, 6)
      high = round(p["top_y_m"] + offset, 6)
      cells = []
      x0, z0, x1, z1 = poly.bounds
      for x in range(math.floor(x0), math.ceil(x1)):
        for z in range(math.floor(z0), math.ceil(z1)):
          clipped = poly.intersection(box(x, z, x + 1, z + 1))
          if clipped.area <= 0 or (parent["site"] != "decks" and clipped.area < 0.035):
            continue
          point = clipped.representative_point()
          top = (
            p["top_y_m"]
            if parent["site"] == "decks"
            else roof_at(roofs, point.x, point.y)
          )
          if top is None:
            raise ValueError(f"Missing complete roof for {p['id']} at {point}")
          top = math.ceil((top - 1e-7) * 4) / 4
          cells.append([x, z, top])
          occupancy.setdefault((x, z), []).append(
            (top - 0.25 if open_canopy else low, top)
          )
          cap = max(low + 0.01, top - 0.25)
          if not open_canopy:
            raw_boxes.append(
              [x + 0.5, (low + cap) / 2, z + 0.5, 1, cap - low, 1, 0, wall]
            )
          raw_boxes.append(
            [x + 0.5, (cap + top) / 2, z + 0.5, 1, top - cap, 1, 0, roof]
          )
      posts, nposts = [], []
      if open_canopy:
        inside = poly.buffer(-0.16)
        if inside.is_empty:
          inside = poly
        candidates = list(poly.exterior.coords)[:-1]
        # Exact measured corner neighbourhoods, at most four slender estimated supports.
        if len(candidates) > 4:
          candidates = [candidates[int(i * len(candidates) / 4)] for i in range(4)]
        from shapely.ops import nearest_points

        for x, z in candidates:
          point = nearest_points(Point(x, z), inside)[1]
          x, z = point.x, point.y
          top = roof_at(roofs, x, z)
          if top is None or top - 0.25 <= low:
            continue
          cap = top - 0.22
          post = [x, (low + cap) / 2, z, 0.16, cap - low, 0.16, 0, 0x777D76]
          posts.append(post)
          drawn_posts.append(post)
          ncap = next(
            (
              t - 0.25
              for ix, iz, t in cells
              if ix == math.floor(x) and iz == math.floor(z)
            ),
            None,
          )
          if ncap is not None and ncap > low:
            npart = [x, (low + ncap) / 2, z, 0.16, ncap - low, 0.16, 0, 0x777D76]
            nposts.append(npart)
            native_posts.append(npart)
      owner, overlap = max(
        ((oid, poly.intersection(op).area) for oid, op in owners),
        key=lambda pair: pair[1],
      )
      if overlap < 0.01:
        owner = "27575820" if parent["site"] == "rki" else "27218732"
      if parent["site"] == "decks":
        owner = p["sourceId"]
      parts.append(
        dict(
          id=p["id"],
          sourceId=owner,
          parentId=parent["id"],
          site=parent["site"],
          flatTop=p["top_y_m"] if parent["site"] == "decks" else None,
          openCanopy=open_canopy,
          posts=posts,
          nativePosts=nposts,
          roofBottom=min((q[1] for t in roofs for q in t), default=high) - 0.22,
          ring=p["ring"],
          holes=p["holes"],
          minY=low,
          maxY=high,
          roofTriangles=roofs,
          nativeCells=cells,
          wallColor=wall,
          roofColor=roof,
        )
      )
      if not open_canopy:
        walls.extend((p["id"], parent["id"], style, rings) for rings in face_list)
  drawn, native, fitting_receipts = list(drawn_posts), list(native_posts), []
  roles: Counter[str] = Counter()
  deck_polys = [
    (p, Polygon(p["ring"], p["holes"])) for p in parts if p["site"] == "decks"
  ]

  def deck_clearance(a, direction, normal, u, y, w, h, depth=0):
    """Fit estimated facade accents beyond exact retained boundary slivers.

    Complete old edge bodies stay visible; no source footprint is trimmed.
    Full neighbouring buildings cannot be crossed by this bounded search.
    """
    for out in np.arange(0.08, 0.801, 0.04):
      samples = [
        Point(*(a + direction * v + normal * (out - depth / 2)))
        for v in (u - w / 2, u, u + w / 2)
      ]
      if not any(
        other["maxY"] > y - h / 2 + 0.0001
        and other["minY"] < y + h / 2 - 0.0001
        and any(poly.covers(point) for point in samples)
        for other, poly in deck_polys
      ):
        return float(out)
    return None

  # These old four-metre columns intentionally remain because a neighbour shares
  # them. They are real obstacles for new fittings, even outside the new roofs.
  retained_shared = json.loads((DATA / "rkiMoabitV277Ownership.json").read_bytes())[
    "retainedSharedColumns"
  ]
  for ix, iz, low, high, _ in retained_shared:
    for x in range(ix * 4, (ix + 1) * 4):
      for z in range(iz * 4, (iz + 1) * 4):
        occupancy.setdefault((x, z), []).append((low / 10, high / 10))

  def free(x: float, z: float, y: float, w: float, h: float, d: float) -> bool:
    for ix in range(math.floor(x - w / 2), math.ceil(x + w / 2)):
      for iz in range(math.floor(z - d / 2), math.ceil(z + d / 2)):
        if any(
          y + h / 2 > lo + 0.0002 and y - h / 2 < hi - 0.0002
          for lo, hi in occupancy.get((ix, iz), [])
        ):
          return False
    for px, py, pz, pw, ph, pd, _, _ in native_posts:
      if (
        abs(x - px) < (w + pw) / 2 - 0.0002
        and abs(z - pz) < (d + pd) / 2 - 0.0002
        and abs(y - py) < (h + ph) / 2 - 0.0002
      ):
        return False
    return True

  def fitting(
    a: np.ndarray,
    direction: np.ndarray,
    normal: np.ndarray,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    color: int,
    role: str,
    pid: str,
  ) -> None:
    outward = (
      deck_clearance(a, direction, normal, u, y, w, h, depth)
      if pid.startswith("BERLIN-DECKS-")
      else 0.08
    )
    if outward is None:
      return
    center = a + direction * u + normal * outward
    drawn.append(
      [
        float(center[0]),
        y,
        float(center[1]),
        w,
        h,
        depth,
        math.atan2(-direction[1], direction[0]),
        color,
      ]
    )
    roles[role] += 1
    count = max(1, math.ceil(w / 0.6))
    emitted = []
    for i in range(count):
      v = u - w / 2 + (i + 0.5) * w / count
      width = abs(direction[0]) * w / count + abs(normal[0]) * depth
      thick = abs(direction[1]) * w / count + abs(normal[1]) * depth
      for out in np.arange(0.12, 1.761, 0.04):
        xx, zz = a + direction * v + normal * out
        if free(xx, zz, y, width, h, thick):
          emitted.append(len(native))
          native.append([float(xx), y, float(zz), width, h, thick, 0, color])
          break
    fitting_receipts.append(dict(parent=pid, role=role, nativeIndices=emitted))

  site_union = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  part_by_id = {p["id"]: p for p in parts}
  for part_id, parent, style, rings in walls:
    if style == "cooling":
      continue
    points = rings[0]
    # Longest horizontal source edge determines the measured facade axis.
    edges = [
      (math.hypot(b[0] - a[0], b[2] - a[2]), a, b)
      for a, b in zip(points, points[1:] + points[:1], strict=True)
      if abs(a[1] - b[1]) < 0.01
    ]
    if not edges:
      continue
    length, aa, bb = max(edges, key=lambda t: t[0])
    if length < 5:
      continue
    a, b = np.array([aa[0], aa[2]]), np.array([bb[0], bb[2]])
    direction = (b - a) / length
    normal = np.array([direction[1], -direction[0]])
    own = part_by_id[part_id]
    union = Polygon(own["ring"], own["holes"]) if style == "decks" else site_union
    normal_probe = 0.0000001 if style == "decks" else 0.12
    if union.contains(Point(*((a + b) / 2 + normal * normal_probe))):
      normal = -normal
    if union.contains(Point(*((a + b) / 2 + normal * normal_probe))):
      continue

    def visible(u: float, y: float, half_width: float) -> bool:
      if style != "decks":
        return True
      return (
        deck_clearance(a, direction, normal, u, y, half_width * 2, 0.01) is not None
      )

    face = Polygon(
      [[float((np.array([x, z]) - a) @ direction), y] for x, y, z in points]
    ).buffer(0)
    ymin, ymax = min(q[1] for q in points), max(q[1] for q in points)
    if ymax - ymin < 3:
      continue
    levels = (
      [8.5, 12.7, 16.9]
      if style == "historic"
      else (
        [7.5 + i * 3.65 for i in range(7)]
        if style == "lab"
        else [9.2 + i * 7 for i in range(10)]
      )
    )
    step, width, height = (
      (3.7, 1.25, 2.25)
      if style == "historic"
      else (
        (2.7, 2.15, 1.65)
        if style == "lab"
        else ((5.2, 2.5, 5.5) if style == "hall" else (6, 0.95, 3.5))
      )
    )
    if style == "decks":
      levels = [7.7 + i * 4.1 for i in range(7)]
      step, width, height = 2.55, 1.95, 2.85
    count = max(1, math.floor((length - 1.6) / step))
    for y in levels:
      if y - height / 2 < ymin + 0.7 or y + height / 2 > ymax - 0.8:
        continue
      for j in range(count):
        u = (j + 0.5) * length / count
        if not visible(u, y, width / 2):
          continue
        if not face.covers(
          box(
            u - width / 2 - 0.14,
            y - height / 2 - 0.14,
            u + width / 2 + 0.14,
            y + height / 2 + 0.14,
          )
        ):
          continue
        role = style + "-window"
        fitting(
          a, direction, normal, u, y, width, height, 0.045, 0x4D6566, role, parent
        )
        trim = (
          0xC7B9A0
          if style == "historic"
          else (0x9EAAAB if style == "lab" else 0xB49578)
        )
        if style == "decks":
          trim = 0x719386
        for v in [-width / 2, 0, width / 2]:
          fitting(
            a,
            direction,
            normal,
            u + v,
            y,
            0.075,
            height + 0.1,
            0.08,
            trim,
            style + "-mullion",
            parent,
          )
        for yy in [y - height / 2, y + height / 2]:
          fitting(
            a,
            direction,
            normal,
            u,
            yy,
            width + 0.16,
            0.09,
            0.085,
            trim,
            style + "-sill",
            parent,
          )
        if style in {"historic", "hall"}:
          # Arch reading lies entirely in the verified wall; rise remains an estimate.
          for q in range(9):
            angle = math.pi * (q + 0.5) / 9
            uu = u + math.cos(angle) * width * 0.54
            yy = y + height / 2 + math.sin(angle) * 0.34
            if face.covers(Point(uu, yy).buffer(0.1)):
              fitting(
                a,
                direction,
                normal,
                uu,
                yy,
                0.18,
                0.14,
                0.09,
                trim,
                style + "-arch",
                parent,
              )
    # Restrained pale sandstone bands distinguish the RKI heritage fronts.
    if style == "historic":
      for y in [10.1, 14.3, 18.5]:
        if face.covers(box(0.25, y - 0.09, length - 0.25, y + 0.09)):
          fitting(
            a,
            direction,
            normal,
            length / 2,
            y,
            length - 0.5,
            0.16,
            0.11,
            0xB6AA92,
            "historic-band",
            parent,
          )
    if style == "lab":
      for y in [10.0, 13.65, 17.3, 20.95, 24.6]:
        if face.covers(box(0.25, y - 0.09, length - 0.25, y + 0.09)):
          fitting(
            a,
            direction,
            normal,
            length / 2,
            y,
            length - 0.5,
            0.14,
            0.12,
            0xC5B7A2,
            "lab-floor-band",
            parent,
          )
    if style == "decks":
      for y in [9.45 + i * 4.1 for i in range(7)] + [ymax - 0.24]:
        if face.covers(box(0.18, y - 0.12, length - 0.18, y + 0.12)) and visible(
          length / 2, y, (length - 0.36) / 2
        ):
          fitting(
            a,
            direction,
            normal,
            length / 2,
            y,
            length - 0.36,
            0.24,
            0.13,
            0x527C69,
            "decks-ceramic-band",
            parent,
          )
  compact = merge_rows(raw_boxes)
  return dict(
    schemaVersion=1,
    sourceSha256=digest(evidence),
    parts=parts,
    drawnPositions=pack(positions),
    drawnColors=pack(tones, "<u4"),
    nativeBodies=pack(compact),
    drawnDetails=pack(drawn),
    nativeDetails=pack(native),
    fittingReceipts=fitting_receipts,
    retainedSharedFittingObstacles=retained_shared,
    counts=dict(
      parents=len(evidence["parents"]),
      parts=len(parts),
      sourceTriangles=source_triangles,
      drawnTriangles=len(positions),
      openCanopies=sum(p["openCanopy"] for p in parts),
      nativeCells=sum(len(p["nativeCells"]) for p in parts),
      nativeBodyBoxes=len(compact),
      drawnDetails=len(drawn),
      nativeDetails=len(native),
      drawnBytes=len(positions) * 9 * 12 + len(drawn) * 76,
      nativeBytes=(len(compact) + len(native)) * 76,
      roles=dict(roles),
    ),
    bounds=list(site_union.bounds),
  )


def write() -> None:
  """Reproducible dedicated evidence/model outputs; no previous source modified."""
  evidence = extract()
  SOURCE.write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )
  data = build(evidence)
  OUTPUT.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n")
  print(json.dumps(data["counts"]))


if __name__ == "__main__":
  write()
