import data from './data/tempodromAnhalterV266.json';

type Source = {id?:unknown;ring?:unknown;holes?:unknown;y0_dm?:unknown;h_dm?:unknown;class?:unknown;roof?:unknown;tone?:unknown};
export type AnhalterRowV266 = {position:[number,number,number];size:[number,number,number];angle:number;tone:number;role:string};
export const TEMPODROM_ANHALTER_V266_PROFILE = {
  portico:data.portico,tempodrom:data.tempodrom,dimensionPolicy:data.estimates,
  cameras:{anhalter:{position:[740,37,1658],target:[713.53,16,1709.30]},tempodrom:{position:[708,88,1840],target:[622,24,1940]}},
  fullStaticDetailOnTouch:true,photographicTexture:false,
} as const;
const fingerprint=(p:Source)=>JSON.stringify([p.id,p.ring,p.holes,p.y0_dm,p.h_dm,p.class,p.roof,p.tone]);
export function isAnhalterSourceV266(value:unknown):boolean{
  return !!value&&typeof value==='object'&&fingerprint(value as Source)===fingerprint(data.portico.previousPrism);
}
export function isTempodromSourceV266(value:unknown):boolean{
  return !!value&&typeof value==='object'&&fingerprint(value as Source)===fingerprint(data.tempodrom.retainedPrism);
}
/** Published twelve-fold morphology; curvature and local fit are display estimates. */
export function tempodromRoofAtV266(x:number,z:number,native=false):number|null{
  const p=data.tempodrom,cell=.85;
  if(native){x=(Math.floor(x/cell)+.5)*cell;z=(Math.floor(z/cell)+.5)*cell;}
  const dx=x-p.centre[0],dz=z-p.centre[1],r=Math.hypot(dx,dz);
  if(r>p.radius+.00001)return null;
  if(r<5.4999)return 35.75;
  const phase=((Math.atan2(dz,dx)-.18)*12/(Math.PI*2)%1+1)%1;
  const fold=1-Math.abs(phase*2-1),t=Math.max(0,(p.radius-r)/(p.radius-5.5));
  const y=14.45+3.5*fold+(21.3+2.95*fold)*t**2.35;
  return native?Math.round(y/.5)*.5+.22:y;
}
export function containsAnhalterRingV266(ring:readonly (readonly number[])[],x:number,z:number):boolean{
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
/** Exact original column tuple and source fingerprint; changed neighbours fail closed. */
export function createAnhalterColumnTesterV266(prisms:readonly unknown[]|undefined,cell:number){
  const no=(_x:number,_z:number,_lo:number,_hi:number,_kind:number)=>false;
  if(cell!==data.cellM||!prisms?.some(isAnhalterSourceV266))return no;
  const candidates=data.columns.filter(c=>!prisms.some(raw=>{
    const p=raw as Source;if(isAnhalterSourceV266(p)||!Array.isArray(p?.ring))return false;
    const ring=p.ring as number[][],x0=c[0]*cell*10,z0=c[1]*cell*10,x1=x0+cell*10,z1=z0+cell*10;
    // Conservative bounding-box overlap deliberately retains uncertain new owners.
    return !(ring.every(p=>p[0]<x0)||ring.every(p=>p[0]>x1)||ring.every(p=>p[1]<z0)||ring.every(p=>p[1]>z1));
  }));
  const keys=new Set(candidates.map(c=>c.join('/')));
  return(x:number,z:number,lo:number,hi:number,kind:number)=>keys.has([x,z,lo,hi,kind].join('/'));
}
export function anhalterPointV266(u:number,y:number,v:number):[number,number,number]{
  const p=data.portico,[dx,dz]=p.direction;return[p.centre[0]+dx*u-dz*v,y,p.centre[1]+dz*u+dx*v];
}
/** Structural masonry only. Both rendering and navigation consume the same solids. */
export function anhalterMasonryRowsV266(native=false):AnhalterRowV266[]{
  const rows:AnhalterRowV266[]=[],[dx,dz]=data.portico.direction,ground=5.2;
  const add=(u:number,y:number,v:number,w:number,h:number,d:number,tone:number,role:string)=>{
    if(!native)rows.push({position:anhalterPointV266(u,y,v),size:[w,h,d],angle:-Math.atan2(dz,dx),tone,role});
    else{
      const nx=Math.max(1,Math.ceil(w/.35)),nz=Math.max(1,Math.ceil(d/.35)),sw=w/nx,sd=d/nz;
      for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)rows.push({position:anhalterPointV266(u-w/2+(i+.5)*sw,y,v-d/2+(j+.5)*sd),size:[Math.abs(dx)*sw+Math.abs(dz)*sd,h,Math.abs(dz)*sw+Math.abs(dx)*sd],angle:0,tone,role});
    }
  };
  // Three through-openings in the front and rear of the surviving vaulted canopy.
  for(const v of [-3.02,2.92]){
    for(const u of [-8.15,-2.75,2.75,8.15])add(u,ground+3.65,v,1.45,7.3,.85,0xa78d63,'portico-pier');
    for(const u of [-5.45,0,5.45]){
      const radius=1.99,spring=ground+5.75,top=v<0?15.80:16.52,n=24,step=radius*2/n;
      for(let i=0;i<n;i++){
        const x=(i+.5)*step-radius,bottom=spring+Math.sqrt(Math.max(0,radius*radius-x*x));
        add(u+x,(bottom+top)/2,v,step+.008,top-bottom,.85,0xb39a70,'arch-spandrel');
      }
    }
    for(const u of [-8.15,-2.75,2.75,8.15]){
      add(u,ground+.25,v,1.7,.5,1.05,0x96866d,'pier-stone-base');
      add(u,ground+5.68,v,1.66,.34,1.02,0xbdb097,'pier-capital');
    }
  }
  // Rear vestibule wall: three real oculi, broken stepped shoulders, no hall.
  const y0=16.5,y1=23.75,step=.20;
  for(let u=-12.8+step/2;u<12.8;u+=step){
    const shoulder= Math.abs(u)>9.3 ? y1-(Math.floor((Math.abs(u)-9.3)/.8)+1)*.65:y1;
    let cut:{bottom:number;top:number}|null=null;
    for(const centre of [-5.45,0,5.45])if(Math.abs(u-centre)<1.20){const h=Math.sqrt(1.44-(u-centre)**2);cut={bottom:20.25-h,top:20.25+h};}
    if(cut){add(u,(y0+cut.bottom)/2,3.12,step+.005,cut.bottom-y0,.92,0xaf966c,'oculus-lower-wall');add(u,(cut.top+shoulder)/2,3.12,step+.005,shoulder-cut.top,.92,0xaf966c,'oculus-upper-wall');}
    else add(u,(y0+shoulder)/2,3.12,step+.005,shoulder-y0,.92,0xaf966c,'ruined-upper-wall');
  }
  // Retained flanking lower masonry is a narrow rear wall, never a complete hall.
  for(const side of [-1,1])add(side*10.7,(ground+17.9)/2,3.12,4.4,17.9-ground,.92,0xa88c62,'ruin-side-wall');
  for(const y of [16.85,23.7])add(0,y,3.12,y>20?18.5:25.7,.32,1.22,0xb9a584,'rear-cornice');
  // Clock-opening crest, open centre. The circular frame is built as masonry voussoirs.
  for(let i=0;i<32;i++){
    const a=(i+.5)*Math.PI*2/32,u=Math.cos(a)*1.38,y=25.35+Math.sin(a)*1.38;
    add(u,y,3.12,.36,.36,.98,0xb9a584,'open-clock-crest');
  }
  return rows;
}
export function anhalterSolidsForV266(native=false){
  const solids=anhalterMasonryRowsV266(native).map(r=>{
    const [x,y,z]=r.position,[w,h,d]=r.size,c=Math.cos(r.angle),s=Math.sin(r.angle);
    const ring=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]);
    return{ring,holes:[] as number[][][],minY:y-h/2,maxY:y+h/2,sourceId:data.portico.owner};
  });
  // Walking under the preserved overhead sheet is possible; its original top stays solid.
  solids.push({ring:data.portico.ring,holes:[],minY:15.60,maxY:16.75,sourceId:data.portico.owner});
  return solids;
}
