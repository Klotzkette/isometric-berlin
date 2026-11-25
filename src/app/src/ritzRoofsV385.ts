import data from './data/ritzRoofsV385.json';
import type { SonyRoofSourcePrism } from './sonyCenterRoofSource';

type Roof = {source:SonyRoofSourcePrism; p:number[][]; i:number[]; n:number[][]; eave:number; roofCorners:number};
const roofs = new Map<string,Roof>(Object.entries(data));
const footprint = (p:SonyRoofSourcePrism)=>JSON.stringify([p.y0_dm,p.h_dm,p.ring,p.holes ?? []]);
const original = new Map([...roofs].map(([id,record])=>[id,footprint(record.source)]));
const cells = new Map<number,{id:string; col:number[]}>();
for(const roof of roofs.values()) for(const col of roof.n) cells.set(col[0]+128*col[1],{id:roof.source.id,col});

function matching(p:SonyRoofSourcePrism) {
  const roof=roofs.get(p.id);
  return roof && footprint(p)===original.get(p.id) ? roof : undefined;
}
export function ritzRoofV385(p:SonyRoofSourcePrism) {
  const roof=matching(p);
  if(!roof) return null;
  const triangles=new Float32Array(3*roof.i.length);
  for(const [corner,idx] of roof.i.entries()) for(let j=0;j<3;j++) triangles[3*corner+j]=roof.p[idx][j]/1000;
  return {triangles,wallHeight:roof.eave/1000-p.y0_dm/10};
}

export function ritzNativeRoofHeightsV385(prisms:readonly SonyRoofSourcePrism[]) {
  const admitted = new Set(prisms.filter(p=>matching(p)).map(p=>p.id));
  if (!admitted.size) return undefined;
  return (x:number,z:number,bottom:number,top:number,cls:number) => {
    if(x<49||x>67||z<227||z>246||cls!==3) return top;
    const entry=cells.get(x+128*z);
    if(!entry || !admitted.has(entry.id)) return top;
    const col=entry.col;
    return col[2]===bottom && col[3]===top ? col[4] : top;
  };
}

export function ritzRoofNavigationV385(p:SonyRoofSourcePrism) {
  const roof=matching(p);
  if(!roof) return undefined;
  return (worldX:number,worldZ:number,native:boolean)=> {
    const x=worldX*1000,z=worldZ*1000;
    if(native) {
      const cell=cells.get(Math.floor(worldX/4)+128*Math.floor(worldZ/4));
      if(cell?.id===p.id) return cell.col[4]/10;
    }
    for(let j=0;j<roof.roofCorners;j+=3) {
      const a=roof.p[roof.i[j]],b=roof.p[roof.i[j+1]],c=roof.p[roof.i[j+2]];
      const bx=b[0]-a[0],bz=b[2]-a[2],cx=c[0]-a[0],cz=c[2]-a[2];
      const det=bx*cz-bz*cx;
      if(Math.abs(det)<1) continue;
      const v=((x-a[0])*cz-(z-a[2])*cx)/det, w=(bx*(z-a[2])-bz*(x-a[0]))/det;
      if(v>=-1e-7 && w>=-1e-7 && v+w<=1.0000001) return (a[1]+v*(b[1]-a[1])+w*(c[1]-a[1]))/1000;
    }
    return roof.eave/1000;
  };
}
