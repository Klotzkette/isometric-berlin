"""Cut positively identified intersecting lawns over mapped paths in Mitte.

Run build_mitte_path_depth_v375.py --capture DIR first. All operations take place
in metres in the original world coordinates, including comparisons with draped
faces. The output contains only affected face IDs and the remaining lawn geometry.
"""

import argparse
import base64
import gzip
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from build_mitte_path_depth_v375 import read_conflicts, restricted, study_scope
from shapely.geometry import Polygon


def packed(array):
  if len(array):
    # Neighbouring geometry shares many exponent / high-order bytes. Separate
    # their byte planes before gzip. XOR is reversible for every Float32 bit.
    raw = array.view(np.uint8).reshape(len(array), -1)
    separate = raw.T.copy()
    separate[:, 1:] ^= separate[:, :-1].copy()
    encoded = separate.tobytes()
  else:
    encoded = b""
  return base64.b64encode(gzip.compress(encoded, mtime=0)).decode("ascii")


def source_guard(faces, indices, positions):
  value = 2166136261
  bits = positions.view("<u4")
  for face in faces:
    for vertex in indices[face]:
      for word in (vertex, *bits[vertex]):
        value = ((value ^ int(word)) * 16777619) & 0xFFFFFFFF
  return value


def clipped_conflicts(capture, kind, scope):
  blockers = restricted(kind)
  per_face = defaultdict(list)
  for _, host, face, _, data in read_conflicts(capture, kind):
    if host.startswith("park") and host.endswith("-top"):
      per_face[host, face].append(shapely.from_wkb(data))
  result = {}
  for key, pieces in per_face.items():
    area = shapely.intersection(shapely.union_all(pieces), scope)
    if area.area < 1e-6:
      continue
    overlaps = blockers.query(area, predicate="intersects")
    if len(overlaps):
      masks = shapely.intersection(blockers.geometries[overlaps], area)
      area = area.difference(shapely.union_all(masks))
    if area.area >= 1e-6:
      result[key] = area
  return result


def build(capture, output, proof_dir=None):
  scope = study_scope()
  per_host = defaultdict(lambda: defaultdict(list))
  for kind in ("sand", "earth", "paved"):
    accepted = clipped_conflicts(capture, kind, scope)
    for (host, face), area in accepted.items():
      per_host[host][face].append(area)
    if proof_dir is not None:
      (proof_dir / f"lawn-cuts-{kind}.wkb").write_bytes(
        shapely.to_wkb(shapely.union_all(list(accepted.values())))
      )
    print(
      kind, len(accepted), round(sum(g.area for g in accepted.values()), 2), flush=True
    )

  simson = json.loads(
    (
      Path(__file__).resolve().parents[1] / "src/app/src/data/simsonCutsV375.json"
    ).read_bytes()
  )
  batches = []
  unique_area = []
  for host, occluded in sorted(per_host.items()):
    vertices = np.fromfile(capture / (host + ".xyz"), "<f4").reshape(-1, 3)
    indices = np.fromfile(capture / (host + ".tri"), "<u4").reshape(-1, 3)
    faces, new_vertices, new_indices = [], [], []
    assignment = {}
    key = "surface-parks-" + str(int(host[4 : host.index("-")]) + 1)
    old = simson.get(key, {}).get("smooth parkland lawns")
    reserved_faces = set()
    if old:
      words = gzip.decompress(base64.b64decode(old["records"]))
      reserved_faces.update(np.frombuffer(words, "<i4").reshape(-1, 5)[:, 0])
    if reserved_faces.intersection(occluded):
      raise ValueError(f"Cannot replace an original Simson-owned face in {host}")
    for face, cuts in sorted(occluded.items()):
      original = vertices[indices[face]].astype(float)
      footprint = Polygon(original[:, [0, 2]])
      cut = shapely.union_all(cuts).intersection(footprint)
      if cut.area < 1e-6:
        continue
      remaining = footprint.difference(cut)
      triangles = shapely.get_parts(shapely.constrained_delaunay_triangles(remaining))
      if abs(shapely.area(triangles).sum() + cut.area - footprint.area) > 1e-5:
        raise ValueError(f"Area conservation failed on {host} face {face}")
      normal = np.cross(original[1] - original[0], original[2] - original[0])
      projected = []
      for triangle in triangles:
        pts = shapely.get_coordinates(triangle)[:3]
        # Quantize only to the Float32 representation used by WebGL.
        x, z = pts.T.astype("<f4")
        y = (
          original[0, 1]
          - (
            normal[0] * (x.astype(float) - original[0, 0])
            + normal[2] * (z.astype(float) - original[0, 2])
          )
          / normal[1]
        )
        xyz = np.column_stack((x, y, z)).astype("<f4")
        signed = np.cross(xyz[1].astype(float) - xyz[0], xyz[2].astype(float) - xyz[0])[
          1
        ]
        if signed == 0:
          continue
        if signed * normal[1] < 0:
          xyz = xyz[[0, 2, 1]]
        projected.append(Polygon(xyz[:, [0, 2]]))
        for point in xyz:
          key = point.tobytes()
          if key not in assignment:
            assignment[key] = len(new_vertices)
            new_vertices.append(point)
          new_indices.append(assignment[key])
      # Boundary errors are at most a Float32 rounding step per side.
      area_error = shapely.symmetric_difference(
        remaining, shapely.union_all(projected)
      ).area
      if area_error > 0.001 * footprint.length + 1e-6:
        raise ValueError(f"Float32 area conservation failed on {host} face {face}")
      faces.append(face)
      unique_area.append(cut)
    if not faces:
      continue
    index_dtype = "<u2" if len(new_vertices) < 65535 else "<u4"
    batches.append(
      {
        "vertices": len(vertices),
        "indices": int(indices.size),
        "guard": source_guard(faces, indices, vertices),
        "faces": packed(np.array(faces, dtype="<u4")),
        "positions": packed(np.array(new_vertices, dtype="<f4")),
        "remainder": packed(np.array(new_indices, dtype=index_dtype)),
        "wide": index_dtype == "<u4",
      }
    )
    print(
      host,
      "original faces",
      len(faces),
      "remaining triangles",
      len(new_indices) // 3,
      flush=True,
    )
  output.write_text(json.dumps(batches, separators=(",", ":")) + "\n")
  total = shapely.union_all(unique_area)
  if proof_dir is not None:
    (proof_dir / "lawn-cuts-total.wkb").write_bytes(shapely.to_wkb(total))
  print("Unique lawn area opened (m²)", round(total.area, 3))
  print("Runtime data (bytes)", output.stat().st_size)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path, required=True)
  parser.add_argument(
    "--output",
    type=Path,
    default=Path(__file__).resolve().parents[1]
    / "src/app/src/data/mittePathLawnV375.json",
  )
  parser.add_argument(
    "--proof-dir", type=Path, help="Optional directory for projected opening polygons"
  )
  args = parser.parse_args()
  build(args.capture, args.output, args.proof_dir)
