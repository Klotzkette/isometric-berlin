import { describe, expect, it } from 'bun:test';
import { Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import rails from '../src/data/tramRailsV281.json';
import { createTramRailsV281, tramOffsetNormalsV281 } from '../src/TramRailsV281';
import { createUbahnEntrancesV281 } from '../src/UbahnEntrancesV281';
import { cutUbahnSurfaceV281, cutUbahnGroundSlabsV281 } from '../src/UbahnSurfaceAperturesV281';
import { UBAHN_STAIRS_V281, ubahnV281FloorAt, ubahnV281SolidAt } from '../src/ubahnEntrancesV281Profile';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import { letteringLayout, letteringStrokePaths } from '../src/drawnLettering';

describe('v281 measured tram courses and actual U6 entrances',()=>{
  it('joins offset rails at a retained bend without changing gauge or bridging a real gap',()=>{
    const p=[[0,0],[10,0],[10,10]],n=tramOffsetNormalsV281(p);
    expect(n).toEqual([[-0,1],[-1,1],[-1,0]]);
    // The common bend vertex belongs to both adjacent parallel rail edges.
    for(const side of [-1,1]){
      const x=p[1][0]+n[1][0]*side*1.435/2,z=p[1][1]+n[1][1]*side*1.435/2;
      expect(Math.abs(z)).toBeCloseTo(1.435/2,9);expect(Math.abs(x-10)).toBeCloseTo(1.435/2,9);
    }
    const map=new Map([['10:0',[[-1,0],[0,1]]]]);
    expect(tramOffsetNormalsV281(p.slice(0,2),map)[1]).toEqual(n[1]);
    expect(tramOffsetNormalsV281(p.slice(1),map)[0]).toEqual(n[1]);
    expect(tramOffsetNormalsV281([[0,0],[10.01,0]],map)[1]).toEqual([-0,1]);
    expect(tramOffsetNormalsV281([[0,0],[0,0],[10,0]])).toEqual([[-0,1],[-0,1],[-0,1]]);
  });
  for(const native of [false,true])it(`rail batches retain every source identity and finite orthogonal native geometry: ${native}`,()=>{
    const root=createTramRailsV281(native),ids=new Set<string>();let bytes=0,quads=0;
    expect(root.userData.trackCount).toBe(107);expect(root.userData.gaugeM).toBe(1.435);
    expect(root.children.length).toBeLessThan(25);
    for(const child of root.children){
      const mesh=child as Mesh,p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index!;
      mesh.userData.sourceTrackIds.forEach((id:string)=>ids.add(id));
      bytes+=p.array.byteLength+index.array.byteLength+mesh.geometry.getAttribute('normal').array.byteLength;
      expect(mesh.geometry.getAttribute('uv')).toBeUndefined();expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry.boundingBox!.isEmpty()).toBe(false);
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      for(let i=0;i<p.count;i+=4){
        quads++;
        const ax=(p.getX(i)+p.getX(i+3))/2,az=(p.getZ(i)+p.getZ(i+3))/2,bx=(p.getX(i+1)+p.getX(i+2))/2,bz=(p.getZ(i+1)+p.getZ(i+2))/2;
        expect(Math.hypot(bx-ax,bz-az)).toBeLessThan(native?.52:2.2);
        if(native){
          expect(Math.min(Math.abs(bx-ax),Math.abs(bz-az))).toBeLessThan(.0002);
          for(let j=1;j<4;j++)expect(p.getY(i+j)).toBe(p.getY(i));
        }
      }
    }
    expect(ids).toEqual(new Set(rails.tracks.map(t=>t.id)));
    expect(quads).toBeGreaterThan(10500);expect(bytes).toBeLessThan(native?7_500_000:1_400_000);
    const materials=new Set(root.children.flatMap(o=>[(o as Mesh).material,o.userData.nightMaterial]));
    expect(materials.size).toBe(2);let disposed=0;
    for(const material of materials)(material as MeshBasicMaterial).addEventListener('dispose',()=>disposed++);
    disposeSurroundingCityRoot(root);expect(disposed).toBe(2);
  });
  for(const native of [false,true])it(`three mapped stairs keep their full descent and readable supported portal: ${native}`,()=>{
    const root=createUbahnEntrancesV281(native);root.updateMatrixWorld(true);
    expect(UBAHN_STAIRS_V281.map(s=>s.stepCount)).toEqual([30,27,28]);
    let count=0;
    for(const s of UBAHN_STAIRS_V281){
      const base=native?s.nativeSurfaceY:s.surfaceY,mesh=root.children.find(o=>o.name.includes(s.osmWay)) as InstancedMesh;
      count+=mesh.count;const m=new Matrix4(),color=new Color(),support:Box3[]=[];
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,m);mesh.getColorAt(i,color);
        if(native)for(const k of [1,2,4,6,8,9])expect(m.elements[k]).toBe(0);
        if(color.getHex()===0x34564c)support.push(new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(m).expandByScalar(.0002));
      }
      for(const f of [.1,.3,.52,.8,.98]){
        const u=(s.length-s.landing)*(Math.floor(s.stepCount*f)+.5)/s.stepCount,x=s.top[0]+s.ux*u,z=s.top[1]+s.uz*u,floor=ubahnV281FloorAt(x,z,native)!;
        const hit=new Raycaster(new Vector3(x,base+2,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];
        expect(hit).toBeDefined();expect(Math.abs(hit.point.y-floor)).toBeLessThan(native?.19:.03);
        expect(ubahnV281SolidAt(x,floor+.6,z,.2,native)).toBe(false);
      }
      expect(ubahnV281SolidAt(s.top[0],base+.5,s.top[1],.15,native)).toBe(false);
      const axis=native?(Math.abs(s.ux)>Math.abs(s.uz)?[Math.sign(s.ux),0]:[0,Math.sign(s.uz)]):[s.ux,s.uz];
      const c=[s.top[0]-.14*s.ux,base+3.30,s.top[1]-.14*s.uz];
      // Across the source axis, the lower traverse physically reaches both posts.
      for(let i=0;i<=40;i++){
        const v=(i/40-.5)*(s.width+.36),p=new Vector3(c[0]+s.nx*v,base+2.59,c[2]+s.nz*v);
        expect(support.some(b=>b.containsPoint(p))).toBe(true);
      }
      for(const face of [-1,1]){
        const target=new Vector3(c[0]-axis[1]*.25,c[1]+.22,c[2]+axis[0]*.25),n=new Vector3(axis[0],0,axis[1]);
        const hit=new Raycaster(target.clone().addScaledVector(n,face*2),n.clone().multiplyScalar(-face)).intersectObject(mesh)[0];
        expect(hit).toBeDefined();mesh.getColorAt(hit.instanceId!,color);expect(color.getHex()).toBe(0xf2ebce);
        const right=n.clone().multiplyScalar(-face).cross(new Vector3(0,1,0));
        const samples:number[][]=[];
        for(let i=0;i<mesh.count;i++){
          mesh.getColorAt(i,color);if(color.getHex()!==0xf2ebce)continue;
          mesh.getMatrixAt(i,m);const p=new Vector3().setFromMatrixPosition(m).sub(new Vector3(...c));
          if(p.dot(n)*face<.06||p.y>-.2)continue;
          samples.push([p.dot(right),p.y]);
        }
        const text=s.name.toUpperCase(),cap=.16*Math.min(1,(s.width-.08)/letteringLayout(text,.16).totalWidthM);
        for(const path of letteringStrokePaths(text,cap))for(let i=1;i<path.length;i++){
          const x=(path[i-1][0]+path[i][0])/2,y=-.47+(path[i-1][1]+path[i][1])/2;
          expect(Math.min(...samples.map(p=>Math.hypot(x-p[0],y-p[1])))).toBeLessThan(native?.018:.0002);
        }
      }
    }
    expect(count).toBeLessThan(native?16000:3500);disposeSurroundingCityRoot(root);
  });
  it('cuts actual mouth envelopes, retaining original vertices, remote pavement and native outside complement',()=>{
    for(const s of UBAHN_STAIRS_V281){
      const x=(s.top[0]+s.bottom[0])/2,z=(s.top[1]+s.bottom[1])/2;
      const p=new Float32Array([x-10,5.3,z-15,x+10,5.3,z-15,x+10,5.3,z+15,x-10,5.3,z+15]);
      const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(p,3));g.setIndex([0,2,1,0,3,2]);
      const result=cutUbahnSurfaceV281(g);expect(Array.from(result.getAttribute('position').array.slice(0,p.length))).toEqual(Array.from(p));
      const mesh=new Mesh(result,new MeshBasicMaterial());mesh.updateMatrixWorld(true);
      const down=(root:Mesh|Group,x:number,z:number)=>new Raycaster(new Vector3(x,20,z),new Vector3(0,-1,0)).intersectObject(root,true);
      expect(down(mesh,x,z).length).toBe(0);expect(down(mesh,x+9,z)[0].point.y).toBeCloseTo(5.3,4);
      const root=new Group(),slab=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),1);
      slab.setMatrixAt(0,new Matrix4().makeScale(20,3,30).setPosition(x,s.nativeSurfaceY-1.5,z));root.add(slab);
      cutUbahnGroundSlabsV281(slab,true);root.updateMatrixWorld(true);
      const complement = slab.children[0] as InstancedMesh;
      expect(complement.userData.dayMaterial.vertexColors).toBe(false);
      expect(complement.userData.nightMaterial.vertexColors).toBe(false);
      expect(complement.instanceColor).not.toBeNull();
      expect(down(root,x,z).length).toBe(0);expect(down(root,x+9,z)[0].point.y).toBeCloseTo(s.nativeSurfaceY,4);
      cutUbahnGroundSlabsV281(slab,true);expect(slab.children.length).toBe(1);
      disposeSurroundingCityRoot(root);result.dispose();g.dispose();
    }
  });
});
