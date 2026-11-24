import { arbeitsministeriumUndMehringplatzViewsV383 } from "./mehringplatzViewsV383";
import { schoenebergPlaetzeOpeningHostV383, schoenebergPlaetzeViewsV383 } from "./schoenebergPlaetzeViewsV383";
import { wittenbergQuartierViewsV383 } from "./wittenbergQuartierIndexV383";
import { placesRequiringAllOwners, regionalPlaceOwnersV380 } from "./openingSiteOwnerV379";
import { coreMitteStreetsHostsV383 } from "./coreMitteStreetsIndexV383";

type View = {position:[number,number,number]; target:[number,number,number]; fov:number};
const mitteViews: Record<string,View> = {
  "Gendarmenmarkt": {position:[1514,126,675], target:[1401,5,626], fov:63},
  "Schillerdenkmal am Gendarmenmarkt": {position:[1450,22,639], target:[1429,11,621], fov:48},
  "Quartier 205 an der Friedrichstraße": {position:[1199,25,733], target:[1223,16,741], fov:59},
  "Hausvogteiplatz": {position:[1723,27,658], target:[1694,6.8,683], fov:54},
  "Denkzeichen am Hausvogteiplatz": {position:[1719.2,11.2,676.2], target:[1708.6,7.2,672.2], fov:48},
  "Sanchi-Tor am Humboldt Forum": {position:[2018,12.5,115], target:[2033.7,10.5,126.6], fov:45},
  "Schinkelplatz mit Brunnen und Exedra": {position:[1811,30,266], target:[1835.5,7.7,293], fov:51},
  "Unter den Linden": {position:[632,25,264], target:[785,8,275], fov:48},
  "Friedrichstraße und Unter den Linden": {position:[1160,42,186], target:[1229,13,249], fov:52},
  "Historisches Gouverneurshaus Unter den Linden": {position:[1410,25,202], target:[1396,15,250], fov:52},
  "Neue Kommandantur an der Schlossbrücke": {position:[1805,21,176],target:[1786,14,216],fov:48},
  "Neue Wache und Kastanienwäldchen": {position:[1590,35,218],target:[1631,17,150],fov:54},
  "Unter den Linden 39": {position:[1081,26,224],target:[1099,17,274],fov:50},
  "Unter den Linden 55 bis 61": {position:[900,23,236],target:[887,15,291],fov:50},
  "Unter den Linden 10": {position:[1268,21,224], target:[1283,16,198], fov:48},
};

export const mitteWestViewsV383: Record<string,View> = {
  ...mitteViews, ...arbeitsministeriumUndMehringplatzViewsV383, ...wittenbergQuartierViewsV383,
  ...schoenebergPlaetzeViewsV383,
  "Wittenbergplatz": {position:[-1899,55,1904],target:[-1975,12,1856],fov:53},
  "Hallesches Tor": arbeitsministeriumUndMehringplatzViewsV383["Hochbahnhof Hallesches Tor"],
  "Mehringplatz": arbeitsministeriumUndMehringplatzViewsV383["Mehringplatz und Friedenssäule"],
};
const streetIds = new Set(coreMitteStreetsHostsV383.map(site => site.id));
for (const [name, view] of Object.entries(mitteWestViewsV383)) {
  const [x,,z] = view.target, tile = Math.floor(x/512)+"_"+Math.floor(z/512);
  const required: string[] = [];
  if (streetIds.has("mitte383-street-"+tile)) required.push("mitte383-street-"+tile);
  if (name === "Unter den Linden" || name === "Unter den Linden 55 bis 61") required.push("lindenfront383-west");
  if (["Friedrichstraße und Unter den Linden","Historisches Gouverneurshaus Unter den Linden","Unter den Linden 10", "Unter den Linden 39"].includes(name))
    required.push("lindenfront383-mitte");
  if (name === "Neue Kommandantur an der Schlossbrücke") required.push("lindenfront383-ost");
  if (Object.hasOwn(wittenbergQuartierViewsV383,name) || name === "Wittenbergplatz") required.push("wit383-"+tile);
  const schoeneberg = schoenebergPlaetzeOpeningHostV383(name);
  if (schoeneberg) required.push(schoeneberg);
  // The church spans two original city packets. Both halves, their roofs and
  // their predecessor retirements arrive with the square in a shared view.
  if (schoeneberg === "schoeneberg383-winter") required.push("-3_4", "-3_5");
  regionalPlaceOwnersV380.set(name,required);
  // A fully core-built place is ready with its world. Multiple local packets
  // (surfaces and walls) are complete when each requested host has arrived.
  placesRequiringAllOwners.add(name);
}
