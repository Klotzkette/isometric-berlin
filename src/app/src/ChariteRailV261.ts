import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/chariteRailV261.json";
import { chariteRingWalls, chariteFacadePointExposed, type ChariteFacadeWall } from "./HistoricChariteCampus";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const CHARITE_LESSER_V261_IDS = new Set(source.parts.filter(p => p.parent.endsWith("0AME")).map(p => p.id));
export const CHARITE_LESSER_V261_TONE = 0xe2d9bd;
type Row = [number, number, number, number, number, number, number, number];
export const CHARITE_RAIL_V261_PROFILE = {
  sourceSha256: source.sourceSha256, sourceParts: 10,
  virologyOwner: "DEBE01YYK00003IB", lesserOwner: "DEBE01YYK0000AME",
  virologyBayWindows: 2, lesserFloors: 5, fittings: source.status,
};

/** Static shallow recognition only: every measured shell and roof stays. */
export function chariteRailRowsV261(native = false): Row[] {
  const rows: Row[] = [];
  const panel = (w: ChariteFacadeWall, u: number, y: number, width: number, height: number, depth: number, tint: number, offset = .32) => {
    if (!native) rows.push([w.x1 + w.dirX*u + w.nx*offset,y,w.z1+w.dirZ*u+w.nz*offset,width,height,depth,-Math.atan2(w.dirZ,w.dirX),tint]);
    else {
      // An independent orthogonal run follows the same measured wall axis.
      const count=Math.max(1,Math.ceil(width/.42)), step=width/count;
      for(let i=0;i<count;i++) {
        const along=u-width/2+(i+.5)*step;
        rows.push([w.x1+w.dirX*along+w.nx*offset,y,w.z1+w.dirZ*along+w.nz*offset,
          Math.abs(w.dirX)*step+Math.abs(w.nx)*depth,height,Math.abs(w.dirZ)*step+Math.abs(w.nz)*depth,0,tint]);
      }
    }
  };
  const brick=0xa86a50, cream=CHARITE_LESSER_V261_TONE, white=0xeeeadd, metal=0x8a9692, glass=0x557375;
  const ruska=source.parts.find(p=>p.id==="mEGhfy5X")!;
  const walls=chariteRingWalls(ruska.ring), roof=(ruska.y0_dm+ruska.h_dm)/10;
  for(const w of walls) {
    // Flat roof's pale cornice and slim safety rail, visible in the 2024 view.
    panel(w,w.length/2,roof-.25,w.length,.30,.52,white,.16);
    for(const dy of [.35,.82])panel(w,w.length/2,roof+dy,w.length,.045,.045,metal,.04);
    for(let u=.15;u<w.length;u+=2)panel(w,u,roof+.43,.045,.86,.045,metal,.04);
    for(const u of [.22,w.length-.22]) {
      if(chariteFacadePointExposed(ruska.id,w,u,13,source.parts))panel(w,u,13.6,.42,15.8,.10,brick,.23);
    }
    // Match existing Ruska openings; add missing transoms and pale upper arches.
    const bays=Math.max(1,Math.floor((w.length-.8)/3.05)), pitch=(w.length-.8)/bays;
    const floorPitch=(ruska.h_dm/10-1.6)/3;
    for(let floor=0;floor<3;floor++)for(let b=0;b<bays;b++) {
      const u=.4+pitch*(b+.5),y=ruska.y0_dm/10+2.4+floor*floorPitch;
      if(!chariteFacadePointExposed(ruska.id,w,u,y,source.parts))continue;
      panel(w,u,y+.46,1.38,.075,.05,white,.31);
      if(floor===2)for(let j=0;j<7;j++) {
        const x=(j-3)*.19,h=.48*Math.sqrt(Math.max(0,1-(x/.7)**2));
        panel(w,u+x,y+1.18+h/2,.20,h+.02,.04,white,.29);
      }
    }
  }
  // Two wood-framed glazed oriels on the exact southwest source projections.
  const sw=walls[2];
  for(const id of ["bzFr0aOE","M09vcMVr"]) {
    const part=source.parts.find(p=>p.id===id)!;
    const x=part.ring.reduce((s,p)=>s+p[0]/10,0)/part.ring.length;
    const z=part.ring.reduce((s,p)=>s+p[1]/10,0)/part.ring.length;
    const u=(x-sw.x1)*sw.dirX+(z-sw.z1)*sw.dirZ;
    // Source projections differ: their outer corners are 1.143 / .918 m
    // beyond the parent wall. Fixed parent-wall offsets buried the first bay.
    const front=Math.max(...part.ring.map(p=>(p[0]/10-sw.x1)*sw.nx+(p[1]/10-sw.z1)*sw.nz));
    const trim=front+(native?.46:.32);
    panel(sw,u,8.7,3.3,2.85,.12,0x615448,front+.10);
    panel(sw,u,8.7,3.06,2.55,.06,glass,front+.22);
    for(const du of [-1.52,-.51,.51,1.52])panel(sw,u+du,8.7,.085,2.66,.08,white,trim);
    for(const dy of [-1.28,.48,1.28])panel(sw,u,8.7+dy,3.13,.08,.08,white,trim);
    panel(sw,u,10.22,3.65,.19,1.42,0x4e6267,front-.40);
    panel(sw,u,7.14,3.35,.28,.93,0xb7b5a4,front-.32);
  }
  // The distinct post-war clinic has five regular floors and pale plaster.
  // Native fittings clear the existing coarse raster skin by one half-cell;
  // its complete source body, roof, and navigation are not substituted.
  const lesser=source.parts.filter(p=>CHARITE_LESSER_V261_IDS.has(p.id));
  for(const p of lesser)for(const w of chariteRingWalls(p.ring)) {
    if(w.length<4)continue;
    const high=p.y0_dm/10+Math.min(p.h_dm/10-2.2,22.7), low=p.y0_dm/10;
    const n=Math.max(1,Math.floor((w.length-.8)/3.3)),pitch=(w.length-.8)/n;
    const outward=native?2.25:.18;
    for(let i=0;i<n;i++) {
      const u=.4+(i+.5)*pitch;
      if(!chariteFacadePointExposed(p.id,w,u,low+10,lesser))continue;
      if(!native)panel(w,u,(high+low)/2,pitch+.01,high-low,.035,cream,outward);
      for(let floor=0;floor<5;floor++) {
        const y=low+2.35+floor*4.18;
        if(y+1.4>high)continue;
        panel(w,u,y,1.67,2.85,.10,0xb8aa87,outward+.07);
        panel(w,u,y,1.46,2.60,.055,white,outward+.14);
        panel(w,u,y,1.27,2.37,.035,glass,outward+.19);
        panel(w,u,y,.065,2.42,.04,white,outward+.22);
        panel(w,u,y+.30,1.30,.075,.04,white,outward+.22);
        panel(w,u,y+1.63,1.94,.13,.20,0xb8aa87,outward+.12);
        panel(w,u,y-1.49,1.85,.12,.25,white,outward+.13);
      }
      for(const y of [low+.38,low+4.45,high-.17])panel(w,u,y,pitch+.01,.17,.18,0xb8aa87,outward+.13);
      if(!native)for(let y=low+.65;y<low+4;y+=.55)panel(w,u,y,pitch,.018,.018,0xb8aa87,outward+.03);
    }
  }
  return rows;
}

export function createChariteRailV261(native=false): Group {
  const root=new Group();root.name="Charite railway-facing Ruska and Lesser v261";
  const rows=chariteRailRowsV261(native),geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.86});
  const mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),color=new Color();
  const transforms=new Float32Array(rows.length*16),tones=new Float32Array(rows.length*3);
  rows.forEach((r,i)=>{matrix.makeRotationY(r[6]);matrix.scale(new Vector3(r[3],r[4],r[5]));matrix.setPosition(r[0],r[1],r[2]);matrix.toArray(transforms,i*16);color.setHex(r[7]).toArray(tones,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(transforms,16);mesh.instanceColor=new InstancedBufferAttribute(tones,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,blockNative:native,textureFree:true};
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  root.userData={...CHARITE_RAIL_V261_PROFILE,sourceEnvelopeRetained:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,instances:rows.length};
  return freezeStaticSceneTransforms(root);
}
