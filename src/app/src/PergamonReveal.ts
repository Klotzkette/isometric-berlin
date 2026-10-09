import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Material, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Raycaster, ShapeUtils, Vector2, Vector3, DoubleSide } from 'three';
import { MUSEUM_TRIAD_SOURCES, NATIONALGALERIE_FRAME, nationalgalerieLocal } from './museumTriadProfile';

export const PERGAMON_ALTAR_FRAME = { u: -50.5, v: -75.9, y: 4.2, yaw: NATIONALGALERIE_FRAME.yaw - Math.PI / 2 } as const;
export function pergamonWorld(u:number, y:number, v:number): Vector3 {
  const f = NATIONALGALERIE_FRAME, c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return new Vector3(f.x + c*u + s*v, y, f.z - s*u + c*v);
}
function visible(object:Object3D):boolean {
  for(let p:Object3D|null=object;p;p=p.parent) if(!p.visible)return false;
  return true;
}
/** Exact source sheets for bounded picking, independent of parked city buffers.
 * Adjacent Neues Museum / Nationalgalerie occlude a Pergamon click. */
function pickingMeshes(): Mesh[] {
  return MUSEUM_TRIAD_SOURCES.map((source, which) => {
    const vertices:number[]=[];
    for(const part of source.parts)for(const surface of part.surfaces){
      const ring=surface.rings[0], normal=new Vector3();
      for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];normal.x+=(a[1]-b[1])*(a[2]+b[2]);normal.y+=(a[2]-b[2])*(a[0]+b[0]);normal.z+=(a[0]-b[0])*(a[1]+b[1]);}
      const axis=Math.abs(normal.y)>Math.max(Math.abs(normal.x),Math.abs(normal.z))?1:Math.abs(normal.x)>Math.abs(normal.z)?0:2;
      const project=(p:number[])=>axis===1?new Vector2(p[0],p[2]):axis===0?new Vector2(p[2],p[1]):new Vector2(p[0],p[1]);
      for(const triangle of ShapeUtils.triangulateShape(ring.map(project),[]))for(const i of triangle)vertices.push(...ring[i]);
    }
    const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
    geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));
    mesh.userData.pergamonPick=which===0;
    return mesh;
  });
}
/** Three principal masses only; no windows, tessellation or minor roof lines. */
export function createPergamonOutline(): LineSegments {
  const source=MUSEUM_TRIAD_SOURCES[0], lines:number[]=[];
  const families=[['DEBE3DKEaAKJ8HLe'],['DEBE3DE5tHN43NVQ','DEBE3DxXNchvDadf'],['DEBE3DiGGe7UaHKY','DEBE3DfXhdiYAP3V']];
  for(const ids of families){
    const parts=source.parts.filter(p=>ids.includes(p.id)), pts=parts.flatMap(p=>p.ring.map(([x,z])=>nationalgalerieLocal(x,z)));
    const u0=Math.min(...pts.map(p=>p[0])),u1=Math.max(...pts.map(p=>p[0])),v0=Math.min(...pts.map(p=>p[1])),v1=Math.max(...pts.map(p=>p[1]));
    const base=1.214, top=Math.max(...parts.map(p=>p.top_y_m));
    const ring=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
    for(let i=0;i<4;i++){
      const a=ring[i],b=ring[(i+1)%4];
      for(const y of [base,top])lines.push(...pergamonWorld(a[0],y,a[1]).toArray(),...pergamonWorld(b[0],y,b[1]).toArray());
      lines.push(...pergamonWorld(a[0],base,a[1]).toArray(),...pergamonWorld(a[0],top,a[1]).toArray());
    }
  }
  const outline=new LineSegments(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(lines,3)),new LineBasicMaterial({color:0x9badaf,transparent:true,opacity:.48,depthWrite:false,toneMapped:false}));
  outline.name='Pergamonmuseum — 36 principal contour lines';
  outline.raycast=()=>{};
  return outline;
}

export type PergamonReveal = ReturnType<typeof createPergamonReveal>;
export function createPergamonReveal(options: {
  scene: Object3D; camera: PerspectiveCamera; canvas: HTMLCanvasElement;
  invalidate: ()=>void; disposeObject:(root:Object3D)=>void;
  onError:(error:unknown)=>void; reducedMotion:boolean;
  initiallyRevealed?: boolean; onChange?: (revealed:boolean)=>void;
}) {
  let revealed=false, disposed=false, pending=false, startedAt=0, lastTapAt=-Infinity;
  let root:Group|null=null, picks:Mesh[]|null=null;
  const owners=new Set<Object3D>(), ray=new Raycaster(), ndc=new Vector2();
  const materials=new Set<Material>();
  ray.far=2400;
  const sync=()=>{
    owners.clear();
    options.scene.traverse(o=>{if(o.userData.pergamonExterior)owners.add(o);});
    for(const owner of owners) owner.visible=!revealed;
    if(root)root.visible=revealed;
  };
  const hit=(x:number,y:number)=>{
    sync();
    if(![...owners].some(o=>o.parent&&visible(o.parent)))return false;
    const r=options.canvas.getBoundingClientRect();
    if(r.width<=0||r.height<=0||x<r.left||x>r.right||y<r.top||y>r.bottom)return false;
    ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);
    ray.setFromCamera(ndc,options.camera);
    picks??=pickingMeshes();
    return ray.intersectObjects(picks,false)[0]?.object.userData.pergamonPick===true;
  };
  const toggle=async()=>{
    if(disposed||pending)return;
    if(revealed){revealed=false;options.onChange?.(false);sync();options.invalidate();return;}
    if(!root){
      pending=true;
      try {
        const {createPergamonAltarV204}=await import('./PergamonAltarV204');
        if(disposed)return;
        const altar=createPergamonAltarV204();
        const f=PERGAMON_ALTAR_FRAME;
        altar.position.copy(pergamonWorld(f.u,f.y,f.v));altar.rotation.y=f.yaw;altar.updateMatrix();
        root=new Group();root.name='Pergamon Altar — reversible museum reveal';
        root.userData.pergamonReveal=true;
        root.add(altar,createPergamonOutline());
        root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
        options.scene.add(root);
      }catch(error){if(!disposed)options.onError(error);return;}finally{pending=false;}
    }
    revealed=true;options.onChange?.(true);startedAt=performance.now();sync();options.invalidate();
  };
  if(options.initiallyRevealed) void toggle();
  return {
    get revealed(){return revealed;},
    sync,
    hit,
    tap(x:number,y:number):boolean{
      if(!hit(x,y))return false;
      const now=performance.now();
      // Browser dblclick / double-tap belongs to this exhibit, not zoom/jump.
      if(now-lastTapAt>400){lastTapAt=now;void toggle();}
      return true;
    },
    update(now:number):boolean{
      if(!revealed||!root)return false;
      const t=options.reducedMotion?1:Math.min(1,Math.max(0,(now-startedAt)/420));
      let changed=false;
      for(const m of materials){const max=m instanceof LineBasicMaterial?.48:1,next=max*(t*t*(3-2*t));if(m.opacity!==next){m.opacity=next;const transparent=next<1;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}changed=true;}}
      return changed;
    },
    dispose(){disposed=true;for(const p of picks??[]){p.geometry.dispose();(p.material as Material).dispose();}picks=null;if(root){options.disposeObject(root);root=null;}for(const owner of owners)owner.visible=true;owners.clear();materials.clear();},
  };
}
