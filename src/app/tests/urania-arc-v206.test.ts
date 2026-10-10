import { expect, test } from "bun:test";
import { InstancedMesh, Mesh, Vector3 } from "three";
import { createUraniaArcV206, URANIA_ARC_V206_GROUP } from "../src/UraniaArcV206";
import { createUraniaSourceRoofV188 } from "../src/UraniaLuetzowV188";
import source from "../src/data/uraniaArcV206.json";
import { uraniaArcV206RoofAt, uraniaArcV206SolidAt, uraniaArcV206SourceColumn,
  URANIA_ARC_V206_PRISM_ID, URANIA_ARC_V206_NAVIGATION_PARTS } from "../src/uraniaArcV206Navigation";
import navigation from "../src/data/uraniaArcV206Navigation.json";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";

function bytes(mesh: Mesh): number {
  let total = Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0);
  total += mesh.geometry.index?.array.byteLength ?? 0;
  if (mesh instanceof InstancedMesh) total += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
  return total;
}

test("two local Urania/arc batches use final-size buffers in both representations", () => {
  for (const native of [false,true]) {
    const root = createUraniaArcV206(native);
    expect(root.name).toBe(URANIA_ARC_V206_GROUP);
    expect(root.children).toHaveLength(2);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.exactOwnerReplacement).toBe("11687794");
    let total = 0;
    root.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof Mesh)) return;
      total += bytes(o);
      expect(o.frustumCulled).toBe(true);
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      expect(o.userData.dayMaterial).toBeTruthy();
      expect(o.userData.nightMaterial).toBeTruthy();
      const sphere = o instanceof InstancedMesh ? o.boundingSphere : o.geometry.boundingSphere;
      expect(sphere!.radius).toBeLessThan(50);
      if (o instanceof InstancedMesh) {
        expect(o.instanceMatrix.count).toBe(o.count);
        expect(o.instanceColor!.count).toBe(o.count);
        if (native) for (let i=0;i<o.count;i++) {
          for (const k of [1,2,4,6,8,9]) expect(o.instanceMatrix.array[i*16+k]).toBe(0);
        }
      }
    });
    expect(total).toBeLessThan(native ? 600_000 : 300_000);
    expect(root.children[0].children).toHaveLength(native ? 1 : 3);
    expect(root.children[1].children).toHaveLength(1);
  }
});

test("the original higher source roof is reused with identical position/index/normal buffers", () => {
  const previous = createUraniaSourceRoofV188();
  const next = createUraniaArcV206().children[0].children[2] as Mesh;
  expect(next.name).toBe(previous.name);
  for (const name of Object.keys(previous.geometry.attributes)) {
    expect(Array.from(next.geometry.attributes[name].array)).toEqual(Array.from(previous.geometry.attributes[name].array));
  }
  expect(Array.from(next.geometry.index!.array)).toEqual(Array.from(previous.geometry.index!.array));
});

test("photographed mixed-case lettering reads left to right from the outside", () => {
  const site = source.sites[0];
  const face = site.facades![0];
  const tangent = new Vector3(face.b[0]-face.a[0],0,face.b[1]-face.a[1]).normalize();
  const outward = new Vector3(tangent.z,0,-tangent.x);
  const screenRight = new Vector3(0,1,0).cross(outward);
  for (const [text, color] of [["UraniaBerlin",0x303438],["Denksporthalle",0xf0e7dc]] as const) {
    const sign = site.signs!.find(s => s.text === text)!;
    const triangles = site.triangles.filter(t => t.kind === "sign-lettering" && t.color === color);
    const first = new Vector3().fromArray(triangles[0].points[0]);
    const last = new Vector3().fromArray(triangles.at(-1)!.points[0]);
    expect(last.sub(first).dot(screenRight)).toBeGreaterThan(sign.width-1);
    expect(sign.text).toBe(text);
  }
});

test("lightweight collision opens the recess but retains interior, pillars and full roofs", () => {
  expect(URANIA_ARC_V206_PRISM_ID).toBe("11687794");
  expect(URANIA_ARC_V206_NAVIGATION_PARTS).toHaveLength(16);
  const face = source.sites[0].facades![0], a=face.a, b=face.b;
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const tx=(b[0]-a[0])/length, tz=(b[1]-a[1])/length;
  const point=(u:number,inside:number)=>[a[0]+tx*u-tz*inside,a[1]+tz*u+tx*inside];
  const open=point(18.7,.85), interior=point(18.7,2.3), column=point(.95,.26);
  expect(uraniaArcV206SolidAt(open[0],6.8,open[1])).toBe(false);
  expect(uraniaArcV206SolidAt(open[0],10,open[1])).toBe(true);
  expect(uraniaArcV206SolidAt(interior[0],6.8,interior[1])).toBe(true);
  expect(uraniaArcV206SolidAt(column[0],6.8,column[1])).toBe(true);
  expect(uraniaArcV206RoofAt(open[0],open[1])).toBe(19.935);
  expect(uraniaArcV206RoofAt(-1618,1890)).toBe(14.088);
  expect(uraniaArcV206RoofAt(-1700,1900)).toBeNull();
});

test("only the exact 86 prior Urania voxel tuples yield to the native model", () => {
  expect(navigation.legacyVoxelColumns).toHaveLength(86);
  for (const [xi,zi,y0,y1] of navigation.legacyVoxelColumns) {
    expect(uraniaArcV206SourceColumn(xi*4+2,zi*4+2,y0/10,y1/10)).toBe(true);
    expect(uraniaArcV206SourceColumn(xi*4+2,zi*4+2,y0/10,y1/10+1)).toBe(false);
  }
  // Neighbour 33654713 is only ~2m from the source boundary, but remains.
  expect(uraniaArcV206SourceColumn(-1610,1898,5.2,17.2)).toBe(false);
  expect(uraniaArcV206SourceColumn(-1700,1900,5.2,17.2)).toBe(false);
});

test("compiled pedestrian replacement leaves the real entrance approach open", () => {
  const obstacles=compilePedestrianObstacles({buildings:[{
    id:"11687794",class:0,y0_dm:52,h_dm:90,holes:[],
    ring:[[-16370,19053],[-16327,19070],[-16232,18825],[-16133,18822],[-16132,19005],[-16176,19127],[-16123,19147],[-16260,19494],[-16504,19402]],
  }]});
  const face=source.sites[0].facades![0], a=face.a,b=face.b;
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const tx=(b[0]-a[0])/length,tz=(b[1]-a[1])/length;
  const p=(u:number,inside:number)=>[a[0]+tx*u-tz*inside,a[1]+tz*u+tx*inside];
  const recess=p(18.7,.85),inner=p(18.7,2.5),post=p(.95,.26);
  expect(pedestrianPointIsBlocked(recess[0],recess[1],5.2,obstacles)).toBe(false);
  expect(pedestrianPointIsBlocked(inner[0],inner[1],5.2,obstacles)).toBe(true);
  expect(pedestrianPointIsBlocked(post[0],post[1],5.2,obstacles)).toBe(true);
  expect(pedestrianPointIsBlocked(recess[0],recess[1],10,obstacles)).toBe(true);
  expect(pedestrianPointIsBlocked(-1618,1890,5.2,obstacles)).toBe(true);
});
