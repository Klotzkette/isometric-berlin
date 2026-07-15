precision highp float;

uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float strength;
uniform float saturation;
uniform float contrast;
uniform float edgeStrength;
varying vec2 vUv;

float crispLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 stepUv = 1.0 / max(resolution, vec2(1.0));
  vec3 centre = texture2D(tDiffuse, vUv).rgb;
  vec3 east = texture2D(tDiffuse, vUv + vec2(stepUv.x, 0.0)).rgb;
  vec3 west = texture2D(tDiffuse, vUv - vec2(stepUv.x, 0.0)).rgb;
  vec3 north = texture2D(tDiffuse, vUv + vec2(0.0, stepUv.y)).rgb;
  vec3 south = texture2D(tDiffuse, vUv - vec2(0.0, stepUv.y)).rgb;
  vec3 neighbours = east + west + north + south;
  vec3 sharpened = centre + (centre - neighbours * 0.25) * strength;
  float luminance = crispLuminance(sharpened);
  vec3 colour = mix(vec3(luminance), sharpened, saturation);
  colour = (colour - 0.5) * contrast + 0.5;

  // Isometric edge: 1 px darker outline where the luminance gradient is
  // strong. Vegetation (green-dominant pixels) is suppressed so facades
  // and roof lines get graphic edges while park canopy stays soft.
  float gradient = abs(crispLuminance(east) - crispLuminance(west)) +
    abs(crispLuminance(north) - crispLuminance(south));
  float edge = smoothstep(0.09, 0.3, gradient);
  float greenDominance = smoothstep(
    0.02,
    0.14,
    centre.g - max(centre.r, centre.b)
  );
  edge *= 1.0 - 0.8 * greenDominance;
  vec3 edgeColour = colour * 0.42;
  colour = mix(colour, edgeColour, edge * edgeStrength);

  gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
}
