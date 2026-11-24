"""Capture two named street corridors from a Berlin OSM PBF and Geoportal WFS."""
import argparse
import gzip
import json
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import osmium
import shapely
from pyproj import Transformer
from shapely import LineString
from shapely.affinity import affine_transform
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/prenzlauer-streets-v380-source.json.gz"
LAYERS = """cm_fahrbahn ck_parkflaeche cl_gehweg bn_baumscheibe ce_gruenflaeche
    ch_radweg cf_trennstreifen by_gehwegueberfahrt cb_haltestellenwartebereich
    bw_aufmerksamkeitsfeld bd_bordstein be_fahrbahnmarkierunglinie bp_fahrbahnmarkierung_flaeche""".split()
NAMES = {"Kastanienallee", "Oderberger Straße"}


def osm_rows(pbf):
    to_utm = Transformer.from_crs(4326, 25833, always_xy=True).transform
    axes, tracks, green = [], [], []
    for way in osmium.FileProcessor(str(pbf)).with_locations():
        if not way.is_way() or len(way.nodes) < 2:
            continue
        axis = way.tags.get("name") in NAMES and way.tags.get("highway")
        if not axis and way.tags.get("railway") != "tram":
            continue
        point = way.nodes[0].location
        if not point.valid() or not (13.39 < point.lon < 13.44 and 52.523 < point.lat < 52.555):
            continue
        coords = [to_utm(n.location.lon, n.location.lat) for n in way.nodes]
        local = [[round(x - 389500, 2), round(5820000 - y, 2)] for x, y in coords]
        if axis:
            axes.append([way.id, way.tags["name"], local])
            for side in ("left", "right"):
                lane_type = way.tags.get("cycleway:" + side, way.tags.get("cycleway:both"))
                color = way.tags.get("cycleway:" + side + ":surface:colour", way.tags.get("cycleway:surface:colour"))
                if color == "green" and lane_type in ("lane", "track"):
                    green.append([way.id, side, lane_type])
        else:
            tracks.append([way.id, way.tags.get("gauge", "1435"), local])
    return sorted(axes), sorted(tracks), sorted(green)


def get_layer(cache, name):
    dest = cache / (name + ".json.gz")
    if not dest.exists():
        service = {"strassenbaeume":"baumbestand", "b_radverkehrsanlagen":"radverkehrsanlagen"}.get(name, "strassenbefahrung")
        params = urlencode(dict(service="WFS", version="2.0.0", request="GetFeature",
            typeNames=service + ":" + name, srsName="EPSG:25833", outputFormat="application/json",
            count=20000, bbox="391733,5821502,392337,5822400,EPSG:25833"))
        request = Request("https://gdi.berlin.de/services/wfs/" + service + "?" + params,
                          headers={"User-Agent": "Isometric-Berlin survey capture"})
        with urlopen(request, timeout=90) as response:
            dest.write_bytes(gzip.compress(response.read(), mtime=0))
    payload = json.loads(gzip.decompress(dest.read_bytes()))
    if payload["numberMatched"] != len(payload["features"]):
        raise ValueError("Truncated WFS layer " + name)
    return payload["features"]


def capture(pbf, cache):
    axes, tracks, green = osm_rows(pbf)
    scope = shapely.union_all([LineString(row[2]) for row in axes]).buffer(18, cap_style="flat")
    source = dict(crs="EPSG:25833", axes=axes, green=green, cycleRoutes=[], rails=[], layers={}, trees=[])
    for ots, gauge, coords in tracks:
        line = LineString(coords).intersection(scope)
        for part in shapely.get_parts(line):
            if part.length > 0.08:
                source["rails"].append([ots, int(gauge), mapping(shapely.set_precision(part, .01))])
    with ThreadPoolExecutor(max_workers=4) as pool:
        layers = list(pool.map(lambda name: get_layer(cache, name), LAYERS + ["strassenbaeume","b_radverkehrsanlagen"]))
    for name, records in zip(LAYERS + ["strassenbaeume","b_radverkehrsanlagen"], layers):
        if name in LAYERS:
            source["layers"][name] = []
        for feature in sorted(records, key=lambda f: f["id"]):
            geom = affine_transform(shape(feature["geometry"]), [1, 0, 0, -1, -389500, 5820000])
            if not scope.intersects(geom):
                continue
            props = feature["properties"]
            if name == "b_radverkehrsanlagen":
                if props["stst_str"] in NAMES:
                    source["cycleRoutes"].append([feature["id"], props["rva_typ"], props["sorvt_typ"],
                        mapping(shapely.set_precision(geom.intersection(scope), .01))])
            elif name == "strassenbaeume":
                pt = shapely.get_parts(geom)[0]
                source["trees"].append([props["gisid"], props["gattung"], props["baumhoehe"],
                    props["kronedurch"], props["stammumfg"], round(pt.x, 2), round(pt.y, 2)])
            else:
                geom = shapely.set_precision(shapely.make_valid(geom).intersection(scope), .01)
                if not geom.is_empty:
                    code = props.get("material") or props.get("bor_") or props.get("fbl") or ""
                    source["layers"][name].append([feature["id"], code, mapping(geom)])
    packed = json.dumps(source, ensure_ascii=False, separators=(",", ":")).encode()
    SOURCE.write_bytes(gzip.compress(packed, mtime=0))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf", type=Path)
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        cache = args.cache or Path(directory)
        cache.mkdir(exist_ok=True, parents=True)
        capture(args.pbf, cache)
