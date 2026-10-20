import data from "./data/westShopfrontsV254.json";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

type Plan = { origin: number[]; guards: { mesh: number; kind: string; fingerprint: number }[]; fields: number[][] };
export type WestShopfrontSourceV254 = { schema: number; ids: string[]; packets: Record<string, Plan> };
const source = data as WestShopfrontSourceV254;
const known = /* @__PURE__ */ (() => new Set(source.ids))();
const KIND = "west-shopfronts-v254";
const ALLOWED = new Set(["city-west-street-fronts-v163", "tauentzien-street-fronts-v165", "district-facades-v188"]);
const linear = (rgb: number[]) => rgb.map(v => Math.round((v <= 10.31475 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4) * 255));
const FRAME = linear([173, 179, 170]), EDGE = linear([208, 211, 196]), BASE = linear([71, 82, 79]);
function encoded(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function* fingerprint(parts: string[]): Generator<void, number> {
  let value = 2166136261;
  for (const text of parts) for (let start = 0; start < text.length; start += 65536) {
    for (let i = start; i < Math.min(text.length, start + 65536); i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    yield;
  }
  return value;
}

/** Narrow fittings inside exact old openings, retaining all prior panes/axes.
 * Shares normal packet decoding, upload, parking and disposal on every device.
 * Native plans come from delivered orthogonal faces, not rotated drawn quads. */
export function* prepareWestShopfrontsV254(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: WestShopfrontSourceV254 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if (evidence === source && !known.has(key)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key) || chunk.meshes.some(p => p.kind === KIND)) return chunk;
  const plan = evidence.packets[key];
  if (evidence.schema !== 1 || plan.origin.length !== 3 || plan.origin.some((v,i) => v !== chunk.origin[i]) ||
      !plan.fields.length || plan.fields.length > 1000 || !plan.guards.length) return chunk;
  for (const g of plan.guards) {
    const p = chunk.meshes[g.mesh];
    if (!p || p.kind !== g.kind || !ALLOWED.has(p.kind) ||
        (yield* fingerprint([p.positions,p.colors,p.indices])) !== g.fingerprint) return chunk;
  }
  for (const p of plan.fields) {
    if (p.length !== 10 || !p.every(Number.isFinite) || p[7] < .3 || p[7] > 3 || p[8] < 1 || p[8] > 3 ||
        Math.abs(Math.hypot(p[3],p[4])-1) > .000001 || Math.abs(Math.hypot(p[5],p[6])-1) > .000001 ||
        Math.abs(p[3]*p[5]+p[4]*p[6]) > .000001 || (native && !(p[3] === 0 || p[4] === 0)) ||
        ![0,1,2].includes(p[9])) return chunk;
  }
  // Eight reveal/frame quads, plus split kickplates/transom only for commercial
  // openings. Splitting leaves the earlier central mullion fully visible.
  const quadCount = plan.fields.reduce((n,p) => n + (p[9] === 1 ? 8 : 12), 0);
  const positions = new Uint16Array(quadCount*12), colors = new Uint8Array(quadCount*12);
  const indices = new Uint32Array(quadCount*6);
  let vertex=0, index=0, valid=true;
  for (let field=0; field<plan.fields.length; field++) {
    const [x,y,z,ux,uz,nx,nz,width,height,role] = plan.fields[field];
    const quad = (corners: number[][], color: number[]) => {
      const first=vertex;
      for (const [u,v,depth] of corners) {
        const point=[x+ux*u+nx*depth,y+v,z+uz*u+nz*depth];
        for (let axis=0;axis<3;axis++) {
          const value=Math.round(point[axis]*100);
          if(value<0||value>65535)valid=false;
          positions[vertex*3+axis]=value;colors[vertex*3+axis]=color[axis];
        }
        vertex++;
      }
      for(const offset of [0,1,2,0,2,3])indices[index++]=first+offset;
    };
    const pane=(l:number,b:number,r:number,t:number,c:number[]) =>
      quad([[l,b,.09],[r,b,.09],[r,t,.09],[l,t,.09]],c);
    // v235 owns the outer 5.5cm reveal; keep these inner fittings clear of it.
    const a=width/2-.09,b=height/2-.09,trim=.045;
    pane(-a,-b,-a+trim,b,FRAME);pane(a-trim,-b,a,b,FRAME);
    pane(-a,b-trim,a,b,EDGE);pane(-a,-b,a,-b+trim,FRAME);
    quad([[-a,-b,.07],[-a,b,.07],[-a,b,.09],[-a,-b,.09]],FRAME);
    quad([[a,b,.07],[a,-b,.07],[a,-b,.09],[a,b,.09]],FRAME);
    quad([[-a,b,.07],[a,b,.07],[a,b,.09],[-a,b,.09]],EDGE);
    quad([[a,-b,.07],[-a,-b,.07],[-a,-b,.09],[a,-b,.09]],FRAME);
    if(role!==1){
      const transom=b-.36;
      for(const [l,r] of [[-a+trim,-.065],[.065,a-trim]]){
        pane(l,-b+trim,r,-b+.20,BASE);
        pane(l,transom-.025,r,transom+.025,FRAME);
      }
    }
    if(field%32===31)yield;
  }
  if(!valid)return chunk;
  const part: SurroundingPackedMesh={kind:KIND,positionType:"u16cm",positions:encoded(positions),colors:encoded(colors),indices:encoded(indices)};
  return {...chunk,meshes:[...chunk.meshes,part]};
}
