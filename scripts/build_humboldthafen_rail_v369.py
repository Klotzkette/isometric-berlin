"""Fit the four Humboldthafen railway bridges to ALKIS bearings and the installed city."""
import gzip
import json
from pathlib import Path

from shapely import Point
from shapely.geometry import LineString, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = ROOT / "geo_data/regierungsviertel"
PRODUCT = ROOT / "src/app/src/data/humboldthafenRailV369.json"


def read(name):
    return json.loads((PUBLIC / (name + ".json")).read_text())


def xz(ring):
    return [(x / 10, z / 10) for x, z in ring]


def span_segments(polygon, x):
    cut = polygon.intersection(LineString([(x, -740), (x, -610)]))
    parts = cut.geoms if cut.geom_type == "MultiLineString" else [cut]
    return sorted([round(part.bounds[1], 2), round(part.bounds[3], 2)]
                  for part in parts if part.geom_type == "LineString" and part.length > .06)


def main():
    rail, voxels = read("rail-lines"), read("minecraft-voxels")
    cadastre = json.loads(gzip.decompress((DATA / "steel-rail-cadastre-v369.json.gz").read_bytes()))
    structures = {r["id"]: shape(r["geometry"]) for r in cadastre["records"]}
    cap = structures["DEBE01YYK00020UU"]
    foundation_ids = ["DEBE00YYYK0000EX", "DEBE00YYYK0000Ek"]
    beds = [structures[key] for key in foundation_ids]
    bearings = []
    for bed in beds:
        row = sorted((r for r, p in structures.items() if 3.5 < p.area < 4.5 and bed.covers(p.centroid)),
                     key=lambda r: structures[r].centroid.y)
        assert len(row) == 8
        bearings.append([dict(id=key, center=[round(v, 3) for v in structures[key].centroid.coords[0]],
                              ring=[[round(v, 3) for v in p] for p in list(structures[key].exterior.coords)[:-1]])
                         for key in row])

    water = next(Polygon(xz(q["ring"]), [xz(h) for h in q["holes"]]) for q in read("surface-polygons")["water"]
                 if q["name"] == "Humboldthafen")
    cell_m = voxels["cell_m"]
    water_rows = {}
    g = voxels["grid"]
    for j, row in enumerate(voxels["ground_rows"]):
        z = (g["min_z_idx"] + j + .5) * cell_m
        if not -725 < z < -650:
            continue
        cells = []
        for first, count, kind in row:
            if voxels["classes"][kind] != "bridge":
                continue
            for i in range(first, first + count):
                x = (g["min_x_idx"] + i + .5) * cell_m
                if -12 < x < 150 and water.covers(Point(x, z)):
                    cells.append(i)
        if cells:
            water_rows[str(j)] = cells

    axes = []
    for key in [1, 0, 7, 10, 11, 13]:
        line = LineString(xz(rail["viaduct_tracks"][key]))
        # Locate the first actual elevated native cell on the eastern approach.
        landing = None
        for x in range(178, 208):
            hit = line.intersection(LineString([(x, -740), (x, -600)]))
            if hit.geom_type != "Point":
                continue
            z = hit.y
            col = int(x // cell_m) - g["min_x_idx"]
            row = int(z // cell_m) - g["min_z_idx"]
            for i, n, base, top, _ in voxels["building_rows"][row]:
                if i <= col < i + n and 140 < top < 185:
                    landing = {"x": x + 1, "z": round(z, 2), "top": top / 10,
                               "cell": [col, row, base, top]}
                    break
            if landing:
                break
        assert landing
        east = landing["x"]
        pts = list(line.coords)
        interior = [p for p in pts if -5 < p[0] < east and -735 < p[1] < -600]
        for x in [-5, east]:
            cut = line.intersection(LineString([(x, -740), (x, -600)]))
            assert cut.geom_type == "Point"
            interior.append((x, cut.y))
        axes.append(dict(trackIndex=key, points=[[round(a, 2), round(b, 2)] for a, b in sorted(interior)],
                         landing=landing))
    end_x = max(q["landing"]["x"] for q in axes)
    section_rows = [span_segments(cap, x + .5) for x in range(-5, end_x)]
    assert all(section_rows)
    # Full decimetre keys, not a rectangular pier deletion. Original arrays
    # remain in the rail payload. Include only displacements into the opening.
    retired = []
    for p in rail["piers"]:
        x, z = (v / 10 for v in p)
        if 24 < x < 104 and water.covers(Point(x, z)) and cap.buffer(.5).covers(Point(x, z)):
            retired.append(p)
    host = rail["viaduct"][0]
    drawn = Polygon(xz(host["ring"]), [xz(h) for h in host["holes"]]).intersection(box(12, -729, 119, -642))
    parts = drawn.geoms if drawn.geom_type == "MultiPolygon" else [drawn]
    def ring_coords(ring):
        return [[round(v, 3) for v in p] for p in list(ring.coords)[:-1]]
    support = {
        "drawnDecks": [dict(ring=ring_coords(g.exterior), holes=[ring_coords(h) for h in g.interiors]) for g in parts],
        "decks": "DEBE01YYK00020UU",
        "foundations": [dict(id=key, ring=[[round(v, 2) for v in p] for p in list(bed.exterior.coords)[:-1]])
                        for key, bed in zip(foundation_ids, beds)],
        "bearings": bearings, "retiredPiersDm": retired, "tracks": axes, "waterRows": water_rows,
        "nativeStartX": -5, "nativeBedRows": section_rows, "grid": [g["min_x_idx"], g["min_z_idx"], cell_m],
    }
    PRODUCT.write_text(json.dumps(support, separators=(",", ":")) + "\n")
    print("Bearing pairs", len(bearings[0]), "restored canal cells", sum(map(len, water_rows.values())),
          "retired piers", retired, "station joins", [a["landing"] for a in axes])


if __name__ == "__main__":
    main()
