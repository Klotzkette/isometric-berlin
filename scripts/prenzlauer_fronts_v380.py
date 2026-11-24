"""Fit photographic street elevations to the two existing drawn and block owners."""
import gzip
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDINGS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
FRONTS = {
    "4_-4": ("DEBE03YY600006wS", (2508.48,-1906.45), (2502.90,-1898.19), "kino"),
    "5_-5": ("DEBE03YY600008Vb", (2711.56,-2252.66), (2730.13,-2281.98), "prater"),
}
LETTERS = dict(L="100/100/100/100/111",I="111/010/010/010/111",C="111/100/100/100/111",
    H="101/101/111/101/101",T="111/010/010/010/010",B="110/101/110/101/110",
    K="101/110/100/110/101",N="101/111/111/111/101",O="111/101/101/101/111",
    P="110/101/110/100/100",R="110/101/110/101/101",A="010/101/111/101/101",
    E="111/100/110/100/111")


def add_fronts(packet, tile, native):
    if tile not in FRONTS:
        return
    owner, start, end, site = FRONTS[tile]
    family = "minecraft" if native else "drawn"
    with gzip.open(BUILDINGS / f"{tile}.{family}.json.gz") as handle:
        source = json.load(handle)
    building = next(b for b in source["nav"]["buildings"] if b["sourceId"] == owner)
    ground = source["nav"]["groundY"] + building.get("groundOffset", 0)
    height = building["height"]
    ox,_,oz = source["origin"]
    ring = [(ox+x,oz+z) for x,z in building["ring"]]
    length = math.dist(start,end)
    ux,uz = (end[0]-start[0])/length,(end[1]-start[1])/length
    nx,nz = -uz,ux  # public side when viewing the elevation left to right
    # Left-to-right as seen by a person standing on the street means its
    # outward normal in world X/Z is (-dz,dx).
    center = ((start[0]+end[0])/2,(start[1]+end[1])/2)
    from shapely import Polygon,Point
    shell = Polygon(ring)
    if shell.contains(Point(center[0]+nx*4,center[1]+nz*4)):
        nx,nz=-nx,-nz
    def frame(pt):
        dx,dz=pt[0]-start[0],pt[1]-start[1]
        return dx*ux+dz*uz,dx*nx+dz*nz
    walls = []
    for a,b in zip(ring,ring[1:]+ring[:1]):
        ua,da=frame(a);ub,db=frame(b)
        if max(abs(da),abs(db)) > (2.35 if native else 1.18) or abs(ub-ua)<.03:
            continue
        if max(ua,ub)<-.01 or min(ua,ub)>length+.01:
            continue
        vx,vz=b[0]-a[0],b[1]-a[1]
        width=math.hypot(vx,vz)
        if width<.04:
            continue
        wx,wz=-vz/width,vx/width
        if wx*nx+wz*nz<0:
            wx,wz=-wx,-wz
        if shell.contains(Point((a[0]+b[0])/2+wx*.08,(a[1]+b[1])/2+wz*.08)):
            continue
        walls.append((a,b,ua,ub,wx,wz))
    def strip(left,right,low1,low2,top1,top2,tone,depth):
        for a,b,ua,ub,wx,wz in walls:
            lo=max(left,min(ua,ub));hi=min(right,max(ua,ub))
            if hi-lo<.014:
                continue
            def vertex(u,y1,y2):
                k=(u-ua)/(ub-ua)
                return (a[0]+(b[0]-a[0])*k+wx*depth,
                        ground+y1+(y2-y1)*(u-left)/(right-left),
                        a[1]+(b[1]-a[1])*k+wz*depth)
            p,q,r,s=vertex(lo,low1,low2),vertex(hi,low1,low2),vertex(hi,top1,top2),vertex(lo,top1,top2)
            packet.facet([p,q,r],tone);packet.facet([p,r,s],tone)
    def rect(l,r,y,h,color,depth):
        strip(l*length,r*length,y*height,y*height,(y+h)*height,(y+h)*height,color,depth)
    def arch(l,r,y,h,color,depth,curve=.28):
        for i in range(12):
            a,b=i/12,(i+1)/12
            top=lambda u:(y+h*(1-curve+curve*math.sqrt(max(0,1-(2*u-1)**2))))*height
            strip((l+(r-l)*a)*length,(l+(r-l)*b)*length,y*height,y*height,top(a),top(b),color,depth)
    def letters(text,l,r,y,h,color,depth):
        cell=(r-l)/(len(text)*4-1)
        for i,ch in enumerate(text):
            for j,line in enumerate(LETTERS.get(ch,"").split("/")):
                for k,bit in enumerate(line):
                    if bit=="1":
                        x=l+cell*(4*i+k)
                        rect(x,x+cell,y+(4-j)*h/5,h/5,color,depth)
    if site == "kino":
        olive,stone,red,glass=0xa9ac8d,0xc3c1a5,0x7a4940,0x526367
        rect(.002,.998,.01,.974,olive,.105)
        for y,h in [(.031,.034),(.13,.018),(.46,.018),(.855,.019),(.923,.025),(.965,.026)]:
            rect(.002,.998,y,h,stone,.18)
        for u in [.17,.40,.64,.87]:
            rect(u-.063,u+.063,.585,.232,stone,.15)
            rect(u-.052,u+.052,.595,.213,red,.21)
            rect(u-.044,u+.044,.605,.193,glass,.23)
            rect(u-.004,u+.004,.603,.197,red,.25)
            rect(u-.046,u+.046,.734,.010,red,.25)
            rect(u-.065,u+.065,.578,.012,0x727664,.26)
        for l,r in [(.075,.254),(.535,.665)]:
            rect(l,r,.104,.302,red,.22)
            rect(l+.009,r-.009,.115,.278,0x426064,.25)
            for col in range(2):
                for row in range(2):
                    x=l+.018+col*(r-l)*.43
                    rect(x,x+(r-l)*.34,.133+row*.119,.102,[0xae6857,0xb7afa0,0x739390,0xa79270][row*2+col],.29)
        rect(.322,.500,.032,.374,stone,.19)
        rect(.341,.479,.056,.336,0x574d43,.24)
        rect(.353,.468,.069,.260,0x526566,.28)
        rect(.409,.416,.060,.29,red,.30)
        for j in range(3):
            rect(.315-j*.009,.497+j*.009,.012+j*.016,.014,0x8d8980,.4-j*.06)
        rect(.053,.548,.423,.049,0xc4bd9f,.24)
        letters("LICHTBLICK KINO",.072,.536,.430,.033,0x394848,.32)
        arch(.74,.987,.019,.393,0x46443c,.21,.23)
        rect(.763,.971,.020,.22,0x514f45,.24)
    else:
        wall,cream,glass,red=0xcfc6b4,0xe0d8c5,0x626969,0x794d3d
        rect(.002,.998,.006,.978,wall,.13)
        for y,h in [(.055,.033),(.508,.027),(.916,.033),(.962,.029)]:
            rect(.002,.998,y,h,cream,.22)
        for i in range(9):
            u=.043+i*.107
            rect(u-.029,u+.029,.618,.222,cream,.20)
            rect(u-.023,u+.023,.626,.201,glass,.24)
            rect(u-.003,u+.003,.624,.206,0xa4a397,.27)
            rect(u-.025,u+.025,.761,.012,cream,.28)
        for i in range(7):
            u=.047+i*.111
            arch(u-.036,u+.036,.073,.256,cream,.23)
            arch(u-.030,u+.030,.079,.235,red,.26)
            arch(u-.025,u+.025,.087,.215,glass,.28)
            rect(u-.003,u+.003,.089,.21,cream,.3)
            rect(u-.026,u+.026,.218,.008,cream,.3)
        arch(.791,.987,.012,.447,cream,.24,.38)
        arch(.807,.976,.013,.421,0x5e594d,.27,.36)
        arch(.823,.958,.014,.389,0x474941,.29,.34)
        letters("PRATER",.065,.439,.343,.085,0x575a56,.32)
