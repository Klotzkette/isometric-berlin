"""Locate distinct visible CWGC headstone tops on Berlin's 2026 true orthophoto.

Usage: python scripts/build_memorials_v378.py --input british.jpg [--check]
The exact WMS request and SHA-256 are recorded in docs/memorials-v378.md.
No photograph or individual grave names enter the viewer.
"""
import argparse
import base64
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, maximum_filter

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/app/src/data/memorialsV378Headstones.json"
SHA = "7bc31c58fd42e855b40954f76f1f273b4a15fa18bb60e66a101b73de250e1c8c"
# Observed search corridors in a 904 x 950 overview. Coordinates never place a
# stone themselves: output only contains local maxima independently verified on
# the 10 cm sampling grid of the original 20 cm WMS, including both distinct lines in back-to-back rows.
BLOCKS = [
    ((72,341),(60,423),(24.7,3.5,24.7,3.3),6),
    ((280,359),(264,468),(24.4,3.4,24.4,2.6),6),
    ((534,409),(523,487),(24.8,3.7,24.7,2.6),6),
    ((266,514),(266,563),(24.3,.4,24.3,.4),6),
    ((524,530),(524,556),(24.6,.4,24.6,.4),6),
    ((266,610),(277,717),(24.5,-1.9,24.6,-1.9),6),
    ((57,643),(69,726),(24.45,-1.7,24.45,-1.8),6),
    ((549,594),(560,679),(24.8,-1.7,24.8,-1.7),5),
    ((284,226),(270,291),(23.5,5.2,23.5,5.3),6),
    ((554,308),(543,358),(24.0,6.7,24.0,6.7),6),
]
ORIGIN = [-10328.25, 947.25]  # true centre of northwestern image pixel, world X/Z


def corridors():
    for top, bottom, delta, count in BLOCKS:
        for i in range(count):
            yield (np.array(top) + i * np.array(delta[:2]),
                   np.array(bottom) + i * np.array(delta[2:]))
    for x, y, u, v in [(182,192,166,263),(206,195,189,274),(230,204,213,276)]:
        yield np.array([x,y]), np.array([u,v])


def rows_in_corridor(points, top, end, scale):
    start = top * scale
    vec = end * scale - start
    length = np.linalg.norm(vec)
    axis = vec / length
    side = np.array([axis[1], -axis[0]])
    along, offset = (points - start) @ axis, (points - start) @ side
    nearby = (along >= 0) & (along < length) & (np.abs(offset) < 11)
    pts, along, offset = points[nearby], along[nearby], offset[nearby]
    candidates = []
    for p, a, o in zip(pts, along, offset):
        d, n = abs(along - a), abs(offset - o)
        if (np.any((n < 2.5) & (d > 5.3) & (d < 8.8)) and
            np.count_nonzero((n < 2.6) & (d > 11) & (d < 22.4)) >= 2):
            candidates.append((tuple(map(int, p)), a, o))
    clusters = []
    for hit in sorted(candidates, key=lambda q: q[2]):
        if not clusters or abs(np.median([q[2] for q in clusters[-1]]) - hit[2]) > 3:
            clusters.append([])
        clusters[-1].append(hit)
    for cluster in clusters:
        runs = []
        for hit in sorted(cluster, key=lambda q: q[1]):
            if not runs or hit[1]-runs[-1][-1][1] > 23 or abs(hit[2]-runs[-1][-1][2]) > 1.9:
                runs.append([])
            if not runs[-1] or hit[1]-runs[-1][-1][1] > 4.9:
                runs[-1].append(hit)
        points_in_row = [h[0] for run in runs if len(run) >= 5 for h in run]
        if points_in_row:
            yield round(math.degrees(math.atan2(axis[0], axis[1])) * 10), points_in_row



def footprint(row):
    ring = row["ring"]
    xs, zs = zip(*ring)
    return min(xs),min(zs),max(xs),max(zs),ring,row["holes"]


def covered(areas, x, z):
    def in_ring(ring):
        inside = False
        a, b = ring[-1]
        for c, d in ring:
            if (b > z) != (d > z) and x < a + (c-a)*(z-b)/(d-b):
                inside = not inside
            a,b = c,d
        return inside
    return any(x0 <= x <= x1 and z0 <= z <= z1 and in_ring(ring)
               and not any(in_ring(hole) for hole in holes)
               for x0,z0,x1,z1,ring,holes in areas)


