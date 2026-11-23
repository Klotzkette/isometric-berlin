"""Refresh landmark material samples from authenticated LoD2, TrueDOP and facade records.

The index requires full real measurements from the input resources. No photograph
is copied to the website. The production generator then replays the measurements
against the original LoD2 archives and the two original city packet editions.
"""

import argparse
import hashlib
from collections import defaultdict
from pathlib import Path

import build_surveyed_building_shells_v377 as shell
import numpy as np
from build_historic_architecture_v378 import GEO, load, write
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion

from scripts.build_building_facade_profiles_v377 import capture_photos


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def material_swatch(pixels, roof):
  if len(pixels) < 18:
    return None
  samples = pixels.astype(float)
  r, g, b = samples.T
  luminance = 0.299 * r + 0.587 * g + 0.114 * b
  # Sample visible, illuminated material. Exclude foliage, sky-blue reflections
  # and the lightest and deepest extremes of the flight's exposure.
  valid = (
    (luminance > 48)
    & (luminance < 238)
    & ~((g > r * 1.08) & (g > b * 1.13))
    & ~((b > r * 1.29) & (b > g * 1.06))
  )
  if valid.sum() < max(18, 0.27 * len(pixels)):
    return None
  values = luminance[valid]
  lo, hi = np.percentile(values, [40, 83] if roof else [52, 87])
  rgb = np.median(samples[valid][(values >= lo) & (values <= hi)], axis=0)
  if not np.isfinite(rgb).all():
    return None
  if roof:
    rgb = rgb * 0.86 + [25, 25, 25]
  return (np.rint(rgb / 4) * 4).astype(int).clip(0, 255).tolist()


def roof_swatch(image, bbox, rings):
  x0, y0, x1, y1 = bbox
  sx, sy = image.width / (x1 - x0), image.height / (y1 - y0)
  mask = Image.new("1", image.size)
  draw = ImageDraw.Draw(mask)
  for index, ring in enumerate(rings):
    draw.polygon(
      [((389500 + x - x0) * sx, (y1 - 5820000 + z) * sy) for x, _, z in ring],
      fill=int(index == 0),
    )
  # Trim the boundary so that neighbouring roofs and streets do not bleed in.
  return material_swatch(np.asarray(image)[binary_erosion(np.asarray(mask))], True)


def capture(archives, ortho_dir, archive_dir):
  evidence_file = GEO / "historicArchitectureV378Evidence.json.gz"
  data = load(evidence_file)
  ranking = load(GEO / "historicArchitectureV378Ranking.json.gz")
  original, measured = [
    archive_dir / name for name in ("matches.json", "shell-matches.json")
  ]
  matches = defaultdict(list)
  for record in load(measured):
    matches[record["id"]].append(record)
  hashes = {
    u: digest
    for name in ("source-sha256.json", "shell-source-sha256.json")
    for u, digest in load(archive_dir / name).items()
  }
  wall_sources = {}
  for site in data["landmarks"]:
    owner = site["id"]
    archive = archives / ("LoD2_" + site["catalogueTile"] + ".zip")
    orthophoto = ortho_dir / (owner + ".jpg")
    if (
      sha(archive) != site["cityGMLSha256"]
      or sha(orthophoto) != site["ortho"]["sha256"]
    ):
      raise ValueError(f"Unexpected archive or orthophoto for {owner}")
    _, surfaces = shell.read_surfaces(archive, site["sourceBuilding"])
    colours = {}
    with Image.open(orthophoto) as image:
      rgb = image.convert("RGB")
      for kind, _, __, polygon, rings in surfaces:
        if kind == "RoofSurface":
          colour = roof_swatch(rgb, site["ortho"]["bbox"], rings)
          if colour:
            colours[polygon] = colour
    site["roofMaterialSwatches"] = len(colours)
    wall_sources[owner] = {}
    for record in matches[owner]:
      if record["fraction"] < 0.7 or record["wallDistanceM"] > 1:
        continue
      path = archive_dir / "rectified" / owner / Path(record["image"]).name
      image = np.asarray(Image.open(path).convert("RGBA"))
      colour = material_swatch(image[image[:, :, 3] > 240][:, :3], False)
      if colour:
        wall = record["wallId"]
        colours[wall] = colour
        wall_sources[owner][wall] = {
          key: record[key]
          for key in ("sourceUrls", "imageSources", "fraction", "wallDistanceM")
        }
        wall_sources[owner][wall]["rectifiedSha256"] = sha(path)
    site["wallMaterialSwatches"] = len(wall_sources[owner])
    data["surfaceColours"][owner] = colours
  data["photos"] = capture_photos(ranking, [original, measured])
  data["materialPhotographs"] = wall_sources
  observations = [r for owner in wall_sources.values() for r in owner.values()]
  observations.extend(r for rs in data["photos"]["targets"].values() for r in rs)
  resources = {
    u for r in observations for key in ("sourceUrls", "imageSources") for u in r[key]
  }
  data["archiveResources"] = {url: hashes[url] for url in sorted(resources)}
  write(evidence_file, data)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  for name in ("archives", "orthophotos", "historical-facades"):
    parser.add_argument("--" + name, required=True, type=Path)
  args = parser.parse_args()
  capture(args.archives, args.orthophotos, args.historical_facades)
