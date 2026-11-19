"""Fit native Fritz-Schloß-Park running track cells to the delivered 16 m relief."""
import json
import math
from pathlib import Path

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely import affinity, distance, points
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
PBF = ROOT / "geo_data/regierungsviertel/raw/city-v346/berlin-2026-11-13.osm.pbf"
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
OUT = ROOT / "src/app/src/data/fritzParkV366.json"
BOUNDS = (13.348, 52.524, 13.361, 52.534)
project = Transformer.from_crs(4326, 25833, always_xy=True).transform


def retained_shapes(layer, ids):
    frame = pyogrio.read_dataframe(PBF, layer=layer, bbox=BOUNDS)
    return [affinity.affine_transform(transform(project, frame.loc[frame.osm_id == item].geometry.item()),
                                     [1, 0, 0, -1, -389500, 5820000]) for item in ids]


def main():
    ids = ["157606017", "1299563542"]
    lanes = retained_shapes("lines", ids)
    widths = {p["id"].split(":")[0]: p["w"]/100
              for p in json.loads((MESH/"park-details.json").read_text())["paths"]
              if p["id"].split(":")[0] in ids}
    assert lanes[0].coords[0] == lanes[1].coords[-1] and lanes[1].coords[0] == lanes[0].coords[-1]
    g = json.loads((MESH/"ground-context.json").read_text())
    samples = g["ground_height"]
    cell = g["cell_m"]
    step = cell * samples["stride_cells"]
    left = cell * g["grid"]["min_x_idx"]
    north = cell * g["grid"]["min_z_idx"]
    def ground_dm(x,z):
        return samples["y_dm"][math.floor((z-north)/step)*samples["cols"] + math.floor((x-left)/step)]
    lo_x,lo_z,hi_x,hi_z = lanes[0].union(lanes[1]).bounds
    xs = np.arange(math.floor(lo_x)-2, math.ceil(hi_x)+2)
    runs = []
    for z in range(math.floor(lo_z)-2,math.ceil(hi_z)+2):
        centers = points(xs+.5, np.full(xs.shape,z+.5))
        da,db = [distance(lane,centers) for lane in lanes]
        present = (da <= widths[ids[0]]/2) | (db <= widths[ids[1]]/2)
        for i in np.flatnonzero(present):
            x = int(xs[i])
            field = [ground_dm(x+.5,z+.5),int(db[i]<da[i])]
            if runs and runs[-1][1]==z and runs[-1][0]+runs[-1][2]==x and runs[-1][3:]==field:
                runs[-1][2]+=1
            else:
                runs.append([x,z,1,*field])
    stones=retained_shapes("points",["1014631343","1698545931"])
    markers=[]
    for stone in stones:
        x,z=stone.coords[0]
        u,v=(x-left)/step-.5,(z-north)/step-.5
        i,j=math.floor(u),math.floor(v)
        a,b=u-i,v-j
        ys=samples["y_dm"]
        def h(di,dj):
            return ys[(j+dj)*samples["cols"]+i+di]/10
        smooth=((1-a)*h(0,0)+a*h(1,0))*(1-b)+((1-a)*h(0,1)+a*h(1,1))*b
        markers.append([round(x,3),round(z,3),round(smooth,3),ground_dm(x,z)/10])
    payload={"courseRuns":runs,"memorials":markers,"lengths":[round(l.length,2) for l in lanes]}
    OUT.write_text(json.dumps(payload,separators=(",",":"))+"\n")

if __name__=="__main__":
    main()
