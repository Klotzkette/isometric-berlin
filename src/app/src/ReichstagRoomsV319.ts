import {
  BoxGeometry, BufferAttribute, Color, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import { parliamentRetainedPlanV295 } from "./ParliamentRetainedEnvelopeV295";
import {
  PARLIAMENT_INTERIORS_V295, PARLIAMENT_LOCAL_AIR_V295,
  parliamentLocalPointV295, parliamentWorldPointV295,
} from "./parliamentInteriorsV295Profile";
import { REICHSTAG_LEVELS_V318 } from "./ReichstagRoomsV318";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = readonly [number, number, number];
type FootPoint = readonly [number, number];
type RoomType = "service" | "reading" | "lounge" | "briefing" | "press" | "office" | "meeting" | "reception";
export type ReichstagSectionRoomV319 = {
  id: string; level: number; floor: number; height: number; kind: RoomType;
  min: Point; max: Point; doorZ: number; openWestFace: true;
};
export type ReichstagSectionMemberV319 = {
  position: Point; size: Point; color: number; role: string; room: string;
};

const retained = parliamentRetainedPlanV295();
const outer = retained.ring.map(([x,z]) => [x/10,z/10] as const);
const holes = (retained.holes ?? []).map(r => r.map(([x,z]) => [x/10,z/10] as const));
const westLimit = -7.6;
const yaw = PARLIAMENT_INTERIORS_V295.reichstag.yaw;

function inside(p: FootPoint, ring: readonly FootPoint[]): boolean {
  let hit = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if ((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}
function crosses(a: FootPoint,b: FootPoint,c: FootPoint,d: FootPoint): boolean {
  if (Math.max(a[0],b[0])<Math.min(c[0],d[0])-1e-8 || Math.max(c[0],d[0])<Math.min(a[0],b[0])-1e-8 ||
    Math.max(a[1],b[1])<Math.min(c[1],d[1])-1e-8 || Math.max(c[1],d[1])<Math.min(a[1],b[1])-1e-8) return false;
  const turn=(p:FootPoint,q:FootPoint,r:FootPoint) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return turn(a,b,c)*turn(a,b,d)<=1e-12 && turn(c,d,a)*turn(c,d,b)<=1e-12;
}

/** Entire convex footprint, including edge crossings and an enclosed courtyard.
 * Input is an ordered, non-self-intersecting world-XZ polygon. Basement callers
 * may reuse this source-plan contract independently of exhibition cut height. */
export function reichstagSectionFootprintContainsV319(footprint: readonly FootPoint[]): boolean {
  if (footprint.length<3 || footprint.some(p=>p.length!==2 || !p.every(Number.isFinite))) return false;
  let sign=0;
  for (let i=0;i<footprint.length;i++) {
    const a=footprint[i],b=footprint[(i+1)%footprint.length],c=footprint[(i+2)%footprint.length];
    const turn=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if (Math.abs(turn)<1e-10) return false;
    if (sign && Math.sign(turn)!==sign) return false;
    sign=Math.sign(turn);
  }
  if (footprint.some(p=>!inside(p,outer) || holes.some(h=>inside(p,h)))) return false;
  for (const boundary of [outer,...holes]) {
    for (let i=0;i<footprint.length;i++) for (let j=0;j<boundary.length;j++) {
      if (crosses(footprint[i],footprint[(i+1)%footprint.length],boundary[j],boundary[(j+1)%boundary.length])) return false;
    }
  }
  return holes.every(h=>h.every(p=>!inside(p,footprint)));
}

function footprintFor(center: Point,size: Point,native: boolean): FootPoint[] {
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  const world=parliamentWorldPointV295("reichstag",center);
  return corners.map(([x,z])=>{
    const q=native ? [world[0]+x*size[0]/2,center[1],world[2]+z*size[2]/2] :
      parliamentWorldPointV295("reichstag",[center[0]+x*size[0]/2,center[1],center[2]+z*size[2]/2]);
    return [q[0],q[2]];
  });
}

/** Every furniture/wall volume clears all six courts and public chamber,
 * foyer, stair and dome air, in its actual drawn or cardinal construction. */
export function reichstagSectionBoxFitsV319(center: Point,size: Point,native=false): boolean {
  if (![...center,...size].every(Number.isFinite) || size.some(v=>v<=0)) return false;
  const footprint=footprintFor(center,size,native);
  if (!reichstagSectionFootprintContainsV319(footprint)) return false;
  const local=footprint.map(([x,z])=>parliamentLocalPointV295("reichstag",x,center[1],z));
  const min=[Math.min(...local.map(p=>p[0])),center[1]-size[1]/2,Math.min(...local.map(p=>p[2]))];
  const max=[Math.max(...local.map(p=>p[0])),center[1]+size[1]/2,Math.max(...local.map(p=>p[2]))];
  return min[0]>=westLimit && PARLIAMENT_LOCAL_AIR_V295.reichstag.every(air =>
    min.some((v,i)=>v>=air.max[i]-1e-7 || max[i]<=air.min[i]+1e-7));
}

const types: readonly (readonly RoomType[])[] = [
  ["service","service"],
  ["reading","lounge","briefing"],
  ["briefing","press","reading"],
  ["office","meeting","reception"],
  ["office","meeting","meeting"],
];

/** Public room TYPES follow Bundestag descriptions. These compact room bays,
 * dimensions and furniture placements are a section-display interpretation. */
export const REICHSTAG_SECTION_LAYOUT_V319: readonly ReichstagSectionRoomV319[] =
  REICHSTAG_LEVELS_V318.flatMap((level,index)=>{
    const ceiling=REICHSTAG_LEVELS_V318[index+1]?.y ?? PARLIAMENT_INTERIORS_V295.reichstag.terrace;
    const height=ceiling-level.y-.35;
    const bays=index===0 ? [[44.4,53.2],[53.6,63.1]] : [[44.4,49.3],[49.7,56.2],[56.6,63.1]];
    return [-1,1].flatMap(side=>bays.map(([a,b],bay)=>{
      const z0=side<0?-b:a,z1=side<0?-a:b;
      return {id:`level-${index}-${side<0?"north":"south"}-${bay}`,level:index,floor:level.y,height,
        kind:types[index][bay],min:[-7.1,level.y,z0] as Point,max:[12.55,level.y+height,z1] as Point,
        doorZ:(z0+z1)/2,openWestFace:true as const};
    }));
  });

const tones={wood:0xb99a70,desk:0xc9af86,wall:0xd4ccbc,frame:0x939c9b,
  charcoal:0x333d43,screen:0x638d9a,chair:0x676e80,books:[0x8a7b65,0x6d7e78,0x9a7167,0xb8aa89]};

/** Small semantic member inventory also exposes exact bounds for integration QA. */
export function reichstagSectionMembersV319(native=false): readonly ReichstagSectionMemberV319[] {
  const out: ReichstagSectionMemberV319[]=[];
  for (const room of REICHSTAG_SECTION_LAYOUT_V319) {
    const f=room.floor,z=(room.min[2]+room.max[2])/2,width=room.max[2]-room.min[2];
    const add=(p:Point,s:Point,color:number,role:string):void=>{
      if (reichstagSectionBoxFitsV319(p,s,native)) out.push({position:p,size:s,color,role,room:room.id});
    };
    const chair=(x:number,zz:number,axis:"u"|"v",backSign=1):void=>{
      add([x,f+.48,zz],[.56,.12,.56],tones.chair,"upholstered chair seat");
      add([x+(axis==="u"?backSign*.25:0),f+.84,zz+(axis==="v"?backSign*.25:0)],
        axis==="u"?[.11,.62,.56]:[.56,.62,.11],tones.chair,"upholstered chair back");
      add([x,f+.23,zz],[.07,.40,.07],tones.frame,"chair stem");
      add([x,f+.045,zz],[.43,.07,.43],tones.charcoal,"chair base");
    };
    const desk=(x:number,zz:number):void=>{
      add([x,f+.76,zz],[2.2,.11,1.05],tones.desk,"office desktop");
      for (const dx of [-.78,.78]) add([x+dx,f+.35,zz],[.32,.70,.70],tones.wall,"desk pedestal");
      add([x+.36,f+1.17,zz],[.10,.48,.74],tones.charcoal,"monitor housing");
      add([x+.30,f+1.17,zz],[.025,.36,.61],tones.screen,"monitor screen");
      add([x+.36,f+.92,zz],[.06,.18,.06],tones.frame,"monitor stand");
      add([x-.16,f+.83,zz],[.32,.035,.61],tones.charcoal,"keyboard");
      chair(x-1.23,zz,"u",-1);
    };
    const shelves=(x:number,zz:number):void=>{
      add([x,f+.95,zz],[.36,1.9,2.5],tones.wood,"bookcase backing");
      for (let row=0;row<2;row++) {
        add([x-.14,f+.30+row*.68,zz],[.56,.075,2.5],tones.desk,"bookcase shelf");
        for (let book=0;book<3;book++) add([x-.18,f+.53+row*.68,zz+(book-1)*.66],
          [.45,.39,.46],tones.books[(book+room.level)%tones.books.length],"bound books");
      }
    };
    const sofa=(x:number,zz:number):void=>{
      add([x,f+.35,zz],[.98,.38,2.05],0x8d8377,"lounge sofa seat");
      add([x+.43,f+.73,zz],[.16,.72,2.05],0x817b73,"lounge sofa back");
      for (const side of [-1,1]) add([x,f+.55,zz+side*.98],[.98,.46,.14],0x817b73,"lounge sofa arm");
    };

    // The western face stays absent. Back walls, side partitions and the
    // actual open door expose furnished spaces from the section.
    add([2.55,f+.018,z],[19.35,.036,width-.10],room.level===0?0xaaa99e:0xc3b194,"warm room floor finish");
    add([5.2,f+.045,z],[1.9,.035,width-.12],0xaaa99a,"continuous corridor runner");
    add([12.40,f+room.height/2,z],[.18,room.height,width],tones.wall,"rear room partition");
    add([2.6,f+room.height/2,room.min[2]+.08],[19.3,room.height,.16],tones.wall,"room side partition");
    if (room.id.endsWith("-2") || room.level===0 && room.id.endsWith("-1"))
      add([2.6,f+room.height/2,room.max[2]-.08],[19.3,room.height,.16],tones.wall,"end wing partition");
    const doorHeight=Math.min(2.18,room.height-.12),doorHalf=.65;
    for (const side of [-1,1]) {
      const edge=side<0?room.min[2]+.16:room.max[2]-.16;
      const length=Math.abs(edge-(z+side*doorHalf));
      add([3.8,f+room.height/2,(edge+z+side*doorHalf)/2],[.14,room.height,length],tones.wall,"corridor partition beside open door");
      add([3.68,f+doorHeight/2,z+side*(doorHalf+.05)],[.19,doorHeight,.09],REICHSTAG_LEVELS_V318[room.level].color,"level-coded door jamb");
    }
    add([3.8,f+(room.height+doorHeight)/2,z],[.14,room.height-doorHeight,1.3],tones.wall,"open door lintel");
    add([3.68,f+doorHeight+.045,z],[.19,.09,1.48],REICHSTAG_LEVELS_V318[room.level].color,"level-coded door head");
    add([-.4,f+room.height-.17,z],[3.6,.055,.24],0xe1d3b6,"ceiling light strip");
    add([11.80,f+.72,z+.6],[.62,1.44,2.2],0xa2957f,"rear storage cabinet");
    for (const side of [-1,1]) add([11.46,f+.78,z+.6+side*.53],[.045,1.14,1.0],0xb5a58b,"cabinet door");

    if (room.kind==="service") {
      for (const x of [-4.7,-1.9]) {
        add([x,f+.82,z],[1.9,1.64,.62],0x929b97,"service storage rack");
        for (const side of [-1,1]) add([x+side*.43,f+.50,z-.36],[.70,.58,.45],0xafaa98,"records storage box");
      }
      add([.7,f+.80,z],[1.3,.10,2.8],tones.wood,"service workbench");
      continue;
    }
    if (room.kind==="office" || room.kind==="press") {
      desk(-3.45,z-.85);
      if (room.kind==="press") desk(.35,z+1.12);
      shelves(2.85,z+width/2-1.55);
      add([.35,f+.06,z-.85],[3.0,.035,2.3],0x918b7b,"desk area rug");
    } else if (room.kind==="meeting" || room.kind==="briefing") {
      add([-1.4,f+.77,z],[4.5,.13,1.65],tones.desk,"conference table");
      for (const x of [-2.9,.1]) add([x,f+.35,z],[.28,.70,.90],tones.frame,"conference table support");
      for (const side of [-1,1]) for (const x of [-2.9,-1.4,.1]) chair(x,z+side*1.20,"v",side);
      add([2.95,f+1.43,z],[.10,1.15,2.15],tones.frame,"presentation board frame");
      add([2.89,f+1.43,z],[.025,1.0,2.0],0xd9dcd5,"presentation board");
      for (const x of [-2.1,-.8]) add([x,f+.86,z],[.40,.035,.28],0xe4dfce,"meeting papers");
    } else if (room.kind==="reading") {
      shelves(2.85,z);
      add([-2.0,f+.75,z],[2.7,.11,1.35],tones.desk,"reading table");
      for (const x of [-2.95,-1.05]) add([x,f+.35,z],[.16,.70,.9],tones.frame,"reading table leg");
      for (const side of [-1,1]) chair(-2.0,z+side*1.05,"v",side);
      for (const dx of [-.55,.55]) add([-2.0+dx,f+.83,z],[.58,.045,.42],0xe1d7b9,"open reference book");
    } else {
      sofa(-.35,z-width/2+1.25);
      sofa(-.35,z+width/2-1.25);
      add([-2.2,f+.40,z],[1.15,.10,1.60],tones.desk,"reception low table");
      add([-2.2,f+.18,z],[.62,.36,.90],tones.charcoal,"reception table base");
      add([-2.2,f+.47,z],[.50,.035,.31],0xc6b79e,"reception reading matter");
      add([-2.2,f+.035,z],[3.2,.035,Math.min(4.6,width-.6)],0x9e8d78,"reception woven rug");
      shelves(2.85,z);
    }
  }
  return out;
}

/** Section-only additive group. The existing v318 slabs and public v295 rooms
 * remain the parent controller's retained layers, without new walking routes. */
export function createReichstagSectionFurnishingsV319(native=false): Group {
  const rows=reichstagSectionMembersV319(native),root=new Group();
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const normals=geometry.getAttribute("normal"),shades=new Uint8Array(normals.count*3);
  for (let i=0;i<normals.count;i++) {
    const shade=normals.getY(i)>.5?255:normals.getY(i)<-.5?170:normals.getX(i)>.5?223:normals.getX(i)<-.5?190:210;
    shades.fill(shade,i*3,i*3+3);
  }
  geometry.setAttribute("color",new BufferAttribute(shades,3,true));
  const day=new MeshBasicMaterial({vertexColors:true});
  const night=new MeshStandardMaterial({vertexColors:true,roughness:.84,flatShading:native});
  const mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),scale=new Vector3(),color=new Color();
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  rows.forEach((r,i)=>{
    if (native) matrix.makeScale(...r.size);
    else matrix.makeRotationY(yaw).scale(scale.set(...r.size));
    matrix.setPosition(...parliamentWorldPointV295("reichstag",r.position));
    matrix.toArray(matrices,i*16);color.setHex(r.color).toArray(colors,i*3);
  });
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);
  mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name="Cut-open Reichstag offices, meeting rooms, library and press workspaces";
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,keepInMinecraft:native};
  root.name=`Reichstag furnished section v319${native?" native":""}`;
  root.add(mesh);
  root.userData={sectionOnly:true,native,blockNative:native,keepInMinecraft:native,textureFree:true,
    fullStaticDetailOnTouch:true,estimatedInteriorPlan:true,sourceCourtyardCount:holes.length,
    openWestFace:true,memberCount:rows.length,roomCount:REICHSTAG_SECTION_LAYOUT_V319.length,
    roleCounts:rows.reduce<Record<string,number>>((counts,r)=>{counts[r.role]=(counts[r.role]??0)+1;return counts;},{})};
  return freezeStaticSceneTransforms(root);
}
