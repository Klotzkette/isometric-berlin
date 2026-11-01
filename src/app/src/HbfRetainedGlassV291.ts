import { BufferGeometry, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeUtils, Vector2 } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291, hbfRailCurveAtV291 } from "./HbfCirculationV291";
import { hbfGeometryComplementV291, hbfPolygonComplementV291, hbfSegmentComplementV291, type HbfOpeningV291, type HbfPlaneV291 } from "./HbfGeometryOpeningsV291";

// Complete original records, independently checked against the shared SHA256
// and official fused-parent receipts. Changed or unknown records retain their
// complete source sheets, ink, mullions and distant fallback.
const originals: readonly PrismBuilding[] = [{"id":"o0aS4DvM","ring":[[-1492,-6463],[-1842,-7337],[-1842,-7358],[-1750,-7129],[-1565,-7165],[-1287,-6471],[-1371,-6458],[-1381,-6483]],"holes":[],"y0_dm":31,"h_dm":475,"class":1,"roof":1000,"tone":[131,140,137]},{"id":"clykH08k","ring":[[-1746,-7095],[-1552,-7133],[-1287,-6471],[-1371,-6458],[-1381,-6482],[-1492,-6462]],"holes":[],"y0_dm":32,"h_dm":534,"class":0,"roof":5000,"tone":[131,140,137]},{"id":"gqQdZFTa","ring":[[-846,-6530],[-1115,-7194],[-910,-7213],[-655,-6576],[-771,-6565],[-761,-6540]],"holes":[],"y0_dm":44,"h_dm":539,"class":0,"roof":5000,"tone":[66,71,69]},{"id":"hlYYwDX2","ring":[[-1492,-6463],[-1506,-6460],[-1491,-6425],[-1494,-6425],[-1752,-7067],[-1736,-7070]],"holes":[],"y0_dm":31,"h_dm":457,"class":0,"roof":2100,"tone":[150,162,159]},{"id":"rg8J0PRu","ring":[[-454,-6571],[-454,-6594],[-655,-6576],[-899,-7186],[-672,-7201],[-442,-7207],[-442,-7231],[-542,-7229],[-542,-7232],[-262,-7234],[-117,-7231],[49,-7223],[60,-6595],[-274,-6580],[-555,-6559],[-554,-6563]],"holes":[],"y0_dm":39,"h_dm":309,"class":0,"roof":5000,"tone":[73,78,76]},{"id":"jacWOmHc","ring":[[-442,-7207],[-454,-6594],[-655,-6576],[-899,-7186]],"holes":[],"y0_dm":40,"h_dm":290,"class":1,"roof":9999,"tone":[150,162,159]},{"id":"SLLM5yNi","ring":[[-882,-7187],[-638,-6577],[-655,-6576],[-899,-7186]],"holes":[],"y0_dm":43,"h_dm":456,"class":0,"roof":2100,"tone":[77,86,82]}];
const originalFingerprints = new Map(originals.map(p => [p.id, JSON.stringify(p)]));
const admitted = new Set<string>(HBF_CIRCULATION_V291.upperRailEnvelopeSourceIds);

function worldOpening(local: HbfOpeningV291): HbfOpeningV291 {
  const angle=HBF_CIRCULATION_V291.frame.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const anchor=HBF_CIRCULATION_V291.frame.anchorWorld;
  const corners=[0,1].flatMap(i=>[0,1].flatMap(j=>[0,1].map(k=>hbfLocalToWorldV291([i?local.bounds.max[0]:local.bounds.min[0],j?local.bounds.max[1]:local.bounds.min[1],k?local.bounds.max[2]:local.bounds.min[2]]))));
  return {id:local.id,planes:local.planes.map(([x,y,z,d])=>{
    const wx=x*c+z*s,wz=-x*s+z*c;
    return [wx,y,wz,d-wx*anchor[0]-y*anchor[1]-wz*anchor[2]] as HbfPlaneV291;
  }),bounds:{min:[0,1,2].map(i=>Math.min(...corners.map(p=>p[i]))) as [number,number,number],max:[0,1,2].map(i=>Math.max(...corners.map(p=>p[i]))) as [number,number,number]}};
}

