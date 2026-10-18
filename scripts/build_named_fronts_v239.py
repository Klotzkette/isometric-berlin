"""Step 10: source-bound frame profiles for three explicitly named Mitte sites.

Existing pane triangles/boxes are the anchors. This packet adds no windows,
body, roof, navigation, source replacement or runtime reconstruction.
"""

from __future__ import annotations

import base64
from collections import Counter

import numpy as np
from build_alt_mitte_v169 import model
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_nikolaiviertel_v239 import GEO, OUT, ROOT, line_member, read, sha, write
from build_west_streets_v163 import core_detail, partition_detail
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union

SOURCE = GEO / "named-fronts-v239-source.json.gz"
EVIDENCE = GEO / "named-fronts-v239-evidence.json"
ADDITION = GEO / "named-fronts-v239-manifest-addition.json"
STREETS = GEO / "mitte-streets-v166.json"
OSM = GEO / "alt-mitte-v169/source-390_5820-osm-00.json.gz"
CENTRAL = ROOT / "src/app/src/data/centralSitesV200.json"
CENTRAL_EVIDENCE = ROOT / "src/app/src/data/centralSitesV200Evidence.json"
GOOGLE = {
  "DEBE01YYK0000CJs",
  "DEBE01YYK00005AW",
  "DEBE00YY1HJ000Bw",
  "DEBE01YYK0000DK5",
  "DEBE01YYK0000Ddl",
  "DEBE01YYK000088B",
}
LEO = "DEBE01YYK00001R6"
DELIVERY = {"DEBE01YYK00004EC", "DEBE01YYK0000C4T"}
CORE = {"04991246", "39201189", "39201190", "52086750", "05733795"}
REFS = [
  "https://blog.google/intl/de-de/unternehmen/inside-google/sundar-pichai-eroeffnet-berliner-google-buero/",
  "https://www.forum-museumsinsel.de/gropius-ensemble/",
  "https://www.zentralratderjuden.de/der-zentralrat/ueber-uns/leo-baeck-haus/",
  "https://www.forum-museumsinsel.de/fernsprechamt/",
  "https://www.deliveryhero.com/newsroom-contact/",
]
POLICY = (
  "Finite named sites only: Google Gropius ensemble, Leo-Baeck-Haus and Delivery Hero "
  "Fernsprechamt. Preserve every prior body, roof, window, source record and navigation. "
  "Frames use existing exact pane triangle/box positions; no fresh window grid. "
  "Google/Leo retained shared-binding prisms remain authoritative for current display; "
  "official LoD2 families are reference evidence, never silently overlaid as new shells. "
  "Thin profile sections and restrained colours are display estimates, not a surveyed "
  "window or material inventory. Native uses independent orthogonal short members, "
  "complete on desktop and mobile. No residency increase or texture."
)


def triangle_key(points):
  return tuple(sorted(tuple(round(float(c) * 100) for c in p) for p in points))


def original_triangles():
  """Require old reconstructed pane candidates to exist in published geometry."""
  found = {}
  for ident in ["2_-2", "2_-1", "3_-1"]:
    packet = read(OUT / f"{ident}.drawn.json.gz")
    origin = np.array(packet["origin"]) * 100
    for mesh in packet["meshes"]:
      if mesh["kind"] not in {"mitte-street-fronts-v166", "alt-mitte-v169"}:
        continue
      vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
        -1, 3
      )
      vertices = np.rint(vertices + origin).astype(int)
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      keys = found.setdefault(mesh["kind"], set())
      keys.update(tuple(sorted(tuple(p) for p in vertices[t])) for t in indices)
  return found


