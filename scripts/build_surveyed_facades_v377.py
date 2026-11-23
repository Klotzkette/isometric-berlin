"""Bind edition-specific facade observations to their represented vertical walls."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RANK = ROOT / "geo_data/regierungsviertel/windowless-buildings-v377.json"
DATA = ROOT / "src/app/src/data"
SHELL_WALLS = ROOT / "geo_data/regierungsviertel/surveyed-shell-walls-v377.json"
PROFILES = DATA / "buildingFacadeProfilesV377.json"


def dot(point, axis):
    return point[0] * axis[0] + point[1] * axis[1]


def unit(dx, dz):
    length = math.hypot(dx, dz)
    if length < 0.05:
        raise ValueError("Degenerate facade segment")
    return (dx / length, dz / length)


def angle_of(normal):
    return math.degrees(math.atan2(normal[0], -normal[1])) % 360


def difference(a, b):
    return abs((a - b + 180) % 360 - 180)


def front_matches(face, front, azimuth):
    tolerance = front["tolerance"]
    if face["family"] == "minecraft" and "a" in front and min(abs(n) for n in face["normal"]) < 1e-6:
        # An oblique true elevation becomes a series of cardinal voxel faces;
        # the nearest axis can be up to 45 degrees from the real outward
        # normal. Only spatially anchored observations qualify for this path.
        nearest = min(difference(front["azimuth"], axis) for axis in (0, 90, 180, 270))
        tolerance = max(tolerance, nearest + 1e-6)
    return difference(azimuth, front["azimuth"]) <= tolerance


def at(point, end, t):
    return [point[i] + (end[i] - point[i]) * t for i in range(2)]


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def intersect_reference(face, reference, profile, exact):
    """Crop the physical wall against the observed frontage, preserving bay phase."""
    a, b = face["a"], face["b"]
    tangent = unit(reference["b"][0] - reference["a"][0], reference["b"][1] - reference["a"][1])
    perpendicular = (-tangent[1], tangent[0])
    if exact:
        # A raster-stepped native wall can sit just inside the original survey.
        # Restrict each endpoint independently to the reference's support strip.
        tolerance = 2.85 if face["family"] == "minecraft" else 0.85
        d0 = dot(a, perpendicular) - dot(reference["a"], perpendicular)
        d1 = dot(b, perpendicular) - dot(reference["a"], perpendicular)
        if abs(d0 - d1) < 1e-8:
            if abs(d0) > tolerance:
                return None
            t0, t1 = 0.0, 1.0
        else:
            begin, end = sorted(((-tolerance - d0) / (d1 - d0), (tolerance - d0) / (d1 - d0)))
            t0, t1 = max(0.0, begin), min(1.0, end)
    else:
        t0, t1 = 0.0, 1.0
    origin = dot(reference["a"], tangent)
    length = dot(reference["b"], tangent) - origin
    ua, ub = (dot(a, tangent) - origin) / length, (dot(b, tangent) - origin) / length
    if ub <= ua + 1e-8:
        return None
    t0 = max(t0, -ua / (ub - ua))
    t1 = min(t1, (1 - ua) / (ub - ua))
    low, high = max(face["low"], reference["low"]), min(face["high"], reference["high"])
    if t1 <= t0 or high <= low or math.dist(a, b) * (t1 - t0) < 0.05:
        return None
    left, right = at(a, b, t0), at(a, b, t1)
    v_span = reference["high"] - reference["low"]
    return [*[round(v, 3) for v in [*left, *right, low, high]],
            *[round(v, 7) for v in [ua + (ub - ua) * t0, ua + (ub - ua) * t1,
                                    (low - reference["low"]) / v_span,
                                    (high - reference["low"]) / v_span]], profile]


def orient_face(face):
    a, b = face["a"], face["b"]
    nx, nz = face["normal"]
    if dot((b[0] - a[0], b[1] - a[1]), (nz, -nx)) < 0:
        a, b = b, a
    return {**face, "a": a, "b": b}


def compile_catalog(ranking, evidence, shell_walls=None):
    evidence = {**evidence, "profiles": [
        [{**band, "color": int(band["color"][1:], 16)} if isinstance(band.get("color"), str) and
         re.fullmatch(r"#[0-9a-fA-F]{6}", band["color"]) else band for band in profile]
        for profile in evidence["profiles"]
    ]}
    kinds = {"window", "glazing", "louvre", "loading", "entrance", "pier", "spandrel", "brick", "arch"}
    for index, bands in enumerate(evidence["profiles"]):
        for band in bands:
            if (band.get("kind") not in kinds or
                    not all(isinstance(band.get(k), int) and 1 <= band[k] <= 2048 for k in ("rows", "columns")) or
                    not all(len(band[k]) == 2 and 0 <= band[k][0] < band[k][1] <= 1 for k in ("x", "y")) or
                    not all(0 < band.get(k, 1) <= 1 for k in ("fillX", "fillY")) or
                    not isinstance(band.get("color", 0), int) or not 0 <= band.get("color", 0) <= 0xffffff):
                raise ValueError(f"Unsupported facade field in profile {index}: {band}")
    recipes = []
    by_recipe = {}

    def recipe_index(index, reverse=False):
        recipe = evidence["profiles"][index]
        if reverse:
            recipe = [{**band, "x": [1 - band["x"][1], 1 - band["x"][0]]} for band in recipe]
        key = compact(recipe)
        if key not in by_recipe:
            by_recipe[key] = len(recipes)
            recipes.append(recipe)
        return by_recipe[key]

    tiles = defaultdict(lambda: defaultdict(list))
    for target in ranking["targets"]:
        target_id = target["id"]
        observation = evidence["targets"].get(target_id)
        if not observation:
            continue
        raw_faces = target["segments"]
        shell_faces = (shell_walls or {}).get(target_id)
        if shell_faces:
            # In Drawn mode only the surveyed physical wall may host these
            # fronts. The overwritten max-height prism no longer exists.
            raw_faces = [face for face in raw_faces if face["family"] != "drawn"] + [
                {**face, "owner": "surveyed-shell:" + target_id} for face in shell_faces]
        faces = [orient_face(face) for face in raw_faces]
        for face in faces:
            azimuth = angle_of(face["normal"])
            matching = sorted((front for front in observation["fronts"]
                               if front_matches(face, front, azimuth) and
                               (not front.get("wallId") or face["family"] == "minecraft" or
                                face.get("wallId") == front["wallId"])),
                              key=lambda front: difference(azimuth, front["azimuth"]))
            anchored = False
            key = (target_id, face["owner"], face.get("tileSha256", "") if face.get("navTile", face["tile"]) != face["tile"] else "")
            if face.get("navTile", face["tile"]) != face["tile"] and len(key[2]) != 64:
                raise ValueError("Missing authenticated native split wall")
            output = tiles[face["family"] + ":" + face["tile"]][key]
            for front in (f for f in matching if "a" in f):
                ref = front
                tangent = unit(front["b"][0] - front["a"][0], front["b"][1] - front["a"][1])
                outward = (face["normal"][1], -face["normal"][0])
                reverse = dot(tangent, outward) < 0
                if reverse:
                    ref = {**ref, "a": front["b"], "b": front["a"]}
                row = intersect_reference(face, ref, recipe_index(front["profile"], reverse), True)
                if row:
                    anchored = True
                    if recipes[row[-1]]:
                        output.append(row)
            if anchored:
                continue
            general = next((f for f in matching if "a" not in f), None)
            choice = general["profile"] if general else observation.get("defaultProfile")
            if choice is None or not evidence["profiles"][choice]:
                continue
            # Establish the frontage interval once in world metres. A narrow
            # return or the next tile gets its own portion of the same rhythm.
            orient = general["azimuth"] if general else (round(azimuth / 45) * 45) % 360
            radians = math.radians(orient)
            tangent = (-math.cos(radians), -math.sin(radians))
            related = [other for other in faces if other["family"] == face["family"] and
                       difference(angle_of(other["normal"]), orient) <= (general["tolerance"] if general else 23.0)]
            if not related:
                related = [face]
            points = [dot(point, tangent) for part in related for point in (part["a"], part["b"])]
            left, right = min(points), max(points)
            if right - left < 0.05:
                continue
            ref = {"a": [left * v for v in tangent], "b": [right * v for v in tangent],
                   "low": min(part["low"] for part in related), "high": max(part["high"] for part in related)}
            row = intersect_reference(face, ref, recipe_index(choice), False)
            if row:
                output.append(row)
    packets = {}
    used = set()
    for tile, members in sorted(tiles.items()):
        entries = []
        for (target, owner, sha), rows in sorted(members.items()):
            retained = []
            for row in dict.fromkeys(map(tuple, rows)):
                u0, u1, v0, v1, index = row[6:]
                # A wall can reach the outer edge of a reference image while
                # intersecting none of its documented doors or windows.
                if not any(min(u1, band["x"][1]) > max(u0, band["x"][0]) and
                           min(v1, band["y"][1]) > max(v0, band["y"][0]) for band in recipes[index]):
                    continue
                retained.append(list(row))
                used.add(index)
            if retained:
                entries.append({"id": target, "owner": owner, **({"tileSha256": sha} if sha else {}),
                                "faces": retained})
        if entries:
            packets[tile] = entries
    indices = {old: new for new, old in enumerate(sorted(used))}
    for members in packets.values():
        for group in members:
            for row in group["faces"]:
                row[-1] = indices[row[-1]]
    return {"profiles": [recipes[index] for index in sorted(used)], "tiles": packets}


def add_split_packet_receipts(compiled, packet_dir):
    """Record geometry after gzip/delta restoration, which is stable in every release package."""
    split = {tile: next((member["tileSha256"] for member in members if "tileSha256" in member), None)
             for tile, members in compiled["tiles"].items()}
    wanted = {tile: sha for tile, sha in split.items() if sha}
    if not wanted:
        return
    descriptors = {item["id"]: item for item in json.loads((packet_dir / "manifest.json").read_text())["chunks"]}
    compiled["splitPackets"] = {}
    for key, sha in sorted(wanted.items()):
        family, tile = key.split(":", 1)
        descriptor = descriptors[tile][family]
        packed = (packet_dir / descriptor["url"]).read_bytes()
        if hashlib.sha256(packed).hexdigest() != sha:
            raise ValueError("Original physical packet differs from its ranked wall evidence")
        packet = json.loads(gzip.decompress(packed))
        parts = []
        for index, part in enumerate(packet["meshes"]):
            if part["kind"] != "city":
                continue
            signature = 2166136261
            for attr in ("positions", "colors", "indices"):
                for byte in part[attr].encode("ascii"):
                    signature = (signature ^ byte) * 16777619 & 0xffffffff
            parts.append([index, signature])
        if not parts:
            raise ValueError("No retained city geometry in split physical packet")
        compiled["splitPackets"][key] = {"sourceSha": sha, "origin": packet["origin"], "parts": parts}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the checked-in viewer assets byte for byte")
    check = parser.parse_args().check
    compiled = compile_catalog(json.loads(RANK.read_text()), json.loads(PROFILES.read_text()),
                               json.loads(SHELL_WALLS.read_text())["targets"])
    add_split_packet_receipts(compiled, ROOT / "src/app/public/mesh/surrounding-berlin-v159")
    outputs = {
        DATA / "surveyedBuildingFacadesV377.json": compiled,
        DATA / "surveyedFacadeTilesV377.json": list(compiled["tiles"]),
    }
    for path, value in outputs.items():
        content = compact(value) + "\n"
        if check:
            if path.read_text() != content:
                raise SystemExit("Facade source/asset mismatch: " + str(path))
        else:
            path.write_text(content)
