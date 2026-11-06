import{expect,test}from'bun:test';
import{Mesh,Group}from'three';
import data from'../src/data/berlinSenateBuildingsV321.json';
import{createPackedRootV307,type RequiredPackedV307}from'../src/requiredPackedRootV307';
import{createBerlinSenateUpperWindowsV321Steps,completeBerlinSenateUpperWindowsV321}from'../src/BerlinSenateUpperWindowsV321';
import{parkStaticGeometrySteps,parkStaticInstancesSteps}from'../src/losslessStaticStorage';
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const r=g.next();if(r.done)return r.value;}};
function inRing(r:number[][],x:number,z:number){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function fixture(key:string){const q=data.models.find(p=>p.key===key)as RequiredPackedV307,root=createPackedRootV307(Symbol('source'),'actual source',q.native,[q],{});return{q,parent:root.children[0]as Mesh};}
function dispose(g:Group|Mesh){const seen=new Set<any>();g.traverse((o:any)=>{for(const x of[o.geometry,o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(x?.dispose&&!seen.has(x)){seen.add(x);x.dispose();}});g.clear();}
test('all four exact new upper bodies receive nonempty measured-wall-contained windows without editing source words',()=>{for(const key of['education-bounded-roof','urban-bounded-roof','education-cardinal-roof','urban-cardinal-roof']){const{q,parent}=fixture(key),geometry=parent.geometry,position=geometry.getAttribute('position'),before=Buffer.from(position.array.buffer,position.array.byteOffset,position.array.byteLength).toString('base64'),kit=drain(createBerlinSenateUpperWindowsV321Steps(parent,q,q.native));
 expect(completeBerlinSenateUpperWindowsV321(kit,parent,q.native)).toBeTrue();expect(kit.userData.upperWindowCount).toBeGreaterThan(20);expect(parent.geometry).toBe(geometry);expect(parent.geometry.getAttribute('position')).toBe(position);expect(Buffer.from(position.array.buffer,position.array.byteOffset,position.array.byteLength).toString('base64')).toBe(before);
 const glass=kit.children[1]as Mesh,p=glass.geometry.getAttribute('position');expect(p.count).toBe(kit.userData.upperWindowCount*4);
 const solids=data.navigation[q.native?'native':'drawn'].filter(r=>r.site===(key.startsWith('education')?'education':'urban'));
 const solid=(x:number,y:number,z:number)=>solids.some(r=>y>r.bottom&&y<r.top&&inRing(r.ring,x,z)&&!r.holes.some(h=>inRing(h,x,z)));
 for(let i=0;i<p.count;i+=4){const ys=[0,1,2,3].map(j=>p.getY(i+j));expect(Math.min(...ys)).toBeGreaterThan(key.startsWith('education')?6:29.25);expect(Math.max(...ys)).toBeLessThan(key.startsWith('education')?34.745:66);const dx=p.getX(i+1)-p.getX(i),dz=p.getZ(i+1)-p.getZ(i),length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  if(q.native)expect(Math.min(Math.abs(dx),Math.abs(dz))).toBeLessThan(1e-6);
  // Independent compiled-volume test: each actual glass corner must lie on a
  // boundary between real represented solid and open air, including all courts.
  for(let j=0;j<4;j++){const x=p.getX(i+j),y=p.getY(i+j),z=p.getZ(i+j);expect(solid(x+nx*.35,y,z+nz*.35)!==solid(x-nx*.35,y,z-nz*.35)).toBeTrue();}
 }
 const night=glass.userData.nightMaterial;expect(night.userData.nightEmissive).toBe(0xffcb92);expect(night.userData.nightEmissiveIntensity).toBe(.48);drain(parkStaticGeometrySteps(kit));drain(parkStaticInstancesSteps(kit));expect(completeBerlinSenateUpperWindowsV321(kit,parent,q.native)).toBeTrue();dispose(parent);
 }});
test('wrong source, changed actual source mesh, wrong mode and manual disposal close admission',()=>{const f=fixture('urban-bounded-roof');expect(()=>drain(createBerlinSenateUpperWindowsV321Steps(f.parent,{...f.q,key:'foreign-source'},false))).toThrow();expect(()=>drain(createBerlinSenateUpperWindowsV321Steps(f.parent,f.q,true))).toThrow();f.parent.geometry.getAttribute('position').setX(0,1);expect(()=>drain(createBerlinSenateUpperWindowsV321Steps(f.parent,f.q,false))).toThrow();dispose(f.parent);
 const n=fixture('education-bounded-roof'),kit=drain(createBerlinSenateUpperWindowsV321Steps(n.parent,n.q,false));n.parent.geometry.dispose();expect(completeBerlinSenateUpperWindowsV321(kit,n.parent,false)).toBeFalse();dispose(n.parent);
});
test('cooperative cancellation leaves no partial child or source mutation; transformed child and copied label never admit',()=>{const f=fixture('education-bounded-roof'),geometry=f.parent.geometry,g=createBerlinSenateUpperWindowsV321Steps(f.parent,f.q,false);expect(g.next().done).toBeFalse();g.return(new Group());expect(f.parent.children).toHaveLength(0);expect(f.parent.geometry).toBe(geometry);const kit=drain(createBerlinSenateUpperWindowsV321Steps(f.parent,f.q,false));kit.position.x=1;expect(completeBerlinSenateUpperWindowsV321(kit,f.parent,false)).toBeFalse();expect(completeBerlinSenateUpperWindowsV321(kit.clone(true),f.parent,false)).toBeFalse();dispose(f.parent);});
