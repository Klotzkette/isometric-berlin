import {embassyViewsV380} from "./embassyViewsV380";
import {jannowitzViewsV380} from "./jannowitzViewsV380";
import {kreuzbergPlaetzeViewsV380} from "./kreuzbergPlaetzeViewsV380";
import {prenzlauerStreetsViewsV380} from "./prenzlauerStreetsViewsV380";
import {torstrasseOpeningHostV380, torstrasseViewsV380} from "./torstrasseIndexV380";
import {regionalPlaceOwnersV380} from "./openingSiteOwnerV379";
import diplomatic from "./data/diplomaticViewsV380.json";

type View = {position: [number,number,number]; target: [number,number,number]; fov: number};
const diplomaticViews = diplomatic as unknown as Record<string, View & {host:string}>;
export const berlinPlaceViewsV380: Record<string,View> = {
  "Französische Botschaft am Pariser Platz": {position:[476,40,287],target:[519,15,231],fov:46},
  "Amerikanische Botschaft am Pariser Platz": {position:[500,39,299],target:[461,15,359],fov:46},
  "Britische Botschaft an der Wilhelmstraße": {position:[675,49,355],target:[626,16,381],fov:46},
  "Russische Botschaft Unter den Linden": {position:[772,52,236],target:[802,19,322],fov:46},
  "Schweizerische Botschaft im Spreebogen": {position:[34,41,-194],target:[-5,15,-247],fov:47},
  "Kanadische Botschaft am Leipziger Platz": {position:[434,44,1018],target:[391,17,962],fov:48},
  "Tschechisches Botschaftsgebäude an der Wilhelmstraße": {position:[774,45,822],target:[830,16,860],fov:47},
  "Österreichische Botschaft im Diplomatenviertel": {position:[-503,49,1021],target:[-551,15,1035],fov:45},
  "Mexikanische Botschaft im Diplomatenviertel": {position:[-1366,38,1119],target:[-1403,12,1165],fov:46},
  "Nordische Botschaften und Felleshus": {position:[-1356,75,1171],target:[-1449,12,1080],fov:49},
  ...diplomaticViews, ...embassyViewsV380, ...jannowitzViewsV380, ...kreuzbergPlaetzeViewsV380,
  ...prenzlauerStreetsViewsV380, ...torstrasseViewsV380,
};

// This catalogue is lazy. Direct links and search load it before selecting a site.
for (const [name,view] of Object.entries(diplomaticViews)) regionalPlaceOwnersV380.set(name,[view.host]);
regionalPlaceOwnersV380.set("Clayallee 82 – Botschaft des Sultanats Oman",["outer187--13_12",diplomaticViews["Clayallee 82 – Botschaft des Sultanats Oman"].host]);
for (const [name,view] of Object.entries({...jannowitzViewsV380,...prenzlauerStreetsViewsV380})) {
  regionalPlaceOwnersV380.set(name,[Math.floor(view.target[0]/512)+"_"+Math.floor(view.target[2]/512)]);
}
for (const name of Object.keys(torstrasseViewsV380)) regionalPlaceOwnersV380.set(name,[torstrasseOpeningHostV380(name)!]);
regionalPlaceOwnersV380.set("Moritzplatz",["kreuzberg380-moritz"]);
regionalPlaceOwnersV380.set("Rio-Reiser-Platz (Heinrichplatz)",["kreuzberg380-rio"]);
regionalPlaceOwnersV380.set("Spanische Botschaft am Neuen See",["embassy380-es"]);
regionalPlaceOwnersV380.set("Nordkoreanische Botschaft an der Glinkastraße",["embassy380-kp"]);
regionalPlaceOwnersV380.set("Chinesische Botschaft an der Jannowitzbrücke",["embassy380-cn"]);
