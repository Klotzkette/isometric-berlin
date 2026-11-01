import { BufferGeometry, Float32BufferAttribute } from "three";
import { HBF_CIRCULATION_V291, hbfNativeAirBoxesV291, hbfRailCurveAtV291 } from "./HbfCirculationV291";

export type HbfBoxV291 = { min: readonly [number,number,number]; max: readonly [number,number,number] };
export type HbfPlaneV291 = readonly [number,number,number,number];
export type HbfOpeningV291 = {
  id: string;
  /** The opening is the intersection of a*x+b*y+c*z+d >= 0. */
  planes: readonly HbfPlaneV291[];
  bounds: HbfBoxV291;
  /** Independent axis-aligned display reading, never smooth clipped blocks. */
  nativeBoxes?: readonly HbfBoxV291[];
};
type Vertex = readonly number[];
type Polygon = number[][];
const EPS = 1e-9;
const capFaces=new WeakSet<Polygon>();
const value = (p: Vertex, plane:HbfPlaneV291):number => p[0]*plane[0]+p[1]*plane[1]+p[2]*plane[2]+plane[3];
const overlaps=(a:HbfBoxV291,b:HbfBoxV291):boolean=>a.min.every((n,i)=>n<b.max[i]-EPS&&a.max[i]>b.min[i]+EPS);
function bounds(poly:readonly Vertex[]):HbfBoxV291 {
  return {min:[0,1,2].map(i=>Math.min(...poly.map(p=>p[i]))) as [number,number,number],max:[0,1,2].map(i=>Math.max(...poly.map(p=>p[i]))) as [number,number,number]};
}
function polygonArea(poly:readonly Vertex[]):number {
  if(poly.length<3)return 0;
  const o=poly[0];let x=0,y=0,z=0;
  for(let i=1;i+1<poly.length;i++) {
    const a=poly[i],b=poly[i+1],ax=a[0]-o[0],ay=a[1]-o[1],az=a[2]-o[2],bx=b[0]-o[0],by=b[1]-o[1],bz=b[2]-o[2];
    x+=ay*bz-az*by;y+=az*bx-ax*bz;z+=ax*by-ay*bx;
  }
  return Math.hypot(x,y,z)/2;
}
function clip(poly:readonly Vertex[],plane:HbfPlaneV291,sign=1):Polygon {
  const out:Polygon=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=sign*value(a,plane),db=sign*value(b,plane);
    if(da>=-EPS)out.push([...a]);
    if((da<0)!==(db<0)&&Math.abs(da-db)>EPS) {
      const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));
    }
  }
  const result=out.filter((p,i)=>!i||Math.hypot(...p.slice(0,3).map((n,k)=>n-out[i-1][k]))>EPS);
  if(capFaces.has(poly as Polygon))capFaces.add(result);
  return result;
}
function boxPlanes(box:HbfBoxV291):HbfPlaneV291[] {
  const p:HbfPlaneV291[]=[];
  for(let i=0;i<3;i++){const lo=[0,0,0,-box.min[i]],hi=[0,0,0,box.max[i]];lo[i]=1;hi[i]=-1;p.push(lo as unknown as HbfPlaneV291,hi as unknown as HbfPlaneV291);}
  return p;
}
/** Exact outside pieces; unmodified polygons return null, not a rebuilt copy. */
export function hbfPolygonComplementV291(poly:readonly Vertex[],cuts:readonly HbfOpeningV291[]):Polygon[]|null {
  let pieces:Polygon[]=[poly as Polygon],changed=false;
  for(const cut of cuts) {
    const next:Polygon[]=[];
    for(const piece of pieces) {
      // Polygon bounds can be flat, so test each separating axis inclusively.
      const b=bounds(piece);
      if(b.min.some((v,i)=>v>cut.bounds.max[i]+EPS||b.max[i]<cut.bounds.min[i]-EPS)){next.push(piece);continue;}
      let inside:Polygon=piece;
      for(const plane of cut.planes)inside=clip(inside,plane);
      if(polygonArea(inside)<EPS){next.push(piece);continue;}
      changed=true;inside=piece;
      for(const plane of cut.planes) {
        // A polygon coincident with a cut plane belongs to the closed opening;
        // it must not be emitted again as a zero-thickness outside cap.
        if(inside.some(p=>value(p,plane)<-EPS)) {
          const outside=clip(inside,plane,-1);
          if(polygonArea(outside)>EPS)next.push(outside);
        }
        inside=clip(inside,plane);if(polygonArea(inside)<EPS)break;
      }
    }
    pieces=next;
  }
  return changed?pieces:null;
}
/** Preserve original line endpoints and interpolate only bounded opening edges. */
export function hbfSegmentComplementV291(a:Vertex,b:Vertex,cuts:readonly HbfOpeningV291[]):Array<[number[],number[]]>|null {
  let intervals:Array<[number,number]>=[[0,1]],changed=false;
  for(const cut of cuts) {
    let lo=0,hi=1,empty=false;
    for(const p of cut.planes) {
      const da=value(a,p),db=value(b,p),delta=db-da;
      if(Math.abs(delta)<EPS){if(da<0){empty=true;break;}continue;}
      const t=-da/delta;if(delta>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    }
    if(empty||lo>=hi-EPS)continue;
    const next:Array<[number,number]>=[];
    for(const [start,end]of intervals){if(hi<=start||lo>=end){next.push([start,end]);continue;}changed=true;if(start<lo)next.push([start,lo]);if(end>hi)next.push([hi,end]);}
    intervals=next;
  }
  const at=(t:number)=>a.map((v,i)=>v+(b[i]-v)*t);
  return changed?intervals.map(([lo,hi])=>[at(lo),at(hi)]):null;
}

/** Player-height prisms follow the actual incline; lower flights remain bounded. */
export function hbfFlightOpeningsV291(headroomM=2.9):HbfOpeningV291[] {
  return HBF_CIRCULATION_V291.flights.map(f=>{
    const [ax,ay,az]=f.from,[bx,by,bz]=f.to,dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,px=-uz,pz=ux;
    const half=f.widthM/2+.16,slope=(by-ay)/len,hx=slope*ux,hz=slope*uz,h0=ay-hx*ax-hz*az;
    const corners=[[ax+px*half,az+pz*half],[ax-px*half,az-pz*half],[bx+px*half,bz+pz*half],[bx-px*half,bz-pz*half]];
    const b:HbfBoxV291={min:[Math.min(...corners.map(p=>p[0])),Math.min(ay,by)-.3,Math.min(...corners.map(p=>p[1]))],max:[Math.max(...corners.map(p=>p[0])),Math.max(ay,by)+headroomM,Math.max(...corners.map(p=>p[1]))]};
    const nativeBoxes=hbfNativeAirBoxesV291(f,headroomM);
    return {id:f.id,planes:[[ux,0,uz,-ux*ax-uz*az],[-ux,0,-uz,ux*bx+uz*bz],[px,0,pz,half-px*ax-pz*az],[-px,0,-pz,half+px*ax+pz*az],[-hx,1,-hz,.3-h0],[hx,-1,hz,h0+headroomM]],bounds:b,nativeBoxes};
  });
}
const flightOpenings=hbfFlightOpeningsV291();
function shaftOpenings(native:boolean):HbfOpeningV291[] {
  return HBF_CIRCULATION_V291.shafts.map(s=>{
    const radius=native?2.3:s.radiusM+.02;
    const b:HbfBoxV291={min:[s.x-radius,s.bottomLocalY,s.z-radius],max:[s.x+radius,s.topLocalY,s.z+radius]};
    if(native)return {id:s.id,bounds:b,planes:boxPlanes(b),nativeBoxes:[b]};
    const planes:HbfPlaneV291[]=[[0,1,0,-s.bottomLocalY],[0,-1,0,s.topLocalY]];
    for(let i=0;i<32;i++){const a=i*Math.PI*2/32,nx=Math.cos(a),nz=Math.sin(a);planes.push([-nx,0,-nz,radius+nx*s.x+nz*s.z]);}
    return {id:s.id,bounds:b,planes};
  });
}
const shaftsDrawn=shaftOpenings(false),shaftsNative=shaftOpenings(true);
/** Real slab bottom determines head clearance, including the 1.1m rail deck. */
export function hbfSlabOpeningsV291(bottom:number,top:number,native=false):HbfOpeningV291[] {
  if(!native)return [...flightOpenings,...shaftsDrawn].filter(c=>c.bounds.max[1]>bottom-EPS&&c.bounds.min[1]<top+EPS);
  const flightMouths:HbfOpeningV291[]=[];
  for(const opening of flightOpenings)for(const box of opening.nativeBoxes??[]) {
    if(box.min[1]>=top||box.max[1]<=bottom)continue;
    // A native stair eye is a vertical hole through its actual slab. Keep its
    // bounded XZ footprint while avoiding artificial raking steps below it.
    const b:HbfBoxV291={min:[box.min[0],bottom,box.min[2]],max:[box.max[0],top,box.max[2]]};
    flightMouths.push({id:opening.id,planes:boxPlanes(b),bounds:b,nativeBoxes:[b]});
  }
  return [...flightMouths,...shaftsNative.filter(c=>c.bounds.max[1]>bottom-EPS&&c.bounds.min[1]<top+EPS)];
}

/** Exact orthogonal complement of a native box against the staircase reading. */
export function hbfBoxFragmentsV291(box:HbfBoxV291,cuts:readonly HbfOpeningV291[]):HbfBoxV291[] {
  let pieces:HbfBoxV291[]=[box];
  for(const opening of cuts)for(const cut of opening.nativeBoxes??[]) {
    if(!overlaps(box,cut))continue;
    const next:HbfBoxV291[]=[];
    for(const p of pieces) {
      if(!overlaps(p,cut)){next.push(p);continue;}
      const lo=p.min.map((n,i)=>Math.max(n,cut.min[i])),hi=p.max.map((n,i)=>Math.min(n,cut.max[i]));
      let min=[...p.min],max=[...p.max];
      for(let axis=0;axis<3;axis++) {
        if(min[axis]<lo[axis]-EPS){const end=[...max];end[axis]=lo[axis];next.push({min:[...min] as [number,number,number],max:end as [number,number,number]});min[axis]=lo[axis];}
        if(max[axis]>hi[axis]+EPS){const begin=[...min];begin[axis]=hi[axis];next.push({min:begin as [number,number,number],max:[...max] as [number,number,number]});max[axis]=hi[axis];}
      }
    }
    pieces=next;
  }
  return hbfMergeAdjacentBoxesV291(pieces);
}
/** Merge equal-owner pieces only across a full matching face, without rounding. */
export function hbfMergeAdjacentBoxesV291(input:readonly HbfBoxV291[]):HbfBoxV291[] {
  let pieces=[...input],changed=true;
  while(changed) {
    changed=false;
    for(let axis=0;axis<3;axis++) {
      const other=[0,1,2].filter(i=>i!==axis),groups=new Map<string,HbfBoxV291[]>();
      for(const b of pieces) {
        const key=JSON.stringify(other.flatMap(i=>[b.min[i],b.max[i]]));
        const row=groups.get(key)??[];row.push(b);groups.set(key,row);
      }
      const next:HbfBoxV291[]=[];
      for(const row of groups.values()) {
        row.sort((a,b)=>a.min[axis]-b.min[axis]);
        let current=row[0];
        for(const b of row.slice(1)) {
          if(current.max[axis]===b.min[axis]) {
            const max=[...current.max] as [number,number,number];max[axis]=b.max[axis];
            current={min:current.min,max};changed=true;
          } else {next.push(current);current=b;}
        }
        next.push(current);
      }
      pieces=next;
    }
  }
  return pieces;
}

/** Compact only new, equal-owner fragments. Bay-plane alignment changes their
 * partition, never their union, and every merge still uses a complete face. */
export function hbfCompactNativeBayFragmentsV291(input:readonly HbfBoxV291[],span=8.001):HbfBoxV291[] {
  // Only inverse rigid-frame roundoff is canonicalised (at most 5e-13 m).
  // A real 1e-10 m gap remains distinct. The station-frame float32 boundary
  // checks verify the retained rendered union independently of this rounding.
  const canonical=(n:number):number=>Number(n.toFixed(12));
  const boxes=input.map(b=>({min:b.min.map(canonical) as [number,number,number],max:b.max.map(canonical) as [number,number,number]}));
  const edges=[...new Set(boxes.flatMap(b=>[b.min[2],b.max[2]]))].sort((a,b)=>a-b);
  const aligned=boxes.flatMap(b=>{
    const divisions=edges.filter(n=>n>=b.min[2]&&n<=b.max[2]);
    return divisions.slice(1).map((edge,i)=>({min:[b.min[0],b.min[1],divisions[i]] as const,max:[b.max[0],b.max[1],edge] as const}));
  });
  const cost=(rows:readonly HbfBoxV291[])=>rows.reduce((sum,b)=>sum+b.min.reduce((product,n,i)=>product*Math.ceil((b.max[i]-n)/span),1),0);
  let result:HbfBoxV291[]=boxes,best=cost(boxes);
  for(const rows of[boxes,aligned]) {
    const candidate=hbfMergeAdjacentBoxesV291(rows),size=cost(candidate);
    if(size<best){result=candidate;best=size;}
  }
  return result;
}

function clippedPolyhedron(faces:Polygon[],plane:HbfPlaneV291,sign:number):Polygon[] {
  const result:Polygon[]=[],points:Polygon=[];
  for(const face of faces) {
    const p=clip(face,plane,sign);if(polygonArea(p)>EPS)result.push(p);
    for(const v of p)if(Math.abs(value(v,plane))<1e-7&&!points.some(p=>Math.hypot(...p.slice(0,3).map((n,k)=>n-v[k]))<1e-7))points.push(v);
  }
  if(points.length>=3) {
    const n=[-sign*plane[0],-sign*plane[1],-sign*plane[2]],length=Math.hypot(...n);for(let i=0;i<3;i++)n[i]/=length;
    const ref=Math.abs(n[0])<.8?[1,0,0]:[0,1,0];
    const u=[n[1]*ref[2]-n[2]*ref[1],n[2]*ref[0]-n[0]*ref[2],n[0]*ref[1]-n[1]*ref[0]],ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;
    const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],centre=[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);
    const angle=(p:Vertex)=>Math.atan2(p.slice(0,3).reduce((s,n,i)=>s+(n-centre[i])*v[i],0),p.slice(0,3).reduce((s,n,i)=>s+(n-centre[i])*u[i],0));
    points.sort((a,b)=>angle(a)-angle(b));if(polygonArea(points)>EPS){capFaces.add(points);result.push(points);}
  }
  return result;
}
function polyhedronVolume(faces:Polygon[]):number {
  const o=faces[0]?.[0];if(!o)return 0;let sum=0;
  for(const face of faces)for(let i=1;i+1<face.length;i++) {
    const a=face[0].slice(0,3).map((n,k)=>n-o[k]),b=face[i].slice(0,3).map((n,k)=>n-o[k]),c=face[i+1].slice(0,3).map((n,k)=>n-o[k]);
    sum+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  }
  return Math.abs(sum)/6;
}
/** Closed convex fragments include the new aperture reveal faces. */
export function hbfConvexComplementV291(source:readonly (readonly Vertex[])[],cuts:readonly HbfOpeningV291[]):Polygon[][]|null {
  let pieces:Polygon[][]=[source.map(f=>f.map(v=>[...v]))],changed=false;
  for(const cut of cuts) {
    const next:Polygon[][]=[];
    for(const piece of pieces) {
      if(!overlaps(bounds(piece.flat()),cut.bounds)){next.push(piece);continue;}
      let inside=piece;
      for(const plane of cut.planes)inside=clippedPolyhedron(inside,plane,1);
      if(polyhedronVolume(inside)<EPS){next.push(piece);continue;}
      changed=true;inside=piece;
      for(const plane of cut.planes){const outside=clippedPolyhedron(inside,plane,-1);if(polyhedronVolume(outside)>EPS)next.push(outside);inside=clippedPolyhedron(inside,plane,1);if(polyhedronVolume(inside)<EPS)break;}
    }
    pieces=next;
  }
  return changed?pieces:null;
}
/** Constructor-owned geometry only: original outside faces and raking roofs stay. */
export function hbfGeometryComplementV291(source:BufferGeometry,cuts:readonly HbfOpeningV291[]):BufferGeometry {
  source.computeBoundingBox();const box=source.boundingBox!;
  if(!cuts.some(c=>overlaps({min:[box.min.x,box.min.y,box.min.z],max:[box.max.x,box.max.y,box.max.z]},c.bounds)))return source;
  const p=source.getAttribute("position"),index=source.index,faces:Polygon[]=[];
  for(let i=0;i<(index?.count??p.count);i+=3)faces.push([0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return[p.getX(k),p.getY(k),p.getZ(k)];}));
  const pieces=hbfConvexComplementV291(faces,cuts);if(pieces===null)return source;
  const pieceVolumes:HbfOpeningV291[]=pieces.map((piece,index)=>{
    const planes:HbfPlaneV291[]=[];
    for(const face of piece) {
      const o=face[0];let normal:number[]|null=null;
      for(let i=1;i+1<face.length;i++) {
        const a=face[i].map((n,k)=>n-o[k]),b=face[i+1].map((n,k)=>n-o[k]);
        const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);
        if(length>EPS){normal=n.map(v=>v/length);break;}
      }
      if(normal)planes.push([-normal[0],-normal[1],-normal[2],normal[0]*o[0]+normal[1]*o[1]+normal[2]*o[2]]);
    }
    return {id:`retained-piece-${index}`,planes,bounds:bounds(piece.flat())};
  });
  const vertices:number[]=[];
  for(let pieceIndex=0;pieceIndex<pieces.length;pieceIndex++)for(const face of pieces[pieceIndex]) {
    // Convex splitting creates temporary internal cap faces. They are not
    // physical station glazing: cancel their exact shared portions before
    // emitting the union boundary, including partially shared polygons.
    const polygons=capFaces.has(face)?hbfPolygonComplementV291(face,pieceVolumes.filter((_,i)=>i!==pieceIndex))??[face]:[face];
    for(const polygon of polygons)for(let i=1;i+1<polygon.length;i++)if(polygonArea([polygon[0],polygon[i],polygon[i+1]])>EPS)vertices.push(...polygon[0].slice(0,3),...polygon[i].slice(0,3),...polygon[i+1].slice(0,3));
  }
  const output=new BufferGeometry();output.setAttribute("position",new Float32BufferAttribute(vertices,3));output.computeVertexNormals();output.computeBoundingBox();output.computeBoundingSphere();output.userData={...source.userData,hbfAperturesV291:true};return output;
}

