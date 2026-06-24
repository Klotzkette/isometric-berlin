"""Tests for deterministic local tile generation."""

from __future__ import annotations

import io

from PIL import Image, ImageDraw

from isometric_berlin.generate_tile import pixel_art_image


def test_pixel_art_image_preserves_target_size_and_edge_contrast() -> None:
  source = Image.new("RGB", (96, 96), (236, 230, 208))
  draw = ImageDraw.Draw(source)
  draw.rectangle((24, 18, 72, 78), fill=(190, 174, 149), outline=(80, 73, 64))
  draw.line((24, 48, 72, 48), fill=(110, 100, 86), width=2)

  result = Image.open(
    io.BytesIO(pixel_art_image(source, target_size=(64, 64)))
  ).convert("RGB")

  assert result.size == (64, 64)
  assert result.getbbox() is not None
  assert result.getpixel((16, 32)) != result.getpixel((5, 5))
