import type { Material } from "three";

/** The operator's exterior photograph resolves continuous metal meridians and offset
 * transverse panel joints. Work on the original dome and its own cardinal blocks. */
export function addPlanetariumCladdingV378(material: Material): void {
  material.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec3 vBerlinPlanetariumPosition;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      `vec4 planetariumPoint = vec4(transformed, 1.0);
       #ifdef USE_INSTANCING
         planetariumPoint = instanceMatrix * planetariumPoint;
       #endif
       vBerlinPlanetariumPosition = planetariumPoint.xyz - vec3(3895.408, 17.721, -2594.857);
       #include <project_vertex>`,
    );
    shader.fragmentShader = "varying vec3 vBerlinPlanetariumPosition;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>", `#include <color_fragment>
      vec3 p = vBerlinPlanetariumPosition;
      if (p.y > -9.23 && dot(p.xz, p.xz) < 254.0 && p.y < 15.6) {
        float u = (atan(p.z, p.x) / 6.2831853 + 0.5) * 64.;
        float v = p.y <= 0. ? p.y / 1.52 : asin(clamp(p.y / 15., 0., .9999)) * 9.87;
        float course = v + .5 * mod(floor(u), 2.);
        vec2 grid = vec2(u, course);
        vec2 distanceToJoint = min(fract(grid), 1. - fract(grid));
        // Fade unresolved seams smoothly at distant zooms, including the crown.
        vec2 footprint = max(vec2(fwidth(u), fwidth(v)), vec2(.004));
        vec2 edge = (1. - smoothstep(vec2(.012) - footprint * .4, vec2(.026) + footprint * .4, distanceToJoint));
        float visible = 1. - smoothstep(.20, .62, max(footprint.x, footprint.y));
        float lap = max(edge.x, edge.y * .85) * visible;
        float panel = mod(floor(u) * 7. + floor(course) * 3., 9.) / 8.;
        diffuseColor.rgb *= (1. + (.14 * panel - .045) * visible - .25 * lap);
      }`,
    );
  };
  material.customProgramCacheKey = () => "berlin-planetarium-cladding-v378";
}
