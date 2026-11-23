import { BoxGeometry, CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { loadTegelShoreV378 } from "./tegelLandscapeShoreLinkV378";
import { tegelHostsV378 } from "./tegelLandscapeIndexV378";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

interface LandscapePacket {
  origin: number[];
  points: string;
  nativeDy: string;
  materials: string;
  triangles: string;
  walk: string;
  ground: number[][][][];
  owners: string[];
  crowns: number[][];
  houses: {id: string; base: number; height: number; rings: number[][][]; roof: number[][][]}[];
}
const banks: Record<string, () => Promise<{ default: Record<string, LandscapePacket> }>> = {
  reiherwerder: () => import("./data/tegelLandscapeV378-reiherwerder.json"),
  fest: () => import("./data/tegelLandscapeV378-fest.json"),
  fliess: () => import("./data/tegelLandscapeV378-fliess.json"),
  forst: () => import("./data/tegelLandscapeV378-forst.json"),
  schloss: () => import("./data/tegelLandscapeV378-schloss.json"),
  tegel: () => import("./data/tegelLandscapeV378-tegel.json"),
  wannsee: () => import("./data/tegelLandscapeV378-wannsee.json"),
};
const palette = [0xc7b284, 0xae9b75, 0xb6a68f, 0x8c8c87, 0xaca9a0, 0x8c9d76,
  0x706755, 0xa38a70, 0x5b6460, 0xa0a49b, 0x738444, 0x9b915c,
  0xb5a793, 0xd4c9ac, 0x727a72, 0x507c52, 0x737542, 0x948675].map(hex => new Color(hex)).concat(new Color(45/255,69/255,26/255));

/** Look up only surveyed walking triangles. Local XZ coordinates are metres. */
function walkingSurface(points: Float32Array, indices: Uint16Array, walk: Uint16Array, ox: number, oz: number) {
  const buckets = new Map<number, number[]>();
  const key = (x: number, z: number) => (x + 64) * 160 + z + 64;
  for (const face of walk) {
    const a = 3 * indices[3 * face], b = 3 * indices[3 * face + 1], c = 3 * indices[3 * face + 2];
    const xs = [points[a], points[b], points[c]], zs = [points[a+2], points[b+2], points[c+2]];
    for (let x = Math.floor(Math.min(...xs)/16); x <= Math.floor(Math.max(...xs)/16); x++) {
      for (let z = Math.floor(Math.min(...zs)/16); z <= Math.floor(Math.max(...zs)/16); z++) {
        const k = key(x,z);
        const list = buckets.get(k);
        if (list) list.push(face);
        else buckets.set(k,[face]);
      }
    }
  }
  return (worldX: number, worldZ: number): number | null => {
    const x = worldX - ox, z = worldZ - oz;
    const faces = buckets.get(key(Math.floor(x/16),Math.floor(z/16)));
    if (!faces) return null;
    let height = -Infinity;
    for (const face of faces) {
      const a=3*indices[3*face], b=3*indices[3*face+1], c=3*indices[3*face+2];
      const ux=points[b]-points[a], uz=points[b+2]-points[a+2];
      const vx=points[c]-points[a], vz=points[c+2]-points[a+2];
      const dx=x-points[a], dz=z-points[a+2], det=ux*vz-uz*vx;
      if (Math.abs(det)<1e-8) continue;
      const u=(dx*vz-dz*vx)/det, v=(ux*dz-uz*dx)/det;
      if (u>=-1e-6 && v>=-1e-6 && u+v<=1.000001) {
        height=Math.max(height, points[a+1]+u*(points[b+1]-points[a+1])+v*(points[c+1]-points[a+1]));
      }
    }
    return height === -Infinity ? null : height;
  };
}

/** Local maxima in Berlin's measured canopy height raster, separated from the
 * existing model trees. Crown lobes and trunk centres approximate that surface. */
function forestCanopy(packet: LandscapePacket, native: boolean, entry: SurroundingChunkGeometry) {
  const trees = packet.crowns;
  if (!trees.length) return;
  const material = new MeshStandardMaterial({roughness:1,flatShading:true});
  const trunk = new InstancedMesh(native ? new BoxGeometry(1,1,1) : new CylinderGeometry(.4,.5,1,6),material,trees.length);
  const crown = new InstancedMesh(native ? new BoxGeometry(1,1,1) : new IcosahedronGeometry(.5,0),material,trees.length * 3);
  const matrix = new Matrix4();
  for (let i=0; i<trees.length; i++) {
    const [x,z,h,r,yd,yn]=trees[i], y=native ? yn : yd;
    const width = h*.025;
    matrix.makeScale(width,h*.66,width).setPosition(x,y+h*.33,z);
    trunk.setMatrixAt(i,matrix);trunk.setColorAt(i,palette[6]);
    for (let j=0;j<3;j++) {
      const angle=i*2.39996+j*2.0944;
      const dx=j ? Math.cos(angle)*r*.35 : 0, dz=j ? Math.sin(angle)*r*.35 : 0;
      const diameter=j ? r*1.42 : r*1.68;
      const height=j ? h*.35 : h*.48, top=j ? h*.87 : h;
      matrix.makeScale(diameter,height,diameter).setPosition(x+dx,y+top-height/2,z+dz);
      crown.setMatrixAt(3*i+j,matrix);
      crown.setColorAt(3*i+j,new Color([0x507345,0x5e7c4b,0x6b8152][(i+j)%3]));
    }
  }
  for (const part of [trunk,crown]) {
    part.position.set(packet.origin[0],0,packet.origin[1]);
    part.name=part===trunk ? "Tegeler Forst · Stämme unter gemessenen Kronen" : "Tegeler Forst · gemessene Kronenhöhen";
    part.userData={dayMaterial:material,nightMaterial:material,keepInMinecraft:true,measuredCanopyPeaksV378:trees.length};
    part.computeBoundingSphere();
    attachWorldSpaceDetail(entry,part);
  }
}

export async function attachTegelLandscapeV378(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal): Promise<void> {
  const host = tegelHostsV378.find(tile => tile.id === id);
  if (!host) return;
  signal.throwIfAborted();
  const [bank] = await Promise.all([banks[host.bank](),
    host.bank === "tegel" || host.bank === "reiherwerder" ? loadTegelShoreV378() : undefined]);
  const packet = bank.default[id];
  signal.throwIfAborted();
  const q = new Int16Array(decodeBase64Bytes(packet.points).buffer);
  const dy = native && packet.nativeDy ? new Int16Array(decodeBase64Bytes(packet.nativeDy).buffer) : null;
  const material = decodeBase64Bytes(packet.materials);
  const points = new Float32Array(q.length), colors = new Float32Array(q.length);
  for (let i=0; i<material.length; i++) {
    const j=3*i;
    points[j]=q[j]/100; points[j+1]=(q[j+1]+(dy?.[i]??0))/100; points[j+2]=q[j+2]/100;
    palette[material[i]].toArray(colors,j);
  }
  const indices = new Uint16Array(decodeBase64Bytes(packet.triangles).buffer);
  const geometry = new BufferGeometry();
  geometry.setIndex(new BufferAttribute(indices,1));
  geometry.setAttribute("position",new BufferAttribute(points,3));
  geometry.setAttribute("color",new BufferAttribute(colors,3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const night = new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:1,flatShading:true});
  const day = native ? night : new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const mesh = new Mesh(geometry,day);
  const [ox,oz]=packet.origin;
  mesh.name = "Vermessene Landschaft v378 · "+host.bank;
  mesh.position.set(ox,0,oz);
  mesh.userData={dayMaterial:day,nightMaterial:night,keepInMinecraft:true,sourceOwnersV378:packet.owners};
  attachWorldSpaceDetail(entry,mesh);
  forestCanopy(packet,native,entry);
  for (const house of packet.houses) {
    const [ex,,ez]=entry.origin;
    const rings=house.rings.map(r=>r.map(([x,z])=>[x+ox-ex,z+oz-ez]));
    entry.nav.buildings.push({sourceId:house.id,ring:rings[0],holes:rings.slice(1),minHeight:0,
      groundOffset:house.base-entry.nav.groundY,height:house.height,
      roofTriangles:house.roof.map(t=>t.map(([x,y,z])=>[x+ox-ex,y,z+oz-ez]))});
  }
  if (packet.ground.length) {
    const [ex,,ez]=entry.origin;
    for (const rings of packet.ground) {
      const local=rings.map(ring=>ring.map(([x,z])=>[x+ox-ex,z+oz-ez] as [number,number]));
      entry.nav.ground.push({ring:local[0],holes:local.slice(1)});
    }
    entry.root.userData.tegelLandscapeFloorV378=walkingSurface(points,indices,new Uint16Array(decodeBase64Bytes(packet.walk).buffer),ox,oz);
  }
}
