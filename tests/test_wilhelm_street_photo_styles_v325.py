"""Bounded compositor contract; no city generation or source mutations."""

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts/wilhelm_street_photo_styles_v325.py"
SPEC = importlib.util.spec_from_file_location("wilhelm_photo_styles_v325", SCRIPT)
assert SPEC and SPEC.loader
STYLES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STYLES)


def context(**changes):
  ctx = dict(
    family="actual-family",
    run=1,
    sourcePolygonId="actual-sheet",
    uMin=0.0,
    uMax=30.0,
    yMin=3.0,
    yMax=39.0,
    datumY=3.0,
    groundFloorRange=[3.0, 6.0],
    sharedFamilyFloors=[4.5 + 3 * i for i in range(11)],
    residentialPitchM=3.0,
    roofZoneRange=[36.0, 39.0],
    globalAxes=[dict(u=2.5 + 3 * i, s=2.5 + 3 * i, column=i) for i in range(9)],
    wallNormal=[1.0, 0.0],
    wallRole="street",
    hasEntrance=False,
    fits=lambda *_: True,
  )
  return ctx | changes


def emitted(style, ctx=None, final=lambda *_: True):
  rows = []

  def emit(*row):
    if final(*row):
      rows.append(row)
      return True
    return False

  count = STYLES.emit_photo_style(style, context() if ctx is None else ctx, emit)
  assert count == len(rows)
  return rows


def test_nine_finite_styles_have_distinct_architectural_cues_and_no_input_mutation():
  signatures = {}
  ctx = context()
  before = repr(ctx)
  for style in sorted(STYLES.DISPLAY_TYPES):
    rows = emitted(style, ctx)
    assert rows
    signatures[style] = {(r[7], r[8]) for r in rows}
    assert all(0 < r[2] and 0 < r[3] and 0 < r[4] and r[5] >= 0 for r in rows)
    assert all(
      ctx["uMin"] <= r[0] - r[2] / 2 <= r[0] + r[2] / 2 <= ctx["uMax"] for r in rows
    )
    assert all(
      ctx["yMin"] <= r[1] - r[3] / 2 <= r[1] + r[3] / 2 <= ctx["yMax"] for r in rows
    )
  assert len({frozenset(v) for v in signatures.values()}) == 9
  assert repr(ctx) == before
  with pytest.raises(ValueError, match="Unknown finite"):
    emitted("unknown-generic-grid")


def test_source_holes_and_final_neighbour_gate_reject_every_unproved_rectangle():
  for style in STYLES.DISPLAY_TYPES:
    assert emitted(style, context(fits=lambda *_: False)) == []
    assert emitted(style, final=lambda *_: False) == []
    rows = emitted(
      style,
      context(
        fits=lambda u, y, w, h: (
          not (u - w / 2 < 13 < u + w / 2 and y - h / 2 < 16 < y + h / 2)
        )
      ),
    )
    assert all(
      not (
        r[0] - r[2] / 2 < 13 < r[0] + r[2] / 2
        and r[1] - r[3] / 2 < 16 < r[1] + r[3] / 2
      )
      for r in rows
    )


def test_global_floor_column_phase_survives_small_sheet_bounds_and_portal_is_explicit():
  for style in STYLES.DISPLAY_TYPES:
    full = emitted(style)
    partial = emitted(style, context(uMin=8.0, uMax=20.0, yMin=12.0, yMax=27.0))
    ordinary = [r for r in partial if r[7] != "band"]
    assert all(r in full for r in ordinary)
    assert all(r[9] is None or r[9] >= 3 for r in partial)
  assert not any(r[7] == "portal" for r in emitted("robert-koch-brick"))
  rows = emitted(
    "robert-koch-brick",
    context(hasEntrance=True, portalCenter=14.5, portalWidth=2.2, portalTopY=8.0),
  )
  assert any(r[7] == "portal" for r in rows)
  assert not any(
    r[7] == "glazing" and r[9] == 0 and abs(r[0] - 14.5) < 1.58 for r in rows
  )


def test_existing_upper_open_loggias_and_terraces_do_not_receive_generic_glass_fill():
  rows = emitted("grupo2c-block9", context(openLoggiaColumns=[0, 8]))
  assert not any(
    r[7] == "glazing" and r[9] == 10 and round((r[0] - 2.5) / 3) in (0, 8) for r in rows
  )
  assert not any(r[7] == "pergola" for r in emitted("beulwitz-terraces"))
  assert any(
    r[7] == "pergola" for r in emitted("beulwitz-terraces", context(wallRole="return"))
  )
