precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D paletteLut;
uniform vec2 resolution;
uniform float time;
uniform float pixelScale;
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
  vec2 snappedUv = (floor(vUv * resolution / block) + 0.5) * block / resolution;
  vec2 sampleStep = block / resolution;
  vec3 source = texture2D(tDiffuse, snappedUv).rgb;
  float dither = bayer4(gl_FragCoord.xy / block) - 0.5;
  vec3 colour = paletteLookup(source + dither / 26.0);

  float here = ibLuminance(source);
  float east = ibLuminance(texture2D(tDiffuse, snappedUv + vec2(sampleStep.x, 0.0)).rgb);
  float north = ibLuminance(texture2D(tDiffuse, snappedUv + vec2(0.0, sampleStep.y)).rgb);
  float diagonal = ibLuminance(texture2D(tDiffuse, snappedUv + sampleStep).rgb);
  float edge = smoothstep(0.10, 0.34,
    abs(here - diagonal) + abs(east - north));
  float northEastLight = clamp((east + north - here * 2.0) * 0.22 + 0.04, -0.05, 0.11);
  colour *= 1.0 + northEastLight;
  colour = mix(colour, colour * vec3(0.30, 0.36, 0.31), edge * 0.72);

  float bright = smoothstep(0.74, 0.98, here);
  vec3 bloom = texture2D(tDiffuse, snappedUv + sampleStep * 1.7).rgb +
    texture2D(tDiffuse, snappedUv - sampleStep * 1.7).rgb;
  colour += bloom * bright * 0.022;
  colour = premiumShimmer(colour, snappedUv, time);
  colour *= vec3(1.045, 1.02, 0.93);
  gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
}
