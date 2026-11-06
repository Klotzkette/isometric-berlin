/** Complete original Core bodies prove only finite obsolete fitting retirement. */
import source from "./data/wilhelmHousingV324Core.json";
import type {ExactOwnersPlanV321} from "./ExactOwnersV321";
const CONTROLS = {"drawn":2860212308,"nativeFull":3638893245,"nativeMobile":2841146772};
export function wilhelmHousingCorePlanV324(native=false,mobileLike=false):{plan:ExactOwnersPlanV321;control:number}{
 const key=native?(mobileLike?"nativeMobile":"nativeFull"):"drawn";
 return {plan:source[key] as unknown as ExactOwnersPlanV321,control:CONTROLS[key]};
}
