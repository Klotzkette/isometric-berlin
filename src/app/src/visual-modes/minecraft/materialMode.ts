import {
  DataTexture,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  type Material,
} from "three";

export type MinecraftMaterialState = {
  gradientMap: DataTexture;
  originals: Map<Mesh, Material | Material[]>;
  toonBySource: Map<Material, MeshToonMaterial>;
};

type FlatToonMaterial = MeshToonMaterial & { flatShading: boolean };

export function createMinecraftMaterialState(): MinecraftMaterialState {
  const gradientMap = new DataTexture(new Uint8Array([54, 142, 244]), 3, 1, RedFormat);
  gradientMap.minFilter = NearestFilter;
  gradientMap.magFilter = NearestFilter;
  gradientMap.needsUpdate = true;
  return {
    gradientMap,
    originals: new Map(),
    toonBySource: new Map(),
  };
}

function toonMaterialFor(
  source: Material,
  state: MinecraftMaterialState,
): Material {
  if (!(source instanceof MeshStandardMaterial)) {
    return source;
  }
  const cached = state.toonBySource.get(source);
  if (cached) {
    return cached;
  }
  const material = new MeshToonMaterial({
    alphaTest: source.alphaTest,
    color: source.color,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
    emissive: source.emissive,
    emissiveIntensity: Math.max(source.emissiveIntensity, 0.08),
    emissiveMap: source.emissiveMap,
    gradientMap: state.gradientMap,
    map: source.map,
    opacity: source.opacity,
    side: source.side,
    transparent: source.transparent,
    vertexColors: source.vertexColors,
  }) as FlatToonMaterial;
  material.flatShading = true;
  material.name = `${source.name || source.type} premium voxel material`;
  material.userData = { ...source.userData, minecraftToon: true };
  state.toonBySource.set(source, material);
  return material;
}

export function setMinecraftMaterialPresentation(
  root: Object3D,
  state: MinecraftMaterialState,
  enabled: boolean,
): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    if (enabled) {
      if (!state.originals.has(object)) {
        state.originals.set(object, object.material);
      }
      const original = state.originals.get(object);
      if (!original) {
        return;
      }
      object.material = Array.isArray(original)
        ? original.map((material) => toonMaterialFor(material, state))
        : toonMaterialFor(original, state);
      return;
    }
    const original = state.originals.get(object);
    if (original) {
      object.material = original;
    }
  });
}

export function releaseMinecraftMaterialBindings(
  root: Object3D,
  state: MinecraftMaterialState,
): void {
  const releasedSources = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    const original = state.originals.get(object);
    if (!original) {
      return;
    }
    object.material = original;
    for (const material of Array.isArray(original) ? original : [original]) {
      releasedSources.add(material);
    }
    state.originals.delete(object);
  });
  const retainedSources = new Set<Material>();
  for (const original of state.originals.values()) {
    for (const material of Array.isArray(original) ? original : [original]) {
      retainedSources.add(material);
    }
  }
  for (const source of releasedSources) {
    if (retainedSources.has(source)) {
      continue;
    }
    state.toonBySource.get(source)?.dispose();
    state.toonBySource.delete(source);
  }
}

export function disposeMinecraftMaterialState(
  state: MinecraftMaterialState,
): void {
  for (const material of state.toonBySource.values()) {
    material.dispose();
  }
  state.gradientMap.dispose();
  state.originals.clear();
  state.toonBySource.clear();
}
