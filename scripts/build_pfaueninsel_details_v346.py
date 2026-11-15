"""Photo-referenced missing clock turret and iron bridge work on the exact V194 castle.
No new castle footprint, island paths or peacocks: all earlier detail remains.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from build_karl_marx_allee_v161 import Detail
from build_rixdorf_v304 import merge_caps, native_model, read, rgb, sha, write
from build_surrounding_outlines import world
from pyproj import Transformer
from shapely.geometry import Polygon, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
# Inspected current SPSG reference photographs; image pixels are never bundled.
PHOTO_HASHES = {
  "pfauen-west.jpg": "f28cce0bdd3162e752a7dede59ddc1876a2853260cfb83001c202585a3ee1e54",
  "pfauen-east.jpg": "30b12ad83439cb23a36c5adeab514ec96785030a47d13c5c3cff2877ef3ea45f",
}


def fnv_bytes(b):
  h = 2166136261
  for c in b:
    h = ((h ^ c) * 16777619) & 0xFFFFFFFF
  return h


def main():
  source = read(GEO / "west-lakes-v194-source.geojson")
  feature = next(
    f for f in source["features"] if f["properties"].get("key") == "schloss-pfaueninsel"
  )
  g = world(
    transform(
      Transformer.from_crs(4326, 25833, always_xy=True).transform,
      shape(feature["geometry"]),
    )
  )
  g = max(g.geoms, key=lambda p: p.area) if g.geom_type == "MultiPolygon" else g
  coords = list(g.exterior.coords)
  towers = [
    Polygon(coords[2:33]).intersection(g),
    Polygon(coords[63:94]).intersection(g),
  ]
  centres = [np.array(p.centroid.coords[0]) for p in towers]
  clock = max(centres, key=lambda c: c[1])
  d = Detail()
  features = {}

  def poly(p, color, role):
    d.polygon(p, rgb(color), role)
    features[role] = features.get(role, 0) + 1

  def ring(c, r, y):
    return [
      [float(c[0] + math.cos(a) * r), y, float(c[1] + math.sin(a) * r)]
      for a in np.linspace(0, math.tau, 33)[:-1]
    ]

  def band(c, r0, r1, y0, y1, color, role):
    low, high = ring(c, r0, y0), ring(c, r1, y1)
    for i in range(32):
      poly([low[i], low[(i + 1) % 32], high[(i + 1) % 32], high[i]], color, role)

  def tube(a, b, r, color, role):
    a, b = np.array(a), np.array(b)
    axis = b - a
    axis /= np.linalg.norm(axis)
    u = np.cross(axis, [0, 1, 0])
    if np.linalg.norm(u) < 0.01:
      u = np.cross(axis, [1, 0, 0])
    u /= np.linalg.norm(u)
    v = np.cross(axis, u)
    aa = [
      (a + r * (u * math.cos(t) + v * math.sin(t))).tolist()
      for t in np.linspace(0, math.tau, 9)[:-1]
    ]
    bb = [
      (b + r * (u * math.cos(t) + v * math.sin(t))).tolist()
      for t in np.linspace(0, math.tau, 9)[:-1]
    ]
    for i in range(8):
      poly([aa[i], aa[(i + 1) % 8], bb[(i + 1) % 8], bb[i]], color, role)

  # Existing source towers anchor the missing smaller raised clock drum. Heights
  # and small moulding dimensions follow current SPSG photos, not LoD2 precision.
  band(clock, 1.57, 1.57, 15.95, 19.15, 0xEEEBDF, "clock drum")
  band(clock, 1.61, 1.61, 19.10, 19.25, 0xD5D3C5, "clock cornice")
  for k in range(8):
    a, b = k * math.pi / 16, (k + 1) * math.pi / 16
    band(
      clock,
      1.70 * math.cos(a),
      max(0.01, 1.70 * math.cos(b)),
      19.25 + 1.62 * math.sin(a),
      19.25 + 1.62 * math.sin(b),
      0x778A91,
      "source RoofSurface",
    )
    if k < 7:
      band(
        clock,
        1.71 * math.cos(b),
        1.71 * math.cos(b),
        19.25 + 1.62 * math.sin(b),
        19.28 + 1.62 * math.sin(b),
        0x5D7078,
        "zinc roof seam",
      )
  poly(ring(clock, 0.01, 20.87), 0x778A91, "source RoofSurface")
  tube(
    [clock[0], 20.85, clock[1]], [clock[0], 22.0, clock[1]], 0.035, 0xB6A373, "finial"
  )
  # Clock and glazed slit face the west garden and back elevation, never float.
  for angle in [math.radians(-29.45), math.radians(150.55)]:
    normal = np.array([math.cos(angle), math.sin(angle)])
    tangent = np.array([-normal[1], normal[0]])
    c = clock + normal * 1.59
    disk = [
      [
        float(c[0] + tangent[0] * 0.38 * math.cos(t)),
        18.50 + 0.38 * math.sin(t),
        float(c[1] + tangent[1] * 0.38 * math.cos(t)),
      ]
      for t in np.linspace(0, math.tau, 25)[:-1]
    ]
    poly(disk, 0x4B5E5D, "clock face")
    for hour in range(12):
      a = hour * math.pi / 6
      u = math.cos(a)
      y = math.sin(a)
      p = c + tangent * 0.29 * u
      q = c + tangent * 0.34 * u
      tube(
        [p[0], 18.50 + 0.29 * y, p[1]],
        [q[0], 18.50 + 0.34 * y, q[1]],
        0.014,
        0xDDD9BD,
        "clock tick",
      )
    p = c + normal * 0.025
    tube(
      [p[0], 18.50, p[1]],
      [p[0] + tangent[0] * 0.22, 18.58, p[1] + tangent[1] * 0.22],
      0.021,
      0xE8E1C9,
      "clock hand",
    )
    tube([p[0], 18.50, p[1]], [p[0], 18.78, p[1]], 0.018, 0xE8E1C9, "clock hand")
    p = clock + normal * 1.60
    poly(
      [
        [*(p - tangent * 0.29)[:1], 16.55, float((p - tangent * 0.29)[1])],
        [float((p + tangent * 0.29)[0]), 16.55, float((p + tangent * 0.29)[1])],
        [float((p + tangent * 0.29)[0]), 17.67, float((p + tangent * 0.29)[1])],
        [float((p - tangent * 0.29)[0]), 17.67, float((p - tangent * 0.29)[1])],
      ],
      0x526665,
      "clock drum glazing",
    )
  # Source-profile annular cornices and corbels. All old windows stay intact.
  for c in centres:
    for y in [6.25, 10.0]:
      band(c, 2.92, 2.97, y, y + 0.10, 0xEEEADD, "tower string course")
    band(c, 2.94, 3.13, 15.32, 15.44, 0xDFDCCF, "tower crown cornice")
    band(c, 3.13, 3.13, 15.44, 15.57, 0xEEEADD, "tower crown cornice")
    for a in np.arange(0, math.tau, math.pi / 6):
      outer = c + np.array([math.cos(a), math.sin(a)]) * 2.99
      tube(
        [outer[0], 15.02, outer[1]],
        [outer[0], 15.45, outer[1]],
        0.10,
        0xD8D6C8,
        "tower corbel",
      )
  # Curved open iron braces under the existing bridge deck; no wall or blocked arch.
  a, b = centres
  direction = (b - a) / np.linalg.norm(b - a)
  normal = np.array([-direction[1], direction[0]])
  length = np.linalg.norm(b - a)
  for side in [-1, 1]:
    pts = []
    for u in np.linspace(2.9, length - 2.9, 17):
      t = (u - 2.9) / (length - 5.8)
      p = a + direction * u + normal * 0.45 * side
      pts.append([p[0], 11.8 + 2.12 * math.sin(math.pi * t), p[1]])
    for aa, bb in zip(pts, pts[1:]):
      tube(aa, bb, 0.045, 0x8B8F80, "open bridge arch brace")
    for j in [2, 4, 6, 10, 12, 14]:
      p = pts[j]
      tube(p, [p[0], 13.97, p[2]], 0.028, 0x979A87, "open bridge vertical strut")
  n, caps = native_model(d)
  # The independent Native finial occupies a real cell above the curved dome;
  # cap navigation follows that final cell skin, including its higher top.
  native_tops = {}
  for tri, _, _ in n.triangles:
    pts = np.array(tri)
    normal = np.cross(pts[1] - pts[0], pts[2] - pts[0])
    if normal[1] <= 0 or max(pts[:, 1]) - min(pts[:, 1]) > 1e-6 or pts[0, 1] < 19:
      continue
    for x in range(round(min(pts[:, 0])), round(max(pts[:, 0]))):
      for z in range(round(min(pts[:, 2])), round(max(pts[:, 2]))):
        native_tops[x, z] = max(native_tops.get((x, z), 0), float(pts[0, 1]))
  caps = [[x, z, x + 1, z + 1, y] for (x, z), y in native_tops.items()]

  # Native clock/body samples are independent cardinal exterior cells. Drawn
  # smooth radial faces are never rotated into the Native scene.
  def packed(model):
    return [
      dict(
        color=sum(int(c) << (16 - i * 8) for i, c in enumerate(color)),
        role=role,
        triangle=tri,
      )
      for tri, color, role in model.triangles
    ]

  pins = {}
  for mode, file in [
    ("drawn", "westLakesV194.json"),
    ("native", "westLakesV194Native.json"),
  ]:
    s = next(s for s in read(DATA / file)["sites"] if s["key"] == "schloss-pfaueninsel")
    p = np.array(s["positions"], dtype="<f4")
    indices = np.array(s["indices"], dtype="<u2" if len(p) // 3 <= 65535 else "<u4")
    matrices = []
    colours = []
    for r in s["boxes"]:
      angle = 0 if mode == "native" else r[6]
      c, sn = math.cos(angle), math.sin(angle)
      matrices.extend(
        [
          c * r[3],
          0,
          0 if mode == "native" else -sn * r[3],
          0,
          0,
          r[4],
          0,
          0,
          sn * r[5],
          0,
          c * r[5],
          0,
          r[0],
          r[1],
          r[2],
          1,
        ]
      )
      for channel in rgb(r[6] if mode == "native" else r[7]):
        v = channel / 255
        colours.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    pins[mode] = dict(
      positions=len(p),
      indices=len(indices),
      positionHash=fnv_bytes(p.tobytes()),
      indexHash=fnv_bytes(indices.tobytes()),
      boxes=len(s["boxes"]),
      matrixHash=fnv_bytes(np.array(matrices, dtype="<f4").tobytes()),
      colourHash=fnv_bytes(np.array(colours, dtype="<f4").tobytes()),
      sourceSha256=sha(DATA / file),
    )
  output = dict(
    schemaVersion=1,
    hostPins=pins,
    centre=clock.tolist(),
    drumRing=[[p[0], p[2]] for p in ring(clock, 1.57, 0)],
    minY=15.95,
    maxY=20.87,
    drawn=packed(d),
    native=packed(n),
    roofTriangles=[t for t, _, role in d.triangles if role == "source RoofSurface"],
    nativeRoofCaps=merge_caps(caps),
    features=features,
    references=[
      dict(
        page="https://www.spsg.de/schloesser-gaerten/masterplan/sip2-projekte/schloss-pfaueninsel-gesamtsanierung",
        image=url,
        credit=credit,
        inspectedImageSha256=PHOTO_HASHES[filename],
        use="Geometry/color reference only; no pixels copied",
      )
      for filename, url, credit in [
        (
          "pfauen-west.jpg",
          "https://www.spsg.de/fileadmin/_processed_/b/d/csm_SPSG_SchlossPfaueninsel_DanielLindner_DSC_1245_d2a4961f9d.jpg",
          "SPSG / Daniel Lindner",
        ),
        (
          "pfauen-east.jpg",
          "https://www.spsg.de/fileadmin/_processed_/b/9/csm_SPSG_SchlossPfaueninsel_AndreasWendt_IMG_7943_da7762b5d8.jpg",
          "SPSG / Andreas Wendt",
        ),
      ]
    ],
    policy="Small turret height, dome rise, clock and iron brace dimensions are photo interpretation. Exact old source towers anchor them. All V194 bodies/fittings, all V326 buildings/gardens/paths and six peacocks remain unchanged; restoration mural image not reproduced.",
  )
  write(DATA / "pfaueninselDetailsV346.json", output)
  write(
    GEO / "pfaueninsel-details-v346-evidence.json",
    dict(
      schemaVersion=1,
      sourceSha256=sha(GEO / "west-lakes-v194-source.geojson"),
      runtimeSha256=sha(DATA / "pfaueninselDetailsV346.json"),
      hostPins=pins,
      features=features,
      drawnTriangles=len(d.triangles),
      nativeTriangles=len(n.triangles),
      references=output["references"],
      policy=output["policy"],
    ),
  )
  print("Pfauen drawn/native triangles", len(d.triangles), len(n.triangles))


if __name__ == "__main__":
  main()
