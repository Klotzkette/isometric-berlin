"""Shorten integral JSON number spellings without changing any JavaScript number."""

import math
from typing import Any


def compact_numbers(value: Any) -> Any:
  # Both spellings decode to the same IEEE-754 double. Preserve negative zero,
  # nonintegral values, large numbers, strings, order and every container member.
  if (
    isinstance(value, float)
    and math.isfinite(value)
    and value.is_integer()
    and abs(value) < 2**53
    and (value != 0 or math.copysign(1, value) > 0)
  ):
    return int(value)
  if isinstance(value, list):
    return [compact_numbers(item) for item in value]
  if isinstance(value, dict):
    return {key: compact_numbers(item) for key, item in value.items()}
  return value
