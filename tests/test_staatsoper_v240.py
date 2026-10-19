"""Finite Staatsoper ownership, complete measured shell and native fidelity."""

import base64
import importlib.util
import sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "opera240", ROOT / "scripts/build_staatsoper_v240.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_original_sources_packets_and_navigation_are_immutable():
  evidence = m.read(m.EVIDENCE)
  for path, digest in evidence["inputs"].items():
    assert m.sha(ROOT / path) == digest
  assert set(evidence["parents"]) == m.PARENTS
  assert len(evidence["sourceParts"]) == 12
  assert evidence["previous"][m.MAIN]["shellTriangles"] == 386
  assert evidence["previous"]["DEBE00YY1P700099"]["shellTriangles"] == 22
  for packet in m.read(m.RUNTIME).values():
    assert not packet["nav"]["buildings"]
    assert not packet["nav"]["ground"]


def test_v182_only_generic_windows_yield_and_every_measured_edge_remains():
  from build_bebelplatz_building_source import NS, extract_parent

  before, previous = m.read(m.OUT / "cityRecognitionV182.json"), m.read(m.PREVIOUS)
  segment_rows = {r["index"]: r["row"] for r in previous["segments"]}
  assert len(previous["boxes"]) == 220 and len(segment_rows) == 440
  for r in previous["boxes"]:
    assert 2228 <= r["index"] < 2448 and before["boxes"][r["index"]] == r["row"]
  measured_count = 0
  for feature in before["features"]:
    if feature["parentId"] not in m.PARENTS:
      continue
    parent = extract_parent(m.GEO / "raw/lod2/LoD2_391_5819.zip", feature["parentId"])
    surfaces = []
    # part_profile gives raw absolute NHN and original projected XYZ, then use
    # the v182 feature's own datum (26mm different from the retained v169 one).
    for surface in parent.iter():
      if surface.tag.split("}")[-1] not in {"WallSurface", "RoofSurface"}:
        continue
      for polygon in surface.findall(".//gml:Polygon", NS):
        for pos in polygon.findall(".//gml:posList", NS):
          raw = list(map(float, (pos.text or "").split()))
          ring = [
            tuple(
              round(v, 3)
              for v in [
                raw[i] - 389500,
                raw[i + 2] - feature["groundNHN"] + 5.2,
                5820000 - raw[i + 1],
              ]
            )
            for i in range(0, len(raw), 3)
          ]
          surfaces.extend(tuple(sorted((a, b))) for a, b in zip(ring, ring[1:]))
    source_edges = set(surfaces)
    for i in range(
      feature["firstSegment"], feature["firstSegment"] + feature["segmentCount"]
    ):
      row = before["segments"][i]
      measured = tuple(sorted((tuple(row[:3]), tuple(row[3:6])))) in source_edges
      assert measured == (i not in segment_rows), (feature["parentId"], i)
      if i in segment_rows:
        assert segment_rows[i] == row and row[6] == 0xBDC5BF
      measured_count += measured
  assert measured_count == 282


def test_native_is_orthogonal_compact_and_retains_full_recognition():
  payload = m.read(m.RUNTIME)
  for mode, packet in payload.items():
    assert len(packet["meshes"]) == 1
    mesh = packet["meshes"][0]
    points = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype(float)
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert len(points) < 65536
    assert points.min() >= 0 and points.max() < 65536
    assert indices.max() < len(points)
    if mode == "minecraft":
      t = points[indices]
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(normals, axis=1) <= 1)
  evidence = m.read(m.EVIDENCE)
  assert sum(f["windowCount"] for f in evidence["facades"]) == 218
  for mode in payload:
    roles = evidence["counts"][mode]["roles"]
    assert roles["north-portico/six-column-order"] > 0
    assert roles["north-portico/architrave-inscription"] > 0
    assert any(
      key.endswith("north-pediment") and value > 0 for key, value in roles.items()
    )
    assert any("risalit-roof-sculpture" in key for key in roles)


def test_native_retirement_is_exact_full_minus_shell_with_reverse_restoration():
  from build_karl_marx_allee_v161 import Detail, native_detail
  from build_scheunenviertel_v168 import merge_native_faces

  buildings, occupied = m.retained()
  old, restoration, counts = m.old_models(buildings, occupied)
  full, shell = Detail(), Detail()
  for b in buildings:
    s, f, _, _ = m.core.model(b, occupied)
    both = Detail()
    both.triangles = s.triangles + f.triangles
    full.triangles.extend(merge_native_faces(native_detail(both)).triangles)
    shell.triangles.extend(merge_native_faces(native_detail(s)).triangles)

  def bag(detail):
    return Counter(
      (tuple(sorted(tuple(round(float(v), 7) for v in p) for p in tri)), tuple(color))
      for tri, color, _ in detail.triangles
    )

  assert bag(full) - bag(old["minecraft"]) + bag(restoration) == bag(shell)
  assert len(restoration.triangles) == 219
  assert len(old["minecraft"].triangles) == 2789
  assert counts == m.read(m.EVIDENCE)["previous"]


def test_encoded_receipts_touch_only_expected_facade_layers():
  previous, evidence = m.read(m.PREVIOUS), m.read(m.EVIDENCE)
  assert [
    (r["tile"], r["layer"], len(r["triangles"])) for r in previous["records"]
  ] == [
    ("alt-mitte-v169-3_0-piece-0", "minecraft", 2789),
    ("3_0", "front", 3816),
  ]
  assert not any(
    r["mode"] == "drawn" and r["tile"].startswith("alt-mitte-")
    for r in previous["records"]
  )
  for record in previous["records"]:
    candidates = [
      m.read(ROOT / path)
      for path in evidence["inputs"]
      if path.endswith(("packet-080.json", "3_0.drawn.json.gz"))
    ]
    meshes = [
      mesh
      for p in candidates
      for mesh in p["meshes"]
      if m.fingerprint([mesh["positions"], mesh["colors"], mesh["indices"]])
      == record["fingerprint"]
    ]
    assert len(meshes) == 1
    sigs = m.mesh_signatures(meshes[0])
    selected = set(record["triangles"])
    assert len(selected) == len(record["triangles"]) and max(selected) < len(sigs)
    unowned = [s for i, s in enumerate(sigs) if i not in selected]
    audit = next(a for a in evidence["exactTransfer"] if a["tile"] == record["tile"])
    assert (
      m.hashlib.sha256(repr(unowned).encode()).hexdigest() == audit["unchangedSha256"]
    )
