import { expect, test } from "bun:test";
import { Box3, Color, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createMitteHeritageV166, createMinecraftMitteHeritageV166, mitteHeritageV166WaterLevel } from "../src/MitteHeritageV166";
import { createWeinbergPlaygroundV174, createMinecraftWeinbergPlaygroundV174 } from "../src/WeinbergPlaygroundV174";
import { createZionskirchplatzV175 } from "../src/ZionskirchplatzV175";
import { createZionskircheV174 } from "../src/ZionskircheV174";
import { MITTE_HERITAGE_V166_PARTS, mitteHeritageV166ParentOffset, mitteHeritageV166RoofAt } from "../src/mitteHeritageV166Profile";
import { buildingTerrainOffset, nativeTerrainOffset, terrainOffset } from "../src/weinbergTerrainV176";
import { localTerrainIntersects, nativeTerrainGroundRows } from "../src/weinbergLocalModelTerrainV176";
import { ZIONSKIRCHE_V174_PROFILE, ZIONSKIRCHE_V174_TERRAIN_OFFSET, ZIONSKIRCHE_V174_TOWER_CENTER, zionskircheV174RoofAt } from "../src/zionskircheV174Profile";
import source from "../src/data/mitteHeritageV166Source.json";
import playground from "../src/data/weinbergPlaygroundV174Source.json";
import frontages from "../src/data/zionskirchplatzV175Drawn.json";
import basins from "../src/data/weinbergBasinsV176.json";

const drawn = createMitteHeritageV166();
const native = createMinecraftMitteHeritageV166();

test("outside-hill V166 ground and both Monbijou pools keep exact rendered positions and colours", () => {
  const ground=drawn.children[1] as Mesh,positions=ground.geometry.getAttribute("position"),colors=ground.geometry.getAttribute("color");
  const drawnTriangles=new Map<string,number>();
  for(let i=0;i<positions.count;i+=3){
    const values:number[]=[];
    for(let j=0;j<3;j++)values.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j),colors.getX(i+j),colors.getY(i+j),colors.getZ(i+j));
    const key=JSON.stringify(values);drawnTriangles.set(key,(drawnTriangles.get(key)??0)+1);
  }
  let checkedSheets=0,checkedPools=0;
  for(let index=0;index<source.groundSurfaces.length;index++){
    const sheet=source.groundSurfaces[index],points=sheet.triangles.flat();
    if(localTerrainIntersects(Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[2])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[2]))))continue;
    const color=new Color(sheet.color).toArray().map(Math.fround);
    for(const triangle of sheet.triangles){
      const key=JSON.stringify(triangle.flatMap(p=>[...p.map(Math.fround),...color]));
      const remaining=drawnTriangles.get(key)??0;
      expect(remaining).toBeGreaterThan(0);drawnTriangles.set(key,remaining-1);
    }
    checkedSheets++;
    if(index===174||index===175){
      expect(sheet.kind).toBe("mapped water");
      expect(new Set(points.map(p=>p[1]))).toEqual(new Set([5.45]));
      checkedPools++;
    }
  }
  expect(checkedSheets).toBeGreaterThan(100);
  expect(checkedPools).toBe(2);

  const mesh=native.children[0] as InstancedMesh,m=mesh.instanceMatrix.array;
  const nativeRows=new Map<string,number>();
  for(let i=0;i<mesh.count;i++){
    const j=i*16,key=JSON.stringify([m[j+12],m[j+13],m[j+14],m[j],m[j+5],m[j+10],mesh.instanceColor!.getX(i),mesh.instanceColor!.getY(i),mesh.instanceColor!.getZ(i)]);
    nativeRows.set(key,(nativeRows.get(key)??0)+1);
  }
  let checkedRows=0,checkedPoolRows=0;
  for(const [x,y,z,w,h,d,c] of source.groundRuns){
    if(localTerrainIntersects(x-w/2,z-d/2,x+w/2,z+d/2))continue;
    const key=JSON.stringify([x,y,z,w,h,d,...new Color(c).toArray()].map(Math.fround));
    const remaining=nativeRows.get(key)??0;
    expect(remaining).toBeGreaterThan(0);nativeRows.set(key,remaining-1);checkedRows++;
    if(c===6001307&&x>1700&&x<1740&&z>-410&&z<-370){
      expect(y+h/2).toBeCloseTo(5.45,10);checkedPoolRows++;
    }
  }
  expect(checkedRows).toBeGreaterThan(3000);
  expect(checkedPoolRows).toBeGreaterThan(20);
});

