import { BoxGeometry, BufferAttribute, BufferGeometry, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from "three";
import { UBAHN_V261_OPENINGS, ubahnOpeningIntersectsCellV261 } from "./ubahnEntrancesV261Profile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type P = number[];
type Cut = { ring: number[][]; minX: number; maxX: number; minZ: number; maxZ: number };
const bound = (ring: number[][]): Cut => ({ ring, minX: Math.min(...ring.map(p=>p[0])), maxX: Math.max(...ring.map(p=>p[0])), minZ: Math.min(...ring.map(p=>p[1])), maxZ: Math.max(...ring.map(p=>p[1])) });
const drawnCuts = UBAHN_V261_OPENINGS.map(o=>bound(o.ring));
const extent = bound(drawnCuts.flatMap(c=>c.ring));
let nativeCuts: Cut[] | undefined;
function cuts(native: boolean): Cut[] {
  if (!native) return drawnCuts;
  if (nativeCuts) return nativeCuts;
  const result: Cut[]=[];
  // Quarter-metre mouth pixels produce an independent orthogonal opening.
  // Merge adjacent pixels before cutting; nothing outside their union changes.
  for(const c of drawnCuts) for(let iz=Math.floor(c.minZ*4);iz<Math.ceil(c.maxZ*4);iz++) {
    let first: number|undefined, last=0;
    for(let ix=Math.floor(c.minX*4);ix<Math.ceil(c.maxX*4);ix++) {
      if(ubahnOpeningIntersectsCellV261(ix/4,iz/4,.25)){first??=ix;last=ix+1;}
    }
    if(first!==undefined)result.push(bound([[first/4,iz/4],[last/4,iz/4],[last/4,(iz+1)/4],[first/4,(iz+1)/4]]));
  }
  return nativeCuts=result;
}
function area(poly: P[]): number {
  let value=0;const a=poly[0];
  for(let i=1;i+1<poly.length;i++)value+=(poly[i][0]-a[0])*(poly[i+1][2]-a[2])-(poly[i+1][0]-a[0])*(poly[i][2]-a[2]);
  return Math.abs(value)/2;
}
function clip(poly:P[],distance:(p:P)=>number):P[] {
  const result:P[]=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
    if(da>=0)result.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }
  return result;
}
/** Interpolate every attached attribute along the original triangle edges. */
export function ubahnGroundComplementV261(poly:P[],native=false):P[][]|null {
  const minX=Math.min(...poly.map(p=>p[0])),maxX=Math.max(...poly.map(p=>p[0]));
  const minZ=Math.min(...poly.map(p=>p[2])),maxZ=Math.max(...poly.map(p=>p[2]));
  if(maxX<extent.minX-.25||minX>extent.maxX+.25||maxZ<extent.minZ-.25||minZ>extent.maxZ+.25)return null;
  let pieces=[poly],changed=false;
  for(const c of cuts(native)) {
    if(maxX<=c.minX||minX>=c.maxX||maxZ<=c.minZ||minZ>=c.maxZ)continue;
    const orientation=Math.sign(c.ring.reduce((s,a,i)=>{const b=c.ring[(i+1)%c.ring.length];return s+a[0]*b[1]-b[0]*a[1];},0));
    const planes=c.ring.map((a,i)=>{const b=c.ring[(i+1)%c.ring.length];return(p:P)=>orientation*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));});
    const next:P[][]=[];
    for(const piece of pieces) {
      let inside=piece;for(const plane of planes)inside=clip(inside,plane);
      if(inside.length<3||area(inside)<1e-9){next.push(piece);continue;}
      changed=true;inside=piece;
      for(const plane of planes){const outside=clip(inside,p=>-plane(p));if(outside.length>=3&&area(outside)>1e-9)next.push(outside);inside=clip(inside,plane);if(inside.length<3)break;}
    }
    pieces=next;
  }
  return changed?pieces:null;
}

/** Keep every old vertex and unaffected index triple byte-exact; append only
 * the exact outside complements of the few intersecting paving triangles. */
