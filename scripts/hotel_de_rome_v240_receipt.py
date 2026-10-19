"""Project only audited hotel display edits out of historical preservation checks."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "geo_data/regierungsviertel/hotel-de-rome-v240-evidence.json"


def prior_hotel_display(path: str, source: bytes) -> bytes:
  """Reverse exact v240 edits without relaxing any unrelated old-file receipt."""
  if path.endswith("BebelplatzFacades.ts"):
    addition = b'import { addHotelDeRomeV240 } from "./HotelDeRomeV240";\n'
    current = b"function hotel(b: Builder): void {\n  addHotelDeRomeV240(b);\n}\n"
    assert source.count(addition) == 1 and source.count(current) == 1
    old = json.loads(EVIDENCE.read_text())["oldFunction"].encode()
    source = source.replace(addition, b"", 1).replace(current, old, 1)
    marker = b"const SAND = 0xcdbb97,\n  GOLD = 0xbfa24a;"
    assert source.count(marker) == 1
    source = source.replace(
      marker, b"const SAND = 0xcdbb97,\n  HOTEL = 0xbebdb3,\n  GOLD = 0xbfa24a;", 1
    )
  elif path.endswith("BebelplatzBuildingShells.ts"):
    addition = b'import { clipHotelNativeFront } from "./HotelDeRomeV240";\n'
    correction = json.loads(EVIDENCE.read_text())["nativeFrontCorrection"]
    old, new = correction["oldLoop"].encode(), correction["newLoop"].encode()
    assert source.count(addition) == 1 and source.count(new) == 1
    source = source.replace(addition, b"", 1).replace(new, old, 1)
    current = b'{ wall: 0xc5bdad, roof: 0x696b68, name: "Hotel de Rome" }'
    assert source.count(current) == 1
    source = source.replace(current, current.replace(b"0xc5bdad", b"0xbebdb3"), 1)
  return source
