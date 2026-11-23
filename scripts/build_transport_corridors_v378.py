"""Bind actual public road and rail courses to their visible existing surfaces or narrow exterior cells."""

from __future__ import annotations
import argparse, base64, collections, gzip, json, math
from pathlib import Path
import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely import STRtree, polygons

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
TILES = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RUNTIME = DATA / "transportV378"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def geometry_parts(geom):
  if geom.is_empty:
    return []
  if geom.geom_type == "LineString":
    return [geom]
  return [line for part in getattr(geom, "geoms", ()) for line in geometry_parts(part)]


def width(tags, rail):
  if rail:
    return 3.55, 0
  raw = tags.get("width", "").strip().replace(",", ".")
  try:
    w = float(raw.rstrip(" m"))
    w = w if 2.5 <= w <= 30 else 0
  except ValueError:
    w = 0
  try:
    lanes = int(tags.get("lanes", "0"))
  except ValueError:
    lanes = 0
  lanes = max(1, min(6, lanes)) if lanes else 0
  if not w:
    w = (lanes or (2 if tags["highway"] in ("motorway", "trunk") else 1)) * 3.3 + 1
  return round(w, 2), lanes


class Support:
  def __init__(self, descriptors):
    self.plans = []
    self.ground = []
    self.by_mode = {f: [] for f in ["drawn", "minecraft"]}
    self.heights = {f: [] for f in self.by_mode}
    self.hosts = {f: [] for f in self.by_mode}
    self.roles = {f: [] for f in self.by_mode}
    for desc in descriptors:
      if desc.get("detailCompanionOf"):
        continue
      for family in self.by_mode:
        raw = json.loads(gzip.decompress((TILES / desc[family]["url"]).read_bytes()))
        ox, oy, oz = raw["origin"]
        if family == "drawn":
          for p in raw["nav"]["ground"]:
            if p["ring"]:
              self.ground.append(
                Polygon(
                  [(ox + x, oz + z) for x, z in p["ring"]],
                  [[(ox + x, oz + z) for x, z in hole] for hole in p["holes"]],
                ).buffer(0)
              )
        for mesh in raw["meshes"]:
          if mesh["kind"] not in (
            "city",
            "ber-ground-v236",
            "ber-buildings-and-access-v236",
          ):
            continue
          xyz = (
            np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
            .reshape(-1, 3)
            .astype("float64")
            / 100
          )
          xyz += np.asarray([ox, oy, oz])
          col = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(
            -1, 3
          )
          ix = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
            -1, 3
          )
          # Ground roads in v159 and the BER public road material have independent audited colours.
          for rgb, role in [
            ([39, 41, 39], 0),
            ([56, 58, 53], 0),
            ([41, 32, 24], 1),
            ([35, 41, 35], 1),
          ]:
            selected = ix[np.all(np.all(col[ix] == rgb, axis=2), axis=1)]
            if not len(selected):
              continue
            pp = xyz[selected]
            flat = pp[
              (np.ptp(pp[:, :, 1], axis=1) < 0.11) & (pp[:, :, 1].max(axis=1) < 20)
            ]
            if not len(flat):
              continue
            tris = polygons(flat[:, :, [0, 2]])
            self.by_mode[family].extend(tris)
            self.heights[family].extend(np.mean(flat[:, :, 1], axis=1).tolist())
            self.hosts[family].extend([desc["id"]] * len(tris))
            self.roles[family].extend([role] * len(tris))
    self.trees = {f: STRtree(faces) for f, faces in self.by_mode.items()}
    self.ground_tree = STRtree(self.ground)

  def hit(self, p, family, role):
    ids = self.trees[family].query(p, predicate="intersects")
    result = [
      (self.heights[family][i], self.hosts[family][i])
      for i in ids
      if self.roles[family][i] == role
    ]
    return max(result, default=None)

  def has_ground(self, p):
    return len(self.ground_tree.query(p, predicate="intersects")) > 0


