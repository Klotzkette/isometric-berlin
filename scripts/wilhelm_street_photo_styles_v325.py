"""Finite photo-guided joinery cues; the caller owns every geometric proof.

No wall, roof or navigation geometry is replaced here. All lengths, colours and
fine subdivisions are display interpretations, not surveyed dimensions. Every
rectangle passes the supplied full source-plane/hole test, then the composer's
independent neighbour and serialized-box checks. Axes and storeys belong to the
whole run/family; this module never restarts their phase on a small LoD2 polygon.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping
from typing import Any

DISPLAY_TYPES = frozenset(
  {
    "robert-koch-brick",
    "wilhelm65-folded-glass",
    "gdv-colonnade",
    "rossi-brick-green",
    "grupo2c-block9",
    "kita-segmental-brick",
    "de-rossi-colour",
    "beulwitz-terraces",
    "fehling-curved-bands",
  }
)

Emit = Callable[..., bool]

# Photo/primary-based display modules, not a recovered dimension survey. Only
# the four explicit counts below fix a family count; tower/wing families use
# the same source datum/pitch through their full maximum and each wall clips.
STYLE_PARAMETERS = {
  "robert-koch-brick": {
    "bayModuleM": 2.8,
    "groundFloorHeightM": 4.0,
    "targetPitchM": 3.7,
    "floorCount": 4,
  },
  "wilhelm65-folded-glass": {
    "bayModuleM": 1.55,
    "groundFloorHeightM": 3.7,
    "targetPitchM": 3.35,
    "floorCount": 6,
  },
  "gdv-colonnade": {
    "bayModuleM": 1.4,
    "groundFloorHeightM": 4.4,
    "targetPitchM": 3.1,
    "floorCount": 9,
  },
  "rossi-brick-green": {
    "bayModuleM": 3.1,
    "groundFloorHeightM": 3.3,
    "targetPitchM": 2.9,
  },
  "grupo2c-block9": {"bayModuleM": 2.8, "groundFloorHeightM": 3.5, "targetPitchM": 2.9},
  "kita-segmental-brick": {
    "bayModuleM": 3.0,
    "groundFloorHeightM": 3.6,
    "targetPitchM": 3.5,
    "floorCount": 4,
  },
  "de-rossi-colour": {
    "bayModuleM": 2.9,
    "groundFloorHeightM": 3.4,
    "targetPitchM": 2.85,
  },
  "beulwitz-terraces": {
    "bayModuleM": 3.1,
    "groundFloorHeightM": 3.1,
    "targetPitchM": 2.85,
  },
  "fehling-curved-bands": {
    "bayModuleM": 3.2,
    "groundFloorHeightM": 3.2,
    "targetPitchM": 2.85,
  },
}


def emit_photo_style(display_type: str, ctx: Mapping[str, Any], emit: Emit) -> int:
  """Emit only complete proven rectangles, returning accepted cue count.

  ``emit(u,y,w,h,depth,offset,rgb,role,label,floor=None)`` is the final authority.
  Portal locations require explicit whole-run evidence in ``ctx``; neither the
  centre of a patch nor the first surviving window is treated as an entrance.
  Native receives independently derived cardinal source contexts from caller.
  """
  if display_type not in DISPLAY_TYPES:
    raise ValueError(f"Unknown finite Wilhelm display type: {display_type}")
  low, high, bottom, top = (float(ctx[k]) for k in ("uMin", "uMax", "yMin", "yMax"))
  if not all(math.isfinite(v) for v in (low, high, bottom, top)):
    raise ValueError("Non-finite source wall bounds")
  if high <= low or top <= bottom:
    return 0
  fits = ctx["fits"]
  axes = ctx["globalAxes"]
  floors = [float(y) for y in ctx["sharedFamilyFloors"]]
  if not floors or not all(math.isfinite(y) for y in floors):
    return 0
  if floors != sorted(set(floors)):
    raise ValueError("Storeys must retain the unique whole-family order")
  # A narrow surviving patch must not change its window width merely because
  # its neighbours are no longer in the filtered axis list.
  bay = float(ctx.get("bayModuleM", STYLE_PARAMETERS[display_type]["bayModuleM"]))
  if not math.isfinite(bay) or bay <= 0:
    raise ValueError("Missing whole-run bay module")
  pitch = float(ctx["residentialPitchM"])
  if not math.isfinite(pitch) or pitch <= 0:
    raise ValueError("Missing whole-family storey pitch")
  ground_low, ground_high = map(float, ctx["groundFloorRange"])
  accepted = 0

  def cue(
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    offset: float,
    rgb: int,
    role: str,
    label: str,
    floor: int | None = None,
  ) -> bool:
    nonlocal accepted
    if not all(math.isfinite(v) for v in (u, y, w, h, depth, offset)):
      raise ValueError("Non-finite architectural cue")
    if w <= 0 or h <= 0 or depth <= 0 or offset < 0:
      return False
    if u - w / 2 < low or u + w / 2 > high or y - h / 2 < bottom or y + h / 2 > top:
      return False
    if not fits(u, y, w, h):
      return False
    yes = bool(emit(u, y, w, h, depth, offset, rgb, role, label, floor))
    accepted += int(yes)
    return yes

  def band(y: float, height: float, rgb: int, label: str, floor: int) -> None:
    # Whole-run horizontal phase, clipped only to the current proven plane.
    cue(
      (low + high) / 2, y, high - low, height, 0.035, 0.035, rgb, "band", label, floor
    )

  def window(
    u: float, y: float, w: float, h: float, rgb: int, frame: int, floor: int
  ) -> None:
    cue(u, y, w, h, 0.025, 0.045, rgb, "glazing", "recessed glazing", floor)
    for sign in (-1, 1):
      cue(
        u + sign * (w / 2 + 0.035),
        y,
        0.07,
        h + 0.12,
        0.065,
        0.075,
        frame,
        "frame",
        "window jamb",
        floor,
      )
      cue(
        u,
        y + sign * (h / 2 + 0.035),
        w + 0.14,
        0.07,
        0.065,
        0.075,
        frame,
        "frame",
        "window head/sill",
        floor,
      )
    cue(u, y, 0.045, h, 0.07, 0.085, frame, "frame", "paired sash mullion", floor)

  def arch(
    u: float, spring: float, width: float, rise: float, rgb: int, floor: int, label: str
  ) -> None:
    # A bounded thin stepped surround, not a new structural arch/body cut.
    segments = max(5, min(11, math.ceil(width / 0.2)))
    for i in range(segments):
      t = (i + 0.5) / segments
      x = u - width / 2 + width * t
      yy = spring + rise * math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2))
      cue(x, yy, width / segments + 0.025, 0.10, 0.055, 0.10, rgb, "arch", label, floor)

  # Shared horizontal architecture is emitted once per actual storey, never
  # from an independently rescaled local patch-height grid.
  for floor, y in enumerate(floors):
    below = y - pitch * 0.47
    if display_type == "robert-koch-brick":
      band(below, 0.13, 0x8C4D3A, "red brick string course", floor)
      band(below + 0.18, 0.065, 0x493F35, "dark terracotta/frieze edge", floor)
    elif display_type == "rossi-brick-green":
      band(below, 0.12, 0xD6C695, "pale course in red brick", floor)
    elif display_type == "fehling-curved-bands":
      band(below + 0.12, 0.45, 0xDDD1C7, "existing balcony parapet ribbon", floor)
      band(below + 0.37, 0.06, 0xF2E9DF, "balcony cap follows measured facet", floor)
    elif display_type == "de-rossi-colour" and floor == 6:
      band(below - 0.06, 0.16, 0xC9B99E, "brick/upper-storey cornice boundary", floor)
    elif display_type == "kita-segmental-brick":
      band(below, 0.12, 0x944B33, "school brick frieze", floor)

  for axis in axes:
    u, column = float(axis["u"]), int(axis["column"])
    if not math.isfinite(u):
      raise ValueError("Non-finite whole-run axis")
    for floor, y in enumerate(floors):
      if y < bottom or y > top:
        continue
      in_ground = ground_low <= y <= ground_high
      w, h = bay * 0.50, pitch * 0.57
      if display_type == "robert-koch-brick":
        # Do not paint a repeated window across the evidenced doorway.
        portal = ctx.get("portalCenter")
        if ctx.get("hasEntrance") and portal is not None and in_ground:
          if abs(u - float(portal)) < float(ctx.get("portalWidth", bay)) * 0.72:
            continue
        window(u, y, w, h, 0x59615D, 0xC4B296, floor)
        cue(
          u,
          y + h * 0.19,
          w,
          0.045,
          0.055,
          0.085,
          0xAFA895,
          "frame",
          "upper-light transom",
          floor,
        )
        # Three shallow diminishing sections suggest the photographed
        # triangular stone hood; no new roof volume is introduced.
        for step in range(3):
          cue(
            u,
            y + h / 2 + 0.16 + step * 0.07,
            (w + 0.28) * (1 - step * 0.25),
            0.07,
            0.10,
            0.13,
            0xC5AD88,
            "hood",
            "triangular window hood estimate",
            floor,
          )
      elif display_type == "wilhelm65-folded-glass":
        w, h = bay * 0.91, pitch * 0.88
        if ctx["wallRole"] == "court":
          window(u, y, w, h, 0x839EA7, 0x6F7E80, floor)
          cue(
            u,
            y + h * 0.43,
            w,
            0.08,
            0.18,
            0.16,
            0xA4B1AF,
            "shade",
            "smooth court glass external shade",
            floor,
          )
          continue
        # The rectangle-only emitter represents the folded panel by
        # three close stepped leaves. This is an explicit display
        # approximation, not a claim of surveyed glass-plane angles.
        for leaf in range(3):
          uu = u + (leaf - 1) * w / 3
          cue(
            uu,
            y,
            w / 3 - 0.025,
            h,
            0.025,
            0.035 + leaf * 0.038,
            0x839EA7,
            "glazing",
            "folded glass leaf approximation",
            floor,
          )
        for sign in (-1, 1):
          cue(
            u,
            y + sign * (h / 2 + 0.04),
            w + 0.06,
            0.08,
            0.15,
            0.14,
            0x394449,
            "cap",
            "projecting folded-glass cap",
            floor,
          )
        cue(u + w / 2, y, 0.05, h, 0.12, 0.14, 0x4F5A5C, "frame", "fold edge", floor)
      elif display_type == "gdv-colonnade":
        if in_ground:
          window(u, y, bay * 0.74, pitch * 0.80, 0x879999, 0xC8CBC7, floor)
          cue(
            u + bay * 0.43,
            y,
            0.22,
            pitch * 0.93,
            0.20,
            0.13,
            0xDFDDD2,
            "column",
            "retained ground-floor colonnade axis",
            floor,
          )
        else:
          panel = 0xB4B7B3 if column % 4 == 1 else 0x7D9196
          window(u, y, bay * 0.89, pitch * 0.87, panel, 0xD0D1C7, floor)
          if column % 4 == 1:
            for slat in (-1, 0, 1):
              cue(
                u,
                y + slat * h / 4,
                bay * 0.84,
                0.04,
                0.035,
                0.13,
                0x9BA3A1,
                "shade",
                "silver blind subdivision estimate",
                floor,
              )
      elif display_type == "rossi-brick-green":
        if ctx["wallRole"] == "court":
          window(u, y, bay * 0.53, pitch * 0.64, 0x82938D, 0xDDD8C7, floor)
          cue(
            u,
            y - pitch * 0.29,
            bay * 0.62,
            0.07,
            0.06,
            0.12,
            0xE1DCCD,
            "rail",
            "source-supported deep court loggia edge",
            floor,
          )
          continue
        window(u, y, bay * 0.77, pitch * 0.80, 0x82938D, 0x38685C, floor)
        for sign in (-1, 1):
          cue(
            u + sign * bay * 0.44,
            y,
            0.10,
            pitch * 0.94,
            0.06,
            0.10,
            0xA16E5B,
            "pier",
            "red-brick bay margin",
            floor,
          )
        cue(
          u,
          y + 0.22,
          bay * 0.75,
          0.055,
          0.075,
          0.10,
          0x38685C,
          "frame",
          "green full-height segment transom",
          floor,
        )
      elif display_type == "grupo2c-block9":
        # Keep the photographed existing high corner loggia empty.
        # A repeated modulo is not evidence of a particular opening. With
        # no explicit cue, the caller's complete hole proof stays authoritative.
        is_loggia = axis.get("kind") == "loggia" or column in ctx.get(
          "openLoggiaColumns", ()
        )
        if floor == len(floors) - 1 and is_loggia:
          cue(
            u,
            y - h * 0.36,
            w + 0.10,
            0.065,
            0.06,
            0.10,
            0xD7D6CD,
            "rail",
            "open upper corner loggia rail",
            floor,
          )
          continue
        window(u, y, bay * 0.43, pitch * 0.69, 0x707E7C, 0xD5D5CB, floor)
        cue(
          u,
          y,
          0.04,
          pitch * 0.66,
          0.075,
          0.11,
          0xEEE9DE,
          "frame",
          "narrow stacked white slit sash",
          floor,
        )
      elif display_type == "kita-segmental-brick":
        window(u, y, bay * 0.57, pitch * 0.61, 0x72847F, 0x8F5A3C, floor)
        rise = bay * (0.28 if floor == len(floors) - 1 else 0.13)
        arch(
          u,
          y + h / 2 + 0.07,
          bay * 0.66,
          rise,
          0xA95D3B,
          floor,
          "upper round/lower segmental brick surround",
        )
        cue(
          u,
          y + pitch * 0.10,
          w,
          0.04,
          0.06,
          0.10,
          0xA9B5AB,
          "frame",
          "tall classroom window transom",
          floor,
        )
      elif display_type == "de-rossi-colour":
        upper = floor >= 6
        window(
          u,
          y,
          bay * (0.64 if upper else 0.45),
          pitch * 0.64,
          0x8FABB0 if upper else 0x657573,
          0xD6D5C8,
          floor,
        )
        if upper:
          # Photo colours form contiguous planes, not a bay checkerboard.
          tint = int(
            ctx.get(
              "upperWallRgb",
              0x78A7A1 if ctx["wallRole"] == "return" else 0x8F7CA7,
            )
          )
          cue(
            u + bay * 0.41,
            y,
            bay * 0.15,
            pitch * 0.90,
            0.025,
            0.035,
            tint,
            "upper-pier",
            "photo-estimated coloured upper-storey panel",
            floor,
          )
      elif display_type == "beulwitz-terraces":
        window(u, y, bay * 0.73, pitch * 0.60, 0xA2B0AB, 0xE0E0D5, floor)
        for sign in (-1, 1):
          cue(
            u + sign * bay * 0.12,
            y,
            0.04,
            pitch * 0.57,
            0.06,
            0.10,
            0xD3D8D4,
            "frame",
            "three-part terrace-house sash",
            floor,
          )
        # Only identified terrace/return source facets receive the
        # rail and pergola cue; do not fence every ordinary window.
        if axis.get("kind") == "terrace" or ctx["wallRole"] == "return":
          cue(
            u,
            y - h * 0.40,
            bay * 0.78,
            0.045,
            0.045,
            0.15,
            0x737B76,
            "rail",
            "existing open terrace wire rail",
            floor,
          )
          cue(
            u + bay * 0.43,
            y,
            0.10,
            pitch * 0.92,
            0.10,
            0.14,
            0xE3E1D7,
            "pergola",
            "white source-supported terrace upright",
            floor,
          )
      elif display_type == "fehling-curved-bands":
        window(u, y, bay * 0.69, pitch * 0.58, 0x778A86, 0xE1DDD1, floor)
        for sign in (-1, 1):
          cue(
            u + sign * bay * 0.12,
            y,
            0.045,
            pitch * 0.55,
            0.065,
            0.10,
            0xE1DDD1,
            "frame",
            "two/three-part recessed sash",
            floor,
          )

  if (
    display_type == "robert-koch-brick"
    and ctx.get("hasEntrance")
    and ctx.get("portalCenter") is not None
  ):
    u = float(ctx["portalCenter"])
    width = float(ctx.get("portalWidth", bay * 0.9))
    crown = float(ctx.get("portalTopY", ground_high))
    spring, sill = crown - width / 2, max(bottom, ground_low) + 0.05
    if spring > sill:
      for sign in (-1, 1):
        cue(
          u + sign * (width / 2 + 0.11),
          (spring + sill) / 2,
          0.20,
          spring - sill,
          0.10,
          0.14,
          0xB9956D,
          "portal",
          "evidenced portal jamb",
        )
      arch(
        u,
        spring,
        width + 0.25,
        width / 2,
        0xB9956D,
        0,
        "evidenced portal arch surround",
      )
  return accepted
