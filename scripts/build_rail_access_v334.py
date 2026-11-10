"""Compile Berlin public rail access from VBB GTFS and matched mapped stairs.

Usage: uv run --no-sync --with osmium python scripts/build_rail_access_v334.py VBB.zip
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

import osmium
from pyproj import Transformer
from shapely import STRtree, Point, box
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OSM = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
BOUNDARY = GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson"
OLDER = GEO / "ubahn-access-v326-source.json.gz"
CELL = 256
VBB_URL = "https://unternehmen.vbb.de/digitale-services/datensaetze/"
XY = Transformer.from_crs(4326, 25833, always_xy=True)
START_ACCESS = re.compile(r"^(?:(?:haupt|seiten|neben)?zugang\b|(?:haupt|seiten|neben)?eingang\b|zugangsbereich\b|aufzug\b)", re.I)
STATION_PREFIX = re.compile(r"^(?:S\+U|S|U)\s+")
# The operator confirms these exterior approaches. In GTFS their labels start
# with the street name rather than the ordinary "Zugang" or "Aufzug" field.
WOLLANK_APPROACHES = {"000300253003", "000300253011", "000300253017"}


def digest(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def records(feed, name):
    with feed.open(name + ".txt") as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))


def world(lon, lat):
    x, y = XY.transform(float(lon), float(lat))
    return [round(x - 389500, 2), round(5820000 - y, 2)]


def station_name(s):
    return STATION_PREFIX.sub("", s).removesuffix(" (Berlin)")


def name_key(s):
    return re.sub(r"[^a-z0-9äöü]", "", station_name(s).casefold().replace("str.", "strasse"))


def integer(value):
    return int(value) if value and re.fullmatch(r"[-+]?\d+", value) else 0


class ExteriorSteps(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = []

    def way(self, way):
        tags = way.tags
        if tags.get("highway") != "steps" or tags.get("indoor") == "yes" or tags.get("tunnel") == "yes":
            return
        if tags.get("access") in ("private", "no") or tags.get("conveying") in ("yes", "forward", "backward", "reversible"):
            return
        if not 2 <= len(way.nodes) <= 48 or any(not n.location.valid() for n in way.nodes):
            return
        coords = [world(n.lon, n.lat) for n in way.nodes]
        if not 1.5 <= sum(math.dist(a, b) for a, b in zip(coords, coords[1:])) <= 35:
            return
        keep = {key: tags[key] for key in ("incline", "step_count", "width", "handrail") if key in tags}
        self.ways.append((int(way.id), coords, keep))


def matched_stair(lower, upper, delta, pathways, ways, tree):
    ids = tree.query(box(lower[0] - 3, lower[1] - 3, lower[0] + 3, lower[1] + 3))
    matches = []
    for i in ids:
        osm_id, points, tags = ways[i // 2]
        if i % 2:
            points = points[::-1]
        incline = tags.get("incline")
        if (incline == "up" and i % 2) or (incline == "down" and not i % 2):
            continue
        d1, d2 = math.dist(points[0], lower), math.dist(points[-1], upper)
        if d1 <= 2.5 and d2 <= 4.5:
            matches.append((d1 + d2, osm_id, points, tags))
    matches.sort(key=lambda m: (m[0], m[1]))
    if not matches or (len(matches) > 1 and matches[1][0] - matches[0][0] < 1.25):
        return None
    _, osm_id, points, tags = matches[0]
    count = integer(tags.get("step_count"))
    width = tags.get("width", "").removesuffix(" m").replace(",", ".")
    width = float(width) if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", width) else 0
    return {
        "osmWay": f"way/{osm_id}",
        "pathways": sorted(pathways),
        "points": points,
        "levels": delta,
        "stepCount": count if 2 <= count <= 100 else None,
        "width": width if 0.9 <= width <= 6 else None,
        "tags": tags,
    }


def compile_data(gtfs):
    with gzip.open(OLDER) as f:
        previous = json.load(f)
    older_active = json.loads((DATA / "ubahnAccessV326.json").read_text())
    older_stairs = {
        f"way/{way}" for way in json.loads((GEO / "south-elevated-v238-evidence.json").read_text())["stairs"]
    }
    older_ids = {entry["id"] for entry in older_active["entries"]} | previous["authoredEntrances"].keys()
    old_points = defaultdict(list)
    for entry in previous["entrances"]:
        if entry["id"] in older_ids and entry.get("station") in previous["stations"]:
            name = previous["stations"][entry["station"]]["name"]
            old_points[name_key(name)].append((entry["id"], entry["point"]))

    step_handler = ExteriorSteps()
    step_handler.apply_file(str(OSM), locations=True)
    ways = step_handler.ways
    tree = STRtree([Point(p) for _, points, _ in ways for p in (points[0], points[-1])])
    berlin = shape(json.loads(BOUNDARY.read_text())["features"][0]["geometry"])
    stations = {}
    with ZipFile(gtfs) as feed:
        date = "{:04d}-{:02d}-{:02d}".format(*feed.getinfo("stops.txt").date_time[:3])
        stops = {row["stop_id"]: row for row in records(feed, "stops")}
        levels = {row["level_id"]: int(row["level_index"]) for row in records(feed, "levels")}
        routes = {}
        for row in records(feed, "routes"):
            line = row["route_short_name"]
            if row["route_type"] == "109" and re.fullmatch(r"S\d+", line):
                routes[row["route_id"]] = ("S", line)
            if row["route_type"] == "400" and re.fullmatch(r"U\d+", line):
                routes[row["route_id"]] = ("U", line)
        trips = {t["trip_id"]: routes[t["route_id"]] for t in records(feed, "trips") if t["route_id"] in routes}
        platforms = defaultdict(set)
        for t in records(feed, "stop_times"):
            route = trips.get(t["trip_id"])
            if route and t["stop_id"].startswith("de:11000:"):
                platforms[t["stop_id"]].add(route)
        for stop_id, rail in platforms.items():
            stop = stops[stop_id]
            station_id = stop["parent_station"]
            if not station_id.startswith("de:11000:") or station_id not in stops:
                continue
            station = stops[station_id]
            p = XY.transform(float(station["stop_lon"]), float(station["stop_lat"]))
            if berlin.covers(Point(p)):
                stations.setdefault(station_id, set()).update(rail)
        access = {
            stop_id: row for stop_id, row in stops.items()
            if row["location_type"] == "2" and row["parent_station"] in stations
        }
        links = defaultdict(list)
        for row in records(feed, "pathways"):
            for a, b in ((row["from_stop_id"], row["to_stop_id"]), (row["to_stop_id"], row["from_stop_id"])):
                if a in access and b in stops and stops[b]["parent_station"] == access[a]["parent_station"]:
                    links[a].append((b, row["pathway_id"], row["pathway_mode"]))

    cells, decisions = defaultdict(list), []
    entries, nearby = {}, defaultdict(list)
    by_station = {}
    for i, sid in enumerate(sorted(stations)):
        parent = stops[sid]
        # Existing BVG current-name crosswalk is used for U-only renames
        # such as Anton-Wilhelm-Amo-Straße. GTFS remains the source identity.
        label = station_name(parent["stop_name"])
        if name_key(label) == "mohrenstrasse":
            label = "Anton-Wilhelm-Amo-Straße"
        by_station[sid] = (i, label, sorted({mode for mode, _ in stations[sid]}))

    for aid, row in sorted(access.items()):
        sid, desc = row["parent_station"], row["stop_desc"].strip()
        index, name, modes = by_station[sid]
        point = world(row["stop_lon"], row["stop_lat"])
        level = levels.get(row["level_id"])
        receipt = {"stop": row, "scene": point, "level": level}
        decisions.append(receipt)
        if (not START_ACCESS.match(desc) and aid not in WOLLANK_APPROACHES) or re.search(
            r"zukünftig|verwaist|außer Betrieb|gesperrt", desc, re.I
        ):
            receipt["reason"] = "walkway-bus-or-unverified"
            continue
        if level != 0:
            receipt["reason"] = "not-street-level"
            continue
        link_rows = links.get(aid, [])
        if not link_rows:
            receipt["reason"] = "no-current-station-pathway"
            continue
        desc_fold = desc.casefold()
        is_lift = bool(re.search(r"\baufzug\b", desc_fold)) and not re.search(r"treppe\s+am\s+aufzug", desc_fold)
        is_stair = bool(re.search(r"treppe|fahrtreppe|rolltreppe", desc_fold))
        if is_lift and is_stair:
            is_lift = any(mode == "5" for _, _, mode in link_rows)
        if not is_lift and not is_stair:
            kinds = {mode for _, _, mode in link_rows}
            is_lift = "5" in kinds and "2" not in kinds and "4" not in kinds
            is_stair = bool(kinds & {"2", "4"}) and "5" not in kinds
        kind = "lift" if is_lift else "stair" if is_stair else "entrance"
        if len(modes) == 1:
            mode = modes[0]
        elif aid in {"000300166042", "000300166043", "000300166044"} or re.search(r"\bs[- ]bahn", desc_fold):
            # The Arcaden lift and the Greifenhagener footbridge landings
            # belong to S-Bahn public approaches in the station plans.
            mode = "S"
        elif re.search(r"\bu[- ]bahn|\bu\d", desc_fold):
            mode = "U"
        else:
            route_modes = {m for b, _, _ in link_rows for m, _ in platforms.get(b, ())}
            mode = next(iter(route_modes)) if len(route_modes) == 1 else "SU"
        prev = [
            (math.dist(p, point), entry_id) for entry_id, p in old_points[name_key(name)]
            if math.dist(p, point) <= (3 if kind == "lift" else 11)
        ] if "U" in mode else []
        if prev:
            receipt["reason"], receipt["retained"] = "retained-ubahn", min(prev)[1]
            continue
        duplicates = [other for other, other_point, other_kind in nearby[sid] if other_kind == kind and math.dist(other_point, point) <= 1.2]
        if duplicates:
            receipt["reason"], receipt["duplicate"] = "same-access", duplicates[0]
            continue

        flights = {}
        headings = []
        elevations = []
        for other, link, pathway_mode in link_rows:
            target = stops[other]
            target_level = levels.get(target["level_id"])
            if not target["stop_lon"] or not target["stop_lat"]:
                continue
            other_point = world(target["stop_lon"], target["stop_lat"])
            dx, dz = other_point[0] - point[0], other_point[1] - point[1]
            distance = math.hypot(dx, dz)
            if kind == "stair" and pathway_mode == "2" and target_level not in (None, 0):
                elevations.append(target_level)
                if 0 < target_level <= 3 and 1.5 <= distance <= 32 and sid != "de:11000:900110001":
                    candidate = matched_stair(point, other_point, target_level, [link], ways, tree)
                    if candidate:
                        flight = flights.setdefault(candidate["osmWay"], candidate)
                        flight["pathways"].append(link)
            if 1.2 <= distance <= 32:
                headings.append((0 if pathway_mode in ("2", "4", "5") else 1, distance, math.atan2(dz, dx)))
        physical = next(iter(flights.values())) if len(flights) == 1 else None
        if physical and physical["osmWay"] in older_stairs:
            receipt["retainedStair"] = physical["osmWay"]
            physical = None
        heading = round(min(headings)[2], 5) if headings else None
        travel = 1 if elevations and min(elevations) > 0 else -1 if elevations and max(elevations) < 0 else 0
        key = f"{math.floor(point[0] / CELL)}_{math.floor(point[1] / CELL)}"
        nearby[sid].append((aid, point, kind))
        entry = [aid, index, *point, mode, kind, travel, heading, physical["osmWay"] if physical else None]
        cells[key].append(entry)
        receipt.update({"reason": "represented", "mode": mode, "kind": kind, "links": link_rows, "stair": physical or None})
        if physical:
            physical["pathways"] = sorted(set(physical["pathways"]))
            entries[physical["osmWay"]] = physical
    metadata = {
        "vbb": {"title": "Verkehrsverbund Berlin-Brandenburg (VBB) GTFS", "date": date, "license": "CC-BY-4.0", "url": VBB_URL, "sha256": digest(gtfs)},
        "osm": {"title": "OpenStreetMap contributors / Geofabrik Berlin", "date": "2026-09-29", "license": "ODbL-1.0", "url": "https://download.geofabrik.de/europe/germany/berlin.html", "sha256": digest(OSM)},
    }
    counts = Counter(r["reason"] for r in decisions)
    report = {
        "source": metadata,
        "stations": [
            {"id": sid, "name": name, "modes": modes, "lines": sorted({line for _, line in stations[sid]})}
            for sid, (_, name, modes) in by_station.items()
        ],
        "decisions": decisions,
        "counts": dict(sorted(counts.items())),
    }
    data = {
        "schemaVersion": 1, "cellMeters": CELL, "source": metadata,
        "stations": [[sid, name, "".join(modes)] for sid, (_, name, modes) in by_station.items()],
        "cells": dict(sorted(cells.items())),
        "stairs": {
            k: [r["points"], r["levels"], r["stepCount"], r["width"]]
            for k, r in sorted(entries.items())
        },
    }
    return data, report


def main():
    data, report = compile_data(Path(sys.argv[1]))
    dump = lambda value: json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    (DATA / "railAccessV334.json").write_text(dump(data), encoding="utf-8")
    (GEO / "rail-access-v334-evidence.json.gz").write_bytes(gzip.compress(dump(report).encode(), mtime=0))
    print(report["counts"], len(data["stations"]), len(data["stairs"]))


if __name__ == "__main__":
    main()
