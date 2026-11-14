import { expect, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createEastCivicArchitecture, createMinecraftEastCivicArchitecture } from "../src/EastCivicArchitecture";
import { createForeignOfficeV344, FOREIGN_OFFICE_V344_NAME, foreignOfficeV344SourceMatches } from "../src/ForeignOfficeV344";
import { EAST_CIVIC_SOURCES as S, eastCivicWalkableAt } from "../src/eastCivicProfile";
import { perimeterFacadePoint, type PerimeterFacadeEdge } from "../src/GendarmenmarktFacadeBuilder";
import descriptor from "../src/data/foreignOfficeV344.json";

const legacy = createEastCivicArchitecture();
const drawn = createEastCivicArchitecture({ refineForeignOffice: true });
const native = createMinecraftEastCivicArchitecture({ refineForeignOffice: true });
for (const root of [legacy, drawn, native]) root.updateMatrixWorld(true);
const detail = drawn.getObjectByName(FOREIGN_OFFICE_V344_NAME)!;
const nativeDetail = native.getObjectByName(FOREIGN_OFFICE_V344_NAME)!;
function ray(e: PerimeterFacadeEdge, u: number, y: number) {
  const origin = new Vector3(...perimeterFacadePoint(e, u, y, 3));
  const target = new Vector3(...perimeterFacadePoint(e, u, y, 0));
  return new Raycaster(origin, target.sub(origin).normalize(), 0, 3.5);
}

test("the continuous new-building glass bands replace isolated generic windows in the actual owner", () => {
  const path = descriptor.paths.find(p => p.key === "new-north")!;
  const e: PerimeterFacadeEdge = { startXZ: path.points[0], endXZ: path.points[1], outwardSide: path.outwardSide,
    wallBaseY: path.base, wallTopY: path.top, street: path.street, prismId: path.part };
  for (const y of [10.95, 14.65, 18.35, 22.05, 25.75]) {
    const hits = ray(e, 3.3, y).intersectObject(drawn, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object.name).toBe(`${FOREIGN_OFFICE_V344_NAME} glass`);
  }
  expect(ray(e, 3.3, 25.75).intersectObject(legacy, true)[0].object.name).not.toContain(FOREIGN_OFFICE_V344_NAME);
  expect(detail.userData.sourcePaths).toHaveLength(6);
});

test("the Reichsbank has a four-level monumental front and five-level curved street elevations", () => {
  const windows = detail.userData.windowProbes as { edge: PerimeterFacadeEdge; center: number[]; width: number; height: number }[];
  const old = windows.filter(p => p.edge.prismId === "DEBE3DgDE9fDmxxs");
  expect([...new Set(old.filter(p => p.edge.street === "Werderscher Markt").map(p => p.center[1]))].sort((a,b)=>a-b))
    .toEqual([11.1, 18.1, 22.8, 27.5]);
  for (const street of ["Kurstraße", "Unterwasserstraße"]) expect([...new Set(old.filter(p => p.edge.street === street).map(p => p.center[1]))].sort((a,b)=>a-b))
    .toEqual([8.3, 13.7, 19.2, 23.7, 28.1]);
  const arcWindows = old.filter(p => p.edge.street !== "Werderscher Markt" && Math.hypot(p.edge.endXZ[0]-p.edge.startXZ[0],p.edge.endXZ[1]-p.edge.startXZ[1]) < 8);
  expect(arcWindows.length).toBeGreaterThan(100);
  let visible = 0;
  for (const p of arcWindows) {
    const e = p.edge, dx=e.endXZ[0]-e.startXZ[0],dz=e.endXZ[1]-e.startXZ[1],length=Math.hypot(dx,dz);
    const u=((p.center[0]-e.startXZ[0])*dx+(p.center[2]-e.startXZ[1])*dz)/length;
    const hits=ray(e,u+p.width*.15,p.center[1]+p.height*.12).intersectObject(drawn,true);
    if(hits[0]?.object.name===`${FOREIGN_OFFICE_V344_NAME} glass`) visible++;
  }
  expect(visible / arcWindows.length).toBeGreaterThan(.94);
});

