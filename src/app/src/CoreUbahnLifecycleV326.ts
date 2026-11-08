/** Private semantic epochs: only a real northern transition permits retry. */
export function createCoreUbahnLifecycleV326<W extends object,N>(release:(world:W)=>void){
 type State={epoch:number;blocked:boolean;attempted?:number;pending?:number;north?:N};
 type Ticket={epoch:number;north?:N};
 const states=new WeakMap<W,State>();
 const state=(world:W)=>{let s=states.get(world);if(!s){s={epoch:0,blocked:false};states.set(world,s);}return s;};
 return{
  begin(world:W):(north?:N)=>void{const s=state(world),epoch=++s.epoch;s.blocked=true;s.attempted=undefined;s.pending=undefined;release(world);let ended=false;return north=>{if(ended)return;ended=true;if(s.epoch!==epoch)return;s.north=north;s.blocked=false;};},
  start(world:W):Ticket|undefined{const s=state(world);if(s.blocked||s.attempted===s.epoch||s.pending===s.epoch)return;const ticket={epoch:s.epoch,north:s.north};s.attempted=s.pending=s.epoch;return ticket;},
  current(world:W,ticket:Ticket):boolean{const s=state(world);return!s.blocked&&s.epoch===ticket.epoch&&s.north===ticket.north;},
  finish(world:W,ticket:Ticket):void{const s=state(world);if(s.pending===ticket.epoch)s.pending=undefined;},
 };
}
