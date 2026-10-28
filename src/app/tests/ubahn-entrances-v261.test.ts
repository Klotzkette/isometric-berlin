import {describe,expect,it} from 'bun:test';
import {Box3,BoxGeometry,Color,BufferAttribute,BufferGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createUbahnEntrancesV261,ubahnStationLabelV261} from '../src/UbahnEntrancesV261';
import {UBAHN_STAIRS_V261,ubahnV261FloorAt,ubahnV261SolidAt} from '../src/ubahnEntrancesV261Profile';
import {cutUbahnPresentationV261,cutUbahnGroundSlabsV261,cutUbahnSurfaceV261} from '../src/UbahnSurfaceAperturesV261';

import {createDistrictStreets} from '../src/DistrictStreets';
import {createUnterDenLindenBlockStreets} from '../src/UnterDenLindenBlockStreets';
import {unterDenLindenEntranceFloorAt} from '../src/unterDenLindenEntrancesProfile';
import ground from '../public/mesh/regierungsviertel/ground-context.json';
import {letteringLayout,letteringStrokePaths} from '../src/drawnLettering';

describe('U6 Naturkundemuseum and U5 Brandenburger Tor source mouths',()=>{
  it('retains mapped axes and exact step counts',()=>{
    expect(UBAHN_STAIRS_V261.map(s=>s.stepCount)).toEqual([29,27,27,26,26,23,12]);
    expect(new Set(UBAHN_STAIRS_V261.map(s=>s.osmWay)).size).toBe(7);
    expect(UBAHN_STAIRS_V261.filter(s=>s.station==='naturkundemuseum').length).toBe(3);
    for(const s of UBAHN_STAIRS_V261){expect(s.length).toBeGreaterThan(3);expect(s.length).toBeLessThan(11);}
  });
  for(const native of [false,true])it(`rendered descents agree with walking floor: native=${native}`,()=>{
    const root=createUbahnEntrancesV261(native);root.updateMatrixWorld(true);
    let instances=0,batches=0;
    root.traverse(o=>{if(o instanceof InstancedMesh){instances+=o.count;batches++;expect(o.geometry.getAttribute('uv')).toBeUndefined();
      if(native){const a=o.instanceMatrix.array;for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])expect(a[i*16+k]).toBe(0);}
    }});
    expect(batches).toBe(7);expect(instances).toBeLessThan(24000);
    for(const s of UBAHN_STAIRS_V261){
      const u=(s.length-s.landing)*.52,x=s.top[0]+s.ux*u,z=s.top[1]+s.uz*u,base=native?s.nativeSurfaceY:s.surfaceY;
      const floor=ubahnV261FloorAt(x,z,native)!;
      expect(floor).toBeLessThan(base-1);
      expect(ubahnV261SolidAt(x,floor+.6,z,.2,native)).toBe(false);
      const hits=new Raycaster(new Vector3(x,base+2,z),new Vector3(0,-1,0)).intersectObject(root,true);
      expect(hits.length).toBeGreaterThan(0);expect(Math.abs(hits[0].point.y-floor)).toBeLessThan(native?.19:.03);
      expect(ubahnV261SolidAt(s.top[0],base+.5,s.top[1],.15,native)).toBe(false);
      expect(ubahnV261SolidAt(s.bottom[0]+s.ux*.11,base-.5,s.bottom[1]+s.uz*.11,.15,native)).toBe(true);
    }
  });
  for(const native of [false,true])it(`blue/ivory signs remain visible on both faces: native=${native}`,()=>{
    const root=createUbahnEntrancesV261(native);root.updateMatrixWorld(true);
    for(const s of UBAHN_STAIRS_V261){
      const tor=s.station==='brandenburger-tor',u=tor?.92:-.14,v=tor?s.width/2+.19:0;
      const x=s.top[0]+s.ux*u+s.nx*v,z=s.top[1]+s.uz*u+s.nz*v;
      const y=(native?s.nativeSurfaceY:s.surfaceY)+(tor?1.52:3.22)+.045;
      const axis=native?(Math.abs(s.ux)>Math.abs(s.uz)?[Math.sign(s.ux),0]:[0,Math.sign(s.uz)]):[s.ux,s.uz];
      const n=tor?[-axis[1],axis[0]]:axis;
      for(const face of [-1,1]){
        const across=tor?-.62:.2;
        const ray=new Raycaster(new Vector3(x-n[1]*across+n[0]*face*2,y,z+n[0]*across+n[1]*face*2),new Vector3(-n[0]*face,0,-n[1]*face));
        const hit=ray.intersectObject(root,true)[0];expect(hit).toBeDefined();
        const colour=new Color();(hit.object as InstancedMesh).getColorAt(hit.instanceId!,colour);expect(colour.getHex()).toBe(0xF2EBCE);
      }
    }
  });
  for(const native of [false,true])it(`station names read left to right from both sign faces: native=${native}`,()=>{
    const root=createUbahnEntrancesV261(native);
    for(const s of UBAHN_STAIRS_V261){
      const mesh=root.children.find(o=>o.name.includes(s.osmWay)) as InstancedMesh;
      const tor=s.station==='brandenburger-tor',u=tor?.92:-.14,v=tor?s.width/2+.19:0;
      const centre=new Vector3(s.top[0]+s.ux*u+s.nx*v,(native?s.nativeSurfaceY:s.surfaceY)+(tor?1.52:3.22),s.top[1]+s.uz*u+s.nz*v);
      const axis=native?(Math.abs(s.ux)>Math.abs(s.uz)?new Vector3(Math.sign(s.ux),0,0):new Vector3(0,0,Math.sign(s.uz))):new Vector3(s.ux,0,s.uz);
      const n=tor?new Vector3(-axis.z,0,axis.x):axis;
      const boardWidth=tor?1.87:s.width+.36;
      const cap=.085*Math.min(1,1.65/letteringLayout(s.name.toUpperCase(),.085).totalWidthM);
      const label=tor?{capHeight:cap,paths:letteringStrokePaths(s.name.toUpperCase(),cap)}:ubahnStationLabelV261(s.name,boardWidth),textY=(tor?-.53:-.46)-label.capHeight/2;
      for(const face of [-1,1]){
        const looking=n.clone().multiplyScalar(-face),right=looking.clone().cross(new Vector3(0,1,0)).normalize();
        const samples:number[][]=[],m=new Matrix4(),colour=new Color();
        for(let i=0;i<mesh.count;i++){
          mesh.getColorAt(i,colour);if(colour.getHex()!==0x31464D)continue;
          mesh.getMatrixAt(i,m);const p=new Vector3().setFromMatrixPosition(m).sub(centre);
          if(p.dot(n)*face<.06)continue;
          samples.push([p.dot(right),p.y]);
          // Both faces' complete stroked/pixel geometry must stay on the plaque;
          // otherwise the backwards face can peek past its opaque edge.
          for(const cx of [-.5,.5])for(const cy of [-.5,.5])for(const cz of [-.5,.5]){
            const corner=new Vector3(cx,cy,cz).applyMatrix4(m).sub(centre);
            expect(Math.abs(corner.dot(right))).toBeLessThan(boardWidth/2-.07);
            expect(Math.abs(corner.y-(tor?-.53:-.46))).toBeLessThan((tor?.22:.30)/2-.025);
          }
        }
        expect(samples.length).toBeGreaterThan(20);
        // Project actual geometry into the viewer's independent camera basis.
        // A reflected R/B or a swapped leading/trailing letter fails this check.
        for(const path of label.paths)for(let j=1;j<path.length;j++){
          const x=(path[j-1][0]+path[j][0])/2,y=(path[j-1][1]+path[j][1])/2+textY;
          const miss=Math.min(...samples.map(p=>Math.hypot(x-p[0],y-p[1])));
          expect(miss).toBeLessThan(native?.014:.0002);
        }
      }
    }
  });
  it('native Naturkundemuseum plaques have a continuous support reaching both measured portal posts',()=>{
    const root=createUbahnEntrancesV261(true);
    for(const s of UBAHN_STAIRS_V261.filter(s=>s.station==='naturkundemuseum')){
      const mesh=root.children.find(o=>o.name.includes(s.osmWay)) as InstancedMesh;
      const supports:Box3[]=[],m=new Matrix4(),colour=new Color();
      for(let i=0;i<mesh.count;i++){
        mesh.getColorAt(i,colour);if(colour.getHex()!==0x47665D)continue;
        mesh.getMatrixAt(i,m);if(Math.abs(m.elements[13]-(s.nativeSurfaceY+2.76))>.001)continue;
        supports.push(new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(m).expandByScalar(.0001));
      }
      expect(supports.length).toBeGreaterThan(1);
      // Sample the physical span, including both post centres and the plaque's
      // central attachment, to catch floating signs or breaks in the traverse.
      for(let i=0;i<=30;i++){
        const v=(i/30-.5)*(s.width+.36);
        const p=new Vector3(s.top[0]-.14*s.ux+v*s.nx,s.nativeSurfaceY+2.76,s.top[1]-.14*s.uz+v*s.nz);
        expect(supports.some(b=>b.containsPoint(p))).toBe(true);
      }
    }
  });
  for(const native of [false,true])it(`Brandenburger Tor has supported paired S/U markers, visible from both sides: ${native}`,()=>{
    const root=createUbahnEntrancesV261(native);root.updateMatrixWorld(true);
    for(const s of UBAHN_STAIRS_V261.filter(s=>s.station==='brandenburger-tor')){
      const mesh=root.children.find(o=>o.name.includes(s.osmWay)) as InstancedMesh,base=native?s.nativeSurfaceY:s.surfaceY;
      const axis=native?(Math.abs(s.ux)>Math.abs(s.uz)?new Vector3(Math.sign(s.ux),0,0):new Vector3(0,0,Math.sign(s.uz))):new Vector3(s.ux,0,s.uz),n=new Vector3(-axis.z,0,axis.x);
      const centre=new Vector3(s.top[0]+s.ux*.92+s.nx*(s.width/2+.19),base+1.52,s.top[1]+s.uz*.92+s.nz*(s.width/2+.19));
      const panels:Box3[]=[],supports:Box3[]=[],caps:Box3[]=[],m=new Matrix4(),color=new Color();let green=0,blue=0;
      for(let i=0;i<mesh.count;i++){
        mesh.getColorAt(i,color);mesh.getMatrixAt(i,m);
        const box=new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(m).expandByScalar(.0002);
        if(color.getHex()===0x237447){green++;panels.push(box);}
        if(color.getHex()===0x23508c){blue++;panels.push(box);}
        if(color.getHex()===0x858f90&&Math.abs(m.elements[13]-(base+1.06))<.0002&&box.max.y-box.min.y>1.8)supports.push(box);
        if(color.getHex()===0xaeb5a7)caps.push(box);
      }
      expect(green).toBe(1);expect(blue).toBe(1);expect(supports.length).toBe(2);
      // The actual sign posts descend into the retained wall coping, not air.
      for(const post of supports)expect(caps.some(cap=>cap.intersectsBox(post))).toBe(true);
      // The connecting bar intersects both boards and reaches both posts.
      const barPoint=centre.clone().add(new Vector3(0,-.02,0));
      const bars:Box3[]=[];
      for(let i=0;i<mesh.count;i++){
        mesh.getColorAt(i,color);if(color.getHex()!==0x858f90)continue;mesh.getMatrixAt(i,m);
        const box=new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(m).expandByScalar(.0002);
        if(box.containsPoint(barPoint))bars.push(box);
      }
      expect(bars.length).toBeGreaterThan(0);
      for(const panel of panels)expect(bars.some(bar=>bar.intersectsBox(panel))).toBe(true);
      for(const post of supports)expect(bars.some(bar=>bar.intersectsBox(post))).toBe(true);
      for(const face of [-1,1]){
        // The top S stroke and a U stem each sit in front of their own opaque panel.
        for(const [v,y] of [[-.43,.22],[.62,.045]]){
          const target=centre.clone().addScaledVector(axis,v).add(new Vector3(0,y,0));
          const hit=new Raycaster(target.addScaledVector(n,face*2),n.clone().multiplyScalar(-face)).intersectObject(mesh)[0];
          expect(hit).toBeDefined();mesh.getColorAt(hit.instanceId!,color);expect(color.getHex()).toBe(0xf2ebce);
        }
      }
    }
  });
  it('cuts actual avenue replacement surfaces without any old station overlap',()=>{
    for(const native of [false,true]) {
      const root=native?createUnterDenLindenBlockStreets(ground as any):createDistrictStreets(ground as any);
      cutUbahnPresentationV261(root,native);root.updateMatrixWorld(true);
      for(const s of UBAHN_STAIRS_V261.filter(s=>s.station==='brandenburger-tor')){
        const x=(s.top[0]+s.bottom[0])/2,z=(s.top[1]+s.bottom[1])/2;
        expect(unterDenLindenEntranceFloorAt(x,z)).toBeNull();
        const ray=new Raycaster(new Vector3(x,15,z),new Vector3(0,-1,0));
        expect(ray.intersectObject(root,true).filter(h=>h.object instanceof Mesh).length).toBe(0);
      }
    }
  });
  it('opens only the source mouth and retains original vertices and remote pavement',()=>{
    const s=UBAHN_STAIRS_V261[0],x=s.top[0]+s.ux*s.length/2,z=s.top[1]+s.uz*s.length/2,y=s.surfaceY;
    const g=new BufferGeometry(),a=new Float32Array([x-10,y,z-10,x+10,y,z-10,x+10,y,z+10,x-10,y,z+10,0,5,0,1,5,0,0,5,1]);
    g.setAttribute('position',new BufferAttribute(a,3));g.setAttribute('color',new BufferAttribute(new Float32Array(21).fill(.4),3));g.setIndex([0,2,1,0,3,2,4,6,5]);
    const cut=cutUbahnSurfaceV261(g);expect(cut).not.toBe(g);expect(Array.from(cut.getAttribute('position').array.slice(0,a.length))).toEqual(Array.from(a));
    expect(Array.from(cut.index!.array).some((v,i,arr)=>v===4&&arr[i+1]===6&&arr[i+2]===5)).toBe(true);
    const mesh=new Mesh(cut,new MeshBasicMaterial());mesh.updateMatrixWorld(true);
    expect(new Raycaster(new Vector3(x,y+10,z),new Vector3(0,-1,0)).intersectObject(mesh).length).toBe(0);
    expect(new Raycaster(new Vector3(x+8,y+10,z),new Vector3(0,-1,0)).intersectObject(mesh).length).toBeGreaterThan(0);
  });
  it('retains the native outside complement and original top',()=>{
    const s=UBAHN_STAIRS_V261[3],x=(s.top[0]+s.bottom[0])/2,z=(s.top[1]+s.bottom[1])/2,y=s.nativeSurfaceY;
    const slab=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),1);slab.setMatrixAt(0,new Matrix4().makeScale(18,3,12).setPosition(x,y-1.5,z));
    const root=new Group();root.add(slab);cutUbahnGroundSlabsV261(slab,true);root.updateMatrixWorld(true);
    expect(slab.children.length).toBe(1);
    const down=(a:number,b:number)=>new Raycaster(new Vector3(a,y+5,b),new Vector3(0,-1,0)).intersectObject(root,true);
    expect(down(x,z).length).toBe(0);expect(down(x+8,z)[0].point.y).toBeCloseTo(y,4);
    cutUbahnGroundSlabsV261(slab,true);expect(slab.children.length).toBe(1);
  });
});
