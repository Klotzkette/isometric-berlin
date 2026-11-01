import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial, LineSegments, Material, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from "three";
import data from "./data/chancelleryCanopyV289.json";
import legacyData from "./data/chancelleryCanopyLegacyV289.json";
import { CANOPY_THICKNESS_V289, chancelleryCanopyMastsV289, chancelleryCanopyNativeRoofV289, chancelleryCanopyTrianglesV289 } from "./ChancelleryCanopyV289Navigation";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { setSchwellenraumStandardMaterialTone } from "./visual-modes/schwellenraum/materialGrade";
import { applyArchitecturalInkMode, type ArchitecturalInkRole } from "./architecturalInk";
import { isInkDrawSuppressed } from "./inkDrawVisibility";

const complete = new WeakSet<Group>();
const CLOTH = 0xe0e2d8, FRAME = 0x737e7b, GLASS = 0x8daead;
type Row = [number, number, number, number, number, number, number];

function geometry(triangles: number[][][]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(triangles.flat(2), 3));
  g.computeVertexNormals();
  return g;
}
function attachRoof(root: Group, door = false): void {
  const triangles = chancelleryCanopyTrianglesV289(door), lower = triangles.map(t => t.map(([x, y, z]) => [x, y - CANOPY_THICKNESS_V289, z]));
  const membrane = new Mesh(geometry([...triangles, ...lower]), new MeshStandardMaterial({ color: door ? FRAME : CLOTH, roughness: .72, side: DoubleSide }));
  membrane.name = door ? "Chancellery source-bound small vestibule roof v289" : "Chancellery original two-surface tensile membrane v289";
  membrane.castShadow = true; membrane.receiveShadow = true;
  membrane.userData.originalRoofVertexCount = triangles.length * 3;
  root.add(membrane);
  const edges: number[] = [];
  for (const roof of data.roofs.filter(r => (r.sourceId === "DEBE3Djn1rlNcfOH") === door)) for (const ring of roof.rings) {
    for (let i = 0; i < ring.length; i++) edges.push(...ring[i], ...ring[(i + 1) % ring.length]);
  }
  const edge = new LineSegments(new BufferGeometry().setAttribute("position", new Float32BufferAttribute(edges, 3)), new LineBasicMaterial({ color: FRAME, transparent: true, opacity: .55 }));
  edge.name = "Chancellery retained complete roof edge courses v289";
  root.add(edge);
}
function nativeRows(): Row[] {
  const rows: Row[] = chancelleryCanopyNativeRoofV289().map(r => [...r, CLOTH] as Row);
  for (const [x, high, z] of chancelleryCanopyMastsV289()) rows.push([x, (5.15 + high) / 2, z, .3, high - 5.15, .3, FRAME]);
  const door = data.oldPrisms.find(p => p.id === "1rlNcfOH")!, ring = door.ring.map(([x, z]) => [x / 10, z / 10]);
  const seen = new Set<string>();
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .3));
    for (let k = 0; k <= n; k++) {
      const x = Math.round((a[0] + (b[0] - a[0]) * k / n) / .3) * .3, z = Math.round((a[1] + (b[1] - a[1]) * k / n) / .3) * .3, key = `${x},${z}`;
      if (seen.has(key)) continue; seen.add(key);
      rows.push([x, 7.105, z, .3, 3.91, .3, GLASS]);
      rows.push([x, 9.11, z, .3, .12, .3, FRAME]);
    }
  }
  return rows;
}

/** Independent world-coordinate model. The required caller validates source
 * and native tuples before retiring any exact closed source owner. */
