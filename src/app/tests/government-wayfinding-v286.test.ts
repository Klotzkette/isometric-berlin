import { expect, test } from "bun:test";
import { Box3, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { bakeGovernmentWayfindingV286, createGovernmentWayfindingV286, GOVERNMENT_WAYFINDING_V286 as profile, type GovernmentWayfindingPlacementV286 } from "../src/GovernmentWayfindingV286";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";
const placement = (native: boolean): GovernmentWayfindingPlacementV286 => ({
  native, anchorWorld: [-51.299, 4.12, -51.259],
  directions: { potsdamerTor: -1.60016, hauptbahnhofMoabit: 1.54143, reichstag: -.01987, schoenebergSiegessaeule: 3.12172 },
});
const matrix = new Matrix4();

test("the four photo boards retain all seven destinations, German diacritics and decimal distances", () => {
  expect(profile.boards.flatMap(board => board.rows.map(row => [row.destination, row.distance]))).toEqual([
    ["Hauptbahnhof", "0,6"], ["Moabit", "0,3"], ["Potsdamer Platz", "1,4"], ["Brandenburger Tor", "0,8"],
    ["Reichstag", "0,2"], ["Schöneberg", "3,3"], ["Siegessäule", "1,7"],
  ]);
  expect(profile.boards.map(board => board.key)).toEqual(["hauptbahnhofMoabit", "potsdamerTor", "reichstag", "schoenebergSiegessaeule"]);
  expect(profile.photographicPixelsBundled).toBeFalse();
  expect(profile.geometryStatus).toContain("display estimates");
});

test("bake directly supplies finite unit-box buffers to existing batches without DOM, media or duplicate transforms", () => {
  for (const native of [false, true]) {
    const input = placement(native), baked = bakeGovernmentWayfindingV286(input), root = createGovernmentWayfindingV286(input);
    const mesh = root.children[0] as InstancedMesh;
    expect(root.children).toHaveLength(1);
    expect(mesh.instanceMatrix.array).toEqual(baked.matrices);
    expect(mesh.instanceColor!.array).toEqual(baked.colors);
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(baked.metadata.anchorWorld).toEqual(input.anchorWorld);
    const sourceDirection = { ...input.directions };
    expect(baked.metadata.directions).toEqual(sourceDirection);
    expect(baked.metadata.directions).not.toBe(input.directions);
    expect([...baked.matrices, ...baked.colors].every(Number.isFinite)).toBeTrue();
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect((mesh.material as MeshBasicMaterial).map).toBeNull();
    for (const object of [root, mesh]) expect(object.matrixAutoUpdate).toBeFalse();
    expect(baked.metadata.roles.filter(role => role === "white fingerboard")).toHaveLength(4);
    expect(baked.metadata.roles.some(role => role.includes(native ? "pixel run" : "lettering"))).toBeTrue();
    mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBeCloseTo(input.anchorWorld[0], 5);
    expect(matrix.elements[14]).toBeCloseTo(input.anchorWorld[2], 5);
    expect(matrix.elements[13] - input.anchorWorld[1]).toBeCloseTo(profile.estimatedPostHeightM / 2, 5);
    const audit = staticGeometryAudit(root);
    expect(audit.budget.draws).toBe(1);
    expect(audit.budget.bytes).toBeLessThan(native ? 150_000 : 130_000);
    expect(audit.budget.instances).toBeLessThan(profile.instanceLimits[native ? "native" : "drawn"]);
    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.y).toBeCloseTo(input.anchorWorld[1], 5);
    expect(bounds.max.y - input.anchorWorld[1]).toBeLessThan(4.32);
    disposeStaticAudit(root);
  }
});

test("native uses only independent cardinal axis boxes and all four board tips preserve the intended direction", () => {
  for (const native of [false, true]) {
    const input = placement(native), baked = bakeGovernmentWayfindingV286(input);
    let boardIndex = 0;
    for (let i = 0; i < baked.metadata.roles.length; i++) {
      matrix.fromArray(baked.matrices, i * 16);
      if (native) for (const at of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[at]).toBe(0);
      if (baked.metadata.roles[i] !== "white fingerboard") continue;
      const board = profile.boards[boardIndex++], expectedYaw = input.directions[board.key];
      const x = matrix.elements[12] - input.anchorWorld[0], z = matrix.elements[14] - input.anchorWorld[2];
      const direction = new Vector3(x, 0, z).normalize();
      const intended = new Vector3(Math.cos(expectedYaw), 0, -Math.sin(expectedYaw));
      expect(direction.dot(intended)).toBeGreaterThan(native ? .999 : .999999);
      expect(matrix.elements[13] - input.anchorWorld[1]).toBeCloseTo(board.heightM, 5);
    }
    expect(boardIndex).toBe(4);
  }
});

