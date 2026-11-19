import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile

from scripts.build_lehrter_kulturhaus_v366 import ARCHIVE, DATA, GML_ID, PARENTS, roof


def test_cultural_ensemble_roofs_repeat_the_measured_lod2_surfaces():
  assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == (
    "44676967f904025d91adc5b013e21bf68cd2260da88983d6c7c02a2c1b41e723"
  )
  owners = json.loads((DATA / "lehrterKulturhausOwnersV366.json").read_bytes())
  baked = json.loads((DATA / "lehrterKulturhausRoofsV366.json").read_bytes())
  with zipfile.ZipFile(ARCHIVE) as archive:
    city = ET.fromstring(archive.read(archive.namelist()[0]))
  parts = {
    part.get(GML_ID)[-8:]: part
    for parent in city.findall(".//{*}Building")
    if parent.get(GML_ID) in PARENTS
    for part in parent.findall(".//{*}BuildingPart")
  }
  assert parts.keys() == owners.keys()
  for key, baked_roof in baked.items():
    assert roof(parts[key], owners[key]) == baked_roof
