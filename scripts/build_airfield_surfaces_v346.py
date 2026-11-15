"""Measured current Tegel apron coverage and Tempelhof concrete-apron repair."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_surrounding_outlines as outer
from build_kladow_airfield_v346 import (
  baseline_manifest,
  digest,
  packed_split,
  read,
  write,
)
from build_rixdorf_v304 import fingerprint

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/airfields-v346"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
KIND = "airfield-surfaces-v346"


def footprints(records, site):
  result = []
  for r in records:
    if r["site"] != site:
      continue
    t = r["tags"]
    kind = t.get("aeroway") or t.get("disused:aeroway") or t.get("abandoned:aeroway")
    g = shape(r["geometry"])
    if g.geom_type == "LineString":
      if kind == "apron" and g.is_ring:
        g = Polygon(g.coords)
      elif kind == "taxiway":
        g = g.buffer(
          float(t.get("width", 18)) / 2, cap_style="flat", join_style="round"
        )
      else:
        continue
    if kind not in {"apron", "taxiway"}:
      continue
    result.append(
      dict(
        id=r["id"],
        kind=kind,
        geometry=shapely.make_valid(g),
        widthSource="OSM width"
        if "width" in t
        else "18m taxiway display estimate"
        if kind == "taxiway"
        else "exact mapped area",
      )
    )
  return result


def new_tegel(records, manifest, output):
  """Only genuinely absent mapped paving; all older field/body owners remain."""
  selected = footprints(records, "tegel")
  retained = unary_union(
    [
      shapely.make_valid(Polygon(q["ring"], q.get("holes", [])))
      for q in manifest["footprint"]
    ]
  )
  original = read(GEO / "airports-v194-source.json")
  obstacles = []
  for f in original["features"]:
    if f["site"] != "tegel":
      continue
    g = shape(f["geometry"])
    if g.geom_type == "LineString":
      obstacles.append(g.buffer(float(f["tags"]["width"]) / 2, cap_style="flat"))
    elif f["tags"].get("building"):
      obstacles.append(g)
  scope = (
    unary_union([q["geometry"] for q in selected])
    .difference(retained)
    .difference(unary_union(obstacles))
  )
  output.mkdir(parents=True, exist_ok=True)
  descriptors = []
  minx, minz, maxx, maxz = scope.bounds
  for ix in range(math.floor(minx / 512), math.ceil(maxx / 512)):
    for iz in range(math.floor(minz / 512), math.ceil(maxz / 512)):
      tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
      ground = scope.intersection(tile)
      if ground.area < 0.01:
        continue
      name = f"tegel346-{ix}_{iz}"
      entry = dict(id=name, bounds=list(tile.bounds))
      for native in (False, True):
        mode = "minecraft" if native else "drawn"
        # The independent Native horizontal plates follow a 2m stair boundary.
        domain = outer.native_polygon(ground).intersection(ground) if native else ground
        mesh = outer.PackedMesh(tile.bounds[0], tile.bounds[1])
        mesh.surface(domain, 3, (153, 155, 149))
        payload = dict(
          schemaVersion=1,
          id=name,
          origin=[tile.bounds[0], -10, tile.bounds[1]],
          meshes=[mesh.payload(KIND)],
          nav=dict(
            ground=outer.navigation_polygons(domain, tile.bounds[0], tile.bounds[1]),
            roads=outer.navigation_polygons(domain, tile.bounds[0], tile.bounds[1]),
            water=[],
            buildings=[],
            groundY=3,
          ),
        )
        chunks = packed_split(payload)
        if len(chunks) != 1:
          raise ValueError("Tegel paving must remain within a single bounded packet")
        raw, packed = chunks[0]
        filename = f"{name}.{mode}.json.gz"
        (output / filename).write_bytes(packed)
        entry[mode] = dict(
          url=filename,
          encoding="gzip",
          bytes=len(packed),
          decodedBytes=len(raw),
          sha256=hashlib.sha256(packed).hexdigest(),
        )
      descriptors.append(entry)
  supplement = dict(
    schemaVersion=1,
    chunks=descriptors,
    footprint=outer.navigation_polygons(scope, 0, 0),
    bounds=list(scope.bounds),
    groundY=3,
    waterY=-1.15,
    source=dict(
      policy="Current exact Tegel apron polygons and mapped disused taxiways only; all retained manifest ground, original v194 terminal bodies and five runway sections subtracted. Untagged taxiway width18m is an explicit display estimate. No future campus or active airport operation asserted.",
      sourceSha256=hashlib.sha256(
        json.dumps(records, separators=(",", ":")).encode()
      ).hexdigest(),
      addedAreaM2=scope.area,
    ),
  )
  write(GEO / "tegel-airfield-v346-manifest.json", supplement)
  return supplement


def prepared(paths):
  """Match all existing quarter transactions before the final apron recipe."""
  code = r"""
