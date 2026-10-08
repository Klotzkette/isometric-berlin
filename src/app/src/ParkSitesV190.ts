import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import source from "./data/parkSitesV190.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Rows = number[][];
const LOOKOUTS = new Set(["way/439035491", "way/439035493"]);
export const PARK_SITES_V190_GROUP = "Source-mapped Humboldthain and Friedrichshain park details v190";

/** Source geometry is additive; the established complete hills/trees remain. */
export function createParkSitesV190(native = false): Group {
  const root = new Group(); root.name = PARK_SITES_V190_GROUP;
  root.userData = { nativeMinecraft: native, blockNative: native, keepInMinecraft: native, textureFree: true, sourcePolicy: source.policy };
  const put = (rows: Rows, x: number, y: number, z: number, w: number, h: number, d: number, angle: number, color: number) => {
    if (!native) { rows.push([x,y,z,w,h,d,angle,color]); return; }
    const n = Math.max(1,Math.ceil(w/1.2)), c=Math.cos(angle), s=Math.sin(angle);
    for(let i=0;i<n;i++) {const u=(i+.5)*w/n-w/2;
      rows.push([x+c*u,y,z-s*u,Math.max(.09,Math.abs(c)*w/n+Math.abs(s)*d),h,Math.max(.09,Math.abs(s)*w/n+Math.abs(c)*d),color]);}
  };
  for(const park of source.parks) {
    const rows: Rows=[], positions: number[]=[], colors:number[]=[];
    const inside=(x:number,z:number)=> x>=park.bounds[0]&&x<=park.bounds[2]&&z>=park.bounds[1]&&z<=park.bounds[3];
    const ground=(x:number,z:number)=>terrainGroundAt(x,z,3,native);
    const segment=(a:number[],b:number[],offset:number,width:number,height:number,color:number,fixed?:number)=> {
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz), n=Math.max(1,Math.ceil(length/2));
      for(let i=0;i<n;i++){const t=(i+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t;
        put(rows,x,(fixed??ground(x,z))+offset,z,length/n+.025,height,width,-Math.atan2(dz,dx),color);}
    };
    for(const bench of source.benches) {
      const [x,z]=bench.point;if(!inside(x,z))continue;
      const bearing=bench.direction!==null&&Number.isFinite(Number(bench.direction))?Number(bench.direction):90;
      const angle=-bearing*Math.PI/180,y=ground(x,z);
      put(rows,x,y+.48,z,1.9,.13,.48,angle,0x897556);
      put(rows,x+Math.sin(angle)*.21,y+.83,z+Math.cos(angle)*.21,1.9,.52,.085,angle,0x897556);
      for(const u of [-.64,.64])put(rows,x+Math.cos(angle)*u,y+.24,z-Math.sin(angle)*u,.10,.48,.45,angle,0x5e655d);
    }
    for(const edge of source.edges) {
      if(!inside(...edge.points[0] as [number,number]))continue;
      const lookout=LOOKOUTS.has(edge.id), fixed=lookout?58.3:undefined;
      const kind=edge.kind;
      for(let i=1;i<edge.points.length;i++) {
        const a=edge.points[i-1],b=edge.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(kind==='steps') {const n=Math.max(1,Math.ceil(len/.48));for(let k=0;k<n;k++){const t=(k+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;put(rows,x,ground(x,z)+.06,z,1.8,.12,len/n,-Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2,0xa19d8e);}continue;}
        if(kind==='hedge') {segment(a,b,.42,.6,.84,0x597947);continue;}
        if(kind==='wall'||kind==='retaining_wall') {segment(a,b,.4,.25,.8,0x928d7e);segment(a,b,.85,.33,.10,0xb4ac98);continue;}
        // Rails follow existing source-mapped fences / stair axes, without filling pathways.
        const heights=lookout?[.18,1.12]:[.22,1.02];
        for(const h of heights)segment(a,b,h,.045,.045,0x60665f,fixed);
        const n=Math.max(1,Math.ceil(len/(lookout?.22:2.4)));
        for(let k=0;k<n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
          put(rows,x,(fixed??ground(x,z))+.56,z,.045,1.14,.045,0,0x666a62);}
      }
      if(lookout) {
        // Two surviving viewing turrets follow their mapped octagonal railings.
        // Their relative three-metre rise is a photographic display estimate.
        const ring=edge.points;
        for(let i=1;i<ring.length;i++)segment(ring[i-1],ring[i],-1.44,.48,2.88,0x999788,58.3);
        if(!native){
          const tint=new Color(0xa09e8e);
          for(const face of ShapeUtils.triangulateShape(ring.map(p=>new Vector2(p[0],p[1])),[]))
            for(const index of face){positions.push(ring[index][0],58.3,ring[index][1]);colors.push(tint.r,tint.g,tint.b);}
        } else {
          // Native surface tiles fill only the mapped platform polygon.
          const minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
          for(let x=minX+.5;x<maxX;x++)for(let z=minZ+.5;z<maxZ;z++){
            let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>z)!==(ring[j][1]>z)&&x<(ring[j][0]-ring[i][0])*(z-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])hit=!hit;
            if(hit)put(rows,x,58.2,z,1,.2,1,0,0xa09e8e);
          }
        }
      }
    }
    for(const basin of source.basins){if(!inside(...basin.ring[0] as [number,number]))continue;
      for(let i=1;i<basin.ring.length;i++)segment(basin.ring[i-1],basin.ring[i],.16,.30,.28,0xc1bba5);}
    const crowns: Rows=[];
    for(const [x,z,r,height,sparse] of source.woodlandTrees){if(!inside(x,z)||(native&&sparse))continue;
      const y=ground(x,z),color=[0x53753e,0x63834c,0x6b8751][Math.abs(Math.round(x+z))%3];
      put(rows,x,y+height*.30,z,.65,height*.60,.65,0,0x706044);
      crowns.push(native?[x,y+height*.68,z,r*2,height*.80,r*2,color]:[x,y+height*.68,z,r*2,height*.80,r*2,0,color]);
    }
    if(crowns.length){const trees=justicePalaceV183Boxes(crowns,native);
      if(!native){trees.geometry.dispose();trees.geometry=new IcosahedronGeometry(.5,0);trees.geometry.deleteAttribute('uv');trees.computeBoundingBox();trees.computeBoundingSphere();}
      trees.name=park.name+' illustrative crowns strictly within mapped woodland';trees.userData.sourceMappedWoodland=true;root.add(trees);}
    const details=justicePalaceV183Boxes(rows,native);details.name=park.name+" mapped benches, stone basin edges and rails";root.add(details);
    if(positions.length){const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(positions,3));geo.setAttribute('color',new Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
      const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.95});
      const mesh=new Mesh(geo,day);mesh.name='Two source-mapped surviving Humboldthain viewing platforms';mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);}
  }
  return freezeStaticSceneTransforms(root);
}
