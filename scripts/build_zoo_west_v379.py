"""Bake bounded Zoo Berlin survey geometry into independently loadable family/tile packets."""
import base64
from collections import defaultdict
import gzip
import json
import math
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles, get_parts, union_all
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
RECEIPT = ROOT / "geo_data/regierungsviertel/zoo-west-survey-v379.json.gz"
DEST = DATA / "zooWestV379Tiles"
GROUND = 5.40
HIPPO = "DEBE01YYK0002NM4"
GIRAFFE = "16970136"
HILLS = ("25036813", "25036814", "49896121")


def load(file):
    return json.loads(file.read_bytes())


def dump(file, data):
    file.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)+"\n")


def parts(shape):
    return [p for p in get_parts(shape) if p.geom_type=="Polygon" and p.area>.002]


def tris(shape):
    for p in parts(shape):
        for t in get_parts(constrained_delaunay_triangles(p)):
            yield list(t.exterior.coords)[:3]


def comp(data, kind):
    return base64.b64encode(np.asarray(data, dtype=kind).tobytes()).decode("ascii")


def tint(c, f):
    return tuple(int(np.clip(v*f,0,255)) for v in c)


class Mesh:
    """Quantise offline to centimetres. Equal coloured vertices are stored once per tile."""
    def __init__(self, native):
        self.native=native
        self.batches={}
        self.nav=defaultdict(list)
        self.water=defaultdict(list)

    def face(self, color, points, layer="solid"):
        if len(points)<3:
            return
        for i in range(1,len(points)-1):
            tri=np.asarray([points[0],points[i],points[i+1]],dtype=float)
            norm=np.cross(tri[1]-tri[0],tri[2]-tri[0]);length=math.sqrt(float(norm@norm))
            if length<.00005:
                continue
            # Static lighting in the same southeast/northwest convention as the city's drawn streets.
            norm=norm/length
            if abs(norm[1])<.0001:
                if norm[0]<-.0001 or (abs(norm[0])<.0001 and norm[2]<0):norm=-norm
            elif norm[1]<0:norm=-norm
            shade=.85+.10*abs(norm[1])+.10*norm[0]-.075*norm[2]
            rgb=tint(color,shade)
            mean=tri.mean(axis=0)
            ix,iz=math.floor(mean[0]/512),math.floor(mean[2]/512)
            key=(ix,iz,layer)
            p,c,ids,indices=self.batches.setdefault(key,([],[],{},[]))
            origin=np.array([ix*512+256,0,iz*512+256])
            for point in np.rint((tri-origin)*100).astype(int):
                record=(*point.tolist(),*rgb)
                if record not in ids:
                    ids[record]=len(p);p.append(record[:3]);c.append(rgb)
                indices.append(ids[record])

    def block(self, color,x,y,z,w,h,d):
        x0,x1=x-w/2,x+w/2;z0,z1=z-d/2,z+d/2;y0,y1=y-h/2,y+h/2
        low=[(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)]
        top=[(a,y1,c) for a,_,c in low]
        self.face(color,top)
        for i in range(4):self.face(color,[low[i],top[i],top[(i+1)%4],low[(i+1)%4]])

    def rod(self, color, a, b, w, cardinal=True):
        a,b=np.asarray(a),np.asarray(b);delta=b-a;length=np.linalg.norm(delta)
        if length<.012:return
        if self.native and cardinal:
            count=max(1,math.ceil(length/1.15))
            for i in range(count):
                x,y,z=a+delta*((i+.5)/count);d=np.maximum(w,np.abs(delta)/count)
                self.block(color,x,y,z,*d)
            return
        normal=delta/length
        axis=np.array([1.,0.,0.]) if abs(normal[0])<.85 else np.array([0.,0.,1.])
        u=np.cross(normal,axis);u=u/np.linalg.norm(u)*w*.5;v=np.cross(normal,u)
        ends=[u+v,u-v,-u-v,-u+v]
        for i in range(4):self.face(color,[a+ends[i],a+ends[(i+1)%4],b+ends[(i+1)%4],b+ends[i]])

    def polygon(self,color,g,h):
        for tri in tris(g):
            self.face(color,[(x,h,z) for x,z in tri])


def sample(grid):
    a=np.array(grid["dm"]).reshape(grid["height"],grid["width"])
    def at(x,z):
        col=np.clip(x-grid["minX"],0,a.shape[1]-1.001);row=np.clip(z-grid["minZ"],0,a.shape[0]-1.001)
        j,i=int(row),int(col);v,u=row-j,col-i
        return ((1-v)*((1-u)*a[j,i]+u*a[j,i+1])+v*((1-u)*a[j+1,i]+u*a[j+1,i+1]))/10
    return at


