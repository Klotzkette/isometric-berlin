"""Shared metric width policy for OSM streets, paths and bridge decks."""

from __future__ import annotations

import math
import re
from typing import Any

# Fallback full widths in metres. Explicit OSM ``width``/``est_width`` values
# and mapped lane counts take precedence; these values are only the final
# fallback for otherwise unmeasured centrelines.
ROAD_WIDTHS_M: dict[str, float] = {
  "motorway": 22.0,
  "motorway_link": 8.0,
  "trunk": 20.0,
  "trunk_link": 8.0,
  "primary": 17.0,
  "primary_link": 7.5,
  "secondary": 12.0,
  "secondary_link": 7.0,
  "tertiary": 9.5,
  "tertiary_link": 6.5,
  "residential": 8.0,
  "unclassified": 7.5,
  "living_street": 7.0,
  "service": 5.0,
  "pedestrian": 9.0,
  "cycleway": 2.6,
  "footway": 2.4,
  "path": 2.2,
  "track": 3.0,
  "steps": 2.0,
}

VEHICULAR_HIGHWAYS = frozenset(
  {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
    "unclassified",
    "living_street",
    "service",
  }
)

_METRIC_MEASURE = re.compile(
  r"^\s*(?P<value>(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(?P<unit>m|metres?|meters?)?\s*$",
  re.IGNORECASE,
)
_IMPERIAL_MEASURE = re.compile(
  r"^\s*(?P<feet>\d+(?:[.,]\d+)?)\s*(?:ft|feet|')"
  r"(?:\s*(?P<inches>\d+(?:[.,]\d+)?)\s*(?:in|\"))?\s*$",
  re.IGNORECASE,
)


def parse_osm_measure_m(value: object) -> float | None:
  """Parse one OSM distance value into metres, rejecting ranges and notes."""
  if value is None:
    return None
  if isinstance(value, int | float):
    number = float(value)
    return number if math.isfinite(number) and number > 0 else None
  if not isinstance(value, str):
    return None
  text = value.strip()
  if not text:
    return None
  metric = _METRIC_MEASURE.fullmatch(text)
  if metric:
    number = float(metric.group("value").replace(",", "."))
    return number if math.isfinite(number) and number > 0 else None
  imperial = _IMPERIAL_MEASURE.fullmatch(text)
  if imperial:
    feet = float(imperial.group("feet").replace(",", "."))
    inches = float((imperial.group("inches") or "0").replace(",", "."))
    number = feet * 0.3048 + inches * 0.0254
    return number if number > 0 else None
  return None


def parse_lane_count(value: object) -> float | None:
  """Return a plausible OSM lane count without interpreting lane lists."""
  if value is None:
    return None
  try:
    count = float(str(value).strip().replace(",", "."))
  except ValueError:
    return None
  if not math.isfinite(count) or count <= 0 or count > 12:
    return None
  return count


def _row_value(row: Any, key: str) -> object:
  try:
    return row.get(key)
  except AttributeError:
    return getattr(row, key.replace(":", "_"), None)


def mapped_lane_count(row: Any) -> float | None:
  """Read total lanes, falling back to the directional sum."""
  total = parse_lane_count(_row_value(row, "lanes"))
  if total is not None:
    return total
  forward = parse_lane_count(_row_value(row, "lanes:forward"))
  backward = parse_lane_count(_row_value(row, "lanes:backward"))
  if forward is None and backward is None:
    return None
  return (forward or 0) + (backward or 0)


def road_width_source(row: Any) -> str:
  """Name the evidence tier used by :func:`road_width_m`."""
  if parse_osm_measure_m(_row_value(row, "width")) is not None:
    return "width"
  if parse_osm_measure_m(_row_value(row, "est_width")) is not None:
    return "est_width"
  highway = _row_value(row, "highway")
  if isinstance(highway, str) and highway in VEHICULAR_HIGHWAYS:
    if mapped_lane_count(row) is not None:
      return "lanes"
  return "class_fallback"


def road_width_m(row: Any) -> float | None:
  """Resolve a full paved width from OSM evidence, in deterministic order.

  ``width`` and ``est_width`` are already full widths in OSM. Lane-derived
  widths are used only for motor-traffic classes; mapped foot/cycle widths
  must never be multiplied as if they were traffic lanes. Implausible values
  are ignored rather than allowed to produce city-spanning polygons.
  """
  highway = _row_value(row, "highway")
  if not isinstance(highway, str):
    return None
  fallback = ROAD_WIDTHS_M.get(highway)
  if fallback is None:
    return None
  for key in ("width", "est_width"):
    measured = parse_osm_measure_m(_row_value(row, key))
    if measured is not None and 0.4 <= measured <= 60:
      return measured
  if highway in VEHICULAR_HIGHWAYS:
    lanes = mapped_lane_count(row)
    if lanes is not None:
      if highway in {"motorway", "trunk", "primary", "secondary"}:
        lane_width = 3.25
      elif highway in {"living_street", "service"}:
        lane_width = 2.75
      else:
        lane_width = 3.0
      return min(40.0, max(2.5, lanes * lane_width))
  return fallback
