/** Main-thread-only exact owner catalogues; no Worker imports this source. */
import source from "./data/federalMinistriesV321Previous.json";
import type { ExactOwnersPlanV321 } from "./ExactOwnersV321";
const controls = {"drawn":1040397018,"nativeFull":1030778623,"nativeTouch":2630630694,"preview":1677876398,"central":27481554};
/** Literal controls are written by the offline finalizer, never self-approved. */
export function federalMinistryPreviousPlanV321(native=false,mobileLike=false):{plan:ExactOwnersPlanV321;control:number} {
  const key=native?(mobileLike?"nativeTouch":"nativeFull"):"drawn",control=controls[key];
  if(!control)return {plan:{schemaVersion:1,native,owners:[]},control:0};
  const plan=source.plans[key] as unknown as ExactOwnersPlanV321;
  return {plan,control};
}

/** Distant envelopes use a separate exact primitive family from full Core. */
export function federalMinistryPreviewPlanV321():{plan:ExactOwnersPlanV321;control:number}{
  return {plan:source.plans.preview as unknown as ExactOwnersPlanV321,control:controls.preview};
}

/** The separately rebuilt scene-global central detail group has its own source. */
export function federalMinistryCentralPlanV321():{plan:ExactOwnersPlanV321;control:number}{
  return {plan:source.plans.central as unknown as ExactOwnersPlanV321,control:controls.central};
}
