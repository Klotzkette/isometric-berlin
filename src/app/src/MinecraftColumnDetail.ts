import type { MeshStandardMaterial } from "three";

/**
 * Read the existing metre grid as block courses on tall voxel columns. In
 * particular, the mobile profile keeps one measured solid column yet no longer
 * presents its entire height as one featureless stretched block. No geometry,
 * texture, attribute, extra draw call or collision change is introduced.
 */
export function applyMinecraftColumnDetail(material: MeshStandardMaterial, cellM: number): void {
  material.customProgramCacheKey = () => `minecraft-source-columns-v1-${cellM}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.minecraftCourseM = { value: cellM };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vMinecraftDetailWorld;",
    ).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec4 detailWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        detailWorld = instanceMatrix * detailWorld;
      #endif
      vMinecraftDetailWorld = (modelMatrix * detailWorld).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vMinecraftDetailWorld;\nuniform float minecraftCourseM;",
    ).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float course = vMinecraftDetailWorld.y / minecraftCourseM;
      float courseWidth = max(fwidth(course), 0.012);
      float joint = 1.0 - smoothstep(0.012, 0.012 + courseWidth, abs(fract(course + 0.5) - 0.5));
      vec3 faceNormal = normalize(cross(dFdx(vMinecraftDetailWorld), dFdy(vMinecraftDetailWorld)));
      float sideFace = 1.0 - smoothstep(0.15, 0.65, abs(faceNormal.y));
      float nearDetail = 1.0 - smoothstep(100.0, 380.0, distance(cameraPosition, vMinecraftDetailWorld));
      diffuseColor.rgb *= 1.0 - 0.20 * joint * sideFace * nearDetail;`,
    );
  };
  material.needsUpdate = true;
}
