import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import source from "./data/tramRailsV281.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = readonly number[];
type Batch = { positions:number[]; indices:number[]; ids:Set<string> };
const key=(p:Point)=>`${p[0]}:${p[1]}`;

/** Same retained central terrain cells as the road owner, also west of the
 * older Alt-Mitte mask. A surrounding-terrain fallback sank the Hbf tracks. */
export function tramGroundV281(x:number,z:number,native=false):number {
  const g=source.ground,sx=(x-g.origin[0])/g.step-(native?0:.5),sz=(z-g.origin[1])/g.step-(native?0:.5);
  const ix=Math.floor(sx),iz=Math.floor(sz),tx=sx-ix,tz=sz-iz;
  const at=(a:number,b:number)=>g.heightsDm[Math.max(0,Math.min(g.rows-1,b))*g.cols+Math.max(0,Math.min(g.cols-1,a))]/10;
  return native?at(ix,iz):(at(ix,iz)*(1-tx)+at(ix+1,iz)*tx)*(1-tz)+(at(ix,iz+1)*(1-tx)+at(ix+1,iz+1)*tx)*tz;
}
export const tramRailHeightV281=(x:number,z:number,native=false)=>tramGroundV281(x,z,native)+(native?.035:.215);

/** Intersect adjacent parallel offsets at each retained vertex. Unlike isolated
 * segment normals this closes bends without shifting the source centreline. */
export function tramOffsetNormalsV281(points:readonly Point[], neighbours:Map<string,number[][]>=new Map()):number[][] {
  const unit=(a:Point,b:Point)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);return l>1e-9?[dx/l,dz/l]:null;};
  return points.map((p,i)=>{
    let before:number[]|null=null,after:number[]|null=null;
    for(let j=i-1;j>=0&&!before;j--)before=unit(points[j],p);
    for(let j=i+1;j<points.length&&!after;j++)after=unit(p,points[j]);
    const current=after??before;
    if(!current)return [0,0];
    if(!before||!after){
      const outgoing=after??before!.map(v=>-v);
      const candidates=(neighbours.get(key(p))??[]).filter(d=>d[0]*outgoing[0]+d[1]*outgoing[1]<.5);
      candidates.sort((a,b)=>(a[0]*outgoing[0]+a[1]*outgoing[1])-(b[0]*outgoing[0]+b[1]*outgoing[1]));
      if(candidates.length){if(!before)before=candidates[0].map(v=>-v);else after=candidates[0];}
    }
    before??=after;after??=before;
    const ax=-before![1],az=before![0],bx=-after![1],bz=after![0],den=1+ax*bx+az*bz;
    // A true reversal is kept capped; no speculative rail join is introduced.
    return den>.25?[(ax+bx)/den,(az+bz)/den]:[-current[1],current[0]];
  });
}

/** Additional railheads only: exact old roads, wires, six v270 rail courses,
 * bridges and other source owners are never modified. Full detail on touch. */
export function createTramRailsV281(native=false):Group {
  const root=new Group();root.name="Source-aligned central tram railheads v281";
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,sourceGeometryRetained:true,trackCount:source.tracks.length,gaugeM:source.gaugeM};
  const neighbours=new Map<string,number[][]>();
  for(const t of source.tracks)for(let i=1;i<t.points.length;i++){
    const a=t.points[i-1],b=t.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<1e-9)continue;
    for(const [p,d] of [[a,[dx/l,dz/l]],[b,[-dx/l,-dz/l]]] as const){const values=neighbours.get(key(p))??[];values.push([...d]);neighbours.set(key(p),values);}
  }
  const batches=new Map<string,Batch>();
  const quad=(corners:number[][],id:string)=>{
    const x=corners.reduce((s,p)=>s+p[0],0)/4,z=corners.reduce((s,p)=>s+p[2],0)/4,k=`${Math.floor(x/512)}:${Math.floor(z/512)}`;
    const batch=batches.get(k)??{positions:[],indices:[],ids:new Set<string>()};batches.set(k,batch);
    const start=batch.positions.length/3;
    for(const p of corners)batch.positions.push(...p);
    for(const i of [0,1,2,0,2,3])batch.indices.push(start+i);
    batch.ids.add(id);
  };
  const nativeRail=(a:Point,b:Point,id:string)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1e-7)return;
    const nx=-dz/len*source.headWidthM/2,nz=dx/len*source.headWidthM/2;
    const y=tramRailHeightV281((a[0]+b[0])/2,(a[1]+b[1])/2,true);
    quad([[a[0]+nx,y,a[1]+nz],[b[0]+nx,y,b[1]+nz],[b[0]-nx,y,b[1]-nz],[a[0]-nx,y,a[1]-nz]],id);
  };
  for(const track of source.tracks){
    const normals=tramOffsetNormalsV281(track.points,neighbours);
    for(let i=1;i<track.points.length;i++){
      const a=track.points[i-1].map(v=>v/10),b=track.points[i].map(v=>v/10),len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-8)continue;
      for(const side of [-1,1]){
        const offset=(p:Point,n:Point,v:number)=>[p[0]+n[0]*v,p[1]+n[1]*v];
        const mid=side*source.gaugeM/2,half=source.headWidthM/2;
        const ac=offset(a,normals[i-1],mid),bc=offset(b,normals[i],mid);
        const al=offset(a,normals[i-1],mid+half),ar=offset(a,normals[i-1],mid-half);
        const bl=offset(b,normals[i],mid+half),br=offset(b,normals[i],mid-half);
        const count=Math.max(1,Math.ceil(len/(native?.5:2)));
        const mix=(p:Point,q:Point,t:number)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
        for(let j=0;j<count;j++){
          const t=j/count,u=(j+1)/count;
          if(native){const p=mix(ac,bc,t),q=mix(ac,bc,u),corner=[q[0],p[1]];nativeRail(p,corner,track.id);nativeRail(corner,q,track.id);}
          else quad([mix(al,bl,t),mix(al,bl,u),mix(ar,br,u),mix(ar,br,t)].map(([x,z])=>[x,tramRailHeightV281(x,z,false),z]),track.id);
        }
      }
    }
  }
  const day=new MeshBasicMaterial({color:0x9ca8ac,side:DoubleSide});
  const night=new MeshStandardMaterial({color:0x9ca8ac,roughness:.65,side:DoubleSide});
  for(const [cell,batch] of batches){
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array(batch.positions),3));
    geometry.setIndex(batch.positions.length/3<65536?new BufferAttribute(new Uint16Array(batch.indices),1):new BufferAttribute(new Uint32Array(batch.indices),1));
    if(native){const normals=new Int8Array(batch.positions.length);for(let i=1;i<normals.length;i+=3)normals[i]=127;geometry.setAttribute("normal",new BufferAttribute(normals,3,true));}else geometry.computeVertexNormals();
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new Mesh(geometry,day);mesh.name=`Central tram paired railheads ${cell} v281`;
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native,sourceTrackIds:[...batch.ids]};root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
