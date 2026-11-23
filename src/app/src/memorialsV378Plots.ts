import { BoxGeometry,BufferGeometry,Color,DoubleSide,Float32BufferAttribute,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial } from "three";
import plans from "./data/memorialsV378Plots.json";

type P=[number,number,number];
type Surface = (x:number,z:number)=>number|null;
export type MemorialPlotSolidV378 = {
  x:number;z:number;width:number;depth:number;y:number;low:number;high:number;cos:number;sin:number;
  floor?:Surface;inner?:number;outer?:number;
};
export type BurialGroundV378 = "treptow"|"schoenholz";

/** Source-height geometry for the five Treptow laurel plinths and the sixteen
 * Schönholz grave chambers. The latter straddle actual Native terrain steps. */
export function createMemorialPlotMeshV378(kind:BurialGroundV378,native:boolean,ground:Surface) {
  const vertices:number[]=[],colors:number[]=[],runs:number[][]=[];
  const solids:MemorialPlotSolidV378[]=[];
  const tint=new Color(), heights=new Map<string,number>();
  function y(x:number,z:number){
    // The Native northern terrain is constant inside each city-owned 16 m cell.
    const key=native?Math.floor(x/16)+","+Math.floor(z/16):x+","+z;
    let value=heights.get(key);
    if(value===undefined){
      const h=ground(x,z);
      if(h===null||!Number.isFinite(h)) throw Error("Missing surveyed cemetery ground");
      value=h;heights.set(key,h);
    }
    return value;
  }
  function triangle(a:P,b:P,c:P,color:number){
    tint.setHex(color);
    for(const p of [a,b,c]){vertices.push(...p);colors.push(tint.r,tint.g,tint.b);}
  }
  function slab(x:number,z:number,width:number,depth:number,yaw:number,low:number,high:number,color:number,grid=.32){
    const c=Math.cos(yaw),s=Math.sin(yaw);
    function box(corners:number[][],bottom:number,top:number,fixed?:number){
      const below:P[]=corners.map(([px,pz])=>[px,(fixed??y(px,pz))+bottom,pz]);
      const above:P[]=corners.map(([px,pz])=>[px,(fixed??y(px,pz))+top,pz]);
      triangle(above[0],above[3],above[2],color);triangle(above[0],above[2],above[1],color);
      for(let i=0;i<4;i++){
        const j=(i+1)%4;triangle(below[i],above[i],above[j],color);triangle(below[i],above[j],below[j],color);
      }
    }
    if(!native){
      const corners=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]];
      box(corners.map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]),low,high);
      solids.push({x,z,width,depth,y:0,low,high,cos:c,sin:s,floor:ground});
      return;
    }
    // Merge consecutive cardinal cells of matching height into a single run.
    const ex=(Math.abs(width*c)+Math.abs(depth*s))/2,ez=(Math.abs(width*s)+Math.abs(depth*c))/2;
    for(let iz=Math.floor((z-ez)/grid);iz<=Math.floor((z+ez)/grid);iz++){
      const pz=(iz+.5)*grid,z0=iz*grid;
      let start:number|null=null,base=0;
      const end=Math.floor((x+ex)/grid)+1;
      for(let ix=Math.floor((x-ex)/grid);ix<=end;ix++){
        const px=(ix+.5)*grid,dx=px-x,dz=pz-z;
        const inside=ix<end&&Math.abs(dx*c-dz*s)<=width/2&&Math.abs(dx*s+dz*c)<=depth/2;
        const floor=inside?y(px,pz):null;
        if(start!==null&&floor!==base){
          const cx=(start+ix)*grid/2,cz=z0+grid/2,w=(ix-start)*grid;
          runs.push([cx,base+(low+high)/2,cz,w,high-low,grid,color]);
          solids.push({x:cx,z:cz,width:w,depth:grid,y:base,low,high,cos:1,sin:0});
          start=null;
        }
        if(start===null&&floor!==null){start=ix;base=floor;}
      }
    }
  }

  if(kind==="schoenholz"){
    const yaw=Math.atan2(.691,.723),c=Math.cos(yaw),s=Math.sin(yaw);
    for(const [x,z,w,d,side] of plans.schoenholz){
      const rim=.42;
      slab(x,z,w,d,yaw,0,.27,0xb0aa99);
      slab(x,z,w-rim*2,d-rim*2,yaw,.27,.31,0x777a53);
      // Dark sloping marker at the inner end, facing the central alley.
      const u=side*(w/2-.8);
      slab(x+c*u,z-s*u,1.07,d*.52,yaw,.27,.46,0x77766a);
      slab(x+c*(u-side*.13),z-s*(u-side*.13),.69,d*.47,yaw,.46,.64,0x6d6c60);
    }
  }else{
    const yaw=-Math.atan2(.61,.792);
    for(const [x,z] of plans.treptow){
      slab(x,z,6.85,6.85,yaw,0,.21,0xc1b9a8);
      // The maintenance authority documents a laurel wreath with a ribbon on
      // each of the five square memorial slabs. The inner circle stays open.
      if(native){
        const cell=.24;
        for(let iz=Math.floor((z-2)/cell);iz<=Math.floor((z+2)/cell);iz++){
          const pz=(iz+.5)*cell;
          let start:number|null=null;
          const end=Math.floor((x+2)/cell)+1;
          for(let ix=Math.floor((x-2)/cell);ix<=end;ix++){
            const radius=Math.hypot((ix+.5)*cell-x,pz-z);
            const inside=ix<end&&radius>=1.48&&radius<=1.95;
            if(inside&&start===null)start=ix;
            if(!inside&&start!==null){
              slab((start+ix)*cell/2,pz,(ix-start)*cell,cell,0,.21,.48,0x4d554b,cell);
              start=null;
            }
          }
        }
        continue;
      }
      solids.push({x,z,width:3.92,depth:3.92,y:y(x,z),low:.21,high:.54,cos:1,sin:0,inner:1.47,outer:1.96});
      for(let i=0;i<64;i++){
        const a=i*2*Math.PI/64,b=(i+1)*2*Math.PI/64;
        const ring=(angle:number,r:number,h:number):P=>[x+r*Math.cos(angle),y(x,z)+h,z+r*Math.sin(angle)];
          for(const [r0,h0,r1,h1] of [[1.47,.22,1.52,.44],[1.52,.44,1.68,.52],[1.68,.52,1.9,.4],[1.9,.4,1.96,.22]]){
            const p=ring(a,r0,h0),q=ring(b,r0,h0),r=ring(b,r1,h1),t=ring(a,r1,h1);
            triangle(p,q,r,0x4d554b);triangle(p,r,t,0x4d554b);
          }
          if(i%2===0){
            const base=ring(a-.09,1.66,.521),tip=ring(a+.095,1.76,.521);
            triangle(base,ring(a,1.55,.54),tip,0x6c7162);
            triangle(base,tip,ring(a+.015,1.86,.50),0x5b6457);
          }
      }
    }
  }
  if(native){
    const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshStandardMaterial({roughness:.94}),runs.length);
    const matrix=new Matrix4();
    runs.forEach(([x,y,z,w,h,d,color],i)=>{
      matrix.makeScale(w,h,d);matrix.setPosition(x,y,z);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,tint.setHex(color));
    });
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
    return {mesh,solids};
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(vertices,3));
  geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {mesh:new Mesh(geometry,new MeshStandardMaterial({roughness:.94,side:DoubleSide,vertexColors:true})),solids};
}
