import type{SourceQuarterRecipesV309}from"./SourceQuarterCatalogueV309";
/** Recipes must finish before decode; required model construction may proceed
 * independently while the unchanged original packet remains the closed gate. */
export function createNorthernQuarterLoadingV309(options:{
 loadRecipes:(id:string,native:boolean)=>Promise<SourceQuarterRecipesV309>;
 requestNorthern:(native:boolean)=>Promise<unknown>;
 active:(native:boolean)=>boolean;
 onError:(error:unknown)=>void;
}){
 const pending=new Map<boolean,Promise<unknown>>();
 return async(id:string,native:boolean):Promise<SourceQuarterRecipesV309>=>{
  const recipes=await options.loadRecipes(id,native);
  if(recipes.some(r=>r.admission==="north-v309")&&options.active(native)&&!pending.has(native)){
   const task=Promise.resolve().then(()=>options.active(native)?options.requestNorthern(native):undefined);pending.set(native,task);
   void task.then(()=>{if(pending.get(native)===task)pending.delete(native);},error=>{if(pending.get(native)===task)pending.delete(native);try{options.onError(error);}catch{/* Reporting cannot reject a valid original source packet. */}});
  }
  return recipes;
 };
}