/** Bounded railway-hall void through the old authored closed office prism. */
export function hbfOfficeRailUnderpassV291(x:number,width:number,halfWidth=20):HbfOpeningV291 {
  const slope=.001574*x+.2233,curve=hbfRailCurveAtV291(x),base=4.55,roofBase=10.4,rise=12.5;
  const section:number[][]=[[-halfWidth,base],[halfWidth,base],[halfWidth,roofBase]];
  for(let i=1;i<=24;i++){const a=i*Math.PI/24;section.push([Math.cos(a)*halfWidth,roofBase+Math.sin(a)*rise]);}
  const planes:HbfPlaneV291[]=[[1,0,0,-x+width/2+.12],[-1,0,0,x+width/2+.12]];
  for(let i=0;i<section.length;i++) {
    const a=section[i],b=section[(i+1)%section.length],du=b[0]-a[0],dy=b[1]-a[1];
    // du*(y-a.y)-dy*(z-curve-slope*(x-x0)-a.u)>=0.
    planes.push([dy*slope,du,-dy,-du*a[1]+dy*(curve-slope*x+a[0])]);
  }
  const dx=width/2+.12;
  const b:HbfBoxV291={min:[x-dx,base,curve-halfWidth-Math.abs(slope)*dx],max:[x+dx,roofBase+rise,curve+halfWidth+Math.abs(slope)*dx]};
  const nativeBoxes:HbfBoxV291[]=[];
  for(let x0=b.min[0];x0<b.max[0]-EPS;x0+=4)for(let z0=Math.ceil(b.min[2]/4)*4;z0<b.max[2]-EPS;z0+=4) {
    const x1=Math.min(x0+4,b.max[0]),z1=Math.min(z0+4,b.max[2]);let top=roofBase+rise,valid=true;
    for(const xx of[x0,x1])for(const zz of[z0,z1])for(const p of planes) {
      if(p[1]<-EPS)top=Math.min(top,-(p[0]*xx+p[2]*zz+p[3])/p[1]);
      else if(p[1]===0&&value([xx,base,zz],p)<-EPS)valid=false;
    }
    if(valid&&top>base+EPS)nativeBoxes.push({min:[x0,base,z0],max:[x1,top,z1]});
  }
  return {id:`hbf-office-rail-underpass-${x}`,planes,bounds:b,nativeBoxes};
}
