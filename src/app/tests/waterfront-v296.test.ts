import {describe,expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {BoxGeometry,BufferGeometry,ExtrudeGeometry,Group,InstancedMesh,Mesh,MeshBasicMaterial,Raycaster,Shape,Vector3} from "three";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import source from "../src/data/waterfrontV296.json";
import {createBridgeStructures,createSmoothSurfaces,type SurfacePayload} from "../src/IsometricCityWorld";
import {createGroundSlabs,worldGroundSampler,type VoxelPayload} from "../src/terrainPayload";
import {createSpreebogenPark,createMinecraftSpreebogenPark,applyWaterfrontParkOpeningsV296} from "../src/SpreebogenPark";
import {createWaterfrontFidelityV296,applyWaterfrontAuthoredOpeningsV296} from "../src/WaterfrontFidelityV296";
import {clipFidelityGroundSurfaceV296,restoreFidelityGroundSlabsV296} from "../src/FidelityGroundOpeningsV296";
import {WATERFRONT_ROUTES_V296 as routes,WATERFRONT_GROUND_OPENINGS_V296 as cuts,GUSTAV_ALIGNMENT_V296 as alignment,waterfrontRouteTrianglesV296,waterfrontGroundAtV296,waterfrontGroundOpeningsV296,waterfrontNativeCellsV296,gustavPanoramaBaseV296,WATERFRONT_ARCADE_RECEIPT_V296 as receipt,waterfrontSourceOpeningsV296,createWaterfrontColumnOpeningsV296,waterfrontOriginalPrismV296,waterfrontArcadeCeilingCellsV296,waterfrontOpeningContainsV296,waterfrontArcadeSolidAtV296} from "../src/waterfrontV296Profile";
import {LUDWIG_ERHARD_UFER_WORLD_M,spreebogenLowerPathYAt} from "../src/spreebogenBankProfile";
import {createPedestrianEnvironment,createPedestrianState,stepPedestrian,PEDESTRIAN_WALK_SPEED_MPS} from "../src/pedestrianNavigation";
import {installFidelityNavigationV296} from "../src/FidelityNavigationV296";
import {createHumboldthafenBuildingDetails} from "../src/HumboldthafenBuildings";
import {parliamentClipGeometryV295} from "../src/ParliamentRetainedEnvelopeV295";
import {hbfBoxFragmentsV291} from "../src/HbfGeometryOpeningsV291";

const payload=ground as unknown as VoxelPayload;
const down=(root:Group|Mesh,x:number,z:number,y=20)=>new Raycaster(new Vector3(x,y,z),new Vector3(0,-1,0)).intersectObject(root,true).filter(h=>h.object instanceof Mesh);
const outside=(x:number,z:number)=>x< -45||x>175||z< -648||z> -380;
function points(step=.7):[number,number][] {
 const out:[number,number][]=[];
 for(const r of routes)for(let i=1;i<r.nodes.length;i++){const a=r.nodes[i-1],b=r.nodes[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/step);for(let k=0;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[2]+(b[2]-a[2])*k/n]);}
 return out;
}
// Keep complete source triangles in the finite QA window. Source construction
// above this extraction uses every original selected polygon ring and hole,
// including the citywide asphalt union; no simplified substitute is tested.
function localTriangles(g:BufferGeometry):BufferGeometry {
 const p=g.getAttribute("position"),idx=g.index,count=idx?.count??p.count,indices:number[]=[];
 for(let i=0;i<count;i+=3){const v=[0,1,2].map(j=>idx?idx.getX(i+j):i+j),xs=v.map(j=>p.getX(j)),zs=v.map(j=>p.getZ(j));if(Math.max(...xs)<-45||Math.min(...xs)>175||Math.max(...zs)<-648||Math.min(...zs)>-380)continue;indices.push(...v);}
 const out=new BufferGeometry();for(const[name,a]of Object.entries(g.attributes))out.setAttribute(name,a);out.setIndex(indices);return out;
}
const near=(p:{ring:number[][]})=>{const x=p.ring.map(p=>p[0]/10),z=p.ring.map(p=>p[1]/10);return Math.max(...x)>-45&&Math.min(...x)<175&&Math.max(...z)>-648&&Math.min(...z)<-380;};
function actualLocalPlates():Group{
 const sourcePlates=createSmoothSurfaces({...surfaces,roads:surfaces.roads.filter(near),parks:surfaces.parks.filter(near),water:[],scrub_points:[],lane_markings:[],sunken_walls:[]} as unknown as SurfacePayload,ground.water_top_y_m,4.1,worldGroundSampler(payload));
 const plateMeshes:Mesh[]=[];sourcePlates.traverse(o=>{if(o instanceof Mesh)plateMeshes.push(o);});
 const local=new Group();for(const m of plateMeshes){const g=localTriangles(m.geometry);if(!g.index?.count)continue;const mesh=new Mesh(g,m.material);mesh.name=m.name;local.add(mesh);}return local;
}
function arcadeSource(native:boolean,open=false):Group{
 const root=new Group();
 if(native){const admitted=createWaterfrontColumnOpeningsV296(prisms.buildings,4,open);for(const{row}of receipt.columns){const[x,z,b,t,k]=row,box={min:[x*4,b/10,z*4]as[number,number,number],max:[(x+1)*4,t/10,(z+1)*4]as[number,number,number]};for(const p of hbfBoxFragmentsV291(box,admitted(x,z,b,t,k))){const g=new BoxGeometry(p.max[0]-p.min[0],p.max[1]-p.min[1],p.max[2]-p.min[2]);g.translate((p.min[0]+p.max[0])/2,(p.min[1]+p.max[1])/2,(p.min[2]+p.max[2])/2);root.add(new Mesh(g,new MeshBasicMaterial()));}}
 }else{const p=receipt.prism,shape=new Shape();p.ring.forEach(([x,z],i)=>i?shape.lineTo(x/10,-z/10):shape.moveTo(x/10,-z/10));const g=new ExtrudeGeometry(shape,{depth:p.h_dm/10,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,p.y0_dm/10,0);root.add(new Mesh(parliamentClipGeometryV295(g,waterfrontSourceOpeningsV296(p,open)),new MeshBasicMaterial()));}
 return root;
}

describe("source-bound waterfront and actual ground integration v296",()=>{
 test("retains exact source nodes, widths/material evidence and finite alignment",()=>{
  const bridge=source.roads.find(r=>r.id==="15405394")!.points;
  expect(alignment.sourceEndpoints).toEqual(bridge);
  expect(alignment.centre).toEqual([(bridge[0][0]+bridge[1][0])/2,(bridge[0][1]+bridge[1][1])/2]);
  expect(alignment.sourceLength).toBeCloseTo(89.3119823591,8);
  for(const route of routes.slice(1))expect(route.nodes.map(p=>[p[0],p[2]])).toEqual(source.roads.find(r=>r.id===route.id)!.points);
  const south=source.roads.find(r=>r.id==="1127988519")!.points;
  expect(routes[0].nodes[3].filter((_,i)=>i!==1)).toEqual(south[0]);
  expect(routes[0].width).toBe(5);expect(routes[0].surface).toBe("asphalt");
  for(const r of routes.slice(1))expect(r.surface).toBe("paving_stones");
  for(const[x,z]of[[-38,-460],[-100,-400],[0,0],[400,-300]])expect(gustavPanoramaBaseV296(x,z,8)).toBe(8);
  expect(waterfrontGroundOpeningsV296()).toHaveLength(0);expect(waterfrontGroundOpeningsV296(true)).toBe(cuts);
  expect(cuts.length).toBe(60);for(const c of cuts){expect(c.nativeBoxes!.length).toBeGreaterThan(0);expect(c.bounds.max[1]-c.bounds.min[1]).toBeLessThan(7);}
 });
 test("drawn and cardinal paving have supported exact endpoints and no centreline gaps",()=>{
  for(const native of[false,true]){const root=createWaterfrontFidelityV296(native);root.updateMatrixWorld(true);
   for(const[x,z]of points(.9)){const y=waterfrontGroundAtV296(x,z,native);expect(y).not.toBeNull();const hit=down(root,x,z,y!+2)[0];expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(y!,3);}
   for(const r of routes)for(const p of r.nodes){expect(down(root,p[0],p[2],p[1]+2)[0]).toBeDefined();expect(waterfrontGroundAtV296(p[0],p[2],native)).not.toBeNull();}
  }
  for(const[x,z]of[[0,0],[-100,-400],[200,-550],[100,-700]])expect(waterfrontGroundAtV296(x,z)).toBeNull();
 });
 test("actual park/bridge/slabs/OSM plates expose every approach only after guarded admission",()=>{
  for(const native of[false,true]){
   const park=native?createMinecraftSpreebogenPark(payload):createSpreebogenPark(payload),bridge=createBridgeStructures(payload,"full")!,paving=createWaterfrontFidelityV296(native),slabs=createGroundSlabs(payload,"Actual retained ground-context runs",{}, {skipWater:true,skipBridge:true,skipAtWorld:outside}),plates=native?new Group():actualLocalPlates();
   const root=new Group().add(park,bridge,slabs,plates,paving);root.updateMatrixWorld(true);
   for(const[x,z]of[[-38.07,-398.56],[107.499253,-643.156777],[100.124613,-545.754754]])expect(down(root,x,z)[0].point.y-waterfrontGroundAtV296(x,z,native)!).toBeGreaterThan(.7);
   const original=slabs.instanceMatrix.array,originalPaint=slabs.instanceColor!.array;
   applyWaterfrontParkOpeningsV296(park,native);restoreFidelityGroundSlabsV296(slabs);expect(slabs.instanceMatrix.array).toBe(original);
   applyWaterfrontParkOpeningsV296(park,native,true);restoreFidelityGroundSlabsV296(slabs,{waterfront:true,native});
   if(!native)plates.traverse(o=>{if(o instanceof Mesh)o.geometry=clipFidelityGroundSurfaceV296(o.geometry,{waterfront:true});});
   root.updateMatrixWorld(true);
   for(const[x,z]of points(2)){const y=waterfrontGroundAtV296(x,z,native)!;const hit=down(root,x,z,y+2)[0];expect(hit).toBeDefined();expect(Math.abs(hit.point.y-y)).toBeLessThan(.003);}
   const oldRows=new Map<string,number[]>();for(let i=0;i<original.length;i+=16)oldRows.set(Array.from(original.slice(i,i+16)).join(),Array.from(originalPaint.slice(i/16*3,i/16*3+3)));
   for(let i=0;i<slabs.count;i++){const key=Array.from(slabs.instanceMatrix.array.slice(i*16,i*16+16)).join();expect(oldRows.has(key)).toBe(true);expect(Array.from(slabs.instanceColor!.array.slice(i*3,i*3+3))).toEqual(oldRows.get(key)!);}
  }
 },60000);
 test("Gustav joins the real bridge deck, opened Panoramaweg and retained south lawn",()=>{
  for(const native of[false,true]){
   const park=native?createMinecraftSpreebogenPark(payload):createSpreebogenPark(payload),bridge=createBridgeStructures(payload,"full")!,root=new Group().add(park,bridge,createWaterfrontFidelityV296(native));
   applyWaterfrontParkOpeningsV296(park,native,true);root.updateMatrixWorld(true);
   const first=routes[0].nodes[0],last=routes[0].nodes.at(-1)!;
   const deck=down(root,first[0]-.005*alignment.axis[0],first[2]-.005*alignment.axis[1])[0].point.y;
   expect(deck).toBeCloseTo(alignment.endTop,5);
   // Drawn slope is continuous; independent .5-m cardinal cells form small
   // steps bounded by this route's .185 slope times the cell diagonal.
   let previous=deck;for(const[x,z]of points(.15).filter(([x,z])=>x<0)){const hit=down(root,x,z)[0];expect(hit).toBeDefined();expect(Math.abs(hit.point.y-previous)).toBeLessThan(native?.14:.03);previous=hit.point.y;}
   const beyond=down(root,last[0],last[2]+.05)[0];expect(Math.abs(beyond.point.y-last[1])).toBeLessThan(.1);
   const junction=alignment.panoramaJunction;for(const dx of[-.3,0,.3])expect(down(root,junction[0]+dx,junction[1])[0].point.y).toBeCloseTo(waterfrontGroundAtV296(junction[0]+dx,junction[1],native)!,3);
  }
 });
 test("park openings preserve unrelated named geometry and every lower-route height",()=>{
  const park=createSpreebogenPark(payload),kept=new Map<string,{geometry:BufferGeometry;bytes:number[]}>();
  for(const name of["Spreebogenpark east rising lawn","Spreebogenpark east Corten wall","Spreebogenpark west Corten wall","Spreebogenpark maintained river lawn strip","Spreebogenpark Ludwig-Erhard-Ufer stone edge bands","Spreebogenpark source-bound Gartenspur slabs"]){const m=park.getObjectByName(name)as Mesh;kept.set(name,{geometry:m.geometry,bytes:Array.from(m.geometry.getAttribute("position").array)});}
  const west=park.getObjectByName("Spreebogenpark west rising lawn")as Mesh,oldWest=west.geometry;
  applyWaterfrontParkOpeningsV296(park);expect(west.geometry).toBe(oldWest);
  applyWaterfrontParkOpeningsV296(park,false,true);expect(west.geometry).not.toBe(oldWest);
  for(const[name,old]of kept){const m=park.getObjectByName(name)as Mesh;expect(m.geometry).toBe(old.geometry);expect(Array.from(m.geometry.getAttribute("position").array)).toEqual(old.bytes);}
  for(const[x,y,z]of LUDWIG_ERHARD_UFER_WORLD_M)expect(spreebogenLowerPathYAt(x,z)).toBe(y);
  const unknown=new Group(),unmatched=west.clone();unknown.add(unmatched);const geometry=unmatched.geometry;applyWaterfrontParkOpeningsV296(unknown,false,true);expect(unmatched.geometry).toBe(geometry);
 });
 test("actual pedestrian stepping traverses each source route and returns without jumping",()=>{
  for(const native of[false,true]){const env=createPedestrianEnvironment(payload,surfaces as unknown as SurfacePayload,null,prisms);env.visualMode=()=>native?"minecraft":"day";installFidelityNavigationV296(env,()=>({waterfront:true,native}));
   for(const route of routes){const nodes=[...route.nodes,...route.nodes.slice(0,-1).reverse()],first=nodes[0];let state=createPedestrianState(env,{x:first[0],z:first[2],yaw:0,groundYHint:first[1],preserveHorizontalPosition:true});
    expect(Math.hypot(state.x-first[0],state.z-first[2])).toBeLessThan(.02);
    for(const target of nodes.slice(1)){let frames=0;while(Math.hypot(state.x-target[0],state.z-target[2])>.02&&frames++<4000){const dx=target[0]-state.x,dz=target[2]-state.z,d=Math.hypot(dx,dz),dt=Math.min(.04,d/PEDESTRIAN_WALK_SPEED_MPS),next=stepPedestrian({...state,yaw:Math.atan2(dx,-dz)},{forward:1,strafe:0,turn:0,look:0,sprint:false},dt,env);expect(next.respawned).toBe(false);expect(next.state.jumpOffset).toBe(0);state=next.state;}
     if(frames>=4000)throw new Error(`Stopped ${route.id} native=${native} at ${state.x},${state.groundY},${state.z}; target ${target}`);
     expect(Math.hypot(state.x-target[0],state.z-target[2])).toBeLessThan(.02);const floor=waterfrontGroundAtV296(state.x,state.z,native);expect(floor).not.toBeNull();expect(state.groundY).toBeCloseTo(floor!,5);
    }
   }
  }
 });
 test("documented public arcade has a guarded complete source/native receipt",()=>{
  for(const[file,hash]of Object.entries(receipt.sha256))expect(createHash("sha256").update(readFileSync(new URL("../public/mesh/regierungsviertel/"+file,import.meta.url))).digest("hex")).toBe(hash);
  const original=prisms.buildings.find(p=>p.id===receipt.prism.id)!;expect(original).toEqual(receipt.prism);expect(waterfrontOriginalPrismV296(original)).toBe(true);expect(waterfrontSourceOpeningsV296(original)).toHaveLength(0);expect(waterfrontSourceOpeningsV296(original,true).length).toBeGreaterThan(0);
  for(const p of[{...original,h_dm:original.h_dm+1},{...original,roof:9999},{...original,extra:true}])expect(waterfrontSourceOpeningsV296(p,true)).toHaveLength(0);
  const admitted=createWaterfrontColumnOpeningsV296(prisms.buildings,4,true);expect(receipt.columns).toHaveLength(8);
  for(const c of receipt.columns){const[x,z,b,t,k]=c.row;expect(c.exclusiveFullCell).toBe(true);expect(admitted(x,z,b,t,k).length).toBeGreaterThan(0);expect(admitted(x,z,b,t+1,k)).toHaveLength(0);expect(createWaterfrontColumnOpeningsV296(prisms.buildings,4)(x,z,b,t,k)).toHaveLength(0);expect(createWaterfrontColumnOpeningsV296(prisms.buildings,2,true)(x,z,b,t,k)).toHaveLength(0);const foreign={id:"unknown-overlap",ring:[[x*40,z*40],[(x+1)*40,z*40],[(x+1)*40,(z+1)*40],[x*40,(z+1)*40]],y0_dm:b,h_dm:t-b};expect(createWaterfrontColumnOpeningsV296([...prisms.buildings,foreign],4,true)(x,z,b,t,k)).toHaveLength(0);}
 });
 test("complete old arcade source and actual authored fittings expose the head only after opening",()=>{
  for(const native of[false,true]){
   const authored=createHumboldthafenBuildingDetails(prisms,{minecraft:native}),before=new Group().add(authored,arcadeSource(native));before.updateMatrixWorld(true);
   const portal=new Vector3(100.124613,3.6,-546.25),ray=()=>new Raycaster(portal,new Vector3(0,0,1),0,4);expect(ray().intersectObject(before,true).length).toBeGreaterThan(0);
   const original=authored.children.map(c=>c instanceof InstancedMesh?c.instanceMatrix.array:(c as Mesh).geometry?.attributes.position?.array);applyWaterfrontAuthoredOpeningsV296(authored,native);authored.children.forEach((c,i)=>expect(c instanceof InstancedMesh?c.instanceMatrix.array:(c as Mesh).geometry?.attributes.position?.array).toBe(original[i]));
   applyWaterfrontAuthoredOpeningsV296(authored,native,true);const root=new Group().add(authored,arcadeSource(native,true),createWaterfrontFidelityV296(native));root.updateMatrixWorld(true);expect(ray().intersectObject(root,true)).toHaveLength(0);
   const r=routes.find(r=>r.id==="497648062")!,a=r.nodes[0],b=r.nodes[1];for(let i=1;i<19;i+=2){const x=a[0]+(b[0]-a[0])*i/20,z=a[2]+(b[2]-a[2])*i/20,y=waterfrontGroundAtV296(x,z,native)!;
    for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const hits=new Raycaster(new Vector3(x,y+.9,z),new Vector3(dx,0,dz),0,.42).intersectObject(root,true);expect(hits).toHaveLength(0);}
    expect(new Raycaster(new Vector3(x,y+.05,z),new Vector3(0,1,0),0,1.76).intersectObject(root,true)).toHaveLength(0);
    const ceiling=new Raycaster(new Vector3(x,y+1.85,z),new Vector3(0,1,0),0,12).intersectObject(root,true)[0];expect(ceiling).toBeDefined();expect(ceiling.point.y).toBeCloseTo(9.99,4);expect(waterfrontArcadeSolidAtV296(x,10.05,z,0,native)).toBe(true);
   }
   expect(waterfrontOpeningContainsV296(0,4,0,native)).toBe(false);
  }
 });
 test("retained native facade fragments keep all lighting handles and outside instance paint",()=>{
  const root=createHumboldthafenBuildingDetails(prisms,{minecraft:true}),old=root.getObjectByName("Minecraft source-bound harbour facade blocks")as InstancedMesh,before=old.instanceMatrix.array.slice(),paint=old.instanceColor!.array.slice(),night=(old.material as MeshBasicMaterial).clone();night.color.setHex(0x667788);old.userData.dayMaterial=old.material;old.userData.nightMaterial=night;
  applyWaterfrontAuthoredOpeningsV296(root,true,true);const fragments=old.children.find(o=>o instanceof Mesh)as Mesh;
  expect(fragments).toBeDefined();expect(fragments.geometry.getAttribute("color")).toBeDefined();expect((fragments.material as MeshBasicMaterial).vertexColors).toBe(true);expect(fragments.userData.dayMaterial).toBe(fragments.material);expect(fragments.userData.nightMaterial).not.toBe(night);expect(fragments.userData.nightMaterial.vertexColors).toBe(true);expect(fragments.userData.nightMaterial.color.getHex()).toBe(0x667788);
  const kept=new Map<string,number[]>();for(let i=0;i<old.count;i++)kept.set(Array.from(old.instanceMatrix.array.slice(i*16,i*16+16)).join(),Array.from(old.instanceColor!.array.slice(i*3,i*3+3)));
  let count=0;for(let i=0;i<before.length/16;i++){const x=before[i*16+12],z=before[i*16+14],y=before[i*16+13];if(x<90||x>110||z< -552||z> -520||y>15){const key=Array.from(before.slice(i*16,i*16+16)).join();expect(kept.has(key)).toBe(true);expect(kept.get(key)).toEqual(Array.from(paint.slice(i*3,i*3+3)));count++;}}
  expect(count).toBeGreaterThan(10000);
 });
 test("native park outside instances retain original matrices and colours byte for byte",()=>{
  const park=createMinecraftSpreebogenPark(payload),mesh=park.children[0]as InstancedMesh,before=mesh.instanceMatrix.array.slice(),paint=mesh.instanceColor!.array.slice();
  applyWaterfrontParkOpeningsV296(park,true);expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(before));applyWaterfrontParkOpeningsV296(park,true,true);
  const kept=new Map<string,number[]>();for(let i=0;i<mesh.count;i++)kept.set(Array.from(mesh.instanceMatrix.array.slice(i*16,i*16+16)).join(),Array.from(mesh.instanceColor!.array.slice(i*3,i*3+3)));
  let outsideCount=0;for(let i=0;i<before.length/16;i++){const x=before[i*16+12],z=before[i*16+14];if(x> -30||x< -45||z> -380||z< -405){const key=Array.from(before.slice(i*16,i*16+16)).join();expect(kept.has(key)).toBe(true);expect(kept.get(key)).toEqual(Array.from(paint.slice(i*3,i*3+3)));outsideCount++;}}
  expect(outsideCount).toBeGreaterThan(11000);expect(mesh.userData.affectedInstancesV296).toBeLessThan(60);
  const fragments=mesh.children[0]as InstancedMesh;expect(fragments.count).toBeLessThan(200);for(let i=0;i<fragments.count;i++)for(const j of[1,2,4,6,8,9])expect(fragments.instanceMatrix.array[i*16+j]).toBe(0);
 });
 test("native additions remain one finite cardinal batch with matching cell heights",()=>{
  const root=createWaterfrontFidelityV296(true),mesh=root.children[0]as InstancedMesh;
  expect(root.children).toHaveLength(1);expect(mesh.count).toBe(waterfrontNativeCellsV296().length+waterfrontArcadeCeilingCellsV296().length+3);expect(mesh.count).toBeLessThan(3600);
  expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(274000);
  const m=mesh.instanceMatrix.array,floorCount=waterfrontNativeCellsV296().length;for(let i=0;i<mesh.count;i++){for(const k of[1,2,4,6,8,9])expect(m[i*16+k]).toBe(0);if(i<floorCount){expect(m[i*16]).toBe(.5);expect(m[i*16+10]).toBe(.5);}}
  for(const r of routes)for(const t of waterfrontRouteTrianglesV296(r))expect(t.flat().every(Number.isFinite)).toBe(true);
  expect(root.userData.fullStaticDetailOnTouch).toBe(true);expect(root.userData.nativeMinecraft).toBe(true);
 });
});