/** The exact upper body envelope admitted by HauptbahnhofNavigation, including
 * its capsule edge allowance. These cuts remove old source walls, never floors
 * or upper office rooms. They do not broaden into the railway track gaps. */
function upperRouteOpenings(): HbfOpeningV291[] {
  const local:HbfOpeningV291[]=[];
  for(let i=0;i<20;i++) {
    const x0=-112+i*11.2,x1=x0+11.2,z0=hbfRailCurveAtV291(x0),z1=hbfRailCurveAtV291(x1);
    const x=(x0+x1)/2,z=(z0+z1)/2,yaw=Math.atan2(z1-z0,x1-x0),c=Math.cos(yaw),s=Math.sin(yaw);
    const length=Math.hypot(x1-x0,z1-z0)*1.02/2+.45,width=2.15+.45;
    for(const island of HBF_CIRCULATION_V291.upperPlatformCentresLocalZ) {
      const zz=z+island,corners=[-1,1].flatMap(a=>[-1,1].map(b=>[x+a*length*c-b*width*s,zz+a*length*s+b*width*c]));
      local.push({id:`upper-platform-${i}-${island}`,planes:[[c,0,s,length-c*x-s*zz],[-c,0,-s,length+c*x+s*zz],[-s,0,c,width+s*x-c*zz],[s,0,-c,width-s*x+c*zz],[0,1,0,-10.2],[0,-1,0,13.2]],bounds:{min:[Math.min(...corners.map(p=>p[0])),10.2,Math.min(...corners.map(p=>p[1]))],max:[Math.max(...corners.map(p=>p[0])),13.2,Math.max(...corners.map(p=>p[1]))]}});
    }
  }
  for(const flight of HBF_CIRCULATION_V291.flights) {
    if(flight.fromLevelId!=="upper-rail")continue;
    const [ax,ay,az]=flight.from,[bx,by,bz]=flight.to,dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,px=-uz,pz=ux;
    const half=flight.widthM/2+.8,slope=(by-ay)/length,hx=slope*ux,hz=slope*uz,h0=ay-hx*ax-hz*az;
    const corners=[[ax+px*half,az+pz*half],[ax-px*half,az-pz*half],[bx+px*half,bz+pz*half],[bx-px*half,bz-pz*half]];
    local.push({id:flight.id,planes:[[ux,0,uz,-ux*ax-uz*az],[-ux,0,-uz,ux*bx+uz*bz],[px,0,pz,half-px*ax-pz*az],[-px,0,-pz,half+px*ax+pz*az],[-hx,1,-hz,.7-h0],[hx,-1,hz,h0+2.3]],bounds:{min:[Math.min(...corners.map(p=>p[0])),Math.min(ay,by)-.7,Math.min(...corners.map(p=>p[1]))],max:[Math.max(...corners.map(p=>p[0])),Math.max(ay,by)+2.3,Math.max(...corners.map(p=>p[1]))]}});
  }
  return local.map(worldOpening);
}
const openings=upperRouteOpenings();
const noOpenings:readonly HbfOpeningV291[]=[];

/** Explicit complete-model transaction plus full original-record guard. */
export function hbfRetainedGlassOpeningsV291(building:PrismBuilding,enabled:boolean):readonly HbfOpeningV291[] {
  if(!enabled||!admitted.has(building.id)||originalFingerprints.get(building.id)!==JSON.stringify(building))return noOpenings;
  const xs=building.ring.map(p=>p[0]/10),zs=building.ring.map(p=>p[1]/10),bottom=building.y0_dm/10,top=bottom+Math.max(2.5,building.h_dm/10);
  return openings.filter(c=>c.bounds.min[0]<=Math.max(...xs)&&c.bounds.max[0]>=Math.min(...xs)&&c.bounds.min[2]<=Math.max(...zs)&&c.bounds.max[2]>=Math.min(...zs)&&c.bounds.min[1]<top&&c.bounds.max[1]>bottom);
}

