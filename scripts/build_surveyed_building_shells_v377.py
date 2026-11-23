"""Preserve measured CityGML part walls, stepped roofs and courtyards in selected facade models."""
import argparse
import base64
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
from shapely import affinity, union_all
from shapely.geometry import Polygon

from build_concert_halls_v160 import NS, normal_of, triangulate

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
TILES = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BUILDINGS = {
    "DEBE02YY400000Y3": ("391_5817", "Vivantes Klinikum Am Urban", (212, 202, 181)),
    "DEBE09YYP00031P3": ("400_5812", "Peter-Behrens-Bau", (188, 171, 147)),
    "DEBE11YYI00001Lx": ("395_5820", "Vienna House an der Landsberger Allee", (188, 190, 184)),
    "DEBE02AL5KH0003C": ("395_5817", "B:HUB", (183, 170, 157)),
}
GML_ID = "{http://www.opengis.net/gml}id"
WORLD_GROUND = 3.0


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def clip(points, plane):
    """Sutherland–Hodgman in 3D, including source elevation at every tile crossing."""
    a, b, c = plane
    result = []
    for start, end in zip(points, points[1:] + points[:1]):
        lo, hi = a * start[0] + b * start[2] + c, a * end[0] + b * end[2] + c
        if lo >= -1e-8:
            result.append(start)
        if (lo < -1e-8) != (hi < -1e-8):
            t = max(0., min(1., lo / (lo - hi)))
            result.append([x + (y - x) * t for x, y in zip(start, end)])
    return result


def tile_domains(ids, key, descriptors):
    domains = {}
    for tile in ids:
        d = descriptors[tile]
        packet = json.loads(gzip.decompress((TILES / d["drawn"]["url"]).read_bytes()))
        ox, _, oz = packet["origin"]
        nav = [r for r in packet["nav"]["buildings"] if r.get("parentId", r.get("sourceId")) == key]
        shape = affinity.translate(union_all([Polygon(r["ring"], r["holes"]) for r in nav]), ox, oz)
        if shape.is_empty or {r["minHeight"] for r in nav} != {0}:
            raise ValueError(f"Invalid source base for {key} in {tile}")
        left, top, right, bottom = d["bounds"]
        domains[tile] = dict(shape=shape, origin=packet["origin"], bounds=d["bounds"], planes=[
            (1, 0, -left), (0, 1, -top), (-1, 0, right), (0, -1, bottom),
        ])
    for i, (tile, domain) in enumerate(domains.items()):
        for other in list(domains.values())[i + 1:]:
            if domain["bounds"] != other["bounds"]:
                continue
            seam = domain["shape"].boundary.intersection(other["shape"].boundary)
            if seam.geom_type != "LineString" or seam.length <= .01 or domain["shape"].intersection(other["shape"]).area > .0001:
                raise ValueError(f"Ambiguous shared source tile at {tile}")
            (x0, z0), (x1, z1) = seam.coords[0], seam.coords[-1]
            a, b = z0 - z1, x1 - x0
            c = -a * x0 - b * z0
            for side in (domain, other):
                p = side["shape"].representative_point()
                sign = 1 if a*p.x + b*p.y + c > 0 else -1
                side["planes"].append((a*sign, b*sign, c*sign))
    return domains


def read_surfaces(archive, key):
    with zipfile.ZipFile(archive) as z:
        names = [name for name in z.namelist() if name.endswith(".xml")]
        if len(names) != 1:
            raise ValueError(archive)
        parent = next((el for _, el in ET.iterparse(z.open(names[0]))
                       if el.get(GML_ID) == key and el.tag == "{"+NS["b"]+"}Building"), None)
    if parent is None:
        raise ValueError(f"Missing {key} in {archive}")
    parts = [parent, *parent.findall(".//b:BuildingPart", NS)]
    base = min(float(z) for pos in parent.findall(".//b:GroundSurface//g:posList", NS) for z in pos.text.split()[2::3])
    surfaces = []
    for part in parts:
        for boundary in part.findall("b:boundedBy", NS):
            for surface in boundary:
                kind = surface.tag.rsplit("}", 1)[-1]
                for polygon in surface.findall(".//g:Polygon", NS):
                    rings = []
                    for pos in polygon.findall(".//g:posList", NS):
                        coords = np.fromstring(pos.text, sep=" ").reshape(-1, 3)
                        xyz = np.column_stack((coords[:, 0]-389500, coords[:, 2]-base+WORLD_GROUND, 5820000-coords[:, 1])).round(3).tolist()
                        if xyz[0] == xyz[-1]:
                            xyz.pop()
                        rings.append(xyz)
                    surfaces.append((kind, part.get(GML_ID), surface.get(GML_ID), polygon.get(GML_ID), rings))
    return base, surfaces


