/** Bounded retries for newly split imports, with a real task boundary and no
 * scene timer. A failed import never stands in for a completed model. */
export async function loadStartupModuleV323<T>(load:()=>Promise<T>,yieldTask:()=>Promise<void>,isCancelled:()=>boolean=()=>false):Promise<T>{
  for(let attempt=0;;attempt++){
    if(isCancelled())throw new DOMException("Module loading cancelled","AbortError");
    try{return await load();}
    catch(error){
      if(attempt===2||isCancelled())throw error;
      await yieldTask();
    }
  }
}