test("Native uses independently cardinal fittings on the columns actually emitted, including glass and curve steps", () => {
  expect(native.userData.foreignOfficeV344).toBeTrue();
  for (const count of Object.values(nativeDetail.userData.nativeFaceCounts) as number[]) expect(count).toBeGreaterThan(10);
  const m = new Matrix4();
  nativeDetail.traverse(o => {
    if (!(o instanceof InstancedMesh)) return;
    for(let i=0;i<o.count;i++) {
      o.getMatrixAt(i,m);
      for(const column of [0,4,8]) expect([m.elements[column],m.elements[column+1],m.elements[column+2]].filter(v=>Math.abs(v)>1e-5)).toHaveLength(1);
    }
  });
  const faces = nativeDetail.userData.nativeFaceProbes as { edge: PerimeterFacadeEdge; column: {x:number;z:number;top:number;wallBase:number} }[];
  for(const {edge:e,column:c} of faces) {
    const x=(e.startXZ[0]+e.endXZ[0])/2,z=(e.startXZ[1]+e.endXZ[1])/2;
    expect(Math.abs(x-c.x)+Math.abs(z-c.z)).toBeCloseTo(1,6);
    expect(e.wallBaseY).toBeGreaterThanOrEqual(c.wallBase);
    expect(e.wallTopY).toBeCloseTo(c.top-.44,6);
  }
  // No independent arbitrary source polygon can claim to be a Native shell receipt.
  expect(createForeignOfficeV344(true, [])).toBeNull();
});

test("all original source sheets remain unchanged and the open loggia and lower atrium remain visible", () => {
  for (let i=0;i<4;i++) {
    const before=legacy.children[i] as Mesh,after=drawn.children[i] as Mesh;
    expect(after.name).toBe(before.name);
    expect(after.geometry.getAttribute("position").array).toEqual(before.geometry.getAttribute("position").array);
    expect(after.geometry.index?.array).toEqual(before.geometry.index?.array);
  }
  for(const root of [drawn,native]) {
    expect(root.userData.sourcePartIds).toEqual(descriptor.expectedParts);
    expect(new Raycaster(new Vector3(1920,7,434),new Vector3(-1,0,0),0,7).intersectObject(root,true)).toHaveLength(0);
    const roof=new Raycaster(new Vector3(1884,40,436),new Vector3(0,-1,0),0,20).intersectObject(root,true)[0];
    expect(roof.point.y).toBeGreaterThan(26);expect(roof.point.y).toBeLessThan(27);
  }
  expect(eastCivicWalkableAt(1914,7,436)).toBeTrue();
});

test("stale source changes refuse the new owner and restore the complete legacy fittings", () => {
  expect(foreignOfficeV344SourceMatches()).toBeTrue();
  const p=S[2].parts.find(p=>p.id==="DEBE3DgDE9fDmxxs")!,saved=p.ring[0][0];
  try {
    p.ring[0][0]+=.001;
    expect(foreignOfficeV344SourceMatches()).toBeFalse();
    expect(createForeignOfficeV344()).toBeNull();
    const fallback=createEastCivicArchitecture({refineForeignOffice:true});
    const defaultChanged=createEastCivicArchitecture();
    expect(fallback.userData.foreignOfficeV344).toBeFalse();
    expect(fallback.children.length).toBe(defaultChanged.children.length);
    for(let i=0;i<fallback.children.length;i++) {
      const a=fallback.children[i],b=defaultChanged.children[i];
      if(a instanceof InstancedMesh && b instanceof InstancedMesh) expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array);
    }
  } finally {p.ring[0][0]=saved;}
});

test("all six descriptors retain complete original paths and fit in a finite image-free budget", () => {
  for(const path of descriptor.paths) {
    const p=S.flatMap(s=>s.parts).find(p=>p.id===path.part)!;
    expect(path.points).toEqual(p.ring.slice(path.first,path.last+1));
    expect(path.top).toBe(p.top_y_m);
  }
  const budgets=[];
  for(const root of [drawn,native]) {
    let bytes=0,instances=0,draws=0;const geometries=new Set<BufferGeometry>();
    root.traverse(o=>{
      if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBeFalse();
      expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
      if(!geometries.has(o.geometry)){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;}
      if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}
    });
    budgets.push({draws,instances,bytes});expect(bytes).toBeLessThan(3_200_000);
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
  }
  expect(budgets.map(b=>b.draws)).toEqual([9,3]);
  console.log("foreign-office-v344 total owner budgets",budgets);
});
