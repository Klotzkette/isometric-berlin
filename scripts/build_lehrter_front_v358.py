"""Produce a small façade update over the unchanged exact v277 Lehrter model."""

import base64
import copy

import numpy as np

from scripts.build_lehrter_v277 import DATA, SOURCE, prepare, read, recognition, write
from scripts.build_theatres_v272 import native_shell


def pack(rows, kind):
  return base64.b64encode(np.asarray(rows, dtype=kind).tobytes()).decode()


def splice(before, after):
  first = next(i for i, (old, new) in enumerate(zip(before, after)) if old != new)
  tail = 0
  while tail < min(len(before), len(after)) - first and before[-tail - 1] == after[-tail - 1]:
    tail += 1
  return first, len(before) - tail, after[first:len(after) - tail]


def main():
  old = read(DATA / "lehrterV277.json")
  scene = prepare(read(SOURCE))
  original = native_shell(scene)
  new_scene = copy.deepcopy(scene)
  a = np.array([-789.476, -1716.036])
  b = np.array([-795.547, -1728.581])
  length = np.linalg.norm(b - a)
  direction = (b - a) / length
  normal = np.array([direction[1], -direction[0]])
  street_color = 0x9A9381
  for surface in new_scene["surfaces"]:
    if surface.get("legacyComplement") or surface["key"] != "kulturfabrik" or surface["kind"] != "WallSurface":
      continue
    footprint = np.asarray(surface["rings"][0])[:, [0, 2]] - a
    if np.max(np.abs(footprint @ normal)) < .12 and np.min(footprint @ direction) > -.17 and np.max(footprint @ direction) < length + .17:
      surface["color"] = street_color

  colors = [s["color"] for s in scene["surfaces"] for _ in s["triangles"]]
  next_colors = [s["color"] for s in new_scene["surfaces"] for _ in s["triangles"]]
  assert pack(colors, "<u4") == old["sourceColors"]
  recolor = [i for i, (old_color, new_color) in enumerate(zip(colors, next_colors)) if old_color != new_color]
  assert recolor
  blocks = native_shell(new_scene)
  assert len(blocks) == len(original)
  assert all(a[:7] == b[:7] for a, b in zip(blocks, original))
  native_recolor = [i for i, (a, b) in enumerate(zip(blocks, original)) if a[7] != b[7]]
  assert native_recolor

  drawn, native, ribs, labels = recognition(scene, original)
  new_drawn, new_native, new_ribs, new_labels = recognition(new_scene, blocks, culture_front_v358=True)
  assert pack([r[:8] for r in drawn], "<f4") == old["facadeBoxes"]
  assert pack([r[:8] for r in original + native], "<f4") == old["nativeBoxes"]
  assert ribs == old["ribSegments"] and labels == old["labels"]
  d0, d1, drawn_rows = splice(drawn, new_drawn)
  n0, n1, native_rows = splice(native, new_native)
  r0, r1, rib_rows = splice(ribs, new_ribs)
  l0, l1, label_rows = splice(labels, new_labels)
  write(DATA / "lehrterFrontV358.json", {
    "photo": "https://www.nachhaltige-erneuerung.berlin.de/tiergarten-nordring-heidestrasse/kulturfabrik-sanierung/fotos",
    "color": street_color,
    "triangles": recolor,
    "nativeShell": native_recolor,
    "drawn": {"start": d0, "end": d1, "rows": pack([r[:8] for r in drawn_rows], "<f4")},
    "native": {"start": len(original) + n0, "end": len(original) + n1, "rows": pack([r[:8] for r in native_rows], "<f4")},
    "ribs": {"start": r0, "end": r1, "rows": rib_rows},
    "labels": {"start": l0, "end": l1, "rows": label_rows},
  })


if __name__ == "__main__":
  main()
