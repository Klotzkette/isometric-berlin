/** Finite reference-guided joinery, merged into the original campus batches. */
import data from './data/universityRefinementV347.json';

export type UniversityFaceV347={owner:string;parent?:string;vine?:boolean;a:number[];d:number[];n:number[];range:number[];polygon:number[][];holes:number[][][];voids:number[][]};
type Profile={key:string;kind:string;parents:string[];faces:UniversityFaceV347[];nativeFaces:UniversityFaceV347[];pitch:number;storey:number;ratio:number;newDrawnGlazing:boolean};
type Fit={face:UniversityFaceV347;u:number;y:number;w:number;h:number;depth:number;out:number;tone:number;glass:boolean;role:string};
const source=data as unknown as {schemaVersion:number;universitiesSourceControl:number;profiles:Profile[]};
const CONTROL=291249185; // Finalized from the finite compiler output, not a caller capability.
let admitted:boolean|undefined;
const freeze=(v:unknown):void=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}};
function ready(){
 if(admitted!==undefined)return admitted;
 const text=JSON.stringify(source);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;
 admitted=source.schemaVersion===1&&source.universitiesSourceControl===1141110182&&h===CONTROL;
 if(admitted)freeze(source);return admitted;
}
const inside=(x:number,y:number,ring:readonly number[][])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
/** Whole rectangle must fit an actual source sheet, excluding all void edges. */
export function universityFitV347(f:UniversityFaceV347,u:number,y:number,w:number,h:number):boolean{
 const lo=u-w/2,hi=u+w/2,b=y-h/2,t=y+h/2;
 if(lo<f.range[0]||hi>f.range[1]||b<f.range[2]||t>f.range[3]||f.voids.some(q=>hi>q[0]&&lo<q[1]&&t>q[2]&&b<q[3]))return false;
 const corners=[[lo,b],[hi,b],[hi,t],[lo,t]];
 if(corners.some(p=>!inside(p[0],p[1],f.polygon)||f.holes.some(r=>inside(p[0],p[1],r))))return false;
 const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(const ring of[f.polygon,...f.holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],q=ring[(i+1)%ring.length];if(a[0]>lo&&a[0]<hi&&a[1]>b&&a[1]<t)return false;
  for(let j=0;j<4;j++){const c=corners[j],d=corners[(j+1)%4];if(cross(a,q,c)*cross(a,q,d)<0&&cross(c,d,a)*cross(c,d,q)<0)return false;}
 }return true;
}