def relief(mesh, grid, *, glazing=False):
    g=Polygon(grid["ring"])
    minx,minz,maxx,maxz=g.bounds;at=sample(grid)
    looks=np.asarray(grid["looks"]).reshape(grid["height"],grid["width"])
    step=(1.5 if glazing else 1.35) if not mesh.native else 1.5
    top={};stone=(172,165,147)
    for ix in range(math.floor(minx/step),math.ceil(maxx/step)):
        for iz in range(math.floor(minz/step),math.ceil(maxz/step)):
            x,z=(ix+.5)*step,(iz+.5)*step
            square=box(ix*step,iz*step,(ix+1)*step,(iz+1)*step)
            p=square.intersection(g)
            if p.area<.005:continue
            h=at(x,z)
            if glazing:
                tone=.98+.085*math.sin((x+z)*.065)+.07*math.tanh((h-11)*.6)
                rgb=tint((113,149,160),tone); layer="glass"
            else:
                tone=1+.043*math.sin(x*1.3+z*.68)+.067*math.tanh((h-7)*.8)
                si=int(np.clip(round(x-grid["minX"]),0,looks.shape[1]-1))
                sj=int(np.clip(round(z-grid["minZ"]),0,looks.shape[0]-1))
                rock=[(138,139,112),(151,143,124),(150,144,130),(167,157,137),(179,169,146),(187,179,153),(195,186,160)][looks[sj,si]]
                rgb=tint(rock,tone); layer="solid"
            if mesh.native:
                if not g.covers(Point(x,z)):continue
                height=round(h*2)/2
                pt=list(square.exterior.coords)[:-1];top[ix,iz]=(height,rgb)
                mesh.face(rgb,[(u,height,v) for u,v in pt],layer)
            else:
                for tri in tris(p):
                    mesh.face(rgb,[(u,at(u,v),v) for u,v in tri],layer)
    if mesh.native:
        for (ix,iz),(h,col) in top.items():
            x,z=ix*step,iz*step
            edges=[((ix-1,iz),(x,z),(x,z+step)),((ix+1,iz),(x+step,z),(x+step,z+step)),
                   ((ix,iz-1),(x,z),(x+step,z)),((ix,iz+1),(x,z+step),(x+step,z+step))]
            for nxt,(a,b),(c,d) in edges:
                lo=top.get(nxt,(GROUND,None))[0]
                if h>lo+.01:
                    mesh.face(tint(col,.85),[(a,lo,b),(c,lo,d),(c,h,d),(a,h,b)],"glass" if glazing else "solid")
    else:
        ring=grid["ring"]
        for a,b in zip(ring,ring[1:]+ring[:1]):
            mesh.face((105,132,138) if glazing else tint(stone,.82),[(a[0],GROUND,a[1]),(b[0],GROUND,b[1]),
                (b[0],at(*b),b[1]),(a[0],at(*a),a[1])],"glass" if glazing else "solid")
    if not glazing:return
    # The building census includes the service roof beside the glasshouse. Keep this wing
    # visibly opaque, with a low wall and independently delineated glaze boundary.
    service=Polygon(grid["surveyRing"]).difference(g)
    for poly in parts(service):
        mesh.polygon((121,125,115),poly,8.86)
        for a,b in zip(poly.exterior.coords,list(poly.exterior.coords)[1:]):
            mesh.face((158,151,130),[(a[0],5.2,a[1]),(a[0],8.86,a[1]),(b[0],8.86,b[1]),(b[0],5.2,b[1])])
    # Grid pitch is engineer-published. Use the previously fitted axis in Drawn and a cardinal family in Native.
    # The actual dual-curved grid is sampled along each span, not across a flat plane.
    centre=np.array(g.centroid.coords[0]);steel=(176,189,188)
    for ang in ([0,90] if mesh.native else [35,125]):
        theta=math.radians(ang);u=np.array([math.cos(theta),math.sin(theta)]);v=np.array([-u[1],u[0]])
        pitch=3 if mesh.native else 1.2
        for i in range(-40,41):
            c=centre+v*i*pitch; clipped=g.intersection(LineString([c-u*100,c+u*100]))
            for line in get_parts(clipped):
                if line.geom_type!="LineString" or line.length<.3:continue
                n=math.ceil(line.length/(2.8 if mesh.native else 2.2))
                for j in range(n):
                    a=line.interpolate(j/n,normalized=True);b=line.interpolate((j+1)/n,normalized=True)
                    if mesh.native:
                        mid=(np.array(a.coords[0])+np.array(b.coords[0]))/2
                        y=top.get((math.floor(mid[0]/step),math.floor(mid[1]/step)),(None,None))[0]
                        if y is None:continue
                        mesh.face(steel,[(a.x-v[0]*.055,y+.038,a.y-v[1]*.055),(a.x+v[0]*.055,y+.038,a.y+v[1]*.055),
                            (b.x+v[0]*.055,y+.038,b.y+v[1]*.055),(b.x-v[0]*.055,y+.038,b.y-v[1]*.055)])
                    else:
                        mesh.face(steel,[(a.x-v[0]*.041,at(a.x,a.y)+.085,a.y-v[1]*.041),(a.x+v[0]*.041,at(a.x,a.y)+.085,a.y+v[1]*.041),
                            (b.x+v[0]*.041,at(b.x,b.y)+.085,b.y+v[1]*.041),(b.x-v[0]*.041,at(b.x,b.y)+.085,b.y-v[1]*.041)])
    loop=g.exterior
    for distance in np.arange(0,loop.length,2.8):
        a=loop.interpolate(distance);b=loop.interpolate(min(distance+2.8,loop.length))
        ah,bh=at(a.x,a.y),at(b.x,b.y)
        mesh.rod((151,159,150),(a.x,ah,a.y),(b.x,bh,b.y),.18)
        mesh.rod((117,138,139),(a.x,GROUND,a.y),(a.x,ah,a.y),.12)
        mesh.rod((191,179,146),(a.x,GROUND+.36,a.y),(b.x,GROUND+.36,b.y),.4)


def project_surface(mesh, rings, offset, col):
    """Triangulate in the dominant plane, keeping authored window/courtyard holes."""
    outer=np.array(rings[0],dtype=float);norm=np.zeros(3)
    for p,q in zip(outer,np.roll(outer,-1,axis=0)):norm+=np.cross(p-outer[0],q-outer[0])
    drop=int(np.argmax(abs(norm)))
    if abs(norm[drop])<1e-6:return
    axes=[j for j in range(3) if j!=drop];p0=outer[0]
    projected=[[tuple(np.asarray(p)[axes]) for p in ring] for ring in rings]
    polygon=Polygon(projected[0],projected[1:]).buffer(0)
    for triangle in tris(polygon):
        points=[]
        for uv in triangle:
            p=p0.copy();p[axes]=uv;p[drop]=p0[drop]-sum(norm[i]*(p[i]-p0[i]) for i in axes)/norm[drop]
            p[1]+=offset;points.append(p)
        mesh.face(col,points)


