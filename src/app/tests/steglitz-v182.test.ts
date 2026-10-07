import { expect, test } from "bun:test";
import { InstancedMesh, LineSegments, Mesh } from "three";
import { createSteglitzV182, createMinecraftSteglitzV182 } from "../src/SteglitzV182";
import { STEGLITZ_V182_PARTS, steglitzV182RoofAt } from "../src/steglitzV182Profile";
import evidence from "../src/data/steglitzV182Evidence.json";
import source from "../src/data/steglitzV182Source.json";

function bytes(root: ReturnType<typeof createSteglitzV182>): number {
  let total = 0;
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    for (const attribute of Object.values(o.geometry.attributes)) total += attribute.array.byteLength;
    if (o.geometry.index) total += o.geometry.index.array.byteLength;
    if (o instanceof InstancedMesh) total += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
  });
  return total;
}

function dispose(root: ReturnType<typeof createSteglitzV182>): void {
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    o.geometry.dispose();
    for (const material of new Set([...(Array.isArray(o.material) ? o.material : [o.material]), o.userData.dayMaterial, o.userData.nightMaterial])) material?.dispose();
  });
}

test("Steglitz retains all 71 LoD2 parts, three distinct Kreisel solids and only the actual memorial", () => {
  expect(evidence.owners.filter(o => "parts" in o).reduce((n,o) => n + (o.parts ?? 0), 0)).toBe(71);
  expect(STEGLITZ_V182_PARTS.length).toBe(75);
  for (const [id,height] of [["way/34782008",118.5],["way/34782007",6.5],["way/34782006",28]] as const) {
    const p=STEGLITZ_V182_PARTS.find(p=>p.id===id)!;
    expect(p.topY-p.groundY).toBeCloseTo(height,5);
  }
  expect(STEGLITZ_V182_PARTS.find(p=>p.id==="way/775632534")!.topY).toBe(7.05);
  expect(steglitzV182RoofAt(0,0)).toBeNull();
  // One deep interior source-roof point and an unrelated nearby street.
  const tower=STEGLITZ_V182_PARTS.find(p=>p.id==="way/34782008")!;
  const x=tower.ring.reduce((n,p)=>n+p[0],0)/tower.ring.length;
  const z=tower.ring.reduce((n,p)=>n+p[1],0)/tower.ring.length;
  expect(steglitzV182RoofAt(x,z)).toBeCloseTo(122.05,3);
  expect(steglitzV182RoofAt(-3790,6950)).toBeNull();
});

test("small complete drawn/mobile model and native skin never load photographs or reduce touch detail", () => {
  const drawn=createSteglitzV182(), touch=createSteglitzV182({mobileLike:true}), native=createMinecraftSteglitzV182({mobileLike:true});
  expect(drawn.children.length).toBe(3); expect(native.children.length).toBe(1);
  expect(bytes(drawn)).toBe(bytes(touch));
  expect(bytes(drawn)).toBeLessThan(900_000); expect(bytes(native)).toBeLessThan(2_250_000);
  expect((drawn.children[2] as InstancedMesh).count).toBe(source.boxes.length+source.rods.length);
  const mesh=native.children[0] as InstancedMesh;
  expect(mesh.count).toBe(evidence.nativeRuns);
  for (let i=0;i<mesh.count;i++) {
    const a=mesh.instanceMatrix.array, n=i*16;
    expect([a[n+1],a[n+2],a[n+4],a[n+6],a[n+8],a[n+9]]).toEqual([0,0,0,0,0,0]);
    expect(a[n]).toBeGreaterThan(0); expect(a[n+5]).toBeGreaterThan(0); expect(a[n+10]).toBeGreaterThan(0);
  }
  for (const root of [drawn,touch,native]) {
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBeFalse();
      if (o instanceof Mesh && !Array.isArray(o.material)) expect((o.material as any).map).toBeNull();
    });
    dispose(root);
  }
});
