// v0.5.4: the Minecraft look must stay temporally stable — solid, calm
// blocks that never twinkle or crawl while the camera moves. The previous
// animated sparkle/twinkle on water and glass was the main source of the
// "viel zu sparkly" flicker, so it is gone. A tiny, purely position-based
// sheen keeps water and glass from reading as dead flat without ever
// animating: the same fragment always resolves to the same colour, so
// panning/zooming/rotating produces no shimmer.
vec3 premiumShimmer(vec3 color, vec2 uv) {
  float waterMask = smoothstep(0.04, 0.18, color.b - color.r) *
    smoothstep(0.12, 0.58, color.b);
  float glassMask = smoothstep(0.54, 0.92, max(max(color.r, color.g), color.b)) *
    (1.0 - smoothstep(0.12, 0.32, max(color.r, color.g) - min(color.r, color.g)));
  // Static block-aligned sheen: a fixed function of the (already voxel-
  // snapped) uv, with nothing animated, so it is stable frame to frame.
  float sheen = 0.5 + 0.5 * sin(uv.x * 12.0) * sin(uv.y * 12.0);
  color += vec3(0.010, 0.015, 0.017) * sheen * waterMask;
  color += vec3(0.013, 0.014, 0.012) * sheen * glassMask;
  return color;
}
