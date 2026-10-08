import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import source from "./data/arkonaplatzV193.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { drapeTerrainTriangle, terrainGroundAt } from "./weinbergTerrainV176";

type Row = number[];
export const ARKONAPLATZ_V193_PROFILE = {
  centre: source.parkCentre, marketNode: source.marketNode,
  sourceTrees: source.sourceTreeCount, marketStalls: source.stalls.length,
  nativeGridM: .24, budgetBytes: 1_500_000, maxDrawCalls: 4,
  cameras: {
    overview: { position: [2120, 24, -1980], target: [2120, 8, -2000], spanM: 65 },
    market: { position: [2125, 17.1, -1945], target: [2115, 7.1, -1985], spanM: 65 },
  },
} as const;

/** Source nodes are exact. Untagged size/bearing and movable market furnishings
 * are explicit display estimates, never a claim about today's occupancy. */
export function arkonaplatzV193Rows(native = false): { props: Row[]; trunks: Row[]; crowns: Row[]; market: Row[]; supports: Row[] } {
  const props: Row[] = [], trunks: Row[] = [], crowns: Row[] = [], market: Row[] = [], supports: Row[] = [];
  const ground = (x: number, z: number) => terrainGroundAt(x, z, 3, native);
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, color: number) => {
    props.push([x, y, z, w, h, d, yaw, color]);
  };
  for (const [i, tree] of source.trees.entries()) {
    if (native && i % 2) continue; // established owner-requested sparse Minecraft trees
    const [x, z] = tree.xz, y = ground(x, z), h = 9.6 + i % 3 * .8;
    const color = [0x5c793c, 0x688644, 0x527236, 0x70894b][i % 4];
    trunks.push([x, y + h * .28, z, .32, h * .56, .32, 0, 0x786851]);
    if (native) {
      crowns.push([x, y + h * .73, z, 4.5, h * .47, 4.5, 0, color]);
      crowns.push([x, y + h * .91, z, 3.3, h * .28, 3.3, 0, color]);
    } else {
      for (const [dx, dz, dy, r] of [[0,0,.76,5.7],[-1.1,.4,.70,4.6],[.8,-.8,.84,4.9]])
        crowns.push([x + dx, y + h * dy, z + dz, r, h * .57, r, 0, color]);
    }
  }
  for (const bench of source.benches) {
    const [x, z] = bench.xz, y = ground(x, z) + .13, c = Math.cos(bench.yaw), s = Math.sin(bench.yaw);
    for (const offset of [-.16, 0, .16]) box(x + s * offset, y + .45, z + c * offset, 1.75, .08, .13, bench.yaw, 0x887753);
    for (const h of [.75, .94]) box(x + s * .22, y + h, z + c * .22, 1.75, .13, .07, bench.yaw, 0x887753);
    for (const u of [-.60, .60]) box(x + c * u, y + .24, z - s * u, .08, .48, .46, bench.yaw, 0x555f52);
  }
  // Exact C-shaped planted-bed rings; only narrow edging, never a new square slab.
  for (const bed of source.beds) for (let i = 1; i < bed.ring.length; i++) {
    const a = bed.ring[i-1], b = bed.ring[i], dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx,dz);
    const n = Math.max(1, Math.ceil(length / 2));
    for (let j = 0; j < n; j++) {
      const t = (j+.5)/n, x = a[0]+dx*t, z = a[1]+dz*t;
      box(x, ground(x,z)+.15, z, length/n+.015, .16, .13, -Math.atan2(dz,dx), 0xb2aa95);
    }
  }
  for (const stall of source.stalls) {
    const [x,z] = stall.xz, y = ground(x,z)+.13, c = Math.cos(stall.yaw), s = Math.sin(stall.yaw), id = stall.id;
    const put = (u:number, h:number, v:number, w:number, sy:number, d:number, color:number) => {
      box(x+c*u+s*v, y+h, z-s*u+c*v, w, sy, d, stall.yaw, color);
      market.push(props[props.length-1]);
    };
    const support = (u:number, v:number, topOffset:number, width:number, color:number) => {
      const px=x+c*u+s*v,pz=z-s*u+c*v;
      const bottom=ground(px,pz)+(native?.08:.07),top=y+topOffset;
      box(px,(bottom+top)/2,pz,width,top-bottom,width,stall.yaw,color);
      const row=props[props.length-1];market.push(row);supports.push(row);
    };
    const wood = [0x927859,0xa48961,0x8d7352][id%3], steel = 0x777d75;
    put(0,.80,0,2.9,.11,.9,wood);
    for(const u of [-1.22,1.22]) for(const v of [-.33,.33]) support(u,v,.78,.065,steel);
    // Alternate open tables and light fabric canopies seen in the free reference.
    if(id%3!==1) {
      const cloth = [0xd9d4bd,0xc5c9b8,0xe0ddd1,0x9cae9a][id%4];
      for(const u of [-1.46,1.46]) for(const v of [-.84,.84]) support(u,v,2.36,.055,steel);
      for(let j=0;j<8;j++) {const v=(j+.5)*1.86/8-.93;
        put(0,2.39+.17*(1-Math.abs(v)/.93),v,3.10,.055,1.86/8+.014,cloth);}
      for(const v of [-.91,.91]) put(0,2.30,v,3.10,.16,.045,cloth);
    }
    // Independent geometric stock: books/records, picture frames and old radios.
    // No copied image, writing or product texture is stored.
    if(id%3===0) {
      for(const u of [-.86,.05,.90]) {
        put(u,.94,0,.70,.20,.56,0x91795c);
        for(let k=0;k<5;k++) put(u-.24+k*.12,1.12,0,.075,.26,.40,[0x927963,0xd3c59e,0x657965,0xa0857a,0x6f7f8b][k]);
      }
    } else if(id%3===1) {
      for(const u of [-.82,.08]) {
        put(u,1.09,0,.70,.48,.35,0x79684d);
        put(u,1.10,-.185,.49,.24,.024,0xaaa28a);
        for(const dx of [-.21,.21]) put(u+dx,.94,-.20,.07,.07,.04,0x4e5350);
      }
      put(.95,.91,0,.45,.14,.38,0xa78d70);
    } else {
      for(const u of [-.91,0,.91]) {
        put(u,1.13,.08,.66,.55,.08,wood);
        put(u,1.13,.025,.52,.41,.03,[0xaaa884,0x9ea6a0,0xc6bd9e][Math.abs(Math.round(u*10))%3]);
        put(u,.89,-.25,.35,.12,.24,0xd4c9aa);
      }
    }
  }
  return {props,trunks,crowns,market,supports};
}

