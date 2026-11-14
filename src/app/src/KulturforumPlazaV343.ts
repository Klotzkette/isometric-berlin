import { BufferAttribute, BufferGeometry, DoubleSide, Group, Material, Mesh, MeshBasicMaterial, type Object3D } from "three";
import source from "./data/kulturforumPlazaV343.json";
import type { VoxelPayload } from "./terrainPayload";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { isSceneMaterialProgramRetirementV321 } from "./sceneMaterialPrograms";

/** Prototype methods survive Three's clone(), including the existing
 * Schwellenraum material factory. No timer, bitmap, extra pass or texture. */
export class KulturforumPlazaMaterialV343 extends MeshBasicMaterial {
  constructor(color = 0xd4d0c3) { super({ color, side: DoubleSide }); }
  override onBeforeCompile(shader: Parameters<Material["onBeforeCompile"]>[0]): void {
    shader.vertexShader = "varying vec2 vKulturforumPavingM;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vec2 plazaDelta = position.xz - vec2(-220.0, 980.0);
      vKulturforumPavingM = mat2(0.9510565163, -0.3090169944, 0.3090169944, 0.9510565163) * plazaDelta;`);
    shader.fragmentShader = "varying vec2 vKulturforumPavingM;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec2 plazaModule = vec2(0.75, 0.35);
      vec2 plazaQ = vKulturforumPavingM / plazaModule;
      plazaQ.x += 0.5 * mod(floor(plazaQ.y), 2.0);
      vec2 plazaEdgeM = min(fract(plazaQ), 1.0 - fract(plazaQ)) * plazaModule;
      vec2 plazaPixelM = max(fwidth(vKulturforumPavingM), vec2(0.0001));
      vec2 plazaFill = smoothstep(vec2(0.007) - plazaPixelM, vec2(0.007) + plazaPixelM, plazaEdgeM);
      float plazaFade = clamp(1.0 - 2.0 * max(plazaPixelM.x / 0.75, plazaPixelM.y / 0.35), 0.0, 1.0);
      float plazaJoint = (1.0 - min(plazaFill.x, plazaFill.y)) * plazaFade;
      diffuseColor.rgb *= 1.0 - 0.14 * plazaJoint;`);
  }
  override customProgramCacheKey(): string { return "kulturforum-plaza-v343-filtered-75x35"; }
}

function buffer(encoded: string): ArrayBuffer {
  const decoded = atob(encoded), array = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) array[i] = decoded.charCodeAt(i);
  return array.buffer;
}
function hash(array: ArrayLike<number>): number {
  let result = 2166136261;
  for (let i=0;i<array.length;i++) result = Math.imul(result ^ array[i],16777619) >>> 0;
  return result;
}
function geometryHash(array: Float32Array | Uint32Array): number {
  return hash(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
}
export function canonicalKulturforumPlazaV343(): typeof source { return source; }

type Receipt = { mesh: Mesh; geometry: BufferGeometry; day: Material; night: Material; positions: Float32Array; indices: Uint32Array; positionHash:number; indexHash:number; disposed:boolean };
const receipts = new WeakMap<Group,Receipt>();

/** The ground transaction accepts only the actual completed factory product.
 * Copied userData, altered buffers, a missing face or a disposed material fail. */
export function preparedKulturforumPlazaV343(root?: Object3D): typeof source | null {
  if (!(root instanceof Group)) return null;
  const r=receipts.get(root);
  if (!r || r.disposed || root.parent || root.children.length!==1 || root.children[0]!==r.mesh ||
      !root.visible || !r.mesh.visible || !root.matrix.equals(new Group().matrix) ||
      !r.mesh.matrix.equals(new Group().matrix) || r.mesh.geometry!==r.geometry || r.mesh.material!==r.day ||
      r.mesh.userData.dayMaterial!==r.day || r.mesh.userData.nightMaterial!==r.night ||
      r.geometry.getAttribute('position')?.array!==r.positions || r.geometry.index?.array!==r.indices ||
      geometryHash(r.positions)!==r.positionHash || geometryHash(r.indices)!==r.indexHash) return null;
  return source;
}

/** Main Drawn family only. RoadGroundV343 must atomically retire the exact
 * source raster footprint and attach this prepared root to those same slabs. */
export function createKulturforumPlazaV343(ground: VoxelPayload): Group | null {
  const height=ground.ground_height;
  if (!height || ground.cell_m!==source.groundCellM ||
      Object.entries(source.groundGrid).some(([k,v])=>ground.grid[k as keyof typeof ground.grid]!==v) ||
      height.rows!==source.heightRows || height.cols!==source.heightCols || height.stride_cells!==source.heightStride ||
      hash(height.y_dm)!==source.heightGuard) return null;
  const positions=new Float32Array(buffer(source.positions)), indices=new Uint32Array(buffer(source.indices));
  if (positions.length!==source.counts.vertices*3 || indices.length!==source.counts.triangles*3 ||
      !positions.every(Number.isFinite) || !indices.every(v=>v<source.counts.vertices)) return null;
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(positions,3));
  geometry.setIndex(new BufferAttribute(indices,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day=new KulturforumPlazaMaterialV343(), night=new KulturforumPlazaMaterialV343(0x252932);
  const mesh=new Mesh(geometry,day);
  mesh.name='Philharmonie-West mapped continuous Kies-Braun paving';
  mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;
  const root=new Group();root.name='Complete Philharmonie-West paving owner 9976187 V343';root.add(mesh);
  const receipt:Receipt={mesh,geometry,day,night,positions,indices,positionHash:geometryHash(positions),indexHash:geometryHash(indices),disposed:false};
  geometry.addEventListener('dispose',()=>{receipt.disposed=true;});
  for(const material of [day,night]) material.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(material))receipt.disposed=true;});
  receipts.set(root,receipt);
  return freezeStaticSceneTransforms(root);
}
