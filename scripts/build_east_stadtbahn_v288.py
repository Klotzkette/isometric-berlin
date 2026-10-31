"""Freeze finite elevated Stadtbahn courses and immutable packet receipts."""

import gzip
import hashlib
import json
import re
from pathlib import Path

import pyogrio
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import box, mapping

R = Path(__file__).resolve().parents[1]
G = R / "geo_data/regierungsviertel"
a = Transformer.from_crs(25833, 4326, always_xy=True)
s = a.transform(392330, 5819450)
e = a.transform(392700, 5820080)
f = pyogrio.read_dataframe(
  G / "raw/outer-v159/candidate.gpkg", layer="lines", bbox=(*s, *e)
).to_crs(25833)
tracks = []
for r in f.to_dict("records"):
  t = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(r.get("other_tags", ""))))
  t.update({k: r[k] for k in ["railway", "name"] if isinstance(r.get(k), str)})
  if (
    t.get("railway") not in ["rail", "light_rail"]
    or t.get("name") != "Berliner Stadtbahn"
    or t.get("bridge") not in ["viaduct", "yes"]
  ):
    continue
  g = affine_transform(r["geometry"], [1, 0, 0, -1, -389500, 5820000])
  c = g.intersection(box(2850, -50, 3160, 515))
  if c.is_empty:
    continue
  tracks.append(
    {
      "id": str(r["osm_id"]),
      "tags": t,
      "original": mapping(g),
      "points": [[round(x, 6), round(z, 6)] for x, z in c.coords],
    }
  )
tracks.sort(key=lambda t: int(t["id"]))
packets = {}
for id in ["5_-1", "5_0", "6_0", "6_1"]:
  for style in ["drawn", "minecraft"]:
    p = R / f"src/app/public/mesh/surrounding-berlin-v159/{id}.{style}.json.gz"
    d = json.loads(gzip.decompress(p.read_bytes()))
    ms = [(i, m) for i, m in enumerate(d["meshes"]) if m["kind"] == "alt-mitte-v169"]
    rr = []
    for i, m in ms:
      h = 2166136261
      for text in [m["positions"], m["colors"], m["indices"]]:
        for ch in text:
          h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
      rr.append({"mesh": i, "fingerprint": h})
    nav = [b for b in d["nav"]["buildings"] if b["sourceId"].startswith("DEBE00YY1Kx")]
    packets[f"{style}:{id}"] = {"origin": d["origin"], "records": rr, "owners": nav}
cache = G / "alt-mitte-v169/source-392_5819-00.json.gz"
ld = json.loads(gzip.decompress(cache.read_bytes()))
parts = [b for b in ld["buildings"] if b["id"].startswith("DEBE00YY1Kx")]
profile = {
  "schema": 1,
  "bounds": [2850, -50, 3160, 515],
  "tracks": [{"id": t["id"], "points": t["points"]} for t in tracks],
  "packets": packets,
  "viaducts": [
    {
      "id": b["id"],
      "ring": b["footprintPolygons"][0]["ring"],
      "topY": max(p["topY"] for p in b["parts"]),
    }
    for b in parts
  ],
  "heightFit": {
    "alexanderRailY": 13.08,
    "alexanderZ": -50,
    "jannowitzRailY": 10.65,
    "jannowitzZ": 515,
    "nativeMinimumY": 11.25,
  },
  "estimateStatus": "Mapped OSM through-track XZ; station-fit vertical interpolation is an explicit display estimate, not rail survey. Frozen outer LoD2 uses individual local-ground datums, not the common NHN-30 rail frame. Native rails independently clear actual 2m source solids. Upper fascia joining local-datum bodies to fitted rails is an estimated correction.",
}
(R / "src/app/src/data/eastStadtbahnV288.json").write_text(
  json.dumps(profile, separators=(",", ":")) + "\n"
)
ev = {
  "schema": 1,
  "tracks": tracks,
  "sourceSha256": hashlib.sha256(
    (G / "raw/outer-v159/berlin-260929.osm.pbf").read_bytes()
  ).hexdigest(),
  "sourceCacheSha256": hashlib.sha256(cache.read_bytes()).hexdigest(),
  "originalViaductBuildings": parts,
  "frozenGeometryRetained": True,
  "heightFit": profile["heightFit"],
  "estimateStatus": profile["estimateStatus"],
  "referenceUrls": [
    "https://jmayerh.de/voltair/",
    "https://sbahn.berlin/fileadmin/user_upload/Punkt3/PDF-Archiv/2007/punkt3_01_25_07.pdf",
  ],
  "preservation": "No source owners/columns/walls removed. Five separated viaduct footprints and mapped road-bridge gaps retained; no invented pedestrian access through occupied commercial arches.",
}
(G / "east-stadtbahn-v288-evidence.json").write_text(
  json.dumps(ev, separators=(",", ":")) + "\n"
)
print(len(tracks), len(json.dumps(profile)), len(json.dumps(ev)))
