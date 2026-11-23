"""Build the Hermannplatz paving and the mapped fittings along Neukölln's Weserstraße.

Input coordinates use the existing city grid. The square's own rings, current
entrances and pits keep the paved surface open. Heights for these Ringbahn
tiles use the displayed ground rather than an absolute geographic elevation.
"""
from collections import Counter, defaultdict
from pathlib import Path
import gzip
import json
import math

import shapely as sh
from shapely.geometry import Point, Polygon, LineString, box, shape


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/weserstrasse-hermannplatz-v378-source.json.gz"
OUT = ROOT / "src/app/src/data"
TILE = 512
CELL = 0.5
COLORS = {"setts": 0xaaa097, "mosaic": 0xb9b0a3, "slabs": 0xb7b2a8,
          "pavers": 0xad9f91, "island": 0xa79f92, "cycle": 0x927568}


def components(geom, kind):
    if geom.is_empty:
        return
    if geom.geom_type == kind:
        yield geom
    elif hasattr(geom, "geoms"):
        for part in geom.geoms:
            yield from components(part, kind)


def tile_key(x, z):
    return f"ring182-{math.floor(x / TILE)}_{math.floor(z / TILE)}"


def native_rows(polygon):
    """Use only complete half-metre cells, so a span never closes a source hole."""
    x0, z0, x1, z1 = polygon.bounds
    result = []
    for iz in range(math.floor(z0 / CELL), math.ceil(z1 / CELL)):
        z = iz * CELL
        strips = polygon.intersection(box(x0 - 1, z, x1 + 1, z + CELL))
        for part in components(strips, "Polygon"):
            left, _, right, _ = part.bounds
            start = None
            for ix in range(math.ceil(left / CELL), math.floor(right / CELL) + 1):
                x = ix * CELL
                inside = x + CELL <= right + 1e-7 and polygon.covers(box(x,z,x+CELL,z+CELL))
                if inside and start is None:
                    start = ix
                if not inside and start is not None:
                    result.append([start * CELL, z, ix - start])
                    start = None
    return result


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def build():
    data = json.loads(gzip.decompress(SOURCE.read_bytes()))
    axes = [shape(a["geometry"]) for a in data["axes"] if a["geometry"]["type"] == "LineString"]
    square = shape(next(a["geometry"] for a in data["axes"] if a["tags"].get("place") == "square"))
    scope = sh.union_all(axes).buffer(15).union(square.buffer(3))
    objects = [(o, shape(o["geometry"])) for o in data["objects"]]
    crossings = [g for o,g in objects if o["tags"].get("footway") == "crossing" and isinstance(g, LineString)]
    crossing_index = sh.STRtree(crossings)
    pits = [shape(f["geometry"]) for f in data["surveyFeatures"] if f["id"].startswith("bn_baumscheibe")]
    steps = [g.buffer(.5 * float(o["tags"].get("width","2.4"))) for o,g in objects
             if o["tags"].get("highway")=="steps" and isinstance(g,LineString)]
    sources = defaultdict(set)
    tiles = defaultdict(lambda: {"surfaces": [], "edges": [], "points": []})
    area = Counter()
    def surf(geom, style, source):
        for sub in components(geom,"Polygon"):
            x0,z0,x1,z1 = sub.bounds
            for ix in range(math.floor(x0/TILE),math.floor(x1/TILE)+1):
                for iz in range(math.floor(z0/TILE),math.floor(z1/TILE)+1):
                    for p in components(sub.intersection(box(ix*TILE,iz*TILE,(ix+1)*TILE,(iz+1)*TILE)), "Polygon"):
                        if p.area < .06:
                            continue
                        drawn = []
                        for tri in sh.constrained_delaunay_triangles(p).geoms:
                            coords = list(tri.exterior.coords)[:3]
                            rounded = [round(v * 100) for point in coords for v in point]
                            ax,az,bx,bz,cx,cz = rounded
                            if (bx-ax)*(cz-az) != (bz-az)*(cx-ax):
                                drawn.extend(v / 100 for v in rounded)
                        if not drawn:
                            continue
                        record = {"kind":style,"triangles":drawn,"blocks":native_rows(p)}
                        tiles[f"ring182-{ix}_{iz}"]["surfaces"].append(record)
                        sources[style].add(source)
                        area[style] += p.area
    valid_square = square.difference(sh.union_all(pits + steps))
    # The paving survey predates the cycle-street project. Use it only on
    # the independently mapped pedestrian square, never across a new junction.
    for survey in data["surveyFeatures"]:
        style={"04":"mosaic","08":"slabs","06":"pavers","07":"pavers"}.get(survey["material"])
        if style:
            geom=valid_square.intersection(shape(survey["geometry"]))
            surf(geom,style,survey["id"])
            valid_square=valid_square.difference(geom)
    surf(valid_square,"setts","relation/6888246")
    for o,g in objects:
        t=o["tags"]
        if t.get("tunnel")=="yes" or t.get("indoor")=="yes":
            continue
        if g.geom_type == "LineString":
            surface=t.get("area:highway")
            if surface in ("cycleway","traffic_island") and g.is_ring:
                p=Polygon(g)
                if p.is_valid:
                    # Keep junction islands whole (clipping the circle to the
                    # corridor would fabricate a kerb ending on a road).
                    if p.area < 500 and scope.covers(p.representative_point()):
                        if surface == "traffic_island": surf(p,"island",o["id"])
                        elif t.get("surface") in ("paving_stones","sett"): surf(p,"pavers",o["id"])
                continue
            edge=t.get("barrier")
            if edge not in ("kerb","hedge") or t.get("kerb") in ("no","flush","rolled"):
                continue
            for seg in components(g.intersection(scope),"LineString"):
                if seg.length < .25: continue
                x0,z0,x1,z1=seg.bounds
                for ix in range(math.floor(x0/TILE), math.floor(x1/TILE)+1):
                    for iz in range(math.floor(z0/TILE), math.floor(z1/TILE)+1):
                        bounds=box(ix*TILE,iz*TILE,(ix+1)*TILE,(iz+1)*TILE)
                        for line in components(seg.intersection(bounds),"LineString"):
                            kind="lowered" if edge=="kerb" and t.get("kerb")=="lowered" else edge
                            tiles[f"ring182-{ix}_{iz}"]["edges"].append([kind, [[round(x,2),round(z,2)] for x,z in line.coords]])
                            sources[kind].add(o["id"])
        elif g.geom_type=="Point" and scope.covers(g):
            x,z=g.coords[0]
            if t.get("barrier")=="bollard":
                kind = "removable" if t.get("bollard")=="removable" else "bollard"
                row = [kind,x,z,0]
            elif t.get("barrier")=="kerb" and t.get("tactile_paving")=="yes" and crossings:
                axis=crossings[int(crossing_index.nearest(g))]
                if axis.distance(g)>1.2:continue
                u=axis.project(g)
                a,b=axis.interpolate(max(0,u-1)),axis.interpolate(min(axis.length,u+1))
                angle=round(math.atan2(b.y-a.y,b.x-a.x),4)
                kind="tactile";row=[kind,x,z,angle]
            else:continue
            tiles[tile_key(x,z)]["points"].append(row)
            sources[kind].add(o["id"])
    for tile,d in sorted(tiles.items()):
        write(OUT/f"neukoellnStreetV378-{tile}.json",d)
    write(OUT/"neukoellnStreetHostsV378.json",sorted(tiles))
    report={"tiles":sorted(tiles),"sourceCounts":{s:len(ids) for s,ids in sorted(sources.items())},
            "squareHoles":sum(len(poly.interiors) for poly in square.geoms),"areaM2":{k:round(v,2) for k,v in area.items()},
            "sourceIds":{s:sorted(ids) for s,ids in sorted(sources.items())}}
    write(ROOT/"geo_data/regierungsviertel/neukoelln-street-v378-receipt.json",report)
    print(report["sourceCounts"],report["areaM2"],flush=True)


if __name__=="__main__":
    build()
