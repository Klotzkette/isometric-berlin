"""Register the two station forecourts and the reception building's photographed openings."""
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.affinity import affine_transform, scale
from shapely.geometry import Polygon, Point, box
from build_prenzlauer_streets_v380 import Packet, parts

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"src/app/src/data"
survey=json.loads((ROOT/"geo_data/regierungsviertel/wittenberg-bahnhof-v383.json").read_bytes())
old=json.loads((DATA/"westSquaresV163Source.json").read_bytes())
cx,cz=-1974.806,1854.717
co,si=math.cos(1.218),math.sin(1.218)

def world(d,u):
    return cx+d*si+u*co,cz+d*co-u*si

def local(x,z):
    return (x-cx)*si+(z-cz)*co,(x-cx)*co-(z-cz)*si

def footprint(g):
    return affine_transform(g,[si,co,co,-si,cx,cz])

def horizontal(packet,g,paint,height,course=0):
    for p in parts(g,"Polygon"):
        for tri in sh.constrained_delaunay_triangles(p).geoms:
            v=list(sh.orient_polygons(tri,exterior_cw=True).exterior.coords)[:3]
            packet.facet([(x,height(x,z) if callable(height) else height,z) for x,z in v],paint,course)

def forecourts(packet):
    west,east=[Polygon(survey["footways"][k]) for k in ("w26369804","w26369805")]
    outer=footprint(Polygon(survey["westernInlay"]));inner=scale(outer,xfact=.83,yfact=.73,origin="centroid")
    centre=Point(*world(-44.3,.2)).buffer(2.0,quad_segs=16)
    transverse=[footprint(box(d-.48,-19,d+.48,19)) for d in survey["eastBandD"]]
    edges=[footprint(box(16,v-.40,52,v+.40)) for v in survey["eastBandU"]]
    strips=east.intersection(sh.union_all(transverse+edges))
    # Tile inlays occupy the paving geometry. Adjacent grass and roads remain visible.
    for area,colour,course in [(west.difference(outer),0xbcb7aa,.18),(outer.difference(inner),0x89877f,.16),
            (inner.difference(centre),0xbeb9ac,.18),(centre,0xc3a597,.18),
            (east.difference(strips),0xb69a8a,.28),(strips,0xd2cab7,.24)]:
        horizontal(packet,area,colour,5.79,course)

def station():
    actual={p["id"] for p in old["parts"] if p["name"]=="Wittenbergplatz pavilion"}
    roofs=[]
    for face in old["surfaces"]:
        if face["partId"] not in actual or face["kind"]!="RoofSurface":continue
        for tri in face["triangles"]:
            xyz=np.array(tri);poly=Polygon(xyz[:,[0,2]])
            if poly.area<.001:continue
            plane=np.linalg.solve(np.column_stack((xyz[:,0],xyz[:,2],np.ones(3))),xyz[:,1])
            roofs.append((poly,plane))
    occupied={}
    for x,y,z,_ in old["nativeBlocks"]:
        d,u=local(x,z)
        if abs(d)<20 and abs(u)<25:
            occupied.setdefault((x,z),set()).add(round(y,2))
    return roofs,occupied

