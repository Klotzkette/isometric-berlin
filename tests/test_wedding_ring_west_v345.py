"""The new fittings must retain actual mapped identity and storeys."""

from copy import deepcopy

import pytest

from scripts import build_cluster_facades_v320 as f
from scripts.build_wedding_ring_west_v345 import PROFILE, confirm_ordinary_face


@pytest.fixture(scope="module")
def selection():
  profile = f.read(PROFILE)
  face = next(
    face
    for group in profile["clusters"]
    for face in group["faces"]
    if face["family"] == "primary"
  )
  record = next(
    row
    for row in profile["ordinaryResidentialRecords"]
    if row["owner"] == face["owner"]
  )
  descriptor = next(
    row
    for row in f.read(f.PUBLIC / "manifest.json")["chunks"]
    if row["id"] == face["chunk"]
  )
  return face, record, f.read(f.PUBLIC / descriptor["drawn"]["url"])


def test_mapped_storeys_are_retained(selection):
  face, record, packet = selection
  assert confirm_ordinary_face(face, record, packet) == face["mappedStoreys"]
  assert len(f.read(PROFILE)["clusters"]) >= 20


def test_changed_residential_identity_is_not_accepted(selection):
  face, record, packet = selection
  changed = deepcopy(record)
  changed["sourceRecord"]["properties"]["name"] = "Named public building"
  with pytest.raises(ValueError, match="ordinary housing"):
    confirm_ordinary_face(face, changed, packet)


def test_missing_storey_evidence_is_not_invented(selection):
  face, record, packet = selection
  changed = deepcopy(record)
  changed["sourceRecord"]["properties"]["other_tags"] = ""
  with pytest.raises(ValueError, match="storey count"):
    confirm_ordinary_face(face, changed, packet)


def test_changed_source_body_is_not_accepted(selection):
  face, record, packet = selection
  changed = deepcopy(packet)
  next(b for b in changed["nav"]["buildings"] if b["sourceId"] == face["owner"])[
    "height"
  ] += 1
  with pytest.raises(ValueError, match="residential building"):
    confirm_ordinary_face(face, record, changed)