export function createChancelleryCanopySourceV289(native = false): Group {
  const root = new Group(); root.name = "Required open source-bound Chancellery Ehrenhof canopy v289";
  try {
    if (native) {
      const rows = nativeRows(), mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: .8 }), rows.length);
      root.add(mesh);
      mesh.name = "Chancellery independently cardinal tensile canopy v289";
      const m = new Matrix4(), q = new Quaternion(), color = new Color();
      rows.forEach(([x, y, z, w, h, d, tint], i) => { m.compose(new Vector3(x, y, z), q, new Vector3(w, h, d)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, color.setHex(tint)); });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    } else {
      attachRoof(root); attachRoof(root, true);
      const door = data.oldPrisms.find(p => p.id === "1rlNcfOH")!, ring = door.ring.map(([x, z]) => [x / 10, z / 10]), panes: number[][][] = [];
      for (let i = 0; i < ring.length; i++) {
        const [a, b] = [ring[i], ring[(i + 1) % ring.length]], low = 5.15, top = 9.08;
        panes.push([[a[0], low, a[1]], [b[0], low, b[1]], [b[0], top, b[1]]], [[a[0], low, a[1]], [b[0], top, b[1]], [a[0], top, a[1]]]);
      }
      const glass = new Mesh(geometry(panes), new MeshStandardMaterial({ color: GLASS, transparent: true, opacity: .24, roughness: .18, metalness: .08, depthWrite: false, side: DoubleSide }));
      glass.name = "Chancellery retained rounded glazed vestibule v289"; root.add(glass);
      const material = new MeshStandardMaterial({ color: FRAME, roughness: .4, metalness: .5 });
      for (const [x, high, z] of chancelleryCanopyMastsV289()) {
        const mast = new Mesh(new CylinderGeometry(.12, .12, high - 5.15, 12), material);
        mast.name = "Chancellery source ridge slender tensile support v289";
        mast.position.set(x, (high + 5.15) / 2, z); mast.castShadow = true; root.add(mast);
      }
    }
    root.userData = { chancelleryCanopySourceV289: true, sourceIds: data.oldPrisms.map(p => p.id), sourceGeometryRetained: true,
      geometryStatus: data.source.geometryStatus, rigidYTranslationM: data.source.rigidYTranslationM, originalRoofSurfaceCount: 4,
      independentNative: native, fullStaticDetailOnTouch: true, noTextures: true };
    complete.add(root); freezeStaticSceneTransforms(root); return root;
  } catch (error) {
    disposeChancelleryCanopyV289(root); throw error;
  }
}
function disposeChancelleryCanopyV289(root: Group): void {
  const materials = new Set<Material>(), geometries = new Set<BufferGeometry>(); root.traverse(o => { const m = o as Mesh; if (m.geometry) geometries.add(m.geometry);
    for (const material of Array.isArray(m.material) ? m.material : [m.material]) if (material) materials.add(material);
    if (m instanceof InstancedMesh) m.dispose(); }); for (const m of materials) m.dispose(); for(const g of geometries)g.dispose(); root.clear();
}
export function hasCompleteChancelleryCanopySourceV289(root: Group): boolean { return complete.has(root) && root.children.length > 0; }

/** The receipt below is the exact prior authored surface/edge/masts. A changed
 * earlier fitting is never hidden by a name-only or broad subtree rule. */
