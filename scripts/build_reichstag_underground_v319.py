"""Retained public OSM courses and explicitly schematic pedestrian endpoints.

No survey of private rooms, tunnel elevations or operational equipment is implied.
The public primary references establish functions and connections only.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import pyogrio
from pyproj import Transformer
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
OUTPUT = ROOT / "src/app/src/data/reichstagUndergroundV319.json"
EVIDENCE = GEO / "reichstag-underground-v319-source.json.gz"
GOODS_IDS = (139118203, 416419153, 139118202, 25777235, 25777238)
REFERENCES = {
  "ues": "https://www.bundestag.de/parlament/verwaltung/ues-245596",
  "jkh": "https://www.bundestag.de/dokumente/textarchiv/architektur-jakob-kaiser-haus-1101942",
  "archive": "https://www.bundestag.de/besuche/kunst/kuenstler/boltanski/",
  "archivePhotographs": "https://www.bundestag.de/resource/blob/194606/flyer_boltanski.pdf",
  "pedestrianPlh": "https://www.mitmischen.de/wissen/hinter-den-kulissen/orte-im-bundestag/der-ungeplante-tunnel",
  "pedestrianJkh": "https://www.mitmischen.de/wissen/hinter-den-kulissen/inside-bundestag/welche-geschichte-erzaehlt-dieses-laufband",
  "openDayMap2022": "https://www.bundestag.de/resource/blob/906848/flyer_deutsch_2022.pdf",
  "currentBooklet": "https://www.btg-bestellservice.de/pdf/40311000.pdf",
  "uesSection": "https://www.berlin.de/sen/bauen/_assets/wettbewerbe/2025/luisenblock-ost/2025-12-05_lboll_auslobung.pdf?ts=1764934784",
}


def build():
  t = Transformer.from_crs(4326, 25833, always_xy=True)

  def world(x, y, z=None):
    e, n = t.transform(x, y)
    return e - 389500, 5820000 - n

  rows = pyogrio.read_dataframe(
    PBF, layer="lines", bbox=(13.3735, 52.5175, 13.3815, 52.5225)
  )
  sources = {}
  for _, row in rows.iterrows():
    ident = int(row.osm_id)
    if ident in GOODS_IDS:
      geometry = transform(world, row.geometry)
      sources[ident] = dict(
        id=ident,
        name=row["name"],
        tags=row["other_tags"],
        coordinates=[list(p) for p in geometry.coords],
      )
  assert set(sources) == set(GOODS_IDS)
  # Primary UES identity + public mapped XY; no operational/internal plan.
  paths = [
    dict(
      id=f"ues-{ident}",
      kind="goods",
      width=8,
      height=4.2,
      nameDe="Versorgungssystem · kein allgemeiner Besuchergang",
      nameEn="Service system · not a general visitor passage",
      points=[[x, -8.2, z] for x, z in sources[ident]["coordinates"]],
      sourceWay=ident,
      status="Mapped XY; constant depth and section are display estimates",
    )
    for ident in GOODS_IDS
  ]
  # Endpoints lie in the named mapped buildings; intermediate courses are
  # deliberately labelled schematic, not falsely promoted to surveyed routes.
  paths[:0] = [
    dict(
      id="rtg-jkh",
      kind="pedestrian",
      width=7,
      height=3.3,
      nameDe="Fußgängergang zum Jakob-Kaiser-Haus",
      nameEn="Pedestrian passage to Jakob Kaiser Building",
      points=[
        [363.5, 0.25, 41.8],
        [379, 0.25, 42.3],
        [400, 0.25, 51.0],
        [420, 0.25, 55.0],
      ],
      status="Publicly documented connection; course/width/elevation are schematic endpoint fits",
    ),
    dict(
      id="rtg-plh",
      kind="pedestrian",
      width=7,
      height=3.3,
      nameDe="Fußgängergang zum Paul-Löbe-Haus",
      nameEn="Pedestrian passage to Paul Löbe Building",
      points=[[348, 0.25, 29], [348, 0.25, -30], [332, 0.25, -60], [332, 0.25, -90]],
      status="Publicly documented connection; course/width/elevation are schematic endpoint fits",
    ),
  ]
  output = dict(
    schemaVersion=1,
    floor=0.25,
    ceiling=3.55,
    archiveLocal=[34.4, 40.1, -17, 17],
    crossingLocal=[28.5, 40.6, -20, 20],
    paths=paths,
    archiveBoxCount=5000,
    estimateStatus="Schematic architectural exhibit, not a measured basement or operational access plan",
  )
  OUTPUT.write_text(json.dumps(output, separators=(",", ":")) + "\n")
  evidence = dict(
    schemaVersion=1,
    checked="2026-11-06",
    references=REFERENCES,
    noExistingSourceMutation=True,
    noNavigationChange=True,
    publicDocumentedConnections=[
      "RTG-JKH pedestrian",
      "RTG-PLH pedestrian",
      "RTG/PLH/JKH/MELH UES goods+garage network",
    ],
    distinctOvergroundConnection="PLH-MELH pedestrian bridge; no invented direct RTG-MELH visitor tunnel",
    archive="Christian Boltanski, Archiv der Deutschen Abgeordneten,1999. Two long ceiling-high metal-box blocks, narrow dim aisle, filament lamps; about5000boxes. No invented names or transcribed individual labels.",
    functions="Basement connection/archive and publicly photographed converted technical passage; no invented private office/plant-room inventory.",
    heatingFragment="Current Bundestag booklet p37 describes a preserved old heating-passage fragment in the RTG-JKH pedestrian underpass. Display dimensions and placement are estimates, not a claim of a surviving full historical route.",
    metricStatus="UES XY derived from retained OSM ways; full transformed source nodes are retained without rounding. All elevations, pedestrian bends/lengths, room subdivisions, furniture and small fittings are explicit display estimates. UES4.2m height/approximately8m width are published general dimensions, not measured per segment.",
    source=dict(
      path=str(PBF.relative_to(ROOT)),
      sha256=hashlib.sha256(PBF.read_bytes()).hexdigest(),
      ways=[sources[i] for i in GOODS_IDS],
      license="ODbL-1.0",
    ),
    runtime=dict(
      path=str(OUTPUT.relative_to(ROOT)),
      sha256=hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
      bytes=OUTPUT.stat().st_size,
    ),
    photographs="DBT flyer: Julia Nowak-Katz, SimoneM.Neumann, WernerSchüring,JörgF.Müller; mitmischen2025: NiklasNachtigall. Reference-only, no pixels redistributed.",
  )
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )
  print(json.dumps(evidence["runtime"], indent=2))


if __name__ == "__main__":
  build()
