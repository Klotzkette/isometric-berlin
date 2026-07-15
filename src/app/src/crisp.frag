precision highp float;

uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float strength;
uniform float saturation;
uniform float contrast;
varying vec2 vUv;

void main() {
  vec2 stepUv = 1.0 / max(resolution, vec2(1.0));
  vec3 centre = texture2D(tDiffuse, vUv).rgb;
  vec3 neighbours =
    texture2D(tDiffuse, vUv + vec2(stepUv.x, 0.0)).rgb +
    texture2D(tDiffuse, vUv - vec2(stepUv.x, 0.0)).rgb +
    texture2D(tDiffuse, vUv + vec2(0.0, stepUv.y)).rgb +
    texture2D(tDiffuse, vUv - vec2(0.0, stepUv.y)).rgb;
  vec3 sharpened = centre + (centre - neighbours * 0.25) * strength;
  float luminance = dot(sharpened, vec3(0.2126, 0.7152, 0.0722));
  vec3 colour = mix(vec3(luminance), sharpened, saturation);
  colour = (colour - 0.5) * contrast + 0.5;
  gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
}
