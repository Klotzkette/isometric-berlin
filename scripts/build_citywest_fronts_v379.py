"""Bind historical photographed openings to exposed portions of the retained City West prisms."""

import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from shapely import STRtree
from shapely.geometry import Polygon, LineString

ROOT = Path(__file__).resolve().parents[1]
CITY = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/citywest-fronts-v379-evidence.json.gz"
OUTPUT = ROOT / "src/app/src/data/cityWestFrontsV379.json"


def compile_fronts():
    evidence = json.loads(gzip.decompress(EVIDENCE.read_bytes()))
    assert hashlib.sha256(CITY.read_bytes()).hexdigest() == evidence["prismsSha256"]
    shapes, occupants = [], []
    for building in json.loads(CITY.read_bytes())["buildings"]:
        ring = [(x / 10, z / 10) for x, z in building["ring"]]
        if not any(-3400 < x < -1650 and 1050 < z < 2250 for x, z in ring):
            continue
        holes = [[(x / 10, z / 10) for x, z in hole] for hole in building["holes"]]
        shapes.append(Polygon(ring, holes).buffer(0))
        occupants.append((building["id"], building["y0_dm"] / 10,
                          (building["y0_dm"] + building["h_dm"]) / 10))
    index = STRtree(shapes)
    result = defaultdict(list)
    counts = Counter()
    for face in evidence["registered"]:
        owner = face["id"]
        if owner in evidence["protectedOwners"] or face["distance"] > 1.05 or face["coverage"] < .55:
            continue
        a, b = face["a"], face["b"]
        length = math.dist(a, b)
        ux, uz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        nx, nz = face["normal"]
        height, base = face["height"], face["base"]
        cells = []
        for band in face["material"] + face["window"]:
            u0, u1 = [u * length for u in band["x"]]
            y0, y1 = [v * height for v in band["y"]]
            pitch = (u1 - u0) / band["columns"]
            storey = (y1 - y0) / band["rows"]
            for row in range(band["rows"]):
                lo = y0 + (row + (1 - band["fillY"]) / 2) * storey
                hi = lo + band["fillY"] * storey
                for col in range(band["columns"]):
                    left = u0 + (col + (1 - band["fillX"]) / 2) * pitch
                    right = left + band["fillX"] * pitch
                    outer = LineString([(a[0] + ux * t + nx * .28, a[1] + uz * t + nz * .28)
                                        for t in (left, right)])
                    neighbours = index.query(outer, predicate="intersects")
                    if any(occupants[i][0] != owner and
                           min(hi + base, occupants[i][2]) - max(lo + base, occupants[i][1]) > .12
                           for i in neighbours):
                        continue
                    kind = {"window": 0, "glazing": 1, "spandrel": 2}.get(band["kind"])
                    if kind is None or hi - lo < .18 or right - left < .18:
                        continue
                    cells.append([round(left * 10), round(right * 10), round(lo * 10),
                                  round(hi * 10), kind, band["color"]])
                    counts[band["kind"]] += 1
        if cells:
            r, g, b0 = face["swatch"]
            result[owner].append([*a, *b, base, height, (r << 16) | (g << 8) | b0, cells])
    print(len(result), "represented buildings", sum(map(len, result.values())), "facades", dict(counts))
    return dict(result)


if __name__ == "__main__":
    OUTPUT.write_text(json.dumps(compile_fronts(), separators=(",", ":")) + "\n")