test("text, bicycle and chevron geometry sits outside both white faces, with arrows at the actual distal end", () => {
  const green = new Color(0x2f765a);
  for (const native of [false, true]) {
    const input = placement(native), baked = bakeGovernmentWayfindingV286(input), root = createGovernmentWayfindingV286(input);
    const mesh = root.children[0] as InstancedMesh;
    root.updateMatrixWorld(true);
    const sampled = new Set<string>();
    let chevrons = 0;
    for (let i = 0; i < mesh.count; i++) {
      const role = baked.metadata.roles[i];
      if (!(role.includes("lettering") || role.includes("pixel run") || role.includes("chevron") || role.includes("bicycle"))) continue;
      mesh.getMatrixAt(i, matrix);
      const point = new Vector3().setFromMatrixPosition(matrix);
      const board = profile.boards.reduce((best, candidate) => Math.abs(point.y - input.anchorWorld[1] - candidate.heightM) < Math.abs(point.y - input.anchorWorld[1] - best.heightM) ? candidate : best);
      let yaw = input.directions[board.key]; if (native) yaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
      const dx = point.x - input.anchorWorld[0], dz = point.z - input.anchorWorld[2];
      const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw), localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      expect(Math.abs(localZ)).toBeGreaterThan(native ? .04 : .025);
      if (role.includes("chevron")) { expect(localX).toBeGreaterThan(1.68); chevrons++; }
      const key = `${board.key}/${Math.sign(localZ)}/${role}`;
      if (sampled.has(key)) continue;
      sampled.add(key);
      const normal = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(Math.sign(localZ));
      const hit = new Raycaster(point.clone().addScaledVector(normal, .20), normal.clone().negate(), 0, .30).intersectObject(mesh)[0];
      expect(hit).toBeDefined();
      const color = new Color(); mesh.getColorAt(hit.instanceId!, color);
      expect(color.r).toBeCloseTo(green.r, 6); expect(color.g).toBeCloseTo(green.g, 6); expect(color.b).toBeCloseTo(green.b, 6);
    }
    expect(chevrons).toBe(native ? 80 : 16);
    expect(sampled.size).toBeGreaterThanOrEqual(24);
    disposeStaticAudit(root);
  }
});

test("missing or non-finite placement cannot allocate an unaudited sign", () => {
  expect(() => bakeGovernmentWayfindingV286({ ...placement(false), anchorWorld: [NaN, 4, 0] })).toThrow();
  expect(() => bakeGovernmentWayfindingV286({ ...placement(true), directions: { ...placement(true).directions, reichstag: Infinity } })).toThrow();
  const wrongKeys = { potsdamerTor: 0, hauptbahnhofMoabit: 1, reichstag: 2, typo: 3 };
  expect(() => bakeGovernmentWayfindingV286({ ...placement(false), directions: wrongKeys as any })).toThrow();
});


test("every actual letter stroke/pixel stays on its board and clear of distance, bicycle and arrow zones on both faces", () => {
  const corners = [-.5,.5].flatMap(x=>[-.5,.5].flatMap(y=>[-.5,.5].map(z=>new Vector3(x,y,z))));
  for(const native of[false,true]) {
    const input=placement(native),baked=bakeGovernmentWayfindingV286(input);
    const boxFor=(start:number,count:number,yaw:number)=>{
      const box=new Box3();
      const inverse=new Matrix4().makeRotationY(-yaw).multiply(new Matrix4().makeTranslation(-input.anchorWorld[0],-input.anchorWorld[1],-input.anchorWorld[2]));
      for(let i=start;i<start+count;i++) {
        matrix.fromArray(baked.matrices,i*16).premultiply(inverse);
        for(const corner of corners)box.expandByPoint(corner.clone().applyMatrix4(matrix));
      }
      return box;
    };
    expect(baked.metadata.labels).toHaveLength(28);
    for(const anchor of baked.metadata.labels) {
      const board=profile.boards.find(board=>board.key===anchor.boardKey)!;
      let yaw=input.directions[anchor.boardKey];if(native)yaw=Math.round(yaw/(Math.PI/2))*(Math.PI/2);
      const box=boxFor(anchor.start,anchor.count,yaw);
      expect(box.min.x).toBeGreaterThan(.105);
      expect(box.max.x).toBeLessThan(1.46);
      expect(box.min.y).toBeGreaterThan(board.heightM-.18);
      expect(box.max.y).toBeLessThan(board.heightM+.18);
      const sameRow=baked.metadata.labels.find(other=>other.boardKey===anchor.boardKey&&other.face===anchor.face&&other.kind!==anchor.kind&&Math.abs(boxFor(other.start,other.count,yaw).min.y-box.min.y)<.03)!;
      expect(sameRow).toBeDefined();
      const other=boxFor(sameRow.start,sameRow.count,yaw);
      expect(Math.max(other.min.x-box.max.x,box.min.x-other.max.x)).toBeGreaterThan(.006);
      const bikeIds=baked.metadata.roles.flatMap((role,i)=>role.includes("bicycle")?[i]:[]);
      for(const i of bikeIds) {
        const bike=boxFor(i,1,yaw);
        // Only the matching board and side can share a physical text row.
        if(Math.abs((bike.min.y+bike.max.y)/2-board.heightM)>.12)continue;
        const z=(bike.min.z+bike.max.z)/2;
        if(Math.abs(z)>.07||Math.sign(z)!==anchor.face)continue;
        expect(bike.min.x-box.max.x).toBeGreaterThan(.014);
      }
    }
  }
});
