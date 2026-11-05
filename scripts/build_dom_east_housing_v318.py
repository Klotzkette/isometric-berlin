"""Additive recognition of the retained Karl-Liebknecht-Strasse housing bar.

No source wall, roof, podium, glass, navigation or old fitting is rewritten.
Repeated vertical fitting profiles are factored without changing Float32 words.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import struct
from collections import defaultdict

from shapely.geometry import box

from scripts.build_linden_east_context_v315 import (
  DATA,
  GEO,
  ROOT,
  Fittings,
  base85,
  footprint,
  native_planes,
  projected_wall,
  read,
  sha,
  source_packets,
  walls,
)

OUTPUT = DATA / "domEastHousingV318.json"
EVIDENCE = GEO / "dom-east-housing-v318-evidence.json.gz"
OWNER = "DEBE01YYK00001GQ"
SHEETS = (
  "UUID_3a756061-0c17-4356-8809-4dcf22e2eb85",
  "UUID_2128114d-cd5a-4734-818f-54e86ab8b54c",
)
REFERENCES = {
  "architecture": "https://www.rosalux.de/fileadmin/rls_uploads/pdfs/sonst_publikationen/Henselmann_1-2017.pdf",
  "currentOperator": "https://ngbk.de/de/besuch/ngbk-alexanderplatz",
  "currentPhotograph": "https://ngbk.de/media/pages/media/4730f04c5f-1706177151/2312_ngbk-228_thomas_bruns-500x-q80.webp",
  "contemporaryPhotoMetadata": "https://commons.wikimedia.org/wiki/File:Liebknechtriegel2026.jpg",
  "mappedResidential": "https://www.openstreetmap.org/way/234463917",
  "mappedPodium": "https://www.openstreetmap.org/way/234973637",
}


def factor(part: dict) -> dict:
  """Lossless factoring by horizontal Float32 profile and exact vertical words."""
  fmt = "<6fI" if part["native"] else "<7fI"
  groups = defaultdict(list)
  original = list(struct.iter_unpack(fmt, base64.b64decode(part["boxes"])))
  for row in original:
    x, y, z, w, h, d, *tail = row
    groups[(x, z, w, d, *tail)].append((y, h))
  patterns, profiles = [], []
  for horizontal, levels in groups.items():
    if levels not in patterns:
      patterns.append(levels)
    profiles.append([*horizontal, patterns.index(levels)])
  # Reconstruct every row; sorting ignores only the irrelevant instance order.
  restored = []
  for horizontal in profiles:
    x, z, w, d, *tail, pattern = horizontal
    for y, h in patterns[pattern]:
      restored.append(struct.pack(fmt, x, y, z, w, h, d, *tail))
  old_words = sorted(struct.pack(fmt, *r) for r in original)
  assert old_words == sorted(restored)
  # The factored horizontal profiles retain their exact Float32 words. Put
  # each component in a column before the existing lossless word-plane codec.
  columns = len(profiles[0])
  words = []
  for component in range(columns):
    for row in profiles:
      words.append(
        struct.unpack("<I", struct.pack("<f", row[component]))[0]
        if component < columns - 2
        else row[component]
      )
  previous, deltas = 0, []
  for value in words:
    delta = (value - previous) & 0xFFFFFFFF
    delta = delta if delta < 0x80000000 else delta - 0x100000000
    previous = value
    deltas.append(((delta << 1) ^ (delta >> 31)) & 0xFFFFFFFF)
  packed = bytes((v >> (8 * byte)) & 255 for byte in range(4) for v in deltas)
  decoded, previous = [], 0
  for i in range(len(words)):
    v = sum(packed[byte * len(words) + i] << (8 * byte) for byte in range(4))
    previous = (previous + ((v >> 1) ^ -(v & 1))) & 0xFFFFFFFF
    decoded.append(previous)
  assert decoded == words
  return dict(
    key=part["key"],
    native=part["native"],
    count=len(original),
    profileCount=len(profiles),
    profiles=base64.b64encode(packed).decode(),
    profilesCodec="u32-delta-byteplanes-stride1-v1",
    patterns=patterns,
    allRowWordsSha256=hashlib.sha256(b"".join(old_words)).hexdigest(),
  )


def build():
  inputs = set()
  source = GEO / "alt-mitte-v169/source-391_5820-00.json.gz"
  inputs.add(source)
  family = next(b for b in read(source)["buildings"] if b["id"] == OWNER)
  drawn = source_packets(OWNER, "4_-1", False, inputs)
  native = source_packets(OWNER, "4_-1", True, inputs)
  planes = native_planes(native, footprint(family).bounds, [])
  fit = Fittings(planes, [])
  fitted = []
  for wall in walls(family):
    if wall["sheet"] not in SHEETS:
      continue
    f = wall["frame"]
    length = f[3]
    # The public three-level podium and roof parapet remain unpainted. The
    # contemporary facade is light, with blue-grey glazed/open loggias;
    # the 1967 elevation establishes the repeating residential programme.
    low, high, floors = 17.10, 46.35, 10
    surface = projected_wall(drawn, f)
    assert surface.buffer(0.025).covers(box(0.3, low, length - 0.3, high))
    bays = 66 if length > 210 else 65
    width, storey = (length - 0.8) / bays, (high - low) / floors
    for floor in range(floors):
      y = low + storey * (floor + 0.5)
      for bay in range(bays):
        u = 0.4 + width * (bay + 0.5)
        # Shallow contrasting infill conveys a recess without cutting
        # a false traversable opening in the complete source body.
        open_loggia = bay % 3 == 1 and floor % 3 != 2
        fit.panel(
          f,
          u,
          y + 0.16,
          width - 0.36,
          1.91,
          0x58676B if open_loggia else 0x829596,
          0.09,
        )
        if open_loggia:
          fit.panel(f, u, y - 0.79, width - 0.22, 0.54, 0xD3D4CF, 0.19)
        else:
          fit.panel(f, u, y + 0.16, 0.075, 1.91, 0xDADBD5, 0.19)
      fit.panel(
        f, length / 2, low + floor * storey + 0.10, length - 0.35, 0.22, 0xDADBD5, 0.22
      )
    for bay in range(bays + 1):
      fit.panel(
        f, 0.4 + width * bay, (low + high) / 2, 0.065, high - low, 0xB0B2AB, 0.18
      )
    fitted.append({k: v for k, v in wall.items() if k != "frame"})
  assert len(fitted) == 2
  parts = [
    factor(fit.draw.packed("Karl-Liebknecht-Strasse 9-13 residential bar", False)),
    factor(fit.native.packed("Karl-Liebknecht-Strasse 9-13 residential bar", True)),
  ]
  raw = json.dumps(parts, separators=(",", ":")).encode()
  OUTPUT.write_text(
    json.dumps(
      dict(
        codec="gzip-base85-factored-profiles",
        decodedBytes=len(raw),
        decodedSha256=hashlib.sha256(raw).hexdigest(),
        payload=base85(gzip.compress(raw, mtime=0)),
      ),
      separators=(",", ":"),
    )
    + "\n"
  )
  evidence = dict(
    schemaVersion=1,
    references=REFERENCES,
    owner=OWNER,
    interpretation="The owner's unnamed DDR block east of the Dom near Hackescher Markt is interpreted as the Karl-Liebknecht-Strasse residential complex, not the modern Hackesches Quartier. This finite addition targets the long retained 9-11/13 bar only; 13 also identifies the public podium, not a newly invented separate tower.",
    estimateStatus="Exact official source wall planes and independent delivered native faces. Bay/storey spacing, shallow loggia infill, sections and colours are architectural display estimates informed by Peter Meyer/MGHS, Henselmann 1/2017 p8 and the current nGbK operator photograph (Thomas Bruns, December2023). The 2026 Commons metadata confirms identity/viewpoint; its pixels were unavailable and were not used to infer additional detail.",
    sourceGeometryRetained=True,
    automaticRetirement=False,
    noNavigationChange=True,
    fullStaticDetailOnTouch=True,
    completeOfficialFamily=family,
    sheetCount=sum(len(p["surfaces"]) for p in family["parts"]),
    fittedSheets=fitted,
    nativeFits=fit.fits,
    omittedNativeAtUnsupportedSource=fit.unfitted,
    nativeSourceColumns=[],
    inputs=[
      dict(path=str(p.relative_to(ROOT)), sha256=sha(p), bytes=p.stat().st_size)
      for p in sorted(inputs)
    ],
    runtime=dict(
      path=str(OUTPUT.relative_to(ROOT)),
      sha256=sha(OUTPUT),
      bytes=OUTPUT.stat().st_size,
      decodedSha256=hashlib.sha256(raw).hexdigest(),
    ),
    counts=[
      dict(
        native=p["native"],
        instances=p["count"],
        profiles=p["profileCount"],
        patterns=len(p["patterns"]),
      )
      for p in parts
    ],
  )
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )
  print(
    json.dumps(
      {
        "runtime": evidence["runtime"],
        "counts": evidence["counts"],
        "omitted": fit.unfitted,
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