def pane_records(detail, prism, site, kind, membership):
  """Pair the triangles emitted by each retained rectangular aperture."""
  panes = []
  polygon = Polygon([(x / 10, z / 10) for x, z in prism["ring"]])
  candidates = [
    t for t in detail.triangles if t[2] in {"window glazing", "shopfront glazing"}
  ]
  for first, second in zip(candidates[::2], candidates[1::2], strict=True):
    tris = [first[0], second[0]]
    if not all(triangle_key(t) in membership[kind] for t in tris):
      continue
    points = np.array(sorted({tuple(p) for t in tris for p in t}))
    if len(points) != 4:
      continue
    center = points.mean(axis=0)
    nearest = nearest_points(polygon.boundary, Point(center[[0, 2]]))[0]
    normal = center[[0, 2]] - np.array(nearest.coords[0])
    normal /= np.linalg.norm(normal)
    tangent = np.array([normal[1], -normal[0]])
    projected = points[:, [0, 2]] @ tangent
    panes.append(
      dict(
        site=site,
        owner=prism["id"],
        kind=kind,
        center=center.tolist(),
        normal=normal.tolist(),
        width=float(np.ptp(projected)),
        height=float(np.ptp(points[:, 1])),
        sourceTriangles=tris,
      )
    )
  return panes


def extract():
  streets = read(STREETS)
  roads = unary_union([shape(r["geometry"]) for r in streets["roads"]])
  membership = original_triangles()
  panes, prisms = [], []
  for prism in streets["corePrisms"]:
    if prism["id"] not in CORE:
      continue
    prisms.append(prism)
    site = "leo-baeck" if prism["id"] == "05733795" else "google-gropius"
    panes.extend(
      pane_records(
        core_detail(prism, roads), prism, site, "mitte-street-fronts-v166", membership
      )
    )
  osm = next(b for b in read(OSM)["buildings"] if b["id"] == "OSM-way-339201189")
  prism = osm["legacyPrisms"][0]
  prisms.append(prism)
  # Empty occupancy generates candidates only; actual published-triangle
  # membership below independently excludes all omitted/occluded panes.
  fronts = model(osm, Polygon())[1]
  panes.extend(
    pane_records(fronts, prism, "google-gropius", "alt-mitte-v169", membership)
  )
  central, ce = read(CENTRAL), read(CENTRAL_EVIDENCE)
  selected_faces = [f for f in ce["selectedFaces"] if f["parentId"] in DELIVERY]
  for face in selected_faces:
    for field in face["windowFields"]:
      for index in field["boxes"]:
        b = central["boxes"][index]
        assert central["owners"][b[-1]]["id"] == face["parentId"]
        panes.append(
          dict(
            site="delivery-hero",
            owner=face["parentId"],
            kind="central-sites-v200",
            style=face["style"],
            center=b[:3],
            width=b[3],
            height=b[4],
            normal=b[9:11],
            sourceBoxIndex=index,
            sourceBox=b,
            sourcePolygonId=face["sourcePolygonId"],
          )
        )
  records, inputs = [], [STREETS, OSM, CENTRAL, CENTRAL_EVIDENCE]
  for tile in ["390_5820", "391_5820"]:
    p = GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    inputs.append(p)
    records.extend(
      b for b in read(p)["buildings"] if b["id"] in GOOGLE | DELIVERY | {LEO}
    )
  preserved = (
    inputs
    + [
      OUT / f"{i}.{mode}.json.gz"
      for i in ["2_-2", "2_-1", "3_-1"]
      for mode in ["drawn", "minecraft"]
    ]
    + [
      ROOT / "src/app/public/mesh/regierungsviertel" / f
      for f in ["lod2-prisms.json", "minecraft-voxels.json"]
    ]
  )
  source = dict(
    schemaVersion=1,
    retrieved="2026-10-19",
    policy=POLICY,
    references=REFS,
    licenses=["Berlin LoD2 dl-de/zero-2-0", "OpenStreetMap contributors ODbL-1.0"],
    officialReferenceFamilies=records,
    retainedPrisms=prisms,
    osmGropius=osm,
    deliveryFaces=selected_faces,
    panes=panes,
    preservation={str(p.relative_to(ROOT)): sha(p) for p in preserved},
  )
  write(SOURCE, source)
  return source