def build(native):
    result=Packet(-4,3);forecourts(result)
    roofs,occupied=station()
    cells=[(box(x-1,z-1,x+1,z+1),max(ys)+1) for (x,z),ys in occupied.items()]
    tree=sh.STRtree([p for p,_ in cells])
    def roof(shape,paint,lift=.045):
        area=footprint(shape)
        if native:
            for i in tree.query(area,predicate="intersects"):
                square,y=cells[i]
                horizontal(result,area.intersection(square),paint,y+lift)
        else:
            for polygon,plane in roofs:
                horizontal(result,area.intersection(polygon),paint,lambda x,z:plane[0]*x+plane[1]*z+plane[2]+lift)
    # Four copper fields on the square crown and the longitudinal standing seams on the wings.
    for a,b,color in [((-7.26,-6.53),(7.26,-6.53),0x847264),((7.26,-6.53),(7.26,6.53),0x927b66),
            ((7.26,6.53),(-7.26,6.53),0x657263),((-7.26,6.53),(-7.26,-6.53),0x56685d)]:
        roof(Polygon([(0,0),a,b]),color)
    for lo,hi in [(-21.8,-6.63),(6.63,21.70)]:
        roof(box(-7.23,lo,7.23,hi),0x829182)
        for d in [-6,-5,-4,4,5,6]:roof(box(d-.023,lo,d+.023,hi),0x687965,.083)
    for lo,hi in [(-17.05,-7.44),(7.47,17.12)]:
        for start,end,c in [(-6.47,-.06,0x91a08c),(-.06,6.45,0x718574)]:
            roof(box(lo,start,hi,end),c)
        for d in np.arange(lo+.5,hi,.84):roof(box(d-.026,-6.47,d+.026,6.45),0x667b6b,.083)
    d0,d1=survey["skylightD"]
    for u0,u1 in survey["skylightU"]:
        roof(box(d0,u0,d1,u1),0x4d5751,.11)
        for k in range(13):
            a=u0+(u1-u0)*k/13;b=u0+(u1-u0)*(k+1)/13
            for start,end in [(d0,0),(0,d1)]:
                roof(box(start+.085,a+.058,end-.085,b-.058),0x90a4a3 if start<0 else 0xa9b7b1,.15)
    # Project to the exposed cardinal block faces in their own source mesh.
    # Each facade rectangle is intersected with the corresponding two-metre native face.
    def wall(sign,distance,u0,u1,y0,y1,paint,clearance=.14):
        if not native:
            vv=[]
            for u,y in [(u0,y0),(u1,y0),(u1,y1),(u0,y1)]:
                x,z=world(sign*(distance+clearance),u);vv.append((x,y,z))
            result.facet(vv[:3],paint);result.facet([vv[0],vv[2],vv[3]],paint);return
        for (x,z),heights in occupied.items():
            for axis,ds,offset in [(0,2*sign,sign),(2,2*sign,sign)]:
                if axis==2 and sign*co==0:continue
                vx,vz=(x+offset,z) if axis==0 else (x,z+offset)
                d,u=local(vx,vz)
                if abs(d-sign*distance)>1.85:continue
                tangent=-si if axis==0 else co
                low=max(u-abs(tangent),u0);high=min(u+abs(tangent),u1)
                if high<=low:continue
                neighbour=occupied.get((x+ds,z) if axis==0 else (x,z+ds),set())
                for y in heights-neighbour:
                    yl=max(y0,y-1);yh=min(y1,y+1)
                    if yh<=yl:continue
                    def pos(t,h):
                        return (vx+sign*clearance,h,z+(t-u)/tangent) if axis==0 else (x+(t-u)/tangent,h,vz+sign*clearance)
                    vv=[pos(low,yl),pos(high,yl),pos(high,yh),pos(low,yh)]
                    result.facet(vv[:3],paint);result.facet([vv[0],vv[2],vv[3]],paint)
    for sign in [-1,1]:
        # The upper copper-bordered clerestory is prominent above both entrances.
        wall(sign,7.39,-6.45,6.45,15.50,18.63,0x746a5b)
        wall(sign,7.39,-6.45,6.45,18.47,18.70,0x534e45,.21)
        for centre in [-4.30,0,4.30]:
            wall(sign,7.39,centre-1.51,centre+1.51,16.00,17.96,0x4a504b,.23)
            for k in range(5):
                u=centre-1.40+k*.56
                for yl,yh in [(16.11,16.91),(17.02,17.84)]:
                    wall(sign,7.39,u,u+.46,yl,yh,0xa1ada6,.27)
        # Shell-limestone portal, wood/metal swing doors and their broad transoms.
        for centre in [-3.34,0,3.34]:
            wall(sign,17.34,centre-1.22,centre+1.22,5.69,10.71,0x665e4c,.53)
            for k in range(3):
                u=centre-1.10+k*.74
                wall(sign,17.34,u,u+.63,5.77,8.25,0x494a3e,.56)
                wall(sign,17.34,u+.09,u+.55,7.07,8.12,0x89938a,.59)
            wall(sign,17.34,centre-1.10,centre+1.10,8.72,10.43,0xa2aea5,.57)
            wall(sign,17.34,centre-1.10,centre+1.10,9.87,9.97,0x635f50,.60)
        # Ashlar bedding courses and pediment tympanum. The existing entrance stays open.
        for u in [-5.0,-1.68,1.68,5.0]:
            for y in np.arange(6.04,12.8,.62):
                wall(sign,17.47,u-.34,u+.34,y,y+.038,0xadab9b,.55)
        wall(sign,17.46,-5.53,5.53,12.80,13.07,0xb6b5a4,.53)
        for i in range(25):
            x0=-5.48+i*10.96/25;x1=x0+10.96/25
            cap=14.43-abs((x0+x1)/2)*.233
            wall(sign,17.47,x0,x1,13.12,cap,0xcac6b4,.47)
        for k in range(12):
            a=k*math.tau/12;u=.46*math.cos(a);y=13.63+.43*math.sin(a)
            wall(sign,17.48,u-.072,u+.072,y-.072,y+.072,0xa19c87,.58)
    path=DATA/"wittenbergBahnhofV383";path.mkdir(exist_ok=True)
    result.save(path/(("native" if native else "drawn")+".json"))
    print("Wittenbergplatz",native,len(result.indices)//3,"triangles")

if __name__=="__main__":
    for native in (False,True):build(native)