def wall_segments(domains, owner, base, wall):
    kind, part, surface, polygon, rings = wall
    if kind != "WallSurface":
        return []
    n = normal_of(rings[0])
    if not np.isfinite(n).all() or abs(n[1]) > .035:
        return []
    n = np.array([n[0], n[2]]) / np.hypot(n[0], n[2])
    tangent = np.array([n[1], -n[0]])
    ext = np.array(rings[0])
    ab = ext[:, [0, 2]]
    along = ab @ tangent
    a, b = ab[np.argmin(along)], ab[np.argmax(along)]
    if np.linalg.norm(a-b) < .10:
        return []
    result = []
    for tile, d in domains.items():
        clipped = list(rings[0])
        for plane in d["planes"]:
            clipped = clip(clipped, plane)
            if len(clipped) < 3:
                break
        if len(clipped) < 3:
            continue
        xy = np.array(clipped)
        span = xy[:, [0, 2]] @ tangent
        lo, hi = float(xy[:, 1].min()), float(xy[:, 1].max())
        if hi-lo < .10 or np.ptp(span) < .10:
            continue
        start = a + (span.min() - along.min()) * tangent
        end = a + (span.max() - along.min()) * tangent
        result.append(dict(tile=tile, family="drawn", owner=owner, a=start.round(3).tolist(), b=end.round(3).tolist(),
                    normal=n.round(7).tolist(), low=round(lo,3), high=round(hi,3), groundY=WORLD_GROUND,
                    groundNHN=base, wallId=polygon, surfaceId=surface, sourcePartId=part, rings=rings))
    return result


def encoded(array, dtype):
    return base64.b64encode(np.asarray(array, dtype=dtype).tobytes()).decode()


def area3(triangle):
    q = np.asarray(triangle)
    return float(np.linalg.norm(np.cross(q[1]-q[0], q[2]-q[0])) / 2)


def finish(site, mesh):
    vertices = list(mesh["vertices"])
    indices = mesh["sides"] + mesh["roofs"]
    if not mesh["roofs"] or not mesh["sides"]:
        raise ValueError(f"Missing measured wall or roof for {site}")
    return {"id": site, "parentId": site, "roofIndexStart": len(mesh["sides"]), "mesh": {
        "kind": "surveyed-building-shells-v377", "positionType": "u16cm",
        "positions": encoded([v[:3] for v in vertices], "<u2"),
        "colors": encoded([v[3:] for v in vertices], "u1"),
        "indices": encoded(indices, "<u4"),
    }}


