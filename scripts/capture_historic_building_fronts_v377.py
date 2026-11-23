"""Read the historical textured Berlin LoD2 buildings as facade reference.

Raw KML, COLLADA, JPEG and diagnostic elevations are kept in a local cache.
Current building geometry is authoritative. Match complete historical bodies
before considering individual parallel wall triangles on the current wall.
"""

import argparse
import gzip
import hashlib
import io
import json
import math
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

import numpy as np
import shapely as sh
from PIL import Image
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]

BASE = "https://www.3dcitydb.net/3dcitydb/fileadmin/mydata/Berlin_Demo/Berlin_Buildings_rgbTexture_ScaleFactor_0.3/"
LAYER = "Berlin_Buildings_rgbTexture"
MESH = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
xy = Transformer.from_crs(4326, 25833, always_xy=True)
ll = Transformer.from_crs(25833, 4326, always_xy=True)


class SourceArchive:
  def __init__(self, directory):
    self.directory = directory

  def read(self, url):
    if not url.startswith(BASE):
      raise ValueError("Source reference left the historical Berlin layer")
    parsed = urlsplit(url)
    suffix = unquote(url[len(BASE) :])
    if (
      not suffix
      or parsed.query
      or parsed.fragment
      or any(part in {"", ".", ".."} for part in suffix.split("/"))
    ):
      raise ValueError("Invalid source resource")
    path = self.directory / "source" / suffix
    if path.is_file():
      return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    request = Request(
      url, headers={"User-Agent": "Klotzkette/isometric-berlin facade survey"}
    )
    for attempt in range(3):
      try:
        with urlopen(request, timeout=15) as response:
          data = response.read(16 * 1024**2 + 1)
        if len(data) > 16 * 1024**2:
          raise ValueError("Historical resource exceeds 16 MiB")
        break
      except HTTPError as error:
        if error.code in (404, 410):
          data = b""
          break
        if attempt == 2:
          raise
      except OSError:
        if attempt == 2:
          raise
    with NamedTemporaryFile(dir=path.parent, delete=False) as target:
      target.write(data)
    Path(target.name).replace(path)
    return data

  @lru_cache(maxsize=48)
  def image(self, url):
    with Image.open(io.BytesIO(self.read(url))) as image:
      return np.asarray(image.convert("RGB"))

  @lru_cache(maxsize=512)
  def digest(self, url):
    return hashlib.sha256(self.read(url)).hexdigest()


def owners(rows):
  chunks = {
    d["id"]: d for d in json.loads((MESH / "manifest.json").read_bytes())["chunks"]
  }
  buildings = {}
  for row in rows:
    if row["tiles"] == ["core"]:
      continue
    polys = []
    for tile in row["tiles"]:
      data = json.loads(
        gzip.decompress((MESH / chunks[tile]["drawn"]["url"]).read_bytes())
      )
      ox, _, oz = data["origin"]
      for b in data["nav"]["buildings"]:
        if (b.get("parentId") or b.get("sourceId")) == row["id"] and len(
          b["ring"]
        ) >= 3:
          poly = sh.make_valid(Polygon(b["ring"], b.get("holes") or []))
          polys.append(translate(poly, ox, oz))
    if polys:
      buildings[row["id"]] = sh.union_all(polys)
  return buildings


def kml_tile(pt, master):
  b = master["bbox"]
  return (
    math.floor((pt[1] - b["ymin"]) * master["rownum"] / (b["ymax"] - b["ymin"])),
    math.floor((pt[0] - b["xmin"]) * master["colnum"] / (b["xmax"] - b["xmin"])),
  )


def catalog_for(poly, master):
  x0, z0, x1, z1 = poly.bounds
  indices = [
    kml_tile(ll.transform(389500 + x, 5820000 - z), master)
    for x in (x0 - 60, x1 + 60)
    for z in (z0 - 60, z1 + 60)
  ]
  rows, cols = zip(*indices)
  return {
    (r, c)
    for r in range(min(rows), max(rows) + 1)
    for c in range(min(cols), max(cols) + 1)
  }


def read_kml(tile, archive):
  r, c = tile
  u = BASE + f"Tiles/{r}/{c}/{LAYER}_Tile_{r}_{c}_collada.kml"
  buf = archive.read(u)
  if not buf:
    return []
  root = ET.fromstring(buf)
  out = []
  for model in root.findall(".//{*}Model"):
    loc = model.find("{*}Location")
    ref = model.findtext("{*}Link/{*}href")
    e, n = xy.transform(
      float(loc.findtext("{*}longitude")), float(loc.findtext("{*}latitude"))
    )
    p = (e - 389500, 5820000 - n)
    out.append((urljoin(u, ref), p))
  return out


