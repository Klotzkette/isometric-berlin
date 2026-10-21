"""Photo-fit facade keeps all four source parts and remains bounded in both modes."""

import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_columbiahalle_v257 import (  # noqa: E402
  PHOTO_REFINEMENT,
  corrected,
  details,
)
from build_karl_marx_allee_v161 import Detail, packed_detail  # noqa: E402
from build_venues_hermann_v238 import architecture, face_axes  # noqa: E402


@pytest.fixture(scope="module")
def facade():
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/venues-hermann-v238-source.json.gz"
      ).read_bytes()
    )
  )["buildings"][1]
  return (
    source,
    architecture(source)[0],
    json.loads((ROOT / "src/app/src/data/columbiahalleV257.json").read_text()),
  )


@pytest.mark.parametrize("mode,native", [("drawn", False), ("minecraft", True)])
def test_published_facade_contains_every_retained_source_triangle(facade, mode, native):
  source, models, published = facade
  retained = [row for row in models[mode].triangles if not corrected(row)]
  result = Detail()
  result.triangles = retained + details(source, native).triangles
  expected = packed_detail(result, box(1024, 3584, 1536, 4096))
  assert all(
    expected[key] == published[mode]["replacement"][key]
    for key in ("positions", "colors", "indices")
  )
  assert len(source["parts"]) == 4
  for row in models[mode].triangles:
    if (
      row[2].startswith(source["parent"])
      or row[2] == "independent-measured-native-skin"
    ):
      assert not corrected(row)


@pytest.mark.parametrize("native", [False, True])
def test_photo_sign_hierarchy_and_three_entry_bays_are_legible_and_local(
  facade, native
):
  source = facade[0]
  faces = details(source, native).triangles
  f = face_axes(source)[13]
  center = f["a"] + f["d"] * f["length"] / 2

  def bounds(role):
    points = np.array([p for tri, _, tag in faces if tag == role for p in tri])
    assert len(points)
    local = np.column_stack(((points[:, [0, 2]] - center) @ f["d"], points[:, 1]))
    return local.min(axis=0), local.max(axis=0)

  marquee = bounds("cream-marquee")
  for role in ("marquee-date", "marquee-concert", "marquee-entry-time"):
    lo, hi = bounds(role)
    assert np.all(lo > marquee[0]) and np.all(hi < marquee[1])
  assert bounds("marquee-date")[0][1] > bounds("marquee-concert")[1][1]
  assert bounds("marquee-entry-time")[0][0] > 2
  assert bounds("marquee-entry-time")[1][1] < bounds("marquee-concert")[0][1]
  neon = bounds("outlined-blue-columbia")
  assert neon[1][0] - neon[0][0] > 6.8
  assert bounds("blue-halle-subtitle")[1][1] < neon[0][1]
  for bay in range(1, 4):
    lo, hi = bounds(f"entry-bay-{bay}")
    assert hi[0] - lo[0] > 2.6
  assert bounds("kasse-white-lettering")[0][0] > 9.5
  assert not any(tag == "geometric-venue-lettering" for _, _, tag in faces)
  assert PHOTO_REFINEMENT["observedLabels"] == [
    "COLUMBIA",
    "HALLE",
    "19.10.2026",
    "THE SISTERS OF MERCY",
    "EINLASS:18:30",
    "KASSE",
  ]


@pytest.mark.parametrize("native", [False, True])
def test_letter_faces_stay_clear_of_box_and_tracks_after_cm_quantization(
  facade, native
):
  source = facade[0]
  rows = details(source, native).triangles
  f = face_axes(source)[13]
  origin = np.array([1024, -10, 3584])

  def depths(roles):
    points = np.array([p for tri, _, role in rows if role in roles for p in tri])
    # Use the actual packed payload's centimetre display precision. Thin faces
    # must remain separated after export, including stepped native surfaces.
    packed = np.round((points - origin) * 100) / 100 + origin
    return (packed[:, [0, 2]] - f["a"]) @ f["n"]

  letters = depths({"marquee-date", "marquee-concert", "marquee-entry-time"})
  backdrop = depths({"cream-marquee", "marquee-letter-tracks", "marquee-panel-joints"})
  assert letters.min() - backdrop.max() > 0.025
  ticket = depths({"kasse-white-lettering"})
  plaque = depths({"kasse-dark-plaque"})
  assert ticket.min() - plaque.max() > 0.025
