"""Build tile- and style-local streets from the retained survey (Shapely >= 2.1)."""
import base64
import filecmp
import gzip
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely import LineString, Point, Polygon, box
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/prenzlauer-streets-v380-source.json.gz"
OUT = DATA / "prenzlauerStreetsV380"
PROFILE = json.loads((DATA / "weinbergTerrainV176.json").read_bytes())
WEST, NORTH, EAST, SOUTH = PROFILE["support"]
HEIGHTS = PROFILE["offsets"]
# Footways and setts use the Berlin inventory's material classes, the companion
# shader modulates joints at walking scale only. Course sizes are estimates.
COLORS = {
    "asphalt": 0x696b6a, "carriage-setts": 0x938e85, "parking": 0x969187,
    "mosaic": 0xb3aa9a, "small-setts": 0xaaa496, "slabs": 0xc2bbab,
    "concrete-slab": 0xbcb7a9, "concrete": 0xb0aea6, "other": 0xa8a398, "pavers": 0xb4ada1, "foot-asphalt": 0x96958f, "earth": 0x89816b,
    "grass": 0x81906d, "cycle": 0xa48a7b, "platform": 0xb5b2a8,
    "tactile": 0xd8d3c3, "kerb": 0xc4c0b4, "lowered": 0xaaa79f,
    "paint": 0xd7d3c4, "green-cycle": 0x598578, "rail-bed": 0x565953, "rail": 0xadb2ab,
}
COURSES = {"carriage-setts": .18, "parking": .31, "mosaic": .05,
           "small-setts": .09, "slabs": .72, "concrete-slab": .35, "pavers": .24, "platform": .53}
WALK = {"01":"concrete", "02":"foot-asphalt", "03":"mosaic", "04":"small-setts",
        "05":"carriage-setts", "06":"pavers", "07":"concrete-slab", "08":"slabs",
        "09":"slabs", "10":"slabs", "14":"earth", "15":"grass", "17":"other"}
LAYERS = {
    "cm_fahrbahn": (.205, "asphalt"), "ck_parkflaeche": (.222, "parking"),
    "cl_gehweg": (.33, "slabs"), "ch_radweg": (.337, "cycle"),
    "cf_trennstreifen": (.345, "mosaic"), "by_gehwegueberfahrt": (.345, "small-setts"),
    "bn_baumscheibe": (.353, "earth"), "cb_haltestellenwartebereich": (.36, "platform"),
    "bw_aufmerksamkeitsfeld": (.37, "tactile"), "ce_gruenflaeche": (.348, "grass"),
    "bd_bordstein": (.38, "kerb"), "be_fahrbahnmarkierunglinie": (.232, "paint"),
    "bp_fahrbahnmarkierung_flaeche": (.235, "paint"),
}


def parts(g, kind):
    if g.is_empty:
        return
    if g.geom_type == kind:
        yield g
    elif hasattr(g, "geoms"):
        for p in g.geoms:
            yield from parts(p, kind)


def offset(x, z):
    if not (WEST < x < EAST and NORTH < z < SOUTH):
        return 0
    u, v = (x - WEST) / 10, (z - NORTH) / 10
    ix, iz = math.floor(u), math.floor(v)
    a, b = u - ix, v - iz
    nw, ne = HEIGHTS[iz][ix:ix+2]
    sw, se = HEIGHTS[iz+1][ix:ix+2]
    return nw*(1-a) + ne*(a-b) + se*b if a >= b else nw*(1-b) + sw*(b-a) + se*a


class Terrain:
    """Cut only sloped regions. Tessellation operates on complete surveyed rings."""
    def __init__(self, native, scope):
        step = 4 if native else 10
        cells, values = [], []
        x0, z0, x1, z1 = scope.bounds
        for x in range(math.floor(max(WEST,x0)/step)*step, math.ceil(min(EAST,x1)/step)*step, step):
            for z in range(math.floor(max(NORTH,z0)/step)*step, math.ceil(min(SOUTH,z1)/step)*step, step):
                square = box(x,z,x+step,z+step).intersection(box(WEST,NORTH,EAST,SOUTH))
                if square.is_empty or not scope.intersects(square):
                    continue
                if native:
                    value = offset(x+2,z+2)
                    if value:
                        cells.append(square)
                        values.append(value)
                else:
                    for tri in [Polygon([(x,z),(x+10,z),(x+10,z+10)]),
                                Polygon([(x,z),(x+10,z+10),(x,z+10)])]:
                        if any(offset(px,pz) for px,pz in tri.exterior.coords):
                            cells.append(tri)
                            values.append(None)
        self.cells = cells
        self.tree = shapely.STRtree(cells)
        self.field = shapely.union_all(cells)
        self.values = values

    def cut(self, polygon):
        selected = self.tree.query(polygon, predicate="intersects")
        if not len(selected):
            yield polygon, 0
            return
        for i in selected:
            yield polygon.intersection(self.cells[i]), self.values[i]
        if not self.field.covers(polygon):
            yield polygon.difference(self.field), 0


