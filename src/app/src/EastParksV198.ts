import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3,
} from 'three';
import source from './data/eastParksV198.json';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

type P = readonly number[];
type Row = { p: number[]; size: number[]; color: number; q?: Quaternion };
const GROUND = 3;
const BRONZE = 0x47534b, STONE = 0xc4bcaa, RED = 0x80544e;
const anchor = (id: string) => source.anchors.find(a => a.id === id)!.point;
const soldier = anchor('node/9255913447'), mother = anchor('node/1561640301');
const azimuth = Math.atan2(mother[1] - soldier[1], mother[0] - soldier[0]);
const front = [Math.cos(azimuth), Math.sin(azimuth)];
const right = [-front[1], front[0]];
const yaw = -Math.atan2(right[1], right[0]);

/** Isometric recognition models, separate from all retained city/source bodies. */
export function createEastParksV198(native = false): Group {
  const root = new Group();
  root.name = 'East parks v198: Treptower memorial and Köpenick source-face detail';
  root.userData = { eastParksV198: true, textureFree: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    noSourceReplacement: true, memorialContext: 'War cemetery and memorial to the defeat of Nazism' };
  const cells = new Map<string, { boxes: Row[]; rounds: Row[]; positions: number[]; colors: number[] }>();
  const cell = (p: P) => {
    const id = `${Math.floor(p[0]/512)}:${Math.floor(p[2]/512)}`;
    if (!cells.has(id)) cells.set(id, {boxes:[],rounds:[],positions:[],colors:[]});
    return cells.get(id)!;
  };
  const color = new Color();
  const tri = (a: P,b: P,c: P,tint: number) => {
    const group = cell(a); const ab=new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),ac=new Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);const n=ab.cross(ac).normalize();color.setHex(tint).multiplyScalar(.76+.20*Math.abs(n.y)+.04*Math.abs(n.x));
    for (const p of [a,b,c]) {group.positions.push(...p);group.colors.push(color.r,color.g,color.b);}
  };
  const block = (p: P, size: P, tint: number, angle=0) => {
    if (size.some(v => v<=0)) return;
    if (native && Math.abs(Math.sin(angle*2))>.001) {
      // Thin native members retain their course as short orthogonal steps.
      const n=Math.max(1,Math.ceil(size[0]/.8)),c=Math.cos(angle),s=Math.sin(angle);
      for(let i=0;i<n;i++){const u=(i+.5)*size[0]/n-size[0]/2;
        const q=[p[0]+c*u,p[1],p[2]-s*u];
        cell(q).boxes.push({p:q,size:[Math.abs(c)*size[0]/n+Math.abs(s)*size[2],size[1],Math.abs(s)*size[0]/n+Math.abs(c)*size[2]],color:tint});}
      return;
    }
    cell(p).boxes.push({p:[...p],size:[...size],color:tint,q:native?undefined:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle)});
  };
  const rounded = (p:P,size:P,tint:number) => {
    if(native){
      // Four shallow bands give recognisable heads and shoulders, without solid voxels.
      for(let i=0;i<4;i++){const t=(i+.5)/4*2-1,f=Math.sqrt(1-t*t);
        block([p[0],p[1]+t*size[1]/2,p[2]],[size[0]*f,size[1]/4,size[2]*f],tint);}
    }else cell(p).rounds.push({p:[...p],size:[...size],color:tint});
  };
  const limb=(a:P,b:P,width:number,depth:number,tint:number)=>{
    const va=new Vector3(...a as [number,number,number]),vb=new Vector3(...b as [number,number,number]),v=vb.clone().sub(va),p=va.clone().add(vb).multiplyScalar(.5);
    if(native){const n=Math.max(1,Math.ceil(v.length()/.45));for(let i=0;i<n;i++){const q=va.clone().addScaledVector(v,(i+.5)/n);block(q.toArray(),[width,Math.max(.3,v.length()/n),depth],tint);}}
    else cell(p.toArray()).boxes.push({p:p.toArray(),size:[width,v.length(),depth],color:tint,q:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),v.normalize())});
  };
  const surface=(rings:number[][][],y:number,tint:number)=>{
    const contours=rings.map(r=>r.slice(0,-1).map(p=>new Vector2(p[0],p[1])));
    // Earcut removes equal rounded closing vertices in place; flatten afterward
    // so subsequent hole indices cannot shift and accidentally fill grave-fields.
    const faces=ShapeUtils.triangulateShape(contours[0],contours.slice(1));
    const flat=contours.flat();
    for(const face of faces)tri(...face.map(i=>[flat[i].x,y,flat[i].y]) as [number[],number[],number[]],tint);
  };
  const prism=(rings:number[][][],base:number,height:number,tint:number)=>{
    if(!native){surface(rings,base+height,tint);for(const ring of rings)for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i];tri([a[0],base,a[1]],[b[0],base,b[1]],[b[0],base+height,b[1]],tint);tri([a[0],base,a[1]],[b[0],base+height,b[1]],[a[0],base+height,a[1]],tint);}}
    else for(const ring of rings)for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];block([(a[0]+b[0])/2,base+height/2,(a[1]+b[1])/2],[Math.hypot(dx,dz),height,.45],tint,-Math.atan2(dz,dx));}
  };
  // Exact source paving, meadow and ponds; no overlap with retained city ground.
  for(const g of source.grounds){
    if(native)for(const [x,z,w,d] of g.nativeRuns)block([x,g.y-.06,z],[w,.12,d],g.color);
    else surface(g.rings,g.y,g.color);
  }
  // Source-mapped buildings remain recognisable small envelopes rather than missing voids.
  const gatewayIds=new Set(['way/44387292','way/142701801']);
  for(const b of source.buildings){
    if(b.id==='way/142701713'||gatewayIds.has(b.id))continue;
    for(const rings of b.rings)prism(rings,GROUND,b.height,0xc9c1ad);
    if(native)for(const [x,z,w,d] of b.nativeRoofRuns)block([x,GROUND+b.height-.08,z],[w,.16,d],0xa69f90);
  }
  for(const tree of source.trees){
    const [x,z]=tree.point,h=tree.height,r=tree.radius;
    block([x,GROUND+h*.26,z],[.6,h*.52,.6],0x75654a);
    rounded([x,GROUND+h*.65,z],[r*2,h*.78,r*2],0x678651);
  }
  // Benches use actual OSM points. Their local heading is a labelled display estimate.
  for(const b of source.benches){const [x,z]=b.point;
    block([x,3.48,z],[1.8,.12,.5],0x897259);block([x,3.8,z+.23],[1.8,.52,.08],0x897259);
    for(const u of [-.6,.6])block([x+u,3.25,z],[.09,.5,.45],0x555e58);
  }
  // All sixteen original source footprints and explicit 2.5 m heights are retained.
  for(const c of source.cenotaphs){
    prism(c.rings,GROUND,2.5,STONE);
    const ring=c.rings[0];
    for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
      block([(a[0]+b[0])/2,5.45,(a[1]+b[1])/2],[len,.16,.2],0xe0d7bd,angle);
      if(len>3){ // restrained relief rhythm; no reproduced inscription or invented text
        for(let j=0;j<5;j++){const t=(j+.5)/5;
          rounded([a[0]+dx*t,4.15,a[1]+dz*t],[.33,.9,.33],0xb2aa96);
          rounded([a[0]+dx*t,4.77,a[1]+dz*t],[.25,.25,.25],0xb2aa96);}
      }
    }
  }
  // Two source-bound red-granite lowered banners, 14 m OSM height.
  for(const flag of source.flags){
    const ring=flag.rings[0],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
    // The actual footprint controls the ground shape; taper only in elevation.
    for(let level=0;level<14;level++){
      const scale=1-level/25;
      const rr=flag.rings.map(r=>r.map(p=>[cx+(p[0]-cx)*scale,cz+(p[1]-cz)*scale]));
      prism(rr,GROUND+level,1,level%3?RED:0x895d55);
    }
  }
  // The access arches follow the two mapped gatehouse footprint centres and widths.
  for(const g of source.buildings.filter(b=>gatewayIds.has(b.id))){
    const ring=g.rings[0][0],center=g.center;
    const pairs=ring.slice(1).map((p,i)=>({a:ring[i],b:p,l:Math.hypot(p[0]-ring[i][0],p[1]-ring[i][1])})).sort((a,b)=>b.l-a.l);
    const e=pairs[0],a=-Math.atan2(e.b[1]-e.a[1],e.b[0]-e.a[0]);
    const w=Math.max(7,e.l),u=[Math.cos(a),-Math.sin(a)];
    for(const s of [-1,1])block([center[0]+s*u[0]*(w/2-1),6.1,center[1]+s*u[1]*(w/2-1)],[2,6.2,2.3],STONE,a);
    block([center[0],10,center[1]],[w,2,2.3],STONE,a);
    for(let i=0;i<8;i++){const t=(i+.5)/8*Math.PI,x=Math.cos(t)*(w/2-2),y=Math.sin(t)*2.3;
      block([center[0]+u[0]*x,6.7+y,center[1]+u[1]*x],[.75,.65,2.3],STONE,a);}
  }
  const lp=(base:P,u:number,y:number,v:number)=>[base[0]+right[0]*u+front[0]*v,y,base[1]+right[1]*u+front[1]*v];
  const figure=(base:P,baseY:number,height:number,pose:'standing'|'kneeling'|'mother')=>{
    const s=height/13, p=(u:number,y:number,v:number)=>lp(base,u*s,baseY+y*s,v*s);
    if(pose==='mother'){
      rounded(p(0,4.1,0),[3.8*s,7.8*s,3.4*s],0xaaa89b);
      rounded(p(0,9.7,.5),[2.8*s,3.3*s,2.9*s],0xaaa89b);
      limb(p(-1.3,7.2,.1),p(-.5,6.5,2),.8*s,.8*s,0xaaa89b);limb(p(.5,7.3,.2),p(-.4,6.5,2),.8*s,.8*s,0xaaa89b);return;
    }
    const kneel=pose==='kneeling';
    const hip=kneel?4.1:6.0,shoulder=kneel?8.6:10.0;
    rounded(p(0,(hip+shoulder)/2,-.1),[3.3*s,(shoulder-hip+1.1)*s,2*s],BRONZE);
    rounded(p(0,hip-1.1,-.35),[3.8*s,3.7*s,2.3*s],BRONZE);
    rounded(p(0,shoulder+1.45,.16),[1.9*s,2.1*s,1.85*s],BRONZE);
    rounded(p(0,shoulder+2.4,.03),[1.85*s,.32*s,1.78*s],0x3f4943);
    for(const side of [-1,1]){
      limb(p(side*.85,hip-.5,0),p(side*1.05,kneel?1.8:2.3,side<0?.9:0),1.05*s,1.1*s,BRONZE);
      limb(p(side*1.05,kneel?1.8:2.3,side<0?.9:0),p(side*1.05,.5,kneel?-1.1:(side<0?1.2:0)),.95*s,1.0*s,0x3e4842);
      rounded(p(side*1.05,.45,side<0?1.4:.3),[1.3*s,.8*s,2.1*s],0x3e4842);
    }
    // Cape drapes behind the uniform; open limb silhouette remains legible.
    rounded(p(-.5,hip+1.1,-1),[3.6*s,5.5*s,1.05*s],0x526054);
    if(kneel){limb(p(-1.6,shoulder,0),p(-1,5,2),.85*s,.8*s,BRONZE);limb(p(1.6,shoulder,0),p(0,5,2),.85*s,.8*s,BRONZE);return;}
    // +u is the figure's anatomical right. The child is held on the left.
    limb(p(1.55,9.7,0),p(2.1,7.1,1),.9*s,.9*s,BRONZE);
    limb(p(-1.6,9.7,0),p(-2.35,8.3,1.35),1*s,1*s,BRONZE);
    limb(p(-2.35,8.3,1.35),p(-1.8,8.8,2.05),.85*s,.85*s,BRONZE);
    rounded(p(-1.75,10.3,1.5),[1.6*s,2.45*s,1.2*s],0x506052);
    rounded(p(-1.7,12,1.4),[1.2*s,1.35*s,1.2*s],0x526153);
    for(const side of [-1,1])limb(p(-1.75+side*.37,9.25,1.6),p(-1.65+side*.45,7.5,2.2),.48*s,.48*s,BRONZE);
    limb(p(-1.3,11.1,1.5),p(-.3,10.3,.7),.4*s,.4*s,BRONZE);
    limb(p(2.1,7.1,1),p(2.35,.35,1.7),.25*s,.55*s,0x5c695d);
    block(p(2.1,6.8,1.04),[1.6*s,.22*s,.32*s],0x637163,yaw);
  };
  // A bounded illustrative tumulus supports the source-mapped 9 m mausoleum.
  // Its 8 m mound + 9 m pedestal + 13 m figure follows the published 30 m total.
  for(let i=0;i<16;i++){
    const y=GROUND+i*.5,r=29*(1-i/19);
    if(native){const n=Math.ceil(r*2);for(let z=-n;z<n;z+=2){const zz=z+1;if(Math.abs(zz)>r)continue;const w=Math.sqrt(r*r-zz*zz)*2;block([soldier[0],y+.25,soldier[1]+zz],[w,.5,2],0x86a36c);}}
    else {const n=40,next=29*(1-(i+1)/19);for(let j=0;j<n;j++){const a=j/n*Math.PI*2,b=(j+1)/n*Math.PI*2;const p=[soldier[0]+r*Math.cos(a),y,soldier[1]+r*Math.sin(a)],q=[soldier[0]+r*Math.cos(b),y,soldier[1]+r*Math.sin(b)],u=[soldier[0]+next*Math.cos(a),y+.5,soldier[1]+next*Math.sin(a)],v=[soldier[0]+next*Math.cos(b),y+.5,soldier[1]+next*Math.sin(b)];tri(p,q,v,0x86a36c);tri(p,v,u,0x86a36c);if(i===15)tri([soldier[0],11,soldier[1]],u,v,0x86a36c);}}
  }
  const mausoleum=source.buildings.find(b=>b.id==='way/142701713')!;
  for(const r of mausoleum.rings)prism(r,11,9,0xc1b6a1);
  for(let i=0;i<36;i++){const d=5+(i+.5)*24/36;block(lp(soldier,0,11-(i+.5)*8/36+.08,d),[8,.24,24/36],0xb7b29f,yaw);}
  // Door, cornice and dark plaque stay on the axis-facing side of the pedestal.
  block(lp(soldier,0,13.2,4.7),[2.2,4.4,.10],0x4d5754,yaw);
  block(lp(soldier,0,19.7,0),[11,.6,11],0xb6a88c,yaw);
  figure(soldier,20,13,'standing');
  // Broken Nazi symbol lies below the liberator's boots, solely as memorial context.
  // Deliberate gaps distinguish shattered fragments from a freestanding emblem.
  for(const [u,v,du,dv] of [[-.9,-.8,2,.33],[.8,.7,1.8,.33],[-1.7,-.2,.33,1.6],[1.7,.1,.33,1.1],[-.2,1.1,.32,1.3],[.2,-1.15,.32,1.5]])
    block(lp(soldier,u,20.12,v),[du,.24,dv],0x48534d,yaw+Math.PI/7);
  for(const id of ['node/9256186730','node/9256186731'])figure(anchor(id),3.4,2,'kneeling');
  block(lp(mother,0,3.35,0),[4,.7,4],STONE,yaw);figure(mother,3.7,3,'mother');
  // Exact wall-plane, source-bound sparse cornices and masonry piers in Köpenick.
  for(const face of source.facades){
    const ring=face.rings[0];let a=ring[0],b=ring[1],len=0;
    for(const p of ring)for(const q of ring){const l=Math.hypot(q[0]-p[0],q[2]-p[2]);if(l>len){len=l;a=p;b=q;}}
    const low=Math.min(...ring.map(p=>p[1])),high=Math.max(...ring.map(p=>p[1]));if(len<9||high-low<5)continue;
    // A horizontal cornice is only supported by a complete rectangular source wall.
    // Gables and clipped/sloping wall faces retain their original v187 geometry.
    const spanAt=(y:number)=>{const ps=ring.filter(p=>Math.abs(p[1]-y)<.005);let span=0;for(const p of ps)for(const q of ps)span=Math.max(span,Math.hypot(p[0]-q[0],p[2]-q[2]));return span;};
    if(ring.some(p=>Math.abs(p[1]-low)>.005&&Math.abs(p[1]-high)>.005)||spanAt(low)<len-.005||spanAt(high)<len-.005)continue;
    const angle=-Math.atan2(b[2]-a[2],b[0]-a[0]),palace=face.name==='Schloss Köpenick',tint=palace?0xe3d7bc:0xbd926e;
    const top=Math.min(high,low+16),x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;
    block([x,low+.3,z],[len,.34,.34],tint,angle);
    block([x,top-.35,z],[len,.24,.34],tint,angle);
    // Retain the full original apertures; these are small additive framing cues.
    if(palace)for(let i=1;i<Math.floor(len/5);i++){const t=i/Math.floor(len/5);block([a[0]+(b[0]-a[0])*t,(low+top)/2,a[2]+(b[2]-a[2])*t],[.25,top-low,.27],tint,angle);}
  }
  const identity=new Matrix4(),quat=new Quaternion(),pos=new Vector3(),scale=new Vector3();
  const materialPair=()=>({day:new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night:new MeshStandardMaterial({vertexColors:true,side:DoubleSide,flatShading:true,roughness:.9})});
  const mergeTouchingNativeBoxes=(rows:Row[])=>{
    // Lossless run joining: only equal-colour cuboids with identical other axes.
    // Shared internal faces disappear, while the exterior surface stays identical.
    for(const axis of [2,0]){
      const buckets=new Map<string,Row[]>();
      for(const row of rows){const key=[row.color,...[0,1,2].filter(a=>a!==axis).flatMap(a=>[row.p[a],row.size[a]])].join(':');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(row);}
      rows=[];
      for(const bucket of buckets.values()){
        bucket.sort((a,b)=>a.p[axis]-a.size[axis]/2-(b.p[axis]-b.size[axis]/2));let last:Row|undefined;
        for(const row of bucket){
          if(last&&Math.abs(last.p[axis]+last.size[axis]/2-(row.p[axis]-row.size[axis]/2))<1e-8){const lo=last.p[axis]-last.size[axis]/2,hi=row.p[axis]+row.size[axis]/2;last.p[axis]=(lo+hi)/2;last.size[axis]=hi-lo;}
          else{last={...row,p:[...row.p],size:[...row.size]};rows.push(last);}
        }
      }
    }
    return rows;
  };
  for(const [id,data] of cells){
    if(native)data.boxes=mergeTouchingNativeBoxes(data.boxes);
    for(const [type,rows] of [['boxes',data.boxes],['rounds',data.rounds]] as const){
      if(!rows.length)continue;
      const geometry=type==='boxes'?new BoxGeometry(1,1,1):new IcosahedronGeometry(.5,1);geometry.deleteAttribute('uv');
      const normals=geometry.getAttribute('normal'),shades=new Float32Array(normals.count*3);for(let i=0;i<normals.count;i++){const shade=.74+.20*Math.max(0,normals.getY(i))+.06*Math.abs(normals.getX(i));shades.set([shade,shade,shade],i*3);}geometry.setAttribute('color',new Float32BufferAttribute(shades,3));
      const materials=materialPair();
      const mesh=new InstancedMesh(geometry,materials.day,rows.length);
      rows.forEach((r,i)=>{pos.fromArray(r.p);scale.fromArray(r.size);identity.compose(pos,r.q??quat,scale);mesh.setMatrixAt(i,identity);mesh.setColorAt(i,color.setHex(r.color));});
      mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.name=`East parks v198 ${id} ${type}`;mesh.userData={dayMaterial:materials.day,nightMaterial:materials.night,textureFree:true,blockNative:native};root.add(mesh);
    }
    if(data.positions.length){
      const unique=new Map<string,number>(),positions:number[]=[],colors:number[]=[],indices:number[]=[];
      for(let i=0;i<data.positions.length;i+=3){const p=data.positions.slice(i,i+3),c=data.colors.slice(i,i+3),key=[...p,...c].join(':');let index=unique.get(key);if(index===undefined){index=positions.length/3;unique.set(key,index);positions.push(...p);colors.push(...c);}indices.push(index);}
      const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(positions,3));geo.setAttribute('color',new Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
      const materials=materialPair();
      const mesh=new Mesh(geo,materials.day);mesh.name=`East parks v198 ${id} mapped surfaces`;mesh.userData={dayMaterial:materials.day,nightMaterial:materials.night,textureFree:true};root.add(mesh);}
  }
  return freezeStaticSceneTransforms(root);
}