test("every measured V166 source vertex receives exactly one rigid parent shift", () => {
  const attribute = (drawn.children[0] as Mesh).geometry.getAttribute("position");
  let vertex = 0;
  const parts = new Map(source.parts.map(p => [p.id, p]));
  for (const sheet of source.surfaces) {
    const part = parts.get(sheet.partId)!;
    const offset = mitteHeritageV166ParentOffset(part.parentId);
    for (const triangle of sheet.triangles) for (const point of triangle) {
      expect(attribute.getX(vertex)).toBe(Math.fround(point[0]));
      expect(attribute.getY(vertex)).toBe(Math.fround(point[1] + offset));
      expect(attribute.getZ(vertex)).toBe(Math.fround(point[2]));
      vertex++;
    }
  }
  expect(attribute.count).toBe(vertex);
  expect(MITTE_HERITAGE_V166_PARTS.map(p => p.id)).toEqual(source.parts.map(p => p.id));
  expect(mitteHeritageV166ParentOffset("DEBE01YYK00002XY")).toBeCloseTo(17.01, 2);
  expect(mitteHeritageV166ParentOffset("DEBE01YYK00000AU")).toBe(0);
  for (const part of MITTE_HERITAGE_V166_PARTS) {
    const before = parts.get(part.id)!;
    expect(part.top_y_m - part.ground_y_m).toBeCloseTo(before.top_y_m - before.ground_y_m, 10);
  }
});

test("V166 drawn roof queries meet the actual lifted source mesh", () => {
  const mesh = drawn.children[0] as Mesh;
  const ray = new Raycaster();
  let checked = 0;
  for (const sheet of source.surfaces.filter(s => s.kind === "RoofSurface")) {
    const part = source.parts.find(p => p.id === sheet.partId)!;
    if (!mitteHeritageV166ParentOffset(part.parentId)) continue;
    const triangle = sheet.triangles[0];
    const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3;
    const z = triangle.reduce((sum, p) => sum + p[2], 0) / 3;
    const roof = mitteHeritageV166RoofAt(x, z);
    if (roof === null) continue; // Source eave overhangs are outside solid footprints.
    ray.set(new Vector3(x, 150, z), new Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh, false)[0];
    expect(hit).toBeDefined();
    expect(roof).toBeCloseTo(hit.point.y, 3);
    checked++;
  }
  expect(checked).toBeGreaterThan(10);
});

test("native terrain subdivisions retain every source rectangle and occupied volume", () => {
  const rows = [[2101, 3.2, -1501, 18, .2, 9, 0x123456]];
  const result = nativeTerrainGroundRows(rows);
  expect(result.length).toBeGreaterThan(6);
  expect(result.reduce((sum, r) => sum + r[3] * r[5], 0)).toBe(18 * 9);
  for (const [x, y, z, w, , d] of result) {
    expect(x - w / 2).toBeGreaterThanOrEqual(2092);
    expect(x + w / 2).toBeLessThanOrEqual(2110);
    expect(z - d / 2).toBeGreaterThanOrEqual(-1505.5);
    expect(z + d / 2).toBeLessThanOrEqual(-1496.5);
    expect(y).toBe(3.2 + nativeTerrainOffset(x, z));
  }
  const mesh = native.children[0] as InstancedMesh;
  const matrices = mesh.instanceMatrix.array;
  let volume = 0;
  for (let i = 0; i < mesh.count; i++) volume += matrices[i * 16] * matrices[i * 16 + 5] * matrices[i * 16 + 10];
  const oldVolume = [...source.nativeRows, ...source.groundRuns].reduce((sum, r) => sum + r[3] * r[4] * r[5], 0);
  expect(volume).toBeCloseTo(oldVolume, 2);
});

test("blue play surface follows the same drawn planes and native terraces", () => {
  const mesh = createWeinbergPlaygroundV174().children[0] as Mesh;
  const positions = mesh.geometry.getAttribute("position");
  const sourceY = playground.surfaces[0].triangles[0][0][1];
  for (let i = 0; i < positions.count; i++) {
    expect(positions.getY(i)).toBeCloseTo(sourceY + terrainOffset(positions.getX(i), positions.getZ(i)), 3);
  }
  const blocks = createMinecraftWeinbergPlaygroundV174().children[0] as InstancedMesh;
  let area = 0;
  for (let i = 0; i < blocks.count; i++) {
    const m = blocks.instanceMatrix.array, j = i * 16;
    expect(m[j + 13]).toBeCloseTo(playground.nativeRows[0][1] + nativeTerrainOffset(m[j + 12], m[j + 14]), 4);
    expect([m[j + 1], m[j + 2], m[j + 4], m[j + 6], m[j + 8], m[j + 9]]).toEqual([0, 0, 0, 0, 0, 0]);
    area += m[j] * m[j + 10];
  }
  expect(area).toBeCloseTo(playground.nativeRows.reduce((sum, r) => sum + r[3] * r[5], 0), 4);
});