export function cutUbahnSurfaceV261(source:BufferGeometry,native=false):BufferGeometry {
  source.computeBoundingBox();const b=source.boundingBox!;
  if(b.max.x<extent.minX-.25||b.min.x>extent.maxX+.25||b.max.z<extent.minZ-.25||b.min.z>extent.maxZ+.25)return source;
  const p=source.getAttribute("position"),index=source.index;
  const attributes=Object.entries(source.attributes).filter(([name])=>name!=="position");
  const value=(i:number):P=>[p.getX(i),p.getY(i),p.getZ(i),...attributes.flatMap(([,a])=>Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)))];
  const changes=new Map<number,P[]>(),count=index?.count??p.count;
  let added=0;
  for(let i=0;i<count;i+=3) {
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    if(Math.max(p.getX(a),p.getX(b),p.getX(c))<extent.minX-.25||Math.min(p.getX(a),p.getX(b),p.getX(c))>extent.maxX+.25||Math.max(p.getZ(a),p.getZ(b),p.getZ(c))<extent.minZ-.25||Math.min(p.getZ(a),p.getZ(b),p.getZ(c))>extent.maxZ+.25)continue;
    const ids=[a,b,c];
    const pieces=ubahnGroundComplementV261(ids.map(value),native);if(!pieces)continue;
    const replacement:P[]=[];for(const piece of pieces)for(let j=1;j+1<piece.length;j++)if(area([piece[0],piece[j],piece[j+1]])>1e-9)replacement.push(piece[0],piece[j],piece[j+1]);
    changes.set(i,replacement);added+=replacement.length;
  }
  if(!changes.size)return source;
  const output=new BufferGeometry(),total=p.count+added;
  const all=[['position',p],...attributes] as typeof attributes;
  for(const [name,a] of all) {
    const ArrayType=a.array.constructor as {new(size:number):typeof a.array};
    const array=new ArrayType(total*a.itemSize);array.set(a.array);
    output.setAttribute(name,new BufferAttribute(array,a.itemSize,a.normalized));
  }
  const indices=new Uint32Array(count-changes.size*3+added);let cursor=0,next=p.count;
  for(let i=0;i<count;i+=3) {
    const replacement=changes.get(i);
    if(replacement===undefined){for(let j=0;j<3;j++)indices[cursor++]=index?index.getX(i+j):i+j;continue;}
    for(const v of replacement) {
      let offset=0;for(const[name,a]of all){output.getAttribute(name).array.set(v.slice(offset,offset+a.itemSize),next*a.itemSize);offset+=a.itemSize;}
      indices[cursor++]=next++;
    }
  }
  output.setIndex(new BufferAttribute(indices,1));output.userData={...source.userData,ubahnAperturesV261:changes.size};
  output.computeBoundingBox();output.computeBoundingSphere();return output;
}