def candidates(buildings, archive):
  master = json.loads(archive.read(BASE + LAYER + "_collada_MasterJSON.json"))
  by = {o: catalog_for(p, master) for o, p in buildings.items()}
  tiles = sorted(set.union(*by.values()))
  with ThreadPoolExecutor(8) as pool:
    catalogs = dict(zip(tiles, pool.map(lambda tile: read_kml(tile, archive), tiles)))
  work = {}
  for owner, tiles0 in by.items():
    actual = buildings[owner]
    work[owner] = {
      u: pt for t in tiles0 for u, pt in catalogs[t] if actual.distance(Point(pt)) <= 9
    }
  print("catalogs", len(tiles), "models", sum(map(len, work.values())), flush=True)
  models = {u for w in work.values() for u in w}
  with ThreadPoolExecutor(8) as pool:
    list(pool.map(lambda u: len(archive.read(u)), sorted(models)))
  return work


def parse_model(url, anchor, footprint, archive):
  raw = archive.read(url)
  if not raw:
    return []
  root = ET.fromstring(raw)
  images = {
    e.get("id"): e.findtext("{*}init_from")
    for e in root.findall(".//{*}library_images/{*}image")
  }
  effects = {}
  for e in root.findall(".//{*}library_effects/{*}effect"):
    source = e.findtext(".//{*}surface/{*}init_from")
    if source in images:
      effects[e.get("id")] = urljoin(url, images[source])
  mats = {
    m.get("id"): effects.get(m.find("{*}instance_effect").get("url", "")[1:])
    for m in root.findall(".//{*}library_materials/{*}material")
  }
  symbols = {
    i.get("symbol"): mats.get(i.get("target", "")[1:])
    for i in root.findall(".//{*}instance_material")
  }
  faces = []
  projections = []
  min_y = math.inf
  for mesh in root.findall(".//{*}library_geometries/{*}geometry/{*}mesh"):
    sources = {}
    for src in mesh.findall("{*}source"):
      acc = src.find(".//{*}accessor")
      values = src.findtext("{*}float_array")
      if values:
        sources[src.get("id")] = np.fromstring(values, sep=" ").reshape(
          -1, int(acc.get("stride", "1"))
        )
    vmap = {
      v.get("id"): v.find("{*}input").get("source")[1:]
      for v in mesh.findall("{*}vertices")
    }
    for t in mesh.findall("{*}triangles"):
      imurl = symbols.get(t.get("material"))
      inputs = {
        e.get("semantic"): (int(e.get("offset", "0")), e.get("source")[1:])
        for e in t.findall("{*}input")
      }
      if "VERTEX" not in inputs:
        continue
      p = np.fromstring(t.findtext("{*}p") or "", sep=" ", dtype=int).reshape(
        -1, 3, max(v[0] for v in inputs.values()) + 1
      )
      if not len(p):
        continue
      j, k = inputs["VERTEX"]
      v = sources[vmap[k]][p[:, :, j]]
      flat = v[:, :, :2].copy()
      flat[:, :, 0] += anchor[0]
      flat[:, :, 1] = anchor[1] - flat[:, :, 1]
      area = np.abs(
        (flat[:, 1, 0] - flat[:, 0, 0]) * (flat[:, 2, 1] - flat[:, 0, 1])
        - (flat[:, 1, 1] - flat[:, 0, 1]) * (flat[:, 2, 0] - flat[:, 0, 0])
      )
      projections.extend(sh.polygons(flat[area > 0.08]))
      min_y = min(min_y, float(v[:, :, 2].min()))
      if imurl and "TEXCOORD" in inputs:
        j, k = inputs["TEXCOORD"]
        uv = sources[k][p[:, :, j]]
        wall = (area < 0.35) & (np.ptp(v[:, :, 2], axis=1) > 1.2)
        for x, h, g in zip(flat[wall], v[wall, :, 2], uv[wall]):
          faces.append((x, h, g, imurl, url))
  if not faces or not projections:
    return []
  body = sh.union_all(projections)
  if body.area < 12 or body.intersection(footprint.buffer(1)).area < 0.72 * body.area:
    return []
  return [(x, h - min_y, uv, im, url) for x, h, uv, im, url in faces]


