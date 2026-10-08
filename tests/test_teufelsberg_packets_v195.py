"""All source faces survive finer terrain, independently of ignored staging caches."""

import base64
import gzip
import json
from collections import Counter

import numpy as np
from packet_receipts_v195 import (
  PUBLIC,
  audited_v195_changes,
  baseline,
  digest,
  terrain_packet,
  terrain_receipt,
)


def expanded(mesh: dict, origin: list) -> np.ndarray:
  positions = (
    np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
    .reshape(-1, 3)
    .astype(np.int64)
  )
  positions += np.rint(np.asarray(origin) * 100).astype(np.int64)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return np.concatenate([positions, colors], axis=1)[indices]


def water(rows: list[tuple[dict, dict]]) -> Counter:
  result = Counter()
  for packet, mesh in rows:
    tri = expanded(mesh, packet["origin"])
    selected = np.all(tri[:, :, 3:] == [36, 76, 86], axis=(1, 2))
    for t in tri[selected]:
      result[b"".join(sorted(v.astype("<i4").tobytes() for v in t))] += 1
  return result


def area_cm(triangles: np.ndarray) -> np.ndarray:
  a = triangles[:, 1, [0, 2]] - triangles[:, 0, [0, 2]]
  b = triangles[:, 2, [0, 2]] - triangles[:, 0, [0, 2]]
  return np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]) / 2


def test_exact_published_terrain_and_station_hash_chain_and_no_new_packet_ids() -> None:
  changes, companions = audited_v195_changes()
  assert len(companions) == 8 and changes
  assert all(identity.startswith("outer187--") for identity, mode in changes)


def test_every_original_face_colour_and_xz_course_survives_lossless_family_split() -> (
  None
):
  from build_teufelsberg_terrain_v195 import offset_at

  receipt = terrain_receipt()
  descriptors = receipt["replacementDescriptors"] + receipt["extraDescriptors"]
  splits = {r["id"]: r for r in receipt["splitPackets"]}
  sources = {r["id"]: r for r in receipt["packets"]}
  original = {r["id"]: r for r in receipt["baselineDescriptors"]}
  totals = Counter()
  for primary in receipt["replacementDescriptors"]:
    identity = primary["id"]
    family = [
      primary,
      *[d for d in descriptors if d.get("detailCompanionOf") == identity],
    ]
    for mode in ["drawn", "minecraft"]:
      initial = baseline(PUBLIC / primary[mode]["url"], "v1.0.89")
      source = json.loads(gzip.decompress(initial))
      audit = next(r for r in sources[identity]["representations"] if r["mode"] == mode)
      assert digest(initial) == audit["baseSha256"]
      current = [terrain_packet(d, mode) for d in family]
      split = next(r for r in splits[identity]["representations"] if r["mode"] == mode)
      assert split["unsplitSha256"] == audit["sha256"]
      pieces = [(p, m) for p in current for m in p["meshes"]]
      assert len(pieces) == sum(split["meshPieceCounts"]) == sum(split["packetMeshes"])
      assert (
        len(source["meshes"]) == len(audit["meshes"]) == len(split["meshPieceCounts"])
      )
      piece_offset = 0
      for mesh, record, piece_count in zip(
        source["meshes"], audit["meshes"], split["meshPieceCounts"], strict=True
      ):
        assert record["replacedHeroTriangles"] == 0
        before = expanded(mesh, source["origin"])
        selected = pieces[piece_offset : piece_offset + piece_count]
        piece_offset += piece_count
        assert all(m["kind"] == mesh["kind"] for _, m in selected)
        after = np.concatenate([expanded(m, p["origin"]) for p, m in selected])
        assert (
          len(before) == record["sourceTriangles"]
          and len(after) == record["resultTriangles"]
        )
        source_offset = output_offset = 0
        for start, count, kind, dy, result_count in record["placementRuns"]:
          assert start == source_offset
          a = before[start : start + count]
          b = after[output_offset : output_offset + count * result_count]
          if kind == "rigid":
            assert result_count == 1
            assert np.array_equal(a[:, :, [0, 2, 3, 4, 5]], b[:, :, [0, 2, 3, 4, 5]])
            # The receipt rounds only the centimetre datum, exactly as packing.
            assert np.max(np.abs(b[:, :, 1] - a[:, :, 1] - dy)) <= 1
            totals["rigid"] += count
          else:
            assert kind in ("terrain", "bank")
            assert np.all(a[:, :, 3:] == a[:, 0:1, 3:])
            assert np.array_equal(
              np.repeat(a[:, 0:1, 3:], result_count * 3, axis=1).reshape(-1, 3, 3),
              b[:, :, 3:],
            )
            # Every source XZ triangle is covered by its precise subdivision.
            # Native risers are vertical and contribute zero projected area.
            chunks = b.reshape(count, result_count, 3, 6)
            source_area = area_cm(a)
            result_area = area_cm(b).reshape(count, result_count).sum(axis=1)
            perimeter = np.linalg.norm(
              a[:, [1, 2, 0]][:, :, [0, 2]] - a[:, :, [0, 2]], axis=2
            ).sum(axis=1)
            tolerance = perimeter * 1.5 + result_count * 3
            assert np.all(np.abs(source_area - result_area) <= tolerance), (
              identity,
              mode,
              kind,
              start,
            )
            if result_count:
              assert np.all(
                chunks[:, :, :, [0, 2]].min(axis=(1, 2))
                >= a[:, :, [0, 2]].min(axis=1) - 1
              )
              assert np.all(
                chunks[:, :, :, [0, 2]].max(axis=(1, 2))
                <= a[:, :, [0, 2]].max(axis=1) + 1
              )
              # Check represented heights against the public navigation field,
              # including every source face near the independently measured
              # one-metre summit. Preserve centimeter quantization tolerance.
              if kind == "terrain":
                for local in range(count):
                  face = a[local]
                  near_crest = (
                    face[:, 0].max() > -880000
                    and face[:, 0].min() < -876800
                    and face[:, 2].max() > 214000
                    and face[:, 2].min() < 217200
                  )
                  if np.ptp(face[:, 1]) or ((start + local) % 50 and not near_crest):
                    continue
                  for triangle in chunks[local]:
                    if mode == "minecraft":
                      if area_cm(triangle[None])[0] == 0:
                        continue  # vertical riser joins adjacent native cells
                      x, z = triangle[:, [0, 2]].mean(axis=0) / 100
                      expected = face[0, 1] / 100 + offset_at(x, z, True)
                      assert np.max(np.abs(triangle[:, 1] / 100 - expected)) < 0.051
                    else:
                      for x, y, z in triangle[:, :3] / 100:
                        assert abs(y - face[0, 1] / 100 - offset_at(x, z)) < 0.051
            totals[kind] += count
          source_offset += count
          output_offset += count * result_count
        assert source_offset == len(before) and output_offset == len(after)
        if mesh["kind"] == "outskirts-v187-forest":
          assert before.shape == after.shape and len(before) % 18 == 0
          assert np.array_equal(before[:, :, [0, 2]], after[:, :, [0, 2]])
          delta = (after - before)[:, :, 1].reshape(-1, 18 * 3)
          assert np.all(np.ptp(delta, axis=1) == 0)
          totals["trees"] += len(delta)
      assert piece_offset == len(pieces)
      # All previous public surface/water/road/navigation rings remain exact.
      previous = json.loads(
        gzip.decompress(baseline(PUBLIC / original[identity][mode]["url"]))
      )
      a, b = previous["nav"], current[0]["nav"]
      assert {k: v for k, v in a.items() if k != "buildings"} == {
        k: v for k, v in b.items() if k != "buildings"
      }
      assert len(a["buildings"]) == len(b["buildings"])
      for left, right in zip(a["buildings"], b["buildings"], strict=True):
        assert {k: v for k, v in left.items() if k != "groundOffset"} == {
          k: v for k, v in right.items() if k != "groundOffset"
        }
      previous_family = [
        json.loads(gzip.decompress(baseline(PUBLIC / original[d["id"]][mode]["url"])))
        for d in family
      ]
      assert water([(p, m) for p in previous_family for m in p["meshes"]]) == water(
        pieces
      )
      for companion in current[1:]:
        assert all(
          not companion["nav"][k]
          for k in ("ground", "water", "roads", "bridges", "buildings")
        )
  assert totals == {"terrain": 188810, "rigid": 76319, "bank": 906, "trees": 1222}