import {gunzipSync} from 'node:zlib';
import {basename} from 'node:path';
import {prepareSurroundingQuarterPredecessorV303 as prepare} from './src/SurroundingCityGeometry.ts';
import {loadSourceQuarterRecipesV309 as load} from './src/SourceQuarterCatalogueV309.ts';
import {captureSourceQuarterPacketV303 as capture,prepareSourceQuarterPacketV303 as apply} from './src/SourceQuarterPacketV303.ts';
import {captureNeighbourhoodPacketV300 as captureSimple} from './src/NeighbourhoodPacketV300.ts';
const done=g=>{let r=g.next();while(!r.done)r=g.next();return r.value};
const ownership={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h};
const out={};for(const path of Bun.argv.slice(1)){const raw=await Bun.file(path).bytes(),p=JSON.parse(new TextDecoder().decode(gunzipSync(raw))),id=basename(path).split('.')[0],native=path.includes('.minecraft.');
const tickets=[];for(const e of await load(id,native)){if(['airfield-surfaces-v346','public-green-v329','park-paths-v329','zebra-crossings-v329'].includes(e.kind))continue;const plan=e.source.packets[`${native?'minecraft':'drawn'}:${id}`];const t=done(plan.preparedRecords?capture(p,id,native,true,e.source,e.kind,e.requiredReplacement):captureSimple(p,id,native,true,e.source,e.kind));if(t)tickets.push(t);}
let n=done(prepare(p,id,native,ownership));for(const t of tickets)n=done(apply(n,t));out[path]={prepared:n,navGuard:fnv(JSON.stringify(p.nav)),lineGuard:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null,preparedNavGuard:fnv(JSON.stringify(n.nav)),preparedLineGuard:n.lines?fnv(n.lines.positions+(n.lines.colors??'')):null};}process.stdout.write(JSON.stringify(out));
"""
  result = subprocess.run(
    ["bun", "-e", code, *map(str, paths)],
    cwd=ROOT / "src/app",
    capture_output=True,
    text=True,
    check=True,
  )
  return json.loads(result.stdout)


class LinearMesh(outer.PackedMesh):
  """Retain pre-existing linear u8 colours exactly in clipped complements."""

  def payload(self, kind):
    value = super().payload(kind)
    if value:
      value["colors"] = outer.encode(
        np.array(list(self.vertices), dtype="u2")[:, 3:].astype("u1")
      )
    return value


def tempelhof(records, manifest):
  selected = footprints(records, "tempelhof")
  apron = unary_union([q["geometry"] for q in selected if q["kind"] == "apron"])
  descriptors = [
    c
    for c in manifest["chunks"]
    if not c.get("detailCompanionOf") and box(*c["bounds"]).intersects(apron)
  ]
  paths = [PUBLIC / c[m]["url"] for c in descriptors for m in ("drawn", "minecraft")]
  inputs = prepared(paths)
  plans, proofs = {}, []
  concrete = tuple(
    int(c) for c in outer.linear_rgb_bytes(np.array([[158, 157, 148]], dtype="u1"))[0]
  )
  for d in descriptors:
    for mode in ("drawn", "minecraft"):
      path = PUBLIC / d[mode]["url"]
      raw = read(path)
      data = inputs[str(path)]
      packet = data["prepared"]
      domain = apron.intersection(box(*d["bounds"]))
      if mode == "minecraft":
        domain = outer.native_polygon(domain)
      mesh = LinearMesh(packet["origin"][0], packet["origin"][2])
      retired, before_area, outside_area, inside_area = [], 0.0, 0.0, 0.0
      for mi, old in enumerate(packet["meshes"]):
        if old["kind"] != "city":
          continue
        a = (
          np.frombuffer(base64.b64decode(old["positions"]), "<u2").reshape(-1, 3) / 100
          + packet["origin"]
        )
        colors = np.frombuffer(base64.b64decode(old["colors"]), "u1").reshape(-1, 3)
        indices = np.frombuffer(base64.b64decode(old["indices"]), "<u4").reshape(-1, 3)
        remove = []
        for ti, ids in enumerate(indices):
          xyz = a[ids]
          # Existing buildings, roads, footways, runways and prior DGM relief
          # remain separate owners. Only flat basic land becomes apron paving.
          if np.ptp(xyz[:, 1]) > 0.001 or not (2.999 <= xyz[0, 1] <= 3.015):
            continue
          polygon = Polygon(xyz[:, [0, 2]])
          if polygon.area < 0.001 or not polygon.intersects(domain):
            continue
          inside = polygon.intersection(domain)
          if inside.area < 0.001:
            continue
          outside = polygon.difference(domain)
          y = float(xyz[0, 1])
          mesh.surface(outside, y, tuple(int(c) for c in colors[ids[0]]))
          mesh.surface(inside, y, concrete)
          remove.append(ti)
          before_area += polygon.area
          inside_area += inside.area
          outside_area += outside.area
        if remove:
          retired.append(dict(mesh=mi, triangles=remove))
      append = mesh.payload(KIND)
      if not append:
        continue
      key = f"{mode}:{d['id']}"
      plans[key] = dict(
        origin=raw["origin"],
        records=[
          dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
          for i, m in enumerate(raw["meshes"])
        ],
        preparedRecords=[
          dict(mesh=i, kind=m["kind"], fingerprint=fingerprint(m))
          for i, m in enumerate(packet["meshes"])
        ],
        navGuard=data["navGuard"],
        lineGuard=data["lineGuard"],
        preparedNavGuard=data["preparedNavGuard"],
        preparedLineGuard=data["preparedLineGuard"],
        append=append,
        appendFingerprint=fingerprint(append),
        retire=retired,
        retireLines=[],
        retireNav=[],
        appendNav=[],
        owners=["OSM-way-181407909:current-concrete-apron"],
      )
      proofs.append(
        dict(
          key=key,
          sourceSha256=digest(path),
          retiredTriangles=sum(len(q["triangles"]) for q in retired),
          originalAreaM2=before_area,
          outsideAreaM2=outside_area,
          apronAreaM2=inside_area,
          areaDifferenceM2=abs(before_area - outside_area - inside_area),
        )
      )
  result = dict(schemaVersion=1, keys=sorted(plans), packets=plans)
  write(DATA / "airfieldSurfacesV346.json", result)
  write(DATA / "airfieldSurfacesV346Index.json", dict(keys=result["keys"]))
  return result, proofs


def build(output):
  frozen = GEO / "airfield-surfaces-v346-source.json.gz"
  records = read(frozen)["records"] if frozen.exists() else read(RAW / "records.json")
  manifest, _ = baseline_manifest()
  supplement = new_tegel(records, manifest, output)
  recipe, proof = tempelhof(records, manifest)
  source = dict(
    schemaVersion=1,
    baseline="daa0c5e3",
    osm=dict(
      url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
      sha256=digest(GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"),
      license="ODbL-1.0",
    ),
    records=records,
    references=[
      "https://www.thf-berlin.de/vermietung/eventlocation/vorfeld",
      "https://www.berlin.de/ba-reinickendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1697743.php",
      "https://www.tempelhoferfeld.de/service-infos/besuch-planen/",
    ],
    policy="No future TXL campus or present airport operation rendered. Existing THF DGM relief, buildings, roads, mapped runways, access routes, historical owners and all original outside ground complements remain exact. The new apron keeps the same physical height and navigation, replacing only its wrong basic ground material. Closed OSM apron rings are interpreted as areas; untagged taxiway widths remain estimates.",
  )
  write(GEO / "airfield-surfaces-v346-source.json.gz", source)
  write(
    GEO / "airfield-surfaces-v346-evidence.json",
    dict(
      tegelNewAreaM2=supplement["source"]["addedAreaM2"],
      tegelPackets=len(supplement["chunks"]),
      tegelPacketBytes=sum(
        c[m]["bytes"] for c in supplement["chunks"] for m in ("drawn", "minecraft")
      ),
      tempelhofKeys=recipe["keys"],
      proof=proof,
    ),
  )
  print(
    "Tegel",
    len(supplement["chunks"]),
    "packets",
    "Tempelhof",
    len(recipe["keys"]),
    "guarded apron repairs",
    flush=True,
  )


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--out", type=Path, required=True)
  build(p.parse_args().out)
