import json
import struct

from scripts.compact_manifest_numbers_v351 import compact_numbers


def test_json_number_compaction_preserves_every_double_bit_and_input():
  values = [0.0, -0.0, 1.0, -9231.0, 0.1, 2**53 * 1.0, True, None, "-0.0"]
  source = {"ring": [values], "id": "001.0", "bytes": 1024}
  before = json.dumps(source)
  compact = compact_numbers(source)
  assert json.dumps(source) == before
  assert list(compact) == list(source)
  assert compact["id"] == "001.0"
  for old, new in zip(values, json.loads(json.dumps(compact))["ring"][0], strict=True):
    if isinstance(old, float):
      assert struct.pack(">d", old) == struct.pack(">d", float(new))
    else:
      assert new == old and type(new) is type(old)
  assert len(json.dumps(compact)) < len(before)