def render(owner, edge, triangles, archive):
  a, b, n = np.array(edge["a"]), np.array(edge["b"]), np.array(edge["normal"])
  d = b - a
  w = np.linalg.norm(d)
  h = edge["high"] - edge["low"]
  if w < 4 or h <= 0:
    return None
  d = d / w
  factor = min(5, 600 / w, 360 / h)
  W, H = max(3, round(w * factor)), max(3, round(h * factor))
  field = np.zeros((H, W, 4), dtype="uint8")
  refcounts = defaultdict(int)
  images = set()
  worst = 0
  for x, y, uv, im, u in triangles:
    dist = (x - a) @ n
    along = (x - a) @ d
    if (
      np.max(abs(dist)) > 1.25
      or np.ptp(dist) > 0.65
      or min(along) > w
      or max(along) < 0
    ):
      continue
    span = np.ptp(along)
    if span < 1 or np.ptp(dist) / span > 0.045:
      continue
    # y increases upwards; image scan lines increase downwards.
    relative_y = y + edge.get("buildingGround", edge["low"]) - edge["low"]
    v = np.stack((along / w * W, (1 - relative_y / h) * H), axis=-1)
    lx, ly = np.maximum([0, 0], np.floor(v.min(0)).astype(int))
    rx, ry = np.minimum([W, H], np.ceil(v.max(0)).astype(int))
    if lx >= rx or ly >= ry:
      continue
    mat = np.stack([v[1] - v[0], v[2] - v[0]], axis=1)
    if abs(np.linalg.det(mat)) < 0.5:
      continue
    yy, xx = np.mgrid[ly:ry, lx:rx]
    p = (
      np.stack([xx + 0.5 - v[0, 0], yy + 0.5 - v[0, 1]], axis=-1) @ np.linalg.inv(mat).T
    )
    mask = (p[:, :, 0] >= -1e-6) & (p[:, :, 1] >= -1e-6) & (p.sum(2) <= 1 + 1e-6)
    if not mask.any():
      continue
    coord = uv[0] + p[mask] @ (uv[1:] - uv[0])
    img = archive.image(im)
    ih, iw = img.shape[:2]
    px = np.clip((coord[:, 0] * iw).astype(int), 0, iw - 1)
    py = np.clip(((1 - coord[:, 1]) * ih).astype(int), 0, ih - 1)
    out = field[ly:ry, lx:rx]
    out[mask, :3] = img[py, px]
    out[mask, 3] = 255
    refcounts[u] += int(mask.sum())
    images.add(im)
    worst = max(worst, float(np.max(abs(dist))))
  covered = field[:, :, 3] > 0
  if (
    covered.sum() < 100 or covered.mean() < 0.09 or covered.sum() * w * h / (W * H) < 10
  ):
    return None
  location = [owner, edge["a"], edge["b"], edge["low"], edge["high"]]
  if "wallId" in edge:
    location.extend([edge["wallId"], edge["buildingGround"]])
  key = hashlib.sha256(json.dumps(location).encode()).hexdigest()[:14]
  file = archive.directory / "rectified" / owner / (key + ".png")
  file.parent.mkdir(parents=True, exist_ok=True)
  Image.fromarray(field).save(file, compress_level=3)
  return dict(
    id=owner,
    **({"wallId": edge["wallId"]} if "wallId" in edge else {}),
    a=edge["a"],
    b=edge["b"],
    normal=edge["normal"],
    low=edge["low"],
    high=edge["high"],
    widthM=round(w, 2),
    heightM=round(h, 2),
    image=str(file),
    fraction=round(float(covered.mean()), 3),
    wallDistanceM=round(worst, 3),
    sourceUrl=max(refcounts, key=refcounts.get),
    sourceUrls=sorted(refcounts),
    imageSources=sorted(images),
  )


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--ranking",
    type=Path,
    default=ROOT / "geo_data/regierungsviertel/windowless-buildings-v377.json",
  )
  parser.add_argument(
    "--cache",
    type=Path,
    required=True,
    help="Local working directory for evidence (outside the public site)",
  )
  parser.add_argument(
    "--shell-walls",
    type=Path,
    help="Use measured LoD2 walls, including elevated walls of individual wings",
  )
  args = parser.parse_args()
  archive = SourceArchive(args.cache.resolve())
  archive.directory.mkdir(parents=True, exist_ok=True)
  read = gzip.open if args.ranking.suffix == ".gz" else open
  with read(args.ranking, "rt", encoding="utf-8") as data:
    targets = json.load(data)["targets"]
  prefix = ""
  if args.shell_walls:
    supplied = json.loads(args.shell_walls.read_bytes())["targets"]
    targets = [t for t in targets if t["id"] in supplied]
    for t in targets:
      source_ground = min(w["low"] for w in t["segments"] if w["family"] == "drawn")
      t["segments"] = [
        {**w, "buildingGround": source_ground} for w in supplied[t["id"]]
      ]
    prefix = "shell-"
  footprints = owners(targets)
  index = candidates(footprints, archive)
  matches = []
  for target in targets:
    owner = target["id"]
    if owner not in footprints:
      continue
    triangles = []
    for url, anchor in index[owner].items():
      triangles.extend(parse_model(url, anchor, footprints[owner], archive))
    seen = set()
    for edge in target["segments"]:
      if edge["family"] != "drawn":
        continue
      key = (
        tuple(edge["a"]),
        tuple(edge["b"]),
        edge["low"],
        edge["high"],
        edge.get("wallId"),
      )
      if key in seen:
        continue
      seen.add(key)
      match = render(owner, edge, triangles, archive)
      if match:
        matches.append(match)
  sources = sorted(
    {url for match in matches for url in match["sourceUrls"] + match["imageSources"]}
  )
  evidence = {url: archive.digest(url) for url in sources}
  (archive.directory / (prefix + "source-sha256.json")).write_text(
    json.dumps(evidence, sort_keys=True, indent=2) + "\n"
  )
  (archive.directory / (prefix + "matches.json")).write_text(
    json.dumps(matches, indent=2) + "\n"
  )
  print(
    f"{len(matches)} rectified historical walls for {len({m['id'] for m in matches})} modern source identities"
  )


if __name__ == "__main__":
  main()
