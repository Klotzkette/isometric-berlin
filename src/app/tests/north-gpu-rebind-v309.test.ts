import {expect,test}from"bun:test";
import {BoxGeometry,Mesh,MeshBasicMaterial}from"three";
import {northGpuHostV309}from"./helpers/northGpuHostV309";

test("rebind of one shared geometry owner retains the other actual GPU source and restores without leaks",()=>{
 const h=northGpuHostV309(),original=new BoxGeometry(),material=new MeshBasicMaterial(),a=new Mesh(original,material),b=new Mesh(original,material);h.scene.add(a,b);h.scene.updateMatrixWorld(true);
 try{h.register();h.draw(a);h.draw(b);const baseline=h.live.size;expect(baseline).toBeGreaterThan(0);expect(h.geometry.retireForRebind(a)).toBe(true);expect(h.live.size).toBe(baseline);a.geometry=original.clone();h.register();h.draw(a);h.draw(b);expect(h.live.size).toBe(baseline*2);const replacement=a.geometry;expect(h.geometry.retireForRebind(a)).toBe(true);a.geometry=original;h.register();h.draw(a);h.draw(b);expect(h.live.size).toBe(baseline);replacement.dispose();h.retire();expect(h.live.size).toBe(0);}finally{h.dispose();original.dispose();material.dispose();}
});

test("rebind cannot dispose shared attribute handles of a different geometry owner",()=>{
 const h=northGpuHostV309(),original=new BoxGeometry(),other=original.clone(),material=new MeshBasicMaterial();other.setAttribute("position",original.getAttribute("position"));const a=new Mesh(original,material),b=new Mesh(other,material);h.scene.add(a,b);h.scene.updateMatrixWorld(true);
 try{h.register();h.draw(a);h.draw(b);const baseline=h.live.size;expect(h.geometry.retireForRebind(a)).toBe(false);expect(h.live.size).toBe(baseline);expect(a.geometry).toBe(original);h.draw(b);expect(h.live.size).toBe(baseline);}finally{h.dispose();original.dispose();other.dispose();material.dispose();}
});
