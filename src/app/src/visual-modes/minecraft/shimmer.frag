vec3 premiumShimmer(vec3 color, vec2 uv, float time) {
  float waterMask = smoothstep(0.04, 0.18, color.b - color.r) *
    smoothstep(0.12, 0.58, color.b);
  float glassMask = smoothstep(0.54, 0.92, max(max(color.r, color.g), color.b)) *
    (1.0 - smoothstep(0.12, 0.32, max(color.r, color.g) - min(color.r, color.g)));
  float wave = sin(uv.x * 118.0 + uv.y * 46.0 + time * 0.48) *
    sin(uv.x * 41.0 - uv.y * 92.0 - time * 0.29);
  float sparkle = pow(max(0.0, wave), 34.0);
  float twinkle = pow(max(0.0, sin((uv.x + uv.y) * 154.0 + time * 0.19)), 48.0);
  color += vec3(0.022, 0.034, 0.038) * sparkle * waterMask;
  color += vec3(0.03, 0.032, 0.028) * twinkle * glassMask;
  return color;
}
