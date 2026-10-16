"""Step 10: complete, source-bound town-hall shells and bounded walking support.

No original packet changes. Old bodies may yield only through independently
replayed ownership receipts; dedicated Steglitz/Köpenick and fallback owners stay.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_breitscheid_towers_v161 import triangles_for
from build_steglitz_v182 import native_blocks
from build_townhall_source_v227 import DATA, GEO, ROOT, SOURCE, digest, read, write


def recipes() -> dict[str, tuple[int, int]]:
  """Reuse the source-referenced recognition palette, with mapped tags first."""
  text = (ROOT / "src/app/src/districtTownhallProfileV227.ts").read_text()
  pattern = r'\s*([\w-]+|"[\w-]+"):\s*recipe\("[\w-]+",\s*(0x[\da-f]+),\s*(0x[\da-f]+)'
  return {
    k.strip('"'): (int(w, 16), int(r, 16)) for k, w, r in re.findall(pattern, text)
  }


def color_tag(value: str | None, fallback: int) -> int:
  """Honor actual mapped color tags, leaving missing material explicit."""
  named = {
    "red": 0x994E3C,
    "brown": 0x906D50,
    "white": 0xE3E1D5,
    "grey": 0x999C96,
    "gray": 0x999C96,
    "yellow": 0xCCB77E,
    "beige": 0xC4B99E,
    "black": 0x40494B,
  }
  if value in named:
    return named[value]
  if value and re.fullmatch(r"#[0-9a-fA-F]{6}", value):
    return int(value[1:], 16)
  return fallback


def needs_shell(parent: dict[str, Any], approved: set[str]) -> bool:
  """Replace coarse receipts only when every original measured sheet is present."""
  family = parent["existingOwnership"]["family"]
  return family in {"missing", "core-preserved"} or (
    family == "surrounding-city" and parent["id"] in approved
  )


def pads_for(
  site: dict[str, Any], parents: list[dict[str, Any]]
) -> list[dict[str, Any]]:
  """Small outline-following support only for previously absent peripheral halls."""
  missing = [p for p in parents if p["existingOwnership"]["family"] == "missing"]
  if not missing:
    return []
  geometry = unary_union(
    [Polygon(part["ring"], part["holes"]) for p in missing for part in p["parts"]]
  )
  geometry = geometry.buffer(2.0, join_style="mitre")
  polygons = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
  return [
    {
      "ring": [[round(x, 3), round(z, 3)] for x, z in list(p.exterior.coords)[:-1]],
      "holes": [
        [[round(x, 3), round(z, 3)] for x, z in list(r.coords)[:-1]]
        for r in p.interiors
      ],
      "low": -2.0,
      "high": 3.0,
      "estimate": "Bounded two-metre display support, not surveyed paving",
    }
    for p in polygons
  ]


def build() -> None:
  """Compile complete source sheets and separate native skins per site for culling."""
  source = read(SOURCE)
  receipt = read(DATA / "townhallV227Ownership.json")
  assert receipt["sourceSha256"] == digest(SOURCE), (
    "Rebuild exact ownership after source changes"
  )
  approved = set(receipt["replacementParents"])
  palette = recipes()
  drawn_sites, native_sites, nav_sites, evidence = [], [], [], []
  for site in source["sites"]:
    parents = [p for p in site["parents"] if needs_shell(p, approved)]
    if not parents:
      continue
    wall, roof = palette[site["key"]]
    surfaces, navigation, roof_triangles = [], [], []
    for parent in parents:
      offset = parent["existingOwnership"]["rigidYOffset"]
      tags = parent.get("tags", {})
      # The independently identified 1966 tower/podium is a modern light block,
      # unlike Wedding's adjacent brick former hall. Source color still wins.
      modern_wedding = parent["id"] == "DEBE01YYK00040vj"
      wall_color = color_tag(
        tags.get("building:colour"), 0xD2D3C9 if modern_wedding else wall
      )
      roof_color = color_tag(
        tags.get("roof:colour"), 0x707B7D if modern_wedding else roof
      )
      for part in parent["parts"]:
        navigation.append(
          {
            "id": part["id"],
            "owner": parent["id"],
            "ring": part["ring"],
            "holes": part["holes"],
            "low": round(part["ground_y_m"] + offset, 3),
            "high": round(part["top_y_m"] + offset, 3),
          }
        )
        for surface in part["surfaces"]:
          rings = [
            [[x, round(y + offset, 3), z] for x, y, z in ring]
            for ring in surface["rings"]
          ]
          triangles = triangles_for(rings)
          if not triangles:
            continue
          surfaces.append(
            {
              "color": roof_color if surface["kind"] == "RoofSurface" else wall_color,
              "triangles": triangles,
            }
          )
          if surface["kind"] == "RoofSurface":
            roof_triangles.extend(triangles)
    pads = pads_for(site, parents)
    for pad in pads:
      rings = [
        [[x, pad["high"], z] for x, z in ring] for ring in [pad["ring"], *pad["holes"]]
      ]
      surfaces.append({"color": 0xADA99C, "triangles": triangles_for(rings)})
      for ring in [pad["ring"], *pad["holes"]]:
        for a, b in zip(ring, [*ring[1:], ring[0]]):
          surfaces.append(
            {
              "color": 0x8B887D,
              "triangles": triangles_for(
                [
                  [
                    [a[0], pad["low"], a[1]],
                    [b[0], pad["low"], b[1]],
                    [b[0], pad["high"], b[1]],
                    [a[0], pad["high"], a[1]],
                  ]
                ]
              ),
            }
          )
    print(site["key"], len(surfaces), "sheets; native skin", flush=True)
    blocks = native_blocks({"surfaces": surfaces, "boxes": [], "rods": []})
    ids = [p["id"] for p in parents]
    drawn_sites.append(
      {"key": site["key"], "name": site["name"], "owners": ids, "surfaces": surfaces}
    )
    native_sites.append(
      {"key": site["key"], "name": site["name"], "owners": ids, "blocks": blocks}
    )
    bounds = unary_union(
      [
        shape(site["worldFootprint"]),
        *[Polygon(p["ring"], p["holes"]) for p in navigation],
        *[Polygon(p["ring"], p["holes"]) for p in pads],
      ]
    ).bounds
    nav_sites.append(
      {
        "key": site["key"],
        "bounds": list(bounds),
        "owners": navigation,
        "roofTriangles": roof_triangles,
        "pads": pads,
      }
    )
    evidence.append(
      {
        "key": site["key"],
        "owners": ids,
        "sourceParts": len(navigation),
        "triangles": sum(len(s["triangles"]) for s in surfaces),
        "nativeSurfaceRuns": len(blocks),
        "supportPolygons": len(pads),
      }
    )
  write(DATA / "townhallV227Envelopes.json", {"sites": drawn_sites})
  write(DATA / "townhallV227Native.json", {"sites": native_sites})
  write(DATA / "townhallV227Navigation.json", {"sites": nav_sites})
  write(
    GEO / "townhall-envelopes-v227-evidence.json",
    {
      "schemaVersion": 1,
      "sourceSha256": digest(SOURCE),
      "sites": evidence,
      "policy": "Complete original sheets at rigid existing terrain offsets. Existing dedicated source bodies and unmeasured fallback bodies preserved. New OSM envelopes clearly estimated; no speculative towers. Exact prior triangle/core receipts required before transfer. Two-metre support apron is a bounded display estimate.",
    },
  )
  print(evidence, flush=True)


if __name__ == "__main__":
  build()
