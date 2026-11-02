import { Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { WATERFRONT_ROUTES_V296, WATERFRONT_ARCADE_OPENINGS_V296, WATERFRONT_ARCADE_CEILING_V296, waterfrontArcadeCeilingCellsV296, waterfrontArcadeFramesV296, waterfrontNativeCellsV296, waterfrontRouteTrianglesV296 } from "./waterfrontV296Profile";
import type { HbfOpeningV291,HbfBoxV291 } from "./HbfGeometryOpeningsV291";
import { parliamentClipGeometryV295, parliamentClipInkV295 } from "./ParliamentRetainedEnvelopeV295";

/** Source-node ribbons, flat independent native paving and restrained fittings.
 * No building, park, source route or water owner is retired by this layer. */
export function createWaterfrontFidelityV296(native = false): Group {
  const root = new Group(); root.name = `Source-bound bridge approaches and Alexanderufer v296${native ? " native" : ""}`;
  const day = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, vertexColors: !native });
  const night = new MeshStandardMaterial({ color: native ? 0xffffff : 0x85867d, side: DoubleSide, roughness: .93, flatShading: true });
  night.vertexColors=!native;
  const tint=(surface:string)=>surface==="asphalt"?0x777c7a:0xb9b7aa;
  if (native) {
    const blocks=waterfrontNativeCellsV296().map(p=>({x:p.x,y:p.y-.06,z:p.z,sx:p.size,sy:.12,sz:p.size,color:tint(p.surface)}));
    for(const p of waterfrontArcadeCeilingCellsV296())blocks.push({x:p.x,y:10.08,z:p.z,sx:p.size,sy:.18,sz:p.size,color:0xe7e3d6});
    for(const b of waterfrontArcadeFramesV296(true))blocks.push({x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2,z:(b.min[2]+b.max[2])/2,sx:b.max[0]-b.min[0],sy:b.max[1]-b.min[1],sz:b.max[2]-b.min[2],color:0xe7e3d6});
    const geometry = new BoxGeometry(1,1,1); geometry.deleteAttribute("uv");
    const mesh = new InstancedMesh(geometry, day, blocks.length), m = new Matrix4(), c = new Color(0xb9b7aa);
    blocks.forEach((p,i) => { m.makeScale(p.sx,p.sy,p.sz);m.setPosition(p.x,p.y,p.z);mesh.setMatrixAt(i,m);mesh.setColorAt(i,c.setHex(p.color)); });
    mesh.name = "Independent cardinal bridge joints and Alexanderufer ramp paving"; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  } else {
    const points: number[] = [],colours:number[]=[],c=new Color();
    for(const route of WATERFRONT_ROUTES_V296){c.setHex(tint(route.surface));for(const t of waterfrontRouteTrianglesV296(route))for(const p of t){points.push(...p);colours.push(c.r,c.g,c.b);}}
    c.setHex(0xe7e3d6);for(const t of WATERFRONT_ARCADE_CEILING_V296)for(const p of t){points.push(...p);colours.push(c.r,c.g,c.b);}
    const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(points,3));geometry.setAttribute("color",new Float32BufferAttribute(colours,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new Mesh(geometry,day);mesh.name="Exact-node continuous bridge approach and Alexanderufer ramp surfaces";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
    const frames=waterfrontArcadeFramesV296(),frame=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial({color:0xe7e3d6}),frames.length),m=new Matrix4();frames.forEach((b,i)=>{m.makeScale(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]);m.setPosition((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);frame.setMatrixAt(i,m);});frame.name="HHE source-route arcade portal jambs and head beam";frame.userData={dayMaterial:frame.material,nightMaterial:new MeshStandardMaterial({color:0x72746c,roughness:.93}),textureFree:true};frame.computeBoundingBox();frame.computeBoundingSphere();root.add(frame);
  }
  root.userData={sourceGeometryRetained:true,fullStaticDetailOnTouch:true,native,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,routeIds:WATERFRONT_ROUTES_V296.map(r=>r.id),estimateBoundary:"Widths without OSM width and retained-ground height interpolation are explicit display estimates; source XZ nodes are unchanged"};
  freezeStaticSceneTransforms(root);return root;
}