export function cutUbahnGroundSlabsV261(slabs:InstancedMesh,native=false):void {
  if(slabs.userData.ubahnAperturesV261)return;
  const matrices=slabs.instanceMatrix.array,paints=slabs.instanceColor?.array;
  const positions:number[]=[],colors:number[]=[],nativeRows:number[][]=[];
  const zero=new Matrix4().makeScale(0,0,0);let affected=0;
  for(let i=0;i<slabs.count;i++) {
    const k=i*16,x=matrices[k+12],z=matrices[k+14],hx=matrices[k]/2,hz=matrices[k+10]/2;
    if(x+hx<extent.minX-.25||x-hx>extent.maxX+.25||z+hz<extent.minZ-.25||z-hz>extent.maxZ+.25)continue;
    const high=matrices[k+13]+matrices[k+5]/2,low=matrices[k+13]-matrices[k+5]/2;
    const pieces=ubahnGroundComplementV261([[x-hx,high,z-hz],[x+hx,high,z-hz],[x+hx,high,z+hz],[x-hx,high,z+hz]],native);
    if(!pieces)continue;
    const color=paints?Array.from(paints.slice(i*3,i*3+3)):[1,1,1];
    const tri=(a:P,b:P,c:P)=>{positions.push(...a,...b,...c);colors.push(...color,...color,...color);};
    for(const piece of pieces) {
      if(native){const xs=piece.map(p=>p[0]),zs=piece.map(p=>p[2]);nativeRows.push([(Math.min(...xs)+Math.max(...xs))/2,(high+low)/2,(Math.min(...zs)+Math.max(...zs))/2,Math.max(...xs)-Math.min(...xs),high-low,Math.max(...zs)-Math.min(...zs),...color]);continue;}
      for(let j=1;j+1<piece.length;j++){tri(piece[0],piece[j+1],piece[j]);tri([piece[0][0],low,piece[0][2]],[piece[j][0],low,piece[j][2]],[piece[j+1][0],low,piece[j+1][2]]);}
      for(let j=0;j<piece.length;j++){const a=piece[j],b=piece[(j+1)%piece.length],aa=[a[0],low,a[2]],bb=[b[0],low,b[2]];tri(a,b,bb);tri(a,bb,aa);}
    }
    slabs.setMatrixAt(i,zero);affected++;
  }
  if(!affected)return;
  const material=Array.isArray(slabs.material)?slabs.material[0]:slabs.material;
  const day=(slabs.userData.dayMaterial??material).clone() as MeshBasicMaterial;
  const night=(slabs.userData.nightMaterial??material).clone() as MeshBasicMaterial;
  day.vertexColors=true;night.vertexColors=true;day.side=DoubleSide;night.side=DoubleSide;
  let mesh:Mesh;
  if(native) {
    const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
    const instances=new InstancedMesh(geometry,day,nativeRows.length),m=new Matrix4(),rgb=new Float32Array(nativeRows.length*3);
    nativeRows.forEach((r,i)=>{m.makeScale(r[3],r[4],r[5]);m.setPosition(r[0],r[1],r[2]);instances.setMatrixAt(i,m);rgb.set(r.slice(6),i*3);});
    instances.instanceColor=new InstancedBufferAttribute(rgb,3);instances.computeBoundingBox();instances.computeBoundingSphere();mesh=instances;
  } else {
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array(positions),3));geometry.setAttribute("color",new BufferAttribute(new Float32Array(colors),3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh=new Mesh(geometry,day);
  }
  mesh.name="Retained ground outside seven mapped Ubahn U5/U6 stairs v261";
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,keepInMinecraft:native,blockNative:native,ubahnAperturesV261:true,affectedRuns:affected};
  slabs.instanceMatrix.needsUpdate=true;slabs.userData.ubahnAperturesV261=affected;slabs.add(freezeStaticSceneTransforms(mesh));
}

/** Only established ground owners are eligible. Buildings, trees, roads beyond
 * the seven mapped mouths and all retained source data stay unchanged. */
export function cutUbahnPresentationV261(root:Group,native=false):void {
  for(const name of ["Drawn ground slabs","Voxel ground runs","Block-native Unter den Linden complete avenue exposed top cells"]) {
    const slabs=root.getObjectByName(name);if(slabs instanceof InstancedMesh)cutUbahnGroundSlabsV261(slabs,native);
  }
  // The Tor mouths lie on the existing ALKIS/OSM avenue replacement.
  for(const name of ["District asphalt carriageways","District mapped paved walkways","Brandenburg approach raised sidewalks","Unter den Linden mapped gravel promenade"]) {
    const o=root.getObjectByName(name);
    if(o instanceof Mesh && !(o instanceof InstancedMesh)) {
      const old=o.geometry,next=cutUbahnSurfaceV261(old,native);
      if(next!==old){o.geometry=next;old.dispose();}
    }
  }
  const surfaces:Group[]=[];
  root.traverse(o=>{if(o instanceof Group&&(o.name==="smooth OSM water and parkland"||
    (o.userData.exactSourceRoad===true&&/^restored-(paving|asphalt)-/.test(o.name))))surfaces.push(o);});
  for(const surface of surfaces)surface.traverse(o=>{if(!(o instanceof Mesh)||o instanceof InstancedMesh||!/^smooth (paved paths|park paths|earth desire paths|timber paths|metal paths and steps|carriageways)$/.test(o.name))return;
    const old=o.geometry,next=cutUbahnSurfaceV261(old,native);if(next!==old){o.geometry=next;old.dispose();}
  });
}
