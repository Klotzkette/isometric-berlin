import { describe, expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Mesh, Color, Matrix4, Raycaster, Vector3 } from "three";
import { HBF_CIRCULATION_V291, hbfFlightGroundAtV291, hbfFlightOpeningAtV291, hbfLevelFloorContainsV291, hbfLocalToWorldV291 } from "../src/HbfCirculationV291";
import { HBF_INTERIOR_V291, HBF_NATIVE_RAIL_REPLACEMENT_V291, createHbfInteriorV291, hbfNativeGalleryRailRunsV291, hbfNativeOuterDeckMarginAtV291, replacesHbfShopfrontV291 } from "../src/HbfInteriorV291";

function batches(root: Group): InstancedMesh[] {
  return root.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
}

function roleMatrices(root: Group, role: string): Matrix4[] {
  const result: Matrix4[]=[];
  for(const mesh of batches(root))for(let i=0;i<mesh.count;i++)if(mesh.userData.roles[i]===role) {
    const matrix=new Matrix4();mesh.getMatrixAt(i,matrix);result.push(matrix);
  }
  return result;
}

function bytes(root: Group): number {
  let result=0;
  for(const mesh of root.children.filter((child):child is Mesh=>child instanceof Mesh)) {
    for(const attr of Object.values(mesh.geometry.attributes))result+=attr.array.byteLength;
    result+=mesh.geometry.index?.array.byteLength??0;
    if(mesh instanceof InstancedMesh){result+=mesh.instanceMatrix.array.byteLength;result+=mesh.instanceColor?.array.byteLength??0;}
  }
  return result;
}

