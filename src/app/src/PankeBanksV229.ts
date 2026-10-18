import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import source from "./data/pankeBanksV229.json";
import nativeSource from "./data/pankeNativeBanksV229.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Cell = { positions: number[]; colors: number[]; indices: number[]; rows: number[][] };
/** Exact open-water boundaries, shared static cells and no texture residency.
 * Brick courses and original abstract paint strokes are display estimates;
 * the source river, tunnels, fish pass and upstream landscape are retained. */
export function createPankeBanksV229(native=false): Group {
  const root=new Group();root.name="Lower Panke recessed banks v229";
  root.userData={pankeBanksV229:true,textureFree:true,fullStaticDetailOnTouch:true,
    nativeMinecraft:native,blockNative:native,keepInMinecraft:native,displayMaterialsEstimated:true};
  const cells=new Map<string,Cell>(),tint=new Color();
  for(const raw of (native ? nativeSource : source).banks) {
    const [ax,az,bx,bz,nx,nz]=raw as number[],kind=raw[6] as string;
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    const topAt=(u:number)=>(raw[7] as number)+(Number(raw[8])-Number(raw[7]))*u/length;
    const split=Math.max(1,Math.ceil(length/12));
    for(let part=0;part<split;part++) {
      const u0=part*length/split,u1=(part+1)*length/split,mid=(u0+u1)/2;
      const key=`${Math.floor((ax+ux*mid)/256)}:${Math.floor((az+uz*mid)/256)}`;
      let cell=cells.get(key);if(!cell){cell={positions:[],colors:[],indices:[],rows:[]};cells.set(key,cell);}
      const quad=(lo:number,hi:number,bottom:number|((u:number)=>number),top:number|((u:number)=>number),color:number,offset=.06)=>{
        const p=(u:number,y:number)=>[ax+ux*u+nx*offset,y,az+uz*u+nz*offset];
        const low=(u:number)=>typeof bottom==='number'?bottom:bottom(u),high=(u:number)=>typeof top==='number'?top:top(u);
        const a=p(lo,low(lo)),b=p(hi,low(hi)),c=p(hi,high(hi)),d=p(lo,high(lo));
        if(native) {
          const count=Math.max(1,Math.ceil((hi-lo)/1));
          for(let i=0;i<count;i++) {
            const w=(hi-lo)/count,u=lo+(i+.5)*w;
            cell!.rows.push([ax+ux*u+nx*offset,(high(u)+low(u))/2,az+uz*u+nz*offset,
              Math.max(.09,Math.abs(ux)*w+Math.abs(nx)*.09),high(u)-low(u),
              Math.max(.09,Math.abs(uz)*w+Math.abs(nz)*.09),color]);
          }
        }else {
          tint.setHex(color);
          const index=cell!.positions.length/3;
          for(const v of [a,b,c,d]) {cell!.positions.push(...v);cell!.colors.push(tint.r,tint.g,tint.b);}
          cell!.indices.push(index,index+1,index+2,index,index+2,index+3);
        }
      };
      const color=kind==="brick"?0x8c6451:kind==="earth"?0x727663:0x92928a;
      quad(u0,u1,source.waterY-.08,topAt,color);
      quad(u0,u1,u=>topAt(u)-.12,u=>topAt(u)+.015,kind==="earth"?0x7e826d:0xb4ada0,.075);
      quad(u0,u1,-1.1,-.73,0x52605a,.08);
      if(kind==="brick") {
        // Courses are actual static geometry, equally present on touch devices.
        for(let y=-.6;y<Math.min(topAt(u0),topAt(u1))-.16;y+=.24) quad(u0,u1,y,y+.025,0xb49a7d,.09);
        // A bounded original abstract motif every ~24m, never copied lettering.
        // Native strokes are independently generated orthogonal boxes.
        if((Math.floor((ax+ux*mid)/24)+Math.floor((az+uz*mid)/24))%3===0 && u1-u0>2.2) {
          const palette=[0xb8b8a9,0x879d9e,0xb48c78,0x8c8fbd];
          const c=palette[Math.abs(Math.floor(ax+az+mid))%palette.length];
          for(let i=0;i<5;i++) {
            const a=u0+.4+i*.34,y=.25+Math.sin(i*1.7)*.24;
            quad(a,a+.15,y,y+.7,c,.12);
            if(i<4)quad(a,a+.43,y+.52,y+.63,c,.12);
          }
        }
      }
    }
  }
  for(const [key,cell]of cells) {
    if(native) {
      const mesh=justicePalaceV183Boxes(cell.rows,true);mesh.name=`Panke bank ${key} native`;
      Object.assign(mesh.userData,{pankeBanksV229:true,siteKey:key,nativeMinecraft:true});root.add(mesh);
    }else {
      const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array(cell.positions),3));
      geometry.setAttribute("color",new BufferAttribute(new Float32Array(cell.colors),3));geometry.setIndex(cell.indices);geometry.computeVertexNormals();
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
      const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.94});
      const mesh=new Mesh(geometry,day);mesh.name=`Panke bank ${key}`;
      mesh.userData={pankeBanksV229:true,siteKey:key,dayMaterial:day,nightMaterial:night};root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
