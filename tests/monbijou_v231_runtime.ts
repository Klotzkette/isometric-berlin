import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Raycaster, Vector3, InstancedMesh, Mesh } from "../src/app/node_modules/three/build/three.module.js";
import { createMonbijouV231 } from "../src/app/src/MonbijouV231";
import { isMonbijouBenchV231, isMonbijouBridgeClusterV231, MONBIJOU_V231_PREVIOUS, createMonbijouGroundCellTesterV231 } from "../src/app/src/monbijouPreviousV231";
import { monbijouV231DeckAt, monbijouV231GroundAt, monbijouV231SolidAt } from "../src/app/src/monbijouV231Navigation";
import nav from "../src/app/src/data/monbijouV231Navigation.json";
import nativeData from "../src/app/src/data/monbijouV231Native.json";
import { parkStaticGeometrySteps, parkStaticInstancesSteps } from "../src/app/src/losslessStaticStorage";

const ground = JSON.parse(readFileSync("src/app/public/mesh/regierungsviertel/ground-context.json", "utf8"));
for (const cluster of MONBIJOU_V231_PREVIOUS.clusters) {
  assert(isMonbijouBridgeClusterV231(ground, cluster.cells));
  assert(isMonbijouBridgeClusterV231(ground, [...cluster.cells].reverse()));
  assert(!isMonbijouBridgeClusterV231(ground, cluster.cells.slice(1)));
  assert(!isMonbijouBridgeClusterV231(ground, [...cluster.cells, cluster.cells[0]]));
  assert(!isMonbijouBridgeClusterV231(ground, cluster.cells.map(([x,z],i)=>[x+(i===0?1:0),z])));
}
assert(Object.isFrozen(MONBIJOU_V231_PREVIOUS.benches[0].tags));
for (const p of MONBIJOU_V231_PREVIOUS.benches) {
  assert(isMonbijouBenchV231(p));
  assert(!isMonbijouBenchV231({...p,x:p.x+.001}));
  assert(!isMonbijouBenchV231({...p,tags:{...p.tags,unexpected:"changed"}}));
}
const ySample = MONBIJOU_V231_PREVIOUS.ground.heightSamples[0][0];
ground.ground_height.y_dm[ySample]++;
assert(!isMonbijouBridgeClusterV231(ground, MONBIJOU_V231_PREVIOUS.clusters[0].cells));
ground.ground_height.y_dm[ySample]--;
const cold = JSON.parse(readFileSync("src/app/public/mesh/regierungsviertel/minecraft-voxels.json", "utf8"));
for (const payload of [ground,cold]) {
  const tester = createMonbijouGroundCellTesterV231(payload);
  for (const cluster of MONBIJOU_V231_PREVIOUS.clusters) {
    assert(isMonbijouBridgeClusterV231(payload,cluster.cells));
    for (const [x,z] of cluster.cells) assert(tester((payload.grid.min_x_idx+x+.5)*4,(payload.grid.min_z_idx+z+.5)*4));
  }
  assert(!tester(1400,-400));
}
// A newly connected source cell invalidates only its own complete old cluster.
const [hx,hz]=MONBIJOU_V231_PREVIOUS.clusters[0].cells[0];
const oldRow=ground.ground_rows[hz];
ground.ground_rows[hz]=[...oldRow,[hx-1,1,MONBIJOU_V231_PREVIOUS.ground.bridgeClass]];
assert(!createMonbijouGroundCellTesterV231(ground)((ground.grid.min_x_idx+hx+.5)*4,(ground.grid.min_z_idx+hz+.5)*4));
ground.ground_rows[hz]=oldRow;

const ray = new Raycaster();
let assertions = 0;
for (const native of [false,true]) {
  const root = createMonbijouV231(native); root.updateMatrixWorld(true);
  assert(root.children.length === 5);
  if (native) for (const m of root.children as InstancedMesh[]) {
    const values = m.instanceMatrix.array;
    for (let i=0;i<values.length;i+=16) for (const j of [1,2,4,6,8,9]) assert.equal(values[i+j],0);
  }
  for (const b of nav.bridges) {
    const [a,c] = [b.axis[0],b.axis.at(-1)!];
    for (let i=1;i<40;i++) {
      const f=i/40, x=a[0]+(c[0]-a[0])*f, z=a[1]+(c[1]-a[1])*f;
      const deck=monbijouV231DeckAt(x,z,native); assert(deck!==null);
      ray.set(new Vector3(x,12,z),new Vector3(0,-1,0));
      const hit=ray.intersectObject(root,true).find(h=>h.object.name.includes(native?"source footprint body":"complete bridge envelope"));
      assert(hit,`${b.key} center source hole ${f}`);
      assert(Math.abs(hit.point.y-deck!)<.002,`${b.key} native=${native} nav/render ${hit.point.y}/${deck}`);
      assert.equal(monbijouV231GroundAt(x,z,1,native),null);
      assert.equal(monbijouV231GroundAt(x,z,deck!,native),deck);
      assert(!monbijouV231SolidAt(x,deck!+.85,z,.25,native));
      if (i>12&&i<28) assert(!monbijouV231SolidAt(x,1,z,.1,native),`${b.key} false center pier`);
      assertions++;
    }
    // At the mapped endpoints the bridge approaches the existing bank datum.
    for (const [x,z] of [a,c]) {
      const inside = [.001,.01,.05].map(f=>[x+(b.axis[0][0]+b.axis.at(-1)![0]-2*x)*f,z+(b.axis[0][1]+b.axis.at(-1)![1]-2*z)*f]);
      assert(inside.some(([px,pz])=>{const d=monbijouV231DeckAt(px,pz,native);return d!==null&&d<5.65;}));
    }
  }
  if (native) {
    for (const site of nativeData.sites.filter(s=>s.key!=="park")) for (const [x,y,z,w,h,d] of site.body.filter((_,i)=>i%37===0)) {
      assert.equal(monbijouV231DeckAt(x,z,true),y+h/2);
      assert(monbijouV231SolidAt(x,y,z,0,true));
    }
  }
  // Buffers remain raycastable after the same lossless parking used by runtime.
  root.traverse(o=>{if(o instanceof Mesh)o.geometry.userData.exactIndexPending=false;});
  for (const _ of parkStaticGeometrySteps(root,true)) { /* settle all buffers */ }
  for (const _ of parkStaticInstancesSteps(root)) { /* settle final matrices */ }
  for (const b of nav.bridges) {
    const x=(b.axis[0][0]+b.axis.at(-1)![0])/2,z=(b.axis[0][1]+b.axis.at(-1)![1])/2;
    ray.set(new Vector3(x,1,z),new Vector3(0,1,0));
    const hit=ray.intersectObject(root,true).find(h=>h.object.name.includes(native?"source footprint body":"complete bridge envelope"));
    assert(hit && hit.point.y>3,`false pier after parking ${b.key}`);
    ray.set(new Vector3(x,12,z),new Vector3(0,-1,0));
    const top=ray.intersectObject(root,true).find(h=>h.object.name.includes(native?"source footprint body":"complete bridge envelope"));
    assert(top && Math.abs(top.point.y-monbijouV231DeckAt(x,z,native)!)<.002);
  }
  root.traverse(o=>assert(!("sites" in o.userData) && !("vertices" in o.userData)));
}
console.log(JSON.stringify({centerlineRayAssertions:assertions, benches:MONBIJOU_V231_PREVIOUS.benches.length}));