def build_meshes(sites, receipts, *, surface_colours=None, output=None, receipt_path=None):
    tiles = defaultdict(list)
    for key, wall_colour, domains, surfaces in sites:
        meshes = {tile:dict(vertices={}, sides=[], roofs=[]) for tile in domains}
        source_area, clipped_area, quantized_area = Counter(), Counter(), Counter()
        source_counts, tiny = Counter(), Counter()
        for kind, part, surface, polygon, rings in surfaces:
            if kind not in {"WallSurface", "RoofSurface", "ClosureSurface", "GroundSurface"}:
                raise ValueError(f"Unhandled semantic surface {kind}")
            n = normal_of(rings[0])
            if not np.isfinite(n).all():
                raise ValueError(f"Degenerate CityGML source surface: {key}/{polygon}")
            material = (144, 149, 149) if kind == "RoofSurface" else wall_colour
            # Commons:52706721 shows the red-brown pitch of the photographed
            # tower crown and its lower apron. Keep the other roof parts neutral.
            if (kind == "RoofSurface" and part in {"DEBE3DUVr5RBkj6J", "DEBE3DjFUokBIro6"} and n[1] < .995):
                material = (141, 93, 73)
            if surface_colours:
                material = surface_colours.get(key, {}).get(polygon, material)
            colour = np.asarray(material, dtype=float) / 255
            shade = 1 if n[1] > .55 else (.86 if n[1] < -.55 else
                ((.95 if n[0] > 0 else .89) if abs(n[0]) >= abs(n[2]) else (.92 if n[2] > 0 else .98)))
            rgb = tuple(np.rint(((colour + .055) / 1.055)**2.4 * 255 * shade).astype(int).tolist())
            for tri in triangulate(rings):
                source_area[kind] += area3(tri)
                source_counts[kind] += 1
                for tile, domain in domains.items():
                    points = list(tri)
                    for plane in domain["planes"]:
                        points = clip(points, plane)
                        if len(points) < 3:
                            break
                    for end in range(2, len(points)):
                        face = [points[0], points[end-1], points[end]]
                        before = area3(face)
                        if before <= 1e-9:
                            continue
                        clipped_area[kind] += before
                        coords = np.rint((np.asarray(face) - domain["origin"]) * 100).astype(int)
                        if coords.min() < 0 or coords.max() > 65535:
                            raise ValueError(f"Centimetre word range exhausted in {tile}")
                        after = area3(coords / 100)
                        quantized_area[kind] += after
                        if after < 1e-9:
                            tiny[kind] += 1
                            continue
                        mesh = meshes[tile]
                        index = mesh["roofs" if kind == "RoofSurface" else "sides"]
                        for xyz in coords.tolist():
                            vertex = (*xyz, *rgb)
                            i = mesh["vertices"].setdefault(vertex, len(mesh["vertices"]))
                            index.append(i)
        for kind, area in source_area.items():
            if abs(clipped_area[kind] - area) > max(.001, area * 1e-6):
                raise ValueError(f"Lost source area across tile domains: {key} {kind} {area} -> {clipped_area[kind]}")
            if abs(quantized_area[kind] - area) > max(.01, area * .001):
                raise ValueError(f"Excessive centimetre quantization: {key} {kind}")
        for tile, mesh in meshes.items():
            tiles[tile].append(finish(key, mesh))
        if key == "DEBE09YYP00031P3":
            receipts[key]["appearance"] = {"reference": "commons:52706721", "wallSRGB": list(wall_colour),
                "towerPitchSRGB": [141, 93, 73], "towerRoofParts": ["DEBE3DUVr5RBkj6J", "DEBE3DjFUokBIro6"],
                "otherRoofSRGB": [144, 149, 149]}
        receipts[key].update(sourceTriangles=dict(source_counts), collapsedSubCentimetreTriangles=dict(tiny),
            sourceAreaM2={k:round(v,4) for k,v in source_area.items()},
            clippedAreaM2={k:round(v,4) for k,v in clipped_area.items()},
            quantizedAreaM2={k:round(v,4) for k,v in quantized_area.items()},
            emitted={t:{"vertices":len(m["vertices"]), "sideTriangles":len(m["sides"])//3, "roofTriangles":len(m["roofs"])//3}
                     for t,m in meshes.items()})
    write(output or DATA/"surveyedBuildingShellsV377.json", {"tiles":dict(sorted(tiles.items()))})
    write(receipt_path or GEO/"surveyed-building-shells-v377-receipt.json", {
        "schemaVersion":1, "source": "Geoportal Berlin, 3D-Gebäudemodelle im Level of Detail 2 (LoD2), EPSG:25833; dl-de/zero-2-0.",
        "datum": "One common official GroundSurface minimum per building, aligned to its existing displayed base at y=3 m. Preserve all measured differences between parts.",
        "geometry": "All source WallSurface, RoofSurface, ClosureSurface and GroundSurface polygons and their interior rings triangulated in their own planes. Clip at actual streamed piece boundaries; no seam caps. Display in native packet precision of one centimetre; catalogue wall and roof colours are illustrative.",
        "owners": receipts,
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archives", type=Path, required=True, help="Directory containing atlas LoD2_<x>_<y>.zip archives")
    parser.add_argument("--walls-only", action="store_true")
    args = parser.parse_args()
    ranking = {t["id"]:t for t in json.loads((GEO/"windowless-buildings-v377.json").read_bytes())["targets"]}
    descriptors = {r["id"]: r for r in json.loads((TILES/"manifest.json").read_bytes())["chunks"]}
    targets, source_info, all_sites = {}, {}, []
    for key, (tile, name, colour) in BUILDINGS.items():
        archive = args.archives / ("LoD2_" + tile + ".zip")
        base, surfaces = read_surfaces(archive, key)
        domains = tile_domains(ranking[key]["tiles"], key, descriptors)
        targets[key] = [seg for s in surfaces for seg in wall_segments(domains, key, base, s)]
        source_info[key] = dict(name=name, archive=archive.name, url="https://gdi.berlin.de/data/a_lod2/atom/"+archive.name,
            sha256=hashlib.sha256(archive.read_bytes()).hexdigest(), groundNHN=round(base,3),
            parts=len(set(s[1] for s in surfaces)), polygons=dict(sorted(Counter(s[0] for s in surfaces).items())),
            holes=sum(len(s[4])-1 for s in surfaces), wallRecords=len(targets[key]))
        all_sites.append((key, colour, domains, surfaces))
    write(GEO/"surveyed-shell-walls-v377.json", dict(schemaVersion=1, sources=source_info, targets=targets))
    if not args.walls_only:
        build_meshes(all_sites, source_info)


if __name__ == "__main__":
    main()
