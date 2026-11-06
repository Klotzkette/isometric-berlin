/** Literal-pinned university plans compose with the existing government source. */
import data from "./data/universitiesPreviousV322.json";
import type { ExactOwnersPlanV321 } from "./ExactOwnersV321";
type Key="drawn"|"nativeFull"|"nativeTouch"|"preview";
const controls:Record<Key,number>={"drawn":2411898860,"nativeFull":3324122607,"nativeTouch":2690602203,"preview":1139647550};
/** No early source filter and no second transaction against a shared host. */
export function uniExactPlansV322(native=false,mobileLike=false,preview=false):{plan:ExactOwnersPlanV321;control:number} {
 const key:Key=preview?"preview":native?(mobileLike?"nativeTouch":"nativeFull"):"drawn";
 return {plan:data.plans[key] as unknown as ExactOwnersPlanV321,control:controls[key]};
}