test("pond and Plansche remain horizontal at their shared water levels in both modes", () => {
  const expectedColor = new Color(6001307).toArray().map(Math.fround);
  const ground = drawn.children[1] as Mesh;
  const positions = ground.geometry.getAttribute("position"), colors = ground.geometry.getAttribute("color");
  const levels = new Set<number>();
  let checked = 0;
  for (let i = 0; i < positions.count; i++) {
    if (colors.getX(i) !== expectedColor[0] || colors.getY(i) !== expectedColor[1] || colors.getZ(i) !== expectedColor[2]) continue;
    const level = mitteHeritageV166WaterLevel(positions.getX(i), positions.getZ(i), 6001307);
    if (level === undefined) continue;
    expect(positions.getY(i)).toBe(Math.fround(level));
    levels.add(level); checked++;
  }
  expect(levels).toEqual(new Set([6.315, 12.415]));
  expect(checked).toBe(210);
  const mesh = native.children[0] as InstancedMesh;
  let nativeChecked = 0;
  for (let i = 0; i < mesh.count; i++) {
    if (mesh.instanceColor!.getX(i) !== expectedColor[0] || mesh.instanceColor!.getY(i) !== expectedColor[1] || mesh.instanceColor!.getZ(i) !== expectedColor[2]) continue;
    const m = mesh.instanceMatrix.array, j = i * 16;
    const level = mitteHeritageV166WaterLevel(m[j + 12], m[j + 14], 6001307);
    if (level === undefined) continue;
    expect(m[j + 13] + m[j + 5] / 2).toBeCloseTo(level, 5);
    nativeChecked++;
  }
  expect(nativeChecked).toBeGreaterThan(60);
});

test("native path and edging boundary blocks cannot cover the exact Plansche water", () => {
  const basin=basins.basins[0],ring=basin.ring;
  const signedArea=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
  const waterColor=new Color(6001307).toArray().map(Math.fround);
  const mesh=native.children[0] as InstancedMesh,m=mesh.instanceMatrix.array;
  const candidates:number[][]=[];
  for(let i=0;i<mesh.count;i++){
    const j=i*16,x=m[j+12],z=m[j+14];
    if(x<2122||x>2144||z<-1425||z>-1391)continue;
    if(mesh.instanceColor!.getX(i)===waterColor[0]&&mesh.instanceColor!.getY(i)===waterColor[1]&&mesh.instanceColor!.getZ(i)===waterColor[2])continue;
    candidates.push([x-m[j]/2,z-m[j+10]/2,x+m[j]/2,z+m[j+10]/2,m[j+13]+m[j+5]/2]);
  }
  let checked=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<1e-8)continue;
    const sign=Math.sign(signedArea);
    for(let k=1;k<10;k++){
      const x=a[0]+dx*k/10-sign*dz/length*.015,z=a[1]+dz*k/10+sign*dx/length*.015;
      for(const [x0,z0,x1,z1,top] of candidates){
        if(x>x0&&x<x1&&z>z0&&z<z1){expect(top).toBeLessThanOrEqual(basin.floorY+1e-5);checked++;}
      }
    }
  }
  expect(checked).toBeGreaterThan(50);
});

test("church and former Cafe 103 details keep their source height and rigid shell shift", () => {
  const church = createZionskircheV174();
  const bounds = new Box3().setFromObject(church);
  expect(ZIONSKIRCHE_V174_TERRAIN_OFFSET).toBeCloseTo(20.33, 2);
  expect(bounds.max.y - ZIONSKIRCHE_V174_PROFILE.displayGroundY).toBeCloseTo(67, 4);
  expect(zionskircheV174RoofAt(...ZIONSKIRCHE_V174_TOWER_CENTER)).toBeCloseTo(bounds.max.y, 4);
  const frontageMesh = createZionskirchplatzV175().children[0] as Mesh;
  const positions = frontageMesh.geometry.getAttribute("position");
  const cafeOffset = buildingTerrainOffset("DEBE01YYK0000CIk", 2312.765, -1659.195, 3);
  let index = 0;
  for (const point of frontages.surfaces[0].triangles.flat()) {
    expect(positions.getX(index)).toBe(Math.fround(point[0]));
    expect(positions.getY(index)).toBe(Math.fround(point[1] + cafeOffset));
    expect(positions.getZ(index)).toBe(Math.fround(point[2]));
    index++;
  }
});
