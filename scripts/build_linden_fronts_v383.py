"""Fit recorded façade openings to the exposed, delivered Alt-Mitte walls in both styles."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import Polygon

from scripts.build_kreuzberg_plaetze_v380 import Mesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/linden-front-v383-facades.json.gz"
DEST = ROOT / "src/app/src/data/lindenFrontV383"
ORIGINS = {"west": (885, 16, 290), "mitte": (1220, 16, 246), "ost": (1785, 16, 215)}
GLASS = {
  "arcade": (62,76,80), "curtain": (76,92,97), "sandstone": (75,94,85),
  "coursed": (72,83,89), "governor": (72,83,90), "palace": (83,95,103),
  "pilaster": (65,77,83),
}


def shade(rgb, into, fraction):
  return tuple(round(a + (b-a)*fraction) for a,b in zip(rgb,into))


class Wall:
  def __init__(self, record, native, mesh):
    self.r, self.native, self.mesh = record,native,mesh
    self.a, self.b, self.n = map(np.array,(record["a"],record["b"],record["n"]))
    self.axis = (self.b-self.a)/np.linalg.norm(self.b-self.a)
    self.masks = [(plane,sh.union_all([Polygon(p["r"],p["holes"]) for p in pieces]))
                  for plane,pieces in record["native" if native else "drawn"]]
    for _,mask in self.masks:
      sh.prepare(mask)

  def point(self,u,y,depth,plane):
    p=self.a+self.axis*u
    if self.native:
      return (p[0],self.r["ground"]+y,plane+np.sign(self.n[1])*depth)
    p=p+self.n*depth
    return (p[0],self.r["ground"]+y,p[1])

  def polygon(self,points,color,depth):
    geom=Polygon(points)
    for plane,mask in self.masks:
      if mask.covers(geom) and geom.equals(geom.convex_hull):
        self.mesh.face([self.point(u,y,depth,plane) for u,y in points],color)
      elif mask.intersects(geom):
        self.mesh.polygon(geom.intersection(mask),color,
                          lambda u,y:self.point(u,y,depth,plane))

  def rect(self,left,right,low,high,depth,color):
    if right-left>.008 and high-low>.008:
      self.polygon([(left,low),(right,low),(right,high),(left,high)],color,depth)

  def ledge(self,left,right,y,section,front,back,stone,shadow):
    self.rect(left,right,y-section,y,front,shadow)
    self.rect(left,right,y,y+section*.34,front,stone)
    for plane,mask in self.masks:
      for part in sh.get_parts(mask.intersection(sh.LineString([(left,y),(right,y)]))):
        if part.geom_type!="LineString" or part.length<.02:
          continue
        a,b=part.bounds[0],part.bounds[2]
        self.mesh.face([self.point(a,y,front,plane),self.point(b,y,front,plane),
                        self.point(b,y,back,plane),self.point(a,y,back,plane)],stone)


def opening(w,rect,style,wall,shop=False):
  left,right,low,high=rect
  center=(left+right)/2
  if right-left<.2 or high-low<.2:
    return
  stone=shade(wall,(243,235,222),.54)
  trim=shade(wall,(78,76,67),.27)
  glass=GLASS[style]
  historic=style in ("governor","coursed","sandstone","palace","pilaster")
  rim=.105 if historic else .08
  depth=.29
  w.rect(left-rim,right+rim,low-rim,high+rim,depth,trim)
  w.rect(left,right,low,high,depth+.048,glass)
  w.rect(left+.04,left+.085,low+.045,high-.05,depth+.069,shade(glass,(34,42,47),.60))
  w.rect(left+.085,right-.05,high-.18,high-.08,depth+.073,shade(glass,(162,173,169),.25))
  frame=stone if historic else shade(wall,(88,92,92),.45)
  if style=="curtain":
    w.rect(right-.07,right,low,high,depth+.09,frame)
  else:
    w.rect(center-.045,center+.045,low,high,depth+.083,frame)
    h=high-(high-low)*(.34 if historic else .24)
    w.rect(left,right,h-.039,h+.039,depth+.088,frame)
  if historic:
    w.ledge(left-.11,right+.11,low,.10,.43,depth,stone,trim)
    if style in ("governor","pilaster") and not shop:
      w.rect(left-.12,right+.12,high+.10,high+.22,.38,stone)
      w.rect(left-.19,right+.19,high+.22,high+.30,.43,trim)
  if style=="sandstone" and shop:
    # Street floor has three broad, low segmental arches with pale stone surrounds.
    height=min(.64,(right-left)*.16)
    for j in range(12 if not w.native else 6):
      count=12 if not w.native else 6
      p=j/count
      q=(j+1)/count
      def arch(t):
        return high+height*(1-(2*t-1)**2)
      xa,xb=left+p*(right-left),left+q*(right-left)
      yl,yr=arch(p),arch(q)
      if w.native:
        yl=yr=min(yl,yr)
      w.polygon([(xa,high-.03),(xb,high-.03),(xb,yr+.01),(xa,yl+.01)],glass,.36)
      w.polygon([(xa,yl+.01),(xb,yr+.01),(xb,yr+.17),(xa,yl+.17)],stone,.40)


def lindencorso_entrance(g):
  port = g.r["portal"]
  width = g.r["w"]
  center = width / 2
  left, right = center - port["stoneWidth"] / 2, center + port["stoneWidth"] / 2
  door_l, door_r = center - port["doorWidth"] / 2, center + port["doorWidth"] / 2
  head, lintel = port["doorHead"], port["stoneHead"]
  bottom, top = port["fascia"]
  metal = (43, 49, 52)
  # The 2025 photograph shows dark marble and two shaded side recesses.
  # The separate LoD2 wedge and every surface cut still own its outer silhouette.
  g.rect(0, width, .07, g.r["h"], .35, (177, 166, 146))
  g.rect(.08, width - .08, .13, bottom, .41, (55, 58, 56))
  for a, b in [(.22, left - .12), (right + .12, width - .22)]:
    g.rect(a, b, .18, bottom - .19, .44, (68, 78, 77))
    g.rect(a, b, 2.84, 2.91, .47, metal)
    g.rect(b - .095, b, .17, bottom - .19, .47, metal)

  stone = (65, 69, 73)
  seam = (49, 54, 57)
  g.rect(left, right, .12, lintel, .55, stone)
  for y in (1.18, 2.34, 3.46, 4.64):
    for a, b in [(left, door_l), (door_r, right)]:
      g.rect(a, b, y, y + .032, .56, seam)
  for u in (left + .73, right - .72):
    g.rect(u, u + .03, .12, lintel, .565, seam)
  g.rect(left, right, lintel - .075, lintel, .59, (103, 102, 100))
  g.rect(door_l - .11, door_r + .11, .13, head + .11, .575, (29, 32, 34))
  # Fixed sidelights, glass door pair and the two continuous upper lights.
  g.rect(door_l, door_r, .19, head, .58, (88, 110, 122))
  g.rect(door_l, door_r, .20, 1.42, .59, (81, 91, 87))
  g.rect(door_l, door_r, 2.54, 3.08, .60, (149, 163, 169))
  g.rect(door_l, door_r, 3.18, head - .04, .60, (91, 119, 144))
  g.rect(door_l, door_r, .15, .22, .64, metal)
  for z in (2.51, 3.10):
    g.rect(door_l, door_r, z, z + .055, .64, metal)
  for u in (door_l, center - .92, center, center + .92, door_r):
    g.rect(u - .033, u + .033, .18, 2.53, .65, metal)
  for dx in (-.18, .18):
    g.rect(center + dx - .028, center + dx + .028, 1.02, 1.52, .70, (145, 146, 136))
  # The canopy fascia is a continuous strip of glass above the recessed entrance.
  # Clip its ends against the measured, slightly asymmetric municipal wall.
  g.rect(.03, width - .03, bottom, top, .71, (94, 118, 143))
  g.rect(.03, width - .03, bottom + .05, bottom + .44, .73, (78, 97, 116))
  g.rect(.03, width - .03, top - .36, top - .09, .73, (110, 135, 156))
  for u in np.linspace(.03, width - .03, port["glassBays"] + 1):
    g.rect(u - .048, u + .048, bottom, top, .78, (59, 65, 69))
  g.rect(.025, width - .025, bottom + .90, bottom + .96, .78, (62, 68, 71))
  g.ledge(.025, width - .025, bottom, .11, .87, .39, (105, 106, 106), (54, 56, 57))
  g.ledge(.025, width - .025, top, .10, .82, .36, (124, 129, 131), (61, 66, 69))


def facade(g):
  f=g.r
  width=f["w"]
  style=f["style"]
  if style == "entrance":
    lindencorso_entrance(g)
    return
  paint=tuple(bytes.fromhex(f["wall"]))
  shade0=shade(paint,(86,76,69),.27)
  edge=shade(paint,(238,229,211),.61)
  g.rect(.008,width-.008,max(.18,f["low"]),f["top"],.22,paint)
  if f["ledges"]:
    for y in f["ledges"]:
      if f["low"]+.06<y<f["top"]+.01:
        g.ledge(.014,width-.014,y,.11 if style=="curtain" else .17,.41,.22,edge,shade0)
  g.ledge(.015,width-.015,f["top"]-.08,.21,.46,.20,edge,shade0)
  if style=="curtain":
    # The historic image shows a continuous horizontal window wall. Each level
    # carries a light metal transom and dark panels, above a recessed glazed base.
    tiers=sorted({round(y,2) for _,y,_,_ in f["windows"]})
    for y in tiers:
      g.rect(.03,width-.03,y-.80,y+.80,.31,GLASS["curtain"])
      g.rect(.03,width-.03,y+.61,y+.76,.34,shade(GLASS["curtain"],(182,197,187),.24))
    for i in range(1,37):
      u=i*width/37
      thick=.09 if i%4==0 else .043
      g.rect(u-thick,u+thick,f["h"]*.22,f["h"]*.812,.42,shade(paint,(222,223,207),.44))
  if style=="arcade":
    for left,right,low,high in f["shops"]:
      g.rect(left-.16,right+.16,max(.1,low-.05),high+.18,.25,shade0)
      g.ledge(left-.24,right+.24,high+.19,.16,.51,.23,edge,shade0)
  for u,y,ww,hh in f["windows"]:
    if style!="curtain":
      opening(g,(u-ww/2,u+ww/2,y-hh/2,y+hh/2),style,paint)
  for left,right,lo,hi in f["shops"]:
    opening(g,(left,right,lo,hi),style,paint,True)

  if style=="governor":
    # The street photograph taken without leaves reveals the projecting balcony
    # above the central arched entrance and the banded plinth below all eleven axes.
    center=width/2
    for y in np.arange(.38,6.45,.78):
      g.rect(.02,width-.02,y,y+.045,.237,shade(paint,(103,103,96),.23))
    opening(g,(center-1.27,center+1.27,.53,4.20),"sandstone",paint,True)
    g.rect(center-1.10,center+1.10,.53,4.00,.38,(74,70,62))
    g.rect(center-.045,center+.045,.53,4.03,.41,(125,117,98))
    for dx in (-1.65,1.65):
      u=center+dx
      g.rect(u-.21,u+.21,.52,5.97,.57,edge)
      g.rect(u-.19,u-.11,.55,5.93,.60,shade0)
      g.ledge(u-.36,u+.36,5.94,.23,.88,.29,edge,shade0)
      g.ledge(u-.36,u+.36,.62,.21,.81,.28,edge,shade0)
    g.ledge(center-2.32,center+2.32,6.15,.29,1.52,.26,edge,shade0)
    for u in np.linspace(center-2.12,center+2.12,11):
      g.rect(u-.070,u+.070,6.17,6.93,1.47,edge)
    g.ledge(center-2.23,center+2.23,6.99,.12,1.53,1.32,edge,shade0)
    for j in range(11):
      u=(j+.5)*width/11
      g.rect(u-.21,u+.21,f["top"]-.99,f["top"]-.74,.32,shade0)


def build():
  capture=json.loads(gzip.decompress(SOURCE.read_bytes()))
  for relative,digest in capture["inputs"].items():
    if hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() != digest:
      raise ValueError(f"Delivered wall source changed: {relative}. Register the affected façade planes again.")
  faces=capture["faces"]
  result={}
  for native in (False,True):
    style="native" if native else "drawn"
    grouped={k:Mesh(v) for k,v in ORIGINS.items()}
    for f in faces:
      mid=(f["a"][0]+f["b"][0])/2
      host="west" if mid<1000 else "mitte" if mid<1500 else "ost"
      facade(Wall(f,native,grouped[host]))
    for host,mesh in grouped.items():
      result[style+"-"+host+".json"] = (json.dumps(mesh.finish(),separators=(",",":"))+"\n").encode()
  return result


if __name__=="__main__":
  cmd=argparse.ArgumentParser(description=__doc__)
  cmd.add_argument("--check",action="store_true")
  args=cmd.parse_args()
  DEST.mkdir(exist_ok=True)
  for name,data in build().items():
    if args.check:
      assert (DEST/name).read_bytes()==data, name
    else:
      (DEST/name).write_bytes(data)
    print(name,len(data))