/** Preserve each original sheet by triangle clipping. Source footprints are
 * concave: create aperture reveals from their convex triangular extrusions,
 * retaining only actual cut-plane faces, never the internal triangulation walls. */
export function hbfCutRetainedGlassV291(building:PrismBuilding,source:BufferGeometry,cuts:readonly HbfOpeningV291[]):BufferGeometry {
  if(!cuts.length)return source;
  const positions:number[]=[],p=source.getAttribute("position"),index=source.index;
  for(let i=0;i<(index?.count??p.count);i+=3) {
    const triangle=[0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return[p.getX(k),p.getY(k),p.getZ(k)];});
    for(const polygon of hbfPolygonComplementV291(triangle,cuts)??[triangle])for(let j=1;j+1<polygon.length;j++)positions.push(...polygon[0],...polygon[j],...polygon[j+1]);
  }
  const rings=[building.ring,...building.holes??[]].map(r=>r.map(([x,z])=>new Vector2(x/10,-z/10)));
  const all=rings.flat(),triangles=ShapeUtils.triangulateShape(rings[0],rings.slice(1));
  for(const triangle of triangles) {
    const shape=new Shape(triangle.map(i=>all[i]));
    const convex=new ExtrudeGeometry(shape,{bevelEnabled:false,depth:Math.max(2.5,building.h_dm/10),steps:1});
    convex.rotateX(-Math.PI/2);convex.translate(0,building.y0_dm/10,0);convex.deleteAttribute("uv");
    const clipped=hbfGeometryComplementV291(convex,cuts);
    if(clipped!==convex) {
      const points=clipped.getAttribute("position");
      for(let i=0;i<points.count;i+=3) {
        const face=[0,1,2].map(j=>[points.getX(i+j),points.getY(i+j),points.getZ(i+j)]);
        if(cuts.some(c=>c.planes.some(plane=>face.every(v=>Math.abs(plane[0]*v[0]+plane[1]*v[1]+plane[2]*v[2]+plane[3])<2e-4))))positions.push(...face[0],...face[1],...face[2]);
      }
      clipped.dispose();
    }
    convex.dispose();
  }
  const output=new BufferGeometry();output.setAttribute("position",new Float32BufferAttribute(positions,3));output.computeVertexNormals();output.userData={...source.userData,hbfRetainedGlassAperturesV291:true};return output;
}

/** Clip original architectural ink; add only the real new aperture borders. */
export function hbfCutRetainedGlassInkV291(source:BufferGeometry,cuts:readonly HbfOpeningV291[],cutBody?:BufferGeometry,edgeThreshold=24):BufferGeometry {
  if(!cuts.length)return source;
  const positions:number[]=[],p=source.getAttribute("position");
  for(let i=0;i<p.count;i+=2) {
    const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)];
    for(const segment of hbfSegmentComplementV291(a,b,cuts)??[[a,b]])positions.push(...segment[0],...segment[1]);
  }
  if(cutBody) {
    const edges=new EdgesGeometry(cutBody,edgeThreshold),q=edges.getAttribute("position");
    for(let i=0;i<q.count;i+=2) {
      const a=[q.getX(i),q.getY(i),q.getZ(i)],b=[q.getX(i+1),q.getY(i+1),q.getZ(i+1)];
      if(cuts.some(c=>c.planes.some(plane=>[a,b].every(v=>Math.abs(plane[0]*v[0]+plane[1]*v[1]+plane[2]*v[2]+plane[3])<2e-4))))positions.push(...a,...b);
    }
    edges.dispose();
  }
  const output=new BufferGeometry();output.setAttribute("position",new Float32BufferAttribute(positions,3));return output;
}

export function hbfAppendRetainedGlassLineV291(target:number[],line:readonly number[],cuts:readonly HbfOpeningV291[]):void {
  if(!cuts.length){target.push(...line);return;}
  const a=line.slice(0,3),b=line.slice(3,6);
  for(const segment of hbfSegmentComplementV291(a,b,cuts)??[[a,b]])target.push(...segment[0],...segment[1]);
}
