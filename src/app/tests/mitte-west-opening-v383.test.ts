import {expect,test} from "bun:test";
import {exteriorSitesV378} from "../src/berlinDetailSitesV378";
import {openingSiteOwnerV379} from "../src/openingSiteOwnerV379";
import {loadBerlinPlaceViewsV378, startupFlightView, startupOnlySight} from "../src/startupView";
import {mitteWestViewsV383} from "../src/mitteWestViewsV383";
import {findSightBySlug,sightSlug} from "../src/viewNavigation";

test("every shared place link resolves to its camera and published street, facade or core owner",async()=>{
  await loadBerlinPlaceViewsV378();
  const districtManifest = await Bun.file(new URL("../public/mesh/surrounding-berlin-v159/manifest.json",import.meta.url)).json();
  const known = new Set([...exteriorSitesV378, ...districtManifest.chunks].map(site=>site.id));
  const places = Object.keys(mitteWestViewsV383).map(name=>({name}));
  for(const [name,view] of Object.entries(mitteWestViewsV383)){
    expect(findSightBySlug(places,sightSlug(name))?.name).toBe(name);
    expect(startupOnlySight(name)?.name).toBe(name);
    expect(startupFlightView(name).pose).toEqual({position:view.position,target:view.target});
    const [x,,z]=view.target;
    const owners=openingSiteOwnerV379(name,x,z);
    expect(owners.waitForAll).toBe(true);
    for(const id of owners.required) expect(known.has(id)).toBe(true);
  }
  expect(openingSiteOwnerV379("Hallesches Tor",1261,2379).required).toEqual([]);
  expect(openingSiteOwnerV379("Gendarmenmarkt",1401,626).required).toEqual(["mitte383-street-2_1"]);
  expect(openingSiteOwnerV379("Wittenbergplatz",-1975,1856).required).toContain("wit383--4_3");
  expect(openingSiteOwnerV379("St. Matthias am Winterfeldtplatz",-1202,2613).required).toEqual(["schoeneberg383-winter","-3_4","-3_5"]);
});
