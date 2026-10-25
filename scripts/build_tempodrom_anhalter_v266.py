"""Step 10: bounded Tempodrom / Anhalter evidence and exact owner receipts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
from build_bebelplatz_building_source import extract_parent, part_profile, world_ring
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, mapping

from isometric_berlin.data.fetch_lod2 import NS

ROOT = Path(__file__).resolve().parents[1]
OWNER = "400001p6"


def digest(path: Path) -> str:
  """Hash retained input without making a second copy."""
  with path.open("rb") as handle:
    return hashlib.file_digest(handle, "sha256").hexdigest()


def build(root: Path = ROOT) -> tuple[dict[str, Any], dict[str, Any]]:
  """Keep original sheets; replace the single false solid portico only."""
  base = root / "src/app/public/mesh/regierungsviertel"
  prisms = json.loads((base / "lod2-prisms.json").read_text())["buildings"]
  previous = next(p for p in prisms if p["id"] == OWNER)
  tempodrom = next(p for p in prisms if p["id"] == "-7776056")
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5818.zip"
  part = extract_parent(archive, "DEBE02YY400001p6")
  measured = part_profile(part)
  measured["all_surfaces"] = [
    {
      "kind": child.tag.split("}")[-1],
      "rings": [world_ring(p) for p in child.findall(".//gml:posList", NS)],
    }
    for bound in part.findall("bldg:boundedBy", NS)
    for child in bound
  ]
  osm = (
    gpd.read_file(
      root / "geo_data/regierungsviertel/osm.gpkg",
      layer="pois",
      where="id='27695497'",
    )
    .to_crs(25833)
    .iloc[0]
  )
  osm_ring = affine_transform(osm.geometry, [1, 0, 0, -1, -389500, 5820000])
  polygon = Polygon([(x / 10, z / 10) for x, z in previous["ring"]])
  neighbours = {
    p["id"]: Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    for p in prisms
    if any(6900 < x < 7350 and 16800 < z < 17300 for x, z in p["ring"])
  }
  voxel = json.loads((base / "minecraft-voxels.json").read_text())
  cell = voxel["cell_m"]
  columns, controls = [], []
  for zi, runs in enumerate(voxel["building_rows"]):
    z_index = voxel["grid"]["min_z_idx"] + zi
    z = (z_index + 0.5) * cell
    if not 1690 < z < 1730:
      continue
    for offset, count, low, high, kind in runs:
      first = voxel["grid"]["min_x_idx"] + offset
      for x_index in range(first, first + count):
        x = (x_index + 0.5) * cell
        if not 690 < x < 735:
          continue
        square = box(x - cell / 2, z - cell / 2, x + cell / 2, z + cell / 2)
        if polygon.intersection(square).area < 0.001:
          continue
        foreign = [
          key
          for key, poly in neighbours.items()
          if key != OWNER and poly.intersection(square).area > 0.001
        ]
        row = {"column": [x_index, z_index, low, high, kind], "foreign": foreign}
        (controls if foreign else columns).append(row)
  legacy_path = root / "src/app/src/ExpandedCityDetails.ts"
  legacy = legacy_path.read_text().split("function addAnhalterBahnhof(", 1)[1]
  legacy = (
    "function addAnhalterBahnhof("
    + legacy.split("\nfunction addCharlottenburgerTor", 1)[0]
  )
  centre = list(osm_ring.centroid.coords[0])
  a, b = measured["ring"][4:6]
  direction = [b[0] - a[0], b[1] - a[1]]
  length = sum(v * v for v in direction) ** 0.5
  evidence = {
    "schema": "tempodrom-anhalter-v266-evidence/1",
    "checked": "2026-10-25",
    "sourcePrismSha256": digest(base / "lod2-prisms.json"),
    "sourceVoxelSha256": digest(base / "minecraft-voxels.json"),
    "archiveSha256": digest(archive),
    "archiveUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5818.zip",
    "measuredPortico": measured,
    "previousPrism": previous,
    "retainedTempodromPrism": tempodrom,
    "porticoOsm": {
      "id": "way/27695497",
      "geometry": json.loads(json.dumps(mapping(osm_ring))),
    },
    "exclusiveNativeColumns": columns,
    "retainedForeignNativeColumns": controls,
    "legacyRecipe": legacy,
    "legacyRecipeSha256": hashlib.sha256(legacy.encode()).hexdigest(),
    "replacementPolicy": "Only 400001p6 solid closing walls and its exact exclusive native columns yield after required model construction. Complete measured sloping portico roof is republished. All original sheets remain here. No Tempodrom source geometry yields.",
    "positionConflict": {
      "catalogueXZ": [626.535, 1725.067],
      "mappedPorticoXZ": centre,
      "policy": "Keep the 93-place identity; correct the existing focus override to the mapped ruin.",
    },
    "references": [
      {
        "url": "https://www.gmp.de/en/projects/408/tempodrom-and-liquidrom",
        "author": "gmp; photographs Christian Gahl / Marcus Bredt",
        "referenceImage": "https://www.gmp.de/images/gmp_1178_01_L_2996_01.jpg?w=1000",
        "claim": "37 m tent-like roof, glazed crown; Liquidrom separate dome. Photographs external reference only.",
      },
      {
        "url": "https://www.tempodrom.de/news/im-neuen-glanz_2017-05-02/",
        "author": "Tempodrom; photograph Carolin Belka",
        "claim": "Twelve roof peaks; operator describes a 30 m building. Conflicts with architect's 37 m: model uses 37 m overall above source ground.",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031114",
        "author": "Landesdenkmalamt Berlin",
        "claim": "Three-bay vaulted underpass, surviving rear vestibule wall, yellow brick, sandstone/terracotta, Berolina/Anhaltina and Tag/Nacht sculptures.",
      },
      {
        "url": "https://industriekultur.berlin/ort/anhalter-bahnhof/",
        "author": "Berliner Zentrum Industriekultur; photograph Nico Kupfer",
        "referenceImage": "https://industriekultur.berlin/wp-content/uploads/Anhalter-Bahnhof_Portikus-Nico-Kupfer_bearbeitet-1024x723.jpg",
        "claim": "Current ruin exterior: three open lower arches, round upper openings, broken shoulders, open circular clock crest. External reference only.",
      },
    ],
    "estimates": "Tempodrom roof radius/centre/curvature, glazing, fitting dimensions and material tones are photo-based estimates inside retained OSM podium. Twelve folds are operator-supported; 37 m overall follows gmp despite different operator heights. Portico roof is complete measured LoD2. Arches, rear wall, oculi, sculptural silhouettes and decorative proportions are explicit photo-based estimates; no historical station hall or future Exilmuseum is invented.",
  }
  runtime = {
    "schema": "tempodrom-anhalter-v266/1",
    "portico": {
      "owner": OWNER,
      "centre": centre,
      "direction": [v / length for v in direction],
      "width": length,
      "groundY": 5.2,
      "ring": measured["ring"],
      "roof": [s for s in measured["surfaces"] if s["kind"] == "RoofSurface"],
      "previousPrism": previous,
    },
    "tempodrom": {
      "owner": "-7776056",
      "centre": [622.0, 1940.0],
      "groundY": 5.2,
      "podiumTopY": 14.2,
      "radius": 31.0,
      "peakY": 42.2,
      "folds": 12,
      "retainedPrism": tempodrom,
    },
    "cellM": cell,
    "columns": [row["column"] for row in columns],
    "estimates": evidence["estimates"],
  }
  return evidence, runtime


def main() -> None:
  """Write two small deterministic artifacts from retained inputs."""
  evidence, runtime = build()
  for path, value in [
    ("geo_data/regierungsviertel/tempodrom-anhalter-v266-evidence.json", evidence),
    ("src/app/src/data/tempodromAnhalterV266.json", runtime),
  ]:
    target = ROOT / path
    target.write_text(
      json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(f"{path}: {target.stat().st_size} bytes")


if __name__ == "__main__":
  main()