def roof_triangles(rings, offset):
    """Interpolate inside measured triangles; never extrapolate a plane across a roof ring."""
    projected=[[(x,z) for x,_,z in ring] for ring in rings]
    heights={(x,z):y+offset for ring in rings for x,y,z in ring}
    geometry=Polygon(projected[0],projected[1:]).buffer(0)
    for triangle in tris(geometry):
        # GEOS can split a self-crossing edge. Only these newly created vertices
        # need linear interpolation between the original end points of that edge.
        def height(x,z):
            if (x,z) in heights:return heights[x,z]
            nearest=min(((LineString((a,b)).distance(Point(x,z)),a,b)
                         for ring in projected for a,b in zip(ring,ring[1:]+ring[:1]) if a!=b),
                        key=lambda candidate:candidate[0])
            _,a,b=nearest
            fraction=LineString((a,b)).project(Point(x,z),normalized=True)
            return (1-fraction)*heights[a]+fraction*heights[b]
        verts=tuple(np.array([x,height(x,z),z]) for x,z in triangle)
        yield Polygon(triangle),verts


def roof_height(rr, x, z):
    best=-math.inf
    for g,(a,b,c) in rr:
        if not g.covers(Point(x,z)):continue
        n=np.cross(b-a,c-a)
        if abs(n[1])>.00001:
            best=max(best,float(a[1]-(n[0]*(x-a[0])+n[2]*(z-a[2]))/n[1]))
    return best


def house(mesh, record, name, wall, roof, base, is_giraffe=False):
    surfaces=record["surfaces"]
    floor=min(p[1] for _,rings in surfaces for r in rings for p in r)
    offset=base-floor
    rr=[];ground=[];flat=[]
    for kind,rings in surfaces:
        if kind=="GroundSurface":
            g=Polygon([(p[0],p[2]) for p in rings[0]], [[(p[0],p[2]) for p in r] for r in rings[1:]]).buffer(0)
            if g.area:ground.extend(parts(g))
        if kind not in ("GroundSurface","RoofSurface") and not mesh.native:
            project_surface(mesh,rings,offset,wall)
        if kind!="RoofSurface":continue
        for g,tri in roof_triangles(rings,offset):
            rr.append((g,tri))
            if not mesh.native:mesh.face(roof,tri)
        if name in ("Persisches Pferdehaus","Chinesischer Musikpavillon","Panda Garden","Giraffenhaus"):
            for ring in [rings[0]]:
                for p,q in zip(ring,ring[1:]+ring[:1]):
                    if np.linalg.norm(np.asarray(q)-np.asarray(p))>1.1:
                        aa=(p[0],p[1]+offset+.12,p[2]);bb=(q[0],q[1]+offset+.12,q[2])
                        mesh.rod((133,125,106) if is_giraffe else tint(roof,1.2),aa,bb,.12)
    geom=union_all(ground) if ground else union_all([g for g,_ in rr])
    if geom.is_empty or not rr:return
    poly=max(parts(geom), key=lambda g:g.area)
    # Independent 1.5 m cardinal roof cells. Only boundary/discontinuity faces have a vertical wall.
    if mesh.native:
        x0,z0,x1,z1=geom.bounds;s=1.5;cells={}
        for i in range(math.floor(x0/s),math.ceil(x1/s)):
            for j in range(math.floor(z0/s),math.ceil(z1/s)):
                h=roof_height(rr,(i+.5)*s,(j+.5)*s)
                if not math.isfinite(h):continue
                cells[i,j]=round(h*2)/2;x,z=i*s,j*s
                mesh.face(roof,[(x,cells[i,j],z),(x+s,cells[i,j],z),(x+s,cells[i,j],z+s),(x,cells[i,j],z+s)])
        for (i,j),h in cells.items():
            x,z=i*s,j*s
            for k,a,b in [((i-1,j),(x,z),(x,z+s)),((i+1,j),(x+s,z),(x+s,z+s)),((i,j-1),(x,z),(x+s,z)),((i,j+1),(x,z+s),(x+s,z+s))]:
                lo=cells.get(k,base)
                if lo+.01<h:mesh.face(wall if k not in cells else tint(roof,.89),[(a[0],lo,a[1]),(b[0],lo,b[1]),(b[0],h,b[1]),(a[0],h,a[1])])
    nav_rings=[list(poly.exterior.coords)[:-1],*[list(r.coords)[:-1] for r in poly.interiors]]
    for _,(a,b,c) in rr:
        flat.append([[round(float(v),2) for v in p] for p in (a,b,c)])
    mesh.nav[math.floor(poly.centroid.x/512),math.floor(poly.centroid.y/512)].append(dict(
        id=record["id"],rings=nav_rings,base=round(base,2),top=round(max(v[1] for _,t in rr for v in t),2),
        roof=flat))
    if is_giraffe or name in ("Persisches Pferdehaus","Panda Garden","Fasanerie","Storchenstall"):
        wall_details(mesh,name,record["id"],poly,rr,base)