function* fittings(p:Profile,native:boolean):Generator<Fit>{
 for(const face of native?p.nativeFaces:p.faces){
  if(native&&face.d[0]*face.d[1]!==0)throw Error('Non-cardinal university native fitting');
  const [lo,hi,bottom,top]=face.range;
  const put=function*(u:number,y:number,w:number,h:number,depth:number,out:number,tone:number,role:string,glass=false):Generator<Fit>{
   if(universityFitV347(face,u,y,w,h))yield {face,u,y,w,h,depth,out,tone,role,glass};
  };
  const bays=Math.max(1,Math.round((hi-lo)/p.pitch)),pitch=(hi-lo)/bays;
  const storey=p.kind==='grashof'&&top-bottom>30?3.8:p.storey;
  if(p.kind==='grashof'||p.kind==='physics'||p.kind==='hwr-stone'){
   const shallow=top-bottom<3.3;
   for(let y=bottom+(shallow?1.2:1.9);y+(shallow?.65:1.25)<top-.2;y+=storey)for(let bay=0;bay<bays;bay++){
    const u=lo+(bay+.5)*pitch,w=Math.min(pitch-.32,pitch*p.ratio),h=shallow?1.3:Math.min(storey-1.05,2.45);
    if(!universityFitV347(face,u,y,w+.26,h+.3))continue;
    const blue=p.kind==='grashof'?0x326C8C:p.kind==='physics'?0x7A8C87:0xE0DFD2;
    if(!native&&p.newDrawnGlazing)yield*put(u,y,w,h,.075,.30,p.kind==='physics'?0x688991:0x536D79,'missing-source-pane',true);
    if(p.newDrawnGlazing)for(const side of[-1,1]){
     yield*put(u+side*(w/2-.03),y,.065,h,.10,.51,blue,'inset-metal-jamb');
     yield*put(u,y+side*(h/2-.03),w,.065,.10,.51,blue,'inset-metal-rail');
    }
    // HWR's paired pane transoms and the technical sash of Grashof are absent
    // from the previous generic vertical-only campus joinery.
    for(const offset of p.kind==='hwr-stone'?[-.42,.55]:[.34])yield*put(u,y+offset,w,.065,.09,.54,blue,'window-transom');
    if(p.kind==='hwr-stone')yield*put(u,y-h/2-.20,w+.32,.13,.22,.49,0xB2AC99,'stone-sill');
   }
  }
  if(p.kind==='grashof'){
   for(let y=bottom+3.0;y<top-.3;y+=storey)for(let u=lo+.75;u<hi-.6;u+=1.5)
    yield*put(u,y,1.38,.11,.08,.16,0x90958D,'concrete-spandrel-joint');
  }
  if(p.kind==='physics'){
   const vines=face.vine===true;
   for(let u=lo+.5;u<hi-.3;u+=vines?1.4:.8){
    // Segment by source storeys: never bridge the photographed open portal,
    // a shared wall void, a lower roof or a native skin hole.
    for(let y=bottom+.7;y<top-.3;y+=1.4){
     yield*put(u,y,vines?.07:.04,1.25,.09,vines?.62:.52,vines?0x8A5142:0xA5B9B9,vines?'rust-steel-vine-upright':'translucent-glass-rib');
     if(vines&&Math.round((u-lo)/1.4)%3!==0&&Math.round((y-bottom)/1.4)%3!==1)
      yield*put(u+.16,y+.12,.28,.48,.12,.67,Math.round(u+y)%2?0x5E7A47:0x728A55,'summer-vine-leaves');
    }
   }
   if(vines)for(let y=bottom+2.7;y<top-.2;y+=3.5)for(let u=lo+.65;u<hi-.5;u+=1.3)
    yield*put(u,y,1.22,.075,.12,.64,0xBCC3B9,'vine-screen-horizontal-rail');
  }
  if(p.kind==='hwr-stone'){
   for(let y=bottom+.45;y<Math.min(bottom+4.8,top);y+=.65)for(let bay=0;bay<=bays;bay++){
    const u=lo+bay*pitch;
    yield*put(u,y,Math.max(.28,pitch*(1-p.ratio)-.35),.045,.045,.18,0xA6A18F,'rusticated-base-course');
   }
   for(let u=lo+.4;u<hi-.2;u+=.55)yield*put(u,top-.45,.19,.22,.17,.30,0xD6D0BB,'eave-dentil');
   for(let y=bottom+3.35;y<top-.4;y+=storey)for(let u=lo+.6;u<hi-.4;u+=1.2)yield*put(u,y,1.12,.105,.15,.20,0xC0BBA8,'stone-string-course');
  }
  if(p.kind==='ford-pilasters'){
   for(let bay=1;bay<bays;bay++){
    const u=lo+bay*pitch;
    for(let y=bottom+.7;y<top-.6;y+=1.4)yield*put(u,y,.20,1.37,.28,.55,0xD7D9CF,'full-height-white-pilaster');
   }
   for(let u=lo+.6;u<hi-.4;u+=1.2)yield*put(u,top-.32,1.16,.16,.30,.58,0xD3D6CE,'projecting-pilaster-head');
  }
  if(p.kind==='tu-aluminium'){
   // Fine fluting only in the aluminium below the existing 1.9m glazed bands.
   // Both measured planes and independent 1m Native skin use their own mask.
   for(let y=11.0;y<49;y+=4.35)for(let u=lo+.3;u<hi-.2;u+=1.1)
    yield*put(u,y,.045,1.40,.055,.24,0xA6B0B1,'aluminium-spandrel-fluting');
  }
 }
}

export function* universityRefinementRowsV347Steps(key:string,native:boolean,observe?:(fit:Fit)=>void):Generator<void,{frames:number[][];glass:number[][]}>{
 const frames:number[][]=[],glass:number[][]=[];
 if(!ready())throw Error('Finite university fitting source changed');
 const p=source.profiles.find(p=>p.key===key);if(!p)return {frames,glass};
 let count=0;
 for(const f of fittings(p,native)){
  const {face,u,y,w,h,depth,out,tone}=f;
  const row=[face.a[0]+face.d[0]*u+face.n[0]*out,y,face.a[1]+face.d[1]*u+face.n[1]*out,w,h,depth];
  if(native){if(Math.abs(face.d[1])>.5)[row[3],row[5]]=[row[5],row[3]];row.push(tone);}else row.push(-Math.atan2(face.d[1],face.d[0]),tone);
  (f.glass?glass:frames).push(row);observe?.(f);if(++count%64===0)yield;
 }return {frames,glass};
}
export function universityRefinementRowsV347(key:string,native:boolean):{frames:number[][];glass:number[][]}{
 const steps=universityRefinementRowsV347Steps(key,native);for(;;){const next=steps.next();if(next.done)return next.value;}
}
