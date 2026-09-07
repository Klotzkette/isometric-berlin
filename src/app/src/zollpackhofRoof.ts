/** Small dependency-free roof fit for the two committed Zollpackhof plans. */
type Rect = {axis:[number,number];center:[number,number];halfLength:number;halfWidth:number};
export function fitZollpackhofRoof(ring:Array<[number,number]>):Rect|null {
  let best:Rect|null=null, area=Infinity;
  for(let i=0;i<ring.length;i+=1) {
    const [x,z]=ring[i],next=ring[(i+1)%ring.length],length=Math.hypot(next[0]-x,next[1]-z);
    if(length<1)continue;
    let ax=(next[0]-x)/length,az=(next[1]-z)/length;
    let us=ring.map(([px,pz])=>px*ax+pz*az),vs=ring.map(([px,pz])=>-px*az+pz*ax);
    if(Math.max(...vs)-Math.min(...vs)>Math.max(...us)-Math.min(...us)) {
      const swap=ax;ax=-az;az=swap;
      us=ring.map(([px,pz])=>px*ax+pz*az);vs=ring.map(([px,pz])=>-px*az+pz*ax);
    }
    const minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);
    const candidate=(maxU-minU)*(maxV-minV);if(candidate>=area)continue;area=candidate;
    const cu=(minU+maxU)/2,cv=(minV+maxV)/2;
    best={axis:[ax,az],center:[cu*ax-cv*az,cu*az+cv*ax],halfLength:(maxU-minU)/2,halfWidth:(maxV-minV)/2};
  }return best;
}
export function zollpackhofHipRoof(rect:Rect,eave:number,ridge:number):Float32Array {
  const [ax,az]=rect.axis,[cx,cz]=rect.center,hl=rect.halfLength+0.2,hw=rect.halfWidth+0.2;
  const at=(u:number,v:number,y:number)=>[cx+ax*u-az*v,y,cz+az*u+ax*v];
  const a=at(-hl,-hw,eave),b=at(hl,-hw,eave),c=at(hl,hw,eave),d=at(-hl,hw,eave);
  const inset=Math.min(hw,hl*0.6),r1=at(-hl+inset,0,ridge),r2=at(hl-inset,0,ridge);
  // Outward/upward winding is required by the drawn material's front faces.
  return new Float32Array([...a,...r2,...b,...a,...r1,...r2,...r1,...c,...r2,...r1,...d,...c,...d,...r1,...a,...b,...r2,...c]);
}
