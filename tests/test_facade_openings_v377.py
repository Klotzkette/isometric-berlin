from PIL import Image, ImageDraw

from scripts.read_facade_openings_v377 import photo_bands


def test_recognizes_repeated_openings_and_keeps_the_missing_storey() -> None:
  image = Image.new("RGBA", (320, 160), (189, 176, 158, 255))
  draw = ImageDraw.Draw(image)
  for y in [30, 60, 120]:
    for x in range(22, 285, 40):
      draw.rectangle((x, y, x + 15, y + 13), fill=(40, 56, 68, 255))
  bands = photo_bands(image, 32, 16)
  assert len(bands) == 3
  assert all(b["columns"] == 7 and b["rows"] == 1 for b in bands)
  assert all(b["color"] == 0x283844 for b in bands)
  assert not any(b["y"][0] < 0.44 < b["y"][1] for b in bands)


def test_blank_obscured_and_single_dark_apertures_do_not_invent_a_grid() -> None:
  image = Image.new("RGBA", (200, 100), (189, 176, 158, 255))
  draw = ImageDraw.Draw(image)
  draw.rectangle((22, 34, 45, 60), fill=(55, 61, 70, 255))
  for x in range(12, 175, 24):
    draw.rectangle((x, 10, x + 10, 18), fill=(30, 30, 30, 0))
  assert photo_bands(image, 20, 10) == []


def test_continuous_solid_band_does_not_imply_windows_or_fill_unknown_pixels():
  from scripts.read_facade_openings_v377 import structural_bands

  image = Image.new("RGBA", (160, 100), (189, 176, 158, 255))
  draw = ImageDraw.Draw(image)
  draw.rectangle((0, 38, 159, 48), fill=(45, 48, 52, 255))
  solid = structural_bands(image, 16, 10)
  assert [(r["kind"], r["columns"]) for r in solid] == [("spandrel", 1)]
  draw.rectangle((0, 38, 159, 48), fill=(45, 48, 52, 0))
  assert not structural_bands(image, 16, 10)


def test_two_visible_horizontal_opening_rows_never_spill_up_to_the_parent_roof():
  from scripts.build_building_facade_profiles_v377 import build

  wall = dict(a=[0, 0], b=[20, 0], normal=[0, -1], low=1, high=9)
  band = dict(kind="glazing", x=[0.05, 0.95], y=[0.08, 0.92], rows=2, columns=6)
  old = {**wall, "high": 60, "bands": [{**band, "y": [0.03, 0.08]}]}
  new = {**wall, "wallId": "wall-329", "bands": [band]}
  rank = {
    "targets": [dict(id="clinic", segments=[{**wall, "high": 60, "family": "drawn"}])]
  }
  profiles, stats = build(
    rank,
    {"targets": {"clinic": {"entrances": []}}},
    {"targets": {"clinic": [old]}},
    {"clinic": [new]},
  )
  assert stats["clinic"]["fronts"] == 1
  (front,) = profiles["targets"]["clinic"]["fronts"]
  assert front["wallId"] == "wall-329"
  assert [front["low"], front["high"]] == [1, 9]
  assert profiles["profiles"][front["profile"]] == [band]
