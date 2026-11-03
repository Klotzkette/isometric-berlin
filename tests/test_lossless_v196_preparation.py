"""Finite v196 candidates retain exact originals through the applied receipt."""

import gzip
import json
import re

from scripts.integrate_lossless_v196 import predecessor_packet_bytes_v196, rows_v196
from scripts.prepare_lossless_v196 import ANCHOR, PIN_FILE, PUBLIC, ROOT, git_bytes, sha


def test_1280_full_original_git_packet_pins_and_all_exclusions():
  sources = json.loads(PIN_FILE.read_bytes())
  assert ANCHOR == "9727870f79db9c6a6e9d6437668e5ac13229522f"
  assert len(sources) == len({s["file"] for s in sources}) == 1280
  rows = rows_v196()
  protected = set(
    "1_-7 2_-7 2_-6 3_-7 1_-8 2_-8 3_-8 7_-2 8_-3 8_-2 9_-3 9_-2 10_-3 10_-2 11_-3 11_-2 0_-5 7_-5 8_-5 8_-4 north190-3_-8 ring182-11_-2 district188-10_-2 north190-11_-2 danzigerfront244-10_-2 outer187--8_16 outer187--7_16".split()
  )
  post_preparation_scope = set()
  for path in (ROOT / "src/app/src/data").glob("*.json"):
    if any(v in path.name for v in ["V303", "V304", "V305", "V306", "V307", "V308"]):
      data = json.loads(path.read_bytes())
      keys = (
        data.get("keys", list(data.get("packets", {})))
        if isinstance(data, dict)
        else []
      )
      if path.name == "railBridgeApproachV307Packets.json":
        # This exact later additive recipe postdates the immutable1280-source
        # preparation. Its registered wire alternatives retain every JSON byte.
        assert (
          sha(path.read_bytes())
          == "479295622f0939b01c86bbe02e7c2f4554f2f0c2abd080995f7c7f20202aefa6"
        )
        expected = {
          f"{mode}:{tile}"
          for mode in ["drawn", "minecraft"]
          for tile in ["2_-6", "3_-6", "2_-7", "3_-7"]
        }
        assert data["schemaVersion"] == 1
        assert len(keys) == len(set(keys)) == 8
        assert set(keys) == expected == set(data["packets"])
        post_preparation_scope.update(k.split(":", 1)[1] for k in keys)
        continue
      protected.update(k.split(":", 1)[1] for k in keys if ":" in k)
  far = 0
  previous = set()
  for version in [193, 194, 195]:
    previous.update(
      r["file"]
      for r in json.loads(
        (
          ROOT / f"geo_data/regierungsviertel/lossless-packets-v{version}.json"
        ).read_bytes()
      )["rows"]
    )
  for s in sources:
    assert s["file"] not in previous
    assert s["chunkId"] not in protected
    assert s["file"] == f"{s['chunkId']}.{s['mode']}.json.gz"
    match = re.fullmatch(
      r"outer187-(-?\d+)_(-?\d+)\.(drawn|minecraft)\.json\.gz", s["file"]
    )
    if match:
      far += 1
      x, z = map(int, match.groups()[:2])
      assert x >= 12 or x <= -14
      assert not (-12 <= x <= -7 and 10 <= z <= 16)
    else:
      assert re.fullmatch(
        r"(?:ring182-|district188-(?:ring182-)?)?-?\d+_-?\d+", s["chunkId"]
      )
    path = PUBLIC / s["file"]
    original = git_bytes(path)
    assert len(original) == s["gzipBytes"] and sha(original) == s["gzipSha256"]
    decoded = gzip.decompress(original)
    assert len(decoded) == s["decodedBytes"] and sha(decoded) == s["decodedSha256"]
    # Current wire is the exact registered alternative; the history bridge
    # recovers the full immutable original, including original gzip headers.
    current = path.read_bytes()
    assert sha(current) == rows[s["file"]]["newGzipSha256"]
    assert gzip.decompress(current) == decoded
    assert predecessor_packet_bytes_v196(path) == original
  assert far == 768
  assert post_preparation_scope == {"2_-6", "3_-6", "2_-7", "3_-7"}
  assert {s["file"] for s in sources if s["chunkId"] in post_preparation_scope} == {
    "3_-6.drawn.json.gz",
    "3_-6.minecraft.json.gz",
  }


def test_prepare_tool_has_no_live_write_or_apply_path():
  tool = (ROOT / "src/app/scripts/recompress-surrounding-v196.ts").read_text()
  assert 'process.argv.includes("--apply")' in tool
  assert "preparation is read-only" in tool
  assert "writeFileSync(resolve(base" not in tool
  assert "gunzipSync(compressed,{maxOutputLength:raw.length}).equals(raw)" in tool
