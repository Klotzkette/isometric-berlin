/** Complete original Core component words; only selected facade fittings yield. */
import source from "./data/wilhelmStreetFrontsV325Core.json";
import type {ExactOwnersPlanV321} from "./ExactOwnersV321";
const CONTROLS = {"drawn":1895311961,"drawnV8":1860211847,"nativeFull":3901476953,"nativeMobile":1008490911};
const DELTA_CONTROL=3297719373;
const variants=new WeakMap<object,WeakMap<object,ExactOwnersPlanV321>>();
const hash=(v:unknown)=>{let h=2166136261;for(const c of JSON.stringify(v))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
/** The two Drawn alternatives are independently captured complete constructors,
 * selected by failed exact admission, never by browser identity or tolerance. */
export function wilhelmStreetFrontsCorePlanV325(native=false,mobileLike=false,v8=false):{plan:ExactOwnersPlanV321;control:number}{
 const key=native?(mobileLike?"nativeMobile":"nativeFull"):v8?"drawnV8":"drawn";
 if(key==="drawnV8"){
  const base=source.drawn,delta=source.drawnV8;let byDelta=variants.get(base),plan=byDelta?.get(delta);
  if(hash(base)!==CONTROLS.drawn||hash(delta)!==DELTA_CONTROL||delta.baseControl!==CONTROLS.drawn)throw Error("Changed exact engine variant");
  if(!plan){
   const ids=new Set(delta.owners.map(o=>o.id));if(ids.size!==2||!ids.has("B6BxwVWS")||!ids.has("nRGU0hkP"))throw Error("Foreign exact engine variant");
   const composed={...base,owners:base.owners.map(o=>delta.owners.find(q=>q.id===o.id)??o)};
   if(hash(composed)!==CONTROLS.drawnV8)throw Error("Incomplete exact engine variant");
   plan=composed as unknown as ExactOwnersPlanV321;if(!byDelta){byDelta=new WeakMap();variants.set(base,byDelta);}byDelta.set(delta,plan);
  }
  return {plan,control:CONTROLS.drawnV8};
 }
 return {plan:source[key] as unknown as ExactOwnersPlanV321,control:CONTROLS[key]};
}