def output():
  raw = json.loads(
    gzip.decompress((GEO / "transport-corridors-v378.json.gz").read_bytes())
  )
  manifest = json.loads((TILES / "manifest.json").read_text())["chunks"]
  descs = collections.defaultdict(list)
  for d in manifest:
    x, z, _, _ = d["bounds"]
    descs[(math.floor(x / 512), math.floor(z / 512))].append(d)
  area = collections.defaultdict(list)
  for ident, row in raw["ways"].items():
    tags = row["tags"]
    rail = row["kind"] == "S9"
    route = row["kind"]
    underground = (
      tags.get("tunnel") in ("yes", "building_passage") or tags.get("covered") == "yes"
    )
    if underground or tags.get("access") == "private":
      continue
    coords = [
      (float(x) - 389500, 5820000 - float(y))
      for x, y in (PROJECT.transform(*p) for p in row["geometry"])
    ]
    line = LineString(coords)
    if line.length < 1:
      continue
    w, lanes = width(tags, rail)
    is_bridge = tags.get("bridge") in ("yes", "viaduct") or tags.get("layer", "0") in (
      "1",
      "2",
      "3",
    )
    minx, minz, maxx, maxz = line.bounds
    for ix in range(math.floor(minx / 512), math.floor(maxx / 512) + 1):
      for iz in range(math.floor(minz / 512), math.floor(maxz / 512) + 1):
        for clipped in geometry_parts(
          line.intersection(box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512))
        ):
          if clipped.length > 0.2:
            area[(ix, iz)].append(
              (
                ident,
                route,
                w,
                lanes,
                is_bridge,
                clipped,
                line.project(Point(clipped.coords[0])),
              )
            )
  index = {}
  tiles = {}
  stats = collections.Counter()
  hostReceipts = {}
  for (ix, iz), pieces in sorted(area.items()):
    support = Support(descs[(ix, iz)])
    modes = {}
    ox = ix * 512
    oz = iz * 512
    for family in ["drawn", "minecraft"]:
      rows = []
      for ident, route, w, lanes, bridge, geom, phase in pieces:
        rail = route == "S9"
        role = int(rail)
        previous = None
        elapsed = phase
        for a, b in zip(geom.coords, list(geom.coords)[1:]):
          dx = b[0] - a[0]
          dz = b[1] - a[1]
          length = math.hypot(dx, dz)
          if length < 0.01:
            continue
          n = max(1, math.ceil(length / 10))
          nx, nz = -dz / length, dx / length
          for ii in range(n):
            s = ii / n
            e = (ii + 1) / n
            tt = (s + e) / 2
            x = a[0] + dx * tt
            z = a[1] + dz * tt
            p = Point(x, z)
            hit = support.hit(p, family, role)
            style = 0
            h = None
            host = None
            if (
              route == "A103"
              and bridge
              and 6490 <= z <= 7141.71
              and any(poly.covers(p) for poly in steglitz)
            ):
              # The v226 Steglitz underpass has a real, separate deck grade, including both approaches.
              style = 1 if lanes >= 2 else 0
              h = steglitz_y(z)
              host = "v226"
            elif hit:
              h, host = hit
              if rail:
                style = 3
              elif lanes >= 2:
                style = 1
            elif route in ("A111", "A113", "S9", "BER") and not support.has_ground(p):
              style = 4 if rail else 2
              h = 3.09
              host = "exterior"
            elif route in ("S9", "A113", "BER") and not bridge:
              # Modelled access outside the terminal apron may cross an ordinary ground-only tile.
              # Do not write through an older exact airport surface or a crossing of a different mode.
              has_airfield = any(
                v["id"].startswith(("ber236-", "ber347-")) for v in descs[(ix, iz)]
              )
              if not has_airfield and support.hit(p, family, 1 - role) is None:
                style = 4 if rail else 2
                h = 3.09
                host = "mapped-ground"
            if h is None or not style:
              previous = None
              continue
            # A bridge's lower projected strip cannot supply a safe paint height by itself.
            if (
              bridge and host not in ("exterior", "v226") and route != "S9" and h < 3.6
            ):
              previous = None
              continue
            if style == 1 and host != "v226":
              shift = w / 2 - w / lanes
              if shift > 0.1 and any(
                support.hit(
                  Point(x + nx * shift * sg, z + nz * shift * sg), family, role
                )
                is None
                for sg in [-1, 1]
              ):
                previous = None
                continue
            y = -1 if host == "v226" else round(h, 2)
            key = (ident, style, w, lanes, y, host)
            coords = lambda t: [
              round((a[0] + dx * t - ox) * 10),
              round((a[1] + dz * t - oz) * 10),
            ]
            aa, bb = coords(s), coords(e)
            if aa == bb:
              continue
            if previous == key and rows[-1][6][-2:] == aa:
              rows[-1][6].extend(bb)
            else:
              rows.append(
                [
                  int(ident),
                  style,
                  w,
                  lanes,
                  y,
                  round(elapsed + s * length, 1),
                  [*aa, *bb],
                ]
              )
            previous = key
            if host not in ("exterior", "mapped-ground", "v226"):
              hostReceipts[host] = next(d for d in descs[(ix, iz)] if d["id"] == host)[
                "drawn"
              ]["sha256"]
            if family == "drawn":
              stats[(route, style)] += length / n
          elapsed += length
      if rows:
        modes[family] = rows
    if modes:
      for f, rows in modes.items():
        # Remove only exactly collinear sub-samples introduced by support tests. Keep every original bend.
        for r in rows:
          pts = list(zip(r[6][::2], r[6][1::2]))
          pr = []
          for p in pts:
            while len(pr) >= 2 and (pr[-1][0] - pr[-2][0]) * (p[1] - pr[-1][1]) == (
              pr[-1][1] - pr[-2][1]
            ) * (p[0] - pr[-1][0]):
              pr.pop()
            pr.append(p)
          r[6] = [n for p in pr for n in p]
      if modes.get("drawn") == modes.get("minecraft"):
        modes = {"both": modes["drawn"]}
      key = f"transport378-{ix}_{iz}"
      bank = f"{ix // 4}_{iz // 4}"
      tiles.setdefault(bank, {})[key] = modes
      index[key] = [bank, any(r[1] in (2, 4) for rows in modes.values() for r in rows)]
  return index, tiles, stats, hostReceipts