def wall_details(mesh,name,ident,p,rr,base):
    # Measured outer walls control every bay. Small fittings are reconstructed from reference photos.
    ring=list(orient(p,sign=1).exterior.coords)
    species=name=="Giraffenhaus"
    curved=ident.endswith("vn9C6CeHpi")
    palette=(154,122,74) if species else ((147,53,42) if name=="Panda Garden" else (129,107,85))
    loop=p.exterior
    spacing=2.7 if curved else 3.8
    for i in range(max(1,round(loop.length/spacing))):
        along=(i+.5)*spacing
        a=loop.interpolate(along-.6);b=loop.interpolate(along+.6);pos=loop.interpolate(along)
        length=a.distance(b)
        if length<.2:continue
        dx,dz=(b.x-a.x)/length,(b.y-a.y)/length
        # An outward point must be outside this part's polygon irrespective of source winding.
        nx,nz=dz,-dx
        if p.covers(Point(pos.x+nx*.12,pos.y+nz*.12)):nx,nz=-nx,-nz
        top=roof_height(rr,pos.x-nx*.5,pos.y-nz*.5)
        if not math.isfinite(top) or top-base<2.2:continue
        off=1.02 if mesh.native else .085
        def loc(u,y,o=0):return (pos.x+dx*u+nx*(off+o),y,pos.y+dz*u+nz*(off+o))
        if species and not curved:
            if top-base<5:continue
            y=base+min(6.,(top-base)*.54)
            mesh.rod((204,182,136),loc(-1.25,y),loc(1.25,y),.19)
            mesh.rod((212,192,150),loc(-1.25,top-.65),loc(1.25,top-.65),.17)
        elif species or name!="Panda Garden":
            if curved:
                # Historic wing bays have pointed outer arches, small circular medallions and a door below.
                span=min(1.26,spacing*.45);shoulder=base+4.5;peak=min(top-.5,shoulder+1.4)
                coords=[(-span,base+.16),(-span,shoulder),(-span*.88,shoulder+(peak-shoulder)*.49),
                        (-span*.55,shoulder+(peak-shoulder)*.85),(0,peak),
                        (span*.55,shoulder+(peak-shoulder)*.85),(span*.88,shoulder+(peak-shoulder)*.49),
                        (span,shoulder),(span,base+.16)]
                for u,v in zip(coords,coords[1:]):mesh.rod((170,141,95),loc(*u,.035),loc(*v,.035),.13)
                for k in range(8):
                    a0=math.tau*k/8;a1=math.tau*(k+1)/8
                    mesh.rod((170,147,106),loc(.32*math.cos(a0),shoulder+.12+math.sin(a0)*.32,.06),
                             loc(.32*math.cos(a1),shoulder+.12+math.sin(a1)*.32,.06),.075)
                mesh.rod((191,161,110),loc(-span,base+.62,.06),loc(span,base+.62,.06),.14)
            y=base+1.1;h=min(3.4,(top-base)*.54)
            mesh.face((77,94,88),[loc(-.66,y),loc(.66,y),loc(.66,y+h*.84),loc(0,y+h),loc(-.66,y+h*.84)])
            mesh.rod(palette,loc(0,y,.018),loc(0,y+h,.018),.065)
            mesh.rod(tint(palette,1.16),loc(-.73,y+h*.74,.025),loc(.73,y+h*.74,.025),.09)
        elif top-base>3:
            mesh.rod((157,58,43),loc(0,base+.15),loc(0,top-.3),.21)

