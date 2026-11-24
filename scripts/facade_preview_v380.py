"""Compose elevated model previews from a facade profile and the displayed city shells."""

import gzip
import json
import math

import shapely as sh
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, shape


class PreviewRoofline:
  """Roof bounds of the two shipped graphics families, in scene coordinates."""

  def __init__(self, mesh_dir, sites):
    # Restrict the read to the small group of 512 m packets containing a
    # candidate virtual camera. No street network or other scene data needed.
    sites = [shape(s["polygon"]) for s in sites]
    regions = sh.STRtree(
      [
        box(a - 148, b - 148, c + 148, d + 148)
        for a, b, c, d in (p.bounds for p in sites)
      ]
    )
    roofs, heights = [], []

    def add(poly, top):
      if poly.is_empty or not len(regions.query(poly)):
        return
      roofs.append(poly)
      heights.append(top)

    core = json.loads((mesh_dir / "regierungsviertel/lod2-prisms.json").read_bytes())
    for b in core["buildings"]:
      coords = [[x / 10, z / 10] for x, z in b["ring"]]
      if len(coords) >= 3:
        holes = [
          [[x / 10, z / 10] for x, z in ring]
          for ring in b.get("holes", [])
          if len(ring) >= 3
        ]
        add(Polygon(coords, holes), (b["y0_dm"] + max(25, b["h_dm"])) / 10)
    tiles = mesh_dir / "surrounding-berlin-v159"
    chunks = json.loads((tiles / "manifest.json").read_bytes())["chunks"]
    for chunk in chunks:
      if not len(regions.query(box(*chunk["bounds"]))):
        continue
      for family in ("drawn", "minecraft"):
        asset = chunk.get(family)
        if not asset:
          continue
        with gzip.open(tiles / asset["url"]) as handle:
          packet = json.load(handle)
        x, _, z = packet["origin"]
        nav = packet["nav"]
        for b in nav["buildings"]:
          if len(b["ring"]) < 3:
            continue
          holes = [h for h in b.get("holes", []) if len(h) >= 3]
          add(
            translate(Polygon(b["ring"], holes), x, z),
            nav["groundY"] + b.get("groundOffset", 0) + b["height"],
          )
    self.index = sh.STRtree(roofs)
    self.heights = heights

  def ceiling(self, x, z, padding=2.0):
    hits = self.index.query(Point(x, z), predicate="dwithin", distance=padding)
    return max((self.heights[i] for i in hits), default=0)


def preview_camera(site, wall, roofline):
  a, b = wall["a"], wall["b"]
  x, z = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
  nx, nz = wall["normal"]
  footprint = shape(site["polygon"])
  point = Point(x, z)
  # Favour exterior edges of the footprint. A wall facing the centre of a
  # recess is usually a poor introductory view even when it is very wide.
  exposed = 1 / (1 + 0.16 * footprint.convex_hull.boundary.distance(point))
  windows = sum(
    b["columns"] * b["rows"] * (b["x"][1] - b["x"][0]) * (b["y"][1] - b["y"][0])
    for b in wall["bands"]
    if b["kind"] != "spandrel"
  )
  evidence = math.log1p(windows)
  height = wall["height"]
  dist = min(126, max(21, wall["width"] * 1.08, height * 1.35))
  # A small tangential component shows the model's depth from an elevated
  # isometric perspective. Place the near clipping plane above either family's roof.
  px = round(x + dist * (nx - 0.16 * nz), 1)
  pz = round(z + dist * (nz + 0.16 * nx), 1)
  target_y = round(site["base"] + 0.52 * height, 1)
  nominal = max(site["base"] + height + 5, target_y + dist * 0.64)
  py = math.ceil(max(nominal, roofline.ceiling(px, pz, 4) + 6))
  steepness = (py - target_y) / dist
  exposure = sh.distance(footprint, Point(x + nx, z + nz))
  weight = (
    (1 + 3.0 * evidence)
    * wall["coverage"]
    * exposed
    * min(1, max(0.05, exposure))
    / max(1, steepness / 0.92)
  )
  cam = dict(position=[px, py, pz], target=[round(x, 1), target_y, round(z, 1)], fov=49)
  return weight, cam


def check_preview_framing(mesh_dir, sites, views):
    """Check the published camera export independently of its selection score.

    The near plane must clear the city models in both styles. The target must
    be a photographed outward-facing surface, centred within its vertical extent.
    """
    roofs=PreviewRoofline(mesh_dir,sites)
    walls={}
    for site in sites:
        for wall in site["walls"]:
            x,z=((wall["a"][i]+wall["b"][i])/2 for i in (0,1))
            walls.setdefault(site["name"],[]).append((site,wall,x,z))
    clearances=[]
    for name,options in walls.items():
        camera=views[name]
        px,py,pz=camera["position"]
        tx,ty,tz=camera["target"]
        distance=py-roofs.ceiling(px,pz,2)
        if distance<5.9:
            raise ValueError("Virtual facade camera intersects the model roof margin")
        clearances.append(distance)
        for site,wall,x,z in options:
            nx,nz=wall["normal"]
            if math.hypot(tx-x,tz-z)<.12 and site["base"]<ty<site["base"]+wall["height"]:
                if (px-tx)*nx+(pz-tz)*nz>.70*math.hypot(px-tx,pz-tz):
                    break
        else:
            raise ValueError("Virtual preview has no corresponding front-facing source wall")
    return len(clearances),min(clearances)


if __name__=="__main__":
    from pathlib import Path
    repo=Path(__file__).resolve().parents[1]
    with gzip.open(repo/"geo_data/regierungsviertel/diplomatische-fassaden-v380.json.gz") as source:
        sites=json.load(source)["walls"]
    views=json.loads((repo/"src/app/src/data/diplomaticViewsV380.json").read_bytes())
    count,clearance=check_preview_framing(repo/"src/app/public/mesh",sites,views)
    print(f"{count} registered exterior previews, minimum virtual camera clearance {clearance:.1f} m")