const intersects=(a:HbfBoxV291,b:HbfBoxV291)=>a.max.every((v,i)=>v>b.min[i]&&a.min[i]<b.max[i]);
let nativeArcadeCuts:readonly HbfOpeningV291[]|undefined;
function authoredCuts(native:boolean):readonly HbfOpeningV291[]{
 if(!native)return WATERFRONT_ARCADE_OPENINGS_V296;
 if(nativeArcadeCuts)return nativeArcadeCuts;const boxes=new Map<string,HbfBoxV291>();
 for(const c of WATERFRONT_ARCADE_OPENINGS_V296)for(const b of c.nativeBoxes??[])if(b.max[0]>=96&&b.min[0]<=104&&b.max[2]>=-546&&b.min[2]<=-524)boxes.set(JSON.stringify(b),b);
 return nativeArcadeCuts=[...boxes.values()].map((b,i):HbfOpeningV291=>({id:"hhe-cardinal-public-arcade-"+i,bounds:b,nativeBoxes:[b],planes:[[1,0,0,-b.min[0]],[-1,0,0,b.max[0]],[0,1,0,-b.min[1]],[0,-1,0,b.max[1]],[0,0,1,-b.min[2]],[0,0,-1,b.max[2]]]}));
}
/** Exact old harbour-facade owners only, after source admission and the full
 * route/ceiling/frame are attached. Unknown groups and all outside fragments
 * keep their original geometry, attributes, matrices and paint. */
export function applyWaterfrontAuthoredOpeningsV296(root:Group,native=false,enabled=false):void{
 if(!enabled)return;root.updateMatrixWorld(true);const cuts=authoredCuts(native),targets:(Mesh|LineSegments)[]=[],owner=native?"Minecraft Humboldthafen building architecture":"Humboldthafen building architecture";
 root.traverse(o=>{if(!(o instanceof Mesh||o instanceof LineSegments)||o.userData.waterfrontArcadeV296)return;let p=o.parent;while(p&&p!==root&&p.name!==owner)p=p.parent;if(root.name===owner||p?.name===owner)targets.push(o);});
 for(const o of targets){
  if(o instanceof InstancedMesh){
   const kept:number[]=[],paint:number[]=[],pieces:BufferGeometry[]=[],m=new Matrix4(),world=new Matrix4(),box=new Box3(),color=new Color();o.geometry.computeBoundingBox();
   for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,m);world.multiplyMatrices(o.matrixWorld,m);box.copy(o.geometry.boundingBox!).applyMatrix4(world);const bounds:HbfBoxV291={min:[box.min.x,box.min.y,box.min.z],max:[box.max.x,box.max.y,box.max.z]},local=cuts.filter(c=>intersects(bounds,c.bounds));
    const keep=()=>{kept.push(...o.instanceMatrix.array.slice(i*16,i*16+16));if(o.instanceColor)paint.push(...o.instanceColor.array.slice(i*3,i*3+3));};if(!local.length){keep();continue;}
    const g=o.geometry.clone().applyMatrix4(world),clipped=parliamentClipGeometryV295(g,local);if(clipped===g){keep();g.dispose();continue;}g.dispose();if(!clipped.getAttribute("position").count){clipped.dispose();continue;}
    if(o.instanceColor){o.getColorAt(i,color);const a=new Float32Array(clipped.getAttribute("position").count*3);for(let v=0;v<a.length;v+=3)a.set([color.r,color.g,color.b],v);clipped.setAttribute("color",new BufferAttribute(a,3));}
    clipped.applyMatrix4(o.matrixWorld.clone().invert());pieces.push(clipped.index?clipped.toNonIndexed():clipped);
   }
   if(!pieces.length&&kept.length===o.count*16)continue;o.count=kept.length/16;o.instanceMatrix=new InstancedBufferAttribute(new Float32Array(kept),16);if(o.instanceColor)o.instanceColor=new InstancedBufferAttribute(new Float32Array(paint),3);o.computeBoundingBox();o.computeBoundingSphere();
   if(pieces.length){const g=mergeGeometries(pieces,false)!;pieces.forEach(p=>p.dispose());const material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(material)?material:[material])Object.assign(m,{vertexColors:!!o.instanceColor});const mesh=new Mesh(g,material);mesh.name=o.name+" exact outside arcade fragments v296";mesh.userData={...o.userData,waterfrontArcadeV296:true,sourceOutsideFragmentsRetained:true};
    // Every lighting handle must carry the baked original instance tint.
    // Reuse the active clone where it corresponds to that alternate handle.
    for(const key of["dayMaterial","nightMaterial"]){const old=o.userData[key];if(!old)continue;const alternate=old===o.material&&!Array.isArray(material)?material:old.clone();alternate.vertexColors=!!o.instanceColor;mesh.userData[key]=alternate;}
    o.add(mesh);
   }
   o.userData.waterfrontArcadeV296=true;
  }else{
   const g=o.geometry.clone().applyMatrix4(o.matrixWorld),clipped=o instanceof LineSegments?parliamentClipInkV295(g,cuts):parliamentClipGeometryV295(g,cuts);if(clipped===g){g.dispose();continue;}g.dispose();clipped.applyMatrix4(o.matrixWorld.clone().invert());o.geometry.dispose();o.geometry=clipped;o.userData.waterfrontArcadeV296=true;
  }
 }
 freezeStaticSceneTransforms(root);
}