def palm_house(mesh, legacy):
    parts_by_id={p["id"]:p for p in legacy["parts"] if p["osm"]==GIRAFFE}
    for oid,p in parts_by_id.items():
        # Use the official full source with identical base datum as the existing navigation.
        e=next(q for parent in load(DATA/"zooGroundsV165Evidence.json")["parents"]
               for q in parent["sourceParts"] if q["id"]==oid)
        rec={"id":oid,"surfaces":[[s["kind"],s["rings"]] for s in e["surfaces"]]}
        court=oid.endswith("EBkxMuG68E")
        col=(124,157,160) if court else ((142,150,137) if oid.endswith("vn9C6CeHpi") else (164,158,138))
        min_y=min(v[1] for _,rings in rec["surfaces"] for r in rings for v in r)
        house(mesh,rec,"Giraffenhaus",(204,181,138),col,5.2+min_y-e["ground_y_m"],True)
        if oid.endswith("vn9C6CeHpi"):
            # Concentric animal wings are roofed separately from the palm hall. Radial
            # seams follow the curved outer bays visible on the 2026 true orthophoto.
            ring=p["ring"];wing=Polygon(ring).buffer(0);cx,cz=wing.centroid.coords[0]
            top=p["top_y_m"]+.065
            for ang in np.arange(0,math.tau,math.radians(7.5)):
                u=np.array([math.cos(ang),math.sin(ang)]);c=np.array([cx,cz])
                for line in get_parts(wing.intersection(LineString([c+u*12,c+u*40]))):
                    if line.geom_type=="LineString" and line.length>.15:
                        aa,bb=line.coords[0],line.coords[-1]
                        mesh.rod((140,155,149),(aa[0],top,aa[1]),(bb[0],top,bb[1]),.083)
        if court:
            # Iron-and-glass palm hall: ribs span the individual official roof facets.
            for s in e["surfaces"]:
                if s["kind"]!="RoofSurface":continue
                rr=s["rings"][0];g=Polygon([(v[0],v[2]) for v in rr]).buffer(0)
                if g.area<1:continue
                a=np.array(rr[0])
                n=sum((np.cross(np.array(v)-a,np.array(w)-a) for v,w in zip(rr,rr[1:]+rr[:1])),np.zeros(3))
                if abs(n[1])<.001:continue
                delta=5.2-e["ground_y_m"]
                def h(x,z):return a[1]-(n[0]*(x-a[0])+n[2]*(z-a[2]))/n[1]+delta+.13
                cx,cz=g.centroid.coords[0]
                for ang in (63,153):
                    u=np.array([math.cos(math.radians(ang)),math.sin(math.radians(ang))]);v=np.array([-u[1],u[0]])
                    for i in range(-12,13):
                        c=np.array([cx,cz])+v*i*1.5
                        for l in get_parts(g.intersection(LineString([c-u*45,c+u*45]))):
                            if l.geom_type!="LineString" or l.length<.3:continue
                            (x,z), (xx,zz)=l.coords[0],l.coords[-1]
                            mesh.rod((170,181,171),(x,h(x,z),z),(xx,h(xx,zz),zz),.10)
        if oid.endswith("lyqEefwivU"):
            # Three actual dark bays in the entrance loggia, central opening strongly taller.
            a,b=np.array(p["ring"][7]),np.array(p["ring"][0])
            uv=(b-a)/np.linalg.norm(b-a);n=np.array([uv[1],-uv[0]])
            width=np.linalg.norm(b-a)
            # Wall photographs establish three connected arches, a tiled cornice and
            # two fine intermediate columns. Their small moulding dimensions are estimates.
            front=1.28 if mesh.native else .13
            def facade(u,y,extra=0):
                q=a+uv*u+n*(front+extra);return (q[0],y,q[1])
            for y,col,w in [(5.56,(179,160,116),.21),(16.53,(209,187,140),.24),
                            (16.86,(108,134,130),.16),(17.14,(160,130,84),.28),(17.41,(212,190,144),.20)]:
                mesh.rod(col,facade(-.05,y),facade(width+.05,y),w)
            for u in [-.02,width+.02]:
                mesh.rod((184,150,98),facade(u,5.45),facade(u,16.75),.40)
                for yy in np.arange(5.72,16.6,.7):
                    mesh.rod((114,145,145),facade(u-.19,yy,.15),facade(u+.19,yy,.15),.1)
            for u in np.arange(.18,width-.1,.46):
                mesh.rod((101,125,123),facade(u,16.69,.15),facade(u+.14,16.87,.15),.085)
                mesh.rod((101,125,123),facade(u+.14,16.87,.15),facade(u+.28,16.69,.15),.085)
            for u in [width*.30,width*.70]:
                for lo,hi,w,c in [(5.46,5.77,.42,(179,157,115)),(5.77,10.54,.18,(214,195,152)),
                                  (10.54,10.73,.38,(171,146,100)),(10.73,10.92,.47,(198,177,133))]:
                    mesh.rod(c,facade(u,lo,.20),facade(u,hi,.20),w)
            for mid,r,foot,apex in [(width*.5,width*.192,10.65,15.54),(width*.191,width*.105,10.61,13.25),(width*.809,width*.105,10.61,13.25)]:
                dark=(71,75,65);front=1.28 if mesh.native else .13
                def pose(x,h,off=0):
                    v=a+uv*(mid+x)+n*(front+off);return (v[0],h,v[1])
                contour=[pose(-r,5.30),pose(r,5.30)]
                contour += [pose(math.cos(t)*r,foot+math.sin(t)*(apex-foot)) for t in np.linspace(0,math.pi,17)]
                for j in range(2,len(contour)):
                    mesh.face(dark,[contour[0],contour[j-1],contour[j]])
                for aa,bb in zip(contour[2:],contour[3:]):mesh.rod((213,192,144),aa,bb,.19)
            for idx in [7,0,4,3]:
                x,z=p["ring"][idx];y=p["top_y_m"]
                for t,rad in [(0,.48),(3.1,.42),(3.7,.61),(4.1,.37),(4.65,.50),(5.25,.24),(5.63,.075)]:
                    if mesh.native:mesh.block((145,150,111) if t>=4 else (189,164,115),x,y+t+.15,z,2*rad,.32,2*rad)
                if not mesh.native:
                    for (a,r),(b,s) in zip([(0,.48),(3.1,.43),(3.6,.64),(4.05,.4),(4.23,.29),(4.65,.51),(5.15,.35)],
                                               [(3.1,.43),(3.6,.64),(4.05,.4),(4.23,.29),(4.65,.51),(5.15,.35),(5.62,.045)]):
                        for i in range(10):
                            aa=i*math.tau/10;bb=(i+1)*math.tau/10
                            mesh.face((91,123,115) if a>4 else (204,179,133),[(x+r*math.cos(aa),y+a,z+r*math.sin(aa)),(x+r*math.cos(bb),y+a,z+r*math.sin(bb)),(x+s*math.cos(bb),y+b,z+s*math.sin(bb)),(x+s*math.cos(aa),y+b,z+s*math.sin(aa))])
                else:
                    mesh.block((190,165,122),x,y+1.7,z,.8,3.4,.8)
                mesh.rod((146,130,86),(x,y+5.5,z),(x,y+6.18,z),.075)


def giraffes(mesh, inventory):
    for oid,kind,yaw in [("13903554893","retic",.42),("13903554894","kordofan",1.86),("14068130264","okapi",-.78)]:
        ent=next(f for f in inventory["features"] if f["id"]==oid)
        x,z=ent["coordinates"];scale=.91 if kind=="kordofan" else 1.
        ok=kind=="okapi"; yaw=round(yaw/(math.pi/2))*math.pi/2 if mesh.native else yaw
        u=np.array([math.cos(yaw),math.sin(yaw)]); v=np.array([-u[1],u[0]])
        def loc(X,Y,Z):
            xz=np.array([x,z])+scale*(u*X+v*Z);return (xz[0],GROUND+Y*scale,xz[1])
        coat=(134,90,66) if ok else (218,179,117)
        patch=(112,74,51) if ok else ((146,93,59) if kind=="retic" else (154,110,73))
        def member(a,b,w,col):mesh.rod(col,loc(*a),loc(*b),w*scale)
        height=1.5 if ok else 2.75
        member((-.70,height+.03,0),(.55,height+.27,0),.75,coat)
        for xx in [-.55,.56]:
            for zz in [-.23,.23]:
                member((xx,height+.18,zz),(xx*.98-.05,.7,zz),.145,coat)
                member((xx*.98-.05,.7,zz),(xx+.07,.12,zz),.105,(203,177,139))
                if ok and xx<0:
                    for yy in (.55,.7,.85,1.,1.15):member((xx,yy,zz),(xx,yy+.055,zz),.147,(213,199,173))
        neck=2.2 if not ok else .78
        head=(.92+neck*.19,height+neck+.13,0)
        member((.48,height+.3,0),head,.295,coat)
        member(head,(head[0]+.42,head[1]-.12,.0),.23,coat)
        for j in range(4 if not ok else 0):
            t=j/4;xx=.56+(head[0]-.56)*t;yy=height+.38+neck*t
            member((xx,yy,.14),(xx+.07,yy+.125,.14),.095,patch)
            member((xx,yy,-.14),(xx+.07,yy+.125,-.14),.095,patch)
        for xx in [-.53,-.22,.10,.40]:
            for zz in [-.37,.37]:
                member((xx,height+.07,zz),(xx+.10,height+.25,zz),.14,patch)
        for side in [-1,1]:
            member((head[0]-.06,head[1],side*.07),(head[0]-.15,head[1]+.22,side*.12),.065,patch)
            member((head[0]-.05,head[1],side*.08),(head[0]-.16,head[1]+.06,side*.27),.085,coat)
        member((-.71,height+.12,0),(-.95,height-.45,0),.043,patch)


