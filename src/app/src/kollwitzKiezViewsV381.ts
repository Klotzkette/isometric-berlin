import {kollwitzFrontViewsV381} from "./kollwitzFrontViewsV381";
import {kollwitzFurnitureViewsV381} from "./kollwitzFurnitureViewsV381";
import {kollwitzplatzViewsV381} from "./kollwitzplatzViewsV381";
import {rykeBasilicaViewsV381} from "./rykeBasilicaViewsV381";
import {rykeStreetsOpeningHostV381, rykeStreetsViewsV381} from "./rykeStreetsIndexV381";
import {wasserturmParkViewsV381} from "./wasserturmParkViewsV381";
import {placesRequiringAllOwners, regionalPlaceOwnersV380} from "./openingSiteOwnerV379";

export const kollwitzKiezViewsV381 = {
  ...kollwitzplatzViewsV381, ...rykeStreetsViewsV381, ...wasserturmParkViewsV381,
  ...rykeBasilicaViewsV381, ...kollwitzFrontViewsV381, ...kollwitzFurnitureViewsV381,
};
function owner(x:number,z:number) {
  return Math.floor(x/512)+"_"+Math.floor(z/512);
}
for(const [name,view] of Object.entries(kollwitzKiezViewsV381)) {
  const [x,,z] = view.target;
  const required=[owner(x,z)];
  if(Object.hasOwn(kollwitzplatzViewsV381,name)) required.push("kollwitz381-platz");
  if(Object.hasOwn(wasserturmParkViewsV381,name)) required.push("wasserturm381-park");
  const street=rykeStreetsOpeningHostV381(name);
  if(street) required.push(street);
  regionalPlaceOwnersV380.set(name,required);
  if (required.length > 1) placesRequiringAllOwners.add(name);
}
