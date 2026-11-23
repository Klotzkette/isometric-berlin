"""Capture the west zoo's measured roof, crags and canopy on the existing scene datum."""
import argparse
import gzip
import hashlib
import json
import math
import zipfile
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree
from shapely import contains_xy, union_all
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
EVIDENCE = ROOT / "geo_data/regierungsviertel/zoo-west-survey-v379.json.gz"
X, Z, WIDTH, DEPTH = -2750, 480, 1080, 1060
HILLS = ["25036813", "25036814", "49896121"]
HIPPO = "DEBE01YYK0002NM4"
# Named OSM outlines are identity evidence. Collect only source buildings whose footprints match.
HOUSES = {"18438821", "17955053", "18340403", "18439324", "18440289", "497420475",
          "497420474", "48132339", "17957388", "618256709", "25205539", "25205541", "498169768"}
GML = "{http://www.opengis.net/gml}"
TILE_CODES = ["386_5818", "386_5819", "387_5818", "387_5819"]


def sources():
    bbox = X+389500, 5820000-Z-DEPTH, X+389500+WIDTH, 5820000-Z
    urls = {}
    for kind in ["bdom", "dgm"]:
        params = [("service","WCS"),("version","2.0.1"),("request","GetCoverage"),("coverageid","bb_"+kind),
                  ("subset",f"x({bbox[0]},{bbox[2]})"),("subset",f"y({bbox[1]},{bbox[3]})"),("format","image/tiff")]
        urls[kind] = "https://isk.geobasis-bb.de/ows/"+kind+"_wcs?"+urlencode(params)
    urls["truedop_2026"] = "https://gdi.berlin.de/services/wms/truedop_2026?"+urlencode(dict(
        service="WMS",version="1.3.0",request="GetMap",layers="truedop_2026",styles="",crs="EPSG:25833",
        bbox=",".join(map(str,bbox)),width=2*WIDTH,height=2*DEPTH,format="image/jpeg"))
    for code in TILE_CODES:
        name = "LoD2_"+code+".zip"
        urls[name] = "https://gdi.berlin.de/data/a_lod2/atom/"+name
    return urls


def leaf_parts(archive, footprints):
    # Read a building part once, regardless of its parent's LoD hierarchy.
    with zipfile.ZipFile(archive) as data, data.open(data.namelist()[0]) as stream:
        for _, building in ET.iterparse(stream, events=("end",)):
            tag = building.tag.split("}")[-1]
            if tag not in ("Building", "BuildingPart"):
                continue
            surfaces = []
            for kind in ("GroundSurface", "RoofSurface", "WallSurface"):
                for surface in building.findall("./{*}boundedBy/{*}"+kind):
                    for poly in surface.findall(".//{*}Polygon"):
                        rings=[]
                        for boundary in poly:
                            coords=boundary.find(".//"+GML+"posList")
                            if coords is None or not coords.text:
                                continue
                            pts=np.fromstring(coords.text,sep=" ").reshape(-1,3)[:-1]
                            rings.append([[round(x-389500,2),round(h,2),round(5820000-y,2)] for x,y,h in pts])
                        if rings:
                            surfaces.append([kind, rings])
            oid=building.attrib.get(GML+"id","")
            building.clear()
            ground=[Polygon([(x,z) for x,_,z in r[0]], [[(x,z) for x,_,z in h] for h in r[1:]]).buffer(0)
                    for kind,r in surfaces if kind=="GroundSurface"]
            if not ground:
                continue
            geom=union_all(ground)
            if geom.area < 4:
                continue
            for osm,g in footprints.items():
                if not geom.intersects(g) or g.intersection(geom).area/geom.area<.8:
                    continue
                yield osm, {"id":oid, "area":round(geom.area,1), "surfaces":surfaces}
                break


