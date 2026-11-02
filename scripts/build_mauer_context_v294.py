"""Source-only Mauerstraße/Niederkirchnerstraße façade companion evidence."""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import pyogrio
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, mapping

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"


def build() -> None:
  source_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = json.loads(source_path.read_bytes())["buildings"]
  osm_path = GEO / "raw/outer-v159/candidate.gpkg"
  features = pyogrio.read_dataframe(
    osm_path,
    layer="multipolygons",
    where="osm_way_id IN ('48118905','1056820805') OR osm_id IN ('280070','318560')",
  ).to_crs(25833)
  result = []
  for _, row in features.iterrows():
    key = (
      str(row.osm_way_id) if str(row.osm_way_id) != "nan" else "relation/" + row.osm_id
    )
    poly = affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
    selected = [
      p
      for p in prisms
      if poly.buffer(0.3).covers(
        Polygon([[x / 10, z / 10] for x, z in p["ring"]]).representative_point()
      )
    ]
    assert selected
    result.append(
      dict(
        key=key,
        name=str(row["name"]),
        tags=str(row.other_tags),
        geometry=mapping(poly),
        originalPrisms=selected,
      )
    )
  assert len(result) == 4
  result.sort(key=lambda r: r["key"])
  body = dict(
    schemaVersion=1,
    step=10,
    date="2026-11-02",
    buildings=result,
    policy="Facade-only additive relief follows exact retained source edges/heights. All original bodies, roofs, holes, entrances, ground/courtyard geometry and source assets remain. Small window sections, brick joints, steel sections and cantilever bands are reference-based display estimates; no photographic pixels.",
    inputs={
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [source_path, osm_path]
    },
    references=[
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030046",
      "https://www.deutsche-kinemathek.de/de/kinemathek/unser-neues-zwischenquartier",
      "https://industriekultur.berlin/ort/e-werk-berlin/",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030043",
      "https://www.bundesfinanzministerium.de/Web/DE/Ministerium/Geschichte/geschichte.html",
      "https://www.berlinerfestspiele.de/gropius-bau/ueber-uns/ueber-den-gropius-bau",
      "https://www.topographie.de/ueber-den-ort/geschichte-nach-1945",
    ],
    visualReferences=[
      dict(
        url="https://www.deutsche-kinemathek.de/de/kinemathek/unser-neues-zwischenquartier",
        author="Andreas Nenninger",
        use="Reference-only current E-Werk courtyard photograph; no redistribution licence asserted",
      ),
      dict(
        url="https://industriekultur.berlin/wp-content/uploads/ewerk_c_Andreas-Muhs-1024x683.jpg",
        author="Andreas Muhs",
        use="Reference-only E-Werk courtyard photograph; no image pixels bundled",
      ),
    ],
  )
  raw = (json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  (GEO / "mauer-context-v294-source.json.gz").write_bytes(gzip.compress(raw, mtime=0))
  runtime = {
    "buildings": [
      dict(key=r["key"], originalPrisms=r["originalPrisms"]) for r in result
    ]
  }
  (ROOT / "src/app/src/data/mauerContextV294.json").write_text(
    json.dumps(runtime, separators=(",", ":")) + "\n"
  )
  print([(r["key"], len(r["originalPrisms"])) for r in result])


if __name__ == "__main__":
  build()
