"""Bake public street-survey polygons and photographed elevations around Wittenbergplatz."""
import gzip
import json
import math
from pathlib import Path

import shapely as s
from build_citywest_fronts_v379 import compile_fronts
from build_prenzlauer_streets_v380 import COLORS, COURSES, Packet, graded_walk, parts
from build_ryke_streets_v381 import assemble
from shapely.geometry import Point, Polygon, box

ROOT=Path(__file__).resolve().parents[1]
GEO=ROOT/"geo_data/regierungsviertel"
DATA=ROOT/"src/app/src/data"


def trees(source):
  existing=json.loads((ROOT/"src/app/public/mesh/regierungsviertel/park-details.json").read_text())
  old=s.STRtree([Point(r["position"][0],r["position"][2]) for r in existing["trees"]])
  result=[]
  seen=set()
  for idx,(id,street,genus,height,spread,girth,x,z) in enumerate(source["trees"]):
    if not height or not spread or not girth or (x,z) in seen or len(old.query(Point(x,z),predicate="dwithin",distance=1.7)):
      continue
    if not (1 < height < 45 and .5 < spread < 35 and 4 < girth < 850):
      continue
    seen.add((x,z))
    species={"Aesculus":0,"Tilia":1,"Platanus":2,"Acer":3,"Quercus":4}.get(genus,5)
    result.append([x,z,5.66,height,spread,girth,species,idx])
  return result


def build():
  source=json.load(gzip.open(GEO/"wittenberg-strassen-v383.json.gz"))
  scope=s.from_wkb(source["scope"])
  areas,bands,surveyed_surface=assemble(source)
  # The two named branches run between the east and west crossings at the station.
  # Retain each municipal asphalt outline; in particular the adjacent bus platforms,
  # the station island and its grass have independently measured edges.
  loop_ids={"cm_fahrbahn.41261","cm_fahrbahn.41565","cm_fahrbahn.41566",
            "cm_fahrbahn.41567","cm_fahrbahn.61503","cm_fahrbahn.61464","cm_fahrbahn.61650"}
  station=json.loads((GEO/"wittenberg-bahnhof-v383.json").read_bytes())
  place=Polygon(station["namedSquare"]["outline"])
  surveyed={id:s.from_wkb(w) for id,t,w in source["layers"]["cm_fahrbahn"]
            if id in loop_ids and t["material"]=="02"}
  assert surveyed.keys()==loop_ids
  station_loop=s.intersection(s.union_all(list(surveyed.values()),grid_size=.01),place,grid_size=.01)
  # Bus stopping areas are surveyed separately from the through lanes and waiting
  # platforms. Material 01 is concrete; the northern bay alone measures 215 m².
  bus_bays=s.union_all([Polygon(row["outline"]) for row in station["busBays"]["parts"].values()
                        if row["material"]=="01"],grid_size=.01)
  bus_bays=s.difference(bus_bays.intersection(scope),surveyed_surface,grid_size=.01)
  areas["concrete",.29]=bus_bays
  grades=[(s.from_wkb(w),.296 if t["bor"]==3 else .319) for _,t,w in source["layers"]["bd_bordstein"] if t["bor"] in (2,3)]
  ix=s.STRtree([g for g,_ in grades])
  flora=trees(source)
  directory=DATA/"wittenbergQuartierV383"
  directory.mkdir(exist_ok=True)
  xmin,zmin,xmax,zmax=scope.bounds
  hosts=[]
  bounds={}
  area_sum=0
  triangles=0
  for tx in range(math.floor(xmin/512),math.ceil(xmax/512)):
    for tz in range(math.floor(zmin/512),math.ceil(zmax/512)):
      tile=box(tx*512,tz*512,(tx+1)*512,(tz+1)*512)
      if not scope.intersects(tile):
        continue
      batch=Packet(tx,tz)
      def surface(g,tone,h):
        for poly in parts(s.intersection(g,tile,grid_size=.01),"Polygon"):
          fragments=graded_walk(poly,tone,h,grades,ix) if h in (.367,.4,.419) else [(poly,tone,h)]
          for patch,_,y in fragments:
            for part in parts(patch,"Polygon"):
              for tri in s.constrained_delaunay_triangles(part).geoms:
                coords=list(s.orient_polygons(tri,exterior_cw=True).exterior.coords)[:3]
                batch.facet([(x,5.34+(y(x,z) if callable(y) else y),z) for x,z in coords],COLORS[tone],COURSES.get(tone,0))
      for (tone,h),g in areas.items():
        # Wittenbergplatz's two measured curves replace the exposed terrain raster.
        # The adjoining Tauentzien and Kleiststraße portions retain their existing owner.
        if h <= .34:
          if (tone,h) not in {("asphalt",.29),("concrete",.29),("paint",.314)}:
            continue
          if tone!="concrete":
            g=s.intersection(g,station_loop,grid_size=.01)
          if g.is_empty:
            continue
        surface(g,tone,h)
        area_sum+=g.intersection(tile).area
      for code,h in [(1,.425),(2,.321),(3,.30)]:
        surface(bands[code],"kerb" if code==1 else "lowered",h)
        if code==1:
          for line in parts(bands[code].boundary.intersection(tile),"LineString"):
            for a,b in zip(line.coords,list(line.coords)[1:]):
              a0,a1=(a[0],5.54,a[1]),(a[0],5.34+h,a[1])
              b0,b1=(b[0],5.54,b[1]),(b[0],5.34+h,b[1])
              batch.facet([a0,a1,b1],0xaaa69b)
              batch.facet([a0,b1,b0],0xaaa69b)
      batch.trees=[f for f in flora if math.floor(f[0]/512)==tx and math.floor(f[1]/512)==tz]
      if batch.indices:
        id=f"{tx}_{tz}"
        batch.save(directory/(id+".json"))
        hosts.append(id)
        triangles+=len(batch.indices)//3
        x0,z0,x1,z1=tile.intersection(scope).bounds
        bounds[id]=[math.floor(x0),math.floor(z0),math.ceil(x1),math.ceil(z1)]
  fountains=source["publicSquares"]
  (DATA/"wittenbergQuartierIndexV383.json").write_text(json.dumps({"hosts":hosts,"bounds":bounds,"sites":fountains,"squareBounds":source["squareBounds"]},separators=(",",":"))+"\n")
  faces=compile_fronts(GEO/"wittenberg-fronts-v383.json.gz")
  (DATA/"wittenbergFrontsV383.json").write_text(json.dumps(faces,separators=(",",":"))+"\n")
  print(hosts,"paving and beds",round(area_sum),"m²,",triangles,"triangles",len(flora),"new trees")

if __name__=="__main__":
  build()
