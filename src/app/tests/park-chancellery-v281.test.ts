import { describe,expect,test } from "bun:test";
import { Box3,InstancedMesh,Matrix4 } from "three";
import { charlottenburgBasinV281Triangles,charlottenburgParkV281Rows,CHARLOTTENBURG_PARK_V281 } from "../src/CharlottenburgParkV281";
import { CHILLIDA_LAWN_V281,CHANCELLERY_FORECOURT_V281,createChillidaSculptureV281,chillidaNativeRowsV281,chillidaNativeLawnV281,matchesChancelleryForecourtV281 } from "../src/ChancelleryForecourtV281";
import { chancelleryLawnContains,CHANCELLERY_LAWN_RINGS } from "../src/ChancelleryEntranceProfile";
import { createArchitecturalSignature,type ChancelleryModelSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import scene from "../public/mesh/regierungsviertel/scene.json";

const signature=scene.architectural_signatures.find(s=>s.kind==="chancellery_model") as ChancelleryModelSignature;

describe("source-bound park and Ehrenhof v281",()=>{
  test("keeps every retained hedge vertex and mapped height",()=>{
    const features=CHARLOTTENBURG_PARK_V281.source.features;
    expect(features.filter(f=>f.role==="parterre hedge")).toHaveLength(9);
    expect(features.reduce((n,f)=>n+f.points.length,0)).toBe(249);
    for(const f of features){expect(f.sourceVertexCount).toBe(f.points.length);expect(f.sourceWkbSha256).toHaveLength(64);}
    expect(features.filter(f=>f.heightM!==undefined).every(f=>f.heightM===.3)).toBe(true);
    const rows=charlottenburgParkV281Rows();
    expect(rows).toHaveLength(244);
    for(const row of rows){expect(row.every(Number.isFinite)).toBe(true);expect(row.slice(3,6).every(v=>v>0)).toBe(true);}
    expect(charlottenburgParkV281Rows(true).length).toBeLessThan(1250);
  });
  test("shallow basin skin uses only the exact mapped octagon",()=>{
    const source=CHARLOTTENBURG_PARK_V281.source.features.find(f=>f.role==="octagonal fountain basin")!;
    const triangles=charlottenburgBasinV281Triangles();
    expect(triangles).toHaveLength(source.points.length-3);
    for(const row of triangles)for(let i=0;i<9;i+=3){
      expect(row[i+1]).toBe(3.06);
      expect(source.points.some(p=>p[0]===row[i]&&p[1]===row[i+2])).toBe(true);
    }
    for(const native of [false,true])expect(charlottenburgParkV281Rows(native)).toEqual(charlottenburgParkV281Rows(native));
  });
  test("only the audited artwork owner retires the old authored proxy",()=>{
    expect(matchesChancelleryForecourtV281(signature)).toBe(true);
    expect(matchesChancelleryForecourtV281({...signature,anchor_world:[-220.235,1.554,-145.806]})).toBe(false);
    expect(matchesChancelleryForecourtV281({...signature,forecourt_sculpture_height_m:6})).toBe(false);
    const root=createArchitecturalSignature(signature)!;
    for(const name of CHANCELLERY_FORECOURT_V281.replacedNames)expect(root.getObjectByName(name)).toBeUndefined();
    expect(root.getObjectByName("Chancellery sculpture lawn island v281")).toBeDefined();
    expect(root.getObjectByName("Chancellery instanced Ehrenhof entrance fence bars")).toBeDefined();
    expect(root.getObjectByName("Chancellery curved Ehrenhof lawn plots")!.children).toHaveLength(CHANCELLERY_LAWN_RINGS.length+1);
    const changed=createArchitecturalSignature({...signature,forecourt_sculpture_height_m:6})!;
    expect(changed.getObjectByName(CHANCELLERY_FORECOURT_V281.replacedNames[0])).toBeDefined();
  });
  test("both forms keep the 5.5 m sculpture and its two grounded feet",()=>{
    const drawn=createChillidaSculptureV281(0,0),bounds=new Box3().setFromObject(drawn);
    expect(bounds.max.y-bounds.min.y).toBeCloseTo(5.5,5);
    expect(bounds.min.y).toBeCloseTo(.21,6);
    expect(bounds.max.z-bounds.min.z).toBeGreaterThan(8);
    expect(bounds.max.x-bounds.min.x).toBeLessThan(3);
    for(const [x,z] of [[.15,-2.25],[-.1,2.25]])expect(chancelleryLawnContains(CHILLIDA_LAWN_V281,x,z)).toBe(true);
    const native=chillidaNativeRowsV281(0,0);
    expect(native).toHaveLength(15);
    expect(Math.max(...native.map(r=>r[1]+r[4]/2))-.21).toBeCloseTo(5.5,6);
    const scale = 5.5 / 5.175;
    // Lines of sight through the upper two eyes and the lower curl must not
    // encounter any native course at any depth.
    for (const [u,y] of [[-.75,4.25],[1.05,4.25],[.4,2.95]]) {
      const top = .21+y*scale;
      expect(native.some(r=>Math.abs(r[2]-u)<r[5]/2 && Math.abs(r[1]-top)<r[4]/2)).toBe(false);
    }
    expect(chillidaNativeLawnV281(0,0)).toHaveLength(9);
    drawn.geometry.dispose();(drawn.material as {dispose():void}).dispose();
  });
  test("native sculpture/lawn remain cardinal inside the unchanged 5500 budget",()=>{
    const root=createMinecraftArchitecturalLandmarks();
    const meshes=root.children as InstancedMesh[];
    expect(meshes.reduce((sum,m)=>sum+m.count,0)).toBe(5494);
    const mesh=meshes.find(m=>m.userData.landmarkId==="bundeskanzleramt")!;
    expect(mesh.userData.cueCounts["Chillida independent stepped iron arms v281"]).toBe(15);
    expect(mesh.userData.cueCounts["Chillida source-anchored lawn island v281"]).toBe(9);
    const matrix=new Matrix4();
    // The 24 additions precede the two protocol flagpoles.
    for(let i=mesh.count-26;i<mesh.count-2;i++){
      mesh.getMatrixAt(i,matrix);
      for(const k of [1,2,4,6,8,9])expect(Math.abs(matrix.elements[k])).toBe(0);
    }
  });
});