def ponds(mesh, inventory):
    bank=json.loads(gzip.decompress((ROOT/"geo_data/regierungsviertel/zoo-west-ponds-v379.json.gz").read_bytes()))
    occupied=union_all([Polygon(w["ring"]).buffer(0) for w in inventory["waters"]])
    water=[]
    for pond in bank["features"]:
        missing=shape(pond["geometry"]).difference(occupied).simplify(.08,preserve_topology=True)
        for g in parts(missing):
            if g.area<1:continue
            water.append(g)
            # The landward toe is intentionally restricted to the surveyed water side.
            # All mapped islands stay clear. No external rectangular veil covers the park.
            mesh.polygon((114,147,143),g,5.545)
            inner=g.buffer(-.72,quad_segs=2)
            mesh.polygon((89,131,135),inner,5.58)
            rings=[list(g.exterior.coords)[:-1],*[list(r.coords)[:-1] for r in g.interiors]]
            mesh.water[math.floor(g.centroid.x/512),math.floor(g.centroid.y/512)].append(rings)
    return union_all(water)


def grounds(mesh, inventory, old):
    # Old ground already contains the union after clipping buildings, water and habitat floors.
    # Intersect with this exact walking area before varying its material.
    mapped=union_all([Polygon(g["rings"][0],g["rings"][1:]).buffer(0) for g in inventory["groundPolygons"] if g["kind"]=="paths"])
    surfaces=defaultdict(list)
    for path in inventory["paths"]:
        mat=path.get("surface","")
        if mat in ("paving_stones","sett","concrete","asphalt","fine_gravel","gravel","compacted","sand"):
            surfaces[mat].append(LineString(path["line"]).buffer(path["width"]/2,quad_segs=2))
    colors={"paving_stones":(185,178,163),"sett":(163,157,145),"concrete":(183,179,163),"asphalt":(136,134,124),
        "fine_gravel":(198,185,155),"gravel":(193,180,149),"compacted":(191,175,145),"sand":(205,189,153)}
    occupied=None
    # These tone changes are on confirmed walking surfaces in both representations.
    for mat,segs in surfaces.items():
        g=union_all(segs).intersection(mapped)
        if occupied is not None:g=g.difference(occupied)
        occupied=g if occupied is None else union_all([occupied,g])
        simplified=g.simplify(.11,preserve_topology=True)
        mesh.polygon(colors[mat],simplified,5.53)


def trees(mesh, crowns):
    # Each point is a measured canopy maximum, never an inferred species or an inventory of trunks.
    for i,(x,z,h,r) in enumerate(crowns):
        leaf=[(91,121,77),(100,127,81),(104,127,85),(86,116,78),(108,132,83)][i%5]
        mesh.block((100,90,73),x,GROUND+h*.28,z,max(.19,r*.11),h*.56,max(.19,r*.11))
        if mesh.native:
            for w,y,hh in [(1.45,.56,.32),(1.76,.71,.19),(1.16,.84,.15),(.62,.94,.12)]:
                mesh.block(leaf,x,GROUND+h*y,z,r*w,h*hh,r*w)
        else:
            spec=[(.35,.44),(.55,.92),(.74,1),(.91,.69),(1,.14)]
            for j,((y0,r0),(y1,r1)) in enumerate(zip(spec,spec[1:])):
                for n in range(7):
                    a=n*math.tau/7+i*.46;b=(n+1)*math.tau/7+i*.46
                    radius=lambda k:r*(.95+.075*math.sin(k*2.41+i))
                    faces=[(x+math.cos(a)*radius(n)*r0,GROUND+y0*h,z+math.sin(a)*radius(n)*r0),
                           (x+math.cos(b)*radius(n+1)*r0,GROUND+y0*h,z+math.sin(b)*radius(n+1)*r0),
                           (x+math.cos(b)*radius(n+1)*r1,GROUND+y1*h,z+math.sin(b)*radius(n+1)*r1),
                           (x+math.cos(a)*radius(n)*r1,GROUND+y1*h,z+math.sin(a)*radius(n)*r1)]
                    mesh.face(tint(leaf,.85+j*.057),faces)


def surface_polygon(r):
    return Polygon([(p[0],p[2]) for p in r[0]],[[(p[0],p[2]) for p in ring] for ring in r[1:]]).buffer(0)


