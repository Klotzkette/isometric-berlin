import {completeCooperatively} from "./cooperativeWork";

type ParkingPlan = {parkSteps():Generator<void,void>;release():void};
export type FirstUploadScheduleV323 = {
  readonly pending:boolean;
  afterRender():void;
  finish():Promise<void>;
  release():void;
};
/** Keep first-upload buffers unchanged through the actual renderer call. A
 * mode change drains the same work before allocating its next world. */
export function createFirstUploadScheduleV323(plan:ParkingPlan,options:{
  yieldTask:()=>Promise<void>;
  yieldAfterPaint:()=>Promise<void>;
  isCancelled:()=>boolean;
  onSettled:()=>void;
  onError:(error:unknown)=>void;
}):FirstUploadScheduleV323 {
  let owned:ParkingPlan|undefined=plan;
  let running:Promise<void>|undefined;
  let released=false,scheduled=false;
  const finish=():Promise<void>=>{
    if(running)return running;
    if(!owned||released)return Promise.resolve();
    const current=owned;
    running=completeCooperatively(current.parkSteps(),{
      budgetMs:4,yieldTask:options.yieldTask,
      isCancelled:()=>released||options.isCancelled(),
    }).finally(()=>{
      if(owned===current){current.release();owned=undefined;}
      if(!released)options.onSettled();
    });
    return running;
  };
  return {
    get pending(){return !!owned&&!released;},
    afterRender(){
      if(scheduled||!owned||released)return;
      scheduled=true;
      void options.yieldAfterPaint().then(()=>{
        if(released)return;
        if(options.isCancelled()){
          released=true;owned?.release();owned=undefined;options.onSettled();return;
        }
        return finish();
      }).catch(error=>{
        options.onError(error);
        // The renderer has already returned. A failed paint scheduler must
        // not strand original buffers behind the background-work barrier.
        if(!released&&owned)return finish().catch(options.onError);
      });
    },
    finish,
    release(){released=true;owned?.release();owned=undefined;},
  };
}
