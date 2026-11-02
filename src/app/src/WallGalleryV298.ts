import {BoxGeometry,BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Material,Mesh,Object3D,MeshBasicMaterial,MeshStandardMaterial,ShapeUtils,Vector2,Vector3} from 'three';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {TOPOGRAPHY_TERROR_SOURCE,topographySourceGroundAt} from './topographyTerrorProfile';
import {wallArtDrawingV298} from './WallGalleryArtV298';
import {WALL_GALLERY_V298_DATA as D,WALL_GALLERY_V298_PROFILE,wallGalleryHillGroundAtV298,wallPointInRingV298} from './wallGalleryV298Profile';
type V3=[number,number,number];
type Row={p:V3;s:V3;yaw:number;tone:number;role:string};
type Tri={p:V3[];tone:number;role:string};
export function wallGalleryGeometryV298(native=false) {
 const rows:Row[]=[],triangles:Tri[]=[];const roles:Record<string,number>={};
 const raw=(p:V3,s:V3,tone:number,role:string,yaw=0)=>{if(![...p,...s,yaw].every(Number.isFinite)||s.some(v=>v<=0))throw Error('Invalid wall member');rows.push({p,s,tone,role,yaw});roles[role]=(roles[role]??0)+1;};
 const box=(p:V3,s:V3,tone:number,role:string,yaw=0)=>{
  if(!native){raw(p,s,tone,role,yaw);return;}
  const c=Math.cos(yaw),sn=-Math.sin(yaw),step=role.startsWith('tower:')?3:.8,n=Math.max(1,Math.ceil(s[0]/step)),m=Math.max(1,Math.ceil(s[2]/step));
  for(let i=0;i<n;i++)for(let j=0;j<m;j++){const u=(i+.5)*s[0]/n-s[0]/2,v=(j+.5)*s[2]/m-s[2]/2;raw([p[0]+c*u-sn*v,p[1],p[2]+sn*u+c*v],[Math.abs(c)*s[0]/n+Math.abs(sn)*s[2]/m,s[1],Math.abs(sn)*s[0]/n+Math.abs(c)*s[2]/m],tone,role);}
 };
 const frame=(a:readonly number[],b:readonly number[])=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;return{length,dx,dz,yaw:-Math.atan2(dz,dx),at:(u:number,y:number,v=0):V3=>[a[0]+dx*u+dz*v,y,a[1]+dz*u-dx*v]};};
 const tri=(p:V3[],tone:number,role:string)=>{triangles.push({p,tone,role});roles[role]=(roles[role]??0)+1;};
 // The full seven current source rings remain exact, including the moved
 // in-park pieces and real access gaps. No former red cartographic line is
 // silently promoted to a continuous standing wall.
 for(const w of D.walls){
  const ring=w.ring;for(let i=1;i<ring.length;i++){
   const f=frame(ring[i-1],ring[i]);if(f.length<.001)continue;
   if(!native){const a=f.at(0,3),b=f.at(f.length,3),c=f.at(f.length,6.6),d=f.at(0,6.6);tri([a,b,c],0xcfd0c2,'east:source-exact-concrete-face');tri([a,c,d],0xcfd0c2,'east:source-exact-concrete-face');}
   else box(f.at(f.length/2,4.8),[f.length,3.6,.20],0xcbd0c2,'east:independent-cardinal-preserved-wall',f.yaw);
   // Thin seams and a multi-section rounded coping, never a bulky box cap.
   if(f.length>1){const n=Math.max(1,Math.round(f.length/1.2));for(let j=1;j<n;j++)box(f.at(j*f.length/n,4.8,.008),[.016,3.55,.018],0x929e94,'east:individual-concrete-panel-joint',f.yaw);}
   if(f.length>1&&f.dx+f.dz>0)for(const[dy,depth]of[[0,.27],[.09,.23],[.14,.14]] as const)box(f.at(f.length/2,6.57+dy),[f.length,.09,depth],0x737d70,'east:rounded-grenzmauer75-coping',f.yaw);
  }
 }
 for(const art of D.artworks){
  const wall=D.walls.find(w=>w.id===art.wallId)!,ring=wall.ring,segments=ring.slice(1).map((p,i)=>frame(ring[i],p)),length=segments.reduce((s,f)=>s+f.length,0);
  const surface=(u:number,v:number,out:number):V3=>{let s=(art.station+art.direction*(u-.5)*art.widthM+length)%length;for(const f of segments){if(s<=f.length){const sign=f.dz*.7+f.dx*.7>0?1:-1;return f.at(s,3.17+(1-v)*art.heightM,out*sign);}s-=f.length;}return segments[0].at(0,3.17+(1-v)*art.heightM,out);};
  const drawing=wallArtDrawingV298(art.kind);if(!drawing.shapes.length)continue;
  if(!native){drawing.shapes.forEach((shape,index)=>{const p=shape.points.map(([u,v])=>surface(u/drawing.width,v/drawing.height,.022+index*.00012));const flat=shape.points.map(([u,v])=>new Vector2(u,-v));for(const ix of ShapeUtils.triangulateShape(flat,[]))tri(ix.map(i=>p[i]),shape.color,`mural:${art.kind}:authored-polygon`);});}
  else {
   // Independent cardinal mosaic. Resolve overlapping vector fields offline
   // in construction, then merge same-colour horizontal runs. No smooth plane,
   // texture, canvas, image or rotated block is constructed in this family.
   const nx=Math.ceil(art.widthM/.13),ny=Math.ceil(art.heightM/.13);
   for(let j=0;j<ny;j++) {let last=-1,start=0;
    const flush=(end:number)=>{if(last<0||end<=start)return;const p=surface((start+end)/2/nx,(j+.5)/ny,.53),a=surface(start/nx,(j+.5)/ny,.53),b=surface(end/nx,(j+.5)/ny,.53);raw(p,[Math.abs(b[0]-a[0])+.15,art.heightM/ny+.004,Math.abs(b[2]-a[2])+.15],last,`mural:${art.kind}:independent-cardinal-colour-run`);};
    for(let i=0;i<=nx;i++){let tone=-1;if(i<nx){const u=(i+.5)/nx*drawing.width,v=(j+.5)/ny*drawing.height;for(const shape of drawing.shapes)if(wallPointInRingV298(shape.points,u,v))tone=shape.color;}
     if(tone!==last){flush(i);start=i;last=tone;}
    }
   }
  }
 }
 // Actual Mauerpark upper wall. Its concrete slab rhythm differs from the
 // atypical Grenzmauer75 construction at East Side Gallery.
 const pw=D.parkWall.geometry.coordinates;
 for(let i=1;i<pw.length;i++){const f=frame(pw[i-1],pw[i]),n=Math.ceil(f.length/1.2);for(let j=0;j<n;j++){
  const u=(j+.5)*f.length/n,p=f.at(u,0),ground=wallGalleryHillGroundAtV298(p[0],p[2],native)??5.2;
  box(f.at(u,ground+1.5),[f.length/n-.018,3,.24],j%4?0xbbb9a7:0xa7ada0,'park:actual-hinterlandmauer-panel',f.yaw);
  for(const y of[.9,1.8,2.7])box(f.at(u,ground+y,.135),[f.length/n-.03,.032,.025],0x727c70,'park:horizontal-precast-slab-joint',f.yaw);
  // The continuously repainted legal wall has no asserted dated artwork.
  // These are explicitly original illustrative spray contours, not a copy of
  // an anonymous current work or a claim that a specific signature was there.
  const tone=[0x2486a0,0xb6598b,0xcdad38,0x688b46,0xd27041][j%5];
  for(let k=0;k<3;k++)box(f.at(u+(k-1)*.22,ground+.8+(j%3)*.25+k*.3,.15),[.20,.75,.03],tone,'park:illustrative-changing-graffiti',f.yaw);
 }}
 // Source-bound granite amphitheatre. Individual surface seats, an open west
 // stage approach and mapped polygon clipping preserve the open public bowl.
 const ar=D.amphitheatre.geometry.coordinates[0][0],outer=ar.slice(0,15),inner=ar.slice(15,-1).reverse();
 const along=(path:number[][],t:number):number[]=>{const fs=path.slice(1).map((p,i)=>frame(path[i],p));let d=fs.reduce((s,f)=>s+f.length,0)*t;for(const f of fs){if(d<=f.length){const p=f.at(d,0);return[p[0],p[2]];}d-=f.length;}return path[path.length-1];};
 for(let row=0;row<8;row++)for(let j=0;j<48;j++){
  const t=(j+.5)/48,a=along(outer,t),b=along(inner,t),w=(row+.5)/8,x=a[0]*w+b[0]*(1-w),z=a[1]*w+b[1]*(1-w),before=along(outer,Math.max(0,t-.003)),after=along(outer,Math.min(1,t+.003));
  if(![-.65,.65].every(dx=>[-.65,.65].every(dz=>wallPointInRingV298(ar,x+dx,z+dz))))continue;
  const y=wallGalleryHillGroundAtV298(x,z,native)??5.2,yaw=Math.atan2(-(after[1]-before[1]),after[0]-before[0]);
  box([x,y+.12,z],[.95,.24,.55],(row+j)%3?0xa4a396:0xb3ac98,'park:source-contained-individual-granite-seat',yaw);
 }
 // Existing Topography wall/source damage/crown and24 exhibition frames stay
 // untouched. The inspected preserved fence has horizontal steel cables, not
 // closely spaced vertical pickets. Add fine cables and post-end fixings only.
 const tw=TOPOGRAPHY_TERROR_SOURCE.officialWall.line;
 for(let i=1;i<tw.length;i++){const f=frame(tw[i-1],tw[i]),n=Math.ceil(f.length/2);for(let j=0;j<n;j++){
  const u=(j+.5)*f.length/n,p=f.at(u,0,-1),y=topographySourceGroundAt(p[0],p[2]);
  for(const dy of[.12,.30,.45,.75,.90,1.05,1.15])box([p[0],y+dy,p[2]],[f.length/n+.004,native?.045:.012,native?.045:.012],0x858f87,'topography:source-course-fine-protection-cable',f.yaw);
  const end=f.at(j*f.length/n,0,-1),base=topographySourceGroundAt(end[0],end[2]);
  for(const dy of[.16,1.20])box([end[0],base+dy,end[2]],[native?.12:.075,native?.12:.075,.09],0x68776c,'topography:existing-post-connection-bolt',f.yaw);
 }}
 // Surface-only recognition on retained high-rise owners; exact measured and
 // mapped plans/heights stay in the existing city. No invented tower volume.
 for(const building of D.buildings){const renderGround=3;const polygons:number[][][][]=building.geometry.type==='MultiPolygon'?building.geometry.coordinates as unknown as number[][][][]:[building.geometry.coordinates as unknown as number[][][]];for(const rings of polygons){const ring=rings[0],area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0),out=area>0?-1:1;
  for(let i=1;i<ring.length;i++){const f=frame(ring[i-1],ring[i]);if(f.length<5)continue;const living=building.id==='DEBE00YYRo00007V',edge=building.id.startsWith('OSM-'),pitch=building.height/(living?14:edge?36:building.id==='DEBE02AL1Zd0000g'?24:20);
   for(let y=renderGround+pitch;y<renderGround+building.height-.3;y+=pitch)box(f.at(f.length/2,y,out*(native?2.8:.15)),[f.length,.13,living?.30:.18],living?0xd8dcd0:0x78918e,`tower:${building.id}:source-height-floor-band`,f.yaw);
   if(!living)for(let u=1.8;u<f.length-1;u+=edge?3:2.8)box(f.at(u,renderGround+building.height/2,out*(native?2.8:.18)),[.10,building.height-.5,.16],0x718b89,`tower:${building.id}:continuous-glazing-mullion`,f.yaw);
   if(living)for(let u=2;u<f.length-1;u+=5)box(f.at(u,renderGround+building.height/2,out*(native?2.8:.17)),[.22,building.height-.5,.28],0xe1e3d6,'tower:living-levels-white-stacked-frame',f.yaw);
  }
 }}
 return {rows,triangles,roles};
}