def open_shelter(mesh, site, part, base):
    """Open pavilion/column gallery on surveyed supports, with the traced eaves left in place."""
    ground=next(rings for kind,rings in part["surfaces"] if kind=="GroundSurface")
    ring=ground[0]
    ground_y=ring[0][1];offset=base-ground_y
    roof=[rs for kind,rs in part["surfaces"] if kind=="RoofSurface"]
    eave=min(p[1] for rs in roof for r in rs for p in r)+offset
    g=surface_polygon(ground);cx,cz=g.centroid.coords[0]
    panda=site=="Chinesischer Musikpavillon"
    color=(83,110,99) if panda else (162,160,145)
    wall=(159,66,50) if panda else (208,197,166)
    rr=[]
    for rings in roof:
        for g2,tri in roof_triangles(rings,offset):
            rr.append((g2,tri))
            if not mesh.native:mesh.face(color,tri)
    if mesh.native:
        xmin,zmin,xmax,zmax=g.bounds
        for ix in range(math.floor(xmin),math.ceil(xmax)):
            for iz in range(math.floor(zmin),math.ceil(zmax)):
                h=roof_height(rr,ix+.5,iz+.5)
                if math.isfinite(h):
                    mesh.block(color,ix+.5,round(h*2)/2-.27,iz+.5,1,.55,1)
    groundRing=[(x,z) for x,_,z in ring]
    for i,(a,b) in enumerate(zip(groundRing,groundRing[1:]+groundRing[:1])):
        if math.dist(a,b)<1.0:continue
        mesh.rod((122,139,121) if panda else (191,183,158),(a[0],eave,a[1]),(b[0],eave,b[1]),.30)
        d=.08 if panda else .11
        x=a[0]+d*(cx-a[0]);z=a[1]+d*(cz-a[1])
        mesh.rod(wall,(x,base+.28,z),(x,eave-.17,z),.34 if panda else .47)
        mesh.block((158,153,131),x,base+.25,z,.62,.20,.62)
        mesh.block(wall,x,eave-.30,z,.60,.19,.60)
        if panda:
            mesh.rod((167,74,56),(x,base+1.02,z),(b[0]+d*(cx-b[0]),base+1.02,b[1]+d*(cz-b[1])),.11)
            mesh.rod((192,170,111),(x,eave-.58,z),(b[0]+d*(cx-b[0]),eave-.58,b[1]+d*(cz-b[1])),.16)
            out=np.array(a)-[cx,cz];out/=np.linalg.norm(out)
            # Upturned eave at each octagonal corner on the operator's reconstructed music pavilion.
            mesh.rod((100,125,105),(a[0]-out[0]*.55,eave,a[1]-out[1]*.55),(a[0]+out[0]*.44,eave+.32,a[1]+out[1]*.44),.18)
    coords=list(g.exterior.coords)[:-1]
    mesh.nav[math.floor(cx/512),math.floor(cz/512)].append({"id":part["id"],"rings":[coords],"base":round(eave-.3,2),
        "top":round(max(pt[1] for _,tri in rr for pt in tri),2),"roof":[[[float(v) for v in pt] for pt in tri] for _,tri in rr]})
    mesh.polygon((175,164,143),g,base+.28)
    if not panda:
        # The pump housing closes the south end of the registered north-facing portico.
        a,b=groundRing[-2],groundRing[-1]
        mesh.face((146,143,122),[(a[0],base+.25,a[1]),(b[0],base+.25,b[1]),(b[0],eave,b[1]),(a[0],eave,a[1])])
        for q in (.25,.5,.75):
            edge=np.array(groundRing[3])*(1-q)+np.array(groundRing[4])*q
            mesh.rod((202,194,166),(edge[0],base+.37,edge[1]),(edge[0],eave-.18,edge[1]),.44)
    else:
        roof_top=max(p[1] for rs in roof for r in rs for p in r)+offset
        mesh.rod((184,154,96),(cx,roof_top-.05,cz),(cx,roof_top+.72,cz),.14)


def persian_dome(mesh,part,offset):
    # Dated monument photograph shows a round domed crown and light drum on this
    # specific tower. Retain the official plan, eaves and maximum roof elevation.
    roof=[v for kind,rs in part["surfaces"] if kind=="RoofSurface" for r in rs for v in r]
    g=surface_polygon(next(rs for kind,rs in part["surfaces"] if kind=="GroundSurface"))
    x,z=g.centroid.coords[0]
    lo=min(v[1] for v in roof)+offset;hi=max(v[1] for v in roof)+offset
    radius=math.sqrt(g.area/math.pi);nodes=[(lo-.35,radius*.96),(lo+.17,radius*1.03),(lo+.33,radius*1.04),
        (lo+.50,radius*1.02),(lo+(hi-lo)*.51,radius*.82),(lo+(hi-lo)*.74,radius*.6),(lo+(hi-lo)*.91,radius*.31),(hi+.05,.12)]
    for j,((h,r),(top,r2)) in enumerate(zip(nodes,nodes[1:])):
        for k in range(16):
            a=k*math.tau/16;b=(k+1)*math.tau/16
            if mesh.native:
                if k==0:mesh.block((184,185,168) if j>1 else (123,150,149),x,(h+top)/2,z,max(.1,1.78*r),top-h,max(.1,1.78*r))
            else:
                mesh.face((181,188,178) if j>1 else (118,151,150),[(x+math.cos(a)*r,h,z+math.sin(a)*r),(x+math.cos(b)*r,h,z+math.sin(b)*r),(x+math.cos(b)*r2,top,z+math.sin(b)*r2),(x+math.cos(a)*r2,top,z+math.sin(a)*r2)])
    mesh.rod((159,143,99),(x,hi,z),(x,hi+.57,z),.07)


