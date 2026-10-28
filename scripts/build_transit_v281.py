"""Step 10: retained central tram axes and three actual Oranienburger stairs."""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "transit-v281-source.json"
RAILS = ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
STAIRS = {
  "378658639": "1080586511",
  "378662082": "3820768526",
  "378662084": "3820768527",
}


def digest(path: Path) -> str:
  """Hash retained sources without a second large in-memory copy."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def selected_tracks() -> list[dict]:
  """Whole existing courses only; the previous six detailed tracks stay owned."""
  tracks = json.loads(RAILS.read_bytes())["tram_catenary"]["tracks"]
  previous = json.loads((ROOT / "src/app/src/data/tachelesRailsV270.json").read_bytes())
  old_ids = {t["id"] for t in previous["tracks"]}
  return [
    t
    for t in tracks
    if t["id"] not in old_ids
    and all(-7300 <= x <= 17000 and -15100 <= z <= 1000 for x, z in t["points"])
  ]


def extract() -> None:
  """Bounded read of the existing ODbL snapshot; never fetch or rewrite it."""
  import pyogrio

  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  ids = {t["id"].split("/")[1].split(":")[0] for t in selected_tracks()} | set(STAIRS)
  records = []
  for layer in ["points", "lines"]:
    frame = pyogrio.read_dataframe(
      pbf, layer=layer, bbox=(13.35, 52.515, 13.41, 52.535)
    )
    for row in frame.itertuples():
      identity = str(row.osm_id)
      if identity not in (set(STAIRS.values()) if layer == "points" else ids):
        continue
      other = row.other_tags
      tags = dict(
        re.findall(r'"([^\"]+)"=>"([^\"]*)"', other if isinstance(other, str) else "")
      )
      for key in ["name", "highway", "railway"]:
        value = getattr(row, key, None)
        if isinstance(value, str):
          tags[key] = value
      records.append(
        dict(
          id=("node/" if layer == "points" else "way/") + identity,
          tags=tags,
          coordinates=list(row.geometry.coords),
        )
      )
  SOURCE.write_text(
    json.dumps(
      dict(
        schema=1,
        source="retained Geofabrik berlin-260929.osm.pbf",
        sourceSha256=digest(pbf),
        license="ODbL-1.0",
        records=records,
      ),
      separators=(",", ":"),
    )
    + "\n"
  )


def build() -> tuple[dict, dict]:
  """Retain identities, original courses and counts; mark all fitting estimates."""
  evidence = json.loads(SOURCE.read_bytes())
  records = {r["id"]: r for r in evidence["records"]}
  tracks = selected_tracks()
  excluded = []
  admitted = []
  for track in tracks:
    tags = records[track["id"].split(":")[0]]["tags"]
    assert tags["railway"] == "tram" and tags.get("gauge") == "1435"
    if tags.get("tunnel", "no") != "no" or tags.get("bridge", "no") != "no":
      excluded.append(
        dict(
          id=track["id"], reason="retained bridge/tunnel owner has a separate elevation"
        )
      )
      continue
    admitted.append(track)
  tracks = admitted
  rail = dict(
    schema=1,
    sourceSha256=digest(SOURCE),
    railSha256=digest(RAILS),
    tracks=tracks,
    gaugeM=1.435,
    headWidthM=0.075,
    excluded=excluded,
    estimates="75 mm visible head width; native 0.5 m cardinal treads; actual retained road-height field",
  )
  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  ground = json.loads(GROUND.read_bytes())
  h, grid = ground["ground_height"], ground["grid"]
  # The tram source is owned by the central ground, including tracks outside
  # the old Alt-Mitte mask. Never substitute the surrounding-city DGM there.
  step = ground["cell_m"] * h["stride_cells"]
  origin = [ground["cell_m"] * grid[k] for k in ("min_x_idx", "min_z_idx")]
  coordinates = [p for track in tracks for p in track["points"]]
  lo = [
    math.floor((min(p[i] / 10 for p in coordinates) - origin[i]) / step) - 2
    for i in range(2)
  ]
  hi = [
    math.ceil((max(p[i] / 10 for p in coordinates) - origin[i]) / step) + 2
    for i in range(2)
  ]
  rail["ground"] = dict(
    origin=[origin[i] + lo[i] * step for i in range(2)],
    step=step,
    cols=hi[0] - lo[0] + 1,
    rows=hi[1] - lo[1] + 1,
    heightsDm=[
      h["y_dm"][z * h["cols"] + x]
      for z in range(lo[1], hi[1] + 1)
      for x in range(lo[0], hi[0] + 1)
    ],
  )
  rail["groundSha256"] = digest(GROUND)

  def point(p: list[float]) -> list[float]:
    x, n = transform.transform(*p)
    return [round(x - 389500, 3), round(5820000 - n, 3)]

  def level(p: list[float], smooth: bool) -> float:
    x, z = [
      (p[i] / ground["cell_m"] - grid[k]) / h["stride_cells"]
      for i, k in enumerate(("min_x_idx", "min_z_idx"))
    ]

    def value(a: int, b: int) -> float:
      a, b = max(0, min(h["cols"] - 1, a)), max(0, min(h["rows"] - 1, b))
      return h["y_dm"][b * h["cols"] + a] / 10

    if not smooth:
      return value(math.floor(x), math.floor(z))
    x, z = x - 0.5, z - 0.5
    a, b = math.floor(x), math.floor(z)
    tx, tz = x - a, z - b
    return (value(a, b) * (1 - tx) + value(a + 1, b) * tx) * (1 - tz) + (
      value(a, b + 1) * (1 - tx) + value(a + 1, b + 1) * tx
    ) * tz

  stairs = []
  for way, node in STAIRS.items():
    record, top_node = records[f"way/{way}"], records[f"node/{node}"]
    tags = record["tags"]
    assert tags["highway"] == "steps" and tags["level"] == "-1;0"
    assert top_node["tags"]["railway"] == "subway_entrance"
    top = top_node["coordinates"][0]
    assert math.dist(top, record["coordinates"][-1]) < 1e-8 and tags["incline"] == "up"
    bottom = record["coordinates"][0]
    count = int(tags["step_count"])
    stairs.append(
      dict(
        station="oranienburger-tor",
        name="Oranienburger Tor",
        ref=node,
        osmWay=f"way/{way}",
        osmNode=f"node/{node}",
        top=point(top),
        bottom=point(bottom),
        stepCount=count,
        width=2.3,
        landing=0.4,
        descent=round(count * 0.17, 2),
        surfaceY=round(level(point(top), True) + 0.18, 3),
        nativeSurfaceY=round(level(point(top), False), 3),
        tags=tags,
        entranceTags=top_node["tags"],
      )
    )
  stair = dict(
    schema=1,
    sourceSha256=digest(SOURCE),
    groundSha256=digest(GROUND),
    stairs=stairs,
    estimates="2.3 m clear width, 17 cm risers, 40 cm landing and portal/sign fittings; no inferred accessible ramp or underground continuation",
  )
  return rail, stair


if __name__ == "__main__":
  if "--extract" in sys.argv:
    extract()
  rail, stairs = build()
  for name, data in [("tramRailsV281", rail), ("ubahnEntrancesV281", stairs)]:
    (ROOT / f"src/app/src/data/{name}.json").write_text(
      json.dumps(data, separators=(",", ":")) + "\n"
    )
  print({"tracks": len(rail["tracks"]), "stairs": len(stairs["stairs"])})