def graded_walk(geom, tone, height, curb_edges, curb_tree):
    # The source distinguishes flush, 3 cm and high kerbs. Bring the bordering
    # footway down to the two lower levels over the last 80 cm of pavement.
    candidates = curb_tree.query(geom, predicate="dwithin", distance=.82)
    if not len(candidates):
        yield geom,tone,height
        return
    nearby = [(curb_edges[i][0],curb_edges[i][1]) for i in candidates]
    band = shapely.union_all([edge for edge,_ in nearby]).buffer(.8,quad_segs=3)
    yield geom.difference(band),tone,height
    def slope(x,z):
        p=Point(x,z)
        return min(base+(height-base)*min(1,edge.distance(p)/.8) for edge,base in nearby)
    yield geom.intersection(band),tone,slope


def surfaces(source):
    curb_edges = [(shape(g), .209 if code=="3" else .235)
                  for _,code,g in source["layers"]["bd_bordstein"] if code in ("2","3")]
    curb_tree = shapely.STRtree([edge for edge,_ in curb_edges])
    for layer, (height, default) in LAYERS.items():
        for _, material, geo in source["layers"][layer]:
            geom = shape(geo)
            tone, y = default, height
            if layer in ("cm_fahrbahn","ck_parkflaeche"):
                tone = "carriage-setts" if material == "05" else default
            elif layer in ("cl_gehweg","by_gehwegueberfahrt"):
                tone = WALK.get(material, default)
            elif layer == "bd_bordstein":
                geom = geom.buffer(.10, cap_style="flat", join_style="mitre")
                if material in ("2","3"):
                    tone, y = "lowered", .217 if material=="3" else .243
            elif layer == "be_fahrbahnmarkierunglinie":
                geom = geom.buffer(.065, cap_style="flat", join_style="mitre")
            if layer in ("cl_gehweg","by_gehwegueberfahrt","bw_aufmerksamkeitsfeld"):
                yield from graded_walk(geom,tone,y,curb_edges,curb_tree)
            else:
                yield geom, tone, y
    # The later bicycle inventory maps the two directions separately. Limit green
    # paint to the sides explicitly tagged green in the dated OSM capture.
    green = defaultdict(list)
    axes = {i:LineString(p) for i,_,p in source["axes"]}
    for i, side, kind in source["green"]:
        # In the local south-positive Z plane, positive geometric offsets are
        # the right-hand side in the real world.
        green[kind].append(axes[i].buffer(10 if side=="right" else -10,
                                          single_sided=True, cap_style="flat"))
    regions = {k:shapely.union_all(v) for k,v in green.items()}
    for _, name, design, geo in source["cycleRoutes"]:
        if "furt" in design.lower() or "knotenpunkt" in design.lower():
            continue
        kind = "track" if name == "Radwege" else "lane"
        route = shape(geo).intersection(regions[kind])
        for line in parts(route,"LineString"):
            if line.length > 1:
                yield line.buffer(.72,cap_style="flat",join_style="round"), "green-cycle", .352 if kind=="track" else .224
    # OSM tram ways map each track centre. Union and merge before offsetting so
    # that source way splits never produce expansion gaps in the paired rails.
    for gauge in sorted({r[1] for r in source["rails"]}):
        merged = shapely.line_merge(shapely.union_all([shape(r[2]) for r in source["rails"] if r[1]==gauge]))
        for center in parts(merged, "LineString"):
            for side in [-1,1]:
                rail = center.offset_curve(side * gauge / 2000, join_style="round")
                yield rail.buffer(.098,cap_style="flat"), "rail-bed", .258
                yield rail.buffer(.040,cap_style="flat"), "rail", .274


def stream(values, dtype):
    arr = np.asarray(values, dtype)
    return base64.b64encode(gzip.compress(arr.tobytes(), compresslevel=9, mtime=0)).decode()


