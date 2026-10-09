"""Step 10: retain bounded Panorama source evidence and documented display fits."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_spree_recognition_source import extract_parent, part_profile
from shapely.geometry import Point, Polygon


def build_source(root: Path) -> dict[str, Any]:
  """Keep the exact retained OSM owner and complete matching official entrance."""
  row = gpd.read_file(
    root / "geo_data/regierungsviertel/osm_context_buildings.gpkg",
    where="building_id='OSM-way-235493631'",
  ).iloc[0]
  ring = [
    [round(x - 389500, 3), round(5820000 - y, 3)]
    for x, y in row.geometry.geoms[0].exterior.coords[:-1]
  ]
  arc = np.array(ring[:20])
  # Fit only the mapped rotunda arc, retaining each original source point below.
  cx, cz, k = np.linalg.lstsq(
    np.column_stack((2 * arc[:, 0], 2 * arc[:, 1], np.ones(len(arc)))),
    np.sum(arc**2, axis=1),
    rcond=None,
  )[0]
  radius = float(np.sqrt(k + cx * cx + cz * cz))
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5820.zip"
  entrance = part_profile(extract_parent(archive, "DEBE00YY2O700027"), True)
  prisms = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  previous = next(p for p in prisms["buildings"] if p["id"] == "35493631")
  old_ring = Polygon([(x / 10, z / 10) for x, z in previous["ring"]])
  native_path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  native = json.loads(native_path.read_text())
  columns = []
  for row_index, row in enumerate(native["building_rows"]):
    z = (native["grid"]["min_z_idx"] + row_index + 0.5) * 4
    if not -214 < z < -138:
      continue
    for start, count, bottom, top, _ in row:
      if top - bottom != 120:
        continue
      for offset in range(start, start + count):
        x = (native["grid"]["min_x_idx"] + offset + 0.5) * 4
        if old_ring.covers(Point(x, z)):
          columns.append([x, z, bottom / 10, top / 10])
  return {
    "schema_version": 1,
    "version": "1.0.102",
    "osm_key": "way/235493631",
    "osm_url": "https://www.openstreetmap.org/way/235493631",
    "osm_license": "ODbL-1.0",
    "ring": ring,
    "previous_display_prism": previous,
    "native_replacement_columns": columns,
    "native_receipt": {
      "source_sha256": hashlib.sha256(native_path.read_bytes()).hexdigest(),
      "columns": len(columns),
      "columns_schema": ["world_x", "world_z", "bottom_y", "top_y"],
      "selection": "Exact existing columns with centre inside old OSM owner and 12m grid-quantized height of the prior9m fallback. All three exterior8m columns retained.",
    },
    "rotunda_fit": {
      "centre": [round(float(cx), 6), round(float(cz), 6)],
      "radius_m": round(radius, 6),
      "source_arc_vertex_count": 21,
      "max_residual_m": round(
        float(np.max(np.abs(np.linalg.norm(arc - [cx, cz], axis=1) - radius))),
        6,
      ),
      "status": "Least-squares fit to mapped arc; original arc vertices retained",
    },
    "published_dimensions": {
      "rotunda_diameter_m": 36,
      "rotunda_height_m": 32.5,
      "hall_length_m": 108,
      "hall_width_m": 14.5,
      "hall_height_m": 9.5,
      "url": "https://www.asisi.de/fileadmin/Medien/4_Presse/3_Basisinformationen/Pergamonmuseum_Panorama_Fact-Sheet_2021.pdf",
    },
    "official_entrance": entrance,
    "official_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip",
    "official_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "official_license": "dl-de/zero-2-0",
    "overlap_audit": [
      {
        "id": "DEBE01YYK00008tx",
        "overlap_m2": 0.197924,
        "action": "retain unrelated neighbour",
      },
      {
        "id": "DEBE01YYK0000EC2",
        "overlap_m2": 0.032029,
        "action": "retain unrelated neighbour",
      },
      {
        "id": "DEBE00YY2O700027",
        "overlap_m2": 88.701715,
        "action": "retain complete entrance sheets; articulate source envelope as glazed open portico",
      },
    ],
    "display_estimates": "Existing terrain datum 4.9m; hall/rotunda heights published above that datum. Flat roof, cladding seams, entry recess, stairs, windows and material colours are reference-guided display subdivisions, not surveyed details. No panorama artwork is reproduced.",
  }


def main() -> int:
  """Write the deterministic small source record."""
  root = Path(__file__).resolve().parents[1]
  output = root / "src/app/src/pergamonPanoramaV202Source.json"
  output.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {output.name}: {output.stat().st_size} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
