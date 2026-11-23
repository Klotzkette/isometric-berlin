"""Associate each complete replacement house with its exact previous prism and exclusive 4 m columns."""
import gzip
import json
from pathlib import Path
from shapely import STRtree, make_valid, union_all
from shapely.geometry import Polygon, box

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"src/app/src/data"
BASE=ROOT/"src/app/public/mesh/regierungsviertel"


def shape(p):
    return make_valid(Polygon([(x/10,z/10) for x,z in p["ring"]],
                              [[(x/10,z/10) for x,z in r] for r in p.get("holes",[])]))


def main():
    survey=json.loads(gzip.decompress((ROOT/"geo_data/regierungsviertel/zoo-west-survey-v379.json.gz").read_bytes()))
    features=json.loads((DATA/"zooGroundsV165Evidence.json").read_bytes())["features"]
    ways={f["id"]:f for f in features if f["type"]=="way"}
    bulk=json.loads((BASE/"lod2-prisms.json").read_bytes())["buildings"]
    close=[p for p in bulk if p["ring"] and any(-28000<x<-16000 and 4500<z<15500 for x,z in p["ring"])]
    geoms=[shape(p) for p in close];tree=STRtree(geoms)
    owned=set();sites={}
    for osm,site in survey["houses"].items():
        if not site["parts"]:continue
        osm_shape=make_valid(Polygon(ways[osm]["coordinates"]))
        ground=union_all([make_valid(Polygon([(x,z) for x,_,z in rings[0]])) for part in site["parts"] for kind,rings in part["surfaces"] if kind=="GroundSurface"])
        owners=[]
        for i in tree.query(osm_shape):
            g=geoms[i];rec=close[i];area=g.area
            if area<=0 or osm_shape.intersection(g).area/area<.74:continue
            # Many former town-wide fallbacks are the mapped way, clipped to eight id digits.
            # Panda Garden includes an open courtyard in that mapped outline and is not 994 m² of roof.
            named=rec["id"] in (osm,osm[-8:])
            exact=any(part["id"].endswith(rec["id"]) for part in site["parts"])
            if exact or (named and ground.intersection(g).area/area>.35):
                owned.add(i);owners.append(rec["id"])
        sites[osm]=owners
    originals=[close[i] for i in sorted(owned)]
    selected=union_all([geoms[i] for i in owned]);expanded=selected.buffer(7)
    neighbours=[int(i) for i in tree.query(expanded,predicate="intersects") if i not in owned]
    others=union_all([geoms[i] for i in neighbours])
    voxel=json.loads((BASE/"minecraft-voxels.json").read_bytes());grid=voxel["grid"];cell=voxel["cell_m"]
    cols=[];shared=0;x0,z0,x1,z1=selected.bounds
    for k,row in enumerate(voxel["building_rows"]):
        iz=grid["min_z_idx"]+k
        if not z0-cell<=iz*cell<=z1:continue
        for ofs,count,low,high,kind in row:
            start=grid["min_x_idx"]+ofs
            for ix in range(max(start,int(x0//cell)),min(start+count,int(x1//cell)+1)):
                square=box(ix*cell,iz*cell,(ix+1)*cell,(iz+1)*cell)
                if selected.intersection(square).area<.001:continue
                if others.intersection(square).area>.001:shared+=1;continue
                cols.append([ix,iz,low,high,kind])
    assert originals and cols and all(names for names in sites.values()),sites
    # Keep original ordered arrays as evidence. Fingerprint all fields participating in the renderer.
    payload=dict(previousPrisms=originals,neighbours=[close[i] for i in sorted(neighbours)],
                 sites=sites,columns=cols,cell=cell,bounds=[round(v,2) for v in selected.bounds],shared=shared)
    (DATA/"zooWestV379Ownership.json").write_text(json.dumps(payload,separators=(",",":"))+"\n")
    print(len(originals),"previous sources",len(cols),"exclusive columns",shared,"shared",sites)

if __name__=="__main__":main()