def capture(cache):
    cache.mkdir(parents=True,exist_ok=True)
    urls=sources()
    for name,url in urls.items():
        path=cache/name
        if not path.exists():
            path.write_bytes(urlopen(url,timeout=90).read())
    old=json.loads((APP/"zooGroundsV165Source.json").read_bytes())
    inventory=json.loads((APP/"zooGroundsV165Evidence.json").read_bytes())
    pots={f["id"]:f for f in inventory["features"] if f["type"]=="way"}
    points=lambda f: Polygon(f["coordinates"]).buffer(0)
    site=Polygon(old["zooRing"]).buffer(0)
    footprints={osm:points(pots[osm]) for osm in HOUSES}
    dsm=np.asarray(Image.open(cache/"bdom")).astype(float)
    dgm=np.asarray(Image.open(cache/"dgm")).astype(float)
    dop=np.asarray(Image.open(cache/"truedop_2026").convert("RGB")).reshape(DEPTH,2,WIDTH,2,3).mean(axis=(1,3))
    xx,zz=np.meshgrid(np.arange(WIDTH)+X+.5,np.arange(DEPTH)+Z+.5)
    assert dsm.shape==dgm.shape==(DEPTH,WIDTH)
    grids={}
    for name in [HIPPO,*HILLS]:
        ring=next(p["ring"] for p in old["parts"]+old["habitats"] if p["id"]==name)
        poly=Polygon(ring)
        survey_ring=ring
        if name==HIPPO:
            # Vertices identify the glazed/opaque roof boundary on the 2026 true orthophoto,
            # not the complete cadastral plot (which also contains the service annex).
            trace=[(36,294),(29,254),(39,201),(52,158),(73,118),(98,91),(131,79),(174,92),
                   (209,115),(243,138),(276,161),(298,190),(310,228),(308,268),(303,310),(315,345),
                   (335,363),(370,376),(401,385),(427,403),(448,439),(461,484),(455,527),(436,556),
                   (409,579),(375,589),(343,591),(339,569),(337,528),(327,493),(316,452),(294,420),
                   (273,391),(246,360),(214,336),(181,318),(142,306),(100,298),(65,295)]
            poly=poly.intersection(Polygon([(-2425+u/9,994+v/9) for u,v in trace])).buffer(0)
            ring=[[round(x,2),round(z,2)] for x,z in poly.exterior.coords[:-1]]
        inside=contains_xy(poly,xx,zz)
        near=contains_xy(poly.buffer(4),xx,zz) & ~contains_xy(poly.buffer(.7),xx,zz)
        lo,hi=tuple(np.array(np.where(inside)).min(axis=1)-2),tuple(np.array(np.where(inside)).max(axis=1)+3)
        sel=np.s_[lo[0]:hi[0],lo[1]:hi[1]]
        if name==HIPPO:
            # Specular glass can return the pool floor, especially in the larger dome.
            # Fill those gaps from actual on-roof returns; keep the double curvature and saddle.
            field=dsm[sel].copy(); region=inside[sel]
            valid=region & (field>=36.0) & (field<=45.2)
            low=field<ndimage.median_filter(field,size=5)-1.05
            valid &= ~low
            # Interior false returns form contiguous islands, not just isolated outliers.
            from scipy.interpolate import LinearNDInterpolator
            ij=np.array(np.where(valid)).T
            coords=np.array(np.indices(field.shape)).reshape(2,-1).T
            fitted=LinearNDInterpolator(ij,field[valid])(coords).reshape(field.shape)
            nearest=ndimage.distance_transform_edt(~valid,return_distances=False,return_indices=True)
            fitted=np.where(np.isfinite(fitted),fitted,field[tuple(nearest)])
            field=ndimage.gaussian_filter(fitted,1.6)
            # Datum is measured outside the glazed visitor frontage, independently of roof returns.
            datum=float(np.median(dgm[near]))
        else:
            field=dgm[sel].copy()
            image=dop[sel]
            # Light neutral limestone accepts small genuine surface returns. Keep ground-model
            # elevations at vegetation and dark tree shadows, especially in the Takin enclosure.
            red,green,blue=np.moveaxis(image,-1,0)
            bare=(red>77)&(red>=green*.98)&(green>=blue*.99)&(red-blue<76)
            extra=np.maximum(0,ndimage.median_filter(dsm[sel]-dgm[sel],size=3))
            field+=np.where(bare & (extra<3.8),extra,0)
            # The path datum is taken from the lower quartile around each mapped crag.
            datum=float(np.quantile(dgm[near],.25))
        grid=np.rint((5.40+np.maximum(0,field-datum))*10).astype(int)
        rock_looks=np.zeros(grid.shape,dtype=int)
        if name != HIPPO:
            light=(red*.32+green*.52+blue*.16)
            rock_looks=np.where(bare, np.digitize(light,[75,100,124,149])+2,np.where(green>red*.99,0,1))
        grids[name]={"ring":ring,"surveyRing":survey_ring,"looks":rock_looks.ravel().tolist(),"minX":X+lo[1]+.5,"minZ":Z+lo[0]+.5,"datumNHN":round(datum,3),
            "width":int(grid.shape[1]),"height":int(grid.shape[0]),"dm":grid.ravel().tolist(),
            "rawRangeNHN":list(map(lambda v:round(float(v),3),np.quantile((dsm if name==HIPPO else dgm)[inside],[.02,.98])))}
    houses={osm:{"name":pots[osm]["tags"]["name"],"parts":[]} for osm in sorted(HOUSES)}
    for code in TILE_CODES:
        for osm,part in leaf_parts(cache/("LoD2_"+code+".zip"),footprints):
            houses[osm]["parts"].append(part)
    # Exclude all given and mapped roof areas and aviary nets (a tall DSM return alone is ambiguous).
    masks=[points(f) for f in pots.values() if len(f["coordinates"])>=4 and (
        f["tags"].get("building") or f["tags"].get("man_made") in ("aviary","tower")
        or f["tags"].get("natural") in ("bare_rock","water") or "voliere" in f["tags"].get("name","").lower())]
    masks.extend(Polygon(part["ring"]) for part in old["parts"])
    masks.extend(Polygon(h["ring"]) for h in old["habitats"] if h["id"] in {"32995989","32995991","618256710","48374319"})
    heights=np.maximum(0,dsm-dgm)
    inside=contains_xy(site.buffer(-2),xx,zz)
    allowed=inside & ~contains_xy(union_all(masks).buffer(3),xx,zz)
    top=ndimage.gaussian_filter(np.minimum(34,heights),1.3)
    peaks=(top>=ndimage.maximum_filter(top,size=7)-1e-6)&allowed&(top>=4.5)&(top<32)
    prior=json.loads((ROOT/"src/app/public/mesh/regierungsviertel/park-details.json").read_bytes())
    current=[p["position"] for p in prior["trees"] if site.buffer(6).covers(Point(p["position"][0],p["position"][2]))]
    placed=[(v[0],v[2]) for v in current];oldtree=cKDTree(placed) if placed else None
    peaks=sorted(zip(*np.where(peaks)),key=lambda ij:-top[ij])
    crowns=[]
    for row,col in peaks:
        x,z=xx[row,col],zz[row,col]
        if (oldtree and oldtree.query((x,z))[0]<4) or any((a-x)**2+(b-z)**2<30 for a,b,_,_ in crowns):
            continue
        h=float(top[row,col])
        widths=[]
        for ang in np.arange(8)*np.pi/4:
            for r in np.linspace(1,6.5,12):
                j,i=round(row+math.sin(ang)*r),round(col+math.cos(ang)*r)
                if not (0<=j<DEPTH and 0<=i<WIDTH and allowed[j,i] and top[j,i]>.6*h):
                    break
            widths.append(r)
        radius=float(np.quantile(widths,.45))
        if radius>=1.5:
            crowns.append([x,z,round(h,1),round(radius,1)])
    # Only surveyed surfaces with OSM data at this site. Raw ortho pixels are never published.
    for name,house in houses.items():
        for part in house["parts"]:
            rgb=[]
            for kind,rings in part["surfaces"]:
                if kind!="RoofSurface":
                    continue
                geom=Polygon([(x,z) for x,_,z in rings[0]]).buffer(0)
                cells=contains_xy(geom.buffer(-.45),xx,zz)
                if np.any(cells):
                    rgb.extend(dop[cells][::max(1,int(cells.sum()/18))].tolist())
            part["roofRgb"]=np.median(rgb,axis=0).astype(int).tolist() if rgb else None
    payload={"coordinates":"EPSG:25833 → x=easting−389500, z=5820000−northing, heights m",
        "inputs":{name:{"url":url,"sha256":hashlib.file_digest((cache/name).open("rb"),"sha256").hexdigest()} for name,url in urls.items()},
        "grids":grids,"houses":houses,"crowns":crowns,"earlierTrees":len(current)}
    EVIDENCE.write_bytes(gzip.compress(json.dumps(payload,ensure_ascii=False,separators=(",",":"),allow_nan=False).encode(),mtime=0))
    print("Crowns",len(crowns),"retained prior trees",len(current),"parts",[(k,len(v["parts"])) for k,v in houses.items()],flush=True)

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache",type=Path)
    capture(parser.parse_args().cache)