export function arkonaplatzV193PavingPositions(): number[] {
  const positions:number[]=[];
  for(const rings of source.pavingRings) {
    const vectors=rings.map(r=>r.slice(0,-1).map(p=>new Vector2(p[0],p[1]))),flat=vectors.flat();
    for(const face of ShapeUtils.triangulateShape(vectors[0],vectors.slice(1))) {
      const triangle=face.map(i=>[flat[i].x,3.07,flat[i].y] as [number,number,number]);
      for(const tri of drapeTerrainTriangle(triangle)) {
        // Source triangulation is in X/Z; reverse its winding for upward normals.
        const [a,b,c]=tri;
        const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
        for(const p of up>=0?tri:[a,c,b])positions.push(...p);
      }
    }
  }
  return positions;
}

export function arkonaplatzV193NativePavingRows(): Row[] {
  const bands=new Map<number,number[]>(),rows:Row[]=[];
  for(const [x,z] of source.nativePavingCentres) {
    const band=bands.get(z)??[];band.push(x);bands.set(z,band);
  }
  for(const [z,xs] of bands) {
    xs.sort((a,b)=>a-b);let start=xs[0],end=start,y=terrainGroundAt(start,z,3,true);
    const emit=()=>rows.push([(start+end)/2,y+.04,z,end-start+.5,.08,.5,0xaaa699]);
    for(const x of xs.slice(1)) {
      const nextY=terrainGroundAt(x,z,3,true);
      if(Math.abs(x-end-.5)<1e-8&&Math.abs(nextY-y)<1e-8)end=x;
      else {emit();start=end=x;y=nextY;}
    }
    emit();
  }
  return rows;
}

/** World-axis native members; volume is sampled once into exact final buffers. */
export function arkonaplatzV193NativeRows(rows: readonly Row[]): Row[] {
  const grid = ARKONAPLATZ_V193_PROFILE.nativeGridM, cells = new Map<string,Row>();
  for(const r of rows) {
    const counts=r.slice(3,6).map(v=>Math.max(1,Math.ceil(v/grid))), c=Math.cos(r[6]),s=Math.sin(r[6]);
    for(let i=0;i<counts[0];i++)for(let j=0;j<counts[1];j++)for(let k=0;k<counts[2];k++) {
      const u=((i+.5)/counts[0]-.5)*r[3],v=((k+.5)/counts[2]-.5)*r[5];
      const x=r[0]+c*u+s*v,z=r[2]-s*u+c*v,y=r[1]+((j+.5)/counts[1]-.5)*r[4];
      const key=[x,y,z].map(n=>Math.round(n/grid));
      cells.set(key.join(','),[...key.map(n=>n*grid),grid,grid,grid,r[7]]);
    }
  }
  return [...cells.values()];
}

export function createArkonaplatzV193(minecraft = false): Group {
  const root = new Group(); root.name = "Arkonaplatz mapped trees and representative flea market v193";
  root.userData = { arkonaplatzV193: true, textureFree: true, blockNative: minecraft,
    keepInMinecraft: minecraft, fullStaticDetailOnTouch: true, sourceGeometryRetained: true,
    representativeMarket: true, terrainAware: true };
  const {props,trunks,crowns} = arkonaplatzV193Rows(minecraft);
  const details = justicePalaceV183Boxes(minecraft ? arkonaplatzV193NativeRows(props) : props,minecraft);
  details.name="Source benches, planted-bed edges and representative Sunday stalls";
  const nativeRows=(rows:Row[])=>rows.map(r=>[...r.slice(0,6),r[7]]);
  const stems=justicePalaceV183Boxes(minecraft?nativeRows(trunks):trunks,minecraft);
  stems.name="Previously absent source-mapped Arkonaplatz tree trunks";
  const leaves=justicePalaceV183Boxes(minecraft?nativeRows(crowns):crowns,minecraft);
  leaves.name="Source-mapped tree crowns with estimated dimensions";
  if(!minecraft) {
    leaves.geometry.dispose();leaves.geometry=new IcosahedronGeometry(.5,1);leaves.geometry.deleteAttribute('uv');
    leaves.computeBoundingBox();leaves.computeBoundingSphere();
  }
  root.add(details,stems,leaves);
  if(minecraft) {
    const paving=justicePalaceV183Boxes(arkonaplatzV193NativePavingRows(),true);
    paving.name="Source-clipped central market paving, native terraces";root.add(paving);
  } else {
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(arkonaplatzV193PavingPositions(),3));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({color:0xaaa699,side:DoubleSide}),night=new MeshStandardMaterial({color:0xaaa699,side:DoubleSide,roughness:1});
    const paving=new Mesh(geometry,day);paving.name="Source-clipped central market paving, exact draped outline";
    paving.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(paving);
  }
  return freezeStaticSceneTransforms(root);
}
