import { Material } from "three";

type ShaderHook = Material["onBeforeCompile"];
const rangeSafe = new WeakSet<ShaderHook>([Material.prototype.onBeforeCompile]);

/** Only register wrappers that preserve vertex positions and do not use draw-local instance IDs. */
export function registerGroundRangeShaderWrapperV383(previous: ShaderHook, wrapped: ShaderHook): void {
  if (rangeSafe.has(previous)) rangeSafe.add(wrapped);
}

export function groundRangeShaderSafeV383(material: Material): boolean {
  return rangeSafe.has(material.onBeforeCompile);
}
