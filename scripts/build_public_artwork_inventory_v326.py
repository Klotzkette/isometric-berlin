"""Complete strict-Berlin retained OSM artwork/memorial union accounting.

No generic replacement geometry. Existing authored models and the independent
documented pavement-stone recipe remain unchanged by this source complement.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pyogrio
from shapely.geometry import mapping
from shapely.ops import unary_union

from scripts.build_public_inventory_v326 import (
  GEO,
  RAW,
  ROOT,
  STATE_SOURCE,
  digest,
  osm_identity,
  read,
  tags,
  world_geometry,
)
from scripts.build_public_monuments_v326 import AUTHORED


def write(path, payload):
  value = (
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(value, mtime=0))


def extract():
  pbf = GEO / "raw/outskirts-v187/berlin-260929.osm.pbf"
  state = unary_union(
    [world_geometry(f["geometry"], True) for f in read(STATE_SOURCE)["features"]]
  )
  sources = []
  for layer, sql in [
    (
      "points",
      'SELECT * FROM points WHERE other_tags LIKE \'%"tourism"=>"artwork"%\' OR other_tags LIKE \'%"historic"=>"memorial"%\' OR other_tags LIKE \'%"historic"=>"monument"%\' OR other_tags LIKE \'%"memorial"=>%\'',
    ),
    (
      "multipolygons",
      "SELECT * FROM multipolygons WHERE tourism='artwork' OR historic IN ('memorial','monument') OR other_tags LIKE '%\"memorial\"=>%'",
    ),
  ]:
    frame = pyogrio.read_dataframe(pbf, sql=sql, sql_dialect="OGRSQL")
    records = []
    for _, row in frame.iterrows():
      props = {
        k: v
        for k, v in row.to_dict().items()
        if k != "geometry" and v is not None and not (isinstance(v, float) and v != v)
      }
      geometry = world_geometry(mapping(row.geometry))
      if not state.covers(geometry.representative_point()):
        continue
      records.append(
        {
          "id": osm_identity(props, layer == "multipolygons"),
          "properties": props,
          "tags": tags(props),
          "geometry": mapping(geometry),
          "originalGeographicGeometry": mapping(row.geometry),
        }
      )
    output = RAW / ("artwork_union_" + layer + ".json.gz")
    write(
      output,
      {
        "schemaVersion": 1,
        "sourcePbf": str(pbf.relative_to(ROOT)),
        "sourcePbfSha256": digest(pbf),
        "query": sql,
        "records": records,
      },
    )
    sources.append(output)
    print(layer, len(records), flush=True)
  return sources


def build(reuse=False):
  paths = (
    [RAW / "artwork_union_points.json.gz", RAW / "artwork_union_multipolygons.json.gz"]
    if reuse
    else extract()
  )
  for p in paths:
    if read(p)["sourcePbfSha256"] != digest(
      GEO / "raw/outskirts-v187/berlin-260929.osm.pbf"
    ):
      raise ValueError("Changed complete original PBF")
  strict = read(GEO / "public-monuments-v326-source.json.gz")
  named_path = ROOT / "src/app/src/data/oberschoeneweideMemorialV326.json"
  named = read(named_path)
  old = {
    q["osm_key"]: q
    for q in read(ROOT / "src/app/public/mesh/regierungsviertel/street-details.json")[
      "monuments"
    ]
  }
  strict_by = {q["sourceIdentity"]: q for q in strict["records"]}
  source_records = [q for path in paths for q in read(path)["records"]]
  ids = [q["id"] for q in source_records]
  if len(ids) != len(set(ids)) or not set(strict_by).issubset(ids):
    raise ValueError("Incomplete/duplicate exact artwork+memorial union")
  records = []
  for q in source_records:
    sid = q["id"]
    if sid in AUTHORED:
      status = "retained-specific-authored"
    elif sid == named["id"]:
      status = "source-supported-named-reference-interpretation"
    elif sid in strict_by:
      status = "strict-historic-ledger:" + strict_by[sid]["status"]
    elif sid in old:
      status = "retained-existing-caller-record"
    else:
      status = "unresolved-individual-artwork"
    records.append(
      {
        **q,
        "status": status,
        "retainedModule": AUTHORED.get(sid),
        "namedDimensions": {
          k: named[k]
          for k in [
            "heightM",
            "widthM",
            "depthM",
            "material",
            "orientation",
            "reliefStatus",
          ]
        }
        if sid == named["id"]
        else None,
        "buildingProximityIsNotCoverage": True,
        "claim": "Existing geometry preserved; unreviewed individual geometry is not claimed accurate or newly rendered"
        if "unresolved" in status
        else "Exact source identity accounted; see existing caller/individual ledger for accuracy limits",
      }
    )
  source = {
    "schemaVersion": 1,
    "sourcePbfUrl": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "sourcePbfSha256": read(paths[0])["sourcePbfSha256"],
    "queries": {path.name: read(path)["query"] for path in paths},
    "sourceDate": "2026-09-29",
    "checked": "2026-11-08",
    "scope": "Strict Berlin retained OSM union: tourism=artwork OR historic=memorial/monument OR an explicit memorial subtype, points plus complete multipolygons; not an exhaustive census of all physical public art",
    "inputs": {
      str(p.relative_to(ROOT)): digest(p)
      for p in paths
      + [STATE_SOURCE, GEO / "public-monuments-v326-source.json.gz", named_path]
    },
    "strictHistoricCount": len(strict_by),
    "separateHeritageCount": strict["heritageRecordCount"],
    "unionCount": len(records),
    "tourismArtworkCount": sum(q["tags"].get("tourism") == "artwork" for q in records),
    "additionalSourceIdentityCount": sum(q["id"] not in strict_by for q in records),
    "statusCounts": dict(Counter(q["status"] for q in records)),
    "retainedCallerRecordsOutsideCurrentUnion": [
      q for sid, q in old.items() if sid not in set(ids)
    ],
    "retainedAuthoredModules": strict["retainedAuthoredModules"],
    "records": records,
  }
  write(GEO / "public-artwork-accounting-v326-source.json.gz", source)
  print(
    {
      k: source[k]
      for k in [
        "unionCount",
        "strictHistoricCount",
        "tourismArtworkCount",
        "additionalSourceIdentityCount",
        "statusCounts",
      ]
    },
    flush=True,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--reuse-existing",
    action="store_true",
    help="Use already-extracted complete query records after verifying their full PBF hash",
  )
  build(parser.parse_args().reuse_existing)