const completeWallsV298=new WeakMap<Object3D,{native:boolean;children:Object3D[];instances:number}>();
/** A public metadata flag alone cannot admit a partial or substituted owner. */
export function hasCompleteWallGalleryV298(root:Object3D,native=false):boolean {
 const record=completeWallsV298.get(root);
 if(!record||record.native!==native||root.children.length!==record.children.length||root.children.some((child,i)=>child!==record.children[i]))return false;
 const mesh=root.children[0];return mesh instanceof InstancedMesh&&mesh.count===record.instances&&mesh.instanceMatrix.count===record.instances&&!!mesh.instanceColor&&mesh.instanceColor.count===record.instances;
}

export function createWallGalleryV298(native=false,options:{mobileLike?:boolean}={}):Group {
 const plan=wallGalleryGeometryV298(native),root=new Group();
 const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
 const geometry=<T extends BufferGeometry>(value:T):T=>{geometries.add(value);return value;};
 const material=<T extends Material>(value:T):T=>{materials.add(value);return value;};
 try {
  const cube=geometry(new BoxGeometry(1,1,1));cube.deleteAttribute('uv');
  const day=material(new MeshBasicMaterial({color:0xffffff}));
  const night=material(new MeshStandardMaterial({color:0xffffff,roughness:.95}));
  const mesh=new InstancedMesh(cube,day,0);root.add(mesh);
  const matrices=new Float32Array(plan.rows.length*16),colors=new Float32Array(plan.rows.length*3),matrix=new Matrix4(),v=new Vector3(),color=new Color();
  plan.rows.forEach((r,i)=>{matrix.makeRotationY(r.yaw).scale(v.fromArray(r.s)).setPosition(...r.p).toArray(matrices,i*16);color.setHex(r.tone).toArray(colors,i*3);});
  mesh.count=plan.rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name=native?'Independent cardinal walls, artwork mosaics and public-space fittings':'Wall concrete seams, coping, fence and source-edge fittings';
  mesh.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
  if(plan.triangles.length){
   const g=geometry(new BufferGeometry()),positions=new Float32Array(plan.triangles.length*9),tints=new Float32Array(positions.length);
   plan.triangles.forEach((t,i)=>{color.setHex(t.tone);for(let j=0;j<3;j++){positions.set(t.p[j],i*9+j*3);color.toArray(tints,i*9+j*3);}});
   g.setAttribute('position',new BufferAttribute(positions,3));g.setAttribute('color',new BufferAttribute(tints,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
   const d=material(new MeshBasicMaterial({vertexColors:true,side:DoubleSide}));
   const n=material(new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.96}));
   const m=new Mesh(g,d);root.add(m);
   m.name='Current preserved source wall rings and eight independently drawn polygon mural interpretations';m.userData={dayMaterial:d,nightMaterial:n};
  }
  root.name='East Side Gallery, Mauerpark and Topography preserved wall fidelity v298';
  root.userData={...WALL_GALLERY_V298_PROFILE,wallGalleryV298:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,instances:mesh.count,triangleCount:plan.triangles.length,roles:plan.roles};
  void options;freezeStaticSceneTransforms(root);
  completeWallsV298.set(root,{native,children:[...root.children],instances:mesh.count});return root;
 } catch(error) {
  root.traverse(object=>{if(object instanceof InstancedMesh)object.dispose();});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();throw error;
 }
}
