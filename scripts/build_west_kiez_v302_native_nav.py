"""Navigation-only union of actual v302 native box caps; no model regeneration."""

from __future__ import annotations

from collections import defaultdict

from scripts.build_west_kiez_v302 import DATA, GEO, native_sheets, read, write


def merge(caps):
  """Union only identical-height rectangles with one identical axis interval."""
  current = sorted(set(caps))
  for axis in [0, 1, 0, 1]:
    grouped = defaultdict(list)
    for x0, z0, x1, z1, top in current:
      grouped[(z0, z1, top) if axis == 0 else (x0, x1, top)].append(
        (x0, x1) if axis == 0 else (z0, z1)
      )
    result = []
    for (a, b, top), intervals in sorted(grouped.items()):
      intervals.sort()
      lo, hi = intervals[0]
      for begin, end in intervals[1:]:
        if begin <= hi:
          hi = max(hi, end)
        else:
          result.append((lo, a, hi, b, top) if axis == 0 else (a, lo, b, hi, top))
          lo, hi = begin, end
      result.append((lo, a, hi, b, top) if axis == 0 else (a, lo, b, hi, top))
    current = sorted(result)
  return current


def build():
  source = read(GEO / "west-kiez-v302-core-source.json.gz")
  model = read(DATA / "westKiezV302Core.json")
  models = {s["parent"]: s for s in model["sites"]}
  parts = []
  for site in source["sites"]:
    actual = models[site["parent"]]["nativeRows"]
    offset = 0
    for part in site["parts"]:
      replay = native_sheets([part], 0xD0C7B2, 0x747A76)
      rows = actual[offset : offset + len(replay)]
      offset += len(rows)
      assert rows == replay, (
        "Actual complete native rows no longer match source leaf attribution"
      )
      low = min(q[1] - q[4] / 2 for q in rows)
      high = max(q[1] + q[4] / 2 for q in rows)
      origin = [
        int(min(q[0] - q[3] / 2 for q in rows)) - 1,
        int(min(q[2] - q[5] / 2 for q in rows)) - 1,
      ]
      caps = []
      for x, y, z, w, h, d, _ in rows:
        # Four-decimal centres and dimensions have exact half-dimension bounds at
        # 1/20000m. Keep that whole decimal precision, rather than quantising again.
        caps.append(
          tuple(
            round(v * 20000)
            for v in (
              x - w / 2 - origin[0],
              z - d / 2 - origin[1],
              x + w / 2 - origin[0],
              z + d / 2 - origin[1],
              y + h / 2,
            )
          )
        )
      compact = merge(caps)
      parts.append(
        dict(
          id=part["id"],
          origin=origin,
          low=round(low, 5),
          high=round(high, 5),
          caps=compact,
        )
      )
    assert offset == len(actual)
  write(
    DATA / "westKiezV302NativeNavigation.json",
    dict(schemaVersion=1, scale=20000, parts=parts),
  )
  print(
    dict(
      parts=len(parts),
      caps=sum(len(p["caps"]) for p in parts),
      bytes=(DATA / "westKiezV302NativeNavigation.json").stat().st_size,
    )
  )


if __name__ == "__main__":
  build()
