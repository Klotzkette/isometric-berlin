import { memorialParcelsV378 } from "./memorialParcelGroundV378";
import { buildMemorialParcelV378 } from "./memorialParcelMeshV378";
import { DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { createMemorialPlotMeshV378, type BurialGroundV378, type MemorialPlotSolidV378 } from "./memorialsV378Plots";
import source from "./data/memorialsV378Headstones.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { cwgcHeadstoneGeometryV378, graveMarkerGeometryV378, historicGraveScriptV378, type MarkerKindV378 } from "./memorialsV378Markers";
import type { NamedGraveSupportV347 } from "./NamedGravesV347";

type Support = NamedGraveSupportV347 & {hasHost:(tile:string,sha:string)=>boolean};
type Solid = MemorialPlotSolidV378;
type Placed = {mesh:Mesh; native:boolean; base:number; solids:Map<number,Solid[]>};
const FLOOR = 3; // The eight inspected, fingerprinted CWGC host packets share this datum.
const CELL = 4;
function cellKey(i:number,j:number) { return (i+8192)*16384+(j+8192); }
function addSolid(cells:Map<number,Solid[]>, solid:Solid) {
  const ex=(Math.abs(solid.width*solid.cos)+Math.abs(solid.depth*solid.sin))/2;
  const ez=(Math.abs(solid.width*solid.sin)+Math.abs(solid.depth*solid.cos))/2;
  for(let i=Math.floor((solid.x-ex)/CELL);i<=Math.floor((solid.x+ex)/CELL);i++)
    for(let j=Math.floor((solid.z-ez)/CELL);j<=Math.floor((solid.z+ez)/CELL);j++){
      const key=cellKey(i,j),existing=cells.get(key);
      if(existing) existing.push(solid);else cells.set(key,[solid]);
    }
}
function material(){
  return new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.96});
}

const markers: {
  kind:MarkerKindV378; id:string; name:string; x:number; z:number; yaw:number; radius:number;
}[]=[
  // Front of the family plot lies along the nearby, nearly north-to-south path.
  {kind:"mendelssohn",id:"node/281068404",name:"Grabkreuz Felix Mendelssohn Bartholdy",x:1397.406,z:2692.842,yaw:1.636,radius:75},
  {kind:"columbiadamm",id:"Q111397439",name:"Französisches Soldatengrabmal am Columbiadamm",x:2358.880,z:4345.378,yaw:0,radius:130},
];

