precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D paletteLut;
uniform vec2 resolution;
uniform float pixelScale;
// 0.0 = hard palette snap (default); raised to 1.0 only at the deepest
// zoom, where ordered dithering avoids banding on large flat faces.
uniform float ditherStrength;
// Outline mix from the shared crispness profile (minecraft entry).
uniform float edgeMix;
// World/scene anchor for the voxel grid, in device pixels wrapped into a
// single block cell. The camera feeds the on-screen displacement of a fixed
// world point here so the block lattice stays glued to the geometry while
// the camera pans/zooms/rotates, instead of crawling across a fixed screen
// grid (the "zerfällt beim Bewegen" shimmer). Defaults to (0, 0), which
// reproduces the old screen-anchored behaviour.
uniform vec2 gridOffset;
varying vec2 vUv;

/*__SHIMMER__*/

float ibLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float bayer4(vec2 pixel) {
  vec2 cell = mod(floor(pixel), 4.0);
  float index = cell.x + cell.y * 4.0;
  if (index < 0.5) return 0.0 / 16.0;
  if (index < 1.5) return 8.0 / 16.0;
  if (index < 2.5) return 2.0 / 16.0;
  if (index < 3.5) return 10.0 / 16.0;
  if (index < 4.5) return 12.0 / 16.0;
  if (index < 5.5) return 4.0 / 16.0;
  if (index < 6.5) return 14.0 / 16.0;
  if (index < 7.5) return 6.0 / 16.0;
  if (index < 8.5) return 3.0 / 16.0;
  if (index < 9.5) return 11.0 / 16.0;
  if (index < 10.5) return 1.0 / 16.0;
  if (index < 11.5) return 9.0 / 16.0;
  if (index < 12.5) return 15.0 / 16.0;
  if (index < 13.5) return 7.0 / 16.0;
  if (index < 14.5) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

vec3 paletteLookup(vec3 color) {
  vec3 cell = floor(clamp(color, 0.0, 1.0) * 15.0 + 0.5);
  vec2 uv = vec2((cell.r + cell.b * 16.0 + 0.5) / 256.0,
    (cell.g + 0.5) / 16.0);
  return texture2D(paletteLut, uv).rgb;
}

void main() {
  vec2 block = max(vec2(1.0), vec2(pixelScale));
  // World-anchored snap: shift the lattice by the camera-supplied gridOffset
  // so a block stays locked to the same piece of geometry as the view moves.
  vec2 pixel = vUv * resolution;
  vec2 snappedPixel = (floor((pixel - gridOffset) / block) + 0.5) * block + gridOffset;
  vec2 snappedUv = snappedPixel / resolution;
  vec2 sampleStep = block / resolution;
  vec3 source = texture2D(tDiffuse, snappedUv).rgb;
  // Hard quantise: snap straight to the nearest palette colour. Ordered
  // dithering only fades in via ditherStrength at the deepest zoom. The
  // dither cell rides the same world anchor so it does not crawl either.
  float dither = bayer4((gl_FragCoord.xy - gridOffset) / block) - 0.5;
  vec3 colour = paletteLookup(source + dither * ditherStrength / 26.0);

  float here = ibLuminance(source);
  float east = ibLuminance(texture2D(tDiffuse, snappedUv + vec2(sampleStep.x, 0.0)).rgb);
  float north = ibLuminance(texture2D(tDiffuse, snappedUv + vec2(0.0, sampleStep.y)).rgb);
  float diagonal = ibLuminance(texture2D(tDiffuse, snappedUv + sampleStep).rgb);
  float edge = smoothstep(0.075, 0.24,
    abs(here - diagonal) + abs(east - north));
  // Foliage guard: dense tree canopy is all high-frequency luminance
  // noise; full-strength outlines there turn the Tiergarten into mud.
  float canopy = smoothstep(0.02, 0.12, source.g - max(source.r, source.b));
  edge *= 1.0 - 0.55 * canopy;
  // Busyness guard: at overview zoom nearly every block boundary is a
  // strong gradient; near-black outlines everywhere read as mud, not
  // blocks. When BOTH distant taps also contrast with this block, we
  // are in high-frequency texture rather than on a silhouette, so the
  // outline backs off. True object silhouettes keep one quiet side and
  // stay at full strength.
  float farEast = ibLuminance(texture2D(tDiffuse, snappedUv + sampleStep * 3.0).rgb);
  float farWest = ibLuminance(texture2D(tDiffuse, snappedUv - sampleStep * 3.0).rgb);
  float busyness = smoothstep(0.09, 0.28, abs(farEast - here)) *
    smoothstep(0.09, 0.28, abs(farWest - here));
  edge *= 1.0 - 0.68 * busyness;
  float northEastLight = clamp((east + north - here * 2.0) * 0.22 + 0.04, -0.05, 0.11);
  colour *= 1.0 + northEastLight;
  // Near-black block outline, tinted slightly warm on glass and cool on
  // stone so the look reads modded rather than vanilla.
  float glassish = smoothstep(0.02, 0.14, source.b - source.r);
  vec3 outlineTint = mix(
    vec3(0.030, 0.040, 0.058),
    vec3(0.062, 0.046, 0.028),
    glassish
  );
  colour = mix(colour, outlineTint, edge * edgeMix);

  float bright = smoothstep(0.85, 0.99, here);
  vec3 bloom = texture2D(tDiffuse, snappedUv + sampleStep * 1.7).rgb +
    texture2D(tDiffuse, snappedUv - sampleStep * 1.7).rgb;
  colour += bloom * bright * 0.010;
  colour = premiumShimmer(colour, snappedUv);
  colour *= vec3(1.045, 1.02, 0.93);
  gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
}