describe("Hauptbahnhof bounded connected interior v291",()=>{
  const drawn=createHbfInteriorV291();
  const native=createHbfInteriorV291({native:true,...HBF_CIRCULATION_V291.frame});

  test("uses current evidenced tenants and levels, with estimated individual bays",()=>{
    expect(HBF_INTERIOR_V291.geometryStatus).toContain("not surveyed geometry");
    expect(HBF_INTERIOR_V291.shops).toHaveLength(13);
    const shop=(id:string)=>HBF_INTERIOR_V291.shops.find(s=>s.id===id)!;
    expect(shop("apotheke").levelId).toBe("upper-gallery");
    expect(shop("starbucks").locationEvidence).toContain("Washingtonplatz");
    expect(shop("rewe").levelId).toBe("lower-gallery");
    expect(shop("reisebank").locationEvidence).toContain("13/14");
    expect(shop("relay-eg").levelId).toBe("ground-concourse");
    for(const root of[drawn,native]) {
      for(const record of root.userData.shops) {
        expect(record.sourceUrl).toStartWith("https://www.bahnhof.de/berlin-hauptbahnhof/einkaufen-und-essen/");
        expect(record.placementStatus).toContain("estimates");
      }
      const labels=root.userData.labels.map((label:{text:string})=>label.text);
      for(const text of["REWE","APOTHEKE","STARBUCKS","EINSTEIN KAFFEE","FATIH SERVET DÖNER","SIXT","EUROPCAR","REISEBANK","MCDONALD'S","RELAY","KAMPS","HEBERER"])
        expect(labels).toContain(text);
      expect(labels).not.toContain("DUSSMANN");
      expect(labels).not.toContain("STEINECKE");
      expect(labels).not.toContain("EUROBANK");
      for(const label of root.userData.labels)expect(label.count).toBeGreaterThan(0);
    }
  });

  test("replaces exactly thirteen named panes plus the overlapping Einstein pane and rejects changed coordinates",()=>{
    const matches:number[][]=[];
    for(const y of[4.6,0,-5.4])for(const arm of[-1,1])for(const edge of[-1,1])for(let i=0;i<5;i++) {
      const point=[edge*19.55,y+1.75,arm*(28+i*13)];
      if(replacesHbfShopfrontV291(...point as [number,number,number]))matches.push(point);
    }
    expect(matches).toHaveLength(14);
    for(const point of matches) {
      expect(replacesHbfShopfrontV291(point[0]+.001,point[1],point[2])).toBe(false);
      expect(replacesHbfShopfrontV291(point[0],point[1]+.001,point[2])).toBe(false);
      expect(replacesHbfShopfrontV291(point[0],point[1],point[2]+.001)).toBe(false);
    }
    expect(replacesHbfShopfrontV291(NaN,1.75,-67)).toBe(false);
  });

  test("provides visible horizontal treads for every shared fixed stair",()=>{
    const flights=HBF_CIRCULATION_V291.flights.filter(f=>f.kind==="stairs");
    expect(flights).toHaveLength(8);
    const connected=new Set<string>();
    for(const flight of flights) {
      const treads=roleMatrices(drawn,`stairs:${flight.id}:tread`);
      expect(treads.length).toBeGreaterThan(20);
      for(const matrix of treads) {
        const e=matrix.elements;
        expect(e[1]).toBe(0);expect(e[4]).toBe(0);expect(e[6]).toBe(0);expect(e[9]).toBe(0);
        const expected=hbfFlightGroundAtV291(flight,e[12],e[14],flight.widthM);
        expect(expected).not.toBeNull();
        expect(Math.abs(expected!-(e[13]+e[5]/2))).toBeLessThan(.18);
      }
      expect(roleMatrices(drawn,`stairs:${flight.id}:handrail`)).toHaveLength(2);
      connected.add(flight.fromLevelId);connected.add(flight.toLevelId);
    }
    expect([...connected].sort()).toEqual(HBF_CIRCULATION_V291.levels.map(l=>l.id).sort());
  });

  test("every shared comb has an actual horizontal boarding plate in its independent family",()=>{
    expect(HBF_CIRCULATION_V291.combs).toHaveLength(48);
    for(const root of[drawn,native]){
      root.updateMatrixWorld(true);
      const expected=HBF_CIRCULATION_V291.combs.filter(c=>root===native||c.kind==="stairs");
      expect(expected).toHaveLength(root===native?48:16);
      for(const comb of expected){
        const role=`comb:${comb.id}`,rows=roleMatrices(root,role);expect(rows.length).toBeGreaterThan(0);
        for(const matrix of rows){const e=matrix.elements;expect(e[5]).toBeCloseTo(.18,5);expect(e[1]).toBe(0);expect(e[4]).toBe(0);expect(e[6]).toBe(0);expect(e[9]).toBe(0);expect(e[13]+.09-(root===native?HBF_CIRCULATION_V291.frame.anchorWorld[1]:0)).toBeCloseTo(comb.centre[1],4);}
        const p=root===native?hbfLocalToWorldV291(comb.centre):comb.centre;
        const ray=new Raycaster(new Vector3(p[0],p[1]+.04,p[2]),new Vector3(0,-1,0),0,.1);
        const hits=ray.intersectObjects(batches(root));
        expect(hits.some(hit=>hit.instanceId!==undefined&&hit.object.userData.roles[hit.instanceId]===role)).toBe(true);
      }
    }
  });

  test("actually supports each new landing in its slot without adding full overlapping gallery slabs",()=>{
    drawn.updateMatrixWorld(true);
    const ray=new Raycaster();
    for(const landing of HBF_CIRCULATION_V291.landings) {
      const matrices=roleMatrices(drawn,`landing:${landing.id}`);
      for(const matrix of matrices) {
        const e=matrix.elements;
        expect(e[12]-e[0]/2).toBeGreaterThanOrEqual(landing.minX-.00001);
        expect(e[12]+e[0]/2).toBeLessThanOrEqual(landing.maxX+.00001);
        expect(e[14]-e[10]/2).toBeGreaterThanOrEqual(landing.minZ-.00001);
        expect(e[14]+e[10]/2).toBeLessThanOrEqual(landing.maxZ+.00001);
        ray.set(new Vector3(e[12],landing.topLocalY+.05,e[14]),new Vector3(0,-1,0));
        ray.far=.1;
        const hits=ray.intersectObjects(batches(drawn));
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.some(hit=>Math.abs(hit.point.y-landing.topLocalY)<.00001)).toBe(true);
      }
    }
  });

  test("retains the open daylight slot while supplying real lower-platform recognition",()=>{
    for(const root of[drawn,native]) {
      expect(roleMatrices(root,"deep-platform-tactile-edge").length).toBeGreaterThanOrEqual(8);
      expect(roleMatrices(root,"deep-platform-round-support-column").length).toBeGreaterThanOrEqual(16);
      expect(roleMatrices(root,"deep-platform-flared-capital").length).toBeGreaterThanOrEqual(16);
      expect(roleMatrices(root,"deep-platform-teal-ceiling-annulus").length).toBeGreaterThanOrEqual(64);
      expect(root.userData.labels.map((label:{text:string})=>label.text)).toEqual(expect.arrayContaining(["1 - 2","3 - 4","5 - 6","7 - 8","EUROPAPLATZ","WASHINGTONPLATZ"]));
    }
    for(const m of roleMatrices(drawn,"deep-outside-wing-ceiling")) {
      const e=m.elements;
      expect(Math.abs(e[12])-e[0]/2).toBeGreaterThanOrEqual(14);
    }
    const shaftGlazing=roleMatrices(native,"native-panoramic-lift-glazing");
    for(const shaft of HBF_CIRCULATION_V291.shafts) {
      const expected=hbfLocalToWorldV291([shaft.x,(shaft.bottomLocalY+shaft.topLocalY)/2,shaft.z]);
      const nearby=shaftGlazing.filter(m=>Math.hypot(m.elements[12]-expected[0],m.elements[14]-expected[2])<3);
      expect(nearby.length).toBeGreaterThan(0);
      for(const matrix of nearby)expect(matrix.elements[5]).toBeCloseTo(29.65,4);
    }
  });

  test("cardinal native floor runs preserve every occupied cell of the independent block footprint",()=>{
    const floors=roleMatrices(native,"native-deep-island-platform");
    const angle=HBF_CIRCULATION_V291.frame.rotationDegrees*Math.PI/180;
    const cosine=Math.cos(angle),sine=Math.sin(angle),anchor=HBF_CIRCULATION_V291.frame.anchorWorld;
    const cells=new Set<string>();
    for(const matrix of floors) {
      const e=matrix.elements;
      expect(e[0]).toBe(1.25);
      expect(e[10]/1.25).toBe(Math.round(e[10]/1.25));
      for(let z=e[14]-e[10]/2+.625;z<e[14]+e[10]/2;z+=1.25) {
        const key=`${e[12]}/${z}`;
        expect(cells.has(key)).toBe(false);cells.add(key);
        const dx=e[12]-anchor[0],dz=z-anchor[2];
        const localX=dx*cosine-dz*sine,localZ=dx*sine+dz*cosine;
        expect(Math.abs(localZ)).toBeLessThanOrEqual(84.00001);
        expect([-28.5,-9.5,9.5,28.5].some(x=>Math.abs(x-localX)<=4.80001)).toBe(true);
      }
    }
    for(let ix=-170;ix<-20;ix++)for(let iz=-650;iz<-450;iz++) {
      const x=(ix+.5)*1.25,z=(iz+.5)*1.25,dx=x-anchor[0],dz=z-anchor[2];
      const localX=dx*cosine-dz*sine,localZ=dx*sine+dz*cosine;
      const expected=hbfLevelFloorContainsV291("deep-rail",localX,localZ,true);
      expect(cells.has(`${x}/${z}`)).toBe(expected);
    }
  });

  test("native upper platforms cover all three curved islands and leave the exact shared stair openings",()=>{
    const floors=roleMatrices(native,"native-upper-island-platform"),cells=new Set<string>();
    const angle=HBF_CIRCULATION_V291.frame.rotationDegrees*Math.PI/180;
    const cosine=Math.cos(angle),sine=Math.sin(angle),a=HBF_CIRCULATION_V291.frame.anchorWorld;
    for(const matrix of floors) {
      const e=matrix.elements;
      expect(e[13]+e[5]/2-a[1]).toBeCloseTo(10.73,4);
      for(let z=e[14]-e[10]/2+.625;z<e[14]+e[10]/2;z+=1.25)cells.add(`${e[12]}/${z}`);
    }
    const platformCells=[0,0,0];
    for(let ix=-200;ix<10;ix++)for(let iz=-650;iz<-430;iz++) {
      const x=(ix+.5)*1.25,z=(iz+.5)*1.25,dx=x-a[0],dz=z-a[2];
      const lx=dx*cosine-dz*sine,lz=dx*sine+dz*cosine;
      const expected=hbfLevelFloorContainsV291("upper-rail",lx,lz,true);
      expect(cells.has(`${x}/${z}`)).toBe(expected);
      if(expected) {
        const curve=.000787*lx*lx+.2233*lx;
        const island=Math.abs(lz-curve)<5?1:lz<curve?0:2;platformCells[island]++;
      }
    }
    for(const count of platformCells)expect(count).toBeGreaterThan(400);
    expect(HBF_CIRCULATION_V291.flights.filter(f=>f.fromLevelId==="upper-rail").every(f=>Math.abs(f.to[0]-f.from[0])>Math.abs(f.to[2]-f.from[2]))).toBe(true);
  });

  test("six real shaft apertures stay open through every new drawn floor while nearby floor survives",()=>{
    drawn.updateMatrixWorld(true);
    const floors=drawn.children.filter((child):child is Mesh=>child instanceof Mesh&&child.userData.hbfFloorComplementsV291);
    const ray=new Raycaster();ray.far=.7;
    for(const shaft of HBF_CIRCULATION_V291.shafts)for(const level of HBF_CIRCULATION_V291.levels.filter(l=>l.id!=="upper-rail"&&l.id!=="deep-rail")) {
      ray.set(new Vector3(shaft.x,level.topLocalY+.1,shaft.z),new Vector3(0,-1,0));
      expect(ray.intersectObjects(floors)).toHaveLength(0);
    }
    for(const level of HBF_CIRCULATION_V291.levels.filter(l=>l.id!=="upper-rail"&&l.id!=="deep-rail"))for(const x of[-17,17]) {
      ray.set(new Vector3(x,level.topLocalY+.1,0),new Vector3(0,-1,0));
      const hits=ray.intersectObjects([...floors,...batches(drawn)]);
      expect(hits.some(hit=>Math.abs(hit.point.y-level.topLocalY)<1e-5)).toBe(true);
    }
  });

  test("native keeps all four original railway courses and adds the evidenced outer pair at full original end reach",()=>{
    const receipt=HBF_NATIVE_RAIL_REPLACEMENT_V291;
    expect(receipt.legacyRole).toBe("four paired block tracks");expect(receipt.legacyInstanceCount).toBe(328);
    expect(receipt.retainedOriginalTrackCentresLocalZ).toEqual([-12,-4,4,12]);
    expect(receipt.displayedTrackCentresLocalZ).toEqual([-18,-12,-4,4,12,18]);
    expect(receipt.colour).toBe(0x8e9a9e);expect(receipt.halfGaugeM).toBe(.72);
    expect(receipt.originalPhysicalHalfLengthM).toBe(163.8);expect(receipt.outerHalfLengthM).toBe(163.8);
    const rows=roleMatrices(native,"native-upper-rail"),inverse=new Matrix4().makeRotationY(HBF_CIRCULATION_V291.frame.rotationDegrees*Math.PI/180);
    inverse.setPosition(...HBF_CIRCULATION_V291.frame.anchorWorld);inverse.invert();
    expect(rows).toHaveLength(3156);
    const courses=new Map<string,number[]>();
    for(const matrix of rows){
      const e=matrix.elements,p=new Vector3(e[12],e[13],e[14]).applyMatrix4(inverse);
      expect(p.y).toBeCloseTo(10.53,4);expect(e[5]).toBe(.5);
      const curve=.000787*p.x*p.x+.2233*p.x,residual=p.z-curve;
      const nearest=receipt.displayedTrackCentresLocalZ.flatMap(track=>[-1,1].map(side=>({track,side,d:Math.abs(residual-track-side*.72)}))).sort((a,b)=>a.d-b.d)[0];
      expect(nearest.d).toBeLessThan(.0007);
      const key=`${nearest.track}/${nearest.side}`,xs=courses.get(key)??[];xs.push(p.x);courses.set(key,xs);
    }
    expect(courses.size).toBe(12);
    const expectedX:number[]=[];for(let x=-163.8;x<163.8;x+=1.25)expectedX.push((x+Math.min(163.8,x+1.25))/2);
    for(const xs of courses.values()){
      xs.sort((a,b)=>a-b);expect(xs).toHaveLength(expectedX.length);
      for(let i=0;i<xs.length;i++)expect(xs[i]).toBeCloseTo(expectedX[i],3);
      expect(xs[0]).toBeLessThan(-163);expect(xs.at(-1)!).toBeGreaterThan(163);
    }
    const iron=new Color(receipt.colour);
    for(const mesh of batches(native))for(let i=0;i<mesh.count;i++)if(mesh.userData.roles[i]==="native-upper-rail") {
      expect(mesh.instanceColor!.getX(i)).toBeCloseTo(iron.r,6);expect(mesh.instanceColor!.getY(i)).toBeCloseTo(iron.g,6);expect(mesh.instanceColor!.getZ(i)).toBeCloseTo(iron.b,6);
    }
  });

  test("native outer deck supports occupy only the missing source-fitted edge, with no old inner deck overlap",()=>{
    const rows=roleMatrices(native,"native-added-outer-deck-margin"),inverse=new Matrix4().makeRotationY(HBF_CIRCULATION_V291.frame.rotationDegrees*Math.PI/180);
    inverse.setPosition(...HBF_CIRCULATION_V291.frame.anchorWorld);inverse.invert();
    expect(rows.length).toBeGreaterThan(500);expect(rows.length).toBeLessThan(1_000);
    const cells=new Set<string>();
    for(const matrix of rows){const e=matrix.elements;expect(e[0]).toBe(.5);expect(e[5]).toBeCloseTo(1.1,5);expect(e[13]-HBF_CIRCULATION_V291.frame.anchorWorld[1]).toBeCloseTo(9.8,5);
      for(let z=e[14]-e[10]/2+.25;z<e[14]+e[10]/2;z+=.5){
        const key=`${e[12]}/${z}`;expect(cells.has(key)).toBe(false);cells.add(key);
        for(const dx of[-.25,.25])for(const dz of[-.25,.25]){
          const p=new Vector3(e[12]+dx,e[13],z+dz).applyMatrix4(inverse);
          expect(hbfNativeOuterDeckMarginAtV291(p.x,p.z)).toBe(true);
        }
      }
    }
    expect(hbfNativeOuterDeckMarginAtV291(0,0)).toBe(false);
    expect(hbfNativeOuterDeckMarginAtV291(0,18)).toBe(false);
  });

  test("native gallery glass and handrails leave every shared landing and descending flight open",()=>{
    for(const level of HBF_CIRCULATION_V291.levels)if("openHalfM" in level)for(const edge of[-1,1])for(const arm of[-1,1]) {
      const x=edge*level.openHalfM,far=level.id==="ground-concourse"?82:88;
      const min=arm<0?-far:20,max=arm<0?-20:far;
      const runs=hbfNativeGalleryRailRunsV291(level.id,x,min,max);
      expect(runs.every(([a,b])=>a>=min&&b<=max&&a<b)).toBe(true);
      expect(runs.some(([a,b])=>a<=arm*22&&b>=arm*22)).toBe(true);
      for(let z=min;z<=max;z+=.15)if(hbfFlightOpeningAtV291(x,z,level.topLocalY))
        expect(runs.some(([a,b])=>a<=z&&b>=z)).toBe(false);
      for(const landing of HBF_CIRCULATION_V291.landings)if(landing.levelId===level.id&&x>=landing.minX&&x<=landing.maxX) {
        const z=(landing.minZ+landing.maxZ)/2;if(z<min||z>max)continue;
        expect(runs.some(([a,b])=>a<=z&&b>=z)).toBe(false);
      }
    }
  });

  test("uses independent world-orthogonal native geometry and fixed texture-free batches",()=>{
    expect(batches(drawn)).toHaveLength(5);expect(batches(native)).toHaveLength(3);
    for(const root of[drawn,native]) {
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.textureFree).toBe(true);
      for(const mesh of batches(root)) {
        expect(mesh.instanceMatrix.array.length).toBe(mesh.count*16);
        expect(mesh.instanceColor?.array.length).toBe(mesh.count*3);
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.userData.fullStaticDetailOnTouch).toBe(true);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        for(const material of[mesh.userData.dayMaterial,mesh.userData.nightMaterial])expect(material.map).toBeNull();
        if(root===native)for(let i=0;i<mesh.count;i++) {
          const m=new Matrix4();mesh.getMatrixAt(i,m);
          for(const index of[1,2,3,4,6,7,8,9,11])expect(m.elements[index]).toBe(0);
        }
      }
      expect(root.userData.renderBytes).toBe(bytes(root));
    }
    expect(bytes(drawn)).toBeLessThan(1_100_000);
    expect(drawn.children.filter(child=>child.userData.hbfFloorComplementsV291)).toHaveLength(1);
    expect(bytes(native)).toBeLessThan(1_800_000);
    const bounds=new Box3().setFromObject(drawn);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-41);
    expect(bounds.max.x).toBeLessThanOrEqual(41);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-90.0001);
    expect(bounds.max.z).toBeLessThanOrEqual(90.0001);
  });
});
