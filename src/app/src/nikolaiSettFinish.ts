import { type MeshBasicMaterial } from "three";

/** Metre-space joints on the surveyed small and large stone paving. */
export function applyNikolaiSettFinish(material: MeshBasicMaterial): void {
  material.customProgramCacheKey = () => "nikolai-natural-stone-setts";
  material.onBeforeCompile = shader => {
    shader.vertexShader = "attribute float settSize;\nvarying vec3 vNikolaiSetts;\n" +
      shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vNikolaiSetts = vec3(position.xz, settSize);`);
    shader.fragmentShader = "varying vec3 vNikolaiSetts;\n" +
      shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        if (vNikolaiSetts.z > 0.5) {
          vec2 size = vNikolaiSetts.z < 1.5 ? vec2(0.095) : vec2(0.19, 0.145);
          vec2 stone = vNikolaiSetts.xy / size;
          vec2 pixel = max(fwidth(stone), vec2(0.001));
          float visible = 1.0 - smoothstep(0.16, 0.48, max(pixel.x, pixel.y));
          stone.x += 0.5 * mod(floor(stone.y), 2.0);
          vec2 key = fract(floor(stone) * vec2(0.1031, 0.11369));
          float tone = fract((key.x + key.y) * (35.73 + dot(key, key.yx)));
          vec2 edge = 0.5 - abs(fract(stone) - 0.5);
          vec2 body = smoothstep(-pixel * 0.5, pixel * 0.5, edge - 0.003 / size);
          diffuseColor.rgb *= 1.0 + visible * (0.13 * (tone - 0.5) - 0.25 * (1.0 - body.x * body.y));
        }`);
  };
}