function legacyCandidates(signatures: Object3D): Object3D[] | null {
  type Pose = { matrix: number[]; pose: number[]; matrixAutoUpdate: boolean };
  type Receipt = Pose & { name: string; index: number[]; color: number; opacity: number; transparent: boolean;
    attributes: Record<string,{itemSize:number;normalized:boolean;values:number[]}>; groups: unknown[]; drawRange:{start:number;count:number|null}; material:Record<string,unknown>;
    ink?: {modeInk:boolean;architecturalInkRole:ArchitecturalInkRole;architecturalInkDayColor:number|null} };
  const receipt = (legacyData as unknown as { legacy?: Receipt[] }).legacy;
  if (!receipt) return null;
  const rootReceipt = (legacyData as unknown as { legacyRoot?: Pose & { name: string } }).legacyRoot;
  if (!rootReceipt) return null;
  const poseMatches = (o: Object3D, r: Pose) => o.matrixAutoUpdate === r.matrixAutoUpdate && o.matrix.elements.every((v,i)=>v===r.matrix[i]) &&
    [...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].every((v,i)=>v===r.pose[i]);
  const roots: Object3D[] = [];
  signatures.traverse(o => { if (o.name === rootReceipt.name && poseMatches(o,rootReceipt) && (o===signatures||o.parent===signatures)) roots.push(o); });
  if (roots.length !== 1) return null;
  for (const name of new Set(receipt.map(r=>r.name))) if (roots[0].getObjectsByProperty("name",name).length !== receipt.filter(r=>r.name===name).length) return null;
  const candidates: Object3D[] = [];
  for (const owner of receipt) {
    const matches: Object3D[] = [];
    roots[0].traverse(o => {
      const mesh = o as Mesh, material = mesh.material as MeshStandardMaterial;
      if (o.name !== owner.name || o.parent !== roots[0] || o.children.length || !mesh.geometry || !material?.color || !poseMatches(o,owner)) return;
      if (Object.keys(mesh.geometry.attributes).length !== Object.keys(owner.attributes).length || Object.keys(mesh.geometry.morphAttributes).length ||
        JSON.stringify(mesh.geometry.groups)!==JSON.stringify(owner.groups) || mesh.geometry.drawRange.start!==owner.drawRange.start || (Number.isFinite(mesh.geometry.drawRange.count)?mesh.geometry.drawRange.count:null)!==owner.drawRange.count) return;
      for (const [name,expected] of Object.entries(owner.attributes)) {
        const a=mesh.geometry.getAttribute(name); if(!a||a.itemSize!==expected.itemSize||a.normalized!==expected.normalized||a.count*a.itemSize!==expected.values.length)return;
        for(let i=0;i<expected.values.length;i++)if(a.getComponent(Math.floor(i/a.itemSize),i%a.itemSize)!==expected.values[i])return;
      }
      for(const [key,value]of Object.entries(owner.material)){
        if(key==="visible"&&owner.ink&&value===true&&material.visible===false&&isInkDrawSuppressed(material))continue;
        if((material as unknown as Record<string,unknown>)[key]!==value)return;
      }
      if(["map","normalMap","alphaMap","aoMap","bumpMap","displacementMap","emissiveMap","lightMap","metalnessMap","roughnessMap","envMap"].some(k=>(material as unknown as Record<string,unknown>)[k]!=null))return;
      let colorMatches=material.color.getHex()===owner.color;
      if(!colorMatches&&material instanceof MeshStandardMaterial&&material.userData.schwellenraumToneActive===true&&material.userData.schwellenraumDayColor===owner.color){
        const expected=new MeshStandardMaterial({color:owner.color});setSchwellenraumStandardMaterialTone(expected,"schwellenraum");colorMatches=material.color.equals(expected.color);expected.dispose();
      }
      if(owner.ink){
        if(!(material instanceof LineBasicMaterial)||material.userData.modeInk!==owner.ink.modeInk||material.userData.architecturalInkRole!==owner.ink.architecturalInkRole||
          (material.userData.architecturalInkDayColor??null)!==owner.ink.architecturalInkDayColor)return;
        const expected=new LineBasicMaterial({color:owner.color});expected.userData={...owner.ink};if(owner.ink.architecturalInkDayColor===null)delete expected.userData.architecturalInkDayColor;
        colorMatches=["day","night","snowstorm","schwellenraum","flood","minecraft"].some(mode=>{applyArchitecturalInkMode(expected,mode as Parameters<typeof applyArchitecturalInkMode>[1],owner.ink!.architecturalInkRole);return material.color.equals(expected.color);});expected.dispose();
      }
      const fadedInk=owner.ink&&material instanceof LineBasicMaterial&&material.userData.temporallyStableInk===true&&
        material.userData.stableInkAuthoredOpacity===owner.opacity&&material.userData.stableInkAppliedOpacity===material.opacity&&material.opacity>=0&&material.opacity<=owner.opacity;
      const attribute = mesh.geometry.getAttribute("position"), a = attribute ? Array.from({ length: attribute.count * 3 }, (_, i) => i % 3 === 0 ? attribute.getX(i / 3) : i % 3 === 1 ? attribute.getY(Math.floor(i / 3)) : attribute.getZ(Math.floor(i / 3))) : [], index = mesh.geometry.index?.array ?? [];
      if (o.matrix.elements.every((v, i) => v === owner.matrix[i]) && a.length === owner.attributes.position.values.length && a.every((v, i) => v === owner.attributes.position.values[i]) &&
        index.length === owner.index.length && Array.from(index).every((v, i) => v === owner.index[i]) && colorMatches && (material.opacity === owner.opacity||fadedInk) && material.transparent === owner.transparent &&
        (o.visible || o.userData.chancelleryCanopyLegacyV289 === true)) matches.push(o);
    });
    if (matches.length !== 1 || candidates.includes(matches[0])) return null;
    candidates.push(matches[0]);
  }
  return candidates;
}
export function admitsChancelleryCanopyLegacyV289(signatures: Object3D): boolean { return legacyCandidates(signatures) !== null; }
export function setChancelleryCanopyLegacyV289(signatures: Object3D, active: boolean): boolean {
  const candidates = legacyCandidates(signatures); if (!candidates) return false;
  for (const object of candidates) { object.visible = !active; object.userData.chancelleryCanopyLegacyV289 = active; }
  return true;
}
