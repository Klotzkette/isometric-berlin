/** A bounded interpretation of already authored storey/bay axes. LoD2 does
 * not survey openings: these remain explicitly estimated facade fittings. */
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from "three";
export type WindowSourceV288 = { id: string; ring: number[][]; holes?: number[][][]; y0_dm: number; h_dm: number };
export type OrdinaryPaneV288 = { x: number; y: number; z: number; dx: number; dz: number; nx: number; nz: number; width: number; height: number };
export const ORDINARY_WINDOWS_V288_LIMIT = 100000;
export function createOrdinaryWindowsV288(panes: readonly OrdinaryPaneV288[]): InstancedMesh {
  if (panes.length > ORDINARY_WINDOWS_V288_LIMIT) throw new Error("Ordinary facade fitting budget exceeded");
  const positions: number[] = [], colors: number[] = [], tone = new Color();
  const quad = (x0: number, y0: number, x1: number, y1: number, z: number, hex: number) => {
    tone.setHex(hex);
    for (const [x, y] of [[x0,y0],[x1,y0],[x1,y1],[x0,y0],[x1,y1],[x0,y1]]) { positions.push(x,y,z); colors.push(tone.r,tone.g,tone.b); }
  };
  quad(-.59,-.55,.59,.55,0,0xb9b6a9);
  quad(-.52,-.5,.52,.5,.012,0x596666);
  quad(-.46,-.46,.46,.46,.024,0x8d9e9f);
  quad(-.02,-.46,.02,.46,.036,0xb5b8af);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3)); geometry.setAttribute("color",new Float32BufferAttribute(colors,3)); geometry.computeVertexNormals();
  const day = new MeshBasicMaterial({vertexColors:true,side:DoubleSide}), night = new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.95});
  const mesh = new InstancedMesh(geometry,day,panes.length), matrix = new Matrix4();
  panes.forEach((p,i) => { matrix.set(p.dx*p.width,0,p.nx,p.x, 0,p.height,0,p.y, p.dz*p.width,0,p.nz,p.z, 0,0,0,1); mesh.setMatrixAt(i,matrix); });
  mesh.instanceMatrix.needsUpdate=true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name="Estimated ordinary windows on retained storey and bay axes v288";
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,estimatedOpenings:true,sourceGeometryRetained:true,partyWallsExcluded:true};
  return mesh;
}
function inside(ring: number[][], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
/** Reject covered party walls and internal part boundaries at each window.
 * A courtyard hole is open air. No source ring or building is modified. */
export function ordinaryWindowExposureV288(buildings: readonly WindowSourceV288[]) {
  const buckets = new Map<string, WindowSourceV288[]>(), side = 320;
  for (const b of buildings) {
    if (!b.ring.length) continue;
    const xs = b.ring.map(p => p[0]), zs = b.ring.map(p => p[1]);
    for (let x = Math.floor(Math.min(...xs) / side); x <= Math.floor(Math.max(...xs) / side); x++)
      for (let z = Math.floor(Math.min(...zs) / side); z <= Math.floor(Math.max(...zs) / side); z++) {
        const key = `${x}:${z}`, list = buckets.get(key) ?? []; list.push(b); buckets.set(key, list);
      }
  }
  return (id: string, x: number, y: number, z: number): boolean => {
    const dx = x * 10, dz = z * 10;
    for (const b of buckets.get(`${Math.floor(dx / side)}:${Math.floor(dz / side)}`) ?? [])
      if (b.id !== id && y * 10 > b.y0_dm - .1 && y * 10 < b.y0_dm + b.h_dm + .1 &&
          inside(b.ring, dx, dz) && !(b.holes ?? []).some(h => inside(h, dx, dz))) return false;
    return true;
  };
}
