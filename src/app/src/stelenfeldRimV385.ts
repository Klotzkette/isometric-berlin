import roads from "./data/stelenfeldV385/roads.json";
import packet from "./data/stelenfeldV385/rim.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { STELENFELD_ANCHOR, STELENFELD_BASE } from "./stelenfeldSiteV385";

function series(encoded: string, count: number, stride: number): Int32Array {
  const bytes = decodeBase64Bytes(encoded);
  const values = new Int32Array(count);
  let pos = 0;
  for (let i=0; i<count; i++) {
    let shift = 0, v = 0, byte: number;
    do {
      byte=bytes[pos++];
      v |= (byte&127)<<shift;
      shift+=7;
    } while (byte&128);
    values[i] = (i>=stride ? values[i-stride] : 0) + ((v>>>1)^-(v&1));
  }
  return values;
}

function decode() {
  const roadXZ = new Int32Array(decodeBase64Bytes(roads.xz).buffer);
  const roadY = new Int16Array(decodeBase64Bytes(roads.y).buffer);
  const roadIndices = new Uint16Array(decodeBase64Bytes(roads.index).buffer);
  const roadCount = roadXZ.length/2;
  const xz = new Int32Array(packet.vertices*2+roadXZ.length);
  const heights = new Int32Array(xz.length);
  const roles = new Uint8Array(xz.length/2);
  const indices = new Uint16Array(packet.indices+roadIndices.length);
  xz.set(series(packet.xz,packet.vertices*2,2));
  // Use millimetres throughout this lookup, preserving the road packet's
  // original triangle limits and the sidewalk's centimetre registration.
  for (let i=0; i<packet.vertices*2; i++) xz[i]*=10;
  xz.set(roadXZ,packet.vertices*2);
  heights.set(series(packet.y,packet.vertices*2,2));
  heights.set(roadY,packet.vertices*2);
  roles.set(decodeBase64Bytes(packet.material));
  roles.fill(7,packet.vertices,packet.vertices+roadCount);
  indices.set(series(packet.index,packet.indices,1));
  for (let i=0;i<roadIndices.length;i++) indices[packet.indices+i]=roadIndices[i]+packet.vertices;
  return {xz,heights,roles,indices};

}
let decoded: ReturnType<typeof decode> | undefined;
const data = () => decoded ??= decode();

export function stelenfeldRenderDataV385() {
  const {xz,heights,roles,indices} = data();
  const drawn = new Float32Array(roles.length*3), native = new Float32Array(drawn.length);
  for (let i=0; i<roles.length; i++) {
    drawn[3*i]=native[3*i]=460+xz[2*i]/1000-STELENFELD_ANCHOR[0];
    drawn[3*i+2]=native[3*i+2]=550+xz[2*i+1]/1000-STELENFELD_ANCHOR[1];
    drawn[3*i+1]=heights[2*i]/1000-STELENFELD_BASE;
    native[3*i+1]=heights[2*i+1]/1000-STELENFELD_BASE;
  }
  return {drawn,native,indices,roles,roadStart:packet.vertices};
}

let cells: Map<number,number[]> | undefined;
const cell = (mm:number) => Math.floor(mm/4000);
const key = (x:number,z:number) => (x+100)*256+z+100;

/** The same pavement triangles support pedestrians and the free-flight camera.
 * On an existing drawn path the streamed original is 12 mm above the backing. */
export function stelenfeldRimGroundAtV385(x: number,z: number,native: boolean): number | null {
  if(x<378 || x>581 || z<471 || z>662) return null;
  const {xz,heights,roles,indices} = data();
  if (!cells) {
    cells=new Map();
    for (let i=0; i<indices.length; i+=3) {
      if (i>=packet.endSurface && i<packet.indices) continue;
      const a=2*indices[i], b=2*indices[i+1], c=2*indices[i+2];
      const minX=cell(Math.min(xz[a],xz[b],xz[c])), maxX=cell(Math.max(xz[a],xz[b],xz[c]));
      const minZ=cell(Math.min(xz[a+1],xz[b+1],xz[c+1])), maxZ=cell(Math.max(xz[a+1],xz[b+1],xz[c+1]));
      for (let xx=minX; xx<=maxX; xx++) for (let zz=minZ; zz<=maxZ; zz++) {
        const k=key(xx,zz), hits=cells.get(k);
        if (hits) hits.push(i); else cells.set(k,[i]);
      }
    }
  }
  const cx=(x-460)*1000, cz=(z-550)*1000;
  const hits=cells.get(key(cell(cx),cell(cz)));
  if (!hits) return null;
  for (const i of hits) {
    const a=2*indices[i], b=2*indices[i+1], c=2*indices[i+2];
    const dx=cx-xz[c], dz=cz-xz[c+1], bx=xz[b]-xz[c], bz=xz[b+1]-xz[c+1];
    const ax=xz[a]-xz[c], az=xz[a+1]-xz[c+1], den=bz*ax-bx*az;
    if (!den) continue;
    const u=(bz*dx-bx*dz)/den, v=(ax*dz-az*dx)/den;
    if (u<-.000001 || v<-.000001 || u+v>1.000001) continue;
    const m=native?1:0;
    const h=(u*heights[a+m]+v*heights[b+m]+(1-u-v)*heights[c+m])/1000;
    return h+(!native && (roles[a/2]===5 || roles[a/2]===6) ? .012 : 0);
  }
  return null;
}
