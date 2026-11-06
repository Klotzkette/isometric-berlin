/** Complete public Senate exteriors and finite evidence-bound roof additions.
 * This catalogue is supplied only by the main-thread required-world stage. */
import {Group,Mesh} from "three";
import {createBerlinSenateNightV321Steps,completeBerlinSenateNightV321,disposeBerlinSenateUnpublishedV321} from "./BerlinSenateNightV321";
import {createBerlinSenateUpperWindowsV321Steps,completeBerlinSenateUpperWindowsV321} from "./BerlinSenateUpperWindowsV321";
import data from "./data/berlinSenateBuildingsV321.json";
import previous from "./data/berlinSenatePreviousV321.json";
import {createPackedRootStepsV309,completePackedRootV307,type RequiredPackedV307} from "./requiredPackedRootV307";
import {createExactOwnersSourceV321Steps,type ExactOwnersPlanV321} from "./ExactOwnersV321";
const OWNER=Symbol("complete-berlin-senate-v321");
const MODEL_CONTROL=1326594746; // Final compiler control is pinned after all native/source proofs.
const PREVIOUS_CONTROLS={"drawn":2189099545,"nativeFull":1067994842,"nativeMobile":1741469510,"preview":2796654360};
const proofs=new WeakMap<Group,{night:Group;parent:Mesh;upper:{root:Group;parent:Mesh}[]}>();
const hash=(value:unknown)=>{const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
function exactRecord(actual:unknown,expected:unknown):boolean {
 if(expected===null||typeof expected!=="object")return Object.is(actual,expected);
 if(!actual||typeof actual!=="object"||Array.isArray(actual)!==Array.isArray(expected)||Object.getPrototypeOf(actual)!==Object.getPrototypeOf(expected))return false;
 const keys=Object.keys(expected);if(Object.keys(actual).length!==keys.length)return false;
 return keys.every(k=>{const d=Object.getOwnPropertyDescriptor(actual,k);return !!d&&"value"in d&&exactRecord(d.value,(expected as Record<string,unknown>)[k]);});
}
export function berlinSenatePreviousPrismV321(prism:unknown):boolean{return exactRecord(prism,data.oldBodies[0]);}
export function* createBerlinSenateBuildingsV321Steps(native=false,options:{sourcePrisms?:readonly unknown[];voxels?:unknown;mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group|null> {
 if(hash(data)!==MODEL_CONTROL||!options.sourcePrisms||options.sourcePrisms.filter(berlinSenatePreviousPrismV321).length!==1||native&&!options.voxels)return null;
 const p=berlinSenatePreviousPlanV321(native,options.mobileLike);if(!(yield*createExactOwnersSourceV321Steps(p.plan,options.sourcePrisms,p.control,options.voxels)))return null;
 const models=data.models.filter(p=>p.native===native)as RequiredPackedV307[];
 const root=yield*createPackedRootStepsV309(OWNER,"Berlin Senate complete measured buildings V321",native,models,{berlinSenateBuildingsV321:true},onCreate);
 let delivered=false;
 try{const parent=root.children[0]as Mesh,night=yield*createBerlinSenateNightV321Steps(parent,models[0],native),upper:{root:Group;parent:Mesh}[]=[];
  for(let i=1;i<models.length;i++){const parent=root.children[i]as Mesh,kit=yield*createBerlinSenateUpperWindowsV321Steps(parent,models[i],native);upper.push({root:kit,parent});}
  proofs.set(root,{night,parent,upper});delivered=true;return root;}
 finally{if(!delivered)disposeBerlinSenateUnpublishedV321(root);}
}
export function createBerlinSenateBuildingsV321(native=false,options:{sourcePrisms?:readonly unknown[];voxels?:unknown;mobileLike?:boolean}={}):Group|null{const steps=createBerlinSenateBuildingsV321Steps(native,options);for(;;){const r=steps.next();if(r.done)return r.value;}}
export function hasCompleteBerlinSenateBuildingsV321(root:Group,native?:boolean):boolean{const r=proofs.get(root);return !!r&&completePackedRootV307(root,OWNER,native)&&completeBerlinSenateNightV321(r.night,r.parent,native)&&r.upper.length===2&&r.upper.every(q=>completeBerlinSenateUpperWindowsV321(q.root,q.parent,native));}
export function berlinSenatePreviousPlanV321(native=false,mobileLike=false):{plan:ExactOwnersPlanV321;control:number}{const key=native?mobileLike?"nativeMobile":"nativeFull":"drawn";return {plan:previous[key]as unknown as ExactOwnersPlanV321,control:PREVIOUS_CONTROLS[key]};}
export function berlinSenatePreviewPlanV321():{plan:ExactOwnersPlanV321;control:number}{return {plan:previous.preview as unknown as ExactOwnersPlanV321,control:PREVIOUS_CONTROLS.preview};}
type Solid={ring:number[][];holes:number[][][];bottom:number;top:number;roof:number[][][]};
function inside(ring:number[][],x:number,z:number):boolean{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function near(ring:number[][],x:number,z:number,radius:number):boolean {for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if((x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2<=radius*radius)return true;}return false;}
function contains(p:Solid,x:number,z:number,radius=0):boolean {return inside(p.ring,x,z)&&!p.holes.some(h=>inside(h,x,z)&&!near(h,x,z,radius))||radius>0&&near(p.ring,x,z,radius);}
function roofAt(t:number[][],x:number,z:number):number|null {const[a,b,c]=t,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)return null;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;}
export function berlinSenateNavigationV321(root:Group,native=false):{solidAt:(x:number,y:number,z:number,radius?:number)=>boolean;groundAt:(x:number,z:number,currentY?:number)=>number|null}|null {
 if(!hasCompleteBerlinSenateBuildingsV321(root,native))return null;
 const source=(native?data.navigation.native:data.navigation.drawn)as Solid[];
 const rows=source.map(p=>({p,x0:Math.min(...p.ring.map(v=>v[0])),x1:Math.max(...p.ring.map(v=>v[0])),z0:Math.min(...p.ring.map(v=>v[1])),z1:Math.max(...p.ring.map(v=>v[1]))}));
 const nativeCells=new Map<string,typeof rows>();if(native)for(const q of rows){const k=Math.floor(q.x0/2)+","+Math.floor(q.z0/2),list=nativeCells.get(k)??[];list.push(q);nativeCells.set(k,list);}
 const candidates=(x:number,z:number,r=0)=>{if(!native)return rows.filter(q=>x+r>=q.x0&&x-r<=q.x1&&z+r>=q.z0&&z-r<=q.z1);const found:typeof rows=[];for(let a=Math.floor((x-r)/2);a<=Math.floor((x+r)/2);a++)for(let b=Math.floor((z-r)/2);b<=Math.floor((z+r)/2);b++)for(const q of nativeCells.get(a+","+b)??[])found.push(q);return found;};
 return {solidAt(x,y,z,radius=0){return hasCompleteBerlinSenateBuildingsV321(root,native)&&candidates(x,z,radius).some(({p})=>y>p.bottom-.01&&y<p.top-.01&&contains(p,x,z,radius));},
 groundAt(x,z,currentY){if(!hasCompleteBerlinSenateBuildingsV321(root,native))return null;let best:number|null=null;
  for(const{p}of candidates(x,z)){if(!contains(p,x,z))continue;const heights=p.roof.length?p.roof.map(t=>roofAt(t,x,z)).filter((v):v is number=>v!==null):[p.top];
   for(const y of heights)if((currentY===undefined||y>=currentY-1&&y<=currentY+.65)&&(best===null||y>best))best=y;}return best;}};
}
