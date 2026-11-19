import { expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { createParkDetails, type ParkDetailsPayload } from "../src/ParkDetails";
import { FRITZ_COURSE_PAINT, isFritzCourseV366 } from "../src/fritzCourseV366";
import { createCourtsParkV293 } from "../src/CourtsParkV293";
import { createMoabitJusticeV166, createMinecraftMoabitJusticeV166 } from "../src/MoabitJusticeV166";
import { createJusticePalaceV183 } from "../src/JusticePalaceV183";
import { createMinecraftJusticePalaceV183 } from "../src/MinecraftJusticePalaceV183";
import { createWeddingMoabitV229 } from "../src/WeddingMoabitV229";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import park from "../public/mesh/regierungsviertel/park-details.json";
import source from "../src/data/fritzParkV366.json";

const paths=(park as unknown as ParkDetailsPayload).paths.filter(p=>isFritzCourseV366(p.id));
const payload={...park,paths,trees:[],playgrounds:[],street_lights:[],wall_traces:[],hedges:[],shrub_patches:[]} as unknown as ParkDetailsPayload;
for(const profile of ["full","mobile"] as const)test("painted path surfaces meet and show the stone edges on "+profile,()=>{
  const root=createParkDetails(payload,{detailProfile:profile,fritzCourseV366:true,pathTerrainAt:(_p,x,z)=>8+.012*x+.015*z});
  root.updateMatrixWorld(true);
  const meshes=paths.map(p=>root.getObjectByName("Fritz-Schloß-Park Laufstrecke "+p.id) as Mesh);
  expect(meshes.every(Boolean)).toBe(true);
  for(const [i,m] of meshes.entries()){
    const material=m.material as MeshStandardMaterial;
    expect(material.vertexColors).toBeTrue();
    expect(material.color.getHex()).toBe(0xffffff);
    const p=m.geometry.getAttribute("position"), c=m.geometry.getAttribute("color"), target=new Color(FRITZ_COURSE_PAINT[Number(paths[i].m==="g")]);
    expect(c.getX(2)).toBeCloseTo(target.r,2);expect(c.getY(2)).toBeCloseTo(target.g,2);
    expect(c.getY(0)).toBeGreaterThan(c.getY(2));
    const left=new Vector3().fromBufferAttribute(p,0),inner=new Vector3().fromBufferAttribute(p,1);
    expect(left.distanceTo(inner)).toBeCloseTo(.095,2);
    for(let row=0;row+1<p.count/6;row+=21){
      const a=new Vector3().fromBufferAttribute(p,6*row+2),b=new Vector3().fromBufferAttribute(p,6*row+3);
      const next=new Vector3().fromBufferAttribute(p,6*(row+1)+2);
      const sample=a.clone().addScaledVector(b.sub(a),.43).addScaledVector(next.sub(a),.35);
      const hits=new Raycaster(sample.clone().add(new Vector3(0,1,0)),new Vector3(0,-1,0),0,2).intersectObjects(meshes);
      expect(hits).toHaveLength(1);
      expect(hits[0].point.y).toBeCloseTo(8+.012*sample.x+.015*sample.z+.12,3);
    }
  }
  for(const [a,b] of [[meshes[0],meshes[1]],[meshes[1],meshes[0]]]){
    const aa=a.geometry.getAttribute("position"),bb=b.geometry.getAttribute("position");
    for(let k=0;k<6;k++)expect(new Vector3().fromBufferAttribute(aa,aa.count-6+k).distanceTo(new Vector3().fromBufferAttribute(bb,k))).toBeLessThan(.001);
  }
});

test("native running loop is draped on the displayed relief and the two memorials are separate",()=>{
  const root=createWeddingMoabitV229(true);root.updateMatrixWorld(true);
  const tiles=root.children.filter(c=>c.name.startsWith("Fritz-Schloß-Park Laufstrecke")) as InstancedMesh[];
  expect(tiles.reduce((n,t)=>n+t.count,0)).toBe(source.courseRuns.length);
  expect(source.lengths.reduce((a,b)=>a+b,0)).toBeCloseTo(1087.96,2);
  for(let i=0;i<source.courseRuns.length;i+=29){
    const [left,north,width,dm]=source.courseRuns[i], x=left+width*.45, z=north+.5;
    const g=ground.grid,h=ground.ground_height,ix=Math.floor((Math.floor(x/ground.cell_m)-g.min_x_idx)/h.stride_cells),iz=Math.floor((Math.floor(z/ground.cell_m)-g.min_z_idx)/h.stride_cells);
    expect(h.y_dm[iz*h.cols+ix]).toBe(dm);
    const hits=new Raycaster(new Vector3(x,dm/10+1,z),new Vector3(0,-1,0),0,2).intersectObjects(tiles);
    expect(hits[0].point.y).toBeCloseTo(dm/10+.104,3);
  }
  for(const [i,name] of ["Den Notstandsarbeitern zum Dank","Gedenkstein Dr. Fritz Schloß"].entries()){
    const [x,z,,floor]=source.memorials[i];const obj=root.getObjectByName(name)!;
    const hit=new Raycaster(new Vector3(x,floor+3,z),new Vector3(0,-1,0)).intersectObject(obj,true)[0];
    expect(hit.point.y).toBeGreaterThan(floor+1);
  }
});

for(const native of [false,true])test("Turmstraße portal, oriel, pilaster and gable are visible ahead of earlier court shells "+native,()=>{
  const r=createCourtsParkV293(native), older=[native?createMinecraftMoabitJusticeV166():createMoabitJusticeV166(),native?createMinecraftJusticePalaceV183():createJusticePalaceV183()];
  for(const g of [r,...older])g.updateMatrixWorld(true);
  const rows=r.children[0] as InstancedMesh, c=new Color();
  for(const [u,y,paint] of [[1.95,7.6,0x4c463c],[-1.60,16,0x596668],[1.54,22,0x596668],[-4,28.5,0xb8aa8b],[-10.9,21,0xb8aa8b],[7.7,19.6,0x596668]]){
    const ux=.995131192,uz=-.098559174;
    const ray=new Raycaster(new Vector3(-1178.027+ux*u+uz*40,y,-857.9315+uz*u-ux*40),new Vector3(-uz,0,ux),0,43);
    ray.params.Line!.threshold=.03;
    const hit=ray.intersectObject(r,true)[0], old=ray.intersectObjects(older,true)[0];
    expect(hit.object).toBe(rows);rows.getColorAt(hit.instanceId!,c);expect(c.getHex()).toBe(paint);
    if(old)expect(old.distance-hit.distance).toBeGreaterThan(.2);
  }
});
