"""Prepare mapped allotment details using mapped Berlin garden footprints and features."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import math
import re
import struct
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from shapely import contains_xy, make_valid, union_all
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.strtree import STRtree

from scripts.build_allotments_v264 import navigation_guard

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
TILES = APP / "public/mesh/surrounding-berlin-v159"
CORE = APP / "public/mesh/regierungsviertel"
DATA = APP / "src/data"
TILE_ID = re.compile(r"(?:(?:outer187|east200|north190|ring182|city183|marzahn230|kladow346|tegel346)-)?-?\d+_-?\d+$")
PATH, EARTH, HEDGE, SHRUB, FOUNDATION = range(5)
TILE_METRES = 512
VISUAL_CLEARANCE = 0.09


def read(path: Path) -> dict:
    content = path.read_bytes()
    return json.loads(gzip.decompress(content) if path.suffix == ".gz" else content)


def json_bytes(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def polygons(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygons(part)


def source_vegetation_and_paths(files: list[Path]):
    features = []
    for path in files:
        data = read(path)
        for group in ("paths", "hedges", "shrubs"):
            for row in data.get(group, []):
                if row.get("geometry"):
                    geom = shape(row["geometry"])
                elif row.get("coords") and len(row["coords"]) >= 2:
                    geom = LineString(row["coords"])
                else:
                    continue
                if geom.is_empty:
                    continue
                if group == "paths":
                    surface = str(row.get("surface", "")).lower()
                    kind = EARTH if surface in {"earth", "ground", "dirt", "grass", "mud", "sand"} else PATH
                    height = 0
                    width = float(row.get("width") or 1.6)
                else:
                    kind = HEDGE if group == "hedges" else SHRUB
                    height = round(100 * min(3, max(.35, float(row.get("height") or (1.15 if kind == HEDGE else .85)))))
                    width = float(row.get("width") or .85)
                if geom.geom_type in {"LineString", "MultiLineString"}:
                    geom = geom.buffer(min(5, max(.55, width)) / 2, cap_style="flat", join_style="mitre", mitre_limit=1.8)
                elif geom.geom_type == "Point":
                    geom = geom.buffer(min(2, width / 2), quad_segs=3)
                geom = make_valid(geom)
                for area in polygons(geom):
                    if area.area >= .15:
                        features.append((kind, height, str(row.get("site", "")), str(row.get("source", path.name)), area))
    return features


def nav_shapes(packet, key, window):
    ox, _, oz = packet["origin"]
    return [make_valid(translate(Polygon(item["ring"], item.get("holes", [])), ox, oz))
            for item in packet["nav"].get(key, []) if len(item["ring"]) >= 3
            and box(
                ox + min(p[0] for p in item["ring"]),
                oz + min(p[1] for p in item["ring"]),
                ox + max(p[0] for p in item["ring"]),
                oz + max(p[1] for p in item["ring"]),
            ).intersects(window)]


def delta_ring(ring, ox, oz):
    prior = None
    deltas = []
    for x, z in list(ring.coords)[:-1]:
        point = (round((x - ox) * 100), round((z - oz) * 100))
        if point == prior:
            continue
        deltas.extend(point if prior is None else (point[0] - prior[0], point[1] - prior[1]))
        prior = point
    return deltas if len(deltas) >= 6 else []


def draw_sheets(parts, ox, oz, y_cm):
    sheets = []
    for kind, height, geom in parts:
        for polygon in polygons(geom):
            ring = delta_ring(polygon.exterior, ox, oz)
            if ring:
                holes = [row for hole in polygon.interiors if (row := delta_ring(hole, ox, oz))]
                sheets.append([y_cm, height, kind, [ring, *holes]])
    return sheets


def native_runs(parts, ox, oz, y_cm, step=.5):
    # The drawn outline stays continuous. Native uses an independently sampled
    # orthogonal mesh of 50 cm squares and merges adjacent squares of equal type.
    rows = defaultdict(dict)
    for kind, height, geom in parts:
        x0, z0, x1, z1 = geom.bounds
        ix = np.arange(math.floor((x0 - ox) / step), math.ceil((x1 - ox) / step))
        iz = np.arange(math.floor((z0 - oz) / step), math.ceil((z1 - oz) / step))
        x, z = np.meshgrid(ix * step + ox + step / 2, iz * step + oz + step / 2)
        mask = contains_xy(geom, x, z)
        # Keep each square clear of existing structures and inside its admitted
        # footprint. Four inset corners allow the 1 cm coordinate rounding.
        inset = step / 2 - .01
        for dx, dz in ((-inset, -inset), (inset, -inset), (-inset, inset), (inset, inset)):
            mask &= contains_xy(geom, x + dx, z + dz)
        for row, col in zip(*mask.nonzero()):
            rows[int(iz[row])][int(ix[col])] = (kind, height)
    runs = []
    cell = round(step * 100)
    active = {}
    for z, cells in sorted(rows.items()):
        current = {}
        x0 = x1 = None
        style = None
        for x, value in [*sorted(cells.items()), (None, None)]:
            if x0 is not None and (value != style or x != x1):
                run = (x0, x1 - x0, style)
                last = active.get(run)
                if last is not None and last[1] + last[3] == cell * z:
                    last[3] += cell
                else:
                    last = [cell * x0, cell * z, cell * (x1 - x0), cell, y_cm, style[1], style[0]]
                    runs.append(last)
                current[run] = last
                x0 = None
            if x0 is None:
                x0, style = x, value
            x1 = x + 1 if x is not None else None
        active = current
    return [value for run in runs for value in run]


def pack_native(runs):
    """Keep the cardinal cells exactly; store coordinates by style and by column."""
    groups = defaultdict(list)
    for x, z, w, d, y, height, style in zip(*[iter(runs)] * 7, strict=True):
        if any(v % 50 for v in (x, z, w, d)):
            raise ValueError("Native run not aligned to a half-metre cell")
        groups[y, height, style].append((x // 50, z // 50, w // 50, d // 50))

    def varint(target, signed):
        value = signed * 2 if signed >= 0 else -signed * 2 - 1
        while value >= 128:
            target.append((value & 127) | 128)
            value >>= 7
        target.append(value)

    result = []
    for (y, height, style), cells in groups.items():
        columns = [bytearray() for _ in range(4)]
        old_x = old_z = 0
        for x, z, w, d in cells:
            row = (x - old_x if z == old_z else x, z - old_z, w - 1, d - 1)
            for column, value in zip(columns, row, strict=True):
                varint(column, value)
            old_x, old_z = x, z
        header = struct.pack("<4H", *map(len, columns))
        result.append([y, height, style, base64.b64encode(header + b"".join(columns)).decode("ascii")])
    return result


def clipped_parts(features, window, allowed, existing_roads):
    by_kind = defaultdict(list)
    used_sites = defaultdict(set)
    for kind, h, site, _, geom in features:
        if not geom.intersects(window):
            continue
        piece = geom.intersection(allowed)
        if not piece.is_empty and piece.area > .15:
            by_kind[kind, h].append(piece)
            used_sites[kind].add(site)
    parts = []
    prior_paths = existing_roads
    for (kind, height), shapes in sorted(by_kind.items()):
        geom = union_all(shapes)
        # Both existing roads and the newly traced paths are kept open. The
        # path pigments share each footprint, with gravel taking precedence.
        geom = geom.difference(prior_paths if kind < HEDGE else prior_paths.buffer(.12))
        for polygon in polygons(geom):
            if polygon.area >= (.55 if kind < HEDGE else .20):
                parts.append((kind, height, polygon.simplify(.045, preserve_topology=True)))
        if kind < HEDGE:
            prior_paths = union_all([prior_paths, geom])
    return parts, used_sites


def packet_plan(packet, bounds, features, native, used, mask_window):
    window = box(*bounds)
    dimension = mask_window
    ground = union_all(nav_shapes(packet, "ground", dimension)).intersection(window).difference(used)
    if ground.is_empty:
        return None, ground, Polygon(), {}
    obstacles = union_all(sum((nav_shapes(packet, key, dimension) for key in ("water", "buildings", "bridges")), []))
    roads = union_all(nav_shapes(packet, "roads", dimension))
    blocked = union_all([obstacles, roads])
    allowed = ground.difference(obstacles.buffer(.14))
    parts, sites = clipped_parts(features, window, allowed, roads)
    ox, oy, oz = packet["origin"]
    y_cm = round((packet["nav"]["groundY"] - oy + VISUAL_CLEARANCE) * 100)
    details = native_runs(parts, ox, oz, y_cm) if native else draw_sheets(parts, ox, oz, y_cm)
    if not details:
        return None, ground, blocked, {}
    return {"origin": packet["origin"], "guard": navigation_guard(packet["nav"]),
            "byStyle" if native else "sheets": pack_native(details) if native else details}, ground, blocked, sites


def write_packets(output, plans):
    sources = []
    batch = {}

    def flush():
        raw = json_bytes({"schemaVersion": 1, "packets": batch})
        zipped = gzip.compress(raw, compresslevel=9, mtime=0)
        if len(raw) > 512 * 1024 or len(zipped) > 128 * 1024:
            raise ValueError(f"Allotment packet exceeds its download allowance: {len(raw)}, {len(zipped)}")
        file = f"allotmentDetailsV360Packets{len(sources):03d}.json.gz"
        (output / file).write_bytes(zipped)
        sources.append({"file": file, "ids": list(batch), "decodedBytes": len(raw), "compressedBytes": len(zipped)})

    for tile, plan in plans.items():
        # Adjacent cells can reuse a small response. Never let a large cell
        # push the previous group over the runtime's download allowance.
        if batch and (len(batch) == 8 or len(json_bytes(batch)) + len(json_bytes(plan)) > 180_000):
            flush()
            batch = {}
        batch[tile] = plan
    if batch:
        flush()
    (output / "allotmentDetailsV360Index.json").write_bytes(json_bytes({"sources": sources}) + b"\n")
    return sources


def core_details(features, index):
    ground = read(CORE / "ground-context.json")
    grid, cell = ground["grid"], ground["cell_m"]
    min_x, min_z = grid["min_x_idx"] * cell, grid["min_z_idx"] * cell
    max_x, max_z = min_x + grid["cols"] * cell, min_z + grid["rows"] * cell
    core = box(min_x, min_z, max_x, max_z)
    # The earlier photographed Lehrter Straße garden is the existing owner.
    lehrter = box(-477.5, -1095.5, -313.5, -961.5)
    surface = read(CORE / "surface-polygons.json")
    buildings = read(CORE / "lod2-prisms.json")["buildings"]

    def surface_polygons(items):
        for item in items:
            rings = [[[n / 10 for n in point] for point in ring]
                     for ring in [item["ring"], *item.get("holes", [])]]
            if len(rings[0]) >= 3:
                yield make_valid(Polygon(rings[0], [ring for ring in rings[1:] if len(ring) >= 3]))

    obstruction = STRtree(list(surface_polygons([*surface["water"], *buildings])))
    roads = STRtree(list(surface_polygons(surface["roads"])))
    result = []
    counts = defaultdict(set)
    for x in range(math.floor(min_x / 512) * 512, math.ceil(max_x / 512) * 512, 512):
        for z in range(math.floor(min_z / 512) * 512, math.ceil(max_z / 512) * 512, 512):
            window = core.intersection(box(x, z, x + 512, z + 512)).difference(lehrter)
            matches = index.query(window, predicate="intersects")
            if not len(matches):
                continue
            nearby = [features[i] for i in sorted(matches)]
            hard = union_all(obstruction.geometries[obstruction.query(window, predicate="intersects")])
            old_roads = union_all(roads.geometries[roads.query(window, predicate="intersects")])
            parts, sites = clipped_parts(nearby, window, window.difference(hard.buffer(.14)), old_roads)
            sheets, runs = draw_sheets(parts, x, z, 0), native_runs(parts, x, z, 0)
            if sheets or runs:
                result.append({"x": x, "z": z, "sheets": sheets, "runs": runs})
                for kind, ids in sites.items():
                    counts[kind].update(ids)
    return {"tiles": result}, {kind: sorted(ids) for kind, ids in counts.items()}


def core_ground_bounds():
    data = read(CORE / "ground-context.json")
    g, size = data["grid"], data["cell_m"]
    return box(g["min_x_idx"] * size, g["min_z_idx"] * size,
               (g["min_x_idx"] + g["cols"]) * size, (g["min_z_idx"] + g["rows"]) * size)


def exterior_plans(sites, features, index, ground_owners, ground_y):
    """Cover only surveyed sites where there is no existing city ground."""
    shapes = [make_valid(shape(row["geometry"])) for row in sites]
    site_index = STRtree(shapes)
    cells = set()
    for geom in shapes:
        x0, z0, x1, z1 = geom.bounds
        cells.update((i, j)
                     for i in range(math.floor(x0 / TILE_METRES), math.ceil(x1 / TILE_METRES))
                     for j in range(math.floor(z0 / TILE_METRES), math.ceil(z1 / TILE_METRES)))
    ownership_bounds = [box(*bounds) for bounds in ground_owners]
    ownership_index = STRtree(ownership_bounds)
    ownership = list(ground_owners.values())
    core = core_ground_bounds()
    plans, entries = {}, []
    sites_covered = defaultdict(float)
    full_area = 0
    for i, j in sorted(cells, key=lambda cell: cell[::-1]):
        x, z = i * TILE_METRES, j * TILE_METRES
        window = box(x, z, x + TILE_METRES, z + TILE_METRES)
        footprint = union_all(site_index.geometries[site_index.query(window, predicate="intersects")]).intersection(window)
        previous = [core]
        for oi in ownership_index.query(footprint, predicate="intersects"):
            previous.extend(ownership[oi])
        # Survey clips and previous owners meet along a shared seam. Do not
        # cover existing water, roads, bridges or buildings beyond that seam.
        unowned = footprint.difference(union_all(previous))
        foundation = union_all([p for p in polygons(unowned) if p.area >= .5])
        if foundation.is_empty:
            continue
        nearby = [features[n] for n in sorted(index.query(foundation, predicate="intersects"))]
        parts, _ = clipped_parts(nearby, window, foundation, Polygon())
        # The raster footprint is independently sampled for the Native view;
        # Drawn retains the actual vector boundary and holes.
        base_y = round((ground_y + 10) * 100)
        y = base_y + round(VISUAL_CLEARANCE * 100)
        sheets = draw_sheets(parts, x, z, y)
        runs = native_runs([(FOUNDATION, 0, foundation)], x, z, base_y, step=2)
        if not runs:
            runs = native_runs([(FOUNDATION, 0, foundation)], x, z, base_y, step=.5)
        runs.extend(native_runs(parts, x, z, y))
        encoded = [row[3] for row in draw_sheets([(FOUNDATION, 0, foundation)], x, z, base_y)]
        if not encoded:
            continue
        for site_pos in site_index.query(foundation, predicate="intersects"):
            site = sites[site_pos]
            sites_covered[site["id"]] += shapes[site_pos].intersection(foundation).area
        full_area += foundation.area
        origin = [x, -10, z]
        plans[f"allotment360-{i}_{j}"] = {
            "foundation": encoded,
            "drawn": {"origin": origin, "guard": 0, "sheets": sheets},
            "minecraft": {"origin": origin, "guard": 0, "byStyle": pack_native(runs)},
        }
        entries.append([i, j])
    return plans, entries, {key: round(area, 1) for key, area in sites_covered.items()}, round(full_area, 1)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("sources", nargs="+", type=Path)
    cli.add_argument("--output", default=DATA, type=Path)
    cli.add_argument("--audit", required=True, type=Path)
    args = cli.parse_args()
    features = source_vegetation_and_paths(args.sources)
    if not features:
        raise ValueError("No mapped allotment features.")
    print(f"{len(features):,} mapped input shapes", flush=True)
    index = STRtree([f[4] for f in features])
    inventory = read(args.sources[0])
    sites = inventory["sites"]
    site_index = STRtree([make_valid(shape(site["geometry"])) for site in sites])
    manifest = read(TILES / "manifest.json")
    grouped = defaultdict(list)
    for desc in manifest["chunks"]:
        if TILE_ID.fullmatch(desc["id"]):
            grouped[tuple(desc["bounds"])].append(desc)
    plans = {}
    ground_owners = {}
    published_sites = {mode: defaultdict(set) for mode in ("drawn", "minecraft")}
    counts = Counter()
    for bounds, tiles in sorted(grouped.items(), key=lambda item: (item[0][1], item[0][0])):
        window = box(*bounds)
        site_matches = site_index.query(window, predicate="intersects")
        if not len(site_matches):
            continue
        matches = index.query(window, predicate="intersects")
        near = [features[i] for i in sorted(matches)]
        mask_window = union_all(site_index.geometries[site_matches]).intersection(window).envelope
        owners = []
        for mode in ("drawn", "minecraft"):
            used = Polygon()
            for tile in tiles:
                packet = read(TILES / tile[mode]["url"])
                plan, ground, obstacles, mapped_sites = packet_plan(packet, bounds, near, mode == "minecraft", used, mask_window)
                used = union_all([used, ground])
                if not obstacles.is_empty:
                    owners.append(obstacles)
                if plan:
                    plans.setdefault(tile["id"], {})[mode] = plan
                    counts[mode] += 1
                    for kind, values in mapped_sites.items():
                        published_sites[mode][kind].update(values)
            if not used.is_empty:
                owners.append(used)
        if owners:
            ground_owners[bounds] = owners
    print(f"{len(plans)} additions within existing city tiles", flush=True)
    exterior, entries, exterior_sites, exterior_area = exterior_plans(sites, features, index, ground_owners, manifest["groundY"])
    print(f"{len(exterior)} dedicated garden tiles covering {exterior_area:,.1f} m²", flush=True)
    plans.update(exterior)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "allotmentDetailsV360ExteriorIndex.json").write_bytes(json_bytes({"tiles": entries}) + b"\n")
    packets = write_packets(args.output, plans)
    core, core_sites = core_details(features, index)
    raw = json_bytes(core)
    core_bytes = gzip.compress(raw, compresslevel=9, mtime=0)
    (args.output / "allotmentDetailsV360Core.json.gz").write_bytes(core_bytes)
    audit = {"inputFeatures": len(features), "tiles": dict(counts), "exteriorTiles": len(exterior),
             "exteriorAreaM2": exterior_area, "exteriorSites": exterior_sites,
             "sites": {mode: {k: sorted(v) for k, v in values.items()} for mode, values in published_sites.items()},
             "coreSites": core_sites, "coreDecodedBytes": len(raw), "coreCompressedBytes": len(core_bytes),
             "packets": len(packets), "totalCompressedBytes": len(core_bytes) + sum(p["compressedBytes"] for p in packets)}
    args.audit.write_bytes(json_bytes(audit) + b"\n")
    print({k: v for k, v in audit.items() if k not in {"sites", "exteriorSites", "coreSites"}}, flush=True)


if __name__ == "__main__":
    main()
