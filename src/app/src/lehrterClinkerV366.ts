import { Color, Group, InstancedMesh, Material } from "three";
import { LEHRTER_BRICK } from "./lehrterKulturhausProfileV366";

const brickLinear = new Color(LEHRTER_BRICK);
const brickTest = `vec3(${brickLinear.r.toFixed(7)}, ${brickLinear.g.toFixed(7)}, ${brickLinear.b.toFixed(7)})`;

// A running bond on the wall fields only. All coordinates are metres and
// derivatives suppress the joints once a course is smaller than a few pixels.
const lines = `
if (lehrterBrickCoord.z > 0.5) {
  vec2 course = lehrterBrickCoord.xy / vec2(0.265, 0.078);
  vec2 pixel = max(fwidth(course), vec2(0.00001));
  float detail = 1.0 - smoothstep(0.28, 0.75, max(pixel.x, pixel.y));
  float row = floor(course.y);
  course.x += mod(row, 2.0) * 0.5;
  vec2 local = abs(fract(course + 0.5) - 0.5);
  vec2 halfJoint = vec2(0.019, 0.058);
  vec2 joint = 1.0 - smoothstep(halfJoint - pixel * 0.48, halfJoint + pixel * 0.48, local);
  float mortar = max(joint.x, joint.y);
  vec2 unit = mod(floor(course), 127.0);
  float kiln = fract(0.41 * unit.x + 0.173 * unit.y + 0.013 * unit.x * unit.y);
  vec3 masonry = diffuseColor.rgb * (0.93 + 0.14 * kiln);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(masonry, vec3(0.47, 0.33, 0.245), mortar * 0.53), detail);
}`;

const bound = new WeakSet<Material>();
export function applyLehrterClinkerV366(root: Group): void {
  if (root.userData.blockNative) return;
  for (const mesh of root.children) {
    if (!(mesh instanceof InstancedMesh) || !mesh.name.endsWith(" stone")) continue;
    for (const mat of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) {
      if (!(mat instanceof Material) || bound.has(mat)) continue;
      bound.add(mat);
      const previous = mat.onBeforeCompile,
        key = mat.customProgramCacheKey();
      mat.onBeforeCompile = (shader, renderer) => {
        previous.call(mat, shader, renderer);
        shader.vertexShader =
          "varying vec3 lehrterBrickCoord;\n" +
          shader.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
           lehrterBrickCoord = vec3(0.0);
           #if defined(USE_INSTANCING) && defined(USE_INSTANCING_COLOR)
             vec3 site = (instanceMatrix * vec4(transformed, 1.0)).xyz;
             if (site.x > -680.0 && site.x < -575.0 && site.z > -1375.0 && site.z < -1228.0
                 && distance(instanceColor, ${brickTest}) < 0.001) {
               vec2 street = normalize(vec2(-0.436, -0.900));
               vec2 axis = abs(dot(normalize(instanceMatrix[0].xz), street)) > 0.7
                 ? street : vec2(-street.y, street.x);
               lehrterBrickCoord = vec3(dot(site.xz - vec2(-600.0, -1260.0), axis), site.y - 5.2, 1.0);
             }
           #endif`
          );
        shader.fragmentShader =
          "varying vec3 lehrterBrickCoord;\n" +
          shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n" + lines);
      };
      mat.customProgramCacheKey = () => key + "|lehrter-rotklinker";
      mat.needsUpdate = true;
    }
  }
}
