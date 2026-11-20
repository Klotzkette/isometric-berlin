"""Freeze Berlin's cadastral elevated-deck, bridge and pier plans at real railways."""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import requests
from shapely import STRtree
from shapely.affinity import affine_transform
from shapely.geometry import LineString, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SERVICE = "https://gdi.berlin.de/services/wfs/alkis"


def main():
  osm = json.loads(gzip.decompress((GEO / "steel-rail-osm-v369.json.gz").read_bytes()))
  rail = STRtree(
    [
      LineString(r["points"])
      for r in osm["ways"]
      if r["tags"].get("railway") in {"rail", "light_rail", "subway"}
    ]
  )
  structures = []
  pages = []
  seen = set()
  with requests.Session() as client:
    for layer, codes in [
      ("bauwerkeflaechen", ["1830", "1840", "1800"]),
      ("bauwerkelinien", ["1845"]),
    ]:
      for code in codes:
        start = 0
        while True:
          params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": "alkis:" + layer,
            "srsName": "EPSG:25833",
            "count": 1200,
            "startIndex": start,
            "outputFormat": "application/json",
            "cql_filter": f"bwf='{code}'",
            "sortBy": "uuid",
          }
          reply = client.get(SERVICE, params=params, timeout=35)
          reply.raise_for_status()
          data = reply.json()
          pages.append(
            {
              "layer": layer,
              "code": code,
              "start": start,
              "count": data["numberReturned"],
              "sha256": hashlib.sha256(reply.content).hexdigest(),
            }
          )
          for rec in data["features"]:
            prop = rec["properties"]
            assert prop["bwf"] == code and prop["uuid"] not in seen
            seen.add(prop["uuid"])
            geom = affine_transform(
              shape(rec["geometry"]), [1, 0, 0, -1, -389500, 5820000]
            )
            if (
              not geom.is_valid
              or len(rail.query(geom, predicate="dwithin", distance=18)) == 0
            ):
              continue
            geom = geom.simplify(0.014, preserve_topology=True)
            obj = mapping(geom)

            def two(v):
              if not isinstance(v, (tuple, list)):
                return round(v, 2)
              return list(map(two, v))

            obj["coordinates"] = two(obj["coordinates"])
            structures.append({"id": prop["uuid"], "class": int(code), "geometry": obj})
          start += len(data["features"])
          if start >= data["numberMatched"] or not data["features"]:
            break
  result = {
    "source": "Geoportal Berlin, ALKIS Berlin – Bauwerke (Flächen/Linien), DL-DE/Zero 2.0",
    "wfs": SERVICE,
    "pages": pages,
    "note": "1830=Hochbahn/Hochstraße, 1800=Brücke, 1840=Brückenpfeiler, 1845=Widerlager; located within 18 m of a mapped active elevated rail way. The object classification describes use, not construction material.",
    "records": structures,
  }
  dest = GEO / "steel-rail-cadastre-v369.json.gz"
  dest.write_bytes(
    gzip.compress(
      (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode(),
      mtime=0,
    )
  )
  print(
    {
      code: sum(row["class"] == code for row in structures)
      for code in [1830, 1800, 1840, 1845]
    },
    len(pages),
  )


if __name__ == "__main__":
  main()