class Packet:
    def __init__(self, tx,tz):
        self.origin = [tx*512+256, 0, tz*512+256]
        self.xyz, self.ids, self.tones, self.indices = [], {}, [], []
        self.palette, self.courses = [], []
        self.trees = []

    def facet(self, points, color, course=0):
        if color not in self.palette:
            self.palette.append(color)
            self.courses.append(course)
        tone = self.palette.index(color)
        ids = []
        for x,y,z in points:
            key = (round((x-self.origin[0])*100), round(y*100), round((z-self.origin[2])*100), tone)
            if key not in self.ids:
                self.ids[key] = len(self.xyz)
                self.xyz.append(key[:3])
                self.tones.append(tone)
            ids.append(self.ids[key])
        if len(set(ids))==3:
            self.indices.extend(ids)

    def surface(self, geom, tone, y, terrain):
        for patch, height in terrain.cut(geom):
            for poly in parts(patch,"Polygon"):
                if poly.area < .00015:
                    continue
                for tri in shapely.constrained_delaunay_triangles(poly).geoms:
                    coords = shapely.orient_polygons(tri,exterior_cw=True).exterior.coords
                    pts = [(x,3+(y(x,z) if callable(y) else y)+(offset(x,z) if height is None else height),z)
                           for x,z in list(coords)[:3]]
                    self.facet(pts,COLORS[tone],COURSES.get(tone,0))

    def save(self,path):
        assert len(self.xyz) < 65536
        # Delta- and byte-plane coding keeps the two families independently small.
        def words(arr):
            words=np.asarray(arr,dtype="int32")
            diff=np.diff(words,axis=-1,prepend=np.zeros((*words.shape[:-1],1),dtype="int32")).astype("<u2")
            return stream(np.stack([diff&255,diff>>8]),"u1")
        packet=dict(origin=self.origin, n=len(self.xyz), faces=len(self.indices)//3,
                    p=words(np.asarray(self.xyz).T),i=words(self.indices),c=stream(self.tones,"u1"),
                    palette=self.palette,courses=self.courses,trees=self.trees)
        path.write_text(json.dumps(packet,separators=(",",":"))+"\n")


def main():
    from prenzlauer_fronts_v380 import add_fronts
    source = json.loads(gzip.decompress(SOURCE.read_bytes()))
    axes = [LineString(r[2]) for r in source["axes"]]
    scope = shapely.union_all(axes).buffer(19)
    by_tile = defaultdict(list)
    for geom, tone, height in surfaces(source):
        if geom.is_empty:
            continue
        x0,z0,x1,z1=geom.bounds
        for tx in range(math.floor(x0/512), math.floor(x1/512)+1):
            for tz in range(math.floor(z0/512), math.floor(z1/512)+1):
                clipped=geom.intersection(box(tx*512,tz*512,(tx+1)*512,(tz+1)*512))
                for polygon in parts(clipped,"Polygon"):
                    by_tile[tx,tz].append((polygon,tone,height))
    OUT.mkdir(exist_ok=True)
    for native in [False, True]:
        terrain = Terrain(native,scope)
        for (tx,tz), polygons in sorted(by_tile.items()):
            key=f"{tx}_{tz}"
            packet=Packet(tx,tz)
            for polygon,tone,height in polygons:
                packet.surface(polygon,tone,height,terrain)
            for index, (_,genus,h,w,circ,x,z) in enumerate(source["trees"]):
                if math.floor(x/512)!=tx or math.floor(z/512)!=tz:
                    continue
                elevation=offset(math.floor(x/4)*4+2,math.floor(z/4)*4+2) if native else offset(x,z)
                palette={"Aesculus":0,"Crataegus":1,"Platanus":2,"Tilia":3,"Acer":4}
                packet.trees.append([x,z,round(3.35+elevation,2),h,w,circ,palette.get(genus,5),index])
            add_fronts(packet,key,native)
            name=key+("-native" if native else "-drawn")
            packet.save(OUT/(name+".json"))
            print(name,len(packet.xyz),len(packet.indices)//3,len(packet.trees),flush=True)
    shared = []
    for tx,tz in sorted(by_tile):
        id = f"{tx}_{tz}"
        drawn, native, common = (OUT/(id+"-"+k+".json") for k in ["drawn","native","shared"])
        if filecmp.cmp(drawn,native,shallow=False):
            drawn.replace(common)
            native.unlink()
            shared.append(id)
        else:
            common.unlink(missing_ok=True)
    (DATA/"prenzlauerSharedV380.json").write_text(json.dumps(shared)+"\n")


if __name__ == "__main__":
    main()
