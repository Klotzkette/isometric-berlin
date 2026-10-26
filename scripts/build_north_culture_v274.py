"""Retain finite, named northern culture-site evidence; no city asset rewrite."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
TARGETS = {
  "herzJesu": ("DEBE03YY6000006I", "392_5821", "way/922502281"),
  "groberUnfug": ("DEBE03YY600009HQ", "391_5821", "node/1552581365"),
}
URLS = {
  "herzJesu": [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095536",
    "https://www.berlin.de/landesdenkmalamt/aktivitaeten/artikel.1507044.php",
    "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/sakralbauten/herz-jesu-kirche-639367.php",
    "https://www.denkmalschutz.de/denkmal/kath-pfarrkirche-herz-jesu.html",
  ],
  "groberUnfug": [
    "https://www.groberunfug.de/filialen/",
    "https://www.groberunfug.de/wp-content/uploads/2025/02/grober-unfug-mitte-aussen-01-700px.jpg",
  ],
  "suhrkamp": [
    "https://bundschuh.net/project/suhrkamp-ensemble/",
    "https://www.suhrkamp.de/kontakt-s-63",
  ],
  "schoenhauserTor": [
    "https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Torstrasse_49,_Wohn-_und_Geschaeftshaus_Schoenhauser_Tor.jpg",
    "https://deka-sterne-berlin.de/sterne/Schoenhauser_Tor",
    "https://www.lxhausys.com/eu-en/project/himacs-schonhauser-tor/",
  ],
}


def digest(value: object) -> str:
  """Hash structured source evidence independently of output formatting."""
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def build() -> tuple[dict, dict]:
  """Keep source parents, exact wall axes and an explicit estimation boundary."""
  evidence = {"schemaVersion": 1, "retrieved": "2026-10-26", "sources": URLS}
  parents = []
  packets = {"herzJesu": "5_-3", "groberUnfug": "4_-3"}
  for key, (owner, tile, osm) in TARGETS.items():
    archive = GEO / f"raw/lod2/LoD2_{tile}.zip"
    parent = extract_parent(archive, owner)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    packet_path = (
      ROOT
      / "src/app/public/mesh/surrounding-berlin-v159"
      / f"{packets[key]}.drawn.json.gz"
    )
    packet = json.loads(gzip.decompress(packet_path.read_bytes()))
    placement = next(
      b for b in packet["nav"]["buildings"] if b.get("sourceId") == owner
    )
    ground_y = packet["nav"]["groundY"] + placement.get("groundOffset", 0)
    parents.append(
      dict(
        key=key,
        id=owner,
        osmId=osm,
        archive=f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
        sourceParts=parts,
        sourceSha256=digest(parts),
        groundY=ground_y,
        verticalOffset=ground_y - min(p["ground_y_m"] for p in parts),
        placementPacket=packets[key],
        placementSha256=hashlib.sha256(packet_path.read_bytes()).hexdigest(),
      )
    )
  suhrkamp = json.loads((DATA / "suhrkampPfefferbergV189.json").read_text())
  tor = json.loads((DATA / "alexanderNorthV166Navigation.json").read_text())
  tor_parts = [p for p in tor["parts"] if p.get("parentId") == "DEBE03YY600008OF"]
  if not tor_parts:
    # v166 profiles retain the grouping in the parent rather than part rows.
    old = json.loads((GEO / "alexander-north-v166-source.json").read_text())
    tor_parts = next(b for b in old["parents"] if b["id"] == "DEBE03YY600008OF")[
      "parts"
    ]
  # Four explicit source street facets, excluding all part seams/atrium faces.
  selections = [
    ("DEBE3DYRpubWolUn", [2645.984, -1045.327], [2642.281, -1059.306]),
    ("DEBE3DYRpubWolUn", [2640.051, -1067.708], [2637.541, -1077.195]),
    ("DEBE3DYRpubWolUn", [2658.751, -1040.494], [2647.71, -1043.514]),
    ("DEBE3DYRpubWolUn", [2694.478, -1032.045], [2672.662, -1037.99]),
  ]
  tor_faces = []
  for part_id, a, b in selections:
    part = next(p for p in tor_parts if p["id"] == part_id)
    assert any(
      v == a and part["ring"][(i + 1) % len(part["ring"])] == b
      for i, v in enumerate(part["ring"])
    )
    dx, dz = b[0] - a[0], b[1] - a[1]
    n = [-dz / math.hypot(dx, dz), dx / math.hypot(dx, dz)]
    if n[0] > 0 and abs(n[0]) > 0.8 or n[1] < 0 and abs(n[1]) > 0.8:
      n = [-n[0], -n[1]]
    tor_faces.append(
      dict(partId=part_id, a=a, b=b, normal=n, bottom=3, top=part["top_y_m"])
    )
  runtime = dict(
    schemaVersion=1,
    ownerIds=[p["id"] for p in parents],
    sourceSha256=digest(parents),
    herzJesu=dict(
      a=[2618.023, -1280.053],
      b=[2637.576, -1267.081],
      groundY=parents[0]["groundY"],
      height=55,
      previousHeight=25.567,
      towerCenter=[2619.71, -1273.54],
      towerWidth=8.7,
      towerDepth=8.4,
    ),
    groberUnfug=dict(
      a=[2429.369, -1120.345],
      corner=[2452.063, -1113.645],
      b=[2457.563, -1124.470],
      groundY=parents[1]["groundY"],
      poi=[2450.0966476, -1116.7499215],
    ),
    suhrkampFaces=[f for f in suhrkamp["faces"] if f["kind"] == "suhrkamp"],
    schoenhauserTorParts=tor_parts,
    schoenhauserTorFaces=tor_faces,
    policy="Named additions only. All existing source sheets, roof holes, courtyards and navigation stay intact. Herz-Jesu's missing upper tower is restored to the LDA-documented 55m; tower footprint, roof subdivisions and decorative details are proportioned display estimates tied to the retained ground plan. Shop front uses the operator photo, never a bundled texture. Suhrkamp remains Torstrasse 44; Schoenhauser Tor remains the built Torstrasse 49 complex, excluding 2026 competition proposals. Full mobile detail and independent orthogonal native geometry; no new descriptor, light, animation or media.",
  )
  evidence.update(
    herzJesuDop=dict(
      url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr?service=WMS&version=1.3.0&request=GetMap&layers=dop_2025&styles=&crs=EPSG%3A25833&bbox=392070,5821210,392155,5821300&width=850&height=900&format=image%2Fjpeg",
      bbox=[392070, 5821210, 392155, 5821300],
      interpretation="Red four-sided tower roof, retained church/wing ground plan; height from LDA, dimensions estimated",
    ),
    parents=parents,
    suhrkampSourceSha256=suhrkamp["sourceSha256"],
    schoenhauserTorParts=tor_parts,
    runtimeSha256=digest(runtime),
    policy=runtime["policy"],
  )
  return runtime, evidence


def main() -> None:
  """Write deterministic compact runtime data and complete retained evidence."""
  runtime, evidence = build()
  (DATA / "northCultureV274Source.json").write_text(
    json.dumps(runtime, separators=(",", ":")) + "\n"
  )
  (GEO / "north-culture-v274-source.json.gz").write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )


if __name__ == "__main__":
  main()
