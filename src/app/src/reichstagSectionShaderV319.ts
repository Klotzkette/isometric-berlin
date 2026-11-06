import { Material, MeshDepthMaterial, MeshDistanceMaterial, RGBADepthPacking, ShaderMaterial, type Plane, type WebGLRenderer } from "three";

/** The ordinary renderer projects these planes into view space. Each consecutive
 * group of six bounds one finite box; the display removes their UNION, retaining
 * the complete exterior complement. No source mesh or terrain is rewritten. */
export function reichstagSectionFragmentV319(groups: number, guardFirst = false): string {
  if (!Number.isInteger(groups) || groups < 1 || groups > 32) throw new Error("Invalid finite Reichstag section volume count");
  const inside = (group: number) => Array.from({ length: 6 }, (_, i) => {
    const n = group * 6 + i;
    return `(dot(vClipPosition, clippingPlanes[${n}].xyz) > clippingPlanes[${n}].w)`;
  }).join(" && ");
  return `#if NUM_CLIPPING_PLANES == ${groups * 6}
${guardFirst ? `if (${inside(0)}) {` : ""}
${Array.from({ length: groups - (guardFirst ? 1 : 0) }, (_, i) => `if (${inside(i + (guardFirst ? 1 : 0))}) discard;`).join("\n")}
${guardFirst ? "}" : ""}
#endif`;
}

export function patchReichstagSectionFragmentV319(source: string, groups: number, guardFirst = false): string {
  if (!source.includes("#include <clipping_planes_fragment>")) throw new Error("Reichstag section requires the standard local clipping chunk");
  return source.replace("#include <clipping_planes_fragment>", reichstagSectionFragmentV319(groups, guardFirst));
}

export type SectionShaderReceiptV319 = { restore(): void; restoreClone(clone: Material): void; setPlanes(planes: Plane[]): void };
export function ownReichstagSectionShaderV319(material: Material, planes: Plane[], guardFirst = false): SectionShaderReceiptV319 {
  const before = material.onBeforeCompile, cache = material.customProgramCacheKey;
  const beforeDescriptor = Object.getOwnPropertyDescriptor(material, "onBeforeCompile"), cacheDescriptor = Object.getOwnPropertyDescriptor(material, "customProgramCacheKey");
  const customClipping = material instanceof ShaderMaterial ? material.clipping : undefined;
  if (material instanceof ShaderMaterial) material.clipping = true;
  // Snapshot the underlying key before installing our wrapper: the default key
  // reflects onBeforeCompile and would otherwise recurse into the display patch.
  const baselineKey = cache.call(material);
  let current = planes;
  material.onBeforeCompile = function(shader, renderer: WebGLRenderer) {
    before.call(this, shader, renderer);
    const groups = current.length / 6;
    if (shader.fragmentShader.includes("#include <clipping_planes_fragment>")) {
      shader.fragmentShader = patchReichstagSectionFragmentV319(shader.fragmentShader, groups, guardFirst);
    } else if (material instanceof ShaderMaterial) {
      // The fictional flood and atmospheric water use small custom shaders.
      // Apply the same spatial cut without changing their source uniforms,
      // position buffers, clock, existing fragment effect or outside pixels.
      shader.vertexShader = `#include <clipping_planes_pars_vertex>\n${shader.vertexShader}`.replace(/void\s+main\s*\(\s*\)\s*\{/, `$&
        vec4 reichstagSectionPosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          reichstagSectionPosition = instanceMatrix * reichstagSectionPosition;
        #endif
        vClipPosition = -(modelViewMatrix * reichstagSectionPosition).xyz;
      `);
      shader.fragmentShader = `#include <clipping_planes_pars_fragment>\n${shader.fragmentShader}`.replace(/void\s+main\s*\(\s*\)\s*\{/, `$&\n${reichstagSectionFragmentV319(groups, guardFirst)}\n`);
    }
  };
  material.customProgramCacheKey = () => `${baselineKey}|reichstag-finite-union-v319-${current.length / 6}-${guardFirst}`;
  return {
    setPlanes(next) { current = next; },
    restoreClone(clone) {
      if (clone.onBeforeCompile === material.onBeforeCompile) clone.onBeforeCompile = before;
      if (clone.customProgramCacheKey === material.customProgramCacheKey) clone.customProgramCacheKey = cache;
      if (clone instanceof ShaderMaterial && customClipping !== undefined) clone.clipping = customClipping;
    },
    restore() {
      if (beforeDescriptor) Object.defineProperty(material, "onBeforeCompile", beforeDescriptor); else delete (material as unknown as {onBeforeCompile?: unknown}).onBeforeCompile;
      if (cacheDescriptor) Object.defineProperty(material, "customProgramCacheKey", cacheDescriptor); else delete (material as unknown as {customProgramCacheKey?: unknown}).customProgramCacheKey;
      if (material instanceof ShaderMaterial) material.clipping = customClipping!;
    },
  };
}

/** Shadow casters share the same finite union. The renderer copies alpha maps,
 * clipping uniforms, skinning and face settings from their actual source material;
 * caller restores the exact previous custom-material pointers on close. */
export function createReichstagSectionShadowV319(planes: Plane[], distance = false, original?: Material, guardFirst = false): Material {
  const material = original?.clone() ?? (distance ? new MeshDistanceMaterial() : new MeshDepthMaterial({ depthPacking: RGBADepthPacking }));
  if (original) { material.onBeforeCompile = original.onBeforeCompile; material.customProgramCacheKey = original.customProgramCacheKey; }
  material.clippingPlanes = planes; material.clipIntersection = true; material.clipShadows = true;
  ownReichstagSectionShaderV319(material, planes, guardFirst);
  return material;
}