def test_source_line_endpoints_and_colours_survive_terrain_subdivision() -> None:
  receipt = terrain_receipt()
  descriptors = {d["id"]: d for d in receipt["replacementDescriptors"]}
  for r in receipt["packets"]:
    for mode in r["representations"]:
      d = descriptors[r["id"]]
      old = json.loads(
        gzip.decompress(baseline(PUBLIC / d[mode["mode"]]["url"], "v1.0.89"))
      )
      after = terrain_packet(d, mode["mode"])
      audit = mode["lines"]
      if not audit:
        assert old.get("lines") == after.get("lines")
        continue
      assert not audit["replacedHeroSegments"]

      def lines(p: dict) -> np.ndarray:
        pos = (
          np.frombuffer(base64.b64decode(p["lines"]["positions"]), dtype="<u2")
          .reshape(-1, 2, 3)
          .astype(np.int64)
        )
        return pos + np.rint(np.asarray(p["origin"]) * 100).astype(np.int64)

      a, b = lines(old), lines(after)
      index = 0
      assert len(a) == audit["sourceSegments"] and len(b) == audit["resultSegments"]
      for start, count, kind, dy, pieces in audit["placementRuns"]:
        for n in range(count):
          before = a[start + n]
          current = b[index : index + pieces]
          index += pieces
          if kind == "rigid":
            assert pieces == 1 and np.array_equal(
              before[:, [0, 2]], current[0][:, [0, 2]]
            )
            assert np.max(np.abs(current[0][:, 1] - before[:, 1] - dy)) <= 1
          elif pieces:
            assert kind == "terrain"
            assert np.array_equal(
              before[:, [0, 2]], current[[0, -1], [0, 1]][:, [0, 2]]
            )
            assert np.array_equal(current[:-1, 1][:, [0, 2]], current[1:, 0][:, [0, 2]])
          else:
            assert np.linalg.norm(before[1, [0, 2]] - before[0, [0, 2]]) < 2
      assert index == len(b)