def additional_houses(mesh, houses):
    colors={"18438821":(193,175,145),"17955053":(178,157,128),"18340403":(161,139,112),"18439324":(163,143,116),
        "18440289":(161,140,118),"497420475":(177,95,73),"497420474":(178,72,54),"48132339":(202,191,159),
        "17957388":(177,157,118),"618256709":(138,137,105),"25205539":(157,141,118),"25205541":(148,137,119)}
    for osm,site in houses.items():
        if not site["parts"]:continue
        lo=min(v[1] for part in site["parts"] for kind,rings in part["surfaces"] for ring in rings for v in ring)
        for part in site["parts"]:
            floor=min(p[1] for _,rs in part["surfaces"] for r in rs for p in r)
            rgb=part["roofRgb"] or [120,123,110]
            # Aerial sample is only a colour cue. Bound dark shadows and avoid reproducing image pixels.
            roof=tuple(max(78,min(180,round(.75*q+33))) for q in rgb)
            if osm=="497420474" or part["id"].endswith("0003TzL"):
                open_shelter(mesh,site["name"],part,5.2+floor-lo)
                continue
            house(mesh,part,site["name"],colors[osm],roof,5.2+floor-lo)
            if part["id"].endswith("jaB0GWuD"):
                persian_dome(mesh,part,5.2-lo)


def make_legacy(survey,old):
    chosen=[p for p in old["parts"] if p["id"]==HIPPO or p["osm"]==GIRAFFE]
    cover=union_all([Polygon(p["ring"]) for p in chosen]).buffer(1.25)
    ax,az,bx,bz=cover.bounds
    def selected(r):
        x,z=r[0],r[2]
        return ax<=x<=bx and az<=z<=bz and cover.covers(Point(x,z))
    def runs(rows):
        groups=[]
        for i,r in enumerate(rows):
            if selected(r):
                if groups and groups[-1][1]+1==i:groups[-1][1]=i
                else:groups.append([i,i])
        return groups
    animals={}
    for oid in HILLS:
        grid=survey["grids"][oid];at=sample(grid);lx,lz,hx,hz=Polygon(grid["ring"]).bounds
        animals[oid]=[round(at((lx+hx)/2+dx,(lz+hz)/2+dz),2) for dx,dz in [(-3,2),(2,-3),(5,3)]]
    out={"parts":[p["id"] for p in chosen],"facades":runs(old["facadeBoxes"]),"rows":runs(old["nativeRows"]),"animals":animals}
    dump(DATA/"zooWestV379Legacy.json",out)
    fields={}
    for key,grid in survey["grids"].items():
        fields[key]={k:grid[k] for k in ["ring","width","height","minX","minZ"]}
        fields[key]["dm"]=comp(grid["dm"],"u1")
    dump(DATA/"zooWestV379Heights.json",fields)
    return out


def save_geometry(mesh,sites):
    fmt="native" if mesh.native else "drawn"
    offsets={}
    for (ix,iz,layer),(p,c,rows,inds) in sorted(mesh.batches.items()):
        name=f"{ix}_{iz}"
        hosts=offsets.setdefault(name,{"origin":[ix*512+256,iz*512+256],"meshes":{},"buildings":mesh.nav[ix,iz],"water":mesh.water[ix,iz]})
        p=np.asarray(p)
        assert np.max(np.abs(p))<32768, (name,p.min(axis=0),p.max(axis=0))
        ib=4 if len(p)>65535 else 2
        # GPU-ready centimetres, normalised normals and linear colours. No normal generation,
        # sRGB conversion or Float32 position expansion on the interactive thread.
        ti=np.array(inds).reshape(-1,3)
        vec=np.cross(p[ti[:,1]]-p[ti[:,0]],p[ti[:,2]]-p[ti[:,0]]).astype(float)
        flip=vec[:,1]<0
        vec[flip]*=-1
        normals=np.zeros(p.shape,dtype=float)
        for column in range(3):np.add.at(normals,ti[:,column],vec)
        n=np.linalg.norm(normals,axis=1)
        normals/=np.maximum(n[:,None],1e-9)
        channel=np.arange(256)/255.
        lut=np.rint(255*np.where(channel<=.04045,channel/12.92,((channel+.055)/1.055)**2.4)).astype("u1")
        low,high=p.min(axis=0),p.max(axis=0)
        centre=(low+high)/2
        radius=math.ceil(max(np.linalg.norm(v-centre) for v in (low,high)))
        hosts["meshes"][layer]={"positions":comp(p,"<i2"),"colors":comp(lut[c],"u1"),"normals":comp(np.rint(normals*127),"i1"),
            "indices":comp(inds,"<u4" if ib==4 else "<u2"),"indexBytes":ib,"sphere":[*centre,radius],
            "bounds":list(map(float,[*low,*high]))}
        bb=[ix*512+256+p[:,0].min()/100,iz*512+256+p[:,2].min()/100,
            ix*512+256+p[:,0].max()/100,iz*512+256+p[:,2].max()/100]
        old=sites.setdefault(name,bb)
        sites[name]=[min(bb[0],old[0]),min(bb[1],old[1]),max(bb[2],old[2]),max(bb[3],old[3])]
    for name,p in offsets.items():
        dump(DEST/(fmt+"_"+name+".json"),p)
    print(fmt,len(offsets),"tiles",sum(len(x[3])//3 for x in mesh.batches.values()),"triangles",flush=True)


def build():
    DEST.mkdir(exist_ok=True)
    survey=json.loads(gzip.decompress(RECEIPT.read_bytes()))
    old=load(DATA/"zooGroundsV165Source.json")
    inventory=load(DATA/"zooGroundsV165Evidence.json")
    make_legacy(survey,old)
    sites={}
    for native in [False,True]:
        mesh=Mesh(native)
        for k,grid in survey["grids"].items():relief(mesh,grid,glazing=k==HIPPO)
        palm_house(mesh,old)
        giraffes(mesh,inventory)
        additional_houses(mesh,survey["houses"])
        grounds(mesh,inventory,old)
        water=ponds(mesh,inventory)
        trees(mesh,[row for row in survey["crowns"] if not water.covers(Point(row[0],row[1]))])
        save_geometry(mesh,sites)
    dump(DATA/"zooWestV379Hosts.json",sites)

if __name__=="__main__":build()