def navigation(directory, host):
    proofs = []
    for mode in ("drawn","minecraft"):
        packet = host[mode]
        raw = (directory / packet["url"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != packet["sha256"]:
            raise ValueError(f"changed cemetery host: {host['id']} {mode}")
        t = json.loads(gzip.decompress(raw))
        ox,_,oz = t["origin"]
        nav = t["nav"]
        assert nav["groundY"] == 3
        proofs.append((ox,oz,[footprint(r) for r in nav["ground"]],
            [footprint(r) for key in ("roads","water","buildings","bridges") for r in nav[key]]))
    return proofs


def supported(p, proofs):
    px,pz = [base + pixel / 10 for base,pixel in zip(ORIGIN,p)]
    # Conservative enclosing square of a .381 m headstone, including the
    # most rotated source row. Never place a measured marker on a block road.
    for ox,oz,ground,obstacles in proofs:
        for dx,dz in ((0,0),(-.21,-.21),(-.21,.21),(.21,-.21),(.21,.21)):
            x,z = px + dx - ox,pz + dz - oz
            if not covered(ground,x,z) or covered(obstacles,x,z):
                return False
    return True

def compile_data(image):
    if hashlib.sha256(image.read_bytes()).hexdigest() != SHA:
        raise ValueError("unexpected Berlin TrueDOP 2026 image")
    gray = np.array(Image.open(image)).mean(axis=2)
    h, w = gray.shape
    assert (w, h) == (2228,2342)
    light = gaussian_filter(gray, .8)
    peaks = ((light == maximum_filter(light, size=(5,5))) &
             (light - gaussian_filter(gray, 4.5) > 13))
    y, x = np.where(peaks)
    pts = np.column_stack((x,y))
    tiles, seen, proofs = {}, set(), {}
    manifest = json.loads((ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json").read_bytes())
    hosts = {r["id"]:r for r in manifest["chunks"]}
    for top, end in corridors():
        for yaw, row in rows_in_corridor(pts, top, end, np.array([w/904,h/950])):
            by_tile = {}
            for p in row:
                if p in seen:
                    continue
                x,z = [int((base + val / 10) // 512) for base,val in zip(ORIGIN, p)]
                tile_id = f"outer187-{x}_{z}"
                if tile_id not in proofs:
                    proofs[tile_id] = navigation(ROOT / "src/app/public/mesh/surrounding-berlin-v159", hosts[tile_id])
                if supported(p, proofs[tile_id]):
                    seen.add(p)
                    by_tile.setdefault(tile_id, []).append(p)
            for tile_id, subgroup in by_tile.items():
                tile = tiles.setdefault(tile_id, {"id":tile_id,
                    "sha":[hosts[tile_id][mode]["sha256"] for mode in ("drawn","minecraft")],
                    "rows":[]})
                data = bytearray()
                start = prev = subgroup[0]
                for p in subgroup[1:]:
                    dx,dz = (p[i]-prev[i] for i in (0,1))
                    if max(abs(dx),abs(dz)) > 127:
                        tile["rows"].append([yaw,*start,base64.b64encode(data).decode()])
                        data.clear()
                        start = p
                    else:
                        data.extend(struct.pack("bb",dx,dz))
                    prev = p
                tile["rows"].append([yaw,*start,base64.b64encode(data).decode()])
    return {"origin":ORIGIN,"stoneCount":len(seen),"tiles":list(tiles.values())}



def compile_park_plots(survey):
    north = survey["schoenholz"]
    o = north["originWorld"]
    a, b = north["across"], north["along"]
    ox,oy = north["rectifiedOriginUV"]
    scale = north["rectifiedMetresPerPixel"]
    beds = []
    for xs, (y0,y1) in zip(north["outerXPairPerBedRow"],north["outerYPairPerBedRow"],strict=True):
        for (x0,x1),side in [(xs[:2],1),(xs[2:],-1)]:
            u = ox + (x0+x1)*scale/2
            v = oy + (y0+y1)*scale/2
            x,z = [round(o[k] + u*a[k] + v*b[k],3) for k in (0,1)]
            beds.append([x,z,round((x1-x0)*scale,2),round((y1-y0)*scale,2),side])
    east = survey["treptow"]
    a,b = east["axes"]
    ox,oy = east["windowMidpoint"]
    scale = east["localMetresPerPixel"]
    slabs = [[round(origin + scale*((u-ox)*a[k]+(v-oy)*b[k]),3)
              for k,origin in enumerate((x,z))]
             for x,z,u,v in east["localWindowsAsWorldCentreAndRectifiedSlabCentre"]]
    assert len(beds)==16 and len(slabs)==5
    return {"schoenholz":beds,"treptow":slabs}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    evidence = json.loads((ROOT / "geo_data/regierungsviertel/memorials-v378-survey.json").read_bytes())
    for path,data in [(OUTPUT, compile_data(args.input)),(OUTPUT.with_name("memorialsV378Plots.json"),compile_park_plots(evidence))]:
        compiled = json.dumps(data,separators=(",",":")) + "\n"
        if args.check:
            if path.read_text() != compiled:
                raise SystemExit(f"measured positions differ: {path}")
        else:
            path.write_text(compiled)
        print(f"{path.name}: {len(compiled)} bytes")
