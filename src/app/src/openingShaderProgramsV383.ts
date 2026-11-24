import { Camera, Group, InstancedMesh, Line, Material, Mesh, Scene, WebGLRenderer, type Object3D, type WebGLRenderTarget } from "three";

/** Queue the actual lit scene's common WebGL programs while the city is being
 * constructed. The driver can link them before the first visible draw needs
 * its uniforms. No dummy frame, upload, shader approximation or pixel change. */
export function queueOpeningShaderProgramsV383(renderer: WebGLRenderer, camera: Camera, scene: Scene,
  futureRoot: Object3D, target: WebGLRenderTarget) {
  if (!renderer.extensions.has("KHR_parallel_shader_compile") || renderer.getContext().isContextLost()) return;
  const variants = new Set<string>(), samples = new Group();
  for (const root of [futureRoot, scene]) root.traverseVisible(object => {
    if (variants.size >= 16 || !(object instanceof Mesh || object instanceof Line) || object.children.length) return;
    const material = object.material;
    if (Array.isArray(material) || !material.visible || material.transparent ||
        material.onBeforeCompile !== Material.prototype.onBeforeCompile ||
        !["MeshStandardMaterial", "MeshBasicMaterial", "LineBasicMaterial", "MeshLambertMaterial"].includes(material.type)) return;
    const key = [material.type, material.side, material.vertexColors, object.receiveShadow,
      object instanceof InstancedMesh, object instanceof InstancedMesh && !!object.instanceColor,
      !!object.geometry.attributes.color, material.flatShading, !!material.map, material.fog].join("/");
    if (variants.has(key)) return;
    variants.add(key);
    // compile() only traverses these existing leaf objects. Keep their parents,
    // world transforms, callbacks and material ownership exactly where they are.
    samples.children.push(object);
  });
  if (!samples.children.length) return;
  const before = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  try {
    renderer.setRenderTarget(target);
    renderer.compile(samples, camera, scene);
  } catch {
    // Some WebGL drivers decline a speculative program during a reset. The
    // normal frame still owns program compilation and error recovery.
  } finally {
    renderer.setRenderTarget(before, face, mip);
    samples.children.length = 0;
  }
}

/** Three's final edge-smoothing pass uses three distinct real programs. Starting
 * their driver links at 1×1, before the data fetch/CPU build, avoids making the
 * first visible fullscreen frame wait for shader compilation. No draw occurs. */
export function queueOpeningSmaaProgramsV383(renderer: WebGLRenderer, camera: Camera, pass: unknown) {
  if (!renderer.extensions.has("KHR_parallel_shader_compile") || renderer.getContext().isContextLost()) return;
  const smaa = pass as {
    _fsQuad?: {_mesh?: Mesh}; _materialEdges?: Material; _materialWeights?: Material;
    _materialBlend?: Material; _edgesRT?: WebGLRenderTarget; _weightsRT?: WebGLRenderTarget;
  };
  const geometry = smaa?._fsQuad?._mesh?.geometry;
  if (!geometry || !smaa._edgesRT || !smaa._weightsRT || !smaa._materialEdges ||
      !smaa._materialWeights || !smaa._materialBlend) return;
  const target = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  // The fullscreen quad normally renders with Three's empty lightless scene.
  const scene = new Scene(), sample = new Mesh(geometry, smaa._materialEdges);
  scene.add(sample);
  try {
    renderer.setRenderTarget(smaa._edgesRT);
    renderer.compile(scene, camera);
    sample.material = smaa._materialWeights;
    renderer.setRenderTarget(smaa._weightsRT);
    renderer.compile(scene, camera);
    sample.material = smaa._materialBlend;
    renderer.setRenderTarget(null);
    renderer.compile(scene, camera);
  } catch {
    // The ordinary pass still compiles on first use if the driver declines.
  } finally {
    renderer.setRenderTarget(target, face, mip);
    scene.clear();
  }
}
