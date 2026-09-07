import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
} from "three";

/** Authored atmosphere colours, independent of the city's source materials. */
export const SCHWELLENRAUM_SKY_PALETTE = {
  horizon: 0xf0d2c6,
  middle: 0xbec3e2,
  zenith: 0x7d8dbc,
  below: 0xa8a6bd,
  glow: 0xffe3bf,
} as const;

/**
 * One background triangle, rendered before the city. Camera rotation reveals
 * a fixed world-direction sky; translation and zoom cannot move its horizon.
 * It has no render target, sampled texture, fog or per-frame animation.
 */
export function createSchwellenraumSky(): Mesh<BufferGeometry, ShaderMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: Object.fromEntries(
      Object.entries(SCHWELLENRAUM_SKY_PALETTE).map(([name, value]) => [
        `u${name[0].toUpperCase()}${name.slice(1)}`,
        { value: new Color(value) },
      ]),
    ),
    vertexShader: /* glsl */ `
      varying highp vec3 vSkyDirection;
      void main() {
        vec4 viewRay = inverse(projectionMatrix) * vec4(position.xy, 1.0, 1.0);
        vSkyDirection = mat3(inverse(viewMatrix)) * viewRay.xyz;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uMiddle;
      uniform vec3 uZenith;
      uniform vec3 uBelow;
      uniform vec3 uGlow;
      varying highp vec3 vSkyDirection;
      void main() {
        vec3 direction = normalize(vSkyDirection);
        float elevation = direction.y;
        vec3 sky = mix(uHorizon, uMiddle, smoothstep(0.0, 0.16, elevation));
        sky = mix(sky, uZenith, smoothstep(0.12, 0.72, elevation));
        sky = mix(sky, uBelow, smoothstep(0.0, 0.58, -elevation));
        // A wide stationary pearl glow, without a sun disc or weather motion.
        float glow = pow(max(0.0, dot(direction, normalize(vec3(-0.68, 0.16, -0.72)))), 9.0);
        sky = mix(sky, uGlow, glow * 0.23);
        gl_FragColor = vec4(sky, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = "Schwellenraum pearl dusk sky";
  const sky = new Mesh(geometry, material);
  sky.name = "Schwellenraum static gradient sky";
  sky.frustumCulled = false;
  sky.renderOrder = -10_000;
  sky.raycast = () => undefined;
  sky.userData.schwellenraumStatic = true;
  sky.userData.backgroundOnly = true;
  sky.userData.noTexture = true;
  return sky;
}
