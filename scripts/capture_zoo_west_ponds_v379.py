"""Extract complete mapped zoo ponds including interior rings, from the dated Berlin OSM extract."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import osmium
from shapely import from_wkb,make_valid
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, mapping
from shapely.ops import transform
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"geo_data/regierungsviertel/zoo-west-ponds-v379.json.gz"


def capture(pbf):
    old=json.loads((ROOT/"src/app/src/data/zooGroundsV165Source.json").read_bytes())
    site=Polygon(old["zooRing"]).buffer(0)
    project=Transformer.from_crs(4326,25833,always_xy=True)
    source=osmium.FileProcessor(str(pbf)).with_locations().with_areas()
    factory=osmium.geom.WKBFactory()
    ponds=[]
    for item in source:
        if not item.is_area() or item.from_way() or item.tags.get("natural")!="water":
            continue
        if item.tags.get("water") in ("canal","river") or item.orig_id() in (26993,22807):continue
        outer=next(iter(item.outer_rings()),None)
        if outer is None:continue
        pos=outer[0].location
        if not 13.325<pos.lon<13.353 or not 52.496<pos.lat<52.52:continue
        measured=make_valid(affine_transform(transform(project.transform,from_wkb(factory.create_multipolygon(item))),[1,0,0,-1,-389500,5820000]))
        clipped=measured.intersection(site)
        if clipped.area<40 or clipped.area/measured.area<.95:continue
        ponds.append({"id":"relation/"+str(item.orig_id()),"name":item.tags.get("name",""),
            "geometry":mapping(clipped),"area":round(clipped.area,2)})
    packet=dict(url="https://download.geofabrik.de/europe/germany/berlin-261122.osm.pbf",
        sha256=hashlib.file_digest(pbf.open("rb"),"sha256").hexdigest(),features=ponds)
    OUT.write_bytes(gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(",",":")).encode(),mtime=0))
    print(len(ponds),"ponds",sum(p["area"] for p in ponds),"m²")

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf",type=Path)
    capture(parser.parse_args().pbf)