steglitz = [
  Polygon(p[0], p[1:])
  for p in json.loads((DATA / "steglitzMotorwayV226Navigation.json").read_text())[
    "polygons"
  ]
]


def steglitz_y(z):
  if z <= 6640:
    return 3.09 + (9.4 - 3.09) * (z - 6490) / 150
  if z < 6895:
    return 9.4
  if z < 7060:
    return 9.4 - (9.4 - 3.09) * (z - 6895) / 165
  return 3.09


def serial(data):
  return (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--check", action="store_true")
  a = ap.parse_args()
  RUNTIME.mkdir(exist_ok=True)
  idx, banks, stats, hosts = output()
  output_files = {DATA / "transportV378Hosts.json": serial(idx)}
  for name, rows in banks.items():
    output_files[RUNTIME / (name + ".json.gz")] = gzip.compress(serial(rows), mtime=0)
  receipt = {
    "source": "OpenStreetMap contributors, ODbL 1.0",
    "sources": len(hosts),
    "drawnMetres": {f"{r}/{k}": round(v, 1) for (r, k), v in sorted(stats.items())},
    "tiles": len(idx),
    "banks": len(banks),
    "sourceHosts": hosts,
  }
  output_files[GEO / "transport-corridors-v378-receipt.json"] = serial(receipt)
  for path, val in output_files.items():
    if a.check:
      if path.read_bytes() != val:
        raise ValueError(f"Output mismatch: {path}")
    else:
      path.write_bytes(val)
  print(
    len(idx),
    "tiles",
    len(banks),
    "banks",
    sum(len(v) for v in output_files.values()),
    "bytes",
    receipt["drawnMetres"],
    flush=True,
  )


if __name__ == "__main__":
  main()