export function createMemorialsV378(){
  const root=new Group();root.name="Kriegsgräber und Ehrengräber v378";
  const active=new Map<string,Placed>();
  let sampling=false;
  const parkHosts=new Map<BurialGroundV378,Object3D>();
  function originalPark(scene:Object3D,kind:BurialGroundV378,native:boolean) {
    const key=kind==="schoenholz"?"northParksV198":"eastParksV198";
    const cached=parkHosts.get(kind);
    if(cached&&Boolean(cached.userData.blockNative)===native){
      for(let p:Object3D|null=cached;p&&p.visible;p=p.parent) if(p===scene) return cached;
    }
    let found:Object3D|null=null;
    scene.traverseVisible(obj=>{
      if(obj.userData[key]===true&&Boolean(obj.userData.blockNative)===native)found=obj;
    });
    if(found)parkHosts.set(kind,found);else parkHosts.delete(kind);
    return found as Object3D|null;
  }

  function drop(key:string) {
    const entry=active.get(key);
    if(!entry) return false;
    entry.mesh.removeFromParent();
    entry.mesh.geometry.dispose();
    (entry.mesh.material as MeshStandardMaterial).dispose();
    if(entry.mesh instanceof InstancedMesh) entry.mesh.dispose();
    active.delete(key);
    return true;
  }
  function release(){
    const changed=active.size>0;
    for(const key of active.keys()) drop(key);
    parkHosts.clear();
    return changed;
  }
  function place(key:string, mesh:Mesh,native:boolean,base:number,solids:Map<number,Solid[]>) {
    mesh.userData={sourceId:key,textureFree:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native};
    mesh.updateMatrix();mesh.matrixAutoUpdate=false;
    active.set(key,{mesh,native,base,solids});
    root.add(mesh);
  }

  function headstones(tile:(typeof source.tiles)[number],native:boolean) {
    // Only the verified resident terrain can own this tile. Physical markers
    // occupy its photographed grass, outside roads, buildings, water or bridges.
    const poses:{x:number;z:number;yaw:number}[]=[];
    for(const row of tile.rows) {
      const [angle,startX,startZ,deltas]=row as [number,number,number,string];
      const bytes=decodeBase64Bytes(deltas), shifts=new Int8Array(bytes.buffer,bytes.byteOffset,bytes.length);
      let ix=startX, iz=startZ;
      const sourceYaw=angle*Math.PI/1800-Math.PI/2;
      const yaw=native?Math.round(sourceYaw/(Math.PI/2))*Math.PI/2:sourceYaw;
      for(let i=0;i<=shifts.length;i+=2) {
        poses.push({x:source.origin[0]+ix/10,z:source.origin[1]+iz/10,yaw});
        if(i<shifts.length){ix+=shifts[i];iz+=shifts[i+1];}
      }
    }
    const mesh=new InstancedMesh(cwgcHeadstoneGeometryV378(native),material(),poses.length);
    const matrix=new Matrix4(), cells=new Map<number,Solid[]>();
    poses.forEach(({x,z,yaw},i)=>{
      matrix.makeRotationY(yaw);matrix.setPosition(x,FLOOR,z);mesh.setMatrixAt(i,matrix);
      addSolid(cells,{x,z,y:FLOOR,width:.381,depth:.076,low:0,high:.75,cos:Math.cos(yaw),sin:Math.sin(yaw)});
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.name="Gemessene CWGC-Grabstelen "+tile.id;
    place(tile.id,mesh,native,FLOOR,cells);
  }

  return {
    root,
    refresh(x:number,z:number,native:boolean,support:Support,scene:Object3D|null=null,graves:Group|null=null) {
      let changed=false;
      for (const site of memorialParcelsV378) {
        const near=Math.hypot(x-site.center[0],z-site.center[1])<220;
        const old=active.get(site.id);
        if(old && (!near || old.native!==native)) changed=drop(site.id)||changed;
        if(!near || active.has(site.id)) continue;
        const {mesh,solids}=buildMemorialParcelV378(site,native);
        const cells=new Map<number,Solid[]>();
        for (const solid of solids) addSolid(cells,solid);
        place(site.id,mesh,native,site.groundY,cells);changed=true;
      }
      for(const [kind,cx,cz,radius] of [["schoenholz",316,-6882,300],["treptow",6640,3713,310]] as const){
        const near=(x-cx)**2+(z-cz)**2<radius**2;
        const previousHost=parkHosts.get(kind);
        const host=near&&scene?originalPark(scene,kind,native):null;
        const old=active.get(kind);
        if(old&&(!host||old.native!==native||host!==previousHost)) changed=drop(kind)||changed;
        if(!host){parkHosts.delete(kind);continue;}
        if(active.has(kind))continue;
        const surface=kind==="treptow"?()=>3.01:host.userData.burialTerrainHeightV378;
        if(typeof surface!=="function")continue;
        const {mesh,solids}=createMemorialPlotMeshV378(kind,native,surface);
        const cells=new Map<number,Solid[]>();for(const solid of solids)addSolid(cells,solid);
        mesh.name=kind==="schoenholz"?"16 Grabkammern – Schönholzer Heide":"Fünf Gedenkplatten mit Lorbeerkränzen – Treptower Park";
        place(kind,mesh,native,0,cells);changed=true;
      }
      // Place the new lettering only on its independently admitted V347 mesh.
      for(const [key,id] of [["fontane","node/274785461"],["hoffmann","node/4893458668"]] as const){
        const owner=graves?.children.find(o=>o.userData.sourceId===id&&o.userData.blockNative===native);
        const old=active.get(key);
        if(old&&(!owner||old.native!==native||old.base!==owner.position.y+10))changed=drop(key)||changed;
        if(!owner||active.has(key))continue;
        const {geometry,yaw}=historicGraveScriptV378(key,native);
        const mesh=new Mesh(geometry,material()),base=owner.position.y+10;
        mesh.name=key==="fontane"?"Inschriften für Theodor und Emilie Fontane":"Grabinschrift E.T.W. Hoffmann";
        mesh.position.set(owner.position.x+4,base,owner.position.z+4);mesh.rotation.y=yaw;
        place(key,mesh,native,base,new Map());changed=true;
      }
      const nearbyCWGC=(x+10242)**2+(z-1067)**2 < 290**2;
      for(const tile of source.tiles){
        const resident=nearbyCWGC&&support.hasHost(tile.id,tile.sha[native?1:0]);
        const old=active.get(tile.id);
        if(old&&(!resident||old.native!==native)) changed=drop(tile.id)||changed;
        if(resident&&!active.has(tile.id)){headstones(tile,native);changed=true;}
      }
      try {
        sampling=true;
        for(const site of markers){
          const near=(x-site.x)**2+(z-site.z)**2<site.radius**2;
          const base=near?support.ground(site.x,site.z):null;
          let supported=base!==null && Number.isFinite(base);
          if(supported) {
            for(const dx of [-.65,0,.65]) for(const dz of [-.90,0,.90]) {
              const px=site.x+dx,pz=site.z+dz,y=support.ground(px,pz);
              if(y===null||Math.abs(y-base!)>.1||support.water(px,pz)||support.blocked(px,y,pz)) supported=false;
            }
          }
          const old=active.get(site.id);
          if(old&&(!supported||old.native!==native||Math.abs(old.base-base!)>.005)) changed=drop(site.id)||changed;
          if(!supported||active.has(site.id)) continue;
          const {geometry,solids}=graveMarkerGeometryV378(site.kind,native);
          const mesh=new Mesh(geometry,material()),cells=new Map<number,Solid[]>();
          const yaw=native?Math.round(site.yaw/(Math.PI/2))*Math.PI/2:site.yaw, cos=Math.cos(yaw),sin=Math.sin(yaw);
          mesh.name=site.name;mesh.position.set(site.x,base!,site.z);mesh.rotation.y=yaw;
          for(const s of solids) addSolid(cells,{...s,x:site.x+s.x*cos+s.z*sin,z:site.z-s.x*sin+s.z*cos,y:base!,cos,sin});
          place(site.id,mesh,native,base!,cells);changed=true;
        }
      } finally {sampling=false;}
      return changed;
    },
    solidAt(x:number,y:number,z:number,radius:number,native:boolean){
      if(sampling||!root.parent||!root.visible||!root.parent.visible)return false;
      const i=Math.floor(x/CELL),j=Math.floor(z/CELL),r=Math.ceil(radius/CELL);
      for(const entry of active.values()){
        if(entry.native!==native)continue;
        for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
          const members=entry.solids.get(cellKey(i+dx,j+dz));
          if(!members)continue;
          for(const s of members){
            const px=x-s.x,pz=z-s.z;
            const outsideX=Math.max(0,Math.abs(s.cos*px-s.sin*pz)-s.width/2);
            const outsideZ=Math.max(0,Math.abs(s.sin*px+s.cos*pz)-s.depth/2);
            if(outsideX**2+outsideZ**2>radius**2)continue;
            if(s.outer!==undefined&&(Math.hypot(px,pz)>s.outer+radius||Math.hypot(px,pz)<s.inner!-radius))continue;
            const floor=s.floor?s.floor(x,z):s.y;
            if(floor!==null&&y>=floor+s.low&&y<=floor+s.high)return true;
          }
        }
      }
      return false;
    },
    release,
    dispose(){release();root.removeFromParent();},
  };
}