def details(source, native):
  detail = Detail()
  counts = Counter()
  for pane in source["panes"]:
    width, height = pane["width"], pane["height"]
    if width < 0.8 or height < 1:
      continue  # Preserve clipped narrow fragments without heavy added borders.
    site = pane["site"]
    colour = {
      "google-gropius": (181, 165, 141),
      "leo-baeck": (205, 196, 176),
      "delivery-hero": (143, 103, 82)
      if pane.get("style") == "clinker"
      else (206, 209, 197),
    }[site]
    normal = np.array([pane["normal"][0], 0, pane["normal"][1]])
    tangent = np.array([normal[2], 0, -normal[0]])
    # Existing layers retain their own glazing and muntins. Only external
    # reveal edges are enhanced. Native sits beyond its retained source skin.
    center = np.array(pane["center"]) + normal * (1.32 if native else 0.27)
    frame = 0.085 if not native else 0.13
    role = site + (
      "-clinker-reveal" if pane.get("style") == "clinker" else "-stone-reveal"
    )
    for side in [-1, 1]:
      a = center + tangent * side * (width / 2 + 0.055)
      line_member(
        detail,
        (a + [0, -height / 2, 0]).tolist(),
        (a + [0, height / 2, 0]).tolist(),
        frame,
        colour,
        role,
        native,
      )
    a = center + [0, height / 2 + 0.065, 0]
    line_member(
      detail,
      (a - tangent * (width / 2 + 0.11)).tolist(),
      (a + tangent * (width / 2 + 0.11)).tolist(),
      frame,
      colour,
      role,
      native,
    )
    counts[site] += 1
  # Actual retained outlines only. The Gropius polygonal curved-plan sections
  # stay explicit rather than being replaced by a guessed circular auditorium.
  for prism in source["retainedPrisms"]:
    ring = [(x / 10, z / 10) for x, z in prism["ring"]]
    height = (prism["y0_dm"] + prism["h_dm"]) / 10
    for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
      line_member(
        detail,
        [a[0], height + 0.065, a[1]],
        [b[0], height + 0.065, b[1]],
        0.13,
        (147, 146, 132),
        "retained-source-eave",
        native,
      )
  return detail, dict(
    refinedPanes=dict(counts), roles=dict(Counter(r for _, _, r in detail.triangles))
  )


def build():
  source = read(SOURCE) if SOURCE.exists() else extract()
  for path, digest in source["preservation"].items():
    assert sha(ROOT / path) == digest, path
  models, audits = {}, {}
  for mode in ["drawn", "minecraft"]:
    d, audits[mode] = details(source, mode == "minecraft")
    models[mode] = partition_detail(d)
  descriptors, receipts = [], {}
  for ix, iz in sorted(set(models["drawn"]) | set(models["minecraft"])):
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    ident = f"namedfront239-{ix}_{iz}"
    desc = dict(id=ident, bounds=bounds)
    for mode in models:
      mesh = packed_detail(models[mode][ix, iz], box(*bounds))
      mesh["kind"] = "named-fronts-v239"
      payload = dict(
        schemaVersion=1,
        id=ident,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(groundY=3, ground=[], water=[], buildings=[]),
      )
      path = OUT / f"{ident}.{mode}.json.gz"
      write(path, payload)
      import gzip

      decoded = len(gzip.decompress(path.read_bytes()))
      desc[mode] = dict(
        url=path.name,
        encoding="gzip",
        bytes=path.stat().st_size,
        decodedBytes=decoded,
        sha256=sha(path),
      )
      nv = len(base64.b64decode(mesh["positions"])) // 6
      ni = len(base64.b64decode(mesh["indices"])) // 4
      receipts[mode + ":" + ident] = dict(
        vertices=nv, indices=ni, gpuBytes=nv * 12 + ni * (2 if nv < 65536 else 4)
      )
      assert decoded < 8 * 1024**2 and nv < 180000 and ni < 1200000
    descriptors.append(desc)
  write(
    ADDITION,
    dict(
      schemaVersion=1,
      chunks=descriptors,
      footprint=[],
      source=dict(sourceSha256=sha(SOURCE), additiveOnly=True),
    ),
  )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=sha(SOURCE),
      additionSha256=sha(ADDITION),
      audits=audits,
      packets=receipts,
      unchanged=source["preservation"],
    ),
  )
  return dict(
    panes=len(source["panes"]),
    refinedPanes=audits["drawn"]["refinedPanes"],
    packets=len(descriptors),
    gpuBytes={
      mode: sum(v["gpuBytes"] for k, v in receipts.items() if k.startswith(mode + ":"))
      for mode in models
    },
  )


if __name__ == "__main__":
  print(build())
