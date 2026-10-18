"""Finite source anchors, preservation and genuinely orthogonal native geometry."""

from __future__ import annotations

import base64
import gzip
import importlib.util
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "named239", ROOT / "scripts/build_named_fronts_v239.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_exact_original_pane_membership_and_source_box_anchors():
  source = m.read(m.SOURCE)
  triangles = m.original_triangles()
  boxes = m.read(m.CENTRAL)["boxes"]
  assert len(source["panes"]) == 800
  assert {p["site"] for p in source["panes"]} == {
    "google-gropius",
    "leo-baeck",
    "delivery-hero",
  }
  for pane in source["panes"]:
    assert abs(np.linalg.norm(pane["normal"]) - 1) < 1e-8
    if pane["kind"] == "central-sites-v200":
      assert pane["sourceBox"] == boxes[pane["sourceBoxIndex"]]
      assert pane["center"] == pane["sourceBox"][:3]
      assert pane["width"] == pane["sourceBox"][3]
      assert pane["height"] == pane["sourceBox"][4]
      assert pane["normal"] == pane["sourceBox"][9:11]
      assert pane["owner"] in m.DELIVERY
    else:
      assert all(
        m.triangle_key(t) in triangles[pane["kind"]] for t in pane["sourceTriangles"]
      )
      points = np.array(sorted({tuple(p) for t in pane["sourceTriangles"] for p in t}))
      np.testing.assert_allclose(points.mean(axis=0), pane["center"])
      assert len(points) == 4


def test_finite_owner_sets_and_every_previous_payload_unchanged():
  source = m.read(m.SOURCE)
  assert {p["id"] for p in source["retainedPrisms"]} == m.CORE
  assert {
    b["id"] for b in source["officialReferenceFamilies"]
  } == m.GOOGLE | m.DELIVERY | {m.LEO}
  for path, digest in source["preservation"].items():
    assert m.sha(ROOT / path) == digest
  originals = {}
  for tile in ["390_5820", "391_5820"]:
    originals.update(
      {
        b["id"]: b
        for b in m.read(m.GEO / f"alt-mitte-v169/source-{tile}-00.json.gz")["buildings"]
      }
    )
  for b in source["officialReferenceFamilies"]:
    assert b == originals[b["id"]]
  # No isolated official family is silently substituted for a shared prism.
  assert all(
    b["ownershipBinding"]["status"] == "retain-old-mass-source-conflict"
    for b in source["officialReferenceFamilies"]
  )


def test_complete_companions_no_navigation_and_small_memory():
  addition = m.read(m.ADDITION)
  evidence = m.read(m.EVIDENCE)
  assert addition["footprint"] == []
  assert {d["id"] for d in addition["chunks"]} == {
    "namedfront239-2_-2",
    "namedfront239-2_-1",
    "namedfront239-3_-1",
  }
  assert evidence["sourceSha256"] == m.sha(m.SOURCE)
  assert evidence["additionSha256"] == m.sha(m.ADDITION)
  for mode in ["drawn", "minecraft"]:
    assert sum(
      p["gpuBytes"] for k, p in evidence["packets"].items() if k.startswith(mode + ":")
    ) < (450000 if mode == "drawn" else 1250000)
    for desc in addition["chunks"]:
      path = m.OUT / desc[mode]["url"]
      assert m.sha(path) == desc[mode]["sha256"]
      assert path.stat().st_size == desc[mode]["bytes"]
      assert len(gzip.decompress(path.read_bytes())) == desc[mode]["decodedBytes"]
      payload = m.read(path)
      assert payload["nav"] == dict(groundY=3, ground=[], water=[], buildings=[])
      assert len(payload["meshes"]) == 1
      mesh = payload["meshes"][0]
      assert mesh["kind"] == "named-fronts-v239"
      vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
        -1, 3
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert indices.max() < len(vertices)
      assert vertices[:, [0, 2]].max() <= 51200
      if mode == "minecraft":
        tri = vertices[indices].astype(float)
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        assert np.all(np.count_nonzero(np.abs(normals) > 1e-6, axis=1) <= 1)


def test_recognition_roles_keep_all_existing_windows_visible():
  evidence = m.read(m.EVIDENCE)
  for audit in evidence["audits"].values():
    assert audit["refinedPanes"] == {
      "google-gropius": 414,
      "leo-baeck": 18,
      "delivery-hero": 332,
    }
    assert audit["roles"]["retained-source-eave"] > 0
    assert audit["roles"]["delivery-hero-clinker-reveal"] > 0
    assert audit["roles"]["delivery-hero-stone-reveal"] > 0
    assert not any("glazing" in key or "shell" in key for key in audit["roles"])
